/**
 * Módulo de Segurança
 * Implementa recursos de segurança e validação
 */
ModuleLoader.register('security', function() {
  // Validadores comuns
  const validators = {
    // Validar texto genérico
    text: function(value, options = {}) {
      const { required = true, minLength = 0, maxLength = 1000 } = options;
      
      if (required && (!value || !value.trim())) {
        return { valid: false, message: 'Este campo é obrigatório.' };
      }
      
      if (value && value.length < minLength) {
        return { valid: false, message: `Este campo deve ter pelo menos ${minLength} caracteres.` };
      }
      
      if (value && value.length > maxLength) {
        return { valid: false, message: `Este campo deve ter no máximo ${maxLength} caracteres.` };
      }
      
      return { valid: true };
    },
    
    // Validar placa de veículo
    placa: function(value, options = {}) {
      const { required = true } = options;
      
      if (required && (!value || !value.trim())) {
        return { valid: false, message: 'A placa é obrigatória.' };
      }
      
      if (value) {
        // Formatos válidos: AAA-1234 ou AAA1A34 (Mercosul)
        const oldFormat = /^[A-Za-z]{3}-?\d{4}$/;
        const mercosulFormat = /^[A-Za-z]{3}\d[A-Za-z]\d{2}$/;
        
        if (!oldFormat.test(value) && !mercosulFormat.test(value)) {
          return { valid: false, message: 'Formato de placa inválido. Use AAA-1234 ou AAA1A34.' };
        }
      }
      
      return { valid: true };
    },
    
    // Validar quilometragem
    km: function(value, options = {}) {
      const { required = true, min = 0, max = 1000000 } = options;
      
      if (required && (value === null || value === undefined || value === '')) {
        return { valid: false, message: 'A quilometragem é obrigatória.' };
      }
      
      const num = parseFloat(value);
      
      if (isNaN(num)) {
        return { valid: false, message: 'Quilometragem deve ser um número.' };
      }
      
      if (num < min) {
        return { valid: false, message: `Quilometragem mínima é ${min}.` };
      }
      
      if (num > max) {
        return { valid: false, message: `Quilometragem máxima é ${max}.` };
      }
      
      return { valid: true };
    },
    
    // Validar data
    date: function(value, options = {}) {
      const { required = true, minDate, maxDate } = options;
      
      if (required && (!value || value === '')) {
        return { valid: false, message: 'A data é obrigatória.' };
      }
      
      if (value) {
        // Verificar formato da data
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // Formato ISO 8601: YYYY-MM-DD
        if (!dateRegex.test(value)) {
          return { valid: false, message: 'Formato de data inválido. Use AAAA-MM-DD.' };
        }
        
        // Verificar se a data é válida
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, message: 'Data inválida.' };
        }
        
        // Verificar data mínima
        if (minDate) {
          const minDateObj = new Date(minDate);
          if (date < minDateObj) {
            return { valid: false, message: `A data deve ser posterior a ${formatDate(minDateObj)}.` };
          }
        }
        
        // Verificar data máxima
        if (maxDate) {
          const maxDateObj = new Date(maxDate);
          if (date > maxDateObj) {
            return { valid: false, message: `A data deve ser anterior a ${formatDate(maxDateObj)}.` };
          }
        }
      }
      
      return { valid: true };
    }
  };
  
  // Inicialização
  function init() {
    console.log('Módulo Security inicializado com sucesso');
    
    // Adicionar validação a todos os formulários
    applyCustomValidations();
    
    // Adicionar proteções CSP via meta tags (se necessário)
    addSecurityHeaders();
  }
  
  // Aplicar validações personalizadas aos formulários
  function applyCustomValidations() {
    // Encontrar todos os formulários
    document.querySelectorAll('form').forEach(form => {
      // Adicionar evento de submit para validação
      form.addEventListener('submit', function(event) {
        // Não prevenir envio padrão aqui, apenas adicionar validação extra
        
        // Validar formulário
        if (!validateForm(this)) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
      
      // Adicionar validação em tempo real para campos
      form.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('blur', function() {
          validateField(this);
        });
      });
    });
  }
  
  // Adicionar cabeçalhos de segurança via meta tags
  function addSecurityHeaders() {
    // Verificar se estamos em um contexto de página real
    if (window.self === window.top) {
      const metaTags = [
        { name: 'X-Content-Type-Options', content: 'nosniff' },
        { name: 'X-XSS-Protection', content: '1; mode=block' },
        { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' }
      ];
      
      metaTags.forEach(meta => {
        if (!document.querySelector(`meta[http-equiv="${meta.name}"]`)) {
          const metaTag = document.createElement('meta');
          metaTag.setAttribute('http-equiv', meta.name);
          metaTag.setAttribute('content', meta.content);
          document.head.appendChild(metaTag);
        }
      });
    }
  }
  
  // Validar um formulário inteiro
  function validateForm(form) {
    let isValid = true;
    
    // Validar cada campo do formulário
    form.querySelectorAll('input, select, textarea').forEach(field => {
      // Pular campos ocultos, botões, etc.
      if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button' || field.disabled) {
        return;
      }
      
      if (!validateField(field)) {
        isValid = false;
      }
    });
    
    return isValid;
  }
  
  // Validar um campo específico
  function validateField(field) {
    // Obter validador para o campo
    const validator = getValidatorForField(field);
    if (!validator) {
      // Sem validador específico, usar validação padrão do HTML
      return field.checkValidity();
    }
    
    // Executar validação
    const result = validator.validator(field.value, validator.options);
    
    // Atualizar UI com base no resultado
    if (result.valid) {
      field.classList.remove('is-invalid');
      field.classList.add('is-valid');
      
      // Limpar mensagem de erro
      const feedback = field.parentNode.querySelector('.invalid-feedback');
      if (feedback) {
        feedback.textContent = '';
      }
    } else {
      field.classList.remove('is-valid');
      field.classList.add('is-invalid');
      
      // Mostrar mensagem de erro
      let feedback = field.parentNode.querySelector('.invalid-feedback');
      if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        field.parentNode.appendChild(feedback);
      }
      feedback.textContent = result.message;
    }
    
    return result.valid;
  }
  
  // Obter o validador apropriado para um campo
  function getValidatorForField(field) {
    // Usar atributos data para configurar validação
    const type = field.dataset.validate;
    if (!type || !validators[type]) {
      return null;
    }
    
    // Criar opções de validação com base nos atributos data
    const options = {
      required: field.required
    };
    
    // Adicionar opções específicas para cada tipo
    if (type === 'text') {
      options.minLength = field.dataset.minLength ? parseInt(field.dataset.minLength) : 0;
      options.maxLength = field.dataset.maxLength ? parseInt(field.dataset.maxLength) : 1000;
    } else if (type === 'km') {
      options.min = field.dataset.min ? parseInt(field.dataset.min) : 0;
      options.max = field.dataset.max ? parseInt(field.dataset.max) : 1000000;
    } else if (type === 'date') {
      options.minDate = field.dataset.minDate;
      options.maxDate = field.dataset.maxDate;
    }
    
    return {
      validator: validators[type],
      options: options
    };
  }
  
  // Formatar data para exibição
  function formatDate(date) {
    if (!(date instanceof Date)) {
      return '';
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }
  
  // Exportar funções públicas
  return {
    init,
    validateForm,
    validateField,
    validators
  };
});
