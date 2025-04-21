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
