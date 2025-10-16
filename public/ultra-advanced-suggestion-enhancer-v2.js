// 🚀 SISTEMA ULTRA-AVANÇADO V2 - Integração Direta com Sugestões Existentes
// Este sistema funciona diretamente com as sugestões geradas pelo Enhanced Engine

class UltraAdvancedSuggestionEnhancer {
    constructor() {
        console.log('🚀 [ULTRA_V2] Inicializando Sistema Ultra-Avançado V2...');
        
        // Base educacional de conhecimento
        this.educationalDatabase = {
            // Problemas de sibilância
            sibilance: {
                explanation: 'A sibilância são sons agudos e penetrantes (como "S" e "T") que se tornam desagradáveis quando muito intensos. Ocorrem tipicamente entre 5-8kHz e podem causar fadiga auditiva.',
                context: 'Muito comum em gravações vocais próximas ao microfone ou com compressão excessiva',
                solution: 'Use um De-esser ou EQ cirúrgico com Q alto para reduzir especificamente as frequências problemáticas',
                prevention: 'Posicione o microfone adequadamente, use filtro pop e evite compressão excessiva nos agudos'
            },
            
            // Problemas de máscara espectral
            spectral_masking: {
                explanation: 'Máscara espectral ocorre quando frequências próximas competem entre si, causando falta de clareza e definição',
                context: 'Comum em mixagens densas onde instrumentos ocupam a mesma faixa de frequência',
                solution: 'Use EQ complementar - corte em um instrumento onde você realça em outro',
                prevention: 'Organize o arranjo para que cada instrumento tenha seu espaço espectral definido'
            },
            
            // Problemas de loudness
            loudness_issues: {
                explanation: 'Problemas de loudness afetam a compatibilidade com plataformas de streaming e a experiência auditiva',
                context: 'Streaming platforms como Spotify normalizam para -14 LUFS, YouTube para -16 LUFS',
                solution: 'Use limitador transparente e monitore True Peak para evitar distorção digital',
                prevention: 'Mixe em níveis moderados e deixe a masterização para o final'
            },
            
            // Problemas de dinâmica
            dynamics: {
                explanation: 'Range dinâmico é a diferença entre as partes mais baixas e mais altas da música. Muito pouco causa fadiga, muito causa inconsistência',
                context: 'LRA (Loudness Range) ideal varia por gênero: Pop ~4-7 LU, Rock ~6-9 LU, Clássico ~15-20 LU',
                solution: 'Use compressão moderada preservando transientes importantes',
                prevention: 'Mantenha dinâmica natural na gravação e use automação de volume'
            }
        };
        
        // Templates de DAW específicos
        this.dawExamples = {
            'Pro Tools': {
                eq: 'Insert → EQ3 7-Band → Selecionar banda → Ajustar Freq/Gain/Q',
                compressor: 'Insert → Dyn3 Compressor/Limiter → Ajustar Ratio/Attack/Release',
                deesser: 'Insert → DeEsser → Ajustar Freq/Range/Reduction'
            },
            'Logic Pro': {
                eq: 'Insert → Channel EQ → Selecionar banda → Ajustar Frequency/Gain/Q',
                compressor: 'Insert → Compressor → Ajustar Ratio/Attack/Release',
                deesser: 'Insert → DeEsser → Ajustar Frequency/Sensitivity'
            },
            'Ableton Live': {
                eq: 'Insert → EQ Eight → Selecionar banda → Ajustar Freq/Gain/Q',
                compressor: 'Insert → Compressor → Ajustar Ratio/Attack/Release',
                deesser: 'Insert → De-esser (Max for Live) ou EQ Eight com automação'
            },
            'FL Studio': {
                eq: 'Insert → Parametric EQ 2 → Selecionar banda → Ajustar Freq/Gain/Q',
                compressor: 'Insert → Fruity Compressor → Ajustar Ratio/Attack/Release',
                deesser: 'Insert → Maximus (banda High) ou Parametric EQ 2'
            }
        };
        
        console.log('✅ [ULTRA_V2] Sistema Ultra-Avançado V2 carregado com sucesso!');
    }
    
    /**
     * 🚀 Enriquecer sugestões existentes com conteúdo educacional ultra-avançado
     */
    enhanceExistingSuggestions(suggestions, analysisContext = {}) {
        console.log('🚀 [ULTRA_V2] Enriquecendo sugestões existentes...', {
            inputCount: suggestions.length,
            context: analysisContext
        });
        
        const startTime = performance.now();
        const enhancedSuggestions = [];
        
        for (const suggestion of suggestions) {
            try {
                const enhanced = this.enhanceSingleSuggestion(suggestion, analysisContext);
                enhancedSuggestions.push(enhanced);
            } catch (error) {
                console.warn('⚠️ [ULTRA_V2] Erro ao enriquecer sugestão:', error);
                // Manter sugestão original em caso de erro
                enhancedSuggestions.push(suggestion);
            }
        }
        
        const endTime = performance.now();
        const processingTime = (endTime - startTime).toFixed(2);
        
        console.log('✅ [ULTRA_V2] Enriquecimento concluído!', {
            originalCount: suggestions.length,
            enhancedCount: enhancedSuggestions.length,
            processingTime: `${processingTime}ms`
        });
        
        return {
            enhancedSuggestions: enhancedSuggestions,
            metadata: {
                processingTimeMs: parseFloat(processingTime),
                originalCount: suggestions.length,
                enhancedCount: enhancedSuggestions.length,
                educationalLevel: 'ultra-advanced',
                version: '2.0.0-direct-enhancement'
            }
        };
    }
    
    /**
     * 🎓 Enriquecer uma sugestão individual
     */
    enhanceSingleSuggestion(suggestion, context) {
        const enhanced = { ...suggestion };
        
        // Detectar tipo de problema baseado no conteúdo da sugestão
        const problemType = this.detectProblemType(suggestion);
        const severity = this.calculateSeverity(suggestion);
        const dawInstructions = this.generateDAWInstructions(suggestion);
        
        // Adicionar conteúdo educacional ultra-avançado
        enhanced.educationalContent = {
            title: this.generateEducationalTitle(suggestion, problemType),
            explanation: this.generateEducationalExplanation(suggestion, problemType, context),
            action: this.generateDetailedAction(suggestion, problemType),
            dawExamples: dawInstructions,
            expectedResult: this.generateExpectedResult(suggestion, problemType),
            technicalDetails: this.generateTechnicalDetails(suggestion, problemType),
            relatedConcepts: this.getRelatedConcepts(problemType),
            
            // 🚀 NOVOS CAMPOS OPCIONAIS - Ultra-Avançado V2
            videoTutorials: this.generateVideoTutorials(problemType),
            pluginRecommendations: this.generatePluginRecommendations(problemType),
            commonMistakes: this.generateCommonMistakes(problemType),
            proTips: this.generateProTips(problemType, suggestion)
        };
        
        // Adicionar classificação de severidade
        enhanced.severity = severity;
        
        // Calcular prioridade educacional
        enhanced.priority = this.calculateEducationalPriority(suggestion, severity);
        
        // Adicionar metadados educacionais
        enhanced.educationalMetadata = {
            learningLevel: 'intermediate',
            concepts: this.extractConcepts(problemType),
            estimatedReadTime: this.estimateReadTime(enhanced.educationalContent),
            practicalDifficulty: this.assessPracticalDifficulty(suggestion)
        };
        
        return enhanced;
    }
    
    /**
     * 🔍 Detectar tipo de problema baseado no conteúdo
     */
    detectProblemType(suggestion) {
        const message = (suggestion.message || '').toLowerCase();
        const action = (suggestion.action || '').toLowerCase();
        const combined = message + ' ' + action;
        
        if (combined.includes('sibilân') || combined.includes('sibilanc')) return 'sibilance';
        if (combined.includes('harsh') || combined.includes('áspero')) return 'harshness';
        if (combined.includes('mud') || combined.includes('turv')) return 'muddiness';
        if (combined.includes('boom') || combined.includes('ressân')) return 'boomy_bass';
        if (combined.includes('thin') || combined.includes('fin')) return 'thinness';
        if (combined.includes('bright') || combined.includes('brilh')) return 'brightness';
        if (combined.includes('dark') || combined.includes('escur')) return 'darkness';
        if (combined.includes('clip') || combined.includes('distor')) return 'clipping';
        if (combined.includes('loud') || combined.includes('volume')) return 'loudness_issues';
        if (combined.includes('din') || combined.includes('range')) return 'dynamics';
        if (combined.includes('estereo') || combined.includes('stereo')) return 'stereo_issues';
        
        // Detectar por tipo técnico
        if (suggestion.type === 'surgical_eq') return 'surgical_eq';
        if (suggestion.type === 'band_adjust') return 'spectral_balance';
        if (suggestion.type === 'reference_loudness') return 'loudness_issues';
        if (suggestion.type === 'reference_dynamics') return 'dynamics';
        
        return 'general';
    }
    
    /**
     * ⚖️ Calcular severidade baseada no conteúdo
     */
    calculateSeverity(suggestion) {
        const message = (suggestion.message || '').toLowerCase();
        const priority = suggestion.priority || 5;
        const confidence = suggestion.confidence || 0.5;
        
        let level = 'medium';
        let color = '#FF9800';
        let label = 'Moderada';
        
        // Análise por palavras-chave críticas
        if (message.includes('crítico') || message.includes('critical') || 
            message.includes('sério') || message.includes('severe')) {
            level = 'high';
            color = '#f44336';
            label = 'Alta';
        } else if (message.includes('leve') || message.includes('mild') || 
                   message.includes('sutil') || message.includes('subtle')) {
            level = 'low';
            color = '#4CAF50';
            label = 'Leve';
        }
        
        // Análise por prioridade numérica
        if (priority >= 8) {
            level = 'high';
            color = '#f44336';
            label = 'Alta';
        } else if (priority <= 3) {
            level = 'low';
            color = '#4CAF50';
            label = 'Leve';
        }
        
        // Análise por confidence
        if (confidence >= 0.8 && priority >= 7) {
            level = 'high';
            color = '#f44336';
            label = 'Alta';
        }
        
        return { level, color, label };
    }
    
    /**
     * 🎛️ Gerar instruções específicas por DAW
     */
    generateDAWInstructions(suggestion) {
        const action = (suggestion.action || '').toLowerCase();
        const instructions = {};
        
        // Extrair valores técnicos
        const freqMatch = action.match(/(\d+(?:\.\d+)?)\s*(?:hz|khz)/i);
        const frequency = freqMatch ? freqMatch[1] : '1000';
        
        const dbMatch = action.match(/([+-]?\d+(?:\.\d+)?)\s*db/i);
        const dbValue = dbMatch ? dbMatch[1] : '0';
        
        const qMatch = action.match(/q\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
        const qValue = qMatch ? qMatch[1] : '2.0';
        
        // Determinar tipo de operação
        const isBoost = parseFloat(dbValue) > 0;
        const isCut = parseFloat(dbValue) < 0;
        const isCompression = action.includes('compr') || action.includes('compress');
        const isDeessing = action.includes('sibilân') || action.includes('deess');
        
        Object.keys(this.dawExamples).forEach(daw => {
            if (isDeessing) {
                instructions[daw] = `${this.dawExamples[daw].deesser} → Target: ${frequency}Hz → Reduction: ${Math.abs(dbValue)}dB`;
            } else if (isCompression) {
                instructions[daw] = `${this.dawExamples[daw].compressor} → Ratio: 3:1 → Attack: Fast → Release: Auto`;
            } else {
                const eqType = isCut ? 'Cut' : (isBoost ? 'Boost' : 'Bell');
                instructions[daw] = `${this.dawExamples[daw].eq} → Type: ${eqType} → Freq: ${frequency}Hz → Gain: ${dbValue}dB → Q: ${qValue}`;
            }
        });
        
        return instructions;
    }
    
    /**
     * 📚 Gerar título educacional
     */
    generateEducationalTitle(suggestion, problemType) {
        const titles = {
            'sibilance': '🔧 Correção Cirúrgica de Sibilância',
            'harshness': '✨ Suavização de Harshness',
            'muddiness': '🧹 Limpeza de Frequências Graves',
            'boomy_bass': '🎚️ Controle de Ressonância Grave',
            'brightness': '🌟 Ajuste de Brilho Excessivo',
            'darkness': '💡 Restauração de Clareza',
            'clipping': '🚨 Correção de Distorção Digital',
            'loudness_issues': '📊 Otimização de Loudness',
            'dynamics': '🎵 Balanceamento Dinâmico',
            'surgical_eq': '🔧 EQ Cirúrgico Preciso',
            'spectral_balance': '⚖️ Rebalanceamento Espectral',
            'stereo_issues': '🎧 Correção de Imagem Estéreo'
        };
        
        return titles[problemType] || '🎵 Melhoria de Qualidade Audio';
    }
    
    /**
     * 📖 Gerar explicação educacional detalhada
     */
    generateEducationalExplanation(suggestion, problemType, context) {
        const baseExplanation = this.educationalDatabase[problemType]?.explanation || 
            'Este problema afeta a qualidade sonora e pode prejudicar a experiência auditiva.';
            
        const genre = context.detectedGenre || 'geral';
        const genreContext = this.getGenreSpecificContext(problemType, genre);
        
        return `${baseExplanation} ${genreContext}`;
    }
    
    /**
     * 🎼 Obter contexto específico do gênero musical
     */
    getGenreSpecificContext(problemType, genre) {
        const contexts = {
            'electronic': {
                'sibilance': 'Em música eletrônica, vocals sintéticos podem acentuar sibilância artificialmente.',
                'loudness_issues': 'Gênero eletrônico geralmente visa -8 a -10 LUFS para impacto máximo.',
                'dynamics': 'Electronic music pode ter LRA baixo (3-6 LU) mantendo energia constante.'
            },
            'rock': {
                'harshness': 'Guitarras distorcidas podem mascarar harshness vocal, requiring careful EQ.',
                'loudness_issues': 'Rock moderno visa -10 a -12 LUFS balanceando impacto e dinâmica.',
                'dynamics': 'Rock necessita punch dinâmico, LRA ideal entre 6-10 LU.'
            },
            'pop': {
                'sibilance': 'Pop vocals são prominentes, sibilância se torna mais perceptível.',
                'loudness_issues': 'Pop comercial visa -11 a -13 LUFS para competitividade no streaming.',
                'spectral_balance': 'Pop requer clareza vocal na faixa 2-5kHz para inteligibilidade.'
            }
        };
        
        return contexts[genre]?.[problemType] || 'Considerações gerais aplicam-se a este gênero musical.';
    }
    
    /**
     * 🛠️ Gerar ação detalhada com contexto técnico
     */
    generateDetailedAction(suggestion, problemType) {
        const originalAction = suggestion.action || '';
        const technicalDetails = this.generateTechnicalDetails(suggestion, problemType);
        
        return `${originalAction}\n\n💡 Detalhes técnicos: ${technicalDetails}`;
    }
    
    /**
     * ⚙️ Gerar detalhes técnicos
     */
    generateTechnicalDetails(suggestion, problemType) {
        const action = (suggestion.action || '').toLowerCase();
        
        const freqMatch = action.match(/(\d+(?:\.\d+)?)\s*(?:hz|khz)/i);
        const qMatch = action.match(/q\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
        
        if (freqMatch && qMatch) {
            const freq = freqMatch[1];
            const q = qMatch[1];
            const bandwidth = (parseFloat(freq) / parseFloat(q)).toFixed(1);
            return `Largura de banda afetada: ±${bandwidth}Hz. Q alto = cirúrgico, Q baixo = musical.`;
        }
        
        return 'Use monitoring em diferentes sistemas para validar o resultado.';
    }
    
    /**
     * ✨ Gerar resultado esperado
     */
    generateExpectedResult(suggestion, problemType) {
        const results = {
            'sibilance': 'Vocal mais suave e confortável, sem perda de clareza ou presença natural.',
            'harshness': 'Som mais agradável e musicalmente equilibrado, reduzindo fadiga auditiva.',
            'muddiness': 'Maior clareza e separação de instrumentos, mix mais definido.',
            'boomy_bass': 'Graves mais controlados e precisos, sem mascaramento de outras frequências.',
            'brightness': 'Som mais natural e balanceado, preservando detalhes importantes.',
            'loudness_issues': 'Conformidade com padrões de streaming e melhor tradução em diferentes sistemas.',
            'dynamics': 'Maior musicalidade e interesse auditivo, mantendo impacto adequado.'
        };
        
        return results[problemType] || 'Melhoria geral na qualidade e balanço sonoro.';
    }
    
    /**
     * 🧮 Calcular prioridade educacional
     */
    calculateEducationalPriority(suggestion, severity) {
        const basePriority = suggestion.priority || 5;
        const severityBonus = severity.level === 'high' ? 2 : (severity.level === 'low' ? -1 : 0);
        const confidence = suggestion.confidence || 0.5;
        const confidenceBonus = confidence > 0.8 ? 1 : 0;
        
        return Math.max(1, Math.min(10, basePriority + severityBonus + confidenceBonus));
    }
    
    /**
     * 📚 Extrair conceitos educacionais
     */
    extractConcepts(problemType) {
        const concepts = {
            'sibilance': ['EQ Dinâmico', 'De-essing', 'Frequency Spectrum', 'Vocal Processing'],
            'harshness': ['EQ Corretivo', 'Frequency Balance', 'Psychoacoustics'],
            'loudness_issues': ['LUFS', 'True Peak', 'Streaming Standards', 'Mastering'],
            'dynamics': ['LRA', 'Compression', 'Musical Dynamics', 'Loudness Range']
        };
        
        return concepts[problemType] || ['Audio Processing', 'Mixing Techniques'];
    }
    
    /**
     * ⏱️ Estimar tempo de leitura
     */
    estimateReadTime(content) {
        const totalText = Object.values(content).join(' ');
        const wordCount = totalText.split(' ').length;
        const readingSpeed = 200; // palavras por minuto
        const minutes = Math.ceil(wordCount / readingSpeed);
        
        return `${minutes} min${minutes > 1 ? 's' : ''}`;
    }
    
    /**
     * 🎯 Avaliar dificuldade prática
     */
    assessPracticalDifficulty(suggestion) {
        const action = (suggestion.action || '').toLowerCase();
        
        if (action.includes('cirúrgic') || action.includes('surgical') || action.includes('deess')) {
            return 'Avançado';
        } else if (action.includes('boost') || action.includes('corte') || action.includes('cut')) {
            return 'Intermediário';
        } else {
            return 'Básico';
        }
    }
    
    /**
     * 🔗 Obter conceitos relacionados
     */
    getRelatedConcepts(problemType) {
        const related = {
            'sibilance': ['Compressão Multibanda', 'Processamento Vocal', 'Automação de Volume'],
            'harshness': ['Saturação Harmônica', 'Compressão Paralela', 'Exciters'],
            'loudness_issues': ['K-System', 'Metering', 'Reference Tracks'],
            'dynamics': ['Transient Processing', 'Envelope Shaping', 'Parallel Compression']
        };
        
        return related[problemType] || ['Mixing Fundamentals', 'Critical Listening'];
    }
    
    /**
     * 🎥 Gerar links de tutoriais em vídeo (opcional)
     */
    generateVideoTutorials(problemType) {
        const tutorials = {
            'sibilance': [
                { title: 'Como usar De-esser profissionalmente', platform: 'YouTube', topic: 'Vocal Processing' },
                { title: 'Técnicas avançadas de controle de sibilância', platform: 'YouTube', topic: 'Mixing' }
            ],
            'harshness': [
                { title: 'EQ para remover harshness', platform: 'YouTube', topic: 'EQ Techniques' },
                { title: 'Dynamic EQ vs Static EQ', platform: 'YouTube', topic: 'Advanced EQ' }
            ],
            'loudness_issues': [
                { title: 'Masterização para Spotify e streaming', platform: 'YouTube', topic: 'Mastering' },
                { title: 'LUFS e True Peak explicados', platform: 'YouTube', topic: 'Loudness' }
            ],
            'dynamics': [
                { title: 'Compressão paralela na prática', platform: 'YouTube', topic: 'Compression' },
                { title: 'Preservando dinâmica no master', platform: 'YouTube', topic: 'Mastering' }
            ]
        };
        
        return tutorials[problemType] || [];
    }
    
    /**
     * 🔌 Gerar recomendações de plugins (opcional)
     */
    generatePluginRecommendations(problemType) {
        const plugins = {
            'sibilance': [
                { name: 'FabFilter Pro-DS', type: 'De-esser', price: 'Pago' },
                { name: 'Waves Renaissance DeEsser', type: 'De-esser', price: 'Pago' },
                { name: 'TDR Nova (Free)', type: 'Dynamic EQ', price: 'Grátis' }
            ],
            'harshness': [
                { name: 'FabFilter Pro-Q3', type: 'Dynamic EQ', price: 'Pago' },
                { name: 'Izotope Neutron', type: 'Channel Strip', price: 'Pago' },
                { name: 'MEqualizer (Free)', type: 'EQ', price: 'Grátis' }
            ],
            'loudness_issues': [
                { name: 'FabFilter Pro-L2', type: 'Limiter', price: 'Pago' },
                { name: 'Waves L2', type: 'Limiter', price: 'Pago' },
                { name: 'Youlean Loudness Meter', type: 'Metering', price: 'Grátis' }
            ],
            'dynamics': [
                { name: 'FabFilter Pro-C2', type: 'Compressor', price: 'Pago' },
                { name: 'SSL G-Master Buss Compressor', type: 'Compressor', price: 'Pago' },
                { name: 'OTT (Free)', type: 'Multiband Compressor', price: 'Grátis' }
            ]
        };
        
        return plugins[problemType] || [];
    }
    
    /**
     * ⚠️ Gerar erros comuns (opcional)
     */
    generateCommonMistakes(problemType) {
        const mistakes = {
            'sibilance': [
                'Usar de-esser com threshold muito baixo, removendo toda a clareza',
                'Aplicar de-essing antes da compressão (ordem errada na cadeia)',
                'Não ouvir o sinal "sidechain" do de-esser para validar frequência correta'
            ],
            'harshness': [
                'Fazer cortes muito largos (Q baixo) em vez de cirúrgicos',
                'Não usar análise espectral para identificar frequências exatas',
                'Tentar resolver harshness apenas com EQ, ignorando fonte do problema'
            ],
            'loudness_issues': [
                'Comparar LUFS sem considerar o gênero musical',
                'Ignorar True Peak e focar só em LUFS',
                'Adicionar limitador sem resolver problemas de mix primeiro'
            ],
            'dynamics': [
                'Comprimir demais para "parecer mais alto"',
                'Usar ratio muito alto sem entender o resultado',
                'Não compensar o ganho após compressão (gain makeup)'
            ]
        };
        
        return mistakes[problemType] || [];
    }
    
    /**
     * 💎 Gerar dicas profissionais avançadas (opcional)
     */
    generateProTips(problemType, suggestion) {
        const tips = {
            'sibilance': [
                'Use split-band de-essing para maior controle',
                'Combine de-esser com EQ dinâmico na mesma faixa',
                'Automatize o threshold do de-esser em partes mais sibilantes',
                'Grave com microfone fora do eixo para reduzir sibilância na fonte'
            ],
            'harshness': [
                'Use EQ dinâmico em vez de EQ estático para transparência',
                'Tente saturação suave antes do corte de EQ',
                'A/B com análise de espectro para validar resultado',
                'Considere o contexto do mix - harshness pode ser mascaramento'
            ],
            'loudness_issues': [
                'Mix para -16 LUFS e ajuste no master para target final',
                'Use metering de múltiplas plataformas (Spotify, YouTube, Apple)',
                'Preserve pelo menos 1dB de True Peak headroom',
                'Compare com 3-5 referências do mesmo gênero'
            ],
            'dynamics': [
                'Use compressão serial (múltiplos compressores suaves)',
                'Experimente diferentes tipos de compressor (VCA, Opto, FET)',
                'Paralel compression mantém punch preservando dinâmica',
                'Automatize volume antes de comprimir excessivamente'
            ]
        };
        
        const tipsList = tips[problemType] || ['Use referências de qualidade para guiar suas decisões'];
        
        // Adicionar dica contextual baseada na sugestão específica
        const action = (suggestion.action || '').toLowerCase();
        if (action.includes('cirúrgic') || action.includes('surgical')) {
            tipsList.push('🎯 Dica contextual: EQ cirúrgico exige Q alto (5-10) para precisão');
        } else if (action.includes('compr')) {
            tipsList.push('🎯 Dica contextual: Attack rápido pega transientes, Release auto se adapta ao material');
        }
        
        return tipsList;
    }
}

// Disponibilizar globalmente
window.UltraAdvancedSuggestionEnhancer = UltraAdvancedSuggestionEnhancer;
console.log('🚀 [ULTRA_V2] Sistema Ultra-Avançado V2 disponível globalmente');