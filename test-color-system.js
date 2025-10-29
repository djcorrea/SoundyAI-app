/**
 * test-color-system.js
 * 
 * Testes para o sistema centralizado de coloração.
 * Valida que não há gaps nos limites e que dados ausentes retornam 'no-data'.
 */

// Importar funções (se usando módulos)
let getStatusClass, getStatusText;

if (typeof window !== 'undefined' && window.RefColors) {
    ({ getStatusClass, getStatusText } = window.RefColors);
} else {
    // Para testes Node.js
    const colors = require('./public/util/colors.js');
    ({ getStatusClass, getStatusText } = colors);
}

/**
 * Suite de testes
 */
const tests = {
    // Teste 1: Limites inclusivos (sem gaps)
    'Limites inclusivos - Zona OK': () => {
        const target = -14;
        const tol = 2.5;
        
        // Exatamente no limite superior (deve ser OK)
        const result1 = getStatusClass({ value: -11.5, target, tol });
        if (result1 !== 'ok') {
            throw new Error(`Esperado 'ok', obteve '${result1}' para diff=2.5 (limite)`);
        }
        
        // Ligeiramente acima do limite (deve ser yellow)
        const result2 = getStatusClass({ value: -11.49, target, tol });
        if (result2 !== 'yellow') {
            throw new Error(`Esperado 'yellow', obteve '${result2}' para diff=2.51`);
        }
        
        return '✅ Limites inclusivos OK';
    },
    
    // Teste 2: Transição OK → Yellow
    'Transição OK → Yellow': () => {
        const target = -14;
        const tol = 2.5;
        
        // Último valor OK
        const result1 = getStatusClass({ value: -11.5, target, tol });
        if (result1 !== 'ok') {
            throw new Error(`Esperado 'ok', obteve '${result1}'`);
        }
        
        // Primeiro valor Yellow
        const result2 = getStatusClass({ value: -11.4999, target, tol });
        if (result2 !== 'yellow') {
            throw new Error(`Esperado 'yellow', obteve '${result2}'`);
        }
        
        // Último valor Yellow (2*tol)
        const result3 = getStatusClass({ value: -9.0, target, tol });
        if (result3 !== 'yellow') {
            throw new Error(`Esperado 'yellow', obteve '${result3}'`);
        }
        
        return '✅ Transição OK → Yellow correta';
    },
    
    // Teste 3: Transição Yellow → Warn
    'Transição Yellow → Warn': () => {
        const target = -14;
        const tol = 2.5;
        
        // Último valor Yellow (2*tol = 5.0)
        const result1 = getStatusClass({ value: -9.0, target, tol });
        if (result1 !== 'yellow') {
            throw new Error(`Esperado 'yellow', obteve '${result1}'`);
        }
        
        // Primeiro valor Warn
        const result2 = getStatusClass({ value: -8.9999, target, tol });
        if (result2 !== 'warn') {
            throw new Error(`Esperado 'warn', obteve '${result2}'`);
        }
        
        return '✅ Transição Yellow → Warn correta';
    },
    
    // Teste 4: Dados inválidos → no-data
    'Dados inválidos retornam no-data': () => {
        // Value nulo
        const result1 = getStatusClass({ value: null, target: -14, tol: 2.5 });
        if (result1 !== 'no-data') {
            throw new Error(`Esperado 'no-data', obteve '${result1}' para value=null`);
        }
        
        // Target nulo
        const result2 = getStatusClass({ value: -14, target: null, tol: 2.5 });
        if (result2 !== 'no-data') {
            throw new Error(`Esperado 'no-data', obteve '${result2}' para target=null`);
        }
        
        // Value = undefined
        const result3 = getStatusClass({ value: undefined, target: -14, tol: 2.5 });
        if (result3 !== 'no-data') {
            throw new Error(`Esperado 'no-data', obteve '${result3}' para value=undefined`);
        }
        
        // Value = NaN
        const result4 = getStatusClass({ value: NaN, target: -14, tol: 2.5 });
        if (result4 !== 'no-data') {
            throw new Error(`Esperado 'no-data', obteve '${result4}' para value=NaN`);
        }
        
        return '✅ Dados inválidos tratados corretamente';
    },
    
    // Teste 5: Tolerância ausente usa fallback
    'Tolerância ausente usa fallback': () => {
        // Tol = null
        const result1 = getStatusClass({ value: -13.5, target: -14, tol: null });
        if (result1 !== 'ok') {
            throw new Error(`Esperado 'ok', obteve '${result1}' com tol=null (fallback=1.0)`);
        }
        
        // Tol = undefined
        const result2 = getStatusClass({ value: -13.5, target: -14, tol: undefined });
        if (result2 !== 'ok') {
            throw new Error(`Esperado 'ok', obteve '${result2}' com tol=undefined`);
        }
        
        // Tol = 0 (deve usar bandMode)
        const result3 = getStatusClass({ value: -13.5, target: -14, tol: 0 });
        if (result3 !== 'yellow') {
            throw new Error(`Esperado 'yellow' (bandMode), obteve '${result3}' com tol=0`);
        }
        
        return '✅ Fallback de tolerância funciona';
    },
    
    // Teste 6: Modo Banda (4 níveis)
    'Modo Banda com 4 níveis': () => {
        const target = -13.5; // Ponto médio de range [-15, -12]
        const tol = 0; // Band mode
        
        // Diff = 0 → OK
        const result1 = getStatusClass({ value: -13.5, target, tol, bandMode: true });
        if (result1 !== 'ok') {
            throw new Error(`Esperado 'ok', obteve '${result1}' para diff=0`);
        }
        
        // Diff = 0.5dB → Yellow
        const result2 = getStatusClass({ value: -13.0, target, tol, bandMode: true });
        if (result2 !== 'yellow') {
            throw new Error(`Esperado 'yellow', obteve '${result2}' para diff=0.5`);
        }
        
        // Diff = 2dB → Orange
        const result3 = getStatusClass({ value: -11.5, target, tol, bandMode: true });
        if (result3 !== 'orange') {
            throw new Error(`Esperado 'orange', obteve '${result3}' para diff=2`);
        }
        
        // Diff = 4dB → Warn
        const result4 = getStatusClass({ value: -9.5, target, tol, bandMode: true });
        if (result4 !== 'warn') {
            throw new Error(`Esperado 'warn', obteve '${result4}' para diff=4`);
        }
        
        return '✅ Modo Banda funciona corretamente';
    },
    
    // Teste 7: Valores muito pequenos (precisão float)
    'Precisão float preservada': () => {
        const target = -14;
        const tol = 2.5;
        
        // Diff muito pequeno (0.001)
        const result1 = getStatusClass({ value: -13.999, target, tol });
        if (result1 !== 'ok') {
            throw new Error(`Esperado 'ok', obteve '${result1}' para diff=0.001`);
        }
        
        // Diff negativo muito pequeno
        const result2 = getStatusClass({ value: -14.001, target, tol });
        if (result2 !== 'ok') {
            throw new Error(`Esperado 'ok', obteve '${result2}' para diff=-0.001`);
        }
        
        return '✅ Precisão float preservada';
    },
    
    // Teste 8: Casos extremos
    'Casos extremos': () => {
        // Diff exatamente zero
        const result1 = getStatusClass({ value: -14.0, target: -14.0, tol: 2.5 });
        if (result1 !== 'ok') {
            throw new Error(`Esperado 'ok', obteve '${result1}' para diff=0`);
        }
        
        // Valores negativos grandes
        const result2 = getStatusClass({ value: -50, target: -14, tol: 2.5 });
        if (result2 !== 'warn') {
            throw new Error(`Esperado 'warn', obteve '${result2}' para diff=-36`);
        }
        
        // Valores positivos
        const result3 = getStatusClass({ value: 5, target: 10, tol: 2 });
        if (result3 !== 'warn') {
            throw new Error(`Esperado 'warn', obteve '${result3}' para diff=-5`);
        }
        
        return '✅ Casos extremos tratados';
    },
    
    // Teste 9: getStatusText
    'getStatusText retorna strings corretas': () => {
        if (getStatusText('ok') !== 'Ideal') {
            throw new Error(`Esperado 'Ideal', obteve '${getStatusText('ok')}'`);
        }
        if (getStatusText('yellow') !== 'Ajuste leve') {
            throw new Error(`Esperado 'Ajuste leve', obteve '${getStatusText('yellow')}'`);
        }
        if (getStatusText('orange') !== 'Ajustar') {
            throw new Error(`Esperado 'Ajustar', obteve '${getStatusText('orange')}'`);
        }
        if (getStatusText('warn') !== 'Corrigir') {
            throw new Error(`Esperado 'Corrigir', obteve '${getStatusText('warn')}'`);
        }
        if (getStatusText('no-data') !== 'Sem dados') {
            throw new Error(`Esperado 'Sem dados', obteve '${getStatusText('no-data')}'`);
        }
        
        return '✅ getStatusText correto';
    },
    
    // Teste 10: Nunca retorna vazio
    'Nunca retorna vazio ou undefined': () => {
        // Testar 100 combinações aleatórias
        for (let i = 0; i < 100; i++) {
            const value = Math.random() * 100 - 50;
            const target = Math.random() * 100 - 50;
            const tol = Math.random() * 10;
            
            const result = getStatusClass({ value, target, tol });
            
            if (!result || result === '' || result === undefined) {
                throw new Error(`Retornou vazio para value=${value}, target=${target}, tol=${tol}`);
            }
            
            const validClasses = ['ok', 'yellow', 'warn', 'orange', 'no-data'];
            if (!validClasses.includes(result)) {
                throw new Error(`Classe inválida: '${result}'`);
            }
        }
        
        return '✅ Sempre retorna classe válida';
    }
};

/**
 * Executar todos os testes
 */
function runAllTests() {
    console.log('🧪 ========================================');
    console.log('🧪 INICIANDO TESTES DO SISTEMA DE CORES');
    console.log('🧪 ========================================\n');
    
    let passed = 0;
    let failed = 0;
    const failures = [];
    
    for (const [name, test] of Object.entries(tests)) {
        try {
            const result = test();
            console.log(result);
            passed++;
        } catch (error) {
            console.error(`❌ FALHOU: ${name}`);
            console.error(`   Erro: ${error.message}\n`);
            failed++;
            failures.push({ name, error: error.message });
        }
    }
    
    console.log('\n🧪 ========================================');
    console.log(`🧪 RESULTADO: ${passed} passou, ${failed} falhou`);
    console.log('🧪 ========================================\n');
    
    if (failed > 0) {
        console.log('❌ FALHAS:');
        failures.forEach(({ name, error }) => {
            console.log(`   - ${name}: ${error}`);
        });
        return false;
    } else {
        console.log('✅ TODOS OS TESTES PASSARAM!');
        return true;
    }
}

// Auto-executar se no browser
if (typeof window !== 'undefined') {
    window.runColorSystemTests = runAllTests;
    console.log('💡 Execute window.runColorSystemTests() para testar o sistema de cores');
}

// Exportar para Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests, tests };
}
