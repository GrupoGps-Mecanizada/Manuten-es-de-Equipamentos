/**
 * Manipulador de Fotos para o Sistema de Manutenção (Módulo)
 * Gerencia upload, armazenamento e visualização de imagens
 * Versão 1.1 (Adaptado para ModuleLoader)
 */
ModuleLoader.register('photoHandler', function() {
  // Configurações - Pode pegar do CONFIG global se preferir
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const THUMBNAIL_SIZE = 200; // Pixels para miniatura (não usado diretamente neste código, mas pode ser útil)

  // Estado interno do módulo
  let memoryStorage = {
    pre: {},  // Fotos "pré" manutenção { registroId: [imageObj, ...] }
    pos: {}   // Fotos "pós" manutenção { registroId: [imageObj, ...] }
  };

  let currentUploads = {
    total: 0,
    completed: 0,
    failed: 0
  };

  // Referências a elementos DOM (se aplicável e gerenciado aqui)
  // Ex: let cameraModal;

  /**
   * Inicializar módulo
   */
  function init() {
    console.log('Inicializando módulo PhotoHandler...');

    // Verificar dependências (Utils, State, Notifications)
    if (typeof Utils === 'undefined' || !ModuleLoader.get('state') || !ModuleLoader.get('notifications')) {
       console.error("PhotoHandler: Dependências (Utils, State, Notifications) não carregadas!");
       return;
    }

    // Verificar suporte a FileReader
    if (!window.FileReader) {
      console.warn('FileReader não é suportado neste navegador. Funcionalidade de fotos limitada.');
      notify('warning', 'Seu navegador não suporta upload de imagens. Algumas funcionalidades estarão limitadas.');
    }

    // Configurar listeners para campos de arquivo (se gerenciados centralmente aqui)
    // OBS: A lógica atual estava em setupDynamicFileInputListeners, que pode ser movida para FormHandler ou App se fizer mais sentido
    // setupDynamicFileInputListeners();

    console.log('PhotoHandler inicializado com sucesso.');
  }

  /**
   * Notificar usuário (usando módulo Notifications)
   */
  function notify(type, message) {
      const Notifications = ModuleLoader.get('notifications');
      if (Notifications && Notifications[type]) {
          Notifications[type](message);
      } else {
          console.log(`[${type.toUpperCase()}] PhotoHandler: ${message}`);
          if (type === 'error') alert(message);
      }
  }


  /**
   * Inicializa a interface do PhotoHandler para um container específico.
   * Esta função cria os botões e a área de preview dinamicamente.
   * @param {string} containerElementId - O ID do elemento HTML onde o PhotoHandler será inserido.
   * @param {string} type - O tipo de foto ('pre' ou 'pos').
   * @param {string} registroId - O ID do registro associado.
   */
  function initContainerUI(containerElementId, type, registroId) {
    const container = document.getElementById(containerElementId);
    if (!container) {
      console.error(`PhotoHandler UI: Container #${containerElementId} não encontrado.`);
      return;
    }

    // Limpar container antes de adicionar
    container.innerHTML = '';

    // ID único para elementos internos
    const uniqueId = `${type}-${registroId || 'new'}`; // Usa 'new' para registros não salvos

    // Criar estrutura HTML
    const photoSection = document.createElement('div');
    photoSection.className = 'photo-handler-instance mb-3';
    photoSection.innerHTML = `
      <div class="d-flex mb-2 gap-2">
        <button type="button" class="btn btn-primary btn-sm btn-capture-photo">
          <i class="bi bi-camera-fill me-1"></i> Capturar
        </button>
        <label class="btn btn-secondary btn-sm btn-select-photo" for="file-input-${uniqueId}">
           <i class="bi bi-image me-1"></i> Da Galeria
        </label>
        <input type="file" id="file-input-${uniqueId}" class="d-none maintenance-photo" accept="image/*" multiple>
      </div>
      <div id="preview-container-${uniqueId}" class="photos-preview row g-2 mt-2 border rounded p-2" style="min-height: 100px;">
         <div class="placeholder-text text-center text-muted p-3">Nenhuma foto adicionada</div>
         </div>
      <div class="progress mt-2" id="progress-container-${uniqueId}" style="height: 5px; display: none;">
        <div class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <div class="progress-text small text-muted mt-1" id="progress-text-${uniqueId}"></div>
    `;

    container.appendChild(photoSection);

    // Adicionar Event Listeners
    const captureBtn = photoSection.querySelector('.btn-capture-photo');
    const fileInput = photoSection.querySelector(`#file-input-${uniqueId}`);

    if (captureBtn) {
      captureBtn.addEventListener('click', () => {
        // Implementar lógica de abrir câmera aqui (pode precisar de um modal)
        notify('info', 'Funcionalidade de câmera ainda não implementada neste módulo.');
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (event) => handleFileInputChange(event.target, type, registroId));

      // Associar o registroId ao input para fácil acesso no handler
      fileInput.setAttribute('data-registro-id', registroId);
    }

    // Carregar fotos existentes para este container
    loadSavedPhotosUI(registroId, type);
  }


  /**
   * Processa alteração em campo de arquivo
   * @param {HTMLInputElement} input - Campo de arquivo alterado
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {string} registroId - ID do registro relacionado (pode ser 'temp' ou um ID real)
   */
  function handleFileInputChange(input, type, registroId) {
    if (!input || !input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const previewContainerId = `preview-container-${type}-${registroId || 'new'}`;
    const previewContainer = document.getElementById(previewContainerId);

    if (!previewContainer) {
       console.error(`Container de preview ${previewContainerId} não encontrado para o input ${input.id}`);
       return;
    }

    // Resetar contadores para novo conjunto de uploads (pode ser por container)
    resetUploadCounters(files.length); // Ajustar para ser por container se necessário

    // Remover placeholder se for a primeira foto
    const placeholder = previewContainer.querySelector('.placeholder-text');
    if(placeholder && files.length > 0) placeholder.style.display = 'none';

    // Processar cada arquivo
    files.forEach(file => processFile(file, type, registroId, previewContainer));

    // Limpar o valor do input para permitir selecionar o mesmo arquivo novamente
    input.value = '';
  }

  /**
   * Reseta contadores de upload
   * @param {number} totalFiles - Total de arquivos a processar
   */
  function resetUploadCounters(totalFiles) {
    currentUploads = {
      total: totalFiles,
      completed: 0,
      failed: 0
    };
    // Atualizar UI de progresso se existir (precisa saber qual container atualizar)
    // updateProgressUI(containerId);
  }

  /**
   * Atualiza interface de progresso de upload (precisa ser adaptado por container)
   */
  function updateProgressUI(containerId = null) {
     // TODO: Adaptar para atualizar a barra de progresso do container específico
     // Ex: const progressBar = document.getElementById(`progress-container-${containerId} .progress-bar`);
     // Ex: const progressText = document.getElementById(`progress-text-${containerId}`);

    // Lógica geral (pode ser movida para dentro do loop de processamento de arquivos)
    if (currentUploads.total > 0) {
       const percentage = Math.round(((currentUploads.completed + currentUploads.failed) / currentUploads.total) * 100);
       // Atualizar barra e texto
    }

    // Mostrar notificação ao finalizar todos os uploads
    if (currentUploads.completed + currentUploads.failed === currentUploads.total && currentUploads.total > 0) {
      if (currentUploads.failed > 0) {
        notify('warning', `Upload concluído com ${currentUploads.failed} erro(s).`);
      } else {
        notify('success', `${currentUploads.completed} foto(s) carregada(s) com sucesso!`);
      }
      // Esconder barra de progresso após um tempo
      // setTimeout(() => hideProgressUI(containerId), 2000);
    }
  }

  /**
   * Processa um arquivo de imagem
   * @param {File} file - Arquivo a ser processado
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {string} registroId - ID do registro relacionado
   * @param {HTMLElement} previewContainer - Container para preview
   */
  function processFile(file, type, registroId, previewContainer) {
    // Validar arquivo
    if (!validateFile(file)) {
      currentUploads.failed++;
      updateProgressUI(); // Atualiza progresso geral
      return;
    }

    // Gerar ID para imagem (usando Utils)
    const imageId = Utils.gerarId ? Utils.gerarId() : `img_${Date.now()}_${Math.random().toString(16).slice(2)}`;


    // Mostrar loading no preview (ou na barra de progresso)
    // addImagePreview( { id: imageId, name: file.name, isLoading: true }, type, previewContainer);

    // Ler e processar arquivo localmente
    processLocalFile(file, imageId, type, registroId, previewContainer);
  }

  /**
   * Valida arquivo de imagem
   * @param {File} file - Arquivo a validar
   * @returns {boolean} Se o arquivo é válido
   */
  function validateFile(file) {
    // Verificar tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      notify('error', `Tipo de arquivo não permitido: ${file.type}`);
      return false;
    }

    // Verificar tamanho
    if (file.size > MAX_FILE_SIZE) {
       const maxSizeFormatted = Utils.formatFileSize ? Utils.formatFileSize(MAX_FILE_SIZE) : `${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)} MB`;
       notify('error', `Arquivo muito grande (máximo: ${maxSizeFormatted}): ${file.name}`);
      return false;
    }

    return true;
  }

  /**
   * Processa arquivo localmente (sem upload para servidor)
   * @param {File} file - Arquivo a processar
   * @param {string} imageId - ID da imagem
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {string} registroId - ID do registro relacionado
   * @param {HTMLElement} previewContainer - Container para preview
   */
  function processLocalFile(file, imageId, type, registroId, previewContainer) {
    const reader = new FileReader();

    reader.onload = function(e) {
      // Criar objeto de imagem com metadados
      const imageObj = {
        id: imageId,
        registroId: registroId, // Associar ao registro
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: e.target.result, // Guardar a imagem como Data URL
        timestamp: new Date().toISOString()
      };

      // Armazenar na memória interna do módulo
      if (!memoryStorage[type][registroId]) {
        memoryStorage[type][registroId] = [];
      }
      // Evitar duplicatas pelo ID (embora ID seja gerado, segurança extra)
      if (!memoryStorage[type][registroId].some(img => img.id === imageId)) {
         memoryStorage[type][registroId].push(imageObj);
      }


      // Adicionar ao AppState para persistência entre telas/sessões (se necessário)
      updateAppState(type, registroId, imageObj);

      // Gerar preview se container existir
      if (previewContainer) {
         // Remover preview de loading se existir
         // const loadingPreview = previewContainer.querySelector(`[data-image-id="${imageId}"].loading`);
         // if(loadingPreview) loadingPreview.remove();

        addImagePreview(imageObj, type, previewContainer);
      }

      // Atualizar contadores
      currentUploads.completed++;
      updateProgressUI(); // Atualiza progresso geral
    };

    reader.onerror = function() {
      console.error('Erro ao ler arquivo:', file.name);
       notify('error', `Erro ao ler o arquivo: ${file.name}`);
      currentUploads.failed++;
      updateProgressUI(); // Atualiza progresso geral

       // Remover preview de loading se existir
       // const loadingPreview = previewContainer.querySelector(`[data-image-id="${imageId}"].loading`);
       // if(loadingPreview) loadingPreview.remove();
    };

    // Ler arquivo como Data URL
    reader.readAsDataURL(file);
  }

  /**
   * Atualiza o AppState com a nova imagem (adiciona ou atualiza)
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {string} registroId - ID do registro
   * @param {Object} imageObj - Objeto da imagem
   */
  function updateAppState(type, registroId, imageObj) {
    const AppState = ModuleLoader.get('state');
    if (!AppState) return;

    const stateKey = `photos_${type}_${registroId}`;
    const currentPhotos = AppState.get(stateKey) || [];

    // Verificar se a foto já existe no estado para evitar duplicatas
    const existingIndex = currentPhotos.findIndex(p => p.id === imageObj.id);
    let updatedPhotos;

    if (existingIndex > -1) {
      // Atualiza a foto existente (caso haja alguma mudança, improvável aqui)
      updatedPhotos = [...currentPhotos];
      updatedPhotos[existingIndex] = imageObj;
    } else {
      // Adiciona nova foto
      updatedPhotos = [...currentPhotos, imageObj];
    }

    // Atualizar estado
    AppState.update(stateKey, updatedPhotos);
  }

  /**
   * Adiciona preview de imagem ao container
   * @param {Object} imageObj - Objeto da imagem
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {HTMLElement} container - Container para preview
   */
  function addImagePreview(imageObj, type, container) {
    // Evitar adicionar preview duplicado
    if (container.querySelector(`[data-image-id="${imageObj.id}"]`)) {
       return;
    }

    // Criar coluna para o card
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3 photo-preview-item'; // Classe para fácil seleção
    col.setAttribute('data-image-id', imageObj.id);

     // Sanitize name para evitar XSS
     const safeName = Utils.sanitizeString ? Utils.sanitizeString(imageObj.name) : imageObj.name;
     const fileSizeFormatted = Utils.formatFileSize ? Utils.formatFileSize(imageObj.size) : `${imageObj.size} bytes`;

    // Criar card de imagem
    col.innerHTML = `
      <div class="card h-100 shadow-sm">
        <div class="position-relative">
          <img src="${imageObj.dataUrl}" class="card-img-top photo-preview-img" alt="${safeName}" style="height: 120px; object-fit: cover; cursor: pointer;" title="Clique para ampliar">
          <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-photo"
                  data-image-id="${imageObj.id}" data-type="${type}" data-registro-id="${imageObj.registroId}" title="Remover Foto">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="card-body p-2">
          <p class="card-text small text-truncate" title="${safeName}">${safeName}</p>
          <p class="card-text small text-muted">${fileSizeFormatted}</p>
        </div>
      </div>
    `;

    // Adicionar ao container
    container.appendChild(col);

    // Adicionar listener para botão de remover
    const removeBtn = col.querySelector('.remove-photo');
    if (removeBtn) {
      removeBtn.addEventListener('click', function(event) {
         event.stopPropagation(); // Impede que o clique no botão acione o clique na imagem
        const imgId = this.getAttribute('data-image-id');
        const imgType = this.getAttribute('data-type');
        const regId = this.getAttribute('data-registro-id');
        removeImage(imgId, imgType, regId);
        col.remove(); // Remove o elemento do preview

         // Mostrar placeholder se não houver mais fotos
         if(container.querySelectorAll('.photo-preview-item').length === 0) {
            const placeholder = container.querySelector('.placeholder-text');
            if(placeholder) placeholder.style.display = 'block';
         }
      });
    }

     // Adicionar listener para ampliar imagem
     const imgElement = col.querySelector('.photo-preview-img');
     if (imgElement) {
        imgElement.addEventListener('click', () => {
           showPhotoModal(imageObj); // Reutiliza a função de modal global
        });
     }
  }

   /**
    * Exibir foto em modal ampliado (Reutilizando função do PhotoHandler global anterior)
    * @param {Object} photoData - Dados da foto
    */
   function showPhotoModal(photoData) {
     if (!photoData || !photoData.dataUrl) return;
     if (typeof bootstrap === 'undefined' || typeof bootstrap.Modal === 'undefined') {
        console.error("Bootstrap Modal não está disponível.");
        // Fallback: abrir imagem em nova aba
        window.open(photoData.dataUrl, '_blank');
        return;
     }

     const modalId = 'photo-viewer-modal-module'; // ID único para este modal
     let modalElement = document.getElementById(modalId);

     // Criar modal se não existir
     if (!modalElement) {
       modalElement = document.createElement('div');
       modalElement.className = 'modal fade';
       modalElement.id = modalId;
       modalElement.setAttribute('tabindex', '-1');
       modalElement.setAttribute('aria-labelledby', `${modalId}-title`);
       modalElement.setAttribute('aria-hidden', 'true');
       modalElement.innerHTML = `
         <div class="modal-dialog modal-dialog-centered modal-xl">
           <div class="modal-content">
             <div class="modal-header">
               <h5 class="modal-title" id="${modalId}-title">Visualizar Foto</h5>
               <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
             </div>
             <div class="modal-body text-center p-0">
               <img id="${modalId}-photo" src="" alt="Foto Ampliada" style="max-width: 100%; max-height: 80vh; object-fit: contain;">
             </div>
             <div class="modal-footer justify-content-between">
               <div class="photo-info small text-muted">
                  <span id="${modalId}-details"></span>
               </div>
               <div>
                 <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                 <a id="${modalId}-download" href="#" download="foto.jpg" class="btn btn-primary">
                   <i class="bi bi-download"></i> Download
                 </a>
               </div>
             </div>
           </div>
         </div>
       `;
       document.body.appendChild(modalElement);
     }

     // Atualizar conteúdo do modal
     const modalImg = document.getElementById(`${modalId}-photo`);
     const photoDetails = document.getElementById(`${modalId}-details`);
     const downloadBtn = document.getElementById(`${modalId}-download`);

     if (modalImg) modalImg.src = photoData.dataUrl;

     if (photoDetails) {
       const dateStr = photoData.timestamp ? new Date(photoData.timestamp).toLocaleString('pt-BR') : 'Data indisponível';
       const sizeStr = Utils.formatFileSize ? Utils.formatFileSize(photoData.size) : `${photoData.size} bytes`;
       const nameStr = Utils.sanitizeString ? Utils.sanitizeString(photoData.name) : photoData.name;
       photoDetails.innerHTML = `
          <strong>Arquivo:</strong> ${nameStr} <br>
          <strong>Tamanho:</strong> ${sizeStr} | <strong>Data:</strong> ${dateStr}
       `;
     }

     if (downloadBtn) {
       downloadBtn.href = photoData.dataUrl;
       downloadBtn.download = photoData.name || `foto_${photoData.id}.jpg`;
     }

     // Mostrar modal usando API do Bootstrap
     const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
     modalInstance.show();
   }


  /**
   * Remove uma imagem do estado interno e do AppState
   * @param {string} imageId - ID da imagem
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {string} registroId - ID do registro
   */
  function removeImage(imageId, type, registroId) {
    // Remover da memória interna
    if (memoryStorage[type] && memoryStorage[type][registroId]) {
      memoryStorage[type][registroId] = memoryStorage[type][registroId].filter(img => img.id !== imageId);
      if (memoryStorage[type][registroId].length === 0) {
        delete memoryStorage[type][registroId]; // Limpa se não houver mais fotos
      }
    }

    // Remover do AppState
    const AppState = ModuleLoader.get('state');
    if (AppState) {
      const stateKey = `photos_${type}_${registroId}`;
      const currentPhotos = AppState.get(stateKey) || [];
      const updatedPhotos = currentPhotos.filter(img => img.id !== imageId);
      // Atualiza mesmo que vazio para refletir a remoção no estado
      AppState.update(stateKey, updatedPhotos);
    }

    notify('info', 'Foto removida.');
  }

  /**
   * Obtém todas as fotos de um registro (do AppState ou memória interna)
   * @param {string} registroId - ID do registro
   * @param {string} type - Tipo de foto (pre ou pos)
   * @returns {Array} Lista de objetos de imagem
   */
  function getPhotos(registroId, type = 'pre') {
    // Tentar obter do AppState primeiro
    const AppState = ModuleLoader.get('state');
    if (AppState) {
      const stateKey = `photos_${type}_${registroId}`;
      const statePhotos = AppState.get(stateKey);
      // Retorna se for um array (mesmo que vazio), senão tenta memória
      if (Array.isArray(statePhotos)) {
        return statePhotos;
      }
    }

    // Fallback para armazenamento em memória interno do módulo
    return (memoryStorage[type] && memoryStorage[type][registroId]) ? memoryStorage[type][registroId] : [];
  }

  /**
   * Carrega fotos salvas (ex: ao editar um registro) e atualiza a UI
   * @param {string} registroId - ID do registro
   * @param {string} type - Tipo de foto (pre ou pos)
   */
   function loadSavedPhotosUI(registroId, type) {
      const photos = getPhotos(registroId, type); // Busca do state/memória
      const previewContainerId = `preview-container-${type}-${registroId || 'new'}`;
      const previewContainer = document.getElementById(previewContainerId);

      if (!previewContainer) return;

      // Limpar container antes de adicionar os previews
      previewContainer.innerHTML = ''; // Limpa tudo, incluindo placeholder

      if (photos.length === 0) {
          // Se não há fotos, mostra o placeholder
          previewContainer.innerHTML = `<div class="placeholder-text text-center text-muted p-3">Nenhuma foto adicionada</div>`;
      } else {
          // Adicionar previews das fotos carregadas
          photos.forEach(photo => {
              addImagePreview(photo, type, previewContainer);
          });
      }
  }


  /**
   * Prepara dados de fotos para envio (ex: para API ou armazenamento final)
   * Retorna apenas metadados, sem o dataUrl completo para economizar dados.
   * @param {string} registroId - ID do registro
   * @param {string} type - Tipo de foto ('pre' ou 'pos')
   * @returns {Array} Lista de metadados das fotos
   */
  function preparePhotosForSubmission(registroId, type) {
    const photos = getPhotos(registroId, type);

    return photos.map(photo => {
      // Criar cópia sem a dataUrl completa
      const { dataUrl, ...photoData } = photo;
      return {
        ...photoData,
        // Incluir apenas metadados relevantes para o backend/armazenamento
        // O backend pode precisar solicitar o dataUrl completo depois se necessário
        // ou pode já ter sido feito upload em outro passo.
      };
    });
  }

  /**
   * Limpa fotos de um registro específico da memória e do AppState
   * @param {string} registroId - ID do registro
   */
  function clearPhotosForRegistro(registroId) {
    const types = ['pre', 'pos'];
    const AppState = ModuleLoader.get('state');

    types.forEach(type => {
      // Limpar memória interna
      if (memoryStorage[type] && memoryStorage[type][registroId]) {
        delete memoryStorage[type][registroId];
      }
      // Limpar AppState
      if (AppState) {
        AppState.update(`photos_${type}_${registroId}`, []); // Define como array vazio
      }
    });
    console.log(`Fotos limpas para o registro ${registroId}`);
  }

  /**
   * Obtém URL de visualização para uma foto específica
   * @param {string} imageId - ID da imagem
   * @param {string} registroId - ID do registro
   * @param {string} type - Tipo de foto (pre ou pos)
   * @returns {string|null} URL da imagem (dataUrl) ou null se não encontrada
   */
  function getPhotoUrl(imageId, registroId, type = 'pre') {
    const photos = getPhotos(registroId, type);
    const photo = photos.find(p => p.id === imageId);
    return photo ? photo.dataUrl : null;
  }

  // Exportar funções públicas do módulo
  return {
    init,
    initContainerUI,
    getPhotos,
    loadSavedPhotosUI,
    preparePhotosForSubmission,
    clearPhotosForRegistro,
    getPhotoUrl,
    showPhotoModal // <-- ADICIONADO AQUI PARA SER ACESSÍVEL externamente
  };
})
