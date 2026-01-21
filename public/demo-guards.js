/**
 * 🔥 SOUNDYAI - DEMO GUARDS
 * 
 * Módulo de proteção: verificação de limites, interceptadores, registro de uso
 * Parte 2/3 do sistema de Demo de Venda
 * 
 * REGRAS CRÍTICAS:
 * - Registro de uso SOMENTE após sucesso real
 * - Backend tem PALAVRA FINAL se responder allowed:false
 * - Demo SOBREPÕE outros modos, não os desativa
 * 
 * @version 2.0.0
 * @created 2026-01-02
 */

(function() {
    'use strict';

    // Aguardar demo-core.js carregar
    if (!window.SoundyDemo) {
        error('❌ [DEMO-GUARDS] demo-core.js não carregado!');
        return;
    }

    const DEMO = window.SoundyDemo;
    const CONFIG = DEMO.config;

    // ═══════════════════════════════════════════════════════════
    // 🚦 VERIFICAÇÃO DE LIMITES
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Verifica se pode fazer análise
     * @returns {{allowed: boolean, remaining?: number, reason: string}}
     */
    DEMO.canAnalyze = function() {
        if (!DEMO.isActive) {
            return { allowed: true, reason: 'not_demo_mode' };
        }
        
        const data = DEMO.data;
        if (!data) {
            return { allowed: false, reason: 'not_initialized' };
        }
        
        // 🔴 VERIFICAR BLOQUEIO TOTAL PRIMEIRO
        if (data.blocked) {
            log('🚫 [DEMO-GUARDS] Usuário já bloqueado:', data.blockReason);
            return { allowed: false, remaining: 0, reason: data.blockReason || 'blocked' };
        }
        
        const remaining = CONFIG.limits.maxAnalyses - data.analyses_used;
        
        if (remaining <= 0) {
            return { allowed: false, remaining: 0, reason: 'analysis_limit_reached' };
        }
        
        return { allowed: true, remaining };
    };

    /**
     * Verifica se pode enviar mensagem
     * @returns {{allowed: boolean, remaining?: number, reason: string}}
     */
    DEMO.canSendMessage = function() {
        if (!DEMO.isActive) {
            return { allowed: true, reason: 'not_demo_mode' };
        }
        
        const data = DEMO.data;
        if (!data) {
            return { allowed: false, reason: 'not_initialized' };
        }
        
        // 🔴 VERIFICAR BLOQUEIO TOTAL PRIMEIRO
        if (data.blocked) {
            log('🚫 [DEMO-GUARDS] Usuário já bloqueado:', data.blockReason);
            return { allowed: false, remaining: 0, reason: data.blockReason || 'blocked' };
        }
        
        const remaining = CONFIG.limits.maxMessages - data.messages_used;
        
        if (remaining <= 0) {
            return { allowed: false, remaining: 0, reason: 'message_limit_reached' };
        }
        
        return { allowed: true, remaining };
    };

    // ═══════════════════════════════════════════════════════════
    // 📝 REGISTRO DE USO (SOMENTE APÓS SUCESSO REAL)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Registra análise realizada
     * 
     * ⚠️ IMPORTANTE: Chamar SOMENTE após análise finalizada com sucesso
     * - NÃO chamar no clique
     * - NÃO chamar antes de erro/abort
     * - Chamar APÓS análise completa (resultado recebido)
     */
    DEMO.registerAnalysis = async function() {
        if (!DEMO.isActive) return { success: false, reason: 'not_active' };
        
        const data = DEMO.data;
        if (!data) return { success: false, reason: 'no_data' };
        
        // Incrementar contador local
        data.analyses_used++;
        log(`📊 [DEMO-GUARDS] Análise registrada: ${data.analyses_used}/${CONFIG.limits.maxAnalyses}`);
        
        // Salvar localmente
        await DEMO._saveDemoData(data);
        
        // 🔗 Sincronizar com backend
        let backendResult = null;
        try {
            backendResult = await DEMO._registerBackend('analysis');
        } catch (e) {
            warn('⚠️ [DEMO-GUARDS] Falha ao registrar análise no backend:', e.message);
        }
        
        // 🔥 MOSTRAR CTA APÓS ANÁLISE COMPLETAR
        if (data.analyses_used >= CONFIG.limits.maxAnalyses) {
            log('🚫 [DEMO-GUARDS] Limite de análises atingido - mostrando CTA');
            // Aguardar um pouco para o resultado da análise aparecer, depois mostrar CTA
            setTimeout(() => {
                DEMO.showConversionModal('analysis_complete');
            }, 3000); // 3 segundos após o resultado
        }
        
        return { success: true, backendResult };
    };

    /**
     * Registra mensagem enviada
     * 
     * ⚠️ IMPORTANTE: Chamar SOMENTE após resposta da IA recebida
     * - NÃO chamar no clique de enviar
     * - NÃO chamar se houve erro no envio
     * - Chamar APÓS resposta da IA chegar
     */
    DEMO.registerMessage = async function() {
        if (!DEMO.isActive) return { success: false, reason: 'not_active' };
        
        const data = DEMO.data;
        if (!data) return { success: false, reason: 'no_data' };
        
        // Incrementar contador local
        data.messages_used++;
        log(`💬 [DEMO-GUARDS] Mensagem registrada: ${data.messages_used}/${CONFIG.limits.maxMessages}`);
        
        // Salvar localmente
        await DEMO._saveDemoData(data);
        
        // 🔗 Sincronizar com backend
        let backendResult = null;
        try {
            backendResult = await DEMO._registerBackend('message');
        } catch (e) {
            warn('⚠️ [DEMO-GUARDS] Falha ao registrar mensagem no backend:', e.message);
        }
        
        // Log de limite atingido
        if (data.messages_used >= CONFIG.limits.maxMessages) {
            log('🚫 [DEMO-GUARDS] Limite de mensagens atingido');
        }
        
        return { success: true, backendResult };
    };

    // ═══════════════════════════════════════════════════════════
    // 🎯 INTERCEPTADORES DE AÇÃO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * 🔴 INTERCEPTAÇÃO SÍNCRONA (compatibilidade)
     * Verifica localmente - backend é verificado no endpoint
     * 
     * @returns {boolean} true se permitido, false se bloqueado
     */
    DEMO.interceptAnalysis = function() {
        if (!DEMO.isActive) return true;
        
        // 1. Verificar bloqueio local (síncrono)
        const localCheck = DEMO.canAnalyze();
        
        if (!localCheck.allowed) {
            log('🚫 [DEMO-GUARDS] Análise bloqueada localmente:', localCheck.reason);
            DEMO.showConversionModal('analysis_limit');
            return false;
        }
        
        // 2. Disparar verificação backend (fire and forget)
        // O backend é a FONTE DE VERDADE - bloqueará no endpoint se necessário
        if (typeof DEMO.checkBackendPermission === 'function') {
            DEMO.checkBackendPermission().then(result => {
                if (!result.allowed) {
                    log('🚫 [DEMO-GUARDS] Backend bloqueou async:', result.reason);
                    // Sincronizar estado local
                    if (DEMO.data) {
                        DEMO.data.blocked = true;
                        DEMO.data.blockReason = result.reason || 'backend_blocked';
                        DEMO._saveDemoData(DEMO.data);
                    }
                }
            }).catch(() => {});
        }
        
        // 3. Permitir tentativa - backend fará o bloqueio autoritativo
        return true;
    };
    
    /**
     * 🔴 INTERCEPTAÇÃO ASSÍNCRONA (recomendado)
     * Verifica no backend ANTES de permitir a ação
     * 
     * @returns {Promise<boolean>} true se permitido, false se bloqueado
     */
    DEMO.interceptAnalysisAsync = async function() {
        if (!DEMO.isActive) return true;
        
        // 1. Verificar bloqueio local primeiro (rápido)
        const localCheck = DEMO.canAnalyze();
        if (!localCheck.allowed) {
            log('🚫 [DEMO-GUARDS] Análise bloqueada localmente:', localCheck.reason);
            DEMO.showConversionModal('analysis_limit');
            return false;
        }
        
        // 2. 🔴 VERIFICAÇÃO BACKEND OBRIGATÓRIA
        try {
            const backendCheck = await DEMO.checkBackendPermission();
            
            if (!backendCheck.allowed) {
                log('🚫 [DEMO-GUARDS] Análise bloqueada pelo BACKEND:', backendCheck.reason);
                
                // Sincronizar estado local
                if (DEMO.data) {
                    DEMO.data.blocked = true;
                    DEMO.data.blockReason = backendCheck.reason || 'backend_blocked';
                    await DEMO._saveDemoData(DEMO.data);
                }
                
                DEMO.showConversionModal('analysis_limit');
                return false;
            }
            
            log('✅ [DEMO-GUARDS] Análise permitida pelo backend');
            return true;
            
        } catch (error) {
            warn('⚠️ [DEMO-GUARDS] Erro na verificação backend:', error.message);
            // Fail-open: Se backend falhar, usar verificação local
            return localCheck.allowed;
        }
    };

    /**
     * Intercepta tentativa de mensagem
     * 
     * @returns {boolean} true se permitido, false se bloqueado
     */
    DEMO.interceptMessage = function() {
        if (!DEMO.isActive) return true;
        
        // Verificar limite local (síncrono para compatibilidade)
        const localCheck = DEMO.canSendMessage();
        
        if (!localCheck.allowed) {
            log('🚫 [DEMO-GUARDS] Mensagem bloqueada:', localCheck.reason);
            DEMO.showConversionModal('chat_limit');
            return false;
        }
        
        // Backend check assíncrono (fire and forget para sync)
        DEMO.validateBackend('check').then(result => {
            if (result.backendAuthoritative && 
                result.permissions?.canMessage === false) {
                log('🚫 [DEMO-GUARDS] Backend bloqueou - forçando modal');
                DEMO.showConversionModal('chat_limit');
            }
        }).catch(() => {});
        
        return true;
    };

    /**
     * Força bloqueio imediato e PERMANENTE
     * Salva no estado para que o bloqueio persista mesmo após reload
     * 
     * @param {Object|string} options - Opções ou string reason
     */
    DEMO.forceBlock = async function(options = {}) {
        // Normalizar parâmetro (aceita string ou objeto)
        if (typeof options === 'string') {
            options = { reason: options };
        }
        
        const reason = options.reason || 'forced_block';
        
        log('🚫 [DEMO-GUARDS] Bloqueio forçado PERMANENTE:', reason);
        
        const data = DEMO.data;
        if (data) {
            // 🔴 MARCAR COMO BLOQUEADO PERMANENTEMENTE
            data.blocked = true;
            data.blockReason = reason;
            data.blocked_at = new Date().toISOString();
            
            // Salvar estado
            await DEMO._saveDemoData(data);
            log('💾 [DEMO-GUARDS] Estado de bloqueio salvo');
        }
        
        // Mostrar modal de conversão
        DEMO.showConversionModal(reason);
    };

    // ═══════════════════════════════════════════════════════════
    // 📡 LISTENER PARA ANÁLISE FINALIZADA (FALLBACK)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * 🔴 FALLBACK: Escuta evento de análise finalizada
     * O bloqueio HARD principal é feito em displayModalResults()
     * Este listener serve como backup caso o bloqueio principal falhe
     */
    window.addEventListener('audio-analysis-finished', async function(event) {
        if (!DEMO.isActive) return;
        
        const detail = event.detail || {};
        
        // Só processar se foi sucesso
        if (!detail.success) {
            log('⚠️ [DEMO-GUARDS] Análise não teve sucesso, ignorando');
            return;
        }
        
        log('🎯 [DEMO-GUARDS] audio-analysis-finished recebido');
        
        // Verificar se bloqueio já foi aplicado (pelo displayModalResults)
        if (DEMO.data?.blocked) {
            log('✅ [DEMO-GUARDS] Bloqueio já aplicado pelo displayModalResults');
            return;
        }
        
        // FALLBACK: Se bloqueio não foi aplicado, aplicar agora
        log('⚠️ [DEMO-GUARDS] FALLBACK: Aplicando bloqueio tardio...');
        await DEMO.registerAnalysis();
        
        if (DEMO.data) {
            DEMO.data.blocked = true;
            DEMO.data.blockReason = 'analysis_completed_fallback';
            DEMO.data.blocked_at = new Date().toISOString();
            await DEMO._saveDemoData(DEMO.data);
            log('💾 [DEMO-GUARDS] Bloqueio FALLBACK aplicado');
        }
    });

    // ═══════════════════════════════════════════════════════════
    // 🔒 BLOQUEIO DE UI NO MODO DEMO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * 🔴 DEMO: Bloquear fechamento de modais
     * - Usuário não pode clicar fora para fechar
     * - Usuário não pode usar ESC para fechar
     * - Chatbot fica escondido
     */
    function setupDemoUIRestrictions() {
        if (!DEMO.isActive) return;
        
        log('🔒 [DEMO-GUARDS] Configurando restrições de UI...');
        
        // 0. ADICIONAR CLASSE AO BODY PRIMEIRO
        document.body.classList.add('demo-mode-active');
        
        // 1. ESCONDER O CHATBOT
        hideChatbot();
        
        // 2. 🔴 ESCONDER TODOS OS BOTÕES X DE FECHAR
        hideAllCloseButtons();
        
        // 3. INTERCEPTAR FECHAMENTO DE MODAIS
        interceptModalClose();
        
        // 4. BLOQUEAR ESC PARA FECHAR MODAIS
        blockEscapeKey();
        
        // 5. BLOQUEAR CLIQUE FORA DO MODAL
        blockOutsideClick();
        
        log('✅ [DEMO-GUARDS] Restrições de UI configuradas');
    }
    
    /**
     * Esconde o chatbot no modo demo
     */
    function hideChatbot() {
        // IDs comuns de chatbots
        const chatbotSelectors = [
            '#chatContainer',
            '#chatWidget',
            '#chat-container',
            '#chat-widget',
            '.chat-container',
            '.chat-widget',
            '#soundy-chat',
            '.soundy-chat',
            '#ai-chat',
            '.ai-chat',
            '#chatbox',
            '.chatbox',
            '[data-chat]',
            '#floating-chat',
            '.floating-chat'
        ];
        
        // Adicionar CSS para esconder
        const style = document.createElement('style');
        style.id = 'demo-hide-chat';
        style.textContent = `
            /* 🔒 DEMO: Esconder chatbot */
            ${chatbotSelectors.join(',\n            ')} {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* Esconder botão de chat flutuante */
            .chat-toggle,
            .chat-button,
            #chat-toggle,
            #chat-button,
            [data-chat-toggle],
            .floating-action-button {
                display: none !important;
            }
        `;
        
        if (!document.getElementById('demo-hide-chat')) {
            document.head.appendChild(style);
            log('🔒 [DEMO-GUARDS] Chatbot escondido');
        }
    }
    
    /**
     * 🔴 DEMO: Esconder TODOS os botões X (fechar) dos modais
     * Usuário NÃO PODE fechar modais de jeito nenhum
     */
    function hideAllCloseButtons() {
        const style = document.createElement('style');
        style.id = 'demo-hide-close-buttons';
        style.textContent = `
            /* 🔴 DEMO: Esconder TODOS os botões X de fechar modal */
            body.demo-mode-active .audio-modal-close,
            body.demo-mode-active .modal-close,
            body.demo-mode-active .genre-modal-close,
            body.demo-mode-active .ai-modal-close,
            body.demo-mode-active .upgrade-modal-close,
            body.demo-mode-active [data-close],
            body.demo-mode-active .close-btn,
            body.demo-mode-active .btn-close,
            body.demo-mode-active button[aria-label*="Fechar"],
            body.demo-mode-active button[aria-label*="fechar"],
            body.demo-mode-active button[aria-label*="Close"],
            body.demo-mode-active button[aria-label*="close"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
        `;
        
        if (!document.getElementById('demo-hide-close-buttons')) {
            document.head.appendChild(style);
            log('🔒 [DEMO-GUARDS] Botões X de fechar escondidos');
        }
        
        // Adicionar classe ao body
        document.body.classList.add('demo-mode-active');
    }
    
    /**
     * Intercepta e bloqueia funções de fechar modal
     * IMPORTANTE: Só bloqueia fechamento "manual" (ESC, clique fora)
     *             Permite fechamento após seleção válida
     */
    function interceptModalClose() {
        // Flag para indicar que fechamento é resultado de seleção válida
        window.__demoAllowModalClose__ = false;
        
        // Salvar funções originais
        const originalCloseModeSelection = window.closeModeSelectionModal;
        const originalCloseGenreModal = window.closeGenreModal;
        const originalCloseSoundDestinationModal = window.closeSoundDestinationModal;
        const originalSelectSoundDestination = window.selectSoundDestination;
        const originalApplyGenreSelection = window.applyGenreSelection;
        const originalCloseWelcomeModal = window.closeWelcomeModal;
        const originalProceedToAnalysis = window.proceedToAnalysis;
        
        // 🔥 Interceptar closeWelcomeModal - NUNCA deixar fechar direto
        if (typeof originalCloseWelcomeModal === 'function') {
            window.closeWelcomeModal = function() {
                // Permitir SOMENTE se foi pelo proceedToAnalysis (flag ativa)
                if (window.__demoAllowModalClose__ || DEMO.data?.blocked || !DEMO.isActive) {
                    return originalCloseWelcomeModal.apply(this, arguments);
                }
                log('🚫 [DEMO-GUARDS] Bloqueando fechamento do modal de boas-vindas');
                return; // Não fecha
            };
        }
        
        // 🔥 Interceptar proceedToAnalysis para permitir fechamento
        if (typeof originalProceedToAnalysis === 'function') {
            window.proceedToAnalysis = function() {
                log('✅ [DEMO-GUARDS] Prosseguindo para análise - permitindo fechar welcome');
                window.__demoAllowModalClose__ = true;
                const result = originalProceedToAnalysis.apply(this, arguments);
                // Reset flag após pequeno delay
                setTimeout(() => { window.__demoAllowModalClose__ = false; }, 500);
                return result;
            };
        }
        
        // 🔥 Interceptar selectSoundDestination para permitir fechamento após seleção
        if (typeof originalSelectSoundDestination === 'function') {
            window.selectSoundDestination = function(mode) {
                log('✅ [DEMO-GUARDS] Seleção de destino permitida:', mode);
                window.__demoAllowModalClose__ = true;
                const result = originalSelectSoundDestination.apply(this, arguments);
                // Reset flag após pequeno delay
                setTimeout(() => { window.__demoAllowModalClose__ = false; }, 500);
                return result;
            };
        }
        
        // 🔥 Interceptar applyGenreSelection para permitir fechamento após seleção
        if (typeof originalApplyGenreSelection === 'function') {
            window.applyGenreSelection = function() {
                log('✅ [DEMO-GUARDS] Seleção de gênero permitida');
                window.__demoAllowModalClose__ = true;
                const result = originalApplyGenreSelection.apply(this, arguments);
                // Reset flag após pequeno delay
                setTimeout(() => { window.__demoAllowModalClose__ = false; }, 500);
                return result;
            };
        }
        
        // Interceptar closeModeSelectionModal
        if (typeof originalCloseModeSelection === 'function') {
            window.closeModeSelectionModal = function() {
                // Permitir se flag está ativa OU se já está bloqueado
                if (window.__demoAllowModalClose__ || DEMO.data?.blocked || !DEMO.isActive) {
                    return originalCloseModeSelection.apply(this, arguments);
                }
                log('🚫 [DEMO-GUARDS] Bloqueando fechamento do modal de seleção de modo');
                return; // Não fecha
            };
        }
        
        // Interceptar closeGenreModal
        if (typeof originalCloseGenreModal === 'function') {
            window.closeGenreModal = function() {
                // Permitir se flag está ativa OU se já está bloqueado
                if (window.__demoAllowModalClose__ || DEMO.data?.blocked || !DEMO.isActive) {
                    return originalCloseGenreModal.apply(this, arguments);
                }
                log('🚫 [DEMO-GUARDS] Bloqueando fechamento do modal de gênero');
                return; // Não fecha
            };
        }
        
        // Interceptar closeSoundDestinationModal
        if (typeof originalCloseSoundDestinationModal === 'function') {
            window.closeSoundDestinationModal = function() {
                // Permitir se flag está ativa OU se já está bloqueado
                if (window.__demoAllowModalClose__ || DEMO.data?.blocked || !DEMO.isActive) {
                    return originalCloseSoundDestinationModal.apply(this, arguments);
                }
                log('🚫 [DEMO-GUARDS] Bloqueando fechamento do modal de destino');
                return; // Não fecha
            };
        }
        
        log('🔒 [DEMO-GUARDS] Interceptadores de fechamento configurados (com permissão para seleções)');
    }
    
    /**
     * Bloqueia tecla ESC para fechar modais
     */
    function blockEscapeKey() {
        document.addEventListener('keydown', function(e) {
            if (!DEMO.isActive) return;
            if (DEMO.data?.blocked) return; // Se já bloqueado, permitir ESC
            
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                log('🚫 [DEMO-GUARDS] Tecla ESC bloqueada no modo demo');
            }
        }, true); // Capture phase para interceptar antes
    }
    
    /**
     * Bloqueia clique fora do modal para fechar
     * IMPORTANTE: Não bloqueia cliques em botões/cards dentro do modal
     */
    function blockOutsideClick() {
        document.addEventListener('click', function(e) {
            if (!DEMO.isActive) return;
            if (DEMO.data?.blocked) return; // Se já bloqueado, permitir cliques
            
            const target = e.target;
            
            // 🔥 NÃO bloquear cliques em elementos interativos dentro do modal
            const isInteractiveElement = 
                target.tagName === 'BUTTON' ||
                target.closest('button') ||
                target.classList.contains('destination-card') ||
                target.closest('.destination-card') ||
                target.classList.contains('genre-card') ||
                target.closest('.genre-card') ||
                target.classList.contains('mode-card') ||
                target.closest('.mode-card') ||
                target.tagName === 'INPUT' ||
                target.tagName === 'SELECT' ||
                target.closest('.modal-content') ||
                target.closest('.modal-container') ||
                target.closest('.destination-modal-container') ||
                target.closest('.genre-modal-content') ||
                target.closest('.mode-selection-content');
            
            if (isInteractiveElement) {
                // Permitir clique em elementos interativos
                return;
            }
            
            // Verificar se clicou no backdrop/overlay de um modal
            const isModalBackdrop = 
                target.classList.contains('modal-overlay') ||
                target.classList.contains('modal-backdrop') ||
                target.classList.contains('audio-modal') ||
                target.id === 'analysisModeModal' ||
                target.id === 'genreModal' ||
                target.id === 'soundDestinationModal' ||
                target.id === 'newGenreModal' ||
                target.id === 'welcomeAnalysisModal' ||
                target.id === 'audioAnalysisModal' ||
                (target.classList.contains('modal') && !target.closest('.modal-content'));
            
            // Se clicou no backdrop (não no conteúdo do modal)
            if (isModalBackdrop) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                log('🚫 [DEMO-GUARDS] Clique fora do modal bloqueado');
            }
        }, true); // Capture phase
        
        // CSS para reforçar
        const style = document.createElement('style');
        style.id = 'demo-modal-lock';
        style.textContent = `
            /* 🔒 DEMO: Garantir que conteúdo do modal seja clicável */
            body.demo-mode-active .modal-content,
            body.demo-mode-active .modal-container,
            body.demo-mode-active .mode-selection-content,
            body.demo-mode-active .genre-modal-content,
            body.demo-mode-active .destination-modal-container,
            body.demo-mode-active .destination-card,
            body.demo-mode-active .genre-card,
            body.demo-mode-active .mode-card,
            body.demo-mode-active button {
                pointer-events: auto !important;
            }
        `;
        
        if (!document.getElementById('demo-modal-lock')) {
            document.head.appendChild(style);
        }
        
        // Adicionar classe ao body
        document.body.classList.add('demo-mode-active');
    }
    
    // Expor função para uso externo
    DEMO.setupUIRestrictions = setupDemoUIRestrictions;
    
    // Configurar quando demo for ativado
    window.addEventListener('soundy:demo:activated', function() {
        log('🎯 [DEMO-GUARDS] Evento demo:activated recebido - configurando UI');
        setTimeout(setupDemoUIRestrictions, 100);
    });
    
    // Se demo já estiver ativo, configurar agora
    if (DEMO.isActive) {
        setTimeout(setupDemoUIRestrictions, 500);
    }

    log('🔥 [DEMO-GUARDS] Módulo Guards carregado');

})();
