/**
 * Sistema de Notificações
 * Fornece mecanismo para exibir mensagens ao usuário
 */
ModuleLoader.register('notifications', function() {
  // Configurações
  const CONFIG = {
    position: 'top-right',  // top-right, top-left, bottom-right, bottom-left, top-center, bottom-center
    duration: 5000,         // Duração padrão (ms)
    maxNotifications: 5,    // Máximo de notificações simultâneas
    animationDuration: 300, // Duração das animações (ms)
    icons: {
      success: '<i class="bi bi-check-circle-fill"></i>',
      info: '<i class="bi bi-info-circle-fill"></i>',
      warning: '<i class="bi bi-exclamation-triangle-fill"></i>',
      error: '<i class="bi bi-x-circle-fill"></i>'
    }
  };
  
  // Lista de notificações ativas
  const activeNotifications = [];
  
  // ID para o container de notificações
  const CONTAINER_ID = 'notifications-container';
  
  // Inicialização
  function init() {
    console.log('Inicializando sistema de notificações...');
    
    // Criar container de notificações se não existir
    createNotificationsContainer();
    
    // Adicionar estilos CSS
    addNotificationStyles();
    
    console.log('Sistema de notificações inicializado com sucesso');
  }
  
  // Criar container para notificações
  function createNotificationsContainer() {
    if (document.getElementById(CONTAINER_ID)) {
      return; // Container já existe
    }
    
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'notifications-container';
    
    // Posicionar baseado na configuração
    const pos = CONFIG.position.split('-');
    if (pos.length === 2) {
      container.style[pos[0]] = '20px'; // top ou bottom
      container.style[pos[1]] = '20px'; // left, right ou center
      
      if (pos[1] === 'center') {
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
      }
    }
    
    document.body.appendChild(container);
  }
  
  // Adicionar estilos CSS para as notificações
  function addNotificationStyles() {
    if (document.getElementById('notification-styles')) {
      return; // Estilos já existem
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'notification-styles';
    styleElement.textContent = `
      .notifications-container {
        position: fixed;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 320px;
        pointer-events: none;
      }
      
      .notification {
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 10px;
        opacity: 0;
        transform: translateX(50px);
        transition: opacity ${CONFIG.animationDuration}ms ease, transform ${CONFIG.animationDuration}ms ease;
        display: flex;
        align-items: center;
        pointer-events: auto;
        overflow: hidden;
        position: relative;
      }
      
      .notification.show {
        opacity: 1;
        transform: translateX(0);
      }
      
      .notification.hide {
        opacity: 0;
        transform: translateX(50px);
      }
      
      .notification-icon {
        margin-right: 12px;
        font-size: 20px;
        flex-shrink: 0;
      }
      
      .notification-content {
        flex-grow: 1;
        font-size: 14px;
      }
      
      .notification-close {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        opacity: 0.7;
        font-size: 16px;
        padding: 0;
        margin-left: 10px;
        transition: opacity 0.2s;
      }
      
      .notification-close:hover {
        opacity: 1;
      }
      
      .notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        width: 100%;
        transform-origin: left;
      }
      
      .notification-success {
        background-color: #d4edda;
        color: #155724;
        border-left: 4px solid #28a745;
      }
      
      .notification-success .notification-progress {
        background-color: #28a745;
      }
      
      .notification-info {
        background-color: #d1ecf1;
        color: #0c5460;
        border-left: 4px solid #17a2b8;
      }
      
      .notification-info .notification-progress {
        background-color: #17a2b8;
      }
      
      .notification-warning {
        background-color: #fff3cd;
        color: #856404;
        border-left: 4px solid #ffc107;
      }
      
      .notification-warning .notification-progress {
        background-color: #ffc107;
      }
      
      .notification-error {
        background-color: #f8d7da;
        color: #721c24;
        border-left: 4px solid #dc3545;
      }
      
      .notification-error .notification-progress {
        background-color: #dc3545;
      }
      
      @media (max-width: 576px) {
        .notifications-container {
          width: calc(100% - 40px);
          max-width: 100%;
        }
      }
      
      /* Dark mode styles */
      body.dark-mode .notification-success {
        background-color: rgba(40, 167, 69, 0.2);
        color: #83e5a1;
      }
      
      body.dark-mode .notification-info {
        background-color: rgba(23, 162, 184, 0.2);
        color: #8ddbeb;
      }
      
      body.dark-mode .notification-warning {
        background-color: rgba(255, 193, 7, 0.2);
        color: #ffdf7f;
      }
      
      body.dark-mode .notification-error {
        background-color: rgba(220, 53, 69, 0.2);
        color: #f5b4bb;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
  
  /**
   * Mostrar uma notificação
   * @param {string} message - Mensagem a ser exibida
   * @param {string} type - Tipo de notificação: success, info, warning, error
   * @param {Object} options - Opções adicionais
   */
  function show(message, type = 'info', options = {}) {
    // Validar tipo
    if (!['success', 'info', 'warning', 'error'].includes(type)) {
      type = 'info';
    }
    
    // Mesclar opções com padrões
    const settings = {
      duration: options.duration || CONFIG.duration,
      dismissible: options.hasOwnProperty('dismissible') ? options.dismissible : true,
      showProgress: options.hasOwnProperty('showProgress') ? options.showProgress : true,
      onClose: options.onClose || null
    };
    
    // Verificar limite de notificações
    if (activeNotifications.length >= CONFIG.maxNotifications) {
      // Remover a notificação mais antiga
      if (activeNotifications.length > 0) {
        const oldestId = activeNotifications[0];
        removeNotification(oldestId);
      }
    }
    
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.role = 'alert';
    
    // Gerar ID único
    const id = `notification-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    notification.id = id;
    
    // Estrutura interna
    notification.innerHTML = `
      <div class="notification-icon">${CONFIG.icons[type]}</div>
      <div class="notification-content">${message}</div>
      ${settings.dismissible ? '<button type="button" class="notification-close" aria-label="Fechar">&times;</button>' : ''}
      ${settings.showProgress ? '<div class="notification-progress"></div>' : ''}
    `;
    
    // Adicionar ao container
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      container.appendChild(notification);
      
      // Força um reflow/repaint
      void notification.offsetWidth;
      
      // Animar entrada
      notification.classList.add('show');
      
      // Configurar barra de progresso
      if (settings.showProgress && settings.duration > 0) {
        const progressBar = notification.querySelector('.notification-progress');
        if (progressBar) {
          progressBar.style.transition = `transform ${settings.duration}ms linear`;
          progressBar.style.transform = 'scaleX(0)';
          
          // Forçar reflow/repaint
          void progressBar.offsetWidth;
          
          // Iniciar animação
          progressBar.style.transform = 'scaleX(1)';
        }
      }
      
      // Adicionar evento de clique para fechar
      if (settings.dismissible) {
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
          closeButton.addEventListener('click', function() {
            removeNotification(id);
          });
        }
      }
      
      // Adicionar à lista de ativos
      activeNotifications.push(id);
      
      // Configurar remoção automática
      if (settings.duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, settings.duration);
      }
    }
    
    return id;
  }
  
  /**
   * Remover uma notificação
   * @param {string} id - ID da notificação
   */
  function removeNotification(id) {
    const notification = document.getElementById(id);
    if (!notification) return;
    
    // Animar saída
    notification.classList.remove('show');
    notification.classList.add('hide');
    
    // Remover após a animação
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      
      // Remover da lista de ativos
      const index = activeNotifications.indexOf(id);
      if (index !== -1) {
        activeNotifications.splice(index, 1);
      }
    }, CONFIG.animationDuration);
  }
  
  /**
   * Remover todas as notificações
   */
  function clearAll() {
    // Copiar array para evitar problemas ao remover itens
    const notifications = [...activeNotifications];
    
    // Remover cada notificação
    notifications.forEach(id => {
      removeNotification(id);
    });
  }
  
  // Métodos de conveniência
  function success(message, options) {
    return show(message, 'success', options);
  }
  
  function info(message, options) {
    return show(message, 'info', options);
  }
  
  function warning(message, options) {
    return show(message, 'warning', options);
  }
  
  function error(message, options) {
    return show(message, 'error', options);
  }
  
  // Exportar funções públicas
  return {
    init,
    show,
    success,
    info,
    warning,
    error,
    clearAll,
    removeNotification
  };
});
