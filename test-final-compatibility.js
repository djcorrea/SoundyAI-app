/**
 * TESTE FINAL DE COMPATIBILIDADE
 * Valida se todas as correções foram aplicadas corretamente
 */

console.log('🔍 TESTE FINAL DE COMPATIBILIDADE - Pipeline → JSON → Frontend');
console.log('Verificando se todas as correções foram implementadas...\n');

// Mock do que o core-metrics vai produzir
const mockCoreMetrics = {
  // Novos analyzers
  dcOffset: { 
    value: { left: 0.001, right: -0.002 },
    severity: 'Low',
    detailed: { L: 0.001, R: -0.002 }
  },
  dominantFrequencies: { 
    value: [440, 880, 1320],
    detailed: { primary: 440, secondary: [880, 1320] }
  },
  spectralUniformity: { 
    value: 0.85,
    unit: 'ratio',
    detailed: { variance: 0.85, distribution: 'Good' }
  },
  
  // Métricas existentes que precisam de alias
  rms: { avgLoudness: -18.5 },
  stereo: { 
    correlation: 0.8, 
    balance: 0.1, 
    width: 0.7,
    isMonoCompatible: true // Precisa virar monoCompatibility
  },
  spectralBands: {
    sub: 0.1, bass: 0.2, lowMid: 0.3, // lowMid precisa virar mids
    mid: 0.4, highMid: 0.35, // highMid precisa virar treble  
    presence: 0.3, brilliance: 0.25
  }
};

// Simular a função extractTechnicalData
function extractTechnicalData(coreMetrics) {
  const technicalData = {};
  
  // ===== DC Offset =====
  if (coreMetrics.dcOffset && typeof coreMetrics.dcOffset === 'object') {
    technicalData.dcOffset = {
      value: coreMetrics.dcOffset.value,
      severity: coreMetrics.dcOffset.severity || 'Unknown',
      detailed: {
        L: coreMetrics.dcOffset.detailed?.L || coreMetrics.dcOffset.value?.left || 0,
        R: coreMetrics.dcOffset.detailed?.R || coreMetrics.dcOffset.value?.right || 0
      }
    };
  }

  // ===== Dominant Frequencies =====
  if (coreMetrics.dominantFrequencies && typeof coreMetrics.dominantFrequencies === 'object') {
    technicalData.dominantFrequencies = {
      value: coreMetrics.dominantFrequencies.value,
      unit: coreMetrics.dominantFrequencies.unit || 'Hz',
      detailed: {
        primary: coreMetrics.dominantFrequencies.detailed?.primary || 
                 (Array.isArray(coreMetrics.dominantFrequencies.value) ? coreMetrics.dominantFrequencies.value[0] : null),
        secondary: coreMetrics.dominantFrequencies.detailed?.secondary || 
                   (Array.isArray(coreMetrics.dominantFrequencies.value) ? coreMetrics.dominantFrequencies.value.slice(1) : [])
      }
    };
  }

  // ===== Spectral Uniformity =====
  if (coreMetrics.spectralUniformity && typeof coreMetrics.spectralUniformity === 'object') {
    technicalData.spectralUniformity = {
      value: coreMetrics.spectralUniformity.value,
      unit: coreMetrics.spectralUniformity.unit || 'ratio',
      detailed: {
        variance: coreMetrics.spectralUniformity.value,
        distribution: coreMetrics.spectralUniformity.detailed?.distribution || 'Unknown',
        analysis: 'Spectral analysis completed'
      }
    };
  }

  // ===== RMS com alias =====
  if (coreMetrics.rms && typeof coreMetrics.rms === 'object') {
    technicalData.rms = coreMetrics.rms;
    // Alias para Volume Médio
    if (coreMetrics.rms.avgLoudness !== undefined) {
      technicalData.avgLoudness = coreMetrics.rms.avgLoudness;
    }
  }

  // ===== Stereo com aliases =====
  if (coreMetrics.stereo && typeof coreMetrics.stereo === 'object') {
    technicalData.stereo = { ...coreMetrics.stereo };
    
    // Alias crítico: isMonoCompatible → monoCompatibility
    if (coreMetrics.stereo.isMonoCompatible !== undefined) {
      technicalData.monoCompatibility = coreMetrics.stereo.isMonoCompatible;
    }
    
    // Aliases legado
    technicalData.correlation = coreMetrics.stereo.correlation;
    technicalData.balance = coreMetrics.stereo.balance;
    technicalData.width = coreMetrics.stereo.width;
  }

  // ===== Spectral Bands com aliases =====
  if (coreMetrics.spectralBands && typeof coreMetrics.spectralBands === 'object') {
    technicalData.spectralBands = { ...coreMetrics.spectralBands };
    
    // Aliases críticos para compatibilidade
    if (coreMetrics.spectralBands.lowMid !== undefined) {
      technicalData.mids = coreMetrics.spectralBands.lowMid; // lowMid → mids
    }
    if (coreMetrics.spectralBands.highMid !== undefined) {
      technicalData.treble = coreMetrics.spectralBands.highMid; // highMid → treble
    }
  }

  return technicalData;
}

// Executar teste
const result = extractTechnicalData(mockCoreMetrics);

console.log('✅ RESULTADOS DO TESTE:');
console.log('='.repeat(50));

// Verificar se novos analyzers estão presentes
console.log('\n🔹 NOVOS ANALYZERS:');
console.log('dcOffset presente:', !!result.dcOffset);
console.log('dominantFrequencies presente:', !!result.dominantFrequencies);
console.log('spectralUniformity presente:', !!result.spectralUniformity);

// Verificar estruturas específicas
console.log('\n🔹 ESTRUTURAS ESPECÍFICAS:');
console.log('dominantFrequencies.detailed.primary:', result.dominantFrequencies?.detailed?.primary);
console.log('spectralUniformity.value:', result.spectralUniformity?.value);
console.log('dcOffset.detailed.L/R:', result.dcOffset?.detailed?.L, '/', result.dcOffset?.detailed?.R);

// Verificar aliases críticos
console.log('\n🔹 ALIASES CRÍTICOS:');
console.log('monoCompatibility:', result.monoCompatibility);
console.log('mids (de lowMid):', result.mids);
console.log('treble (de highMid):', result.treble);
console.log('avgLoudness:', result.avgLoudness);

// Verificar estrutura final
console.log('\n🔹 TODAS AS CHAVES GERADAS:');
console.log(Object.keys(result).sort());

console.log('\n✅ TESTE CONCLUÍDO - Verifique se todos os valores estão corretos!');