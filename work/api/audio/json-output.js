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
  const td = {};

  try {
    // 🔊 Loudness
    if (coreMetrics.loudness) {
      td.lufs_integrated = coreMetrics.loudness.integrated;
      td.lufs_short_term = coreMetrics.loudness.shortTerm;
      td.lufs_momentary = coreMetrics.loudness.momentary;
      td.lra = coreMetrics.loudness.lra;
      td.normalizedTo = coreMetrics.loudness.normalized;
      td.originalLUFS = coreMetrics.loudness.original;
    }

    // 🎚️ True Peak
    if (coreMetrics.truePeak) {
      td.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
      td.truePeakLinear = coreMetrics.truePeak.maxLinear;
      td.samplePeakLeftDb = coreMetrics.truePeak.samplePeakLeft;
      td.samplePeakRightDb = coreMetrics.truePeak.samplePeakRight;
      td.clippingSamples = coreMetrics.truePeak.clipping?.samples;
      td.clippingPct = coreMetrics.truePeak.clipping?.percentage;
    }

    // 📊 RMS
    if (coreMetrics.rms) {
      td.rms = coreMetrics.rms.average;
      td.peak_db = coreMetrics.rms.peak;
      td.rmsLevels = {
        left: coreMetrics.rms.left,
        right: coreMetrics.rms.right,
        average: coreMetrics.rms.average,
        peak: coreMetrics.rms.peak,
        count: coreMetrics.rms.frameCount
      };
    }

    // 🎵 Dinâmica
    if (coreMetrics.dynamics) {
      td.dynamicRange = coreMetrics.dynamics.dr;
      td.crestFactor = coreMetrics.dynamics.crest;
      td.dr = coreMetrics.dynamics.dr;
      td.crest_factor = coreMetrics.dynamics.crest;
      td.drCategory = coreMetrics.dynamics.category;
    }

    // 🎧 Stereo
    if (coreMetrics.stereo) {
      td.stereoCorrelation = coreMetrics.stereo.correlation;
      td.stereoWidth = coreMetrics.stereo.width;
      td.balanceLR = coreMetrics.stereo.balance;
      td.widthCategory = coreMetrics.stereo.categories?.width;
      td.correlationCategory = coreMetrics.stereo.categories?.correlation;
      td.hasPhaseIssues = coreMetrics.stereo.hasPhaseIssues;
      td.isMonoCompatible = coreMetrics.stereo.isMonoCompatible;
    }

    // 🎼 Espectrais
    if (coreMetrics.spectral) {
      td.spectralCentroid = coreMetrics.spectral.centroidHz;
      td.spectralCentroidHz = coreMetrics.spectral.centroidHz;
      td.spectralCentroidMean = coreMetrics.spectral.centroidMean;
      td.spectralSpread = coreMetrics.spectral.spreadHz;
      td.spectralSpreadHz = coreMetrics.spectral.spreadHz;
      td.spectralBandwidth = coreMetrics.spectral.bandwidthHz;
      td.spectralBandwidthHz = coreMetrics.spectral.bandwidthHz;
      td.spectralRolloff = coreMetrics.spectral.rolloffHz;
      td.spectralRolloffHz = coreMetrics.spectral.rolloffHz;
      td.spectralFlatness = coreMetrics.spectral.flatness;
      td.spectralFlux = coreMetrics.spectral.flux;
      td.spectralSkewness = coreMetrics.spectral.skewness;
      td.spectralKurtosis = coreMetrics.spectral.kurtosis;
      td.spectralCrest = coreMetrics.spectral.crest;
      td.zeroCrossingRate = coreMetrics.spectral.zeroCrossingRate;
    }

    // 🎯 Frequências dominantes
    if (Array.isArray(coreMetrics.dominantFrequencies)) {
      td.dominantFrequencies = coreMetrics.dominantFrequencies;
      td.fundamentalFreq = coreMetrics.dominantFrequencies[0]?.frequency || null;
    }

    // ⚡ Técnicas adicionais
    if (coreMetrics.technical) {
      td.dcOffset = coreMetrics.technical.dcOffset?.value;
      td.thdPercent = coreMetrics.technical.thdPercent;
      td.phaseProblems = coreMetrics.technical.phaseProblems;
      td.monoCompatibility = coreMetrics.technical.monoCompatibility;
    }

    // 📈 Headroom
    if (coreMetrics.headroom) {
      td.headroomDb = coreMetrics.headroom.peak;
      td.headroomTruePeakDb = coreMetrics.headroom.truePeak;
    }

    // 📦 Metadata original
    if (coreMetrics.originalMetadata) {
      td.sampleRate = coreMetrics.originalMetadata.sampleRate;
      td.channels = coreMetrics.originalMetadata.channels;
      td.duration = coreMetrics.originalMetadata.duration;
      td.bitrate = coreMetrics.originalMetadata.bitrate;
      td.codec = coreMetrics.originalMetadata.codec;
      td.format = coreMetrics.originalMetadata.format;
    }

    td.runId = `phase-5-4-${Date.now()}`;
    return td;
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
      bitrate: technicalData.bitrate || null,
      codec: technicalData.codec || null,
      format: technicalData.format || null,
      processedAt: new Date().toISOString(),
      engineVersion: "5.4.2-complete",
      pipelinePhase: "complete"
    },

    technicalData: technicalData,

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
    buildVersion: "5.4.2-full",
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

  if (finalJSON.technicalData.lufs_integrated < -30) {
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
      engineVersion: "5.4.2-error",
      pipelinePhase: "error"
    },
    technicalData: { lufs_integrated: null, truePeakDbtp: null, stereoCorrelation: null, frequencyBands: {} },
    rawMetrics: coreMetrics || {},
    warnings: [`Erro na Fase 5.4: ${error.message}`],
    buildVersion: "5.4.2-error-fallback",
    frontendCompatible: false
  };
}