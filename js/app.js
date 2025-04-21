// app.js

/**
 * Aplicação principal do sistema
 */
const App = {
  /**
   * Inicializar a aplicação
   */
  init: async function() {
    // Configurar URL da API no CONFIG
    if (!CONFIG.API_URL) {
      // Aqui você deve definir a URL do seu Google Apps Script Web App
      CONFIG.API_URL = prompt('Informe a URL do seu Google Apps Script Web App:', 'https://script.google.com/macros/s/AKfycbwRAFDZyRzDOuSXY_KggCAPwMJMDE8mMDyvFnKawfG3qO-3E4eSArFD2cEXxJb79AuB/exec');
      
      if (CONFIG.API_URL) {
        // Salvar para uso futuro
        localStorage.setItem('API_URL', CONFIG.API_URL);
      } else {
        alert('Sistema funcionará em modo offline. Algumas funcionalidades podem não estar disponíveis.');
      }
    }
    
    // Inicializar módulos
    ApiClient.init();
    PhotoHandler.init();
    FormHandler.init();
    
    // Configurar eventos da UI
    this.setupUIEvents();
    
    // Verificar conectividade e tentar sincronizar
    this.checkConnectivityAndSync();
    
    // Carregar lista de registros inicial
    await this.refreshRegistrosList();
    
    // Detectar modo (novo registro, edição, visualização)
    this.handleUrlParams();
  },
  
  /**
   * Configurar eventos da interface
   */
  setupUIEvents: function() {
    // Botão Novo Registro
    document.getElementById('btnNovoRegistro').addEventListener('click', () => {
      FormHandler.newRegistro();
    });
    
    // Botão Lista de Registros
    document.getElementById('btnListaRegistros').addEventListener('click', () => {
      Utils.showScreen('telaListaRegistros');
    });
    
    // Botão Voltar à Lista (da visualização)
    document.getElementById('btnVoltarLista').addEventListener('click', () => {
      Utils.showScreen('telaListaRegistros');
    });
    
    // Campo de busca
    const campoBusca = document.getElementById('buscaRegistro');
    const btnBuscar = document.getElementById('btnBuscar');
    
    btnBuscar.addEventListener('click', () => {
      this.filterRegistros(campoBusca.value);
    });
    
    campoBusca.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.filterRegistros(campoBusca.value);
      }
    });
  },
  
  /**
   * Tratar parâmetros de URL
   */
  handleUrlParams: function() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('view')) {
      // Modo visualização
      const id = params.get('view');
      FormHandler.viewRegistro(id);
    } else if (params.has('edit')) {
      // Modo edição
      const id = params.get('edit');
      FormHandler.loadRegistro(id);
    } else if (params.has('new')) {
      // Novo registro
      FormHandler.newRegistro();
    }
    
    // Limpar URL após processar
    if (params.toString()) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  },
  
  /**
   * Atualizar lista de registros
   */
  refreshRegistrosList: async function() {
    const tableBody = document.getElementById('listaRegistrosBody');
    
    if (!tableBody) return;
    
    // Mostrar loading
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
        </td>
      </tr>
    `;
    
    try {
      // Buscar registros
      const registros = await ApiClient.listarRegistros();
      
      // Limpar tabela
      tableBody.innerHTML = '';
      
      if (registros.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4">
              <div class="alert alert-info mb-0">
                <i class="bi bi-info-circle me-2"></i> Nenhum registro encontrado
              </div>
            </td>
          </tr>
        `;
        return;
      }
      
      // Ordenar por data (mais recente primeiro)
      registros.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
      
      // Adicionar registros à tabela
      registros.forEach(registro => {
        const row = document.createElement('tr');
        
        // Determinar status do registro
        let statusBadge = '';
        
        if (registro.fotosPos && registro.fotosPos.length > 0) {
          statusBadge = '<span class="badge bg-success">Completo</span>';
        } else if (registro.fotosPre && registro.fotosPre.length > 0) {
          statusBadge = '<span class="badge bg-warning text-dark">Parcial</span>';
        } else {
          statusBadge = '<span class="badge bg-secondary">Pendente</span>';
        }
        
        row.innerHTML = `
          <td><small>${registro.id}</small></td>
          <td>${registro.placa || '-'}</td>
          <td>${registro.modelo || '-'}</td>
          <td><small>${Utils.formatDate(registro.dataCriacao)}</small></td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-sm btn-primary btn-view" data-id="${registro.id}">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-warning btn-edit" data-id="${registro.id}">
              <i class="bi bi-pencil"></i>
            </button>
          </td>
        `;
        
        // Adicionar eventos aos botões
        row.querySelector('.btn-view').addEventListener('click', () => {
          FormHandler.viewRegistro(registro.id);
        });
        
        row.querySelector('.btn-edit').addEventListener('click', () => {
          FormHandler.loadRegistro(registro.id);
        });
        
        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4">
            <div class="alert alert-danger mb-0">
              <i class="bi bi-exclamation-triangle me-2"></i> Erro ao carregar registros
            </div>
          </td>
        </tr>
      `;
    }
  },
  
  /**
   * Filtrar registros por termo de busca
   * @param {string} termo - Termo de busca
   */
  filterRegistros: async function(termo) {
    if (!termo) {
      // Se não houver termo, mostrar todos
      this.refreshRegistrosList();
      return;
    }
    
    termo = termo.toLowerCase().trim();
    
    try {
      // Buscar todos os registros
      const registros = await ApiClient.listarRegistros();
      
      // Filtrar
      const filtrados = registros.filter(registro => {
        return (
          (registro.id && registro.id.toLowerCase().includes(termo)) ||
          (registro.placa && registro.placa.toLowerCase().includes(termo)) ||
          (registro.modelo && registro.modelo.toLowerCase().includes(termo)) ||
          (registro.idInterna && registro.idInterna.toLowerCase().includes(termo)) ||
          (registro.responsavel && registro.responsavel.toLowerCase().includes(termo)) ||
          (registro.descricaoProblema && registro.descricaoProblema.toLowerCase().includes(termo))
        );
      });
      
      // Mostrar resultados
      const tableBody = document.getElementById('listaRegistrosBody');
      
      // Limpar tabela
      tableBody.innerHTML = '';
      
      if (filtrados.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4">
              <div class="alert alert-info mb-0">
                <i class="bi bi-search me-2"></i> Nenhum resultado encontrado para "${termo}"
              </div>
            </td>
          </tr>
        `;
        return;
      }
      
      // Adicionar registros filtrados à tabela
      filtrados.forEach(registro => {
        const row = document.createElement('tr');
        
        // Determinar status do registro
        let statusBadge = '';
        
        if (registro.fotosPos && registro.fotosPos.length > 0) {
          statusBadge = '<span class="badge bg-success">Completo</span>';
        } else if (registro.fotosPre && registro.fotosPre.length > 0) {
          statusBadge = '<span class="badge bg-warning text-dark">Parcial</span>';
        } else {
          statusBadge = '<span class="badge bg-secondary">Pendente</span>';
        }
        
        row.innerHTML = `
          <td><small>${registro.id}</small></td>
          <td>${registro.placa || '-'}</td>
          <td>${registro.modelo || '-'}</td>
          <td><small>${Utils.formatDate(registro.dataCriacao)}</small></td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-sm btn-primary btn-view" data-id="${registro.id}">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-warning btn-edit" data-id="${registro.id}">
              <i class="bi bi-pencil"></i>
            </button>
          </td>
        `;
        
        // Adicionar eventos aos botões
        row.querySelector('.btn-view').addEventListener('click', () => {
          FormHandler.viewRegistro(registro.id);
        });
        
        row.querySelector('.btn-edit').addEventListener('click', () => {
          FormHandler.loadRegistro(registro.id);
        });
        
        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Erro ao filtrar registros:', error);
      Utils.showNotification('Erro ao filtrar registros.', 'error');
    }
  },
  
  /**
   * Verificar conectividade e tentar sincronizar
   */
  checkConnectivityAndSync: async function() {
    if (!navigator.onLine || !CONFIG.API_URL) {
      // Offline ou sem configuração de API
      console.log('Sistema em modo offline');
      return;
    }
    
    try {
      // Tentar sincronizar requisições pendentes
      const syncResult = await ApiClient.syncOfflineRequests();
      
      if (syncResult.syncedCount > 0) {
        Utils.showNotification(
          `Sincronização concluída: ${syncResult.syncedCount} registro(s) sincronizado(s).`, 
          'success'
        );
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    }
  }
};

// Inicializar aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
