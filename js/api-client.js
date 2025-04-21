// ==========================================
// === CLIENT-SIDE JAVASCRIPT (api-client.js) ===
// ==========================================

/**
 * Cliente para comunicação com a API do Google Apps Script (Módulo)
 */
ModuleLoader.register('apiClient', function() {

  /**
   * Inicializar cliente da API (Verificação inicial)
   */
  function init() {
    console.log('ApiClient inicializado (pronto para fazer requisições).');
  }

  /**
   * Obtém a URL da API do Config global, com fallback para localStorage.
   * @returns {string|null} A URL da API ou null se não encontrada.
   */
  function getApiUrl() {
      let url = window.CONFIG?.API_URL;
      if (!url) {
          console.warn("API_URL não encontrada no CONFIG global, tentando localStorage...");
          url = window.Utils?.obterLocalStorage?.('API_URL');
      }
       if (!url) {
           console.error("API_URL não configurada no CONFIG nem no localStorage! Verifique config.js e o localStorage.");
           window.Utils?.showNotification?.("Erro crítico: URL da API não encontrada.", "error");
       }
      return url || null;
  }

  /**
   * Fazer requisição para a API do Google Apps Script (Função Central)
   * @param {string} action - A ação a ser executada no GAS (ex: 'listarRegistros').
   * @param {object} [data={}] - Dados a serem enviados no corpo da requisição POST.
   * @returns {Promise<object>} - A promessa com o resultado da API.
   * @throws {Error} - Lança erro em caso de falha na rede, erro HTTP ou falha no parse da resposta.
   */
  async function request(action, data = {}) {
    const effectiveApiUrl = getApiUrl();

    if (!effectiveApiUrl) {
      console.error(`ApiClient.request: Tentativa de requisição para '${action}' sem API_URL configurada.`);
      saveOfflineRequest(action, data);
      throw new Error('URL da API não configurada. Verifique as configurações.');
    }

    const utils = window.Utils;
    utils?.showLoading?.();

    // CORREÇÃO: Configuração melhorada da requisição Fetch
    const fetchOptions = {
        method: 'POST',
        credentials: 'omit',
        mode: 'cors', // Explicitamente define o modo CORS
        cache: 'no-cache', // Evita problemas de cache
        headers: {
          'Content-Type': 'application/json', // Crucial para o Google Apps Script
          'Accept': 'application/json', // Adiciona Accept header
          'X-Requested-With': 'XMLHttpRequest' // Ajuda em algumas configurações de servidor
        },
        body: JSON.stringify({ action: action, data: data })
    };

    try {
      // CORREÇÃO: Log detalhado para debug
      console.debug(`ApiClient: Enviando ação '${action}' para ${effectiveApiUrl}`);
      console.debug("Headers:", JSON.stringify(fetchOptions.headers));
      console.debug("Body:", fetchOptions.body);
      
      const response = await fetch(effectiveApiUrl, fetchOptions);

      // Processa a resposta
      let responseBodyText = await response.text();
      console.debug(`ApiClient: Resposta recebida (${response.status}): ${responseBodyText.substring(0, 200)}...`);
      
      let result = null;

      // Verifica se a resposta HTTP foi OK (status 200-299)
      if (!response.ok) {
        let errorMsg = `Erro na API: ${response.status} ${response.statusText}`;
        try {
            result = JSON.parse(responseBodyText);
            errorMsg = result?.message || result?.error || errorMsg;
        } catch (e) {
           console.warn(`ApiClient: Não foi possível parsear corpo da resposta de erro. Corpo: ${responseBodyText}`);
        }
        console.error(`ApiClient: Erro na resposta da API (${response.status}). Mensagem: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Tenta parsear a resposta de sucesso como JSON
      try {
         result = JSON.parse(responseBodyText);
      } catch (e) {
         console.error(`ApiClient: Falha GRAVE ao parsear resposta JSON. Corpo:`, responseBodyText, e);
         throw new Error(`Resposta inválida da API (não é JSON): ${responseBodyText.substring(0, 100)}...`);
      }

       // Verifica se a resposta da API indica sucesso lógico
       if (result && result.success === false) {
           console.warn(`ApiClient: API retornou success:false para ação '${action}'. Mensagem: ${result.message}`);
           throw new Error(result.message || `API informou falha na ação ${action}`);
       }

      console.debug(`ApiClient: Resposta de sucesso recebida para ação '${action}'.`);
      return result;

    } catch (error) {
      console.error(`ApiClient: Erro GERAL durante a requisição para ação '${action}':`, error.message || error);
      saveOfflineRequest(action, data);
      throw error;
    } finally {
      utils?.hideLoading?.();
    }
  }

  // Funções de ações específicas permanecem inalteradas
  async function salvarRegistro(registro) {
     if (!registro || !registro.id) throw new Error("Dados ou ID do registro inválidos para salvar.");
     return request('salvarRegistro', registro);
  }

  async function listarRegistros() {
     const result = await request('listarRegistros');
     if (result && result.success && Array.isArray(result.registros)) {
        return result.registros;
     }
     console.error("Resposta inválida ao listar registros:", result);
     throw new Error(result?.message || 'Formato de resposta inválido ao listar registros');
  }

  async function obterRegistro(id) {
     if (!id) throw new Error("ID do registro não fornecido.");
     const result = await request('obterRegistro', { id: id });
     if (result && result.success) {
        return result.registro || null;
     }
     console.error("Resposta inválida ao obter registro:", result);
     throw new Error(result?.message || `Falha ao obter registro ${id}`);
  }

  async function excluirRegistro(id) {
      if (!id) throw new Error("ID do registro não fornecido para exclusão.");
      return request('excluirRegistro', { id: id });
  }

  async function uploadImagem(photoObject) {
     if (!photoObject?.dataUrl || !photoObject?.name || !photoObject?.type || !photoObject?.registroId || !photoObject?.id) {
        console.error("Dados incompletos para uploadImagem:", photoObject);
        throw new Error("Dados da imagem incompletos para upload.");
     }
     const payload = {
        fileName: `${photoObject.registroId}_${photoObject.id}_${photoObject.name}`,
        mimeType: photoObject.type,
        content: photoObject.dataUrl.split(',')[1],
        registroId: photoObject.registroId,
        photoId: photoObject.id
     };
     return request('uploadImagem', payload);
  }

  // CORREÇÃO: Função para salvar requisições offline
  function saveOfflineRequest(action, data) {
     const utils = window.Utils;
     if (action === 'uploadImagem') {
        console.warn(`ApiClient: Upload da imagem falhou e NÃO será salvo offline.`);
        utils?.showNotification?.(`Falha no upload da imagem. Tente novamente com conexão.`, 'error');
        return;
     }
     if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage || !utils?.gerarId) {
        console.error("ApiClient: Funções Utils não disponíveis para salvar requisição offline.");
        return;
     }
     console.log(`ApiClient: Salvando requisição offline para ação '${action}'...`);
     try {
         const offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
         const requestId = utils.gerarId();
         offlineRequests.push({
           id: requestId,
           action,
           data,
           timestamp: new Date().toISOString()
         });
         utils.salvarLocalStorage('offlineRequests', offlineRequests);
         console.log(`Requisição offline ID ${requestId} salva. Pendentes: ${offlineRequests.length}`);
         utils.showNotification?.(`Sem conexão. Ação (${action}) salva para tentar mais tarde.`, 'warning', 5000);
     } catch (e) {
        console.error("ApiClient: Erro CRÍTICO ao tentar salvar requisição offline:", e);
        utils?.showNotification?.(`Erro ao salvar ação (${action}) offline.`, 'error');
     }
  }

  // CORREÇÃO: Função de sincronização melhorada
  async function syncOfflineRequests() {
     const utils = window.Utils;
     if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage) {
        console.error("ApiClient: Funções Utils não disponíveis para sincronizar requisições offline.");
        return { success: false, syncedCount: 0, errorCount: 0, pendingCount: 0, errors: [{ error: "Utils indisponível" }] };
     }

     const offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
     const totalPending = offlineRequests.length;
     if (totalPending === 0) {
       console.log("ApiClient.sync: Nenhuma requisição offline para sincronizar.");
       return { success: true, syncedCount: 0, errorCount: 0, pendingCount: 0, errors: [] };
     }

     if (!navigator.onLine) {
         console.log("ApiClient.sync: Sem conexão de rede. Sincronização offline adiada.");
         return { success: false, message: "Sem conexão", syncedCount: 0, errorCount: 0, pendingCount: totalPending, errors: [] };
     }

     // CORREÇÃO: Limitar o número de requisições por vez
     const batchSize = 5; // Processa apenas 5 de cada vez para evitar sobrecarga
     const requestsToProcess = offlineRequests.slice(0, batchSize);
     const remainingForLater = offlineRequests.slice(batchSize);

     console.log(`ApiClient.sync: Tentando sincronizar ${requestsToProcess.length} de ${totalPending} requisições offline...`);
     utils?.showNotification?.(`Sincronizando ${requestsToProcess.length} de ${totalPending} ações pendentes...`, 'info', 3000);

     let successCount = 0;
     const failedRequests = [];
     const errors = [];

     // Processa uma a uma para não sobrecarregar o servidor
     for (const req of requestsToProcess) {
        try {
          console.log(`ApiClient.sync: Enviando req offline ID ${req.id} (Ação: ${req.action})...`);
          const result = await request(req.action, req.data);
          console.log(`ApiClient.sync: Requisição offline ID ${req.id} sincronizada com sucesso.`);
          successCount++;
        } catch (error) {
          console.error(`ApiClient.sync: Erro ao sincronizar req ID ${req.id}:`, error.message || error);
          failedRequests.push(req);
          errors.push({ requestId: req.id, action: req.action, error: error.message || String(error) });
        }
     }

     // Atualiza a lista de requisições pendentes no localStorage
     const updatedOfflineRequests = [...failedRequests, ...remainingForLater];
     utils.salvarLocalStorage('offlineRequests', updatedOfflineRequests);

     const finalResult = {
       success: errors.length === 0,
       syncedCount: successCount,
       errorCount: errors.length,
       pendingCount: updatedOfflineRequests.length,
       errors: errors
     };

     console.log(`ApiClient.sync: Sincronização parcial concluída. ${successCount} sucesso(s), ${errors.length} erro(s). Pendentes: ${updatedOfflineRequests.length}.`);

     if (finalResult.success && successCount > 0) {
         utils?.showNotification?.(`${successCount} ações sincronizadas com sucesso!`, 'success', 3000);
     } else if (successCount > 0) {
          utils?.showNotification?.(`${successCount} sincronizadas, ${errors.length} falharam. Restantes: ${updatedOfflineRequests.length}.`, 'warning', 5000);
     } else if (errors.length > 0) {
          utils?.showNotification?.(`Falha ao sincronizar ${errors.length} ações pendentes. Tentaremos novamente mais tarde.`, 'error', 5000);
     }

     return finalResult;
  }

  console.log("ApiClient: Retornando objeto do módulo para ModuleLoader.");

  // Expor as funções do módulo
  return {
    init,
    salvarRegistro,
    listarRegistros,
    obterRegistro,
    excluirRegistro,
    uploadImagem,
    syncOfflineRequests
  };
});
