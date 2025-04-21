/**
 * Gerenciador de Temas da Aplicação
 * Controla a alternância entre modo claro e escuro
 */
ModuleLoader.register('themeManager', function() {
  // Constantes e configuração
  const THEME_KEY = 'manutencao_theme';
  const DARK_CLASS = 'dark-mode';
  const TRANSITION_CLASS = 'theme-transition';
  
  // Estado interno
  let isDarkMode = false;
  
  // Inicialização
  function init() {
    console.log('Inicializando Theme Manager...');
    
    // Verificar preferência salva
    const savedTheme = localStorage.getItem(THEME_KEY);
    
    if (savedTheme) {
      // Usar preferência salva
      isDarkMode = savedTheme === 'dark';
    } else {
      // Verificar preferência do sistema
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      isDarkMode = prefersDark;
    }
    
    // Aplicar tema inicial
    applyTheme(isDarkMode);
    
    // Adicionar botão de alternância de tema
    addThemeToggle();
    
    // Adicionar CSS para transições suaves
    addTransitionStyles();
    
    // Observar mudanças na preferência do sistema
    setupSystemPreferenceListener();
    
    console.log('Theme Manager inicializado com sucesso. Modo escuro:', isDarkMode);
  }
  
  // Adicionar estilos de transição
  function addTransitionStyles() {
    if (!document.getElementById('theme-transition-style')) {
      const style = document.createElement('style');
      style.id = 'theme-transition-style';
      style.textContent = `
        .theme-transition * {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Aplicar tema (claro ou escuro)
  function applyTheme(dark) {
    isDarkMode = dark;
    
    // Adicionar classe de transição
    document.body.classList.add(TRANSITION_CLASS);
    
    // Adicionar ou remover classe do tema
    if (dark) {
      document.body.classList.add(DARK_CLASS);
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    } else {
      document.body.classList.remove(DARK_CLASS);
      document.documentElement.setAttribute('data-bs-theme', 'light');
    }
    
    // Remover classe de transição após a conclusão da animação
    setTimeout(() => {
      document.body.classList.remove(TRANSITION_CLASS);
    }, 300);
    
    // Salvar preferência
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    
    // Atualizar botão de tema
    updateThemeToggleButton();
    
    // Notificar outros componentes (via estado global)
    if (window.AppState) {
      AppState.update('darkMode', dark);
    }
    
    // Disparar evento
    document.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { darkMode: dark } 
    }));
    
    return dark;
  }
  
  // Alternar tema
  function toggleTheme() {
    return applyTheme(!isDarkMode);
  }
  
  // Adicionar botão de alternância de tema
  function addThemeToggle() {
    // Verificar se o botão já existe
    if (document.getElementById('theme-toggle-btn')) {
      return;
    }
    
    // Encontrar onde colocar o botão
    const container = document.querySelector('.header-actions') || 
                      document.querySelector('.navbar-nav') ||
                      document.querySelector('header');
    
    if (!container) {
      console.warn('Theme Manager: Container para botão de tema não encontrado');
      return;
    }
    
    // Criar botão
    const button = document.createElement('button');
    button.id = 'theme-toggle-btn';
    button.className = 'btn btn-outline-secondary btn-sm ms-2';
    button.setAttribute('aria-label', 'Alternar tema');
    button.innerHTML = '<i class="bi bi-moon"></i>';
    
    // Adicionar evento de clique
    button.addEventListener('click', toggleTheme);
    
    // Adicionar ao container
    container.appendChild(button);
    
    // Atualizar aparência inicial
    updateThemeToggleButton();
  }
  
  // Atualizar aparência do botão de tema
  function updateThemeToggleButton() {
    const button = document.getElementById('theme-toggle-btn');
    if (!button) return;
    
    button.innerHTML = isDarkMode
      ? '<i class="bi bi-sun"></i>'
      : '<i class="bi bi-moon"></i>';
    
    button.title = isDarkMode
      ? 'Mudar para modo claro'
      : 'Mudar para modo escuro';
  }
  
  // Configurar observador de preferência do sistema
  function setupSystemPreferenceListener() {
    if (!window.matchMedia) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Função que atualiza o tema se não houver preferência salva pelo usuário
    const updateThemeIfAutomatic = (event) => {
      // Só atualiza se não houver preferência explícita
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(event.matches);
      }
    };
    
    // Adicionar listener (versão moderna ou legada)
    try {
      mediaQuery.addEventListener('change', updateThemeIfAutomatic);
    } catch (e) {
      // Fallback para navegadores mais antigos
      mediaQuery.addListener(updateThemeIfAutomatic);
    }
  }
  
  // Verificar se o modo escuro está ativo
  function isDark() {
    return isDarkMode;
  }
  
  // Exportar funções públicas
  return {
    init,
    toggleTheme,
    applyTheme,
    isDark
  };
});
