/**
 * Manipulador de Fotos para Sistema de Manutenção
 * Gerencia captura, processamento e armazenamento de imagens
 */
(function() {
  // Configurações
  const CONFIG = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxWidth: 1600,
    maxHeight: 1200,
    quality: 0.7,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    storagePrefix: 'manutencao_foto_',
    maxPhotos: 50 // Máximo de fotos em cache local
  };
  
  // Estado 
  let photoContainers = new Map();
  let currentUpload = null;
  let photoCache = new Map();
  
  /**
   * Inicializar container para manipulação de fotos
   * @param {string} containerId - ID do elemento container
   * @param {Object} options - Opções de configuração
   */
  function initPhotoContainer(containerId, options = {}) {
    // Verificar se existe o container
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`PhotoHandler: Container #${containerId} não encontrado`);
      return false;
    }
    
    // Mesclar opções com padrões
    const config = Object.assign({}, CONFIG, options);
    
    // Verificar se já existe um manipulador para este container
    if (photoContainers.has(containerId)) {
      // Limpar manipulador existente
      removePhotoContainer(containerId);
    }
    
    // Criar estrutura HTML
    container.innerHTML = `
      <div class="photo-upload-container">
        <div class="photo-preview" id="${containerId}-preview">
          <div class="photo-placeholder">
            <i class="bi bi-camera"></i>
            <span>Adicionar Foto</span>
          </div>
        </div>
        <div class="photo-actions">
          <button type="button" class="btn btn-sm btn-primary photo-btn-camera" id="${containerId}-camera">
            <i class="bi bi-camera-fill"></i> Câmera
          </button>
          <button type="button" class="btn btn-sm btn-info text-white photo-btn-upload" id="${containerId}-upload">
            <i class="bi bi-upload"></i> Upload
          </button>
          <button type="button" class="btn btn-sm btn-danger photo-btn-remove" id="${containerId}-remove" style="display:none">
            <i class="bi bi-trash"></i> Remover
          </button>
        </div>
        <input type="file" class="photo-file-input" id="${containerId}-file" accept="image/*" style="display:none">
        <input type="hidden" class="photo-data-input" id="${containerId}-data" name="${options.inputName || 'photo_data'}">
      </div>
    `;
    
    // Adicionar estilos CSS se ainda não existirem
    addPhotoStyles();
    
    // Adicionar eventos
    const previewArea = document.getElementById(`${containerId}-preview`);
    const cameraBtn = document.getElementById(`${containerId}-camera`);
    const uploadBtn = document.getElementById(`${containerId}-upload`);
    const removeBtn = document.getElementById(`${containerId}-remove`);
    const fileInput = document.getElementById(`${containerId}-file`);
    
    if (previewArea) {
      previewArea.addEventListener('click', () => handlePreviewClick(containerId));
    }
    
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => openCamera(containerId));
    }
    
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => openFileInput(containerId));
    }
    
    if (removeBtn) {
      removeBtn.addEventListener('click', () => removePhoto(containerId));
    }
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => handleFileSelect(e, containerId));
    }
    
    // Registrar container
    photoContainers.set(containerId, {
      config: config,
      photoData: null
    });
    
    return true;
  }
  
  /**
   * Remover container de foto
   * @param {string} containerId - ID do container a remover
   */
  function removePhotoContainer(containerId) {
    // Verificar se existe
    if (!photoContainers.has(containerId)) {
      return false;
    }
    
    // Limpar eventos
    const previewArea = document.getElementById(`${containerId}-preview`);
    const cameraBtn = document.getElementById(`${containerId}-camera`);
    const uploadBtn = document.getElementById(`${containerId}-upload`);
    const removeBtn = document.getElementById(`${containerId}-remove`);
    const fileInput = document.getElementById(`${containerId}-file`);
    
    if (previewArea) {
      previewArea.replaceWith(previewArea.cloneNode(true));
    }
    
    if (cameraBtn) {
      cameraBtn.replaceWith(cameraBtn.cloneNode(true));
    }
    
    if (uploadBtn) {
      uploadBtn.replaceWith(uploadBtn.cloneNode(true));
    }
    
    if (removeBtn) {
      removeBtn.replaceWith(removeBtn.cloneNode(true));
    }
    
    if (fileInput) {
      fileInput.replaceWith(fileInput.cloneNode(true));
    }
    
    // Remover do registro
    photoContainers.delete(containerId);
    
    return true;
  }
  
  /**
   * Adicionar estilos CSS para os componentes de foto
   */
  function addPhotoStyles() {
    if (document.getElementById('photo-handler-styles')) {
      return; // Já existem
    }
    
    const style = document.createElement('style');
    style.id = 'photo-handler-styles';
    style.textContent = `
      .photo-upload-container {
        border: 1px solid #ced4da;
        border-radius: 0.375rem;
        background-color: #f8f9fa;
        overflow: hidden;
        margin-bottom: 1rem;
      }
      
      .photo-preview {
        width: 100%;
        height: 200px;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        position: relative;
        cursor: pointer;
        background-color: #e9ecef;
      }
      
      .photo-preview img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      
      .photo-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        color: #6c757d;
      }
      
      .photo-placeholder i {
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }
      
      .photo-actions {
        display: flex;
        gap: 0.5rem;
        padding: 0.75rem;
        background-color: #fff;
        border-top: 1px solid #ced4da;
      }
      
      .photo-caption {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
      }
      
      /* Loading animation */
      .photo-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
      }
      
      .photo-loading-spinner {
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-left-color: #0d6efd;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        animation: photo-spinner 1s linear infinite;
        margin-bottom: 0.5rem;
      }
      
      @keyframes photo-spinner {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Dark mode */
      body.dark-mode .photo-upload-container {
        border-color: #495057;
        background-color: #343a40;
      }
      
      body.dark-mode .photo-preview {
        background-color: #212529;
      }
      
      body.dark-mode .photo-actions {
        background-color: #2c3034;
        border-color: #495057;
      }
      
      body.dark-mode .photo-placeholder {
        color: #adb5bd;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Lidar com clique na área de preview
   * @param {string} containerId - ID do container
   */
  function handlePreviewClick(containerId) {
    const containerData = photoContainers.get(containerId);
    if (!containerData) return;
    
    if (containerData.photoData) {
      // Se já tem foto, mostra em tamanho maior
      showPhotoModal(containerData.photoData);
    } else {
      // Se não tem foto, abre seletor de arquivo
      openFileInput(containerId);
    }
  }
  
  /**
   * Abrir input de arquivo
   * @param {string} containerId - ID do container
   */
  function openFileInput(containerId) {
    const fileInput = document.getElementById(`${containerId}-file`);
    if (fileInput) {
      fileInput.click();
    }
  }
  
  /**
   * Manipular seleção de arquivo
   * @param {Event} event - Evento change
   * @param {string} containerId - ID do container
   */
  function handleFileSelect(event, containerId) {
    const file = event.target.files[0];
    if (!file) return;
    
    const containerData = photoContainers.get(containerId);
    if (!containerData) return;
    
    // Verificar tipo de arquivo
    if (!CONFIG.allowedTypes.includes(file.type)) {
      showErrorMessage('Tipo de arquivo não suportado. Use JPEG, PNG ou WebP.');
      return;
    }
    
    // Verificar tamanho
    if (file.size > CONFIG.maxFileSize) {
      showErrorMessage(`Arquivo muito grande. Tamanho máximo: ${CONFIG.maxFileSize / (1024 * 1024)}MB.`);
      return;
    }
    
    // Processar imagem
    processImage(file, containerId);
  }
  
  /**
   * Abrir câmera
   * @param {string} containerId - ID do container
   */
  function openCamera(containerId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showErrorMessage('Seu navegador não suporta acesso à câmera.');
      return;
    }
    
    // Criar modal da câmera se não existir
    if (!document.getElementById('photo-camera-modal')) {
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.id = 'photo-camera-modal';
      modal.setAttribute('tabindex', '-1');
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Capturar Foto</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body p-0">
              <video id="camera-video" autoplay playsinline style="width: 100%; display: block;"></video>
              <canvas id="camera-canvas" style="display: none;"></canvas>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="camera-capture-btn">
                <i class="bi bi-camera"></i> Capturar
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
    }
    
    // Armazenar containerId atual
    const cameraModal = document.getElementById('photo-camera-modal');
    cameraModal.dataset.containerId = containerId;
    
    // Inicializar Bootstrap modal
    const modalInstance = new bootstrap.Modal(cameraModal);
    
    // Iniciar câmera quando o modal abrir
    cameraModal.addEventListener('shown.bs.modal', startCamera);
    
    // Parar câmera quando o modal fechar
    cameraModal.addEventListener('hidden.bs.modal', stopCamera);
    
    // Configurar botão de captura
    const captureBtn = document.getElementById('camera-capture-btn');
    if (captureBtn) {
      // Remover listeners anteriores
      const newBtn = captureBtn.cloneNode(true);
      captureBtn.parentNode.replaceChild(newBtn, captureBtn);
      
      // Adicionar novo listener
      newBtn.addEventListener('click', function() {
        capturePhoto();
        modalInstance.hide();
      });
    }
    
    // Mostrar modal
    modalInstance.show();
  }
  
  // Stream de vídeo atual
  let videoStream = null;
  
  /**
   * Iniciar câmera
   */
  function startCamera() {
    const video = document.getElementById('camera-video');
    if (!video) return;
    
    // Configurar preferências de câmera
    const constraints = {
      video: {
        facingMode: 'environment', // Preferir câmera traseira
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    
    // Acessar câmera
    navigator.mediaDevices.getUserMedia(constraints)
      .then(function(stream) {
        videoStream = stream;
        video.srcObject = stream;
        video.play();
      })
      .catch(function(error) {
        console.error('Erro ao acessar câmera:', error);
        showErrorMessage('Não foi possível acessar a câmera.');
        
        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('photo-camera-modal'));
        if (modal) modal.hide();
      });
  }
  
  /**
   * Parar câmera
   */
  function stopCamera() {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    
    const video = document.getElementById('camera-video');
    if (video) {
      video.srcObject = null;
    }
  }
  
  /**
   * Capturar foto da câmera
   */
  function capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    
    if (!video || !canvas) return;
    
    // Configurar canvas com dimensões do vídeo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Capturar frame
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Converter para blob
    canvas.toBlob(function(blob) {
      if (!blob) {
        showErrorMessage('Erro ao processar imagem.');
        return;
      }
      
      // Obter containerId
      const modal = document.getElementById('photo-camera-modal');
      const containerId = modal?.dataset?.containerId;
      
      if (!containerId) return;
      
      // Criar arquivo
      const file = new File([blob], `camera_${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });
      
      // Processar imagem
      processImage(file, containerId);
      
    }, 'image/jpeg', 0.8);
  }
  
  /**
   * Processar imagem
   * @param {File} file - Arquivo de imagem
   * @param {string} containerId - ID do container
   */
  function processImage(file, containerId) {
    const containerData = photoContainers.get(containerId);
    if (!containerData) return;
    
    // Mostrar indicador de carregamento
    showLoadingState(containerId);
    
    // Ler arquivo
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const img = new Image();
      
      img.onload = function() {
        // Redimensionar se necessário
        const { width, height } = calculateDimensions(
          img.width, 
          img.height, 
          containerData.config.maxWidth || CONFIG.maxWidth, 
          containerData.config.maxHeight || CONFIG.maxHeight
        );
        
        // Criar canvas para redimensionamento
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Desenhar imagem redimensionada
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Converter para data URL
        const quality = containerData.config.quality || CONFIG.quality;
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Criar objeto de dados da foto
        const photoData = {
          id: generatePhotoId(),
          fileName: file.name,
          type: 'image/jpeg',
          dataUrl: dataUrl,
          width: width,
          height: height,
          size: Math.round(dataUrl.length * 0.75), // Estimativa do tamanho em bytes
          timestamp: new Date().toISOString()
        };
        
        // Salvar dados
        containerData.photoData = photoData;
        photoContainers.set(containerId, containerData);
        
        // Atualizar preview
        updatePhotoPreview(containerId, photoData);
        
        // Salvar no cache
        savePhotoToCache(photoData);
        
        // Notificar sucesso
        showSuccessMessage('Imagem processada com sucesso.');
      };
      
      img.onerror = function() {
        showErrorMessage('Erro ao carregar imagem.');
        resetPhotoContainer(containerId);
      };
      
      img.src = e.target.result;
    };
    
    reader.onerror = function() {
      showErrorMessage('Erro ao ler arquivo.');
      resetPhotoContainer(containerId);
    };
    
    reader.readAsDataURL(file);
  }
  
  /**
   * Mostrar estado de carregamento
   * @param {string} containerId - ID do container
   */
  function showLoadingState(containerId) {
    const previewArea = document.getElementById(`${containerId}-preview`);
    if (!previewArea) return;
    
    previewArea.innerHTML = `
      <div class="photo-loading">
        <div class="photo-loading-spinner"></div>
        <span>Processando...</span>
      </div>
    `;
  }
  
  /**
   * Calcular dimensões mantendo proporção
   * @param {number} width - Largura original
   * @param {number} height - Altura original
   * @param {number} maxWidth - Largura máxima
   * @param {number} maxHeight - Altura máxima
   * @returns {Object} Novas dimensões
   */
  function calculateDimensions(width, height, maxWidth, maxHeight) {
    // Se já está dentro dos limites
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }
    
    let newWidth, newHeight;
    
    // Calcular baseado na restrição mais limitante
    if (width / maxWidth > height / maxHeight) {
      // Largura é a restrição
      newWidth = maxWidth;
      newHeight = Math.round(height * (maxWidth / width));
    } else {
      // Altura é a restrição
      newHeight = maxHeight;
      newWidth = Math.round(width * (maxHeight / height));
    }
    
    return { width: newWidth, height: newHeight };
  }
  
  /**
   * Atualizar preview da foto
   * @param {string} containerId - ID do container
   * @param {Object} photoData - Dados da foto
   */
  function updatePhotoPreview(containerId, photoData) {
    const previewArea = document.getElementById(`${containerId}-preview`);
    const dataInput = document.getElementById(`${containerId}-data`);
    const removeBtn = document.getElementById(`${containerId}-remove`);
    
    if (!previewArea || !dataInput || !removeBtn) return;
    
    // Atualizar preview
    previewArea.innerHTML = `
      <img src="${photoData.dataUrl}" alt="Preview">
      <div class="photo-caption">
        ${photoData.width} x ${photoData.height} - ${formatFileSize(photoData.size)}
      </div>
    `;
    
    // Atualizar input escondido
    dataInput.value = JSON.stringify({
      id: photoData.id,
      timestamp: photoData.timestamp,
      dataUrl: photoData.dataUrl
    });
    
    // Mostrar botão de remover
    removeBtn.style.display = 'inline-block';
  }
  
  /**
   * Remover foto
   * @param {string} containerId - ID do container
   */
  function removePhoto(containerId) {
    resetPhotoContainer(containerId);
    showSuccessMessage('Foto removida.');
  }
  
  /**
   * Resetar container para estado inicial
   * @param {string} containerId - ID do container
   */
  function resetPhotoContainer(containerId) {
    const containerData = photoContainers.get(containerId);
    if (!containerData) return;
    
    // Limpar dados
    containerData.photoData = null;
    photoContainers.set(containerId, containerData);
    
    // Resetar UI
    const previewArea = document.getElementById(`${containerId}-preview`);
    const dataInput = document.getElementById(`${containerId}-data`);
    const removeBtn = document.getElementById(`${containerId}-remove`);
    
    if (previewArea) {
      previewArea.innerHTML = `
        <div class="photo-placeholder">
          <i class="bi bi-camera"></i>
          <span>Adicionar Foto</span>
        </div>
      `;
    }
    
    if (dataInput) {
      dataInput.value = '';
    }
    
    if (removeBtn) {
      removeBtn.style.display = 'none';
    }
  }
  
  /**
   * Exibir foto em modal ampliado
   * @param {Object} photoData - Dados da foto
   */
  function showPhotoModal(photoData) {
    if (!photoData || !photoData.dataUrl) return;
    
    // Criar modal se não existir
    if (!document.getElementById('photo-viewer-modal')) {
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.id = 'photo-viewer-modal';
      modal.setAttribute('tabindex', '-1');
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Visualizar Foto</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body text-center p-0">
              <img id="modal-photo" src="" alt="Foto" style="max-width: 100%; max-height: 70vh; object-fit: contain;">
            </div>
            <div class="modal-footer">
              <div class="photo-info small text-muted"></div>
              <div class="ms-auto">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                <a id="photo-download" href="#" download="foto.jpg" class="btn btn-primary">
                  <i class="bi bi-download"></i> Download
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
    }
    
    // Atualizar conteúdo
    const modalImg = document.getElementById('modal-photo');
    const photoInfo = document.querySelector('#photo-viewer-modal .photo-info');
    const downloadBtn = document.getElementById('photo-download');
    
    if (modalImg) modalImg.src = photoData.dataUrl;
    
    if (photoInfo) {
      const date = new Date(photoData.timestamp).toLocaleString();
      photoInfo.textContent = `${photoData.width} x ${photoData.height} - ${formatFileSize(photoData.size)} - ${date}`;
    }
    
    if (downloadBtn) {
      downloadBtn.href = photoData.dataUrl;
      downloadBtn.download = photoData.fileName || `foto_${Date.now()}.jpg`;
    }
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('photo-viewer-modal'));
    modal.show();
  }
  
  /**
   * Salvar foto no cache local
   * @param {Object} photoData - Dados da foto
   */
  function savePhotoToCache(photoData) {
    if (!photoData || !photoData.id) return;
    
    try {
      // Armazenar no cache em memória
      photoCache.set(photoData.id, photoData);
      
      // Armazenar no localStorage (sem a dataUrl completa para economizar espaço)
      const storageData = {
        id: photoData.id,
        fileName: photoData.fileName,
        type: photoData.type,
        width: photoData.width,
        height: photoData.height,
        size: photoData.size,
        timestamp: photoData.timestamp
      };
      
      // Obter lista atual
      let cachedPhotos = [];
      try {
        const stored = localStorage.getItem('photo_handler_cache');
        if (stored) {
          cachedPhotos = JSON.parse(stored);
          if (!Array.isArray(cachedPhotos)) cachedPhotos = [];
        }
      } catch (e) {
        console.error('Erro ao ler cache de fotos:', e);
        cachedPhotos = [];
      }
      
      // Adicionar nova foto
      cachedPhotos.push(storageData);
      
      // Limitar número de fotos
      if (cachedPhotos.length > CONFIG.maxPhotos) {
        cachedPhotos = cachedPhotos.slice(-CONFIG.maxPhotos);
      }
      
      // Salvar
      localStorage.setItem('photo_handler_cache', JSON.stringify(cachedPhotos));
    } catch (e) {
      console.error('Erro ao salvar foto no cache:', e);
    }
  }
  
  /**
   * Obter foto do cache por ID
   * @param {string} photoId - ID da foto
   * @returns {Object|null} Dados da foto ou null
   */
  function getPhotoById(photoId) {
    if (!photoId) return null;
    
    // Verificar cache em memória primeiro
    if (photoCache.has(photoId)) {
      return photoCache.get(photoId);
    }
    
    return null;
  }
  
  /**
   * Gerar ID único para foto
   * @returns {string} ID único
   */
  function generatePhotoId() {
    return 'photo_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }
  
  /**
   * Formatar tamanho de arquivo para exibição
   * @param {number} bytes - Tamanho em bytes
   * @returns {string} Tamanho formatado
   */
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  
  /**
   * Mostrar mensagem de erro
   * @param {string} message - Mensagem de erro
   */
  function showErrorMessage(message) {
    // Usar sistema de notificações se disponível
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, 'error');
    } else {
      alert(message);
    }
  }
  
  /**
   * Mostrar mensagem de sucesso
   * @param {string} message - Mensagem de sucesso
   */
  function showSuccessMessage(message) {
    // Usar sistema de notificações se disponível
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, 'success');
    } else {
      console.log(message);
    }
  }
  
  /**
   * Exportar funções e API pública
   */
  window.PhotoHandler = {
    init: function() {
      // Nada a fazer aqui por enquanto
      console.log('PhotoHandler inicializado');
    },
    initContainer: initPhotoContainer,
    removeContainer: removePhotoContainer,
    getPhotoById: getPhotoById,
    showPhotoModal: showPhotoModal
  };
})();

// Auto-inicialização
document.addEventListener('DOMContentLoaded', function() {
  if (window.PhotoHandler && typeof window.PhotoHandler.init === 'function') {
    window.PhotoHandler.init();
  }
});
