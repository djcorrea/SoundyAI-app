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
      this.jobBindings = new Map(); // jobId -> { track: 'base'|'compare', baseJobId, referenceJobId }
      this._restore();
      this._restoreBindings();
      log(DEBUG_PREFIX, 'Initialized', this.state);
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
          log(DEBUG_PREFIX, 'Restored from sessionStorage', this.state);
        }
      } catch (error) {
        error(DEBUG_PREFIX, 'Failed to restore state', error);
      }
    }

    /**
     * Persistir estado no sessionStorage
     */
    _persist() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        log(DEBUG_PREFIX, 'Persisted', this.state);
      } catch (error) {
        error(DEBUG_PREFIX, 'Failed to persist state', error);
      }
    }

    /**
     * Restaurar bindings do sessionStorage
     */
    _restoreBindings() {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY + '_BINDINGS');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.jobBindings = new Map(Object.entries(parsed));
          log('[REF-BIND] Restored bindings:', this.jobBindings.size, 'jobs');
        }
      } catch (error) {
        error('[REF-BIND] Failed to restore bindings', error);
      }
    }

    /**
     * Persistir bindings no sessionStorage
     */
    _persistBindings() {
      try {
        const obj = Object.fromEntries(this.jobBindings);
        sessionStorage.setItem(STORAGE_KEY + '_BINDINGS', JSON.stringify(obj));
        log('[REF-BIND] Persisted', this.jobBindings.size, 'bindings');
      } catch (error) {
        error('[REF-BIND] Failed to persist bindings', error);
      }
    }

    /**
     * Bind um jobId com tipo de track
     * @param {string} jobId
     * @param {Object} binding - { track: 'base'|'compare', baseJobId, referenceJobId }
     */
    bindJob(jobId, binding) {
      if (!jobId) {
        error('[REF-BIND] jobId inválido:', jobId);
        return;
      }
      
      this.jobBindings.set(jobId, binding);
      this._persistBindings();
      
      log('[REF-BIND] Job bound:', jobId, binding);
    }

    /**
     * Obter binding de um jobId
     * @param {string} jobId
     * @returns {Object|null} binding ou null
     */
    getJobBinding(jobId) {
      return this.jobBindings.get(jobId) || null;
    }

    /**
     * Limpar todos os bindings
     */
    clearBindings() {
      this.jobBindings.clear();
      this._persistBindings();
      log('[REF-BIND] Bindings cleared');
    }

    /**
     * Resetar fluxo completamente
     */
    reset() {
      log(DEBUG_PREFIX, 'reset() - Limpando estado de referência');
      this.state = this._getInitialState();
      this.clearBindings();
      this._persist();
      
      // Limpar variáveis globais antigas (compatibilidade)
      if (typeof window !== 'undefined') {
        delete window.__REFERENCE_JOB_ID__;
        delete window.lastReferenceJobId;
      }
      
      log(DEBUG_PREFIX, 'Reset completo');
    }

    /**
     * Iniciar novo fluxo de referência
     * @returns {string} traceId para debug
     */
    startNewReferenceFlow() {
      log(DEBUG_PREFIX, 'startNewReferenceFlow()');
      
      this.reset();
      
      this.state.stage = Stage.IDLE;
      this.state.startedAt = new Date().toISOString();
      this.state.traceId = `ref_${Date.now()}`;
      
      this._persist();
      
      log(DEBUG_PREFIX, 'Novo fluxo iniciado', this.state.traceId);
      return this.state.traceId;
    }

    /**
     * Usuário selecionou primeira música
     */
    onFirstTrackSelected() {
      const traceId = this.state.traceId || `trace_${Date.now()}`;
      log(DEBUG_PREFIX, 'onFirstTrackSelected()', { traceId, currentStage: this.state.stage });
      
      // ✅ CORREÇÃO: Só resetar se stage for terminal (AWAITING_SECOND, DONE)
      // Não resetar se já processando (BASE_UPLOADING, BASE_PROCESSING) - preservar baseJobId
      if (this.state.stage === Stage.AWAITING_SECOND || this.state.stage === Stage.DONE) {
        warn(DEBUG_PREFIX, 'Iniciando nova análise - resetando fluxo concluído', { traceId });
        this.reset();
        this.startNewReferenceFlow();
      } else if (this.state.stage !== Stage.IDLE) {
        warn(DEBUG_PREFIX, '⚠️ Fluxo em andamento - NÃO resetando', { 
          traceId, 
          stage: this.state.stage, 
          baseJobId: this.state.baseJobId 
        });
        // Não resetar - manter baseJobId existente
      }
      
      this.state.stage = Stage.BASE_UPLOADING;
      this._persist();
      
      log(DEBUG_PREFIX, 'Stage:', Stage.BASE_UPLOADING, { traceId, baseJobId: this.state.baseJobId });
    }

    /**
     * Primeira música começou a processar
     * @param {string} jobId
     */
    onFirstTrackProcessing(jobId) {
      const traceId = this.state.traceId || `trace_${Date.now()}`;
      
      // 🛡️ PROTEÇÃO: Não sobrescrever baseJobId se já existe e stage é pós-base
      const isPostBase = [
        Stage.AWAITING_SECOND,
        Stage.COMPARE_UPLOADING,
        Stage.COMPARE_PROCESSING,
        Stage.DONE
      ].includes(this.state.stage);
      
      if (isPostBase && this.state.baseJobId && this.state.baseJobId !== jobId) {
        warn('[REF-FLOW][GUARD] ⚠️ Ignorando onFirstTrackProcessing - já existe baseJobId e stage pós-base');
        warn('[REF-FLOW][GUARD] Current:', {
          stage: this.state.stage,
          baseJobId: this.state.baseJobId,
          incomingJobId: jobId
        });
        return;
      }
      
      log('[REF-STATE-TRACE]', {
        traceId,
        event: 'onFirstTrackProcessing',
        jobId: jobId,
        oldBaseJobId: this.state.baseJobId,
        newBaseJobId: jobId,
        stage: 'BASE_PROCESSING'
      });
      
      this.state.stage = Stage.BASE_PROCESSING;
      this.state.baseJobId = jobId;
      this._persist();
      
      log(DEBUG_PREFIX, 'Base processando, jobId:', jobId, { traceId });
    }

    /**
     * Primeira música completada - salvar métricas base
     * @param {Object} result - Resultado completo da análise base
     */
    onFirstTrackCompleted(result) {
      log(DEBUG_PREFIX, 'onFirstTrackCompleted()', result?.jobId);
      
      if (!result || !result.jobId) {
        error(DEBUG_PREFIX, 'onFirstTrackCompleted() - resultado inválido', result);
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
      this.state.stage = Stage.AWAITING_SECOND;
      
      this._persist();
      
      log(DEBUG_PREFIX, '✅ Base completa - aguardando segunda música');
      log(DEBUG_PREFIX, 'baseJobId:', this.state.baseJobId);
      log(DEBUG_PREFIX, 'baseFileName:', this.state.baseFileName);
      log(DEBUG_PREFIX, 'Stage:', Stage.AWAITING_SECOND);
    }

    /**
     * Usuário selecionou segunda música
     */
    onSecondTrackSelected() {
      log(DEBUG_PREFIX, 'onSecondTrackSelected()');
      
      if (this.state.stage !== Stage.AWAITING_SECOND) {
        error(DEBUG_PREFIX, 'onSecondTrackSelected() chamado fora de ordem!');
        error(DEBUG_PREFIX, 'Stage atual:', this.state.stage, '| Esperado:', Stage.AWAITING_SECOND);
        throw new Error('Segunda música selecionada mas não há base salva');
      }
      
      this.state.stage = Stage.COMPARE_UPLOADING;
      this._persist();
      
      log(DEBUG_PREFIX, 'Stage:', Stage.COMPARE_UPLOADING);
    }

    /**
     * Segunda música começou a processar
     */
    onCompareProcessing() {
      log(DEBUG_PREFIX, 'onCompareProcessing()');
      
      this.state.stage = Stage.COMPARE_PROCESSING;
      this._persist();
      
      log(DEBUG_PREFIX, 'Stage:', Stage.COMPARE_PROCESSING);
    }

    /**
     * Comparação completada
     * @param {Object} result - Resultado com comparação e sugestões
     */
    onCompareCompleted(result) {
      log(DEBUG_PREFIX, 'onCompareCompleted()', result?.jobId);
      
      this.state.stage = Stage.DONE;
      this._persist();
      
      log(DEBUG_PREFIX, '✅ Fluxo de referência completo');
      log(DEBUG_PREFIX, 'Stage:', Stage.DONE);
    }

    /**
     * Verificar se está aguardando segunda música
     */
    isAwaitingSecond() {
      return this.state.stage === Stage.AWAITING_SECOND;
    }

    /**
     * Verificar se é primeira música (base)
     */
    isFirstTrack() {
      return this.state.stage === Stage.BASE_UPLOADING || 
             this.state.stage === Stage.BASE_PROCESSING;
    }

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

  log('[REF-FLOW] ✅ Módulo carregado - window.referenceFlow disponível');

})();
