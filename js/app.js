// app.js

/**
 * Aplicação principal do sistema
 * Orquestra a interação entre módulos e a UI.
 */
const App = {
  // Propriedades para armazenar referências aos módulos e objetos globais
  ApiClient: null,
  PhotoHandler: null,
  FormHandler: null,
  AppState: null,
  Utils: null,
  Config: null,

  /**
   * Inicializa a aplicação
   */
  init: async function() {
    console.log("App.init() iniciado...");

    // Obter referências
    this.AppState = ModuleLoader.get('state');
    this.PhotoHandler = ModuleLoader.get('photoHandler');
    this.FormHandler = ModuleLoader.get('formHandler');
    this.Utils = window.Utils;
    this.Config = window.CONFIG;
    this.ApiClient = ModuleLoader.get('apiClient');

    // Verificação de dependências críticas
    let missingEssentialDeps = [];
    if (!this.AppState) missingEssentialDeps.push('AppState');
    if (!this.PhotoHandler) missingEssentialDeps.push('PhotoHandler');
    if (!this.FormHandler) missingEssentialDeps.push('FormHandler');
    if (!this.Utils) missingEssentialDeps.push('Utils');
    if (!this.Config) missingEssentialDeps.push('Config');

    if (missingEssentialDeps.length > 0) {
       const errorMsg = `App.init: Falha ao carregar módulos essenciais: ${missingEssentialDeps.join(', ')}. A aplicação não pode iniciar.`;
       console.error(errorMsg);
       this.Utils?.showNotification?.(errorMsg, 'error');
       document.body.innerHTML = `<div class="alert alert-danger m-5" role="alert"><strong>Erro Crítico:</strong> ${errorMsg} Verifique o console e recarregue a página.</div>`;
       return;
    }

    // Avisa se ApiClient não foi encontrado
    if (!this.ApiClient) {
       console.warn("App.init: ApiClient não encontrado. Operando em modo offline/cache.");
       this.AppState?.update('forceOffline', true);
    } else {
        if (!this.Config.API_URL && this.ApiClient?.apiUrl) {
           console.warn("API_URL não definida no Config, usando a interna do ApiClient.");
           this.Config.API_URL = this.ApiClient.apiUrl;
        } else if (!this.Config.API_URL) {
            console.error("API_URL não definida no Config nem no ApiClient!");
             this.Utils?.showNotification?.("Configuração da API não encontrada!", 'error');
        }
    }

    console.log("Módulos essenciais do App obtidos com sucesso.");

    // Configurar eventos da UI
    this.setupUIEvents();

    // CORREÇÃO: Testar a API antes de tentar sincronizar
    await this.testAPIConnection();

    // Verificar conectividade e tentar sincronizar
    await this.checkConnectivityAndSync();

    // Carregar lista de registros inicial
    await this.refreshRegistrosList();

    // Detectar modo pela URL
    this.handleUrlParams();

    console.log("App.init() concluído com sucesso.");
  },

  /**
   * Testa a conexão com a API
   */
  testAPIConnection: async function() {
    if (!this.Config?.API_URL || !navigator.onLine) {
      return false;
    }
    
    try {
      console.log("Testando conexão com a API...");
      const response = await fetch(this.Config.API_URL, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log("Conexão com a API estabelecida com sucesso!");
        return true;
      } else {
        console.warn(`Teste de API falhou: ${response.status} ${response.statusText}`);
        this.Utils?.showNotification?.(`Problema de comunicação com o servidor: ${response.status}`, 'warning');
        return false;
      }
    } catch (error) {
      console.error("Erro ao testar conexão com a API:", error);
      this.Utils?.showNotification?.("Não foi possível conectar ao servidor. Verificando conexão local...", 'warning');
      return false;
    }
  },

  /**
   * Configura os listeners de eventos para os botões principais e busca
   */
  setupUIEvents: function() {
    console.log("Configurando eventos da UI...");
    // Botão Novo Registro
    document.getElementById('btnNovoRegistro')?.addEventListener('click', () => {
      this.FormHandler?.newRegistro();
    });

    // Botão Lista de Registros
    document.getElementById('btnListaRegistros')?.addEventListener('click', () => {
       this.Utils?.showScreen?.('telaListaRegistros');
       this.refreshRegistrosList();
    });

    // Botão Voltar à Lista
    document.getElementById('btnVoltarLista')?.addEventListener('click', () => {
      this.Utils?.showScreen?.('telaListaRegistros');
       this.refreshRegistrosList();
    });

    // Campo de busca e botão
    const campoBusca = document.getElementById('buscaRegistro');
    const btnBuscar = document.getElementById('btnBuscar');

    btnBuscar?.addEventListener('click', () => {
      if (campoBusca) this.filterRegistros(campoBusca.value);
    });

    campoBusca?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && campoBusca) {
        this.filterRegistros(campoBusca.value);
      }
    });
    
    campoBusca?.addEventListener('input', () => {
      if (campoBusca.value.trim() === '') {
         this.filterRegistros('');
      }
    });

    // Botão de sincronização manual
    document.getElementById('btnSincronizar')?.addEventListener('click', () => {
      this.checkConnectivityAndSync(true); // true = forçar sincronização
    });

    console.log("Eventos da UI configurados.");
  },

  /**
   * Trata parâmetros de URL
   */
  handleUrlParams: function() {
    const params = new URLSearchParams(window.location.search);
    let actionTaken = false;

    if (params.has('view')) {
      const id = params.get('view');
      console.log(`URL param: view=${id}`);
      this.FormHandler?.viewRegistro(id);
      actionTaken = true;
    } else if (params.has('edit')) {
      const id = params.get('edit');
       console.log(`URL param: edit=${id}`);
      this.FormHandler?.loadRegistro(id);
      actionTaken = true;
    } else if (params.has('new')) {
       console.log(`URL param: new`);
      this.FormHandler?.newRegistro();
      actionTaken = true;
    }

    if (!actionTaken) {
       console.log("Nenhum parâmetro URL, exibindo lista.");
       this.Utils?.showScreen?.('telaListaRegistros');
       this.refreshRegistrosList();
    }

    if (params.toString() && window.history.replaceState) {
       console.log("Limpando parâmetros da URL.");
       window.history.replaceState({}, document.title, window.location.pathname);
    }
  },

  /**
   * Atualiza a lista de registros na tela
   */
  refreshRegistrosList: async function() {
    console.log("Atualizando lista de registros...");
    const tableBody = document.getElementById('listaRegistrosBody');
    if (!tableBody) {
       console.error("Elemento #listaRegistrosBody não encontrado.");
       return;
    }

    // Mostrar loading na tabela
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">
          <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
          <span class="ms-2 text-muted">Carregando registros...</span>
        </td>
      </tr>
    `;

    let registros = [];
    let errorOccurred = false;
    let errorMessage = '';

    try {
       // CORREÇÃO: Melhor verificação de estado online
       const isOnline = navigator.onLine && this.AppState?.get('online') !== false;
       
       if (this.ApiClient && isOnline) {
          console.log("Tentando buscar registros via API...");
          registros = await this.ApiClient.listarRegistros();
          console.log(`Recebidos ${registros?.length ?? 0} registros da API.`);
          this.AppState?.update('registros', registros || []);
       } else {
          const offlineMsg = this.ApiClient ? "Modo offline." : "ApiClient indisponível.";
          console.log(`Buscando registros do estado local. ${offlineMsg}`);
          registros = this.AppState?.get('registros') || [];
          if (registros.length > 0) {
             const msg = isOnline ? "Exibindo dados locais." : "Exibindo dados locais (offline).";
             this.Utils?.showNotification?.(msg, "info", 4000);
          }
       }
    } catch (error) {
       errorOccurred = true;
       errorMessage = error.message;
       console.error('Erro ao buscar registros:', errorMessage);
       registros = this.AppState?.get('registros') || [];
       this.Utils?.showNotification?.(`Erro ao buscar dados (${errorMessage}). Exibindo dados locais.`, 'warning');
    }

    // Limpar tabela (loading)
    tableBody.innerHTML = '';

    // Exibir registros ou mensagem
    if (!registros || registros.length === 0) {
        const colspan = 6;
        const message = errorOccurred
             ? `<div class="alert alert-danger mb-0"><i class="bi bi-exclamation-triangle me-2"></i> Erro: ${this.Utils?.sanitizeString(errorMessage) || 'Erro desconhecido'}</div>`
             : `<div class="alert alert-info mb-0"><i class="bi bi-info-circle me-2"></i> Nenhum registro encontrado. <button class="btn btn-sm btn-primary ms-3" id="btnNovoRegistroFromEmpty">Criar Novo Registro</button></div>`;
         tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-4">${message}</td></tr>`;
         document.getElementById('btnNovoRegistroFromEmpty')?.addEventListener('click', () => this.FormHandler?.newRegistro());
    } else {
        // Ordenar e exibir registros
        const registrosOrdenados = this.Utils?.ordenarPor(registros, 'dataCriacao', false) || registros;
        registrosOrdenados.forEach(registro => {
           if (!registro || !registro.id) {
              console.warn("Registro inválido encontrado:", registro);
              return;
           }
           this.addRegistroRow(tableBody, registro);
        });
    }
    console.log("Lista de registros atualizada na tela.");
  },

  /**
   * Adiciona uma linha de registro à tabela
   */
  addRegistroRow: function(tableBody, registro) {
      const row = tableBody.insertRow();
      row.setAttribute('data-registro-id', registro.id);

      const sanitize = this.Utils?.sanitizeString || (s => s || '');
      const formatDT = this.Utils?.formatarDataHora || (d => d ? new Date(d).toLocaleString() : '--');

      let statusBadge = '<span class="badge bg-secondary">Pendente</span>';
      if (registro.dataFinalizacao) { statusBadge = `<span class="badge bg-success">Concluído</span>`; }
      else if (Object.keys(registro).some(k => k.startsWith('checklist_') && k.endsWith('Pos') && registro[k])) { statusBadge = `<span class="badge bg-info text-dark">Pós Iniciado</span>`; }
      else if (registro.descricaoProblema || registro.fotosPre?.length > 0) { statusBadge = `<span class="badge bg-warning text-dark">Pré Iniciado</span>`; }

      row.innerHTML = `
        <td><small>${sanitize(registro.id)}</small></td>
        <td>${sanitize(registro.placa)}</td>
        <td>${sanitize(registro.modelo)}</td>
        <td><small>${formatDT(registro.dataCriacao)}</small></td>
        <td>${statusBadge}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary btn-view" data-id="${sanitize(registro.id)}" title="Visualizar">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-warning btn-edit ms-1" data-id="${sanitize(registro.id)}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-delete ms-1" data-id="${sanitize(registro.id)}" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;

      row.querySelector('.btn-view')?.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if(id) this.FormHandler?.viewRegistro(id);
      });
      row.querySelector('.btn-edit')?.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if(id) this.FormHandler?.loadRegistro(id);
      });
      row.querySelector('.btn-delete')?.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const placa = sanitize(registro.placa);
          if(id && confirm(`Tem certeza que deseja excluir o registro da placa ${placa} (ID: ${id})? Esta ação não pode ser desfeita.`)) {
             if (!this.ApiClient) {
                 this.Utils?.showNotification?.("Exclusão offline não implementada ou API indisponível.", "error");
                 return;
             }
             this.Utils?.showLoading?.(true, `Excluindo registro ${id}...`);
             try {
                 const result = await this.ApiClient.excluirRegistro(id);
                 if(result && result.success !== false) {
                    this.Utils?.showNotification?.(`Registro ${id} (${placa}) excluído com sucesso.`, 'success');
                    row.remove();
                 } else {
                    throw new Error(result?.message || "Falha ao excluir na API.");
                 }
             } catch (error) {
                 console.error(`Erro ao excluir ${id}:`, error);
                 this.Utils?.showNotification?.(`Erro ao excluir registro: ${error.message}`, 'error');
             } finally {
                this.Utils?.hideLoading?.();
             }
          }
      });
  },

  /**
   * Filtra os registros exibidos na tabela localmente
   */
  filterRegistros: function(termo) {
    const tableBody = document.getElementById('listaRegistrosBody');
    if (!tableBody) return;
    const rows = tableBody.querySelectorAll('tr[data-registro-id]');
    const termoLimpo = this.Utils?.removerAcentos(termo.toLowerCase().trim()) || '';

    let found = false;
    rows.forEach(row => {
        const id = row.cells[0]?.textContent?.toLowerCase() || '';
        const placa = row.cells[1]?.textContent?.toLowerCase() || '';
        const modelo = row.cells[2]?.textContent?.toLowerCase() || '';

        const match = termoLimpo === '' || 
                      id.includes(termoLimpo) ||
                      placa.includes(termoLimpo) ||
                      modelo.includes(termoLimpo);

        row.style.display = match ? '' : 'none';
        if (match) found = true;
    });

    let noResultsRow = tableBody.querySelector('.no-results-message');
    if (!found && termoLimpo !== '') {
        if (!noResultsRow) {
            noResultsRow = tableBody.insertRow();
            noResultsRow.className = 'no-results-message';
            noResultsRow.innerHTML = `<td colspan="6" class="text-center text-muted py-3 fst-italic">Nenhum registro encontrado para "${this.Utils?.sanitizeString(termo)}".</td>`;
        }
    } else if (noResultsRow) {
        noResultsRow.remove();
    }
  },

  /**
   * Verifica a conectividade e tenta sincronizar requisições offline pendentes
   * @param {boolean} forceSync Forçar sincronização mesmo se parecer offline
   */
  checkConnectivityAndSync: async function(forceSync = false) {
    const wasOnline = this.AppState?.get('online') === true;
    const isOnline = navigator.onLine || forceSync;
    this.AppState?.update('online', isOnline);

    if (!isOnline && !forceSync) {
      console.log('App: Sistema em modo offline. Sincronização adiada.');
      if (wasOnline) {
        this.Utils?.showNotification?.('Dispositivo está offline. Dados serão salvos localmente.', 'warning');
      }
      return false;
    }

    // CORREÇÃO: Verificação mais robusta antes de sincronizar
    if (!this.ApiClient || typeof this.ApiClient.syncOfflineRequests !== 'function') {
      console.warn("App: ApiClient ou syncOfflineRequests indisponível.");
      return false;
    }
    
    if (!this.Config?.API_URL) {
      console.warn('App: API URL não configurada. Não é possível sincronizar.');
      return false;
    }
    
    // CORREÇÃO: Limitar o número de tentativas de sincronização
    const maxAttempts = this.Config?.SYNC?.MAX_RETRIES || 1;
    let attempt = 0;
    let success = false;
    
    while (attempt < maxAttempts && !success) {
      attempt++;
      try {
        console.log(`App: Tentativa ${attempt}/${maxAttempts} de sincronização...`);
        const syncResult = await this.ApiClient.syncOfflineRequests();
        
        if (syncResult) {
          if (syncResult.syncedCount > 0) {
            this.Utils?.showNotification?.(`Sincronização: ${syncResult.syncedCount} ação(ões) enviada(s) com sucesso.`, 'success', 5000);
            await this.refreshRegistrosList();
            success = true;
          } else if (syncResult.errorCount > 0 && syncResult.pendingCount > 0) {
            console.warn(`Sincronização: ${syncResult.errorCount} erros. Restam ${syncResult.pendingCount} ações pendentes.`);
            if (attempt < maxAttempts) {
              const delay = this.Config?.SYNC?.RETRY_DELAY || 5000;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } else if (syncResult.pendingCount === 0) {
            console.log("App: Nenhuma requisição offline pendente para sincronizar.");
            success = true;
          }
        }
      } catch (error) {
        console.error(`App: Erro na tentativa ${attempt} de sincronização:`, error);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    return success;
  }
};
