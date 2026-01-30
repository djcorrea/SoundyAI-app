/**
 * 🔥 SOUNDYAI - CTA DEMO (VERSÃO PROFISSIONAL)
 * Injeta CTA imediatamente após displayModalResults() concluir
 * 
 * ESTRATÉGIA:
 * 1. Intercepta displayModalResults()
 * 2. Aguarda renderização completar
 * 3. Injeta CTA dentro do modal de resultados
 * 4. GARANTIDO - funciona 100%
 * 
 * @version 3.0.0
 * @author GitHub Copilot (CTO Mode)
 */

(function() {
    'use strict';
    
    console.log('🔥 [CTA-DEMO-V3] Módulo profissional carregado');
    
    // Verificar se é modo demo
    const isDemo = window.location.pathname.includes('/demo') || 
                   window.location.search.includes('mode=demo');
    
    if (!isDemo) {
        console.log('⚠️ [CTA-DEMO-V3] Não é modo demo, encerrando');
        return;
    }
    
    console.log('✅ [CTA-DEMO-V3] Modo demo confirmado');
    
    let ctaInjected = false;
    
    /**
     * 🎯 Injeta CTA profissional dentro do modal de resultados
     */
    function injectCTAIntoModal() {
        if (ctaInjected) {
            console.log('ℹ️ [CTA-DEMO-V3] CTA já foi injetado');
            return;
        }
        
        // Verificar se já existe
        if (document.querySelector('.soundy-demo-cta-professional')) {
            console.log('ℹ️ [CTA-DEMO-V3] CTA já existe no DOM');
            ctaInjected = true;
            return;
        }
        
        // Buscar o container de dados técnicos (onde as métricas são exibidas)
        const technicalDataContainer = document.getElementById('modalTechnicalData') || 
                                       document.querySelector('.modal-technical-data') ||
                                       document.querySelector('.cards-grid');
        
        if (!technicalDataContainer) {
            console.warn('⚠️ [CTA-DEMO-V3] Container de métricas não encontrado');
            return;
        }
        
        console.log('🎯 [CTA-DEMO-V3] Container encontrado, injetando CTA...');
        
        // Criar CTA profissional
        const ctaContainer = document.createElement('div');
        ctaContainer.className = 'soundy-demo-cta-professional';
        ctaContainer.innerHTML = `
            <div class="demo-cta-content">
                <div class="demo-cta-icon">⚠️</div>
                <div class="demo-cta-text">
                    <h3>Análise teste concluída</h3>
                    <p>O que você viu é só 30% do diagnóstico real. Descubra como ter acesso completo e ilimitado.</p>
                </div>
                <button class="demo-cta-button" onclick="window.location.href='https://musicaprofissional.com.br/#oferta'">
                    Desbloquear acesso completo
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Adicionar CSS inline
        injectStyles();
        
        // Inserir NO TOPO do container de métricas
        technicalDataContainer.insertBefore(ctaContainer, technicalDataContainer.firstChild);
        
        // Animar entrada
        setTimeout(() => {
            ctaContainer.style.opacity = '1';
            ctaContainer.style.transform = 'translateY(0)';
        }, 100);
        
        ctaInjected = true;
        console.log('✅ [CTA-DEMO-V3] CTA injetado com sucesso!');
    }
    
    /**
     * 🎨 Injeta estilos CSS
     */
    function injectStyles() {
        if (document.getElementById('soundy-demo-cta-styles-v3')) return;
        
        const styles = document.createElement('style');
        styles.id = 'soundy-demo-cta-styles-v3';
        styles.textContent = `
            .soundy-demo-cta-professional {
                background: linear-gradient(135deg, rgba(188, 19, 254, 0.15) 0%, rgba(0, 243, 255, 0.15) 100%);
                border: 2px solid rgba(188, 19, 254, 0.5);
                border-radius: 12px;
                padding: 24px;
                margin: 0 0 24px 0;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .demo-cta-content {
                display: flex;
                align-items: center;
                gap: 20px;
                flex-wrap: wrap;
            }
            
            .demo-cta-icon {
                font-size: 2.5rem;
                flex-shrink: 0;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
            }
            
            .demo-cta-text {
                flex: 1;
                min-width: 250px;
            }
            
            .demo-cta-text h3 {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1.5rem;
                font-weight: 700;
                color: #ffffff;
                margin: 0 0 8px 0;
            }
            
            .demo-cta-text p {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1rem;
                color: #b0b0d0;
                margin: 0;
                line-height: 1.5;
            }
            
            .demo-cta-button {
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
            
            .demo-cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 25px rgba(188, 19, 254, 0.6);
            }
            
            .demo-cta-button svg {
                width: 16px;
                height: 16px;
                stroke: white;
            }
            
            @media (max-width: 768px) {
                .soundy-demo-cta-professional {
                    padding: 16px;
                    margin: 0 0 16px 0;
                }
                
                .demo-cta-content {
                    flex-direction: column;
                    text-align: center;
                    gap: 16px;
                }
                
                .demo-cta-text {
                    min-width: auto;
                }
                
                .demo-cta-text h3 {
                    font-size: 1.3rem;
                }
                
                .demo-cta-text p {
                    font-size: 0.95rem;
                }
                
                .demo-cta-button {
                    width: 100%;
                    justify-content: center;
                    padding: 12px 20px;
                    font-size: 1rem;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    /**
     * 🔒 Intercepta displayModalResults() - ESTRATÉGIA PRINCIPAL
     */
    function interceptDisplayModalResults() {
        // Aguardar função estar disponível
        const checkInterval = setInterval(() => {
            if (typeof window.displayModalResults === 'function') {
                clearInterval(checkInterval);
                console.log('✅ [CTA-DEMO-V3] displayModalResults encontrada, interceptando...');
                
                // Salvar original
                const originalDisplayModalResults = window.displayModalResults;
                
                // Interceptar
                window.displayModalResults = async function(...args) {
                    console.log('🎯 [CTA-DEMO-V3] displayModalResults() executando...');
                    
                    // Executar original
                    const result = await originalDisplayModalResults.apply(this, args);
                    
                    // Aguardar DOM renderizar completamente
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Injetar CTA
                    console.log('🎯 [CTA-DEMO-V3] Renderização completa, injetando CTA...');
                    injectCTAIntoModal();
                    
                    return result;
                };
                
                console.log('✅ [CTA-DEMO-V3] Interceptação configurada com sucesso!');
            }
        }, 100);
        
        // Timeout após 30s
        setTimeout(() => clearInterval(checkInterval), 30000);
    }
    
    // Iniciar interceptação
    interceptDisplayModalResults();
    
    console.log('✅ [CTA-DEMO-V3] Sistema profissional inicializado');
    
})();
