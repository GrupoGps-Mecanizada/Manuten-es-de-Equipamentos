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

    // ------ INÍCIO DO CÓDIGO DUPLICADO REMOVIDO ------
    // O bloco que começava com /** Sistema de Autenticação Google */ e
    // ModuleLoader.register('googleAuth', function() { foi removido daqui.
    // ------ FIM DO CÓDIGO DUPLICADO REMOVIDO ------


    if (!CONFIG.clientId || !CONFIG.apiKey) {
      console.warn('Google Auth: Client ID ou API Key não configurados');
      // Tenta obter do localStorage se disponível (exemplo)
      CONFIG.clientId = localStorage.getItem('GOOGLE_CLIENT_ID') || CONFIG.clientId;
      CONFIG.apiKey = localStorage.getItem('API_KEY') || CONFIG.apiKey;
       if (!CONFIG.clientId || !CONFIG.apiKey) {
         notify('error', 'Credenciais Google não configuradas. Login não funcionará.');
         return; // Interrompe inicialização se ainda não tiver credenciais
       }
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

       // Carregar usuário se já estiver autorizado ao iniciar
       if(isAuthorized) {
          await loadUserInfo();
       }


    } catch (error) {
      console.error('Erro ao inicializar Google Auth:', error);
      notify('error', 'Erro ao inicializar autenticação Google. Algumas funcionalidades podem estar indisponíveis.');
    }
  }

  // Carregar bibliotecas do Google
  async function loadGoogleLibraries() {
    // Verificar se já estão carregadas
    if (window.gapi && window.google && google.accounts) {
      console.log('Bibliotecas Google já carregadas.');
      return;
    }
    console.log('Carregando bibliotecas Google...');

    // Carregar gapi (API client)
    if (!window.gapi) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.async = true;
          script.defer = true;
          script.onload = () => {
             console.log('gapi carregado.');
             // gapi.load é chamado dentro de initGoogleClient agora
             resolve();
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
    }

    // Carregar client do Google Identity (para OAuth)
    if (!window.google || !google.accounts) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            console.log('Google Identity Services carregado.');
            resolve();
           };
          script.onerror = reject;
          document.head.appendChild(script);
        });
     }
  }

  // Inicializar cliente Google
  async function initGoogleClient() {
      // Espera gapi carregar
      await new Promise(resolve => gapi.load('client', resolve));
      console.log('gapi.client carregado.');

      // Inicializar cliente gapi
      await gapi.client.init({
        apiKey: CONFIG.apiKey,
        discoveryDocs: CONFIG.discoveryDocs
      }).then(() => {
        console.log('gapi.client inicializado.');
      });


      // Criar cliente de token para autenticação OAuth
      // Certifique-se que google.accounts.oauth2 está disponível
      if (window.google && google.accounts && google.accounts.oauth2) {
          tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.clientId,
            scope: CONFIG.scopes.join(' '),
            callback: handleAuthResponse // Esta função será chamada após o usuário conceder acesso
          });
          console.log('Token Client inicializado.');
      } else {
         throw new Error("Google Identity Services (oauth2) não está pronto.");
      }
  }

  // Verificar status de autenticação
  function checkAuthStatus() {
    const tokenData = getTokenFromStorage();

    if (tokenData && tokenData.expires_at > Date.now()) {
      console.log('Token válido encontrado no storage.');
      gapi.client.setToken(tokenData);
      isAuthorized = true;
      return true;
    } else if (tokenData) {
        console.log('Token expirado encontrado no storage.');
        removeTokenFromStorage(); // Limpa token expirado
    } else {
        console.log('Nenhum token encontrado no storage.');
    }

    isAuthorized = false;
    return false;
  }

  // Manipular resposta de autenticação
  function handleAuthResponse(tokenResponse) {
    if (tokenResponse && tokenResponse.access_token) {
      console.log('Resposta de autenticação recebida com sucesso.');
      tokenResponse.expires_at = Date.now() + (tokenResponse.expires_in * 1000);
      saveTokenToStorage(tokenResponse);

      // Definir token no gapi client para futuras chamadas API
      gapi.client.setToken(tokenResponse);

      isAuthorized = true;

      loadUserInfo().then(() => {
          updateLoginButton();
          // Disparar evento DEPOIS que info do user for carregada
          const event = new CustomEvent('googleAuthChanged', {
            detail: { isAuthorized: true, user: currentUser }
          });
          document.dispatchEvent(event);
          notify('success', 'Login Google realizado com sucesso');
       }).catch(error => {
           console.error("Erro ao carregar info do usuário após login:", error);
           // Ainda assim, marca como autorizado e atualiza botão
           updateLoginButton();
           notify('warning', 'Login realizado, mas houve erro ao buscar dados do usuário.');
       });

    } else {
      console.error('Erro de autenticação:', tokenResponse);
      isAuthorized = false;
      notify('error', 'Falha na autenticação Google');
      // Limpar qualquer token antigo
      removeTokenFromStorage();
      gapi.client.setToken('');
      updateLoginButton(); // Garante que o botão volte a 'Login'
       // Disparar evento de falha
        const event = new CustomEvent('googleAuthChanged', {
            detail: { isAuthorized: false, user: null, error: tokenResponse }
        });
        document.dispatchEvent(event);
    }
  }

  // Salvar token no armazenamento local
  function saveTokenToStorage(tokenData) {
     try {
        localStorage.setItem(CONFIG.cookieName, JSON.stringify(tokenData));
        console.log('Token salvo no localStorage.');
     } catch (e) {
        console.error('Erro ao salvar token no storage:', e);
     }
  }

  // Obter token do armazenamento local
  function getTokenFromStorage() {
    try {
      const data = localStorage.getItem(CONFIG.cookieName);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Erro ao ler token do storage:', e);
      localStorage.removeItem(CONFIG.cookieName); // Limpa dado corrompido
      return null;
    }
  }

  // Remover token do armazenamento
  function removeTokenFromStorage() {
    localStorage.removeItem(CONFIG.cookieName);
    console.log('Token removido do localStorage.');
  }

  // Carregar informações do usuário
  async function loadUserInfo() {
    if (!isAuthorized || !gapi.client) {
       console.log('Não autorizado ou gapi.client não pronto para buscar user info.');
       return null;
    }
    console.log('Buscando informações do usuário...');

    try {
      const response = await gapi.client.request({
        path: 'https://www.googleapis.com/oauth2/v3/userinfo'
      });

      if (response && response.result) {
        currentUser = {
          id: response.result.sub,
          name: response.result.name,
          email: response.result.email,
          picture: response.result.picture
        };
        console.log('Informações do usuário carregadas:', currentUser.name);

        // Atualizar estado global (se AppState existir)
        const AppState = ModuleLoader.get('state');
        if (AppState) {
          AppState.update('currentUser', currentUser);
          AppState.update('isAuthenticated', true);
        }

        // Atualizar UI (avatar, nome)
        updateUserDisplay();

        return currentUser;
      } else {
         throw new Error("Resposta inválida da API userinfo");
      }
    } catch (error) {
      console.error('Erro ao obter informações do usuário:', error);
      // Possível problema: token expirado ou inválido? Tentar deslogar?
       handleLogoutError('Erro ao buscar dados do usuário. Pode ser necessário relogar.');
      return null;
    }
  }

  // Iniciar processo de login
  function login() {
    if (!isInitialized || !tokenClient) {
      console.error('Google Auth não inicializado corretamente para login.');
      notify('error', 'Sistema de autenticação não pronto. Tente recarregar a página.');
      return;
    }

    if (isAuthorized) {
      console.log('Usuário já está autenticado.');
      return;
    }

    console.log('Iniciando fluxo de login Google...');
    // Mostrar prompt de autenticação
    tokenClient.requestAccessToken({
      prompt: 'consent' // 'consent' força mostrar a tela de permissões (bom para teste)
                      // 'select_account' permite escolher conta se logado em várias
                      // omitir 'prompt' tenta login silencioso se possível
    });
  }

   // Lida com erros que podem exigir logout
   function handleLogoutError(message) {
      notify('error', message);
      logout(true); // Passa true para indicar que é um logout forçado por erro
   }


  // Deslogar usuário
  function logout(forced = false) {
     console.log(`Iniciando logout... (Forçado: ${forced})`);
    const token = gapi.client.getToken(); // Pega o token que gapi está usando

    if (token && token.access_token) {
      // Tenta revogar o token no Google
       google.accounts.oauth2.revoke(token.access_token, () => {
          console.log('Token revogado no Google com sucesso.');
       });
    }

    // Limpar token no cliente gapi
    gapi.client.setToken('');

    // Limpar estado local
    isAuthorized = false;
    currentUser = null;
    removeTokenFromStorage();

    // Atualizar estado global
    const AppState = ModuleLoader.get('state');
    if (AppState) {
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

     if (!forced) {
        notify('info', 'Logout realizado com sucesso');
     } else {
        console.log("Logout forçado concluído.");
     }
  }

  // Adicionar botão de login à UI
  function addLoginButton() {
    // Tenta encontrar o container de ações no header primeiro
    const container = document.querySelector('header .d-flex > div:last-child') || document.querySelector('header');

    if (!container) {
      console.warn('Container para botão de login não encontrado no header.');
      return;
    }

    // Verificar se o botão já existe
    if (document.getElementById('google-login-btn')) {
       console.log('Botão de login já existe.');
       updateLoginButton(); // Garante que o texto está correto
      return;
    }

    console.log('Criando botão de login...');
    const button = document.createElement('button');
    button.id = 'google-login-btn';
    // Adiciona margem se outros botões existirem
    button.className = 'btn btn-sm btn-outline-light ms-2';
    button.innerHTML = '<i class="bi bi-google"></i> Login';
    button.onclick = () => isAuthorized ? logout() : login();

    // Insere antes do último elemento no container (que podem ser outros botões)
    // ou apenas adiciona se for o único elemento.
     container.appendChild(button); // Mais simples: adiciona ao final do div de botões

    updateLoginButton(); // Define o texto inicial correto (Login ou Logout)
  }

  // Atualizar botão de login/logout
  function updateLoginButton() {
    const button = document.getElementById('google-login-btn');
    if (!button) return;

    if (isAuthorized) {
      button.innerHTML = '<i class="bi bi-box-arrow-right"></i> Logout';
      button.className = 'btn btn-sm btn-warning ms-2'; // Mudar cor para logout
      button.onclick = () => logout(); // Garante que chama logout
    } else {
      button.innerHTML = '<i class="bi bi-google"></i> Login';
      button.className = 'btn btn-sm btn-outline-light ms-2'; // Cor para login
      button.onclick = () => login(); // Garante que chama login
    }
     console.log(`Botão de login atualizado para: ${isAuthorized ? 'Logout' : 'Login'}`);
  }

  // Atualizar exibição do usuário
  function updateUserDisplay() {
    if (!currentUser) {
       removeUserDisplay(); // Garante que não há display antigo se user for null
       return;
    }

    const container = document.querySelector('header .d-flex > div:last-child'); // O mesmo container dos botões
    if (!container) return;

    removeUserDisplay(); // Remove display antigo antes de criar novo

    console.log('Atualizando display do usuário:', currentUser.name);
    const userDisplay = document.createElement('div');
    userDisplay.id = 'user-display';
    // Usar classes Bootstrap para alinhar e adicionar margem
    userDisplay.className = 'd-flex align-items-center ms-3';

    userDisplay.innerHTML = `
      <img src="${currentUser.picture}" alt="${currentUser.name}" class="rounded-circle" width="32" height="32" title="${currentUser.email}">
      <span class="ms-2 d-none d-md-inline text-white small">${currentUser.name}</span>
    `;

    // Adicionar ANTES do botão de login/logout para ordem visual
    const loginButton = document.getElementById('google-login-btn');
    if (loginButton) {
      container.insertBefore(userDisplay, loginButton);
    } else {
      container.appendChild(userDisplay); // Fallback se botão não existir
    }
  }

  // Remover display de usuário
  function removeUserDisplay() {
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
      userDisplay.remove();
      console.log('Display do usuário removido.');
    }
  }

   // Função utilitária para notificações (depende do módulo 'notifications')
   function notify(type, message) {
      const Notifications = ModuleLoader.get('notifications');
      if (Notifications && Notifications[type]) {
          Notifications[type](message);
      } else {
          console.log(`[${type.toUpperCase()}] GoogleAuth: ${message}`);
          if(type === 'error') alert(message); // Fallback
      }
   }


  // Verificar se está autenticado
  function isAuthenticated() {
    // Revalida verificando se temos user info e token não expirou
    // (checkAuthStatus() pode ser chamado aqui se precisar revalidar token do storage)
    return isAuthorized && !!currentUser;
  }

  // Obter usuário atual
  function getUser() {
    return currentUser;
  }

  // Acesso à API do Google Sheets (Exemplo: Criar Planilha)
  async function createSpreadsheet(title) {
    if (!isAuthenticated()) { // Usa a função interna que checa currentUser
      notify('error', 'Você precisa estar logado para criar planilhas.');
      throw new Error('Usuário não autenticado');
    }

    if (!gapi.client.sheets) {
       notify('error', 'API do Google Sheets não está pronta.');
       throw new Error('Sheets API not loaded');
    }

    console.log(`Tentando criar planilha: ${title}`);
    try {
      const response = await gapi.client.sheets.spreadsheets.create({
        properties: {
          title: title
        }
      });
      console.log('Planilha criada:', response.result.spreadsheetUrl);
      notify('success', `Planilha "${title}" criada com sucesso!`);
      return response.result;
    } catch (error) {
      console.error('Erro ao criar planilha:', error);
      notify('error', `Erro ao criar planilha: ${error.result?.error?.message || error.message}`);
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
    createSpreadsheet // Exemplo de função API
    // Não exporte funções internas como checkAuthStatus, handleAuthResponse, etc.
  };
}); // <--- ADICIONADO O FECHAMENTO });
