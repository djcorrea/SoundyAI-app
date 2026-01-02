/**
 * 🔥 SOUNDYAI - MODO DEMO DE VENDA
 * 
 * Sistema de demo para conversão de vendas.
 * ESTENDE o anonymous-mode.js existente com configurações específicas.
 * 
 * LIMITES FIXOS:
 * - 1 análise completa
 * - 1 mensagem no chat
 * 
 * Após limite → Pop-up bloqueante → Checkout
 * 
 * @version 1.0.0
 * @created 2026-01-02
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // 🎛️ CONFIGURAÇÃO DO MODO DEMO
    // ═══════════════════════════════════════════════════════════
    
    const DEMO_CONFIG = {
        // Feature flag
        enabled: true,
        
        // Limites FIXOS (não alterar)
        limits: {
            maxAnalyses: 1,
            maxMessages: 1,
        },
        
        // Storage keys
        storageKey: 'soundy_demo_data',
        indexedDBName: 'SoundyDemoDB',
        indexedDBStore: 'demo_visitors',
        
        // URL do checkout (PARAMETRIZÁVEL)
        // Será substituído pelo link real do Hotmart
        checkoutUrl: 'https://pay.hotmart.com/SEU_PRODUTO_AQUI',
        
        // TTL do bloqueio (30 dias em ms)
        blockTTL: 30 * 24 * 60 * 60 * 1000,
        
        // Textos do modal
        texts: {
            title: 'Essa foi sua análise gratuita.',
            subtitle: 'Para continuar usando a SoundyAI, libere o acesso completo.',
            ctaButton: '🔓 Liberar acesso completo',
            securityBadge: '💳 Pagamento seguro • Acesso imediato'
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 🌐 OBJETO GLOBAL DO DEMO
    // ═══════════════════════════════════════════════════════════
    
    window.SoundyDemo = {
        isEnabled: DEMO_CONFIG.enabled,
        isActive: false,
        visitorId: null,
        config: DEMO_CONFIG,
        data: null,
        initialized: false,
        modalShown: false,
    };

    // ═══════════════════════════════════════════════════════════
    // 🔍 DETECÇÃO DO MODO DEMO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Verifica se está em modo demo via URL
     */
    function isDemoMode() {
        const path = window.location.pathname.toLowerCase();
        const params = new URLSearchParams(window.location.search);
        
        // Detectar /demo ou /demo.html ou ?mode=demo
        return path.includes('/demo') || 
               path.endsWith('/demo.html') || 
               params.get('mode') === 'demo';
    }

    // ═══════════════════════════════════════════════════════════
    // 🔧 FUNÇÕES DE FINGERPRINT (REUTILIZA ANONYMOUS-MODE)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Carrega FingerprintJS dinamicamente
     */
    async function loadFingerprintJS() {
        if (window.FingerprintJS) {
            return window.FingerprintJS;
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js';
            script.onload = () => {
                console.log('✅ [DEMO] FingerprintJS carregado');
                resolve(window.FingerprintJS);
            };
            script.onerror = () => {
                console.warn('⚠️ [DEMO] Falha ao carregar FingerprintJS, usando fallback');
                resolve(null);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Gera ID de fallback (quando FingerprintJS falha)
     */
    function generateFallbackId() {
        const nav = window.navigator;
        const screen = window.screen;
        
        const components = [
            nav.userAgent,
            nav.language,
            screen.width + 'x' + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            nav.hardwareConcurrency || 'unknown',
            nav.platform
        ];
        
        let hash = 0;
        const str = components.join('|');
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return 'demo_fb_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    }

    /**
     * Obtém fingerprint do visitante
     */
    async function getVisitorFingerprint() {
        try {
            const FP = await loadFingerprintJS();
            
            if (FP) {
                const fp = await FP.load();
                const result = await fp.get();
                console.log('✅ [DEMO] Fingerprint gerado:', result.visitorId.substring(0, 8) + '...');
                return 'demo_' + result.visitorId;
            }
        } catch (error) {
            console.warn('⚠️ [DEMO] Erro no FingerprintJS:', error.message);
        }
        
        return generateFallbackId();
    }

    // ═══════════════════════════════════════════════════════════
    // 💾 PERSISTÊNCIA (LocalStorage + IndexedDB)
    // ═══════════════════════════════════════════════════════════
    
    function saveToLocalStorage(data) {
        try {
            localStorage.setItem(DEMO_CONFIG.storageKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('⚠️ [DEMO] Erro ao salvar localStorage:', e.message);
            return false;
        }
    }

    function loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(DEMO_CONFIG.storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function openIndexedDB() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                resolve(null);
                return;
            }
            
            const request = indexedDB.open(DEMO_CONFIG.indexedDBName, 1);
            
            request.onerror = () => resolve(null);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(DEMO_CONFIG.indexedDBStore)) {
                    db.createObjectStore(DEMO_CONFIG.indexedDBStore, { keyPath: 'visitor_id' });
                }
            };
        });
    }

    async function saveToIndexedDB(data) {
        try {
            const db = await openIndexedDB();
            if (!db) return false;
            
            return new Promise((resolve) => {
                const tx = db.transaction(DEMO_CONFIG.indexedDBStore, 'readwrite');
                const store = tx.objectStore(DEMO_CONFIG.indexedDBStore);
                store.put(data);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    }

    async function loadFromIndexedDB(visitorId) {
        try {
            const db = await openIndexedDB();
            if (!db) return null;
            
            return new Promise((resolve) => {
                const tx = db.transaction(DEMO_CONFIG.indexedDBStore, 'readonly');
                const store = tx.objectStore(DEMO_CONFIG.indexedDBStore);
                const request = store.get(visitorId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 📊 GERENCIAMENTO DE DADOS
    // ═══════════════════════════════════════════════════════════
    
    function createDemoData(visitorId) {
        return {
            visitor_id: visitorId,
            analyses_used: 0,
            messages_used: 0,
            first_access: new Date().toISOString(),
            last_access: new Date().toISOString(),
            converted: false,
            expires_at: new Date(Date.now() + DEMO_CONFIG.blockTTL).toISOString()
        };
    }

    async function loadOrCreateDemoData(visitorId) {
        // 1. Tentar localStorage
        let data = loadFromLocalStorage();
        
        if (data && data.visitor_id === visitorId) {
            // Verificar se expirou
            if (new Date(data.expires_at) < new Date()) {
                console.log('⏰ [DEMO] Dados expirados, criando novo registro');
                data = createDemoData(visitorId);
            } else {
                console.log('✅ [DEMO] Dados carregados do localStorage');
                data.last_access = new Date().toISOString();
            }
            return data;
        }
        
        // 2. Tentar IndexedDB (anti-burla)
        const idbData = await loadFromIndexedDB(visitorId);
        if (idbData && new Date(idbData.expires_at) >= new Date()) {
            console.log('✅ [DEMO] Dados recuperados do IndexedDB');
            idbData.last_access = new Date().toISOString();
            saveToLocalStorage(idbData);
            return idbData;
        }
        
        // 3. Herdar contadores se fingerprint diferente (anti-burla)
        if (data && data.visitor_id !== visitorId) {
            console.warn('⚠️ [DEMO] Fingerprint diferente - possível burla');
            const newData = createDemoData(visitorId);
            // Herdar contadores mais restritivos
            newData.analyses_used = Math.max(data.analyses_used || 0, 0);
            newData.messages_used = Math.max(data.messages_used || 0, 0);
            return newData;
        }
        
        // 4. Criar novo
        console.log('🆕 [DEMO] Novo visitante demo');
        return createDemoData(visitorId);
    }

    async function saveDemoData(data) {
        data.last_access = new Date().toISOString();
        saveToLocalStorage(data);
        await saveToIndexedDB(data);
        window.SoundyDemo.data = data;
        
        console.log('💾 [DEMO] Dados salvos:', {
            analyses: data.analyses_used + '/' + DEMO_CONFIG.limits.maxAnalyses,
            messages: data.messages_used + '/' + DEMO_CONFIG.limits.maxMessages
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 🌐 VALIDAÇÃO BACKEND (ANTI-BURLA REFORÇADA)
    // ═══════════════════════════════════════════════════════════

    /**
     * Valida estado do demo no backend
     * @param {string} action - 'check', 'analysis', ou 'message'
     * @returns {Promise<{success: boolean, permissions: object}>}
     */
    async function validateWithBackend(action = 'check') {
        try {
            const fingerprint = window.SoundyDemo.visitorId || 'unknown';
            
            const response = await fetch('/api/demo/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fingerprint, action })
            });
            
            if (!response.ok) {
                console.warn('⚠️ [DEMO] Backend indisponível, usando apenas frontend');
                return { success: true, permissions: null };
            }
            
            const result = await response.json();
            console.log(`🔗 [DEMO] Backend validação (${action}):`, result);
            
            // Se backend tem dados mais restritivos, sincronizar
            if (result.state && window.SoundyDemo.data) {
                const data = window.SoundyDemo.data;
                
                // Usar o maior valor entre frontend e backend (mais restritivo)
                if (result.state.analysesUsed > data.analyses_used) {
                    console.warn('⚠️ [DEMO] Sincronizando análises do backend');
                    data.analyses_used = result.state.analysesUsed;
                    await saveDemoData(data);
                }
                
                if (result.state.messagesUsed > data.messages_used) {
                    console.warn('⚠️ [DEMO] Sincronizando mensagens do backend');
                    data.messages_used = result.state.messagesUsed;
                    await saveDemoData(data);
                }
            }
            
            return result;
        } catch (error) {
            console.warn('⚠️ [DEMO] Erro na validação backend:', error.message);
            return { success: true, permissions: null };
        }
    }

    /**
     * Registra ação no backend
     */
    async function registerActionBackend(action) {
        return validateWithBackend(action);
    }

    // Expor para uso externo
    window.SoundyDemo.validateBackend = validateWithBackend;

    // ═══════════════════════════════════════════════════════════
    // 🚦 VERIFICAÇÃO DE LIMITES
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Verifica se pode fazer análise
     */
    window.SoundyDemo.canAnalyze = function() {
        if (!window.SoundyDemo.isActive) {
            return { allowed: true, reason: 'not_demo_mode' };
        }
        
        const data = window.SoundyDemo.data;
        if (!data) {
            return { allowed: false, reason: 'not_initialized' };
        }
        
        const remaining = DEMO_CONFIG.limits.maxAnalyses - data.analyses_used;
        
        if (remaining <= 0) {
            return { allowed: false, remaining: 0, reason: 'analysis_limit_reached' };
        }
        
        return { allowed: true, remaining };
    };

    /**
     * Verifica se pode enviar mensagem
     */
    window.SoundyDemo.canSendMessage = function() {
        if (!window.SoundyDemo.isActive) {
            return { allowed: true, reason: 'not_demo_mode' };
        }
        
        const data = window.SoundyDemo.data;
        if (!data) {
            return { allowed: false, reason: 'not_initialized' };
        }
        
        const remaining = DEMO_CONFIG.limits.maxMessages - data.messages_used;
        
        if (remaining <= 0) {
            return { allowed: false, remaining: 0, reason: 'message_limit_reached' };
        }
        
        return { allowed: true, remaining };
    };

    // ═══════════════════════════════════════════════════════════
    // 📝 REGISTRO DE USO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Registra análise realizada
     */
    window.SoundyDemo.registerAnalysis = async function() {
        if (!window.SoundyDemo.isActive) return;
        
        const data = window.SoundyDemo.data;
        if (!data) return;
        
        data.analyses_used++;
        console.log(`📊 [DEMO] Análise registrada: ${data.analyses_used}/${DEMO_CONFIG.limits.maxAnalyses}`);
        
        await saveDemoData(data);
        
        // 🔗 Sincronizar com backend
        try {
            await registerActionBackend('analysis');
        } catch (e) {
            console.warn('⚠️ [DEMO] Falha ao registrar análise no backend:', e.message);
        }
        
        // Verificar se atingiu limite
        if (data.analyses_used >= DEMO_CONFIG.limits.maxAnalyses) {
            console.log('🚫 [DEMO] Limite de análises atingido - aguardando próxima ação para mostrar modal');
        }
    };

    /**
     * Registra mensagem enviada
     */
    window.SoundyDemo.registerMessage = async function() {
        if (!window.SoundyDemo.isActive) return;
        
        const data = window.SoundyDemo.data;
        if (!data) return;
        
        data.messages_used++;
        console.log(`💬 [DEMO] Mensagem registrada: ${data.messages_used}/${DEMO_CONFIG.limits.maxMessages}`);
        
        await saveDemoData(data);
        
        // 🔗 Sincronizar com backend
        try {
            await registerActionBackend('message');
        } catch (e) {
            console.warn('⚠️ [DEMO] Falha ao registrar mensagem no backend:', e.message);
        }
        
        // Verificar se atingiu limite
        if (data.messages_used >= DEMO_CONFIG.limits.maxMessages) {
            console.log('🚫 [DEMO] Limite de mensagens atingido - aguardando próxima ação para mostrar modal');
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 🎯 INTERCEPTADORES DE AÇÃO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Intercepta tentativa de análise
     * @returns {boolean} true se permitido, false se bloqueado
     */
    window.SoundyDemo.interceptAnalysis = function() {
        if (!window.SoundyDemo.isActive) return true;
        
        const check = window.SoundyDemo.canAnalyze();
        
        if (!check.allowed) {
            console.log('🚫 [DEMO] Análise bloqueada:', check.reason);
            window.SoundyDemo.showConversionModal();
            return false;
        }
        
        return true;
    };

    /**
     * Intercepta tentativa de mensagem
     * @returns {boolean} true se permitido, false se bloqueado
     */
    window.SoundyDemo.interceptMessage = function() {
        if (!window.SoundyDemo.isActive) return true;
        
        const check = window.SoundyDemo.canSendMessage();
        
        if (!check.allowed) {
            console.log('🚫 [DEMO] Mensagem bloqueada:', check.reason);
            window.SoundyDemo.showConversionModal();
            return false;
        }
        
        return true;
    };

    // ═══════════════════════════════════════════════════════════
    // 🪟 MODAL DE CONVERSÃO (BLOQUEANTE)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Mostra modal de conversão BLOQUEANTE
     * - Sem botão de fechar
     * - Não fecha clicando fora
     * - Único CTA → Checkout
     */
    window.SoundyDemo.showConversionModal = function() {
        // Evitar duplicação
        if (window.SoundyDemo.modalShown) {
            const existing = document.getElementById('demoConversionModal');
            if (existing) {
                existing.style.display = 'flex';
                return;
            }
        }
        
        window.SoundyDemo.modalShown = true;
        
        const modal = document.createElement('div');
        modal.id = 'demoConversionModal';
        modal.className = 'demo-conversion-modal-overlay';
        modal.innerHTML = `
            <div class="demo-conversion-modal">
                <div class="demo-conversion-modal-content">
                    <!-- Ícone de sucesso -->
                    <div class="demo-modal-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"></path>
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                    </div>
                    
                    <!-- Título -->
                    <h2 class="demo-modal-title">${DEMO_CONFIG.texts.title}</h2>
                    
                    <!-- Subtítulo -->
                    <p class="demo-modal-subtitle">${DEMO_CONFIG.texts.subtitle}</p>
                    
                    <!-- CTA Único -->
                    <button class="demo-cta-button" id="demoCTAButton">
                        <span>${DEMO_CONFIG.texts.ctaButton}</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                    
                    <!-- Selo de segurança -->
                    <p class="demo-security-badge">${DEMO_CONFIG.texts.securityBadge}</p>
                </div>
            </div>
        `;
        
        // Injetar estilos se não existirem
        if (!document.getElementById('demoModalStyles')) {
            const styles = document.createElement('style');
            styles.id = 'demoModalStyles';
            styles.textContent = getDemoModalStyles();
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(modal);
        
        // Prevenir scroll
        document.body.style.overflow = 'hidden';
        
        // Evento do botão
        document.getElementById('demoCTAButton').addEventListener('click', () => {
            window.SoundyDemo.redirectToCheckout();
        });
        
        // IMPORTANTE: NÃO adicionar evento de fechar ao clicar fora
        // Modal é BLOQUEANTE
        
        console.log('🔥 [DEMO] Modal de conversão exibido');
    };

    /**
     * Retorna CSS do modal
     */
    function getDemoModalStyles() {
        return `
            .demo-conversion-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                animation: demoFadeIn 0.3s ease;
            }
            
            @keyframes demoFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .demo-conversion-modal {
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                border: 1px solid rgba(188, 19, 254, 0.3);
                border-radius: 20px;
                padding: 40px;
                max-width: 480px;
                width: 90%;
                text-align: center;
                box-shadow: 
                    0 0 60px rgba(188, 19, 254, 0.2),
                    0 0 100px rgba(0, 243, 255, 0.1);
                animation: demoSlideUp 0.4s ease;
            }
            
            @keyframes demoSlideUp {
                from { 
                    opacity: 0; 
                    transform: translateY(30px); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0); 
                }
            }
            
            .demo-modal-icon {
                width: 80px;
                height: 80px;
                margin: 0 auto 24px;
                background: linear-gradient(135deg, #00f3ff 0%, #bc13fe 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: demoPulse 2s infinite;
            }
            
            @keyframes demoPulse {
                0%, 100% { 
                    box-shadow: 0 0 20px rgba(0, 243, 255, 0.4); 
                }
                50% { 
                    box-shadow: 0 0 40px rgba(188, 19, 254, 0.6); 
                }
            }
            
            .demo-modal-icon svg {
                width: 40px;
                height: 40px;
                stroke: white;
            }
            
            .demo-modal-title {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1.8rem;
                font-weight: 700;
                color: #ffffff;
                margin: 0 0 12px;
                line-height: 1.3;
            }
            
            .demo-modal-subtitle {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 1.1rem;
                color: #a0a0c0;
                margin: 0 0 32px;
                line-height: 1.5;
            }
            
            .demo-cta-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                width: 100%;
                padding: 18px 32px;
                font-family: 'Orbitron', 'Segoe UI', sans-serif;
                font-size: 1.1rem;
                font-weight: 700;
                color: #ffffff;
                background: linear-gradient(135deg, #bc13fe 0%, #00f3ff 100%);
                border: none;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .demo-cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 
                    0 10px 30px rgba(188, 19, 254, 0.4),
                    0 0 20px rgba(0, 243, 255, 0.3);
            }
            
            .demo-cta-button:active {
                transform: translateY(0);
            }
            
            .demo-cta-button svg {
                flex-shrink: 0;
            }
            
            .demo-security-badge {
                font-family: 'Rajdhani', 'Segoe UI', sans-serif;
                font-size: 0.85rem;
                color: #6a6a8a;
                margin: 20px 0 0;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            /* Responsivo */
            @media (max-width: 480px) {
                .demo-conversion-modal {
                    padding: 30px 20px;
                    margin: 20px;
                }
                
                .demo-modal-title {
                    font-size: 1.5rem;
                }
                
                .demo-modal-subtitle {
                    font-size: 1rem;
                }
                
                .demo-cta-button {
                    padding: 16px 24px;
                    font-size: 1rem;
                }
            }
        `;
    }

    /**
     * Redireciona para checkout
     */
    window.SoundyDemo.redirectToCheckout = function() {
        console.log('🛒 [DEMO] Redirecionando para checkout...');
        
        // Marcar como convertido (para analytics)
        if (window.SoundyDemo.data) {
            window.SoundyDemo.data.converted = true;
            window.SoundyDemo.data.conversion_time = new Date().toISOString();
            saveDemoData(window.SoundyDemo.data);
        }
        
        // Redirect para checkout
        window.location.href = DEMO_CONFIG.checkoutUrl;
    };

    /**
     * Atualiza URL de checkout (para configuração dinâmica)
     */
    window.SoundyDemo.setCheckoutUrl = function(url) {
        DEMO_CONFIG.checkoutUrl = url;
        console.log('✅ [DEMO] Checkout URL atualizada:', url);
    };

    // ═══════════════════════════════════════════════════════════
    // 🚀 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Ativa o modo demo
     */
    window.SoundyDemo.activate = async function() {
        if (!DEMO_CONFIG.enabled) {
            console.log('⚠️ [DEMO] Sistema desabilitado via config');
            return false;
        }
        
        if (window.SoundyDemo.initialized) {
            console.log('✅ [DEMO] Já inicializado');
            return true;
        }
        
        console.log('🔥 [DEMO] Ativando modo demo de venda...');
        
        // Gerar fingerprint
        const visitorId = await getVisitorFingerprint();
        window.SoundyDemo.visitorId = visitorId;
        
        // Carregar ou criar dados
        const data = await loadOrCreateDemoData(visitorId);
        window.SoundyDemo.data = data;
        
        // Salvar dados
        await saveDemoData(data);
        
        // Ativar modo
        window.SoundyDemo.isActive = true;
        window.SoundyDemo.initialized = true;
        
        console.log('✅ [DEMO] Modo demo ATIVADO:', {
            visitorId: visitorId.substring(0, 16) + '...',
            analysesUsed: data.analyses_used + '/' + DEMO_CONFIG.limits.maxAnalyses,
            messagesUsed: data.messages_used + '/' + DEMO_CONFIG.limits.maxMessages
        });
        
        // Disparar evento
        window.dispatchEvent(new CustomEvent('soundy:demo:activated', {
            detail: { visitorId, data }
        }));
        
        // Desativar anonymous-mode se existir (evitar conflito)
        if (window.SoundyAnonymous) {
            window.SoundyAnonymous.isAnonymousMode = false;
            console.log('🔄 [DEMO] Anonymous mode desativado (demo tem prioridade)');
        }
        
        return true;
    };

    /**
     * Obtém status do demo
     */
    window.SoundyDemo.getStatus = function() {
        const data = window.SoundyDemo.data || {};
        return {
            enabled: DEMO_CONFIG.enabled,
            active: window.SoundyDemo.isActive,
            initialized: window.SoundyDemo.initialized,
            analysesUsed: data.analyses_used || 0,
            analysesLimit: DEMO_CONFIG.limits.maxAnalyses,
            analysesRemaining: Math.max(0, DEMO_CONFIG.limits.maxAnalyses - (data.analyses_used || 0)),
            messagesUsed: data.messages_used || 0,
            messagesLimit: DEMO_CONFIG.limits.maxMessages,
            messagesRemaining: Math.max(0, DEMO_CONFIG.limits.maxMessages - (data.messages_used || 0)),
            checkoutUrl: DEMO_CONFIG.checkoutUrl
        };
    };

    // ═══════════════════════════════════════════════════════════
    // 🎯 AUTO-INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Inicialização automática se detectar modo demo
     */
    function autoInit() {
        if (isDemoMode()) {
            console.log('🎯 [DEMO] Modo demo detectado via URL');
            window.SoundyDemo.activate();
        } else {
            console.log('ℹ️ [DEMO] Não está em modo demo');
        }
    }

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        // DOM já carregou
        setTimeout(autoInit, 0);
    }

    // ═══════════════════════════════════════════════════════════
    // 📢 LOG INICIAL
    // ═══════════════════════════════════════════════════════════
    
    console.log('🔥 [DEMO] Sistema de Demo de Venda carregado');
    console.log('   Limites: 1 análise, 1 mensagem');
    console.log('   Detecção: /demo ou ?mode=demo');
    console.log('   Anti-burla: FingerprintJS + LocalStorage + IndexedDB');

})();
