// VERSÃO: 2.1.0 (script.js)
// CHANGELOG:
// - REFATORAÇÃO: Convertido para ES module com imports de data_storage.js.
// - REMOVIDO: Toda integração com Firebase Firestore.
// - REMOVIDO: Configurações de Gist do GitHub (GITHUB_USERNAME, GIST_ID, etc.).
// - REMOVIDO: Constantes GOOGLE_FORM_URL e GOOGLE_FORM_ENTRIES.
// - REMOVIDO: Função salvarListaExamesNoGitHub (não necessária no modo offline).
// - MODIFICADO: carregarExames() agora usa getListaExamesCache() e, se ausente, carrega lista-de-exames.txt local.
// - MODIFICADO: checkCpfInHistory() usa findByCpf() do data_storage.js.
// - MODIFICADO: salvarProtocoloAtendimento() usa getNextProtocolNumber() e addProtocolo().
// - MODIFICADO: mostrarHistorico() usa getHistorico() e chama carregarCadastroLocal().
// - RENOMEADO: carregarCadastroFirebase() → carregarCadastroLocal() usando getProtocoloById().
// - MODIFICADO: deleteSelectedHistory() usa deleteProtocolos().
// - MODIFICADO: printSelectedHistory() usa getProtocoloById() localmente (síncrono).
// - MODIFICADO: limparHistorico() usa clearHistorico().

import {
    getHistorico,
    getNextProtocolNumber,
    addProtocolo,
    deleteProtocolos,
    clearHistorico,
    getProtocoloById,
    findByCpf,
    getListaExamesCache,
    setListaExamesCache
} from './data_storage.js';

// Define a versão do script para acesso global
window.SISLAB_VERSION = "2.1.0";

const { jsPDF } = window.jspdf;
let listaExames = [];

// Definir a senha base para todas as operações sensíveis
const SENHA_BASE_SISLAB = "sislab";

// Lista de DDDs brasileiros válidos
const dddsValidos = [
    11, 12, 13, 14, 15, 16, 17, 18, 19,
    21, 22, 24,
    27, 28,
    31, 32, 33, 34, 35, 37, 38,
    41, 42, 43, 44, 45, 46,
    47, 48, 49,
    51, 53, 54, 55,
    61,
    62, 64,
    63,
    65, 66,
    67,
    68,
    69,
    71, 73, 74, 75, 77,
    79,
    81, 87,
    82,
    83,
    84, 85, 88, 89,
    91, 93, 94,
    92, 97,
    95,
    96,
    98, 99
];

window.onload = async () => {
    try {
        console.log("window.onload: Iniciando carregamento da página.");
        await carregarExames();
        console.log("window.onload: carregarExames() concluído.");

        document.getElementById('data_nasc').addEventListener('change', atualizarIdade);
        document.getElementById('cpf').addEventListener('input', formatarCPF);
        document.getElementById('contato').addEventListener('input', formatarContato);

        document.getElementById('data_nasc').addEventListener('blur', validateAge);
        document.getElementById('cpf').addEventListener('blur', validateCpfAndCheckHistory);
        document.getElementById('contato').addEventListener('blur', validateContact);

        document.getElementById('exames').addEventListener('change', (event) => {
            if (event.target.classList.contains('exame')) {
                atualizarExamesSelecionadosDisplay();
            }
        });

        // Lógica para gerar e carregar paciente aleatório se o parâmetro estiver na URL
        const urlParams = new URLSearchParams(window.location.search);
        console.log("window.onload: Parâmetros da URL:", urlParams.toString());
        if (urlParams.get('gerar') === 'ficticio') {
            console.log("window.onload: Parâmetro 'gerar=ficticio' detectado. Chamando gerarECarregarPacienteAleatorio().");
            await gerarECarregarPacienteAleatorio();
        } else {
            console.log("window.onload: Parâmetro 'gerar=ficticio' NÃO detectado. Não gerando paciente aleatório.");
        }

        // Event listener para o botão de exclusão selecionada
        const deleteSelectedHistoryBtn = document.getElementById('deleteSelectedHistoryBtn');
        if (deleteSelectedHistoryBtn) {
            deleteSelectedHistoryBtn.addEventListener('click', deleteSelectedHistory);
            console.log("Event listener para 'deleteSelectedHistoryBtn' adicionado.");
        } else {
            console.warn("Elemento 'deleteSelectedHistoryBtn' não encontrado.");
        }

        // Event listener para o botão de impressão selecionada
        const printSelectedHistoryBtn = document.getElementById('printSelectedHistoryBtn');
        if (printSelectedHistoryBtn) {
            printSelectedHistoryBtn.addEventListener('click', printSelectedHistory);
            console.log("Event listener para 'printSelectedHistoryBtn' adicionado.");
        } else {
            console.warn("Elemento 'printSelectedHistoryBtn' não encontrado.");
        }

        // Event listener para a checkbox mestre "Selecionar Todos"
        const selectAllHistoryCheckbox = document.getElementById('selectAllHistoryCheckbox');
        if (selectAllHistoryCheckbox) {
            selectAllHistoryCheckbox.addEventListener('change', toggleAllHistoryCheckboxes);
            console.log("Event listener para 'selectAllHistoryCheckbox' adicionado.");
        } else {
            console.warn("Elemento 'selectAllHistoryCheckbox' não encontrado.");
        }

        // Event listener delegado para as checkboxes individuais do histórico
        const historicoList = document.querySelector('#historico ul');
        if (historicoList) {
            historicoList.addEventListener('change', (event) => {
                if (event.target.classList.contains('history-checkbox')) {
                    updateSelectAllMasterCheckbox();
                }
            });
            console.log("Event listener para individual history checkboxes (delegado) adicionado.");
        }

    } catch (error) {
        console.error("Erro crítico na inicialização da página:", error);
        alert("Ocorreu um erro crítico ao carregar a página. Por favor, verifique o console para mais detalhes.");
    }
};

// Função para gerar e carregar paciente aleatório
async function gerarECarregarPacienteAleatorio() {
    console.log("gerarECarregarPacienteAleatorio: Iniciando geração de paciente.");
    try {
        const response = await fetch('pacientes_aleatorios.json');
        if (!response.ok) {
            throw new Error(`Erro ao carregar pacientes_aleatorios.json: ${response.statusText}`);
        }
        const pacientes = await response.json();
        const paciente = pacientes[Math.floor(Math.random() * pacientes.length)];

        console.log("gerarECarregarPacienteAleatorio: Paciente sorteado:", paciente);
        preencherCamposComCadastro(paciente);
        alert("Paciente aleatório gerado e carregado no formulário!");
    } catch (err) {
        console.error("gerarECarregarPacienteAleatorio: Erro ao gerar/carregar paciente aleatório:", err);
        alert("Erro ao gerar/carregar paciente aleatório. Verifique se o arquivo JSON está acessível e formatado corretamente.");
    }
}

async function carregarExames() {
    let loadedText = '';

    try {
        // Tenta carregar do cache localStorage primeiro
        const cached = getListaExamesCache();
        if (cached) {
            loadedText = cached;
            console.log("carregarExames: Conteúdo carregado do cache localStorage.");
        } else {
            // Se não há cache, carrega do arquivo local
            console.log("carregarExames: Cache não encontrado. Carregando lista-de-exames.txt local.");
            const timestamp = new Date().getTime();
            const localResponse = await fetch(`lista-de-exames.txt?t=${timestamp}`);
            if (localResponse.ok) {
                loadedText = await localResponse.text();
                console.log("carregarExames: Conteúdo carregado do arquivo local com sucesso.");
                setListaExamesCache(loadedText);
                console.log("carregarExames: Conteúdo salvo no cache localStorage.");
            } else {
                console.error(`carregarExames: Erro ao carregar do arquivo local (${localResponse.status}).`);
                throw new Error("Falha ao carregar a lista de exames do arquivo local.");
            }
        }

        if (typeof loadedText === 'string' && loadedText.length > 0) {
            console.log("carregarExames: Conteúdo bruto listaExames recebido (primeiros 100 chars):", loadedText.substring(0, Math.min(loadedText.length, 100)) + "...");
            listaExames = loadedText.trim().split('\n').map(e => e.trim()).filter(e => e !== '');
            console.log("carregarExames: listaExames após processamento:", listaExames);

            if (listaExames.length === 0) {
                console.warn("carregarExames: A lista de exames está vazia após o processamento.");
            }
        } else {
            console.warn("carregarExames: O conteúdo carregado está vazio ou não é uma string.");
            listaExames = [];
        }

        atualizarListaExamesCompleta();
        configurarPesquisa();

    } catch (error) {
        console.error("carregarExames: Erro FATAL ao carregar lista de exames:", error);
        alert("Não foi possível carregar a lista de exames. Verifique se o arquivo lista-de-exames.txt está presente.");
        listaExames = [];
        throw error;
    }
}

function atualizarListaExamesCompleta() {
    console.log("atualizarListaExamesCompleta: Reconstruindo lista de checkboxes de exames.");
    const container = document.getElementById('exames');
    container.innerHTML = "";

    listaExames.forEach(exame => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="exame" value="${exame}"> ${exame}`;
        container.appendChild(label);
        container.appendChild(document.createElement('br'));
    });
}

function configurarPesquisa() {
    console.log("configurarPesquisa: Configurando eventos de pesquisa.");
    const inputPesquisa = document.getElementById('pesquisaExame');
    const sugestoesBox = document.getElementById('sugestoes');

    inputPesquisa.addEventListener('input', () => {
        const termo = inputPesquisa.value.trim().toLowerCase();
        sugestoesBox.innerHTML = "";

        if (termo.length === 0) {
            sugestoesBox.style.display = 'none';
            return;
        }

        const filtrados = listaExames.filter(exame =>
            exame.toLowerCase().includes(termo)
        );

        if (filtrados.length === 0) {
            sugestoesBox.style.display = 'none';
            return;
        }

        filtrados.forEach(exame => {
            const div = document.createElement('div');
            div.textContent = exame;
            div.addEventListener('click', () => {
                marcarExame(exame);
                inputPesquisa.value = '';
                sugestoesBox.style.display = 'none';
            });
            sugestoesBox.appendChild(div);
        });

        sugestoesBox.style.display = 'block';
    });

    document.addEventListener('click', function(event) {
        if (!event.target.closest('#pesquisaExame') && !event.target.closest('#sugestoes')) {
            sugestoesBox.style.display = 'none';
        }
    });
}

function marcarExame(exameNome) {
    console.log("marcarExame: Tentando marcar o exame:", exameNome);
    const examesContainer = document.getElementById('exames');
    const checkboxExistente = examesContainer.querySelector(`input[type="checkbox"][value="${exameNome}"]`);

    if (checkboxExistente) {
        checkboxExistente.checked = true;
        console.log("marcarExame: Checkbox existente encontrado e marcado:", exameNome);
        checkboxExistente.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        console.log("marcarExame: Checkbox não existente para", exameNome, ". Adicionando dinamicamente e marcando.");
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="exame" value="${exameNome}" checked> ${exameNome}`;
        examesContainer.appendChild(label);
        examesContainer.appendChild(document.createElement('br'));
        label.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (!listaExames.includes(exameNome)) {
            listaExames.push(exameNome);
            listaExames.sort();
            console.log("marcarExame: Exame adicionado à listaExames para futuras pesquisas:", exameNome);
        }
    }
    atualizarExamesSelecionadosDisplay();
}

function atualizarExamesSelecionadosDisplay() {
    console.log("atualizarExamesSelecionadosDisplay: Atualizando exibição de exames selecionados.");
    const displayContainer = document.getElementById('examesSelecionadosDisplay');
    const selectedExams = Array.from(document.querySelectorAll('#exames .exame:checked'));

    displayContainer.innerHTML = "";

    if (selectedExams.length === 0) {
        displayContainer.innerHTML = "<p>Nenhum exame selecionado.</p>";
        console.log("atualizarExamesSelecionadosDisplay: Nenhum exame selecionado para exibição.");
        return;
    }

    selectedExams.forEach(checkbox => {
        const exameNome = checkbox.value;
        const displayItem = document.createElement('div');
        displayItem.classList.add('display-item');
        displayItem.innerHTML = `
            <span>${exameNome}</span>
            <button class="remove-item-btn" data-exame="${exameNome}">-</button>
        `;
        displayContainer.appendChild(displayItem);
    });

    displayContainer.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const exameParaRemover = event.target.dataset.exame;
            removerExameDisplay(exameParaRemover);
        });
    });
    console.log("atualizarExamesSelecionadosDisplay: Exames exibidos:", selectedExams.map(cb => cb.value));
}

function removerExameDisplay(exameNome) {
    console.log("removerExameDisplay: Removendo exame:", exameNome);
    const checkbox = document.querySelector(`#exames .exame[value="${exameNome}"]`);
    if (checkbox) {
        checkbox.checked = false;
        console.log("removerExameDisplay: Checkbox desmarcado para:", exameNome);
    }
    atualizarExamesSelecionadosDisplay();
}

function showError(elementId, message) {
    console.log(`showError: Erro para ${elementId}: ${message}`);
    const inputElement = document.getElementById(elementId);
    const errorDiv = document.getElementById(`${elementId}-error`);
    if (inputElement && errorDiv) {
        inputElement.classList.add('error');
        errorDiv.textContent = message;
    }
}

function clearError(elementId) {
    console.log(`clearError: Limpando erro para ${elementId}.`);
    const inputElement = document.getElementById(elementId);
    const errorDiv = document.getElementById(`${elementId}-error`);
    if (inputElement && errorDiv) {
        inputElement.classList.remove('error');
        errorDiv.textContent = '';
    }
}

function calcularIdade(dataString) {
    const hoje = new Date();
    const nascimento = new Date(dataString + 'T00:00:00');
    if (isNaN(nascimento.getTime()) || nascimento > hoje) {
        return null;
    }

    let anos = hoje.getFullYear() - nascimento.getFullYear();
    const mesAtual = hoje.getMonth();
    const mesNascimento = nascimento.getMonth();

    if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
        anos--;
    }

    let meses = hoje.getMonth() - nascimento.getMonth();
    if (hoje.getDate() < nascimento.getDate()) {
        meses--;
    }
    if (meses < 0) {
        meses += 12;
    }

    return { anos: anos, meses: meses };
}

function validarDataNascimento(dataString) {
    const nascimento = new Date(dataString + 'T00:00:00');
    const hoje = new Date();
    return !isNaN(nascimento.getTime()) && nascimento <= hoje;
}

function atualizarIdade() {
    console.log("atualizarIdade: Validando idade.");
    validateAge();
}

function validateAge() {
    const dataNascInput = document.getElementById('data_nasc');
    const dataNasc = dataNascInput.value;
    const idadeInput = document.getElementById('idade');

    if (!dataNasc) {
        clearError('data_nasc');
        idadeInput.value = "";
        return true;
    }

    if (!validarDataNascimento(dataNasc)) {
        showError('data_nasc', "Data de nascimento inválida ou no futuro.");
        idadeInput.value = "";
        return false;
    }

    const idadeObj = calcularIdade(dataNasc);
    if (idadeObj === null) {
        showError('data_nasc', "Data de nascimento no futuro.");
        idadeInput.value = "";
        return false;
    }

    let idadeTexto = `${idadeObj.anos} anos`;
    if (idadeObj.meses > 0) {
        idadeTexto += ` e ${idadeObj.meses} meses`;
    }
    idadeInput.value = idadeTexto;
    clearError('data_nasc');
    return true;
}

function formatarCPF() {
    const inputCPF = document.getElementById('cpf');
    let cpf = inputCPF.value.replace(/\D/g, '');
    if (cpf.length > 11) cpf = cpf.substring(0, 11);

    if (cpf.length > 9) {
        cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cpf.length > 6) {
        cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
    } else if (cpf.length > 3) {
        cpf = cpf.replace(/(\d{3})(\d{3})/, '$1.$2');
    }
    inputCPF.value = cpf;
}

function validateCpfAndCheckHistory() {
    console.log("validateCpfAndCheckHistory: Validando CPF e checando histórico.");
    const inputCPF = document.getElementById('cpf');
    const cpf = inputCPF.value.replace(/\D/g, '');
    const ignoreCpfChecked = document.getElementById('ignoreCpfCheckbox').checked;

    if (ignoreCpfChecked) {
        clearError('cpf');
        console.log("validateCpfAndCheckHistory: Ignorando validação e histórico de CPF devido à checkbox.");
        return true;
    }

    if (cpf.length === 0) {
        clearError('cpf');
        return true;
    }

    if (!validarCPF(cpf)) {
        showError('cpf', "CPF inválido.");
        return false;
    }

    clearError('cpf');
    checkCpfInHistory(cpf);
    return true;
}

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    return resto === parseInt(cpf.substring(10, 11));
}

// checkCpfInHistory agora busca no localStorage via data_storage.js
function checkCpfInHistory(cpf) {
    console.log("checkCpfInHistory: Iniciando verificação de CPF no histórico para:", cpf);

    try {
        const resultados = findByCpf(cpf);
        console.log("checkCpfInHistory: Resultados encontrados:", resultados.length);

        if (resultados.length === 0) {
            console.log("checkCpfInHistory: CPF não encontrado no histórico local.");
            return;
        }

        // Ordena por timestamp decrescente para obter o mais recente
        resultados.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const ultimoCadastro = resultados[0];
        console.log("checkCpfInHistory: CPF encontrado! Último cadastro:", ultimoCadastro);

        const confirmLoad = confirm(
            `CPF (${ultimoCadastro.cpf}) encontrado no histórico para:\n\n` +
            `Nome: ${ultimoCadastro.nome}\n` +
            `Data de Nascimento: ${ultimoCadastro.dataNasc}\n` +
            `Sexo: ${ultimoCadastro.sexo}\n` +
            `Endereço: ${ultimoCadastro.endereco}\n` +
            `Contato: ${ultimoCadastro.contato}\n\n` +
            `Deseja carregar esses dados básicos no formulário?`
        );

        if (confirmLoad) {
            console.log("checkCpfInHistory: Confirmação para carregar dados do histórico recebida. Chamando preencherCamposComCadastro.");
            preencherCamposComCadastro(ultimoCadastro);
        } else {
            console.log("checkCpfInHistory: Confirmação para carregar dados do histórico NEGADA.");
        }
    } catch (error) {
        console.error("checkCpfInHistory: Erro ao verificar CPF no histórico:", error);
        alert("Erro ao buscar histórico de CPF.");
    }
}

// Função auxiliar para padronizar CPF para busca (sem máscara)
function formatarCPFParaBusca(cpfComMascara) {
    return cpfComMascara.replace(/\D/g, '');
}

// preencherCamposComCadastro carrega dados do histórico ou paciente fictício
function preencherCamposComCadastro(p) {
    console.log("preencherCamposComCadastro: Iniciando preenchimento com dados:", p);
    console.log("preencherCamposComCadastro: Dados brutos do paciente para preenchimento:", JSON.stringify(p, null, 2));

    const nomeAtual = document.getElementById('nome').value.trim();
    const cpfAtual = document.getElementById('cpf').value.trim();

    if (nomeAtual || cpfAtual) {
        console.log("preencherCamposComCadastro: Formulário não está vazio. Solicitando confirmação.");
        const confirmarSubstituicao = confirm("Existem dados no formulário que serão substituídos. Deseja continuar?");
        if (!confirmarSubstituicao) {
            console.log("preencherCamposComCadastro: Substituição negada pelo usuário. Retornando.");
            return;
        }
    }

    console.log("preencherCamposComCadastro: Limpando campos do formulário.");
    document.getElementById('nome').value = '';
    document.getElementById('cpf').value = '';
    document.getElementById('data_nasc').value = '';
    document.getElementById('idade').value = '';
    document.getElementById('sexo').value = '';
    document.getElementById('endereco').value = '';
    document.getElementById('contato').value = '';
    document.getElementById('observacoes').value = '';
    document.getElementById('examesNaoListados').value = '';

    console.log("preencherCamposComCadastro: Desmarcando todos os exames existentes.");
    document.querySelectorAll('#exames input[type="checkbox"]').forEach(cb => cb.checked = false);

    clearError('data_nasc');
    clearError('cpf');
    clearError('contato');

    console.log("preencherCamposComCadastro: Preenchendo campos com novos dados.");
    document.getElementById('nome').value = p.nome || '';
    document.getElementById('cpf').value = p.cpf || '';
    document.getElementById('data_nasc').value = p.dataNasc || '';
    document.getElementById('sexo').value = p.sexo || '';
    document.getElementById('endereco').value = p.endereco || '';
    document.getElementById('contato').value = p.contato || '';
    document.getElementById('observacoes').value = p.observacoes || '';
    document.getElementById('examesNaoListados').value = p.examesNaoListados || '';

    if (p.dataNasc) {
        console.log("preencherCamposComCadastro: Disparando evento 'change' na data de nascimento.");
        document.getElementById('data_nasc').dispatchEvent(new Event('change'));
    }

    // Usa p.examesSelecionados (pacientes_aleatorios.json) ou p.exames (histórico localStorage)
    const examesDoPaciente = Array.isArray(p.examesSelecionados)
        ? p.examesSelecionados
        : (Array.isArray(p.exames) ? p.exames : []);
    console.log("preencherCamposComCadastro: examesDoPaciente:", examesDoPaciente);

    if (examesDoPaciente.length > 0) {
        console.log("preencherCamposComCadastro: Marcando exames selecionados. Total a marcar:", examesDoPaciente.length);
        examesDoPaciente.forEach((exameNome, index) => {
            console.log(`preencherCamposComCadastro: Tentando marcar exame ${index + 1}/${examesDoPaciente.length}: "${exameNome}"`);
            const checkbox = document.querySelector(`input[type="checkbox"][value="${exameNome}"]`);
            if (checkbox) {
                checkbox.checked = true;
                console.log(`preencherCamposComCadastro: Checkbox para "${exameNome}" encontrado e marcado.`);
            } else {
                console.warn(`preencherCamposComCadastro: Checkbox para "${exameNome}" NÃO encontrado. Adicionando dinamicamente.`);
                marcarExame(exameNome);
            }
        });
    } else {
        console.log("preencherCamposComCadastro: Nenhum exame selecionado para marcar.");
    }
    atualizarExamesSelecionadosDisplay();

    alert(`Dados de ${p.nome} carregados com sucesso!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log("preencherCamposComCadastro: Preenchimento concluído.");
}

function formatarContato() {
    const inputContato = document.getElementById('contato');
    let contato = inputContato.value.replace(/\D/g, '');

    if (contato.length > 11) contato = contato.substring(0, 11);

    if (contato.length > 2) {
        if (contato.length <= 6) {
            contato = `(${contato.substring(0, 2)}) ${contato.substring(2)}`;
        } else if (contato.length <= 10) {
            contato = `(${contato.substring(0, 2)}) ${contato.substring(2, 6)}-${contato.substring(6)}`;
        } else {
            contato = `(${contato.substring(0, 2)}) ${contato.substring(2, 7)}-${contato.substring(7)}`;
        }
    }
    inputContato.value = contato;
}

function validateContact() {
    const inputContato = document.getElementById('contato');
    const contato = inputContato.value.replace(/\D/g, '');

    if (contato.length === 0) {
        clearError('contato');
        return true;
    }

    if (contato.length < 2) {
        showError('contato', "Número de contato incompleto.");
        return false;
    }

    const ddd = parseInt(contato.substring(0, 2));

    if (!dddsValidos.includes(ddd)) {
        showError('contato', "DDD inválido. Insira um DDD brasileiro válido.");
        return false;
    }

    clearError('contato');
    return true;
}

function coletarDados() {
    console.log("coletarDados: Coletando e validando dados do formulário.");
    const isAgeValid = validateAge();
    const cpfLimpo = document.getElementById('cpf').value.replace(/\D/g, '');
    const ignoreCpfChecked = document.getElementById('ignoreCpfCheckbox').checked;
    const isCpfFormatValid = ignoreCpfChecked || validarCPF(cpfLimpo);
    const isContactValid = validateContact();

    if (!isCpfFormatValid) {
        showError('cpf', "CPF inválido.");
    }

    if (!isAgeValid || !isCpfFormatValid || !isContactValid) {
        console.error("coletarDados: Erros de validação encontrados.");
        throw new Error("Por favor, corrija os erros nos campos antes de prosseguir.");
    }

    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value.replace(/\D/g, '');
    const dataNasc = document.getElementById('data_nasc').value;
    const sexo = document.getElementById('sexo').value;
    const endereco = document.getElementById('endereco').value.trim();
    const contato = document.getElementById('contato').value.trim();
    const observacoes = document.getElementById('observacoes').value.trim();
    const exames = Array.from(document.querySelectorAll('#exames .exame:checked')).map(e => e.value);
    const examesNaoListados = document.getElementById('examesNaoListados').value.trim();

    if (!nome) { console.error("coletarDados: Nome vazio."); throw new Error("Preencha o campo: Nome."); }
    if (!sexo) { console.error("coletarDados: Sexo não selecionado."); throw new Error("Selecione o sexo."); }
    if (exames.length === 0 && !examesNaoListados) { console.error("coletarDados: Nenhum exame selecionado."); throw new Error("Selecione pelo menos um exame ou preencha 'Acrescentar Exames não Listados'."); }

    console.log("coletarDados: Dados coletados com sucesso.");
    return { nome, cpf, dataNasc, idade: document.getElementById('idade').value, sexo, endereco, contato, observacoes, exames, examesNaoListados };
}

// Salvar Protocolo de Atendimento — usa localStorage via data_storage.js
async function salvarProtocoloAtendimento() {
    console.log("salvarProtocoloAtendimento: Iniciando salvamento do protocolo.");

    try {
        const dados = coletarDados();
        console.log("salvarProtocoloAtendimento: Dados coletados para salvamento:", dados);

        // Obtém o próximo número de protocolo sequencial do localStorage
        const nextNum = getNextProtocolNumber();
        const newProtocolNumber = nextNum.toString().padStart(4, '0');
        console.log("salvarProtocoloAtendimento: Próximo número de protocolo:", newProtocolNumber);

        const now = new Date();
        const hour = now.getHours().toString().padStart(2, '0');
        const minute = now.getMinutes().toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');

        // Formato: 0001-HHMMDDMM (Ex: 0001-23143006)
        const protocolo = `${newProtocolNumber}-${hour}${minute}${day}${month}`;
        console.log("salvarProtocoloAtendimento: Novo protocolo gerado:", protocolo);

        dados.protocolo = protocolo;
        dados.timestamp = Date.now();

        // Salva no localStorage
        const savedId = addProtocolo(dados);
        console.log("salvarProtocoloAtendimento: Protocolo salvo no localStorage com id:", savedId);

        // --- Geração do PDF ---
        console.log("salvarProtocoloAtendimento: Gerando PDF.");
        const doc = new jsPDF();
        const [ano, mes, dia] = dados.dataNasc.split('-');
        const dataNascFormatada = `${dia}/${mes}/${ano}`;

        let currentY = 15;
        const marginX = 20;
        const logoUrl = 'https://hyskal.github.io/connect/logo.png';

        // Inserir logo no canto superior esquerdo
        doc.addImage(logoUrl, 'PNG', marginX, 10, 20, 20);

        // --- Seção: Cabeçalho do PDF ---
        doc.setFontSize(18);
        doc.text("Laboratório de Análises Clínicas CETEP/LNAB", 105, currentY, null, null, "center");
        currentY += 10;
        doc.setFontSize(10);
        doc.text(`Data: ${new Date().toLocaleDateString()} - Hora: ${new Date().toLocaleTimeString()}`, 105, currentY, null, null, "center");
        currentY += 5;
        doc.setFontSize(8);
        doc.text("Endereço: 233, R. Mario Laérte, 163 - Centro, Alagoinhas - BA, 48005-098", 105, currentY, null, null, "center");
        currentY += 4;
        doc.text("Site: https://www.ceteplnab.com.br/", 105, currentY, null, null, "center");
        currentY += 6;
        doc.setLineWidth(0.5);
        doc.line(20, currentY, 190, currentY);
        currentY += 10;

        // --- Seção: Identificação do Protocolo no PDF ---
        doc.setFontSize(14);
        doc.text(`PROTOCOLO DE ATENDIMENTO Nº: ${dados.protocolo}`, 20, currentY);
        currentY += 8;
        doc.setFontSize(10);
        doc.setLineWidth(0.2);
        doc.line(20, currentY, 190, currentY);
        currentY += 10;

        // --- Seção: Dados do Paciente no PDF ---
        doc.setFontSize(12);
        doc.text("DADOS DO PACIENTE:", 20, currentY);
        currentY += 8;
        doc.setFontSize(11);

        const col1X = 25;
        const col2X = 110;
        const lineHeight = 7;

        doc.text(`Nome: ${dados.nome}`, col1X, currentY);
        doc.text(`CPF: ${dados.cpf}`, col2X, currentY);
        currentY += lineHeight;
        doc.text(`Data de Nasc.: ${dataNascFormatada}`, col1X, currentY);
        doc.text(`Idade: ${dados.idade}`, col2X, currentY);
        currentY += lineHeight;
        doc.text(`Sexo: ${dados.sexo}`, col1X, currentY);
        doc.text(`Contato: ${dados.contato}`, col2X, currentY);
        currentY += lineHeight;
        doc.text(`Endereço: ${dados.endereco}`, col1X, currentY);
        currentY += lineHeight;

        doc.setLineWidth(0.2);
        doc.line(20, currentY, 190, currentY);
        currentY += 10;

        // --- Seção: Exames no PDF ---
        doc.setFontSize(12);
        doc.text("EXAMES:", 20, currentY);
        currentY += 8;
        doc.setFontSize(11);

        if (dados.exames.length > 0) {
            doc.text("Exames Selecionados:", 25, currentY);
            currentY += lineHeight;
            dados.exames.forEach(exame => {
                doc.text(`- ${exame}`, 30, currentY);
                currentY += lineHeight;
            });
        }

        if (dados.examesNaoListados) {
            if (dados.exames.length > 0) {
                currentY += 5;
            }
            doc.text("Exames Adicionais:", 25, currentY);
            currentY += lineHeight;
            const splitText = doc.splitTextToSize(dados.examesNaoListados, 150);
            doc.text(splitText, 30, currentY);
            currentY += (splitText.length * lineHeight);
        }

        doc.setLineWidth(0.2);
        doc.line(20, currentY, 190, currentY);
        currentY += 10;

        // --- Seção: Observações no PDF ---
        if (dados.observacoes) {
            doc.setFontSize(12);
            doc.text("OBSERVAÇÕES:", 20, currentY);
            currentY += 8;
            doc.setFontSize(11);
            const splitText = doc.splitTextToSize(dados.observacoes, 170);
            doc.text(splitText, 25, currentY);
            currentY += (splitText.length * lineHeight);

            doc.setLineWidth(0.2);
            doc.line(20, currentY, 190, currentY);
            currentY += 10;
        }

        // --- Rodapé do PDF ---
        doc.setFontSize(9);
        doc.text("Documento gerado automaticamente pelo SISLAB.", 105, 280, null, null, "center");

        doc.output('dataurlnewwindow', { filename: `Protocolo_${dados.nome.replace(/\s+/g, "_")}.pdf` });

        alert(`Protocolo ${dados.protocolo} salvo e gerado! Verifique a nova aba para visualizar e imprimir.`);

        limparCampos();
        mostrarHistorico();
    } catch (error) {
        console.error("salvarProtocoloAtendimento: Erro ao salvar protocolo:", error);
        alert(`Erro ao salvar protocolo: ${error.message}`);
    }
}

// mostrarHistorico lê do localStorage via data_storage.js
async function mostrarHistorico() {
    console.log("mostrarHistorico: Carregando histórico.");
    const historicoDiv = document.getElementById('historico');
    const computedStyle = window.getComputedStyle(historicoDiv);

    if (computedStyle.display === 'none') {
        historicoDiv.style.display = 'block';
        console.log("mostrarHistorico: Histórico exibido.");

        let ulElement = historicoDiv.querySelector('ul');
        if (!ulElement) {
            ulElement = document.createElement('ul');
            historicoDiv.querySelector('.history-container').appendChild(ulElement);
        }
        ulElement.innerHTML = "<p>Carregando histórico...</p>";

        try {
            const cadastros = getHistorico(); // Já ordenado do mais recente para o mais antigo (unshift)
            console.log("mostrarHistorico: Registros encontrados:", cadastros.length);

            if (cadastros.length === 0) {
                ulElement.innerHTML = "<p>Nenhum cadastro encontrado no histórico.</p>";
                console.log("mostrarHistorico: Nenhum cadastro encontrado.");
                return;
            }

            let html = "";
            cadastros.forEach((c) => {
                const protocoloDisplay = c.protocolo ? `Protocolo: ${c.protocolo}` : `ID: ${c.id}`;
                html += `<li data-doc-id="${c.id}">
                            <input type="checkbox" class="history-checkbox" value="${c.id}">
                            <span class="protocol-info" onclick="carregarCadastroLocal('${c.id}')">
                                <b>${protocoloDisplay}</b> - ${c.nome} - CPF: ${c.cpf} - Idade: ${c.idade} - Exames: ${c.exames.join(", ")}`;
                if (c.examesNaoListados) {
                    html += `<br>Adicionais: ${c.examesNaoListados.substring(0, 50)}${c.examesNaoListados.length > 50 ? '...' : ''}`;
                }
                if (c.observacoes) {
                    html += `<br>Observações: ${c.observacoes.substring(0, 100)}${c.observacoes.length > 100 ? '...' : ''}`;
                }
                html += `</span></li>`;
            });
            ulElement.innerHTML = html;
            console.log("mostrarHistorico: Histórico carregado e exibido.");
            updateSelectAllMasterCheckbox();

        } catch (error) {
            console.error("mostrarHistorico: Erro ao carregar histórico:", error);
            ulElement.innerHTML = "<p>Erro ao carregar histórico.</p>";
            alert("Erro ao carregar histórico. Consulte o console.");
        }
    } else {
        historicoDiv.style.display = 'none';
        console.log("mostrarHistorico: Histórico ocultado.");
    }
}

// carregarCadastroLocal lê um registro específico do localStorage pelo seu id
function carregarCadastroLocal(id) {
    console.log("carregarCadastroLocal: Carregando cadastro com ID:", id);

    try {
        const cadastro = getProtocoloById(id);

        if (!cadastro) {
            alert("Cadastro não encontrado no histórico.");
            console.warn("carregarCadastroLocal: Registro não encontrado para ID:", id);
            return;
        }

        console.log("carregarCadastroLocal: Cadastro encontrado:", cadastro);
        preencherCamposComCadastro(cadastro);
        console.log("carregarCadastroLocal: Chamada para preencherCamposComCadastro concluída.");

    } catch (error) {
        console.error("carregarCadastroLocal: Erro ao carregar cadastro:", error);
        alert("Erro ao carregar cadastro. Verifique o console.");
    }
}

function limparCampos(showAlert = true) {
    console.log("limparCampos: Limpando todos os campos do formulário.");
    document.getElementById('nome').value = '';
    document.getElementById('cpf').value = '';
    document.getElementById('data_nasc').value = '';
    document.getElementById('idade').value = '';
    document.getElementById('sexo').value = '';
    document.getElementById('endereco').value = '';
    document.getElementById('contato').value = '';
    document.getElementById('observacoes').value = '';
    document.getElementById('examesNaoListados').value = '';

    const allCheckboxes = document.querySelectorAll('.exame');
    allCheckboxes.forEach(cb => cb.checked = false);

    const ignoreCpfCheckbox = document.getElementById('ignoreCpfCheckbox');
    if (ignoreCpfCheckbox) {
        ignoreCpfCheckbox.checked = false;
        console.log("limparCampos: Checkbox 'Ignorar CPF' desmarcada.");
    }

    clearError('data_nasc');
    clearError('cpf');
    clearError('contato');

    document.getElementById('pesquisaExame').value = '';
    document.getElementById('sugestoes').innerHTML = '';
    document.getElementById('sugestoes').style.display = 'none';

    atualizarExamesSelecionadosDisplay();

    if (showAlert) {
        alert("Campos limpos para um novo cadastro!");
    }
    console.log("limparCampos: Campos limpos.");
}

// Função para alternar todas as checkboxes do histórico (Selecionar Todos/Nenhum)
function toggleAllHistoryCheckboxes() {
    console.log("toggleAllHistoryCheckboxes: Alterando estado de todas as checkboxes do histórico.");
    const masterCheckbox = document.getElementById('selectAllHistoryCheckbox');
    const isChecked = masterCheckbox.checked;
    const individualCheckboxes = document.querySelectorAll('.history-checkbox');

    individualCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
}

// Função para atualizar o estado da checkbox mestre "Selecionar Todos"
function updateSelectAllMasterCheckbox() {
    console.log("updateSelectAllMasterCheckbox: Atualizando estado da checkbox mestre.");
    const masterCheckbox = document.getElementById('selectAllHistoryCheckbox');
    const individualCheckboxes = document.querySelectorAll('.history-checkbox');

    if (individualCheckboxes.length === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
        return;
    }

    const checkedCount = Array.from(individualCheckboxes).filter(cb => cb.checked).length;

    if (checkedCount === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    } else if (checkedCount === individualCheckboxes.length) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
    } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
    }
}

// limparHistorico usa clearHistorico() do data_storage.js
async function limparHistorico() {
    console.log("limparHistorico: Iniciando processo de limpeza de histórico.");
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const SENHA_DINAMICA_ESPERADA = SENHA_BASE_SISLAB + hour + minute;

    const senhaDigitada = prompt(`Para limpar o histórico, digite a senha.`);
    if (senhaDigitada === null) {
        console.log("limparHistorico: Usuário cancelou a entrada da senha.");
        return;
    }
    if (senhaDigitada === SENHA_DINAMICA_ESPERADA) {
        console.log("limparHistorico: Senha correta. Prosseguindo com a limpeza.");
        const confirmDeleteAll = confirm("Tem certeza que deseja apagar TODO o histórico? Esta ação é irreversível e apagará todos os dados de pacientes!");
        if (!confirmDeleteAll) {
            console.log("limparHistorico: Usuário cancelou a confirmação de exclusão total.");
            return;
        }

        try {
            clearHistorico();
            alert("Histórico apagado com sucesso!");
            console.log("limparHistorico: Limpeza de histórico concluída.");
            mostrarHistorico();
        } catch (error) {
            console.error("limparHistorico: Erro ao limpar histórico:", error);
            alert("Erro ao limpar histórico. Verifique o console.");
        }
    } else {
        alert('Senha incorreta. Histórico não foi limpo.');
        console.log("limparHistorico: Senha incorreta.");
    }
}

// deleteSelectedHistory usa deleteProtocolos() do data_storage.js
async function deleteSelectedHistory() {
    console.log("deleteSelectedHistory: Iniciando processo de exclusão de histórico selecionado.");
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const SENHA_DINAMICA_ESPERADA = SENHA_BASE_SISLAB + hour + minute;

    const senhaDigitada = prompt(`Para excluir os protocolos selecionados, digite a senha.`);
    if (senhaDigitada === null) {
        console.log("deleteSelectedHistory: Usuário cancelou a entrada da senha.");
        return;
    }
    if (senhaDigitada === SENHA_DINAMICA_ESPERADA) {
        console.log("deleteSelectedHistory: Senha correta. Prosseguindo com a exclusão.");

        const selectedCheckboxes = document.querySelectorAll('.history-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert("Nenhum protocolo foi selecionado para exclusão.");
            console.log("deleteSelectedHistory: Nenhum checkbox selecionado.");
            return;
        }

        const confirmDelete = confirm(`Tem certeza que deseja apagar ${selectedCheckboxes.length} protocolo(s) selecionado(s)? Esta ação é irreversível.`);
        if (!confirmDelete) {
            console.log("deleteSelectedHistory: Usuário cancelou a confirmação de exclusão.");
            return;
        }

        try {
            const ids = Array.from(selectedCheckboxes).map(cb => cb.value);
            deleteProtocolos(ids);
            alert(`${ids.length} protocolo(s) excluído(s) com sucesso!`);
            console.log(`deleteSelectedHistory: ${ids.length} protocolos excluídos com sucesso.`);
            mostrarHistorico();
        } catch (error) {
            console.error("deleteSelectedHistory: Erro ao excluir protocolos selecionados:", error);
            alert("Erro ao excluir protocolos selecionados. Verifique o console.");
        }
    } else {
        alert('Senha incorreta. Exclusão cancelada.');
        console.log("deleteSelectedHistory: Senha incorreta.");
    }
}

// printSelectedHistory usa getProtocoloById() do data_storage.js (síncrono, sem Firebase)
function printSelectedHistory() {
    console.log("printSelectedHistory: Iniciando impressão de histórico selecionado.");

    const selectedCheckboxes = document.querySelectorAll('.history-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        alert("Nenhum protocolo foi selecionado para impressão.");
        console.log("printSelectedHistory: Nenhum checkbox selecionado.");
        return;
    }

    const ids = Array.from(selectedCheckboxes).map(cb => cb.value);
    console.log("printSelectedHistory: IDs selecionados para impressão:", ids);

    const selectedCadastros = ids.map(id => getProtocoloById(id)).filter(Boolean);

    if (selectedCadastros.length === 0) {
        alert("Não foi possível carregar os protocolos selecionados para impressão.");
        console.log("printSelectedHistory: Nenhum cadastro válido encontrado após busca.");
        return;
    }

    // Ordena pelo número de protocolo para impressão consistente
    selectedCadastros.sort((a, b) => {
        const protocolA = parseInt((a.protocolo || '').split('-')[0]) || 0;
        const protocolB = parseInt((b.protocolo || '').split('-')[0]) || 0;
        return protocolA - protocolB;
    });

    console.log("printSelectedHistory: Cadastros selecionados para impressão:", selectedCadastros.length);

    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Histórico de Cadastros Selecionados - Impressão</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { text-align: center; color: #1A2B4C; }
                ul { list-style-type: none; padding: 0; }
                li {
                    border: 1px solid #ddd;
                    padding: 10px;
                    margin-bottom: 10px;
                    border-radius: 5px;
                    background-color: #f9f9f9;
                }
                li b { color: #333; }
                li p { margin: 5px 0; }
            </style>
        </head>
        <body>
            <h1>Histórico de Cadastros Selecionados do Laboratório CETEP</h1>
            <ul>
    `;

    selectedCadastros.forEach((c) => {
        const protocoloDisplay = c.protocolo ? `Protocolo: ${c.protocolo}` : `ID: ${c.id || 'N/D'}`;
        printContent += `
            <li>
                <b>${protocoloDisplay}</b><br>
                <p><strong>Nome:</strong> ${c.nome || 'N/D'}</p>
                <p><strong>CPF:</strong> ${c.cpf || 'N/D'}</p>
                <p><strong>Data de Nasc.:</strong> ${c.dataNasc || 'N/D'}</p>
                <p><strong>Idade:</strong> ${c.idade || 'N/D'}</p>
                <p><strong>Sexo:</strong> ${c.sexo || 'N/D'}</p>
                <p><strong>Endereço:</strong> ${c.endereco || 'N/D'}</p>
                <p><strong>Contato:</strong> ${c.contato || 'N/D'}</p>
                <p><strong>Exames Selecionados:</strong> ${Array.isArray(c.exames) ? c.exames.join(", ") : 'N/D'}</p>
        `;
        if (c.examesNaoListados) {
            printContent += `<p><strong>Exames Adicionais:</strong> ${c.examesNaoListados}</p>`;
        }
        if (c.observacoes) {
            printContent += `<p><strong>Observações:</strong> ${c.observacoes}</p>`;
        }
        printContent += `</li>`;
    });

    printContent += `
            </ul>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    printWindow.onload = function() {
        printWindow.print();
        console.log("printSelectedHistory: Janela de impressão aberta e print() chamado.");
    };
}

// --- Exposição de funções no window para handlers HTML e outros módulos ---
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
