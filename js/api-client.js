// ==========================================
// === CLIENT-SIDE JAVASCRIPT (api-client.js) ===
// ==========================================

/**
 * Cliente para comunicação com a API do Google Apps Script (Módulo)
 * ATUALIZADO para usar Iframe Proxy com inicialização via Polling.
 */
ModuleLoader.register('apiClient', function() {

  // --- Variáveis de Módulo para Iframe ---
  let apiFrame = null; // Referência ao elemento iframe
  let pendingRequests = {}; // Objeto para armazenar requisições pendentes { requestId: { resolve, reject, action } }
  let nextRequestId = 1; // Contador para IDs únicos de requisição
  let isInitializing = false; // Flag para evitar inicializações múltiplas do iframe
  let initializationPromise = null; // Armazena a Promise da inicialização em andamento
  // Removido: frameLoadTimeoutId (timeout agora é geral)
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
      // Limpa timeouts/intervals se existirem (embora o novo init deva cuidar disso)
      // if (frameLoadTimeoutId) clearTimeout(frameLoadTimeoutId); // Removido
      if (messageListener && window.removeEventListener) {
           window.removeEventListener('message', messageListener);
           messageListener = null;
      }
      if (apiFrame && apiFrame.parentNode) {
          apiFrame.parentNode.removeChild(apiFrame);
      }
      apiFrame = null; // Importante resetar
      isInitializing = false; // Importante resetar
      initializationPromise = null; // Importante resetar

      // Rejeita todas as requisições que estavam pendentes durante a falha
      Object.values(pendingRequests).forEach(req => {
          if (typeof req.reject === 'function') {
              req.reject(new Error("Comunicação com a API interrompida durante inicialização/limpeza."));
          }
      });
      pendingRequests = {};
  }


  /**
   * Inicializa o iframe da API usando Polling para verificar se está pronto.
   * Retorna uma Promise que resolve com o elemento iframe pronto.
   */
  function initApiFrame() {
      if (apiFrame && !isInitializing) return Promise.resolve(apiFrame); // Já inicializado e não em processo
      if (isInitializing) return initializationPromise; // Inicialização em andamento

      const apiUrl = getApiUrl();
      if (!apiUrl) {
          return Promise.reject(new Error('URL da API não configurada. Não é possível inicializar o frame.'));
      }

      isInitializing = true; // Marca que está inicializando
      console.log("ApiClient: Iniciando inicialização do frame da API (Polling)...");

      initializationPromise = new Promise((resolve, reject) => {
          cleanupApiFrame(); // Limpa qualquer estado anterior antes de começar

          // Cria o iframe
          apiFrame = document.createElement('iframe');
          apiFrame.style.display = 'none';
          apiFrame.src = apiUrl;
          apiFrame.setAttribute('aria-hidden', 'true');
          apiFrame.setAttribute('title', 'API Communication Proxy');

          let checkIntervalId = null;
          let initializationTimeoutId = null;
          let checkRequestId = -1; // ID da requisição de check_ready atual

          // Handler para mensagens (focado na resposta do check_ready)
          messageListener = (event) => {
               // Verificação básica de segurança e formato da resposta
              if (!event.data || typeof event.data !== 'object' || event.data.requestId !== checkRequestId) {
                  // Ignora mensagens que não são a resposta para o ÚLTIMO check_ready enviado
                  return;
              }
               // Verifica se a origem é a esperada (do iframe)
               let expectedOrigin = null;
               try { expectedOrigin = new URL(apiUrl).origin; } catch (e) { /* já tratado antes */ return; }
               if (event.origin !== expectedOrigin) {
                  console.warn("ApiClient: Resposta de check_ready ignorada - origem inesperada:", event.origin);
                  return;
               }

              // Verifica se a resposta é do nosso ping e se o status é 'success' e contém a resposta esperada
              if (event.data.status === 'success' && event.data.response?.status === 'proxy_ready') {
                  console.log(`ApiClient: Resposta 'proxy_ready' recebida do iframe. Inicialização bem-sucedida.`);
                  // Limpeza e resolução
                  if (checkIntervalId) clearInterval(checkIntervalId); // Para o polling
                  if (initializationTimeoutId) clearTimeout(initializationTimeoutId); // Para o timeout geral
                  window.removeEventListener('message', messageListener); // Remove este listener específico
                  messageListener = null;
                  isInitializing = false; // Marca como não inicializando mais
                  resolve(apiFrame); // Resolve a promise com o frame pronto
              }
          };

          window.addEventListener('message', messageListener);

          // Define a função de erro para o iframe (caso não carregue)
          apiFrame.onerror = (error) => {
              console.error("ApiClient: Erro ao carregar o iframe da API:", error);
              if (checkIntervalId) clearInterval(checkIntervalId);
              if (initializationTimeoutId) clearTimeout(initializationTimeoutId);
              cleanupApiFrame();
              reject(new Error("Erro ao carregar o iframe da API. Verifique a URL e a rede."));
          };

          // Adiciona o iframe ao DOM *antes* de iniciar o polling
          document.body.appendChild(apiFrame);

          // Tenta enviar 'check_ready' periodicamente após um pequeno delay inicial
          const initialDelayMs = 500; // Espera um pouco antes de começar a perguntar
          setTimeout(() => {
              const checkIntervalMs = 750; // Verifica a cada 750ms (um pouco mais espaçado)
              checkIntervalId = setInterval(() => {
                  if (apiFrame && apiFrame.contentWindow) {
                      checkRequestId = `check_${nextRequestId++}`; // ID único para cada check
                      console.debug(`ApiClient: Enviando check_ready (ID: ${checkRequestId}) para o iframe...`);
                      // Define a origem de destino corretamente
                      let targetOrigin = '*'; // Default seguro
                       try { targetOrigin = new URL(apiUrl).origin; } catch(e){ console.error("URL inválida para targetOrigin no check_ready"); }

                      apiFrame.contentWindow.postMessage({
                          action: 'check_ready',
                          requestId: checkRequestId
                      }, targetOrigin); // Envia para a origem esperada do iframe
                  } else if (!apiFrame) {
                      // Se o apiFrame foi removido (ex: por erro), para o interval
                      console.warn("ApiClient: Iframe não existe mais, parando polling de check_ready.");
                      if (checkIntervalId) clearInterval(checkIntervalId);
                      if (initializationTimeoutId) clearTimeout(initializationTimeoutId);
                       // Não rejeita aqui, pois o onerror ou timeout geral tratará
                  } else {
                      console.warn("ApiClient: Tentando enviar check_ready, mas contentWindow não está pronto ainda.");
                  }
              }, checkIntervalMs);
          }, initialDelayMs);

          // Timeout geral para a inicialização (polling)
          const initializationTimeoutMs = 20000; // 20 segundos (aumentado)
          initializationTimeoutId = setTimeout(() => {
              console.error(`ApiClient: Timeout (${initializationTimeoutMs}ms) esperando pela resposta 'proxy_ready' do iframe via polling.`);
              if (checkIntervalId) clearInterval(checkIntervalId);
              cleanupApiFrame(); // Limpa tudo
              reject(new Error(`Timeout (${initializationTimeoutMs/1000}s) ao inicializar comunicação com a API.`));
          }, initializationTimeoutMs);

      }).catch(err => {
          // Garante limpeza e reset de flags em caso de erro na Promise
          console.error("ApiClient: Falha final na inicialização do Iframe (Polling):", err);
          cleanupApiFrame();
          // isInitializing e initializationPromise já são resetados em cleanupApiFrame
          throw err; // Re-lança para quem chamou
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
    let requestId = -1; // Inicializa fora do try

    try {
      // Mostra loading (se a função existir)
      utils?.showLoading?.(`Processando ${action}...`);

      // 1. Garante inicialização do iframe (agora usando polling)
      const currentApiFrame = await initApiFrame(); // Espera o frame estar pronto

      // 2. Gera ID e armazena Promise de resposta
      requestId = nextRequestId++;
      console.debug(`ApiClient (Iframe): Enviando ação '${action}' (ID: ${requestId})`);

      const resultPromise = new Promise((resolve, reject) => {
        pendingRequests[requestId] = { resolve, reject, action };

        // 3. Envia mensagem ao iframe (contentWindow deve estar pronto agora)
        const apiUrl = currentApiFrame.src; // Usa a URL do frame obtido
        let targetOrigin = '*'; // Default seguro
        try {
            targetOrigin = new URL(apiUrl).origin;
        } catch (e) {
            console.error("ApiClient: URL da API inválida ao obter origem para postMessage. Usando '*'.", e);
        }

        // Verifica contentWindow novamente por segurança antes de enviar
        if (currentApiFrame.contentWindow) {
            currentApiFrame.contentWindow.postMessage({
              requestId: requestId,
              action: action,
              data: data
            }, targetOrigin);
        } else {
            // Isso não deveria acontecer se initApiFrame resolveu corretamente, mas é uma segurança extra
            console.error(`ApiClient (Iframe): contentWindow inacessível após inicialização para enviar ação '${action}' (ID: ${requestId})`);
            reject(new Error(`Falha ao enviar mensagem para a API (contentWindow)`));
            delete pendingRequests[requestId];
            return; // Sai da função da Promise
        }

        // 4. Timeout da requisição ESPECÍFICA (diferente do timeout de inicialização)
        const requestTimeoutMs = 30000; // 30 segundos
        setTimeout(() => {
          if (pendingRequests[requestId]) {
            const pendingAction = pendingRequests[requestId].action;
            console.error(`ApiClient (Iframe): Timeout (${requestTimeoutMs/1000}s) na requisição para ação '${pendingAction}' (ID: ${requestId})`);
            if (typeof pendingRequests[requestId].reject === 'function') {
                pendingRequests[requestId].reject(new Error(`Timeout na requisição ${pendingAction} (${requestTimeoutMs/1000}s)`));
            }
            delete pendingRequests[requestId];
          }
        }, requestTimeoutMs);
      });

      // 5. Aguarda e retorna o resultado
      const result = await resultPromise;
      console.debug(`ApiClient (Iframe): Resposta recebida com sucesso para ação '${action}' (ID: ${requestId})`);

      utils?.hideLoading?.(); // Esconde loading no sucesso
      return result;

    } catch (error) {
      // Captura erros da inicialização (initApiFrame) ou da requisição (resultPromise)
      console.error(`ApiClient (Iframe): Erro na requisição para ação '${action}'${requestId > 0 ? ` (ID: ${requestId})` : ''}:`, error.message || error);
      // Tenta salvar offline se a função existir
      if (typeof saveOfflineRequest === 'function') {
          saveOfflineRequest(action, data);
      }
      utils?.hideLoading?.(); // Garante esconder loading no erro
      throw error; // Propaga o erro para a função chamadora (ex: App.js)
    }
  }


  // ========= Funções de Ações Específicas (sem alterações) =========

  async function salvarRegistro(registro) {
    if (!registro || !registro.id) {
        console.error("ApiClient.salvarRegistro: Dados ou ID inválidos.", registro);
        throw new Error("Dados ou ID do registro inválidos para salvar.");
    }
    return request('salvarRegistro', registro);
  }

  async function listarRegistros() {
    const result = await request('listarRegistros');
    if (result && Array.isArray(result.registros)) {
      return result.registros;
    }
    console.error("ApiClient.listarRegistros: Resposta inesperada da API:", result);
    throw new Error('Formato de resposta inválido ao listar registros (via iframe)');
  }

  async function obterRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para obterRegistro.");
    const result = await request('obterRegistro', { id: id });
    if (result && result.success === true) {
       return result.registro !== undefined ? result.registro : null;
    }
    console.error("ApiClient.obterRegistro: Resposta inesperada da API:", result);
    throw new Error(result?.message || `Falha ao obter registro ${id} (via iframe)`);
  }

  async function excluirRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para exclusão.");
    return request('excluirRegistro', { id: id });
  }

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

  async function ping() {
    console.log("ApiClient (Iframe): Chamando ação 'ping'");
    return request('ping');
  }


  // ========= Lógica Offline (sem alterações) =========

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
          await request(req.action, req.data);
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
    console.log('ApiClient (Iframe Proxy - Polling) inicializado via ModuleLoader.');
    // A inicialização do iframe via polling acontece na primeira chamada a `request`
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
  };

}); // Fim do ModuleLoader.register
