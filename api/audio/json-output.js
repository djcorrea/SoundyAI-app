// 🎯 FASE 5.4: JSON OUTPUT + SCORING
// Constrói saída JSON estruturada e calcula score compatível com front-end

import { computeMixScore } from "../../lib/audio/features/scoring.js";

console.log('📦 JSON Output & Scoring (Fase 5.4) carregado - Equal Weight V3');

/**
 * Gera JSON final estruturado com métricas e score
 * @param {Object} coreMetrics - Resultado da Fase 5.3
 * @param {Object} reference - Referência de gênero (opcional)
 * @param {Object} metadata - Metadados do arquivo (opcional)
 * @returns {Object} JSON estruturado compatível com front-end
 */
export function generateJSONOutput(coreMetrics, reference = null, metadata = {}) {
  console.log('🚀 Iniciando geração de JSON final (Fase 5.4)...');
  console.log('📊 Métricas recebidas:', Object.keys(coreMetrics || {}));
  console.log('📋 Referência:', reference ? Object.keys(reference) : 'nenhuma');

  try {
    // ✅ 1. Validação de entrada
    if (!coreMetrics || typeof coreMetrics !== 'object') {
      throw new Error('Core metrics inválidas');
    }

    // ✅ 2. Extrair dados essenciais das métricas core
    const technicalData = extractTechnicalData(coreMetrics);
    console.log('🔧 Technical data extraído:', Object.keys(technicalData));

    // ✅ 3. Calcular score usando Equal Weight V3
    const scoringResult = computeMixScore(technicalData, reference);
    console.log('🎯 Score calculado:', scoringResult.scorePct + '%', 'Método:', scoringResult.method);

    // ✅ 4. Construir JSON final estruturado
    const finalJSON = buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata);
    console.log('📦 JSON final construído:', Object.keys(finalJSON));

    // ✅ 5. Validação final
    validateFinalJSON(finalJSON);

    console.log('✅ JSON Output gerado com sucesso (Fase 5.4)');
    return finalJSON;

  } catch (error) {
    console.error('❌ Erro na Fase 5.4:', error);
    return createErrorJSON(error, coreMetrics, metadata);
  }
}

/**
 * Extrai dados técnicos das métricas core para o scoring
 */
function extractTechnicalData(coreMetrics) {
  const technicalData = {};

  try {
    // 🎵 LUFS Metrics
    if (coreMetrics.lufs) {
      technicalData.lufsIntegrated = coreMetrics.lufs.integrated;
      technicalData.lufs_integrated = coreMetrics.lufs.integrated;
      technicalData.lra = coreMetrics.lufs.lra;
      technicalData.lufsShortTerm = coreMetrics.lufs.shortTerm;
      technicalData.lufsMomentary = coreMetrics.lufs.momentary;
    }

    // 🏔️ True Peak Metrics
    if (coreMetrics.truePeak) {
      technicalData.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
      technicalData.true_peak_dbtp = coreMetrics.truePeak.maxDbtp;
      technicalData.truePeakLinear = coreMetrics.truePeak.maxLinear;
    }

    // 📊 FFT & Spectral Metrics
    if (coreMetrics.fft && coreMetrics.fft.frequencyBands) {
      // Bandas espectrais para scoring (formato esperado)
      technicalData.bandEnergies = {};
      
      const bandsLeft = coreMetrics.fft.frequencyBands.left || {};
      const bandsRight = coreMetrics.fft.frequencyBands.right || {};

      // Mapear as 7 bandas para formato de scoring
      const bandMapping = {
        'subBass': 'sub',
        'bass': 'low_bass', 
        'lowMid': 'low_mid',
        'mid': 'mid',
        'highMid': 'high_mid',
        'presence': 'presenca',
        'brilliance': 'brilho'
      };

      for (const [coreKey, scoringKey] of Object.entries(bandMapping)) {
        if (bandsLeft[coreKey]) {
          technicalData.bandEnergies[scoringKey] = {
            rms_db: bandsLeft[coreKey].energyDb,
            energy: bandsLeft[coreKey].energy
          };
        }
      }

      // Métricas espectrais adicionais
      if (coreMetrics.fft.spectralCentroid) {
        technicalData.spectralCentroid = coreMetrics.fft.spectralCentroid;
        technicalData.centroid = coreMetrics.fft.spectralCentroid;
      }
    }

    // 🎧 Stereo Metrics
    if (coreMetrics.stereo) {
      technicalData.stereoCorrelation = coreMetrics.stereo.correlation;
      technicalData.stereo_correlation = coreMetrics.stereo.correlation;
      technicalData.stereoWidth = coreMetrics.stereo.width;
      technicalData.stereo_width = coreMetrics.stereo.width;
      technicalData.balanceLR = coreMetrics.stereo.balance;
      technicalData.balance_lr = coreMetrics.stereo.balance;
    }

    // 🔧 Technical Metrics
    if (coreMetrics.metadata) {
      technicalData.sampleRate = coreMetrics.metadata.sampleRate;
      technicalData.channels = coreMetrics.metadata.channels;
      technicalData.duration = coreMetrics.metadata.duration;
    }

    // 📈 Dynamic Range (se disponível)
    if (coreMetrics.dr !== undefined) {
      technicalData.dynamicRange = coreMetrics.dr;
      technicalData.dr = coreMetrics.dr;
      technicalData.dr_stat = coreMetrics.dr;
    }

    // 🎯 Adicionar runId para tracking
    technicalData.runId = `phase-5-4-${Date.now()}`;

    console.log('📊 Technical data extraído com sucesso:', {
      lufs: !!technicalData.lufsIntegrated,
      truePeak: !!technicalData.truePeakDbtp, 
      bands: Object.keys(technicalData.bandEnergies || {}).length,
      stereo: !!technicalData.stereoCorrelation,
      total: Object.keys(technicalData).length
    });

    return technicalData;

  } catch (error) {
    console.error('❌ Erro ao extrair technical data:', error);
    return {
      runId: `phase-5-4-error-${Date.now()}`,
      lufsIntegrated: -14, // fallback
      truePeakDbtp: -1,   // fallback
      stereoCorrelation: 0.5 // fallback
    };
  }
}

/**
 * Constrói o JSON final estruturado
 */
function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata) {
  // 📦 Estrutura base compatível com front-end
  const finalJSON = {
    // 🎯 Score e classificação (principal)
    score: sanitizeValue(scoringResult.scorePct),
    classification: scoringResult.classification || 'Básico',
    scoringMethod: scoringResult.method || 'equal_weight_v3',

    // 📊 Metadados
    metadata: {
      fileName: metadata.fileName || 'unknown',
      fileSize: metadata.fileSize || 0,
      sampleRate: coreMetrics.metadata?.sampleRate || 48000,
      channels: coreMetrics.metadata?.channels || 2,
      duration: coreMetrics.metadata?.duration || 0,
      processedAt: new Date().toISOString(),
      engineVersion: '5.4.0',
      pipelinePhase: 'complete'
    },

    // 🎵 Métricas técnicas principais
    technicalData: {
      // Loudness
      lufsIntegrated: sanitizeValue(technicalData.lufsIntegrated),
      lufsShortTerm: sanitizeValue(technicalData.lufsShortTerm),
      lufsMomentary: sanitizeValue(technicalData.lufsMomentary),
      lra: sanitizeValue(technicalData.lra),

      // True Peak
      truePeakDbtp: sanitizeValue(technicalData.truePeakDbtp),
      truePeakLinear: sanitizeValue(technicalData.truePeakLinear),

      // Dynamic Range
      dynamicRange: sanitizeValue(technicalData.dynamicRange || technicalData.dr),
      dr: sanitizeValue(technicalData.dr),

      // Stereo
      stereoCorrelation: sanitizeValue(technicalData.stereoCorrelation),
      stereoWidth: sanitizeValue(technicalData.stereoWidth),
      balanceLR: sanitizeValue(technicalData.balanceLR),

      // Spectral
      spectralCentroid: sanitizeValue(technicalData.spectralCentroid),
      
      // Bandas espectrais (formato simplificado)
      frequencyBands: extractFrequencyBands(coreMetrics.fft?.frequencyBands),
      
      // Technical
      dcOffset: sanitizeValue(technicalData.dcOffset || 0),
      clippingPct: sanitizeValue(technicalData.clippingPct || 0)
    },

    // 🔍 Detalhes do scoring
    scoringDetails: {
      method: scoringResult.method,
      totalMetrics: scoringResult.equalWeightDetails?.totalMetrics || 0,
      equalWeight: scoringResult.equalWeightDetails?.equalWeight || 0,
      metricBreakdown: scoringResult.equalWeightDetails?.metricScores || [],
      classification: scoringResult.classification
    },

    // 📈 Dados brutos completos (para debug/análise avançada)
    rawMetrics: {
      lufs: coreMetrics.lufs,
      truePeak: coreMetrics.truePeak,
      fft: {
        frameCount: coreMetrics.fft?.frameCount || 0,
        spectrogramCount: coreMetrics.fft?.spectrogramCount || 0,
        frequencyBands: coreMetrics.fft?.frequencyBands
      },
      stereo: coreMetrics.stereo
    },

    // 🎯 Status e validação
    status: 'success',
    processingTime: metadata.processingTime || 0,
    warnings: [],
    
    // 🔧 Compatibilidade
    buildVersion: '5.4.0-equal-weight-v3',
    pipelineVersion: 'node-js-backend',
    frontendCompatible: true
  };

  // ✅ Adicionar warnings se necessário
  addWarningsIfNeeded(finalJSON, coreMetrics, scoringResult);

  return finalJSON;
}

/**
 * Extrai bandas de frequência em formato simplificado
 */
function extractFrequencyBands(frequencyBands) {
  if (!frequencyBands || !frequencyBands.left) {
    return {};
  }

  const simplified = {};
  const bandsLeft = frequencyBands.left;

  // Converter para formato esperado pelo front-end
  const bandNames = ['subBass', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'brilliance'];
  
  for (const bandName of bandNames) {
    if (bandsLeft[bandName]) {
      simplified[bandName] = {
        min: bandsLeft[bandName].min,
        max: bandsLeft[bandName].max,
        energyDb: sanitizeValue(bandsLeft[bandName].energyDb),
        energy: sanitizeValue(bandsLeft[bandName].energy)
      };
    }
  }

  return simplified;
}

/**
 * Adiciona warnings se necessário
 */
function addWarningsIfNeeded(finalJSON, coreMetrics, scoringResult) {
  const warnings = [];

  // Verificar se LUFS está muito baixo
  if (finalJSON.technicalData.lufsIntegrated < -30) {
    warnings.push('LUFS muito baixo - possível sinal de baixo volume');
  }

  // Verificar clipping
  if (finalJSON.technicalData.truePeakDbtp > -0.1) {
    warnings.push('True Peak próximo de 0dB - risco de clipping');
  }

  // Verificar correlação estéreo
  if (finalJSON.technicalData.stereoCorrelation < 0.1) {
    warnings.push('Correlação estéreo muito baixa - possível problema de fase');
  }

  // Verificar se score é muito baixo
  if (finalJSON.score < 30) {
    warnings.push('Score baixo - múltiplas métricas fora dos targets');
  }

  // Verificar método de scoring
  if (scoringResult.method !== 'equal_weight_v3') {
    warnings.push(`Fallback para método: ${scoringResult.method}`);
  }

  finalJSON.warnings = warnings;
}

/**
 * Sanitiza valores para evitar NaN/Infinity no JSON
 */
function sanitizeValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return parseFloat(Number(value).toFixed(3));
}

/**
 * Valida o JSON final antes de retornar
 */
function validateFinalJSON(finalJSON) {
  // Verificações críticas
  const required = ['score', 'classification', 'technicalData', 'metadata'];
  
  for (const field of required) {
    if (!(field in finalJSON)) {
      throw new Error(`Campo obrigatório ausente: ${field}`);
    }
  }

  // Verificar se score é válido
  if (!Number.isFinite(finalJSON.score) || finalJSON.score < 0 || finalJSON.score > 100) {
    throw new Error(`Score inválido: ${finalJSON.score}`);
  }

  // Verificar se JSON é serializável
  try {
    JSON.stringify(finalJSON);
  } catch (error) {
    throw new Error(`JSON não serializável: ${error.message}`);
  }

  console.log('✅ JSON final validado com sucesso');
}

/**
 * Cria JSON de erro em caso de falha
 */
function createErrorJSON(error, coreMetrics = null, metadata = {}) {
  console.error('📦 Criando JSON de erro:', error.message);

  return {
    status: 'error',
    error: {
      message: error.message,
      type: 'phase_5_4_error',
      timestamp: new Date().toISOString()
    },
    score: 50, // fallback
    classification: 'Básico',
    scoringMethod: 'error_fallback',
    metadata: {
      fileName: metadata.fileName || 'unknown',
      sampleRate: 48000,
      channels: 2,
      duration: 0,
      processedAt: new Date().toISOString(),
      engineVersion: '5.4.0-error',
      pipelinePhase: 'error'
    },
    technicalData: {
      lufsIntegrated: null,
      truePeakDbtp: null,
      stereoCorrelation: null,
      frequencyBands: {}
    },
    rawMetrics: coreMetrics || {},
    warnings: [`Erro na Fase 5.4: ${error.message}`],
    buildVersion: '5.4.0-error-fallback',
    frontendCompatible: false
  };
}
