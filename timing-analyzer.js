// Timing Analysis - Deep Investigation
// Detecta exatamente onde o problema de timing está ocorrendo

class TimingAnalyzer {
    constructor() {
        this.events = [];
        this.isRecording = false;
        this.hooks = new Map();
        this.setupHooks();
    }

    startRecording() {
        this.events = [];
        this.isRecording = true;
        this.log('info', '🎬 Iniciando gravação de timing');
    }

    stopRecording() {
        this.isRecording = false;
        this.log('info', '⏹️ Parando gravação de timing');
        return this.getReport();
    }

    recordEvent(event, data = null) {
        if (!this.isRecording) return;
        
        const timestamp = performance.now();
        const eventData = {
            timestamp,
            event,
            data,
            stackTrace: new Error().stack.split('\n').slice(2, 6) // Pegar 4 linhas do stack
        };
        
        this.events.push(eventData);
        this.log('timing', `📍 [${timestamp.toFixed(2)}ms] ${event}`, data);
    }

    setupHooks() {
        // Hook no window.suggestionSystem se existir
        this.hookSuggestionSystem();
        
        // Hook em funções globais comuns
        this.hookGlobalFunctions();
        
        // Hook em eventos DOM
        this.hookDOMEvents();
        
        // Monitor de mutações no DOM
        this.setupMutationObserver();
    }

    hookSuggestionSystem() {
        if (typeof window.suggestionSystem !== 'undefined' && window.suggestionSystem.process) {
            const original = window.suggestionSystem.process.bind(window.suggestionSystem);
            
            window.suggestionSystem.process = (...args) => {
                this.recordEvent('suggestionSystem.process CHAMADO', {
                    argsCount: args.length,
                    hasAnalysis: !!args[0],
                    hasReference: !!args[1],
                    analysisKeys: args[0] ? Object.keys(args[0]) : null
                });
                
                try {
                    const result = original(...args);
                    
                    this.recordEvent('suggestionSystem.process RETORNO', {
                        hasResult: !!result,
                        suggestionsCount: result?.suggestions?.length || 0,
                        hasAuditLog: !!result?.auditLog,
                        resultKeys: result ? Object.keys(result) : null
                    });
                    
                    return result;
                } catch (error) {
                    this.recordEvent('suggestionSystem.process ERRO', {
                        error: error.message,
                        stack: error.stack
                    });
                    throw error;
                }
            };
        }
    }

    hookGlobalFunctions() {
        // Lista de funções que podem estar envolvidas
        const functionsToHook = [
            'displaySuggestions',
            'updateSuggestions', 
            'processSuggestions',
            'showSuggestions',
            'renderSuggestions',
            'updateGenreSelection',
            'selectGenre',
            'onGenreChange'
        ];

        functionsToHook.forEach(funcName => {
            if (typeof window[funcName] === 'function') {
                const original = window[funcName].bind(window);
                
                window[funcName] = (...args) => {
                    this.recordEvent(`${funcName} CHAMADO`, {
                        argsCount: args.length,
                        firstArg: args[0]
                    });
                    
                    try {
                        const result = original(...args);
                        this.recordEvent(`${funcName} CONCLUÍDO`, { hasResult: !!result });
                        return result;
                    } catch (error) {
                        this.recordEvent(`${funcName} ERRO`, { error: error.message });
                        throw error;
                    }
                };
            }
        });
    }

    hookDOMEvents() {
        // Hook em eventos que podem afetar sugestões
        const eventsToMonitor = ['change', 'click', 'input', 'focus', 'blur'];
        
        eventsToMonitor.forEach(eventType => {
            document.addEventListener(eventType, (event) => {
                if (event.target.id || event.target.className) {
                    this.recordEvent(`DOM_EVENT_${eventType.toUpperCase()}`, {
                        targetId: event.target.id,
                        targetClass: event.target.className,
                        targetTag: event.target.tagName,
                        targetValue: event.target.value
                    });
                }
            }, true);
        });
    }

    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            const element = node;
                            if (element.className && element.className.includes('suggestion')) {
                                this.recordEvent('DOM_SUGGESTION_ADDED', {
                                    elementId: element.id,
                                    elementClass: element.className,
                                    innerText: element.innerText?.substring(0, 100)
                                });
                            }
                        }
                    });
                }
                
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const element = mutation.target;
                    if (element.className && element.className.includes('suggestion')) {
                        this.recordEvent('DOM_SUGGESTION_STYLE_CHANGED', {
                            elementId: element.id,
                            newStyle: element.style.cssText
                        });
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    getReport() {
        const timingGaps = this.analyzeTimingGaps();
        const eventGroups = this.groupEventsByType();
        const criticalPath = this.findCriticalPath();
        
        return {
            totalEvents: this.events.length,
            timespan: this.getTimespan(),
            timingGaps,
            eventGroups,
            criticalPath,
            rawEvents: this.events
        };
    }

    analyzeTimingGaps() {
        const gaps = [];
        for (let i = 1; i < this.events.length; i++) {
            const gap = this.events[i].timestamp - this.events[i-1].timestamp;
            if (gap > 100) { // Gaps maiores que 100ms
                gaps.push({
                    from: this.events[i-1].event,
                    to: this.events[i].event,
                    gapMs: gap,
                    index: i
                });
            }
        }
        return gaps.sort((a, b) => b.gapMs - a.gapMs);
    }

    groupEventsByType() {
        const groups = {};
        this.events.forEach(event => {
            const type = event.event.split(' ')[0];
            if (!groups[type]) groups[type] = [];
            groups[type].push(event);
        });
        return groups;
    }

    findCriticalPath() {
        // Encontrar sequência crítica de eventos relacionados a sugestões
        const criticalEvents = this.events.filter(event => 
            event.event.toLowerCase().includes('suggestion') ||
            event.event.toLowerCase().includes('process') ||
            event.event.toLowerCase().includes('display') ||
            event.event.toLowerCase().includes('genre')
        );
        
        return criticalEvents.map(event => ({
            timestamp: event.timestamp,
            event: event.event,
            data: event.data
        }));
    }

    getTimespan() {
        if (this.events.length < 2) return 0;
        return this.events[this.events.length - 1].timestamp - this.events[0].timestamp;
    }

    log(level, message, data = null) {
        const prefix = {
            info: '📱',
            timing: '⏱️',
            error: '❌',
            success: '✅'
        };
        
        console.log(`${prefix[level] || '📍'} [TimingAnalyzer] ${message}`, data || '');
    }

    // Método para simular o problema conhecido
    simulateFirstVsSecondProblem() {
        this.log('info', '🔄 Simulando problema: primeira vs segunda tentativa');
        this.startRecording();
        
        // Simular dados de teste
        const testAnalysis = {
            technicalData: {
                lufs: -13.2,
                true_peak: -1.1,
                dr: 6.8,
                frequencyAnalysis: { bass: 0.8, mid: 0.9 }
            }
        };
        
        const testReference = {
            genre: "Funk Mandela",
            lufs_target: -14.0,
            true_peak_target: -1.0
        };

        this.recordEvent('SIMULAÇÃO_INICIADA', { scenario: 'primeira_tentativa' });
        
        // Primeira tentativa (problematática)
        setTimeout(() => {
            this.recordEvent('PRIMEIRA_TENTATIVA_INICIO');
            
            if (window.suggestionSystem) {
                try {
                    const result1 = window.suggestionSystem.process(testAnalysis, testReference);
                    this.recordEvent('PRIMEIRA_TENTATIVA_RESULTADO', {
                        suggestionsCount: result1?.suggestions?.length || 0,
                        isEmpty: !result1?.suggestions || result1.suggestions.length === 0
                    });
                } catch (error) {
                    this.recordEvent('PRIMEIRA_TENTATIVA_ERRO', { error: error.message });
                }
            }
            
            // Segunda tentativa (que funciona)
            setTimeout(() => {
                this.recordEvent('SEGUNDA_TENTATIVA_INICIO');
                
                if (window.suggestionSystem) {
                    try {
                        const result2 = window.suggestionSystem.process(testAnalysis, testReference);
                        this.recordEvent('SEGUNDA_TENTATIVA_RESULTADO', {
                            suggestionsCount: result2?.suggestions?.length || 0,
                            isEmpty: !result2?.suggestions || result2.suggestions.length === 0
                        });
                    } catch (error) {
                        this.recordEvent('SEGUNDA_TENTATIVA_ERRO', { error: error.message });
                    }
                }
                
                // Finalizar análise
                setTimeout(() => {
                    const report = this.stopRecording();
                    this.log('success', '📊 Análise de timing concluída', report);
                    
                    // Salvar globalmente
                    window.__TIMING_ANALYSIS_REPORT = report;
                    
                    return report;
                }, 100);
                
            }, 1000); // 1s entre tentativas
            
        }, 500); // 500ms para iniciar primeira tentativa
    }
}

// Instanciar globalmente
if (typeof window !== 'undefined') {
    window.TimingAnalyzer = TimingAnalyzer;
    window.timingAnalyzer = new TimingAnalyzer();
    
    // Funções de conveniência
    window.debugTiming = () => window.timingAnalyzer.simulateFirstVsSecondProblem();
    window.getTimingReport = () => window.__TIMING_ANALYSIS_REPORT || null;
    
    console.log('✅ TimingAnalyzer carregado - use window.debugTiming() para analisar');
}

// Export para Node.js se necessário
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimingAnalyzer;
}