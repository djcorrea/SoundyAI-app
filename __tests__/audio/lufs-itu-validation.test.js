// 🧪 TESTE VALIDAÇÃO ITU-R BS.1770-4 COMPLETO
// Testa implementação LUFS contra padrão internacional

import { 
  LUFSMeter, 
  calculateLoudnessMetrics,
  LUFS_CONSTANTS,
  K_WEIGHTING_COEFFS 
} from '../../lib/audio/features/loudness.js';

// 🎛️ Gerador de sinais de teste
class TestSignalGenerator {
  static generateSilence(duration, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    return {
      left: new Float32Array(samples),
      right: new Float32Array(samples),
      sampleRate,
      duration
    };
  }

  static generateSine(frequency, amplitude, duration, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const value = amplitude * Math.sin(2 * Math.PI * frequency * t);
      left[i] = value;
      right[i] = value;
    }
    
    return { left, right, sampleRate, duration };
  }

  static generatePinkNoise(amplitude, duration, sampleRate = 48000) {
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    
    // Implementação simples de pink noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    
    for (let i = 0; i < samples; i++) {
      const white = (Math.random() * 2 - 1);
      
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * amplitude;
      b6 = white * 0.115926;
      
      left[i] = pink;
      right[i] = pink;
    }
    
    return { left, right, sampleRate, duration };
  }
}

// 🔬 Testes de Validação ITU-R BS.1770-4
describe('LUFS ITU-R BS.1770-4 Validation', () => {
  
  // ✅ TESTE 1: Silêncio deve retornar -∞
  test('T1.1 - Silêncio absoluto deve retornar -Infinity LUFS', () => {
    const signal = TestSignalGenerator.generateSilence(5.0);
    const result = calculateLoudnessMetrics(signal.left, signal.right, signal.sampleRate);
    
    expect(result.lufs_integrated).toBe(-Infinity);
    expect(result.lufs_momentary).toBe(-Infinity);
    expect(result.lufs_short_term).toBe(-Infinity);
  });

  // ✅ TESTE 2: Tom puro 1 kHz -18 dBFS deve dar ~-18 LUFS ±0.5
  test('T1.2 - Tom 1kHz -18dBFS → -18 LUFS ±0.5', () => {
    const amplitude = Math.pow(10, -18/20); // -18 dBFS
    const signal = TestSignalGenerator.generateSine(1000, amplitude, 15.0);
    const result = calculateLoudnessMetrics(signal.left, signal.right, signal.sampleRate);
    
    console.log(`🔍 Tom 1kHz -18dBFS: ${result.lufs_integrated.toFixed(2)} LUFS`);
    
    expect(result.lufs_integrated).toBeCloseTo(-18, 0.5);
    expect(result.lufs_integrated).toBeGreaterThan(-19);
    expect(result.lufs_integrated).toBeLessThan(-17);
  });

  // ✅ TESTE 3: Pink noise -20 dBFS deve dar ~-20 LUFS ±0.5
  test('T1.3 - Pink noise -20dBFS → -20 LUFS ±0.5', () => {
    const amplitude = Math.pow(10, -20/20); // -20 dBFS
    const signal = TestSignalGenerator.generatePinkNoise(amplitude, 30.0);
    const result = calculateLoudnessMetrics(signal.left, signal.right, signal.sampleRate);
    
    console.log(`🔍 Pink noise -20dBFS: ${result.lufs_integrated.toFixed(2)} LUFS`);
    
    expect(result.lufs_integrated).toBeCloseTo(-20, 0.5);
    expect(result.lufs_integrated).toBeGreaterThan(-21);
    expect(result.lufs_integrated).toBeLessThan(-19);
  });

  // ✅ TESTE 4: Verificar K-weighting filter coefficients
  test('T1.4 - K-weighting coefficients conformes ITU-R BS.1770-4', () => {
    // Verificar se os coeficientes estão dentro dos ranges esperados
    const preFilter = K_WEIGHTING_COEFFS.PRE_FILTER;
    const rlbFilter = K_WEIGHTING_COEFFS.RLB_FILTER;
    
    // Pre-filter (shelving ~1.5kHz)
    expect(preFilter.b).toHaveLength(3);
    expect(preFilter.a).toHaveLength(3);
    expect(preFilter.a[0]).toBe(1.0); // Normalized
    
    // RLB filter (high-pass ~38Hz)
    expect(rlbFilter.b).toHaveLength(3);
    expect(rlbFilter.a).toHaveLength(3);
    expect(rlbFilter.a[0]).toBe(1.0); // Normalized
    
    console.log('🔍 Pre-filter b:', preFilter.b);
    console.log('🔍 Pre-filter a:', preFilter.a);
    console.log('🔍 RLB filter b:', rlbFilter.b);
    console.log('🔍 RLB filter a:', rlbFilter.a);
  });

  // ✅ TESTE 5: Gating absoluto e relativo
  test('T1.5 - Verificar gating absoluto (-70 LUFS) e relativo (-10 LU)', () => {
    const meter = new LUFSMeter(48000);
    
    // Sinal muito baixo que deve ser rejeitado pelo gating absoluto
    const lowAmplitude = Math.pow(10, -75/20); // -75 dBFS → deve ficar abaixo -70 LUFS
    const lowSignal = TestSignalGenerator.generateSine(1000, lowAmplitude, 10.0);
    const lowResult = calculateLoudnessMetrics(lowSignal.left, lowSignal.right, lowSignal.sampleRate);
    
    // Deve ser rejeitado ou muito baixo
    expect(lowResult.lufs_integrated).toBeLessThan(-70);
    
    // Sinal médio para testar gating relativo
    const medAmplitude = Math.pow(10, -25/20); // -25 dBFS
    const medSignal = TestSignalGenerator.generateSine(1000, medAmplitude, 10.0);
    const medResult = calculateLoudnessMetrics(medSignal.left, medSignal.right, medSignal.sampleRate);
    
    expect(medResult.gating_stats.total_blocks).toBeGreaterThan(0);
    expect(medResult.gating_stats.gated_blocks).toBeGreaterThan(0);
    expect(medResult.gating_stats.gating_efficiency).toBeGreaterThan(0);
    
    console.log('🔍 Gating stats:', medResult.gating_stats);
  });

  // ✅ TESTE 6: Verificar parâmetros de janelas e overlap
  test('T1.6 - Verificar parâmetros temporais conforme ITU-R BS.1770-4', () => {
    expect(LUFS_CONSTANTS.BLOCK_DURATION).toBe(0.4); // 400ms
    expect(LUFS_CONSTANTS.SHORT_TERM_DURATION).toBe(3.0); // 3s
    expect(LUFS_CONSTANTS.INTEGRATED_OVERLAP).toBe(0.75); // 75% overlap
    expect(LUFS_CONSTANTS.ABSOLUTE_THRESHOLD).toBe(-70.0); // -70 LUFS
    expect(LUFS_CONSTANTS.RELATIVE_THRESHOLD).toBe(-10.0); // -10 LU
    
    // Teste calculado para 48kHz
    const meter = new LUFSMeter(48000);
    expect(meter.blockSize).toBe(19200); // 0.4 * 48000
    expect(meter.hopSize).toBe(4800); // 19200 * (1 - 0.75)
    expect(meter.shortTermSize).toBe(144000); // 3.0 * 48000
  });

  // ✅ TESTE 7: Cross-check entre diferentes durações
  test('T1.7 - LUFS integrado deve ser consistente entre durações diferentes', () => {
    const amplitude = Math.pow(10, -16/20); // -16 dBFS
    
    // Mesmo sinal, durações diferentes
    const signal5s = TestSignalGenerator.generateSine(1000, amplitude, 5.0);
    const signal10s = TestSignalGenerator.generateSine(1000, amplitude, 10.0);
    const signal20s = TestSignalGenerator.generateSine(1000, amplitude, 20.0);
    
    const result5s = calculateLoudnessMetrics(signal5s.left, signal5s.right, signal5s.sampleRate);
    const result10s = calculateLoudnessMetrics(signal10s.left, signal10s.right, signal10s.sampleRate);
    const result20s = calculateLoudnessMetrics(signal20s.left, signal20s.right, signal20s.sampleRate);
    
    console.log(`🔍 5s: ${result5s.lufs_integrated.toFixed(2)} LUFS`);
    console.log(`🔍 10s: ${result10s.lufs_integrated.toFixed(2)} LUFS`);
    console.log(`🔍 20s: ${result20s.lufs_integrated.toFixed(2)} LUFS`);
    
    // Deve ser consistente ±0.2 LU
    expect(Math.abs(result5s.lufs_integrated - result10s.lufs_integrated)).toBeLessThan(0.2);
    expect(Math.abs(result10s.lufs_integrated - result20s.lufs_integrated)).toBeLessThan(0.2);
  });

  // ✅ TESTE 8: LRA (Loudness Range) - EBU R128 vs Legacy
  test('T1.8 - LRA calculation EBU R128 vs Legacy', () => {
    // Sinal dinâmico: fade in/out
    const duration = 15.0;
    const sampleRate = 48000;
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const fadeIn = Math.min(1, t / 3.0); // fade in 3s
      const fadeOut = Math.min(1, (duration - t) / 3.0); // fade out 3s
      const envelope = fadeIn * fadeOut;
      const amplitude = 0.1 * envelope; // Max -20 dBFS
      
      const value = amplitude * Math.sin(2 * Math.PI * 1000 * t);
      left[i] = value;
      right[i] = value;
    }
    
    const result = calculateLoudnessMetrics(left, right, sampleRate);
    
    console.log(`🔍 LRA Legacy: ${result.lra_legacy?.toFixed(2)} LU`);
    console.log(`🔍 LRA EBU R128: ${result.lra?.toFixed(2)} LU`);
    console.log(`🔍 LRA Meta:`, result.lra_meta);
    
    expect(result.lra).toBeGreaterThan(0);
    expect(result.lra_legacy).toBeGreaterThan(0);
    
    // EBU R128 deve ser menor ou igual ao legacy (mais rigoroso)
    expect(result.lra).toBeLessThanOrEqual(result.lra_legacy + 0.1);
  });

  // ✅ TESTE 9: Verificar short-term representativo vs raw
  test('T1.9 - Short-term representativo deve filtrar fade-outs', () => {
    // Sinal com fade out longo
    const duration = 20.0;
    const sampleRate = 48000;
    const samples = Math.floor(duration * sampleRate);
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let amplitude = 0.1; // -20 dBFS
      
      // Fade out abrupto nos últimos 5s
      if (t > 15.0) {
        amplitude *= (20.0 - t) / 5.0;
      }
      
      const value = amplitude * Math.sin(2 * Math.PI * 1000 * t);
      left[i] = value;
      right[i] = value;
    }
    
    const result = calculateLoudnessMetrics(left, right, sampleRate);
    
    console.log(`🔍 ST Raw Last: ${result.lufs_short_term_raw_last?.toFixed(2)} LUFS`);
    console.log(`🔍 ST Median Active: ${result.lufs_short_term_median_active?.toFixed(2)} LUFS`);
    console.log(`🔍 ST Max: ${result.lufs_short_term_max?.toFixed(2)} LUFS`);
    console.log(`🔍 ST Active Count: ${result.lufs_short_term_active_count}`);
    
    // Short-term representativo deve ser maior que o último valor (fade out)
    if (result.lufs_short_term_raw_last > -Infinity && result.lufs_short_term_median_active > -Infinity) {
      expect(result.lufs_short_term_median_active).toBeGreaterThan(result.lufs_short_term_raw_last);
    }
    
    // Deve ter pelo menos algumas janelas ativas
    expect(result.lufs_short_term_active_count).toBeGreaterThan(0);
  });

});

// 🎯 EXPORT para uso manual
export { TestSignalGenerator };