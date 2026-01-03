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
        
        // 🔴 VERIFICAR BLOQUEIO TOTAL PRIMEIRO
        if (data.blocked) {
            console.log('🚫 [DEMO-GUARDS] Usuário já bloqueado:', data.blockReason);
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
            console.log('🚫 [DEMO-GUARDS] Usuário já bloqueado:', data.blockReason);
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
        
        // 🔥 MOSTRAR CTA APÓS ANÁLISE COMPLETAR
        if (data.analyses_used >= CONFIG.limits.maxAnalyses) {
            console.log('🚫 [DEMO-GUARDS] Limite de análises atingido - mostrando CTA');
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
        
        console.log('🚫 [DEMO-GUARDS] Bloqueio forçado PERMANENTE:', reason);
        
        const data = DEMO.data;
        if (data) {
            // 🔴 MARCAR COMO BLOQUEADO PERMANENTEMENTE
            data.blocked = true;
            data.blockReason = reason;
            data.blocked_at = new Date().toISOString();
            
            // Salvar estado
            await DEMO._saveDemoData(data);
            console.log('💾 [DEMO-GUARDS] Estado de bloqueio salvo');
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
            console.log('⚠️ [DEMO-GUARDS] Análise não teve sucesso, ignorando');
            return;
        }
        
        console.log('🎯 [DEMO-GUARDS] audio-analysis-finished recebido');
        
        // Verificar se bloqueio já foi aplicado (pelo displayModalResults)
        if (DEMO.data?.blocked) {
            console.log('✅ [DEMO-GUARDS] Bloqueio já aplicado pelo displayModalResults');
            return;
        }
        
        // FALLBACK: Se bloqueio não foi aplicado, aplicar agora
        console.log('⚠️ [DEMO-GUARDS] FALLBACK: Aplicando bloqueio tardio...');
        await DEMO.registerAnalysis();
        
        if (DEMO.data) {
            DEMO.data.blocked = true;
            DEMO.data.blockReason = 'analysis_completed_fallback';
            DEMO.data.blocked_at = new Date().toISOString();
            await DEMO._saveDemoData(DEMO.data);
            console.log('💾 [DEMO-GUARDS] Bloqueio FALLBACK aplicado');
        }
    });

    console.log('🔥 [DEMO-GUARDS] Módulo Guards carregado');

})();
