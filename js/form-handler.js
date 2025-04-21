/**
 * Manipulador de Formulários do Sistema de Manutenção
 * Gerencia a coleta, validação e submissão dos dados dos formulários.
 */
ModuleLoader.register('formHandler', function() {

  // Referências aos elementos do formulário (podem ser obtidas no init ou em funções específicas)
  let formPre, formPos;
  let currentRegistroId = null;

  // Dependências
  let ApiClient, PhotoHandler, AppState, Utils, Security;

  function init() {
    console.log('Inicializando FormHandler...');

    // Obter dependências
    ApiClient = ModuleLoader.get('apiClient');
    PhotoHandler = ModuleLoader.get('photoHandler'); // Obtém o módulo de fotos
    AppState = ModuleLoader.get('state');
    Utils = window.Utils; // Assume Utils global
    Security = ModuleLoader.get('security');

    if (!ApiClient || !PhotoHandler || !AppState || !Utils || !Security) {
      console.error("FormHandler: Dependências não carregadas!");
      return;
    }

    // Mapear elementos dos formulários
    mapFormElements();

    // Configurar listeners dos formulários
    setupFormListeners();

    // Preencher selects dinâmicos
    populateSelects();

     // Inicializar componentes do PhotoHandler nos formulários
     if (document.getElementById('photo-container-pre')) {
        PhotoHandler.initContainerUI('photo-container-pre', 'pre', null); // null para novo registro inicialmente
     }
     if (document.getElementById('photo-container-pos')) {
        PhotoHandler.initContainerUI('photo-container-pos', 'pos', null);
     }

    console.log('FormHandler inicializado.');
  }

  function mapFormElements() {
    formPre = document.getElementById('formPreManutencao');
    formPos = document.getElementById('formPosManutencao');
    // Mapear outros campos...
  }

  function setupFormListeners() {
    if (formPre) {
      formPre.addEventListener('submit', handlePreSubmit);
      // Listeners para botões de cancelar, etc.
      document.getElementById('btnCancelarPre')?.addEventListener('click', resetAndGoToList);
    }
    if (formPos) {
      formPos.addEventListener('submit', handlePosSubmit);
      // Listeners para botões de voltar, etc.
      document.getElementById('btnVoltarPre')?.addEventListener('click', () => showScreen('telaPreManutencao'));

    }
     // Listener para edição na tela de visualização
     document.getElementById('btnEditarVisualizacao')?.addEventListener('click', handleEditClick);
  }


  // --- Funções de Manipulação de Formulário ---

  /**
   * Limpa e prepara o formulário para um novo registro.
   */
  function newRegistro() {
    currentRegistroId = null; // Indica novo registro
    resetForm(formPre);
    resetForm(formPos); // Garante que o form Pós esteja limpo também
    PhotoHandler.clearPhotosForRegistro('new'); // Limpa fotos temporárias
    PhotoHandler.initContainerUI('photo-container-pre', 'pre', 'new'); // Re-inicializa UI de fotos para novo registro
    PhotoHandler.initContainerUI('photo-container-pos', 'pos', 'new');
    // Preencher data/hora, responsável padrão, etc., se aplicável
    showScreen('telaPreManutencao');
    document.getElementById('registroIdDisplay').textContent = 'Novo Registro';
  }

  /**
   * Carrega dados de um registro existente no formulário para edição.
   * @param {string} registroId
   */
  async function loadRegistro(registroId) {
     console.log(`Carregando registro ${registroId} para edição...`);
     currentRegistroId = registroId; // Define o ID atual
     try {
        // TODO: Implementar busca do registro (API ou Cache)
        // const registro = await ApiClient.obterRegistro(registroId);
        const registro = await getRegistroData(registroId); // Função auxiliar para buscar dados
        if (!registro) {
           notify('error', `Registro ${registroId} não encontrado.`);
           goToList();
           return;
        }

        // Preencher formulário PRÉ
        fillForm(formPre, registro);
        // Inicializar/Carregar fotos PRÉ
        PhotoHandler.initContainerUI('photo-container-pre', 'pre', registroId);
        // PhotoHandler.loadSavedPhotosUI(registroId, 'pre'); // loadSavedPhotosUI já é chamado por initContainerUI se fotos existirem no state

        // Preencher formulário PÓS (se já houver dados)
        fillForm(formPos, registro); // Preenche o que existir
         // Inicializar/Carregar fotos PÓS
        PhotoHandler.initContainerUI('photo-container-pos', 'pos', registroId);
        // PhotoHandler.loadSavedPhotosUI(registroId, 'pos');

        // Atualizar displays de ID
        document.getElementById('registroIdDisplay').textContent = `ID: ${registroId}`;
         document.getElementById('registroIdPosDisplay').textContent = `ID: ${registroId}`;
         // Atualizar resumo na tela PÓS
         updatePosSummary(registro);


        showScreen('telaPreManutencao'); // Começa pela tela PRÉ

     } catch (error) {
        console.error(`Erro ao carregar registro ${registroId}:`, error);
        notify('error', 'Erro ao carregar dados do registro para edição.');
        goToList();
     }
  }

   /**
    * Exibe um registro existente (sem edição).
    * @param {string} registroId
    */
   async function viewRegistro(registroId) {
       console.log(`Visualizando registro ${registroId}...`);
       currentRegistroId = registroId; // Define ID para possível edição
       try {
           // const registro = await ApiClient.obterRegistro(registroId);
           const registro = await getRegistroData(registroId);
           if (!registro) {
               notify('error', `Registro ${registroId} não encontrado.`);
               goToList();
               return;
           }

           // Preencher campos da tela de visualização
           populateViewScreen(registro);

            // Carregar fotos na visualização (não usa initContainerUI aqui)
           renderPhotosForView(registroId, 'pre', 'fotosPreView');
           renderPhotosForView(registroId, 'pos', 'fotosPosView');


           showScreen('telaVisualizacao');
       } catch (error) {
           console.error(`Erro ao visualizar registro ${registroId}:`, error);
           notify('error', 'Erro ao carregar dados do registro para visualização.');
           goToList();
       }
   }

   /**
    * Busca dados do registro (do Cache/State ou API)
    */
   async function getRegistroData(registroId) {
      const AppState = ModuleLoader.get('state');
      // Tenta do state primeiro
      let registro = (AppState?.get('registros') || []).find(r => r.id === registroId);
      if (registro) return registro;

      // Tenta da API
      const ApiClient = ModuleLoader.get('apiClient');
      if(ApiClient) {
         const result = await ApiClient.obterRegistro(registroId); // obterRegistro já tenta cache
         return result; // Retorna o registro encontrado ou lança erro
      }
      return null; // Se não achou e não tem API
   }


  /**
   * Manipula o envio do formulário PRÉ-manutenção.
   * @param {Event} event
   */
  async function handlePreSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!validateForm(formPre)) {
      notify('warning', 'Por favor, corrija os erros no formulário.');
      return;
    }

    // Coletar dados do formulário PRÉ
    const dadosPre = collectFormData(formPre);
    dadosPre.id = currentRegistroId || Utils.gerarId(); // Gera novo ID se não existir
    dadosPre.dataCriacao = currentRegistroId ? dadosPre.dataCriacao : new Date().toISOString(); // Data de criação apenas para novos

    // Obter metadados das fotos PRÉ (sem dataUrl completo)
    // const fotosPreMeta = PhotoHandler.preparePhotosForSubmission(dadosPre.id, 'pre');
    // TODO: Decidir como e quando enviar fotos (metadados vs dataUrls)

     // Salvar parcialmente ou apenas avançar
     console.log('Dados PRÉ coletados:', dadosPre);
     currentRegistroId = dadosPre.id; // Garante que temos um ID

     // Atualizar estado com dados parciais (ou salvar na API se desejado)
     updateAppStateRegistro(dadosPre);


     // Atualizar ID na tela PÓS e o resumo
     document.getElementById('registroIdPos').value = currentRegistroId;
     document.getElementById('registroIdPosDisplay').textContent = `ID: ${currentRegistroId}`;
     updatePosSummary(dadosPre);

     // Re-inicializa/Carrega fotos para PÓS com o ID correto
     PhotoHandler.initContainerUI('photo-container-pos', 'pos', currentRegistroId);


     notify('info', 'Dados iniciais salvos. Prossiga para a etapa PÓS-manutenção.');
    showScreen('telaPosManutencao');
  }

  /**
   * Manipula o envio do formulário PÓS-manutenção.
   * @param {Event} event
   */
  async function handlePosSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!validateForm(formPos)) {
      notify('warning', 'Por favor, corrija os erros no formulário.');
      return;
    }

     if (!currentRegistroId) {
        notify('error', 'Erro: ID do registro não encontrado para finalizar.');
        return;
     }

    // Coletar dados do formulário PÓS
    const dadosPos = collectFormData(formPos);

     // Obter dados PRÉ do estado para combinar
     const AppState = ModuleLoader.get('state');
     const registroCompleto = (AppState?.get('registros') || []).find(r => r.id === currentRegistroId);

     if (!registroCompleto) {
        notify('error', 'Erro: Dados PRÉ não encontrados para finalizar o registro.');
        return;
     }

     // Combinar dados PRÉ e PÓS
     Object.assign(registroCompleto, dadosPos);
     registroCompleto.dataFinalizacao = new Date().toISOString(); // Marca data de finalização

    // Obter metadados das fotos PRÉ e PÓS
     // Usar getPhotos que retorna os objetos completos com dataUrl por enquanto
     registroCompleto.fotosPre = PhotoHandler.getPhotos(currentRegistroId, 'pre');
     registroCompleto.fotosPos = PhotoHandler.getPhotos(currentRegistroId, 'pos');

    console.log('Registro completo para envio:', registroCompleto);

    try {
        // Enviar para API
        notify('info', 'Salvando registro completo...');
        const resultado = await ApiClient.salvarRegistro(registroCompleto); // Envia tudo

        if (resultado && resultado.success) {
            notify('success', 'Registro de manutenção salvo com sucesso!');
             // Atualizar estado local com dados da API (pode ter ID gerado pelo backend)
             updateAppStateRegistro(resultado.registro || registroCompleto); // Usa o retornado pela API se houver
             PhotoHandler.clearPhotosForRegistro(currentRegistroId); // Limpa fotos temporárias
            resetAndGoToList();
             // Opcional: Atualizar lista de registros na tela
             if(typeof App !== 'undefined' && App.refreshRegistrosList) {
                App.refreshRegistrosList();
             }
        } else {
            throw new Error(resultado?.message || 'Falha ao salvar na API.');
        }
    } catch (error) {
        console.error('Erro ao salvar registro final:', error);
        notify('error', `Erro ao salvar: ${error.message}. Verifique sua conexão ou tente novamente.`);
         // Manter dados no estado para tentativa posterior (se API falhar)
         updateAppStateRegistro(registroCompleto); // Mantém dados combinados no estado
    }
  }

   /**
    * Manipula o clique no botão Editar na tela de visualização.
    */
   function handleEditClick() {
      if(currentRegistroId) {
         loadRegistro(currentRegistroId); // Carrega para edição
      } else {
         notify('error', 'ID do registro não encontrado para edição.');
         goToList();
      }
   }

  // --- Funções Auxiliares ---

   /**
    * Atualiza o registro no estado global (AppState).
    * @param {Object} registro - O objeto do registro a ser adicionado ou atualizado.
    */
   function updateAppStateRegistro(registro) {
      const AppState = ModuleLoader.get('state');
      if (!AppState || !registro || !registro.id) return;

      const registrosAtuais = AppState.get('registros') || [];
      const index = registrosAtuais.findIndex(r => r.id === registro.id);

      let novosRegistros;
      if (index > -1) {
         // Atualiza
         novosRegistros = [...registrosAtuais];
         novosRegistros[index] = { ...registrosAtuais[index], ...registro }; // Mescla para manter dados anteriores
      } else {
         // Adiciona
         novosRegistros = [...registrosAtuais, registro];
      }
      AppState.update('registros', novosRegistros);
   }


  function populateSelects() {
    const catSelect = document.getElementById('categoriaProblema');
    const urgSelect = document.getElementById('urgencia');

    if (catSelect && CONFIG.CATEGORIAS_PROBLEMA) {
      CONFIG.CATEGORIAS_PROBLEMA.forEach(cat => {
        const option = new Option(cat, cat);
        catSelect.add(option);
      });
    }
     if (urgSelect && CONFIG.NIVEIS_URGENCIA) {
       CONFIG.NIVEIS_URGENCIA.forEach(urg => {
         const option = new Option(urg, urg);
         urgSelect.add(option);
       });
     }
  }

   function populateChecklists() {
       const checklistPreContainer = document.getElementById('checklistPreContainer');
       const checklistPosContainer = document.getElementById('checklistPosContainer');
       const items = CONFIG.CHECKLIST_ITEMS || [];

       if (checklistPreContainer) populateChecklistContainer(checklistPreContainer, items, 'Pre');
       if (checklistPosContainer) populateChecklistContainer(checklistPosContainer, items, 'Pos');
   }

   function populateChecklistContainer(container, items, suffix) {
      container.innerHTML = ''; // Limpa placeholder
      items.forEach(item => {
          const col = document.createElement('div');
          col.className = 'col-md-4 col-sm-6 mb-2'; // Layout responsivo
          const uniqueName = `${item.id}${suffix}`;
          col.innerHTML = `
              <label class="form-label d-block">${item.label}</label>
              <div class="btn-group" role="group" aria-label="Checklist ${item.label}">
                  <input type="radio" class="btn-check" name="${uniqueName}" id="${uniqueName}Ok" value="OK" required>
                  <label class="btn btn-outline-success btn-sm" for="${uniqueName}Ok">OK</label>

                  <input type="radio" class="btn-check" name="${uniqueName}" id="${uniqueName}Danificado" value="Danificado">
                  <label class="btn btn-outline-danger btn-sm" for="${uniqueName}Danificado">Danificado</label>

                  <input type="radio" class="btn-check" name="${uniqueName}" id="${uniqueName}Na" value="N/A">
                  <label class="btn btn-outline-secondary btn-sm" for="${uniqueName}Na">N/A</label>
              </div>
              <div class="invalid-feedback d-block" style="margin-top: -0.5rem;"></div> `;
          container.appendChild(col);
      });
  }


  function collectFormData(form) {
    const data = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
       // Tratar múltiplos valores (checkboxes) - Não aplicável neste form, mas bom ter
       // if (data[key]) {
       //    if (!Array.isArray(data[key])) data[key] = [data[key]];
       //    data[key].push(value);
       // } else {
       //    data[key] = value;
       // }
        data[key] = value;
    }

     // Coletar valores dos radios de checklist manualmente
     (form.querySelectorAll('.btn-check[type="radio"]:checked') || []).forEach(radio => {
         data[radio.name] = radio.value;
     });

     // Coletar textareas
     form.querySelectorAll('textarea').forEach(textarea => {
        data[textarea.id] = textarea.value;
     });
     // Coletar selects
      form.querySelectorAll('select').forEach(select => {
        data[select.id] = select.value;
      });
      // Coletar inputs (alguns podem não ser pegos pelo FormData se desabilitados)
       form.querySelectorAll('input[type="text"], input[type="number"], input[type="hidden"], input[type="email"], input[type="date"]') // etc.
        .forEach(input => {
           if (input.id && !data.hasOwnProperty(input.id)) { // Evita sobrescrever se já pego pelo FormData
               data[input.id] = input.value;
           }
       });

    // Remover IDs que são de botões ou elementos não-dados
    delete data['']; // Remover chave vazia se houver

    console.log("Dados coletados:", data);
    return data;
  }


  function fillForm(form, data) {
    if (!form || !data) return;
    resetForm(form); // Limpa antes de preencher

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const element = form.elements[key];
        if (element) {
          // Tratar Radio buttons
          if (element instanceof NodeList && element.length > 0 && element[0].type === 'radio') {
             element.forEach(radio => {
               if (radio.value === data[key]) {
                 radio.checked = true;
               }
             });
          }
          // Tratar Checkboxes (se houver)
          else if (element.type === 'checkbox') {
            element.checked = !!data[key];
          }
          // Outros tipos de input/select/textarea
          else if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
             // Tratar datas (se o formato for ISO e o input for date)
             if (element.type === 'date' && typeof data[key] === 'string' && data[key].includes('T')) {
                 element.value = data[key].split('T')[0];
             } else {
                 element.value = data[key];
             }
          }
        }
      }
    }
  }

  function resetForm(form) {
    if (form) form.reset();
    // Limpar classes de validação
    form?.classList.remove('was-validated');
    form?.querySelectorAll('.is-invalid, .is-valid').forEach(el => {
      el.classList.remove('is-invalid', 'is-valid');
    });
     // Limpar previews de fotos associados a este formulário (identificar pelos containers)
     // Ex: PhotoHandler.clearPhotosForRegistro(form === formPre ? 'pre' : 'pos', currentRegistroId || 'new');
  }

  function validateForm(form) {
     form.classList.add('was-validated'); // Habilita estilos de validação do Bootstrap

     let isFormValid = form.checkValidity(); // Validação nativa do HTML5

     // Adicionar validação customizada (ex: radios)
     form.querySelectorAll('.btn-group').forEach(group => {
        const radios = group.querySelectorAll('input[type="radio"]');
        if(radios.length > 0 && radios[0].required) {
            const isChecked = Array.from(radios).some(radio => radio.checked);
            const feedback = group.parentNode.querySelector('.invalid-feedback');
            if (!isChecked) {
                isFormValid = false;
                if(feedback) feedback.textContent = 'Selecione uma opção.';
                // Adicionar classe inválida ao grupo ou labels se desejar feedback visual mais forte
            } else {
               if(feedback) feedback.textContent = ''; // Limpa erro
            }
        }
     });

     // Usar módulo Security para validações mais complexas (se data-validate estiver nos inputs)
     if (Security) {
        form.querySelectorAll('[data-validate]').forEach(field => {
           if (!Security.validateField(field)) { // validateField do security atualiza a UI
              isFormValid = false;
           }
        });
     }


     return isFormValid;
  }

   function updatePosSummary(registroData) {
      document.getElementById('placaPos').textContent = registroData.placa || '--';
      document.getElementById('modeloPos').textContent = registroData.modelo || '--';
      document.getElementById('idInternaPos').textContent = registroData.idInterna || '--';
   }

   function populateViewScreen(registro) {
       // IDs da tela de visualização
       document.getElementById('registroIdVisualizar').textContent = `ID: ${registro.id || '--'}`;
       document.getElementById('placaView').textContent = registro.placa || '--';
       document.getElementById('modeloView').textContent = registro.modelo || '--';
       document.getElementById('idInternaView').textContent = registro.idInterna || '--';
       document.getElementById('dataView').textContent = registro.dataCriacao ? Utils.formatarDataHora(registro.dataCriacao) : '--';
       document.getElementById('responsavelView').textContent = registro.responsavel || '--';
       document.getElementById('categoriaView').textContent = registro.categoriaProblema || '--';
       document.getElementById('urgenciaView').textContent = registro.urgencia || '--';
       document.getElementById('descricaoProblemaView').textContent = registro.descricaoProblema || 'Nenhuma descrição fornecida.';

       // Status
       const statusView = document.getElementById('statusView');
       let statusText = 'Pendente';
       let statusClass = 'bg-secondary';
       if (registro.dataFinalizacao) {
           statusText = 'Concluído';
           statusClass = 'bg-success';
       } else if (registro.fotosPre?.length > 0 || registro.quilometragem) { // Ou outra lógica para parcial
           statusText = 'Em Andamento';
           statusClass = 'bg-warning text-dark';
       }
       statusView.textContent = statusText;
       statusView.className = `badge ${statusClass}`;


       // Checklists
       populateChecklistView('checklistPreView', registro, 'Pre');
       populateChecklistView('checklistPosView', registro, 'Pos');

       // Observações
       document.getElementById('observacoesPreView').textContent = registro.observacoesPre || 'Nenhuma.';
       document.getElementById('observacoesPosView').textContent = registro.observacoesPos || 'Nenhuma.';

       // Botão de Edição (passa o ID atual)
       const editBtn = document.getElementById('btnEditarVisualizacao');
       if(editBtn) {
          // Remover listener antigo para evitar duplicação
          editBtn.replaceWith(editBtn.cloneNode(true));
          document.getElementById('btnEditarVisualizacao').addEventListener('click', () => loadRegistro(registro.id));
       }
   }

    function populateChecklistView(containerId, registro, suffix) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = ''; // Limpa
        const items = CONFIG.CHECKLIST_ITEMS || [];

        if (items.length === 0) {
            container.innerHTML = '<tr><td class="text-muted">Checklist não configurado.</td></tr>';
            return;
        }

        items.forEach(item => {
            const key = `${item.id}${suffix}`;
            const value = registro[key];
            let badgeClass = 'bg-secondary';
            let valueText = value || 'N/A';

            if (value === 'OK') {
                badgeClass = 'bg-success';
            } else if (value === 'Danificado') {
                badgeClass = 'bg-danger';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.label}</td>
                <td class="text-end"><span class="badge ${badgeClass}">${valueText}</span></td>
            `;
            container.appendChild(row);
        });
    }

    function renderPhotosForView(registroId, type, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '<p class="text-muted small">Carregando fotos...</p>'; // Placeholder

        const photos = PhotoHandler.getPhotos(registroId, type);

        if (photos.length === 0) {
            container.innerHTML = '<p class="text-muted small">Nenhuma foto registrada.</p>';
            return;
        }

        container.innerHTML = ''; // Limpa placeholder
        photos.forEach(photo => {
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 mb-2'; // Ajuste de layout
            const safeName = Utils.sanitizeString ? Utils.sanitizeString(photo.name) : photo.name;
            col.innerHTML = `
                <img src="${photo.dataUrl}" class="img-thumbnail" alt="${safeName}" style="cursor: pointer; width: 100%; height: 100px; object-fit: cover;" title="Clique para ampliar">
            `;
            col.querySelector('img').addEventListener('click', () => showPhotoModal(photo));
            container.appendChild(col);
        });
    }


  // --- Navegação e Utilidades ---

  function showScreen(screenId) {
    document.querySelectorAll('.tela-sistema').forEach(tela => {
      tela.style.display = tela.id === screenId ? 'block' : 'none';
    });
     window.scrollTo(0, 0); // Rola para o topo
  }

  function goToList() {
    showScreen('telaListaRegistros');
    // Opcional: atualizar a lista aqui
     if(typeof App !== 'undefined' && App.refreshRegistrosList) {
        App.refreshRegistrosList();
     }
  }

  function resetAndGoToList() {
     resetForm(formPre);
     resetForm(formPos);
     PhotoHandler.clearPhotosForRegistro(currentRegistroId || 'new');
     currentRegistroId = null;
     goToList();
  }

  // Chamar populateChecklists quando o módulo inicializar
  // init depende de CONFIG, então chamar após obter dependências
  // Adicionar no final da função init:
  // populateChecklists();


  // Exportar funções públicas
  return {
    init,
    newRegistro,
    loadRegistro,
    viewRegistro,
     // Funções de submit podem ser internas ou expostas se necessário
     // handlePreSubmit,
     // handlePosSubmit
  };
});
