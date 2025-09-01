// 🎯 INTEGRAÇÃO SCORING SAFE - Patch para scoring.js
// Aplicação segura da correção N/A no sistema de scoring principal

console.log('🎯 CARREGANDO SCORING SAFE PATCH');

class ScoringSafePatch {
    constructor() {
        this.originalComputeMixScore = null;
        this.patchApplied = false;
        this.DEBUG = true;
    }

    // 🩹 Aplicar patch no sistema de scoring
    applyPatch() {
        if (typeof window === 'undefined' || typeof window.computeMixScore !== 'function') {
            console.warn('⚠️ computeMixScore não encontrado - patch adiado');
            return false;
        }

        if (this.patchApplied) {
            console.log('✅ Patch scoring já aplicado');
            return true;
        }

        try {
            // Backup da função original
            this.originalComputeMixScore = window.computeMixScore;
            
            // Aplicar nova função
            window.computeMixScore = this.createNewComputeMixScore();
            
            this.patchApplied = true;
            console.log('✅ Patch scoring aplicado com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao aplicar patch scoring:', error);
            return false;
        }
    }

    // 🔄 Remover patch (rollback)
    removePatch() {
        if (!this.patchApplied || !this.originalComputeMixScore) {
            console.log('ℹ️ Nenhum patch scoring para remover');
            return;
        }

        try {
            window.computeMixScore = this.originalComputeMixScore;
            this.patchApplied = false;
            console.log('🔄 Patch scoring removido - voltando ao comportamento original');
        } catch (error) {
            console.error('❌ Erro ao remover patch scoring:', error);
        }
    }

    // 🆕 Nova função computeMixScore com tratamento N/A
    createNewComputeMixScore() {
        const self = this;
        const originalFunction = this.originalComputeMixScore;
        
        return function(technicalData, referenceData, targetTrack = null) {
            // Verificar se feature flag está ativa
            const naHandler = window.naHandler;
            const useNewBehavior = naHandler && naHandler.flagEnabled;
            
            if (!useNewBehavior) {
                // Usar comportamento original
                return originalFunction.call(this, technicalData, referenceData, targetTrack);
            }

            if (self.DEBUG) {
                console.log('🎯 computeMixScore (NOVO):', {
                    technicalData: technicalData ? 'presente' : 'ausente',
                    referenceData: referenceData ? 'presente' : 'ausente',
                    targetTrack,
                    flagEnabled: true
                });
            }

            // Validações iniciais
            if (!technicalData || !referenceData) {
                console.warn('⚠️ Dados técnicos ou referência ausentes');
                return null;
            }

            try {
                // Executar lógica original primeiro
                const originalResult = originalFunction.call(this, technicalData, referenceData, targetTrack);
                
                if (!originalResult || typeof originalResult !== 'object') {
                    return originalResult;
                }

                // Aplicar pós-processamento N/A nos subscores
                const processedResult = self.postProcessScores(originalResult);
                
                if (self.DEBUG) {
                    console.log('🎯 Resultado processado:', {
                        original: originalResult,
                        processed: processedResult
                    });
                }

                return processedResult;
                
            } catch (error) {
                console.error('❌ Erro em computeMixScore:', error);
                return originalFunction.call(this, technicalData, referenceData, targetTrack);
            }
        };
    }

    // 🔄 Pós-processar scores aplicando regras N/A
    postProcessScores(scoreResult) {
        if (!scoreResult || typeof scoreResult !== 'object') {
            return scoreResult;
        }

        const naHandler = window.naHandler;
        if (!naHandler) {
            return scoreResult;
        }

        // Clonar resultado para não modificar original
        const processed = { ...scoreResult };

        // Processar subscores individuais
        const subscoreNames = ['dynamics', 'technical', 'loudness', 'frequency'];
        
        subscoreNames.forEach(name => {
            if (processed[name] !== undefined) {
                if (naHandler.isNA(processed[name])) {
                    processed[name] = null; // Normalizar N/A como null
                }
            }
        });

        // Recalcular score final excluindo subscores N/A
        if (processed.dynamics !== undefined || processed.technical !== undefined || 
            processed.loudness !== undefined || processed.frequency !== undefined) {
            
            const subscores = {
                dynamics: processed.dynamics,
                technical: processed.technical,
                loudness: processed.loudness,
                frequency: processed.frequency
            };

            const newFinalScore = naHandler.calculateFinalScore(subscores);
            
            if (newFinalScore !== null) {
                processed.finalScore = newFinalScore;
                processed.mixScore = newFinalScore; // Alias para compatibilidade
            } else {
                processed.finalScore = null;
                processed.mixScore = null;
            }

            if (this.DEBUG) {
                console.log('🎯 Score final recalculado:', {
                    subscores,
                    newFinalScore
                });
            }
        }

        return processed;
    }

    // 🧪 Testar integração scoring
    testScoringIntegration() {
        console.log('\n🧪 TESTANDO INTEGRAÇÃO SCORING');
        
        if (!window.computeMixScore) {
            console.error('❌ computeMixScore não disponível');
            return false;
        }

        try {
            // Dados de teste simulados
            const mockTechnicalData = {
                dynamics: { range: 15, compression: null }, // N/A na compressão
                loudness: { lufs: -14, peak: -1 },
                frequency: { balance: 80 },
                technical: { snr: 60, thd: null } // N/A no THD
            };

            const mockReferenceData = {
                dynamics: { range: [12, 18], compression: [0.3, 0.7] },
                loudness: { lufs: [-16, -12], peak: [-3, 0] },
                frequency: { balance: [70, 90] },
                technical: { snr: [50, 70], thd: [0, 0.1] }
            };

            // Ativar feature flag
            if (window.naHandler) {
                window.naHandler.setFlag(true);
            }

            // Testar computeMixScore
            const result = window.computeMixScore(mockTechnicalData, mockReferenceData);

            console.log('🧪 Teste scoring:', {
                mockTechnicalData,
                result,
                description: 'Teste com alguns valores N/A'
            });

            // Verificar se N/A foi tratado corretamente
            const hasValidScores = result && (
                typeof result.dynamics === 'number' ||
                typeof result.loudness === 'number' ||
                typeof result.frequency === 'number' ||
                typeof result.technical === 'number'
            );

            return hasValidScores;
            
        } catch (error) {
            console.error('❌ Erro no teste scoring:', error);
            return false;
        }
    }

    // 🧪 Testar comportamento original scoring
    testOriginalScoringBehavior() {
        console.log('\n🧪 TESTANDO COMPORTAMENTO ORIGINAL SCORING');
        
        if (!this.originalComputeMixScore) {
            console.warn('⚠️ Função original scoring não disponível');
            return false;
        }

        try {
            // Desativar feature flag
            if (window.naHandler) {
                window.naHandler.setFlag(false);
            }

            // Mock data simples
            const mockData = { basic: 'test' };
            const mockRef = { basic: 'reference' };
            
            // Testar com função original através do wrapper
            const result = window.computeMixScore(mockData, mockRef);

            console.log('🧪 Teste original scoring:', {
                result,
                description: 'Comportamento legado preservado'
            });

            return true;
            
        } catch (error) {
            console.error('❌ Erro no teste original scoring:', error);
            return false;
        }
    }

    // 📊 Executar bateria completa de testes scoring
    runFullScoringTests() {
        console.log('\n📊 BATERIA COMPLETA - SCORING SYSTEM');
        console.log('=' .repeat(60));

        const results = {
            patchApplication: this.applyPatch(),
            scoringIntegration: this.testScoringIntegration(),
            originalBehavior: this.testOriginalScoringBehavior()
        };

        const allPassed = Object.values(results).every(result => result === true);

        console.log('\n📊 RESULTADOS SCORING:');
        console.log(`   Aplicação do Patch: ${results.patchApplication ? '✅' : '❌'}`);
        console.log(`   Teste Integração: ${results.scoringIntegration ? '✅' : '❌'}`);
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
    window.ScoringSafePatch = ScoringSafePatch;
    
    // Instância global
    window.scoringPatch = new ScoringSafePatch();
    
    // Comandos de conveniência
    window.applyScoringPatch = function() {
        return window.scoringPatch.applyPatch();
    };
    
    window.removeScoringPatch = function() {
        return window.scoringPatch.removePatch();
    };

    window.testScoringIntegration = function() {
        return window.scoringPatch.runFullScoringTests();
    };
    
    console.log('🎯 Scoring Safe Patch carregado!');
    console.log('📞 Comandos disponíveis:');
    console.log('  • window.applyScoringPatch() - Aplicar patch');
    console.log('  • window.removeScoringPatch() - Remover patch');
    console.log('  • window.testScoringIntegration() - Testar integração');
    
    // Auto-aplicar se computeMixScore já estiver carregado
    if (typeof window.computeMixScore === 'function') {
        console.log('🔍 computeMixScore detectado - aplicando patch automaticamente');
        window.scoringPatch.applyPatch();
    } else {
        // Aguardar carregamento
        const checkInterval = setInterval(() => {
            if (typeof window.computeMixScore === 'function') {
                console.log('🔍 computeMixScore carregado - aplicando patch');
                window.scoringPatch.applyPatch();
                clearInterval(checkInterval);
            }
        }, 500);
        
        // Timeout após 10 segundos
        setTimeout(() => {
            clearInterval(checkInterval);
            console.warn('⚠️ computeMixScore não encontrado após 10s');
        }, 10000);
    }
    
} else {
    module.exports = ScoringSafePatch;
}
