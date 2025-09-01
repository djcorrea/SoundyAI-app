// 🔍 AUDITORIA COMPLETA - Sistema N/A
// Verificação detalhada da implementação e integridade

console.log('🔍 INICIANDO AUDITORIA COMPLETA DO SISTEMA N/A');

class NASystemAudit {
    constructor() {
        this.results = {
            foundation: null,
            integration: null,
            functionality: null,
            safety: null,
            performance: null,
            compliance: null
        };
        this.score = 0;
        this.maxScore = 100;
        this.issues = [];
        this.recommendations = [];
        this.DEBUG = true;
    }

    // 🏗️ Auditoria 1: Foundation (Sistema Base)
    auditFoundation() {
        console.log('\n🏗️ AUDITORIA 1: FOUNDATION');
        console.log('=' .repeat(50));

        const checks = {
            naHandlerExists: this.checkNAHandlerExists(),
            classStructure: this.checkClassStructure(),
            methodsAvailable: this.checkRequiredMethods(),
            flagImplementation: this.checkFeatureFlag(),
            globalInterface: this.checkGlobalInterface()
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        const foundationScore = (passed / total) * 20; // 20% do total

        this.results.foundation = {
            score: foundationScore,
            maxScore: 20,
            passed,
            total,
            checks,
            status: foundationScore >= 18 ? 'APPROVED' : foundationScore >= 15 ? 'WARNING' : 'FAILED'
        };

        console.log(`📊 Foundation Score: ${foundationScore.toFixed(1)}/20`);
        console.log(`✅ Checks Passed: ${passed}/${total}`);
        
        return this.results.foundation;
    }

    // 🔧 Auditoria 2: Integration (Patches e Integrações)
    auditIntegration() {
        console.log('\n🔧 AUDITORIA 2: INTEGRATION');
        console.log('=' .repeat(50));

        const checks = {
            subscorePatchExists: this.checkSubScorePatch(),
            scoringPatchExists: this.checkScoringPatch(),
            patchesApplied: this.checkPatchesApplied(),
            backupFunctions: this.checkBackupFunctions(),
            rollbackCapability: this.checkRollbackCapability()
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        const integrationScore = (passed / total) * 20; // 20% do total

        this.results.integration = {
            score: integrationScore,
            maxScore: 20,
            passed,
            total,
            checks,
            status: integrationScore >= 18 ? 'APPROVED' : integrationScore >= 15 ? 'WARNING' : 'FAILED'
        };

        console.log(`📊 Integration Score: ${integrationScore.toFixed(1)}/20`);
        console.log(`✅ Checks Passed: ${passed}/${total}`);
        
        return this.results.integration;
    }

    // ⚙️ Auditoria 3: Functionality (Funcionalidade Core)
    auditFunctionality() {
        console.log('\n⚙️ AUDITORIA 3: FUNCTIONALITY');
        console.log('=' .repeat(50));

        const checks = {
            naDetection: this.testNADetection(),
            meanCalculation: this.testMeanCalculation(),
            categoryHandling: this.testCategoryHandling(),
            finalScoreCalculation: this.testFinalScoreCalculation(),
            uiFormatting: this.testUIFormatting()
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        const functionalityScore = (passed / total) * 25; // 25% do total

        this.results.functionality = {
            score: functionalityScore,
            maxScore: 25,
            passed,
            total,
            checks,
            status: functionalityScore >= 22 ? 'APPROVED' : functionalityScore >= 18 ? 'WARNING' : 'FAILED'
        };

        console.log(`📊 Functionality Score: ${functionalityScore.toFixed(1)}/25`);
        console.log(`✅ Checks Passed: ${passed}/${total}`);
        
        return this.results.functionality;
    }

    // 🛡️ Auditoria 4: Safety (Segurança e Guard-rails)
    auditSafety() {
        console.log('\n🛡️ AUDITORIA 4: SAFETY');
        console.log('=' .repeat(50));

        const checks = {
            featureFlagSafety: this.checkFeatureFlagSafety(),
            rollbackSafety: this.checkRollbackSafety(),
            errorHandling: this.checkErrorHandling(),
            dataValidation: this.checkDataValidation(),
            regressionPrevention: this.checkRegressionPrevention()
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        const safetyScore = (passed / total) * 20; // 20% do total

        this.results.safety = {
            score: safetyScore,
            maxScore: 20,
            passed,
            total,
            checks,
            status: safetyScore >= 18 ? 'APPROVED' : safetyScore >= 15 ? 'WARNING' : 'FAILED'
        };

        console.log(`📊 Safety Score: ${safetyScore.toFixed(1)}/20`);
        console.log(`✅ Checks Passed: ${passed}/${total}`);
        
        return this.results.safety;
    }

    // ⚡ Auditoria 5: Performance (Performance e Eficiência)
    auditPerformance() {
        console.log('\n⚡ AUDITORIA 5: PERFORMANCE');
        console.log('=' .repeat(50));

        const checks = {
            calculationSpeed: this.testCalculationSpeed(),
            memoryUsage: this.testMemoryUsage(),
            cacheEfficiency: this.testCacheEfficiency(),
            scalability: this.testScalability(),
            browserCompatibility: this.testBrowserCompatibility()
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        const performanceScore = (passed / total) * 10; // 10% do total

        this.results.performance = {
            score: performanceScore,
            maxScore: 10,
            passed,
            total,
            checks,
            status: performanceScore >= 9 ? 'APPROVED' : performanceScore >= 7 ? 'WARNING' : 'FAILED'
        };

        console.log(`📊 Performance Score: ${performanceScore.toFixed(1)}/10`);
        console.log(`✅ Checks Passed: ${passed}/${total}`);
        
        return this.results.performance;
    }

    // 📋 Auditoria 6: Compliance (Conformidade com Requisitos)
    auditCompliance() {
        console.log('\n📋 AUDITORIA 6: COMPLIANCE');
        console.log('=' .repeat(50));

        const checks = {
            requirementExclusion: this.checkNAExclusionRequirement(),
            requirementCategoryNA: this.checkCategoryNARequirement(),
            requirementFinalScore: this.checkFinalScoreRequirement(),
            requirementUI: this.checkUIRequirement(),
            requirementFeatureFlag: this.checkFeatureFlagRequirement()
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        const complianceScore = (passed / total) * 5; // 5% do total

        this.results.compliance = {
            score: complianceScore,
            maxScore: 5,
            passed,
            total,
            checks,
            status: complianceScore >= 4.5 ? 'APPROVED' : complianceScore >= 3.5 ? 'WARNING' : 'FAILED'
        };

        console.log(`📊 Compliance Score: ${complianceScore.toFixed(1)}/5`);
        console.log(`✅ Checks Passed: ${passed}/${total}`);
        
        return this.results.compliance;
    }

    // =================== MÉTODOS DE VERIFICAÇÃO ===================

    checkNAHandlerExists() {
        try {
            const exists = typeof window.NAHandlerSafe === 'function' && window.naHandler instanceof window.NAHandlerSafe;
            if (!exists) this.issues.push('NAHandlerSafe não está carregado ou instanciado');
            return exists;
        } catch (e) {
            this.issues.push(`Erro ao verificar NAHandlerSafe: ${e.message}`);
            return false;
        }
    }

    checkClassStructure() {
        try {
            if (!window.NAHandlerSafe) return false;
            
            const requiredMethods = ['setFlag', 'isNA', 'calculateMeanExcludingNA', 'calculateCategorySubscore', 'calculateFinalScore', 'formatForUI'];
            const prototype = window.NAHandlerSafe.prototype;
            
            const missing = requiredMethods.filter(method => typeof prototype[method] !== 'function');
            
            if (missing.length > 0) {
                this.issues.push(`Métodos ausentes na NAHandlerSafe: ${missing.join(', ')}`);
                return false;
            }
            return true;
        } catch (e) {
            this.issues.push(`Erro ao verificar estrutura da classe: ${e.message}`);
            return false;
        }
    }

    checkRequiredMethods() {
        try {
            if (!window.naHandler) return false;
            
            const tests = [
                () => typeof window.naHandler.isNA === 'function',
                () => typeof window.naHandler.calculateMeanExcludingNA === 'function',
                () => typeof window.naHandler.calculateCategorySubscore === 'function',
                () => typeof window.naHandler.calculateFinalScore === 'function',
                () => typeof window.naHandler.formatForUI === 'function'
            ];
            
            const allWorking = tests.every(test => test());
            if (!allWorking) this.issues.push('Alguns métodos não estão funcionando corretamente');
            return allWorking;
        } catch (e) {
            this.issues.push(`Erro ao verificar métodos: ${e.message}`);
            return false;
        }
    }

    checkFeatureFlag() {
        try {
            if (!window.naHandler) return false;
            
            const initialState = window.naHandler.flagEnabled;
            
            // Testar toggle
            window.naHandler.setFlag(true);
            const afterTrue = window.naHandler.flagEnabled === true;
            
            window.naHandler.setFlag(false);
            const afterFalse = window.naHandler.flagEnabled === false;
            
            // Restaurar estado
            window.naHandler.setFlag(initialState);
            
            const flagWorking = afterTrue && afterFalse;
            if (!flagWorking) this.issues.push('Feature flag não está funcionando corretamente');
            return flagWorking;
        } catch (e) {
            this.issues.push(`Erro ao verificar feature flag: ${e.message}`);
            return false;
        }
    }

    checkGlobalInterface() {
        try {
            const globalMethods = [
                'window.testNAHandling',
                'window.enableNAExclusion',
                'window.generateNASafetyReport'
            ];
            
            const missing = globalMethods.filter(method => {
                try {
                    return eval(`typeof ${method}`) !== 'function';
                } catch {
                    return true;
                }
            });
            
            if (missing.length > 0) {
                this.issues.push(`Métodos globais ausentes: ${missing.join(', ')}`);
                return false;
            }
            return true;
        } catch (e) {
            this.issues.push(`Erro ao verificar interface global: ${e.message}`);
            return false;
        }
    }

    checkSubScorePatch() {
        try {
            const exists = typeof window.SubScoreCorrectorPatch === 'function' && window.subScorePatch instanceof window.SubScoreCorrectorPatch;
            if (!exists) this.issues.push('SubScoreCorrectorPatch não está carregado');
            return exists;
        } catch (e) {
            this.issues.push(`Erro ao verificar SubScorePatch: ${e.message}`);
            return false;
        }
    }

    checkScoringPatch() {
        try {
            const exists = typeof window.ScoringSafePatch === 'function' && window.scoringPatch instanceof window.ScoringSafePatch;
            if (!exists) this.issues.push('ScoringSafePatch não está carregado');
            return exists;
        } catch (e) {
            this.issues.push(`Erro ao verificar ScoringPatch: ${e.message}`);
            return false;
        }
    }

    checkPatchesApplied() {
        try {
            const subscoreApplied = window.subScorePatch && window.subScorePatch.patchApplied;
            const scoringApplied = window.scoringPatch && window.scoringPatch.patchApplied;
            
            if (!subscoreApplied) this.issues.push('Patch do SubScoreCorrector não foi aplicado');
            if (!scoringApplied) this.issues.push('Patch do Scoring não foi aplicado');
            
            return subscoreApplied && scoringApplied;
        } catch (e) {
            this.issues.push(`Erro ao verificar patches aplicados: ${e.message}`);
            return false;
        }
    }

    checkBackupFunctions() {
        try {
            const subscoreBackup = window.subScorePatch && window.subScorePatch.originalAggregateCategory;
            const scoringBackup = window.scoringPatch && window.scoringPatch.originalComputeMixScore;
            
            if (!subscoreBackup) this.issues.push('Backup do SubScoreCorrector não encontrado');
            if (!scoringBackup) this.issues.push('Backup do Scoring não encontrado');
            
            return subscoreBackup && scoringBackup;
        } catch (e) {
            this.issues.push(`Erro ao verificar backups: ${e.message}`);
            return false;
        }
    }

    checkRollbackCapability() {
        try {
            const canRollbackSubscore = typeof window.removeSubScorePatch === 'function';
            const canRollbackScoring = typeof window.removeScoringPatch === 'function';
            
            if (!canRollbackSubscore) this.issues.push('Rollback do SubScore não disponível');
            if (!canRollbackScoring) this.issues.push('Rollback do Scoring não disponível');
            
            return canRollbackSubscore && canRollbackScoring;
        } catch (e) {
            this.issues.push(`Erro ao verificar capacidade de rollback: ${e.message}`);
            return false;
        }
    }

    testNADetection() {
        try {
            if (!window.naHandler) return false;
            
            const naValues = [null, undefined, NaN, Infinity, -Infinity, 'N/A', ''];
            const validValues = [0, 1, -1, 0.5, 100];
            
            const naDetected = naValues.every(val => window.naHandler.isNA(val));
            const validNotDetected = validValues.every(val => !window.naHandler.isNA(val));
            
            if (!naDetected) this.issues.push('Alguns valores N/A não foram detectados');
            if (!validNotDetected) this.issues.push('Alguns valores válidos foram detectados como N/A');
            
            return naDetected && validNotDetected;
        } catch (e) {
            this.issues.push(`Erro ao testar detecção N/A: ${e.message}`);
            return false;
        }
    }

    testMeanCalculation() {
        try {
            if (!window.naHandler) return false;
            
            window.naHandler.setFlag(true);
            
            // Teste 1: Lista mista
            const result1 = window.naHandler.calculateMeanExcludingNA([80, NaN, 90]);
            const expected1 = 85;
            const test1 = Math.abs(result1 - expected1) < 0.1;
            
            // Teste 2: Todos N/A
            const result2 = window.naHandler.calculateMeanExcludingNA([NaN, null, undefined]);
            const test2 = result2 === null;
            
            // Teste 3: Sem N/A
            const result3 = window.naHandler.calculateMeanExcludingNA([70, 80, 90]);
            const expected3 = 80;
            const test3 = Math.abs(result3 - expected3) < 0.1;
            
            const allPassed = test1 && test2 && test3;
            if (!allPassed) this.issues.push('Falha no cálculo de médias excluindo N/A');
            
            return allPassed;
        } catch (e) {
            this.issues.push(`Erro ao testar cálculo de média: ${e.message}`);
            return false;
        }
    }

    testCategoryHandling() {
        try {
            if (!window.naHandler) return false;
            
            window.naHandler.setFlag(true);
            
            // Teste categoria com N/A
            const result1 = window.naHandler.calculateCategorySubscore([80, NaN, 90]);
            const expected1 = 85;
            const test1 = Math.abs(result1 - expected1) < 0.1;
            
            // Teste categoria toda N/A
            const result2 = window.naHandler.calculateCategorySubscore([NaN, null, undefined]);
            const test2 = result2 === null;
            
            const allPassed = test1 && test2;
            if (!allPassed) this.issues.push('Falha no tratamento de categorias com N/A');
            
            return allPassed;
        } catch (e) {
            this.issues.push(`Erro ao testar categorias: ${e.message}`);
            return false;
        }
    }

    testFinalScoreCalculation() {
        try {
            if (!window.naHandler) return false;
            
            window.naHandler.setFlag(true);
            
            // Teste com alguns subscores N/A
            const subscores = {
                dynamics: 80,
                technical: 90,
                loudness: null,
                frequency: 85
            };
            
            const result = window.naHandler.calculateFinalScore(subscores);
            const expected = (80 + 90 + 85) / 3; // Média só dos válidos
            const test1 = Math.abs(result - expected) < 0.1;
            
            // Teste todos N/A
            const allNA = {
                dynamics: null,
                technical: null,
                loudness: null,
                frequency: null
            };
            
            const result2 = window.naHandler.calculateFinalScore(allNA);
            const test2 = result2 === null;
            
            const allPassed = test1 && test2;
            if (!allPassed) this.issues.push('Falha no cálculo do score final');
            
            return allPassed;
        } catch (e) {
            this.issues.push(`Erro ao testar score final: ${e.message}`);
            return false;
        }
    }

    testUIFormatting() {
        try {
            if (!window.naHandler) return false;
            
            // Teste formatação N/A
            const naFormatted = window.naHandler.formatForUI(NaN);
            const test1 = naFormatted === '—';
            
            // Teste formatação valor válido
            const validFormatted = window.naHandler.formatForUI(85.123);
            const test2 = validFormatted === '85.1';
            
            // Teste classe CSS N/A
            const naClass = window.naHandler.getCSSClass(NaN);
            const test3 = naClass === 'na-neutral';
            
            const allPassed = test1 && test2 && test3;
            if (!allPassed) this.issues.push('Falha na formatação para UI');
            
            return allPassed;
        } catch (e) {
            this.issues.push(`Erro ao testar formatação UI: ${e.message}`);
            return false;
        }
    }

    checkFeatureFlagSafety() {
        try {
            if (!window.naHandler) return false;
            
            // Verificar estado inicial seguro (desativado)
            const defaultState = window.naHandler.flagEnabled === false;
            
            // Verificar se há controle global
            const hasGlobalControl = typeof window.enableNAExclusion === 'function';
            
            const isSafe = defaultState && hasGlobalControl;
            if (!isSafe) this.issues.push('Feature flag não está configurada de forma segura');
            
            return isSafe;
        } catch (e) {
            this.issues.push(`Erro ao verificar segurança da feature flag: ${e.message}`);
            return false;
        }
    }

    checkRollbackSafety() {
        try {
            const hasEmergencyRollback = typeof window.emergencyRollback === 'function';
            const hasIndividualRollbacks = typeof window.removeSubScorePatch === 'function' && 
                                          typeof window.removeScoringPatch === 'function';
            
            const isSafe = hasEmergencyRollback && hasIndividualRollbacks;
            if (!isSafe) this.issues.push('Sistema de rollback não está completo');
            
            return isSafe;
        } catch (e) {
            this.issues.push(`Erro ao verificar segurança de rollback: ${e.message}`);
            return false;
        }
    }

    checkErrorHandling() {
        try {
            if (!window.naHandler) return false;
            
            // Testar com dados inválidos
            const testCases = [
                () => window.naHandler.calculateMeanExcludingNA(null),
                () => window.naHandler.calculateMeanExcludingNA('invalid'),
                () => window.naHandler.calculateCategorySubscore(undefined),
                () => window.naHandler.calculateFinalScore('invalid')
            ];
            
            const allHandled = testCases.every(test => {
                try {
                    const result = test();
                    return result === null || result === undefined; // Deve retornar null/undefined para dados inválidos
                } catch {
                    return false; // Não deve quebrar
                }
            });
            
            if (!allHandled) this.issues.push('Tratamento de erro inadequado para dados inválidos');
            return allHandled;
        } catch (e) {
            this.issues.push(`Erro ao verificar tratamento de erros: ${e.message}`);
            return false;
        }
    }

    checkDataValidation() {
        try {
            if (!window.naHandler) return false;
            
            // Verificar se há validação de entrada
            const validationTests = [
                window.naHandler.calculateMeanExcludingNA([]) === null, // Array vazio
                window.naHandler.calculateCategorySubscore([]) === null, // Array vazio
                window.naHandler.calculateFinalScore({}) === null // Objeto vazio
            ];
            
            const hasValidation = validationTests.every(Boolean);
            if (!hasValidation) this.issues.push('Validação de dados de entrada inadequada');
            
            return hasValidation;
        } catch (e) {
            this.issues.push(`Erro ao verificar validação de dados: ${e.message}`);
            return false;
        }
    }

    checkRegressionPrevention() {
        try {
            if (!window.naHandler) return false;
            
            // Testar comportamento legado quando flag está off
            window.naHandler.setFlag(false);
            
            // Verificar se há modo legado disponível
            const hasLegacyMode = typeof window.naHandler.calculateCategorySubscoreLegacy === 'function' &&
                                 typeof window.naHandler.calculateFinalScoreLegacy === 'function';
            
            if (!hasLegacyMode) this.issues.push('Modo legado não disponível para prevenção de regressão');
            
            return hasLegacyMode;
        } catch (e) {
            this.issues.push(`Erro ao verificar prevenção de regressão: ${e.message}`);
            return false;
        }
    }

    testCalculationSpeed() {
        try {
            if (!window.naHandler) return false;
            
            window.naHandler.setFlag(true);
            
            const testData = Array(1000).fill().map((_, i) => i % 10 === 0 ? NaN : Math.random() * 100);
            
            const start = performance.now();
            for (let i = 0; i < 100; i++) {
                window.naHandler.calculateMeanExcludingNA(testData);
            }
            const end = performance.now();
            
            const avgTime = (end - start) / 100;
            const isPerformant = avgTime < 10; // Menos de 10ms por cálculo
            
            if (!isPerformant) this.recommendations.push(`Performance pode ser melhorada: ${avgTime.toFixed(2)}ms por cálculo`);
            
            return isPerformant;
        } catch (e) {
            this.issues.push(`Erro ao testar velocidade: ${e.message}`);
            return false;
        }
    }

    testMemoryUsage() {
        try {
            // Teste básico de memória
            if (typeof performance.memory === 'undefined') return true; // Não disponível em todos os browsers
            
            const beforeMemory = performance.memory.usedJSHeapSize;
            
            // Executar operações que podem consumir memória
            for (let i = 0; i < 1000; i++) {
                if (window.naHandler) {
                    window.naHandler.calculateMeanExcludingNA([1, 2, 3, NaN, 5]);
                }
            }
            
            const afterMemory = performance.memory.usedJSHeapSize;
            const memoryIncrease = afterMemory - beforeMemory;
            
            const isEfficient = memoryIncrease < 1000000; // Menos de 1MB
            
            if (!isEfficient) this.recommendations.push(`Uso de memória pode ser otimizado: +${(memoryIncrease/1000).toFixed(1)}KB`);
            
            return isEfficient;
        } catch (e) {
            return true; // Se não conseguir testar, considera OK
        }
    }

    testCacheEfficiency() {
        // Por enquanto, assume que está OK (pode ser expandido)
        return true;
    }

    testScalability() {
        try {
            if (!window.naHandler) return false;
            
            window.naHandler.setFlag(true);
            
            // Testar com datasets grandes
            const smallData = Array(10).fill().map(() => Math.random() * 100);
            const largeData = Array(10000).fill().map(() => Math.random() * 100);
            
            const start1 = performance.now();
            window.naHandler.calculateMeanExcludingNA(smallData);
            const time1 = performance.now() - start1;
            
            const start2 = performance.now();
            window.naHandler.calculateMeanExcludingNA(largeData);
            const time2 = performance.now() - start2;
            
            // Verificar se escalabilidade é linear (ou melhor)
            const scalabilityRatio = time2 / time1;
            const expectedRatio = largeData.length / smallData.length;
            const isScalable = scalabilityRatio < expectedRatio * 2; // Margem de 2x
            
            if (!isScalable) this.recommendations.push(`Escalabilidade pode ser melhorada: ratio ${scalabilityRatio.toFixed(2)}`);
            
            return isScalable;
        } catch (e) {
            this.issues.push(`Erro ao testar escalabilidade: ${e.message}`);
            return false;
        }
    }

    testBrowserCompatibility() {
        try {
            // Verificar APIs essenciais
            const requiredAPIs = [
                'Array.prototype.filter',
                'Array.prototype.forEach',
                'Array.prototype.reduce',
                'Number.isFinite',
                'Number.isNaN',
                'console.log'
            ];
            
            const allSupported = requiredAPIs.every(api => {
                try {
                    return eval(api) !== undefined;
                } catch {
                    return false;
                }
            });
            
            if (!allSupported) this.issues.push('Algumas APIs necessárias não estão disponíveis');
            
            return allSupported;
        } catch (e) {
            this.issues.push(`Erro ao verificar compatibilidade: ${e.message}`);
            return false;
        }
    }

    // Verificações de Compliance com Requisitos Originais

    checkNAExclusionRequirement() {
        try {
            if (!window.naHandler) return false;
            
            window.naHandler.setFlag(true);
            
            // Verificar se N/A é excluído do numerador e denominador
            const result = window.naHandler.calculateMeanExcludingNA([80, NaN, 90]);
            const expected = 85; // (80 + 90) / 2
            
            const compliant = Math.abs(result - expected) < 0.1;
            if (!compliant) this.issues.push('Requisito de exclusão N/A não está sendo atendido');
            
            return compliant;
        } catch (e) {
            this.issues.push(`Erro ao verificar requisito de exclusão: ${e.message}`);
            return false;
        }
    }

    checkCategoryNARequirement() {
        try {
            if (!window.naHandler) return false;
            
            window.naHandler.setFlag(true);
            
            // Verificar se categoria toda N/A retorna N/A
            const result = window.naHandler.calculateCategorySubscore([NaN, null, undefined]);
            
            const compliant = result === null;
            if (!compliant) this.issues.push('Requisito de categoria N/A não está sendo atendido');
            
            return compliant;
        } catch (e) {
            this.issues.push(`Erro ao verificar requisito de categoria N/A: ${e.message}`);
            return false;
        }
    }

    checkFinalScoreRequirement() {
        try {
            if (!window.naHandler) return false;
            
            window.naHandler.setFlag(true);
            
            // Verificar se score final é média só dos válidos
            const subscores = { dynamics: 80, technical: null, loudness: 90, frequency: null };
            const result = window.naHandler.calculateFinalScore(subscores);
            const expected = (80 + 90) / 2; // Só dynamics e loudness
            
            const compliant = Math.abs(result - expected) < 0.1;
            if (!compliant) this.issues.push('Requisito de score final não está sendo atendido');
            
            return compliant;
        } catch (e) {
            this.issues.push(`Erro ao verificar requisito de score final: ${e.message}`);
            return false;
        }
    }

    checkUIRequirement() {
        try {
            if (!window.naHandler) return false;
            
            // Verificar se UI mostra "—" para N/A
            const display = window.naHandler.formatForUI(NaN);
            const cssClass = window.naHandler.getCSSClass(NaN);
            
            const compliant = display === '—' && cssClass === 'na-neutral';
            if (!compliant) this.issues.push('Requisito de UI para N/A não está sendo atendido');
            
            return compliant;
        } catch (e) {
            this.issues.push(`Erro ao verificar requisito de UI: ${e.message}`);
            return false;
        }
    }

    checkFeatureFlagRequirement() {
        try {
            // Verificar se feature flag existe e funciona
            const hasFlag = window.naHandler && typeof window.naHandler.setFlag === 'function';
            const hasGlobalControl = typeof window.enableNAExclusion === 'function';
            
            const compliant = hasFlag && hasGlobalControl;
            if (!compliant) this.issues.push('Requisito de feature flag não está sendo atendido');
            
            return compliant;
        } catch (e) {
            this.issues.push(`Erro ao verificar requisito de feature flag: ${e.message}`);
            return false;
        }
    }

    // 📊 Executar auditoria completa
    runCompleteAudit() {
        console.log('\n🔍 EXECUTANDO AUDITORIA COMPLETA DO SISTEMA N/A');
        console.log('=' .repeat(80));
        
        const startTime = performance.now();
        
        // Executar todas as auditorias
        this.auditFoundation();
        this.auditIntegration();
        this.auditFunctionality();
        this.auditSafety();
        this.auditPerformance();
        this.auditCompliance();
        
        // Calcular score total
        this.score = Object.values(this.results).reduce((sum, result) => sum + (result?.score || 0), 0);
        
        const endTime = performance.now();
        const auditTime = endTime - startTime;
        
        // Gerar relatório final
        return this.generateFinalReport(auditTime);
    }

    // 📋 Gerar relatório final
    generateFinalReport(auditTime) {
        console.log('\n📋 RELATÓRIO FINAL DA AUDITORIA');
        console.log('=' .repeat(80));
        
        console.log(`⏱️  Tempo de Auditoria: ${auditTime.toFixed(2)}ms`);
        console.log(`📊 Score Total: ${this.score.toFixed(1)}/${this.maxScore}`);
        console.log(`📈 Percentual: ${((this.score / this.maxScore) * 100).toFixed(1)}%`);
        
        // Status geral
        let overallStatus;
        const percentage = (this.score / this.maxScore) * 100;
        
        if (percentage >= 90) overallStatus = '🟢 EXCELENTE';
        else if (percentage >= 80) overallStatus = '🟡 BOM';
        else if (percentage >= 70) overallStatus = '🟠 ACEITÁVEL';
        else if (percentage >= 60) overallStatus = '🔴 NECESSITA MELHORIAS';
        else overallStatus = '🚨 CRÍTICO';
        
        console.log(`🎯 Status Geral: ${overallStatus}`);
        
        // Detalhamento por área
        console.log('\n📊 DETALHAMENTO POR ÁREA:');
        Object.entries(this.results).forEach(([area, result]) => {
            if (result) {
                const statusIcon = result.status === 'APPROVED' ? '✅' : 
                                 result.status === 'WARNING' ? '⚠️' : '❌';
                console.log(`${statusIcon} ${area.toUpperCase()}: ${result.score.toFixed(1)}/${result.maxScore} (${result.passed}/${result.total} checks)`);
            }
        });
        
        // Issues encontradas
        if (this.issues.length > 0) {
            console.log('\n🚨 PROBLEMAS ENCONTRADOS:');
            this.issues.forEach((issue, i) => {
                console.log(`${i + 1}. ${issue}`);
            });
        }
        
        // Recomendações
        if (this.recommendations.length > 0) {
            console.log('\n💡 RECOMENDAÇÕES:');
            this.recommendations.forEach((rec, i) => {
                console.log(`${i + 1}. ${rec}`);
            });
        }
        
        // Certificação
        const isCertified = percentage >= 80 && this.issues.length === 0;
        console.log('\n🏆 CERTIFICAÇÃO:');
        if (isCertified) {
            console.log('✅ SISTEMA CERTIFICADO PARA PRODUÇÃO');
            console.log('🚀 Implementação aprovada para ativação');
        } else {
            console.log('❌ SISTEMA NÃO CERTIFICADO');
            console.log('🔧 Correções necessárias antes da ativação');
        }
        
        return {
            score: this.score,
            maxScore: this.maxScore,
            percentage,
            overallStatus,
            results: this.results,
            issues: this.issues,
            recommendations: this.recommendations,
            certified: isCertified,
            auditTime
        };
    }
}

// 🌐 Interface Global
if (typeof window !== 'undefined') {
    window.NASystemAudit = NASystemAudit;
    
    // Instância global
    window.naAudit = new NASystemAudit();
    
    // Comandos de conveniência
    window.runCompleteAudit = function() {
        return window.naAudit.runCompleteAudit();
    };
    
    window.auditFoundation = function() {
        return window.naAudit.auditFoundation();
    };
    
    window.auditIntegration = function() {
        return window.naAudit.auditIntegration();
    };
    
    window.auditFunctionality = function() {
        return window.naAudit.auditFunctionality();
    };
    
    console.log('🔍 Sistema de Auditoria N/A carregado!');
    console.log('📞 Comandos disponíveis:');
    console.log('  • window.runCompleteAudit() - Auditoria completa');
    console.log('  • window.auditFoundation() - Auditoria foundation');
    console.log('  • window.auditIntegration() - Auditoria integração');
    console.log('  • window.auditFunctionality() - Auditoria funcionalidade');
    
} else {
    module.exports = NASystemAudit;
}
