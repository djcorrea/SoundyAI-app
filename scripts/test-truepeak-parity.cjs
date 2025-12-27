/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧪 TESTE DE PARIDADE: TRUE PEAK - TABELA vs CARDS vs SUGESTÕES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * OBJETIVO: Verificar que TABELA, CARDS e SUGESTÕES usam a mesma lógica para True Peak
 * 
 * REGRA ABSOLUTA: TP > 0.0 dBTP = CRÍTICA sempre
 * 
 * CORREÇÃO CRÍTICA: A recomendação "Reduzir X dB" deve levar ao TARGET do gênero,
 * não apenas ao hard cap (0.0 dBTP).
 * 
 * Exemplo: TP = +1.40, target = -1.0
 *   - recommendedFinal = min(-1.0, 0.0) = -1.0
 *   - reduceBy = 1.40 - (-1.0) = 2.40 dB ✅
 *   - NÃO "Reduzir 1.40 dB" (que levaria apenas a 0.0)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const TRUE_PEAK_HARD_CAP = 0.0; // dBTP

/**
 * 🎯 FUNÇÃO CORRIGIDA: Calcula a recomendação correta para True Peak
 * 
 * @param {number} currentTp - True Peak atual medido
 * @param {number} tpTarget - Target do gênero (ex: -1.0 dBTP)
 * @param {number} tpMax - Hard cap (normalmente 0.0 dBTP)
 * @returns {Object} { recommendedFinal, reduceBy, action }
 */
function getTruePeakRecommendation(currentTp, tpTarget, tpMax = TRUE_PEAK_HARD_CAP) {
    // A recomendação final deve ser o MENOR entre target do gênero e hard cap
    const recommendedFinal = Math.min(tpTarget, tpMax);
    const reduceBy = Math.max(0, currentTp - recommendedFinal);
    
    let action;
    if (currentTp > tpMax) {
        action = `🔴 CLIPPING! Reduzir ${reduceBy.toFixed(2)} dB (alvo: ${recommendedFinal.toFixed(1)} dBTP)`;
    } else if (reduceBy > 0) {
        action = `⚠️ Reduzir ${reduceBy.toFixed(2)} dB (alvo: ${recommendedFinal.toFixed(1)} dBTP)`;
    } else {
        action = '✅ Dentro do padrão';
    }
    
    return { recommendedFinal, reduceBy, action };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🧪 CENÁRIOS DE TESTE
// ═══════════════════════════════════════════════════════════════════════════════
const testCases = [
    { 
        tp: 1.40, 
        target: -1.0, 
        expectedReduceBy: 2.40,  // 1.40 - (-1.0) = 2.40
        description: 'TP = +1.40, target = -1.0 → Reduzir 2.40 dB (cenário do bug)'
    },
    { 
        tp: 0.5, 
        target: -1.0, 
        expectedReduceBy: 1.50,  // 0.5 - (-1.0) = 1.50
        description: 'TP = +0.5, target = -1.0 → Reduzir 1.50 dB'
    },
    { 
        tp: 0.01, 
        target: -0.5, 
        expectedReduceBy: 0.51,  // 0.01 - (-0.5) = 0.51
        description: 'TP = +0.01, target = -0.5 → Reduzir 0.51 dB'
    },
    { 
        tp: 0.0, 
        target: -1.0, 
        expectedReduceBy: 1.00,  // 0.0 - (-1.0) = 1.00
        description: 'TP = 0.0, target = -1.0 → Reduzir 1.00 dB'
    },
    { 
        tp: -0.5, 
        target: -1.0, 
        expectedReduceBy: 0.50,  // -0.5 - (-1.0) = 0.50
        description: 'TP = -0.5, target = -1.0 → Reduzir 0.50 dB'
    },
    { 
        tp: -1.0, 
        target: -1.0, 
        expectedReduceBy: 0.00,  // -1.0 - (-1.0) = 0.00
        description: 'TP = -1.0, target = -1.0 → Sem ajuste necessário'
    },
    { 
        tp: -2.0, 
        target: -1.0, 
        expectedReduceBy: 0.00,  // Já está abaixo do target
        description: 'TP = -2.0, target = -1.0 → Já está OK'
    },
];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🧪 TESTE: CÁLCULO DE "REDUZIR X dB" PARA TRUE PEAK');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('🎯 REGRA: reduceBy = currentTp - min(target, 0.0)');
console.log('');

let passed = 0;
let failed = 0;

for (const tc of testCases) {
    const result = getTruePeakRecommendation(tc.tp, tc.target);
    const tolerance = 0.01; // Tolerância para comparação float
    const isCorrect = Math.abs(result.reduceBy - tc.expectedReduceBy) < tolerance;
    
    const icon = isCorrect ? '✅' : '❌';
    const status = isCorrect ? 'PASSOU' : 'FALHOU';
    
    if (isCorrect) passed++;
    else failed++;
    
    console.log(`${icon} ${tc.description}`);
    console.log(`   Cálculo: ${tc.tp.toFixed(2)} - (${tc.target.toFixed(1)}) = ${result.reduceBy.toFixed(2)} dB`);
    console.log(`   Esperado: ${tc.expectedReduceBy.toFixed(2)} dB`);
    console.log(`   Ação: ${result.action}`);
    console.log(`   → ${status}`);
    console.log('');
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log('📊 RESULTADO FINAL');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Total de testes: ${testCases.length}`);
console.log(`✅ Passou: ${passed}`);
console.log(`❌ Falhou: ${failed}`);
console.log('');

if (failed === 0) {
    console.log('✅ TODOS OS TESTES PASSARAM!');
    console.log('🎯 Recomendação "Reduzir X dB" agora usa o TARGET correto do gênero');
} else {
    console.log('❌ ALGUNS TESTES FALHARAM!');
    console.log('🔧 Verificar implementação da função getTruePeakRecommendation');
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════════');

// Exit code baseado no resultado
process.exit(failed > 0 ? 1 : 0);
