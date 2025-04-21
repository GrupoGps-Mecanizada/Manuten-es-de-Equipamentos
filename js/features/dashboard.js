/**
 * Dashboard do Sistema de Manutenção
 * Exibe estatísticas e gráficos sobre manutenções
 */
ModuleLoader.register('dashboard', function() {
  // Referências aos elementos DOM
  let container;
  let statsContainer;
  let chartsContainer;
  let maintenanceList;
  
  // Referências a gráficos
  let statusChartInstance;
  let maintenanceTypeChartInstance;
  let urgencyChartInstance;
  let monthlyChartInstance;
  
  // Dados de estado
  let dashboardData = null;
  let isLoading = false;
  let filters = {
    period: 'all',  // all, month, week
    status: 'all',  // all, pending, completed
    dateStart: null,
    dateEnd: null
  };
  
  // Inicialização
  function init() {
    console.log('Inicializando Dashboard...');
    
    // Verificar se o Chart.js está disponível
    if (typeof Chart === 'undefined') {
      console.warn('Dashboard: Chart.js não encontrado. Gráficos não serão renderizados.');
    }
    
    // Encontrar container do dashboard
    container = document.getElementById('dashboard-container');
    if (!container) {
      console.warn('Dashboard: Container #dashboard-container não encontrado');
      return;
    }
    
    // Inicializar UI
    renderInitialUI();
    
    // Adicionar listeners para filtros
    setupEventListeners();
    
    console.log('Dashboard inicializado com sucesso');
  }
  
  // Renderizar UI inicial
  function renderInitialUI() {
    // Limpar container
    container.innerHTML = '';
    
    // Criar estrutura
    container.innerHTML = `
      <div class="dashboard-header">
        <h2>Painel de Controle</h2>
        <div class="dashboard-filters">
          <select id="dashboard-period" class="form-select form-select-sm">
            <option value="all">Todos os períodos</option>
            <option value="month">Último mês</option>
            <option value="week">Última semana</option>
            <option value="custom">Período personalizado</option>
          </select>
          <select id="dashboard-status" class="form-select form-select-sm">
            <option value="all">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="completed">Concluídos</option>
          </select>
          <div id="custom-date-range" style="display: none;">
            <input type="date" id="date-start" class="form-control form-control-sm">
            <input type="date" id="date-end" class="form-control form-control-sm">
            <button id="apply-date-filter" class="btn btn-sm btn-primary">Aplicar</button>
          </div>
          <button id="refresh-dashboard" class="btn btn-sm btn-outline-primary">
            <i class="bi bi-arrow-clockwise"></i> Atualizar
          </button>
        </div>
      </div>
      
      <div id="dashboard-stats" class="dashboard-stats">
        <div class="dashboard-loading text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
          <p class="mt-2">Carregando estatísticas...</p>
        </div>
      </div>
      
      <div class="row" id="dashboard-charts">
        <div class="col-md-6 mb-4">
          <div class="card h-100">
            <div class="card-header">
              Status das Manutenções
            </div>
            <div class="card-body chart-container">
              <canvas id="status-chart"></canvas>
            </div>
          </div>
        </div>
        <div class="col-md-6 mb-4">
          <div class="card h-100">
            <div class="card-header">
              Categorias de Problemas
            </div>
            <div class="card-body chart-container">
              <canvas id="maintenance-type-chart"></canvas>
            </div>
          </div>
        </div>
        <div class="col-md-6 mb-4">
          <div class="card h-100">
            <div class="card-header">
              Níveis de Urgência
            </div>
            <div class="card-body chart-container">
              <canvas id="urgency-chart"></canvas>
            </div>
          </div>
        </div>
        <div class="col-md-6 mb-4">
          <div class="card h-100">
            <div class="card-header">
              Manutenções por Mês
            </div>
            <div class="card-body chart-container">
              <canvas id="monthly-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card" id="dashboard-recent">
        <div class="card-header">
          Manutenções Recentes
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data</th>
                  <th>Veículo</th>
                  <th>Problema</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="recent-maintenance-list">
                <tr>
                  <td colspan="6" class="text-center py-3">Carregando...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    // Salvar referências
    statsContainer = document.getElementById('dashboard-stats');
    chartsContainer = document.getElementById('dashboard-charts');
    maintenanceList = document.getElementById('recent-maintenance-list');
  }
  
  // Configurar listeners de eventos
  function setupEventListeners() {
    // Filtro de período
    const periodSelect = document.getElementById('dashboard-period');
    if (periodSelect) {
      periodSelect.addEventListener('change', function() {
        const customDateRange = document.getElementById('custom-date-range');
        
        // Mostrar/ocultar seleção de datas customizadas
        if (this.value === 'custom' && customDateRange) {
          customDateRange.style.display = 'flex';
        } else if (customDateRange) {
          customDateRange.style.display = 'none';
          
          // Atualizar filtro e recarregar
          filters.period = this.value;
          filters.dateStart = null;
          filters.dateEnd = null;
          
          loadDashboardData();
        }
      });
    }
    
    // Filtro de status
    const statusSelect = document.getElementById('dashboard-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', function() {
        filters.status = this.value;
        loadDashboardData();
      });
    }
    
    // Botão de aplicar filtro de data
    const applyDateFilter = document.getElementById('apply-date-filter');
    if (applyDateFilter) {
      applyDateFilter.addEventListener('click', function() {
        const dateStart = document.getElementById('date-start');
        const dateEnd = document.getElementById('date-end');
        
        if (dateStart && dateEnd && dateStart.value && dateEnd.value) {
          filters.dateStart = dateStart.value;
          filters.dateEnd = dateEnd.value;
          loadDashboardData();
        } else {
          // Usar sistema de notificações se disponível
          const Notifications = ModuleLoader.get('notifications');
          if (Notifications) {
            Notifications.warning('Selecione datas válidas para o filtro');
          } else {
            alert('Selecione datas válidas para o filtro');
          }
        }
      });
    }
    
    // Botão de atualizar
    const refreshButton = document.getElementById('refresh-dashboard');
    if (refreshButton) {
      refreshButton.addEventListener('click', function() {
        loadDashboardData(true); // Forçar atualização
      });
    }
  }
  
  // Carregar dados do dashboard
  function loadDashboardData(forceRefresh = false) {
    if (isLoading) return;
    
    isLoading = true;
    showLoadingState();
    
    // Verificar se há dados em cache que podem ser usados
    const CacheManager = ModuleLoader.get('cacheManager');
    const cachedData = CacheManager?.getItem('dashboard_data');
    
    // Se tiver dados em cache e não estiver forçando atualização, usar os dados em cache
    if (!forceRefresh && cachedData) {
      processDashboardData(cachedData);
      return;
    }
    
    // Preparar parâmetros do filtro
    const params = {
      period: filters.period,
      status: filters.status
    };
    
    if (filters.dateStart && filters.dateEnd) {
      params.dateStart = filters.dateStart;
      params.dateEnd = filters.dateEnd;
    }
    
    // Fazer chamada à API
    const ApiClient = ModuleLoader.get('apiClient') || window.ApiClient;
    
    if (!ApiClient) {
      console.error('Dashboard: Módulo apiClient não encontrado');
      isLoading = false;
      showErrorState('Erro: Não foi possível se conectar à API');
      return;
    }
    
    ApiClient.callApi('getDashboardData', params)
      .then(response => {
        if (response.success && response.data) {
          // Salvar no cache
          if (CacheManager) {
            CacheManager.setItem('dashboard_data', response.data, 30); // 30 minutos
          }
          
          processDashboardData(response.data);
        } else {
          throw new Error(response.message || 'Erro ao carregar dados do dashboard');
        }
      })
      .catch(error => {
        console.error('Erro ao carregar dashboard:', error);
        showErrorState('Erro ao carregar dados: ' + error.message);
        isLoading = false;
      });
  }
  
  // Processar dados recebidos
  function processDashboardData(data) {
    dashboardData = data;
    
    // Atualizar a UI com os dados
    renderStatistics(data.statistics);
    renderCharts(data);
    renderRecentMaintenances(data.recentMaintenances);
    
    isLoading = false;
  }
  
  // Mostrar estado de carregamento
  function showLoadingState() {
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="dashboard-loading text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
          <p class="mt-2">Carregando estatísticas...</p>
        </div>
      `;
    }
    
    if (maintenanceList) {
      maintenanceList.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
              <span class="visually-hidden">Carregando...</span>
            </div>
            Carregando dados...
          </td>
        </tr>
      `;
    }
  }
  
  // Mostrar estado de erro
  function showErrorState(message) {
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          ${message}
        </div>
      `;
    }
    
    if (maintenanceList) {
      maintenanceList.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-3 text-danger">
            <i class="bi bi-exclamation-circle me-2"></i>
            Erro ao carregar dados
          </td>
        </tr>
      `;
    }
  }
  
  // Renderizar estatísticas
  function renderStatistics(stats) {
    if (!statsContainer || !stats) return;
    
    statsContainer.innerHTML = `
      <div class="row">
        <div class="col-md-3 col-6">
          <div class="stat-card stat-total">
            <div class="stat-icon">
              <i class="bi bi-clipboard-check"></i>
            </div>
            <div class="stat-content">
              <h3>${stats.total || 0}</h3>
              <p>Total de Manutenções</p>
            </div>
          </div>
        </div>
        <div class="col-md-3 col-6">
          <div class="stat-card stat-pending">
            <div class="stat-icon">
              <i class="bi bi-hourglass-split"></i>
            </div>
            <div class="stat-content">
              <h3>${stats.pending || 0}</h3>
              <p>Pendentes</p>
            </div>
          </div>
        </div>
        <div class="col-md-3 col-6">
          <div class="stat-card stat-completed">
            <div class="stat-icon">
              <i class="bi bi-check-circle"></i>
            </div>
            <div class="stat-content">
              <h3>${stats.completed || 0}</h3>
              <p>Concluídas</p>
            </div>
          </div>
        </div>
        <div class="col-md-3 col-6">
          <div class="stat-card stat-urgent">
            <div class="stat-icon">
              <i class="bi bi-exclamation-triangle"></i>
            </div>
            <div class="stat-content">
              <h3>${stats.urgent || 0}</h3>
              <p>Urgentes</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dashboard-period-info mt-3 text-muted">
        <small>
          <i class="bi bi-info-circle"></i> 
          Dados ${filters.period === 'all' ? 'de todo o período' : 
                  filters.period === 'month' ? 'do último mês' : 
                  filters.period === 'week' ? 'da última semana' : 
                  'do período selecionado'}
        </small>
      </div>
    `;
    
    // Adicionar estilos inline para os cards de estatísticas
    const style = document.createElement('style');
    style.textContent = `
      .stat-card {
        background-color: white;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        display: flex;
        align-items: center;
        height: 100%;
      }
      
      .stat-icon {
        font-size: 28px;
        margin-right: 15px;
        width: 40px;
        text-align: center;
      }
      
      .stat-content h3 {
        font-size: 1.8rem;
        margin: 0;
        font-weight: 600;
      }
      
      .stat-content p {
        margin: 0;
        color: #6c757d;
        font-size: 14px;
      }
      
      .stat-total .stat-icon {
        color: #3498db;
      }
      
      .stat-pending .stat-icon {
        color: #f39c12;
      }
      
      .stat-completed .stat-icon {
        color: #2ecc71;
      }
      
      .stat-urgent .stat-icon {
        color: #e74c3c;
      }
      
      body.dark-mode .stat-card {
        background-color: #2c2c2c;
      }
      
      body.dark-mode .stat-content p {
        color: #adb5bd;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // Renderizar gráficos
  function renderCharts(data) {
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js não disponível. Gráficos não serão renderizados.');
      return;
    }
    
    // Destruir gráficos existentes para evitar duplicação
    if (statusChartInstance) statusChartInstance.destroy();
    if (maintenanceTypeChartInstance) maintenanceTypeChartInstance.destroy();
    if (urgencyChartInstance) urgencyChartInstance.destroy();
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    
    // Renderizar cada gráfico
    renderStatusChart(data.statusDistribution);
    renderMaintenanceTypeChart(data.problemCategories);
    renderUrgencyChart(data.urgencyLevels);
    renderMonthlyChart(data.monthlyData);
  }
  
  // Renderizar gráfico de status
  function renderStatusChart(statusData) {
    const canvas = document.getElementById('status-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    statusChartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: statusData.map(item => item.status),
        datasets: [{
          data: statusData.map(item => item.count),
          backgroundColor: [
            '#2ecc71', // Concluído
            '#f39c12', // Em andamento
            '#3498db', // Agendado
            '#e74c3c'  // Cancelado
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
  }
  
  // Renderizar gráfico de tipos de manutenção
  function renderMaintenanceTypeChart(categoryData) {
    const canvas = document.getElementById('maintenance-type-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    maintenanceTypeChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categoryData.map(item => item.category),
        datasets: [{
          label: 'Número de Manutenções',
          data: categoryData.map(item => item.count),
          backgroundColor: '#3498db',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }
  
  // Renderizar gráfico de urgência
  function renderUrgencyChart(urgencyData) {
    const canvas = document.getElementById('urgency-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    urgencyChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: urgencyData.map(item => item.level),
        datasets: [{
          data: urgencyData.map(item => item.count),
          backgroundColor: [
            '#2ecc71', // Baixa
            '#f39c12', // Média
            '#e74c3c'  // Alta
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
  }
  
  // Renderizar gráfico mensal
  function renderMonthlyChart(monthlyData) {
    const canvas = document.getElementById('monthly-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    monthlyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthlyData.map(item => item.month),
        datasets: [{
          label: 'Manutenções',
          data: monthlyData.map(item => item.count),
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }
  
  // Renderizar lista de manutenções recentes
  function renderRecentMaintenances(maintenances) {
    if (!maintenanceList || !Array.isArray(maintenances)) return;
    
    if (maintenances.length === 0) {
      maintenanceList.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-3">
            Nenhuma manutenção encontrada no período.
          </td>
        </tr>
      `;
      return;
    }
    
    maintenanceList.innerHTML = maintenances.map(item => `
      <tr>
        <td>${item.id}</td>
        <td>${formatDate(item.date)}</td>
        <td>${item.vehicle} (${item.plate})</td>
        <td>${item.problem}</td>
        <td>
          <span class="badge bg-${getStatusColor(item.status)}">${item.status}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="viewMaintenance('${item.id}')">
            <i class="bi bi-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }
  
  // Obter cor para status
  function getStatusColor(status) {
    switch (status.toLowerCase()) {
      case 'concluído':
      case 'concluido':
      case 'finalizado':
        return 'success';
      case 'em andamento':
      case 'iniciado':
        return 'warning';
      case 'agendado':
      case 'pendente':
        return 'primary';
      case 'cancelado':
        return 'danger';
      default:
        return 'secondary';
    }
  }
  
  // Formatar data
  function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('pt-BR');
  }
  
  // Retornar interface pública
  return {
    init,
    loadDashboardData,
    renderStatistics,
    renderCharts,
    renderRecentMaintenances
  };
});
