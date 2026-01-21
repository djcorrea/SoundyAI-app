// 🔍 REFERENCE MODE AUDITOR - Sistema de Diagnóstico Controlado
// NÃO ALTERA LÓGICA - Apenas instrumentação e logging
// Ativado com: window.DEBUG_REFERENCE_AUDIT = true

(function() {
  'use strict';
  
  const AUDIT_PREFIX = '[🔍 REF-AUDIT]';
  const CHANGE_PREFIX = '[⚠️ MODE-CHANGE]';
  
  // Log buffer para análise posterior
  window.REFERENCE_AUDIT_LOG = window.REFERENCE_AUDIT_LOG || [];
  
  /**
   * 🎯 DEBUG DUMP - Captura estado completo em momento específico
   * @param {string} label - Identificador do ponto de captura
   * @param {object} extra - Dados adicionais contextuais
   */
  window.debugDump = function(label, extra = {}) {
    if (!window.DEBUG_REFERENCE_AUDIT) return;
    
    const timestamp = new Date().toISOString();
    const stack = new Error().stack;
    
    const dump = {
      timestamp,
      label,
      stack: stack.split('\n').slice(2, 6).join('\n'), // Top 4 stack frames
      
      // Legacy variables
      legacy: {
        currentAnalysisMode: window.currentAnalysisMode,
        userExplicitlySelectedReferenceMode: window.userExplicitlySelectedReferenceMode,
        __soundyViewMode: window.__soundyViewMode,
        __REFERENCE_JOB_ID__: window.__REFERENCE_JOB_ID__,
        lastReferenceJobId: window.lastReferenceJobId,
      },
      
      // State machine
      stateMachine: window.AnalysisStateMachine ? {
        available: true,
        state: window.AnalysisStateMachine.getState(),
        isAwaitingSecondTrack: window.AnalysisStateMachine.isAwaitingSecondTrack(),
        isUserExplicitlySelected: window.AnalysisStateMachine.isUserExplicitlySelected(),
      } : { available: false },
      
      // Storage
      storage: {
        sessionStorage: {
          analysisState: sessionStorage.getItem('analysisState_v1'),
          currentJobId: sessionStorage.getItem('currentJobId'),
          referenceJobId: sessionStorage.getItem('referenceJobId'),
        },
        localStorage: {
          referenceJobId: localStorage.getItem('referenceJobId'),
          currentAnalysisMode: localStorage.getItem('currentAnalysisMode'),
        }
      },
      
      // Extra context
      extra
    };
    
    window.REFERENCE_AUDIT_LOG.push(dump);
    
    console.group(`${AUDIT_PREFIX} ${label} @ ${timestamp}`);
    log('📍 Stack:', dump.stack);
    log('🎯 Mode (legacy):', dump.legacy.currentAnalysisMode);
    log('🔒 Flag (legacy):', dump.legacy.userExplicitlySelectedReferenceMode);
    log('🎰 State Machine:', dump.stateMachine);
    log('💾 Storage:', dump.storage);
    if (Object.keys(extra).length > 0) {
      log('➕ Extra:', extra);
    }
    console.groupEnd();
    
    return dump;
  };
  
  /**
   * 🔍 WATCHER - Monitora mudanças em variáveis críticas
   */
  function installWatchers() {
    if (!window.DEBUG_REFERENCE_AUDIT) return;
    
    log(`${AUDIT_PREFIX} Installing watchers...`);
    
    // Watcher 1: window.currentAnalysisMode
    let _currentAnalysisMode = window.currentAnalysisMode;
    Object.defineProperty(window, 'currentAnalysisMode', {
      get() {
        return _currentAnalysisMode;
      },
      set(newValue) {
        const oldValue = _currentAnalysisMode;
        if (oldValue !== newValue) {
          const stack = new Error().stack;
          warn(`${CHANGE_PREFIX} currentAnalysisMode: "${oldValue}" → "${newValue}"`);
          log('📍 Changed at:', stack.split('\n').slice(2, 6).join('\n'));
          
          window.REFERENCE_AUDIT_LOG.push({
            type: 'CHANGE',
            variable: 'currentAnalysisMode',
            oldValue,
            newValue,
            timestamp: new Date().toISOString(),
            stack: stack.split('\n').slice(2, 10)
          });
        }
        _currentAnalysisMode = newValue;
      },
      configurable: true
    });
    
    // Watcher 2: userExplicitlySelectedReferenceMode
    let _userFlag = window.userExplicitlySelectedReferenceMode;
    Object.defineProperty(window, 'userExplicitlySelectedReferenceMode', {
      get() {
        return _userFlag;
      },
      set(newValue) {
        const oldValue = _userFlag;
        if (oldValue !== newValue) {
          const stack = new Error().stack;
          warn(`${CHANGE_PREFIX} userExplicitlySelectedReferenceMode: ${oldValue} → ${newValue}`);
          log('📍 Changed at:', stack.split('\n').slice(2, 6).join('\n'));
          
          window.REFERENCE_AUDIT_LOG.push({
            type: 'CHANGE',
            variable: 'userExplicitlySelectedReferenceMode',
            oldValue,
            newValue,
            timestamp: new Date().toISOString(),
            stack: stack.split('\n').slice(2, 10)
          });
        }
        _userFlag = newValue;
      },
      configurable: true
    });
    
    log(`${AUDIT_PREFIX} ✅ Watchers installed`);
  }
  
  /**
   * 📊 ANÁLISE DE LOG - Gera relatório de auditoria
   */
  window.analyzeReferenceAudit = function() {
    const log = window.REFERENCE_AUDIT_LOG;
    
    console.group(`${AUDIT_PREFIX} 📊 AUDIT ANALYSIS`);
    log(`Total events: ${log.length}`);
    
    // Filtrar mudanças
    const changes = log.filter(e => e.type === 'CHANGE');
    log(`Mode changes: ${changes.length}`);
    
    if (changes.length > 0) {
      console.group('⚠️ Changes detected:');
      changes.forEach((change, idx) => {
        log(`${idx + 1}. ${change.variable}: ${change.oldValue} → ${change.newValue}`);
        log(`   Time: ${change.timestamp}`);
        log(`   Stack:`, change.stack.slice(0, 3));
      });
      console.groupEnd();
    }
    
    // Filtrar dumps por label
    const dumps = log.filter(e => e.label);
    console.group('📍 Debug dumps:');
    dumps.forEach(dump => {
      log(`- ${dump.label} @ ${dump.timestamp}`);
      log(`  Mode: ${dump.legacy.currentAnalysisMode}, Flag: ${dump.legacy.userExplicitlySelectedReferenceMode}`);
      log(`  StateMachine: ${dump.stateMachine.available ? dump.stateMachine.state.mode : 'N/A'}`);
    });
    console.groupEnd();
    
    // Buscar "culpado" - primeira mudança indevida
    const badChange = changes.find(c => 
      c.variable === 'currentAnalysisMode' && 
      c.oldValue === 'reference' && 
      c.newValue !== 'reference'
    );
    
    if (badChange) {
      console.group('🚨 CULPADO ENCONTRADO:');
      log('Variable:', badChange.variable);
      log('Change:', `${badChange.oldValue} → ${badChange.newValue}`);
      log('Time:', badChange.timestamp);
      log('Stack trace:', badChange.stack);
      console.groupEnd();
    } else {
      log('✅ Nenhuma mudança indevida de reference detectada');
    }
    
    console.groupEnd();
    
    return {
      totalEvents: log.length,
      changes,
      dumps,
      culprit: badChange || null
    };
  };
  
  /**
   * 🗑️ LIMPAR LOG
   */
  window.clearReferenceAudit = function() {
    window.REFERENCE_AUDIT_LOG = [];
    log(`${AUDIT_PREFIX} Log cleared`);
  };
  
  /**
   * 📤 EXPORTAR LOG
   */
  window.exportReferenceAudit = function() {
    const data = JSON.stringify(window.REFERENCE_AUDIT_LOG, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reference-audit-${Date.now()}.json`;
    a.click();
    log(`${AUDIT_PREFIX} Log exported`);
  };
  
  // Auto-instalar watchers se DEBUG ativado
  if (window.DEBUG_REFERENCE_AUDIT) {
    // Aguardar DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installWatchers);
    } else {
      installWatchers();
    }
  }
  
  log(`${AUDIT_PREFIX} Auditor carregado. Use window.DEBUG_REFERENCE_AUDIT = true para ativar.`);
  log(`${AUDIT_PREFIX} Funções disponíveis:`);
  log(`  - debugDump(label, extra)`);
  log(`  - analyzeReferenceAudit()`);
  log(`  - clearReferenceAudit()`);
  log(`  - exportReferenceAudit()`);
})();
