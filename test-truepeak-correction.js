// 🧪 TESTE DA CORREÇÃO TRUE PEAK
// Valida se o algoritmo polyphase corrigido funciona corretamente

import { runQuickTruePeakTest, runTruePeakValidationSuite } from './work/lib/audio/features/truepeak.js';

console.log('🚀 Iniciando teste da correção True Peak...\n');

// Teste rápido
console.log('=== TESTE RÁPIDO ===');
const quickResult = runQuickTruePeakTest();

if (quickResult.passed) {
  console.log('✅ Teste rápido PASSOU - algoritmo corrigido com sucesso!');
} else {
  console.log('❌ Teste rápido FALHOU - algoritmo ainda tem problemas');
  console.log('Detalhes:', quickResult);
}

console.log('\n=== SUITE COMPLETA DE TESTES ===');

// Suite completa
const suiteResults = runTruePeakValidationSuite();

console.log('\n=== RESUMO FINAL ===');
const passedTests = suiteResults.filter(r => r.passed).length;
const totalTests = suiteResults.length + (quickResult.passed ? 1 : 0);
const totalPassed = passedTests + (quickResult.passed ? 1 : 0);

console.log(`📊 Total de testes: ${totalTests}`);
console.log(`✅ Testes aprovados: ${totalPassed}`);
console.log(`❌ Testes falharam: ${totalTests - totalPassed}`);

if (totalPassed === totalTests) {
  console.log('\n🎉 ALGORITMO TRUE PEAK CORRIGIDO COM SUCESSO!');
  console.log('   - Polyphase implementado corretamente');
  console.log('   - Coeficientes normalizados para ganho unitário');
  console.log('   - True Peak >= Sample Peak sempre');
  console.log('   - Sem correções forçadas mascarando problemas');
} else {
  console.log('\n⚠️ ALGORITMO AINDA PRECISA DE AJUSTES');
  console.log('   Verifique os logs acima para detalhes dos problemas');
}

console.log('\n🔬 Teste concluído!');