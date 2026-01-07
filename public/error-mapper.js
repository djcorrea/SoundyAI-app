// 🎯 ERROR MAPPER V2 - Sistema Centralizado de Mensagens de Erro por SCOPE
// Corrige inversão chat vs análise usando campo `scope` do backend
// REGRA DE OURO: Se scope="chat", NUNCA mostrar copy de análise e vice-versa

(function() {
    'use strict';

    console.log('🎯 [ERROR-MAPPER-V2] Inicializando sistema com suporte a SCOPE...');

    // ═══════════════════════════════════════════════════════════════════
    // 📋 CONFIGURAÇÃO DE LIMITES POR PLANO
    // ═══════════════════════════════════════════════════════════════════
    
    const PLAN_CONFIG = {
        free: { displayName: 'Gratuito', chatLimit: 20, analysisLimit: 1 },
        plus: { displayName: 'Plus', chatLimit: 80, analysisLimit: 20 },
        pro: { displayName: 'Pro', chatLimit: 300, analysisLimit: 60 },
        studio: { displayName: 'Studio', chatLimit: 400, analysisLimit: 400 }
    };

    // ═══════════════════════════════════════════════════════════════════
    // 💬 TEMPLATES PARA CHAT (scope="chat")
    // ═══════════════════════════════════════════════════════════════════
    
    const CHAT_TEMPLATES = {
        LIMIT_REACHED: {
            icon: '💬',
            title: 'Limite de mensagens atingido',
            getMessage: (plan, meta) => {
                const config = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
                const cap = meta?.cap || config.chatLimit;
                const resetDate = formatResetDate(meta?.resetDate);
                const msgs = {
                    free: `Você utilizou suas ${cap} mensagens gratuitas do mês. Faça upgrade para o Plus!`,
                    plus: `Você utilizou todas as ${cap} mensagens do Plus. Renova em ${resetDate}.`,
                    pro: `Limite de ${cap} mensagens atingido. Renova em ${resetDate}. Conheça o Studio!`,
                    studio: `Limite mensal de ${cap} mensagens atingido. Renova em ${resetDate}.`
                };
                return msgs[plan] || msgs.free;
            },
            primaryCta: { label: '✨ Ver Planos', action: 'upgrade' },
            severity: 'limit'
        },
        SYSTEM_PEAK_USAGE: {
            icon: '⏳',
            title: 'Sistema em alta demanda',
            getMessage: () => 'Muitos usuários no momento. Aguarde alguns minutos e tente novamente.',
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            severity: 'warning'
        },
        IMAGE_PEAK_USAGE: {
            icon: '📸',
            title: 'Limite de imagens atingido',
            getMessage: (plan, meta) => `Limite mensal de imagens atingido. Renova em ${formatResetDate(meta?.resetDate)}.`,
            primaryCta: { label: '✨ Ver Planos', action: 'upgrade' },
            severity: 'limit'
        },
        RATE_LIMIT: {
            icon: '⚡',
            title: 'Muitas mensagens',
            getMessage: () => 'Você está enviando mensagens muito rapidamente. Aguarde alguns segundos.',
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            severity: 'warning'
        },
        SERVICE_ERROR: {
            icon: '🔧',
            title: 'Erro temporário',
            getMessage: () => 'Erro ao processar sua mensagem. Tente novamente.',
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            severity: 'error'
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // 📊 TEMPLATES PARA ANÁLISE (scope="analysis")
    // ═══════════════════════════════════════════════════════════════════
    
    const ANALYSIS_TEMPLATES = {
        LIMIT_REACHED: {
            icon: '📊',
            title: 'Limite de análises atingido',
            getMessage: (plan, meta) => {
                const config = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
                const cap = meta?.cap || config.analysisLimit;
                const resetDate = formatResetDate(meta?.resetDate);
                const msgs = {
                    free: `Você utilizou sua análise gratuita do mês. Faça upgrade para o Plus!`,
                    plus: `Você utilizou todas as ${cap} análises do Plus. Renova em ${resetDate}.`,
                    pro: `Limite de ${cap} análises atingido. Renova em ${resetDate}. Conheça o Studio!`,
                    studio: `Limite mensal de ${cap} análises atingido. Renova em ${resetDate}.`
                };
                return msgs[plan] || msgs.free;
            },
            primaryCta: { label: '✨ Ver Planos', action: 'upgrade' },
            severity: 'limit'
        },
        SYSTEM_PEAK_USAGE: {
            icon: '⏳',
            title: 'Plataforma em alta demanda',
            getMessage: () => 'Muitos usuários no momento. Aguarde alguns minutos e tente analisar novamente.',
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            severity: 'warning'
        },
        FEATURE_LOCKED: {
            icon: '🔒',
            title: 'Recurso Premium',
            getMessage: (plan, meta) => {
                const msgs = {
                    reference: 'Análise por Referência disponível nos planos Pro e Studio.',
                    analysis_reference: 'Análise por Referência disponível nos planos Pro e Studio.',
                    correctionPlan: 'Plano de Correção é exclusivo do plano Studio.',
                    pdf: 'Relatório PDF disponível nos planos Pro e Studio.'
                };
                return msgs[meta?.feature] || 'Este recurso está disponível nos planos Pro e Studio.';
            },
            primaryCta: { label: '✨ Fazer Upgrade', action: 'upgrade' },
            secondaryCta: { label: 'Continuar sem', action: 'dismiss' },
            severity: 'upsell'
        },
        FILE_ERROR: {
            icon: '📁',
            title: 'Problema com o arquivo',
            getMessage: (plan, meta) => {
                if (meta?.reason === 'format') return 'Formato não suportado. Use WAV, FLAC ou MP3.';
                if (meta?.reason === 'size') return `Arquivo muito grande. Limite: 50MB.`;
                return 'Problema ao processar arquivo. Verifique e tente novamente.';
            },
            primaryCta: { label: '📂 Escolher Outro', action: 'selectFile' },
            severity: 'warning'
        },
        TIMEOUT: {
            icon: '⏱️',
            title: 'Análise demorou',
            getMessage: () => 'A análise está demorando. Por favor, tente novamente.',
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            severity: 'warning'
        },
        SERVICE_ERROR: {
            icon: '🔧',
            title: 'Erro temporário',
            getMessage: () => 'Erro ao processar sua análise. Nossa equipe foi notificada.',
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            severity: 'error'
        }
    };

    // Templates comuns (AUTH)
    const COMMON_TEMPLATES = {
        AUTH_REQUIRED: {
            icon: '🔑',
            title: 'Login necessário',
            getMessage: (scope) => scope === 'chat' 
                ? 'Para continuar conversando, faça login.' 
                : 'Para analisar seu áudio, faça login.',
            primaryCta: { label: '🔓 Fazer Login', action: 'login' },
            secondaryCta: { label: 'Criar Conta', action: 'register' },
            severity: 'auth'
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // 🔄 MAPEAMENTO DE CÓDIGOS
    // ═══════════════════════════════════════════════════════════════════
    
    const CODE_MAPPING = {
        'LIMIT_REACHED': 'LIMIT_REACHED',
        'HARD_CAP_REACHED': 'LIMIT_REACHED',
        'CHAT_LIMIT_REACHED': 'LIMIT_REACHED',
        'ANALYSIS_LIMIT_REACHED': 'LIMIT_REACHED',
        'ANON_ANALYSIS_LIMIT_REACHED': 'LIMIT_REACHED',
        'DEMO_LIMIT_REACHED': 'LIMIT_REACHED',
        'MESSAGE_LIMIT_REACHED': 'LIMIT_REACHED',
        'SYSTEM_PEAK_USAGE': 'SYSTEM_PEAK_USAGE',
        'IMAGE_PEAK_USAGE': 'IMAGE_PEAK_USAGE',
        'PLAN_REQUIRED': 'FEATURE_LOCKED',
        'FEATURE_LOCKED': 'FEATURE_LOCKED',
        'FEATURE_NOT_AVAILABLE': 'FEATURE_LOCKED',
        'AUTH_REQUIRED': 'AUTH_REQUIRED',
        'AUTH_TOKEN_MISSING': 'AUTH_REQUIRED',
        'INVALID_TOKEN': 'AUTH_REQUIRED',
        'RATE_LIMIT_EXCEEDED': 'RATE_LIMIT',
        'TOO_MANY_REQUESTS': 'RATE_LIMIT',
        'GATEWAY_TIMEOUT': 'TIMEOUT',
        'TIMEOUT': 'TIMEOUT',
        'SERVICE_UNAVAILABLE': 'SERVICE_ERROR',
        'SERVER_ERROR': 'SERVICE_ERROR',
        'AI_SERVICE_ERROR': 'SERVICE_ERROR',
        'FILE_UPLOAD_ERROR': 'FILE_ERROR',
        'FILE_FORMAT_ERROR': 'FILE_ERROR',
        'FILE_TOO_LARGE': 'FILE_ERROR'
    };

    // ═══════════════════════════════════════════════════════════════════
    // 🛠️ FUNÇÕES UTILITÁRIAS
    // ═══════════════════════════════════════════════════════════════════
    
    function formatResetDate(dateInput) {
        if (!dateInput) {
            const now = new Date();
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return nextMonth.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
        }
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return 'próximo mês';
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
        } catch (e) {
            return 'próximo mês';
        }
    }

    function detectCurrentPlan() {
        const sources = [
            window.currentModalAnalysis?.plan,
            window.__CURRENT_ANALYSIS__?.plan,
            window.userPlan,
            window.PlanCapabilities?.detectUserPlan?.()
        ];
        for (const plan of sources) {
            if (plan && ['free', 'plus', 'pro', 'studio'].includes(plan)) return plan;
        }
        return 'free';
    }

    /**
     * 🎯 Infere o scope quando o backend não envia
     */
    function inferScope(endpoint, code, feature) {
        if (endpoint) {
            if (endpoint.includes('/api/chat')) return 'chat';
            if (endpoint.includes('/api/audio') || endpoint.includes('/api/analyze')) return 'analysis';
        }
        if (code) {
            const chatCodes = ['IMAGE_PEAK_USAGE', 'CHAT_LIMIT_REACHED', 'MESSAGE_LIMIT_REACHED'];
            const analysisCodes = ['DEMO_LIMIT_REACHED', 'ANON_ANALYSIS_LIMIT_REACHED', 'FILE_ERROR'];
            if (chatCodes.includes(code)) return 'chat';
            if (analysisCodes.includes(code)) return 'analysis';
        }
        if (feature) {
            const analysisFeatures = ['reference', 'analysis_reference', 'analysis_genre', 'correctionPlan', 'pdf'];
            const chatFeatures = ['chat', 'images', 'askAI'];
            if (analysisFeatures.includes(feature)) return 'analysis';
            if (chatFeatures.includes(feature)) return 'chat';
        }
        return 'unknown';
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🎯 FUNÇÃO PRINCIPAL: mapBlockUi
    // ═══════════════════════════════════════════════════════════════════
    
    function mapBlockUi({ scope, code, feature, plan, meta = {}, _endpoint }) {
        console.log('[ERROR-MAPPER-V2] mapBlockUi:', { scope, code, feature, plan, meta });
        
        const normalizedCode = (code || '').toUpperCase().replace(/-/g, '_');
        const templateKey = CODE_MAPPING[normalizedCode] || 'SERVICE_ERROR';
        
        // Determinar scope final
        let finalScope = scope;
        if (!finalScope || finalScope === 'unknown') {
            finalScope = inferScope(_endpoint, normalizedCode, feature);
        }
        
        // Selecionar templates baseado no scope
        let templates = finalScope === 'chat' ? CHAT_TEMPLATES : ANALYSIS_TEMPLATES;
        
        // AUTH é especial - usar template comum
        if (templateKey === 'AUTH_REQUIRED') {
            const authTemplate = COMMON_TEMPLATES.AUTH_REQUIRED;
            return {
                icon: authTemplate.icon,
                title: authTemplate.title,
                message: authTemplate.getMessage(finalScope),
                primaryCta: authTemplate.primaryCta,
                secondaryCta: authTemplate.secondaryCta,
                severity: authTemplate.severity,
                _debug: { scope: finalScope, code: normalizedCode, templateKey }
            };
        }
        
        const template = templates[templateKey] || templates.SERVICE_ERROR || ANALYSIS_TEMPLATES.SERVICE_ERROR;
        const normalizedPlan = plan || meta?.plan || detectCurrentPlan();
        const enrichedMeta = { ...meta, feature: feature || meta?.feature };
        
        return {
            icon: template.icon,
            title: template.title,
            message: template.getMessage(normalizedPlan, enrichedMeta),
            primaryCta: template.primaryCta,
            secondaryCta: template.secondaryCta,
            severity: template.severity,
            _debug: { scope: finalScope, code: normalizedCode, templateKey, plan: normalizedPlan }
        };
    }

    // Compatibilidade com API antiga
    function mapErrorToUi({ code, plan, feature, meta = {} }) {
        return mapBlockUi({
            scope: meta?.scope || inferScope(null, code, feature),
            code, feature, plan, meta
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🎨 RENDERIZAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    
    function renderErrorModal(errorUi, container) {
        if (!container) return;
        
        const colors = {
            warning: { bg: '#fff8e6', border: '#f0b429' },
            limit: { bg: '#fff0f3', border: '#ff6b9d' },
            upsell: { bg: '#f0f7ff', border: '#0096ff' },
            auth: { bg: '#f5f0ff', border: '#7c3aed' },
            error: { bg: '#fef2f2', border: '#ef4444' }
        }[errorUi.severity] || { bg: '#fef2f2', border: '#ef4444' };
        
        let ctaHtml = '';
        if (errorUi.primaryCta) {
            const onclick = {
                retry: 'window.ErrorMapper?.executeRetry?.()',
                upgrade: "window.open('planos.html', '_blank')",
                login: "window.location.href = 'index.html?login=1'",
                register: "window.location.href = 'index.html?register=1'",
                selectFile: 'window.ErrorMapper?.triggerFileSelect?.()',
                dismiss: 'window.ErrorMapper?.dismissModal?.()'
            }[errorUi.primaryCta.action] || '';
            
            ctaHtml += `<button onclick="${onclick}" style="background:${colors.border};color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin:0 6px;">${errorUi.primaryCta.label}</button>`;
        }
        if (errorUi.secondaryCta) {
            const onclick = errorUi.secondaryCta.action === 'dismiss' ? 'window.ErrorMapper?.dismissModal?.()' : '';
            ctaHtml += `<button onclick="${onclick}" style="background:transparent;color:${colors.border};border:1px solid ${colors.border};padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;margin:0 6px;">${errorUi.secondaryCta.label}</button>`;
        }
        
        container.innerHTML = `
            <div style="text-align:center;padding:40px 30px;background:linear-gradient(135deg,${colors.bg} 0%,#fff 100%);border-radius:16px;border:1px solid ${colors.border}20;">
                <div style="font-size:4em;margin-bottom:20px;">${errorUi.icon}</div>
                <h3 style="margin:0 0 12px 0;color:#1a1a2e;font-size:1.4em;font-weight:700;">${errorUi.title}</h3>
                <p style="margin:0 0 28px 0;color:#4a4a6a;line-height:1.6;max-width:400px;margin-left:auto;margin-right:auto;">${errorUi.message}</p>
                <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:12px;">${ctaHtml}</div>
            </div>
        `;
    }

    function renderChatError(errorUi) {
        let cta = errorUi.primaryCta?.action === 'upgrade' 
            ? `<br><br><a href="planos.html" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#0096ff,#00d4aa);color:white;padding:10px 20px;border-radius:20px;text-decoration:none;font-weight:600;font-size:14px;">✨ Ver Planos</a>` 
            : '';
        return `${errorUi.icon} <strong>${errorUi.title}</strong><br><br>${errorUi.message}${cta}`;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🔄 CALLBACKS
    // ═══════════════════════════════════════════════════════════════════
    
    let _retryCallback = null, _fileSelectCallback = null, _dismissCallback = null;

    function setRetryCallback(cb) { _retryCallback = cb; }
    function setFileSelectCallback(cb) { _fileSelectCallback = cb; }
    function setDismissCallback(cb) { _dismissCallback = cb; }
    function executeRetry() { _retryCallback?.() || window.resetModalState?.(); }
    function triggerFileSelect() { _fileSelectCallback?.(); }
    function dismissModal() { _dismissCallback?.(); }

    // ═══════════════════════════════════════════════════════════════════
    // 🌐 EXPORTAR API GLOBAL
    // ═══════════════════════════════════════════════════════════════════
    
    window.ErrorMapper = {
        mapBlockUi,
        mapErrorToUi, // Compatibilidade
        inferScope,
        renderErrorModal,
        renderChatError,
        setRetryCallback,
        setFileSelectCallback,
        setDismissCallback,
        executeRetry,
        triggerFileSelect,
        dismissModal,
        formatResetDate,
        detectCurrentPlan,
        _PLAN_CONFIG: PLAN_CONFIG,
        _CHAT_TEMPLATES: CHAT_TEMPLATES,
        _ANALYSIS_TEMPLATES: ANALYSIS_TEMPLATES,
        _version: '2.0.0'
    };

    console.log('✅ [ERROR-MAPPER-V2] Sistema inicializado. Use mapBlockUi({ scope, code, plan, meta })');

})();
