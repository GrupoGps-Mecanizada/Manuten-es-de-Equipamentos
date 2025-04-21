/**
 * Utilitários para o Sistema de Manutenção de Equipamentos
 * Fornece funções úteis para todo o sistema, expostas globalmente em window.Utils
 */
(function() { // Usa uma IIFE para evitar poluir o escopo global com as funções internas

  // ==================================
  // Formatação de Data e Hora
  // ==================================

  /**
   * Formata uma data (objeto Date ou string ISO YYYY-MM-DD) como DD/MM/YYYY.
   * @param {Date|string|null} data - A data a ser formatada.
   * @returns {string} A data formatada ou string vazia.
   */
  function formatarData(data) {
    if (!data) return '';
    let dataObj;
    if (data instanceof Date) {
      dataObj = data;
    } else if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data)) {
      // Extrai apenas a parte da data para evitar problemas de fuso horário na conversão
      const [year, month, day] = data.substring(0, 10).split('-');
      // Cria a data em UTC para evitar deslocamento de dia
      dataObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (isNaN(dataObj.getTime())) return data; // Retorna original se inválida
    } else {
      return String(data); // Retorna como string se não reconhecer o formato
    }

    // Verifica novamente se é uma data válida após a conversão
     if (isNaN(dataObj.getTime())) {
        return String(data);
     }

    // Usa UTC para obter dia/mês/ano para evitar problemas de fuso
    const dia = String(dataObj.getUTCDate()).padStart(2, '0');
    const mes = String(dataObj.getUTCMonth() + 1).padStart(2, '0'); // Mês é 0-indexed
    const ano = dataObj.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * Formata uma data/hora (objeto Date ou string ISO) como DD/MM/YYYY HH:MM.
   * @param {Date|string|null} dataHora - A data/hora a ser formatada.
   * @returns {string} A data/hora formatada ou string vazia.
   */
  function formatarDataHora(dataHora) {
    if (!dataHora) return '';
    let dataObj;
    if (dataHora instanceof Date) {
      dataObj = dataHora;
    } else if (typeof dataHora === 'string') {
      dataObj = new Date(dataHora); // Tenta parsear a string ISO
    } else {
      return String(dataHora);
    }

    if (isNaN(dataObj.getTime())) {
      return String(dataHora); // Retorna original se inválida
    }

    const dia = String(dataObj.getDate()).padStart(2, '0');
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const ano = dataObj.getFullYear();
    const hora = String(dataObj.getHours()).padStart(2, '0');
    const minutos = String(dataObj.getMinutes()).padStart(2, '0');

    return `${dia}/${mes}/${ano} ${hora}:${minutos}`;
  }

  /**
   * Converte uma data no formato DD/MM/YYYY para YYYY-MM-DD.
   * @param {string|null} data - A data em formato DD/MM/YYYY.
   * @returns {string} A data em formato YYYY-MM-DD ou string vazia.
   */
  function converterParaISO(data) {
    if (!data || typeof data !== 'string') return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(data)) {
      return data.substring(0, 10); // Já está em ISO
    }
    const partes = data.split('/');
    if (partes.length === 3 && partes[0].length === 2 && partes[1].length === 2 && partes[2].length === 4) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return ''; // Retorna vazio se o formato for inválido
  }

  /**
   * Retorna a data atual no formato YYYY-MM-DD.
   * @returns {string} Data atual em ISO.
   */
  function dataAtualISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Retorna a data atual formatada como DD/MM/YYYY.
   * @returns {string} Data atual formatada.
   */
  function dataAtualFormatada() {
    return formatarData(new Date());
  }

  /**
   * Calcula a diferença entre duas datas em dias.
   * @param {Date|string} dataInicio - Data inicial (Date ou string DD/MM/YYYY ou YYYY-MM-DD).
   * @param {Date|string|null} [dataFim=agora] - Data final (opcional, padrão é data atual).
   * @returns {number} Número de dias de diferença (pode ser NaN se datas inválidas).
   */
  function diferencaDias(dataInicio, dataFim = null) {
    const parseDate = (d) => {
       if (d instanceof Date) return d;
       if (typeof d === 'string') {
          const isoDate = converterParaISO(d) || d; // Tenta converter DD/MM/YYYY
          const parsed = new Date(isoDate);
           // Considera apenas a data, zerando horas para evitar problemas de fuso
          if(!isNaN(parsed.getTime())) {
             return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
          }
       }
       return null;
    };

    const inicio = parseDate(dataInicio);
    const fim = parseDate(dataFim) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())); // Data atual UTC

    if (!inicio || !fim || isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      return NaN; // Retorna NaN se alguma data for inválida
    }

    const diffTempo = fim.getTime() - inicio.getTime(); // Diferença em milissegundos
    const diffDias = Math.round(diffTempo / (1000 * 60 * 60 * 24)); // Converte para dias e arredonda

    return diffDias;
  }

  // ==================================
  // Formatação de Números e Valores
  // ==================================

  /**
   * Formata um número com separadores de milhar e casas decimais.
   * @param {number|string|null} numero - O número a formatar.
   * @param {number} [casasDecimais=0] - Número de casas decimais desejadas.
   * @returns {string} Número formatado ou string vazia.
   */
  function formatarNumero(numero, casasDecimais = 0) {
    if (numero === null || numero === undefined || numero === '') return '';
    const num = Number(numero);
    if (isNaN(num)) return ''; // Retorna vazio se não for um número válido

    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: casasDecimais,
      maximumFractionDigits: casasDecimais
    });
  }

  /**
   * Formata um valor como moeda Brasileira (Real).
   * @param {number|string|null} valor - O valor a formatar.
   * @returns {string} Valor formatado como R$ 0,00.
   */
  function formatarMoeda(valor) {
    if (valor === null || valor === undefined || valor === '') return 'R$ 0,00';
    const numero = Number(valor);
    if (isNaN(numero)) return 'R$ 0,00';

    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  /**
   * Formata um número como quilometragem (adiciona " km").
   * @param {number|string|null} km - O valor da quilometragem.
   * @returns {string} Quilometragem formatada ou string vazia.
   */
  function formatarKm(km) {
    const formatado = formatarNumero(km, 0); // Usa formatarNumero para tratar o número
    return formatado ? `${formatado} km` : '';
  }

  // ==================================
  // Validações Comuns
  // ==================================

  /**
   * Valida placa de veículo (formato antigo e Mercosul).
   * @param {string|null} placa - A placa a validar.
   * @returns {boolean} True se válida, False caso contrário.
   */
  function validarPlaca(placa) {
    if (!placa || typeof placa !== 'string') return false;
    const placaLimpa = placa.trim().replace(/-/g, '').toUpperCase();
    const padraoAntigo = /^[A-Z]{3}[0-9]{4}$/;
    const padraoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    return padraoAntigo.test(placaLimpa) || padraoMercosul.test(placaLimpa);
  }

  /**
   * Valida um número de CPF.
   * @param {string|null} cpf - O CPF a validar (pode conter pontos/traço).
   * @returns {boolean} True se válido, False caso contrário.
   */
  function validarCPF(cpf) {
    if (!cpf || typeof cpf !== 'string') return false;
    const cpfLimpo = cpf.replace(/[^\d]/g, ''); // Remove não dígitos
    if (cpfLimpo.length !== 11 || /^(\d)\1+$/.test(cpfLimpo)) return false; // Tamanho e dgtos repetidos

    try {
      let soma = 0;
      let resto;
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
      return false; // Se ocorrer erro na conversão/cálculo
    }
  }

  /**
   * Valida um endereço de e-mail (formato básico).
   * @param {string|null} email - O e-mail a validar.
   * @returns {boolean} True se válido, False caso contrário.
   */
  function validarEmail(email) {
    if (!email || typeof email !== 'string') return false;
    // Regex simples, pode ser aprimorada se necessário
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // ==================================
  // Manipulação de Strings
  // ==================================

  /** Transforma a string em maiúsculas. */
  function maiusculas(texto) { return texto ? String(texto).toUpperCase() : ''; }
  /** Transforma a string em minúsculas. */
  function minusculas(texto) { return texto ? String(texto).toLowerCase() : ''; }
  /** Capitaliza a primeira letra da string. */
  function capitalizar(texto) { return texto ? String(texto).charAt(0).toUpperCase() + String(texto).slice(1).toLowerCase() : ''; }
  /** Capitaliza a primeira letra de cada palavra na string. */
  function capitalizarPalavras(texto) { return texto ? String(texto).toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()) : ''; }
  /** Remove acentuação da string. */
  function removerAcentos(texto) { return texto ? String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '') : ''; }

  /**
   * Sanitiza uma string para exibição em HTML, escapando caracteres especiais.
   * Ajuda a prevenir XSS básico. Para segurança robusta, considere bibliotecas como DOMPurify.
   * @param {string|null|undefined} str - A string a ser sanitizada.
   * @returns {string} A string sanitizada ou uma string vazia se a entrada for inválida.
   */
  function sanitizeString(str) {
    if (str === null || str === undefined) {
      return '';
    }
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;', // Mais seguro que &apos;
      "/": '&#x2F;', // Previne fechamento de tags
      "`": '&grave;', // Previne execução em alguns contextos
    };
    const reg = /[&<>"'`/]/ig;
    return String(str).replace(reg, (match)=>(map[match]));
  }


  /**
   * Gera um ID pseudo-único combinando timestamp e parte aleatória.
   * @returns {string} Um ID único.
   */
  function gerarId() {
    // Timestamp em base 36 + parte aleatória em base 36
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  // ==================================
  // Manipulação de Arrays e Objetos
  // ==================================

  /**
   * Ordena um array de objetos por uma propriedade específica.
   * @param {Array} array - O array a ser ordenado.
   * @param {string} propriedade - O nome da propriedade para ordenar.
   * @param {boolean} [crescente=true] - True para ordem ascendente, False para descendente.
   * @returns {Array} Uma nova cópia ordenada do array.
   */
  function ordenarPor(array, propriedade, crescente = true) {
    if (!Array.isArray(array)) return [];
    const copia = [...array]; // Não modifica o original

    return copia.sort((a, b) => {
      let valA = a ? a[propriedade] : undefined;
      let valB = b ? b[propriedade] : undefined;

      // Trata nulos/undefined consistentemente
      const aNulo = valA === null || valA === undefined;
      const bNulo = valB === null || valB === undefined;
      if (aNulo && bNulo) return 0;
      if (aNulo) return crescente ? -1 : 1; // Nulos primeiro em crescente
      if (bNulo) return crescente ? 1 : -1; // Nulos primeiro em crescente

      // Tenta comparar como datas se forem strings ISO ou objetos Date
      const dateA = (valA instanceof Date || (typeof valA === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valA))) ? new Date(valA) : null;
      const dateB = (valB instanceof Date || (typeof valB === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valB))) ? new Date(valB) : null;

      if (dateA && dateB && !isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
         return crescente ? dateA - dateB : dateB - dateA;
      }

      // Comparação numérica
      if (typeof valA === 'number' && typeof valB === 'number') {
        return crescente ? valA - valB : valB - valA;
      }

      // Comparação de strings (case-insensitive, com acentos tratados)
      const strA = String(valA);
      const strB = String(valB);
      const comparison = strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' });
      return crescente ? comparison : -comparison;
    });
  }

  /**
   * Filtra um array de objetos baseado em um texto de busca em propriedades específicas.
   * @param {Array} array - O array a filtrar.
   * @param {string} texto - O texto de busca.
   * @param {Array<string>} propriedades - Array com os nomes das propriedades onde buscar.
   * @returns {Array} Um novo array filtrado.
   */
  function filtrarPorTexto(array, texto, propriedades) {
    if (!Array.isArray(array)) return [];
    if (!texto || typeof texto !== 'string' || !Array.isArray(propriedades) || propriedades.length === 0) {
      return [...array]; // Retorna cópia se não houver filtro
    }

    const textoLimpo = removerAcentos(texto.toLowerCase().trim());
    if (!textoLimpo) return [...array]; // Retorna cópia se texto limpo for vazio

    return array.filter(item => {
       if(!item) return false;
      // Verifica se alguma das propriedades contém o texto
      return propriedades.some(prop => {
        const valor = item[prop];
        if (valor === undefined || valor === null) return false;
        const valorTexto = removerAcentos(String(valor).toLowerCase());
        return valorTexto.includes(textoLimpo);
      });
    });
  }

  /**
   * Agrupa itens de um array baseado no valor de uma propriedade.
   * @param {Array} array - O array a ser agrupado.
   * @param {string} propriedade - A propriedade usada para agrupar.
   * @returns {Object} Um objeto onde as chaves são os valores da propriedade e os valores são arrays dos itens correspondentes.
   */
  function agruparPor(array, propriedade) {
    if (!Array.isArray(array)) return {};
    return array.reduce((acc, item) => {
      const chave = item ? (item[propriedade] ?? 'Indefinido') : 'Inválido'; // Usa ?? para tratar null/undefined
      if (!acc[chave]) {
        acc[chave] = [];
      }
      acc[chave].push(item);
      return acc;
    }, {});
  }

  /**
   * Retorna um array com os valores únicos de uma propriedade em um array de objetos.
   * @param {Array} array - O array de origem.
   * @param {string} propriedade - O nome da propriedade.
   * @returns {Array} Array com valores únicos (excluindo undefined e null).
   */
  function valoresUnicos(array, propriedade) {
    if (!Array.isArray(array)) return [];
    const valores = array.map(item => item ? item[propriedade] : undefined);
    // Usa Set para unicidade e filtra undefined/null
    return [...new Set(valores)].filter(valor => valor !== undefined && valor !== null);
  }

  // ==================================
  // Funcionalidades de Armazenamento (LocalStorage)
  // ==================================

  /**
   * Salva um valor no LocalStorage com chave específica e tempo de expiração opcional.
   * @param {string} chave - A chave para armazenamento.
   * @param {*} valor - O valor a ser armazenado (será convertido para JSON).
   * @param {number} [minutosExpiracao=0] - Tempo em minutos para expirar (0 = nunca expira).
   * @returns {boolean} True se salvou com sucesso, False caso contrário.
   */
  function salvarLocalStorage(chave, valor, minutosExpiracao = 0) {
    if (!chave || typeof chave !== 'string') return false;
    const item = {
      valor: valor,
      timestamp: new Date().getTime(), // Adiciona timestamp de quando foi salvo
      expiracao: minutosExpiracao > 0 ? new Date().getTime() + (minutosExpiracao * 60 * 1000) : 0
    };
    try {
      localStorage.setItem(chave, JSON.stringify(item));
      return true;
    } catch (e) {
      console.error(`Erro ao salvar '${chave}' no localStorage:`, e);
      // Poderia implementar lógica para limpar cache antigo se o storage estiver cheio
      return false;
    }
  }

  /**
   * Obtém um valor do LocalStorage, verificando a expiração.
   * @param {string} chave - A chave do item a ser obtido.
   * @returns {*} O valor armazenado ou null se não existir, estiver expirado ou ocorrer erro.
   */
  function obterLocalStorage(chave) {
    if (!chave) return null;
    try {
      const itemStr = localStorage.getItem(chave);
      if (!itemStr) return null;
      const item = JSON.parse(itemStr);
      // Verifica expiração (se definida e se o tempo atual passou)
      if (item.expiracao && item.expiracao > 0 && new Date().getTime() > item.expiracao) {
        console.log(`Item '${chave}' expirado, removendo do localStorage.`);
        localStorage.removeItem(chave);
        return null;
      }
      return item.valor;
    } catch (e) {
      console.error(`Erro ao obter '${chave}' do localStorage:`, e);
      // Se deu erro ao parsear, remove o item corrompido
      localStorage.removeItem(chave);
      return null;
    }
  }

  /**
   * Remove um item do LocalStorage.
   * @param {string} chave - A chave do item a ser removido.
   * @returns {boolean} True se removeu com sucesso ou se já não existia, False em caso de erro.
   */
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
  // Funções Utilitárias para UI (Exemplos)
  // ==================================

  /** Mostra o spinner de loading global. */
  function showLoading(message = 'Carregando...') {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
      const msgEl = spinner.querySelector('.loading-message');
      if (msgEl) msgEl.textContent = sanitizeString(message); // Sanitiza a mensagem
      spinner.style.display = 'flex';
    }
  }

  /** Esconde o spinner de loading global. */
  function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none';
  }

  /**
   * Mostra uma tela (seção com class .tela-sistema) e esconde as outras.
   * @param {string} screenId - O ID do elemento da tela a ser exibida.
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
    sanitizeString, // <-- Função adicionada e exportada
    gerarId,

    // Arrays e Objetos
    ordenarPor,
    filtrarPorTexto,
    agruparPor,
    valoresUnicos,

    // Armazenamento
    salvarLocalStorage, // Prefira usar CacheManager se disponível
    obterLocalStorage,  // Prefira usar CacheManager se disponível
    removerLocalStorage,// Prefira usar CacheManager se disponível

    // UI Helpers
    showLoading,
    hideLoading,
    showScreen
  };

})(); // Fim da IIFE (Immediately Invoked Function Expression)
