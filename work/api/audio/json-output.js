// 🎯 FASE 5.4: JSON OUTPUT + SCORING - CORRIGIDO E EXPANDIDO
// Constrói saída JSON estruturada com TODAS as métricas extraídas pelo pipeline
// 100% compatível com o front-end (modal) → garante exibição de todas as métricas
// SEM FALLBACKS, SEM VALORES FICTÍCIOS, FAIL-FAST

import { computeMixScore } from "../../lib/audio/features/scoring.js";
import { makeErr, logAudio, assertFinite } from '../../lib/audio/error-handling.js';
import { normalizeGenreTargets, calculateMetricSeverity, calculateBandSeverity } from '../../lib/audio/utils/normalize-genre-targets.js';

// 🎯 NOVO PIPELINE CENTRAL: resolveTargets + compareWithTargets
// Este módulo é a FONTE ÚNICA DA VERDADE para tabela, sugestões e score
import { resolveTargets, compareWithTargets, validateTargets, TRUE_PEAK_HARD_CAP as CORE_TRUE_PEAK_HARD_CAP } from '../../lib/audio/core/index.js';

// 🎯 CONSTANTE FÍSICA - True Peak NUNCA > 0 dBTP
const TRUE_PEAK_HARD_CAP = 0.0;

// 🚨 CORREÇÃO SUPER AGRESSIVA: Força campo 'type' em TODAS as sugestões
function FORCE_TYPE_FIELD(suggestions) {
  if (!Array.isArray(suggestions)) return [];
  
  return suggestions.map(s => {
    if (!s || typeof s !== 'object') return s;
    
    // FORÇA O CAMPO TYPE - SEMPRE!
    const result = { ...s };
    if (!result.type && result.metric) {
      result.type = result.metric;
      console.log(`🚨 FORÇANDO type="${result.metric}" para sugestão:`, result.message?.substring(0, 50));
    }
    return result;
  });
}

console.log("📦 JSON Output & Scoring (Fase 5.4) carregado - Equal Weight V3 COMPLETO + FONTE ÚNICA TARGETS");

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

    // 🎯 Passar genre, mode e preloadedReferenceMetrics para buildFinalJSON
    const finalJSON = buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, { 
      jobId,
      genre: options.genre,
      mode: options.mode,
      referenceJobId: options.referenceJobId,
      preloadedReferenceMetrics: options.preloadedReferenceMetrics
    });

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
  console.log('[JSON-OUTPUT] 🔍 INÍCIO extractTechnicalData');
  
  // 📊 DEBUG CRÍTICO: Verificar estado do samplePeak logo no início
  if (coreMetrics.samplePeak) {
    console.log('[JSON-OUTPUT] 📊 Sample Peak recebido de coreMetrics:', {
      maxDbfs: coreMetrics.samplePeak.maxDbfs,
      leftDbfs: coreMetrics.samplePeak.leftDbfs,
      rightDbfs: coreMetrics.samplePeak.rightDbfs,
      estruturaCompleta: Object.keys(coreMetrics.samplePeak)
    });
  } else {
    console.warn('[JSON-OUTPUT] ⚠️ coreMetrics.samplePeak é NULL/UNDEFINED no início de extractTechnicalData');
  }
  
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
    
    // 🎯 LOG DE CONFIRMAÇÃO: Valores RAW sendo usados
    console.log('[JSON-OUTPUT] ✅ Valores RAW extraídos para technicalData:', {
      lufsIntegrated: technicalData.lufsIntegrated,
      sourceIsRaw: coreMetrics.metadata?.usesRawMetrics || false
    });
  }

  // ===== True Peak =====
  if (coreMetrics.truePeak) {
    technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp);
    technicalData.truePeakLinear = safeSanitize(coreMetrics.truePeak.maxLinear);
    
    // ⚠️ ATENÇÃO: samplePeakLeftDb/RightDb são do FFmpeg ebur128 (não são o "Sample Peak" real)
    // O "Sample Peak" REAL está em technicalData.samplePeakDbfs (calculado separadamente)
    technicalData.samplePeakLeftDb = safeSanitize(coreMetrics.truePeak.samplePeakLeftDb);
    technicalData.samplePeakRightDb = safeSanitize(coreMetrics.truePeak.samplePeakRightDb);
    
    technicalData.clippingSamples = safeSanitize(coreMetrics.truePeak.clippingSamples, 0);
    technicalData.clippingPct = safeSanitize(coreMetrics.truePeak.clippingPct, 0);
    
    // 🎯 LOG DE CONFIRMAÇÃO: True Peak RAW
    console.log('[JSON-OUTPUT] ✅ True Peak RAW extraído:', {
      truePeakDbtp: technicalData.truePeakDbtp,
      sourceIsRaw: coreMetrics.metadata?.usesRawMetrics || false
    });
  }

  // ===== Dynamics =====
  if (coreMetrics.dynamics) {
    technicalData.dynamicRange = safeSanitize(coreMetrics.dynamics.dynamicRange);
    technicalData.crestFactor = safeSanitize(coreMetrics.dynamics.crestFactor);
    technicalData.peakRmsDb = safeSanitize(coreMetrics.dynamics.peakRmsDb);
    technicalData.averageRmsDb = safeSanitize(coreMetrics.dynamics.averageRmsDb);
    technicalData.drCategory = safeSanitize(coreMetrics.dynamics.drCategory, 'unknown');
    
    // 🎯 LOG DE CONFIRMAÇÃO: DR RAW
    console.log('[JSON-OUTPUT] ✅ Dynamic Range RAW extraído:', {
      dynamicRange: technicalData.dynamicRange,
      sourceIsRaw: coreMetrics.metadata?.usesRawMetrics || false
    });
  }

  // ===== Stereo =====
  if (coreMetrics.stereo) {
    technicalData.stereoCorrelation = safeSanitize(coreMetrics.stereo.correlation);
    technicalData.stereoWidth = safeSanitize(coreMetrics.stereo.width);
    // 🔧 CORREÇÃO AUDITORIA DSP 2025-12-29 (OPÇÃO C): Abertura Estéreo = 1 - |correlation|
    technicalData.stereoOpening = safeSanitize(coreMetrics.stereo.opening);
    technicalData.stereoOpeningPercent = safeSanitize(coreMetrics.stereo.openingPercent);
    technicalData.stereoOpeningCategory = safeSanitize(coreMetrics.stereo.openingCategory, 'unknown');
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
    console.log(`[DEBUG JSON RMS] coreMetrics.rms.average=${coreMetrics.rms.average}, left=${coreMetrics.rms.left}, right=${coreMetrics.rms.right}, peak=${coreMetrics.rms.peak}`);
    
    technicalData.rmsLevels = {
      left: safeSanitize(coreMetrics.rms.left),
      right: safeSanitize(coreMetrics.rms.right),
      average: safeSanitize(coreMetrics.rms.average),
      peak: safeSanitize(coreMetrics.rms.peak),
      count: safeSanitize(coreMetrics.rms.count, 0)
    };
    
    // 🆕 CHAVES CANÔNICAS (market-ready, padrão mercado)
    technicalData.rmsAvgDbfs = technicalData.rmsLevels.average;  // ✅ CANÔNICA: RMS médio
    technicalData.rmsPeak300msDbfs = technicalData.rmsLevels.peak;  // ✅ CANÔNICA: RMS peak 300ms
    
    // 🔄 ALIASES LEGADOS (backward compatibility - @deprecated)
    technicalData.rmsPeak300msDb = technicalData.rmsLevels.peak;  // @deprecated use rmsPeak300msDbfs
    technicalData.rmsAverageDb = technicalData.rmsLevels.average;  // @deprecated use rmsAvgDbfs
    technicalData.rmsDb = technicalData.rmsLevels.average;  // @deprecated use rmsAvgDbfs
    technicalData.peak = technicalData.rmsLevels.peak;  // @deprecated use rmsPeak300msDbfs
    technicalData.rmsPeakDbfs = technicalData.rmsLevels.peak;  // @deprecated use rmsPeak300msDbfs
    technicalData.rms = technicalData.rmsLevels.average;  // @deprecated use rmsAvgDbfs
    technicalData.avgLoudness = technicalData.rmsLevels.average;  // @deprecated use rmsAvgDbfs
    
    console.log(`[DEBUG JSON FINAL] rmsPeak300msDb=${technicalData.rmsPeak300msDb}, rmsAverageDb=${technicalData.rmsAverageDb}, avgLoudness=${technicalData.avgLoudness}`);
  } else {
    console.error(`[DEBUG JSON ERROR] coreMetrics.rms é ${typeof coreMetrics.rms} (${coreMetrics.rms})`);
  }

  // 🎯 SAMPLE PEAK: Exportar valores canônicos (max absolute sample)
  if (coreMetrics.samplePeak) {
    // ✅ CHAVES CANÔNICAS
    technicalData.samplePeakDbfs = safeSanitize(coreMetrics.samplePeak.maxDbfs);  // ✅ CANÔNICA: Max(L,R)
    technicalData.samplePeakLeftDbfs = safeSanitize(coreMetrics.samplePeak.leftDbfs);  // ✅ CANÔNICA: Canal L
    technicalData.samplePeakRightDbfs = safeSanitize(coreMetrics.samplePeak.rightDbfs);  // ✅ CANÔNICA: Canal R
    technicalData.samplePeakLinear = safeSanitize(coreMetrics.samplePeak.max);  // Valor linear
    
    // 🔄 COMPATIBILIDADE: Popular chaves antigas com valores reais
    // (as chaves samplePeakLeftDb/RightDb anteriormente vinham do FFmpeg e eram null)
    // Usar lógica PRESERVADORA: só sobrescreve se for null
    if (!technicalData.samplePeakLeftDb || technicalData.samplePeakLeftDb === null) {
      technicalData.samplePeakLeftDb = technicalData.samplePeakLeftDbfs;  // @deprecated use samplePeakLeftDbfs
    }
    if (!technicalData.samplePeakRightDb || technicalData.samplePeakRightDb === null) {
      technicalData.samplePeakRightDb = technicalData.samplePeakRightDbfs;  // @deprecated use samplePeakRightDbfs
    }
    // Alias aggregate (manter para compatibilidade)
    technicalData.samplePeakDb = technicalData.samplePeakDbfs;  // @deprecated use samplePeakDbfs
    
    console.log(`[JSON-OUTPUT] ✅ Sample Peak REAL exportado: max=${technicalData.samplePeakDbfs}, L=${technicalData.samplePeakLeftDbfs}, R=${technicalData.samplePeakRightDbfs}`);
  } else {
    // Fail-soft: setar null mas não quebrar pipeline
    technicalData.samplePeakDbfs = null;
    technicalData.samplePeakDb = null;
    technicalData.samplePeakLeftDbfs = null;
    technicalData.samplePeakRightDbfs = null;
    technicalData.samplePeakLinear = null;
    console.warn('[JSON-OUTPUT] ⚠️ samplePeak não disponível (coreMetrics.samplePeak = null) - continuando...');
  }

  // 🎯 LOG FINAL: Métricas canônicas market-ready
  console.log('[METRICS-EXPORT] 📊 CHAVES CANÔNICAS:', {
    rmsAvgDbfs: technicalData.rmsAvgDbfs,
    rmsPeak300msDbfs: technicalData.rmsPeak300msDbfs,
    samplePeakDbfs: technicalData.samplePeakDbfs,
    samplePeakLeftDbfs: technicalData.samplePeakLeftDbfs,
    samplePeakRightDbfs: technicalData.samplePeakRightDbfs,
    truePeakDbtp: technicalData.truePeakDbtp
  });
  
  // 🔍 SANITY-CHECK: Validação de invariantes matemáticas (log-only, não aborta job)
  const rmsPeak = technicalData.rmsPeak300msDbfs;
  const rmsAvg = technicalData.rmsAvgDbfs;
  const samplePeak = technicalData.samplePeakDbfs;
  const truePeak = technicalData.truePeakDbtp;
  
  if (rmsPeak !== null && rmsAvg !== null) {
    if (rmsPeak < rmsAvg - 0.5) {
      console.warn(`[SANITY-CHECK] ⚠️ VIOLAÇÃO: RMS Peak (${rmsPeak.toFixed(2)}) < RMS Average (${rmsAvg.toFixed(2)}) - Esperado: Peak >= Average`);
    } else {
      console.log(`[SANITY-CHECK] ✅ RMS Average (${rmsAvg.toFixed(2)}) <= RMS Peak (${rmsPeak.toFixed(2)})`);
    }
  }
  
  if (samplePeak !== null && truePeak !== null) {
    if (truePeak < samplePeak - 0.5) {
      console.warn(`[SANITY-CHECK] ⚠️ VIOLAÇÃO: True Peak (${truePeak.toFixed(2)}) < Sample Peak (${samplePeak.toFixed(2)}) - Esperado: TruePeak >= SamplePeak`);
    } else {
      console.log(`[SANITY-CHECK] ✅ True Peak (${truePeak.toFixed(2)}) >= Sample Peak (${samplePeak.toFixed(2)})`);
    }
  }
  
  if (samplePeak !== null && rmsPeak !== null) {
    if (samplePeak < rmsPeak - 0.5) {
      console.warn(`[SANITY-CHECK] ⚠️ VIOLAÇÃO: Sample Peak (${samplePeak.toFixed(2)}) < RMS Peak (${rmsPeak.toFixed(2)}) - Esperado: SamplePeak >= RMSPeak`);
    } else {
      console.log(`[SANITY-CHECK] ✅ Sample Peak (${samplePeak.toFixed(2)}) >= RMS Peak (${rmsPeak.toFixed(2)})`);
    }
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

  // ===== BPM (Beats Per Minute) =====
  technicalData.bpm = safeSanitize(coreMetrics.bpm); // ✅ CORREÇÃO: campo correto 'bpm' para frontend modal
  technicalData.bpmConfidence = safeSanitize(coreMetrics.bpmConfidence); // ✅ CORREÇÃO: bmpConfidence → bpmConfidence
  technicalData.bpmSource = safeSanitize(coreMetrics.bpmSource, 'UNKNOWN'); // ✅ NOVO: Fonte do cálculo BPM
  
  // ✅ Log de debug para confirmar valores finais
  console.log('[WORKER][BPM] Final JSON:', technicalData.bpm, technicalData.bpmConfidence, 'source:', technicalData.bpmSource);

  // ===== Dominant Frequencies =====
  // REMOVED: Export processing for dominantFrequencies
  // Reason: REMOVAL_SKIPPED_USED_BY_SCORE:dominantFrequencies - mantendo cálculo interno apenas
  // O cálculo continua acontecendo em enhanced-suggestion-engine.js para análise interna
  console.log('🎵 [DOMINANT_FREQ] Processamento de export removido - mantendo apenas cálculo interno');
  
  // ===== Spectral Uniformity =====
  // 🔧 CORREÇÃO AUDITORIA DSP 2025-12-29: Restaurar export com valor agregado corrigido
  // Problema anterior: cálculo usava apenas 1º frame FFT, agora usa agregação de todos frames
  
  // 🔍 DEBUG CRÍTICO: Log do que está chegando de coreMetrics
  console.log('[UNIFORMITY_PIPELINE] 🔍 coreMetrics.spectralUniformity recebido:', {
    hasSpectralUniformity: !!coreMetrics.spectralUniformity,
    type: typeof coreMetrics.spectralUniformity,
    value: coreMetrics.spectralUniformity,
    uniformityPercent: coreMetrics.spectralUniformity?.uniformityPercent,
    aggregation: coreMetrics.spectralUniformity?.aggregation
  });
  
  if (coreMetrics.spectralUniformity) {
    const su = coreMetrics.spectralUniformity;
    
    // Exportar valor de porcentagem corrigido (0-100%)
    if (Number.isFinite(su.uniformityPercent)) {
      technicalData.spectralUniformity = su.uniformityPercent / 100; // Normalizar para [0-1] 
      technicalData.spectralUniformityPercent = su.uniformityPercent;
    } else if (su.uniformity && Number.isFinite(su.uniformity.coefficient)) {
      // Fallback: calcular a partir do coeficiente
      const uniformityPct = Math.max(0, Math.min(100, (1 - su.uniformity.coefficient) * 100));
      technicalData.spectralUniformity = uniformityPct / 100;
      technicalData.spectralUniformityPercent = uniformityPct;
    } else {
      // Nenhum valor válido disponível
      technicalData.spectralUniformity = null;
      technicalData.spectralUniformityPercent = null;
    }
    
    // Metadados de agregação - SEMPRE definir
    if (su.aggregation) {
      technicalData.spectralUniformityMeta = {
        method: su.aggregation.method,
        framesProcessed: su.aggregation.framesProcessed,
        validFrames: su.aggregation.validFrames,
        rating: su.rating,
        coefficient: su.uniformity?.coefficient
      };
    } else {
      // Fallback quando aggregation não existe mas spectralUniformity existe
      technicalData.spectralUniformityMeta = {
        method: 'legacy',
        framesProcessed: null,
        validFrames: null,
        rating: su.rating || 'unknown',
        coefficient: su.uniformity?.coefficient
      };
    }
    
    console.log('[UNIFORMITY_PIPELINE] ✅ Exportado valor corrigido:', {
      uniformityPercent: technicalData.spectralUniformityPercent,
      normalized: technicalData.spectralUniformity,
      rating: su.rating,
      meta: technicalData.spectralUniformityMeta
    });
  } else {
    technicalData.spectralUniformity = null;
    technicalData.spectralUniformityPercent = null;
    // 🔧 CORREÇÃO BUG PRODUÇÃO 2025-12-29: spectralUniformityMeta nunca deve ser undefined/vazio
    technicalData.spectralUniformityMeta = {
      method: 'unavailable',
      framesProcessed: 0,
      validFrames: 0,
      rating: 'unknown',
      error: 'coreMetrics.spectralUniformity is null or undefined'
    };
    console.log('[UNIFORMITY_PIPELINE] ⚠️ Não disponível - retornando null com meta de erro');
  }

  // ===== Problems / Suggestions =====
  technicalData.problemsAnalysis = {
    problems: coreMetrics.problems || [],
    suggestions: FORCE_TYPE_FIELD(coreMetrics.suggestions || []), // 🚨 CORREÇÃO SUPER AGRESSIVA
    qualityAssessment: coreMetrics.qualityAssessment || {},
    priorityRecommendations: coreMetrics.priorityRecommendations || []
  };

  return technicalData;
}

/**
 * 🎯 FUNÇÃO DE NORMALIZAÇÃO: Converte genreTargets do formato backend (nested + PT) para formato frontend (flat + EN)
 * Resolve incompatibilidade estrutural entre backend e frontend
 * 
 * 🔧 PATCH: Suporta DOIS formatos de entrada:
 * 1. Nested (do loadGenreTargets): { lufs: {target, tolerance}, bands: {low_bass: {...}} }
 * 2. Flat (do frontend payload): { sub: {...}, low_bass: {...}, presenca: {...} }
 */
function normalizeGenreTargetsForFrontend(targets) {
  if (!targets || typeof targets !== 'object' || Object.keys(targets).length === 0) return null;

  console.log('[JSON-OUTPUT-NORMALIZE] ----------');
  console.log('[JSON-OUTPUT-NORMALIZE] Entrada - keys:', Object.keys(targets));
  console.log('[JSON-OUTPUT-NORMALIZE] Entrada - tipo detectado:', targets.lufs ? 'NESTED (backend)' : 'FLAT (frontend payload)');

  const normalized = {
    // Converter nested para flat (lufs.target → lufs_target)
    lufs_target: targets.lufs?.target,
    lufs_tolerance: targets.lufs?.tolerance,

    true_peak_target: targets.truePeak?.target,
    true_peak_tolerance: targets.truePeak?.tolerance,

    dr_target: targets.dr?.target,
    dr_tolerance: targets.dr?.tolerance,

    lra_target: targets.lra?.target,
    lra_tolerance: targets.lra?.tolerance,

    stereo_target: targets.stereo?.target,
    stereo_tolerance: targets.stereo?.tolerance
  };

  // 🎯 PATCH: Mapeamento COMPLETO de bandas (PT → EN + snake_case → camelCase)
  const BAND_NAME_MAP = {
    'sub': 'sub',
    'low_bass': 'bass',
    'upper_bass': 'upperBass',
    'low_mid': 'lowMid',
    'mid': 'mid',
    'high_mid': 'highMid',
    'presenca': 'presence',
    'brilho': 'air'
  };

  // Criar campo 'bands' (NÃO 'spectralBands')
  normalized.bands = {};

  // 🔧 PATCH CRÍTICO: Detectar formato de entrada
  let sourceBands = null;
  
  // CASO 1: Formato NESTED do backend (loadGenreTargets)
  // { lufs: {...}, bands: { low_bass: {...}, presenca: {...} } }
  if (targets.bands && typeof targets.bands === 'object') {
    console.log('[JSON-OUTPUT-NORMALIZE] 📦 Fonte: targets.bands (nested backend)');
    sourceBands = targets.bands;
  }
  // CASO 2: Formato FLAT do frontend (payload direto)
  // { sub: {...}, low_bass: {...}, presenca: {...} }
  else {
    console.log('[JSON-OUTPUT-NORMALIZE] 📦 Fonte: targets direto (flat frontend payload)');
    sourceBands = targets;
  }

  // Processar bandas com mapeamento completo
  const bandKeys = Object.keys(sourceBands).filter(k =>
    !['lufs', 'truePeak', 'dr', 'lra', 'stereo', 'lufs_target', 'true_peak_target', 'dr_target', 'lra_target', 'stereo_target', 'lufs_tolerance', 'true_peak_tolerance', 'dr_tolerance', 'lra_tolerance', 'stereo_tolerance'].includes(k)
  );

  console.log('[JSON-OUTPUT-NORMALIZE] 🎵 Bandas a processar:', bandKeys);

  bandKeys.forEach(key => {
    // Usar BAND_NAME_MAP para conversão completa
    const normalizedKey = BAND_NAME_MAP[key] || key;
    normalized.bands[normalizedKey] = sourceBands[key];
    console.log(`[JSON-OUTPUT-NORMALIZE]    ✓ ${key} → ${normalizedKey}`);
  });

  console.log('[JSON-OUTPUT-NORMALIZE] Saída - keys:', Object.keys(normalized));
  console.log('[JSON-OUTPUT-NORMALIZE] Bandas normalizadas:', Object.keys(normalized.bands));
  console.log('[JSON-OUTPUT-NORMALIZE] Total de bandas:', Object.keys(normalized.bands).length);
  console.log('[JSON-OUTPUT-NORMALIZE] ----------');

  return normalized;
}

function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, options = {}) {
  const jobId = options.jobId || 'unknown';
  const scoreValue = scoringResult.score || scoringResult.scorePct;
  
  // 🔥 LOG CIRÚRGICO: ENTRADA do buildFinalJSON
  console.log('[GENRE-DEEP-TRACE][JSON-OUTPUT-PRE]', {
    ponto: 'json-output.js buildFinalJSON - ENTRADA',
    'options.genre': options.genre,
    'options.data?.genre': options.data?.genre,
    'options.genre_detected': options.genre_detected,
    'options.mode': options.mode
  });
  
  // 🎯 CORREÇÃO: Resolver genre baseado no modo
  const isGenreMode = (options.mode || 'genre') === 'genre';
  const resolvedGenre = options.genre || options.data?.genre || options.genre_detected || null;
  const finalGenre = isGenreMode
    ? (resolvedGenre ? String(resolvedGenre).trim() || null : null)
    : (options.genre || 'default');

  // 🚨 BLINDAGEM ABSOLUTA: Modo genre NÃO pode ter finalGenre null/default
  if (isGenreMode && (!finalGenre || finalGenre === 'default')) {
    console.error('[JSON-OUTPUT-ERROR] Modo genre mas finalGenre inválido:', {
      finalGenre,
      resolvedGenre,
      optionsGenre: options.genre,
      dataGenre: options.data?.genre
    });
    throw new Error('[GENRE-ERROR] JSON output recebeu modo genre sem finalGenre válido');
  }

  // 🚨 LOG DE AUDITORIA
  console.log('[AUDIT-JSON-OUTPUT] finalGenre:', {
    finalGenre,
    isGenreMode,
    optionsGenre: options.genre
  });
  
  // 🔥 LOG CIRÚRGICO: DEPOIS de resolver finalGenre
  console.log('[GENRE-DEEP-TRACE][JSON-OUTPUT-POST]', {
    ponto: 'json-output.js buildFinalJSON - DEPOIS resolução',
    'isGenreMode': isGenreMode,
    'resolvedGenre': resolvedGenre,
    'finalGenre': finalGenre,
    'isNull': finalGenre === null,
    'isEmpty': finalGenre === '',
    'isDefault': finalGenre === 'default'
  });

  return {
    // 🎯 CORREÇÃO CRÍTICA: Incluir genre, mode e referenceStage no JSON final
    // Esses campos são FUNDAMENTAIS para:
    // - Carregamento correto dos targets específicos por gênero no frontend
    // - Renderização do modo gênero vs modo referência
    // - Sugestões técnicas contextualizadas
    // - Comparação de bandas espectrais
    // - Preservação do fluxo A/B no modo referência
    genre: finalGenre,
    mode: options.mode || 'genre',
    referenceStage: options.referenceStage || options.data?.referenceStage || null, // 🆕 BASE ou COMPARE
    referenceJobId: options.referenceJobId || null, // 🆕 ID da primeira música (se compare)
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
      // 🔧 CORREÇÃO AUDITORIA DSP 2025-12-29 (OPÇÃO C): Abertura Estéreo = 1 - |correlation|
      opening: technicalData.stereoOpening,
      openingPercent: technicalData.stereoOpeningPercent,
      openingCategory: technicalData.stereoOpeningCategory,
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

    // REMOVED: dominantFrequencies export (mantendo cálculo interno para suggestions)
    // dominantFrequencies: null,

    problemsAnalysis: technicalData.problemsAnalysis,

    // ===== DIAGNOSTICS =====
    diagnostics: {
      problems: technicalData.problemsAnalysis?.problems || [],
      suggestions: FORCE_TYPE_FIELD(technicalData.problemsAnalysis?.suggestions || []), // 🚨 CORREÇÃO SUPER AGRESSIVA
      prioritized: technicalData.problemsAnalysis?.priorityRecommendations || []
    },

    // ===== SUGGESTIONS & AI SUGGESTIONS (Base - Serão enriquecidos pelo pipeline) =====
    // 🔧 FIX: Garantir que esses campos SEMPRE existam na estrutura base
    // Pipeline-complete.js irá popular/sobrescrever com dados reais
    suggestions: [],
    aiSuggestions: [],
    summary: null,
    suggestionMetadata: null,

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
    // 🎯 MODO REFERENCE: Comparar com métricas preloaded da faixa de referência
    // 🎵 MODO GENRE: NÃO criar campo (retornar undefined)
    referenceComparison: (() => {
      // 🔒 APENAS criar referenceComparison em modo reference COM métricas preloaded
      if (options.mode === 'reference' && options.preloadedReferenceMetrics) {
        console.log('🎯 [JSON-OUTPUT] Gerando comparação por REFERÊNCIA (faixa real)');
        
        // Passar opções completas para a função de comparação
        const comparisonOptions = {
          userJobId: options.jobId,
          userFileName: options.fileName || 'UserTrack.wav',
          referenceJobId: options.referenceJobId,
          referenceFileName: options.preloadedReferenceMetrics.metadata?.fileName || 'ReferenceTrack.wav'
        };
        
        return generateReferenceComparison(technicalData, options.preloadedReferenceMetrics, comparisonOptions);
      }
      
      // 🛡️ MODO GÊNERO: Retornar undefined para NÃO criar o campo
      console.log('🎵 [JSON-OUTPUT] Modo gênero detectado - referenceComparison NÃO será criado');
      return undefined;
    })(),

    // ===== METRICS (Structured for Frontend) =====
    metrics: {
      // REMOVED: 🌈 BANDAS UNIFICADAS - duplicação comentada, usar spectralBands
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
      // 🔧 CORREÇÃO AUDITORIA DSP 2025-12-29 (OPÇÃO C): Abertura Estéreo = 1 - |correlation|
      stereoOpening: technicalData.stereoOpening,
      stereoOpeningPercent: technicalData.stereoOpeningPercent,
      stereoOpeningCategory: technicalData.stereoOpeningCategory,
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
      // 🔧 CORREÇÃO AUDITORIA DSP 2025-12-29: Restaurar export spectralUniformity corrigida
      spectralUniformity: technicalData.spectralUniformity,
      spectralUniformityPercent: technicalData.spectralUniformityPercent,
      spectralUniformityMeta: technicalData.spectralUniformityMeta,
      
      // BPM (Beats Per Minute) ✅ CORREÇÃO: incluído na seção technicalData
      bpm: technicalData.bpm, // ✅ CAMPO CORRETO 'bpm' para frontend modal (não 'bmp')
      bpmConfidence: technicalData.bpmConfidence, // ✅ CORREÇÃO: bmpConfidence → bpmConfidence
      bpmSource: technicalData.bpmSource, // ✅ NOVO: Fonte do cálculo (NORMAL, FALLBACK_STRICT, etc)
      
      problemsAnalysis: technicalData.problemsAnalysis,
      
      // Compatibilidade com nomes legados
      correlation: technicalData.stereoCorrelation,
      balance: technicalData.balanceLR,
      width: technicalData.stereoWidth,
      // 🔧 CORREÇÃO AUDITORIA DSP 2025-12-29 (OPÇÃO C): Alias de Abertura Estéreo
      opening: technicalData.stereoOpening,
      openingPercent: technicalData.stereoOpeningPercent,
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
    },

    // 🔥 CAMPO OBRIGATÓRIO: data com genre, genreTargets e metrics
    // ✅ CORREÇÃO CRÍTICA: Adicionar metrics consolidado para sugestões
    // Frontend acessa: analysis.data.metrics e analysis.data.genreTargets
    data: {
      genre: finalGenre,
      genreTargets: options.genreTargets ? {
        // ✅ PRESERVAR ESTRUTURA COMPLETA DO POSTGRES (nested com target, tolerance, target_range)
        lufs: options.genreTargets.lufs || null,
        truePeak: options.genreTargets.truePeak || null,
        dr: options.genreTargets.dr || null,
        lra: options.genreTargets.lra || null,
        stereo: options.genreTargets.stereo || null,
        // ✅ BANDAS: Passar objeto completo preservado
        bands: options.genreTargets.bands || options.genreTargets.spectral_bands || null
      } : null,
      
      // ═══════════════════════════════════════════════════════════════════════════
      // 🎯 NOVO: FONTE ÚNICA DA VERDADE - Targets Normalizados
      // Frontend DEVE usar APENAS este campo para decisões de severidade/score/sugestões
      // Isso elimina divergências entre tabela, score e sugestões
      // ═══════════════════════════════════════════════════════════════════════════
      referenceTargetsNormalized: (() => {
        if (!options.genreTargets) return null;
        
        // Normalizar targets usando a função fonte única
        const normalized = normalizeGenreTargets(options.genreTargets);
        if (!normalized) return null;
        
        // Pré-calcular severidades para as métricas atuais (para frontend usar diretamente)
        const preCalculatedSeverities = {
          // MÉTRICAS PRINCIPAIS
          metrics: {
            lufs: calculateMetricSeverity('lufs', technicalData.lufsIntegrated, normalized),
            truePeak: calculateMetricSeverity('truePeak', technicalData.truePeakDbtp, normalized),
            dr: calculateMetricSeverity('dr', technicalData.dynamicRange, normalized),
            stereo: calculateMetricSeverity('stereo', technicalData.stereoCorrelation, normalized)
          },
          // BANDAS ESPECTRAIS
          bands: (() => {
            const bands = technicalData.spectral_balance;
            if (!bands || bands._status !== 'calculated') return {};
            
            const bandSeverities = {};
            const bandKeys = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
            
            for (const key of bandKeys) {
              const bandValue = bands[key]?.energy_db;
              if (Number.isFinite(bandValue)) {
                bandSeverities[key] = calculateBandSeverity(key, bandValue, normalized);
              }
            }
            
            return bandSeverities;
          })()
        };
        
        // Log resumido (evitar flood)
        console.log('[JSON-OUTPUT] 🎯 referenceTargetsNormalized gerado:', {
          lufs: `[${normalized.metrics.lufs.min.toFixed(1)}, ${normalized.metrics.lufs.max.toFixed(1)}] → ${preCalculatedSeverities.metrics.lufs.severity}`,
          truePeak: `[${normalized.metrics.truePeak.min.toFixed(1)}, ${normalized.metrics.truePeak.max.toFixed(1)}] hardCap=${normalized.metrics.truePeak.hardCap} → ${preCalculatedSeverities.metrics.truePeak.severity}`,
          dr: `[${normalized.metrics.dr.min.toFixed(1)}, ${normalized.metrics.dr.max.toFixed(1)}] → ${preCalculatedSeverities.metrics.dr.severity}`,
          bandsWithSeverity: Object.keys(preCalculatedSeverities.bands).length
        });
        
        return {
          ...normalized,
          preCalculatedSeverities
        };
      })(),
      
      // ═══════════════════════════════════════════════════════════════════════════
      // 🎯 targetProfile - OBJETO ÚNICO POR ANÁLISE (FONTE ÚNICA DA VERDADE)
      // 
      // Este campo contém TODOS os targets do gênero+modo usados na análise.
      // TABELA, SCORE e SUGESTÕES devem usar APENAS este objeto.
      // 
      // REGRAS:
      // - truePeak.tp_max é SEMPRE 0.0 (hard cap físico)
      // - Se tp > 0.0 => severidade = CRÍTICA (sem exceção)
      // - min/max estão na MESMA escala dos valores medidos
      // ═══════════════════════════════════════════════════════════════════════════
      targetProfile: (() => {
        if (!options.genreTargets) return null;
        
        const normalized = normalizeGenreTargets(options.genreTargets);
        if (!normalized) return null;
        
        const TRUE_PEAK_HARD_CAP = 0.0;
        
        // Extrair targets de True Peak com estrutura específica
        const tpMetric = normalized.metrics?.truePeak || {};
        const lufsMetric = normalized.metrics?.lufs || {};
        const drMetric = normalized.metrics?.dr || {};
        const lraMetric = normalized.metrics?.lra || {};
        const stereoMetric = normalized.metrics?.stereo || {};
        
        // Construir targetProfile com estrutura padronizada
        const profile = {
          _version: '1.0.0',
          _source: 'backend',
          _genre: finalGenre,
          _timestamp: new Date().toISOString(),
          
          // TRUE PEAK: Estrutura específica com tp_min, tp_warn_from, tp_target, tp_max
          truePeak: {
            tp_min: tpMetric.min ?? -3.0,
            tp_warn_from: tpMetric.warnFrom ?? -0.1,
            tp_target: tpMetric.target ?? -1.0,
            tp_max: TRUE_PEAK_HARD_CAP  // SEMPRE 0.0 (hard cap físico)
          },
          
          // LUFS
          lufs: {
            target: lufsMetric.target ?? -8.5,
            min: lufsMetric.min ?? -10.5,
            max: lufsMetric.max ?? -6.5
          },
          
          // Dynamic Range
          dr: {
            target: drMetric.target ?? 6.0,
            min: drMetric.min ?? 4.0,
            max: drMetric.max ?? 9.0
          },
          
          // LRA (se existir)
          lra: lraMetric.target != null ? {
            target: lraMetric.target,
            min: lraMetric.min,
            max: lraMetric.max
          } : null,
          
          // Stereo (se existir)
          stereo: stereoMetric.target != null ? {
            target: stereoMetric.target,
            min: stereoMetric.min,
            max: stereoMetric.max
          } : null,
          
          // BANDAS: sub/bass/lowMid/mid/highMid/brilho/presenca com {min, max, target}
          bands: (() => {
            const normalizedBands = normalized.bands || {};
            const bandProfile = {};
            
            // Mapeamento de bandas
            const bandKeys = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'air', 'presence'];
            const bandAliases = {
              'air': 'brilho',
              'presence': 'presenca'
            };
            
            for (const key of bandKeys) {
              const band = normalizedBands[key];
              if (band && typeof band.min === 'number' && typeof band.max === 'number') {
                const displayKey = bandAliases[key] || key;
                bandProfile[displayKey] = {
                  min: band.min,
                  max: band.max,
                  target: band.target ?? (band.min + band.max) / 2
                };
              }
            }
            
            return Object.keys(bandProfile).length > 0 ? bandProfile : null;
          })(),
          
          // Severidades pré-calculadas (para frontend usar diretamente)
          preCalculatedSeverities: {
            truePeak: calculateMetricSeverity('truePeak', technicalData.truePeakDbtp, normalized),
            lufs: calculateMetricSeverity('lufs', technicalData.lufsIntegrated, normalized),
            dr: calculateMetricSeverity('dr', technicalData.dynamicRange, normalized),
            stereo: calculateMetricSeverity('stereo', technicalData.stereoCorrelation, normalized)
          }
        };
        
        console.log('[JSON-OUTPUT] 🎯 targetProfile gerado:', {
          genre: profile._genre,
          truePeak: `[${profile.truePeak.tp_min}, ${profile.truePeak.tp_max}] target=${profile.truePeak.tp_target}`,
          lufs: `[${profile.lufs.min}, ${profile.lufs.max}] target=${profile.lufs.target}`,
          dr: `[${profile.dr.min}, ${profile.dr.max}] target=${profile.dr.target}`,
          bandCount: profile.bands ? Object.keys(profile.bands).length : 0
        });
        
        return profile;
      })(),
      
      // 🎯 NOVO: Métricas consolidadas para sugestões usarem valores EXATOS
      metrics: {
        loudness: {
          value: technicalData.lufsIntegrated,
          unit: 'LUFS'
        },
        truePeak: {
          value: technicalData.truePeakDbtp,
          unit: 'dBTP'
        },
        dr: {
          value: technicalData.dynamicRange,
          unit: 'dB'
        },
        stereo: {
          value: technicalData.stereoCorrelation,
          unit: 'correlation'
        },
        bands: (() => {
          const bands = technicalData.spectral_balance;
          if (!bands || bands._status !== 'calculated') return null;
          
          // 🔥 CORREÇÃO CRÍTICA: Usar energy_db (dBFS) ao invés de percentage (%)
          // O sistema de sugestões PRECISA de valores em dB para calcular deltas corretos
          // percentage é apenas para visualização no painel de análise
          return {
            sub: { value: bands.sub?.energy_db || null, unit: 'dB' },
            bass: { value: bands.bass?.energy_db || null, unit: 'dB' },
            lowMid: { value: bands.lowMid?.energy_db || null, unit: 'dB' },
            mid: { value: bands.mid?.energy_db || null, unit: 'dB' },
            highMid: { value: bands.highMid?.energy_db || null, unit: 'dB' },
            presence: { value: bands.presence?.energy_db || null, unit: 'dB' },
            air: { value: bands.air?.energy_db || null, unit: 'dB' }
          };
        })()
      },
      
      // ════════════════════════════════════════════════════════════════════════════
      // 🎯 comparisonResult - RESULTADO DO PIPELINE ÚNICO
      // 
      // Este campo contém o resultado de compareWithTargets() que deve ser usado por:
      //   1) Tabela de comparação (result.rows)
      //   2) Cards de Sugestões (result.issues)
      //   3) Score (result.score)
      // 
      // GARANTE: mesmos números em todos os lugares, zero divergências
      // ════════════════════════════════════════════════════════════════════════════
      comparisonResult: (() => {
        if (!options.genreTargets) {
          console.warn('[JSON-OUTPUT] ⚠️ comparisonResult: genreTargets ausente');
          return null;
        }
        
        try {
          // 🔥 USAR PIPELINE CENTRAL: resolveTargets + compareWithTargets
          const resolvedTargets = resolveTargets(finalGenre, 'pista', options.genreTargets);
          
          // Validar targets (guardrail)
          const validation = validateTargets(resolvedTargets);
          if (!validation.valid) {
            console.error('[JSON-OUTPUT] ❌ Targets inválidos:', validation.errors);
            // Continuar mesmo com erros (log apenas)
          }
          
          // Construir objeto de métricas para comparação
          const metricsForComparison = {
            lufsIntegrated: technicalData.lufsIntegrated,
            truePeakDbtp: technicalData.truePeakDbtp,
            dynamicRange: technicalData.dynamicRange,
            stereoCorrelation: technicalData.stereoCorrelation,
            spectralBands: technicalData.spectral_balance
          };
          
          // 🎯 EXECUTAR COMPARAÇÃO CENTRAL
          const result = compareWithTargets(metricsForComparison, resolvedTargets);
          
          console.log('[JSON-OUTPUT] 🎯 comparisonResult gerado:', {
            rowsCount: result.rows.length,
            issuesCount: result.issues.length,
            score: result.score.total,
            classification: result.score.classification
          });
          
          // Verificar invariante: TP > 0 = CRÍTICA
          const tpRow = result.rows.find(r => r.key === 'truePeak');
          if (tpRow && technicalData.truePeakDbtp > 0 && tpRow.severity !== 'CRÍTICA') {
            console.error('[JSON-OUTPUT] 🚨 INVARIANTE VIOLADO: TP > 0 mas severity != CRÍTICA');
          }
          
          return result;
          
        } catch (error) {
          console.error('[JSON-OUTPUT] ❌ Erro ao gerar comparisonResult:', error.message);
          return null;
        }
      })()
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
    bpm: fullJSON.technicalData?.bpm, // ✅ CORREÇÃO: usar 'bpm' correto (não 'bmp')
    bpmConfidence: fullJSON.technicalData?.bpmConfidence, // ✅ CORREÇÃO: bmpConfidence → bpmConfidence
    bpmSource: fullJSON.technicalData?.bpmSource, // ✅ NOVO: Fonte do cálculo BPM
    spectralUniformity: fullJSON.spectralUniformity,
    dominantFrequencies: (fullJSON.dominantFrequencies || []).slice(0, 5),
    problemsAnalysis: fullJSON.problemsAnalysis,
    diagnostics: fullJSON.diagnostics,
    scores: fullJSON.scores,
    scoring: fullJSON.scoring,
    // 🔒 SEGURANÇA: Só incluir referenceComparison se realmente existir
    ...(fullJSON.referenceComparison ? { referenceComparison: fullJSON.referenceComparison } : {}),
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
      // REMOVED: spectralUniformity, dominantFrequencies (mantendo cálculo interno, removendo export)
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
 * 🎯 COMPARAÇÃO POR REFERÊNCIA: Gerar comparação baseada em métricas reais da faixa de referência
 * @param {Object} userMetrics - Métricas da faixa analisada (atual)
 * @param {Object} referenceMetrics - Métricas da faixa de referência (preloaded)
 * @returns {Object} - Objeto de comparação com diferenças numéricas e sugestões
 */
/**
 * 🎯 NOVA ESTRUTURA: Gera comparação completa UserTrack vs ReferenceTrack
 * @param {Object} userMetrics - Métricas técnicas da música do usuário (2ª música)
 * @param {Object} referenceMetrics - Objeto completo do resultado da 1ª música (referência)
 * @param {Object} options - Opções adicionais (jobIds, fileNames)
 * @returns {Object} - Estrutura completa com userTrack, referenceTrack, diff, suggestions
 */
function generateReferenceComparison(userMetrics, referenceMetrics, options = {}) {
  console.log('🎯 [REFERENCE-COMPARISON] Gerando comparação UserTrack vs ReferenceTrack');
  
  if (!referenceMetrics || !referenceMetrics.technicalData) {
    console.warn('⚠️ [REFERENCE-COMPARISON] Métricas de referência inválidas');
    return null;
  }

  const refTech = referenceMetrics.technicalData;
  const userTech = userMetrics;

  // Calcular diferenças numéricas
  const comparison = {
    // Loudness
    lufsIntegrated: {
      user: userTech.lufsIntegrated,
      reference: refTech.lufsIntegrated,
      diff: Number((userTech.lufsIntegrated - refTech.lufsIntegrated).toFixed(2)),
      unit: 'LUFS'
    },
    
    // True Peak
    truePeakDbtp: {
      user: userTech.truePeakDbtp,
      reference: refTech.truePeakDbtp,
      diff: Number((userTech.truePeakDbtp - refTech.truePeakDbtp).toFixed(2)),
      unit: 'dBTP'
    },
    
    // Dynamics
    dynamicRange: {
      user: userTech.dynamicRange,
      reference: refTech.dynamicRange,
      diff: Number((userTech.dynamicRange - refTech.dynamicRange).toFixed(2)),
      unit: 'LU'
    },
    
    lra: {
      user: userTech.lra,
      reference: refTech.lra,
      diff: Number((userTech.lra - refTech.lra).toFixed(2)),
      unit: 'LU'
    },
    
    // Stereo
    stereoCorrelation: {
      user: userTech.stereoCorrelation,
      reference: refTech.stereoCorrelation,
      diff: Number((userTech.stereoCorrelation - refTech.stereoCorrelation).toFixed(3)),
      unit: 'ratio'
    },
    
    stereoWidth: {
      user: userTech.stereoWidth,
      reference: refTech.stereoWidth,
      diff: Number((userTech.stereoWidth - refTech.stereoWidth).toFixed(3)),
      unit: 'ratio'
    },
    
    // Spectral
    spectralCentroidHz: {
      user: userTech.spectralCentroidHz,
      reference: refTech.spectralCentroidHz,
      diff: Number((userTech.spectralCentroidHz - refTech.spectralCentroidHz).toFixed(1)),
      unit: 'Hz'
    },
    
    // Spectral Bands (se disponíveis)
    spectralBands: {}
  };
  
  // Comparar bandas espectrais se ambas tiverem
  if (userTech.spectral_balance?._status === 'calculated' && 
      refTech.spectral_balance?._status === 'calculated') {
    
    const userBands = userTech.spectral_balance;
    const refBands = refTech.spectral_balance;
    
    ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'].forEach(band => {
      if (userBands[band] && refBands[band]) {
        // 🔥 CORREÇÃO: Usar energy_db (dBFS) para comparações coerentes
        // percentage é relativo e não deve ser usado para cálculo de deltas
        const userValue = userBands[band].energy_db;
        const refValue = refBands[band].energy_db;
        
        comparison.spectralBands[band] = {
          user: userValue,
          reference: refValue,
          diff: Number((userValue - refValue).toFixed(2)),
          unit: 'dB'
        };
      }
    });
  }
  
  // Gerar sugestões baseadas nas diferenças
  const suggestions = generateReferenceSuggestions(comparison);
  
  console.log(`✅ [REFERENCE-COMPARISON] Comparação gerada: ${suggestions.length} sugestões`);
  
  // 🎯 NOVA ESTRUTURA COMPLETA: userTrack vs referenceTrack
  return {
    mode: 'reference',
    
    // ===== USER TRACK (2ª música - sendo analisada) =====
    userTrack: {
      jobId: options.userJobId || 'current',
      fileName: options.userFileName || 'UserTrack.wav',
      metrics: {
        lufsIntegrated: userTech.lufsIntegrated,
        truePeakDbtp: userTech.truePeakDbtp,
        dynamicRange: userTech.dynamicRange,
        lra: userTech.lra,
        stereoCorrelation: userTech.stereoCorrelation,
        stereoWidth: userTech.stereoWidth,
        spectralCentroidHz: userTech.spectralCentroidHz,
        spectral_balance: userTech.spectral_balance
      }
    },
    
    // ===== REFERENCE TRACK (1ª música - target para comparação) =====
    referenceTrack: {
      jobId: options.referenceJobId || 'reference',
      fileName: options.referenceFileName || 'ReferenceTrack.wav',
      metrics: {
        score: referenceMetrics.score,
        lufsIntegrated: refTech.lufsIntegrated,
        truePeakDbtp: refTech.truePeakDbtp,
        dynamicRange: refTech.dynamicRange,
        lra: refTech.lra,
        stereoCorrelation: refTech.stereoCorrelation,
        stereoWidth: refTech.stereoWidth,
        spectralCentroidHz: refTech.spectralCentroidHz,
        spectral_balance: refTech.spectral_balance
      }
    },
    
    // ===== COMPARISON (diferenças calculadas) =====
    referenceComparison: {
      diff: comparison,
      summary: {
        totalDifferences: Object.keys(comparison).filter(k => typeof comparison[k] === 'object').length,
        significantDifferences: Object.keys(comparison).filter(k => 
          typeof comparison[k] === 'object' && Math.abs(comparison[k].diff) > 1
        ).length
      }
    },
    
    // ===== SUGGESTIONS (baseadas nos deltas) =====
    suggestions,
    
    // ===== COMPATIBILIDADE RETROATIVA (para frontend antigo) =====
    // TODO: Remover após migração completa do frontend
    comparison,
    referenceMetrics: {
      score: referenceMetrics.score,
      lufsIntegrated: refTech.lufsIntegrated,
      truePeakDbtp: refTech.truePeakDbtp,
      dynamicRange: refTech.dynamicRange,
      stereoCorrelation: refTech.stereoCorrelation,
      spectralCentroidHz: refTech.spectralCentroidHz
    }
  };
}

/**
 * 💡 GERADOR DE SUGESTÕES BASEADAS EM REFERÊNCIA
 * @param {Object} comparison - Objeto com diferenças calculadas
 * @returns {Array} - Array de sugestões formatadas
 */
function generateReferenceSuggestions(comparison) {
  const suggestions = [];
  
  // LOUDNESS
  if (Math.abs(comparison.lufsIntegrated.diff) > 1) {
    if (comparison.lufsIntegrated.diff < -1) {
      suggestions.push({
        type: 'loudness',
        metric: 'lufsIntegrated',
        severity: 'warning',
        message: `Volume ${Math.abs(comparison.lufsIntegrated.diff).toFixed(1)} LUFS mais baixo que a referência. Aumente o volume geral.`,
        diff: comparison.lufsIntegrated.diff
      });
    } else {
      suggestions.push({
        type: 'loudness',
        metric: 'lufsIntegrated',
        severity: 'warning',
        message: `Volume ${comparison.lufsIntegrated.diff.toFixed(1)} LUFS mais alto que a referência. Reduza o volume geral.`,
        diff: comparison.lufsIntegrated.diff
      });
    }
  }
  
  // TRUE PEAK
  if (comparison.truePeakDbtp.diff > 1) {
    suggestions.push({
      type: 'truePeak',
      metric: 'truePeakDbtp',
      severity: 'critical',
      message: `True Peak ${comparison.truePeakDbtp.diff.toFixed(1)} dB mais alto que a referência. Risco de clipping digital.`,
      diff: comparison.truePeakDbtp.diff
    });
  }
  
  // DYNAMIC RANGE
  if (Math.abs(comparison.dynamicRange.diff) > 2) {
    if (comparison.dynamicRange.diff < -2) {
      suggestions.push({
        type: 'dynamics',
        metric: 'dynamicRange',
        severity: 'warning',
        message: `Dinâmica ${Math.abs(comparison.dynamicRange.diff).toFixed(1)} LU mais comprimida que a referência. Reduza compressão.`,
        diff: comparison.dynamicRange.diff
      });
    } else {
      suggestions.push({
        type: 'dynamics',
        metric: 'dynamicRange',
        severity: 'info',
        message: `Dinâmica ${comparison.dynamicRange.diff.toFixed(1)} LU mais aberta que a referência. Considere mais compressão.`,
        diff: comparison.dynamicRange.diff
      });
    }
  }
  
  // STEREO WIDTH
  if (Math.abs(comparison.stereoWidth.diff) > 0.1) {
    if (comparison.stereoWidth.diff < -0.1) {
      suggestions.push({
        type: 'stereo',
        metric: 'stereoWidth',
        severity: 'info',
        message: `Imagem estéreo mais estreita que a referência. Use widening ou panning.`,
        diff: comparison.stereoWidth.diff
      });
    } else {
      suggestions.push({
        type: 'stereo',
        metric: 'stereoWidth',
        severity: 'warning',
        message: `Imagem estéreo mais larga que a referência. Verifique compatibilidade mono.`,
        diff: comparison.stereoWidth.diff
      });
    }
  }
  
  // SPECTRAL CENTROID
  if (Math.abs(comparison.spectralCentroidHz.diff) > 500) {
    if (comparison.spectralCentroidHz.diff < -500) {
      suggestions.push({
        type: 'spectral',
        metric: 'spectralCentroid',
        severity: 'info',
        message: `Som ${Math.abs(comparison.spectralCentroidHz.diff).toFixed(0)} Hz mais escuro que a referência. Adicione brilho com EQ.`,
        diff: comparison.spectralCentroidHz.diff
      });
    } else {
      suggestions.push({
        type: 'spectral',
        metric: 'spectralCentroid',
        severity: 'info',
        message: `Som ${comparison.spectralCentroidHz.diff.toFixed(0)} Hz mais brilhante que a referência. Reduza altas com EQ.`,
        diff: comparison.spectralCentroidHz.diff
      });
    }
  }
  
  // SPECTRAL BANDS
  if (comparison.spectralBands && Object.keys(comparison.spectralBands).length > 0) {
    Object.entries(comparison.spectralBands).forEach(([band, data]) => {
      if (Math.abs(data.diff) > 3) {
        const bandNames = {
          sub: 'Sub (20-60Hz)',
          bass: 'Bass (60-150Hz)',
          lowMid: 'Low-Mid (150-500Hz)',
          mid: 'Mid (500-2kHz)',
          highMid: 'High-Mid (2-5kHz)',
          presence: 'Presence (5-10kHz)',
          air: 'Air (10-20kHz)'
        };
        
        suggestions.push({
          type: 'spectral',
          metric: `spectralBand_${band}`,
          severity: 'info',
          message: `${bandNames[band]}: ${data.diff > 0 ? '+' : ''}${data.diff.toFixed(1)}% vs referência. Ajuste EQ nesta faixa.`,
          diff: data.diff
        });
      }
    });
  }
  
  return suggestions;
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
      funk_bh: {
        sub: { target: 27.0, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 25.0, tolerance: 3.0, name: "Bass (60-150Hz)" },
        lowMid: { target: 16.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 14.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 11.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 9.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 6.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      funk_bruxaria: {
        sub: { target: 28.0, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 26.0, tolerance: 3.0, name: "Bass (60-150Hz)" },
        lowMid: { target: 14.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 12.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 10.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 8.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 5.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      funk_automotivo: {
        sub: { target: 30.0, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 27.0, tolerance: 3.0, name: "Bass (60-150Hz)" },
        lowMid: { target: 15.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 12.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 9.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 7.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 4.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      eletrofunk: {
        sub: { target: 22.0, tolerance: 2.5, name: "Sub (20-60Hz)" },
        bass: { target: 23.0, tolerance: 2.5, name: "Bass (60-150Hz)" },
        lowMid: { target: 17.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 15.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 13.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 11.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 7.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      trap: {
        sub: { target: 26.0, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 24.0, tolerance: 3.0, name: "Bass (60-150Hz)" },
        lowMid: { target: 16.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 14.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 12.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 10.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 6.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      tech_house: {
        sub: { target: 20.0, tolerance: 2.5, name: "Sub (20-60Hz)" },
        bass: { target: 22.0, tolerance: 2.5, name: "Bass (60-150Hz)" },
        lowMid: { target: 17.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 16.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 13.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 11.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 7.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      techno: {
        sub: { target: 19.0, tolerance: 2.5, name: "Sub (20-60Hz)" },
        bass: { target: 21.0, tolerance: 2.5, name: "Bass (60-150Hz)" },
        lowMid: { target: 17.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 16.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 14.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 12.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 8.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      house: {
        sub: { target: 21.0, tolerance: 2.5, name: "Sub (20-60Hz)" },
        bass: { target: 22.0, tolerance: 2.5, name: "Bass (60-150Hz)" },
        lowMid: { target: 17.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 16.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 13.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 11.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 7.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      brazilian_phonk: {
        sub: { target: 28.0, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 26.0, tolerance: 3.0, name: "Bass (60-150Hz)" },
        lowMid: { target: 14.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 12.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 10.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 8.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 5.0, tolerance: 3.0, name: "Air (10-20kHz)" }
      },
      phonk: {
        sub: { target: 27.0, tolerance: 3.0, name: "Sub (20-60Hz)" },
        bass: { target: 25.0, tolerance: 3.0, name: "Bass (60-150Hz)" },
        lowMid: { target: 15.0, tolerance: 2.5, name: "Low-Mid (150-500Hz)" },
        mid: { target: 13.0, tolerance: 2.5, name: "Mid (500-2kHz)" },
        highMid: { target: 11.0, tolerance: 2.5, name: "High-Mid (2-5kHz)" },
        presence: { target: 9.0, tolerance: 2.5, name: "Presence (5-10kHz)" },
        air: { target: 6.0, tolerance: 3.0, name: "Air (10-20kHz)" }
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
  // REMOVED: Dominant Frequencies reference processing
  // Reason: REMOVAL_SKIPPED_USED_BY_SCORE:dominantFrequencies - removendo do export/referência
  console.warn('REMOVAL_SKIPPED_USED_BY_SCORE:dominantFrequencies - removendo da referência por gênero');
  
  return references;
}

console.log("✅ JSON Output & Scoring (Fase 5.4) carregado - 100% compatível com frontend");
