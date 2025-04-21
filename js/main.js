/**
 * Sistema de Manutenção de Equipamentos - Main.js
 * Arquivo principal para inicialização do sistema
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('Inicializando Sistema de Manutenção de Equipamentos...');

  // Garantir que o ModuleLoader esteja pronto
  if (!window.ModuleLoader) {
     console.error('CRITICAL: ModuleLoader não encontrado. A aplicação não pode iniciar.');
     showErrorMessage('Erro crítico ao carregar componentes principais. Recarregue a página.');
     return;
  }

  // Inicializar módulos core
  initCoreModules()
    .then(initUIModules) // Encadeia as promessas diretamente
    .then(initFeatureModules)
    .then(() => {
      console.log('Todos os módulos básicos inicializados. Iniciando App...');
      // Inicializar aplicação principal após carregar todos os módulos
      // Verifica se App e App.init existem antes de chamar
      if (typeof App !== 'undefined' && typeof App.init === 'function') {
        // App.init agora é responsável por buscar os módulos que precisa
        return App.init(); // Retorna a promise de App.init se for async
      } else {
        console.error('Objeto App ou App.init não encontrado. Verifique app.js e a ordem de carregamento.');
        throw new Error('App principal não pode ser inicializado.'); // Lança erro para cair no catch
      }
    })
    .then(() => {
       // Este .then() será executado após App.init() completar (se App.init for async)
       console.log('Sistema inicializado com sucesso!');
       // Remover spinner de loading inicial, se houver
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    })
    .catch(error => {
      console.error('Erro na sequência de inicialização do sistema:', error);
      showErrorMessage(`Ocorreu um erro grave ao inicializar o sistema: ${error.message}. Por favor, recarregue a página.`);
      // Mostrar spinner de erro ou mensagem mais visível
       const loadingSpinner = document.getElementById('loadingSpinner');
       if (loadingSpinner) {
          loadingSpinner.innerHTML = '<div class="alert alert-danger">Erro ao carregar! Recarregue.</div>';
          loadingSpinner.style.display = 'flex'; // Garante que está visível
       }
    });
});

// Inicializar módulos core
async function initCoreModules() {
  console.log('Inicializando módulos core...');

  // ModuleLoader já verificado no listener principal

  // Inicializar módulos principais (ModuleLoader.initialize é síncrono)
  // A ordem aqui pode importar se houver dependências entre eles
  try {
     ModuleLoader.initialize('state');
     ModuleLoader.initialize('cacheManager'); // Pode depender de state
     ModuleLoader.initialize('performanceMonitor');
     ModuleLoader.initialize('security'); // Pode depender de Utils
  } catch (e) {
     console.error("Erro ao inicializar módulo core:", e);
     throw e; // Propaga o erro para o catch principal
  }


  // Verificar se os módulos foram inicializados com sucesso (opcional, initialize já loga erros)
  // const requiredModules = ['state', 'cacheManager', 'performanceMonitor', 'security'];
  // for (const moduleName of requiredModules) {
  //   if (!ModuleLoader.isInitialized(moduleName)) {
  //     console.warn(`Módulo core ${moduleName} não foi inicializado corretamente.`);
       // Poderia lançar erro aqui se forem críticos
  //   }
  // }

  // Configurar estado global (exemplo, pode ser movido para onde fizer mais sentido)
  setupAppState();
}

// Inicializar módulos de UI
async function initUIModules() {
  console.log('Inicializando módulos de UI...');
  try {
     ModuleLoader.initialize('themeManager'); // Módulo de tema
     // ModuleLoader.initialize('responsiveUI'); // Removido pois não existe
  } catch (e) {
      console.error("Erro ao inicializar módulo de UI:", e);
      // Decidir se continua ou lança erro
  }

}

// Inicializar módulos de features
async function initFeatureModules() {
  console.log('Inicializando módulos de features...');

   try {
       ModuleLoader.initialize('notifications'); // Notificações primeiro?

       // Inicializar autenticação Google (se configurado)
       // Assume CONFIG global está disponível via config.js carregado antes
       if (window.CONFIG && (window.CONFIG.GOOGLE_CLIENT_ID || window.CONFIG.AUTH_REQUIRED)) {
         ModuleLoader.initialize('googleAuth'); // Pode ser async internamente

         // Configurar evento para reagir a mudanças de login (ex: carregar dashboard)
         document.addEventListener('googleAuthChanged', handleAuthChange);
       } else {
          console.log("Autenticação Google não configurada ou não requerida.");
       }

       ModuleLoader.initialize('photoHandler'); // Gerenciador de fotos
       ModuleLoader.initialize('formHandler'); // Gerenciador de formulários (depende de photoHandler?)

       // Inicializar dashboard
       // A lógica de quando inicializar pode depender de autenticação
       // handleAuthChange pode ser responsável por inicializar o dashboard
       // Ou inicializa aqui e o dashboard se adapta ao estado de login
       ModuleLoader.initialize('dashboard');

       // Melhorar funções globais (como showNotification) com os módulos
       enhanceGlobalFunctions();

   } catch(e) {
      console.error("Erro ao inicializar módulo de feature:", e);
      // Decidir se continua ou lança erro
   }

}

// Configurar estado global inicial e listeners
function setupAppState() {
  const AppState = ModuleLoader.get('state');
  if (!AppState) {
     console.warn("Módulo State não disponível para setupAppState.");
     return;
  }

  const CacheManager = ModuleLoader.get('cacheManager');

  // Carregar estados iniciais do cache (se CacheManager existir)
  if (CacheManager) {
    const savedRegistros = CacheManager.getItem('registros');
    const savedConfig = CacheManager.getItem('config');
    // Define apenas se encontrou algo no cache
    if (savedRegistros) AppState.update('registros', savedRegistros, true); // true = silent update?
    if (savedConfig) AppState.update('config', savedConfig, true);
    console.log("Estado inicial carregado do cache (se existia).");
  }

  // Configurar listeners para salvar estados no cache quando mudarem
  AppState.subscribe('registros', (registros) => {
    if (CacheManager) {
       console.log("Salvando 'registros' no cache...");
       CacheManager.setItem('registros', registros);
    }
  });

  AppState.subscribe('config', (config) => {
    if (CacheManager) {
       console.log("Salvando 'config' no cache...");
       CacheManager.setItem('config', config);
    }
  });

  // Monitorar status de conexão e atualizar estado
  const updateOnlineStatus = () => {
     const online = navigator.onLine;
     AppState.update('online', online);
     console.log(`Status da conexão atualizado para: ${online ? 'Online' : 'Offline'}`);
     const Notifications = ModuleLoader.get('notifications');
     if(Notifications) {
        if(online) {
           // Notifica apenas se estava offline antes? Ou sempre?
           // Notifications.success('Conexão com a internet restabelecida.');
        } else {
           Notifications.warning('Sem conexão com a internet. Algumas funcionalidades podem estar limitadas.');
        }
     }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus(); // Define o estado inicial
}

// Manipular mudanças de autenticação (ex: mostrar/ocultar itens, carregar dashboard)
function handleAuthChange(event) {
  const { isAuthorized, user } = event.detail;
  console.log(`Evento googleAuthChanged recebido: Autorizado=${isAuthorized}`);

  const AppState = ModuleLoader.get('state');
  if (AppState) {
     AppState.update('isAuthenticated', isAuthorized);
     AppState.update('currentUser', user);
  }


  if (isAuthorized && user) {
    // Usuário logado
    console.log(`Usuário ${user.name} logado.`);

    // Inicializar ou atualizar dashboard se ele depende de login
    const Dashboard = ModuleLoader.get('dashboard');
    if (Dashboard && Dashboard.refreshData) { // Verifica se o dashboard tem um método para atualizar
        console.log("Atualizando dashboard após login...");
        Dashboard.refreshData(); // Exemplo de método para recarregar dados
    } else if (Dashboard && !ModuleLoader.isInitialized('dashboard')) {
        // Se o dashboard não foi inicializado antes (ex: em initFeatureModules)
        // ModuleLoader.initialize('dashboard'); // Cuidado com inicialização dupla
        console.warn("Dashboard deveria ter sido inicializado antes, ou precisa de método refreshData.");
    }


    // Mostrar elementos da UI que exigem autenticação
    document.querySelectorAll('.requires-auth').forEach(el => {
      el.classList.remove('d-none');
      el.style.display = ''; // Garante visibilidade
    });
    document.querySelectorAll('.hides-on-auth').forEach(el => {
      el.classList.add('d-none');
    });

  } else {
    // Usuário deslogado ou falha no login
    console.log("Usuário deslogado ou autenticação falhou.");

     // Limpar dados do dashboard se necessário
     const Dashboard = ModuleLoader.get('dashboard');
     if (Dashboard && Dashboard.clearData) {
         Dashboard.clearData(); // Exemplo
     }

    // Ocultar elementos da UI que exigem autenticação
    document.querySelectorAll('.requires-auth').forEach(el => {
      el.classList.add('d-none');
    });
     document.querySelectorAll('.hides-on-auth').forEach(el => {
      el.classList.remove('d-none');
       el.style.display = '';
    });
  }
}

// Melhorar funções globais com módulos (ex: notificações)
function enhanceGlobalFunctions() {
  const Notifications = ModuleLoader.get('notifications');

  // Sobrescreve ou cria funções globais de notificação se o módulo existe
  if (Notifications) {
    console.log("Melhorando funções globais de notificação.");
    window.showNotification = (message, type = 'info', duration) => Notifications.show(message, type, duration);
    window.showSuccessMessage = (message, duration) => Notifications.success(message, duration);
    window.showErrorMessage = (message, duration) => Notifications.error(message, duration);
    window.showWarningMessage = (message, duration) => Notifications.warning(message, duration);
    window.showInfoMessage = (message, duration) => Notifications.info(message, duration);
  } else {
     // Fallback se o módulo de notificações falhar
     console.warn("Módulo Notifications não encontrado, usando alert para mensagens.");
     if (typeof window.showNotification !== 'function') {
        window.showNotification = (message, type = 'info') => alert(`[${type.toUpperCase()}] ${message}`);
        window.showSuccessMessage = (message) => alert(`[SUCCESS] ${message}`);
        window.showErrorMessage = (message) => alert(`[ERROR] ${message}`);
        window.showWarningMessage = (message) => alert(`[WARNING] ${message}`);
        window.showInfoMessage = (message) => alert(`[INFO] ${message}`);
     }
  }
}
