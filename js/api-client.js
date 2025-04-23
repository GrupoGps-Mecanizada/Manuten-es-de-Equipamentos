/**
 * api-client.js
 * Módulo para comunicação com a API Google Apps Script.
 * Versão corrigida e modularizada.
 */
ModuleLoader.register('apiClient', function () {

  const Utils = window.Utils; // Assume que Utils está global
  const AppState = ModuleLoader.get('state'); // Assume que State foi inicializado

  /**
   * Obtém a URL da API do objeto global CONFIG ou do estado.
   * @returns {string|null} URL da API ou null se não configurada.
   */
  function getApiUrl() {
    const url = window.CONFIG?.API_URL || AppState?.get('config')?.API_URL;
    if (!url || typeof url !== 'string' || !url.startsWith('https://script.google.com/')) {
      console.error('ApiClient: API_URL inválida ou não configurada!');
      Utils?.showNotification?.('Erro crítico: URL da API inválida ou ausente.', 'error');
      return null;
    }
    return url;
  }

  /**
   * Realiza uma requisição para a API Google Apps Script.
   * @param {string} action - A ação a ser executada no backend.
   * @param {object} params - Parâmetros adicionais para a requisição.
   * @param {string} [method='GET'] - Método HTTP ('GET' ou 'POST').
   * @returns {Promise<object>} - Promessa com o resultado da API.
   */
  async function request(action, params = {}, method = 'GET') {
    const apiUrlBase = getApiUrl();
    if (!apiUrlBase) {
      // Se não tem URL, não tenta offline, apenas falha.
      // A lógica offline pode ser gerenciada em um nível superior (App.js).
      return Promise.resolve({ success: false, message: "URL da API não configurada." });
    }

    const isPost = method.toUpperCase() === 'POST';
    let requestUrl = apiUrlBase;
    const allParams = { ...params, action, origin: window.location.origin }; // Adiciona action e origin

    const fetchOptions = {
      method: method.toUpperCase(),
      mode: 'cors', // Essencial para cross-origin
      credentials: 'omit', // Importante se precisar de autenticação Google
      headers: {},
      redirect: 'follow',
      //signal: controller.signal // Para timeout, se necessário
    };

    if (isPost) {
      // Para POST, envia dados no corpo como JSON
      fetchOptions.body = JSON.stringify(allParams);
      fetchOptions.headers['Content-Type'] = 'application/json'; // CORREÇÃO: Usar JSON para POST
    } else {
      // Para GET, adiciona parâmetros à URL
      const urlObj = new URL(apiUrlBase);
      Object.entries(allParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Codifica objetos como JSON na URL (se necessário pelo backend)
          const paramValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          urlObj.searchParams.append(key, paramValue);
        }
      });
      requestUrl = urlObj.toString();
    }

    console.debug(`ApiClient: ${fetchOptions.method} ${action} → ${requestUrl}`);
    // Não usar showLoading/hideLoading aqui, deixa para quem chama (App.js etc.)

    try {
      const response = await fetch(requestUrl, fetchOptions);
      const responseBodyText = await response.text(); // Lê como texto primeiro

      if (!response.ok) {
        let errorDetail = `Erro ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(responseBodyText);
          if (errorJson && errorJson.message) {
            errorDetail += ` - ${errorJson.message}`;
          } else if (responseBodyText.length < 300) {
            errorDetail += ` - (Detalhe: ${responseBodyText})`;
          }
        } catch (e) {
           if (responseBodyText.length < 300) {
               errorDetail += ` - (Resposta não JSON: ${responseBodyText})`;
           }
        }
        console.error('ApiClient: Erro na API:', action, 'Status:', response.status, 'Detalhe:', errorDetail);
        // Lança o erro para ser tratado pelo chamador
        throw new Error(errorDetail);
      }

      // Tenta parsear como JSON
      try {
        const result = JSON.parse(responseBodyText);
        if (result && result.success === false) {
           console.warn(`ApiClient: Backend retornou erro para "${action}":`, result.message);
           // Não lança erro aqui, mas retorna o objeto com success: false
        }
        return result; // Retorna o objeto JSON parseado
      } catch (jsonError) {
        console.error('ApiClient: Erro ao parsear resposta JSON:', responseBodyText, jsonError);
        throw new Error('Resposta inválida do servidor (não JSON).');
      }

    } catch (error) {
      console.error(`ApiClient: Erro na requisição ${fetchOptions.method} para ${action}:`, error);
      // Apenas propaga o erro, quem chamou decide como tratar (ex: offline, notificação)
      throw error; // Propaga o erro para ser tratado pelo chamador
    }
  }

  // --- Funções Wrapper (simplificam chamadas comuns) ---

  const listarManutencoes = (status, placa, limite) => {
    return request('listarManutencoes', { status, placa, limite }, 'GET');
  };

  const obterManutencao = (id) => {
    return request('obterManutencao', { id }, 'GET');
  };

  const salvarManutencao = (dadosManutencao) => {
    // Envia os dados como objeto dentro de 'dados'
    return request('salvarManutencao', { dados: dadosManutencao }, 'POST');
  };

  const uploadImagem = (idManutencao, imagemBase64, tipo, idOriginalParaSubstituir = null) => {
    return request('uploadImagem', { id: idManutencao, imagem: imagemBase64, tipo, idOriginalParaSubstituir }, 'POST');
  };

  const excluirManutencao = (id) => {
     return request('excluirManutencao', { id }, 'POST');
  }

  const excluirImagem = (idManutencao, idImagem, tipo) => {
      return request('excluirImagem', { idManutencao, idImagem, tipo }, 'POST');
  }

  const atualizarStatusManutencao = (id, status) => {
      return request('atualizarStatusManutencao', { id, status }, 'POST');
  }

  const obterConfiguracoesIniciais = () => {
      return request('obterConfiguracoesIniciais', {}, 'GET');
  }

  const obterDadosDashboard = () => {
      return request('obterDadosDashboard', {}, 'GET');
  }

  const obterManutencoesPorPeriodo = (dias) => {
      return request('obterManutencoesPorPeriodo', { dias }, 'GET');
  }

  const gerarPDFTextoBackend = (id) => {
      return request('gerarPDFTextoBackend', { id }, 'GET');
  }

  const gerarRelatorioAvancado = (id, formato, opcoes = {}) => {
      // Opções precisam ser stringificadas para GET
      return request('gerarRelatorioAvancado', { id, formato, opcoes: JSON.stringify(opcoes) }, 'GET');
  }

   const salvarConfiguracao = (chave, valor) => {
       return request('salvarConfiguracao', { chave, valor }, 'POST');
   }

   const configurarGatilhoAutomatico = () => {
       return request('configurarGatilhoAutomatico', {}, 'POST');
   }

   const enviarEmailNotificacao = (id, destinatarios, tipo) => {
        // Envia destinatários como array (stringify feito no backend se necessário)
        return request('enviarEmailNotificacao', { id, destinatarios, tipo }, 'POST');
   }

   const integrarComPlanilhaTurnos = (idPlanilha) => {
        return request('integrarComPlanilhaTurnos', { idPlanilha }, 'POST');
   }

   const obterConfiguracoesGerais = () => {
        return request('obterConfiguracoesGerais', {}, 'GET');
   }

   const obterVersaoApp = () => {
        return request('obterVersaoApp', {}, 'GET');
   }

   const ping = () => {
       return request('ping', {}, 'GET');
   }


  // Interface pública do módulo
  return {
    request, // Exporta a função base se necessário
    // Exporta as funções wrapper
    listarManutencoes,
    obterManutencao,
    salvarManutencao,
    uploadImagem,
    excluirManutencao,
    excluirImagem,
    atualizarStatusManutencao,
    obterConfiguracoesIniciais,
    obterDadosDashboard,
    obterManutencoesPorPeriodo,
    gerarPDFTextoBackend,
    gerarRelatorioAvancado,
    salvarConfiguracao,
    configurarGatilhoAutomatico,
    enviarEmailNotificacao,
    integrarComPlanilhaTurnos,
    obterConfiguracoesGerais,
    obterVersaoApp,
    ping
    // Não exporta init, pois é chamado pelo ModuleLoader
  };
});
