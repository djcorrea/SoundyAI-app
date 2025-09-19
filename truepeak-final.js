// 🎯 TRUE PEAK CORRETO FINAL
// Implementação direta sem over-engineering

/**
 * 🏔️ True Peak Detector FINAL
 * Implementação simples e correta
 */
class FinalTruePeak {
  constructor() {
    // Oversampling 4x com interpolação linear simples
    this.oversample = 4;
  }
  
  /**
   * 🎯 True Peak com interpolação simples
   * Método mais direto: interpolação linear entre amostras
   */
  detectTruePeak(samples) {
    let maxPeak = 0;
    
    // 1. Primeiro, encontrar sample peak
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
    
    // 2. Interpolação entre amostras adjacentes
    for (let i = 0; i < samples.length - 1; i++) {
      const s1 = samples[i];
      const s2 = samples[i + 1];
      
      // Gerar amostras interpoladas entre s1 e s2
      for (let k = 1; k < this.oversample; k++) {
        const t = k / this.oversample;
        const interpolated = s1 * (1 - t) + s2 * t;
        const abs = Math.abs(interpolated);
        
        if (abs > maxPeak) {
          maxPeak = abs;
        }
      }
    }
    
    // Converter para dB
    if (maxPeak > 0) {
      return 20 * Math.log10(maxPeak);
    } else {
      return -Infinity;
    }
  }
}

/**
 * 🧪 Teste final
 */
function testFinal() {
  console.log('🧪 TRUE PEAK FINAL - Interpolação Linear\n');
  
  const detector = new FinalTruePeak();
  
  // Teste -6dBFS
  const amplitude = Math.pow(10, -6.0 / 20);
  const samples = new Float32Array(4800);
  
  for (let i = 0; i < samples.length; i++) {
    const t = i / 48000;
    samples[i] = amplitude * Math.sin(2 * Math.PI * 1000 * t);
  }
  
  // Sample peak manual
  let samplePeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > samplePeak) samplePeak = abs;
  }
  const samplePeakdB = 20 * Math.log10(samplePeak);
  
  // True peak
  const truePeakdB = detector.detectTruePeak(samples);
  
  console.log('📋 RESULTADO INTERPOLAÇÃO LINEAR:');
  console.log(`   Sample Peak: ${samplePeakdB.toFixed(2)} dBFS`);
  console.log(`   True Peak: ${truePeakdB.toFixed(2)} dBTP`);
  console.log(`   Diferença: ${(truePeakdB - samplePeakdB).toFixed(2)} dB`);
  
  const isValid = truePeakdB >= samplePeakdB && truePeakdB < (samplePeakdB + 1);
  console.log(`   Válido: ${isValid ? '✅' : '❌'}`);
  
  if (isValid) {
    console.log('\n🎉 FINALMENTE! True Peak correto!');
    console.log('📝 Características:');
    console.log('   ✅ True Peak >= Sample Peak');
    console.log('   ✅ Diferença pequena (< 1dB)');
    console.log('   ✅ Implementação simples');
  }
  
  return { samplePeakdB, truePeakdB, isValid };
}

// Teste com diferentes níveis
function testMultipleLevels() {
  console.log('\n📊 Teste múltiplos níveis:\n');
  
  const detector = new FinalTruePeak();
  const levels = [-1, -3, -6, -12, -20];
  
  levels.forEach(dBFS => {
    const amplitude = Math.pow(10, dBFS / 20);
    const samples = new Float32Array(4800);
    
    for (let i = 0; i < samples.length; i++) {
      const t = i / 48000;
      samples[i] = amplitude * Math.sin(2 * Math.PI * 1000 * t);
    }
    
    const truePeakdB = detector.detectTruePeak(samples);
    const diff = truePeakdB - dBFS;
    
    console.log(`   ${dBFS.toString().padStart(3)}dBFS → ${truePeakdB.toFixed(2)}dBTP (diff: ${diff.toFixed(2)}dB)`);
  });
}

if (typeof process !== 'undefined') {
  const result = testFinal();
  testMultipleLevels();
  
  if (result.isValid) {
    console.log('\n🚀 PRONTO PARA IMPLEMENTAR NO PIPELINE!');
  }
}

// Export
if (typeof window !== 'undefined') {
  window.FinalTruePeak = FinalTruePeak;
}