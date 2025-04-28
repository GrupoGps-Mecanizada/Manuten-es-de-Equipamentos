/**
 * Módulo ApiClient: Responsável por fazer requisições à API do Google Apps Script.
 * Simplifica a chamada à API, determinando o método e formatando os dados automaticamente.
 */
ModuleLoader.register('apiClient', function() {

  // Obtém a URL da API a partir da configuração global.
  // Certifique-se que window.CONFIG.API_URL está definido.
  const SCRIPT_URL = window.CONFIG?.API_URL || ''; // Usa SCRIPT_URL como solicitado

  /**
   * Função central e simplificada para realizar requisições à API.
   * @param {string} action - O nome da ação a ser executada no backend (ex: 'listarManutencoes', 'salvarManutencao').
   * @param {Object} [params={}] - Um objeto contendo os parâmetros para a ação.
   *                               Para GET, serão convertidos em query parameters.
   *                               Para POST, serão enviados no corpo da requisição sob a chave 'dados'.
   * @returns {Promise<any>} - Promessa que resolve com os dados da resposta da API (assumido como JSON) ou rejeita com um erro.
   */
  async function apiRequest(action, params = {}) {
    // Validação inicial
    if (!SCRIPT_URL) {
       console.error("API_URL (SCRIPT_URL) não está definida em window.CONFIG. Verifique a configuração.");
       throw new Error("URL da API não configurada.");
    }
    if (!action) {
       console.error("Ação da API não fornecida para apiRequest.");
       throw new Error("Ação da API é necessária.");
    }

    // --- Lógica ATUALIZADA ---

    // 1. Determina o Método HTTP baseado na Ação
    //    Ações que modificam dados geralmente são POST.
    const method = ['salvarManutencao', 'uploadImagem', 'atualizarStatusManutencao', 'excluirManutencao', 'processarPostViaGet'] // Adicione outras ações POST aqui
      .includes(action) ? 'POST' : 'GET';

    // 2. Define os Cabeçalhos (Headers)
    //    Content-Type: application/json é necessário apenas para POST com corpo JSON.
    const headers = {};
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    // 3. Constrói a URL base com a ação
    let url = `${SCRIPT_URL}?action=${action}`;

    // 4. Define as Opções Iniciais do Fetch
    //    Inclui 'credentials: include' para permitir o envio de cookies se necessário (login, sessão GAS).
    let options = {
      method: method,
      headers: headers,
      credentials: 'include' // Mantém como solicitado para cookies/sessão
    };

    // 5. Adiciona Parâmetros (para GET) ou Corpo (para POST)
    if (method === 'GET') {
      // Adiciona cada parâmetro do objeto 'params' à query string da URL.
      Object.entries(params).forEach(([key, value]) => {
        // Só adiciona o parâmetro se o valor não for nulo ou indefinido
        if (value !== null && value !== undefined) {
          url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
      });
      // Nenhum corpo (body) para GET
    } else { // POST
      // Cria o corpo da requisição no formato esperado pelo backend: { action: "...", dados: {...} }
      // Nota: A action já está na URL, mas pode ser útil no corpo para alguns backends.
      // Se o seu backend (doPost) espera apenas os 'dados', remova 'action' daqui.
      // Baseado no seu doPost original, ele espera { action: ..., dados: ... } ou { id: ..., imageData: ... }
      // Vamos padronizar para { action: ..., dados: ... } para simplificar. Ajuste se o backend esperar formato diferente para uploadImagem.
      options.body = JSON.stringify({ action: action, dados: params });
    }

    // --- FIM da Lógica Atualizada ---

    // Log da requisição para depuração
    console.log(`API Request: ${method} ${url}`, method === 'POST' ? `Body: ${options.body}` : '(No body for GET)');

    // Executa a requisição Fetch
    try {
      const resp = await fetch(url, options);

      // Tratamento da resposta HTTP (Simplificado conforme instrução, mas com detalhe no erro)
      if (!resp.ok) {
        // Tenta obter mais detalhes do erro do corpo da resposta
        let errorMsg = `Erro na API: HTTP ${resp.status} (${resp.statusText})`;
         try {
             const errorBody = await resp.text(); // Tenta ler o corpo como texto
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

      // Processa o corpo da resposta bem-sucedida (Assumindo JSON conforme instrução)
       // Tratamento extra para status 204 No Content (pode ocorrer em exclusão bem-sucedida)
      if (resp.status === 204) {
        return null; // Retorna null pois não há corpo para parsear
      }

      // Tenta parsear como JSON
      try {
        return await resp.json();
      } catch (jsonError) {
         console.error("Erro ao parsear resposta JSON da API:", jsonError);
         // Retorna um erro indicando falha no parseamento, mesmo com resposta OK
         throw new Error(`Falha ao processar resposta da API. Esperado JSON, mas ocorreu erro: ${jsonError.message}`);
      }


    } catch (error) {
      // Captura erros de rede ou erros lançados no tratamento da resposta
      console.error(`Falha na Requisição API [${method} ${action}]:`, error);

      // Melhora a mensagem de erro para falhas de rede (TypeError)
      if (error instanceof TypeError) {
         // Erros comuns: Falha de rede, CORS bloqueado, DNS não encontrado
         throw new Error(`Erro de rede ou CORS ao tentar acessar a API (${action}): ${error.message}. Verifique a conexão e as configurações de CORS.`);
      }

      // Re-lança o erro (que pode já ter sido formatado acima)
      // para que a função que chamou o apiRequest possa tratar (ex: mostrar na UI)
      throw error;
    }
  }

  // Função de inicialização (pode ser usada para configurações futuras)
  function init() {
    if (!SCRIPT_URL) {
      console.warn("ApiClient: SCRIPT_URL (API_URL) não encontrada na inicialização. Verifique window.CONFIG.");
    } else {
      console.log('ApiClient inicializado. URL da API:', SCRIPT_URL);
    }
  }

  // Expõe as funções públicas do módulo
  return {
    init,
    request: apiRequest // Função principal e simplificada para fazer requisições
  };

}); // Fim do ModuleLoader.register
