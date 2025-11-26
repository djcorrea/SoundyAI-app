// 🎯 PIPELINE COMPLETO FASES 5.1 - 5.4 - CORRIGIDO
// Integração completa com tratamento de erros padronizado e fail-fast

import decodeAudioFile from "./audio-decoder.js";              // Fase 5.1
import { segmentAudioTemporal } from "./temporal-segmentation.js"; // Fase 5.2  
import { calculateCoreMetrics } from "./core-metrics.js";      // Fase 5.3
import { generateJSONOutput } from "./json-output.js";         // Fase 5.4

// Sistema de tratamento de erros padronizado
import { makeErr, logAudio, assertFinite } from '../../lib/audio/error-handling.js';

console.log('🎵 Pipeline Completo (Fases 5.1-5.4) carregado - Node.js Backend CORRIGIDO');

export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  const startTime = Date.now();
  const jobId = options.jobId || 'unknown';
  
  console.log(`🚀 [${jobId.substring(0,8)}] Iniciando pipeline completo para: ${fileName}`);
  console.log(`📊 [${jobId.substring(0,8)}] Buffer size: ${audioBuffer.length} bytes`);
  console.log(`🔧 [${jobId.substring(0,8)}] Opções:`, options);

  let audioData, segmentedData, coreMetrics, finalJSON;
  const timings = {};

  try {
    // ========= FASE 5.1: DECODIFICAÇÃO =========
    try {
      logAudio('decode', 'start', { fileName, jobId });
      const phase1StartTime = Date.now();
      
      audioData = await decodeAudioFile(audioBuffer, fileName, { jobId });
      
      timings.phase1_decode = Date.now() - phase1StartTime;
      console.log(`✅ [${jobId.substring(0,8)}] Fase 5.1 concluída em ${timings.phase1_decode}ms`);
      console.log(`📊 [${jobId.substring(0,8)}] Audio: ${audioData.sampleRate}Hz, ${audioData.numberOfChannels}ch, ${audioData.duration.toFixed(2)}s`);
      
    } catch (error) {
      // Fase 5.1 já estrutura seus próprios erros
      throw error;
    }

    // ========= FASE 5.2: SEGMENTAÇÃO =========
    try {
      logAudio('segmentation', 'start', { fileName, jobId });
      const phase2StartTime = Date.now();
      
      segmentedData = segmentAudioTemporal(audioData, { jobId, fileName });
      
      timings.phase2_segmentation = Date.now() - phase2StartTime;
      console.log(`✅ [${jobId.substring(0,8)}] Fase 5.2 concluída em ${timings.phase2_segmentation}ms`);
      console.log(`📊 [${jobId.substring(0,8)}] Frames: FFT=${segmentedData.framesFFT.count}, RMS=${segmentedData.framesRMS.count}`);
      
    } catch (error) {
      if (error.stage === 'segmentation') {
        throw error; // Já estruturado
      }
      throw makeErr('segmentation', `Segmentation failed: ${error.message}`, 'segmentation_error');
    }

    // ========= FASE 5.3: CORE METRICS =========
    try {
      logAudio('core_metrics', 'start', { fileName, jobId });
      const phase3StartTime = Date.now();
      
      coreMetrics = await calculateCoreMetrics(segmentedData, { jobId, fileName });
      
      timings.phase3_core_metrics = Date.now() - phase3StartTime;
      console.log(`✅ [${jobId.substring(0,8)}] Fase 5.3 concluída em ${timings.phase3_core_metrics}ms`);
      
      // Logs condicionais para evitar erros se métricas não existirem
      const lufsStr = coreMetrics.lufs?.integrated ? coreMetrics.lufs.integrated.toFixed(1) : 'N/A';
      const peakStr = coreMetrics.truePeak?.maxDbtp ? coreMetrics.truePeak.maxDbtp.toFixed(1) : 'N/A';
      const corrStr = coreMetrics.stereo?.correlation ? coreMetrics.stereo.correlation.toFixed(3) : 'N/A';
      
      console.log(`� [${jobId.substring(0,8)}] LUFS: ${lufsStr}, Peak: ${peakStr}dBTP, Corr: ${corrStr}`);
      
    } catch (error) {
      if (error.stage === 'core_metrics') {
        throw error; // Já estruturado
      }
      throw makeErr('core_metrics', `Core metrics failed: ${error.message}`, 'core_metrics_error');
    }

    // ========= FASE 5.4: JSON OUTPUT =========
    try {
      logAudio('output_scoring', 'start', { fileName, jobId });
      const phase4StartTime = Date.now();
      
      const metadata = {
        fileName,
        fileSize: audioBuffer.length,
        processingTime: Date.now() - startTime,
        jobId
      };
      const reference = options.reference || options.genre || null;
      
      finalJSON = generateJSONOutput(coreMetrics, reference, metadata, { jobId, fileName });
      
      timings.phase4_json_output = Date.now() - phase4StartTime;
      console.log(`✅ [${jobId.substring(0,8)}] Fase 5.4 concluída em ${timings.phase4_json_output}ms`);
      
      // Log seguro do score
      const scoreStr = finalJSON.score !== undefined ? finalJSON.score : 'N/A';
      const classStr = finalJSON.classification || 'N/A';
      console.log(`🎯 [${jobId.substring(0,8)}] Score: ${scoreStr}% (${classStr})`);
      
    } catch (error) {
      if (error.stage === 'output_scoring') {
        throw error; // Já estruturado  
      }
      throw makeErr('output_scoring', `JSON output failed: ${error.message}`, 'output_scoring_error');
    }

    // ========= FINALIZAÇÃO =========
    const totalTime = Date.now() - startTime;
    timings.total = totalTime;

    // Adicionar timing breakdown ao resultado final
    finalJSON.metadata = finalJSON.metadata || {};
    finalJSON.metadata.processingTime = totalTime;
    finalJSON.metadata.phaseBreakdown = timings;
    finalJSON.metadata.stage = 'completed';
    finalJSON.metadata.pipelineVersion = '5.1-5.4-corrected';

    // Validação final - garantir que não temos NaN/Infinity
    try {
      assertFinite(finalJSON, 'output_scoring');
    } catch (validationError) {
      throw makeErr('output_scoring', `Final validation failed: ${validationError.message}`, 'final_validation_error');
    }

    console.log(`🏁 [${jobId.substring(0,8)}] Pipeline completo finalizado em ${totalTime}ms`);
    
    logAudio('pipeline', 'done', {
      ms: totalTime,
      meta: {
        phases: Object.keys(timings),
        score: finalJSON.score,
        size: JSON.stringify(finalJSON).length
      }
    });

    return finalJSON;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // Log estruturado do erro
    logAudio('pipeline', 'error', {
      code: error.code || 'unknown',
      message: error.message,
      stage: error.stage || 'unknown',
      stackSnippet: error.stackSnippet
    });
    
    console.error(`💥 [${jobId.substring(0,8)}] Pipeline falhou após ${totalTime}ms:`, error.message);
    console.error(`� [${jobId.substring(0,8)}] Stage: ${error.stage || 'unknown'}, Code: ${error.code || 'unknown'}`);
    
    // ========= ESTRUTURAR ERRO FINAL =========
    // NÃO retornar JSON de erro - propagar para camada de jobs
    // A camada de jobs decidirá como marcar o status
    
    // Se já é um erro estruturado, re-propagar
    if (error.stage) {
      throw error;
    }
    
    // Erro inesperado - estruturar
    throw makeErr('pipeline', `Pipeline failed: ${error.message}`, 'pipeline_error');
  }
}
    const phase4StartTime = Date.now();
    const metadata = {
      fileName,
      fileSize: audioBuffer.length,
      processingTime: Date.now() - startTime
    };
    const reference = options.reference || options.genre || null;
    console.log(`🔧 [${jobId.substring(0,8)}] Metadata preparado, chamando generateJSONOutput...`);
    const finalJSON = generateJSONOutput(coreMetrics, reference, metadata);
    const phase4Time = Date.now() - phase4StartTime;
    console.log(`✅ [${jobId.substring(0,8)}] Fase 5.4 concluída em ${phase4Time}ms`);
    console.log(`🎯 [${jobId.substring(0,8)}] Score final: ${finalJSON.score}% (${finalJSON.classification})`);

    // ✅ Estatísticas finais
    const totalTime = Date.now() - startTime;
    console.log(`📊 [${jobId.substring(0,8)}] Preparando estatísticas finais...`);
    finalJSON.metadata.processingTime = totalTime;
    finalJSON.metadata.phaseBreakdown = {
      phase1_decoding: phase1Time,
      phase2_segmentation: phase2Time, 
      phase3_core_metrics: phase3Time,
      phase4_json_output: phase4Time,
      total: totalTime
    };

    console.log(`🏁 [${jobId.substring(0,8)}] Pipeline completo finalizado em ${totalTime}ms`);

    return finalJSON;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`💥 [${jobId.substring(0,8)}] Pipeline falhou após ${totalTime}ms:`, error.message);
    console.error(`📜 [${jobId.substring(0,8)}] Stack:`, error.stack);

    // 🔧 Retornar JSON de erro estruturado
    return {
      status: 'error',
      error: {
        message: error.message,
        type: 'pipeline_error',
        phase: identifyFailedPhase(error.message),
        timestamp: new Date().toISOString(),
        processingTime: totalTime
      },
      score: 50,
      classification: 'Erro',
      scoringMethod: 'error_fallback',
      metadata: {
        fileName,
        fileSize: audioBuffer.length,
        sampleRate: 48000,
        channels: 2,
        duration: 0,
        processedAt: new Date().toISOString(),
        engineVersion: '5.1-5.4-error',
        pipelinePhase: 'error'
      },
      technicalData: {},
      warnings: [`Pipeline error: ${error.message}`],
      buildVersion: '5.4.0-pipeline-error',
      frontendCompatible: false
    };
  }
}

function identifyFailedPhase(errorMessage) {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('decode')) return 'phase_5_1_decoding';
  if (msg.includes('fft') || msg.includes('segment')) return 'phase_5_2_segmentation';
  if (msg.includes('lufs') || msg.includes('true peak')) return 'phase_5_3_core_metrics';
  if (msg.includes('json') || msg.includes('score')) return 'phase_5_4_json_output';
  return 'unknown_phase';
}

export async function calculateAudioScore(audioBuffer, fileName, reference = null) {
  try {
    const result = await processAudioComplete(audioBuffer, fileName, { reference });
    return {
      score: result.score,
      classification: result.classification,
      method: result.scoringMethod,
      processingTime: result.metadata.processingTime,
      fileName,
      status: 'success'
    };
  } catch (error) {
    return {
      score: 50,
      classification: 'Erro',
      method: 'error_fallback',
      fileName,
      status: 'error',
      error: error.message
    };
  }
}

export default { processAudioComplete, calculateAudioScore };
