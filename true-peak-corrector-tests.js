// 🧪 TESTES DE VALIDAÇÃO PARA TRUE-PEAK REFERENCE CORRECTOR
// Suíte completa de testes para garantir correção segura e eficaz

const TruePeakCorrectorTests = {
    
    // Estado dos testes
    testResults: [],
    corrector: null,
    
    /**
     * 🚀 Executar todos os testes
     */
    async runAllTests() {
        console.log('[TRUE_PEAK_TESTS] 🧪 Iniciando suíte completa de testes...');
        
        this.testResults = [];
        
        // Verificar se corrector está disponível
        if (typeof window !== 'undefined' && window.truePeakCorrector) {
            this.corrector = window.truePeakCorrector;
        } else if (typeof window !== 'undefined' && window.TruePeakReferenceCorrector) {
            this.corrector = new window.TruePeakReferenceCorrector();
        } else {
            this.fail('Sistema TruePeakReferenceCorrector não disponível');
            return this.getResults();
        }
        
        // Executar testes em sequência
        await this.testInitialization();
        await this.testFeatureFlag();
        await this.testAuditExecution();
        await this.testCorrectionGeneration();
        await this.testFunkException();
        await this.testPlausibilityValidation();
        await this.testVersioning();
        await this.testCacheInvalidation();
        await this.testApplyAndRollback();
        await this.testDataIntegrity();
        await this.testErrorHandling();
        await this.testScenarios();
        
        const results = this.getResults();
        console.log(`[TRUE_PEAK_TESTS] ✅ Testes concluídos: ${results.passed}/${results.total}`);
        
        return results;
    },

    /**
     * 🧪 Teste 1: Inicialização do Sistema
     */
    async testInitialization() {
        try {
            this.assert(
                this.corrector !== null,
                'TruePeakReferenceCorrector deve estar inicializado'
            );
            
            this.assert(
                typeof this.corrector.performAudit === 'function',
                'Método performAudit deve estar disponível'
            );
            
            this.assert(
                typeof this.corrector.apply === 'function',
                'Método apply deve estar disponível'
            );
            
            this.assert(
                typeof this.corrector.rollback === 'function',
                'Método rollback deve estar disponível'
            );
            
            const status = this.corrector.getStatus();
            this.assert(
                typeof status === 'object',
                'getStatus deve retornar objeto'
            );
            
            this.pass('Inicialização do Sistema');
            
        } catch (error) {
            this.fail('Inicialização do Sistema', error.message);
        }
    },

    /**
     * 🧪 Teste 2: Feature Flag
     */
    async testFeatureFlag() {
        try {
            // Testar estado inicial
            const initialFlag = this.corrector.checkFeatureFlag();
            this.assert(
                typeof initialFlag === 'boolean',
                'checkFeatureFlag deve retornar boolean'
            );
            
            // Testar habilitação
            if (typeof window !== 'undefined') {
                window.TRUE_PEAK_CORRECTOR_V1 = true;
                const enabledFlag = this.corrector.checkFeatureFlag();
                this.assert(
                    enabledFlag === true,
                    'Feature flag deve estar habilitada quando TRUE_PEAK_CORRECTOR_V1 = true'
                );
                
                // Testar desabilitação
                window.TRUE_PEAK_CORRECTOR_V1 = false;
                const disabledFlag = this.corrector.checkFeatureFlag();
                this.assert(
                    disabledFlag === false,
                    'Feature flag deve estar desabilitada quando TRUE_PEAK_CORRECTOR_V1 = false'
                );
            }
            
            this.pass('Feature Flag');
            
        } catch (error) {
            this.fail('Feature Flag', error.message);
        }
    },

    /**
     * 🧪 Teste 3: Execução de Auditoria
     */
    async testAuditExecution() {
        try {
            const audit = await this.corrector.performAudit();
            
            this.assert(
                audit !== null,
                'performAudit deve retornar resultado válido'
            );
            
            this.assert(
                typeof audit.currentData === 'object',
                'Auditoria deve incluir currentData'
            );
            
            this.assert(
                Array.isArray(audit.issues),
                'Auditoria deve incluir array de issues'
            );
            
            this.assert(
                Array.isArray(audit.dependencies),
                'Auditoria deve incluir array de dependencies'
            );
            
            this.assert(
                typeof audit.timestamp === 'string',
                'Auditoria deve incluir timestamp'
            );
            
            this.pass('Execução de Auditoria');
            
        } catch (error) {
            this.fail('Execução de Auditoria', error.message);
        }
    },

    /**
     * 🧪 Teste 4: Geração de Correções
     */
    async testCorrectionGeneration() {
        try {
            // Primeiro executar auditoria
            await this.corrector.performAudit();
            
            const result = this.corrector.generateCorrectedReferences();
            
            this.assert(
                result !== null,
                'generateCorrectedReferences deve retornar resultado'
            );
            
            this.assert(
                typeof result.newVersion === 'string',
                'Resultado deve incluir nova versão'
            );
            
            this.assert(
                Array.isArray(result.corrections),
                'Resultado deve incluir array de correções'
            );
            
            this.assert(
                typeof result.totalCorrections === 'number',
                'Resultado deve incluir total de correções'
            );
            
            // Verificar formato da nova versão
            this.assert(
                result.newVersion.includes('2025') || result.newVersion.includes('v'),
                'Nova versão deve seguir padrão de versionamento'
            );
            
            this.pass('Geração de Correções');
            
        } catch (error) {
            this.fail('Geração de Correções', error.message);
        }
    },

    /**
     * 🧪 Teste 5: Exceção do Funk
     */
    async testFunkException() {
        try {
            // Simular dados de teste
            if (typeof window !== 'undefined') {
                const originalRefs = window.PROD_AI_REF_DATA;
                
                // Criar dados de teste com funk
                window.PROD_AI_REF_DATA = {
                    funk: {
                        true_peak_target: -5.0, // Valor problemático
                        tol_true_peak: 2.0
                    },
                    rock: {
                        true_peak_target: -4.0, // Valor problemático
                        tol_true_peak: 2.0
                    }
                };
                
                await this.corrector.performAudit();
                const result = this.corrector.generateCorrectedReferences();
                
                // Verificar correção específica do funk
                const funkCorrection = result.corrections.find(c => c.genre === 'funk');
                this.assert(
                    funkCorrection !== undefined,
                    'Deve haver correção para funk'
                );
                
                this.assert(
                    Math.abs(funkCorrection.newTarget - (-0.8)) < 0.1,
                    'Funk deve ser corrigido para -0.8 dBTP'
                );
                
                // Verificar correção de outros gêneros
                const rockCorrection = result.corrections.find(c => c.genre === 'rock');
                this.assert(
                    rockCorrection !== undefined,
                    'Deve haver correção para rock'
                );
                
                this.assert(
                    Math.abs(rockCorrection.newTarget - (-1.0)) < 0.1,
                    'Rock deve ser corrigido para -1.0 dBTP'
                );
                
                // Restaurar dados originais
                window.PROD_AI_REF_DATA = originalRefs;
            }
            
            this.pass('Exceção do Funk');
            
        } catch (error) {
            this.fail('Exceção do Funk', error.message);
        }
    },

    /**
     * 🧪 Teste 6: Validação de Plausibilidade
     */
    async testPlausibilityValidation() {
        try {
            if (typeof window !== 'undefined') {
                const originalRefs = window.PROD_AI_REF_DATA;
                
                // Criar dados de teste com valores extremos
                window.PROD_AI_REF_DATA = {
                    test1: { true_peak_target: -15.0 }, // Muito baixo
                    test2: { true_peak_target: +2.0 },  // Muito alto
                    test3: { true_peak_target: -1.5 },  // Aceitável
                    test4: { true_peak_target: -0.5 }   // Aceitável
                };
                
                const audit = await this.corrector.performAudit();
                
                // Verificar identificação de problemas
                const issues = audit.issues.filter(i => i.type === 'implausible_target');
                this.assert(
                    issues.length >= 2,
                    'Deve identificar pelo menos 2 targets implausíveis'
                );
                
                // Verificar se valores aceitáveis não são flagados
                const test3Issue = issues.find(i => i.genre === 'test3');
                const test4Issue = issues.find(i => i.genre === 'test4');
                
                this.assert(
                    test3Issue === undefined,
                    'Valor -1.5 dBTP deve ser considerado plausível'
                );
                
                this.assert(
                    test4Issue === undefined,
                    'Valor -0.5 dBTP deve ser considerado plausível'
                );
                
                // Restaurar dados originais
                window.PROD_AI_REF_DATA = originalRefs;
            }
            
            this.pass('Validação de Plausibilidade');
            
        } catch (error) {
            this.fail('Validação de Plausibilidade', error.message);
        }
    },

    /**
     * 🧪 Teste 7: Sistema de Versionamento
     */
    async testVersioning() {
        try {
            const originalVersion = typeof window !== 'undefined' ? window.EMBEDDED_REFS_VERSION : null;
            
            await this.corrector.performAudit();
            const result = this.corrector.generateCorrectedReferences();
            
            // Verificar se nova versão é diferente da original
            this.assert(
                result.newVersion !== result.originalVersion,
                'Nova versão deve ser diferente da original'
            );
            
            // Verificar formato da versão
            this.assert(
                result.newVersion.includes('true-peak-fix') || 
                result.newVersion.includes('tp-fix'),
                'Nova versão deve indicar correção de true-peak'
            );
            
            // Verificar se versão segue padrão temporal
            const hasYear = result.newVersion.includes('2025') || result.newVersion.includes('2024');
            this.assert(
                hasYear,
                'Nova versão deve incluir ano'
            );
            
            this.pass('Sistema de Versionamento');
            
        } catch (error) {
            this.fail('Sistema de Versionamento', error.message);
        }
    },

    /**
     * 🧪 Teste 8: Invalidação de Cache
     */
    async testCacheInvalidation() {
        try {
            // Simular cache existente
            if (typeof window !== 'undefined') {
                window.__AUDIO_ANALYSIS_CACHE__ = new Map();
                window.__AUDIO_ANALYSIS_CACHE__.set('test-key', 'test-value');
                
                window.__refDataCache = { 'test': 'data' };
                
                const initialCacheSize = window.__AUDIO_ANALYSIS_CACHE__.size;
                const initialRefCache = Object.keys(window.__refDataCache).length;
                
                // Executar invalidação
                this.corrector.invalidateCache();
                
                // Verificar se cache foi limpo
                this.assert(
                    window.__AUDIO_ANALYSIS_CACHE__.size === 0,
                    'Cache de análise deve ser limpo'
                );
                
                this.assert(
                    Object.keys(window.__refDataCache).length === 0,
                    'Cache de referências deve ser limpo'
                );
            }
            
            this.pass('Invalidação de Cache');
            
        } catch (error) {
            this.fail('Invalidação de Cache', error.message);
        }
    },

    /**
     * 🧪 Teste 9: Apply e Rollback
     */
    async testApplyAndRollback() {
        try {
            if (typeof window !== 'undefined') {
                // Habilitar feature flag
                window.TRUE_PEAK_CORRECTOR_V1 = true;
                
                const originalRefs = JSON.parse(JSON.stringify(window.PROD_AI_REF_DATA || {}));
                const originalVersion = window.EMBEDDED_REFS_VERSION;
                
                // Preparar correções
                await this.corrector.performAudit();
                this.corrector.generateCorrectedReferences();
                
                // Testar aplicação
                const applySuccess = this.corrector.apply();
                this.assert(
                    applySuccess === true,
                    'apply() deve retornar true quando bem-sucedido'
                );
                
                // Verificar se versão foi atualizada
                this.assert(
                    window.EMBEDDED_REFS_VERSION !== originalVersion,
                    'Versão deve ser atualizada após apply'
                );
                
                // Testar rollback
                const rollbackSuccess = this.corrector.rollback();
                this.assert(
                    rollbackSuccess === true,
                    'rollback() deve retornar true quando bem-sucedido'
                );
                
                // Verificar se versão foi restaurada
                this.assert(
                    window.EMBEDDED_REFS_VERSION === originalVersion,
                    'Versão deve ser restaurada após rollback'
                );
                
                // Restaurar estado
                window.PROD_AI_REF_DATA = originalRefs;
            }
            
            this.pass('Apply e Rollback');
            
        } catch (error) {
            this.fail('Apply e Rollback', error.message);
        }
    },

    /**
     * 🧪 Teste 10: Integridade dos Dados
     */
    async testDataIntegrity() {
        try {
            if (typeof window !== 'undefined') {
                const originalRefs = JSON.parse(JSON.stringify(window.PROD_AI_REF_DATA || {}));
                
                await this.corrector.performAudit();
                this.corrector.generateCorrectedReferences();
                
                // Verificar se apenas true_peak_target foi modificado
                for (const [genre, originalData] of Object.entries(originalRefs)) {
                    const correctedData = this.corrector.correctedReferences[genre];
                    
                    // Verificar se outras propriedades não foram alteradas
                    for (const [key, value] of Object.entries(originalData)) {
                        if (key !== 'true_peak_target' && key !== 'tol_true_peak') {
                            this.assert(
                                JSON.stringify(correctedData[key]) === JSON.stringify(value),
                                `Propriedade ${key} do gênero ${genre} não deve ser alterada`
                            );
                        }
                    }
                }
                
                // Verificar se estrutura legacy_compatibility foi preservada
                for (const [genre, data] of Object.entries(this.corrector.correctedReferences)) {
                    if (originalRefs[genre]?.legacy_compatibility) {
                        this.assert(
                            data.legacy_compatibility !== undefined,
                            `legacy_compatibility do gênero ${genre} deve ser preservada`
                        );
                    }
                }
            }
            
            this.pass('Integridade dos Dados');
            
        } catch (error) {
            this.fail('Integridade dos Dados', error.message);
        }
    },

    /**
     * 🧪 Teste 11: Tratamento de Erros
     */
    async testErrorHandling() {
        try {
            // Testar com dados inválidos
            if (typeof window !== 'undefined') {
                const originalRefs = window.PROD_AI_REF_DATA;
                
                // Simular dados corrompidos
                window.PROD_AI_REF_DATA = null;
                
                try {
                    this.corrector.generateCorrectedReferences();
                    this.fail('Erro não tratado', 'Deveria ter lançado erro com dados inválidos');
                } catch (error) {
                    this.assert(
                        error.message.includes('disponíveis'),
                        'Erro deve indicar dados não disponíveis'
                    );
                }
                
                // Restaurar dados
                window.PROD_AI_REF_DATA = originalRefs;
                
                // Testar apply sem feature flag
                window.TRUE_PEAK_CORRECTOR_V1 = false;
                const applyResult = this.corrector.apply();
                this.assert(
                    applyResult === false,
                    'apply deve retornar false sem feature flag'
                );
            }
            
            this.pass('Tratamento de Erros');
            
        } catch (error) {
            this.fail('Tratamento de Erros', error.message);
        }
    },

    /**
     * 🧪 Teste 12: Cenários Específicos
     */
    async testScenarios() {
        try {
            // Cenário 1: Sistema já corrigido
            if (typeof window !== 'undefined') {
                const originalRefs = window.PROD_AI_REF_DATA;
                
                // Simular dados já corretos
                window.PROD_AI_REF_DATA = {
                    funk: { true_peak_target: -0.8, tol_true_peak: 1.0 },
                    rock: { true_peak_target: -1.0, tol_true_peak: 1.0 },
                    pop: { true_peak_target: -1.0, tol_true_peak: 1.0 }
                };
                
                const audit = await this.corrector.performAudit();
                this.assert(
                    audit.issues.length === 0,
                    'Sistema já corrigido não deve ter issues'
                );
                
                // Cenário 2: Múltiplas aplicações
                window.TRUE_PEAK_CORRECTOR_V1 = true;
                
                // Simular dados problemáticos
                window.PROD_AI_REF_DATA = {
                    test: { true_peak_target: -10.0 }
                };
                
                await this.corrector.performAudit();
                this.corrector.generateCorrectedReferences();
                
                const firstApply = this.corrector.apply();
                const secondApply = this.corrector.apply();
                
                this.assert(
                    firstApply === true && secondApply === true,
                    'Múltiplas aplicações devem ser seguras'
                );
                
                // Restaurar dados
                window.PROD_AI_REF_DATA = originalRefs;
            }
            
            this.pass('Cenários Específicos');
            
        } catch (error) {
            this.fail('Cenários Específicos', error.message);
        }
    },

    /**
     * 🔧 Utilitários de teste
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    },

    pass(testName, details = null) {
        this.testResults.push({
            name: testName,
            passed: true,
            details
        });
        console.log(`[TRUE_PEAK_TESTS] ✅ ${testName}`);
    },

    fail(testName, error = null) {
        this.testResults.push({
            name: testName,
            passed: false,
            error
        });
        console.error(`[TRUE_PEAK_TESTS] ❌ ${testName}`, error);
    },

    getResults() {
        const total = this.testResults.length;
        const passed = this.testResults.filter(t => t.passed).length;
        const failed = total - passed;
        
        return {
            total,
            passed,
            failed,
            success: failed === 0,
            tests: this.testResults,
            summary: `${passed}/${total} testes passaram`
        };
    }
};

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
    window.TruePeakCorrectorTests = TruePeakCorrectorTests;
    console.log('[TRUE_PEAK_TESTS] 🧪 Suíte de testes carregada');
    console.log('[TRUE_PEAK_TESTS] 🚀 Execute: TruePeakCorrectorTests.runAllTests()');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TruePeakCorrectorTests;
}
