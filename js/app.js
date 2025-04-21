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
   * Inicializa a aplicação. Obtém módulos, configura UI e carrega dados iniciais.
   */
  init: async function() {
    console.log("App.init() iniciado...");

    // Obter referências (essenciais primeiro)
    this.AppState = ModuleLoader.get('state');
    this.PhotoHandler = ModuleLoader.get('photoHandler');
    this.FormHandler = ModuleLoader.get('formHandler');
    this.Utils = window.Utils;
    this.Config = window.CONFIG;
    // Tenta obter ApiClient (pode ser opcional para modo offline)
    this.ApiClient = ModuleLoader.get('apiClient');

    // --- VERIFICAÇÃO DE DEPENDÊNCIAS CRÍTICAS ---
    let missingEssentialDeps = [];
    if (!this.AppState) missingEssentialDeps.push('AppState');
    if (!this.PhotoHandler) missingEssentialDeps.push('PhotoHandler');
    if (!this.FormHandler) missingEssentialDeps.push('FormHandler'); // Precisa do FormHandler para operar
    if (!this.Utils) missingEssentialDeps.push('Utils');
    if (!this.Config) missingEssentialDeps.push('Config');

    if (missingEssentialDeps.length > 0) {
       const errorMsg = `App.init: Falha ao carregar módulos essenciais: ${missingEssentialDeps.join(', ')}. A aplicação não pode iniciar.`;
       console.error(errorMsg);
       // Tenta notificar antes de parar
       this.Utils?.showNotification?.(errorMsg, 'error');
       // Interrompe a execução mostrando erro na tela
       document.body.innerHTML = `<div class="alert alert-danger m-5" role="alert"><strong>Erro Crítico:</strong> ${errorMsg} Verifique o console e recarregue a página.</div>`;
       return; // Para init()
    }

    // Avisa se ApiClient não foi encontrado, mas continua
    if (!this.ApiClient) {
       console.warn("App.init: ApiClient não encontrado. Operando em modo offline/cache.");
       this.AppState?.update('forceOffline', true); // Sinaliza modo offline
       // Poderia desabilitar botões que dependem da API aqui
    } else {
        // Configura URL da API se não estiver no Config (fallback menos ideal)
        if (!this.Config.API_URL && this.ApiClient?.apiUrl) {
           console.warn("API_URL não definida no Config, usando a interna do ApiClient (se houver).");
           this.Config.API_URL = this.ApiClient.apiUrl;
        } else if (!this.Config.API_URL) {
            console.error("API_URL não definida no Config nem no ApiClient!");
             this.Utils?.showNotification?.("Configuração da API não encontrada!", 'error');
        }
    }
    // --- FIM DA VERIFICAÇÃO ---

    console.log("Módulos essenciais do App obtidos com sucesso.");

    // Configurar eventos da UI (agora usando this.FormHandler, this.Utils)
    this.setupUIEvents();

    // Verificar conectividade e tentar sincronizar (usa this.ApiClient)
    await this.checkConnectivityAndSync();

    // Carregar lista de registros inicial (usa this.ApiClient e this.AppState)
    await this.refreshRegistrosList();

    // Detectar modo (novo, edição, visualização) pela URL (usa this.FormHandler)
    this.handleUrlParams();

    console.log("App.init() concluído com sucesso.");
  },

  /**
   * Configura os listeners de eventos para os botões principais e busca.
   */
  setupUIEvents: function() {
    console.log("Configurando eventos da UI...");
    // Botão Novo Registro
    document.getElementById('btnNovoRegistro')?.addEventListener('click', () => {
      // Usa a referência do FormHandler armazenada em 'this'
      this.FormHandler?.newRegistro();
    });

    // Botão Lista de Registros
    document.getElementById('btnListaRegistros')?.addEventListener('click', () => {
       this.Utils?.showScreen?.('telaListaRegistros'); // Usa Utils para mostrar tela
       this.refreshRegistrosList(); // Atualiza a lista ao voltar para ela
    });

    // Botão Voltar à Lista (da visualização) - pode ser redundante se o formHandler já tem
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
     // Listener para limpar busca quando campo fica vazio
     campoBusca?.addEventListener('input', () => {
        if (campoBusca.value.trim() === '') {
           this.filterRegistros(''); // Chama filtro com termo vazio para resetar
        }
     });


     // Eventos internos dos formulários são gerenciados pelo FormHandler.
     // Eventos dos botões de view/edit/delete na lista são adicionados em refreshRegistrosList.
     console.log("Eventos da UI configurados.");
  },

  /**
   * Trata parâmetros de URL (?view=ID, ?edit=ID, ?new=1) para abrir a tela correta.
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

    // Se nenhuma ação foi tomada pelos parâmetros, mostra a lista
    if (!actionTaken) {
       console.log("Nenhum parâmetro de URL relevante, exibindo lista.");
       this.Utils?.showScreen?.('telaListaRegistros');
       // Garante que a lista seja atualizada se nenhuma outra tela foi carregada
       this.refreshRegistrosList();
    }

    // Limpa parâmetros da URL após processar para evitar reprocessamento
    if (params.toString() && window.history.replaceState) {
       console.log("Limpando parâmetros da URL.");
       window.history.replaceState({}, document.title, window.location.pathname);
    }
  },

  /**
   * Atualiza a lista de registros na tela, buscando da API ou do cache/estado.
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
       // Tenta buscar online se ApiClient existe e estamos online
       if (this.ApiClient && navigator.onLine) {
          console.log("Tentando buscar registros via API...");
          registros = await this.ApiClient.listarRegistros(); // Espera a Promise resolver
          console.log(`Recebidos ${registros?.length ?? 0} registros da API.`);
          // Atualiza o cache/estado local com os dados frescos da API
          this.AppState?.update('registros', registros || []);
       } else {
          // Busca do estado/cache local se offline ou sem ApiClient
          const offlineMsg = this.ApiClient ? "Modo offline." : "ApiClient indisponível.";
          console.log(`Buscando registros do estado local. ${offlineMsg}`);
          registros = this.AppState?.get('registros') || [];
          if (registros.length > 0 && navigator.onLine && this.ApiClient) {
             // Avisa que está mostrando dados locais apesar de estar online (API pode ter falhado antes)
             this.Utils?.showNotification?.("Exibindo dados locais. Pode haver dados mais recentes online.", "info", 4000);
          } else if (!navigator.onLine) {
             this.Utils?.showNotification?.("Exibindo dados locais (offline).", "info", 4000);
          }
       }
    } catch (error) {
       errorOccurred = true;
       errorMessage = error.message;
       console.error('Erro ao buscar registros:', errorMessage);
       console.log("Falha na API. Tentando usar estado local como fallback...");
       registros = this.AppState?.get('registros') || []; // Usa o que tiver no estado
       this.Utils?.showNotification?.(`Erro ao buscar dados (${errorMessage}). Exibindo dados locais.`, 'warning');
    }

    // Limpar tabela (loading)
    tableBody.innerHTML = '';

    // Exibir registros ou mensagem de erro/nenhum registro
    if (!registros || registros.length === 0) {
        let colspan = 6; // Número de colunas na tabela
        let message = errorOccurred
             ? `<div class="alert alert-danger mb-0"><i class="bi bi-exclamation-triangle me-2"></i> Erro ao carregar: ${this.Utils?.sanitizeString(errorMessage) || 'Erro desconhecido'}</div>`
             : `<div class="alert alert-info mb-0"><i class="bi bi-info-circle me-2"></i> Nenhum registro encontrado. <button class="btn btn-sm btn-primary ms-3" id="btnNovoRegistroFromEmpty">Criar Novo Registro</button></div>`;
         tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-4">${message}</td></tr>`;
         document.getElementById('btnNovoRegistroFromEmpty')?.addEventListener('click', () => this.FormHandler?.newRegistro());
    } else {
        // Ordenar registros (usa Utils.ordenarPor)
        const registrosOrdenados = this.Utils?.ordenarPor(registros, 'dataCriacao', false) || registros; // false = decrescente

        // Adicionar linhas à tabela
        registrosOrdenados.forEach(registro => {
           if (!registro || !registro.id) {
              console.warn("Registro inválido encontrado:", registro);
              return; // Pula registro inválido
           }
           this.addRegistroRow(tableBody, registro); // Chama função auxiliar para adicionar linha
        });
    }
     console.log("Lista de registros atualizada na tela.");
  },

  /**
   * Adiciona uma linha de registro à tabela.
   * @param {HTMLElement} tableBody - O elemento tbody da tabela.
   * @param {Object} registro - O objeto do registro.
   */
  addRegistroRow: function(tableBody, registro) {
      const row = tableBody.insertRow(); // Cria nova linha
      row.setAttribute('data-registro-id', registro.id);

      // Funções auxiliares para sanitizar e formatar
      const sanitize = this.Utils?.sanitizeString || (s => s || '');
      const formatDT = this.Utils?.formatarDataHora || (d => d ? new Date(d).toLocaleString() : '--');

      // Status Badge Logic
      let statusBadge = '<span class="badge bg-secondary">Pendente</span>';
      if (registro.dataFinalizacao) { statusBadge = `<span class="badge bg-success">Concluído</span>`; }
      else if (Object.keys(registro).some(k => k.startsWith('checklist_') && k.endsWith('Pos') && registro[k])) { statusBadge = `<span class="badge bg-info text-dark">Pós Iniciado</span>`; }
      else if (registro.descricaoProblema || registro.fotosPre?.length > 0) { statusBadge = `<span class="badge bg-warning text-dark">Pré Iniciado</span>`; }

      // Células da Tabela
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

      // Adicionar Event Listeners aos Botões da Linha
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
          const placa = sanitize(registro.placa); // Pega a placa para mensagem
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
                    // Remove a linha da tabela visualmente ou atualiza a lista inteira
                    row.remove(); // Remove a linha específica
                    // Ou this.refreshRegistrosList(); // Atualiza tudo
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
   * Filtra os registros exibidos na tabela localmente (sem recarregar da API).
   * @param {string} termo - O termo de busca.
   */
  filterRegistros: function(termo) {
    const tableBody = document.getElementById('listaRegistrosBody');
    if (!tableBody) return;
    const rows = tableBody.querySelectorAll('tr[data-registro-id]'); // Pega apenas linhas de dados
    const termoLimpo = this.Utils?.removerAcentos(termo.toLowerCase().trim()) || '';

    let found = false;
    rows.forEach(row => {
        // Pega o conteúdo de texto de células específicas para busca
        const id = row.cells[0]?.textContent?.toLowerCase() || '';
        const placa = row.cells[1]?.textContent?.toLowerCase() || '';
        const modelo = row.cells[2]?.textContent?.toLowerCase() || '';
        // Adicione mais campos se necessário (ex: data, status, responsável...)
        // const data = row.cells[3]?.textContent?.toLowerCase() || '';
        // const status = row.cells[4]?.textContent?.toLowerCase() || '';

        // Verifica se alguma célula contém o termo
        const match = termoLimpo === '' || // Mostra tudo se termo vazio
                      id.includes(termoLimpo) ||
                      placa.includes(termoLimpo) ||
                      modelo.includes(termoLimpo);

        row.style.display = match ? '' : 'none'; // Mostra ou esconde a linha
        if (match) found = true;
    });

    // Adiciona ou remove mensagem "Nenhum resultado"
    let noResultsRow = tableBody.querySelector('.no-results-message');
    if (!found && termoLimpo !== '') {
        if (!noResultsRow) {
            noResultsRow = tableBody.insertRow();
            noResultsRow.className = 'no-results-message';
            noResultsRow.innerHTML = `<td colspan="6" class="text-center text-muted py-3 fst-italic">Nenhum registro encontrado para "${this.Utils?.sanitizeString(termo)}".</td>`;
        }
    } else if (noResultsRow) {
        noResultsRow.remove(); // Remove a mensagem se encontrou algo ou busca vazia
    }
  },

  /**
   * Verifica a conectividade e tenta sincronizar requisições offline pendentes.
   */
  checkConnectivityAndSync: async function() {
    const isOnline = navigator.onLine;
    this.AppState?.update('online', isOnline);

    if (!isOnline) {
      console.log('App: Sistema em modo offline. Sincronização adiada.');
      return;
    }

    // Só tenta sincronizar se ApiClient e a função existirem
    if (this.ApiClient && typeof this.ApiClient.syncOfflineRequests === 'function') {
      if (!this.Config?.API_URL) {
         console.warn('App: API URL não configurada. Não é possível sincronizar.');
         return;
      }
       try {
         console.log('App: Verificando e tentando sincronizar requisições offline...');
         const syncResult = await this.ApiClient.syncOfflineRequests();

         if (syncResult && syncResult.syncedCount > 0) {
            this.Utils?.showNotification?.(`Sincronização: ${syncResult.syncedCount} ação(ões) enviada(s) com sucesso.`, 'success', 5000);
            // Atualiza a lista após sincronizar com sucesso
            await this.refreshRegistrosList();
         } else if (syncResult && syncResult.errorCount > 0) {
             this.Utils?.showNotification?.(`Sincronização: ${syncResult.errorCount} ação(ões) falharam ao sincronizar. Verifique o console.`, 'warning', 7000);
         } else if (syncResult?.pendingCount === 0) {
             console.log("App: Nenhuma requisição offline pendente para sincronizar.");
         }

       } catch (error) {
         console.error('App: Erro geral durante a sincronização:', error);
         this.Utils?.showNotification?.('Falha crítica ao tentar sincronizar dados offline.', 'error');
       }
    } else {
       console.warn("App: ApiClient ou syncOfflineRequests não disponíveis para sincronização.");
    }
  }

}; // Fim do objeto App
