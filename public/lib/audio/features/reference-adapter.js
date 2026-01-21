// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * ============================================================================
 * REFERENCE ADAPTER - Single Source of Truth para Targets
 * ============================================================================
 * 
 * Este módulo é a ÚNICA fonte de verdade para targets/ranges de métricas.
 * Tanto o scorer quanto a tabela de referência DEVEM usar este adapter.
 * 
 * @version 1.0.0
 * @author SoundyAI Team
 */

// ============================================================================
// CONFIGURAÇÃO BASE POR MODO
// ============================================================================
const MODE_TARGETS = {
  streaming: {
    truePeak: { target: -1.0, min: -3.0, max: -1.0, unit: 'dBTP' },  // max = -1.0 (streaming compliance)
    lufs: { target: -14.0, min: -16.0, max: -12.0, unit: 'LUFS' },
    lra: { target: 7.0, min: 4.0, max: 12.0, unit: 'LU' },
    stereoWidth: { target: 0.6, min: 0.3, max: 0.9, unit: '' },
    dynamicRange: { target: 8.0, min: 5.0, max: 14.0, unit: 'dB' },
    crestFactor: { target: 12.0, min: 8.0, max: 18.0, unit: 'dB' }
  },
  pista: {
    truePeak: { target: -0.3, min: -1.5, max: 0.0, unit: 'dBTP' },  // max = 0 (permite clipping sutil)
    lufs: { target: -9.0, min: -12.0, max: -6.0, unit: 'LUFS' },
    lra: { target: 5.0, min: 3.0, max: 8.0, unit: 'LU' },
    stereoWidth: { target: 0.7, min: 0.4, max: 0.95, unit: '' },
    dynamicRange: { target: 6.0, min: 4.0, max: 10.0, unit: 'dB' },
    crestFactor: { target: 10.0, min: 6.0, max: 14.0, unit: 'dB' }
  },
  reference: {
    truePeak: { target: -1.0, min: -3.0, max: 0.0, unit: 'dBTP' },  // max = 0 (sem clipping)
    lufs: { target: -14.0, min: -18.0, max: -8.0, unit: 'LUFS' },
    lra: { target: 8.0, min: 5.0, max: 14.0, unit: 'LU' },
    stereoWidth: { target: 0.6, min: 0.3, max: 0.9, unit: '' },
    dynamicRange: { target: 10.0, min: 6.0, max: 16.0, unit: 'dB' },
    crestFactor: { target: 14.0, min: 10.0, max: 20.0, unit: 'dB' }
  }
};

// Alias para modos comuns
MODE_TARGETS.digital = MODE_TARGETS.streaming;
MODE_TARGETS.club = MODE_TARGETS.pista;
MODE_TARGETS.mastering = MODE_TARGETS.reference;

// ============================================================================
// HARD GATES - Limites absolutos que DERRUBAM o score
// ============================================================================
const HARD_GATES = {
  // TRUE PEAK acima do max do modo = score <= 30, erro crítico
  truePeakClipping: {
    id: 'TRUE_PEAK_CLIPPING',
    description: 'True Peak acima do máximo permitido para o modo',
    scoreCap: 30,
    criticalError: true,
    getViolation: (value, targets) => {
      if (value > targets.truePeak.max) {
        return {
          triggered: true,
          message: `True Peak ${value.toFixed(2)} dBTP > ${targets.truePeak.max} dBTP (max do modo)`,
          excess: value - targets.truePeak.max
        };
      }
      return { triggered: false };
    }
  },
  
  // CLIPPING severo (> 5% das amostras)
  clippingSevere: {
    id: 'CLIPPING_SEVERE',
    description: 'Clipping em mais de 5% das amostras',
    scoreCap: 40,
    criticalError: true,
    getViolation: (value, _) => {
      if (value > 5) {
        return {
          triggered: true,
          message: `Clipping em ${value.toFixed(2)}% das amostras (> 5%)`,
          excess: value - 5
        };
      }
      return { triggered: false };
    }
  },
  
  // LUFS muito acima (loudness war)
  lufsExcessive: {
    id: 'LUFS_EXCESSIVE',
    description: 'LUFS acima do máximo (over-compressed)',
    scoreCap: 50,
    criticalError: false,
    getViolation: (value, targets) => {
      const margin = 2; // 2 LU de margem além do max
      if (value > targets.lufs.max + margin) {
        return {
          triggered: true,
          message: `LUFS ${value.toFixed(1)} > ${targets.lufs.max + margin} (limite + margem)`,
          excess: value - (targets.lufs.max + margin)
        };
      }
      return { triggered: false };
    }
  }
};

// ============================================================================
// FUNÇÃO PRINCIPAL: normalizeReference
// ============================================================================
/**
 * Normaliza uma referência para formato padronizado
 * Esta é a ÚNICA função que deve ser usada para obter targets
 * 
 * @param {Object} ref - Referência original (pode ser null)
 * @param {Object} options - Opções de normalização
 * @param {string} options.mode - Modo de análise: 'streaming' | 'pista' | 'reference'
 * @param {string} options.genre - ID do gênero (opcional, para ajustes específicos)
 * @returns {Object} Referência normalizada com targets.*, bands.*, mode, genre
 */
export function normalizeReference(ref = null, options = {}) {
  const mode = options.mode || 'streaming';
  const genre = options.genre || 'default';
  
  // Obter targets base do modo
  const modeTargets = MODE_TARGETS[mode] || MODE_TARGETS.streaming;
  
  // Construir objeto normalizado
  const normalized = {
    // Metadados
    _version: '1.0.0',
    _normalizedAt: new Date().toISOString(),
    mode: mode,
    genre: genre,
    source: ref ? 'custom_reference' : 'mode_defaults',
    
    // Targets principais
    targets: {
      truePeak: { ...modeTargets.truePeak },
      lufs: { ...modeTargets.lufs },
      lra: { ...modeTargets.lra },
      stereoWidth: { ...modeTargets.stereoWidth },
      dynamicRange: { ...modeTargets.dynamicRange },
      crestFactor: { ...modeTargets.crestFactor }
    },
    
    // Bandas espectrais (será preenchido abaixo se disponível)
    bands: {},
    
    // Hard gates do modo
    hardGates: { ...HARD_GATES }
  };
  
  // Se temos referência customizada, mesclar valores
  if (ref && typeof ref === 'object') {
    // Mesclar targets de referência customizada
    if (ref.targets) {
      for (const [key, value] of Object.entries(ref.targets)) {
        if (normalized.targets[key] && typeof value === 'object') {
          normalized.targets[key] = { ...normalized.targets[key], ...value };
        }
      }
    }
    
    // Mesclar targets diretos (formato antigo)
    if (ref.lufs_integrated != null) {
      normalized.targets.lufs.target = ref.lufs_integrated;
    }
    if (ref.true_peak_dbtp != null || ref.truePeakDbtp != null) {
      const tpTarget = ref.true_peak_dbtp ?? ref.truePeakDbtp;
      normalized.targets.truePeak.target = tpTarget;
      // Ajustar max se target for mais restritivo
      if (tpTarget < normalized.targets.truePeak.max) {
        normalized.targets.truePeak.max = tpTarget;
      }
    }
    if (ref.lra != null) {
      normalized.targets.lra.target = ref.lra;
    }
    
    // Mesclar bandas espectrais
    if (ref.bands) {
      for (const [bandName, bandData] of Object.entries(ref.bands)) {
        normalized.bands[bandName] = normalizeBand(bandData, bandName);
      }
    }
    
    // Formato alternativo: ref.sub, ref.bass, etc.
    const bandNames = ['sub', 'bass', 'low_mid', 'mid', 'high_mid', 'presence', 'brilliance'];
    for (const name of bandNames) {
      if (ref[name] && typeof ref[name] === 'object') {
        normalized.bands[name] = normalizeBand(ref[name], name);
      }
    }
  }
  
  // Log de debug
  if (typeof window !== 'undefined' && window.DEBUG_REFERENCE_ADAPTER) {
    log('[REFERENCE_ADAPTER] normalizeReference:', {
      mode,
      genre,
      source: normalized.source,
      truePeakMax: normalized.targets.truePeak.max,
      lufsTarget: normalized.targets.lufs.target
    });
  }
  
  return normalized;
}

/**
 * Normaliza uma banda espectral
 */
function normalizeBand(bandData, bandName) {
  // Defaults por banda
  const defaults = {
    sub: { target: -6, min: -12, max: 0 },
    bass: { target: -3, min: -8, max: 2 },
    low_mid: { target: 0, min: -5, max: 3 },
    mid: { target: 0, min: -4, max: 3 },
    high_mid: { target: -1, min: -6, max: 3 },
    presence: { target: -2, min: -8, max: 2 },
    brilliance: { target: -4, min: -10, max: 0 }
  };
  
  const def = defaults[bandName] || { target: 0, min: -10, max: 5 };
  
  return {
    target: bandData.target_db ?? bandData.target ?? def.target,
    min: bandData.target_range?.min ?? bandData.min ?? def.min,
    max: bandData.target_range?.max ?? bandData.max ?? def.max,
    unit: 'dB'
  };
}

// ============================================================================
// FUNÇÃO: checkHardGates
// ============================================================================
/**
 * Verifica se algum hard gate foi violado
 * 
 * @param {Object} metrics - Métricas técnicas do áudio
 * @param {Object} normalizedRef - Referência normalizada (de normalizeReference)
 * @returns {Object} Resultado com gates violados e score cap
 */
export function checkHardGates(metrics, normalizedRef) {
  const violations = [];
  let scoreCap = 100;
  const criticalErrors = [];
  
  // Extrair valores das métricas (suporta múltiplos formatos)
  const truePeak = metrics.truePeakDbtp ?? metrics.true_peak_dbtp ?? null;
  const clipping = metrics.clippingPct ?? metrics.clipping_pct ?? 0;
  const lufs = metrics.lufsIntegrated ?? metrics.lufs_integrated ?? null;
  
  const targets = normalizedRef.targets;
  
  // CHECK: True Peak Clipping
  if (truePeak !== null) {
    const gate = HARD_GATES.truePeakClipping;
    const check = gate.getViolation(truePeak, targets);
    if (check.triggered) {
      violations.push({
        gate: gate.id,
        description: gate.description,
        message: check.message,
        excess: check.excess,
        scoreCap: gate.scoreCap,
        criticalError: gate.criticalError
      });
      scoreCap = Math.min(scoreCap, gate.scoreCap);
      if (gate.criticalError) criticalErrors.push(gate.id);
    }
  }
  
  // CHECK: Clipping Severo
  if (clipping > 0) {
    const gate = HARD_GATES.clippingSevere;
    const check = gate.getViolation(clipping, targets);
    if (check.triggered) {
      violations.push({
        gate: gate.id,
        description: gate.description,
        message: check.message,
        excess: check.excess,
        scoreCap: gate.scoreCap,
        criticalError: gate.criticalError
      });
      scoreCap = Math.min(scoreCap, gate.scoreCap);
      if (gate.criticalError) criticalErrors.push(gate.id);
    }
  }
  
  // CHECK: LUFS Excessive
  if (lufs !== null) {
    const gate = HARD_GATES.lufsExcessive;
    const check = gate.getViolation(lufs, targets);
    if (check.triggered) {
      violations.push({
        gate: gate.id,
        description: gate.description,
        message: check.message,
        excess: check.excess,
        scoreCap: gate.scoreCap,
        criticalError: gate.criticalError
      });
      scoreCap = Math.min(scoreCap, gate.scoreCap);
      if (gate.criticalError) criticalErrors.push(gate.id);
    }
  }
  
  return {
    hasViolations: violations.length > 0,
    violations,
    scoreCap,
    criticalErrors,
    hasCriticalError: criticalErrors.length > 0
  };
}

// ============================================================================
// FUNÇÃO: getTargetForMetric
// ============================================================================
/**
 * Obtém o target para uma métrica específica
 * Uso: UI de tabela de referência, cálculo de score individual
 * 
 * @param {string} metricKey - Chave da métrica (ex: 'truePeak', 'lufs', 'bands.sub')
 * @param {Object} normalizedRef - Referência normalizada
 * @returns {Object} { target, min, max, unit } ou null se não encontrado
 */
export function getTargetForMetric(metricKey, normalizedRef) {
  if (!normalizedRef) return null;
  
  // Métrica principal (truePeak, lufs, etc.)
  if (normalizedRef.targets[metricKey]) {
    return normalizedRef.targets[metricKey];
  }
  
  // Banda espectral (bands.sub, bands.bass, etc.)
  if (metricKey.startsWith('bands.')) {
    const bandName = metricKey.replace('bands.', '');
    if (normalizedRef.bands[bandName]) {
      return normalizedRef.bands[bandName];
    }
  }
  
  // Formato alternativo: sub, bass (sem prefix)
  if (normalizedRef.bands[metricKey]) {
    return normalizedRef.bands[metricKey];
  }
  
  return null;
}

// ============================================================================
// FUNÇÃO: getModeDefaults
// ============================================================================
/**
 * Obtém os defaults de um modo específico (sem referência customizada)
 * 
 * @param {string} mode - Modo: 'streaming' | 'pista' | 'reference'
 * @returns {Object} Targets do modo
 */
export function getModeDefaults(mode = 'streaming') {
  return MODE_TARGETS[mode] || MODE_TARGETS.streaming;
}

// ============================================================================
// EXPORTS DEFAULT PARA BROWSER
// ============================================================================
if (typeof window !== 'undefined') {
  window.ReferenceAdapter = {
    normalizeReference,
    checkHardGates,
    getTargetForMetric,
    getModeDefaults,
    MODE_TARGETS,
    HARD_GATES
  };
}

export default {
  normalizeReference,
  checkHardGates,
  getTargetForMetric,
  getModeDefaults,
  MODE_TARGETS,
  HARD_GATES
};
