// config.js

const CONFIG = {
  // ==================================================
  // == CONFIGURAÇÕES DE API E AUTENTICAÇÃO GOOGLE ==
  // ==================================================

  // Client ID (OBRIGATÓRIO para Login com Google - OBTENHA NO GOOGLE CLOUD CONSOLE)
  GOOGLE_CLIENT_ID: 'SEU_CLIENT_ID_AQUI.apps.googleusercontent.com', // <-- SUBSTITUA AQUI

  // API Key (OBRIGATÓRIO para carregar APIs Google)
  API_KEY: 'AIzaSyAKitI_QG3Qd5v1DNXbAj_KwlNQSTUPRdY',

  // URL do Google Apps Script Web App
  API_URL: 'https://script.google.com/macros/s/AKfycbyAm669G2Z0EFo02Lt-HidUQfu8y93_SyOS9NIpkvstJFt9hRh1AybhRkbRoAueV45o/exec',

  // Forçar login?
  AUTH_REQUIRED: false,

  // Ativar modo de depuração (para ajudar na solução de problemas)
  DEBUG: true,

  // ==== NOVA SEÇÃO: CONFIGURAÇÕES DE SINCRONIZAÇÃO OFFLINE ====
  SYNC: {
    // Máximo de requisições para processar por vez
    BATCH_SIZE: 5,
    
    // Tempo (ms) entre tentativas automaticas de sincronização
    AUTO_SYNC_INTERVAL: 60000, // 1 minuto
    
    // Máximo de tentativas para cada requisição
    MAX_RETRIES: 3,
    
    // Tempo (ms) entre tentativas falhas
    RETRY_DELAY: 5000 // 5 segundos
  },

  // ==========================================
  // == CONFIGURAÇÕES GERAIS DA APLICAÇÃO ==
  // ==========================================
  APP_NAME: 'Sistema de Registro de Manutenções',
  APP_VERSION: '1.0.1', // Atualizado para nova versão

  // ==================================
  // == OPÇÕES PARA FORMULÁRIOS ==
  // ==================================

  // Categorias de problema
  CATEGORIAS_PROBLEMA: [
    'Motor',
    'Sistema Hidráulico',
    'Bomba',
    'Transmissão',
    'Elétrica',
    'Freios',
    'Suspensão',
    'Carroceria',
    'Outro'
  ],

  // Níveis de urgência
  NIVEIS_URGENCIA: [
    'Baixa',
    'Média',
    'Alta',
    'Crítica'
  ],

  // Itens do checklist
  CHECKLIST_ITEMS: [
    { id: 'hidraulico', label: 'Sistema Hidráulico' },
    { id: 'eletrico', label: 'Sistema Elétrico' },
    { id: 'bomba', label: 'Bomba' }
  ],

  // ==================================
  // == CONFIGURAÇÕES DE FOTOS ==
  // ==================================
  FOTO: {
    MAX_WIDTH: 1280,
    MAX_HEIGHT: 960,
    QUALITY: 0.7,
    MAX_SIZE_MB: 5
  },
};

// --- NÃO ALTERAR ABAIXO ---
// Calcula MAX_SIZE em bytes a partir de MAX_SIZE_MB para uso interno
if (CONFIG.FOTO && CONFIG.FOTO.MAX_SIZE_MB) {
    CONFIG.FOTO.MAX_SIZE = CONFIG.FOTO.MAX_SIZE_MB * 1024 * 1024;
}

// Disponibiliza o objeto CONFIG globalmente
window.CONFIG = CONFIG;

console.log("Configurações carregadas:", window.CONFIG);
