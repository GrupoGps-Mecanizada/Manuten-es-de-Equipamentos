// api-client.js

/**
 * Cliente para comunicação com a API do Google Apps Script
 */
const ApiClient = {
  /**
   * URL da API (Web App do Google Apps Script)
   */
  apiUrl: CONFIG.API_URL,
  
  /**
   * Inicializar cliente da API
   */
  init: function() {
    // Verificar se a URL da API está configurada
    if (!this.apiUrl) {
      console.warn('URL da API não configurada. O sistema funcionará em modo offline.');
    }
  },
  
  /**
   * Fazer requisição para a API
   * @param {string} action - Ação a ser executada
   * @param {object} data - Dados a serem enviados
   * @returns {Promise<object>} - Resposta da API
   */
  request: async function(action, data = {}) {
    if (!this.apiUrl) {
      throw new Error('URL da API não configurada');
    }
    
    try {
      Utils.showLoading();
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          data: data
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro na requisição:', error);
      
      // Salvar requisição para tentar novamente quando online
      this.saveOfflineRequest(action, data);
      
      throw error;
    } finally {
      Utils.hideLoading();
    }
  },
  
  /**
   * Salvar registro de manutenção
   * @param {object} registro - Dados do registro
   * @returns {Promise<object>} - Resposta da API
   */
  salvarRegistro: async function(registro) {
    try {
      return await this.request('salvarRegistro', registro);
    } catch (error) {
      // Salvar localmente como backup
      const registros = Utils.retrieveData('registros') || [];
      
      // Verificar se já existe para atualizar
      const index = registros.findIndex(r => r.id === registro.id);
      if (index !== -1) {
        registros[index] = registro;
      } else {
        registros.push(registro);
      }
      
      Utils.storeData('registros', registros);
      
      throw error;
    }
  },
  
  /**
   * Listar registros de manutenção
   * @returns {Promise<Array>} - Lista de registros
   */
  listarRegistros: async function() {
    try {
      const result = await this.request('listarRegistros');
      
      if (result.success && result.registros) {
        // Atualizar cache local
        Utils.storeData('registros', result.registros);
        return result.registros;
      }
      
      throw new Error('Erro ao listar registros');
    } catch (error) {
      // Tentar usar cache local
      const registros = Utils.retrieveData('registros') || [];
      return registros;
    }
  },
  
  /**
   * Obter registro de manutenção por ID
   * @param {string} id - ID do registro
   * @returns {Promise<object>} - Dados do registro
   */
  obterRegistro: async function(id) {
    try {
      const result = await this.request('obterRegistro', { id });
      
      if (result.success && result.registro) {
        return result.registro;
      }
      
      throw new Error('Registro não encontrado');
    } catch (error) {
      // Tentar buscar no cache local
      const registros = Utils.retrieveData('registros') || [];
      const registro = registros.find(r => r.id === id);
      
      if (registro) {
        return registro;
      }
      
      throw error;
    }
  },
  
  /**
   * Fazer upload de imagem
   * @param {object} imageData - Dados da imagem
   * @returns {Promise<object>} - Resposta da API
   */
  uploadImagem: async function(imageData) {
    try {
      return await this.request('uploadImagem', imageData);
    } catch (error) {
      // Salvar localmente para upload posterior
      const imagensPendentes = Utils.retrieveData('imagensPendentes') || [];
      imagensPendentes.push(imageData);
      Utils.storeData('imagensPendentes', imagensPendentes);
      
      // Retornar objeto simulando sucesso para continuar o fluxo
      return {
        success: true,
        local: true,
        imageId: 'LOCAL_' + Date.now(),
        url: imageData.imageData // usar dataURL temporariamente
      };
    }
  },
  
  /**
   * Salvar requisição offline para sincronização posterior
   * @param {string} action - Ação a ser executada
   * @param {object} data - Dados a serem enviados
   */
  saveOfflineRequest: function(action, data) {
    const offlineRequests = Utils.retrieveData('offlineRequests') || [];
    offlineRequests.push({
      action,
      data,
      timestamp: new Date().toISOString()
    });
    Utils.storeData('offlineRequests', offlineRequests);
  },
  
  /**
   * Sincronizar requisições offline
   * @returns {Promise<object>} - Resultado da sincronização
   */
  syncOfflineRequests: async function() {
    const offlineRequests = Utils.retrieveData('offlineRequests') || [];
    
    if (offlineRequests.length === 0) {
      return { success: true, message: 'Nenhuma requisição pendente' };
    }
    
    let successCount = 0;
    let errorCount = 0;
    const remainingRequests = [];
    
    for (const req of offlineRequests) {
      try {
        await this.request(req.action, req.data);
        successCount++;
      } catch (error) {
        errorCount++;
        remainingRequests.push(req);
      }
    }
    
    // Atualizar lista de requisições pendentes
    Utils.storeData('offlineRequests', remainingRequests);
    
    return {
      success: true,
      syncedCount: successCount,
      errorCount: errorCount,
      pendingCount: remainingRequests.length
    };
  }
};
