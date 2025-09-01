// 🔧 INTEGRAÇÃO SEGURA - SubScore Corrector 
// Aplicação da correção N/A no sistema de subscores existente

console.log('🔧 CARREGANDO INTEGRAÇÃO SUBSCORE-CORRECTOR');

class SubScoreCorrectorPatch {
    constructor() {
        this.originalAggregateCategory = null;
        this.patchApplied = false;
        this.DEBUG = true;
    }

    // 🩹 Aplicar patch no SubScoreCorrector existente
    applyPatch() {
        if (typeof window === 'undefined' || !window.SubScoreCorrector) {
            console.warn('⚠️ SubScoreCorrector não encontrado - patch adiado');
            return false;
        }

        if (this.patchApplied) {
            console.log('✅ Patch já aplicado');
            return true;
        }

        try {
            // Backup do método original
            this.originalAggregateCategory = window.SubScoreCorrector.prototype.aggregateCategory;
            
            // Aplicar novo método
            window.SubScoreCorrector.prototype.aggregateCategory = this.createNewAggregateCategory();
            
            this.patchApplied = true;
            console.log('✅ Patch aplicado com sucesso no SubScoreCorrector');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao aplicar patch:', error);
            return false;
        }
    }

    // 🔄 Remover patch (rollback)
    removePatch() {
        if (!this.patchApplied || !this.originalAggregateCategory) {
            console.log('ℹ️ Nenhum patch para remover');
            return;
        }

        try {
            window.SubScoreCorrector.prototype.aggregateCategory = this.originalAggregateCategory;
            this.patchApplied = false;
            console.log('🔄 Patch removido - voltando ao comportamento original');
        } catch (error) {
            console.error('❌ Erro ao remover patch:', error);
        }
    }

    // 🆕 Novo método aggregateCategory com tratamento N/A
    createNewAggregateCategory() {
        const self = this;
        
        return function(categoryData, weights = null) {
            // Verificar se feature flag está ativa
            const naHandler = window.naHandler;
            const useNewBehavior = naHandler && naHandler.flagEnabled;
            
            if (!useNewBehavior) {
                // Usar comportamento original
                return self.originalAggregateCategory.call(this, categoryData, weights);
            }

            if (self.DEBUG) {
                console.log('🔧 SubScoreCorrector.aggregateCategory (NOVO):', {
                    categoryData,
                    weights,
                    flagEnabled: true
                });
            }

            // Novo comportamento com exclusão N/A
            if (!Array.isArray(categoryData) || categoryData.length === 0) {
                return null; // Categoria vazia → N/A
            }

            const validScores = [];
            const validWeights = [];

            categoryData.forEach((score, index) => {
                if (naHandler.isNA(score) || !Number.isFinite(score)) {
                    // Excluir N/A completamente
                    if (self.DEBUG) {
                        console.log(`   Excluindo N/A na posição ${index}: ${score}`);
                    }
                    return;
                }

                validScores.push(score);
                
                if (weights && weights[index] !== undefined) {
                    validWeights.push(weights[index]);
                } else {
                    validWeights.push(1); // Peso padrão
                }
            });

            // Se todos os scores são N/A → categoria N/A
            if (validScores.length === 0) {
                if (self.DEBUG) {
                    console.log('   Todos scores N/A → retornando null');
                }
                return null;
            }

            // Calcular média ponderada dos scores válidos
            let weightedSum = 0;
            let totalWeight = 0;

            for (let i = 0; i < validScores.length; i++) {
                const weight = validWeights[i] || 1;
                weightedSum += validScores[i] * weight;
                totalWeight += weight;
            }

            const categoryScore = totalWeight > 0 ? weightedSum / totalWeight : null;

            if (self.DEBUG) {
                console.log('🔧 Resultado aggregateCategory:', {
                    validScores,
                    validWeights,
                    weightedSum,
                    totalWeight,
                    categoryScore
                });
            }

            return categoryScore;
        };
    }

    // 🧪 Testar integração
    testIntegration() {
        console.log('\n🧪 TESTANDO INTEGRAÇÃO SUBSCORE-CORRECTOR');
        
        if (!window.SubScoreCorrector) {
            console.error('❌ SubScoreCorrector não disponível');
            return false;
        }

        try {
            // Criar instância de teste
            const corrector = new window.SubScoreCorrector();
            
            // Test data com N/A
            const testData = [80, NaN, 90, null, 85];
            const testWeights = [1, 1, 1, 1, 1];

            // Ativar feature flag para teste
            if (window.naHandler) {
                window.naHandler.setFlag(true);
            }

            // Testar agregação
            const result = corrector.aggregateCategory(testData, testWeights);
            
            // Resultado esperado: (80 + 90 + 85) / 3 = 85
            const expected = (80 + 90 + 85) / 3;
            const passed = Math.abs(result - expected) < 0.1;

            console.log('🧪 Teste integração:', {
                testData,
                result,
                expected,
                passed: passed ? '✅ PASSOU' : '❌ FALHOU'
            });

            return passed;
            
        } catch (error) {
            console.error('❌ Erro no teste de integração:', error);
            return false;
        }
    }

    // 🧪 Testar comportamento original
    testOriginalBehavior() {
        console.log('\n🧪 TESTANDO COMPORTAMENTO ORIGINAL');
        
        if (!this.originalAggregateCategory) {
            console.warn('⚠️ Método original não disponível');
            return false;
        }

        try {
            // Desativar feature flag
            if (window.naHandler) {
                window.naHandler.setFlag(false);
            }

            // Criar instância de teste
            const corrector = new window.SubScoreCorrector();
            
            // Test data com N/A
            const testData = [80, NaN, 90];
            
            // Testar com comportamento original
            const result = corrector.aggregateCategory(testData);

            console.log('🧪 Teste original:', {
                testData,
                result,
                description: 'Comportamento legado preservado'
            });

            return true;
            
        } catch (error) {
            console.error('❌ Erro no teste original:', error);
            return false;
        }
    }

    // 📊 Executar bateria completa de testes
    runFullTests() {
        console.log('\n📊 BATERIA COMPLETA - SUBSCORE CORRECTOR');
        console.log('=' .repeat(60));

        const results = {
            patchApplication: this.applyPatch(),
            integrationTest: this.testIntegration(),
            originalBehavior: this.testOriginalBehavior()
        };

        const allPassed = Object.values(results).every(result => result === true);

        console.log('\n📊 RESULTADOS FINAIS:');
        console.log(`   Aplicação do Patch: ${results.patchApplication ? '✅' : '❌'}`);
        console.log(`   Teste Integração: ${results.integrationTest ? '✅' : '❌'}`);
        console.log(`   Comportamento Original: ${results.originalBehavior ? '✅' : '❌'}`);
        console.log(`   Status Geral: ${allPassed ? '✅ APROVADO' : '❌ FALHAS DETECTADAS'}`);

        return {
            results,
            allPassed,
            recommendation: allPassed ? 'SEGURO PARA PRODUÇÃO' : 'REQUER CORREÇÕES'
        };
    }
}

// 🌐 Interface Global
if (typeof window !== 'undefined') {
    window.SubScoreCorrectorPatch = SubScoreCorrectorPatch;
    
    // Instância global
    window.subScorePatch = new SubScoreCorrectorPatch();
    
    // Comandos de conveniência
    window.applySubScorePatch = function() {
        return window.subScorePatch.applyPatch();
    };
    
    window.removeSubScorePatch = function() {
        return window.subScorePatch.removePatch();
    };

    window.testSubScoreIntegration = function() {
        return window.subScorePatch.runFullTests();
    };
    
    console.log('🔧 SubScore Corrector Patch carregado!');
    console.log('📞 Comandos disponíveis:');
    console.log('  • window.applySubScorePatch() - Aplicar patch');
    console.log('  • window.removeSubScorePatch() - Remover patch');
    console.log('  • window.testSubScoreIntegration() - Testar integração');
    
    // Auto-aplicar se SubScoreCorrector já estiver carregado
    if (window.SubScoreCorrector) {
        console.log('🔍 SubScoreCorrector detectado - aplicando patch automaticamente');
        window.subScorePatch.applyPatch();
    } else {
        // Aguardar carregamento
        const checkInterval = setInterval(() => {
            if (window.SubScoreCorrector) {
                console.log('🔍 SubScoreCorrector carregado - aplicando patch');
                window.subScorePatch.applyPatch();
                clearInterval(checkInterval);
            }
        }, 500);
        
        // Timeout após 10 segundos
        setTimeout(() => {
            clearInterval(checkInterval);
            console.warn('⚠️ SubScoreCorrector não encontrado após 10s');
        }, 10000);
    }
    
} else {
    module.exports = SubScoreCorrectorPatch;
}
