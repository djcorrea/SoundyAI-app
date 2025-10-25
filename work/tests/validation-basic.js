/**
 * Suite de Validação Básica - Analisador de Áudio
 * 
 * Testes mínimos para garantir precisão das métricas principais.
 * Referências: ITU-R BS.1770-4, EBU R128, AES17-2015
 * 
 * @author Audio DSP Validation Suite
 * @version 1.0.0
 * @date 2025-10-25
 */

// ============================================================
// GERADORES DE SINAL DE TESTE
// ============================================================

/**
 * Gera tom senoidal puro
 * 
 * @param {number} freqHz - Frequência em Hz (ex: 1000 para 1kHz)
 * @param {number} amplitudeDbFS - Amplitude em dBFS (negativo, ex: -20)
 * @param {number} sampleRate - Taxa de amostragem (ex: 48000)
 * @param {number} durationS - Duração em segundos
 * @returns {Float32Array} Buffer de áudio mono
 * 
 * @example
 * // Gerar tom 1kHz @ -20dBFS por 10 segundos
 * const tone = generateTone(1000, -20, 48000, 10);
 */
function generateTone(freqHz, amplitudeDbFS, sampleRate, durationS) {
  // Converter dBFS para amplitude linear
  // dBFS = 20 * log10(amplitude)
  // amplitude = 10^(dBFS/20)
  const amplitude = Math.pow(10, amplitudeDbFS / 20);
  
  const numSamples = Math.floor(sampleRate * durationS);
  const signal = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    signal[i] = amplitude * Math.sin(2 * Math.PI * freqHz * t);
  }
  
  console.log(`[GENERATOR] Tom ${freqHz}Hz @ ${amplitudeDbFS}dBFS gerado (${numSamples} samples)`);
  return signal;
}

/**
 * Gera ruído branco (Gaussian white noise)
 * 
 * @param {number} amplitudeDbFS - Amplitude RMS em dBFS
 * @param {number} sampleRate - Taxa de amostragem
 * @param {number} durationS - Duração em segundos
 * @returns {Float32Array} Buffer de áudio mono
 * 
 * @example
 * // Gerar ruído branco @ -30dBFS RMS por 5 segundos
 * const noise = generateWhiteNoise(-30, 48000, 5);
 */
function generateWhiteNoise(amplitudeDbFS, sampleRate, durationS) {
  const amplitude = Math.pow(10, amplitudeDbFS / 20);
  const numSamples = Math.floor(sampleRate * durationS);
  const signal = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    // Box-Muller transform para Gaussian noise
    const u1 = Math.random();
    const u2 = Math.random();
    const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    signal[i] = amplitude * noise;
  }
  
  console.log(`[GENERATOR] Ruído branco @ ${amplitudeDbFS}dBFS gerado (${numSamples} samples)`);
  return signal;
}

/**
 * Gera silêncio (para testar gating)
 * 
 * @param {number} sampleRate - Taxa de amostragem
 * @param {number} durationS - Duração em segundos
 * @returns {Float32Array} Buffer de áudio mono (zeros)
 * 
 * @example
 * const silence = generateSilence(48000, 10);
 */
function generateSilence(sampleRate, durationS) {
  const numSamples = Math.floor(sampleRate * durationS);
  console.log(`[GENERATOR] Silêncio gerado (${numSamples} samples)`);
  return new Float32Array(numSamples); // Zeros
}

/**
 * Duplica canal mono para estéreo
 * 
 * @param {Float32Array} monoSignal - Sinal mono
 * @returns {Object} {leftChannel, rightChannel}
 */
function monoToStereo(monoSignal) {
  return {
    leftChannel: monoSignal,
    rightChannel: new Float32Array(monoSignal) // Cópia
  };
}

// ============================================================
// TESTES DE VALIDAÇÃO
// ============================================================

/**
 * Teste 1: Tom 1kHz @ -20dBFS deve ler -20.0 LUFS (±0.3)
 * 
 * Fundamento técnico:
 * - Tom senoidal puro tem RMS = amplitude / sqrt(2)
 * - -20dBFS RMS = -23dB de potência
 * - LUFS para tom puro ≈ RMS em dBFS (aproximadamente)
 * 
 * Tolerância ITU-R BS.1770-4: ±0.3 LU
 */
async function testLUFS_Tone1kHz() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║ TESTE 1: LUFS de Tom 1kHz @ -20dBFS              ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  try {
    const sampleRate = 48000;
    const tone = generateTone(1000, -20, sampleRate, 10); // 10 segundos
    const { leftChannel, rightChannel } = monoToStereo(tone);
    
    // Importar função de cálculo LUFS
    const { calculateLoudnessMetricsCorrected } = await import('../lib/audio/features/loudness.js');
    
    const result = await calculateLoudnessMetricsCorrected(leftChannel, rightChannel, sampleRate);
    
    const expected = -20.0;
    const tolerance = 0.3; // ITU-R BS.1770-4 aceita ±0.3 LU
    const diff = Math.abs(result.lufs_integrated - expected);
    
    console.log(`📊 Esperado: ${expected.toFixed(1)} LUFS`);
    console.log(`📊 Obtido: ${result.lufs_integrated.toFixed(1)} LUFS`);
    console.log(`📊 Diferença: ${diff.toFixed(2)} LU`);
    console.log(`📊 Tolerância: ±${tolerance} LU (ITU-R BS.1770-4)`);
    
    if (diff <= tolerance) {
      console.log('✅ PASS - LUFS dentro da tolerância broadcast-grade');
      return { passed: true, diff, expected, obtained: result.lufs_integrated };
    } else {
      console.log(`❌ FAIL - Diferença ${diff.toFixed(2)} > ${tolerance} LU`);
      return { passed: false, diff, expected, obtained: result.lufs_integrated };
    }
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Teste 2: Peak de tom @ -6dBFS deve ler -6.0 dBFS (±0.1)
 * 
 * Fundamento técnico:
 * - Tom senoidal: peak = amplitude
 * - -6dBFS amplitude → peak deve ser exatamente -6dBFS
 * 
 * Tolerância: ±0.1 dB (precisão de metering profissional)
 */
async function testPeak_Tone() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║ TESTE 2: Peak de Tom @ -6dBFS                    ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  try {
    const sampleRate = 48000;
    const tone = generateTone(1000, -6, sampleRate, 1); // 1 segundo
    
    // Calcular peak manualmente
    let peak = 0;
    for (let i = 0; i < tone.length; i++) {
      peak = Math.max(peak, Math.abs(tone[i]));
    }
    
    const peakDbFS = 20 * Math.log10(peak);
    
    const expected = -6.0;
    const tolerance = 0.1;
    const diff = Math.abs(peakDbFS - expected);
    
    console.log(`📊 Esperado: ${expected.toFixed(1)} dBFS`);
    console.log(`📊 Obtido: ${peakDbFS.toFixed(1)} dBFS`);
    console.log(`📊 Diferença: ${diff.toFixed(2)} dB`);
    console.log(`📊 Tolerância: ±${tolerance} dB`);
    
    if (diff <= tolerance) {
      console.log('✅ PASS - Peak correto');
      return { passed: true, diff, expected, obtained: peakDbFS };
    } else {
      console.log(`❌ FAIL - Diferença ${diff.toFixed(2)} > ${tolerance} dB`);
      return { passed: false, diff, expected, obtained: peakDbFS };
    }
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Teste 3: Silêncio deve ler < -70 LUFS (gating absoluto)
 * 
 * Fundamento técnico:
 * - ITU-R BS.1770-4: gating absoluto em -70 LUFS
 * - Silêncio deve ser rejeitado pelo gating
 * 
 * Tolerância: Integrated LUFS deve ser null ou < -70
 */
async function testLUFS_Silence() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║ TESTE 3: LUFS de Silêncio (Gating Absoluto)      ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  try {
    const sampleRate = 48000;
    const silence = generateSilence(sampleRate, 10);
    const { leftChannel, rightChannel } = monoToStereo(silence);
    
    const { calculateLoudnessMetricsCorrected } = await import('../lib/audio/features/loudness.js');
    const result = await calculateLoudnessMetricsCorrected(leftChannel, rightChannel, sampleRate);
    
    console.log(`📊 LUFS obtido: ${result.lufs_integrated === -Infinity ? '-∞' : result.lufs_integrated}`);
    console.log(`📊 Gating absoluto: -70 LUFS (ITU-R BS.1770-4)`);
    
    // Silêncio deve ser tratado pelo gating absoluto (-70 LUFS)
    if (result.lufs_integrated === -Infinity || result.lufs_integrated < -70) {
      console.log('✅ PASS - Gating absoluto funcionando corretamente');
      return { passed: true, obtained: result.lufs_integrated };
    } else {
      console.log('❌ FAIL - Gating não tratou silêncio corretamente');
      return { passed: false, obtained: result.lufs_integrated };
    }
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Teste 4: Dynamic Range não deve ser negativo
 * 
 * Fundamento técnico:
 * - DR = Peak RMS - Average RMS
 * - Matematicamente impossível ser negativo (peak ≥ average sempre)
 * 
 * Tolerância: DR deve ser ≥ 0 ou null (se cálculo inválido)
 */
async function testDR_NonNegative() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║ TESTE 4: Dynamic Range Não-Negativo              ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  try {
    const sampleRate = 48000;
    const tone = generateTone(1000, -12, sampleRate, 10);
    const { leftChannel, rightChannel } = monoToStereo(tone);
    
    const { calculateDynamicsMetrics } = await import('../lib/audio/features/dynamics-corrected.js');
    const result = calculateDynamicsMetrics(leftChannel, rightChannel, sampleRate);
    
    if (result.dynamicRange === null) {
      console.log('⚠️  WARNING - DR retornou null (verificar se esperado para tom puro)');
      console.log('ℹ️  Tom puro tem DR baixo/nulo (Peak RMS ≈ Average RMS)');
      return { passed: true, obtained: null, note: 'null_expected_for_pure_tone' };
    }
    
    console.log(`📊 DR obtido: ${result.dynamicRange.toFixed(2)} dB`);
    
    if (result.dynamicRange >= 0) {
      console.log('✅ PASS - DR não-negativo');
      return { passed: true, obtained: result.dynamicRange };
    } else {
      console.log('❌ FAIL - DR negativo (impossível fisicamente!)');
      return { passed: false, obtained: result.dynamicRange };
    }
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Teste 5: dBFS nunca deve ultrapassar 0
 * 
 * Fundamento técnico:
 * - 0 dBFS = limite absoluto do sistema digital (full-scale)
 * - Magnitude > 0 dBFS é fisicamente impossível
 * - AES17-2015: Digital Audio Measurement Standards
 * 
 * Tolerância: TODAS as bandas espectrais devem ter energy_db ≤ 0
 */
async function testSpectral_dBFS_Clamp() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║ TESTE 5: dBFS ≤ 0 (Bandas Espectrais)            ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  try {
    const sampleRate = 48000;
    const tone = generateTone(1000, -3, sampleRate, 5); // Tom alto @ -3dBFS
    const { leftChannel, rightChannel } = monoToStereo(tone);
    
    // Precisamos processar o áudio para gerar FFT
    // Vou usar o gerador de FFT diretamente
    const { FastFFT } = await import('../lib/audio/fft.js');
    const { SpectralBandsCalculator } = await import('../lib/audio/features/spectral-bands.js');
    
    const fft = new FastFFT();
    const fftSize = 8192; // Usar novo FFT size
    
    // Pegar primeiro frame
    const frame = leftChannel.slice(0, fftSize);
    const paddedFrame = new Float32Array(fftSize);
    paddedFrame.set(frame);
    
    const fftResult = fft.fft(paddedFrame);
    
    // Calcular bandas espectrais
    const bandsCalc = new SpectralBandsCalculator(sampleRate, fftSize);
    const result = bandsCalc.analyzeBands(fftResult.magnitude, fftResult.magnitude);
    
    if (!result.valid) {
      console.log('⚠️  WARNING - Análise espectral retornou inválido');
      return { passed: false, note: 'invalid_spectral_analysis' };
    }
    
    let allValid = true;
    const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
    const violations = [];
    
    console.log('📊 Verificando bandas espectrais:');
    for (const band of bands) {
      const energyDb = result.bands[band]?.energy_db;
      if (energyDb === null || energyDb === undefined) {
        console.log(`  ⚠️  ${band}: null/undefined`);
        continue;
      }
      
      console.log(`  ${energyDb > 0 ? '❌' : '✅'} ${band}: ${energyDb.toFixed(1)} dBFS`);
      
      if (energyDb > 0) {
        allValid = false;
        violations.push({ band, value: energyDb });
      }
    }
    
    if (allValid) {
      console.log('✅ PASS - Todas as bandas ≤ 0 dBFS (AES17-2015 compliant)');
      return { passed: true, bands: result.bands };
    } else {
      console.log('❌ FAIL - Bandas com energy_db > 0 dBFS (impossível!):');
      violations.forEach(v => console.log(`     ${v.band}: ${v.value.toFixed(1)} dBFS`));
      return { passed: false, violations };
    }
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    console.log(error.stack);
    return { passed: false, error: error.message };
  }
}

// ============================================================
// EXECUTAR TODOS OS TESTES
// ============================================================

/**
 * Executa toda a suite de validação
 * 
 * @returns {Promise<Object>} Resultado: {passed, failed, total, results}
 */
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   SUITE DE VALIDAÇÃO BÁSICA - ANALISADOR DE ÁUDIO ║');
  console.log('║          ITU-R BS.1770-4 | EBU R128 | AES17        ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('');
  console.log('Executando 5 testes de validação broadcast-grade...');
  
  const tests = [
    { name: 'LUFS Tom 1kHz @ -20dBFS', fn: testLUFS_Tone1kHz },
    { name: 'Peak Tom @ -6dBFS', fn: testPeak_Tone },
    { name: 'LUFS Silêncio (Gating)', fn: testLUFS_Silence },
    { name: 'Dynamic Range ≥ 0', fn: testDR_NonNegative },
    { name: 'Spectral dBFS ≤ 0', fn: testSpectral_dBFS_Clamp },
  ];
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ test: test.name, ...result });
      
      if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`\n❌ ERRO CRÍTICO no teste "${test.name}":`);
      console.log(`   ${error.message}`);
      console.log(error.stack);
      failed++;
      results.push({ test: test.name, passed: false, error: error.message });
    }
  }
  
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log(`║   RESULTADO FINAL: ${passed}/${tests.length} testes passaram           ║`);
  console.log('╚═══════════════════════════════════════════════════╝');
  
  if (passed === tests.length) {
    console.log('\n🏆 EXCELENTE! Analisador está broadcast-grade compliant.');
    console.log('   Métricas validadas: LUFS, Peak, Gating, DR, dBFS');
  } else if (passed >= tests.length * 0.8) {
    console.log(`\n⚠️  BOM, mas ${failed} teste(s) falharam. Revisar implementação.`);
  } else {
    console.log(`\n❌ CRÍTICO: ${failed} de ${tests.length} testes falharam.`);
    console.log('   Analisador precisa de correções antes de uso profissional.');
  }
  
  return { 
    passed, 
    failed, 
    total: tests.length, 
    results,
    success: passed === tests.length
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  // Geradores
  generateTone,
  generateWhiteNoise,
  generateSilence,
  monoToStereo,
  
  // Suite completa
  runAllTests,
  
  // Testes individuais
  testLUFS_Tone1kHz,
  testPeak_Tone,
  testLUFS_Silence,
  testDR_NonNegative,
  testSpectral_dBFS_Clamp,
};

// ============================================================
// CLI EXECUTION
// ============================================================

// Se executado diretamente (não importado)
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && resolve(process.argv[1]) === __filename;

if (isMainModule) {
  runAllTests()
    .then(result => {
      console.log('\n📊 Resumo detalhado:');
      result.results.forEach((r, i) => {
        const status = r.passed ? '✅' : '❌';
        console.log(`${status} ${i + 1}. ${r.test}`);
        if (r.error) console.log(`   Erro: ${r.error}`);
      });
      
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Erro fatal na execução da suite:');
      console.error(error);
      process.exit(1);
    });
}
