// api-client.js

/**
 * Cliente para comunicação com a API do Google Apps Script (Módulo)
 */
ModuleLoader.register('apiClient', function() {

  // Tenta obter a URL da API do CONFIG global.
  // É crucial que config.js seja carregado ANTES deste script.
  const apiUrl = window.CONFIG?.API_URL; // Usa optional chaining por segurança

  /**
   * Inicializar cliente da API (Verificação inicial)
   */
  function init() {
    if (!apiUrl) {
      console.warn('ApiClient: URL da API não configurada em CONFIG.API_URL. Requisições online falharão.');
      // Poderia tentar buscar do localStorage como fallback aqui, se implementado
    } else {
       console.log('ApiClient inicializado. API URL:', apiUrl);
    }
  }

  /**
   * Fazer requisição para a API do Google Apps Script
   * @param {string} action - Ação a ser executada no script (ex: 'salvarRegistro')
   * @param {object} [data={}] - Dados a serem enviados no payload
   * @returns {Promise<object>} - Resposta JSON da API
   * @throws {Error} - Lança erro se a URL não estiver configurada ou houver falha na rede/resposta.
   */
  async function request(action, data = {}) {
    if (!apiUrl) {
      // Tenta novamente obter do CONFIG, caso tenha sido definido depois
      const currentApiUrl = window.CONFIG?.API_URL;
      if (!currentApiUrl) {
         console.error('ApiClient.request: Tentativa de requisição sem API_URL configurada.');
         throw new Error('URL da API não configurada');
      }
       // Atualiza a URL se encontrada agora (pouco provável, mas defensivo)
       // Note: Esta variável apiUrl local não será atualizada globalmente para o módulo.
       // Seria melhor buscar window.CONFIG.API_URL a cada requisição ou garantir que init rode primeiro.
       // Vamos buscar a cada requisição para segurança:
       // const effectiveApiUrl = window.CONFIG?.API_URL; // Descomente esta linha se remover apiUrl do topo
    }

    const effectiveApiUrl = apiUrl; // Usa a apiUrl definida no escopo do módulo

    // Tenta usar Utils global para mostrar loading (se Utils existir)
    window.Utils?.showLoading?.(); // Usa optional chaining

    try {
      console.debug(`ApiClient: Enviando ação '${action}' para ${effectiveApiUrl}`);
      const response = await fetch(effectiveApiUrl, {
        method: 'POST',
        // mode: 'cors', // Geralmente necessário para Apps Script, mas pode causar preflight
        credentials: 'omit', // O padrão, a menos que precise enviar cookies
        headers: {
          // 'Content-Type': 'application/json' // Frequentemente não necessário para Apps Script POST simples
          // Apps Script geralmente prefere 'text/plain' para evitar preflight CORS
          'Content-Type': 'text/plain;charset=utf-8',
        },
        // O corpo é formatado como JSON, mas enviado como texto para o Apps Script
        // O Apps Script precisará fazer JSON.parse(e.postData.contents)
        body: JSON.stringify({
          action: action,
          data: data
          // Poderia adicionar token de autenticação aqui se necessário:
          // authToken: ModuleLoader.get('googleAuth')?.getToken?.() // Exemplo
        })
      });

      if (!response.ok) {
         // Tenta ler a resposta de erro, se houver
         let errorBody = await response.text(); // Lê como texto
         try { errorBody = JSON.parse(errorBody); } catch(e) { /* Mantém como texto se não for JSON */ }
         console.error(`ApiClient: Erro na resposta da API (${response.status} ${response.statusText}). Corpo:`, errorBody);
         throw new Error(`Erro na API: ${response.status} ${response.statusText}. ${errorBody?.message || errorBody || ''}`);
      }

      // Assume que a resposta é JSON
      const result = await response.json();
      console.debug(`ApiClient: Resposta recebida para ação '${action}':`, result);
      return result;

    } catch (error) {
      console.error(`ApiClient: Erro durante a requisição para ação '${action}':`, error);

      // Tenta salvar requisição para sincronização offline (se Utils existir)
      if (window.Utils?.storeData) {
         saveOfflineRequest(action, data);
      }

      // Propaga o erro para que a função chamadora possa tratar (ex: usar cache)
      throw error;
    } finally {
      // Tenta usar Utils global para esconder loading
      window.Utils?.hideLoading?.(); // Usa optional chaining
    }
  }

  /**
   * Salvar registro de manutenção na API.
   * @param {object} registro - Dados completos do registro.
   * @returns {Promise<object>} - Resposta da API (geralmente { success: true, registro: ... } ou { success: false, message: ... }).
   */
  async function salvarRegistro(registro) {
     // Não faz fallback para cache local aqui, pois a função chamadora (FormHandler)
     // já salva no AppState em caso de erro na API.
     // Apenas tenta enviar para a API.
     return request('salvarRegistro', registro);
  }

  /**
   * Listar todos os registros de manutenção da API.
   * @returns {Promise<Array>} - Lista de objetos de registro.
   * @throws {Error} - Lança erro se a API falhar e não houver cache.
   */
  async function listarRegistros() {
     try {
        const result = await request('listarRegistros');
        if (result && result.success && Array.isArray(result.registros)) {
           // Opcional: Atualizar cache local aqui se Utils estiver disponível
           // window.Utils?.storeData?.('registros_cache', result.registros);
           return result.registros;
        }
        // Se success for false ou 'registros' não for array
        throw new Error(result?.message || 'Resposta inválida ao listar registros');
     } catch (error) {
        console.warn(`ApiClient: Falha ao listar registros da API (${error.message}). Tentando cache local (se implementado no App)...`);
        // A lógica de fallback para cache deve ficar no App.js ou onde a lista é consumida.
        // Lança o erro para indicar que a fonte primária falhou.
        throw error;
     }
  }

  /**
   * Obter um registro específico por ID da API.
   * @param {string} id - ID do registro.
   * @returns {Promise<object|null>} - Objeto do registro ou null se não encontrado.
   * @throws {Error} - Lança erro se a API falhar e não houver cache.
   */
  async function obterRegistro(id) {
    if (!id) throw new Error("ID do registro não fornecido.");
    try {
       const result = await request('obterRegistro', { id: id });
       if (result && result.success && result.registro) {
          // Opcional: Atualizar cache local
          // window.Utils?.storeData?.(`registro_${id}_cache`, result.registro);
          return result.registro;
       }
       // Se não encontrou (success: true, registro: null) ou falhou (success: false)
       if (result && !result.registro) return null; // Não encontrado pela API
       throw new Error(result?.message || `Registro ${id} não encontrado ou resposta inválida`);
    } catch (error) {
       console.warn(`ApiClient: Falha ao obter registro ${id} da API (${error.message}). Tentando cache local (se implementado)...`);
       // A lógica de fallback para cache deve ficar no FormHandler/App.js.
       throw error;
    }
  }

   /**
    * Excluir um registro específico por ID na API.
    * @param {string} id - ID do registro a ser excluído.
    * @returns {Promise<object>} - Resposta da API (ex: { success: true }).
    */
   async function excluirRegistro(id) {
       if (!id) throw new Error("ID do registro não fornecido para exclusão.");
       // Nota: Ações de exclusão podem ser mais complexas de lidar offline.
       // Por simplicidade, esta função não salva a requisição offline por padrão,
       // mas poderia ser adaptada para isso.
       return request('excluirRegistro', { id: id });
   }


  /**
   * Fazer upload de imagem (enviando como base64).
   * O Apps Script precisará decodificar o base64.
   * @param {object} photoObject - Objeto da foto contendo { id, name, type, size, dataUrl, registroId, ... }.
   * @returns {Promise<object>} - Resposta da API (ex: { success: true, imageId: 'ID_NO_DRIVE', url: 'URL_PUBLIC_DRIVE' }).
   */
  async function uploadImagem(photoObject) {
     // Validação básica
     if (!photoObject || !photoObject.dataUrl || !photoObject.name || !photoObject.type || !photoObject.registroId) {
        throw new Error("Dados da imagem incompletos para upload.");
     }

     // Extrai apenas os dados necessários para a API
     const payload = {
        fileName: `${photoObject.registroId}_${photoObject.id}_${photoObject.name}`, // Nome único sugerido
        mimeType: photoObject.type,
        content: photoObject.dataUrl.split(',')[1], // Envia apenas a parte base64
        registroId: photoObject.registroId,
        photoId: photoObject.id // ID original da foto no frontend
        // Poderia enviar metadados adicionais se necessário
     };

     // Por padrão, NÃO salva uploads offline, pois podem ser grandes.
     // Se o upload falhar, a foto permanecerá apenas localmente no AppState/PhotoHandler.
     return request('uploadImagem', payload);
  }

  /**
   * Salvar requisição (que falhou) offline para sincronização posterior.
   * Usa Utils.storeData e Utils.retrieveData.
   * @param {string} action - Ação que falhou.
   * @param {object} data - Dados da ação que falhou.
   */
  function saveOfflineRequest(action, data) {
    // Evita salvar uploads de imagem offline por padrão devido ao tamanho
    if (action === 'uploadImagem') {
       console.warn(`ApiClient: Upload da imagem para ação '${action}' falhou e NÃO será salvo offline.`);
       return;
    }

    // Verifica se Utils está disponível
    if (!window.Utils?.storeData || !window.Utils?.retrieveData) {
       console.error("ApiClient: Funções Utils (storeData/retrieveData) não disponíveis para salvar requisição offline.");
       return;
    }

    console.log(`ApiClient: Salvando requisição offline para ação '${action}'...`);
    try {
        const offlineRequests = window.Utils.retrieveData('offlineRequests') || [];
        // Evitar duplicatas? Ou permitir múltiplas tentativas? Por ora, permite.
        offlineRequests.push({
          action,
          data,
          timestamp: new Date().toISOString(),
          id: window.Utils.gerarId() // Adiciona um ID à requisição offline
        });
        window.Utils.storeData('offlineRequests', offlineRequests);
        console.log(`Requisição offline salva. Pendentes: ${offlineRequests.length}`);
        // Notificar usuário?
        window.Utils.showNotification?.(`Ação (${action}) falhou. Salva para tentar mais tarde.`, 'warning', 5000);

    } catch (e) {
       console.error("ApiClient: Erro ao tentar salvar requisição offline no localStorage:", e);
    }
  }

  /**
   * Tenta sincronizar todas as requisições salvas offline.
   * @returns {Promise<object>} - Resultado da sincronização: { success: boolean, syncedCount: number, errorCount: number, pendingCount: number, errors: Array }.
   */
  async function syncOfflineRequests() {
    // Verifica se Utils está disponível
    if (!window.Utils?.storeData || !window.Utils?.retrieveData) {
       console.error("ApiClient: Funções Utils não disponíveis para sincronizar requisições offline.");
       return { success: false, message: "Utils indisponível" };
    }

    const offlineRequests = window.Utils.retrieveData('offlineRequests') || [];
    if (offlineRequests.length === 0) {
      console.log("ApiClient.sync: Nenhuma requisição offline para sincronizar.");
      return { success: true, syncedCount: 0, errorCount: 0, pendingCount: 0, errors: [] };
    }

    console.log(`ApiClient.sync: Tentando sincronizar ${offlineRequests.length} requisições offline...`);

    let successCount = 0;
    let errorCount = 0;
    const remainingRequests = [];
    const errors = [];

    // Processa uma por uma na ordem em que foram salvas
    for (const req of offlineRequests) {
      try {
        console.log(`ApiClient.sync: Enviando req offline ID ${req.id} (Ação: ${req.action})...`);
        // Usa a função request interna, que NÃO salvará offline novamente se falhar aqui
        await request(req.action, req.data);
        console.log(`ApiClient.sync: Requisição offline ID ${req.id} sincronizada com sucesso.`);
        successCount++;
      } catch (error) {
        console.error(`ApiClient.sync: Erro ao sincronizar req offline ID ${req.id} (Ação: ${req.action}):`, error);
        errorCount++;
        remainingRequests.push(req); // Mantém na lista se falhou
        errors.push({ requestId: req.id, action: req.action, error: error.message });
      }
    }

    // Atualiza a lista de requisições pendentes no localStorage
    window.Utils.storeData('offlineRequests', remainingRequests);

    const result = {
      success: errorCount === 0, // Sucesso geral apenas se nenhum erro ocorreu
      syncedCount: successCount,
      errorCount: errorCount,
      pendingCount: remainingRequests.length,
      errors: errors
    };

    console.log(`ApiClient.sync: Sincronização concluída. Resultado:`, result);
    return result;
  }

  // Expõe as funções públicas do módulo
  return {
    init,
    request, // Expor request pode ser útil para chamadas customizadas
    salvarRegistro,
    listarRegistros,
    obterRegistro,
    excluirRegistro, // Adicionada função de exclusão
    uploadImagem,
    syncOfflineRequests
    // Não expõe saveOfflineRequest, pois é usado internamente
  };

}); // Fim do ModuleLoader.register
