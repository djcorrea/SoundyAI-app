/**
 * 🎯 MÓDULO: Análise Espectral Granular V1
 * 
 * Implementa análise de sub-bandas com tolerâncias baseadas em sigma (σ),
 * agregação em grupos principais e geração inteligente de sugestões.
 * 
 * 🛡️ REGRAS:
 * - Reutiliza bins FFT existentes (NÃO recalcula FFT)
 * - LUFS já normalizado no pipeline anterior
 * - Mantém compatibilidade total com pipeline legado
 * - Adiciona campos novos sem quebrar contratos
 * 
 * @module spectral-bands-granular
 */

// ============================================================================
// CONSTANTES E CONFIGURAÇÃO
// ============================================================================

const SAMPLE_RATE = 48000;
const FFT_SIZE = 4096;
const DEFAULT_STEP_HZ = 20;

/**
 * Definição de bandas granulares padrão (Techno/Electronic)
 * Cada sub-banda tem ~20-30 Hz de largura para alta resolução
 */
const DEFAULT_GRANULAR_BANDS = [
  { id: 'sub_low', range: [20, 40], target: -28.0, toleranceSigma: 1.5, description: 'Sub-bass profundo (fundamental kick)' },
  { id: 'sub_high', range: [40, 60], target: -29.0, toleranceSigma: 1.5, description: 'Sub-bass alto (harmônicos kick)' },
  { id: 'bass_low', range: [60, 90], target: -28.5, toleranceSigma: 1.5, description: 'Bass baixo (corpo do kick)' },
  { id: 'bass_mid', range: [90, 120], target: -29.5, toleranceSigma: 1.5, description: 'Bass médio (punch)' },
  { id: 'bass_high', range: [120, 150], target: -30.0, toleranceSigma: 1.5, description: 'Bass alto (transiente)' },
  { id: 'lowmid_low', range: [150, 300], target: -31.0, toleranceSigma: 1.5, description: 'Low-mid baixo (corpo toms/synths)' },
  { id: 'lowmid_high', range: [300, 500], target: -33.0, toleranceSigma: 1.5, description: 'Low-mid alto (warmth)' },
  { id: 'mid_low', range: [500, 1000], target: -31.0, toleranceSigma: 1.5, description: 'Mid baixo (clareza vocal/lead)' },
  { id: 'mid_high', range: [1000, 2000], target: -33.0, toleranceSigma: 1.5, description: 'Mid alto (presença vocal)' },
  { id: 'highmid_low', range: [2000, 3500], target: -34.0, toleranceSigma: 1.5, description: 'High-mid baixo (articulação)' },
  { id: 'highmid_high', range: [3500, 5000], target: -36.0, toleranceSigma: 1.5, description: 'High-mid alto (definição)' },
  { id: 'presence', range: [5000, 10000], target: -40.0, toleranceSigma: 2.0, description: 'Presença (brilho/crash/hats)' },
  { id: 'air', range: [10000, 20000], target: -42.0, toleranceSigma: 2.0, description: 'Air (espaço/abertura/detalhes)' }
];

/**
 * Agrupamento de sub-bandas em 7 bandas principais (compatível com legacy)
 */
const DEFAULT_GROUPING = {
  sub: ['sub_low', 'sub_high'],
  bass: ['bass_low', 'bass_mid', 'bass_high'],
  low_mid: ['lowmid_low', 'lowmid_high'],
  mid: ['mid_low', 'mid_high'],
  high_mid: ['highmid_low', 'highmid_high'],
  presence: ['presence'],
  air: ['air']
};

/**
 * Pesos de severidade e thresholds para classificação
 */
const DEFAULT_SEVERITY = {
  weights: {
    ideal: 0,
    adjust: 1,
    fix: 3
  },
  thresholds: {
    greenMax: 0,
    yellowMax: 1.5
  }
};

/**
 * Configurações para geração de sugestões
 */
const DEFAULT_SUGGESTIONS_CONFIG = {
  minDbStep: 1.0,
  maxDbStep: 4.0,
  maxPerGroup: 3,
  minRelevanceDb: 1.0,
  language: 'pt-BR'
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Converte frequência (Hz) para índice de bin FFT
 * @param {number} freqHz - Frequência em Hz
 * @param {number} sampleRate - Taxa de amostragem
 * @param {number} fftSize - Tamanho da FFT
 * @returns {number} Índice do bin
 */
function freqToBin(freqHz, sampleRate = SAMPLE_RATE, fftSize = FFT_SIZE) {
  return Math.round((freqHz * fftSize) / sampleRate);
}

/**
 * Calcula energia RMS de um range de bins FFT (mono ou stereo)
 * @param {Object} frameFFT - Frame FFT com {magnitude, phase} ou {left, right}
 * @param {number} binStart - Bin inicial
 * @param {number} binEnd - Bin final
 * @returns {number} Energia RMS linear
 */
function calculateBinRangeEnergy(frameFFT, binStart, binEnd) {
  let sumSquares = 0;
  let count = 0;

  // Detectar se é stereo (tem left/right) ou mono (magnitude direto)
  const hasStereo = frameFFT.left && frameFFT.right;

  for (let bin = binStart; bin <= binEnd; bin++) {
    if (hasStereo) {
      const magL = frameFFT.left.magnitude?.[bin] || 0;
      const magR = frameFFT.right.magnitude?.[bin] || 0;
      // RMS stereo: sqrt((L² + R²) / 2)
      sumSquares += (magL * magL + magR * magR) / 2;
    } else {
      const mag = frameFFT.magnitude?.[bin] || 0;
      sumSquares += mag * mag;
    }
    count++;
  }

  if (count === 0) return 0;
  return Math.sqrt(sumSquares / count);
}

/**
 * Converte energia linear para dB
 * @param {number} linear - Valor linear
 * @returns {number} Valor em dB
 */
function linearToDb(linear) {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/**
 * Calcula mediana de array
 * @param {number[]} arr - Array de números
 * @returns {number} Mediana
 */
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Determina status baseado em desvio vs sigma
 * @param {number} deviation - Desvio em dB
 * @param {number} sigma - Tolerância sigma
 * @returns {string} 'ideal' | 'adjust' | 'fix'
 */
function statusFromDeviation(deviation, sigma = 1.5) {
  const abs = Math.abs(deviation);
  if (abs <= sigma) return 'ideal';
  if (abs <= sigma * 2) return 'adjust';
  return 'fix';
}

// ============================================================================
// FUNÇÃO PRINCIPAL: ANÁLISE GRANULAR
// ============================================================================

/**
 * Analisa espectro em sub-bandas granulares
 * 
 * @param {Array} framesFFT - Array de frames FFT do pipeline
 * @param {Object} reference - Referência de gênero (opcional)
 * @returns {Object} Resultado com sub-bandas analisadas
 */
async function analyzeGranularSpectralBands(framesFFT, reference = null) {
  // Validação
  if (!framesFFT || !Array.isArray(framesFFT) || framesFFT.length === 0) {
    throw new Error('framesFFT inválido ou vazio');
  }

  // Carregar configuração da referência ou usar padrões
  const bands = reference?.bands || DEFAULT_GRANULAR_BANDS;
  const grouping = reference?.grouping || DEFAULT_GROUPING;
  const severity = reference?.severity || DEFAULT_SEVERITY;
  const suggestionsConfig = reference?.suggestions || DEFAULT_SUGGESTIONS_CONFIG;

  // Array para armazenar resultados por sub-banda
  const subBandResults = [];

  // Para cada sub-banda definida
  for (const band of bands) {
    const [freqStart, freqEnd] = band.range;
    const binStart = freqToBin(freqStart);
    const binEnd = freqToBin(freqEnd);

    // Coletar energia de todos os frames (para calcular mediana)
    const energiesDb = [];

    for (const frame of framesFFT) {
      const energyLinear = calculateBinRangeEnergy(frame, binStart, binEnd);
      const energyDb = linearToDb(energyLinear);
      
      // Ignorar -Infinity
      if (isFinite(energyDb)) {
        energiesDb.push(energyDb);
      }
    }

    // Calcular mediana (mais robusto que média)
    const medianEnergyDb = median(energiesDb);

    // Calcular desvio vs target
    const target = band.target;
    const deviation = medianEnergyDb - target;
    const toleranceSigma = band.toleranceSigma || 1.5;
    const status = statusFromDeviation(deviation, toleranceSigma);

    // Armazenar resultado
    subBandResults.push({
      id: band.id,
      range: band.range,
      energyDb: parseFloat(medianEnergyDb.toFixed(2)),
      target: target,
      toleranceSigma: toleranceSigma,
      deviation: parseFloat(deviation.toFixed(2)),
      deviationSigmas: parseFloat((deviation / toleranceSigma).toFixed(2)),
      status: status,
      description: band.description || ''
    });
  }

  // Agregar sub-bandas em grupos principais
  const groups = aggregateSubBandsIntoGroups(subBandResults, grouping, severity);

  // Gerar sugestões inteligentes
  const suggestions = buildSuggestions(subBandResults, grouping, suggestionsConfig);

  // Retornar resultado completo
  return {
    algorithm: 'granular_v1',
    referenceGenre: reference?.genre || 'techno',
    schemaVersion: reference?.schemaVersion || 1,
    lufsNormalization: true, // LUFS já normalizado no pipeline
    framesProcessed: framesFFT.length,
    aggregationMethod: 'median',
    groups: groups,
    granular: subBandResults,
    suggestions: suggestions,
    subBandsTotal: subBandResults.length,
    subBandsIdeal: subBandResults.filter(s => s.status === 'ideal').length,
    subBandsAdjust: subBandResults.filter(s => s.status === 'adjust').length,
    subBandsFix: subBandResults.filter(s => s.status === 'fix').length
  };
}

// ============================================================================
// AGREGAÇÃO EM GRUPOS PRINCIPAIS
// ============================================================================

/**
 * Agrupa sub-bandas em 7 bandas principais (compatível com legacy)
 * 
 * @param {Array} subBandResults - Resultados das sub-bandas
 * @param {Object} grouping - Mapeamento de grupos
 * @param {Object} severity - Pesos e thresholds
 * @returns {Object} Grupos com status e score
 */
function aggregateSubBandsIntoGroups(subBandResults, grouping, severity) {
  const groups = {};
  const weights = severity.weights;
  const thresholds = severity.thresholds;

  for (const [groupName, subBandIds] of Object.entries(grouping)) {
    // Filtrar sub-bandas deste grupo
    const subBands = subBandResults.filter(s => subBandIds.includes(s.id));

    if (subBands.length === 0) {
      groups[groupName] = {
        status: 'green',
        score: 0.0,
        subBandsCount: 0
      };
      continue;
    }

    // Calcular score médio baseado nos pesos
    const totalPoints = subBands.reduce((acc, s) => acc + weights[s.status], 0);
    const avgScore = totalPoints / subBands.length;

    // Determinar cor (green/yellow/red)
    let color = 'green';
    if (avgScore > thresholds.yellowMax) {
      color = 'red';
    } else if (avgScore > thresholds.greenMax) {
      color = 'yellow';
    }

    groups[groupName] = {
      status: color,
      score: parseFloat(avgScore.toFixed(2)),
      subBandsCount: subBands.length,
      description: color === 'green' 
        ? `${groupName.replace('_', '-')} ideal`
        : color === 'yellow'
        ? `${groupName.replace('_', '-')} com desvio moderado`
        : `${groupName.replace('_', '-')} com excesso/falta significativo`
    };
  }

  return groups;
}

// ============================================================================
// GERAÇÃO DE SUGESTÕES INTELIGENTES
// ============================================================================

/**
 * Gera sugestões inteligentes baseadas em sub-bandas com problemas
 * 
 * @param {Array} subBandResults - Resultados das sub-bandas
 * @param {Object} grouping - Mapeamento de grupos
 * @param {Object} config - Configurações de sugestões
 * @returns {Array} Lista de sugestões ordenadas por prioridade
 */
function buildSuggestions(subBandResults, grouping, config) {
  const suggestions = [];
  const minRelevance = config.minRelevanceDb || 1.0;
  const maxPerGroup = config.maxPerGroup || 3;
  const minDbStep = config.minDbStep || 1.0;
  const maxDbStep = config.maxDbStep || 4.0;

  // Filtrar apenas sub-bandas com problemas (adjust ou fix)
  const problematicBands = subBandResults.filter(
    s => s.status === 'adjust' || s.status === 'fix'
  );

  // Ordenar por magnitude do desvio (maiores primeiro)
  const sorted = [...problematicBands].sort(
    (a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)
  );

  // Contar sugestões por grupo
  const countByGroup = {};

  for (const band of sorted) {
    // Verificar relevância mínima
    if (Math.abs(band.deviation) < minRelevance) continue;

    // Encontrar grupo desta sub-banda
    let groupName = null;
    for (const [gname, ids] of Object.entries(grouping)) {
      if (ids.includes(band.id)) {
        groupName = gname;
        break;
      }
    }

    if (!groupName) continue;

    // Limitar sugestões por grupo
    countByGroup[groupName] = (countByGroup[groupName] || 0);
    if (countByGroup[groupName] >= maxPerGroup) continue;

    // Determinar tipo (boost/cut) e quantidade
    const type = band.deviation < 0 ? 'boost' : 'cut';
    const absDeviation = Math.abs(band.deviation);
    
    // Limitar quantidade entre minDbStep e maxDbStep
    let amount = Math.min(Math.max(absDeviation, minDbStep), maxDbStep);
    amount = parseFloat(amount.toFixed(1));

    // Determinar prioridade
    const priority = band.status === 'fix' ? 'high' : 'medium';

    // Mensagem em português
    const [freqStart, freqEnd] = band.range;
    let message = '';
    
    if (type === 'boost') {
      message = `Falta energia em ${freqStart}–${freqEnd} Hz — reforçar ~${amount} dB`;
      if (band.description) {
        message += ` (${band.description.split('(')[1]?.replace(')', '') || band.description})`;
      }
      message += '.';
    } else {
      message = `Excesso em ${freqStart}–${freqEnd} Hz — reduzir ~${amount} dB`;
      if (band.description) {
        message += ` (${band.description.split('(')[1]?.replace(')', '') || band.description})`;
      }
      message += '.';
    }

    suggestions.push({
      priority: priority,
      freq_range: band.range,
      type: type,
      amount: amount,
      metric: 'frequency_balance',
      deviation: band.deviation,
      message: message
    });

    countByGroup[groupName]++;
  }

  // Ordenar: high priority primeiro, depois por magnitude de desvio
  suggestions.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return Math.abs(b.deviation) - Math.abs(a.deviation);
  });

  return suggestions;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  analyzeGranularSpectralBands,
  aggregateSubBandsIntoGroups,
  buildSuggestions,
  // Exportar também constantes e utilitários para testes
  DEFAULT_GRANULAR_BANDS,
  DEFAULT_GROUPING,
  DEFAULT_SEVERITY,
  DEFAULT_SUGGESTIONS_CONFIG,
  freqToBin,
  linearToDb,
  statusFromDeviation
};
