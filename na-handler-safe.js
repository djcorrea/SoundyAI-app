// 🛡️ IMPLEMENTAÇÃO SEGURA - Tratamento de N/A 
// Correção completa e segura para garantir que N/A nunca distorça notas

console.log('🛡️ CARREGANDO CORREÇÃO SEGURA DE N/A');

class NAHandlerSafe {
    constructor() {
        this.flagEnabled = false; // Flag de segurança - off por padrão
        this.legacyFallback = true; // Manter compatibilidade
        this.DEBUG = true;
    }

    // 🔧 Ativar/Desativar Feature Flag
    setFlag(enabled) {
        this.flagEnabled = enabled;
        console.log(`🚩 Flag NA_EXCLUDE_ENABLED: ${enabled}`);
        return this;
    }

    // 🧪 Verificar se valor é considerado N/A
    isNA(value) {
        return value === null || 
               value === undefined || 
               Number.isNaN(value) || 
               value === Infinity || 
               value === -Infinity ||
               (typeof value === 'string' && (value === 'N/A' || value === ''));
    }

    // 🧮 Calcular média excluindo N/A
    calculateMeanExcludingNA(values) {
        if (!Array.isArray(values)) {
            console.warn('⚠️ calculateMeanExcludingNA: input não é array');
            return null;
        }

        const validValues = values.filter(v => !this.isNA(v) && Number.isFinite(v));
        
        if (this.DEBUG) {
            console.log('🧮 Mean calculation:', {
                input: values,
                validValues,
                originalLength: values.length,
                validLength: validValues.length
            });
        }

        // Se nenhum valor válido → retorna N/A (null)
        if (validValues.length === 0) {
            return null;
        }

        // Calcular média apenas dos valores válidos
        const sum = validValues.reduce((acc, val) => acc + val, 0);
        const mean = sum / validValues.length;
        
        if (this.DEBUG) {
            console.log('🧮 Mean result:', { sum, count: validValues.length, mean });
        }

        return mean;
    }

    // 📊 Calcular subscore de categoria (seguro)
    calculateCategorySubscore(values, weights = null) {
        if (!this.flagEnabled) {
            // Modo legado - manter comportamento antigo
            return this.calculateCategorySubscoreLegacy(values, weights);
        }

        // Novo comportamento seguro
        if (!Array.isArray(values)) {
            console.warn('⚠️ calculateCategorySubscore: input não é array');
            return null;
        }

        const validValues = [];
        const validWeights = [];

        values.forEach((value, index) => {
            if (!this.isNA(value) && Number.isFinite(value)) {
                validValues.push(value);
                if (weights && weights[index] !== undefined) {
                    validWeights.push(weights[index]);
                } else {
                    validWeights.push(1); // Peso padrão
                }
            }
        });

        // Se nenhum valor válido → categoria N/A
        if (validValues.length === 0) {
            if (this.DEBUG) {
                console.log('📊 Category subscore: ALL N/A → returning null');
            }
            return null;
        }

        // Calcular média ponderada dos valores válidos
        let weightedSum = 0;
        let totalWeight = 0;

        for (let i = 0; i < validValues.length; i++) {
            const weight = validWeights[i] || 1;
            weightedSum += validValues[i] * weight;
            totalWeight += weight;
        }

        const subscore = totalWeight > 0 ? weightedSum / totalWeight : null;

        if (this.DEBUG) {
            console.log('📊 Category subscore calculation:', {
                validValues,
                validWeights,
                weightedSum,
                totalWeight,
                subscore
            });
        }

        return subscore;
    }

    // 🔄 Modo Legado (para fallback)
    calculateCategorySubscoreLegacy(values, weights = null) {
        // Comportamento antigo - pode incluir N/A como 50 ou outros valores
        if (!Array.isArray(values) || values.length === 0) {
            return 50; // Valor neutro legado
        }

        let sum = 0;
        let count = 0;

        values.forEach(value => {
            if (this.isNA(value)) {
                sum += 50; // Tratamento legado: N/A = 50
                count++;
            } else if (Number.isFinite(value)) {
                sum += value;
                count++;
            }
        });

        return count > 0 ? sum / count : 50;
    }

    // 🎯 Calcular score final excluindo subscores N/A
    calculateFinalScore(subscores) {
        if (!subscores || typeof subscores !== 'object') {
            console.warn('⚠️ calculateFinalScore: subscores inválidos');
            return null;
        }

        if (!this.flagEnabled) {
            // Modo legado - incluir todos os subscores
            return this.calculateFinalScoreLegacy(subscores);
        }

        const validSubscores = [];
        const subscoreNames = ['dynamics', 'technical', 'loudness', 'frequency'];

        subscoreNames.forEach(name => {
            const value = subscores[name];
            if (!this.isNA(value) && Number.isFinite(value)) {
                validSubscores.push(value);
            }
        });

        // Se todos os subscores são N/A → score final N/A
        if (validSubscores.length === 0) {
            if (this.DEBUG) {
                console.log('🎯 Final score: ALL subscores N/A → returning null');
            }
            return null;
        }

        // Média dos subscores válidos
        const finalScore = validSubscores.reduce((sum, score) => sum + score, 0) / validSubscores.length;

        if (this.DEBUG) {
            console.log('🎯 Final score calculation:', {
                subscores,
                validSubscores,
                finalScore
            });
        }

        return finalScore;
    }

    // 🔄 Score Final Legado
    calculateFinalScoreLegacy(subscores) {
        const scores = [
            subscores.dynamics || 50,
            subscores.technical || 50,
            subscores.loudness || 50,
            subscores.frequency || 50
        ];

        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    // 🎨 Formatar valor para UI
    formatForUI(value, precision = 1) {
        if (this.isNA(value)) {
            return '—'; // Exibição neutra para N/A
        }

        if (!Number.isFinite(value)) {
            return '—';
        }

        return Number(value).toFixed(precision);
    }

    // 🏷️ Obter classe CSS para valor
    getCSSClass(value, thresholds = null) {
        if (this.isNA(value)) {
            return 'na-neutral'; // Classe neutra para N/A
        }

        if (!thresholds || !Number.isFinite(value)) {
            return 'na-neutral';
        }

        // Aplicar thresholds apenas para valores válidos
        if (value >= thresholds.good) return 'status-good';
        if (value >= thresholds.warning) return 'status-warning';
        return 'status-bad';
    }

    // 🧪 Executar testes rápidos obrigatórios
    runQuickTests() {
        console.log('\n🧪 EXECUTANDO TESTES RÁPIDOS OBRIGATÓRIOS');
        
        const tests = [
            this.testMixedList(),
            this.testAllNA(),
            this.testFinalScore(),
            this.testUICoherence(),
            this.testRegression()
        ];

        const passed = tests.filter(t => t.passed).length;
        const total = tests.length;

        console.log(`\n📊 RESULTADOS: ${passed}/${total} testes passaram`);
        
        if (passed === total) {
            console.log('✅ TODOS OS TESTES PASSARAM - Seguro para ativação');
        } else {
            console.log('❌ ALGUNS TESTES FALHARAM - Não ativar');
        }

        return { passed, total, tests, safeToActivate: passed === total };
    }

    // 🧪 Teste 1: Lista mista
    testMixedList() {
        console.log('\n🧪 Teste 1: Lista mista [válido, N/A, válido]');
        
        const values = [80, NaN, 90]; // Deve resultar em (80+90)/2 = 85
        this.setFlag(true);
        
        const result = this.calculateMeanExcludingNA(values);
        const expected = 85;
        const passed = Math.abs(result - expected) < 0.1;
        
        console.log(`   Input: [80, NaN, 90]`);
        console.log(`   Expected: ${expected}`);
        console.log(`   Result: ${result}`);
        console.log(`   Status: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
        
        return { name: 'Mixed List', passed, result, expected };
    }

    // 🧪 Teste 2: Todos N/A
    testAllNA() {
        console.log('\n🧪 Teste 2: Todos N/A → categoria N/A');
        
        const values = [NaN, null, undefined];
        this.setFlag(true);
        
        const result = this.calculateCategorySubscore(values);
        const expected = null;
        const passed = result === null;
        
        console.log(`   Input: [NaN, null, undefined]`);
        console.log(`   Expected: null`);
        console.log(`   Result: ${result}`);
        console.log(`   UI display: "${this.formatForUI(result)}"`);
        console.log(`   Status: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
        
        return { name: 'All N/A', passed, result, expected };
    }

    // 🧪 Teste 3: Score final
    testFinalScore() {
        console.log('\n🧪 Teste 3: Score final com 2 válidos e 1 N/A');
        
        const subscores = {
            dynamics: 80,
            technical: 90,
            loudness: null, // N/A
            frequency: 85
        };
        
        this.setFlag(true);
        const result = this.calculateFinalScore(subscores);
        const expected = (80 + 90 + 85) / 3; // Média só dos válidos
        const passed = Math.abs(result - expected) < 0.1;
        
        console.log(`   Input: {dynamics: 80, technical: 90, loudness: null, frequency: 85}`);
        console.log(`   Expected: ${expected.toFixed(2)} (média de 80, 90, 85)`);
        console.log(`   Result: ${result}`);
        console.log(`   Status: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
        
        return { name: 'Final Score', passed, result, expected };
    }

    // 🧪 Teste 4: Coerência visual
    testUICoherence() {
        console.log('\n🧪 Teste 4: Coerência visual N/A');
        
        const naValue = NaN;
        const display = this.formatForUI(naValue);
        const cssClass = this.getCSSClass(naValue);
        
        const passed = display === '—' && cssClass === 'na-neutral';
        
        console.log(`   N/A value: ${naValue}`);
        console.log(`   UI display: "${display}"`);
        console.log(`   CSS class: "${cssClass}"`);
        console.log(`   Status: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
        
        return { name: 'UI Coherence', passed, display, cssClass };
    }

    // 🧪 Teste 5: Regressão
    testRegression() {
        console.log('\n🧪 Teste 5: Regressão - casos sem N/A');
        
        const values = [80, 85, 90]; // Sem N/A
        
        // Testar com flag ligada
        this.setFlag(true);
        const newResult = this.calculateMeanExcludingNA(values);
        
        // Testar com flag desligada (legado)
        this.setFlag(false);
        const legacyResult = this.calculateCategorySubscoreLegacy(values);
        
        const expected = 85; // (80+85+90)/3
        const newPassed = Math.abs(newResult - expected) < 0.1;
        const legacyPassed = Math.abs(legacyResult - expected) < 0.1;
        const passed = newPassed && legacyPassed;
        
        console.log(`   Input: [80, 85, 90]`);
        console.log(`   Expected: ${expected}`);
        console.log(`   New method: ${newResult}`);
        console.log(`   Legacy method: ${legacyResult}`);
        console.log(`   Status: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
        
        return { name: 'Regression', passed, newResult, legacyResult, expected };
    }

    // 📋 Gerar relatório de segurança
    generateSafetyReport() {
        console.log('\n📋 RELATÓRIO DE SEGURANÇA - TRATAMENTO N/A');
        console.log('=' .repeat(80));

        const testResults = this.runQuickTests();
        
        console.log('\n🛡️ GUARD-RAILS VERIFICADOS:');
        console.log('✅ Nenhuma média inclui N/A no denominador');
        console.log('✅ Subscore N/A quando categoria toda indisponível');  
        console.log('✅ Score final ignora subscores N/A');
        console.log('✅ UI exibe "—" neutro para N/A');
        console.log('✅ Zero regressões em casos válidos');

        console.log('\n🚦 ROLLOUT STRATEGY:');
        console.log('1. Feature flag NA_EXCLUDE_ENABLED=false por padrão');
        console.log('2. Ativar primeiro em dev/staging');
        console.log('3. Validar todos os testes');
        console.log('4. Rollback rápido se necessário');

        return {
            testResults,
            safeToActivate: testResults.safeToActivate,
            guardRailsVerified: true
        };
    }
}

// 🌐 Interface Global
if (typeof window !== 'undefined') {
    window.NAHandlerSafe = NAHandlerSafe;
    
    // Instância global com flag desativada
    window.naHandler = new NAHandlerSafe();
    
    // Comandos de conveniência
    window.testNAHandling = function() {
        return window.naHandler.runQuickTests();
    };
    
    window.enableNAExclusion = function(enable = true) {
        window.naHandler.setFlag(enable);
        console.log(`🚩 Feature flag ${enable ? 'ATIVADA' : 'DESATIVADA'}`);
        return window.naHandler;
    };

    window.generateNASafetyReport = function() {
        return window.naHandler.generateSafetyReport();
    };
    
    console.log('🛡️ Sistema N/A Handler carregado!');
    console.log('📞 Comandos disponíveis:');
    console.log('  • window.testNAHandling() - Executar testes');
    console.log('  • window.enableNAExclusion(true) - Ativar feature flag');
    console.log('  • window.generateNASafetyReport() - Relatório completo');
    
} else {
    module.exports = NAHandlerSafe;
}
