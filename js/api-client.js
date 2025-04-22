// ==================================================
// === CLIENT-SIDE JAVASCRIPT (api-client.js) ===
// === VERSÃO USANDO FETCH DIRETO (SEM IFRAME) ===
// ==================================================

/**
 * Cliente para comunicação com a API do Google Apps Script (Módulo)
 * Usa fetch() para chamadas diretas ao Web App publicado.
 */
ModuleLoader.register('apiClient', function() {

  /**
   * Obtém a URL da API do Config global. Essencial para fetch.
   */
  function getApiUrl() {
      const url = window.CONFIG?.API_URL;
      if (!url) {
          console.error("ApiClient (Fetch): API_URL não configurada no CONFIG!");
          window.Utils?.showNotification?.("Erro crítico: URL da API não encontrada.", "error");
          return null;
      }
      // Validação básica da URL
      try {
          new URL(url);
      } catch (e) {
           console.error(`ApiClient (Fetch): API_URL inválida: "${url}"`, e);
           window.Utils?.showNotification?.(`Erro: URL da API inválida: ${url}`, "error");
           return null;
      }
      return url;
  }

  /**
   * Envia uma requisição para a API usando fetch.
   * @param {string} action - O nome da ação/função a ser executada na API.
   * @param {object} [data={}] - Os dados a serem enviados com a requisição.
   * @returns {Promise<any>} Uma Promise que resolve com a resposta da API ou rejeita em caso de erro.
   */
  async function request(action, data = {}) {
    const utils = window.Utils;
    const apiUrl = getApiUrl();

    if (!apiUrl) {
      // Se não tem URL, tenta salvar offline imediatamente
      if (typeof saveOfflineRequest === 'function') {
        saveOfflineRequest(action, data);
      }
      throw new Error("URL da API não configurada.");
    }

    // Mostra loading, se disponível
    utils?.showLoading?.(`Processando ${action}...`);

    // Monta o payload que será enviado no corpo da requisição POST
    const payload = {
      action: action,
      data: data
    };

    const requestOptions = {
      method: 'POST',
      // mode: 'cors', // Apps Script geralmente lida com CORS, mas pode ser necessário ajustar
      // cache: 'no-cache', // Para evitar cache em requisições POST
      // redirect: 'follow', // Seguir redirecionamentos
      // referrerPolicy: 'no-referrer', // Política de referência
      headers: {
        // Indica que estamos enviando JSON. Essencial para o e.postData.contents no Apps Script.
        'Content-Type': 'application/json',
        // IMPORTANTE: Para evitar que o Apps Script tente interpretar como formulário,
        // enviamos um header text/plain que ele ignora, forçando a leitura do postData.contents
        // Veja: https://developers.google.com/apps-script/guides/web#request_parameters
         'Accept': 'application/json' // Indica que esperamos JSON de volta
      },
      body: JSON.stringify(payload) // Converte o payload para string JSON
    };

    try {
      console.debug(`ApiClient (Fetch): Enviando ação '${action}' para ${apiUrl}`);
      const response = await fetch(apiUrl, requestOptions);

      // Verifica se a resposta HTTP foi bem-sucedida (status 2xx)
      if (!response.ok) {
        // Tenta ler uma mensagem de erro do corpo, se houver
        let errorBody = await response.text(); // Lê como texto primeiro
        let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        try {
            // Tenta parsear como JSON, pode conter mais detalhes do Apps Script
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.message || errorMessage;
        } catch (e) {
             // Se não for JSON, usa o texto como parte do erro (limitado)
             if(errorBody && errorBody.length < 200) errorMessage += ` - ${errorBody}`;
        }
        console.error(`ApiClient (Fetch): Falha na requisição para ${action}. Status: ${response.status}. Mensagem: ${errorMessage}`);
        throw new Error(errorMessage); // Lança erro com a mensagem
      }

      // Se a resposta foi OK, tenta parsear o corpo como JSON
      const result = await response.json();
      console.debug(`ApiClient (Fetch): Resposta recebida com sucesso para ação '${action}'`, result);

      // Verifica se o Apps Script retornou um erro lógico interno
      if (result && result.success === false) {
          console.warn(`ApiClient (Fetch): Ação '${action}' retornou erro lógico do servidor:`, result.message);
          throw new Error(result.message || `Erro na execução da ação ${action} no servidor.`);
      }

      utils?.hideLoading?.(); // Esconde loading no sucesso
      return result; // Retorna o resultado parseado

    } catch (error) {
      // Captura erros de rede (fetch falhou) ou erros lançados acima
      console.error(`ApiClient (Fetch): Erro na requisição para ação '${action}':`, error.message || error);
      // Tenta salvar offline se a função existir
      if (typeof saveOfflineRequest === 'function') {
          saveOfflineRequest(action, data);
      }
      utils?.hideLoading?.(); // Garante esconder loading no erro
      throw error; // Propaga o erro
    }
  }


  // ========= Funções de Ações Específicas (usam a nova função 'request') =========
  // Nenhuma alteração necessária aqui, pois elas já chamavam 'request'

  async function salvarRegistro(registro) {
    if (!registro || !registro.id) {
        console.error("ApiClient.salvarRegistro: Dados ou ID inválidos.", registro);
        throw new Error("Dados ou ID do registro inválidos para salvar.");
    }
    return request('salvarRegistro', registro);
  }

  async function listarRegistros() {
    const result = await request('listarRegistros');
    // A função 'request' já trata erros HTTP e JSON.
    // Precisamos apenas validar a estrutura esperada.
    if (result && result.success === true && Array.isArray(result.registros)) {
      return result.registros;
    }
    console.error("ApiClient.listarRegistros: Resposta inesperada da API:", result);
    throw new Error(result?.message || 'Formato de resposta inválido ao listar registros.');
  }

  async function obterRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para obterRegistro.");
    const result = await request('obterRegistro', { id: id });
    if (result && result.success === true) {
       return result.registro !== undefined ? result.registro : null;
    }
    console.error("ApiClient.obterRegistro: Resposta inesperada da API:", result);
    throw new Error(result?.message || `Falha ao obter registro ${id}.`);
  }

  async function excluirRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido para exclusão.");
    return request('excluirRegistro', { id: id });
  }

  async function uploadImagem(photoObject) {
    // Validação
    if (!photoObject?.dataUrl || !photoObject?.name || !photoObject?.type || !photoObject?.registroId || !photoObject?.id) {
      console.error("ApiClient.uploadImagem: Dados da imagem incompletos.", photoObject);
      throw new Error("Dados da imagem incompletos para upload.");
    }
    // Payload
    const payload = {
      fileName: `${photoObject.registroId}_${photoObject.id}_${photoObject.name}`,
      mimeType: photoObject.type,
      // IMPORTANTE: Envie apenas o base64, sem o prefixo 'data:image/png;base64,'
      content: photoObject.dataUrl.includes(',') ? photoObject.dataUrl.split(',')[1] : photoObject.dataUrl,
      registroId: photoObject.registroId,
      photoId: photoObject.id
    };
    console.log("ApiClient (Fetch): Enviando uploadImagem..."); // Menos warning que com iframe
    return request('uploadImagem', payload);
  }

  async function ping() {
    console.log("ApiClient (Fetch): Chamando ação 'ping'");
    return request('ping');
  }

  // ========= Lógica Offline (sem alterações) =========
  // A lógica para salvar e sincronizar requisições offline permanece a mesma,
  // pois ela intercepta os erros da função 'request' antes de serem propagados.

  function saveOfflineRequest(action, data) {
    const utils = window.Utils;
    if (action === 'uploadImagem') {
      console.warn(`ApiClient (Fetch): Upload da imagem (${data?.fileName}) falhou e NÃO será salvo offline.`);
      utils?.showNotification?.(`Falha no upload da imagem. Tente novamente com conexão.`, 'error', 6000);
      return;
    }
    if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage || !utils?.gerarId) {
      console.error("ApiClient (Fetch): Funções Utils não disponíveis para salvar requisição offline.");
      return;
    }
    console.log(`ApiClient (Fetch): Salvando requisição offline para ação '${action}'...`);
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
        console.error("ApiClient (Fetch): Erro ao salvar requisição offline:", e);
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
      console.log(`ApiClient.sync (Fetch): Tentando sincronizar ${requestsToProcess.length} de ${totalPendingInitial}...`);

      let successCount = 0;
      const failedRequestsToKeep = [];
      const errorsPermanent = [];

      for (const req of requestsToProcess) {
        try {
          console.log(`ApiClient.sync: Enviando req offline ID ${req.id} (Ação: ${req.action})...`);
          // Tenta reenviar usando a função 'request' (que agora usa fetch)
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
    console.log('ApiClient (Fetch) inicializado via ModuleLoader.');
    // Nenhuma inicialização de iframe necessária aqui.
  }

  // --- Objeto Retornado pelo Módulo ---
  console.log("ApiClient (Fetch): Retornando interface pública do módulo.");
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
    // request: request, // Pode expor a função request genérica se útil
  };

}); // Fim do ModuleLoader.register
