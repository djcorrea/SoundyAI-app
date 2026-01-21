/**
 * 🎯 BAND-WEIGHTED SCORE CORRECTOR V2
 * 
 * Sistema inteligente que corrige o cálculo de score/subscore baseado em:
 * - Proporção de bandas verdes vs amarelas/vermelhas
 * - Exclusão correta de valores N/A (não conta como 100%)
 * - Score proporcional: mais verdes = score maior, mais fora = score menor
 * - Validação robusta contra todos os cenários edge-case
 * 
 * 🛡️ FEATURE FLAG: BAND_WEIGHTED_SCORE_V2
 * - true: Sistema ativo com correções aplicadas
 * - false: Sistema original (sem correções)
 */

// 🏳️ FEATURE FLAG GLOBAL
window.BAND_WEIGHTED_SCORE_V2 = true;

(function() {
    'use strict';
    
    // 🔒 PREVENÇÃO DE MÚLTIPLAS EXECUÇÕES
    if (window.__BAND_WEIGHTED_SCORE_V2_LOADED) {
        log('⚠️ BAND_WEIGHTED_SCORE_V2 já carregado, pulando inicialização');
        return;
    }
    window.__BAND_WEIGHTED_SCORE_V2_LOADED = true;
    
    log('🚀 Inicializando BAND_WEIGHTED_SCORE_V2...');
    
    /**
     * 🎯 CORE CLASS: Band Weighted Score Corrector
     */
    class BandWeightedScoreCorrector {
        constructor() {
            this.debug = true;
            this.flagEnabled = window.BAND_WEIGHTED_SCORE_V2;
            
            // 📊 Estatísticas de uso
            this.stats = {
                totalCorrections: 0,
                bandsProcessed: 0,
                naValuesExcluded: 0,
                averageImprovement: 0,
                lastCorrection: null
            };
        }
        
        /**
         * 🎚️ ALGORITMO PRINCIPAL: Calcular score baseado em proporção de bandas
         * 
         * Lógica:
         * - Verde (dentro tolerância): 100% contribuição
         * - Amarelo (1-2x tolerância): 60-80% contribuição  
         * - Vermelho (>2x tolerância): 20-40% contribuição
         * - N/A: Excluído completamente
         * 
         * Score final = (soma ponderada) / (total de bandas válidas)
         */
        calculateBandWeightedScore(technicalData, reference) {
            if (!this.flagEnabled) {
                if (this.debug) log('🔕 BAND_WEIGHTED_SCORE_V2 desabilitado');
                return null;
            }
            
            if (this.debug) {
                log('🎯 BAND_WEIGHTED_SCORE_V2: Iniciando cálculo...');
                log('📊 technicalData keys:', Object.keys(technicalData || {}));
                log('📋 reference:', reference);
            }
            
            const bands = this.extractBands(technicalData);
            const referenceBands = this.extractReferenceBands(reference);
            
            if (!bands || !referenceBands || Object.keys(bands).length === 0) {
                if (this.debug) log('⚠️ Sem bandas disponíveis para análise');
                return null;
            }
            
            const bandResults = [];
            let totalWeight = 0;
            let weightedSum = 0;
            
            // 🔍 Processar cada banda
            for (const [bandName, bandData] of Object.entries(bands)) {
                const refBand = referenceBands[bandName];
                
                if (!refBand) {
                    if (this.debug) log(`⏭️ Banda ${bandName}: sem referência`);
                    continue;
                }
                
                const bandResult = this.calculateBandScore(bandName, bandData, refBand);
                
                if (bandResult.isValid) {
                    bandResults.push(bandResult);
                    totalWeight += bandResult.weight;
                    weightedSum += (bandResult.score * bandResult.weight);
                    
                    if (this.debug) {
                        log(`🎯 Banda ${bandName}: ${bandResult.score.toFixed(1)}% (${bandResult.status}, peso: ${bandResult.weight})`);
                    }
                } else {
                    this.stats.naValuesExcluded++;
                    if (this.debug) log(`🚫 Banda ${bandName}: N/A excluído`);
                }
            }
            
            if (totalWeight === 0) {
                if (this.debug) log('⚠️ Nenhuma banda válida encontrada');
                return { score: 50, method: 'band_weighted_v2_fallback', details: [] };
            }
            
            // 🎯 SCORE FINAL: Média ponderada
            const finalScore = (weightedSum / totalWeight);
            
            // 📊 Estatísticas das bandas
            const greenBands = bandResults.filter(b => b.status === 'green').length;
            const yellowBands = bandResults.filter(b => b.status === 'yellow').length;
            const redBands = bandResults.filter(b => b.status === 'red').length;
            const totalBands = bandResults.length;
            
            const result = {
                score: parseFloat(finalScore.toFixed(1)),
                method: 'band_weighted_v2',
                details: {
                    totalBands,
                    greenBands,
                    yellowBands, 
                    redBands,
                    naExcluded: this.stats.naValuesExcluded,
                    greenPercentage: parseFloat(((greenBands / totalBands) * 100).toFixed(1)),
                    bandResults: bandResults.map(b => ({
                        name: b.name,
                        score: b.score,
                        status: b.status,
                        weight: b.weight,
                        deviation: b.deviation
                    }))
                }
            };
            
            // 📊 Atualizar estatísticas
            this.stats.totalCorrections++;
            this.stats.bandsProcessed += totalBands;
            this.stats.lastCorrection = new Date().toISOString();
            
            if (this.debug) {
                log('🎯 BAND_WEIGHTED_SCORE_V2 resultado:', result);
                log(`📊 Composição: ${greenBands}🟢 ${yellowBands}🟡 ${redBands}🔴 (${this.stats.naValuesExcluded} N/A)`);
            }
            
            return result;
        }
        
        /**
         * 📏 Calcular score individual de uma banda
         */
        calculateBandScore(bandName, bandData, refBand) {
            // Extrair valor da banda
            const value = this.extractBandValue(bandData);
            
            if (!Number.isFinite(value)) {
                return { name: bandName, isValid: false, reason: 'invalid_value' };
            }
            
            const target = refBand.target_db || refBand.target;
            const tolerance = refBand.tol_db || refBand.tolerance || 3;
            
            if (!Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0) {
                return { name: bandName, isValid: false, reason: 'invalid_reference' };
            }
            
            // 📐 Calcular desvio e classificação
            const deviation = Math.abs(value - target);
            const deviationRatio = deviation / tolerance;
            
            let score, status, weight;
            
            if (deviationRatio <= 1.0) {
                // 🟢 VERDE: Dentro da tolerância
                score = 100;
                status = 'green';
                weight = 1.0; // Peso total
            } else if (deviationRatio <= 2.0) {
                // 🟡 AMARELO: 1-2x fora da tolerância
                score = 80 - ((deviationRatio - 1.0) * 20); // 80% a 60%
                status = 'yellow';
                weight = 0.8; // Peso reduzido
            } else if (deviationRatio <= 3.0) {
                // 🟠 LARANJA: 2-3x fora da tolerância 
                score = 60 - ((deviationRatio - 2.0) * 20); // 60% a 40%
                status = 'orange';
                weight = 0.6; // Peso ainda mais reduzido
            } else {
                // 🔴 VERMELHO: >3x fora da tolerância
                score = Math.max(20, 40 - ((deviationRatio - 3.0) * 10)); // 40% a 20% (mínimo)
                status = 'red';
                weight = 0.4; // Peso mínimo
            }
            
            return {
                name: bandName,
                isValid: true,
                value,
                target,
                tolerance,
                deviation,
                deviationRatio: parseFloat(deviationRatio.toFixed(3)),
                score: parseFloat(score.toFixed(1)),
                status,
                weight
            };
        }
        
        /**
         * 🎵 Extrair bandas dos dados técnicos
         */
        extractBands(technicalData) {
            if (!technicalData) return null;
            
            // Tentar bandEnergies primeiro
            if (technicalData.bandEnergies && typeof technicalData.bandEnergies === 'object') {
                return technicalData.bandEnergies;
            }
            
            // Fallback para tonalBalance
            if (technicalData.tonalBalance && typeof technicalData.tonalBalance === 'object') {
                return technicalData.tonalBalance;
            }
            
            // Fallback para estrutura alternativa
            if (technicalData.spectral && technicalData.spectral.bands) {
                return technicalData.spectral.bands;
            }
            
            return null;
        }
        
        /**
         * 📚 Extrair referências das bandas
         */
        extractReferenceBands(reference) {
            if (!reference) return null;
            
            // Estrutura padrão
            if (reference.bands && typeof reference.bands === 'object') {
                return reference.bands;
            }
            
            // Estrutura alternativa
            if (reference.spectral && reference.spectral.bands) {
                return reference.spectral.bands;
            }
            
            return null;
        }
        
        /**
         * 📊 Extrair valor numérico da banda
         */
        extractBandValue(bandData) {
            if (!bandData || typeof bandData !== 'object') {
                return Number.isFinite(bandData) ? bandData : null;
            }
            
            // Tentar diferentes propriedades
            const possibleKeys = ['rms_db', 'rms', 'energy', 'power', 'level', 'value'];
            
            for (const key of possibleKeys) {
                if (Number.isFinite(bandData[key])) {
                    return bandData[key];
                }
            }
            
            return null;
        }
        
        /**
         * 🧪 Executar testes de validação
         */
        runTests() {
            if (!this.flagEnabled) {
                log('🔕 Testes pulados - BAND_WEIGHTED_SCORE_V2 desabilitado');
                return;
            }
            
            log('🧪 Executando testes BAND_WEIGHTED_SCORE_V2...');
            
            const tests = [
                this.testAllGreenBands(),
                this.testMixedBands(), 
                this.testMostlyRedBands(),
                this.testNAHandling(),
                this.testEdgeCases()
            ];
            
            const passed = tests.filter(t => t.passed).length;
            const total = tests.length;
            
            log(`🧪 Resultados: ${passed}/${total} testes passaram`);
            
            tests.forEach(test => {
                const status = test.passed ? '✅' : '❌';
                log(`${status} ${test.name}: ${test.description}`);
                if (!test.passed && test.error) {
                    log(`   Erro: ${test.error}`);
                }
            });
            
            return { passed, total, tests };
        }
        
        /**
         * 🧪 Teste 1: Todas as bandas verdes
         */
        testAllGreenBands() {
            try {
                const mockData = {
                    bandEnergies: {
                        sub: { rms_db: -15.0 },
                        low: { rms_db: -12.0 },
                        mid: { rms_db: -10.0 },
                        high: { rms_db: -8.0 }
                    }
                };
                
                const mockRef = {
                    bands: {
                        sub: { target_db: -15.0, tol_db: 2.0 },
                        low: { target_db: -12.0, tol_db: 2.0 },
                        mid: { target_db: -10.0, tol_db: 2.0 },
                        high: { target_db: -8.0, tol_db: 2.0 }
                    }
                };
                
                const result = this.calculateBandWeightedScore(mockData, mockRef);
                const passed = result && result.score >= 95 && result.details.greenBands === 4;
                
                return {
                    name: 'All Green Bands',
                    passed,
                    description: `Score: ${result?.score}% (esperado: ≥95%)`,
                    result
                };
            } catch (error) {
                return {
                    name: 'All Green Bands',
                    passed: false,
                    error: error.message
                };
            }
        }
        
        /**
         * 🧪 Teste 2: Bandas mistas
         */
        testMixedBands() {
            try {
                const mockData = {
                    bandEnergies: {
                        sub: { rms_db: -15.0 }, // verde
                        low: { rms_db: -10.0 }, // amarelo (2dB fora de -12±2)
                        mid: { rms_db: -5.0 },  // vermelho (5dB fora de -10±2)
                        high: { rms_db: -8.0 }  // verde
                    }
                };
                
                const mockRef = {
                    bands: {
                        sub: { target_db: -15.0, tol_db: 2.0 },
                        low: { target_db: -12.0, tol_db: 2.0 },
                        mid: { target_db: -10.0, tol_db: 2.0 },
                        high: { target_db: -8.0, tol_db: 2.0 }
                    }
                };
                
                const result = this.calculateBandWeightedScore(mockData, mockRef);
                const passed = result && result.score >= 60 && result.score <= 80;
                
                return {
                    name: 'Mixed Bands',
                    passed,
                    description: `Score: ${result?.score}% (esperado: 60-80%)`,
                    result
                };
            } catch (error) {
                return {
                    name: 'Mixed Bands',
                    passed: false,
                    error: error.message
                };
            }
        }
        
        /**
         * 🧪 Teste 3: Principalmente bandas vermelhas
         */
        testMostlyRedBands() {
            try {
                const mockData = {
                    bandEnergies: {
                        sub: { rms_db: -8.0 },  // vermelho (7dB fora de -15±2)
                        low: { rms_db: -5.0 },  // vermelho (7dB fora de -12±2)
                        mid: { rms_db: -3.0 },  // vermelho (7dB fora de -10±2)
                        high: { rms_db: -8.0 }  // verde
                    }
                };
                
                const mockRef = {
                    bands: {
                        sub: { target_db: -15.0, tol_db: 2.0 },
                        low: { target_db: -12.0, tol_db: 2.0 },
                        mid: { target_db: -10.0, tol_db: 2.0 },
                        high: { target_db: -8.0, tol_db: 2.0 }
                    }
                };
                
                const result = this.calculateBandWeightedScore(mockData, mockRef);
                const passed = result && result.score >= 20 && result.score <= 50;
                
                return {
                    name: 'Mostly Red Bands',
                    passed,
                    description: `Score: ${result?.score}% (esperado: 20-50%)`,
                    result
                };
            } catch (error) {
                return {
                    name: 'Mostly Red Bands',
                    passed: false,
                    error: error.message
                };
            }
        }
        
        /**
         * 🧪 Teste 4: Tratamento de N/A
         */
        testNAHandling() {
            try {
                const mockData = {
                    bandEnergies: {
                        sub: { rms_db: -15.0 }, // verde
                        low: { rms_db: null },   // N/A - deve ser excluído
                        mid: { rms_db: undefined }, // N/A - deve ser excluído  
                        high: { rms_db: -8.0 }   // verde
                    }
                };
                
                const mockRef = {
                    bands: {
                        sub: { target_db: -15.0, tol_db: 2.0 },
                        low: { target_db: -12.0, tol_db: 2.0 },
                        mid: { target_db: -10.0, tol_db: 2.0 },
                        high: { target_db: -8.0, tol_db: 2.0 }
                    }
                };
                
                const result = this.calculateBandWeightedScore(mockData, mockRef);
                const passed = result && result.score >= 95 && result.details.totalBands === 2;
                
                return {
                    name: 'N/A Handling',
                    passed,
                    description: `Score: ${result?.score}%, Bandas válidas: ${result?.details?.totalBands} (esperado: 2)`,
                    result
                };
            } catch (error) {
                return {
                    name: 'N/A Handling',
                    passed: false,
                    error: error.message
                };
            }
        }
        
        /**
         * 🧪 Teste 5: Casos extremos
         */
        testEdgeCases() {
            try {
                // Teste com dados vazios
                const emptyResult = this.calculateBandWeightedScore({}, {});
                
                // Teste com referência inválida
                const noRefResult = this.calculateBandWeightedScore({ bandEnergies: { test: { rms_db: -10 } } }, null);
                
                const passed = !emptyResult && !noRefResult;
                
                return {
                    name: 'Edge Cases',
                    passed,
                    description: 'Dados vazios e referências inválidas tratados corretamente'
                };
            } catch (error) {
                return {
                    name: 'Edge Cases',
                    passed: false,
                    error: error.message
                };
            }
        }
        
        /**
         * 📊 Obter estatísticas de uso
         */
        getStats() {
            return { ...this.stats };
        }
        
        /**
         * 🔄 Resetar estatísticas
         */
        clearStats() {
            this.stats = {
                totalCorrections: 0,
                bandsProcessed: 0,
                naValuesExcluded: 0,
                averageImprovement: 0,
                lastCorrection: null
            };
        }
    }
    
    /**
     * 🎯 INTEGRAÇÃO: Patch do sistema de scoring existente
     */
    function patchScoringSystem() {
        const corrector = new BandWeightedScoreCorrector();
        
        // 🔧 Interceptar computeMixScore se existir
        if (typeof window.computeMixScore === 'function') {
            const originalComputeMixScore = window.computeMixScore;
            
            // 🎯 CORREÇÃO: Preservar o terceiro parâmetro (options) para V3 gates
            window.computeMixScore = function(technicalData, reference, options = {}) {
                // 🎯 CORREÇÃO: Garantir que mode seja passado mesmo quando não especificado
                const normalizedOptions = {
                    ...options,
                    mode: options.mode || window.__SOUNDY_ANALYSIS_MODE__ || 'streaming'
                };
                
                if (!window.BAND_WEIGHTED_SCORE_V2) {
                    return originalComputeMixScore.call(this, technicalData, reference, normalizedOptions);
                }
                
                // 📞 Chamar função original com options
                const originalResult = originalComputeMixScore.call(this, technicalData, reference, normalizedOptions);
                
                // 🎯 Aplicar correção se bandas espectrais estão disponíveis
                const bandScore = corrector.calculateBandWeightedScore(technicalData, reference);
                
                if (bandScore && bandScore.score !== null) {
                    log('🎯 BAND_WEIGHTED_SCORE_V2: Correção aplicada');
                    log(`   Score original: ${originalResult.scorePct}%`);
                    log(`   Score corrigido: ${bandScore.score}%`);
                    
                    // 🔄 Aplicar correção
                    originalResult.scorePct = bandScore.score;
                    originalResult.bandWeightedCorrection = bandScore;
                    originalResult.method = 'band_weighted_v2_enhanced';
                }
                
                return originalResult;
            };
            
            log('✅ computeMixScore patcheado com BAND_WEIGHTED_SCORE_V2');
        }
        
        // 🔧 Interceptar frequencySubScoreCorrector se existir
        if (typeof window.frequencySubScoreCorrector === 'object') {
            const original = window.frequencySubScoreCorrector.calculateFrequencySubScore;
            
            if (typeof original === 'function') {
                window.frequencySubScoreCorrector.calculateFrequencySubScore = function(technicalData, scores) {
                    if (!window.BAND_WEIGHTED_SCORE_V2) {
                        return original.call(this, technicalData, scores);
                    }
                    
                    // 🎯 Tentar correção primeiro
                    const reference = this.getCurrentGenreReferences?.() || {};
                    const bandScore = corrector.calculateBandWeightedScore(technicalData, reference);
                    
                    if (bandScore && bandScore.score !== null) {
                        log('🎯 BAND_WEIGHTED_SCORE_V2: Frequency subscore corrigido');
                        log(`   Score: ${bandScore.score}%`);
                        return Math.round(bandScore.score);
                    }
                    
                    // Fallback para método original
                    return original.call(this, technicalData, scores);
                };
                
                log('✅ frequencySubScoreCorrector patcheado com BAND_WEIGHTED_SCORE_V2');
            }
        }
        
        return corrector;
    }
    
    /**
     * 🚀 INICIALIZAÇÃO E API PÚBLICA
     */
    function initialize() {
        const corrector = patchScoringSystem();
        
        // 🎛️ API pública
        window.BAND_WEIGHTED_SCORE_V2_API = {
            corrector,
            getStats: () => corrector.getStats(),
            clearStats: () => corrector.clearStats(),
            runTests: () => corrector.runTests(),
            
            // Controle do feature flag
            enable: () => {
                window.BAND_WEIGHTED_SCORE_V2 = true;
                corrector.flagEnabled = true;
                log('✅ BAND_WEIGHTED_SCORE_V2 habilitado');
            },
            
            disable: () => {
                window.BAND_WEIGHTED_SCORE_V2 = false;
                corrector.flagEnabled = false;
                log('🔕 BAND_WEIGHTED_SCORE_V2 desabilitado');
            },
            
            // Teste manual
            testScore: (technicalData, reference) => {
                return corrector.calculateBandWeightedScore(technicalData, reference);
            }
        };
        
        log('🎯 BAND_WEIGHTED_SCORE_V2 inicializado com sucesso!');
        log('🎛️ API disponível em: window.BAND_WEIGHTED_SCORE_V2_API');
        
        // 🧪 Executar testes automáticos se em modo debug
        if (corrector.debug) {
            setTimeout(() => {
                log('🧪 Executando testes automáticos...');
                corrector.runTests();
            }, 1000);
        }
    }
    
    // 🚀 EXECUÇÃO: Aguardar DOM ou executar imediatamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();

/**
 * 🧪 TESTE RÁPIDO GLOBAL
 * Para verificar funcionamento no console
 */
function testBandWeightedScore() {
    log('🧪 Testando BAND_WEIGHTED_SCORE_V2...');
    
    const api = window.BAND_WEIGHTED_SCORE_V2_API;
    if (!api) {
        error('❌ API não disponível');
        return;
    }
    
    log('📊 Estado atual:', {
        flagEnabled: window.BAND_WEIGHTED_SCORE_V2,
        stats: api.getStats()
    });
    
    // Executar testes
    const testResults = api.runTests();
    log('🧪 Resultados dos testes:', testResults);
    
    log('✅ Teste concluído - verifique logs acima');
}

// Disponibilizar teste globalmente
window.testBandWeightedScore = testBandWeightedScore;

log('📦 BAND_WEIGHTED_SCORE_V2 carregado - Execute testBandWeightedScore() para testar');
