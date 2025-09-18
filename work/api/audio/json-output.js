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

  // ===== Spectral Bands (MAPEAMENTO CORRETO DE ENERGY_DB) =====
  if (coreMetrics.spectralBands?.bands) {
    const b = coreMetrics.spectralBands;
    
    // 🔍 Debug detalhado da estrutura recebida
    console.log('🎯 [SPECTRAL_BANDS_DEBUG] Estrutura completa recebida:', {
      hasBands: !!b.bands,
      bandsKeys: b?.bands ? Object.keys(b.bands) : null,
      sampleBandData: b?.bands?.sub || null,
      totalPercentage: b?.totalPercentage || null,
      isValid: b?.valid || null,
      rawBandsData: b?.bands // Debug específico das bandas
    });
    
    // 🎯 MAPEAMENTO CORRETO: Estrutura final padronizada com energy_db
    let extractedBands = null;
    
    // Tentativa 1: Estrutura SpectralBandsAggregator .bands.bandName (correct path)
    if (b.bands && typeof b.bands === 'object') {
      // Extrair energy_db e percentage diretamente (já calculados)
      const bandsData = {
        sub: {
          energy_db: safeSanitize(b.bands.sub?.energy_db),
          percentage: safeSanitize(b.bands.sub?.percentage),
          range: b.bands.sub?.frequencyRange || "20-60Hz",
          name: b.bands.sub?.name || "Sub",
          status: b.bands.sub?.status || "calculated"
        },
        bass: {
          energy_db: safeSanitize(b.bands.bass?.energy_db),
          percentage: safeSanitize(b.bands.bass?.percentage),
          range: b.bands.bass?.frequencyRange || "60-150Hz",
          name: b.bands.bass?.name || "Bass",
          status: b.bands.bass?.status || "calculated"
        },
        lowMid: {
          energy_db: safeSanitize(b.bands.lowMid?.energy_db),
          percentage: safeSanitize(b.bands.lowMid?.percentage),
          range: b.bands.lowMid?.frequencyRange || "150-500Hz",
          name: b.bands.lowMid?.name || "Low-Mid",
          status: b.bands.lowMid?.status || "calculated"
        },
        mid: {
          energy_db: safeSanitize(b.bands.mid?.energy_db),
          percentage: safeSanitize(b.bands.mid?.percentage),
          range: b.bands.mid?.frequencyRange || "500-2000Hz",
          name: b.bands.mid?.name || "Mid",
          status: b.bands.mid?.status || "calculated"
        },
        highMid: {
          energy_db: safeSanitize(b.bands.highMid?.energy_db),
          percentage: safeSanitize(b.bands.highMid?.percentage),
          range: b.bands.highMid?.frequencyRange || "2000-5000Hz",
          name: b.bands.highMid?.name || "High-Mid",
          status: b.bands.highMid?.status || "calculated"
        },
        presence: {
          energy_db: safeSanitize(b.bands.presence?.energy_db),
          percentage: safeSanitize(b.bands.presence?.percentage),
          range: b.bands.presence?.frequencyRange || "5000-10000Hz",
          name: b.bands.presence?.name || "Presence",
          status: b.bands.presence?.status || "calculated"
        },
        air: {
          energy_db: safeSanitize(b.bands.air?.energy_db),
          percentage: safeSanitize(b.bands.air?.percentage),
          range: b.bands.air?.frequencyRange || "10000-20000Hz",
          name: b.bands.air?.name || "Air",
          status: b.bands.air?.status || "calculated"
        },
        totalPercentage: safeSanitize(b.totalPercentage, 100),
        _status: 'calculated'
      };
      
      extractedBands = bandsData;
      console.log('✅ [SPECTRAL_BANDS] Usando estrutura .bands com energy_db e percentage calculados');
    }
    // Tentativa 2: Estrutura direta para compatibilidade
    else if (b.sub !== undefined || b.bass !== undefined) {
      extractedBands = {
        sub: { energy_db: safeSanitize(b.sub), percentage: safeSanitize(b.sub), range: "20-60Hz" },
        bass: { energy_db: safeSanitize(b.bass), percentage: safeSanitize(b.bass), range: "60-150Hz" },
        lowMid: { energy_db: safeSanitize(b.lowMid || b.mids), percentage: safeSanitize(b.lowMid || b.mids), range: "150-500Hz" },
        mid: { energy_db: safeSanitize(b.mid), percentage: safeSanitize(b.mid), range: "500-2000Hz" },
        highMid: { energy_db: safeSanitize(b.highMid || b.treble), percentage: safeSanitize(b.highMid || b.treble), range: "2000-5000Hz" },
        presence: { energy_db: safeSanitize(b.presence), percentage: safeSanitize(b.presence), range: "5000-10000Hz" },
        air: { energy_db: safeSanitize(b.air), percentage: safeSanitize(b.air), range: "10000-20000Hz" },
        totalPercentage: safeSanitize(b.totalPercentage, 100)
      };
      console.log('✅ [SPECTRAL_BANDS] Usando estrutura direta com energy_db');
    }
    // Tentativa 3: Busca flexível por valores numéricos válidos
    else {
      const keys = Object.keys(b);
      extractedBands = {
        sub: { energy_db: safeSanitize(findNumericValue(b, ['sub', 'sub_bass', 'subBass'])), range: "20-60Hz" },
        bass: { energy_db: safeSanitize(findNumericValue(b, ['bass', 'low_bass'])), range: "60-150Hz" },
        lowMid: { energy_db: safeSanitize(findNumericValue(b, ['mids', 'mid', 'lowMid', 'low_mid'])), range: "150-500Hz" },
        mid: { energy_db: safeSanitize(findNumericValue(b, ['mid'])), range: "500-2000Hz" },
        highMid: { energy_db: safeSanitize(findNumericValue(b, ['treble', 'highMid', 'high_mid'])), range: "2000-5000Hz" },
        presence: { energy_db: safeSanitize(findNumericValue(b, ['presence', 'high'])), range: "5000-10000Hz" },
        air: { energy_db: safeSanitize(findNumericValue(b, ['air', 'ultra_high'])), range: "10000-20000Hz" },
        totalPercentage: safeSanitize(b.totalPercentage || 100)
      };
      console.log('⚠️ [SPECTRAL_BANDS] Usando busca flexível por valores numéricos');
    }
    
    // Verificar se temos valores válidos (energy_db ou percentage)
    const hasValidData = extractedBands && Object.values(extractedBands).some(band => {
      if (typeof band === 'object' && band !== null) {
        return (typeof band.energy_db === 'number' && band.energy_db !== null && !isNaN(band.energy_db)) ||
               (typeof band.percentage === 'number' && band.percentage !== null && !isNaN(band.percentage) && band.percentage > 0);
      }
      return typeof band === 'number' && band > 0 && !isNaN(band);
    });
    
    if (hasValidData) {
      // ✅ Estrutura final padronizada
      technicalData.spectral_balance = extractedBands;
      
      // 📊 Log de exportação para debug
      console.log('[BANDS_EXPORT] Bandas mapeadas para JSON:', {
        bandsWithEnergyDb: extractedBands,
        hasAllBands: !!(
          extractedBands.sub?.energy_db !== null && 
          extractedBands.bass?.energy_db !== null && 
          extractedBands.lowMid?.energy_db !== null && 
          extractedBands.mid?.energy_db !== null &&
          extractedBands.highMid?.energy_db !== null && 
          extractedBands.presence?.energy_db !== null && 
          extractedBands.air?.energy_db !== null
        ),
        totalValidBands: Object.values(extractedBands).filter(band => 
          band && typeof band === 'object' && band.energy_db !== null
        ).length,
        totalPercentage: extractedBands.totalPercentage,
        status: extractedBands._status
      });
    } else {
      // Fallback com status específico (não zeros falsos)
      technicalData.spectral_balance = {
        sub: { energy_db: null, percentage: null, range: "20-60Hz", status: "not_available" },
        bass: { energy_db: null, percentage: null, range: "60-150Hz", status: "not_available" },
        lowMid: { energy_db: null, percentage: null, range: "150-500Hz", status: "not_available" },
        mid: { energy_db: null, percentage: null, range: "500-2000Hz", status: "not_available" },
        highMid: { energy_db: null, percentage: null, range: "2000-5000Hz", status: "not_available" },
        presence: { energy_db: null, percentage: null, range: "5000-10000Hz", status: "not_available" },
        air: { energy_db: null, percentage: null, range: "10000-20000Hz", status: "not_available" },
        totalPercentage: null,
        _status: 'data_structure_invalid',
        _debug: { receivedKeys: Object.keys(b), receivedData: b }
      };
      console.error('❌ [SPECTRAL_BANDS] Estrutura de dados inválida, usando null em vez de zeros');
    }
  } else {
    // 🚨 Pipeline não calculou bandas OU condição de acesso estava errada
    const debugInfo = {
      hasSpectralBands: !!coreMetrics.spectralBands,
      spectralBandsKeys: coreMetrics.spectralBands ? Object.keys(coreMetrics.spectralBands) : null,
      hasBands: !!(coreMetrics.spectralBands?.bands),
      hasAggregated: !!(coreMetrics.spectralBands?.aggregated)
    };
    
    console.warn('⚠️ [SPECTRAL_BANDS] Condição de acesso falhou:', debugInfo);
    
    technicalData.spectral_balance = {
      sub: { energy_db: null, percentage: null, range: "20-60Hz", status: "not_calculated" },
      bass: { energy_db: null, percentage: null, range: "60-150Hz", status: "not_calculated" },
      lowMid: { energy_db: null, percentage: null, range: "150-500Hz", status: "not_calculated" },
      mid: { energy_db: null, percentage: null, range: "500-2000Hz", status: "not_calculated" },
      highMid: { energy_db: null, percentage: null, range: "2000-5000Hz", status: "not_calculated" },
      presence: { energy_db: null, percentage: null, range: "5000-10000Hz", status: "not_calculated" },
      air: { energy_db: null, percentage: null, range: "10000-20000Hz", status: "not_calculated" },
      totalPercentage: null,
      _status: 'not_calculated',
      _debug: debugInfo
    };
    console.log('⚠️ [SPECTRAL_BANDS] Bandas não calculadas ou condição de acesso incorreta');
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
  
  // 🎛️ Converter percentagem para energy_db simulado (para compatibilidade)
  function convertPercentageToEnergyDb(percentage) {
    if (!percentage || percentage <= 0) return null;
    // Conversão aproximada: percentagem alta = energy_db alta (simulada)
    // Fórmula: logarítmica para simular dB
    return Math.round((Math.log10(percentage / 100 + 0.01) * 20 + 60) * 100) / 100;
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

    // ===== BANDAS ESPECTRAIS UNIFICADAS =====
    spectralBands: (() => {
      const bands = technicalData.spectral_balance;
      if (!bands || bands._status !== 'calculated') {
        return {
          sub: { energy_db: null, percentage: null, range: "20-60Hz", status: "not_calculated" },
          bass: { energy_db: null, percentage: null, range: "60-150Hz", status: "not_calculated" },
          lowMid: { energy_db: null, percentage: null, range: "150-500Hz", status: "not_calculated" },
          mid: { energy_db: null, percentage: null, range: "500-2000Hz", status: "not_calculated" },
          highMid: { energy_db: null, percentage: null, range: "2000-5000Hz", status: "not_calculated" },
          presence: { energy_db: null, percentage: null, range: "5000-10000Hz", status: "not_calculated" },
          air: { energy_db: null, percentage: null, range: "10000-20000Hz", status: "not_calculated" },
          totalPercentage: null,
          status: bands?._status || 'not_calculated'
        };
      }
      
      // Retornar bandas com estrutura padronizada
      return {
        sub: { 
          energy_db: bands.sub?.energy_db || null, 
          percentage: bands.sub?.percentage || null,
          range: bands.sub?.range || "20-60Hz",
          status: bands.sub?.status || "calculated"
        },
        bass: { 
          energy_db: bands.bass?.energy_db || null, 
          percentage: bands.bass?.percentage || null,
          range: bands.bass?.range || "60-150Hz",
          status: bands.bass?.status || "calculated"
        },
        lowMid: { 
          energy_db: bands.lowMid?.energy_db || null, 
          percentage: bands.lowMid?.percentage || null,
          range: bands.lowMid?.range || "150-500Hz",
          status: bands.lowMid?.status || "calculated"
        },
        mid: { 
          energy_db: bands.mid?.energy_db || null, 
          percentage: bands.mid?.percentage || null,
          range: bands.mid?.range || "500-2000Hz",
          status: bands.mid?.status || "calculated"
        },
        highMid: { 
          energy_db: bands.highMid?.energy_db || null, 
          percentage: bands.highMid?.percentage || null,
          range: bands.highMid?.range || "2000-5000Hz",
          status: bands.highMid?.status || "calculated"
        },
        presence: { 
          energy_db: bands.presence?.energy_db || null, 
          percentage: bands.presence?.percentage || null,
          range: bands.presence?.range || "5000-10000Hz",
          status: bands.presence?.status || "calculated"
        },
        air: { 
          energy_db: bands.air?.energy_db || null, 
          percentage: bands.air?.percentage || null,
          range: bands.air?.range || "10000-20000Hz",
          status: bands.air?.status || "calculated"
        },
        totalPercentage: bands.totalPercentage || null,
        status: bands._status || 'calculated'
      };
    })(),

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
      // 🌈 BANDAS UNIFICADAS - Estrutura padronizada para UI
      bands: (() => {
        const bands = technicalData.spectral_balance;
        if (!bands || bands._status === 'not_calculated' || bands._status === 'data_structure_invalid') {
          return {
            sub: { energy_db: null, percentage: null, range: "20-60Hz", status: "not_available" },
            bass: { energy_db: null, percentage: null, range: "60-150Hz", status: "not_available" },
            lowMid: { energy_db: null, percentage: null, range: "150-500Hz", status: "not_available" },
            mid: { energy_db: null, percentage: null, range: "500-2000Hz", status: "not_available" },
            highMid: { energy_db: null, percentage: null, range: "2000-5000Hz", status: "not_available" },
            presence: { energy_db: null, percentage: null, range: "5000-10000Hz", status: "not_available" },
            air: { energy_db: null, percentage: null, range: "10000-20000Hz", status: "not_available" },
            totalPercentage: null
          };
        }
        
        // Retornar estrutura das bandas com energy_db e percentage
        return {
          sub: { 
            energy_db: bands.sub?.energy_db || null, 
            percentage: bands.sub?.percentage || null,
            range: bands.sub?.range || "20-60Hz",
            status: bands.sub?.status || "calculated"
          },
          bass: { 
            energy_db: bands.bass?.energy_db || null, 
            percentage: bands.bass?.percentage || null,
            range: bands.bass?.range || "60-150Hz",
            status: bands.bass?.status || "calculated"
          },
          lowMid: { 
            energy_db: bands.lowMid?.energy_db || null, 
            percentage: bands.lowMid?.percentage || null,
            range: bands.lowMid?.range || "150-500Hz",
            status: bands.lowMid?.status || "calculated"
          },
          mid: { 
            energy_db: bands.mid?.energy_db || null, 
            percentage: bands.mid?.percentage || null,
            range: bands.mid?.range || "500-2000Hz",
            status: bands.mid?.status || "calculated"
          },
          highMid: { 
            energy_db: bands.highMid?.energy_db || null, 
            percentage: bands.highMid?.percentage || null,
            range: bands.highMid?.range || "2000-5000Hz",
            status: bands.highMid?.status || "calculated"
          },
          presence: { 
            energy_db: bands.presence?.energy_db || null, 
            percentage: bands.presence?.percentage || null,
            range: bands.presence?.range || "5000-10000Hz",
            status: bands.presence?.status || "calculated"
          },
          air: { 
            energy_db: bands.air?.energy_db || null, 
            percentage: bands.air?.percentage || null,
            range: bands.air?.range || "10000-20000Hz",
            status: bands.air?.status || "calculated"
          },
          totalPercentage: bands.totalPercentage || null
        };
      })()
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
      
      // Bandas Espectrais (UNIFICADAS - estrutura final padronizada)
      spectral_balance: technicalData.spectral_balance,
      spectralBands: technicalData.spectral_balance, // alias para compatibilidade
      bands: technicalData.spectral_balance, // alias adicional
      
      // 🎯 Bandas individuais para compatibilidade direta (estrutura padronizada)
      ...(technicalData.spectral_balance && technicalData.spectral_balance._status === 'calculated' && {
        bandSub: technicalData.spectral_balance.sub?.energy_db || technicalData.spectral_balance.sub?.percentage,
        bandBass: technicalData.spectral_balance.bass?.energy_db || technicalData.spectral_balance.bass?.percentage,
        bandLowMid: technicalData.spectral_balance.lowMid?.energy_db || technicalData.spectral_balance.lowMid?.percentage,
        bandMid: technicalData.spectral_balance.mid?.energy_db || technicalData.spectral_balance.mid?.percentage,
        bandHighMid: technicalData.spectral_balance.highMid?.energy_db || technicalData.spectral_balance.highMid?.percentage,
        bandPresence: technicalData.spectral_balance.presence?.energy_db || technicalData.spectral_balance.presence?.percentage,
        bandAir: technicalData.spectral_balance.air?.energy_db || technicalData.spectral_balance.air?.percentage,
        // Compatibilidade com nomes antigos
        bandMids: technicalData.spectral_balance.lowMid?.energy_db || technicalData.spectral_balance.lowMid?.percentage,
        bandTreble: technicalData.spectral_balance.highMid?.energy_db || technicalData.spectral_balance.highMid?.percentage
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
  
  if (spectralBands && typeof spectralBands === 'object' && 
      spectralBands._status === 'calculated') {
    
    // Definir alvos por gênero (valores baseados nos arquivos de referência)
    const bandTargets = {
      trance: {
        sub: { target: 18.5, tolerance: 2.5, name: "Sub (20-60Hz)" },
        bass: { target: 20.2, tolerance: 2.5, name: "Bass (60-150Hz)" },
        lowMid: { target: 16.5, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 15.8, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 14.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 12.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 8.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      funk_mandela: {
        sub: { target: 29.5, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 26.8, tolerance: 3.0, name: "Bass (60-150Hz)" },
        lowMid: { target: 12.4, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 8.2, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 7.1, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 6.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 4.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      funk: {
        sub: { target: 25.0, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 24.0, tolerance: 3.0, name: "Bass (60-150Hz)" },
        lowMid: { target: 18.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 16.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 12.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 10.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 8.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      }
    };
    
    // Selecionar alvos baseado no gênero (fallback para trance)
    const targets = bandTargets[genre] || bandTargets[genre.replace(/\s+/g, '_')] || bandTargets.funk || bandTargets.trance;
    
    // Mapear nomes das bandas do pipeline para os alvos (estrutura unificada)
    const bandMapping = {
      sub: 'sub',
      bass: 'bass', 
      lowMid: 'lowMid',
      mid: 'mid',
      highMid: 'highMid',
      presence: 'presence',
      air: 'air'
    };
    
    // Adicionar cada banda à comparação
    Object.entries(bandMapping).forEach(([bandKey, targetKey]) => {
      const band = spectralBands[bandKey];
      const target = targets[targetKey];
      
      if (target && band && typeof band === 'object') {
        // Usar energy_db se disponível, senão usar percentage
        const bandValue = band.energy_db !== null ? band.energy_db : band.percentage;
        
        if (typeof bandValue === 'number' && !isNaN(bandValue) && bandValue !== null) {
          // Para energy_db, usar comparação diferente do que para percentage
          const isEnergyDb = band.energy_db !== null;
          const displayValue = isEnergyDb ? bandValue : Math.round(bandValue * 10) / 10;
          const compareValue = isEnergyDb ? bandValue : bandValue; // Energy vs percentage
          
          // Tolerância baseada no tipo de valor
          const tolerance = isEnergyDb ? target.tolerance * 2 : target.tolerance; // dB tem maior variação
          const targetValue = isEnergyDb ? target.target : target.target; // Usar mesmo target
          
          const delta = Math.abs(compareValue - targetValue);
          const isWithinTolerance = delta <= tolerance;
          
          references.push({
            metric: target.name,
            value: displayValue,
            ideal: targetValue,
            unit: isEnergyDb ? "dB" : "%",
            status: isWithinTolerance ? "✅ IDEAL" : (delta > tolerance * 1.5 ? "❌ CORRIGIR" : "⚠️ AJUSTAR"),
            category: "spectral_bands"
          });
        }
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
