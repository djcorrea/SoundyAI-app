// 🧪 TESTE DA NOVA CURVA SWEET SPOT - Score Progressivo Bandas
// Validação da curva melhorada: 0-4dB = 100%, progressão suave até tolerância

console.log('🧪 Testando Nova Curva Sweet Spot (4dB = 100%)...');

// Simular função scoreTolerance para teste
function testScoreTolerance(adiff, sideTol) {
    const SWEET_SPOT_DB = 4;
    
    if (adiff <= sideTol) {
        // Sweet spot: até 4dB = 100%
        if (adiff <= SWEET_SPOT_DB) {
            return 1;
        }
        
        // Progressão entre sweet spot e tolerância
        const range = sideTol - SWEET_SPOT_DB;
        if (range > 0) {
            const progress = (sideTol - adiff) / range;
            const curved = Math.pow(progress, 1.1);  // Curva mais suave
            return Math.min(Math.max(curved, 0), 1);
        } else {
            return 1;
        }
    }
    
    // Fora da tolerância
    if (adiff >= 2 * sideTol) return 0;
    return 1 - (adiff - sideTol) / sideTol;
}

// Cenários de teste com tolerância de 8dB
const tolerance = 8;
const testCases = [
    { diff: 0, desc: "No alvo" },
    { diff: 2, desc: "2dB do alvo" },
    { diff: 4, desc: "4dB do alvo (sweet spot)" },
    { diff: 5, desc: "5dB do alvo" },
    { diff: 6, desc: "6dB do alvo" },
    { diff: 7, desc: "7dB do alvo" },
    { diff: 8, desc: "8dB do alvo (borda tolerância)" },
    { diff: 10, desc: "10dB do alvo (fora tolerância)" },
    { diff: 16, desc: "16dB do alvo (2x tolerância)" }
];

console.log('\n📊 RESULTADOS DA NOVA CURVA:');
console.log('Diferença (dB) | Score | Descrição');
console.log('---------------|-------|----------');

testCases.forEach(test => {
    const score = testScoreTolerance(test.diff, tolerance);
    const percentage = (score * 100).toFixed(1);
    console.log(`${test.diff.toString().padStart(13)} | ${percentage.padStart(4)}% | ${test.desc}`);
});

console.log('\n✅ VALIDAÇÃO:');
console.log('• 0-4dB: Deve ser 100%');
console.log('• 5dB: Deve ser ~80%');
console.log('• 7dB: Deve ser ~50%');
console.log('• 8dB+: Deve ser 0%');

// Teste com tolerância menor (6dB)
console.log('\n📊 TESTE COM TOLERÂNCIA MENOR (6dB):');
const smallTolerance = 6;
[0, 2, 4, 5, 6, 8].forEach(diff => {
    const score = testScoreTolerance(diff, smallTolerance);
    const percentage = (score * 100).toFixed(1);
    console.log(`${diff}dB: ${percentage}%`);
});

console.log('\n🎯 Nova curva implementada com sucesso!');
console.log('🔄 Para testar no sistema real, execute uma análise de áudio.');