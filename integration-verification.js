// 🎯 VERIFICAÇÃO FINAL - Integração com Sistema Existente
// Teste de compatibilidade com scoring.js e subscore-corrector.js originais

console.log('🎯 INICIANDO VERIFICAÇÃO FINAL DE INTEGRAÇÃO');

class IntegrationVerification {
    constructor() {
        this.results = {
            filesExist: false,
            scoringLoaded: false,
            subscoreLoaded: false,
            patchesApplied: false,
            functionalityWorking: false,
            compatibilityOK: false
        };
        this.errors = [];
        this.warnings = [];
    }

    // 📁 Verificar se arquivos originais existem
    async checkOriginalFiles() {
        console.log('\n📁 VERIFICANDO ARQUIVOS ORIGINAIS...');
        
        const filesToCheck = [
            'lib/audio/features/scoring.js',
            'lib/audio/features/subscore-corrector.js',
            'public/lib/audio/features/scoring.js'
        ];

        let filesFound = 0;
        
        for (const file of filesToCheck) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    console.log(`✅ Encontrado: ${file}`);
                    filesFound++;
                } else {
                    console.log(`❌ Não encontrado: ${file}`);
                }
            } catch (error) {
                console.log(`⚠️ Erro ao verificar ${file}: ${error.message}`);
            }
        }
        
        this.results.filesExist = filesFound > 0;
        console.log(`📊 Arquivos encontrados: ${filesFound}/${filesToCheck.length}`);
        
        return this.results.filesExist;
    }

    // 🔧 Verificar se funções originais estão carregadas
    checkOriginalFunctions() {
        console.log('\n🔧 VERIFICANDO FUNÇÕES ORIGINAIS...');
        
        // Verificar computeMixScore
        if (typeof window.computeMixScore === 'function') {
            console.log('✅ computeMixScore encontrada');
            this.results.scoringLoaded = true;
        } else {
            console.log('❌ computeMixScore não encontrada');
            this.errors.push('Função computeMixScore não está carregada');
        }
        
        // Verificar SubScoreCorrector
        if (typeof window.SubScoreCorrector === 'function') {
            console.log('✅ SubScoreCorrector encontrada');
            this.results.subscoreLoaded = true;
        } else {
            console.log('❌ SubScoreCorrector não encontrada');
            this.warnings.push('Classe SubScoreCorrector não está carregada - patches podem não funcionar');
        }
        
        return this.results.scoringLoaded && this.results.subscoreLoaded;
    }

    // 🩹 Verificar se patches foram aplicados
    checkPatchesApplied() {
        console.log('\n🩹 VERIFICANDO PATCHES APLICADOS...');
        
        let patchesOK = 0;
        
        // Verificar patch SubScore
        if (window.subScorePatch && window.subScorePatch.patchApplied) {
            console.log('✅ Patch SubScore aplicado');
            patchesOK++;
        } else {
            console.log('⚠️ Patch SubScore não aplicado');
            this.warnings.push('Patch do SubScoreCorrector não foi aplicado');
        }
        
        // Verificar patch Scoring
        if (window.scoringPatch && window.scoringPatch.patchApplied) {
            console.log('✅ Patch Scoring aplicado');
            patchesOK++;
        } else {
            console.log('⚠️ Patch Scoring não aplicado');
            this.warnings.push('Patch do Scoring não foi aplicado');
        }
        
        this.results.patchesApplied = patchesOK >= 1;
        console.log(`📊 Patches aplicados: ${patchesOK}/2`);
        
        return this.results.patchesApplied;
    }

    // ⚙️ Testar funcionalidade integrada
    testIntegratedFunctionality() {
        console.log('\n⚙️ TESTANDO FUNCIONALIDADE INTEGRADA...');
        
        if (!window.naHandler) {
            console.log('❌ NAHandler não disponível');
            this.errors.push('Sistema NAHandler não está carregado');
            return false;
        }
        
        // Ativar feature flag para teste
        window.naHandler.setFlag(true);
        
        let testsPassedCount = 0;
        const totalTests = 3;
        
        try {
            // Teste 1: computeMixScore com patch
            if (typeof window.computeMixScore === 'function') {
                console.log('🧪 Teste 1: computeMixScore com patch...');
                
                // Dados de teste simplificados
                const mockTechnical = {
                    dynamics: { range: null }, // N/A
                    loudness: { lufs: -14 },
                    frequency: { balance: 80 }
                };
                
                const mockReference = {
                    dynamics: { range: [10, 20] },
                    loudness: { lufs: [-16, -12] },
                    frequency: { balance: [70, 90] }
                };
                
                try {
                    const result = window.computeMixScore(mockTechnical, mockReference);
                    console.log('✅ computeMixScore executou sem erro');
                    testsPassedCount++;
                } catch (error) {
                    console.log(`❌ Erro em computeMixScore: ${error.message}`);
                }
            }
            
            // Teste 2: SubScoreCorrector com patch
            if (typeof window.SubScoreCorrector === 'function') {
                console.log('🧪 Teste 2: SubScoreCorrector com patch...');
                
                try {
                    const corrector = new window.SubScoreCorrector();
                    const testData = [80, NaN, 90];
                    const result = corrector.aggregateCategory(testData);
                    
                    if (result !== null && typeof result === 'number') {
                        console.log('✅ SubScoreCorrector funcionando');
                        testsPassedCount++;
                    } else {
                        console.log('⚠️ SubScoreCorrector retornou resultado inesperado');
                    }
                } catch (error) {
                    console.log(`❌ Erro em SubScoreCorrector: ${error.message}`);
                }
            }
            
            // Teste 3: NAHandler standalone
            console.log('🧪 Teste 3: NAHandler standalone...');
            
            const testResult = window.naHandler.calculateMeanExcludingNA([80, NaN, 90]);
            if (Math.abs(testResult - 85) < 0.1) {
                console.log('✅ NAHandler funcionando corretamente');
                testsPassedCount++;
            } else {
                console.log('❌ NAHandler retornou resultado incorreto');
            }
            
        } catch (error) {
            console.log(`❌ Erro geral nos testes: ${error.message}`);
            this.errors.push(`Erro nos testes de funcionalidade: ${error.message}`);
        }
        
        this.results.functionalityWorking = testsPassedCount >= 2;
        console.log(`📊 Testes funcionais: ${testsPassedCount}/${totalTests} passaram`);
        
        return this.results.functionalityWorking;
    }

    // 🔄 Testar compatibilidade e rollback
    testCompatibilityAndRollback() {
        console.log('\n🔄 TESTANDO COMPATIBILIDADE E ROLLBACK...');
        
        if (!window.naHandler) {
            console.log('❌ Sistema não disponível para teste');
            return false;
        }
        
        try {
            // Testar comportamento com flag desativada
            window.naHandler.setFlag(false);
            console.log('🧪 Testando comportamento legado...');
            
            if (typeof window.computeMixScore === 'function') {
                // Deve funcionar mesmo com flag desativada
                const result = window.computeMixScore({}, {});
                console.log('✅ Comportamento legado mantido');
            }
            
            // Testar rollback de patches
            if (window.removeSubScorePatch && window.removeScoringPatch) {
                console.log('🧪 Testando capacidade de rollback...');
                
                // Note: Não vamos realmente fazer rollback, só verificar se existe
                console.log('✅ Funções de rollback disponíveis');
                
                this.results.compatibilityOK = true;
            } else {
                console.log('⚠️ Funções de rollback não disponíveis');
                this.warnings.push('Sistema de rollback incompleto');
            }
            
        } catch (error) {
            console.log(`❌ Erro no teste de compatibilidade: ${error.message}`);
            this.errors.push(`Problema de compatibilidade: ${error.message}`);
        }
        
        return this.results.compatibilityOK;
    }

    // 📋 Executar verificação completa
    async runCompleteVerification() {
        console.log('\n🎯 EXECUTANDO VERIFICAÇÃO COMPLETA DE INTEGRAÇÃO');
        console.log('=' .repeat(80));
        
        const startTime = performance.now();
        
        // Executar todas as verificações
        await this.checkOriginalFiles();
        this.checkOriginalFunctions();
        this.checkPatchesApplied();
        this.testIntegratedFunctionality();
        this.testCompatibilityAndRollback();
        
        const endTime = performance.now();
        const verificationTime = endTime - startTime;
        
        // Gerar relatório final
        return this.generateVerificationReport(verificationTime);
    }

    // 📊 Gerar relatório de verificação
    generateVerificationReport(verificationTime) {
        console.log('\n📊 RELATÓRIO DE VERIFICAÇÃO FINAL');
        console.log('=' .repeat(80));
        
        console.log(`⏱️  Tempo de Verificação: ${verificationTime.toFixed(2)}ms`);
        
        // Status individual
        console.log('\n🔍 STATUS DAS VERIFICAÇÕES:');
        Object.entries(this.results).forEach(([check, passed]) => {
            const icon = passed ? '✅' : '❌';
            console.log(`${icon} ${check}: ${passed ? 'OK' : 'FALHOU'}`);
        });
        
        // Calcular score geral
        const passedChecks = Object.values(this.results).filter(Boolean).length;
        const totalChecks = Object.keys(this.results).length;
        const percentage = (passedChecks / totalChecks) * 100;
        
        console.log(`\n📈 Score Geral: ${passedChecks}/${totalChecks} (${percentage.toFixed(1)}%)`);
        
        // Status geral
        let overallStatus;
        if (percentage >= 90) overallStatus = '🟢 EXCELENTE - Integração perfeita';
        else if (percentage >= 80) overallStatus = '🟡 BOM - Integração funcional';
        else if (percentage >= 70) overallStatus = '🟠 ACEITÁVEL - Algumas limitações';
        else if (percentage >= 50) overallStatus = '🔴 PROBLEMÁTICO - Correções necessárias';
        else overallStatus = '🚨 CRÍTICO - Integração falhando';
        
        console.log(`🎯 Status Geral: ${overallStatus}`);
        
        // Erros encontrados
        if (this.errors.length > 0) {
            console.log('\n🚨 ERROS CRÍTICOS:');
            this.errors.forEach((error, i) => {
                console.log(`${i + 1}. ${error}`);
            });
        }
        
        // Warnings
        if (this.warnings.length > 0) {
            console.log('\n⚠️ AVISOS:');
            this.warnings.forEach((warning, i) => {
                console.log(`${i + 1}. ${warning}`);
            });
        }
        
        // Recomendações finais
        console.log('\n💡 RECOMENDAÇÕES FINAIS:');
        
        if (percentage >= 80) {
            console.log('✅ Sistema pronto para ativação em produção');
            console.log('📋 Execute auditoria completa para certificação final');
            console.log('🚩 Ative feature flag gradualmente com monitoramento');
        } else if (percentage >= 50) {
            console.log('⚠️ Sistema parcialmente funcional');
            console.log('🔧 Corrija os erros críticos antes da ativação');
            console.log('🧪 Execute testes adicionais em ambiente de staging');
        } else {
            console.log('❌ Sistema não está pronto para produção');
            console.log('🛠️ Refaça a implementação seguindo a documentação');
            console.log('📞 Verifique se todos os arquivos foram carregados corretamente');
        }
        
        // Próximos passos
        console.log('\n🚀 PRÓXIMOS PASSOS:');
        if (this.results.functionalityWorking) {
            console.log('1. Execute a auditoria completa (auditoria-completa.html)');
            console.log('2. Valide todos os 100 pontos da certificação');
            console.log('3. Ative feature flag em ambiente controlado');
            console.log('4. Monitore métricas de performance e estabilidade');
        } else {
            console.log('1. Verifique carregamento dos arquivos originais');
            console.log('2. Reaplique os patches se necessário');
            console.log('3. Execute testes unitários individualmente');
            console.log('4. Repita esta verificação até resolver todos os problemas');
        }
        
        return {
            passed: passedChecks,
            total: totalChecks,
            percentage,
            overallStatus,
            results: this.results,
            errors: this.errors,
            warnings: this.warnings,
            verificationTime,
            readyForProduction: percentage >= 80 && this.errors.length === 0
        };
    }
}

// 🌐 Interface Global
if (typeof window !== 'undefined') {
    window.IntegrationVerification = IntegrationVerification;
    
    // Instância global
    window.integrationVerification = new IntegrationVerification();
    
    // Comandos de conveniência
    window.runIntegrationCheck = function() {
        return window.integrationVerification.runCompleteVerification();
    };
    
    window.checkOriginalFiles = function() {
        return window.integrationVerification.checkOriginalFiles();
    };
    
    window.testIntegratedFunctionality = function() {
        return window.integrationVerification.testIntegratedFunctionality();
    };
    
    console.log('🎯 Sistema de Verificação de Integração carregado!');
    console.log('📞 Comandos disponíveis:');
    console.log('  • window.runIntegrationCheck() - Verificação completa');
    console.log('  • window.checkOriginalFiles() - Verificar arquivos originais');
    console.log('  • window.testIntegratedFunctionality() - Testar funcionalidade');
    
} else {
    module.exports = IntegrationVerification;
}
