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

    // Dynamic Range
    if (coreMetrics.dr !== undefined) {
      technicalData.dynamicRange = coreMetrics.dr;
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
      stereoCorrelation: sanitizeValue(technicalData.stereoCorrelation),
      stereoWidth: sanitizeValue(technicalData.stereoWidth),
      balanceLR: sanitizeValue(technicalData.balanceLR),
      spectralCentroid: sanitizeValue(technicalData.spectralCentroid),
      frequencyBands: coreMetrics.fft?.frequencyBands?.left || {}
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
