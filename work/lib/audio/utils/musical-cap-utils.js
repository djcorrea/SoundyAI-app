// 🎯 MUSICAL CAP UTILS - Funções para aplicar caps musicais seguros
// Reutilizado em referenceComparison e suggestions para consistência

/**
 * � Gera anotação educativa inteligente para caps
 * Fornece sugestões práticas em vez de valores impossíveis
 * 
 * @param {number} deltaReal - Delta real detectado
 * @param {number} cappedValue - Valor com cap aplicado
 * @returns {string} Anotação educativa prática
 */
function generateEducationalNote(deltaReal, cappedValue) {
  const absDelta = Math.abs(deltaReal);
  const direction = deltaReal > 0 ? 'aumentar' : 'diminuir';
  const eqDirection = deltaReal > 0 ? 'boostar' : 'cortar';
  
  // Categorizar a diferença para sugestões graduais
  if (absDelta <= 8) {
    // Diferença pequena: sugestão de 3-4 dB como primeiro passo
    return `experimente ${direction} entre 3-4 dB como primeiro passo`;
  } else if (absDelta <= 15) {
    // Diferença média: sugestão de 4-6 dB em etapas
    return `${eqDirection} gradualmente: comece com 4-6 dB, depois ajuste conforme o resultado`;
  } else if (absDelta <= 25) {
    // Diferença grande: abordagem em etapas
    return `diferença grande detectada: ${eqDirection} em etapas de 4-6 dB, não tudo de uma vez`;
  } else {
    // Diferença muito grande: sugestão de redesign
    return `diferença muito significativa: considere reprocessar/regravar esta banda ou ${eqDirection} gradualmente em múltiplas sessões`;
  }
}

/**
 * �🎯 Aplica cap musical de ±6 dB com anotação educativa
 * Garante que tanto referenceComparison quanto suggestions falem a mesma língua (EQ real)
 * 
 * @param {number} delta - Delta bruto calculado (target - value ou measured - target)
 * @returns {Object} Objeto com valor seguro, note e delta_real no formato padrão
 */
function applyMusicalCap(delta) {
  // Validação de entrada
  if (typeof delta !== 'number' || !isFinite(delta)) {
    return {
      value: 0,
      note: null,
      delta_real: delta,
      wasCapped: false
    };
  }
  
  const maxDelta = 6;
  
  // Se excede +6 dB, aplica cap positivo
  if (delta > maxDelta) {
    return {
      value: maxDelta,
      note: generateEducationalNote(delta, maxDelta),
      delta_real: delta,
      wasCapped: true
    };
  }
  
  // Se excede -6 dB, aplica cap negativo  
  if (delta < -maxDelta) {
    return {
      value: -maxDelta,
      note: generateEducationalNote(delta, -maxDelta),
      delta_real: delta,
      wasCapped: true
    };
  }
  
  // Se está dentro do limite seguro (±6 dB), retorna valor exato
  return {
    value: delta,
    note: null,
    delta_real: delta,
    wasCapped: false
  };
}

/**
 * 🎯 Formatar delta para exibição com cap musical aplicado
 * Função helper para formatar deltas de forma consistente
 * 
 * @param {number} delta - Delta bruto
 * @param {string} unit - Unidade (dB, %, LUFS, etc.)
 * @returns {string} Delta formatado com anotação se necessário
 */
function formatDeltaWithCap(delta, unit = 'dB') {
  const capped = applyMusicalCap(delta);
  
  if (!capped.wasCapped) {
    // Valor dentro do limite seguro - exibe valor exato
    const sign = capped.value >= 0 ? '+' : '';
    return `${sign}${capped.value.toFixed(1)} ${unit}`;
  }
  
  // Valor foi limitado - exibe anotação educativa
  return capped.annotation;
}

/**
 * 🎯 Aplicar cap musical em referenceComparison (bandas espectrais)
 * Modifica os dados de comparação para incluir delta_shown com cap e anotação
 * 
 * @param {Array} referenceComparison - Array de comparações de referência
 * @returns {Array} Array modificado com delta_shown, delta_real e note
 */
function applyMusicalCapToReference(referenceComparison) {
  if (!Array.isArray(referenceComparison)) {
    return referenceComparison;
  }
  
  return referenceComparison.map(item => {
    // Só aplicar cap em bandas espectrais (identificadas pela categoria)
    if (item.category === 'spectral_bands' && 
        typeof item.value === 'number' && 
        typeof item.ideal === 'number') {
      
      // Calcular delta bruto (ideal - valor atual)
      const deltaRaw = item.ideal - item.value;
      
      // Aplicar cap musical
      const capped = applyMusicalCap(deltaRaw);
      
      return {
        ...item,
        delta_real: capped.delta_real,     // Valor bruto para debug
        delta_shown: capped.value,         // Valor exibido com cap
        note: capped.note,                 // Observação caso tenha sido capado
        delta_capped: capped.wasCapped     // Flag para indicar se foi limitado
      };
    }
    
    // Para outras métricas (LUFS, etc.), manter comportamento original
    return item;
  });
}

export {
  applyMusicalCap,
  formatDeltaWithCap,
  applyMusicalCapToReference
};

console.log('🎯 Musical Cap Utils carregado - Caps seguros para referenceComparison e suggestions');