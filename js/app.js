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

    // Obter referências aos módulos carregados e objetos globais
    this.AppState = ModuleLoader.get('state');
    this.PhotoHandler = ModuleLoader.get('photoHandler');
    this.FormHandler = ModuleLoader.get('formHandler');
    this.Utils = window.Utils;
    this.Config = window.CONFIG;
    this.ApiClient = ModuleLoader.get('apiClient'); // Obtém o apiClient via ModuleLoader

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
       return; // Interrompe a inicialização
    }

    // Avisa se ApiClient não foi encontrado (pode ser problema no ModuleLoader ou no próprio apiClient.js)
    if (!this.ApiClient) {
       console.error("App.init: ApiClient não foi encontrado ou carregado via ModuleLoader. Operando em modo offline forçado.");
       this.AppState?.update('apiOnline', false);
       this.AppState?.update('forceOffline', true);
       this.Utils?.showNotification?.("Erro: Módulo API não carregado. Funcionalidade online desativada.", 'error');
    } else {
        // Verifica se a URL da API está configurada
        if (!this.Config.API_URL) {
            console.error("App.init: API_URL não definida no Config! O ApiClient (iframe) não funcionará.");
            this.Utils?.showNotification?.("Erro crítico: URL da API não configurada!", 'error');
             this.AppState?.update('apiOnline', false);
        }
    }

    console.log("App: Módulos essenciais do App obtidos com sucesso.");

    // Configurar listeners de eventos da UI (botões, busca, etc.)
    this.setupUIEvents();

    // --- CORREÇÃO: Testa a conexão usando o ApiClient ---
    // Só tenta se o ApiClient foi carregado e a URL está configurada
    if(this.ApiClient && this.Config.API_URL) {
        await this.testAPIConnection();
    } else {
        console.warn("App: Pulando teste de conexão API devido a problemas de configuração ou ApiClient.");
        this.AppState?.update('apiOnline', false);
    }
    // --- FIM DA CORREÇÃO ---

    // Verificar conectividade e tentar sincronizar ações pendentes
    await this.checkConnectivityAndSync();

    // Carregar lista de registros inicial (do cache ou da API se online)
    await this.refreshRegistrosList();

    // Tratar parâmetros da URL (ex: ?view=ID ou ?edit=ID)
    this.handleUrlParams();

    console.log("App.init() concluído com sucesso.");
  },

  // --- FUNÇÃO testAPIConnection CORRIGIDA ---
  /**
   * Testa a conexão com a API usando o ApiClient (via Iframe)
   * @returns {Promise<boolean>} True se a conexão foi bem-sucedida, False caso contrário.
   */
  testAPIConnection: async function() {
    // Verifica se o ApiClient está disponível e possui a função ping
    if (!this.ApiClient || typeof this.ApiClient.ping !== 'function') {
       console.error("App.testAPIConnection: ApiClient ou função 'ping' indisponível.");
       this.AppState?.update('apiOnline', false);
       return false; // Não pode testar
    }

    console.log("App: Testando conexão com a API via ApiClient.ping (Iframe)...");
    this.Utils?.showLoading?.("Verificando conexão..."); // Passa apenas a mensagem
    try {
      // Chama a função ping através do apiClient (que usa o iframe)
      const response = await this.ApiClient.ping();

      // Verifica a resposta esperada da função ping no Code.gs
      if (response && response.success === true && response.message === "pong") {
        console.log("App: Conexão com a API (via Iframe) bem-sucedida!", response);
        this.AppState?.update('apiOnline', true);
        // Mostra notificação rápida de sucesso
        this.Utils?.showNotification?.('Conectado ao servidor.', 'success', 2000);
        this.Utils?.hideLoading?.(); // Esconde loading
        return true;
      } else {
        // A API respondeu, mas não da forma esperada
        console.warn("App: Resposta inesperada do ping da API (via Iframe):", response);
        this.AppState?.update('apiOnline', false);
        this.Utils?.showNotification?.('Servidor respondeu inesperadamente.', 'warning');
        this.Utils?.hideLoading?.(); // Esconde loading
        return false;
      }
    } catch (error) {
      // Ocorreu um erro na comunicação com o iframe ou na API (ex: timeout)
      console.error("App: Erro ao testar conexão com a API (via Iframe):", error.message || error);
      this.AppState?.update('apiOnline', false);
      // A mensagem de erro já deve ter sido mostrada pelo apiClient (timeout, erro do iframe, etc.)
      // Apenas garante que o loading seja escondido.
      this.Utils?.hideLoading?.();
      // Mostra uma notificação genérica se o apiClient não mostrou
      // this.Utils?.showNotification?.(`Falha na comunicação com API: ${error.message}`, 'error');
      return false;
    }
  },
  // --- FIM DA FUNÇÃO CORRIGIDA ---

  /**
   * Configura os listeners de eventos para os botões principais e busca
   */
  setupUIEvents: function() {
    console.log("App: Configurando eventos da UI...");
    // Botão Novo Registro
    document.getElementById('btnNovoRegistro')?.addEventListener('click', () => {
      this.FormHandler?.newRegistro();
    });

    // Botão Lista de Registros
    document.getElementById('btnListaRegistros')?.addEventListener('click', () => {
       this.Utils?.showScreen?.('telaListaRegistros');
       this.refreshRegistrosList(); // Atualiza a lista ao navegar para ela
    });

    // Botão Voltar à Lista (na tela de visualização)
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
    campoBusca?.addEventListener('input', () => { // Filtra ao digitar (opcional)
      if (campoBusca) this.filterRegistros(campoBusca.value);
    });

    // Botão de sincronização manual (se existir no seu HTML)
    document.getElementById('btnSincronizar')?.addEventListener('click', () => {
      this.checkConnectivityAndSync(true); // true = forçar sincronização
    });

    console.log("App: Eventos da UI configurados.");
  },

  /**
   * Trata parâmetros de URL para navegação inicial (ex: ?view=ID)
   */
  handleUrlParams: function() {
    const params = new URLSearchParams(window.location.search);
    let actionTaken = false;

    try { // Adiciona try-catch para robustez
        if (params.has('view')) {
          const id = params.get('view');
          console.log(`App: URL param: view=${id}`);
          this.FormHandler?.viewRegistro(id);
          actionTaken = true;
        } else if (params.has('edit')) {
          const id = params.get('edit');
           console.log(`App: URL param: edit=${id}`);
          this.FormHandler?.loadRegistro(id);
          actionTaken = true;
        } else if (params.has('new')) {
           console.log(`App: URL param: new`);
          this.FormHandler?.newRegistro();
          actionTaken = true;
        }
    } catch (error) {
        console.error("App: Erro ao processar parâmetros da URL:", error);
         this.Utils?.showNotification?.("Erro ao carregar visão da URL.", 'error');
         actionTaken = false; // Garante que vá para a lista padrão
    }

    // Se nenhuma ação foi tomada pela URL, mostra a lista
    if (!actionTaken) {
       console.log("App: Nenhum parâmetro URL de ação, exibindo lista.");
       this.Utils?.showScreen?.('telaListaRegistros');
       // refreshRegistrosList já é chamado no init, não precisa chamar de novo aqui
       // this.refreshRegistrosList();
    }

    // Limpa os parâmetros da URL após o uso para evitar reloads indesejados
    if (params.toString() && window.history.replaceState) {
       console.log("App: Limpando parâmetros da URL.");
       const cleanUrl = window.location.pathname + window.location.hash; // Mantém hash se houver
       window.history.replaceState({}, document.title, cleanUrl);
    }
  },

  /**
   * Atualiza a lista de registros na tabela da UI
   */
  refreshRegistrosList: async function() {
    console.log("App: Atualizando lista de registros...");
    const tableBody = document.getElementById('listaRegistrosBody');
    if (!tableBody) {
       console.error("App: Elemento #listaRegistrosBody não encontrado no DOM.");
       return;
    }

    // Mostrar indicador de loading na tabela
    this.Utils?.renderLoadingRow(tableBody, 6); // Função auxiliar de Utils.js (exemplo)

    let registros = [];
    let errorOccurred = false;
    let errorMessage = '';
    const isCurrentlyOnline = this.AppState?.get('online') === true;

    try {
       // Tenta buscar da API se estiver online e ApiClient disponível
       if (this.ApiClient && isCurrentlyOnline) {
          console.log("App: Tentando buscar registros via API (ApiClient)...");
          // Usa um timeout curto para listar, para não prender a UI se a API demorar muito
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao listar registros (10s)")), 10000));
          const apiResult = await Promise.race([this.ApiClient.listarRegistros(), timeoutPromise]);

          // Valida a resposta da API (listarRegistros deve retornar um array)
          if (Array.isArray(apiResult)) {
              registros = apiResult;
              console.log(`App: Recebidos ${registros.length} registros da API.`);
              this.AppState?.update('registros', registros); // Atualiza o estado local com dados frescos
          } else {
               // A API respondeu, mas não com um array (pode ser um objeto de erro?)
               console.warn("App: Resposta inesperada de listarRegistros da API:", apiResult);
               errorMessage = apiResult?.message || "Formato de resposta inválido da API";
               errorOccurred = true;
               registros = this.AppState?.get('registros') || []; // Usa cache se API falhou
               this.Utils?.showNotification?.(`Erro (${errorMessage}). Exibindo dados locais.`, 'warning');
          }
       } else {
          // Busca do estado local se offline ou ApiClient indisponível
          const offlineMsg = this.ApiClient ? "Modo offline." : "ApiClient indisponível.";
          console.log(`App: Buscando registros do estado local. ${offlineMsg}`);
          registros = this.AppState?.get('registros') || [];
          if (registros.length === 0 && !this.ApiClient) {
             errorMessage = "Nenhum dado local e API indisponível.";
             errorOccurred = true; // Considera erro se não há API nem cache
          } else if (registros.length > 0 && !isCurrentlyOnline) {
             this.Utils?.showNotification?.("Exibindo dados locais (offline).", "info", 3000);
          }
       }
    } catch (error) {
       errorOccurred = true;
       errorMessage = error.message || "Erro desconhecido";
       console.error('App: Erro ao buscar/processar registros:', errorMessage, error);
       registros = this.AppState?.get('registros') || []; // Fallback para cache
       this.Utils?.showNotification?.(`Erro ao buscar (${errorMessage}). Exibindo dados locais.`, 'warning');
    } finally {
        this.Utils?.removeLoadingRow(tableBody); // Remove a linha de loading
    }

    // Limpar tabela antes de popular
    tableBody.innerHTML = '';

    // Exibir registros ou mensagem de erro/vazio
    if (!registros || registros.length === 0) {
        const colspan = 6; // Ajuste conforme número de colunas
        let message = '';
        if (errorOccurred) {
           message = `<div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle me-2"></i> Falha ao carregar: ${this.Utils?.sanitizeString(errorMessage)}</div>`;
        } else {
           message = `<div class="alert alert-secondary mb-0"><i class="bi bi-info-circle me-2"></i> Nenhum registro encontrado. <button class="btn btn-sm btn-link p-0 ms-2" id="btnNovoRegistroFromEmpty">Criar Novo</button></div>`;
        }
         tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-3">${message}</td></tr>`;
         // Adiciona listener ao botão dentro da mensagem, se ele existir
         document.getElementById('btnNovoRegistroFromEmpty')?.addEventListener('click', () => this.FormHandler?.newRegistro());
    } else {
        // Ordenar registros (ex: por data de criação, mais recente primeiro)
        const registrosOrdenados = this.Utils?.ordenarPor(registros, 'dataCriacao', false) || registros; // false = decrescente
        registrosOrdenados.forEach(registro => {
           if (!registro || !registro.id) {
              console.warn("App: Registro inválido ou sem ID encontrado:", registro);
              return; // Pula este registro
           }
           // Adiciona a linha na tabela
           this.addRegistroRow(tableBody, registro);
        });
    }
    console.log("App: Lista de registros renderizada na tela.");
    // Aplica filtro novamente se houver termo na busca
    const campoBusca = document.getElementById('buscaRegistro');
    if (campoBusca?.value) {
        this.filterRegistros(campoBusca.value);
    }
  },

  /**
   * Adiciona uma linha (<tr>) representando um registro à tabela (<tbody>)
   * @param {HTMLTableSectionElement} tableBody O elemento <tbody> da tabela.
   * @param {object} registro O objeto do registro a ser exibido.
   */
  addRegistroRow: function(tableBody, registro) {
      const row = tableBody.insertRow();
      row.setAttribute('data-registro-id', registro.id); // Adiciona ID para referência

      // Funções auxiliares para segurança e formatação
      const sanitize = this.Utils?.sanitizeString || (s => s || '');
      const formatDT = this.Utils?.formatarDataHora || (d => d ? new Date(d).toLocaleString() : '--');

      // Determina o badge de status com base nos dados
      let statusBadge = '<span class="badge bg-secondary">Pendente</span>';
      let statusText = registro.status || 'Pendente'; // Usa status do registro se existir

      // Mapeia status para classes de badge (exemplo)
       const statusClasses = {
           'Pendente': 'bg-secondary',
           'Pré-Registrado': 'bg-warning text-dark',
           'Em Andamento': 'bg-info text-dark',
           'Concluído': 'bg-success',
           'Cancelado': 'bg-danger',
       };
      statusBadge = `<span class="badge ${statusClasses[statusText] || 'bg-light text-dark'}">${sanitize(statusText)}</span>`;


      // Cria o HTML da linha
      row.innerHTML = `
        <td><small class="text-monospace">${sanitize(registro.id)}</small></td>
        <td>${sanitize(registro.placa)}</td>
        <td>${sanitize(registro.modelo)}</td>
        <td><small>${formatDT(registro.dataCriacao)}</small></td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center actions-cell">
          <button class="btn btn-sm btn-outline-primary btn-view" data-id="${sanitize(registro.id)}" title="Visualizar">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary btn-edit ms-1" data-id="${sanitize(registro.id)}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-delete ms-1" data-id="${sanitize(registro.id)}" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;

      // Adiciona listeners aos botões de ação da linha
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
          const modelo = sanitize(registro.modelo);

          // Confirmação mais detalhada
          if(id && confirm(`Tem certeza que deseja EXCLUIR o registro:\n\nID: ${id}\nPlaca: ${placa}\nModelo: ${modelo}\n\nEsta ação não pode ser desfeita.`)) {
             if (!this.ApiClient || !this.AppState?.get('online')) {
                 this.Utils?.showNotification?.("Exclusão só é possível online.", "warning");
                 // Poderia marcar para exclusão offline, mas não implementado aqui
                 return;
             }

             this.Utils?.showLoading?.(true, `Excluindo registro ${id}...`);
             try {
                 const result = await this.ApiClient.excluirRegistro(id);
                 // Verifica se a API retornou sucesso (ou não retornou success: false)
                 if(result && result.success !== false) {
                    this.Utils?.showNotification?.(`Registro ${id} (${placa}) excluído com sucesso.`, 'success');
                    row.remove(); // Remove a linha da tabela
                    // Opcional: Remover do estado local também
                    let currentRegistros = this.AppState?.get('registros') || [];
                    this.AppState?.update('registros', currentRegistros.filter(r => r.id !== id));
                    // Atualiza a lista se ficou vazia
                    if (tableBody.rows.length === 0) {
                       this.refreshRegistrosList();
                    }
                 } else {
                    // A API retornou um erro explícito
                    throw new Error(result?.message || "Falha ao excluir na API (resposta inesperada).");
                 }
             } catch (error) {
                 // Erro na comunicação ou erro lançado acima
                 console.error(`App: Erro ao excluir registro ${id}:`, error);
                 this.Utils?.showNotification?.(`Erro ao excluir registro: ${error.message}`, 'error');
             } finally {
                this.Utils?.hideLoading?.();
             }
          }
      });
  },

  /**
   * Filtra os registros VISÍVEIS na tabela com base no termo de busca
   * Não busca na API, apenas filtra o que já está na tela.
   * @param {string} termo O texto a ser buscado.
   */
  filterRegistros: function(termo) {
    const tableBody = document.getElementById('listaRegistrosBody');
    if (!tableBody) return;
    const rows = tableBody.querySelectorAll('tr[data-registro-id]'); // Seleciona apenas linhas de dados
    const termoLimpo = this.Utils?.removerAcentos(termo.toLowerCase().trim()) || '';

    let visibleCount = 0;
    rows.forEach(row => {
        // Obtém os textos das células relevantes para a busca
        const id = row.cells[0]?.textContent?.toLowerCase() || '';
        const placa = row.cells[1]?.textContent?.toLowerCase() || '';
        const modelo = row.cells[2]?.textContent?.toLowerCase() || '';
        const status = row.cells[4]?.textContent?.toLowerCase().trim() || ''; // Busca por status também

        // Verifica se o termo (ou partes dele) existe em algum campo relevante
        const match = termoLimpo === '' ||
                      id.includes(termoLimpo) ||
                      placa.includes(termoLimpo) ||
                      modelo.includes(termoLimpo) ||
                      status.includes(termoLimpo);

        // Mostra ou esconde a linha
        row.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    });

    // Gerencia a mensagem de "Nenhum resultado"
    let noResultsRow = tableBody.querySelector('.no-results-message');
    if (visibleCount === 0 && termoLimpo !== '') {
        // Se não há resultados E não existia a mensagem, cria
        if (!noResultsRow) {
            noResultsRow = tableBody.insertRow(); // Adiciona no final
            noResultsRow.className = 'no-results-message';
            noResultsRow.innerHTML = `<td colspan="6" class="text-center text-muted py-3 fst-italic">Nenhum registro encontrado para "${this.Utils?.sanitizeString(termo)}".</td>`;
        }
    } else if (noResultsRow) {
        // Se há resultados OU a busca está vazia, remove a mensagem
        noResultsRow.remove();
    }
  },

  /**
   * Verifica a conectividade de rede e tenta sincronizar requisições offline.
   * @param {boolean} [forceSync=false] - Tentar sincronizar mesmo se navigator.onLine for false.
   * @returns {Promise<boolean>} True se a sincronização foi tentada e bem-sucedida ou não necessária, False se falhou.
   */
  checkConnectivityAndSync: async function(forceSync = false) {
    const wasOnline = this.AppState?.get('online') === true;
    // Considera online se o navegador diz E não estamos forçando offline, OU se estamos forçando a sync
    const canAttemptSync = (navigator.onLine && this.AppState?.get('forceOffline') !== true) || forceSync;

    // Atualiza o estado global de conectividade
    if (!forceSync) { // Não atualiza o estado se for sync forçada (pode ser temporário)
        this.AppState?.update('online', navigator.onLine);
        if (wasOnline && !navigator.onLine) {
             this.Utils?.showNotification?.('Dispositivo offline. Ações serão salvas localmente.', 'warning');
        } else if (!wasOnline && navigator.onLine) {
            this.Utils?.showNotification?.('Conexão restaurada.', 'info', 3000);
        }
    }

    if (!canAttemptSync) {
      console.log('App: Sincronização não será tentada (offline ou forçado offline).');
      return false; // Não tentou sincronizar
    }

    // Verifica se o ApiClient e a função de sync estão disponíveis
    if (!this.ApiClient || typeof this.ApiClient.syncOfflineRequests !== 'function') {
      console.warn("App: ApiClient ou syncOfflineRequests indisponível. Não é possível sincronizar.");
      return false;
    }

    // Verifica se a URL da API está configurada
    if (!this.Config?.API_URL) {
      console.warn('App: API URL não configurada. Não é possível sincronizar.');
      return false;
    }

    console.log(`App: Verificando ${forceSync ? 'e forçando ' : ''}sincronização...`);
    this.Utils?.showLoading?.(true, "Sincronizando dados..."); // Mostra loading

    try {
      // Chama a função de sincronização do ApiClient
      const syncResult = await this.ApiClient.syncOfflineRequests();

      // Processa o resultado da sincronização
      if (syncResult) {
        if (syncResult.syncedCount > 0) {
          // Se algo foi sincronizado, atualiza a lista de registros na tela
          await this.refreshRegistrosList();
        } else if (syncResult.pendingCount > 0) {
           console.log(`App: Sincronização concluída, mas ainda restam ${syncResult.pendingCount} ações pendentes.`);
           if(syncResult.errorCount > 0 || syncResult.failedTemporarily > 0){
               this.Utils?.showNotification?.(`Algumas ações (${syncResult.errorCount + syncResult.failedTemporarily}) não puderam ser sincronizadas agora.`, 'warning', 5000);
           } else {
               // Nenhuma sincronizada, nenhuma falhou, apenas pendentes (estranho, talvez sem conexão real?)
               this.Utils?.showNotification?.(`Ainda há ${syncResult.pendingCount} ações pendentes.`, 'info', 3000);
           }
        } else if (syncResult.pendingCount === 0 && syncResult.syncedCount === 0 && syncResult.errorCount === 0 && syncResult.failedTemporarily === 0) {
           console.log("App: Nenhuma ação pendente para sincronizar.");
           // Não mostra notificação se não havia nada a fazer
        }
        // As notificações de sucesso/erro específicas são mostradas pelo syncOfflineRequests do apiClient
        this.Utils?.hideLoading?.(); // Esconde loading
        return syncResult.success || (syncResult.pendingCount === 0); // Sucesso se API não reportou erro ou se não há mais pendências
      } else {
         throw new Error("syncOfflineRequests retornou resultado inválido.");
      }
    } catch (error) {
      console.error(`App: Erro durante a sincronização:`, error);
      this.Utils?.showNotification?.(`Erro ao sincronizar: ${error.message}`, 'error');
      this.Utils?.hideLoading?.(); // Garante que o loading seja escondido
      return false; // Falha na sincronização
    }
  }
}; // Fim do objeto App

// Inicializa a aplicação quando o DOM estiver pronto
// (Ou mova esta chamada para o final do main.js se preferir)
// document.addEventListener('DOMContentLoaded', () => {
//    App.init();
// });
// Assumindo que main.js chama App.init() após carregar todos os módulos.
