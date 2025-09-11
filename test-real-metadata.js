// TESTE DEFINITIVO: Validação de Metadados REAIS
import { processAudioComplete } from './work/api/audio/pipeline-complete.js';
import { getAudioInfo } from './work/api/audio/audio-decoder.js';
import fs from 'fs';

console.log('🔬 TESTE DEFINITIVO: Extração de Metadados REAIS');
console.log('===================================================');

// Função para criar arquivo de teste com metadados específicos
function createTestWavWithCustomMetadata(sampleRate = 44100, channels = 1, duration = 3) {
  const samplesPerChannel = Math.floor(sampleRate * duration);
  const totalSamples = samplesPerChannel * channels;
  
  // WAV header
  const headerSize = 44;
  const dataSize = totalSamples * 4; // Float32 = 4 bytes
  const fileSize = headerSize + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk  
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(3, 20);  // format = IEEE Float
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 4, 28); // byte rate
  buffer.writeUInt16LE(channels * 4, 32); // block align
  buffer.writeUInt16LE(32, 34); // bits per sample
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Gerar dados de áudio (seno 1000Hz)
  for (let i = 0; i < samplesPerChannel; i++) {
    const t = i / sampleRate;
    const sample = 0.5 * Math.sin(2 * Math.PI * 1000 * t);
    
    for (let ch = 0; ch < channels; ch++) {
      const offset = 44 + (i * channels + ch) * 4;
      buffer.writeFloatLE(sample * (ch === 0 ? 1.0 : 0.7), offset); // Ligeiramente diferente por canal
    }
  }
  
  return buffer;
}

async function testRealMetadataExtraction() {
  console.log('🧪 Teste 1: Arquivo 44.1kHz, Mono, 3s');
  console.log('====================================');
  
  try {
    // Criar arquivo de teste com metadados específicos
    const testBuffer = createTestWavWithCustomMetadata(44100, 1, 3);
    console.log(`📁 Arquivo criado: 44.1kHz, 1 canal, 3 segundos`);
    
    // 1. Testar extração direta de metadados
    console.log('\n🔍 1. Testando extração direta via getAudioInfo...');
    const audioInfo = await getAudioInfo(testBuffer, 'test-44khz-mono.wav');
    console.log('✅ Metadados extraídos via FFprobe:');
    console.log(`   - Sample Rate: ${audioInfo.sampleRate} Hz (esperado: 44100)`);
    console.log(`   - Channels: ${audioInfo.channels} (esperado: 1)`);
    console.log(`   - Duration: ${audioInfo.duration.toFixed(2)}s (esperado: ~3.00)`);
    console.log(`   - Codec: ${audioInfo.codec}`);
    console.log(`   - Format: ${audioInfo.format}`);
    
    // 2. Testar pipeline completo
    console.log('\n🔄 2. Testando pipeline completo...');
    const result = await processAudioComplete(testBuffer, 'test-44khz-mono.wav', {
      timeoutMs: 30000
    });
    
    console.log('\n📊 RESULTADO FINAL:');
    console.log('==================');
    
    // Verificar se metadados originais foram preservados
    if (result.metadata) {
      console.log('✅ result.metadata existe!');
      console.log(`   - sampleRate: ${result.metadata.sampleRate} (esperado: 44100)`);
      console.log(`   - channels: ${result.metadata.channels} (esperado: 1)`);
      console.log(`   - duration: ${result.metadata.duration} (esperado: ~3)`);
      console.log(`   - codec: ${result.metadata.codec}`);
      console.log(`   - format: ${result.metadata.format}`);
      console.log(`   - bitrate: ${result.metadata.bitrate}`);
    } else {
      console.log('❌ result.metadata está undefined!');
    }
    
    if (result.technicalData) {
      console.log('✅ result.technicalData existe!');
      console.log(`   - sampleRate: ${result.technicalData.sampleRate}`);
      console.log(`   - channels: ${result.technicalData.channels}`);
      console.log(`   - duration: ${result.technicalData.duration}`);
      console.log(`   - codec: ${result.technicalData.codec}`);
      console.log(`   - format: ${result.technicalData.format}`);
      console.log(`   - bitrate: ${result.technicalData.bitrate}`);
    } else {
      console.log('❌ result.technicalData está undefined!');
    }
    
    // 3. Validar que metadados ORIGINAIS foram preservados (não os processados)
    const originalCorrect = result.metadata.sampleRate === 44100 && 
                           result.metadata.channels === 1 && 
                           Math.abs(result.metadata.duration - 3.0) < 0.1;
                           
    if (originalCorrect) {
      console.log('\n🎊 SUCESSO: Metadados ORIGINAIS preservados corretamente!');
    } else {
      console.log('\n💥 FALHA: Metadados originais não foram preservados');
      console.log(`   - Esperado: 44100Hz, 1ch, ~3s`);
      console.log(`   - Obtido: ${result.metadata.sampleRate}Hz, ${result.metadata.channels}ch, ${result.metadata.duration}s`);
    }
    
    return originalCorrect;
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    return false;
  }
}

async function testDifferentFormats() {
  console.log('\n🧪 Teste 2: Arquivo 48kHz, Estéreo, 1s');
  console.log('=======================================');
  
  try {
    const testBuffer = createTestWavWithCustomMetadata(48000, 2, 1);
    console.log(`📁 Arquivo criado: 48kHz, 2 canais, 1 segundo`);
    
    const result = await processAudioComplete(testBuffer, 'test-48khz-stereo.wav', {
      timeoutMs: 30000
    });
    
    const correct = result.metadata.sampleRate === 48000 && 
                   result.metadata.channels === 2 && 
                   Math.abs(result.metadata.duration - 1.0) < 0.1;
                   
    if (correct) {
      console.log('✅ Teste 2 PASSOU: 48kHz estéreo correto');
    } else {
      console.log('❌ Teste 2 FALHOU');
      console.log(`   - Esperado: 48000Hz, 2ch, ~1s`);
      console.log(`   - Obtido: ${result.metadata.sampleRate}Hz, ${result.metadata.channels}ch, ${result.metadata.duration}s`);
    }
    
    return correct;
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE 2:', error.message);
    return false;
  }
}

// Executar todos os testes
async function runAllTests() {
  const test1 = await testRealMetadataExtraction();
  const test2 = await testDifferentFormats();
  
  console.log('\n🏁 RESULTADO FINAL DOS TESTES');
  console.log('==============================');
  console.log(`Teste 1 (44.1kHz Mono): ${test1 ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`Teste 2 (48kHz Estéreo): ${test2 ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  if (test1 && test2) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    console.log('✅ Metadados REAIS estão sendo extraídos e preservados corretamente');
    console.log('✅ Pipeline não está mais forçando valores fixos');
    console.log('✅ FFprobe está funcionando corretamente');
    process.exit(0);
  } else {
    console.log('\n💥 ALGUNS TESTES FALHARAM!');
    console.log('❌ Correção de metadata ainda não está completa');
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('\n💥 ERRO CRÍTICO:', err);
  process.exit(1);
});
