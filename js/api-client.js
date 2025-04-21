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
    // Apenas loga, a URL será verificada em cada request.
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
          // Assume que Utils está disponível globalmente ou via ModuleLoader se necessário
          url = window.Utils?.obterLocalStorage?.('API_URL');
      }
       if (!url) {
           console.error("API_URL não configurada no CONFIG nem no localStorage! Verifique config.js e o localStorage.");
           // Tenta notificar o usuário se possível
           window.Utils?.showNotification?.("Erro crítico: URL da API não encontrada.", "error");
       }
      return url || null; // Retorna a URL ou null
  }

  /**
   * Fazer requisição para a API do Google Apps Script (Função Central)
   * @param {string} action - A ação a ser executada no GAS (ex: 'listarRegistros').
   * @param {object} [data={}] - Dados a serem enviados no corpo da requisição POST.
   * @returns {Promise<object>} - A promessa com o resultado da API.
   * @throws {Error} - Lança erro em caso de falha na rede, erro HTTP ou falha no parse da resposta.
   */
  async function request(action, data = {}) {
    const effectiveApiUrl = getApiUrl(); // Obtém a URL no momento da requisição

    // Se não há URL, tenta salvar offline imediatamente e lança erro claro.
    if (!effectiveApiUrl) {
      console.error(`ApiClient.request: Tentativa de requisição para '${action}' sem API_URL configurada.`);
      saveOfflineRequest(action, data); // Tenta salvar offline
      throw new Error('URL da API não configurada. Verifique as configurações.');
    }

    // Usa Utils se disponível para feedback visual
    const utils = window.Utils;
    utils?.showLoading?.(); // Mostra loading

    // ---- Configuração da Requisição Fetch ----
    const fetchOptions = {
        method: 'POST',     // Usar POST para todas as ações para enviar 'action' e 'data' no corpo
        credentials: 'omit', // Necessário para evitar problemas com cookies de terceiros
        // mode: 'cors', // 'cors' é o padrão, não precisa definir explicitamente geralmente
        headers: {
          // >>> CORREÇÃO CRUCIAL APLICADA AQUI <<<
          // Apps Script precisa de 'application/json' para entender o corpo como JSON e popular e.postData
          'Content-Type': 'application/json',
          // Poderia adicionar outros cabeçalhos aqui se necessário (ex: Autenticação)
          // 'Authorization': 'Bearer SEU_TOKEN_SE_USAR'
        },
        // O corpo SEMPRE contém a ação e os dados, mesmo que 'data' esteja vazio
        body: JSON.stringify({ action: action, data: data })
    };
    // -----------------------------------------

    try {
      console.debug(`ApiClient: Enviando ação '${action}' para ${effectiveApiUrl}`, fetchOptions.body); // Loga o corpo enviado
      const response = await fetch(effectiveApiUrl, fetchOptions);

      // Processa a resposta
      let responseBodyText = await response.text(); // Lê como texto primeiro para debug
      let result = null;

      // Verifica se a resposta HTTP foi OK (status 200-299)
      if (!response.ok) {
        let errorMsg = `Erro na API: ${response.status} ${response.statusText}`;
        try {
            // Tenta parsear como JSON para mensagens de erro estruturadas do GAS
            result = JSON.parse(responseBodyText);
            // Usa a mensagem do GAS se disponível, senão o status HTTP
            errorMsg = result?.message || result?.error || errorMsg;
        } catch (e) {
           // Se falhou o parse do corpo do erro, usa o texto bruto
           console.warn(`ApiClient: Não foi possível parsear corpo da resposta de erro (${response.status}). Corpo: ${responseBodyText}`);
        }
        console.error(`ApiClient: Erro na resposta da API (${response.status}). Mensagem: ${errorMsg}`);
        // Lança um erro que pode ser capturado pela camada superior (App/UI)
        throw new Error(errorMsg);
      }

      // Tenta parsear a resposta de sucesso como JSON
      try {
         result = JSON.parse(responseBodyText);
      } catch (e) {
         console.error(`ApiClient: Falha GRAVE ao parsear resposta JSON de SUCESSO da API para ação '${action}'. Corpo:`, responseBodyText, e);
         // Se a resposta de sucesso não é JSON, algo está muito errado no GAS
         throw new Error(`Resposta inválida da API (não é JSON): ${responseBodyText.substring(0, 100)}...`);
      }

       // Verifica se a resposta da API indica sucesso lógico (propriedade 'success')
       if (result && result.success === false) {
           console.warn(`ApiClient: API retornou success:false para ação '${action}'. Mensagem: ${result.message}`);
           // Lança um erro com a mensagem específica da API para ser tratado
           throw new Error(result.message || `API informou falha na ação ${action}`);
       }


      console.debug(`ApiClient: Resposta de sucesso recebida para ação '${action}'.`);
      return result; // Retorna o objeto JSON parseado

    } catch (error) {
      // Captura erros de rede (fetch falhou), erros HTTP (response.ok foi false),
      // ou erros de parse da resposta JSON.
      console.error(`ApiClient: Erro GERAL durante a requisição para ação '${action}':`, error.message || error);
      // Tenta salvar offline em qualquer caso de erro pego aqui
      saveOfflineRequest(action, data);
      // Propaga o erro para que a função chamadora (ex: App.refreshRegistrosList) possa tratar
      // (ex: mostrar notificação, usar dados de cache)
      throw error;
    } finally {
      // Garante que o loading seja escondido, mesmo se ocorrer erro
      utils?.hideLoading?.();
    }
  }

  // --- Funções de Ações Específicas ---
  // Simplificadas para apenas chamar 'request' e retornar a promessa.
  // O tratamento de erro específico (ex: usar cache) é feito na camada que chama estas funções.

  async function salvarRegistro(registro) {
     if (!registro || !registro.id) throw new Error("Dados ou ID do registro inválidos para salvar.");
     return request('salvarRegistro', registro); // Retorna a promessa de request
  }

  async function listarRegistros() {
     // Retorna a promessa. A camada superior (App) tratará o resultado ou erro.
     const result = await request('listarRegistros');
     // Validação mínima da estrutura esperada
     if (result && result.success && Array.isArray(result.registros)) {
        return result.registros;
     }
     // Se chegou aqui, a resposta não foi o esperado
     console.error("Resposta inválida ao listar registros:", result);
     throw new Error(result?.message || 'Formato de resposta inválido ao listar registros');
  }

  async function obterRegistro(id) {
     if (!id) throw new Error("ID do registro não fornecido.");
     const result = await request('obterRegistro', { id: id });
     // Validação mínima
     if (result && result.success) {
        return result.registro || null; // Retorna o registro ou null se não encontrado (success: true)
     }
     console.error("Resposta inválida ao obter registro:", result);
     throw new Error(result?.message || `Falha ao obter registro ${id}`);
  }

  async function excluirRegistro(id) {
      if (!id) throw new Error("ID do registro não fornecido para exclusão.");
      return request('excluirRegistro', { id: id }); // Retorna a promessa
  }

  async function uploadImagem(photoObject) {
     // Validação dos dados da imagem
     if (!photoObject?.dataUrl || !photoObject?.name || !photoObject?.type || !photoObject?.registroId || !photoObject?.id) {
        console.error("Dados incompletos para uploadImagem:", photoObject);
        throw new Error("Dados da imagem incompletos para upload.");
     }
     // Prepara o payload para a API GAS
     const payload = {
        fileName: `${photoObject.registroId}_${photoObject.id}_${photoObject.name}`, // Nome do arquivo no Drive
        mimeType: photoObject.type,
        content: photoObject.dataUrl.split(',')[1], // Extrai apenas o conteúdo base64
        registroId: photoObject.registroId,          // ID do registro associado
        photoId: photoObject.id                      // ID único da foto no cliente
     };
     // Upload não é salvo offline por padrão
     return request('uploadImagem', payload); // Retorna a promessa
  }

  // --- Funções Offline ---

  function saveOfflineRequest(action, data) {
     const utils = window.Utils;
     // Não salva uploads de imagem offline devido ao tamanho
     if (action === 'uploadImagem') {
        console.warn(`ApiClient: Upload da imagem (ação '${action}') falhou e NÃO será salvo offline.`);
        utils?.showNotification?.(`Falha no upload da imagem. Tente novamente com conexão.`, 'error');
        return;
     }
     // Verifica se as funções de utilidade necessárias estão disponíveis
     if (!utils?.salvarLocalStorage || !utils?.obterLocalStorage || !utils?.gerarId) {
        console.error("ApiClient: Funções Utils (salvar/obterLocalStorage, gerarId) não disponíveis para salvar requisição offline.");
        return;
     }
     console.log(`ApiClient: Salvando requisição offline para ação '${action}'...`);
     try {
         const offlineRequests = utils.obterLocalStorage('offlineRequests') || [];
         const requestId = utils.gerarId();
         offlineRequests.push({
           id: requestId, // Adiciona ID único para rastreamento
           action,
           data,
           timestamp: new Date().toISOString()
         });
         utils.salvarLocalStorage('offlineRequests', offlineRequests);
         console.log(`Requisição offline ID ${requestId} salva. Pendentes: ${offlineRequests.length}`);
         // Notifica o usuário
         utils.showNotification?.(`Sem conexão. Ação (${action}) salva para tentar mais tarde.`, 'warning', 5000);
     } catch (e) {
        console.error("ApiClient: Erro CRÍTICO ao tentar salvar requisição offline:", e);
        utils?.showNotification?.(`Erro ao salvar ação (${action}) offline.`, 'error');
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

     // Verifica conectividade GERAL antes de começar
     if (!navigator.onLine) {
         console.log("ApiClient.sync: Sem conexão de rede. Sincronização offline adiada.");
         return { success: false, message: "Sem conexão", syncedCount: 0, errorCount: 0, pendingCount: totalPending, errors: [] };
     }


     console.log(`ApiClient.sync: Tentando sincronizar ${totalPending} requisições offline...`);
     utils?.showNotification?.(`Sincronizando ${totalPending} ações pendentes...`, 'info', 3000);

     let successCount = 0;
     const remainingRequests = []; // Guarda as que falharam para tentar depois
     const errors = [];          // Guarda os detalhes dos erros

     // Processa UMA por UMA em sequência para evitar sobrecarregar a API
     // e para garantir a ordem (se relevante para suas ações)
     for (const req of offlineRequests) {
        // Pode verificar navigator.onLine de novo aqui se quiser ser extra cuidadoso
        // if (!navigator.onLine) { remainingRequests.push(req); continue; }

        try {
          console.log(`ApiClient.sync: Enviando req offline ID ${req.id} (Ação: ${req.action})...`);
          // Chama a função 'request' central. Ela NÃO tentará salvar offline novamente
          // se for chamada a partir daqui (pois já estamos no processo de sync).
          // A função 'request' já trata erros de rede/http/parse internamente.
          const result = await request(req.action, req.data); // Espera a conclusão
          // Se chegou aqui sem erro, considera sucesso
          console.log(`ApiClient.sync: Requisição offline ID ${req.id} (Ação: ${req.action}) sincronizada com sucesso.`);
          successCount++;
        } catch (error) {
          // Erro pode ser de rede, HTTP, parse ou lógico retornado pela API (result.success === false)
          console.error(`ApiClient.sync: Erro ao sincronizar req offline ID ${req.id} (Ação: ${req.action}):`, error.message || error);
          // Mantém a requisição na lista para tentar novamente mais tarde
          remainingRequests.push(req);
          errors.push({ requestId: req.id, action: req.action, error: error.message || String(error) });
        }
     }

     // Atualiza a lista de requisições pendentes no localStorage
     utils.salvarLocalStorage('offlineRequests', remainingRequests);

     const finalResult = {
       success: errors.length === 0 && remainingRequests.length === 0, // Sucesso total apenas se tudo foi enviado sem erros
       syncedCount: successCount,
       errorCount: errors.length,
       pendingCount: remainingRequests.length,
       errors: errors // Array com detalhes dos erros para possível exibição/log
     };

     console.log(`ApiClient.sync: Sincronização concluída. ${successCount} sucesso(s), ${errors.length} erro(s). Pendentes: ${remainingRequests.length}.`);

     // Notifica o usuário sobre o resultado da sincronização
     if (finalResult.success) {
         utils?.showNotification?.(`Sincronização concluída com sucesso!`, 'success', 3000);
     } else if (successCount > 0) {
          utils?.showNotification?.(`${successCount} ações sincronizadas, ${errors.length} falharam e permanecem pendentes.`, 'warning', 5000);
     } else if (errors.length > 0) {
          utils?.showNotification?.(`Falha ao sincronizar ${errors.length} ações pendentes. Tente novamente mais tarde.`, 'error', 5000);
     }

     return finalResult; // Retorna o resultado detalhado da sincronização
  }

  console.log("ApiClient: Retornando objeto do módulo para ModuleLoader.");

  // Expõe as funções públicas do módulo apiClient
  return {
    init,
    salvarRegistro,
    listarRegistros,
    obterRegistro,
    excluirRegistro,
    uploadImagem,
    syncOfflineRequests // Expõe a função para ser chamada pelo App
    // Não expor 'request' diretamente evita chamadas fora do padrão
    // Não expor 'saveOfflineRequest' diretamente
  };

}); // Fim do ModuleLoader.register
