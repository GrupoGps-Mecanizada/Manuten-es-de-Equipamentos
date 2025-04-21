/**
 * Carregador de Módulos do Sistema
 * Gerencia a inicialização e dependências dos módulos
 */
const ModuleLoader = (function() {
  // Armazenar módulos registrados
  const modules = {};
  
  // Armazenar instâncias inicializadas
  const instances = {};
  
  // Registrar um módulo
  function register(name, initializer) {
    if (modules[name]) {
      console.warn(`Módulo '${name}' já está registrado. Será sobrescrito.`);
    }
    
    modules[name] = initializer;
    console.log(`Módulo '${name}' registrado com sucesso.`);
    return true;
  }
  
  // Inicializar um módulo
  function initialize(name) {
    // Verificar se o módulo já está inicializado
    if (instances[name]) {
      console.log(`Módulo '${name}' já está inicializado.`);
      return instances[name];
    }
    
    // Verificar se o módulo está registrado
    if (!modules[name]) {
      console.error(`Módulo '${name}' não está registrado.`);
      return null;
    }
    
    try {
      console.log(`Inicializando módulo '${name}'...`);
      // Inicializar o módulo
      const instance = modules[name]();
      
      // Armazenar a instância
      instances[name] = instance;
      
      // Inicializar o módulo se tiver método init
      if (instance && typeof instance.init === 'function') {
        instance.init();
      }
      
      console.log(`Módulo '${name}' inicializado com sucesso.`);
      return instance;
    } catch (error) {
      console.error(`Erro ao inicializar módulo '${name}':`, error);
      return null;
    }
  }
  
  // Obter um módulo inicializado
  function get(name) {
    return instances[name] || null;
  }
  
  // Verificar se um módulo está disponível
  function isAvailable(name) {
    return !!modules[name];
  }
  
  // Verificar se um módulo está inicializado
  function isInitialized(name) {
    return !!instances[name];
  }
  
  // Exportar a API pública
  return {
    register,
    initialize,
    get,
    isAvailable,
    isInitialized
  };
})();

// Exportar globalmente
window.ModuleLoader = ModuleLoader;
