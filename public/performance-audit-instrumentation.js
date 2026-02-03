/**
 * 🔍 INSTRUMENTAÇÃO MÍNIMA DE PERFORMANCE
 * ========================================
 * Sistema lightweight para detectar Long Tasks (> 50ms) via PerformanceObserver.
 * NÃO altera comportamento do app, apenas loga no console.
 * 
 * USAR:
 * 1. Importe no index.html: <script src="performance-audit-instrumentation.js"></script>
 * 2. Abra o console e veja os logs a cada 10s
 * 3. Para remover: delete o script e a tag do HTML
 * 
 * OUTPUT A CADA 10s:
 * - Contagem total de Long Tasks
 * - Top 5 maiores durações
 * - Total acumulado (ms)
 */

(function() {
    'use strict';
    
    const REPORT_INTERVAL = 10000; // 10 segundos
    const longTasks = [];
    let totalDuration = 0;
    
    // PerformanceObserver para Long Tasks (> 50ms)
    if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const duration = entry.duration;
                longTasks.push({
                    duration: duration.toFixed(2),
                    name: entry.name || 'unknown',
                    startTime: entry.startTime.toFixed(2),
                    attribution: entry.attribution?.[0]?.name || 'N/A'
                });
                totalDuration += duration;
            }
        });
        
        observer.observe({ entryTypes: ['longtask'] });
        console.log('✅ [PERF-AUDIT] PerformanceObserver ativo para Long Tasks');
    } else {
        console.warn('⚠️ [PERF-AUDIT] Long Task API não suportada neste navegador');
    }
    
    // Relatório a cada 10s
    setInterval(() => {
        if (longTasks.length === 0) {
            console.log('✅ [PERF-AUDIT] Nenhuma Long Task detectada nos últimos 10s');
            return;
        }
        
        // Top 5 por duração
        const top5 = [...longTasks]
            .sort((a, b) => parseFloat(b.duration) - parseFloat(a.duration))
            .slice(0, 5);
        
        console.group(`🚨 [PERF-AUDIT] ${longTasks.length} Long Tasks (últimos 10s)`);
        console.log(`⏱️ Total acumulado: ${totalDuration.toFixed(2)}ms`);
        console.log(`📊 Top 5 maiores:`);
        top5.forEach((task, i) => {
            console.log(`  ${i + 1}. ${task.duration}ms [${task.name}] @ ${task.startTime}ms | ${task.attribution}`);
        });
        console.groupEnd();
        
        // Reset
        longTasks.length = 0;
        totalDuration = 0;
    }, REPORT_INTERVAL);
    
    console.log('🎯 [PERF-AUDIT] Instrumentação ativa. Relatórios a cada 10s.');
})();
