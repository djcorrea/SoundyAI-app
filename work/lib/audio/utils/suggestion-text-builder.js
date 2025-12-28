/**
 * 🎯 SUGGESTION TEXT BUILDER
 * 
 * Sistema modular para gerar textos claros e práticos de sugestões
 * para produtores musicais.
 * 
 * Principais melhorias:
 * - Cálculo automático de min/max a partir de target ± tolerance
 * - Formatação correta de unidades (dB, LUFS, dBTP, %, correlação)
 * - Textos curtos, diretos e acionáveis
 * - Suporte especial para padrão de streaming (LUFS)
 * - Detecção automática de dB vs % em bandas espectrais
 */

/**
 * 📐 Formata número com precisão específica
 */
function formatValue(value, decimals = 1) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return 'N/A';
  }
  return value.toFixed(decimals);
}

/**
 * 📊 Formata delta com sinal (+/-)
 */
function formatDelta(delta, decimals = 1) {
  if (typeof delta !== 'number' || !isFinite(delta)) {
    return '0.0';
  }
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(decimals)}`;
}

/**
 * 🎚️ Constrói sugestão para métrica principal (LUFS, TruePeak, DR, Stereo)
 * 🎯 SSOT: min/max são OBRIGATÓRIOS - devem vir de comparisonResult.rows
 * ❌ PATH LEGACY REMOVIDO - NÃO calcular mais de target±tolerance
 * 
 * @param {Object} params - Parâmetros da métrica
 * @param {string} params.key - Identificador da métrica ('lufs', 'truePeak', 'dr', 'stereo')
 * @param {string} params.label - Nome amigável da métrica
 * @param {string} params.unit - Unidade de medida
 * @param {number} params.value - Valor atual medido
 * @param {number} params.target - Valor alvo ideal
 * @param {number} params.tolerance - Tolerância (mantido para compatibilidade, não usado para cálculo)
 * @param {number} params.min - Min do range (OBRIGATÓRIO - vem de comparisonResult)
 * @param {number} params.max - Max do range (OBRIGATÓRIO - vem de comparisonResult)
 * @param {number} [params.decimals=1] - Casas decimais para exibição
 * @returns {Object} - { message, explanation, action }
 */
export function buildMetricSuggestion({ 
  key, 
  label, 
  unit, 
  value, 
  target, 
  tolerance,
  min,  // 🎯 SSOT: OBRIGATÓRIO - vem de comparisonResult.rows
  max,  // 🎯 SSOT: OBRIGATÓRIO - vem de comparisonResult.rows
  decimals = 1
}) {
  // 🎯 SSOT: min/max são OBRIGATÓRIOS - vêm de comparisonResult.rows
  // ❌ PATH LEGACY REMOVIDO - Se min/max não estiverem definidos, usar valores safe defaults
  // (isso só acontece para bandas que ainda usam sistema antigo)
  const rangeMin = (typeof min === 'number') ? min : (target - (tolerance || 2));
  const rangeMax = (typeof max === 'number') ? max : (target + (tolerance || 2));
  const delta = value - target;
  
  // Ajustar decimais para correlação estéreo
  if (key === 'stereo' || unit === 'correlation') {
    decimals = 3;
  }
  
  // Formatar valores
  const valueStr = formatValue(value, decimals);
  const minStr = formatValue(rangeMin, decimals);
  const maxStr = formatValue(rangeMax, decimals);
  const targetStr = formatValue(target, decimals);
  const deltaStr = formatDelta(delta, decimals);
  const deltaAbs = Math.abs(delta);
  
  // Ícone baseado na métrica
  const icons = {
    lufs: '🎚️',
    truePeak: '🔺',
    dr: '📏',
    stereo: '🎛️',
    loudness: '🔊'
  };
  const icon = icons[key] || '📊';
  
  // === CONSTRUIR MENSAGEM ===
  let message = `${icon} ${label}\n`;
  message += `• Seu valor: ${valueStr} ${unit}\n`;
  message += `• Faixa ideal para este estilo: ${minStr} a ${maxStr} ${unit}\n`;
  message += `• Alvo recomendado: ${targetStr} ${unit}`;
  
  // === BLOCO ESPECIAL PARA LUFS: PADRÃO DE STREAMING ===
  let explanation = '';
  if (key === 'lufs') {
    explanation += `\n\n📡 Padrão de streaming:\n`;
    explanation += `• Plataformas normalizam para cerca de -14 LUFS.\n`;
    explanation += `• Se você pretende lançar em Spotify / Apple Music / YouTube, considere masterizar próximo de -14 LUFS para manter dinâmica natural e evitar redução automática de volume.`;
  }
  
  // === CONSTRUIR ORIENTAÇÃO PRÁTICA ===
  let action = '\n\n➜ Orientação prática:\n';
  
  // Verificar se está dentro do range
  const isWithinRange = value >= rangeMin && value <= rangeMax;  // ✅ USAR rangeMin/rangeMax
  const isClose = deltaAbs <= tolerance * 0.3; // Dentro de 30% da tolerância
  
  if (isWithinRange && isClose) {
    // Valor ideal
    action += `✅ Excelente! Seu ${label.toLowerCase()} está no ponto ideal para o estilo.`;
    if (key === 'lufs') {
      action += `\n- Para pista / carro: mantenha este nível.\n`;
      action += `- Para streaming: considere versão a -14 LUFS.`;
    }
  } else if (value > rangeMax) {  // ✅ USAR rangeMax
    // Acima do máximo
    const excess = value - rangeMax;  // ✅ USAR rangeMax
    const excessStr = formatValue(excess, decimals);
    
    switch (key) {
      case 'lufs':
        action += `⚠️ Volume ${excessStr} dB acima do máximo recomendado.\n`;
        action += `- Para pista / carro: reduza o limiter para chegar próximo de ${targetStr} LUFS.\n`;
        action += `- Para streaming: busque algo próximo de -14 LUFS.`;
        break;
        
      case 'truePeak':
        if (value >= 0) {
          action += `🔴 CRÍTICO: True Peak em ${valueStr} dBTP - CLIPPING DIGITAL!\n`;
          action += `- O limite máximo absoluto é 0.0 dBTP.\n`;
          action += `- Reduza imediatamente o limiter ou o gain master em pelo menos ${excessStr} dB.\n`;
          action += `- O target para este estilo é ${targetStr} dBTP.`;
        } else {
          action += `⚠️ True Peak ${excessStr} dB acima do máximo (${maxStr} dBTP).\n`;
          action += `- Reduza o limiter para chegar próximo de ${targetStr} dBTP.`;
        }
        break;
        
      case 'dr':
        action += `⚠️ Dinâmica ${excessStr} dB acima do ideal para o estilo.\n`;
        action += `- Para este estilo, o som pode parecer "solto" demais.\n`;
        action += `- Aplique compressão suave (ratio 2:1 a 3:1) nos buses principais.\n`;
        action += `- Use parallel compression para manter naturalidade.`;
        break;
        
      case 'stereo':
        action += `⚠️ Correlação estéreo muito alta (${valueStr}) - mix soando muito mono.\n`;
        action += `- Abra o campo estéreo com: reverb, delay, double-tracking.\n`;
        action += `- Use plugins de stereo widening com moderação.\n`;
        action += `- Ajuste pan de elementos secundários.`;
        break;
        
      default:
        action += `⚠️ Valor ${deltaStr} ${unit} acima do alvo.\n`;
        action += `- Reduza este parâmetro gradualmente até chegar próximo de ${targetStr} ${unit}.`;
    }
  } else if (value < min) {
    // Abaixo do mínimo
    const deficit = min - value;
    const deficitStr = formatValue(deficit, decimals);
    
    switch (key) {
      case 'lufs':
        action += `⚠️ Volume ${deficitStr} dB abaixo do mínimo recomendado.\n`;
        action += `- Para pista / carro: aumente o limiter para chegar próximo de ${targetStr} LUFS.\n`;
        action += `- Para streaming: -14 LUFS já está adequado, mas você pode subir um pouco mais.`;
        break;
        
      case 'truePeak':
        action += `ℹ️ True Peak em ${valueStr} dBTP está abaixo do mínimo (${minStr} dBTP).\n`;
        action += `- Você tem margem de ${deficitStr} dB para aumentar o volume.\n`;
        action += `- O target para este estilo é ${targetStr} dBTP (faixa: ${minStr} a ${maxStr} dBTP).`;
        break;
        
      case 'dr':
        action += `🔴 Dinâmica ${deficitStr} dB abaixo do ideal - master muito comprimida!\n`;
        action += `- O som está "esmagado" demais para o estilo.\n`;
        action += `- Reduza ratio dos compressores e limiters.\n`;
        action += `- Aumente attack/release para preservar transientes.\n`;
        action += `- Considere refazer o mastering com menos compressão.`;
        break;
        
      case 'stereo':
        action += `⚠️ Correlação estéreo muito baixa (${valueStr}) - risco de cancelamento em mono!\n`;
        action += `- Centralize elementos importantes (vocal, kick, snare, bass).\n`;
        action += `- Reduza efeitos de stereo widening excessivos.\n`;
        action += `- Verifique phase correlation em mono.`;
        break;
        
      default:
        action += `⚠️ Valor ${deltaStr} ${unit} abaixo do alvo.\n`;
        action += `- Aumente este parâmetro gradualmente até chegar próximo de ${targetStr} ${unit}.`;
    }
  } else {
    // Dentro do range mas não muito próximo do alvo
    switch (key) {
      case 'lufs':
        if (delta > 0) {
          action += `Você está ${deltaStr} dB acima do alvo. Reduza um pouco o limiter para chegar próximo de ${targetStr} LUFS.\n`;
          action += `- Para pista / carro: ajuste para ficar próximo de ${targetStr} LUFS.\n`;
          action += `- Para streaming: busque algo próximo de -14 LUFS.`;
        } else {
          action += `Você está ${Math.abs(delta).toFixed(decimals)} dB abaixo do alvo. Aumente um pouco o limiter para chegar próximo de ${targetStr} LUFS.\n`;
          action += `- Para pista / carro: ajuste para ficar próximo de ${targetStr} LUFS.\n`;
          action += `- Para streaming: -14 LUFS já está adequado.`;
        }
        break;
        
      case 'truePeak':
        action += `True Peak está seguro. Você pode ajustar levemente para ficar mais próximo de ${targetStr} dBTP.`;
        break;
        
      case 'dr':
        if (delta > 0) {
          action += `Dinâmica um pouco acima do alvo. Aplique compressão suave para ficar próximo de ${targetStr} dB.`;
        } else {
          action += `Dinâmica um pouco abaixo do alvo. Reduza compressão para ficar próximo de ${targetStr} dB.`;
        }
        break;
        
      case 'stereo':
        if (delta > 0) {
          action += `Correlação estéreo um pouco alta. Abra o campo estéreo para ficar próximo de ${targetStr}.`;
        } else {
          action += `Correlação estéreo um pouco baixa. Centralize elementos principais para ficar próximo de ${targetStr}.`;
        }
        break;
        
      default:
        action += `Ajuste para ficar mais próximo de ${targetStr} ${unit}.`;
    }
  }
  
  return {
    message: message.trim(),
    explanation: explanation.trim(),
    action: action.trim()
  };
}

/**
 * 🎛️ Constrói sugestão para banda espectral
 * 
 * ⚠️ REGRA ABSOLUTA: SEMPRE usa target_db (dB) como referência
 * ❌ NUNCA renderiza targets em porcentagem (%)
 * ✅ Se measured vier em %, trata como indicador energético
 * 
 * @param {Object} params - Parâmetros da banda
 * @param {string} params.bandKey - Chave da banda ('sub', 'bass', 'mid', etc.)
 * @param {string} params.bandLabel - Nome amigável da banda
 * @param {string} params.freqRange - Faixa de frequência (ex: "20-60 Hz")
 * @param {number} params.value - Valor atual medido (pode ser dB ou energia %)
 * @param {number} params.target - target_db (SEMPRE em dB do genreTargets)
 * @param {number} params.tolerance - Tolerância em dB
 * @param {string} [params.unit] - Unidade do valor medido (ignorado, sempre força dB)
 * @returns {Object} - { message, explanation, action }
 */
export function buildBandSuggestion({
  bandKey,
  bandLabel,
  freqRange,
  value,
  target,
  tolerance,
  min,  // ✅ ACEITAR min/max REAIS do target_range
  max,  // ✅ ACEITAR min/max REAIS do target_range
  unit = 'dB'  // ✅ SEMPRE dB por padrão (nunca % em sugestões)
}) {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 REGRA ABSOLUTA: BANDAS SEMPRE SÃO RENDERIZADAS EM dB
  // ═══════════════════════════════════════════════════════════════════════════
  // ✅ Backend (core-metrics.js) garante: consolidatedData.metrics.bands[key].value = energy_db
  // ✅ analyzeBand() (problems-suggestions-v2.js) passa: unit: 'dB' explicitamente
  // ✅ Target SEMPRE é em dB (genreTargets.bands[key].target_db)
  // ❌ NUNCA renderizar bandas em % (energia) em sugestões
  // ❌ NUNCA usar heurística para "adivinhar" unidade
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🔥 LOG CRÍTICO: AUDITORIA DO VALOR RECEBIDO
  console.log(`[BUILD-BAND-SUGGESTION] 🔍 buildBandSuggestion() chamado para banda ${bandKey}:`);
  console.log(`[BUILD-BAND-SUGGESTION] - value: ${value}`);
  console.log(`[BUILD-BAND-SUGGESTION] - target: ${target}`);
  console.log(`[BUILD-BAND-SUGGESTION] - tolerance: ${tolerance}`);
  console.log(`[BUILD-BAND-SUGGESTION] - unit: ${unit}`);
  console.log(`[BUILD-BAND-SUGGESTION] - typeof value: ${typeof value}`);
  console.log(`[BUILD-BAND-SUGGESTION] - value < 0: ${value < 0}`);
  
  // 🎯 VALIDAÇÃO CRÍTICA: Se value não for negativo (dBFS), algo está MUITO errado
  if (value >= 0) {
    console.error(`[BAND-SUGGESTION-CRITICAL] ❌❌❌ BUG CRÍTICO DETECTADO! ❌❌❌`);
    console.error(`[BAND-SUGGESTION-CRITICAL] ❌ Valor POSITIVO ${value} recebido para banda ${bandKey}!`);
    console.error(`[BAND-SUGGESTION-CRITICAL] ❌ Bandas devem ter valores dBFS NEGATIVOS (ex: -23.8 dB)!`);
    console.error(`[BAND-SUGGESTION-CRITICAL] ❌ Isso indica que analyzeBand() passou PERCENTAGE ao invés de energy_db!`);
    console.error(`[BAND-SUGGESTION-CRITICAL] ❌ Parâmetros recebidos:`, { bandKey, value, target, tolerance, unit });
    
    // 🔥 CRIAR SUGESTÃO DE ERRO VISUAL PARA DEBUGGING
    return {
      message: `❌ ERRO: Banda ${bandKey} com valor ${value} (deveria ser dB negativo)`,
      explanation: `BUG CRÍTICO: buildBandSuggestion() recebeu valor POSITIVO quando deveria ser dBFS NEGATIVO. Verifique analyzeBand() no console.`,
      action: `Revisar logs do console - valor ${value} é inválido para dBFS.`
    };
  }
  
  // === USAR RANGE REAL (ou calcular como fallback) ===
  const rangeMin = (min !== undefined && min !== null) ? min : (target - tolerance);
  const rangeMax = (max !== undefined && max !== null) ? max : (target + tolerance);
  
  console.log(`[BUILD-BAND] 🔍 Range para ${bandKey}:`, {
    receivedMin: min,
    receivedMax: max,
    calculatedMin: target - tolerance,
    calculatedMax: target + tolerance,
    usedMin: rangeMin,
    usedMax: rangeMax,
    source: (min !== undefined && max !== undefined) ? 'target_range (REAL)' : 'calculated (FALLBACK)'
  });
  
  // === ÍCONES POR BANDA ===
  const icons = {
    sub: '🔊',
    bass: '🥁',
    lowMid: '🎸',
    low_mid: '🎸',
    mid: '🎤',
    highMid: '🎺',
    high_mid: '🎺',
    presenca: '✨',
    presence: '✨',
    brilho: '💎',
    brilliance: '💎'
  };
  const icon = icons[bandKey] || '🎛️';
  
  // === CONSTRUIR MENSAGEM ===
  let message = `${icon} ${bandLabel}`;
  if (freqRange) {
    message += ` (${freqRange})`;
  }
  message += `\n`;
  
  // ✅ SEMPRE renderizar em dB (sem casos especiais)
  const delta = value - target;
  message += `• Valor atual: ${value.toFixed(1)} dB\n`;
  message += `• Faixa ideal: ${rangeMin.toFixed(1)} a ${rangeMax.toFixed(1)} dB\n`;  // ✅ USAR rangeMin/rangeMax
  message += `• Alvo recomendado: ${target.toFixed(1)} dB`;
  
  // 🔥 LOG CRÍTICO: MENSAGEM FINAL GERADA
  console.log(`[BUILD-BAND-SUGGESTION] ✅ Mensagem gerada para ${bandKey}:`, message);
  
  // === CONSTRUIR EXPLICAÇÃO ===
  let explanation = '';
  const bandDescriptions = {
    sub: 'Subgrave dá peso e impacto físico à música. Essencial em estilos eletrônicos e urbanos.',
    bass: 'Grave define a fundação tonal. Kick e baixo vivem aqui.',
    low_bass: 'Grave define a fundação tonal. Kick e baixo vivem aqui.',
    lowMid: 'Médio-grave adiciona corpo e calor. Cuidado com excesso que pode deixar o som "enlameado".',
    low_mid: 'Médio-grave adiciona corpo e calor. Cuidado com excesso que pode deixar o som "enlameado".',
    mid: 'Médio é onde a voz e instrumentos principais se destacam. Região crítica para inteligibilidade.',
    highMid: 'Médio-agudo traz presença e definição. Essencial para clareza e brilho.',
    high_mid: 'Médio-agudo traz presença e definição. Essencial para clareza e brilho.',
    presenca: 'Presença adiciona "ar" e proximidade. Excesso pode causar fadiga auditiva.',
    presence: 'Presença adiciona "ar" e proximidade. Excesso pode causar fadiga auditiva.',
    brilho: 'Brilho dá abertura e "ar" ao som. Essencial para sensação de qualidade moderna.',
    brilliance: 'Brilho dá abertura e "ar" ao som. Essencial para sensação de qualidade moderna.'
  };
  explanation = bandDescriptions[bandKey] || 'Esta faixa de frequência é importante para o balanço espectral geral.';
  
  // === CONSTRUIR AÇÃO ===
  let action = '';
  
  // ✅ CÁLCULO DE DELTA SEMPRE EM dB (value JÁ está em dB)
  const deltaAbs = Math.abs(delta);
  const isWithinRange = value >= min && value <= max;
  const isClose = deltaAbs <= tolerance * 0.3;
  
  action = '\n➜ Orientação prática:\n';
  
  if (isWithinRange && isClose) {
    action += `✅ Excelente! Esta faixa de frequência está bem equilibrada para o estilo.`;
  } else if (value > max) {
    const excess = value - max;
      action += `⚠️ Região ${excess.toFixed(1)} dB acima do ideal.\n\n`;
      action += `🎚️ Ação recomendada:\n`;
      
      // Sugestões específicas por banda
      switch (bandKey) {
        case 'sub':
          action += `- Reduza o subgrave com EQ shelving abaixo de 60 Hz\n`;
          action += `- Corte suave de ${Math.min(excess, 3).toFixed(1)} dB já faz diferença\n`;
          action += `- Aplique high-pass filter em elementos que não precisam de sub`;
          break;
          
        case 'bass':
        case 'low_bass':
          action += `- Reduza o grave com EQ bell em 80-120 Hz\n`;
          action += `- Ajuste compressão do kick e baixo para controlar picos\n`;
          action += `- Verifique se kick e baixo não estão competindo`;
          break;
          
        case 'lowMid':
        case 'low_mid':
          action += `- Corte médio-grave com EQ bell em 250-500 Hz\n`;
          action += `- Cuidado: excesso deixa o som "enlameado" e abafado\n`;
          action += `- Aplique side-chain se necessário`;
          break;
          
        case 'mid':
          action += `- Reduza médios com EQ bell em 500 Hz - 2 kHz\n`;
          action += `- Atenção: não corte demais ou perderá corpo e presença\n`;
          action += `- Ajuste compressão de vocais e instrumentos principais`;
          break;
          
        case 'highMid':
        case 'high_mid':
        case 'presenca':
        case 'presence':
          action += `- Reduza médio-agudos com EQ bell em 2-5 kHz\n`;
          action += `- Cuidado: excesso causa fadiga auditiva e som agressivo\n`;
          action += `- Use de-esser em vocais se necessário`;
          break;
          
        case 'brilho':
        case 'brilliance':
          action += `- Reduza brilho com EQ shelving acima de 6 kHz\n`;
          action += `- Corte suave de ${Math.min(excess, 3).toFixed(1)} dB já suaviza o som\n`;
          action += `- Verifique pratos e hi-hats`;
          break;
          
        default:
          action += `- Use EQ para reduzir esta faixa de frequência\n`;
          action += `- Ajuste gradualmente até chegar ao range ideal`;
      }
    } else if (value < min) {
      const deficit = min - value;
      action += `⚠️ Região ${deficit.toFixed(1)} dB abaixo do ideal.\n\n`;
      action += `🎚️ Ação recomendada:\n`;
      
      // Sugestões específicas por banda
      switch (bandKey) {
        case 'sub':
          action += `- Aumente o subgrave com EQ shelving abaixo de 60 Hz\n`;
          action += `- Reforce o kick e sub-bass com boost suave\n`;
          action += `- Considere adicionar camada de sub sintético`;
          break;
          
        case 'bass':
        case 'low_bass':
          action += `- Aumente o grave com EQ bell em 80-120 Hz\n`;
          action += `- Reforce kick e baixo para dar mais fundação\n`;
          action += `- Use compressão para controlar dinâmica`;
          break;
          
        case 'lowMid':
        case 'low_mid':
          action += `- Aumente médio-grave com EQ bell em 250-500 Hz\n`;
          action += `- Adicione corpo e calor à mixagem\n`;
          action += `- Atenção: não exagere ou o som ficará abafado`;
          break;
          
        case 'mid':
          action += `- Aumente médios com EQ bell em 500 Hz - 2 kHz\n`;
          action += `- Vocais e instrumentos principais precisam de presença\n`;
          action += `- Boost suave de ${Math.min(deficit, 3).toFixed(1)} dB já faz diferença`;
          break;
          
        case 'highMid':
        case 'high_mid':
        case 'presenca':
        case 'presence':
          action += `- Aumente médio-agudos com EQ bell em 2-5 kHz\n`;
          action += `- Adicione presença e clareza à mixagem\n`;
          action += `- Boost moderado para evitar som agressivo`;
          break;
          
        case 'brilho':
        case 'brilliance':
          action += `- Aumente brilho com EQ shelving acima de 6 kHz\n`;
          action += `- Adicione "ar" e abertura ao som\n`;
          action += `- Boost suave de ${Math.min(deficit, 3).toFixed(1)} dB para modernizar o som`;
          break;
          
        default:
          action += `- Use EQ para aumentar esta faixa de frequência\n`;
          action += `- Ajuste gradualmente até chegar ao range ideal`;
      }
    } else {
      // Dentro do range mas pode melhorar
      if (delta > 0) {
        action += `Região levemente acima do alvo. Reduza com EQ suave para chegar próximo de ${target.toFixed(1)} dB.`;
      } else {
        action += `Região levemente abaixo do alvo. Aumente com EQ suave para chegar próximo de ${target.toFixed(1)} dB.`;
      }
    }
  
  return {
    message: message.trim(),
    explanation: explanation.trim(),
    action: action.trim()
  };
}

/**
 * 📋 Mapeamento de labels amigáveis para métricas
 */
export const METRIC_LABELS = {
  lufs: 'Volume geral (LUFS integrado)',
  truePeak: 'True Peak (pico real)',
  dr: 'Dinâmica (Dynamic Range)',
  stereo: 'Imagem estéreo',
  loudness: 'Loudness percebido'
};

/**
 * 📋 Mapeamento de labels amigáveis para bandas
 */
export const BAND_LABELS = {
  sub: 'Subgrave',
  bass: 'Grave',
  low_bass: 'Grave',
  lowMid: 'Médio-grave',
  low_mid: 'Médio-grave',
  mid: 'Médio',
  highMid: 'Médio-agudo',
  high_mid: 'Médio-agudo',
  presenca: 'Presença',
  presence: 'Presença',
  brilho: 'Brilho',
  brilliance: 'Brilho'
};

/**
 * 📋 Mapeamento de faixas de frequência
 */
export const FREQUENCY_RANGES = {
  sub: '20-60 Hz',
  bass: '60-250 Hz',
  low_bass: '60-250 Hz',
  lowMid: '250-500 Hz',
  low_mid: '250-500 Hz',
  mid: '500 Hz - 2 kHz',
  highMid: '2-5 kHz',
  high_mid: '2-5 kHz',
  presenca: '3-6 kHz',
  presence: '3-6 kHz',
  brilho: '6-20 kHz',
  brilliance: '6-20 kHz'
};
