// 🧪 TESTE SIMPLES - SPECTRAL CENTROID
// Teste direto da função calculateSpectralCentroid

import { CoreMetricsProcessor } from '../../api/audio/core-metrics.js';

/**
 * 🧪 Teste direto da função calculateSpectralCentroid
 */
async function testSpectralCentroidDirect() {
  console.log('\n🧪 ===== TESTE DIRETO SPECTRAL CENTROID =====');
  
  try {
    const processor = new CoreMetricsProcessor();
    
    // Teste 1: Magnitude com pico em 1kHz
    console.log('\n1️⃣ Teste: Pico em 1kHz');
    const sampleRate = 48000;
    const fftSize = 4096;
    const frequencyResolution = sampleRate / fftSize; // ~11.72 Hz por bin
    const targetFreq = 1000; // Hz
    const targetBin = Math.round(targetFreq / frequencyResolution); // bin ~85
    
    const magnitude1k = new Float32Array(fftSize / 2);
    magnitude1k.fill(0); // SEM ruído de fundo - só o pico
    magnitude1k[targetBin] = 1.0; // Pico na frequência alvo
    
    const centroid1k = processor.calculateSpectralCentroid(magnitude1k);
    console.log(`📊 Resultado: ${centroid1k?.toFixed(1) || 'null'} Hz`);
    console.log(`🎯 Esperado: ~${targetFreq} Hz`);
    console.log(`🔢 Target bin: ${targetBin} (${(targetBin * frequencyResolution).toFixed(1)} Hz)`);
    
    const tolerance = 50; // ±50 Hz para pico único
    const isValid1k = centroid1k !== null && Math.abs(centroid1k - targetFreq) <= tolerance;
    console.log(`✅ Validação: ${isValid1k ? 'PASSOU' : 'FALHOU'}`);
    
    // Teste 2: Magnitude com pico em 2kHz
    console.log('\n2️⃣ Teste: Pico em 2kHz');
    const targetFreq2k = 2000;
    const targetBin2k = Math.round(targetFreq2k / frequencyResolution);
    
    const magnitude2k = new Float32Array(fftSize / 2);
    magnitude2k.fill(0); // SEM ruído de fundo
    magnitude2k[targetBin2k] = 1.0;
    
    const centroid2k = processor.calculateSpectralCentroid(magnitude2k);
    console.log(`📊 Resultado: ${centroid2k?.toFixed(1) || 'null'} Hz`);
    console.log(`🎯 Esperado: ~${targetFreq2k} Hz`);
    console.log(`🔢 Target bin: ${targetBin2k} (${(targetBin2k * frequencyResolution).toFixed(1)} Hz)`);
    
    const isValid2k = centroid2k !== null && Math.abs(centroid2k - targetFreq2k) <= tolerance;
    console.log(`✅ Validação: ${isValid2k ? 'PASSOU' : 'FALHOU'}`);
    
    // DEBUG: Teste manual do cálculo
    console.log('\n🔍 DEBUG: Cálculo manual para verificação');
    let debugWeightedSum = 0;
    let debugTotalMagnitude = 0;
    
    for (let i = 1; i < magnitude1k.length; i++) {
      const frequency = i * frequencyResolution;
      if (magnitude1k[i] > 0) {
        console.log(`   Bin ${i}: ${frequency.toFixed(1)} Hz, magnitude: ${magnitude1k[i]}`);
        debugWeightedSum += frequency * magnitude1k[i];
        debugTotalMagnitude += magnitude1k[i];
      }
    }
    
    const debugCentroid = debugTotalMagnitude > 0 ? debugWeightedSum / debugTotalMagnitude : null;
    console.log(`   Weighted sum: ${debugWeightedSum.toFixed(1)}`);
    console.log(`   Total magnitude: ${debugTotalMagnitude.toFixed(1)}`);
    console.log(`   Manual centroid: ${debugCentroid?.toFixed(1) || 'null'} Hz`);
    // Teste 3: Silêncio absoluto
    console.log('\n3️⃣ Teste: Silêncio');
    const magnitudeSilence = new Float32Array(fftSize / 2);
    magnitudeSilence.fill(0); // Todos os bins = 0
    
    const centroidSilence = processor.calculateSpectralCentroid(magnitudeSilence);
    console.log(`📊 Resultado: ${centroidSilence === null ? 'null' : centroidSilence?.toFixed(1)}`);
    console.log(`🎯 Esperado: null`);
    
    const isValidSilence = centroidSilence === null;
    console.log(`✅ Validação: ${isValidSilence ? 'PASSOU' : 'FALHOU'}`);
    
    // Teste 4: Espectro uniforme (ruído branco)
    console.log('\n4️⃣ Teste: Espectro Uniforme');
    const magnitudeWhite = new Float32Array(fftSize / 2);
    magnitudeWhite.fill(1.0); // Energia uniforme em todas as frequências
    
    const centroidWhite = processor.calculateSpectralCentroid(magnitudeWhite);
    const expectedWhite = (sampleRate / 2) / 2; // Metade da banda Nyquist = ~12kHz
    console.log(`📊 Resultado: ${centroidWhite?.toFixed(1) || 'null'} Hz`);
    console.log(`🎯 Esperado: ~${expectedWhite.toFixed(1)} Hz (centro espectral)`);
    
    const toleranceWhite = 1000; // ±1kHz para ruído branco
    const isValidWhite = centroidWhite !== null && Math.abs(centroidWhite - expectedWhite) <= toleranceWhite;
    console.log(`✅ Validação: ${isValidWhite ? 'PASSOU' : 'FALHOU'}`);
    
    // Teste 5: Validação de range
    console.log('\n5️⃣ Teste: Validação de Range');
    const isValidRange1k = centroid1k !== null && centroid1k > 0 && centroid1k <= sampleRate / 2;
    const isValidRange2k = centroid2k !== null && centroid2k > 0 && centroid2k <= sampleRate / 2;
    const isValidRangeWhite = centroidWhite !== null && centroidWhite > 0 && centroidWhite <= sampleRate / 2;
    
    console.log(`📐 Range válido (0-${sampleRate/2} Hz):`);
    console.log(`   1kHz: ${isValidRange1k ? '✅' : '❌'}`);
    console.log(`   2kHz: ${isValidRange2k ? '✅' : '❌'}`);
    console.log(`   White: ${isValidRangeWhite ? '✅' : '❌'}`);
    
    // Log de auditoria manual
    console.log('\n🔍 [AUDITORIA] Spectral Centroid - Fórmula Matemática:');
    console.log('   📐 Fórmula: centroid = Σ(f * magnitude(f)) / Σ magnitude(f)');
    console.log('   🎵 Frequência: f = binIndex * sampleRate / fftSize');
    console.log('   📊 Retorno: Number em Hz ou null para silêncio');
    console.log('   ✅ Implementação conforme padrão matemático');
    
    // Resumo
    const allPassed = isValid1k && isValid2k && isValidSilence && isValidWhite && 
                      isValidRange1k && isValidRange2k && isValidRangeWhite;
    console.log(`\n📈 RESUMO: ${allPassed ? '✅ TODOS OS TESTES PASSARAM' : '❌ ALGUNS TESTES FALHARAM'}`);
    console.log('🧪 ===== FIM TESTE DIRETO SPECTRAL CENTROID =====\n');
    
    return allPassed;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.log('🧪 ===== FIM TESTE DIRETO SPECTRAL CENTROID ❌ =====\n');
    return false;
  }
}

/**
 * 🏃‍♂️ Executar teste
 */
testSpectralCentroidDirect().then(success => {
  process.exit(success ? 0 : 1);
});

export { testSpectralCentroidDirect };

console.log('🧪 Teste Spectral Centroid Direto carregado');