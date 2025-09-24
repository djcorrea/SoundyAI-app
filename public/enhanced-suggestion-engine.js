// 🎯 SISTEMA PRINCIPAL DE SUGESTÕES MELHORADO
// Integra scoring, heurísticas e referências em um sistema unificado

class EnhancedSuggestionEngine {
    constructor(config = {}) {
        this.scorer = window.suggestionScorer || new SuggestionScorer();
        
        // 🎯 CORREÇÃO: Inicializar AdvancedHeuristicsAnalyzer se não estiver disponível
        this.heuristics = window.heuristicsAnalyzer || this.createInlineHeuristicsAnalyzer();
        
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
        
        // 🎓 Templates educativos para enriquecimento de sugestões
        this.heuristicTemplates = this.createEducationalTemplates();
    }

    /**
     * 📐 Avaliar status com tolerância
     * @returns {{status: 'ideal'|'alto'|'baixo', delta: number}}
     */
    evaluateToleranceStatus(value, target, tolerance) {
        const delta = value - target;
        if (Math.abs(delta) <= tolerance) return { status: 'ideal', delta };
        return { status: delta > tolerance ? 'alto' : 'baixo', delta };
    }

    /**
     * 🔎 Faixas padrão por banda (para textos educativos)
     */
    getBandRangeLabel(band) {
        const ranges = {
            sub: '20–60 Hz',
            bass: '60–150 Hz',
            lowMid: '150–400 Hz',
            mid: '400 Hz – 2 kHz',
            highMid: '2–5 kHz',
            presenca: '3–6 kHz',
            brilho: '8–16 kHz'
        };
        return ranges[band] || '';
    }

    /**
     * 🧩 Construir bloco educativo enriquecido com valores exatos
     */
    buildEducationalBlock({ kind, label, band, value, target, tolerance, delta, status, unit }) {
        const sign = delta >= 0 ? '+' : '';
        const absDelta = Math.abs(delta).toFixed(1);
        const tUnit = unit || '';
        const rangeLabel = band ? this.getBandRangeLabel(band) : '';

        const problem = band
            ? `${band} ${rangeLabel} ${status === 'alto' ? 'muito alto' : 'muito baixo'}: ${sign}${absDelta}${tUnit} vs alvo ${target.toFixed(1)}${tUnit} ±${tolerance.toFixed(1)}${tUnit}`
            : `${label} ${status === 'alto' ? 'alto' : 'baixo'}: ${sign}${absDelta}${tUnit} vs alvo ${target.toFixed(1)}${tUnit} ±${tolerance.toFixed(1)}${tUnit}`;

        // Causas e soluções genéricas por tipo
        let cause = '';
        if (kind === 'metric') {
            if (label === 'LUFS') cause = 'Loudness fora do intervalo ideal pode causar falta de impacto (baixo) ou fadiga/distorção (alto).';
            else if (label === 'True Peak') cause = 'True Peak acima do recomendado aumenta risco de distorção de inter-amostra; abaixo pode indicar headroom excessivo.';
            else if (label === 'DR' || label === 'LRA') cause = 'Desvio de dinâmica impacta a naturalidade e consistência da audição.';
            else if (label === 'Stereo Corr') cause = 'Correlação estéreo fora da faixa ideal afeta mono-compatibilidade ou amplitude percebida.';
            else cause = 'Desvio em relação ao alvo de referência para o gênero.';
        } else {
            cause = status === 'alto'
                ? 'Excesso de energia nessa faixa causa masking e cansaço auditivo.'
                : 'Falta de energia nessa faixa reduz presença e definição.';
        }

        let solution;
        if (kind === 'metric') {
            if (label === 'LUFS') solution = status === 'alto' ? 'Reduza o ganho do limiter/compressor no master até entrar no alvo.' : 'Aumente o ganho/limiter para atingir o alvo de loudness.';
            else if (label === 'True Peak') solution = 'Use limiter com detecção de True Peak e oversampling para manter no alvo.';
            else if (label === 'DR' || label === 'LRA') solution = status === 'alto' ? 'Aplique compressão suave para controlar picos e reduzir variação.' : 'Reduza compressão excessiva, use compressão paralela para recuperar dinâmica.';
            else if (label === 'Stereo Corr') solution = status === 'alto' ? 'Reduza widening e verifique compatibilidade mono.' : 'Aumente largura estéreo com técnicas seguras (M/S, reverb/delay estéreo).';
            else solution = 'Ajuste o parâmetro para ficar dentro do alvo e tolerância.';
        } else {
            // Bandas: sugerir ajuste em dB na faixa
            const direction = delta > 0 ? 'Reduza' : 'Aumente';
            solution = `${direction} cerca de ${absDelta}${tUnit} em ${rangeLabel} com EQ paramétrico para aproximar do alvo.`;
        }

        const tip = 'Compare em diferentes sistemas e use referência A/B do gênero.';
        const plugin = 'Use EQ e compressor nativos da sua DAW ou plugins gratuitos (ReaEQ/Pro-Q3, ReaComp).';
        const result = 'Clareza, balanceamento espectral e compatibilidade de reprodução aprimorados.';

        return { problem, cause, solution, tip, plugin, result };
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
                action: "Use um limiter ou compressor no master e ajuste o ganho até atingir cerca de -8 a -10 LUFS para releases comerciais.",
                dawExample: "Monitore com LUFS Meter no insert final. No Pro Tools: AudioSuite > Loudness Analyzer. No Logic: Multipressor + Adaptive Limiter."
            },
            lufs_too_high: {
                explanation: "Sua faixa está com loudness excessivo, causando fadiga auditiva e possível distorção. Plataformas como Spotify vão reduzir o volume automaticamente.",
                action: "Reduza o ganho do limiter ou compressor principal. Objetivo: -8 a -14 LUFS dependendo do gênero.",
                dawExample: "No master bus: reduza Output Gain do limiter em 2-4 dB. Ableton: reduzir o Gain do Limiter. Cubase: reduzir Output no Maximizer."
            },
            
            // === TRUE PEAK ===
            true_peak_high: {
                explanation: "True Peak alto pode causar distorção digital em conversores D/A e problemas de inter-sample peaks, especialmente em sistemas de reprodução consumer.",
                action: "Use um limiter com oversampling ou true peak limiting para manter abaixo de -1 dBTP.",
                dawExample: "Pro Tools: Pro Limiter com 'ISP' ativado. Logic: Adaptive Limiter com 'True Peak Detection'. Waves: L3 Multimaximizer."
            },
            
            // === DYNAMIC RANGE ===
            dr_low: {
                explanation: "Dynamic Range muito baixo indica que sua música está over-comprimida, perdendo dinâmica natural e groove.",
                action: "Reduza compressão geral, use compressão paralela, e preserve transientes. Objetivo: DR acima de 6-8 para músicas comerciais.",
                dawExample: "Reduzir ratio do compressor master. Crear bus paralelo com compressor pesado (10:1) e misturar sutilmente (20-30%)."
            },
            dr_high: {
                explanation: "Dynamic Range excessivo pode indicar falta de coesão e consistência, dificultando playback em sistemas variados.",
                action: "Use compressão suave para unificar a dinâmica, mantendo a musicalidade. Objetivo: DR entre 8-14 dependendo do gênero.",
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
                    
                    // Análise True Peak
                    if (tech && Number.isFinite(tech.truePeak)) {
                        if (tech.truePeak > -0.5) {
                            detections.push({
                                type: 'heuristic_true_peak',
                                intensity: Math.min(1.0, (tech.truePeak + 0.5) / 2),
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
                
                console.log(`🎯 [HEURISTICS] Análise inline concluída: ${detections.length} detecções`);
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
        // Aceitar formatos aninhados e aliases PT/EN e retornar chaves achatadas *_target / *_tolerance
        try {
            if (!rawRef || typeof rawRef !== 'object') {
                console.warn('🚨 Dados de referência inválidos ou ausentes');
                this.logAudit('NORMALIZE_ERROR', 'Dados de referência inválidos', { rawRef });
                return null;
            }

            this.logAudit('NORMALIZE_START', 'Normalizando dados de referência (flatten)', {
                topLevelKeys: Object.keys(rawRef)
            });

            // Aliases PT/EN e variações de nome
            const ALIASES = {
                lufs:       ['lufs','integrated_lufs','volume_integrado','loudness'],
                true_peak:  ['true_peak','truePeak','dbtp','pico_real','truePeakDbtp'],
                dr:         ['dr','dynamic_range','dinamica'],
                lra:        ['lra','loudness_range','loudnessRange'],
                stereo:     ['stereo','stereo_correlation','correlacao_estereo','correlation'],
                sub:        ['sub','20_60hz','sub_20_60'],
                bass:       ['bass','60_150hz','low_bass','upper_bass'],
                low_mid:    ['low_mid','lowMid','150_500hz'],
                mid:        ['mid','500_2khz'],
                high_mid:   ['high_mid','highMid','2k_5khz'],
                presence:   ['presence','presenca','5k_10khz'],
                air:        ['air','brilho','10k_20khz'],
            };

            // getter seguro para caminhos "a.b.c"
            const getPath = (obj, path) => path.split('.').reduce((o,k)=> (o==null ? undefined : o[k]), obj);

            // tenta várias rotas/nomes até achar um número
            const pickNum = (obj, paths) => {
                for (const p of paths) {
                    const v = p.includes('.') ? getPath(obj,p) : obj?.[p];
                    if (typeof v === 'number' && Number.isFinite(v)) return v;
                }
                return undefined;
            };

            // Facilitar leitura em estruturas alternativas
            const t = rawRef.targets || rawRef;
            const bandsNode = t.bands || rawRef.bands || rawRef.hybrid_processing?.spectral_bands || {};

            const out = {};

            // Defaults seguros (LRA opcional - não definir por padrão)
            const DEF = {
                lufs_tolerance: 2.5,
                true_peak_tolerance: 3,
                dr_tolerance: 3,
                stereo_tolerance: 0.25,
                band_tolerance: 2.5
            };

            // Métricas globais (targets e tolerances)
            for (const key of ['lufs','true_peak','dr','lra','stereo']) {
                const names = ALIASES[key] || [key];
                // buscar target
                out[`${key}_target`] = pickNum(t, [
                    `${key}_target`,
                    ...names.map(n=>`${n}.target`),
                    ...names.map(n=>`${n}.value`),
                    // estruturas conhecidas
                    key,
                    key === 'lufs' ? 'loudness' : undefined,
                    key === 'true_peak' ? 'truePeak' : undefined,
                    key === 'dr' ? 'dynamicRange' : undefined,
                ].filter(Boolean));

                // buscar tolerance (não forçar LRA)
                const tolVal = pickNum(t, [
                    `${key}_tolerance`,
                    ...names.map(n=>`${n}.tol`),
                    ...names.map(n=>`${n}.tolerance`),
                    `tolerances.${key}`
                ]);
                if (tolVal !== undefined) {
                    out[`${key}_tolerance`] = tolVal;
                }
            }

            // Aplicar defaults globais exceto LRA
            out.lufs_tolerance      ??= DEF.lufs_tolerance;
            out.true_peak_tolerance ??= DEF.true_peak_tolerance;
            out.dr_tolerance        ??= DEF.dr_tolerance;
            out.stereo_tolerance    ??= DEF.stereo_tolerance;

            // Bandas (targets e tolerances)
            const bandList = ['sub','bass','low_mid','mid','high_mid','presence','air'];
            const bandsOut = {};
            const bandKeyMap = {
                sub: 'sub',
                bass: 'bass',
                low_mid: 'lowMid',
                mid: 'mid',
                high_mid: 'highMid',
                presence: 'presenca',
                air: 'brilho'
            };

            for (const b of bandList) {
                const names = ALIASES[b] || [b];
                const target = pickNum(bandsNode, [
                    `${b}_target`,
                    ...names.map(n=>`bands.${n}.target`),
                    ...names.map(n=>`${n}.target`),
                    ...names.map(n=>`bands.${n}.target_db`),
                    ...names.map(n=>`${n}.target_db`)
                ]);

                const tol = pickNum(bandsNode, [
                    `${b}_tolerance`,
                    ...names.map(n=>`bands.${n}.tol`),
                    ...names.map(n=>`bands.${n}.tolerance`),
                    ...names.map(n=>`bands.${n}.tol_db`),
                    ...names.map(n=>`${n}.tol`),
                    ...names.map(n=>`${n}.tolerance`),
                    ...names.map(n=>`${n}.tol_db`)
                ]);

                if (typeof target === 'number' && Number.isFinite(target)) {
                    // Chaves achatadas
                    out[`${b}_target`] = target;
                    out[`${b}_tolerance`] = tol ?? DEF.band_tolerance;
                    // Retrocompat: montar bands para consumidores antigos
                    const outName = bandKeyMap[b] || b;
                    bandsOut[outName] = {
                        target_db: target,
                        tol_db: out[`${b}_tolerance`]
                    };
                }
            }

            if (Object.keys(bandsOut).length > 0) {
                out.bands = bandsOut;
            }

            // Verificação: precisa ter pelo menos alguma métrica ou banda
            const hasAny = ['lufs_target','true_peak_target','dr_target','lra_target','stereo_target']
                .some(k => typeof out[k] === 'number') || (out.bands && Object.keys(out.bands).length>0);
            if (!hasAny) {
                this.logAudit('NORMALIZE_WARNING', 'Nenhum alvo/tolerância válido encontrado', { rawRef });
            }

            try { if (console && console.table) console.table(out); } catch(_) {}
            this.logAudit('NORMALIZE_SUCCESS', 'Dados de referência normalizados (flatten)', { keys: Object.keys(out) });
            return out;
        } catch (error) {
            console.error('🚨 Erro ao normalizar dados de referência:', error);
            this.logAudit('REFERENCE_NORMALIZATION_ERROR', 'Falha ao normalizar dados de referência', { error: error.message });
            return null;
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
        
        // 🔍 AUDITORIA: Log da estrutura de entrada para debugging
        this.logAudit('EXTRACT_METRICS_INPUT', 'Estrutura de análise recebida', {
            hasTechnicalData: !!tech,
            technicalDataKeys: Object.keys(tech),
            hasBandEnergies: !!tech.bandEnergies,
            bandKeys: Object.keys(tech.bandEnergies || {})
        });

        // Métricas principais com múltiplos aliases para compatibilidade
        // LUFS
        const lufsValue = tech.lufsIntegrated || tech.lufs_integrated || tech.lufs || tech.loudness;
        if (Number.isFinite(lufsValue)) {
            metrics.lufs = lufsValue;
            this.logAudit('METRIC_EXTRACTED', 'LUFS extraído', { value: lufsValue, source: 'lufsIntegrated' });
        }

        // True Peak
        const truePeakValue = tech.truePeakDbtp || tech.true_peak_dbtp || tech.truePeak || tech.true_peak;
        if (Number.isFinite(truePeakValue)) {
            metrics.true_peak = truePeakValue;
            this.logAudit('METRIC_EXTRACTED', 'True Peak extraído', { value: truePeakValue, source: 'truePeakDbtp' });
        }

        // Dynamic Range
        const drValue = tech.dynamicRange || tech.dynamic_range || tech.dr;
        if (Number.isFinite(drValue)) {
            metrics.dr = drValue;
            this.logAudit('METRIC_EXTRACTED', 'DR extraído', { value: drValue, source: 'dynamicRange' });
        }

        // LRA - BUSCAR EM MÚLTIPLOS ALIASES E ESTRUTURAS
        let lraValue = null;
        
        // 1. Buscar diretamente em technicalData
        const lraSources = ['lra', 'loudness_range', 'loudnessRange', 'lra_tolerance'];
        for (const source of lraSources) {
            if (Number.isFinite(tech[source])) {
                lraValue = tech[source];
                this.logAudit('METRIC_EXTRACTED', `LRA extraído via technicalData.${source}`, { value: lraValue, source });
                break;
            }
        }
        
        // 2. Buscar em analysis.metrics se disponível
        if (!lraValue && analysis.metrics) {
            for (const source of lraSources) {
                if (Number.isFinite(analysis.metrics[source])) {
                    lraValue = analysis.metrics[source];
                    this.logAudit('METRIC_EXTRACTED', `LRA extraído via analysis.metrics.${source}`, { value: lraValue, source });
                    break;
                }
            }
        }
        
        // 3. Buscar em estruturas aninhadas (loudness.lra)
        if (!lraValue && analysis.loudness && Number.isFinite(analysis.loudness.lra)) {
            lraValue = analysis.loudness.lra;
            this.logAudit('METRIC_EXTRACTED', 'LRA extraído via analysis.loudness.lra', { value: lraValue, source: 'loudness.lra' });
        }
        
        if (lraValue !== null) {
            metrics.lra = lraValue;
            this.logAudit('METRIC_EXTRACTED', 'LRA extraído com sucesso', { value: lraValue });
        } else {
            this.logAudit('METRIC_MISSING', 'LRA não encontrado em nenhuma estrutura', { 
                checked: [...lraSources, 'analysis.metrics.*', 'analysis.loudness.lra'],
                availableKeys: Object.keys(tech),
                hasAnalysisMetrics: !!analysis.metrics,
                hasLoudnessData: !!analysis.loudness
            });
        }

        // Stereo Correlation
        const stereoValue = tech.stereoCorrelation || tech.stereo_correlation || tech.stereo;
        if (Number.isFinite(stereoValue)) {
            metrics.stereo = stereoValue;
            this.logAudit('METRIC_EXTRACTED', 'Stereo extraído', { value: stereoValue, source: 'stereoCorrelation' });
        }
        
        // Bandas espectrais - normalização completa com múltiplas fontes
        let bandEnergies = {};
        
        // 1. Buscar em technicalData com múltiplos aliases
        const bandSources = [
            tech.bandEnergies, 
            tech.band_energies, 
            tech.spectralBands, 
            tech.spectral_bands, 
            tech.spectral_balance
        ];
        
        // 2. Buscar também em analysis.metrics se disponível
        if (analysis.metrics) {
            bandSources.push(
                analysis.metrics.bandEnergies,
                analysis.metrics.band_energies,
                analysis.metrics.spectral_balance,
                analysis.metrics.bands
            );
        }
        
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
            // Encontrar nome normalizado
            const normalizedBandName = bandMappings[sourceBand] || sourceBand;
            
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
            { key: 'lufs', target: 'lufs_target', tol: 'lufs_tolerance' },
            { key: 'true_peak', target: 'true_peak_target', tol: 'true_peak_tolerance' },
            { key: 'dr', target: 'dr_target', tol: 'dr_tolerance' },
            { key: 'lra', target: 'lra_target', tol: 'lra_tolerance' },
            { key: 'stereo', target: 'stereo_target', tol: 'stereo_tolerance' }
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
                const target = refData?.target_db;
                const tol = refData?.tol_db;
                if (Number.isFinite(metrics[band]) && Number.isFinite(target) && Number.isFinite(tol)) {
                    zScores[band + '_z'] = this.scorer.calculateZScore(metrics[band], target, tol);
                }
            }
        } else {
            // Fallback: usar chaves achatadas sub_target/sub_tolerance etc.
            const bandKeys = ['sub','bass','lowMid','mid','highMid','presenca','brilho'];
            for (const band of bandKeys) {
                const flatKey = band.replace('lowMid','low_mid').replace('highMid','high_mid').replace('presenca','presence').replace('brilho','air');
                const target = referenceData[`${flatKey}_target`];
                const tol = referenceData[`${flatKey}_tolerance`];
                if (Number.isFinite(metrics[band]) && Number.isFinite(target) && Number.isFinite(tol)) {
                    zScores[band + '_z'] = this.scorer.calculateZScore(metrics[band], target, tol);
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
        
        // Sugestões para métricas principais
        const mainMetrics = [
            { 
                key: 'lufs', 
                target: 'lufs_target', 
                tol: 'lufs_tolerance', 
                type: 'reference_loudness',
                metricType: 'lufs',
                unit: '',
                label: 'LUFS'
            },
            { 
                key: 'true_peak', 
                target: 'true_peak_target', 
                tol: 'true_peak_tolerance',
                type: 'reference_true_peak',
                metricType: 'true_peak', 
                unit: ' dBTP',
                label: 'True Peak'
            },
            { 
                key: 'dr', 
                target: 'dr_target', 
                tol: 'dr_tolerance',
                type: 'reference_dynamics',
                metricType: 'dr',
                unit: ' dB',
                label: 'DR'
            },
            { 
                key: 'lra', 
                target: 'lra_target', 
                tol: 'lra_tolerance',
                type: 'reference_lra',
                metricType: 'lra',
                unit: ' dB',
                label: 'LRA'
            },
            { 
                key: 'stereo', 
                target: 'stereo_target', 
                tol: 'stereo_tolerance',
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
            
            this.logAudit('METRIC_VALIDATION', `Validando métrica: ${metric.key}`, {
                metricKey: metric.key,
                hasValue: value !== undefined,
                value: value,
                hasTarget: target !== undefined,
                target: target,
                hasTolerance: tolerance !== undefined,
                tolerance: tolerance,
                zScore: zScores[metric.key]
            });
            
            // 🔍 z-score tem sufixo '_z' nas chaves
            const zScore = zScores[metric.key + '_z'];
            
            this.logAudit('ZSCORE_LOOKUP', `Z-Score lookup para ${metric.key}`, {
                metricKey: metric.key,
                searchKey: metric.key + '_z',
                zScore: zScore,
                allZScores: Object.keys(zScores)
            });
            
            if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance)) continue;

            // 📐 NOVO: Status por tolerância
            const { status, delta } = this.evaluateToleranceStatus(value, target, tolerance);
            if (status === 'ideal') {
                this.logAudit('METRIC_IDEAL', `${metric.label} dentro da tolerância`, {
                    metric: metric.key, value, target, tolerance, delta
                });
                continue; // não gera sugestão
            }

            const severity = this.scorer.getSeverity(zScore);
            const shouldInclude = true; // fora da tolerância sempre gera
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
                
                // 🎯 GARANTIR CAMPOS OBRIGATÓRIOS PARA MÉTRICAS PRINCIPAIS (incluindo LRA)
                suggestion.icon = this.getMetricIcon(metric.metricType);
                suggestion.targetValue = target;
                suggestion.currentValue = value;

                // 🧩 Enriquecer mensagens com valores e tolerância
                const block = this.buildEducationalBlock({
                    kind: 'metric', label: metric.label, value, target, tolerance, delta, status, unit: metric.unit
                });
                suggestion.blocks = block;
                suggestion.message = block.problem;
                suggestion.action = block.solution;
                suggestion.why = block.cause;
                
                // Se fields estão vazios, preencher com valores padrão
                if (!suggestion.message || suggestion.message.trim() === '') {
                    suggestion.message = `Ajustar ${metric.label} para alinhamento com referência`;
                }
                if (!suggestion.why || suggestion.why.trim() === '') {
                    suggestion.why = `${metric.label} fora da faixa ideal para o gênero`;
                }
                
                suggestions.push(suggestion);
                
                this.logAudit('REFERENCE_SUGGESTION', `Sugestão gerada: ${metric.label}`, {
                    value: +value.toFixed(2),
                    target: +target.toFixed(2),
                    delta: +delta.toFixed(2),
                    zScore: +zScore.toFixed(2),
                    severity: severity.level,
                    priority: +priority.toFixed(3),
                    dependencyBonus
                });
            }
        }
        
        // Sugestões para bandas espectrais
        if (referenceData.bands) {
            this.logAudit('BANDS_REFERENCE_CHECK', 'Bandas de referência disponíveis', {
                referenceBands: Object.keys(referenceData.bands),
                metricsAvailable: Object.keys(metrics).filter(k => !['lufs', 'true_peak', 'dr', 'lra', 'stereo'].includes(k))
            });

            for (const [band, refData] of Object.entries(referenceData.bands)) {
                const value = metrics[band];
                const target = refData.target_db;
                const tolerance = refData.tol_db;
                const zScore = zScores[band + '_z'];
                
                this.logAudit('BAND_SUGGESTION_CHECK', `Verificando banda: ${band}`, {
                    band,
                    hasValue: Number.isFinite(value),
                    value,
                    hasTarget: Number.isFinite(target), 
                    target,
                    hasTolerance: Number.isFinite(tolerance),
                    tolerance,
                    hasZScore: Number.isFinite(zScore),
                    zScore
                });
                
                if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance)) {
                    this.logAudit('BAND_SUGGESTION_SKIPPED', `Banda ignorada por valores inválidos: ${band}`, {
                        band,
                        value,
                        target,
                        tolerance,
                        reason: !Number.isFinite(value) ? 'value_invalid' : 
                               !Number.isFinite(target) ? 'target_invalid' : 'tolerance_invalid'
                    });
                    continue;
                }
                
                // 📐 NOVO: Status por tolerância
                const { status, delta } = this.evaluateToleranceStatus(value, target, tolerance);
                if (status === 'ideal') {
                    this.logAudit('BAND_IDEAL', `Banda dentro da tolerância: ${band}`, { band, value, target, tolerance, delta });
                    continue;
                }

                const severity = this.scorer.getSeverity(zScore);

                const shouldInclude = true; // fora da tolerância sempre gera
                this.logAudit('BAND_SEVERITY_CHECK', `Severidade da banda: ${band}`, {
                    band,
                    severity: severity.level,
                    shouldInclude,
                    includeYellow: this.config.includeYellowSeverity,
                    zScore
                });
                
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
                    
                    // 🎯 GARANTIR CAMPOS OBRIGATÓRIOS PARA SUGESTÕES DE BANDA
                    suggestion.icon = '🎵';  // Ícone obrigatório para bandas
                    suggestion.targetValue = target;
                    suggestion.currentValue = value;

                    // 🧩 Enriquecer mensagens com valores e tolerância
                    const block = this.buildEducationalBlock({
                        kind: 'band', band, value, target, tolerance, delta, status, unit: ' dB'
                    });
                    suggestion.blocks = block;
                    suggestion.message = block.problem;
                    suggestion.action = block.solution;
                    suggestion.why = block.cause;
                    
                    // Garantir campos de texto obrigatórios
                    if (!suggestion.message || suggestion.message.trim() === '') {
                        suggestion.message = `Ajustar ${band} para alinhamento com referência`;
                    }
                    if (!suggestion.why || suggestion.why.trim() === '') {
                        suggestion.why = `Banda ${band} fora da faixa ideal para o gênero`;
                    }
                    
                    // 🎯 APLICAR LÓGICA SEGURA PARA ACTION E DIAGNOSIS
                    // Diagnóstico com valores
                    const amount = Math.abs(delta).toFixed(1);
                    const direction = delta > 0 ? 'Reduzir' : 'Aumentar';
                    suggestion.diagnosis = `Atual: ${value.toFixed(1)} dB, Alvo: ${target.toFixed(1)} dB, Tolerância: ±${tolerance.toFixed(1)} dB, Diferença: ${amount} dB (${direction})`;
                    
                    suggestions.push(suggestion);
                    
                    this.logAudit('BAND_SUGGESTION', `Sugestão de banda: ${band}`, {
                        value: +value.toFixed(2),
                        target: +target.toFixed(2),
                        delta: +delta.toFixed(2),
                        zScore: +zScore.toFixed(2),
                        severity: severity.level,
                        priority: +priority.toFixed(3)
                    });
                }
            }
        } else {
            // Fallback: usar estrutura achatada *_target/*_tolerance
            const flatToDisplay = {
                sub: 'sub', bass: 'bass', low_mid: 'lowMid', mid: 'mid', high_mid: 'highMid', presence: 'presenca', air: 'brilho'
            };
            for (const [flatKey, displayKey] of Object.entries(flatToDisplay)) {
                const value = metrics[displayKey];
                const target = referenceData[`${flatKey}_target`];
                const tolerance = referenceData[`${flatKey}_tolerance`];
                const zScore = zScores[displayKey + '_z'];

                if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance)) continue;

                const { status, delta } = this.evaluateToleranceStatus(value, target, tolerance);
                if (status === 'ideal') continue;

                const severity = this.scorer.getSeverity(zScore);
                const dependencyBonus = dependencyBonuses[displayKey] || 0;
                const priority = this.scorer.calculatePriority({ metricType: 'band', severity, confidence, dependencyBonus });

                const suggestion = this.scorer.generateSuggestion({
                    type: 'band_adjust',
                    subtype: displayKey,
                    value,
                    target,
                    tolerance,
                    zScore,
                    severity,
                    priority,
                    confidence,
                    genre: window.PROD_AI_REF_GENRE || 'unknown',
                    metricType: 'band',
                    band: displayKey
                });

                suggestion.icon = '🎵';
                suggestion.targetValue = target;
                suggestion.currentValue = value;

                const block = this.buildEducationalBlock({ kind: 'band', band: displayKey, value, target, tolerance, delta, status, unit: ' dB' });
                suggestion.blocks = block;
                suggestion.message = block.problem;
                suggestion.action = block.solution;
                suggestion.why = block.cause;

                const amount = Math.abs(delta).toFixed(1);
                const direction = delta > 0 ? 'Reduzir' : 'Aumentar';
                suggestion.diagnosis = `Atual: ${value.toFixed(1)} dB, Alvo: ${target.toFixed(1)} dB, Tolerância: ±${tolerance.toFixed(1)} dB, Diferença: ${amount} dB (${direction})`;

                suggestions.push(suggestion);
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
                        const suggestionDelta = suggestion.technical?.delta;
                        if (typeof suggestionDelta === "number" && !isNaN(suggestionDelta)) {
                            const direction = suggestionDelta > 0 ? "Reduzir" : "Aumentar";
                            const amount = Math.abs(suggestionDelta).toFixed(1);
                            suggestion.action = `${direction} ${item.metric} em ${amount} dB`;
                            suggestion.diagnosis = `Atual: ${value.toFixed(1)} dB, Alvo: ${ideal.toFixed(1)} dB, Diferença: ${amount} dB`;
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
                console.warn('🚨 Heuristics analyzer não disponível - pulando análise heurística');
                return [];
            }
            
            console.log('🎯 [HEURISTICS] Heuristics analyzer ativado com sucesso');
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
        
        console.log(`🎯 [HEURISTICS] ${enrichmentCount} enriquecimentos aplicados`);
        
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
            console.warn('🚨 [EDUCATIONAL] Sugestões inválidas recebidas para enriquecimento');
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
                console.warn('🚨 [EDUCATIONAL] Erro ao enriquecer sugestão:', error, suggestion);
                return suggestion; // Retornar sugestão original em caso de erro
            }
        });

        console.log(`🎓 [EDUCATIONAL] Enriquecimento universal aplicado: ${enrichmentCount}/${suggestions.length} sugestões enriquecidas`);
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

        // Mapeamento direto por tipo principal
        const directMapping = {
            'reference_loudness': 'lufs_too_low',
            'reference_true_peak': 'true_peak_high', 
            'reference_lra': 'lra_too_low',
            'reference_dynamics': 'dr_low',
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

        // Mapeamento por metricType para sugestões de referência
        if (type.startsWith('reference_')) {
            const metricMapping = {
                'lufs': 'lufs_too_low',
                'true_peak': 'true_peak_high',
                'lra': 'lra_too_low', 
                'dr': 'dr_low',
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
            if (!technical || !Number.isFinite(technical.value) || !Number.isFinite(technical.target)) {
                return suggestion;
            }
            
            // 🎯 CORREÇÃO: Usar let em vez de const para delta que pode ser reatribuído
            let delta = technical.target - technical.value;
            
            // 🎯 LÓGICA SEGURA: Aplicar critério solicitado
            if (typeof delta === "number" && !isNaN(delta)) {
                // Garantir que technical.delta está presente
                technical.delta = delta;
                
                // Verificar se o action contém valores fixos problemáticos
                const currentAction = suggestion.action || '';
                const hasFixedValues = /\b(?:6\.0|4\.0)\s*dB\b/.test(currentAction);
                
                if (!hasFixedValues) {
                    // Action já correto, apenas garantir que technical.delta está presente
                    return { ...suggestion, technical: { ...technical, delta } };
                }
                
                // 🎯 APLICAR LÓGICA SEGURA SOLICITADA
                const direction = delta > 0 ? "Reduzir" : "Aumentar";
                const amount = Math.abs(delta).toFixed(1);
                const bandName = this.getBandDisplayName(suggestion.subtype);
                
                // 🎯 NÃO REATRIBUIR OBJETO - APENAS ATUALIZAR PROPRIEDADES
                suggestion.action = `${direction} ${bandName} em ${amount} dB`;
                suggestion.diagnosis = `Atual: ${technical.value} dB, Alvo: ${technical.target} dB, Diferença: ${amount} dB`;
                
                this.logAudit('ACTION_CORRECTED', `Action corrigido para banda ${suggestion.subtype}`, {
                    band: suggestion.subtype,
                    oldAction: currentAction,
                    newAction: suggestion.action,
                    value: technical.value,
                    target: technical.target,
                    delta: delta,
                    source: 'postProcessBandSuggestions'
                });
                
                return {
                    ...suggestion,
                    technical: { ...technical, delta }
                };
            } else {
                // 🎯 SE DELTA NÃO EXISTIR, NÃO GERAR ACTION
                suggestion.action = null;
                suggestion.diagnosis = null;
                return suggestion;
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
