/**
 * 🔥 SOUNDYAI - DEMO CORE
 * 
 * Módulo principal: fingerprint, storage, estado
 * Parte 1/3 do sistema de Demo de Venda
 * 
 * @version 2.0.0
 * @created 2026-01-02
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // 🎛️ CONFIGURAÇÃO DO MODO DEMO (CENTRALIZADA)
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
        checkoutUrl: 'https://pay.hotmart.com/SEU_PRODUTO_AQUI',
        
        // TTL do bloqueio (30 dias em ms)
        blockTTL: 30 * 24 * 60 * 60 * 1000,
        
        // Textos do modal (TEXTO FINAL APROVADO)
        texts: {
            title: 'Essa foi sua análise gratuita.',
            subtitle: 'Para continuar usando a SoundyAI e evoluir sua música, libere o acesso completo agora.',
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
        _backendAuthoritative: false, // Backend tem palavra final quando true
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
        
        return path.includes('/demo') || 
               path.endsWith('/demo.html') || 
               params.get('mode') === 'demo';
    }

    window.SoundyDemo.isDemoMode = isDemoMode;

    // ═══════════════════════════════════════════════════════════
    // 🔧 FUNÇÕES DE FINGERPRINT
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Carrega FingerprintJS dinamicamente
     */
    async function loadFingerprintJS() {
        if (window.FingerprintJS) {
            return window.FingerprintJS;
        }
        
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js';
            script.onload = () => {
                console.log('✅ [DEMO-CORE] FingerprintJS carregado');
                resolve(window.FingerprintJS);
            };
            script.onerror = () => {
                console.warn('⚠️ [DEMO-CORE] Falha ao carregar FingerprintJS, usando fallback');
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
                console.log('✅ [DEMO-CORE] Fingerprint gerado:', result.visitorId.substring(0, 8) + '...');
                return 'demo_' + result.visitorId;
            }
        } catch (error) {
            console.warn('⚠️ [DEMO-CORE] Erro no FingerprintJS:', error.message);
        }
        
        return generateFallbackId();
    }

    // Expor para outros módulos
    window.SoundyDemo._getFingerprint = getVisitorFingerprint;

    // ═══════════════════════════════════════════════════════════
    // 💾 PERSISTÊNCIA (LocalStorage + IndexedDB)
    // ═══════════════════════════════════════════════════════════
    
    function saveToLocalStorage(data) {
        try {
            localStorage.setItem(DEMO_CONFIG.storageKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('⚠️ [DEMO-CORE] Erro ao salvar localStorage:', e.message);
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
            if (new Date(data.expires_at) < new Date()) {
                console.log('⏰ [DEMO-CORE] Dados expirados, criando novo registro');
                data = createDemoData(visitorId);
            } else {
                console.log('✅ [DEMO-CORE] Dados carregados do localStorage');
                data.last_access = new Date().toISOString();
            }
            return data;
        }
        
        // 2. Tentar IndexedDB (anti-burla)
        const idbData = await loadFromIndexedDB(visitorId);
        if (idbData && new Date(idbData.expires_at) >= new Date()) {
            console.log('✅ [DEMO-CORE] Dados recuperados do IndexedDB');
            idbData.last_access = new Date().toISOString();
            saveToLocalStorage(idbData);
            return idbData;
        }
        
        // 3. Herdar contadores se fingerprint diferente (anti-burla)
        if (data && data.visitor_id !== visitorId) {
            console.warn('⚠️ [DEMO-CORE] Fingerprint diferente - possível burla');
            const newData = createDemoData(visitorId);
            newData.analyses_used = Math.max(data.analyses_used || 0, 0);
            newData.messages_used = Math.max(data.messages_used || 0, 0);
            return newData;
        }
        
        // 4. Criar novo
        console.log('🆕 [DEMO-CORE] Novo visitante demo');
        return createDemoData(visitorId);
    }

    /**
     * Salva dados do demo (persistência dupla)
     */
    async function saveDemoData(data) {
        data.last_access = new Date().toISOString();
        saveToLocalStorage(data);
        await saveToIndexedDB(data);
        window.SoundyDemo.data = data;
        
        console.log('💾 [DEMO-CORE] Dados salvos:', {
            analyses: data.analyses_used + '/' + DEMO_CONFIG.limits.maxAnalyses,
            messages: data.messages_used + '/' + DEMO_CONFIG.limits.maxMessages
        });
    }

    // Expor para outros módulos
    window.SoundyDemo._saveDemoData = saveDemoData;
    window.SoundyDemo._loadOrCreateData = loadOrCreateDemoData;

    // ═══════════════════════════════════════════════════════════
    // 🌐 VALIDAÇÃO BACKEND (PALAVRA FINAL)
    // ═══════════════════════════════════════════════════════════

    /**
     * Valida estado do demo no backend
     * IMPORTANTE: Se backend retornar allowed:false, BLOQUEIA mesmo que frontend permita
     * 
     * @param {string} action - 'check', 'analysis', ou 'message'
     * @returns {Promise<{success: boolean, permissions: object, backendAuthoritative: boolean}>}
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
                console.warn('⚠️ [DEMO-CORE] Backend indisponível');
                return { success: true, permissions: null, backendAuthoritative: false };
            }
            
            const result = await response.json();
            console.log(`🔗 [DEMO-CORE] Backend validação (${action}):`, result);
            
            // 🔴 CRÍTICO: Se backend respondeu, ele é AUTORITATIVO
            window.SoundyDemo._backendAuthoritative = true;
            
            // Sincronizar dados com backend (usar valor mais restritivo)
            if (result.state && window.SoundyDemo.data) {
                const data = window.SoundyDemo.data;
                let needsSave = false;
                
                if (result.state.analysesUsed > data.analyses_used) {
                    console.warn('⚠️ [DEMO-CORE] Sincronizando análises do backend');
                    data.analyses_used = result.state.analysesUsed;
                    needsSave = true;
                }
                
                if (result.state.messagesUsed > data.messages_used) {
                    console.warn('⚠️ [DEMO-CORE] Sincronizando mensagens do backend');
                    data.messages_used = result.state.messagesUsed;
                    needsSave = true;
                }
                
                if (needsSave) {
                    await saveDemoData(data);
                }
            }
            
            // Marcar resultado como autoritativo
            result.backendAuthoritative = true;
            return result;
            
        } catch (error) {
            console.warn('⚠️ [DEMO-CORE] Erro na validação backend:', error.message);
            return { success: true, permissions: null, backendAuthoritative: false };
        }
    }

    /**
     * Registra ação no backend
     */
    async function registerActionBackend(action) {
        return validateWithBackend(action);
    }

    // Expor para outros módulos
    window.SoundyDemo.validateBackend = validateWithBackend;
    window.SoundyDemo._registerBackend = registerActionBackend;

    // ═══════════════════════════════════════════════════════════
    // 🌐 INTERCEPTADOR GLOBAL DE FETCH
    // ═══════════════════════════════════════════════════════════
    
    /**
     * 🔥 CRÍTICO: Intercepta TODAS as requisições fetch para injetar header x-demo-mode
     * Isso permite que o backend identifique requisições do modo demo
     */
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // Só interceptar se modo demo estiver ativo
        if (window.SoundyDemo?.isActive) {
            options = options || {};
            options.headers = options.headers || {};
            
            // Se headers for um Headers object, converter para objeto simples
            if (options.headers instanceof Headers) {
                const headersObj = {};
                options.headers.forEach((value, key) => {
                    headersObj[key] = value;
                });
                options.headers = headersObj;
            }
            
            // Injetar header de modo demo
            options.headers['x-demo-mode'] = 'true';
            options.headers['x-demo-visitor'] = window.SoundyDemo.visitorId || 'unknown';
            
            console.log('🔥 [DEMO-CORE] Fetch interceptado, header x-demo-mode injetado:', url);
        }
        
        return originalFetch.call(window, url, options);
    };

    console.log('🔥 [DEMO-CORE] Interceptador de fetch instalado');

    // ═══════════════════════════════════════════════════════════
    // 🚀 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Ativa o modo demo
     * IMPORTANTE: Não desativa anonymous-mode, apenas SOBREPÕE quando isActive=true
     */
    window.SoundyDemo.activate = async function() {
        if (!DEMO_CONFIG.enabled) {
            console.log('⚠️ [DEMO-CORE] Sistema desabilitado via config');
            return false;
        }
        
        if (window.SoundyDemo.initialized) {
            console.log('✅ [DEMO-CORE] Já inicializado');
            
            // 🔴 Se já bloqueado, mostrar modal imediatamente
            if (window.SoundyDemo.data?.blocked) {
                console.log('🚫 [DEMO-CORE] Usuário já bloqueado - exibindo modal');
                setTimeout(() => {
                    if (typeof window.SoundyDemo.showConversionModal === 'function') {
                        window.SoundyDemo.showConversionModal(window.SoundyDemo.data.blockReason || 'blocked');
                    }
                }, 500);
            }
            
            return true;
        }
        
        console.log('🔥 [DEMO-CORE] Ativando modo demo de venda...');
        
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
        
        // 🔴 AJUSTE: NÃO desativar anonymous-mode
        // Demo apenas SOBREPÕE via prioridade nos interceptors
        // Isso preserva anonymous-mode para outros usuários
        console.log('✅ [DEMO-CORE] Modo demo ATIVADO (sobrepondo outros modos):', {
            visitorId: visitorId.substring(0, 16) + '...',
            analysesUsed: data.analyses_used + '/' + DEMO_CONFIG.limits.maxAnalyses,
            messagesUsed: data.messages_used + '/' + DEMO_CONFIG.limits.maxMessages,
            blocked: data.blocked || false
        });
        
        // 🔴 VERIFICAR SE JÁ ESTÁ BLOQUEADO (de sessão anterior)
        if (data.blocked) {
            console.log('🚫 [DEMO-CORE] Usuário já bloqueado - exibindo modal imediatamente');
            setTimeout(() => {
                if (typeof window.SoundyDemo.showConversionModal === 'function') {
                    window.SoundyDemo.showConversionModal(data.blockReason || 'blocked');
                }
            }, 1000);
            return true; // Não abrir modal de análise se bloqueado
        }
        
        // Validar com backend na inicialização
        try {
            await validateWithBackend('check');
        } catch (e) {
            console.warn('⚠️ [DEMO-CORE] Backend check falhou na inicialização');
        }
        
        // Disparar evento
        window.dispatchEvent(new CustomEvent('soundy:demo:activated', {
            detail: { visitorId, data }
        }));
        
        // 🎯 MOSTRAR AVISO DE DEMO + AUTO-ABRIR MODAL DE ANÁLISE
        setTimeout(() => {
            // Mostrar aviso de demo
            showDemoWelcomeNotice();
            
            if (typeof window.openModeSelectionModal === 'function') {
                console.log('🎯 [DEMO-CORE] Abrindo modal de análise automaticamente...');
                window.openModeSelectionModal();
            } else {
                console.warn('⚠️ [DEMO-CORE] openModeSelectionModal não disponível ainda, aguardando...');
                // Tentar novamente após mais tempo
                setTimeout(() => {
                    if (typeof window.openModeSelectionModal === 'function') {
                        console.log('🎯 [DEMO-CORE] Abrindo modal de análise (2ª tentativa)...');
                        window.openModeSelectionModal();
                    }
                }, 2000);
            }
        }, 1500);
        
        return true;
    };
    
    /**
     * Mostra aviso de boas-vindas do demo
     */
    function showDemoWelcomeNotice() {
        // Evitar duplicação
        if (document.getElementById('demoWelcomeNotice')) return;
        
        const notice = document.createElement('div');
        notice.id = 'demoWelcomeNotice';
        notice.innerHTML = `
            <div style="
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, rgba(188, 19, 254, 0.95) 0%, rgba(0, 243, 255, 0.95) 100%);
                color: white;
                padding: 16px 28px;
                border-radius: 12px;
                font-family: 'Rajdhani', sans-serif;
                font-size: 1.1rem;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                animation: demoNoticeSlide 0.5s ease;
                display: flex;
                align-items: center;
                gap: 12px;
            ">
                <span style="font-size: 1.5rem;">🎁</span>
                <span>Você tem direito a <strong>1 análise demonstrativa gratuita</strong></span>
            </div>
            <style>
                @keyframes demoNoticeSlide {
                    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            </style>
        `;
        
        document.body.appendChild(notice);
        
        // Auto-remover após 6 segundos
        setTimeout(() => {
            notice.style.transition = 'opacity 0.5s ease';
            notice.style.opacity = '0';
            setTimeout(() => notice.remove(), 500);
        }, 6000);
        
        console.log('📢 [DEMO-CORE] Aviso de boas-vindas exibido');
    }

    /**
     * Obtém status do demo
     */
    window.SoundyDemo.getStatus = function() {
        const data = window.SoundyDemo.data || {};
        return {
            enabled: DEMO_CONFIG.enabled,
            active: window.SoundyDemo.isActive,
            initialized: window.SoundyDemo.initialized,
            blocked: data.blocked || false,
            blockReason: data.blockReason || null,
            analysesUsed: data.analyses_used || 0,
            analysesLimit: DEMO_CONFIG.limits.maxAnalyses,
            analysesRemaining: Math.max(0, DEMO_CONFIG.limits.maxAnalyses - (data.analyses_used || 0)),
            messagesUsed: data.messages_used || 0,
            messagesLimit: DEMO_CONFIG.limits.maxMessages,
            messagesRemaining: Math.max(0, DEMO_CONFIG.limits.maxMessages - (data.messages_used || 0)),
            checkoutUrl: DEMO_CONFIG.checkoutUrl,
            backendAuthoritative: window.SoundyDemo._backendAuthoritative
        };
    };

    // ═══════════════════════════════════════════════════════════
    // 🎯 AUTO-INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════
    
    function autoInit() {
        if (isDemoMode()) {
            console.log('🎯 [DEMO-CORE] Modo demo detectado via URL');
            window.SoundyDemo.activate();
        } else {
            console.log('ℹ️ [DEMO-CORE] Não está em modo demo');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        setTimeout(autoInit, 0);
    }

    console.log('🔥 [DEMO-CORE] Módulo Core carregado');

})();
