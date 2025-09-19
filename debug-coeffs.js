/**
 * 🔬 Análise profunda dos coeficientes FIR e resposta ao impulso
 */

import { TruePeakDetector } from './work/lib/audio/features/truepeak.js';

console.log('🔬 Análise profunda dos coeficientes...\n');

// Criar detector
const detector = new TruePeakDetector();

console.log('📊 Coeficientes FIR originais:');
const taps = detector.coeffs.TAPS;
console.log(`   Comprimento: ${taps.length}`);
console.log(`   Soma total: ${taps.reduce((a, b) => a + b, 0).toFixed(6)}`);

// Encontrar o coeficiente máximo (deve ser próximo ao centro)
let maxCoeff = 0;
let maxIndex = 0;
for (let i = 0; i < taps.length; i++) {
  if (Math.abs(taps[i]) > Math.abs(maxCoeff)) {
    maxCoeff = taps[i];
    maxIndex = i;
  }
}

console.log(`   Coeficiente máximo: ${maxCoeff.toFixed(6)} em índice ${maxIndex}`);
console.log(`   Centro teórico: índice ${Math.floor(taps.length / 2)}`);

// Mostrar coeficientes ao redor do pico
const start = Math.max(0, maxIndex - 5);
const end = Math.min(taps.length, maxIndex + 6);
console.log(`   Coeficientes centrais [${start}:${end}]:`);
for (let i = start; i < end; i++) {
  console.log(`     [${i}]: ${taps[i].toFixed(6)}`);
}

console.log('\n🧪 Teste com impulso no delay line:');

// Limpar detector
detector.delayLine.fill(0);
detector.delayIndex = 0;
detector.maxTruePeak = 0;

// Alimentar com zeros até o impulso ficar na posição central
const feedZeros = Math.floor(taps.length / 2);
for (let i = 0; i < feedZeros; i++) {
  detector.upsamplePolyphase(0);
}

// Agora aplicar impulso unitário
console.log(`   Aplicando impulso após ${feedZeros} zeros...`);
const upsampled = detector.upsamplePolyphase(1.0);
console.log(`   Upsampled: [${upsampled.map(x => x.toFixed(6)).join(', ')}]`);
console.log(`   Max: ${Math.max(...upsampled.map(Math.abs)).toFixed(6)}`);

// Continuar alimentando com zeros para ver toda a resposta
console.log('   Alimentando mais zeros para ver resposta completa...');
let maxResponse = Math.max(...upsampled.map(Math.abs));
for (let i = 0; i < taps.length; i++) {
  const response = detector.upsamplePolyphase(0);
  const maxInResponse = Math.max(...response.map(Math.abs));
  if (maxInResponse > maxResponse) {
    maxResponse = maxInResponse;
    console.log(`     Novo máximo: ${maxResponse.toFixed(6)} em posição ${i + feedZeros + 1}`);
  }
}

console.log(`\n🎯 Resposta ao impulso completa: ${maxResponse.toFixed(6)}`);

// Verificar se os coeficientes têm a estrutura correta para polyphase
console.log('\n🔍 Verificação da estrutura polyphase:');
console.log('   Esperado: coeficientes organizados para interpolação 4×');
console.log('   Verificando ganho DC por fase...');

for (let p = 0; p < 4; p++) {
  let phaseSum = 0;
  for (let i = p; i < taps.length; i += 4) {
    phaseSum += taps[i];
  }
  console.log(`   Fase ${p}: soma = ${phaseSum.toFixed(6)}`);
}

// O problema pode ser que os coeficientes não são para interpolação 4×,
// mas sim para decimação ou filtro normal
console.log('\n💡 Possível solução: coeficientes podem estar incorretos para interpolação');
console.log('   Para interpolação 4×, esperamos ganho próximo a 4× no filtro polyphase');
console.log(`   Ganho atual máximo: ${maxResponse.toFixed(6)}`);
console.log(`   Possível fator de correção: ${(4.0 / maxResponse).toFixed(6)}`);