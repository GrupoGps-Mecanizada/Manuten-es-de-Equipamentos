/**
 * Manipulador de Formulários do Sistema de Manutenção
 * Gerencia a coleta, validação e submissão dos dados dos formulários.
 */
ModuleLoader.register('formHandler', function() {

  // Referências aos elementos do formulário (preenchidas no mapFormElements)
  let formPre, formPos;
  let currentRegistroId = null; // Armazena o ID do registro sendo editado/visualizado

  // Referências aos módulos e utilitários (preenchidas no init)
  let ApiClient = null;
  let PhotoHandler = null;
  let AppState = null;
  let Utils = null;
  let Security = null;
  let Config = null; // Para acessar configurações como checklist

  /**
   * Inicializa o módulo FormHandler.
   * Obtém dependências, mapeia elementos e configura listeners.
   */
  function init() {
    console.log('Inicializando FormHandler...');

    // Obter dependências do ModuleLoader e globais
    ApiClient = ModuleLoader.get('apiClient');
    PhotoHandler = ModuleLoader.get('photoHandler');
    AppState = ModuleLoader.get('state');
    Security = ModuleLoader.get('security');
    Utils = window.Utils; // Assume global
    Config = window.CONFIG; // Assume global

    // Validação crítica de dependências
    if (!PhotoHandler || !AppState || !Utils || !Config || !Security) {
       console.error("FormHandler: Dependências essenciais (PhotoHandler, AppState, Utils, Config, Security) não carregadas!");
       // Poderia notificar o usuário ou impedir a inicialização
       if (Utils && Utils.showNotification) Utils.showNotification('Erro crítico ao carregar módulo de formulários.', 'error');
       return; // Interrompe inicialização do módulo
    }
     // ApiClient pode ser opcional dependendo se o modo offline é aceitável
     if (!ApiClient) {
        console.warn("FormHandler: ApiClient não carregado. Funcionalidades online (salvar, listar) estarão indisponíveis.");
     }


    // Mapear elementos principais dos formulários
    mapFormElements();

    // Configurar listeners dos formulários e botões principais
    setupFormListeners();

    // Preencher selects dinâmicos (categorias, urgência)
    populateSelects();

    // Preencher os checklists PRÉ e PÓS
    populateChecklists();

    // Inicializar os containers de fotos (importante fazer após obter PhotoHandler)
    // Passa 'new' como ID inicial para indicar um novo registro (será atualizado ao carregar/salvar)
     if (document.getElementById('photo-container-pre')) {
        PhotoHandler.initContainerUI('photo-container-pre', 'pre', 'new');
     }
     if (document.getElementById('photo-container-pos')) {
        PhotoHandler.initContainerUI('photo-container-pos', 'pos', 'new');
     }

    console.log('FormHandler inicializado com sucesso.');
  }

  /**
   * Mapeia os elementos principais dos formulários para variáveis locais.
   */
  function mapFormElements() {
    formPre = document.getElementById('formPreManutencao');
    formPos = document.getElementById('formPosManutencao');
    // Poderia mapear outros elementos frequentemente usados aqui se necessário
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
         if (currentRegistroId) {
            PhotoHandler.initContainerUI('photo-container-pre', 'pre', currentRegistroId);
         }
         showScreen('telaPreManutencao');
      });
    }
     // Listener para botão Editar na tela de Visualização
     document.getElementById('btnEditarVisualizacao')?.addEventListener('click', handleEditClick);
     // Listener para botão Voltar da Visualização (já configurado no app.js, mas pode garantir aqui também)
      document.getElementById('btnVoltarLista')?.addEventListener('click', goToList);

      // Listeners nos botões principais (Novo, Lista) já estão no app.js
  }

  // --- Funções de Ação do Usuário ---

  /**
   * Limpa os formulários e prepara a interface para um novo registro.
   */
  function newRegistro() {
    console.log("Iniciando novo registro...");
    currentRegistroId = 'new'; // Usa 'new' para consistência até salvar
    resetForm(formPre);
    resetForm(formPos);
    // Limpa e re-inicializa as UIs de fotos para o estado 'new'
    PhotoHandler.clearPhotosForRegistro('new'); // Limpa fotos 'new' do estado
    PhotoHandler.initContainerUI('photo-container-pre', 'pre', 'new');
    PhotoHandler.initContainerUI('photo-container-pos', 'pos', 'new');
    // Preencher campos padrão (ex: data, responsável logado) se necessário
    // const currentUser = AppState.get('currentUser');
    // if(currentUser) document.getElementById('responsavel').value = currentUser.name;

    showScreen('telaPreManutencao');
    document.getElementById('registroIdDisplay').textContent = 'Novo Registro'; // Atualiza display PRE
     document.getElementById('registroIdPosDisplay').textContent = 'Novo Registro'; // Atualiza display POS
     updatePosSummary({}); // Limpa resumo POS
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
     currentRegistroId = registroId; // Define o ID atual
     showLoadingSpinner(true, "Carregando dados do registro...");

     try {
        const registro = await getRegistroData(registroId); // Busca dados (cache/API)
        if (!registro) {
           notify('error', `Registro ${registroId} não encontrado.`);
           goToList();
           return; // Sai da função se não encontrou
        }

        // Limpa formulários antes de preencher
        resetForm(formPre);
        resetForm(formPos);

        // Preencher formulário PRÉ com os dados encontrados
        fillForm(formPre, registro);
        // Preencher formulário PÓS com os dados encontrados (se existirem)
        fillForm(formPos, registro);

        // Re-inicializa containers de fotos COM o ID correto para carregar fotos salvas
        PhotoHandler.initContainerUI('photo-container-pre', 'pre', registroId);
        PhotoHandler.initContainerUI('photo-container-pos', 'pos', registroId);

        // Atualizar displays de ID e resumo na tela PÓS
        document.getElementById('registroIdDisplay').textContent = `ID: ${registroId}`;
        document.getElementById('registroIdPosDisplay').textContent = `ID: ${registroId}`;
        updatePosSummary(registro); // Atualiza resumo com dados carregados

        showScreen('telaPreManutencao'); // Sempre começa pela tela PRÉ ao editar

     } catch (error) {
        console.error(`Erro ao carregar registro ${registroId} para edição:`, error);
        notify('error', `Erro ao carregar dados: ${error.message}`);
        goToList(); // Volta para lista em caso de erro
     } finally {
        showLoadingSpinner(false);
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
       currentRegistroId = registroId; // Define ID para caso o usuário clique em Editar
       showLoadingSpinner(true, "Carregando dados para visualização...");

       try {
           const registro = await getRegistroData(registroId);
           if (!registro) {
               notify('error', `Registro ${registroId} não encontrado.`);
               goToList();
               return;
           }

           // Preencher campos da tela de visualização
           populateViewScreen(registro);

           // Renderizar as fotos salvas diretamente na tela de visualização
           renderPhotosForView(registroId, 'pre', 'fotosPreView');
           renderPhotosForView(registroId, 'pos', 'fotosPosView');

           showScreen('telaVisualizacao');
       } catch (error) {
           console.error(`Erro ao visualizar registro ${registroId}:`, error);
           notify('error', `Erro ao carregar dados para visualização: ${error.message}`);
           goToList();
       } finally {
           showLoadingSpinner(false);
       }
   }

   // --- Funções de Submissão ---

  /**
   * Manipula o envio do formulário PRÉ-manutenção. Valida, coleta dados,
   * atualiza o estado e avança para a tela PÓS.
   * @param {Event} event - O evento de submit do formulário.
   */
  async function handlePreSubmit(event) {
    event.preventDefault(); // Impede o envio padrão do formulário
    event.stopPropagation();

    if (!formPre || !validateForm(formPre)) {
      notify('warning', 'Por favor, corrija os erros no formulário PRÉ-manutenção.');
      formPre.querySelector('.is-invalid')?.focus(); // Foca no primeiro campo inválido
      return;
    }

    // Coletar dados do formulário PRÉ
    const dadosPre = collectFormData(formPre);

    // Definir ou confirmar ID do registro
    if (!currentRegistroId || currentRegistroId === 'new') {
       dadosPre.id = Utils.gerarId(); // Gera um novo ID único
       dadosPre.dataCriacao = new Date().toISOString(); // Define data de criação
       currentRegistroId = dadosPre.id; // Atualiza o ID atual
       console.log(`Novo registro iniciado com ID: ${currentRegistroId}`);
    } else {
       dadosPre.id = currentRegistroId; // Usa o ID existente (modo edição)
       // Não sobrescreve dataCriacao se já existia
        const registroExistente = await getRegistroData(currentRegistroId);
        dadosPre.dataCriacao = registroExistente?.dataCriacao || new Date().toISOString();
       console.log(`Atualizando dados PRÉ para registro: ${currentRegistroId}`);
    }

     // Obter fotos PRÉ (objetos completos com dataUrl) associadas a este ID
     dadosPre.fotosPre = PhotoHandler.getPhotos(currentRegistroId, 'pre');


     // Salvar dados parciais no estado local (AppState)
     updateAppStateRegistro(dadosPre);

     // --- Preparar e ir para a tela PÓS ---
     document.getElementById('registroIdPos').value = currentRegistroId; // Define hidden input
     document.getElementById('registroIdPosDisplay').textContent = `ID: ${currentRegistroId}`; // Atualiza display
     updatePosSummary(dadosPre); // Atualiza resumo na tela PÓS com dados PRÉ

     // Re-inicializa/carrega fotos PÓS com o ID correto
     PhotoHandler.initContainerUI('photo-container-pos', 'pos', currentRegistroId);

     notify('info', 'Dados PRÉ salvos localmente. Prossiga para a etapa PÓS.');
     showScreen('telaPosManutencao');
  }

  /**
   * Manipula o envio do formulário PÓS-manutenção. Valida, coleta dados,
   * combina com dados PRÉ, salva (via API ou localmente) e retorna à lista.
   * @param {Event} event - O evento de submit do formulário.
   */
  async function handlePosSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!formPos || !validateForm(formPos)) {
      notify('warning', 'Por favor, corrija os erros no formulário PÓS-manutenção.');
      formPos.querySelector('.is-invalid')?.focus();
      return;
    }

    if (!currentRegistroId || currentRegistroId === 'new') {
       notify('error', 'Erro crítico: ID do registro não definido para finalizar.');
       showScreen('telaPreManutencao'); // Volta para PRE
       return;
    }

    showLoadingSpinner(true, "Finalizando e salvando registro...");

    // Coletar dados do formulário PÓS
    const dadosPos = collectFormData(formPos);
    dadosPos.id = currentRegistroId; // Garante que o ID está nos dados PÓS
    dadosPos.dataFinalizacao = new Date().toISOString(); // Marca data/hora da finalização

    // Obter fotos PÓS associadas a este ID
    dadosPos.fotosPos = PhotoHandler.getPhotos(currentRegistroId, 'pos');


    // --- Combinar dados PRÉ e PÓS ---
    // Busca o registro PRÉ (que já deve incluir fotos PRÉ) do estado
    const registroPre = (AppState.get('registros') || []).find(r => r.id === currentRegistroId);

    if (!registroPre) {
       notify('error', 'Erro crítico: Dados PRÉ não encontrados no estado para finalizar.');
       showLoadingSpinner(false);
       return;
    }

    // Mescla os dados: dadosPos sobrescrevem/complementam dadosPre
    const registroCompleto = { ...registroPre, ...dadosPos };


    console.log('Registro completo pronto para salvar:', registroCompleto);

    try {
        // Tenta salvar via API se disponível e online
        if (ApiClient && navigator.onLine) {
            console.log("Tentando salvar registro via API...");
            const resultadoAPI = await ApiClient.salvarRegistro(registroCompleto);

             if (resultadoAPI && resultadoAPI.success !== false) { // Assume sucesso se não for explicitamente false
                 notify('success', `Registro ${currentRegistroId} salvo com sucesso na nuvem!`);
                 // Atualiza estado local com a versão final da API (pode ter IDs de fotos, etc.)
                 updateAppStateRegistro(resultadoAPI.registro || registroCompleto);
                 // Limpa fotos temporárias do registro que foi salvo com sucesso
                 PhotoHandler.clearPhotosForRegistro(currentRegistroId);
                 resetAndGoToList(); // Volta para a lista
             } else {
                 // API retornou erro, mas estamos online - salva localmente como fallback
                 console.warn("API retornou erro ou falha ao salvar. Salvando localmente.", resultadoAPI?.message);
                 notify('warning', `Falha ao salvar na nuvem (${resultadoAPI?.message || 'Erro desconhecido'}). Registro salvo localmente para sincronização posterior.`);
                 updateAppStateRegistro(registroCompleto); // Garante que está salvo localmente
                 resetAndGoToList(); // Volta para a lista (com dados locais)
             }
        } else {
           // Salva localmente (Offline ou ApiClient indisponível)
           console.log("Salvando registro localmente (Offline ou API indisponível)...");
           updateAppStateRegistro(registroCompleto);
           notify('info', `Registro ${currentRegistroId} salvo localmente. Será sincronizado quando online.`);
           resetAndGoToList(); // Volta para a lista
        }

    } catch (error) {
        // Erro durante a tentativa de salvar (ex: falha de rede não capturada antes)
        console.error('Erro crítico ao tentar salvar registro final:', error);
        notify('error', `Erro ao salvar: ${error.message}. O registro foi salvo localmente.`);
        // Garante que está salvo localmente mesmo em caso de erro na API
        updateAppStateRegistro(registroCompleto);
        resetAndGoToList(); // Volta para a lista
    } finally {
        showLoadingSpinner(false);
    }
  }

   /**
    * Manipula o clique no botão Editar na tela de visualização.
    * Simplesmente chama loadRegistro com o ID atual.
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

      // 1. Tenta do AppState (que pode ter vindo do cache ou API anteriormente)
      const registrosState = AppState.get('registros') || [];
      let registro = registrosState.find(r => r.id === registroId);
      if (registro) {
         console.log(`Registro ${registroId} encontrado no AppState.`);
         // Importante: busca fotos associadas do PhotoHandler/AppState também
         registro.fotosPre = PhotoHandler.getPhotos(registroId, 'pre');
         registro.fotosPos = PhotoHandler.getPhotos(registroId, 'pos');
         return registro;
      }

      // 2. Tenta da API (se disponível e online)
      if (ApiClient && navigator.onLine) {
         console.log(`Registro ${registroId} não encontrado no state, buscando na API...`);
         try {
            // obterRegistro já deve tratar cache interno se implementado no ApiClient
            const registroApi = await ApiClient.obterRegistro(registroId);
            if (registroApi) {
               console.log(`Registro ${registroId} obtido da API.`);
               // Atualiza o AppState com o registro da API
               updateAppStateRegistro(registroApi);
                // Busca fotos associadas (API pode ou não retornar URLs/IDs, PhotoHandler deve lidar)
               registroApi.fotosPre = PhotoHandler.getPhotos(registroId, 'pre');
               registroApi.fotosPos = PhotoHandler.getPhotos(registroId, 'pos');
               return registroApi;
            }
         } catch (error) {
            console.error(`Erro ao buscar registro ${registroId} da API:`, error);
            // Não lança erro aqui, apenas falhou em encontrar via API
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
      const index = registrosAtuais.findIndex(r => r.id === registro.id);

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


  /**
   * Preenche os selects de Categoria e Urgência com base no CONFIG.
   */
  function populateSelects() {
    const catSelect = document.getElementById('categoriaProblema');
    const urgSelect = document.getElementById('urgencia');

    // Limpa opções existentes (exceto a primeira "Selecione...")
    const clearSelect = (select) => {
       if(select) Array.from(select.options).forEach((option, index) => { if(index > 0) select.remove(index); });
    };

    if (catSelect) {
       clearSelect(catSelect);
      (Config?.CATEGORIAS_PROBLEMA || []).forEach(cat => {
        catSelect.add(new Option(cat, cat));
      });
    } else {
       console.warn("Elemento select #categoriaProblema não encontrado.");
    }

     if (urgSelect) {
        clearSelect(urgSelect);
       (Config?.NIVEIS_URGENCIA || []).forEach(urg => {
         urgSelect.add(new Option(urg, urg));
       });
     } else {
        console.warn("Elemento select #urgencia não encontrado.");
     }
  }

   /**
    * Preenche os containers de checklist PRÉ e PÓS com base no CONFIG.
    */
   function populateChecklists() {
       const checklistPreContainer = document.getElementById('checklistPreContainer');
       const checklistPosContainer = document.getElementById('checklistPosContainer');
       const items = Config?.CHECKLIST_ITEMS || [];

       if (!items || items.length === 0) {
          console.warn("Checklist não configurado em CONFIG.CHECKLIST_ITEMS");
          const msg = '<p class="text-muted small fst-italic">Checklist não configurado.</p>';
          if (checklistPreContainer) checklistPreContainer.innerHTML = msg;
          if (checklistPosContainer) checklistPosContainer.innerHTML = msg;
          return;
       }

       // Função auxiliar para popular um container específico
       const populateContainer = (container, suffix) => {
          if (!container) return;
          container.innerHTML = ''; // Limpa container
          items.forEach(item => {
              if (!item || !item.id || !item.label) {
                 console.warn("Item de checklist inválido no config:", item);
                 return; // Pula item inválido
              }
              const col = document.createElement('div');
              col.className = 'col-md-6 col-lg-4 mb-3 checklist-item-wrapper'; // Wrapper para layout
              const uniqueName = `checklist_${item.id}${suffix}`; // Nome único para o grupo de radios
              const okId = `${uniqueName}_ok`;
              const danificadoId = `${uniqueName}_danificado`;
              const naId = `${uniqueName}_na`;

              col.innerHTML = `
                  <label class="form-label d-block fw-bold mb-1">${Utils.sanitizeString(item.label)} <span class="text-danger">*</span></label>
                  <div class="btn-group w-100" role="group" aria-label="Checklist ${item.label}">
                      <input type="radio" class="btn-check" name="${uniqueName}" id="${okId}" value="OK" required>
                      <label class="btn btn-outline-success" for="${okId}"><i class="bi bi-check-lg"></i> OK</label>

                      <input type="radio" class="btn-check" name="${uniqueName}" id="${danificadoId}" value="Danificado">
                      <label class="btn btn-outline-danger" for="${danificadoId}"><i class="bi bi-exclamation-triangle"></i> Danificado</label>

                      <input type="radio" class="btn-check" name="${uniqueName}" id="${naId}" value="N/A">
                      <label class="btn btn-outline-secondary" for="${naId}">N/A</label>
                  </div>
                  <div class="invalid-feedback checklist-feedback" style="display: none; width: 100%; margin-top: 0.25rem; font-size: 0.875em;">Selecione uma opção.</div>
              `;
              container.appendChild(col);
          });
       };

       populateContainer(checklistPreContainer, 'Pre');
       populateContainer(checklistPosContainer, 'Pos');
   }


  /**
   * Coleta dados de um formulário, incluindo inputs, textareas, selects e radios customizados.
   * @param {HTMLFormElement} form - O elemento do formulário.
   * @returns {Object} Um objeto com os dados coletados (chave = id/name, valor = valor).
   */
  function collectFormData(form) {
    if (!form) return {};
    const data = {};
    const formData = new FormData(form); // Pega a maioria dos campos (exceto radios desmarcados, etc)

    // Itera sobre FormData
    for (const [key, value] of formData.entries()) {
       // Tratar múltiplos valores (checkboxes com mesmo nome) - Não usado aqui, mas como exemplo
       // if (data.hasOwnProperty(key)) {
       //    if (!Array.isArray(data[key])) data[key] = [data[key]];
       //    data[key].push(value);
       // } else {
          data[key] = value;
       // }
    }

    // Coletar radios customizados (btn-check) que podem não ser pegos corretamente pelo FormData
    form.querySelectorAll('.btn-check[type="radio"]:checked').forEach(radio => {
        if (radio.name) {
           data[radio.name] = radio.value;
        }
    });

    // Garantir que todos os campos com ID sejam incluídos (caso não tenham name ou não foram pegos)
    form.querySelectorAll('input[id], textarea[id], select[id]').forEach(el => {
       if (el.id && !data.hasOwnProperty(el.id)) { // Adiciona se não foi pego pelo FormData (pode acontecer com name diferente de id)
          if (el.type === 'checkbox') {
             data[el.id] = el.checked;
          } else {
             data[el.id] = el.value;
          }
       } else if (el.id && data.hasOwnProperty(el.id) && el.type === 'number') {
          // Converter para número se for input number
          data[el.id] = parseFloat(el.value) || null; // Ou parseInt, dependendo do caso
       }
    });

     // Limpeza: remover chaves vazias que podem ser geradas
     delete data[''];

    // console.debug("Dados coletados do formulário:", form.id, data);
    return data;
  }


  /**
   * Preenche um formulário com dados de um objeto.
   * @param {HTMLFormElement} form - O formulário a ser preenchido.
   * @param {Object} data - O objeto contendo os dados.
   */
  function fillForm(form, data) {
    if (!form || !data) return;
    // resetForm(form); // Resetar antes de preencher é feito em loadRegistro/newRegistro

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
         // Tenta encontrar por name primeiro (padrão do FormData)
         let element = form.elements[key];

         // Se não achou por name, tenta por ID (para campos sem name ou radios customizados)
         if (!element) {
            element = form.querySelector(`#${key}`);
         }
         // Caso especial para radios (elements[key] retorna NodeList)
         if (form.elements[key] && form.elements[key] instanceof NodeList) {
            element = form.elements[key]; // Usa a NodeList
         }


        if (element) {
          // Tratar Radio buttons (NodeList ou btn-check com mesmo name)
          if (element instanceof NodeList || (element.type === 'radio' && element.name === key)) {
             const radios = (element instanceof NodeList) ? Array.from(element) : form.querySelectorAll(`input[name="${key}"][type="radio"]`);
             radios.forEach(radio => {
                radio.checked = (radio.value === String(data[key])); // Compara valor
             });
          }
          // Tratar Checkboxes
          else if (element.type === 'checkbox') {
            element.checked = !!data[key]; // Converte para booleano
          }
          // Outros tipos de input/select/textarea
          else if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
             // Tratar datas ISO para input type="date"
             if (element.type === 'date' && typeof data[key] === 'string' && data[key]?.includes('T')) {
                 try {
                    element.value = data[key].split('T')[0];
                 } catch (e) {
                    console.warn(`Erro ao formatar data ${data[key]} para o campo ${key}`, e);
                    element.value = data[key]; // Fallback
                 }
             } else {
                 element.value = data[key] ?? ''; // Usa ?? para tratar null/undefined como string vazia
             }
          }
        }
      }
    }
  }

  /**
   * Reseta um formulário, limpando valores e classes de validação.
   * @param {HTMLFormElement} form - O formulário a ser resetado.
   */
  function resetForm(form) {
    if (form) {
       form.reset(); // Limpa valores dos campos
       form.classList.remove('was-validated'); // Remove classe de validação Bootstrap
       // Remove classes de erro/sucesso dos campos e feedback
       form.querySelectorAll('.is-invalid, .is-valid').forEach(el => {
         el.classList.remove('is-invalid', 'is-valid');
       });
       form.querySelectorAll('.invalid-feedback, .checklist-feedback').forEach(el => {
          el.style.display = 'none'; // Esconde feedback customizado
          // Reseta texto padrão se necessário
          if(el.classList.contains('checklist-feedback')) el.textContent = 'Selecione uma opção.';
       });
    }
  }

  /**
   * Valida um formulário usando validação HTML5 nativa e validações customizadas (Security e checklists).
   * @param {HTMLFormElement} form - O formulário a ser validado.
   * @returns {boolean} True se o formulário for válido, False caso contrário.
   */
  function validateForm(form) {
     if (!form) return false;
     let isFormValid = true; // Assume válido inicialmente

     // 1. Limpa validações anteriores e adiciona classe para feedback visual do Bootstrap
     form.classList.remove('was-validated');
      form.querySelectorAll('.is-invalid, .is-valid').forEach(el => el.classList.remove('is-invalid', 'is-valid'));
      form.querySelectorAll('.invalid-feedback, .checklist-feedback').forEach(el => el.style.display = 'none');
     form.classList.add('was-validated'); // Ativa feedback do Bootstrap

     // 2. Validação HTML5 nativa (required, pattern, min, max, etc.)
     if (!form.checkValidity()) {
        console.log("Validação HTML5 falhou.");
        isFormValid = false;
        // Bootstrap já deve mostrar os erros padrões
     }

     // 3. Validação customizada com o módulo Security (se houver campos com data-validate)
     if (Security) {
        form.querySelectorAll('[data-validate]').forEach(field => {
           if (!Security.validateField(field)) { // validateField deve adicionar/remover classes is-invalid/is-valid
              isFormValid = false;
           }
        });
     }

      // 4. Validação customizada para grupos de radio (checklists) marcados como required
      form.querySelectorAll('.checklist-item-wrapper').forEach(wrapper => {
         const radios = wrapper.querySelectorAll('input[type="radio"]');
         if (radios.length > 0 && radios[0].required) { // Verifica se o primeiro radio (representando o grupo) é required
            const isChecked = Array.from(radios).some(radio => radio.checked);
            const feedbackElement = wrapper.querySelector('.checklist-feedback');

            if (!isChecked) {
                isFormValid = false;
                // Adiciona classe de inválido aos botões/labels para destaque (opcional)
                wrapper.querySelectorAll('.btn-outline-success, .btn-outline-danger, .btn-outline-secondary')
                   .forEach(label => label.classList.add('is-invalid')); // Borda vermelha nos botões
                if (feedbackElement) feedbackElement.style.display = 'block'; // Mostra a mensagem de erro
            } else {
               // Remove classe de inválido dos botões se uma opção foi marcada
               wrapper.querySelectorAll('.is-invalid').forEach(label => label.classList.remove('is-invalid'));
               if (feedbackElement) feedbackElement.style.display = 'none'; // Esconde mensagem de erro
            }
         }
      });


     return isFormValid;
  }

   /**
    * Atualiza a área de resumo na tela PÓS-manutenção com dados do registro.
    * @param {Object} registroData - Dados do registro (geralmente da etapa PRÉ).
    */
   function updatePosSummary(registroData) {
      const sanitize = Utils?.sanitizeString || (str => str); // Fallback
      document.getElementById('placaPos').textContent = sanitize(registroData?.placa) || '--';
      document.getElementById('modeloPos').textContent = sanitize(registroData?.modelo) || '--';
      document.getElementById('idInternaPos').textContent = sanitize(registroData?.idInterna) || '--';
   }

   /**
    * Preenche a tela de visualização com os dados do registro.
    * @param {Object} registro - Objeto completo do registro.
    */
   function populateViewScreen(registro) {
      const sanitize = Utils?.sanitizeString || (str => str);
      const formatDateTime = Utils?.formatarDataHora || (date => new Date(date).toLocaleString());
      const formatDate = Utils?.formatarData || (date => new Date(date).toLocaleDateString());

      // IDs e informações básicas
      document.getElementById('registroIdVisualizar').textContent = `ID: ${sanitize(registro.id) || '--'}`;
      document.getElementById('placaView').textContent = sanitize(registro.placa) || '--';
      document.getElementById('modeloView').textContent = sanitize(registro.modelo) || '--';
      document.getElementById('idInternaView').textContent = sanitize(registro.idInterna) || '--';
      document.getElementById('dataView').textContent = registro.dataCriacao ? formatDateTime(registro.dataCriacao) : '--';
      document.getElementById('responsavelView').textContent = sanitize(registro.responsavel) || '--';
      document.getElementById('categoriaView').textContent = sanitize(registro.categoriaProblema) || '--';
      document.getElementById('urgenciaView').textContent = sanitize(registro.urgencia) || '--';
      document.getElementById('descricaoProblemaView').textContent = sanitize(registro.descricaoProblema) || 'Nenhuma descrição fornecida.';

      // Quilometragem (se existir)
       const kmView = document.getElementById('quilometragemView'); // Supondo que exista um span com este ID
       if(kmView) kmView.textContent = registro.quilometragem ? `${registro.quilometragem} km` : '--';

      // Status
      const statusView = document.getElementById('statusView');
      if(statusView) {
          let statusText = 'Pendente';
          let statusClass = 'bg-secondary';
          if (registro.dataFinalizacao) {
              statusText = `Concluído (${formatDate(registro.dataFinalizacao)})`;
              statusClass = 'bg-success';
          } else if (registro.fotosPos?.length > 0 || registro.observacoesPos || Object.keys(registro).some(k => k.startsWith('checklist_') && k.endsWith('Pos') && registro[k])) {
              statusText = 'Pós Iniciado';
              statusClass = 'bg-info text-dark'; // Usar text-dark para contraste com bg-info
          } else if (registro.fotosPre?.length > 0 || registro.descricaoProblema || Object.keys(registro).some(k => k.startsWith('checklist_') && k.endsWith('Pre') && registro[k])) {
              statusText = 'Pré Iniciado';
              statusClass = 'bg-warning text-dark'; // Usar text-dark para contraste com bg-warning
          }
          statusView.textContent = statusText;
          statusView.className = `badge ${statusClass}`; // Reseta classes anteriores
      }

      // Checklists
      populateChecklistView('checklistPreView', registro, 'Pre');
      populateChecklistView('checklistPosView', registro, 'Pos');

      // Observações
      document.getElementById('observacoesPreView').textContent = sanitize(registro.observacoesPre) || 'Nenhuma.';
      document.getElementById('observacoesPosView').textContent = sanitize(registro.observacoesPos) || 'Nenhuma.';

      // Botão Editar (garante que o listener está atualizado para o ID correto)
      const editBtn = document.getElementById('btnEditarVisualizacao');
      if(editBtn) {
         // Clona e substitui para remover listeners antigos e adicionar o novo
         const newEditBtn = editBtn.cloneNode(true);
         editBtn.parentNode.replaceChild(newEditBtn, editBtn);
         newEditBtn.addEventListener('click', () => loadRegistro(registro.id));
      }
   }

   /**
    * Preenche a tabela de checklist na tela de visualização.
    * @param {string} tableBodyId - ID do tbody da tabela.
    * @param {Object} registro - Dados do registro.
    * @param {string} suffix - 'Pre' ou 'Pos'.
    */
    function populateChecklistView(tableBodyId, registro, suffix) {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        tableBody.innerHTML = ''; // Limpa conteúdo anterior
        const items = Config?.CHECKLIST_ITEMS || [];

        if (items.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="2" class="text-muted small fst-italic">Checklist não configurado.</td></tr>';
            return;
        }

        items.forEach(item => {
            const key = `checklist_${item.id}${suffix}`; // Chave esperada nos dados do registro
            const value = registro[key];
            let badgeClass = 'bg-secondary';
            let valueText = value || 'N/R'; // Não Registrado ou N/A?

            if (value === 'OK') {
                badgeClass = 'bg-success';
                valueText = 'OK';
            } else if (value === 'Danificado') {
                badgeClass = 'bg-danger';
                valueText = 'Danificado';
            } else if (value === 'N/A') {
                badgeClass = 'bg-secondary';
                 valueText = 'N/A';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${Utils.sanitizeString(item.label)}</td>
                <td class="text-end"><span class="badge ${badgeClass}">${valueText}</span></td>
            `;
            tableBody.appendChild(row);
        });
    }

   /**
    * Renderiza as miniaturas das fotos na tela de visualização.
    * @param {string} registroId - ID do registro.
    * @param {string} type - 'pre' ou 'pos'.
    * @param {string} containerId - ID do container onde as fotos serão exibidas.
    */
    function renderPhotosForView(registroId, type, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '<p class="text-muted small fst-italic">Carregando fotos...</p>'; // Placeholder

        // Usa a referência PhotoHandler obtida no init
        const photos = PhotoHandler?.getPhotos(registroId, type) || [];

        if (photos.length === 0) {
            container.innerHTML = '<p class="text-muted small fst-italic">Nenhuma foto registrada.</p>';
            return;
        }

        container.innerHTML = ''; // Limpa placeholder
        photos.forEach(photo => {
            if (!photo || !photo.dataUrl) return; // Pula fotos inválidas
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 col-lg-3 mb-2'; // Layout responsivo com margem
            const safeName = Utils?.sanitizeString(photo.name) || 'foto';
            col.innerHTML = `
                <img src="${photo.dataUrl}" class="img-thumbnail photo-thumbnail-view"
                     alt="${safeName}" title="Clique para ampliar: ${safeName}"
                     style="cursor: pointer; width: 100%; height: 100px; object-fit: cover;">
            `;
            // Adiciona listener para abrir o modal usando PhotoHandler
            col.querySelector('img')?.addEventListener('click', () => PhotoHandler?.showPhotoModal(photo));
            container.appendChild(col);
        });
    }


  // --- Funções de Navegação e Utilidade ---

  /**
   * Mostra uma tela específica e esconde as outras.
   * @param {string} screenId - O ID da seção (tela) a ser exibida.
   */
  function showScreen(screenId) {
    document.querySelectorAll('.tela-sistema').forEach(tela => {
      tela.style.display = tela.id === screenId ? 'block' : 'none';
    });
     window.scrollTo(0, 0); // Rola a página para o topo ao trocar de tela
     console.log(`Exibindo tela: ${screenId}`);
  }

  /**
   * Navega de volta para a tela de lista de registros.
   */
  function goToList() {
    showScreen('telaListaRegistros');
    // Dispara um evento para App atualizar a lista, se necessário
     if(typeof App !== 'undefined' && App.refreshRegistrosList) {
        console.log("Atualizando lista de registros ao voltar...");
        App.refreshRegistrosList();
     }
  }

  /**
   * Reseta os formulários, limpa fotos temporárias e navega para a lista.
   */
  function resetAndGoToList() {
     console.log("Resetando formulários e voltando para a lista...");
     resetForm(formPre);
     resetForm(formPos);
     // Limpa fotos do ID atual ou 'new'
     PhotoHandler?.clearPhotosForRegistro(currentRegistroId || 'new');
     currentRegistroId = null; // Limpa ID atual
     goToList();
  }

  /**
   * Exibe ou esconde o spinner de loading global.
   * @param {boolean} show - True para mostrar, False para esconder.
   * @param {string} [message='Carregando...'] - Mensagem opcional a ser exibida.
   */
   function showLoadingSpinner(show, message = 'Carregando...') {
       const spinner = document.getElementById('loadingSpinner');
       if (!spinner) return;
       const spinnerMessage = spinner.querySelector('.loading-message'); // Supondo que haja um span/p para msg

       if (show) {
           if (spinnerMessage) spinnerMessage.textContent = message;
           spinner.style.display = 'flex';
       } else {
           spinner.style.display = 'none';
       }
   }

   /**
    * Função utilitária para notificações.
    * @param {'success'|'error'|'warning'|'info'} type - Tipo da notificação.
    * @param {string} message - Mensagem a ser exibida.
    */
   function notify(type, message) {
      // Usa a função global melhorada por main.js se existir
      const showNotificationFunc = window[`show${type.charAt(0).toUpperCase() + type.slice(1)}Message`] || window.showNotification;
      if (showNotificationFunc) {
         showNotificationFunc(message);
      } else {
         console.log(`[${type.toUpperCase()}] FormHandler: ${message}`); // Fallback
         if (type === 'error' || type === 'warning') alert(message);
      }
   }


  // --- Exportação do Módulo ---

  // Retorna as funções públicas que precisam ser acessadas de fora (principalmente pelo App.js)
  return {
    init,
    newRegistro,
    loadRegistro,
    viewRegistro
    // As funções de handle (submit, edit click) são internas e chamadas por listeners
    // As funções auxiliares (populate, collect, fill, validate, etc.) também são internas
  };
});
