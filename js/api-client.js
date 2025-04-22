// ==================================================
// === CLIENT‑SIDE JAVASCRIPT (api‑client.js) =======
// === VERSÃO FETCH DIRETO (SEM IFRAME) ============
// ==================================================

/**
 * Cliente para comunicação com a API do Google Apps Script.
 * Usa fetch() direto, com fallback para fila offline.
 */
ModuleLoader.register('apiClient', function () {

  // --------------------------------------------------
  // Utilitário: obtém a URL da API do objeto global CONFIG
  // --------------------------------------------------
  function getApiUrl() {
    const url = window.CONFIG?.API_URL;
    if (!url) {
      console.error('ApiClient: API_URL não configurada no CONFIG!');
      window.Utils?.showNotification?.('Erro crítico: URL da API não encontrada.', 'error');
      return null;
    }
    try { new URL(url); } catch (e) {
      console.error(`ApiClient: API_URL inválida: "${url}"`, e);
      window.Utils?.showNotification?.(`Erro: URL da API inválida: ${url}`, 'error');
      return null;
    }
    return url;
  }

  // --------------------------------------------------
  // request(action, data) – faz o POST com fetch()
  // --------------------------------------------------
  async function request(action, data = {}) {
    const utils  = window.Utils;
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      if (typeof saveOfflineRequest === 'function') saveOfflineRequest(action, data);
      throw new Error('API_URL ausente.');
    }

    utils?.showLoading?.(`Processando ${action}…`);

    const payload = { action, data };

    const requestOptions = {
      method : 'POST',
      headers: {
        // ★ Simple‑request: evita pre‑flight CORS
        'Content-Type': 'text/plain',
        'Accept'      : 'application/json'
      },
      body   : JSON.stringify(payload)
    };

    try {
      console.debug(`ApiClient: enviando '${action}' → ${apiUrl}`);
      const response = await fetch(apiUrl, requestOptions);

      if (!response.ok) {
        const raw = await response.text();
        let msg = `HTTP ${response.status} – ${response.statusText}`;
        try { msg = JSON.parse(raw).message || msg; } catch {}
        throw new Error(msg);
      }

      const result = await response.json();
      if (result?.success === false) throw new Error(result.message || `Erro em ${action}`);

      utils?.hideLoading?.();
      return result;

    } catch (err) {
      console.error(`ApiClient: erro em '${action}':`, err);
      if (typeof saveOfflineRequest === 'function') saveOfflineRequest(action, data);
      utils?.hideLoading?.();
      throw err;
    }
  }

  // --------------------------------------------------
  // Ações específicas (thin‑wrappers em torno de request)
  // --------------------------------------------------
  const salvarRegistro = registro => {
    if (!registro?.id) throw new Error('Dados/ID inválidos para salvarRegistro');
    return request('salvarRegistro', registro);
  };

  const listarRegistros = async () => {
    const r = await request('listarRegistros');
    if (r?.success && Array.isArray(r.registros)) return r.registros;
    throw new Error(r?.message || 'Formato inesperado em listarRegistros');
  };

  const obterRegistro = id => {
    if (!id) throw new Error('ID não fornecido para obterRegistro');
    return request('obterRegistro', { id }).then(r => r.registro ?? null);
  };

  const excluirRegistro = id => {
    if (!id) throw new Error('ID não fornecido para excluirRegistro');
    return request('excluirRegistro', { id });
  };

  const uploadImagem = photo => {
    if (!photo?.dataUrl || !photo?.name || !photo?.type || !photo?.registroId || !photo?.id)
      throw new Error('Dados de imagem incompletos em uploadImagem');

    return request('uploadImagem', {
      fileName   : `${photo.registroId}_${photo.id}_${photo.name}`,
      mimeType   : photo.type,
      content    : photo.dataUrl.includes(',') ? photo.dataUrl.split(',')[1] : photo.dataUrl,
      registroId : photo.registroId,
      photoId    : photo.id
    });
  };

  const ping = () => request('ping');

  // --------------------------------------------------
  // Offline queue  (saveOfflineRequest, sync, clear)
  // --------------------------------------------------
  function saveOfflineRequest(action, data) {
    const u = window.Utils;
    if (action === 'uploadImagem') return; // não põe uploads na fila
    try {
      const list = u.obterLocalStorage('offlineRequests') || [];
      const id   = `offline_${u.gerarId()}`;
      list.push({ id, action, data, retries:0, t:new Date().toISOString() });
      u.salvarLocalStorage('offlineRequests', list);
      u.showNotification?.(`Ação (${action}) salva offline.`, 'warning', 4000);
    } catch(e) { console.error('saveOfflineRequest erro:', e); }
  }

  async function syncOfflineRequests() {
    const u = window.Utils;
    let list = u.obterLocalStorage('offlineRequests') || [];
    if (!list.length || !navigator.onLine) return { success:false, pending:list.length };

    const BATCH = (window.CONFIG?.SYNC?.BATCH_SIZE) || 3;
    const MAXR  = (window.CONFIG?.SYNC?.MAX_RETRIES) || 3;

    let success = 0, dropped = 0, tempFail = 0;
    const nowBatch = list.slice(0, BATCH);
    const rest     = list.slice(BATCH);

    for (const req of nowBatch) {
      try { await request(req.action, req.data); success++; }
      catch(err){
        req.retries++;
        if (req.retries < MAXR) { tempFail++; rest.push(req); }
        else { dropped++; }
      }
    }
    u.salvarLocalStorage('offlineRequests', rest);
    return { success:true, synced:success, dropped, tempFail, pending:rest.length };
  }

  const clearOfflineRequests = () => {
    window.Utils?.salvarLocalStorage('offlineRequests', []);
    return true;
  };

  // --------------------------------------------------
  // init (chamado pelo ModuleLoader)
  // --------------------------------------------------
  function init() {
    console.log('ApiClient (Fetch) inicializado');
  }

  // Interface pública
  return {
    init,
    salvarRegistro,
    listarRegistros,
    obterRegistro,
    excluirRegistro,
    uploadImagem,
    ping,
    syncOfflineRequests,
    clearOfflineRequests
  };
});
