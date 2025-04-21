// app.js

/**
 * Aplicação principal do sistema
 */
const App = {
  // Propriedades para armazenar referências aos módulos
  ApiClient: null,
  PhotoHandler: null,
  FormHandler: null,
  Utils: null, // Se Utils for global ou um módulo
  Config: null, // Se Config for global ou um módulo

  /**
   * Inicializar a aplicação
   */
  init: async function() {
    console.log("App.init() iniciado...");

    // Obter referências aos módulos necessários
    this.ApiClient = ModuleLoader.get('apiClient');
    this.PhotoHandler = ModuleLoader.get('photoHandler');
    this.FormHandler = ModuleLoader.get('formHandler');
    this.Utils = window.Utils; // Assume global por enquanto
    this.Config = window.CONFIG; // Assume global

    // Verificar se módulos essenciais foram carregados
    if (!this.ApiClient || !this.PhotoHandler || !this.FormHandler || !this.Utils || !this.Config) {
       console.error("App.init: Falha ao carregar módulos essenciais. A aplicação pode não funcionar corretamente.");
       // Poderia mostrar um erro fatal aqui
       if(window.showErrorMessage) showErrorMessage("Erro ao carregar componentes da aplicação.");
       return; // Interrompe a inicialização do App
    }

    // Configurar URL da API (exemplo de uso do Config)
    // A lógica original com prompt pode ser mantida ou melhorada
    if (!this.Config.API_URL) {
       let apiUrlFromStorage = localStorage.getItem('API_URL');
       if (apiUrlFromStorage) {
          this.Config.API_URL = apiUrlFromStorage;
          console.log("API URL carregada do localStorage.");
       } else {
           // Apenas loga aviso, pode não precisar de prompt bloqueante
           console.warn("API URL não configurada no config.js nem no localStorage. Funcionalidades online podem falhar.");
           // alert('URL da API não configurada. Modo offline forçado.'); // Ou um prompt como antes
       }
    }


    // Inicializar os módulos que precisam de init (se eles tiverem essa função)
    // Usar optional chaining (?.) para segurança
    this.ApiClient?.init?.();
    this.PhotoHandler?.init?.(); // PhotoHandler tem init
    this.FormHandler?.init?.();  // FormHandler tem init

    console.log("Módulos do App inicializados.");

    // Configurar eventos da UI (agora pode usar this.FormHandler etc.)
    this.setupUIEvents();

    // Verificar conectividade e tentar sincronizar (pode usar this.ApiClient)
    await this.checkConnectivityAndSync(); // Espera a verificação antes de carregar lista

    // Carregar lista de registros inicial (pode usar this.ApiClient)
    await this.refreshRegistrosList();

    // Detectar modo (novo registro, edição, visualização) baseado na URL
    this.handleUrlParams();

    console.log("App.init() concluído.");
  },

  /**
   * Configurar eventos da interface
   */
  setupUIEvents: function() {
    // Botão Novo Registro
    document.getElementById('btnNovoRegistro')?.addEventListener('click', () => {
      // Usa a referência do FormHandler armazenada em 'this'
      this.FormHandler?.newRegistro();
    });

    // Botão Lista de Registros
    document.getElementById('btnListaRegistros')?.addEventListener('click', () => {
      this.Utils?.showScreen('telaListaRegistros'); // Usa Utils
       this.refreshRegistrosList(); // Atualiza a lista ao voltar
    });

    // Botão Voltar à Lista (da visualização)
    document.getElementById('btnVoltarLista')?.addEventListener('click', () => {
      this.Utils?.showScreen('telaListaRegistros');
       this.refreshRegistrosList(); // Atualiza a lista ao voltar
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

     // Eventos nos formulários são configurados dentro do FormHandler.init()
     // Eventos nos botões de view/edit da lista são adicionados em refreshRegistrosList
  },

  /**
   * Tratar parâmetros de URL para abrir em modo específico
   */
  handleUrlParams: function() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('view')) {
      const id = params.get('view');
      console.log(`URL param: view=${id}`);
      this.FormHandler?.viewRegistro(id);
    } else if (params.has('edit')) {
      const id = params.get('edit');
       console.log(`URL param: edit=${id}`);
      this.FormHandler?.loadRegistro(id);
    } else if (params.has('new')) {
       console.log(`URL param: new`);
      this.FormHandler?.newRegistro();
    } else {
       // Se nenhum parâmetro, mostra a lista por padrão
       this.Utils?.showScreen('telaListaRegistros');
    }

    // Limpar parâmetros da URL após processar para evitar reprocessamento no refresh
    if (params.toString() && window.history.replaceState) {
       console.log("Limpando parâmetros da URL.");
       window.history.replaceState({}, document.title, window.location.pathname);
    }
  },

  /**
   * Atualizar lista de registros na tela
   */
  refreshRegistrosList: async function() {
    const tableBody = document.getElementById('listaRegistrosBody');
    if (!tableBody) {
       console.error("Elemento #listaRegistrosBody não encontrado.");
       return;
    }

    // Mostrar loading
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
          <p class="mt-2 mb-0">Carregando registros...</p>
        </td>
      </tr>
    `;

    try {
       if (!this.ApiClient) throw new Error("ApiClient não está disponível.");

      // Buscar registros (usando a referência do módulo)
      const registros = await this.ApiClient.listarRegistros();
      console.log(`Recebidos ${registros?.length || 0} registros da API/cache.`);

      // Limpar tabela
      tableBody.innerHTML = '';

      if (!registros || registros.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4">
              <div class="alert alert-info mb-0">
                <i class="bi bi-info-circle me-2"></i> Nenhum registro encontrado.
                <button class="btn btn-sm btn-primary ms-3" id="btnNovoRegistroFromEmpty">Criar Novo Registro</button>
              </div>
            </td>
          </tr>
        `;
         // Adicionar listener para o botão criado dinamicamente
         document.getElementById('btnNovoRegistroFromEmpty')?.addEventListener('click', () => {
            this.FormHandler?.newRegistro();
         });
        return;
      }

      // Ordenar por data (mais recente primeiro) - Certificar que dataCriacao existe e é válida
      registros.sort((a, b) => {
         const dateA = a.dataCriacao ? new Date(a.dataCriacao) : 0;
         const dateB = b.dataCriacao ? new Date(b.dataCriacao) : 0;
         // Tratar datas inválidas colocando-as no final
         if (isNaN(dateA)) return 1;
         if (isNaN(dateB)) return -1;
         return dateB - dateA; // Mais recente primeiro
      });


      // Adicionar registros à tabela
      registros.forEach(registro => {
        if (!registro || !registro.id) return; // Pular registros inválidos

        const row = document.createElement('tr');
        row.setAttribute('data-registro-id', registro.id); // Ajuda a encontrar a linha se precisar

        // Determinar status (a lógica pode ser mais robusta)
        let statusBadge = '<span class="badge bg-secondary">Pendente</span>';
        if (registro.dataFinalizacao) { // Campo indicando finalização
            statusBadge = '<span class="badge bg-success">Concluído</span>';
        } else if (registro.fotosPos?.length > 0) { // Se tem fotos PÓS, mas não finalizado
            statusBadge = '<span class="badge bg-info">Pós Iniciado</span>';
        } else if (registro.fotosPre?.length > 0 || registro.checklistPre /* ou outro campo preenchido */) {
            statusBadge = '<span class="badge bg-warning text-dark">Pré Iniciado</span>';
        }


        row.innerHTML = `
          <td><small>${this.Utils?.sanitizeString(registro.id) || '-'}</small></td>
          <td>${this.Utils?.sanitizeString(registro.placa) || '-'}</td>
          <td>${this.Utils?.sanitizeString(registro.modelo) || '-'}</td>
          <td><small>${registro.dataCriacao ? this.Utils?.formatarDataHora(registro.dataCriacao) : '-'}</small></td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary btn-view" data-id="${registro.id}" title="Visualizar">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning btn-edit ms-1" data-id="${registro.id}" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
             <button class="btn btn-sm btn-outline-danger btn-delete ms-1" data-id="${registro.id}" title="Excluir">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        `;

        // Adicionar eventos aos botões (usando a referência FormHandler)
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
           if(id && confirm(`Tem certeza que deseja excluir o registro ${id}? Esta ação não pode ser desfeita.`)) {
              try {
                 await this.ApiClient.excluirRegistro(id); // Assume que ApiClient tem essa função
                 this.Utils.showNotification(`Registro ${id} excluído com sucesso.`, 'success');
                 this.refreshRegistrosList(); // Atualiza a lista
              } catch (error) {
                 console.error(`Erro ao excluir registro ${id}:`, error);
                 this.Utils.showNotification(`Erro ao excluir registro: ${error.message}`, 'error');
              }
           }
        });

        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Erro ao carregar ou renderizar registros:', error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4">
            <div class="alert alert-danger mb-0">
              <i class="bi bi-exclamation-triangle me-2"></i> Erro ao carregar registros: ${error.message}
            </div>
          </td>
        </tr>
      `;
    }
  },

  /**
   * Filtrar registros exibidos na tabela
   * @param {string} termo - Termo de busca
   */
  filterRegistros: async function(termo) {
    termo = termo.toLowerCase().trim();
    const tableBody = document.getElementById('listaRegistrosBody');
    const rows = tableBody?.querySelectorAll('tr[data-registro-id]'); // Seleciona linhas com ID

    if (!rows) return;

    if (!termo) {
       // Se termo de busca está vazio, mostra todas as linhas
       rows.forEach(row => row.style.display = '');
       console.log("Busca limpa, mostrando todos os registros.");
       return;
    }

     console.log(`Filtrando registros por: "${termo}"`);
     let found = false;
     rows.forEach(row => {
         const id = row.cells[0]?.textContent?.toLowerCase() || '';
         const placa = row.cells[1]?.textContent?.toLowerCase() || '';
         const modelo = row.cells[2]?.textContent?.toLowerCase() || '';
         // Adicionar busca por data, status se necessário

         const match = id.includes(termo) || placa.includes(termo) || modelo.includes(termo);

         row.style.display = match ? '' : 'none';
         if (match) found = true;
     });

     // Mostrar mensagem se nada foi encontrado
     const noResultsRow = tableBody.querySelector('.no-results-message');
     if (!found) {
         if (!noResultsRow) {
             const tr = document.createElement('tr');
             tr.className = 'no-results-message';
             tr.innerHTML = `<td colspan="6" class="text-center text-muted py-3">Nenhum registro encontrado para "${this.Utils.sanitizeString(termo)}".</td>`;
             tableBody.appendChild(tr);
         }
     } else {
         noResultsRow?.remove(); // Remove mensagem se resultados foram encontrados
     }
  },

  /**
   * Verificar conectividade e tentar sincronizar dados offline
   */
  checkConnectivityAndSync: async function() {
     const isOnline = navigator.onLine;
     const AppState = ModuleLoader.get('state');
     if (AppState) AppState.update('online', isOnline); // Atualiza estado

    if (!isOnline) {
      console.log('Sistema em modo offline. Sincronização adiada.');
       this.Utils?.showNotification('Operando em modo offline.', 'warning');
      return;
    }

     if (!this.Config?.API_URL) {
        console.log('API URL não configurada. Não é possível sincronizar.');
        return;
     }

     if (this.ApiClient && this.ApiClient.syncOfflineRequests) {
         try {
           console.log('Verificando e tentando sincronizar requisições offline...');
           const syncResult = await this.ApiClient.syncOfflineRequests();

           if (syncResult && syncResult.syncedCount > 0) {
             this.Utils?.showNotification(
               `Sincronização concluída: ${syncResult.syncedCount} registro(s) enviados com sucesso.`,
               'success'
             );
             // Atualizar a lista após sincronizar pode ser útil
             await this.refreshRegistrosList();
           } else if (syncResult && syncResult.syncedCount === 0) {
              console.log("Nenhuma requisição offline pendente para sincronizar.");
           }

           // Tratar erros de sincronização se syncResult tiver 'errors'
           if (syncResult && syncResult.errors && syncResult.errors.length > 0) {
              console.error("Erros durante a sincronização:", syncResult.errors);
              this.Utils?.showNotification(`Houve ${syncResult.errors.length} erro(s) durante a sincronização. Verifique o console.`, 'error');
           }

         } catch (error) {
           console.error('Erro geral ao tentar sincronizar:', error);
           this.Utils?.showNotification('Falha ao tentar sincronizar dados offline.', 'error');
         }
     } else {
        console.warn("ApiClient ou função syncOfflineRequests não encontrados.");
     }
  }
};

// REMOVIDO: Listener que chamava App.init() duplicado
// document.addEventListener('DOMContentLoaded', function() {
//   App.init();
// });
