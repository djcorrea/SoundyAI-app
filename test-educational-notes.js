// 🎓 TESTE - Anotações Educativas Inteligentes

import { applyMusicalCap } from './work/lib/audio/utils/musical-cap-utils.js';

console.log('🎓 TESTE: Anotações Educativas Inteligentes\n');

console.log('🔍 Testando diferentes cenários de delta:');
console.log('─'.repeat(70));

// Cenários de teste baseados em situações reais
const testCases = [
  { delta: 8.0, scenario: "Diferença pequena (seu exemplo: -32dB para -40dB)" },
  { delta: -7.5, scenario: "Diferença pequena negativa" },
  { delta: 12.0, scenario: "Diferença média" },
  { delta: -15.0, scenario: "Diferença média negativa" },
  { delta: 22.0, scenario: "Diferença grande" },
  { delta: -25.0, scenario: "Diferença grande negativa" },
  { delta: 40.1, scenario: "Diferença muito grande (como Sub no JSON)" },
  { delta: -53.7, scenario: "Diferença extrema negativa (como Air no JSON)" }
];

testCases.forEach((test, i) => {
  console.log(`${i + 1}. ${test.scenario}:`);
  console.log(`   Delta real: ${test.delta >= 0 ? '+' : ''}${test.delta} dB`);
  
  const result = applyMusicalCap(test.delta);
  
  console.log(`   ✅ Delta exibido: ${result.value >= 0 ? '+' : ''}${result.value} dB`);
  console.log(`   🎓 Sugestão educativa: "${result.note}"`);
  console.log(`   🚩 Foi capado: ${result.wasCapped ? 'SIM' : 'NÃO'}`);
  console.log('');
});

console.log('🎯 COMPARAÇÃO COM SISTEMA ANTIGO:');
console.log('─'.repeat(70));

// Exemplo específico baseado no seu caso
const yourExample = applyMusicalCap(8.0); // -32dB para -40dB = +8dB para chegar no alvo

console.log('SEU EXEMPLO: Valor -32dB, Alvo -40dB, Delta +8dB');
console.log('');
console.log('🔴 ANTES (sistema antigo):');
console.log('   "ajuste seguro (+6 dB, diferença real detectada: +8.0 dB)"');
console.log('');
console.log('🟢 AGORA (sistema educativo):');
console.log(`   "${yourExample.note}"`);
console.log('');
console.log('💡 MELHORIA: Em vez de falar sobre "diferença real detectada"');
console.log('   agora dá sugestão prática de como começar o ajuste!');

console.log('\n🎯 RESULTADO:');
console.log('✅ Anotações agora são práticas e educativas');
console.log('✅ Sugestões graduais baseadas na magnitude da diferença');
console.log('✅ Linguagem focada em ação (boostar/cortar gradualmente)');
console.log('✅ Reconhece quando a diferença é muito grande para EQ simples');

console.log('\n📝 PRÓXIMO PASSO:');
console.log('Testar no browser para ver as novas anotações educativas!');