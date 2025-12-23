/**
 * 🎯 SISTEMA DE SINCRONIZAÇÃO: TABELA ↔ SUGESTÕES
 * 
 * OBJETIVO: Garantir que SOMENTE métricas com status != OK tenham sugestões
 * REGRA DE OURO: Se tabela mostra "OK" (verde), NÃO DEVE existir sugestão
 * 
 * @module suggestions-table-sync
 */

/**
 * 🔑 NORMALIZAÇÃO DE CHAVES DE MÉTRICAS
 * 
 * Converte variações de nomes de métricas para a key canônica usada na tabela
 * 
 * @param {string|object} input - Nome da métrica, tipo de sugestão ou objeto com .metric/.type
 * @returns {string} - Chave normalizada
 */
function normalizeMetricKey(input) {
    // Se receber objeto, extrair campo relevante
    if (typeof input === 'object' && input !== null) {
        input = input.metric || input.type || input.metricKey || input.category || '';
    }
    
    // Converter para string e normalizar
    const key = String(input).toLowerCase().trim();
    
    // Mapeamento de variações para keys canônicas
    const keyMap = {
        // LUFS
        'lufs': 'lufs',
        'lufs_integrated': 'lufs',
        'lufsintegrated': 'lufs',
        'loudness': 'lufs',
        'integrated_loudness': 'lufs',
        
        // True Peak
        'truepeak': 'truepeak',
        'true_peak': 'truepeak',
        'truepeakdbtp': 'truepeak',
        'true_peak_dbtp': 'truepeak',
        'peak': 'truepeak',
        'clipping': 'truepeak',
        
        // Dynamic Range
        'dr': 'dynamicrange',
        'dynamic_range': 'dynamicrange',
        'dynamicrange': 'dynamicrange',
        'dynamics': 'dynamicrange',
        
        // LRA
        'lra': 'lra',
        'loudness_range': 'lra',
        'loudnessrange': 'lra',
        
        // Stereo
        'stereo': 'stereo',
        'stereo_correlation': 'stereo',
        'stereocorrelation': 'stereo',
        'correlation': 'stereo',
        'stereo_width': 'stereo',
        
        // RMS
        'rms': 'rms',
        'rms_left': 'rms',
        'rms_right': 'rms',
        'rmsleft': 'rms',
        'rmsright': 'rms',
        
        // Crest Factor
        'crest': 'crestfactor',
        'crest_factor': 'crestfactor',
        'crestfactor': 'crestfactor',
        
        // Bandas espectrais (genérico)
        'bass': 'bass',
        'low': 'bass',
        'sub': 'bass',
        'sub_bass': 'bass',
        'subbass': 'bass',
        
        'lowmid': 'lowmid',
        'low_mid': 'lowmid',
        'lower_mid': 'lowmid',
        
        'mid': 'mid',
        'midrange': 'mid',
        'mids': 'mid',
        
        'highmid': 'highmid',
        'high_mid': 'highmid',
        'upper_mid': 'highmid',
        
        'high': 'high',
        'highs': 'high',
        'treble': 'high',
        'presence': 'high',
        
        'air': 'air',
        'brilliance': 'air',
        'brilho': 'air',
        
        // Fallback genérico
        'spectral': 'spectral',
        'frequency': 'spectral',
        'balance': 'spectral',
        'tonal': 'spectral'
    };
    
    // Retornar key mapeada ou original normalizada
    return keyMap[key] || key;
}

/**
 * 🛡️ GATEKEEPER DEFINITIVO: FINALIZAR SUGESTÕES
 * 
 * Remove sugestões cujo status na tabela seja "OK" (verde)
 * Anexa tableStatus e tableSeverityLabel para render correto no frontend
 * 
 * @param {Array} suggestions - Lista de sugestões brutas
 * @param {Object} statusByKey - Mapa { metricKey: 'OK'|'yellow'|'warn' }
 * @returns {Array} - Sugestões filtradas e enriquecidas
 */
function finalizeSuggestions(suggestions, statusByKey) {
    console.log('[TABLE-SYNC] 🛡️ Iniciando finalizeSuggestions...');
    console.log('[TABLE-SYNC] Input:', {
        totalSuggestions: suggestions?.length || 0,
        statusByKeyCount: Object.keys(statusByKey || {}).length
    });
    
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
        console.log('[TABLE-SYNC] ⚠️ Nenhuma sugestão para processar');
        return [];
    }
    
    if (!statusByKey || Object.keys(statusByKey).length === 0) {
        console.warn('[TABLE-SYNC] ⚠️ statusByKey vazio - retornando sugestões sem filtro');
        return suggestions;
    }
    
    const filtered = [];
    let okCount = 0;
    
    for (const sug of suggestions) {
        // Normalizar key da sugestão
        const sugKey = normalizeMetricKey(sug);
        const tableStatus = statusByKey[sugKey];
        
        // Log detalhado
        console.log(`[TABLE-SYNC] Processando: ${sug.metric || sug.type} → key: ${sugKey} → tableStatus: ${tableStatus}`);
        
        // Se status for OK, remover sugestão
        if (tableStatus === 'ok') {
            okCount++;
            console.log(`[TABLE-SYNC] ❌ REMOVIDA: ${sugKey} (status OK na tabela)`);
            continue;
        }
        
        // Anexar metadados da tabela
        const enriched = {
            ...sug,
            tableStatus: tableStatus || 'unknown',
            tableSeverityLabel: mapStatusToSeverity(tableStatus),
            _syncedWithTable: true
        };
        
        filtered.push(enriched);
    }
    
    console.log('[TABLE-SYNC] ✅ Finalização completa:', {
        inputCount: suggestions.length,
        outputCount: filtered.length,
        removedOK: okCount
    });
    
    return filtered;
}

/**
 * 🎨 MAPPER: STATUS → SEVERIDADE
 * 
 * @param {string} status - 'ok' | 'yellow' | 'warn'
 * @returns {string} - Label visual
 */
function mapStatusToSeverity(status) {
    switch (status) {
        case 'ok': return 'Ideal';
        case 'yellow': return 'Ajuste';
        case 'warn': return 'Crítico';
        default: return 'Desconhecido';
    }
}

/**
 * 📋 COMPLETUDE: GERAR FALLBACKS PARA MÉTRICAS SEM SUGESTÃO
 * 
 * Para cada métrica com status != OK que NÃO tenha sugestão,
 * gera uma sugestão simples baseada nos dados da tabela
 * 
 * @param {Array} suggestions - Sugestões existentes (já finalizadas)
 * @param {Object} statusByKey - Mapa de status
 * @param {Object} tableData - Dados completos da tabela { key: { val, target, tol, unit, diff } }
 * @returns {Array} - Sugestões completas (existentes + fallbacks)
 */
function ensureCompleteness(suggestions, statusByKey, tableData) {
    console.log('[TABLE-SYNC] 📋 Verificando completude...');
    
    // Métricas esperadas (status != OK)
    const expectedKeys = Object.keys(statusByKey).filter(k => statusByKey[k] !== 'ok');
    console.log('[TABLE-SYNC] expectedKeys:', expectedKeys);
    
    // Métricas com sugestão
    const actualKeys = new Set(suggestions.map(s => normalizeMetricKey(s)));
    console.log('[TABLE-SYNC] actualKeys:', Array.from(actualKeys));
    
    // Métricas faltantes
    const missingKeys = expectedKeys.filter(k => !actualKeys.has(k));
    console.log('[TABLE-SYNC] missingKeys:', missingKeys);
    
    if (missingKeys.length === 0) {
        console.log('[TABLE-SYNC] ✅ Completude OK - todas as métricas não-OK têm sugestão');
        return suggestions;
    }
    
    // Gerar fallbacks
    const fallbacks = [];
    for (const key of missingKeys) {
        const data = tableData[key];
        if (!data) {
            console.warn(`[TABLE-SYNC] ⚠️ Dados de tabela ausentes para ${key} - pulando fallback`);
            continue;
        }
        
        const fallback = generateFallbackSuggestion(key, data, statusByKey[key]);
        fallbacks.push(fallback);
    }
    
    console.log('[TABLE-SYNC] ✅ Gerados', fallbacks.length, 'fallbacks');
    
    return [...suggestions, ...fallbacks];
}

/**
 * 🔨 GERADOR DE FALLBACK
 * 
 * Cria sugestão simples baseada nos dados da tabela
 * 
 * @param {string} key - Chave normalizada da métrica
 * @param {Object} data - { val, target, tol, unit, diff }
 * @param {string} status - Status da métrica
 * @returns {Object} - Sugestão fallback
 */
function generateFallbackSuggestion(key, data, status) {
    const { val, target, tol, unit, diff } = data;
    
    // Determinar direção do ajuste
    const direction = diff > 0 ? 'reduzir' : 'aumentar';
    const absDiff = Math.abs(diff);
    
    // Calcular range ideal (se target for range)
    let rangeText = '';
    if (typeof target === 'object' && target.min != null && target.max != null) {
        rangeText = `${target.min}${unit} a ${target.max}${unit}`;
    } else {
        rangeText = `${target}${unit}${tol ? ` (±${tol})` : ''}`;
    }
    
    // Criar mensagem
    const message = `${getMetricDisplayName(key)} está em ${val}${unit}. ` +
                   `Range ideal: ${rangeText}. ` +
                   `Sugestão: ${direction} aproximadamente ${absDiff.toFixed(1)}${unit}.`;
    
    return {
        type: key,
        metric: key,
        category: getCategoryForMetric(key),
        priority: status === 'warn' ? 'crítica' : 'alta',
        severity: status === 'warn' ? 'alta' : 'media',
        message: message,
        action: `${direction.charAt(0).toUpperCase() + direction.slice(1)} ${getMetricDisplayName(key)}`,
        aiEnhanced: false,
        _isFallback: true,
        tableStatus: status,
        tableSeverityLabel: mapStatusToSeverity(status)
    };
}

/**
 * 🏷️ HELPER: Nome displayável da métrica
 */
function getMetricDisplayName(key) {
    const names = {
        'lufs': 'LUFS Integrado',
        'truepeak': 'True Peak',
        'dynamicrange': 'Dynamic Range',
        'lra': 'LRA (Loudness Range)',
        'stereo': 'Correlação Estéreo',
        'rms': 'RMS',
        'crestfactor': 'Crest Factor',
        'bass': 'Graves (Sub/Bass)',
        'lowmid': 'Médios Graves',
        'mid': 'Médios',
        'highmid': 'Médios Agudos',
        'high': 'Agudos',
        'air': 'Ar/Brilho'
    };
    return names[key] || key.toUpperCase();
}

/**
 * 🏷️ HELPER: Categoria da métrica
 */
function getCategoryForMetric(key) {
    if (['lufs', 'truepeak', 'lra'].includes(key)) return 'loudness';
    if (['dynamicrange', 'rms', 'crestfactor'].includes(key)) return 'dynamics';
    if (['stereo'].includes(key)) return 'stereo';
    return 'spectral';
}

// Exportar funções
module.exports = {
    normalizeMetricKey,
    finalizeSuggestions,
    ensureCompleteness,
    mapStatusToSeverity,
    generateFallbackSuggestion,
    getMetricDisplayName,
    getCategoryForMetric
};
