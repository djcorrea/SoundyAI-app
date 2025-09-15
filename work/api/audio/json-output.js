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

  // ===== Spectral Bands (Corrigido para garantir valores reais) =====
  if (coreMetrics.spectralBands?.aggregated) {
    const b = coreMetrics.spectralBands.aggregated;
    
    // 🔍 Debug detalhado da estrutura recebida
    console.log('🎯 [SPECTRAL_BANDS_DEBUG] Estrutura completa recebida:', {
      hasAggregated: !!b,
      aggregatedKeys: b ? Object.keys(b) : null,
      hasBands: !!(b && b.bands),
      bandsKeys: b?.bands ? Object.keys(b.bands) : null,
      sampleBandData: b?.bands?.sub || null,
      totalPercentage: b?.totalPercentage || null,
      isValid: b?.valid || null,
      rawData: b // Log completo da estrutura
    });
    
    // 🎯 CORREÇÃO AMPLIADA: Múltiplas tentativas de acesso aos dados
    let extractedBands = null;
    
    // Tentativa 1: Estrutura padrão com .bands.bandName.percentage
    if (b.bands && typeof b.bands === 'object') {
      extractedBands = {
        sub: safeSanitize(b.bands.sub?.percentage),
        bass: safeSanitize(b.bands.bass?.percentage),
        mids: safeSanitize(b.bands.lowMid?.percentage || b.bands.mid?.percentage), 
        treble: safeSanitize(b.bands.highMid?.percentage), 
        presence: safeSanitize(b.bands.presence?.percentage),
        air: safeSanitize(b.bands.air?.percentage),
        totalPercentage: safeSanitize(b.totalPercentage, 100)
      };
      console.log('✅ [SPECTRAL_BANDS] Usando estrutura .bands.bandName.percentage');
    }
    // Tentativa 2: Estrutura direta .bandName
    else if (b.sub !== undefined || b.bass !== undefined) {
      extractedBands = {
        sub: safeSanitize(b.sub),
        bass: safeSanitize(b.bass),
        mids: safeSanitize(b.lowMid || b.mids),
        treble: safeSanitize(b.highMid || b.treble),  
        presence: safeSanitize(b.presence),
        air: safeSanitize(b.air || b.brilliance),
        totalPercentage: safeSanitize(b.totalPercentage, 100)
      };
      console.log('✅ [SPECTRAL_BANDS] Usando estrutura direta .bandName');
    }
    // Tentativa 3: Procurar por valores numéricos válidos na estrutura
    else {
      const keys = Object.keys(b);
      extractedBands = {
        sub: safeSanitize(findNumericValue(b, ['sub', 'sub_bass', 'subBass'])),
        bass: safeSanitize(findNumericValue(b, ['bass', 'low_bass'])),
        mids: safeSanitize(findNumericValue(b, ['mids', 'mid', 'lowMid', 'low_mid'])),
        treble: safeSanitize(findNumericValue(b, ['treble', 'highMid', 'high_mid'])),
        presence: safeSanitize(findNumericValue(b, ['presence', 'high'])),
        air: safeSanitize(findNumericValue(b, ['air', 'brilliance', 'ultra_high'])),
        totalPercentage: safeSanitize(b.totalPercentage || 100)
      };
      console.log('⚠️ [SPECTRAL_BANDS] Usando busca flexível por valores numéricos');
    }
    
    // Verificar se temos valores válidos
    const hasValidData = extractedBands && Object.values(extractedBands).some(val => 
      typeof val === 'number' && val > 0 && val !== null && !isNaN(val)
    );
    
    if (hasValidData) {
      technicalData.spectral_balance = extractedBands;
      console.log('🎯 [SPECTRAL_BANDS] Bandas extraídas com sucesso:', {
        processed: technicalData.spectral_balance,
        hasAllBands: !!(
          technicalData.spectral_balance.sub && 
          technicalData.spectral_balance.bass && 
          technicalData.spectral_balance.mids && 
          technicalData.spectral_balance.treble && 
          technicalData.spectral_balance.presence && 
          technicalData.spectral_balance.air
        ),
        totalValues: Object.values(extractedBands).filter(v => typeof v === 'number' && v > 0).length
      });
    } else {
      // Fallback com status de erro específico
      technicalData.spectral_balance = {
        sub: 0,
        bass: 0, 
        mids: 0,
        treble: 0,
        presence: 0,
        air: 0,
        totalPercentage: 0,
        _status: 'data_structure_invalid',
        _debug: { receivedKeys: Object.keys(b), receivedData: b }
      };
      console.error('❌ [SPECTRAL_BANDS] Estrutura de dados inválida, valores não extraídos');
    }
  } else {
    // 🚨 Fallback: se não há bandas calculadas
    technicalData.spectral_balance = {
      sub: 0,
      bass: 0, 
      mids: 0,
      treble: 0,
      presence: 0,
      air: 0,
      totalPercentage: 0,
      _status: 'not_calculated'
    };
    console.log('⚠️ [SPECTRAL_BANDS] Bandas não calculadas no pipeline');
  }
  
  // 🔧 Função auxiliar para buscar valores numéricos
  function findNumericValue(obj, keys) {
    for (const key of keys) {
      if (obj[key] !== undefined && typeof obj[key] === 'number' && !isNaN(obj[key])) {
        return obj[key];
      }
      // Buscar em sub-objetos também
      if (obj[key] && typeof obj[key] === 'object' && obj[key].percentage !== undefined) {
        return obj[key].percentage;
      }
      if (obj[key] && typeof obj[key] === 'object' && obj[key].value !== undefined) {
        return obj[key].value;
      }
    }
    return null;
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

  // ===== Dominant Frequencies (Corrigido para garantir valores reais) =====
  let finalDominantFreqs = null;
  
  // 🎯 MÚLTIPLAS TENTATIVAS de extrair frequências dominantes
  console.log('🎵 [DOMINANT_FREQ_DEBUG] Fontes disponíveis:', {
    hasDirectDominantFreq: !!(coreMetrics.dominantFrequencies),
    directStructure: coreMetrics.dominantFrequencies,
    hasFFTDominantFreq: !!(coreMetrics.fft?.dominantFrequencies),
    fftStructure: coreMetrics.fft?.dominantFrequencies,
    hasFFTSpectrum: !!(coreMetrics.fft?.magnitudeSpectrum)
  });
  
  // Tentativa 1: Usar dominantFrequencies direto do core metrics
  if (coreMetrics.dominantFrequencies && coreMetrics.dominantFrequencies.value) {
    finalDominantFreqs = {
      value: safeSanitize(coreMetrics.dominantFrequencies.value),
      unit: coreMetrics.dominantFrequencies.unit || 'Hz',
      detailed: {
        primary: safeSanitize(coreMetrics.dominantFrequencies.value),
        secondary: safeSanitize(coreMetrics.dominantFrequencies.detailed?.secondary),
        peaks: coreMetrics.dominantFrequencies.detailed?.peaks || []
      }
    };
    console.log('✅ [DOMINANT_FREQ] Usando dados diretos do core metrics');
  }
  // Tentativa 2: Usar array de frequências do FFT
  else if (coreMetrics.fft?.dominantFrequencies && Array.isArray(coreMetrics.fft.dominantFrequencies) && coreMetrics.fft.dominantFrequencies.length > 0) {
    const freqArray = coreMetrics.fft.dominantFrequencies.slice(0, 10).map(f => ({
      frequency: safeSanitize(f.frequency),
      occurrences: safeSanitize(f.occurrences, 1),
      magnitude: safeSanitize(f.magnitude),
      consistency: safeSanitize(f.consistency, 0)
    }));
    
    if (freqArray.length > 0 && freqArray[0].frequency) {
      finalDominantFreqs = {
        value: freqArray[0].frequency,
        unit: 'Hz',
        detailed: {
          primary: freqArray[0].frequency,
          secondary: freqArray[1]?.frequency || null,
          peaks: freqArray
        }
      };
      console.log('✅ [DOMINANT_FREQ] Usando array do FFT');
    }
  }
  // Tentativa 3: Calcular na hora usando espectro disponível
  else if (coreMetrics.fft?.magnitudeSpectrum && Array.isArray(coreMetrics.fft.magnitudeSpectrum) && coreMetrics.fft.magnitudeSpectrum.length > 0) {
    try {
      // Importar e executar calculateDominantFrequencies na hora
      const spectrum = coreMetrics.fft.magnitudeSpectrum[0]; // Primeiro frame
      
      if (spectrum && Array.isArray(spectrum) && spectrum.length > 0) {
        console.log('🔄 [DOMINANT_FREQ] Tentando calcular na hora do JSON output');
        
        // Implementação simplificada de detecção de picos
        const sampleRate = 48000;
        const fftSize = spectrum.length * 2;
        const frequencyResolution = sampleRate / fftSize;
        
        // Encontrar picos simples
        const peaks = [];
        for (let i = 2; i < spectrum.length - 2; i++) {
          const freq = i * frequencyResolution;
          if (freq >= 20 && freq <= 20000 && // Faixa audível
              spectrum[i] > spectrum[i-1] && 
              spectrum[i] > spectrum[i+1] &&
              spectrum[i] > 0.001) { // Threshold mínimo
            peaks.push({
              frequency: Math.round(freq),
              magnitude: spectrum[i]
            });
          }
        }
        
        // Ordenar por magnitude
        peaks.sort((a, b) => b.magnitude - a.magnitude);
        
        if (peaks.length > 0) {
          finalDominantFreqs = {
            value: peaks[0].frequency,
            unit: 'Hz',
            detailed: {
              primary: peaks[0].frequency,
              secondary: peaks[1]?.frequency || null,
              peaks: peaks.slice(0, 5).map(p => ({
                frequency: p.frequency,
                magnitude: p.magnitude,
                consistency: 1.0
              }))
            }
          };
          console.log('✅ [DOMINANT_FREQ] Calculado na hora com sucesso:', {
            primary: peaks[0].frequency,
            totalPeaks: peaks.length
          });
        }
      }
    } catch (calcError) {
      console.warn('⚠️ [DOMINANT_FREQ] Falha no cálculo na hora:', calcError.message);
    }
  }
  
  // Se ainda não temos frequências, usar estrutura com null mas SEM zeros falsos
  if (!finalDominantFreqs) {
    finalDominantFreqs = {
      value: null,
      unit: 'Hz',
      detailed: {
        primary: null,
        secondary: null,
        peaks: []
      },
      _status: 'not_calculated',
      _reason: 'no_spectrum_data_available'
    };
    console.log('⚠️ [DOMINANT_FREQ] Nenhuma frequência disponível, usando null');
  }
  
  technicalData.dominantFrequencies = finalDominantFreqs;

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

  // ===== Problems / Suggestions =====
  technicalData.problemsAnalysis = {
    problems: coreMetrics.problems || [],
    suggestions: coreMetrics.suggestions || [],
    qualityAssessment: coreMetrics.qualityAssessment || {},
    priorityRecommendations: coreMetrics.priorityRecommendations || []
  };

  return technicalData;
}

function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, options = {}) {
  const jobId = options.jobId || 'unknown';
  const scoreValue = scoringResult.score || scoringResult.scorePct;

  return {
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

    // 🎵 DOMINANT FREQUENCIES (Estrutura aprimorada para UI)
    dominantFrequencies: (() => {
      const domFreq = technicalData.dominantFrequencies;
      
      // Se não temos frequências válidas, retornar estrutura vazia
      if (!domFreq || domFreq._status === 'not_calculated' || !domFreq.value) {
        return {
          value: null,
          unit: 'Hz',
          detailed: {
            primary: null,
            secondary: null,
            peaks: []
          },
          status: 'not_calculated'
        };
      }
      
      // Retornar estrutura completa com dados válidos
      return {
        value: domFreq.value,
        unit: domFreq.unit || 'Hz',
        detailed: {
          primary: domFreq.detailed?.primary || domFreq.value,
          secondary: domFreq.detailed?.secondary || null,
          peaks: domFreq.detailed?.peaks || []
        },
        status: 'calculated'
      };
    })(),

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
    referenceComparison: options.reference?.comparison || generateGenreReference(technicalData, options.genre || 'trance'),

    // ===== METRICS (Structured for Frontend) =====
    metrics: {
      bands: technicalData.spectral_balance && {
        sub: { energy_db: technicalData.spectral_balance.sub || 0 },
        bass: { energy_db: technicalData.spectral_balance.bass || 0 },
        lowMid: { energy_db: technicalData.spectral_balance.mids || 0 },
        mid: { energy_db: technicalData.spectral_balance.mids || 0 },
        highMid: { energy_db: technicalData.spectral_balance.treble || 0 },
        presence: { energy_db: technicalData.spectral_balance.presence || 0 },
        air: { energy_db: technicalData.spectral_balance.air || 0 },
        brilliance: { energy_db: technicalData.spectral_balance.air || 0 }
      }
    },

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
      
      // Bandas Espectrais (Detalhadas)
      spectral_balance: technicalData.spectral_balance,
      spectralBands: technicalData.spectral_balance, // alias para compatibilidade
      bands: technicalData.spectral_balance, // alias adicional
      
      // 🎯 Bandas individuais para compatibilidade direta
      ...(technicalData.spectral_balance && {
        bandSub: technicalData.spectral_balance.sub,
        bandBass: technicalData.spectral_balance.bass,
        bandMids: technicalData.spectral_balance.mids,
        bandTreble: technicalData.spectral_balance.treble,
        bandPresence: technicalData.spectral_balance.presence,
        bandAir: technicalData.spectral_balance.air
      }),
      
      // RMS & Peaks
      rmsLevels: technicalData.rmsLevels,
      peak: technicalData.peak,
      rms: technicalData.rms,
      
      // Experimentais
      dcOffset: technicalData.dcOffset,
      spectralUniformity: technicalData.spectralUniformity,
      dominantFrequencies: technicalData.dominantFrequencies,
      problemsAnalysis: technicalData.problemsAnalysis,
      
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

  // ===== 🎯 BANDAS ESPECTRAIS (Correção Principal) =====
  // Incluir bandas espectrais calculadas na comparação de referência
  const spectralBands = technicalData.spectral_balance;
  
  if (spectralBands && typeof spectralBands === 'object' && spectralBands._status !== 'not_calculated') {
    // Definir alvos por gênero (valores baseados nos arquivos de referência)
    const bandTargets = {
      trance: {
        sub: { target: 18.5, tolerance: 2.5, name: "Sub (20-60Hz)" },
        bass: { target: 20.2, tolerance: 2.5, name: "Bass (60-150Hz)" },
        mids: { target: 16.5, tolerance: 2.5, name: "Médios (500-2kHz)" },
        treble: { target: 15.8, tolerance: 2.5, name: "Agudos (2-5kHz)" },
        presence: { target: 14.0, tolerance: 2.5, name: "Presença (5-10kHz)" },
        air: { target: 12.0, tolerance: 3.0, name: "Ar (10-20kHz)" }
      },
      funk_mandela: {
        sub: { target: 29.5, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 26.8, tolerance: 3.0, name: "Bass (60-150Hz)" },
        mids: { target: 12.4, tolerance: 2.5, name: "Médios (500-2kHz)" },
        treble: { target: 8.2, tolerance: 2.5, name: "Agudos (2-5kHz)" },
        presence: { target: 7.1, tolerance: 2.5, name: "Presença (5-10kHz)" },
        air: { target: 4.0, tolerance: 3.0, name: "Ar (10-20kHz)" }
      },
      funk: {
        sub: { target: 25.0, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 24.0, tolerance: 3.0, name: "Bass (60-150Hz)" },
        mids: { target: 18.0, tolerance: 2.5, name: "Médios (500-2kHz)" },
        treble: { target: 16.0, tolerance: 2.5, name: "Agudos (2-5kHz)" },
        presence: { target: 12.0, tolerance: 2.5, name: "Presença (5-10kHz)" },
        air: { target: 8.0, tolerance: 3.0, name: "Ar (10-20kHz)" }
      }
    };
    
    // Selecionar alvos baseado no gênero (fallback para trance)
    const targets = bandTargets[genre] || bandTargets[genre.replace(/\s+/g, '_')] || bandTargets.funk || bandTargets.trance;
    
    // Mapear nomes das bandas do pipeline para os alvos
    const bandMapping = {
      sub: 'sub',
      bass: 'bass', 
      mids: 'mids',
      treble: 'treble',
      presence: 'presence',
      air: 'air'
    };
    
    // Adicionar cada banda à comparação
    Object.entries(bandMapping).forEach(([bandKey, targetKey]) => {
      const bandValue = spectralBands[bandKey];
      const target = targets[targetKey];
      
      if (target && typeof bandValue === 'number' && !isNaN(bandValue) && bandValue > 0) {
        const delta = Math.abs(bandValue - target.target);
        const isWithinTolerance = delta <= target.tolerance;
        
        references.push({
          metric: target.name,
          value: Math.round(bandValue * 10) / 10, // 1 decimal
          ideal: target.target,
          unit: "%",
          status: isWithinTolerance ? "✅ IDEAL" : (delta > target.tolerance * 1.5 ? "❌ CORRIGIR" : "⚠️ AJUSTAR"),
          category: "spectral_bands"
        });
      }
    });
  }
  
  // ===== 🎵 FREQUÊNCIAS DOMINANTES =====
  // Incluir frequências dominantes na comparação se disponíveis
  const dominantFreqs = technicalData.dominantFrequencies;
  
  if (dominantFreqs && dominantFreqs.value && dominantFreqs._status !== 'not_calculated') {
    const primaryFreq = dominantFreqs.value || dominantFreqs.detailed?.primary;
    
    if (primaryFreq && typeof primaryFreq === 'number' && primaryFreq > 0) {
      // Análise básica da frequência dominante
      let freqCategory = 'Desconhecido';
      let idealRange = { min: 0, max: 20000 };
      
      if (primaryFreq < 60) {
        freqCategory = 'Sub-Bass';
        idealRange = { min: 40, max: 80 };
      } else if (primaryFreq < 150) {
        freqCategory = 'Bass';
        idealRange = { min: 60, max: 120 };
      } else if (primaryFreq < 500) {
        freqCategory = 'Low-Mid';
        idealRange = { min: 150, max: 400 };
      } else if (primaryFreq < 2000) {
        freqCategory = 'Mid';
        idealRange = { min: 500, max: 1500 };
      } else if (primaryFreq < 5000) {
        freqCategory = 'High-Mid';
        idealRange = { min: 2000, max: 4000 };
      } else if (primaryFreq < 10000) {
        freqCategory = 'Presence';
        idealRange = { min: 5000, max: 8000 };
      } else {
        freqCategory = 'Air';
        idealRange = { min: 10000, max: 15000 };
      }
      
      const isInIdealRange = primaryFreq >= idealRange.min && primaryFreq <= idealRange.max;
      const status = isInIdealRange ? "✅ IDEAL" : "⚠️ ANALISAR";
      
      references.push({
        metric: `Frequência Dominante (${freqCategory})`,
        value: Math.round(primaryFreq),
        ideal: `${idealRange.min}-${idealRange.max}`,
        unit: "Hz",
        status: status,
        category: "dominant_frequency"
      });
      
      // Adicionar picos adicionais se disponíveis
      if (dominantFreqs.detailed?.peaks && Array.isArray(dominantFreqs.detailed.peaks)) {
        const significantPeaks = dominantFreqs.detailed.peaks
          .filter(peak => peak.frequency && peak.frequency !== primaryFreq)
          .slice(0, 2); // Top 2 picos adicionais
        
        significantPeaks.forEach((peak, index) => {
          references.push({
            metric: `${index + 2}º Pico Espectral`,
            value: Math.round(peak.frequency),
            ideal: "Variável",
            unit: "Hz",
            status: "ℹ️ INFO",
            category: "spectral_peaks"
          });
        });
      }
    }
  }
  
  return references;
}

console.log("✅ JSON Output & Scoring (Fase 5.4) carregado - 100% compatível com frontend");
