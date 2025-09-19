// 🎯 PIPELINE COMPLETO FASES 5.1 - 5.4 - CORRIGIDO
// Integração completa com tratamento de erros padronizado e fail-fast

import decodeAudioFile from "./audio-decoder.js";              // Fase 5.1
import { segmentAudioTemporal } from "./temporal-segmentation.js"; // Fase 5.2  
import { calculateCoreMetrics } from "./core-metrics.js";      // Fase 5.3
import { generateJSONOutput } from "./json-output.js";         // Fase 5.4
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎵 Pipeline Completo (Fases 5.1-5.4) carregado - Node.js Backend CORRIGIDO');

/**
 * 🗂️ Criar arquivo temporário WAV para FFmpeg True Peak
 */
function createTempWavFile(audioBuffer, audioData, fileName, jobId) {
  try {
    const tempDir = path.join(__dirname, '../../temp');
    
    // Criar diretório temp se não existir
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFileName = `${jobId}_${Date.now()}_${path.parse(fileName).name}.wav`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    console.log(`[TEMP_WAV] Criando arquivo temporário: ${tempFileName}`);
    
    // Escrever o audioBuffer original no arquivo temporário
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    console.log(`[TEMP_WAV] ✅ Arquivo temporário criado: ${tempFilePath}`);
    
    return tempFilePath;
    
  } catch (error) {
    console.error(`[TEMP_WAV] ❌ Erro ao criar arquivo temporário: ${error.message}`);
    throw new Error(`Failed to create temp WAV file: ${error.message}`);
  }
}

/**
 * 🗑️ Limpar arquivo temporário
 */
function cleanupTempFile(tempFilePath) {
  try {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`[TEMP_WAV] 🗑️ Arquivo temporário removido: ${path.basename(tempFilePath)}`);
    }
  } catch (error) {
    console.warn(`[TEMP_WAV] ⚠️ Erro ao remover arquivo temporário: ${error.message}`);
  }
}

export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  const startTime = Date.now();
  
  console.log(`🚀 Iniciando pipeline completo para: ${fileName}`);
  console.log(`📊 Buffer size: ${audioBuffer.length} bytes`);
  console.log(`🔧 Opções:`, options);

  let tempFilePath = null;
  
  try {
    // ✅ FASE 5.1: Decodificação
    console.log('🎵 Fase 5.1: Decodificação...');
    const phaseStartTime = Date.now();
    const audioData = await decodeAudioFile(audioBuffer, fileName);
    const phase1Time = Date.now() - phaseStartTime;
    console.log(`✅ Fase 5.1 concluída em ${phase1Time}ms`);
    console.log(`📊 Audio decodificado: ${audioData.sampleRate}Hz, ${audioData.channels}ch, ${audioData.duration.toFixed(2)}s`);

    // 🗂️ Criar arquivo temporário para FFmpeg True Peak
    console.log('🗂️ Criando arquivo temporário WAV...');
    const jobId = options.jobId || Date.now().toString();
    tempFilePath = createTempWavFile(audioBuffer, audioData, fileName, jobId);

    // ✅ FASE 5.2: Segmentação
    console.log('⏱️ Fase 5.2: Segmentação Temporal...');
    const phase2StartTime = Date.now();
    const segmentedData = segmentAudioTemporal(audioData);
    const phase2Time = Date.now() - phase2StartTime;
    console.log(`✅ Fase 5.2 concluída em ${phase2Time}ms`);
    console.log(`📊 FFT frames: ${segmentedData.framesFFT.left.length}, RMS frames: ${segmentedData.framesRMS.left.length}`);

    // ✅ FASE 5.3: Core Metrics
    console.log('📊 Fase 5.3: Core Metrics...');
    const phase3StartTime = Date.now();
    const coreMetrics = await calculateCoreMetrics(segmentedData, { tempFilePath });
    const phase3Time = Date.now() - phase3StartTime;
    console.log(`✅ Fase 5.3 concluída em ${phase3Time}ms`);
    
    // 🔍 DEBUG: Estrutura do coreMetrics para investigar métricas espectrais
    console.log('🔍 [PIPELINE_COMPLETE] === DEBUG CORE METRICS STRUCTURE ===');
    console.log('🔍 [PIPELINE_COMPLETE] coreMetrics top-level keys:', Object.keys(coreMetrics));
    console.log('🔍 [PIPELINE_COMPLETE] coreMetrics.fft exists:', !!coreMetrics.fft);
    console.log('🔍 [PIPELINE_COMPLETE] coreMetrics.fft keys:', coreMetrics.fft ? Object.keys(coreMetrics.fft) : null);
    console.log('🔍 [PIPELINE_COMPLETE] coreMetrics.fft.aggregated exists:', !!coreMetrics.fft?.aggregated);
    console.log('🔍 [PIPELINE_COMPLETE] coreMetrics.fft.aggregated keys:', coreMetrics.fft?.aggregated ? Object.keys(coreMetrics.fft.aggregated) : null);
    if (coreMetrics.fft?.aggregated?.spectralCentroidHz) {
      console.log('✅ [PIPELINE_COMPLETE] spectralCentroidHz found:', coreMetrics.fft.aggregated.spectralCentroidHz);
    } else {
      console.log('❌ [PIPELINE_COMPLETE] spectralCentroidHz NOT FOUND in aggregated');
      // Log adicional para debug
      console.log('🔍 [PIPELINE_COMPLETE] Core metrics completo (primeiros 3 níveis):');
      console.log(JSON.stringify(coreMetrics, (key, value) => {
        if (typeof value === 'object' && value !== null && Object.keys(value).length > 10) {
          return `[Object with ${Object.keys(value).length} keys]`;
        }
        return value;
      }, 2));
    }
    console.log(`📊 LUFS: ${coreMetrics.lufs.integrated.toFixed(1)}`, 
                `True Peak: ${coreMetrics.truePeak.maxDbtp.toFixed(1)}dBTP`,
                `Correlação: ${coreMetrics.stereo.correlation.toFixed(3)}`);

    // ✅ FASE 5.4: JSON Output
    console.log('🎯 Fase 5.4: JSON Output + Scoring...');
    const phase4StartTime = Date.now();
    const metadata = {
      fileName,
      fileSize: audioBuffer.length,
      processingTime: Date.now() - startTime
    };
    const reference = (options && options.reference) || (options && options.genre) || null;
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

    console.log(`🏁 Pipeline completo finalizado em ${totalTime}ms`);

    // 🗑️ Limpar arquivo temporário
    cleanupTempFile(tempFilePath);

    return finalJSON;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Pipeline falhou após ${totalTime}ms:`, error);

    // 🗑️ Limpar arquivo temporário mesmo em caso de erro
    cleanupTempFile(tempFilePath);

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
