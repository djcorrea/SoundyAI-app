/**
 * 🎯 GOOGLE ANALYTICS 4 + GOOGLE ADS TRACKING
 * 
 * Módulo centralizado para rastreamento de eventos no SoundyAI.
 * Compatível com GA4 e Google Ads conversion tracking.
 * 
 * ⚠️ IMPORTANTE: Este módulo requer que o gtag.js já esteja carregado no <head>
 * 
 * @version 1.0.0
 * @date 2026-01-26
 */

(function() {
    'use strict';

    // ========================================
    // CONFIGURAÇÃO
    // ========================================

    // IDs de rastreamento (serão preenchidos automaticamente via gtag config)
    const GA4_MEASUREMENT_ID = 'AW-17884386312'; // ID já existente no projeto
    
    // Flag de debug (ativa via URL ?debug_tracking=1)
    const DEBUG_MODE = window.TRACKING_DEBUG || false;

    // ========================================
    // HELPER FUNCTIONS
    // ========================================

    /**
     * Logger interno para debug
     */
    function log(...args) {
        if (DEBUG_MODE) {
            console.log('%c[GA4-TRACKING]', 'color:#4285F4;font-weight:bold', ...args);
        }
    }

    /**
     * Logger de erros
     */
    function error(...args) {
        console.error('%c[GA4-TRACKING-ERROR]', 'color:#EA4335;font-weight:bold', ...args);
    }

    /**
     * Verifica se gtag está disponível
     */
    function isGtagAvailable() {
        return typeof window.gtag === 'function' && typeof window.dataLayer !== 'undefined';
    }

    /**
     * Aguarda até que gtag esteja disponível
     */
    async function waitForGtag(maxWait = 5000) {
        const startTime = Date.now();
        
        while (!isGtagAvailable()) {
            if (Date.now() - startTime > maxWait) {
                error('gtag não carregou dentro do tempo limite');
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        log('✅ gtag disponível');
        return true;
    }

    // ========================================
    // FUNÇÃO PRINCIPAL DE TRACKING
    // ========================================

    /**
     * 🎯 Envia evento para Google Analytics 4
     * 
     * @param {string} eventName - Nome do evento (ex: 'audio_analysis_started')
     * @param {Object} params - Parâmetros adicionais do evento
     * @returns {boolean} Sucesso do envio
     * 
     * @example
     * trackEvent('audio_analysis_started', {
     *   audio_format: 'wav',
     *   file_size_mb: 5.2
     * });
     */
    function trackEvent(eventName, params = {}) {
        try {
            // Validação de entrada
            if (!eventName || typeof eventName !== 'string') {
                error('Nome do evento inválido:', eventName);
                return false;
            }

            // Verificar se gtag está disponível
            if (!isGtagAvailable()) {
                error('gtag não está disponível. Certifique-se de que o script está carregado no <head>');
                return false;
            }

            // Adicionar timestamp automático
            const eventParams = {
                ...params,
                timestamp: new Date().toISOString(),
                page_path: window.location.pathname,
                page_title: document.title
            };

            // Enviar evento
            window.gtag('event', eventName, eventParams);

            log('📊 Evento enviado:', eventName, eventParams);
            return true;

        } catch (err) {
            error('Erro ao enviar evento:', err);
            return false;
        }
    }

    /**
     * 🎯 Envia conversão do Google Ads
     * 
     * @param {string} conversionLabel - Label da conversão no Google Ads
     * @param {Object} params - Parâmetros da conversão (value, currency, etc)
     * 
     * @example
     * trackConversion('abc123', {
     *   value: 47.00,
     *   currency: 'BRL',
     *   transaction_id: 'sub_123456'
     * });
     */
    function trackConversion(conversionLabel, params = {}) {
        try {
            if (!isGtagAvailable()) {
                error('gtag não disponível para conversão');
                return false;
            }

            // Formato esperado pelo Google Ads: AW-XXXXXX/LABEL
            const conversionId = `${GA4_MEASUREMENT_ID}/${conversionLabel}`;

            window.gtag('event', 'conversion', {
                'send_to': conversionId,
                ...params
            });

            log('💰 Conversão enviada:', conversionId, params);
            return true;

        } catch (err) {
            error('Erro ao enviar conversão:', err);
            return false;
        }
    }

    // ========================================
    // EVENTOS PRÉ-DEFINIDOS
    // ========================================

    /**
     * Rastreamento de page view (chamado automaticamente)
     */
    function trackPageView() {
        trackEvent('page_view', {
            page_location: window.location.href,
            page_referrer: document.referrer
        });
    }

    /**
     * 🎵 Rastreamento: Upload de áudio iniciado
     */
    function trackAudioUploadStarted(audioDetails = {}) {
        trackEvent('audio_upload_started', {
            audio_format: audioDetails.format || 'unknown',
            audio_size_mb: audioDetails.sizeMB || 0,
            analysis_mode: audioDetails.mode || 'genre'
        });
    }

    /**
     * 🎵 Rastreamento: Análise de áudio iniciada
     */
    function trackAudioAnalysisStarted(analysisDetails = {}) {
        trackEvent('audio_analysis_started', {
            analysis_mode: analysisDetails.mode || 'genre',
            genre: analysisDetails.genre || null,
            has_reference: analysisDetails.hasReference || false
        });
    }

    /**
     * 🎵 Rastreamento: Análise de áudio completada
     */
    function trackAudioAnalysisCompleted(results = {}) {
        trackEvent('audio_analysis_completed', {
            analysis_mode: results.mode || 'genre',
            score: results.score || null,
            duration_seconds: results.durationSeconds || null,
            genre: results.genre || null
        });
    }

    /**
     * 👤 Rastreamento: Cadastro completado
     */
    function trackSignupCompleted(userDetails = {}) {
        trackEvent('signup_completed', {
            method: userDetails.method || 'email',
            plan: userDetails.plan || 'free'
        });
    }

    /**
     * 💰 Rastreamento: Paywall visualizado
     */
    function trackPaywallView(context = {}) {
        trackEvent('paywall_view', {
            trigger: context.trigger || 'unknown',
            current_plan: context.currentPlan || 'free',
            feature_blocked: context.featureBlocked || null
        });
    }

    /**
     * 💰 Rastreamento: Assinatura iniciada
     */
    function trackSubscriptionStarted(subscriptionDetails = {}) {
        trackEvent('subscription_started', {
            plan: subscriptionDetails.plan || 'unknown',
            price: subscriptionDetails.price || null,
            currency: subscriptionDetails.currency || 'BRL'
        });

        // Também enviar como conversão do Google Ads (se houver label configurado)
        if (subscriptionDetails.conversionLabel) {
            trackConversion(subscriptionDetails.conversionLabel, {
                value: subscriptionDetails.price || 0,
                currency: subscriptionDetails.currency || 'BRL',
                transaction_id: subscriptionDetails.transactionId || null
            });
        }
    }

    // ========================================
    // INICIALIZAÇÃO
    // ========================================

    /**
     * Inicializa o sistema de tracking
     */
    async function init() {
        log('🚀 Inicializando sistema de tracking...');

        // Aguardar gtag estar disponível
        const gtagReady = await waitForGtag();
        
        if (!gtagReady) {
            error('❌ gtag não pôde ser inicializado');
            return false;
        }

        // Rastrear page view automaticamente
        trackPageView();

        log('✅ Sistema de tracking inicializado');
        return true;
    }

    // ========================================
    // EXPOR API GLOBAL
    // ========================================

    window.GATracking = {
        // Função principal
        trackEvent,
        trackConversion,
        
        // Eventos específicos
        trackPageView,
        trackAudioUploadStarted,
        trackAudioAnalysisStarted,
        trackAudioAnalysisCompleted,
        trackSignupCompleted,
        trackPaywallView,
        trackSubscriptionStarted,
        
        // Utilitários
        isGtagAvailable,
        
        // Estado
        DEBUG_MODE
    };

    // Auto-inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    log('📦 Módulo de tracking carregado');

})();
