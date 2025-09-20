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
     * 🔧 Normalizar dados de referência para compatibilidade universal
     * @param {Object} rawRef - Dados de referência brutos (legacy_compatibility ou hybrid_processing)
     * @returns {Object} Dados normalizados no formato padrão do motor
     */
    normalizeReferenceData(rawRef) {
        if (!rawRef || typeof rawRef !== 'object') {
            console.warn('🚨 Dados de referência inválidos ou ausentes');
            this.logAudit('NORMALIZE_ERROR', 'Dados de referência inválidos', { rawRef });
            return null;
        }

        // Detectar estrutura dos dados
        let sourceData = null;
        let structureType = 'unknown';

        // Tentar legacy_compatibility primeiro
        if (rawRef.legacy_compatibility && typeof rawRef.legacy_compatibility === 'object') {
            sourceData = rawRef.legacy_compatibility;
            structureType = 'legacy_compatibility';
        }
        // Tentar hybrid_processing (estrutura atual dos JSONs)
        else if (rawRef.hybrid_processing && typeof rawRef.hybrid_processing === 'object') {
            sourceData = rawRef.hybrid_processing;
            structureType = 'hybrid_processing';
        }
        // Tentar estrutura direta (genreName: {...})
        else {
            const firstKey = Object.keys(rawRef)[0];
            if (firstKey && rawRef[firstKey] && typeof rawRef[firstKey] === 'object') {
                sourceData = rawRef[firstKey];
                structureType = 'genre_direct';
                
                // Se tem hybrid_processing dentro, usar isso
                if (sourceData.hybrid_processing) {
                    sourceData = sourceData.hybrid_processing;
                    structureType = 'genre_direct_hybrid';
                }
            }
        }

        if (!sourceData) {
            console.warn('🚨 Estrutura de dados de referência não reconhecida');
            this.logAudit('NORMALIZE_ERROR', 'Estrutura não reconhecida', { rawRef, keys: Object.keys(rawRef) });
            return null;
        }

        this.logAudit('NORMALIZE_START', `Normalizando dados: ${structureType}`, { structureType });

        // Normalizar métricas principais
        const normalized = {
            // LUFS
            lufs_target: this.extractMetric(sourceData, ['lufs_target', 'lufs_ref', 'lufs_integrated'], 'lufs'),
            tol_lufs: this.extractMetric(sourceData, ['tol_lufs', 'lufs_tolerance', 'tol_lufs_min'], 'lufs_tolerance') ?? 2.0,

            // True Peak
            true_peak_target: this.extractMetric(sourceData, ['true_peak_target', 'tp_ref', 'true_peak', 'true_peak_dbtp'], 'true_peak'),
            tol_true_peak: this.extractMetric(sourceData, ['tol_true_peak', 'tp_tolerance', 'true_peak_tolerance'], 'true_peak_tolerance') ?? 1.0,

            // Dynamic Range
            dr_target: this.extractMetric(sourceData, ['dr_target', 'dr_ref', 'dynamic_range'], 'dr'),
            tol_dr: this.extractMetric(sourceData, ['tol_dr', 'dr_tolerance', 'dynamic_range_tolerance'], 'dr_tolerance') ?? 2.0,

            // Loudness Range
            lra_target: this.extractMetric(sourceData, ['lra_target', 'lra_ref', 'lra'], 'lra'),
            tol_lra: this.extractMetric(sourceData, ['tol_lra', 'lra_tolerance'], 'lra_tolerance') ?? 2.0,

            // Stereo Correlation
            stereo_target: this.extractMetric(sourceData, ['stereo_target', 'stereo_ref', 'stereo_correlation'], 'stereo'),
            tol_stereo: this.extractMetric(sourceData, ['tol_stereo', 'stereo_tolerance', 'correlation_tolerance'], 'stereo_tolerance') ?? 0.15,

            // Bandas espectrais
            bands: this.normalizeBands(sourceData)
        };

        // Log das métricas encontradas
        const foundMetrics = Object.keys(normalized).filter(key => 
            key !== 'bands' && normalized[key] !== null && normalized[key] !== undefined
        );
        const foundBands = normalized.bands ? Object.keys(normalized.bands) : [];

        this.logAudit('NORMALIZE_SUCCESS', 'Dados normalizados com sucesso', {
            structureType,
            foundMetrics,
            foundBands,
            metricsCount: foundMetrics.length,
            bandsCount: foundBands.length
        });

        return normalized;
    }

    /**
     * 🔍 Extrair métrica com fallbacks
     * @param {Object} source - Objeto fonte
     * @param {Array} keys - Lista de chaves possíveis (em ordem de prioridade)
     * @param {string} metricName - Nome da métrica para log
     * @returns {number|null} Valor encontrado ou null
     */
    extractMetric(source, keys, metricName) {
        for (const key of keys) {
            if (source[key] !== undefined && source[key] !== null && Number.isFinite(source[key])) {
                this.logAudit('METRIC_FOUND', `${metricName}: ${source[key]} (via ${key})`, { metricName, key, value: source[key] });
                return source[key];
            }
        }

        // Tentar buscar em original_metrics se disponível
        if (source.original_metrics) {
            for (const key of keys) {
                if (source.original_metrics[key] !== undefined && Number.isFinite(source.original_metrics[key])) {
                    this.logAudit('METRIC_FOUND', `${metricName}: ${source.original_metrics[key]} (via original_metrics.${key})`, { metricName, key, value: source.original_metrics[key] });
                    return source.original_metrics[key];
                }
            }
        }

        console.warn(`⚠️ Métrica não encontrada: ${metricName}`, { tentativas: keys, source: Object.keys(source) });
        this.logAudit('METRIC_MISSING', `Métrica ausente: ${metricName}`, { keys, availableKeys: Object.keys(source) });
        return null;
    }

    /**
     * 🎵 Normalizar bandas espectrais
     * @param {Object} source - Objeto fonte
     * @returns {Object} Bandas normalizadas
     */
    normalizeBands(source) {
        const bands = {};
        let sourceBands = null;

        // Tentar encontrar bandas em diferentes locais
        if (source.bands) {
            sourceBands = source.bands;
        } else if (source.spectral_bands) {
            sourceBands = source.spectral_bands;
        } else if (source.original_metrics && source.original_metrics.bands) {
            sourceBands = source.original_metrics.bands;
        }

        if (!sourceBands || typeof sourceBands !== 'object') {
            console.warn('⚠️ Bandas espectrais não encontradas');
            this.logAudit('BANDS_MISSING', 'Bandas espectrais ausentes', { source: Object.keys(source) });
            return {};
        }

        // Mapeamentos de bandas (de nomes antigos/alternativos para padronizados)
        const bandMappings = {
            // Mapeamento direto (nome padrão)
            'sub': 'sub',
            'bass': 'bass',
            'lowMid': 'lowMid', 
            'mid': 'mid',
            'highMid': 'highMid',
            'presence': 'presence',
            'air': 'air',

            // Mapeamentos específicos dos JSONs atuais
            'low_bass': 'bass',        // 60-150 Hz
            'upper_bass': 'lowMid',    // 150-300 Hz (mais adequado para lowMid)
            'low_mid': 'lowMid',       // 300-800 Hz
            'high_mid': 'highMid',     // 2-6 kHz
            'presenca': 'presence',    // 3-6 kHz
            'brilho': 'air',          // 6-12 kHz

            // Mapeamentos adicionais
            'low': 'bass',
            'high': 'air',
            'brightness': 'air'
        };

        // Processar cada banda encontrada
        for (const [sourceBandName, bandData] of Object.entries(sourceBands)) {
            if (!bandData || typeof bandData !== 'object') continue;

            // Encontrar nome padronizado
            const standardName = bandMappings[sourceBandName] || sourceBandName;

            // Extrair target_db e tol_db
            const target_db = Number.isFinite(bandData.target_db) ? bandData.target_db : null;
            const tol_db = Number.isFinite(bandData.tol_db) ? bandData.tol_db : 
                          Number.isFinite(bandData.tolerance) ? bandData.tolerance :
                          Number.isFinite(bandData.toleranceDb) ? bandData.toleranceDb : 3.0; // Default

            if (target_db !== null) {
                // Se a banda já existe, manter a primeira encontrada (prioridade por ordem)
                if (!bands[standardName]) {
                    bands[standardName] = {
                        target_db,
                        tol_db
                    };

                    this.logAudit('BAND_MAPPED', `Banda mapeada: ${sourceBandName} → ${standardName}`, {
                        sourceName: sourceBandName,
                        standardName,
                        target_db,
                        tol_db
                    });
                } else {
                    this.logAudit('BAND_SKIPPED', `Banda duplicada ignorada: ${sourceBandName} → ${standardName}`, {
                        sourceName: sourceBandName,
                        standardName,
                        existing: bands[standardName],
                        skipped: { target_db, tol_db }
                    });
                }
            } else {
                console.warn(`⚠️ Banda sem target_db válido: ${sourceBandName}`);
                this.logAudit('BAND_INVALID', `Banda inválida: ${sourceBandName}`, { bandData });
            }
        }

        return bands;
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
            // � NORMALIZAR DADOS DE REFERÊNCIA PRIMEIRO
            const normalizedRef = this.normalizeReferenceData(referenceData);
            if (!normalizedRef) {
                console.warn('🚨 Falha na normalização dos dados de referência - continuando sem sugestões');
                this.logAudit('PROCESSING_ERROR', 'Dados de referência não normalizáveis', { referenceData });
                return {
                    ...analysis,
                    suggestions: analysis.suggestions || [],
                    enhancedMetrics: { error: 'Dados de referência inválidos' },
                    auditLog: [...this.auditLog]
                };
            }

            // �📊 Extrair métricas e calcular z-scores
            const metrics = this.extractMetrics(analysis, normalizedRef);
            const zScores = this.calculateAllZScores(metrics, normalizedRef);
            
            // 🎖️ Calcular confiança baseada na qualidade da análise
            const confidence = this.scorer.calculateConfidence(this.extractQualityMetrics(analysis));
            
            // 🔗 Calcular bônus de dependência
            const dependencyBonuses = this.scorer.calculateDependencyBonus(zScores);
            
            // 🎯 Gerar sugestões baseadas em referência
            const referenceSuggestions = this.generateReferenceSuggestions(
                metrics, normalizedRef, zScores, confidence, dependencyBonuses
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
        
        // Bandas espectrais - mapear para nomes padronizados
        const bandEnergies = tech.bandEnergies || {};
        
        // Mapeamento reverso: das bandas da análise para as bandas normalizadas
        const bandMappings = {
            'sub': 'sub',
            'low_bass': 'bass',
            'upper_bass': 'lowMid',
            'low_mid': 'lowMid',
            'mid': 'mid',
            'high_mid': 'highMid',
            'presenca': 'presence',
            'brilho': 'air',
            
            // Aliases adicionais
            'bass': 'bass',
            'lowMid': 'lowMid',
            'highMid': 'highMid',
            'presence': 'presence',
            'air': 'air'
        };
        
        for (const [sourceBand, data] of Object.entries(bandEnergies)) {
            if (data && Number.isFinite(data.rms_db)) {
                // Mapear para nome padrão se disponível
                const standardBandName = bandMappings[sourceBand] || sourceBand;
                metrics[standardBandName] = data.rms_db;
                
                // Log do mapeamento
                if (bandMappings[sourceBand] && bandMappings[sourceBand] !== sourceBand) {
                    this.logAudit('BAND_METRIC_MAPPED', `Banda métrica mapeada: ${sourceBand} → ${standardBandName}`, {
                        source: sourceBand,
                        standard: standardBandName,
                        value: data.rms_db
                    });
                }
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
        
        // Sugestões para bandas espectrais
        if (referenceData.bands) {
            for (const [band, refData] of Object.entries(referenceData.bands)) {
                const value = metrics[band];
                const target = refData.target_db;
                const tolerance = refData.tol_db;
                const zScore = zScores[band + '_z'];
                
                if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance)) continue;
                
                const severity = this.scorer.getSeverity(zScore);
                
                const shouldInclude = severity.level !== 'green' || 
                    (severity.level === 'yellow' && this.config.includeYellowSeverity);
                
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
                        tolerance,
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
                        target: +target.toFixed(2),
                        delta: +(value - target).toFixed(2),
                        zScore: +zScore.toFixed(2),
                        severity: severity.level,
                        priority: +priority.toFixed(3)
                    });
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
            // Construir espectro simplificado a partir de frequências dominantes
            const freqBins = [];
            const magnitude = [];
            
            for (const freq of analysis.technicalData.dominantFrequencies) {
                freqBins.push(freq.frequency);
                magnitude.push(freq.magnitude || 0.1);
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
        
        // Ordenar por prioridade (descendente)
        filtered.sort((a, b) => b.priority - a.priority);
        
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

    /**
     * 🧪 Testar normalização de dados de referência (para debugging)
     * @param {Object} rawRef - Dados brutos para teste
     * @returns {Object} Resultado do teste
     */
    testNormalization(rawRef) {
        console.log('🧪 Testando normalização de dados de referência...');
        const startTime = Date.now();
        
        const result = this.normalizeReferenceData(rawRef);
        const duration = Date.now() - startTime;
        
        console.log(`⏱️ Normalização concluída em ${duration}ms`);
        console.log('📊 Resultado:', result);
        console.log('📝 Log de auditoria:', this.auditLog);
        
        return {
            success: result !== null,
            result,
            duration,
            auditLog: [...this.auditLog]
        };
    }

    /**
     * 🔍 Inspecionar dados de referência (para debugging)
     * @param {Object} rawRef - Dados para inspeção
     * @returns {Object} Relatório de inspeção
     */
    inspectReferenceData(rawRef) {
        if (!rawRef || typeof rawRef !== 'object') {
            return { error: 'Dados inválidos' };
        }

        const inspection = {
            topLevelKeys: Object.keys(rawRef),
            hasLegacyCompatibility: !!rawRef.legacy_compatibility,
            hasHybridProcessing: !!rawRef.hybrid_processing,
            structures: {}
        };

        // Analisar cada estrutura encontrada
        if (rawRef.legacy_compatibility) {
            inspection.structures.legacy_compatibility = {
                keys: Object.keys(rawRef.legacy_compatibility),
                hasMainMetrics: !!(rawRef.legacy_compatibility.lufs_target || 
                                rawRef.legacy_compatibility.true_peak_target),
                hasBands: !!rawRef.legacy_compatibility.bands,
                bandsCount: rawRef.legacy_compatibility.bands ? 
                           Object.keys(rawRef.legacy_compatibility.bands).length : 0
            };
        }

        if (rawRef.hybrid_processing) {
            inspection.structures.hybrid_processing = {
                keys: Object.keys(rawRef.hybrid_processing),
                hasOriginalMetrics: !!rawRef.hybrid_processing.original_metrics,
                hasSpectralBands: !!rawRef.hybrid_processing.spectral_bands
            };
        }

        // Verificar estrutura de gênero direto
        const firstKey = Object.keys(rawRef)[0];
        if (firstKey && rawRef[firstKey] && typeof rawRef[firstKey] === 'object') {
            inspection.structures.genre_direct = {
                genreName: firstKey,
                keys: Object.keys(rawRef[firstKey]),
                hasHybridProcessing: !!rawRef[firstKey].hybrid_processing
            };
        }

        return inspection;
    }
}

// ===== HOOK DE AUDITORIA PERMANENTE =====
// Captura todos os parâmetros que chegam ao processAnalysis para debugging
(function() {
    const originalProcessAnalysis = EnhancedSuggestionEngine.prototype.processAnalysis;
    
    EnhancedSuggestionEngine.prototype.processAnalysis = function(analysis, referenceData, options = {}) {
        // Salvar dados globalmente para inspeção
        window.__DEBUG_ANALYSIS__ = analysis;
        window.__DEBUG_REF__ = referenceData;
        window.__DEBUG_OPTIONS__ = options;
        
        // Log detalhado para auditoria
        console.log("[AUDITORIA] processAnalysis capturado", {
            analysis,
            referenceData,
            options,
            timestamp: new Date().toISOString()
        });
        
        // Chamar método original sem alterações
        return originalProcessAnalysis.apply(this, arguments);
    };
    
    console.log('🔍 Hook de auditoria ativado para processAnalysis');
})();

// Instância global do engine
window.EnhancedSuggestionEngine = EnhancedSuggestionEngine;
window.enhancedSuggestionEngine = new EnhancedSuggestionEngine();

console.log('🎯 Enhanced Suggestion Engine inicializado');
