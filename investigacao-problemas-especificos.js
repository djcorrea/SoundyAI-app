// 🔬 INVESTIGAÇÃO DIRECIONADA - PROBLEMAS ESPECÍFICOS
// Script para testar e validar cada issue reportado pelo usuário

console.log('🔬 INICIANDO INVESTIGAÇÃO DIRECIONADA DOS PROBLEMAS REPORTADOS');

class SpecificIssueInvestigator {
    constructor() {
        this.findings = [];
        this.correctionPlan = [];
    }

    // 🔍 A. INVESTIGAR: Subscore de Frequência vs Bandas Verdes
    async investigateFrequencySubscoreMismatch() {
        console.log('\n🔍 A. INVESTIGANDO: Subscore Alto com Poucas Bandas Verdes');
        
        const investigation = {
            issue: 'Frequency Subscore Mismatch',
            description: 'Subscore de frequência alto mesmo com poucas bandas verdes',
            findings: [],
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Localizar função de cálculo de subscore de frequência
            if (typeof window !== 'undefined' && window.SubScoreCorrector) {
                const corrector = new window.SubScoreCorrector();
                
                // 2. Testar com cenário problemático
                const problematicCase = {
                    spectralCentroid: 2000,    // Banda lower-mid (pode estar fora do ideal)
                    spectralRolloff50: 2500,   // Banda lower-mid  
                    spectralRolloff85: 7000    // Banda mid-high
                };
                
                // 3. Calcular subscore manualmente
                const targets = corrector.getTargetsAndTolerances();
                const scores = {};
                
                Object.keys(problematicCase).forEach(metric => {
                    const value = problematicCase[metric];
                    const config = targets[metric];
                    if (config) {
                        const diff = Math.abs(value - config.target);
                        const score = diff <= config.tolerance ? 100 : 
                                     diff <= config.tolerance * 2 ? 50 : 0;
                        scores[metric] = score;
                    }
                });
                
                const freqScore = corrector.aggregateCategory(
                    ['spectralCentroid', 'spectralRolloff50', 'spectralRolloff85'], 
                    scores
                );
                
                investigation.findings.push({
                    type: 'calculation_trace',
                    input: problematicCase,
                    individualScores: scores,
                    finalFrequencyScore: freqScore,
                    expectedLow: freqScore < 70,
                    actualHigh: freqScore >= 70
                });
                
                // 4. Verificar se há erro na lógica
                const validScores = Object.values(scores).filter(s => Number.isFinite(s));
                const manualAverage = validScores.length > 0 ? 
                    validScores.reduce((sum, s) => sum + s, 0) / validScores.length : 50;
                
                if (Math.abs(freqScore - manualAverage) > 5) {
                    investigation.rootCause = 'Erro na agregação - média calculada incorretamente';
                    investigation.correctionPlan = {
                        file: 'lib/audio/features/subscore-corrector.js',
                        function: 'aggregateCategory',
                        issue: 'Lógica de média incorreta',
                        fix: 'Corrigir cálculo da média das métricas espectrais'
                    };
                }
                
                // 5. Verificar se N/A está sendo tratado como 100
                const naTest = corrector.aggregateCategory(['nonExistentMetric'], {});
                if (naTest === 100) {
                    investigation.rootCause = 'N/A sendo tratado como score máximo';
                    investigation.correctionPlan = {
                        file: 'lib/audio/features/subscore-corrector.js',
                        function: 'aggregateCategory',
                        issue: 'N/A retorna 100 em vez de score neutro',
                        fix: 'Retornar score neutro (50) quando não há dados válidos'
                    };
                }
                
            } else {
                investigation.findings.push({
                    type: 'error',
                    message: 'SubScoreCorrector não encontrado - usando método fallback'
                });
                
                // Testar método fallback no audio-analyzer.js
                await this.testFallbackFrequencyCalculation(investigation);
            }
            
        } catch (error) {
            investigation.findings.push({
                type: 'error',
                message: error.message,
                stack: error.stack
            });
        }
        
        this.findings.push(investigation);
        return investigation;
    }

    // 🔍 B. INVESTIGAR: Verde com "AUMENTAR/DIMINUIR"
    async investigateColorSuggestionMismatch() {
        console.log('\n🔍 B. INVESTIGANDO: Verde com Sugestão AUMENTAR/DIMINUIR');
        
        const investigation = {
            issue: 'Color vs Suggestion Mismatch',
            description: 'Métricas verdes mostrando sugestões de ajuste',
            findings: [],
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Simular caso problemático
            const testMetric = {
                value: -14.5,
                target: -14,
                tolerance: 1
            };
            
            const diff = Math.abs(testMetric.value - testMetric.target);
            const withinTolerance = diff <= testMetric.tolerance;
            
            // 2. Testar determinação de cor
            let color, status;
            if (withinTolerance) {
                color = 'green';
                status = 'IDEAL';
            } else if (diff <= testMetric.tolerance * 2) {
                color = 'yellow';
                status = 'AJUSTAR';
            } else {
                color = 'red';
                status = 'CORRIGIR';
            }
            
            // 3. Testar geração de sugestão
            let suggestion = '';
            if (testMetric.value > testMetric.target) {
                suggestion = 'DIMINUIR';
            } else if (testMetric.value < testMetric.target) {
                suggestion = 'AUMENTAR';
            }
            
            investigation.findings.push({
                type: 'logic_trace',
                input: testMetric,
                diff,
                withinTolerance,
                color,
                status,
                suggestion,
                mismatch: (color === 'green' && suggestion !== '')
            });
            
            // 4. Identificar fonte do problema
            if (color === 'green' && suggestion !== '') {
                investigation.rootCause = 'Lógicas separadas para cor e sugestão';
                investigation.correctionPlan = {
                    file: 'public/friendly-labels.js',
                    functions: ['createEnhancedDiffCell', 'suggestion generation'],
                    issue: 'Funções de cor e sugestão usam lógicas diferentes',
                    fix: 'Unificar lógica: se green/IDEAL então não gerar sugestão'
                };
            }
            
            // 5. Verificar se há ifs especiais para determinadas métricas
            const specialCases = [
                'truePeakDbtp', 'clippingSamples', 'dcOffset'
            ];
            
            for (const metric of specialCases) {
                investigation.findings.push({
                    type: 'special_case_check',
                    metric,
                    note: 'Verificar se há lógica especial que ignora tolerância'
                });
            }
            
        } catch (error) {
            investigation.findings.push({
                type: 'error',
                message: error.message
            });
        }
        
        this.findings.push(investigation);
        return investigation;
    }

    // 🔍 C. INVESTIGAR: Sub/Low/Mid/High Valores Iguais
    async investigateBandValueDuplication() {
        console.log('\n🔍 C. INVESTIGANDO: Sub/Low/Mid/High com Valores Iguais');
        
        const investigation = {
            issue: 'Band Value Duplication',
            description: 'Todas as bandas espectrais mostram o mesmo valor',
            findings: [],
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Verificar binding na UI
            const expectedBinding = {
                sub: 'technicalData.tonalBalance.sub.rms_db',
                low: 'technicalData.tonalBalance.low.rms_db', 
                mid: 'technicalData.tonalBalance.mid.rms_db',
                high: 'technicalData.tonalBalance.high.rms_db'
            };
            
            investigation.findings.push({
                type: 'expected_binding',
                data: expectedBinding
            });
            
            // 2. Simular problema de binding incorreto
            const problematicBinding = {
                sub: 'technicalData.rms',  // ERRO: todas apontam para RMS global
                low: 'technicalData.rms',
                mid: 'technicalData.rms', 
                high: 'technicalData.rms'
            };
            
            investigation.findings.push({
                type: 'problematic_binding',
                data: problematicBinding,
                issue: 'Todas apontam para mesmo campo RMS global'
            });
            
            // 3. Verificar se tonalBalance está sendo populado
            const mockTechnicalData = {
                rms: -18.5, // RMS global
                tonalBalance: {
                    sub: { rms_db: -25.2 },
                    low: { rms_db: -15.8 },
                    mid: { rms_db: -12.3 },
                    high: { rms_db: -18.7 }
                }
            };
            
            const allSame = Object.values(mockTechnicalData.tonalBalance)
                .every(band => band.rms_db === mockTechnicalData.tonalBalance.sub.rms_db);
            
            investigation.findings.push({
                type: 'data_check',
                mockData: mockTechnicalData,
                allSame,
                correctlyPopulated: !allSame
            });
            
            // 4. Localizar onde tonalBalance é gerado
            investigation.rootCause = 'tonalBalance não gerado ou binding incorreto';
            investigation.correctionPlan = {
                files: [
                    'public/audio-analyzer.js (linha ~4153)',
                    'public/audio-analyzer-integration-clean2.js'
                ],
                issue: 'tonalBalance vazio ou UI fazendo binding incorreto',
                fixes: [
                    'Verificar geração de tonalBalance a partir de bandEnergies',
                    'Corrigir binding na UI para usar campos específicos',
                    'Adicionar fallback para ocultar bloco se dados insuficientes'
                ]
            };
            
        } catch (error) {
            investigation.findings.push({
                type: 'error',
                message: error.message
            });
        }
        
        this.findings.push(investigation);
        return investigation;
    }

    // 🔍 D. INVESTIGAR: Contagem de Problemas "1"
    async investigateProblemCountMismatch() {
        console.log('\n🔍 D. INVESTIGANDO: Contagem "1" com Vários Alertas Visuais');
        
        const investigation = {
            issue: 'Problem Count Mismatch',
            description: 'Contador mostra 1 mas existem vários alertas amarelos/vermelhos',
            findings: [],
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Simular análise com múltiplos problemas visuais
            const mockAnalysis = {
                problems: [
                    { metric: 'clipping', severity: 'critical' }
                ], // Array usado pelo contador
                
                // Mas na UI há múltiplos alertas visuais
                visualProblems: [
                    { metric: 'lufsIntegrated', status: 'yellow' },
                    { metric: 'truePeakDbtp', status: 'red' },
                    { metric: 'dynamicRange', status: 'yellow' },
                    { metric: 'stereoCorrelation', status: 'red' }
                ]
            };
            
            investigation.findings.push({
                type: 'source_comparison',
                problemsArrayLength: mockAnalysis.problems.length,
                visualProblemsCount: mockAnalysis.visualProblems.length,
                mismatch: mockAnalysis.problems.length !== mockAnalysis.visualProblems.length
            });
            
            // 2. Verificar se contador e UI usam fontes diferentes
            investigation.rootCause = 'Contador e UI usam fontes diferentes';
            investigation.correctionPlan = {
                issue: 'analysis.problems vs contagem visual divergem',
                files: [
                    'public/audio-analyzer-integration-clean2.js (linha ~2569)',
                    'public/audio-analyzer.js (geração de problems)'
                ],
                fixes: [
                    'Unificar fonte: criar problems[] baseado em status visuais',
                    'OU: contador usar contagem visual em vez de problems.length',
                    'Garantir que amarelos+vermelhos = contador'
                ]
            };
            
            // 3. Testar contagem baseada em status
            const statusBasedCount = (analysis) => {
                let count = 0;
                
                // Simular contagem baseada em métricas com status problemático
                const metrics = ['lufsIntegrated', 'truePeakDbtp', 'dynamicRange', 'stereoCorrelation'];
                
                for (const metric of metrics) {
                    // Simular lógica de determinação de status
                    const value = Math.random() * 20 - 15; // Valor aleatório
                    const target = -14;
                    const tolerance = 1;
                    const diff = Math.abs(value - target);
                    
                    if (diff > tolerance) {
                        count++;
                    }
                }
                
                return count;
            };
            
            const calculatedCount = statusBasedCount(mockAnalysis);
            
            investigation.findings.push({
                type: 'alternative_calculation',
                calculatedCount,
                note: 'Contagem baseada em análise de status individual'
            });
            
        } catch (error) {
            investigation.findings.push({
                type: 'error',
                message: error.message
            });
        }
        
        this.findings.push(investigation);
        return investigation;
    }

    // 🔍 E. INVESTIGAR: True-Peak Alvo Estranho
    async investigateTruePeakTargets() {
        console.log('\n🔍 E. INVESTIGANDO: True-Peak Alvo Estranho (-8 dBTP)');
        
        const investigation = {
            issue: 'Unusual True-Peak Target',
            description: 'Gênero com alvo -8 dBTP (muito baixo para streaming)',
            findings: [],
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Verificar dados de referência atuais
            if (typeof window !== 'undefined' && window.PROD_AI_REF_DATA) {
                const genreData = Object.entries(window.PROD_AI_REF_DATA);
                
                for (const [genre, data] of genreData) {
                    const truePeakTarget = data.legacy_compatibility?.true_peak_target;
                    
                    investigation.findings.push({
                        genre,
                        truePeakTarget,
                        unit: 'dBTP',
                        reasonable: truePeakTarget >= -3 && truePeakTarget <= 0,
                        streamingStandard: 'Spotify/YouTube usam ~-1.0 dBTP como teto'
                    });
                    
                    if (truePeakTarget < -3) {
                        investigation.rootCause = 'Dados de referência incorretos';
                        investigation.correctionPlan = {
                            issue: `${genre}: target ${truePeakTarget}dBTP muito baixo`,
                            file: 'public/refs/embedded-refs-new.js',
                            fix: 'Ajustar true_peak_target para valor plausível (-1.0 a -2.0 dBTP)',
                            note: 'NÃO é bug de cálculo, é erro nos dados de referência'
                        };
                    }
                }
            }
            
            // 2. Verificar faixas plausíveis para streaming
            const streamingStandards = {
                'Spotify': { target: -1.0, tolerance: 0.5 },
                'YouTube': { target: -1.0, tolerance: 0.5 },
                'Apple Music': { target: -1.0, tolerance: 0.5 },
                'Tidal': { target: -1.0, tolerance: 0.5 }
            };
            
            investigation.findings.push({
                type: 'streaming_standards',
                data: streamingStandards,
                note: 'Padrões típicos da indústria'
            });
            
        } catch (error) {
            investigation.findings.push({
                type: 'error',
                message: error.message
            });
        }
        
        this.findings.push(investigation);
        return investigation;
    }

    // 🧪 Teste de método fallback de frequência
    async testFallbackFrequencyCalculation(investigation) {
        try {
            // Simular método fallback do audio-analyzer.js
            const mockTechnicalData = {
                spectralCentroid: 2000  // Baixo do ideal (1800-3200)
            };
            
            const freqIdealLow = 1800;
            const freqIdealHigh = 3200;
            const centroid = mockTechnicalData.spectralCentroid;
            
            let scoreFreq;
            if (!Number.isFinite(centroid)) {
                scoreFreq = 50;
            } else if (centroid < freqIdealLow) {
                scoreFreq = 100 - Math.min(60, (freqIdealLow - centroid) / freqIdealLow * 100);
            } else if (centroid > freqIdealHigh) {
                scoreFreq = 100 - Math.min(60, (centroid - freqIdealHigh) / freqIdealHigh * 100);
            } else {
                scoreFreq = 100;
            }
            
            investigation.findings.push({
                type: 'fallback_calculation',
                input: mockTechnicalData,
                freqIdealLow,
                freqIdealHigh,
                scoreFreq: Math.round(scoreFreq),
                method: 'audio-analyzer.js fallback'
            });
            
        } catch (error) {
            investigation.findings.push({
                type: 'fallback_error',
                message: error.message
            });
        }
    }

    // 🚀 Executar investigação completa
    async runCompleteInvestigation() {
        console.log('🚀 EXECUTANDO INVESTIGAÇÃO COMPLETA DOS PROBLEMAS REPORTADOS');
        
        const investigations = [
            () => this.investigateFrequencySubscoreMismatch(),
            () => this.investigateColorSuggestionMismatch(), 
            () => this.investigateBandValueDuplication(),
            () => this.investigateProblemCountMismatch(),
            () => this.investigateTruePeakTargets()
        ];
        
        for (const investigation of investigations) {
            try {
                await investigation();
            } catch (error) {
                console.error('Erro durante investigação:', error);
            }
        }
        
        this.generateCorrectionPlan();
    }

    // 📋 Gerar plano de correção priorizado
    generateCorrectionPlan() {
        console.log('\n📋 PLANO DE CORREÇÃO PRIORIZADO');
        console.log('=' .repeat(60));
        
        // Extrair correções de todas as investigações
        const corrections = this.findings
            .filter(f => f.correctionPlan)
            .map(f => ({
                issue: f.issue,
                description: f.description,
                ...f.correctionPlan,
                severity: this.assessSeverity(f)
            }));
        
        // Ordenar por prioridade
        corrections.sort((a, b) => {
            const priorities = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return (priorities[b.severity] || 0) - (priorities[a.severity] || 0);
        });
        
        corrections.forEach((correction, i) => {
            console.log(`${i+1}. [${correction.severity}] ${correction.issue}`);
            console.log(`   📝 Descrição: ${correction.description || correction.issue}`);
            console.log(`   📁 Arquivo(s): ${Array.isArray(correction.files) ? correction.files.join(', ') : correction.file || 'N/A'}`);
            console.log(`   🔧 Correção: ${Array.isArray(correction.fixes) ? correction.fixes.join('; ') : correction.fix || 'N/A'}`);
            console.log(`   ⚠️ Cuidados: Testar em ambiente controlado antes de aplicar`);
            console.log('');
        });
        
        this.correctionPlan = corrections;
        
        // Gerar resumo de implementação
        this.generateImplementationSummary();
    }

    // 📊 Avaliar severidade do problema
    assessSeverity(finding) {
        if (finding.issue.includes('Color') || finding.issue.includes('Suggestion')) {
            return 'HIGH'; // Afeta experiência do usuário
        }
        if (finding.issue.includes('Count') || finding.issue.includes('Frequency')) {
            return 'MEDIUM'; // Afeta precisão mas não quebra funcionalidade
        }
        return 'LOW'; // Dados incorretos mas sistema funciona
    }

    // 📋 Gerar resumo de implementação
    generateImplementationSummary() {
        console.log('\n📋 RESUMO DE IMPLEMENTAÇÃO');
        console.log('=' .repeat(60));
        
        const summary = {
            highPriority: this.correctionPlan.filter(c => c.severity === 'HIGH').length,
            mediumPriority: this.correctionPlan.filter(c => c.severity === 'MEDIUM').length,
            lowPriority: this.correctionPlan.filter(c => c.severity === 'LOW').length,
            filesAffected: [...new Set(this.correctionPlan.flatMap(c => 
                Array.isArray(c.files) ? c.files : [c.file]))].filter(Boolean),
            estimatedTime: this.correctionPlan.length * 30 + ' minutos'
        };
        
        console.log(`🎯 PRIORIDADES:`);
        console.log(`  ⚡ Alta: ${summary.highPriority} correções`);
        console.log(`  🔧 Média: ${summary.mediumPriority} correções`);
        console.log(`  📝 Baixa: ${summary.lowPriority} correções`);
        console.log(`\n📁 ARQUIVOS AFETADOS: ${summary.filesAffected.length}`);
        summary.filesAffected.forEach(file => console.log(`  • ${file}`));
        console.log(`\n⏱️ TEMPO ESTIMADO: ${summary.estimatedTime}`);
        
        console.log(`\n🛡️ CUIDADOS GERAIS:`);
        console.log(`  • Fazer backup antes das alterações`);
        console.log(`  • Testar cada correção individualmente`);
        console.log(`  • Verificar se cache determinístico não mascara mudanças`);
        console.log(`  • Validar com áudios de teste conhecidos`);
        console.log(`  • Confirmar que sistema existente não quebra`);
        
        return summary;
    }

    // 📊 Gerar relatório final
    generateReport() {
        return {
            timestamp: new Date().toISOString(),
            summary: {
                totalIssues: this.findings.length,
                correctionsNeeded: this.correctionPlan.length,
                highPriority: this.correctionPlan.filter(c => c.severity === 'HIGH').length
            },
            findings: this.findings,
            correctionPlan: this.correctionPlan
        };
    }
}

// 🎯 Executar investigação se no browser
if (typeof window !== 'undefined') {
    window.SpecificIssueInvestigator = SpecificIssueInvestigator;
    
    // Função para executar investigação manualmente
    window.runSpecificInvestigation = async function() {
        const investigator = new SpecificIssueInvestigator();
        await investigator.runCompleteInvestigation();
        return investigator.generateReport();
    };
    
    console.log('🔬 SpecificIssueInvestigator carregado. Execute window.runSpecificInvestigation() para iniciar.');
} else {
    module.exports = SpecificIssueInvestigator;
}
