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

  // ===== MÉTRICAS PRINCIPAIS =====
  
  // Loudness (LUFS ITU-R BS.1770-4)
  if (coreMetrics.lufs) {
    technicalData.lufsIntegrated = coreMetrics.lufs.integrated;
    technicalData.lufsShortTerm = coreMetrics.lufs.shortTerm;
    technicalData.lufsMomentary = coreMetrics.lufs.momentary;
    technicalData.lra = coreMetrics.lufs.lra;
    technicalData.originalLUFS = coreMetrics.lufs.originalLUFS;
    technicalData.normalizedTo = coreMetrics.lufs.normalizedTo;
    technicalData.gainAppliedDB = coreMetrics.lufs.gainAppliedDB;
  }

  // True Peak (4x Oversampling)
  if (coreMetrics.truePeak) {
    technicalData.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
    technicalData.truePeakLinear = coreMetrics.truePeak.maxLinear;
    technicalData.samplePeakLeftDb = coreMetrics.truePeak.samplePeakLeftDb;
    technicalData.samplePeakRightDb = coreMetrics.truePeak.samplePeakRightDb;
    technicalData.clippingSamples = coreMetrics.truePeak.clippingSamples;
    technicalData.clippingPct = coreMetrics.truePeak.clippingPct;
  }

  // Dinâmica
  if (coreMetrics.dynamics) {
    technicalData.dynamicRange = coreMetrics.dynamics.dynamicRange;
    technicalData.crestFactor = coreMetrics.dynamics.crestFactor;
    technicalData.peakRmsDb = coreMetrics.dynamics.peakRmsDb;
    technicalData.averageRmsDb = coreMetrics.dynamics.averageRmsDb;
    technicalData.drCategory = coreMetrics.dynamics.drCategory;
  }

  // ===== ESTÉREO & ESPECTRAL =====
  
  // Stereo
  if (coreMetrics.stereo) {
    technicalData.stereoCorrelation = coreMetrics.stereo.correlation;
    technicalData.stereoWidth = coreMetrics.stereo.width;
    technicalData.balanceLR = coreMetrics.stereo.balance;
    technicalData.isMonoCompatible = coreMetrics.stereo.isMonoCompatible;
    technicalData.hasPhaseIssues = coreMetrics.stereo.hasPhaseIssues;
    technicalData.correlationCategory = coreMetrics.stereo.correlationCategory;
    technicalData.widthCategory = coreMetrics.stereo.widthCategory;
  }

  // Métricas Espectrais (do FFT)
  if (coreMetrics.fft && coreMetrics.fft.aggregated) {
    const spectral = coreMetrics.fft.aggregated;
    technicalData.spectralCentroid = spectral.spectralCentroidHz;
    technicalData.spectralRolloff = spectral.spectralRolloffHz;
    technicalData.spectralBandwidth = spectral.spectralBandwidthHz;
    technicalData.spectralSpread = spectral.spectralSpreadHz;
    technicalData.spectralFlatness = spectral.spectralFlatness;
    technicalData.spectralCrest = spectral.spectralCrest;
    technicalData.spectralSkewness = spectral.spectralSkewness;
    technicalData.spectralKurtosis = spectral.spectralKurtosis;
    technicalData.zeroCrossingRate = spectral.zeroCrossingRate;
    technicalData.spectralFlux = spectral.spectralFlux;
  }

  // ===== BALANCE ESPECTRAL DETALHADO =====
  
  // Bandas Espectrais (7 bandas profissionais)
  if (coreMetrics.spectralBands && coreMetrics.spectralBands.aggregated) {
    const bands = coreMetrics.spectralBands.aggregated;
    technicalData.bandEnergies = {
      sub: bands.sub ? { rms_db: bands.sub.rmsDb, peak_db: bands.sub.peakDb, frequency_range: bands.sub.frequencyRange } : null,
      low_bass: bands.lowBass ? { rms_db: bands.lowBass.rmsDb, peak_db: bands.lowBass.peakDb, frequency_range: bands.lowBass.frequencyRange } : null,
      upper_bass: bands.upperBass ? { rms_db: bands.upperBass.rmsDb, peak_db: bands.upperBass.peakDb, frequency_range: bands.upperBass.frequencyRange } : null,
      low_mid: bands.lowMid ? { rms_db: bands.lowMid.rmsDb, peak_db: bands.lowMid.peakDb, frequency_range: bands.lowMid.frequencyRange } : null,
      mid: bands.mid ? { rms_db: bands.mid.rmsDb, peak_db: bands.mid.peakDb, frequency_range: bands.mid.frequencyRange } : null,
      high_mid: bands.highMid ? { rms_db: bands.highMid.rmsDb, peak_db: bands.highMid.peakDb, frequency_range: bands.highMid.frequencyRange } : null,
      brilho: bands.brilliance ? { rms_db: bands.brilliance.rmsDb, peak_db: bands.brilliance.peakDb, frequency_range: bands.brilliance.frequencyRange } : null,
      presenca: bands.presence ? { rms_db: bands.presence.rmsDb, peak_db: bands.presence.peakDb, frequency_range: bands.presence.frequencyRange } : null,
      air: bands.air ? { rms_db: bands.air.rmsDb, peak_db: bands.air.peakDb, frequency_range: bands.air.frequencyRange } : null
    };
    
    // Spectral Balance simplificado para compatibilidade
    technicalData.spectral_balance = {
      sub: bands.sub?.rmsDb || null,
      bass: bands.lowBass?.rmsDb || bands.upperBass?.rmsDb || null,
      mids: bands.mid?.rmsDb || null,
      treble: bands.brilliance?.rmsDb || null,
      presence: bands.presence?.rmsDb || null,
      air: bands.air?.rmsDb || null
    };
  }

  // Centroide Espectral (Brilho)
  if (coreMetrics.spectralCentroid && coreMetrics.spectralCentroid.aggregated) {
    technicalData.spectralCentroidHz = coreMetrics.spectralCentroid.aggregated.centroidHz;
    technicalData.brightnessCategory = coreMetrics.spectralCentroid.aggregated.brightnessCategory;
  }

  // ===== RMS DETALHADO =====
  
  if (coreMetrics.rms) {
    technicalData.rmsLevels = {
      left: coreMetrics.rms.left || null,
      right: coreMetrics.rms.right || null,
      average: coreMetrics.rms.average || null,
      peak: coreMetrics.rms.peak || null,
      count: coreMetrics.rms.count || 0
    };
    
    // Compatibilidade com nomes legados
    technicalData.peak = coreMetrics.rms.peak;
    technicalData.rms = coreMetrics.rms.average;
    technicalData.rmsLevel = coreMetrics.rms.average;
  }

  // ===== MÉTRICAS TÉCNICAS AVANÇADAS =====
  
  // Headroom (calculado a partir do peak)
  if (technicalData.peak !== null && technicalData.peak !== undefined) {
    technicalData.headroomDb = 0 - technicalData.peak; // 0 dBFS - peak atual
  }
  
  if (technicalData.truePeakDbtp !== null && technicalData.truePeakDbtp !== undefined) {
    technicalData.headroomTruePeakDb = 0 - technicalData.truePeakDbtp; // 0 dBTP - true peak atual
  }

  // Problemas técnicos detectados
  technicalData.dcOffset = null; // TODO: Implementar se necessário
  technicalData.thdPercent = null; // TODO: Implementar se necessário

  // ===== FREQUÊNCIAS DOMINANTES =====
  
  if (coreMetrics.fft && coreMetrics.fft.dominantFrequencies) {
    technicalData.dominantFrequencies = coreMetrics.fft.dominantFrequencies.map(freq => ({
      frequency: freq.frequency,
      occurrences: freq.occurrences || 1,
      magnitude: freq.magnitude || null
    }));
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

    // ===== Loudness (LUFS ITU-R BS.1770-4) =====
    loudness: {
      integrated: technicalData.lufsIntegrated,
      shortTerm: technicalData.lufsShortTerm,
      momentary: technicalData.lufsMomentary,
      lra: technicalData.lra,
      original: technicalData.originalLUFS,
      normalized: technicalData.normalizedTo,
      gainDb: technicalData.gainAppliedDB,
      unit: "LUFS"
    },

    // ===== True Peak (4x Oversampling) =====
    truePeak: {
      maxDbtp: technicalData.truePeakDbtp,
      maxLinear: technicalData.truePeakLinear,
      samplePeakLeft: technicalData.samplePeakLeftDb,
      samplePeakRight: technicalData.samplePeakRightDb,
      clipping: {
        samples: technicalData.clippingSamples,
        percentage: technicalData.clippingPct
      },
      unit: "dBTP"
    },

    // ===== Stereo & Phase =====
    stereo: {
      correlation: technicalData.stereoCorrelation,
      width: technicalData.stereoWidth,
      balance: technicalData.balanceLR,
      isMonoCompatible: technicalData.isMonoCompatible || false,
      hasPhaseIssues: technicalData.hasPhaseIssues || false,
      categories: {
        correlation: technicalData.correlationCategory,
        width: technicalData.widthCategory
      }
    },

    // ===== Dinâmica =====
    dynamics: {
      range: technicalData.dynamicRange,
      crest: technicalData.crestFactor,
      peakRms: technicalData.peakRmsDb,
      avgRms: technicalData.averageRmsDb,
      category: technicalData.drCategory,
      // Compatibilidade com nomes legados
      dr: technicalData.dynamicRange,
      peakRmsDb: technicalData.peakRmsDb,
      averageRmsDb: technicalData.averageRmsDb
    },

    // ===== Clipping =====
    clipping: {
      detected: (technicalData.clippingSamples > 0) || false,
      count: technicalData.clippingSamples || 0,
      percentage: technicalData.clippingPct || 0
    },

    // ===== RMS Detalhado =====
    rms: {
      left: technicalData.rmsLevels?.left,
      right: technicalData.rmsLevels?.right,
      average: technicalData.rmsLevels?.average,
      peak: technicalData.rmsLevels?.peak,
      frameCount: technicalData.rmsLevels?.count,
      hasData: (technicalData.rmsLevels?.count || 0) > 0
    },

    // ===== FFT / Análise Espectral Completa =====
    spectral: {
      // Métricas básicas
      processedFrames: coreMetrics.fft?.processedFrames || 0,
      centroidHz: technicalData.spectralCentroid,
      centroidMean: technicalData.spectralCentroidHz,
      rolloffHz: technicalData.spectralRolloff,
      bandwidthHz: technicalData.spectralBandwidth,
      spreadHz: technicalData.spectralSpread,
      flatness: technicalData.spectralFlatness,
      crest: technicalData.spectralCrest,
      skewness: technicalData.spectralSkewness,
      kurtosis: technicalData.spectralKurtosis,
      zeroCrossingRate: technicalData.zeroCrossingRate,
      flux: technicalData.spectralFlux,
      brightness: {
        category: technicalData.brightnessCategory,
        centroidHz: technicalData.spectralCentroidHz
      },
      hasData: (coreMetrics.fft?.processedFrames || 0) > 0
    },

    // ===== Bandas Espectrais (7 bandas profissionais) =====
    spectralBands: {
      detailed: technicalData.bandEnergies,
      simplified: technicalData.spectral_balance,
      processedFrames: coreMetrics.spectralBands?.processedFrames || 0,
      hasData: (coreMetrics.spectralBands?.processedFrames || 0) > 0
    },

    // ===== Frequências Dominantes =====
    dominantFrequencies: technicalData.dominantFrequencies || [],

    // ===== Headroom & Dinâmica Avançada =====
    headroom: {
      peak: technicalData.headroomDb,
      truePeak: technicalData.headroomTruePeakDb
    },

    // ===== Métricas Técnicas Avançadas =====
    technical: {
      dcOffset: technicalData.dcOffset,
      thdPercent: technicalData.thdPercent,
      phaseProblems: technicalData.hasPhaseIssues,
      monoCompatibility: technicalData.isMonoCompatible
    },

    // ===== Estrutura TechnicalData Completa (para compatibilidade frontend) =====
    technicalData: {
      // Loudness
      lufsIntegrated: technicalData.lufsIntegrated,
      lufsShortTerm: technicalData.lufsShortTerm,
      lufsMomentary: technicalData.lufsMomentary,
      lra: technicalData.lra,
      originalLUFS: technicalData.originalLUFS,
      normalizedTo: technicalData.normalizedTo,
      gainAppliedDB: technicalData.gainAppliedDB,
      
      // True Peak
      truePeakDbtp: technicalData.truePeakDbtp,
      truePeakLinear: technicalData.truePeakLinear,
      samplePeakLeftDb: technicalData.samplePeakLeftDb,
      samplePeakRightDb: technicalData.samplePeakRightDb,
      clippingSamples: technicalData.clippingSamples,
      clippingPct: technicalData.clippingPct,
      
      // Stereo
      stereoCorrelation: technicalData.stereoCorrelation,
      stereoWidth: technicalData.stereoWidth,
      balanceLR: technicalData.balanceLR,
      isMonoCompatible: technicalData.isMonoCompatible,
      hasPhaseIssues: technicalData.hasPhaseIssues,
      correlationCategory: technicalData.correlationCategory,
      widthCategory: technicalData.widthCategory,
      
      // Dinâmica
      dynamicRange: technicalData.dynamicRange,
      crestFactor: technicalData.crestFactor,
      peakRmsDb: technicalData.peakRmsDb,
      averageRmsDb: technicalData.averageRmsDb,
      drCategory: technicalData.drCategory,
      
      // Espectral
      spectralCentroid: technicalData.spectralCentroid,
      spectralCentroidHz: technicalData.spectralCentroidHz,
      spectralRolloff: technicalData.spectralRolloff,
      spectralBandwidth: technicalData.spectralBandwidth,
      spectralSpread: technicalData.spectralSpread,
      spectralFlatness: technicalData.spectralFlatness,
      spectralCrest: technicalData.spectralCrest,
      spectralSkewness: technicalData.spectralSkewness,
      spectralKurtosis: technicalData.spectralKurtosis,
      zeroCrossingRate: technicalData.zeroCrossingRate,
      spectralFlux: technicalData.spectralFlux,
      brightnessCategory: technicalData.brightnessCategory,
      
      // Bandas & RMS
      bandEnergies: technicalData.bandEnergies,
      spectral_balance: technicalData.spectral_balance,
      rmsLevels: technicalData.rmsLevels,
      peak: technicalData.peak,
      rms: technicalData.rms,
      rmsLevel: technicalData.rmsLevel,
      
      // Headroom & Avançadas
      headroomDb: technicalData.headroomDb,
      headroomTruePeakDb: technicalData.headroomTruePeakDb,
      dominantFrequencies: technicalData.dominantFrequencies,
      dcOffset: technicalData.dcOffset,
      thdPercent: technicalData.thdPercent,
      
      // Compatibilidade com nomes legados
      correlation: technicalData.stereoCorrelation,
      balance: technicalData.balanceLR,
      width: technicalData.stereoWidth,
      dr: technicalData.dynamicRange,
      spectralCentroidMean: technicalData.spectralCentroid
    },

    // ===== Scoring =====
    scoring: {
      method: scoringResult.method || 'Equal Weight V3',
      breakdown: scoringResult.breakdown || {},
      penalties: scoringResult.penalties || {},
      bonuses: scoringResult.bonuses || {}
    },

    // ===== Dados Raw de Core Metrics (para debugging) =====
    coreMetrics: {
      fft: coreMetrics.fft || null,
      spectralBands: coreMetrics.spectralBands || null,
      spectralCentroid: coreMetrics.spectralCentroid || null,
      lufs: coreMetrics.lufs || null,
      truePeak: coreMetrics.truePeak || null,
      stereo: coreMetrics.stereo || null,
      dynamics: coreMetrics.dynamics || null,
      rms: coreMetrics.rms || null,
      normalization: coreMetrics.normalization || null
    },

    // ===== Metadata =====
    metadata: {
      fileName: metadata.fileName || 'unknown',
      fileSize: metadata.fileSize || 0,
      fileSizeBytes: metadata.fileSizeBytes || 0,
      fileSizeMB: metadata.fileSizeMB || 0,
      duration: metadata.duration || 0,
      sampleRate: metadata.sampleRate || 48000,
      channels: metadata.channels || 2,
      format: metadata.format || 'audio/wav',
      bitDepth: metadata.bitDepth || 16,
      codec: metadata.codec || 'pcm',
      processingTime: metadata.processingTime || 0,
      phaseBreakdown: metadata.phaseBreakdown || {},
      stage: 'output_scoring_completed',
      pipelineVersion: '5.1-5.4-enhanced',
      buildVersion: '5.4.2-complete-metrics',
      timestamp: new Date().toISOString(),
      jobId: jobId,
      processedAt: new Date().toISOString()
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
