// 🎯 MUSICAL CAP UTILS - Funções para aplicar caps musicais seguros
// Reutilizado em referenceComparison e suggestions para consistência

/**
 * 🎯 Aplica cap musical de ±6 dB com anotação educativa
 * Garante que tanto referenceComparison quanto suggestions falem a mesma língua (EQ real)
 * 
 * @param {number} delta - Delta bruto calculado (target - value ou measured - target)
 * @returns {Object} Objeto com valor seguro e anotação educativa
 */
function applyMusicalCap(delta) {
  // Validação de entrada
  if (typeof delta !== 'number' || !isFinite(delta)) {
    return {
      value: 0,
      annotation: null,
      wasCapped: false,
      originalValue: delta
    };
  }
  
  const absDelta = Math.abs(delta);
  const signal = delta >= 0 ? 1 : -1;
  
  // Se está dentro do limite seguro (±6 dB), retorna valor exato
  if (absDelta <= 6) {
    const deltaShown = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} dB`;
    return {
      value: delta,
      annotation: null,
      wasCapped: false,
      originalValue: delta,
      deltaShown: deltaShown
    };
  }
  
  // Se excede ±6 dB, aplica cap e adiciona anotação educativa
  const cappedValue = signal * 6.0;
  const annotation = `ajuste seguro: ${cappedValue >= 0 ? '+' : ''}${cappedValue.toFixed(1)} dB (diferença real detectada: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} dB)`;
  
  return {
    value: cappedValue,
    annotation: annotation,
    wasCapped: true,
    originalValue: delta,
    deltaShown: annotation  // Para valores limitados, deltaShown é a anotação educativa
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
 * @returns {Array} Array modificado com delta_shown aplicado
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
      
      // Calcular delta bruto (target - valor atual)
      const deltaRaw = item.ideal - item.value;
      
      // Aplicar cap musical
      const capped = applyMusicalCap(deltaRaw);
      
      return {
        ...item,
        delta_shown: capped.deltaShown,
        delta_raw: deltaRaw,  // Manter delta bruto para auditoria
        delta_capped: capped.wasCapped
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