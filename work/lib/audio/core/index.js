/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎯 CORE AUDIO PIPELINE - ÍNDICE CENTRAL
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo exporta as funções centrais para análise de áudio:
 *   - resolveTargets: Resolve e normaliza targets de gênero
 *   - compareWithTargets: Compara métricas com targets
 *   - validateTargets: Valida integridade dos targets
 * 
 * USO:
 *   import { resolveTargets, compareWithTargets, validateTargets } from './core/index.js';
 *   
 *   const targets = resolveTargets('funk_mandela', 'pista', rawTargets);
 *   const result = compareWithTargets(metrics, targets);
 *   // result.rows → Tabela
 *   // result.issues → Sugestões
 *   // result.score → Pontuação
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

// Core functions
export { 
  resolveTargets, 
  validateTargets,
  TRUE_PEAK_HARD_CAP,
  SAFE_DEFAULTS
} from './resolveTargets.js';

export { 
  compareWithTargets,
  METRIC_LABELS,
  BAND_LABELS,
  METRIC_UNITS,
  METRIC_CATEGORIES,
  evaluateTruePeak,
  evaluateRangeMetric,
  evaluateBand,
  normalizeMetrics,
  classifyScore
} from './compareWithTargets.js';

/**
 * 🔥 PIPELINE COMPLETO: resolveTargets + compareWithTargets em uma chamada
 * 
 * @param {Object} metrics - Métricas medidas do áudio
 * @param {string} genreId - ID do gênero
 * @param {string} mode - Modo ('pista', 'streaming', 'carro')
 * @param {Object|null} rawTargets - Targets já carregados
 * @returns {Object} - Resultado completo { rows, issues, score, targets }
 */
export function analyzeWithTargets(metrics, genreId, mode = 'pista', rawTargets = null) {
  const { resolveTargets } = require('./resolveTargets.js');
  const { compareWithTargets } = require('./compareWithTargets.js');
  
  // Resolver targets
  const targets = resolveTargets(genreId, mode, rawTargets);
  
  // Comparar métricas
  const comparison = compareWithTargets(metrics, targets);
  
  return {
    ...comparison,
    targets, // Incluir targets usados para debug
    _pipeline: 'analyzeWithTargets',
    _genre: genreId,
    _mode: mode
  };
}

console.log('🎯 Core Audio Pipeline Index v1.0.0 carregado');
