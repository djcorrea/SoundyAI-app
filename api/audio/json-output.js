// 🎯 FASE 5.4: JSON OUTPUT + SCORING
import { computeMixScore } from "../../lib/audio/features/scoring.js";

export function generateJSONOutput(coreMetrics, reference = null, metadata = {}) {
  try {
    if (!coreMetrics || typeof coreMetrics !== "object") {
      throw new Error("Core metrics inválidas");
    }

    const technicalData = extractTechnicalData(coreMetrics);
    const scoringResult = computeMixScore(technicalData, reference);

    const finalJSON = buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata);
    validateFinalJSON(finalJSON);
    return finalJSON;
  } catch (error) {
    console.error("❌ Erro na Fase 5.4:", error);
    return createErrorJSON(error, coreMetrics, metadata);
  }
}

function extractTechnicalData(coreMetrics) {
  const td = {};

  // Loudness
  if (coreMetrics.lufs) {
    td.lufs_integrated = coreMetrics.lufs.integrated;
    td.lufs_short_term = coreMetrics.lufs.shortTerm;
    td.lufs_momentary = coreMetrics.lufs.momentary;
    td.lra = coreMetrics.lufs.lra;
  }

  // True Peak
  if (coreMetrics.truePeak) {
    td.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
  }

  // Peak / RMS
  if (coreMetrics.peak_db !== undefined) td.peak_db = coreMetrics.peak_db;
  if (coreMetrics.rms_level !== undefined) td.rms_level = coreMetrics.rms_level;

  // Dynamics
  if (coreMetrics.dynamic_range !== undefined) td.dynamic_range = coreMetrics.dynamic_range;
  if (coreMetrics.crest_factor !== undefined) td.crest_factor = coreMetrics.crest_factor;

  // Stereo
  if (coreMetrics.stereo) {
    td.stereo_correlation = coreMetrics.stereo.correlation;
    td.stereo_width = coreMetrics.stereo.width;
    td.balance_lr = coreMetrics.stereo.balance;
  }

  // Spectral
  if (coreMetrics.spectral) {
    td.spectral_centroid = coreMetrics.spectral.centroidHz;
    td.spectral_rolloff = coreMetrics.spectral.rolloffHz;
    td.spectral_flux = coreMetrics.spectral.flux;
    td.spectral_flatness = coreMetrics.spectral.flatness;
    td.zero_crossing_rate = coreMetrics.spectral.zeroCrossingRate;
    td.tonalBalance = coreMetrics.spectral.tonalBalance || null;
  }

  // Frequências dominantes
  if (Array.isArray(coreMetrics.dominantFrequencies)) {
    td.dominantFrequencies = coreMetrics.dominantFrequencies;
    td.fundamentalFreq = coreMetrics.dominantFrequencies[0]?.frequency || td.spectral_centroid || null;
  }

  // Bandas → gerar array frequencyBands para o front comparativo
  if (coreMetrics.fft?.frequencyBands?.left) {
    td.spectralBands = coreMetrics.fft.frequencyBands.left;
    td.frequencyBands = Object.entries(coreMetrics.fft.frequencyBands.left).map(([name, band]) => ({
      name,
      level: band.rms_db ?? (band.energy > 0 ? 10 * Math.log10(band.energy) : -120)
    }));
  }

  // Problemas técnicos
  td.clipping_samples = coreMetrics.clippingSamples ?? 0;
  td.clippingPct = coreMetrics.clippingPct ?? 0;
  td.dc_offset = coreMetrics.dcOffset ?? 0;
  td.thd_percent = coreMetrics.thdPercent ?? 0;

  // Extras
  td.samplePeakLeftDb = coreMetrics.samplePeakLeftDb ?? null;
  td.samplePeakRightDb = coreMetrics.samplePeakRightDb ?? null;
  td.headroom_db = coreMetrics.headroomDb ?? null;
  td.mfcc_coefficients = coreMetrics.mfcc ?? null;

  // Metadata
  if (coreMetrics.originalMetadata) {
    td.sampleRate = coreMetrics.originalMetadata.sampleRate;
    td.channels = coreMetrics.originalMetadata.channels;
    td.duration = coreMetrics.originalMetadata.duration;
    td.bitrate = coreMetrics.originalMetadata.bitrate;
    td.codec = coreMetrics.originalMetadata.codec;
  }

  td.runId = `phase-5-4-${Date.now()}`;
  return td;
}

function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata) {
  return {
    score: scoringResult.scorePct,
    classification: scoringResult.classification || "Básico",
    scoringMethod: scoringResult.method || "equal_weight_v3",
    metadata: {
      fileName: metadata.fileName || "unknown",
      fileSize: metadata.fileSize || 0,
      sampleRate: technicalData.sampleRate,
      channels: technicalData.channels,
      duration: technicalData.duration,
      bitrate: technicalData.bitrate,
      codec: technicalData.codec,
      processedAt: new Date().toISOString()
    },
    technicalData,
    rawMetrics: coreMetrics,
    status: "success",
    frontendCompatible: true
  };
}

function validateFinalJSON(finalJSON) {
  if (!Number.isFinite(finalJSON.score)) {
    throw new Error("Score inválido");
  }
  JSON.stringify(finalJSON); // test serialização
}

function createErrorJSON(error, coreMetrics = null, metadata = {}) {
  return {
    status: "error",
    error: { message: error.message, type: "phase_5_4_error", timestamp: new Date().toISOString() },
    score: 50,
    classification: "Básico",
    technicalData: {},
    rawMetrics: coreMetrics || {}
  };
}