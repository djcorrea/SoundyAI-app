/**
 * 🔐 REDUCED MODE SECURITY GUARD
 * Função centralizada para decidir se deve renderizar valores reais
 * 
 * REGRAS DE BLOQUEIO (MODO REDUCED):
 * ✅ LIBERADAS: DR, Estéreo, Low Mid, High Mid, Presença
 * 🔒 BLOQUEADAS: LUFS, True Peak, LRA, Sub, Bass, Mid, Brilho, Avançadas
 * 
 * @param {string} metricKey - Chave da métrica (ex: 'lufsIntegrated', 'band_sub')
 * @param {string} section - Seção (primary, frequency, advanced, table)
 * @param {Object} analysis - Objeto de análise completo
 * @returns {boolean} - TRUE se pode mostrar valor real, FALSE se deve usar placeholder
 */
function shouldRenderRealValue(metricKey, section = 'primary', analysis = null) {
    // Se não estiver em modo reduced, sempre renderizar valores reais
    if (!analysis || analysis.analysisMode !== 'reduced') {
        return true;
    }
    
    // 🔓 ALLOWLIST - Métricas SEMPRE LIBERADAS no modo reduced
    const allowedMetrics = [
        // Métricas principais liberadas
        'dr',
        'dynamicRange',
        'dynamic_range',
        
        // Estéreo (sempre liberado)
        'stereo',
        'stereoCorrelation',
        'correlation',
        'stereoWidth',
        
        // Frequências liberadas
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
    ];
    
    // 🔒 BLOCKLIST - Métricas SEMPRE BLOQUEADAS no modo reduced
    const blockedMetrics = [
        // Loudness e picos
        'lufs',
        'lufsIntegrated',
        'lufs_integrated',
        'loudness',
        
        'truePeak',
        'true_peak',
        'truePeakDbtp',
        'maxDbtp',
        
        'lra',
        'loudnessRange',
        'loudness_range',
        
        // Frequências bloqueadas
        'band_sub',
        'sub',
        'subgrave',
        
        'band_bass',
        'bass',
        'graves',
        
        'band_mid',
        'mid',
        'médios',
        
        'band_air',
        'air',
        'ar',
        'brilho',
        
        // Métricas avançadas
        'rms',
        'peak',
        'peak_db',
        'headroom',
        'crestFactor',
        'spectralCentroid',
        'spectralRolloff'
    ];
    
    // Normalizar chave para lowercase para comparação
    const normalizedKey = metricKey?.toLowerCase() || '';
    
    // Verificar blocklist primeiro (tem prioridade)
    if (blockedMetrics.some(blocked => normalizedKey.includes(blocked.toLowerCase()))) {
        console.log(`[SECURITY] 🔒 Métrica bloqueada: ${metricKey}`);
        return false;
    }
    
    // Verificar allowlist
    if (allowedMetrics.some(allowed => normalizedKey.includes(allowed.toLowerCase()))) {
        console.log(`[SECURITY] ✅ Métrica liberada: ${metricKey}`);
        return true;
    }
    
    // Por padrão, bloquear se não estiver explicitamente na allowlist
    console.log(`[SECURITY] 🔒 Métrica bloqueada (não na allowlist): ${metricKey}`);
    return false;
}

/**
 * 🎨 Renderiza placeholder seguro para métrica bloqueada
 * @param {string} type - Tipo de placeholder (value, target, diff, action)
 * @returns {string} HTML do placeholder
 */
function renderSecurePlaceholder(type = 'value') {
    const placeholders = {
        value: '<span class="blocked-value">🔒</span>',
        target: '<span class="blocked-value">—</span>',
        diff: '<span class="blocked-value">—</span>',
        severity: '<span class="blocked-value severity-blocked">Bloqueado</span>',
        action: '<span class="blocked-value action-blocked">Upgrade para desbloquear</span>'
    };
    
    return placeholders[type] || placeholders.value;
}

console.log('✅ Reduced Mode Security Guard carregado');
