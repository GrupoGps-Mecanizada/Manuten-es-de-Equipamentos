/**
 * Manipulador de Fotos para o Sistema de Manutenção
 * Gerencia upload, armazenamento e visualização de imagens
 * Versão 1.0
 */
ModuleLoader.register('photoHandler', function() {
  // Configurações
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const THUMBNAIL_SIZE = 200; // Pixels para miniatura
  
  // Armazenamento para fotos em memória (quando não estiver usando Google Drive)
  let memoryStorage = {
    pre: {},  // Fotos "pré" manutenção
    pos: {}   // Fotos "pós" manutenção
  };
  
  // Estado de upload
  let currentUploads = {
    total: 0,
    completed: 0,
    failed: 0
  };
  
  /**
   * Inicializar módulo
   */
  function init() {
    console.log('Inicializando módulo PhotoHandler...');
    
    // Verificar suporte a FileReader
    if (!window.FileReader) {
      console.warn('FileReader não é suportado neste navegador. Funcionalidade de fotos limitada.');
      const Notifications = window.Notifications || ModuleLoader.get('notifications');
      if (Notifications) {
        Notifications.warning('Seu navegador não suporta upload de imagens. Algumas funcionalidades estarão limitadas.');
      }
    }
    
    // Configurar listeners para campos de arquivo dinâmicos
    setupDynamicFileInputListeners();
    
    console.log('PhotoHandler inicializado com sucesso.');
  }
  
  /**
   * Configura listeners para campos de arquivo que são adicionados dinamicamente
   */
  function setupDynamicFileInputListeners() {
    // Usar delegação de eventos para capturar campos de arquivo adicionados dinamicamente
    document.addEventListener('change', function(event) {
      const target = event.target;
      
      // Verificar se é um input de arquivo relacionado ao sistema
      if (target.type === 'file' && 
         (target.id.includes('foto') || target.classList.contains('maintenance-photo'))) {
        handleFileInputChange(target);
      }
    });
  }
  
  /**
   * Processa alteração em campo de arquivo
   * @param {HTMLInputElement} input - Campo de arquivo alterado
   */
  function handleFileInputChange(input) {
    if (!input || !input.files || input.files.length === 0) return;
    
    const files = Array.from(input.files);
    const uploadType = input.id.includes('pre') ? 'pre' : 'pos';
    const registroId = input.getAttribute('data-registro-id') || 'temp';
    
    // Resetar contadores para novo conjunto de uploads
    resetUploadCounters(files.length);
    
    // Preview container
    let previewContainer = document.getElementById(`${uploadType}-photos-preview`);
    if (!previewContainer) {
      // Tentar criar container de preview
      previewContainer = createPreviewContainer(uploadType);
      if (!previewContainer) {
        // Se não conseguiu criar, pode não ter os elementos necessários na página atual
        console.warn(`Container de preview para fotos '${uploadType}' não encontrado e não pôde ser criado.`);
      }
    }
    
    // Processar cada arquivo
    files.forEach(file => processFile(file, uploadType, registroId, previewContainer));
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
    
    // Atualizar UI de progresso se existir
    updateProgressUI();
  }
  
  /**
   * Atualiza interface de progresso de upload
   */
  function updateProgressUI() {
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    
    if (progressBar) {
      const percentage = currentUploads.total > 0 
        ? Math.round((currentUploads.completed / currentUploads.total) * 100) 
        : 0;
      
      progressBar.style.width = `${percentage}%`;
      progressBar.setAttribute('aria-valuenow', percentage);
    }
    
    if (progressText) {
      progressText.textContent = `${currentUploads.completed} de ${currentUploads.total} fotos processadas`;
    }
    
    // Mostrar notificação ao finalizar todos os uploads
    if (currentUploads.completed + currentUploads.failed === currentUploads.total && currentUploads.total > 0) {
      const Notifications = window.Notifications || ModuleLoader.get('notifications');
      
      if (currentUploads.failed > 0) {
        if (Notifications) {
          Notifications.warning(`Upload concluído com ${currentUploads.failed} erros.`);
        }
      } else {
        if (Notifications) {
          Notifications.success(`${currentUploads.completed} foto(s) carregada(s) com sucesso!`);
        }
      }
    }
  }
  
  /**
   * Cria container para preview de imagens
   * @param {string} type - Tipo de preview (pre ou pos)
   * @returns {HTMLElement|null} Container criado ou null se não for possível
   */
  function createPreviewContainer(type) {
    // Procurar por um elemento pai adequado
    const possibleParents = [
      document.querySelector(`.${type}-photos-section`),
      document.getElementById(`${type}PhotosContainer`),
      document.querySelector('.photos-container'),
      document.querySelector('.form-photos')
    ];
    
    const parent = possibleParents.find(el => el !== null);
    
    if (!parent) return null;
    
    const container = document.createElement('div');
    container.id = `${type}-photos-preview`;
    container.className = 'photos-preview row g-2 mt-2';
    
    parent.appendChild(container);
    return container;
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
      updateProgressUI();
      return;
    }
    
    // Gerar ID para imagem
    const imageId = Utils.generateUniqueId('img');
    
    // Processar arquivo localmente (sem upload)
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
      showError(`Tipo de arquivo não permitido: ${file.type}`);
      return false;
    }
    
    // Verificar tamanho
    if (file.size > MAX_FILE_SIZE) {
      showError(`Arquivo muito grande (máximo: ${Utils.formatFileSize(MAX_FILE_SIZE)}): ${file.name}`);
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
        registroId: registroId,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: e.target.result,
        timestamp: new Date().toISOString()
      };
      
      // Armazenar na memória
      if (!memoryStorage[type][registroId]) {
        memoryStorage[type][registroId] = [];
      }
      memoryStorage[type][registroId].push(imageObj);
      
      // Adicionar ao AppState para persistência entre telas
      updateAppState(type, registroId, imageObj);
      
      // Gerar preview se container existir
      if (previewContainer) {
        addImagePreview(imageObj, type, previewContainer);
      }
      
      // Atualizar contadores
      currentUploads.completed++;
      updateProgressUI();
    };
    
    reader.onerror = function() {
      console.error('Erro ao ler arquivo:', file.name);
      currentUploads.failed++;
      updateProgressUI();
    };
    
    // Ler arquivo como Data URL
    reader.readAsDataURL(file);
  }
  
  /**
   * Atualiza o AppState com a nova imagem
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {string} registroId - ID do registro
   * @param {Object} imageObj - Objeto da imagem
   */
  function updateAppState(type, registroId, imageObj) {
    const AppState = window.AppState || ModuleLoader.get('state');
    if (!AppState) return;
    
    const stateKey = `photos_${type}_${registroId}`;
    const currentPhotos = AppState.get(stateKey) || [];
    
    // Adicionar nova foto
    const updatedPhotos = [...currentPhotos, imageObj];
    
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
    // Criar coluna para o card
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3';
    col.setAttribute('data-image-id', imageObj.id);
    
    // Criar card de imagem
    col.innerHTML = `
      <div class="card h-100">
        <div class="position-relative">
          <img src="${imageObj.dataUrl}" class="card-img-top" alt="${Utils.sanitizeString(imageObj.name)}" style="height: 160px; object-fit: cover;">
          <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-photo" 
                  data-image-id="${imageObj.id}" data-type="${type}" title="Remover">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div class="card-body p-2">
          <p class="card-text small text-truncate">${Utils.sanitizeString(imageObj.name)}</p>
          <p class="card-text small text-muted">${Utils.formatFileSize(imageObj.size)}</p>
        </div>
      </div>
    `;
    
    // Adicionar ao container
    container.appendChild(col);
    
    // Adicionar listener para botão de remover
    const removeBtn = col.querySelector('.remove-photo');
    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        removeImage(imageObj.id, type, imageObj.registroId);
        col.remove();
      });
    }
  }
  
  /**
   * Remove uma imagem
   * @param {string} imageId - ID da imagem
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {string} registroId - ID do registro
   */
  function removeImage(imageId, type, registroId) {
    // Remover da memória
    if (memoryStorage[type][registroId]) {
      memoryStorage[type][registroId] = memoryStorage[type][registroId].filter(img => img.id !== imageId);
    }
    
    // Remover do AppState
    const AppState = window.AppState || ModuleLoader.get('state');
    if (AppState) {
      const stateKey = `photos_${type}_${registroId}`;
      const currentPhotos = AppState.get(stateKey) || [];
      const updatedPhotos = currentPhotos.filter(img => img.id !== imageId);
      AppState.update(stateKey, updatedPhotos);
    }
    
    // Mostrar notificação
    const Notifications = window.Notifications || ModuleLoader.get('notifications');
    if (Notifications) {
      Notifications.info('Foto removida.');
    }
  }
  
  /**
   * Exibe mensagem de erro
   * @param {string} message - Mensagem de erro
   */
  function showError(message) {
    console.error('Erro PhotoHandler:', message);
    
    const Notifications = window.Notifications || ModuleLoader.get('notifications');
    if (Notifications) {
      Notifications.error(message);
    } else {
      alert(message);
    }
  }
  
  /**
   * Obtém todas as fotos de um registro
   * @param {string} registroId - ID do registro
   * @param {string} type - Tipo de foto (pre ou pos)
   * @returns {Array} Lista de objetos de imagem
   */
  function getPhotos(registroId, type = 'pre') {
    // Tentar obter do AppState primeiro (persistente entre telas)
    const AppState = window.AppState || ModuleLoader.get('state');
    if (AppState) {
      const stateKey = `photos_${type}_${registroId}`;
      const statePhotos = AppState.get(stateKey);
      if (statePhotos && statePhotos.length > 0) {
        return statePhotos;
      }
    }
    
    // Fallback para armazenamento em memória
    return memoryStorage[type][registroId] || [];
  }
  
  /**
   * Carrega fotos salvas para um registro
   * @param {string} registroId - ID do registro
   * @param {string} type - Tipo de foto (pre ou pos)
   * @param {Array} photos - Array de objetos de foto
   */
  function loadSavedPhotos(registroId, type, photos) {
    if (!Array.isArray(photos) || photos.length === 0) return;
    
    // Atualizar armazenamento em memória
    memoryStorage[type][registroId] = photos;
    
    // Atualizar AppState
    const AppState = window.AppState || ModuleLoader.get('state');
    if (AppState) {
      const stateKey = `photos_${type}_${registroId}`;
      AppState.update(stateKey, photos);
    }
    
    // Atualizar UI se container de preview existir
    const previewContainer = document.getElementById(`${type}-photos-preview`);
    if (previewContainer) {
      // Limpar container
      previewContainer.innerHTML = '';
      
      // Adicionar previews
      photos.forEach(photo => {
        addImagePreview(photo, type, previewContainer);
      });
    }
  }
  
  /**
   * Prepara dados de fotos para envio ao servidor
   * @param {string} registroId - ID do registro
   * @returns {Object} Dados formatados para envio
   */
  function preparePhotosForSubmission(registroId) {
    // Obter fotos pré e pós
    const prePhotos = getPhotos(registroId, 'pre');
    const posPhotos = getPhotos(registroId, 'pos');
    
    // Remover dados desnecessários (data URLs grandes) para economizar banda
    const prepareForSubmission = (photos) => {
      return photos.map(photo => {
        // Criar cópia sem a dataUrl completa
        const { dataUrl, ...photoData } = photo;
        return {
          ...photoData,
          // Incluir apenas o início da dataUrl para identificação do formato (opcional)
          dataUrlType: dataUrl.substring(0, 30) + '...'
        };
      });
    };
    
    return {
      pre: prepareForSubmission(prePhotos),
      pos: prepareForSubmission(posPhotos),
      totalPhotos: prePhotos.length + posPhotos.length
    };
  }
  
  /**
   * Limpa fotos temporárias ao finalizar operação
   * @param {string} registroId - ID do registro
   */
  function clearTemporaryPhotos(registroId) {
    // Limpar memória
    delete memoryStorage.pre[registroId];
    delete memoryStorage.pos[registroId];
    
    // Limpar AppState
    const AppState = window.AppState || ModuleLoader.get('state');
    if (AppState) {
      AppState.update(`photos_pre_${registroId}`, null);
      AppState.update(`photos_pos_${registroId}`, null);
    }
  }
  
  /**
   * Exporta fotos para Drive (simulado)
   * @param {string} registroId - ID do registro
   * @returns {Promise<Object>} Resultado do processo
   */
  async function exportPhotosToDrive(registroId) {
    // Simulação de exportação para Google Drive
    return new Promise((resolve) => {
      setTimeout(() => {
        const prePhotos = getPhotos(registroId, 'pre');
        const posPhotos = getPhotos(registroId, 'pos');
        
        const folderUrl = `https://drive.google.com/drive/folders/example-${registroId}`;
        
        resolve({
          success: true,
          message: `${prePhotos.length + posPhotos.length} fotos exportadas com sucesso`,
          folderUrl: folderUrl,
          prePhotosCount: prePhotos.length,
          posPhotosCount: posPhotos.length
        });
      }, 1500);
    });
  }
  
  /**
   * Obtém URL de visualização para uma foto
   * @param {string} imageId - ID da imagem
   * @param {string} registroId - ID do registro
   * @param {string} type - Tipo de foto (pre ou pos)
   * @returns {string|null} URL da imagem ou null se não encontrada
   */
  function getPhotoUrl(imageId, registroId, type = 'pre') {
    const photos = getPhotos(registroId, type);
    const photo = photos.find(p => p.id === imageId);
    return photo ? photo.dataUrl : null;
  }
  
  // Exportar funções públicas
  return {
    init,
    getPhotos,
    loadSavedPhotos,
    preparePhotosForSubmission,
    clearTemporaryPhotos,
    exportPhotosToDrive,
    getPhotoUrl
  };
});

// Alias global para compatibilidade com código existente
window.PhotoHandler = ModuleLoader.get('photoHandler') || ModuleLoader.initialize('photoHandler');
