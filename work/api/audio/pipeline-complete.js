// 🎯 PIPELINE COMPLETO FASES 5.1 - 5.4
// Integração completa: Decodificação → Segmentação → Core Metrics → JSON Output + Scoring

import decodeAudioFile, { getAudioInfo } from "./audio-decoder.js";              // Fase 5.1
import { segmentAudioTemporal } from "./temporal-segmentation.js"; // Fase 5.2  
import { calculateCoreMetrics } from "./core-metrics.js";      // Fase 5.3
import { generateJSONOutput } from "./json-output.js";         // Fase 5.4

console.log('🎵 Pipeline Completo (Fases 5.1-5.4) carregado - Node.js Backend');

export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  const startTime = Date.now();
  
  console.log(`🚀 Iniciando pipeline completo para: ${fileName}`);
  console.log(`📊 Buffer size: ${audioBuffer.length} bytes`);
  console.log(`🔧 Opções:`, options);

  // 🛡️ TIMEOUT RIGOROSO: Máximo 2 minutos por análise
  const timeoutMs = options.timeoutMs || 120000;
  
  // 📊 Progress: Função callback para atualizar progresso
  const updateProgress = options.updateProgress || (() => {});
  
  return Promise.race([
    processAudioCompleteInternal(audioBuffer, fileName, { ...options, updateProgress }),
    new Promise((_, reject) => 
      setTimeout(() => {
        console.error(`⏰ TIMEOUT: Pipeline excedeu ${timeoutMs/1000}s para ${fileName}`);
        reject(new Error(`Pipeline timeout após ${timeoutMs/1000} segundos`));
      }, timeoutMs)
    )
  ]);
}

async function processAudioCompleteInternal(audioBuffer, fileName, options = {}) {
  const startTime = Date.now();
  const updateProgress = options.updateProgress || (() => {});

  try {
    // � Progress: Início
    updateProgress(5, 'Inicializando análise...');
    console.log('📊 Progress: 5% - Inicializando análise...');

    // �🔧 FASE 5.0: Extração de Metadados REAIS (ANTES da conversão)
    console.log('📋 Fase 5.0: Extraindo metadados originais do arquivo...');
    updateProgress(10, 'Extraindo metadados do arquivo...');
    console.log('📊 Progress: 10% - Extraindo metadados do arquivo...');
    
    const metadataStartTime = Date.now();
    const originalMetadata = await getAudioInfo(audioBuffer, fileName);
    const metadataTime = Date.now() - metadataStartTime;
    console.log(`✅ Metadados originais extraídos em ${metadataTime}ms`);
    console.log(`📊 Arquivo original: ${originalMetadata.sampleRate}Hz, ${originalMetadata.channels}ch, ${originalMetadata.duration.toFixed(2)}s`);

    // ✅ FASE 5.1: Decodificação
    console.log('🎵 Fase 5.1: Decodificação...');
    updateProgress(20, 'Decodificando áudio para análise...');
    console.log('📊 Progress: 20% - Decodificando áudio para análise...');
    
    const phaseStartTime = Date.now();
    const audioData = await decodeAudioFile(audioBuffer, fileName);
    const phase1Time = Date.now() - phaseStartTime;
    console.log(`✅ Fase 5.1 concluída em ${phase1Time}ms`);
    console.log(`📊 Audio decodificado: ${audioData.sampleRate}Hz, ${audioData.numberOfChannels}ch, ${audioData.duration.toFixed(2)}s`);

    // 🔧 PRESERVAR METADADOS ORIGINAIS no objeto audioData
    audioData.originalMetadata = {
      sampleRate: originalMetadata.sampleRate,
      channels: originalMetadata.channels,
      duration: originalMetadata.duration,
      bitrate: originalMetadata.bitrate,
      codec: originalMetadata.codec,
      format: originalMetadata.format
    };
    console.log(`🔧 Metadados originais preservados no audioData`);

    // ✅ FASE 5.2: Segmentação
    console.log('⏱️ Fase 5.2: Segmentação Temporal...');
    updateProgress(35, 'Segmentando áudio para análise FFT...');
    console.log('📊 Progress: 35% - Segmentando áudio para análise FFT...');
    
    const phase2StartTime = Date.now();
    const segmentedData = segmentAudioTemporal(audioData);
    
    // 🔧 PROPAGAR METADADOS ORIGINAIS para segmentedData
    segmentedData.originalMetadata = audioData.originalMetadata;
    
    const phase2Time = Date.now() - phase2StartTime;
    console.log(`✅ Fase 5.2 concluída em ${phase2Time}ms`);
    console.log(`📊 FFT frames: ${segmentedData.framesFFT.left.length}, RMS frames: ${segmentedData.framesRMS.left.length}`);

    // ✅ FASE 5.3: Core Metrics
    console.log('📊 Fase 5.3: Core Metrics...');
    updateProgress(50, 'Calculando LUFS e True Peak...');
    console.log('📊 Progress: 50% - Calculando LUFS e True Peak...');
    
    const phase3StartTime = Date.now();
    
    // 📊 Progress: Sub-etapas da Fase 5.3
    const progressCallback = (subProgress, message) => {
      const totalProgress = 50 + (subProgress * 0.35); // 50-85% para Core Metrics
      updateProgress(totalProgress, message);
      console.log(`📊 Progress: ${totalProgress.toFixed(1)}% - ${message}`);
    };
    
    const coreMetrics = await calculateCoreMetrics(segmentedData, { progressCallback });
    
    // 🔧 INCLUIR METADADOS ORIGINAIS nos coreMetrics
    coreMetrics.originalMetadata = segmentedData.originalMetadata;
    
    const phase3Time = Date.now() - phase3StartTime;
    console.log(`✅ Fase 5.3 concluída em ${phase3Time}ms`);
    console.log(`📊 LUFS: ${coreMetrics.lufs.integrated.toFixed(1)}`, 
                `True Peak: ${coreMetrics.truePeak.maxDbtp.toFixed(1)}dBTP`,
                `Correlação: ${coreMetrics.stereo.correlation.toFixed(3)}`);

    // ✅ FASE 5.4: JSON Output
    console.log('🎯 Fase 5.4: JSON Output + Scoring...');
    updateProgress(90, 'Finalizando análise e calculando score...');
    console.log('📊 Progress: 90% - Finalizando análise e calculando score...');
    
    const phase4StartTime = Date.now();
    const metadata = {
      fileName,
      fileSize: audioBuffer.length,
      processingTime: Date.now() - startTime,
      // 🔧 INCLUIR METADADOS ORIGINAIS REAIS
      originalSampleRate: coreMetrics.originalMetadata?.sampleRate || 48000,
      originalChannels: coreMetrics.originalMetadata?.channels || 2, 
      originalDuration: coreMetrics.originalMetadata?.duration || 0,
      originalBitrate: coreMetrics.originalMetadata?.bitrate || 0,
      originalCodec: coreMetrics.originalMetadata?.codec || 'unknown',
      originalFormat: coreMetrics.originalMetadata?.format || 'unknown'
    };
    const reference = options.reference || options.genre || null;
    const finalJSON = generateJSONOutput(coreMetrics, reference, metadata);
    const phase4Time = Date.now() - phase4StartTime;
    console.log(`✅ Fase 5.4 concluída em ${phase4Time}ms`);
    console.log(`🎯 Score final: ${finalJSON.score}% (${finalJSON.classification})`);

    // ✅ Estatísticas finais
    const totalTime = Date.now() - startTime;
    finalJSON.metadata.processingTime = totalTime;
    finalJSON.metadata.phaseBreakdown = {
      phase1_decoding: phase1Time,
      phase2_segmentation: phase2Time, 
      phase3_core_metrics: phase3Time,
      phase4_json_output: phase4Time,
      total: totalTime
    };

    // 📊 Progress: Concluído!
    updateProgress(100, `Análise concluída! Score: ${finalJSON.score}%`);
    console.log(`📊 Progress: 100% - Análise concluída! Score: ${finalJSON.score}%`);

    console.log(`🏁 Pipeline completo finalizado em ${totalTime}ms`);

    return finalJSON;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Pipeline falhou após ${totalTime}ms:`, error);

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
