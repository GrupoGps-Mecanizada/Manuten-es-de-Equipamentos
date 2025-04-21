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
      status: 'Conc
