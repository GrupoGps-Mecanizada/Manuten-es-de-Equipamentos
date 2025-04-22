/**
 * fix-loading.js
 * Script específico para resolver o problema do loading infinito
 */
(function() {
  // Executar imediatamente após carregar
  function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
      // Tentar todas as abordagens possíveis para ocultar/remover o spinner
      spinner.style.display = 'none';
      spinner.style.opacity = '0';
      spinner.style.visibility = 'hidden';
      spinner.classList.add('hidden-spinner');
      
      // Registrar que o spinner foi ocultado
      console.log('fix-loading.js: Spinner ocultado forçadamente');
      
      // Remover completamente depois de um pequeno atraso
      setTimeout(() => {
        if (spinner.parentNode) {
          spinner.parentNode.removeChild(spinner);
          console.log('fix-loading.js: Spinner removido completamente do DOM');
        }
      }, 500);
    }
  }
  
  // Tentar ocultar imediatamente
  hideLoadingSpinner();
  
  // Tentar novamente após um curto atraso
  setTimeout(hideLoadingSpinner, 1000);
  
  // E mais uma vez após carregamento completo
  window.addEventListener('load', hideLoadingSpinner);
  
  // Redefinir a função hideLoading global para ter certeza
  if (window.Utils) {
    const originalHideLoading = window.Utils.hideLoading;
    window.Utils.hideLoading = function() {
      // Chamar a implementação original
      if (typeof originalHideLoading === 'function') {
        originalHideLoading.call(window.Utils);
      }
      
      // E então forçar a remoção completa
      const spinner = document.getElementById('loadingSpinner');
      if (spinner) {
        spinner.style.display = 'none';
        spinner.style.opacity = '0';
        spinner.style.visibility = 'hidden';
        
        // Remover completamente após um pequeno atraso
        setTimeout(() => {
          if (spinner && spinner.parentNode) {
            spinner.parentNode.removeChild(spinner);
            console.log('Utils.hideLoading: Spinner removido completamente do DOM');
          }
        }, 100);
      }
    };
    console.log('fix-loading.js: Utils.hideLoading substituído com versão mais robusta');
  }
  
  // Adicionar evento ao documento para garantir que o spinner seja removido quando o usuário interage
  document.addEventListener('click', hideLoadingSpinner);
})();
