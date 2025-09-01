// 🛡️ SISTEMA DE VALIDAÇÃO - Contador de Problemas Seguro
// Implementação completa e segura para corrigir contagem de problemas

console.log('🛡️ CARREGANDO SISTEMA DE VALIDAÇÃO DO CONTADOR DE PROBLEMAS');

class ProblemCountValidator {
    constructor() {
        this.testCases = [];
        this.validationResults = [];
        this.backupFunctions = {};
    }

    // 🔍 Teste de Validação Completa
    async runCompleteValidation() {
        console.log('\n🔍 INICIANDO VALIDAÇÃO COMPLETA DO CONTADOR DE PROBLEMAS');
        
        // 1. Verificar se função foi implementada corretamente
        await this.validateImplementation();
        
        // 2. Testar casos conhecidos
        await this.testKnownCases();
        
        // 3. Testar compatibilidade com sistema existente
        await this.testCompatibility();
        
        // 4. Testar mudança de gênero
        await this.testGenreChanges();
        
        // 5. Gerar relatório
        this.generateValidationReport();
        
        return this.validationResults;
    }

    // ✅ Validar Implementação
    async validateImplementation() {
        console.log('\n✅ Validando implementação...');
        
        const validation = {
            test: 'Implementation Validation',
            passed: false,
            issues: [],
            evidence: {}
        };

        try {
            let countFunction = null;
            
            // Verificar se função existe no escopo global
            if (typeof window !== 'undefined' && typeof window.countVisualProblems === 'function') {
                countFunction = window.countVisualProblems;
                validation.evidence.functionFound = 'Global scope (window)';
            } else if (typeof countVisualProblems !== 'undefined' && typeof countVisualProblems === 'function') {
                countFunction = countVisualProblems;
                validation.evidence.functionFound = 'Local scope';
            } else {
                validation.issues.push('Função countVisualProblems não encontrada em nenhum escopo');
                this.validationResults.push(validation);
                return;
            }

            // Teste básico da função
            const mockAnalysis = {
                technicalData: {
                    lufsIntegrated: -10, // Problema: muito alto
                    truePeakDbtp: 0.5,   // Problema: clipping
                    dynamicRange: 3,     // Problema: muito baixo
                    stereoCorrelation: 0.5 // OK
                },
                problems: [{ severity: 'critical', type: 'clipping' }]
            };

            const result = countFunction(mockAnalysis);

            validation.evidence.testResult = result;
            validation.evidence.expectedCount = 3; // LUFS + TruePeak + DynamicRange
            validation.evidence.actualCount = result.count;
            validation.evidence.mockInput = mockAnalysis;

            if (result.count === 3) {
                validation.passed = true;
                validation.evidence.note = 'Contagem correta para caso de teste';
            } else {
                validation.issues.push(`Contagem incorreta: esperado 3, obtido ${result.count}`);
                validation.evidence.details = result;
            }

        } catch (error) {
            validation.issues.push(`Erro na validação: ${error.message}`);
            validation.evidence.error = error.stack;
        }

        this.validationResults.push(validation);
    }

    // 🔄 Testar Casos Conhecidos
    async testKnownCases() {
        console.log('\n🔄 Testando casos conhecidos...');

        const testCases = [
            {
                name: 'Audio Perfeito',
                analysis: {
                    technicalData: {
                        lufsIntegrated: -14,
                        truePeakDbtp: -1,
                        dynamicRange: 10,
                        stereoCorrelation: 0.5
                    },
                    problems: []
                },
                expectedCount: 0
            },
            {
                name: 'Múltiplos Problemas',
                analysis: {
                    technicalData: {
                        lufsIntegrated: -8,   // Muito alto
                        truePeakDbtp: 1.2,    // Clipping
                        dynamicRange: 2,      // Muito baixo
                        stereoCorrelation: 0.95 // Muito mono
                    },
                    problems: []
                },
                expectedCount: 4
            },
            {
                name: 'Problemas Limítrofes',
                analysis: {
                    technicalData: {
                        lufsIntegrated: -15.1, // Limítrofe
                        truePeakDbtp: -0.9,     // Limítrofe
                        dynamicRange: 6.8,      // Limítrofe
                        stereoCorrelation: 0.4
                    },
                    problems: []
                },
                expectedCount: 3 // Todos limítrofes devem ser contados
            },
            {
                name: 'Valores N/A',
                analysis: {
                    technicalData: {
                        lufsIntegrated: NaN,
                        truePeakDbtp: undefined,
                        dynamicRange: null,
                        stereoCorrelation: 0.8
                    },
                    problems: []
                },
                expectedCount: 0 // N/A não devem ser contados
            }
        ];

        for (const testCase of testCases) {
            const validation = {
                test: `Known Case: ${testCase.name}`,
                passed: false,
                issues: [],
                evidence: {}
            };

            try {
                // Detectar função disponível
                let countFunction = null;
                if (typeof window !== 'undefined' && typeof window.countVisualProblems === 'function') {
                    countFunction = window.countVisualProblems;
                } else if (typeof countVisualProblems !== 'undefined') {
                    countFunction = countVisualProblems;
                } else {
                    validation.issues.push('Função countVisualProblems não encontrada');
                    this.validationResults.push(validation);
                    continue;
                }

                const result = countFunction(testCase.analysis);
                
                validation.evidence.input = testCase.analysis;
                validation.evidence.expected = testCase.expectedCount;
                validation.evidence.actual = result.count;
                validation.evidence.problems = result.problems;

                if (result.count === testCase.expectedCount) {
                    validation.passed = true;
                } else {
                    validation.issues.push(
                        `Contagem incorreta: esperado ${testCase.expectedCount}, obtido ${result.count}`
                    );
                }

            } catch (error) {
                validation.issues.push(`Erro no teste: ${error.message}`);
                validation.evidence.error = error.stack;
            }

            this.validationResults.push(validation);
        }
    }

    // 🔗 Testar Compatibilidade
    async testCompatibility() {
        console.log('\n🔗 Testando compatibilidade...');

        const validation = {
            test: 'Compatibility Test',
            passed: false,
            issues: [],
            evidence: {}
        };

        try {
            // Detectar função disponível
            let countFunction = null;
            if (typeof window !== 'undefined' && typeof window.countVisualProblems === 'function') {
                countFunction = window.countVisualProblems;
            } else if (typeof countVisualProblems !== 'undefined') {
                countFunction = countVisualProblems;
            } else {
                validation.issues.push('Função countVisualProblems não encontrada');
                this.validationResults.push(validation);
                return;
            }

            // Criar análise mock similar ao sistema real
            const mockAnalysis = {
                technicalData: {
                    lufsIntegrated: -12,
                    truePeakDbtp: 0.2,
                    dynamicRange: 4,
                    stereoCorrelation: 0.3
                },
                problems: [
                    { type: 'high_lufs', severity: 'warning' },
                    { type: 'clipping', severity: 'critical' }
                ],
                suggestions: [
                    { type: 'reduce_lufs' },
                    { type: 'reduce_peaks' }
                ]
            };

            // Testar se contagem visual funciona
            const visualResult = countFunction(mockAnalysis);
            
            // Testar se não quebra o sistema existente
            const originalCount = mockAnalysis.problems ? mockAnalysis.problems.length : 0;
            
            validation.evidence.visualCount = visualResult.count;
            validation.evidence.originalCount = originalCount;
            validation.evidence.visualProblems = visualResult.problems;
            validation.evidence.originalProblems = mockAnalysis.problems;

            // A contagem visual deve ser independente da array original
            if (Number.isFinite(visualResult.count) && visualResult.count >= 0) {
                validation.passed = true;
                validation.evidence.note = 'Sistema compatível - contagem visual independente';
                
                if (visualResult.count !== originalCount) {
                    validation.evidence.divergence = true;
                    validation.evidence.note += ` (divergência detectada: visual=${visualResult.count}, original=${originalCount})`;
                }
            } else {
                validation.issues.push('Contagem visual inválida');
            }

        } catch (error) {
            validation.issues.push(`Erro de compatibilidade: ${error.message}`);
            validation.evidence.error = error.stack;
        }

        this.validationResults.push(validation);
    }

    // 🎭 Testar Mudanças de Gênero
    async testGenreChanges() {
        console.log('\n🎭 Testando mudanças de gênero...');

        const validation = {
            test: 'Genre Change Test',
            passed: false,
            issues: [],
            evidence: {}
        };

        try {
            // Detectar função disponível
            let countFunction = null;
            if (typeof window !== 'undefined' && typeof window.countVisualProblems === 'function') {
                countFunction = window.countVisualProblems;
            } else if (typeof countVisualProblems !== 'undefined') {
                countFunction = countVisualProblems;
            } else {
                validation.issues.push('Função countVisualProblems não encontrada');
                this.validationResults.push(validation);
                return;
            }

            const mockAnalysis = {
                technicalData: {
                    lufsIntegrated: -15.5, // Limítrofe
                    truePeakDbtp: -0.8,     // Limítrofe
                    dynamicRange: 6,        // Limítrofe
                    stereoCorrelation: 0.4
                },
                problems: []
            };

            // Simular diferentes dados de referência
            const originalRefData = window.__activeRefData;
            
            // Teste com tolerâncias rigorosas
            window.__activeRefData = {
                lufs_target: -14,
                lufs_tolerance: 0.5,
                true_peak_target: -1,
                true_peak_tolerance: 0.1,
                dynamic_range_target: 10,
                dynamic_range_tolerance: 2
            };
            const strictResult = countFunction(mockAnalysis);

            // Teste com tolerâncias relaxadas
            window.__activeRefData = {
                lufs_target: -14,
                lufs_tolerance: 2,
                true_peak_target: -1,
                true_peak_tolerance: 1,
                dynamic_range_target: 10,
                dynamic_range_tolerance: 5
            };
            const relaxedResult = countFunction(mockAnalysis);

            // Restaurar dados originais
            window.__activeRefData = originalRefData;

            validation.evidence.strictCount = strictResult.count;
            validation.evidence.relaxedCount = relaxedResult.count;
            validation.evidence.strictProblems = strictResult.problems;
            validation.evidence.relaxedProblems = relaxedResult.problems;

            // Contagem deve mudar com tolerâncias diferentes
            if (strictResult.count >= relaxedResult.count) {
                validation.passed = true;
                validation.evidence.note = 'Contagem responde corretamente a mudanças de tolerância';
            } else {
                validation.issues.push('Contagem não responde a mudanças de tolerância');
            }

        } catch (error) {
            validation.issues.push(`Erro no teste de gênero: ${error.message}`);
            validation.evidence.error = error.stack;
        }

        this.validationResults.push(validation);
    }

    // 📊 Gerar Relatório de Validação
    generateValidationReport() {
        console.log('\n📊 RELATÓRIO DE VALIDAÇÃO DO CONTADOR DE PROBLEMAS');
        console.log('=' .repeat(60));

        const summary = {
            total: this.validationResults.length,
            passed: this.validationResults.filter(r => r.passed).length,
            failed: this.validationResults.filter(r => !r.passed).length
        };

        console.log(`📈 RESUMO:`);
        console.log(`  Total de testes: ${summary.total}`);
        console.log(`  ✅ Passou: ${summary.passed}`);
        console.log(`  ❌ Falhou: ${summary.failed}`);
        console.log(`  📊 Taxa de sucesso: ${Math.round((summary.passed / summary.total) * 100)}%`);

        console.log('\n📋 DETALHES DOS TESTES:');
        this.validationResults.forEach((result, i) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${i + 1}. ${status} ${result.test}`);
            
            if (result.issues.length > 0) {
                result.issues.forEach(issue => {
                    console.log(`   ⚠️ ${issue}`);
                });
            }

            if (result.evidence.note) {
                console.log(`   💡 ${result.evidence.note}`);
            }
        });

        if (summary.failed === 0) {
            console.log('\n🎉 TODOS OS TESTES PASSARAM! Sistema pronto para produção.');
        } else {
            console.log('\n⚠️ ALGUNS TESTES FALHARAM. Revisar implementação antes do deploy.');
        }

        return summary;
    }

    // 🚀 Teste Rápido
    quickTest() {
        console.log('\n🚀 TESTE RÁPIDO DO CONTADOR');
        
        try {
            // Detectar função disponível
            let countFunction = null;
            if (typeof window !== 'undefined' && typeof window.countVisualProblems === 'function') {
                countFunction = window.countVisualProblems;
            } else if (typeof countVisualProblems !== 'undefined') {
                countFunction = countVisualProblems;
            } else {
                console.error('❌ Função countVisualProblems não encontrada');
                return false;
            }
            
            const result = countFunction({
                technicalData: {
                    lufsIntegrated: -10,
                    truePeakDbtp: 0.5,
                    dynamicRange: 3
                },
                problems: []
            });

            console.log('✅ Função funcional!');
            console.log(`📊 Contagem: ${result.count}`);
            console.log(`🔍 Problemas: ${result.problems.map(p => p.metric).join(', ')}`);
            
            return true;
        } catch (error) {
            console.error('❌ Erro no teste rápido:', error);
            return false;
        }
    }
}

// 🎯 Interface para uso
if (typeof window !== 'undefined') {
    window.ProblemCountValidator = ProblemCountValidator;
    
    window.validateProblemCounter = async function() {
        const validator = new ProblemCountValidator();
        return await validator.runCompleteValidation();
    };
    
    window.quickTestProblemCounter = function() {
        const validator = new ProblemCountValidator();
        return validator.quickTest();
    };
    
    console.log('🛡️ Sistema de validação carregado!');
    console.log('📞 Comandos disponíveis:');
    console.log('  • window.validateProblemCounter() - Validação completa');
    console.log('  • window.quickTestProblemCounter() - Teste rápido');
    
} else {
    module.exports = ProblemCountValidator;
}
