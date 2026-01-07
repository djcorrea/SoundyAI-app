// 🎯 ERROR MAPPER - Sistema Centralizado de Mensagens de Erro Amigáveis
// Converte códigos de erro técnicos em mensagens UX bonitas
// NÃO expõe códigos internos, JSON ou detalhes técnicos ao usuário

(function() {
    'use strict';

    console.log('🎯 [ERROR-MAPPER] Inicializando sistema de mensagens amigáveis...');

    // ═══════════════════════════════════════════════════════════════════
    // 📋 CONFIGURAÇÃO DE LIMITES POR PLANO (espelha backend)
    // ═══════════════════════════════════════════════════════════════════
    
    const PLAN_LIMITS = {
        free: {
            displayName: 'Gratuito',
            messagesPerMonth: 20,
            analysesPerMonth: 1,
            hasReducedMode: true
        },
        plus: {
            displayName: 'Plus',
            messagesPerMonth: 80,
            analysesPerMonth: 20,
            hasReducedMode: true
        },
        pro: {
            displayName: 'Pro',
            messagesPerMonth: 300, // hard cap
            analysesPerMonth: 60,
            hasReducedMode: true
        },
        studio: {
            displayName: 'Studio',
            messagesPerMonth: 400, // hard cap
            analysesPerMonth: 400,
            hasReducedMode: false
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // 🎨 MENSAGENS POR CENÁRIO
    // ═══════════════════════════════════════════════════════════════════
    
    const ERROR_TEMPLATES = {
        
        // 🔥 SISTEMA EM ALTA DEMANDA (SYSTEM_PEAK_USAGE)
        SYSTEM_PEAK_USAGE: {
            icon: '⏳',
            title: 'Plataforma em alta demanda',
            getMessage: (meta) => {
                return 'Estamos com muitos usuários no momento. Por favor, aguarde alguns minutos e tente novamente.';
            },
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            secondaryCta: null,
            severity: 'warning'
        },

        // 📊 LIMITE DE ANÁLISES ATINGIDO
        ANALYSIS_LIMIT_REACHED: {
            icon: '📊',
            title: 'Limite de análises atingido',
            getMessage: (meta) => {
                const plan = PLAN_LIMITS[meta.plan] || PLAN_LIMITS.free;
                const used = meta.used || plan.analysesPerMonth;
                const cap = meta.cap || plan.analysesPerMonth;
                const resetDate = formatResetDate(meta.resetDate);
                
                if (meta.plan === 'free') {
                    return `Você já utilizou sua análise gratuita do mês. Faça upgrade para o Plus e tenha ${PLAN_LIMITS.plus.analysesPerMonth} análises mensais!`;
                } else if (meta.plan === 'plus') {
                    return `Você utilizou todas as ${cap} análises do plano Plus este mês. Seu limite será renovado em ${resetDate}.`;
                } else if (meta.plan === 'pro') {
                    return `Você atingiu o limite de ${cap} análises do mês. Renova em ${resetDate}. Quer mais? Conheça o Studio!`;
                } else if (meta.plan === 'studio') {
                    return `Você atingiu o limite mensal de análises. Seu acesso será renovado em ${resetDate}.`;
                }
                return `Limite de análises atingido. Renova em ${resetDate}.`;
            },
            primaryCta: { label: '✨ Ver Planos', action: 'upgrade' },
            secondaryCta: null,
            severity: 'limit'
        },

        // 💬 LIMITE DE MENSAGENS DO CHAT
        CHAT_LIMIT_REACHED: {
            icon: '💬',
            title: 'Limite de mensagens atingido',
            getMessage: (meta) => {
                const plan = PLAN_LIMITS[meta.plan] || PLAN_LIMITS.free;
                const cap = meta.cap || plan.messagesPerMonth;
                const resetDate = formatResetDate(meta.resetDate);
                
                if (meta.plan === 'free') {
                    return `Você utilizou suas ${cap} mensagens gratuitas do mês. Faça upgrade para conversar mais com a IA!`;
                } else if (meta.plan === 'plus') {
                    return `Você utilizou todas as ${cap} mensagens do plano Plus. Renova em ${resetDate}.`;
                } else if (meta.plan === 'pro') {
                    return `Limite de ${cap} mensagens atingido. Renova em ${resetDate}. Precisa de mais? Conheça o Studio!`;
                } else if (meta.plan === 'studio') {
                    return `Você atingiu o limite mensal de mensagens. Seu acesso será renovado em ${resetDate}.`;
                }
                return `Limite de mensagens atingido. Renova em ${resetDate}.`;
            },
            primaryCta: { label: '✨ Ver Planos', action: 'upgrade' },
            secondaryCta: null,
            severity: 'limit'
        },

        // 🔒 FEATURE NÃO DISPONÍVEL NO PLANO
        FEATURE_NOT_AVAILABLE: {
            icon: '🔒',
            title: 'Recurso Premium',
            getMessage: (meta) => {
                const featureNames = {
                    reference: 'Análise por Referência',
                    correctionPlan: 'Plano de Correção',
                    pdf: 'Relatório PDF',
                    askAI: 'Assistente IA',
                    history: 'Histórico de Análises'
                };
                const featureName = featureNames[meta.feature] || 'Este recurso';
                
                if (meta.feature === 'reference') {
                    return `${featureName} está disponível nos planos Pro e Studio. Compare seu áudio com referências profissionais!`;
                } else if (meta.feature === 'correctionPlan') {
                    return `${featureName} é exclusivo do plano Studio. Receba um guia passo a passo para melhorar seu áudio!`;
                }
                return `${featureName} está disponível nos planos Pro e Studio. Faça upgrade para desbloquear!`;
            },
            primaryCta: { label: '✨ Fazer Upgrade', action: 'upgrade' },
            secondaryCta: { label: 'Continuar sem', action: 'dismiss' },
            severity: 'upsell'
        },

        // 🔑 AUTENTICAÇÃO NECESSÁRIA
        AUTH_REQUIRED: {
            icon: '🔑',
            title: 'Login necessário',
            getMessage: (meta) => {
                return 'Para usar este recurso, você precisa estar logado. Crie uma conta gratuita ou faça login.';
            },
            primaryCta: { label: '🔓 Fazer Login', action: 'login' },
            secondaryCta: { label: 'Criar Conta Grátis', action: 'register' },
            severity: 'auth'
        },

        // ⏱️ TIMEOUT / SERVIÇO LENTO
        TIMEOUT: {
            icon: '⏱️',
            title: 'Processamento demorou',
            getMessage: (meta) => {
                return 'O processamento está demorando mais que o esperado. Por favor, tente novamente.';
            },
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            secondaryCta: null,
            severity: 'warning'
        },

        // 🔧 ERRO DE SERVIÇO
        SERVICE_ERROR: {
            icon: '🔧',
            title: 'Erro temporário',
            getMessage: (meta) => {
                return 'Ocorreu um erro temporário. Nossa equipe foi notificada. Por favor, tente novamente em alguns instantes.';
            },
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            secondaryCta: null,
            severity: 'error'
        },

        // 📁 ERRO DE ARQUIVO
        FILE_ERROR: {
            icon: '📁',
            title: 'Problema com o arquivo',
            getMessage: (meta) => {
                if (meta.reason === 'format') {
                    return 'Formato não suportado. Use arquivos WAV, FLAC ou MP3.';
                } else if (meta.reason === 'size') {
                    return `Arquivo muito grande (${meta.size || 'N/A'}). O limite é 50MB.`;
                }
                return 'Houve um problema ao processar seu arquivo. Verifique se está correto e tente novamente.';
            },
            primaryCta: { label: '📂 Escolher Outro', action: 'selectFile' },
            secondaryCta: null,
            severity: 'warning'
        },

        // 🚫 LIMITE DE IMAGENS
        IMAGE_LIMIT: {
            icon: '📸',
            title: 'Limite de imagens atingido',
            getMessage: (meta) => {
                const resetDate = formatResetDate(meta.resetDate);
                return `Você atingiu o limite mensal de análises com imagens. Renova em ${resetDate}.`;
            },
            primaryCta: { label: '✨ Ver Planos', action: 'upgrade' },
            secondaryCta: null,
            severity: 'limit'
        },

        // ⚡ RATE LIMIT (muitas requisições)
        RATE_LIMIT: {
            icon: '⚡',
            title: 'Calma aí!',
            getMessage: (meta) => {
                return 'Você está enviando muitas requisições. Aguarde alguns segundos e tente novamente.';
            },
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            secondaryCta: null,
            severity: 'warning'
        },

        // 🎯 ERRO GENÉRICO (fallback)
        UNKNOWN: {
            icon: '❌',
            title: 'Algo deu errado',
            getMessage: (meta) => {
                return 'Ocorreu um erro inesperado. Por favor, tente novamente. Se o problema persistir, entre em contato conosco.';
            },
            primaryCta: { label: '🔄 Tentar Novamente', action: 'retry' },
            secondaryCta: null,
            severity: 'error'
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // 🔄 MAPEAMENTO DE CÓDIGOS DO BACKEND → TEMPLATES
    // ═══════════════════════════════════════════════════════════════════
    
    const CODE_TO_TEMPLATE = {
        // Sistema em alta demanda
        'SYSTEM_PEAK_USAGE': 'SYSTEM_PEAK_USAGE',
        
        // Limites de análise
        'LIMIT_REACHED': 'ANALYSIS_LIMIT_REACHED',
        'ANALYSIS_LIMIT_REACHED': 'ANALYSIS_LIMIT_REACHED',
        'HARD_CAP_REACHED': 'ANALYSIS_LIMIT_REACHED',
        'ANON_ANALYSIS_LIMIT_REACHED': 'ANALYSIS_LIMIT_REACHED',
        'DEMO_LIMIT_REACHED': 'ANALYSIS_LIMIT_REACHED',
        
        // Limites de chat
        'CHAT_LIMIT_REACHED': 'CHAT_LIMIT_REACHED',
        'MESSAGE_LIMIT_REACHED': 'CHAT_LIMIT_REACHED',
        
        // Feature não disponível
        'PLAN_REQUIRED': 'FEATURE_NOT_AVAILABLE',
        'FEATURE_NOT_AVAILABLE': 'FEATURE_NOT_AVAILABLE',
        'ENTITLEMENT_ERROR': 'FEATURE_NOT_AVAILABLE',
        
        // Autenticação
        'AUTH_REQUIRED': 'AUTH_REQUIRED',
        'AUTH_TOKEN_MISSING': 'AUTH_REQUIRED',
        'INVALID_TOKEN': 'AUTH_REQUIRED',
        'UNAUTHORIZED': 'AUTH_REQUIRED',
        
        // Timeout
        'GATEWAY_TIMEOUT': 'TIMEOUT',
        'TIMEOUT': 'TIMEOUT',
        
        // Erros de serviço
        'SERVICE_UNAVAILABLE': 'SERVICE_ERROR',
        'SERVER_ERROR': 'SERVICE_ERROR',
        'AI_SERVICE_ERROR': 'SERVICE_ERROR',
        'LIMIT_CHECK_ERROR': 'SERVICE_ERROR',
        'BAD_GATEWAY': 'SERVICE_ERROR',
        
        // Arquivos
        'FILE_UPLOAD_ERROR': 'FILE_ERROR',
        'FILE_FORMAT_ERROR': 'FILE_ERROR',
        'FILE_TOO_LARGE': 'FILE_ERROR',
        
        // Imagens
        'IMAGE_PEAK_USAGE': 'IMAGE_LIMIT',
        'IMAGES_LIMIT_EXCEEDED': 'IMAGE_LIMIT',
        
        // Rate limit
        'RATE_LIMIT_EXCEEDED': 'RATE_LIMIT',
        'TOO_MANY_REQUESTS': 'RATE_LIMIT'
    };

    // ═══════════════════════════════════════════════════════════════════
    // 🛠️ FUNÇÕES UTILITÁRIAS
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Formata data de reset para exibição amigável
     */
    function formatResetDate(dateInput) {
        if (!dateInput) {
            // Calcular primeiro dia do próximo mês
            const now = new Date();
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return nextMonth.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
        }
        
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) {
                return 'próximo mês';
            }
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
        } catch (e) {
            return 'próximo mês';
        }
    }

    /**
     * Detecta plano atual do usuário
     */
    function detectCurrentPlan() {
        // Tentar múltiplas fontes
        const sources = [
            window.currentModalAnalysis?.plan,
            window.__CURRENT_ANALYSIS__?.plan,
            window.userPlan,
            window.PlanCapabilities?.detectUserPlan?.()
        ];
        
        for (const plan of sources) {
            if (plan && ['free', 'plus', 'pro', 'studio'].includes(plan)) {
                return plan;
            }
        }
        
        return 'free';
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🎯 FUNÇÃO PRINCIPAL: mapErrorToUi
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Converte erro técnico em mensagem UX amigável
     * 
     * @param {Object} params
     * @param {string} params.code - Código de erro do backend (ex: SYSTEM_PEAK_USAGE)
     * @param {string} params.plan - Plano do usuário (free/plus/pro/studio)
     * @param {string} params.feature - Feature relacionada (ex: reference, correctionPlan)
     * @param {Object} params.meta - Metadados adicionais (cap, used, resetDate, etc)
     * @returns {Object} { icon, title, message, primaryCta, secondaryCta, severity }
     */
    function mapErrorToUi({ code, plan, feature, meta = {} }) {
        // Log técnico para debug (apenas console)
        console.log('[ERROR-MAPPER] Mapeando erro:', { code, plan, feature, meta });
        
        // Normalizar código
        const normalizedCode = (code || '').toUpperCase().replace(/-/g, '_');
        
        // Encontrar template
        const templateKey = CODE_TO_TEMPLATE[normalizedCode] || 'UNKNOWN';
        const template = ERROR_TEMPLATES[templateKey];
        
        if (!template) {
            console.warn('[ERROR-MAPPER] Template não encontrado para:', normalizedCode);
            return ERROR_TEMPLATES.UNKNOWN;
        }
        
        // Enriquecer meta com plano detectado
        const enrichedMeta = {
            ...meta,
            plan: plan || meta.plan || detectCurrentPlan(),
            feature: feature || meta.feature
        };
        
        // Gerar mensagem
        const message = template.getMessage(enrichedMeta);
        
        return {
            icon: template.icon,
            title: template.title,
            message,
            primaryCta: template.primaryCta,
            secondaryCta: template.secondaryCta,
            severity: template.severity
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🎨 RENDERIZAÇÃO DE MODAL DE ERRO AMIGÁVEL
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Renderiza modal de erro amigável
     * @param {Object} errorUi - Resultado de mapErrorToUi
     * @param {HTMLElement} container - Container onde renderizar
     */
    function renderErrorModal(errorUi, container) {
        if (!container) {
            console.error('[ERROR-MAPPER] Container não fornecido para renderErrorModal');
            return;
        }
        
        // Cores por severidade
        const severityColors = {
            warning: { bg: '#fff8e6', border: '#f0b429', icon: '#f0b429' },
            limit: { bg: '#fff0f3', border: '#ff6b9d', icon: '#ff6b9d' },
            upsell: { bg: '#f0f7ff', border: '#0096ff', icon: '#0096ff' },
            auth: { bg: '#f5f0ff', border: '#7c3aed', icon: '#7c3aed' },
            error: { bg: '#fef2f2', border: '#ef4444', icon: '#ef4444' }
        };
        
        const colors = severityColors[errorUi.severity] || severityColors.error;
        
        // Gerar HTML dos botões
        let ctaHtml = '';
        
        if (errorUi.primaryCta) {
            const action = errorUi.primaryCta.action;
            let onclick = '';
            
            if (action === 'retry') {
                onclick = 'window.ErrorMapper?.executeRetry?.()';
            } else if (action === 'upgrade') {
                onclick = "window.open('planos.html', '_blank')";
            } else if (action === 'login') {
                onclick = "window.location.href = 'index.html?login=1'";
            } else if (action === 'register') {
                onclick = "window.location.href = 'index.html?register=1'";
            } else if (action === 'selectFile') {
                onclick = 'window.ErrorMapper?.triggerFileSelect?.()';
            } else if (action === 'dismiss') {
                onclick = 'window.ErrorMapper?.dismissModal?.()';
            }
            
            ctaHtml += `
                <button onclick="${onclick}" style="
                    background: ${colors.border};
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    margin: 0 6px;
                " onmouseover="this.style.opacity='0.9'" 
                   onmouseout="this.style.opacity='1'">
                    ${errorUi.primaryCta.label}
                </button>
            `;
        }
        
        if (errorUi.secondaryCta) {
            const action = errorUi.secondaryCta.action;
            let onclick = '';
            
            if (action === 'dismiss') {
                onclick = 'window.ErrorMapper?.dismissModal?.()';
            } else if (action === 'register') {
                onclick = "window.location.href = 'index.html?register=1'";
            }
            
            ctaHtml += `
                <button onclick="${onclick}" style="
                    background: transparent;
                    color: ${colors.border};
                    border: 1px solid ${colors.border};
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    margin: 0 6px;
                " onmouseover="this.style.background='rgba(0,0,0,0.05)'" 
                   onmouseout="this.style.background='transparent'">
                    ${errorUi.secondaryCta.label}
                </button>
            `;
        }
        
        // Renderizar
        container.innerHTML = `
            <div style="
                text-align: center; 
                padding: 40px 30px;
                background: linear-gradient(135deg, ${colors.bg} 0%, #ffffff 100%);
                border-radius: 16px;
                border: 1px solid ${colors.border}20;
            ">
                <div style="
                    font-size: 4em; 
                    margin-bottom: 20px;
                    filter: drop-shadow(0 4px 8px ${colors.icon}40);
                ">${errorUi.icon}</div>
                
                <h3 style="
                    margin: 0 0 12px 0; 
                    color: #1a1a2e;
                    font-size: 1.4em;
                    font-weight: 700;
                ">${errorUi.title}</h3>
                
                <p style="
                    margin: 0 0 28px 0; 
                    color: #4a4a6a;
                    line-height: 1.6;
                    font-size: 1em;
                    max-width: 400px;
                    margin-left: auto;
                    margin-right: auto;
                ">${errorUi.message}</p>
                
                <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px;">
                    ${ctaHtml}
                </div>
            </div>
        `;
    }

    /**
     * Gera HTML inline de mensagem de erro para chat
     * @param {Object} errorUi - Resultado de mapErrorToUi
     * @returns {string} HTML formatado
     */
    function renderChatError(errorUi) {
        let ctaHtml = '';
        
        if (errorUi.primaryCta && errorUi.primaryCta.action === 'upgrade') {
            ctaHtml = `<br><br><a href="planos.html" target="_blank" class="btn-plus" style="
                display: inline-block;
                background: linear-gradient(135deg, #0096ff, #00d4aa);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
            ">✨ Ver Planos</a>`;
        }
        
        return `${errorUi.icon} <strong>${errorUi.title}</strong><br><br>${errorUi.message}${ctaHtml}`;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🔄 CALLBACKS PARA AÇÕES
    // ═══════════════════════════════════════════════════════════════════
    
    let _retryCallback = null;
    let _fileSelectCallback = null;
    let _dismissCallback = null;

    function setRetryCallback(callback) {
        _retryCallback = callback;
    }

    function executeRetry() {
        if (typeof _retryCallback === 'function') {
            _retryCallback();
        } else if (typeof window.resetModalState === 'function') {
            window.resetModalState();
        }
    }

    function triggerFileSelect() {
        if (typeof _fileSelectCallback === 'function') {
            _fileSelectCallback();
        }
    }

    function dismissModal() {
        if (typeof _dismissCallback === 'function') {
            _dismissCallback();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🌐 EXPORTAR API GLOBAL
    // ═══════════════════════════════════════════════════════════════════
    
    window.ErrorMapper = {
        // Função principal
        mapErrorToUi,
        
        // Renderização
        renderErrorModal,
        renderChatError,
        
        // Callbacks
        setRetryCallback,
        executeRetry,
        triggerFileSelect,
        dismissModal,
        
        // Utilitários
        formatResetDate,
        detectCurrentPlan,
        
        // Constantes (para debug)
        _PLAN_LIMITS: PLAN_LIMITS,
        _CODE_TO_TEMPLATE: CODE_TO_TEMPLATE,
        _ERROR_TEMPLATES: ERROR_TEMPLATES
    };

    console.log('✅ [ERROR-MAPPER] Sistema inicializado. Use window.ErrorMapper.mapErrorToUi()');

})();
