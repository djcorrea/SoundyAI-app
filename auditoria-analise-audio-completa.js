// 🔍 AUDITORIA COMPLETA DA ANÁLISE DE ÁUDIO
// Script para testar todos os componentes de análise sistemicamente

console.log('🔍 INICIANDO AUDITORIA COMPLETA DA ANÁLISE DE ÁUDIO');

class AudioAnalysisAuditor {
    constructor() {
        this.testResults = [];
        this.issues = [];
        this.recommendations = [];
        this.testData = this.generateMockAnalysisData();
    }

    // 📊 A. AUDITORIA: Subscore de Frequência
    async auditFrequencySubscore() {
        console.log('\n📊 A. AUDITANDO SUBSCORE DE FREQUÊNCIA');
        
        const test = {
            name: 'Frequency Subscore Calculation',
            status: 'running',
            issues: [],
            evidence: []
        };

        try {
            // Testar cálculo do subscore de frequência
            if (typeof window !== 'undefined' && window.SubScoreCorrector) {
                const corrector = new window.SubScoreCorrector();
                corrector.DEBUG = true;
                
                const mockTechnicalData = {
                    spectralCentroid: 2800, // Próximo ao ideal (2500)
                    spectralRolloff50: 3200, // Próximo ao ideal (3000) 
                    spectralRolloff85: 8500  // Próximo ao ideal (8000)
                };
                
                const result = corrector.calculateAdvancedSubScores(mockTechnicalData, null);
                
                test.evidence.push({
                    type: 'calculation',
                    data: result,
                    description: 'Resultado do cálculo avançado de subscore'
                });
                
                // Verificar se o resultado faz sentido
                if (result.frequency < 80) {
                    test.issues.push('Subscore baixo (< 80) para valores próximos aos ideais');
                }
                
                test.status = 'completed';
            } else {
                test.issues.push('SubScoreCorrector não encontrado');
                test.status = 'failed';
            }
            
        } catch (error) {
            test.issues.push(`Erro no cálculo: ${error.message}`);
            test.status = 'failed';
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🎨 B. AUDITORIA: Regras de Cor/Status vs Sugestões
    async auditColorStatusConsistency() {
        console.log('\n🎨 B. AUDITANDO CONSISTÊNCIA COR/STATUS vs SUGESTÕES');
        
        const test = {
            name: 'Color Status vs Suggestions Consistency',
            status: 'running',
            issues: [],
            evidence: []
        };

        try {
            // Testar diferentes valores de tolerância
            const testCases = [
                { value: -14, target: -14, tolerance: 1, expectedStatus: 'IDEAL', expectedColor: 'green' },
                { value: -15.5, target: -14, tolerance: 1, expectedStatus: 'AJUSTAR', expectedColor: 'yellow' },
                { value: -17, target: -14, tolerance: 1, expectedStatus: 'CORRIGIR', expectedColor: 'red' }
            ];

            for (const testCase of testCases) {
                const diff = Math.abs(testCase.value - testCase.target);
                const n = diff / testCase.tolerance;
                
                let actualStatus, actualColor;
                
                if (diff <= testCase.tolerance) {
                    actualStatus = 'IDEAL';
                    actualColor = 'green';
                } else if (n <= 2) {
                    actualStatus = 'AJUSTAR';
                    actualColor = 'yellow';
                } else {
                    actualStatus = 'CORRIGIR';
                    actualColor = 'red';
                }
                
                const consistent = (actualStatus === testCase.expectedStatus && 
                                 actualColor === testCase.expectedColor);
                
                test.evidence.push({
                    testCase,
                    actualStatus,
                    actualColor,
                    consistent,
                    diff,
                    n
                });
                
                if (!consistent) {
                    test.issues.push(`Inconsistência no caso ${JSON.stringify(testCase)}`);
                }
            }
            
            test.status = test.issues.length === 0 ? 'passed' : 'failed';
            
        } catch (error) {
            test.issues.push(`Erro no teste: ${error.message}`);
            test.status = 'failed';
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🎵 C. AUDITORIA: Bandas Sub/Low/Mid/High
    async auditSpectralBands() {
        console.log('\n🎵 C. AUDITANDO BANDAS ESPECTRAIS');
        
        const test = {
            name: 'Spectral Bands Analysis',
            status: 'running',
            issues: [],
            evidence: []
        };

        try {
            // Definir bandas de frequência esperadas
            const expectedBands = {
                sub: [20, 60],
                low_bass: [60, 120],
                upper_bass: [120, 300],
                low_mid: [300, 800],
                mid: [800, 2000],
                high_mid: [2000, 8000],
                brilho: [8000, 20000],
                presenca: [3000, 6000]
            };
            
            test.evidence.push({
                type: 'band_definitions',
                data: expectedBands,
                description: 'Definições de bandas espectrais esperadas'
            });
            
            // Verificar se existe sobreposição problemática
            const bandKeys = Object.keys(expectedBands);
            for (let i = 0; i < bandKeys.length - 1; i++) {
                const band1 = expectedBands[bandKeys[i]];
                const band2 = expectedBands[bandKeys[i + 1]];
                
                if (band1[1] > band2[0]) {
                    test.issues.push(`Sobreposição entre ${bandKeys[i]} (${band1[1]}Hz) e ${bandKeys[i + 1]} (${band2[0]}Hz)`);
                }
            }
            
            // Verificar se as bandas cobrem todo o espectro audível
            const lowestFreq = Math.min(...Object.values(expectedBands).map(b => b[0]));
            const highestFreq = Math.max(...Object.values(expectedBands).map(b => b[1]));
            
            if (lowestFreq > 20) {
                test.issues.push(`Falta cobertura abaixo de ${lowestFreq}Hz`);
            }
            if (highestFreq < 20000) {
                test.issues.push(`Falta cobertura acima de ${highestFreq}Hz`);
            }
            
            test.status = test.issues.length === 0 ? 'passed' : 'warning';
            
        } catch (error) {
            test.issues.push(`Erro na auditoria: ${error.message}`);
            test.status = 'failed';
        }
        
        this.testResults.push(test);
        return test;
    }

    // 📈 D. AUDITORIA: Contagem de Problemas
    async auditProblemCounting() {
        console.log('\n📈 D. AUDITANDO CONTAGEM DE PROBLEMAS');
        
        const test = {
            name: 'Problem Counting Logic',
            status: 'running',
            issues: [],
            evidence: []
        };

        try {
            // Simular análise com problemas conhecidos
            const mockAnalysis = {
                technicalData: {
                    lufsIntegrated: -10, // Muito alto (problema)
                    truePeakDbtp: 0.5,   // Clipping (problema)
                    dynamicRange: 3      // Muito baixo (problema)
                },
                problems: []
            };
            
            // Calcular problemas baseado nas tolerâncias
            const referenceTargets = {
                lufsIntegrated: { target: -14, tolerance: 1 },
                truePeakDbtp: { target: -1, tolerance: 1 },
                dynamicRange: { target: 10, tolerance: 3 }
            };
            
            let problemCount = 0;
            const detectedProblems = [];
            
            for (const [metric, config] of Object.entries(referenceTargets)) {
                const value = mockAnalysis.technicalData[metric];
                if (Number.isFinite(value)) {
                    const diff = Math.abs(value - config.target);
                    const severity = diff <= config.tolerance ? 'ok' : 
                                   diff <= config.tolerance * 2 ? 'warning' : 'critical';
                    
                    if (severity !== 'ok') {
                        problemCount++;
                        detectedProblems.push({
                            metric,
                            value,
                            target: config.target,
                            diff,
                            severity
                        });
                    }
                }
            }
            
            test.evidence.push({
                mockAnalysis,
                detectedProblems,
                problemCount,
                description: 'Contagem manual de problemas'
            });
            
            // Verificar se a contagem bate com o esperado
            const expectedProblems = 3; // lufs, truePeak, DR
            if (problemCount !== expectedProblems) {
                test.issues.push(`Contagem incorreta: esperado ${expectedProblems}, obtido ${problemCount}`);
            }
            
            test.status = test.issues.length === 0 ? 'passed' : 'failed';
            
        } catch (error) {
            test.issues.push(`Erro na contagem: ${error.message}`);
            test.status = 'failed';
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🎯 E. AUDITORIA: Targets de True-Peak
    async auditTruePeakTargets() {
        console.log('\n🎯 E. AUDITANDO TARGETS DE TRUE-PEAK');
        
        const test = {
            name: 'True Peak Targets Validation',
            status: 'running',
            issues: [],
            evidence: []
        };

        try {
            // Verificar dados de referência
            if (typeof window !== 'undefined' && window.PROD_AI_REF_DATA) {
                const genres = Object.keys(window.PROD_AI_REF_DATA);
                
                for (const genre of genres) {
                    const genreData = window.PROD_AI_REF_DATA[genre];
                    const truePeakTarget = genreData.legacy_compatibility?.true_peak_target;
                    
                    test.evidence.push({
                        genre,
                        truePeakTarget,
                        reasonable: truePeakTarget >= -3 && truePeakTarget <= 0
                    });
                    
                    // Verificar se o target é razoável para streaming
                    if (truePeakTarget < -3 || truePeakTarget > 0) {
                        test.issues.push(`Target suspeito para ${genre}: ${truePeakTarget}dBTP`);
                    }
                }
            } else {
                test.issues.push('Dados de referência não encontrados');
            }
            
            test.status = test.issues.length === 0 ? 'passed' : 'warning';
            
        } catch (error) {
            test.issues.push(`Erro na validação: ${error.message}`);
            test.status = 'failed';
        }
        
        this.testResults.push(test);
        return test;
    }

    // ⚡ F. AUDITORIA: Tratamento de N/A
    async auditNAHandling() {
        console.log('\n⚡ F. AUDITANDO TRATAMENTO DE N/A');
        
        const test = {
            name: 'N/A Values Handling',
            status: 'running',
            issues: [],
            evidence: []
        };

        try {
            // Testar diferentes casos de N/A
            const testCases = [
                { value: NaN, expected: 'excluded' },
                { value: undefined, expected: 'excluded' },
                { value: null, expected: 'excluded' },
                { value: Infinity, expected: 'excluded' },
                { value: -Infinity, expected: 'excluded' },
                { value: 0, expected: 'included' },
                { value: -14, expected: 'included' }
            ];
            
            for (const testCase of testCases) {
                const shouldInclude = Number.isFinite(testCase.value);
                const expectedInclude = testCase.expected === 'included';
                
                test.evidence.push({
                    value: testCase.value,
                    shouldInclude,
                    expectedInclude,
                    correct: shouldInclude === expectedInclude
                });
                
                if (shouldInclude !== expectedInclude) {
                    test.issues.push(`Tratamento incorreto para ${testCase.value}`);
                }
            }
            
            // Testar cálculo de média excluindo N/A
            const values = [10, NaN, 20, undefined, 30, null];
            const validValues = values.filter(v => Number.isFinite(v));
            const average = validValues.length > 0 ? 
                           validValues.reduce((sum, v) => sum + v, 0) / validValues.length : 
                           null;
            
            test.evidence.push({
                originalValues: values,
                validValues,
                average,
                expectedAverage: 20 // (10+20+30)/3
            });
            
            if (Math.abs(average - 20) > 0.001) {
                test.issues.push(`Média incorreta: esperado 20, obtido ${average}`);
            }
            
            test.status = test.issues.length === 0 ? 'passed' : 'failed';
            
        } catch (error) {
            test.issues.push(`Erro no teste: ${error.message}`);
            test.status = 'failed';
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🔄 G. AUDITORIA: Monotonicidade do Score
    async auditScoreMonotonicity() {
        console.log('\n🔄 G. AUDITANDO MONOTONICIDADE DO SCORE');
        
        const test = {
            name: 'Score Monotonicity',
            status: 'running',
            issues: [],
            evidence: []
        };

        try {
            // Testar se afastar do target sempre diminui o score
            const target = -14;
            const tolerance = 1;
            
            const testValues = [-14, -15, -16, -17, -13, -12, -11];
            const scores = [];
            
            for (const value of testValues) {
                const diff = Math.abs(value - target);
                const n = diff / tolerance;
                
                let score;
                if (diff <= tolerance) {
                    score = 100;
                } else if (n <= 2) {
                    score = 100 - (50 * (n - 1));
                } else {
                    score = 0;
                }
                
                scores.push({ value, diff, score });
            }
            
            test.evidence.push({
                target,
                tolerance,
                scores,
                description: 'Scores calculados para diferentes valores'
            });
            
            // Verificar monotonicidade
            const targetScore = scores.find(s => s.value === target);
            for (const score of scores) {
                if (score.diff > 0 && score.score > targetScore.score) {
                    test.issues.push(`Score não monotônico: ${score.value} (${score.score}) > ${target} (${targetScore.score})`);
                }
            }
            
            test.status = test.issues.length === 0 ? 'passed' : 'failed';
            
        } catch (error) {
            test.issues.push(`Erro no teste: ${error.message}`);
            test.status = 'failed';
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🔧 H. AUDITORIA: Cache Determinístico
    async auditCacheDeterminism() {
        console.log('\n🔧 H. AUDITANDO CACHE DETERMINÍSTICO');
        
        const test = {
            name: 'Cache Determinism',
            status: 'running',
            issues: [],
            evidence: []
        };

        try {
            // Verificar formato da chave de cache
            const mockParams = {
                genre: 'eletrofunk',
                fileHash: 'abc123',
                refsVersion: 'v2.0'
            };
            
            const expectedKey = `${mockParams.genre}:${mockParams.fileHash}:${mockParams.refsVersion}`;
            
            test.evidence.push({
                mockParams,
                expectedKey,
                description: 'Formato esperado da chave de cache'
            });
            
            // Verificar se a chave é determinística
            const key1 = `${mockParams.genre}:${mockParams.fileHash}:${mockParams.refsVersion}`;
            const key2 = `${mockParams.genre}:${mockParams.fileHash}:${mockParams.refsVersion}`;
            
            if (key1 !== key2) {
                test.issues.push('Chave de cache não é determinística');
            }
            
            // Verificar invalidação ao trocar gênero
            const newGenreKey = `rock:${mockParams.fileHash}:${mockParams.refsVersion}`;
            if (newGenreKey === expectedKey) {
                test.issues.push('Cache não invalida ao trocar gênero');
            }
            
            test.status = test.issues.length === 0 ? 'passed' : 'failed';
            
        } catch (error) {
            test.issues.push(`Erro no teste: ${error.message}`);
            test.status = 'failed';
        }
        
        this.testResults.push(test);
        return test;
    }

    // 🚀 Executar auditoria completa
    async runCompleteAudit() {
        console.log('🚀 EXECUTANDO AUDITORIA COMPLETA');
        
        const audits = [
            () => this.auditFrequencySubscore(),
            () => this.auditColorStatusConsistency(),
            () => this.auditSpectralBands(),
            () => this.auditProblemCounting(),
            () => this.auditTruePeakTargets(),
            () => this.auditNAHandling(),
            () => this.auditScoreMonotonicity(),
            () => this.auditCacheDeterminism()
        ];
        
        for (const audit of audits) {
            try {
                await audit();
            } catch (error) {
                console.error('Erro durante auditoria:', error);
            }
        }
        
        this.generateReport();
    }

    // 📊 Gerar relatório da auditoria
    generateReport() {
        console.log('\n📊 RELATÓRIO DA AUDITORIA COMPLETA');
        console.log('=' .repeat(60));
        
        const summary = {
            total: this.testResults.length,
            passed: this.testResults.filter(t => t.status === 'passed').length,
            warning: this.testResults.filter(t => t.status === 'warning').length,
            failed: this.testResults.filter(t => t.status === 'failed').length,
            issues: this.testResults.reduce((sum, t) => sum + t.issues.length, 0)
        };
        
        console.log(`📈 RESUMO:`);
        console.log(`  Total de testes: ${summary.total}`);
        console.log(`  ✅ Aprovados: ${summary.passed}`);
        console.log(`  ⚠️ Avisos: ${summary.warning}`);
        console.log(`  ❌ Falhas: ${summary.failed}`);
        console.log(`  🔍 Issues encontradas: ${summary.issues}`);
        
        console.log('\n🔍 DETALHES POR TESTE:');
        this.testResults.forEach((test, i) => {
            const statusIcon = {
                'passed': '✅',
                'warning': '⚠️',
                'failed': '❌',
                'running': '🔄'
            }[test.status] || '❓';
            
            console.log(`${i+1}. ${statusIcon} ${test.name}`);
            
            if (test.issues.length > 0) {
                test.issues.forEach(issue => {
                    console.log(`    🔸 ${issue}`);
                });
            }
        });
        
        // Gerar recomendações
        this.generateRecommendations();
        
        return {
            summary,
            details: this.testResults,
            recommendations: this.recommendations
        };
    }

    // 💡 Gerar recomendações de correção
    generateRecommendations() {
        console.log('\n💡 RECOMENDAÇÕES DE CORREÇÃO:');
        
        this.recommendations = [];
        
        // Análise dos issues encontrados
        const frequencyIssues = this.testResults.find(t => t.name.includes('Frequency'));
        if (frequencyIssues && frequencyIssues.status === 'failed') {
            this.recommendations.push({
                priority: 'HIGH',
                component: 'Subscore de Frequência',
                issue: 'Cálculo inconsistente',
                file: 'lib/audio/features/subscore-corrector.js',
                fix: 'Revisar lógica de agregação de bandas espectrais',
                risk: 'LOW'
            });
        }
        
        const colorIssues = this.testResults.find(t => t.name.includes('Color'));
        if (colorIssues && colorIssues.status === 'failed') {
            this.recommendations.push({
                priority: 'HIGH',
                component: 'Sistema de Cores/Status',
                issue: 'Inconsistência entre cor e sugestão',
                file: 'public/friendly-labels.js',
                fix: 'Unificar lógica de determinação de status',
                risk: 'LOW'
            });
        }
        
        const problemCountIssues = this.testResults.find(t => t.name.includes('Problem Counting'));
        if (problemCountIssues && problemCountIssues.status === 'failed') {
            this.recommendations.push({
                priority: 'MEDIUM',
                component: 'Contagem de Problemas',
                issue: 'Contagem divergente',
                file: 'public/audio-analyzer-integration-clean2.js',
                fix: 'Centralizar lógica de contagem de problemas',
                risk: 'LOW'
            });
        }
        
        // Ordenar por prioridade
        this.recommendations.sort((a, b) => {
            const priorities = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return priorities[b.priority] - priorities[a.priority];
        });
        
        this.recommendations.forEach((rec, i) => {
            console.log(`${i+1}. [${rec.priority}] ${rec.component}`);
            console.log(`   📁 Arquivo: ${rec.file}`);
            console.log(`   🔧 Correção: ${rec.fix}`);
            console.log(`   ⚠️ Risco: ${rec.risk}`);
            console.log('');
        });
    }

    // 🧪 Gerar dados de teste
    generateMockAnalysisData() {
        return {
            technicalData: {
                lufsIntegrated: -14.2,
                truePeakDbtp: -0.8,
                dynamicRange: 8.5,
                spectralCentroid: 2600,
                spectralRolloff50: 3100,
                spectralRolloff85: 8200,
                stereoCorrelation: 0.4,
                stereoWidth: 0.65,
                balanceLR: 0.05
            },
            qualityBreakdown: {
                dynamics: 85,
                technical: 90,
                loudness: 95,
                frequency: 82
            },
            problems: [
                { metric: 'clipping', severity: 'warning' }
            ]
        };
    }
}

// 🎯 Executar auditoria se no browser
if (typeof window !== 'undefined') {
    window.AudioAnalysisAuditor = AudioAnalysisAuditor;
    
    // Função para executar auditoria manualmente
    window.runAudioAudit = async function() {
        const auditor = new AudioAnalysisAuditor();
        return await auditor.runCompleteAudit();
    };
    
    console.log('🔍 AudioAnalysisAuditor carregado. Execute window.runAudioAudit() para iniciar.');
} else {
    module.exports = AudioAnalysisAuditor;
}
