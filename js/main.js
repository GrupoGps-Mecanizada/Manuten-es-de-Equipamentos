/**
 * Sistema de Manutenção de Equipamentos - Main.js
 * Arquivo principal para inicialização do sistema
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('Inicializando Sistema de Manutenção de Equipamentos...');
  
  // Inicializar módulos core
  initCoreModules()
    .then(() => initUIModules())
    .then(() => initFeatureModules())
    .then(() => {
      // Inicializar aplicação principal após carregar todos os módulos
      if (typeof initApp === 'function') {
        initApp();
      } else {
        console.error('Função initApp não encontrada. Verifique app.js');
      }
      
      console.log('Sistema inicializado com sucesso!');
    })
    .catch(error => {
      console.error('Erro na inicialização do sistema:', error);
      showErrorMessage('Ocorreu um erro ao inicializar o sistema. Por favor, recarregue a página.');
    });
});

// Inicializar módulos core
async function initCoreModules() {
  console.log('Inicializando módulos core...');
  
  // Inicializar ModuleLoader (já deve estar disponível globalmente)
  if (!window.ModuleLoader) {
    throw new Error('ModuleLoader não encontrado. Verifique a inclusão do script module-loader.js');
  }
  
  // Inicializar módulos principais na ordem correta
  ModuleLoader.initialize('state');
  ModuleLoader.initialize('cacheManager');
  ModuleLoader.initialize('performanceMonitor');
  ModuleLoader.initialize('security');
  
  // Verificar se os módulos foram inicializados com sucesso
  const requiredModules = ['state', 'cacheManager', 'performanceMonitor', 'security'];
  for (const module of requiredModules) {
    if (!ModuleLoader.isInitialized(module)) {
      console.warn(`Módulo ${module} não foi inicializado corretamente.`);
    }
  }
  
  // Configurar estado global
  setupAppState();
}

// Inicializar módulos de UI
async function initUIModules() {
  console.log('Inicializando módulos de UI...');
  
  // Inicializar tema
  ModuleLoader.initialize('themeManager');
  
  // Inicializar melhorias responsivas
  ModuleLoader.initialize('responsiveUI');
}

// Inicializar módulos de features
async function initFeatureModules() {
  console.log('Inicializando módulos de features...');
  
  // Inicializar notificações
  ModuleLoader.initialize('notifications');
  
  // Inicializar autenticação Google (se configurado)
  if (window.CONFIG && (CONFIG.GOOGLE_CLIENT_ID || CONFIG.AUTH_REQUIRED)) {
    ModuleLoader.initialize('googleAuth');
    
    // Configurar evento para inicializar dashboard após login bem-sucedido
    document.addEventListener('googleAuthChanged', handleAuthChange);
  }
  
  // Inicializar gerenciador de fotos
  ModuleLoader.initialize('photoHandler');
  
  // Inicializar dashboard (pode ser condicionado ao estado de autenticação)
  // Verifica se o usuário está autenticado antes de carregar
  const googleAuth = ModuleLoader.get('googleAuth');
  if (!googleAuth || googleAuth.isAuthenticated()) {
    ModuleLoader.initialize('dashboard');
  }
  
  // Melhorar funções globais com os módulos
  enhanceGlobalFunctions();
}

// Configurar estado global
function setupAppState() {
  const AppState = ModuleLoader.get('state');
  if (!AppState) return;
  
  // Carregar estados iniciais do cache
  const CacheManager = ModuleLoader.get('cacheManager');
  if (CacheManager) {
    const savedRegistros = CacheManager.getItem('registros');
    const savedConfig = CacheManager.getItem('config');
    
    if (savedRegistros) AppState.update('registros', savedRegistros);
    if (savedConfig) AppState.update('config', savedConfig);
  }
  
  // Configurar eventos para salvar estados no cache
  AppState.subscribe('registros', (registros) => {
    if (CacheManager) CacheManager.setItem('registros', registros);
  });
  
  AppState.subscribe('config', (config) => {
    if (CacheManager) CacheManager.setItem('config', config);
  });
  
  // Monitorar status de conexão
  window.addEventListener('online', () => {
    AppState.update('online', true);
    const Notifications = ModuleLoader.get('notifications');
    if (Notifications) Notifications.info('Conexão restabelecida');
  });
  
  window.addEventListener('offline', () => {
    AppState.update('online', false);
    const Notifications = ModuleLoader.get('notifications');
    if (Notifications) Notifications.warning('Sem conexão. Operando no modo offline');
  });
}

// Manipular mudanças de autenticação
function handleAuthChange(event) {
  const { isAuthorized, user } = event.detail;
  
  if (isAuthorized && user) {
    // Usuário logado, inicializar dashboard
    if (!ModuleLoader.isInitialized('dashboard')) {
      ModuleLoader.initialize('dashboard');
    }
    
    // Atualizar UI para mostrar recursos que exigem autenticação
    document.querySelectorAll('.requires-auth').forEach(el => {
      el.classList.remove('d-none');
    });
  } else {
    // Usuário deslogado, atualizar UI
    document.querySelectorAll('.requires-auth').forEach(el => {
      el.classList.add('d-none');
    });
  }
}

// Melhorar funções globais com módulos
function enhanceGlobalFunctions() {
  // Melhorar função de mostrar notificação
  if (typeof window.showNotification === 'function') {
    const originalShowNotification = window.showNotification;
    window.showNotification = function(message, type = 'info') {
      const Notifications = ModuleLoader.get('notifications');
      if (Notifications) {
        return Notifications.show(message, type);
      } else {
        return originalShowNotification(message, type);
      }
    };
  }
  
  // Adicionar função de notificação se não existir
  if (typeof window.showNotification !== 'function') {
    window.showNotification = function(message, type = 'info') {
      const Notifications = ModuleLoader.get('notifications');
      if (Notifications) {
        return Notifications.show(message, type);
      } else {
        alert(message);
        return null;
      }
    };
  }
  
  // Alias para métodos de notificação
  window.showSuccessMessage = (message) => window.showNotification(message, 'success');
  window.showErrorMessage = (message) => window.showNotification(message, 'error');
  window.showWarningMessage = (message) => window.showNotification(message, 'warning');
  window.showInfoMessage = (message) => window.showNotification(message, 'info');
}
