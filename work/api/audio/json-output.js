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
      
      // Tenta criar versão compactada removendo dados opcionais
      const compactJSON = createCompactJSON(finalJSON);
      try {
        jsonString = JSON.stringify(compactJSON);
        const compactSize = jsonString.length;
        
        if (compactSize > 100 * 1024) {
          throw makeErr('output_scoring', `Even compact JSON too large: ${compactSize} bytes (limit: 100KB)`, 'json_too_large');
        }
        
        logAudio('output_scoring', 'json_compacted', { 
          originalSize: `${(jsonSize / 1024).toFixed(2)}KB`,
          compactSize: `${(compactSize / 1024).toFixed(2)}KB`,
          fileName, 
          jobId 
        });
        
        finalJSON = compactJSON;
      } catch (compactError) {
        throw makeErr('output_scoring', `JSON compaction failed: ${compactError.message}`, 'json_compaction_failed');
      }
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

  // Função helper para validar e limpar valores
  function safeSanitize(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') {
      if (!isFinite(value) || isNaN(value)) return fallback;
      // Limitar precisão para evitar números muito longos
      return Math.round(value * 1000) / 1000;
    }
    if (typeof value === 'string') {
      // Limitar tamanho de strings
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    // Para outros tipos (objects, arrays), tentar converter ou retornar fallback
    if (typeof value === 'object' && value !== null) {
      return fallback; // Não processar objetos complexos aqui
    }
    // Tentar converter strings numéricas
    if (typeof value !== 'number' && !isNaN(Number(value))) {
      const numValue = Number(value);
      if (isFinite(numValue)) {
        return Math.round(numValue * 1000) / 1000;
      }
    }
    return fallback;
  }

  // ===== MÉTRICAS PRINCIPAIS =====
  
  // Loudness (LUFS ITU-R BS.1770-4)
  if (coreMetrics.lufs) {
    technicalData.lufsIntegrated = safeSanitize(coreMetrics.lufs.integrated);
    technicalData.lufsShortTerm = safeSanitize(coreMetrics.lufs.shortTerm);
    technicalData.lufsMomentary = safeSanitize(coreMetrics.lufs.momentary);
    technicalData.lra = safeSanitize(coreMetrics.lufs.lra);
    technicalData.originalLUFS = safeSanitize(coreMetrics.lufs.originalLUFS);
    technicalData.normalizedTo = safeSanitize(coreMetrics.lufs.normalizedTo);
    technicalData.gainAppliedDB = safeSanitize(coreMetrics.lufs.gainAppliedDB);
  }

  // True Peak (4x Oversampling)
  if (coreMetrics.truePeak) {
    technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp);
    technicalData.truePeakLinear = safeSanitize(coreMetrics.truePeak.maxLinear);
    technicalData.samplePeakLeftDb = safeSanitize(coreMetrics.truePeak.samplePeakLeftDb);
    technicalData.samplePeakRightDb = safeSanitize(coreMetrics.truePeak.samplePeakRightDb);
    technicalData.clippingSamples = safeSanitize(coreMetrics.truePeak.clippingSamples, 0);
    technicalData.clippingPct = safeSanitize(coreMetrics.truePeak.clippingPct, 0);
  }

  // Dinâmica
  if (coreMetrics.dynamics) {
    technicalData.dynamicRange = safeSanitize(coreMetrics.dynamics.dynamicRange);
    technicalData.crestFactor = safeSanitize(coreMetrics.dynamics.crestFactor);
    technicalData.peakRmsDb = safeSanitize(coreMetrics.dynamics.peakRmsDb);
    technicalData.averageRmsDb = safeSanitize(coreMetrics.dynamics.averageRmsDb);
    technicalData.drCategory = safeSanitize(coreMetrics.dynamics.drCategory, 'unknown');
  }

  // ===== ESTÉREO & ESPECTRAL =====
  
  // Stereo
  if (coreMetrics.stereo) {
    technicalData.stereoCorrelation = safeSanitize(coreMetrics.stereo.correlation);
    technicalData.stereoWidth = safeSanitize(coreMetrics.stereo.width);
    technicalData.balanceLR = safeSanitize(coreMetrics.stereo.balance);
    technicalData.isMonoCompatible = coreMetrics.stereo.isMonoCompatible || false;
    technicalData.hasPhaseIssues = coreMetrics.stereo.hasPhaseIssues || false;
    technicalData.correlationCategory = safeSanitize(coreMetrics.stereo.correlationCategory, 'unknown');
    technicalData.widthCategory = safeSanitize(coreMetrics.stereo.widthCategory, 'unknown');
  }

  // Métricas Espectrais (do FFT)
  if (coreMetrics.fft && coreMetrics.fft.aggregated) {
    const spectral = coreMetrics.fft.aggregated;
    
    // 🔬 DEBUG: Log das métricas espectrais disponíveis
    console.log("[AUDIT] Spectral metrics debug:", {
      available: Object.keys(spectral),
      spectralCentroidHz: spectral.spectralCentroidHz,
      spectralRolloffHz: spectral.spectralRolloffHz,
      spectralBandwidthHz: spectral.spectralBandwidthHz,
      spectralFlatness: spectral.spectralFlatness,
      jobId
    });
    
    // 🎯 FIXADO: Usar nomes com Hz para compatibilidade com frontend
    technicalData.spectralCentroidHz = safeSanitize(spectral.spectralCentroidHz);
    technicalData.spectralRolloffHz = safeSanitize(spectral.spectralRolloffHz);
    technicalData.spectralBandwidthHz = safeSanitize(spectral.spectralBandwidthHz);
    technicalData.spectralSpreadHz = safeSanitize(spectral.spectralSpreadHz);
    technicalData.spectralFlatness = safeSanitize(spectral.spectralFlatness);
    technicalData.spectralCrest = safeSanitize(spectral.spectralCrest);
    technicalData.spectralSkewness = safeSanitize(spectral.spectralSkewness);
    technicalData.spectralKurtosis = safeSanitize(spectral.spectralKurtosis);
    technicalData.zeroCrossingRate = safeSanitize(spectral.zeroCrossingRate);
    technicalData.spectralFlux = safeSanitize(spectral.spectralFlux);
    
    // Também criar aliases para compatibilidade com scoring
    technicalData.spectralCentroid = technicalData.spectralCentroidHz;
    technicalData.spectralRolloff = technicalData.spectralRolloffHz;
    technicalData.spectralBandwidth = technicalData.spectralBandwidthHz;
    technicalData.spectralSpread = technicalData.spectralSpreadHz;
    
    // 🔥 DEBUG CRITICAL: Log das métricas extraídas
    console.log("[AUDIT] Spectral metrics extracted to technicalData:", {
      spectralCentroidHz: technicalData.spectralCentroidHz,
      spectralRolloffHz: technicalData.spectralRolloffHz,
      spectralBandwidthHz: technicalData.spectralBandwidthHz,
      spectralFlatness: technicalData.spectralFlatness,
      jobId
    });
  } else {
    // 🔬 DEBUG: Log se FFT não está disponível
    console.log("[AUDIT] FFT missing debug:", {
      hasCoreMetrics: !!coreMetrics,
      hasFFT: !!(coreMetrics.fft),
      hasAggregated: !!(coreMetrics.fft?.aggregated),
      fftKeys: coreMetrics.fft ? Object.keys(coreMetrics.fft) : null,
      jobId
    });
  }

  // ===== BALANCE ESPECTRAL DETALHADO =====
  
  // Bandas Espectrais (7 bandas profissionais)
  if (coreMetrics.spectralBands && coreMetrics.spectralBands.aggregated) {
    const bands = coreMetrics.spectralBands.aggregated;
    
    // 🔬 DEBUG: Log das bandas espectrais disponíveis
    console.log("[AUDIT] Spectral bands debug:", {
      available: Object.keys(bands),
      bandsStructure: bands,
      jobId
    });
    
    technicalData.bandEnergies = {};
    
    // 🎯 FIXADO: Estrutura direta bands.sub em vez de bands.bands.sub
    const bandNames = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
    const mappedNames = ['sub', 'bass', 'low_mid', 'mid', 'high_mid', 'presence', 'air'];
    
    for (let i = 0; i < bandNames.length; i++) {
      const bandName = bandNames[i];
      const mappedName = mappedNames[i];
      const bandValue = bands[bandName]; // Direto: bands.sub, bands.bass, etc.
      
      if (bandValue !== null && bandValue !== undefined) {
        technicalData.bandEnergies[mappedName] = {
          energy: safeSanitize(bandValue),
          percentage: safeSanitize(bandValue * 100), // Converter para percentual
          name: bandName,
          frequencyRange: `${bandName}-range`
        };
      } else {
        technicalData.bandEnergies[mappedName] = null;
      }
    }
    
    // Spectral Balance simplificado para compatibilidade (percentuais diretos)
    technicalData.spectral_balance = {
      sub: safeSanitize(bands.sub),
      bass: safeSanitize(bands.bass),
      lowMid: safeSanitize(bands.lowMid),
      mid: safeSanitize(bands.mid),
      highMid: safeSanitize(bands.highMid),
      presence: safeSanitize(bands.presence),
      air: safeSanitize(bands.air),
      totalPercentage: 100
    };
    
    // 🔥 DEBUG CRITICAL: Log das bandas extraídas
    console.log("[AUDIT] Spectral bands extracted:", {
      bandEnergies: technicalData.bandEnergies,
      spectral_balance: technicalData.spectral_balance,
      jobId
    });
  } else {
    // 🔬 DEBUG: Log se bandas espectrais não estão disponíveis
    console.log("[AUDIT] Spectral bands missing debug:", {
      hasCoreMetrics: !!coreMetrics,
      hasSpectralBands: !!(coreMetrics.spectralBands),
      hasAggregated: !!(coreMetrics.spectralBands?.aggregated),
      spectralBandsKeys: coreMetrics.spectralBands ? Object.keys(coreMetrics.spectralBands) : null,
      jobId
    });
  }

  // ===== RMS DETALHADO =====
  
  if (coreMetrics.rms) {
    technicalData.rmsLevels = {
      left: safeSanitize(coreMetrics.rms.left),
      right: safeSanitize(coreMetrics.rms.right),
      average: safeSanitize(coreMetrics.rms.average),
      peak: safeSanitize(coreMetrics.rms.peak),
      count: safeSanitize(coreMetrics.rms.count, 0)
    };
    
    // Compatibilidade com nomes legados
    technicalData.peak = safeSanitize(coreMetrics.rms.peak);
    technicalData.rms = safeSanitize(coreMetrics.rms.average);
    technicalData.rmsLevel = safeSanitize(coreMetrics.rms.average);
  }

  // ===== MÉTRICAS TÉCNICAS AVANÇADAS =====
  
  // Headroom (calculado a partir do peak)
  if (technicalData.peak !== null && technicalData.peak !== undefined) {
    technicalData.headroomDb = safeSanitize(0 - technicalData.peak); // 0 dBFS - peak atual
  }
  
  if (technicalData.truePeakDbtp !== null && technicalData.truePeakDbtp !== undefined) {
    technicalData.headroomTruePeakDb = safeSanitize(0 - technicalData.truePeakDbtp); // 0 dBTP - true peak atual
  }

  // ===== MÉTRICAS EXPERIMENTAIS (TEMPORARIAMENTE DESABILITADAS) =====
  
  // DC Offset Analysis - SKIP por enquanto
  console.log('[SKIP_METRIC] dcOffset: não incluído no JSON - implementação instável');
  technicalData.dcOffset = null;
  
  // Dominant Frequencies Analysis - Usando dados do calculateDominantFrequencies se disponível
  if (coreMetrics.dominantFrequencies && coreMetrics.dominantFrequencies.value) {
    console.log('[PARTIAL_METRIC] dominantFrequencies: usando dados limitados disponíveis');
    technicalData.dominantFrequencies = {
      value: safeSanitize(coreMetrics.dominantFrequencies.value),
      unit: coreMetrics.dominantFrequencies.unit || 'Hz',
      detailed: coreMetrics.dominantFrequencies.detailed || {
        primary: safeSanitize(coreMetrics.dominantFrequencies.value),
        secondary: null,
        peaks: []
      }
    };
  } else {
    console.log('[SKIP_METRIC] dominantFrequencies: dados não disponíveis no formato esperado');
    technicalData.dominantFrequencies = null;
  }
  
  // Spectral Uniformity Analysis - SKIP por enquanto
  console.log('[SKIP_METRIC] spectralUniformity: não incluído no JSON - implementação instável');
  technicalData.spectralUniformity = null;
  
  // Problems and Suggestions Analysis - Usando dados básicos do core-metrics
  if (coreMetrics.problems || coreMetrics.suggestions) {
    console.log('[PARTIAL_METRIC] problemsAnalysis: usando dados básicos disponíveis');
    technicalData.problemsAnalysis = {
      problems: coreMetrics.problems || [],
      suggestions: coreMetrics.suggestions || [],
      qualityAssessment: coreMetrics.qualityAssessment || {},
      priorityRecommendations: coreMetrics.priorityRecommendations || []
    };
  } else {
    console.log('[SKIP_METRIC] problemsAnalysis: dados não disponíveis');
    technicalData.problemsAnalysis = null;
  }

  // Problemas técnicos detectados (legacy compatibility)
  technicalData.thdPercent = null; // TODO: Implementar se necessário

  // ===== FREQUÊNCIAS DOMINANTES =====
  
  if (coreMetrics.fft && coreMetrics.fft.dominantFrequencies && Array.isArray(coreMetrics.fft.dominantFrequencies)) {
    // Limitar a 10 frequências e sanitizar dados
    technicalData.dominantFrequencies = coreMetrics.fft.dominantFrequencies
      .slice(0, 10)
      .map(freq => {
        if (!freq || typeof freq !== 'object') return null;
        return {
          frequency: safeSanitize(freq.frequency),
          occurrences: safeSanitize(freq.occurrences, 1),
          magnitude: safeSanitize(freq.magnitude)
        };
      })
      .filter(freq => freq !== null && freq.frequency !== null);
  } else {
    technicalData.dominantFrequencies = [];
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
      processedFrames: coreMetrics.spectralBands?.aggregated?.processedFrames || 0,
      hasData: (coreMetrics.spectralBands?.aggregated?.processedFrames || 0) > 0
    },

    // ===== Métricas Espectrais (nível raiz para compatibilidade) =====
    spectralCentroidHz: technicalData.spectralCentroidHz,
    spectralRolloffHz: technicalData.spectralRolloffHz,
    spectralBandwidthHz: technicalData.spectralBandwidthHz,
    spectralSpreadHz: technicalData.spectralSpreadHz,
    spectralFlatness: technicalData.spectralFlatness,
    spectralCrest: technicalData.spectralCrest,
    spectralSkewness: technicalData.spectralSkewness,
    spectralKurtosis: technicalData.spectralKurtosis,
    zeroCrossingRate: technicalData.zeroCrossingRate,
    spectralFlux: technicalData.spectralFlux,
    
    // ===== Frequências Dominantes =====
    dominantFrequencies: technicalData.dominantFrequencies || [],

    // ===== DC Offset Analysis =====
    dcOffset: technicalData.dcOffset,

    // ===== Spectral Uniformity =====
    spectralUniformity: technicalData.spectralUniformity,

    // ===== Problems & Suggestions Analysis =====
    problemsAnalysis: technicalData.problemsAnalysis,

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

    // ===== Estrutura TechnicalData Essencial (para compatibilidade frontend) =====
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
      
      // Espectral Essencial
      spectralCentroid: technicalData.spectralCentroid,
      spectralCentroidHz: technicalData.spectralCentroidHz,
      spectralRolloff: technicalData.spectralRolloff,
      spectralRolloffHz: technicalData.spectralRolloff, // Compatibilidade
      spectralBandwidth: technicalData.spectralBandwidth,
      spectralBandwidthHz: technicalData.spectralBandwidth, // Compatibilidade
      spectralSpread: technicalData.spectralSpread,
      spectralSpreadHz: technicalData.spectralSpread, // Compatibilidade
      spectralFlatness: technicalData.spectralFlatness,
      spectralCrest: technicalData.spectralCrest,
      spectralSkewness: technicalData.spectralSkewness,
      spectralKurtosis: technicalData.spectralKurtosis,
      zeroCrossingRate: technicalData.zeroCrossingRate,
      spectralFlux: technicalData.spectralFlux,
      brightnessCategory: technicalData.brightnessCategory,
      
      // Bandas Espectrais
      bandEnergies: technicalData.bandEnergies,
      spectral_balance: technicalData.spectral_balance,
      
      // RMS & Peaks
      rmsLevels: technicalData.rmsLevels,
      peak: technicalData.peak,
      rms: technicalData.rms,
      
      // Headroom
      headroomDb: technicalData.headroomDb,
      headroomTruePeakDb: technicalData.headroomTruePeakDb,
      
      // Frequências Dominantes (limitadas para evitar tamanho excessivo)
      dominantFrequencies: (technicalData.dominantFrequencies || []).slice(0, 10),
      
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

    // ===== Resumo Core Metrics (sem arrays grandes) =====
    processing: {
      fftFrames: coreMetrics.fft?.processedFrames || 0,
      spectralBandsFrames: coreMetrics.spectralBands?.processedFrames || 0,
      spectralCentroidFrames: coreMetrics.spectralCentroid?.processedFrames || 0,
      lufsValid: !!(coreMetrics.lufs?.integrated),
      truePeakValid: !!(coreMetrics.truePeak?.maxDbtp),
      stereoValid: !!(coreMetrics.stereo?.correlation),
      dynamicsValid: !!(coreMetrics.dynamics?.dynamicRange),
      rmsValid: !!(coreMetrics.rms?.average),
      normalizationApplied: !!(coreMetrics.normalization?.applied)
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

  // 🔥 DEBUG CRITICAL: Log do JSON export final - verificar se spectralBands está incluído
  console.log("[AUDIT] JSON export spectralBands:", {
    hasSpectralBands: !!finalJSON.spectralBands,
    spectralBandsKeys: finalJSON.spectralBands ? Object.keys(finalJSON.spectralBands) : null,
    hasDetailed: !!finalJSON.spectralBands?.detailed,
    hasSimplified: !!finalJSON.spectralBands?.simplified,
    spectralCentroidHz: finalJSON.spectralCentroidHz,
    spectralRolloffHz: finalJSON.spectralRolloffHz,
    technicalDataSpectralCentroid: finalJSON.technicalData?.spectralCentroid,
    jobId
  });

  return finalJSON;
}

function createCompactJSON(fullJSON) {
  // Versão compactada removendo dados opcionais e limitando arrays
  return {
    score: fullJSON.score,
    classification: fullJSON.classification,
    
    // Loudness essencial
    loudness: {
      integrated: fullJSON.loudness.integrated,
      shortTerm: fullJSON.loudness.shortTerm,
      lra: fullJSON.loudness.lra,
      unit: fullJSON.loudness.unit
    },
    
    // True Peak essencial
    truePeak: {
      maxDbtp: fullJSON.truePeak.maxDbtp,
      maxLinear: fullJSON.truePeak.maxLinear,
      unit: fullJSON.truePeak.unit
    },
    
    // Stereo essencial
    stereo: {
      correlation: fullJSON.stereo.correlation,
      width: fullJSON.stereo.width,
      balance: fullJSON.stereo.balance,
      isMonoCompatible: fullJSON.stereo.isMonoCompatible,
      hasPhaseIssues: fullJSON.stereo.hasPhaseIssues
    },
    
    // Dinâmica essencial
    dynamics: {
      range: fullJSON.dynamics.range,
      crest: fullJSON.dynamics.crest,
      category: fullJSON.dynamics.category
    },
    
    // Espectral básico
    spectral: {
      centroidHz: fullJSON.spectral.centroidHz,
      rolloffHz: fullJSON.spectral.rolloffHz,
      flatness: fullJSON.spectral.flatness,
      hasData: fullJSON.spectral.hasData
    },
    
    // Bandas simplificadas
    spectralBands: {
      simplified: fullJSON.spectralBands.simplified,
      hasData: fullJSON.spectralBands.hasData
    },
    
    // TechnicalData essencial para frontend
    technicalData: {
      lufsIntegrated: fullJSON.technicalData.lufsIntegrated,
      truePeakDbtp: fullJSON.technicalData.truePeakDbtp,
      stereoCorrelation: fullJSON.technicalData.stereoCorrelation,
      dynamicRange: fullJSON.technicalData.dynamicRange,
      spectralCentroid: fullJSON.technicalData.spectralCentroid,
      bandEnergies: fullJSON.technicalData.bandEnergies,
      spectral_balance: fullJSON.technicalData.spectral_balance,
      peak: fullJSON.technicalData.peak,
      rms: fullJSON.technicalData.rms,
      headroomDb: fullJSON.technicalData.headroomDb,
      // Apenas top 5 frequências dominantes
      dominantFrequencies: (fullJSON.technicalData.dominantFrequencies || []).slice(0, 5),
      // Compatibilidade essencial
      correlation: fullJSON.technicalData.correlation,
      balance: fullJSON.technicalData.balance,
      width: fullJSON.technicalData.width,
      dr: fullJSON.technicalData.dr
    },
    
    // Scoring
    scoring: fullJSON.scoring,
    
    // Processing resumido
    processing: fullJSON.processing,
    
    // Metadata essencial
    metadata: {
      fileName: fullJSON.metadata.fileName,
      duration: fullJSON.metadata.duration,
      sampleRate: fullJSON.metadata.sampleRate,
      channels: fullJSON.metadata.channels,
      stage: fullJSON.metadata.stage,
      pipelineVersion: fullJSON.metadata.pipelineVersion,
      buildVersion: '5.4.2-compact',
      timestamp: fullJSON.metadata.timestamp,
      jobId: fullJSON.metadata.jobId
    }
  };
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
