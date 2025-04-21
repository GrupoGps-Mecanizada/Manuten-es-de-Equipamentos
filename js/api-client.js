// api-client.js

/**
 * Cliente para comunicação com a API do Google Apps Script (Módulo)
 */
ModuleLoader.register('apiClient', function() {

  // Não define apiUrl aqui fora. Será obtido quando necessário.

  /**
   * Inicializar cliente da API (Verificação inicial)
   */
  function init() {
    // Apenas loga, a URL será verificada em cada request.
    console.log('ApiClient inicializado (pronto para fazer requisições).');
    // Poderia fazer uma chamada de 'ping' para a API aqui para testar a conexão, se desejado.
  }

  /**
   * Obtém a URL da API do Config global, com fallback para localStorage.
   * @returns {string|null} A URL da API ou null se não encontrada.
   */
  function getApiUrl() {
      let url = window.CONFIG?.API_URL;
      if (!url) {
          console.warn("API_URL não encontrada no CONFIG, tentando localStorage...");
          url = window.Utils?.obterLocalStorage?.('API_URL'); // Usa Utils para obter do localStorage
      }
       if (!url) {
           console.error("API_URL não configurada no CONFIG nem no localStorage!");
       }
      return url || null; // Retorna a URL ou null
  }

  /**
   * Fazer requisição para a API do Google Apps Script
   */
  async function request(action, data = {}) {
    const effectiveApiUrl = getApiUrl(); // Obtém a URL no momento da requisição

    if (!effectiveApiUrl) {
      // Se ainda não tem URL, salva offline e lança erro.
      console.error(`ApiClient.request: Tentativa de requisição para '${action}' sem API_URL configurada.`);
      saveOfflineRequest(action, data); // Tenta salvar offline
      throw new Error('URL da API não configurada');
    }

    // Usa Utils se disponível
    const utils = window.Utils;
    utils?.showLoading?.(); // Mostra loading

    try {
      console.debug(`ApiClient: Enviando ação '${action}' para ${effectiveApiUrl}`);
      const response = await fetch(effectiveApiUrl, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Melhor para Apps Script evitar CORS preflight
        },
        body: JSON.stringify({ action: action, data: data })
      });

      // Processa a resposta
      let responseBodyText = await response.text(); // Lê como texto primeiro
      let result = null;

      if (!response.ok) {
        let errorMsg = `Erro na API: ${response.status} ${response.statusText}`;
        try {
            // Tenta parsear como JSON para mensagens de erro estruturadas
            result = JSON.parse(responseBodyText);
            errorMsg = result?.message || result?.error || errorMsg;
        } catch (e) { /* Ignora erro de parse, usa texto original */ }
        console.error(`ApiClient: Erro na resposta da API (${response.status}). Corpo:`, responseBodyText);
        throw new Error(errorMsg); // Lança erro com a mensagem da API ou status
      }

      // Tenta parsear a resposta de sucesso como JSON
      try {
         result = JSON.parse(responseBodyText);
      } catch (e) {
         console.error(`ApiClient: Falha ao parsear resposta JSON da API para ação '${action}'. Corpo:`, responseBodyText, e);
         throw new Error(`Resposta inválida da API (não é JSON): ${responseBodyText.substring(0, 100)}...`);
      }

      console.debug(`ApiClient: Resposta recebida para ação '${action}':`, result);
      return result;

    } catch (error) {
      console.error(`ApiClient: Erro durante a requisição para ação '${action}':`, error);
      saveOfflineRequest(action, data); // Tenta salvar offline em CATCH
      throw error; // Propaga o erro
    } finally {
      utils?.hideLoading?.(); // Esconde loading
    }
  }

  // --- Funções de Ações Específicas (salvarRegistro, listarRegistros, etc.) ---
  // Essas funções agora simplesmente chamam 'request' e tratam o resultado
  // ou deixam o erro ser propagado para a camada superior (App/FormHandler) tratar.

  async function salvarRegistro(registro) {
     // A lógica de fallback/cache é melhor tratada no FormHandler/App
     return request('salvarRegistro', registro);
  }

  async function listarRegistros() {
     // O fallback para cache é feito no App.refreshRegistrosList
     const result = await request('listarRegistros');
     if (result && result.success && Array.isArray(result.registros)) {
        return result.registros;
     }
     // Se success for false ou 'registros' não for array, lança erro
     throw new Error(result?.message || 'Resposta inválida ao listar registros');
  }

  async function obterRegistro(id) {
     if (!id) throw new Error("ID do registro não fornecido.");
     // O fallback é feito no FormHandler.getRegistroData
     const result = await request('obterRegistro', { id: id });
     if (result && result.success && result.registro) {
        return result.registro;
     }
     if (result && !result.registro) return null; // Não encontrado pela API
     throw new Error(result?.message || `Registro ${id} não encontrado ou resposta inválida`);
  }

  async function excluirRegistro(id) {
      if (!id) throw new Error("ID do registro não fornecido para exclusão.");
      // Exclusão offline não é tratada aqui por padrão
      return request('excluirRegistro', { id: id });
  }

  async function uploadImagem(photoObject) {
     if (!photoObject?.dataUrl || !photoObject?.name || !photoObject?.type || !photoObject?.registroId || !photoObject?.id) {
        throw new Error("Dados da imagem incompletos para upload.");
     }
     const payload = {
        fileName: `${photoObject.registroId}_${photoObject.id}_${photoObject.name}`,
        mimeType: photoObject.type,
        content: photoObject.dataUrl.split(',')[1],
        registroId: photoObject.registroId,
        photoId: photoObject.id
     };
     // Não salva upload offline por padrão
     return request('uploadImagem', payload);
  }

  // --- Funções Offline ---

  function saveOfflineRequest(action, data) {
     const utils = window.Utils;
     if (action === 'uploadImagem') {
        console.warn(`ApiClient: Upload da imagem para ação '${action}' falhou e NÃO será salvo offline.`);
        return;
     }
     if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage || !utils?.gerarId) {
        console.error("ApiClient: Funções Utils (salvar/obterLocalStorage, gerarId) não disponíveis para salvar requisição offline.");
        return;
     }
     console.log(`ApiClient: Salvando requisição offline para ação '${action}'...`);
     try {
         const offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
         offlineRequests.push({
           action,
           data,
           timestamp: new Date().toISOString(),
           id: utils.gerarId() // Usa Utils para gerar ID
         });
         utils.salvarLocalStorage('offlineRequests', offlineRequests); // Usa Utils para salvar
         console.log(`Requisição offline salva. Pendentes: ${offlineRequests.length}`);
         utils.showNotification?.(`Ação (${action}) falhou. Salva para tentar mais tarde.`, 'warning', 5000);
     } catch (e) {
        console.error("ApiClient: Erro ao tentar salvar requisição offline:", e);
     }
  }

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

     console.log(`ApiClient.sync: Tentando sincronizar ${totalPending} requisições offline...`);
     let successCount = 0;
     const remainingRequests = [];
     const errors = [];

     // Processa UMA por UMA em sequência para evitar sobrecarregar a API
     for (const req of offlineRequests) {
       // Verifica conectividade ANTES de cada tentativa
       if (!navigator.onLine) {
          console.log("ApiClient.sync: Conexão perdida durante sincronização. Adicionando requisição de volta à fila.");
          remainingRequests.push(req); // Adiciona de volta e continua para as próximas (que também falharão)
          continue; // Pula para a próxima requisição
       }
       try {
         console.log(`ApiClient.sync: Enviando req offline ID ${req.id} (Ação: ${req.action})...`);
         // Chama request diretamente, sem usar as funções específicas (salvarRegistro, etc.)
         // A função request NÃO salvará offline novamente se falhar durante a sincronização.
         await request(req.action, req.data);
         console.log(`ApiClient.sync: Requisição offline ID ${req.id} sincronizada com sucesso.`);
         successCount++;
       } catch (error) {
         console.error(`ApiClient.sync: Erro ao sincronizar req offline ID ${req.id} (Ação: ${req.action}):`, error);
         remainingRequests.push(req); // Mantém na lista se falhou
         errors.push({ requestId: req.id, action: req.action, error: error.message || String(error) });
       }
     }

     // Atualiza a lista de requisições pendentes
     utils.salvarLocalStorage('offlineRequests', remainingRequests);

     const result = {
       success: errors.length === 0, // Sucesso geral apenas se nenhum erro ocorreu
       syncedCount: successCount,
       errorCount: errors.length,
       pendingCount: remainingRequests.length,
       errors: errors // Array com detalhes dos erros
     };

     console.log(`ApiClient.sync: Sincronização concluída. ${successCount} sucesso(s), ${errors.length} erro(s). Pendentes: ${remainingRequests.length}.`);
     return result;
  }

  // Adiciona log antes de retornar o objeto do módulo
  console.log("ApiClient: Retornando objeto do módulo para ModuleLoader.");

  // Expõe as funções públicas do módulo
  return {
    init,
    // request, // Não precisa expor request diretamente se usar as funções específicas
    salvarRegistro,
    listarRegistros,
    obterRegistro,
    excluirRegistro,
    uploadImagem,
    syncOfflineRequests
  };

}); // Fim do ModuleLoader.register
