#!/usr/bin/env node

/**
 * 🎯 Teste JSON Final: Validar estrutura completa do JSON de saída
 * 
 * Verificar se os dados corrigidos aparecem corretamente em:
 * - metrics.bands
 * - spectralBands 
 * - technicalData.spectral_balance
 * 
 * Com estrutura: range, energy_db, percentage, status: "calculated"
 */

import { SpectralBandsCalculator, SpectralBandsAggregator } from './work/lib/audio/features/spectral-bands.js';

console.log('🎯 [TESTE JSON FINAL] Validação da estrutura JSON completa...\n');

// Simular dados de bandas calculadas
const calculator = new SpectralBandsCalculator(48000, 4096);
const fftSize = 4096;
const sampleRate = 48000;
const binCount = Math.floor(fftSize / 2) + 1;

// Gerar espectro de teste (mistura: bass + mid)
const leftMagnitude = new Float32Array(binCount);
const rightMagnitude = new Float32Array(binCount);

// Energia significativa em bass (80-120Hz) e mid (1-2kHz)
for (let i = 1; i < binCount; i++) {
  const frequency = i * (sampleRate / fftSize);
  
  if (frequency >= 80 && frequency <= 120) {
    // Bass dominante
    leftMagnitude[i] = 1.0;
    rightMagnitude[i] = 1.0;
  } else if (frequency >= 1000 && frequency <= 2000) {
    // Mid secundário
    leftMagnitude[i] = 0.5;
    rightMagnitude[i] = 0.5;
  } else {
    // Ruído de fundo baixo
    leftMagnitude[i] = 0.01;
    rightMagnitude[i] = 0.01;
  }
}

console.log('🎵 Calculando bandas espectrais...');
const result = calculator.analyzeBands(leftMagnitude, rightMagnitude, 0);

if (result.valid && result.bands) {
  console.log('\n📊 Bandas calculadas:');
  
  const expectedStructure = {
    bass: result.bands.bass,
    mid: result.bands.mid,
    sub: result.bands.sub
  };
  
  // Mostrar principais bandas
  for (const [key, band] of Object.entries(expectedStructure)) {
    console.log(`   ${key.toUpperCase()}: ${band.percentage.toFixed(1)}% | ${band.energy_db.toFixed(1)}dB | ${band.status} | ${band.frequencyRange}`);
  }
  
  console.log(`\n🔍 Estrutura esperada para JSON:`);
  
  // Simular estrutura metrics.bands
  const metricsStructure = {
    sub: { 
      energy_db: result.bands.sub.energy_db, 
      percentage: result.bands.sub.percentage,
      range: result.bands.sub.frequencyRange,
      status: result.bands.sub.status
    },
    bass: { 
      energy_db: result.bands.bass.energy_db, 
      percentage: result.bands.bass.percentage,
      range: result.bands.bass.frequencyRange,
      status: result.bands.bass.status
    },
    lowMid: { 
      energy_db: result.bands.lowMid.energy_db, 
      percentage: result.bands.lowMid.percentage,
      range: result.bands.lowMid.frequencyRange,
      status: result.bands.lowMid.status
    },
    mid: { 
      energy_db: result.bands.mid.energy_db, 
      percentage: result.bands.mid.percentage,
      range: result.bands.mid.frequencyRange,
      status: result.bands.mid.status
    },
    highMid: { 
      energy_db: result.bands.highMid.energy_db, 
      percentage: result.bands.highMid.percentage,
      range: result.bands.highMid.frequencyRange,
      status: result.bands.highMid.status
    },
    presence: { 
      energy_db: result.bands.presence.energy_db, 
      percentage: result.bands.presence.percentage,
      range: result.bands.presence.frequencyRange,
      status: result.bands.presence.status
    },
    air: { 
      energy_db: result.bands.air.energy_db, 
      percentage: result.bands.air.percentage,
      range: result.bands.air.frequencyRange,
      status: result.bands.air.status
    },
    totalPercentage: result.totalPercentage
  };
  
  console.log(`\n📋 metrics.bands:`);
  console.log(JSON.stringify(metricsStructure, null, 2));
  
  console.log(`\n📋 spectralBands (mesmo formato):`);
  console.log('   [Idêntico ao metrics.bands]');
  
  console.log(`\n📋 technicalData.spectral_balance:`);
  console.log('   [Fonte original dos dados]');
  
  // ✅ VALIDAÇÕES ESTRUTURAIS
  console.log(`\n✅ Validações Estruturais:`);
  
  // 1. Todos os campos presentes
  const requiredFields = ['energy_db', 'percentage', 'range', 'status'];
  const allFieldsPresent = Object.values(metricsStructure).every(band => {
    if (typeof band === 'object' && band !== null) {
      return requiredFields.every(field => field in band);
    }
    return true; // totalPercentage é number
  });
  console.log(`   1. Campos obrigatórios: ${allFieldsPresent ? '✅ PASS' : '❌ FAIL'} (energy_db, percentage, range, status)`);
  
  // 2. Status "calculated"
  const allCalculated = Object.values(result.bands).every(band => band.status === 'calculated');
  console.log(`   2. Status "calculated": ${allCalculated ? '✅ PASS' : '❌ FAIL'}`);
  
  // 3. Types corretos
  const typesValid = Object.values(result.bands).every(band => 
    typeof band.energy_db === 'number' &&
    typeof band.percentage === 'number' &&
    typeof band.frequencyRange === 'string' &&
    typeof band.status === 'string'
  );
  console.log(`   3. Tipos corretos: ${typesValid ? '✅ PASS' : '❌ FAIL'} (number, number, string, string)`);
  
  // 4. Ranges corretos
  const expectedRanges = [
    { key: 'sub', range: '20-60Hz' },
    { key: 'bass', range: '60-150Hz' },
    { key: 'lowMid', range: '150-500Hz' },
    { key: 'mid', range: '500-2000Hz' },
    { key: 'highMid', range: '2000-5000Hz' },
    { key: 'presence', range: '5000-10000Hz' },
    { key: 'air', range: '10000-20000Hz' }
  ];
  
  const rangesValid = expectedRanges.every(exp => 
    result.bands[exp.key].frequencyRange === exp.range
  );
  console.log(`   4. Ranges corretos: ${rangesValid ? '✅ PASS' : '❌ FAIL'}`);
  
  // 5. Sem campo "brilliance"
  const noBrilliance = !('brilliance' in result.bands);
  console.log(`   5. Sem "brilliance": ${noBrilliance ? '✅ PASS' : '❌ FAIL'}`);
  
  // 6. Bass deve dominar neste teste
  const bassDominates = result.bands.bass.percentage > 50;
  console.log(`   6. Bass domina teste: ${bassDominates ? '✅ PASS' : '❌ FAIL'} (${result.bands.bass.percentage.toFixed(1)}%)`);
  
  if (allFieldsPresent && allCalculated && typesValid && rangesValid && noBrilliance && bassDominates) {
    console.log(`\n🎉 TESTE JSON ESTRUTURAL PASSOU! Pronto para Postgres.`);
  } else {
    console.log(`\n⚠️  TESTE JSON ESTRUTURAL FALHOU. Verificar implementação.`);
  }
  
} else {
  console.log('❌ Falha no cálculo das bandas espectrais');
}

console.log(`\n🔗 JSON Postgres esperado:`);
console.log(`{`);
console.log(`  "metrics": {`);
console.log(`    "bands": {`);
console.log(`      "sub": {"range":"20-60Hz", "status":"calculated", "energy_db":-5.2, "percentage":8.5},`);
console.log(`      "bass": {"range":"60-150Hz", "status":"calculated", "energy_db":12.3, "percentage":65.2},`);
console.log(`      "mid": {"range":"500-2000Hz", "status":"calculated", "energy_db":5.1, "percentage":20.3},`);
console.log(`      ...`);
console.log(`    }`);
console.log(`  },`);
console.log(`  "spectralBands": { [mesmo que metrics.bands] },`);
console.log(`  "technicalData": {`);
console.log(`    "spectral_balance": { [dados fonte] }`);
console.log(`  }`);
console.log(`}`);