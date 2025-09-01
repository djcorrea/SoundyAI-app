/**
 * 🧪 SPECTRAL BALANCE TESTS
 * Testes para validar o funcionamento do novo sistema de balanço espectral
 */

import { 
  SpectralBalanceAnalyzer,
  analyzeSpectralBalance,
  stereoToMono,
  DEFAULT_BANDS_7,
  DEFAULT_BANDS_3,
  type SpectralBalanceResult 
} from '../core/spectralBalance';

import { 
  SpectralIntegration,
  integrateSpectralAnalysis,
  upgradeExistingResult 
} from '../core/spectralIntegration';

/**
 * 🎵 Gerar sinal de teste senoidal
 */
function generateSineWave(frequency: number, duration: number, sampleRate: number = 48000): Float32Array {
  const samples = Math.floor(duration * sampleRate);
  const signal = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    signal[i] = 0.5 * Math.sin(2 * Math.PI * frequency * t);
  }
  
  return signal;
}

/**
 * 🌊 Gerar ruído branco
 */
function generateWhiteNoise(duration: number, sampleRate: number = 48000): Float32Array {
  const samples = Math.floor(duration * sampleRate);
  const signal = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    signal[i] = (Math.random() * 2 - 1) * 0.1; // Amplitude baixa
  }
  
  return signal;
}

/**
 * 🟢 Teste 1: Seno puro - deve concentrar energia na banda correta
 */
export async function testSinePurity() {
  console.log('🧪 Teste 1: Seno puro (1kHz)');
  
  const testSignal = generateSineWave(1000, 1.0); // 1kHz, 1 segundo
  const result = analyzeSpectralBalance(testSignal, 48000, DEFAULT_BANDS_7);
  
  // Encontrar banda que contém 1kHz
  const targetBand = result.bands.find(b => b.hzLow <= 1000 && b.hzHigh >= 1000);
  
  if (targetBand) {
    console.log(`✅ Banda encontrada: ${targetBand.name} (${targetBand.hzLow}-${targetBand.hzHigh} Hz)`);
    console.log(`📊 Energia concentrada: ${targetBand.energyPct.toFixed(1)}%`);
    
    // Deve ter >80% da energia na banda correta
    if (targetBand.energyPct > 80) {
      console.log('✅ PASSOU: Energia bem concentrada (>80%)');
    } else {
      console.log('❌ FALHOU: Energia dispersa');
    }
  } else {
    console.log('❌ FALHOU: Banda não encontrada para 1kHz');
  }
  
  return result;
}

/**
 * ⚪ Teste 2: Ruído branco - deve ter distribuição uniforme
 */
export async function testWhiteNoiseDistribution() {
  console.log('🧪 Teste 2: Ruído branco');
  
  const testSignal = generateWhiteNoise(2.0); // 2 segundos
  const result = analyzeSpectralBalance(testSignal, 48000, DEFAULT_BANDS_7);
  
  const energies = result.bands.map(b => b.energyPct);
  const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
  const variance = energies.reduce((sum, e) => sum + Math.pow(e - avgEnergy, 2), 0) / energies.length;
  const stdDev = Math.sqrt(variance);
  
  console.log(`📊 Energia média por banda: ${avgEnergy.toFixed(1)}%`);
  console.log(`📏 Desvio padrão: ${stdDev.toFixed(1)}%`);
  
  // Para ruído branco, desvio deve ser relativamente baixo (<5%)
  if (stdDev < 5) {
    console.log('✅ PASSOU: Distribuição uniforme');
  } else {
    console.log('❌ FALHOU: Distribuição muito irregular');
  }
  
  // Mostrar breakdown por banda
  result.bands.forEach(band => {
    console.log(`  ${band.name}: ${band.energyPct.toFixed(1)}%`);
  });
  
  return result;
}

/**
 * 🔧 Teste 3: Compatibilidade com sistema existente
 */
export async function testCompatibility() {
  console.log('🧪 Teste 3: Compatibilidade');
  
  const testSignal = generateSineWave(1000, 1.0);
  
  // Simular resultado existente (legacy)
  const existingResult = {
    lufsIntegrated: -14.0,
    truePeakDbtp: -1.0,
    dynamicRange: 10.0,
    sampleRate: 48000,
    duration: 1.0,
    channels: 1,
    tonalBalance: {
      low: { rms_db: -20.0 },
      mid: { rms_db: -6.0 }, // 1kHz está no mid
      high: { rms_db: -30.0 }
    }
  };
  
  // Integrar nova análise
  const integration = new SpectralIntegration();
  const spectralResult = analyzeSpectralBalance(testSignal, 48000, DEFAULT_BANDS_7);
  const upgradedResult = upgradeExistingResult(existingResult, spectralResult);
  
  // Verificar compatibilidade
  const isCompatible = integration.validateCompatibility(upgradedResult);
  
  console.log(`🔗 Campos mantidos: ${Object.keys(existingResult).length}`);
  console.log(`✨ Campos adicionados: spectralBalance, bandEnergies`);
  console.log(`🧪 Compatibilidade: ${isCompatible ? 'OK' : 'PROBLEMAS'}`);
  
  if (upgradedResult.bandEnergies) {
    console.log('📊 Exemplo bandEnergies:');
    Object.entries(upgradedResult.bandEnergies).forEach(([key, band]) => {
      if (band.energyPct !== undefined) {
        console.log(`  ${key}: ${band.energyPct.toFixed(1)}% energia, ${band.rms_db.toFixed(1)} dB`);
      }
    });
  }
  
  return upgradedResult;
}

/**
 * 🎯 Teste 4: Diferença de valores dB (deve ser <0.2 dB)
 */
export async function testDbStability() {
  console.log('🧪 Teste 4: Estabilidade de valores dB');
  
  const testSignal = generateWhiteNoise(1.0);
  
  // Executar múltiplas análises
  const results: SpectralBalanceResult[] = [];
  for (let i = 0; i < 5; i++) {
    const result = analyzeSpectralBalance(testSignal, 48000, DEFAULT_BANDS_3);
    results.push(result);
  }
  
  // Comparar valores dB entre execuções
  const band = 'Mid'; // Foco na banda Mid
  const dbValues = results.map(r => r.summary3Bands.Mid.rmsDb).filter(v => isFinite(v));
  
  if (dbValues.length > 1) {
    const min = Math.min(...dbValues);
    const max = Math.max(...dbValues);
    const difference = max - min;
    
    console.log(`📏 Variação dB (${band}): ${difference.toFixed(3)} dB`);
    
    if (difference < 0.2) {
      console.log('✅ PASSOU: Valores dB estáveis (<0.2 dB)');
    } else {
      console.log('❌ FALHOU: Valores dB instáveis');
    }
  } else {
    console.log('⚠️ Dados insuficientes para comparação');
  }
  
  return results;
}

/**
 * 🚀 Executar todos os testes
 */
export async function runAllTests() {
  console.log('🚀 EXECUTANDO TESTES DO SISTEMA ESPECTRAL');
  console.log('=' .repeat(50));
  
  const results = {
    sine: await testSinePurity(),
    noise: await testWhiteNoiseDistribution(), 
    compatibility: await testCompatibility(),
    stability: await testDbStability()
  };
  
  console.log('=' .repeat(50));
  console.log('✅ TODOS OS TESTES CONCLUÍDOS');
  
  return results;
}

/**
 * 🎵 Exemplo de uso do sistema integrado
 */
export async function exampleUsage() {
  console.log('📖 EXEMPLO DE USO DO SISTEMA');
  
  // 1. Gerar sinal de teste
  const audioSignal = generateSineWave(440, 2.0); // Lá 440Hz, 2 segundos
  
  // 2. Análise usando função utilitária
  const spectralResult = await integrateSpectralAnalysis(audioSignal, 48000);
  
  // 3. Mostrar resultados
  console.log('🎵 Resultado da análise:');
  console.log('  Bandas espectrais:', spectralResult.spectralBalance?.bands.length);
  console.log('  Total de energia:', spectralResult.spectralBalance?.totalEnergy.toExponential(2));
  console.log('  Frames processados:', spectralResult.spectralBalance?.processedFrames);
  
  if (spectralResult.bandEnergies) {
    console.log('📊 Energias por banda:');
    Object.entries(spectralResult.bandEnergies).forEach(([name, band]) => {
      if (band.energyPct !== undefined) {
        console.log(`  ${name}: ${band.energyPct.toFixed(1)}% (${band.rms_db.toFixed(1)} dB)`);
      }
    });
  }
  
  return spectralResult;
}

// Exportar para uso em testes
export { generateSineWave, generateWhiteNoise };
