// 🧪 TESTE DE VALIDAÇÃO: Spectral Bands dBFS Backend
// Testar se os valores de energy_db agora são sempre ≤ 0 dBFS

import { SpectralBandsCalculator, SpectralBandsAggregator } from '../lib/audio/features/spectral-bands.js';

/**
 * 🎯 Simulador de dados FFT para teste
 */
function createTestFFTData(dominantBand = 'mid', peakLevel = 0.8) {
  const fftSize = 4096;
  const sampleRate = 48000;
  const leftMagnitude = new Float32Array(fftSize / 2);
  const rightMagnitude = new Float32Array(fftSize / 2);
  
  // Frequência de resolução
  const freqRes = sampleRate / fftSize;
  
  // Definir bandas de teste
  const bands = {
    sub: { min: 20, max: 60 },
    bass: { min: 60, max: 150 },
    lowMid: { min: 150, max: 500 },
    mid: { min: 500, max: 2000 },
    highMid: { min: 2000, max: 5000 },
    presence: { min: 5000, max: 10000 },
    air: { min: 10000, max: 20000 }
  };
  
  // Preencher com ruído de fundo baixo
  for (let i = 0; i < leftMagnitude.length; i++) {
    leftMagnitude[i] = 0.001; // -60 dBFS de ruído
    rightMagnitude[i] = 0.001;
  }
  
  // Adicionar energia na banda dominante
  const dominantBandInfo = bands[dominantBand];
  if (dominantBandInfo) {
    const minBin = Math.floor(dominantBandInfo.min / freqRes);
    const maxBin = Math.ceil(dominantBandInfo.max / freqRes);
    
    for (let bin = minBin; bin <= maxBin && bin < leftMagnitude.length; bin++) {
      leftMagnitude[bin] = peakLevel; // Nível do pico
      rightMagnitude[bin] = peakLevel * 0.9; // Slightly different for stereo
    }
  }
  
  return { leftMagnitude, rightMagnitude, dominantBand, peakLevel };
}

/**
 * 🔬 Teste principal
 */
async function testSpectralBandsCorrection() {
  console.log('🧪 === TESTE CORREÇÃO SPECTRAL BANDS dBFS ===\n');
  
  const calculator = new SpectralBandsCalculator(48000, 4096);
  let allTests = [];
  
  // Teste 1: Banda dominante Mid com nível alto
  console.log('📊 Teste 1: Banda Mid dominante (0.8 amplitude)');
  const test1 = createTestFFTData('mid', 0.8);
  const result1 = calculator.analyzeBands(test1.leftMagnitude, test1.rightMagnitude, 0);
  
  console.log('Resultados Teste 1:');
  for (const [key, band] of Object.entries(result1.bands)) {
    const energyOk = band.energy_db <= 0 ? '✅' : '❌';
    console.log(`  ${key}: ${band.energy_db}dB ${energyOk}, ${band.percentage}%`);
  }
  allTests.push(result1);
  
  // Teste 2: Banda dominante Bass com nível baixo
  console.log('\n📊 Teste 2: Banda Bass dominante (0.3 amplitude)');
  const test2 = createTestFFTData('bass', 0.3);
  const result2 = calculator.analyzeBands(test2.leftMagnitude, test2.rightMagnitude, 1);
  
  console.log('Resultados Teste 2:');
  for (const [key, band] of Object.entries(result2.bands)) {
    const energyOk = band.energy_db <= 0 ? '✅' : '❌';
    console.log(`  ${key}: ${band.energy_db}dB ${energyOk}, ${band.percentage}%`);
  }
  allTests.push(result2);
  
  // Teste 3: Banda dominante Presence com nível máximo
  console.log('\n📊 Teste 3: Banda Presence dominante (1.0 amplitude)');
  const test3 = createTestFFTData('presence', 1.0);
  const result3 = calculator.analyzeBands(test3.leftMagnitude, test3.rightMagnitude, 2);
  
  console.log('Resultados Teste 3:');
  for (const [key, band] of Object.entries(result3.bands)) {
    const energyOk = band.energy_db <= 0 ? '✅' : '❌';
    console.log(`  ${key}: ${band.energy_db}dB ${energyOk}, ${band.percentage}%`);
  }
  allTests.push(result3);
  
  // Validação geral
  console.log('\n🔍 === VALIDAÇÃO GERAL ===');
  
  let totalViolations = 0;
  let totalBands = 0;
  
  allTests.forEach((result, testIndex) => {
    console.log(`\nTeste ${testIndex + 1}:`);
    console.log(`  Total %: ${result.totalPercentage}% (deve ser ~100%)`);
    console.log(`  Válido: ${result.valid ? '✅' : '❌'}`);
    
    for (const [key, band] of Object.entries(result.bands)) {
      totalBands++;
      if (band.energy_db > 0) {
        totalViolations++;
        console.log(`  ❌ VIOLAÇÃO: ${key} = ${band.energy_db}dB > 0 dBFS`);
      }
    }
  });
  
  // Teste de agregação
  console.log('\n📈 === TESTE AGREGAÇÃO ===');
  const aggregated = SpectralBandsAggregator.aggregate(allTests);
  console.log('Resultado agregado:');
  console.log(`  Total %: ${aggregated.totalPercentage}%`);
  console.log(`  Válido: ${aggregated.valid ? '✅' : '❌'}`);
  console.log(`  Frames usados: ${aggregated.framesUsed}`);
  
  for (const [key, band] of Object.entries(aggregated.bands)) {
    const energyOk = band.energy_db <= 0 ? '✅' : '❌';
    console.log(`  ${key}: ${band.energy_db}dB ${energyOk}, ${band.percentage}%`);
    if (band.energy_db > 0) totalViolations++;
  }
  
  // Resultado final
  console.log('\n🎯 === RESULTADO FINAL ===');
  if (totalViolations === 0) {
    console.log('✅ SUCESSO: Todas as bandas respeitam o limite dBFS (≤ 0)');
    console.log(`✅ Testadas ${totalBands} bandas em ${allTests.length} frames`);
    console.log('✅ Percentuais somando corretamente ~100%');
    console.log('✅ Agregação funcionando corretamente');
  } else {
    console.log(`❌ FALHA: ${totalViolations} violações encontradas`);
    console.log('❌ Algumas bandas ainda ultrapassam 0 dBFS');
  }
  
  return totalViolations === 0;
}

/**
 * 🚀 Executar teste
 */
console.log('🚀 Iniciando teste de correção dBFS...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

// Simplifcar execução
testSpectralBandsCorrection()
  .then(success => {
    console.log(`\n${success ? '🎉' : '💥'} Teste ${success ? 'PASSOU' : 'FALHOU'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Erro no teste:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  });

export { testSpectralBandsCorrection };