import { segmentAudioTemporal, validateSegmentationConfig } from './audio/temporal-segmentation.js';

async function testBasic() {
  console.log('🧪 Teste básico da Fase 5.2');
  
  try {
    // 1. Validar configuração
    console.log('1. Validando configuração...');
    const config = validateSegmentationConfig();
    console.log('✅ Configuração validada');
    
    // 2. Criar mock de áudio de 1 segundo
    console.log('2. Criando áudio de teste...');
    const sampleRate = 48000;
    const duration = 1.0; // 1 segundo
    const numSamples = sampleRate * duration;
    
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    // Sine wave 440Hz
    for (let i = 0; i < numSamples; i++) {
      leftChannel[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
      rightChannel[i] = Math.sin(2 * Math.PI * 484 * i / sampleRate) * 0.4; // Frequência ligeiramente diferente
    }
    
    const audioBuffer = {
      sampleRate: 48000,
      numberOfChannels: 2,
      length: numSamples,
      duration: duration,
      leftChannel: leftChannel,
      rightChannel: rightChannel,
      data: leftChannel
    };
    
    console.log(`✅ Áudio criado: ${numSamples} samples, ${duration}s`);
    
    // 3. Segmentar
    console.log('3. Executando segmentação...');
    const segmented = segmentAudioTemporal(audioBuffer);
    
    console.log('✅ Segmentação concluída');
    console.log(`   FFT frames: ${segmented.framesFFT.count}`);
    console.log(`   RMS frames: ${segmented.framesRMS.count}`);
    
    // 4. Validar resultados
    console.log('4. Validando resultados...');
    
    // Para 1 segundo (48000 samples):
    // FFT: floor((48000-4096)/1024)+1 = 43 frames
    const expectedFFT = Math.floor((48000 - 4096) / 1024) + 1;
    if (segmented.framesFFT.count === expectedFFT) {
      console.log(`✅ FFT frames: ${segmented.framesFFT.count} (esperado: ${expectedFFT})`);
    } else {
      console.log(`❌ FFT frames: ${segmented.framesFFT.count} (esperado: ${expectedFFT})`);
    }
    
    // RMS: floor(48000/4800) = 10 blocos (0s, 100ms, 200ms, ..., 900ms)
    const expectedRMS = Math.floor(48000 / 4800);
    if (segmented.framesRMS.count === expectedRMS) {
      console.log(`✅ RMS frames: ${segmented.framesRMS.count} (esperado: ${expectedRMS})`);
    } else {
      console.log(`❌ RMS frames: ${segmented.framesRMS.count} (esperado: ${expectedRMS})`);
    }
    
    console.log('\n🎉 Teste básico concluído com sucesso!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error(error.stack);
    return false;
  }
}

testBasic().then(success => {
  process.exit(success ? 0 : 1);
});
