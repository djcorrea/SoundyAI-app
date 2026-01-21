// 🔍 REFERENCE TRACE UTILS - PR1 Instrumentação
// Sistema de logging e diagnóstico para modo Reference vs Genre
// ⚠️ NÃO MODIFICA COMPORTAMENTO - apenas observa e registra

/**
 * 🎯 Gerar ID de rastreamento único
 * @returns {string} TraceId no formato REF-timestamp-random
 */
window.createTraceId = function() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `REF-${timestamp}-${random}`;
};

/**
 * 📸 Snapshot do estado atual do sistema
 * Captura variáveis críticas de estado sem alterar nada
 * @returns {Object} Estado atual
 */
window.snapshotState = function() {
    return {
        // UI Mode
        uiMode: window.currentAnalysisMode || null,
        viewMode: window.__VIEW_MODE__ || null,
        currentMode: window.__CURRENT_MODE__ || null,
        
        // Flags de Reference
        userExplicitlySelectedReferenceMode: window.userExplicitlySelectedReferenceMode || false,
        
        // Job IDs
        referenceJobId_window: window.__REFERENCE_JOB_ID__ || null,
        referenceJobId_localStorage: localStorage.getItem('referenceJobId') || null,
        referenceJobId_sessionStorage: sessionStorage.getItem('referenceJobId') || null,
        currentJobId_window: window.__CURRENT_JOB_ID__ || null,
        currentJobId_sessionStorage: sessionStorage.getItem('currentJobId') || null,
        
        // Genre State
        selectedGenre: window.__CURRENT_SELECTED_GENRE || null,
        hasGenreTargets: !!(window.__CURRENT_GENRE_TARGETS || window.currentGenreTargets),
        
        // Reference Flow State
        awaitingSecondTrack: !!(window.__REFERENCE_JOB_ID__ && window.currentAnalysisMode === 'reference'),
        hasFirstAnalysisStored: !!(window.FirstAnalysisStore && window.FirstAnalysisStore.has && window.FirstAnalysisStore.has()),
        
        // Timestamp
        timestamp: new Date().toISOString(),
    };
};

/**
 * 📝 Log padronizado de etapa
 * @param {string} traceId - ID de rastreamento
 * @param {string} stepName - Nome da etapa (ex: MODE_SELECTED)
 * @param {Object} data - Dados da etapa
 */
window.logStep = function(traceId, stepName, data = {}) {
    const snapshot = window.snapshotState();
    
    log('%c[REFTRACE]', 'color:#00D9FF;font-weight:bold;', {
        traceId,
        step: stepName,
        timestamp: new Date().toISOString(),
        snapshot,
        data,
    });
};

/**
 * 🧪 Assert de invariante (não-destrutivo)
 * Registra violação mas NÃO quebra a aplicação
 * @param {string} name - Nome da invariante
 * @param {boolean} condition - Condição esperada (true = ok)
 * @param {Object} context - Contexto adicional
 */
window.assertInvariant = function(name, condition, context = {}) {
    if (condition) {
        // ✅ Invariante OK - log silencioso
        if (window.__DEBUG_STRICT__) {
            log('%c[INV_OK]', 'color:#00FF88;', name);
        }
        return true;
    }
    
    // ❌ Invariante violada - log detalhado
    const stack = new Error().stack;
    const snapshot = window.snapshotState();
    
    error('%c[INV_FAIL]', 'color:#FF0000;font-weight:bold;font-size:14px;', {
        invariant: name,
        context,
        snapshot,
        stack,
        timestamp: new Date().toISOString(),
    });
    
    // 🔥 Em modo strict, throw (apenas dev)
    if (window.__DEBUG_STRICT__ === true) {
        throw new Error(`[INV_FAIL] ${name}`);
    }
    
    return false;
};

/**
 * 🔒 Mascarar dados sensíveis em payload
 * @param {Object} payload - Payload original
 * @returns {Object} Payload com dados sensíveis mascarados
 */
window.maskSensitiveData = function(payload) {
    const masked = { ...payload };
    
    // Mascarar token
    if (masked.idToken) {
        masked.idToken = '***masked***';
    }
    
    // Simplificar genreTargets (não logar objeto inteiro)
    if (masked.genreTargets) {
        masked.genreTargets = {
            __masked: true,
            keys: Object.keys(masked.genreTargets),
            count: Object.keys(masked.genreTargets).length,
        };
    }
    
    return masked;
};

/**
 * 📊 Comparar payloads (diff visual)
 * @param {Object} expected - Payload esperado
 * @param {Object} actual - Payload real
 * @returns {Object} Diferenças
 */
window.comparePayloads = function(expected, actual) {
    const diffs = {};
    
    // Campos críticos a comparar
    const criticalFields = ['mode', 'genre', 'genreTargets', 'referenceJobId', 'hasTargets'];
    
    criticalFields.forEach(field => {
        const exp = expected[field];
        const act = actual[field];
        
        if (JSON.stringify(exp) !== JSON.stringify(act)) {
            diffs[field] = {
                expected: exp,
                actual: act,
                match: false,
            };
        }
    });
    
    return {
        hasDiffs: Object.keys(diffs).length > 0,
        diffs,
    };
};

/**
 * 🎯 Validar modo consistency
 * Verifica se modo está consistente em todas as variáveis
 * @param {string} expectedMode - Modo esperado
 * @returns {Object} Resultado da validação
 */
window.validateModeConsistency = function(expectedMode) {
    const snapshot = window.snapshotState();
    
    const inconsistencies = [];
    
    if (snapshot.uiMode && snapshot.uiMode !== expectedMode) {
        inconsistencies.push(`uiMode=${snapshot.uiMode} but expected=${expectedMode}`);
    }
    
    if (expectedMode === 'reference' && snapshot.selectedGenre) {
        inconsistencies.push(`Mode is reference but selectedGenre=${snapshot.selectedGenre}`);
    }
    
    if (expectedMode === 'reference' && snapshot.hasGenreTargets) {
        inconsistencies.push(`Mode is reference but hasGenreTargets=true`);
    }
    
    if (expectedMode === 'genre' && snapshot.referenceJobId_window) {
        inconsistencies.push(`Mode is genre but referenceJobId exists`);
    }
    
    return {
        consistent: inconsistencies.length === 0,
        inconsistencies,
        snapshot,
    };
};

/**
 * 🔍 Detectar quem mudou o modo (call stack analysis)
 * @param {string} previousMode - Modo anterior
 * @param {string} newMode - Novo modo
 */
window.detectModeChange = function(previousMode, newMode) {
    if (previousMode === newMode) return;
    
    const stack = new Error().stack;
    const snapshot = window.snapshotState();
    
    warn('%c[MODE_CHANGE_DETECTED]', 'color:#FFA500;font-weight:bold;font-size:14px;', {
        from: previousMode,
        to: newMode,
        snapshot,
        stack,
        timestamp: new Date().toISOString(),
    });
};

// 🧪 Ativar modo strict em development
if (window.location.hostname === 'localhost' && window.location.search.includes('debug=strict')) {
    window.__DEBUG_STRICT__ = true;
    log('%c[TRACE-UTILS] Modo strict ativado - asserts lançarão exceções', 'color:#FFD700;font-weight:bold;');
}

log('%c[TRACE-UTILS] ✅ Reference Trace Utils carregado', 'color:#00FF88;font-weight:bold;');
log('[TRACE-UTILS] Funções disponíveis:', {
    createTraceId: typeof window.createTraceId,
    snapshotState: typeof window.snapshotState,
    logStep: typeof window.logStep,
    assertInvariant: typeof window.assertInvariant,
    maskSensitiveData: typeof window.maskSensitiveData,
    comparePayloads: typeof window.comparePayloads,
    validateModeConsistency: typeof window.validateModeConsistency,
    detectModeChange: typeof window.detectModeChange,
});
