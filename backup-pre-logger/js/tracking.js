/**
 * 📊 SOUNDYAI - CONVERSION TRACKING SYSTEM
 * 
 * Sistema completo de rastreamento de conversões para Google Ads (+ opcional GA4)
 * 
 * ✅ GARANTIAS:
 * - Idempotência: eventos não duplicam (mesmo em refresh/cliques múltiplos)
 * - Resiliência: não quebra se gtag ausente
 * - Segurança: logs apenas em modo dev
 * - Feature flag: pode ser desligado facilmente
 * 
 * @version 1.0.0
 * @created 2026-01-20
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // 🎛️ CONFIGURAÇÃO E FEATURE FLAGS
    // ═══════════════════════════════════════════════════════════════════
    
    const CONFIG = {
        // Feature flag principal (pode ser desligado externamente)
        enabled: true,
        
        // Modo debug (logs detalhados no console)
        debug: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        
        // IDs do Google Ads (IMPORTANTE: preencher com valores reais)
        googleAds: {
            conversionId: 'AW-XXXXXXX',  // ⚠️ SUBSTITUIR pelo ID real do Google Ads
            labels: {
                waitlist: 'LABEL_WAITLIST',    // ⚠️ SUBSTITUIR pelo label da conversão "Lista de Espera"
                ctaDemo: 'LABEL_CTA_DEMO',      // ⚠️ SUBSTITUIR (ou deixar vazio se não for conversão)
                ctaSales: 'LABEL_CTA_SALES',    // ⚠️ SUBSTITUIR (ou deixar vazio se não for conversão)
                purchase: 'LABEL_PURCHASE'      // ⚠️ SUBSTITUIR pelo label da conversão "Compra"
            }
        },
        
        // Storage para deduplicação (sessionStorage por padrão)
        storageKey: 'soundy_tracking_events',
        
        // TTL dos eventos no storage (24h em ms)
        eventTTL: 24 * 60 * 60 * 1000,
        
        // Delay máximo para não atrasar navegação (ms)
        maxNavigationDelay: 50
    };

    // ═══════════════════════════════════════════════════════════════════
    // 🛠️ UTILITÁRIOS INTERNOS
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Log condicional (apenas em modo debug)
     */
    function log(...args) {
        if (CONFIG.debug) {
            console.log('[TRACKING]', ...args);
        }
    }
    
    /**
     * Log de erro (sempre exibido)
     */
    function logError(...args) {
        console.error('[TRACKING-ERROR]', ...args);
    }
    
    /**
     * Verificar se gtag está disponível
     */
    function isGtagAvailable() {
        return typeof window.gtag === 'function' && typeof window.dataLayer !== 'undefined';
    }
    
    /**
     * Gerar ID único para evento (hash do nome + timestamp)
     */
    function generateEventId(eventName, extraData = '') {
        const timestamp = Date.now();
        const seed = `${eventName}_${extraData}_${timestamp}`;
        
        // Hash simples (não precisa ser criptográfico)
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return `evt_${Math.abs(hash)}_${timestamp}`;
    }
    
    /**
     * Obter eventos já disparados do storage
     */
    function getTrackedEvents() {
        try {
            const stored = sessionStorage.getItem(CONFIG.storageKey);
            if (!stored) return {};
            
            const events = JSON.parse(stored);
            const now = Date.now();
            
            // Filtrar eventos expirados
            const validEvents = {};
            for (const [key, data] of Object.entries(events)) {
                if (now - data.timestamp < CONFIG.eventTTL) {
                    validEvents[key] = data;
                }
            }
            
            return validEvents;
        } catch (error) {
            logError('Erro ao ler eventos do storage:', error);
            return {};
        }
    }
    
    /**
     * Marcar evento como disparado (salvar no storage)
     */
    function markEventTracked(eventKey, eventId, metadata = {}) {
        try {
            const events = getTrackedEvents();
            events[eventKey] = {
                eventId: eventId,
                timestamp: Date.now(),
                metadata: metadata
            };
            sessionStorage.setItem(CONFIG.storageKey, JSON.stringify(events));
            log(`✅ Evento marcado como disparado: ${eventKey}`);
        } catch (error) {
            logError('Erro ao salvar evento no storage:', error);
        }
    }
    
    /**
     * Verificar se evento já foi disparado
     */
    function isEventTracked(eventKey) {
        const events = getTrackedEvents();
        return events.hasOwnProperty(eventKey);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🎯 API PÚBLICA DE TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    const Tracking = {
        
        /**
         * Ativar/desativar sistema de tracking
         */
        setEnabled(enabled) {
            CONFIG.enabled = !!enabled;
            log(`Sistema de tracking ${CONFIG.enabled ? 'ATIVADO' : 'DESATIVADO'}`);
        },
        
        /**
         * Verificar se sistema está ativo
         */
        isEnabled() {
            return CONFIG.enabled;
        },
        
        /**
         * Ativar/desativar modo debug
         */
        setDebug(debug) {
            CONFIG.debug = !!debug;
            log(`Modo debug ${CONFIG.debug ? 'ATIVADO' : 'DESATIVADO'}`);
        },
        
        /**
         * Configurar IDs do Google Ads
         */
        configure(config) {
            if (config.conversionId) {
                CONFIG.googleAds.conversionId = config.conversionId;
            }
            if (config.labels) {
                Object.assign(CONFIG.googleAds.labels, config.labels);
            }
            log('Configuração atualizada:', CONFIG.googleAds);
        },
        
        /**
         * Obter configuração atual (para debug/validação)
         */
        getConfig() {
            return {
                enabled: CONFIG.enabled,
                debug: CONFIG.debug,
                conversionId: CONFIG.googleAds.conversionId,
                labels: { ...CONFIG.googleAds.labels }
            };
        },
        
        /**
         * Enviar evento genérico para Google Ads/GA4
         */
        trackEvent(eventName, params = {}) {
            if (!CONFIG.enabled) {
                log('Sistema desabilitado, evento ignorado:', eventName);
                return false;
            }
            
            if (!isGtagAvailable()) {
                logError('gtag não disponível, evento não enviado:', eventName);
                return false;
            }
            
            try {
                // Gerar event_id para deduplicação
                const eventId = generateEventId(eventName, params.value || '');
                
                // Adicionar event_id aos parâmetros
                const finalParams = {
                    ...params,
                    event_id: eventId,
                    page_path: window.location.pathname,
                    page_title: document.title
                };
                
                log(`📤 Enviando evento: ${eventName}`, finalParams);
                
                // Enviar via gtag
                window.gtag('event', eventName, finalParams);
                
                return true;
            } catch (error) {
                logError('Erro ao enviar evento:', eventName, error);
                return false;
            }
        },
        
        /**
         * Enviar conversão para Google Ads
         * 
         * @param {string} label - Label da conversão (configurado no Google Ads)
         * @param {object} params - Parâmetros adicionais (value, currency, transaction_id, etc)
         * @param {string} dedupeKey - Chave para deduplicação (ex: email hash, user ID)
         */
        trackConversion(label, params = {}, dedupeKey = null) {
            if (!CONFIG.enabled) {
                log('Sistema desabilitado, conversão ignorada:', label);
                return false;
            }
            
            if (!isGtagAvailable()) {
                logError('gtag não disponível, conversão não enviada:', label);
                return false;
            }
            
            // Gerar chave de deduplicação
            const eventKey = dedupeKey || `conversion_${label}_${params.transaction_id || 'default'}`;
            
            // Verificar se já foi disparada
            if (isEventTracked(eventKey)) {
                log(`⚠️ Conversão já disparada (dedupe): ${eventKey}`);
                return false;
            }
            
            try {
                // Montar send_to
                const sendTo = `${CONFIG.googleAds.conversionId}/${label}`;
                
                // Gerar event_id único
                const eventId = generateEventId('conversion', label);
                
                // Parâmetros finais
                const finalParams = {
                    send_to: sendTo,
                    event_id: eventId,
                    ...params
                };
                
                log(`🎯 Enviando conversão: ${sendTo}`, finalParams);
                
                // Enviar via gtag
                window.gtag('event', 'conversion', finalParams);
                
                // Marcar como disparada
                markEventTracked(eventKey, eventId, { label, params });
                
                return true;
            } catch (error) {
                logError('Erro ao enviar conversão:', label, error);
                return false;
            }
        },
        
        /**
         * 📧 Rastrear cadastro na Lista de Espera (LEAD)
         * IMPORTANTE: Só chamar se Firestore confirmar sucesso!
         * 
         * @param {string} email - E-mail do lead (usado para deduplicação)
         * @param {object} metadata - Metadados adicionais (nome, enrichment score, etc)
         */
        trackWaitlistSignup(email, metadata = {}) {
            if (!CONFIG.enabled) {
                log('Sistema desabilitado, signup ignorado');
                return false;
            }
            
            // Hash simples do email para deduplicação (não precisa ser SHA)
            const emailHash = email.split('').reduce((hash, char) => {
                return ((hash << 5) - hash) + char.charCodeAt(0);
            }, 0);
            
            const dedupeKey = `waitlist_${Math.abs(emailHash)}`;
            
            // Verificar se já disparou
            if (isEventTracked(dedupeKey)) {
                log(`⚠️ Lead já rastreado: ${email}`);
                return false;
            }
            
            // Enviar conversão
            const success = this.trackConversion(
                CONFIG.googleAds.labels.waitlist,
                {
                    value: metadata.value || 0,
                    currency: 'BRL'
                },
                dedupeKey
            );
            
            if (success) {
                log(`✅ Lista de espera rastreada: ${email}`);
            }
            
            return success;
        },
        
        /**
         * 🎬 Rastrear clique no CTA Demo → Página de Vendas
         * 
         * @param {string} sourceUrl - URL de origem (demo page)
         */
        trackCTADemoToSales(sourceUrl = null) {
            if (!CONFIG.enabled) {
                log('Sistema desabilitado, CTA demo ignorado');
                return false;
            }
            
            const dedupeKey = 'cta_demo_to_sales';
            
            // Verificar se já disparou nesta sessão
            if (isEventTracked(dedupeKey)) {
                log('⚠️ CTA Demo já rastreado nesta sessão');
                return false;
            }
            
            // Se tem label configurado, enviar como conversão
            if (CONFIG.googleAds.labels.ctaDemo) {
                const success = this.trackConversion(
                    CONFIG.googleAds.labels.ctaDemo,
                    {
                        event_category: 'engagement',
                        event_label: 'cta_demo_to_sales',
                        value: 0
                    },
                    dedupeKey
                );
                
                if (success) {
                    log('✅ CTA Demo rastreado como conversão');
                }
                
                return success;
            } else {
                // Senão, enviar como evento regular
                const success = this.trackEvent('cta_demo_to_sales', {
                    event_category: 'engagement',
                    event_label: 'demo_to_sales',
                    source_url: sourceUrl || window.location.href
                });
                
                if (success) {
                    markEventTracked(dedupeKey, generateEventId('cta_demo_to_sales'));
                    log('✅ CTA Demo rastreado como evento');
                }
                
                return success;
            }
        },
        
        /**
         * 🛒 Rastrear clique no CTA Vendas → Checkout Hotmart
         * 
         * @param {string} checkoutUrl - URL de destino (Hotmart)
         */
        trackCTASalesToCheckout(checkoutUrl = null) {
            if (!CONFIG.enabled) {
                log('Sistema desabilitado, CTA sales ignorado');
                return false;
            }
            
            const dedupeKey = 'cta_sales_to_checkout';
            
            // Verificar se já disparou nesta sessão
            if (isEventTracked(dedupeKey)) {
                log('⚠️ CTA Sales já rastreado nesta sessão');
                return false;
            }
            
            // Se tem label configurado, enviar como conversão
            if (CONFIG.googleAds.labels.ctaSales) {
                const success = this.trackConversion(
                    CONFIG.googleAds.labels.ctaSales,
                    {
                        event_category: 'engagement',
                        event_label: 'cta_sales_to_checkout',
                        value: 0,
                        checkout_url: checkoutUrl
                    },
                    dedupeKey
                );
                
                if (success) {
                    log('✅ CTA Sales rastreado como conversão');
                }
                
                return success;
            } else {
                // Senão, enviar como evento regular
                const success = this.trackEvent('cta_sales_to_checkout', {
                    event_category: 'engagement',
                    event_label: 'sales_to_checkout',
                    checkout_url: checkoutUrl || 'unknown'
                });
                
                if (success) {
                    markEventTracked(dedupeKey, generateEventId('cta_sales_to_checkout'));
                    log('✅ CTA Sales rastreado como evento');
                }
                
                return success;
            }
        },
        
        /**
         * 💳 Rastrear compra concluída (Hotmart)
         * IMPORTANTE: Chamar apenas server-side (webhook) ou após confirmação
         * 
         * @param {string} transactionId - ID único da transação Hotmart
         * @param {number} value - Valor da compra
         * @param {string} currency - Moeda (default: BRL)
         */
        trackPurchase(transactionId, value, currency = 'BRL') {
            if (!CONFIG.enabled) {
                log('Sistema desabilitado, purchase ignorado');
                return false;
            }
            
            const dedupeKey = `purchase_${transactionId}`;
            
            // Verificar se já disparou
            if (isEventTracked(dedupeKey)) {
                log(`⚠️ Purchase já rastreado: ${transactionId}`);
                return false;
            }
            
            const success = this.trackConversion(
                CONFIG.googleAds.labels.purchase,
                {
                    transaction_id: transactionId,
                    value: value,
                    currency: currency
                },
                dedupeKey
            );
            
            if (success) {
                log(`✅ Purchase rastreado: ${transactionId} (${currency} ${value})`);
            }
            
            return success;
        },
        
        /**
         * 🧹 Limpar histórico de eventos rastreados
         * Útil para testes ou reset manual
         */
        clearTrackedEvents() {
            try {
                sessionStorage.removeItem(CONFIG.storageKey);
                log('🧹 Histórico de eventos limpo');
                return true;
            } catch (error) {
                logError('Erro ao limpar eventos:', error);
                return false;
            }
        },
        
        /**
         * 📊 Obter estatísticas de uso
         */
        getStats() {
            const events = getTrackedEvents();
            return {
                enabled: CONFIG.enabled,
                debug: CONFIG.debug,
                gtagAvailable: isGtagAvailable(),
                trackedEventsCount: Object.keys(events).length,
                trackedEvents: events,
                config: CONFIG.googleAds
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // 🌍 EXPORTAR GLOBALMENTE
    // ═══════════════════════════════════════════════════════════════════
    
    window.SoundyTracking = Tracking;
    
    // Alias mais curto (opcional)
    window.tracking = Tracking;
    
    // Log de inicialização
    log('🚀 Sistema de tracking inicializado');
    log(`📊 Google Ads ID: ${CONFIG.googleAds.conversionId}`);
    log(`🔧 Debug mode: ${CONFIG.debug ? 'ON' : 'OFF'}`);
    log(`✅ gtag disponível: ${isGtagAvailable() ? 'SIM' : 'NÃO'}`);
    
    // Aviso se IDs não configurados
    if (CONFIG.googleAds.conversionId === 'AW-XXXXXXX') {
        console.warn('⚠️ [TRACKING] Google Ads Conversion ID não configurado! Use SoundyTracking.configure({ conversionId: "AW-XXXXX", labels: {...} })');
    }

})();
