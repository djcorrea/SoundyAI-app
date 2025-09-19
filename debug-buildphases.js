/**
 * 🔍 Debug da função buildPhases para encontrar o problema
 */

import { TruePeakDetector } from './work/lib/audio/features/truepeak.js';

console.log('🔍 Debugando buildPhases...\n');

// Criar detector para testar
const detector = new TruePeakDetector();

// Examinar coeficientes originais
console.log('📊 Coeficientes originais:');
console.log(`   Comprimento: ${detector.coeffs.TAPS.length}`);
console.log(`   Primeiros 10: [${detector.coeffs.TAPS.slice(0, 10).map(x => x.toFixed(6)).join(', ')}]`);
console.log(`   Soma total: ${detector.coeffs.TAPS.reduce((a, b) => a + b, 0).toFixed(6)}`);

console.log('\n🔧 Fases pré-computadas:');
for (let p = 0; p < detector.phases.length; p++) {
  const phase = detector.phases[p];
  const sum = phase.reduce((a, b) => a + b, 0);
  console.log(`   Fase ${p}: ${phase.length} coeficientes, soma = ${sum.toFixed(6)}`);
  console.log(`           Primeiros 5: [${phase.slice(0, 5).map(x => x.toFixed(6)).join(', ')}]`);
}

console.log('\n📈 Teste com impulso unitário:');

// Testar com impulso unitário para verificar resposta
const impulse = new Float32Array(100);
impulse[50] = 1.0; // Impulso no meio

detector.delayLine.fill(0);
detector.delayIndex = 0;
detector.maxTruePeak = 0;

// Processar impulso
for (let i = 0; i < impulse.length; i++) {
  const upsampled = detector.upsamplePolyphase(impulse[i]);
  
  if (i === 50) { // No impulso
    console.log(`   Input = ${impulse[i]}, Output = [${upsampled.map(x => x.toFixed(6)).join(', ')}]`);
    console.log(`   Max upsampled = ${Math.max(...upsampled.map(Math.abs)).toFixed(6)}`);
  }
  
  for (let j = 0; j < upsampled.length; j++) {
    const abs = Math.abs(upsampled[j]);
    if (abs > detector.maxTruePeak) {
      detector.maxTruePeak = abs;
    }
  }
}

console.log(`   True Peak encontrado: ${detector.maxTruePeak.toFixed(6)}`);
console.log(`   Deve ser ≈ 1.0 para impulso unitário`);

// Verificar se problema é ganho incorreto
const expectedGain = 1.0;
const actualGain = detector.maxTruePeak;
const gainError = actualGain / expectedGain;

console.log(`\n🎯 Análise de ganho:`);
console.log(`   Ganho esperado: ${expectedGain.toFixed(6)}`);
console.log(`   Ganho atual:    ${actualGain.toFixed(6)}`);
console.log(`   Razão:          ${gainError.toFixed(6)}`);

if (Math.abs(gainError - 1.0) > 0.1) {
  console.log(`❌ PROBLEMA: Ganho incorreto! Fator de correção = ${(1/gainError).toFixed(6)}`);
} else {
  console.log(`✅ Ganho OK`);
}