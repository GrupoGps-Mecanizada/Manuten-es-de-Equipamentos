/**
 * Gerenciador de Cache
 * Implementa sistema de cache para melhorar o desempenho e permitir funcionamento offline
 */
ModuleLoader.register('cacheManager', function() {
  // Tipo de armazenamento
  const STORAGE_TYPE = {
    LOCAL: 'localStorage',
    SESSION: 'sessionStorage',
    MEMORY: 'memory'
  };
  
  // Configurações
  const CONFIG = {
    prefixo: 'manutencao_',
    tempoExpiracao: 24 * 60, // 24 horas em minutos
    tamanhoCacheRegistros: 100, // Máximo de registros em cache
    versaoCache: '1.0',
    chaves: {
      registros: 'registros',
      config: 'config',
      usuario: 'usuario',
      sincronizacao: 'ultima_sincronizacao',
      fotos: 'fotos',
      offline: 'operacoes_offline'
    }
  };
  
  // Cache em memória
  const memoryCache = {};
  
  // Inicialização
  function init() {
    // Limpar caches expirados
    cleanExpiredCache();
    
    // Verificar versão do cache
    const cacheVersion = getItem('versao_cache', STORAGE_TYPE.LOCAL);
    if (cacheVersion !== CONFIG.versaoCache) {
      // Versão diferente, limpar tudo
      clearAll();
      // Definir nova versão
      setItem('versao_cache', CONFIG.versaoCache, 0, STORAGE_TYPE.LOCAL);
    }
    
    // Programar limpeza periódica (a cada 30 minutos)
    setInterval(cleanExpiredCache, 30 * 60 * 1000);
    
    console.log('Cache Manager inicializado com sucesso');
  }
  
  // Armazenar item no cache
  function setItem(key, value, expirationMinutes = CONFIG.tempoExpiracao, storageType = STORAGE_TYPE.LOCAL) {
    try {
      const fullKey = CONFIG.prefixo + key;
      
      // Preparar dados com expiração
      const cacheItem = {
        data: value,
        expires: expirationMinutes > 0 ? new Date().getTime() + (expirationMinutes * 60 * 1000) : 0
      };
      
      // Armazenar conforme o tipo
      switch(storageType) {
        case STORAGE_TYPE.LOCAL:
          localStorage.setItem(fullKey, JSON.stringify(cacheItem));
          break;
        case STORAGE_TYPE.SESSION:
          sessionStorage.setItem(fullKey, JSON.stringify(cacheItem));
          break;
        case STORAGE_TYPE.MEMORY:
          memoryCache[fullKey] = cacheItem;
          break;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao armazenar item no cache:', error);
      return false;
    }
  }
  
  // Recuperar item do cache
  function getItem(key, storageType = STORAGE_TYPE.LOCAL) {
    try {
      const fullKey = CONFIG.prefixo + key;
      let cacheItem;
      
      // Recuperar conforme o tipo
      switch(storageType) {
        case STORAGE_TYPE.LOCAL:
          cacheItem = JSON.parse(localStorage.getItem(fullKey));
          break;
        case STORAGE_TYPE.SESSION:
          cacheItem = JSON.parse(sessionStorage.getItem(fullKey));
          break;
        case STORAGE_TYPE.MEMORY:
          cacheItem = memoryCache[fullKey];
          break;
      }
      
      // Verificar se existe e não expirou
      if (cacheItem && cacheItem.expires) {
        if (cacheItem.expires === 0 || new Date().getTime() < cacheItem.expires) {
          return cacheItem.data;
        } else {
          // Remover se expirou
          removeItem(key, storageType);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao recuperar item do cache:', error);
      return null;
    }
  }
  
  // Remover item do cache
  function removeItem(key, storageType = STORAGE_TYPE.LOCAL) {
    try {
      const fullKey = CONFIG.prefixo + key;
      
      switch(storageType) {
        case STORAGE_TYPE.LOCAL:
          localStorage.removeItem(fullKey);
          break;
        case STORAGE_TYPE.SESSION:
          sessionStorage.removeItem(fullKey);
          break;
        case STORAGE_TYPE.MEMORY:
          delete memoryCache[fullKey];
          break;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao remover item do cache:', error);
      return false;
    }
  }
  
  // Limpar caches expirados
  function cleanExpiredCache() {
    const now = new Date().getTime();
    
    // Limpar localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key.startsWith(CONFIG.prefixo)) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            
            if (item.expires && item.expires > 0 && now > item.expires) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // Ignorar item inválido
          }
        }
      }
    } catch (error) {
      console.error('Erro ao limpar localStorage:', error);
    }
    
    // Limpar sessionStorage
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        
        if (key.startsWith(CONFIG.prefixo)) {
          try {
            const item = JSON.parse(sessionStorage.getItem(key));
            
            if (item.expires && item.expires > 0 && now > item.expires) {
              sessionStorage.removeItem(key);
            }
          } catch (e) {
            // Ignorar item inválido
          }
        }
      }
    } catch (error) {
      console.error('Erro ao limpar sessionStorage:', error);
    }
    
    // Limpar memoryCache
    for (const key in memoryCache) {
      if (memoryCache[key].expires && memoryCache[key].expires > 0 && now > memoryCache[key].expires) {
        delete memoryCache[key];
      }
    }
  }
  
  // Limpar todo o cache
  function clearAll() {
    // Limpar localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        
        if (key.startsWith(CONFIG.prefixo)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Erro ao limpar todo o localStorage:', error);
    }
    
    // Limpar sessionStorage
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        
        if (key.startsWith(CONFIG.prefixo)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Erro ao limpar todo o sessionStorage:', error);
    }
    
    // Limpar memoryCache
    for (const key in memoryCache) {
      if (key.startsWith(CONFIG.prefixo)) {
        delete memoryCache[key];
      }
    }
  }
  
  // Armazenar registros em cache
  function setRegistros(registros) {
    return setItem(CONFIG.chaves.registros, registros);
  }
  
  // Obter registros do cache
  function getRegistros() {
    return getItem(CONFIG.chaves.registros) || [];
  }
  
  // Armazenar configuração em cache
  function setConfig(config) {
    return setItem(CONFIG.chaves.config, config);
  }
  
  // Obter configuração do cache
  function getConfig() {
    return getItem(CONFIG.chaves.config) || {};
  }
  
  // Salvar operações offline para sincronizar depois
  function addOfflineOperation(operation) {
    const operations = getItem(CONFIG.chaves.offline) || [];
    operations.push({
      ...operation,
      timestamp: new Date().toISOString()
    });
    return setItem(CONFIG.chaves.offline, operations);
  }
  
  // Obter operações offline pendentes
  function getOfflineOperations() {
    return getItem(CONFIG.chaves.offline) || [];
  }
  
  // Limpar operações offline após sincronização
  function clearOfflineOperations() {
    return removeItem(CONFIG.chaves.offline);
  }
  
  // Exportar funções públicas
  return {
    init,
    setItem,
    getItem,
    removeItem,
    clearAll,
    setRegistros,
    getRegistros,
    setConfig,
    getConfig,
    addOfflineOperation,
    getOfflineOperations,
    clearOfflineOperations,
    STORAGE_TYPE
  };
});
