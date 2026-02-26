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
  HIGH: 4.5,
  HIGH_EXTENDED: 5.2  // Para mixes com CF > 12 e headroom > 3 dB
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
function decideGainWithinRange(metrics, mode = 'MEDIUM') {
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
  
  // Headroom crítico (<0.8 dB) - evitar processamento por segurança
  if (headroom < 0.8) {
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
    console.error('   Reduzindo offset para proteger qualidade...');
    
    // Reduzir offset para caber no limite de estresse
    const reduction = stressEstimate - maxStress;
    safeOffset -= reduction;
    
    // Recalcular target
    targetLUFS = currentLUFS + safeOffset;
    finalGainNeeded = targetLUFS - currentLUFS;
    
    stressAdjusted = true;
    
    console.error(`   Offset reduzido: ${safeOffset.toFixed(1)} LU`);
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

module.exports = { 
  decideGainWithinRange, 
  analyzeAudioMetrics, 
  applyGlobalCaps,
  MODES, 
  MAX_GAIN_DB, 
  MAX_LIMITER_STRESS,
  MAX_DELTA_BY_MODE,
  MAX_DELTA_LUFS, 
  DEFAULT_CREST_FACTOR 
};
