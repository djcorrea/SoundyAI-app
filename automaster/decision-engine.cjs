/**
 * ═════════════════════════════════════════════════════════════
 * AUTOMASTER V1 - MOTOR DE DECISÃO INTELIGENTE (COM GUARDRAILS)
 * ═════════════════════════════════════════════════════════════
 * 
 * Sistema conservador que decide LUFS alvo baseado em métricas
 * técnicas reais do áudio, sem dependência de gênero musical.
 * 
 * Prioriza qualidade sobre loudness máxima.
 * Inclui guardrails de segurança para prevenir ganhos excessivos.
 */

/**
 * Modos disponíveis com offsets máximos de loudness
 * NEW: STREAMING mode (fixed -14 LUFS) + HIGH mode (competitive loudness)
 */
const MODES = {
  STREAMING: {
    name: 'Streaming Standard',
    maxOffsetLU: 0,  // Não usado (target fixo -14.0 LUFS)
    description: 'Target fixo em -14.0 LUFS (padrão broadcast/streaming). Ignora dinâmica.'
  },
  LOW: {
    name: 'Suave',
    maxOffsetLU: 4.0,  // Aumentado de 2.0 para 4.0
    description: 'Aumento conservador, preserva dinâmica máxima'
  },
  MEDIUM: {
    name: 'Balanceado',
    maxOffsetLU: 8.0,  // Aumentado de 4.0 para 8.0
    description: 'Aumento perceptível, equilíbrio entre loudness e qualidade'
  },
  HIGH: {
    name: 'Impacto',
    maxOffsetLU: 12.0,  // Aumentado de 6.0 para 12.0
    description: 'Loudness competitiva (-11 a -10 LUFS). Para streaming competitivo.'
  }
};

/**
 * Limites máximos de ganho por modo (em dB)
 * Previne ganhos excessivos que causam pumping e degradação
 */
const MAX_GAIN_DB = {
  STREAMING: 20.0,  // Alto porque pode aplicar a qualquer input
  LOW: 3.0,
  MEDIUM: 5.0,
  HIGH: 7.0
};

/**
 * Limites de estresse do limiter por modo (em dB)
 * Previne pumping e esmagamento de transientes quando limiter
 * precisa trabalhar muito além do headroom disponível
 * 
 * stressEstimate = gainNeeded - headroom
 * 
 * Quanto maior o stress, mais o limiter precisa comprimir,
 * causando degradação perceptiva mesmo com ganho permitido
 */
const MAX_LIMITER_STRESS = {
  STREAMING: 4.0,  // Moderado (pode processar qualquer input)
  LOW: 1.5,
  MEDIUM: 3.0,
  HIGH: 7.5,        // ETAPA 1: aumentado 4.5→7.5 para permitir mais impacto no HIGH mode
  HIGH_EXTENDED: 8.5  // ETAPA 1: aumentado 5.2→8.5 para mixes CF > 12 com headroom
};

/**
 * Limite máximo de delta LUFS por modo no Global Caps (em LU)
 * Define o ganho máximo permitido independente de outros guardrails
 * 
 * STREAMING: +20 LU - Sem limite prático (target fixo -14 LUFS)
 * LOW: +7 LU - Conservador, preserva dinâmica máxima
 * MEDIUM: +9 LU - Balanceado entre loudness e qualidade
 * HIGH: +13 LU - Competitivo, permite máxima loudness
 */
const MAX_DELTA_BY_MODE = {
  STREAMING: 20.0,
  LOW: 7.0,
  MEDIUM: 9.0,
  HIGH: 13.0
};

/**
 * Limite máximo de delta de loudness por modo (em LU)
 * Camada final de segurança que impede ganhos excessivos
 * independente de outros guardrails
 * 
 * Previne:
 * - Pumping audível
 * - Achatamento de dinâmica
 * - Degradação perceptiva extrema
 */
const MAX_DELTA_LUFS = {
  LOW: 3.0,
  MEDIUM: 5.0,
  HIGH: 4.5  // Reduzido de 6.0 para 4.5 (HIGH competitivo mas seguro)
};

/**
 * Crest factor padrão conservador para fallback
 * Usado quando CF não pode ser calculado com confiança
 */
const DEFAULT_CREST_FACTOR = 7.0;

/**
 * Calcula score de confiança da mix para o modo HIGH
 * 
 * Score baseado em:
 * - Headroom disponível
 * - Crest factor (dinâmica do áudio)
 * - Delta de loudness pretendido
 * 
 * Score baixo (<0.6) indica mix instável para modo HIGH
 * Sistema automaticamente rebaixa para MEDIUM para preservar qualidade
 * 
 * @param {Object} params
 * @param {number} params.headroom - Headroom em dB
 * @param {number} params.crestFactor - Crest factor em dB
 * @param {number} params.delta - Delta LUFS pretendido
 * @returns {number} Score de 0 a 1
 */
function calculateMixConfidence({ headroom, crestFactor, delta }) {
  let score = 1.0;
  
  // Headroom baixo reduz confiança
  if (headroom < 1.5) score -= 0.3;
  else if (headroom < 2.5) score -= 0.15;
  
  // Crest factor baixo indica mix comprimida
  if (crestFactor < 8) score -= 0.3;
  else if (crestFactor < 10) score -= 0.15;
  
  // Delta alto aumenta risco perceptivo
  if (delta > 5) score -= 0.25;
  else if (delta > 4) score -= 0.15;
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Analisa métricas técnicas e decide LUFS alvo usando offsets seguros.
 * 
 * NUNCA REDUZ LOUDNESS - só aumenta de forma segura e controlada.
 * 
 * @param {Object} metrics - Métricas do áudio original
 * @param {number} metrics.lufs - LUFS integrado atual
 * @param {number} metrics.truePeak - True peak em dBTP
 * @param {number} metrics.crestFactor - Crest factor em dB
 * @param {string} mode - Modo escolhido: 'LOW', 'MEDIUM', 'HIGH'
 * @returns {Object} Decisão de processamento
 */
function decideGainWithinRange(metrics, mode = 'MEDIUM', opts = {}) {
  const modeConfig = MODES[mode.toUpperCase()] || MODES.MEDIUM;
  const modeKey = mode.toUpperCase();
  
  // ═══════════════════════════════════════════════════════════
  // 1. EXTRAÇÃO E VALIDAÇÃO DE MÉTRICAS
  // ═══════════════════════════════════════════════════════════
  const currentLUFS = parseFloat(metrics.lufs) || -20.0;
  const truePeak = parseFloat(metrics.truePeak) || -1.0;
  
  // Validação segura de Crest Factor
  let crestFactor = parseFloat(metrics.crestFactor);
  let crestFactorFallback = false;
  
  if (isNaN(crestFactor) || crestFactor === null || crestFactor <= 0 || crestFactor > 30) {
    console.error('⚠️  Crest Factor inválido ou suspeito, usando fallback conservador');
    crestFactor = DEFAULT_CREST_FACTOR;
    crestFactorFallback = true;
  }
  
  // Calcular headroom disponível
  const headroom = Math.abs(truePeak); // Se truePeak = -1.5, headroom = 1.5 dB
  
  // 🎯 NOVO PRINCÍPIO: Compressão aceitável do limiter por modo
  // O TP inicial NÃO é limite final - limiter pode comprimir de forma controlada
  let limiterStressPermitido = 4.0; // Default MEDIUM
  if (modeKey === 'LOW') limiterStressPermitido = 2.0;
  else if (modeKey === 'MEDIUM') limiterStressPermitido = 4.0;
  else if (modeKey === 'HIGH') limiterStressPermitido = 6.0;
  
  // effectiveHeadroom = headroom + compressão aceitável + redistribuição loudnorm
  const effectiveHeadroom = headroom + limiterStressPermitido;
  
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('🎯 [AUTOMASTER] MOTOR DE DECISÃO - Target Dinâmico');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('📊 Métricas de entrada:');
  console.error(`   LUFS atual: ${currentLUFS.toFixed(1)} LUFS`);
  console.error(`   True Peak: ${truePeak.toFixed(1)} dBTP`);
  console.error(`   Headroom inicial: ${headroom.toFixed(1)} dB`);
  console.error(`   Limiter stress permitido: ${limiterStressPermitido.toFixed(1)} dB (modo ${modeKey})`);
  console.error(`   Effective Headroom: ${effectiveHeadroom.toFixed(1)} dB`);
  console.error(`   Crest Factor: ${crestFactor.toFixed(1)} dB${crestFactorFallback ? ' (fallback)' : ''}`);
  console.error('');
  console.error(`🎚️ Modo escolhido: ${modeConfig.name}`);
  console.error('');
  
  // ═══════════════════════════════════════════════════════════
  // 2. REGRA CRÍTICA: NUNCA REDUZIR LOUDNESS
  // ═══════════════════════════════════════════════════════════
  
  // Apenas processar se for aumentar loudness
  // (Não há target pré-definido - sempre calculamos aumento seguro)
  
  // ─── REFINE MODE: mix alta + headroom insuficiente para loudness push ──────
  // Condição: LUFS > -13 E headroom < 1.0 dB
  // Ação: não abortar — ativar REFINE (EQ tonal + compressão leve, zero loudness push)
  // BYPASS: quando rescueBypass=true o De-Gain já criou headroom — não forçar REFINE
  if (!opts.rescueBypass && currentLUFS > -13.0 && headroom < 1.0) {
    console.error('🔬 REFINE MODE ATIVADO: Mix alta com pouco headroom');
    console.error(`   LUFS: ${currentLUFS.toFixed(1)} > -13.0 | Headroom: ${headroom.toFixed(2)} < 1.0 dB`);
    console.error('   Estratégia: EQ tonal + compressão leve | Sem ganho de loudness');
    console.error('═══════════════════════════════════════════════════════════');
    return {
      targetLUFS: currentLUFS,
      gainDB: 0,
      shouldProcess: true,
      strategy: 'REFINE',
      reason: 'Mix alta com headroom insuficiente — REFINE MODE ativado',
      safe: true,
      confidenceScore: 1.0,
      confidenceLabel: 'REFINE',
      offsetApplied: 0,
      mode: modeKey,
      modeApplied: modeKey,
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }

  // Headroom crítico (<0.8 dB) - evitar processamento por segurança
  // BYPASS: quando rescueBypass=true o De-Gain já criou headroom — não abortar
  if (!opts.rescueBypass && headroom < 0.8) {
    console.error('🚨 Headroom crítico (<0.8 dB) - risco de clipping');
    console.error('   Decisão: Não processar para preservar qualidade');
    console.error('═══════════════════════════════════════════════════════════');
    return {
      targetLUFS: currentLUFS,
      gainDB: 0,
      shouldProcess: false,
      reason: 'Headroom insuficiente para processamento seguro',
      safe: true,
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🎯 STREAMING MODE: TARGET FIXO -14.0 LUFS (BYPASS DINÂMICA)
  // ═══════════════════════════════════════════════════════════
  
  if (modeKey === 'STREAMING') {
    const targetLUFS = -14.0;
    const gainDB = targetLUFS - currentLUFS;
    
    console.error('');
    console.error('🎯 [MODE STREAMING] Target fixo aplicado');
    console.error(`   Target LUFS: ${targetLUFS.toFixed(1)} LUFS (padrão broadcast/streaming)`);
    console.error(`   LUFS atual: ${currentLUFS.toFixed(1)} LUFS`);
    console.error(`   Ganho necessário: ${gainDB >= 0 ? '+' : ''}${gainDB.toFixed(1)} dB`);
    console.error('   Ignora dinâmica, métrica e headroom - target absoluto');
    console.error('');
    
    // Se ganho é muito pequeno, não processar
    if (Math.abs(gainDB) < 0.3) {
      console.error('ℹ️ Ganho muito baixo (<0.3 dB)');
      console.error('   Decisão: Não processar (já próximo do target)');
      console.error('═══════════════════════════════════════════════════════════');
      return {
        targetLUFS: currentLUFS,
        gainDB: 0,
        shouldProcess: false,
        reason: 'Áudio já está próximo do target STREAMING (-14 LUFS)',
        safe: true,
        mode: 'STREAMING',
        modeApplied: 'STREAMING',
        metrics: { currentLUFS, truePeak, crestFactor, headroom }
      };
    }
    
    console.error('✅ Target STREAMING definido');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    
    return {
      targetLUFS: parseFloat(targetLUFS.toFixed(1)),
      gainDB: parseFloat(gainDB.toFixed(1)),
      shouldProcess: true,
      reason: 'STREAMING mode - target fixo -14.0 LUFS',
      safe: true,
      mode: 'STREAMING',
      modeApplied: 'STREAMING',
      limiterStressEstimate: 0,  // Não aplicável (target fixo)
      confidenceScore: 1.0,  // Sempre confiante (target fixo)
      confidenceLabel: 'STREAMING_FIXED',
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🚀 HIGH MODE DYNAMIC EXTENSION
  // ═══════════════════════════════════════════════════════════
  // Quando mix tem alta dinâmica (CF > 12 dB) E headroom suficiente (> 3 dB),
  // modo HIGH pode atingir loudness maior sem comprometer transientes.
  // Extensão dinâmica: extra = min(2 LU, crestFactor - 11)
  // Permite HIGH chegar até -6.0 LUFS (vs cap padrão -8.0 LUFS)
  
  let highModeExtension = 0;
  if (modeKey === 'HIGH' && crestFactor > 12 && headroom > 3) {
    highModeExtension = Math.min(2.0, crestFactor - 11);
    console.error('');
    console.error('🚀 HIGH MODE: Extensão dinâmica ativada');
    console.error(`   Crest Factor: ${crestFactor.toFixed(1)} dB (> 12 dB)`);
    console.error(`   Headroom: ${headroom.toFixed(1)} dB (> 3 dB)`);
    console.error(`   Extensão permitida: +${highModeExtension.toFixed(1)} LU`);
    console.error(`   Cap estendido: ${(-8.0 + highModeExtension).toFixed(1)} LUFS`);
    console.error('');
  }
  
  // ═══════════════════════════════════════════════════════════
  // 3. TARGETS DINÂMICOS POR FAIXA DE LUFS
  // ═══════════════════════════════════════════════════════════
  
  let targetLUFS;
  let strategy = 'unknown';
  
  // MIX MUITO BAIXA (< -18 LUFS)
  if (currentLUFS < -18.0) {
    strategy = 'aggressive_push';
    console.error('🚀 Mix muito baixa detectada (< -18 LUFS)');
    console.error('   Estratégia: Subir máximo possível até stress limite');
    
    // Targets por modo
    let maxTarget = -13.0;  // Default MEDIUM
    if (modeKey === 'LOW') maxTarget = -14.0;
    else if (modeKey === 'MEDIUM') maxTarget = -13.0;
    else if (modeKey === 'HIGH') {
      // HIGH mode: loudness competitiva baseada em crest factor
      if (crestFactor >= 12) {
        maxTarget = -10.5;  // Alvo -11 a -10 LUFS
        console.error('   🔥 HIGH MODE (CF >= 12): Target competitivo -10.5 LUFS');
      } else {
        maxTarget = -11.5;  // Alvo -12 a -11 LUFS
        console.error('   🔥 HIGH MODE (CF < 12): Target competitivo -11.5 LUFS');
      }
    }
    
    // Calcular ganho permitido baseado em effectiveHeadroom
    const gainAllowed = effectiveHeadroom;
    const gainToTarget = maxTarget - currentLUFS;
    
    // Usar o menor entre ganho permitido e ganho necessário
    const gainFinal = Math.min(gainToTarget, gainAllowed);
    targetLUFS = currentLUFS + gainFinal;
    
    console.error(`   Target máximo modo: ${maxTarget.toFixed(1)} LUFS`);
    console.error(`   Ganho permitido: ${gainAllowed.toFixed(1)} dB`);
    console.error(`   Ganho para target: ${gainToTarget.toFixed(1)} dB`);
    console.error(`   Ganho final: ${gainFinal.toFixed(1)} dB`);
    console.error('');
  }
  // MIX MÉDIA (-18 a -13 LUFS)
  else if (currentLUFS >= -18.0 && currentLUFS <= -13.0) {
    strategy = 'moderate_push';
    console.error('📊 Mix média detectada (-18 a -13 LUFS)');
    console.error('   Estratégia: Subida moderada baseada em capacidade');
    
    // Targets por modo
    let targetRange = { min: -13.0, max: -12.0 };  // Default MEDIUM
    if (modeKey === 'LOW') targetRange = { min: -14.0, max: -13.0 };
    else if (modeKey === 'MEDIUM') targetRange = { min: -13.0, max: -12.0 };
    else if (modeKey === 'HIGH') {
      // HIGH mode: loudness competitiva baseada em crest factor
      if (crestFactor >= 12) {
        targetRange = { min: -11.0, max: -10.0 };
        console.error('   🔥 HIGH MODE (CF >= 12): Range competitivo -11 a -10 LUFS');
      } else {
        targetRange = { min: -12.0, max: -11.0 };
        console.error('   🔥 HIGH MODE (CF < 12): Range competitivo -12 a -11 LUFS');
      }
    }
    
    // Calcular target intermediário
    const idealTarget = (targetRange.max + targetRange.min) / 2;
    const gainAllowed = effectiveHeadroom * 0.8;  // 80% do effective headroom
    const gainToTarget = idealTarget - currentLUFS;
    
    const gainFinal = Math.min(gainToTarget, gainAllowed);
    targetLUFS = currentLUFS + gainFinal;
    
    // Clampar no range
    targetLUFS = Math.max(targetRange.min, Math.min(targetRange.max, targetLUFS));
    
    console.error(`   Target range: ${targetRange.min.toFixed(1)} a ${targetRange.max.toFixed(1)} LUFS`);
    console.error(`   Ganho permitido: ${gainAllowed.toFixed(1)} dB (80% headroom)`);
    console.error(`   Ganho final: ${gainFinal.toFixed(1)} dB`);
    console.error('');
  }
  // MIX ALTA (> -13 LUFS)
  else {
    strategy = 'preserve';
    console.error('🎨 Mix alta detectada (> -13 LUFS)');
    
    // HIGH mode: ainda buscar loudness competitiva
    if (modeKey === 'HIGH') {
      console.error('   🔥 HIGH MODE: Buscar loudness competitiva mesmo em mix alta');
      
      let targetHigh;
      if (crestFactor >= 12) {
        targetHigh = -10.5;  // Média de -11 a -10
        console.error('   Target: -10.5 LUFS (CF >= 12)');
      } else {
        targetHigh = -11.5;  // Média de -12 a -11
        console.error('   Target: -11.5 LUFS (CF < 12)');
      }
      
      const gainToTarget = targetHigh - currentLUFS;
      const gainAllowed = effectiveHeadroom * 0.5;  // 50% do effective headroom (moderado)
      const gainFinal = Math.min(gainToTarget, gainAllowed);
      
      targetLUFS = currentLUFS + gainFinal;
      
      // Clampar para não reduzir
      if (targetLUFS < currentLUFS) targetLUFS = currentLUFS;
      
      console.error(`   Ganho para target: ${gainToTarget.toFixed(1)} dB`);
      console.error(`   Ganho permitido: ${gainAllowed.toFixed(1)} dB`);
      console.error(`   Ganho aplicado: ${(targetLUFS - currentLUFS).toFixed(1)} dB`);
      console.error('');
    } 
    // Outros modos: preservar dinâmica
    else {
      console.error('   Estratégia: Preservar dinâmica e transientes');
      console.error('   Não buscar loudness, apenas correção leve');
      
      // Limitar ganho a 1 dB máximo
      const maxGain = 1.0;
      const safeGain = Math.min(effectiveHeadroom * 0.3, maxGain);
      targetLUFS = currentLUFS + safeGain;
      
      console.error(`   Ganho máximo: ${maxGain.toFixed(1)} dB`);
      console.error(`   Ganho aplicado: ${safeGain.toFixed(1)} dB`);
      console.error('');
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🔒 REGRA ABSOLUTA: NUNCA REDUZIR LUFS
  // ═══════════════════════════════════════════════════════════
  let finalGainNeeded = targetLUFS - currentLUFS;
  
  if (targetLUFS < currentLUFS) {
    console.error('');
    console.error('🛡️ PROTEÇÃO ABSOLUTA: Target calculado reduziria LUFS');
    console.error(`   Target original: ${targetLUFS.toFixed(1)} LUFS`);
    console.error(`   LUFS atual: ${currentLUFS.toFixed(1)} LUFS`);
    console.error(`   Ação: Clampar target ao mínimo = LUFS atual`);
    targetLUFS = currentLUFS;
    finalGainNeeded = 0;  // Ganho zero se target foi clampado
    console.error(`   Target ajustado: ${targetLUFS.toFixed(1)} LUFS`);
    console.error('');
  }
  
  console.error('🎯 Target final calculado:');
  console.error(`   LUFS atual: ${currentLUFS.toFixed(1)} LUFS`);
  console.error(`   LUFS alvo: ${targetLUFS.toFixed(1)} LUFS`);
  console.error(`   Ganho necessário: +${finalGainNeeded.toFixed(1)} dB`);
  console.error(`   Estratégia: ${strategy}`);
  console.error('');
  
  // Declarar safeOffset baseado no ganho calculado
  let safeOffset = finalGainNeeded;
  
  // ═══════════════════════════════════════════════════════════
  // 6. VALIDAÇÕES FINAIS DE SEGURANÇA
  // ═══════════════════════════════════════════════════════════
  
  // Ganho muito baixo (<0.3 dB) não justifica processamento
  if (finalGainNeeded < 0.3) {
    console.error('ℹ️ Ganho calculado muito baixo (<0.3 dB)');
    console.error('   Decisão: Não processar (mudança imperceptível)');
    console.error('═══════════════════════════════════════════════════════════');
    return {
      targetLUFS: currentLUFS,
      gainDB: 0,
      shouldProcess: false,
      reason: 'Offset calculado resulta em ganho imperceptível',
      safe: true,
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }
  
  // Calcular estresse do limiter
  const stressEstimate = Math.max(0, finalGainNeeded - headroom);
  
  // Aplicar limite de stress estendido para HIGH mode em condições favoráveis
  let maxStress = MAX_LIMITER_STRESS[modeKey] || MAX_LIMITER_STRESS.MEDIUM;
  
  if (modeKey === 'HIGH' && crestFactor > 12 && headroom > 2.0) {
    maxStress = MAX_LIMITER_STRESS.HIGH_EXTENDED;
    console.error('🎚️ HIGH MODE EXTENDED: CF > 12 e Headroom > 2 dB');
    console.error(`   Limiter stress estendido: ${maxStress} dB (padrão: ${MAX_LIMITER_STRESS.HIGH})`);
  }
  
  console.error('🔬 Análise de estresse do limiter:');
  console.error(`   Ganho necessário: ${finalGainNeeded.toFixed(1)} dB`);
  console.error(`   Headroom disponível: ${headroom.toFixed(1)} dB`);
  console.error(`   Estresse estimado: ${stressEstimate.toFixed(1)} dB`);
  console.error(`   Limite de estresse: ${maxStress} dB`);
  
  let stressAdjusted = false;
  
  if (stressEstimate > maxStress) {
    console.error('');
    console.error(`⚠️ ESTRESSE EXCESSIVO: ${stressEstimate.toFixed(1)} dB > ${maxStress} dB`);
    console.error('   Redução mínima (30% do excesso) para preservar impacto...');  // ETAPA 2
    
    // ETAPA 2: Reduzir apenas 30% do excesso — prioriza impacto sobre conservadorismo
    const excess = stressEstimate - maxStress;
    const reduction = excess * 0.3;
    safeOffset -= reduction;
    
    // Recalcular target
    targetLUFS = currentLUFS + safeOffset;
    finalGainNeeded = targetLUFS - currentLUFS;
    
    stressAdjusted = true;
    
    console.error(`   Excesso: ${excess.toFixed(2)} dB → redução aplicada: ${reduction.toFixed(2)} dB (30%)`);
    console.error(`   Offset ajustado: ${safeOffset.toFixed(1)} LU`);
    console.error(`   Novo target: ${targetLUFS.toFixed(1)} LUFS`);
    console.error(`   Novo ganho: ${finalGainNeeded.toFixed(1)} dB ✅`);
    console.error('');
  } else {
    console.error(`   ✅ Estresse dentro do limite`);
    console.error('');
  }
  
  // Verificar novamente se ganho ainda é suficiente após ajustes
  if (finalGainNeeded < 0.3) {
    console.error('ℹ️ Após ajustes, ganho ficou muito baixo (<0.3 dB)');
    console.error('   Decisão: Não processar');
    console.error('═══════════════════════════════════════════════════════════');
    return {
      targetLUFS: currentLUFS,
      gainDB: 0,
      shouldProcess: false,
      reason: 'Ganho insuficiente após ajustes de segurança',
      safe: true,
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // 7. MIX CONFIDENCE GATE (para modo HIGH - DESATIVADO)
  // ═══════════════════════════════════════════════════════════
  
  const delta = targetLUFS - currentLUFS;
  
  const confidence = calculateMixConfidence({
    headroom,
    crestFactor,
    delta
  });
  
  console.error('🧠 Mix Confidence:', confidence.toFixed(2));
  
  // Gate DESATIVADO: HIGH mode agora sempre aplica targets competitivos
  // (usuário escolheu HIGH explicitamente, deve receber loudness competitiva)
  // if (modeKey === 'HIGH' && confidence < 0.6) {
  //   console.error('');
  //   console.error('⚠️ HIGH não recomendado para esta mix');
  //   console.error('🔽 Rebaixando automaticamente para MEDIUM');
  //   console.error('   Razão: Mix não possui estabilidade suficiente para modo HIGH');
  //   console.error('   Recalculando com MEDIUM...');
  //   console.error('');
  //   
  //   // Recalcular usando MEDIUM (chamada recursiva)
  //   const mediumDecision = decideGainWithinRange(metrics, 'MEDIUM');
  //   
  //   // Retornar com informações explícitas de downgrade
  //   return {
  //     ...mediumDecision,
  //     modeRequested: 'HIGH',
  //     modeApplied: 'MEDIUM',
  //     downgradeReason: 'Mix não suporta HIGH com segurança'
  //   };
  // }
  
  console.error('');
  
  // ═══════════════════════════════════════════════════════════
  // 8. DECISÃO FINAL
  // ═══════════════════════════════════════════════════════════
  
  console.error('✅ Decisão final:');
  console.error(`   Modo: ${modeConfig.name}`);
  console.error(`   Offset seguro: +${safeOffset.toFixed(1)} LU`);
  console.error(`   LUFS alvo: ${targetLUFS.toFixed(1)} LUFS`);
  console.error(`   Ganho necessário: +${finalGainNeeded.toFixed(1)} dB`);
  console.error(`   Processar: SIM`);
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('');
  
  return {
    targetLUFS: parseFloat(targetLUFS.toFixed(1)),
    gainDB: parseFloat(finalGainNeeded.toFixed(1)),
    shouldProcess: true,
    reason: `Offset seguro de ${safeOffset.toFixed(1)} LU aplicado (modo ${modeConfig.name})`,
    safe: true,
    crestFactorFallback: crestFactorFallback,
    limiterStressEstimate: parseFloat(stressEstimate.toFixed(1)),
    maxStress: maxStress,
    stressAdjusted: stressAdjusted,
    confidenceScore: parseFloat(confidence.toFixed(2)),
    confidenceLabel: confidence < 0.6 ? 'LOW_FOR_HIGH' : 'OK',
    offsetApplied: parseFloat(safeOffset.toFixed(1)),
    mode: modeKey,  // Adicionar mode ao retorno
    modeApplied: modeKey,  // Confirmar mode aplicado
    metrics: {
      currentLUFS,
      truePeak,
      crestFactor,
      headroom
    }
  };
}

/**
 * Analisa arquivo de áudio e retorna métricas necessárias para decisão
 */
async function analyzeAudioMetrics(filePath, execAsync) {
  console.error('🔍 [AUTOMASTER] Analisando métricas do áudio...');
  
  // Usar ffmpeg para extrair métricas reais
  const ffmpegCmd = `ffmpeg -i "${filePath}" -af "loudnorm=print_format=json,astats=metadata=1:reset=1" -f null - 2>&1`;
  
  try {
    const { stdout } = await execAsync(ffmpegCmd, { timeout: 60000 });
    
    // Extrair LUFS
    const lufsMatch = stdout.match(/"input_i"\s*:\s*"([^"]+)"/);
    const lufs = lufsMatch ? parseFloat(lufsMatch[1]) : -20.0;
    
    // Extrair True Peak
    const peakMatch = stdout.match(/"input_tp"\s*:\s*"([^"]+)"/);
    const truePeak = peakMatch ? parseFloat(peakMatch[1]) : -1.0;
    
    // Extrair Crest Factor (aproximação via RMS e Peak)
    const rmsMatch = stdout.match(/RMS level dB:\s*([-\d.]+)/);
    const peakLevelMatch = stdout.match(/Peak level dB:\s*([-\d.]+)/);
    
    let crestFactor = DEFAULT_CREST_FACTOR; // Fallback conservador
    let cfCalculated = false;
    
    if (rmsMatch && peakLevelMatch) {
      const rmsDB = parseFloat(rmsMatch[1]);
      const peakDB = parseFloat(peakLevelMatch[1]);
      const calculatedCF = peakDB - rmsDB;
      
      // Validar se valor calculado é realista (CF tipicamente entre 3 e 25 dB)
      if (!isNaN(calculatedCF) && calculatedCF > 0 && calculatedCF <= 30) {
        crestFactor = calculatedCF;
        cfCalculated = true;
      }
    }
    
    console.error('✅ [AUTOMASTER] Métricas extraídas:');
    console.error(`   LUFS: ${lufs.toFixed(1)}`);
    console.error(`   True Peak: ${truePeak.toFixed(1)} dBTP`);
    console.error(`   Crest Factor: ${crestFactor.toFixed(1)} dB${!cfCalculated ? ' (fallback conservador)' : ''}`);
    
    return {
      lufs,
      truePeak,
      crestFactor,
      success: true
    };
    
  } catch (error) {
    console.error('❌ [AUTOMASTER] Erro ao analisar métricas:', error.message);
    
    // Fallback conservador
    return {
      lufs: -20.0,
      truePeak: -1.0,
      crestFactor: DEFAULT_CREST_FACTOR,
      success: false,
      error: error.message
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * BLOCO 1 — HARD CAPS GLOBAIS
 * ═══════════════════════════════════════════════════════════
 * 
 * Camada final de segurança aplicada APÓS decisão do motor.
 * Garante que targets nunca violem limites físicos/perceptivos absolutos.
 * 
 * Regras:
 * 1. LUFS target nunca > modo cap (LOW=-10, MEDIUM=-9, HIGH=-8)
 * 2. Delta máximo por modo: LOW=5 LU, MEDIUM=7 LU, HIGH=9 LU
 * 3. True Peak alvo sempre <= -1.0 dBTP (margem de segurança)
 * 
 * @param {Object} decision - Decisão do motor (targetLUFS, gainDB, etc)
 * @param {Object} metrics - Métricas originais (currentLUFS, truePeak, etc)
 * @returns {Object} - Decisão ajustada com campos capped, cap_reason
 */
function applyGlobalCaps(decision, metrics) {
  let capped = false;
  let capReason = null;
  let adjustedTarget = decision.targetLUFS;
  let adjustedGain = decision.gainDB;
  
  const currentLUFS = metrics.currentLUFS || metrics.lufs;
  const originalTarget = adjustedTarget;
  const modeKey = decision.modeApplied || decision.mode || 'MEDIUM';
  
  // CAP 1: LUFS dinâmico por modo (substitui cap fixo em -8.0)
  // HIGH mode: ISENÇÃO para preservar loudness competitiva
  // STREAMING mode: Skip (target fixo já aplicado)
  let modeCap = -9.0;  // Default MEDIUM
  let highExtension = 0;
  
  // Skip MODE_CAP para STREAMING (target fixo)
  if (modeKey === 'STREAMING') {
    console.error('');
    console.error('✅ MODE CAP: STREAMING mode - skip (target fixo -14.0 LUFS)');
    console.error('');
  }
  // HIGH mode: ISENÇÃO se target está na faixa competitiva (<-11.5 LUFS)
  else if (modeKey === 'HIGH' && adjustedTarget < -11.5) {
    console.error('');
    console.error('✅ MODE CAP: HIGH mode - ISENÇÃO para loudness competitiva');
    console.error(`   Target calculado: ${adjustedTarget.toFixed(1)} LUFS`);
    console.error('   Target preservado (competitivo, não será limitado)');
    console.error('');
    // Não aplicar modeCap - deixar target como está
  }
  // Outros modos: aplicar modeCap normalmente
  else {
    // Verificar se HIGH mode pode ter extensão dinâmica (fallback se não for competitivo)
    if (modeKey === 'HIGH') {
      const crestFactor = metrics.crestFactor || 0;
      const headroom = (metrics.truePeak !== undefined) ? (-1.0 - metrics.truePeak) : 0;
      if (crestFactor > 12 && headroom > 3) {
        highExtension = Math.min(2.0, crestFactor - 11);
      }
    }
    
    if (modeKey === 'LOW') modeCap = -10.0;
    else if (modeKey === 'MEDIUM') modeCap = -9.0;
    else if (modeKey === 'HIGH') modeCap = -8.0 + highExtension;
    
    if (adjustedTarget > modeCap) {
      console.error('');
      console.error('🚨 MODE CAP: LUFS LIMIT');
      console.error(`   Target calculado: ${adjustedTarget.toFixed(1)} LUFS`);
      console.error(`   Limite do modo ${modeKey}: ${modeCap.toFixed(1)} LUFS`);
      adjustedTarget = modeCap;
      adjustedGain = adjustedTarget - currentLUFS;
      capped = true;
      capReason = 'MODE_CAP';
      console.error(`   Target ajustado: ${adjustedTarget.toFixed(1)} LUFS`);
      console.error('');
    }
  }
  
  // CAP 2: Delta máximo por modo (permite diferenciação entre modos)
  const maxDelta = MAX_DELTA_BY_MODE[modeKey] || MAX_DELTA_BY_MODE.MEDIUM;
  
  const deltaFromOriginal = adjustedTarget - currentLUFS;
  if (deltaFromOriginal > maxDelta) {
    console.error('');
    console.error('🚨 GLOBAL CAP: DELTA LIMIT');
    console.error(`   Delta calculado: ${deltaFromOriginal.toFixed(1)} LU`);
    console.error(`   Limite para modo ${modeKey}: +${maxDelta.toFixed(1)} LU`);
    adjustedTarget = currentLUFS + maxDelta;
    adjustedGain = maxDelta;
    capped = true;
    capReason = capReason ? capReason + '+DELTA_LIMIT' : 'DELTA_LIMIT';
    console.error(`   Target ajustado: ${adjustedTarget.toFixed(1)} LUFS`);
    console.error(`   Ganho ajustado: +${adjustedGain.toFixed(1)} dB`);
    console.error('');
  }
  
  // CAP 3: True Peak alvo máximo (-1.0 dBTP)
  // (Já garantido pela pipeline, mas registrado aqui para consistência)
  const targetTP = -1.0;
  
  // CAP 4: NEVER REDUCE LOUDNESS (target nunca pode ser < input)
  // AutoMaster NUNCA deve deixar uma track mais silenciosa
  // LUFS são negativos: target < input = REDUÇÃO (ex: -14 < -10)
  if (adjustedTarget < currentLUFS) {
    console.error('');
    console.error('🚨 GLOBAL CAP: NEVER REDUCE LOUDNESS');
    console.error(`   Target calculado: ${adjustedTarget.toFixed(1)} LUFS`);
    console.error(`   Input LUFS: ${currentLUFS.toFixed(1)} LUFS`);
    console.error(`   ⚠️ Target would reduce loudness - BLOCKED`);
    adjustedTarget = currentLUFS;
    adjustedGain = 0;
    capped = true;
    capReason = capReason ? capReason + '+NEVER_REDUCE' : 'NEVER_REDUCE';
    console.error(`   Target ajustado: ${adjustedTarget.toFixed(1)} LUFS (= input)`);
    console.error(`   Ganho ajustado: ${adjustedGain.toFixed(1)} dB (bypass)`);
    console.error('');
  }
  
  // Proteção NaN: se target não for finito, forçar bypass
  if (!Number.isFinite(adjustedTarget)) {
    console.error('');
    console.error('⚠️ GLOBAL CAP: NaN/Infinity detected in target');
    console.error(`   Forcing target = input (bypass processing)`);
    adjustedTarget = currentLUFS;
    adjustedGain = 0;
    capped = true;
    capReason = capReason ? capReason + '+NAN_PROTECTION' : 'NAN_PROTECTION';
    console.error('');
  }
  
  if (capped) {
    console.error('✅ Global Caps aplicados com sucesso');
  }
  
  return {
    ...decision,
    targetLUFS: parseFloat(adjustedTarget.toFixed(1)),
    gainDB: parseFloat(adjustedGain.toFixed(1)),
    originalTargetBeforeCaps: originalTarget,
    capped,
    cap_reason: capReason,
    target_tp: targetTP
  };
}

// ═══════════════════════════════════════════════════════════════
// BUILD MASTERING PLAN
// ═══════════════════════════════════════════════════════════════
//
// Função central que unifica toda a lógica de decisão:
//   1. decideGainWithinRange  — target LUFS base
//   2. applyGlobalCaps        — caps de segurança
//   3. Mix Classification     — POOR / MEDIUM / GOOD
//   4. EQ Plan                — boosts dinâmicos (requer bands)
//   5. Highpass Plan          — frequência de corte (requer bands)
//
// Contrato de entrada (metrics):
//   { lufs, truePeak, crestFactor,
//     bands: { sub, bass, mid, highMid, air } | null }
//
// Contrato de saída (MasteringPlan):
//   {
//     targetLUFS,     mixClass,   shouldProcess,
//     eq: { sub_boost, mud_cut, presence_boost, air_boost },
//     highpass_hz,    highpass_poles
//   }
//
// REGRA DE SEGURANÇA: se bands for null ou inválido, todos os
// valores de EQ e highpass usam exatamente os mesmos defaults
// das Fases 7–11. Resultado idêntico ao comportamento anterior.
// ═══════════════════════════════════════════════════════════════

/**
 * Thresholds de energia por banda (dBFS).
 * Calibrados para material musical típico medido via FFmpeg.
 * Bandas estreitas (sub/air) têm valores naturalmente mais baixos.
 *
 * Usados apenas para ajustar EQ em ±0.3–0.5 dB (conservador).
 * Se banda for null → default (comportamento anterior).
 */
const BAND_THRESHOLDS = {
  // sub (20–60 Hz): material típico entre -30 e -20 dBFS
  sub: { high: -22, low: -36 },         // > -22 = sub forte; < -36 = sub fraco

  // bass (60–150 Hz): entre -22 e -14 dBFS
  bass: { high: -15, low: -27 },        // > -15 = bass forte; < -27 = bass fraco

  // mid (150–2000 Hz): faixa mais energética, entre -18 e -10 dBFS
  mid: { high: -12, low: -22 },         // > -12 = mids acumulados

  // highMid (2000–10000 Hz): entre -24 e -16 dBFS
  highMid: { high: -18, low: -30 },     // > -18 = presença ok; < -30 = presença baixa

  // air (10000–20000 Hz): banda mais fraca, entre -40 e -24 dBFS
  air: { high: -26, low: -42 },         // > -26 = ar ok; < -42 = ar fraco
};

/**
 * Determina o plano de EQ para HIGH mode baseado nas bandas.
 *
 * Ajustes máximos conservadores: ±0.5 dB por banda.
 * Se uma banda for null, o campo retorna o valor default (Fase 11).
 *
 * @param {Object|null} bands  Bandas do mini-analyzer (ou null)
 * @returns {Object}           Plano de EQ com 4 campos
 */
function buildEQPlan(bands, strategy = null) {
  // Defaults (Fase 11 preservados como fallback)
  // Nota: presence e air agora aplicados APÓS saturação (post-sat EQ),
  // permitindo ranges maiores sem risco de harshness da saturação.
  let subBoost      = 0.5;   // 80 Hz  (pre-sat)
  let mudCut        = -0.5;  // 300 Hz (pre-sat)
  let presenceBoost = 1.5;   // 4 kHz  (post-sat) — default levemente aumentado
  let airBoost      = 1.0;   // 12 kHz (post-sat) — default levemente aumentado

  if (!bands) {
    // Sem bandas → defaults preservados
    console.error('[PLAN][EQ] bands=null — usando defaults');
    return { sub_boost: subBoost, mud_cut: mudCut, presence_boost: presenceBoost, air_boost: airBoost, source: 'defaults' };
  }

  // ── SUB_BOOST (80 Hz) ──────────────────────────────────────
  // bass forte → boost menor (não engrossar mais)
  // bass fraco → boost maior (compensar carência)
  if (bands.bass && bands.bass.energy_db !== null) {
    const db = bands.bass.energy_db;
    if (db > BAND_THRESHOLDS.bass.high) {
      subBoost = 0.2;   // bass já forte
    } else if (db < BAND_THRESHOLDS.bass.low) {
      subBoost = 0.8;   // bass fraco
    }
  }

  // ── MUD_CUT (300 Hz) ───────────────────────────────────────
  // mid muito acumulado → corte maior para abrir espaço
  if (bands.mid && bands.mid.energy_db !== null) {
    const db = bands.mid.energy_db;
    if (db > BAND_THRESHOLDS.mid.high) {
      mudCut = -1.2;  // mids densos: corte mais efetivo
    }
  }

  // ── PRESENCE_BOOST (4 kHz) — post-sat ─────────────────────
  // Zonas graduadas para resposta proporcional à carência de presence:
  //   > -18 dBFS  : presença ok → boost conservador
  //   -18 a -24   : padrão → 1.5 dB
  //   -24 a -30   : baixa → 2.0 dB
  //   < -30 dBFS  : muito baixa → 2.5 dB
  if (bands.highMid && bands.highMid.energy_db !== null) {
    const db = bands.highMid.energy_db;
    if (db > BAND_THRESHOLDS.highMid.high) {
      presenceBoost = 0.8;   // presença ok
    } else if (db < BAND_THRESHOLDS.highMid.low) {
      presenceBoost = 2.5;   // presença muito baixa
    } else if (db < -24) {
      presenceBoost = 2.0;   // presença baixa
    }
    // entre -18 e -24 → default 1.5 dB
  }

  // ── AIR_BOOST (12 kHz) — post-sat ─────────────────────────
  // Zonas graduadas para resposta proporcional à carência de ar:
  //   > -26 dBFS  : ar ok → boost conservador
  //   -26 a -36   : padrão → 1.0 dB
  //   -36 a -42   : escuro → 2.0 dB
  //   < -42 dBFS  : muito escuro → 2.5 dB
  if (bands.air && bands.air.energy_db !== null) {
    const db = bands.air.energy_db;
    if (db > BAND_THRESHOLDS.air.high) {
      airBoost = 0.5;   // ar ok
    } else if (db < BAND_THRESHOLDS.air.low) {
      airBoost = 2.5;   // escuridão extrema
    } else if (db < -36) {
      airBoost = 2.0;   // escuro
    }
    // entre -26 e -36 → default 1.0 dB
  }

  // Regra de segurança: presence + air não somam mais que 4.0 dB
  // Para evitar excesso de brilho quando ambas as bandas são muito baixas
  if (presenceBoost + airBoost > 4.0) {
    const excess = (presenceBoost + airBoost) - 4.0;
    airBoost = Math.max(0.5, airBoost - excess);
    console.error(`[PLAN][EQ] soma presence+air limitada a 4.0 dB (excesso=${excess.toFixed(1)}dB)`);
  }

  // REFINE: limitar EQ a valores conservadores para não destruir transientes
  if (strategy === 'REFINE') {
    subBoost      = Math.min(subBoost, 0.3);
    mudCut        = Math.max(mudCut, -0.8);
    presenceBoost = Math.min(Math.max(presenceBoost, 0.8), 1.2);
    airBoost      = Math.min(Math.max(airBoost, 0.5), 1.0);
    console.error(`[PLAN][EQ] REFINE caps → sub=${subBoost} mud=${mudCut} presence=${presenceBoost} air=${airBoost}`);
  }

  console.error(`[PLAN][EQ] sub_boost=${subBoost} mud_cut=${mudCut} presence=${presenceBoost} air=${airBoost} (from bands)`);
  return { sub_boost: subBoost, mud_cut: mudCut, presence_boost: presenceBoost, air_boost: airBoost, source: 'bands' };
}

/**
 * Determina intensidade de saturação suave baseada na mixClass.
 *
 * Princípio: mixes mais quietas (POOR) precisam de maior densidade
 * harmônica ao serem masterizadas. O threshold mais baixo aumenta o
 * engajamento do softclipper, criando harmônicos que preenchem o som.
 *
 * Mixes GOOD já têm densidade — threshold conservador evita distorção.
 *
 * @param {string} mixClass  'POOR' | 'MEDIUM' | 'GOOD'
 * @returns {{ threshold: number, output: number, oversample: number, source: string }}
 */
function buildSaturationPlan(mixClass) {
  // HIGH v4 DOUBLE CLIP: dois estágios de saturação/ISP-control
  // Clipper 1 (pré-EQ):  threshold adaptativo por mixClass, output=0.99, oversample=8 (v3 precision)
  //   Trabalha os maiores picos antes do boost de presença/air
  // Clipper 2 (pós-EQ):  threshold=0.96 FIXO, output=0.995, oversample=8 (safety net ISP)
  //   Threshold alto (0.96) = captura apenas ISPs extremos gerados pelo postEQ boost
  //   Não afeta o ganho médio de LUFS que o postEQ adiciona
  const plans = {
    POOR:   { threshold: 0.80, mustApply: true,  description: 'POOR — double-clip agressivo' },
    MEDIUM: { threshold: 0.83, mustApply: false, description: 'MEDIUM — double-clip v3-baseline' },
    GOOD:   { threshold: 0.83, mustApply: false, description: 'GOOD — double-clip v3-baseline' },
  };
  const p = plans[mixClass] || plans.GOOD;
  console.error(`[PLAN][SAT] clip1: threshold=${p.threshold} output=0.99 oversample=8 | clip2: threshold=0.96 output=0.995 oversample=8 (${p.description})`);
  return {
    // Clipper 1 — v3 baseline (threshold 0.83 + high oversample para ISP controle antes do EQ)
    threshold:  p.threshold,
    mustApply:  p.mustApply ?? false,
    output:     0.99,
    oversample: 8,
    // Clipper 2 — safety net ISP após EQ (threshold alto = não mata loudness do postEQ)
    threshold2:  0.96,
    output2:     0.995,
    oversample2: 8,
    source:     'mixClass',
    description: p.description,
  };
}

/**
 * Determina a frequência de corte do highpass baseada nas bandas e mixClass.
 *
 * Lógica:
 *   POOR class → 30 Hz (comportamento Fase 8 preservado)
 *   sub forte  → 35 Hz (liberar mais headroom do infra)
 *   sub fraco  → 22 Hz (preservar o pouco sub disponível)
 *   default    → 25 Hz (comportamento anterior não-POOR)
 *
 * @param {Object|null} bands       Bandas do mini-analyzer
 * @param {string}      mixClass    'POOR' | 'MEDIUM' | 'GOOD'
 * @returns {{ hz: number, poles: number }}
 */
function buildHighpassPlan(bands, mixClass, isRescueMode = false) {
  // RESCUE MODE: sinal clipado — HPF protetor antes do pipeline
  // Sub muito forte (funk/eletrônica): corte leve mas 2-pole para solidez
  // Outros áudios estourados: corte agressivo para liberar headroom máximo
  if (isRescueMode) {
    const subDb = (bands && bands.sub && bands.sub.energy_db !== null)
      ? bands.sub.energy_db
      : -20;
    if (subDb > -10) {
      // Música com grave pesado (funk, eletrônica, trap): preservar punch
      console.error(`[PLAN][HP][RESCUE] sub forte (${subDb.toFixed(1)} dBFS) → highpass 28 Hz 2-pole (preserve punch)`);
      return { hz: 28, poles: 2 };
    } else {
      // Áudio estourado sem grave dominante: HPF agressivo
      console.error(`[PLAN][HP][RESCUE] sinal clipado (${subDb.toFixed(1)} dBFS) → highpass 38 Hz 2-pole (max headroom)`);
      return { hz: 38, poles: 2 };
    }
  }

  // POOR class: sempre 30 Hz 2-pole (Fase 8, inviolável)
  if (mixClass === 'POOR') {
    return { hz: 30, poles: 2 };
  }

  // Sem bandas → padrão não-POOR
  if (!bands || !bands.sub || bands.sub.energy_db === null) {
    return { hz: 25, poles: 1 };
  }

  const subDb = bands.sub.energy_db;
  if (subDb > BAND_THRESHOLDS.sub.high) {
    // Sub muito forte: corte levemente mais alto para liberar headroom
    console.error(`[PLAN][HP] sub forte (${subDb.toFixed(1)} dBFS) → highpass 35 Hz`);
    return { hz: 35, poles: 1 };
  } else if (subDb < BAND_THRESHOLDS.sub.low) {
    // Sub fraco: preservar o que existe
    console.error(`[PLAN][HP] sub fraco (${subDb.toFixed(1)} dBFS) → highpass 22 Hz`);
    return { hz: 22, poles: 1 };
  }

  return { hz: 25, poles: 1 };
}

/**
 * Função central de decisão de masterização.
 *
 * Recebe métricas completas (com ou sem bandas) e retorna
 * um plano determinístico que descreve TODOS os parâmetros
 * de processamento que o DSP deve executar.
 *
 * O DSP (builders no automaster-v1.cjs) passa a ser EXECUTOR PURO
 * do plano — não toma mais nenhuma decisão própria.
 *
 * @param {Object} metrics  Contrato de métricas (lufs, truePeak, crestFactor, bands?)
 * @param {string} mode     Modo: 'STREAMING' | 'LOW' | 'MEDIUM' | 'HIGH'
 * @returns {Object}        MasteringPlan completo
 */
function buildMasteringPlan(metrics, mode, opts = {}) {
  const modeKey = (mode || 'MEDIUM').toUpperCase();
  const isRescueMode = opts.rescueBypass === true;

  console.error('');
  console.error('════════════════════════════════════════════════════════════');
  console.error('🗺️  BUILD MASTERING PLAN');
  console.error(`    Mode: ${modeKey} | bands: ${metrics.bands ? 'YES' : 'NULL'}`);
  console.error('════════════════════════════════════════════════════════════');

  // ─── 1. TARGET LUFS via decision engine ────────────────────
  const decision = decideGainWithinRange(metrics, modeKey, opts);

  if (!decision.shouldProcess) {
    console.error('[PLAN] Motor decidiu NÃO processar:', decision.reason);
    return {
      shouldProcess: false,
      abortReason: decision.reason,
      targetLUFS: metrics.lufs,
      mixClass: null,
      eq: null,
      highpass_hz: 25,
      highpass_poles: 1,
      raw_decision: decision
    };
  }

  // ─── 2. Global Caps ────────────────────────────────────────
  const cappedDecision = applyGlobalCaps(decision, metrics);

  // ─── 3. Mix Classification (centralizada aqui) ─────────────
  const inputLufs = metrics.lufs;
  let mixClass;
  if (inputLufs < -20) mixClass = 'POOR';
  else if (inputLufs < -14) mixClass = 'MEDIUM';
  else mixClass = 'GOOD';

  const MIX_CLASS_TARGETS = { POOR: -14.0, MEDIUM: -11.5, GOOD: -10.0 };

  // REFINE: target = input (zero loudness push)
  const isRefine = decision.strategy === 'REFINE';

  // HIGH v4: target dinâmico baseado em mixClass + Crest Factor
  //
  // POOR: mantém v3 target (-14.0) — material problemático, push agressivo causa distorção
  //
  // MEDIUM/GOOD: CF-based bracketing, respeitando o target v3 como piso (sem regressão)
  //   CF >= 14  (muito dinâmico) → v3 class target (MEDIUM=-11.5, GOOD=-10.0) — garantia de convergência
  //   CF 12-14  (moderado)      → -10.5 LUFS  (+1 LU vs MEDIUM v3, mesmo nível GOOD v3)
  //   CF < 12   (denso)         → -9.5 LUFS   (+2 LU vs MEDIUM, agressivo possível)
  let highModeTarget = MIX_CLASS_TARGETS[mixClass];  // fallback = v3 behavior
  if (modeKey === 'HIGH' && !isRefine) {
    const cf = metrics.crestFactor;
    if (mixClass === 'POOR') {
      highModeTarget = MIX_CLASS_TARGETS.POOR;  // -14.0 — v3 baseline para material muito dinâmico/silencioso
      console.error(`   🔥 HIGH v4 (POOR class, CF=${cf.toFixed(1)}): Target ${highModeTarget} LUFS (v3 baseline)`);
    } else if (cf >= 14) {
      highModeTarget = MIX_CLASS_TARGETS[mixClass];  // v3 sem regressão: MEDIUM=-11.5, GOOD=-10.0
      console.error(`   🔥 HIGH v4 (${mixClass}, CF=${cf.toFixed(1)}≥14): Target ${highModeTarget} LUFS (v3 baseline)`);
    } else if (cf >= 12) {
      highModeTarget = -10.5;
      console.error(`   🔥 HIGH v4 (${mixClass}, CF=${cf.toFixed(1)} 12-14): Target ${highModeTarget} LUFS (+1 LU vs MEDIUM v3)`);
    } else {
      highModeTarget = -9.5;
      console.error(`   🔥 HIGH v4 (${mixClass}, CF=${cf.toFixed(1)}<12, denso): Target ${highModeTarget} LUFS (agressivo)`);
    }
  }

  // EXTREME MODE: target mais agressivo que HIGH
  // Objettivo: -10 a -8 LUFS — loudness de competição
  // POOR: target conservador (-13.0) para não destruir material problemático
  // CF >= 14 (muito dinâmico): -10.5 — precisa de mais headroom para o pipeline agressivo
  // CF 12-14 (moderado):       -9.5
  // CF < 12  (denso):          -8.5 — material já comprimido aguenta o pipeline
  let extremeModeTarget = MIX_CLASS_TARGETS[mixClass];  // fallback
  if (modeKey === 'EXTREME' && !isRefine) {
    const cf = metrics.crestFactor;
    if (mixClass === 'POOR') {
      extremeModeTarget = -13.0;
      console.error(`   ⚡ EXTREME (POOR class, CF=${cf.toFixed(1)}): Target ${extremeModeTarget} LUFS (conservador — material problemático)`);
    } else if (cf >= 14) {
      extremeModeTarget = -10.5;
      console.error(`   ⚡ EXTREME (${mixClass}, CF=${cf.toFixed(1)}≥14): Target ${extremeModeTarget} LUFS (dinâmico — headroom necessário)`);
    } else if (cf >= 12) {
      extremeModeTarget = -9.5;
      console.error(`   ⚡ EXTREME (${mixClass}, CF=${cf.toFixed(1)} 12-14): Target ${extremeModeTarget} LUFS`);
    } else if (cf >= 8) {
      extremeModeTarget = -9.0;
      console.error(`   ⚡ EXTREME (${mixClass}, CF=${cf.toFixed(1)} 8-12): Target ${extremeModeTarget} LUFS (competição — loudness máximo)`);
    } else {
      // CF < 8: material já muito denso — ganho excessivo cria ISPs incontroláveis.
      // -9.5 ainda é mais alto que HIGH (~-10.3) mantendo o benefício do modo EXTREME.
      extremeModeTarget = -9.5;
      console.error(`   ⚡ EXTREME (${mixClass}, CF=${cf.toFixed(1)}<8, ultra-denso): Target ${extremeModeTarget} LUFS (ISP-safe ceiling)`);
    }
  }

  const mixClassTarget = modeKey === 'HIGH' ? highModeTarget
    : modeKey === 'EXTREME' ? extremeModeTarget
    : MIX_CLASS_TARGETS[mixClass];

  // Override do target pelo mix class (Fase 7) — REFINE preserva target = input
  const finalTarget = isRefine ? metrics.lufs
    : (modeKey === 'HIGH' || modeKey === 'EXTREME') ? mixClassTarget : cappedDecision.targetLUFS;

  console.error(`[PLAN] Mix Class: ${mixClass} → target ${finalTarget.toFixed(1)} LUFS`);

  // ─── 4. EQ Plan ────────────────────────────────────────────
  // Para HIGH e EXTREME: sub_boost, mud_cut (pre-sat) + presence_boost, air_boost (post-sat)
  const eqPlan = (modeKey === 'HIGH' || modeKey === 'EXTREME')
    ? buildEQPlan(metrics.bands || null, isRefine ? 'REFINE' : null)
    : null;

  // ─── 5. Highpass Plan ──────────────────────────────────────
  // Para HIGH e EXTREME (isRescueMode altera frequências de corte)
  const hpPlan = (modeKey === 'HIGH' || modeKey === 'EXTREME')
    ? buildHighpassPlan(metrics.bands || null, mixClass, isRescueMode)
    : { hz: 25, poles: 1 };

  console.error(`[PLAN] Highpass: ${hpPlan.hz} Hz (${hpPlan.poles}-pole) | MixClass: ${mixClass}`);

  // ─── 6. Saturation Plan ────────────────────────────────────
  // REFINE: NÃO usa softclip (evitar coloração e distorção)
  // HIGH e EXTREME: threshold condicional por mixClass
  const saturationPlan = ((modeKey === 'HIGH' || modeKey === 'EXTREME') && !isRefine)
    ? buildSaturationPlan(mixClass)
    : null;

  return {
    shouldProcess: true,
    strategy: isRefine ? 'REFINE' : undefined,
    targetLUFS: finalTarget,
    mixClass,
    mixClassStrategy: isRefine ? 'REFINE'
      : ({ POOR: 'CONSERVATIVE', MEDIUM: 'MODERATE', GOOD: 'AGGRESSIVE' }[mixClass]),
    eq: eqPlan,
    saturation: saturationPlan,
    highpass_hz: hpPlan.hz,
    highpass_poles: hpPlan.poles,
    raw_decision: cappedDecision,
    mode: modeKey,
    bandsSource: metrics.bands ? 'mini-analyzer' : 'none'
  };
}

module.exports = {
  decideGainWithinRange,
  analyzeAudioMetrics,
  applyGlobalCaps,
  buildMasteringPlan,
  buildSaturationPlan,
  MODES,
  MAX_GAIN_DB,
  MAX_LIMITER_STRESS,
  MAX_DELTA_BY_MODE,
  MAX_DELTA_LUFS,
  DEFAULT_CREST_FACTOR
};
