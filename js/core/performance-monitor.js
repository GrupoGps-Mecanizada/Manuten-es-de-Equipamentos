/**
 * Monitor de Desempenho
 * Monitora e otimiza o desempenho da aplicação
 */
ModuleLoader.register('performanceMonitor', function() {
  // Configurações
  const PERFORMANCE_DEBUG = false; // Ativar logs de desempenho
  
  // Armazenar tempos de operações
  const operationTimes = {};
  const networkRequests = [];
  
  // Inicialização
  function init() {
    // Monitorar carregamento da página
    if (window.performance && PERFORMANCE_DEBUG) {
      window.addEventListener('load', analyzePageLoad);
    }
    
    // Otimizar recursos automático
    optimizeResources();
    
    // Interceptar chamadas de API para medir desempenho
    monkeyPatchAPI();
    
    console.log('Performance Monitor inicializado com sucesso');
  }
  
  // Analisar tempo de carregamento da página
  function analyzePageLoad() {
    const performance = window.performance;
    
    if (performance) {
      // Obter timings de performance
      const pageNavigation = performance.timing;
      
      // Calcular métricas relevantes
      const totalLoadTime = pageNavigation.loadEventEnd - pageNavigation.navigationStart;
      const networkLatency = pageNavigation.responseEnd - pageNavigation.fetchStart;
      const domProcessingTime = pageNavigation.domComplete - pageNavigation.domLoading;
      const renderingTime = pageNavigation.domComplete - pageNavigation.responseEnd;
      
      console.log('=== Relatório de Desempenho ===');
      console.log(`Tempo total de carregamento: ${totalLoadTime}ms`);
      console.log(`Latência de rede: ${networkLatency}ms`);
      console.log(`Processamento do DOM: ${domProcessingTime}ms`);
      console.log(`Tempo de renderização: ${renderingTime}ms`);
      
      // Adicionar ao registro de operações
      operationTimes['page_load'] = totalLoadTime;
      operationTimes['network_latency'] = networkLatency;
      operationTimes['dom_processing'] = domProcessingTime;
      operationTimes['rendering'] = renderingTime;
      
      // Sugerir otimizações se necessário
      if (totalLoadTime > 3000) {
        suggestOptimizations();
      }
    }
  }
  
  // Iniciar medição de uma operação
  function startMeasure(operationName) {
    return {
      name: operationName,
      startTime: performance.now()
    };
  }
  
  // Finalizar medição de uma operação
  function endMeasure(measurement) {
    if (!measurement || !measurement.startTime) return 0;
    
    const duration = performance.now() - measurement.startTime;
    
    // Registrar tempo da operação
    operationTimes[measurement.name] = duration;
    
    if (PERFORMANCE_DEBUG) {
      console.log(`Operação "${measurement.name}" levou ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
  
  // Otimizar recursos automaticamente
  function optimizeResources() {
    // Lazy loading para imagens
    document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
    });
    
    // Adiar carregamento de scripts não críticos
    document.querySelectorAll('script[data-defer]').forEach(script => {
      script.setAttribute('defer', '');
    });
  }
  
  // Registrar requisição de rede
  function logNetworkRequest(url, method, duration, success) {
    networkRequests.push({
      url,
      method,
      duration,
      success,
      timestamp: new Date()
    });
    
    // Manter apenas as últimas 50 requisições
    if (networkRequests.length > 50) {
      networkRequests.shift();
    }
  }
  
  // Sugerir otimizações com base na análise
  function suggestOptimizations() {
    console.log('=== Sugestões de Otimização ===');
    
    // Verificar tempos de carregamento
    if (operationTimes['network_latency'] > 1000) {
      console.log('- A latência de rede está alta. Considere:');
      console.log('  * Otimizar o tamanho das respostas da API');
      console.log('  * Implementar cache mais agressivo');
    }
    
    if (operationTimes['rendering'] > 1000) {
      console.log('- O tempo de renderização está alto. Considere:');
      console.log('  * Reduzir a complexidade do DOM');
      console.log('  * Otimizar operações JavaScript que podem estar bloqueando a renderização');
    }
    
    // Verificar requisições de rede lentas
    const slowRequests = networkRequests.filter(req => req.duration > 1000);
    if (slowRequests.length > 0) {
      console.log('- Requisições de rede lentas detectadas:');
      slowRequests.forEach(req => {
        console.log(`  * ${req.method} ${req.url}: ${req.duration.toFixed(0)}ms`);
      });
    }
  }
  
  // Sobrescrever funções de API para medir desempenho
  function monkeyPatchAPI() {
    // Verificar se existe o módulo apiClient (ou a função global)
    if (window.ApiClient || ModuleLoader.isInitialized('apiClient')) {
      const ApiClient = window.ApiClient || ModuleLoader.get('apiClient');
      
      // Substituir método chamada
      if (ApiClient && typeof ApiClient.callApi === 'function') {
        const originalCallApi = ApiClient.callApi;
        
        ApiClient.callApi = async function(action, params) {
          const startTime = performance.now();
          let success = true;
          
          try {
            const result = await originalCallApi(action, params);
            return result;
          } catch (error) {
            success = false;
            throw error;
          } finally {
            const duration = performance.now() - startTime;
            
            // Registrar tempo da operação
            operationTimes[`api_${action}`] = duration;
            
            // Registrar requisição de rede
            logNetworkRequest(`API: ${action}`, 'POST', duration, success);
            
            if (PERFORMANCE_DEBUG || duration > 2000) {
              console.log(`API "${action}" levou ${duration.toFixed(2)}ms`);
            }
          }
        };
      }
    }
  }
  
  // Obter relatório de desempenho
  function getPerformanceReport() {
    return {
      operationTimes,
      networkRequests: networkRequests.slice(-10) // Últimas 10 requisições
    };
  }
  
  // Exportar funções públicas
  return {
    init,
    startMeasure,
    endMeasure,
    getPerformanceReport
  };
});
