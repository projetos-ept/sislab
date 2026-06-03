// busca_historico.js

import { searchHistorico } from './data_storage.js';
import { formatDateTimeToDisplay } from './sislab_utils.js';

let historySearchInput;
let historicoListUl;
let historicoSectionDiv;

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG(busca_historico): DOMContentLoaded - Iniciando setup da busca de histórico.");

    historySearchInput = document.getElementById('historySearchInput');
    historicoListUl = document.querySelector('#historico ul');
    historicoSectionDiv = document.getElementById('historico');

    if (historySearchInput && historicoListUl && historicoSectionDiv) {
        historySearchInput.addEventListener('input', debounce(() => {
            performHistorySearch(historySearchInput.value.trim());
        }, 300));
        console.log("DEBUG(busca_historico): Event listener para 'historySearchInput' adicionado.");
    } else {
        console.warn("DEBUG(busca_historico): Elementos de busca de histórico não encontrados. Funcionalidade desabilitada.");
    }
});

// Função debounce para limitar a frequência de chamadas da função de busca
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Função principal para realizar a busca no histórico
async function performHistorySearch(searchTerm) {
    console.log(`DEBUG(busca_historico): Realizando busca para termo: "${searchTerm}"`);

    historicoListUl.innerHTML = "<p style='padding: 10px;'>Buscando no histórico...</p>";

    // Garante que a seção do histórico esteja visível antes de tentar renderizar
    if (historicoSectionDiv.style.display === 'none') {
        historicoSectionDiv.style.display = 'block';
        console.log("DEBUG(busca_historico): Exibindo a seção do histórico.");
    }

    try {
        // searchHistorico retorna resultados já filtrados e ordenados do localStorage
        const filteredCadastros = searchHistorico(searchTerm);
        console.log(`DEBUG(busca_historico): Total de registros retornados pelo searchHistorico: ${filteredCadastros.length}`);

        if (filteredCadastros.length === 0) {
            historicoListUl.innerHTML = `<p style='padding: 10px;'>Nenhum registro encontrado para "${searchTerm}".</p>`;
            console.log(`DEBUG(busca_historico): Nenhum registro encontrado para "${searchTerm}".`);
            if (typeof window.updateSelectAllMasterCheckbox === 'function') {
                window.updateSelectAllMasterCheckbox();
            }
            return;
        }

        // Renderiza os resultados filtrados
        let html = "";
        filteredCadastros.forEach((c) => {
            const protocoloDisplay = c.protocolo ? `Protocolo: ${c.protocolo}` : `ID: ${c.id}`;
            html += `<li data-doc-id="${c.id}">
                        <input type="checkbox" class="history-checkbox" value="${c.id}">
                        <span class="protocol-info" onclick="window.carregarCadastroLocal('${c.id}')">
                            <b>${protocoloDisplay}</b> - ${c.nome} - CPF: ${c.cpf} - Idade: ${c.idade} - Exames: ${Array.isArray(c.exames) ? c.exames.join(", ") : 'N/D'}`;
            if (c.examesNaoListados) {
                html += `<br>Adicionais: ${c.examesNaoListados.substring(0, 50)}${c.examesNaoListados.length > 50 ? '...' : ''}`;
            }
            if (c.observacoes) {
                html += `<br>Observações: ${c.observacoes.substring(0, 100)}${c.observacoes.length > 100 ? '...' : ''}`;
            }
            html += `</span></li>`;
        });
        historicoListUl.innerHTML = html;
        console.log(`DEBUG(busca_historico): ${filteredCadastros.length} registros renderizados.`);

        // Atualiza o estado do checkbox "Selecionar Todos" após a renderização
        if (typeof window.updateSelectAllMasterCheckbox === 'function') {
            window.updateSelectAllMasterCheckbox();
        }

    } catch (error) {
        historicoListUl.innerHTML = `<p style='padding: 10px; color: #CC3333;'>Erro ao buscar histórico: ${error.message}.</p>`;
        console.error("DEBUG(busca_historico): Erro ao buscar histórico:", error);
        alert(`Erro ao buscar histórico: ${error.message}. Verifique o console.`);
    }
}
