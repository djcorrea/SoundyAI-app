/**
 * 🚀 LAZY LOADER - Audio Analyzer
 * ================================
 * Sistema de carregamento sob demanda do audio-analyzer para reduzir JS inicial.
 * Carrega os scripts apenas quando o usuário clica em "Análise de áudio".
 * 
 * BENEFÍCIOS:
 * - Reduz ~9s de processamento JS no load inicial
 * - audio-analyzer-integration.js (34k linhas) só carrega quando necessário
 * - Melhora Page Speed Insights e reduz contenção com FL Studio
 */

(function() {
    'use strict';
    
    // Estado do carregamento
    let isLoading = false;
    let isLoaded = false;
    const loadPromises = [];
    
    /**
     * Carrega um script dinamicamente
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // Verificar se já está carregado
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Carrega todos os scripts do audio analyzer
     */
    async function loadAudioAnalyzer() {
        if (isLoaded) {
            console.log('✅ [LAZY-LOAD] Audio Analyzer já carregado');
            return;
        }
        
        if (isLoading) {
            console.log('⏳ [LAZY-LOAD] Aguardando carregamento em andamento...');
            await Promise.all(loadPromises);
            return;
        }
        
        isLoading = true;
        console.log('🚀 [LAZY-LOAD] Iniciando carregamento do Audio Analyzer...');
        
        try {
            // Ordem de carregamento (dependências primeiro)
            const scriptsToLoad = [
                // Core analyzer
                'audio-analyzer.js?v=20250825-memory-fix',
                
                // Dependencies
                'cache-context-aware-v1.js?v=20250829-ctx-aware',
                'refs/embedded-refs-new.js?v=20250829-true-peak-fix&timestamp=1756500921',
                
                // Suggestion systems
                'suggestion-scorer.js?v=20250920-enhanced',
                'enhanced-suggestion-engine.js?v=20250920-enhanced',
                'advanced-educational-suggestion-system.js?v=20250920-ultra',
                'ultra-advanced-suggestion-enhancer-v2.js?v=20250920-ultra-v2',
                'validador-integracao-ultra-avancado.js?v=20250920-validator',
                'monitor-modal-ultra-avancado.js?v=20250920-monitor',
                'suggestion-text-generator.js?v=20250815',
                'suggestion-system-emergency.js?v=emergency-20250920',
                
                // AI Layer (7 files)
                'ai-suggestion-layer.js?v=20250922-ai-layer',
                'ai-configuration-manager.js?v=20250922-config',
                'ai-suggestion-ui-controller.js?v=20250922-ui',
                'ai-suggestions-integration.js?v=20250922-integration',
                'ai-suggestion-system-tester.js?v=20250922-test',
                'ai-force-test.js?v=20250922-force',
                'ai-auto-config.js?v=20250922-autoconfig',
                'secure-api-loader.js?v=20250922-secure',
                
                // Utils
                'secure-render-utils.js?v=2.0.0',
                'reduced-mode-security-guard.js?v=1.0.0',
                'reference-mode-auditor.js?v=AUDIT',
                'reference-flow.js?v=1.0.0',
                'reference-normalizer.js?v=1.0.0',
                'reference-trace-utils.js?v=PR1',
                'lib/audio/utils/band-key-aliases.js?v=1.0.0',
                'lib/audio/features/score-engine-v3.js?v=3.3.0',
                'tooltip-manager.js?v=20260105-tooltips',
                'error-mapper.js?v=1.0.0',
                
                // Integration (deve ser o último)
                'audio-analyzer-integration.js?v=20260130_1'
            ];
            
            // Carregar em paralelo (navegador vai respeitar ordem via defer)
            const promises = scriptsToLoad.map(src => loadScript(src));
            loadPromises.push(...promises);
            
            await Promise.all(promises);
            
            console.log('✅ [LAZY-LOAD] Scripts carregados');
            
            // Aguardar inicialização
            await waitForInitialization();
            
            isLoaded = true;
            isLoading = false;
            
            console.log('✅ [LAZY-LOAD] Audio Analyzer pronto!');
            
            // Disparar evento customizado
            window.dispatchEvent(new CustomEvent('audioAnalyzerLoaded'));
            
        } catch (error) {
            isLoading = false;
            console.error('❌ [LAZY-LOAD] Erro ao carregar:', error);
            throw error;
        }
    }
    
    /**
     * Aguarda inicialização completa do audio analyzer
     */
    function waitForInitialization() {
        return new Promise((resolve) => {
            const maxAttempts = 100; // 10 segundos
            let attempts = 0;
            
            const check = () => {
                attempts++;
                
                if (typeof initializeAudioAnalyzerIntegration === 'function' && 
                    window.audioAnalyzer) {
                    console.log('✅ [LAZY-LOAD] Audio Analyzer detectado');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.warn('⚠️ [LAZY-LOAD] Timeout esperando inicialização');
                    resolve(); // Resolve anyway para não travar
                } else {
                    setTimeout(check, 100);
                }
            };
            
            check();
        });
    }
    
    /**
     * Intercepta cliques nos botões de análise
     */
    function interceptAnalysisButtons() {
        // Botão principal "Análise de áudio"
        document.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-action="analyze"]') || 
                          e.target.closest('#musicAnalysisBtn') ||
                          e.target.closest('.btn-analyze-highlight');
            
            if (!target) return;
            
            // Se já carregou, deixa fluir
            if (isLoaded) return;
            
            // Prevenir ação padrão
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🎯 [LAZY-LOAD] Detectado clique em análise - carregando...');
            
            // Mostrar loading
            showLoadingOverlay();
            
            try {
                await loadAudioAnalyzer();
                
                // Remover loading
                hideLoadingOverlay();
                
                // Re-disparar clique
                target.click();
                
            } catch (error) {
                hideLoadingOverlay();
                alert('Erro ao carregar sistema de análise. Por favor, recarregue a página.');
            }
        }, true); // useCapture para pegar antes de outros handlers
        
        console.log('✅ [LAZY-LOAD] Interceptor de botões ativo');
    }
    
    /**
     * Mostra overlay de loading
     */
    function showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'lazy-load-overlay';
        overlay.innerHTML = `
            <style>
                #lazy-load-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(10, 10, 26, 0.95);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 999999;
                    animation: fadeIn 0.3s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                #lazy-load-overlay .content {
                    text-align: center;
                    color: white;
                }
                #lazy-load-overlay .spinner {
                    width: 50px;
                    height: 50px;
                    margin: 0 auto 20px;
                    border: 3px solid rgba(138, 43, 226, 0.3);
                    border-top-color: #8a2be2;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                #lazy-load-overlay h3 {
                    font-size: 1.5rem;
                    margin-bottom: 10px;
                    background: linear-gradient(135deg, #8a2be2, #4a90e2);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                #lazy-load-overlay p {
                    font-size: 0.9rem;
                    opacity: 0.7;
                }
            </style>
            <div class="content">
                <div class="spinner"></div>
                <h3>🚀 Preparando Sistema de Análise</h3>
                <p>Carregando módulos... isso levará apenas alguns segundos</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    /**
     * Remove overlay de loading
     */
    function hideLoadingOverlay() {
        const overlay = document.getElementById('lazy-load-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }
    }
    
    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', interceptAnalysisButtons);
    } else {
        interceptAnalysisButtons();
    }
    
    // Expor globalmente
    window.loadAudioAnalyzer = loadAudioAnalyzer;
    
    console.log('🎯 [LAZY-LOAD] Sistema de lazy load do Audio Analyzer ativo');
})();
