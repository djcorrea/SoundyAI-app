// 🚀 LAZY LOAD DE CSS DE MODAIS (P0 - Performance Critical)
// Este arquivo carrega CSS de modais apenas quando necessário

(function() {
    let modalCSSLoaded = false;
    
    /**
     * Carrega todos os CSS de modais de análise
     * Chamado apenas quando usuário abre modal pela primeira vez
     */
    window.loadModalCSS = async function() {
        if (modalCSSLoaded) {
            console.log('✅ [LAZY-CSS] CSS de modais já carregados');
            return;
        }
        
        console.log('🎨 [LAZY-CSS] Carregando CSS de modais...');
        
        const modalStyles = [
            '/audio-analyzer.css?v=20250810',
            '/ultra-advanced-styles.css?v=20250920-ultra',
            '/ai-suggestion-styles.css?v=20250922-ai-layer',
            '/ai-suggestions-expanded.css?v=20250922-expanded',
            '/ai-suggestions-futuristic.css?v=20250923-cyberpunk',
            '/ScoreFinal.css?v=20251021-futuristic',
            '/music-button-below-chat.css?v=20250810',
            '/image-upload-styles.css?v=20241219'
        ];
        
        try {
            // Carregar todos em paralelo
            await Promise.all(modalStyles.map(href => {
                if (window.loadCSS) {
                    return window.loadCSS(href);
                } else {
                    // Fallback se loadCSS não estiver disponível
                    return new Promise((resolve) => {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = href;
                        link.onload = resolve;
                        link.onerror = resolve;
                        document.head.appendChild(link);
                    });
                }
            }));
            
            modalCSSLoaded = true;
            console.log('✅ [LAZY-CSS] CSS de modais carregados');
        } catch (error) {
            console.warn('⚠️ [LAZY-CSS] Erro ao carregar alguns CSS:', error.message);
        }
    };
    
    // Pré-carregar CSS ao passar mouse no botão "Analisar"
    // (técnica de prefetching para UX mais suave)
    document.addEventListener('DOMContentLoaded', () => {
        const analyzeButtons = document.querySelectorAll('[data-action="analyze"], .side-panel-item[data-action="analyze"]');
        
        analyzeButtons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                // Pré-carregar ao hover (apenas desktop)
                if (window.DEVICE_TIER === 'desktop') {
                    window.loadModalCSS();
                }
            }, { once: true }); // Apenas primeira vez
        });
    });
    
    console.log('✅ [LAZY-CSS] Sistema de lazy load de modais inicializado');
})();
