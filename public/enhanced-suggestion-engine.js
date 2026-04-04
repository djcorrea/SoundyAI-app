// 🎯 SISTEMA PRINCIPAL DE SUGESTÕES MELHORADO
// Integra scoring, heurísticas e referências em um sistema unificado

const SUG_PRIORITY = {
  // 🔴 CRÍTICOS (aparecem primeiro com banner PRIORITÁRIO)
  'reference_true_peak': 1,
  'true_peak': 1,
  'dbtp': 1,
  'tp': 1,
  
  // 🟠 PRINCIPAIS (métricas de referência)
  'reference_loudness': 2,
  'lufs': 2,
  'loudness': 2,
  
  'reference_dynamics': 3,
  'dr': 3,
  'dynamics': 3,
  'dynamic_range': 3,
  
  'reference_lra': 4,
  'lra': 4,
  'loudness_range': 4,
  
  'reference_stereo': 5,
  'stereo': 5,
  'stereo_width': 5,
  'stereo_correlation': 5,
  
  // 🟡 BANDAS ESPECTRAIS (frequências)
  'band_adjust': 6,
  'frequency': 6,
  'spectral': 6,
  
  // 🟢 HEURÍSTICAS (últimas)
  'heuristic_low_end': 7,
  'heuristic_high_end': 7,
  'heuristic_mid_clarity': 7,
  'heuristic_punch': 7,
  'heuristic_air': 7,
  'heuristic': 7
};

function normalizeKey(k) {
  const s = k.toLowerCase().replace(/[_-]/g, '');
  
  // True Peak (PRIORITÁRIO)
  if (['tp','truepeak','dbtp','referencetruepeak'].includes(s)) return 'reference_true_peak';
  
  // Loudness (LUFS)
  if (['lufs','lufus','loudness','integratedlufs','referenceloudness'].includes(s)) return 'reference_loudness';
  
  // Dynamics (DR)
  if (['dr','dynamics','dynamicrange','referencedynamics'].includes(s)) return 'reference_dynamics';
  
  // LRA
  if (['lra','loudnessrange','referencelra'].includes(s)) return 'reference_lra';
  
  // Stereo
  if (['stereo','stereowidth','stereocorrelation','referencestereo'].includes(s)) return 'reference_stereo';
  
  // Bandas espectrais
  if (['bandadjust','band','frequency','spectral'].includes(s)) return 'band_adjust';
  
  // Heurísticas
  if (s.startsWith('heuristic')) return 'heuristic';
  
  return k;
}

class EnhancedSuggestionEngine {
    constructor(config = {}) {
        this.scorer = window.suggestionScorer || new SuggestionScorer();
        
        // 🎯 CORREÇÃO: Inicializar AdvancedHeuristicsAnalyzer se não estiver disponível
        this.heuristics = window.heuristicsAnalyzer || this.createInlineHeuristicsAnalyzer();
        
        // 📊 Log de auditoria para debugging
        this.auditLog = [];
        
        // 🎛️ Configurações
        this.config = {
            maxSuggestions: 20,        // Máximo de sugestões por análise (aumentado para incluir bandas espectrais)
            minPriority: 0.05,         // Prioridade mínima para incluir sugestão (reduzida para aceitar bandas)
            groupByTheme: true,        // Agrupar sugestões por tema
            includeYellowSeverity: true, // Incluir severidade "amarela" (monitorar)
            enableHeuristics: true,    // Habilitar análise heurística
            enableDependencies: true   // Habilitar regras de dependência
        };
        
        // 🎓 Templates educativos para enriquecimento de sugestões
        this.heuristicTemplates = this.createEducationalTemplates();
    }
    
    /**
     * 🎓 Criar templates educativos para enriquecimento de sugestões
     * Como um professor de produção musical explicando problemas e soluções
     */
    createEducationalTemplates() {
        return {
            // === MÉTRICAS DE LOUDNESS ===
            lufs_too_low: {
                explanation: "Sua faixa está muito abaixo do nível ideal de loudness. Isso reduz o impacto e competitividade da música, especialmente em plataformas de streaming.",
                action: "Use um limiter ou compressor no master e ajuste o ganho até atingir o nível alvo do gênero (confira os targets da análise técnica).",
                dawExample: "Monitore com LUFS Meter no insert final. No Pro Tools: AudioSuite > Loudness Analyzer. No Logic: Multipressor + Adaptive Limiter."
            },
            lufs_too_high: {
                explanation: "Sua faixa está com loudness excessivo, causando fadiga auditiva e possível distorção. Plataformas como Spotify vão reduzir o volume automaticamente.",
                action: "Reduza o ganho do limiter ou compressor principal até atingir o nível alvo do gênero (confira os targets da análise técnica).",
                dawExample: "No master bus: reduza Output Gain do limiter em 2-4 dB. Ableton: reduzir o Gain do Limiter. Cubase: reduzir Output no Maximizer."
            },
            
            // === TRUE PEAK ===
            true_peak_high: {
                explanation: "True Peak alto pode causar distorção digital em conversores D/A e problemas de inter-sample peaks, especialmente em sistemas de reprodução consumer.",
                action: "Use um limiter com oversampling ou true peak limiting para manter abaixo de -1 dBTP.",
                dawExample: "Pro Tools: Pro Limiter com 'ISP' ativado. Logic: Adaptive Limiter com 'True Peak Detection'. Waves: L3 Multimaximizer.",
                priority: "CRÍTICO: Corrija o True Peak PRIMEIRO antes de ajustar outras métricas, pois alterações no limiter podem afetar significativamente o balanço espectral e invalidar outros ajustes de EQ/compressão.",
                warningMessage: "⚠️ ATENÇÃO: True Peak deve ser corrigido antes de outros ajustes, pois pode interferir nas bandas espectrais!"
            },
            
            // === DYNAMIC RANGE ===
            dr_low: {
                explanation: "Dynamic Range muito baixo indica que sua música está over-comprimida, perdendo dinâmica natural e groove.",
                action: "Reduza compressão geral, use compressão paralela, e preserve transientes até atingir o DR alvo do gênero (confira os targets da análise técnica).",
                dawExample: "Reduzir ratio do compressor master. Crear bus paralelo com compressor pesado (10:1) e misturar sutilmente (20-30%)."
            },
            dr_high: {
                explanation: "Dynamic Range excessivo pode indicar falta de coesão e consistência, dificultando playback em sistemas variados.",
                action: "Use compressão suave para unificar a dinâmica, mantendo a musicalidade. Ajuste até o DR alvo do gênero (confira os targets da análise técnica).",
                dawExample: "Compressor suave no master: 2:1 ratio, attack médio (10ms), release auto. Leveling para equilibrar seções."
            },
            lra_too_low: {
                explanation: "Range dinâmico muito baixo indica over-compression, resultando em fadiga auditiva e perda do groove natural da música.",
                action: "Reduza a quantidade de compressão, especialmente no master bus. Use compressão paralela para manter dinâmica.",
                dawExample: "Reduzir Ratio do compressor master de 4:1 para 2:1. Criar send para compressor pesado e misturar subtilmente."
            },
            lra_too_high: {
                explanation: "Range dinâmico excessivo pode tornar a música inconsistente em diferentes sistemas de reprodução, com partes muito baixas ou altas.",
                action: "Use compressão suave para controlar os picos e leveling para equilibrar as seções.",
                dawExample: "Compressor multibanda no master: attack lento (30ms), release médio (300ms), ratio 3:1 apenas nos picos."
            },
            
            // === PROBLEMAS ESPECTRAIS ===
            sibilance: {
                explanation: "Sibilância excessiva (sons 'sss' e 'ttt') torna a voz agressiva e desconfortável, especialmente em headphones e sistemas hi-fi.",
                action: "Use de-esser na faixa vocal ou EQ dinâmico com corte suave entre 6-9 kHz.",
                dawExample: "Pro Tools: DeEsser plugin na vocal. Logic: DeEsser2 com frequência em 7 kHz. Plugin terceiros: FabFilter Pro-DS."
            },
            harshness: {
                explanation: "Agressividade nos médios-altos (3-5 kHz) causa fadiga auditiva e torna o mix desconfortável em reprodução prolongada.",
                action: "EQ subtrativo suave nesta faixa, ou compressor multibanda apenas nos picos problemáticos.",
                dawExample: "EQ paramétrico: corte de 2-3 dB em 4 kHz com Q médio (0.8). Compressor multibanda: ratio 3:1 apenas em 3-5 kHz."
            },
            masking: {
                explanation: "Masking nos graves significa que bass e sub-bass estão competindo, criando 'lama' e perda de definição no low-end.",
                action: "Side-chain compression do bass pelo kick, ou EQ complementar (bass em 100Hz, sub em 60Hz).",
                dawExample: "Compressor no bass com key input do kick. Ou EQ: high-pass no bass em 80Hz, low-pass no sub em 120Hz."
            },
            spectral_imbalance: {
                explanation: "Desequilíbrio espectral significativo torna o mix desbalanceado, com algumas frequências dominando outras.",
                action: "EQ multibanda para equilibrar energia entre as faixas de frequência, priorizando médios e médios-agudos.",
                dawExample: "EQ multibanda no master: dividir em 4 bandas (80Hz, 800Hz, 8kHz) e equilibrar níveis relativos."
            },
            
            // === CORRELAÇÃO ESTÉREO ===
            stereo_narrow: {
                explanation: "Imagem estéreo muito estreita reduz a sensação de amplitude e impacto do mix, soando 'pequeno' em sistemas stereo.",
                action: "Use plugins de widening, delay estéreo sutil, ou reverb para aumentar a largura percebida.",
                dawExample: "Stereo widener no master (cuidado com mono compatibility). Waves S1: Width em +20%. Delay L/R com 10-15ms."
            },
            stereo_wide: {
                explanation: "Imagem estéreo excessivamente ampla pode causar problemas de compatibilidade mono e perda de foco central.",
                action: "Reduza efeitos de widening, centralize elementos importantes (vocal, kick, bass).",
                dawExample: "Mid/Side EQ: reduzir Side em frequências graves. Ozone Imager: Stereo Width em -20%. Verificar sempre em mono."
            },
            
            // === ENRIQUECIMENTO GERAL ===
            reference_comparison: {
                explanation: "Sua faixa apresenta diferenças significativas em relação às referências do gênero, o que pode afetar a competitividade comercial.",
                action: "Compare A/B com faixas de referência e ajuste gradualmente os parâmetros identificados.",
                dawExample: "Plugin de reference matching ou import de faixa de referência em nova track para comparação visual e auditiva."
            }
        };
    }

    /**
     * 🎯 CORREÇÃO: Criar instância inline do AdvancedHeuristicsAnalyzer
     * Versão expandida com templates educativos e análise de métricas reais
     */
    createInlineHeuristicsAnalyzer() {
        return {
            // Método principal compatível com a interface esperada
            analyzeAll: (analysisData) => {
                const detections = [];
                
                // 🎵 Análise de bandas espectrais (fonte principal)
                if (analysisData.spectralData && analysisData.spectralData.bands) {
                    const bands = analysisData.spectralData.bands;
                    
                    // Detectar sibilância excessiva (presença/presence)
                    const presencaKey = bands.presenca || bands.presence;
                    if (presencaKey && presencaKey.energy_db > -10) {
                        detections.push({
                            type: 'sibilance',
                            intensity: Math.min(1.0, (presencaKey.energy_db + 10) / 15),
                            confidence: 0.8,
                            frequency: 7500,
                            description: 'Sibilância excessiva detectada na faixa de presença',
                            suggestion: 'Reduzir presença (6-9 kHz) com EQ ou de-esser',
                            energyLevel: presencaKey.energy_db
                        });
                    }
                    
                    // Detectar harshness nos médios-altos
                    const midKey = bands.mid || bands.highMid;
                    if (midKey && midKey.energy_db > -8) {
                        detections.push({
                            type: 'harshness',
                            intensity: Math.min(1.0, (midKey.energy_db + 8) / 12),
                            confidence: 0.75,
                            frequency: 4000,
                            description: 'Agressividade excessiva nos médios-altos',
                            suggestion: 'Suavizar médios-altos (3-5 kHz) com EQ suave',
                            energyLevel: midKey.energy_db
                        });
                    }
                    
                    // Detectar masking/lama nos graves
                    if (bands.bass && bands.sub && 
                        bands.bass.energy_db && bands.sub.energy_db &&
                        (bands.bass.energy_db - bands.sub.energy_db) < 3) {
                        detections.push({
                            type: 'masking',
                            intensity: 0.6,
                            confidence: 0.7,
                            frequency: 150,
                            description: 'Possível masking entre sub e bass',
                            suggestion: 'Clarear graves com high-pass ou EQ notch',
                            bassLevel: bands.bass.energy_db,
                            subLevel: bands.sub.energy_db
                        });
                    }
                    
                    // Detectar desequilíbrio espectral
                    const allBands = Object.values(bands).filter(b => b && b.energy_db);
                    if (allBands.length >= 3) {
                        const energies = allBands.map(b => b.energy_db);
                        const max = Math.max(...energies);
                        const min = Math.min(...energies);
                        
                        if ((max - min) > 20) {
                            detections.push({
                                type: 'spectral_imbalance',
                                intensity: Math.min(1.0, (max - min - 20) / 15),
                                confidence: 0.6,
                                frequency: 1000,
                                description: 'Desequilíbrio espectral significativo detectado',
                                suggestion: 'Equilibrar frequências com EQ multibanda',
                                maxEnergy: max,
                                minEnergy: min,
                                difference: max - min
                            });
                        }
                    }
                }
                
                // 🔊 Análise de métricas principais (LUFS, True Peak, LRA)
                if (analysisData.analysis) {
                    const tech = analysisData.analysis.technicalData;
                    
                    // Análise LUFS
                    if (tech && Number.isFinite(tech.lufs)) {
                        if (tech.lufs < -20) {
                            detections.push({
                                type: 'heuristic_lufs',
                                intensity: Math.min(1.0, (-20 - tech.lufs) / 10),
                                confidence: 0.9,
                                frequency: 'fullband',
                                description: `LUFS muito baixo (${tech.lufs.toFixed(1)} dB)`,
                                suggestion: 'Aumentar loudness para competitividade comercial',
                                currentValue: tech.lufs,
                                targetRange: '-8 a -14 LUFS'
                            });
                        } else if (tech.lufs > -6) {
                            detections.push({
                                type: 'heuristic_lufs',
                                intensity: Math.min(1.0, (tech.lufs + 6) / 6),
                                confidence: 0.9,
                                frequency: 'fullband',
                                description: `LUFS muito alto (${tech.lufs.toFixed(1)} dB)`,
                                suggestion: 'Reduzir loudness para evitar fadiga auditiva',
                                currentValue: tech.lufs,
                                targetRange: '-8 a -14 LUFS'
                            });
                        }
                    }
                    
                    // Análise True Peak (ceiling: -1.0 dBTP, alinhado com AutoMaster V1)
                    if (tech && Number.isFinite(tech.truePeak)) {
                        if (tech.truePeak > -1.0) {
                            detections.push({
                                type: 'heuristic_true_peak',
                                intensity: Math.min(1.0, (tech.truePeak + 1.0) / 1.5),
                                confidence: 0.85,
                                frequency: 'fullband',
                                description: `True Peak alto (${tech.truePeak.toFixed(1)} dBTP)`,
                                suggestion: 'Usar limiter com true peak detection',
                                currentValue: tech.truePeak,
                                targetRange: 'abaixo de -1.0 dBTP'
                            });
                        }
                    }
                    
                    // Análise LRA (Dynamic Range)
                    if (tech && Number.isFinite(tech.lra)) {
                        if (tech.lra < 2) {
                            detections.push({
                                type: 'heuristic_lra',
                                intensity: Math.min(1.0, (2 - tech.lra) / 2),
                                confidence: 0.7,
                                frequency: 'fullband',
                                description: `Range dinâmico muito baixo (${tech.lra.toFixed(1)} LU)`,
                                suggestion: 'Reduzir compressão para preservar dinâmica',
                                currentValue: tech.lra,
                                targetRange: '4-12 LU'
                            });
                        } else if (tech.lra > 15) {
                            detections.push({
                                type: 'heuristic_lra',
                                intensity: Math.min(1.0, (tech.lra - 15) / 10),
                                confidence: 0.6,
                                frequency: 'fullband',
                                description: `Range dinâmico muito alto (${tech.lra.toFixed(1)} LU)`,
                                suggestion: 'Adicionar compressão suave para controle',
                                currentValue: tech.lra,
                                targetRange: '4-12 LU'
                            });
                        }
                    }
                }
                
                log(`🎯 [HEURISTICS] Análise inline concluída: ${detections.length} detecções`);
                return detections;
            }
        };
    }

    /**
     * 🎯 Obter ícone apropriado para métrica
     * @param {string} metricType - Tipo da métrica
     * @returns {string} Ícone apropriado
     */
    getMetricIcon(metricType) {
        const icons = {
            'lufs': '🔊',
            'true_peak': '⚡',
            'dr': '📊',
            'lra': '📈',
            'stereo': '🎧',
            'band': '🎵'
        };
        return icons[metricType] || '🎛️';
    }

    /**
     * 🔧 Normalizar dados de referência para compatibilidade universal
     * @param {Object} rawRef - Dados de referência brutos (legacy_compatibility ou hybrid_processing)
     * @returns {Object} Dados normalizados no formato padrão do motor
     */
    normalizeReferenceData(rawRef) {
        if (!rawRef || typeof rawRef !== 'object') {
            warn('🚨 Dados de referência inválidos ou ausentes');
            this.logAudit('NORMALIZE_ERROR', 'Dados de referência inválidos', { rawRef });
            return null;
        }

        // Detectar estrutura dos dados
        let sourceData = null;
        let structureType = 'unknown';

        // 🆕 NOVA ESTRUTURA: Dados diretos do backend (analysis.referenceData)
        if (rawRef.loudness !== undefined || rawRef.truePeak !== undefined || rawRef.dynamicRange !== undefined) {
            log('🎯 [NORMALIZE] Detectada estrutura backend analysis.referenceData');
            
            // Converter estrutura backend para estrutura esperada
            sourceData = {
                original_metrics: {
                    lufs_integrated: rawRef.loudness,
                    true_peak_dbtp: rawRef.truePeak,
                    dynamic_range: rawRef.dynamicRange,
                    lra: rawRef.lra,
                    stereo_correlation: rawRef.stereoCorrelation || 0.85
                },
                spectral_bands: rawRef.bands || {}
            };
            structureType = 'backend_analysis';
        }
        // 🔧 ESTRUTURA JSON ELETROFUNK: Dados diretos na raiz (lufs_target, true_peak_target, etc.)
        else if (rawRef.lufs_target !== undefined || rawRef.true_peak_target !== undefined || rawRef.dr_target !== undefined) {
            log('🎯 [NORMALIZE] Detectada estrutura JSON direta (eletrofunk style)');
            
            sourceData = {
                original_metrics: {
                    lufs_integrated: rawRef.lufs_target,
                    true_peak_dbtp: rawRef.true_peak_target,
                    dynamic_range: rawRef.dr_target,
                    lra: rawRef.lra_target,
                    stereo_correlation: rawRef.stereo_target || 0.85
                },
                spectral_bands: rawRef.bands || {}
            };
            structureType = 'json_direct';
        }
        // Tentar legacy_compatibility primeiro
        else if (rawRef.legacy_compatibility && typeof rawRef.legacy_compatibility === 'object') {
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
                // 🔧 Se tem dados diretos na estrutura do gênero, processar
                else if (sourceData.lufs_target !== undefined || sourceData.true_peak_target !== undefined) {
                    log('🎯 [NORMALIZE] Detectada estrutura JSON dentro do gênero');
                    // Manter sourceData como está, mas criar original_metrics se não existir
                    if (!sourceData.original_metrics) {
                        sourceData.original_metrics = {
                            lufs_integrated: sourceData.lufs_target,
                            true_peak_dbtp: sourceData.true_peak_target,
                            dynamic_range: sourceData.dr_target,
                            lra: sourceData.lra_target,
                            stereo_correlation: sourceData.stereo_target || 0.85
                        };
                    }
                    structureType = 'genre_direct_json';
                }
            }
        }

        if (!sourceData) {
            warn('🚨 Estrutura de dados de referência não reconhecida');
            this.logAudit('NORMALIZE_ERROR', 'Estrutura não reconhecida', { rawRef, keys: Object.keys(rawRef) });
            return null;
        }

        this.logAudit('NORMALIZE_START', `Normalizando dados: ${structureType}`, { structureType, sourceData });

        // Normalizar métricas principais - ORDEM CORRIGIDA das tolerâncias
        const normalized = {
            // LUFS - buscar em original_metrics primeiro, depois direto no sourceData
            lufs_target: this.extractMetric(sourceData.original_metrics || sourceData, ['lufs_target', 'lufs_ref', 'lufs_integrated'], 'lufs') ||
                        this.extractMetric(sourceData, ['lufs_target', 'lufs_ref', 'lufs_integrated'], 'lufs'),
            tol_lufs: this.extractMetric(sourceData, ['tol_lufs', 'tol_lufs_min', 'lufs_tolerance'], 'lufs_tolerance') ?? 2.0,

            // True Peak - buscar em original_metrics primeiro, depois direto no sourceData
            true_peak_target: this.extractMetric(sourceData.original_metrics || sourceData, ['true_peak_target', 'tp_ref', 'true_peak', 'true_peak_dbtp'], 'true_peak') ||
                             this.extractMetric(sourceData, ['true_peak_target', 'tp_ref', 'true_peak', 'true_peak_dbtp'], 'true_peak'),
            tol_true_peak: this.extractMetric(sourceData, ['tol_true_peak', 'tp_tolerance', 'true_peak_tolerance'], 'true_peak_tolerance') ?? 1.0,

            // Dynamic Range - buscar em original_metrics primeiro, depois direto no sourceData
            dr_target: this.extractMetric(sourceData.original_metrics || sourceData, ['dr_target', 'dr_ref', 'dynamic_range'], 'dr') ||
                      this.extractMetric(sourceData, ['dr_target', 'dr_ref', 'dynamic_range'], 'dr'),
            tol_dr: this.extractMetric(sourceData, ['tol_dr', 'dr_tolerance', 'dynamic_range_tolerance'], 'dr_tolerance') ?? 2.0,

            // Loudness Range - BUSCAR EM MÚLTIPLAS ESTRUTURAS INCLUINDO BACKEND
            lra_target: this.extractMetric(sourceData.original_metrics || sourceData, ['lra_target', 'lra_ref', 'lra'], 'lra') ||
                       this.extractMetric(sourceData, ['lra_target', 'lra_ref', 'lra'], 'lra') ||
                       this.extractMetric(sourceData.legacy_compatibility || {}, ['lra_target', 'lra_ref', 'lra'], 'lra') ||
                       this.extractMetric(sourceData.hybrid_processing?.original_metrics || {}, ['lra', 'lra_target'], 'lra'),
            tol_lra: (this.extractMetric(sourceData, ['tol_lra', 'lra_tolerance'], 'lra_tolerance') ||
                     this.extractMetric(sourceData.legacy_compatibility || {}, ['tol_lra', 'lra_tolerance'], 'lra_tolerance')) ?? 2.0,

            // Stereo Correlation - buscar em original_metrics primeiro, depois direto no sourceData
            stereo_target: this.extractMetric(sourceData.original_metrics || sourceData, ['stereo_target', 'stereo_ref', 'stereo_correlation'], 'stereo') ||
                          this.extractMetric(sourceData, ['stereo_target', 'stereo_ref', 'stereo_correlation'], 'stereo'),
            tol_stereo: this.extractMetric(sourceData, ['tol_stereo', 'correlation_tolerance', 'stereo_tolerance'], 'stereo_tolerance') ?? 0.15,

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
     * 🔍 Extrair métrica com fallbacks - VERSÃO CORRIGIDA
     * @param {Object} source - Objeto fonte
     * @param {Array} keys - Lista de chaves possíveis (em ordem de prioridade)
     * @param {string} metricName - Nome da métrica para log
     * @returns {number|null} Valor encontrado ou null
     */
    extractMetric(source, keys, metricName) {
        // 🎯 CORREÇÃO: Buscar primeiro em todas as estruturas possíveis
        const searchLocations = [
            { obj: source, prefix: '' },
            { obj: source.original_metrics || {}, prefix: 'original_metrics.' },
            { obj: source.legacy_compatibility || {}, prefix: 'legacy_compatibility.' },
            { obj: source.hybrid_processing || {}, prefix: 'hybrid_processing.' }
        ];

        for (const location of searchLocations) {
            for (const key of keys) {
                const value = location.obj[key];
                if (value !== undefined && value !== null && Number.isFinite(value)) {
                    // 🎯 CORREÇÃO: Log apropriado baseado no tipo de métrica
                    const isToleranceSearch = metricName.includes('_tolerance') || metricName.includes('tolerance');
                    const foundAlternative = key !== keys[0]; // se não encontrou a primeira opção preferida
                    
                    if (isToleranceSearch && foundAlternative) {
                        // Para tolerâncias, logar como FIX quando encontrar formato alternativo
                        log(`✅ [FIX] Métrica ${metricName} encontrada via ${location.prefix}${key}: ${value}`);
                        this.logAudit('METRIC_FOUND_FALLBACK', `${metricName}: ${value} (via ${location.prefix}${key})`, { 
                            metricName, 
                            key, 
                            value, 
                            location: location.prefix,
                            isFallback: true 
                        });
                    } else {
                        // Log normal para métricas principais
                        this.logAudit('METRIC_FOUND', `${metricName}: ${value} (via ${location.prefix}${key})`, { 
                            metricName, 
                            key, 
                            value, 
                            location: location.prefix
                        });
                    }
                    return value;
                }
            }
        }

        // 🎯 CORREÇÃO: Só logar como erro se realmente não encontrou nada
        const isToleranceSearch = metricName.includes('_tolerance') || metricName.includes('tolerance');
        if (isToleranceSearch) {
            // Para tolerâncias, não logar erro - usar default
            this.logAudit('METRIC_TOLERANCE_DEFAULT', `${metricName} não encontrada - usando valor padrão`, { 
                keys, 
                searchedLocations: searchLocations.map(l => l.prefix || 'root')
            });
        } else {
            // Para métricas principais, manter log de warning
            warn(`⚠️ Métrica não encontrada: ${metricName}`, { tentativas: keys, source: Object.keys(source) });
            this.logAudit('METRIC_MISSING', `Métrica ausente: ${metricName}`, { keys, availableKeys: Object.keys(source) });
        }
        
        return null;
    }

    /**
     * 🎯 Obter alvo padrão para métricas críticas quando não encontrado
     * @param {string} metricKey - Chave da métrica
     * @returns {number} Valor padrão
     */
    getDefaultTarget(metricKey) {
        const defaults = {
            'lufs': -14.0,
            'true_peak': -1.0,
            'dr': 8.0,
            'lra': 10.0,
            'stereo': 0.15
        };
        return defaults[metricKey] || 0;
    }

    /**
     * 🎯 Obter tolerância padrão para métricas críticas quando não encontrada
     * @param {string} metricKey - Chave da métrica
     * @returns {number} Tolerância padrão
     */
    getDefaultTolerance(metricKey) {
        const defaults = {
            'lufs': 2.0,
            'true_peak': 1.0,
            'dr': 2.0,
            'lra': 3.0,
            'stereo': 0.15
        };
        return defaults[metricKey] || 1.0;
    }

    /**
     * 🎯 Obter ação genérica para métricas críticas
     * @param {string} metricKey - Chave da métrica
     * @param {number} currentValue - Valor atual
     * @returns {string} Ação recomendada
     */
    getGenericAction(metricKey, currentValue) {
        const actions = {
            'lufs': (val) => val > -10 ? 'Reduzir loudness com compressor/limiter' : val < -20 ? 'Aumentar loudness geral' : 'Verificar loudness integrado',
            'true_peak': (val) => val > 0 ? 'CRÍTICO: Usar limiter com True Peak detection' : val > -1 ? 'Usar limiter preventivo' : 'True Peak dentro do ideal',
            'dr': (val) => val < 5 ? 'Reduzir compressão excessiva' : val > 15 ? 'Aumentar controle dinâmico' : 'Revisar dinâmica geral',
            'lra': (val) => val < 5 ? 'Preservar mais variação dinâmica' : val > 15 ? 'Controlar variações excessivas' : 'Verificar range de loudness',
            'stereo': (val) => val > 0.8 ? 'Aumentar largura estéreo' : val < -0.5 ? 'Corrigir problemas de fase' : 'Verificar imagem estéreo'
        };
        
        const actionFn = actions[metricKey];
        return actionFn ? actionFn(currentValue) : `Verificar ${metricKey}`;
    }

    /**
     * 🎨 Obter ícone para cada tipo de métrica
     * @param {string} metricType - Tipo da métrica
     * @returns {string} Ícone emoji
     */
    getMetricIcon(metricType) {
        const icons = {
            'lufs': '🔊',
            'true_peak': '⚡',
            'dr': '📊',
            'lra': '📈',
            'stereo': '🎧',
            'band': '🎵'
        };
        return icons[metricType] || '🎛️';
    }

    /**
     * 🎯 Garantir ordem determinística das sugestões
     * Prioridade: True Peak → LUFS → DR → LRA → Stereo → Bandas espectrais
     * @param {Array} suggestions - Lista de sugestões
     * @returns {Array} Sugestões ordenadas
     */
    enforceOrderedSuggestions(suggestions) {
        if (!Array.isArray(suggestions)) return [];

        return suggestions
            .map(s => ({ ...s, type: normalizeKey(s.type) }))
            .sort((a, b) => {
                const pa = SUG_PRIORITY[a.type] || 999;
                const pb = SUG_PRIORITY[b.type] || 999;
                if (pa !== pb) return pa - pb; // prioridade TP > LUFS > DR
                return (b.priority || 0) - (a.priority || 0); // severidade como desempate
            });
    }

    /**
     * 🔧 NOVO: Criar estrutura BaseSuggestion padronizada
     * @param {string} metric - Nome da métrica ('lufs', 'truePeak', 'band_sub', etc)
     * @param {string} label - Label amigável ("LUFS (Loudness)", "Sub Bass (20-60 Hz)")
     * @param {number} value - Valor medido
     * @param {number} target - Valor alvo do gênero
     * @param {Object} referenceData - Dados de referência com tolerâncias
     * @returns {Object} BaseSuggestion padronizado
     */
    createBaseSuggestion(metric, label, value, target, referenceData) {
        // Extrair tolerância e crítico
        const tolerance = referenceData[`tol_${metric}`] || referenceData.bands?.[metric]?.tolerance || 2;
        const critical = referenceData[`crit_${metric}`] || referenceData.bands?.[metric]?.critical || 5;
        
        const delta = value - target;
        const absDelta = Math.abs(delta);
        
        // Calcular severidade
        let severity = 'ok';
        if (absDelta > critical) severity = 'critical';
        else if (absDelta > tolerance) severity = 'warning';
        
        // Calcular direção (para dB negativos)
        let direction = 'ok';
        if (severity !== 'ok') {
            direction = delta > 0 ? 'high' : 'low';
        }
        
        // Construir mensagens base
        const observation = this.buildObservationMessage(label, value, target, delta, direction, severity);
        const recommendation = this.buildRecommendationMessage(label, delta, direction);
        
        // Calcular prioridade
        const priority = this.calculatePriority(severity, absDelta);
        
        return {
            id: `${metric}_${Date.now()}`,
            metric: metric,
            label: label,
            value: value,
            target: target,
            delta: delta,
            severity: severity,
            direction: direction,
            observation: observation,
            recommendation: recommendation,
            aiEnhanced: false,
            priority: priority,
            category: this.getCategoryForMetric(metric)
        };
    }

    /**
     * 🔧 NOVO: Construir mensagem de observação padronizada
     * @param {string} label - Label da métrica
     * @param {number} value - Valor medido
     * @param {number} target - Valor alvo
     * @param {number} delta - Diferença (value - target)
     * @param {string} direction - 'high', 'low' ou 'ok'
     * @param {string} severity - 'ok', 'warning' ou 'critical'
     * @returns {string} Mensagem de observação
     */
    buildObservationMessage(label, value, target, delta, direction, severity) {
        const valueStr = value.toFixed(1);
        const targetStr = target.toFixed(1);
        const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
        
        let intensifier = '';
        if (severity === 'critical') intensifier = 'muito ';
        else if (severity === 'warning') intensifier = 'levemente ';
        
        const directionText = direction === 'high' ? 'alto' : direction === 'low' ? 'baixo' : 'dentro do esperado';
        
        if (severity === 'ok') {
            return `${label} dentro do range esperado: ${valueStr} dB (alvo: ${targetStr} dB)`;
        }
        
        return `${label} ${intensifier}${directionText}: ${valueStr} dB (alvo: ${targetStr} dB, diferença: ${deltaStr} dB)`;
    }

    /**
     * 🔧 NOVO: Construir mensagem de recomendação padronizada
     * @param {string} label - Label da métrica
     * @param {number} delta - Diferença (value - target)
     * @param {string} direction - 'high', 'low' ou 'ok'
     * @returns {string} Mensagem de recomendação
     */
    buildRecommendationMessage(label, delta, direction) {
        const absDelta = Math.abs(delta);
        const adjustmentDb = Math.min(absDelta, 6).toFixed(1); // Limitar a ±6 dB por segurança
        
        if (direction === 'ok') {
            return `Mantenha os ajustes atuais em ${label}.`;
        }
        
        const actionVerb = direction === 'high' ? 'Reduza' : 'Aumente';
        return `${actionVerb} aproximadamente ${adjustmentDb} dB em ${label} com EQ suave.`;
    }

    /**
     * 🔧 NOVO: Calcular prioridade baseada em severidade e delta
     * @param {string} severity - 'ok', 'warning' ou 'critical'
     * @param {number} absDelta - Delta absoluto
     * @returns {number} Prioridade (0-1)
     */
    calculatePriority(severity, absDelta) {
        let basePriority = 0.5;
        if (severity === 'critical') basePriority = 0.9;
        else if (severity === 'warning') basePriority = 0.6;
        else basePriority = 0.3;
        
        // Ajustar pela magnitude do delta (max +0.1)
        const deltaBonus = Math.min(absDelta / 20, 0.1);
        
        return Math.min(basePriority + deltaBonus, 1.0);
    }

    /**
     * 🔧 NOVO: Obter categoria da métrica
     * @param {string} metric - Nome da métrica
     * @returns {string} Categoria
     */
    getCategoryForMetric(metric) {
        if (metric === 'lufs') return 'Loudness';
        if (metric === 'truePeak' || metric === 'true_peak') return 'Peak';
        if (metric === 'dr' || metric === 'dynamicRange') return 'Dinâmica';
        if (metric === 'lra') return 'Dinâmica';
        if (metric === 'stereo') return 'Estéreo';
        if (metric.startsWith('band_')) return 'Espectro';
        return 'Geral';
    }

    /**
     * 🎵 Normalizar bandas espectrais
     * @param {Object} source - Objeto fonte
     * @returns {Object} Bandas normalizadas
     */
    normalizeBands(source) {
        const bands = {};
        let sourceBands = null;

        log('\n🔍 [ENGINE-DEBUG] ===== INÍCIO normalizeBands() =====');
        log('[ENGINE-DEBUG] source recebido:', JSON.stringify(source, null, 2));

        // Tentar encontrar bandas em diferentes locais (incluindo estrutura backend)
        if (source.bands) {
            sourceBands = source.bands;
        } else if (source.spectral_bands) {
            sourceBands = source.spectral_bands;
        } else if (source.original_metrics && source.original_metrics.bands) {
            sourceBands = source.original_metrics.bands;
        }
        // 🆕 Suporte para estrutura backend: pode vir direto como spectral_bands
        else if (source.spectral_bands) {
            sourceBands = source.spectral_bands;
        }

        if (!sourceBands || typeof sourceBands !== 'object') {
            warn('⚠️ Bandas espectrais não encontradas');
            this.logAudit('BANDS_MISSING', 'Bandas espectrais ausentes', { source: Object.keys(source) });
            return {};
        }

        // Mapeamentos de bandas (de nomes antigos/alternativos para padronizados BRASILEIROS)
        const bandMappings = {
            // Mapeamento direto (nomes brasileiros padrão)
            'sub': 'sub',
            'bass': 'bass',
            'lowMid': 'lowMid', 
            'mid': 'mid',
            'highMid': 'highMid',
            'presenca': 'presenca',  // Manter português
            'brilho': 'brilho',     // Manter português

            // Mapeamentos específicos dos JSONs atuais
            'low_bass': 'bass',        // 60-150 Hz
            'upper_bass': 'lowMid',    // 150-300 Hz (mais adequado para lowMid)
            'low_mid': 'lowMid',       // 300-800 Hz
            'high_mid': 'highMid',     // 2-6 kHz

            // Aliases em inglês → português
            'presence': 'presenca',    // 3-6 kHz
            'air': 'brilho',          // 6-12 kHz

            // Mapeamentos adicionais
            'low': 'bass',
            'high': 'brilho',
            'brightness': 'brilho'
        };

        // Processar cada banda encontrada
        for (const [sourceBandName, bandData] of Object.entries(sourceBands)) {
            if (!bandData || typeof bandData !== 'object') continue;

            log(`\n[ENGINE-DEBUG] ===== PROCESSANDO BANDA: ${sourceBandName} =====`);
            log(`[ENGINE-DEBUG] Banda recebida do JSON: "${sourceBandName}"`);
            log('[ENGINE-DEBUG] bandData recebido:', JSON.stringify(bandData, null, 2));

            // Encontrar nome padronizado
            const standardName = bandMappings[sourceBandName] || sourceBandName;
            log(`[ENGINE-DEBUG] Banda usada pelo Engine: "${standardName}"`);
            if (sourceBandName !== standardName) {
                warn(`⚠️ [ENGINE-WARNING] Nome divergente: JSON="${sourceBandName}" Engine="${standardName}"`);
            }

            // 🎯 NOVO: Extrair target_range, target_db e tol_db
            const target_db = Number.isFinite(bandData.target_db) ? bandData.target_db : null;
            const target_range = (bandData.target_range && typeof bandData.target_range === 'object' &&
                                Number.isFinite(bandData.target_range.min) && Number.isFinite(bandData.target_range.max)) 
                                ? bandData.target_range : null;
            const tol_db = Number.isFinite(bandData.tol_db) ? bandData.tol_db : 
                          Number.isFinite(bandData.tolerance) ? bandData.tolerance :
                          Number.isFinite(bandData.toleranceDb) ? bandData.toleranceDb : 3.0; // Default

            log('[ENGINE-DEBUG] target_range.min recebido:', target_range?.min);
            log('[ENGINE-DEBUG] target_range.max recebido:', target_range?.max);
            log('[ENGINE-DEBUG] target_db recebido:', target_db);
            log('[ENGINE-DEBUG] tol_db recebido:', tol_db);

            // Aceitar banda se tem target_range OU target_db
            if (target_range !== null || target_db !== null) {
                // Se a banda já existe, manter a primeira encontrada (prioridade por ordem)
                if (!bands[standardName]) {
                    bands[standardName] = {
                        target_db,
                        target_range,
                        tol_db
                    };

                    this.logAudit('BAND_MAPPED', `Banda mapeada: ${sourceBandName} → ${standardName}`, {
                        sourceName: sourceBandName,
                        standardName,
                        target_db,
                        target_range,
                        tol_db,
                        hasRange: !!target_range,
                        hasFixed: !!target_db
                    });
                } else {
                    this.logAudit('BAND_SKIPPED', `Banda duplicada ignorada: ${sourceBandName} → ${standardName}`, {
                        sourceName: sourceBandName,
                        standardName,
                        existing: bands[standardName],
                        skipped: { target_db, target_range, tol_db }
                    });
                }
            } else {
                warn(`⚠️ Banda sem target_db nem target_range válidos: ${sourceBandName}`);
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
                warn('🚨 Falha na normalização dos dados de referência - continuando sem sugestões');
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
            
            this.logAudit('METRICS_EXTRACTED_SUMMARY', 'Métricas extraídas para sugestões', {
                metricsCount: Object.keys(metrics).length,
                metricsFound: Object.keys(metrics),
                mainMetrics: {
                    lufs: metrics.lufs,
                    true_peak: metrics.true_peak,
                    dr: metrics.dr,
                    lra: metrics.lra,
                    stereo: metrics.stereo
                },
                bandsFound: Object.keys(metrics).filter(k => !['lufs', 'true_peak', 'dr', 'lra', 'stereo'].includes(k)),
                zScoresGenerated: Object.keys(zScores).length
            });
            
            // 🎖️ Calcular confiança baseada na qualidade da análise
            const confidence = this.scorer.calculateConfidence(this.extractQualityMetrics(analysis));
            
            // 🔗 Calcular bônus de dependência
            const dependencyBonuses = this.scorer.calculateDependencyBonus(zScores);
            
            // 🎯 Gerar sugestões baseadas em referência
            this.logAudit('BEFORE_GENERATE_REFERENCE', 'Chamando generateReferenceSuggestions', {
                metricsCount: Object.keys(metrics).length,
                metricsKeys: Object.keys(metrics),
                hasNormalizedRef: !!normalizedRef,
                normalizedRefKeys: normalizedRef ? Object.keys(normalizedRef) : null
            });
            
            const referenceSuggestions = this.generateReferenceSuggestions(
                metrics, normalizedRef, zScores, confidence, dependencyBonuses
            );
            
            this.logAudit('AFTER_GENERATE_REFERENCE', 'generateReferenceSuggestions concluído', {
                suggestionsCount: referenceSuggestions?.length || 0
            });
            
            this.logAudit('REFERENCE_SUGGESTIONS_GENERATED', 'Sugestões de referência geradas', {
                count: referenceSuggestions?.length || 0,
                hasMetrics: Object.keys(metrics).length > 0,
                hasZScores: Object.keys(zScores).length > 0,
                confidence: confidence
            });
            
            // 🎵 Gerar sugestões heurísticas (se habilitado)
            let heuristicSuggestions = [];
            if (this.config.enableHeuristics) {
                heuristicSuggestions = this.generateHeuristicSuggestions(
                    analysis, confidence
                );
            }
            
            this.logAudit('HEURISTIC_SUGGESTIONS_GENERATED', 'Sugestões heurísticas geradas', {
                enabled: this.config.enableHeuristics,
                count: heuristicSuggestions?.length || 0
            });
            
            // 🔄 Combinar, deduplicar e ordenar sugestões
            let allSuggestions = [...referenceSuggestions, ...heuristicSuggestions];
            allSuggestions = this.scorer.deduplicateSuggestions(allSuggestions);
            
            // 🎯 ORDEM DETERMINÍSTICA: Garantir que métricas críticas apareçam sempre na mesma ordem
            allSuggestions = this.enforceOrderedSuggestions(allSuggestions);
            
            allSuggestions = this.filterAndSort(allSuggestions);
            
            // 🎓 Aplicar enriquecimento educativo universal a TODAS as sugestões
            allSuggestions = this.applyUniversalEducationalEnrichment(allSuggestions);
            
            this.logAudit('SUGGESTIONS_FINAL_PROCESSING', 'Processamento final das sugestões', {
                totalBeforeDedup: referenceSuggestions.length + heuristicSuggestions.length,
                afterDedup: allSuggestions?.length || 0,
                finalCount: allSuggestions?.length || 0,
                enrichedCount: allSuggestions.filter(s => s.context || s.cause || s.solution || s.dawTip).length
            });
            
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
            
            // 🎯 NOVO: Garantir que diagnostics.suggestions está populado
            if (!result.diagnostics) {
                result.diagnostics = {};
            }
            
            // Transferir sugestões para diagnostics.suggestions
            result.diagnostics.suggestions = allSuggestions.map(suggestion => ({
                ...suggestion,
                // Garantir que todos os campos obrigatórios estão presentes
                icon: suggestion.icon || '🎛️',
                targetValue: suggestion.targetValue || null,
                currentValue: suggestion.currentValue || null,
                message: suggestion.message || 'Sugestão de melhoria',
                action: suggestion.action || 'Aplicar ajuste',
                why: suggestion.why || suggestion.justification || 'Otimização recomendada',
                source: 'enhanced_suggestion_engine'
            }));
            
            this.logAudit('DIAGNOSTICS_POPULATED', 'diagnostics.suggestions populado', {
                suggestionsCount: result.diagnostics.suggestions.length,
                lraCount: result.diagnostics.suggestions.filter(s => s.type?.includes('lra')).length,
                bandsCount: result.diagnostics.suggestions.filter(s => s.type === 'band_adjust' || s.type === 'reference_band_comparison').length
            });
            
            this.logAudit('PROCESSING_COMPLETE', `Processamento concluído em ${result.enhancedMetrics.processingTimeMs}ms`, {
                totalSuggestions: allSuggestions.length,
                referenceSuggestions: referenceSuggestions.length,
                heuristicSuggestions: heuristicSuggestions.length,
                avgPriority: allSuggestions.length > 0 ? 
                    (allSuggestions.reduce((sum, s) => sum + s.priority, 0) / allSuggestions.length).toFixed(3) : 0
            });
            
            // 🚨 RESULTADO FINAL - LOG CRÍTICO PARA DEBUG
            this.logAudit('FINAL_RESULT', '🎯 RESULTADO FINAL DO PROCESSAMENTO', {
                success: true,
                suggestionsReturned: result.suggestions?.length || 0,
                metricsProcessed: Object.keys(metrics).length,
                hasGroupedSuggestions: !!result.groupedSuggestions,
                topSuggestions: (result.suggestions || []).slice(0, 3).map(s => ({
                    category: s.category,
                    priority: s.priority,
                    description: s.description
                }))
            });
            
            return result;
            
        } catch (error) {
            error('🚨 Erro no processamento de sugestões:', error);
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
     * 📊 Extrair métricas relevantes da análise - VERSÃO CORRIGIDA PARA ESTRUTURA REAL
     * @param {Object} analysis - Análise de áudio
     * @param {Object} referenceData - Dados de referência
     * @returns {Object} Métricas extraídas
     */
    extractMetrics(analysis, referenceData) {
        // CORRIGIDO: Usar estrutura REAL do backend
        const tech = analysis.technicalData || {};
        const loudness = analysis.loudness || {};
        const truePeak = analysis.truePeak || {};
        const dynamics = analysis.dynamics || {};
        const bands = analysis.technicalData?.spectralBands || analysis.technicalData?.bands || {};
        
        const metrics = {};
        
        // 🔍 AUDITORIA: Log da estrutura de entrada para debugging
        this.logAudit('EXTRACT_METRICS_INPUT', 'Estrutura de análise recebida', {
            hasTechnicalData: !!tech,
            technicalDataKeys: Object.keys(tech),
            hasLoudness: !!loudness,
            loudnessKeys: Object.keys(loudness),
            hasTruePeak: !!truePeak,
            truePeakKeys: Object.keys(truePeak),
            hasDynamics: !!dynamics,
            dynamicsKeys: Object.keys(dynamics),
            hasBands: !!bands,
            bandKeys: Object.keys(bands)
        });

        // Métricas principais com estrutura real do backend
        // LUFS - priorizar loudness.integrated
        const lufsValue = loudness.integrated || tech.lufsIntegrated || tech.lufs_integrated || tech.lufs;
        if (Number.isFinite(lufsValue)) {
            metrics.lufs = lufsValue;
            this.logAudit('METRIC_EXTRACTED', 'LUFS extraído', { value: lufsValue, source: 'loudness.integrated' });
        }

        // True Peak - priorizar truePeak.maxDbtp
        const truePeakValue = truePeak.maxDbtp || tech.truePeakDbtp || tech.true_peak_dbtp || tech.truePeak;
        log('🔍 [TRUE-PEAK-EXTRACT] Tentando extrair True Peak:', {
            'truePeak.maxDbtp': truePeak.maxDbtp,
            'tech.truePeakDbtp': tech.truePeakDbtp,
            'tech.true_peak_dbtp': tech.true_peak_dbtp,
            'tech.truePeak': tech.truePeak,
            resultValue: truePeakValue,
            isFinite: Number.isFinite(truePeakValue)
        });
        
        if (Number.isFinite(truePeakValue)) {
            metrics.true_peak = truePeakValue;
            log('✅ [TRUE-PEAK-EXTRACTED] True Peak extraído com sucesso:', truePeakValue);
            this.logAudit('METRIC_EXTRACTED', 'True Peak extraído', { value: truePeakValue, source: 'truePeak.maxDbtp' });
        } else {
            warn('❌ [TRUE-PEAK-MISSING] True Peak NÃO extraído - valor inválido ou ausente');
        }

        // Dynamic Range - priorizar dynamics.range
        const drValue = dynamics.range || tech.dynamicRange || tech.dynamic_range || tech.dr;
        if (Number.isFinite(drValue)) {
            metrics.dr = drValue;
            this.logAudit('METRIC_EXTRACTED', 'DR extraído', { value: drValue, source: 'dynamics.range' });
        }

        // LRA - priorizar loudness.lra
        const lraValue = loudness.lra || tech.lra || tech.loudnessRange || tech.loudness_range;
        log('🔍 [LRA-EXTRACT] Tentando extrair LRA:', {
            'loudness.lra': loudness.lra,
            'tech.lra': tech.lra,
            'tech.loudnessRange': tech.loudnessRange,
            'tech.loudness_range': tech.loudness_range,
            resultValue: lraValue,
            isFinite: Number.isFinite(lraValue)
        });
        
        if (Number.isFinite(lraValue)) {
            metrics.lra = lraValue;
            log('✅ [LRA-EXTRACTED] LRA extraído com sucesso:', lraValue);
            this.logAudit('METRIC_EXTRACTED', 'LRA extraído com sucesso', { value: lraValue });
        } else {
            warn('❌ [LRA-MISSING] LRA NÃO extraído - valor inválido ou ausente');
            this.logAudit('METRIC_MISSING', 'LRA não encontrado em nenhuma estrutura', { 
                checked: ['loudness.lra', 'tech.lra', 'tech.loudnessRange', 'tech.loudness_range'],
                availableKeys: Object.keys(tech),
                hasLoudnessData: !!loudness
            });
        }

        // Stereo Correlation - buscar em technicalData
        const stereoValue = tech.stereoCorrelation || tech.stereo_correlation || tech.stereo;
        if (Number.isFinite(stereoValue)) {
            metrics.stereo = stereoValue;
            this.logAudit('METRIC_EXTRACTED', 'Stereo extraído', { value: stereoValue, source: 'stereoCorrelation' });
        }
        
        // Bandas espectrais - priorizar technicalData.spectralBands
        let bandEnergies = {};
        
        // 1. Buscar em technicalData com múltiplos aliases para estrutura real
        const bandSources = [
            tech.bandEnergies, 
            tech.band_energies, 
            tech.spectralBands, 
            tech.spectral_bands, 
            tech.spectral_balance,
            bands  // bands já extraído de technicalData
        ];
        
        // 3. Buscar diretamente em analysis
        bandSources.push(
            analysis.bandEnergies,
            analysis.spectral_balance,
            analysis.bands
        );
        
        // Encontrar primeira fonte válida
        for (const source of bandSources) {
            if (source && typeof source === 'object' && Object.keys(source).length > 0) {
                bandEnergies = source;
                break;
            }
        }
        
        this.logAudit('BAND_ENERGIES_DEBUG', 'Debug extração de bandas', {
            foundSource: Object.keys(bandEnergies).length > 0,
            bandEnergiesKeys: Object.keys(bandEnergies),
            sourcesChecked: bandSources.length,
            availableTechKeys: Object.keys(tech)
        });
        
        // Mapeamento bidirecional: entrada → saída normalizada
        const bandMappings = {
            // Nomes padrão (manter)
            'sub': 'sub',
            'bass': 'bass', 
            'lowMid': 'lowMid',
            'mid': 'mid',
            'highMid': 'highMid',
            'presenca': 'presenca',  // Manter brasileiro
            'brilho': 'brilho',     // Manter brasileiro
            
            // Aliases atuais → nomes brasileiros
            'low_bass': 'bass',
            'upper_bass': 'lowMid', 
            'low_mid': 'lowMid',
            'high_mid': 'highMid',
            'presence': 'presenca',  // EN → PT
            'air': 'brilho',        // EN → PT
            
            // Aliases adicionais
            'low': 'bass',
            'high': 'brilho',
            'brightness': 'brilho'
        };

        this.logAudit('BANDS_INPUT', 'Bandas disponíveis para extração', {
            inputBands: Object.keys(bandEnergies),
            mappingsAvailable: Object.keys(bandMappings)
        });

        for (const [sourceBand, data] of Object.entries(bandEnergies)) {
            log(`\n[ENGINE-DEBUG] ===== extractMetrics: BANDA ${sourceBand} =====`);
            log(`[ENGINE-DEBUG] Banda original: "${sourceBand}"`);
            
            // Encontrar nome normalizado
            const normalizedBandName = bandMappings[sourceBand] || sourceBand;
            log(`[ENGINE-DEBUG] Banda normalizada: "${normalizedBandName}"`);
            if (sourceBand !== normalizedBandName) {
                warn(`⚠️ [ENGINE-WARNING] extractMetrics: Nome divergente: JSON="${sourceBand}" Engine="${normalizedBandName}"`);
            }
            
            // 🎯 PATCH 2: Extrair target_range.min/max do referenceData para bandas
            // Buscar target_range em referenceData.spectral_bands[normalizedBandName]
            const refBandData = referenceData?.spectral_bands?.[normalizedBandName];
            log('[ENGINE-DEBUG] refBandData encontrado:', JSON.stringify(refBandData, null, 2));
            if (refBandData?.target_range) {
                log('[ENGINE-DEBUG] 🎯 PATCH 2: Injetando target_range');
                log('[ENGINE-DEBUG] target_range.min injetado:', refBandData.target_range.min);
                log('[ENGINE-DEBUG] target_range.max injetado:', refBandData.target_range.max);
                // Injetar min/max no data para uso posterior
                if (typeof data === 'object') {
                    data.targetMin = refBandData.target_range.min;
                    data.targetMax = refBandData.target_range.max;
                    data.hasTargetRange = true;
                    log('[ENGINE-DEBUG] ✅ target_range injetado com sucesso em data');
                }
            } else {
                warn('⚠️ [ENGINE-WARNING] refBandData.target_range NÃO encontrado!');
            }
            
            let rmsValue;
            
            // Verificar se é um número direto ou objeto
            if (Number.isFinite(data)) {
                // Valor direto (ex: spectral_balance: { sub: -24.1 })
                rmsValue = data;
            } else if (data && typeof data === 'object') {
                // Objeto com propriedades (ex: bandEnergies: { sub: { rms_db: -24.1 } })
                rmsValue = data.rms_db || data.rmsDb || data.rms || data.energy_db || data.energyDb || data.value;
            }
            
            if (Number.isFinite(rmsValue)) {
                // Se a banda já existe, manter a primeira encontrada (prioridade)
                if (!metrics[normalizedBandName]) {
                    metrics[normalizedBandName] = rmsValue;
                    
                    this.logAudit('BAND_METRIC_EXTRACTED', `Banda extraída: ${sourceBand} → ${normalizedBandName}`, {
                        source: sourceBand,
                        normalized: normalizedBandName,
                        value: rmsValue,
                        originalData: data,
                        dataType: Number.isFinite(data) ? 'direct_number' : 'object'
                    });
                } else {
                    this.logAudit('BAND_METRIC_SKIPPED', `Banda duplicada ignorada: ${sourceBand}`, {
                        source: sourceBand,
                        normalized: normalizedBandName,
                        existing: metrics[normalizedBandName],
                        skipped: rmsValue
                    });
                }
            } else {
                this.logAudit('BAND_METRIC_INVALID', `Valor inválido para banda: ${sourceBand}`, {
                    source: sourceBand,
                    data: data,
                    rmsValue: rmsValue
                });
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
        // 🔍 AUDITORIA: Log das métricas recebidas para geração de sugestões
        log('🎯 [TRUE-PEAK-CHECK] Métricas recebidas:', {
            hasTrue_peak: 'true_peak' in metrics,
            truePeakValue: metrics.true_peak,
            hasTruePeak: 'truePeak' in metrics,
            truePeakValue2: metrics.truePeak,
            allKeys: Object.keys(metrics)
        });
        
        this.logAudit('GENERATE_SUGGESTIONS_INPUT', 'Métricas recebidas para geração de sugestões', {
            metricsCount: Object.keys(metrics).length,
            metricsKeys: Object.keys(metrics),
            referenceDataKeys: referenceData ? Object.keys(referenceData) : null,
            hasLRA: 'lra' in metrics,
            hasBands: Object.keys(metrics).filter(k => ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presenca', 'brilho'].includes(k)).length > 0
        });
        
        // 🎯 CORREÇÃO: Usar let em vez de const para suggestions que será reatribuído
        let suggestions = [];
        
        if (!referenceData) return suggestions;
        
        // 🎯 GARANTIA DE MÉTRICAS CRÍTICAS: Definir métricas obrigatórias que SEMPRE devem ter sugestões
        const criticalMetrics = ['lufs', 'true_peak', 'dr', 'lra', 'stereo'];
        
        // Sugestões para métricas principais
        const mainMetrics = [
            { 
                key: 'lufs', 
                target: 'lufs_target', 
                tol: 'tol_lufs', 
                type: 'reference_loudness',
                metricType: 'lufs',
                unit: '',
                label: 'LUFS',
                isCritical: true
            },
            { 
                key: 'true_peak', 
                target: 'true_peak_target', 
                tol: 'tol_true_peak',
                type: 'reference_true_peak',
                metricType: 'true_peak', 
                unit: ' dBTP',
                label: 'True Peak',
                isCritical: true
            },
            { 
                key: 'dr', 
                target: 'dr_target', 
                tol: 'tol_dr',
                type: 'reference_dynamics',
                metricType: 'dr',
                unit: ' dB',
                label: 'DR',
                isCritical: true
            },
            { 
                key: 'lra', 
                target: 'lra_target', 
                tol: 'tol_lra',
                type: 'reference_lra',
                metricType: 'lra',
                unit: ' LU',
                label: 'LRA',
                isCritical: true
            },
            { 
                key: 'stereo', 
                target: 'stereo_target', 
                tol: 'tol_stereo',
                type: 'reference_stereo',
                metricType: 'stereo',
                unit: '',
                label: 'Stereo Corr',
                isCritical: true
            }
        ];
        
        for (const metric of mainMetrics) {
            const value = metrics[metric.key];
            const target = referenceData[metric.target];
            const tolerance = referenceData[metric.tol];
            
            // 🔍 LOG CRÍTICO para True Peak
            if (metric.key === 'true_peak') {
                log('🎯 [TRUE-PEAK-LOOP] Processando True Peak:', {
                    hasValue: value !== undefined,
                    value: value,
                    hasTarget: target !== undefined,
                    target: target,
                    hasTolerance: tolerance !== undefined,
                    tolerance: tolerance,
                    willProcess: Number.isFinite(value)
                });
            }
            
            this.logAudit('METRIC_VALIDATION', `Validando métrica: ${metric.key}`, {
                metricKey: metric.key,
                hasValue: value !== undefined,
                value: value,
                hasTarget: target !== undefined,
                target: target,
                hasTolerance: tolerance !== undefined,
                tolerance: tolerance,
                zScore: zScores[metric.key],
                isCritical: metric.isCritical
            });
            
            // 🎯 CORREÇÃO CRÍTICA: Se é métrica crítica e faltam tolerâncias, criar sugestão genérica
            if (metric.isCritical && Number.isFinite(value)) {
                let shouldCreateSuggestion = false;
                let usedTarget = target;
                let usedTolerance = tolerance;
                let suggestionMessage = '';
                let suggestionAction = '';
                
                // 🎯 CORREÇÃO CRÍTICA: Validação de dados físicos para DR
                const isValidDRTarget = metric.key !== 'dr' || (Number.isFinite(target) && target > 0);
                const hasValidData = Number.isFinite(target) && Number.isFinite(tolerance) && isValidDRTarget;
                
                // Se não tem target/tolerance válidos, ou DR com target negativo, usar fallback
                if (!hasValidData) {
                    shouldCreateSuggestion = true;
                    usedTarget = this.getDefaultTarget(metric.key);
                    usedTolerance = this.getDefaultTolerance(metric.key);
                    
                    if (metric.key === 'dr' && Number.isFinite(target) && target < 0) {
                        suggestionMessage = `⚠️ ${metric.label} com target inválido (${target}${metric.unit}) - usando fallback`;
                        this.logAudit('INVALID_DR_TARGET', `DR com target negativo detectado: ${target}`, {
                            originalTarget: target,
                            originalTolerance: tolerance,
                            fallbackTarget: usedTarget,
                            fallbackTolerance: usedTolerance
                        });
                    } else {
                        suggestionMessage = `⚠️ ${metric.label} requer verificação - tolerância não encontrada`;
                    }
                    suggestionAction = this.getGenericAction(metric.key, value);
                    
                    this.logAudit('CRITICAL_METRIC_FALLBACK', `Métrica crítica ${metric.key} com dados faltando/inválidos - criando sugestão genérica`, {
                        metric: metric.key,
                        hasTarget: Number.isFinite(target),
                        hasTolerance: Number.isFinite(tolerance),
                        isValidDRTarget: isValidDRTarget,
                        fallbackTarget: usedTarget,
                        fallbackTolerance: usedTolerance
                    });
                } else {
                    // 🎯 CORREÇÃO CRÍTICA: Lógica de tolerância baseada em range (min/max)
                    // Para DR: target ± tolerance define o range aceitável
                    // Ex: target=-9±8.5 seria INVÁLIDO, mas target=8±2 com value=11.56 seria:
                    // minRange = 8-2 = 6, maxRange = 8+2 = 10 → value=11.56 está FORA (deve sugerir)
                    const minRange = target - tolerance;
                    const maxRange = target + tolerance;
                    const isWithinRange = (value >= minRange && value <= maxRange);
                    
                    if (!isWithinRange) {
                        shouldCreateSuggestion = true;
                        const delta = Math.abs(value - target);
                        const distanceFromRange = value < minRange ? (minRange - value) : (value - maxRange);
                        
                        // 🎯 MENSAGENS COMPLETAS ORIGINAIS
                        const direction = value < target ? "Aumentar" : "Reduzir";
                        suggestionMessage = `${metric.label} fora do ideal`;
                        suggestionAction = `${direction} entre ${Math.abs(distanceFromRange).toFixed(1)} e ${(Math.abs(distanceFromRange) + 1).toFixed(1)}${metric.unit}`;
                        
                        this.logAudit('METRIC_OUT_OF_RANGE', `${metric.key} fora do range aceitável`, {
                            value: value,
                            target: target,
                            tolerance: tolerance,
                            minRange: minRange,
                            maxRange: maxRange,
                            delta: delta,
                            distanceFromRange: distanceFromRange
                        });
                    } else {
                        this.logAudit('METRIC_WITHIN_RANGE', `${metric.key} dentro do range aceitável`, {
                            value: value,
                            target: target,
                            tolerance: tolerance,
                            minRange: minRange,
                            maxRange: maxRange
                        });
                    }
                }
                
                if (shouldCreateSuggestion) {
                    // Calcular z-score ou usar fallback
                    const zScore = zScores[metric.key + '_z'] || (Math.abs(value - usedTarget) / usedTolerance);
                    const severity = this.scorer.getSeverity(zScore);
                    
                    const dependencyBonus = dependencyBonuses[metric.key] || 0;
                    const priority = this.scorer.calculatePriority({
                        metricType: metric.metricType,
                        severity,
                        confidence: confidence || 0.8,
                        dependencyBonus
                    });
                    
                    const suggestion = {
                        type: metric.type,
                        metricType: metric.metricType,
                        icon: this.getMetricIcon(metric.metricType),
                        targetValue: usedTarget,
                        currentValue: value,
                        message: suggestionMessage || `Ajustar ${metric.label} para alinhamento com referência`,
                        action: suggestionAction || `Ajustar ${metric.label}`,
                        why: `${metric.label} é uma métrica crítica para qualidade de áudio`,
                        priority: priority,
                        severity: severity.level,
                        confidence: confidence || 0.8,
                        genre: window.PROD_AI_REF_GENRE || 'unknown',
                        technical: {
                            currentValue: value,
                            targetValue: usedTarget,
                            tolerance: usedTolerance,
                            delta: value - usedTarget,
                            unit: metric.unit
                        },
                        _criticalMetricFallback: !Number.isFinite(target) || !Number.isFinite(tolerance)
                    };
                    
                    // 🚨 MENSAGEM ESPECIAL PARA TRUE PEAK: Adicionar aviso de prioridade (também para fallback)
                    if (metric.metricType === 'true_peak') {
                        const truePeakTemplate = this.heuristicTemplates.true_peak_high;
                        suggestion.priorityWarning = truePeakTemplate.warningMessage;
                        suggestion.correctionOrder = "PRIMEIRO";
                        suggestion.message = `⚡ True Peak requer correção PRIORITÁRIA (${value.toFixed(1)} dBTP → ${usedTarget.toFixed(1)} dBTP)`;
                        suggestion.why = `${truePeakTemplate.priority}`;
                        suggestion.specialAlert = true;
                        suggestion.alertType = "priority_first";
                    }
                    
                    suggestions.push(suggestion);
                    
                    this.logAudit('CRITICAL_METRIC_SUGGESTION', `Sugestão crítica gerada: ${metric.label}`, {
                        value: +value.toFixed(2),
                        target: +usedTarget.toFixed(2),
                        tolerance: +usedTolerance.toFixed(2),
                        delta: +(value - usedTarget).toFixed(2),
                        severity: severity.level,
                        priority: +priority.toFixed(3),
                        isFallback: !Number.isFinite(target) || !Number.isFinite(tolerance)
                    });
                }
            } else if (!metric.isCritical) {
                // Métricas não críticas - lógica original
                // 🔍 z-score tem sufixo '_z' nas chaves
                const zScore = zScores[metric.key + '_z'];
                
                this.logAudit('ZSCORE_LOOKUP', `Z-Score lookup para ${metric.key}`, {
                    metricKey: metric.key,
                    searchKey: metric.key + '_z',
                    zScore: zScore,
                    allZScores: Object.keys(zScores)
                });
                
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
                    
                    // 🎯 GARANTIR CAMPOS OBRIGATÓRIOS PARA MÉTRICAS PRINCIPAIS
                    suggestion.icon = this.getMetricIcon(metric.metricType);
                    suggestion.targetValue = target;
                    suggestion.currentValue = value;
                    
                    // 🚨 MENSAGEM ESPECIAL PARA TRUE PEAK: Adicionar aviso de prioridade
                    if (metric.metricType === 'true_peak') {
                        const truePeakTemplate = this.heuristicTemplates.true_peak_high;
                        suggestion.priorityWarning = truePeakTemplate.warningMessage;
                        suggestion.correctionOrder = "PRIMEIRO";
                        suggestion.message = `⚡ True Peak requer correção PRIORITÁRIA (${value.toFixed(1)} dBTP → ${target.toFixed(1)} dBTP)`;
                        suggestion.why = `${truePeakTemplate.priority}`;
                        suggestion.specialAlert = true;
                        suggestion.alertType = "priority_first";
                    } else {
                        // Se fields estão vazios, preencher com valores padrão
                        if (!suggestion.message || suggestion.message.trim() === '') {
                            suggestion.message = `Ajustar ${metric.label} para alinhamento com referência`;
                        }
                        if (!suggestion.why || suggestion.why.trim() === '') {
                            suggestion.why = `${metric.label} fora da faixa ideal para o gênero`;
                        }
                    }
                    
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
        }
        
        // Sugestões para bandas espectrais
        if (referenceData.bands) {
            log('\n🔍 [ENGINE-DEBUG] ===== INÍCIO generateReferenceSuggestions (BANDAS) =====');
            log('[ENGINE-DEBUG] referenceData.bands:', JSON.stringify(referenceData.bands, null, 2));
            
            this.logAudit('BANDS_REFERENCE_CHECK', 'Bandas de referência disponíveis', {
                referenceBands: Object.keys(referenceData.bands),
                metricsAvailable: Object.keys(metrics).filter(k => !['lufs', 'true_peak', 'dr', 'lra', 'stereo'].includes(k))
            });

            for (const [band, refData] of Object.entries(referenceData.bands)) {
                log(`\n[ENGINE-DEBUG] ===== PROCESSANDO SUGESTÃO PARA BANDA: ${band} =====`);
                log('[ENGINE-DEBUG] refData:', JSON.stringify(refData, null, 2));
                const value = metrics[band];
                
                // 🎯 NOVO: Suporte híbrido para target_range (prioridade) e target_db (fallback)
                let target, targetRange, tolerance, effectiveTolerance;
                let rangeBasedLogic = false;
                
                log('[ENGINE-DEBUG] Verificando tipo de target...');
                
                // Prioridade 1: target_range (novo sistema)
                if (refData.target_range && typeof refData.target_range === 'object' &&
                    Number.isFinite(refData.target_range.min) && Number.isFinite(refData.target_range.max)) {
                    
                    targetRange = refData.target_range;
                    rangeBasedLogic = true;
                    
                    log('[ENGINE-DEBUG] ✅ USANDO target_range (PRIORIDADE 1)');
                    log('[ENGINE-DEBUG] Valor usado pelo Engine como targetRange.min:', targetRange.min);
                    log('[ENGINE-DEBUG] Valor usado pelo Engine como targetRange.max:', targetRange.max);
                    log('[ENGINE-DEBUG] Origem: referenceData.bands[' + band + '].target_range');
                    
                    // Para ranges, usar diferente lógica de tolerância
                    const rangeSize = targetRange.max - targetRange.min;
                    effectiveTolerance = rangeSize * 0.25; // 25% do range como tolerância leve
                    
                    log(`🎯 [RANGE-LOGIC] Banda ${band}: range [${targetRange.min}, ${targetRange.max}], tolerância: ${effectiveTolerance.toFixed(1)} dB`);
                    
                } else if (Number.isFinite(refData.target_db)) {
                    // Prioridade 2: target_db fixo (sistema legado)
                    target = refData.target_db;
                    tolerance = refData.tol_db;
                    effectiveTolerance = tolerance;
                    
                    log('[ENGINE-DEBUG] ⚠️ USANDO target_db (FALLBACK - PRIORIDADE 2)');
                    log('[ENGINE-DEBUG] Valor usado pelo Engine como target:', target);
                    log('[ENGINE-DEBUG] Origem: referenceData.bands[' + band + '].target_db');
                    
                    log(`🎯 [FIXED-LOGIC] Banda ${band}: target fixo ${target} dB, tolerância: ${effectiveTolerance} dB`);
                } else {
                    error('[ENGINE-ERROR] ❌ NEM target_range NEM target_db encontrados!');
                }
                
                const zScore = zScores[band + '_z'];
                
                this.logAudit('BAND_SUGGESTION_CHECK', `Verificando banda: ${band}`, {
                    band,
                    hasValue: Number.isFinite(value),
                    value,
                    rangeBasedLogic,
                    hasTargetRange: !!targetRange,
                    targetRange,
                    hasTarget: Number.isFinite(target), 
                    target,
                    hasTolerance: Number.isFinite(effectiveTolerance),
                    tolerance: effectiveTolerance,
                    hasZScore: Number.isFinite(zScore),
                    zScore
                });
                
                // Validação de dados básicos
                if (!Number.isFinite(value) || !Number.isFinite(effectiveTolerance)) {
                    this.logAudit('BAND_SUGGESTION_SKIPPED', `Banda ignorada por valores inválidos: ${band}`, {
                        band,
                        value,
                        target,
                        targetRange,
                        tolerance: effectiveTolerance,
                        reason: !Number.isFinite(value) ? 'value_invalid' : 'tolerance_invalid'
                    });
                    continue;
                }
                
                // Validação específica do sistema escolhido
                if (!rangeBasedLogic && !Number.isFinite(target)) {
                    this.logAudit('BAND_SUGGESTION_SKIPPED', `Banda ignorada por target fixo inválido: ${band}`, {
                        band, value, target, reason: 'target_invalid'
                    });
                    continue;
                }
                
                // 🎯 NOVA LÓGICA: Calcular severity baseado no sistema (range vs fixed)
                let severityLevel, shouldInclude, calculatedDelta;
                
                if (rangeBasedLogic) {
                    // === LÓGICA RANGE-BASED ===
                    if (value >= targetRange.min && value <= targetRange.max) {
                        // Dentro do range → sem sugestão
                        severityLevel = 'green';
                        shouldInclude = false;
                        calculatedDelta = 0;
                        
                        log(`✅ [RANGE] ${band}: ${value.toFixed(1)} dB dentro do range [${targetRange.min}, ${targetRange.max}] - sem sugestão`);
                        
                    } else {
                        // Fora do range → calcular distância
                        if (value < targetRange.min) {
                            calculatedDelta = value - targetRange.min; // negativo = abaixo
                        } else {
                            calculatedDelta = value - targetRange.max; // positivo = acima
                        }
                        
                        const distance = Math.abs(calculatedDelta);
                        
                        if (distance <= 2.0) {
                            // Até ±2 dB dos limites → sugestão leve (amarelo)
                            severityLevel = 'yellow';
                            shouldInclude = this.config.includeYellowSeverity;
                            
                            log(`⚠️ [RANGE] ${band}: ${value.toFixed(1)} dB a ${distance.toFixed(1)} dB do range - sugestão leve`);
                            
                        } else {
                            // Fora de ±2 dB → sugestão forte (vermelho)
                            severityLevel = 'red';
                            shouldInclude = true;
                            
                            log(`❌ [RANGE] ${band}: ${value.toFixed(1)} dB muito fora do range - sugestão forte`);
                        }
                    }
                } else {
                    // === LÓGICA FIXED-TARGET (legado) ===
                    calculatedDelta = value - target;
                    const severity = this.scorer.getSeverity(zScore);
                    severityLevel = severity.level;
                    shouldInclude = severityLevel !== 'green' || 
                        (severityLevel === 'yellow' && this.config.includeYellowSeverity);
                        
                    log(`📊 [FIXED] ${band}: usando lógica legada, severity: ${severityLevel}`);
                }
                
                this.logAudit('BAND_SEVERITY_CHECK', `Severidade da banda: ${band}`, {
                    band,
                    severityLevel,
                    shouldInclude,
                    includeYellow: this.config.includeYellowSeverity,
                    rangeBasedLogic,
                    calculatedDelta
                });
                
                if (shouldInclude) {
                    const dependencyBonus = dependencyBonuses[band] || 0;
                    
                    // Criar objeto severity simulado para compatibilidade
                    const severityObj = { level: severityLevel };
                    
                    const priority = this.scorer.calculatePriority({
                        metricType: 'band',
                        severity: severityObj,
                        confidence,
                        dependencyBonus
                    });
                    
                    log(`🎯 [BAND-PRIORITY] ${band}: prioridade=${priority.toFixed(3)}, severity=${severityLevel}, incluir=${shouldInclude}`);
                    
                    // 🎯 NOVA GERAÇÃO DE SUGESTÃO HÍBRIDA
                    let suggestion;
                    
                    if (rangeBasedLogic) {
                        // === SUGESTÃO BASEADA EM RANGE ===
                        suggestion = this.scorer.generateSuggestion({
                            type: 'band_adjust',
                            subtype: band,
                            value,
                            target: null, // Para ranges, não há target fixo
                            targetRange,
                            tolerance: effectiveTolerance,
                            zScore,
                            severity: severityObj,
                            priority,
                            confidence,
                            genre: window.PROD_AI_REF_GENRE || 'unknown',
                            metricType: 'band',
                            band,
                            rangeBasedLogic: true
                        });
                        
                        // 🎯 PATCH 3: MENSAGENS COM VALORES REAIS DO target_range.min/max
                        const direction = calculatedDelta > 0 ? "Reduzir" : "Aumentar";
                        const amount = Math.abs(calculatedDelta).toFixed(1);
                        const rangeText = `${targetRange.min} a ${targetRange.max} dB`;
                        
                        // ✅ GARANTIR que target_range apareça nas mensagens
                        suggestion.action = `${direction} entre ${amount} e ${(parseFloat(amount) + 1).toFixed(1)} dB`;
                        suggestion.diagnosis = `Atual: ${value.toFixed(1)} dB | Intervalo ideal: ${rangeText}`;
                        suggestion.message = `${direction} ${band} para range ideal`;
                        suggestion.why = `Banda ${band} está fora do intervalo ideal (${rangeText}) para o gênero`;
                        
                        // ✅ DADOS TÉCNICOS com min/max explícitos
                        suggestion.technical = {
                            delta: calculatedDelta,
                            currentValue: value,
                            targetRange: targetRange,
                            targetMin: targetRange.min, // 🎯 EXPLÍCITO
                            targetMax: targetRange.max, // 🎯 EXPLÍCITO
                            idealRange: rangeText,       // 🎯 TEXTO FORMATADO
                            distanceFromRange: Math.abs(calculatedDelta),
                            withinRange: false,
                            rangeSize: targetRange.max - targetRange.min
                        };
                        
                        log('[ENGINE-DEBUG] ✅ suggestion.technical gerado:');
                        log('[ENGINE-DEBUG]   - targetMin:', suggestion.technical.targetMin);
                        log('[ENGINE-DEBUG]   - targetMax:', suggestion.technical.targetMax);
                        log('[ENGINE-DEBUG]   - idealRange:', suggestion.technical.idealRange);
                        
                        // 🔍 VALIDAÇÃO CRÍTICA: Comparar com JSON original
                        if (refData.target_range) {
                            const jsonMin = refData.target_range.min;
                            const jsonMax = refData.target_range.max;
                            const engineMin = suggestion.technical.targetMin;
                            const engineMax = suggestion.technical.targetMax;
                            
                            if (jsonMin !== engineMin || jsonMax !== engineMax) {
                                error('❌ [ENGINE-ERROR] Divergência detectada!');
                                error('[ENGINE-ERROR] JSON.min =', jsonMin, '| Engine.min =', engineMin);
                                error('[ENGINE-ERROR] JSON.max =', jsonMax, '| Engine.max =', engineMax);
                            } else {
                                log('✅ [ENGINE-SUCCESS] Valores corretos: JSON e Engine coincidem');
                            }
                        }

                        
                    } else {
                        // === SUGESTÃO BASEADA EM TARGET FIXO (legado) ===
                        suggestion = this.scorer.generateSuggestion({
                            type: 'band_adjust',
                            subtype: band,
                            value,
                            target,
                            tolerance: effectiveTolerance,
                            zScore,
                            severity: severityObj,
                            priority,
                            confidence,
                            genre: window.PROD_AI_REF_GENRE || 'unknown',
                            metricType: 'band',
                            band,
                            rangeBasedLogic: false
                        });
                        
                        // Mensagens completas originais
                        const direction = calculatedDelta > 0 ? "Reduzir" : "Aumentar";
                        const amount = Math.abs(calculatedDelta).toFixed(1);
                        
                        suggestion.action = `${direction} entre ${amount} e ${(parseFloat(amount) + 1).toFixed(1)} dB`;
                        suggestion.diagnosis = `Atual: ${value.toFixed(1)} dB, Alvo: ${target.toFixed(1)} dB`;
                        suggestion.message = `${direction} ${band}`;
                        suggestion.why = `Banda ${band} fora da faixa ideal para o gênero`;
                        
                        // Dados técnicos tradicionais
                        suggestion.technical = {
                            delta: calculatedDelta,
                            currentValue: value,
                            targetValue: target,
                            tolerance: effectiveTolerance
                        };
                    }
                    
                    // 🎯 CAMPOS OBRIGATÓRIOS COMUNS
                    suggestion.icon = '🎵';  // Ícone obrigatório para bandas
                    suggestion.currentValue = value;
                    
                    // Garantir campos de texto obrigatórios
                    if (!suggestion.message || suggestion.message.trim() === '') {
                        suggestion.message = `Ajustar ${band} para alinhamento com referência`;
                    }
                    if (!suggestion.why || suggestion.why.trim() === '') {
                        suggestion.why = `Banda ${band} fora da faixa ideal para o gênero`;
                    }
                    
                    suggestions.push(suggestion);
                    
                    this.logAudit('BAND_SUGGESTION', `Sugestão de banda: ${band}`, {
                        value: +value.toFixed(2),
                        target: rangeBasedLogic ? 'range' : +target.toFixed(2),
                        targetRange: rangeBasedLogic ? targetRange : null,
                        delta: +calculatedDelta.toFixed(2),
                        severity: severityLevel,
                        priority: +priority.toFixed(3),
                        rangeBasedLogic
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
                
                for (const item of spectralBands) {
                    if (!item.metric) continue;
                    
                    const value = item.value;
                    const ideal = item.ideal;
                    
                    // 🎯 REGRA: Se value ou ideal não existirem → não gerar sugestão
                    if (!Number.isFinite(value) || !Number.isFinite(ideal)) {
                        this.logAudit('SUGGESTION_SKIPPED', `Banda ignorada por valores inválidos: ${item.metric}`, {
                            metric: item.metric,
                            value: value,
                            ideal: ideal,
                            reason: !Number.isFinite(value) ? 'value_invalid' : 'ideal_invalid'
                        });
                        continue;
                    }
                    
                    const delta = ideal - value;
                    
                    // 🎯 LOG de verificação solicitado
                    this.logAudit('SUGGESTIONS', `Banda ${item.metric} - atual: ${value}, alvo: ${ideal}, delta: ${delta}`, {
                        metric: item.metric,
                        value: value,
                        ideal: ideal,
                        delta: delta,
                        hasValidData: true
                    });
                    
                    if (Math.abs(delta) < 0.2) {
                        // Ignorar diferenças muito pequenas
                        this.logAudit('SUGGESTION_SKIPPED', `Banda ignorada por delta muito pequeno: ${item.metric}`, {
                            metric: item.metric,
                            delta: delta,
                            threshold: 0.2
                        });
                        continue;
                    }
                    
                    // Usar valor real da tolerância se disponível, senão usar padrão para bandas
                    const tolerance = item.tolerance || 3.0;
                    
                    // Calcular z-score baseado no delta e tolerância
                    const zScore = Math.abs(delta) / tolerance;
                    const severity = this.scorer.getSeverity(zScore);
                    
                    const shouldInclude = severity.level !== 'green' || 
                        (severity.level === 'yellow' && this.config.includeYellowSeverity);
                    
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
                            target: ideal,
                            tolerance,
                            zScore,
                            severity,
                            priority,
                            confidence,
                            genre: window.PROD_AI_REF_GENRE || 'unknown',
                            metricType: 'band',
                            band: item.metric
                        });
                        
                        // 🎯 GARANTIR CAMPOS OBRIGATÓRIOS PARA BANDAS DE REFERÊNCIA
                        suggestion.icon = '🎵';  // Ícone obrigatório para bandas
                        suggestion.targetValue = ideal;
                        suggestion.currentValue = value;
                        
                        // Garantir campos de texto obrigatórios
                        if (!suggestion.message || suggestion.message.trim() === '') {
                            suggestion.message = `Ajustar ${item.metric} para alinhamento com referência`;
                        }
                        if (!suggestion.why || suggestion.why.trim() === '') {
                            suggestion.why = `Banda ${item.metric} fora da faixa ideal`;
                        }
                        
                        // 🎯 APLICAR LÓGICA SEGURA PARA ACTION E DIAGNOSIS
                        // Delta = current - target (positivo = atual maior que alvo = reduzir)
                        const calculatedDelta = value - ideal;
                        const suggestionDelta = suggestion.technical?.delta || calculatedDelta;
                        
                        if (typeof suggestionDelta === "number" && !isNaN(suggestionDelta)) {
                            const direction = suggestionDelta > 0 ? "Reduzir" : "Aumentar";
                            const amount = Math.abs(suggestionDelta).toFixed(1);
                            suggestion.action = `${direction} ${item.metric} em ${amount} dB`;
                            suggestion.diagnosis = `Atual: ${value.toFixed(1)} dB, Alvo: ${ideal.toFixed(1)} dB, Diferença: ${amount} dB`;
                            
                            // Garantir que delta está salvo corretamente
                            if (suggestion.technical) {
                                suggestion.technical.delta = suggestionDelta;
                                suggestion.technical.currentValue = value;
                                suggestion.technical.targetValue = ideal;
                            }
                        } else {
                            suggestion.action = `Ajustar banda ${item.metric}`;
                            suggestion.diagnosis = `Verificar níveis da banda ${item.metric}`;
                        }
                        
                        suggestions.push(suggestion);
                        
                        this.logAudit('REFERENCE_COMPARISON_SUGGESTION', `Sugestão de banda baseada em referenceComparison: ${item.metric}`, {
                            value: +value.toFixed(2),
                            ideal: +ideal.toFixed(2),
                            delta: +delta.toFixed(2),
                            realDelta: delta, // valor não limitado
                            zScore: +zScore.toFixed(2),
                            severity: severity.level,
                            priority: +priority.toFixed(3),
                            source: 'referenceComparison'
                        });
                    }
                }
            }
        }
        
        // 🎯 PÓS-PROCESSAMENTO: Corrigir actions de todas as sugestões de banda que ainda usam valores incorretos
        suggestions = this.postProcessBandSuggestions(suggestions);
        
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
                transientData: this.extractTransientData(analysis),
                analysis: analysis  // 🎯 Adicionar análise completa para métricas LUFS/TP/LRA
            };
            
            // Executar análise heurística (se disponível)
            if (!this.heuristics) {
                warn('🚨 Heuristics analyzer não disponível - pulando análise heurística');
                return [];
            }
            
            log('🎯 [HEURISTICS] Heuristics analyzer ativado com sucesso');
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
            warn('🚨 Erro na análise heurística:', error);
            this.logAudit('HEURISTIC_ERROR', 'Erro na análise heurística', { error: error.message });
        }
        
        // 🎓 Aplicar enriquecimento educativo às sugestões
        const enrichedSuggestions = this.applyEducationalEnrichment(suggestions);
        
        return enrichedSuggestions;
    }

    /**
     * 🎓 Aplicar enriquecimento educativo às sugestões heurísticas
     * @param {Array} suggestions - Sugestões heurísticas básicas
     * @returns {Array} Sugestões enriquecidas com templates educativos
     */
    applyEducationalEnrichment(suggestions) {
        let enrichmentCount = 0;
        
        const enrichedSuggestions = suggestions.map(suggestion => {
            // Mapear tipos de detecção para templates
            const templateKey = this.mapDetectionToTemplate(suggestion.type);
            const template = this.heuristicTemplates[templateKey];
            
            if (template) {
                enrichmentCount++;
                
                // Aplicar template educativo
                return {
                    ...suggestion,
                    explanation: template.explanation,
                    action: template.action,
                    dawExample: template.dawExample,
                    enriched: true,
                    educationalLevel: 'detailed'
                };
            }
            
            return suggestion;
        });
        
        log(`🎯 [HEURISTICS] ${enrichmentCount} enriquecimentos aplicados`);
        
        return enrichedSuggestions;
    }
    
    /**
     * 🔄 Mapear tipos de detecção para templates educativos
     * @param {string} detectionType - Tipo de detecção heurística
     * @returns {string} Chave do template correspondente
     */
    mapDetectionToTemplate(detectionType) {
        const mapping = {
            'sibilance': 'sibilance',
            'harshness': 'harshness', 
            'masking': 'masking',
            'spectral_imbalance': 'spectral_imbalance',
            'heuristic_lufs': 'lufs_too_low',
            'heuristic_true_peak': 'true_peak_high',
            'heuristic_lra': 'lra_too_low',
            'heuristic_stereo': 'stereo_narrow'
        };
        
        return mapping[detectionType] || 'reference_comparison';
    }

    /**
     * 🎓 Aplicar enriquecimento educativo universal a TODAS as sugestões
     * @param {Array} suggestions - Todas as sugestões (referência + heurísticas)
     * @returns {Array} Sugestões enriquecidas com campos educativos
     */
    applyUniversalEducationalEnrichment(suggestions) {
        if (!suggestions || !Array.isArray(suggestions)) {
            warn('🚨 [EDUCATIONAL] Sugestões inválidas recebidas para enriquecimento');
            return [];
        }

        let enrichmentCount = 0;
        const enrichedSuggestions = suggestions.map(suggestion => {
            try {
                // Determinar template educativo baseado no tipo da sugestão
                const templateKey = this.mapSuggestionTypeToEducationalTemplate(suggestion);
                const template = this.heuristicTemplates[templateKey];

                if (template) {
                    enrichmentCount++;
                    
                    // Aplicar campos educativos sem sobrescrever campos existentes
                    const enrichedSuggestion = {
                        ...suggestion,
                        
                        // Campos educativos novos
                        context: template.explanation || `Contexto para ${suggestion.type}`,
                        cause: this.generateCauseText(suggestion, template),
                        solution: template.action || suggestion.action || 'Aplicar ajuste recomendado',
                        dawTip: template.dawExample || 'Use as ferramentas de EQ/compressor do seu DAW',
                        
                        // Metadados de enriquecimento
                        enriched: true,
                        educationalLevel: 'comprehensive',
                        templateUsed: templateKey,
                        enrichmentSource: 'universal_educational_enrichment'
                    };
                    
                    return enrichedSuggestion;
                }
                
                // Se não há template específico, criar enriquecimento genérico
                return {
                    ...suggestion,
                    context: this.generateGenericContext(suggestion),
                    cause: this.generateGenericCause(suggestion),
                    solution: suggestion.action || 'Aplicar ajuste conforme sugerido',
                    dawTip: 'Use as ferramentas de áudio do seu DAW para aplicar este ajuste',
                    enriched: true,
                    educationalLevel: 'basic',
                    enrichmentSource: 'generic_educational_enrichment'
                };
                
            } catch (error) {
                warn('🚨 [EDUCATIONAL] Erro ao enriquecer sugestão:', error, suggestion);
                return suggestion; // Retornar sugestão original em caso de erro
            }
        });

        log(`🎓 [EDUCATIONAL] Enriquecimento universal aplicado: ${enrichmentCount}/${suggestions.length} sugestões enriquecidas`);
        return enrichedSuggestions;
    }

    /**
     * 🗺️ Mapear tipos de sugestão para templates educativos
     * @param {Object} suggestion - Sugestão a ser enriquecida
     * @returns {string} Chave do template educativo
     */
    mapSuggestionTypeToEducationalTemplate(suggestion) {
        const type = suggestion.type || '';
        const metricType = suggestion.metricType || '';
        const subtype = suggestion.subtype || '';

        // 🎯 CORREÇÃO CRÍTICA: Mapeamento dinâmico para DR baseado na comparação atual vs. target
        if (type === 'reference_dynamics' || metricType === 'dr') {
            const currentValue = suggestion.currentValue || suggestion.technical?.currentValue;
            const targetValue = suggestion.targetValue || suggestion.technical?.targetValue;
            
            if (Number.isFinite(currentValue) && Number.isFinite(targetValue)) {
                // Se DR atual > target → muita variação → precisa mais compressão
                // Se DR atual < target → pouca variação → precisa menos compressão
                return currentValue > targetValue ? 'dr_high' : 'dr_low';
            }
            
            // Fallback: usar dr_low como padrão (mais comum)
            return 'dr_low';
        }

        // 🎯 CORREÇÃO CRÍTICA: Mapeamento dinâmico para LUFS baseado na comparação atual vs. target
        if (type === 'reference_loudness' || metricType === 'lufs') {
            const currentValue = suggestion.currentValue || suggestion.technical?.currentValue;
            const targetValue = suggestion.targetValue || suggestion.technical?.targetValue;
            
            if (Number.isFinite(currentValue) && Number.isFinite(targetValue)) {
                // Se LUFS atual < target → muito baixo → precisa aumentar
                // Se LUFS atual > target → muito alto → precisa reduzir  
                return currentValue < targetValue ? 'lufs_too_low' : 'lufs_too_high';
            }
            
            // Fallback: usar lufs_too_low como padrão (mais comum)
            return 'lufs_too_low';
        }

        // 🎯 CORREÇÃO CRÍTICA: Mapeamento dinâmico para LRA baseado na comparação atual vs. target
        if (type === 'reference_lra' || metricType === 'lra') {
            const currentValue = suggestion.currentValue || suggestion.technical?.currentValue;
            const targetValue = suggestion.targetValue || suggestion.technical?.targetValue;
            
            if (Number.isFinite(currentValue) && Number.isFinite(targetValue)) {
                // Se LRA atual < target → muito baixo → precisa menos compressão
                // Se LRA atual > target → muito alto → precisa mais compressão
                return currentValue < targetValue ? 'lra_too_low' : 'lra_too_high';
            }
            
            // Fallback: usar lra_too_low como padrão (mais comum)
            return 'lra_too_low';
        }

        // Mapeamento direto por tipo principal (para outros tipos)
        const directMapping = {
            'reference_true_peak': 'true_peak_high', 
            'reference_stereo': 'stereo_narrow',
            'band_adjust': 'spectral_imbalance',
            'reference_band_comparison': 'spectral_imbalance',
            'heuristic_sibilance': 'sibilance',
            'heuristic_harshness': 'harshness',
            'heuristic_masking': 'masking',
            'heuristic_spectral_imbalance': 'spectral_imbalance'
        };

        // Buscar mapeamento direto primeiro
        if (directMapping[type]) {
            return directMapping[type];
        }

        // Mapeamento por metricType para sugestões de referência (apenas para tipos restantes)
        if (type.startsWith('reference_')) {
            const metricMapping = {
                'true_peak': 'true_peak_high',
                'stereo': 'stereo_narrow',
                'band': 'spectral_imbalance'
            };
            
            if (metricMapping[metricType]) {
                return metricMapping[metricType];
            }
        }

        // Mapeamento por subtipo para bandas espectrais
        if (type === 'band_adjust' && subtype) {
            return 'spectral_imbalance'; // Todas as bandas usam o mesmo template
        }

        // Fallback para template genérico
        return 'reference_comparison';
    }

    /**
     * 📝 Gerar texto de causa baseado na sugestão e template
     * @param {Object} suggestion - Sugestão original
     * @param {Object} template - Template educativo
     * @returns {string} Texto explicativo da causa
     */
    generateCauseText(suggestion, template) {
        const currentValue = suggestion.currentValue;
        const targetValue = suggestion.targetValue;
        const metricType = suggestion.metricType || '';
        
        if (Number.isFinite(currentValue) && Number.isFinite(targetValue)) {
            const diff = (currentValue - targetValue).toFixed(1);
            const direction = currentValue > targetValue ? 'alto' : 'baixo';
            
            return `Valor atual (${currentValue.toFixed(1)}) está ${Math.abs(diff)} unidades ${direction} do alvo (${targetValue.toFixed(1)}) para ${metricType.toUpperCase()}`;
        }
        
        return template.explanation || `Métrica ${metricType} fora do range ideal para o gênero`;
    }

    /**
     * 🔤 Gerar contexto genérico para sugestões sem template específico
     * @param {Object} suggestion - Sugestão original
     * @returns {string} Contexto educativo genérico
     */
    generateGenericContext(suggestion) {
        const type = suggestion.type || 'ajuste';
        const metricType = suggestion.metricType || '';
        
        if (type.includes('reference_')) {
            return `Esta sugestão compara sua música com padrões de referência do gênero para ${metricType.toUpperCase()}`;
        }
        
        if (type.includes('heuristic_')) {
            return `Esta sugestão foi gerada por análise heurística avançada de características de áudio`;
        }
        
        if (type.includes('band_')) {
            return `Esta sugestão ajusta o balanço espectral para melhor adequação ao gênero`;
        }
        
        return `Esta sugestão visa otimizar a qualidade técnica da sua música`;
    }

    /**
     * 🎯 Gerar causa genérica para sugestões sem template específico
     * @param {Object} suggestion - Sugestão original
     * @returns {string} Causa genérica
     */
    generateGenericCause(suggestion) {
        const severity = suggestion.severity?.level || 'medium';
        const metricType = suggestion.metricType || 'parâmetro';
        
        const severityTexts = {
            'red': 'significativamente fora',
            'yellow': 'ligeiramente fora',
            'green': 'dentro',
            'medium': 'moderadamente fora'
        };
        
        const severityText = severityTexts[severity] || 'fora';
        
        return `${metricType.toUpperCase()} está ${severityText} do range ideal para o gênero musical`;
    }

    /**
     * 📊 Extrair dados espectrais da análise
     * @param {Object} analysis - Análise de áudio
     * @returns {Object|null} Dados espectrais
     */
    extractSpectralData(analysis) {
        // 🎯 CORREÇÃO: Mapear estruturas de dados reais do SoundyAI
        
        // 1. Tentar technicalData.spectral_balance (formato principal)
        if (analysis.technicalData?.spectral_balance) {
            return {
                bands: analysis.technicalData.spectral_balance,
                source: 'spectral_balance'
            };
        }
        
        // 2. Tentar technicalData.spectralBands (formato alternativo)
        if (analysis.technicalData?.spectralBands) {
            return {
                bands: analysis.technicalData.spectralBands,
                source: 'spectralBands'
            };
        }
        
        // 3. Tentar metrics.bands (formato de métricas)
        if (analysis.metrics?.bands) {
            return {
                bands: analysis.metrics.bands,
                source: 'metrics_bands'
            };
        }
        
        // 4. Fallback: tentar construir a partir de spectrum raw
        if (analysis.technicalData?.spectrum) {
            return {
                freqBins: analysis.technicalData.spectrum.freqBins,
                magnitude: analysis.technicalData.spectrum.magnitude,
                source: 'raw_spectrum'
            };
        }
        
        // 5. Fallback: tentar construir a partir de frequências dominantes
        if (analysis.technicalData?.dominantFrequencies) {
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
            
            return freqBins.length > 0 ? { freqBins, magnitude, source: 'dominant_freq' } : null;
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
        log('🧪 Testando normalização de dados de referência...');
        const startTime = Date.now();
        
        const result = this.normalizeReferenceData(rawRef);
        const duration = Date.now() - startTime;
        
        log(`⏱️ Normalização concluída em ${duration}ms`);
        log('📊 Resultado:', result);
        log('📝 Log de auditoria:', this.auditLog);
        
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
    
    /**
     * Pós-processa sugestões de banda para garantir que o campo 'action' 
     * use valores calculados reais em vez de valores fixos (6.0, 4.0 dB)
     */
    postProcessBandSuggestions(suggestions) {
        if (!Array.isArray(suggestions)) return suggestions;
        
        const processed = suggestions.map(suggestion => {
            // Verificar se é uma sugestão de banda que precisa ser corrigida
            const isBandSuggestion = suggestion.type === 'band_adjust' || 
                                    suggestion.type === 'reference_band_comparison' ||
                                    (suggestion.subtype && this.scorer.bandRanges && this.scorer.bandRanges[suggestion.subtype]);
            
            if (!isBandSuggestion) return suggestion;
            
            // Verificar se tem dados técnicos
            const technical = suggestion.technical;
            if (!technical) {
                this.logAudit('POST_PROCESS_SKIP', `Banda sem dados técnicos: ${suggestion.subtype}`, {
                    band: suggestion.subtype,
                    hasTechnical: !!technical
                });
                return suggestion;
            }
            
            // 🎯 CORREÇÃO CRÍTICA: Verificar múltiplas fontes para value e target
            let currentValue = null;
            let targetValue = null;
            
            // 1. Buscar em technical (preferência)
            if (Number.isFinite(technical.value)) currentValue = technical.value;
            if (Number.isFinite(technical.target)) targetValue = technical.target;
            
            // 2. Buscar em suggestion.currentValue/targetValue (fallback)
            if (currentValue === null && Number.isFinite(suggestion.currentValue)) {
                currentValue = suggestion.currentValue;
            }
            if (targetValue === null && Number.isFinite(suggestion.targetValue)) {
                targetValue = suggestion.targetValue;
            }
            
            // 3. Buscar em technical com aliases alternativos
            if (currentValue === null && Number.isFinite(technical.currentValue)) {
                currentValue = technical.currentValue;
            }
            if (targetValue === null && Number.isFinite(technical.targetValue)) {
                targetValue = technical.targetValue;
            }
            
            // Validar se temos os valores necessários
            if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue)) {
                this.logAudit('POST_PROCESS_SKIP', `Banda sem valores válidos: ${suggestion.subtype}`, {
                    band: suggestion.subtype,
                    currentValue,
                    targetValue,
                    technicalKeys: Object.keys(technical),
                    suggestionKeys: Object.keys(suggestion).filter(k => k.includes('Value') || k.includes('value'))
                });
                return suggestion;
            }
            
            // 🎯 CORREÇÃO: Calcular delta real para referência técnica
            // Delta = current - target (positivo = atual maior que alvo = reduzir)
            const realDelta = currentValue - targetValue;
            
            // 🎯 APLICAR MAPEAMENTO PROGRESSIVO (não recalcular com valor bruto!)
            if (typeof realDelta === "number" && !isNaN(realDelta)) {
                // Verificar se action já foi mapeado corretamente
                const currentAction = suggestion.action || '';
                
                // Verificar se o action contém um valor mapeado válido (1-6 dB)
                const actionMatch = currentAction.match(/(\d+\.?\d*)\s*dB/);
                const actionValue = actionMatch ? parseFloat(actionMatch[1]) : null;
                
                // Se o action já tem valor mapeado (≤6 dB), manter
                if (actionValue && actionValue <= 6.0) {
                    this.logAudit('POST_PROCESS_KEEP', `Action já mapeado corretamente: ${suggestion.subtype}`, {
                        band: suggestion.subtype,
                        action: currentAction,
                        mappedValue: actionValue,
                        realDelta: realDelta,
                        source: 'postProcessBandSuggestions'
                    });
                    
                    // Atualizar apenas dados técnicos
                    return { 
                        ...suggestion, 
                        technical: {
                            ...technical,
                            value: currentValue,
                            target: targetValue,
                            delta: realDelta,
                            currentValue: currentValue,
                            targetValue: targetValue
                        },
                        currentValue: currentValue,
                        targetValue: targetValue
                    };
                }
                
                // Se chegou aqui, o action tem valor bruto - aplicar mapeamento
                const mappedDelta = this.scorer.mapBoostToPracticalRange(Math.abs(realDelta));
                const direction = realDelta > 0 ? "Reduzir" : "Aumentar";
                const bandName = this.getBandDisplayName(suggestion.subtype || suggestion.band);
                
                // Gerar action com valor mapeado e diagnosis com diferença real
                const newAction = `${direction} ${bandName} em ${mappedDelta.toFixed(1)} dB`;
                const newDiagnosis = `Atual: ${currentValue.toFixed(1)} dB, Alvo: ${targetValue.toFixed(1)} dB, Diferença real: ${Math.abs(realDelta).toFixed(1)} dB → Sugestão: ${mappedDelta.toFixed(1)} dB`;
                
                this.logAudit('ACTION_MAPPED', `Action mapeado para banda ${suggestion.subtype}`, {
                    band: suggestion.subtype,
                    oldAction: currentAction,
                    newAction: newAction,
                    realDelta: realDelta,
                    mappedDelta: mappedDelta,
                    source: 'postProcessBandSuggestions'
                });
                
                return {
                    ...suggestion,
                    action: newAction,
                    diagnosis: newDiagnosis,
                    technical: {
                        ...technical,
                        value: currentValue,
                        target: targetValue,
                        delta: realDelta,
                        mappedDelta: mappedDelta,
                        currentValue: currentValue,
                        targetValue: targetValue
                    },
                    currentValue: currentValue,
                    targetValue: targetValue
                };
            } else {
                // 🎯 SE DELTA NÃO EXISTIR, NÃO GERAR ACTION
                this.logAudit('POST_PROCESS_ERROR', `Delta inválido para banda ${suggestion.subtype}`, {
                    band: suggestion.subtype,
                    currentValue,
                    targetValue,
                    realDelta,
                    deltaType: typeof realDelta
                });
                
                return {
                    ...suggestion,
                    action: `Verificar banda ${suggestion.subtype}`,
                    diagnosis: `Erro no cálculo de diferença`,
                    technical: { ...technical, error: 'delta_invalid' }
                };
            }
        });
        
        return processed;
    }
    
    /**
     * Obtém nome de exibição para uma banda
     */
    getBandDisplayName(bandKey) {
        const bandNames = {
            'sub': 'Sub',
            'bass': 'Bass', 
            'low_mid': 'Low Mid',
            'mid': 'Mid',
            'high_mid': 'High Mid',
            'presence': 'Presence',
            'brilliance': 'Brilliance'
        };
        
        return bandNames[bandKey] || bandKey;
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
        log("[AUDITORIA] processAnalysis capturado", {
            analysis,
            referenceData,
            options,
            timestamp: new Date().toISOString()
        });
        
        // Chamar método original sem alterações
        return originalProcessAnalysis.apply(this, arguments);
    };
    
    log('🔍 Hook de auditoria ativado para processAnalysis');
})();

// Instância global do engine
window.EnhancedSuggestionEngine = EnhancedSuggestionEngine;
window.enhancedSuggestionEngine = new EnhancedSuggestionEngine();

log('🎯 Enhanced Suggestion Engine inicializado');
