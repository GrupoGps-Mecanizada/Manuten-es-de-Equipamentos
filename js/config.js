// config.js

const CONFIG = {
  // URL do Google Apps Script Web App (preencha após criar)
  API_URL: 'https://script.google.com/macros/s/AKfycbwRAFDZyRzDOuSXY_KggCAPwMJMDE8mMDyvFnKawfG3qO-3E4eSArFD2cEXxJb79AuB/exec',
  
  // Configurações gerais
  APP_NAME: 'Sistema de Registro de Manutenções',
  APP_VERSION: '1.0',
  
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
  
  // Itens do checklist (para exibição padronizada)
  CHECKLIST_ITEMS: [
    { id: 'hidraulico', label: 'Sistema Hidráulico' },
    { id: 'eletrico', label: 'Sistema Elétrico' },
    { id: 'bomba', label: 'Bomba' }
    // Adicione mais itens conforme necessário
  ],
  
  // Configurações de imagens
  FOTO: {
    MAX_WIDTH: 1280,    // Largura máxima em pixels
    MAX_HEIGHT: 960,    // Altura máxima em pixels
    QUALITY: 0.7,       // Qualidade JPEG (0.1 a 1.0)
    MAX_SIZE: 1048576,  // Tamanho máximo em bytes (1MB)
  }
};
