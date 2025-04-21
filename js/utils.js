/**
 * Utilitários para o Sistema de Manutenção de Equipamentos
 * Fornece funções úteis para todo o sistema
 */
(function() {
  /**
   * Formatação de Data e Hora
   */
  
  // Formatar data como DD/MM/YYYY
  function formatarData(data) {
    if (!data) return '';
    
    // Se já for uma data, converter para string
    if (data instanceof Date) {
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();
      return `${dia}/${mes}/${ano}`;
    }
    
    // Se for uma string em formato ISO (YYYY-MM-DD)
    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data)) {
      const partes = data.substring(0, 10).split('-');
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    
    return data;
  }
  
  // Formatar data e hora como DD/MM/YYYY HH:MM
  function formatarDataHora(dataHora) {
    if (!dataHora) return '';
    
    let data;
    
    // Converter para objeto Date se for string
    if (typeof dataHora === 'string') {
      data = new Date(dataHora);
    } else if (dataHora instanceof Date) {
      data = dataHora;
    } else {
      return dataHora;
    }
    
    // Verificar se é data válida
    if (isNaN(data.getTime())) {
      return dataHora;
    }
    
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${hora}:${minutos}`;
  }
  
  // Converter data DD/MM/YYYY para YYYY-MM-DD (formato ISO)
  function converterParaISO(data) {
    if (!data) return '';
    
    // Se já estiver em formato ISO, retornar
    if (/^\d{4}-\d{2}-\d{2}/.test(data)) {
      return data.substring(0, 10);
    }
    
    // Converter DD/MM/YYYY para YYYY-MM-DD
    const partes = data.split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    
    return data;
  }
  
  // Obter data atual em formato ISO
  function dataAtualISO() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
  }
  
  // Obter data atual formatada como DD/MM/YYYY
  function dataAtualFormatada() {
    return formatarData(new Date());
  }
  
  // Calcular diferença entre datas em dias
  function diferencaDias(dataInicio, dataFim) {
    // Converter para objetos Date
    const inicio = typeof dataInicio === 'string' ? new Date(converterParaISO(dataInicio)) : dataInicio;
    const fim = dataFim ? (typeof dataFim === 'string' ? new Date(converterParaISO(dataFim)) : dataFim) : new Date();
    
    // Verificar se são datas válidas
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      return 0;
    }
    
    // Calcular diferença em dias
    const diffTempo = Math.abs(fim.getTime() - inicio.getTime());
    const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
    
    return diffDias;
  }
  
  /**
   * Formatação de Números e Valores
   */
  
  // Formatar número com separadores
  function formatarNumero(numero, casasDecimais = 0) {
    if (numero === null || numero === undefined) return '';
    
    // Converter para número
    const num = parseFloat(numero);
    if (isNaN(num)) return '';
    
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: casasDecimais,
      maximumFractionDigits: casasDecimais
    });
  }
  
  // Formatar valor monetário
  function formatarMoeda(valor) {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    
    const numero = parseFloat(valor);
    if (isNaN(numero)) return 'R$ 0,00';
    
    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }
  
  // Formatar quilometragem
  function formatarKm(km) {
    if (km === null || km === undefined) return '';
    
    const numero = parseFloat(km);
    if (isNaN(numero)) return '';
    
    return numero.toLocaleString('pt-BR') + ' km';
  }
  
  /**
   * Validações
   */
  
  // Validar placa de veículo
  function validarPlaca(placa) {
    if (!placa) return false;
    
    // Remover espaços e traços
    const placaLimpa = placa.trim().replace(/-/g, '').toUpperCase();
    
    // Verificar formato antigo (AAA1234)
    const padraoAntigo = /^[A-Z]{3}[0-9]{4}$/;
    
    // Verificar formato Mercosul (AAA1A34)
    const padraoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    
    return padraoAntigo.test(placaLimpa) || padraoMercosul.test(placaLimpa);
  }
  
  // Validar CPF
  function validarCPF(cpf) {
    if (!cpf) return false;
    
    // Remover caracteres não numéricos
    cpf = cpf.replace(/[^\d]/g, '');
    
    // Verificar tamanho
    if (cpf.length !== 11) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    // Validar dígitos verificadores
    let soma = 0;
    let resto;
    
    for (let i = 1; i <= 9; i++) {
      soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    
    soma = 0;
    for (let i = 1; i <= 10; i++) {
      soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
  }
  
  // Validar e-mail
  function validarEmail(email) {
    if (!email) return false;
    
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
  
  /**
   * Manipulação de Strings
   */
  
  // Formatar texto em maiúsculas
  function maiusculas(texto) {
    return texto ? texto.toUpperCase() : '';
  }
  
  // Formatar texto em minúsculas
  function minusculas(texto) {
    return texto ? texto.toLowerCase() : '';
  }
  
  // Formatar primeira letra em maiúscula
  function capitalizar(texto) {
    if (!texto) return '';
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
  }
  
  // Formatar cada palavra com inicial maiúscula
  function capitalizarPalavras(texto) {
    if (!texto) return '';
    
    return texto.toLowerCase().replace(/(?:^|\s)\S/g, function(a) {
      return a.toUpperCase();
    });
  }
  
  // Remover acentos
  function removerAcentos(texto) {
    if (!texto) return '';
    
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  // Gerar ID único
  function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  /**
   * Manipulação de Arrays e Objetos
   */
  
  // Ordenar array de objetos por propriedade
  function ordenarPor(array, propriedade, crescente = true) {
    if (!Array.isArray(array)) return [];
    
    // Criar cópia para não modificar o original
    const copia = [...array];
    
    return copia.sort((a, b) => {
      // Tratar valores nulos ou undefined
      if (a[propriedade] === undefined || a[propriedade] === null) return crescente ? -1 : 1;
      if (b[propriedade] === undefined || b[propriedade] === null) return crescente ? 1 : -1;
      
      // Comparar datas se forem strings de data
      if (typeof a[propriedade] === 'string' && typeof b[propriedade] === 'string') {
        // Verificar se são datas no formato DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(a[propriedade]) && /^\d{2}\/\d{2}\/\d{4}$/.test(b[propriedade])) {
          // Converter para formato comparável (YYYYMMDD)
          const dataA = a[propriedade].split('/').reverse().join('');
          const dataB = b[propriedade].split('/').reverse().join('');
          return crescente ? dataA.localeCompare(dataB) : dataB.localeCompare(dataA);
        }
        
        // Comparar strings normalmente
        return crescente ? a[propriedade].localeCompare(b[propriedade]) : b[propriedade].localeCompare(a[propriedade]);
      }
      
      // Comparação numérica
      return crescente ? a[propriedade] - b[propriedade] : b[propriedade] - a[propriedade];
    });
  }
  
  // Filtrar array por texto
  function filtrarPorTexto(array, texto, propriedades) {
    if (!Array.isArray(array) || !texto || !Array.isArray(propriedades)) {
      return array;
    }
    
    const textoLimpo = removerAcentos(texto.toLowerCase());
    
    return array.filter(item => {
      return propriedades.some(prop => {
        const valor = item[prop];
        if (valor === undefined || valor === null) return false;
        
        const valorTexto = removerAcentos(String(valor).toLowerCase());
        return valorTexto.includes(textoLimpo);
      });
    });
  }
  
  // Agrupar array por propriedade
  function agruparPor(array, propriedade) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((acc, item) => {
      const chave = item[propriedade] || 'Outros';
      if (!acc[chave]) {
        acc[chave] = [];
      }
      acc[chave].push(item);
      return acc;
    }, {});
  }
  
  // Obter valores únicos de uma propriedade
  function valoresUnicos(array, propriedade) {
    if (!Array.isArray(array)) return [];
    
    const valores = array.map(item => item[propriedade]);
    return [...new Set(valores)].filter(valor => valor !== undefined && valor !== null);
  }
  
  /**
   * Funcionalidades de Armazenamento
   */
  
  // Salvar no localStorage com expiração
  function salvarLocalStorage(chave, valor, minutosExpiracao = 0) {
    if (!chave) return false;
    
    const item = {
      valor: valor,
      expiracao: minutosExpiracao > 0 ? new Date().getTime() + (minutosExpiracao * 60 * 1000) : 0
    };
    
    try {
      localStorage.setItem(chave, JSON.stringify(item));
      return true;
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e);
      return false;
    }
  }
  
  // Obter do localStorage, considerando expiração
  function obterLocalStorage(chave) {
    if (!chave) return null;
    
    try {
      const itemStr = localStorage.getItem(chave);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      
      // Verificar expiração
      if (item.expiracao > 0 && new Date().getTime() > item.expiracao) {
        localStorage.removeItem(chave);
        return null;
      }
      
      return item.valor;
    } catch (e) {
      console.error('Erro ao obter do localStorage:', e);
      return null;
    }
  }
  
  // Remover do localStorage
  function removerLocalStorage(chave) {
    if (!chave) return false;
    
    try {
      localStorage.removeItem(chave);
      return true;
    } catch (e) {
      console.error('Erro ao remover do localStorage:', e);
      return false;
    }
  }
  
  /**
   * Exportar funções para uso global
   */
  window.Utils = {
    // Data e Hora
    formatarData,
    formatarDataHora,
    converterParaISO,
    dataAtualISO,
    dataAtualFormatada,
    diferencaDias,
    
    // Números e Valores
    formatarNumero,
    formatarMoeda,
    formatarKm,
    
    // Validações
    validarPlaca,
    validarCPF,
    validarEmail,
    
    // Strings
    maiusculas,
    minusculas,
    capitalizar,
    capitalizarPalavras,
    removerAcentos,
    gerarId,
    
    // Arrays e Objetos
    ordenarPor,
    filtrarPorTexto,
    agruparPor,
    valoresUnicos,
    
    // Armazenamento
    salvarLocalStorage,
    obterLocalStorage,
    removerLocalStorage
  };
})();
