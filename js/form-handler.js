/**
 * Manipulador de Formulários do Sistema de Manutenção
 * Gerencia a coleta, validação e submissão dos dados dos formulários.
 */
ModuleLoader.register('formHandler', function() {

  // Referências aos elementos do formulário
  let formPre, formPos;
  let currentRegistroId = null;

  // Referências aos módulos e utilitários (preenchidas no init)
  let ApiClient = null;
  let PhotoHandler = null;
  let AppState = null;
  let Utils = null;
  let Security = null;
  let Config = null;

  /**
   * Inicializa o módulo FormHandler.
   */
  function init() {
    console.log('Inicializando FormHandler...');

    // Obter dependências
    AppState = ModuleLoader.get('state');
    PhotoHandler = ModuleLoader.get('photoHandler');
    Security = ModuleLoader.get('security');
    ApiClient = ModuleLoader.get('apiClient'); // Tenta obter ApiClient
    Utils = window.Utils; // Assume global
    Config = window.CONFIG; // Assume global

    // --- VERIFICAÇÃO DE DEPENDÊNCIAS REFINADA ---
    let missingDeps = [];
    // Módulos essenciais para o FormHandler operar minimamente
    if (!AppState) missingDeps.push('AppState (state module)');
    if (!PhotoHandler) missingDeps.push('PhotoHandler');
    if (!Security) missingDeps.push('Security');
    if (!Utils) missingDeps.push('Utils (window.Utils)');
    if (!Config) missingDeps.push('Config (window.CONFIG)');

    // Verifica se as dependências *essenciais* foram carregadas
    if (missingDeps.length > 0) {
       const errorMessage = `FormHandler: Dependências essenciais não carregadas: ${missingDeps.join(', ')}.`;
       console.error(errorMessage);
       // Tenta notificar mesmo sem Utils, se possível
       window.showErrorMessage?.(errorMessage);
       // Lança um erro para interromper a inicialização do módulo e sinalizar no ModuleLoader
       throw new Error(errorMessage);
    }

    // Avisa se ApiClient não foi carregado, mas permite continuar offline
    if (!ApiClient) {
      console.warn("FormHandler: ApiClient não encontrado via ModuleLoader. Funcionalidades online (salvar, listar) estarão indisponíveis.");
    }
    // --- FIM DA VERIFICAÇÃO REFINADA ---


    // Mapear elementos dos formulários
    mapFormElements();

    // Configurar listeners dos formulários
    setupFormListeners();

    // Preencher selects dinâmicos
    populateSelects();

    // Preencher os checklists
    populateChecklists(); // Função que usa Utils.sanitizeString

    // Inicializar os containers de fotos
     if (document.getElementById('photo-container-pre') && PhotoHandler) {
        PhotoHandler.initContainerUI('photo-container-pre', 'pre', 'new');
     } else if(!PhotoHandler) { console.error("FormHandler: PhotoHandler não disponível para initContainerUI PRÉ");}

     if (document.getElementById('photo-container-pos') && PhotoHandler) {
        PhotoHandler.initContainerUI('photo-container-pos', 'pos', 'new');
     } else if(!PhotoHandler) { console.error("FormHandler: PhotoHandler não disponível para initContainerUI PÓS");}

    console.log('FormHandler inicializado com sucesso.');
  }

  /**
   * Mapeia os elementos principais dos formulários para variáveis locais.
   */
  function mapFormElements() {
    formPre = document.getElementById('formPreManutencao');
    formPos = document.getElementById('formPosManutencao');
    if (!formPre) console.error("Formulário 'formPreManutencao' não encontrado!");
    if (!formPos) console.error("Formulário 'formPosManutencao' não encontrado!");
  }

  /**
   * Configura os listeners de eventos para os formulários e botões de navegação/ação.
   */
  function setupFormListeners() {
    if (formPre) {
      formPre.addEventListener('submit', handlePreSubmit);
      document.getElementById('btnCancelarPre')?.addEventListener('click', resetAndGoToList);
    }
    if (formPos) {
      formPos.addEventListener('submit', handlePosSubmit);
      document.getElementById('btnVoltarPre')?.addEventListener('click', () => {
         // Ao voltar para PRE, garante que as fotos PRE sejam mostradas para o ID atual
         if (currentRegistroId && PhotoHandler) {
            PhotoHandler.initContainerUI('photo-container-pre', 'pre', currentRegistroId);
         }
         Utils?.showScreen?.('telaPreManutencao'); // Usa Utils para mostrar tela
      });
    }
     // Listener para botão Editar na tela de Visualização
     document.getElementById('btnEditarVisualizacao')?.addEventListener('click', handleEditClick);
     // Listener para botão Voltar da Visualização (pode ser redundante se já estiver no app.js)
      document.getElementById('btnVoltarLista')?.addEventListener('click', goToList);
  }

  // --- Funções de Ação do Usuário ---

  /**
   * Limpa os formulários e prepara a interface para um novo registro.
   */
  function newRegistro() {
    console.log("Iniciando novo registro...");
    currentRegistroId = 'new';
    resetForm(formPre);
    resetForm(formPos);

    // Limpa e re-inicializa as UIs de fotos para o estado 'new'
    if (PhotoHandler) {
       PhotoHandler.clearPhotosForRegistro('new');
       PhotoHandler.initContainerUI('photo-container-pre', 'pre', 'new');
       PhotoHandler.initContainerUI('photo-container-pos', 'pos', 'new');
    } else {
        console.error("newRegistro: PhotoHandler não disponível.");
    }

    // Atualiza displays de ID e resumo
    const registroIdDisplayPre = document.getElementById('registroIdDisplay');
    const registroIdDisplayPos = document.getElementById('registroIdPosDisplay');
    if(registroIdDisplayPre) registroIdDisplayPre.textContent = 'Novo Registro';
    if(registroIdDisplayPos) registroIdDisplayPos.textContent = 'Novo Registro';
    updatePosSummary({}); // Limpa resumo POS

    Utils?.showScreen?.('telaPreManutencao'); // Usa Utils
  }

  /**
   * Carrega dados de um registro existente nos formulários para edição.
   * @param {string} registroId - O ID do registro a ser carregado.
   */
  async function loadRegistro(registroId) {
     console.log(`Carregando registro ${registroId} para edição...`);
     if (!registroId || registroId === 'new') {
        console.error("ID de registro inválido para carregar.");
        notify('error', 'ID de registro inválido.');
        goToList();
        return;
     }
     currentRegistroId = registroId;
     Utils?.showLoading?.(true, "Carregando dados do registro...");

     try {
        const registro = await getRegistroData(registroId);
        if (!registro) {
           throw new Error(`Registro ${registroId} não encontrado.`);
        }

        // Limpa formulários antes de preencher
        resetForm(formPre);
        resetForm(formPos);

        // Preencher formulários
        fillForm(formPre, registro);
        fillForm(formPos, registro);

        // Re-inicializa containers de fotos COM o ID correto
        if (PhotoHandler) {
           PhotoHandler.initContainerUI('photo-container-pre', 'pre', registroId);
           PhotoHandler.initContainerUI('photo-container-pos', 'pos', registroId);
        } else {
            console.error("loadRegistro: PhotoHandler não disponível.");
        }


        // Atualizar displays de ID e resumo
        const registroIdDisplayPre = document.getElementById('registroIdDisplay');
        const registroIdDisplayPos = document.getElementById('registroIdPosDisplay');
        if(registroIdDisplayPre) registroIdDisplayPre.textContent = `ID: ${registroId}`;
        if(registroIdDisplayPos) registroIdDisplayPos.textContent = `ID: ${registroId}`;
        updatePosSummary(registro);

        Utils?.showScreen?.('telaPreManutencao'); // Sempre começa pela tela PRÉ

     } catch (error) {
        console.error(`Erro ao carregar registro ${registroId} para edição:`, error);
        notify('error', `Erro ao carregar dados: ${error.message}`);
        goToList();
     } finally {
        Utils?.hideLoading?.();
     }
  }

   /**
    * Exibe os dados de um registro existente em modo de visualização (read-only).
    * @param {string} registroId - O ID do registro a ser visualizado.
    */
   async function viewRegistro(registroId) {
       console.log(`Visualizando registro ${registroId}...`);
        if (!registroId || registroId === 'new') {
           console.error("ID de registro inválido para visualizar.");
           notify('error', 'ID de registro inválido.');
           goToList();
           return;
        }
       currentRegistroId = registroId;
       Utils?.showLoading?.(true, "Carregando dados para visualização...");

       try {
           const registro = await getRegistroData(registroId);
           if (!registro) {
               throw new Error(`Registro ${registroId} não encontrado.`);
           }

           // Preencher campos da tela de visualização
           populateViewScreen(registro);

           // Renderizar as fotos salvas
           renderPhotosForView(registroId, 'pre', 'fotosPreView');
           renderPhotosForView(registroId, 'pos', 'fotosPosView');

           Utils?.showScreen?.('telaVisualizacao');
       } catch (error) {
           console.error(`Erro ao visualizar registro ${registroId}:`, error);
           notify('error', `Erro ao carregar dados para visualização: ${error.message}`);
           goToList();
       } finally {
           Utils?.hideLoading?.();
       }
   }

   // --- Funções de Submissão ---

  /**
   * Manipula o envio do formulário PRÉ-manutenção.
   */
  async function handlePreSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!formPre || !validateForm(formPre)) {
      notify('warning', 'Por favor, corrija os erros no formulário PRÉ-manutenção.');
      formPre.querySelector('.is-invalid, input:invalid, select:invalid, textarea:invalid')?.focus();
      return;
    }

    const dadosPre = collectFormData(formPre);
    const isNew = !currentRegistroId || currentRegistroId === 'new';

    dadosPre.id = isNew ? Utils?.gerarId() : currentRegistroId;
    if (!dadosPre.id) {
        notify('error', 'Falha ao gerar ou obter ID do registro.');
        return;
    }
    currentRegistroId = dadosPre.id; // Garante que temos o ID atual

    // Busca registro existente ou cria objeto vazio
    let registroExistente = isNew ? {} : ((AppState?.get('registros') || []).find(r => r.id === currentRegistroId) || {});

    // Define data de criação apenas se for novo
    dadosPre.dataCriacao = isNew ? new Date().toISOString() : (registroExistente.dataCriacao || new Date().toISOString());

    // Obtém fotos PRÉ do PhotoHandler
    dadosPre.fotosPre = PhotoHandler?.getPhotos(currentRegistroId, 'pre') || [];

    // Mescla dados novos sobre os existentes (se houver)
    const dadosParaSalvar = { ...registroExistente, ...dadosPre };

    console.log(`Salvando dados PRÉ para registro ID: ${currentRegistroId}`);
    updateAppStateRegistro(dadosParaSalvar); // Salva no estado local

     // --- Preparar e ir para a tela PÓS ---
     const idPosInput = document.getElementById('registroIdPos');
     const idPosDisplay = document.getElementById('registroIdPosDisplay');
     if (idPosInput) idPosInput.value = currentRegistroId;
     if (idPosDisplay) idPosDisplay.textContent = `ID: ${currentRegistroId}`;
     updatePosSummary(dadosParaSalvar); // Atualiza resumo na tela PÓS

     // Re-inicializa/carrega fotos PÓS com o ID correto
     PhotoHandler?.initContainerUI('photo-container-pos', 'pos', currentRegistroId);

     notify('info', 'Dados PRÉ salvos localmente. Prossiga para a etapa PÓS.');
     Utils?.showScreen?.('telaPosManutencao');
  }

  /**
   * Manipula o envio do formulário PÓS-manutenção.
   */
  async function handlePosSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!formPos || !validateForm(formPos)) {
      notify('warning', 'Por favor, corrija os erros no formulário PÓS-manutenção.');
      formPos.querySelector('.is-invalid, input:invalid, select:invalid, textarea:invalid')?.focus();
      return;
    }

    if (!currentRegistroId || currentRegistroId === 'new') {
       notify('error', 'Erro crítico: ID do registro não definido para finalizar.');
       Utils?.showScreen?.('telaPreManutencao'); // Volta para PRE
       return;
    }

    Utils?.showLoading?.(true, "Finalizando e salvando registro...");

    const dadosPos = collectFormData(formPos);
    dadosPos.id = currentRegistroId; // Garante ID
    dadosPos.dataFinalizacao = new Date().toISOString(); // Marca finalização

    // Obtém fotos PÓS
    dadosPos.fotosPos = PhotoHandler?.getPhotos(currentRegistroId, 'pos') || [];

    // --- Combinar dados PRÉ e PÓS ---
    const registroPre = (AppState?.get('registros') || []).find(r => r.id === currentRegistroId);
    if (!registroPre) {
       notify('error', 'Erro crítico: Dados PRÉ não encontrados no estado para finalizar.');
       Utils?.hideLoading?.();
       return;
    }
    // Mescla dadosPos sobre registroPre
    const registroCompleto = { ...registroPre, ...dadosPos };

    console.log('Registro completo pronto para salvar:', registroCompleto);

    try {
        // Tenta salvar via API se ApiClient existe e estamos online
        if (ApiClient && navigator.onLine) {
            console.log("Tentando salvar registro via API...");
            const resultadoAPI = await ApiClient.salvarRegistro(registroCompleto);

             if (resultadoAPI && resultadoAPI.success !== false) {
                 notify('success', `Registro ${currentRegistroId} salvo com sucesso na nuvem!`);
                 updateAppStateRegistro(resultadoAPI.registro || registroCompleto);
                 PhotoHandler?.clearPhotosForRegistro(currentRegistroId);
                 resetAndGoToList();
             } else {
                 // API retornou erro, salva localmente como fallback
                 console.warn("API retornou erro ou falha ao salvar. Salvando localmente.", resultadoAPI?.message);
                 notify('warning', `Falha ao salvar na nuvem (${resultadoAPI?.message || 'Erro desconhecido'}). Registro salvo localmente.`);
                 updateAppStateRegistro(registroCompleto);
                 resetAndGoToList();
             }
        } else {
           // Salva localmente (Offline ou ApiClient indisponível)
           console.log("Salvando registro localmente (Offline ou API indisponível)...");
           updateAppStateRegistro(registroCompleto);
           notify('info', `Registro ${currentRegistroId} salvo localmente.${navigator.onLine ? '' : ' Será sincronizado quando online.'}`);
           resetAndGoToList();
        }

    } catch (error) {
        // Erro durante a tentativa de salvar (ex: falha de rede não capturada antes, erro no ApiClient)
        console.error('Erro crítico ao tentar salvar registro final:', error);
        notify('error', `Erro ao salvar: ${error.message}. O registro foi salvo localmente.`);
        // Garante que está salvo localmente mesmo em caso de erro na API
        updateAppStateRegistro(registroCompleto);
        resetAndGoToList();
    } finally {
        Utils?.hideLoading?.();
    }
  }

   /**
    * Manipula o clique no botão Editar na tela de visualização.
    */
   function handleEditClick() {
      if(currentRegistroId && currentRegistroId !== 'new') {
         loadRegistro(currentRegistroId); // Carrega o registro atual para edição
      } else {
         notify('error', 'Não há um registro válido selecionado para editar.');
         goToList();
      }
   }


  // --- Funções Auxiliares Internas ---

   /**
    * Busca dados de um registro, priorizando Cache/State e depois a API.
    * @param {string} registroId - O ID do registro a buscar.
    * @returns {Promise<Object|null>} O objeto do registro ou null se não encontrado.
    */
   async function getRegistroData(registroId) {
      if (!registroId || registroId === 'new') return null;

      // 1. Tenta do AppState
      const registroState = (AppState?.get('registros') || []).find(r => r && r.id === registroId);
      if (registroState) {
         console.log(`Registro ${registroId} encontrado no AppState.`);
         // Combina com fotos do PhotoHandler (que também usa AppState internamente)
         const registroCombinado = {
            ...registroState,
            fotosPre: PhotoHandler?.getPhotos(registroId, 'pre') || [],
            fotosPos: PhotoHandler?.getPhotos(registroId, 'pos') || []
         };
         return registroCombinado;
      }

      // 2. Tenta da API (se disponível e online)
      if (ApiClient && navigator.onLine) {
         console.log(`Registro ${registroId} não encontrado no state, buscando na API...`);
         try {
            const registroApi = await ApiClient.obterRegistro(registroId);
            if (registroApi) {
               console.log(`Registro ${registroId} obtido da API.`);
               // Atualiza o AppState com o registro da API
               updateAppStateRegistro(registroApi);
               // Retorna combinado com fotos (que já devem ter sido buscadas ou estarão no state agora)
                return {
                   ...registroApi,
                   fotosPre: PhotoHandler?.getPhotos(registroId, 'pre') || [],
                   fotosPos: PhotoHandler?.getPhotos(registroId, 'pos') || []
                };
            } else {
               // API buscou mas não encontrou
               console.log(`Registro ${registroId} não encontrado na API.`);
               return null;
            }
         } catch (error) {
            console.error(`Erro ao buscar registro ${registroId} da API:`, error);
            // Falhou em buscar na API, mas não lança erro, apenas retorna null
             notify('warning', `Falha ao buscar ${registroId} na API: ${error.message}`);
            return null;
         }
      }

      console.log(`Registro ${registroId} não encontrado no State nem na API.`);
      return null; // Retorna null se não encontrou em lugar nenhum
   }


  /**
   * Atualiza (ou adiciona) um registro no estado global (AppState).
   * @param {Object} registro - O objeto do registro a ser salvo no estado.
   */
   function updateAppStateRegistro(registro) {
      if (!AppState || !registro || !registro.id) {
         console.error("Falha ao atualizar AppState: dados inválidos ou AppState indisponível.", registro);
         return;
      }

      const registrosAtuais = AppState.get('registros') || [];
      const index = registrosAtuais.findIndex(r => r && r.id === registro.id);

      let novosRegistros;
      if (index > -1) {
         // Atualiza: Mescla o registro novo sobre o antigo para não perder campos
         novosRegistros = [...registrosAtuais];
         novosRegistros[index] = { ...registrosAtuais[index], ...registro };
         console.log(`Registro ${registro.id} atualizado no AppState.`);
      } else {
         // Adiciona novo registro
         novosRegistros = [...registrosAtuais, registro];
         console.log(`Registro ${registro.id} adicionado ao AppState.`);
      }
      // Atualiza o estado. A subscrição em main.js cuidará de salvar no CacheManager.
      AppState.update('registros', novosRegistros);
   }


  /** Preenche os selects de Categoria e Urgência com base no CONFIG. */
  function populateSelects() {
    const catSelect = document.getElementById('categoriaProblema');
    const urgSelect = document.getElementById('urgencia');
    const configCategorias = Config?.CATEGORIAS_PROBLEMA || [];
    const configUrgencias = Config?.NIVEIS_URGENCIA || [];

    const populate = (select, options) => {
        if (!select || !Array.isArray(options)) return;
        // Limpa opções exceto a primeira placeholder
        while (select.options.length > 1) select.remove(1);
        // Adiciona novas opções
        options.forEach(opt => select.add(new Option(opt, opt)));
    };

    populate(catSelect, configCategorias);
    populate(urgSelect, configUrgencias);
  }

   /** Preenche os containers de checklist PRÉ e PÓS com base no CONFIG. */
   function populateChecklists() {
       const checklistPreContainer = document.getElementById('checklistPreContainer');
       const checklistPosContainer = document.getElementById('checklistPosContainer');
       const items = Config?.CHECKLIST_ITEMS || [];

       if (!items || items.length === 0) {
          console.warn("Checklist não configurado em CONFIG.CHECKLIST_ITEMS");
          const msg = '<p class="text-muted small fst-italic col-12">Checklist não configurado.</p>';
          if (checklistPreContainer) checklistPreContainer.innerHTML = msg;
          if (checklistPosContainer) checklistPosContainer.innerHTML = msg;
          return;
       }

       populateChecklistContainer(checklistPreContainer, items, 'Pre');
       populateChecklistContainer(checklistPosContainer, items, 'Pos');
   }

   /** Função auxiliar para criar os radios do checklist em um container. */
   function populateChecklistContainer(container, items, suffix) {
      if (!container) return;
      container.innerHTML = ''; // Limpa
      items.forEach(item => {
          if (!item || !item.id || !item.label) {
             console.warn("Item de checklist inválido no config:", item);
             return;
          }
          const col = document.createElement('div');
          col.className = 'col-md-6 col-lg-4 mb-3 checklist-item-wrapper';
          const uniqueName = `checklist_${item.id}${suffix}`;
          const okId = `${uniqueName}_ok`;
          const danificadoId = `${uniqueName}_danificado`;
          const naId = `${uniqueName}_na`;
          const sanitizedLabel = Utils?.sanitizeString(item.label) || item.label; // Usa Utils

          col.innerHTML = `
              <label class="form-label d-block fw-bold mb-1">${sanitizedLabel} <span class="text-danger">*</span></label>
              <div class="btn-group w-100" role="group" aria-label="Checklist ${sanitizedLabel}">
                  <input type="radio" class="btn-check" name="${uniqueName}" id="${okId}" value="OK" required>
                  <label class="btn btn-outline-success" for="${okId}"><i class="bi bi-check-lg"></i> OK</label>

                  <input type="radio" class="btn-check" name="${uniqueName}" id="${danificadoId}" value="Danificado">
                  <label class="btn btn-outline-danger" for="${danificadoId}"><i class="bi bi-exclamation-triangle"></i> Danificado</label>

                  <input type="radio" class="btn-check" name="${uniqueName}" id="${naId}" value="N/A">
                  <label class="btn btn-outline-secondary" for="${naId}">N/A</label>
              </div>
              <div class="checklist-feedback">Selecione uma opção.</div>
          `;
          container.appendChild(col);
      });
   }


  /** Coleta dados de um formulário. */
  function collectFormData(form) {
    if (!form) return {};
    const data = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      // Trata campos que podem aparecer múltiplas vezes (ex: checkboxes)
      if (data.hasOwnProperty(key)) {
         if (!Array.isArray(data[key])) data[key] = [data[key]];
         data[key].push(value);
      } else {
         data[key] = value;
      }
    }

    // Coleta radios customizados (btn-check) que FormData pode não pegar corretamente
    form.querySelectorAll('.btn-check[type="radio"]:checked').forEach(radio => {
        if (radio.name) data[radio.name] = radio.value;
    });

    // Coleta checkboxes (FormData só inclui os marcados) - Garante que desmarcado = false
    form.querySelectorAll('input[type="checkbox"]').forEach(chk => {
       if (chk.name && !data.hasOwnProperty(chk.name)) { // Se não foi incluído pelo FormData (estava desmarcado)
          data[chk.name] = false;
       } else if (chk.name) { // Se foi incluído, garante que o valor é booleano
          data[chk.name] = true;
       }
    });

    // Garante que todos os campos com ID sejam considerados se não tiverem 'name'
     form.querySelectorAll('input[id]:not([name]), textarea[id]:not([name]), select[id]:not([name])').forEach(el => {
       if (el.id && !data.hasOwnProperty(el.id)) {
          data[el.id] = el.value;
       }
    });

    // Converte números
    form.querySelectorAll('input[type="number"]').forEach(numInput => {
       if (numInput.name && data.hasOwnProperty(numInput.name)) {
          data[numInput.name] = parseFloat(data[numInput.name]) || null; // Converte para número ou null
       } else if (numInput.id && data.hasOwnProperty(numInput.id)) {
           data[numInput.id] = parseFloat(data[numInput.id]) || null;
       }
    });

    delete data['']; // Remove chave vazia se houver
    return data;
  }


  /** Preenche um formulário com dados de um objeto. */
  function fillForm(form, data) {
    if (!form || !data) return;
    // Não reseta aqui, pois pode sobrescrever dados parciais

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        let element = form.elements[key]; // Tenta por 'name'

        // Caso especial para radios (elements[key] retorna RadioNodeList)
        if (element instanceof RadioNodeList) {
            element.forEach(radio => radio.checked = (radio.value === String(data[key])));
        }
        // Outros elementos (input, textarea, select)
        else if (element) {
           if (element.type === 'checkbox') {
             element.checked = !!data[key];
           } else if (element.type === 'date' && typeof data[key] === 'string' && data[key]?.includes('T')) {
             // Formata data ISO para input date
             element.value = data[key].split('T')[0];
           } else if (element.tagName === 'SELECT') {
              element.value = data[key] ?? ''; // Usa ?? para tratar null/undefined
              // Dispara evento change para atualizar UI se necessário
              // element.dispatchEvent(new Event('change'));
           } else {
             element.value = data[key] ?? '';
           }
        }
         // Se não achou por 'name', tenta por ID (para elementos sem name ou radios btn-check)
         else {
            const elementById = form.querySelector(`#${key}`);
            if (elementById && elementById.tagName !== 'FIELDSET' && elementById.tagName !== 'DIV') { // Evita tentar preencher divs/fieldsets
               if (elementById.type === 'checkbox') {
                   elementById.checked = !!data[key];
               } else {
                   elementById.value = data[key] ?? '';
               }
            }
             // Tenta preencher radios btn-check pelo name (se key for o name)
             else {
                 const radios = form.querySelectorAll(`.btn-check[type="radio"][name="${key}"]`);
                 if (radios.length > 0) {
                     radios.forEach(radio => radio.checked = (radio.value === String(data[key])));
                 }
             }
         }
      }
    }
  }

  /** Reseta um formulário, limpando valores e classes de validação. */
  function resetForm(form) {
    if (form) {
       form.reset();
       form.classList.remove('was-validated');
       form.querySelectorAll('.is-invalid, .is-valid').forEach(el => el.classList.remove('is-invalid', 'is-valid'));
       form.querySelectorAll('.invalid-feedback, .checklist-feedback').forEach(el => el.style.display = 'none');
    }
  }

  /** Valida um formulário. */
  function validateForm(form) {
     if (!form) return false;
     let isFormValid = true;

     // Limpa validações anteriores
     form.classList.remove('was-validated');
     form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
     form.querySelectorAll('.invalid-feedback, .checklist-feedback').forEach(el => el.style.display = 'none');

     // Adiciona classe para ativar feedback visual do Bootstrap
     form.classList.add('was-validated');

     // Validação HTML5 nativa (verifica todos os campos com 'required', 'pattern', etc.)
     if (!form.checkValidity()) {
        console.log("Validação HTML5 padrão falhou.");
        isFormValid = false;
        // O navegador e Bootstrap devem destacar os campos inválidos automaticamente
     }

     // Validação customizada para radios btn-check (checkValidity pode não pegar corretamente)
      form.querySelectorAll('.checklist-item-wrapper').forEach(wrapper => {
         const radios = wrapper.querySelectorAll('input[type="radio"]');
         if (radios.length > 0 && radios[0].required) {
            const isChecked = Array.from(radios).some(radio => radio.checked);
            const feedbackElement = wrapper.querySelector('.checklist-feedback');
            if (!isChecked) {
                isFormValid = false;
                // Adiciona classe inválida às labels dos botões
                wrapper.querySelectorAll('.btn-group label').forEach(label => label.classList.add('is-invalid'));
                if (feedbackElement) feedbackElement.style.display = 'block';
            } else {
               // Remove classe inválida se um foi marcado
               wrapper.querySelectorAll('.btn-group label.is-invalid').forEach(label => label.classList.remove('is-invalid'));
               if (feedbackElement) feedbackElement.style.display = 'none';
            }
         }
      });


     // Validação customizada com Security (se existir)
     if (Security) {
        form.querySelectorAll('[data-validate]').forEach(field => {
           if (!Security.validateField(field)) { // Assume que validateField adiciona/remove .is-invalid
              isFormValid = false;
           }
        });
     }

     return isFormValid;
  }

   /** Atualiza a área de resumo na tela PÓS. */
   function updatePosSummary(registroData) {
      const sanitize = Utils?.sanitizeString || (str => str || ''); // Usa fallback
      const placaEl = document.getElementById('placaPos');
      const modeloEl = document.getElementById('modeloPos');
      const idIntEl = document.getElementById('idInternaPos');
      if(placaEl) placaEl.textContent = sanitize(registroData?.placa) || '--';
      if(modeloEl) modeloEl.textContent = sanitize(registroData?.modelo) || '--';
      if(idIntEl) idIntEl.textContent = sanitize(registroData?.idInterna) || '--';
   }

   /** Preenche a tela de visualização com os dados. */
   function populateViewScreen(registro) {
      const sanitize = Utils?.sanitizeString || (str => str || '');
      const formatDateTime = Utils?.formatarDataHora || (d => d ? new Date(d).toLocaleString() : '--');
      const formatDate = Utils?.formatarData || (d => d ? new Date(d).toLocaleDateString() : '--');
      const formatKm = Utils?.formatarKm || (km => km ? `${km} km` : '--');

      // Preenche campos simples
      const fields = {
         'registroIdVisualizar': `ID: ${sanitize(registro?.id)}`, 'placaView': sanitize(registro?.placa),
         'modeloView': sanitize(registro?.modelo), 'idInternaView': sanitize(registro?.idInterna),
         'dataView': formatDateTime(registro?.dataCriacao), 'responsavelView': sanitize(registro?.responsavel),
         'categoriaView': sanitize(registro?.categoriaProblema), 'urgenciaView': sanitize(registro?.urgencia),
         'descricaoProblemaView': sanitize(registro?.descricaoProblema) || 'Nenhuma descrição.',
         'quilometragemView': formatKm(registro?.quilometragem),
         'observacoesPreView': sanitize(registro?.observacoesPre) || 'Nenhuma.',
         'observacoesPosView': sanitize(registro?.observacoesPos) || 'Nenhuma.'
      };
      for (const id in fields) {
         const el = document.getElementById(id);
         if (el) el.textContent = fields[id] || '--'; // Usa textContent para segurança
      }
       // Caso especial para descrição que pode ser longa (usar innerHTML se precisar de <br>)
       const descEl = document.getElementById('descricaoProblemaView');
       if(descEl) descEl.innerHTML = sanitize(registro?.descricaoProblema).replace(/\n/g, '<br>') || '<span class="text-muted fst-italic">Nenhuma descrição.</span>';


      // Status
      const statusView = document.getElementById('statusView');
      if(statusView) {
          let statusText = 'Pendente'; let statusClass = 'bg-secondary';
          if (registro?.dataFinalizacao) {
              statusText = `Concluído (${formatDate(registro.dataFinalizacao)})`; statusClass = 'bg-success';
          } else if (Object.keys(registro || {}).some(k => k.startsWith('checklist_') && k.endsWith('Pos') && registro[k])) { // Verifica se algum checklist PÓS foi preenchido
              statusText = 'Pós Iniciado'; statusClass = 'bg-info text-dark';
          } else if (registro?.descricaoProblema || (registro?.fotosPre?.length > 0)) { // Verifica se PRÉ foi iniciado
              statusText = 'Pré Iniciado'; statusClass = 'bg-warning text-dark';
          }
          statusView.textContent = statusText; statusView.className = `badge ${statusClass}`;
      }

      // Checklists
      populateChecklistView('checklistPreView', registro, 'Pre');
      populateChecklistView('checklistPosView', registro, 'Pos');

      // Botão Editar (recria para garantir listener único)
      const editBtn = document.getElementById('btnEditarVisualizacao');
      if(editBtn && registro?.id) {
         const newEditBtn = editBtn.cloneNode(true);
         editBtn.parentNode.replaceChild(newEditBtn, editBtn);
         newEditBtn.addEventListener('click', () => loadRegistro(registro.id));
         newEditBtn.disabled = false; // Garante que está habilitado
      } else if(editBtn) {
         editBtn.disabled = true; // Desabilita se não houver ID
      }
   }

    /** Preenche a tabela de checklist na visualização. */
    function populateChecklistView(tableBodyId, registro, suffix) {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const items = Config?.CHECKLIST_ITEMS || [];
        const sanitize = Utils?.sanitizeString || (str => str || '');

        if (items.length === 0) {
            tableBody.innerHTML = '<tr><td class="text-muted small fst-italic">Checklist não configurado.</td></tr>';
            return;
        }

        items.forEach(item => {
            const key = `checklist_${item.id}${suffix}`;
            const value = registro ? registro[key] : undefined; // Verifica se registro existe
            let badgeClass = 'bg-secondary'; let valueText = 'N/R'; // Não Registrado
            if (value === 'OK') { badgeClass = 'bg-success'; valueText = 'OK'; }
            else if (value === 'Danificado') { badgeClass = 'bg-danger'; valueText = 'Danificado'; }
            else if (value === 'N/A') { badgeClass = 'bg-secondary'; valueText = 'N/A'; }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sanitize(item.label)}</td>
                <td class="text-end"><span class="badge ${badgeClass}">${valueText}</span></td>
            `;
            tableBody.appendChild(row);
        });
    }

    /** Renderiza fotos na tela de visualização. */
    function renderPhotosForView(registroId, type, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !PhotoHandler) return; // Precisa do PhotoHandler
        container.innerHTML = '<p class="text-muted small fst-italic col-12">Carregando fotos...</p>';

        const photos = PhotoHandler.getPhotos(registroId, type);

        if (photos.length === 0) {
            container.innerHTML = '<p class="text-muted small fst-italic col-12">Nenhuma foto registrada.</p>';
            return;
        }

        container.innerHTML = ''; // Limpa
        photos.forEach(photo => {
            if (!photo || !photo.dataUrl) return;
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 col-lg-3 mb-2';
            const safeName = Utils?.sanitizeString(photo.name) || 'foto';
            col.innerHTML = `
                <img src="${photo.dataUrl}" class="img-thumbnail photo-thumbnail-view"
                     alt="${safeName}" title="Clique para ampliar: ${safeName}"
                     style="cursor: pointer; width: 100%; height: 100px; object-fit: cover;">
            `;
            // Adiciona listener para abrir o modal usando PhotoHandler
            col.querySelector('img')?.addEventListener('click', () => PhotoHandler.showPhotoModal(photo));
            container.appendChild(col);
        });
    }


  // --- Navegação e Utilidade ---

  /** Mostra uma tela específica e esconde as outras. */
  function showScreen(screenId) { Utils?.showScreen?.(screenId); }

  /** Navega de volta para a tela de lista de registros. */
  function goToList() {
    showScreen('telaListaRegistros');
    // Delega a atualização da lista para o App, se existir
     if(typeof App !== 'undefined' && App.refreshRegistrosList) {
        console.log("FormHandler->goToList: Solicitando atualização da lista ao App.");
        App.refreshRegistrosList();
     }
  }

  /** Reseta os formulários, limpa fotos temporárias e navega para a lista. */
  function resetAndGoToList() {
     console.log("Resetando formulários e voltando para a lista...");
     resetForm(formPre);
     resetForm(formPos);
     PhotoHandler?.clearPhotosForRegistro(currentRegistroId || 'new');
     currentRegistroId = null;
     goToList();
  }

  /** Função utilitária para notificações. */
  function notify(type, message) {
      // Tenta usar as funções globais melhoradas por main.js
      const funcName = `show${type.charAt(0).toUpperCase() + type.slice(1)}Message`;
      const notificationFunc = window[funcName] || window.showNotification;
      if (notificationFunc) {
         notificationFunc(message, type); // Passa o tipo para a função genérica
      } else {
         console.warn("Sistema de notificação global não encontrado.");
         alert(`[${type.toUpperCase()}] ${message}`); // Fallback
      }
  }


  // --- Exportação do Módulo ---
  return {
    init,
    newRegistro,
    loadRegistro,
    viewRegistro
  };
});
