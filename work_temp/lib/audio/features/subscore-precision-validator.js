// 🎯 VALIDADOR DE PRECISÃO DOS SUB-SCORES
// Verifica se os 4 sub-scores (dynamics, technical, loudness, frequency) são 100% precisos e fieis às análises

class SubScorePrecisionValidator {
    constructor() {
        this.tolerance = 0.01; // Tolerância para comparações de ponto flutuante
    }

    /**
     * 🔍 Validar precisão dos sub-scores
     * @param {Object} technicalData - Dados técnicos da análise
     * @param {Object} referenceData - Dados de referência do gênero
     * @returns {Object} Relatório de validação completo
     */
    validateSubScorePrecision(technicalData, referenceData = null) {
        console.log('🎯 [PRECISION] Iniciando validação de precisão dos sub-scores');
        
        // 1. Calcular scores usando método Fallback (current)
        const fallbackScores = this.calculateFallbackScores(technicalData, referenceData);
        
        // 2. Calcular scores usando método Category-Based (advanced)
        const categoryScores = this.calculateCategoryBasedScores(technicalData, referenceData);
        
        // 3. Comparar precisão métrica por métrica
        const metricComparison = this.compareMetricPrecision(technicalData, referenceData);
        
        // 4. Analisar consistência
        const consistencyAnalysis = this.analyzeConsistency(fallbackScores, categoryScores);
        
        // 5. Gerar relatório final
        const report = this.generatePrecisionReport(
            fallbackScores, 
            categoryScores, 
            metricComparison, 
            consistencyAnalysis,
            technicalData
        );
        
        console.log('✅ [PRECISION] Validação concluída:', report);
        return report;
    }

    /**
     * 📊 Calcular scores usando método Fallback (audio-analyzer.js linha 730-746)
     */
    calculateFallbackScores(td, ref = null) {
        const safe = (v, def = 0) => Number.isFinite(v) ? v : def;
        
        // Extrair valores com fallbacks
        const lufsInt = safe(td.lufsIntegrated, safe(td.rms));
        const dr = safe(td.dynamicRange);
        const crest = safe(td.crestFactor);
        const corr = safe(td.stereoCorrelation, 0);
        const centroid = safe(td.spectralCentroid);
        
        // Targets de referência
        const freqIdealLow = 1800, freqIdealHigh = 3200;
        const refLufs = ref?.lufs_target ?? -14;
        const refDR = ref?.dr_target ?? 10;
        
        // Cálculo exato do código original
        const scoreLoud = 100 - Math.min(100, Math.abs(lufsInt - refLufs) * 6);
        const scoreDyn = 100 - Math.min(100, Math.abs(dr - refDR) * 10);
        
        let scoreTech = 100;
        if (safe(td.clippingSamples) > 0) scoreTech -= 20;
        if (Math.abs(safe(td.dcOffset)) > 0.02) scoreTech -= 10;
        if (crest < 6) scoreTech -= 15; 
        else if (crest < 8) scoreTech -= 5;
        if (corr < -0.2) scoreTech -= 15;
        
        // Frequency score baseado em centroid
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
            raw: { scoreDyn, scoreTech, scoreLoud, scoreFreq },
            inputs: { lufsInt, dr, crest, corr, centroid, refLufs, refDR }
        };
    }

    /**
     * 🎛️ Calcular scores usando método Category-Based (scoring.js)
     */
    calculateCategoryBasedScores(td, ref = null) {
        // Definir targets e tolerâncias (do scoring.js)
        const targets = {
            lufsIntegrated: { target: ref?.lufs_target ?? -14, tol: ref?.tol_lufs ?? 1 },
            dynamicRange: { target: ref?.dr_target ?? 10, tol: ref?.tol_dr ?? 3 },
            lra: { target: ref?.lra_target ?? 7, tol: ref?.tol_lra ?? 3 },
            crestFactor: { target: 10, tol: 4 },
            truePeakDbtp: { target: ref?.true_peak_target ?? -1, tol: ref?.tol_true_peak ?? 1 },
            dcOffset: { target: 0, tol: 0.02 },
            stereoCorrelation: { target: 0.3, tol: 0.5 },
            spectralCentroid: { target: 2500, tol: 1200 },
            thdPercent: { target: 1, tol: 1 }
        };

        // Função de tolerância (do scoring.js)
        const scoreTolerance = (value, target, tol, invert = false) => {
            if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tol) || tol <= 0) {
                return null;
            }
            
            const diff = value - target;
            const adiff = Math.abs(diff);
            
            if (invert) {
                // Para métricas onde só penalizamos acima do target (ex: truePeak)
                if (diff <= 0) return 1;
                if (diff >= 2 * tol) return 0;
                if (diff <= tol) return 1 - (diff / tol) * 0.5;
                return 1 - (0.5 + (diff - tol) / tol * 0.5);
            }
            
            if (adiff <= tol) return 1;
            if (adiff >= 2 * tol) return 0;
            return 1 - (adiff - tol) / tol;
        };

        // Calcular scores individuais
        const scores = {};
        Object.keys(targets).forEach(key => {
            const config = targets[key];
            const value = td[key];
            scores[key] = scoreTolerance(value, config.target, config.tol, config.invert);
        });

        // Mapear para categorias (baseado em scoring.js CATEGORY_WEIGHTS)
        const categoryMapping = {
            dynamics: ['dynamicRange', 'lra', 'crestFactor'],
            technical: ['truePeakDbtp', 'dcOffset', 'thdPercent'],
            loudness: ['lufsIntegrated'],
            frequency: ['spectralCentroid'] // Simplificado para este teste
        };

        // Calcular médias por categoria
        const categories = {};
        Object.keys(categoryMapping).forEach(category => {
            const metrics = categoryMapping[category];
            const validScores = metrics
                .map(metric => scores[metric])
                .filter(score => score !== null);
            
            if (validScores.length > 0) {
                categories[category] = Math.round(
                    (validScores.reduce((sum, score) => sum + score, 0) / validScores.length) * 100
                );
            } else {
                categories[category] = 0;
            }
        });

        return {
            ...categories,
            individualScores: scores,
            categoryMapping,
            targets
        };
    }

    /**
     * 🔬 Comparar precisão métrica por métrica
     */
    compareMetricPrecision(td, ref = null) {
        const metrics = [
            {
                name: 'LUFS Integrated',
                key: 'lufsIntegrated',
                value: td.lufsIntegrated,
                target: ref?.lufs_target ?? -14,
                tolerance: ref?.tol_lufs ?? 1,
                unit: 'LUFS',
                category: 'loudness'
            },
            {
                name: 'Dynamic Range',
                key: 'dynamicRange', 
                value: td.dynamicRange,
                target: ref?.dr_target ?? 10,
                tolerance: ref?.tol_dr ?? 3,
                unit: 'dB',
                category: 'dynamics'
            },
            {
                name: 'LRA',
                key: 'lra',
                value: td.lra,
                target: ref?.lra_target ?? 7,
                tolerance: ref?.tol_lra ?? 3,
                unit: 'LU',
                category: 'dynamics'
            },
            {
                name: 'Crest Factor',
                key: 'crestFactor',
                value: td.crestFactor,
                target: 10,
                tolerance: 4,
                unit: 'dB',
                category: 'dynamics'
            },
            {
                name: 'True Peak',
                key: 'truePeakDbtp',
                value: td.truePeakDbtp,
                target: ref?.true_peak_target ?? -1,
                tolerance: ref?.tol_true_peak ?? 1,
                unit: 'dBTP',
                category: 'technical'
            },
            {
                name: 'DC Offset',
                key: 'dcOffset',
                value: td.dcOffset,
                target: 0,
                tolerance: 0.02,
                unit: '',
                category: 'technical'
            },
            {
                name: 'Spectral Centroid',
                key: 'spectralCentroid',
                value: td.spectralCentroid,
                target: 2500,
                tolerance: 1200,
                unit: 'Hz',
                category: 'frequency'
            }
        ];

        return metrics.map(metric => {
            const deviation = Number.isFinite(metric.value) && Number.isFinite(metric.target) 
                ? Math.abs(metric.value - metric.target) 
                : null;
            
            const withinTolerance = deviation !== null ? deviation <= metric.tolerance : null;
            const qualityRating = deviation === null ? 'N/A' :
                deviation <= metric.tolerance ? 'Excelente' :
                deviation <= metric.tolerance * 1.5 ? 'Bom' :
                deviation <= metric.tolerance * 2 ? 'Marginal' : 'Crítico';

            return {
                ...metric,
                deviation,
                withinTolerance,
                qualityRating,
                deviationPercent: deviation !== null && metric.tolerance > 0 
                    ? (deviation / metric.tolerance * 100).toFixed(1) + '%'
                    : 'N/A'
            };
        });
    }

    /**
     * 📈 Analisar consistência entre métodos
     */
    analyzeConsistency(fallback, category) {
        const categories = ['dynamics', 'technical', 'loudness', 'frequency'];
        const differences = {};
        const maxDifference = { value: 0, category: null };
        let totalDifference = 0;

        categories.forEach(cat => {
            const diff = Math.abs(fallback[cat] - category[cat]);
            differences[cat] = diff;
            totalDifference += diff;
            
            if (diff > maxDifference.value) {
                maxDifference.value = diff;
                maxDifference.category = cat;
            }
        });

        const averageDifference = totalDifference / categories.length;
        
        // Classificar consistência
        let consistencyRating = 'Excelente';
        if (maxDifference.value > 15) consistencyRating = 'Crítica';
        else if (maxDifference.value > 10) consistencyRating = 'Moderada';
        else if (maxDifference.value > 5) consistencyRating = 'Boa';

        return {
            differences,
            maxDifference,
            averageDifference: parseFloat(averageDifference.toFixed(2)),
            consistencyRating,
            isConsistent: maxDifference.value <= 5,
            needsAttention: maxDifference.value > 10
        };
    }

    /**
     * 📋 Gerar relatório de precisão completo
     */
    generatePrecisionReport(fallback, category, metricComparison, consistency, technicalData) {
        const timestamp = new Date().toISOString();
        
        return {
            timestamp,
            summary: {
                precisao: consistency.consistencyRating,
                maxDiferenca: consistency.maxDifference.value.toFixed(1),
                categoriaProblematica: consistency.maxDifference.category,
                diferencaMedia: consistency.averageDifference,
                requerAtencao: consistency.needsAttention
            },
            subScores: {
                fallback: {
                    dynamics: fallback.dynamics,
                    technical: fallback.technical,
                    loudness: fallback.loudness,
                    frequency: fallback.frequency
                },
                categoryBased: {
                    dynamics: category.dynamics,
                    technical: category.technical, 
                    loudness: category.loudness,
                    frequency: category.frequency
                },
                diferencas: consistency.differences
            },
            metricDetails: metricComparison,
            recommendations: this.generateRecommendations(consistency, metricComparison),
            rawData: {
                technicalData,
                fallbackRaw: fallback.raw,
                fallbackInputs: fallback.inputs,
                categoryTargets: category.targets,
                categoryScores: category.individualScores
            }
        };
    }

    /**
     * 💡 Gerar recomendações baseadas na análise
     */
    generateRecommendations(consistency, metricComparison) {
        const recommendations = [];

        if (consistency.needsAttention) {
            recommendations.push({
                type: 'critical',
                title: 'Inconsistência Crítica Detectada',
                message: `Diferença de ${consistency.maxDifference.value.toFixed(1)} pontos na categoria ${consistency.maxDifference.category}`,
                action: 'Revisar fórmulas de cálculo e tolerâncias'
            });
        }

        // Analisar métricas específicas
        const criticalMetrics = metricComparison.filter(m => m.qualityRating === 'Crítico');
        if (criticalMetrics.length > 0) {
            recommendations.push({
                type: 'warning',
                title: 'Métricas Fora da Tolerância',
                message: `${criticalMetrics.length} métrica(s) com desvios críticos`,
                action: 'Verificar precisão dos cálculos: ' + criticalMetrics.map(m => m.name).join(', ')
            });
        }

        // Sugestões de melhoria
        if (consistency.averageDifference > 3) {
            recommendations.push({
                type: 'improvement',
                title: 'Unificar Métodos de Cálculo',
                message: 'Diferença média elevada entre métodos',
                action: 'Considerar implementar apenas o método Category-Based para maior precisão'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                type: 'success',
                title: 'Precisão Excelente',
                message: 'Ambos os métodos apresentam resultados consistentes',
                action: 'Manter implementação atual'
            });
        }

        return recommendations;
    }

    /**
     * 🎨 Gerar relatório visual em HTML
     */
    generateHTMLReport(report) {
        return `
        <div class="precision-report">
            <h2>🎯 Relatório de Precisão dos Sub-Scores</h2>
            <div class="summary">
                <h3>📊 Resumo</h3>
                <p><strong>Precisão:</strong> ${report.summary.precisao}</p>
                <p><strong>Maior Diferença:</strong> ${report.summary.maxDiferenca} pontos (${report.summary.categoriaProblematica})</p>
                <p><strong>Diferença Média:</strong> ${report.summary.diferencaMedia} pontos</p>
            </div>
            
            <div class="scores-comparison">
                <h3>🔢 Comparação de Scores</h3>
                <table>
                    <tr>
                        <th>Categoria</th>
                        <th>Fallback</th>
                        <th>Category-Based</th>
                        <th>Diferença</th>
                    </tr>
                    ${Object.keys(report.subScores.fallback).map(cat => `
                        <tr>
                            <td>${cat}</td>
                            <td>${report.subScores.fallback[cat]}</td>
                            <td>${report.subScores.categoryBased[cat]}</td>
                            <td>${report.subScores.diferencas[cat].toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            
            <div class="recommendations">
                <h3>💡 Recomendações</h3>
                ${report.recommendations.map(rec => `
                    <div class="recommendation ${rec.type}">
                        <h4>${rec.title}</h4>
                        <p>${rec.message}</p>
                        <p><strong>Ação:</strong> ${rec.action}</p>
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    }
}

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubScorePrecisionValidator;
} else if (typeof window !== 'undefined') {
    window.SubScorePrecisionValidator = SubScorePrecisionValidator;
}
