// 🎯 FASE 5.4: JSON OUTPUT + SCORING
// Constrói saída JSON estruturada e calcula score compatível com front-end

import { computeMixScore } from "../../lib/audio/features/scoring.js";

console.log("📦 JSON Output & Scoring (Fase 5.4) carregado - Equal Weight V3");

/**
 * Gera JSON final estruturado com métricas e score
 */
export function generateJSONOutput(coreMetrics, reference = null, metadata = {}) {
  console.log("🚀 Iniciando geração de JSON final (Fase 5.4)...");
  try {
    if (!coreMetrics || typeof coreMetrics !== "object") {
      throw new Error("Core metrics inválidas");
    }

    const technicalData = extractTechnicalData(coreMetrics);
    const scoringResult = computeMixScore(technicalData, reference);

    const finalJSON = buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata);
    validateFinalJSON(finalJSON);

    console.log("✅ JSON Output gerado com sucesso (Fase 5.4)");
    return finalJSON;
  } catch (error) {
    console.error("❌ Erro na Fase 5.4:", error);
    return createErrorJSON(error, coreMetrics, metadata);
  }
}

/**
 * Extrai dados técnicos das métricas core para o scoring
 */
function extractTechnicalData(coreMetrics) {
  const technicalData = {};

  try {
    // Loudness
    if (coreMetrics.lufs) {
      technicalData.lufsIntegrated = coreMetrics.lufs.integrated;
      technicalData.lufsShortTerm = coreMetrics.lufs.shortTerm;
      technicalData.lufsMomentary = coreMetrics.lufs.momentary;
      technicalData.lra = coreMetrics.lufs.lra;
    }

    // True Peak
    if (coreMetrics.truePeak) {
      technicalData.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
      technicalData.truePeakLinear = coreMetrics.truePeak.maxLinear;
    }

    // Bandas espectrais (7 bandas vindas do core-metrics.js)
    if (coreMetrics.fft?.frequencyBands?.left) {
      technicalData.bandEnergies = {};
      for (const [bandName, band] of Object.entries(coreMetrics.fft.frequencyBands.left)) {
        technicalData.bandEnergies[bandName] = {
          energy: sanitizeValue(band.energy),
          rms_db: band.energy > 0 ? 10 * Math.log10(band.energy) : -120
        };
      }
      if (coreMetrics.fft.spectralCentroid) {
        technicalData.spectralCentroid = coreMetrics.fft.spectralCentroid;
      }
    } else {
      // ❌ ERRO: FFT frequencyBands não disponível - sem fallback
      console.error('❌ [JSON_OUTPUT] ERRO CRÍTICO: coreMetrics.fft.frequencyBands.left não disponível!');
      console.error('❌ [JSON_OUTPUT] Estrutura do coreMetrics.fft:', coreMetrics.fft);
      console.error('❌ [JSON_OUTPUT] SEM FALLBACK - bandEnergies não serão calculadas');
      
      // Não adicionar bandEnergies - deixar ausentes para forçar correção
    }

    // 🎯 FIXADO: Métricas Espectrais do FFT agregado
    console.log('🔍 [JSON_OUTPUT] Verificando FFT disponível:', {
      hasFFT: !!(coreMetrics.fft),
      hasAggregated: !!(coreMetrics.fft?.aggregated),
      fftKeys: coreMetrics.fft ? Object.keys(coreMetrics.fft) : [],
      aggregatedKeys: coreMetrics.fft?.aggregated ? Object.keys(coreMetrics.fft.aggregated) : []
    });
    
    if (coreMetrics.fft && coreMetrics.fft.aggregated) {
      const spectral = coreMetrics.fft.aggregated;
      
      console.log('🔬 [JSON_OUTPUT] Extraindo métricas espectrais do FFT agregado:', {
        available: Object.keys(spectral),
        spectralCentroidHz: spectral.spectralCentroidHz,
        spectralRolloffHz: spectral.spectralRolloffHz
      });
      
      // Usar nomes com Hz para compatibilidade com frontend
      technicalData.spectralCentroidHz = sanitizeValue(spectral.spectralCentroidHz);
      technicalData.spectralRolloffHz = sanitizeValue(spectral.spectralRolloffHz);
      technicalData.spectralBandwidthHz = sanitizeValue(spectral.spectralBandwidthHz);
      technicalData.spectralSpreadHz = sanitizeValue(spectral.spectralSpreadHz);
      technicalData.spectralFlatness = sanitizeValue(spectral.spectralFlatness);
      technicalData.spectralCrest = sanitizeValue(spectral.spectralCrest);
      technicalData.spectralSkewness = sanitizeValue(spectral.spectralSkewness);
      technicalData.spectralKurtosis = sanitizeValue(spectral.spectralKurtosis);
      technicalData.zeroCrossingRate = sanitizeValue(spectral.zeroCrossingRate);
      technicalData.spectralFlux = sanitizeValue(spectral.spectralFlux);
      
      // Criar aliases para compatibilidade com scoring
      technicalData.spectralCentroid = technicalData.spectralCentroidHz;
      technicalData.spectralRolloff = technicalData.spectralRolloffHz;
      
      // Aliases adicionais para modal (conforme auditoria)
      technicalData.frequenciaCentral = technicalData.spectralCentroidHz;
      technicalData.limiteAgudos85 = technicalData.spectralRolloffHz;
      technicalData.mudancaEspectral = technicalData.spectralFlux;
      technicalData.uniformidade = technicalData.spectralFlatness;
    } else {
      // ❌ ERRO: FFT processing falhou - não usar fallback, deixar visível
      console.error('❌ [JSON_OUTPUT] ERRO CRÍTICO: coreMetrics.fft.aggregated não disponível!');
      console.error('❌ [JSON_OUTPUT] Estrutura do coreMetrics.fft:', coreMetrics.fft);
      console.error('❌ [JSON_OUTPUT] SEM FALLBACK - métricas espectrais não serão calculadas');
      
      // Não adicionar métricas espectrais - deixar ausentes para forçar correção
    }

    // 🎯 FIXADO: Bandas Espectrais agregadas
    if (coreMetrics.spectralBands && coreMetrics.spectralBands.aggregated) {
      const bands = coreMetrics.spectralBands.aggregated;
      
      console.log('🔬 [JSON_OUTPUT] Extraindo bandas espectrais agregadas:', {
        available: Object.keys(bands),
        processedFrames: bands.processedFrames
      });
      
      technicalData.spectral_balance = {
        sub: sanitizeValue(bands.sub),
        bass: sanitizeValue(bands.bass),
        lowMid: sanitizeValue(bands.lowMid),
        mid: sanitizeValue(bands.mid),
        highMid: sanitizeValue(bands.highMid),
        presence: sanitizeValue(bands.presence),
        air: sanitizeValue(bands.air),
        totalPercentage: 100
      };
    }

    // Stereo
    if (coreMetrics.stereo) {
      technicalData.stereoCorrelation = coreMetrics.stereo.correlation;
      technicalData.stereoWidth = coreMetrics.stereo.width;
      technicalData.balanceLR = coreMetrics.stereo.balance;
    }

    // Metadata
    if (coreMetrics.metadata) {
      technicalData.sampleRate = coreMetrics.metadata.sampleRate;
      technicalData.channels = coreMetrics.metadata.channels;
      technicalData.duration = coreMetrics.metadata.duration;
    } else {
      technicalData.sampleRate = coreMetrics.sampleRate || 48000;
      technicalData.channels = coreMetrics.numberOfChannels || 2;
      technicalData.duration = coreMetrics.duration || 0;
    }

    // 🎚️ Dynamic Range Metrics (TT-DR + Crest Factor)
    if (coreMetrics.dynamics) {
      // TT-DR Principal
      technicalData.dynamicRange = sanitizeValue(coreMetrics.dynamics.dynamic_range);
      technicalData.ttDR = sanitizeValue(coreMetrics.dynamics.tt_dr);
      technicalData.p95Rms = sanitizeValue(coreMetrics.dynamics.p95_rms);
      technicalData.p10Rms = sanitizeValue(coreMetrics.dynamics.p10_rms);
      
      // Crest Factor Auxiliar
      technicalData.crestFactor = sanitizeValue(coreMetrics.dynamics.crest_factor_db);
      technicalData.peakDb = sanitizeValue(coreMetrics.dynamics.peak_db);
      technicalData.rmsDb = sanitizeValue(coreMetrics.dynamics.rms_db);
      
      // Compatibilidade legacy
      technicalData.crestLegacy = sanitizeValue(coreMetrics.dynamics.crest_legacy);
      
      console.log('🎚️ [JSON_OUTPUT] Dynamics extraído:', {
        ttDR: technicalData.ttDR,
        dynamicRange: technicalData.dynamicRange,
        crestFactor: technicalData.crestFactor
      });
    } else if (coreMetrics.dr !== undefined) {
      // Fallback para compatibilidade com versões antigas
      technicalData.dynamicRange = sanitizeValue(coreMetrics.dr);
      console.log('⚠️ [JSON_OUTPUT] Using legacy DR field:', technicalData.dynamicRange);
    }

    technicalData.runId = `phase-5-4-${Date.now()}`;
    return technicalData;
  } catch (err) {
    console.error("❌ Erro ao extrair technical data:", err);
    return { runId: `phase-5-4-error-${Date.now()}` };
  }
}

/**
 * Constrói JSON final
 */
function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata) {
  const finalJSON = {
    score: sanitizeValue(scoringResult.scorePct),
    classification: scoringResult.classification || "Básico",
    scoringMethod: scoringResult.method || "equal_weight_v3",

    metadata: {
      fileName: metadata.fileName || "unknown",
      fileSize: metadata.fileSize || 0,
      sampleRate: technicalData.sampleRate,
      channels: technicalData.channels,
      duration: technicalData.duration,
      processedAt: new Date().toISOString(),
      engineVersion: "5.4.0",
      pipelinePhase: "complete"
    },

    technicalData: {
      lufsIntegrated: sanitizeValue(technicalData.lufsIntegrated),
      lufsShortTerm: sanitizeValue(technicalData.lufsShortTerm),
      lufsMomentary: sanitizeValue(technicalData.lufsMomentary),
      lra: sanitizeValue(technicalData.lra),
      truePeakDbtp: sanitizeValue(technicalData.truePeakDbtp),
      truePeakLinear: sanitizeValue(technicalData.truePeakLinear),
      dynamicRange: sanitizeValue(technicalData.dynamicRange),
      // 🎚️ Dynamic Range Metrics Completos
      ttDR: sanitizeValue(technicalData.ttDR),
      crestFactor: sanitizeValue(technicalData.crestFactor),
      p95Rms: sanitizeValue(technicalData.p95Rms),
      p10Rms: sanitizeValue(technicalData.p10Rms),
      peakDb: sanitizeValue(technicalData.peakDb),
      rmsDb: sanitizeValue(technicalData.rmsDb),
      stereoCorrelation: sanitizeValue(technicalData.stereoCorrelation),
      stereoWidth: sanitizeValue(technicalData.stereoWidth),
      balanceLR: sanitizeValue(technicalData.balanceLR),
      spectralCentroid: sanitizeValue(technicalData.spectralCentroid),
      // 🎯 FIXADO: Métricas espectrais completas
      spectralCentroidHz: sanitizeValue(technicalData.spectralCentroidHz),
      spectralRolloffHz: sanitizeValue(technicalData.spectralRolloffHz),
      spectralBandwidthHz: sanitizeValue(technicalData.spectralBandwidthHz),
      spectralSpreadHz: sanitizeValue(technicalData.spectralSpreadHz),
      spectralFlatness: sanitizeValue(technicalData.spectralFlatness),
      spectralCrest: sanitizeValue(technicalData.spectralCrest),
      spectralSkewness: sanitizeValue(technicalData.spectralSkewness),
      spectralKurtosis: sanitizeValue(technicalData.spectralKurtosis),
      zeroCrossingRate: sanitizeValue(technicalData.zeroCrossingRate),
      spectralFlux: sanitizeValue(technicalData.spectralFlux),
      spectral_balance: technicalData.spectral_balance || {},
      frequencyBands: coreMetrics.fft?.frequencyBands?.left || {},
      bandEnergies: technicalData.bandEnergies || {},
      // 🎵 Métricas espectrais adicionais para o modal
      frequenciaCentral: sanitizeValue(technicalData.spectralCentroidHz), // Alias para compatibilidade
      limiteAgudos85: sanitizeValue(technicalData.spectralRolloffHz), // Rolloff 85%
      mudancaEspectral: sanitizeValue(technicalData.spectralFlux), // Mudança espectral
      uniformidade: sanitizeValue(technicalData.spectralFlatness) // Uniformidade linear vs peaks
    },

    // ===== Métricas Espectrais (nível raiz para compatibilidade frontend) =====
    spectralCentroidHz: sanitizeValue(technicalData.spectralCentroidHz),
    spectralRolloffHz: sanitizeValue(technicalData.spectralRolloffHz),
    spectralBandwidthHz: sanitizeValue(technicalData.spectralBandwidthHz),
    spectralSpreadHz: sanitizeValue(technicalData.spectralSpreadHz),
    spectralFlatness: sanitizeValue(technicalData.spectralFlatness),
    spectralCrest: sanitizeValue(technicalData.spectralCrest),
    spectralSkewness: sanitizeValue(technicalData.spectralSkewness),
    spectralKurtosis: sanitizeValue(technicalData.spectralKurtosis),
    zeroCrossingRate: sanitizeValue(technicalData.zeroCrossingRate),
    spectralFlux: sanitizeValue(technicalData.spectralFlux),

    // ===== Bandas Espectrais =====
    spectralBands: {
      detailed: technicalData.bandEnergies || {},
      simplified: technicalData.spectral_balance || {},
      processedFrames: coreMetrics.spectralBands?.aggregated?.processedFrames || 0,
      hasData: (coreMetrics.spectralBands?.aggregated?.processedFrames || 0) > 0
    },

    // ===== Dynamic Range Metrics =====
    dynamics: {
      // TT-DR Principal (True Technical Dynamic Range)
      ttDR: sanitizeValue(technicalData.ttDR),
      p95Rms: sanitizeValue(technicalData.p95Rms),
      p10Rms: sanitizeValue(technicalData.p10Rms),
      
      // Crest Factor Auxiliar
      crestFactor: sanitizeValue(technicalData.crestFactor),
      peakDb: sanitizeValue(technicalData.peakDb),
      rmsDb: sanitizeValue(technicalData.rmsDb),
      
      // Compatibilidade/Legacy
      dynamicRange: sanitizeValue(technicalData.dynamicRange),
      crestLegacy: sanitizeValue(technicalData.crestLegacy),
      
      // Metadados
      algorithm: 'TT-DR + Crest Factor',
      hasData: !!(technicalData.ttDR || technicalData.dynamicRange || technicalData.crestFactor)
    },

    scoringDetails: {
      method: scoringResult.method,
      totalMetrics: scoringResult.equalWeightDetails?.totalMetrics || 0,
      equalWeight: scoringResult.equalWeightDetails?.equalWeight || 0,
      metricBreakdown: scoringResult.equalWeightDetails?.metricScores || []
    },

    rawMetrics: coreMetrics,
    status: "success",
    processingTime: metadata.processingTime || 0,
    warnings: [],
    buildVersion: "5.4.0-equal-weight-v3",
    pipelineVersion: "node-js-backend",
    frontendCompatible: true
  };

  addWarningsIfNeeded(finalJSON);
  return finalJSON;
}

/**
 * Adiciona warnings automáticos
 */
function addWarningsIfNeeded(finalJSON) {
  const w = [];

  if (finalJSON.technicalData.lufsIntegrated < -30) {
    w.push("LUFS muito baixo - possível sinal de baixo volume");
  }
  if (finalJSON.technicalData.truePeakDbtp > -0.1) {
    w.push("True Peak próximo de 0dB - risco de clipping");
  }
  if (finalJSON.technicalData.stereoCorrelation < 0.1) {
    w.push("Correlação estéreo muito baixa - possível problema de fase");
  }
  if (finalJSON.score < 30) {
    w.push("Score baixo - múltiplas métricas fora dos targets");
  }

  finalJSON.warnings = w;
}

/**
 * Sanitização
 */
function sanitizeValue(value) {
  if (!Number.isFinite(value)) return null;
  return parseFloat(Number(value).toFixed(3));
}

/**
 * Validação final
 */
function validateFinalJSON(finalJSON) {
  const required = ["score", "classification", "technicalData", "metadata"];
  for (const f of required) {
    if (!(f in finalJSON)) throw new Error(`Campo obrigatório ausente: ${f}`);
  }
  if (!Number.isFinite(finalJSON.score)) {
    throw new Error("Score inválido");
  }
  JSON.stringify(finalJSON); // test serialização
}

/**
 * JSON de erro
 */
function createErrorJSON(error, coreMetrics = null, metadata = {}) {
  return {
    status: "error",
    error: { message: error.message, type: "phase_5_4_error", timestamp: new Date().toISOString() },
    score: 50,
    classification: "Básico",
    scoringMethod: "error_fallback",
    metadata: {
      fileName: metadata.fileName || "unknown",
      sampleRate: 48000,
      channels: 2,
      duration: 0,
      processedAt: new Date().toISOString(),
      engineVersion: "5.4.0-error",
      pipelinePhase: "error"
    },
    technicalData: { lufsIntegrated: null, truePeakDbtp: null, stereoCorrelation: null, frequencyBands: {} },
    rawMetrics: coreMetrics || {},
    warnings: [`Erro na Fase 5.4: ${error.message}`],
    buildVersion: "5.4.0-error-fallback",
    frontendCompatible: false
  };
}
