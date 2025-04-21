// photo-handler.js

/**
 * Manipulador de captura e gestão de fotos
 */
const PhotoHandler = {
  // Estado atual
  currentMode: 'pre', // 'pre' ou 'pos'
  stream: null,
  photoData: {
    pre: [],
    pos: []
  },
  
  // Elementos DOM
  elements: {
    video: null,
    canvas: null,
    photo: null,
    captureBtn: null,
    saveBtn: null,
    newPhotoBtn: null,
    descricaoInput: null,
    modalCamera: null,
    photoDetailsForm: null,
    capturedPhotoContainer: null
  },
  
  /**
   * Inicializar manipulador de fotos
   */
  init: function() {
    // Inicializar elementos DOM
    this.elements.video = document.getElementById('cameraPreview');
    this.elements.canvas = document.getElementById('photoCanvas');
    this.elements.photo = document.getElementById('capturedPhoto');
    this.elements.captureBtn = document.getElementById('btnCapturar');
    this.elements.saveBtn = document.getElementById('btnSalvarFoto');
    this.elements.newPhotoBtn = document.getElementById('btnNovaFoto');
    this.elements.descricaoInput = document.getElementById('descricaoFoto');
    this.elements.photoDetailsForm = document.getElementById('photoDetailsForm');
    this.elements.capturedPhotoContainer = document.getElementById('capturedPhotoContainer');
    
    // Criar instância do modal de câmera
    this.elements.modalCamera = new bootstrap.Modal(document.getElementById('modalCamera'));
    
    // Configurar eventos
    this.setupEvents();
    
    // Carregar fotos existentes (se houver)
    this.loadPhotosFromStorage();
  },
  
  /**
   * Configurar eventos
   */
  setupEvents: function() {
    // Botões para captura pré-manutenção
    document.getElementById('btnCapturarFotoPre').addEventListener('click', () => {
      this.openCamera('pre');
    });
    
    document.getElementById('btnSelecionarFotoPre').addEventListener('click', () => {
      this.openGallery('pre');
    });
    
    // Botões para captura pós-manutenção
    document.getElementById('btnCapturarFotoPos').addEventListener('click', () => {
      this.openCamera('pos');
    });
    
    document.getElementById('btnSelecionarFotoPos').addEventListener('click', () => {
      this.openGallery('pos');
    });
    
    // Inputs de arquivo
    document.getElementById('fotoPreInput').addEventListener('change', (e) => {
      this.handleFileSelect(e, 'pre');
    });
    
    document.getElementById('fotoPosInput').addEventListener('change', (e) => {
      this.handleFileSelect(e, 'pos');
    });
    
    // Botões do modal de câmera
    this.elements.captureBtn.addEventListener('click', () => {
      this.capturePhoto();
    });
    
    this.elements.saveBtn.addEventListener('click', () => {
      this.savePhoto();
    });
    
    this.elements.newPhotoBtn.addEventListener('click', () => {
      this.prepareNewPhoto();
    });
    
    // Fechar modal
    document.getElementById('modalCamera').addEventListener('hidden.bs.modal', () => {
      this.stopCamera();
    });
  },
  
  /**
   * Abrir câmera para captura
   * @param {string} mode - Modo de captura ('pre' ou 'pos')
   */
  openCamera: function(mode) {
    this.currentMode = mode;
    
    // Preparar UI
    this.prepareNewPhoto();
    
    // Atualizar título do modal conforme o modo
    const title = mode === 'pre' ? 'Foto Pré-Manutenção' : 'Foto Pós-Manutenção';
    document.getElementById('modalCameraTitle').textContent = title;
    
    // Verificar suporte à câmera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Preferir câmera traseira em dispositivos móveis
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      // Tentar abrir câmera
      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          this.stream = stream;
          this.elements.video.srcObject = stream;
          this.elements.video.play();
          
          // Mostrar modal
          this.elements.modalCamera.show();
        })
        .catch((error) => {
          console.error('Erro ao acessar câmera:', error);
          Utils.showNotification('Erro ao acessar câmera. Verifique as permissões.', 'error');
          
          // Fallback para galeria
          this.openGallery(mode);
        });
    } else {
      Utils.showNotification('Seu navegador não suporta acesso à câmera.', 'warning');
      this.openGallery(mode);
    }
  },
  
  /**
   * Parar câmera
   */
  stopCamera: function() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.elements.video.srcObject = null;
  },
  
  /**
   * Capturar foto da câmera
   */
  capturePhoto: function() {
    // Obter contexto do canvas
    const context = this.elements.canvas.getContext('2d');
    
    // Definir dimensões do canvas
    this.elements.canvas.width = this.elements.video.videoWidth;
    this.elements.canvas.height = this.elements.video.videoHeight;
    
    // Capturar frame do vídeo
    context.drawImage(this.elements.video, 0, 0, this.elements.canvas.width, this.elements.canvas.height);
    
    // Converter para dataURL
    const dataURL = this.elements.canvas.toDataURL('image/jpeg', CONFIG.FOTO.QUALITY);
    
    // Mostrar foto capturada
    this.elements.photo.src = dataURL;
    
    // Atualizar UI
    this.elements.capturedPhotoContainer.classList.remove('d-none');
    this.elements.photoDetailsForm.classList.remove('d-none');
    this.elements.captureBtn.classList.add('d-none');
    this.elements.saveBtn.classList.remove('d-none');
    this.elements.newPhotoBtn.classList.remove('d-none');
    
    // Parar câmera para economizar recursos
    this.stopCamera();
  },
  
  /**
   * Preparar para nova foto
   */
  prepareNewPhoto: function() {
    // Reiniciar interface
    this.elements.capturedPhotoContainer.classList.add('d-none');
    this.elements.photoDetailsForm.classList.add('d-none');
    this.elements.captureBtn.classList.remove('d-none');
    this.elements.saveBtn.classList.add('d-none');
    this.elements.newPhotoBtn.classList.add('d-none');
    
    // Limpar campo de descrição
    this.elements.descricaoInput.value = '';
    
    // Reiniciar câmera
    if (this.stream) {
      this.elements.video.srcObject = this.stream;
      this.elements.video.play();
    } else {
      this.openCamera(this.currentMode);
    }
  },
  
  /**
   * Salvar foto capturada
   */
  savePhoto: async function() {
    // Obter descrição
    const descricao = this.elements.descricaoInput.value.trim();
    
    if (!descricao) {
      Utils.showNotification('Por favor, descreva a foto.', 'warning');
      this.elements.descricaoInput.focus();
      return;
    }
    
    try {
      // Obter dataURL da foto
      const dataURL = this.elements.photo.src;
      
      // Redimensionar imagem para economizar espaço
      const resizedDataURL = await Utils.resizeImage(dataURL);
      
      // Montar objeto de foto
      const foto = {
        id: 'FOTO_' + Date.now(),
        dataURL: resizedDataURL,
        descricao: descricao,
        timestamp: new Date().toISOString()
      };
      
      // Tentar fazer upload para o servidor
      if (CONFIG.API_URL) {
        try {
          const uploadResult = await ApiClient.uploadImagem({
            registroId: document.getElementById(this.currentMode === 'pre' ? 'registroId' : 'registroIdPos').value,
            imageData: resizedDataURL,
            filename: `foto_${this.currentMode}_${Date.now()}.jpg`,
            contentType: 'image/jpeg',
            descricao: descricao,
            tipo: this.currentMode
          });
          
          if (uploadResult.success) {
            // Adicionar URL remota se disponível
            foto.url = uploadResult.url;
            foto.imageId = uploadResult.imageId;
          }
        } catch (error) {
          console.error('Erro ao fazer upload da imagem:', error);
          // Continuar com versão local
        }
      }
      
      // Adicionar à lista correspondente
      this.photoData[this.currentMode].push(foto);
      
      // Atualizar interface
      this.renderPhotos(this.currentMode);
      
      // Salvar no localStorage
      this.savePhotosToStorage();
      
      // Fechar modal
      this.elements.modalCamera.hide();
      
      Utils.showNotification('Foto adicionada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar foto:', error);
      Utils.showNotification('Erro ao salvar foto.', 'error');
    }
  },
  
  /**
   * Abrir seleção de galeria
   * @param {string} mode - Modo de captura ('pre' ou 'pos')
   */
  openGallery: function(mode) {
    this.currentMode = mode;
    document.getElementById(mode === 'pre' ? 'fotoPreInput' : 'fotoPosInput').click();
  },
  
  /**
   * Manipular seleção de arquivo
   * @param {Event} event - Evento de change do input
   * @param {string} mode - Modo de captura ('pre' ou 'pos')
   */
  handleFileSelect: async function(event, mode) {
    const file = event.target.files[0];
    
    if (!file || !file.type.startsWith('image/')) {
      Utils.showNotification('Por favor, selecione uma imagem válida.', 'warning');
      return;
    }
    
    try {
      // Ler arquivo como dataURL
      const dataURL = await this.readFileAsDataURL(file);
      
      // Configurar modo atual
      this.currentMode = mode;
      
      // Atualizar título do modal
      const title = mode === 'pre' ? 'Foto Pré-Manutenção' : 'Foto Pós-Manutenção';
      document.getElementById('modalCameraTitle').textContent = title;
      
      // Mostrar imagem no modal
      this.elements.photo.src = dataURL;
      
      // Atualizar UI
      this.elements.capturedPhotoContainer.classList.remove('d-none');
      this.elements.photoDetailsForm.classList.remove('d-none');
      this.elements.captureBtn.classList.add('d-none');
      this.elements.saveBtn.classList.remove('d-none');
      this.elements.newPhotoBtn.classList.add('d-none');
      
      // Mostrar modal
      this.elements.modalCamera.show();
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      Utils.showNotification('Erro ao processar imagem.', 'error');
    }
    
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    event.target.value = '';
  },
  
  /**
   * Ler arquivo como dataURL
   * @param {File} file - Arquivo a ser lido
   * @returns {Promise<string>} - dataURL do arquivo
   */
  readFileAsDataURL: function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function(event) {
        resolve(event.target.result);
      };
      
      reader.onerror = function(error) {
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  },
  
  /**
   * Renderizar fotos no container
   * @param {string} mode - Modo de captura ('pre' ou 'pos')
   */
  renderPhotos: function(mode) {
    const container = document.getElementById(`fotos${mode.charAt(0).toUpperCase() + mode.slice(1)}Grid`);
    const placeholder = document.getElementById(`fotos${mode.charAt(0).toUpperCase() + mode.slice(1)}Placeholder`);
    
    if (!container) return;
    
    // Limpar container
    container.innerHTML = '';
    
    // Verificar se há fotos para mostrar
    if (this.photoData[mode].length === 0) {
      placeholder.style.display = 'block';
      return;
    }
    
    // Ocultar placeholder
    placeholder.style.display = 'none';
    
    // Adicionar cada foto ao container
    this.photoData[mode].forEach((foto, index) => {
      const colDiv = document.createElement('div');
      colDiv.className = 'col-6 col-md-4 col-lg-3 mb-3';
      
      colDiv.innerHTML = `
        <div class="card h-100">
          <img src="${foto.dataURL || foto.url}" class="card-img-top img-fluid" alt="${foto.descricao}" style="height: 150px; object-fit: cover;">
          <div class="card-body p-2">
            <p class="card-text small mb-1">${foto.descricao}</p>
            <p class="card-text text-muted small">${Utils.formatDate(foto.timestamp)}</p>
          </div>
          <div class="card-footer p-2 d-flex justify-content-between">
            <button class="btn btn-sm btn-outline-primary btn-view-photo" data-mode="${mode}" data-index="${index}">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger btn-delete-photo" data-mode="${mode}" data-index="${index}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
      
      // Adicionar eventos aos botões
      const viewBtn = colDiv.querySelector('.btn-view-photo');
      const deleteBtn = colDiv.querySelector('.btn-delete-photo');
      
      viewBtn.addEventListener('click', () => {
        this.viewPhoto(mode, index);
      });
      
      deleteBtn.addEventListener('click', () => {
        this.deletePhoto(mode, index);
      });
      
      container.appendChild(colDiv);
    });
  },
  
  /**
   * Visualizar foto em tamanho maior
   * @param {string} mode - Modo de captura ('pre' ou 'pos')
   * @param {number} index - Índice da foto
   */
  viewPhoto: function(mode, index) {
    const foto = this.photoData[mode][index];
    
    // Criar modal temporário para visualização
    const modalHTML = `
      <div class="modal fade" id="modalViewPhoto" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${foto.descricao}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body">
              <img src="${foto.dataURL || foto.url}" class="img-fluid d-block mx-auto" alt="${foto.descricao}">
              <p class="text-center text-muted mt-2">${Utils.formatDate(foto.timestamp)}</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar modal ao DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalViewPhoto'));
    modal.show();
    
    // Configurar limpeza após fechamento
    document.getElementById('modalViewPhoto').addEventListener('hidden.bs.modal', function() {
      document.body.removeChild(modalContainer);
    });
  },
  
  /**
   * Excluir foto
   * @param {string} mode - Modo de captura ('pre' ou 'pos')
   * @param {number} index - Índice da foto
   */
  deletePhoto: function(mode, index) {
    if (confirm('Tem certeza que deseja excluir esta foto?')) {
      // Remover da lista
      this.photoData[mode].splice(index, 1);
      
      // Atualizar interface
      this.renderPhotos(mode);
      
      // Salvar no localStorage
      this.savePhotosToStorage();
      
      Utils.showNotification('Foto removida com sucesso.', 'success');
    }
  },
  
  /**
   * Salvar fotos no localStorage
   */
  savePhotosToStorage: function() {
    Utils.storeData('photoData', this.photoData);
  },
  
  /**
   * Carregar fotos do localStorage
   */
  loadPhotosFromStorage: function() {
    const storedData = Utils.retrieveData('photoData');
    
    if (storedData) {
      this.photoData = storedData;
    }
  },
  
  /**
   * Limpar fotos de um modo específico
   * @param {string} mode - Modo de captura ('pre' ou 'pos')
   */
  clearPhotos: function(mode) {
    this.photoData[mode] = [];
    this.renderPhotos(mode);
    this.savePhotosToStorage();
  },
  
  /**
   * Obter dados de fotos
   * @returns {object} - Dados de fotos
   */
  getPhotoData: function() {
    return this.photoData;
  },
  
  /**
   * Definir dados de fotos
   * @param {object} data - Dados de fotos
   */
  setPhotoData: function(data) {
    this.photoData = data;
    this.renderPhotos('pre');
    this.renderPhotos('pos');
    this.savePhotosToStorage();
  }
};
