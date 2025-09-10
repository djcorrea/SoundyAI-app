// 🎯 FASE 5.4: JSON OUTPUT + SCORING
// Constrói saída JSON estruturada e calcula score compatível com front-end

import { computeMixScore } from "../../lib/audio/features/scoring.js";

console.log("📦 JSON Output & Scoring (Fase 5.4) carregado - Equal Weight V3");

/**
 * Gera JSON final estruturado com métricas e score
 * @param {Object} coreMetrics - Resultado da Fase 5.3
 * @param {Object} reference - Referência de gênero (opcional)
 * @param {Object} metadata - Metadados do arquivo (opcional)
 * @returns {Object} JSON estruturado compatível com front-end
 */
export function generateJSONOutput(coreMetrics, reference = null, metadata = {}) {
  console.log("🚀 Iniciando geração de JSON final (Fase 5.4)...");
  console.log("📊 Métricas recebidas:", Object.keys(coreMetrics || {}));

  try {
    if (!coreMetrics || typeof coreMetrics !== "object") {
      throw new Error("Core metrics inválidas");
    }

    // ✅ Extrair dados essenciais
    const technicalData = extractTechnicalData(coreMetrics);
    const scoringResult = computeMixScore(technicalData, reference);

    // ✅ Construir JSON final
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
    // 🎵 LUFS
    if (coreMetrics.lufs) {
      technicalData.lufsIntegrated = coreMetrics.lufs.integrated;
      technicalData.lra = coreMetrics.lufs.lra;
      technicalData.lufsShortTerm = coreMetrics.lufs.shortTerm;
      technicalData.lufsMomentary = coreMetrics.lufs.momentary;
    }

    // 🏔️ True Peak
    if (coreMetrics.truePeak) {
      technicalData.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
      technicalData.truePeakLinear = coreMetrics.truePeak.maxLinear;
    }

    // 📊 FFT Bands
    if (coreMetrics.fft?.frequencyBands) {
      technicalData.bandEnergies = {};

      const bandsLeft = coreMetrics.fft.frequencyBands.left || {};
      const bandsRight = coreMetrics.fft.frequencyBands.right || {};

      const bandMapping = {
        subBass: "sub",
        bass: "low_bass",
        lowMid: "low_mid",
        mid: "mid",
        highMid: "high_mid",
        presence: "presence",
        brilliance: "brilliance",
      };

      for (const [coreKey, scoringKey] of Object.entries(bandMapping)) {
        if (bandsLeft[coreKey] || bandsRight[coreKey]) {
          const avgEnergyDb =
            ((bandsLeft[coreKey]?.energyDb || 0) +
              (bandsRight[coreKey]?.energyDb || 0)) / 2;
          const avgEnergy =
            ((bandsLeft[coreKey]?.energy || 0) +
              (bandsRight[coreKey]?.energy || 0)) / 2;

          technicalData.bandEnergies[scoringKey] = {
            rms_db: avgEnergyDb,
            energy: avgEnergy,
          };
        }
      }

      if (coreMetrics.fft.spectralCentroid) {
        technicalData.spectralCentroid = coreMetrics.fft.spectralCentroid;
      }
    }

    // 🎧 Stereo
    if (coreMetrics.stereo) {
      technicalData.stereoCorrelation = coreMetrics.stereo.correlation;
      technicalData.stereoWidth = coreMetrics.stereo.width;
      technicalData.balanceLR = coreMetrics.stereo.balance;
    }

    // 🔧 Technical (fallback para _metadata)
    const meta = coreMetrics.metadata || coreMetrics._metadata || {};
    technicalData.sampleRate = meta.sampleRate || 48000;
    technicalData.channels = meta.channels || 2;
    technicalData.duration = meta.duration || 0;

    // 📈 Dynamic Range fallback
    if (coreMetrics.dr !== undefined) {
      technicalData.dynamicRange = coreMetrics.dr;
    } else if (coreMetrics.lufs && coreMetrics.truePeak) {
      technicalData.dynamicRange =
        coreMetrics.truePeak.maxDbtp - coreMetrics.lufs.integrated;
    }

    technicalData.runId = `phase-5-4-${Date.now()}`;
    return technicalData;
  } catch (error) {
    console.error("❌ Erro ao extrair technical data:", error);
    return {
      runId: `phase-5-4-error-${Date.now()}`,
      lufsIntegrated: -14,
      truePeakDbtp: -1,
      stereoCorrelation: 0.5,
    };
  }
}

/**
 * Constrói o JSON final estruturado
 */
function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata) {
  const finalJSON = {
    score: sanitizeValue(scoringResult.scorePct),
    classification: scoringResult.classification || "Básico",
    scoringMethod: scoringResult.method || "equal_weight_v3",

    metadata: {
      fileName: metadata.fileName || "unknown",
      fileSize: metadata.fileSize || 0,
      sampleRate:
        coreMetrics.metadata?.sampleRate ||
        coreMetrics._metadata?.sampleRate ||
        48000,
      channels:
        coreMetrics.metadata?.channels ||
        coreMetrics._metadata?.channels ||
        2,
      duration:
        coreMetrics.metadata?.duration ||
        coreMetrics._metadata?.duration ||
        0,
      processedAt: new Date().toISOString(),
      engineVersion: "5.4.0",
      pipelinePhase: "complete",
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
      frequencyBands: extractFrequencyBands(coreMetrics.fft?.frequencyBands),

      dcOffset: sanitizeValue(technicalData.dcOffset || 0),
      clippingPct: sanitizeValue(technicalData.clippingPct || 0),
    },

    scoringDetails: {
      method: scoringResult.method,
      totalMetrics: scoringResult.equalWeightDetails?.totalMetrics || 0,
      equalWeight: scoringResult.equalWeightDetails?.equalWeight || 0,
      metricBreakdown: scoringResult.equalWeightDetails?.metricScores || [],
      classification: scoringResult.classification,
    },

    rawMetrics: {
      lufs: coreMetrics.lufs,
      truePeak: coreMetrics.truePeak,
      fft: coreMetrics.fft,
      stereo: coreMetrics.stereo,
    },

    status: "success",
    processingTime: metadata.processingTime || 0,
    warnings: [],

    buildVersion: "5.4.0-equal-weight-v3",
    pipelineVersion: "node-js-backend",
    frontendCompatible: true,
  };

  addWarningsIfNeeded(finalJSON, coreMetrics, scoringResult);
  return finalJSON;
}

/**
 * Extrai bandas simplificadas
 */
function extractFrequencyBands(frequencyBands) {
  if (!frequencyBands?.left) return {};
  const simplified = {};
  const bands = ["subBass", "bass", "lowMid", "mid", "highMid", "presence", "brilliance"];

  for (const bandName of bands) {
    if (frequencyBands.left[bandName]) {
      const avgEnergyDb =
        ((frequencyBands.left[bandName].energyDb || 0) +
          (frequencyBands.right?.[bandName]?.energyDb || 0)) / 2;
      const avgEnergy =
        ((frequencyBands.left[bandName].energy || 0) +
          (frequencyBands.right?.[bandName]?.energy || 0)) / 2;

      simplified[bandName] = {
        min: frequencyBands.left[bandName].min,
        max: frequencyBands.left[bandName].max,
        energyDb: sanitizeValue(avgEnergyDb),
        energy: sanitizeValue(avgEnergy),
      };
    }
  }
  return simplified;
}

/**
 * Adiciona warnings
 */
function addWarningsIfNeeded(finalJSON, coreMetrics, scoringResult) {
  const warnings = [];

  if (coreMetrics.lufs?.diagnostics?.isSilent) {
    warnings.push("Áudio silencioso detectado");
  } else {
    if (finalJSON.technicalData.lufsIntegrated < -30) {
      warnings.push("LUFS muito baixo - possível sinal de baixo volume");
    }
    if (finalJSON.technicalData.truePeakDbtp > -0.1) {
      warnings.push("True Peak próximo de 0dB - risco de clipping");
    }
    if (finalJSON.technicalData.stereoCorrelation < 0.1) {
      warnings.push("Correlação estéreo muito baixa - possível problema de fase");
    }
    if (finalJSON.score < 30) {
      warnings.push("Score baixo - múltiplas métricas fora dos targets");
    }
    if (scoringResult.method !== "equal_weight_v3") {
      warnings.push(`Fallback para método: ${scoringResult.method}`);
    }
  }

  finalJSON.warnings = warnings;
}

/**
 * Sanitiza valores
 */
function sanitizeValue(value) {
  if (!Number.isFinite(value)) return null;
  return parseFloat(Number(value).toFixed(3));
}

/**
 * Valida JSON final
 */
function validateFinalJSON(finalJSON) {
  const required = ["score", "classification", "technicalData", "metadata"];
  for (const field of required) {
    if (!(field in finalJSON)) {
      throw new Error(`Campo obrigatório ausente: ${field}`);
    }
  }
  if (!Number.isFinite(finalJSON.score) || finalJSON.score < 0 || finalJSON.score > 100) {
    throw new Error(`Score inválido: ${finalJSON.score}`);
  }
  JSON.stringify(finalJSON);
  console.log("✅ JSON final validado com sucesso");
}

/**
 * Cria JSON de erro
 */
function createErrorJSON(error, coreMetrics = null, metadata = {}) {
  return {
    status: "error",
    error: {
      message: error.message,
      type: "phase_5_4_error",
      timestamp: new Date().toISOString(),
    },
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
      pipelinePhase: "error",
    },
    technicalData: {
      lufsIntegrated: null,
      truePeakDbtp: null,
      stereoCorrelation: null,
      frequencyBands: {},
    },
    rawMetrics: coreMetrics || {},
    warnings: [`Erro na Fase 5.4: ${error.message}`],
    buildVersion: "5.4.0-error-fallback",
    frontendCompatible: false,
  };
}
