// 🧪 TESTE COMPLETO DO PIPELINE COM TRUE PEAK FFMPEG
// Verificar se o pipeline completo funciona com a nova implementação

import { processAudioComplete } from './work/api/audio/pipeline-complete.js';
import fs from 'fs';

console.log('🧪 [PIPELINE_FFMPEG_TEST] Iniciando teste completo do pipeline...');

// Criar um arquivo WAV de teste mais realista
function createTestWavFile() {
  const sampleRate = 48000;
  const numChannels = 2;
  const duration = 2; // 2 segundos
  const bitsPerSample = 16;
  const numSamples = sampleRate * duration * numChannels;
  
  // Header WAV (44 bytes)
  const buffer = Buffer.alloc(44 + numSamples * 2);
  let offset = 0;
  
  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + numSamples * 2, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  
  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, offset); offset += 4;
  buffer.writeUInt16LE(numChannels * bitsPerSample / 8, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  
  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(numSamples * 2, offset); offset += 4;
  
  // Audio data - mistura de frequências para teste realista
  for (let i = 0; i < numSamples / 2; i++) {
    // Mistura: 440Hz + 880Hz com amplitude moderada (-12dBFS)
    const fundamental = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.25;
    const harmonic = Math.sin(2 * Math.PI * 880 * i / sampleRate) * 0.125;
    const sample = fundamental + harmonic;
    
    // Aplicar fade-in/fade-out para evitar cliques
    const fadeLength = sampleRate * 0.1; // 0.1s fade
    let amplitude = 1.0;
    
    if (i < fadeLength) {
      amplitude = i / fadeLength;
    } else if (i > (numSamples / 2) - fadeLength) {
      amplitude = ((numSamples / 2) - i) / fadeLength;
    }
    
    const finalSample = sample * amplitude;
    const sampleInt = Math.round(finalSample * 32767);
    
    // Left channel
    buffer.writeInt16LE(sampleInt, offset);
    offset += 2;
    
    // Right channel (ligeiramente diferente para teste estéreo)
    const rightSample = finalSample * 0.9; // -1dB no canal direito
    const rightSampleInt = Math.round(rightSample * 32767);
    buffer.writeInt16LE(rightSampleInt, offset);
    offset += 2;
  }
  
  return buffer;
}

async function testPipelineComplete() {
  const testFileName = 'test-pipeline-ffmpeg.wav';
  
  try {
    console.log('🎵 [PIPELINE_FFMPEG_TEST] Criando arquivo de teste...');
    
    const testBuffer = createTestWavFile();
    console.log(`✅ [PIPELINE_FFMPEG_TEST] Arquivo criado: ${testBuffer.length} bytes`);
    
    console.log('🚀 [PIPELINE_FFMPEG_TEST] Executando pipeline completo...');
    
    const result = await processAudioComplete(testBuffer, testFileName, {
      jobId: 'ffmpeg-test-001',
      reference: 'test'
    });
    
    console.log('✅ [PIPELINE_FFMPEG_TEST] Pipeline executado com sucesso!');
    console.log('📊 [PIPELINE_FFMPEG_TEST] Resultado do pipeline:');
    
    // Verificar campos principais
    console.log('🎯 Score:', result.score);
    console.log('🏷️ Classificação:', result.classification);
    
    // Verificar True Peak específicamente
    console.log('🏔️ [PIPELINE_FFMPEG_TEST] True Peak (FFmpeg):');
    console.log(`  - truePeak.maxDbtp: ${result.truePeak?.maxDbtp}`);
    console.log(`  - truePeak.maxLinear: ${result.truePeak?.maxLinear}`);
    console.log(`  - technicalData.truePeakDbtp: ${result.technicalData?.truePeakDbtp}`);
    console.log(`  - technicalData.truePeakLinear: ${result.technicalData?.truePeakLinear}`);
    
    // Verificar outras métricas para completude
    console.log('📊 [PIPELINE_FFMPEG_TEST] Outras métricas:');
    console.log(`  - LUFS: ${result.technicalData?.lufsIntegrated}`);
    console.log(`  - Correlação: ${result.technicalData?.stereoCorrelation}`);
    console.log(`  - Range dinâmico: ${result.technicalData?.dynamicRange}`);
    
    // Verificar metadata de processamento
    console.log('⏱️ [PIPELINE_FFMPEG_TEST] Performance:');
    console.log(`  - Tempo total: ${result.metadata?.processingTime}ms`);
    console.log(`  - Fase 3 (core metrics): ${result.metadata?.phaseBreakdown?.phase3_core_metrics}ms`);
    
    // Verificar se True Peak não é null (indicaria falha do FFmpeg)
    if (result.truePeak?.maxDbtp !== null && result.truePeak?.maxDbtp !== undefined) {
      console.log('✅ [PIPELINE_FFMPEG_TEST] FFmpeg True Peak calculado com sucesso!');
      
      // Verificar se está dentro do range esperado para o sinal de teste
      const truePeakDbtp = result.truePeak.maxDbtp;
      if (truePeakDbtp >= -15 && truePeakDbtp <= -6) {
        console.log('✅ [PIPELINE_FFMPEG_TEST] True Peak dentro do range esperado');
      } else {
        console.log(`⚠️ [PIPELINE_FFMPEG_TEST] True Peak fora do range esperado: ${truePeakDbtp} dBTP`);
      }
    } else {
      console.log('❌ [PIPELINE_FFMPEG_TEST] FFmpeg True Peak FALHOU - valor é null');
    }
    
    // Verificar compatibilidade do JSON final
    const jsonSize = JSON.stringify(result).length;
    console.log(`📄 [PIPELINE_FFMPEG_TEST] JSON final: ${jsonSize} bytes`);
    
    if (result.truePeak && result.technicalData && result.metadata) {
      console.log('✅ [PIPELINE_FFMPEG_TEST] Estrutura JSON compatível mantida');
    } else {
      console.log('❌ [PIPELINE_FFMPEG_TEST] Estrutura JSON pode estar quebrada');
    }
    
  } catch (error) {
    console.error('💥 [PIPELINE_FFMPEG_TEST] Erro no teste:', error.message);
    console.error('📍 [PIPELINE_FFMPEG_TEST] Stack:', error.stack);
    
    // Verificar se é erro específico do FFmpeg
    if (error.message.includes('FFmpeg') || error.message.includes('tempFilePath')) {
      console.error('🔧 [PIPELINE_FFMPEG_TEST] Erro relacionado ao FFmpeg True Peak');
    }
  }
}

// Executar teste
testPipelineComplete()
  .then(() => {
    console.log('🏁 [PIPELINE_FFMPEG_TEST] Teste concluído');
  })
  .catch(error => {
    console.error('💥 [PIPELINE_FFMPEG_TEST] Teste falhou:', error.message);
    process.exit(1);
  });