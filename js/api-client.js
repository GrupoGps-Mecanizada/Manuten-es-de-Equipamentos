// ==========================================
// === CLIENT-SIDE JAVASCRIPT (api-client.js) ===
// ==========================================

/**
 * Cliente para comunicação com a API do Google Apps Script (Módulo)
 * ATUALIZADO para usar Iframe Proxy
 */
ModuleLoader.register('apiClient', function() {

  // --- INÍCIO: Variáveis para comunicação via Iframe ---
  let apiFrame = null; // Referência ao elemento iframe
  let pendingRequests = {}; // Objeto para armazenar requisições pendentes { requestId: { resolve, reject } }
  let nextRequestId = 1; // Contador para gerar IDs únicos para as requisições
  let isInitializing = false; // Flag para evitar inicializações múltiplas simultâneas
  let initializationPromise = null; // Armazena a Promise da inicialização em andamento
  // --- FIM: Variáveis para comunicação via Iframe ---

  /**
   * Obtém a URL da API do Config global, com fallback para localStorage.
   * Esta função permanece a mesma e será usada por initApiFrame.
   */
  function getApiUrl() {
      let url = window.CONFIG?.API_URL;
      if (!url) {
          console.warn("API_URL não encontrada no CONFIG global, tentando localStorage...");
          url = window.Utils?.obterLocalStorage?.('API_URL');
      }
      if (!url) {
          console.error("API_URL não configurada no CONFIG nem no localStorage!");
          window.Utils?.showNotification?.("Erro crítico: URL da API não encontrada.", "error");
      }
      return url || null;
  }

  // --- INÍCIO: Função de inicialização do Iframe ---
  /**
   * Inicializa o iframe da API se ainda não foi inicializado.
   * Garante que o iframe esteja carregado e pronto para receber mensagens.
   * Adaptado para usar getApiUrl() e evitar inicializações concorrentes.
   * @returns {Promise<void>} Uma Promise que resolve quando o iframe está pronto ou rejeita em caso de erro ou timeout.
   */
  function initApiFrame() {
    // Se já está inicializado, retorna imediatamente.
    if (apiFrame) return Promise.resolve();
    // Se já existe uma inicialização em andamento, retorna a Promise existente.
    if (isInitializing) return initializationPromise;

    // Marca que a inicialização começou e cria a Promise.
    isInitializing = true;
    initializationPromise = new Promise(async (resolve, reject) => {
      console.log("Inicializando frame da API...");

      // Usa a função existente para obter a URL
      const apiUrl = getApiUrl();
      if (!apiUrl) {
          isInitializing = false; // Reseta o flag
          reject(new Error('URL da API não configurada para inicializar o frame.'));
          return;
      }

      // Cria o elemento iframe.
      apiFrame = document.createElement('iframe');
      apiFrame.style.display = 'none'; // Mantém o iframe oculto.
      apiFrame.src = apiUrl; // Usa a URL obtida

      // Define um timeout para a inicialização.
      const timeoutId = setTimeout(() => {
        isInitializing = false; // Reseta o flag
        reject(new Error('Timeout ao inicializar o frame da API (15s)'));
        window.removeEventListener('message', messageHandler);
        if (apiFrame && apiFrame.parentNode) {
          apiFrame.parentNode.removeChild(apiFrame);
          apiFrame = null;
        }
      }, 15000);

      // Função para tratar as mensagens recebidas.
      const messageHandler = (event) => {
        // **IMPORTANTE: Verificação de Origem**
        // Em produção, DESCOMENTE e AJUSTE a linha abaixo para segurança!
        // if (event.origin !== new URL(apiUrl).origin) return;

        // Se for a mensagem indicando que o iframe está pronto E veio do iframe esperado.
        if (event.data && event.data.status === 'ready' && event.source === apiFrame.contentWindow) {
          console.log("Frame da API está pronto!");
          clearTimeout(timeoutId);
          isInitializing = false; // Marca como concluído
          resolve();
          // Remove o listener APENAS para 'ready' após sucesso? Não, precisamos dele para as respostas.
          // window.removeEventListener('message', messageHandler); // NÃO REMOVA AQUI
        }
        // Se for uma resposta a uma requisição (sucesso ou erro).
        else if (event.data && (event.data.status === 'success' || event.data.status === 'error') && event.data.requestId) {
          const callback = pendingRequests[event.data.requestId];
          if (callback) {
            if (event.data.status === 'success') {
              callback.resolve(event.data.response);
            } else {
              // Tenta extrair uma mensagem de erro mais significativa
              let errorMsg = event.data.error || 'Erro desconhecido retornado pela API no iframe';
              if (typeof event.data.error === 'object' && event.data.error.message) {
                errorMsg = event.data.error.message;
              }
              callback.reject(new Error(String(errorMsg)));
            }
            delete pendingRequests[event.data.requestId];
          }
        }
      };

      // Adiciona o listener para ouvir mensagens DO IFRAME.
      window.addEventListener('message', messageHandler);

      // Adiciona o iframe ao corpo do documento para iniciar o carregamento.
      document.body.appendChild(apiFrame);
    }).catch(err => {
        // Garante que o estado seja resetado em caso de falha na inicialização
        isInitializing = false;
        apiFrame = null; // Limpa a referência ao frame
        initializationPromise = null;
        console.error("Falha final na inicialização do Iframe:", err);
        throw err; // Re-lança o erro para quem chamou initApiFrame
    });

    return initializationPromise;
  }
  // --- FIM: Função de inicialização do Iframe ---


  // --- SUBSTITUIÇÃO da função request ---
  /**
   * Fazer requisição para a API do Google Apps Script via Iframe Proxy.
   * Substitui a versão anterior que usava fetch.
   */
  async function request(action, data = {}) {
    const utils = window.Utils; // Obtém referência ao módulo de utilidades.
    try {
      utils?.showLoading?.(); // Mostra o indicador de loading, se disponível.

      // Garante que o iframe esteja inicializado antes de prosseguir.
      // initApiFrame agora retorna a Promise de inicialização.
      await initApiFrame();

      // Gera um ID único para esta requisição.
      const requestId = nextRequestId++;

      console.debug(`ApiClient (Iframe): Enviando ação '${action}' (ID: ${requestId})`);

      // Cria uma nova Promise para esta requisição específica.
      const result = await new Promise((resolve, reject) => {
        // Armazena as funções resolve e reject.
        pendingRequests[requestId] = { resolve, reject };

        // Obtém a URL da API novamente (pode ter mudado?) - ou usa a do iframe.src
        const apiUrl = apiFrame.src; // Usa a URL com a qual o iframe foi inicializado
        const targetOrigin = new URL(apiUrl).origin; // Define a origem esperada para segurança

        // Envia a mensagem para o iframe.
        // Usando targetOrigin em vez de '*' para segurança.
        apiFrame.contentWindow.postMessage({
          requestId: requestId,
          action: action,
          data: data
        }, targetOrigin);

        // Define um timeout específico para esta requisição (30s).
        setTimeout(() => {
          if (pendingRequests[requestId]) {
            console.error(`ApiClient (Iframe): Timeout na requisição ${action} (ID: ${requestId}) após 30s`);
            // Chama reject associado a esta requisição
            pendingRequests[requestId].reject(new Error(`Timeout na requisição ${action}`));
            delete pendingRequests[requestId]; // Remove da lista de pendentes.
          }
        }, 30000);
      });

      console.debug(`ApiClient (Iframe): Resposta recebida para ação '${action}' (ID: ${requestId})`);
      // A resposta (result) já foi processada (parseada, etc.) pelo código DENTRO do iframe
      // e veio através do 'messageHandler'. Assumimos que 'result' já é o dado final.

      // VERIFICAÇÃO ADICIONAL (Opcional, mas recomendado):
      // O código dentro do iframe DEVE garantir um formato consistente.
      // Ex: { success: true, data: ... } ou { success: false, message: ... }
      if (typeof result === 'object' && result !== null && result.success === false) {
         console.warn(`ApiClient (Iframe): Ação '${action}' (ID: ${requestId}) retornou success:false. Mensagem: ${result.message}`);
         throw new Error(result.message || `API (iframe) informou falha na ação ${action}`);
      }
      // Se o formato esperado for sempre { success: true, data: ... }, descomente:
      // if (typeof result !== 'object' || result === null || !result.success) {
      //    console.error(`ApiClient (Iframe): Resposta inesperada da API via iframe para '${action}'. Corpo:`, result);
      //    throw new Error(`Resposta inesperada ou falha na API (iframe) para ação ${action}`);
      // }
      // return result.data; // Retorna apenas os dados se o formato for { success: true, data: ... }

      return result; // Retorna o resultado como veio do iframe.

    } catch (error) {
      console.error(`ApiClient (Iframe): Erro na requisição para ação '${action}':`, error.message || error);

      // Chama a função de salvar offline definida NESTE módulo.
      // Não precisa de 'this' pois está no mesmo escopo léxico.
      saveOfflineRequest(action, data);

      // Re-lança o erro.
      throw error;

    } finally {
      // Garante que o indicador de loading seja escondido.
      utils?.hideLoading?.();
    }
  }
  // --- FIM: SUBSTITUIÇÃO da função request ---


  // --- Funções de ações específicas (NÃO PRECISAM MUDAR) ---
  // Elas continuam chamando 'request', que agora usa o iframe.
  async function salvarRegistro(registro) {
    if (!registro || !registro.id) throw new Error("Dados ou ID do registro inválidos para salvar.");
    // A validação da resposta agora é feita dentro do 'request' ou deve ser feita aqui
    // dependendo do formato retornado pelo iframe.
    return request('salvarRegistro', registro);
  }

  async function listarRegistros() {
    // A função 'request' agora retorna o resultado direto do iframe.
    // A validação do formato (ex: result.registros) deve ser feita aqui
    // ou garantida pelo código DENTRO do iframe.
    const result = await request('listarRegistros');
    // Exemplo: Se o iframe retorna { success: true, registros: [...] }
    if (result && result.success && Array.isArray(result.registros)) {
      return result.registros;
    }
    console.error("Resposta inválida ao listar registros (via iframe):", result);
    throw new Error(result?.message || 'Formato de resposta inválido ao listar registros (via iframe)');
  }

  async function obterRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido.");
    // Mesma lógica de validação da resposta que 'listarRegistros'
    const result = await request('obterRegistro', { id: id });
    // Exemplo: Se o iframe retorna { success: true, registro: {...} }
    if (result && result.success) {
       // Pode ser que a API retorne `null` se não encontrar, o que é sucesso.
       return result.registro !== undefined ? result.registro : null;
    }
    console.error("Resposta inválida ao obter registro (via iframe):", result);
    throw new Error(result?.message || `Falha ao obter registro ${id} (via iframe)`);
  }

  async function excluirRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para exclusão.");
    // Geralmente retorna algo como { success: true }
    return request('excluirRegistro', { id: id });
  }

  async function uploadImagem(photoObject) {
    // ... (lógica para preparar o payload permanece a mesma) ...
    if (!photoObject?.dataUrl || !photoObject?.name || !photoObject?.type || !photoObject?.registroId || !photoObject?.id) {
        console.error("Dados incompletos para uploadImagem:", photoObject);
        throw new Error("Dados da imagem incompletos para upload.");
    }
    const payload = {
        fileName: `${photoObject.registroId}_${photoObject.id}_${photoObject.name}`,
        mimeType: photoObject.type,
        // Enviar o base64 completo (incluindo o prefixo) pode ser necessário
        // dependendo de como o iframe ou o Apps Script o processa.
        // Ou manter como antes se o iframe/GAS espera só o base64 puro.
        content: photoObject.dataUrl, // Ou dataUrl.split(',')[1] se necessário
        registroId: photoObject.registroId,
        photoId: photoObject.id
    };
    // ATENÇÃO: Upload de arquivos grandes via postMessage pode ser lento ou falhar.
    // Talvez seja melhor manter o upload direto via fetch ou usar outra estratégia
    // apenas para uploads, se encontrar problemas de performance/tamanho.
    console.warn("ApiClient (Iframe): Upload de imagem via iframe pode ser lento/problemático para arquivos grandes.");
    return request('uploadImagem', payload);
  }


  // --- Lógica Offline (Funções saveOfflineRequest, clearOfflineRequests, syncOfflineRequests) ---
  // Permanecem praticamente as mesmas.
  // A função 'syncOfflineRequests' agora usará a nova função 'request' (baseada em iframe)
  // quando tentar reenviar as requisições salvas.

  function saveOfflineRequest(action, data) {
    const utils = window.Utils;
    // A lógica para não salvar uploads offline permanece
    if (action === 'uploadImagem') {
      console.warn(`ApiClient (Iframe): Upload da imagem falhou e NÃO será salvo offline.`);
      utils?.showNotification?.(`Falha no upload da imagem (iframe). Tente novamente com conexão.`, 'error');
      return;
    }
    if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage || !utils?.gerarId) {
      console.error("ApiClient (Iframe): Funções Utils não disponíveis para salvar requisição offline.");
      return;
    }
    console.log(`ApiClient (Iframe): Salvando requisição offline para ação '${action}'...`);
    try {
        const offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
        const requestId = `offline_${utils.gerarId()}`; // Adiciona prefixo para clareza
        offlineRequests.push({
          id: requestId,
          action,
          data,
          timestamp: new Date().toISOString(),
          retries: 0 // Adiciona contador de tentativas para sync
        });
        utils.salvarLocalStorage('offlineRequests', offlineRequests);
        console.log(`Requisição offline ID ${requestId} salva. Pendentes: ${offlineRequests.length}`);
        utils.showNotification?.(`Sem conexão ou erro. Ação (${action}) salva para tentar mais tarde.`, 'warning', 5000);
    } catch (e) {
        console.error("ApiClient (Iframe): Erro ao salvar requisição offline:", e);
        utils?.showNotification?.(`Erro ao salvar ação (${action}) offline.`, 'error');
    }
  }

  function clearOfflineRequests() {
    const utils = window.Utils;
    // ... (código idêntico ao anterior) ...
    if (!utils?.salvarLocalStorage) {
      console.error("ApiClient: Utils.salvarLocalStorage não disponível para limpar requisições offline.");
      return false;
    }
    try {
      utils.salvarLocalStorage('offlineRequests', []);
      console.log("ApiClient: Todas as requisições offline foram limpas.");
      utils.showNotification?.("Requisições offline limpas com sucesso.", "success", 3000);
      return true;
    } catch (e) {
      console.error("ApiClient: Erro ao limpar requisições offline:", e);
      return false;
    }
  }

  // A função syncOfflineRequests usará a nova 'request' automaticamente.
  // Poderíamos adicionar lógica de retries aqui.
  async function syncOfflineRequests() {
    const utils = window.Utils;
    const configSync = window.CONFIG?.SYNC || {}; // Usa configurações do config.js
    const batchSize = configSync.BATCH_SIZE || 3;
    const maxRetries = configSync.MAX_RETRIES || 3;

    // ... (lógica inicial para obter 'offlineRequests' e verificar conexão é a mesma) ...
    if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage) {
        console.error("ApiClient: Funções Utils não disponíveis para sincronizar requisições offline.");
        return { success: false, syncedCount: 0, errorCount: 0, pendingCount: 0, errors: [{ error: "Utils indisponível" }] };
    }
    let offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
    const totalPending = offlineRequests.length;
    if (totalPending === 0) {
        console.log("ApiClient.sync: Nenhuma requisição offline para sincronizar.");
        return { success: true, syncedCount: 0, errorCount: 0, pendingCount: 0, errors: [] };
    }
    if (!navigator.onLine) {
        console.log("ApiClient.sync: Sem conexão de rede. Sincronização adiada.");
        return { success: false, message: "Sem conexão", syncedCount: 0, errorCount: 0, pendingCount: totalPending, errors: [] };
    }

    const requestsToProcess = offlineRequests.slice(0, batchSize);
    const remainingForLater = offlineRequests.slice(batchSize);

    console.log(`ApiClient.sync: Tentando sincronizar ${requestsToProcess.length} de ${totalPending} requisições offline via Iframe...`);
    utils?.showNotification?.(`Sincronizando ${requestsToProcess.length} de ${totalPending} ações pendentes...`, 'info', 3000);

    let successCount = 0;
    const failedRequests = [];
    const errors = [];

    for (const req of requestsToProcess) {
      try {
        console.log(`ApiClient.sync: Enviando req offline ID ${req.id} (Ação: ${req.action}) via Iframe...`);
        // Chama a nova função request (que usa iframe)
        const result = await request(req.action, req.data);
        console.log(`ApiClient.sync: Requisição offline ID ${req.id} sincronizada com sucesso via Iframe.`);
        successCount++;
      } catch (error) {
        console.error(`ApiClient.sync: Erro ao sincronizar req ID ${req.id} via Iframe:`, error.message || error);
        req.retries = (req.retries || 0) + 1; // Incrementa tentativas
        if (req.retries < maxRetries) {
            failedRequests.push(req); // Mantém na lista para tentar depois
            console.log(`ApiClient.sync: Req ID ${req.id} falhou (${req.retries}/${maxRetries}), será tentada novamente.`);
        } else {
            console.error(`ApiClient.sync: Req ID ${req.id} falhou após ${maxRetries} tentativas e será descartada.`);
            errors.push({ requestId: req.id, action: req.action, error: `Máximo de ${maxRetries} tentativas atingido. Último erro: ${error.message || String(error)}` });
        }
      }
    }

    // Atualiza a lista de requisições pendentes
    const updatedOfflineRequests = [...failedRequests, ...remainingForLater];
    utils.salvarLocalStorage('offlineRequests', updatedOfflineRequests);

    const finalResult = {
        success: errors.length === 0 && failedRequests.length === 0, // Sucesso real só se nada falhou permanentemente ou temporariamente nesta rodada
        syncedCount: successCount,
        errorCount: errors.length, // Erros permanentes (descartados)
        failedTemporarily: failedRequests.length, // Falhas que serão retentadas
        pendingCount: updatedOfflineRequests.length,
        errors: errors
    };

    console.log(`ApiClient.sync: Sincronização (Iframe) parcial concluída. ${successCount} sucesso(s), ${errors.length} erro(s) permanentes, ${failedRequests.length} falhas temporárias. Pendentes: ${updatedOfflineRequests.length}.`);

    // Notificações (ajustadas)
    if (successCount > 0 && errors.length === 0 && failedRequests.length === 0) {
        utils?.showNotification?.(`${successCount} ações sincronizadas com sucesso!`, 'success', 3000);
    } else if (successCount > 0) {
         let msg = `${successCount} sincronizadas`;
         if (failedRequests.length > 0) msg += `, ${failedRequests.length} falharam temporariamente`;
         if (errors.length > 0) msg += `, ${errors.length} descartadas`;
         msg += `.`;
         utils?.showNotification?.(msg, 'warning', 5000);
    } else if (errors.length > 0 || failedRequests.length > 0) {
         let msg = `Falha ao sincronizar: ${failedRequests.length} temporárias, ${errors.length} descartadas.`;
         utils?.showNotification?.(msg, 'error', 5000);
    }

    return finalResult;
  }


  /**
   * Inicialização original do módulo (simples) - pode ser removida se não for usada.
   */
  function init() {
    console.log('ApiClient (Iframe) inicializado via ModuleLoader.');
    // Poderia chamar initApiFrame() aqui para pré-carregar o iframe, mas
    // a inicialização lazy (sob demanda) feita no 'request' é geralmente melhor.
  }


  console.log("ApiClient (Iframe): Retornando objeto do módulo para ModuleLoader.");

  // Expor as funções públicas do módulo
  return {
    init, // Mantido por compatibilidade, mas pode não ser necessário
    // Funções de Ação (usam o novo 'request' internamente)
    salvarRegistro,
    listarRegistros,
    obterRegistro,
    excluirRegistro,
    uploadImagem,
    // Funções Offline (usam Utils e o novo 'request' no sync)
    syncOfflineRequests,
    clearOfflineRequests,
    // Opcional: Expor a função request genérica se precisar dela diretamente
    // request: request,
    // Opcional: Expor a função de inicialização do frame se precisar controlá-la externamente
    // initApiFrame: initApiFrame
  };
});
