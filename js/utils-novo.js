// utils-novo.js - versão simplificada com funções essenciais
window.Utils = {
  // Funções de UI
  showLoading: function(message) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
      spinner.style.display = 'flex';
      spinner.classList.remove('hidden-spinner');
      
      // Atualiza a mensagem se houver um elemento para isso
      const msgEl = spinner.querySelector('.loading-message');
      if (msgEl && message) {
        msgEl.textContent = this.sanitizeString(message);
      }
    }
  },
  
  hideLoading: function() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
      // Sempre esconde o spinner, independente de contador
      spinner.style.display = 'none';
      spinner.classList.add('hidden-spinner');
      console.log('Spinner ocultado forçadamente');
    }
  },
  
  showScreen: function(screenId) {
    if (!screenId) return;
    let found = false;
    document.querySelectorAll('.tela-sistema').forEach(tela => {
      if (tela.id === screenId) {
        tela.style.display = 'block';
        found = true;
      } else {
        tela.style.display = 'none';
      }
    });
    
    if (found) {
      window.scrollTo(0, 0); // Rola para o topo
      console.log(`Exibindo tela #${screenId}`);
    } else {
      console.warn(`Tela com ID #${screenId} não encontrada.`);
    }
  },
  
  // Funções de String
  sanitizeString: function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"'`/]/ig, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', 
      "'": '&#x27;', "/": '&#x2F;', "`": '&grave;'
    })[m]);
  },
  
  removerAcentos: function(texto) { 
    return texto ? String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
  },
  
  // Funções de ID e Data
  gerarId: function() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  },
  
  formatarDataHora: function(dataHora) {
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
  },
  
  // Funções de Array
  ordenarPor: function(array, propriedade, crescente = true) {
    if (!Array.isArray(array)) return [];
    
    const copia = [...array];
    return copia.sort((a, b) => {
      let valA = a ? a[propriedade] : undefined;
      let valB = b ? b[propriedade] : undefined;
      
      // Tratar valores nulos
      if (valA === null && valB === null) return 0;
      if (valA === null) return crescente ? -1 : 1;
      if (valB === null) return crescente ? 1 : -1;
      
      // Tratar datas
      if (typeof valA === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valA)) {
        valA = new Date(valA);
      }
      if (typeof valB === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valB)) {
        valB = new Date(valB);
      }
      
      // Comparar datas
      if (valA instanceof Date && valB instanceof Date) {
        return crescente ? valA - valB : valB - valA;
      }
      
      // Comparar números
      if (typeof valA === 'number' && typeof valB === 'number') {
        return crescente ? valA - valB : valB - valA;
      }
      
      // Comparar strings
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return crescente ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  },
  
  // Funções de LocalStorage
  salvarLocalStorage: function(chave, valor, minutosExpiracao = 0) {
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
  },
  
  obterLocalStorage: function(chave) {
    if (!chave) return null;
    
    try {
      const itemStr = localStorage.getItem(chave);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      
      // Verificar expiração
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
  },
  
  removerLocalStorage: function(chave) {
    if (!chave) return false;
    
    try {
      localStorage.removeItem(chave);
      return true;
    } catch (e) {
      console.error(`Erro ao remover '${chave}' do localStorage:`, e);
      return false;
    }
  }
};
