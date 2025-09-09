/**
 * Exemplo de Integração - Fases 5.1 + 5.2
 * 
 * Demonstra como integrar a decodificação (5.1) com a segmentação temporal (5.2)
 * Pipeline completo: Arquivo → Float32Array → Frames segmentados
 */

import { decodeAudioFile } from './audio-decoder.js';
import { segmentAudioTemporal, calculateFrameTiming } from './temporal-segmentation.js';
import { generateTestWav } from './test-audio-decoder.js';

/**
 * Pipeline completo: Decodificação + Segmentação
 * 
 * @param {Buffer} audioFileBuffer - Buffer do arquivo de áudio
 * @param {string} filename - Nome do arquivo
 * @returns {Promise<Object>} - Dados segmentados prontos para análise
 */
export async function processAudioComplete(audioFileBuffer, filename) {
  const startTime = Date.now();
  
  try {
    console.log(`[PIPELINE] Iniciando processamento completo: ${filename}`);
    
    // FASE 5.1: Decodificação
    console.log(`[PIPELINE] Fase 5.1: Decodificação...`);
    const audioData = await decodeAudioFile(audioFileBuffer, filename);
    
    console.log(`[PIPELINE] Fase 5.1 concluída:`, {
      sampleRate: audioData.sampleRate,
      channels: audioData.numberOfChannels,
      duration: audioData.duration,
      samples: audioData.length
    });
    
    // FASE 5.2: Segmentação Temporal
    console.log(`[PIPELINE] Fase 5.2: Segmentação temporal...`);
    const segmentedData = segmentAudioTemporal(audioData);
    
    console.log(`[PIPELINE] Fase 5.2 concluída:`, {
      fftFrames: segmentedData.framesFFT.count,
      rmsFrames: segmentedData.framesRMS.count,
      fftFrameSize: segmentedData.framesFFT.frameSize,
      rmsFrameSize: segmentedData.framesRMS.frameSize
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[PIPELINE] Pipeline completo executado em ${totalTime}ms`);
    
    // Estrutura de retorno com dados das duas fases
    return {
      // Dados originais (Fase 5.1)
      original: {
        filename: filename,
        sampleRate: audioData.sampleRate,
        numberOfChannels: audioData.numberOfChannels,
        length: audioData.length,
        duration: audioData.duration,
        originalFormat: audioData._metadata.originalFormat,
        decodingTime: audioData._metadata.processingTime
      },
      
      // Dados segmentados (Fase 5.2)
      segmented: segmentedData,
      
      // Metadados do pipeline
      pipeline: {
        phase: '5.1+5.2-complete',
        totalProcessingTime: totalTime,
        processedAt: new Date().toISOString(),
        readyForPhases: ['5.3-metrics', '5.4-scoring']
      }
    };
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[PIPELINE] Erro após ${totalTime}ms:`, error);
    
    // Re-throw com contexto do pipeline
    const enhancedError = new Error(`PIPELINE_FAILED: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.phase = error.phase || 'unknown';
    enhancedError.totalProcessingTime = totalTime;
    
    throw enhancedError;
  }
}

/**
 * Exemplo prático: Processar arquivo WAV sintético
 */
export async function demonstrateFullPipeline() {
  console.log('🎵 DEMONSTRAÇÃO DO PIPELINE COMPLETO (5.1 + 5.2)');
  console.log('═'.repeat(60));
  
  try {
    // Gerar WAV de teste (3 segundos, estéreo, 440Hz)
    console.log('1️⃣ Gerando arquivo WAV de teste...');
    const testWav = generateTestWav(3.0, 440);
    console.log(`   WAV gerado: ${testWav.length} bytes, 3.0s, estéreo, 440Hz`);
    
    // Processar através do pipeline completo
    console.log('\n2️⃣ Executando pipeline completo...');
    const result = await processAudioComplete(testWav, 'demo-pipeline.wav');
    
    // Analisar resultados
    console.log('\n3️⃣ Analisando resultados...');
    
    console.log('\n📊 RESULTADOS DA FASE 5.1 (Decodificação):');
    console.log(`   ✅ Sample Rate: ${result.original.sampleRate} Hz`);
    console.log(`   ✅ Canais: ${result.original.numberOfChannels}`);
    console.log(`   ✅ Duração: ${result.original.duration.toFixed(3)}s`);
    console.log(`   ✅ Samples: ${result.original.length} por canal`);
    console.log(`   ✅ Tempo decodificação: ${result.original.decodingTime}ms`);
    
    console.log('\n📊 RESULTADOS DA FASE 5.2 (Segmentação):');
    console.log(`   ✅ Frames FFT: ${result.segmented.framesFFT.count} (${result.segmented.framesFFT.frameSize} samples cada)`);
    console.log(`   ✅ Frames RMS: ${result.segmented.framesRMS.count} (${result.segmented.framesRMS.frameSize} samples cada)`);
    console.log(`   ✅ FFT Hop: ${result.segmented.framesFFT.hopSize} samples (${result.segmented.framesFFT.windowType} window)`);
    console.log(`   ✅ RMS Hop: ${result.segmented.framesRMS.hopSize} samples (${result.segmented.framesRMS.hopDurationMs}ms)`);
    console.log(`   ✅ Tempo segmentação: ${result.segmented._metadata.processingTime}ms`);
    
    console.log('\n📊 PIPELINE GERAL:');
    console.log(`   ✅ Tempo total: ${result.pipeline.totalProcessingTime}ms`);
    console.log(`   ✅ Fases completas: 5.1 + 5.2`);
    console.log(`   ✅ Próximas fases: ${result.pipeline.readyForPhases.join(', ')}`);
    
    // Validações específicas
    console.log('\n4️⃣ Validações específicas...');
    
    // Validar cálculo de frames para 3 segundos (144000 samples)
    const expectedFFT = Math.floor((144000 - 4096) / 1024) + 1; // 137 frames
    const expectedRMS = Math.floor(144000 / 4800); // 30 frames
    
    if (result.segmented.framesFFT.count !== expectedFFT) {
      throw new Error(`FFT frames incorreto: ${result.segmented.framesFFT.count} !== ${expectedFFT}`);
    }
    
    if (result.segmented.framesRMS.count !== expectedRMS) {
      throw new Error(`RMS frames incorreto: ${result.segmented.framesRMS.count} !== ${expectedRMS}`);
    }
    
    console.log(`   ✅ FFT frames: ${result.segmented.framesFFT.count} (esperado: ${expectedFFT})`);
    console.log(`   ✅ RMS frames: ${result.segmented.framesRMS.count} (esperado: ${expectedRMS})`);
    
    // Verificar que os frames têm os tamanhos corretos
    const firstFFTFrame = result.segmented.framesFFT.left[0];
    const firstRMSFrame = result.segmented.framesRMS.left[0];
    
    if (firstFFTFrame.length !== 4096) {
      throw new Error(`FFT frame size incorreto: ${firstFFTFrame.length} !== 4096`);
    }
    
    if (firstRMSFrame.length !== 14400) {
      throw new Error(`RMS frame size incorreto: ${firstRMSFrame.length} !== 14400`);
    }
    
    console.log(`   ✅ FFT frame size: ${firstFFTFrame.length} samples`);
    console.log(`   ✅ RMS frame size: ${firstRMSFrame.length} samples`);
    
    // Verificar janela Hann aplicada
    if (Math.abs(firstFFTFrame[0]) > 0.01 || Math.abs(firstFFTFrame[4095]) > 0.01) {
      throw new Error('Janela Hann não foi aplicada corretamente');
    }
    
    console.log(`   ✅ Janela Hann aplicada (bordas ~0)`);
    
    console.log('\n🎉 DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('Pipeline 5.1 + 5.2 está funcionando perfeitamente.');
    
    return {
      success: true,
      processingTime: result.pipeline.totalProcessingTime,
      fftFrames: result.segmented.framesFFT.count,
      rmsFrames: result.segmented.framesRMS.count,
      validations: 'all_passed'
    };
    
  } catch (error) {
    console.error('\n❌ ERRO NA DEMONSTRAÇÃO:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      success: false,
      error: error.message,
      phase: error.phase || 'unknown'
    };
  }
}

/**
 * Utilitário: Analisar timing de frames para debug
 */
export function analyzeFrameTiming(segmentedData) {
  const fftTiming = [];
  const rmsTiming = [];
  
  // Calcular timestamps dos frames FFT
  for (let i = 0; i < segmentedData.framesFFT.count; i++) {
    const timestamp = (i * segmentedData.framesFFT.hopSize) / segmentedData.sampleRate;
    fftTiming.push({
      frameIndex: i,
      startTime: timestamp.toFixed(6),
      startSample: i * segmentedData.framesFFT.hopSize
    });
  }
  
  // Calcular timestamps dos frames RMS
  for (let i = 0; i < segmentedData.framesRMS.count; i++) {
    const timestamp = (i * segmentedData.framesRMS.hopSize) / segmentedData.sampleRate;
    rmsTiming.push({
      frameIndex: i,
      startTime: timestamp.toFixed(6),
      startSample: i * segmentedData.framesRMS.hopSize
    });
  }
  
  return {
    audioDuration: segmentedData.duration,
    fft: {
      frameCount: segmentedData.framesFFT.count,
      timing: fftTiming.slice(0, 10), // Primeiros 10 para debug
      lastFrame: fftTiming[fftTiming.length - 1]
    },
    rms: {
      frameCount: segmentedData.framesRMS.count,
      timing: rmsTiming.slice(0, 10), // Primeiros 10 para debug
      lastFrame: rmsTiming[rmsTiming.length - 1]
    }
  };
}

// Executar demonstração se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateFullPipeline()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ ERRO CRÍTICO:', error);
      process.exit(1);
    });
}
