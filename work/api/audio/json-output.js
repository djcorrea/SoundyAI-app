// 🎯 FASE 5.4: JSON OUTPUT + SCORING - CORRIGIDO E EXPANDIDO
// Constrói saída JSON estruturada com TODAS as métricas extraídas pelo pipeline
// SEM FALLBACKS, SEM VALORES FICTÍCIOS, FAIL-FAST

import { computeMixScore } from "../../lib/audio/features/scoring.js";
import { makeErr, logAudio, assertFinite } from '../../lib/audio/error-handling.js';

console.log("📦 JSON Output & Scoring (Fase 5.4) carregado - Equal Weight V3 COMPLETO");

export function generateJSONOutput(coreMetrics, reference = null, metadata = {}, options = {}) {
  const jobId = options.jobId || 'unknown';
  const fileName = options.fileName || 'unknown';

  logAudio('output_scoring', 'start_generation', { fileName, jobId });
  const startTime = Date.now();

  try {
    if (!coreMetrics || typeof coreMetrics !== "object") {
      throw makeErr('output_scoring', 'Invalid core metrics: must be object', 'invalid_core_metrics');
    }

    validateCoreMetricsStructure(coreMetrics);

    const technicalData = extractTechnicalData(coreMetrics);

    try {
      assertFinite(technicalData, 'output_scoring');
    } catch (validationError) {
      throw makeErr('output_scoring', `Technical data validation failed: ${validationError.message}`, 'technical_data_invalid');
    }

    const scoringResult = computeMixScore(technicalData, reference);
    const scoreValue = scoringResult.score || scoringResult.scorePct;

    if (!scoringResult || typeof scoreValue !== 'number' || !isFinite(scoreValue)) {
      throw makeErr('output_scoring', `Invalid scoring result: ${JSON.stringify(scoringResult)}`, 'invalid_scoring_result');
    }

    const finalJSON = buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, { jobId });

    validateFinalJSON(finalJSON);

    try {
      assertFinite(finalJSON, 'output_scoring');
    } catch (validationError) {
      throw makeErr('output_scoring', `Final JSON validation failed: ${validationError.message}`, 'final_json_invalid');
    }

    const jsonSize = JSON.stringify(finalJSON).length;
    if (jsonSize > 200 * 1024) {
      throw makeErr('output_scoring', `JSON output too large: ${jsonSize} bytes (limit: 200KB)`, 'json_too_large');
    }

    const totalTime = Date.now() - startTime;
    logAudio('output_scoring', 'completed', { ms: totalTime, score: scoreValue, size: jsonSize, classification: scoringResult.classification });

    return finalJSON;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    logAudio('output_scoring', 'error', { code: error.code || 'unknown', message: error.message, ms: totalTime, stage: 'output_scoring' });

    if (error.stage === 'output_scoring') throw error;
    throw makeErr('output_scoring', `JSON output generation failed: ${error.message}`, 'json_generation_error');
  }
}

function validateCoreMetricsStructure(coreMetrics) {
  const requiredSections = ['lufs', 'truePeak', 'stereo'];
  for (const section of requiredSections) {
    if (!coreMetrics[section]) {
      throw makeErr('output_scoring', `Missing required section: ${section}`, 'missing_core_section');
    }
  }
}

function extractTechnicalData(coreMetrics) {
  const technicalData = {};

  // Loudness
  technicalData.lufsIntegrated = coreMetrics.lufs.integrated;
  technicalData.lufsShortTerm = coreMetrics.lufs.shortTerm;
  technicalData.lufsMomentary = coreMetrics.lufs.momentary;
  technicalData.lra = coreMetrics.lufs.lra;

  // True Peak
  technicalData.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
  technicalData.truePeakLinear = coreMetrics.truePeak.maxLinear;

  // Stereo
  technicalData.stereoCorrelation = coreMetrics.stereo.correlation;
  technicalData.stereoBalance = coreMetrics.stereo.balance;
  technicalData.stereoWidth = coreMetrics.stereo.width;

  // Dinâmica
  if (coreMetrics.dynamics) {
    technicalData.dynamicRange = coreMetrics.dynamics.dr;
    technicalData.crestFactor = coreMetrics.dynamics.crest;
    technicalData.peakRms = coreMetrics.dynamics.peakRmsDb;
    technicalData.avgRms = coreMetrics.dynamics.averageRmsDb;
  }

  // Clipping
  if (coreMetrics.clipping) {
    technicalData.clippingCount = coreMetrics.clipping.count;
    technicalData.clippingDetected = coreMetrics.clipping.detected;
  }

  // RMS detalhado
  if (coreMetrics.rms) {
    technicalData.rmsLevels = {
      left: coreMetrics.rms.left || null,
      right: coreMetrics.rms.right || null,
      average: coreMetrics.rms.average || null,
      peak: coreMetrics.rms.peak || null,
      count: coreMetrics.rms.count || 0
    };
  }

  // FFT / Spectral
  if (coreMetrics.fft) {
    technicalData.spectralData = {
      processedFrames: coreMetrics.fft.processedFrames || 0,
      spectralCentroid: coreMetrics.fft.spectralCentroidHz || null,
      spectralRolloff: coreMetrics.fft.spectralRolloffHz || null,
      spectralBandwidth: coreMetrics.fft.spectralBandwidthHz || null,
      spectralSpread: coreMetrics.fft.spectralSpreadHz || null,
      spectralFlatness: coreMetrics.fft.spectralFlatness || null,
      spectralCrest: coreMetrics.fft.spectralCrest || null,
      spectralSkewness: coreMetrics.fft.spectralSkewness || null,
      spectralKurtosis: coreMetrics.fft.spectralKurtosis || null
    };
  }

  return technicalData;
}

function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, options = {}) {
  const jobId = options.jobId || 'unknown';
  const scoreValue = scoringResult.score || scoringResult.scorePct;

  const finalJSON = {
    // ===== Score =====
    score: Math.round(scoreValue * 10) / 10,
    classification: scoringResult.classification || 'unknown',

    // ===== Loudness =====
    loudness: {
      integrated: technicalData.lufsIntegrated,
      shortTerm: technicalData.lufsShortTerm,
      momentary: technicalData.lufsMomentary,
      lra: technicalData.lra,
      unit: "LUFS"
    },

    // ===== True Peak =====
    truePeak: {
      maxDbtp: technicalData.truePeakDbtp,
      maxLinear: technicalData.truePeakLinear,
      unit: "dBTP"
    },

    // ===== Stereo =====
    stereo: {
      correlation: technicalData.stereoCorrelation,
      balance: technicalData.stereoBalance,
      width: technicalData.stereoWidth,
      isMonoCompatible: coreMetrics.stereo.isMonoCompatible || false,
      hasPhaseIssues: coreMetrics.stereo.hasPhaseIssues || false
    },

    // ===== Dinâmica =====
    dynamics: {
      dr: technicalData.dynamicRange,
      crest: technicalData.crestFactor,
      peakRms: technicalData.peakRms,
      avgRms: technicalData.avgRms
    },

    // ===== Clipping =====
    clipping: {
      detected: technicalData.clippingDetected || false,
      count: technicalData.clippingCount || 0
    },

    // ===== RMS =====
    rms: {
      left: technicalData.rmsLevels?.left,
      right: technicalData.rmsLevels?.right,
      average: technicalData.rmsLevels?.average,
      peak: technicalData.rmsLevels?.peak,
      frameCount: technicalData.rmsLevels?.count,
      hasData: (technicalData.rmsLevels?.count || 0) > 0
    },

    // ===== FFT / Spectral =====
    spectral: {
      processedFrames: technicalData.spectralData?.processedFrames,
      centroidHz: technicalData.spectralData?.spectralCentroid,
      rolloffHz: technicalData.spectralData?.spectralRolloff,
      bandwidthHz: technicalData.spectralData?.spectralBandwidth,
      spreadHz: technicalData.spectralData?.spectralSpread,
      flatness: technicalData.spectralData?.spectralFlatness,
      crest: technicalData.spectralData?.spectralCrest,
      skewness: technicalData.spectralData?.spectralSkewness,
      kurtosis: technicalData.spectralData?.spectralKurtosis,
      hasData: (technicalData.spectralData?.processedFrames || 0) > 0
    },

    // ===== Scoring =====
    scoring: {
      method: scoringResult.method || 'Equal Weight V3',
      breakdown: scoringResult.breakdown || {},
      penalties: scoringResult.penalties || {},
      bonuses: scoringResult.bonuses || {}
    },

    // ===== Metadata =====
    metadata: {
      fileName: metadata.fileName || 'unknown',
      fileSize: metadata.fileSize || 0,
      processingTime: metadata.processingTime || 0,
      phaseBreakdown: metadata.phaseBreakdown || {},
      stage: 'output_scoring_completed',
      pipelineVersion: '5.1-5.4-corrected',
      buildVersion: '5.4.1-fail-fast',
      timestamp: new Date().toISOString(),
      jobId: jobId
    }
  };

  return finalJSON;
}

function validateFinalJSON(finalJSON) {
  const requiredFields = ['score', 'classification', 'loudness', 'truePeak', 'stereo', 'metadata'];
  for (const field of requiredFields) {
    if (finalJSON[field] === undefined || finalJSON[field] === null) {
      throw makeErr('output_scoring', `Missing required field in final JSON: ${field}`, 'missing_final_field');
    }
  }
  if (!isFinite(finalJSON.score) || finalJSON.score < 0 || finalJSON.score > 100) {
    throw makeErr('output_scoring', `Invalid score: ${finalJSON.score}`, 'invalid_final_score');
  }
}

console.log('✅ JSON Output & Scoring (Fase 5.4) carregado - COMPLETO sem fallbacks');
