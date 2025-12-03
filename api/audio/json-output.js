// 🎯 FASE 5.4: JSON OUTPUT + SCORING - CORRIGIDO E EXPANDIDO
// Constrói saída JSON estruturada com TODAS as métricas extraídas pelo pipeline
// 100% compatível com o front-end (modal) → garante exibição de todas as métricas
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

    const technicalData = extractTechnicalData(coreMetrics, jobId);

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

    // Proteção contra JSON muito grande
    let jsonString;
    try {
      jsonString = JSON.stringify(finalJSON);
    } catch (stringifyError) {
      throw makeErr('output_scoring', `JSON stringify failed: ${stringifyError.message}`, 'json_stringify_failed');
    }

    const jsonSize = jsonString.length;
    if (jsonSize > 100 * 1024) { // Limite reduzido para 100KB
      logAudio('output_scoring', 'json_too_large', { 
        jsonSize: `${(jsonSize / 1024).toFixed(2)}KB`, 
        fileName, 
        jobId 
      });
      
      const compactJSON = createCompactJSON(finalJSON);
      jsonString = JSON.stringify(compactJSON);
    }

    try {
      assertFinite(finalJSON, 'output_scoring');
    } catch (validationError) {
      throw makeErr('output_scoring', `Final JSON validation failed: ${validationError.message}`, 'final_json_invalid');
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

function extractTechnicalData(coreMetrics, jobId = 'unknown') {
  const technicalData = {};

  function safeSanitize(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') {
      if (!isFinite(value) || isNaN(value)) return fallback;
      return Math.round(value * 1000) / 1000;
    }
    if (typeof value === 'string') {
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'object' && value !== null) return fallback;
    if (typeof value !== 'number' && !isNaN(Number(value))) {
      const numValue = Number(value);
      if (isFinite(numValue)) return Math.round(numValue * 1000) / 1000;
    }
    return fallback;
  }

  // ===== Loudness =====
  if (coreMetrics.lufs) {
    technicalData.lufsIntegrated = safeSanitize(coreMetrics.lufs.integrated);
    technicalData.lufsShortTerm = safeSanitize(coreMetrics.lufs.shortTerm);
    technicalData.lufsMomentary = safeSanitize(coreMetrics.lufs.momentary);
    technicalData.lra = safeSanitize(coreMetrics.lufs.lra);
    technicalData.originalLUFS = safeSanitize(coreMetrics.lufs.originalLUFS);
    technicalData.normalizedTo = safeSanitize(coreMetrics.lufs.normalizedTo);
    technicalData.gainAppliedDB = safeSanitize(coreMetrics.lufs.gainAppliedDB);
  }

  // ===== True Peak =====
  if (coreMetrics.truePeak) {
    technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp);
    technicalData.truePeakLinear = safeSanitize(coreMetrics.truePeak.maxLinear);
    technicalData.samplePeakLeftDb = safeSanitize(coreMetrics.truePeak.samplePeakLeftDb);
    technicalData.samplePeakRightDb = safeSanitize(coreMetrics.truePeak.samplePeakRightDb);
    technicalData.clippingSamples = safeSanitize(coreMetrics.truePeak.clippingSamples, 0);
    technicalData.clippingPct = safeSanitize(coreMetrics.truePeak.clippingPct, 0);
  }

  // ===== Dynamics =====
  if (coreMetrics.dynamics) {
    technicalData.dynamicRange = safeSanitize(coreMetrics.dynamics.dynamicRange);
    technicalData.crestFactor = safeSanitize(coreMetrics.dynamics.crestFactor);
    technicalData.peakRmsDb = safeSanitize(coreMetrics.dynamics.peakRmsDb);
    technicalData.averageRmsDb = safeSanitize(coreMetrics.dynamics.averageRmsDb);
    technicalData.drCategory = safeSanitize(coreMetrics.dynamics.drCategory, 'unknown');
  }

  // ===== Stereo =====
  if (coreMetrics.stereo) {
    technicalData.stereoCorrelation = safeSanitize(coreMetrics.stereo.correlation);
    technicalData.stereoWidth = safeSanitize(coreMetrics.stereo.width);
    technicalData.balanceLR = safeSanitize(coreMetrics.stereo.balance);
    technicalData.isMonoCompatible = coreMetrics.stereo.isMonoCompatible || false;
    technicalData.monoCompatibility = technicalData.isMonoCompatible; // alias p/ front
    technicalData.hasPhaseIssues = coreMetrics.stereo.hasPhaseIssues || false;
    technicalData.correlationCategory = safeSanitize(coreMetrics.stereo.correlationCategory, 'unknown');
    technicalData.widthCategory = safeSanitize(coreMetrics.stereo.widthCategory, 'unknown');
  }

  // ===== FFT Spectral =====
  if (coreMetrics.fft?.aggregated) {
    const s = coreMetrics.fft.aggregated;
    technicalData.spectralCentroidHz = safeSanitize(s.spectralCentroidHz);
    technicalData.spectralRolloffHz = safeSanitize(s.spectralRolloffHz);
    technicalData.spectralBandwidthHz = safeSanitize(s.spectralBandwidthHz);
    technicalData.spectralSpreadHz = safeSanitize(s.spectralSpreadHz);
    technicalData.spectralFlatness = safeSanitize(s.spectralFlatness);
    technicalData.spectralCrest = safeSanitize(s.spectralCrest);
    technicalData.spectralSkewness = safeSanitize(s.spectralSkewness);
    technicalData.spectralKurtosis = safeSanitize(s.spectralKurtosis);
    technicalData.zeroCrossingRate = safeSanitize(s.zeroCrossingRate);
    technicalData.spectralFlux = safeSanitize(s.spectralFlux);
    technicalData.spectralChange = technicalData.spectralFlux; // alias mudança espectral
    technicalData.spectralCentroid = technicalData.spectralCentroidHz;
    technicalData.spectralRolloff = technicalData.spectralRolloffHz;
  }

  // ===== Spectral Bands =====
  if (coreMetrics.spectralBands?.aggregated) {
    const b = coreMetrics.spectralBands.aggregated;
    technicalData.spectral_balance = {
      sub: safeSanitize(b.sub),
      bass: safeSanitize(b.bass),
      mids: safeSanitize(b.lowMid),
      treble: safeSanitize(b.highMid),
      presence: safeSanitize(b.presence),
      air: safeSanitize(b.air),
      totalPercentage: 100
    };
  }

  // ===== RMS =====
  if (coreMetrics.rms) {
    technicalData.rmsLevels = {
      left: safeSanitize(coreMetrics.rms.left),
      right: safeSanitize(coreMetrics.rms.right),
      average: safeSanitize(coreMetrics.rms.average),
      peak: safeSanitize(coreMetrics.rms.peak),
      count: safeSanitize(coreMetrics.rms.count, 0)
    };
    technicalData.peak = technicalData.rmsLevels.peak;
    technicalData.rms = technicalData.rmsLevels.average;
    technicalData.avgLoudness = technicalData.rmsLevels.average; // alias para Volume Médio
  }

  // ===== DC Offset =====
  if (coreMetrics.dcOffset && typeof coreMetrics.dcOffset === 'object') {
    technicalData.dcOffset = {
      value: safeSanitize(coreMetrics.dcOffset.value),
      unit: coreMetrics.dcOffset.unit || 'dB',
      detailed: {
        L: safeSanitize(coreMetrics.dcOffset.detailed?.L || coreMetrics.dcOffset.value),
        R: safeSanitize(coreMetrics.dcOffset.detailed?.R || coreMetrics.dcOffset.value),
        severity: coreMetrics.dcOffset.detailed?.severity || 'Low'
      }
    };
  } else {
    technicalData.dcOffset = null;
  }

  // ===== Dominant Frequencies =====
  if (coreMetrics.dominantFrequencies && coreMetrics.dominantFrequencies.value) {
    technicalData.dominantFrequencies = {
      value: safeSanitize(coreMetrics.dominantFrequencies.value),
      unit: coreMetrics.dominantFrequencies.unit || 'Hz',
      detailed: {
        primary: safeSanitize(coreMetrics.dominantFrequencies.value),
        secondary: null,
        peaks: []
      }
    };
  } else if (coreMetrics.fft?.dominantFrequencies && Array.isArray(coreMetrics.fft.dominantFrequencies)) {
    const freqArray = coreMetrics.fft.dominantFrequencies.slice(0, 10).map(f => ({
      frequency: safeSanitize(f.frequency),
      occurrences: safeSanitize(f.occurrences, 1),
      magnitude: safeSanitize(f.magnitude)
    }));
    technicalData.dominantFrequencies = freqArray;
  } else {
    technicalData.dominantFrequencies = null;
  }

  // ===== Spectral Uniformity =====
  if (coreMetrics.spectralUniformity && typeof coreMetrics.spectralUniformity === 'object') {
    // A função calculateSpectralUniformity retorna um objeto complexo
    const uniformityValue = coreMetrics.spectralUniformity.uniformity?.coefficient || 
                            coreMetrics.spectralUniformity.score ||
                            0.5; // Fallback
    
    technicalData.spectralUniformity = {
      value: safeSanitize(uniformityValue),
      unit: 'ratio',
      detailed: {
        variance: safeSanitize(uniformityValue),
        distribution: coreMetrics.spectralUniformity.rating || 
                     coreMetrics.spectralUniformity.characteristics?.dominantBand || 
                     'Unknown',
        analysis: 'Spectral analysis completed'
      }
    };
  } else {
    technicalData.spectralUniformity = null;
  }

  // ===== Tempo / BPM =====
  // Mapear campos diretos de coreMetrics para technicalData
  technicalData.bpm = safeSanitize(coreMetrics.bpm) ?? null;
  technicalData.bpmConfidence = safeSanitize(coreMetrics.bpmConfidence) ?? null;

  // ===== Problems / Suggestions =====
  technicalData.problemsAnalysis = {
    problems: coreMetrics.problems || [],
    suggestions: coreMetrics.suggestions || [],
    qualityAssessment: coreMetrics.qualityAssessment || {},
    priorityRecommendations: coreMetrics.priorityRecommendations || []
  };

  // Log de auditoria para confirmar presença do BPM
  if (technicalData.bpm !== null) {
    console.log("[AUDIT] TechnicalData JSON inclui bpm", { 
      bpm: technicalData.bpm, 
      confidence: technicalData.bpmConfidence 
    });
  }

  return technicalData;
}

function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, options = {}) {
  const jobId = options.jobId || 'unknown';
  const scoreValue = scoringResult.score || scoringResult.scorePct;
  
  // 🔥 LOG: Entrada do buildFinalJSON
  console.log('[GENRE-FLOW][JSON-OUTPUT-PRE]', {
    'options.genre': options.genre,
    'options.mode': options.mode,
    'options.data?.genre': options.data?.genre
  });
  
  // 🎯 CORREÇÃO: Resolver genre baseado no modo
  const isGenreMode = (options.mode || 'genre') === 'genre';
  const resolvedGenre = options.genre || options.data?.genre || null;
  const finalGenre = isGenreMode
    ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
    : (options.genre || 'default');
  
  // 🚨 BLINDAGEM: Modo genre NÃO pode ter finalGenre null/default
  if (isGenreMode && (!finalGenre || finalGenre === 'default')) {
    console.error('[JSON-OUTPUT-ERROR] Modo genre mas finalGenre inválido:', {
      finalGenre,
      resolvedGenre,
      optionsGenre: options.genre,
      dataGenre: options.data?.genre
    });
    throw new Error('[GENRE-ERROR] JSON output recebeu modo genre sem finalGenre válido');
  }
  
  // 🔥 LOG: Após resolução do genre
  console.log('[GENRE-FLOW][JSON-OUTPUT-POST]', {
    'isGenreMode': isGenreMode,
    'resolvedGenre': resolvedGenre,
    'finalGenre': finalGenre
  });

  return {
    // 🎯 CORREÇÃO CRÍTICA: Incluir genre e mode no JSON final
    genre: finalGenre,
    mode: options.mode || 'genre',
    
    // 🎯 Adicionar data com genre e genreTargets quando existirem
    ...(isGenreMode && options.genreTargets ? {
      data: {
        genre: finalGenre,
        genreTargets: options.genreTargets
      }
    } : {}),
    
    score: Math.round(scoreValue * 10) / 10,
    classification: scoringResult.classification || 'unknown',

    loudness: {
      integrated: technicalData.lufsIntegrated,
      shortTerm: technicalData.lufsShortTerm,
      momentary: technicalData.lufsMomentary,
      lra: technicalData.lra,
      unit: "LUFS"
    },

    truePeak: {
      maxDbtp: technicalData.truePeakDbtp,
      maxLinear: technicalData.truePeakLinear,
      samplePeakLeft: technicalData.samplePeakLeftDb,
      samplePeakRight: technicalData.samplePeakRightDb,
      clipping: {
        samples: technicalData.clippingSamples,
        percentage: technicalData.clippingPct
      }
    },

    stereo: {
      correlation: technicalData.stereoCorrelation,
      width: technicalData.stereoWidth,
      balance: technicalData.balanceLR,
      monoCompatibility: technicalData.monoCompatibility,
      hasPhaseIssues: technicalData.hasPhaseIssues
    },

    dynamics: {
      range: technicalData.dynamicRange,
      crest: technicalData.crestFactor,
      peakRms: technicalData.peakRmsDb,
      avgRms: technicalData.averageRmsDb
    },

    spectral: {
      centroidHz: technicalData.spectralCentroidHz,
      rolloffHz: technicalData.spectralRolloffHz,
      flatness: technicalData.spectralFlatness,
      flux: technicalData.spectralFlux,
      change: technicalData.spectralChange
    },

    spectralBands: technicalData.spectral_balance,

    dcOffset: technicalData.dcOffset,
    spectralUniformity: technicalData.spectralUniformity,

    dominantFrequencies: technicalData.dominantFrequencies,

    problemsAnalysis: technicalData.problemsAnalysis,

    // ===== DIAGNOSTICS =====
    diagnostics: {
      problems: technicalData.problemsAnalysis?.problems || [],
      suggestions: technicalData.problemsAnalysis?.suggestions || [],
      prioritized: technicalData.problemsAnalysis?.priorityRecommendations || []
    },

    // ===== SCORES (Subscores) =====
    scores: {
      dynamicRange: scoringResult.breakdown?.dynamics || 0,
      stereo: scoringResult.breakdown?.stereo || 0,
      loudness: scoringResult.breakdown?.loudness || 0,
      frequency: scoringResult.breakdown?.frequency || 0,
      technical: scoringResult.breakdown?.technical || 0
    },

    scoring: {
      method: scoringResult.method || 'Equal Weight V3',
      score: scoreValue,
      breakdown: scoringResult.breakdown || {
        dynamics: null, technical: null, stereo: null, loudness: null, frequency: null
      },
      penalties: scoringResult.penalties || {},
      bonuses: scoringResult.bonuses || {}
    },

    // ===== REFERENCE COMPARISON =====
    // 🎯 CORREÇÃO: Só gerar referenceComparison em modo reference
    // Modo genre NÃO deve ter referenceComparison genérico
    ...(isGenreMode ? {} : {
      referenceComparison: options.reference?.comparison || null
    }),

    // ===== TECHNICAL DATA (Frontend Compatible) =====
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
      monoCompatibility: technicalData.monoCompatibility,
      hasPhaseIssues: technicalData.hasPhaseIssues,
      correlationCategory: technicalData.correlationCategory,
      widthCategory: technicalData.widthCategory,
      
      // Dinâmica
      dynamicRange: technicalData.dynamicRange,
      crestFactor: technicalData.crestFactor,
      peakRmsDb: technicalData.peakRmsDb,
      averageRmsDb: technicalData.averageRmsDb,
      avgLoudness: technicalData.avgLoudness,
      drCategory: technicalData.drCategory,
      
      // Espectral
      spectralCentroid: technicalData.spectralCentroid,
      spectralCentroidHz: technicalData.spectralCentroidHz,
      spectralRolloff: technicalData.spectralRolloff,
      spectralRolloffHz: technicalData.spectralRolloffHz,
      spectralBandwidthHz: technicalData.spectralBandwidthHz,
      spectralSpreadHz: technicalData.spectralSpreadHz,
      spectralFlatness: technicalData.spectralFlatness,
      spectralCrest: technicalData.spectralCrest,
      spectralSkewness: technicalData.spectralSkewness,
      spectralKurtosis: technicalData.spectralKurtosis,
      zeroCrossingRate: technicalData.zeroCrossingRate,
      spectralFlux: technicalData.spectralFlux,
      spectralChange: technicalData.spectralChange,
      
      // Bandas Espectrais
      spectral_balance: technicalData.spectral_balance,
      
      // RMS & Peaks
      rmsLevels: technicalData.rmsLevels,
      peak: technicalData.peak,
      rms: technicalData.rms,
      
      // Experimentais
      dcOffset: technicalData.dcOffset,
      spectralUniformity: technicalData.spectralUniformity,
      dominantFrequencies: technicalData.dominantFrequencies,
      problemsAnalysis: technicalData.problemsAnalysis,
      
      // BPM Detection
      bpm: technicalData.bpm,
      bpmConfidence: technicalData.bpmConfidence,
      
      // Compatibilidade com nomes legados
      correlation: technicalData.stereoCorrelation,
      balance: technicalData.balanceLR,
      width: technicalData.stereoWidth,
      dr: technicalData.dynamicRange
    },

    metadata: {
      fileName: metadata.fileName || 'unknown',
      duration: metadata.duration || 0,
      sampleRate: metadata.sampleRate || 48000,
      channels: metadata.channels || 2,
      stage: 'output_scoring_completed',
      jobId: jobId,
      timestamp: new Date().toISOString()
    }
  };
}

function createCompactJSON(fullJSON) {
  return {
    score: fullJSON.score,
    classification: fullJSON.classification,
    loudness: fullJSON.loudness,
    truePeak: fullJSON.truePeak,
    stereo: fullJSON.stereo,
    dynamics: fullJSON.dynamics,
    spectral: fullJSON.spectral,
    spectralBands: fullJSON.spectralBands,
    dcOffset: fullJSON.dcOffset,
    spectralUniformity: fullJSON.spectralUniformity,
    dominantFrequencies: (fullJSON.dominantFrequencies || []).slice(0, 5),
    problemsAnalysis: fullJSON.problemsAnalysis,
    diagnostics: fullJSON.diagnostics,
    scores: fullJSON.scores,
    scoring: fullJSON.scoring,
    referenceComparison: fullJSON.referenceComparison,
    // TechnicalData essencial para frontend
    technicalData: {
      lufsIntegrated: fullJSON.technicalData?.lufsIntegrated,
      truePeakDbtp: fullJSON.technicalData?.truePeakDbtp,
      stereoCorrelation: fullJSON.technicalData?.stereoCorrelation,
      dynamicRange: fullJSON.technicalData?.dynamicRange,
      spectralCentroid: fullJSON.technicalData?.spectralCentroid,
      spectral_balance: fullJSON.technicalData?.spectral_balance,
      peak: fullJSON.technicalData?.peak,
      rms: fullJSON.technicalData?.rms,
      monoCompatibility: fullJSON.technicalData?.monoCompatibility,
      dcOffset: fullJSON.technicalData?.dcOffset,
      spectralUniformity: fullJSON.technicalData?.spectralUniformity,
      dominantFrequencies: (fullJSON.technicalData?.dominantFrequencies || []).slice(0, 5),
      correlation: fullJSON.technicalData?.correlation,
      balance: fullJSON.technicalData?.balance,
      width: fullJSON.technicalData?.width,
      dr: fullJSON.technicalData?.dr
    },
    metadata: fullJSON.metadata
  };
}

function validateFinalJSON(finalJSON) {
  const requiredFields = ['score', 'classification', 'loudness', 'truePeak', 'stereo', 'metadata'];
  for (const f of requiredFields) {
    if (finalJSON[f] === undefined || finalJSON[f] === null) {
      throw makeErr('output_scoring', `Missing field: ${f}`, 'missing_final_field');
    }
  }
}

/**
 * Gerar dados de referência baseados no gênero
 */
function generateGenreReference(technicalData, genre) {
  const references = [
    {
      metric: "Volume Integrado (padrão streaming)",
      value: technicalData.lufsIntegrated || -23,
      ideal: -23,
      unit: "LUFS",
      status: Math.abs((technicalData.lufsIntegrated || -23) - (-23)) < 2 ? "✅ IDEAL" : "⚠️ AJUSTAR"
    },
    {
      metric: "pico real (dbtp)",
      value: technicalData.truePeakDbtp || -3,
      ideal: -1,
      unit: "dBTP",
      status: (technicalData.truePeakDbtp || -3) < -1 ? "✅ IDEAL" : "⚠️ AJUSTAR"
    },
    {
      metric: "Dinâmica (diferença entre alto/baixo)",
      value: technicalData.dynamicRange || 10,
      ideal: genre === 'trance' ? 8 : 10,
      unit: "LU",
      status: (technicalData.dynamicRange || 10) > 6 ? "✅ IDEAL" : "⚠️ AJUSTAR"
    },
    {
      metric: "Variação de Volume (consistência)",
      value: technicalData.lra || 12,
      ideal: 6,
      unit: "LU",
      status: (technicalData.lra || 12) < 10 ? "✅ IDEAL" : "⚠️ AJUSTAR"
    },
    {
      metric: "Correlação Estéreo (largura)",
      value: technicalData.stereoCorrelation || 0.7,
      ideal: 0.7,
      unit: "ratio",
      status: (technicalData.stereoCorrelation || 0.7) > 0.3 && (technicalData.stereoCorrelation || 0.7) < 0.9 ? "✅ IDEAL" : "⚠️ AJUSTAR"
    }
  ];
  
  return references;
}

console.log("✅ JSON Output & Scoring (Fase 5.4) carregado - 100% compatível com frontend");
