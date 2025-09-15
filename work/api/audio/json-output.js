// 🎯 FASE 5.4: JSON OUTPUT + SCORING (VERSÃO CORRIGIDA)
// Constrói saída JSON estruturada, compatível com o front, e calcula score.

import { computeMixScore } from "../../lib/audio/features/scoring.js";

console.log("📦 JSON Output & Scoring (Fase 5.4) carregado - Equal Weight V3 (complete)");

export function generateJSONOutput(coreMetrics, reference = null, metadata = {}) {
  console.log("🚀 Iniciando geração de JSON final (Fase 5.4)...");
  try {
    if (!coreMetrics || typeof coreMetrics !== "object") {
      throw new Error("Core metrics inválidas");
    }

    const extracted = extractAll(coreMetrics, metadata);
    const scoringResult = computeMixScore(extracted.technicalData, reference);

    const finalJSON = buildFinalJSON(coreMetrics, extracted, scoringResult, metadata);
    validateFinalJSON(finalJSON);

    console.log("✅ JSON Output gerado com sucesso (Fase 5.4)");
    return finalJSON;
  } catch (error) {
    console.error("❌ Erro na Fase 5.4:", error);
    return createErrorJSON(error, coreMetrics, metadata);
  }
}

/* ------------------------ EXTRAÇÃO COMPLETA ------------------------ */

function extractAll(core, meta) {
  const td = {}; // technicalData (normalizado para o scorer)

  /* ---------- Loudness ---------- */
  if (core.lufs) {
    td.lufsIntegrated = n(core.lufs.integrated);
    td.lufsShortTerm  = n(core.lufs.shortTerm);
    td.lufsMomentary  = n(core.lufs.momentary);
    td.lra            = n(core.lufs.lra);

    // Extras de normalização (se presentes via auditoria/corrections)
    td.originalLUFS   = n(core.lufs.original ?? core.originalLUFS);
    td.normalizedTo   = n(core.lufs.normalized ?? core.normalizedTo);
    td.gainAppliedDB  = n(core.lufs.gainDb ?? core.gainAppliedDB);
  }

  /* ---------- True Peak ---------- */
  if (core.truePeak) {
    td.truePeakDbtp    = n(core.truePeak.maxDbtp);
    td.truePeakLinear  = n(core.truePeak.maxLinear);
    td.clippingSamples = i(core.truePeak.clipping?.samples);
    td.clippingPct     = n(core.truePeak.clipping?.percentage);

    // sample peaks (não oversampled)
    td.samplePeakLeftDb  = n(core.truePeak.samplePeakLeftDb ?? core.samplePeakLeftDb);
    td.samplePeakRightDb = n(core.truePeak.samplePeakRightDb ?? core.samplePeakRightDb);
  }

  /* ---------- Stereo ---------- */
  if (core.stereo) {
    td.stereoCorrelation = n(core.stereo.correlation);
    td.stereoWidth       = n(core.stereo.width);
    td.balanceLR         = n(core.stereo.balance);
    td.isMonoCompatible  = b(core.stereo.isMonoCompatible);
    td.hasPhaseIssues    = b(core.stereo.hasPhaseIssues);
    td.correlationCategory = s(core.stereo.categories?.correlation ?? core.stereo.correlationCategory);
    td.widthCategory       = s(core.stereo.categories?.width ?? core.stereo.widthCategory);
  }

  /* ---------- Dynamics / RMS ---------- */
  if (core.dynamics) {
    td.dynamicRange   = n(core.dynamics.dr ?? core.dr);
    td.crestFactor    = n(core.dynamics.crestFactor ?? core.crestFactor);
    td.averageRmsDb   = n(core.dynamics.averageRmsDb ?? core.averageRmsDb);
    td.peakRmsDb      = n(core.dynamics.peakRmsDb ?? core.peakRmsDb);
    td.drCategory     = s(core.dynamics.category ?? core.drCategory);
  } else {
    // compat com versões antigas
    td.dynamicRange = n(core.dr);
    td.crestFactor  = n(core.crestFactor);
    td.averageRmsDb = n(core.averageRmsDb);
    td.peakRmsDb    = n(core.peakRmsDb);
    td.drCategory   = s(core.drCategory);
  }

  // RMS levels detalhado
  if (core.rmsLevels || core.rms) {
    const levels = core.rmsLevels ?? core.rms;
    td.rmsLevels = levels ? {
      left:    n(levels.left),
      right:   n(levels.right),
      average: n(levels.average),
      peak:    n(levels.peak),
      count:   i(levels.count ?? levels.frameCount)
    } : null;
  }

  /* ---------- Headroom ---------- */
  // peak (sample) é negativo em dBFS -> headroomDb = -peak
  if (isFiniteNumber(td.rmsLevels?.peak)) {
    td.headroomDb = round(+Math.abs(td.rmsLevels.peak));
  }
  if (isFiniteNumber(td.truePeakDbtp)) {
    td.headroomTruePeakDb = round(+Math.abs(td.truePeakDbtp));
  }

  /* ---------- FFT / Spectral (centroid, rolloff, etc.) ---------- */
  const fft = core.fft ?? {};
  td.spectralCentroidHz = n(fft.spectralCentroid ?? fft.centroidHz ?? core.spectralCentroidHz ?? core.spectralCentroid);
  td.spectralRolloffHz  = n(fft.rolloffHz ?? fft.spectralRolloffHz ?? core.spectralRolloffHz ?? core.spectralRolloff);
  td.spectralBandwidthHz= n(fft.bandwidthHz ?? fft.spectralBandwidthHz ?? core.spectralBandwidthHz ?? core.spectralBandwidth);
  td.spectralSpreadHz   = n(fft.spreadHz ?? fft.spectralSpreadHz ?? core.spectralSpreadHz ?? core.spectralSpread);
  td.spectralFlatness   = n(fft.flatness ?? core.spectralFlatness);
  td.spectralCrest      = n(fft.crest ?? core.spectralCrest);
  td.spectralSkewness   = n(fft.skewness ?? core.spectralSkewness);
  td.spectralKurtosis   = n(fft.kurtosis ?? core.spectralKurtosis);
  td.spectralFlux       = n(fft.flux ?? core.spectralFlux);
  td.zeroCrossingRate   = n(fft.zeroCrossingRate ?? core.zeroCrossingRate);
  td.spectralCentroid   = n(fft.spectralCentroid ?? core.spectralCentroid);
  td.spectralRolloff    = n(fft.spectralRolloff ?? core.spectralRolloff);
  td.spectralBandwidth  = n(fft.spectralBandwidth ?? core.spectralBandwidth);
  td.spectralSpread     = n(fft.spectralSpread ?? core.spectralSpread);

  // Frames processados
  td.spectralCentroidFrames = i(core.spectralCentroidFrames ?? core.processing?.spectralCentroidFrames ?? fft.frames ?? 0);
  td.spectralBandsFrames    = i(core.spectralBandsFrames ?? core.processing?.spectralBandsFrames ?? 0);

  /* ---------- Spectral Bands (agregado 7 bandas, % somando 100) ---------- */
  const bandsAgg = aggregateBands(fft?.frequencyBands, core);
  const spectralBands = bandsAgg?.spectralBands ?? { hasData: false, processedFrames: 0 };
  // também deixamos no TD o mapa bruto por compat
  td.bandEnergies = bandsAgg?.bandEnergies ?? null;

  /* ---------- Spectral Uniformity ---------- */
  const uni = core.spectralUniformity ?? core.uniformity;
  const spectralUniformity = uni ? {
    coefficient: n(uni.coefficient),
    rating: s(uni.rating),
    dominantBand: s(uni.dominantBand)
  } : null;
  // deixar um atalho no TD
  td.spectralUniformity = spectralUniformity?.coefficient ?? null;

  /* ---------- Dominant Frequencies ---------- */
  const dom = normalizeDominant(core.dominantFrequencies);
  const dominantFrequencies = dom.list;
  // e no TD só o top-1 freq, se existir
  td.dominantFrequencyHz = dom.topFreq;

  /* ---------- DC Offset ---------- */
  const dc = core.dcOffset ?? core.technical?.dcOffset;
  const dcOffset = dc ? {
    unit: s(dc.unit ?? "dB"),
    value: n(dc.value),
    detailed: {
      L: n(dc.detailed?.L ?? dc.leftDC),
      R: n(dc.detailed?.R ?? dc.rightDC),
      severity: s(dc.detailed?.severity ?? dc.severity)
    }
  } : { unit: "dB", value: null, detailed: { L: null, R: null, severity: "Low" } };
  td.dcOffset = { value: n(dcOffset.value) };

  /* ---------- THD% (se existir) ---------- */
  td.thdPercent = n(core.thdPercent);

  /* ---------- Metadados reais (ffprobe) ---------- */
  if (core.originalMetadata) {
    td.sampleRate = i(core.originalMetadata.sampleRate);
    td.channels   = i(core.originalMetadata.channels);
    td.duration   = n(core.originalMetadata.duration);
    td.bitrate    = i(core.originalMetadata.bitrate);
    td.codec      = s(core.originalMetadata.codec);
    td.format     = s(core.originalMetadata.format);
  } else {
    td.sampleRate = i(core.sampleRate ?? 48000);
    td.channels   = i(core.numberOfChannels ?? 2);
    td.duration   = n(core.duration ?? 0);
    td.bitrate    = i(meta.fileBitrate);
    td.codec      = s(meta.codec);
    td.format     = s(meta.format);
  }

  // Flags de processamento (melhoram o "processing" no JSON)
  const processingFlags = {
    lufsValid:   isFiniteNumber(td.lufsIntegrated),
    stereoValid: isFiniteNumber(td.stereoCorrelation) && isFiniteNumber(td.stereoWidth),
    dynamicsValid: isFiniteNumber(td.dynamicRange),
    truePeakValid: isFiniteNumber(td.truePeakDbtp),
    spectralCentroidFrames: td.spectralCentroidFrames,
    spectralBandsFrames: td.spectralBandsFrames
  };

  // Headroom adicional via RMS/peak (se vier)
  const peakDb = isFiniteNumber(td.rmsLevels?.peak) ? td.rmsLevels.peak : null;
  if (isFiniteNumber(peakDb) && !isFiniteNumber(td.headroomDb)) {
    td.headroomDb = round(Math.abs(peakDb));
  }

  // run id
  td.runId = `phase-5-4-${Date.now()}`;

  return {
    technicalData: td,
    spectralBands,
    spectralUniformity,
    dominantFrequencies,
    dcOffset,
    processingFlags
  };
}

/* --------------------- BUILD DO JSON COMPATÍVEL --------------------- */

function buildFinalJSON(core, ext, scoringResult, meta) {
  const td = ext.technicalData;

  const loudness = {
    unit: "LUFS",
    integrated: td.lufsIntegrated,
    shortTerm: td.lufsShortTerm,
    momentary: td.lufsMomentary,
    lra: td.lra,
    original: td.originalLUFS,
    normalized: td.normalizedTo,
    gainDb: td.gainAppliedDB
  };

  const truePeak = {
    unit: "dBTP",
    maxDbtp: td.truePeakDbtp,
    maxLinear: td.truePeakLinear,
    clipping: {
      samples: td.clippingSamples ?? 0,
      percentage: td.clippingPct ?? 0
    },
    samplePeakLeft: td.samplePeakLeftDb ?? null,
    samplePeakRight: td.samplePeakRightDb ?? null
  };

  const stereo = {
    correlation: td.stereoCorrelation,
    width: td.stereoWidth,
    balance: td.balanceLR,
    categories: {
      correlation: td.correlationCategory || null,
      width: td.widthCategory || null
    },
    hasPhaseIssues: td.hasPhaseIssues ?? false,
    isMonoCompatible: td.isMonoCompatible ?? false
  };

  const dynamics = {
    dr: td.dynamicRange,
    crest: td.crestFactor,          // compat: alguns chamam crestFactor de "crest"
    crestFactor: td.crestFactor,    // manter campo duplicado p/ compat
    averageRmsDb: td.averageRmsDb,
    peakRmsDb: td.peakRmsDb,
    category: td.drCategory || "unknown"
  };

  const rms = td.rmsLevels ? {
    left: td.rmsLevels.left,
    right: td.rmsLevels.right,
    average: td.rmsLevels.average,
    peak: td.rmsLevels.peak,
    frameCount: td.rmsLevels.count,
    hasData: true
  } : { hasData: false, frameCount: 0 };

  const headroom = {
    peak: td.headroomDb ?? (isFiniteNumber(rms.peak) ? round(Math.abs(rms.peak)) : null),
    truePeak: td.headroomTruePeakDb ?? (isFiniteNumber(td.truePeakDbtp) ? round(Math.abs(td.truePeakDbtp)) : null)
  };

  const spectral = {
    centroidHz: td.spectralCentroidHz ?? td.spectralCentroid,
    rolloffHz: td.spectralRolloffHz ?? td.spectralRolloff,
    bandwidthHz: td.spectralBandwidthHz ?? td.spectralBandwidth,
    spreadHz: td.spectralSpreadHz ?? td.spectralSpread,
    flatness: td.spectralFlatness,
    crest: td.spectralCrest,
    skewness: td.spectralSkewness,
    kurtosis: td.spectralKurtosis,
    flux: td.spectralFlux,
    zeroCrossingRate: td.zeroCrossingRate,
    processedFrames: td.spectralCentroidFrames || 0,
    brightness: { centroidHz: td.spectralCentroidHz ?? td.spectralCentroid }
  };

  const technical = {
    dcOffset: ext.dcOffset,
    thdPercent: td.thdPercent ?? null,
    phaseProblems: stereo.hasPhaseIssues ?? false,
    monoCompatibility: stereo.isMonoCompatible ?? false
  };

  const processing = {
    ...ext.processingFlags,
    rmsValid: rms.hasData,
    normalizationApplied: isFiniteNumber(loudness.gainDb) && isFiniteNumber(loudness.normalized)
  };

  const metadataBlock = {
    codec: td.codec ?? null,
    fileName: meta.fileName || "unknown",
    format: td.format ?? null,
    bitDepth: meta.bitDepth ?? null,
    channels: td.channels ?? 2,
    duration: td.duration ?? 0,
    fileSize: meta.fileSize ?? null,
    fileSizeBytes: meta.fileSizeBytes ?? meta.fileSize ?? null,
    fileSizeMB: meta.fileSizeMB ?? (meta.fileSizeBytes ? +(meta.fileSizeBytes / (1024*1024)).toFixed(2) : null),
    sampleRate: td.sampleRate ?? 48000,
    processedAt: new Date().toISOString(),
    buildVersion: "5.4.2-complete-metrics",
    pipelineVersion: "5.1-5.4-corrected",
    stage: "completed",
    jobId: meta.jobId ?? core?.metadata?.jobId ?? null,
    phaseBreakdown: meta.phaseBreakdown ?? null,
    processingTime: meta.processingTime ?? null
  };

  const final = {
    ok: true,
    status: "success",
    mode: meta.mode ?? "genre",
    file: meta.file ?? meta.fileName ?? undefined,

    score: round(scoringResult.scorePct),
    classification: scoringResult.classification || "Básico",
    scoring: {
      method: scoringResult.method || "equal_weight_v3",
      details: scoringResult.equalWeightDetails ?? {},
      breakdown: scoringResult.equalWeightDetails?.metricScores ?? [],
      bonuses: scoringResult.bonuses ?? {},
      penalties: scoringResult.penalties ?? []
    },

    rms,
    stereo,
    truePeak,
    headroom,
    dynamics,
    loudness,
    spectral,
    spectralBands: ext.spectralBands,
    spectralUniformity: ext.spectralUniformity,
    dominantFrequencies: ext.dominantFrequencies,

    technical,
    processing,

    // bloco compatível com o que você já salvou antes
    technicalData: td,

    metadata: metadataBlock,
    frontendCompatible: true
  };

  addWarningsIfNeeded(final);
  return final;
}

/* ------------------------ HELPERS / AGREGADORES ------------------------ */

function aggregateBands(frequencyBands, core) {
  // Esperado: frequencyBands.left e (opcional) frequencyBands.right
  if (!frequencyBands?.left || typeof frequencyBands.left !== "object") {
    return { spectralBands: { hasData: false, processedFrames: 0 }, bandEnergies: null };
  }
  const left = frequencyBands.left;
  const right = frequencyBands.right ?? null;

  const bandNames = Object.keys(left);
  if (!bandNames.length) {
    return { spectralBands: { hasData: false, processedFrames: 0 }, bandEnergies: null };
  }

  const out = {
    bands: {},
    totalEnergy: 0
  };

  for (const name of bandNames) {
    const L = left[name]?.energy ?? 0;
    const R = right ? (right[name]?.energy ?? 0) : L;
    const energy = (L + R) / (right ? 2 : 1);
    out.totalEnergy += energy;
    out.bands[name] = { energy };
  }

  for (const name of bandNames) {
    const e = out.bands[name].energy;
    const pct = out.totalEnergy > 0 ? (e / out.totalEnergy) * 100 : 0;
    out.bands[name].pct = round(pct);
    out.bands[name].rmsDb = e > 0 ? round(10 * Math.log10(e)) : -120;
  }

  const processedFrames =
    i(core.spectralBandsFrames ?? core.processing?.spectralBandsFrames ?? frequencyBands.framesUsed ?? 0);

  const spectralBands = {
    hasData: true,
    processedFrames,
    framesUsed: frequencyBands.framesUsed ?? processedFrames,
    algorithm: frequencyBands.algorithm ?? "rms_energy",
    valid: true,
    totalEnergy: round(out.totalEnergy),
    totalPercentage: 100,
    bands: out.bands
  };

  // bandEnergies “flat” para technicalData/score se precisar
  const bandEnergies = {};
  for (const name of bandNames) {
    bandEnergies[name] = { energy: round(out.bands[name].energy), rms_db: out.bands[name].rmsDb };
  }

  return { spectralBands, bandEnergies };
}

function normalizeDominant(dominant) {
  if (!dominant) return { list: [], topFreq: null };
  // Aceitar formatos: [freq], [{freqHz, magnitude}], [{freq, mag}], etc.
  const list = [];
  let topFreq = null, topMag = -Infinity;

  const push = (f, m, b) => {
    const freqHz = n(f);
    const magnitude = n(m);
    const band = s(b);
    if (isFiniteNumber(freqHz)) {
      list.push({ freqHz, magnitude, band: band || null });
      if (isFiniteNumber(magnitude) && magnitude > topMag) {
        topMag = magnitude; topFreq = freqHz;
      }
      if (!isFiniteNumber(magnitude) && topFreq == null) topFreq = freqHz;
    }
  };

  if (Array.isArray(dominant)) {
    for (const item of dominant) {
      if (typeof item === "number") push(item, null, null);
      else if (item && typeof item === "object") {
        push(item.freqHz ?? item.freq, item.magnitude ?? item.mag, item.band);
      }
    }
  } else if (typeof dominant === "object") {
    // objeto único
    push(dominant.freqHz ?? dominant.freq, dominant.magnitude ?? dominant.mag, dominant.band);
  }

  return { list, topFreq };
}

/* ------------------------ VALIDADORES/FORMATADORES ------------------------ */

function addWarningsIfNeeded(finalJSON) {
  const w = [];

  if (isFiniteNumber(finalJSON.loudness?.integrated) && finalJSON.loudness.integrated < -30) {
    w.push("LUFS muito baixo - possível sinal de baixo volume");
  }
  if (isFiniteNumber(finalJSON.truePeak?.maxDbtp) && finalJSON.truePeak.maxDbtp > -0.1) {
    w.push("True Peak próximo de 0dB - risco de clipping");
  }
  if (isFiniteNumber(finalJSON.stereo?.correlation) && finalJSON.stereo.correlation < 0.1) {
    w.push("Correlação estéreo muito baixa - possível problema de fase");
  }
  if (isFiniteNumber(finalJSON.score) && finalJSON.score < 30) {
    w.push("Score baixo - múltiplas métricas fora dos targets");
  }

  finalJSON.warnings = w;
}

function validateFinalJSON(finalJSON) {
  const required = ["score", "classification", "metadata", "technicalData"];
  for (const f of required) {
    if (!(f in finalJSON)) throw new Error(`Campo obrigatório ausente: ${f}`);
  }
  if (!isFiniteNumber(finalJSON.score)) {
    throw new Error("Score inválido");
  }
  JSON.stringify(finalJSON); // test serialização
}

/* ------------------------ Utilitários ------------------------ */

function sanitizeValue(value) { return isFiniteNumber(value) ? round(value) : null; }
function n(v) { return sanitizeValue(v); }
function i(v) { return Number.isInteger(v) ? v : (isFiniteNumber(v) ? Math.round(v) : null); }
function b(v) { return typeof v === "boolean" ? v : null; }
function s(v) { return (typeof v === "string" && v.length) ? v : null; }
function isFiniteNumber(v) { return typeof v === "number" && Number.isFinite(v); }
function round(v) { return parseFloat(Number(v).toFixed(3)); }

/* ------------------------ JSON de erro ------------------------ */

function createErrorJSON(error, coreMetrics = null, metadata = {}) {
  return {
    status: "error",
    error: { message: error.message, type: "phase_5_4_error", timestamp: new Date().toISOString() },
    ok: false,
    score: 50,
    classification: "Básico",
    scoring: { method: "error_fallback" },
    metadata: {
      fileName: metadata.fileName || "unknown",
      sampleRate: 48000,
      channels: 2,
      duration: 0,
      processedAt: new Date().toISOString(),
      buildVersion: "5.4.2-complete-metrics",
      pipelineVersion: "5.1-5.4-corrected",
      stage: "error"
    },
    technicalData: { lufsIntegrated: null, truePeakDbtp: null, stereoCorrelation: null },
    warnings: [`Erro na Fase 5.4: ${error.message}`],
    frontendCompatible: false,
    rawMetrics: coreMetrics || {}
  };
}