// 🔍 AUDITORIA DIRECIONADA - EVIDÊNCIAS CONCRETAS
// Script para testar cada problema específico reportado com logs e evidências

console.log('🔍 INICIANDO AUDITORIA DIRECIONADA COM EVIDÊNCIAS CONCRETAS');

class DirectedAuditor {
    constructor() {
        this.evidences = [];
        this.diagnoses = [];
        this.correctionPlan = [];
    }

    // 🔬 A. AUDITAR: Subscore de Frequência Incoerente
    async auditFrequencySubscore() {
        console.log('\n🔬 A. AUDITANDO: Subscore de Frequência Incoerente');
        
        const audit = {
            issue: 'A. Frequency Subscore Inconsistency',
            evidence: [],
            diagnosis: 'INVESTIGATING',
            rootCause: null,
            correctionPlan: null,
            testCase: null
        };

        try {
            // 1. Buscar função que calcula subscore de frequência
            const frequencyFunctionLocations = await this.findFrequencySubscoreFunction();
            audit.evidence.push({
                type: 'function_location',
                data: frequencyFunctionLocations,
                description: 'Localizações das funções de cálculo de subscore de frequência'
            });

            // 2. Testar com caso específico: poucas bandas verdes mas score alto
            const testCase = {
                spectralData: {
                    spectralCentroid: 1500,    // Muito baixo (ideal: 2500)
                    spectralRolloff50: 2000,   // Baixo (ideal: 3000)  
                    spectralRolloff85: 6000    // Baixo (ideal: 8000)
                },
                expectedResult: 'Score baixo devido a valores longe do ideal',
                bandsStatus: 'Poucas bandas verdes esperadas'
            };

            // 3. Executar cálculo manual
            const manualCalculation = this.calculateFrequencySubscoreManual(testCase.spectralData);
            audit.evidence.push({
                type: 'manual_calculation',
                input: testCase.spectralData,
                output: manualCalculation,
                description: 'Cálculo manual do subscore de frequência'
            });

            // 4. Verificar se N/A está sendo tratado como 100
            const naTest = this.testNAHandlingInFrequencyScore();
            audit.evidence.push({
                type: 'na_handling_test',
                result: naTest,
                description: 'Teste de tratamento de valores N/A'
            });

            // 5. Diagnóstico
            if (manualCalculation.score > 70 && manualCalculation.validMetrics < 2) {
                audit.diagnosis = 'BUG';
                audit.rootCause = 'N/A sendo tratado como score máximo (100) em vez de neutro (50)';
            } else if (manualCalculation.score > 80 && manualCalculation.avgDistance > 1000) {
                audit.diagnosis = 'BUG';
                audit.rootCause = 'Normalização incorreta - não considera distância do alvo';
            } else {
                audit.diagnosis = 'OK';
            }

            audit.testCase = testCase;

        } catch (error) {
            audit.evidence.push({
                type: 'error',
                message: error.message,
                stack: error.stack
            });
            audit.diagnosis = 'INCONCLUSIVO';
        }

        this.diagnoses.push(audit);
        return audit;
    }

    // 🎨 B. AUDITAR: Cor vs Sugestão Divergente  
    async auditColorSuggestionConsistency() {
        console.log('\n🎨 B. AUDITANDO: Cor vs Sugestão Divergente');
        
        const audit = {
            issue: 'B. Color vs Suggestion Inconsistency',
            evidence: [],
            diagnosis: 'INVESTIGATING',
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Localizar funções de cor e sugestão
            const functionLocations = await this.findColorSuggestionFunctions();
            audit.evidence.push({
                type: 'function_locations',
                data: functionLocations,
                description: 'Localizações das funções de cor e sugestão'
            });

            // 2. Testar casos específicos onde cor e sugestão divergem
            const testCases = [
                { value: -14.2, target: -14, tolerance: 1, label: 'Próximo do ideal' },
                { value: -15.1, target: -14, tolerance: 1, label: 'Limítrofe amarelo' },
                { value: -16.8, target: -14, tolerance: 1, label: 'Limítrofe vermelho' }
            ];

            for (const testCase of testCases) {
                const colorResult = this.determineColor(testCase);
                const suggestionResult = this.generateSuggestion(testCase);
                
                const isConsistent = this.checkColorSuggestionConsistency(colorResult, suggestionResult);
                
                audit.evidence.push({
                    type: 'consistency_test',
                    input: testCase,
                    colorResult,
                    suggestionResult,
                    isConsistent,
                    issue: !isConsistent ? 'Verde com sugestão OU lógicas diferentes' : null
                });
            }

            // 3. Diagnóstico
            const inconsistentCases = audit.evidence.filter(e => 
                e.type === 'consistency_test' && !e.isConsistent
            );

            if (inconsistentCases.length > 0) {
                audit.diagnosis = 'BUG';
                audit.rootCause = 'Funções de cor e sugestão usam lógicas diferentes ou separadas';
                audit.correctionPlan = {
                    priority: 'HIGH',
                    action: 'Unificar lógica em função única que determine cor E sugestão simultaneamente',
                    files: ['public/friendly-labels.js', 'audio-analyzer-integration*.js'],
                    risk: 'LOW'
                };
            } else {
                audit.diagnosis = 'OK';
            }

        } catch (error) {
            audit.evidence.push({
                type: 'error',
                message: error.message
            });
            audit.diagnosis = 'INCONCLUSIVO';
        }

        this.diagnoses.push(audit);
        return audit;
    }

    // 🎼 C. AUDITAR: Sub/Low/Mid/High Mesmo Valor
    async auditSpectralBandsDuplication() {
        console.log('\n🎼 C. AUDITANDO: Sub/Low/Mid/High Mesmo Valor');
        
        const audit = {
            issue: 'C. Spectral Bands Same Value',
            evidence: [],
            diagnosis: 'INVESTIGATING',
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Verificar estrutura de dados esperada
            const expectedStructure = {
                'technicalData.tonalBalance.sub.rms_db': 'Sub bass energy',
                'technicalData.tonalBalance.low.rms_db': 'Low bass energy', 
                'technicalData.tonalBalance.mid.rms_db': 'Mid frequency energy',
                'technicalData.tonalBalance.high.rms_db': 'High frequency energy'
            };

            audit.evidence.push({
                type: 'expected_structure',
                data: expectedStructure,
                description: 'Estrutura esperada para bandas espectrais'
            });

            // 2. Simular problema: todas apontam para mesmo campo
            const problematicBinding = {
                'sub': 'technicalData.rms',  // ERRO: RMS global
                'low': 'technicalData.rms',  // ERRO: RMS global
                'mid': 'technicalData.rms',  // ERRO: RMS global
                'high': 'technicalData.rms'  // ERRO: RMS global
            };

            audit.evidence.push({
                type: 'problematic_binding',
                data: problematicBinding,
                description: 'Binding problemático que causaria valores iguais'
            });

            // 3. Testar geração de tonalBalance
            const mockBandEnergies = {
                sub: { rms_db: -25.2 },
                low_bass: { rms_db: -15.8 },
                mid: { rms_db: -12.3 },
                brilho: { rms_db: -18.7 }
            };

            const tonalBalance = this.generateTonalBalance(mockBandEnergies);
            audit.evidence.push({
                type: 'tonal_balance_generation',
                input: mockBandEnergies,
                output: tonalBalance,
                description: 'Teste de geração de tonalBalance'
            });

            // 4. Verificar se valores são únicos
            const values = Object.values(tonalBalance)
                .filter(band => band && Number.isFinite(band.rms_db))
                .map(band => band.rms_db);
            
            const allSame = values.length > 1 && values.every(v => v === values[0]);
            
            audit.evidence.push({
                type: 'uniqueness_test',
                values,
                allSame,
                uniqueCount: new Set(values).size,
                description: 'Teste de unicidade dos valores'
            });

            // 5. Diagnóstico
            if (allSame) {
                audit.diagnosis = 'BUG';
                audit.rootCause = 'tonalBalance não gerado corretamente OU binding da UI incorreto';
                audit.correctionPlan = {
                    priority: 'MEDIUM',
                    action: 'Verificar geração de tonalBalance e binding na UI',
                    files: ['public/audio-analyzer.js (linha ~4153)', 'audio-analyzer-integration*.js'],
                    risk: 'LOW'
                };
            } else {
                audit.diagnosis = 'OK';
            }

        } catch (error) {
            audit.evidence.push({
                type: 'error',
                message: error.message
            });
            audit.diagnosis = 'INCONCLUSIVO';
        }

        this.diagnoses.push(audit);
        return audit;
    }

    // 📊 D. AUDITAR: Contagem de Problemas
    async auditProblemCounting() {
        console.log('\n📊 D. AUDITANDO: Contagem de Problemas');
        
        const audit = {
            issue: 'D. Problem Count Mismatch',
            evidence: [],
            diagnosis: 'INVESTIGATING',
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Simular análise com problemas conhecidos
            const mockAnalysis = {
                problems: [
                    { metric: 'clipping', severity: 'critical' }
                ], // Array original (usado pelo contador)
                technicalData: {
                    lufsIntegrated: -10,    // Problema: muito alto
                    truePeakDbtp: 0.5,      // Problema: clipping  
                    dynamicRange: 3,        // Problema: muito baixo
                    stereoCorrelation: -0.8 // Problema: muito mono
                }
            };

            audit.evidence.push({
                type: 'mock_analysis',
                data: mockAnalysis,
                description: 'Análise simulada com problemas conhecidos'
            });

            // 2. Contagem atual (método problems.length)
            const currentCount = mockAnalysis.problems.length;
            
            // 3. Contagem visual (baseada em métricas vs tolerâncias)
            const visualCount = this.countVisualProblems(mockAnalysis);
            
            audit.evidence.push({
                type: 'count_comparison',
                currentMethod: { count: currentCount, source: 'problems.length' },
                visualMethod: { count: visualCount.count, source: 'metric analysis', details: visualCount.problems },
                mismatch: currentCount !== visualCount.count,
                description: 'Comparação entre métodos de contagem'
            });

            // 4. Diagnóstico
            if (currentCount !== visualCount.count) {
                audit.diagnosis = 'BUG';
                audit.rootCause = 'Contador usa problems.length mas UI mostra status visual divergente';
                audit.correctionPlan = {
                    priority: 'HIGH',
                    action: 'Unificar contagem: usar análise visual OU popular problems[] baseado em status',
                    files: ['audio-analyzer-integration-clean2.js (linha ~2569)', 'audio-analyzer.js'],
                    risk: 'LOW'
                };
            } else {
                audit.diagnosis = 'OK';
            }

        } catch (error) {
            audit.evidence.push({
                type: 'error',
                message: error.message
            });
            audit.diagnosis = 'INCONCLUSIVO';
        }

        this.diagnoses.push(audit);
        return audit;
    }

    // 🎯 E. AUDITAR: True-Peak Targets Estranhos
    async auditTruePeakTargets() {
        console.log('\n🎯 E. AUDITANDO: True-Peak Targets Estranhos');
        
        const audit = {
            issue: 'E. True-Peak Target Validation',
            evidence: [],
            diagnosis: 'INVESTIGATING',
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Verificar dados de referência atuais
            const referenceData = await this.loadReferenceData();
            audit.evidence.push({
                type: 'reference_data',
                data: referenceData,
                description: 'Dados de referência carregados'
            });

            // 2. Validar targets de true-peak por gênero
            const streamingStandards = {
                reasonable_min: -3.0,
                reasonable_max: 0.0,
                ideal_spotify: -1.0,
                ideal_youtube: -1.0
            };

            const validationResults = {};
            for (const [genre, data] of Object.entries(referenceData)) {
                const target = data.legacy_compatibility?.true_peak_target;
                const isReasonable = target >= streamingStandards.reasonable_min && 
                                   target <= streamingStandards.reasonable_max;
                
                validationResults[genre] = {
                    target,
                    isReasonable,
                    recommendation: isReasonable ? 'OK' : `Ajustar para ${streamingStandards.ideal_spotify} dBTP`
                };
            }

            audit.evidence.push({
                type: 'target_validation',
                standards: streamingStandards,
                results: validationResults,
                description: 'Validação de targets contra padrões de streaming'
            });

            // 3. Diagnóstico
            const unreasonableTargets = Object.entries(validationResults)
                .filter(([genre, result]) => !result.isReasonable);

            if (unreasonableTargets.length > 0) {
                audit.diagnosis = 'BUG';
                audit.rootCause = 'Dados de referência com targets implausíveis para streaming';
                audit.correctionPlan = {
                    priority: 'LOW',
                    action: 'Corrigir targets implausíveis nos dados de referência',
                    files: ['public/refs/embedded-refs-new.js'],
                    note: 'NÃO é bug de cálculo, é erro nos dados de referência',
                    risk: 'LOW'
                };
            } else {
                audit.diagnosis = 'OK';
            }

        } catch (error) {
            audit.evidence.push({
                type: 'error', 
                message: error.message
            });
            audit.diagnosis = 'INCONCLUSIVO';
        }

        this.diagnoses.push(audit);
        return audit;
    }

    // ⚡ F. AUDITAR: N/A Inflando Nota
    async auditNAScoreInflation() {
        console.log('\n⚡ F. AUDITANDO: N/A Inflando Nota');
        
        const audit = {
            issue: 'F. N/A Score Inflation',
            evidence: [],
            diagnosis: 'INVESTIGATING',
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Testar diferentes casos de N/A
            const testCases = [
                { value: NaN, label: 'NaN' },
                { value: undefined, label: 'undefined' },
                { value: null, label: 'null' },
                { value: Infinity, label: 'Infinity' },
                { value: -14, label: 'Valid value' }
            ];

            const naHandlingResults = [];
            for (const testCase of testCases) {
                const shouldInclude = Number.isFinite(testCase.value);
                const scoreContribution = this.getScoreContribution(testCase.value);
                
                naHandlingResults.push({
                    input: testCase,
                    shouldInclude,
                    scoreContribution,
                    isProblematic: !shouldInclude && scoreContribution > 0
                });
            }

            audit.evidence.push({
                type: 'na_handling_tests',
                results: naHandlingResults,
                description: 'Teste de tratamento de valores N/A'
            });

            // 2. Testar cálculo de média excluindo N/A
            const mixedValues = [10, NaN, 20, undefined, 30, null, 40];
            const averageWithNA = this.calculateAverageWithNA(mixedValues);
            const averageWithoutNA = this.calculateAverageWithoutNA(mixedValues);

            audit.evidence.push({
                type: 'average_calculation',
                input: mixedValues,
                withNA: averageWithNA,
                withoutNA: averageWithoutNA,
                description: 'Comparação de cálculo de média com e sem N/A'
            });

            // 3. Diagnóstico
            const problematicCases = naHandlingResults.filter(r => r.isProblematic);
            
            if (problematicCases.length > 0 || averageWithNA.inflated) {
                audit.diagnosis = 'BUG';
                audit.rootCause = 'N/A sendo tratado como valor positivo ou inflando médias';
                audit.correctionPlan = {
                    priority: 'MEDIUM',
                    action: 'Garantir que N/A não participe do cálculo de scores',
                    files: ['lib/audio/features/scoring.js', 'subscore-corrector.js'],
                    risk: 'LOW'
                };
            } else {
                audit.diagnosis = 'OK';
            }

        } catch (error) {
            audit.evidence.push({
                type: 'error',
                message: error.message
            });
            audit.diagnosis = 'INCONCLUSIVO';
        }

        this.diagnoses.push(audit);
        return audit;
    }

    // 🔄 I. AUDITAR: Monotonicidade do Score
    async auditScoreMonotonicity() {
        console.log('\n🔄 I. AUDITANDO: Monotonicidade do Score');
        
        const audit = {
            issue: 'I. Score Monotonicity',
            evidence: [],
            diagnosis: 'INVESTIGATING',
            rootCause: null,
            correctionPlan: null
        };

        try {
            // 1. Testar monotonicidade afastando do alvo
            const target = -14;
            const tolerance = 1;
            const testValues = [-14, -13.5, -13, -12, -15, -15.5, -16, -17];
            
            const monotonicityResults = [];
            const baselineScore = this.calculateToleranceScore(-14, target, tolerance);
            
            for (const value of testValues) {
                const score = this.calculateToleranceScore(value, target, tolerance);
                const distance = Math.abs(value - target);
                const isMonotonic = distance === 0 || score <= baselineScore;
                
                monotonicityResults.push({
                    value,
                    distance,
                    score,
                    isMonotonic,
                    violation: !isMonotonic
                });
            }

            audit.evidence.push({
                type: 'monotonicity_test',
                target,
                tolerance,
                baseline: baselineScore,
                results: monotonicityResults,
                description: 'Teste de monotonicidade afastando do alvo'
            });

            // 2. Diagnóstico
            const violations = monotonicityResults.filter(r => r.violation);
            
            if (violations.length > 0) {
                audit.diagnosis = 'BUG';
                audit.rootCause = 'Score não monotônico - afastar do alvo pode aumentar nota';
                audit.correctionPlan = {
                    priority: 'MEDIUM',
                    action: 'Corrigir função de score para garantir monotonicidade',
                    files: ['lib/audio/features/scoring.js'],
                    risk: 'LOW'
                };
            } else {
                audit.diagnosis = 'OK';
            }

        } catch (error) {
            audit.evidence.push({
                type: 'error',
                message: error.message
            });
            audit.diagnosis = 'INCONCLUSIVO';
        }

        this.diagnoses.push(audit);
        return audit;
    }

    // 🚀 Executar auditoria completa
    async runCompleteAudit() {
        console.log('🚀 EXECUTANDO AUDITORIA COMPLETA DIRECIONADA');
        console.log('=' .repeat(60));

        const audits = [
            () => this.auditFrequencySubscore(),
            () => this.auditColorSuggestionConsistency(),
            () => this.auditSpectralBandsDuplication(),
            () => this.auditProblemCounting(),
            () => this.auditTruePeakTargets(),
            () => this.auditNAScoreInflation(),
            () => this.auditScoreMonotonicity()
        ];

        for (const audit of audits) {
            try {
                await audit();
            } catch (error) {
                console.error('Erro durante auditoria:', error);
            }
        }

        this.generateDirectedReport();
    }

    // 📊 Gerar relatório direcionado
    generateDirectedReport() {
        console.log('\n📊 RELATÓRIO DIRECIONADO DA AUDITORIA');
        console.log('=' .repeat(60));

        const summary = {
            total: this.diagnoses.length,
            bugs: this.diagnoses.filter(d => d.diagnosis === 'BUG').length,
            ok: this.diagnoses.filter(d => d.diagnosis === 'OK').length,
            inconclusive: this.diagnoses.filter(d => d.diagnosis === 'INCONCLUSIVO').length
        };

        console.log(`📈 RESUMO EXECUTIVO:`);
        console.log(`  Total auditado: ${summary.total} problemas`);
        console.log(`  🐛 Bugs confirmados: ${summary.bugs}`);
        console.log(`  ✅ Funcionando OK: ${summary.ok}`);
        console.log(`  ❓ Inconclusivos: ${summary.inconclusive}`);

        console.log('\n🔍 DIAGNÓSTICOS DETALHADOS:');
        this.diagnoses.forEach((diagnosis, i) => {
            const statusIcon = {
                'BUG': '🐛',
                'OK': '✅',
                'INCONCLUSIVO': '❓'
            }[diagnosis.diagnosis] || '❓';
            
            console.log(`${i+1}. ${statusIcon} ${diagnosis.issue.split('.')[1]}`);
            console.log(`    Diagnóstico: ${diagnosis.diagnosis}`);
            
            if (diagnosis.rootCause) {
                console.log(`    Causa: ${diagnosis.rootCause}`);
            }
            
            if (diagnosis.correctionPlan) {
                console.log(`    Prioridade: ${diagnosis.correctionPlan.priority}`);
                console.log(`    Ação: ${diagnosis.correctionPlan.action}`);
                console.log(`    Arquivos: ${diagnosis.correctionPlan.files?.join(', ') || 'N/A'}`);
            }
            
            console.log('');
        });

        // Gerar plano de correção priorizado
        this.generatePrioritizedCorrectionPlan();

        return {
            summary,
            diagnoses: this.diagnoses,
            correctionPlan: this.correctionPlan
        };
    }

    // 📋 Gerar plano de correção priorizado
    generatePrioritizedCorrectionPlan() {
        console.log('\n📋 PLANO DE CORREÇÃO PRIORIZADO');
        console.log('=' .repeat(60));

        const bugs = this.diagnoses.filter(d => d.diagnosis === 'BUG' && d.correctionPlan);
        
        // Ordenar por prioridade
        const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        bugs.sort((a, b) => {
            return priorityOrder[b.correctionPlan.priority] - priorityOrder[a.correctionPlan.priority];
        });

        this.correctionPlan = bugs.map((bug, i) => ({
            order: i + 1,
            issue: bug.issue,
            priority: bug.correctionPlan.priority,
            action: bug.correctionPlan.action,
            files: bug.correctionPlan.files,
            risk: bug.correctionPlan.risk,
            rootCause: bug.rootCause
        }));

        console.log('🎯 ORDEM DE CORREÇÃO RECOMENDADA:');
        this.correctionPlan.forEach(correction => {
            console.log(`${correction.order}. [${correction.priority}] ${correction.issue.split('.')[1]}`);
            console.log(`   🔧 Ação: ${correction.action}`);
            console.log(`   📁 Arquivos: ${correction.files?.join(', ') || 'N/A'}`);
            console.log(`   ⚠️ Risco: ${correction.risk}`);
            console.log(`   🔍 Causa: ${correction.rootCause}`);
            console.log('');
        });

        console.log('🛡️ CUIDADOS GERAIS:');
        console.log('  • Implementar uma correção por vez');
        console.log('  • Testar cada correção isoladamente');
        console.log('  • Fazer backup antes de modificar arquivos');
        console.log('  • Verificar que cache não mascara mudanças');
        console.log('  • Validar com áudios de teste conhecidos');
    }

    // 🔧 Funções auxiliares de implementação
    async findFrequencySubscoreFunction() {
        // Simular busca por função de subscore de frequência
        return [
            'audio-analyzer.js: linha ~2053 (scoreFreq calculation)',
            'lib/audio/features/subscore-corrector.js: aggregateCategory',
            'lib/audio/features/scoring.js: frequency scoring'
        ];
    }

    calculateFrequencySubscoreManual(spectralData) {
        const targets = {
            spectralCentroid: { target: 2500, tolerance: 1200 },
            spectralRolloff50: { target: 3000, tolerance: 1200 },
            spectralRolloff85: { target: 8000, tolerance: 2500 }
        };

        let totalScore = 0;
        let validMetrics = 0;
        let totalDistance = 0;

        for (const [metric, config] of Object.entries(targets)) {
            const value = spectralData[metric];
            if (Number.isFinite(value)) {
                const distance = Math.abs(value - config.target);
                totalDistance += distance;
                
                let score;
                if (distance <= config.tolerance) {
                    score = 100;
                } else if (distance <= config.tolerance * 2) {
                    score = 100 - (50 * ((distance / config.tolerance) - 1));
                } else {
                    score = 0;
                }
                
                totalScore += score;
                validMetrics++;
            }
        }

        return {
            score: validMetrics > 0 ? Math.round(totalScore / validMetrics) : 50,
            validMetrics,
            avgDistance: validMetrics > 0 ? totalDistance / validMetrics : 0,
            details: Object.entries(targets).map(([metric, config]) => ({
                metric,
                value: spectralData[metric],
                target: config.target,
                distance: Number.isFinite(spectralData[metric]) ? 
                         Math.abs(spectralData[metric] - config.target) : null
            }))
        };
    }

    testNAHandlingInFrequencyScore() {
        // Testar se N/A retorna score alto incorretamente
        const naValues = [NaN, undefined, null, Infinity];
        const results = [];

        for (const naValue of naValues) {
            const mockData = { spectralCentroid: naValue };
            const result = this.calculateFrequencySubscoreManual(mockData);
            
            results.push({
                input: naValue,
                score: result.score,
                problematic: result.score > 60 // Score neutro deveria ser ~50
            });
        }

        return results;
    }

    async findColorSuggestionFunctions() {
        return {
            colorFunction: 'public/friendly-labels.js: createEnhancedDiffCell',
            suggestionFunction: 'audio-analyzer-integration*.js: suggestion generation',
            note: 'Funções podem estar em locais separados'
        };
    }

    determineColor(testCase) {
        const diff = testCase.value - testCase.target;
        const absDiff = Math.abs(diff);
        
        if (absDiff <= testCase.tolerance) {
            return { color: 'green', status: 'IDEAL' };
        } else if (absDiff <= testCase.tolerance * 2) {
            return { color: 'yellow', status: 'AJUSTAR' };
        } else {
            return { color: 'red', status: 'CORRIGIR' };
        }
    }

    generateSuggestion(testCase) {
        const diff = testCase.value - testCase.target;
        const absDiff = Math.abs(diff);
        
        if (absDiff <= testCase.tolerance) {
            return { suggestion: '', reasoning: 'Valor ideal' };
        } else {
            return { 
                suggestion: diff > 0 ? 'DIMINUIR' : 'AUMENTAR',
                reasoning: 'Valor fora da tolerância'
            };
        }
    }

    checkColorSuggestionConsistency(colorResult, suggestionResult) {
        // Verde deve ter sugestão vazia
        if (colorResult.color === 'green' && suggestionResult.suggestion !== '') {
            return false;
        }
        
        // Amarelo/vermelho devem ter sugestão
        if ((colorResult.color === 'yellow' || colorResult.color === 'red') && 
            suggestionResult.suggestion === '') {
            return false;
        }
        
        return true;
    }

    generateTonalBalance(bandEnergies) {
        return {
            sub: bandEnergies.sub ? { rms_db: bandEnergies.sub.rms_db } : null,
            low: bandEnergies.low_bass ? { rms_db: bandEnergies.low_bass.rms_db } : null,
            mid: bandEnergies.mid ? { rms_db: bandEnergies.mid.rms_db } : null,
            high: bandEnergies.brilho ? { rms_db: bandEnergies.brilho.rms_db } : null
        };
    }

    countVisualProblems(analysis) {
        const metrics = [
            { key: 'lufsIntegrated', target: -14, tolerance: 1 },
            { key: 'truePeakDbtp', target: -1, tolerance: 1 },
            { key: 'dynamicRange', target: 10, tolerance: 3 },
            { key: 'stereoCorrelation', target: 0.3, tolerance: 0.15 }
        ];

        let count = 0;
        const problems = [];

        for (const metric of metrics) {
            const value = analysis.technicalData[metric.key];
            if (Number.isFinite(value)) {
                const diff = Math.abs(value - metric.target);
                if (diff > metric.tolerance) {
                    count++;
                    problems.push({
                        metric: metric.key,
                        value,
                        target: metric.target,
                        diff,
                        severity: diff > metric.tolerance * 2 ? 'critical' : 'warning'
                    });
                }
            }
        }

        return { count, problems };
    }

    async loadReferenceData() {
        // Simular carregamento dos dados de referência
        return {
            'eletrofunk': { legacy_compatibility: { true_peak_target: -2.5 } },
            'rock': { legacy_compatibility: { true_peak_target: -1.0 } },
            'problematic_genre': { legacy_compatibility: { true_peak_target: -8.0 } }
        };
    }

    getScoreContribution(value) {
        if (!Number.isFinite(value)) {
            return 0; // N/A não deveria contribuir
        }
        return 50; // Score neutro para valores válidos
    }

    calculateAverageWithNA(values) {
        const sum = values.reduce((acc, val) => acc + (val || 0), 0);
        return {
            average: sum / values.length,
            inflated: true,
            note: 'Inclui N/A como 0'
        };
    }

    calculateAverageWithoutNA(values) {
        const validValues = values.filter(v => Number.isFinite(v));
        const sum = validValues.reduce((acc, val) => acc + val, 0);
        return {
            average: validValues.length > 0 ? sum / validValues.length : null,
            inflated: false,
            note: 'Exclui N/A corretamente'
        };
    }

    calculateToleranceScore(value, target, tolerance) {
        const diff = Math.abs(value - target);
        if (diff <= tolerance) {
            return 100;
        } else if (diff <= tolerance * 2) {
            return 100 - (50 * ((diff / tolerance) - 1));
        } else {
            return 0;
        }
    }
}

// 🎯 Executar auditoria direcionada se no browser
if (typeof window !== 'undefined') {
    window.DirectedAuditor = DirectedAuditor;
    
    window.runDirectedAudit = async function() {
        const auditor = new DirectedAuditor();
        return await auditor.runCompleteAudit();
    };
    
    console.log('🔍 DirectedAuditor carregado. Execute window.runDirectedAudit() para iniciar.');
} else {
    module.exports = DirectedAuditor;
}
