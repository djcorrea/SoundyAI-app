// TESTE FINAL: Criar arquivo de áudio real e testar metadata
import { processAudioComplete } from './work/api/audio/pipeline-complete.js';
import fs from 'fs';

console.log('🎵 TESTE FINAL: Metadata REAL no Pipeline Completo');
console.log('================================================');

// Função para criar um arquivo WAV válido com dados de áudio reais
function createRealWavFile(sampleRate = 44100, channels = 2, durationSeconds = 2) {
  const samplesPerChannel = Math.floor(sampleRate * durationSeconds);
  const totalSamples = samplesPerChannel * channels;
  
  // WAV header (44 bytes)
  const headerSize = 44;
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = totalSamples * bytesPerSample;
  const fileSize = headerSize + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);                      // Chunk size
  buffer.writeUInt16LE(1, 20);                       // Audio format (PCM)
  buffer.writeUInt16LE(channels, 22);                // Number of channels
  buffer.writeUInt32LE(sampleRate, 24);              // Sample rate
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // Byte rate
  buffer.writeUInt16LE(channels * bytesPerSample, 32); // Block align
  buffer.writeUInt16LE(16, 34);                      // Bits per sample
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Gerar dados de áudio reais (tons diferentes para cada canal)
  let dataOffset = 44;
  
  for (let i = 0; i < samplesPerChannel; i++) {
    const t = i / sampleRate;
    
    // Canal esquerdo: tom de 440Hz (Lá)
    const leftSample = Math.sin(2 * Math.PI * 440 * t) * 0.3;
    const leftValue = Math.round(leftSample * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, leftValue)), dataOffset);
    dataOffset += 2;
    
    if (channels === 2) {
      // Canal direito: tom de 880Hz (Lá uma oitava acima)
      const rightSample = Math.sin(2 * Math.PI * 880 * t) * 0.2;
      const rightValue = Math.round(rightSample * 32767);
      buffer.writeInt16LE(Math.max(-32768, Math.min(32767, rightValue)), dataOffset);
      dataOffset += 2;
    }
  }
  
  return buffer;
}

async function testWithRealAudio() {
  console.log('🎼 1. Criando arquivo de áudio de teste...');
  
  try {
    // Criar arquivo com características específicas para teste
    const testConfigs = [
      { sampleRate: 44100, channels: 2, duration: 2, name: '44.1kHz-Stereo-2s' },
      { sampleRate: 48000, channels: 1, duration: 1, name: '48kHz-Mono-1s' },
      { sampleRate: 22050, channels: 2, duration: 3, name: '22kHz-Stereo-3s' }
    ];
    
    for (const config of testConfigs) {
      console.log(`\n🧪 Testando: ${config.name}`);
      console.log('='.repeat(50));
      
      const audioBuffer = createRealWavFile(config.sampleRate, config.channels, config.duration);
      const filename = `test-${config.name}.wav`;
      
      console.log(`📁 Arquivo criado: ${config.sampleRate}Hz, ${config.channels}ch, ${config.duration}s`);
      console.log(`📦 Tamanho do buffer: ${audioBuffer.length} bytes`);
      
      // Processar através do pipeline completo
      console.log('🔄 Processando através do pipeline completo...');
      
      const startTime = Date.now();
      const result = await processAudioComplete(audioBuffer, filename, {
        timeoutMs: 60000 // 1 minuto
      });
      const endTime = Date.now();
      
      console.log(`⏱️  Tempo de processamento: ${endTime - startTime}ms`);
      
      // Verificar resultados
      console.log('\n📊 RESULTADO:');
      console.log('=============');
      
      if (result.metadata) {
        console.log('✅ result.metadata ENCONTRADO:');
        console.log(`   📊 Sample Rate: ${result.metadata.sampleRate} Hz (esperado: ${config.sampleRate})`);
        console.log(`   🎵 Channels: ${result.metadata.channels} (esperado: ${config.channels})`);
        console.log(`   ⏰ Duration: ${result.metadata.duration}s (esperado: ~${config.duration})`);
        console.log(`   🎧 Codec: ${result.metadata.codec || 'N/A'}`);
        console.log(`   📁 Format: ${result.metadata.format || 'N/A'}`);
        console.log(`   📈 Bitrate: ${result.metadata.bitrate || 'N/A'}`);
        
        // Verificar se os valores estão corretos
        const sampleRateCorrect = result.metadata.sampleRate === config.sampleRate;
        const channelsCorrect = result.metadata.channels === config.channels;
        const durationCorrect = Math.abs(result.metadata.duration - config.duration) < 0.2; // margem de 0.2s
        
        console.log(`\n🔍 VALIDAÇÃO:`);
        console.log(`   Sample Rate: ${sampleRateCorrect ? '✅ CORRETO' : '❌ INCORRETO'}`);
        console.log(`   Channels: ${channelsCorrect ? '✅ CORRETO' : '❌ INCORRETO'}`);
        console.log(`   Duration: ${durationCorrect ? '✅ CORRETO' : '❌ INCORRETO'}`);
        
        if (sampleRateCorrect && channelsCorrect && durationCorrect) {
          console.log('\n🎉 TESTE PASSOU! Metadados REAIS extraídos corretamente!');
        } else {
          console.log('\n💥 TESTE FALHOU! Metadados não coincidem!');
          return false;
        }
        
      } else {
        console.log('❌ result.metadata está UNDEFINED!');
        console.log('💥 FALHA CRÍTICA: metadata não foi extraído');
        return false;
      }
      
      // Verificar se technicalData também está correto
      if (result.technicalData) {
        console.log('\n✅ result.technicalData ENCONTRADO:');
        console.log(`   📊 Sample Rate: ${result.technicalData.sampleRate}`);
        console.log(`   🎵 Channels: ${result.technicalData.channels}`);
        console.log(`   ⏰ Duration: ${result.technicalData.duration}`);
      }
      
      // Verificar se o score foi calculado
      if (result.score !== undefined) {
        console.log(`\n🎯 Score calculado: ${result.score}/10`);
      }
      
      console.log(`\n✅ Teste "${config.name}" COMPLETO\n`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ ERRO no teste:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function runFinalTest() {
  console.log('🚀 INICIANDO TESTE FINAL...\n');
  
  const success = await testWithRealAudio();
  
  console.log('\n🏁 RESULTADO FINAL DO TESTE');
  console.log('============================');
  
  if (success) {
    console.log('🎊 TODOS OS TESTES PASSARAM!');
    console.log('✅ Metadata REAL está sendo extraído corretamente');
    console.log('✅ Pipeline Phase 5.0 funcionando perfeitamente');
    console.log('✅ Diferentes formatos (44.1kHz, 48kHz, mono, estéreo) testados');
    console.log('✅ Duração, sample rate e channels preservados');
    console.log('\n🎉 PROBLEMA DE "metadata undefined" FOI CORRIGIDO DEFINITIVAMENTE!');
    console.log('\n📝 RESUMO DA SOLUÇÃO:');
    console.log('   1. ✅ Phase 5.0 adicionada ao pipeline para extrair metadata ANTES do processamento');
    console.log('   2. ✅ getAudioInfo() usando FFprobe para ler metadados do arquivo original');
    console.log('   3. ✅ originalMetadata propagado através de todas as fases');
    console.log('   4. ✅ json-output.js atualizado para usar metadados originais');
    console.log('   5. ✅ worker-root.js com fallback melhorado usando music-metadata');
    console.log('\n💡 RESULTADO: Metadados são capturados do ARQUIVO REAL, não mais valores fixos!');
  } else {
    console.log('💥 ALGUNS TESTES FALHARAM!');
    console.log('❌ Ainda há problemas na implementação');
    console.log('💡 Revisar pipeline e logs de erro acima');
  }
}

runFinalTest().catch(console.error);
