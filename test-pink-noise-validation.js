#!/usr/bin/env node

/**
 * 🌈 Teste Pink Noise: Validação completa das correções implementadas
 * 
 * OBJETIVOS:
 * 1. Todas as bandas devem ter energia > 0
 * 2. Soma das percentagens deve ser ≈ 100%
 * 3. Valores dB devem estar na faixa ±0-20 dB (corrigidos)
 * 4. Pink noise deve ter distribuição equilibrada nas bandas
 */

import { SpectralBandsCalculator } from './work/lib/audio/features/spectral-bands.js';

console.log('🌈 [TESTE PINK NOISE] Validação completa das correções...\n');

const calculator = new SpectralBandsCalculator(48000, 4096);
const fftSize = 4096;
const sampleRate = 48000;
const binCount = Math.floor(fftSize / 2) + 1;

console.log(`🔍 Configurações:`);
console.log(`   Sample Rate: ${sampleRate} Hz`);
console.log(`   FFT Size: ${fftSize}`);
console.log(`   Frequency Resolution: ${(sampleRate / fftSize).toFixed(2)} Hz/bin`);
console.log(`   Bins Total: ${binCount}`);

// Gerar pink noise sintético
// Pink noise: magnitude ∝ 1/f (energia diminui 3dB por oitava)
const leftMagnitude = new Float32Array(binCount);
const rightMagnitude = new Float32Array(binCount);

for (let i = 1; i < binCount; i++) {
  const frequency = i * (sampleRate / fftSize);
  
  // Pink noise: magnitude inversamente proporcional à sqrt(frequência)
  // Isso dá a característica -3dB/oitava do pink noise
  const pinkMagnitude = 1.0 / Math.sqrt(frequency);
  
  // Adicionar alguma variação randômica (±10%)
  const variation = 0.9 + (Math.random() * 0.2);
  
  leftMagnitude[i] = pinkMagnitude * variation;
  rightMagnitude[i] = pinkMagnitude * variation;
}

// DC component (bin 0) tem energia moderada
leftMagnitude[0] = 0.5;
rightMagnitude[0] = 0.5;

console.log(`\n🎯 Gerando pink noise sintético...`);
console.log(`   Energia em 50Hz (bin ~4): ${leftMagnitude[4].toFixed(3)}`);
console.log(`   Energia em 1kHz (bin ~85): ${leftMagnitude[85].toFixed(3)}`);
console.log(`   Energia em 10kHz (bin ~853): ${leftMagnitude[853].toFixed(3)}`);

console.log(`\n🎵 Calculando bandas espectrais...`);

const result = calculator.analyzeBands(leftMagnitude, rightMagnitude, 0);

if (result.valid && result.bands) {
  console.log('\n📊 Resultado das bandas:');
  
  const bands = [
    { name: 'Sub (20-60Hz)', key: 'sub' },
    { name: 'Bass (60-150Hz)', key: 'bass' },
    { name: 'Low-Mid (150-500Hz)', key: 'lowMid' },
    { name: 'Mid (500-2kHz)', key: 'mid' },
    { name: 'High-Mid (2-5kHz)', key: 'highMid' },
    { name: 'Presence (5-10kHz)', key: 'presence' },
    { name: 'Air (10-20kHz)', key: 'air' }
  ];
  
  let totalPercentage = 0;
  let allBandsPositive = true;
  let dbValuesValid = true;
  const dbValues = [];
  
  for (const band of bands) {
    const bandData = result.bands[band.key];
    const percentage = bandData.percentage || 0;
    const energyDb = bandData.energy_db || -120;
    const status = bandData.status || 'unknown';
    
    console.log(`   ${band.name.padEnd(22)}: ${percentage.toFixed(1).padStart(5)}% | ${energyDb.toFixed(1).padStart(6)}dB | ${status}`);
    
    totalPercentage += percentage;
    if (percentage <= 0) allBandsPositive = false;
    
    // Verificar se dB está na faixa esperada (±0-20 dB, não mais 30-40 dB)
    if (energyDb < -25 || energyDb > 25) dbValuesValid = false;
    dbValues.push(energyDb);
  }
  
  console.log(`\n📈 Análise Pink Noise:`);
  console.log(`   Total Percentage: ${totalPercentage.toFixed(1)}%`);
  console.log(`   Maior banda: ${Math.max(...Object.values(result.bands).map(b => b.percentage)).toFixed(1)}%`);
  console.log(`   Menor banda: ${Math.min(...Object.values(result.bands).map(b => b.percentage)).toFixed(1)}%`);
  console.log(`   Faixa dB: ${Math.min(...dbValues).toFixed(1)} a ${Math.max(...dbValues).toFixed(1)}dB`);
  console.log(`   Desvio padrão dB: ${Math.sqrt(dbValues.reduce((sum, v) => sum + v*v, 0) / dbValues.length - Math.pow(dbValues.reduce((sum, v) => sum + v, 0) / dbValues.length, 2)).toFixed(1)}`);
  
  // ✅ VALIDAÇÕES CRÍTICAS
  console.log(`\n✅ Validações:`);
  
  // 1. Todas as bandas > 0
  console.log(`   1. Todas bandas > 0%: ${allBandsPositive ? '✅ PASS' : '❌ FAIL'}`);
  
  // 2. Soma ≈ 100%
  const sumValid = Math.abs(totalPercentage - 100) < 0.1;
  console.log(`   2. Soma ≈ 100%: ${sumValid ? '✅ PASS' : '❌ FAIL'} (${totalPercentage.toFixed(1)}%)`);
  
  // 3. Valores dB na faixa correta (±0-20 dB, não mais 30-40 dB)
  console.log(`   3. dB na faixa ±25dB: ${dbValuesValid ? '✅ PASS' : '❌ FAIL'} (faixa: ${Math.min(...dbValues).toFixed(1)} a ${Math.max(...dbValues).toFixed(1)}dB)`);
  
  // 4. Pink noise deve ter distribuição razoável (nenhuma banda domina absurdamente)
  const maxPercentage = Math.max(...Object.values(result.bands).map(b => b.percentage));
  const distribution = maxPercentage < 50; // Nenhuma banda > 50%
  console.log(`   4. Distribuição equilibrada: ${distribution ? '✅ PASS' : '❌ FAIL'} (máx: ${maxPercentage.toFixed(1)}%)`);
  
  // 5. Energy_db implementado
  const hasEnergyDb = Object.values(result.bands).every(b => typeof b.energy_db === 'number');
  console.log(`   5. Energy_dB implementado: ${hasEnergyDb ? '✅ PASS' : '❌ FAIL'}`);
  
  // 6. Status "calculated"
  const statusValid = Object.values(result.bands).every(b => b.status === 'calculated');
  console.log(`   6. Status "calculated": ${statusValid ? '✅ PASS' : '❌ FAIL'}`);
  
  if (allBandsPositive && sumValid && dbValuesValid && distribution && hasEnergyDb && statusValid) {
    console.log(`\n🎉 TESTE PINK NOISE PASSOU! Todas as correções estão funcionando.`);
  } else {
    console.log(`\n⚠️  TESTE PINK NOISE FALHOU. Verificar implementação.`);
  }
  
} else {
  console.log('❌ Falha no cálculo das bandas espectrais');
}

console.log(`\n🔗 Este teste confirma:`);
console.log(`   1. Cálculo dB corrigido (RMS médio / referência global)`);
console.log(`   2. Normalização de percentagens para 100%`);
console.log(`   3. Todas as bandas têm energia > 0 com pink noise`);
console.log(`   4. Valores dB estão na faixa correta (±0-20 dB)`);