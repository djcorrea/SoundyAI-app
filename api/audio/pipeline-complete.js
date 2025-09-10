// 🎯 PIPELINE COMPLETO FASES 5.1 - 5.4
// Integração completa: Decodificação → Segmentação → Core Metrics → JSON Output + Scoring

import decodeAudioFile from "./audio-decoder.js";              // Fase 5.1
import { segmentAudioTemporal } from "./temporal-segmentation.js"; // Fase 5.2  
import { calculateCoreMetrics } from "./core-metrics.js";      // Fase 5.3
import { generateJSONOutput } from "./json-output.js";         // Fase 5.4

console.log('🎵 Pipeline Completo (Fases 5.1-5.4) carregado - Node.js Backend');

/**
 * Executa pipeline completo de análise de áudio
 * @param {Buffer|Uint8Array} audioBuffer - Buffer do arquivo de áudio
 * @param {string} fileName - Nome do arquivo
 * @param {Object} options - Opções de processamento
 * @returns {Object} JSON final com métricas e score
 */
export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  const startTime = Date.now();
  
  console.log(`🚀 Iniciando pipeline completo para: ${fileName}`);
  console.log(`📊 Buffer size: ${audioBuffer.length} bytes`);
  console.log(`🔧 Opções:`, options);

  try {
    // ✅ FASE 5.1: Decodificação de Áudio
    console.log('🎵 Fase 5.1: Decodificação...');
    const phaseStartTime = Date.now();
    
    const audioData = await decodeAudioFile(audioBuffer, fileName);
    const phase1Time = Date.now() - phaseStartTime;
    
    console.log(`✅ Fase 5.1 concluída em ${phase1Time}ms`);
    console.log(`📊 Audio decodificado: ${audioData.sampleRate}Hz, ${audioData.channels}ch, ${audioData.duration.toFixed(2)}s`);

    // ✅ FASE 5.2: Segmentação Temporal
    console.log('⏱️ Fase 5.2: Segmentação Temporal...');
    const phase2StartTime = Date.now();
    
    const segmentedData = segmentAudioTemporal(audioData);
    const phase2Time = Date.now() - phase2StartTime;
    
    console.log(`✅ Fase 5.2 concluída em ${phase2Time}ms`);
    console.log(`📊 FFT frames: ${segmentedData.framesFFT.left.length}, RMS frames: ${segmentedData.framesRMS.left.length}`);

    // ✅ FASE 5.3: Core Metrics
    console.log('📊 Fase 5.3: Core Metrics...');
    const phase3StartTime = Date.now();
    
    const coreMetrics = await calculateCoreMetrics(segmentedData);
    const phase3Time = Date.now() - phase3StartTime;
    
    console.log(`✅ Fase 5.3 concluída em ${phase3Time}ms`);
    console.log(`📊 LUFS: ${coreMetrics.lufs.integrated.toFixed(1)}`, 
                `True Peak: ${coreMetrics.truePeak.maxDbtp.toFixed(1)}dBTP`,
                `Correlação: ${coreMetrics.stereo.correlation.toFixed(3)}`);

    // ✅ FASE 5.4: JSON Output + Scoring
    console.log('🎯 Fase 5.4: JSON Output + Scoring...');
    const phase4StartTime = Date.now();
    
    // Preparar metadados
    const metadata = {
      fileName,
      fileSize: audioBuffer.length,
      processingTime: Date.now() - startTime
    };

    // Referência de gênero (se fornecida)
    const reference = options.reference || options.genre || null;
    
    const finalJSON = generateJSONOutput(coreMetrics, reference, metadata);
    const phase4Time = Date.now() - phase4StartTime;
    
    console.log(`✅ Fase 5.4 concluída em ${phase4Time}ms`);
    console.log(`🎯 Score final: ${finalJSON.score}% (${finalJSON.classification})`);

    // ✅ Estatísticas finais
    const totalTime = Date.now() - startTime;
    console.log(`🏁 Pipeline completo finalizado em ${totalTime}ms`);
    console.log(`⚡ Breakdown: Decodificação=${phase1Time}ms, Segmentação=${phase2Time}ms, Core=${phase3Time}ms, JSON=${phase4Time}ms`);

    // Atualizar tempo no resultado final
    finalJSON.metadata.processingTime = totalTime;
    finalJSON.metadata.phaseBreakdown = {
      phase1_decoding: phase1Time,
      phase2_segmentation: phase2Time, 
      phase3_core_metrics: phase3Time,
      phase4_json_output: phase4Time,
      total: totalTime
    };

    return finalJSON;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Pipeline falhou após ${totalTime}ms:`, error);

    // Retornar JSON de erro estruturado
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

/**
 * Identifica em qual fase o pipeline falhou
 */
function identifyFailedPhase(errorMessage) {
  const message = errorMessage.toLowerCase();
  
  if (message.includes('ffmpeg') || message.includes('decode') || message.includes('audio format')) {
    return 'phase_5_1_decoding';
  }
  
  if (message.includes('fft') || message.includes('segment') || message.includes('temporal')) {
    return 'phase_5_2_segmentation';
  }
  
  if (message.includes('lufs') || message.includes('true peak') || message.includes('core metric')) {
    return 'phase_5_3_core_metrics';
  }
  
  if (message.includes('json') || message.includes('scoring') || message.includes('score')) {
    return 'phase_5_4_json_output';
  }
  
  return 'unknown_phase';
}

/**
 * Versão simplificada que apenas calcula o score
 * @param {Buffer|Uint8Array} audioBuffer - Buffer do arquivo
 * @param {string} fileName - Nome do arquivo
 * @param {Object} reference - Referência de gênero
 * @returns {Object} Apenas score e classificação
 */
export async function calculateAudioScore(audioBuffer, fileName, reference = null) {
  console.log(`🎯 Calculando score para: ${fileName}`);
  
  try {
    const fullResult = await processAudioComplete(audioBuffer, fileName, { reference });
    
    return {
      score: fullResult.score,
      classification: fullResult.classification,
      method: fullResult.scoringMethod,
      processingTime: fullResult.metadata.processingTime,
      fileName: fileName,
      status: 'success'
    };
    
  } catch (error) {
    console.error('❌ Erro ao calcular score:', error);
    
    return {
      score: 50,
      classification: 'Erro',
      method: 'error_fallback',
      processingTime: 0,
      fileName: fileName,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Valida se o pipeline está funcionando corretamente
 * @returns {Promise<boolean>} True se pipeline OK
 */
export async function validatePipeline() {
  console.log('🧪 Validando pipeline completo...');
  
  try {
    // Gerar sinal de teste (1kHz, 1 segundo, 48kHz)
    const testAudio = generateTestAudio();
    console.log('🎵 Sinal de teste gerado');
    
    // Processar com pipeline completo
    const result = await processAudioComplete(testAudio, 'test-signal.wav');
    
    // Verificações básicas
    const checks = [
      { name: 'Status success', pass: result.status === 'success' },
      { name: 'Score válido', pass: Number.isFinite(result.score) && result.score >= 0 && result.score <= 100 },
      { name: 'Classificação presente', pass: !!result.classification },
      { name: 'LUFS válido', pass: Number.isFinite(result.technicalData.lufsIntegrated) },
      { name: 'True Peak válido', pass: Number.isFinite(result.technicalData.truePeakDbtp) },
      { name: 'Correlação válida', pass: Number.isFinite(result.technicalData.stereoCorrelation) },
      { name: 'JSON serializável', pass: !!JSON.stringify(result) }
    ];
    
    const failedChecks = checks.filter(check => !check.pass);
    
    if (failedChecks.length === 0) {
      console.log('✅ Pipeline validado com sucesso!');
      console.log(`🎯 Score teste: ${result.score}% (${result.classification})`);
      return true;
    } else {
      console.error('❌ Validação falhou:');
      failedChecks.forEach(check => console.error(`  - ${check.name}`));
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erro na validação:', error);
    return false;
  }
}

/**
 * Gera áudio de teste para validação
 */
function generateTestAudio() {
  // Simular WAV de 1 segundo, 48kHz, estéreo, 1kHz sine wave
  const sampleRate = 48000;
  const duration = 1.0;
  const frequency = 1000;
  const samples = Math.floor(sampleRate * duration);
  
  // Header WAV simplificado (44 bytes)
  const headerSize = 44;
  const dataSize = samples * 4; // 2 channels * 2 bytes per sample
  const fileSize = headerSize + dataSize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // WAV Header
  let offset = 0;
  
  // "RIFF"
  view.setUint32(offset, 0x52494646, false); offset += 4;
  // File size - 8
  view.setUint32(offset, fileSize - 8, true); offset += 4;
  // "WAVE"
  view.setUint32(offset, 0x57415645, false); offset += 4;
  // "fmt "
  view.setUint32(offset, 0x666d7420, false); offset += 4;
  // fmt chunk size
  view.setUint32(offset, 16, true); offset += 4;
  // Audio format (1 = PCM)
  view.setUint16(offset, 1, true); offset += 2;
  // Channels
  view.setUint16(offset, 2, true); offset += 2;
  // Sample rate
  view.setUint32(offset, sampleRate, true); offset += 4;
  // Byte rate
  view.setUint32(offset, sampleRate * 4, true); offset += 4;
  // Block align
  view.setUint16(offset, 4, true); offset += 2;
  // Bits per sample
  view.setUint16(offset, 16, true); offset += 2;
  // "data"
  view.setUint32(offset, 0x64617461, false); offset += 4;
  // Data chunk size
  view.setUint32(offset, dataSize, true); offset += 4;
  
  // Audio data (1kHz sine wave)
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5; // -6dB
    const intSample = Math.round(sample * 32767);
    
    // Left channel
    view.setInt16(offset, intSample, true); offset += 2;
    // Right channel  
    view.setInt16(offset, intSample, true); offset += 2;
  }
  
  return new Uint8Array(buffer);
}

/**
 * Pipeline completo para uso em API/servidor
 */
export default {
  processAudioComplete,
  calculateAudioScore,
  validatePipeline
};