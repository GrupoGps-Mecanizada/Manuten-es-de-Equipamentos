// ==========================================
// === CLIENT-SIDE JAVASCRIPT (api-client.js) ===
// ==========================================

/**
 * Cliente para comunicação com a API do Google Apps Script (Módulo)
 * ATUALIZADO para usar Iframe Proxy com tratamento de erros e inicialização robusta.
 */
ModuleLoader.register('apiClient', function() {

  // --- Variáveis de Módulo para Iframe ---
  let apiFrame = null; // Referência ao elemento iframe
  let pendingRequests = {}; // Objeto para armazenar requisições pendentes { requestId: { resolve, reject, action } }
  let nextRequestId = 1; // Contador para IDs únicos de requisição
  let isInitializing = false; // Flag para evitar inicializações múltiplas do iframe
  let initializationPromise = null; // Armazena a Promise da inicialização em andamento
  let frameLoadTimeoutId = null; // ID do timeout de carregamento inicial do frame
  let messageListener = null; // Referência ao listener de mensagens para poder removê-lo

  /**
   * Obtém a URL da API do Config global, com fallback para localStorage.
   */
  function getApiUrl() {
      let url = window.CONFIG?.API_URL;
      if (!url) {
          console.warn("ApiClient: API_URL não encontrada no CONFIG global, tentando localStorage...");
          url = window.Utils?.obterLocalStorage?.('API_URL');
      }
      if (!url) {
          console.error("ApiClient: API_URL não configurada no CONFIG nem no localStorage!");
          window.Utils?.showNotification?.("Erro crítico: URL da API não encontrada.", "error");
          return null; // Retorna null se não encontrar
      }
      // Validação básica da URL
      try {
          new URL(url);
      } catch (e) {
           console.error(`ApiClient: API_URL inválida: "${url}"`, e);
           window.Utils?.showNotification?.(`Erro: URL da API inválida: ${url}`, "error");
           return null;
      }
      return url;
  }

  /**
   * Limpa o estado do iframe e listeners em caso de falha ou reset.
   */
  function cleanupApiFrame() {
      console.log("ApiClient: Limpando recursos do iframe...");
      if (frameLoadTimeoutId) {
          clearTimeout(frameLoadTimeoutId);
          frameLoadTimeoutId = null;
      }
      if (messageListener && window.removeEventListener) {
           window.removeEventListener('message', messageListener);
           messageListener = null;
      }
      if (apiFrame && apiFrame.parentNode) {
          apiFrame.parentNode.removeChild(apiFrame);
      }
      apiFrame = null;
      isInitializing = false;
      initializationPromise = null;
      // Rejeita todas as requisições que estavam pendentes durante a falha
      Object.values(pendingRequests).forEach(req => {
          // Verifica se a função reject existe antes de chamá-la
          if (typeof req.reject === 'function') {
              req.reject(new Error("Comunicação com a API interrompida durante inicialização/limpeza."));
          }
      });
      pendingRequests = {};
  }


  /**
   * Inicializa o iframe da API se ainda não foi inicializado.
   * Retorna uma Promise que resolve quando o iframe envia 'ready'.
   */
  function initApiFrame() {
    if (apiFrame) return Promise.resolve(); // Já inicializado
    if (isInitializing) return initializationPromise; // Inicialização em andamento

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      return Promise.reject(new Error('URL da API não configurada. Não é possível inicializar o frame.'));
    }

    isInitializing = true;
    console.log("ApiClient: Iniciando inicialização do frame da API...");

    initializationPromise = new Promise((resolve, reject) => {
      // Cria o iframe
      apiFrame = document.createElement('iframe');
      apiFrame.style.display = 'none'; // Oculto
      apiFrame.src = apiUrl;
      apiFrame.setAttribute('aria-hidden', 'true'); // Acessibilidade
      apiFrame.setAttribute('title', 'API Communication Proxy'); // Acessibilidade

      // Handler para mensagens recebidas (do iframe ou outras fontes)
      messageListener = (event) => {
        let expectedOrigin = null;
        try {
             expectedOrigin = new URL(apiUrl).origin;
        } catch(e) {
             console.error("ApiClient: Falha ao obter origem da API_URL para validação.", e);
             if (!isInitializing) cleanupApiFrame();
             reject(new Error("URL da API inválida para obter origem."));
             return;
        }

        // --- INÍCIO DA CORREÇÃO para Timeout ---
        // Verifica se a mensagem é 'ready' ANTES de verificar a origem estritamente
        if (event.data?.status === 'ready' && event.source === apiFrame.contentWindow) {
            // Para a mensagem 'ready', a verificação mais importante é
            // se ela veio da janela do iframe que criamos (event.source).
            // A verificação de origem pode ser relaxada aqui se houver problemas com subdomínios googleusercontent.
            console.log(`ApiClient: Mensagem 'ready' recebida da janela do iframe (Origem: ${event.origin}). Processando...`);
            if (frameLoadTimeoutId) clearTimeout(frameLoadTimeoutId);
            isInitializing = false;
            resolve(); // Resolve a inicialização
            return; // Mensagem 'ready' processada.
        }
        // --- FIM DA CORREÇÃO ---

        // Para TODAS as outras mensagens (respostas), APLICA a verificação de origem estrita
        if (event.origin !== expectedOrigin) {
          // Ignora mensagens (que não são 'ready') de origens inesperadas
          // console.debug("ApiClient: Mensagem (não-ready) ignorada de origem inesperada:", event.origin);
          return;
        }

        // Verifica se a mensagem (que passou na verificação de origem) tem dados
        if (!event.data || typeof event.data !== 'object') {
             console.warn("ApiClient: Mensagem (origem OK) ignorada - sem dados ou formato inválido:", event);
             return;
        }

        // Processa respostas (sucesso ou erro) para requisições pendentes
        if ((event.data.status === 'success' || event.data.status === 'error') && event.data.requestId) {
          const pendingReq = pendingRequests[event.data.requestId];
          if (pendingReq) {
            console.debug(`ApiClient: Recebida resposta para Req ID ${event.data.requestId} (Ação: ${pendingReq.action}), Status: ${event.data.status}`);
            if (event.data.status === 'success') {
              pendingReq.resolve(event.data.response);
            } else {
              let errorMsg = event.data.error || 'Erro desconhecido retornado pela API no iframe';
              if (typeof event.data.error === 'object' && event.data.error.message) {
                errorMsg = event.data.error.message;
              }
              pendingReq.reject(new Error(String(errorMsg)));
            }
            delete pendingRequests[event.data.requestId]; // Remove após processar
          } else {
              console.warn(`ApiClient: Recebida resposta para Req ID ${event.data.requestId}, mas não encontrada na lista de pendentes.`);
          }
        }
        // Ignora outras mensagens válidas que não são respostas esperadas
        // else { console.debug("ApiClient: Mensagem (origem OK) ignorada - tipo não reconhecido:", event.data); }

      }; // Fim do messageListener

      // Adiciona o listener globalmente
      window.addEventListener('message', messageListener);

      // Timeout para o carregamento inicial e recebimento do 'ready'
      const initializationTimeoutMs = 15000; // 15 segundos
      frameLoadTimeoutId = setTimeout(() => {
        console.error(`ApiClient: Timeout (${initializationTimeoutMs}ms) ao esperar pelo sinal 'ready' do frame da API.`);
        cleanupApiFrame(); // Limpa tudo se o iframe não respondeu 'ready' a tempo
        reject(new Error(`Timeout ao inicializar o frame da API (${initializationTimeoutMs/1000}s)`));
      }, initializationTimeoutMs);

      // Adiciona o iframe ao DOM para iniciar o carregamento
      document.body.appendChild(apiFrame);

    }).catch(err => {
        console.error("ApiClient: Falha final na inicialização do Iframe:", err);
        cleanupApiFrame(); // Garante a limpeza
        throw err; // Re-lança o erro
    });

    return initializationPromise;
  }

  /**
   * Envia uma requisição para a API através do iframe proxy.
   * @param {string} action - O nome da ação/função a ser executada na API (Code.gs).
   * @param {object} [data={}] - Os dados a serem enviados com a requisição.
   * @returns {Promise<any>} Uma Promise que resolve com a resposta da API ou rejeita em caso de erro/timeout.
   */
  async function request(action, data = {}) {
    const utils = window.Utils;
    let requestId = -1;

    try {
      // --- CORREÇÃO: Chamada a showLoading com 1 argumento ---
      utils?.showLoading?.(`Processando ${action}...`);

      // 1. Garante inicialização do iframe
      await initApiFrame();

      // 2. Gera ID e armazena Promise
      requestId = nextRequestId++;
      console.debug(`ApiClient (Iframe): Enviando ação '${action}' (ID: ${requestId})`);

      const resultPromise = new Promise((resolve, reject) => {
        pendingRequests[requestId] = { resolve, reject, action };

        // 3. Envia mensagem ao iframe
        const apiUrl = apiFrame.src;
        const targetOrigin = new URL(apiUrl).origin;

        apiFrame.contentWindow.postMessage({
          requestId: requestId,
          action: action,
          data: data
        }, targetOrigin); // Envia SOMENTE para a origem correta

        // 4. Timeout da requisição
        const requestTimeoutMs = 30000; // 30 segundos
        setTimeout(() => {
          if (pendingRequests[requestId]) {
            const pendingAction = pendingRequests[requestId].action;
            console.error(`ApiClient (Iframe): Timeout (${requestTimeoutMs/1000}s) na requisição para ação '${pendingAction}' (ID: ${requestId})`);
            pendingRequests[requestId].reject(new Error(`Timeout na requisição ${pendingAction} (${requestTimeoutMs/1000}s)`));
            delete pendingRequests[requestId];
          }
        }, requestTimeoutMs);
      });

      // 5. Aguarda e retorna
      const result = await resultPromise;
      console.debug(`ApiClient (Iframe): Resposta recebida com sucesso para ação '${action}' (ID: ${requestId})`);

      utils?.hideLoading?.(); // Esconde SÓ no sucesso
      return result;

    } catch (error) {
      console.error(`ApiClient (Iframe): Erro na requisição para ação '${action}'${requestId > 0 ? ` (ID: ${requestId})` : ''}:`, error.message || error);
      if (typeof saveOfflineRequest === 'function') {
          saveOfflineRequest(action, data);
      }
      utils?.hideLoading?.(); // Garante esconder no erro
      throw error;
    }
  }


  // ========= Funções de Ações Específicas =========

  /** Envia solicitação para salvar/atualizar registro */
  async function salvarRegistro(registro) {
    if (!registro || !registro.id) {
        console.error("ApiClient.salvarRegistro: Dados ou ID inválidos.", registro);
        throw new Error("Dados ou ID do registro inválidos para salvar.");
    }
    return request('salvarRegistro', registro);
  }

  /** Envia solicitação para listar todos os registros */
  async function listarRegistros() {
    const result = await request('listarRegistros');
    if (result && Array.isArray(result.registros)) {
      return result.registros;
    }
    console.error("ApiClient.listarRegistros: Resposta inesperada da API:", result);
    throw new Error('Formato de resposta inválido ao listar registros (via iframe)');
  }

  /** Envia solicitação para obter um registro por ID */
  async function obterRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para obterRegistro.");
    const result = await request('obterRegistro', { id: id });
    if (result && result.success === true) {
       return result.registro !== undefined ? result.registro : null;
    }
    console.error("ApiClient.obterRegistro: Resposta inesperada da API:", result);
    throw new Error(result?.message || `Falha ao obter registro ${id} (via iframe)`);
  }

  /** Envia solicitação para excluir um registro por ID */
  async function excluirRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para exclusão.");
    return request('excluirRegistro', { id: id });
  }

  /** Envia solicitação para fazer upload de imagem */
  async function uploadImagem(photoObject) {
    if (!photoObject?.dataUrl || !photoObject?.name || !photoObject?.type || !photoObject?.registroId || !photoObject?.id) {
      console.error("ApiClient.uploadImagem: Dados da imagem incompletos.", photoObject);
      throw new Error("Dados da imagem incompletos para upload.");
    }
    const payload = {
      fileName: `${photoObject.registroId}_${photoObject.id}_${photoObject.name}`,
      mimeType: photoObject.type,
      content: photoObject.dataUrl,
      registroId: photoObject.registroId,
      photoId: photoObject.id
    };
    console.warn("ApiClient (Iframe): Upload de imagem via iframe pode ser lento/instável para arquivos grandes.");
    return request('uploadImagem', payload);
  }

  /** Envia uma solicitação 'ping' para testar a conexão */
  async function ping() {
    console.log("ApiClient (Iframe): Chamando ação 'ping'");
    return request('ping');
  }


  // ========= Lógica Offline (Funções permanecem no mesmo módulo) =========

  /** Salva uma requisição falhada no localStorage para tentativa posterior */
  function saveOfflineRequest(action, data) {
    const utils = window.Utils;
    if (action === 'uploadImagem') {
      console.warn(`ApiClient (Iframe): Upload da imagem (${data?.fileName}) falhou e NÃO será salvo offline.`);
      utils?.showNotification?.(`Falha no upload da imagem. Tente novamente com conexão.`, 'error', 6000);
      return;
    }
    if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage || !utils?.gerarId) {
      console.error("ApiClient (Iframe): Funções Utils não disponíveis para salvar requisição offline.");
      return;
    }
    console.log(`ApiClient (Iframe): Salvando requisição offline para ação '${action}'...`);
    try {
        const offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
        const requestId = `offline_${utils.gerarId()}`;
        offlineRequests.push({
          id: requestId, action, data, timestamp: new Date().toISOString(), retries: 0
        });
        utils.salvarLocalStorage('offlineRequests', offlineRequests);
        console.log(`Requisição offline ID ${requestId} salva. Pendentes: ${offlineRequests.length}`);
        utils.showNotification?.(`Sem conexão ou erro. Ação (${action}) salva para tentar mais tarde.`, 'warning', 5000);
    } catch (e) {
        console.error("ApiClient (Iframe): Erro ao salvar requisição offline:", e);
        utils?.showNotification?.(`Erro ao salvar ação (${action}) offline. Verifique o console.`, 'error');
    }
  }

  /** Limpa todas as requisições offline salvas */
  function clearOfflineRequests() {
    const utils = window.Utils;
    if (!utils?.salvarLocalStorage) {
      console.error("ApiClient: Utils.salvarLocalStorage não disponível.");
      return false;
    }
    try {
      utils.salvarLocalStorage('offlineRequests', []);
      console.log("ApiClient: Requisições offline limpas.");
      utils.showNotification?.("Fila de ações offline limpa.", "success", 3000);
      return true;
    } catch (e) {
      console.error("ApiClient: Erro ao limpar requisições offline:", e);
      utils.showNotification?.("Erro ao limpar fila offline.", "error");
      return false;
    }
  }

  /** Tenta sincronizar (reenviar) requisições offline pendentes */
  async function syncOfflineRequests() {
      const utils = window.Utils;
      const configSync = window.CONFIG?.SYNC || {};
      const batchSize = configSync.BATCH_SIZE || 3;
      const maxRetries = configSync.MAX_RETRIES || 3;

      if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage) {
        console.error("ApiClient.sync: Funções Utils não disponíveis.");
        return { success: false, syncedCount: 0, errorCount: 0, failedTemporarily: 0, pendingCount: 0, errors: [{ error: "Utils indisponível" }] };
      }

      let offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
      const totalPendingInitial = offlineRequests.length;

      if (totalPendingInitial === 0) {
        console.log("ApiClient.sync: Nenhuma requisição offline.");
        return { success: true, syncedCount: 0, errorCount: 0, failedTemporarily: 0, pendingCount: 0, errors: [] };
      }

      if (!navigator.onLine) {
        console.log("ApiClient.sync: Sem conexão. Sincronização adiada.");
        return { success: false, message: "Sem conexão", syncedCount: 0, errorCount: 0, failedTemporarily: 0, pendingCount: totalPendingInitial, errors: [] };
      }

      const requestsToProcess = offlineRequests.slice(0, batchSize);
      const remainingForLater = offlineRequests.slice(batchSize);
      console.log(`ApiClient.sync: Tentando sincronizar ${requestsToProcess.length} de ${totalPendingInitial} via Iframe...`);

      let successCount = 0;
      const failedRequestsToKeep = [];
      const errorsPermanent = [];

      for (const req of requestsToProcess) {
        try {
          console.log(`ApiClient.sync: Enviando req offline ID ${req.id} (Ação: ${req.action})...`);
          await request(req.action, req.data); // Usa a função 'request' deste módulo
          console.log(`ApiClient.sync: Req offline ID ${req.id} sincronizada.`);
          successCount++;
        } catch (error) {
          console.error(`ApiClient.sync: Erro sincronizando req ID ${req.id} (${req.action}):`, error.message || error);
          req.retries = (req.retries || 0) + 1;
          if (req.retries < maxRetries) {
            failedRequestsToKeep.push(req);
            console.log(`ApiClient.sync: Req ID ${req.id} falhou (${req.retries}/${maxRetries}), retentará.`);
          } else {
            console.error(`ApiClient.sync: Req ID ${req.id} (${req.action}) descartada após ${maxRetries} tentativas.`);
            errorsPermanent.push({ requestId: req.id, action: req.action, error: `Máx ${maxRetries} tentativas. Erro: ${error.message || String(error)}` });
          }
        }
      } // Fim for

      const updatedOfflineRequests = [...failedRequestsToKeep, ...remainingForLater];
      utils.salvarLocalStorage('offlineRequests', updatedOfflineRequests);
      const finalPendingCount = updatedOfflineRequests.length;

      const finalResult = {
          success: errorsPermanent.length === 0 && failedRequestsToKeep.length === 0,
          syncedCount: successCount,
          errorCount: errorsPermanent.length,
          failedTemporarily: failedRequestsToKeep.length,
          pendingCount: finalPendingCount,
          errors: errorsPermanent
      };
      console.log(`ApiClient.sync: Concluído. ${successCount} sucesso(s), ${errorsPermanent.length} erro(s) perm, ${failedRequestsToKeep.length} falhas temp. Pendentes: ${finalPendingCount}.`);
      return finalResult;
  }


  /** Função de inicialização do módulo (chamada pelo ModuleLoader). */
  function init() {
    console.log('ApiClient (Iframe Proxy) inicializado via ModuleLoader.');
  }

  // --- Objeto Retornado pelo Módulo ---
  console.log("ApiClient (Iframe): Retornando interface pública do módulo.");
  return {
    init,
    salvarRegistro,
    listarRegistros,
    obterRegistro,
    excluirRegistro,
    uploadImagem,
    ping,
    syncOfflineRequests,
    clearOfflineRequests,
    // request: request, // Descomente para expor request genérico
  };

}); // Fim do ModuleLoader.register
