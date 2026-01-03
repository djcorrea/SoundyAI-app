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
        console.error('❌ [DEMO-GUARDS] demo-core.js não carregado!');
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
        console.log(`📊 [DEMO-GUARDS] Análise registrada: ${data.analyses_used}/${CONFIG.limits.maxAnalyses}`);
        
        // Salvar localmente
        await DEMO._saveDemoData(data);
        
        // 🔗 Sincronizar com backend
        let backendResult = null;
        try {
            backendResult = await DEMO._registerBackend('analysis');
        } catch (e) {
            console.warn('⚠️ [DEMO-GUARDS] Falha ao registrar análise no backend:', e.message);
        }
        
        // Log de limite atingido
        if (data.analyses_used >= CONFIG.limits.maxAnalyses) {
            console.log('🚫 [DEMO-GUARDS] Limite de análises atingido');
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
        console.log(`💬 [DEMO-GUARDS] Mensagem registrada: ${data.messages_used}/${CONFIG.limits.maxMessages}`);
        
        // Salvar localmente
        await DEMO._saveDemoData(data);
        
        // 🔗 Sincronizar com backend
        let backendResult = null;
        try {
            backendResult = await DEMO._registerBackend('message');
        } catch (e) {
            console.warn('⚠️ [DEMO-GUARDS] Falha ao registrar mensagem no backend:', e.message);
        }
        
        // Log de limite atingido
        if (data.messages_used >= CONFIG.limits.maxMessages) {
            console.log('🚫 [DEMO-GUARDS] Limite de mensagens atingido');
        }
        
        return { success: true, backendResult };
    };

    // ═══════════════════════════════════════════════════════════
    // 🎯 INTERCEPTADORES DE AÇÃO
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Intercepta tentativa de análise
     * 
     * PRIORIDADE DE MODOS:
     * 1. Demo (se isActive) → regras do demo
     * 2. Logged (userPlans) → regras do plano
     * 3. Anonymous → regras anonymous
     * 
     * @returns {boolean} true se permitido, false se bloqueado
     */
    DEMO.interceptAnalysis = function() {
        if (!DEMO.isActive) return true;
        
        // Verificar limite local (síncrono para compatibilidade)
        const localCheck = DEMO.canAnalyze();
        
        if (!localCheck.allowed) {
            console.log('🚫 [DEMO-GUARDS] Análise bloqueada:', localCheck.reason);
            DEMO.showConversionModal('analysis_limit');
            return false;
        }
        
        // Backend check assíncrono (fire and forget para sync)
        // A validação autoritativa acontece no registerAnalysis
        DEMO.validateBackend('check').then(result => {
            if (result.backendAuthoritative && 
                result.permissions?.canAnalyze === false) {
                console.log('🚫 [DEMO-GUARDS] Backend bloqueou - forçando modal');
                DEMO.showConversionModal('analysis_limit');
            }
        }).catch(() => {});
        
        return true;
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
            console.log('🚫 [DEMO-GUARDS] Mensagem bloqueada:', localCheck.reason);
            DEMO.showConversionModal('chat_limit');
            return false;
        }
        
        // Backend check assíncrono (fire and forget para sync)
        DEMO.validateBackend('check').then(result => {
            if (result.backendAuthoritative && 
                result.permissions?.canMessage === false) {
                console.log('🚫 [DEMO-GUARDS] Backend bloqueou - forçando modal');
                DEMO.showConversionModal('chat_limit');
            }
        }).catch(() => {});
        
        return true;
    };

    /**
     * Força bloqueio imediato (chamado pelo backend se necessário)
     */
    DEMO.forceBlock = function(reason = 'forced_block') {
        console.log('🚫 [DEMO-GUARDS] Bloqueio forçado:', reason);
        DEMO.showConversionModal(reason);
    };

    console.log('🔥 [DEMO-GUARDS] Módulo Guards carregado');

})();
