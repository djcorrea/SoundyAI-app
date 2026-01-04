// 🔐 ENTITLEMENTS FRONTEND HANDLER
// Intercepta respostas 403 PLAN_REQUIRED e exibe modal de upgrade
// Trabalha em conjunto com work/lib/entitlements.js no backend

(function initEntitlementsFrontend() {
    'use strict';
    
    console.log('🔐 [ENTITLEMENTS-FE] Inicializando handler de entitlements...');
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🎯 MENSAGENS POR FEATURE (sincronizado com backend)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    const FEATURE_MESSAGES = {
        reference: {
            title: 'Modo Referência',
            emoji: '🎯',
            description: 'Compare seu áudio com faixas de referência profissionais para alcançar o som que você deseja.',
            message: 'O Modo Referência é exclusivo dos planos PRO e DJ Beta. Faça upgrade para comparar suas músicas com referências profissionais!'
        },
        correctionPlan: {
            title: 'Plano de Correção',
            emoji: '📋',
            description: 'Receba um guia passo a passo personalizado para corrigir os problemas da sua mixagem.',
            message: 'O Plano de Correção é exclusivo do plano PRO. Faça upgrade para receber instruções detalhadas de como melhorar seu áudio!'
        },
        pdf: {
            title: 'Relatório PDF',
            emoji: '📄',
            description: 'Exporte um relatório profissional completo da sua análise para consulta futura.',
            message: 'O Relatório PDF é exclusivo do plano PRO. Faça upgrade para baixar relatórios profissionais das suas análises!'
        },
        askAI: {
            title: 'Pedir Ajuda à IA',
            emoji: '🤖',
            description: 'Converse com nossa IA especializada para receber dicas personalizadas sobre sua mixagem.',
            message: 'A funcionalidade "Pedir Ajuda à IA" é exclusiva do plano PRO. Faça upgrade para receber assistência personalizada!'
        }
    };
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🖼️ CRIAR/OBTER MODAL DE UPGRADE PRO
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function ensureUpgradeModal() {
        let modal = document.getElementById('entitlementUpgradeModal');
        
        if (!modal) {
            const modalHTML = `
                <div id="entitlementUpgradeModal" class="entitlement-modal" style="display: none;">
                    <div class="entitlement-overlay"></div>
                    <div class="entitlement-card">
                        <button class="entitlement-close" id="entitlementCloseBtn">&times;</button>
                        <div class="entitlement-icon" id="entitlementIcon">🔒</div>
                        <h2 class="entitlement-title" id="entitlementTitle">Recurso PRO</h2>
                        <p class="entitlement-text" id="entitlementText">
                            Este recurso está disponível apenas no plano PRO.
                        </p>
                        <div class="entitlement-features">
                            <div class="entitlement-feature">
                                <span class="feature-check">✓</span>
                                <span>Modo Referência ilimitado</span>
                            </div>
                            <div class="entitlement-feature">
                                <span class="feature-check">✓</span>
                                <span>Plano de Correção com IA</span>
                            </div>
                            <div class="entitlement-feature">
                                <span class="feature-check">✓</span>
                                <span>Relatórios PDF profissionais</span>
                            </div>
                            <div class="entitlement-feature">
                                <span class="feature-check">✓</span>
                                <span>Assistente de IA ilimitado</span>
                            </div>
                        </div>
                        <div class="entitlement-buttons">
                            <button class="entitlement-btn entitlement-primary" id="entitlementUpgradeBtn">
                                ✨ Fazer Upgrade para PRO
                            </button>
                            <button class="entitlement-btn entitlement-secondary" id="entitlementLaterBtn">
                                Agora não
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const styleCSS = `
                <style id="entitlementModalStyles">
                    .entitlement-modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 999999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        animation: entitlementFadeIn 0.2s ease;
                    }
                    
                    .entitlement-overlay {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.85);
                        backdrop-filter: blur(6px);
                    }
                    
                    .entitlement-card {
                        position: relative;
                        max-width: 480px;
                        width: 92%;
                        background: linear-gradient(145deg, #1a1a2e 0%, #0f0f1a 100%);
                        border: 2px solid rgba(139, 92, 246, 0.5);
                        border-radius: 24px;
                        padding: 40px 32px;
                        box-shadow: 
                            0 25px 80px rgba(0, 0, 0, 0.7),
                            0 0 40px rgba(139, 92, 246, 0.2);
                        animation: entitlementSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    }
                    
                    .entitlement-close {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        width: 32px;
                        height: 32px;
                        border: none;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 50%;
                        color: rgba(255, 255, 255, 0.6);
                        font-size: 20px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        line-height: 1;
                    }
                    
                    .entitlement-close:hover {
                        background: rgba(255, 255, 255, 0.2);
                        color: #fff;
                    }
                    
                    .entitlement-icon {
                        font-size: 56px;
                        text-align: center;
                        margin-bottom: 20px;
                        animation: entitlementPulse 2s infinite;
                    }
                    
                    .entitlement-title {
                        font-family: 'Orbitron', 'Segoe UI', sans-serif;
                        font-size: 28px;
                        font-weight: 700;
                        color: #ffffff;
                        text-align: center;
                        margin: 0 0 16px 0;
                        background: linear-gradient(135deg, #fff 0%, #c4b5fd 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    }
                    
                    .entitlement-text {
                        font-family: 'Poppins', 'Segoe UI', sans-serif;
                        font-size: 16px;
                        color: rgba(255, 255, 255, 0.85);
                        text-align: center;
                        line-height: 1.7;
                        margin: 0 0 28px 0;
                    }
                    
                    .entitlement-features {
                        background: rgba(139, 92, 246, 0.1);
                        border: 1px solid rgba(139, 92, 246, 0.2);
                        border-radius: 12px;
                        padding: 16px 20px;
                        margin-bottom: 28px;
                    }
                    
                    .entitlement-feature {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 8px 0;
                        color: rgba(255, 255, 255, 0.9);
                        font-size: 14px;
                    }
                    
                    .feature-check {
                        color: #8B5CF6;
                        font-weight: bold;
                        font-size: 16px;
                    }
                    
                    .entitlement-buttons {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    
                    .entitlement-btn {
                        width: 100%;
                        padding: 16px 24px;
                        border: none;
                        border-radius: 12px;
                        font-family: 'Poppins', 'Segoe UI', sans-serif;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }
                    
                    .entitlement-primary {
                        background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);
                        color: #ffffff;
                        box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
                    }
                    
                    .entitlement-primary:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 8px 30px rgba(139, 92, 246, 0.6);
                    }
                    
                    .entitlement-secondary {
                        background: rgba(255, 255, 255, 0.08);
                        color: rgba(255, 255, 255, 0.7);
                        border: 1px solid rgba(255, 255, 255, 0.15);
                    }
                    
                    .entitlement-secondary:hover {
                        background: rgba(255, 255, 255, 0.12);
                        color: rgba(255, 255, 255, 0.9);
                    }
                    
                    @keyframes entitlementFadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    
                    @keyframes entitlementSlideUp {
                        from { 
                            transform: translateY(40px);
                            opacity: 0;
                        }
                        to { 
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes entitlementPulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.08); }
                    }
                    
                    @media (max-width: 480px) {
                        .entitlement-card {
                            padding: 32px 20px;
                            margin: 16px;
                        }
                        
                        .entitlement-title {
                            font-size: 24px;
                        }
                        
                        .entitlement-text {
                            font-size: 14px;
                        }
                        
                        .entitlement-icon {
                            font-size: 48px;
                        }
                    }
                </style>
            `;
            
            // Injetar CSS
            if (!document.getElementById('entitlementModalStyles')) {
                document.head.insertAdjacentHTML('beforeend', styleCSS);
            }
            
            // Injetar HTML
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            modal = document.getElementById('entitlementUpgradeModal');
            
            // Configurar event listeners
            const closeBtn = document.getElementById('entitlementCloseBtn');
            const upgradeBtn = document.getElementById('entitlementUpgradeBtn');
            const laterBtn = document.getElementById('entitlementLaterBtn');
            const overlay = modal.querySelector('.entitlement-overlay');
            
            const closeModal = () => {
                modal.style.display = 'none';
                console.log('🔐 [ENTITLEMENTS-FE] Modal fechado');
            };
            
            closeBtn.addEventListener('click', closeModal);
            laterBtn.addEventListener('click', closeModal);
            overlay.addEventListener('click', closeModal);
            
            upgradeBtn.addEventListener('click', () => {
                console.log('🔐 [ENTITLEMENTS-FE] Redirecionando para planos...');
                window.location.href = '/planos.html';
            });
            
            console.log('🔐 [ENTITLEMENTS-FE] Modal de upgrade criado');
        }
        
        return modal;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🎯 FUNÇÃO PRINCIPAL: Mostrar modal de upgrade para feature bloqueada
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function showEntitlementUpgradeModal(feature, currentPlan = 'free') {
        console.log(`🔐 [ENTITLEMENTS-FE] Abrindo modal para feature: ${feature} (plano atual: ${currentPlan})`);
        
        const modal = ensureUpgradeModal();
        const featureConfig = FEATURE_MESSAGES[feature] || FEATURE_MESSAGES.reference;
        
        // Atualizar conteúdo do modal
        const iconEl = document.getElementById('entitlementIcon');
        const titleEl = document.getElementById('entitlementTitle');
        const textEl = document.getElementById('entitlementText');
        
        if (iconEl) iconEl.textContent = featureConfig.emoji;
        if (titleEl) titleEl.textContent = `${featureConfig.title} - PRO`;
        if (textEl) textEl.textContent = featureConfig.message;
        
        // Exibir modal
        modal.style.display = 'flex';
        
        console.log(`🔐 [ENTITLEMENTS-FE] Modal exibido para: ${featureConfig.title}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔧 FUNÇÃO HELPER: Verificar se resposta é PLAN_REQUIRED
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function isPlanRequiredError(response, data) {
        // Verificar status 403
        if (response.status !== 403) return false;
        
        // Verificar código de erro
        if (data && (data.code === 'PLAN_REQUIRED' || data.error === 'PLAN_REQUIRED')) {
            return true;
        }
        
        return false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔧 HANDLER: Processar resposta de API e mostrar modal se necessário
    // ═══════════════════════════════════════════════════════════════════════════════
    
    async function handleApiResponse(response, feature = null) {
        // Se não for erro 403, retornar resposta original
        if (response.status !== 403) {
            return { handled: false, response };
        }
        
        // Clonar response para não consumir body original
        const clonedResponse = response.clone();
        
        try {
            const data = await clonedResponse.json();
            
            if (isPlanRequiredError(response, data)) {
                const detectedFeature = feature || data.feature || 'reference';
                const currentPlan = data.currentPlan || 'free';
                
                console.log(`🔐 [ENTITLEMENTS-FE] Erro PLAN_REQUIRED detectado:`, {
                    feature: detectedFeature,
                    currentPlan,
                    requiredPlan: data.requiredPlan
                });
                
                showEntitlementUpgradeModal(detectedFeature, currentPlan);
                
                return { 
                    handled: true, 
                    response, 
                    data,
                    feature: detectedFeature,
                    currentPlan
                };
            }
        } catch (e) {
            console.warn('🔐 [ENTITLEMENTS-FE] Erro ao parsear resposta:', e);
        }
        
        return { handled: false, response };
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🌐 INTERCEPTOR DE FETCH (opcional, para captura automática)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // Manter referência do fetch original
    const originalFetch = window.fetch;
    
    // Criar wrapper que intercepta respostas 403 PLAN_REQUIRED
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        
        // Verificar se é uma rota de API que pode retornar PLAN_REQUIRED
        const url = args[0]?.url || args[0] || '';
        const isApiRoute = url.includes('/api/');
        
        // Verificar apenas rotas de API relevantes
        if (isApiRoute && response.status === 403) {
            const clonedResponse = response.clone();
            
            try {
                const data = await clonedResponse.json();
                
                if (isPlanRequiredError(response, data)) {
                    console.log(`🔐 [ENTITLEMENTS-FE] Interceptado PLAN_REQUIRED em fetch para: ${url}`);
                    showEntitlementUpgradeModal(data.feature, data.currentPlan);
                    // Não bloquear a resposta - deixar o código original também processar
                }
            } catch (e) {
                // Ignorar erros de parse
            }
        }
        
        return response;
    };
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 📤 EXPORTAR FUNÇÕES PARA USO EXTERNO
    // ═══════════════════════════════════════════════════════════════════════════════
    
    window.EntitlementsHandler = {
        showUpgradeModal: showEntitlementUpgradeModal,
        handleApiResponse: handleApiResponse,
        isPlanRequiredError: isPlanRequiredError,
        FEATURE_MESSAGES: FEATURE_MESSAGES
    };
    
    console.log('🔐 [ENTITLEMENTS-FE] Handler inicializado com sucesso');
    console.log('🔐 [ENTITLEMENTS-FE] Funções exportadas: window.EntitlementsHandler');
    
})();
