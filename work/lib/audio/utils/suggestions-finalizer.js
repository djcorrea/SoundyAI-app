// 🎯 SUGGESTIONS FINALIZER - Alinha 100% sugestões com tabela de métricas
// Sistema de garantia de completude e consistência entre tabela (fonte da verdade) e sugestões renderizadas

/**
 * 🔧 Normaliza chaves de métricas para correspondência tabela ↔ sugestões
 * 
 * MAPEAMENTO CANÔNICO (Tabela → Sugestões):
 * - lufsIntegrated → lufs
 * - truePeakDbtp → truePeak
 * - tt_dr → dr
 * - dr_stat → dr
 * - band_sub → band_sub (já normalizado)
 * - stereoCorrelation → stereoCorrelation (já normalizado)
 * 
 * @param {string} key - Chave da métrica (pode ser da tabela ou da sugestão)
 * @returns {string} - Chave normalizada
 */
export function normalizeMetricKey(key) {
  if (!key || typeof key !== 'string') return '';
  
  // Mapeamento: Tabela → Forma canônica
  const tableToCanonical = {
    'lufsIntegrated': 'lufs',
    'truePeakDbtp': 'truePeak',
    'tt_dr': 'dr',
    'dr_stat': 'dr',
    'dynamicRange': 'dr',
    'stereoWidth': 'stereoWidth',
    'stereoCorrelation': 'stereoCorrelation', // alias: stereo
    'balanceLR': 'balanceLR',
    'lra': 'lra',
    'crestFactor': 'crestFactor'
  };
  
  // Normalização de bandas espectrais (suporta ambos formatos)
  // band_low_mid vs band_lowMid → band_low_mid (formato da tabela)
  if (key.startsWith('band_')) {
    return key.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2').replace(/__+/g, '_');
  }
  
  // Retornar chave mapeada ou original (já normalizada)
  return tableToCanonical[key] || key;
}

/**
 * 📊 Extrai mapa de status das métricas da tabela (scoring.perMetric)
 * 
 * @param {Object} scoringResult - Resultado do scoring (coreMetrics.scoring)
 * @returns {Map<string, Object>} - Map { keyNormalizada → { status, severity, value, target } }
 */
export function extractTableStatus(scoringResult) {
  const statusMap = new Map();
  
  if (!scoringResult || !Array.isArray(scoringResult.perMetric)) {
    console.warn('[FINALIZER] ⚠️ scoringResult.perMetric ausente - tabela vazia');
    return statusMap;
  }
  
  for (const metricRow of scoringResult.perMetric) {
    const normalizedKey = normalizeMetricKey(metricRow.key);
    
    statusMap.set(normalizedKey, {
      status: metricRow.status || 'OK',        // OK | BAIXO | ALTO
      severity: metricRow.severity || null,    // leve | media | alta | null
      value: metricRow.value,
      target: metricRow.target,
      tol_min: metricRow.tol_min,
      tol_max: metricRow.tol_max,
      score: metricRow.score,
      diff: metricRow.diff,
      originalKey: metricRow.key  // Preservar chave original da tabela
    });
  }
  
  console.log('[FINALIZER] 📊 Mapa de status da tabela extraído:', {
    totalMetrics: statusMap.size,
    keys: Array.from(statusMap.keys())
  });
  
  return statusMap;
}

/**
 * 🎯 Finaliza sugestões baseado na tabela (fonte da verdade)
 * 
 * REGRAS DE NEGÓCIO:
 * 1. NÃO CRIAR sugestão se status === 'OK' na tabela
 * 2. CRIAR sugestão se status === 'BAIXO' ou 'ALTO' na tabela
 * 3. GARANTIR COMPLETUDE: toda métrica não-OK tem sugestão correspondente
 * 4. PRESERVAR conteúdo: NÃO alterar mensagens/formato das sugestões existentes
 * 
 * @param {Array} suggestions - Sugestões geradas pelo V2 engine
 * @param {Object} scoringResult - Resultado do scoring (coreMetrics.scoring)
 * @param {string} jobId - ID do job (para logs)
 * @returns {Array} - Sugestões filtradas e validadas
 */
export function finalizeSuggestionsFromTable(suggestions, scoringResult, jobId = 'unknown') {
  console.log('[FINALIZER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[FINALIZER][${jobId}] 🎯 INICIANDO FINALIZAÇÃO DE SUGESTÕES`);
  console.log('[FINALIZER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Validar entrada
  if (!Array.isArray(suggestions)) {
    console.error(`[FINALIZER][${jobId}] ❌ suggestions não é array:`, typeof suggestions);
    return [];
  }
  
  if (!scoringResult) {
    console.warn(`[FINALIZER][${jobId}] ⚠️ scoringResult ausente - retornando sugestões sem validação`);
    return suggestions;
  }
  
  // PASSO 1: Extrair mapa de status da tabela (fonte da verdade)
  const tableStatus = extractTableStatus(scoringResult);
  
  // PASSO 2: Definir chaves permitidas (não-OK na tabela)
  const allowedKeys = new Set();
  const okKeys = new Set();
  
  for (const [key, info] of tableStatus.entries()) {
    if (info.status === 'OK') {
      okKeys.add(key);
    } else {
      allowedKeys.add(key);
    }
  }
  
  console.log(`[FINALIZER][${jobId}] 📊 Status da tabela:`, {
    totalMetrics: tableStatus.size,
    allowedKeys: allowedKeys.size,  // Amarelo + Vermelho (devem aparecer)
    okKeys: okKeys.size              // Verde (NÃO devem aparecer)
  });
  
  // PASSO 3: Filtrar sugestões baseado no status da tabela
  const filteredSuggestions = [];
  const removedKeys = [];
  
  for (const suggestion of suggestions) {
    const suggestionKey = normalizeMetricKey(suggestion.metric);
    
    if (!suggestionKey) {
      console.warn(`[FINALIZER][${jobId}] ⚠️ Sugestão sem métrica válida:`, suggestion);
      continue;
    }
    
    // Verificar se a métrica está OK na tabela
    if (okKeys.has(suggestionKey)) {
      removedKeys.push(suggestionKey);
      console.log(`[FINALIZER][${jobId}] 🟢 REMOVENDO sugestão OK: ${suggestionKey}`, {
        value: tableStatus.get(suggestionKey).value,
        target: tableStatus.get(suggestionKey).target,
        status: 'OK'
      });
      continue; // NÃO adicionar à lista final
    }
    
    // Verificar se está na lista de permitidos (não-OK)
    if (allowedKeys.has(suggestionKey)) {
      filteredSuggestions.push(suggestion);
      console.log(`[FINALIZER][${jobId}] ✅ MANTENDO sugestão: ${suggestionKey}`, {
        status: tableStatus.get(suggestionKey).status,
        severity: tableStatus.get(suggestionKey).severity
      });
    } else {
      // Métrica não está na tabela (possível erro)
      console.warn(`[FINALIZER][${jobId}] ⚠️ Sugestão para métrica não encontrada na tabela: ${suggestionKey}`);
      // Manter por segurança (não remover se não sabemos o status)
      filteredSuggestions.push(suggestion);
    }
  }
  
  // PASSO 4: Verificar completude (todas as métricas não-OK têm sugestão?)
  const presentKeys = new Set(
    filteredSuggestions.map(s => normalizeMetricKey(s.metric))
  );
  
  const missingKeys = [];
  const extraKeys = [];
  
  // Métricas esperadas (não-OK) que estão faltando
  for (const key of allowedKeys) {
    if (!presentKeys.has(key)) {
      missingKeys.push(key);
    }
  }
  
  // Sugestões presentes mas métricas estão OK (não deveriam aparecer)
  for (const key of presentKeys) {
    if (okKeys.has(key)) {
      extraKeys.push(key);
    }
  }
  
  // LOGS DE DIAGNÓSTICO (CRÍTICOS PARA DEBUG)
  console.log('[FINALIZER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[FINALIZER][${jobId}] 📊 RESULTADO DA FINALIZAÇÃO:`);
  console.log('[FINALIZER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[FINALIZER][${jobId}] 📥 Input: ${suggestions.length} sugestões`);
  console.log(`[FINALIZER][${jobId}] 📤 Output: ${filteredSuggestions.length} sugestões`);
  console.log(`[FINALIZER][${jobId}] 🟢 Removidas (OK): ${removedKeys.length}`, removedKeys);
  console.log(`[FINALIZER][${jobId}] 🟡 Esperadas (tabela): ${allowedKeys.size}`);
  console.log(`[FINALIZER][${jobId}] ✅ Presentes (sugestões): ${presentKeys.size}`);
  
  if (missingKeys.length > 0) {
    console.warn(`[FINALIZER][${jobId}] ⚠️ ⚠️ ⚠️ ATENÇÃO: Métricas não-OK SEM sugestão:`, missingKeys);
    console.warn(`[FINALIZER][${jobId}] 📋 Detalhes das métricas faltando:`);
    for (const key of missingKeys) {
      const info = tableStatus.get(key);
      console.warn(`[FINALIZER][${jobId}]   - ${key}:`, {
        status: info.status,
        severity: info.severity,
        value: info.value,
        target: info.target,
        diff: info.diff
      });
    }
    console.warn(`[FINALIZER][${jobId}] 🔍 CAUSA PROVÁVEL: Função analyze${key} não foi chamada ou falhou silenciosamente`);
  } else {
    console.log(`[FINALIZER][${jobId}] ✅ COMPLETUDE OK: Todas as métricas não-OK têm sugestão`);
  }
  
  if (extraKeys.length > 0) {
    console.error(`[FINALIZER][${jobId}] ❌ ❌ ❌ ERRO: Sugestões para métricas OK (não deveria existir):`, extraKeys);
    console.error(`[FINALIZER][${jobId}] 🔍 CAUSA PROVÁVEL: Verificação severity.level === 'ok' NÃO está funcionando`);
  }
  
  console.log('[FINALIZER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return filteredSuggestions;
}
