import { decodeAudioFile, checkFFmpegAvailable } from './audio/audio-decoder.js';
import { generateTestWav } from './audio/test-audio-decoder.js';

async function testStereoDecoder() {
  console.log('🔍 Testando decoder estéreo...');
  
  try {
    // 1. Verificar FFmpeg
    console.log('1. Verificando FFmpeg...');
    const ffmpegOk = await checkFFmpegAvailable();
    console.log(`   FFmpeg disponível: ${ffmpegOk}`);
    
    if (!ffmpegOk) {
      throw new Error('FFmpeg não está disponível');
    }
    
    // 2. Gerar WAV de teste
    console.log('2. Gerando WAV de teste...');
    const testWav = generateTestWav(0.5, 440); // 0.5s, 440Hz
    console.log(`   WAV gerado: ${testWav.length} bytes`);
    
    // 3. Decodificar
    console.log('3. Decodificando...');
    const result = await decodeAudioFile(testWav, 'teste-estereo.wav');
    
    // 4. Verificar resultado
    console.log('4. Verificando resultado...');
    console.log(`   Sample rate: ${result.sampleRate}`);
    console.log(`   Canais: ${result.numberOfChannels}`);
    console.log(`   Duração: ${result.duration}s`);
    console.log(`   Samples por canal: ${result.length}`);
    console.log(`   Canal esquerdo: ${result.leftChannel ? result.leftChannel.length : 'N/A'} samples`);
    console.log(`   Canal direito: ${result.rightChannel ? result.rightChannel.length : 'N/A'} samples`);
    console.log(`   getChannelData disponível: ${typeof result.getChannelData === 'function'}`);
    
    // 5. Testar getChannelData
    if (typeof result.getChannelData === 'function') {
      console.log('5. Testando getChannelData...');
      const left = result.getChannelData(0);
      const right = result.getChannelData(1);
      console.log(`   Canal 0: ${left.length} samples`);
      console.log(`   Canal 1: ${right.length} samples`);
    }
    
    console.log('✅ Teste concluído com sucesso!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testStereoDecoder().then(success => {
  process.exit(success ? 0 : 1);
});
