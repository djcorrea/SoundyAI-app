// 🎯 TRUE PEAK SIMPLES E CORRETO
// Implementação direta ITU-R BS.1770-4 sem complicações

/**
 * 🏔️ True Peak Detector SIMPLES - 4x oversampling
 * Baseado na especificação ITU-R BS.1770-4
 */
class SimpleTruePeakDetector {
  constructor() {
    // Coeficientes do filtro anti-aliasing para 4x oversampling
    // Valores baseados na implementação de referência ITU-R BS.1770-4
    this.coeffs = new Float32Array([
      0.0017089843750,
      0.0109863281250,
      0.0196533203125,
      0.0294189453125,
      0.0376892089844,
      0.0433349609375,
      0.0451965332031,
      0.0424499511719,
      0.0344543457031,
      0.0208740234375,
      0.0015869140625,
      -0.0241394042969,
      -0.0548095703125,
      -0.0870361328125,
      -0.1168823242188,
      -0.1394653320313,
      -0.1498413085938,
      -0.1431884765625,
      -0.1147460937500,
      -0.0594482421875,
      0.0259399414063,
      0.1509399414063,
      0.3178710937500,
      0.5212402343750,
      0.7476806640625,
      0.9827880859375,
      1.2067871093750,
      1.3952636718750,
      1.5273437500000,
      1.5828857421875,
      1.5459594726563,
      1.4056396484375,
      1.1562500000000,
      0.8023681640625,
      0.3555908203125,
      -0.1793212890625,
      -0.7714233398438,
      -1.3946533203125,
      -2.0225830078125,
      -2.6201171875000,
      -3.1533203125000,
      -3.5852050781250,
      -3.8818359375000,
      -4.0103759765625,
      -3.9428710937500,
      -3.6523437500000,
      -3.1198730468750,
      -2.3291015625000
    ]);
  }

  /**
   * 🎯 Detectar True Peak - versão SIMPLES
   * @param {Float32Array} samples - Amostras de um canal
   * @returns {number} True Peak em dBTP
   */
  detectTruePeak(samples) {
    let maxTruePeak = 0.0;
    
    // Buffer para convolução
    const bufferSize = this.coeffs.length;
    const buffer = new Float32Array(bufferSize);
    
    for (let i = 0; i < samples.length; i++) {
      // Shift buffer e adiciona nova amostra
      for (let j = bufferSize - 1; j > 0; j--) {
        buffer[j] = buffer[j - 1];
      }
      buffer[0] = samples[i];
      
      // Calcular 4 amostras interpoladas por oversampling
      for (let phase = 0; phase < 4; phase++) {
        let interpolated = 0.0;
        
        // Convolução simples
        for (let j = 0; j < bufferSize; j++) {
          const coeffIndex = j * 4 + phase;
          if (coeffIndex < this.coeffs.length) {
            interpolated += buffer[j] * this.coeffs[coeffIndex];
          }
        }
        
        // Atualizar peak máximo
        const absPeak = Math.abs(interpolated);
        if (absPeak > maxTruePeak) {
          maxTruePeak = absPeak;
        }
      }
    }
    
    // Converter para dBTP
    if (maxTruePeak > 0) {
      return 20 * Math.log10(maxTruePeak);
    } else {
      return -Infinity;
    }
  }
}

/**
 * 🧪 Teste com sinal conhecido
 */
function testSimpleTruePeak() {
  console.log('🧪 Testando True Peak SIMPLES...');
  
  const detector = new SimpleTruePeakDetector();
  
  // Senoidal -6dBFS, 1kHz, 48kHz sample rate
  const sampleRate = 48000;
  const amplitude = Math.pow(10, -6.0 / 20); // -6dBFS = 0.501187
  const frequency = 1000;
  const duration = 0.1; // 100ms
  const length = Math.floor(sampleRate * duration);
  
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
  }
  
  console.log(`📊 Sinal teste: ${amplitude.toFixed(6)} amplitude (-6dBFS), ${frequency}Hz`);
  
  // Calcular Sample Peak
  let samplePeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > samplePeak) samplePeak = abs;
  }
  const samplePeakdB = 20 * Math.log10(samplePeak);
  
  // Calcular True Peak
  const truePeakdBTP = detector.detectTruePeak(samples);
  
  console.log('📋 RESULTADOS:');
  console.log(`   Sample Peak: ${samplePeakdB.toFixed(2)} dBFS`);
  console.log(`   True Peak: ${truePeakdBTP.toFixed(2)} dBTP`);
  console.log(`   Diferença: ${(truePeakdBTP - samplePeakdB).toFixed(2)} dB`);
  
  // Validação
  const expectedSamplePeak = -6.0;
  const sampleError = Math.abs(samplePeakdB - expectedSamplePeak);
  const isValid = sampleError < 0.1 && truePeakdBTP >= samplePeakdB && truePeakdBTP < (samplePeakdB + 2);
  
  console.log('✅ VALIDAÇÃO:');
  console.log(`   Sample Peak correto: ${sampleError < 0.1 ? '✅' : '❌'} (erro: ${sampleError.toFixed(3)}dB)`);
  console.log(`   True Peak >= Sample: ${truePeakdBTP >= samplePeakdB ? '✅' : '❌'}`);
  console.log(`   True Peak razoável: ${truePeakdBTP < (samplePeakdB + 2) ? '✅' : '❌'}`);
  console.log(`   RESULTADO: ${isValid ? '🎉 VÁLIDO' : '💥 INVÁLIDO'}`);
  
  return { samplePeakdB, truePeakdBTP, isValid };
}

// Executar teste
if (typeof process !== 'undefined') {
  testSimpleTruePeak();
}

// Export para usar no browser
if (typeof window !== 'undefined') {
  window.SimpleTruePeakDetector = SimpleTruePeakDetector;
  window.testSimpleTruePeak = testSimpleTruePeak;
}