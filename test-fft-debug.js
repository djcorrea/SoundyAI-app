// Teste rápido para verificar os logs detalhados do pipeline real
import { segmentAudioTemporal } from './work/api/audio/temporal-segmentation.js';
import { calculateCoreMetrics } from './work/api/audio/core-metrics.js';

console.log('🔍 TESTE: Debug FFT Structure');

async function testFFTStructure() {
  try {
    // Simulando dados de áudio maiores (como arquivo real)
    console.log('[1/2] Gerando dados de teste maiores...');
    
    const audioLength = 48000 * 5; // 5 segundos
    const leftChannel = new Float32Array(audioLength);
    const rightChannel = new Float32Array(audioLength);
    
    // Gerar sinal mais complexo
    for (let i = 0; i < audioLength; i++) {
      const t = i / 48000;
      leftChannel[i] = 
        Math.sin(2 * Math.PI * 440 * t) * 0.3 +  // 440 Hz
        Math.sin(2 * Math.PI * 880 * t) * 0.2 +  // 880 Hz
        Math.sin(2 * Math.PI * 1760 * t) * 0.1;  // 1760 Hz
      
      rightChannel[i] = 
        Math.sin(2 * Math.PI * 523 * t) * 0.25 + // C5
        Math.sin(2 * Math.PI * 659 * t) * 0.15;  // E5
    }
    
    const audioBuffer = {
      sampleRate: 48000,
      length: audioLength,
      numberOfChannels: 2,
      duration: 5.0,
      leftChannel,
      rightChannel,
      getChannelData: (channel) => {
        return channel === 0 ? leftChannel : rightChannel;
      }
    };

    // 2. Segmentação temporal
    console.log('[2/2] Segmentação temporal...');
    const segmentedAudio = await segmentAudioTemporal(audioBuffer, { jobId: 'debug-fft' });

    console.log('✅ Segmentação concluída! FFT frames:', segmentedAudio.framesFFT?.frames?.length || 0);

    // 3. Core metrics (só para ver os logs de debug)
    console.log('[3/2] Testando core metrics (primeiros logs)...');
    
    // Usar timeout para interromper se necessário
    const timeout = setTimeout(() => {
      console.log('⏰ Timeout - encerrando teste para ver logs');
      process.exit(0);
    }, 10000); // 10 segundos timeout
    
    const coreMetrics = await calculateCoreMetrics(segmentedAudio, { jobId: 'debug-fft' });
    
    clearTimeout(timeout);
    
    console.log('\n📊 RESULTADOS DEBUG:');
    console.log('✅ FFT Frames:', coreMetrics.fft?.processedFrames || 'NULL');
    console.log('✅ Spectral Bands Frames:', coreMetrics.spectralBands?.processedFrames || 'NULL');
    console.log('✅ Spectral Centroid Frames:', coreMetrics.spectralCentroid?.processedFrames || 'NULL');

  } catch (error) {
    console.error('❌ Erro no teste debug:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0,3).join('\n'));
  }
}

testFFTStructure().catch(console.error);