// form-handler.js

/**
 * Manipulador de formulários do sistema
 */
const FormHandler = {
  // Estado do formulário atual
  currentFormData: {
    id: null,
    etapa: 'pre', // 'pre' ou 'pos'
    dadosPre: null,
    dadosPos: null
  },
  
  /**
   * Inicializar manipulador de formulários
   */
  init: function() {
    // Configurar eventos dos formulários
    this.setupFormEvents();
  },
  
  /**
   * Configurar eventos dos formulários
   */
  setupFormEvents: function() {
    // Formulário PRÉ-manutenção
    const formPre = document.getElementById('formPreManutencao');
    if (formPre) {
      formPre.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePreFormSubmit();
      });
    }
    
    // Formulário PÓS-manutenção
    const formPos = document.getElementById('formPosManutencao');
    if (formPos) {
      formPos.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePosFormSubmit();
      });
    }
    
    // Botão cancelar
    document.getElementById('btnCancelarPre').addEventListener('click', () => {
      if (confirm('Deseja cancelar o registro? Os dados não salvos serão perdidos.')) {
        this.resetForm();
        Utils.showScreen('telaListaRegistros');
      }
    });
    
    // Botão voltar para pré
    document.getElementById('btnVoltarPre').addEventListener('click', () => {
      Utils.showScreen('telaPreManutencao');
    });
  },
  
  /**
   * Tratar envio do formulário PRÉ-manutenção
   */
  handlePreFormSubmit: function() {
    const form = document.getElementById('formPreManutencao');
    
    // Validar formulário
    if (!Utils.validateForm(form)) {
      return;
    }
    
    // Criar ou atualizar ID do registro
    if (!this.currentFormData.id) {
      this.currentFormData.id = Utils.generateId();
    }
    
    // Atualizar elemento hidden com ID
    document.getElementById('registroId').value = this.currentFormData.id;
    document.getElementById('registroIdPos').value = this.currentFormData.id;
    
    // Mostrar ID nos displays
    document.getElementById('registroIdDisplay').textContent = this.currentFormData.id;
    document.getElementById('registroIdPosDisplay').textContent = this.currentFormData.id;
    
    // Coletar dados do formulário
    this.currentFormData.dadosPre = {
      placa: document.getElementById('placa').value,
      modelo: document.getElementById('modelo').value,
      idInterna: document.getElementById('idInterna').value,
      quilometragem: document.getElementById('quilometragem').value,
      categoriaProblema: document.getElementById('categoriaProblema').value,
      urgencia: document.getElementById('urgencia').value,
      descricaoProblema: document.getElementById('descricaoProblema').value,
      observacoes: document.getElementById('observacoesPre').value,
      responsavel: document.getElementById('responsavel').value,
      timestamp: new Date().toISOString(),
      checklist: {
        hidraulico: document.querySelector('input[name="hidraulico"]:checked')?.value || 'N/A',
        eletrico: document.querySelector('input[name="eletrico"]:checked')?.value || 'N/A',
        bomba: document.querySelector('input[name="bomba"]:checked')?.value || 'N/A'
      }
    };
    
    // Salvar temporariamente
    this.saveCurrentFormData();
    
    // Preencher campos na tela PÓS
    document.getElementById('placaPos').textContent = this.currentFormData.dadosPre.placa;
    document.getElementById('modeloPos').textContent = this.currentFormData.dadosPre.modelo;
    document.getElementById('idInternaPos').textContent = this.currentFormData.dadosPre.idInterna;
    
    // Avançar para o formulário PÓS-manutenção
    Utils.showScreen('telaPosManutencao');
    
    Utils.showNotification('Dados iniciais salvos com sucesso!', 'success');
  },
  
  /**
   * Tratar envio do formulário PÓS-manutenção
   */
  handlePosFormSubmit: async function() {
    const form = document.getElementById('formPosManutencao');
    
    // Validar formulário
    if (!Utils.validateForm(form)) {
      return;
    }
    
    // Coletar dados do formulário
    this.currentFormData.dadosPos = {
      observacoes: document.getElementById('observacoesPos').value,
      timestamp: new Date().toISOString(),
      checklist: {
        hidraulico: document.querySelector('input[name="hidraulicoPos"]:checked')?.value || 'N/A',
        eletrico: document.querySelector('input[name="eletricoPos"]:checked')?.value || 'N/A',
        bomba: document.querySelector('input[name="bombaPos"]:checked')?.value || 'N/A'
      }
    };
    
    // Obter dados de fotos
    const photoData = PhotoHandler.getPhotoData();
    
    // Montar objeto completo do registro
    const registroCompleto = {
      id: this.currentFormData.id,
      dataCriacao: this.currentFormData.dadosPre.timestamp,
      dataAtualizacao: new Date().toISOString(),
      placa: this.currentFormData.dadosPre.placa,
      modelo: this.currentFormData.dadosPre.modelo,
      idInterna: this.currentFormData.dadosPre.idInterna,
      responsavel: this.currentFormData.dadosPre.responsavel,
      status: 'Concluído',
      quilometragem: this.currentFormData.dadosPre.quilometragem,
      categoriaProblema: this.currentFormData.dadosPre.categoriaProblema,
      urgencia: this.currentFormData.dadosPre.urgencia,
      descricaoProblema: this.currentFormData.dadosPre.descricaoProblema,
      observacoesPre: this.currentFormData.dadosPre.observacoes,
      checklistPre: this.currentFormData.dadosPre.checklist,
      fotosPre: photoData.pre,
      dataManutencao: this.currentFormData.dadosPos.timestamp,
      observacoesPos: this.currentFormData.dadosPos.observacoes,
      checklistPos: this.currentFormData.dadosPos.checklist,
      fotosPos: photoData.pos
    };
    
    try {
      Utils.showLoading();
      
      // Tentar salvar no servidor
      const result = await ApiClient.salvarRegistro(registroCompleto);
      
      if (result.success) {
        Utils.showNotification('Registro salvo com sucesso!', 'success');
        
        // Limpar formulário e voltar para lista
        this.resetForm();
        await App.refreshRegistrosList();
        Utils.showScreen('telaListaRegistros');
      } else {
        throw new Error('Erro ao salvar registro');
      }
    } catch (error) {
      console.error('Erro ao finalizar registro:', error);
      
      // Tentar salvar localmente
      const localSave = this.saveRegistroLocally(registroCompleto);
      
      if (localSave) {
        Utils.showNotification('Registro salvo localmente. Será sincronizado quando houver conexão.', 'warning');
        
        // Limpar formulário e voltar para lista
        this.resetForm();
        await App.refreshRegistrosList();
        Utils.showScreen('telaListaRegistros');
      } else {
        Utils.showNotification('Erro ao salvar registro.', 'error');
      }
    } finally {
      Utils.hideLoading();
    }
  },
  
  /**
   * Salvar registro localmente
   * @param {object} registro - Dados do registro
   * @returns {boolean} - Sucesso da operação
   */
  saveRegistroLocally: function(registro) {
    try {
      // Obter registros existentes
      const registros = Utils.retrieveData('registros') || [];
      
      // Verificar se já existe para atualizar
      const index = registros.findIndex(r => r.id === registro.id);
      
      if (index !== -1) {
        registros[index] = registro;
      } else {
        registros.push(registro);
      }
      
      // Salvar no localStorage
      Utils.storeData('registros', registros);
      
      // Adicionar à fila de sincronização
      const syncQueue = Utils.retrieveData('syncQueue') || [];
      
      if (!syncQueue.some(r => r.id === registro.id)) {
        syncQueue.push({
          id: registro.id,
          timestamp: new Date().toISOString()
        });
        
        Utils.storeData('syncQueue', syncQueue);
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar localmente:', error);
      return false;
    }
  },
  
  /**
   * Salvar dados do formulário atual no localStorage
   */
  saveCurrentFormData: function() {
    Utils.storeData('currentFormData', this.currentFormData);
  },
  
  /**
   * Carregar dados do formulário do localStorage
   */
  loadCurrentFormData: function() {
    const data = Utils.retrieveData('currentFormData');
    
    if (data) {
      this.currentFormData = data;
      return true;
    }
    
    return false;
  },
  
  /**
   * Resetar formulário e dados
   */
  resetForm: function() {
    // Limpar formulários
    document.getElementById('formPreManutencao').reset();
    document.getElementById('formPosManutencao').reset();
    
    // Remover validação
    document.getElementById('formPreManutencao').classList.remove('was-validated');
    document.getElementById('formPosManutencao').classList.remove('was-validated');
    
    // Resetar dados
    this.currentFormData = {
      id: null,
      etapa: 'pre',
      dadosPre: null,
      dadosPos: null
    };
    
    // Limpar foto handler
    PhotoHandler.photoData = { pre: [], pos: [] };
    PhotoHandler.renderPhotos('pre');
    PhotoHandler.renderPhotos('pos');
    
    // Limpar localStorage
    localStorage.removeItem('currentFormData');
    localStorage.removeItem('photoData');
  },
  
  /**
   * Iniciar novo registro
   */
  newRegistro: function() {
    // Resetar formulário
    this.resetForm();
    
    // Definir novo ID
    this.currentFormData.id = Utils.generateId();
    document.getElementById('registroId').value = this.currentFormData.id;
    document.getElementById('registroIdDisplay').textContent = this.currentFormData.id;
    
    // Mostrar tela de registro inicial
    Utils.showScreen('telaPreManutencao');
  },
  
  /**
   * Carregar registro para edição
   * @param {string} id - ID do registro
   */
  loadRegistro: async function(id) {
    try {
      Utils.showLoading();
      
      // Buscar registro
      const registro = await ApiClient.obterRegistro(id);
      
      if (!registro) {
        throw new Error('Registro não encontrado');
      }
      
      // Configurar dados atuais
      this.currentFormData = {
        id: registro.id,
        etapa: 'pre',
        dadosPre: {
          placa: registro.placa,
          modelo: registro.modelo,
          idInterna: registro.idInterna,
          quilometragem: registro.quilometragem,
          categoriaProblema: registro.categoriaProblema,
          urgencia: registro.urgencia,
          descricaoProblema: registro.descricaoProblema,
          observacoes: registro.observacoesPre,
          responsavel: registro.responsavel,
          timestamp: registro.dataCriacao,
          checklist: registro.checklistPre || {}
        },
        dadosPos: registro.observacoesPos ? {
          observacoes: registro.observacoesPos,
          timestamp: registro.dataManutencao,
          checklist: registro.checklistPos || {}
        } : null
      };
      
      // Preencher formulário PRÉ
      document.getElementById('registroId').value = registro.id;
      document.getElementById('registroIdDisplay').textContent = registro.id;
      document.getElementById('placa').value = registro.placa || '';
      document.getElementById('modelo').value = registro.modelo || '';
      document.getElementById('idInterna').value = registro.idInterna || '';
      document.getElementById('quilometragem').value = registro.quilometragem || '';
      document.getElementById('categoriaProblema').value = registro.categoriaProblema || '';
      document.getElementById('urgencia').value = registro.urgencia || '';
      document.getElementById('descricaoProblema').value = registro.descricaoProblema || '';
      document.getElementById('observacoesPre').value = registro.observacoesPre || '';
      document.getElementById('responsavel').value = registro.responsavel || '';
      
      // Preencher checklist PRÉ
      if (registro.checklistPre) {
        if (registro.checklistPre.hidraulico) {
          document.querySelector(`input[name="hidraulico"][value="${registro.checklistPre.hidraulico}"]`).checked = true;
        }
        if (registro.checklistPre.eletrico) {
          document.querySelector(`input[name="eletrico"][value="${registro.checklistPre.eletrico}"]`).checked = true;
        }
        if (registro.checklistPre.bomba) {
          document.querySelector(`input[name="bomba"][value="${registro.checklistPre.bomba}"]`).checked = true;
        }
      }
      
      // Carregar fotos
      if (registro.fotosPre || registro.fotosPos) {
        PhotoHandler.setPhotoData({
          pre: registro.fotosPre || [],
          pos: registro.fotosPos || []
        });
      }
      
      // Se já tiver dados PÓS, preencher também
      if (registro.observacoesPos) {
        // Preencher campos na tela PÓS
        document.getElementById('registroIdPos').value = registro.id;
        document.getElementById('registroIdPosDisplay').textContent = registro.id;
        document.getElementById('placaPos').textContent = registro.placa;
        document.getElementById('modeloPos').textContent = registro.modelo;
        document.getElementById('idInternaPos').textContent = registro.idInterna;
        document.getElementById('observacoesPos').value = registro.observacoesPos || '';
        
        // Preencher checklist PÓS
        if (registro.checklistPos) {
          if (registro.checklistPos.hidraulico) {
            document.querySelector(`input[name="hidraulicoPos"][value="${registro.checklistPos.hidraulico}"]`).checked = true;
          }
          if (registro.checklistPos.eletrico) {
            document.querySelector(`input[name="eletricoPos"][value="${registro.checklistPos.eletrico}"]`).checked = true;
          }
          if (registro.checklistPos.bomba) {
            document.querySelector(`input[name="bombaPos"][value="${registro.checklistPos.bomba}"]`).checked = true;
          }
        }
      }
      
      // Mostrar tela de edição
      Utils.showScreen('telaPreManutencao');
      
      return true;
    } catch (error) {
      console.error('Erro ao carregar registro:', error);
      Utils.showNotification('Erro ao carregar registro.', 'error');
      return false;
    } finally {
      Utils.hideLoading();
    }
  },
  
  /**
   * Carregar registro para visualização
   * @param {string} id - ID do registro
   */
  viewRegistro: async function(id) {
    try {
      Utils.showLoading();
      
      // Buscar registro
      const registro = await ApiClient.obterRegistro(id);
      
      if (!registro) {
        throw new Error('Registro não encontrado');
      }
      
      // Preencher dados na tela de visualização
      document.getElementById('registroIdVisualizar').textContent = registro.id;
      document.getElementById('placaView').textContent = registro.placa || '-';
      document.getElementById('modeloView').textContent = registro.modelo || '-';
      document.getElementById('idInternaView').textContent = registro.idInterna || '-';
      document.getElementById('dataView').textContent = Utils.formatDate(registro.dataCriacao) || '-';
      document.getElementById('responsavelView').textContent = registro.responsavel || '-';
      document.getElementById('statusView').textContent = registro.status || '-';
      document.getElementById('descricaoProblemaView').textContent = registro.descricaoProblema || '-';
      document.getElementById('observacoesPreView').textContent = registro.observacoesPre || '-';
      document.getElementById('observacoesPosView').textContent = registro.observacoesPos || '-';
      
      // Preencher checklist PRÉ
      const checklistPreContainer = document.getElementById('checklistPreView');
      checklistPreContainer.innerHTML = '';
      
      if (registro.checklistPre) {
        for (const item of CONFIG.CHECKLIST_ITEMS) {
          const valor = registro.checklistPre[item.id] || 'N/A';
          const row = document.createElement('tr');
          
          let statusClass = '';
          if (valor === 'OK') statusClass = 'text-success';
          else if (valor === 'Danificado') statusClass = 'text-danger';
          
          row.innerHTML = `
            <td>${item.label}</td>
            <td class="${statusClass}">${valor}</td>
          `;
          
          checklistPreContainer.appendChild(row);
        }
      }
      
      // Preencher checklist PÓS
      const checklistPosContainer = document.getElementById('checklistPosView');
      checklistPosContainer.innerHTML = '';
      
      if (registro.checklistPos) {
        for (const item of CONFIG.CHECKLIST_ITEMS) {
          const valor = registro.checklistPos[item.id] || 'N/A';
          const row = document.createElement('tr');
          
          let statusClass = '';
          if (valor === 'OK') statusClass = 'text-success';
          else if (valor === 'Danificado') statusClass = 'text-danger';
          
          row.innerHTML = `
            <td>${item.label}</td>
            <td class="${statusClass}">${valor}</td>
          `;
          
          checklistPosContainer.appendChild(row);
        }
      }
      
      // Preencher fotos PRÉ
      const fotosPreContainer = document.getElementById('fotosPreView');
      fotosPreContainer.innerHTML = '';
      
      if (registro.fotosPre && registro.fotosPre.length > 0) {
        registro.fotosPre.forEach(foto => {
          const colDiv = document.createElement('div');
          colDiv.className = 'col-md-6 mb-2';
          
          colDiv.innerHTML = `
            <a href="${foto.url || foto.dataURL}" target="_blank" class="d-block">
              <img src="${foto.url || foto.dataURL}" class="img-fluid img-thumbnail" alt="${foto.descricao}" 
                   style="height: 150px; width: 100%; object-fit: cover;">
              <div class="small text-muted mt-1">${foto.descricao}</div>
            </a>
          `;
          
          fotosPreContainer.appendChild(colDiv);
        });
      } else {
        fotosPreContainer.innerHTML = '<div class="col-12"><p class="text-muted">Nenhuma foto registrada</p></div>';
      }
      
      // Preencher fotos PÓS
      const fotosPosContainer = document.getElementById('fotosPosView');
      fotosPosContainer.innerHTML = '';
      
      if (registro.fotosPos && registro.fotosPos.length > 0) {
        registro.fotosPos.forEach(foto => {
          const colDiv = document.createElement('div');
          colDiv.className = 'col-md-6 mb-2';
          
          colDiv.innerHTML = `
            <a href="${foto.url || foto.dataURL}" target="_blank" class="d-block">
              <img src="${foto.url || foto.dataURL}" class="img-fluid img-thumbnail" alt="${foto.descricao}" 
                   style="height: 150px; width: 100%; object-fit: cover;">
              <div class="small text-muted mt-1">${foto.descricao}</div>
            </a>
          `;
          
          fotosPosContainer.appendChild(colDiv);
        });
      } else {
        fotosPosContainer.innerHTML = '<div class="col-12"><p class="text-muted">Nenhuma foto registrada</p></div>';
      }
      
      // Configurar botão de edição
      document.getElementById('btnEditar').onclick = () => {
        this.loadRegistro(id);
      };
      
      // Mostrar tela de visualização
      Utils.showScreen('telaVisualizacao');
      
      return true;
    } catch (error) {
      console.error('Erro ao visualizar registro:', error);
      Utils.showNotification('Erro ao carregar dados do registro.', 'error');
      return false;
    } finally {
      Utils.hideLoading();
    }
  }
};
