// 🚀 AUDIO ANALYZER LAZY LOADER (P0 - Performance Critical)
// Carrega audio-analyzer-integration.js (~34K linhas) apenas quando necessário

(function() {
    let analyzerLoaded = false;
    let analyzerModule = null;
    
    /**
     * Carrega o módulo de análise de áudio sob demanda
     * @returns {Promise<Object>} - Módulo audio-analyzer carregado
     */
    async function loadAudioAnalyzer() {
        if (analyzerLoaded && analyzerModule) {
            console.log('✅ [LAZY-ANALYZER] Analyzer já carregado');
            return analyzerModule;
        }
        
        console.log('🎵 [LAZY-ANALYZER] Carregando audio analyzer (~34K linhas)...');
        
        try {
            // Carregar CSS de modais primeiro (se não carregado)
            if (window.loadModalCSS) {
                await window.loadModalCSS();
            }
            
            // Carregar jsPDF e html2canvas se desktop
            if (window.DEVICE_TIER === 'desktop') {
                console.log('📄 [LAZY-ANALYZER] Carregando libs de PDF export (desktop only)...');
                await Promise.all([
                    window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
                    window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
                ]);
                console.log('✅ [LAZY-ANALYZER] Libs de PDF carregadas');
            }
            
            // Carregar o audio-analyzer-integration.js
            await window.loadScript('/audio-analyzer-integration.js?v=20260120');
            
            // Aguardar módulo estar disponível
            let attempts = 0;
            while (!window.openModeSelectionModal && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (window.openModeSelectionModal) {
                analyzerModule = {
                    openModeSelectionModal: window.openModeSelectionModal,
                    // Adicionar outras funções exportadas se necessário
                };
                analyzerLoaded = true;
                console.log('✅ [LAZY-ANALYZER] Audio analyzer carregado e pronto');
            } else {
                throw new Error('openModeSelectionModal não disponível após load');
            }
            
            return analyzerModule;
        } catch (error) {
            console.error('❌ [LAZY-ANALYZER] Erro ao carregar audio analyzer:', error);
            throw error;
        }
    }
    
    /**
     * Wrapper para openModeSelectionModal com lazy load
     */
    window.openAudioAnalyzer = async function() {
        console.log('🎵 [AUDIO-ANALYZER] Requisição de análise recebida');
        
        try {
            const analyzer = await loadAudioAnalyzer();
            
            if (analyzer && analyzer.openModeSelectionModal) {
                console.log('✅ [AUDIO-ANALYZER] Abrindo modal de seleção');
                analyzer.openModeSelectionModal();
            } else {
                throw new Error('Módulo analyzer não disponível');
            }
        } catch (error) {
            console.error('❌ [AUDIO-ANALYZER] Erro ao abrir:', error);
            alert('Erro ao carregar sistema de análise. Recarregue a página e tente novamente.');
        }
    };
    
    // Alias para compatibilidade
    window.openModeSelectionModal = window.openAudioAnalyzer;
    
    console.log('✅ [LAZY-ANALYZER] Sistema de lazy load inicializado');
})();
