/**
 * 🔓 SOUNDYAI - SISTEMA DE MODO ANÔNIMO
 * 
 * Permite que visitantes usem o sistema SEM LOGIN com limites:
 * - 1 análise completa (PERMANENTE - sem reset)
 * - 5 mensagens no chat
 * 
 * ⚠️ IMPORTANTE: O limite é controlado pelo BACKEND (anonymousLimiter.js)
 * O frontend apenas mostra informações - NÃO é autoridade de bloqueio
 * 
 * Utiliza FingerprintJS + LocalStorage + IndexedDB para anti-burla.
 * 
 * @version 2.0.0 - BLOQUEIO PERMANENTE
 * @created 2025-01-03
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // 🎛️ CONFIGURAÇÃO - FEATURE FLAG
    // ═══════════════════════════════════════════════════════════
    
    // ❌ DESATIVADO 2026-02-02: Forçar login obrigatório
    // ✅ Para reativar: mude para true
    const ANONYMOUS_MODE_ENABLED = false; // Alterar para false desativa todo o sistema
    
    // ═══════════════════════════════════════════════════════════
    // 📊 LIMITES DO MODO ANÔNIMO
    // ═══════════════════════════════════════════════════════════
    
    const ANONYMOUS_LIMITS = {
        maxAnalyses: 1,      // 1 análise NA VIDA (backend é autoridade)
        maxMessages: 5,      // Máximo de mensagens no chat
        storageKey: 'soundy_visitor_data',
        indexedDBName: 'SoundyAnonymousDB',
        indexedDBStore: 'visitors'
    };

    // ═══════════════════════════════════════════════════════════
    // 🌐 OBJETO GLOBAL
    // ═══════════════════════════════════════════════════════════
    
    window.SoundyAnonymous = {
        isEnabled: ANONYMOUS_MODE_ENABLED,
        isAnonymousMode: false,
        visitorId: null,
        limits: ANONYMOUS_LIMITS,
        data: null,
        initialized: false,
        
        // Callbacks para eventos
        onLimitReached: null,
        onModeActivated: null
    };

    // ═══════════════════════════════════════════════════════════
    // 🎯 SISTEMA DE DETECÇÃO DE MODO DE ACESSO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * 🎯 Retorna o modo de acesso atual do usuário
     * ORDEM DE PRIORIDADE: demo > logged > anonymous
     * 
     * @returns {'demo' | 'logged' | 'anonymous' | 'none'}
     */
    window.getAccessMode = function() {
        // 1️⃣ DEMO: Modo promocional (página de vendas)
        if (window.SoundyDemo?.isActive === true) {
            return 'demo';
        }
        
        // 2️⃣ LOGGED: Usuário autenticado no Firebase
        if (window.auth?.currentUser) {
            return 'logged';
        }
        
        // 3️⃣ ANONYMOUS: Visitante com limites
        if (window.SoundyAnonymous?.isAnonymousMode === true) {
            return 'anonymous';
        }
        
        // 4️⃣ NONE: Nenhum modo ativo (estado transitório)
        return 'none';
    };

    /**
     * 🔍 Debug: Mostra status de todos os modos
     */
    window.debugAccessModes = function() {
        console.group('🎯 [ACCESS-MODE] Status');
        log('Demo ativo:', window.SoundyDemo?.isActive === true);
        log('Logged (Firebase):', !!window.auth?.currentUser);
        log('Anonymous ativo:', window.SoundyAnonymous?.isAnonymousMode === true);
        log('Anonymous visitorId:', window.SoundyAnonymous?.visitorId?.substring(0, 12) + '...');
        log('→ Modo atual:', window.getAccessMode());
        console.groupEnd();
    };

    // ═══════════════════════════════════════════════════════════
    // 🔧 FUNÇÕES AUXILIARES
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
                log('✅ [ANONYMOUS] FingerprintJS carregado');
                resolve(window.FingerprintJS);
            };
            script.onerror = () => {
                warn('⚠️ [ANONYMOUS] Falha ao carregar FingerprintJS, usando fallback');
                resolve(null);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Gera um ID único de fallback (quando FingerprintJS falha)
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
        
        // Hash simples dos componentes
        let hash = 0;
        const str = components.join('|');
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return 'fb_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    }

    /**
     * Obtém o fingerprint do visitante
     */
    async function getVisitorFingerprint() {
        try {
            const FP = await loadFingerprintJS();
            
            if (FP) {
                const fp = await FP.load();
                const result = await fp.get();
                log('✅ [ANONYMOUS] Fingerprint gerado:', result.visitorId.substring(0, 8) + '...');
                return result.visitorId;
            }
        } catch (error) {
            warn('⚠️ [ANONYMOUS] Erro no FingerprintJS:', error.message);
        }
        
        // Fallback
        const fallbackId = generateFallbackId();
        log('⚠️ [ANONYMOUS] Usando fallback ID:', fallbackId.substring(0, 12) + '...');
        return fallbackId;
    }

    // ═══════════════════════════════════════════════════════════
    // 💾 PERSISTÊNCIA - LOCALSTORAGE + INDEXEDDB
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Salva dados no localStorage
     */
    function saveToLocalStorage(data) {
        try {
            localStorage.setItem(ANONYMOUS_LIMITS.storageKey, JSON.stringify(data));
            return true;
        } catch (e) {
            warn('⚠️ [ANONYMOUS] Erro ao salvar localStorage:', e.message);
            return false;
        }
    }

    /**
     * Carrega dados do localStorage
     */
    function loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(ANONYMOUS_LIMITS.storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            warn('⚠️ [ANONYMOUS] Erro ao ler localStorage:', e.message);
            return null;
        }
    }

    /**
     * Abre conexão com IndexedDB
     */
    function openIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                resolve(null);
                return;
            }
            
            const request = indexedDB.open(ANONYMOUS_LIMITS.indexedDBName, 1);
            
            request.onerror = () => {
                warn('⚠️ [ANONYMOUS] Erro ao abrir IndexedDB');
                resolve(null);
            };
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(ANONYMOUS_LIMITS.indexedDBStore)) {
                    db.createObjectStore(ANONYMOUS_LIMITS.indexedDBStore, { keyPath: 'visitor_id' });
                }
            };
        });
    }

    /**
     * Salva dados no IndexedDB (backup)
     */
    async function saveToIndexedDB(data) {
        try {
            const db = await openIndexedDB();
            if (!db) return false;
            
            return new Promise((resolve) => {
                const tx = db.transaction(ANONYMOUS_LIMITS.indexedDBStore, 'readwrite');
                const store = tx.objectStore(ANONYMOUS_LIMITS.indexedDBStore);
                store.put(data);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    }

    /**
     * Carrega dados do IndexedDB
     */
    async function loadFromIndexedDB(visitorId) {
        try {
            const db = await openIndexedDB();
            if (!db) return null;
            
            return new Promise((resolve) => {
                const tx = db.transaction(ANONYMOUS_LIMITS.indexedDBStore, 'readonly');
                const store = tx.objectStore(ANONYMOUS_LIMITS.indexedDBStore);
                const request = store.get(visitorId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 📊 GERENCIAMENTO DE DADOS DO VISITANTE
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Cria estrutura de dados inicial do visitante
     * BLOQUEIO GRANULAR: chat e análise são bloqueados separadamente
     */
    function createVisitorData(visitorId) {
        return {
            visitor_id: visitorId,
            analysis_count: 0,
            message_count: 0,
            first_visit: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            // 🔓 BLOQUEIO GRANULAR (não mais global)
            analysis_blocked: false,  // Só bloqueia análises
            message_blocked: false,   // Só bloqueia mensagens
            // Manter para compatibilidade (mas não usar para lógica)
            blocked: false,
            block_reason: null
        };
    }

    /**
     * Carrega ou cria dados do visitante
     */
    async function loadOrCreateVisitorData(visitorId) {
        // 1. Tentar carregar do localStorage
        let data = loadFromLocalStorage();
        
        // 2. Validar se o fingerprint corresponde
        if (data && data.visitor_id === visitorId) {
            log('✅ [ANONYMOUS] Dados carregados do localStorage');
            data.last_activity = new Date().toISOString();
            // 🔓 MIGRAR dados antigos para bloqueio granular
            data = migrateToGranularBlocking(data);
            return data;
        }
        
        // 3. Tentar carregar do IndexedDB (se localStorage foi limpo)
        const idbData = await loadFromIndexedDB(visitorId);
        if (idbData) {
            log('✅ [ANONYMOUS] Dados recuperados do IndexedDB (anti-burla)');
            idbData.last_activity = new Date().toISOString();
            // 🔓 MIGRAR dados antigos para bloqueio granular
            const migrated = migrateToGranularBlocking(idbData);
            saveToLocalStorage(migrated); // Re-sincronizar
            return migrated;
        }
        
        // 4. Se existe dados de outro visitor_id no localStorage, 
        //    pode ser tentativa de burla - herdar os limites mais restritivos
        if (data && data.visitor_id !== visitorId) {
            warn('⚠️ [ANONYMOUS] Fingerprint diferente detectado - possível tentativa de burla');
            
            // Criar novo registro mas herdar contadores se estiverem altos
            const newData = createVisitorData(visitorId);
            newData.analysis_count = Math.max(data.analysis_count || 0, 0);
            newData.message_count = Math.max(data.message_count || 0, 0);
            // 🔓 GRANULAR: Herdar bloqueios individuais
            newData.analysis_blocked = newData.analysis_count >= ANONYMOUS_LIMITS.maxAnalyses;
            newData.message_blocked = newData.message_count >= ANONYMOUS_LIMITS.maxMessages;
            newData.blocked = newData.analysis_blocked && newData.message_blocked;
            newData.block_reason = newData.blocked ? 'all_limits_reached' : null;
            
            return newData;
        }
        
        // 5. Criar dados novos
        log('🆕 [ANONYMOUS] Criando novo registro de visitante');
        return createVisitorData(visitorId);
    }

    /**
     * 🔓 MIGRA dados antigos para sistema de bloqueio granular
     */
    function migrateToGranularBlocking(data) {
        // Se já tem campos granulares, não migrar
        if (data.analysis_blocked !== undefined && data.message_blocked !== undefined) {
            return data;
        }
        
        log('🔄 [ANONYMOUS] Migrando dados para bloqueio granular...');
        
        // Calcular bloqueios baseado nos contadores
        data.analysis_blocked = data.analysis_count >= ANONYMOUS_LIMITS.maxAnalyses;
        data.message_blocked = data.message_count >= ANONYMOUS_LIMITS.maxMessages;
        
        // Bloqueio total só quando AMBOS estão bloqueados
        data.blocked = data.analysis_blocked && data.message_blocked;
        data.block_reason = data.blocked ? 'all_limits_reached' : null;
        
        log('✅ [ANONYMOUS] Migração concluída:', {
            analysis_blocked: data.analysis_blocked,
            message_blocked: data.message_blocked,
            fully_blocked: data.blocked
        });
        
        return data;
    }

    /**
     * Salva dados do visitante em todas as camadas
     */
    async function saveVisitorData(data) {
        data.last_activity = new Date().toISOString();
        
        // Salvar em ambos os storages
        saveToLocalStorage(data);
        await saveToIndexedDB(data);
        
        // Atualizar objeto global
        window.SoundyAnonymous.data = data;
        
        log('💾 [ANONYMOUS] Dados salvos:', {
            analyses: data.analysis_count + '/' + ANONYMOUS_LIMITS.maxAnalyses,
            messages: data.message_count + '/' + ANONYMOUS_LIMITS.maxMessages,
            analysisBlocked: data.analysis_blocked,
            messageBlocked: data.message_blocked,
            fullyBlocked: data.blocked
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 🚦 VERIFICAÇÃO DE LIMITES
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Verifica se pode fazer análise
     * 🔓 BLOQUEIO GRANULAR: Só verifica limite de análises, não de mensagens
     * @returns {Object} { allowed: boolean, remaining: number, reason?: string }
     */
    window.SoundyAnonymous.canAnalyze = function() {
        if (!window.SoundyAnonymous.isAnonymousMode) {
            return { allowed: true, remaining: Infinity, reason: 'authenticated' };
        }
        
        const data = window.SoundyAnonymous.data;
        if (!data) {
            return { allowed: false, remaining: 0, reason: 'not_initialized' };
        }
        
        // 🔓 GRANULAR: Só verifica bloqueio de ANÁLISE (não global)
        if (data.analysis_blocked) {
            return { allowed: false, remaining: 0, reason: 'analysis_limit_reached' };
        }
        
        const remaining = ANONYMOUS_LIMITS.maxAnalyses - data.analysis_count;
        
        if (remaining <= 0) {
            return { allowed: false, remaining: 0, reason: 'analysis_limit_reached' };
        }
        
        return { allowed: true, remaining };
    };

    /**
     * Verifica se pode enviar mensagem
     * 🔓 BLOQUEIO GRANULAR: Só verifica limite de mensagens, não de análises
     * @returns {Object} { allowed: boolean, remaining: number, reason?: string }
     */
    window.SoundyAnonymous.canSendMessage = function() {
        if (!window.SoundyAnonymous.isAnonymousMode) {
            return { allowed: true, remaining: Infinity, reason: 'authenticated' };
        }
        
        const data = window.SoundyAnonymous.data;
        if (!data) {
            return { allowed: false, remaining: 0, reason: 'not_initialized' };
        }
        
        // 🔓 GRANULAR: Só verifica bloqueio de MENSAGEM (não global)
        if (data.message_blocked) {
            return { allowed: false, remaining: 0, reason: 'message_limit_reached' };
        }
        
        const remaining = ANONYMOUS_LIMITS.maxMessages - data.message_count;
        
        if (remaining <= 0) {
            return { allowed: false, remaining: 0, reason: 'message_limit_reached' };
        }
        
        return { allowed: true, remaining };
    };

    /**
     * Verifica se usuário está bloqueado para TUDO (ambos limites atingidos)
     * O modal de login obrigatório só aparece quando AMBOS excedem
     */
    window.SoundyAnonymous.isFullyBlocked = function() {
        const data = window.SoundyAnonymous.data;
        if (!data) return false;
        return data.analysis_blocked && data.message_blocked;
    };

    /**
     * Verifica se usuário está em modo anônimo (para ações premium)
     */
    window.SoundyAnonymous.isBlocked = function() {
        return window.SoundyAnonymous.isAnonymousMode;
    };

    // ═══════════════════════════════════════════════════════════
    // 📝 REGISTRO DE USO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Registra uma análise realizada
     * 🔓 BLOQUEIO GRANULAR: Só bloqueia análises, não mensagens
     */
    window.SoundyAnonymous.registerAnalysis = async function() {
        if (!window.SoundyAnonymous.isAnonymousMode) return;
        
        const data = window.SoundyAnonymous.data;
        if (!data) return;
        
        data.analysis_count++;
        log(`📊 [ANONYMOUS] Análise registrada: ${data.analysis_count}/${ANONYMOUS_LIMITS.maxAnalyses}`);
        
        // 🔓 GRANULAR: Só bloqueia ANÁLISE (chat continua liberado)
        if (data.analysis_count >= ANONYMOUS_LIMITS.maxAnalyses) {
            data.analysis_blocked = true;
            log('🚫 [ANONYMOUS] Limite de ANÁLISES atingido (chat ainda disponível)');
            
            // Verificar se AMBOS estão bloqueados para mostrar modal obrigatório
            if (data.message_blocked) {
                data.blocked = true;
                data.block_reason = 'all_limits_reached';
                log('🔒 [ANONYMOUS] TODOS os limites atingidos - modal obrigatório');
                if (typeof window.SoundyAnonymous.onLimitReached === 'function') {
                    window.SoundyAnonymous.onLimitReached('all');
                }
            }
        }
        
        await saveVisitorData(data);
    };

    /**
     * Registra uma mensagem enviada
     * 🔓 BLOQUEIO GRANULAR: Só bloqueia mensagens, não análises
     */
    window.SoundyAnonymous.registerMessage = async function() {
        if (!window.SoundyAnonymous.isAnonymousMode) return;
        
        const data = window.SoundyAnonymous.data;
        if (!data) return;
        
        data.message_count++;
        log(`💬 [ANONYMOUS] Mensagem registrada: ${data.message_count}/${ANONYMOUS_LIMITS.maxMessages}`);
        
        // 🔓 GRANULAR: Só bloqueia MENSAGEM (análise continua liberada)
        if (data.message_count >= ANONYMOUS_LIMITS.maxMessages) {
            data.message_blocked = true;
            log('🚫 [ANONYMOUS] Limite de MENSAGENS atingido (análise ainda disponível)');
            
            // Verificar se AMBOS estão bloqueados para mostrar modal obrigatório
            if (data.analysis_blocked) {
                data.blocked = true;
                data.block_reason = 'all_limits_reached';
                log('🔒 [ANONYMOUS] TODOS os limites atingidos - modal obrigatório');
                if (typeof window.SoundyAnonymous.onLimitReached === 'function') {
                    window.SoundyAnonymous.onLimitReached('all');
                }
            }
        }
        
        await saveVisitorData(data);
    };

    // ═══════════════════════════════════════════════════════════
    // 🪟 MODAL DE LOGIN OBRIGATÓRIO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Mostra o modal de login obrigatório
     * @param {string} reason - 'analysis' | 'message' | 'upgrade' | 'manage' | 'history'
     */
    window.SoundyAnonymous.showLoginModal = function(reason = 'limit') {
        const existingModal = document.getElementById('loginRequiredModal');
        if (existingModal) {
            existingModal.style.display = 'flex';
            updateModalContent(reason);
            return;
        }
        
        // Criar modal
        const modal = document.createElement('div');
        modal.id = 'loginRequiredModal';
        modal.className = 'login-required-modal-overlay';
        modal.innerHTML = `
            <div class="login-required-modal">
                <div class="login-required-modal-header">
                    <div class="login-required-modal-icon">🔒</div>
                    <h2 class="login-required-modal-title">Crie sua conta gratuita</h2>
                    <button class="login-required-modal-close" onclick="window.SoundyAnonymous.hideLoginModal()">&times;</button>
                </div>
                
                <div class="login-required-modal-body">
                    <p class="login-required-modal-subtitle" id="loginModalSubtitle">
                        Você aproveitou o teste gratuito do SoundyAI!
                    </p>
                    
                    <div class="login-required-modal-usage" id="loginModalUsage">
                        <div class="usage-item used">
                            <span class="usage-icon">✅</span>
                            <span class="usage-text">1 análise gratuita usada</span>
                        </div>
                        <div class="usage-item used">
                            <span class="usage-icon">✅</span>
                            <span class="usage-text">5 mensagens no chat usadas</span>
                        </div>
                    </div>
                    
                    <div class="login-required-modal-benefits">
                        <p class="benefits-title">Ao criar sua conta gratuita, você ganha:</p>
                        <ul class="benefits-list">
                            <li><span class="benefit-icon">📊</span> +1 análise completa por mês</li>
                            <li><span class="benefit-icon">💬</span> +20 mensagens no chat por mês</li>
                            <li><span class="benefit-icon">📈</span> Histórico de análises</li>
                            <li><span class="benefit-icon">🚀</span> Acesso a upgrades Premium</li>
                        </ul>
                    </div>
                </div>
                
                <div class="login-required-modal-footer">
                    <button class="login-required-btn-primary" onclick="window.SoundyAnonymous.redirectToLogin()">
                        <span>Criar conta gratuita</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                    <button class="login-required-btn-secondary" onclick="window.SoundyAnonymous.redirectToLogin()">
                        Já tenho conta - Fazer login
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        updateModalContent(reason);
        
        // Fechar ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                window.SoundyAnonymous.hideLoginModal();
            }
        });
        
        // Prevenir scroll do body
        document.body.style.overflow = 'hidden';
    };

    /**
     * Atualiza conteúdo do modal baseado no motivo
     */
    function updateModalContent(reason) {
        const subtitle = document.getElementById('loginModalSubtitle');
        const usage = document.getElementById('loginModalUsage');
        const data = window.SoundyAnonymous.data || { analysis_count: 0, message_count: 0 };
        
        if (!subtitle || !usage) return;
        
        switch(reason) {
            case 'analysis':
                subtitle.textContent = 'Você usou todas as análises gratuitas!';
                break;
            case 'message':
                subtitle.textContent = 'Você usou todas as mensagens gratuitas!';
                break;
            case 'upgrade':
                subtitle.textContent = 'Crie uma conta para fazer upgrade do plano.';
                break;
            case 'manage':
                subtitle.textContent = 'Crie uma conta para gerenciar seu perfil.';
                break;
            case 'history':
                subtitle.textContent = 'Crie uma conta para acessar seu histórico.';
                break;
            default:
                subtitle.textContent = 'Você aproveitou o teste gratuito do SoundyAI!';
        }
        
        // Atualizar contadores
        usage.innerHTML = `
            <div class="usage-item ${data.analysis_count >= ANONYMOUS_LIMITS.maxAnalyses ? 'used' : ''}">
                <span class="usage-icon">${data.analysis_count >= ANONYMOUS_LIMITS.maxAnalyses ? '✅' : '📊'}</span>
                <span class="usage-text">${data.analysis_count}/${ANONYMOUS_LIMITS.maxAnalyses} análises usadas</span>
            </div>
            <div class="usage-item ${data.message_count >= ANONYMOUS_LIMITS.maxMessages ? 'used' : ''}">
                <span class="usage-icon">${data.message_count >= ANONYMOUS_LIMITS.maxMessages ? '✅' : '💬'}</span>
                <span class="usage-text">${data.message_count}/${ANONYMOUS_LIMITS.maxMessages} mensagens usadas</span>
            </div>
        `;
    }

    /**
     * Esconde o modal de login
     */
    window.SoundyAnonymous.hideLoginModal = function() {
        const modal = document.getElementById('loginRequiredModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    /**
     * Redireciona para página de login
     */
    window.SoundyAnonymous.redirectToLogin = function() {
        // Salvar estado atual para possível restauração após login
        const returnUrl = window.location.href;
        sessionStorage.setItem('soundy_return_url', returnUrl);
        
        window.location.href = 'login.html';
    };

    // ═══════════════════════════════════════════════════════════
    // 🚀 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Ativa o modo anônimo
     */
    window.SoundyAnonymous.activate = async function() {
        if (!ANONYMOUS_MODE_ENABLED) {
            log('⚠️ [ANONYMOUS] Sistema desabilitado via feature flag');
            return false;
        }
        
        log('🔓 [ANONYMOUS] Ativando modo anônimo...');
        
        // Gerar fingerprint
        const visitorId = await getVisitorFingerprint();
        window.SoundyAnonymous.visitorId = visitorId;
        
        // Carregar ou criar dados
        const data = await loadOrCreateVisitorData(visitorId);
        window.SoundyAnonymous.data = data;
        
        // Salvar dados (garante persistência)
        await saveVisitorData(data);
        
        // Ativar modo
        window.SoundyAnonymous.isAnonymousMode = true;
        window.SoundyAnonymous.initialized = true;
        
        // Configurar callback padrão
        window.SoundyAnonymous.onLimitReached = function(type) {
            window.SoundyAnonymous.showLoginModal(type);
        };
        
        log('✅ [ANONYMOUS] Modo anônimo ATIVADO:', {
            visitorId: visitorId.substring(0, 12) + '...',
            analyses: data.analysis_count + '/' + ANONYMOUS_LIMITS.maxAnalyses,
            messages: data.message_count + '/' + ANONYMOUS_LIMITS.maxMessages,
            blocked: data.blocked
        });
        
        // Disparar callback de ativação
        if (typeof window.SoundyAnonymous.onModeActivated === 'function') {
            window.SoundyAnonymous.onModeActivated();
        }
        
        // Disparar evento customizado
        window.dispatchEvent(new CustomEvent('soundy:anonymous:activated', {
            detail: { visitorId, data }
        }));
        
        return true;
    };

    /**
     * Desativa o modo anônimo (após login)
     */
    window.SoundyAnonymous.deactivate = function() {
        log('🔐 [ANONYMOUS] Modo anônimo DESATIVADO (usuário autenticado)');
        
        window.SoundyAnonymous.isAnonymousMode = false;
        window.SoundyAnonymous.forceCleanState = false; // ✅ Resetar flag de logout
        
        // Disparar evento
        window.dispatchEvent(new CustomEvent('soundy:anonymous:deactivated'));
    };

    /**
     * Obtém status atual do modo anônimo
     * 🔓 BLOQUEIO GRANULAR: Reporta bloqueios separados
     */
    window.SoundyAnonymous.getStatus = function() {
        const data = window.SoundyAnonymous.data || {};
        return {
            enabled: ANONYMOUS_MODE_ENABLED,
            active: window.SoundyAnonymous.isAnonymousMode,
            initialized: window.SoundyAnonymous.initialized,
            visitorId: window.SoundyAnonymous.visitorId,
            // Contadores
            analysesUsed: data.analysis_count || 0,
            analysesRemaining: Math.max(0, ANONYMOUS_LIMITS.maxAnalyses - (data.analysis_count || 0)),
            messagesUsed: data.message_count || 0,
            messagesRemaining: Math.max(0, ANONYMOUS_LIMITS.maxMessages - (data.message_count || 0)),
            // 🔓 BLOQUEIOS GRANULARES
            analysisBlocked: data.analysis_blocked || false,
            messageBlocked: data.message_blocked || false,
            // Bloqueio total (AMBOS atingidos)
            fullyBlocked: (data.analysis_blocked && data.message_blocked) || false,
            // Compatibilidade
            blocked: data.blocked || false,
            blockReason: data.block_reason
        };
    };

    // ═══════════════════════════════════════════════════════════
    // 🎯 INTERCEPTADORES DE AÇÕES
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Intercepta ação de análise
     * @returns {boolean} true se permitido, false se bloqueado
     */
    window.SoundyAnonymous.interceptAnalysis = function() {
        const check = window.SoundyAnonymous.canAnalyze();
        
        if (!check.allowed) {
            log('🚫 [ANONYMOUS] Análise bloqueada:', check.reason);
            window.SoundyAnonymous.showLoginModal('analysis');
            return false;
        }
        
        return true;
    };

    /**
     * Intercepta ação de mensagem
     * @returns {boolean} true se permitido, false se bloqueado
     */
    window.SoundyAnonymous.interceptMessage = function() {
        const check = window.SoundyAnonymous.canSendMessage();
        
        if (!check.allowed) {
            log('🚫 [ANONYMOUS] Mensagem bloqueada:', check.reason);
            window.SoundyAnonymous.showLoginModal('message');
            return false;
        }
        
        return true;
    };

    /**
     * Intercepta ações que requerem login
     * @param {string} action - 'upgrade' | 'manage' | 'history' | 'logout'
     */
    window.SoundyAnonymous.interceptPremiumAction = function(action) {
        if (window.SoundyAnonymous.isAnonymousMode) {
            log('🚫 [ANONYMOUS] Ação premium bloqueada:', action);
            window.SoundyAnonymous.showLoginModal(action);
            return false;
        }
        return true;
    };

    // ═══════════════════════════════════════════════════════════
    // 📢 LOG INICIAL
    // ═══════════════════════════════════════════════════════════
    
    log('🔓 [ANONYMOUS] Sistema de Modo Anônimo carregado');
    log('   Feature Flag:', ANONYMOUS_MODE_ENABLED ? 'ATIVADO' : 'DESATIVADO');
    log('   Limites: 1 análise (PERMANENTE), 5 mensagens');
    log('   Anti-burla: FingerprintJS + LocalStorage + IndexedDB');
    log('   ⚠️ Backend é a ÚNICA autoridade para bloqueio');

})();
