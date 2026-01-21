// 🎯 CORREÇÃO DA ORDEM DO PIPELINE - SCORING APÓS BANDAS ESPECTRAIS
// 
// OBJETIVO: Garantir que o scoring execute SOMENTE após as bandas espectrais 
// estarem concluídas e validadas, com fallback seguro e logs estruturados.

/**
 * 🛡️ FEATURE FLAG PRINCIPAL
 * Controla se a nova ordem está ativa
 */
window.PIPELINE_ORDER_CORRECTION_ENABLED = window.PIPELINE_ORDER_CORRECTION_ENABLED ?? true;

/**
 * ⚙️ CONFIGURAÇÕES DE VALIDAÇÃO
 * Controla rigor da validação de bandas espectrais
 */
window.PIPELINE_VALIDATION_CONFIG = window.PIPELINE_VALIDATION_CONFIG ?? {
  // Threshold padrão: 85% das bandas devem estar válidas
  validBandsThreshold: 0.85,
  
  // Threshold mínimo de segurança (fallback)
  minimumValidBands: 3,
  
  // Threshold adaptativo baseado no número total de bandas
  adaptiveThreshold: true,
  
  // Log detalhado de validação
  verboseValidation: true
};

/**
 * 📊 VALIDAÇÃO DE BANDAS ESPECTRAIS (VERSÃO APRIMORADA)
 * Verifica se as bandas estão prontas e válidas para o scoring
 */
function validateSpectralBands(technicalData, runId = 'unknown') {
  const validationResult = {
    ready: false,
    valid: false,
    reason: '',
    bandCount: 0,
    validBandCount: 0,
    validRatio: 0,
    thresholdUsed: 0,
    adaptiveMode: false,
    runId
  };

  const config = window.PIPELINE_VALIDATION_CONFIG || {
    validBandsThreshold: 0.85,
    minimumValidBands: 3,
    adaptiveThreshold: true,
    verboseValidation: true
  };

  try {
    // Verificar se bandEnergies existe
    if (!technicalData?.bandEnergies) {
      validationResult.reason = 'bandEnergies not found';
      if (config.verboseValidation) {
        log(`[VALIDATION-DETAILED] [${runId}] bandEnergies missing in technicalData`);
      }
      return validationResult;
    }

    const bands = technicalData.bandEnergies;
    validationResult.ready = true;

    // Contar bandas e validar estrutura
    const bandNames = Object.keys(bands);
    validationResult.bandCount = bandNames.length;

    if (bandNames.length === 0) {
      validationResult.reason = 'bandEnergies empty';
      if (config.verboseValidation) {
        log(`[VALIDATION-DETAILED] [${runId}] bandEnergies object is empty`);
      }
      return validationResult;
    }

    if (config.verboseValidation) {
      log(`[VALIDATION-DETAILED] [${runId}] Found ${bandNames.length} bands:`, bandNames);
    }

    // Validar cada banda com critérios mais rigorosos
    let validCount = 0;
    const bandDetails = {};
    
    for (const [bandName, bandData] of Object.entries(bands)) {
      const isValid = bandData && 
          typeof bandData === 'object' && 
          Number.isFinite(bandData.rms_db) && 
          bandData.rms_db !== -Infinity &&
          bandData.rms_db > -80; // Adiciona threshold mínimo de -80dB
      
      if (isValid) {
        validCount++;
      }
      
      bandDetails[bandName] = {
        valid: isValid,
        rms_db: bandData?.rms_db,
        hasData: !!bandData,
        reason: !isValid ? 'invalid_rms' : 'ok'
      };
    }

    validationResult.validBandCount = validCount;
    validationResult.validRatio = validCount / bandNames.length;

    // 🎯 SISTEMA ADAPTATIVO DE THRESHOLD
    let threshold = config.validBandsThreshold;
    
    if (config.adaptiveThreshold) {
      // Adaptar threshold baseado no número de bandas
      if (bandNames.length <= 4) {
        // Sistema com 4 bandas: requer 75% (3/4 bandas)
        threshold = 0.75;
        validationResult.adaptiveMode = true;
      } else if (bandNames.length <= 7) {
        // Sistema com 7 bandas: requer 85% (6/7 bandas)
        threshold = 0.85;
        validationResult.adaptiveMode = true;
      } else {
        // Sistemas com mais bandas: usar threshold configurado
        threshold = config.validBandsThreshold;
      }
    }

    validationResult.thresholdUsed = threshold;

    // Validação principal
    const meetsThreshold = validationResult.validRatio >= threshold;
    const meetsMinimum = validCount >= config.minimumValidBands;

    if (meetsThreshold && meetsMinimum) {
      validationResult.valid = true;
      validationResult.reason = `valid (${validCount}/${bandNames.length} bands, ${(validationResult.validRatio * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(1)}%)`;
    } else {
      const reasons = [];
      if (!meetsThreshold) {
        reasons.push(`ratio ${(validationResult.validRatio * 100).toFixed(1)}% < ${(threshold * 100).toFixed(1)}%`);
      }
      if (!meetsMinimum) {
        reasons.push(`count ${validCount} < minimum ${config.minimumValidBands}`);
      }
      validationResult.reason = `insufficient valid bands: ${reasons.join(', ')} (${validCount}/${bandNames.length})`;
    }

    if (config.verboseValidation) {
      log(`[VALIDATION-DETAILED] [${runId}] Validation result:`, {
        valid: validationResult.valid,
        validRatio: `${(validationResult.validRatio * 100).toFixed(1)}%`,
        threshold: `${(threshold * 100).toFixed(1)}%`,
        counts: `${validCount}/${bandNames.length}`,
        adaptiveMode: validationResult.adaptiveMode,
        bandDetails: Object.keys(bandDetails).length <= 10 ? bandDetails : '(too many to display)'
      });
    }

  } catch (error) {
    validationResult.reason = `validation error: ${error.message}`;
    if (config.verboseValidation) {
      error(`[VALIDATION-DETAILED] [${runId}] Validation error:`, error);
    }
  }

  return validationResult;
}

/**
 * ⚙️ CONFIGURAÇÃO DINÂMICA DE THRESHOLD
 * Permite ajustar o rigor da validação em tempo real
 */
function configureValidationThreshold(options = {}) {
  const config = window.PIPELINE_VALIDATION_CONFIG;
  
  if (options.threshold !== undefined) {
    config.validBandsThreshold = Math.max(0.1, Math.min(1.0, options.threshold));
  }
  
  if (options.minimumBands !== undefined) {
    config.minimumValidBands = Math.max(1, options.minimumBands);
  }
  
  if (options.adaptive !== undefined) {
    config.adaptiveThreshold = !!options.adaptive;
  }
  
  if (options.verbose !== undefined) {
    config.verboseValidation = !!options.verbose;
  }
  
  log('🎯 Pipeline validation config updated:', config);
  return config;
}

/**
 * 📋 RELATÓRIO DE STATUS DE VALIDAÇÃO
 * Gera relatório detalhado do sistema de validação
 */
function getValidationStatus() {
  const config = window.PIPELINE_VALIDATION_CONFIG;
  const correctionEnabled = window.PIPELINE_ORDER_CORRECTION_ENABLED;
  
  return {
    correctionEnabled,
    config: { ...config },
    recommendedSettings: {
      conservative: { threshold: 0.9, minimumBands: 4, adaptive: true },
      balanced: { threshold: 0.85, minimumBands: 3, adaptive: true },
      permissive: { threshold: 0.75, minimumBands: 2, adaptive: true }
    },
    systemInfo: {
      typicalBandCounts: {
        'legacy': 4,
        'standard': 7,
        'extended': '10+'
      }
    }
  };
}

/**
 * 📝 LOG ESTRUTURADO PARA PIPELINE
 * Registra eventos do pipeline com correlação
 */
function logPipelineEvent(stage, runId, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    stage,
    runId,
    ...details
  };

  // Log compatível com sistema existente
  if (typeof window !== 'undefined' && window.__caiarLog) {
    window.__caiarLog(stage.toUpperCase(), `Pipeline: ${stage}`, logEntry);
  }

  log(`[PIPELINE-${stage.toUpperCase()}] [${runId}]`, logEntry);
  
  return logEntry;
}

/**
 * 🎯 FUNÇÃO PRINCIPAL: SCORING COM PRÉ-CONDIÇÕES
 * Executa scoring apenas se bandas espectrais estiverem prontas
 */
async function executeScoringWithPreconditions(technicalData, activeRef, scorerModule, runId = 'unknown') {
  // Log início do processo
  logPipelineEvent('scoring_check_start', runId, {
    hasTechnicalData: !!technicalData,
    hasReference: !!activeRef,
    hasScorer: !!(scorerModule && typeof scorerModule.computeMixScore === 'function')
  });

  // Validar pré-condições
  if (!scorerModule || typeof scorerModule.computeMixScore !== 'function') {
    logPipelineEvent('scoring_skipped', runId, { 
      reason: 'scorer module not available',
      depends_on: 'scoring-module'
    });
    return null;
  }

  // Validar bandas espectrais
  const bandsValidation = validateSpectralBands(technicalData, runId);
  
  logPipelineEvent('spectral_bands_validation', runId, bandsValidation);

  if (!bandsValidation.ready) {
    logPipelineEvent('scoring_skipped', runId, { 
      reason: bandsValidation.reason,
      depends_on: 'spectral-bands',
      validation: bandsValidation
    });
    return null;
  }

  if (!bandsValidation.valid) {
    logPipelineEvent('scoring_skipped', runId, { 
      reason: `bands not valid: ${bandsValidation.reason}`,
      depends_on: 'spectral-bands',
      validation: bandsValidation
    });
    return null;
  }

  // Log que as bandas estão prontas
  logPipelineEvent('spectral_bands_ready', runId, {
    bandCount: bandsValidation.bandCount,
    validBandCount: bandsValidation.validBandCount,
    depends_on: 'spectral-bands'
  });

  // Executar scoring
  try {
    logPipelineEvent('scoring_start', runId, {
      depends_on: 'spectral-bands',
      validation: bandsValidation
    });

    // 🎯 CORREÇÃO: Obter mode do destino do som (pista/streaming)
    const mode = (typeof window !== 'undefined' && window.__SOUNDY_ANALYSIS_MODE__) || 'streaming';
    
    // Passar mode nas options para garantir que os gates V3 usem o limite correto
    const scoreResult = scorerModule.computeMixScore(technicalData, activeRef, { mode });
    
    logPipelineEvent('scoring_done', runId, {
      scorePct: scoreResult?.scorePct,
      classification: scoreResult?.classification,
      method: scoreResult?.method || scoreResult?.scoreMode,
      depends_on: 'spectral-bands'
    });

    return scoreResult;

  } catch (error) {
    logPipelineEvent('scoring_error', runId, {
      error: error.message,
      depends_on: 'spectral-bands'
    });
    return null;
  }
}

/**
 * 🔄 FUNÇÃO DE FALLBACK SEGURO
 * Retorna estado consistente quando scoring é pulado
 */
function createScoringFallback(reason, runId = 'unknown') {
  logPipelineEvent('scoring_fallback_applied', runId, { reason });
  
  return {
    scorePct: null,
    classification: 'unavailable',
    method: 'fallback',
    skipped: true,
    reason,
    runId
  };
}

// Exportar funções para uso global
if (typeof window !== 'undefined') {
  window.PipelineOrderCorrection = {
    validateSpectralBands,
    logPipelineEvent,
    executeScoringWithPreconditions,
    createScoringFallback,
    configureValidationThreshold,
    getValidationStatus,
    isEnabled: () => window.PIPELINE_ORDER_CORRECTION_ENABLED,
    getConfig: () => window.PIPELINE_VALIDATION_CONFIG
  };
}

log('🎯 Pipeline Order Correction loaded - Feature flag:', window.PIPELINE_ORDER_CORRECTION_ENABLED);
