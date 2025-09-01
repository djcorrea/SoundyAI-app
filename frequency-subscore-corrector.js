// 🎵 FREQUENCY SUBSCORE CORRECTOR V1
// Sistema seguro de correção do subscore de frequência baseado em bandas espectrais
// Implementa régua linear: dif=0→100, dif=tol→~50, dif≥2·tol→0
// Exclui bandas N/A e agrega com pesos iguais

class FrequencySubScoreCorrector {
    constructor() {
        this.featureFlagEnabled = false;
        this.patchApplied = false;
        this.originalFrequencyCalculation = null;
        this.originalAggregateCategory = null;
        this.debug = true;
        
        console.log('[FREQ_SUBSCORE_V1] 🎵 FrequencySubScoreCorrector inicializado');
    }

    /**
     * 🚩 Verificar se a feature flag está habilitada
     */
    checkFeatureFlag() {
        if (typeof window !== 'undefined') {
            this.featureFlagEnabled = !!(
                window.FREQ_SUBSCORE_RULER_V1 || 
                window.FEATURE_FLAGS?.FREQ_SUBSCORE_RULER_V1 ||
                localStorage.getItem('FREQ_SUBSCORE_RULER_V1') === 'true'
            );
        }
        
        if (this.debug) {
            console.log('[FREQ_SUBSCORE_V1] 🚩 Feature flag status:', this.featureFlagEnabled);
        }
        
        return this.featureFlagEnabled;
    }

    /**
     * 🔧 Aplicar patch no sistema de subscore
     */
    apply() {
        if (!this.checkFeatureFlag()) {
            console.log('[FREQ_SUBSCORE_V1] ⏸️ Feature flag desabilitada - patch não aplicado');
            return false;
        }

        if (this.patchApplied) {
            console.log('[FREQ_SUBSCORE_V1] ⚠️ Patch já aplicado');
            return true;
        }

        try {
            if (typeof window !== 'undefined' && window.SubScoreCorrector) {
                // Salvar método original
                this.originalAggregateCategory = window.SubScoreCorrector.prototype.aggregateCategory;
                
                // Aplicar novo método
                window.SubScoreCorrector.prototype.aggregateCategory = this.createNewAggregateCategory();
                
                this.patchApplied = true;
                console.log('[FREQ_SUBSCORE_V1] ✅ Patch aplicado com sucesso');
                return true;
            } else {
                console.warn('[FREQ_SUBSCORE_V1] ⚠️ SubScoreCorrector não encontrado');
                return false;
            }
        } catch (error) {
            console.error('[FREQ_SUBSCORE_V1] ❌ Erro ao aplicar patch:', error);
            return false;
        }
    }

    /**
     * 🔄 Remover patch e restaurar sistema original
     */
    remove() {
        if (!this.patchApplied || !this.originalAggregateCategory) {
            console.log('[FREQ_SUBSCORE_V1] ⚠️ Nenhum patch para remover');
            return false;
        }

        try {
            // Restaurar método original
            window.SubScoreCorrector.prototype.aggregateCategory = this.originalAggregateCategory;
            
            this.patchApplied = false;
            console.log('[FREQ_SUBSCORE_V1] ✅ Patch removido com sucesso');
            return true;
        } catch (error) {
            console.error('[FREQ_SUBSCORE_V1] ❌ Erro ao remover patch:', error);
            return false;
        }
    }

    /**
     * 🎯 Novo método aggregateCategory com correção de frequência
     */
    createNewAggregateCategory() {
        const self = this;
        
        return function(metricKeys, scores, technicalData = null) {
            // Para categoria frequency, usar nova lógica baseada em bandas
            if (metricKeys.includes('spectralCentroid') && metricKeys.includes('spectralRolloff50')) {
                return self.calculateFrequencySubScore.call(this, technicalData, scores);
            }
            
            // Para outras categorias, usar método original
            if (self.originalAggregateCategory) {
                return self.originalAggregateCategory.call(this, metricKeys, scores, technicalData);
            }
            
            // Fallback padrão
            return self.fallbackAggregateCategory(metricKeys, scores, technicalData);
        };
    }

    /**
     * 🎵 Calcular subscore de frequência baseado em bandas espectrais
     */
    calculateFrequencySubScore(technicalData, scores) {
        if (this.debug) {
            console.log('[FREQ_SUBSCORE_V1] 🎵 Calculando subscore de frequência com nova lógica');
        }

        try {
            // 1. Tentar usar bandas espectrais (método preferido)
            const bandScore = this.calculateBandBasedScore(technicalData);
            if (bandScore !== null) {
                if (this.debug) {
                    console.log('[FREQ_SUBSCORE_V1] ✅ Usando score baseado em bandas:', bandScore);
                }
                return Math.round(bandScore);
            }

            // 2. Fallback para métricas espectrais tradicionais
            const spectralScore = this.calculateSpectralScore(scores);
            if (spectralScore !== null) {
                if (this.debug) {
                    console.log('[FREQ_SUBSCORE_V1] ✅ Usando score espectral tradicional:', spectralScore);
                }
                return Math.round(spectralScore);
            }

            // 3. Último fallback - score neutro
            if (this.debug) {
                console.log('[FREQ_SUBSCORE_V1] ⚠️ Usando score neutro (50) - dados insuficientes');
            }
            return 50;

        } catch (error) {
            console.error('[FREQ_SUBSCORE_V1] ❌ Erro no cálculo de frequência:', error);
            return this.fallbackAggregateCategory(['spectralCentroid', 'spectralRolloff50', 'spectralRolloff85'], scores, technicalData);
        }
    }

    /**
     * 🎚️ Calcular score baseado em bandas espectrais
     */
    calculateBandBasedScore(technicalData) {
        if (!technicalData) return null;

        // Acessar bandEnergies ou tonalBalance
        const bands = technicalData.bandEnergies || technicalData.tonalBalance;
        if (!bands) return null;

        // Obter referências do gênero atual
        const references = this.getCurrentGenreReferences();
        if (!references || !references.bands) return null;

        if (this.debug) {
            console.log('[FREQ_SUBSCORE_V1] 🎚️ Processando bandas:', Object.keys(bands));
            console.log('[FREQ_SUBSCORE_V1] 📚 Referências disponíveis:', Object.keys(references.bands));
        }

        const bandScores = [];
        const bandDetails = [];

        // Processar cada banda disponível
        for (const [bandName, bandData] of Object.entries(bands)) {
            const bandRef = references.bands[bandName];
            if (!bandRef || !Number.isFinite(bandData?.rms_db)) {
                if (this.debug) {
                    console.log(`[FREQ_SUBSCORE_V1] ⏭️ Banda ${bandName} ignorada - sem dados ou referência`);
                }
                continue;
            }

            const score = this.calculateBandScore(bandData.rms_db, bandRef);
            if (score !== null) {
                bandScores.push(score);
                bandDetails.push({
                    band: bandName,
                    value: bandData.rms_db,
                    target: bandRef.target_db,
                    tolerance: bandRef.tol_db,
                    score: score
                });

                if (this.debug) {
                    console.log(`[FREQ_SUBSCORE_V1] 🎯 Banda ${bandName}: ${bandData.rms_db}dB → ${score.toFixed(1)}% (target: ${bandRef.target_db}±${bandRef.tol_db})`);
                }
            }
        }

        if (bandScores.length === 0) {
            if (this.debug) {
                console.log('[FREQ_SUBSCORE_V1] ⚠️ Nenhuma banda válida encontrada');
            }
            return null;
        }

        // Calcular média aritmética simples (pesos iguais)
        const finalScore = bandScores.reduce((sum, score) => sum + score, 0) / bandScores.length;

        if (this.debug) {
            console.log('[FREQ_SUBSCORE_V1] 📊 Detalhes das bandas:', bandDetails);
            console.log(`[FREQ_SUBSCORE_V1] 🎯 Score final: ${finalScore.toFixed(1)}% (${bandScores.length} bandas)`);
        }

        return finalScore;
    }

    /**
     * 📏 Calcular score individual de uma banda usando régua linear
     */
    calculateBandScore(value, reference) {
        if (!Number.isFinite(value) || !reference) return null;

        const target = reference.target_db;
        const tolerance = reference.tol_db || reference.tolerance || 3; // fallback 3dB

        if (!Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0) {
            return null;
        }

        // Régua linear: dif=0→100, dif=tol→~50, dif≥2·tol→0
        const difference = Math.abs(value - target);
        
        if (difference === 0) {
            return 100; // Perfeito
        } else if (difference <= tolerance) {
            // Linear de 100 até ~50
            return 100 - (difference / tolerance) * 50;
        } else if (difference < 2 * tolerance) {
            // Linear de ~50 até 0
            return 50 - ((difference - tolerance) / tolerance) * 50;
        } else {
            return 0; // Muito fora da tolerância
        }
    }

    /**
     * 🎼 Calcular score usando métricas espectrais tradicionais (fallback)
     */
    calculateSpectralScore(scores) {
        const spectralMetrics = ['spectralCentroid', 'spectralRolloff50', 'spectralRolloff85'];
        const validScores = [];

        spectralMetrics.forEach(metric => {
            if (scores[metric] !== null && Number.isFinite(scores[metric])) {
                validScores.push(scores[metric]);
            }
        });

        if (validScores.length === 0) return null;

        const average = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
        return average * 100; // Converter para porcentagem
    }

    /**
     * 📚 Obter referências do gênero atual
     */
    getCurrentGenreReferences() {
        try {
            // Tentar várias fontes de referências
            if (typeof window !== 'undefined') {
                // Fonte 1: window.currentGenreRef
                if (window.currentGenreRef?.bands) {
                    return window.currentGenreRef;
                }

                // Fonte 2: window.activeReference
                if (window.activeReference?.bands) {
                    return window.activeReference;
                }

                // Fonte 3: embedded-refs mais recente
                if (window.embeddedReferences) {
                    const genres = Object.keys(window.embeddedReferences);
                    if (genres.length > 0) {
                        return window.embeddedReferences[genres[0]];
                    }
                }
            }

            if (this.debug) {
                console.log('[FREQ_SUBSCORE_V1] ⚠️ Referências de gênero não encontradas');
            }
            return null;

        } catch (error) {
            console.error('[FREQ_SUBSCORE_V1] ❌ Erro ao obter referências:', error);
            return null;
        }
    }

    /**
     * 🔄 Método aggregateCategory de fallback
     */
    fallbackAggregateCategory(metricKeys, scores, technicalData) {
        const validScores = [];
        
        metricKeys.forEach(key => {
            if (key === 'clippingSamples' && technicalData) {
                const samples = technicalData.clippingSamples;
                const clipScore = Number.isFinite(samples) ? (samples === 0 ? 1 : samples < 10 ? 0.7 : 0) : null;
                if (clipScore !== null) validScores.push(clipScore);
            } else if (scores[key] !== null && Number.isFinite(scores[key])) {
                validScores.push(scores[key]);
            }
        });
        
        if (validScores.length === 0) return 50;
        
        const average = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
        return Math.round(average * 100);
    }

    /**
     * 🧪 Executar testes de validação
     */
    runTests() {
        console.log('[FREQ_SUBSCORE_V1] 🧪 Executando testes de validação...');

        const tests = [
            this.testPinkNoise(),
            this.testLowShelfFilter(),
            this.testFewGreenBands(),
            this.testNAHandling(),
            this.testGenreSwitching()
        ];

        const passed = tests.filter(test => test.passed).length;
        const total = tests.length;

        console.log(`[FREQ_SUBSCORE_V1] 🧪 Testes concluídos: ${passed}/${total} passaram`);
        
        return {
            passed,
            total,
            success: passed === total,
            tests
        };
    }

    /**
     * 🧪 Teste 1: Pink noise (bandas balanceadas)
     */
    testPinkNoise() {
        const mockData = {
            bandEnergies: {
                sub: { rms_db: -15 },
                low: { rms_db: -12 },
                mid: { rms_db: -10 },
                high: { rms_db: -18 }
            }
        };

        const mockRef = {
            bands: {
                sub: { target_db: -15, tol_db: 3 },
                low: { target_db: -12, tol_db: 3 },
                mid: { target_db: -10, tol_db: 3 },
                high: { target_db: -18, tol_db: 3 }
            }
        };

        // Mock getCurrentGenreReferences
        const originalMethod = this.getCurrentGenreReferences;
        this.getCurrentGenreReferences = () => mockRef;

        try {
            const score = this.calculateBandBasedScore(mockData);
            const passed = score === 100; // Todas as bandas exatas

            this.getCurrentGenreReferences = originalMethod;
            
            return {
                name: 'Pink Noise Test',
                passed,
                expected: 100,
                actual: score,
                description: 'Bandas balanceadas devem resultar em score 100%'
            };
        } catch (error) {
            this.getCurrentGenreReferences = originalMethod;
            return {
                name: 'Pink Noise Test',
                passed: false,
                error: error.message
            };
        }
    }

    /**
     * 🧪 Teste 2: Low-shelf filter (sub/low em excesso)
     */
    testLowShelfFilter() {
        const mockData = {
            bandEnergies: {
                sub: { rms_db: -5 },  // +10dB acima do target
                low: { rms_db: -2 },  // +10dB acima do target
                mid: { rms_db: -10 }, // exato
                high: { rms_db: -18 } // exato
            }
        };

        const mockRef = {
            bands: {
                sub: { target_db: -15, tol_db: 3 },
                low: { target_db: -12, tol_db: 3 },
                mid: { target_db: -10, tol_db: 3 },
                high: { target_db: -18, tol_db: 3 }
            }
        };

        const originalMethod = this.getCurrentGenreReferences;
        this.getCurrentGenreReferences = () => mockRef;

        try {
            const score = this.calculateBandBasedScore(mockData);
            const passed = score < 60; // Score baixo devido ao excesso de graves

            this.getCurrentGenreReferences = originalMethod;
            
            return {
                name: 'Low-Shelf Filter Test',
                passed,
                expected: '< 60',
                actual: score,
                description: 'Excesso de graves deve penalizar o score'
            };
        } catch (error) {
            this.getCurrentGenreReferences = originalMethod;
            return {
                name: 'Low-Shelf Filter Test',
                passed: false,
                error: error.message
            };
        }
    }

    /**
     * 🧪 Teste 3: Poucas bandas verdes
     */
    testFewGreenBands() {
        const mockData = {
            bandEnergies: {
                sub: { rms_db: -15 }, // verde (exato)
                low: { rms_db: -20 }, // vermelho (-8dB do target)
                mid: { rms_db: -20 }, // vermelho (-10dB do target)
                high: { rms_db: -28 } // vermelho (-10dB do target)
            }
        };

        const mockRef = {
            bands: {
                sub: { target_db: -15, tol_db: 3 },
                low: { target_db: -12, tol_db: 3 },
                mid: { target_db: -10, tol_db: 3 },
                high: { target_db: -18, tol_db: 3 }
            }
        };

        const originalMethod = this.getCurrentGenreReferences;
        this.getCurrentGenreReferences = () => mockRef;

        try {
            const score = this.calculateBandBasedScore(mockData);
            const passed = score >= 20 && score <= 40; // Score baixo mas não zero

            this.getCurrentGenreReferences = originalMethod;
            
            return {
                name: 'Few Green Bands Test',
                passed,
                expected: '20-40',
                actual: score,
                description: '1 banda verde + 3 vermelhas deve dar score baixo'
            };
        } catch (error) {
            this.getCurrentGenreReferences = originalMethod;
            return {
                name: 'Few Green Bands Test',
                passed: false,
                error: error.message
            };
        }
    }

    /**
     * 🧪 Teste 4: Tratamento de valores N/A
     */
    testNAHandling() {
        const mockData = {
            bandEnergies: {
                sub: { rms_db: -15 }, // verde
                low: { rms_db: null }, // N/A - deve ser ignorado
                mid: { rms_db: -10 }, // verde
                high: { rms_db: undefined } // N/A - deve ser ignorado
            }
        };

        const mockRef = {
            bands: {
                sub: { target_db: -15, tol_db: 3 },
                low: { target_db: -12, tol_db: 3 },
                mid: { target_db: -10, tol_db: 3 },
                high: { target_db: -18, tol_db: 3 }
            }
        };

        const originalMethod = this.getCurrentGenreReferences;
        this.getCurrentGenreReferences = () => mockRef;

        try {
            const score = this.calculateBandBasedScore(mockData);
            const passed = score === 100; // Apenas bandas válidas (sub e mid) devem ser consideradas

            this.getCurrentGenreReferences = originalMethod;
            
            return {
                name: 'N/A Handling Test',
                passed,
                expected: 100,
                actual: score,
                description: 'Valores N/A devem ser excluídos do cálculo'
            };
        } catch (error) {
            this.getCurrentGenreReferences = originalMethod;
            return {
                name: 'N/A Handling Test',
                passed: false,
                error: error.message
            };
        }
    }

    /**
     * 🧪 Teste 5: Mudança de gênero
     */
    testGenreSwitching() {
        // Dados que favorecem Electronic (graves fortes, agudos moderados)
        const mockData = {
            bandEnergies: {
                sub: { rms_db: -12 },  // Graves muito presentes
                low: { rms_db: -8 },   // Bass forte
                mid: { rms_db: -15 },  // Mid moderado
                high: { rms_db: -20 }  // Agudos suaves
            }
        };

        // Referência Electronic (favorece graves)
        const electronicRef = {
            bands: {
                sub: { target_db: -12, tol_db: 3 },  // Exato no target
                low: { target_db: -8, tol_db: 3 },   // Exato no target
                mid: { target_db: -14, tol_db: 3 },  // Próximo
                high: { target_db: -18, tol_db: 3 }  // Próximo
            }
        };

        const originalMethod = this.getCurrentGenreReferences;
        this.getCurrentGenreReferences = () => electronicRef;

        try {
            const electroniceScore = this.calculateBandBasedScore(mockData);
            
            // Referência Rock (favorece equilíbrio/agudos)
            const rockRef = {
                bands: {
                    sub: { target_db: -25, tol_db: 3 },  // Muito fora (graves demais)
                    low: { target_db: -18, tol_db: 3 },  // Muito fora (bass demais)
                    mid: { target_db: -10, tol_db: 3 },  // Fora (mid baixo demais)
                    high: { target_db: -12, tol_db: 3 }  // Muito fora (agudos baixos demais)
                }
            };

            this.getCurrentGenreReferences = () => rockRef;
            const rockScore = this.calculateBandBasedScore(mockData);

            const difference = Math.abs(electroniceScore - rockScore);
            const passed = difference > 15; // Threshold mais realístico

            this.getCurrentGenreReferences = originalMethod;
            
            return {
                name: 'Genre Switching Test',
                passed,
                expected: 'Difference > 15',
                actual: `Electronic: ${electroniceScore?.toFixed(1) || 'null'}, Rock: ${rockScore?.toFixed(1) || 'null'}, Diff: ${difference?.toFixed(1) || 'null'}`,
                description: 'Diferentes gêneros devem resultar em scores muito diferentes'
            };
        } catch (error) {
            this.getCurrentGenreReferences = originalMethod;
            return {
                name: 'Genre Switching Test',
                passed: false,
                error: error.message
            };
        }
    }

    /**
     * 📊 Gerar relatório de status do sistema
     */
    getStatus() {
        return {
            featureFlag: this.featureFlagEnabled,
            patchApplied: this.patchApplied,
            version: '1.0.0',
            lastCheck: new Date().toISOString(),
            systemReady: this.featureFlagEnabled && this.patchApplied
        };
    }
}

// Instância global
if (typeof window !== 'undefined') {
    window.FrequencySubScoreCorrector = FrequencySubScoreCorrector;
    window.frequencySubScoreCorrector = new FrequencySubScoreCorrector();
    
    console.log('[FREQ_SUBSCORE_V1] 🎵 Sistema de correção de frequência carregado');
    console.log('[FREQ_SUBSCORE_V1] 💡 Para ativar: window.FREQ_SUBSCORE_RULER_V1 = true');
    console.log('[FREQ_SUBSCORE_V1] 🔧 Para aplicar: window.frequencySubScoreCorrector.apply()');
    console.log('[FREQ_SUBSCORE_V1] 🧪 Para testar: window.frequencySubScoreCorrector.runTests()');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrequencySubScoreCorrector;
}
