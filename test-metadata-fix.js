// Test Script: Verificar se a correção da metadata undefined está funcionando
import { processAudioComplete } from './work/api/audio/pipeline-complete.js';
import fs from 'fs';

console.log('🧪 TESTE: Verificação da correção da metadata undefined');
console.log('========================================================');

// Simulação de um buffer de áudio simples (WAV header + dados)
function createTestWavBuffer() {
  const sampleRate = 48000;
  const duration = 2; // 2 segundos
  const channels = 2;
  const samplesPerChannel = sampleRate * duration;
  const totalSamples = samplesPerChannel * channels;
  
  // WAV header simplificado para teste
  const headerSize = 44;
  const dataSize = totalSamples * 4; // Float32 = 4 bytes por sample
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
  
  // Gerar dados de áudio simples (seno 440Hz)
  for (let i = 0; i < samplesPerChannel; i++) {
    const t = i / sampleRate;
    const sample = 0.3 * Math.sin(2 * Math.PI * 440 * t); // 440Hz, amplitude 0.3
    
    // Canal esquerdo
    buffer.writeFloatLE(sample, 44 + i * 8);
    // Canal direito
    buffer.writeFloatLE(sample * 0.8, 44 + i * 8 + 4); // Ligeiramente diferente para teste estéreo
  }
  
  return buffer;
}

async function testMetadataFix() {
  try {
    console.log('📁 Criando buffer de teste WAV (48kHz, 2ch, 2s)...');
    const testBuffer = createTestWavBuffer();
    
    console.log('🎵 Processando com pipeline completo...');
    const result = await processAudioComplete(testBuffer, 'test-metadata-fix.wav', {
      timeoutMs: 30000 // 30 segundos de timeout
    });
    
    console.log('📊 RESULTADO DO TESTE:');
    console.log('======================');
    
    // Verificar se a metadata existe
    if (result.metadata) {
      console.log('✅ result.metadata existe!');
      console.log(`   - sampleRate: ${result.metadata.sampleRate} (esperado: 48000)`);
      console.log(`   - channels: ${result.metadata.channels} (esperado: 2)`);
      console.log(`   - duration: ${result.metadata.duration} (esperado: ~2)`);
      console.log(`   - processedAt: ${result.metadata.processedAt}`);
      console.log(`   - engineVersion: ${result.metadata.engineVersion}`);
    } else {
      console.log('❌ result.metadata está undefined!');
    }
    
    // Verificar technicalData também
    if (result.technicalData) {
      console.log('✅ result.technicalData existe!');
      console.log(`   - sampleRate em technicalData: ${result.technicalData.sampleRate || 'undefined'}`);
      console.log(`   - channels em technicalData: ${result.technicalData.channels || 'undefined'}`);
      console.log(`   - duration em technicalData: ${result.technicalData.duration || 'undefined'}`);
    } else {
      console.log('❌ result.technicalData está undefined!');
    }
    
    // Verificar score
    console.log(`🎯 Score: ${result.score} (${result.classification})`);
    
    // Status geral
    console.log(`📈 Status: ${result.status}`);
    
    // Verificar se há avisos
    if (result.warnings && result.warnings.length > 0) {
      console.log('⚠️ Avisos:', result.warnings);
    }
    
    // Teste de serialização JSON
    try {
      const jsonString = JSON.stringify(result, null, 2);
      console.log('✅ JSON serialization OK');
      
      // Verificar se sampleRate, channels, duration não são null/undefined no JSON
      const hasUndefinedMetadata = jsonString.includes('"sampleRate":null') || 
                                  jsonString.includes('"channels":null') || 
                                  jsonString.includes('"duration":null') ||
                                  jsonString.includes('"sampleRate":undefined') || 
                                  jsonString.includes('"channels":undefined') || 
                                  jsonString.includes('"duration":undefined');
      
      if (hasUndefinedMetadata) {
        console.log('❌ PROBLEMA: Metadata com valores null/undefined encontrados no JSON');
      } else {
        console.log('✅ SUCESSO: Não há valores null/undefined na metadata do JSON');
      }
      
    } catch (jsonErr) {
      console.log('❌ Erro na serialização JSON:', jsonErr.message);
    }
    
    console.log('\n🎉 TESTE CONCLUÍDO');
    console.log('===================');
    
    return result;
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

// Executar o teste
testMetadataFix().then((result) => {
  if (result && result.metadata && result.metadata.sampleRate && result.metadata.channels && result.metadata.duration) {
    console.log('\n🎊 CORREÇÃO VALIDADA: Metadata undefined foi corrigida com sucesso!');
    process.exit(0);
  } else {
    console.log('\n💥 CORREÇÃO FALHOU: Metadata ainda está undefined ou incompleta');
    process.exit(1);
  }
}).catch((err) => {
  console.error('\n💥 ERRO CRÍTICO:', err);
  process.exit(1);
});
