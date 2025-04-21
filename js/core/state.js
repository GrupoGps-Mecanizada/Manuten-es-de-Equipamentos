/**
 * Sistema de gerenciamento de estado
 * Permite centralizar dados e notificar componentes sobre mudanças
 */
ModuleLoader.register('state', function() {
  const stateData = {
    currentUser: null,
    isAuthenticated: false,
    currentScreen: 'listaRegistros',
    darkMode: localStorage.getItem('darkMode') === 'true',
    registros: [],
    registroAtual: null,
    fotos: [],
    filtros: {
      status: 'todos',
      dataInicio: null,
      dataFim: null,
      placa: '',
      responsavel: ''
    },
    carregando: false,
    online: navigator.onLine,
    sincronizado: true
  };
  
  const listeners = {};
  
  // Sistema de observadores
  function subscribe(key, callback) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
    return () => unsubscribe(key, callback);
  }
  
  function unsubscribe(key, callback) {
    if (!listeners[key]) return;
    listeners[key] = listeners[key].filter(cb => cb !== callback);
  }
  
  // Atualizar estado e notificar observadores
  function update(key, value) {
    const oldValue = stateData[key];
    stateData[key] = value;
    console.log(`Estado '${key}' atualizado:`, value);
    
    // Notificar observadores
    if (listeners[key]) {
      listeners[key].forEach(callback => callback(value, oldValue));
    }
    
    // Persistir alguns estados específicos
    if (key === 'darkMode') {
      localStorage.setItem('darkMode', value);
    }
  }
  
  function get(key) {
    return stateData[key];
  }
  
  // Funções específicas para manipulação de registros
  function adicionarRegistro(registro) {
    const registros = [...stateData.registros, registro];
    update('registros', registros);
  }
  
  function atualizarRegistro(id, novosDados) {
    const registros = stateData.registros.map(reg => 
      reg.id === id ? {...reg, ...novosDados} : reg
    );
    update('registros', registros);
    
    // Se for o registro atual, atualizar também
    if (stateData.registroAtual && stateData.registroAtual.id === id) {
      update('registroAtual', {...stateData.registroAtual, ...novosDados});
    }
  }
  
  function removerRegistro(id) {
    const registros = stateData.registros.filter(reg => reg.id !== id);
    update('registros', registros);
    
    // Se for o registro atual, limpar
    if (stateData.registroAtual && stateData.registroAtual.id === id) {
      update('registroAtual', null);
    }
  }
  
  // Função de inicialização
  function init() {
    console.log('Módulo State inicializado com sucesso.');
    
    // Monitorar status de conexão
    window.addEventListener('online', () => update('online', true));
    window.addEventListener('offline', () => update('online', false));
    
    // Expor AppState globalmente para compatibilidade
    window.AppState = {
      subscribe,
      unsubscribe,
      update,
      get,
      adicionarRegistro,
      atualizarRegistro,
      removerRegistro
    };
    
    return window.AppState;
  }
  
  // Retornar interface do módulo
  return {
    init,
    subscribe,
    unsubscribe,
    update,
    get,
    adicionarRegistro,
    atualizarRegistro,
    removerRegistro
  };
});
