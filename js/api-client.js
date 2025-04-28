/**
 * Módulo para gerenciar uploads de imagens com suporte a JSONP
 */
ModuleLoader.register('imageUploader', function() {
  // Dependências
  let ApiClient = null;
  let AppState = null;
  let Utils = null;
  let Config = null;

  /**
   * Inicializa o módulo
   */
  function init() {
    console.log('Inicializando ImageUploader...');
    
    // Obtém dependências
    ApiClient = ModuleLoader.get('apiClient');
    AppState = ModuleLoader.get('state');
    Utils = window.Utils;
    Config = window.CONFIG;
    
    console.log('ImageUploader inicializado');
  }

  /**
   * Faz upload de imagem para o servidor usando JSONP
   * @param {string} manutencaoId - ID da manutenção
   * @param {string} imageDataUrl - Dados da imagem em base64
   * @returns {Promise<Object>} Resultado do upload
   */
  function uploadImageViaJSONP(manutencaoId, imageDataUrl) {
    return new Promise((resolve, reject) => {
      if (!manutencaoId) {
        return reject(new Error('ID da manutenção não fornecido para upload'));
      }
      
      if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
        return reject(new Error('Dados de imagem inválidos'));
      }
      
      // Cria um ID único para o callback JSONP
      const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      
      // Define o callback global
      window[callbackName] = function(response) {
        // Remove o script após execução
        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }
        
        // Remove o callback global para evitar memory leaks
        delete window[callbackName];
        
        // Processa a resposta
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.message || 'Falha no upload de imagem'));
        }
      };
      
      // Prepara os dados para envio via JSONP (serializa para evitar problemas)
      const uploadData = {
        id: manutencaoId,
        imageData: imageDataUrl
      };
      
      // Converte para JSON e então para string segura para URL
      const jsonData = JSON.stringify(uploadData);
      const encodedData = encodeURIComponent(jsonData);
      
      // Cria a URL para o script JSONP
      const apiUrl = Config?.API_URL || '';
      if (!apiUrl) {
        return reject(new Error('URL da API não configurada'));
      }
      
      // Monta a URL completa para o JSONP
      const scriptUrl = `${apiUrl}?action=processarPostViaGet&acao=uploadImagem&dados=${encodedData}&callback=${callbackName}`;
      
      // Cria e adiciona o script à página
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.onerror = () => {
        // Remove o script e o callback em caso de erro
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        delete window[callbackName];
        reject(new Error('Falha na requisição JSONP para upload de imagem'));
      };
      
      // Adiciona o script no DOM para iniciar a requisição
      document.head.appendChild(script);
      
      // Define um timeout para evitar callbacks pendentes
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          reject(new Error('Timeout na requisição de upload de imagem'));
        }
      }, 30000); // 30 segundos de timeout
    });
  }
  
  /**
   * Processa e redimensiona uma imagem antes do upload
   * @param {File|Blob} file - Arquivo de imagem
   * @param {Object} options - Opções de processamento
   * @returns {Promise<string>} DataURL da imagem processada
   */
  function processarImagem(file, options = {}) {
    return new Promise((resolve, reject) => {
      // Valores padrão
      const defaults = {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
        format: 'jpeg'
      };
      
      // Mescla opções
      const settings = { ...defaults, ...options };
      
      // Verifica se o arquivo é de imagem
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('Arquivo inválido. Somente imagens são aceitas.'));
      }
      
      // Cria um objeto URL para a imagem
      const objectUrl = URL.createObjectURL(file);
      
      // Cria um elemento de imagem para carregar a imagem
      const img = new Image();
      
      img.onload = function() {
        // Libera o objeto URL 
        URL.revokeObjectURL(objectUrl);
        
        // Calcula dimensões preservando proporção
        let width = img.width;
        let height = img.height;
        
        if (width > settings.maxWidth) {
          const ratio = settings.maxWidth / width;
          width = settings.maxWidth;
          height = height * ratio;
        }
        
        if (height > settings.maxHeight) {
          const ratio = settings.maxHeight / height;
          height = settings.maxHeight;
          width = width * ratio;
        }
        
        // Cria um canvas para redimensionar
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Desenha a imagem no canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Converte para DataURL
        const mimeType = `image/${settings.format}`;
        const dataUrl = canvas.toDataURL(mimeType, settings.quality);
        
        resolve(dataUrl);
      };
      
      img.onerror = function() {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Erro ao carregar imagem para processamento'));
      };
      
      // Inicia o carregamento da imagem
      img.src = objectUrl;
    });
  }
  
  /**
   * Faz upload de uma imagem para uma manutenção
   * @param {string} manutencaoId - ID da manutenção
   * @param {File|Blob} fileOrBlob - Arquivo ou Blob da imagem
   * @param {Object} options - Opções de processamento
   * @returns {Promise<Object>} Resultado do upload
   */
  async function uploadImagem(manutencaoId, fileOrBlob, options = {}) {
    try {
      // Processa a imagem antes do upload
      const dataUrl = await processarImagem(fileOrBlob, options);
      
      // Tenta fazer upload da imagem usando JSONP
      return await uploadImageViaJSONP(manutencaoId, dataUrl);
    } catch (error) {
      console.error('Erro no upload de imagem:', error);
      throw error;
    }
  }
  
  /**
   * Captura imagem da webcam
   * @returns {Promise<Blob>} Blob da imagem capturada
   */
  function capturarImagemWebcam() {
    return new Promise((resolve, reject) => {
      // Cria elementos de vídeo e canvas para captura
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      let stream = null;
      
      // Configuração de vídeo
      video.autoplay = true;
      video.setAttribute('playsinline', true); // Necessário para iOS
      
      // Solicitação de acesso à câmera
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((mediaStream) => {
          stream = mediaStream;
          video.srcObject = mediaStream;
          
          // Espera o vídeo carregar
          video.onloadedmetadata = () => {
            // Define dimensões do canvas baseado no vídeo
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Captura um frame
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0);
            
            // Converte para blob
            canvas.toBlob((blob) => {
              // Interrompe o stream da câmera
              const tracks = stream.getTracks();
              tracks.forEach(track => track.stop());
              
              resolve(blob);
            }, 'image/jpeg', 0.9);
          };
        })
        .catch(error => {
          console.error('Erro ao acessar câmera:', error);
          reject(new Error(`Não foi possível acessar a câmera: ${error.message}`));
        });
    });
  }

  // API pública
  return {
    init,
    uploadImagem,
    processarImagem,
    capturarImagemWebcam,
    uploadImageViaJSONP
  };
});
