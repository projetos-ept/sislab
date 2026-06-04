// data_storage.js — Módulo central de armazenamento offline (localStorage) para o SISLAB

const KEYS = {
  historico:    'sislab_historico',
  laudos:       'sislab_laudos',
  listaExames:  'sislab_lista_exames',
  syncConfig:   'sislab_sync_config',
  lastSync:     'sislab_last_sync'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ── Histórico ─────────────────────────────────────────────────────────────

export function getHistorico() {
  try { return JSON.parse(localStorage.getItem(KEYS.historico) || '[]'); }
  catch { return []; }
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
  if (entry.synced === undefined) entry.synced = false;
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
  const cpfClean = term.replace(/\D/g, '');
  const isCpf = cpfClean.length === 11;

  return getHistorico().filter(e => {
    if (isCpf) return e.cpf === cpfClean;
    return (
      (e.nome && e.nome.toLowerCase().includes(lower)) ||
      (e.protocolo && e.protocolo.toLowerCase().includes(lower)) ||
      (e.cpf && e.cpf.includes(cpfClean))
    );
  });
}

// ── Laudos ────────────────────────────────────────────────────────────────

export function getLaudos() {
  try { return JSON.parse(localStorage.getItem(KEYS.laudos) || '[]'); }
  catch { return []; }
}

function saveLaudos(data) {
  localStorage.setItem(KEYS.laudos, JSON.stringify(data));
}

export function addOrUpdateLaudo(entry) {
  const laudos = getLaudos();
  if (!entry.id) entry.id = generateId();
  if (!entry.dataEmissao) entry.dataEmissao = new Date().toISOString();
  if (entry.synced === undefined) entry.synced = false;
  const idx = laudos.findIndex(l => l.protocolo === entry.protocolo);
  if (idx >= 0) laudos[idx] = entry;
  else laudos.unshift(entry);
  saveLaudos(laudos);
  return entry.id;
}

export function getLaudoByPatientId(patientId) {
  return getLaudos().find(l => l.patientId === patientId) || null;
}

// ── Cache da lista de exames ──────────────────────────────────────────────

export function getListaExamesCache() {
  return localStorage.getItem(KEYS.listaExames);
}

export function setListaExamesCache(text) {
  localStorage.setItem(KEYS.listaExames, text);
}

// ── Export / Import (backup manual) ──────────────────────────────────────

export function exportarDados() {
  const payload = {
    version: '2.1',
    exportDate: new Date().toISOString(),
    historico: getHistorico(),
    laudos: getLaudos(),
    listaExames: getListaExamesCache() || ''
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

// Importação manual — ignora duplicatas por protocolo (comportamento conservador)
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

  if (typeof data.listaExames === 'string' && data.listaExames.trim()) {
    const local = (getListaExamesCache() || '').trim().split('\n').map(e => e.trim()).filter(Boolean);
    const imported = data.listaExames.trim().split('\n').map(e => e.trim()).filter(Boolean);
    const merged = [...new Set([...local, ...imported])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    setListaExamesCache(merged.join('\n'));
  }

  return result;
}

// ── Sync — funções para o motor de sincronização (sync.js) ────────────────

// Retorna registros ainda não sincronizados com o servidor
export function getPendingSync() {
  return {
    historico: getHistorico().filter(e => !e.synced),
    laudos:    getLaudos().filter(l => !l.synced)
  };
}

// Marca registros como sincronizados
export function markAsSynced(ids, tipo) {
  const idSet = new Set(ids);
  if (tipo === 'historico') {
    saveHistorico(getHistorico().map(e => idSet.has(e.id) ? { ...e, synced: true } : e));
  } else if (tipo === 'laudos') {
    saveLaudos(getLaudos().map(l => idSet.has(l.id) ? { ...l, synced: true } : l));
  }
}

// Importação via sync — conflito resolvido por timestamp (mais recente vence)
export function importarDadosSync(data) {
  const result = { addedHistorico: 0, updatedHistorico: 0, addedLaudos: 0, updatedLaudos: 0 };

  if (Array.isArray(data.historico)) {
    const historico = getHistorico();
    for (const remote of data.historico) {
      const idx = historico.findIndex(l => l.protocolo === remote.protocolo);
      if (idx >= 0) {
        const local = historico[idx];
        if ((remote.timestamp || 0) > (local.timestamp || 0)) {
          historico[idx] = { ...remote, synced: true };
          result.updatedHistorico++;
        }
      } else {
        if (!remote.id) remote.id = generateId();
        historico.push({ ...remote, synced: true });
        result.addedHistorico++;
      }
    }
    saveHistorico(historico);
  }

  if (Array.isArray(data.laudos)) {
    const laudos = getLaudos();
    for (const remote of data.laudos) {
      const idx = laudos.findIndex(l => l.protocolo === remote.protocolo);
      const remoteTs = remote.dataEmissao ? new Date(remote.dataEmissao).getTime() : 0;
      if (idx >= 0) {
        const localTs = laudos[idx].dataEmissao ? new Date(laudos[idx].dataEmissao).getTime() : 0;
        if (remoteTs > localTs) {
          laudos[idx] = { ...remote, synced: true };
          result.updatedLaudos++;
        }
      } else {
        if (!remote.id) remote.id = generateId();
        laudos.push({ ...remote, synced: true });
        result.addedLaudos++;
      }
    }
    saveLaudos(laudos);
  }

  if (typeof data.listaExames === 'string' && data.listaExames.trim()) {
    const local = (getListaExamesCache() || '').trim().split('\n').map(e => e.trim()).filter(Boolean);
    const remote = data.listaExames.trim().split('\n').map(e => e.trim()).filter(Boolean);
    const merged = [...new Set([...local, ...remote])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    setListaExamesCache(merged.join('\n'));
  }

  return result;
}

// Configuração de sincronização
export function getSyncConfig() {
  try { return JSON.parse(localStorage.getItem(KEYS.syncConfig) || 'null'); }
  catch { return null; }
}

export function setSyncConfig(config) {
  localStorage.setItem(KEYS.syncConfig, JSON.stringify(config));
}

// Controle do timestamp da última sincronização bem-sucedida
export function getLastSyncAt() {
  return localStorage.getItem(KEYS.lastSync) || null;
}

export function setLastSyncAt(isoString) {
  localStorage.setItem(KEYS.lastSync, isoString);
}
