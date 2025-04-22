// utils-novo.js - versão simplificada
window.Utils = {
  // Funções mínimas necessárias
  showLoading: function(message) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'flex';
  },
  
  hideLoading: function() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
      spinner.style.display = 'none';
      spinner.classList.add('hidden-spinner');
    }
  },
  
  showScreen: function(screenId) {
    document.querySelectorAll('.tela-sistema').forEach(tela => {
      tela.style.display = tela.id === screenId ? 'block' : 'none';
    });
  },
  
  sanitizeString: function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"'`/]/ig, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', 
      "'": '&#x27;', "/": '&#x2F;', "`": '&grave;'
    })[m]);
  },
  
  gerarId: function() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
};
