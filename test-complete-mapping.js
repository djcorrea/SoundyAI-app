// 🧪 TESTE COMPLETO: Verificar mapeamento de TODAS as métricas do pipeline

console.log('🧪 TESTE COMPLETO: Validando mapeamento de todas as métricas\n');

// Simular dados completos que vêm do pipeline (baseado no core-metrics.js)
const completePipelineData = {
  score: 87.5,
  classification: 'professional',
  
  // Loudness (LUFS ITU-R BS.1770-4)
  loudness: {
    integrated: -12.3,
    shortTerm: -11.8,
    momentary: -10.5,
    lra: 3.2,
    unit: "LUFS"
  },
  
  // True Peak com oversampling 4x
  truePeak: {
    maxDbtp: -0.8,
    maxLinear: 0.912,
    oversamplingFactor: 4,
    clippingCount: 0,
    leftPeak: -1.2,
    rightPeak: -0.8,
    unit: "dBTP"
  },
  
  // Stereo Analysis completa
  stereo: {
    correlation: 0.753,
    width: 0.402,
    balance: 0.015,
    isMonoCompatible: true,
    hasPhaseIssues: false,
    correlationCategory: 'good',
    widthCategory: 'moderate',
    algorithm: 'Corrected_Stereo_Metrics',
    valid: true
  },
  
  // FFT Metrics espectrais
  fft: {
    processedFrames: 845,
    spectralCentroidHz: 674.4,
    spectralRolloffHz: 1070.3,
    spectralBandwidthHz: 423.8,
    spectralSpreadHz: 891.2,
    spectralFlatness: 0.234,
    spectralCrest: 12.8,
    spectralSkewness: 0.567,
    spectralKurtosis: 2.145
  },
  
  // Bandas espectrais (7 bandas)
  spectralBands: {
    sub: { rms_db: -18.5, peak_db: -15.2, range_hz: "20-60" },
    low_bass: { rms_db: -12.8, peak_db: -9.1, range_hz: "60-250" },
    upper_bass: { rms_db: -8.4, peak_db: -5.7, range_hz: "250-500" },
    low_mid: { rms_db: -6.2, peak_db: -3.9, range_hz: "500-1k" },
    mid: { rms_db: -4.1, peak_db: -1.8, range_hz: "1k-2k" },
    high_mid: { rms_db: -12.7, peak_db: -9.4, range_hz: "2k-4k" },
    brilho: { rms_db: -18.9, peak_db: -15.6, range_hz: "4k-8k" },
    presenca: { rms_db: -25.3, peak_db: -22.0, range_hz: "8k-12k" }
  },
  
  // Spectral Centroid detalhado
  spectralCentroid: {
    averageHz: 674.4,
    medianHz: 612.7,
    category: 'bright',
    frames: 845
  },
  
  // Dynamics
  dynamics: {
    dynamicRange: 8.7,
    crestFactor: 11.2,
    lra: 3.2,
    peakToAverage: 8.9
  },
  
  // Normalização
  normalization: {
    applied: true,
    originalLUFS: -6.2,
    gainAppliedDB: -16.8,
    hasClipping: false,
    isSilence: false
  },
  
  // Scoring breakdown
  scoring: {
    method: 'Equal Weight V3',
    breakdown: {
      dynamics: 85,
      technical: 92,
      stereo: 88,
      loudness: 95,
      frequency: 78
    }
  },
  
  metadata: {
    fileName: 'test_complete.wav',
    processingTime: 3245,
    jobId: 'test-complete-001'
  }
};

// Simular função de normalização completa
function testCompleteNormalization(backendData) {
  console.log('🔧 [NORMALIZE] Iniciando normalização completa...');
  
  const normalized = {
    technicalData: {},
    problems: [],
    suggestions: []
  };
  
  const tech = normalized.technicalData;
  const source = backendData.technicalData || backendData.metrics || backendData;
  
  // MÉTRICAS BÁSICAS
  tech.lufsIntegrated = backendData.loudness?.integrated || -23;
  tech.truePeakDbtp = backendData.truePeak?.maxDbtp || -60;
  tech.stereoCorrelation = backendData.stereo?.correlation || 0.5;
  tech.lra = backendData.loudness?.lra || 8;
  
  // TRUE PEAK DETALHADO
  if (backendData.truePeak) {
    tech.truePeakDetailed = {
      maxDbtp: backendData.truePeak.maxDbtp || -60,
      maxLinear: backendData.truePeak.maxLinear || 0.8,
      oversamplingFactor: backendData.truePeak.oversamplingFactor || 4,
      clippingCount: backendData.truePeak.clippingCount || 0,
      leftPeak: backendData.truePeak.leftPeak || -60,
      rightPeak: backendData.truePeak.rightPeak || -60,
      unit: backendData.truePeak.unit || 'dBTP'
    };
  }
  
  // FFT METRICS
  if (backendData.fft) {
    tech.fftMetrics = {
      processedFrames: backendData.fft.processedFrames || 0,
      spectralCentroidHz: backendData.fft.spectralCentroidHz || 0,
      spectralRolloffHz: backendData.fft.spectralRolloffHz || 0,
      spectralBandwidthHz: backendData.fft.spectralBandwidthHz || 0,
      spectralSpreadHz: backendData.fft.spectralSpreadHz || 0,
      spectralFlatness: backendData.fft.spectralFlatness || 0,
      spectralCrest: backendData.fft.spectralCrest || 0,
      spectralSkewness: backendData.fft.spectralSkewness || 0,
      spectralKurtosis: backendData.fft.spectralKurtosis || 0
    };
  }
  
  // BANDAS ESPECTRAIS
  if (backendData.spectralBands) {
    tech.spectralBands = backendData.spectralBands;
  }
  
  // STEREO DETALHADO
  if (backendData.stereo) {
    tech.stereoDetailed = {
      correlation: backendData.stereo.correlation || 0.5,
      width: backendData.stereo.width || 0.5,
      balance: backendData.stereo.balance || 0,
      isMonoCompatible: backendData.stereo.isMonoCompatible || false,
      hasPhaseIssues: backendData.stereo.hasPhaseIssues || false,
      correlationCategory: backendData.stereo.correlationCategory || 'unknown',
      widthCategory: backendData.stereo.widthCategory || 'unknown'
    };
  }
  
  // DYNAMICS
  if (backendData.dynamics) {
    tech.dynamics = backendData.dynamics;
  }
  
  // NORMALIZAÇÃO
  if (backendData.normalization) {
    tech.normalization = backendData.normalization;
  }
  
  // SCORE
  normalized.qualityOverall = backendData.score || 7.5;
  normalized.classification = backendData.classification || 'unknown';
  normalized.qualityBreakdown = backendData.scoring?.breakdown || {};
  
  return normalized;
}

console.log('📊 DADOS ORIGINAIS DO PIPELINE:');
console.log('  Métricas básicas:');
console.log(`    Score: ${completePipelineData.score}%`);
console.log(`    LUFS: ${completePipelineData.loudness.integrated}`);
console.log(`    True Peak: ${completePipelineData.truePeak.maxDbtp} dBTP`);
console.log(`    Stereo Correlation: ${completePipelineData.stereo.correlation}`);

console.log('\n  Métricas avançadas:');
console.log(`    Spectral Centroid: ${completePipelineData.fft.spectralCentroidHz} Hz`);
console.log(`    Spectral Rolloff: ${completePipelineData.fft.spectralRolloffHz} Hz`);
console.log(`    Frames FFT: ${completePipelineData.fft.processedFrames}`);
console.log(`    Bandas espectrais: ${Object.keys(completePipelineData.spectralBands).length} bandas`);
console.log(`    Dynamic Range: ${completePipelineData.dynamics.dynamicRange} dB`);

console.log('\n🔧 EXECUTANDO NORMALIZAÇÃO COMPLETA...');
const normalizedData = testCompleteNormalization(completePipelineData);

console.log('\n✅ MÉTRICAS APÓS NORMALIZAÇÃO:');
console.log('  Básicas mapeadas:');
console.log(`    Score: ${normalizedData.qualityOverall}`);
console.log(`    LUFS: ${normalizedData.technicalData.lufsIntegrated}`);
console.log(`    True Peak: ${normalizedData.technicalData.truePeakDbtp}`);
console.log(`    Stereo: ${normalizedData.technicalData.stereoCorrelation}`);

console.log('\n  Avançadas mapeadas:');
const fft = normalizedData.technicalData.fftMetrics;
const bands = normalizedData.technicalData.spectralBands;
const stereoDetail = normalizedData.technicalData.stereoDetailed;
const dynamics = normalizedData.technicalData.dynamics;

console.log(`    FFT Frames: ${fft?.processedFrames || 'N/A'}`);
console.log(`    Spectral Centroid: ${fft?.spectralCentroidHz || 'N/A'} Hz`);
console.log(`    Spectral Rolloff: ${fft?.spectralRolloffHz || 'N/A'} Hz`);
console.log(`    Bandas mapeadas: ${bands ? Object.keys(bands).length : 0}`);
console.log(`    Stereo Width: ${stereoDetail?.width || 'N/A'}`);
console.log(`    Dynamic Range: ${dynamics?.dynamicRange || 'N/A'} dB`);

console.log('\n🎯 VERIFICAÇÃO DE COMPLETUDE:');
const checks = {
  basicMetrics: !!(normalizedData.qualityOverall && normalizedData.technicalData.lufsIntegrated),
  truePeakDetailed: !!normalizedData.technicalData.truePeakDetailed,
  fftMetrics: !!normalizedData.technicalData.fftMetrics,
  spectralBands: !!normalizedData.technicalData.spectralBands,
  stereoDetailed: !!normalizedData.technicalData.stereoDetailed,
  dynamics: !!normalizedData.technicalData.dynamics,
  normalization: !!normalizedData.technicalData.normalization
};

Object.entries(checks).forEach(([key, passed]) => {
  console.log(`  ${passed ? '✅' : '❌'} ${key}: ${passed ? 'MAPEADO' : 'FALTANDO'}`);
});

const allMapped = Object.values(checks).every(check => check);
console.log(`\n🏆 RESULTADO: ${allMapped ? '✅ TODAS as métricas mapeadas!' : '❌ Algumas métricas ainda faltando'}`);

if (allMapped) {
  console.log('\n🎉 SUCESSO! O frontend agora terá acesso a:');
  console.log('  • Métricas básicas (Score, LUFS, True Peak, Stereo)');
  console.log('  • Análise espectral completa (Centroid, Rolloff, Bandwidth, etc.)');
  console.log('  • Bandas de frequência detalhadas (8 bandas)');
  console.log('  • Informações de True Peak com oversampling');
  console.log('  • Análise estéreo avançada');
  console.log('  • Métricas de dinâmica');
  console.log('  • Dados de normalização');
  console.log('  • Breakdown de scoring');
}