// 🎯 TABLE-SUGGESTIONS SYNC GATE
// Sistema central de sincronização entre tabela (fonte da verdade) e sugestões
// Garante que APENAS métricas ATENÇÃO/ALTA/CRÍTICA geram sugestões

/**
 * 🗺️ MAPEAMENTO CANÔNICO DE CHAVES
 * Resolve incompatibilidades entre tabela (scoring.js) e sugestões (problems-suggestions-v2.js)
 */
const METRIC_KEY_MAP = {
  // LOUDNESS
  'lufsIntegrated': 'lufs',
  'lufs': 'lufs',
  
  // PEAK
  'truePeakDbtp': 'truePeak',
  'truePeak': 'truePeak',
  
  // DYNAMICS
  'tt_dr': 'dr',
  'dr_stat': 'dr',
  'dr': 'dr',
  'dynamicRange': 'dr',
  'lra': 'lra',
  'crestFactor': 'crestFactor',
  
  // STEREO
  'stereoCorrelation': 'stereoCorrelation',
  'stereo': 'stereoCorrelation',
  'stereoWidth': 'stereoWidth',
  'balanceLR': 'balanceLR',
  
  // SPECTRAL
  'centroid': 'centroid',
  'spectralCentroid': 'centroid',
  'spectralFlatness': 'spectralFlatness',
  'rolloff50': 'rolloff50',
  'spectralRolloff50': 'rolloff50',
  'rolloff85': 'rolloff85',
  'spectralRolloff85': 'rolloff85',
  
  // TECHNICAL
  'thdPercent': 'thdPercent',
  'dcOffset': 'dcOffset',
  
  // BANDAS ESPECTRAIS (normalizar para formato band_<nome>)
  'band_sub': 'band_sub',
  'sub': 'band_sub',
  'subBass': 'band_sub',
  
  'band_bass': 'band_bass',
  'bass': 'band_bass',
  
  'band_low_mid': 'band_low_mid',
  'band_lowMid': 'band_low_mid',
  'lowMid': 'band_low_mid',
  'low_mid': 'band_low_mid',
  
  'band_mid': 'band_mid',
  'mid': 'band_mid',
  
  'band_high_mid': 'band_high_mid',
  'band_highMid': 'band_high_mid',
  'highMid': 'band_high_mid',
  'high_mid': 'band_high_mid',
  
  'band_presence': 'band_presence',
  'presence': 'band_presence',
  
  'band_brilliance': 'band_brilliance',
  'brilliance': 'band_brilliance'
};

/**
 * 🔑 Normaliza chave de métrica para formato canônico
 * 
 * @param {string} key - Chave da métrica (pode ser da tabela ou sugestão)
 * @returns {string} - Chave canônica normalizada
 */
export function normalizeMetricKey(key) {
  if (!key || typeof key !== 'string') return '';
  
  // Remover espaços e converter para lowercase para matching
  const normalized = key.trim().toLowerCase().replace(/\s+/g, '_');
  
  // Buscar no mapa
  const canonical = METRIC_KEY_MAP[key] || METRIC_KEY_MAP[normalized];
  
  if (canonical) {
    return canonical;
  }
  
  // Fallback: se começa com band_ ou parece banda, normalizar
  if (normalized.startsWith('band_') || normalized.includes('bass') || 
      normalized.includes('mid') || normalized.includes('presence') || 
      normalized.includes('brilliance')) {
    // Já está em formato band_<nome> ou transformar
    if (normalized.startsWith('band_')) {
      return normalized;
    }
    return `band_${normalized}`;
  }
  
  // Retornar key original se não encontrar
  return key;
}

/**
 * 📊 Extrai mapa de severidade da tabela (scoring.perMetric)
 * 
 * @param {Array} perMetric - Array perMetric do scoring result
 * @returns {Map} - Map { canonicalKey → { status, severity, label, color } }
 */
export function extractTableSeverityMap(perMetric) {
  const severityMap = new Map();
  
  if (!Array.isArray(perMetric)) {
    console.warn('[SYNC_GATE] ⚠️ perMetric não é array válido');
    return severityMap;
  }
  
  for (const metric of perMetric) {
    const canonicalKey = normalizeMetricKey(metric.key);
    
    // Mapear status da tabela para severidade/label padronizado
    let level, label, color, priority;
    
    if (metric.status === 'OK') {
      level = 'ok';
      label = 'OK';
      color = '#00ff88';
      priority = 0;
    } else if (metric.status === 'BAIXO' || metric.status === 'ALTO') {
      // Severidade baseada em metric.severity (leve/media/alta)
      if (metric.severity === 'alta') {
        level = 'critical';
        label = 'CRÍTICA';
        color = '#ff4444';
        priority = 3;
      } else if (metric.severity === 'media') {
        level = 'high';
        label = 'ALTA';
        color = '#ff8800';
        priority = 2;
      } else {
        // leve ou null
        level = 'warning';
        label = 'ATENÇÃO';
        color = '#ffcc00';
        priority = 1;
      }
    } else {
      // Status desconhecido - tratar como OK para não criar sugestão
      level = 'ok';
      label = 'OK';
      color = '#00ff88';
      priority = 0;
    }
    
    severityMap.set(canonicalKey, {
      status: metric.status,
      severity: metric.severity,
      level,
      label,
      color,
      priority,
      value: metric.value,
      target: metric.target,
      diff: metric.diff,
      score: metric.score
    });
  }
  
  console.log('[SYNC_GATE] 📊 Mapa de severidade extraído:', {
    totalMetrics: severityMap.size,
    keys: Array.from(severityMap.keys()),
    okCount: Array.from(severityMap.values()).filter(v => v.level === 'ok').length,
    nonOkCount: Array.from(severityMap.values()).filter(v => v.level !== 'ok').length
  });
  
  return severityMap;
}

/**
 * 🎯 SYNC GATE PRINCIPAL
 * Filtra e sincroniza sugestões com tabela (fonte da verdade)
 * 
 * @param {Array} suggestions - Array de sugestões a filtrar
 * @param {Map} severityMap - Mapa de severidade da tabela
 * @param {string} jobId - ID do job (para logs)
 * @returns {Array} - Sugestões filtradas e sincronizadas
 */
export function filterSuggestionsByTableSeverity(suggestions, severityMap, jobId = 'unknown') {
  if (!Array.isArray(suggestions)) {
    console.warn(`[SYNC_GATE][${jobId}] ⚠️ suggestions não é array válido`);
    return [];
  }
  
  if (!severityMap || !(severityMap instanceof Map)) {
    console.warn(`[SYNC_GATE][${jobId}] ⚠️ severityMap inválido - retornando sugestões sem filtro`);
    return suggestions;
  }
  
  console.log(`[SYNC_GATE][${jobId}] 🎯 Iniciando sync gate...`);
  console.log(`[SYNC_GATE][${jobId}] 📥 Input: ${suggestions.length} sugestões`);
  
  const filtered = [];
  const removed = [];
  const missing = [];
  
  // 1. Filtrar sugestões baseado na tabela
  for (const suggestion of suggestions) {
    // Extrair chave canônica da sugestão
    const suggestionKey = suggestion.metric || suggestion.type || suggestion.key;
    const canonicalKey = normalizeMetricKey(suggestionKey);
    
    if (!canonicalKey) {
      console.warn(`[SYNC_GATE][${jobId}] ⚠️ Sugestão sem chave válida:`, suggestion);
      continue;
    }
    
    // Buscar severidade na tabela
    const tableSeverity = severityMap.get(canonicalKey);
    
    if (!tableSeverity) {
      console.warn(`[SYNC_GATE][${jobId}] ⚠️ Sugestão para métrica não encontrada na tabela: ${canonicalKey}`);
      // Manter por segurança (pode ser métrica adicional válida)
      filtered.push(suggestion);
      continue;
    }
    
    // REGRA CENTRAL: Só manter se NÃO for OK na tabela
    if (tableSeverity.level === 'ok') {
      removed.push(canonicalKey);
      console.log(`[SYNC_GATE][${jobId}] 🟢 REMOVENDO sugestão OK: ${canonicalKey}`, {
        value: tableSeverity.value,
        target: tableSeverity.target,
        status: tableSeverity.status
      });
      continue;
    }
    
    // Sincronizar severity da sugestão com a tabela (fonte da verdade)
    const syncedSuggestion = {
      ...suggestion,
      severity: {
        level: tableSeverity.level,
        label: tableSeverity.label,
        color: tableSeverity.color,
        priority: tableSeverity.priority
      }
    };
    
    filtered.push(syncedSuggestion);
    console.log(`[SYNC_GATE][${jobId}] ✅ MANTENDO sugestão: ${canonicalKey}`, {
      severity: tableSeverity.label,
      status: tableSeverity.status
    });
  }
  
  // 2. Verificar completude (métricas não-OK sem sugestão)
  const presentKeys = new Set(
    filtered.map(s => normalizeMetricKey(s.metric || s.type || s.key))
  );
  
  for (const [key, severity] of severityMap.entries()) {
    if (severity.level !== 'ok' && !presentKeys.has(key)) {
      missing.push(key);
    }
  }
  
  // LOGS DE DIAGNÓSTICO
  console.log('[SYNC_GATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[SYNC_GATE][${jobId}] 📊 RESULTADO DO SYNC GATE:`);
  console.log('[SYNC_GATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[SYNC_GATE][${jobId}] 📥 Input: ${suggestions.length} sugestões`);
  console.log(`[SYNC_GATE][${jobId}] 📤 Output: ${filtered.length} sugestões`);
  console.log(`[SYNC_GATE][${jobId}] 🟢 Removidas (OK): ${removed.length}`, removed);
  console.log(`[SYNC_GATE][${jobId}] 🟡 Esperadas (tabela não-OK): ${Array.from(severityMap.values()).filter(v => v.level !== 'ok').length}`);
  console.log(`[SYNC_GATE][${jobId}] ✅ Presentes (após filtro): ${presentKeys.size}`);
  
  if (missing.length > 0) {
    console.warn(`[SYNC_GATE][${jobId}] ⚠️ ⚠️ ⚠️ ATENÇÃO: Métricas não-OK SEM sugestão:`, missing);
    console.warn(`[SYNC_GATE][${jobId}] 📋 Detalhes:`);
    for (const key of missing) {
      const info = severityMap.get(key);
      console.warn(`[SYNC_GATE][${jobId}]   - ${key}:`, {
        severity: info.label,
        status: info.status,
        value: info.value,
        target: info.target
      });
    }
    console.warn(`[SYNC_GATE][${jobId}] 🔍 CAUSA PROVÁVEL: Função analyze para essa métrica não rodou ou falhou`);
  } else {
    console.log(`[SYNC_GATE][${jobId}] ✅ COMPLETUDE OK: Todas as métricas não-OK têm sugestão`);
  }
  
  console.log('[SYNC_GATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return filtered;
}

/**
 * 🎯 FUNÇÃO PRINCIPAL: Sincronizar todas as listas de sugestões com a tabela
 * 
 * @param {Object} jobResult - Objeto completo do resultado do job
 * @param {string} jobId - ID do job
 * @returns {Object} - jobResult com sugestões sincronizadas
 */
export function syncAndFilterSuggestionsWithTable(jobResult, jobId = 'unknown') {
  console.log('[SYNC_GATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[SYNC_GATE][${jobId}] 🚀 APLICANDO SYNC GATE GLOBAL`);
  console.log('[SYNC_GATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 1. Validar que existe tabela (scoring result)
  if (!jobResult || !jobResult.scoring || !Array.isArray(jobResult.scoring.perMetric)) {
    console.error(`[SYNC_GATE][${jobId}] ❌ scoring.perMetric ausente - IMPOSSÍVEL aplicar sync gate`);
    console.error(`[SYNC_GATE][${jobId}] 📦 jobResult disponível:`, {
      hasScoring: !!jobResult?.scoring,
      hasPerMetric: !!jobResult?.scoring?.perMetric,
      keys: jobResult ? Object.keys(jobResult) : []
    });
    return jobResult;
  }
  
  // 2. Extrair mapa de severidade da tabela (fonte da verdade)
  const severityMap = extractTableSeverityMap(jobResult.scoring.perMetric);
  
  if (severityMap.size === 0) {
    console.warn(`[SYNC_GATE][${jobId}] ⚠️ Mapa de severidade vazio - nada para sincronizar`);
    return jobResult;
  }
  
  // 3. Aplicar filtro em TODAS as listas de sugestões
  const listsToSync = [
    'suggestions',
    'diagnostics.suggestions',
    'problemsAnalysis.suggestions',
    'aiSuggestions'
  ];
  
  for (const path of listsToSync) {
    const parts = path.split('.');
    let target = jobResult;
    
    // Navegar até o array
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) {
        target = null;
        break;
      }
      target = target[parts[i]];
    }
    
    if (!target) continue;
    
    const key = parts[parts.length - 1];
    const originalList = target[key];
    
    if (Array.isArray(originalList) && originalList.length > 0) {
      console.log(`[SYNC_GATE][${jobId}] 🔄 Sincronizando ${path}...`);
      target[key] = filterSuggestionsByTableSeverity(originalList, severityMap, jobId);
      console.log(`[SYNC_GATE][${jobId}] ✅ ${path}: ${originalList.length} → ${target[key].length}`);
    }
  }
  
  // 4. Atualizar metadados
  if (jobResult.suggestions && Array.isArray(jobResult.suggestions)) {
    const criticalCount = jobResult.suggestions.filter(s => s.severity?.level === 'critical').length;
    const highCount = jobResult.suggestions.filter(s => s.severity?.level === 'high').length;
    const warningCount = jobResult.suggestions.filter(s => s.severity?.level === 'warning').length;
    
    if (jobResult.problemsAnalysis && typeof jobResult.problemsAnalysis === 'object') {
      if (!jobResult.problemsAnalysis.metadata) {
        jobResult.problemsAnalysis.metadata = {};
      }
      jobResult.problemsAnalysis.metadata.criticalCount = criticalCount;
      jobResult.problemsAnalysis.metadata.warningCount = highCount + warningCount;
      jobResult.problemsAnalysis.metadata.totalSuggestions = jobResult.suggestions.length;
    }
    
    if (jobResult.diagnostics && typeof jobResult.diagnostics === 'object') {
      if (!jobResult.diagnostics.metadata) {
        jobResult.diagnostics.metadata = {};
      }
      jobResult.diagnostics.metadata.criticalCount = criticalCount;
      jobResult.diagnostics.metadata.warningCount = highCount + warningCount;
    }
    
    console.log(`[SYNC_GATE][${jobId}] 📊 Metadados atualizados:`, {
      totalSuggestions: jobResult.suggestions.length,
      criticalCount,
      highCount,
      warningCount
    });
  }
  
  console.log('[SYNC_GATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[SYNC_GATE][${jobId}] ✅ SYNC GATE COMPLETO`);
  console.log('[SYNC_GATE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return jobResult;
}
