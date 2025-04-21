/**
 * Sistema de Autenticação Google
 * Implementa login com Google e acesso à API Sheets
 */
ModuleLoader.register('googleAuth', function() {
  // Configurações
  const CONFIG = {
    clientId: '',      // Será preenchido com config.js
    apiKey: '',        // Será preenchido com config.js 
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'profile',
      'email'
    ],
    discoveryDocs: [
      'https://sheets.googleapis.com/$discovery/rest?version=v4',
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],
    cookieName: 'manutencao_auth'
  };
  
  // Estado
  let isInitialized = false;
  let isAuthorized = false;
  let tokenClient = null;
  let currentUser = null;
  
  // Inicialização
  async function init() {
    console.log('Inicializando Google Auth...');
    
    // Obter configurações do config global
    if (window.CONFIG) {
      CONFIG.clientId = window.CONFIG.GOOGLE_CLIENT_ID || CONFIG.clientId;
      CONFIG.apiKey = window.CONFIG.API_KEY || CONFIG.apiKey;
    }
    
    /**
 * Sistema de Autenticação Google
 * Implementa login com Google e acesso à API Sheets
 */
ModuleLoader.register('googleAuth', function() {
  // Configurações
  const CONFIG = {
    clientId: '',      // Será preenchido com config.js
    apiKey: '',        // Será preenchido com config.js 
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'profile',
      'email'
    ],
    discoveryDocs: [
      'https://sheets.googleapis.com/$discovery/rest?version=v4',
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],
    cookieName: 'manutencao_auth'
  };
  
  // Estado
  let isInitialized = false;
  let isAuthorized = false;
  let tokenClient = null;
  let currentUser = null;
  
  // Inicialização
  async function init() {
    console.log('Inicializando Google Auth...');
    
    // Obter configurações do config global
    if (window.CONFIG) {
      CONFIG.clientId = window.CONFIG.GOOGLE_CLIENT_ID || CONFIG.clientId;
      CONFIG.apiKey = window.CONFIG.API_KEY || CONFIG.apiKey;
    }
    
    if (!CONFIG.clientId || !CONFIG.apiKey) {
      console.warn('Google Auth: Client ID ou API Key não configurados');
      return;
    }
    
    try {
      // Carregar as bibliotecas do Google
      await loadGoogleLibraries();
      
      // Inicializar o cliente
      await initGoogleClient();
      
      // Verificar estado de autenticação inicial
      checkAuthStatus();
      
      // Adicionar botão de login/logout à UI se existir container
      addLoginButton();
      
      isInitialized = true;
      console.log('Google Auth inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar Google Auth:', error);
      
      // Notificar erro se o sistema de notificações estiver disponível
      const Notifications = ModuleLoader.get('notifications');
      if (Notifications) {
        Notifications.error('Erro ao inicializar autenticação Google. Algumas funcionalidades podem estar indisponíveis.');
      }
    }
  }
  
  // Carregar bibliotecas do Google
  async function loadGoogleLibraries() {
    // Verificar se já estão carregadas
    if (window.gapi && window.google) {
      return;
    }
    
    // Carregar gapi
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    
    // Carregar client do Google Identity
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // Inicializar cliente Google
  async function initGoogleClient() {
    // Carregar cliente gapi
    await new Promise((resolve, reject) => {
      gapi.load('client', { callback: resolve, onerror: reject });
    });
    
    // Inicializar cliente gapi
    await gapi.client.init({
      apiKey: CONFIG.apiKey,
      discoveryDocs: CONFIG.discoveryDocs
    });
    
    // Criar cliente de token para autenticação OAuth
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.clientId,
      scope: CONFIG.scopes.join(' '),
      callback: handleAuthResponse
    });
  }
  
  // Verificar status de autenticação
  function checkAuthStatus() {
    // Verificar se temos um token armazenado
    const tokenData = getTokenFromStorage();
    
    if (tokenData && tokenData.expires_at > Date.now()) {
      // Token válido, configurar no cliente e atualizar estado
      gapi.client.setToken(tokenData);
      isAuthorized = true;
      
      // Carregar informações do usuário
      loadUserInfo();
      
      return true;
    }
    
    // Sem token válido
    isAuthorized = false;
    return false;
  }
  
  // Manipular resposta de autenticação
  function handleAuthResponse(tokenResponse) {
    if (tokenResponse && tokenResponse.access_token) {
      // Adicionar timestamp de expiração e salvar
      tokenResponse.expires_at = Date.now() + (tokenResponse.expires_in * 1000);
      saveTokenToStorage(tokenResponse);
      
      isAuthorized = true;
      
      // Carregar informações do usuário
      loadUserInfo();
      
      // Atualizar UI
      updateLoginButton();
      
      // Disparar evento de login
      const event = new CustomEvent('googleAuthChanged', { 
        detail: { isAuthorized: true, user: currentUser } 
      });
      document.dispatchEvent(event);
      
      // Notificar sucesso
      const Notifications = ModuleLoader.get('notifications');
      if (Notifications) {
        Notifications.success('Login Google realizado com sucesso');
      }
    } else {
      console.error('Erro de autenticação:', tokenResponse);
      isAuthorized = false;
      
      // Notificar erro
      const Notifications = ModuleLoader.get('notifications');
      if (Notifications) {
        Notifications.error('Falha na autenticação Google');
      }
    }
  }
  
  // Salvar token no armazenamento local
  function saveTokenToStorage(tokenData) {
    // Usar localStorage para simplicidade
    localStorage.setItem(CONFIG.cookieName, JSON.stringify(tokenData));
  }
  
  // Obter token do armazenamento local
  function getTokenFromStorage() {
    try {
      const data = localStorage.getItem(CONFIG.cookieName);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Erro ao ler token do storage:', e);
      return null;
    }
  }
  
  // Remover token do armazenamento
  function removeTokenFromStorage() {
    localStorage.removeItem(CONFIG.cookieName);
  }
  
  // Carregar informações do usuário
  async function loadUserInfo() {
    if (!isAuthorized) return null;
    
    try {
      // Fazer requisição para API de usuário
      const response = await gapi.client.request({
        path: 'https://www.googleapis.com/oauth2/v3/userinfo'
      });
      
      if (response.result) {
        currentUser = {
          id: response.result.sub,
          name: response.result.name,
          email: response.result.email,
          picture: response.result.picture
        };
        
        // Atualizar estado global
        if (window.AppState) {
          AppState.update('currentUser', currentUser);
          AppState.update('isAuthenticated', true);
        }
        
        // Atualizar UI
        updateUserDisplay();
        
        return currentUser;
      }
    } catch (error) {
      console.error('Erro ao obter informações do usuário:', error);
    }
    
    return null;
  }
  
  // Iniciar processo de login
  function login() {
    if (!isInitialized) {
      console.error('Google Auth não foi inicializado corretamente');
      return;
    }
    
    if (isAuthorized) {
      console.log('Usuário já está autenticado');
      return;
    }
    
    // Mostrar prompt de autenticação
    tokenClient.requestAccessToken({
      prompt: 'consent'
    });
  }
  
  // Deslogar usuário
  function logout() {
    // Revogar token atual
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        console.log('Token revogado com sucesso');
      });
      gapi.client.setToken('');
    }
    
    // Limpar estado
    isAuthorized = false;
    currentUser = null;
    removeTokenFromStorage();
    
    // Atualizar estado global
    if (window.AppState) {
      AppState.update('currentUser', null);
      AppState.update('isAuthenticated', false);
    }
    
    // Atualizar UI
    updateLoginButton();
    removeUserDisplay();
    
    // Disparar evento de logout
    const event = new CustomEvent('googleAuthChanged', { 
      detail: { isAuthorized: false, user: null } 
    });
    document.dispatchEvent(event);
    
    // Notificar logout
    const Notifications = ModuleLoader.get('notifications');
    if (Notifications) {
      Notifications.info('Logout realizado com sucesso');
    }
  }
  
  // Adicionar botão de login à UI
  function addLoginButton() {
    const container = document.querySelector('.navbar-nav') || 
                     document.querySelector('header .actions') ||
                     document.querySelector('header');
    
    if (!container) {
      console.warn('Container para botão de login não encontrado');
      return;
    }
    
    // Verificar se o botão já existe
    if (document.getElementById('google-login-btn')) {
      return;
    }
    
    // Criar botão
    const button = document.createElement('button');
    button.id = 'google-login-btn';
    button.className = 'btn btn-sm btn-outline-primary ms-2';
    button.innerHTML = '<i class="bi bi-google"></i> Login';
    button.onclick = () => isAuthorized ? logout() : login();
    
    container.appendChild(button);
    
    // Atualizar estado do botão
    updateLoginButton();
  }
  
  // Atualizar botão de login/logout
  function updateLoginButton() {
    const button = document.getElementById('google-login-btn');
    if (!button) return;
    
    if (isAuthorized) {
      button.innerHTML = '<i class="bi bi-box-arrow-right"></i> Logout';
      button.className = 'btn btn-sm btn-outline-danger ms-2';
    } else {
      button.innerHTML = '<i class="bi bi-google"></i> Login';
      button.className = 'btn btn-sm btn-outline-primary ms-2';
    }
  }
  
  // Atualizar exibição do usuário
  function updateUserDisplay() {
    if (!currentUser) return;
    
    // Remover display antigo se existir
    removeUserDisplay();
    
    const container = document.querySelector('.navbar-nav') || 
                     document.querySelector('header .actions') ||
                     document.querySelector('header');
    
    if (!container) return;
    
    // Criar display de usuário
    const userDisplay = document.createElement('div');
    userDisplay.id = 'user-display';
    userDisplay.className = 'd-flex align-items-center ms-3';
    
    userDisplay.innerHTML = `
      <img src="${currentUser.picture}" alt="${currentUser.name}" class="user-avatar rounded-circle" width="32" height="32">
      <span class="user-name ms-2 d-none d-md-inline">${currentUser.name}</span>
    `;
    
    // Adicionar antes do botão de login
    const loginButton = document.getElementById('google-login-btn');
    if (loginButton) {
      container.insertBefore(userDisplay, loginButton);
    } else {
      container.appendChild(userDisplay);
    }
  }
  
  // Remover display de usuário
  function removeUserDisplay() {
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
      userDisplay.parentNode.removeChild(userDisplay);
    }
  }
  
  // Verificar se está autenticado
  function isAuthenticated() {
    return isAuthorized && !!currentUser;
  }
  
  // Obter usuário atual
  function getUser() {
    return currentUser;
  }
  
  // Acesso à API do Google Sheets
  async function createSpreadsheet(title) {
    if (!isAuthorized) {
      throw new Error('Usuário não está autenticado');
    }
    
    try {
      const response = await gapi.client.sheets.spreadsheets.create({
        properties: {
          title: title
        }
      });
      
      return response.result;
    } catch (error) {
      console.error('Erro ao criar planilha:', error);
      throw error;
    }
  }
  
  // Retornar métodos públicos
  return {
    init,
    login,
    logout,
    isAuthenticated,
    getUser,
    createSpreadsheet
  };
});
