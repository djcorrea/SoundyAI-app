// reference-flow.js
// 🎯 Controlador ISOLADO e DETERMINÍSTICO para fluxo de Análise de Referência
// 
// FLUXO CORRETO:
// 1) PRIMEIRA MÚSICA (Base): Upload → Análise → Salvar métricas base → Abrir modal 2ª música
// 2) SEGUNDA MÚSICA (Compare): Upload → Análise com comparação → Renderizar deltas + sugestões
//
// REGRAS DE OURO:
// - Mode 'reference' SEMPRE vem do estado explícito, NUNCA de heurística
// - Stage 'base' vs 'compare' é determinado pelo fluxo, não por cache
// - Reset automático ao iniciar novo fluxo ou mudar para genre
// - Persistência em sessionStorage (nunca localStorage para referência)

(function() {
  'use strict';

  const STORAGE_KEY = 'REF_FLOW_V1';
  const DEBUG_PREFIX = '[REF-FLOW]';

  /**
   * Estados possíveis do fluxo
   * @enum {string}
   */
  const Stage = {
    IDLE: 'idle',                      // Nenhum fluxo ativo
    BASE_UPLOADING: 'base_uploading',  // Upload da 1ª música em progresso
    BASE_PROCESSING: 'base_processing',// Processando 1ª música
    AWAITING_SECOND: 'awaiting_second',// Base completada, aguardando 2ª música
    COMPARE_UPLOADING: 'compare_uploading', // Upload da 2ª música em progresso
    COMPARE_PROCESSING: 'compare_processing', // Processando comparação
    DONE: 'done'                       // Fluxo completo
  };

  /**
   * Controlador de fluxo de referência
   */
  class ReferenceFlowController {
    constructor() {
      this.state = this._getInitialState();
      this._restore();
      console.log(DEBUG_PREFIX, 'Initialized', this.state);
    }

    /**
     * Estado inicial limpo
     */
    _getInitialState() {
      return {
        stage: Stage.IDLE,
      sessionId: null,           // UUID para anti-vazamento
      baseJobId: null,
      baseMetrics: null,
      baseFileName: null,
      compareJobId: null,
      startedAt: null,
      traceId: null
    };
  }
  
  /**
   * Gerar UUID v4 simples
   */
  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.state = { ...this._getInitialState(), ...parsed };
          console.log(DEBUG_PREFIX, 'Restored from sessionStorage', this.state);
        }
      } catch (error) {
        console.error(DEBUG_PREFIX, 'Failed to restore state', error);
      }
    }

    /**
     * Persistir estado no sessionStorage
     */
    _persist() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        console.log(DEBUG_PREFIX, 'Persisted', this.state);
      } catch (error) {
        console.error(DEBUG_PREFIX, 'Failed to persist state', error);
      }
    }

    /**
     * Resetar fluxo completamente
     */
    reset() {
      console.log(DEBUG_PREFIX, 'reset() - Limpando estado de referência');
    
    const oldSessionId = this.state.sessionId;
    this.state = this._getInitialState();
    this._persist();
    
    // Limpar variáveis globais antigas (compatibilidade)
    if (typeof window !== 'undefined') {
      delete window.__REFERENCE_JOB_ID__;
      delete window.lastReferenceJobId;
      
      // Limpar storages antigos
      try {
        localStorage.removeItem('referenceJobId');
        sessionStorage.removeItem('referenceJobId');
   * @returns {string} sessionId para validação
   */
  startNewReferenceFlow() {
    console.log(DEBUG_PREFIX, 'startNewReferenceFlow() - FORÇANDO RESET TOTAL');
    
    // ✅ RESET FORÇADO antes de qualquer coisa
    this.reset();
    
    this.state.stage = Stage.IDLE;
    this.state.sessionId = this._generateUUID();
    this.state.startedAt = new Date().toISOString();
    this.state.traceId = `ref_${Date.now()}`;
    
    this._persist();
    
    console.log(DEBUG_PREFIX, '✅ Novo fluxo iniciado');
    console.log(DEBUG_PREFIX, 'sessionId:', this.state.sessionId);
    console.log(DEBUG_PREFIX, 'traceId:', this.state.traceId);
    console.log(DEBUG_PREFIX, 'stage:', this.state.stage);
    console.log(DEBUG_PREFIX, 'baseJobId:', this.state.baseJobId, '(deve ser null)');
    
    return this.state.sessionId;      
      this._persist();
      
      console.log(DEBUG_PREFIX, 'Novo fluxo iniciado', this.state.traceId);
      return this.state.traceId;
    }

    /**
     * Usuário selecionou primeira música
     */
    onFirstTrackSelected() {
      console.log(DEBUG_PREFIX, 'onFirstTrackSelected()');
      
      if (this.state.stage !== Stage.IDLE) {
        console.warn(DEBUG_PREFIX, 'Iniciando nova análise - resetando fluxo anterior');
        this.reset();
        this.startNewReferenceFlow();
      }
      
      this.state.stage = Stage.BASE_UPLOADING;
      this._persist();
      
      console.log(DEBUG_PREFIX, 'Stage:', Stage.BASE_UPLOADING);
    }

    /**
     * Primeira música começou a processar
     * @param {string} jobId
     */
    onFirstTrackProcessing(jobId) {
      console.log(DEBUG_PREFIX, 'onFirstTrackProcessing()', jobId);
      
      this.state.stage = Stage.BASE_PROCESSING;
      this.state.baseJobId = jobId;
      this._persist();
      
      console.log(DEBUG_PREFIX, 'Base processando, jobId:', jobId);
    }

    /**
     * Primeira música completada - salvar métricas base
     * @param {Object} result - Resultado completo da análise base
     */
    onFirstTrackCompleted(result) {
      console.log(DEBUG_PREFIX, 'onFirstTrackCompleted()', result?.jobId);
      
      if (!result || !result.jobId) {
        console.error(DEBUG_PREFIX, 'onFirstTrackCompleted() - resultado inválido', result);
        return;
      }
      
      // Salvar SOMENTE métricas necessárias (não suggestions de gênero)
      this.state.baseJobId = result.jobId;
      this.state.baseMetrics = {
        lufsIntegrated: result.technicalData?.lufsIntegrated,
        truePeakDbtp: result.technicalData?.truePeakDbtp,
        dynamicRange: result.technicalData?.dynamicRange,
        stereoCorrelation: result.technicalData?.stereoCorrelation,
        lra: result.technicalData?.lra,
        spectralBands: result.spectralAnalysis?.spectralBands,
        rmsEnergy: result.technicalData?.rmsEnergy,
        crestFactor: result.technicalData?.crestFactor
      };
      this.state.baseFileName = result.metadata?.fileName || result.fileName || 'unknown';
    console.log(DEBUG_PREFIX, 'sessionId:', this.state.sessionId);
     */
    onCompareProcessing() {
      console.log(DEBUG_PREFIX, 'onCompareProcessing()');
      
      this.state.stage = Stage.COMPARE_PROCESSING;
      this._persist();
      
      console.log(DEBUG_PREFIX, 'Stage:', Stage.COMPARE_PROCESSING);
    }

    /**
     * Comparação completada
     * @param {Object} result - Resultado com comparação e sugestões
     */
    onCompareCompleted(result) {
      console.log(DEBUG_PREFIX, 'onCompareCompleted()', result?.jobId);
      
      this.state.stage = Stage.DONE;
      this._persist();
      
      console.log(DEBUG_PREFIX, '✅ Fluxo de referência completo');
      console.log(DEBUG_PREFIX, 'Stage:', Stage.DONE);
    }

    /**
     * Verificar se está aguardando segunda música
     */
    isAwaitingSecond() {
      return this.state.stage === Stage.AWAITING_SECOND;
   * @param {string} jobId - ID do job de comparação
   */
  onCompareProcessing(jobId) {
    console.log(DEBUG_PREFIX, 'onCompareProcessing()', jobId);
    
    this.state.stage = Stage.COMPARE_PROCESSING;
    this.state.compareJobId = jobId;
    this._persist();
    
    console.log(DEBUG_PREFIX, 'Stage:', Stage.COMPARE_PROCESSING);
    console.log(DEBUG_PREFIX, 'compareJobId:', jobId);
    /**
     * Verificar se é segunda música (compare)
     */
    isSecondTrack() {
      return this.state.stage === Stage.COMPARE_UPLOADING || 
             this.state.stage === Stage.COMPARE_PROCESSING;
    }

    /**
     * Obter jobId da base
     */
    getBaseJobId() {
      return this.state.baseJobId;
    }

    /**
     * Obter métricas da base
     */
    getBaseMetrics() {
      return this.state.baseMetrics;
    }

    /**
     * Obter sessionId atual
     */
    getSessionId() {
      return this.state.sessionId;
    }

    /**
     * Obter jobId da base
     */
    getBaseJobId() {
      return this.state.baseJobId;
    }

    /**
     * Obter métricas da base
     */
    getBaseMetrics() {
      return this.state.baseMetrics;
    }

    /**
     * Obter stage atual
     */
    getStage() {
      return this.state.stage;
    }

    /**
     * Validar se evento pertence ao fluxo atual
     * @param {string} sessionId - sessionId do evento
     * @returns {boolean} true se válido
     */
    validateSession(sessionId) {
      if (!this.state.sessionId) {
        console.warn(DEBUG_PREFIX, 'validateSession() - sem sessionId ativo');
        return false;
      }
      
      const isValid = sessionId === this.state.sessionId;
      
      if (!isValid) {
        console.warn(DEBUG_PREFIX, '⚠️ EVENTO REJEITADO - sessionId incompatível');
        console.warn(DEBUG_PREFIX, 'Esperado:', this.state.sessionId);
        console.warn(DEBUG_PREFIX, 'Recebido:', sessionId);
      }
      
      return isValid;
    }

    /**
     * Debug info
     */
    getDebugInfo() {
      return {
        ...this.state,
        Stage, // Enums disponíveis
        isAwaitingSecond: this.isAwaitingSecond(),
        isFirstTrack: this.isFirstTrack(),
        isSecondTrack: this.isSecondTrack()
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // EXPOR GLOBALMENTE
  // ════════════════════════════════════════════════════════════════════════
  
  window.ReferenceFlowController = ReferenceFlowController;
  window.ReferenceFlowStage = Stage;

  // Instância global singleton
  if (!window.referenceFlow) {
    window.referenceFlow = new ReferenceFlowController();
  }

  console.log('[REF-FLOW] ✅ Módulo carregado - window.referenceFlow disponível');

})();
