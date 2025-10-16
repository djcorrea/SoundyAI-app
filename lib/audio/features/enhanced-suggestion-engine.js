// 🎯 SISTEMA PRINCIPAL DE SUGESTÕES MELHORADO
// Integra scoring, heurísticas e referências em um sistema unificado

class EnhancedSuggestionEngine {
    constructor() {
        this.scorer = window.suggestionScorer || new SuggestionScorer();
        this.heuristics = window.heuristicsAnalyzer || new AdvancedHeuristicsAnalyzer();
        
        // 📊 Log de auditoria para debugging
        this.auditLog = [];
        
        // 🎛️ Configurações
        this.config = {
            maxSuggestions: 12,        // Máximo de sugestões por análise
            minPriority: 0.1,          // Prioridade mínima para incluir sugestão
            groupByTheme: true,        // Agrupar sugestões por tema
            includeYellowSeverity: true, // Incluir severidade "amarela" (monitorar)
            enableHeuristics: true,    // Habilitar análise heurística
            enableDependencies: true   // Habilitar regras de dependência
        };
    }

    /**
     * 🎯 Processar análise completa e gerar sugestões melhoradas
     * @param {Object} analysis - Análise de áudio existente
     * @param {Object} referenceData - Dados de referência do gênero
     * @param {Object} options - Opções de processamento
     * @returns {Object} Análise enriquecida com sugestões melhoradas
     */
    processAnalysis(analysis, referenceData, options = {}) {
        const startTime = Date.now();
        this.auditLog = []; // Reset log
        
        try {
            // 📊 Extrair métricas e calcular z-scores
            const metrics = this.extractMetrics(analysis, referenceData);
            const zScores = this.calculateAllZScores(metrics, referenceData);
            
            // 🎖️ Calcular confiança baseada na qualidade da análise
            const confidence = this.scorer.calculateConfidence(this.extractQualityMetrics(analysis));
            
            // 🔗 Calcular bônus de dependência
            const dependencyBonuses = this.scorer.calculateDependencyBonus(zScores);
            
            // 🎯 Gerar sugestões baseadas em referência
            const referenceSuggestions = this.generateReferenceSuggestions(
                metrics, referenceData, zScores, confidence, dependencyBonuses
            );
            
            // 🎵 Gerar sugestões heurísticas (se habilitado)
            let heuristicSuggestions = [];
            if (this.config.enableHeuristics) {
                heuristicSuggestions = this.generateHeuristicSuggestions(
                    analysis, confidence
                );
            }
            
            // 🔄 Combinar, deduplicar e ordenar sugestões
            let allSuggestions = [...referenceSuggestions, ...heuristicSuggestions];
            allSuggestions = this.scorer.deduplicateSuggestions(allSuggestions);
            allSuggestions = this.filterAndSort(allSuggestions);
            
            // 🎨 Agrupar por tema se habilitado
            const groupedSuggestions = this.config.groupByTheme ? 
                this.scorer.groupSuggestionsByTheme(allSuggestions) : null;
            
            // 📊 Preparar resultado final
            const result = {
                ...analysis,
                suggestions: allSuggestions,
                groupedSuggestions,
                enhancedMetrics: {
                    zScores,
                    confidence,
                    dependencyBonuses,
                    processingTimeMs: Date.now() - startTime
                },
                auditLog: [...this.auditLog]
            };
            
            this.logAudit('PROCESSING_COMPLETE', `Processamento concluído em ${result.enhancedMetrics.processingTimeMs}ms`, {
                totalSuggestions: allSuggestions.length,
                referenceSuggestions: referenceSuggestions.length,
                heuristicSuggestions: heuristicSuggestions.length,
                avgPriority: allSuggestions.length > 0 ? 
                    (allSuggestions.reduce((sum, s) => sum + s.priority, 0) / allSuggestions.length).toFixed(3) : 0
            });
            
            return result;
            
        } catch (error) {
            console.error('🚨 Erro no processamento de sugestões:', error);
            this.logAudit('ERROR', 'Erro no processamento', { error: error.message });
            
            // Fallback: retornar análise original com log de erro
            return {
                ...analysis,
                suggestions: analysis.suggestions || [],
                enhancedMetrics: { error: error.message },
                auditLog: [...this.auditLog]
            };
        }
    }

    /**
     * 📊 Extrair métricas relevantes da análise
     * @param {Object} analysis - Análise de áudio
     * @param {Object} referenceData - Dados de referência
     * @returns {Object} Métricas extraídas
     */
    extractMetrics(analysis, referenceData) {
        const tech = analysis.technicalData || {};
        const metrics = {};
        
        // Métricas principais
        if (Number.isFinite(tech.lufsIntegrated)) metrics.lufs = tech.lufsIntegrated;
        if (Number.isFinite(tech.truePeakDbtp)) metrics.true_peak = tech.truePeakDbtp;
        if (Number.isFinite(tech.dynamicRange)) metrics.dr = tech.dynamicRange;
        if (Number.isFinite(tech.lra)) metrics.lra = tech.lra;
        if (Number.isFinite(tech.stereoCorrelation)) metrics.stereo = tech.stereoCorrelation;
        
        // Bandas espectrais
        const bandEnergies = tech.bandEnergies || {};
        for (const [band, data] of Object.entries(bandEnergies)) {
            if (data && Number.isFinite(data.rms_db)) {
                metrics[band] = data.rms_db;
            }
        }
        
        this.logAudit('METRICS_EXTRACTED', 'Métricas extraídas', { 
            count: Object.keys(metrics).length,
            metrics: Object.keys(metrics)
        });
        
        return metrics;
    }

    /**
     * 📐 Calcular z-scores para todas as métricas
     * @param {Object} metrics - Métricas medidas
     * @param {Object} referenceData - Dados de referência
     * @returns {Object} Z-scores calculados
     */
    calculateAllZScores(metrics, referenceData) {
        const zScores = {};
        
        if (!referenceData) return zScores;
        
        // Z-scores para métricas principais
        const mainMetrics = [
            { key: 'lufs', target: 'lufs_target', tol: 'tol_lufs' },
            { key: 'true_peak', target: 'true_peak_target', tol: 'tol_true_peak' },
            { key: 'dr', target: 'dr_target', tol: 'tol_dr' },
            { key: 'lra', target: 'lra_target', tol: 'tol_lra' },
            { key: 'stereo', target: 'stereo_target', tol: 'tol_stereo' }
        ];
        
        for (const { key, target, tol } of mainMetrics) {
            if (Number.isFinite(metrics[key]) && Number.isFinite(referenceData[target]) && Number.isFinite(referenceData[tol])) {
                zScores[key + '_z'] = this.scorer.calculateZScore(
                    metrics[key], 
                    referenceData[target], 
                    referenceData[tol]
                );
            }
        }
        
        // Z-scores para bandas
        if (referenceData.bands) {
            for (const [band, refData] of Object.entries(referenceData.bands)) {
                if (Number.isFinite(metrics[band]) && Number.isFinite(refData.target_db) && Number.isFinite(refData.tol_db)) {
                    zScores[band + '_z'] = this.scorer.calculateZScore(
                        metrics[band],
                        refData.target_db,
                        refData.tol_db
                    );
                }
            }
        }
        
        this.logAudit('ZSCORES_CALCULATED', 'Z-scores calculados', { 
            count: Object.keys(zScores).length,
            maxAbsZ: Math.max(...Object.values(zScores).map(Math.abs)).toFixed(2)
        });
        
        return zScores;
    }

    /**
     * 🎖️ Extrair métricas de qualidade da análise
     * @param {Object} analysis - Análise de áudio
     * @returns {Object} Métricas de qualidade
     */
    extractQualityMetrics(analysis) {
        const quality = {};
        
        // Duração do áudio
        if (analysis.audioBuffer) {
            quality.duration = analysis.audioBuffer.length / analysis.audioBuffer.sampleRate;
        }
        
        // Oversampling do True Peak
        quality.truePeakOversampled = analysis.technicalData?._sources?.truePeak?.includes('oversampled') || false;
        
        // SNR estimado (se disponível)
        if (analysis.technicalData?.snrEstimate) {
            quality.snr = analysis.technicalData.snrEstimate;
        }
        
        // Estabilidade (baseada em variação temporal se disponível)
        if (analysis.technicalData?.lufsShortTerm && analysis.technicalData?.lufsIntegrated) {
            const variation = Math.abs(analysis.technicalData.lufsShortTerm - analysis.technicalData.lufsIntegrated);
            quality.stability = Math.max(0, 1 - variation / 10); // 0-1 baseado na variação
        }
        
        return quality;
    }

    /**
     * 🎯 Gerar sugestões baseadas em referência
     * @param {Object} metrics - Métricas medidas
     * @param {Object} referenceData - Dados de referência
     * @param {Object} zScores - Z-scores calculados
     * @param {number} confidence - Confiança da análise
     * @param {Object} dependencyBonuses - Bônus de dependência
     * @returns {Array} Sugestões baseadas em referência
     */
    generateReferenceSuggestions(metrics, referenceData, zScores, confidence, dependencyBonuses) {
        const suggestions = [];
        
        if (!referenceData) return suggestions;
        
        // Sugestões para métricas principais
        const mainMetrics = [
            { 
                key: 'lufs', 
                target: 'lufs_target', 
                tol: 'tol_lufs', 
                type: 'reference_loudness',
                metricType: 'lufs',
                unit: '',
                label: 'LUFS'
            },
            { 
                key: 'true_peak', 
                target: 'true_peak_target', 
                tol: 'tol_true_peak',
                type: 'reference_true_peak',
                metricType: 'true_peak', 
                unit: ' dBTP',
                label: 'True Peak'
            },
            { 
                key: 'dr', 
                target: 'dr_target', 
                tol: 'tol_dr',
                type: 'reference_dynamics',
                metricType: 'dr',
                unit: ' dB',
                label: 'DR'
            },
            { 
                key: 'lra', 
                target: 'lra_target', 
                tol: 'tol_lra',
                type: 'reference_lra',
                metricType: 'lra',
                unit: ' dB',
                label: 'LRA'
            },
            { 
                key: 'stereo', 
                target: 'stereo_target', 
                tol: 'tol_stereo',
                type: 'reference_stereo',
                metricType: 'stereo',
                unit: '',
                label: 'Stereo Corr'
            }
        ];
        
        for (const metric of mainMetrics) {
            const value = metrics[metric.key];
            const target = referenceData[metric.target];
            const tolerance = referenceData[metric.tol];
            const zScore = zScores[metric.key + '_z'];
            
            if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance)) continue;
            
            const severity = this.scorer.getSeverity(zScore);
            
            // Incluir sugestão se fora do verde ou se amarelo e configurado para incluir
            const shouldInclude = severity.level !== 'green' || 
                (severity.level === 'yellow' && this.config.includeYellowSeverity);
            
            if (shouldInclude) {
                const dependencyBonus = dependencyBonuses[metric.key] || 0;
                const priority = this.scorer.calculatePriority({
                    metricType: metric.metricType,
                    severity,
                    confidence,
                    dependencyBonus
                });
                
                const suggestion = this.scorer.generateSuggestion({
                    type: metric.type,
                    value,
                    target,
                    tolerance,
                    zScore,
                    severity,
                    priority,
                    confidence,
                    genre: window.PROD_AI_REF_GENRE || 'unknown',
                    metricType: metric.metricType
                });
                
                suggestions.push(suggestion);
                
                this.logAudit('REFERENCE_SUGGESTION', `Sugestão gerada: ${metric.label}`, {
                    value: +value.toFixed(2),
                    target: +target.toFixed(2),
                    delta: +(value - target).toFixed(2),
                    zScore: +zScore.toFixed(2),
                    severity: severity.level,
                    priority: +priority.toFixed(3),
                    dependencyBonus
                });
            }
        }
        
        // [BANDS-TOL-0] Sugestões para bandas espectrais COM COMPARAÇÃO BINÁRIA POR RANGE
        if (referenceData.bands) {
            for (const [band, refData] of Object.entries(referenceData.bands)) {
                const value = metrics[band];
                
                // [BANDS-TOL-0] Prioridade 1: target_range (sistema sem tolerância)
                let target, inRange, distance, zScore, severity, shouldInclude;
                
                if (refData.target_range && typeof refData.target_range === 'object' &&
                    Number.isFinite(refData.target_range.min) && Number.isFinite(refData.target_range.max)) {
                    
                    // === LÓGICA RANGE-BASED (SEM TOLERÂNCIA AUTOMÁTICA) ===
                    target = refData.target_range;
                    
                    // Comparação binária: verde SOMENTE dentro de [min, max]
                    inRange = (value >= target.min && value <= target.max);
                    
                    if (inRange) {
                        // Dentro do range → verde, sem sugestão
                        shouldInclude = false;
                        this.logAudit('BAND_IN_RANGE', `Banda ${band} dentro do range`, {
                            value: +value.toFixed(2),
                            range: `[${target.min}, ${target.max}]`,
                            status: 'green'
                        });
                        continue;
                    }
                    
                    // Fora do range → calcular distância ao limite mais próximo
                    distance = Math.min(
                        Math.abs(value - target.min),
                        Math.abs(value - target.max)
                    );
                    
                    // [BANDS-TOL-0] Classificar por thresholds fixos (sem tolerância)
                    if (distance <= this.scorer.BAND_YELLOW_DB) {
                        severity = { level: 'yellow', ...this.scorer.severityConfig.yellow };
                        shouldInclude = this.config.includeYellowSeverity;
                    } else if (distance <= this.scorer.BAND_ORANGE_DB) {
                        severity = { level: 'orange', ...this.scorer.severityConfig.orange };
                        shouldInclude = true;
                    } else {
                        severity = { level: 'red', ...this.scorer.severityConfig.red };
                        shouldInclude = true;
                    }
                    
                    // Z-score sintético para compatibilidade com sistema de prioridade
                    zScore = this.scorer.calculateZScore(value, target, 0, { isBand: true });
                    
                    this.logAudit('BAND_RANGE_LOGIC', `Banda ${band} fora do range`, {
                        value: +value.toFixed(2),
                        range: `[${target.min}, ${target.max}]`,
                        distance: +distance.toFixed(2),
                        severity: severity.level,
                        zScore: +zScore.toFixed(2)
                    });
                    
                } else if (Number.isFinite(refData.target_db)) {
                    // === FALLBACK: target_db fixo (tratar como min=max=target_db) ===
                    const targetDb = refData.target_db;
                    target = { min: targetDb, max: targetDb };
                    
                    // Comparação binária: verde SOMENTE se value === target
                    inRange = (Math.abs(value - targetDb) < 0.01); // epsilon para float
                    
                    if (inRange) {
                        shouldInclude = false;
                        this.logAudit('BAND_EXACT_MATCH', `Banda ${band} exata ao target_db`, {
                            value: +value.toFixed(2),
                            target_db: targetDb,
                            status: 'green'
                        });
                        continue;
                    }
                    
                    // Fora do target: calcular distância
                    distance = Math.abs(value - targetDb);
                    
                    // [BANDS-TOL-0] Classificar por thresholds fixos
                    if (distance <= this.scorer.BAND_YELLOW_DB) {
                        severity = { level: 'yellow', ...this.scorer.severityConfig.yellow };
                        shouldInclude = this.config.includeYellowSeverity;
                    } else if (distance <= this.scorer.BAND_ORANGE_DB) {
                        severity = { level: 'orange', ...this.scorer.severityConfig.orange };
                        shouldInclude = true;
                    } else {
                        severity = { level: 'red', ...this.scorer.severityConfig.red };
                        shouldInclude = true;
                    }
                    
                    zScore = this.scorer.calculateZScore(value, target, 0, { isBand: true });
                    
                    this.logAudit('BAND_FIXED_LOGIC', `Banda ${band} fora do target_db`, {
                        value: +value.toFixed(2),
                        target_db: targetDb,
                        distance: +distance.toFixed(2),
                        severity: severity.level,
                        zScore: +zScore.toFixed(2)
                    });
                    
                } else {
                    // Sem target válido → pular banda
                    this.logAudit('BAND_NO_TARGET', `Banda ${band} sem target válido`, {
                        value: +value.toFixed(2),
                        hasRange: !!refData.target_range,
                        hasTargetDb: !!refData.target_db
                    });
                    continue;
                }
                
                // Gerar sugestão se necessário
                if (shouldInclude) {
                    const dependencyBonus = dependencyBonuses[band] || 0;
                    const priority = this.scorer.calculatePriority({
                        metricType: 'band',
                        severity,
                        confidence,
                        dependencyBonus
                    });
                    
                    const suggestion = this.scorer.generateSuggestion({
                        type: 'band_adjust',
                        subtype: band,
                        value,
                        target,
                        tolerance: 0, // [BANDS-TOL-0] Sempre 0 para bandas
                        zScore,
                        severity,
                        priority,
                        confidence,
                        genre: window.PROD_AI_REF_GENRE || 'unknown',
                        metricType: 'band',
                        band
                    });
                    
                    suggestions.push(suggestion);
                    
                    this.logAudit('BAND_SUGGESTION', `Sugestão de banda: ${band}`, {
                        value: +value.toFixed(2),
                        target: typeof target === 'object' ? `[${target.min}, ${target.max}]` : target,
                        distance: +distance.toFixed(2),
                        zScore: +zScore.toFixed(2),
                        severity: severity.level,
                        priority: +priority.toFixed(3)
                    });
                }
            }
        }
        
        // 🎯 NOVO: Processar referenceComparison para bandas espectrais
        if (typeof window !== 'undefined' && window.PRE_UPDATE_REFERENCE_SUGGESTIONS_DATA) {
            const referenceComparison = window.PRE_UPDATE_REFERENCE_SUGGESTIONS_DATA;
            
            this.logAudit('REFERENCE_COMPARISON_CHECK', 'Verificando dados de referenceComparison', {
                hasReferenceComparison: !!referenceComparison,
                isArray: Array.isArray(referenceComparison),
                length: referenceComparison?.length || 0
            });
            
            if (Array.isArray(referenceComparison)) {
                // Filtrar apenas itens de bandas espectrais
                const spectralBands = referenceComparison.filter(item => 
                    item && item.category === 'spectral_bands'
                );
                
                this.logAudit('SPECTRAL_BANDS_FOUND', 'Bandas espectrais encontradas em referenceComparison', {
                    totalItems: referenceComparison.length,
                    spectralBandsCount: spectralBands.length,
                    spectralBandNames: spectralBands.map(b => b.metric || b.name)
                });
                
                // [BANDS-TOL-0] Processar bandas espectrais de referenceComparison
                for (const item of spectralBands) {
                    if (!item.metric) continue;
                    
                    const value = item.value;
                    
                    // [BANDS-TOL-0] Verificar se há target_range no item ou buscar na referência
                    let target, targetRange;
                    
                    if (item.target_range && typeof item.target_range === 'object' &&
                        Number.isFinite(item.target_range.min) && Number.isFinite(item.target_range.max)) {
                        targetRange = item.target_range;
                        target = targetRange;
                    } else if (Number.isFinite(item.ideal)) {
                        // Fallback: tratar ideal como target_db (min=max=ideal)
                        targetRange = { min: item.ideal, max: item.ideal };
                        target = targetRange;
                    } else {
                        this.logAudit('SUGGESTION_SKIPPED', `Banda ignorada por target inválido: ${item.metric}`, {
                            metric: item.metric,
                            value: value,
                            hasIdeal: !!item.ideal,
                            hasRange: !!item.target_range
                        });
                        continue;
                    }
                    
                    if (!Number.isFinite(value)) {
                        this.logAudit('SUGGESTION_SKIPPED', `Banda ignorada por value inválido: ${item.metric}`, {
                            metric: item.metric,
                            value: value
                        });
                        continue;
                    }
                    
                    // [BANDS-TOL-0] Comparação binária: verde SOMENTE dentro de [min, max]
                    const inRange = (value >= targetRange.min && value <= targetRange.max);
                    
                    if (inRange) {
                        // Dentro do range → sem sugestão
                        this.logAudit('BAND_IN_RANGE', `Banda ${item.metric} dentro do range (referenceComparison)`, {
                            metric: item.metric,
                            value: +value.toFixed(2),
                            range: `[${targetRange.min}, ${targetRange.max}]`,
                            status: 'green'
                        });
                        continue;
                    }
                    
                    // Fora do range → calcular distância ao limite mais próximo
                    const distance = Math.min(
                        Math.abs(value - targetRange.min),
                        Math.abs(value - targetRange.max)
                    );
                    
                    // [BANDS-TOL-0] Classificar por thresholds fixos
                    let severity, shouldInclude;
                    if (distance <= this.scorer.BAND_YELLOW_DB) {
                        severity = { level: 'yellow', ...this.scorer.severityConfig.yellow };
                        shouldInclude = this.config.includeYellowSeverity;
                    } else if (distance <= this.scorer.BAND_ORANGE_DB) {
                        severity = { level: 'orange', ...this.scorer.severityConfig.orange };
                        shouldInclude = true;
                    } else {
                        severity = { level: 'red', ...this.scorer.severityConfig.red };
                        shouldInclude = true;
                    }
                    
                    // Z-score sintético para compatibilidade
                    const zScore = this.scorer.calculateZScore(value, target, 0, { isBand: true });
                    
                    this.logAudit('BAND_REFERENCE_COMPARISON', `Banda ${item.metric} fora do range (referenceComparison)`, {
                        metric: item.metric,
                        value: +value.toFixed(2),
                        range: `[${targetRange.min}, ${targetRange.max}]`,
                        distance: +distance.toFixed(2),
                        severity: severity.level,
                        zScore: +zScore.toFixed(2)
                    });
                    
                    if (shouldInclude) {
                        const priority = this.scorer.calculatePriority({
                            metricType: 'band',
                            severity,
                            confidence,
                            dependencyBonus: 0
                        });
                        
                        const suggestion = this.scorer.generateSuggestion({
                            type: 'reference_band_comparison',
                            subtype: item.metric,
                            value,
                            target,
                            tolerance: 0, // [BANDS-TOL-0] Sempre 0 para bandas
                            zScore,
                            severity,
                            priority,
                            confidence,
                            genre: window.PROD_AI_REF_GENRE || 'unknown',
                            metricType: 'band',
                            band: item.metric
                        });
                        
                        suggestions.push(suggestion);
                        
                        this.logAudit('REFERENCE_COMPARISON_SUGGESTION', `Sugestão de banda gerada (referenceComparison): ${item.metric}`, {
                            value: +value.toFixed(2),
                            range: `[${targetRange.min}, ${targetRange.max}]`,
                            distance: +distance.toFixed(2),
                            zScore: +zScore.toFixed(2),
                            severity: severity.level,
                            priority: +priority.toFixed(3),
                            source: 'referenceComparison'
                        });
                    }
                }
            }
        }
        
        return suggestions;
    }

    /**
     * 🎵 Gerar sugestões heurísticas
     * @param {Object} analysis - Análise de áudio
     * @param {number} confidence - Confiança base
     * @returns {Array} Sugestões heurísticas
     */
    generateHeuristicSuggestions(analysis, confidence) {
        const suggestions = [];
        
        try {
            // Preparar dados para análise heurística
            const analysisData = {
                audioBuffer: analysis.audioBuffer,
                spectralData: this.extractSpectralData(analysis),
                transientData: this.extractTransientData(analysis)
            };
            
            // Executar análise heurística
            const detections = this.heuristics.analyzeAll(analysisData);
            
            for (const detection of detections) {
                // Converter detecção em sugestão formatada
                const severity = this.mapIntensityToSeverity(detection.intensity, detection.type);
                const adjustedConfidence = confidence * detection.confidence;
                
                const priority = this.scorer.calculatePriority({
                    metricType: detection.type,
                    severity,
                    confidence: adjustedConfidence,
                    dependencyBonus: 0
                });
                
                const suggestion = {
                    type: 'heuristic_' + detection.type,
                    subtype: detection.type,
                    message: `${detection.type} detectada${detection.frequency ? ` em ${detection.frequency}Hz` : ''}`,
                    action: detection.action,
                    why: this.getHeuristicWhy(detection.type),
                    
                    technical: {
                        ...detection.technical,
                        intensity: +detection.intensity.toFixed(2)
                    },
                    
                    priority: +priority.toFixed(3),
                    confidence: +adjustedConfidence.toFixed(2),
                    severity: {
                        level: severity.level,
                        score: severity.score,
                        color: severity.color,
                        label: severity.label
                    },
                    
                    genre: window.PROD_AI_REF_GENRE || 'unknown',
                    timestamp: Date.now(),
                    details: `Intensidade: ${detection.intensity.toFixed(1)} • conf: ${adjustedConfidence.toFixed(2)} • prior: ${priority.toFixed(3)}`
                };
                
                suggestions.push(suggestion);
                
                this.logAudit('HEURISTIC_SUGGESTION', `Heurística detectada: ${detection.type}`, {
                    type: detection.type,
                    frequency: detection.frequency,
                    intensity: +detection.intensity.toFixed(2),
                    confidence: +adjustedConfidence.toFixed(2),
                    priority: +priority.toFixed(3)
                });
            }
            
        } catch (error) {
            console.warn('🚨 Erro na análise heurística:', error);
            this.logAudit('HEURISTIC_ERROR', 'Erro na análise heurística', { error: error.message });
        }
        
        return suggestions;
    }

    /**
     * 📊 Extrair dados espectrais da análise
     * @param {Object} analysis - Análise de áudio
     * @returns {Object|null} Dados espectrais
     */
    extractSpectralData(analysis) {
        // Tentar extrair dados espectrais de várias fontes possíveis
        if (analysis.spectralData) {
            return analysis.spectralData;
        }
        
        if (analysis.technicalData?.spectrum) {
            return {
                freqBins: analysis.technicalData.spectrum.freqBins,
                magnitude: analysis.technicalData.spectrum.magnitude
            };
        }
        
        // Fallback: tentar construir a partir de dados disponíveis
        if (analysis.technicalData?.dominantFrequencies) {
            // 🎯 CORREÇÃO: Extrair dados de frequências dominantes corretamente
            const df = analysis.technicalData.dominantFrequencies;
            const peaks = Array.isArray(df) ? df : df?.detailed?.peaks || [];
            
            // Construir espectro simplificado a partir de frequências dominantes
            const freqBins = [];
            const magnitude = [];
            
            for (const freq of peaks) {
                if (freq && typeof freq === 'object' && Number.isFinite(freq.frequency)) {
                    freqBins.push(freq.frequency);
                    magnitude.push(freq.magnitude || 0.1);
                }
            }
            
            return freqBins.length > 0 ? { freqBins, magnitude } : null;
        }
        
        return null;
    }

    /**
     * 🥁 Extrair dados de transientes da análise
     * @param {Object} analysis - Análise de áudio
     * @returns {Object|null} Dados de transientes
     */
    extractTransientData(analysis) {
        if (analysis.transientData) {
            return analysis.transientData;
        }
        
        // Fallback: usar crest factor como proxy para conteúdo transiente
        if (analysis.technicalData?.crestFactor) {
            return {
                strength: Math.min(1.0, analysis.technicalData.crestFactor / 20) // normalizar
            };
        }
        
        return null;
    }

    /**
     * 🎨 Mapear intensidade de detecção para severidade
     * @param {number} intensity - Intensidade da detecção
     * @param {string} type - Tipo de detecção
     * @returns {Object} Configuração de severidade
     */
    mapIntensityToSeverity(intensity, type) {
        // Diferentes escalas por tipo de detecção
        let threshold1, threshold2, threshold3;
        
        switch (type) {
            case 'sibilance':
                threshold1 = -20; threshold2 = -15; threshold3 = -10;
                break;
            case 'harshness':
                threshold1 = 8; threshold2 = 12; threshold3 = 16;
                break;
            case 'masking':
                threshold1 = 6; threshold2 = 10; threshold3 = 14;
                break;
            case 'clipping':
                threshold1 = 0.01; threshold2 = 0.1; threshold3 = 1.0; // percentagem
                break;
            default:
                threshold1 = 1; threshold2 = 2; threshold3 = 3;
        }
        
        if (intensity <= threshold1) {
            return { level: 'yellow', ...this.scorer.severityConfig.yellow };
        } else if (intensity <= threshold2) {
            return { level: 'orange', ...this.scorer.severityConfig.orange };
        } else {
            return { level: 'red', ...this.scorer.severityConfig.red };
        }
    }

    /**
     * ❓ Obter explicação do "porquê" para heurísticas
     * @param {string} type - Tipo de heurística
     * @returns {string} Explicação
     */
    getHeuristicWhy(type) {
        const explanations = {
            sibilance: 'Reduz fadiga auditiva e melhora clareza vocal',
            harshness: 'Elimina agressividade em médios-altos',
            masking: 'Melhora clareza e separação instrumental',
            clipping: 'Evita distorção digital audível'
        };
        
        return explanations[type] || 'Melhora qualidade sonora geral';
    }

    /**
     * 🔧 Filtrar e ordenar sugestões finais
     * @param {Array} suggestions - Lista de sugestões
     * @returns {Array} Sugestões filtradas e ordenadas
     */
    filterAndSort(suggestions) {
        // Filtrar por prioridade mínima
        let filtered = suggestions.filter(s => s.priority >= this.config.minPriority);
        
        // =========================================
        // 🧭 FORÇAR TRUE PEAK SEMPRE EM PRIMEIRO
        // =========================================
        const criticalTypes = new Set(['true_peak', 'reference_true_peak']);

        // Ordena priorizando True Peak primeiro, depois priority normal
        filtered.sort((a, b) => {
            const aIsTP = criticalTypes.has(a.metricType) || criticalTypes.has(a.type);
            const bIsTP = criticalTypes.has(b.metricType) || criticalTypes.has(b.type);

            // Se A for True Peak e B não for → A vem primeiro
            if (aIsTP && !bIsTP) return -1;
            // Se B for True Peak e A não for → B vem primeiro
            if (!aIsTP && bIsTP) return 1;

            // Se ambos forem TP ou nenhum for → ordenar por priority normal
            return b.priority - a.priority;
        });

        // Log de auditoria para rastreamento
        const tpSuggestion = filtered.find(s => 
            criticalTypes.has(s.metricType) || criticalTypes.has(s.type)
        );
        if (tpSuggestion) {
            this.logAudit('TP_ORDER', 'True Peak priorizado automaticamente', {
                position: 0,
                type: tpSuggestion.type,
                priority: tpSuggestion.priority,
                severity: tpSuggestion.severity?.level
            });
            console.log(`🎯 [TP-ORDER] True Peak priorizado automaticamente (priority: ${tpSuggestion.priority.toFixed(3)}, severity: ${tpSuggestion.severity?.level || 'N/A'})`);
        }
        
        // Limitar quantidade máxima
        if (filtered.length > this.config.maxSuggestions) {
            filtered = filtered.slice(0, this.config.maxSuggestions);
        }
        
        return filtered;
    }

    /**
     * 📝 Adicionar entrada ao log de auditoria
     * @param {string} type - Tipo de evento
     * @param {string} message - Mensagem
     * @param {Object} data - Dados adicionais
     */
    logAudit(type, message, data = {}) {
        this.auditLog.push({
            timestamp: Date.now(),
            type,
            message,
            data
        });
    }

    /**
     * 📊 Obter estatísticas do processamento
     * @returns {Object} Estatísticas
     */
    getProcessingStats() {
        const referenceSuggestions = this.auditLog.filter(log => log.type === 'REFERENCE_SUGGESTION').length;
        const bandSuggestions = this.auditLog.filter(log => log.type === 'BAND_SUGGESTION').length;
        const heuristicSuggestions = this.auditLog.filter(log => log.type === 'HEURISTIC_SUGGESTION').length;
        
        return {
            totalEvents: this.auditLog.length,
            referenceSuggestions,
            bandSuggestions, 
            heuristicSuggestions,
            errors: this.auditLog.filter(log => log.type.includes('ERROR')).length
        };
    }
}

// Instância global do engine
window.EnhancedSuggestionEngine = EnhancedSuggestionEngine;
window.enhancedSuggestionEngine = new EnhancedSuggestionEngine();

console.log('🎯 Enhanced Suggestion Engine inicializado');
