/**
 * API Client para comunicação com o backend do Google Apps Script
 * Com tratamento adequado de CORS
 */
ModuleLoader.register('apiClient', function() {
  // Módulos e utilitários
  let AppState = null;
  let Config = null;
  let Utils = null;

  // URL da API do config
  let apiUrl = '';

  /**
   * Inicializa o módulo
   */
  function init() {
    console.log('Inicializando API Client...');
    
    // Obtém dependências
    AppState = ModuleLoader.get('state');
    Utils = window.Utils;
    Config = window.CONFIG;
    
    // Obtém a URL da API do config
    apiUrl = Config?.API_URL || '';
    
    if (!apiUrl) {
      console.warn('API_URL não está configurada. As funcionalidades online não estarão disponíveis.');
      return;
    }
    
    console.log('API Client inicializado com URL:', apiUrl);
  }

  /**
   * Realiza requisição para API com tratamento de CORS melhorado
   * @param {string} method - Método HTTP (GET, POST, etc.)
   * @param {string} action - A ação da API a ser chamada
   * @param {Object|null} data - Dados a serem enviados (para POST)
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>} Resposta da API
   */
  async function apiRequest(method, action, data = null, options = {}) {
    // Valida URL da API
    if (!apiUrl) {
      return Promise.reject(new Error('API_URL não configurada. Operação online não disponível.'));
    }
    
    // Verifica se está online
    if (!navigator.onLine) {
      return Promise.reject(new Error('Sem conexão com a Internet. Tente novamente quando estiver online.'));
    }
    
    try {
      const url = new URL(apiUrl);
      
      // Para requisições GET, adiciona parâmetros à URL
      if (method === 'GET' && action) {
        url.searchParams.append('action', action);
        
        // Adiciona parâmetros adicionais dos dados
        if (data) {
          Object.keys(data).forEach(key => {
            url.searchParams.append(key, data[key]);
          });
        }
        
        // Sempre adiciona a origem para CORS
        url.searchParams.append('origin', window.location.origin);
      }
      
      // Prepara opções do fetch
      const fetchOptions = {
        method: method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors', // Usa modo CORS explicitamente
        cache: 'no-cache',
        redirect: 'follow',
        ...options // Mescla opções personalizadas
      };
      
      // Para requisições POST, adiciona os dados ao corpo
      if (method === 'POST' && (action || data)) {
        fetchOptions.body = JSON.stringify({
          action: action,
          dados: data,
          origin: window.location.origin // Inclui origem no corpo para CORS
        });
      }
      
      console.log(`API Request: ${method} para ${url}`, fetchOptions);
      const response = await fetch(url, fetchOptions);
      
      // Trata respostas não-JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Trata respostas não-JSON (comum em erros de CORS)
        if (!response.ok) {
          throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
        }
        return { success: false, message: "Resposta recebida não é JSON válido." };
      }
      
      const jsonResponse = await response.json();
      console.log(`API Response:`, jsonResponse);
      return jsonResponse;
      
    } catch (error) {
      console.error(`Erro na requisição ${method} para ${action}:`, error);
      
      // Verifica se é um erro de CORS
      if (error.message.includes('CORS') || error.name === 'TypeError' && error.message === 'Failed to fetch') {
        console.error('Possível erro de CORS detectado. Tentando abordagem alternativa...');
        
        // Fallback de CORS: Usar modo 'no-cors' para requisições POST
        // Nota: Isso tornará a resposta ilegível, então retornamos uma resposta predefinida
        if (method === 'POST') {
          try {
            const url = new URL(apiUrl);
            await fetch(url, {
              method: 'POST',
              mode: 'no-cors', // Isso permite a requisição mas torna a resposta ilegível
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                action: action,
                dados: data,
                origin: window.location.origin
              })
            });
            
            // Como não podemos ler a resposta com no-cors, retornamos um sucesso genérico
            console.log('Requisição no-cors enviada (resposta não legível)');
            return { 
              success: true, 
              message: "Solicitação enviada pelo modo alternativo. O resultado não pode ser verificado.",
              registro: data, // Retorna os dados que foram enviados
              fromNoCors: true // Flag para identificar este caso especial
            };
          } catch (noCorsError) {
            console.error('Falha na abordagem alternativa no-cors:', noCorsError);
          }
        }
      }
      
      // Se tudo falhar, retorna erro
      throw new Error(`Erro de comunicação: ${error.message}`);
    }
  }

  /**
   * Busca uma lista de registros
   * @param {Object} params - Parâmetros de filtro
   * @returns {Promise<Object>} Lista de registros
   */
  async function listarRegistros(params = {}) {
    return apiRequest('GET', 'listarManutencoes', params);
  }

  /**
   * Obtém um registro específico por ID
   * @param {string} id - ID do registro
   * @returns {Promise<Object>} Dados do registro
   */
  async function obterRegistro(id) {
    return apiRequest('GET', 'obterManutencao', { id });
  }

  /**
   * Salva ou atualiza um registro
   * @param {Object} registro - Dados do registro
   * @returns {Promise<Object>} Registro salvo
   */
  async function salvarRegistro(registro) {
    if (!registro || !registro.id) {
      return Promise.reject(new Error('Dados de registro inválidos para salvar.'));
    }
    
    return apiRequest('POST', 'salvarManutencao', registro);
  }

  /**
   * Exclui um registro
   * @param {string} id - ID do registro
   * @returns {Promise<Object>} Resultado
   */
  async function excluirRegistro(id) {
    return apiRequest('GET', 'excluirManutencao', { id });
  }

  /**
   * Atualiza o status de um registro
   * @param {string} id - ID do registro
   * @param {string} status - Novo status
   * @returns {Promise<Object>} Registro atualizado
   */
  async function atualizarStatusRegistro(id, status) {
    return apiRequest('GET', 'atualizarStatusManutencao', { id, status });
  }

  /**
   * Obtém configurações iniciais da API
   * @returns {Promise<Object>} Configurações
   */
  async function obterConfiguracoesIniciais() {
    return apiRequest('GET', 'obterConfiguracoesIniciais');
  }

  /**
   * Testa a conexão com a API
   * @returns {Promise<Object>} Resposta do ping
   */
  async function ping() {
    return apiRequest('GET', 'ping');
  }

  // API pública
  return {
    init,
    listarRegistros,
    obterRegistro,
    salvarRegistro,
    excluirRegistro, 
    atualizarStatusRegistro,
    obterConfiguracoesIniciais,
    ping,
    apiRequest
  };
});
