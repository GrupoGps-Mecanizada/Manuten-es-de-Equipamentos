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
    console.log("App.init() iniciado..."); //

    // Obter referências aos módulos carregados e objetos globais
    this.AppState = ModuleLoader.get('state'); //
    this.PhotoHandler = ModuleLoader.get('photoHandler'); //
    this.FormHandler = ModuleLoader.get('formHandler'); //
    this.Utils = window.Utils; // <- Agora pega a versão com contador
    this.Config = window.CONFIG; //
    // Assume que apiClient pode ou não chamar loading, mas Utils gerencia corretamente
    this.ApiClient = ModuleLoader.get('apiClient');

    // Verificação de dependências críticas
    let missingEssentialDeps = []; //
    if (!this.AppState) missingEssentialDeps.push('AppState'); //
    if (!this.PhotoHandler) missingEssentialDeps.push('PhotoHandler'); //
    if (!this.FormHandler) missingEssentialDeps.push('FormHandler'); //
    if (!this.Utils) missingEssentialDeps.push('Utils'); //
    if (!this.Config) missingEssentialDeps.push('Config'); //

    if (missingEssentialDeps.length > 0) { //
        const errorMsg = `App.init: Falha ao carregar módulos essenciais: ${missingEssentialDeps.join(', ')}. A aplicação não pode iniciar.`; //
        console.error(errorMsg); //
        this.Utils?.showNotification?.(errorMsg, 'error'); //
        document.body.innerHTML = `<div class="alert alert-danger m-5" role="alert"><strong>Erro Crítico:</strong> ${errorMsg} Verifique o console e recarregue a página.</div>`; //
        return; // Interrompe a inicialização
    }

    // Avisa se ApiClient não foi encontrado
    if (!this.ApiClient) { //
        console.error("App.init: ApiClient não foi encontrado ou carregado via ModuleLoader. Operando em modo offline forçado."); //
        this.AppState?.update('apiOnline', false); //
        this.AppState?.update('forceOffline', true); //
        this.Utils?.showNotification?.("Erro: Módulo API não carregado. Funcionalidade online desativada.", 'error'); //
    } else {
        // Verifica se a URL da API está configurada
        if (!this.Config.API_URL) { //
            console.error("App.init: API_URL não definida no Config! O ApiClient não funcionará."); //
            this.Utils?.showNotification?.("Erro crítico: URL da API não configurada!", 'error'); //
             this.AppState?.update('apiOnline', false); //
        }
    }

    console.log("App: Módulos essenciais do App obtidos com sucesso."); //

    // Configurar listeners de eventos da UI
    this.setupUIEvents(); //

    // Testa a conexão usando o ApiClient (loading gerenciado pelo contador do Utils)
    if(this.ApiClient && this.Config.API_URL) { //
        await this.testAPIConnection(); //
    } else {
        console.warn("App: Pulando teste de conexão API devido a problemas de configuração ou ApiClient."); //
        this.AppState?.update('apiOnline', false); //
    }

    // Verificar conectividade e tentar sincronizar (loading gerenciado pelo contador do Utils)
    await this.checkConnectivityAndSync(); //

    // Carregar lista de registros inicial (sem loading global explícito aqui)
    await this.refreshRegistrosList(); //

    // Tratar parâmetros da URL
    this.handleUrlParams(); //

    console.log("App.init() concluído com sucesso."); //
  },

  /**
   * Testa a conexão com a API usando o ApiClient
   * Chama showLoading/hideLoading, gerenciados pelo contador em Utils.
   * @returns {Promise<boolean>} True se a conexão foi bem-sucedida, False caso contrário.
   */
  testAPIConnection: async function() {
    if (!this.ApiClient || typeof this.ApiClient.ping !== 'function') {
        console.error("App.testAPIConnection: ApiClient ou função 'ping' indisponível.");
        this.AppState?.update('apiOnline', false);
        return false;
    }

    console.log("App: Testando conexão com a API via ApiClient.ping...");
    this.Utils?.showLoading?.("Verificando conexão..."); // Incrementa contador
    let isSuccess = false;
    try {
      const response = await this.ApiClient.ping(); // ApiClient não gerencia mais loader
      if (response && response.success === true && response.message === "pong") {
        console.log("App: Conexão com a API bem-sucedida!", response);
        this.AppState?.update('apiOnline', true);
        this.Utils?.showNotification?.('Conectado ao servidor.', 'success', 2000);
        isSuccess = true;
      } else {
        console.warn("App: Resposta inesperada do ping da API:", response);
        this.AppState?.update('apiOnline', false);
        this.Utils?.showNotification?.('Servidor respondeu inesperadamente.', 'warning');
        isSuccess = false;
      }
    } catch (error) {
      console.error("App: Erro ao testar conexão com a API:", error.message || error);
      this.AppState?.update('apiOnline', false);
      isSuccess = false;
    } finally {
        this.Utils?.hideLoading?.(); // Decrementa contador
    }
    return isSuccess;
  },

  /**
   * Configura os listeners de eventos para os botões principais e busca
   */
  setupUIEvents: function() {
    console.log("App: Configurando eventos da UI..."); //
    document.getElementById('btnNovoRegistro')?.addEventListener('click', () => { //
      this.FormHandler?.newRegistro(); //
    });
    document.getElementById('btnListaRegistros')?.addEventListener('click', () => { //
       this.Utils?.showScreen?.('telaListaRegistros'); //
       this.refreshRegistrosList(); //
    });
    document.getElementById('btnVoltarLista')?.addEventListener('click', () => { //
      this.Utils?.showScreen?.('telaListaRegistros'); //
       this.refreshRegistrosList(); //
    });

    const campoBusca = document.getElementById('buscaRegistro'); //
    const btnBuscar = document.getElementById('btnBuscar'); //
    btnBuscar?.addEventListener('click', () => { //
      if (campoBusca) this.filterRegistros(campoBusca.value); //
    });
    campoBusca?.addEventListener('keypress', (e) => { //
      if (e.key === 'Enter' && campoBusca) { this.filterRegistros(campoBusca.value); } //
    });
    campoBusca?.addEventListener('input', () => { //
      if (campoBusca) { this.filterRegistros(campoBusca.value); } //
    });
    document.getElementById('btnSincronizar')?.addEventListener('click', () => { //
      // Chama checkConnectivityAndSync (loading gerenciado pelo contador do Utils)
      this.checkConnectivityAndSync(true); // Forçar sync
    });
    console.log("App: Eventos da UI configurados."); //
  },

  /**
   * Trata parâmetros de URL para navegação inicial (ex: ?view=ID)
   */
  handleUrlParams: function() {
    const params = new URLSearchParams(window.location.search); //
    let actionTaken = false; //
    try {
        if (params.has('view')) { //
          const id = params.get('view'); //
          console.log(`App: URL param: view=${id}`); //
          this.FormHandler?.viewRegistro(id); //
          actionTaken = true; //
        } else if (params.has('edit')) { //
          const id = params.get('edit'); //
           console.log(`App: URL param: edit=${id}`); //
          this.FormHandler?.loadRegistro(id); //
          actionTaken = true; //
        } else if (params.has('new')) { //
           console.log(`App: URL param: new`); //
          this.FormHandler?.newRegistro(); //
          actionTaken = true; //
        }
    } catch (error) {
        console.error("App: Erro ao processar parâmetros da URL:", error); //
         this.Utils?.showNotification?.("Erro ao carregar visão da URL.", 'error'); //
         actionTaken = false; //
    }
    if (!actionTaken) { //
       console.log("App: Nenhum parâmetro URL de ação, exibindo lista."); //
       this.Utils?.showScreen?.('telaListaRegistros'); //
    }
    // Limpa a URL APÓS o processamento dos parâmetros
    if (params.toString() && window.history.replaceState) { //
       console.log("App: Limpando parâmetros da URL."); //
       const cleanUrl = window.location.pathname + window.location.hash; // Mantém o hash se houver
       window.history.replaceState({}, document.title, cleanUrl); //
    }
  },

  /**
   * Atualiza a lista de registros na tabela da UI.
   * Usa placeholder na tabela, não chama loading global.
   */
  refreshRegistrosList: async function() {
    console.log("App: Atualizando lista de registros..."); //
    const tableBody = document.getElementById('listaRegistrosBody'); //
    if (!tableBody) { //
        console.error("App: Elemento #listaRegistrosBody não encontrado no DOM."); //
        return; //
    }

    // Insere placeholder de carregamento na tabela
    tableBody.innerHTML = `
      <tr id="loading-row-placeholder">
        <td colspan="6" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
          Carregando registros...
        </td>
      </tr>
    `;

    let registros = [];
    let errorOccurred = false;
    let errorMessage = '';
    const isCurrentlyOnline = this.AppState?.get('apiOnline') === true; // Usa apiOnline

    try {
        if (this.ApiClient && isCurrentlyOnline) {
          console.log("App: Tentando buscar registros via API (ApiClient)...");
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao listar registros (10s)")), 10000));
          // ApiClient.listarRegistros() não deve mais gerenciar loading
          const apiResult = await Promise.race([this.ApiClient.listarRegistros(), timeoutPromise]);
          if (Array.isArray(apiResult)) {
              registros = apiResult;
              console.log(`App: Recebidos ${registros.length} registros da API.`);
              this.AppState?.update('registros', registros); // Atualiza o estado local
          } else {
              console.warn("App: Resposta inesperada de listarRegistros da API:", apiResult);
              errorMessage = apiResult?.message || "Formato de resposta inválido da API";
              errorOccurred = true;
              registros = this.AppState?.get('registros') || []; // Usa cache local como fallback
              this.Utils?.showNotification?.(`Erro (${errorMessage}). Exibindo dados locais.`, 'warning');
          }
        } else {
          const offlineMsg = this.ApiClient ? "Modo offline." : "ApiClient indisponível.";
          console.log(`App: Buscando registros do estado local. ${offlineMsg}`);
          registros = this.AppState?.get('registros') || []; // Pega do cache local
          if (registros.length === 0 && !this.ApiClient) {
             errorMessage = "Nenhum dado local e API indisponível.";
             errorOccurred = true;
          } else if (registros.length > 0 && !isCurrentlyOnline) {
             this.Utils?.showNotification?.("Exibindo dados locais (offline).", "info", 3000);
          }
        }
    } catch (error) {
        errorOccurred = true;
        errorMessage = error.message || "Erro desconhecido";
        console.error('App: Erro ao buscar/processar registros:', errorMessage, error);
        registros = this.AppState?.get('registros') || []; // Usa cache local como fallback
        this.Utils?.showNotification?.(`Erro ao buscar (${errorMessage}). Exibindo dados locais.`, 'warning');
    } finally {
        // Remove a linha de loading placeholder da tabela
        const loadingRow = tableBody.querySelector('#loading-row-placeholder');
        if (loadingRow) loadingRow.remove();
    }

    // Exibir registros ou mensagem de erro/vazio
    if (!registros || registros.length === 0) {
      const colspan = 6;
      let message = '';
      if (errorOccurred) {
          message = `<div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle me-2"></i> Falha ao carregar: ${this.Utils?.sanitizeString(errorMessage)}</div>`;
      } else {
          message = `<div class="alert alert-secondary mb-0"><i class="bi bi-info-circle me-2"></i> Nenhum registro encontrado. <button class="btn btn-sm btn-link p-0 ms-2" id="btnNovoRegistroFromEmpty">Criar Novo</button></div>`;
      }
       tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-3">${message}</td></tr>`;
       document.getElementById('btnNovoRegistroFromEmpty')?.addEventListener('click', () => this.FormHandler?.newRegistro());
    } else {
        tableBody.innerHTML = '';
        const registrosOrdenados = this.Utils?.ordenarPor(registros, 'dataCriacao', false) || registros;
        registrosOrdenados.forEach(registro => {
           if (!registro || !registro.id) {
             console.warn("App: Registro inválido ou sem ID encontrado:", registro);
             return;
           }
           this.addRegistroRow(tableBody, registro);
        });
    }
    console.log("App: Lista de registros renderizada na tela.");
    const campoBusca = document.getElementById('buscaRegistro');
    if (campoBusca?.value) {
        this.filterRegistros(campoBusca.value);
    }
  }, // Fim de refreshRegistrosList

  /**
   * Adiciona uma linha (<tr>) representando um registro à tabela (<tbody>)
   */
  addRegistroRow: function(tableBody, registro) {
      const row = tableBody.insertRow();
      row.setAttribute('data-registro-id', registro.id);

      const sanitize = this.Utils?.sanitizeString || (s => s || '');
      const formatDT = this.Utils?.formatarDataHora || (d => d ? new Date(d).toLocaleString() : '--');

      let statusText = registro.status || 'Pendente';
      const statusClasses = {
           'Pendente': 'bg-secondary', 'Pré-Registrado': 'bg-warning text-dark',
           'Em Andamento': 'bg-info text-dark', 'Concluído': 'bg-success', 'Cancelado': 'bg-danger',
      };
      const statusBadge = `<span class="badge ${statusClasses[statusText] || 'bg-light text-dark'}">${sanitize(statusText)}</span>`;

      row.innerHTML = `
        <td><small class="text-monospace">${sanitize(registro.id)}</small></td>
        <td>${sanitize(registro.placa)}</td>
        <td>${sanitize(registro.modelo)}</td>
        <td><small>${formatDT(registro.dataCriacao)}</small></td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center actions-cell">
          <button class="btn btn-sm btn-outline-primary btn-view" data-id="${sanitize(registro.id)}" title="Visualizar"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-secondary btn-edit ms-1" data-id="${sanitize(registro.id)}" title="Editar"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-delete ms-1" data-id="${sanitize(registro.id)}" title="Excluir"><i class="bi bi-trash"></i></button>
        </td>
      `;

      // Adiciona listeners aos botões da linha
      row.querySelector('.btn-view')?.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id'); if(id) this.FormHandler?.viewRegistro(id);
      });
      row.querySelector('.btn-edit')?.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id'); if(id) this.FormHandler?.loadRegistro(id);
      });
      row.querySelector('.btn-delete')?.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const placa = sanitize(registro.placa);
          const modelo = sanitize(registro.modelo);
          if(id && confirm(`Tem certeza que deseja EXCLUIR o registro:\n\nID: ${id}\nPlaca: ${placa}\nModelo: ${modelo}\n\nEsta ação não pode ser desfeita.`)) {
             if (!this.ApiClient || !this.AppState?.get('apiOnline')) {
                 this.Utils?.showNotification?.("Exclusão só é possível online.", "warning"); return;
             }
             // Opcional: Mostrar loading para delete (gerenciado pelo contador)
             // this.Utils?.showLoading?.(`Excluindo registro ${id}...`);
             let deleteSuccess = false;
             try {
                 const result = await this.ApiClient.excluirRegistro(id); // ApiClient não gerencia loader
                 if(result && result.success !== false) {
                    this.Utils?.showNotification?.(`Registro ${id} (${placa}) excluído com sucesso.`, 'success');
                    row.remove();
                    let currentRegistros = this.AppState?.get('registros') || [];
                    this.AppState?.update('registros', currentRegistros.filter(r => r.id !== id));
                    if (tableBody.rows.length === 0) { this.refreshRegistrosList(); }
                    deleteSuccess = true;
                 } else {
                    throw new Error(result?.message || "Falha ao excluir na API.");
                 }
             } catch (error) {
                 console.error(`App: Erro ao excluir registro ${id}:`, error);
                 this.Utils?.showNotification?.(`Erro ao excluir registro: ${error.message}`, 'error');
                 deleteSuccess = false;
             } finally {
                 // Opcional: Esconder loading para delete (gerenciado pelo contador)
                 // this.Utils?.hideLoading?.();
             }
          }
      });
  },

  /**
   * Filtra os registros VISÍVEIS na tabela com base no termo de busca
   */
  filterRegistros: function(termo) {
    const tableBody = document.getElementById('listaRegistrosBody');
    if (!tableBody) return;
    const rows = tableBody.querySelectorAll('tr[data-registro-id]');
    const termoLimpo = this.Utils?.removerAcentos(termo.toLowerCase().trim()) || '';
    let visibleCount = 0;

    rows.forEach(row => {
        const id = row.cells[0]?.textContent?.toLowerCase() || '';
        const placa = row.cells[1]?.textContent?.toLowerCase() || '';
        const modelo = row.cells[2]?.textContent?.toLowerCase() || '';
        const status = row.cells[4]?.textContent?.toLowerCase().trim() || '';
        const match = termoLimpo === '' ||
                      id.includes(termoLimpo) ||
                      placa.includes(termoLimpo) ||
                      modelo.includes(termoLimpo) ||
                      status.includes(termoLimpo);
        row.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    });

    let noResultsRow = tableBody.querySelector('.no-results-message');
    if (visibleCount === 0 && termoLimpo !== '' && rows.length > 0) {
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
 * Verifica a conectividade de rede e tenta sincronizar requisições offline.
 */
checkConnectivityAndSync: async function(forceSync = false) {
  // Garantir que qualquer spinner prévio esteja escondido
  this.Utils?.hideLoading?.();
  
  // Se não for forçado e a sincronização estiver em modo debug, apenas retorna
  if (!forceSync && window.CONFIG?.DEBUG) {
    console.log(`App: Sincronização não forçada em modo DEBUG. Pulando...`);
    return false;
  }
  
  const wasOnline = this.AppState?.get('apiOnline') === true;
  const canAttemptSync = (navigator.onLine && this.AppState?.get('forceOffline') !== true) || forceSync;

  this.AppState?.update('online', navigator.onLine);
  if (!forceSync) {
    if (wasOnline && !navigator.onLine) { 
      this.Utils?.showNotification?.('Dispositivo offline. Ações serão salvas localmente.', 'warning'); 
    }
    else if (!wasOnline && navigator.onLine) { 
      this.Utils?.showNotification?.('Conexão restaurada.', 'info', 3000); 
    }
  }

  if (!canAttemptSync) {
    console.log('App: Sincronização não será tentada (offline ou forçado offline).');
    return false;
  }
  
  if (!this.ApiClient || typeof this.ApiClient.syncOfflineRequests !== 'function') {
    console.warn("App: ApiClient ou syncOfflineRequests indisponível.");
    return false;
  }
  
  if (!this.Config?.API_URL) {
    console.warn('App: API URL não configurada. Não é possível sincronizar.');
    return false;
  }

  console.log(`App: Verificando ${forceSync ? 'e forçando ' : ''}sincronização...`);
  
  // Mostrar loading explicitamente apenas se não estiver no modo debug
  if (!window.CONFIG?.DEBUG) {
    this.Utils?.showLoading?.("Sincronizando dados...");
  }

  let success = false;

  try {
    const syncResult = await this.ApiClient.syncOfflineRequests();
    if (syncResult) {
      if (syncResult.synced > 0) {
        console.log(`App: Sincronização bem-sucedida de ${syncResult.synced} itens.`);
        await this.refreshRegistrosList();
        this.Utils?.showNotification?.(`${syncResult.synced} ação(ões) sincronizada(s).`, 'success', 3000);
      } else if (syncResult.pending > 0) {
        console.log(`App: Sincronização concluída, ${syncResult.pending} ações pendentes.`);
        if(syncResult.dropped > 0 || syncResult.tempFail > 0){
          this.Utils?.showNotification?.(`Algumas ações (${syncResult.dropped + syncResult.tempFail}) falharam ao sincronizar.`, 'warning', 5000);
        } else if (forceSync) {
          this.Utils?.showNotification?.(`Ainda há ${syncResult.pending} ações pendentes.`, 'info', 3000);
        }
      } else if (syncResult.pending === 0 && syncResult.synced === 0) {
        console.log("App: Nenhuma ação pendente para sincronizar.");
        if(forceSync) {
          this.Utils?.showNotification?.(`Nenhuma ação pendente para sincronizar.`, 'info', 3000);
        }
      }
      success = syncResult.success !== false;
    } else {
      throw new Error("syncOfflineRequests retornou resultado inválido.");
    }
  } catch (error) {
    console.error(`App: Erro durante a sincronização:`, error);
    this.Utils?.showNotification?.(`Erro ao sincronizar: ${error.message}`, 'error');
    success = false;
  } finally {
    // Garante que o spinner seja escondido, mesmo em caso de erro
    this.Utils?.hideLoading?.();
    console.log(`App: Finalizando verificação de sincronização. Sucesso: ${success}`);
  }
  return success;
} // Fim de checkConnectivityAndSync

}; // Fim do objeto App

// Assumindo que main.js chama App.init() após carregar todos os módulos.
