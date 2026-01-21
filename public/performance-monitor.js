/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 PERFORMANCE MONITOR V2 - SoundyAI
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * VERSÃO: 2.0.0 - Instrumentação aprimorada
 * DATA: 2026-01-05
 * 
 * MELHORIAS V2:
 * ✅ Top 20 piores LongTasks com attribution detalhada
 * ✅ __perfDump() melhorado com sugestões de culpado
 * ✅ Tracking de containerSrc e containerName
 * ✅ Estatísticas agregadas com P90/P95
 * ✅ Modo silencioso por padrão (DEBUG = false)
 * 
 * USO NO CONSOLE:
 * - window.__perfDump()     → Ver últimos 30 eventos + diagnóstico
 * - window.__perfStats()    → Ver estatísticas resumidas
 * - window.__perfReset()    → Limpar buffer
 * - window.__perfWorst()    → Ver top 20 piores longtasks
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    const CONFIG = {
        BUFFER_SIZE: 30,
        WORST_LONGTASKS_SIZE: 20,  // Top 20 piores
        FPS_SAMPLE_INTERVAL: 500,
        LOW_FPS_THRESHOLD: 45,
        LOW_FPS_DURATION_ALERT: 2000,
        LONGTASK_THRESHOLD: 50,
        DEBUG_MODE: false  // SILENCIOSO por padrão
    };

    // ═══════════════════════════════════════════════════════════════════
    // BUFFER CIRCULAR DE EVENTOS
    // ═══════════════════════════════════════════════════════════════════
    const perfBuffer = {
        events: [],
        maxSize: CONFIG.BUFFER_SIZE,
        
        add(event) {
            this.events.push({
                ...event,
                id: Date.now() + Math.random().toString(36).substr(2, 5)
            });
            if (this.events.length > this.maxSize) {
                this.events.shift();
            }
        },
        
        getAll() {
            return [...this.events];
        },
        
        clear() {
            this.events = [];
        },
        
        getStats() {
            const longtasks = this.events.filter(e => e.type === 'longtask');
            const fpsDips = this.events.filter(e => e.type === 'fps-low');
            
            // Calcular percentis
            const durations = longtasks.map(e => e.duration).sort((a, b) => a - b);
            const p90 = durations[Math.floor(durations.length * 0.9)] || 0;
            const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
            
            return {
                totalEvents: this.events.length,
                longtasks: {
                    count: longtasks.length,
                    avgDuration: longtasks.length 
                        ? (longtasks.reduce((s, e) => s + e.duration, 0) / longtasks.length).toFixed(2) 
                        : 0,
                    maxDuration: longtasks.length 
                        ? Math.max(...longtasks.map(e => e.duration)).toFixed(2) 
                        : 0,
                    p90: p90.toFixed(2),
                    p95: p95.toFixed(2)
                },
                fpsDips: {
                    count: fpsDips.length,
                    avgFps: fpsDips.length 
                        ? (fpsDips.reduce((s, e) => s + e.fps, 0) / fpsDips.length).toFixed(1) 
                        : 60
                }
            };
        }
    };
    
    // ═══════════════════════════════════════════════════════════════════
    // TOP 20 PIORES LONGTASKS (sempre mantidos, ordenados por duração)
    // ═══════════════════════════════════════════════════════════════════
    const worstLongtasks = {
        tasks: [],
        maxSize: CONFIG.WORST_LONGTASKS_SIZE,
        
        add(task) {
            this.tasks.push(task);
            // Ordenar por duração (maior primeiro)
            this.tasks.sort((a, b) => b.duration - a.duration);
            // Manter apenas top N
            if (this.tasks.length > this.maxSize) {
                this.tasks = this.tasks.slice(0, this.maxSize);
            }
        },
        
        getAll() {
            return [...this.tasks];
        },
        
        clear() {
            this.tasks = [];
        },
        
        getSuspects() {
            // Agregar por source para identificar culpados
            const suspects = {};
            
            this.tasks.forEach(task => {
                if (task.attribution && task.attribution.length > 0) {
                    task.attribution.forEach(attr => {
                        const key = attr.containerSrc || attr.containerName || attr.name || 'unknown';
                        if (!suspects[key]) {
                            suspects[key] = {
                                source: key,
                                count: 0,
                                totalDuration: 0,
                                maxDuration: 0
                            };
                        }
                        suspects[key].count++;
                        suspects[key].totalDuration += task.duration;
                        suspects[key].maxDuration = Math.max(suspects[key].maxDuration, task.duration);
                    });
                }
            });
            
            // Ordenar por totalDuration
            return Object.values(suspects).sort((a, b) => b.totalDuration - a.totalDuration);
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // LONGTASK OBSERVER
    // ═══════════════════════════════════════════════════════════════════
    let longtaskObserver = null;

    function initLongtaskObserver() {
        if (!('PerformanceObserver' in window)) {
            warn('⚠️ [PerfMon] PerformanceObserver não suportado');
            return;
        }

        try {
            longtaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const event = {
                        type: 'longtask',
                        timestamp: Date.now(),
                        duration: entry.duration,
                        startTime: entry.startTime,
                        name: entry.name,
                        attribution: entry.attribution?.map(a => ({
                            name: a.name,
                            entryType: a.entryType,
                            containerType: a.containerType,
                            containerName: a.containerName,
                            containerSrc: a.containerSrc
                        })) || []
                    };
                    
                    // Adicionar ao buffer circular
                    perfBuffer.add(event);
                    
                    // Adicionar ao ranking de piores (sempre)
                    worstLongtasks.add(event);
                    
                    if (CONFIG.DEBUG_MODE) {
                        warn(`🐌 [LongTask] ${entry.duration.toFixed(1)}ms`, event.attribution);
                    }
                    
                    // Notificar EffectsController se task muito longa
                    if (entry.duration > 100 && window.EffectsController) {
                        window.EffectsController.onLongTask(entry.duration);
                    }
                }
            });

            longtaskObserver.observe({ entryTypes: ['longtask'] });
            if (CONFIG.DEBUG_MODE) {
                log('✅ [PerfMon] LongTask observer ativo');
            }
        } catch (e) {
            warn('⚠️ [PerfMon] Falha ao criar LongTask observer:', e.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // FPS MONITOR
    // ═══════════════════════════════════════════════════════════════════
    const fpsMonitor = {
        fps: 60,
        frameCount: 0,
        lastTime: performance.now(),
        lowFpsStart: null,
        rafId: null,
        isRunning: false,
        
        start() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.lastTime = performance.now();
            this.frameCount = 0;
            this.tick();
            if (CONFIG.DEBUG_MODE) {
                log('✅ [PerfMon] FPS monitor ativo');
            }
        },
        
        stop() {
            this.isRunning = false;
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        },
        
        tick() {
            if (!this.isRunning) return;
            
            this.frameCount++;
            const now = performance.now();
            const elapsed = now - this.lastTime;
            
            if (elapsed >= CONFIG.FPS_SAMPLE_INTERVAL) {
                this.fps = Math.round((this.frameCount * 1000) / elapsed);
                this.frameCount = 0;
                this.lastTime = now;
                
                // Verificar FPS baixo
                if (this.fps < CONFIG.LOW_FPS_THRESHOLD) {
                    if (!this.lowFpsStart) {
                        this.lowFpsStart = now;
                    } else if (now - this.lowFpsStart > CONFIG.LOW_FPS_DURATION_ALERT) {
                        this.onLowFps();
                        this.lowFpsStart = now; // Reset para não spammar
                    }
                } else {
                    this.lowFpsStart = null;
                }
            }
            
            this.rafId = requestAnimationFrame(() => this.tick());
        },
        
        onLowFps() {
            const event = {
                type: 'fps-low',
                timestamp: Date.now(),
                fps: this.fps,
                duration: CONFIG.LOW_FPS_DURATION_ALERT
            };
            
            perfBuffer.add(event);
            
            if (CONFIG.DEBUG_MODE) {
                warn(`📉 [FPS] ${this.fps} FPS por ${CONFIG.LOW_FPS_DURATION_ALERT}ms`);
            }
            
            // Notificar EffectsController
            if (window.EffectsController) {
                window.EffectsController.onLowFps(this.fps);
            }
        },
        
        getCurrentFps() {
            return this.fps;
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // API PÚBLICA V2
    // ═══════════════════════════════════════════════════════════════════
    
    window.__perfDump = function() {
        const events = perfBuffer.getAll();
        const stats = perfBuffer.getStats();
        const suspects = worstLongtasks.getSuspects();
        
        console.group('📊 Performance Dump (' + events.length + ' eventos)');
        
        // Estatísticas resumidas
        log('━━━ Estatísticas ━━━');
        log(`LongTasks: ${stats.longtasks.count} | Avg: ${stats.longtasks.avgDuration}ms | Max: ${stats.longtasks.maxDuration}ms | P90: ${stats.longtasks.p90}ms | P95: ${stats.longtasks.p95}ms`);
        log(`FPS Dips: ${stats.fpsDips.count} | Avg FPS: ${stats.fpsDips.avgFps}`);
        log(`FPS Atual: ${fpsMonitor.getCurrentFps()}`);
        
        // Suspeitos (se houver)
        if (suspects.length > 0) {
            log('━━━ 🔍 Suspeitos (por tempo total) ━━━');
            suspects.slice(0, 5).forEach((s, i) => {
                log(`${i + 1}. ${s.source}: ${s.count} ocorrências, ${s.totalDuration.toFixed(1)}ms total, max ${s.maxDuration.toFixed(1)}ms`);
            });
        }
        
        // Eventos recentes
        log('━━━ Eventos Recentes ━━━');
        events.forEach((e, i) => {
            const time = new Date(e.timestamp).toLocaleTimeString();
            if (e.type === 'longtask') {
                const sources = e.attribution.map(a => a.containerSrc || a.containerName || a.name).join(', ');
                log(`${i + 1}. [${time}] 🐌 LongTask: ${e.duration.toFixed(1)}ms ${sources ? '(' + sources + ')' : ''}`);
            } else if (e.type === 'fps-low') {
                log(`${i + 1}. [${time}] 📉 Low FPS: ${e.fps}`);
            }
        });
        
        // Diagnóstico automático
        log('━━━ 💡 Diagnóstico ━━━');
        if (stats.longtasks.count > 10) {
            log('⚠️ Muitos LongTasks detectados. Possíveis causas:');
            if (suspects[0]) {
                log(`   → Principal suspeito: ${suspects[0].source}`);
            }
        }
        if (parseFloat(stats.fpsDips.avgFps) < 45) {
            log('⚠️ FPS médio baixo. Considere reduzir efeitos visuais.');
        }
        if (stats.longtasks.count === 0 && stats.fpsDips.count === 0) {
            log('✅ Performance OK - nenhum problema detectado.');
        }
        
        console.groupEnd();
        return { events, stats, suspects };
    };

    window.__perfStats = function() {
        const stats = perfBuffer.getStats();
        console.group('📈 Performance Stats');
        log('Total eventos:', stats.totalEvents);
        log('LongTasks:', stats.longtasks);
        log('FPS Dips:', stats.fpsDips);
        log('FPS atual:', fpsMonitor.getCurrentFps());
        console.groupEnd();
        return stats;
    };
    
    window.__perfWorst = function() {
        const tasks = worstLongtasks.getAll();
        const suspects = worstLongtasks.getSuspects();
        
        console.group('🏆 Top 20 Piores LongTasks');
        
        tasks.forEach((t, i) => {
            const time = new Date(t.timestamp).toLocaleTimeString();
            const sources = t.attribution.map(a => a.containerSrc || a.containerName || a.name).filter(Boolean);
            log(`${i + 1}. ${t.duration.toFixed(1)}ms [${time}] ${sources.length ? sources.join(', ') : 'unknown'}`);
        });
        
        if (suspects.length > 0) {
            log('━━━ Principais Culpados ━━━');
            suspects.forEach((s, i) => {
                log(`${i + 1}. ${s.source}: ${s.count}x, ${s.totalDuration.toFixed(0)}ms total`);
            });
        }
        
        console.groupEnd();
        return { tasks, suspects };
    };

    window.__perfReset = function() {
        perfBuffer.clear();
        worstLongtasks.clear();
        log('🧹 [PerfMon] Buffers limpos');
    };

    // Expor FPS atual para outros módulos
    window.__getCurrentFps = function() {
        return fpsMonitor.getCurrentFps();
    };
    
    // Expor objeto perf para acesso direto
    window.__perf = {
        get buffer() { return perfBuffer.getAll(); },
        get stats() { return perfBuffer.getStats(); },
        get worstLongtasks() { return worstLongtasks.getAll(); },
        get suspects() { return worstLongtasks.getSuspects(); },
        get fps() { return fpsMonitor.getCurrentFps(); }
    };

    // ═══════════════════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    function init() {
        initLongtaskObserver();
        fpsMonitor.start();
        
        // Pausar FPS monitor quando aba oculta
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                fpsMonitor.stop();
            } else {
                fpsMonitor.start();
            }
        });
        
        // Log silencioso - só mostra no DEBUG_MODE
        if (CONFIG.DEBUG_MODE) {
            log('✅ [PerfMon] V2 Inicializado. Use __perfDump() para ver eventos.');
        }
    }

    // Iniciar quando DOM pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
