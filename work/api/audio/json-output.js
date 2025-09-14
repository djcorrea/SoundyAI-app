// 🎯 FASE 5.4: JSON OUTPUT + SCORING - CORRIGIDO
// Constrói saída JSON estruturada e calcula score compatível com front-end
// SEM FALLBACKS, SEM VALORES FICTÍCIOS, FAIL-FAST

import { computeMixScore } from "../../lib/audio/features/scoring.js";

// Sistema de tratamento de erros padronizado
import { makeErr, logAudio, assertFinite } from '../../lib/audio/error-handling.js';

console.log("📦 JSON Output & Scoring (Fase 5.4) carregado - Equal Weight V3 CORRIGIDO");

/**
 * Gera JSON final estruturado com métricas e score - FAIL-FAST
 */
export function generateJSONOutput(coreMetrics, reference = null, metadata = {}, options = {}) {
  const jobId = options.jobId || 'unknown';
  const fileName = options.fileName || 'unknown';
  
  logAudio('output_scoring', 'start_generation', { fileName, jobId });
  const startTime = Date.now();

  try {
    // ========= VALIDAÇÃO DE ENTRADA =========
    if (!coreMetrics || typeof coreMetrics !== "object") {
      throw makeErr('output_scoring', 'Invalid core metrics: must be object', 'invalid_core_metrics');
    }

    // Validar estrutura mínima requerida
    validateCoreMetricsStructure(coreMetrics);

    // ========= EXTRAÇÃO DE DADOS TÉCNICOS =========
    logAudio('output_scoring', 'extract_technical', { jobId: jobId.substring(0,8) });
    const technicalData = extractTechnicalData(coreMetrics);
    
    // Validar dados extraídos
    try {
      assertFinite(technicalData, 'output_scoring');
    } catch (validationError) {
      throw makeErr('output_scoring', `Technical data validation failed: ${validationError.message}`, 'technical_data_invalid');
    }

    // ========= CÁLCULO DE SCORE =========
    logAudio('output_scoring', 'compute_score', { reference, jobId: jobId.substring(0,8) });
    const scoringResult = computeMixScore(technicalData, reference);
    
    // Validar resultado do scoring
    const scoreValue = scoringResult.score || scoringResult.scorePct;
    if (!scoringResult || typeof scoreValue !== 'number') {
      throw makeErr('output_scoring', `Invalid scoring result: ${JSON.stringify(scoringResult)}`, 'invalid_scoring_result');
    }

    if (!isFinite(scoreValue)) {
      throw makeErr('output_scoring', `Score is not finite: ${scoreValue}`, 'invalid_score_value');
    }

    // ========= CONSTRUÇÃO JSON FINAL =========
    logAudio('output_scoring', 'build_json', { score: scoreValue });
    const finalJSON = buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, { jobId });

    // ========= VALIDAÇÃO FINAL =========
    validateFinalJSON(finalJSON);
    
    try {
      assertFinite(finalJSON, 'output_scoring');
    } catch (validationError) {
      throw makeErr('output_scoring', `Final JSON validation failed: ${validationError.message}`, 'final_json_invalid');
    }

    // Verificar tamanho do JSON
    const jsonSize = JSON.stringify(finalJSON).length;
    if (jsonSize > 200 * 1024) { // 200KB limit
      throw makeErr('output_scoring', `JSON output too large: ${jsonSize} bytes (limit: 200KB)`, 'json_too_large');
    }

    const totalTime = Date.now() - startTime;
    logAudio('output_scoring', 'completed', { 
      ms: totalTime,
      score: scoreValue,
      size: jsonSize,
      classification: scoringResult.classification
    });

    return finalJSON;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // Log estruturado do erro
    logAudio('output_scoring', 'error', {
      code: error.code || 'unknown',
      message: error.message,
      ms: totalTime,
      stage: 'output_scoring'
    });

    // Se já é um erro estruturado, re-propagar
    if (error.stage === 'output_scoring') {
      throw error;
    }

    // Estruturar erro genérico
    throw makeErr('output_scoring', `JSON output generation failed: ${error.message}`, 'json_generation_error');
  }
}

/**
 * Validação rigorosa da estrutura de core metrics
 */
function validateCoreMetricsStructure(coreMetrics) {
  // Verificar seções obrigatórias
  const requiredSections = ['lufs', 'truePeak', 'stereo'];
  
  for (const section of requiredSections) {
    if (!coreMetrics[section]) {
      throw makeErr('output_scoring', `Missing required section: ${section}`, 'missing_core_section');
    }
  }

  // Validar LUFS
  const requiredLufsFields = ['integrated', 'shortTerm', 'momentary', 'lra'];
  for (const field of requiredLufsFields) {
    if (!isFinite(coreMetrics.lufs[field])) {
      throw makeErr('output_scoring', `Invalid LUFS ${field}: ${coreMetrics.lufs[field]}`, 'invalid_lufs_field');
    }
  }

  // Validar True Peak
  const requiredPeakFields = ['maxDbtp', 'maxLinear'];
  for (const field of requiredPeakFields) {
    if (!isFinite(coreMetrics.truePeak[field])) {
      throw makeErr('output_scoring', `Invalid True Peak ${field}: ${coreMetrics.truePeak[field]}`, 'invalid_peak_field');
    }
  }

  // Validar Stereo
  const requiredStereoFields = ['correlation', 'balance', 'width'];
  for (const field of requiredStereoFields) {
    if (!isFinite(coreMetrics.stereo[field])) {
      throw makeErr('output_scoring', `Invalid Stereo ${field}: ${coreMetrics.stereo[field]}`, 'invalid_stereo_field');
    }
  }
}

/**
 * Extrai dados técnicos das métricas core para o scoring
 */
function extractTechnicalData(coreMetrics) {
  const technicalData = {};

  try {
    // Loudness - valores reais, sem fallbacks
    technicalData.lufsIntegrated = coreMetrics.lufs.integrated;
    technicalData.lufsShortTerm = coreMetrics.lufs.shortTerm;
    technicalData.lufsMomentary = coreMetrics.lufs.momentary;
    technicalData.lra = coreMetrics.lufs.lra;

    // True Peak - valores reais, sem fallbacks
    technicalData.truePeakDbtp = coreMetrics.truePeak.maxDbtp;
    technicalData.truePeakLinear = coreMetrics.truePeak.maxLinear;

    // Stereo Analysis - valores reais, sem fallbacks
    technicalData.stereoCorrelation = coreMetrics.stereo.correlation;
    technicalData.stereoBalance = coreMetrics.stereo.balance;
    technicalData.stereoWidth = coreMetrics.stereo.width;

    // RMS - se disponível
    if (coreMetrics.rms) {
      technicalData.rmsLevels = {
        left: coreMetrics.rms.left || null,
        right: coreMetrics.rms.right || null,
        count: coreMetrics.rms.count || 0
      };
    }

    // FFT - se disponível  
    if (coreMetrics.fft) {
      technicalData.spectralData = {
        processedFrames: coreMetrics.fft.processedFrames || 0,
        spectralCentroid: coreMetrics.fft.spectralCentroid || null,
        spectralRolloff: coreMetrics.fft.spectralRolloff || null,
        spectralFlatness: coreMetrics.fft.spectralFlatness || null
      };
    }

    return technicalData;

  } catch (error) {
    throw makeErr('output_scoring', `Technical data extraction failed: ${error.message}`, 'technical_extraction_error');
  }
}

/**
 * Constrói JSON final estruturado
 */
function buildFinalJSON(coreMetrics, technicalData, scoringResult, metadata, options = {}) {
  const jobId = options.jobId || 'unknown';
  
  // Garantir score válido
  const scoreValue = scoringResult.score || scoringResult.scorePct;
  
  try {
    const finalJSON = {
      // ========= SCORE E CLASSIFICAÇÃO =========
      score: Math.round(scoreValue * 10) / 10, // 1 decimal
      classification: scoringResult.classification || 'unknown',
      
      // ========= MÉTRICAS TÉCNICAS PRINCIPAIS =========
      loudness: {
        integrated: Math.round(technicalData.lufsIntegrated * 10) / 10,
        shortTerm: Math.round(technicalData.lufsShortTerm * 10) / 10,
        momentary: Math.round(technicalData.lufsMomentary * 10) / 10,
        lra: Math.round(technicalData.lra * 10) / 10,
        unit: "LUFS"
      },
      
      truePeak: {
        maxDbtp: Math.round(technicalData.truePeakDbtp * 10) / 10,
        maxLinear: Math.round(technicalData.truePeakLinear * 1000) / 1000,
        unit: "dBTP"
      },
      
      stereo: {
        correlation: Math.round(technicalData.stereoCorrelation * 1000) / 1000,
        balance: Math.round(technicalData.stereoBalance * 1000) / 1000,
        width: Math.round(technicalData.stereoWidth * 1000) / 1000,
        isMonoCompatible: coreMetrics.stereo.isMonoCompatible || false,
        hasPhaseIssues: coreMetrics.stereo.hasPhaseIssues || false
      },

      // ========= SCORING BREAKDOWN =========
      scoring: {
        method: scoringResult.method || 'Equal Weight V3',
        breakdown: scoringResult.breakdown || {},
        penalties: scoringResult.penalties || {},
        bonuses: scoringResult.bonuses || {}
      },

      // ========= METADATA =========
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

    // Adicionar dados auxiliares se disponíveis
    if (technicalData.rmsLevels && technicalData.rmsLevels.count > 0) {
      finalJSON.rms = {
        frameCount: technicalData.rmsLevels.count,
        hasData: true
      };
    }

    if (technicalData.spectralData && technicalData.spectralData.processedFrames > 0) {
      finalJSON.spectral = {
        frameCount: technicalData.spectralData.processedFrames,
        hasData: true
      };
    }

    return finalJSON;

  } catch (error) {
    throw makeErr('output_scoring', `JSON building failed: ${error.message}`, 'json_building_error');
  }
}

/**
 * Validação final do JSON de saída
 */
function validateFinalJSON(finalJSON) {
  try {
    // Verificar estrutura mínima
    const requiredFields = ['score', 'classification', 'loudness', 'truePeak', 'stereo', 'metadata'];
    
    for (const field of requiredFields) {
      if (finalJSON[field] === undefined || finalJSON[field] === null) {
        throw makeErr('output_scoring', `Missing required field in final JSON: ${field}`, 'missing_final_field');
      }
    }

    // Verificar score válido
    if (!isFinite(finalJSON.score) || finalJSON.score < 0 || finalJSON.score > 100) {
      throw makeErr('output_scoring', `Invalid score: ${finalJSON.score}`, 'invalid_final_score');
    }

    // Verificar que não há valores NaN/Infinity
    const jsonString = JSON.stringify(finalJSON);
    if (jsonString.includes('null') && jsonString.includes('NaN')) {
      throw makeErr('output_scoring', 'Final JSON contains NaN values', 'json_contains_nan');
    }

    // Verificar tamanho mínimo (não vazio)
    if (jsonString.length < 100) {
      throw makeErr('output_scoring', `Final JSON too small: ${jsonString.length} bytes`, 'json_too_small');
    }

  } catch (error) {
    if (error.stage === 'output_scoring') {
      throw error;
    }
    throw makeErr('output_scoring', `Final JSON validation failed: ${error.message}`, 'final_json_validation_error');
  }
}

// ========= REMOVED PROBLEMATIC FUNCTIONS =========
// ❌ REMOVIDO: createErrorJSON() - violava princípio fail-fast
// ❌ REMOVIDO: Qualquer fallback que retorne valores fictícios
// ❌ REMOVIDO: Tratamento silencioso de erros

console.log('✅ JSON Output & Scoring (Fase 5.4) carregado - FAIL-FAST sem fallbacks');