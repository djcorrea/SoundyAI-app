// 🎯 VALIDAÇÃO ESPECÍFICA - Cenário do Usuário
// Target: -23, Tolerance: 2.5, Valor inicial: -40 (17 dB fora)

console.group('🎯 VALIDAÇÃO CENÁRIO ESPECÍFICO DO USUÁRIO');

// Parâmetros do teste
const target = -23;
const tolerance = 2.5;
const initialValue = -40;
const options = { yellowMin: 70, bufferFactor: 1.5, severity: tolerance * 2 };

console.log(`📊 CENÁRIO: Target ${target} dB, Tolerance ±${tolerance} dB`);
console.log(`🎯 VALOR INICIAL: ${initialValue} dB (${Math.abs(initialValue - target)} dB de distância)`);

if (typeof window.calculateMetricScore === 'function') {
    
    // Teste do valor inicial
    const initialScore = window.calculateMetricScore(initialValue, target, tolerance, options);
    console.log(`\n🔴 Score inicial (${initialValue} dB): ${initialScore}/100`);
    
    // Simular ajustes graduais de +2 dB
    console.log('\n📈 PROGRESSO COM AJUSTES DE +2 dB:');
    
    const adjustments = [0, 2, 4, 6, 8, 10, 12, 14, 16];
    const progressData = [];
    
    adjustments.forEach(adjustment => {
        const currentValue = initialValue + adjustment;
        const score = window.calculateMetricScore(currentValue, target, tolerance, options);
        const distance = Math.abs(currentValue - target);
        
        progressData.push({
            adjustment: adjustment,
            value: currentValue,
            score: score,
            distance: distance
        });
        
        console.log(`   +${adjustment} dB → ${currentValue} dB → Score ${score}/100 (distância: ${distance.toFixed(1)} dB)`);
    });
    
    // Validar se há progresso contínuo
    let progressCount = 0;
    for (let i = 1; i < progressData.length; i++) {
        if (progressData[i].score > progressData[i-1].score) {
            progressCount++;
        }
    }
    
    const hasConsistentProgress = progressCount >= (progressData.length - 2); // Permite 1 plateau
    console.log(`\n✅ Progresso consistente: ${hasConsistentProgress ? 'SIM' : 'NÃO'} (${progressCount}/${progressData.length-1} melhorias)`);
    
    // Destacar momentos importantes
    const entryToGreen = progressData.find(p => p.distance <= tolerance);
    const entryToYellow = progressData.find(p => p.distance <= tolerance + (tolerance * 1.5));
    
    if (entryToYellow) {
        console.log(`🟡 Entra na zona AMARELA em: ${entryToYellow.value} dB (Score: ${entryToYellow.score})`);
    }
    
    if (entryToGreen) {
        console.log(`🟢 Entra na zona VERDE em: ${entryToGreen.value} dB (Score: ${entryToGreen.score})`);
    }
    
    // Teste de casos extremos
    console.log('\n🧪 TESTES DE CASOS EXTREMOS:');
    
    const extremeCases = [
        { value: -60, name: 'Extremamente longe (-60 dB)' },
        { value: -50, name: 'Muito longe (-50 dB)' },
        { value: -23, name: 'Exato no target (-23 dB)' },
        { value: -20.5, name: 'Borda superior tolerância' },
        { value: -25.5, name: 'Borda inferior tolerância' }
    ];
    
    extremeCases.forEach(testCase => {
        const score = window.calculateMetricScore(testCase.value, target, tolerance, options);
        const distance = Math.abs(testCase.value - target);
        const zone = distance <= tolerance ? '🟢' : (distance <= tolerance * 2.5 ? '🟡' : '🔴');
        
        console.log(`   ${zone} ${testCase.name}: Score ${score}/100`);
    });
    
    // Verificar score mínimo
    const veryFarScore = window.calculateMetricScore(-100, target, tolerance, options);
    console.log(`\n🛡️ Score mínimo garantido: ${veryFarScore >= 10 ? '✅' : '❌'} (Score em -100 dB: ${veryFarScore})`);
    
    // Resumo de validação
    console.log('\n📋 VALIDAÇÃO DOS REQUISITOS:');
    console.log(`   ✅ Progresso visível: ${hasConsistentProgress ? 'PASSOU' : 'FALHOU'}`);
    console.log(`   ✅ Score mínimo ≥10: ${veryFarScore >= 10 ? 'PASSOU' : 'FALHOU'}`);
    console.log(`   ✅ Verde no target: ${window.calculateMetricScore(target, target, tolerance, options) === 100 ? 'PASSOU' : 'FALHOU'}`);
    console.log(`   ✅ Diferença incremental: ${progressData[2].score > progressData[0].score ? 'PASSOU' : 'FALHOU'}`);
    
} else {
    console.error('❌ calculateMetricScore não está disponível');
}

console.groupEnd();

// Função para teste específico do usuário
window.testarCenarioUsuario = function() {
    console.clear();
    // Re-executar o teste
    eval(document.querySelector('script[src="teste-score-progressivo.js"]')?.textContent || '');
};

console.log('💡 Execute testarCenarioUsuario() para repetir este teste');