// config.js

const CONFIG = {
  // ==================================================
  // == CONFIGURAÇÕES DE API E AUTENTICAÇÃO GOOGLE ==
  // ==================================================

  // Client ID (OBRIGATÓRIO para Login com Google - OBTENHA NO GOOGLE CLOUD CONSOLE)
  // Formato: xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
  GOOGLE_CLIENT_ID: 'SEU_CLIENT_ID_AQUI.apps.googleusercontent.com', // <-- SUBSTITUA AQUI

  // API Key (OBRIGATÓRIO para carregar APIs Google)
  API_KEY: 'AIzaSyAKitI_QG3Qd5v1DNXbAj_KwlNQSTUPRdY', // <-- Chave que você forneceu

  // URL do Google Apps Script Web App (já preenchido com a URL que você forneceu)
  API_URL: 'https://script.google.com/macros/s/AKfycbzTVz8O5meWyVxp88hTYUCuKxvPCl3FSAje2tD0R6_Mg8idqKLPvPYVhU5OS6Fj7E9E/exec',

  // Forçar login? (true = sim, false = não)
  // Se true, main.js tentará inicializar o googleAuth
  AUTH_REQUIRED: false,

  // ==========================================
  // == CONFIGURAÇÕES GERAIS DA APLICAÇÃO ==
  // ==========================================
  APP_NAME: 'Sistema de Registro de Manutenções',
  APP_VERSION: '1.0', // Versão da sua aplicação

  // ==================================
  // == OPÇÕES PARA FORMULÁRIOS ==
  // ==================================

  // Categorias de problema (usadas no select)
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

  // Níveis de urgência (usadas no select)
  NIVEIS_URGENCIA: [
    'Baixa',
    'Média',
    'Alta',
    'Crítica'
  ],

  // Itens do checklist (usados para gerar os checklists nos formulários)
  // Cada item DEVE ter um 'id' (único, sem espaços) e um 'label' (texto exibido)
  CHECKLIST_ITEMS: [
    { id: 'hidraulico', label: 'Sistema Hidráulico' },
    { id: 'eletrico', label: 'Sistema Elétrico' },
    { id: 'bomba', label: 'Bomba' }
    // Adicione mais itens conforme necessário para seus checklists
    // Exemplo: { id: 'nivel_oleo', label: 'Nível do Óleo' },
    // Exemplo: { id: 'filtros', label: 'Filtros (Ar/Óleo/Comb.)' },
  ],

  // ==================================
  // == CONFIGURAÇÕES DE FOTOS ==
  // ==================================
  // Usadas pelo photo-handler.js (se ele implementar redimensionamento/compressão)
  FOTO: {
    MAX_WIDTH: 1280,    // Largura máxima em pixels ao redimensionar (opcional)
    MAX_HEIGHT: 960,    // Altura máxima em pixels ao redimensionar (opcional)
    QUALITY: 0.7,       // Qualidade JPEG para compressão (0.1 a 1.0) (opcional)
    MAX_SIZE_MB: 5      // Tamanho máximo permitido por arquivo em MB (usado na validação)
    // MAX_SIZE: 5 * 1024 * 1024, // Tamanho máximo em bytes (calculado a partir de MB abaixo)
  },

  // Outras configurações que sua aplicação possa precisar...
  // Ex: ID_PASTA_DRIVE: '1T-xKot9px7KiYK77Uw-cr-5TuqIfls5N', // ID da pasta que você forneceu (se o script usar)
  // Ex: ID_PLANILHA: '1akGddFE_lrv9sGNalTYdgUhDfrxFLzsVSOVwD2fuPcc', // ID da planilha (se o script usar)

};

// --- NÃO ALTERAR ABAIXO ---
// Calcula MAX_SIZE em bytes a partir de MAX_SIZE_MB para uso interno
if (CONFIG.FOTO && CONFIG.FOTO.MAX_SIZE_MB) {
    CONFIG.FOTO.MAX_SIZE = CONFIG.FOTO.MAX_SIZE_MB * 1024 * 1024;
}

// Disponibiliza o objeto CONFIG globalmente para outros scripts
window.CONFIG = CONFIG;

console.log("Configurações carregadas:", window.CONFIG); // Log para depuração
