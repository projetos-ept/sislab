// VERSÃO: 1.1.0 (sislab_utils.js)
// CHANGELOG:
// - Removido: Funções e constantes relacionadas ao inventário (LOCAL_FILENAME_CATEGORIES, loadCategories, getOperadorNameFromInput, OPERATOR_NAME_STORAGE_KEY, formatarCod).

export function showError(elementId, message) {
    const inputElement = document.getElementById(elementId);
    const errorDiv = document.getElementById(`${elementId}-error`);
    if (inputElement && errorDiv) {
        inputElement.classList.add('error');
        errorDiv.textContent = message;
    }
}

export function clearError(elementId) {
    const inputElement = document.getElementById(elementId);
    const errorDiv = document.getElementById(`${elementId}-error`);
    if (inputElement && errorDiv) {
        inputElement.classList.remove('error');
        errorDiv.textContent = '';
    }
}

export function formatDateToInput(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDateToDisplay(date) {
    if (!date) return 'N/D';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

export function formatDateTimeToDisplay(date) {
    if (!date) return 'N/D';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year}\n${hours}:${minutes}:${seconds}`;
}
