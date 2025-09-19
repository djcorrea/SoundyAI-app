// 🎯 TRUE PEAK ULTRA SIMPLES
// Implementação BÁSICA sem complicações

/**
 * 🏔️ True Peak Detector ULTRA SIMPLES
 * Tentativa de implementação mais direta possível
 */
class UltraSimpleTruePeak {
  constructor() {
    // Coeficientes mais simples para 4x oversampling
    // Baseado em filtro passa-baixas básico
    this.taps = 12; // Poucos taps para debug
    this.oversample = 4;
    
    // Filtro passa-baixas simples (windowed sinc)
    this.h = new Float32Array(this.taps * this.oversample);
    this.generateSimpleFilter();
  }
  
  generateSimpleFilter() {
    const cutoff = Math.PI / this.oversample; // Nyquist cutoff
    
    for (let i = 0; i < this.h.length; i++) {
      const n = i - (this.h.length - 1) / 2;
      
      // Sinc function
      let sinc;
      if (Math.abs(n) < 1e-9) {
        sinc = cutoff / Math.PI;
      } else {
        sinc = Math.sin(cutoff * n) / (Math.PI * n);
      }
      
      // Hamming window
      const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (this.h.length - 1));
      
      this.h[i] = sinc * window;
    }
    
    // Normalizar para ganho unitário
    const sum = this.h.reduce((a, b) => a + Math.abs(b), 0);
    for (let i = 0; i < this.h.length; i++) {
      this.h[i] /= sum;
    }
    
    console.log(`🔧 Filtro gerado: ${this.h.length} taps, normalização: ${sum.toFixed(6)}`);
  }
  
  /**
   * 🎯 Detectar True Peak - versão ULTRA SIMPLES
   */
  detectTruePeak(samples) {
    let maxPeak = 0;
    
    // Buffer simples
    const buffer = new Float32Array(this.taps);
    
    for (let i = 0; i < samples.length; i++) {
      // Shift buffer
      for (let j = this.taps - 1; j > 0; j--) {
        buffer[j] = buffer[j - 1];
      }
      buffer[0] = samples[i];
      
      // Gerar 4 amostras interpoladas
      for (let k = 0; k < this.oversample; k++) {
        let output = 0;
        
        // Convolução super simples
        for (let j = 0; j < this.taps; j++) {
          const hIndex = j * this.oversample + k;
          if (hIndex < this.h.length) {
            output += buffer[j] * this.h[hIndex];
          }
        }
        
        const absPeak = Math.abs(output);
        if (absPeak > maxPeak) {
          maxPeak = absPeak;
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
 * 🧪 Teste ultra simples
 */
function testUltraSimple() {
  console.log('🧪 Testando True Peak ULTRA SIMPLES...');
  
  const detector = new UltraSimpleTruePeak();
  
  // Debug: mostrar alguns coeficientes
  console.log('🔍 Primeiros 8 coeficientes:', Array.from(detector.h.slice(0, 8)).map(x => x.toFixed(6)));
  
  // Teste com -6dBFS
  const amplitude = Math.pow(10, -6.0 / 20);
  const samples = new Float32Array(4800);
  
  for (let i = 0; i < samples.length; i++) {
    const t = i / 48000;
    samples[i] = amplitude * Math.sin(2 * Math.PI * 1000 * t);
  }
  
  // Sample peak
  let samplePeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > samplePeak) samplePeak = abs;
  }
  const samplePeakdB = 20 * Math.log10(samplePeak);
  
  // True peak
  const truePeakdB = detector.detectTruePeak(samples);
  
  console.log('📋 RESULTADOS ULTRA SIMPLES:');
  console.log(`   Sample Peak: ${samplePeakdB.toFixed(2)} dBFS`);
  console.log(`   True Peak: ${truePeakdB.toFixed(2)} dBTP`);
  console.log(`   Diferença: ${(truePeakdB - samplePeakdB).toFixed(2)} dB`);
  
  // Se AINDA der valores altos, o problema é na lógica da convolução
  if (truePeakdB > -4) {
    console.log('💥 AINDA valores altos! Problema na convolução básica');
  } else {
    console.log('✅ Valores razoáveis!');
  }
  
  return { samplePeakdB, truePeakdB };
}

// Teste mais básico ainda: SEM oversampling
function testWithoutOversampling() {
  console.log('\n🔍 Teste SEM oversampling (só sample peak):');
  
  const amplitude = Math.pow(10, -6.0 / 20);
  const samples = new Float32Array(4800);
  
  for (let i = 0; i < samples.length; i++) {
    const t = i / 48000;
    samples[i] = amplitude * Math.sin(2 * Math.PI * 1000 * t);
  }
  
  let maxSample = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxSample) maxSample = abs;
  }
  
  const samplePeakdB = 20 * Math.log10(maxSample);
  console.log(`📊 Sample Peak puro: ${samplePeakdB.toFixed(2)} dBFS`);
  console.log(`   Esperado: -6.00 dBFS`);
  console.log(`   Erro: ${Math.abs(samplePeakdB + 6).toFixed(3)} dB`);
  
  // Se sample peak estiver errado, temos problema nos dados de teste
  if (Math.abs(samplePeakdB + 6) > 0.01) {
    console.log('💥 Sample peak incorreto! Problema nos dados de teste');
  } else {
    console.log('✅ Sample peak correto');
  }
  
  return samplePeakdB;
}

// Executar testes
if (typeof process !== 'undefined') {
  const sampleOnly = testWithoutOversampling();
  const ultraSimple = testUltraSimple();
  
  console.log('\n🎯 DIAGNÓSTICO:');
  if (Math.abs(sampleOnly + 6) > 0.01) {
    console.log('💥 Problema nos dados de teste');
  } else if (ultraSimple.truePeakdB > -4) {
    console.log('💥 Problema na convolução/filtro');
  } else {
    console.log('✅ Implementação básica funciona');
  }
}