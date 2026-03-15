// 🎓 SISTEMA DE SUGESTÕES EDUCATIVO ULTRA-AVANÇADO
// O melhor sistema de sugestões do planeta - educativo, intuitivo e contextual

class AdvancedEducationalSuggestionSystem {
    constructor() {
        console.log('🎓 [EDUCATIVO] Inicializando Sistema de Sugestões Ultra-Avançado...');
        
        // 📚 Base de conhecimento educativo
        this.educationalDatabase = this.createEducationalDatabase();
        
        // 🎯 Contextos musicais inteligentes
        this.musicalContexts = this.createMusicalContexts();
        
        // 🔧 Templates de soluções práticas
        this.solutionTemplates = this.createSolutionTemplates();
        
        // 🎵 Características por gênero
        this.genreCharacteristics = this.createGenreCharacteristics();
        
        // 🏆 Sistema de priorização inteligente
        this.priorityMatrix = this.createPriorityMatrix();
        
        // 📊 Histórico e aprendizado
        this.learningSystem = {
            userPatterns: new Map(),
            effectivenessHistory: new Map(),
            preferenceWeights: this.getDefaultPreferences()
        };
        
        console.log('✅ [EDUCATIVO] Sistema Ultra-Avançado carregado com sucesso!');
    }

    /**
     * 📚 Criar base de conhecimento educativo
     */
    createEducationalDatabase() {
        return {
            // === MÉTRICAS FUNDAMENTAIS ===
            lufs: {
                concept: "LUFS (Loudness Units relative to Full Scale)",
                explanation: "Medida padrão de loudness percebido que considera como nosso ouvido realmente processa o som. Diferente do RMS ou peak, LUFS imita a sensibilidade auditiva humana.",
                importance: "Essencial para compatibilidade com plataformas de streaming (Spotify, Apple Music, YouTube) que normalizam automaticamente o volume.",
                ranges: {
                    streaming: "-14 LUFS (Spotify, YouTube)",
                    commercial: "-8 a -10 LUFS (CDs, download)",
                    broadcast: "-23 LUFS (TV/Rádio)",
                    cinematic: "-27 LUFS (filmes)"
                },
                consequences: {
                    tooLow: "Falta de competitividade comercial, impacto reduzido, perda de energia",
                    tooHigh: "Fadiga auditiva, compressão automática pelas plataformas, perda de dinâmica"
                },
                solutions: {
                    increase: "Compressor multibanda + Limiter, automação de ganho, saturação harmônica",
                    decrease: "Reduzir gain staging, menos compressão, mais headroom"
                },
                dawExamples: {
                    proTools: "Pro Limiter com LUFS meter, Insight 2 para monitoramento",
                    logic: "Adaptive Limiter + ChromaVerb para densidade, Level Meter para LUFS",
                    ableton: "Limiter + Utility para gain staging, external LUFS plugins",
                    cubase: "Maximizer + Control Room para monitoring, Multipressor para controle"
                }
            },

            truePeak: {
                concept: "True Peak (Inter-sample Peaks)",
                explanation: "Picos que ocorrem entre as amostras digitais durante a conversão D/A. Não aparecem no medidor digital comum, mas causam distorção real nos conversores.",
                importance: "Evita distorção audível em sistemas de reprodução consumer e problemas de codificação em streaming.",
                ranges: {
                    safe: "-1.0 dBTP ou menor",
                    conservative: "-2.0 dBTP (para segurança extra)",
                    broadcast: "-3.0 dBTP (requisito técnico)"
                },
                consequences: {
                    tooHigh: "Distorção em DACs consumer, artefatos de codificação MP3/AAC, problemas em rádio"
                },
                solutions: {
                    control: "Limiter com oversampling, True Peak limiting, ISP detection"
                },
                dawExamples: {
                    proTools: "Pro Limiter com ISP button ativo",
                    logic: "Adaptive Limiter com True Peak Detection",
                    ableton: "Limiter com oversampling 4x",
                    universal: "Waves L3, FabFilter Pro-L 2, Ozone Maximizer"
                }
            },

            lra: {
                concept: "LRA (Loudness Range)",
                explanation: "Mede a variação dinâmica da música, excluindo os 10% mais silenciosos e 5% mais altos. Indica se a música mantém interesse dinâmico ou está over-comprimida.",
                importance: "Preserva a musicalidade e evita fadiga auditiva. Músicas com LRA muito baixo soam 'mortas' e cansativas.",
                ranges: {
                    ideal: "4-14 LU (dependendo do gênero)",
                    electronic: "2-6 LU (aceitável)",
                    rock: "6-12 LU (dinâmico)",
                    classical: "15-30 LU (muito dinâmico)"
                },
                consequences: {
                    tooLow: "Over-compression, fadiga auditiva, perda do groove natural",
                    tooHigh: "Inconsistência em diferentes sistemas, problemas em ambientes ruidosos"
                },
                solutions: {
                    increase: "Menos compressão global, compressão paralela, preservar transientes",
                    decrease: "Compressão suave, leveling entre seções, automação de volume"
                }
            },

            dynamicRange: {
                concept: "Dynamic Range (DR)",
                explanation: "Diferença entre os picos e o nível médio da música. Indica o quão 'comprimida' está a dinâmica da faixa.",
                importance: "Preserva a naturalidade musical e o impacto dos transientes (bateria, ataques de instrumentos).",
                ranges: {
                    excellent: "DR14+ (audiófilo)",
                    good: "DR10-13 (balanceado)",
                    acceptable: "DR7-9 (comercial)",
                    poor: "DR6 ou menos (over-compressed)"
                },
                relationship: "Relacionado ao LRA, mas medido diferentemente. DR foca em peaks vs RMS."
            },

            // === BANDAS ESPECTRAIS ===
            spectralBands: {
                sub: {
                    range: "20-60 Hz",
                    function: "Fundação física da música, impacto corporal",
                    problems: "Excesso causa 'lama', falta reduz impacto",
                    solutions: "High-pass instruments acima de 60Hz, side-chain compression",
                    context: "Sentido mais que ouvido, especialmente importante em sistemas com subwoofer"
                },
                bass: {
                    range: "60-150 Hz",
                    function: "Fundamental dos graves, peso musical",
                    problems: "Excesso causa masking, falta reduz groove",
                    solutions: "EQ complementar bass/kick, compressão controlada",
                    context: "Área crítica para groove e peso musical"
                },
                lowMid: {
                    range: "150-800 Hz",
                    function: "Corpo dos instrumentos, warmth",
                    problems: "Excesso causa 'lama', falta reduz corpo",
                    solutions: "Notch EQ em frequências problemáticas, compressão multibanda",
                    context: "Onde mora o 'corpo' da maioria dos instrumentos"
                },
                mid: {
                    range: "800-3000 Hz",
                    function: "Presença vocal, definição de instrumentos",
                    problems: "Excesso causa fadiga, falta reduz clareza",
                    solutions: "EQ suave, de-esser para vocais",
                    context: "Área mais sensível do ouvido humano"
                },
                highMid: {
                    range: "3-6 kHz",
                    function: "Presença e clareza",
                    problems: "Excesso causa agressividade, falta reduz definição",
                    solutions: "EQ dinâmico, compressão multibanda seletiva",
                    context: "Crítico para clareza vocal e inteligibilidade"
                },
                presenca: {
                    range: "6-12 kHz",
                    function: "Presença e brilho",
                    problems: "Excesso causa sibilância, falta reduz brilho",
                    solutions: "De-esser, EQ suave, saturação harmônica",
                    context: "Adiciona 'ar' e presença à música"
                },
                brilho: {
                    range: "12-20 kHz",
                    function: "Ar e espacialidade",
                    problems: "Excesso causa fadiga, falta reduz abertura",
                    solutions: "Harmonic excitement, EQ suave, reverb de qualidade",
                    context: "Contribui para sensação de 'abertura' e qualidade hi-fi"
                }
            }
        };
    }

    /**
     * 🎵 Criar contextos musicais inteligentes
     */
    createMusicalContexts() {
        return {
            electronic: {
                characteristics: "Dinâmica controlada, sub bass presente, transientes precisos",
                lufsTarget: -8,
                lraRange: [2, 6],
                spectralFocus: ["sub", "bass", "presenca"],
                commonIssues: ["masking nos graves", "harshness nos highs", "over-compression"]
            },
            rock: {
                characteristics: "Dinâmica moderada, midrange pronunciado, punch em transientes",
                lufsTarget: -10,
                lraRange: [6, 12],
                spectralFocus: ["lowMid", "mid", "highMid"],
                commonIssues: ["guitar masking", "vocal harshness", "drummer competition"]
            },
            pop: {
                characteristics: "Loudness competitivo, vocal clareza, groove consistente",
                lufsTarget: -9,
                lraRange: [4, 8],
                spectralFocus: ["mid", "highMid", "presenca"],
                commonIssues: ["vocal sibilance", "bass competition", "mid congestion"]
            },
            hiphop: {
                characteristics: "Sub bass dominante, vocal presença, kick punch",
                lufsTarget: -8,
                lraRange: [3, 7],
                spectralFocus: ["sub", "bass", "mid"],
                commonIssues: ["sub/kick competition", "vocal masking", "hi-hat harshness"]
            },
            jazz: {
                characteristics: "Dinâmica preservada, espacialidade, naturalidade tonal",
                lufsTarget: -12,
                lraRange: [8, 16],
                spectralFocus: ["lowMid", "mid", "brilho"],
                commonIssues: ["over-compression", "unnatural reverb", "frequency imbalance"]
            },
            classical: {
                characteristics: "Máxima dinâmica, espacialidade natural, tonal accuracy",
                lufsTarget: -18,
                lraRange: [15, 30],
                spectralFocus: ["mid", "highMid", "brilho"],
                commonIssues: ["dynamic compression", "artificial enhancement", "phase issues"]
            }
        };
    }

    /**
     * 🔧 Criar templates de soluções práticas
     */
    createSolutionTemplates() {
        return {
            // === LOUDNESS SOLUTIONS ===
            increaseLoudness: {
                title: "Aumentar Loudness Competitivo",
                steps: [
                    "1. 📊 Analisar espectro atual - identificar áreas com excesso de energia",
                    "2. 🔧 EQ subtrativo - remover frequências desnecessárias (low-cut, notch problemáticos)",
                    "3. 🗜️ Compressão serial - 2-3 compressores suaves (2:1, attack médio)",
                    "4. 🚀 Saturação harmônica - adicionar densidade sem aumentar picos",
                    "5. 🧱 Limiter final - ceiling em -1dBTP, release rápido para transparência"
                ],
                dawSpecific: {
                    proTools: "Pro Compressor → Pro Saturate → Pro Limiter",
                    logic: "VCA → Tape → Adaptive Limiter",
                    ableton: "Compressor → Saturator → Limiter",
                    cubase: "VintageVCA → Magneto → Maximizer"
                },
                warnings: [
                    "⚠️ Não force limiter além de 3-4dB de redução",
                    "⚠️ Monitore True Peak constantemente",
                    "⚠️ Compare com referências em volume matchado"
                ]
            },

            reduceLoudness: {
                title: "Reduzir Loudness Excessivo",
                steps: [
                    "1. 📉 Baixar gain geral - reduzir volume antes do limiter",
                    "2. 🗜️ Menos compressão - reduzir ratio e aumentar threshold",
                    "3. 📊 Mais headroom - criar espaço para dinâmica natural",
                    "4. 🎚️ Automação sutil - controlar níveis sem compressão excessiva"
                ],
                philosophy: "Menos é mais - deixe a música respirar",
                benefits: ["Menos fadiga auditiva", "Mais musicalidade", "Melhor tradução em diferentes sistemas"]
            },

            // === SPECTRAL SOLUTIONS ===
            reduceHarshness: {
                title: "Eliminar Agressividade (3-6 kHz)",
                steps: [
                    "1. 🔍 Identificar frequência exata - usar EQ com Q alto para sweep",
                    "2. 🎯 EQ dinâmico - corte que atua apenas nos picos problemáticos",
                    "3. 🗜️ Compressor multibanda - controlar apenas essa faixa",
                    "4. 🎵 Alternativa: saturação suave para arredondar transientes"
                ],
                frequencies: ["3.5-4.5 kHz (vocal harshness)", "5-6 kHz (cymbal harshness)", "2.5-3 kHz (guitar aggression)"],
                tools: ["FabFilter Pro-Q3 dynamic", "Waves C6 multiband", "Plugin Alliance dynamic EQs"]
            },

            reduceSibilance: {
                title: "Controlar Sibilância (6-9 kHz)",
                steps: [
                    "1. 🎙️ De-esser dedicado - ferramenta específica para sibilantes",
                    "2. 🎯 EQ dinâmico em 7.5 kHz - corte suave apenas quando necessário",
                    "3. 🗜️ Compressor com side-chain filtered - triggering apenas nas sibilantes",
                    "4. 📦 Verificar em diferentes monitores - headphones revelam sibilância oculta"
                ],
                settings: {
                    deEsser: "Frequência: 7-8 kHz, Threshold suave, Release rápido",
                    dynamicEQ: "Q: 2-3, Corte: -2 a -4 dB quando ativo"
                }
            },

            // === DYNAMIC SOLUTIONS ===
            increaseDynamics: {
                title: "Recuperar Dinâmica Natural",
                steps: [
                    "1. 🗜️ Reduzir compressão global - aumentar threshold, reduzir ratio",
                    "2. 🔄 Compressão paralela - misturar sinal comprimido com natural",
                    "3. 🥁 Preservar transientes - attack lento em compressores",
                    "4. 📈 Automação manual - controlar dinâmica sem compressão"
                ],
                philosophy: "Dinâmica = vida musical. Compressão deve servir a música, não dominá-la.",
                techniques: ["New York compression", "Serial compression", "Transient shaping"]
            },

            controlDynamics: {
                title: "Controlar Dinâmica Excessiva",
                steps: [
                    "1. 🎚️ Leveling suave - automação de volume entre seções",
                    "2. 🗜️ Compressão gentil - ratio baixo (2:1), attack/release musical",
                    "3. 🎵 Compressor multibanda - controlar apenas frequências problemáticas",
                    "4. 📊 Verificar em sistemas limitados - car audio, phone speakers"
                ],
                balance: "Manter interesse musical enquanto garante consistência"
            }
        };
    }

    /**
     * 🎵 Criar características por gênero
     */
    createGenreCharacteristics() {
        return {
            electronic: {
                identity: "Precisão digital, impacto físico, clareza sintética",
                spectralProfile: {
                    sub: "Essencial - fundação física",
                    bass: "Controlado - definição sem lama",
                    mid: "Limpo - clareza de elementos",
                    high: "Brilhante - presença digital"
                },
                dynamicProfile: "Controlada mas com impacto",
                referenceArtists: ["Daft Punk", "Deadmau5", "Justice", "Flume"],
                commonTools: ["Compressão side-chain", "Síntese FM", "Reverb espacial"]
            },
            
            rock: {
                identity: "Energia orgânica, punch instrumental, presença vocal",
                spectralProfile: {
                    lowMid: "Rico - corpo de guitarras",
                    mid: "Presente - vocal/lead guitar",
                    highMid: "Agressivo controlado - presença"
                },
                dynamicProfile: "Moderada - preservar punch",
                referenceArtists: ["Queen", "Foo Fighters", "Muse", "Arctic Monkeys"],
                commonTools: ["Amp simulation", "Tape compression", "Parallel processing"]
            },

            pop: {
                identity: "Clareza vocal, groove consistente, apelo comercial",
                spectralProfile: {
                    mid: "Vocal clarity prioritária",
                    highMid: "Presença sem agressividade",
                    presenca: "Brilho controlado"
                },
                dynamicProfile: "Comercial - consistente mas musical",
                referenceArtists: ["Taylor Swift", "The Weeknd", "Dua Lipa", "Bruno Mars"],
                commonTools: ["Vocal tuning", "Bus compression", "Stereo widening"]
            }
        };
    }

    /**
     * 🏆 Criar matriz de priorização inteligente
     */
    createPriorityMatrix() {
        return {
            // Criticidade por tipo de problema
            severity: {
                critical: {
                    weight: 1.0,
                    issues: ["clipping", "distorção audível", "phase cancellation"],
                    urgency: "Corrigir imediatamente - afeta reprodução básica"
                },
                important: {
                    weight: 0.8,
                    issues: ["true peak alto", "harshness severo", "masking grave"],
                    urgency: "Prioridade alta - afeta qualidade percebida"
                },
                moderate: {
                    weight: 0.6,
                    issues: ["loudness competition", "spectral imbalance", "dynamics"],
                    urgency: "Melhorar para competitividade"
                },
                enhancement: {
                    weight: 0.4,
                    issues: ["stereo field", "harmonic content", "micro-dynamics"],
                    urgency: "Refinamentos para excelência"
                }
            },

            // Impacto por contexto de uso
            context: {
                streaming: {
                    priorities: ["lufs", "true_peak", "lra"],
                    weight: 1.0,
                    note: "Compatibilidade com algoritmos de normalização"
                },
                radio: {
                    priorities: ["loudness", "spectral_balance", "dynamics"],
                    weight: 0.9,
                    note: "Competir em ambiente de alta compressão"
                },
                vinyl: {
                    priorities: ["low_end", "dynamics", "stereo_correlation"],
                    weight: 0.7,
                    note: "Limitações físicas do meio"
                },
                audiophile: {
                    priorities: ["dynamics", "spectral_accuracy", "stereo_field"],
                    weight: 0.8,
                    note: "Máxima qualidade técnica"
                }
            }
        };
    }

    /**
     * 🎯 Método principal: analisar e gerar sugestões educativas
     */
    generateAdvancedSuggestions(analysis, referenceData, userPreferences = {}) {
        console.log('🎓 [EDUCATIVO] Iniciando análise avançada...');
        
        const startTime = Date.now();
        
        try {
            // 1. Análise contextual inteligente
            const context = this.analyzeMusicalContext(analysis, referenceData);
            console.log('🎵 [CONTEXTO]', context);

            // 2. Detecção de problemas com priorização
            const issues = this.detectIssuesWithPriority(analysis, referenceData, context);
            console.log('🔍 [PROBLEMAS]', issues);

            // 3. Geração de sugestões educativas
            const suggestions = this.generateEducationalSuggestions(issues, context, userPreferences);
            console.log('💡 [SUGESTÕES]', suggestions);

            // 4. Enriquecimento com explicações
            const enrichedSuggestions = this.enrichWithExplanations(suggestions, context);
            console.log('🎓 [ENRIQUECIDAS]', enrichedSuggestions);

            // 5. Ordenação inteligente
            const finalSuggestions = this.intelligentPrioritization(enrichedSuggestions, userPreferences);
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ [EDUCATIVO] Análise concluída em ${processingTime}ms`);

            return {
                suggestions: finalSuggestions,
                context: context,
                summary: this.generateSummary(finalSuggestions, context),
                metadata: {
                    processingTime,
                    issuesFound: issues.length,
                    suggestionsGenerated: finalSuggestions.length,
                    version: "1.0.0-ultra-advanced"
                }
            };

        } catch (error) {
            console.error('🚨 [EDUCATIVO] Erro na análise:', error);
            return {
                error: error.message,
                fallbackSuggestions: this.generateFallbackSuggestions(analysis)
            };
        }
    }

    /**
     * 🎵 Analisar contexto musical
     */
    analyzeMusicalContext(analysis, referenceData) {
        const context = {
            genre: this.detectGenre(analysis, referenceData),
            energy: this.analyzeEnergyLevel(analysis),
            complexity: this.analyzeComplexity(analysis),
            targetAudience: this.inferTargetAudience(analysis),
            distributionFormat: this.inferDistributionFormat(analysis)
        };

        return context;
    }

    /**
     * 🔍 Detectar problemas com priorização
     */
    detectIssuesWithPriority(analysis, referenceData, context) {
        const issues = [];
        
        // Análise de métricas técnicas
        const tech = analysis.technicalData || {};
        
        // LUFS Analysis
        if (tech.lufs !== undefined) {
            const genreTarget = this.musicalContexts[context.genre]?.lufsTarget || -10;
            const deviation = Math.abs(tech.lufs - genreTarget);
            
            if (deviation > 2) {
                issues.push({
                    type: 'loudness_deviation',
                    severity: deviation > 4 ? 'critical' : 'important',
                    current: tech.lufs,
                    target: genreTarget,
                    deviation: deviation,
                    impact: 'streaming_compatibility'
                });
            }
        }

        // True Peak Analysis
        if (tech.truePeak !== undefined && tech.truePeak > -1.0) {
            issues.push({
                type: 'true_peak_high',
                severity: tech.truePeak > -0.5 ? 'critical' : 'important',
                current: tech.truePeak,
                target: -1.0,
                impact: 'digital_distortion_risk'
            });
        }

        // Spectral Analysis
        if (tech.bandEnergies || tech.spectral_balance) {
            const spectralIssues = this.analyzeSpectralIssues(tech, context);
            issues.push(...spectralIssues);
        }

        return issues;
    }

    /**
     * 💡 Gerar sugestões educativas
     */
    generateEducationalSuggestions(issues, context, userPreferences) {
        const suggestions = [];

        for (const issue of issues) {
            const suggestion = this.createEducationalSuggestion(issue, context, userPreferences);
            if (suggestion) {
                suggestions.push(suggestion);
            }
        }

        return suggestions;
    }

    /**
     * 🎓 Criar sugestão educativa individual
     */
    createEducationalSuggestion(issue, context, userPreferences) {
        const db = this.educationalDatabase;
        const solutions = this.solutionTemplates;
        
        switch (issue.type) {
            case 'loudness_deviation':
                const isLow = issue.current < issue.target;
                const template = isLow ? solutions.increaseLoudness : solutions.reduceLoudness;
                
                return {
                    id: `loudness_${isLow ? 'low' : 'high'}_${Date.now()}`,
                    category: 'loudness',
                    priority: this.calculatePriority(issue, context),
                    
                    // Título educativo
                    title: isLow ? 
                        "🔊 Aumentar Competitividade Comercial" : 
                        "🎵 Preservar Musicalidade Natural",
                    
                    // Problema identificado
                    problem: {
                        description: `LUFS atual (${issue.current.toFixed(1)}) está ${Math.abs(issue.deviation).toFixed(1)} unidades ${isLow ? 'abaixo' : 'acima'} do ideal para ${context.genre}`,
                        impact: isLow ? 
                            "Sua música vai soar mais baixa que as referências, perdendo impacto competitivo" :
                            "Risco de fadiga auditiva e compressão automática pelas plataformas",
                        visual: this.generateVisualIndicator(issue.current, issue.target, 'lufs')
                    },

                    // Contexto educativo
                    education: {
                        concept: db.lufs.concept,
                        explanation: db.lufs.explanation,
                        importance: db.lufs.importance,
                        genreContext: this.musicalContexts[context.genre]?.characteristics || "Características específicas do gênero"
                    },

                    // Solução prática
                    solution: {
                        strategy: template.title,
                        steps: template.steps,
                        tools: template.dawSpecific,
                        warnings: template.warnings || [],
                        expectedResult: `LUFS target: ${issue.target} (±1 LU aceitável)`
                    },

                    // Validação
                    validation: {
                        checkPoints: [
                            "✓ Medir LUFS integrated final",
                            "✓ Comparar com referências do gênero",
                            "✓ Testar em diferentes sistemas",
                            "✓ Verificar que True Peak < -1.0 dBTP"
                        ],
                        tools: ["LUFS meter", "Reference tracks", "Multi-speaker testing"]
                    },

                    // Metadados
                    metadata: {
                        difficulty: isLow ? 'intermediate' : 'beginner',
                        timeEstimate: '30-60 minutos',
                        impact: issue.severity,
                        tags: ['loudness', 'mastering', 'streaming', context.genre]
                    }
                };

            case 'true_peak_high':
                return {
                    id: `truepeak_high_${Date.now()}`,
                    category: 'technical',
                    priority: this.calculatePriority(issue, context),
                    
                    title: "⚡ Controlar True Peak - Evitar Distorção Digital",
                    
                    problem: {
                        description: `True Peak de ${issue.current.toFixed(1)} dBTP está acima do limite seguro de -1.0 dBTP`,
                        impact: "Risco de distorção audível em DACs consumer, problemas de codificação e artefatos em streaming",
                        technical: "Inter-sample peaks podem causar clipping real mesmo que o medidor digital não mostre"
                    },

                    education: {
                        concept: db.truePeak.concept,
                        explanation: db.truePeak.explanation,
                        importance: db.truePeak.importance,
                        why: "Conversores D/A reconstroem o sinal analógico, criando picos entre amostras digitais"
                    },

                    solution: {
                        strategy: "True Peak Limiting com Oversampling",
                        steps: [
                            "1. ⚡ Ativar True Peak detection no limiter",
                            "2. 🔄 Usar oversampling 4x ou superior",
                            "3. 📊 Ajustar ceiling para -1.0 dBTP",
                            "4. 🎵 Compensar redução de gain se necessário",
                            "5. ✅ Verificar resultado com True Peak meter"
                        ],
                        tools: {
                            recommended: "FabFilter Pro-L 2, Ozone Maximizer, Waves L3",
                            dawNative: db.truePeak.dawExamples
                        },
                        settings: "Ceiling: -1.0 dBTP, Oversampling: 4x, Release: Auto/Musical"
                    },

                    validation: {
                        checkPoints: [
                            "✓ True Peak meter showing < -1.0 dBTP",
                            "✓ No audible artifacts from limiting",
                            "✓ Loudness target maintained",
                            "✓ Test on multiple playback systems"
                        ]
                    },

                    metadata: {
                        difficulty: 'beginner',
                        timeEstimate: '10-15 minutos',
                        impact: 'critical',
                        tags: ['truepeak', 'limiting', 'technical', 'safety']
                    }
                };

            default:
                return null;
        }
    }

    /**
     * 🎓 Enriquecer com explicações adicionais
     */
    enrichWithExplanations(suggestions, context) {
        return suggestions.map(suggestion => {
            // Adicionar analogias e exemplos
            suggestion.analogies = this.generateAnalogies(suggestion.category);
            
            // Adicionar casos de uso reais
            suggestion.realWorldExamples = this.generateRealWorldExamples(suggestion.category, context.genre);
            
            // Adicionar troubleshooting
            suggestion.troubleshooting = this.generateTroubleshooting(suggestion.category);
            
            return suggestion;
        });
    }

    /**
     * 🧠 Priorização inteligente
     */
    intelligentPrioritization(suggestions, userPreferences) {
        // Ordenar por prioridade, mas considerar contexto do usuário
        return suggestions.sort((a, b) => {
            const priorityA = a.priority + this.getUserPreferenceBonus(a, userPreferences);
            const priorityB = b.priority + this.getUserPreferenceBonus(b, userPreferences);
            
            return priorityB - priorityA;
        });
    }

    /**
     * 📊 Calcular prioridade baseada em impacto
     */
    calculatePriority(issue, context) {
        const matrix = this.priorityMatrix;
        
        let basePriority = 0.5;
        
        // Severidade
        switch (issue.severity) {
            case 'critical': basePriority = 1.0; break;
            case 'important': basePriority = 0.8; break;
            case 'moderate': basePriority = 0.6; break;
            default: basePriority = 0.4;
        }

        // Contexto de distribuição
        if (context.distributionFormat === 'streaming') {
            if (['loudness_deviation', 'true_peak_high'].includes(issue.type)) {
                basePriority += 0.1;
            }
        }

        return Math.min(1.0, basePriority);
    }

    /**
     * 🎨 Gerar indicador visual para métricas
     */
    generateVisualIndicator(current, target, type) {
        const diff = current - target;
        const percentage = Math.abs(diff / target) * 100;
        
        return {
            current: current.toFixed(1),
            target: target.toFixed(1),
            difference: diff.toFixed(1),
            percentageOff: percentage.toFixed(1),
            direction: diff > 0 ? 'above' : 'below',
            severity: percentage > 20 ? 'high' : percentage > 10 ? 'medium' : 'low'
        };
    }

    /**
     * 🎯 Detectar gênero musical
     */
    detectGenre(analysis, referenceData) {
        // Tentar extrair do contexto ou usar padrão
        if (window.PROD_AI_REF_GENRE) {
            return window.PROD_AI_REF_GENRE.toLowerCase();
        }
        
        // Fallback: analisar características espectrais
        const tech = analysis.technicalData || {};
        
        if (tech.spectral_balance) {
            const bass = tech.spectral_balance.bass || tech.spectral_balance.low_bass || 0;
            const sub = tech.spectral_balance.sub || 0;
            
            if (sub < -20 && bass < -15) {
                return 'electronic';
            } else if (bass > -10) {
                return 'hiphop';
            }
        }
        
        return 'pop'; // Default seguro
    }

    /**
     * ⚡ Analisar nível de energia
     */
    analyzeEnergyLevel(analysis) {
        const tech = analysis.technicalData || {};
        
        if (tech.lufs && tech.dynamicRange) {
            if (tech.lufs > -8 && tech.dynamicRange < 6) {
                return 'high';
            } else if (tech.lufs < -15 && tech.dynamicRange > 12) {
                return 'low';
            }
        }
        
        return 'medium';
    }

    /**
     * 🧩 Analisar complexidade
     */
    analyzeComplexity(analysis) {
        // Baseado na variedade espectral e dinâmica
        const tech = analysis.technicalData || {};
        
        if (tech.spectral_balance) {
            const bands = Object.values(tech.spectral_balance);
            const variation = this.calculateVariation(bands);
            
            if (variation > 15) return 'high';
            if (variation < 5) return 'low';
        }
        
        return 'medium';
    }

    /**
     * 🎧 Inferir público-alvo
     */
    inferTargetAudience(analysis) {
        const tech = analysis.technicalData || {};
        
        if (tech.dynamicRange && tech.dynamicRange > 12) {
            return 'audiophile';
        } else if (tech.lufs && tech.lufs > -9) {
            return 'commercial';
        }
        
        return 'general';
    }

    /**
     * 📱 Inferir formato de distribuição
     */
    inferDistributionFormat(analysis) {
        const tech = analysis.technicalData || {};
        
        // Baseado em características típicas
        if (tech.lufs && tech.lufs > -12 && tech.lufs < -8) {
            return 'streaming';
        } else if (tech.dynamicRange && tech.dynamicRange > 10) {
            return 'physical';
        }
        
        return 'digital';
    }

    /**
     * 📊 Calcular variação em array
     */
    calculateVariation(values) {
        if (!values || values.length === 0) return 0;
        
        const validValues = values.filter(v => Number.isFinite(v));
        if (validValues.length === 0) return 0;
        
        const max = Math.max(...validValues);
        const min = Math.min(...validValues);
        
        return max - min;
    }

    /**
     * 🔍 Analisar problemas espectrais
     */
    analyzeSpectralIssues(tech, context) {
        const issues = [];
        const bands = tech.bandEnergies || tech.spectral_balance || {};
        
        // Detectar masking nos graves
        if (bands.sub && bands.bass) {
            const subLevel = bands.sub.rms_db || bands.sub;
            const bassLevel = bands.bass.rms_db || bands.bass;
            
            if (typeof subLevel === 'number' && typeof bassLevel === 'number') {
                if (Math.abs(subLevel - bassLevel) < 3) {
                    issues.push({
                        type: 'bass_masking',
                        severity: 'important',
                        frequencies: ['sub', 'bass'],
                        impact: 'clarity_loss'
                    });
                }
            }
        }

        // Detectar harshness nos médios-altos
        if (bands.highMid || bands.high_mid) {
            const level = bands.highMid?.rms_db || bands.high_mid;
            
            if (typeof level === 'number' && level > -8) {
                issues.push({
                    type: 'harshness',
                    severity: level > -5 ? 'critical' : 'important',
                    frequency: 4000,
                    impact: 'listening_fatigue'
                });
            }
        }

        return issues;
    }

    /**
     * 🔧 Gerar analogias educativas
     */
    generateAnalogies(category) {
        const analogies = {
            loudness: [
                "💡 LUFS é como o brilho de uma lâmpada - não importa a potência (watts), mas o quanto ilumina o ambiente",
                "📻 Como o volume do rádio - mesmo que você gire o knob, a estação já vem com seu volume 'natural'"
            ],
            technical: [
                "🌊 True Peak é como ondas do mar - podem ser maiores que parecem quando vistas de longe",
                "📸 Como fotos digitais - o que você vê na tela pode não ser exatamente o que imprime"
            ],
            spectral: [
                "🎨 EQ é como pintura - cada frequência é uma cor que compõe o quadro final",
                "🏠 Mix é como arquitetura - cada banda de frequência é um andar do prédio"
            ]
        };

        return analogies[category] || [];
    }

    /**
     * 🌟 Gerar exemplos do mundo real
     */
    generateRealWorldExamples(category, genre) {
        const examples = {
            loudness: {
                electronic: ["Daft Punk - Random Access Memories (dynamic)", "Skrillex - Bangarang (compressed)"],
                rock: ["Led Zeppelin - IV (natural)", "Metallica - Death Magnetic (over-compressed)"],
                pop: ["Taylor Swift - 1989 (commercial)", "Billie Eilish - Bad Guy (modern)"]
            }
        };

        return examples[category]?.[genre] || [];
    }

    /**
     * 🛠️ Gerar troubleshooting
     */
    generateTroubleshooting(category) {
        const troubleshooting = {
            loudness: [
                "❌ Problema: Limiter não consegue mais aumentar loudness → ✅ Solução: EQ subtrativo primeiro",
                "❌ Problema: Som fica 'espremido' → ✅ Solução: Menos ratio, mais stages de compressão",
                "❌ Problema: Perde punch → ✅ Solução: Preservar transientes com attack lento"
            ],
            technical: [
                "❌ Problema: True Peak ainda alto → ✅ Solução: Verificar se oversampling está ativo",
                "❌ Problema: Som muda com limiting → ✅ Solução: Ajustar release para musical"
            ]
        };

        return troubleshooting[category] || [];
    }

    /**
     * 👤 Obter bônus de preferência do usuário
     */
    getUserPreferenceBonus(suggestion, userPreferences) {
        // Sistema futuro para aprender preferências do usuário
        return 0;
    }

    /**
     * 📋 Gerar resumo executivo
     */
    generateSummary(suggestions, context) {
        const categories = {};
        suggestions.forEach(s => {
            if (!categories[s.category]) categories[s.category] = 0;
            categories[s.category]++;
        });

        const topPriority = suggestions[0];
        
        return {
            overview: `${suggestions.length} melhorias identificadas para ${context.genre}`,
            topPriority: topPriority?.title || "Nenhuma prioridade crítica",
            categories: categories,
            estimatedTime: this.calculateTotalTime(suggestions),
            difficulty: this.calculateAverageDifficulty(suggestions)
        };
    }

    /**
     * ⏱️ Calcular tempo total estimado
     */
    calculateTotalTime(suggestions) {
        // Baseado nos metadados de tempo de cada sugestão
        return "60-120 minutos"; // Placeholder
    }

    /**
     * 📊 Calcular dificuldade média
     */
    calculateAverageDifficulty(suggestions) {
        const difficulties = suggestions.map(s => s.metadata?.difficulty).filter(Boolean);
        // Lógica para calcular média
        return "Intermediário"; // Placeholder
    }

    /**
     * 🚨 Gerar sugestões fallback em caso de erro
     */
    generateFallbackSuggestions(analysis) {
        return [{
            title: "🔧 Verificação Técnica Básica",
            description: "Revisar níveis básicos e evitar clipping",
            category: "safety",
            priority: 1.0
        }];
    }

    /**
     * ⚙️ Obter preferências padrão do usuário
     */
    getDefaultPreferences() {
        return {
            experienceLevel: 'intermediate',
            preferredStyle: 'detailed',
            timeAvailable: 'moderate',
            priorityFocus: 'balanced'
        };
    }
}

// 🌍 Disponibilizar globalmente
window.AdvancedEducationalSuggestionSystem = AdvancedEducationalSuggestionSystem;

// 🎯 Criar instância global
window.advancedSuggestionSystem = new AdvancedEducationalSuggestionSystem();

console.log('🎓 AdvancedEducationalSuggestionSystem carregado com sucesso!');
console.log('📚 Acesse via: window.advancedSuggestionSystem');