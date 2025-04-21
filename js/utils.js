/**
 * Utilitários Gerais para o Sistema de Manutenção
 * Versão 1.0 - Funções auxiliares para manipulação de dados, formatação e validações
 */

// Namespace para evitar colisões
const Utils = (function() {

  /**
   * Formata uma data no padrão DD/MM/YYYY
   * @param {string|Date} date - Data a ser formatada (string YYYY-MM-DD ou objeto Date)
   * @returns {string} Data formatada
   */
  function formatDate(date) {
    if (!date) return '';
    
    try {
      let dateObj;
      
      if (date instanceof Date) {
        dateObj = date;
      } else {
        // Converter string para Date
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) {
        return String(date); // Retorna a entrada original se não for uma data válida
      }
      
      // Formatar como DD/MM/YYYY
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.error('Erro ao formatar data:', e);
      return String(date);
    }
  }
  
  /**
   * Formata uma data e hora no padrão DD/MM/YYYY HH:MM
   * @param {string|Date} datetime - Data e hora a ser formatada
   * @returns {string} Data e hora formatada
   */
  function formatDateTime(datetime) {
    if (!datetime) return '';
    
    try {
      let dateObj;
      
      if (datetime instanceof Date) {
        dateObj = datetime;
      } else {
        dateObj = new Date(datetime);
      }
      
      if (isNaN(dateObj.getTime())) {
        return String(datetime);
      }
      
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      console.error('Erro ao formatar data e hora:', e);
      return String(datetime);
    }
  }
  
  /**
   * Valida uma placa de veículo (formatos Mercosul e antigo Brasil)
   * @param {string} plate - Placa de veículo a ser validada
   * @returns {boolean} Verdadeiro se a placa for válida
   */
  function isValidLicensePlate(plate) {
    if (!plate || typeof plate !== 'string') return false;
    
    // Remover espaços e hifens
    const cleanPlate = plate.replace(/[\s-]/g, '').toUpperCase();
    
    // Validar formato antigo: AAA9999
    const oldFormatRegex = /^[A-Z]{3}\d{4}$/;
    
    // Validar formato Mercosul: AAA9A99
    const mercosulRegex = /^[A-Z]{3}\d[A-Z]\d{2}$/;
    
    return oldFormatRegex.test(cleanPlate) || mercosulRegex.test(cleanPlate);
  }
  
  /**
   * Gera um ID único com prefixo e timestamp
   * @param {string} prefix - Prefixo para o ID (opcional)
   * @returns {string} ID único
   */
  function generateUniqueId(prefix = 'id') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}_${timestamp}_${random}`;
  }
  
  /**
   * Formata um valor numérico como moeda (R$)
   * @param {number} value - Valor a ser formatado
   * @returns {string} Valor formatado como moeda
   */
  function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
  
  /**
   * Trunca texto com reticências se exceder o tamanho máximo
   * @param {string} text - Texto a ser truncado
   * @param {number} maxLength - Tamanho máximo permitido
   * @returns {string} Texto truncado se necessário
   */
  function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  /**
   * Sanitiza uma string para evitar problemas de segurança em HTML
   * @param {string} str - String a ser sanitizada
   * @returns {string} String sanitizada
   */
  function sanitizeString(str) {
    if (!str) return '';
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return str.replace(/[&<>"']/g, function(m) { return map[m]; });
  }
  
  /**
   * Converte tamanho em bytes para formato legível
   * @param {number} bytes - Tamanho em bytes
   * @returns {string} Tamanho formatado (KB, MB, etc)
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Extrai extensão do nome de arquivo
   * @param {string} filename - Nome do arquivo
   * @returns {string} Extensão do arquivo (sem o ponto)
   */
  function getFileExtension(filename) {
    if (!filename) return '';
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
  }

  /**
   * Verifica se uma URL é válida
   * @param {string} url - URL a ser validada
   * @returns {boolean} Verdadeiro se a URL for válida
   */
  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Converte string para slug (para URLs amigáveis)
   * @param {string} text - Texto a ser convertido
   * @returns {string} Slug gerado
   */
  function slugify(text) {
    if (!text) return '';
    
    return text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/[^\w-]+/g, '') // Remove caracteres não alfanuméricos
      .replace(/--+/g, '-'); // Remove hífens duplicados
  }
  
  // Exportar funções públicas
  return {
    formatDate,
    formatDateTime,
    isValidLicensePlate,
    generateUniqueId,
    formatCurrency,
    truncateText,
    sanitizeString,
    formatFileSize,
    getFileExtension,
    isValidUrl,
    slugify
  };
})();

// Exportar para uso global
window.Utils = Utils;
