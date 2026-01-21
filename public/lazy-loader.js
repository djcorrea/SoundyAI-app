/* ============================================ */
/* 🚀 LAZY LOADER - Carregamento sob demanda  */
/* Bibliotecas pesadas só carregam quando     */
/* realmente necessárias                       */
/* ============================================ */

/**
 * Carrega jsPDF e html2canvas apenas quando necessário
 * @returns {Promise<void>}
 */
window.loadPDFLibraries = async function() {
    // Verifica se já foram carregadas
    if (window.jsPDF && window.html2canvas) {
        log('✅ [LAZY-LOADER] Bibliotecas PDF já carregadas');
        return;
    }
    
    log('⏳ [LAZY-LOADER] Carregando bibliotecas PDF sob demanda...');
    
    try {
        await Promise.all([
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
        ]);
        
        log('✅ [LAZY-LOADER] Bibliotecas PDF carregadas com sucesso');
    } catch (error) {
        error('❌ [LAZY-LOADER] Erro ao carregar bibliotecas PDF:', error);
        throw error;
    }
};

/**
 * Helper para carregar scripts dinamicamente
 * @param {string} src - URL do script
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Verifica se script já existe
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            log(`✅ [LAZY-LOADER] Script carregado: ${src.split('/').pop()}`);
            resolve();
        };
        script.onerror = () => {
            error(`❌ [LAZY-LOADER] Erro ao carregar: ${src}`);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
}

/**
 * Carrega Vanta.js e Three.js de forma adiada (após 2s)
 * Apenas em desktop (telas > 768px)
 * @returns {Promise<void>}
 */
window.loadVantaLibraries = async function() {
    // Não carregar em mobile (economia de recursos)
    if (window.innerWidth <= 768) {
        log('📱 [LAZY-LOADER] Vanta.js desabilitado no mobile');
        return;
    }
    
    // Verifica se já foram carregadas
    if (window.THREE && window.VANTA) {
        log('✅ [LAZY-LOADER] Bibliotecas Vanta já carregadas');
        return;
    }
    
    log('⏳ [LAZY-LOADER] Carregando Vanta.js (fundo 3D) de forma adiada...');
    
    try {
        // Carregar Three.js primeiro (dependência do Vanta)
        if (!window.THREE) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
        }
        
        // Carregar Vanta.js
        if (!window.VANTA) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.net.min.js');
        }
        
        log('✅ [LAZY-LOADER] Vanta.js carregado com sucesso');
        
        // Inicializar Vanta se houver função de inicialização
        if (typeof window.initVantaBackground === 'function') {
            window.initVantaBackground();
        }
    } catch (error) {
        error('❌ [LAZY-LOADER] Erro ao carregar Vanta.js:', error);
        // Não bloqueia a aplicação se falhar
    }
};

/**
 * Agenda carregamento adiado do Vanta.js
 * Executa 2 segundos após window.load
 */
window.addEventListener('load', function() {
    setTimeout(function() {
        window.loadVantaLibraries();
    }, 2000);
});

log('✅ [LAZY-LOADER] Sistema de lazy loading inicializado');
