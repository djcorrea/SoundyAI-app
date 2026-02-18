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
 * Modos disponíveis com ranges de LUFS permitidos
 */
const MODES = {
  LOW: {
    name: 'Suave',
    minLUFS: -15.0,
    maxLUFS: -13.5,
    description: 'Masterização conservadora, preserva dinâmica máxima'
  },
  MEDIUM: {
    name: 'Balanceado',
    minLUFS: -14.0,
    maxLUFS: -12.5,
    description: 'Equilíbrio entre loudness e qualidade'
  },
  HIGH: {
    name: 'Impacto',
    minLUFS: -12.5,
    maxLUFS: -9.5,
    description: 'Loudness comercial, requer mix bem preparado'
  }
};

/**
 * Limites máximos de ganho por modo (em dB)
 * Previne ganhos excessivos que causam pumping e degradação
 */
const MAX_GAIN_DB = {
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
  LOW: 1.5,
  MEDIUM: 3.0,
  HIGH: 4.5
};

/**
 * Crest factor padrão conservador para fallback
 * Usado quando CF não pode ser calculado com confiança
 */
const DEFAULT_CREST_FACTOR = 7.0;

/**
 * Analisa métricas técnicas e decide LUFS alvo dentro do range do modo.
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
  
  // ═══════════════════════════════════════════════════════════
  // 1. EXTRAÇÃO E VALIDAÇÃO DE MÉTRICAS
  // ═══════════════════════════════════════════════════════════
  const currentLUFS = parseFloat(metrics.lufs) || -20.0;
  const truePeak = parseFloat(metrics.truePeak) || -1.0;
  
  // Validação segura de Crest Factor
  let crestFactor = parseFloat(metrics.crestFactor);
  let crestFactorFallback = false;
  
  if (isNaN(crestFactor) || crestFactor === null || crestFactor <= 0 || crestFactor > 30) {
    console.log('⚠️  Crest Factor inválido ou suspeito, usando fallback conservador');
    crestFactor = DEFAULT_CREST_FACTOR;
    crestFactorFallback = true;
  }
  
  // Calcular headroom disponível
  const headroom = Math.abs(truePeak); // Se truePeak = -1.5, headroom = 1.5 dB
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎯 [AUTOMASTER] MOTOR DE DECISÃO - Análise de Viabilidade');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Métricas de entrada:');
  console.log(`   LUFS atual: ${currentLUFS.toFixed(1)} LUFS`);
  console.log(`   True Peak: ${truePeak.toFixed(1)} dBTP`);
  console.log(`   Headroom: ${headroom.toFixed(1)} dB`);
  console.log(`   Crest Factor: ${crestFactor.toFixed(1)} dB${crestFactorFallback ? ' (fallback)' : ''}`);
  console.log('');
  console.log(`🎚️ Modo escolhido: ${modeConfig.name}`);
  console.log(`   Range permitido: ${modeConfig.minLUFS} a ${modeConfig.maxLUFS} LUFS`);
  console.log(`   Max ganho permitido: ${MAX_GAIN_DB[mode.toUpperCase()]} dB`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════
  // 2. REGRAS DE SEGURANÇA (garantir que nunca piora)
  // ═══════════════════════════════════════════════════════════
  
  // REGRA 1: Nunca reduzir loudness (música já está no range ou acima)
  if (currentLUFS >= modeConfig.maxLUFS) {
    console.log('⚠️  Áudio já está no limite superior do modo');
    console.log('   Decisão: Manter loudness original (sem processamento)');
    console.log('═══════════════════════════════════════════════════════════');
    return {
      targetLUFS: currentLUFS,
      gainDB: 0,
      shouldProcess: false,
      reason: 'Áudio já está suficientemente alto para o modo escolhido',
      safe: true,
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }
  
  // REGRA 2: Headroom crítico (<1 dB) - ser extremamente conservador
  if (headroom < 1.0) {
    console.log('🚨 Headroom crítico detectado (<1 dB)');
    console.log('   Decisão: Usar mínimo do range para evitar clipping');
    const safeLUFS = Math.max(modeConfig.minLUFS, currentLUFS);
    const gainNeeded = safeLUFS - currentLUFS;
    
    console.log(`   LUFS alvo: ${safeLUFS.toFixed(1)} LUFS`);
    console.log(`   Ganho necessário: ${gainNeeded > 0 ? '+' : ''}${gainNeeded.toFixed(1)} dB`);
    console.log('═══════════════════════════════════════════════════════════');
    
    return {
      targetLUFS: safeLUFS,
      gainDB: gainNeeded,
      shouldProcess: gainNeeded > 0.5, // Só processar se ganho for significativo
      reason: 'Headroom limitado - abordagem conservadora',
      safe: true,
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // 3. DECISÃO BASEADA EM CREST FACTOR
  // ═══════════════════════════════════════════════════════════
  
  let targetLUFS;
  let reasoning = '';
  
  if (crestFactor < 6.0) {
    // Mix já muito comprimido - ser conservador
    console.log('📊 Mix com dinâmica baixa (CF < 6)');
    targetLUFS = modeConfig.minLUFS + (modeConfig.maxLUFS - modeConfig.minLUFS) * 0.2;
    reasoning = 'Mix já comprimido - limitando ganho para preservar qualidade';
    
  } else if (crestFactor > 12.0) {
    // Mix muito dinâmico - pode receber mais ganho
    console.log('📊 Mix com dinâmica alta (CF > 12)');
    targetLUFS = modeConfig.minLUFS + (modeConfig.maxLUFS - modeConfig.minLUFS) * 0.8;
    reasoning = 'Mix dinâmico - permitindo ganho maior sem risco';
    
  } else {
    // Crest factor normal (6-12 dB) - usar meio do range
    console.log('📊 Mix com dinâmica normal (CF 6-12)');
    const position = (crestFactor - 6.0) / 6.0; // Normaliza 6-12 para 0-1
    targetLUFS = modeConfig.minLUFS + (modeConfig.maxLUFS - modeConfig.minLUFS) * (0.3 + position * 0.4);
    reasoning = 'Mix balanceado - usando centro do range';
  }
  
  // ═══════════════════════════════════════════════════════════
  // 4. AJUSTE POR HEADROOM DISPONÍVEL
  // ═══════════════════════════════════════════════════════════
  
  if (headroom < 3.0) {
    console.log('⚠️  Headroom limitado (<3 dB) - reduzindo target');
    // Reduzir target proporcionalmente ao headroom disponível
    const reduction = (3.0 - headroom) * 0.5; // Cada dB de headroom faltando reduz 0.5 dB do target
    targetLUFS -= reduction;
    reasoning += ' + ajuste por headroom limitado';
  }
  
  // ═══════════════════════════════════════════════════════════
  // 5. REGRA DE NÃO FORÇAR GANHO ARTIFICIAL
  // ═══════════════════════════════════════════════════════════
  
  if (targetLUFS <= currentLUFS) {
    console.log('🛡️  Target calculado não aumenta loudness');
    console.log('   Decisão: Retornar áudio original (sem processamento)');
    console.log('═══════════════════════════════════════════════════════════');
    return {
      targetLUFS: currentLUFS,
      gainDB: 0,
      shouldProcess: false,
      reason: 'Target calculado não justifica processamento',
      safe: true,
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }
  
  // Limitar ao máximo do range
  targetLUFS = Math.min(targetLUFS, modeConfig.maxLUFS);
  
  let gainNeeded = targetLUFS - currentLUFS;
  
  // ═══════════════════════════════════════════════════════════
  // 6. LIMITE DE GANHO MÁXIMO POR MODO
  // ═══════════════════════════════════════════════════════════
  
  const maxGain = MAX_GAIN_DB[mode.toUpperCase()] || MAX_GAIN_DB.MEDIUM;
  
  if (gainNeeded > maxGain) {
    console.log(`⚠️  Ganho calculado (${gainNeeded.toFixed(1)} dB) excede limite do modo (${maxGain} dB)`);
    console.log('   Ajustando target para respeitar limite de ganho...');
    
    // Reduzir targetLUFS para caber no limite de ganho
    targetLUFS = currentLUFS + maxGain;
    gainNeeded = maxGain;
    reasoning += ' + ajustado para limite de ganho do modo';
    
    console.log(`   Novo target: ${targetLUFS.toFixed(1)} LUFS (ganho ${gainNeeded.toFixed(1)} dB)`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // 7. GATE EXTRA PARA MODO HIGH (proteção de transientes)
  // ═══════════════════════════════════════════════════════════
  
  if (mode.toUpperCase() === 'HIGH' && targetLUFS > -11.0) {
    // Targets acima de -11 LUFS só são permitidos se o mix for robusto
    const isRobustMix = crestFactor >= 8.0 && headroom >= 1.5;
    
    if (!isRobustMix) {
      console.log('🚨 GATE HIGH: Target acima de -11 LUFS requer mix robusto');
      console.log(`   Crest Factor: ${crestFactor.toFixed(1)} dB (mín: 8.0)`);
      console.log(`   Headroom: ${headroom.toFixed(1)} dB (mín: 1.5)`);
      console.log('   Limitando target para -11.0 LUFS para preservar transientes');
      
      targetLUFS = Math.min(targetLUFS, -11.0);
      targetLUFS = Math.max(targetLUFS, -12.5); // Não abaixo do mínimo do range HIGH
      gainNeeded = targetLUFS - currentLUFS;
      reasoning += ' + limitado por gate HIGH (proteção de transientes)';
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // 8. ESTRESSE DO LIMITER (previne pumping e degradação)
  // ═══════════════════════════════════════════════════════════
  
  // Calcular quanto o limiter terá que trabalhar além do headroom
  let stressEstimate = gainNeeded - Math.max(headroom, 0);
  const maxStress = MAX_LIMITER_STRESS[mode.toUpperCase()] || MAX_LIMITER_STRESS.MEDIUM;
  let stressAdjusted = false;
  
  console.log('');
  console.log('🔬 Análise de estresse do limiter:');
  console.log(`   Ganho necessário: ${gainNeeded.toFixed(1)} dB`);
  console.log(`   Headroom disponível: ${headroom.toFixed(1)} dB`);
  console.log(`   Estresse estimado: ${stressEstimate.toFixed(1)} dB`);
  console.log(`   Limite de estresse: ${maxStress} dB`);
  
  if (stressEstimate > maxStress) {
    console.log('');
    console.log(`⚠️  ESTRESSE EXCESSIVO: ${stressEstimate.toFixed(1)} dB > ${maxStress} dB`);
    console.log('   Ajustando target para reduzir trabalho do limiter...');
    
    // Reduzir target iterativamente até estresse caber no limite
    let iterations = 0;
    const maxIterations = 20;
    
    while (stressEstimate > maxStress && iterations < maxIterations) {
      // Reduzir target em 0.2 dB por iteração
      targetLUFS -= 0.2;
      
      // Garantir que não cai abaixo do mínimo do range
      if (targetLUFS < modeConfig.minLUFS) {
        targetLUFS = modeConfig.minLUFS;
        break;
      }
      
      // Recalcular ganho e estresse
      gainNeeded = targetLUFS - currentLUFS;
      stressEstimate = gainNeeded - Math.max(headroom, 0);
      
      iterations++;
    }
    
    stressAdjusted = true;
    reasoning += ' + ajustado por limite de estresse do limiter';
    
    console.log(`   Iterações: ${iterations}`);
    console.log(`   Novo target: ${targetLUFS.toFixed(1)} LUFS`);
    console.log(`   Novo ganho: ${gainNeeded.toFixed(1)} dB`);
    console.log(`   Novo estresse: ${stressEstimate.toFixed(1)} dB ✅`);
  } else {
    console.log(`   ✅ Estresse dentro do limite (${stressEstimate.toFixed(1)} <= ${maxStress})`);
  }
  
  // Regra específica para modo HIGH: evitar targets extremos com ganho alto
  if (mode.toUpperCase() === 'HIGH' && gainNeeded > 4.0) {
    console.log('');
    console.log('⚠️  MODO HIGH com ganho alto (>4 dB)');
    console.log('   Limitando target mínimo a -10.5 LUFS para evitar modo destrutivo');
    
    if (targetLUFS < -10.5) {
      targetLUFS = Math.max(targetLUFS, -10.5);
      targetLUFS = Math.min(targetLUFS, -10.5); // Clamp exato em -10.5
      gainNeeded = targetLUFS - currentLUFS;
      stressEstimate = gainNeeded - Math.max(headroom, 0);
      reasoning += ' + limitado por proteção HIGH extremo';
      
      console.log(`   Target ajustado: ${targetLUFS.toFixed(1)} LUFS`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // 9. LIMITE ABSOLUTO DE SEGURANÇA (ganho insignificante)
  // ═══════════════════════════════════════════════════════════
  
  if (gainNeeded < 0.3) {
    console.log('ℹ️  Ganho necessário muito baixo (<0.3 dB)');
    console.log('   Decisão: Não processar (evita artefatos desnecessários)');
    console.log('═══════════════════════════════════════════════════════════');
    return {
      targetLUFS: currentLUFS,
      gainDB: 0,
      shouldProcess: false,
      reason: 'Ganho insuficiente para justificar processamento',
      safe: true,
      metrics: { currentLUFS, truePeak, crestFactor, headroom }
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // 9. DECISÃO FINAL
  // ═══════════════════════════════════════════════════════════
  
  console.log('');
  console.log('✅ Decisão final:');
  console.log(`   LUFS alvo: ${targetLUFS.toFixed(1)} LUFS`);
  console.log(`   Ganho necessário: +${gainNeeded.toFixed(1)} dB`);
  console.log(`   Processar: SIM`);
  console.log(`   Razão: ${reasoning}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  return {
    targetLUFS: parseFloat(targetLUFS.toFixed(1)),
    gainDB: parseFloat(gainNeeded.toFixed(1)),
    shouldProcess: true,
    reason: reasoning,
    safe: true,
    crestFactorFallback: crestFactorFallback,
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
  console.log('🔍 [AUTOMASTER] Analisando métricas do áudio...');
  
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
    
    console.log('✅ [AUTOMASTER] Métricas extraídas:');
    console.log(`   LUFS: ${lufs.toFixed(1)}`);
    console.log(`   True Peak: ${truePeak.toFixed(1)} dBTP`);
    console.log(`   Crest Factor: ${crestFactor.toFixed(1)} dB${!cfCalculated ? ' (fallback conservador)' : ''}`);
    
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

export { decideGainWithinRange, analyzeAudioMetrics, MODES, MAX_GAIN_DB, DEFAULT_CREST_FACTOR };
