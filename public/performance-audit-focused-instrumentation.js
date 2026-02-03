/**
 * 🎯 INSTRUMENTAÇÃO FOCADA - FLUXO DE ANÁLISE DE ÁUDIO
 * =======================================================
 * Sistema mínimo para medir performance do fluxo "Analisar Áudio" → Resultados.
 * 
 * USAR:
 * 1. Adicione ao index.html: <script src="performance-audit-focused-instrumentation.js"></script>
 * 2. Abra console (F12)
 * 3. Clique em "Analisar áudio"
 * 4. Veja checkpoints + Long Tasks
 * 5. Ao terminar análise, veja relatório completo
 * 
 * OUTPUT:
 * - Checkpoints do fluxo (início upload, fim decode, fim FFT, fim render)
 * - Long Tasks detectadas (> 50ms)
 * - Duração total da análise
 * - Top 5 Long Tasks
 */

(function() {
    'use strict';
    
    const LONG_TASK_THRESHOLD = 50; // ms
    const checkpoints = [];
    const longTasks = [];
    let analysisStartTime = null;
    let intervalCheckActive = false;
    
    // PerformanceObserver para Long Tasks
    if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                longTasks.push({
                    duration: entry.duration.toFixed(2),
                    name: entry.name || 'unknown',
                    startTime: entry.startTime.toFixed(2),
                    attribution: entry.attribution?.[0]?.name || 'N/A'
                });
                
                // Log imediato para tarefas muito longas (> 200ms)
                if (entry.duration > 200) {
                    console.warn(`🚨 [PERF] Long Task: ${entry.duration.toFixed(2)}ms @ ${entry.startTime.toFixed(2)}ms`);
                }
            }
        });
        
        observer.observe({ entryTypes: ['longtask'] });
        console.log('✅ [PERF-AUDIT] Long Task Observer ativo');
    } else {
        console.warn('⚠️ [PERF-AUDIT] Long Task API não suportada');
    }
    
    // Função helper para adicionar checkpoint
    window.__perfCheckpoint = function(name) {
        const now = performance.now();
        const relativeTo = analysisStartTime || now;
        const elapsed = now - relativeTo;
        
        checkpoints.push({
            name,
            time: now.toFixed(2),
            elapsed: elapsed.toFixed(2)
        });
        
        console.log(`⏱️ [CHECKPOINT] ${name} @ +${elapsed.toFixed(2)}ms`);
    };
    
    // Interceptar início de análise
    const originalHandleModalFileSelection = window.handleModalFileSelection;
    if (typeof originalHandleModalFileSelection === 'function') {
        window.handleModalFileSelection = async function(...args) {
            analysisStartTime = performance.now();
            checkpoints.length = 0; // Reset
            longTasks.length = 0; // Reset
            intervalCheckActive = true;
            
            console.group('🎯 [PERF-AUDIT] ANÁLISE INICIADA');
            window.__perfCheckpoint('00_analysis_start');
            console.groupEnd();
            
            try {
                const result = await originalHandleModalFileSelection.apply(this, args);
                return result;
            } finally {
                // Nota: Não chamamos finalize aqui, esperamos análise terminar
            }
        };
        console.log('✅ [PERF-AUDIT] Interceptado handleModalFileSelection');
    } else {
        console.warn('⚠️ [PERF-AUDIT] handleModalFileSelection não encontrado - aguardando...');
        
        // Retry até encontrar (max 10s)
        let attempts = 0;
        const retry = setInterval(() => {
            attempts++;
            if (typeof window.handleModalFileSelection === 'function') {
                clearInterval(retry);
                console.log('✅ [PERF-AUDIT] handleModalFileSelection encontrado após', attempts * 100, 'ms');
                
                const originalHandleModalFileSelection = window.handleModalFileSelection;
                window.handleModalFileSelection = async function(...args) {
                    analysisStartTime = performance.now();
                    checkpoints.length = 0;
                    longTasks.length = 0;
                    intervalCheckActive = true;
                    
                    console.group('🎯 [PERF-AUDIT] ANÁLISE INICIADA');
                    window.__perfCheckpoint('00_analysis_start');
                    console.groupEnd();
                    
                    try {
                        const result = await originalHandleModalFileSelection.apply(this, args);
                        return result;
                    } finally {
                        // Esperamos eventos customizados
                    }
                };
            } else if (attempts > 100) {
                clearInterval(retry);
                console.error('❌ [PERF-AUDIT] handleModalFileSelection não encontrado após 10s');
            }
        }, 100);
    }
    
    // Interceptar analyzeAudioFile (se audio-analyzer.js já carregou)
    function interceptAnalyzer() {
        if (window.audioAnalyzer && typeof window.audioAnalyzer.analyzeAudioFile === 'function') {
            const original = window.audioAnalyzer.analyzeAudioFile;
            window.audioAnalyzer.analyzeAudioFile = async function(file, options) {
                window.__perfCheckpoint('01_start_decode');
                
                try {
                    const result = await original.call(this, file, options);
                    window.__perfCheckpoint('02_end_analysis');
                    return result;
                } catch (err) {
                    window.__perfCheckpoint('02_error_analysis');
                    throw err;
                }
            };
            console.log('✅ [PERF-AUDIT] Interceptado audioAnalyzer.analyzeAudioFile');
            return true;
        }
        return false;
    }
    
    // Tentar interceptar imediatamente
    if (!interceptAnalyzer()) {
        // Retry até encontrar (max 15s)
        let attempts = 0;
        const retry = setInterval(() => {
            attempts++;
            if (interceptAnalyzer()) {
                clearInterval(retry);
            } else if (attempts > 150) {
                clearInterval(retry);
                console.error('❌ [PERF-AUDIT] audioAnalyzer não encontrado após 15s');
            }
        }, 100);
    }
    
    // Interceptar renderização de resultados (showModalResults)
    const originalShowModalResults = window.showModalResults;
    if (typeof originalShowModalResults === 'function') {
        window.showModalResults = function(...args) {
            window.__perfCheckpoint('03_start_render');
            
            const result = originalShowModalResults.apply(this, args);
            
            // Aguardar um pouco para garantir que DOM foi atualizado
            requestAnimationFrame(() => {
                window.__perfCheckpoint('04_end_render');
                finalize();
            });
            
            return result;
        };
        console.log('✅ [PERF-AUDIT] Interceptado showModalResults');
    }
    
    // Função para finalizar e mostrar relatório
    function finalize() {
        if (!analysisStartTime) {
            console.log('ℹ️ [PERF-AUDIT] Nenhuma análise detectada ainda');
            return;
        }
        
        intervalCheckActive = false;
        const totalDuration = performance.now() - analysisStartTime;
        
        console.group('📊 [PERF-AUDIT] RELATÓRIO FINAL');
        console.log(`⏱️ Duração total: ${totalDuration.toFixed(2)}ms (${(totalDuration/1000).toFixed(2)}s)`);
        
        console.log('\n📍 Checkpoints:');
        checkpoints.forEach(cp => {
            console.log(`  ${cp.name}: +${cp.elapsed}ms`);
        });
        
        if (longTasks.length > 0) {
            const top5 = [...longTasks]
                .sort((a, b) => parseFloat(b.duration) - parseFloat(a.duration))
                .slice(0, 5);
            
            console.log(`\n🚨 Long Tasks detectadas: ${longTasks.length}`);
            console.log('Top 5 maiores:');
            top5.forEach((task, i) => {
                console.log(`  ${i + 1}. ${task.duration}ms [${task.name}] @ ${task.startTime}ms`);
            });
            
            const totalLongTaskTime = longTasks.reduce((sum, t) => sum + parseFloat(t.duration), 0);
            const percentage = ((totalLongTaskTime / totalDuration) * 100).toFixed(1);
            console.log(`\n⚠️ Tempo total em Long Tasks: ${totalLongTaskTime.toFixed(2)}ms (${percentage}% do total)`);
        } else {
            console.log('\n✅ Nenhuma Long Task detectada!');
        }
        
        console.groupEnd();
        
        // Resetar para próxima análise
        analysisStartTime = null;
    }
    
    // Listener para eventos customizados (caso existam)
    if (window.addEventListener) {
        window.addEventListener('audio-analysis-started', () => {
            if (!analysisStartTime) {
                analysisStartTime = performance.now();
                window.__perfCheckpoint('00_analysis_start_event');
            }
        });
        
        window.addEventListener('audio-analysis-completed', () => {
            window.__perfCheckpoint('99_analysis_completed_event');
            setTimeout(finalize, 500); // Aguardar render finalizar
        });
    }
    
    // Detecção de interval polling (aquele setInterval 100ms do index.html)
    let intervalCallCount = 0;
    let intervalStartTime = performance.now();
    
    setInterval(() => {
        if (intervalCheckActive) {
            intervalCallCount++;
            
            if (intervalCallCount % 50 === 0) { // A cada 5s
                const elapsed = performance.now() - intervalStartTime;
                const rate = (intervalCallCount / (elapsed / 1000)).toFixed(1);
                console.log(`📊 [INTERVAL-CHECK] ${intervalCallCount} calls em ${(elapsed/1000).toFixed(1)}s (${rate} calls/s)`);
            }
        }
    }, 100);
    
    // Expor função manual de finalização
    window.__perfFinalize = finalize;
    
    console.log('🎯 [PERF-AUDIT] Instrumentação focada ativa.');
    console.log('💡 Comandos disponíveis:');
    console.log('   window.__perfCheckpoint("nome") - Adicionar checkpoint manual');
    console.log('   window.__perfFinalize() - Finalizar e mostrar relatório');
})();
