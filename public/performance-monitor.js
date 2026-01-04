/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 PERFORMANCE MONITOR - SoundyAI
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * MUDANÇAS IMPLEMENTADAS:
 * 1. PerformanceObserver para longtask com duração, timestamp e attribution
 * 2. Medidor de FPS via requestAnimationFrame com alerta quando < 50 por > 2s
 * 3. Buffer circular de 30 eventos + window.__perfDump() para debug
 * 4. Integração com EffectsController para degradação automática
 * 
 * USO NO CONSOLE:
 * - window.__perfDump()     → Ver últimos 30 eventos
 * - window.__perfStats()    → Ver estatísticas resumidas
 * - window.__perfReset()    → Limpar buffer
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
        FPS_SAMPLE_INTERVAL: 500, // ms entre amostras
        LOW_FPS_THRESHOLD: 50,
        LOW_FPS_DURATION_ALERT: 2000, // 2 segundos
        LONGTASK_THRESHOLD: 50, // ms (padrão W3C)
        DEBUG_MODE: false // Mudar para true para logs detalhados
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
            
            return {
                totalEvents: this.events.length,
                longtasks: {
                    count: longtasks.length,
                    avgDuration: longtasks.length 
                        ? (longtasks.reduce((s, e) => s + e.duration, 0) / longtasks.length).toFixed(2) 
                        : 0,
                    maxDuration: longtasks.length 
                        ? Math.max(...longtasks.map(e => e.duration)).toFixed(2) 
                        : 0
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
    // LONGTASK OBSERVER
    // ═══════════════════════════════════════════════════════════════════
    let longtaskObserver = null;

    function initLongtaskObserver() {
        if (!('PerformanceObserver' in window)) {
            console.warn('⚠️ [PerfMon] PerformanceObserver não suportado');
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
                    
                    perfBuffer.add(event);
                    
                    if (CONFIG.DEBUG_MODE) {
                        console.warn(`🐌 [LongTask] ${entry.duration.toFixed(1)}ms`, event.attribution);
                    }
                    
                    // Notificar EffectsController se task muito longa
                    if (entry.duration > 100 && window.EffectsController) {
                        window.EffectsController.onLongTask(entry.duration);
                    }
                }
            });

            longtaskObserver.observe({ entryTypes: ['longtask'] });
            if (CONFIG.DEBUG_MODE) {
                console.log('✅ [PerfMon] LongTask observer ativo');
            }
        } catch (e) {
            console.warn('⚠️ [PerfMon] Falha ao criar LongTask observer:', e.message);
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
                console.log('✅ [PerfMon] FPS monitor ativo');
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
                console.warn(`📉 [FPS] ${this.fps} FPS por ${CONFIG.LOW_FPS_DURATION_ALERT}ms`);
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
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════
    window.__perfDump = function() {
        const events = perfBuffer.getAll();
        console.group('📊 Performance Dump (' + events.length + ' eventos)');
        
        events.forEach((e, i) => {
            const time = new Date(e.timestamp).toLocaleTimeString();
            if (e.type === 'longtask') {
                console.log(`${i + 1}. [${time}] 🐌 LongTask: ${e.duration.toFixed(1)}ms`, e.attribution);
            } else if (e.type === 'fps-low') {
                console.log(`${i + 1}. [${time}] 📉 Low FPS: ${e.fps}`);
            } else {
                console.log(`${i + 1}. [${time}] ${e.type}:`, e);
            }
        });
        
        console.groupEnd();
        return events;
    };

    window.__perfStats = function() {
        const stats = perfBuffer.getStats();
        console.group('📈 Performance Stats');
        console.log('Total eventos:', stats.totalEvents);
        console.log('LongTasks:', stats.longtasks);
        console.log('FPS Dips:', stats.fpsDips);
        console.log('FPS atual:', fpsMonitor.getCurrentFps());
        console.groupEnd();
        return stats;
    };

    window.__perfReset = function() {
        perfBuffer.clear();
        console.log('🧹 [PerfMon] Buffer limpo');
    };

    // Expor FPS atual para outros módulos
    window.__getCurrentFps = function() {
        return fpsMonitor.getCurrentFps();
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
        
        console.log('✅ [PerfMon] Inicializado. Use __perfDump() para ver eventos.');
    }

    // Iniciar quando DOM pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
