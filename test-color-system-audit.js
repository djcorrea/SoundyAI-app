/**
 * 🧪 SCRIPT DE TESTE - SISTEMA DE CORES DA TABELA DE REFERÊNCIA
 * 
 * Este script simula o comportamento do sistema de cores atual
 * e testa as hipóteses identificadas na auditoria.
 * 
 * Como usar:
 * 1. Copiar e colar no console do navegador
 * 2. Executar: runColorSystemTests()
 * 3. Analisar os resultados
 */

// ============================================================================
// REPRODUÇÃO EXATA DA LÓGICA ATUAL (SEM CORREÇÕES)
// ============================================================================

function calculateColorCurrent(val, target, tol) {
    // Cálculo de diferença
    let diff = null;
    
    if (typeof target === 'object' && target !== null && 
        Number.isFinite(target.min) && Number.isFinite(target.max) && Number.isFinite(val)) {
        // Target é um range
        if (val >= target.min && val <= target.max) {
            diff = 0;
        } else if (val < target.min) {
            diff = val - target.min;
        } else {
            diff = val - target.max;
        }
    } else if (Number.isFinite(val) && Number.isFinite(target)) {
        // Target fixo
        diff = val - target;
    }
    
    // Decisão de cor
    let cssClass, statusText;
    
    if (!Number.isFinite(diff)) {
        return { class: 'na', text: 'N/A', diff };
    } else if (tol === 0) {
        // Lógica para bandas
        const absDiff = Math.abs(diff);
        
        if (absDiff === 0) {
            cssClass = 'ok';
            statusText = 'Ideal';
        } else if (absDiff <= 1.0) {
            cssClass = 'yellow';
            statusText = 'Ajuste leve';
        } else if (absDiff <= 3.0) {
            cssClass = 'orange';
            statusText = 'Ajustar';
        } else {
            cssClass = 'warn';
            statusText = 'Corrigir';
        }
    } else if (!Number.isFinite(tol) || tol < 0) {
        // Fallback de tolerância
        const defaultTol = 1.0;
        const absDiff = Math.abs(diff);
        
        if (absDiff <= defaultTol) {
            cssClass = 'ok';
            statusText = 'Ideal';
        } else {
            const multiplicador = absDiff / defaultTol;
            if (multiplicador <= 2) {
                cssClass = 'yellow';
                statusText = 'Ajuste leve';
            } else {
                cssClass = 'warn';
                statusText = 'Corrigir';
            }
        }
    } else {
        // Lógica padrão
        const absDiff = Math.abs(diff);
        
        if (absDiff <= tol) {
            cssClass = 'ok';
            statusText = 'Ideal';
        } else {
            const multiplicador = absDiff / tol;
            if (multiplicador <= 2) {
                cssClass = 'yellow';
                statusText = 'Ajuste leve';
            } else {
                cssClass = 'warn';
                statusText = 'Corrigir';
            }
        }
    }
    
    return { class: cssClass, text: statusText, diff };
}

// ============================================================================
// VERSÃO CORRIGIDA (COM EPSILON)
// ============================================================================

function calculateColorCorrected(val, target, tol) {
    const EPS = 1e-6; // Epsilon para comparações float
    
    // Cálculo de diferença
    let diff = null;
    
    if (typeof target === 'object' && target !== null && 
        Number.isFinite(target.min) && Number.isFinite(target.max) && Number.isFinite(val)) {
        // Normalizar range (caso invertido)
        const minNorm = Math.min(target.min, target.max);
        const maxNorm = Math.max(target.min, target.max);
        
        if (val >= minNorm - EPS && val <= maxNorm + EPS) {
            diff = 0;
        } else if (val < minNorm) {
            diff = val - minNorm;
        } else {
            diff = val - maxNorm;
        }
    } else if (Number.isFinite(val) && Number.isFinite(target)) {
        // Target fixo
        diff = val - target;
    }
    
    // Decisão de cor
    let cssClass, statusText;
    
    if (!Number.isFinite(diff)) {
        return { class: 'warn', text: 'Sem dados', diff }; // ✅ VERMELHO em vez de NA
    } else if (tol === 0) {
        // Lógica para bandas (SIMPLIFICADA para 3 cores)
        const absDiff = Math.abs(diff);
        
        if (absDiff <= EPS) { // ✅ EPSILON em vez de ===
            cssClass = 'ok';
            statusText = 'Ideal';
        } else if (absDiff <= 2.0 + EPS) { // ✅ SIMPLIFICADO: até 2dB = amarelo
            cssClass = 'yellow';
            statusText = 'Ajuste leve';
        } else {
            cssClass = 'warn';
            statusText = 'Corrigir';
        }
    } else if (!Number.isFinite(tol) || tol < 0) {
        // Fallback de tolerância
        const defaultTol = 1.0;
        const absDiff = Math.abs(diff);
        
        if (absDiff <= defaultTol + EPS) { // ✅ EPSILON
            cssClass = 'ok';
            statusText = 'Ideal';
        } else {
            const multiplicador = absDiff / defaultTol;
            if (multiplicador <= 2 + EPS) { // ✅ EPSILON
                cssClass = 'yellow';
                statusText = 'Ajuste leve';
            } else {
                cssClass = 'warn';
                statusText = 'Corrigir';
            }
        }
    } else {
        // Lógica padrão
        const absDiff = Math.abs(diff);
        
        if (absDiff <= tol + EPS) { // ✅ EPSILON
            cssClass = 'ok';
            statusText = 'Ideal';
        } else {
            const multiplicador = absDiff / tol;
            if (multiplicador <= 2 + EPS) { // ✅ EPSILON
                cssClass = 'yellow';
                statusText = 'Ajuste leve';
            } else {
                cssClass = 'warn';
                statusText = 'Corrigir';
            }
        }
    }
    
    return { class: cssClass, text: statusText, diff };
}

// ============================================================================
// CASOS DE TESTE
// ============================================================================

const testCases = [
    {
        name: 'Teste 1: Banda dentro do range (exato)',
        val: -43.0,
        target: { min: -44, max: -38 },
        tol: 0,
        expected: 'ok'
    },
    {
        name: 'Teste 2: Banda dentro do range (margem mínima)',
        val: -43.9999999,
        target: { min: -44, max: -38 },
        tol: 0,
        expected: 'ok'
    },
    {
        name: 'Teste 3: Banda no limite inferior',
        val: -44.0,
        target: { min: -44, max: -38 },
        tol: 0,
        expected: 'ok'
    },
    {
        name: 'Teste 4: Banda no limite superior',
        val: -38.0,
        target: { min: -44, max: -38 },
        tol: 0,
        expected: 'ok'
    },
    {
        name: 'Teste 5: Banda ligeiramente fora (1dB)',
        val: -37.0,
        target: { min: -44, max: -38 },
        tol: 0,
        expected: 'yellow'
    },
    {
        name: 'Teste 6: Banda muito fora (>3dB)',
        val: -34.0,
        target: { min: -44, max: -38 },
        tol: 0,
        expected: 'warn'
    },
    {
        name: 'Teste 7: LUFS dentro da tolerância',
        val: -14.5,
        target: -14,
        tol: 1,
        expected: 'ok'
    },
    {
        name: 'Teste 8: LUFS exatamente no limite',
        val: -13.0,
        target: -14,
        tol: 1,
        expected: 'ok'
    },
    {
        name: 'Teste 9: LUFS no limite com float precision',
        val: -13.0000001,
        target: -14,
        tol: 1,
        expected: 'ok'
    },
    {
        name: 'Teste 10: LUFS fora um pouco',
        val: -12.5,
        target: -14,
        tol: 1,
        expected: 'yellow'
    },
    {
        name: 'Teste 11: LUFS muito fora',
        val: -10.0,
        target: -14,
        tol: 1,
        expected: 'warn'
    },
    {
        name: 'Teste 12: DR exatamente no limite 2x',
        val: 8.0,
        target: 10,
        tol: 1,
        expected: 'yellow'
    },
    {
        name: 'Teste 13: DR no limite 2x com float precision',
        val: 8.0000001,
        target: 10,
        tol: 1,
        expected: 'yellow'
    },
    {
        name: 'Teste 14: Valor null',
        val: null,
        target: -14,
        tol: 1,
        expected: 'warn'
    },
    {
        name: 'Teste 15: Target null',
        val: -14,
        target: null,
        tol: 1,
        expected: 'warn'
    },
    {
        name: 'Teste 16: Tolerância null (fallback)',
        val: -14.5,
        target: -14,
        tol: null,
        expected: 'ok'
    },
    {
        name: 'Teste 17: Range invertido',
        val: -40,
        target: { min: -38, max: -44 }, // INVERTIDO
        tol: 0,
        expected: 'ok'
    }
];

// ============================================================================
// EXECUTAR TESTES
// ============================================================================

function runColorSystemTests() {
    console.log('🧪 INICIANDO TESTES DO SISTEMA DE CORES\n');
    console.log('='.repeat(80));
    
    let passedCurrent = 0;
    let passedCorrected = 0;
    const failedTests = [];
    
    testCases.forEach((test, index) => {
        const resultCurrent = calculateColorCurrent(test.val, test.target, test.tol);
        const resultCorrected = calculateColorCorrected(test.val, test.target, test.tol);
        
        const passedCurrentTest = resultCurrent.class === test.expected;
        const passedCorrectedTest = resultCorrected.class === test.expected;
        
        if (passedCurrentTest) passedCurrent++;
        if (passedCorrectedTest) passedCorrected++;
        
        const icon = passedCurrentTest ? '✅' : '❌';
        const iconCorrected = passedCorrectedTest ? '✅' : '❌';
        
        console.log(`\n${icon} ${test.name}`);
        console.log(`   Input: val=${test.val}, target=${JSON.stringify(test.target)}, tol=${test.tol}`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Current: ${resultCurrent.class} (diff=${resultCurrent.diff}) ${passedCurrentTest ? '' : '❌ FALHOU'}`);
        console.log(`   ${iconCorrected} Corrected: ${resultCorrected.class} (diff=${resultCorrected.diff})`);
        
        if (!passedCurrentTest || !passedCorrectedTest) {
            failedTests.push({
                test: test.name,
                current: resultCurrent.class,
                corrected: resultCorrected.class,
                expected: test.expected
            });
        }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`   Sistema Atual: ${passedCurrent}/${testCases.length} testes passaram`);
    console.log(`   Sistema Corrigido: ${passedCorrected}/${testCases.length} testes passaram`);
    
    if (failedTests.length > 0) {
        console.log(`\n❌ TESTES QUE FALHARAM:`);
        failedTests.forEach(fail => {
            console.log(`   - ${fail.test}`);
            console.log(`     Atual: ${fail.current} | Corrigido: ${fail.corrected} | Esperado: ${fail.expected}`);
        });
    }
    
    console.log('\n' + '='.repeat(80));
    
    if (passedCurrent === testCases.length) {
        console.log('✅ SISTEMA ATUAL: Todos os testes passaram!');
    } else {
        console.log(`❌ SISTEMA ATUAL: ${testCases.length - passedCurrent} testes falharam`);
    }
    
    if (passedCorrected === testCases.length) {
        console.log('✅ SISTEMA CORRIGIDO: Todos os testes passaram!');
    } else {
        console.log(`❌ SISTEMA CORRIGIDO: ${testCases.length - passedCorrected} testes falharam`);
    }
    
    // Retornar objeto com resultados
    return {
        total: testCases.length,
        current: {
            passed: passedCurrent,
            failed: testCases.length - passedCurrent
        },
        corrected: {
            passed: passedCorrected,
            failed: testCases.length - passedCorrected
        },
        failedTests
    };
}

// ============================================================================
// TESTE INTERATIVO (para usar no console)
// ============================================================================

const testColorSystem = function(val, target, tol) {
    console.log('\n🧪 TESTE INTERATIVO\n');
    console.log(`Input: val=${val}, target=${JSON.stringify(target)}, tol=${tol}\n`);
    
    const current = calculateColorCurrent(val, target, tol);
    const corrected = calculateColorCorrected(val, target, tol);
    
    console.log('📊 Sistema Atual:');
    console.log(`   Classe: ${current.class}`);
    console.log(`   Status: ${current.text}`);
    console.log(`   Diff: ${current.diff}`);
    
    console.log('\n✅ Sistema Corrigido:');
    console.log(`   Classe: ${corrected.class}`);
    console.log(`   Status: ${corrected.text}`);
    console.log(`   Diff: ${corrected.diff}`);
    
    if (current.class !== corrected.class) {
        console.log(`\n⚠️ DIFERENÇA DETECTADA: ${current.class} → ${corrected.class}`);
    } else {
        console.log(`\n✅ Ambos retornam a mesma cor: ${current.class}`);
    }
};

// ============================================================================
// AUTO-EXECUÇÃO
// ============================================================================

// Exportar para browser
if (typeof window !== 'undefined') {
    window.testColorSystem = testColorSystem;
    window.runColorSystemTests = runColorSystemTests;
    console.log('✅ Script de teste carregado no browser!');
    console.log('📝 Para executar os testes, use: runColorSystemTests()');
    console.log('🧪 Para teste interativo, use: testColorSystem(val, target, tol)');
    console.log('\nExemplo: testColorSystem(-43, {min: -44, max: -38}, 0)');
} else {
    // Executar automaticamente em Node.js
    console.log('✅ Executando testes em Node.js...\n');
    runColorSystemTests();
}
