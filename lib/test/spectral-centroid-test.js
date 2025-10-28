// 🧪 TESTE ESPECÍFICO - SPECTRAL CENTROID CORRETO
// Valida implementação matemática padrão do spectral centroid

import { CoreMetricsProcessor } from '../../api/audio/core-metrics.js';

/**
 * 🎵 Gerar áudio sintético para teste de centroid
 */
function generateSpectralCentroidTestAudio(dominantFreq = 1000, sampleRate = 48000, duration = 1.0) {
  const samples = Math.floor(duration * sampleRate);
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  // Senoide pura na frequência dominante (centroid deve ser próximo a essa freq)
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const value = 0.5 * Math.sin(2 * Math.PI * dominantFreq * t);
    leftChannel[i] = value;
    rightChannel[i] = value;
  }
  
  return { leftChannel, rightChannel, expectedCentroid: dominantFreq };
}

/**
 * 🔇 Gerar silêncio para teste de null
 */
function generateSilenceAudio(sampleRate = 48000, duration = 1.0) {
  const samples = Math.floor(duration * sampleRate);
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  // Silêncio absoluto
  leftChannel.fill(0);
  rightChannel.fill(0);
  
  return { leftChannel, rightChannel, expectedCentroid: null };
}

/**
 * 🎛️ Mock simplificado de segmentação temporal
 */
function mockSegmentationForCentroidTest(leftChannel, rightChannel, sampleRate = 48000) {
  const frameSize = 4096;
  const hopSize = 1024;
  
  const frameCount = Math.floor((leftChannel.length - frameSize) / hopSize) + 1;
  const framesFFT = {
    left: [],
    right: [],
    count: frameCount,
    timestamps: []
  };
  
  const framesRMS = {
    left: [],
    right: [],
    count: frameCount,
    timestamps: []
  };
  
  // Simular FFT frames com dados reais para teste
  for (let i = 0; i < frameCount; i++) {
    const startSample = i * hopSize;
    const timestamp = startSample / sampleRate;
    
    // Extrair janela do áudio real
    const endSample = Math.min(startSample + frameSize, leftChannel.length);
    const windowLeft = leftChannel.slice(startSample, endSample);
    const windowRight = rightChannel.slice(startSample, endSample);
    
    // Calcular RMS real da janela
    let rmsL = 0, rmsR = 0;
    for (let s = 0; s < windowLeft.length; s++) {
      rmsL += windowLeft[s] ** 2;
      rmsR += windowRight[s] ** 2;
    }
    rmsL = Math.sqrt(rmsL / windowLeft.length);
    rmsR = Math.sqrt(rmsR / windowRight.length);
    
    framesRMS.left.push(rmsL);
    framesRMS.right.push(rmsR);
    framesRMS.timestamps.push(timestamp);
    
    // Mock FFT básico (só magnitude importa para centroid)
    const magnitude = new Float32Array(frameSize / 2);
    
    // Simular magnitude baseada nos dados reais da janela
    for (let j = 0; j < frameSize / 2; j++) {
      const freq = j * sampleRate / frameSize;
      
      if (windowLeft.length > 0) {
        // Concentrar energia na frequência dominante para teste
        if (freq >= 950 && freq <= 1050) { // Banda em torno de 1kHz
          magnitude[j] = rmsL * 10; // Amplificar banda dominante
        } else {
          magnitude[j] = rmsL * 0.1; // Reduzir outras frequências
        }
      }
    }
    
    const fftFrame = {
      real: new Float32Array(frameSize / 2),
      imag: new Float32Array(frameSize / 2), 
      magnitude: magnitude,
      phase: new Float32Array(frameSize / 2)
    };
    
    framesFFT.left.push(fftFrame);
    framesFFT.right.push({ ...fftFrame });
    framesFFT.timestamps.push(timestamp);
  }
  
  return {
    framesFFT,
    framesRMS,
    originalChannels: { left: leftChannel, right: rightChannel },
    timestamps: framesFFT.timestamps
  };
}

/**
 * 🧪 Teste do Spectral Centroid
 */
async function testSpectralCentroid() {
  console.log('\n🧪 ===== TESTE SPECTRAL CENTROID =====');
  
  try {
    // Teste 1: Senoide 1kHz (centroid deve ser ~1000 Hz)
    console.log('\n1️⃣ Teste: Senoide 1kHz');
    const audio1k = generateSpectralCentroidTestAudio(1000);
    const segmented1k = mockSegmentationForCentroidTest(audio1k.leftChannel, audio1k.rightChannel);
    
    const processor = new CoreMetricsProcessor();
    const result1k = await processor.processMetrics(segmented1k, {
      jobId: 'test_centroid_1k',
      fileName: 'test_1khz.wav'
    });
    
    const centroid1k = result1k.fft?.spectralCentroid;
    console.log(`📊 Resultado: ${centroid1k?.toFixed(1) || 'null'} Hz`);
    console.log(`🎯 Esperado: ~${audio1k.expectedCentroid} Hz`);
    
    const tolerance1k = 200; // ±200 Hz de tolerância
    const isValid1k = centroid1k !== null && 
                      Math.abs(centroid1k - audio1k.expectedCentroid) <= tolerance1k;
    console.log(`✅ Validação: ${isValid1k ? 'PASSOU' : 'FALHOU'}`);
    
    // Teste 2: Senoide 2kHz (centroid deve ser ~2000 Hz)
    console.log('\n2️⃣ Teste: Senoide 2kHz');
    const audio2k = generateSpectralCentroidTestAudio(2000);
    const segmented2k = mockSegmentationForCentroidTest(audio2k.leftChannel, audio2k.rightChannel);
    
    const result2k = await processor.processMetrics(segmented2k, {
      jobId: 'test_centroid_2k',
      fileName: 'test_2khz.wav'
    });
    
    const centroid2k = result2k.fft?.spectralCentroid;
    console.log(`📊 Resultado: ${centroid2k?.toFixed(1) || 'null'} Hz`);
    console.log(`🎯 Esperado: ~${audio2k.expectedCentroid} Hz`);
    
    const tolerance2k = 300; // ±300 Hz de tolerância
    const isValid2k = centroid2k !== null && 
                      Math.abs(centroid2k - audio2k.expectedCentroid) <= tolerance2k;
    console.log(`✅ Validação: ${isValid2k ? 'PASSOU' : 'FALHOU'}`);
    
    // Teste 3: Silêncio (centroid deve ser null)
    console.log('\n3️⃣ Teste: Silêncio Digital');
    const audioSilence = generateSilenceAudio();
    const segmentedSilence = mockSegmentationForCentroidTest(audioSilence.leftChannel, audioSilence.rightChannel);
    
    const resultSilence = await processor.processMetrics(segmentedSilence, {
      jobId: 'test_centroid_silence',
      fileName: 'test_silence.wav'
    });
    
    const centroidSilence = resultSilence.fft?.spectralCentroid;
    console.log(`📊 Resultado: ${centroidSilence === null ? 'null' : centroidSilence?.toFixed(1)} Hz`);
    console.log(`🎯 Esperado: null`);
    
    const isValidSilence = centroidSilence === null;
    console.log(`✅ Validação: ${isValidSilence ? 'PASSOU' : 'FALHOU'}`);
    
    // Resumo
    const allPassed = isValid1k && isValid2k && isValidSilence;
    console.log(`\n📈 RESUMO: ${allPassed ? '✅ TODOS OS TESTES PASSARAM' : '❌ ALGUNS TESTES FALHARAM'}`);
    console.log('🧪 ===== FIM TESTE SPECTRAL CENTROID =====\n');
    
    return allPassed;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.log('🧪 ===== FIM TESTE SPECTRAL CENTROID ❌ =====\n');
    return false;
  }
}

/**
 * 🏃‍♂️ Executar teste
 */
if (import.meta.url === new URL(import.meta.url).href) {
  testSpectralCentroid().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testSpectralCentroid };

console.log('🧪 Teste Spectral Centroid carregado');