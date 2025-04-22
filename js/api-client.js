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
          req.reject(new Error("Comunicação com a API interrompida durante inicialização/limpeza."));
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
        // ** Verificação de Segurança: Origem **
        // Compara a origem da mensagem com a origem esperada da API_URL
        let expectedOrigin = null;
        try {
             expectedOrigin = new URL(apiUrl).origin;
        } catch(e) {
             console.error("ApiClient: Falha ao obter origem da API_URL para validação.", e);
             // Não deveria acontecer se getApiUrl validou, mas por segurança:
             if (!isInitializing) cleanupApiFrame(); // Limpa se já passou da inicialização
             reject(new Error("URL da API inválida para obter origem."));
             return;
        }

        if (event.origin !== expectedOrigin) {
          // Ignora mensagens de origens inesperadas (pode ser de extensões, etc.)
          // console.debug("ApiClient: Mensagem ignorada de origem inesperada:", event.origin);
          return;
        }

        // Verifica se a mensagem tem dados
        if (!event.data || typeof event.data !== 'object') {
             console.warn("ApiClient: Mensagem ignorada - sem dados ou formato inválido:", event);
             return;
        }

        // Processa mensagem 'ready' do iframe
        if (event.data.status === 'ready' && event.source === apiFrame.contentWindow) {
          console.log("ApiClient: Frame da API está pronto! (recebeu 'ready')");
          if (frameLoadTimeoutId) clearTimeout(frameLoadTimeoutId); // Cancela timeout de carregamento
          isInitializing = false; // Marca como inicializado
          resolve(); // Resolve a Promise de inicialização
        }
        // Processa respostas (sucesso ou erro) para requisições pendentes
        else if ((event.data.status === 'success' || event.data.status === 'error') && event.data.requestId) {
          const pendingReq = pendingRequests[event.data.requestId];
          if (pendingReq) {
            console.debug(`ApiClient: Recebida resposta para Req ID ${event.data.requestId} (Ação: ${pendingReq.action}), Status: ${event.data.status}`);
            if (event.data.status === 'success') {
              pendingReq.resolve(event.data.response);
            } else {
              // Extrai a mensagem de erro de forma mais robusta
              let errorMsg = event.data.error || 'Erro desconhecido retornado pela API no iframe';
              if (typeof event.data.error === 'object' && event.data.error.message) {
                errorMsg = event.data.error.message;
              }
              pendingReq.reject(new Error(String(errorMsg))); // Rejeita com a mensagem de erro
            }
            // Remove a requisição da lista de pendentes após ser resolvida/rejeitada
            delete pendingRequests[event.data.requestId];
          } else {
              console.warn(`ApiClient: Recebida resposta para Req ID ${event.data.requestId}, mas não encontrada na lista de pendentes.`);
          }
        }
        // Ignora outras mensagens
         // else { console.debug("ApiClient: Mensagem ignorada - tipo não reconhecido:", event.data); }
      }; // Fim do messageListener

      // Adiciona o listener globalmente (precisa ouvir antes do iframe carregar)
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
        // Se a Promise de inicialização for rejeitada por qualquer motivo
        console.error("ApiClient: Falha final na inicialização do Iframe:", err);
        cleanupApiFrame(); // Garante a limpeza
        throw err; // Re-lança o erro para quem chamou initApiFrame
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
    const utils = window.Utils; // Referência para utilitários (loading, notificações)
    let requestId = -1; // Inicializa requestId

    try {
      utils?.showLoading?.(`Processando ${action}...`); // Passa apenas a mensagem

      // 1. Garante que o iframe esteja inicializado (ou tenta inicializar)
      await initApiFrame();

      // Se chegou aqui, o iframe está pronto (apiFrame existe)

      // 2. Gera um ID único e armazena a Promise da requisição
      requestId = nextRequestId++;
      console.debug(`ApiClient (Iframe): Enviando ação '${action}' (ID: ${requestId})`);

      const resultPromise = new Promise((resolve, reject) => {
        // Armazena callbacks e ação para debugging
        pendingRequests[requestId] = { resolve, reject, action };

        // 3. Envia a mensagem para o conteúdo do iframe
        const apiUrl = apiFrame.src; // Pega a URL com a qual o iframe foi inicializado
        const targetOrigin = new URL(apiUrl).origin; // Calcula a origem esperada para segurança

        apiFrame.contentWindow.postMessage({
          requestId: requestId,
          action: action,
          data: data // Envia os dados
        }, targetOrigin); // Envia SOMENTE para a origem correta

        // 4. Timeout específico para esta requisição
        const requestTimeoutMs = 30000; // 30 segundos
        setTimeout(() => {
          if (pendingRequests[requestId]) { // Verifica se ainda está pendente
            const pendingAction = pendingRequests[requestId].action;
            console.error(`ApiClient (Iframe): Timeout (${requestTimeoutMs/1000}s) na requisição para ação '${pendingAction}' (ID: ${requestId})`);
            // Rejeita a Promise específica desta requisição
            pendingRequests[requestId].reject(new Error(`Timeout na requisição ${pendingAction} (${requestTimeoutMs/1000}s)`));
            delete pendingRequests[requestId]; // Remove da lista
          }
        }, requestTimeoutMs);
      });

      // 5. Aguarda a resposta (ou timeout) e retorna
      const result = await resultPromise;
      console.debug(`ApiClient (Iframe): Resposta recebida com sucesso para ação '${action}' (ID: ${requestId})`);

      // Validação básica da resposta (opcional, depende do contrato com a API)
      // Ex: Se a API SEMPRE retorna { success: true, ... } ou { success: false, message: ... }
      // if (typeof result === 'object' && result !== null && result.success === false) {
      //    console.warn(`ApiClient (Iframe): Ação '${action}' (ID: ${requestId}) retornou success:false. Mensagem: ${result.message}`);
      //    throw new Error(result.message || `API (iframe) informou falha na ação ${action}`);
      // }

      utils?.hideLoading?.(); // Esconde loading SÓ em caso de sucesso final
      return result;

    } catch (error) {
      // Erro pode ser da inicialização (initApiFrame) ou da própria requisição (timeout, erro da API)
      console.error(`ApiClient (Iframe): Erro na requisição para ação '${action}'${requestId > 0 ? ` (ID: ${requestId})` : ''}:`, error.message || error);

      // Tenta salvar offline (se a função existir e não for upload de imagem)
      if (typeof saveOfflineRequest === 'function') {
          saveOfflineRequest(action, data); // Chama a função definida neste módulo
      }

      utils?.hideLoading?.(); // Garante que esconda o loading em caso de erro
      throw error; // Re-lança o erro para a camada que chamou (App.js, etc.)
    }
  }


  // ========= Funções de Ações Específicas =========
  // Estas funções atuam como fachada, chamando a função 'request' genérica.

  /** Envia solicitação para salvar/atualizar registro */
  async function salvarRegistro(registro) {
    if (!registro || !registro.id) {
        console.error("ApiClient.salvarRegistro: Dados ou ID inválidos.", registro);
        throw new Error("Dados ou ID do registro inválidos para salvar.");
    }
    // A função 'request' tratará a comunicação e erros básicos.
    // A validação específica da resposta (se necessária além de success/error) pode ser feita aqui.
    return request('salvarRegistro', registro);
  }

  /** Envia solicitação para listar todos os registros */
  async function listarRegistros() {
    const result = await request('listarRegistros');
    // Validação básica do formato esperado (um array 'registros')
    // A API (Code.gs) já deve garantir success:true nesse caso.
    if (result && Array.isArray(result.registros)) {
      return result.registros; // Retorna apenas o array de registros
    }
    // Se a API retornou erro, 'request' já terá lançado.
    // Se retornou sucesso mas formato errado:
    console.error("ApiClient.listarRegistros: Resposta inesperada da API:", result);
    throw new Error('Formato de resposta inválido ao listar registros (via iframe)');
  }

  /** Envia solicitação para obter um registro por ID */
  async function obterRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para obterRegistro.");
    const result = await request('obterRegistro', { id: id });
    // A API (Code.gs) retorna { success: true, registro: obj } ou { success: true, registro: null }
    if (result && result.success === true) { // Verifica success explicitamente
       return result.registro !== undefined ? result.registro : null; // Retorna o registro ou null
    }
    // Se chegou aqui, ou 'request' lançou erro, ou a resposta foi inesperada
    console.error("ApiClient.obterRegistro: Resposta inesperada da API:", result);
    throw new Error(result?.message || `Falha ao obter registro ${id} (via iframe)`);
  }

  /** Envia solicitação para excluir um registro por ID */
  async function excluirRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para exclusão.");
    // Geralmente retorna algo como { success: true, message: "..." } ou erro
    return request('excluirRegistro', { id: id });
  }

  /** Envia solicitação para fazer upload de imagem */
  async function uploadImagem(photoObject) {
    // Validação dos dados da foto
    if (!photoObject?.dataUrl || !photoObject?.name || !photoObject?.type || !photoObject?.registroId || !photoObject?.id) {
      console.error("ApiClient.uploadImagem: Dados da imagem incompletos.", photoObject);
      throw new Error("Dados da imagem incompletos para upload.");
    }
    // Payload para a API (Code.gs -> uploadImagem)
    const payload = {
      fileName: `${photoObject.registroId}_${photoObject.id}_${photoObject.name}`,
      mimeType: photoObject.type,
      // Envia o base64 completo (incluindo prefixo) - Code.gs tratará isso
      content: photoObject.dataUrl,
      registroId: photoObject.registroId,
      photoId: photoObject.id // ID gerado no cliente para referência
    };
    // Aviso sobre performance com iframe
    console.warn("ApiClient (Iframe): Upload de imagem via iframe pode ser lento/instável para arquivos grandes.");
    return request('uploadImagem', payload);
  }

  // --- ADICIONADO: Função Ping ---
  /** Envia uma solicitação 'ping' para testar a conexão */
  async function ping() {
    console.log("ApiClient (Iframe): Chamando ação 'ping'");
    // Chama 'request' sem dados adicionais
    return request('ping');
  }
  // --- FIM DA ADIÇÃO ---


  // ========= Lógica Offline (Funções permanecem no mesmo módulo) =========

  /** Salva uma requisição falhada no localStorage para tentativa posterior */
  function saveOfflineRequest(action, data) {
    const utils = window.Utils;

    // Não salva uploads de imagem offline
    if (action === 'uploadImagem') {
      console.warn(`ApiClient (Iframe): Upload da imagem (${data?.fileName}) falhou e NÃO será salvo offline.`);
      utils?.showNotification?.(`Falha no upload da imagem. Tente novamente com conexão.`, 'error', 6000);
      return;
    }

    // Verifica se as funções de utilidade necessárias existem
    if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage || !utils?.gerarId) {
      console.error("ApiClient (Iframe): Funções Utils (salvar/obterLocalStorage, gerarId) não disponíveis para salvar requisição offline.");
      return;
    }

    console.log(`ApiClient (Iframe): Salvando requisição offline para ação '${action}'...`);
    try {
        const offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
        const requestId = `offline_${utils.gerarId()}`; // ID único para a requisição offline
        offlineRequests.push({
          id: requestId,
          action,
          data, // Salva os dados originais
          timestamp: new Date().toISOString(),
          retries: 0 // Inicializa contador de tentativas
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
      console.error("ApiClient: Utils.salvarLocalStorage não disponível para limpar requisições offline.");
      return false;
    }
    try {
      utils.salvarLocalStorage('offlineRequests', []); // Salva um array vazio
      console.log("ApiClient: Todas as requisições offline foram limpas.");
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
      const configSync = window.CONFIG?.SYNC || {}; // Usa configurações de SYNC do config.js
      const batchSize = configSync.BATCH_SIZE || 3; // Quantas processar por vez
      const maxRetries = configSync.MAX_RETRIES || 3; // Máximo de tentativas por requisição
      const retryDelay = configSync.RETRY_DELAY || 5000; // Tempo entre tentativas (ms) - Não usado diretamente aqui, mas no MAX_RETRIES

      // Verifica dependências
      if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage) {
        console.error("ApiClient.sync: Funções Utils não disponíveis para sincronizar.");
        return { success: false, syncedCount: 0, errorCount: 0, failedTemporarily: 0, pendingCount: 0, errors: [{ error: "Utils indisponível" }] };
      }

      let offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
      const totalPendingInitial = offlineRequests.length;

      if (totalPendingInitial === 0) {
        console.log("ApiClient.sync: Nenhuma requisição offline para sincronizar.");
        return { success: true, syncedCount: 0, errorCount: 0, failedTemporarily: 0, pendingCount: 0, errors: [] };
      }

      // Verifica conexão ANTES de tentar
      if (!navigator.onLine) {
        console.log("ApiClient.sync: Sem conexão de rede. Sincronização adiada.");
        // Não mostra notificação aqui, App.js pode já ter mostrado
        return { success: false, message: "Sem conexão", syncedCount: 0, errorCount: 0, failedTemporarily: 0, pendingCount: totalPendingInitial, errors: [] };
      }

      // Pega o próximo lote para processar
      const requestsToProcess = offlineRequests.slice(0, batchSize);
      // O restante que ficará para a próxima sincronização
      const remainingForLater = offlineRequests.slice(batchSize);

      console.log(`ApiClient.sync: Tentando sincronizar ${requestsToProcess.length} de ${totalPendingInitial} requisições offline via Iframe...`);
      // Notificação movida para App.js para evitar duplicação se sync for chamado de lá

      let successCount = 0;
      const failedRequestsToKeep = []; // Requisições que falharam mas ainda têm tentativas
      const errorsPermanent = []; // Erros de requisições que excederam as tentativas

      // Processa o lote sequencialmente para não sobrecarregar
      for (const req of requestsToProcess) {
        try {
          console.log(`ApiClient.sync: Enviando req offline ID ${req.id} (Ação: ${req.action}) via Iframe...`);
          // Chama a função 'request' DESTE módulo (que usa iframe)
          const result = await request(req.action, req.data);
          // Se 'request' não lançou erro, considera sucesso
          console.log(`ApiClient.sync: Requisição offline ID ${req.id} sincronizada com sucesso via Iframe.`);
          successCount++;
        } catch (error) {
          // Erro ao tentar enviar a requisição offline
          console.error(`ApiClient.sync: Erro ao sincronizar req ID ${req.id} (Ação: ${req.action}) via Iframe:`, error.message || error);
          req.retries = (req.retries || 0) + 1; // Incrementa contador de tentativas

          if (req.retries < maxRetries) {
            // Mantém na lista para tentar novamente mais tarde
            failedRequestsToKeep.push(req);
            console.log(`ApiClient.sync: Req ID ${req.id} falhou (${req.retries}/${maxRetries}), será tentada novamente.`);
          } else {
            // Atingiu o máximo de tentativas, descarta e registra erro permanente
            console.error(`ApiClient.sync: Req ID ${req.id} (Ação: ${req.action}) falhou após ${maxRetries} tentativas e será descartada.`);
            errorsPermanent.push({ requestId: req.id, action: req.action, error: `Máximo de ${maxRetries} tentativas atingido. Último erro: ${error.message || String(error)}` });
          }
        }
      } // Fim do loop for

      // Atualiza a lista de requisições pendentes no localStorage
      // Mantém as que falharam temporariamente e as que não foram processadas ainda
      const updatedOfflineRequests = [...failedRequestsToKeep, ...remainingForLater];
      utils.salvarLocalStorage('offlineRequests', updatedOfflineRequests);

      const finalPendingCount = updatedOfflineRequests.length;
      const finalResult = {
          success: errorsPermanent.length === 0 && failedRequestsToKeep.length === 0, // Sucesso real só se nada falhou (permanente ou temp) NESTA rodada
          syncedCount: successCount,
          errorCount: errorsPermanent.length, // Erros permanentes (descartados)
          failedTemporarily: failedRequestsToKeep.length, // Falhas que serão retentadas
          pendingCount: finalPendingCount,
          errors: errorsPermanent // Lista de erros permanentes
      };

      console.log(`ApiClient.sync: Sincronização (Iframe) concluída. ${successCount} sucesso(s), ${errorsPermanent.length} erro(s) permanentes, ${failedRequestsToKeep.length} falhas temporárias. Pendentes: ${finalPendingCount}.`);

      // Notificações são melhor tratadas pelo App.js que chamou a sync

      return finalResult;
  } // Fim syncOfflineRequests


  /**
   * Função de inicialização do módulo (chamada pelo ModuleLoader).
   * Pode ser usada para configurações iniciais, se necessário.
   */
  function init() {
    console.log('ApiClient (Iframe Proxy) inicializado via ModuleLoader.');
    // Não inicia o iframe aqui (inicialização lazy no primeiro 'request')
  }

  // --- Objeto Retornado pelo Módulo ---
  // Expõe as funções públicas que outras partes da aplicação usarão.
  console.log("ApiClient (Iframe): Retornando interface pública do módulo.");
  return {
    init, // Função de inicialização (pode ser chamada pelo loader)

    // Funções de Ação (interface principal para a aplicação)
    salvarRegistro,
    listarRegistros,
    obterRegistro,
    excluirRegistro,
    uploadImagem,
    ping, // Expõe a função ping

    // Funções de Gerenciamento Offline
    syncOfflineRequests,
    clearOfflineRequests,

    // Opcional: Expor a função 'request' genérica se precisar chamá-la diretamente
    // request: request,
    // Opcional: Expor a função de inicialização do frame se precisar controle externo
    // initApiFrame: initApiFrame
  };

}); // Fim do ModuleLoader.register
