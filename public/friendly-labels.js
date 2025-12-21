/**
 * Sistema de Labels Amigáveis para Usuários
 * Mapeia nomes técnicos para termos intuitivos
 */

// Mapeamento das bandas de frequência
window.FRIENDLY_BAND_LABELS = {
    'sub': 'Sub (20-60Hz)',
    'low_bass': 'Graves (60-120Hz)', 
    'upper_bass': 'Graves Altos (120-200Hz)',
    'low_mid': 'Médios Graves (200-500Hz)',
    'mid': 'Médios (500-2kHz)',
    'high_mid': 'Médios Agudos (2-4kHz)',
    'brilho': 'Agudos (4-8kHz)',
    'presenca': 'Presença (8-12kHz)'
};

// Mapeamento das métricas técnicas
window.FRIENDLY_METRIC_LABELS = {
    'LUFS': 'Volume Integrado (padrão streaming)',
    'lufsIntegrated': 'Volume Integrado (padrão streaming)',
    'LUFS Int.': 'Volume Integrado (padrão streaming)',
    'lufsintegrated': 'Volume Integrado (padrão streaming)',
    'True Peak': 'Pico Real (previne distorção digital)',
    'truePeakDbtp': 'Pico Real (previne distorção digital)',
    'truepeakdbtp': 'Pico Real (previne distorção digital)',
    'truepeak': 'Pico Real (previne distorção digital)',
    'DR': 'Dinâmica (diferença entre alto/baixo)',
    'dynamicRange': 'Dinâmica (diferença entre alto/baixo)',
    'dynamicrange': 'Dinâmica (diferença entre alto/baixo)',
    'LRA': 'Variação de Volume (consistência)',
    'lra': 'Variação de Volume (consistência)',
    'Stereo Corr.': 'Correlação Estéreo (largura)',
    'stereoCorrelation': 'Correlação Estéreo (largura)',
    'stereocorrelation': 'Correlação Estéreo (largura)',
    'Correlação': 'Correlação Estéreo (largura)',
    'correlacao': 'Correlação Estéreo (largura)',
    'Peak': 'Pico RMS (300ms)',
    'peak': 'Pico RMS (300ms)',
    'RMS': 'Volume Médio (energia)',
    'rms': 'Volume Médio (energia)',
    'Crest Factor': 'Fator de Crista (dinâmica)',
    'crestFactor': 'Fator de Crista (dinâmica)',
    'crestfactor': 'Fator de Crista (dinâmica)',
    'Largura': 'Largura Estéreo',
    'largura': 'Largura Estéreo',
    'stereoWidth': 'Largura Estéreo',
    'stereowidth': 'Largura Estéreo',
    'Balance': 'Balanço Esquerdo/Direito',
    'balance': 'Balanço Esquerdo/Direito',
    'balanceLR': 'Balanço Esquerdo/Direito',
    'balancelr': 'Balanço Esquerdo/Direito',
    'Mono Compat.': 'Compatibilidade Mono',
    'monoCompatibility': 'Compatibilidade Mono',
    'monocompatibility': 'Compatibilidade Mono',
    'Centroide': 'Frequência Central (brilho)',
    'centroide': 'Frequência Central (brilho)',
    'spectralCentroid': 'Frequência Central (brilho)',
    'spectralcentroid': 'Frequência Central (brilho)',
    'Rolloff (85%)': 'Limite de Agudos (85%)',
    'rolloff': 'Limite de Agudos (85%)',
    'spectralRolloff85': 'Limite de Agudos (85%)',
    'spectralrolloff85': 'Limite de Agudos (85%)',
    'Flux': 'Mudança Espectral',
    'flux': 'Mudança Espectral',
    'spectralFlux': 'Mudança Espectral',
    'spectralflux': 'Mudança Espectral',
    'Flatness': 'Uniformidade (linear vs peaks)',
    'flatness': 'Uniformidade (linear vs peaks)',
    'spectralFlatness': 'Uniformidade (linear vs peaks)',
    'spectralflatness': 'Uniformidade (linear vs peaks)',
    'Variação de Volume (consistência)': 'Variação de Volume (consistência)',
    'variacao': 'Variação de Volume (consistência)'
};

// Explicações curtas para tooltips
window.METRIC_EXPLANATIONS = {
    'lufsIntegrated': 'Medida padrão de volume para streaming (Spotify, YouTube). Ideal: -14 LUFS',
    'truePeakDbtp': 'Pico real após conversão digital. Deve ficar abaixo de -1 dBTP para evitar distorção',
    'dynamicRange': 'Diferença entre partes altas e baixas. Maior = mais dinâmico, menor = mais comprimido',
    'lra': 'O quanto o volume varia ao longo da música. Valores baixos = volume mais consistente',
    'stereoCorrelation': 'Relação entre canais L/R. 1.0 = mono, 0.0 = estéreo amplo, <0 = fora de fase',
    'sub': 'Frequências muito graves, sentidas mais que ouvidas. Importantes para impacto físico',
    'low_bass': 'Graves fundamentais, base rítmica da música. Kick drum e baixo estão aqui',
    'upper_bass': 'Graves altos, harmônicos do baixo. Dão corpo e peso à música',
    'low_mid': 'Médios graves, onde ficam vocais masculinos e instrumentos de corpo',
    'mid': 'Médios centrais, região mais sensível do ouvido humano. Vocais e melodias principais',
    'high_mid': 'Médios agudos, presença de vocais e clareza de instrumentos',
    'brilho': 'Agudos, responsáveis pelo brilho e clareza. Pratos, hi-hats e harmonicos',
    'presenca': 'Presença, frequências muito agudas que dão ar e espacialidade'
};

// Função para obter label amigável
window.getFriendlyLabel = function(key, useShort = false) {
    if (!key) return key;
    
    // Normalizar a chave para busca (lowercase, sem espaços extras)
    let normalizedKey = String(key).toLowerCase().trim();
    
    // Remover prefixo 'band:' se existir
    const cleanKey = normalizedKey.replace(/^band:/, '');
    
    if (useShort && window.FRIENDLY_BAND_LABELS[cleanKey]) {
        // Versão curta para bandas (sem Hz)
        return window.FRIENDLY_BAND_LABELS[cleanKey].split(' (')[0];
    }
    
    // Buscar primeiro nas bandas (com e sem prefixo)
    if (window.FRIENDLY_BAND_LABELS[cleanKey]) {
        return window.FRIENDLY_BAND_LABELS[cleanKey];
    }
    if (window.FRIENDLY_BAND_LABELS[key]) {
        return window.FRIENDLY_BAND_LABELS[key];
    }
    
    // Buscar nas métricas (original e normalizada)
    if (window.FRIENDLY_METRIC_LABELS[key]) {
        return window.FRIENDLY_METRIC_LABELS[key];
    }
    if (window.FRIENDLY_METRIC_LABELS[cleanKey]) {
        return window.FRIENDLY_METRIC_LABELS[cleanKey];
    }
    if (window.FRIENDLY_METRIC_LABELS[normalizedKey]) {
        return window.FRIENDLY_METRIC_LABELS[normalizedKey];
    }
    
    // Buscar por partes da chave se contém palavras conhecidas
    for (const [metricKey, friendlyName] of Object.entries(window.FRIENDLY_METRIC_LABELS)) {
        if (normalizedKey.includes(metricKey.toLowerCase()) || metricKey.toLowerCase().includes(normalizedKey)) {
            return friendlyName;
        }
    }
    
    return cleanKey; // Retorna sem prefixo se não encontrar
};

// Função para obter explicação
window.getMetricExplanation = function(key) {
    return window.METRIC_EXPLANATIONS[key] || 'Métrica técnica de análise de áudio';
};

// Função para criar tooltip
window.createTooltipLabel = function(key, originalLabel) {
    const friendlyLabel = window.getFriendlyLabel(key);
    const explanation = window.getMetricExplanation(key);
    
    if (friendlyLabel === key && explanation === window.getMetricExplanation('default')) {
        return originalLabel; // Sem mudança se não há mapeamento
    }
    
    return `<span title="${explanation}" class="metric-label-friendly">${friendlyLabel}</span>`;
};

// Função para aplicar labels automaticamente nas rows de dados
window.enhanceRowLabel = function(label, key) {
    if (!label) return label;
    
    // Primeiro, tentar obter o label amigável diretamente
    let friendlyLabel = window.getFriendlyLabel(label);
    
    // Se não mudou, tentar com a key
    if (friendlyLabel === label && key) {
        friendlyLabel = window.getFriendlyLabel(key);
    }
    
    // Se ainda não mudou, tentar buscar partes da label
    if (friendlyLabel === label) {
        const normalizedLabel = label.toLowerCase().trim();
        for (const [metricKey, friendlyName] of Object.entries(window.FRIENDLY_METRIC_LABELS)) {
            if (normalizedLabel.includes(metricKey.toLowerCase()) || metricKey.toLowerCase().includes(normalizedLabel)) {
                friendlyLabel = friendlyName;
                break;
            }
        }
        
        // Buscar também nas bandas
        for (const [bandKey, bandName] of Object.entries(window.FRIENDLY_BAND_LABELS)) {
            if (normalizedLabel.includes(bandKey.toLowerCase()) || bandKey.toLowerCase().includes(normalizedLabel)) {
                friendlyLabel = bandName;
                break;
            }
        }
    }
    
    const explanation = window.getMetricExplanation(key || label);
    
    // Adicionar classes CSS baseadas no tipo de métrica
    let cssClass = 'metric-label-friendly';
    const lowerLabel = (key || label).toLowerCase();
    
    if (lowerLabel.includes('lufs') || lowerLabel.includes('peak') || lowerLabel.includes('rms')) {
        cssClass += ' metric-loudness';
    } else if (lowerLabel.includes('dynamic') || lowerLabel.includes('crest') || lowerLabel.includes('lra') || lowerLabel.includes('dr')) {
        cssClass += ' metric-dynamics';
    } else if (lowerLabel.includes('stereo') || lowerLabel.includes('correlation') || lowerLabel.includes('balance') || lowerLabel.includes('correlacao') || lowerLabel.includes('largura')) {
        cssClass += ' metric-stereo';
    } else if (lowerLabel.includes('spectral') || lowerLabel.includes('centroid') || lowerLabel.includes('rolloff') || lowerLabel.includes('flux') || lowerLabel.includes('flatness')) {
        cssClass += ' metric-spectral';
    }
    
    return `<span title="${explanation}" class="${cssClass}">${friendlyLabel}</span>`;
};

// Função para criar indicação de direção com cores
window.createDirectionIndicator = function(diff, unit = '') {
    if (!Number.isFinite(diff)) return '';
    
    const absDiff = Math.abs(diff);
    const isPositive = diff > 0;
    const arrow = isPositive ? '↗️' : '↘️';
    const action = isPositive ? 'DIMINUIR' : 'AUMENTAR';
    const color = isPositive ? '#ff6b6b' : '#52f7ad'; // vermelho para diminuir, verde para aumentar
    
    return `<span style="color: ${color}; font-weight: 600; margin-left: 8px;">
        ${arrow} ${action} ${absDiff.toFixed(1)}${unit}
    </span>`;
};

// Função para criar célula de diferença melhorada
window.createEnhancedDiffCell = function(diff, unit = '', tolerance = null) {
    if (!Number.isFinite(diff)) {
        return '<td class="na" style="opacity:.55">—</td>';
    }
    
    const absDiff = Math.abs(diff);
    let cssClass = 'na';
    let statusText = '';
    
    if (Number.isFinite(tolerance) && tolerance > 0) {
        if (absDiff <= tolerance) {
            cssClass = 'ok';
            statusText = '✅ IDEAL';
        } else {
            const n = absDiff / tolerance;
            if (n <= 2) {
                cssClass = 'yellow';
                statusText = '⚠️ AJUSTAR';
            } else {
                cssClass = 'warn';
                statusText = '🚨 CORRIGIR';
            }
        }
    }
    
    const diffValue = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}${unit}`;
    const direction = window.createDirectionIndicator(diff, unit);
    
    return `<td class="${cssClass}">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 12px; font-weight: 600;">${diffValue}</div>
            <div style="font-size: 10px; opacity: 0.8;">${statusText}</div>
            ${direction}
        </div>
    </td>`;
};

// Função para converter sugestões para nomes amigáveis
window.convertSuggestionsToFriendly = function(suggestions) {
    if (!Array.isArray(suggestions)) return suggestions;
    
    return suggestions.map(s => {
        if (!s || typeof s !== 'object') return s;
        
        let newMessage = s.message;
        let newAction = s.action;
        
        // Remover prefixos 'band:' de mensagens e ações
        newMessage = newMessage.replace(/band:/g, '');
        newAction = newAction.replace(/band:/g, '');
        
        // Substituir nomes técnicos por amigáveis na mensagem e ação
        Object.entries(window.FRIENDLY_METRIC_LABELS).forEach(([tech, friendly]) => {
            const techName = tech.replace('band:', '');
            const regex = new RegExp(`\\b${techName}\\b`, 'gi');
            newMessage = newMessage.replace(regex, friendly);
            newAction = newAction.replace(regex, friendly);
        });
        
        // Substituir nomes das bandas também
        Object.entries(window.FRIENDLY_BAND_LABELS).forEach(([tech, friendly]) => {
            const regex = new RegExp(`\\b${tech}\\b`, 'gi');
            newMessage = newMessage.replace(regex, friendly);
            newAction = newAction.replace(regex, friendly);
        });
        
        return {
            ...s,
            message: newMessage,
            action: newAction
        };
    });
};

console.log('📝 Sistema de Labels Amigáveis carregado');
