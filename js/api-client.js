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

async function request(action, data = {}) { … }


  // --------------------------------------------------
  // Ações específicas (thin‑wrappers em torno de request)
  // --------------------------------------------------
  const salvarRegistro = registro => {
    if (!registro?.id) throw new Error('Dados/ID inválidos para salvarRegistro');
    return request('salvarRegistro', registro);
  };

  const listarRegistros = async () => {
    // A função request chamada aqui agora NÃO mostrará mais o loading
    const r = await request('listarRegistros');
    if (r?.success && Array.isArray(r.registros)) return r.registros;
    throw new Error(r?.message || 'Formato inesperado em listarRegistros');
  };

  const obterRegistro = id => {
    if (!id) throw new Error('ID não fornecido para obterRegistro');
    // A função request chamada aqui agora NÃO mostrará mais o loading
    return request('obterRegistro', { id }).then(r => r.registro ?? null);
  };

  const excluirRegistro = id => {
    if (!id) throw new Error('ID não fornecido para excluirRegistro');
    // A função request chamada aqui agora NÃO mostrará mais o loading
    return request('excluirRegistro', { id });
  };

  const uploadImagem = photo => {
    if (!photo?.dataUrl || !photo?.name || !photo?.type || !photo?.registroId || !photo?.id)
      throw new Error('Dados de imagem incompletos em uploadImagem');

    // A função request chamada aqui agora NÃO mostrará mais o loading
    return request('uploadImagem', {
      fileName   : `${photo.registroId}_${photo.id}_${photo.name}`,
      mimeType   : photo.type,
      content    : photo.dataUrl.includes(',') ? photo.dataUrl.split(',')[1] : photo.dataUrl,
      registroId : photo.registroId,
      photoId    : photo.id
    });
  };

  const ping = () => {
    // A função request chamada aqui agora NÃO mostrará mais o loading
    return request('ping');
  }

  // --------------------------------------------------
  // Offline queue  (saveOfflineRequest, sync, clear)
  // --------------------------------------------------
  function saveOfflineRequest(action, data) {
    const u = window.Utils;
    // Não salva uploads na fila, mas mostra notificação se Utils existir
    if (action === 'uploadImagem') {
        u?.showNotification?.(`Upload de imagem (${data?.fileName}) não pode ser feito offline.`, 'info', 5000);
        return;
    }
    try {
      const list = u.obterLocalStorage('offlineRequests') || [];
      const id   = `offline_${u.gerarId()}`;
      list.push({ id, action, data, retries:0, t:new Date().toISOString() });
      u.salvarLocalStorage('offlineRequests', list);
      // Mostra notificação usando Utils, se disponível
      u?.showNotification?.(`Ação (${action}) salva offline.`, 'warning', 4000);
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

    // Nenhuma notificação de loading global para o processo de sync aqui
    console.log(`Sync: Iniciando processamento de ${nowBatch.length} itens.`);

    for (const req of nowBatch) {
      try {
        console.log(`Sync: Tentando sincronizar ${req.action} (${req.id})`);
        // A chamada request interna NÃO mostrará mais loading individual
        await request(req.action, req.data);
        console.log(`Sync: Sucesso para ${req.action} (${req.id})`);
        success++;
      }
      catch(err){
        console.warn(`Sync: Falha para ${req.action} (${req.id}), retries: ${req.retries + 1}`, err.message);
        req.retries++;
        if (req.retries < MAXR) {
          tempFail++;
          rest.push(req); // Devolve para a fila para tentar depois
        } else {
          console.error(`Sync: Item ${req.action} (${req.id}) descartado após ${MAXR} tentativas.`);
          dropped++;
        }
      }
    }
    // Salva o restante da fila
    u.salvarLocalStorage('offlineRequests', rest);
    console.log(`Sync: Finalizado. Synced: ${success}, Failed Temp: ${tempFail}, Dropped: ${dropped}, Pending: ${rest.length}`);

    // Retorna o resultado do batch
    return { success:true, synced:success, dropped, tempFail, pending:rest.length };
  }

  const clearOfflineRequests = () => {
    window.Utils?.salvarLocalStorage('offlineRequests', []);
    console.log('Fila offline limpa.');
    return true;
  };

  // --------------------------------------------------
  // init (chamado pelo ModuleLoader)
  // --------------------------------------------------
  function init() {
    console.log('ApiClient (Fetch) inicializado');
    // Não há mais chamadas de loading/hideLoading aqui
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
