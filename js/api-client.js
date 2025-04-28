/**
 * Módulo ApiClient: Responsável por fazer requisições à API do Google Apps Script.
 * Gerencia a configuração de cabeçalhos CORS e o envio de dados.
 */
ModuleLoader.register('apiClient', function() {

  // Obtém a URL da API a partir da configuração global (ajuste se necessário)
  // Certifique-se que window.CONFIG.API_URL está definido corretamente no seu HTML ou em outro script.
  const API_URL = window.CONFIG?.API_URL;

  /**
   * Função central para realizar requisições à API.
   * @param {string} endpoint - O parâmetro 'action' ou o caminho específico da API (sem a URL base).
   *                           Para GET, pode incluir query parameters (ex: '?action=listarManutencoes&status=Aguardando').
   *                           Para POST, geralmente é apenas a ação (ex: '?action=salvarManutencao').
   * @param {string} [method='GET'] - Método HTTP (GET ou POST).
   * @param {Object|null} [data=null] - Dados a serem enviados no corpo da requisição (para POST).
   * @returns {Promise<any>} - Promessa que resolve com os dados da resposta da API ou rejeita com um erro.
   */
  async function apiRequest(endpoint, method = 'GET', data = null) {
    // Validação inicial
    if (!API_URL) {
       console.error("API_URL não está definida em window.CONFIG. Verifique a configuração.");
       throw new Error("API_URL não configurada.");
    }
    if (!endpoint) {
       console.error("Endpoint da API não fornecido para apiRequest.");
       throw new Error("Endpoint da API é necessário.");
    }

    // Garante que o método está em maiúsculas para comparações consistentes
    const upperCaseMethod = method.toUpperCase();

    // Constrói a URL completa
    // Adiciona '?' se não houver e o endpoint não começar com '?'
    const separator = endpoint.startsWith('?') ? '' : '?';
    const url = `${API_URL}${separator}${endpoint}`;

    // --- Lógica de Headers e Options ATUALIZADA ---

    // 1. Cabeçalhos (Headers):
    // Inicia vazio. Adiciona Content-Type APENAS para requisições POST.
    // Isso ajuda a evitar pre-flight requests desnecessárias em GET.
    const headers = {};
    if (upperCaseMethod === 'POST') {
      headers['Content-Type'] = 'application/json';
    }
    // Adicione outros headers aqui se necessário (ex: Autenticação)
    // headers['Authorization'] = 'Bearer SEU_TOKEN';

    // 2. Opções (Options) para o Fetch:
    let options = {
      method: upperCaseMethod, // GET ou POST
      headers: headers,        // Headers definidos acima
      // credentials: 'include', // Descomente se você precisar enviar/receber cookies
                                 // entre domínios (requer configuração CORS específica no backend)
    };

    // 3. Corpo (Body):
    // Adiciona o corpo APENAS se houver dados (data) E o método NÃO for GET.
    if (data && upperCaseMethod !== 'GET') {
      options.body = JSON.stringify(data);
    }

    // --- FIM da Lógica Atualizada ---
    // IMPORTANTE: A tentativa de fallback com `mode: 'no-cors'` foi REMOVIDA.

    // Log da requisição para depuração
    console.log(`API Request: ${upperCaseMethod} ${url}`, upperCaseMethod !== 'GET' ? options : '(Options sem body para GET)');

    // Executa a requisição Fetch
    try {
      const response = await fetch(url, options);

      // Tratamento da resposta HTTP
      if (!response.ok) {
        // Tenta obter mais detalhes do erro do corpo da resposta
        let errorMsg = `Erro na API: Status ${response.status} (${response.statusText})`;
        try {
          const errorBody = await response.text(); // Tenta ler o corpo como texto
          // Verifica se o corpo não está vazio antes de adicionar
          if (errorBody) {
             // Tenta parsear como JSON se possível para mensagens de erro estruturadas
             try {
                const errorJson = JSON.parse(errorBody);
                errorMsg += ` - ${errorJson.message || errorBody}`;
             } catch (parseError) {
                errorMsg += ` - ${errorBody}`; // Usa o texto bruto se não for JSON
             }
          }
        } catch (readError) {
           console.warn("Não foi possível ler o corpo da resposta de erro.", readError);
        }
        throw new Error(errorMsg); // Lança o erro detalhado
      }

      // Processa o corpo da resposta bem-sucedida
      const contentType = response.headers.get("content-type");
      if (response.status === 204) { // 204 No Content
         return null; // Retorna null se não houver conteúdo (comum em exclusões bem-sucedidas)
      } else if (contentType && contentType.includes("application/json")) {
         return await response.json(); // Processa como JSON se o header indicar
      } else {
         // Se não for JSON ou status 204, tenta retornar como texto
         // Pode ser útil se a API retornar texto simples ou HTML em algum caso
         return await response.text();
      }

    } catch (error) {
      // Captura erros de rede ou erros lançados no tratamento da resposta
      console.error(`Falha na Requisição API [${upperCaseMethod} ${endpoint}]:`, error);

      // Melhora a mensagem de erro para falhas de rede (TypeError)
      if (error instanceof TypeError) {
         // Erros comuns: Falha de rede, CORS bloqueado (apesar das configs), DNS não encontrado
         throw new Error(`Erro de rede ou CORS ao tentar acessar a API: ${error.message}. Verifique a conexão e as configurações de CORS.`);
      }

      // Re-lança o erro original (que pode já ter sido formatado acima)
      // para que a função que chamou o apiRequest possa tratar (ex: mostrar na UI)
      throw error;
    }
  }

  // Função de inicialização (pode ser usada para configurações futuras)
  function init() {
    if (!API_URL) {
      console.warn("ApiClient: API_URL não encontrada na inicialização. Verifique window.CONFIG.");
    } else {
      console.log('ApiClient inicializado. URL da API:', API_URL);
    }
  }

  // Expõe as funções públicas do módulo
  return {
    init,
    request: apiRequest // Função principal para fazer requisições
    // Adicione outras funções auxiliares aqui se necessário
  };

}); // Fim do ModuleLoader.register
