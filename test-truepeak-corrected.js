/**
 * 🧪 Teste para validar algoritmo corrigido de True Peak
 */

import fs from 'fs';
import path from 'path';

// Importar função corrigida
import { analyzeTruePeaks } from './work/lib/audio/features/truepeak.js';

console.log('🧪 Testando algoritmo corrigido de True Peak...\n');

// Teste 1: Sinal senoidal limpo (deve ter True Peak >= Sample Peak)
console.log('📈 Teste 1: Sinal senoidal 1kHz');
const sampleRate = 48000;
const duration = 0.1; // 100ms
const frequency = 1000; // 1kHz
const amplitude = 0.5; // -6 dBFS

const length = Math.floor(sampleRate * duration);
const leftChannel = new Float32Array(length);
const rightChannel = new Float32Array(length);

for (let i = 0; i < length; i++) {
  const t = i / sampleRate;
  const sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
  leftChannel[i] = sample;
  rightChannel[i] = sample;
}

try {
  const result = analyzeTruePeaks(leftChannel, rightChannel);
  
  console.log('✅ Resultado:');
  console.log(`   Sample Peak: ${result.samplePeakDb.toFixed(2)} dBFS`);
  console.log(`   True Peak:   ${result.truePeakDbtp.toFixed(2)} dBTP`);
  console.log(`   Diferença:   ${(result.truePeakDbtp - result.samplePeakDb).toFixed(2)} dB`);
  
  if (result.truePeakDbtp >= result.samplePeakDb) {
    console.log('✅ PASS: True Peak >= Sample Peak (como esperado)');
  } else {
    console.log('❌ FAIL: True Peak < Sample Peak (problema no algoritmo)');
  }
  
  // Verificar valores esperados
  const expectedSamplePeak = 20 * Math.log10(amplitude); // ~-6 dBFS
  const samplePeakError = Math.abs(result.samplePeakDb - expectedSamplePeak);
  
  console.log(`   Sample Peak esperado: ${expectedSamplePeak.toFixed(2)} dBFS`);
  console.log(`   Erro Sample Peak: ${samplePeakError.toFixed(3)} dB`);
  
  if (samplePeakError < 0.1) {
    console.log('✅ PASS: Sample Peak correto (±0.1 dB)');
  } else {
    console.log('❌ FAIL: Sample Peak incorreto');
  }

} catch (error) {
  console.error('❌ ERRO no teste:', error.message);
  console.error(error.stack);
}

console.log('\n' + '='.repeat(50));

// Teste 2: Silêncio digital
console.log('🔇 Teste 2: Silêncio digital');
const silenceLeft = new Float32Array(1000);
const silenceRight = new Float32Array(1000);

try {
  const result = analyzeTruePeaks(silenceLeft, silenceRight);
  
  console.log('✅ Resultado:');
  console.log(`   Sample Peak: ${result.samplePeakDb} dBFS`);
  console.log(`   True Peak:   ${result.truePeakDbtp} dBTP`);
  
  if (result.samplePeakDb === -Infinity && result.truePeakDbtp === -Infinity) {
    console.log('✅ PASS: Silêncio detectado corretamente');
  } else {
    console.log('❌ FAIL: Silêncio não detectado corretamente');
  }

} catch (error) {
  console.error('❌ ERRO no teste:', error.message);
}

console.log('\n' + '='.repeat(50));

// Teste 3: Clipping digital (full scale)
console.log('🔴 Teste 3: Clipping digital (full scale)');
const clippedLeft = new Float32Array(1000);
const clippedRight = new Float32Array(1000);

clippedLeft.fill(1.0); // Full scale positive
clippedRight.fill(-1.0); // Full scale negative

try {
  const result = analyzeTruePeaks(clippedLeft, clippedRight);
  
  console.log('✅ Resultado:');
  console.log(`   Sample Peak: ${result.samplePeakDb.toFixed(2)} dBFS`);
  console.log(`   True Peak:   ${result.truePeakDbtp.toFixed(2)} dBTP`);
  console.log(`   Clipping amostras: ${result.clippingSamples}`);
  
  if (Math.abs(result.samplePeakDb - 0.0) < 0.01) {
    console.log('✅ PASS: Sample Peak = 0 dBFS (full scale)');
  } else {
    console.log('❌ FAIL: Sample Peak incorreto para full scale');
  }
  
  if (result.truePeakDbtp >= result.samplePeakDb) {
    console.log('✅ PASS: True Peak >= Sample Peak mantido');
  } else {
    console.log('❌ FAIL: True Peak < Sample Peak');
  }

} catch (error) {
  console.error('❌ ERRO no teste:', error.message);
}

console.log('\n🏁 Testes concluídos!');