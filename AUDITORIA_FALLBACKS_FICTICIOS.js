// 🔍 AUDITORIA COMPLETA: Identificação de Fallbacks Fictícios no Pipeline → UI

console.log('🔍 AUDITORIA COMPLETA: Fallbacks Fictícios no Pipeline → UI\n');

// Simular uma resposta típica do backend (baseada no pipeline real)
const simulatedBackendResponse = {
  score: 87.3,
  classification: 'professional',
  
  // Dados do pipeline real
  loudness: {
    integrated: -12.4,
    shortTerm: -11.8,
    momentary: -10.9,
    lra: 3.1,
    unit: "LUFS"
  },
  
  truePeak: {
    maxDbtp: -0.7,
    maxLinear: 0.913,
    oversamplingFactor: 4,
    clippingCount: 12,
    leftPeak: -1.1,
    rightPeak: -0.7,
    unit: "dBTP"
  },
  
  stereo: {
    correlation: 0.748,
    width: 0.395,
    balance: 0.023,
    isMonoCompatible: true,
    hasPhaseIssues: false,
    correlationCategory: 'good',
    widthCategory: 'moderate'
  },
  
  fft: {
    processedFrames: 892,
    spectralCentroidHz: 681.2,
    spectralRolloffHz: 1089.4,
    spectralBandwidthHz: 445.7,
    spectralSpreadHz: 934.6,
    spectralFlatness: 0.198,
    spectralCrest: 13.4,
    spectralSkewness: 0.587,
    spectralKurtosis: 2.234
  },
  
  spectralBands: {
    sub: { rms_db: -19.2, peak_db: -16.1, range_hz: "20-60" },
    low_bass: { rms_db: -13.7, peak_db: -10.6, range_hz: "60-250" },
    upper_bass: { rms_db: -9.4, peak_db: -6.3, range_hz: "250-500" },
    low_mid: { rms_db: -6.8, peak_db: -3.7, range_hz: "500-1k" },
    mid: { rms_db: -4.9, peak_db: -1.8, range_hz: "1k-2k" },
    high_mid: { rms_db: -11.6, peak_db: -8.5, range_hz: "2k-4k" },
    brilho: { rms_db: -16.8, peak_db: -13.7, range_hz: "4k-8k" },
    presenca: { rms_db: -24.1, peak_db: -21.0, range_hz: "8k-12k" }
  },
  
  dynamics: {
    dynamicRange: 9.1,
    crestFactor: 12.3,
    lra: 3.1,
    peakToAverage: 8.7
  },
  
  // Alguns campos ausentes para simular dados incompletos
  // normalization: undefined, 
  // spectralCentroid: undefined
};

// Simular dados AUSENTES para testar fallbacks
const incompleteBackendResponse = {
  score: 92.1,
  classification: 'professional'
  // Todos os outros campos ausentes
};

// Capturar todos os fallbacks usados na normalização
function auditNormalizationFallbacks(backendData, logName) {
  console.log(`\n📊 AUDITANDO: ${logName}`);
  console.log('=====================================');
  
  const fallbacksUsed = [];
  const realValuesUsed = [];
  
  // Interceptar a função normalizeBackendAnalysisData para capturar fallbacks
  const originalConsoleLog = console.log;
  const logBuffer = [];
  
  // Mock da função de normalização (baseada na função real)
  const normalized = {
    technicalData: {},
    problems: [],
    suggestions: []
  };
  
  const tech = normalized.technicalData;
  const source = backendData.technicalData || backendData.metrics || backendData;
  
  // 🎯 AUDITORIA DOS FALLBACKS - Rastrear cada mapeamento
  
  // Peak e RMS - Verificar fallbacks
  const peakValue = source.peak || source.peak_db || source.peakLevel || 
                   backendData.truePeak?.maxDbtp || -60;
  if (peakValue === -60) {
    fallbacksUsed.push({
      metric: 'peak',
      fallbackValue: -60,
      unit: 'dB',
      severity: 'HIGH - Valor completamente fictício'
    });
  } else {
    realValuesUsed.push({
      metric: 'peak',
      realValue: peakValue,
      unit: 'dB',
      source: 'backend'
    });
  }
  tech.peak = peakValue;
  
  const rmsValue = source.rms || source.rms_db || source.rmsLevel || -60;
  if (rmsValue === -60) {
    fallbacksUsed.push({
      metric: 'rms',
      fallbackValue: -60,
      unit: 'dB',
      severity: 'HIGH - Valor completamente fictício'
    });
  } else {
    realValuesUsed.push({
      metric: 'rms',
      realValue: rmsValue,
      unit: 'dB',
      source: 'backend'
    });
  }
  tech.rms = rmsValue;
  
  // LUFS - Verificar fallbacks críticos
  const lufsValue = backendData.loudness?.integrated || 
                   source.lufsIntegrated || source.lufs_integrated || source.lufs || -23;
  if (lufsValue === -23) {
    fallbacksUsed.push({
      metric: 'lufsIntegrated',
      fallbackValue: -23,
      unit: 'LUFS',
      severity: 'CRITICAL - Valor padrão broadcasting usado como fictício'
    });
  } else {
    realValuesUsed.push({
      metric: 'lufsIntegrated',
      realValue: lufsValue,
      unit: 'LUFS',
      source: 'backend pipeline'
    });
  }
  tech.lufsIntegrated = lufsValue;
  
  // True Peak - Verificar fallbacks críticos
  const truePeakValue = backendData.truePeak?.maxDbtp || 
                       source.truePeakDbtp || source.true_peak_dbtp || source.truePeak || tech.peak;
  if (truePeakValue === tech.peak && tech.peak === -60) {
    fallbacksUsed.push({
      metric: 'truePeakDbtp',
      fallbackValue: -60,
      unit: 'dBTP',
      severity: 'CRITICAL - True Peak usando fallback de Peak fictício'
    });
  } else if (truePeakValue === tech.peak) {
    fallbacksUsed.push({
      metric: 'truePeakDbtp',
      fallbackValue: tech.peak,
      unit: 'dBTP',
      severity: 'MEDIUM - True Peak usando Peak como fallback (impreciso)'
    });
  } else {
    realValuesUsed.push({
      metric: 'truePeakDbtp',
      realValue: truePeakValue,
      unit: 'dBTP',
      source: 'backend pipeline'
    });
  }
  tech.truePeakDbtp = truePeakValue;
  
  // Stereo - Verificar fallbacks
  const stereoValue = backendData.stereo?.correlation || 
                     source.stereoCorrelation || source.stereo_correlation || 0.5;
  if (stereoValue === 0.5) {
    fallbacksUsed.push({
      metric: 'stereoCorrelation',
      fallbackValue: 0.5,
      unit: 'ratio',
      severity: 'MEDIUM - Valor neutro usado como fallback'
    });
  } else {
    realValuesUsed.push({
      metric: 'stereoCorrelation',
      realValue: stereoValue,
      unit: 'ratio',
      source: 'backend pipeline'
    });
  }
  tech.stereoCorrelation = stereoValue;
  
  // LRA - Verificar fallbacks
  const lraValue = backendData.loudness?.lra || 
                  source.lra || source.loudnessRange || 8;
  if (lraValue === 8) {
    fallbacksUsed.push({
      metric: 'lra',
      fallbackValue: 8,
      unit: 'LU',
      severity: 'MEDIUM - Valor típico usado como fallback'
    });
  } else {
    realValuesUsed.push({
      metric: 'lra',
      realValue: lraValue,
      unit: 'LU',
      source: 'backend pipeline'
    });
  }
  tech.lra = lraValue;
  
  // Dynamic Range - Verificar cálculos vs fallbacks
  const drValue = source.dynamicRange || source.dynamic_range || source.dr || 
                 (Number.isFinite(tech.peak) && Number.isFinite(tech.rms) ? tech.peak - tech.rms : 12);
  if (drValue === 12) {
    fallbacksUsed.push({
      metric: 'dynamicRange',
      fallbackValue: 12,
      unit: 'dB',
      severity: 'MEDIUM - Valor padrão usado como fallback'
    });
  } else if (drValue === tech.peak - tech.rms) {
    realValuesUsed.push({
      metric: 'dynamicRange',
      realValue: drValue,
      unit: 'dB',
      source: 'calculated from peak-rms'
    });
  } else {
    realValuesUsed.push({
      metric: 'dynamicRange',
      realValue: drValue,
      unit: 'dB',
      source: 'backend pipeline'
    });
  }
  tech.dynamicRange = drValue;
  
  // Spectral Centroid - Verificar fallbacks
  const centroidValue = source.spectralCentroid || source.spectral_centroid || 1000;
  if (centroidValue === 1000) {
    fallbacksUsed.push({
      metric: 'spectralCentroid',
      fallbackValue: 1000,
      unit: 'Hz',
      severity: 'MEDIUM - Valor médio usado como fallback'
    });
  } else {
    realValuesUsed.push({
      metric: 'spectralCentroid',
      realValue: centroidValue,
      unit: 'Hz',
      source: 'backend pipeline'
    });
  }
  tech.spectralCentroid = centroidValue;
  
  // Spectral Bands - Verificar fallbacks em massa
  if (backendData.spectralBands) {
    realValuesUsed.push({
      metric: 'spectralBands',
      realValue: Object.keys(backendData.spectralBands).length + ' bandas',
      unit: 'bandas',
      source: 'backend pipeline'
    });
  } else {
    // Valores padrão das bandas espectrais (da função real)
    const defaultBands = {
      sub: { rms_db: -30, peak_db: -25 },
      low_bass: { rms_db: -25, peak_db: -20 },
      upper_bass: { rms_db: -20, peak_db: -15 },
      low_mid: { rms_db: -18, peak_db: -13 },
      mid: { rms_db: -15, peak_db: -10 },
      high_mid: { rms_db: -22, peak_db: -17 },
      brilho: { rms_db: -28, peak_db: -23 },
      presenca: { rms_db: -35, peak_db: -30 }
    };
    
    fallbacksUsed.push({
      metric: 'spectralBands',
      fallbackValue: '8 bandas com valores padrão',
      unit: 'bandas',
      severity: 'HIGH - Dados espectrais completamente fictícios'
    });
  }
  
  // Score - Verificar fallbacks
  const scoreValue = backendData.score || backendData.qualityOverall || backendData.mixScore || 7.5;
  if (scoreValue === 7.5) {
    fallbacksUsed.push({
      metric: 'qualityOverall',
      fallbackValue: 7.5,
      unit: 'score',
      severity: 'HIGH - Score fictício exibido para usuário'
    });
  } else {
    realValuesUsed.push({
      metric: 'qualityOverall',
      realValue: scoreValue,
      unit: 'score',
      source: 'backend pipeline'
    });
  }
  normalized.qualityOverall = scoreValue;
  
  // Relatório de auditoria
  console.log('\n🚨 FALLBACKS FICTÍCIOS DETECTADOS:');
  if (fallbacksUsed.length === 0) {
    console.log('✅ Nenhum fallback fictício detectado!');
  } else {
    fallbacksUsed.forEach((fallback, index) => {
      console.log(`${index + 1}. ${fallback.metric}: ${fallback.fallbackValue} ${fallback.unit}`);
      console.log(`   Severidade: ${fallback.severity}`);
    });
  }
  
  console.log('\n✅ VALORES REAIS USADOS:');
  if (realValuesUsed.length === 0) {
    console.log('❌ Nenhum valor real detectado!');
  } else {
    realValuesUsed.forEach((real, index) => {
      console.log(`${index + 1}. ${real.metric}: ${real.realValue} ${real.unit} (${real.source})`);
    });
  }
  
  // Estatísticas
  const totalMetrics = fallbacksUsed.length + realValuesUsed.length;
  const fallbackPercentage = (fallbacksUsed.length / totalMetrics) * 100;
  
  console.log('\n📊 ESTATÍSTICAS:');
  console.log(`Total de métricas: ${totalMetrics}`);
  console.log(`Valores reais: ${realValuesUsed.length} (${(100 - fallbackPercentage).toFixed(1)}%)`);
  console.log(`Valores fictícios: ${fallbacksUsed.length} (${fallbackPercentage.toFixed(1)}%)`);
  
  const severity = fallbackPercentage > 50 ? '🔴 CRÍTICO' : 
                  fallbackPercentage > 25 ? '🟡 MÉDIO' : 
                  fallbackPercentage > 0 ? '🟢 BAIXO' : '✅ OK';
  
  console.log(`Status: ${severity}`);
  
  return {
    fallbacks: fallbacksUsed,
    realValues: realValuesUsed,
    fallbackPercentage,
    severity,
    normalizedData: normalized
  };
}

// Executar auditoria com dados completos
const auditComplete = auditNormalizationFallbacks(simulatedBackendResponse, 'DADOS COMPLETOS DO PIPELINE');

// Executar auditoria com dados incompletos  
const auditIncomplete = auditNormalizationFallbacks(incompleteBackendResponse, 'DADOS INCOMPLETOS (TESTE FALLBACKS)');

console.log('\n\n🎯 RESUMO FINAL DA AUDITORIA');
console.log('=====================================');
console.log(`Dados Completos: ${auditComplete.fallbackPercentage.toFixed(1)}% fallbacks - ${auditComplete.severity}`);
console.log(`Dados Incompletos: ${auditIncomplete.fallbackPercentage.toFixed(1)}% fallbacks - ${auditIncomplete.severity}`);

console.log('\n💡 RECOMENDAÇÕES:');
console.log('1. ❌ ELIMINAR fallbacks fictícios (-60 dB, -23 LUFS, 0.5 stereo, etc.)');
console.log('2. ✅ VALIDAR dados do backend antes de exibir na UI');
console.log('3. 🚫 OCULTAR métricas quando dados reais não estiverem disponíveis');
console.log('4. 📊 EXIBIR "Não disponível" em vez de valores fictícios');
console.log('5. 🔍 LOGAR quando fallbacks são usados para debug');

console.log('\n🔧 PRÓXIMAS AÇÕES:');
console.log('1. Modificar normalizeBackendAnalysisData para eliminar fallbacks');
console.log('2. Adicionar validação de dados na displayModalResults');
console.log('3. Implementar UI condicional para métricas indisponíveis');
console.log('4. Testar com arquivo real para validar correções');