/**
 * Utilitários para o Sistema de Manutenção de Equipamentos
 * Fornece funções úteis para todo o sistema, expostas globalmente em window.Utils
 */
(function() { // Usa uma IIFE para evitar poluir o escopo global com as funções internas

  // ==================================
  // Formatação de Data e Hora
  // ==================================

  function formatarData(data) {
    if (!data) return '';
    let dataObj;
    if (data instanceof Date) {
      dataObj = data;
    } else if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data)) {
      const [year, month, day] = data.substring(0, 10).split('-');
      dataObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (isNaN(dataObj.getTime())) return data;
    } else {
      return String(data);
    }
     if (isNaN(dataObj.getTime())) {
        return String(data);
     }
    const dia = String(dataObj.getUTCDate()).padStart(2, '0');
    const mes = String(dataObj.getUTCMonth() + 1).padStart(2, '0');
    const ano = dataObj.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  function formatarDataHora(dataHora) {
    if (!dataHora) return '';
    let dataObj;
    if (dataHora instanceof Date) {
      dataObj = dataHora;
    } else if (typeof dataHora === 'string') {
      dataObj = new Date(dataHora);
    } else {
      return String(dataHora);
    }
    if (isNaN(dataObj.getTime())) {
      return String(dataHora);
    }
    const dia = String(dataObj.getDate()).padStart(2, '0');
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const ano = dataObj.getFullYear();
    const hora = String(dataObj.getHours()).padStart(2, '0');
    const minutos = String(dataObj.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${minutos}`;
  }

  function converterParaISO(data) {
    if (!data || typeof data !== 'string') return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(data)) {
      return data.substring(0, 10);
    }
    const partes = data.split('/');
    if (partes.length === 3 && partes[0].length === 2 && partes[1].length === 2 && partes[2].length === 4) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return '';
  }

  function dataAtualISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function dataAtualFormatada() {
    return formatarData(new Date());
  }

  function diferencaDias(dataInicio, dataFim = null) {
    const parseDate = (d) => {
       if (d instanceof Date) return d;
       if (typeof d === 'string') {
          const isoDate = converterParaISO(d) || d;
          const parsed = new Date(isoDate);
          if(!isNaN(parsed.getTime())) {
             return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
          }
       }
       return null;
    };
    const inicio = parseDate(dataInicio);
    const fim = parseDate(dataFim) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    if (!inicio || !fim || isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      return NaN;
    }
    const diffTempo = fim.getTime() - inicio.getTime();
    const diffDias = Math.round(diffTempo / (1000 * 60 * 60 * 24));
    return diffDias;
  }

  // ==================================
  // Formatação de Números e Valores
  // ==================================

  function formatarNumero(numero, casasDecimais = 0) {
    if (numero === null || numero === undefined || numero === '') return '';
    const num = Number(numero);
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: casasDecimais,
      maximumFractionDigits: casasDecimais
    });
  }

  function formatarMoeda(valor) {
    if (valor === null || valor === undefined || valor === '') return 'R$ 0,00';
    const numero = Number(valor);
    if (isNaN(numero)) return 'R$ 0,00';
    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function formatarKm(km) {
    const formatado = formatarNumero(km, 0);
    return formatado ? `${formatado} km` : '';
  }

  // ==================================
  // Validações Comuns
  // ==================================

  function validarPlaca(placa) {
    if (!placa || typeof placa !== 'string') return false;
    const placaLimpa = placa.trim().replace(/-/g, '').toUpperCase();
    const padraoAntigo = /^[A-Z]{3}[0-9]{4}$/;
    const padraoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    return padraoAntigo.test(placaLimpa) || padraoMercosul.test(placaLimpa);
  }

  function validarCPF(cpf) {
    if (!cpf || typeof cpf !== 'string') return false;
    const cpfLimpo = cpf.replace(/[^\d]/g, '');
    if (cpfLimpo.length !== 11 || /^(\d)\1+$/.test(cpfLimpo)) return false;
    try {
      let soma = 0; let resto;
      for (let i = 1; i <= 9; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(cpfLimpo.substring(9, 10))) return false;
      soma = 0;
      for (let i = 1; i <= 10; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(cpfLimpo.substring(10, 11))) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function validarEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // ==================================
  // Manipulação de Strings
  // ==================================

  function maiusculas(texto) { return texto ? String(texto).toUpperCase() : ''; }
  function minusculas(texto) { return texto ? String(texto).toLowerCase() : ''; }
  function capitalizar(texto) { return texto ? String(texto).charAt(0).toUpperCase() + String(texto).slice(1).toLowerCase() : ''; }
  function capitalizarPalavras(texto) { return texto ? String(texto).toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()) : ''; }
  function removerAcentos(texto) { return texto ? String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '') : ''; }

  function sanitizeString(str) {
    if (str === null || str === undefined) {
      return '';
    }
    const map = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', "/": '&#x2F;', "`": '&grave;',
    };
    const reg = /[&<>"'`/]/ig;
    // Primeiro converte para string para evitar erros se não for string
    return String(str).replace(reg, (match)=>(map[match]));
  }

  function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  // ==================================
  // Manipulação de Arrays e Objetos
  // ==================================

  function ordenarPor(array, propriedade, crescente = true) {
    if (!Array.isArray(array)) return [];
    const copia = [...array];
    return copia.sort((a, b) => {
      let valA = a ? a[propriedade] : undefined;
      let valB = b ? b[propriedade] : undefined;
      const aNulo = valA === null || valA === undefined;
      const bNulo = valB === null || valB === undefined;
      if (aNulo && bNulo) return 0;
      if (aNulo) return crescente ? -1 : 1;
      if (bNulo) return crescente ? 1 : -1;
      const dateA = (valA instanceof Date || (typeof valA === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valA))) ? new Date(valA) : null;
      const dateB = (valB instanceof Date || (typeof valB === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valB))) ? new Date(valB) : null;
      if (dateA && dateB && !isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
         return crescente ? dateA - dateB : dateB - dateA;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return crescente ? valA - valB : valB - valA;
      }
      const strA = String(valA);
      const strB = String(valB);
      const comparison = strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' });
      return crescente ? comparison : -comparison;
    });
  }

  function filtrarPorTexto(array, texto, propriedades) {
    if (!Array.isArray(array)) return [];
    if (!texto || typeof texto !== 'string' || !Array.isArray(propriedades) || propriedades.length === 0) {
      return [...array];
    }
    const textoLimpo = removerAcentos(texto.toLowerCase().trim());
    if (!textoLimpo) return [...array];
    return array.filter(item => {
       if(!item) return false;
      return propriedades.some(prop => {
        const valor = item[prop];
        if (valor === undefined || valor === null) return false;
        const valorTexto = removerAcentos(String(valor).toLowerCase());
        return valorTexto.includes(textoLimpo);
      });
    });
  }

  function agruparPor(array, propriedade) {
    if (!Array.isArray(array)) return {};
    return array.reduce((acc, item) => {
      const chave = item ? (item[propriedade] ?? 'Indefinido') : 'Inválido';
      if (!acc[chave]) {
        acc[chave] = [];
      }
      acc[chave].push(item);
      return acc;
    }, {});
  }

  function valoresUnicos(array, propriedade) {
    if (!Array.isArray(array)) return [];
    const valores = array.map(item => item ? item[propriedade] : undefined);
    return [...new Set(valores)].filter(valor => valor !== undefined && valor !== null);
  }

  // ==================================
  // Funcionalidades de Armazenamento (LocalStorage)
  // ==================================

  function salvarLocalStorage(chave, valor, minutosExpiracao = 0) {
    if (!chave || typeof chave !== 'string') return false;
    const item = {
      valor: valor,
      timestamp: new Date().getTime(),
      expiracao: minutosExpiracao > 0 ? new Date().getTime() + (minutosExpiracao * 60 * 1000) : 0
    };
    try {
      localStorage.setItem(chave, JSON.stringify(item));
      return true;
    } catch (e) {
      console.error(`Erro ao salvar '${chave}' no localStorage:`, e);
      return false;
    }
  }

  function obterLocalStorage(chave) {
    if (!chave) return null;
    try {
      const itemStr = localStorage.getItem(chave);
      if (!itemStr) return null;
      const item = JSON.parse(itemStr);
      if (item.expiracao && item.expiracao > 0 && new Date().getTime() > item.expiracao) {
        console.log(`Item '${chave}' expirado, removendo do localStorage.`);
        localStorage.removeItem(chave);
        return null;
      }
      return item.valor;
    } catch (e) {
      console.error(`Erro ao obter '${chave}' do localStorage:`, e);
      localStorage.removeItem(chave);
      return null;
    }
  }

  function removerLocalStorage(chave) {
    if (!chave) return false;
    try {
      localStorage.removeItem(chave);
      return true;
    } catch (e) {
      console.error(`Erro ao remover '${chave}' do localStorage:`, e);
      return false;
    }
  }

  // ==================================
  // Funções Utilitárias para UI (Exemplos) - VERSÃO COM CONTADOR
  // ==================================

  let _spinnerCount = 0; // Contador para gerenciar chamadas aninhadas/simultâneas

  /** Mostra o spinner de loading global e incrementa o contador. */
  function showLoading(message = 'Carregando...') {
    const spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        console.error('Utils.showLoading: Elemento #loadingSpinner não encontrado!');
        return; // Sai se o spinner não existir no HTML
    }
    _spinnerCount++; // Incrementa o contador
    console.log(`%cDEBUG: Utils.showLoading called. Counter: ${_spinnerCount}. Message: "${message}"`, 'color: blue;'); // Log para debug

    const msgEl = spinner.querySelector('.loading-message');
    if (msgEl) {
        // Usa a função sanitizeString que já existe no Utils
        msgEl.textContent = sanitizeString(message);
    } else {
        console.warn('Utils.showLoading: Elemento .loading-message não encontrado dentro de #loadingSpinner');
    }

    // Mostra o spinner (só precisa fazer isso uma vez, mas não custa repetir)
    spinner.style.display = 'flex';
  }

  /** Esconde o spinner de loading global SE o contador chegar a zero. */
  function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        console.error('Utils.hideLoading: Elemento #loadingSpinner não encontrado!');
        return; // Sai se o spinner não existir
    }

    // Decrementa o contador, garantindo que não fique negativo
    _spinnerCount = Math.max(0, _spinnerCount - 1);
    console.log(`%cDEBUG: Utils.hideLoading called. Counter: ${_spinnerCount}.`, 'color: orange;'); // Log para debug

    // Esconde o spinner APENAS se o contador for zero
    if (_spinnerCount === 0) {
      spinner.style.display = 'none';
      spinner.classList.add('hidden'); // Adicione esta linha
      console.log('%cDEBUG: Spinner display set to none (Counter is 0).', 'color: green;');
    }

  /**
   * Mostra uma tela (seção com class .tela-sistema) e esconde as outras.
   */
  function showScreen(screenId) {
    if(!screenId) return;
    let found = false;
    document.querySelectorAll('.tela-sistema').forEach(tela => {
      if (tela.id === screenId) {
         tela.style.display = 'block';
         found = true;
      } else {
         tela.style.display = 'none';
      }
    });
    if(found) {
       window.scrollTo(0, 0); // Rola para o topo
       console.log(`Utils.showScreen: Exibindo tela #${screenId}`);
    } else {
       console.warn(`Utils.showScreen: Tela com ID #${screenId} não encontrada.`);
    }
  }

  // ==================================
  // EXPORTAÇÃO GLOBAL
  // ==================================

  // Adiciona todas as funções definidas ao objeto global window.Utils
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
    sanitizeString, // Função sanitizeString exportada
    gerarId,

    // Arrays e Objetos
    ordenarPor,
    filtrarPorTexto,
    agruparPor,
    valoresUnicos,

    // Armazenamento
    salvarLocalStorage,
    obterLocalStorage,
    removerLocalStorage,

    // UI Helpers
    showLoading, // Exporta a versão com contador
    hideLoading, // Exporta a versão com contador
    showScreen
  }
    
})();
