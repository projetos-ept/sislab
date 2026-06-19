// laudo_scripts.js v2.1.0

import { searchHistorico, getProtocoloById, addOrUpdateLaudo, getLaudoByPatientId } from './data_storage.js';
import { formatDateToDisplay, showError, clearError } from './sislab_utils.js';
import { EXAM_DETAILS } from './exames_ref.js';
import { sincronizarAgora } from './sync.js';

let selectedPatientData = null;

// ── Toast de sincronização ───────────────────────────────────────────────────

function mostrarToastSync(mensagem, tipo) {
    const toast = document.createElement('div');
    toast.textContent = mensagem;
    toast.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'z-index:9999',
        'padding:10px 18px', 'border-radius:6px', 'font-size:0.9em',
        'color:#fff', 'box-shadow:0 2px 8px rgba(0,0,0,0.25)', 'transition:opacity 0.4s',
        tipo === 'ok' ? 'background:#28a745' : tipo === 'erro' ? 'background:#CC3333' : 'background:#1A2B4C'
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    setTimeout(() => toast.remove(), 3500);
}

// ── Código de verificação do laudo ────────────────────────────────────────────

function gerarCodigoVerificacao() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

function exibirCodigoNaUI(codigo) {
    const row = document.getElementById('verificationCodeRow');
    const el  = document.getElementById('verificationCode');
    if (!row || !el) return;
    if (codigo) { el.textContent = codigo; row.style.display = ''; }
    else { row.style.display = 'none'; }
}

// ── Logo SmartLab para o PDF ──────────────────────────────────────────────────

const SMARTLAB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 110"><g transform="translate(200,5)"><text y="55" text-anchor="middle" style="font-family:Arial Black,sans-serif;font-size:64px;font-weight:900;fill:#1d3557;letter-spacing:-2.5px">Smart<tspan style="font-weight:300;fill:#00b4d8;letter-spacing:-1.5px">Lab</tspan></text><g transform="translate(-100,65)"><rect width="200" height="28" rx="4" ry="4" style="stroke:#1d3557;stroke-width:2;fill:none"/><text x="100" y="19" text-anchor="middle" style="font-family:Arial,sans-serif;font-size:16px;font-weight:900;fill:#1d3557;letter-spacing:2px">CETEP / LNAB</text></g></g></svg>`;

let smartlabLogoDataUrl = null;

export async function loadSmartlabLogo() {
    try {
        const blob = new Blob([SMARTLAB_SVG], { type: 'image/svg+xml' });
        const url  = URL.createObjectURL(blob);
        await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 400; canvas.height = 110;
                canvas.getContext('2d').drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                smartlabLogoDataUrl = canvas.toDataURL('image/png');
                resolve();
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            img.src = url;
        });
    } catch (_) {}
}

// ── Renderiza cabeçalho do laudo no PDF ───────────────────────────────────────
export function renderLaudoHeader(doc, logoUrl, laudoDate, casoClinico = null) {
    const [dateStr, timeStr] = laudoDate.split(' ');
    const navy = [26, 43, 76];

    // ── Aviso educacional: linha cinza vertical + texto rotacionado (margem esquerda)
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.4);
    doc.line(8, 0, 8, 297);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(85, 85, 85);
    doc.text(
        'USO EXCLUSIVAMENTE EDUCACIONAL  -  Este laudo foi produzido em ambiente de treinamento e nao possui validade clinica, diagnostica ou legal.',
        7, 245, { angle: 90 }
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);

    // ── Margem branca superior (~7 mm)

    // ── Faixa escura: y=7, h=8
    doc.setFillColor(...navy);
    doc.rect(0, 7, 210, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`EMISSÃO: ${dateStr || ''}  |  ${timeStr || ''}`, 20, 12.5);
    doc.text('@ cetep.lnab   |   WWW.CETEPNAB.COM.BR', 192, 12.5, null, null, 'right');

    // ── Logo CETEP (esquerda, alinhado com a linha separadora em x=20)
    try { doc.addImage(logoUrl, 'PNG', 20, 16, 22, 22); } catch (_) {}

    // ── Título principal (centralizado)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    doc.text('LABORATÓRIO DE ANÁLISES CLÍNICAS', 105, 23, null, null, 'center');

    // ── Logo SmartLab centralizado sob o título (42 mm → x = 105 - 21 = 84)
    if (smartlabLogoDataUrl) {
        try { doc.addImage(smartlabLogoDataUrl, 'PNG', 84, 26, 42, 11); } catch (_) {}
    }

    // ── Endereço abaixo dos dois logos (CETEP termina y=38, SmartLab termina y=37)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text('R. Mario Laerte, 163 - Centro, Alagoinhas - BA  |  CEP: 48005-098', 105, 40, null, null, 'center');

    // ── Separadores duplos com RESULTADOS
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.5);
    doc.line(20, 43, 190, 43);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...navy);
    doc.setCharSpace(3);
    doc.text('RESULTADOS', 105, 49.5, null, null, 'center');
    doc.setCharSpace(0);

    doc.setLineWidth(0.5);
    doc.line(20, 52, 190, 52);

    // ── Stamp CASO CLÍNICO (opcional)
    if (casoClinico) {
        doc.setFillColor(26, 115, 152);
        doc.roundedRect(20, 53.5, 170, 7, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        const tituloTrunc = casoClinico.length > 80 ? casoClinico.slice(0, 77) + '...' : casoClinico;
        doc.text(`CASO CLÍNICO: ${tituloTrunc}`, 105, 58.5, null, null, 'center');
    }

    // ── Restaurar estado
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setLineWidth(0.5);

    return casoClinico ? 66 : 59; // y de início do conteúdo
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function calcularIdade(dataString) {
    const hoje = new Date();
    const nasc = new Date(dataString + 'T00:00:00');
    if (isNaN(nasc.getTime()) || nasc > hoje) return null;
    let anos = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() ||
        (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) anos--;
    let meses = hoje.getMonth() - nasc.getMonth();
    if (hoje.getDate() < nasc.getDate()) meses--;
    if (meses < 0) meses += 12;
    return { anos, meses };
}

function sanitizePdfText(v) {
    return typeof v === 'string' ? v.replace(/[$~]/g, '') : String(v ?? '');
}

// ── Inicialização ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadSmartlabLogo();
    document.getElementById('searchPatientBtn')?.addEventListener('click', searchPatient);
    document.getElementById('clearSearchBtn')?.addEventListener('click', clearSearchAndPatientData);
    document.getElementById('saveLaudoBtn')?.addEventListener('click', saveLaudo);
    document.getElementById('generatePdfLaudoBtn')?.addEventListener('click', generatePdfLaudo);
    document.getElementById('clearLaudoFieldsBtn')?.addEventListener('click', clearAllLaudoFields);
    document.getElementById('addAvulsoBtn')?.addEventListener('click', adicionarExameAvulso);
    document.getElementById('searchQuery')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') { e.preventDefault(); searchPatient(); }
    });
    // Event delegation para editar/remover exames (um único listener no container)
    document.getElementById('examResultsContainer')?.addEventListener('click', handleExamContainerClick);
});

function handleExamContainerClick(e) {
    const editBtn   = e.target.closest('.edit-exam-btn');
    const removeBtn = e.target.closest('.remove-exam-btn');

    if (editBtn) {
        const item = editBtn.closest('.exam-result-item');
        if (editBtn.dataset.action === 'edit') {
            item.classList.remove('read-only');
            item.querySelectorAll('input, select, textarea').forEach(f => {
                f.removeAttribute('readonly');
                f.removeAttribute('disabled');
            });
            editBtn.textContent = 'Salvar';
            editBtn.dataset.action = 'save';
        } else {
            item.classList.add('read-only');
            item.querySelectorAll('input, select, textarea').forEach(f => f.setAttribute('readonly', true));
            item.querySelectorAll('select').forEach(s => s.setAttribute('disabled', true));
            editBtn.textContent = 'Editar';
            editBtn.dataset.action = 'edit';
        }
    }

    if (removeBtn) {
        const item = removeBtn.closest('.exam-result-item');
        if (confirm('Remover este exame do laudo?')) item.remove();
    }
}

// ── Busca e seleção ───────────────────────────────────────────────────────────

function resetSections() {
    document.querySelector('.patient-display-section').style.display = 'none';
    document.querySelector('.results-input-section').style.display = 'none';
    document.querySelector('.signature-section').style.display = 'none';
}

function clearSearchAndPatientData() {
    document.getElementById('searchQuery').value = '';
    clearError('searchQuery');
    document.getElementById('searchResultStatus').textContent = 'Nenhum paciente encontrado ou selecionado.';
    document.getElementById('patientResultsList').innerHTML = '';
    resetSections();
    selectedPatientData = null;
    ['patientProtocol','patientName','patientCPF','patientAge','patientDOB','patientGender','patientContact','patientAddress']
        .forEach(id => { document.getElementById(id).textContent = ''; });
    document.getElementById('examResultsContainer').innerHTML = '';
    document.getElementById('observacoesLaudoGeral').value = '';
    document.getElementById('responsavelTecnicoNome').value = '';
    document.getElementById('responsavelTecnicoRegistro').value = '';
}

function clearAllLaudoFields() {
    clearSearchAndPatientData();
    alert('Todos os campos do laudo foram limpos.');
}

async function searchPatient() {
    const query    = document.getElementById('searchQuery').value.trim();
    const statusEl = document.getElementById('searchResultStatus');
    const listEl   = document.getElementById('patientResultsList');
    clearError('searchQuery');
    listEl.innerHTML = '';
    statusEl.textContent = 'Buscando...';
    resetSections();
    try {
        const results = searchHistorico(query);
        if (!results.length) { statusEl.textContent = 'Nenhum paciente encontrado.'; return; }
        statusEl.textContent = `${results.length} paciente(s) encontrado(s). Selecione abaixo:`;
        results.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.nome} (CPF: ${p.cpf || 'N/D'}, Protocolo: ${p.protocolo || 'N/D'})`;
            li.style.cssText = 'cursor:pointer;padding:8px;border-bottom:1px solid #eee';
            li.addEventListener('click', () => selectPatient(p.id));
            listEl.appendChild(li);
        });
    } catch (err) {
        statusEl.textContent = 'Erro ao buscar paciente.';
        alert(`Erro ao buscar: ${err.message}`);
    }
}

async function selectPatient(patientId) {
    document.getElementById('patientResultsList').innerHTML = '';
    document.getElementById('searchResultStatus').textContent = 'Paciente selecionado.';
    document.querySelector('.patient-display-section').style.display = 'block';
    document.querySelector('.results-input-section').style.display = 'block';
    document.querySelector('.signature-section').style.display = 'block';
    document.getElementById('examResultsContainer').innerHTML = '';
    document.getElementById('observacoesLaudoGeral').value = '';
    try {
        const patient = getProtocoloById(patientId);
        if (!patient) { alert('Paciente não encontrado.'); clearSearchAndPatientData(); return; }
        selectedPatientData = patient;
        const lastLaudo = getLaudoByPatientId(patientId);
        document.getElementById('responsavelTecnicoNome').value    = lastLaudo?.responsavelTecnico?.nome     || '';
        document.getElementById('responsavelTecnicoRegistro').value = lastLaudo?.responsavelTecnico?.registro || '';
        exibirCodigoNaUI(lastLaudo?.codigoVerificacao || gerarCodigoVerificacao());
        displayPatientData(patient);
        displayPatientExamsForLaudo(
            patient.exames,
            patient.examesNaoListados,
            patient.sexo,
            lastLaudo?.examesResultados ?? null,
            lastLaudo?.observacoesGerais ?? ''
        );
        const now = new Date();
        document.getElementById('laudoGenerationDate').textContent =
            `${formatDateToDisplay(now)} ${now.toTimeString().slice(0, 8)}`;
        window.scrollTo({ top: document.querySelector('.patient-display-section').offsetTop, behavior: 'smooth' });
    } catch (err) {
        alert(`Erro ao carregar paciente: ${err.message}`);
        clearSearchAndPatientData();
    }
}

function buildWhatsAppLink(p) {
    const digits = (p.contato || '').replace(/\D/g, '').replace(/^0/, '');
    if (!digits || digits.length < 10) return null;
    const numero = '55' + digits;
    const dataColeta = p.timestamp
        ? new Date(p.timestamp).toLocaleDateString('pt-BR') : '';
    const examesList = Array.isArray(p.exames) && p.exames.length
        ? p.exames.join(', ') : 'exames solicitados';
    const msg = `Olá ${p.nome || ''}, obrigado por ser voluntário em nosso projeto no CETEP/LNAB.` +
        (dataColeta ? ` Sua coleta foi realizada em ${dataColeta}.` : '') +
        ` Os exames solicitados foram: ${examesList}.` +
        ` Lembrando que este é um laudo educacional e não substitui avaliação em laboratório clínico.`;
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = 'Enviar via WhatsApp';
    a.style.cssText = 'margin-left:8px;vertical-align:middle;display:inline-flex;align-items:center;';
    a.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="#25D366">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.116 1.535 5.845L.057 23.571a.5.5 0 0 0 .614.612l5.807-1.522A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.903 0-3.68-.528-5.195-1.442l-.372-.22-3.851 1.01 1.026-3.748-.242-.385A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>`;
    return a;
}

function displayPatientData(p) {
    document.getElementById('patientProtocol').textContent = p.protocolo || 'N/D';
    const nameSpan = document.getElementById('patientName');
    nameSpan.textContent = p.nome || 'N/D';
    const waLink = buildWhatsAppLink(p);
    const oldLink = nameSpan.parentElement.querySelector('a.wa-link');
    if (oldLink) oldLink.remove();
    if (waLink) { waLink.classList.add('wa-link'); nameSpan.parentElement.appendChild(waLink); }
    document.getElementById('patientCPF').textContent     = p.cpf
        ? p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'N/D';
    let idadeTexto = 'N/D';
    if (p.dataNasc) {
        const idade = calcularIdade(p.dataNasc);
        if (idade) idadeTexto = `${idade.anos} ${idade.anos === 1 ? 'ano' : 'anos'}` +
            `${idade.meses ? ` e ${idade.meses} ${idade.meses === 1 ? 'mês' : 'meses'}` : ''}`;
    }
    document.getElementById('patientAge').textContent     = idadeTexto;
    document.getElementById('patientDOB').textContent     = p.dataNasc
        ? formatDateToDisplay(new Date(p.dataNasc + 'T00:00:00')) : 'N/D';
    document.getElementById('patientGender').textContent  = p.sexo    || 'N/D';
    document.getElementById('patientContact').textContent = p.contato || 'N/D';
    document.getElementById('patientAddress').textContent = p.endereco || 'N/D';
}

// ── Renderização de exames ────────────────────────────────────────────────────

const DEFAULT_MATERIALS = ['Soro','Sangue Total','Plasma (Citrato)','Urina','Fezes'];

function buildListedExamHTML(examName, index, saved, patientGender) {
    const detail = EXAM_DETAILS[examName] || {};
    const result  = saved?.resultado         ?? '';
    const unit    = saved?.unidade           ?? detail.defaultUnit     ?? 'N/A';
    const obs     = saved?.observacaoExame   ?? detail.specificObservation ?? '';
    const material = saved?.material         ?? detail.defaultMaterial ?? 'Soro';
    const method  = saved?.metodo            ?? detail.defaultMethod   ?? 'N/A';
    const performer = saved?.realizadoPor    ?? '';
    let ref = saved?.referencia ?? 'N/A';
    if (!saved && detail.referenceRange) {
        const gk = patientGender === 'Masculino' ? 'male' : patientGender === 'Feminino' ? 'female' : 'general';
        ref = detail.referenceRange[gk] || detail.referenceRange.general || 'N/A';
    }

    let resultField;
    if (detail.inputType === 'select' && detail.options?.length) {
        const opts = detail.options.map(o =>
            `<option value="${o}"${o === result ? ' selected' : ''}>${o}</option>`).join('');
        resultField = `<select class="exam-result-value" disabled>${opts}</select>`;
    } else {
        resultField = `<input type="text" class="exam-result-value" value="${result}" placeholder="Resultado" readonly>`;
    }

    const matOpts = (detail.materialOptions || DEFAULT_MATERIALS)
        .map(o => `<option${o === material ? ' selected' : ''}>${o}</option>`).join('');
    const metOpts = (detail.methodOptions || ['N/A'])
        .map(o => `<option${o === method ? ' selected' : ''}>${o}</option>`).join('');

    const id = `exam-${index}-${examName.replace(/[^a-zA-Z0-9]/g, '')}`;
    return `
        <div class="exam-result-item read-only" data-exam-id="${id}" data-exam-name="${examName}">
            <div class="exam-item-header"><strong>${examName}</strong></div>
            <div class="mat-met-row">
                <div class="field-group"><label>Material:</label>
                    <select class="exam-material-value" disabled>${matOpts}</select>
                </div>
                <div class="field-group"><label>Método:</label>
                    <select class="exam-method-value" disabled>${metOpts}</select>
                </div>
            </div>
            <div class="result-row">
                <label>Resultado / Unidade de Medida / Valores de Referência:</label>
                <div class="result-inputs">
                    ${resultField}
                    <input type="text" class="exam-unit-value" value="${unit}" placeholder="Unidade" readonly>
                    <input type="text" class="exam-ref-value" value="${ref}" placeholder="Ref. (opcional)" readonly>
                </div>
            </div>
            <textarea class="exam-observation" rows="2" placeholder="Observações específicas para este exame." readonly>${obs}</textarea>
            <input type="text" class="exam-performer-value" value="${performer}"
                placeholder="Teste realizado por: nome e identificação do estudante"
                style="margin-top:6px;font-style:italic;color:#888;font-size:0.88em;width:100%;border:none;border-bottom:1px dashed #ccc;background:transparent;padding:3px 0;"
                readonly>
            <div class="edit-button-container">
                <button class="edit-exam-btn" data-action="edit">Editar</button>
            </div>
        </div>`;
}

function buildCustomExamHTML(examName, index, saved) {
    const id       = `custom-${index}-${Date.now()}`;
    const result   = saved?.resultado       ?? '';
    const unit     = saved?.unidade         ?? '';
    const ref      = saved?.referencia      ?? '';
    const obs      = saved?.observacaoExame ?? '';
    const material = saved?.material        ?? '';
    const method   = saved?.metodo          ?? '';
    const performer = saved?.realizadoPor   ?? '';
    return `
        <div class="exam-result-item custom-exam" data-exam-id="${id}" data-exam-name="${examName}" data-custom="true">
            <div class="exam-item-header">
                <span class="custom-exam-badge">Exame avulso — todos os campos editáveis</span>
                <input type="text" class="exam-name-input" value="${examName}" placeholder="Nome do exame"
                    style="font-weight:bold;font-size:1em;border:none;border-bottom:2px solid #1A2B4C;
                           width:100%;padding:4px 0;background:transparent;margin-top:4px">
            </div>
            <div class="mat-met-row">
                <div class="field-group"><label>Material:</label>
                    <input type="text" class="exam-material-value" value="${material}"
                        placeholder="Ex: Soro" style="min-width:120px;width:auto">
                </div>
                <div class="field-group"><label>Método:</label>
                    <input type="text" class="exam-method-value" value="${method}"
                        placeholder="Ex: Enzimático Colorimétrico" style="min-width:180px;width:auto">
                </div>
            </div>
            <div class="result-row">
                <label>Resultado / Unidade de Medida / Valores de Referência:</label>
                <div class="result-inputs">
                    <input type="text" class="exam-result-value" value="${result}" placeholder="Resultado">
                    <input type="text" class="exam-unit-value"   value="${unit}"   placeholder="Unidade">
                    <input type="text" class="exam-ref-value"    value="${ref}"    placeholder="Ref. (opcional)">
                </div>
            </div>
            <textarea class="exam-observation" rows="2" placeholder="Observações específicas para este exame.">${obs}</textarea>
            <input type="text" class="exam-performer-value" value="${performer}"
                placeholder="Teste realizado por: nome e identificação do estudante"
                style="margin-top:6px;font-style:italic;color:#888;font-size:0.88em;width:100%;border:none;border-bottom:1px dashed #ccc;background:transparent;padding:3px 0;">
            <div class="edit-button-container">
                <button class="remove-exam-btn">Remover</button>
            </div>
        </div>`;
}

function displayPatientExamsForLaudo(examesList, examesNaoListados, patientGender, savedExamesResults = null, savedObservacoesGerais = '') {
    const container = document.getElementById('examResultsContainer');
    container.innerHTML = '';
    const defaultObs = 'As informações contidas neste laudo não substituem a realização de exames laboratoriais. Para sua segurança e precisão nos resultados, recomenda-se a consulta a um laboratório de sua confiança.';
    document.getElementById('observacoesLaudoGeral').value = savedObservacoesGerais || defaultObs;

    const allExams = [];
    if (Array.isArray(examesList)) allExams.push(...examesList);
    if (examesNaoListados?.trim())
        allExams.push(...examesNaoListados.split('\n').map(e => e.trim()).filter(Boolean));

    const savedMap = new Map();
    if (Array.isArray(savedExamesResults))
        savedExamesResults.forEach(e => { if (e.nomeExame) savedMap.set(e.nomeExame, e); });

    if (!allExams.length && !savedMap.size) {
        container.innerHTML = '<p>Nenhum exame para laudar neste protocolo.</p>';
        return;
    }

    allExams.forEach((name, i) => {
        const saved = savedMap.get(name);
        container.insertAdjacentHTML('beforeend',
            saved?.custom
                ? buildCustomExamHTML(name, i, saved)
                : buildListedExamHTML(name, i, saved, patientGender)
        );
    });

    // Exames avulsos salvos que não fazem parte da lista do protocolo
    if (Array.isArray(savedExamesResults)) {
        savedExamesResults
            .filter(s => s.custom && !allExams.includes(s.nomeExame))
            .forEach((s, i) =>
                container.insertAdjacentHTML('beforeend',
                    buildCustomExamHTML(s.nomeExame, allExams.length + i, s)));
    }
}

function adicionarExameAvulso() {
    const container = document.getElementById('examResultsContainer');
    const count = container.querySelectorAll('.exam-result-item').length;
    container.insertAdjacentHTML('beforeend', buildCustomExamHTML('', count, null));
    container.querySelector('.exam-result-item:last-child .exam-name-input')?.focus();
}

// ── Salvar laudo ───────────────────────────────────────────────────────────────

async function saveLaudo() {
    if (!selectedPatientData) { alert('Selecione um paciente antes de salvar o laudo.'); return; }

    const existingLaudo = getLaudoByPatientId(selectedPatientData.id);
    const codigoVerificacao = existingLaudo?.codigoVerificacao
        || document.getElementById('verificationCode')?.textContent?.trim()
        || gerarCodigoVerificacao();

    const examResults = [];
    document.querySelectorAll('.exam-result-item').forEach(item => {
        const isCustom  = item.dataset.custom === 'true';
        const examName  = isCustom
            ? (item.querySelector('.exam-name-input')?.value.trim() || '')
            : item.dataset.examName;
        if (!examName) return;
        if (isCustom) item.dataset.examName = examName;
        const entry = {
            nomeExame:      examName,
            resultado:      item.querySelector('.exam-result-value')?.value?.trim()  || '',
            unidade:        item.querySelector('.exam-unit-value')?.value.trim()     || '',
            referencia:     item.querySelector('.exam-ref-value')?.value.trim()      || '',
            observacaoExame:item.querySelector('.exam-observation')?.value.trim()    || '',
            material:       item.querySelector('.exam-material-value')?.value.trim() || '',
            metodo:         item.querySelector('.exam-method-value')?.value.trim()   || '',
            realizadoPor:   item.querySelector('.exam-performer-value')?.value.trim() || ''
        };
        if (isCustom) entry.custom = true;
        examResults.push(entry);
    });

    const laudoData = {
        patientId:        selectedPatientData.id,
        protocolo:        selectedPatientData.protocolo,
        nomePaciente:     selectedPatientData.nome,
        cpfPaciente:      selectedPatientData.cpf,
        examesResultados: examResults,
        observacoesGerais:document.getElementById('observacoesLaudoGeral').value.trim(),
        dataEmissao:      new Date().toISOString(),
        codigoVerificacao,
        responsavelTecnico: {
            nome:     document.getElementById('responsavelTecnicoNome').value.trim(),
            registro: document.getElementById('responsavelTecnicoRegistro').value.trim()
        }
    };

    try {
        const id = addOrUpdateLaudo(laudoData);

        // Sync imediato fire-and-forget — localStorage já foi gravado acima.
        document.addEventListener('sislab:sync-status', function onSync(e) {
            const s = e.detail;
            if (s.sincronizando) return;
            if (!navigator.onLine) {
                mostrarToastSync('Offline — será sincronizado pelo temporizador.', 'info');
            } else if (s.erro && s.erro !== 'Endpoint não configurado.') {
                mostrarToastSync('Erro de sincronização: ' + s.erro, 'erro');
            } else if (!s.erro && s.pendentes === 0) {
                mostrarToastSync('Laudo enviado ao servidor.', 'ok');
            }
        }, { once: true });
        sincronizarAgora();

        exibirCodigoNaUI(codigoVerificacao);
        alert(`Laudo salvo com sucesso! ID: ${id}`);
    } catch (err) {
        alert(`Erro ao salvar laudo: ${err.message}`);
    }
}

// ── Gerar PDF ──────────────────────────────────────────────────────────────────

function generatePdfLaudo() {
    if (!selectedPatientData) { alert('Selecione um paciente antes de gerar o PDF.'); return; }
    const container = document.getElementById('examResultsContainer');
    if (!container?.children.length) { alert('Nenhum exame carregado para gerar o PDF.'); return; }
    if (!window.jspdf) { alert('Biblioteca de PDF não carregada. Recarregue a página.'); return; }
    const { jsPDF } = window.jspdf;

    const doc      = new jsPDF();
    let y          = 15;
    const lh       = 7, mx = 20, limit = 280;
    const resNome  = document.getElementById('responsavelTecnicoNome').value.trim();
    const resReg   = document.getElementById('responsavelTecnicoRegistro').value.trim();
    const laudoDate = document.getElementById('laudoGenerationDate').textContent;
    const logoUrl  = 'https://hyskal.github.io/connect/logo.png';
    const codigoVer = document.getElementById('verificationCode')?.textContent?.trim() || null;

    const drawPageFooter = () => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(`Liberado por: Dr(a). ${resNome || 'N/D'}${resReg ? `, CRF/CRBM: ${resReg}` : ''}`,
            105, 285, null, null, 'center');
        if (codigoVer) {
            doc.setFontSize(7);
            doc.text(`Cód. Verificação: ${codigoVer}`, 105, 290, null, null, 'center');
        }
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
    };

    const drawHeader = (title) => {
        drawPageFooter();
        doc.addPage();
        y = renderLaudoHeader(doc, logoUrl, laudoDate);
        if (title === 'EXAMES (Continuação):') {
            const proto = document.getElementById('patientProtocol').textContent;
            const nome  = document.getElementById('patientName').textContent;
            const idade = document.getElementById('patientAge').textContent;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 100, 100);
            doc.text(`${proto}  |  ${nome}  |  ${idade}`, mx, y);
            y += 4;
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.line(mx, y, 190, y);
            y += 4;
            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.5);
            doc.setFontSize(10);
        }
        if (title) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(title, mx, y);
            doc.setFont('helvetica', 'normal');
            y += 8;
            doc.setFontSize(10);
        }
    };

    const br = (needed, title) => { if (y + needed > limit) drawHeader(title); };

    try {
        // Cabeçalho — página 1
        y = renderLaudoHeader(doc, logoUrl, laudoDate);

        // Dados do paciente
        br(lh * 7 + 18, 'DADOS DO PACIENTE:');
        doc.setFontSize(12); doc.text('DADOS DO PACIENTE:', mx, y); y += 8;
        doc.setFontSize(11);
        [
            `Protocolo: ${document.getElementById('patientProtocol').textContent}`,
            `Nome: ${document.getElementById('patientName').textContent}`,
            `CPF: ${document.getElementById('patientCPF').textContent}`,
            `Data de Nasc.: ${document.getElementById('patientDOB').textContent} (Idade: ${document.getElementById('patientAge').textContent})`,
            `Sexo: ${document.getElementById('patientGender').textContent}`,
            `Contato: ${document.getElementById('patientContact').textContent}`,
            `Endereço: ${document.getElementById('patientAddress').textContent}`
        ].forEach(line => { br(lh, null); doc.text(line, mx + 5, y); y += lh; });

        y += 5; br(10, null);
        doc.setLineWidth(0.2); doc.line(mx, y, 190, y); y += 10;

        // Exames
        br(20, 'EXAMES:');
        doc.setFontSize(12); doc.text('EXAMES:', mx, y); y += 8;
        doc.setFontSize(10);

        const items = document.querySelectorAll('.exam-result-item');
        items.forEach((item, idx) => {
            const isCustom = item.dataset.custom === 'true';
            const name = isCustom
                ? (item.querySelector('.exam-name-input')?.value.trim() || item.dataset.examName || '')
                : (item.dataset.examName || item.querySelector('strong')?.textContent || '');
            const result = sanitizePdfText(item.querySelector('.exam-result-value')?.value?.trim() || '');
            const unit   = sanitizePdfText(item.querySelector('.exam-unit-value')?.value.trim()   || '');
            const ref    = sanitizePdfText(item.querySelector('.exam-ref-value')?.value.trim()    || '');
            const obs    = sanitizePdfText(item.querySelector('.exam-observation')?.value.trim()  || '');
            const mat    = sanitizePdfText(item.querySelector('.exam-material-value')?.value.trim() || 'Soro');
            const met    = sanitizePdfText(item.querySelector('.exam-method-value')?.value.trim()  || 'N/A');
            const perf   = sanitizePdfText(item.querySelector('.exam-performer-value')?.value.trim() || '');

            let needed = lh * 3 + 7;
            if (ref)  needed += lh;
            if (obs)  needed += doc.splitTextToSize(`Obs.: ${obs}`, 170).length * 4;
            if (perf) needed += 5;
            br(needed, 'EXAMES (Continuação):');

            doc.setFont(undefined, 'bold');
            doc.text(`${name}: ${result} ${unit}`, mx + 5, y); y += lh;
            doc.setFont(undefined, 'normal');
            doc.text(`Material: ${mat}`, mx + 5, y); y += lh;
            doc.text(`Método: ${met}`,   mx + 5, y); y += lh;
            if (ref) { doc.text(`Valores de Referência: ${ref}`, mx + 5, y); y += lh; }
            if (obs) {
                doc.splitTextToSize(`Obs.: ${obs}`, 170).forEach(line => {
                    br(4, 'EXAMES (Continuação):');
                    doc.text(line, mx + 5, y); y += 4;
                });
            }
            if (perf) {
                br(5, 'EXAMES (Continuação):');
                y += 3;
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8.5);
                doc.setTextColor(130, 130, 130);
                doc.text(`Teste Realizado por:  ${perf}`, mx + 5, y); y += 5;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
            }
            y += 2;
            if (idx < items.length - 1) {
                br(5, 'EXAMES (Continuação):');
                doc.setLineDash([2, 2]); doc.line(mx, y, 190, y); doc.setLineDash([]); y += 5;
            }
        });

        br(10, null); doc.setLineWidth(0.2); doc.line(mx, y, 190, y); y += 10;

        // Assinatura
        br(lh * 3 + 15, null);
        doc.setFontSize(10);
        doc.text('__________________________________________', 105, y, null, null, 'center'); y += lh;
        doc.text(`Nome: Dr(a). ${resNome || 'N/D'}`,                   105, y, null, null, 'center'); y += lh;
        doc.text(`Registro: ${resReg ? `CRF/CRBM: ${resReg}` : 'N/D'}`, 105, y, null, null, 'center'); y += 5;
        br(10, null); doc.setLineWidth(0.2); doc.line(mx, y, 190, y); y += 10;

        // Observações gerais
        const obsGeral = document.getElementById('observacoesLaudoGeral').value.trim();
        if (obsGeral) {
            br(20, 'OBSERVAÇÕES GERAIS DO LAUDO:');
            doc.setFontSize(10); doc.text('OBSERVAÇÕES GERAIS DO LAUDO:', mx, y); y += 8;
            doc.setFontSize(9); doc.setFont(undefined, 'italic');
            doc.splitTextToSize(obsGeral, 170).forEach(line => {
                br(4, 'OBSERVAÇÕES GERAIS DO LAUDO (Continuação):');
                doc.setFont(undefined, 'italic');
                doc.text(line, mx + 5, y); y += 4;
            });
            doc.setFont(undefined, 'normal'); y += 5;
            br(10, null); doc.setLineWidth(0.2); doc.line(mx, y, 190, y);
        }

        drawPageFooter();

        doc.output('dataurlnewwindow', {
            filename: `Laudo_${selectedPatientData.nome.replace(/\s+/g, '_')}_${selectedPatientData.protocolo}.pdf`
        });
        alert('PDF do laudo gerado com sucesso!');
    } catch (err) {
        alert(`Erro ao gerar PDF: ${err.message}`);
    }
}
