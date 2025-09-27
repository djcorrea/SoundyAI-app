// 🧪 TESTE DEBUG - Verificar se applyMusicalCap está funcionando

import { applyMusicalCap } from './work/lib/audio/utils/musical-cap-utils.js';

console.log('🧪 Teste direto da função applyMusicalCap...\n');

// Teste 1: Valor que deve ser limitado (+34 dB)
const deltaTest = 34.0;
console.log('Input:', deltaTest);
const result = applyMusicalCap(deltaTest);
console.log('Result:', result);
console.log('Fields disponíveis:', Object.keys(result));
console.log('deltaShown:', result.deltaShown);
console.log('wasCapped:', result.wasCapped);
console.log('');

// Teste simular o que acontece no analyzeBand
console.log('🧪 Simulação do código analyzeBand...');
const value = 15.0;
const target = -19.0; 
const deltaRaw = value - target;
const cappedDelta = applyMusicalCap(deltaRaw);

console.log('value:', value);
console.log('target:', target);
console.log('deltaRaw:', deltaRaw);
console.log('cappedDelta:', cappedDelta);
console.log('cappedDelta.deltaShown:', cappedDelta.deltaShown);
console.log('cappedDelta.wasCapped:', cappedDelta.wasCapped);

console.log('\n🎯 Teste de objeto suggestion simulado:');
const suggestionSimulado = {
  delta: cappedDelta.deltaShown,
  delta_raw: deltaRaw,
  delta_capped: cappedDelta.wasCapped
};

console.log('Suggestion simulado:', suggestionSimulado);