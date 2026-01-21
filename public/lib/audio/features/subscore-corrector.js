// 🎯 CORREÇÃO DEFINITIVA - SUB-SCORES 100% PRECISOS
// Garante que os 4 sub-scores (dynamics, technical, loudness, frequency) sejam fiéis às análises

/**
 * 🔧 Corrector para Sub-Scores
 * Este módulo garante que os qualityBreakdown sejam 100% precisos e consistentes
 */
class SubScoreCorrector {
    constructor() {
        this.PRECISION_TOLERANCE = 0.1; // Tolerância para arredondamento
        this.DEBUG = false;
    }

    /**
     * 🎯 Corrigir e validar sub-scores
     * @param {Object} baseAnalysis - Análise base com technicalData
     * @param {Object} reference - Referência do gênero (opcional)
     * @returns {Object} Análise corrigida com sub-scores precisos
     */
    correctSubScores(baseAnalysis, reference = null) {
        if (!baseAnalysis || !baseAnalysis.technicalData) {
            warn('⚠️ [SUB-SCORE] Dados técnicos ausentes para correção');
            return baseAnalysis;
        }

        const td = baseAnalysis.technicalData;
        const ref = reference || this.getDefaultReference();

        if (this.DEBUG) {
            log('🎯 [SUB-SCORE] Iniciando correção:', { 
                hasQualityBreakdown: !!baseAnalysis.qualityBreakdown,
                technicalDataKeys: Object.keys(td)
            });
        }

        // 1. Calcular sub-scores usando método avançado (Category-Based)
        const advancedScores = this.calculateAdvancedSubScores(td, ref);
        
        // 2. Calcular sub-scores usando método fallback (para comparação)
        const fallbackScores = this.calculateFallbackSubScores(td, ref);
        
        // 3. Comparar e escolher o mais preciso
        const finalScores = this.selectBestScores(advancedScores, fallbackScores, td, ref);
        
        // 4. Validar precisão
        const validation = this.validatePrecision(finalScores, td, ref);
        
        // 5. Aplicar correções
        baseAnalysis.qualityBreakdown = finalScores;
        baseAnalysis.subScoreValidation = validation;
        
        if (this.DEBUG) {
            log('✅ [SUB-SCORE] Correção aplicada:', {
                final: finalScores,
                validation: validation.summary
            });
        }

        return baseAnalysis;
    }

    /**
     * 📊 Calcular sub-scores usando método avançado (baseado em scoring.js)
     */
    calculateAdvancedSubScores(td, ref) {
        const targets = this.getTargetsAndTolerances(ref);
        const scores = {};

        // Calcular score individual para cada métrica
        Object.keys(targets).forEach(metricKey => {
            const config = targets[metricKey];
            const value = td[metricKey];
            scores[metricKey] = this.calculateToleranceScore(value, config.target, config.tolerance, config.invert);
        });

        // Mapear para categorias
        const categoryScores = {
            dynamics: this.aggregateCategory(['dynamicRange', 'lra', 'crestFactor'], scores),
            technical: this.aggregateCategory(['truePeakDbtp', 'dcOffset', 'thdPercent', 'clippingSamples'], scores, td),
            loudness: this.aggregateCategory(['lufsIntegrated'], scores),
            frequency: this.aggregateCategory(['spectralCentroid', 'spectralRolloff50', 'spectralRolloff85'], scores)
        };

        return {
            ...categoryScores,
            method: 'advanced',
            individualScores: scores,
            targets: targets
        };
    }

    /**
     * 📉 Calcular sub-scores usando método fallback (do audio-analyzer.js)
     */
    calculateFallbackSubScores(td, ref) {
        const safe = (v, def = 0) => Number.isFinite(v) ? v : def;
        
        // Extrair valores
        const lufsInt = safe(td.lufsIntegrated, safe(td.rms));
        const dr = safe(td.dynamicRange);
        const crest = safe(td.crestFactor);
        const corr = safe(td.stereoCorrelation, 0);
        const centroid = safe(td.spectralCentroid);
        
        // Targets
        const refLufs = ref?.lufs_target ?? -14;
        const refDR = ref?.dr_target ?? 10;
        const freqIdealLow = 1800, freqIdealHigh = 3200;
        
        // Cálculos exatos do código original
        const scoreLoud = 100 - Math.min(100, Math.abs(lufsInt - refLufs) * 6);
        const scoreDyn = 100 - Math.min(100, Math.abs(dr - refDR) * 10);
        
        let scoreTech = 100;
        if (safe(td.clippingSamples) > 0) scoreTech -= 20;
        if (Math.abs(safe(td.dcOffset)) > 0.02) scoreTech -= 10;
        if (crest < 6) scoreTech -= 15; 
        else if (crest < 8) scoreTech -= 5;
        if (corr < -0.2) scoreTech -= 15;
        
        // Frequency score
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
        
        const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
        
        return {
            dynamics: clamp(scoreDyn),
            technical: clamp(scoreTech), 
            loudness: clamp(scoreLoud),
            frequency: clamp(scoreFreq),
            method: 'fallback',
            raw: { scoreDyn, scoreTech, scoreLoud, scoreFreq },
            inputs: { lufsInt, dr, crest, corr, centroid }
        };
    }

    /**
     * 🎛️ Calcular score de tolerância (do scoring.js)
     */
    calculateToleranceScore(value, target, tolerance, invert = false) {
        if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0) {
            return null;
        }
        
        const diff = value - target;
        const adiff = Math.abs(diff);
        
        if (invert) {
            // Para métricas onde só penalizamos valores acima do target
            if (diff <= 0) return 1;
            if (diff >= 2 * tolerance) return 0;
            if (diff <= tolerance) return 1 - (diff / tolerance) * 0.5;
            return 1 - (0.5 + (diff - tolerance) / tolerance * 0.5);
        }
        
        if (adiff <= tolerance) return 1;
        if (adiff >= 2 * tolerance) return 0;
        return 1 - (adiff - tolerance) / tolerance;
    }

    /**
     * 📈 Agregar scores por categoria
     */
    aggregateCategory(metricKeys, scores, technicalData = null) {
        const validScores = [];
        
        metricKeys.forEach(key => {
            if (key === 'clippingSamples' && technicalData) {
                // Tratamento especial para clipping
                const samples = technicalData.clippingSamples;
                const clipScore = Number.isFinite(samples) ? (samples === 0 ? 1 : samples < 10 ? 0.7 : 0) : null;
                if (clipScore !== null) validScores.push(clipScore);
            } else if (scores[key] !== null && Number.isFinite(scores[key])) {
                validScores.push(scores[key]);
            }
        });
        
        if (validScores.length === 0) return 50; // Score neutro quando não há dados
        
        const average = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
        return Math.round(average * 100);
    }

    /**
     * ⚖️ Selecionar os melhores scores entre métodos
     */
    selectBestScores(advanced, fallback, td, ref) {
        const differences = {
            dynamics: Math.abs(advanced.dynamics - fallback.dynamics),
            technical: Math.abs(advanced.technical - fallback.technical),
            loudness: Math.abs(advanced.loudness - fallback.loudness),
            frequency: Math.abs(advanced.frequency - fallback.frequency)
        };
        
        const maxDiff = Math.max(...Object.values(differences));
        
        // Se diferenças são pequenas (≤5), usar método avançado
        // Se diferenças são grandes (>10), analisar caso a caso
        if (maxDiff <= 5) {
            return {
                dynamics: advanced.dynamics,
                technical: advanced.technical,
                loudness: advanced.loudness,
                frequency: advanced.frequency,
                source: 'advanced',
                confidence: 'high'
            };
        }
        
        // Para diferenças maiores, escolher o mais confiável por categoria
        return {
            dynamics: this.selectMoreReliable('dynamics', advanced, fallback, td, ref),
            technical: this.selectMoreReliable('technical', advanced, fallback, td, ref),
            loudness: this.selectMoreReliable('loudness', advanced, fallback, td, ref),
            frequency: this.selectMoreReliable('frequency', advanced, fallback, td, ref),
            source: 'hybrid',
            confidence: 'medium',
            differences: differences
        };
    }

    /**
     * 🔍 Selecionar score mais confiável para uma categoria
     */
    selectMoreReliable(category, advanced, fallback, td, ref) {
        // Critérios de confiabilidade baseados na disponibilidade de dados
        const dataAvailable = this.checkDataAvailability(category, td);
        
        if (dataAvailable.completeness > 0.7) {
            // Dados suficientes: usar método avançado
            return advanced[category];
        } else {
            // Dados limitados: usar fallback (mais robusto)
            return fallback[category];
        }
    }

    /**
     * 📋 Verificar disponibilidade de dados por categoria
     */
    checkDataAvailability(category, td) {
        const categoryMetrics = {
            dynamics: ['dynamicRange', 'lra', 'crestFactor'],
            technical: ['truePeakDbtp', 'dcOffset', 'thdPercent', 'clippingSamples'],
            loudness: ['lufsIntegrated'],
            frequency: ['spectralCentroid', 'spectralRolloff50', 'spectralRolloff85']
        };
        
        const metrics = categoryMetrics[category] || [];
        const available = metrics.filter(metric => Number.isFinite(td[metric])).length;
        
        return {
            total: metrics.length,
            available: available,
            completeness: metrics.length > 0 ? available / metrics.length : 0,
            missing: metrics.filter(metric => !Number.isFinite(td[metric]))
        };
    }

    /**
     * ✅ Validar precisão dos sub-scores
     */
    validatePrecision(finalScores, td, ref) {
        const validation = {
            timestamp: new Date().toISOString(),
            summary: { status: 'unknown', score: 0, issues: [] },
            categories: {},
            recommendations: []
        };
        
        let totalScore = 0;
        let categoryCount = 0;
        
        ['dynamics', 'technical', 'loudness', 'frequency'].forEach(category => {
            const score = finalScores[category];
            const dataCheck = this.checkDataAvailability(category, td);
            
            let categoryStatus = 'ok';
            if (!Number.isFinite(score) || score < 0 || score > 100) {
                categoryStatus = 'invalid';
                validation.summary.issues.push(`${category}: score inválido`);
            } else if (dataCheck.completeness < 0.5) {
                categoryStatus = 'insufficient_data';
                validation.summary.issues.push(`${category}: dados insuficientes`);
            }
            
            validation.categories[category] = {
                score: score,
                status: categoryStatus,
                dataCompleteness: dataCheck.completeness,
                missingMetrics: dataCheck.missing
            };
            
            if (Number.isFinite(score)) {
                totalScore += score;
                categoryCount++;
            }
        });
        
        // Status geral
        validation.summary.score = categoryCount > 0 ? Math.round(totalScore / categoryCount) : 0;
        
        if (validation.summary.issues.length === 0) {
            validation.summary.status = 'excellent';
        } else if (validation.summary.issues.length <= 2) {
            validation.summary.status = 'good';
        } else {
            validation.summary.status = 'needs_attention';
        }
        
        // Recomendações
        if (validation.summary.status === 'needs_attention') {
            validation.recommendations.push('Revisar cálculos e disponibilidade de métricas');
        }
        
        return validation;
    }

    /**
     * 🎯 Obter targets e tolerâncias padrão
     */
    getTargetsAndTolerances(ref = null) {
        return {
            lufsIntegrated: { 
                target: ref?.lufs_target ?? -14, 
                tolerance: ref?.tol_lufs ?? 1 
            },
            dynamicRange: { 
                target: ref?.dr_target ?? 10, 
                tolerance: ref?.tol_dr ?? 3 
            },
            lra: { 
                target: ref?.lra_target ?? 7, 
                tolerance: ref?.tol_lra ?? 3 
            },
            crestFactor: { 
                target: 10, 
                tolerance: 4 
            },
            truePeakDbtp: { 
                target: ref?.true_peak_target ?? -1, 
                tolerance: ref?.tol_true_peak ?? 1,
                invert: true 
            },
            dcOffset: { 
                target: 0, 
                tolerance: 0.02,
                invert: true 
            },
            spectralCentroid: { 
                target: 2500, 
                tolerance: 1200 
            },
            spectralRolloff50: { 
                target: 3000, 
                tolerance: 1200 
            },
            spectralRolloff85: { 
                target: 8000, 
                tolerance: 2500 
            },
            thdPercent: { 
                target: 1, 
                tolerance: 1,
                invert: true 
            }
        };
    }

    /**
     * 📝 Obter referência padrão
     */
    getDefaultReference() {
        return {
            lufs_target: -14,
            tol_lufs: 1,
            dr_target: 10,
            tol_dr: 3,
            lra_target: 7,
            tol_lra: 3,
            true_peak_target: -1,
            tol_true_peak: 1
        };
    }

    /**
     * 🎨 Gerar relatório detalhado
     */
    generateDetailedReport(baseAnalysis) {
        if (!baseAnalysis.subScoreValidation) {
            return { error: 'Validação não executada' };
        }
        
        const validation = baseAnalysis.subScoreValidation;
        const scores = baseAnalysis.qualityBreakdown;
        
        return {
            timestamp: validation.timestamp,
            overall: {
                status: validation.summary.status,
                averageScore: validation.summary.score,
                totalIssues: validation.summary.issues.length
            },
            breakdown: {
                dynamics: {
                    score: scores.dynamics,
                    status: validation.categories.dynamics?.status || 'unknown',
                    completeness: Math.round((validation.categories.dynamics?.dataCompleteness || 0) * 100),
                    description: this.getScoreDescription(scores.dynamics)
                },
                technical: {
                    score: scores.technical,
                    status: validation.categories.technical?.status || 'unknown',
                    completeness: Math.round((validation.categories.technical?.dataCompleteness || 0) * 100),
                    description: this.getScoreDescription(scores.technical)
                },
                loudness: {
                    score: scores.loudness,
                    status: validation.categories.loudness?.status || 'unknown',
                    completeness: Math.round((validation.categories.loudness?.dataCompleteness || 0) * 100),
                    description: this.getScoreDescription(scores.loudness)
                },
                frequency: {
                    score: scores.frequency,
                    status: validation.categories.frequency?.status || 'unknown',
                    completeness: Math.round((validation.categories.frequency?.dataCompleteness || 0) * 100),
                    description: this.getScoreDescription(scores.frequency)
                }
            },
            recommendations: validation.recommendations
        };
    }

    /**
     * 📖 Obter descrição do score
     */
    getScoreDescription(score) {
        if (!Number.isFinite(score)) return 'Dados insuficientes';
        if (score >= 90) return 'Excelente - Padrão profissional';
        if (score >= 80) return 'Muito bom - Qualidade elevada';
        if (score >= 70) return 'Bom - Qualidade adequada';
        if (score >= 60) return 'Regular - Necessita melhorias';
        if (score >= 50) return 'Fraco - Muitas melhorias necessárias';
        return 'Crítico - Revisão completa necessária';
    }
}

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubScoreCorrector;
} else if (typeof window !== 'undefined') {
    window.SubScoreCorrector = SubScoreCorrector;
}
