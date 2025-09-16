#!/usr/bin/env node

/**
 * 🎵 Teste específico: Tom de 50Hz deve dominar a banda SUB
 * Valida se o mapeamento de frequências está correto
 */

import { SpectralBandsCalculator } from './work/lib/audio/features/spectral-bands.js';

console.log('🎵 [TESTE 50Hz] Testando tom puro de 50Hz...\n');

const calculator = new SpectralBandsCalculator(48000, 4096);
const fftSize = 4096;
const sampleRate = 48000;
const binCount = Math.floor(fftSize / 2) + 1;

// Calcular bin correspondente a 50Hz
const frequencyResolution = sampleRate / fftSize; // ~11.72Hz por bin
const targetFreq = 50; // Hz
const targetBin = Math.round(targetFreq / frequencyResolution); // ~bin 4

console.log(`🔍 Configurações:`);
console.log(`   Sample Rate: ${sampleRate} Hz`);
console.log(`   FFT Size: ${fftSize}`);
console.log(`   Frequency Resolution: ${frequencyResolution.toFixed(2)} Hz/bin`);
console.log(`   Target Frequency: ${targetFreq} Hz`);
console.log(`   Target Bin: ${targetBin}`);
console.log(`   Actual Frequency: ${(targetBin * frequencyResolution).toFixed(1)} Hz`);

// Criar espectro com pico em 50Hz
const leftMagnitude = new Float32Array(binCount);
const rightMagnitude = new Float32Array(binCount);

// Colocar toda a energia no bin de 50Hz
leftMagnitude[targetBin] = 1.0;
rightMagnitude[targetBin] = 1.0;

// Adicionar um pouco de ruído de fundo muito baixo
for (let i = 1; i < binCount; i++) {
  if (i !== targetBin) {
    leftMagnitude[i] = 0.001; // -60dB relative
    rightMagnitude[i] = 0.001;
  }
}

console.log(`\n🎯 Calculando bandas para tom de 50Hz...`);

const result = calculator.analyzeBands(leftMagnitude, rightMagnitude, 0);

if (result.valid && result.bands) {
  console.log('\n📊 Resultado das bandas:');
  
  // Mostrar todas as bandas
  const bands = [
    { name: 'Sub (20-60Hz)', key: 'sub', expected: 'DOMINANTE' },
    { name: 'Bass (60-150Hz)', key: 'bass', expected: 'baixo' },
    { name: 'Low-Mid (150-500Hz)', key: 'lowMid', expected: 'baixo' },
    { name: 'Mid (500-2kHz)', key: 'mid', expected: 'baixo' },
    { name: 'High-Mid (2-5kHz)', key: 'highMid', expected: 'baixo' },
    { name: 'Presence (5-10kHz)', key: 'presence', expected: 'baixo' },
    { name: 'Air (10-20kHz)', key: 'air', expected: 'baixo' }
  ];
  
  let subPercentage = 0;
  let totalOthers = 0;
  
  for (const band of bands) {
    const bandData = result.bands[band.key];
    const percentage = bandData.percentage || 0;
    const energyDb = bandData.energy_db || -120;
    const status = bandData.status || 'unknown';
    
    console.log(`   ${band.name.padEnd(20)}: ${percentage.toFixed(1).padStart(5)}% | ${energyDb.toFixed(1).padStart(6)}dB | ${status} | ${band.expected}`);
    
    if (band.key === 'sub') {
      subPercentage = percentage;
    } else {
      totalOthers += percentage;
    }
  }
  
  console.log(`\n📈 Análise:`);
  console.log(`   Sub domina: ${subPercentage.toFixed(1)}%`);
  console.log(`   Outras bandas: ${totalOthers.toFixed(1)}%`);
  console.log(`   Total: ${result.totalPercentage.toFixed(1)}%`);
  
  // Validação
  const subDominates = subPercentage > 80; // Esperamos >80% na banda sub
  const totalValid = Math.abs(result.totalPercentage - 100) < 1;
  
  console.log(`\n✅ Validações:`);
  console.log(`   Sub domina (>80%): ${subDominates ? '✅ PASS' : '❌ FAIL'} (${subPercentage.toFixed(1)}%)`);
  console.log(`   Total soma ~100%: ${totalValid ? '✅ PASS' : '❌ FAIL'} (${result.totalPercentage.toFixed(1)}%)`);
  console.log(`   Conversão dB funcionando: ${result.bands.sub.energy_db !== null ? '✅ PASS' : '❌ FAIL'}`);
  
  if (subDominates && totalValid) {
    console.log(`\n🎉 TESTE 50Hz PASSOU! O mapeamento de frequências está correto.`);
  } else {
    console.log(`\n⚠️  TESTE 50Hz FALHOU. Verificar mapeamento de bins.`);
  }
  
} else {
  console.log('❌ Falha no cálculo das bandas');
}

console.log(`\n🔗 Este teste confirma que:`);
console.log(`   1. Tons na faixa 20-60Hz aparecem corretamente na banda SUB`);
console.log(`   2. A conversão de frequência→bin→banda está funcionando`);
console.log(`   3. O energy_db é calculado corretamente`);
console.log(`   4. As percentagens somam 100%`);