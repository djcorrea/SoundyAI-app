/**
 * 🎯 ANALYSIS PROMPT FILTER
 * Filtra e otimiza dados de análise de áudio para envio ao chat
 * Remove campos desnecessários, mantém apenas o essencial
 * Reduz uso de tokens preservando qualidade técnica
 */

/**
 * Prepara dados de análise para envio otimizado ao prompt
 * @param {Object} analysis - Objeto completo de análise de áudio
 * @returns {Object} Análise filtrada e otimizada
 */
export function prepareAnalysisForPrompt(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    console.warn('⚠️ Análise inválida recebida no filter');
    return null;
  }

  const td = analysis.technicalData || {};
  const sugList = analysis.suggestionsSnapshot || analysis.suggestions || [];
  const problems = analysis.problems || [];

  // 🎯 MÉTRICAS ESSENCIAIS (apenas o que importa musicalmente)
  const essentialMetrics = {
    // Loudness (crítico)
    lufsIntegrated: td.lufsIntegrated,
    lra: td.lra,
    
    // Peaks (crítico)
    truePeakDbtp: td.truePeakDbtp,
    peak: td.peak,
    
    // Dinâmica (crítico)
    dynamicRange: td.dynamicRange,
    crestFactor: td.crestFactor,
    
    // Frequência (importante)
    spectralCentroid: td.spectralCentroid,
    
    // Informações técnicas básicas
    rms: td.rms,
    clippingSamples: td.clippingSamples > 0 ? td.clippingSamples : undefined
  };

  // Remove valores null/undefined
  Object.keys(essentialMetrics).forEach(key => {
    if (essentialMetrics[key] === null || essentialMetrics[key] === undefined) {
      delete essentialMetrics[key];
    }
  });

  // 🎯 FREQUÊNCIAS DOMINANTES (apenas top 3 mais relevantes)
  const dominantFreqs = td.dominantFrequencies?.slice(0, 3).map(f => ({
    freq: Math.round(f.frequency),
    mag: parseFloat(f.magnitude?.toFixed(1))
  })) || [];

  // 🎯 BANDAS ESPECTRAIS (simplificadas)
  const spectralBands = {};
  if (td.spectralBands && typeof td.spectralBands === 'object') {
    Object.keys(td.spectralBands).forEach(band => {
      const bandData = td.spectralBands[band];
      if (bandData && typeof bandData === 'object') {
        spectralBands[band] = {
          energy: parseFloat(bandData.energyDb?.toFixed(1)),
          status: bandData.status || 'ok'
        };
      }
    });
  }

  // 🎯 PROBLEMAS (simplificados - apenas essência)
  const criticalProblems = problems.slice(0, 5).map(p => ({
    type: p.type,
    message: p.message,
    solution: p.solution,
    impact: p.impact,
    freqRange: p.frequency_range
  }));

  // 🎯 SUGESTÕES (simplificadas - apenas ação + explicação)
  const criticalSuggestions = sugList.slice(0, 8).map(s => ({
    type: s.type,
    message: s.message,
    action: s.action,
    explanation: s.explanation,
    freqRange: s.frequency_range,
    adjustDb: s.adjustment_db
  }));

  // 🎯 CONTEXTO MUSICAL
  const musicalContext = {
    genre: analysis.genre || analysis.selectedGenre,
    bpm: analysis.bpm,
    score: analysis.mixScore?.scorePct,
    classification: analysis.mixScore?.classification
  };

  // 🎯 RETORNO OTIMIZADO
  return {
    metrics: essentialMetrics,
    dominantFrequencies: dominantFreqs,
    spectralBands: spectralBands,
    problems: criticalProblems,
    suggestions: criticalSuggestions,
    context: musicalContext
  };
}

/**
 * Converte análise filtrada em texto legível para o prompt
 * @param {Object} filteredAnalysis - Análise filtrada
 * @returns {string} Texto formatado para prompt
 */
export function formatAnalysisAsText(filteredAnalysis) {
  if (!filteredAnalysis) return '';

  const { metrics, dominantFrequencies, spectralBands, problems, suggestions, context } = filteredAnalysis;

  let text = '🎵 ANÁLISE TÉCNICA DE ÁUDIO\n\n';

  // Contexto musical
  if (context.genre) text += `📊 Gênero: ${context.genre}\n`;
  if (context.bpm) text += `⏱️ BPM: ${context.bpm}\n`;
  if (context.score !== undefined) text += `🎯 Score: ${context.score}% (${context.classification})\n`;
  text += '\n';

  // Métricas essenciais
  text += '📈 MÉTRICAS PRINCIPAIS:\n';
  if (metrics.lufsIntegrated !== undefined) text += `• LUFS Integrado: ${metrics.lufsIntegrated.toFixed(1)} LUFS\n`;
  if (metrics.truePeakDbtp !== undefined) text += `• True Peak: ${metrics.truePeakDbtp.toFixed(1)} dBTP\n`;
  if (metrics.dynamicRange !== undefined) text += `• Dynamic Range: ${metrics.dynamicRange.toFixed(1)} dB\n`;
  if (metrics.lra !== undefined) text += `• LRA: ${metrics.lra.toFixed(1)} LU\n`;
  if (metrics.crestFactor !== undefined) text += `• Crest Factor: ${metrics.crestFactor.toFixed(1)} dB\n`;
  text += '\n';

  // Frequências dominantes
  if (dominantFrequencies.length > 0) {
    text += '🎼 FREQUÊNCIAS DOMINANTES:\n';
    dominantFrequencies.forEach(f => {
      text += `• ${f.freq} Hz (${f.mag} dB)\n`;
    });
    text += '\n';
  }

  // Bandas espectrais
  if (Object.keys(spectralBands).length > 0) {
    text += '🎚️ ANÁLISE ESPECTRAL:\n';
    Object.entries(spectralBands).forEach(([band, data]) => {
      const status = data.status === 'ideal' ? '✅' : data.status === 'ajustar' ? '⚠️' : '❌';
      text += `${status} ${band}: ${data.energy} dB\n`;
    });
    text += '\n';
  }

  // Problemas críticos
  if (problems.length > 0) {
    text += '🚨 PROBLEMAS DETECTADOS:\n';
    problems.forEach((p, i) => {
      text += `${i + 1}. ${p.message}\n`;
      if (p.solution) text += `   → ${p.solution}\n`;
    });
    text += '\n';
  }

  // Sugestões
  if (suggestions.length > 0) {
    text += '💡 SUGESTÕES DE CORREÇÃO:\n';
    suggestions.forEach((s, i) => {
      text += `${i + 1}. ${s.message}\n`;
      if (s.action) text += `   → ${s.action}\n`;
    });
  }

  return text;
}

/**
 * Estima o número de tokens de um texto
 * Aproximação: 1 token ≈ 4 caracteres em português
 * @param {string} text - Texto para estimar
 * @returns {number} Número estimado de tokens
 */
export function estimateTokens(text) {
  if (typeof text !== 'string') return 0;
  // Aproximação conservadora: 1 token ≈ 3.5 chars (português tem palavras maiores)
  return Math.ceil(text.length / 3.5);
}

/**
 * Valida se a análise filtrada é válida
 * @param {Object} filteredAnalysis - Análise filtrada
 * @returns {boolean} True se válida
 */
export function isValidFilteredAnalysis(filteredAnalysis) {
  if (!filteredAnalysis || typeof filteredAnalysis !== 'object') return false;
  
  const { metrics, context } = filteredAnalysis;
  
  // Deve ter pelo menos uma métrica essencial
  if (!metrics || Object.keys(metrics).length === 0) return false;
  
  // Contexto musical deve existir
  if (!context) return false;
  
  return true;
}
