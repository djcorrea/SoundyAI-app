// 🎯 SISTEMA UNIFICADO DE SUGESTÕES - ARQUITETURA CENTRALIZADA
// O melhor sistema de sugestões do planeta: educativo, modular e compatível

/**
 * 🔄 CAMADA DE NORMALIZAÇÃO DE MÉTRICAS
 * Traduz nomes antigos → nomes novos para compatibilidade total
 */
class MetricsNormalizer {
    constructor() {
        // Mapeamento de compatibilidade back-end → front-end
        this.backendMapping = {
            'lufsIntegrated': 'lufs',
            'truePeakDbtp': 'true_peak', 
            'dynamicRange': 'dr',
            'stereoCorrelation': 'stereo',
            'lra': 'lra'
        };

        // Mapeamento de compatibilidade referência → formato esperado
        this.referenceMapping = {
            'lufs_target': ['legacy_compatibility.lufs_target', 'lufs_target'],
            'true_peak_target': ['legacy_compatibility.true_peak_target', 'true_peak_target'],
            'dr_target': ['legacy_compatibility.dr_target', 'dr_target'],
            'stereo_target': ['legacy_compatibility.stereo_target', 'stereo_target'],
            'lra_target': ['legacy_compatibility.lra_target', 'lra_target'],
            'tol_lufs': ['legacy_compatibility.tol_lufs', 'tol_lufs'],
            'tol_true_peak': ['legacy_compatibility.tol_true_peak', 'tol_true_peak'],
            'tol_dr': ['legacy_compatibility.tol_dr', 'tol_dr'],
            'tol_stereo': ['legacy_compatibility.tol_stereo', 'tol_stereo'],
            'tol_lra': ['legacy_compatibility.tol_lra', 'tol_lra'],
            'bands': ['legacy_compatibility.bands', 'bands']
        };
    }

    /**
     * 🔧 Normalizar métricas vindas do back-end
     * @param {Object} technicalData - Dados técnicos do back-end
     * @returns {Object} Métricas normalizadas
     */
    normalizeBackendMetrics(technicalData) {
        if (!technicalData) return {};

        const normalized = {};

        // Métricas principais
        for (const [backendKey, frontendKey] of Object.entries(this.backendMapping)) {
            if (Number.isFinite(technicalData[backendKey])) {
                normalized[frontendKey] = technicalData[backendKey];
            }
        }

        // Bandas espectrais
        if (technicalData.bandEnergies) {
            for (const [band, data] of Object.entries(technicalData.bandEnergies)) {
                if (data && Number.isFinite(data.rms_db)) {
                    normalized[band] = data.rms_db;
                }
            }
        }

        console.log('🔄 [NORMALIZER] Métricas normalizadas:', {
            input: Object.keys(technicalData),
            output: Object.keys(normalized),
            bandsFound: technicalData.bandEnergies ? Object.keys(technicalData.bandEnergies).length : 0
        });

        return normalized;
    }

    /**
     * 🔧 Normalizar dados de referência do gênero
     * @param {Object} referenceData - Dados de referência do JSON
     * @returns {Object} Referência normalizada
     */
    normalizeReferenceData(referenceData) {
        if (!referenceData) return {};

        const normalized = {};

        // Tentar buscar valores em múltiplos caminhos (fallback robusto)
        for (const [targetKey, possiblePaths] of Object.entries(this.referenceMapping)) {
            for (const path of possiblePaths) {
                const value = this.getNestedValue(referenceData, path);
                if (value !== undefined && value !== null) {
                    normalized[targetKey] = value;
                    break;
                }
            }
        }

        console.log('🔄 [NORMALIZER] Referência normalizada:', {
            genre: referenceData.genre || 'unknown',
            foundKeys: Object.keys(normalized),
            bandsCount: normalized.bands ? Object.keys(normalized.bands).length : 0
        });

        return normalized;
    }

    /**
     * 🔍 Buscar valor aninhado por string path
     * @param {Object} obj - Objeto para buscar
     * @param {string} path - Caminho (ex: 'legacy_compatibility.bands.sub.target_db')
     * @returns {*} Valor encontrado ou undefined
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * 🧪 Validar métricas normalizadas
     * @param {Object} metrics - Métricas para validar
     * @returns {Object} Resultado da validação
     */
    validateMetrics(metrics) {
        const requiredMetrics = ['lufs', 'true_peak'];
        const missing = requiredMetrics.filter(key => !Number.isFinite(metrics[key]));
        
        const validation = {
            isValid: missing.length === 0,
            missing,
            available: Object.keys(metrics).filter(key => Number.isFinite(metrics[key])),
            bandCount: Object.keys(metrics).filter(key => !['lufs', 'true_peak', 'dr', 'stereo', 'lra'].includes(key)).length
        };

        if (!validation.isValid) {
            console.warn('⚠️ [NORMALIZER] Métricas incompletas:', validation);
        }

        return validation;
    }
}

/**
 * 🎯 MOTOR DE SUGESTÕES CENTRAL REFATORADO
 * Integra scoring, z-scores e geração educativa
 */
class SuggestionEngineUnified {
    constructor() {
        this.normalizer = new MetricsNormalizer();
        this.scorer = new SuggestionScorerUnified();
        this.textGenerator = new SuggestionTextGeneratorUnified();
        
        // 📊 Log de auditoria
        this.auditLog = [];
        
        // ⚙️ Configurações globais
        this.config = {
            maxSuggestions: 10,
            minPriority: 0.1,
            enableEducationalMode: true,
            enableZScoreValidation: true,
            logLevel: 'info' // 'debug', 'info', 'warn', 'error'
        };
    }

    /**
     * 🎯 Processamento principal unificado
     * @param {Object} analysis - Análise do áudio
     * @param {Object} referenceData - Dados de referência do gênero
     * @returns {Object} Análise enriquecida com sugestões
     */
    process(analysis, referenceData) {
        const startTime = Date.now();
        this.auditLog = [];

        try {
            this.log('info', 'PROCESS_START', 'Iniciando processamento unificado de sugestões');

            // 1️⃣ Normalizar métricas do back-end
            const metrics = this.normalizer.normalizeBackendMetrics(analysis.technicalData);
            const validation = this.normalizer.validateMetrics(metrics);
            
            if (!validation.isValid) {
                this.log('warn', 'METRICS_INCOMPLETE', 'Métricas incompletas', validation);
            }

            // 2️⃣ Normalizar dados de referência
            const normalizedRef = this.normalizer.normalizeReferenceData(referenceData);

            // 3️⃣ Calcular z-scores e severidade
            const zScores = this.scorer.calculateAllZScores(metrics, normalizedRef);
            const suggestions = [];

            // 4️⃣ Gerar sugestões por métrica principal
            const mainMetrics = [
                { key: 'lufs', target: 'lufs_target', tol: 'tol_lufs', type: 'loudness' },
                { key: 'true_peak', target: 'true_peak_target', tol: 'tol_true_peak', type: 'true_peak' },
                { key: 'dr', target: 'dr_target', tol: 'tol_dr', type: 'dynamics' },
                { key: 'stereo', target: 'stereo_target', tol: 'tol_stereo', type: 'stereo' },
                { key: 'lra', target: 'lra_target', tol: 'tol_lra', type: 'lra' }
            ];

            for (const metric of mainMetrics) {
                const suggestion = this.generateMetricSuggestion(metrics, normalizedRef, zScores, metric, referenceData);
                if (suggestion) {
                    suggestions.push(suggestion);
                }
            }

            // 5️⃣ Gerar sugestões por banda espectral
            if (normalizedRef.bands) {
                for (const [band, refData] of Object.entries(normalizedRef.bands)) {
                    const suggestion = this.generateBandSuggestion(metrics, band, refData, zScores, referenceData);
                    if (suggestion) {
                        suggestions.push(suggestion);
                    }
                }
            }

            // 6️⃣ Filtrar, ordenar e finalizar
            const finalSuggestions = this.finalizeSuggestions(suggestions);

            const processingTime = Date.now() - startTime;
            this.log('info', 'PROCESS_COMPLETE', `Processamento concluído em ${processingTime}ms`, {
                totalSuggestions: finalSuggestions.length,
                avgPriority: finalSuggestions.length > 0 ? 
                    (finalSuggestions.reduce((sum, s) => sum + s.priority, 0) / finalSuggestions.length).toFixed(3) : 0,
                severityDistribution: this.getSeverityDistribution(finalSuggestions)
            });

            // 7️⃣ Retornar análise enriquecida
            return {
                ...analysis,
                suggestions: finalSuggestions,
                _suggestionMetadata: {
                    processingTimeMs: processingTime,
                    metricsValidation: validation,
                    zScores,
                    auditLog: [...this.auditLog]
                }
            };

        } catch (error) {
            this.log('error', 'PROCESS_ERROR', 'Erro no processamento', { error: error.message });
            console.error('🚨 [SUGGESTION_SYSTEM] Erro:', error);
            
            // Fallback gracioso
            return {
                ...analysis,
                suggestions: analysis.suggestions || [],
                _suggestionMetadata: {
                    error: error.message,
                    auditLog: [...this.auditLog]
                }
            };
        }
    }

    /**
     * 🎯 Gerar sugestão para métrica principal
     */
    generateMetricSuggestion(metrics, normalizedRef, zScores, metricConfig, originalRef) {
        const { key, target, tol, type } = metricConfig;
        
        const value = metrics[key];
        const targetValue = normalizedRef[target];
        const tolerance = normalizedRef[tol];
        const zScore = zScores[key + '_z'];

        if (!Number.isFinite(value) || !Number.isFinite(targetValue) || !Number.isFinite(tolerance)) {
            return null;
        }

        const severity = this.scorer.getSeverityFromZScore(zScore);
        
        // Filtrar por severidade (não gerar sugestões para valores OK)
        if (severity.level === 'green') {
            return null;
        }

        const priority = this.scorer.calculatePriority(type, severity, 1.0);
        
        const suggestion = this.textGenerator.generateEducationalSuggestion({
            type,
            metric: key,
            value,
            target: targetValue,
            tolerance,
            zScore,
            severity,
            priority,
            genre: this.extractGenre(originalRef)
        });

        this.log('debug', 'SUGGESTION_GENERATED', `Sugestão ${type}`, {
            value: +value.toFixed(2),
            target: +targetValue.toFixed(2),
            zScore: +zScore.toFixed(2),
            severity: severity.level,
            priority: +priority.toFixed(3)
        });

        return suggestion;
    }

    /**
     * 🎸 Gerar sugestão para banda espectral
     */
    generateBandSuggestion(metrics, band, refData, zScores, originalRef) {
        const value = metrics[band];
        const target = refData.target_db;
        const tolerance = refData.tol_db || 3.0;
        const zScore = zScores[band + '_z'];

        if (!Number.isFinite(value) || !Number.isFinite(target)) {
            return null;
        }

        const severity = this.scorer.getSeverityFromZScore(zScore);
        
        if (severity.level === 'green') {
            return null;
        }

        const priority = this.scorer.calculatePriority('band', severity, 1.0);
        
        const suggestion = this.textGenerator.generateEducationalSuggestion({
            type: 'band',
            metric: band,
            value,
            target,
            tolerance,
            zScore,
            severity,
            priority,
            genre: this.extractGenre(originalRef)
        });

        return suggestion;
    }

    /**
     * 🔧 Finalizar sugestões (filtrar, ordenar, limitar)
     */
    finalizeSuggestions(suggestions) {
        // Filtrar por prioridade mínima
        let filtered = suggestions.filter(s => s.priority >= this.config.minPriority);
        
        // Ordenar por prioridade (descendente)
        filtered.sort((a, b) => b.priority - a.priority);
        
        // Limitar quantidade
        if (filtered.length > this.config.maxSuggestions) {
            filtered = filtered.slice(0, this.config.maxSuggestions);
        }

        return filtered;
    }

    /**
     * 📊 Obter distribuição de severidade
     */
    getSeverityDistribution(suggestions) {
        const dist = { red: 0, orange: 0, yellow: 0, green: 0 };
        suggestions.forEach(s => {
            if (s.severity && s.severity.level) {
                dist[s.severity.level] = (dist[s.severity.level] || 0) + 1;
            }
        });
        return dist;
    }

    /**
     * 🏷️ Extrair gênero dos dados de referência
     */
    extractGenre(referenceData) {
        // Tentar múltiplas fontes para o gênero
        if (referenceData) {
            if (typeof referenceData === 'string') return referenceData;
            if (referenceData.genre) return referenceData.genre;
            if (referenceData.key) return referenceData.key;
            
            // Tentar extrair do primeiro objeto aninhado
            const keys = Object.keys(referenceData);
            if (keys.length > 0 && keys[0] !== 'genres') {
                return keys[0];
            }
        }
        
        // Fallback global
        return window.PROD_AI_REF_GENRE || 'unknown';
    }

    /**
     * 📝 Sistema de log unificado
     */
    log(level, type, message, data = {}) {
        const entry = {
            timestamp: Date.now(),
            level,
            type,
            message,
            data
        };
        
        this.auditLog.push(entry);
        
        if (this.config.logLevel === 'debug' || 
            (this.config.logLevel === 'info' && ['info', 'warn', 'error'].includes(level)) ||
            (this.config.logLevel === 'warn' && ['warn', 'error'].includes(level)) ||
            (this.config.logLevel === 'error' && level === 'error')) {
            
            const prefix = `🎯 [SUGGESTION_SYSTEM]`;
            console[level === 'debug' ? 'log' : level](`${prefix} ${message}`, data);
        }
    }
}

/**
 * 📊 SCORER UNIFICADO E OTIMIZADO
 */
class SuggestionScorerUnified {
    constructor() {
        // 🎨 Configuração de severidade baseada em z-score
        this.severityConfig = {
            green: { threshold: 1.0, score: 0.0, color: '#52f7ad', label: 'OK' },
            yellow: { threshold: 2.0, score: 1.0, color: '#ffd93d', label: 'monitorar' },
            orange: { threshold: 3.0, score: 1.5, color: '#ff8c42', label: 'ajustar' },
            red: { threshold: Infinity, score: 2.0, color: '#ff4757', label: 'corrigir' }
        };

        // ⚖️ Pesos por tipo de métrica
        this.weights = {
            loudness: 1.0,
            true_peak: 0.9,
            dynamics: 0.8,
            band: 0.7,
            lra: 0.6,
            stereo: 0.5
        };
    }

    /**
     * 📐 Calcular z-score
     */
    calculateZScore(value, target, tolerance) {
        if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0) {
            return 0;
        }
        return (value - target) / tolerance;
    }

    /**
     * 📐 Calcular todos os z-scores
     */
    calculateAllZScores(metrics, referenceData) {
        const zScores = {};
        
        // Z-scores principais
        const mainMappings = [
            { metric: 'lufs', target: 'lufs_target', tol: 'tol_lufs' },
            { metric: 'true_peak', target: 'true_peak_target', tol: 'tol_true_peak' },
            { metric: 'dr', target: 'dr_target', tol: 'tol_dr' },
            { metric: 'stereo', target: 'stereo_target', tol: 'tol_stereo' },
            { metric: 'lra', target: 'lra_target', tol: 'tol_lra' }
        ];

        for (const { metric, target, tol } of mainMappings) {
            if (Number.isFinite(metrics[metric]) && 
                Number.isFinite(referenceData[target]) && 
                Number.isFinite(referenceData[tol])) {
                
                zScores[metric + '_z'] = this.calculateZScore(
                    metrics[metric],
                    referenceData[target],
                    referenceData[tol]
                );
            }
        }

        // Z-scores das bandas
        if (referenceData.bands) {
            for (const [band, refData] of Object.entries(referenceData.bands)) {
                if (Number.isFinite(metrics[band]) && 
                    Number.isFinite(refData.target_db) && 
                    Number.isFinite(refData.tol_db)) {
                    
                    zScores[band + '_z'] = this.calculateZScore(
                        metrics[band],
                        refData.target_db,
                        refData.tol_db
                    );
                }
            }
        }

        return zScores;
    }

    /**
     * 🎨 Determinar severidade por z-score
     */
    getSeverityFromZScore(zScore) {
        const absZ = Math.abs(zScore);
        
        if (absZ <= this.severityConfig.green.threshold) {
            return { level: 'green', ...this.severityConfig.green };
        } else if (absZ <= this.severityConfig.yellow.threshold) {
            return { level: 'yellow', ...this.severityConfig.yellow };
        } else if (absZ <= this.severityConfig.orange.threshold) {
            return { level: 'orange', ...this.severityConfig.orange };
        } else {
            return { level: 'red', ...this.severityConfig.red };
        }
    }

    /**
     * 📊 Calcular prioridade
     */
    calculatePriority(metricType, severity, confidence = 1.0) {
        const baseWeight = this.weights[metricType] || 0.5;
        const severityScore = severity.score;
        
        return baseWeight * severityScore * confidence;
    }
}

/**
 * 📚 GERADOR DE TEXTO EDUCATIVO UNIFICADO
 */
class SuggestionTextGeneratorUnified {
    constructor() {
        // 📖 Templates educativos por tipo
        this.templates = {
            loudness: {
                high: {
                    problem: 'Volume muito alto para {genre}',
                    explanation: 'Sua faixa está em {value} LUFS, enquanto o ideal para {genre} é {target} LUFS. Isso significa que sua música pode distorcer em sistemas de reprodução e soar "esmagada".',
                    solution: 'Reduza o ganho geral em ~{delta}dB ou ajuste o limiter para se aproximar de {target} LUFS.'
                },
                low: {
                    problem: 'Volume muito baixo para {genre}',
                    explanation: 'Sua faixa está em {value} LUFS, enquanto o ideal para {genre} é {target} LUFS. Isso significa que sua música vai soar fraca quando comparada com outras do mesmo gênero.',
                    solution: 'Aplique compressão leve no master e use um limiter ajustando o gain até se aproximar de {target} LUFS.'
                }
            },
            true_peak: {
                high: {
                    problem: 'True Peak muito alto',
                    explanation: 'O True Peak está em {value}dBTP, acima do limite seguro de {target}dBTP. Isso pode causar distorção durante a conversão D/A em sistemas reais.',
                    solution: 'Use um limitador com True Peak control, ajustando o ceiling para {target}dBTP.'
                }
            },
            dynamics: {
                low: {
                    problem: 'Dinâmica muito comprimida',
                    explanation: 'O Dynamic Range está em {value}dB, abaixo do ideal de {target}dB para {genre}. Isso indica compressão excessiva que pode causar fadiga auditiva.',
                    solution: 'Reduza a compressão ou use compressão multibanda mais suave para preservar a dinâmica natural.'
                }
            },
            stereo: {
                low: {
                    problem: 'Imagem estéreo com problemas',
                    explanation: 'A correlação estéreo está em {value}, indicando possíveis problemas de fase ou excesso de width.',
                    solution: 'Verifique problemas de fase nos graves e reduza efeitos de width excessivos.'
                }
            },
            band: {
                high: {
                    problem: 'Excesso na banda {metric}',
                    explanation: 'A banda {metric} está {delta}dB acima do ideal para {genre}. Isso pode deixar o som desequilibrado.',
                    solution: 'Reduza {metric} com EQ suave, cortando aproximadamente {delta}dB na região correspondente.'
                },
                low: {
                    problem: 'Deficiência na banda {metric}',
                    explanation: 'A banda {metric} está {delta}dB abaixo do ideal para {genre}. Isso pode deixar o som "vazio" nessa região.',
                    solution: 'Aumente {metric} com EQ suave, reforçando aproximadamente {delta}dB na região correspondente.'
                }
            }
        };

        // 🎨 Mapeamento de bandas para descrições
        this.bandDescriptions = {
            sub: '20-60Hz (Sub-graves)',
            low_bass: '60-150Hz (Graves)',
            upper_bass: '150-300Hz (Graves superiores)',
            low_mid: '300-800Hz (Médios-graves)',
            mid: '800-2000Hz (Médios)',
            high_mid: '2-6kHz (Médios-agudos)',
            brilho: '6-12kHz (Brilho)',
            presenca: '3-6kHz (Presença)'
        };
    }

    /**
     * 🎓 Gerar sugestão educativa completa
     */
    generateEducationalSuggestion(params) {
        const { type, metric, value, target, zScore, severity, priority, genre } = params;
        
        const direction = value > target ? 'high' : 'low';
        const delta = Math.abs(value - target);
        
        // Selecionar template
        const template = this.getTemplate(type, direction);
        
        // Gerar textos educativos
        const problem = this.fillTemplate(template.problem, { metric, value, target, delta, genre });
        const explanation = this.fillTemplate(template.explanation, { metric, value, target, delta, genre });
        const solution = this.fillTemplate(template.solution, { metric, value, target, delta, genre });

        return {
            // 🎯 Identificação
            type: `${type}_${direction}`,
            metric,
            
            // 📚 Textos educativos
            message: problem,
            explanation,
            solution,
            
            // 🎨 Severidade visual
            severity: {
                level: severity.level,
                color: severity.color,
                label: severity.label,
                score: severity.score
            },
            
            // 📊 Dados técnicos
            technical: {
                value: +value.toFixed(2),
                target: +target.toFixed(2),
                delta: +delta.toFixed(2),
                zScore: +zScore.toFixed(2)
            },
            
            // ⚖️ Prioridade
            priority: +priority.toFixed(3),
            
            // 🏷️ Metadata
            genre,
            timestamp: Date.now(),
            
            // 📝 Para compatibilidade com sistema existente
            details: `${severity.label} • Δ${delta.toFixed(1)} • z=${zScore.toFixed(2)} • prior=${priority.toFixed(3)}`
        };
    }

    /**
     * 📖 Obter template por tipo e direção
     */
    getTemplate(type, direction) {
        const typeTemplates = this.templates[type];
        if (typeTemplates && typeTemplates[direction]) {
            return typeTemplates[direction];
        }
        
        // Template padrão
        return {
            problem: 'Métrica {metric} fora do alvo',
            explanation: 'O valor atual está fora do range ideal para o gênero.',
            solution: 'Ajuste necessário na mixagem ou masterização.'
        };
    }

    /**
     * 🔤 Preencher template com variáveis
     */
    fillTemplate(template, vars) {
        let filled = template;
        
        for (const [key, value] of Object.entries(vars)) {
            const placeholder = `{${key}}`;
            filled = filled.replace(new RegExp(placeholder, 'g'), value);
        }
        
        // Adicionar descrição da banda se aplicável
        if (vars.metric && this.bandDescriptions[vars.metric]) {
            filled = filled.replace(vars.metric, `${vars.metric} ${this.bandDescriptions[vars.metric]}`);
        }
        
        return filled;
    }
}

// 🌟 INICIALIZAÇÃO DO SISTEMA UNIFICADO
class SuggestionSystemManager {
    constructor() {
        this.engine = new SuggestionEngineUnified();
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        // Criar instância global unificada
        window.suggestionSystem = {
            engine: this.engine,
            scorer: this.engine.scorer,
            textGenerator: this.engine.textGenerator,
            normalizer: this.engine.normalizer,
            
            // 🎯 Interface principal
            process: (analysis, refData) => this.engine.process(analysis, refData),
            
            // 🔧 Utilitários
            calculateZScore: (value, target, tolerance) => this.engine.scorer.calculateZScore(value, target, tolerance),
            getSeverity: (zScore) => this.engine.scorer.getSeverityFromZScore(zScore),
            
            // ⚙️ Configuração
            configure: (newConfig) => Object.assign(this.engine.config, newConfig),
            getConfig: () => ({ ...this.engine.config }),
            
            // 📊 Diagnóstico
            getLastAuditLog: () => [...this.engine.auditLog],
            validateSystem: () => this.validateSystem()
        };

        this.isInitialized = true;
        console.log('🎯 Sistema Unificado de Sugestões inicializado com sucesso!');
        console.log('📋 Acesse via: window.suggestionSystem');
        
        // Log das capacidades
        console.log('🎯 Capacidades ativas:', {
            maxSuggestions: this.engine.config.maxSuggestions,
            educationalMode: this.engine.config.enableEducationalMode,
            severityLevels: ['🟢 green', '🟡 yellow', '🟠 orange', '🔴 red'],
            supportedMetrics: ['lufs', 'true_peak', 'dr', 'stereo', 'lra', 'bandas espectrais']
        });
    }

    validateSystem() {
        const checks = {
            engine: !!this.engine,
            scorer: !!this.engine.scorer,
            textGenerator: !!this.engine.textGenerator,
            normalizer: !!this.engine.normalizer,
            globalAccess: !!window.suggestionSystem,
            configValid: !!this.engine.config
        };

        const isValid = Object.values(checks).every(Boolean);
        
        console.log('🔍 Validação do Sistema:', checks, isValid ? '✅ OK' : '❌ ERRO');
        
        return { checks, isValid };
    }
}

// 🚀 AUTO-INICIALIZAÇÃO
const systemManager = new SuggestionSystemManager();
systemManager.init();

// 📚 DOCUMENTAÇÃO PARA DESENVOLVEDORES
console.log(`
🎯 SISTEMA UNIFICADO DE SUGESTÕES - DOCUMENTAÇÃO

📋 USO PRINCIPAL:
const result = window.suggestionSystem.process(analysis, referenceData);

🎨 SEVERIDADE POR COR:
🟢 Verde:  |z| ≤ 1.0 (OK)
🟡 Amarelo: 1.0 < |z| ≤ 2.0 (monitorar)  
🟠 Laranja: 2.0 < |z| ≤ 3.0 (ajustar)
🔴 Vermelho: |z| > 3.0 (corrigir)

🎵 ADICIONAR NOVO GÊNERO:
1. Criar arquivo: public/refs/out/novo_genero.json
2. Incluir: legacy_compatibility.lufs_target, bands, tolerâncias
3. Pronto! Sistema detecta automaticamente.

🔧 CONFIGURAÇÃO:
window.suggestionSystem.configure({
  maxSuggestions: 8,
  minPriority: 0.2,
  enableEducationalMode: true
});
`);