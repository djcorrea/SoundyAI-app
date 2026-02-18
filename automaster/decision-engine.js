/**
 * ═════════════════════════════════════════════════════════════
 * AUTOMASTER V1 - MOTOR DE DECISÃO INTELIGENTE
 * ═════════════════════════════════════════════════════════════
 * 
 * Sistema conservador que decide LUFS alvo baseado em métricas
 * técnicas reais do áudio, sem dependência de gênero musical.
 * 
 * Prioriza qualidade sobre loudness máxima.
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
  // 1. EXTRAÇÃO DE MÉTRICAS
  // ═══════════════════════════════════════════════════════════
  const currentLUFS = parseFloat(metrics.lufs) || -20.0;
  const truePeak = parseFloat(metrics.truePeak) || -1.0;
  const crestFactor = parseFloat(metrics.crestFactor) || 8.0;
  
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
  console.log(`   Crest Factor: ${crestFactor.toFixed(1)} dB`);
  console.log('');
  console.log(`🎚️ Modo escolhido: ${modeConfig.name}`);
  console.log(`   Range permitido: ${modeConfig.minLUFS} a ${modeConfig.maxLUFS} LUFS`);
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
  // 5. GARANTIR QUE NUNCA REDUZ LOUDNESS
  // ═══════════════════════════════════════════════════════════
  
  if (targetLUFS < currentLUFS) {
    console.log('🛡️  Target ajustado para nunca reduzir loudness');
    targetLUFS = currentLUFS + 0.5; // Garantir ganho mínimo de 0.5 dB
  }
  
  // Limitar ao máximo do range
  targetLUFS = Math.min(targetLUFS, modeConfig.maxLUFS);
  
  const gainNeeded = targetLUFS - currentLUFS;
  
  // ═══════════════════════════════════════════════════════════
  // 6. DECISÃO FINAL
  // ═══════════════════════════════════════════════════════════
  
  console.log('');
  console.log('✅ Decisão final:');
  console.log(`   LUFS alvo: ${targetLUFS.toFixed(1)} LUFS`);
  console.log(`   Ganho necessário: ${gainNeeded > 0 ? '+' : ''}${gainNeeded.toFixed(1)} dB`);
  console.log(`   Processar: ${gainNeeded > 0.3 ? 'SIM' : 'NÃO (ganho insignificante)'}`);
  console.log(`   Razão: ${reasoning}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  return {
    targetLUFS: parseFloat(targetLUFS.toFixed(1)),
    gainDB: parseFloat(gainNeeded.toFixed(1)),
    shouldProcess: gainNeeded > 0.3, // Só processar se ganho >= 0.3 dB
    reason: reasoning,
    safe: true,
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
    
    let crestFactor = 8.0; // Default conservador
    if (rmsMatch && peakLevelMatch) {
      const rmsDB = parseFloat(rmsMatch[1]);
      const peakDB = parseFloat(peakLevelMatch[1]);
      crestFactor = peakDB - rmsDB;
    }
    
    console.log('✅ [AUTOMASTER] Métricas extraídas:');
    console.log(`   LUFS: ${lufs.toFixed(1)}`);
    console.log(`   True Peak: ${truePeak.toFixed(1)} dBTP`);
    console.log(`   Crest Factor: ${crestFactor.toFixed(1)} dB`);
    
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
      crestFactor: 8.0,
      success: false,
      error: error.message
    };
  }
}

export { decideGainWithinRange, analyzeAudioMetrics, MODES };
