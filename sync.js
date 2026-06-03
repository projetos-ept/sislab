// sync.js — Motor de sincronização offline-first para o SISLAB
// Funciona em background: empurra dados pendentes e puxa novos registros do servidor REST.

import {
  getPendingSync, markAsSynced, importarDadosSync,
  getSyncConfig, getLastSyncAt, setLastSyncAt
} from './data_storage.js';

let _timer = null;
let _status = { online: navigator.onLine, lastSync: null, pendentes: 0, erro: null, sincronizando: false };

function emitirStatus() {
  document.dispatchEvent(new CustomEvent('sislab:sync-status', { detail: { ..._status } }));
}

function atualizarPendentes() {
  const { historico, laudos } = getPendingSync();
  _status.pendentes = historico.length + laudos.length;
}

window.addEventListener('online',  () => { _status.online = true;  emitirStatus(); });
window.addEventListener('offline', () => { _status.online = false; emitirStatus(); });

// ── API pública ──────────────────────────────────────────────────────────

export function iniciarSync() {
  pararSync();
  const config = getSyncConfig();
  if (!config?.endpoint) return;
  const intervalo = (config.intervalMinutes || 5) * 60 * 1000;
  _timer = setInterval(sincronizarAgora, intervalo);
  atualizarPendentes();
  _status.lastSync = getLastSyncAt();
  emitirStatus();
}

export function pararSync() {
  if (_timer !== null) { clearInterval(_timer); _timer = null; }
}

export function getSyncStatus() {
  atualizarPendentes();
  return { ..._status };
}

export async function sincronizarAgora() {
  const config = getSyncConfig();
  if (!config?.endpoint) {
    _status.erro = 'Endpoint não configurado.';
    emitirStatus();
    return;
  }

  if (!navigator.onLine) {
    _status.online = false;
    emitirStatus();
    return;
  }

  _status.sincronizando = true;
  _status.erro = null;
  emitirStatus();

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['X-API-Key'] = config.apiKey;

    // 1. Push — envia registros locais não sincronizados
    const { historico: pendHist, laudos: pendLaudos } = getPendingSync();
    if (pendHist.length > 0 || pendLaudos.length > 0) {
      const pushResp = await fetch(`${config.endpoint}/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ historico: pendHist, laudos: pendLaudos })
      });
      if (!pushResp.ok) throw new Error(`Push falhou: HTTP ${pushResp.status}`);
      markAsSynced(pendHist.map(e => e.id), 'historico');
      markAsSynced(pendLaudos.map(l => l.id), 'laudos');
    }

    // 2. Pull — busca registros novos/atualizados no servidor
    const since = getLastSyncAt() || '1970-01-01T00:00:00.000Z';
    const pullResp = await fetch(`${config.endpoint}/pull?since=${encodeURIComponent(since)}`, { headers });
    if (!pullResp.ok) throw new Error(`Pull falhou: HTTP ${pullResp.status}`);
    const remoteData = await pullResp.json();
    importarDadosSync(remoteData);

    const agora = new Date().toISOString();
    setLastSyncAt(agora);
    _status.lastSync = agora;
    _status.pendentes = 0;
    _status.online = true;

  } catch (e) {
    _status.erro = e.message;
  } finally {
    _status.sincronizando = false;
    atualizarPendentes();
    emitirStatus();
  }
}
