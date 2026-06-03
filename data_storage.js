// data_storage.js — Módulo central de armazenamento offline (localStorage) para o SISLAB

const KEYS = {
  historico: 'sislab_historico',
  laudos: 'sislab_laudos',
  listaExames: 'sislab_lista_exames'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// --- Histórico ---

export function getHistorico() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.historico) || '[]');
  } catch {
    return [];
  }
}

function saveHistorico(data) {
  localStorage.setItem(KEYS.historico, JSON.stringify(data));
}

export function getNextProtocolNumber() {
  const historico = getHistorico();
  if (historico.length === 0) return 1;
  return historico.reduce((max, e) => {
    const n = parseInt((e.protocolo || '').split('-')[0]) || 0;
    return n > max ? n : max;
  }, 0) + 1;
}

export function addProtocolo(entry) {
  const historico = getHistorico();
  if (!entry.id) entry.id = generateId();
  if (!entry.timestamp) entry.timestamp = Date.now();
  historico.unshift(entry);
  saveHistorico(historico);
  return entry.id;
}

export function deleteProtocolos(ids) {
  const idSet = new Set(ids);
  saveHistorico(getHistorico().filter(e => !idSet.has(e.id)));
}

export function clearHistorico() {
  localStorage.removeItem(KEYS.historico);
}

export function getProtocoloById(id) {
  return getHistorico().find(e => e.id === id) || null;
}

export function findByCpf(cpfDigits) {
  return getHistorico().filter(e => e.cpf === cpfDigits);
}

export function searchHistorico(term) {
  if (!term) return [...getHistorico()];
  const lower = term.toLowerCase();
  const isProtocol = /^\d{4}-\d{8}$/.test(term);
  const cpfClean = term.replace(/\D/g, '');
  const isCpf = cpfClean.length === 11;

  return getHistorico().filter(e => {
    if (isProtocol) return e.protocolo === term;
    if (isCpf) return e.cpf === cpfClean;
    return (
      (e.nome && e.nome.toLowerCase().includes(lower)) ||
      (e.protocolo && e.protocolo.toLowerCase().includes(lower)) ||
      (e.cpf && e.cpf.includes(cpfClean))
    );
  });
}

// --- Laudos ---

export function getLaudos() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.laudos) || '[]');
  } catch {
    return [];
  }
}

function saveLaudos(data) {
  localStorage.setItem(KEYS.laudos, JSON.stringify(data));
}

export function addOrUpdateLaudo(entry) {
  const laudos = getLaudos();
  if (!entry.id) entry.id = generateId();
  if (!entry.dataEmissao) entry.dataEmissao = new Date().toISOString();
  const idx = laudos.findIndex(l => l.protocolo === entry.protocolo);
  if (idx >= 0) {
    laudos[idx] = entry;
  } else {
    laudos.unshift(entry);
  }
  saveLaudos(laudos);
  return entry.id;
}

export function getLaudoByPatientId(patientId) {
  return getLaudos().find(l => l.patientId === patientId) || null;
}

// --- Cache da lista de exames ---

export function getListaExamesCache() {
  return localStorage.getItem(KEYS.listaExames);
}

export function setListaExamesCache(text) {
  localStorage.setItem(KEYS.listaExames, text);
}

// --- Export de dados ---

export function exportarDados() {
  const payload = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    historico: getHistorico(),
    laudos: getLaudos()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sislab_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Import de dados (ignora duplicatas por protocolo) ---

export function importarDados(jsonString) {
  const data = JSON.parse(jsonString);
  const result = { addedHistorico: 0, skippedHistorico: 0, addedLaudos: 0, skippedLaudos: 0 };

  if (Array.isArray(data.historico)) {
    const historico = getHistorico();
    const existentes = new Set(historico.map(e => e.protocolo).filter(Boolean));
    for (const entry of data.historico) {
      if (entry.protocolo && existentes.has(entry.protocolo)) {
        result.skippedHistorico++;
      } else {
        if (!entry.id) entry.id = generateId();
        historico.push(entry);
        if (entry.protocolo) existentes.add(entry.protocolo);
        result.addedHistorico++;
      }
    }
    saveHistorico(historico);
  }

  if (Array.isArray(data.laudos)) {
    const laudos = getLaudos();
    const existentes = new Set(laudos.map(l => l.protocolo).filter(Boolean));
    for (const entry of data.laudos) {
      if (entry.protocolo && existentes.has(entry.protocolo)) {
        result.skippedLaudos++;
      } else {
        if (!entry.id) entry.id = generateId();
        laudos.push(entry);
        if (entry.protocolo) existentes.add(entry.protocolo);
        result.addedLaudos++;
      }
    }
    saveLaudos(laudos);
  }

  return result;
}
