// VERSÃO: 2.1.0 (script.js)

import {
    getHistorico, getNextProtocolNumber, addProtocolo, deleteProtocolos,
    clearHistorico, getProtocoloById, findByCpf,
    getListaExamesCache, setListaExamesCache
} from './data_storage.js';

window.SISLAB_VERSION = '2.1.0';

const SENHA_BASE = 'sislab';
let listaExames = [];

const DDDS_VALIDOS = new Set([
    11,12,13,14,15,16,17,18,19,21,22,24,27,28,
    31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
    51,53,54,55,61,62,63,64,65,66,67,68,69,
    71,73,74,75,77,79,81,82,83,84,85,87,88,89,91,92,93,94,95,96,97,98,99
]);

window.addEventListener('load', async () => {
    await carregarExames();

    document.getElementById('data_nasc').addEventListener('change', validateAge);
    document.getElementById('cpf').addEventListener('input', formatarCPF);
    document.getElementById('contato').addEventListener('input', formatarContato);
    document.getElementById('exames').addEventListener('change', e => {
        if (e.target.classList.contains('exame')) atualizarExamesSelecionadosDisplay();
    });

    document.getElementById('selectAllHistoryCheckbox')?.addEventListener('change', toggleAllHistoryCheckboxes);
    document.getElementById('deleteSelectedHistoryBtn')?.addEventListener('click', deleteSelectedHistory);
    document.getElementById('printSelectedHistoryBtn')?.addEventListener('click', printSelectedHistory);
    document.querySelector('#historico ul')?.addEventListener('change', e => {
        if (e.target.classList.contains('history-checkbox')) updateSelectAllMasterCheckbox();
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('gerar') === 'ficticio') await gerarPacienteAleatorio();
});

// ── Lista de exames ─────────────────────────────────────────────────────────

async function carregarExames() {
    let texto = getListaExamesCache();
    if (!texto) {
        try {
            const resp = await fetch('lista-de-exames.txt');
            if (resp.ok) { texto = await resp.text(); setListaExamesCache(texto); }
        } catch (_) {}
    }
    listaExames = texto ? texto.trim().split('\n').map(e => e.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')) : [];
    renderListaExames();
    configurarPesquisa();
}

function renderListaExames() {
    document.getElementById('exames').innerHTML = listaExames.map(e =>
        `<label><input type="checkbox" class="exame" value="${e}"> ${e}</label><br>`
    ).join('');
}

function configurarPesquisa() {
    const input = document.getElementById('pesquisaExame');
    const box = document.getElementById('sugestoes');

    input.addEventListener('input', () => {
        const t = input.value.trim().toLowerCase();
        box.innerHTML = '';
        if (!t) { box.style.display = 'none'; return; }
        const matches = listaExames.filter(e => e.toLowerCase().includes(t));
        if (!matches.length) { box.style.display = 'none'; return; }
        matches.forEach(e => {
            const d = document.createElement('div');
            d.textContent = e;
            d.addEventListener('click', () => { marcarExame(e); input.value = ''; box.style.display = 'none'; });
            box.appendChild(d);
        });
        box.style.display = 'block';
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('#pesquisaExame') && !e.target.closest('#sugestoes')) box.style.display = 'none';
    });
}

function marcarExame(nome) {
    const cb = document.querySelector(`#exames input[value="${nome}"]`);
    if (cb) {
        cb.checked = true;
        cb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="exame" value="${nome}" checked> ${nome}`;
        const container = document.getElementById('exames');
        container.appendChild(label);
        container.appendChild(document.createElement('br'));
        if (!listaExames.includes(nome)) { listaExames.push(nome); listaExames.sort((a, b) => a.localeCompare(b, 'pt-BR')); }
    }
    atualizarExamesSelecionadosDisplay();
}

function atualizarExamesSelecionadosDisplay() {
    const container = document.getElementById('examesSelecionadosDisplay');
    const sel = [...document.querySelectorAll('#exames .exame:checked')];
    if (!sel.length) { container.innerHTML = '<p>Nenhum exame selecionado.</p>'; return; }

    container.innerHTML = '';
    sel.forEach(cb => {
        const d = document.createElement('div');
        d.className = 'display-item';
        d.innerHTML = `<span>${cb.value}</span><button class="remove-item-btn" data-exame="${cb.value}">-</button>`;
        container.appendChild(d);
    });
    container.querySelectorAll('.remove-item-btn').forEach(btn => btn.addEventListener('click', e => {
        const cbox = document.querySelector(`#exames .exame[value="${e.target.dataset.exame}"]`);
        if (cbox) cbox.checked = false;
        atualizarExamesSelecionadosDisplay();
    }));
}

// ── Validações e formatação ─────────────────────────────────────────────────

function showError(id, msg) {
    document.getElementById(id)?.classList.add('error');
    const el = document.getElementById(`${id}-error`);
    if (el) el.textContent = msg;
}

function clearError(id) {
    document.getElementById(id)?.classList.remove('error');
    const el = document.getElementById(`${id}-error`);
    if (el) el.textContent = '';
}

function calcularIdade(dataStr) {
    const hoje = new Date();
    const nasc = new Date(dataStr + 'T00:00:00');
    if (isNaN(nasc.getTime()) || nasc > hoje) return null;

    let anos = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) anos--;

    let meses = hoje.getMonth() - nasc.getMonth();
    if (hoje.getDate() < nasc.getDate()) meses--;
    if (meses < 0) meses += 12;

    return { anos, meses };
}

function validateAge() {
    const dataNasc = document.getElementById('data_nasc').value;
    const idadeEl = document.getElementById('idade');
    if (!dataNasc) { clearError('data_nasc'); idadeEl.value = ''; return true; }
    const idade = calcularIdade(dataNasc);
    if (!idade) { showError('data_nasc', 'Data inválida ou futura.'); idadeEl.value = ''; return false; }
    idadeEl.value = idade.meses > 0 ? `${idade.anos} anos e ${idade.meses} meses` : `${idade.anos} anos`;
    clearError('data_nasc');
    return true;
}

function formatarCPF() {
    const el = document.getElementById('cpf');
    let v = el.value.replace(/\D/g, '').substring(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d+)/, '$1.$2');
    el.value = v;
}

function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += +cpf[i] * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto >= 10) resto = 0;
    if (resto !== +cpf[9]) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += +cpf[i] * (11 - i);
    resto = (soma * 10) % 11;
    if (resto >= 10) resto = 0;
    return resto === +cpf[10];
}

function validateCpfAndCheckHistory() {
    const cpf = document.getElementById('cpf').value.replace(/\D/g, '');
    if (document.getElementById('ignoreCpfCheckbox').checked || !cpf.length) { clearError('cpf'); return true; }
    if (!validarCPF(cpf)) { showError('cpf', 'CPF inválido.'); return false; }
    clearError('cpf');
    checkCpfInHistory(cpf);
    return true;
}

function checkCpfInHistory(cpf) {
    const resultados = findByCpf(cpf).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (!resultados.length) return;
    const p = resultados[0];
    if (confirm(
        `CPF encontrado no histórico:\n\nNome: ${p.nome}\nData Nasc.: ${p.dataNasc}\nSexo: ${p.sexo}\nEndereço: ${p.endereco}\nContato: ${p.contato}\n\nCarregar esses dados?`
    )) preencherCampos(p);
}

function formatarContato() {
    const el = document.getElementById('contato');
    let v = el.value.replace(/\D/g, '').substring(0, 11);
    if (v.length > 10) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    el.value = v;
}

function validateContact() {
    const v = document.getElementById('contato').value.replace(/\D/g, '');
    if (!v.length) { clearError('contato'); return true; }
    if (v.length < 2 || !DDDS_VALIDOS.has(+v.slice(0, 2))) { showError('contato', 'DDD inválido.'); return false; }
    clearError('contato');
    return true;
}

// ── Preenchimento e limpeza de formulário ───────────────────────────────────

function preencherCampos(p) {
    if (document.getElementById('nome').value.trim() || document.getElementById('cpf').value.trim()) {
        if (!confirm('Existem dados no formulário. Deseja substituí-los?')) return;
    }

    document.getElementById('nome').value = p.nome || '';
    document.getElementById('cpf').value = p.cpf || '';
    document.getElementById('data_nasc').value = p.dataNasc || '';
    document.getElementById('sexo').value = p.sexo || '';
    document.getElementById('endereco').value = p.endereco || '';
    document.getElementById('contato').value = p.contato || '';
    document.getElementById('observacoes').value = p.observacoes || '';
    document.getElementById('examesNaoListados').value = p.examesNaoListados || '';

    ['data_nasc', 'cpf', 'contato'].forEach(clearError);
    if (p.dataNasc) validateAge();

    document.querySelectorAll('#exames input[type="checkbox"]').forEach(cb => cb.checked = false);
    (p.examesSelecionados || p.exames || []).forEach(marcarExame);
    atualizarExamesSelecionadosDisplay();

    alert(`Dados de ${p.nome} carregados!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limparCampos(showAlert = true) {
    ['nome','cpf','data_nasc','idade','sexo','endereco','contato','observacoes','examesNaoListados']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    document.querySelectorAll('.exame').forEach(cb => cb.checked = false);
    const ignoreCpf = document.getElementById('ignoreCpfCheckbox');
    if (ignoreCpf) ignoreCpf.checked = false;
    ['data_nasc', 'cpf', 'contato'].forEach(clearError);

    document.getElementById('pesquisaExame').value = '';
    const sugestoes = document.getElementById('sugestoes');
    sugestoes.innerHTML = '';
    sugestoes.style.display = 'none';

    atualizarExamesSelecionadosDisplay();
    if (showAlert) alert('Campos limpos!');
}

// ── Paciente aleatório ──────────────────────────────────────────────────────

async function gerarPacienteAleatorio() {
    try {
        const resp = await fetch('pacientes_aleatorios.json');
        if (!resp.ok) throw new Error(resp.statusText);
        const lista = await resp.json();
        preencherCampos(lista[Math.floor(Math.random() * lista.length)]);
    } catch (e) {
        alert('Erro ao carregar paciente aleatório: ' + e.message);
    }
}

// ── Salvamento do protocolo e geração de PDF ────────────────────────────────

function coletarDados() {
    const ageOk = validateAge();
    const cpf = document.getElementById('cpf').value.replace(/\D/g, '');
    const ignorarCpf = document.getElementById('ignoreCpfCheckbox').checked;
    let cpfOk = true;
    if (!ignorarCpf && cpf && !validarCPF(cpf)) { showError('cpf', 'CPF inválido.'); cpfOk = false; }
    const contatoOk = validateContact();

    if (!ageOk || !cpfOk || !contatoOk) throw new Error('Corrija os campos destacados.');

    const nome = document.getElementById('nome').value.trim();
    const sexo = document.getElementById('sexo').value;
    const exames = [...document.querySelectorAll('#exames .exame:checked')].map(e => e.value);
    const examesNaoListados = document.getElementById('examesNaoListados').value.trim();

    if (!nome) throw new Error('Preencha o Nome.');
    if (!sexo) throw new Error('Selecione o Sexo.');
    if (!exames.length && !examesNaoListados) throw new Error('Selecione pelo menos um exame.');

    return {
        nome,
        cpf,
        dataNasc: document.getElementById('data_nasc').value,
        idade: document.getElementById('idade').value,
        sexo,
        endereco: document.getElementById('endereco').value.trim(),
        contato: document.getElementById('contato').value.trim(),
        observacoes: document.getElementById('observacoes').value.trim(),
        exames,
        examesNaoListados
    };
}

async function salvarProtocoloAtendimento() {
    let dados;
    try { dados = coletarDados(); } catch (e) { alert(e.message); return; }

    const pad2 = n => n.toString().padStart(2, '0');
    const now = new Date();
    const num = getNextProtocolNumber().toString().padStart(4, '0');
    // Formato: NNNN-HHMMDDmm — o sufixo de hora+data garante unicidade entre dispositivos
    dados.protocolo = `${num}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getDate())}${pad2(now.getMonth() + 1)}`;
    dados.timestamp = Date.now();
    addProtocolo(dados);

    // jsPDF é obtido aqui (dentro da função) para não crashar o módulo se o CDN estiver offline
    if (!window.jspdf) {
        alert(`Protocolo ${dados.protocolo} salvo!\n\n(PDF não gerado: jsPDF não disponível. Verifique conexão ou adicione jspdf.umd.min.js localmente.)`);
        limparCampos(false);
        mostrarHistorico();
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const [ano, mes, dia] = dados.dataNasc.split('-');
    const dataNascFmt = dados.dataNasc ? `${dia}/${mes}/${ano}` : 'N/D';
    const lh = 7;
    let y = 15;

    try { doc.addImage('https://hyskal.github.io/connect/logo.png', 'PNG', 20, 10, 20, 20); } catch (_) {}

    doc.setFontSize(18);
    doc.text('Laboratório de Análises Clínicas CETEP/LNAB', 105, y, null, null, 'center'); y += 10;
    doc.setFontSize(10);
    doc.text(`Data: ${now.toLocaleDateString()} - Hora: ${now.toLocaleTimeString()}`, 105, y, null, null, 'center'); y += 5;
    doc.setFontSize(8);
    doc.text('R. Mario Laérte, 163 - Centro, Alagoinhas - BA, 48005-098', 105, y, null, null, 'center'); y += 4;
    doc.text('https://www.ceteplnab.com.br/', 105, y, null, null, 'center'); y += 6;
    doc.setLineWidth(0.5); doc.line(20, y, 190, y); y += 10;

    doc.setFontSize(14);
    doc.text(`PROTOCOLO DE ATENDIMENTO Nº: ${dados.protocolo}`, 20, y); y += 8;
    doc.setFontSize(10); doc.setLineWidth(0.2); doc.line(20, y, 190, y); y += 10;

    doc.setFontSize(12); doc.text('DADOS DO PACIENTE:', 20, y); y += 8;
    doc.setFontSize(11);
    doc.text(`Nome: ${dados.nome}`, 25, y); doc.text(`CPF: ${dados.cpf || 'N/D'}`, 110, y); y += lh;
    doc.text(`Data de Nasc.: ${dataNascFmt}`, 25, y); doc.text(`Idade: ${dados.idade || 'N/D'}`, 110, y); y += lh;
    doc.text(`Sexo: ${dados.sexo}`, 25, y); doc.text(`Contato: ${dados.contato || 'N/D'}`, 110, y); y += lh;
    if (dados.endereco) { doc.text(`Endereço: ${dados.endereco}`, 25, y); y += lh; }
    doc.setLineWidth(0.2); doc.line(20, y, 190, y); y += 10;

    doc.setFontSize(12); doc.text('EXAMES:', 20, y); y += 8;
    doc.setFontSize(11);
    if (dados.exames.length) {
        doc.text('Exames Selecionados:', 25, y); y += lh;
        dados.exames.forEach(e => { doc.text(`- ${e}`, 30, y); y += lh; });
    }
    if (dados.examesNaoListados) {
        doc.text('Exames Adicionais:', 25, y); y += lh;
        const t = doc.splitTextToSize(dados.examesNaoListados, 150);
        doc.text(t, 30, y); y += t.length * lh;
    }
    doc.setLineWidth(0.2); doc.line(20, y, 190, y); y += 10;

    if (dados.observacoes) {
        doc.setFontSize(12); doc.text('OBSERVAÇÕES:', 20, y); y += 8;
        doc.setFontSize(11);
        const t = doc.splitTextToSize(dados.observacoes, 170);
        doc.text(t, 25, y); y += t.length * lh;
        doc.setLineWidth(0.2); doc.line(20, y, 190, y);
    }

    doc.setFontSize(9);
    doc.text('Documento gerado automaticamente pelo SISLAB.', 105, 280, null, null, 'center');
    doc.output('dataurlnewwindow', { filename: `Protocolo_${dados.nome.replace(/\s+/g, '_')}.pdf` });

    alert(`Protocolo ${dados.protocolo} salvo e gerado!`);
    limparCampos(false);
    mostrarHistorico();
}

// ── Histórico ───────────────────────────────────────────────────────────────

async function mostrarHistorico() {
    const div = document.getElementById('historico');
    if (window.getComputedStyle(div).display === 'none') {
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
        return;
    }

    const ul = div.querySelector('ul');
    const cadastros = getHistorico();
    if (!cadastros.length) { ul.innerHTML = '<p>Nenhum cadastro encontrado.</p>'; return; }

    ul.innerHTML = cadastros.map(c => {
        const prot = c.protocolo ? `Protocolo: ${c.protocolo}` : `ID: ${c.id}`;
        let extra = '';
        if (c.examesNaoListados) extra += `<br>Adicionais: ${c.examesNaoListados.substring(0, 50)}${c.examesNaoListados.length > 50 ? '...' : ''}`;
        if (c.observacoes) extra += `<br>Obs.: ${c.observacoes.substring(0, 100)}${c.observacoes.length > 100 ? '...' : ''}`;
        return `<li data-doc-id="${c.id}">
            <input type="checkbox" class="history-checkbox" value="${c.id}">
            <span class="protocol-info" onclick="carregarCadastroLocal('${c.id}')">
                <b>${prot}</b> — ${c.nome} — CPF: ${c.cpf || 'N/D'} — Idade: ${c.idade || 'N/D'} — Exames: ${(c.exames || []).join(', ')}${extra}
            </span></li>`;
    }).join('');

    updateSelectAllMasterCheckbox();
}

function carregarCadastroLocal(id) {
    const c = getProtocoloById(id);
    if (!c) { alert('Cadastro não encontrado.'); return; }
    preencherCampos(c);
}

function toggleAllHistoryCheckboxes() {
    const master = document.getElementById('selectAllHistoryCheckbox');
    document.querySelectorAll('.history-checkbox').forEach(cb => cb.checked = master.checked);
}

function updateSelectAllMasterCheckbox() {
    const master = document.getElementById('selectAllHistoryCheckbox');
    const all = [...document.querySelectorAll('.history-checkbox')];
    if (!all.length) { master.checked = false; master.indeterminate = false; return; }
    const count = all.filter(cb => cb.checked).length;
    master.indeterminate = count > 0 && count < all.length;
    master.checked = count === all.length;
}

// ── Senha dinâmica ──────────────────────────────────────────────────────────

function senhaAtual() {
    const now = new Date();
    return SENHA_BASE + now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
}

// ── Exclusão e impressão de histórico ──────────────────────────────────────

async function deleteSelectedHistory() {
    const esperada = senhaAtual(); // Captura antes do prompt para não mudar se o minuto virar
    const digitada = prompt('Para excluir, digite a senha:');
    if (digitada === null) return;
    if (digitada !== esperada) { alert('Senha incorreta.'); return; }

    const selecionados = [...document.querySelectorAll('.history-checkbox:checked')];
    if (!selecionados.length) { alert('Nenhum protocolo selecionado.'); return; }
    if (!confirm(`Excluir ${selecionados.length} protocolo(s)? Esta ação é irreversível.`)) return;

    deleteProtocolos(selecionados.map(cb => cb.value));
    alert(`${selecionados.length} protocolo(s) excluído(s).`);
    mostrarHistorico();
}

function printSelectedHistory() {
    const ids = [...document.querySelectorAll('.history-checkbox:checked')].map(cb => cb.value);
    if (!ids.length) { alert('Nenhum protocolo selecionado.'); return; }

    const cadastros = ids.map(id => getProtocoloById(id)).filter(Boolean)
        .sort((a, b) => (+((a.protocolo || '').split('-')[0]) || 0) - (+((b.protocolo || '').split('-')[0]) || 0));

    if (!cadastros.length) { alert('Não foi possível carregar os protocolos.'); return; }

    const corpo = cadastros.map(c => `
        <li>
            <b>${c.protocolo ? `Protocolo: ${c.protocolo}` : `ID: ${c.id}`}</b><br>
            <p><strong>Nome:</strong> ${c.nome || 'N/D'}</p>
            <p><strong>CPF:</strong> ${c.cpf || 'N/D'}</p>
            <p><strong>Data Nasc.:</strong> ${c.dataNasc || 'N/D'}</p>
            <p><strong>Idade:</strong> ${c.idade || 'N/D'}</p>
            <p><strong>Sexo:</strong> ${c.sexo || 'N/D'}</p>
            <p><strong>Endereço:</strong> ${c.endereco || 'N/D'}</p>
            <p><strong>Contato:</strong> ${c.contato || 'N/D'}</p>
            <p><strong>Exames:</strong> ${(c.exames || []).join(', ') || 'N/D'}</p>
            ${c.examesNaoListados ? `<p><strong>Adicionais:</strong> ${c.examesNaoListados}</p>` : ''}
            ${c.observacoes ? `<p><strong>Observações:</strong> ${c.observacoes}</p>` : ''}
        </li>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Histórico</title>
        <style>body{font-family:Arial,sans-serif;margin:20px}h1{text-align:center;color:#1A2B4C}
        ul{list-style:none;padding:0}li{border:1px solid #ddd;padding:10px;margin-bottom:10px;border-radius:5px}
        p{margin:3px 0}</style></head><body>
        <h1>Histórico de Cadastros — Laboratório CETEP/LNAB</h1><ul>${corpo}</ul></body></html>`);
    win.document.close();
    win.onload = () => win.print();
}

// ── Expõe funções para handlers inline do HTML ──────────────────────────────
window.validateAge = validateAge;
window.validateCpfAndCheckHistory = validateCpfAndCheckHistory;
window.validateContact = validateContact;
window.salvarProtocoloAtendimento = salvarProtocoloAtendimento;
window.limparCampos = limparCampos;
window.mostrarHistorico = mostrarHistorico;
window.carregarCadastroLocal = carregarCadastroLocal;
window.deleteSelectedHistory = deleteSelectedHistory;
window.printSelectedHistory = printSelectedHistory;
window.toggleAllHistoryCheckboxes = toggleAllHistoryCheckboxes;
window.updateSelectAllMasterCheckbox = updateSelectAllMasterCheckbox;
