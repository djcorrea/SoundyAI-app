/**
 * 🔒 SECURE RENDER UTILS - Sistema de Renderização Segura para Modo Reduced
 * 
 * PRINCÍPIO: Valores bloqueados NUNCA entram no DOM
 * - Valores reais permanecem em memória JS (para cálculos)
 * - DOM recebe apenas placeholders quando bloqueado
 * - Impossível copiar/inspecionar valores reais
 * 
 * @version 2.0.0
 * @date 2025-12-12
 */

(function(window) {
    'use strict';
    
    // ============================================
    // CONFIGURAÇÃO DE ALLOWLISTS POR SEÇÃO
    // ============================================
    
    const REDUCED_MODE_ALLOWLISTS = {
        // (A) MÉTRICAS PRINCIPAIS
        // ✅ LIBERADAS: DR
        // 🔒 BLOQUEADAS: LUFS, True Peak
        primary: [
            'dr',
            'dynamicRange',
            'scoreFinal'  // Score sempre liberado
        ],
        
        // (B) FREQUÊNCIAS
        // ✅ LIBERADAS: Low Mid, High Mid, Presença
        // 🔒 BLOQUEADAS: Sub, Bass, Mid, Brilho/Air
        frequency: [
            'band_lowMid',
            'band_low_mid',
            'lowMid',
            'low_mid',
            
            'band_highMid',
            'band_high_mid',
            'highMid',
            'high_mid',
            
            'band_presence',
            'presence',
            'presença'
        ],
        
        // (C) MÉTRICAS AVANÇADAS: Tudo bloqueado
        advanced: [],
        
        // (D) TABELA DE COMPARAÇÃO
        // ✅ LIBERADAS: DR, Estéreo, Low Mid, High Mid, Presença
        // 🔒 BLOQUEADAS: LUFS, True Peak, LRA, Sub, Bass, Mid, Brilho
        table: [
            'dr',
            'dynamicRange',
            'stereo',
            'stereoCorrelation',
            'correlation',
            'band_lowMid',
            'band_low_mid',
            'band_highMid',
            'band_high_mid',
            'band_presence'
        ]
    };
    
    // ============================================
    // DETECÇÃO DE MODO REDUCED
    // ============================================
    
    /**
     * Verifica se análise está em modo Reduced
     * @param {Object} analysis - Objeto de análise
     * @returns {boolean}
     */
    function isReducedMode(analysis) {
        if (!analysis) return false;
        
        // ✅ CORRIGIDO: Verificar APENAS isReduced ou analysisMode
        // ❌ NÃO verificar plan === 'free' (Free pode ter análises FULL)
        return analysis.analysisMode === 'reduced' || 
               analysis.isReduced === true;
    }
    
    /**
     * Verifica se métrica específica é permitida no modo Reduced
     * @param {string} metricKey - Chave da métrica
     * @param {string} section - Seção (primary, frequency, advanced, table)
     * @returns {boolean}
     */
    function isMetricAllowed(metricKey, section = 'primary') {
        if (!metricKey) return false;
        
        const allowlist = REDUCED_MODE_ALLOWLISTS[section];
        if (!allowlist) {
            console.warn('[SECURE-RENDER] Seção desconhecida:', section);
            return false;
        }
        
        const allowed = allowlist.includes(metricKey);
        
        console.log(`[SECURE-RENDER] Métrica: ${metricKey}, Seção: ${section}, Permitida: ${allowed}`);
        
        return allowed;
    }
    
    // ============================================
    // RENDERIZAÇÃO SEGURA DE VALORES
    // ============================================
    
    /**
     * Renderiza valor de forma segura (núcleo do sistema)
     * @param {number} value - Valor real (usado para cálculos em JS)
     * @param {string} unit - Unidade (dB, LUFS, Hz, %, etc)
     * @param {boolean} allowed - Se métrica é permitida
     * @param {Object} options - Opções adicionais
     * @returns {string} HTML seguro para inserir no DOM
     */
    function renderSecureValue(value, unit = '', allowed = true, options = {}) {
        const {
            formatter = null,
            placeholder = '••••',
            showLockIcon = true,
            decimals = 1
        } = options;
        
        // Se bloqueado, retornar placeholder (NUNCA o valor real)
        if (!allowed) {
            const lockIcon = showLockIcon ? ' 🔒' : '';
            return `<span class="blocked-value" title="Métrica bloqueada no modo gratuito">${placeholder}${lockIcon}</span>`;
        }
        
        // Se valor inválido, retornar traço
        if (!Number.isFinite(value)) {
            return '<span class="invalid-value">—</span>';
        }
        
        // Formatar valor
        let formatted;
        if (formatter && typeof formatter === 'function') {
            formatted = formatter(value);
        } else {
            formatted = value.toFixed(decimals);
        }
        
        // Adicionar unidade se fornecida
        const displayValue = unit ? `${formatted} ${unit}` : formatted;
        
        return `<span class="allowed-value">${displayValue}</span>`;
    }
    
    /**
     * Renderiza valor seguro com detecção automática de modo
     * @param {number} value - Valor real
     * @param {string} unit - Unidade
     * @param {string} metricKey - Chave da métrica
     * @param {string} section - Seção
     * @param {Object} analysis - Objeto de análise
     * @param {Object} options - Opções adicionais
     * @returns {string} HTML seguro
     */
    function renderMetricValue(value, unit, metricKey, section, analysis, options = {}) {
        const isReduced = isReducedMode(analysis);
        const allowed = !isReduced || isMetricAllowed(metricKey, section);
        
        console.log(`[SECURE-RENDER] renderMetricValue: ${metricKey}, Reduced: ${isReduced}, Allowed: ${allowed}, Value: ${value}`);
        
        return renderSecureValue(value, unit, allowed, options);
    }
    
    // ============================================
    // HELPERS DE FORMATAÇÃO
    // ============================================
    
    /**
     * Formata valor com decimais seguros
     */
    function safeFixed(value, decimals = 1) {
        return Number.isFinite(value) ? value.toFixed(decimals) : '—';
    }
    
    /**
     * Formata frequência em Hz
     */
    function safeHz(value) {
        return Number.isFinite(value) ? `${Math.round(value)} Hz` : '—';
    }
    
    /**
     * Formata porcentagem
     */
    function safePct(value, decimals = 0) {
        return Number.isFinite(value) ? `${(value * 100).toFixed(decimals)}%` : '—';
    }
    
    // ============================================
    // RENDERIZAÇÃO DE COMPONENTES COMPLEXOS
    // ============================================
    
    /**
     * Renderiza linha de métrica (row) com segurança
     * @param {string} label - Nome da métrica
     * @param {number} value - Valor real
     * @param {string} unit - Unidade
     * @param {string} metricKey - Chave para allowlist
     * @param {string} section - Seção (primary, frequency, advanced, table)
     * @param {Object} analysis - Objeto de análise
     * @param {Object} options - Opções adicionais
     * @returns {string} HTML da row
     */
    function renderSecureRow(label, value, unit, metricKey, section, analysis, options = {}) {
        const {
            keyForSource = null,
            tooltip = null,
            formatter = null,
            decimals = 1
        } = options;
        
        // Renderizar valor seguro
        const safeValue = renderMetricValue(value, unit, metricKey, section, analysis, {
            formatter,
            decimals
        });
        
        // Gerar atributos
        const metricKeyAttr = metricKey ? ` data-metric-key="${metricKey}"` : '';
        const sourceAttr = keyForSource ? ` data-src="${keyForSource}"` : '';
        
        // 🎯 PADRONIZAÇÃO: TODAS as métricas recebem ícone "i" com tooltip
        // Se não houver tooltip específico, usar fallback universal
        const TOOLTIP_FALLBACK = 'Indicador técnico do áudio. Valores fora do alvo podem afetar a qualidade final.';
        const finalTooltip = tooltip || TOOLTIP_FALLBACK;
        
        // ✅ TODAS as métricas agora têm ícone "i" + tooltip (sem exceções)
        const labelHtml = `<div class="metric-label-container">
             <span style="flex: 1;">${label}</span>
             <span class="metric-info-icon" 
                   data-tooltip-body="${finalTooltip.replace(/"/g, '&quot;')}">ℹ️</span>
           </div>`;
        
        return `
            <div class="data-row"${sourceAttr}${metricKeyAttr}>
                <span class="label">${labelHtml}</span>
                <span class="value"${metricKeyAttr}>${safeValue}</span>
            </div>`;
    }
    
    /**
     * Renderiza KPI com segurança
     * @param {number} value - Valor real
     * @param {string} label - Label do KPI
     * @param {string} metricKey - Chave da métrica
     * @param {string} section - Seção
     * @param {Object} analysis - Objeto de análise
     * @param {Object} options - Opções
     * @returns {string} HTML do KPI
     */
    function renderSecureKPI(value, label, metricKey, section, analysis, options = {}) {
        const {
            className = '',
            unit = '',
            decimals = 1
        } = options;
        
        // Renderizar valor seguro
        const safeValue = renderMetricValue(value, unit, metricKey, section, analysis, {
            decimals,
            showLockIcon: false
        });
        
        const metricKeyAttr = metricKey ? ` data-metric-key="${metricKey}"` : '';
        
        return `
            <div class="kpi ${className}"${metricKeyAttr}>
                <div class="kpi-value"${metricKeyAttr}>${safeValue}</div>
                <div class="kpi-label">${label}</div>
            </div>`;
    }
    
    // ============================================
    // RENDERIZAÇÃO DE TABELA DE COMPARAÇÃO
    // ============================================
    
    /**
     * Renderiza célula de tabela de forma segura
     * @param {number} value - Valor real
     * @param {string} unit - Unidade
     * @param {string} metricKey - Chave da métrica
     * @param {Object} analysis - Objeto de análise
     * @param {Object} options - Opções
     * @returns {string} HTML da célula
     */
    function renderSecureTableCell(value, unit, metricKey, analysis, options = {}) {
        const {
            className = '',
            decimals = 1
        } = options;
        
        const safeValue = renderMetricValue(value, unit, metricKey, 'table', analysis, {
            decimals
        });
        
        return `<td class="${className}">${safeValue}</td>`;
    }
    
    // ============================================
    // EXPORTAR PARA WINDOW
    // ============================================
    
    window.SecureRenderUtils = {
        // Core
        isReducedMode,
        isMetricAllowed,
        renderSecureValue,
        renderMetricValue,
        
        // Helpers
        safeFixed,
        safeHz,
        safePct,
        
        // Components
        renderSecureRow,
        renderSecureKPI,
        renderSecureTableCell,
        
        // Config
        getAllowlist: (section) => REDUCED_MODE_ALLOWLISTS[section] || []
    };
    
    console.log('[SECURE-RENDER] ✅ Secure Render Utils carregado');
    console.log('[SECURE-RENDER] Allowlists configuradas:', REDUCED_MODE_ALLOWLISTS);
    
})(window);
