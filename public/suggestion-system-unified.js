// 🎯 SISTEMA UNIFICADO DE SUGESTÕES - VERSÃO CORRIGIDA
// Corrige: Trance não aparece, textos inadequados, cálculo delta incorreto, cobertura incompleta

/**
 * 🔄 CAMADA DE NORMALIZAÇÃO DE MÉTRICAS CORRIGIDA
 */
class MetricsNormalizer {
    constructor() {
        // Mapeamento backend → frontend CORRIGIDO
        this.backendMapping = {
            'lufsIntegrated': 'lufs',
            'truePeakDbtp': 'true_peak', 
            'dynamicRange': 'dr',
            'stereoCorrelation': 'stereo',
            'lra': 'lra',
            'volumeConsistencyLU': 'vol_consistency',
            'bandEnergies': 'band_energies',
            // Fallbacks para nomes antigos
            'loudnessLUFS': 'lufs',
            'truePeak': 'true_peak',
            'dynamicRangeDb': 'dr',
            'stereoWidth': 'stereo',
            'loudnessRange': 'lra'
        };

        // Mapeamento de bandas para estrutura padrão
        this.bandMapping = {
            0: 'sub',        // 20-60 Hz
            1: 'bass',       // 60-250 Hz  
            2: 'low_mid',    // 250-500 Hz
            3: 'mid',        // 500-2000 Hz
            4: 'high_mid',   // 2-4 kHz
            5: 'presence',   // 4-8 kHz
            6: 'air'         // 8+ kHz
        };
    }

    /**
     * 🔧 Normalizar métricas vindas do back-end
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

        // Normalizar bandas espectrais
        if (Array.isArray(technicalData.bandEnergies)) {
            normalized.bands = {};
            technicalData.bandEnergies.forEach((energy, index) => {
                const bandName = this.bandMapping[index];
                if (bandName && Number.isFinite(energy.rms_db)) {
                    normalized.bands[bandName] = {
                        rms_db: energy.rms_db,
                        energy_pct: energy.energy_percentage || 0
                    };
                }
            });
        }

        return normalized;
    }

    /**
     * 🎯 Normalizar referências de gênero CORRIGIDO
     */
    normalizeReferenceData(referenceData) {
        if (!referenceData) return null;

        // Tentar encontrar dados do gênero
        const genreKey = Object.keys(referenceData)[0];
        const genreData = referenceData[genreKey];
        
        if (!genreData) return null;

        const normalized = {
            genre: genreKey,
            // Priorizar legacy_compatibility, depois hybrid_processing
            lufs_target: this.getValue(genreData, ['legacy_compatibility.lufs_target', 'hybrid_processing.original_metrics.lufs_integrated']),
            true_peak_target: this.getValue(genreData, ['legacy_compatibility.true_peak_target', 'hybrid_processing.original_metrics.true_peak_dbtp']),
            dr_target: this.getValue(genreData, ['legacy_compatibility.dr_target', 'hybrid_processing.original_metrics.dynamic_range']),
            stereo_target: this.getValue(genreData, ['legacy_compatibility.stereo_target', 'hybrid_processing.original_metrics.stereo_correlation']),
            lra_target: this.getValue(genreData, ['legacy_compatibility.lra_target', 'hybrid_processing.original_metrics.lra']),
            
            // Tolerâncias
            tol_lufs: this.getValue(genreData, ['legacy_compatibility.tol_lufs']) || 2.5,
            tol_true_peak: this.getValue(genreData, ['legacy_compatibility.tol_true_peak']) || 1.0,
            tol_dr: this.getValue(genreData, ['legacy_compatibility.tol_dr']) || 1.5,
            tol_stereo: this.getValue(genreData, ['legacy_compatibility.tol_stereo']) || 0.25,
            tol_lra: this.getValue(genreData, ['legacy_compatibility.tol_lra']) || 1.5,
            
            // Bandas espectrais
            bands: this.getValue(genreData, ['legacy_compatibility.bands', 'hybrid_processing.spectral_bands']) || {}
        };

        return normalized;
    }

    /**
     * 🔍 Buscar valor aninhado com múltiplos caminhos
     */
    getValue(obj, paths) {
        for (const path of paths) {
            const value = path.split('.').reduce((o, k) => o && o[k], obj);
            if (value !== undefined) return value;
        }
        return undefined;
    }
}

/**
 * 🎯 ENGINE PRINCIPAL CORRIGIDO - Gera sugestões para TODAS as métricas
 */
class SuggestionEngineUnified {
    constructor() {
        this.normalizer = new MetricsNormalizer();
        this.scorer = new SuggestionScorerUnified();
        this.textGenerator = new SuggestionTextGeneratorUnified();
    }

    /**
     * 🚀 Processar análise completa CORRIGIDO
     */
    process(analysis, referenceData) {
        const startTime = performance.now();
        
        try {
            // 1. Normalizar dados
            const normalizedMetrics = this.normalizer.normalizeBackendMetrics(analysis.technicalData);
            const normalizedReference = this.normalizer.normalizeReferenceData(referenceData);
            
            if (!normalizedReference) {
                warn('🚨 Referência de gênero não encontrada');
                return { suggestions: [], _suggestionMetadata: { error: 'invalid_reference' } };
            }

            log('📊 [ENGINE] Processando:', normalizedReference.genre);
            
            // 2. Gerar sugestões para TODAS as métricas
            const suggestions = [];
            
            // Métricas principais - OBRIGATÓRIAS
            suggestions.push(...this.processMainMetrics(normalizedMetrics, normalizedReference));
            
            // Bandas espectrais - TODAS
            suggestions.push(...this.processBandMetrics(normalizedMetrics, normalizedReference));
            
            // 3. Calcular severidade e ordenar
            const scoredSuggestions = suggestions.map(s => this.scorer.calculateSeverity(s));
            scoredSuggestions.sort((a, b) => this.scorer.prioritize(a, b));
            
            // 4. Gerar textos educativos
            const finalSuggestions = scoredSuggestions.map(s => this.textGenerator.generateText(s));
            
            const processingTime = performance.now() - startTime;
            
            log(`✅ [ENGINE] ${finalSuggestions.length} sugestões geradas em ${processingTime.toFixed(2)}ms`);
            
            return {
                suggestions: finalSuggestions,
                _suggestionMetadata: {
                    processingTimeMs: processingTime,
                    genre: normalizedReference.genre,
                    metricsProcessed: Object.keys(normalizedMetrics).length,
                    bandsProcessed: Object.keys(normalizedMetrics.bands || {}).length
                }
            };
            
        } catch (error) {
            error('❌ [ENGINE] Erro:', error);
            return { 
                suggestions: [], 
                _suggestionMetadata: { error: error.message } 
            };
        }
    }

    /**
     * 📊 Processar métricas principais CORRIGIDO
     */
    processMainMetrics(metrics, reference) {
        const suggestions = [];
        
        // LUFS - Modo "alvo"
        if (Number.isFinite(metrics.lufs) && Number.isFinite(reference.lufs_target)) {
            const delta = metrics.lufs - reference.lufs_target;
            if (Math.abs(delta) > reference.tol_lufs) {
                suggestions.push({
                    metric: 'lufs',
                    measured: metrics.lufs,
                    target: reference.lufs_target,
                    tolerance: reference.tol_lufs,
                    delta: delta,
                    direction: delta > 0 ? 'reduce' : 'increase',
                    unit: 'LUFS',
                    mode: 'target'
                });
            }
        }
        
        // True Peak - Modo "limite superior"
        if (Number.isFinite(metrics.true_peak) && Number.isFinite(reference.true_peak_target)) {
            const excess = metrics.true_peak - reference.true_peak_target;
            if (excess > 0) {
                suggestions.push({
                    metric: 'true_peak',
                    measured: metrics.true_peak,
                    target: reference.true_peak_target,
                    tolerance: reference.tol_true_peak,
                    delta: excess,
                    direction: 'reduce',
                    unit: 'dBTP',
                    mode: 'ceiling'
                });
            }
        }
        
        // Dynamic Range - Modo "alvo"
        if (Number.isFinite(metrics.dr) && Number.isFinite(reference.dr_target)) {
            const delta = metrics.dr - reference.dr_target;
            if (Math.abs(delta) > reference.tol_dr) {
                suggestions.push({
                    metric: 'dr',
                    measured: metrics.dr,
                    target: reference.dr_target,
                    tolerance: reference.tol_dr,
                    delta: delta,
                    direction: delta > 0 ? 'reduce' : 'increase',
                    unit: 'dB',
                    mode: 'target'
                });
            }
        }
        
        // LRA - Modo "janela"
        if (Number.isFinite(metrics.lra) && Number.isFinite(reference.lra_target)) {
            const delta = metrics.lra - reference.lra_target;
            if (Math.abs(delta) > reference.tol_lra) {
                suggestions.push({
                    metric: 'lra',
                    measured: metrics.lra,
                    target: reference.lra_target,
                    tolerance: reference.tol_lra,
                    delta: delta,
                    direction: delta > 0 ? 'reduce' : 'increase',
                    unit: 'LU',
                    mode: 'target'
                });
            }
        }
        
        // Stereo Correlation - Modo "alvo"
        if (Number.isFinite(metrics.stereo) && Number.isFinite(reference.stereo_target)) {
            const delta = metrics.stereo - reference.stereo_target;
            if (Math.abs(delta) > reference.tol_stereo) {
                suggestions.push({
                    metric: 'stereo',
                    measured: metrics.stereo,
                    target: reference.stereo_target,
                    tolerance: reference.tol_stereo,
                    delta: delta,
                    direction: delta > 0 ? 'reduce' : 'increase',
                    unit: '',
                    mode: 'target'
                });
            }
        }
        
        // Volume Consistency (se disponível)
        if (Number.isFinite(metrics.vol_consistency)) {
            const target = 2.5; // Padrão para consistência
            const tolerance = 1.5;
            const delta = metrics.vol_consistency - target;
            if (Math.abs(delta) > tolerance) {
                suggestions.push({
                    metric: 'vol_consistency',
                    measured: metrics.vol_consistency,
                    target: target,
                    tolerance: tolerance,
                    delta: delta,
                    direction: delta > 0 ? 'reduce' : 'increase',
                    unit: 'LU',
                    mode: 'target'
                });
            }
        }
        
        return suggestions;
    }

    /**
     * 🎵 Processar bandas espectrais CORRIGIDO - TODAS as bandas
     */
    processBandMetrics(metrics, reference) {
        const suggestions = [];
        
        if (!metrics.bands || !reference.bands) return suggestions;
        
        // Processar TODAS as bandas disponíveis
        for (const [bandName, bandData] of Object.entries(metrics.bands)) {
            const refBand = reference.bands[bandName];
            if (!refBand) continue;
            
            const measured = bandData.rms_db;
            const target = refBand.target_db;
            const tolerance = refBand.tol_db || 2.5;
            
            if (Number.isFinite(measured) && Number.isFinite(target)) {
                const delta = measured - target;
                if (Math.abs(delta) > tolerance) {
                    suggestions.push({
                        metric: `band:${bandName}`,
                        measured: measured,
                        target: target,
                        tolerance: tolerance,
                        delta: delta,
                        direction: delta > 0 ? 'reduce' : 'increase',
                        unit: 'dB',
                        mode: 'target',
                        bandName: bandName
                    });
                }
            }
        }
        
        return suggestions;
    }
}

/**
 * 🎯 SCORER CORRIGIDO - Z-score e severidade por cores
 */
class SuggestionScorerUnified {
    constructor() {
        this.severityColors = {
            green: '#28a745',
            yellow: '#ffc107', 
            orange: '#fd7e14',
            red: '#dc3545'
        };
    }

    /**
     * 📊 Calcular severidade usando z-score CORRIGIDO
     */
    calculateSeverity(suggestion) {
        const z = Math.abs(suggestion.delta) / suggestion.tolerance;
        
        let severity, color, label;
        
        if (z <= 1.0) {
            severity = 'green';
            color = this.severityColors.green;
            label = 'ok';
        } else if (z <= 2.0) {
            severity = 'yellow';
            color = this.severityColors.yellow;
            label = 'monitorar';
        } else if (z <= 3.0) {
            severity = 'orange';
            color = this.severityColors.orange;
            label = 'ajustar';
        } else {
            severity = 'red';
            color = this.severityColors.red;
            label = 'crítico';
        }

        return {
            ...suggestion,
            severity: { level: severity, color: color, label: label },
            z_score: z
        };
    }

    /**
     * 🔢 Priorizar sugestões: severidade > tipo de métrica
     */
    prioritize(a, b) {
        // 1. Por severidade (vermelho > laranja > amarelo > verde)
        const severityOrder = { red: 4, orange: 3, yellow: 2, green: 1 };
        const aSev = severityOrder[a.severity.level];
        const bSev = severityOrder[b.severity.level];
        
        if (aSev !== bSev) return bSev - aSev;
        
        // 2. Por importância da métrica
        const metricOrder = { lufs: 5, true_peak: 4, dr: 3, lra: 2, stereo: 1 };
        const aOrder = metricOrder[a.metric] || 0;
        const bOrder = metricOrder[b.metric] || 0;
        
        return bOrder - aOrder;
    }
}

/**
 * 📝 GERADOR DE TEXTO EDUCATIVO CORRIGIDO
 */
class SuggestionTextGeneratorUnified {
    constructor() {
        this.templates = {
            lufs: {
                title: (s) => `LUFS ${s.direction === 'reduce' ? 'muito alto' : 'muito baixo'} (${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)} ${s.unit})`,
                explanation: (s) => `Você está em ${s.measured.toFixed(1)} LUFS, enquanto o ideal para ${this.getGenreName(s)} é ${s.target.toFixed(1)} ± ${s.tolerance.toFixed(1)} LUFS. ${s.direction === 'reduce' ? 'Volume muito alto pode causar fadiga auditiva e limitar o headroom.' : 'Volume muito baixo reduz o impacto e competitividade.'}`,
                solution: (s) => `${s.direction === 'reduce' ? 'Reduza' : 'Aumente'} ~${Math.abs(s.delta).toFixed(1)} LUFS ${s.direction === 'reduce' ? 'diminuindo o gain do limiter ou master' : 'aumentando o gain geral'}. ${s.direction === 'reduce' ? 'Mantenha ceiling em -1.0 dBTP.' : 'Cuidado com clipping e distorção.'}`
            },
            true_peak: {
                title: (s) => `True Peak acima do limite (+${s.delta.toFixed(1)} ${s.unit})`,
                explanation: (s) => `Você está em ${s.measured.toFixed(1)} dBTP, ultrapassando o limite de ${s.target.toFixed(1)} dBTP. Isso pode causar clipping digital em conversores D/A e distorção em sistemas de reprodução.`,
                solution: (s) => `Reduza ~${Math.abs(s.delta).toFixed(1)} dB ajustando o ceiling do limiter para ${s.target.toFixed(1)} dBTP. Use oversampling 4x no limiter para detectar inter-sample peaks.`
            },
            dr: {
                title: (s) => `DR ${s.direction === 'reduce' ? 'muito alto' : 'muito baixo'} (${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)} ${s.unit})`,
                explanation: (s) => `Sua faixa tem DR=${s.measured.toFixed(1)} dB, enquanto o ideal para ${this.getGenreName(s)} é ${s.target.toFixed(1)} ± ${s.tolerance.toFixed(1)} dB. ${s.direction === 'reduce' ? 'DR muito alto pode deixar a faixa inconsistente e sem impacto em sistemas populares.' : 'DR muito baixo remove a dinâmica natural e pode causar fadiga.'}`,
                solution: (s) => `${s.direction === 'reduce' ? 'Aplique compressão paralela no bus de drums e ajuste o limiter para reduzir' : 'Reduza a compressão geral e use técnicas de expansão para aumentar'} ~${Math.abs(s.delta).toFixed(1)} dB de DR. ${s.direction === 'reduce' ? 'Busque quedas de 1-2 dB no GR médio.' : 'Preserve os transientes naturais.'}`
            },
            lra: {
                title: (s) => `LRA ${s.direction === 'reduce' ? 'muito amplo' : 'muito estreito'} (${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)} ${s.unit})`,
                explanation: (s) => `Sua faixa tem LRA=${s.measured.toFixed(1)} LU, enquanto o ideal é ${s.target.toFixed(1)} ± ${s.tolerance.toFixed(1)} LU. ${s.direction === 'reduce' ? 'LRA muito amplo pode causar inconsistência entre seções.' : 'LRA muito estreito pode tornar a música monótona.'}`,
                solution: (s) => `${s.direction === 'reduce' ? 'Aplique compressão suave nas seções mais dinâmicas ou use automação de gain' : 'Crie mais variação dinâmica entre verso/refrão ou reduza compressão excessiva'} para ${s.direction === 'reduce' ? 'reduzir' : 'aumentar'} ~${Math.abs(s.delta).toFixed(1)} LU.`
            },
            stereo: {
                title: (s) => `Stereo ${s.direction === 'reduce' ? 'muito amplo' : 'muito estreito'} (${s.delta > 0 ? '+' : ''}${s.delta.toFixed(2)})`,
                explanation: (s) => `Sua correlação estéreo é ${s.measured.toFixed(2)}, enquanto o ideal para ${this.getGenreName(s)} é ${s.target.toFixed(2)} ± ${s.tolerance.toFixed(2)}. ${s.direction === 'reduce' ? 'Excesso de width pode causar problemas em mono e sistemas pequenos.' : 'Imagem muito estreita reduz a espacialidade.'}`,
                solution: (s) => `${s.direction === 'reduce' ? 'Reduza efeitos de width, mantenha graves em mono e diminua reverbs muito abertos' : 'Aumente a separação estéreo com panning, delays e reverbs espaciais'}. Sempre teste em mono para garantir compatibilidade.`
            },
            vol_consistency: {
                title: (s) => `Consistência de volume ${s.direction === 'reduce' ? 'muito variável' : 'muito constante'} (${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)} ${s.unit})`,
                explanation: (s) => `Sua variação de volume é ${s.measured.toFixed(1)} LU, enquanto o ideal é ${s.target.toFixed(1)} ± ${s.tolerance.toFixed(1)} LU. ${s.direction === 'reduce' ? 'Muita variação pode cansar o ouvinte.' : 'Pouca variação pode soar monótono.'}`,
                solution: (s) => `${s.direction === 'reduce' ? 'Use automação ou compressão multibanda para nivelar' : 'Crie mais dinâmica entre seções'} ~${Math.abs(s.delta).toFixed(1)} LU de variação.`
            }
        };
        
        this.bandTemplates = {
            sub: { name: 'Sub Bass', impact: 'fundação e poder' },
            bass: { name: 'Bass', impact: 'groove e energia' },
            low_mid: { name: 'Low Mid', impact: 'clareza e definição' },
            mid: { name: 'Mid', impact: 'presença vocal' },
            high_mid: { name: 'High Mid', impact: 'brilho e articulação' },
            presence: { name: 'Presence', impact: 'presença e definição' },
            air: { name: 'Air', impact: 'espacialidade e brilho' }
        };
    }

    /**
     * 📝 Gerar texto educativo completo CORRIGIDO
     */
    generateText(suggestion) {
        if (suggestion.metric.startsWith('band:')) {
            return this.generateBandText(suggestion);
        }
        
        const template = this.templates[suggestion.metric];
        if (!template) {
            return {
                ...suggestion,
                title: `${suggestion.metric} fora do ideal`,
                explanation: `Valor medido: ${suggestion.measured}, alvo: ${suggestion.target}`,
                solution: `Ajustar para aproximar do alvo.`
            };
        }
        
        return {
            ...suggestion,
            title: template.title(suggestion),
            explanation: template.explanation(suggestion),
            solution: template.solution(suggestion)
        };
    }

    /**
     * 🎵 Gerar texto para bandas espectrais
     */
    generateBandText(suggestion) {
        const bandInfo = this.bandTemplates[suggestion.bandName] || { name: suggestion.bandName, impact: 'balanço espectral' };
        
        return {
            ...suggestion,
            title: `${bandInfo.name} ${suggestion.direction === 'reduce' ? 'excessivo' : 'insuficiente'} (${suggestion.delta > 0 ? '+' : ''}${suggestion.delta.toFixed(1)} dB)`,
            explanation: `Esta banda tem ${suggestion.measured.toFixed(1)} dB, enquanto o ideal é ${suggestion.target.toFixed(1)} ± ${suggestion.tolerance.toFixed(1)} dB. Afeta diretamente ${bandInfo.impact} da sua música.`,
            solution: `${suggestion.direction === 'reduce' ? 'Atenuar' : 'Realçar'} ~${Math.abs(suggestion.delta).toFixed(1)} dB usando EQ na região correspondente. ${this.getBandAdvice(suggestion.bandName, suggestion.direction)}`
        };
    }

    /**
     * 🎛️ Conselhos específicos por banda
     */
    getBandAdvice(bandName, direction) {
        const advice = {
            sub: direction === 'reduce' ? 'Use HPF suave <25 Hz, mantenha sub mono.' : 'Reforce com shelf ou boost centrado em 40-50 Hz.',
            bass: direction === 'reduce' ? 'Atenue com EQ bell em 100-150 Hz, use sidechain.' : 'Reforce punch do kick em 80-120 Hz.',
            low_mid: direction === 'reduce' ? 'Corte mud em 200-400 Hz para mais clareza.' : 'Adicione warmth em 300-500 Hz com cuidado.',
            mid: direction === 'reduce' ? 'Suavize harshness em 1-2 kHz.' : 'Realce presença vocal em 1-3 kHz.',
            high_mid: direction === 'reduce' ? 'Reduza agressividade em 3-5 kHz.' : 'Adicione brilho e definição em 3-6 kHz.',
            presence: direction === 'reduce' ? 'Suavize sibilância em 5-8 kHz.' : 'Realce presença e articulação em 4-7 kHz.',
            air: direction === 'reduce' ? 'Controle harshness acima de 8 kHz.' : 'Adicione shelving suave acima de 10 kHz.'
        };
        
        return advice[bandName] || 'Ajuste com EQ específico para a região.';
    }

    /**
     * 🏷️ Nome amigável do gênero
     */
    getGenreName(suggestion) {
        const genreNames = {
            'funk_mandela': 'Funk Mandela',
            'trance': 'Trance',
            'eletrônico': 'Eletrônico',
            'pop': 'Pop',
            'rock': 'Rock'
        };
        
        return genreNames[suggestion.genre] || suggestion.genre;
    }
}

/**
 * 🎯 SISTEMA PRINCIPAL UNIFICADO
 */
class SuggestionSystemUnified {
    constructor() {
        this.engine = new SuggestionEngineUnified();
        log('🎯 Sistema Unificado de Sugestões carregado (versão corrigida)');
    }

    /**
     * 🚀 Processar análise (método principal)
     */
    process(analysis, referenceData) {
        return this.engine.process(analysis, referenceData);
    }
}

// 🌍 Exposição global
if (typeof window !== 'undefined') {
    window.SuggestionSystemUnified = SuggestionSystemUnified;
    window.suggestionSystem = new SuggestionSystemUnified();
    log('✅ Sistema Unificado disponível globalmente');
    
    // ⚡ DISPARAR EVENTO DE PRONTIDÃO (event-driven)
    setTimeout(() => {
        window.dispatchEvent(new Event('soundy:suggestionSystemReady'));
        log('📢 [SUGGESTION] Evento soundy:suggestionSystemReady disparado');
    }, 0);
}