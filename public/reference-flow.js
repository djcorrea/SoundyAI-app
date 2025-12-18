// reference-flow.js
//  Controlador ISOLADO e DETERMINSTICO para fluxo de Anlise de Referncia
// 
// FLUXO CORRETO:
// 1) PRIMEIRA MSICA (Base): Upload  Anlise  Salvar mtricas base  Abrir modal 2 msica
// 2) SEGUNDA MSICA (Compare): Upload  Anlise com comparao  Renderizar deltas + sugestes
//
// REGRAS DE OURO:
// - Mode 'reference' SEMPRE vem do estado explcito, NUNCA de heurstica
// - Stage 'base' vs 'compare'  determinado pelo fluxo, no por cache
// - Reset automtico ao iniciar novo fluxo ou mudar para genre
// - Persistncia em sessionStorage (nunca localStorage para referncia)

(function() {
  'use strict';

  const STORAGE_KEY = 'REF_FLOW_V1';
  const DEBUG_PREFIX = '[REF-FLOW]';

  /**
   * Estados possveis do fluxo
   * @enum {string}
   */
  const Stage = {
    IDLE: 'idle',                      // Nenhum fluxo ativo
    BASE_UPLOADING: 'base_uploading',  // Upload da 1 msica em progresso
    BASE_PROCESSING: 'base_processing',// Processando 1 msica
    AWAITING_SECOND: 'awaiting_second',// Base completada, aguardando 2 msica
    COMPARE_UPLOADING: 'compare_uploading', // Upload da 2 msica em progresso
    COMPARE_PROCESSING: 'compare_processing', // Processando comparao
    DONE: 'done'                       // Fluxo completo
  };

  /**
   * Controlador de fluxo de referncia
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
        baseJobId: null,
        baseMetrics: null,
        baseFileName: null,
        compareJobId: null,
        compareMetrics: null,
        compareFileName: null,
        startedAt: null,
        traceId: null
      };
    }

    /**
     * Restaurar estado do sessionStorage
     */
    _restore() {
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
      console.log(DEBUG_PREFIX, 'reset() - Limpando estado de referncia');
      this.state = this._getInitialState();
      this._persist();
      
      // Limpar variveis globais antigas (compatibilidade)
      if (typeof window !== 'undefined') {
        delete window.__REFERENCE_JOB_ID__;
        delete window.lastReferenceJobId;
      }
      
      console.log(DEBUG_PREFIX, 'Reset completo');
    }

    /**
     * Iniciar novo fluxo de referncia
     * @returns {string} traceId para debug
     */
    startNewReferenceFlow() {
      console.log(DEBUG_PREFIX, 'startNewReferenceFlow()');
      
      this.reset();
      
      this.state.stage = Stage.IDLE;
      this.state.startedAt = new Date().toISOString();
      this.state.traceId = `ref_${Date.now()}`;
      
      this._persist();
      
      console.log(DEBUG_PREFIX, 'Novo fluxo iniciado', this.state.traceId);
      return this.state.traceId;
    }
    
    /**
     * Inicializar fluxo se necessrio (idempotente)
     * Garante que existe storage mesmo aps limpar
     */
    initFlowIfNeeded() {
      if (this.state.stage === Stage.IDLE && !this.state.traceId) {
        console.log(DEBUG_PREFIX, 'initFlowIfNeeded() - criando estado inicial');
        this.startNewReferenceFlow();
      }
      return this.state;
    }

    /**
     * Usurio selecionou primeira msica
     */
    onFirstTrackSelected() {
      console.log(DEBUG_PREFIX, 'onFirstTrackSelected()');
      
      if (this.state.stage !== Stage.IDLE) {
        console.warn(DEBUG_PREFIX, 'Iniciando nova anlise - resetando fluxo anterior');
        this.reset();
        this.startNewReferenceFlow();
      }
      
      this.state.stage = Stage.BASE_UPLOADING;
      this._persist();
      
      console.log(DEBUG_PREFIX, 'Stage:', Stage.BASE_UPLOADING);
    }

    /**
     * Primeira msica comeou a processar
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
     * Primeira msica completada - salvar mtricas base
     * @param {Object} result - Resultado completo da anlise base
     */
    onFirstTrackCompleted(result) {
      console.log(DEBUG_PREFIX, 'onFirstTrackCompleted()', result?.jobId);
      
      if (!result || !result.jobId) {
        console.error(DEBUG_PREFIX, 'onFirstTrackCompleted() - resultado invlido', result);
        return;
      }
      
      // Salvar SOMENTE mtricas necessrias (no suggestions de gnero)
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
      this.state.stage = Stage.AWAITING_SECOND;
      
      this._persist();
      
      console.log(DEBUG_PREFIX, ' Base completa - aguardando segunda msica');
      console.log(DEBUG_PREFIX, 'baseJobId:', this.state.baseJobId);
      console.log(DEBUG_PREFIX, 'baseFileName:', this.state.baseFileName);
      console.log(DEBUG_PREFIX, 'Stage:', Stage.AWAITING_SECOND);
    }

    /**
     * Usurio selecionou segunda msica
     */
    onSecondTrackSelected() {
      console.log(DEBUG_PREFIX, 'onSecondTrackSelected()');
      
      if (this.state.stage !== Stage.AWAITING_SECOND) {
        console.error(DEBUG_PREFIX, 'onSecondTrackSelected() chamado fora de ordem!');
        console.error(DEBUG_PREFIX, 'Stage atual:', this.state.stage, '| Esperado:', Stage.AWAITING_SECOND);
        throw new Error('Segunda msica selecionada mas no h base salva');
      }
      
      this.state.stage = Stage.COMPARE_UPLOADING;
      this._persist();
      
      console.log(DEBUG_PREFIX, 'Stage:', Stage.COMPARE_UPLOADING);
    }

    /**
     * Segunda msica comeou a processar
     * @param {string} jobId
     */
    onSecondTrackProcessing(jobId) {
      console.log(DEBUG_PREFIX, 'onSecondTrackProcessing()', jobId);
      
      this.state.stage = Stage.COMPARE_PROCESSING;
      this.state.compareJobId = jobId;
      this._persist();
      
      console.log(DEBUG_PREFIX, 'Compare processando, jobId:', jobId);
    }
    
    // Alias para compatibilidade
    onCompareProcessing(jobId) {
      return this.onSecondTrackProcessing(jobId);
    }

    /**
     * Comparao completada
     * @param {Object} result - Resultado com comparao e sugestes
     */
    onSecondTrackCompleted(result) {
      console.log(DEBUG_PREFIX, 'onSecondTrackCompleted()', result?.jobId);
      
      if (!result || !result.jobId) {
        console.error(DEBUG_PREFIX, 'onSecondTrackCompleted() - resultado invlido', result);
        return;
      }
      
      this.state.compareJobId = result.jobId;
      this.state.compareMetrics = {
        lufsIntegrated: result.technicalData?.lufsIntegrated,
        truePeakDbtp: result.technicalData?.truePeakDbtp,
        dynamicRange: result.technicalData?.dynamicRange,
        stereoCorrelation: result.technicalData?.stereoCorrelation,
        lra: result.technicalData?.lra,
        spectralBands: result.spectralAnalysis?.spectralBands,
        rmsEnergy: result.technicalData?.rmsEnergy,
        crestFactor: result.technicalData?.crestFactor
      };
      this.state.compareFileName = result.metadata?.fileName || result.fileName || 'unknown';
      this.state.stage = Stage.DONE;
      
      this._persist();
      
      console.log(DEBUG_PREFIX, ' Fluxo de referncia completo');
      console.log(DEBUG_PREFIX, 'compareJobId:', this.state.compareJobId);
      console.log(DEBUG_PREFIX, 'compareFileName:', this.state.compareFileName);
      console.log(DEBUG_PREFIX, 'Stage:', Stage.DONE);
    }
    
    // Alias para compatibilidade
    onCompareCompleted(result) {
      return this.onSecondTrackCompleted(result);
    }

    /**
     * Verificar se est aguardando segunda msica
     */
    isAwaitingSecond() {
      return this.state.stage === Stage.AWAITING_SECOND;
    }

    /**
     * Verificar se  primeira msica (base)
     */
    isFirstTrack() {
      return this.state.stage === Stage.BASE_UPLOADING || 
             this.state.stage === Stage.BASE_PROCESSING;
    }

    /**
     * Verificar se  segunda msica (compare)
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
     * Obter mtricas da base
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
     * Debug info
     */
    getDebugInfo() {
      return {
        ...this.state,
        Stage, // Enums disponveis
        isAwaitingSecond: this.isAwaitingSecond(),
        isFirstTrack: this.isFirstTrack(),
        isSecondTrack: this.isSecondTrack()
      };
    }
  }

  // 
  // EXPOR GLOBALMENTE
  // 
  
  window.ReferenceFlowController = ReferenceFlowController;
  window.ReferenceFlowStage = Stage;

  // Instancia global singleton
  if (!window.referenceFlow) {
    window.referenceFlow = new ReferenceFlowController();
  }

  /**
   * Getter function para compatibilidade com codigo existente
   * @returns {ReferenceFlowController}
   */
  window.getRefFlow = function getRefFlow() {
    if (!window.referenceFlow) {
      console.warn('[REF-FLOW] referenceFlow nao inicializado, criando instancia...');
      window.referenceFlow = new ReferenceFlowController();
    }
    return window.referenceFlow;
  };

  console.log('[REF-FLOW] Modulo carregado - window.referenceFlow e window.getRefFlow() disponiveis');

})();
