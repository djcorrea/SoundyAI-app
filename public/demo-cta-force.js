/**
 * 🔥 FORÇA BRUTA: CTA DEMO
 * Exibe CTA imediatamente após resultado aparecer
 * GARANTIDO - sem depender de outros módulos
 */

(function() {
    'use strict';
    
    console.log('🔥 [CTA-FORCE] Módulo carregado');
    
    // Verificar se é modo demo
    const isDemo = window.location.pathname.includes('/demo') || 
                   window.location.search.includes('mode=demo');
    
    if (!isDemo) {
        console.log('⚠️ [CTA-FORCE] Não é modo demo, encerrando');
        return;
    }
    
    console.log('✅ [CTA-FORCE] Modo demo detectado!');
    
    // Verificar se já mostrou CTA
    let ctaShown = false;
    
    // Função para injetar CTA no DOM
    function injectCTA() {
        if (ctaShown) {
            console.log('ℹ️ [CTA-FORCE] CTA já foi exibido');
            return;
        }
        
        if (document.querySelector('.demo-first-analysis-banner')) {
            console.log('ℹ️ [CTA-FORCE] Banner já existe no DOM');
            return;
        }
        
        console.log('🎉 [CTA-FORCE] Injetando CTA no DOM...');
        
        ctaShown = true;
        
        // Banner superior
        const topBanner = createBanner('top');
        document.body.insertBefore(topBanner, document.body.firstChild);
        
        // Banner inferior
        const bottomBanner = createBanner('bottom');
        document.body.appendChild(bottomBanner);
        
        // Adicionar estilos
        injectStyles();
        
        // Animar
        setTimeout(() => {
            topBanner.style.transform = 'translateY(0)';
            topBanner.style.opacity = '1';
            bottomBanner.style.transform = 'translateY(0)';
            bottomBanner.style.opacity = '1';
        }, 100);
        
        console.log('✅ [CTA-FORCE] Banners injetados com sucesso!');
    }
    
    function createBanner(position) {
        const banner = document.createElement('div');
        banner.className = `demo-first-analysis-banner demo-first-analysis-banner-${position}`;
        banner.setAttribute('data-position', position);
        
        banner.innerHTML = `
            <div class="demo-first-analysis-content">
                <div class="demo-first-analysis-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                </div>
                <div class="demo-first-analysis-text">
                    <h3>⚠️ Análise teste concluída</h3>
                    <p>O que você viu é só 30% do diagnóstico real. Descubra como ter acesso completo e ilimitado.</p>
                </div>
                <button class="demo-first-analysis-button" onclick="window.location.href='https://musicaprofissional.com.br/#oferta'">
                    Desbloquear acesso completo
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        `;
        
        return banner;
    }
    
    function injectStyles() {
        if (document.getElementById('demoFirstAnalysisCTAStyles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'demoFirstAnalysisCTAStyles';
        styles.textContent = `
            .demo-first-analysis-banner {
                position: fixed;
                left: 0;
                right: 0;
                z-index: 999999;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 2px solid rgba(188, 19, 254, 0.5);
                box-shadow: 0 4px 20px rgba(188, 19, 254, 0.3);
                padding: 20px;
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .demo-first-analysis-banner-top {
                top: 0;
                transform: translateY(-100%);
                border-bottom-left-radius: 12px;
                border-bottom-right-radius: 12px;
                border-top: none;
            }
            
            .demo-first-analysis-banner-bottom {
                bottom: 0;
                transform: translateY(100%);
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                border-bottom: none;
            }
            
            .demo-first-analysis-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                gap: 20px;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .demo-first-analysis-icon {
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #00f3ff 0%, #bc13fe 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                animation: demoPulseSmall 2s infinite;
            }
            
            @keyframes demoPulseSmall {
                0%, 100% { box-shadow: 0 0 15px rgba(0, 243, 255, 0.5); }
                50% { box-shadow: 0 0 25px rgba(188, 19, 254, 0.7); }
            }
            
            .demo-first-analysis-icon svg {
                width: 24px;
                height: 24px;
                stroke: white;
            }
            
            .demo-first-analysis-text {
                flex: 1;
                min-width: 300px;
                text-align: left;
            }
            
            .demo-first-analysis-text h3 {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1.4rem;
                font-weight: 700;
                color: #ffffff;
                margin: 0 0 6px 0;
                line-height: 1.3;
            }
            
            .demo-first-analysis-text p {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1rem;
                color: #b0b0d0;
                margin: 0;
                line-height: 1.5;
            }
            
            .demo-first-analysis-button {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 14px 28px;
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1.05rem;
                font-weight: 700;
                color: #ffffff;
                background: linear-gradient(135deg, #00f3ff 0%, #bc13fe 100%);
                border: none;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
                flex-shrink: 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .demo-first-analysis-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 25px rgba(188, 19, 254, 0.6);
            }
            
            .demo-first-analysis-button svg {
                width: 16px;
                height: 16px;
                stroke: white;
            }
            
            @media (max-width: 768px) {
                .demo-first-analysis-banner {
                    padding: 16px;
                }
                
                .demo-first-analysis-content {
                    flex-direction: column;
                    text-align: center;
                    gap: 16px;
                }
                
                .demo-first-analysis-text {
                    text-align: center;
                    min-width: auto;
                }
                
                .demo-first-analysis-text h3 {
                    font-size: 1.2rem;
                }
                
                .demo-first-analysis-text p {
                    font-size: 0.95rem;
                }
                
                .demo-first-analysis-button {
                    width: 100%;
                    justify-content: center;
                    padding: 12px 20px;
                    font-size: 1rem;
                }
                
                .demo-first-analysis-icon {
                    width: 40px;
                    height: 40px;
                }
                
                .demo-first-analysis-icon svg {
                    width: 20px;
                    height: 20px;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // ESTRATÉGIA 1: Observar #scoreDisplay
    const observer = setInterval(() => {
        const scoreDisplay = document.querySelector('#scoreDisplay');
        const hasScore = scoreDisplay && scoreDisplay.textContent.trim().length > 0;
        
        if (hasScore) {
            console.log('🎯 [CTA-FORCE] Score detectado! Exibindo CTA em 2s...');
            clearInterval(observer);
            setTimeout(injectCTA, 2000);
        }
    }, 500);
    
    // ESTRATÉGIA 2: Listener evento audio-analysis-finished
    window.addEventListener('audio-analysis-finished', function(e) {
        console.log('🎯 [CTA-FORCE] Evento audio-analysis-finished recebido');
        setTimeout(injectCTA, 2000);
    });
    
    // ESTRATÉGIA 3: Timeout após 10s (fallback)
    setTimeout(() => {
        const scoreDisplay = document.querySelector('#scoreDisplay');
        if (scoreDisplay && scoreDisplay.textContent.trim().length > 0) {
            console.log('🎯 [CTA-FORCE] Fallback: Score existe, exibindo CTA');
            injectCTA();
        }
    }, 10000);
    
    // Limpar observer após 30s
    setTimeout(() => clearInterval(observer), 30000);
    
    console.log('✅ [CTA-FORCE] Listeners e observadores configurados');
    
})();
