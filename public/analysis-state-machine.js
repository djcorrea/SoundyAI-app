// analysis-state-machine.js
// State Machine para gerenciar modo de análise (Genre vs Reference)
// Evita contaminação de estado entre modos e persiste em sessionStorage

(function() {
  'use strict';

  const STATE_KEY = 'analysisState_v1';
  const DEBUG_PREFIX = '[STATE_MACHINE]';

  /**
   * Estado da máquina de análise
   * @typedef {Object} AnalysisState
   * @property {string|null} mode - 'genre' | 'reference' | null
   * @property {boolean} userExplicitlySelected - Usuário escolheu explicitamente o modo
   * @property {string|null} referenceFirstJobId - ID do primeiro job de referência
   * @property {Object|null} referenceFirstResult - Resumo do primeiro resultado
   * @property {boolean} awaitingSecondTrack - Aguardando segunda música
   * @property {string} timestamp - ISO timestamp da última atualização
   */

  class AnalysisStateMachine {
    constructor() {
      this.state = this._getInitialState();
      this._restore();
      log(DEBUG_PREFIX, 'Initialized', this.state);
    }

    /**
     * Estado inicial limpo
     */
    _getInitialState() {
      return {
        mode: null,
        userExplicitlySelected: false,
        referenceFirstJobId: null,
        referenceFirstResult: null,
        awaitingSecondTrack: false,
        timestamp: new Date().toISOString()
      };
    }

    /**
     * Restaurar estado do sessionStorage
     */
    _restore() {
      try {
        const stored = sessionStorage.getItem(STATE_KEY);
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
        this.state.timestamp = new Date().toISOString();
        sessionStorage.setItem(STATE_KEY, JSON.stringify(this.state));
        log(DEBUG_PREFIX, 'Persisted', this.state);
      } catch (error) {
        error(DEBUG_PREFIX, 'Failed to persist state', error);
      }
    }

    /**
     * Definir modo de análise
     * @param {string} mode - 'genre' | 'reference'
     * @param {Object} options
     * @param {boolean} options.userExplicitlySelected - Usuário escolheu explicitamente
     */
    setMode(mode, options = {}) {
      const { userExplicitlySelected = false } = options;

      if (mode !== 'genre' && mode !== 'reference') {
        throw new Error(`Invalid mode: ${mode}. Must be 'genre' or 'reference'`);
      }

      log(DEBUG_PREFIX, `setMode(${mode}, explicit=${userExplicitlySelected})`);

      // Se mudou de reference para genre, limpar estado reference
      if (this.state.mode === 'reference' && mode === 'genre') {
        log(DEBUG_PREFIX, 'Switching from reference to genre - clearing reference state');
        this.state.referenceFirstJobId = null;
        this.state.referenceFirstResult = null;
        this.state.awaitingSecondTrack = false;
      }

      this.state.mode = mode;
      this.state.userExplicitlySelected = userExplicitlySelected;
      this._persist();

      this.assertInvariants('setMode');
    }

    /**
     * Iniciar fluxo de reference (primeira track)
     */
    startReferenceFirstTrack() {
      log(DEBUG_PREFIX, 'startReferenceFirstTrack()');

      if (this.state.mode !== 'reference') {
        error(DEBUG_PREFIX, 'Cannot start reference first track - mode is not reference');
        throw new Error('Cannot start reference first track when mode is not reference');
      }

      // Limpar qualquer estado anterior
      this.state.referenceFirstJobId = null;
      this.state.referenceFirstResult = null;
      this.state.awaitingSecondTrack = false;
      this._persist();

      this.assertInvariants('startReferenceFirstTrack');
    }

    /**
     * Definir resultado da primeira track de referência
     * @param {Object} data
     * @param {string} data.firstJobId - ID do job da primeira música
     * @param {Object} data.firstResultSummary - Resumo do resultado
     */
    setReferenceFirstResult(data) {
      const { firstJobId, firstResultSummary } = data;

      log(DEBUG_PREFIX, `setReferenceFirstResult(jobId=${firstJobId})`);

      if (this.state.mode !== 'reference') {
        error(DEBUG_PREFIX, 'Cannot set reference first result - mode is not reference');
        throw new Error('Cannot set reference first result when mode is not reference');
      }

      if (!firstJobId) {
        throw new Error('firstJobId is required');
      }

      this.state.referenceFirstJobId = firstJobId;
      this.state.referenceFirstResult = firstResultSummary || {};
      this.state.awaitingSecondTrack = true;
      this._persist();

      log(DEBUG_PREFIX, 'Now awaiting second track', {
        referenceFirstJobId: this.state.referenceFirstJobId,
        awaitingSecondTrack: this.state.awaitingSecondTrack
      });

      this.assertInvariants('setReferenceFirstResult');
    }

    /**
     * Verificar se está aguardando segunda track
     * @returns {boolean}
     */
    isAwaitingSecondTrack() {
      return this.state.awaitingSecondTrack === true 
        && this.state.referenceFirstJobId !== null
        && this.state.mode === 'reference';
    }

    /**
     * Iniciar análise da segunda track
     */
    startReferenceSecondTrack() {
      log(DEBUG_PREFIX, 'startReferenceSecondTrack()');

      if (!this.isAwaitingSecondTrack()) {
        error(DEBUG_PREFIX, 'Cannot start second track - not awaiting', this.state);
        throw new Error('Cannot start second track - not awaiting second track');
      }

      // Manter estado mas indicar que segunda track está sendo processada
      // awaitingSecondTrack permanece true até receber resultado
      log(DEBUG_PREFIX, 'Second track started', {
        referenceFirstJobId: this.state.referenceFirstJobId
      });

      this.assertInvariants('startReferenceSecondTrack');
    }

    /**
     * Resetar fluxo de referência (volta ao estado inicial)
     */
    resetReferenceFlow() {
      log(DEBUG_PREFIX, 'resetReferenceFlow()');

      this.state.referenceFirstJobId = null;
      this.state.referenceFirstResult = null;
      this.state.awaitingSecondTrack = false;
      // NÃO resetar mode nem userExplicitlySelected
      this._persist();

      log(DEBUG_PREFIX, 'Reference flow reset', this.state);
    }

    /**
     * Reset completo (limpa tudo)
     */
    resetAll() {
      log(DEBUG_PREFIX, 'resetAll()');
      this.state = this._getInitialState();
      this._persist();
    }

    /**
     * Obter estado atual (cópia)
     * @returns {AnalysisState}
     */
    getState() {
      return { ...this.state };
    }

    /**
     * Obter modo atual
     * @returns {string|null}
     */
    getMode() {
      return this.state.mode;
    }

    /**
     * Obter job ID da primeira referência
     * @returns {string|null}
     */
    getReferenceFirstJobId() {
      return this.state.referenceFirstJobId;
    }

    /**
     * Verificar se usuário selecionou explicitamente o modo
     * @returns {boolean}
     */
    isUserExplicitlySelected() {
      return this.state.userExplicitlySelected === true;
    }

    /**
     * Validar invariantes do estado
     * @param {string} location - Onde está sendo chamado (para debug)
     */
    assertInvariants(location) {
      const errors = [];

      // Invariante 1: Se mode=reference, userExplicitlySelected DEVE ser true
      if (this.state.mode === 'reference' && !this.state.userExplicitlySelected) {
        errors.push('mode=reference requires userExplicitlySelected=true');
      }

      // Invariante 2: Se awaitingSecondTrack=true, deve ter referenceFirstJobId
      if (this.state.awaitingSecondTrack && !this.state.referenceFirstJobId) {
        errors.push('awaitingSecondTrack=true requires referenceFirstJobId');
      }

      // Invariante 3: Se referenceFirstJobId existe, mode deve ser reference
      if (this.state.referenceFirstJobId && this.state.mode !== 'reference') {
        errors.push('referenceFirstJobId exists but mode is not reference');
      }

      // Invariante 4: awaitingSecondTrack só é true se mode=reference
      if (this.state.awaitingSecondTrack && this.state.mode !== 'reference') {
        errors.push('awaitingSecondTrack=true but mode is not reference');
      }

      if (errors.length > 0) {
        error(DEBUG_PREFIX, `[INVARIANT_VIOLATION] at ${location}:`, errors, this.state);
        
        // Em modo strict, lançar exceção
        if (window.location.search.includes('debug=strict')) {
          throw new Error(`State machine invariant violation at ${location}: ${errors.join(', ')}`);
        }
      } else {
        log(DEBUG_PREFIX, `[INVARIANT_OK] at ${location}`);
      }

      return errors.length === 0;
    }

    /**
     * Debug: dump estado completo
     */
    debug() {
      console.group(DEBUG_PREFIX + ' DEBUG DUMP');
      log('Current State:', this.state);
      log('Mode:', this.state.mode);
      log('User Explicitly Selected:', this.state.userExplicitlySelected);
      log('Reference First Job ID:', this.state.referenceFirstJobId);
      log('Awaiting Second Track:', this.state.awaitingSecondTrack);
      log('Timestamp:', this.state.timestamp);
      log('isAwaitingSecondTrack():', this.isAwaitingSecondTrack());
      console.groupEnd();
    }
  }

  // Criar instância global única
  window.AnalysisStateMachine = new AnalysisStateMachine();

  // Expor para debug no console
  window.debugStateMachine = () => {
    window.AnalysisStateMachine.debug();
  };

  log(DEBUG_PREFIX, 'Module loaded. Use window.AnalysisStateMachine or debugStateMachine()');
})();
