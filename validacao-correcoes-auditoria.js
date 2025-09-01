// 🧪 SCRIPT DE VALIDAÇÃO - CORREÇÕES DA AUDITORIA
// Testa cada correção proposta antes e depois da implementação

console.log('🧪 INICIANDO VALIDAÇÃO DAS CORREÇÕES PROPOSTAS');

class CorrectionValidator {
    constructor() {
        this.testResults = [];
        this.validationLogs = [];
    }

    // 🎨 TESTE 1: Cor vs Sugestão Consistente
    async testColorSuggestionConsistency() {
        console.log('\n🎨 TESTE 1: Validando Consistência Cor vs Sugestão');
        
        const test = {
            name: 'Color vs Suggestion Consistency',
            status: 'running',
            before: {},
            after: {},
            passed: false
        };

        try {
            // Cenários de teste
            const testCases = [
                { value: -14.0, target: -14, tolerance: 1, expectedColor: 'green', expectedSuggestion: '' },
                { value: -14.8, target: -14, tolerance: 1, expectedColor: 'yellow', expectedSuggestion: 'AUMENTAR' },
                { value: -16.5, target: -14, tolerance: 1, expectedColor: 'red', expectedSuggestion: 'AUMENTAR' },
                { value: -13.2, target: -14, tolerance: 1, expectedColor: 'yellow', expectedSuggestion: 'DIMINUIR' },
                { value: -11.5, target: -14, tolerance: 1, expectedColor: 'red', expectedSuggestion: 'DIMINUIR' }
            ];

            let consistentResults = 0;
            let totalTests = testCases.length;

            for (const testCase of testCases) {
                const diff = testCase.value - testCase.target;
                const absDiff = Math.abs(diff);
                
                // Simular lógica CORRIGIDA
                let color, suggestion;
                
                if (absDiff <= testCase.tolerance) {
                    color = 'green';
                    suggestion = ''; // CORREÇÃO: sem sugestão se ideal
                } else if (absDiff <= testCase.tolerance * 2) {
                    color = 'yellow';
                    suggestion = diff > 0 ? 'DIMINUIR' : 'AUMENTAR';
                } else {
                    color = 'red';
                    suggestion = diff > 0 ? 'DIMINUIR' : 'AUMENTAR';
                }
                
                const isConsistent = (color === testCase.expectedColor && 
                                    suggestion === testCase.expectedSuggestion);
                
                if (isConsistent) consistentResults++;
                
                test.after[`case_${testCase.value}`] = {
                    color,
                    suggestion,
                    expected: testCase,
                    consistent: isConsistent
                };
            }
            
            test.passed = (consistentResults === totalTests);
            test.score = `${consistentResults}/${totalTests}`;
            test.status = test.passed ? 'PASSED' : 'FAILED';
            
            console.log(`   Resultado: ${test.status} - ${test.score} casos consistentes`);
            
        } catch (error) {
            test.status = 'ERROR';
            test.error = error.message;
        }
        
        this.testResults.push(test);
        return test;
    }

    // 📊 TESTE 2: Contagem de Problemas Precisa
    async testProblemCountAccuracy() {
        console.log('\n📊 TESTE 2: Validando Contagem de Problemas');
        
        const test = {
            name: 'Problem Count Accuracy',
            status: 'running',
            before: {},
            after: {},
            passed: false
        };

        try {
            // Simular análise com problemas conhecidos
            const mockAnalysis = {
                technicalData: {
                    lufsIntegrated: -10,    // Problema: muito alto
                    truePeakDbtp: 0.5,      // Problema: clipping
                    dynamicRange: 3,        // Problema: muito baixo
                    stereoCorrelation: -0.8  // Problema: mono
                },
                problems: [
                    { metric: 'clipping', severity: 'critical' }
                ] // Array original tem apenas 1
            };
            
            // Contagem ANTES (método original)
            const oldCount = mockAnalysis.problems.length;
            
            // Contagem DEPOIS (método corrigido)
            const newCount = this.countVisualProblems(mockAnalysis);
            
            test.before = { count: oldCount, method: 'problems.length' };
            test.after = { count: newCount, method: 'visual analysis' };
            
            // Validação: deveria ter 4 problemas (todas as métricas estão fora)
            const expectedCount = 4;
            test.passed = (newCount === expectedCount);
            test.expectedCount = expectedCount;
            test.status = test.passed ? 'PASSED' : 'FAILED';
            
            console.log(`   Antes: ${oldCount} | Depois: ${newCount} | Esperado: ${expectedCount}`);
            console.log(`   Resultado: ${test.status}`);
            
        } catch (error) {
            test.status = 'ERROR';
            test.error = error.message;
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🎵 TESTE 3: Subscore de Frequência Monotônico
    async testFrequencySubscoreMonotonicity() {
        console.log('\n🎵 TESTE 3: Validando Monotonicidade do Subscore Frequência');
        
        const test = {
            name: 'Frequency Subscore Monotonicity',
            status: 'running',
            before: {},
            after: {},
            passed: false
        };

        try {
            // Testar diferentes valores de spectralCentroid
            const target = 2500; // Ideal
            const tolerance = 1200;
            const testValues = [2500, 2000, 1500, 1000, 3000, 3500, 4000]; // Afastando do ideal
            
            const scores = [];
            
            for (const value of testValues) {
                const diff = Math.abs(value - target);
                
                // Simular cálculo CORRIGIDO
                let score;
                if (diff <= tolerance) {
                    score = 100;
                } else if (diff <= tolerance * 2) {
                    score = 100 - (50 * ((diff / tolerance) - 1));
                } else {
                    score = 0;
                }
                
                scores.push({ value, diff, score });
            }
            
            // Verificar monotonicidade: maior diferença = menor score
            let isMonotonic = true;
            const idealScore = scores.find(s => s.value === target)?.score || 100;
            
            for (const score of scores) {
                if (score.diff > 0 && score.score > idealScore) {
                    isMonotonic = false;
                    break;
                }
            }
            
            test.after = { scores, isMonotonic };
            test.passed = isMonotonic;
            test.status = test.passed ? 'PASSED' : 'FAILED';
            
            console.log(`   Monotonicidade: ${isMonotonic ? 'SIM' : 'NÃO'}`);
            console.log(`   Resultado: ${test.status}`);
            
        } catch (error) {
            test.status = 'ERROR';
            test.error = error.message;
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🎼 TESTE 4: Bandas Espectrais Diferenciadas
    async testSpectralBandsDifferentiation() {
        console.log('\n🎼 TESTE 4: Validando Diferenciação de Bandas Espectrais');
        
        const test = {
            name: 'Spectral Bands Differentiation',
            status: 'running',
            before: {},
            after: {},
            passed: false
        };

        try {
            // Simular dados de bandas realísticos
            const mockBandEnergies = {
                sub: { rms_db: -25.2 },        // Sub-bass típico
                low_bass: { rms_db: -15.8 },   // Bass mais presente  
                mid: { rms_db: -12.3 },        // Mid mais alto
                brilho: { rms_db: -18.7 }      // High-freq moderado
            };
            
            // Simular geração de tonalBalance
            const tonalBalance = {
                sub: mockBandEnergies.sub ? { rms_db: mockBandEnergies.sub.rms_db } : null,
                low: mockBandEnergies.low_bass ? { rms_db: mockBandEnergies.low_bass.rms_db } : null,
                mid: mockBandEnergies.mid ? { rms_db: mockBandEnergies.mid.rms_db } : null,
                high: mockBandEnergies.brilho ? { rms_db: mockBandEnergies.brilho.rms_db } : null
            };
            
            // Verificar se valores são diferentes
            const values = Object.values(tonalBalance)
                .filter(band => band && Number.isFinite(band.rms_db))
                .map(band => band.rms_db);
            
            const allSame = values.every(v => v === values[0]);
            const allDifferent = new Set(values).size === values.length;
            
            test.after = {
                tonalBalance,
                values,
                allSame,
                allDifferent,
                uniqueValues: new Set(values).size
            };
            
            test.passed = !allSame && values.length > 1;
            test.status = test.passed ? 'PASSED' : 'FAILED';
            
            console.log(`   Valores únicos: ${new Set(values).size}/${values.length}`);
            console.log(`   Todos iguais: ${allSame ? 'SIM (PROBLEMA)' : 'NÃO (OK)'}`);
            console.log(`   Resultado: ${test.status}`);
            
        } catch (error) {
            test.status = 'ERROR';
            test.error = error.message;
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🎯 TESTE 5: True-Peak Targets Plausíveis
    async testTruePeakTargetsPlausibility() {
        console.log('\n🎯 TESTE 5: Validando Targets de True-Peak');
        
        const test = {
            name: 'True-Peak Targets Plausibility',
            status: 'running',
            before: {},
            after: {},
            passed: false
        };

        try {
            // Simular dados de referência
            const mockGenres = {
                'eletrofunk': { true_peak_target: -2.5 },  // OK
                'rock': { true_peak_target: -1.0 },        // OK  
                'pop': { true_peak_target: -8.0 },         // PROBLEMA: muito baixo
                'jazz': { true_peak_target: 2.0 }          // PROBLEMA: muito alto
            };
            
            let plausibleCount = 0;
            let totalGenres = Object.keys(mockGenres).length;
            const results = {};
            
            for (const [genre, data] of Object.entries(mockGenres)) {
                const target = data.true_peak_target;
                const isPlausible = (target >= -3.0 && target <= 0.0);
                
                if (isPlausible) plausibleCount++;
                
                results[genre] = {
                    target,
                    isPlausible,
                    recommendation: isPlausible ? 'OK' : 'CORRIGIR para -1.0 dBTP'
                };
            }
            
            test.after = {
                results,
                plausibleCount,
                totalGenres,
                percentage: Math.round((plausibleCount / totalGenres) * 100)
            };
            
            test.passed = (plausibleCount === totalGenres);
            test.status = test.passed ? 'PASSED' : 'NEEDS_CORRECTION';
            
            console.log(`   Plausíveis: ${plausibleCount}/${totalGenres} (${test.after.percentage}%)`);
            console.log(`   Resultado: ${test.status}`);
            
        } catch (error) {
            test.status = 'ERROR';
            test.error = error.message;
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🔧 Função auxiliar: Contagem visual de problemas
    countVisualProblems(analysis) {
        if (!analysis.technicalData) return 0;
        
        let count = 0;
        const td = analysis.technicalData;
        
        // Definir métricas e tolerâncias padrão
        const metrics = [
            { key: 'lufsIntegrated', target: -14, tol: 1 },
            { key: 'truePeakDbtp', target: -1, tol: 1 },
            { key: 'dynamicRange', target: 10, tol: 3 },
            { key: 'stereoCorrelation', target: 0.3, tol: 0.15 }
        ];
        
        for (const metric of metrics) {
            const value = td[metric.key];
            if (Number.isFinite(value)) {
                const diff = Math.abs(value - metric.target);
                if (diff > metric.tol) {
                    count++;
                }
            }
        }
        
        return count;
    }

    // 🚀 Executar todos os testes
    async runAllValidations() {
        console.log('🚀 EXECUTANDO TODAS AS VALIDAÇÕES');
        console.log('=' .repeat(60));
        
        const validators = [
            () => this.testColorSuggestionConsistency(),
            () => this.testProblemCountAccuracy(),
            () => this.testFrequencySubscoreMonotonicity(), 
            () => this.testSpectralBandsDifferentiation(),
            () => this.testTruePeakTargetsPlausibility()
        ];
        
        for (const validator of validators) {
            try {
                await validator();
            } catch (error) {
                console.error('Erro durante validação:', error);
            }
        }
        
        this.generateValidationReport();
    }

    // 📊 Gerar relatório de validação
    generateValidationReport() {
        console.log('\n📊 RELATÓRIO DE VALIDAÇÃO DAS CORREÇÕES');
        console.log('=' .repeat(60));
        
        const summary = {
            total: this.testResults.length,
            passed: this.testResults.filter(t => t.status === 'PASSED').length,
            failed: this.testResults.filter(t => t.status === 'FAILED').length,
            needsCorrection: this.testResults.filter(t => t.status === 'NEEDS_CORRECTION').length,
            errors: this.testResults.filter(t => t.status === 'ERROR').length
        };
        
        console.log(`📈 RESUMO:`);
        console.log(`  Total de testes: ${summary.total}`);
        console.log(`  ✅ Passou: ${summary.passed}`);
        console.log(`  ❌ Falhou: ${summary.failed}`);
        console.log(`  🔧 Precisa correção: ${summary.needsCorrection}`);
        console.log(`  ⚠️ Erros: ${summary.errors}`);
        
        const successRate = Math.round((summary.passed / summary.total) * 100);
        console.log(`  📊 Taxa de sucesso: ${successRate}%`);
        
        console.log('\n🔍 DETALHES POR TESTE:');
        this.testResults.forEach((test, i) => {
            const statusIcon = {
                'PASSED': '✅',
                'FAILED': '❌', 
                'NEEDS_CORRECTION': '🔧',
                'ERROR': '⚠️'
            }[test.status] || '❓';
            
            console.log(`${i+1}. ${statusIcon} ${test.name}`);
            
            if (test.score) {
                console.log(`    Score: ${test.score}`);
            }
            
            if (test.error) {
                console.log(`    Erro: ${test.error}`);
            }
        });
        
        // Recomendações baseadas nos resultados
        this.generateRecommendations(summary);
        
        return {
            summary,
            details: this.testResults,
            successRate
        };
    }

    // 💡 Gerar recomendações baseadas nos testes
    generateRecommendations(summary) {
        console.log('\n💡 RECOMENDAÇÕES:');
        
        if (summary.passed === summary.total) {
            console.log('🎉 Todas as correções validadas com sucesso!');
            console.log('📝 Pronto para implementar as correções no código.');
        } else {
            console.log('🔧 Correções necessárias identificadas:');
            
            this.testResults.forEach(test => {
                if (test.status !== 'PASSED') {
                    switch (test.name) {
                        case 'Color vs Suggestion Consistency':
                            console.log('  • Implementar unificação de lógica cor/sugestão');
                            break;
                        case 'Problem Count Accuracy':
                            console.log('  • Implementar contagem visual de problemas');
                            break;
                        case 'Frequency Subscore Monotonicity':
                            console.log('  • Corrigir cálculo de subscore de frequência');
                            break;
                        case 'Spectral Bands Differentiation':
                            console.log('  • Verificar geração de tonalBalance');
                            break;
                        case 'True-Peak Targets Plausibility':
                            console.log('  • Corrigir dados de referência implausíveis');
                            break;
                    }
                }
            });
        }
        
        console.log('\n🛡️ PRÓXIMOS PASSOS:');
        console.log('  1. Implementar correções identificadas');
        console.log('  2. Re-executar validações após cada correção');
        console.log('  3. Testar com áudios reais');
        console.log('  4. Verificar que sistema existente não quebrou');
    }
}

// 🎯 Executar validação se no browser
if (typeof window !== 'undefined') {
    window.CorrectionValidator = CorrectionValidator;
    
    // Função para executar validação manualmente
    window.runCorrectionValidation = async function() {
        const validator = new CorrectionValidator();
        return await validator.runAllValidations();
    };
    
    console.log('🧪 CorrectionValidator carregado. Execute window.runCorrectionValidation() para iniciar.');
} else {
    module.exports = CorrectionValidator;
}
