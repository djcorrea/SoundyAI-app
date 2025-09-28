// 🎯 VERIFICAÇÃO FINAL - Sistema de Scoring por Tolerância
// Execute este script no console do navegador para verificar se a correção funcionou

console.group('🔍 DIAGNÓSTICO SISTEMA DE SCORING');

// 1. Verificar se scoring.js foi carregado
console.log('1️⃣ Verificando carregamento do scoring.js...');
console.log('   window.__MIX_SCORING_VERSION__:', window.__MIX_SCORING_VERSION__ || '❌ Não encontrado');

// 2. Verificar se funções estão disponíveis
console.log('2️⃣ Verificando funções disponíveis...');
console.log('   window.computeMixScore:', typeof window.computeMixScore === 'function' ? '✅ Disponível' : '❌ Não encontrado');
console.log('   window.calculateMetricScore:', typeof window.calculateMetricScore === 'function' ? '✅ Disponível' : '❌ Não encontrado');

// 3. Teste funcional da calculateMetricScore
if (typeof window.calculateMetricScore === 'function') {
    console.log('3️⃣ Testando calculateMetricScore...');
    
    // Caso do usuário: mid = -31.3 dB, target = -17.9 dB, tolerance = ±2.5 dB
    const testCases = [
        { value: -31.3, name: 'Valor Original (sem ajuste)' },
        { value: -30.3, name: 'Ajuste +1 dB' },
        { value: -29.3, name: 'Ajuste +2 dB' },
        { value: -28.3, name: 'Ajuste +3 dB' },
        { value: -27.3, name: 'Ajuste +4 dB' },
        { value: -20.4, name: 'Na borda da tolerância' },
        { value: -18.0, name: 'Próximo ao target' }
    ];
    
    const target = -17.9;
    const tolerance = 2.5;
    
    console.log(`   Target: ${target} dB, Tolerância: ±${tolerance} dB`);
    
    testCases.forEach(testCase => {
        try {
            const score = window.calculateMetricScore(
                testCase.value,
                target,
                tolerance,
                'mid',
                { yellowMin: 0.3, bufferFactor: 0.1, severity: 1.2 }
            );
            
            const distanceFromTarget = Math.abs(testCase.value - target);
            const withinTolerance = distanceFromTarget <= tolerance;
            
            console.log(`   ${testCase.name}: ${testCase.value} dB → Score: ${score?.toFixed(2) || 'null'}/10 ${withinTolerance ? '🟢' : '🔴'}`);
        } catch (error) {
            console.error(`   ${testCase.name}: ERRO -`, error.message);
        }
    });
} else {
    console.error('3️⃣ ❌ calculateMetricScore não disponível - não é possível testar');
}

// 4. Verificar se computeMixScore usa a nova lógica
if (typeof window.computeMixScore === 'function') {
    console.log('4️⃣ Testando computeMixScore...');
    
    const mockTechnicalData = {
        lufsIntegrated: -31.3,
        truePeakDbtp: -6.2,
        dynamicRange: 8.5,
        // Bandas espectrais mock
        spectralBands: {
            'sub-bass': { energy_db: -25.0 },
            'bass': { energy_db: -18.0 }
        }
    };
    
    const mockReference = {
        lufs_target: -17.9,
        tol_lufs: 2.5,
        true_peak_target: -1.0,
        tol_true_peak: 1.0,
        dr_target: 12.0,
        tol_dr: 3.0,
        genre: 'pop'
    };
    
    try {
        const result = window.computeMixScore(mockTechnicalData, mockReference);
        console.log('   Resultado computeMixScore:', result);
        console.log('   Score final:', result?.scorePct || 'N/A');
        console.log('   Método usado:', result?.method || 'N/A');
    } catch (error) {
        console.error('   ERRO em computeMixScore:', error.message);
    }
} else {
    console.error('4️⃣ ❌ computeMixScore não disponível');
}

console.log('5️⃣ Resumo:');
const scoring_loaded = !!window.__MIX_SCORING_VERSION__;
const computeMixScore_available = typeof window.computeMixScore === 'function';
const calculateMetricScore_available = typeof window.calculateMetricScore === 'function';

console.log(`   scoring.js carregado: ${scoring_loaded ? '✅' : '❌'}`);
console.log(`   computeMixScore disponível: ${computeMixScore_available ? '✅' : '❌'}`);
console.log(`   calculateMetricScore disponível: ${calculateMetricScore_available ? '✅' : '❌'}`);

if (scoring_loaded && computeMixScore_available && calculateMetricScore_available) {
    console.log('🎉 SISTEMA FUNCIONANDO CORRETAMENTE!');
    console.log('✅ O scoring por tolerância agora deve funcionar no SoundyAI');
} else {
    console.error('❌ PROBLEMAS DETECTADOS - Verificar carregamento dos scripts');
}

console.groupEnd();

// Função helper para testar no console
window.testToleranceScoring = function(value, target, tolerance) {
    if (typeof window.calculateMetricScore !== 'function') {
        console.error('calculateMetricScore não disponível');
        return;
    }
    
    const score = window.calculateMetricScore(value, target, tolerance, 'test', {
        yellowMin: 0.3,
        bufferFactor: 0.1, 
        severity: 1.2
    });
    
    const distance = Math.abs(value - target);
    const withinTolerance = distance <= tolerance;
    
    console.log(`Teste: ${value} vs ${target} (±${tolerance})`);
    console.log(`Distância: ${distance.toFixed(2)}`);
    console.log(`Dentro da tolerância: ${withinTolerance ? 'Sim 🟢' : 'Não 🔴'}`);
    console.log(`Score: ${score}/10`);
    
    return score;
};

console.log('💡 Execute: testToleranceScoring(-31.3, -17.9, 2.5) para testar manualmente');