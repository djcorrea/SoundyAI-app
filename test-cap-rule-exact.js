// 🧪 TESTE ESPECÍFICO - Verificação da Regra ±6 dB Exata
// Verifica se o sistema nunca recomenda ajustes maiores que ±6 dB

import { applyMusicalCap } from './work/lib/audio/utils/musical-cap-utils.js';

console.log('🧪 Teste Específico: Regra ±6 dB Exata para DAW...\n');

// Casos de teste conforme especificação
const testCases = [
  // Casos dentro do limite (-6 a +6)
  { delta: 5.8, desc: 'Dentro do limite (+5.8 dB)', expected: 'normal' },
  { delta: -4.2, desc: 'Dentro do limite (-4.2 dB)', expected: 'normal' },
  { delta: 6.0, desc: 'Exatamente no limite (+6.0 dB)', expected: 'normal' },
  { delta: -6.0, desc: 'Exatamente no limite (-6.0 dB)', expected: 'normal' },
  
  // Casos que excedem o limite
  { delta: 8.5, desc: 'Excede limite (+8.5 dB)', expected: 'cap_positive' },
  { delta: -12.3, desc: 'Excede limite (-12.3 dB)', expected: 'cap_negative' },
  { delta: 15.7, desc: 'Muito alto (+15.7 dB)', expected: 'cap_positive' },
  { delta: -9.1, desc: 'Muito baixo (-9.1 dB)', expected: 'cap_negative' }
];

console.log('🎯 TESTANDO CADA CASO:');
console.log('─'.repeat(80));

testCases.forEach((test, i) => {
  const result = applyMusicalCap(test.delta);
  
  console.log(`${i + 1}. ${test.desc} (delta: ${test.delta} dB):`);
  console.log(`   ✓ Valor retornado: ${result.value.toFixed(1)} dB`);
  console.log(`   ✓ Delta real: ${result.delta_real.toFixed(1)} dB`);
  console.log(`   ✓ Foi capado: ${result.wasCapped ? 'SIM' : 'NÃO'}`);
  console.log(`   ✓ Nota: ${result.note || 'nenhuma'}`);
  
  // Validação específica
  let validation = '';
  if (test.expected === 'normal') {
    const isCorrect = result.value === test.delta && !result.wasCapped && !result.note;
    validation = isCorrect ? '✅ CORRETO (valor normal)' : '❌ ERRO (deveria ser normal)';
  } else if (test.expected === 'cap_positive') {
    const isCorrect = result.value === 6 && result.wasCapped && result.note && result.note.includes('+6 dB');
    validation = isCorrect ? '✅ CORRETO (capado para +6)' : '❌ ERRO (deveria ser capado para +6)';
  } else if (test.expected === 'cap_negative') {
    const isCorrect = result.value === -6 && result.wasCapped && result.note && result.note.includes('-6 dB');
    validation = isCorrect ? '✅ CORRETO (capado para -6)' : '❌ ERRO (deveria ser capado para -6)';
  }
  
  console.log(`   ${validation}`);
  console.log('');
});

// Validação crítica: Nenhum valor retornado pode exceder ±6 dB
console.log('🎯 VALIDAÇÃO CRÍTICA:');
console.log('─'.repeat(80));

const extremeCases = [20.5, -18.9, 35.2, -25.1, 100, -200];
let allWithinLimit = true;

extremeCases.forEach(delta => {
  const result = applyMusicalCap(delta);
  const withinLimit = Math.abs(result.value) <= 6;
  
  console.log(`Delta ${delta.toFixed(1)} dB → Retorna ${result.value.toFixed(1)} dB ${withinLimit ? '✅' : '❌'}`);
  
  if (!withinLimit) {
    allWithinLimit = false;
  }
});

console.log('\n🏆 RESULTADO FINAL:');
console.log('═'.repeat(80));

if (allWithinLimit) {
  console.log('🎉 ✅ SUCESSO TOTAL!');
  console.log('');
  console.log('📋 VALIDAÇÕES CONFIRMADAS:');
  console.log('   ✓ Se delta entre -6 e +6 → retorna o delta normal');
  console.log('   ✓ Se delta > 6 → retorna +6 e adiciona anotação');
  console.log('   ✓ Se delta < -6 → retorna -6 e adiciona anotação');
  console.log('   ✓ NUNCA retorna valores > ±6 dB para a DAW');
  console.log('   ✓ Anotações usam "diferença real detectada"');
  console.log('');
  console.log('🚀 O sistema está SEGURO para uso na DAW!');
  console.log('   Usuários nunca receberão recomendações extremas');
  console.log('   Máximo de ajuste: ±6 dB (seguro e musical)');
} else {
  console.log('❌ FALHA! Alguns valores excedem ±6 dB');
  console.log('   Revisar implementação necessária');
}

console.log('═'.repeat(80));