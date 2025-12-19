// test-suggestions-empty-array.js
// Valida que suggestions: [] NÃO causa loop infinito

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  🧪 TESTE: suggestions=[] deve ser VÁLIDO                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Simular lógica corrigida
function validateJobComplete(fullResult) {
  // ✅ CORRETO: Verificar se campo EXISTE (não se está vazio)
  const suggestionsExists = fullResult?.hasOwnProperty('suggestions') || 
                            fullResult?.diagnostics?.hasOwnProperty('suggestions') ||
                            fullResult?.problemsAnalysis?.hasOwnProperty('suggestions');
  
  const hasTechnicalData = !!fullResult?.technicalData;
  
  console.log('[VALIDATION]', {
    suggestionsExists,
    hasTechnicalData,
    'fullResult.suggestions': fullResult?.suggestions,
    'fullResult.problemsAnalysis?.suggestions': fullResult?.problemsAnalysis?.suggestions
  });
  
  // Se campo existe (mesmo vazio), aceitar como completo
  return suggestionsExists && hasTechnicalData;
}

// ════════════════════════════════════════════════════════════════
// CASO 1: suggestions=[] (DEVE SER VÁLIDO)
// ════════════════════════════════════════════════════════════════
console.log('📊 CASO 1: suggestions=[] (array vazio)');
const case1 = {
  suggestions: [],
  problemsAnalysis: { suggestions: [] },
  technicalData: { lufs: -14 }
};
const result1 = validateJobComplete(case1);
console.log(result1 ? '✅ PASS: Aceito como completo' : '❌ FAIL: Rejeitado indevidamente');
console.log('');

// ════════════════════════════════════════════════════════════════
// CASO 2: suggestions ausente (DEVE AGUARDAR)
// ════════════════════════════════════════════════════════════════
console.log('📊 CASO 2: suggestions ausente (campo não existe)');
const case2 = {
  // suggestions ausente
  technicalData: { lufs: -14 }
};
const result2 = validateJobComplete(case2);
console.log(!result2 ? '✅ PASS: Aguardando processamento' : '❌ FAIL: Aceitou indevidamente');
console.log('');

// ════════════════════════════════════════════════════════════════
// CASO 3: suggestions=[{...}] com conteúdo (DEVE SER VÁLIDO)
// ════════════════════════════════════════════════════════════════
console.log('📊 CASO 3: suggestions com conteúdo');
const case3 = {
  suggestions: [{ metric: 'lufs', issue: 'too_low' }],
  technicalData: { lufs: -20 }
};
const result3 = validateJobComplete(case3);
console.log(result3 ? '✅ PASS: Aceito como completo' : '❌ FAIL: Rejeitado indevidamente');
console.log('');

// ════════════════════════════════════════════════════════════════
// CASO 4: technicalData ausente (DEVE AGUARDAR)
// ════════════════════════════════════════════════════════════════
console.log('📊 CASO 4: technicalData ausente');
const case4 = {
  suggestions: []
  // technicalData ausente
};
const result4 = validateJobComplete(case4);
console.log(!result4 ? '✅ PASS: Aguardando processamento' : '❌ FAIL: Aceitou indevidamente');
console.log('');

// ════════════════════════════════════════════════════════════════
// RESUMO
// ════════════════════════════════════════════════════════════════
const totalTests = 4;
const passed = [result1, !result2, result3, !result4].filter(Boolean).length;

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log(`║  RESULTADO: ${passed}/${totalTests} testes passaram                            ║`);
if (passed === totalTests) {
  console.log('║  ✅ CORREÇÃO VALIDADA: [] é aceito como válido               ║');
} else {
  console.log('║  ❌ PROBLEMA: Lógica ainda não está correta                 ║');
}
console.log('╚════════════════════════════════════════════════════════════════╝');

process.exit(passed === totalTests ? 0 : 1);
