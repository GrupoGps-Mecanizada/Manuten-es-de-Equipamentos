/**
 * Utilitários gerais para o Sistema de Manutenção de Equipamentos
 * Fornece funções reutilizáveis em todo o sistema
 */
ModuleLoader.register('utils', function() {
  /**
   * Formatações de data e hora
   */
  
  // Formatar data como DD/MM/YYYY
  function formatDate(date) {
    if (!date) return 'N/A';
    
    try {
      let dateObj;
      // Se já for objeto Date
      if (date instanceof Date) {
        dateObj = date;
      } else {
        // Converter string para Date
        const dataStr = String(date);
        if (/^\d{4}-\d{2}-\d{2}/.test(dataStr)) {
          // Formato ISO (YYYY-MM-DD)
          const parts = dataStr.substring(0, 10).split('-');
          dateObj = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
        } else if (dataStr.includes('/')) {
          // Formato DD/MM/YYYY
          const parts = dataStr.split('/');
          if (parts.length === 3) {
            dateObj = new Date(Date.UTC(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)));
          } else {
            dateObj = new Date(dataStr);
          }
        } else {
          // Timestamp ou outro formato
          dateObj = new Date(dataStr);
        }
      }
      
      // Verificar validade
      if (isNaN(dateObj.getTime())) {
        return String(date);
      }
      
      // Formatar como DD/MM/YYYY
      const dia = String(dateObj.getUTCDate()).padStart(2, '0');
      const mes = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const ano = dateObj.getUTCFullYear();
      
      return `${dia}/${mes}/${ano}`;
    } catch (e) {
      console.error("Erro ao formatar data:", e);
      return String(date);
    }
  }
  
  // Formatar data e hora como DD/MM/YYYY HH:MM
  function formatDateTime(datetime) {
    if (!datetime) return 'N/A';
    
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
      
      // Formatar data
      const dia = String(dateObj.getDate()).padStart(2, '0');
      const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
      const ano = dateObj.getFullYear();
      
      // Formatar hora
      const hora = String(dateObj.getHours()).padStart(2, '0');
      const minutos = String(dateObj.getMinutes()).padStart(2, '0');
      
      return `${dia}/${mes}/${ano} ${hora}:${minutos}`;
    } catch (e) {
      console.error("Erro ao formatar data/hora:", e);
      return String(datetime);
    }
  }
  
  // Converter formato local DD/MM/YYYY para ISO YYYY-MM-DD
  function convertToISODate(localDate) {
    if (!localDate) return '';
    
    // Se já for formato ISO, retornar
    if (/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      return localDate;
    }
    
    // Converter DD/MM/YYYY para YYYY-MM-DD
    const parts = localDate.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    return '';
  }
  
  /**
   * Validações
   */
  
  // Validar placa de veículo (formatos antigo e Mercosul)
  function validateLicensePlate(plate) {
    if (!plate) return false;
    
    const cleanPlate = plate.trim().toUpperCase();
    
    // Formato antigo: AAA-1234 ou AAA1234
    const oldFormat = /^[A-Z]{3}[-]?\d{4}$/;
    
    // Formato Mercosul: AAA0A00
    const mercosulFormat = /^[A-Z]{3}\d[A-Z]\d{2}$/;
    
    return oldFormat.test(cleanPlate) || mercosulFormat.test(cleanPlate);
  }
  
  // Validar email
  function validateEmail(email) {
    if (!email) return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
  
  // Validar CPF
  function validateCPF(cpf) {
    if (!cpf) return false;
    
    // Remover caracteres não numéricos
    cpf = cpf.replace(/[^\d]/g, '');
    
    // Verificar se tem 11 dígitos
    if (cpf.length !== 11) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    // Validar dígitos verificadores
    let sum = 0;
    let remainder;
    
    // Primeiro dígito verificador
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    // Segundo dígito verificador
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
  }
  
  /**
   * Manipulação de Strings
   */
  
  // Truncar texto com reticências
  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    
    return text.substring(0, maxLength) + '...';
  }
  
  // Normalizar texto (remover acentos e caracteres especiais)
  function normalizeText(text) {
    if (!text) return '';
    
    return text.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^\w\s]/g, '') // Remover caracteres especiais
      .trim();
  }
  
  // Formatar número como moeda (R$)
  function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    
    const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    
    if (isNaN(numValue)) return 'R$ 0,00';
    
    return numValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }
  
  /**
   * Geradores
   */
  
  // Gerar ID único baseado em tempo + random
  function generateUniqueId(prefix = 'id') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}_${timestamp}_${random}`;
  }
  
  // Gerar cor aleatória em formato hexadecimal
  function generateRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  }
  
  /**
   * Manipulação de Objetos/Arrays
   */
  
  // Ordenar array de objetos por uma propriedade
  function sortObjectsByProperty(array, property, ascending = true) {
    if (!Array.isArray(array)) return [];
    
    return [...array].sort((a, b) => {
      if (!a.hasOwnProperty(property) || !b.hasOwnProperty(property)) return 0;
      
      const valueA = a[property];
      const valueB = b[property];
      
      // Comparar datas se parecerem datas
      if ((typeof valueA === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(valueA)) ||
          (typeof valueB === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(valueB))) {
        // Converter para formato comparável (YYYYMMDD)
        const dateA = typeof valueA === 'string' ? valueA.split('/').reverse().join('') : '';
        const dateB = typeof valueB === 'string' ? valueB.split('/').reverse().join('') : '';
        return ascending ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      
      // Comparação normal
      if (valueA < valueB) return ascending ? -1 : 1;
      if (valueA > valueB) return ascending ? 1 : -1;
      return 0;
    });
  }
  
  // Filtrar array de objetos por texto
  function filterObjectsByText(array, searchText, properties) {
    if (!Array.isArray(array) || !searchText) return array;
    
    const normalizedSearchText = normalizeText(searchText).toLowerCase();
    
    return array.filter(item => {
      return properties.some(prop => {
        if (!item.hasOwnProperty(prop)) return false;
        
        const value = item[prop];
        if (!value) return false;
        
        const normalizedValue = normalizeText(String(value)).toLowerCase();
        return normalizedValue.includes(normalizedSearchText);
      });
    });
  }
  
  // Agrupar array de objetos por propriedade
  function groupObjectsByProperty(array, property) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((acc, item) => {
      const key = item[property] || 'Outros';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }
  
  /**
   * Funções de Debug
   */
  
  // Registrar tempo de operação (para debug)
  function timeOperation(operationName, callback) {
    console.time(`⏱️ ${operationName}`);
    try {
      return callback();
    } finally {
      console.timeEnd(`⏱️ ${operationName}`);
    }
  }
  
  // Verificar propriedades existentes em um objeto
  function checkObjectProperties(obj, requiredProps) {
    if (!obj || typeof obj !== 'object') {
      return {
        valid: false,
        missingProps: requiredProps,
        message: 'Objeto não fornecido ou inválido'
      };
    }
    
    const missingProps = requiredProps.filter(prop => !obj.hasOwnProperty(prop));
    
    return {
      valid: missingProps.length === 0,
      missingProps: missingProps,
      message: missingProps.length > 0
        ? `Propriedades ausentes: ${missingProps.join(', ')}`
        : 'Todas as propriedades estão presentes'
    };
  }
  
  /**
   * Funções de localStorage
   */
  
  // Salvar objeto no localStorage com expiração
  function setLocalStorageWithExpiry(key, value, expiryMinutes) {
    const now = new Date();
    const item = {
      value: value,
      expiry: expiryMinutes ? now.getTime() + (expiryMinutes * 60 * 1000) : null
    };
    localStorage.setItem(key, JSON.stringify(item));
  }
  
  // Obter objeto do localStorage, considerando expiração
  function getLocalStorageWithExpiry(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    
    try {
      const item = JSON.parse(itemStr);
      
      // Verificar expiração
      if (item.expiry && new Date().getTime() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      
      return item.value;
    } catch (e) {
      console.error(`Erro ao recuperar "${key}" do localStorage:`, e);
      return null;
    }
  }
  
  /**
   * Funções de URL e navegação
   */
  
  // Obter parâmetros da URL
  function getURLParameters() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    
    return result;
  }
  
  // Obter parâmetro específico da URL
  function getURLParameter(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }
  
  // Exportar funções públicas
  return {
    // Formatação
    formatDate,
    formatDateTime,
    convertToISODate,
    formatCurrency,
    
    // Validação
    validateLicensePlate,
    validateEmail,
    validateCPF,
    
    // Manipulação de texto
    truncateText,
    normalizeText,
    
    // Geradores
    generateUniqueId,
    generateRandomColor,
    
    // Manipulação de objetos/arrays
    sortObjectsByProperty,
    filterObjectsByText,
    groupObjectsByProperty,
    
    // Debug
    timeOperation,
    checkObjectProperties,
    
    // LocalStorage
    setLocalStorageWithExpiry,
    getLocalStorageWithExpiry,
    
    // URL
    getURLParameters,
    getURLParameter
  };
});
