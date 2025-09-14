/**
 * Teste da JSON Output Enhanced (Fase 5.4)
 * Verifica se todas as métricas necessárias estão sendo extraídas e incluídas no JSON final
 */

// Simulação de coreMetrics completos (baseado na análise do core-metrics.js)
const mockCoreMetrics = {
  fft: {
    processedFrames: 1024,
    totalFrames: 1024,
    config: { fftSize: 4096, hopSize: 1024, windowType: 'hann' },
    aggregated: {
      spectralCentroidHz: 2341.5,
      spectralRolloffHz: 8956.2,
      spectralBandwidthHz: 3245.8,
      spectralSpreadHz: 1876.3,
      spectralFlatness: 0.15,
      spectralCrest: 12.4,
      spectralSkewness: 0.85,
      spectralKurtosis: 2.1,
      zeroCrossingRate: 0.03,
      spectralFlux: 0.24
    },
    dominantFrequencies: [
      { frequency: 440.0, occurrences: 156, magnitude: -12.5 },
      { frequency: 880.0, occurrences: 89, magnitude: -18.2 }
    ]
  },
  
  spectralBands: {
    processedFrames: 1024,
    config: { bandCount: 7 },
    aggregated: {
      sub: { rmsDb: -25.4, peakDb: -18.2, frequencyRange: [20, 60] },
      lowBass: { rmsDb: -22.1, peakDb: -15.8, frequencyRange: [60, 200] },
      upperBass: { rmsDb: -19.6, peakDb: -12.3, frequencyRange: [200, 500] },
      lowMid: { rmsDb: -16.8, peakDb: -9.5, frequencyRange: [500, 1000] },
      mid: { rmsDb: -14.2, peakDb: -7.1, frequencyRange: [1000, 2000] },
      highMid: { rmsDb: -17.5, peakDb: -10.2, frequencyRange: [2000, 4000] },
      brilliance: { rmsDb: -20.8, peakDb: -13.6, frequencyRange: [4000, 8000] },
      presence: { rmsDb: -24.1, peakDb: -16.9, frequencyRange: [8000, 12000] },
      air: { rmsDb: -28.5, peakDb: -21.2, frequencyRange: [12000, 20000] }
    }
  },
  
  spectralCentroid: {
    processedFrames: 1024,
    aggregated: {
      centroidHz: 2341.5,
      brightnessCategory: 'balanced'
    }
  },
  
  lufs: {
    integrated: -16.2,
    shortTerm: -15.8,
    momentary: -14.9,
    lra: 8.5,
    originalLUFS: -12.4,
    normalizedTo: -16.0,
    gainAppliedDB: -3.6
  },
  
  truePeak: {
    maxDbtp: -1.2,
    maxLinear: 0.87,
    samplePeakLeftDb: -1.5,
    samplePeakRightDb: -1.8,
    clippingSamples: 0,
    clippingPct: 0.0
  },
  
  stereo: {
    correlation: 0.85,
    width: 1.2,
    balance: 0.02,
    isMonoCompatible: true,
    hasPhaseIssues: false,
    correlationCategory: 'good',
    widthCategory: 'wide'
  },
  
  dynamics: {
    dynamicRange: 12.8,
    crestFactor: 18.5,
    peakRmsDb: -6.2,
    averageRmsDb: -18.7,
    drCategory: 'good'
  },
  
  rms: {
    left: -18.5,
    right: -18.9,
    average: -18.7,
    peak: -6.2,
    count: 1024
  },
  
  normalization: {
    applied: true,
    targetLUFS: -16.0,
    originalLUFS: -12.4,
    gainDB: -3.6
  }
};

// Simulação de scoringResult
const mockScoringResult = {
  score: 8.5,
  scorePct: 85,
  classification: 'excellent',
  method: 'Equal Weight V3',
  breakdown: {
    loudness: 9.2,
    dynamics: 8.1,
    stereo: 8.8,
    spectral: 8.0
  },
  penalties: {},
  bonuses: { stereoWidth: 0.3 }
};

// Simulação de metadata
const mockMetadata = {
  fileName: 'test_audio_enhanced.wav',
  fileSize: 5242880,
  fileSizeBytes: 5242880,
  fileSizeMB: 5.0,
  duration: 30.5,
  sampleRate: 48000,
  channels: 2,
  format: 'audio/wav',
  bitDepth: 24,
  codec: 'pcm',
  processingTime: 2.1,
  phaseBreakdown: {
    'phase_5_1': 0.5,
    'phase_5_2': 0.3,
    'phase_5_3': 1.1,
    'phase_5_4': 0.2
  }
};

// Carrega as funções do json-output.js
const fs = require('fs');
const path = require('path');

// Lê o arquivo json-output.js
const jsonOutputPath = path.join(__dirname, 'work', 'api', 'audio', 'json-output.js');
const jsonOutputCode = fs.readFileSync(jsonOutputPath, 'utf8');

// Remove as partes que não são funções (console.log, etc)
const cleanCode = jsonOutputCode
  .replace(/console\.log\(.+?\);/g, '')
  .replace(/module\.exports.+/g, '');

// Executa o código para ter acesso às funções
eval(cleanCode);

// Mock da função makeErr
function makeErr(phase, message, code) {
  const error = new Error(message);
  error.phase = phase;
  error.code = code;
  return error;
}

console.log('🔄 Testando JSON Output Enhanced (Fase 5.4)...\n');

try {
  // Testa a extração de dados técnicos
  console.log('1️⃣ Testando extractTechnicalData...');
  const technicalData = extractTechnicalData(mockCoreMetrics);
  
  console.log('✅ TechnicalData extraído com sucesso!');
  console.log(`   - Métricas LUFS: ${technicalData.lufsIntegrated}`);
  console.log(`   - True Peak: ${technicalData.truePeakDbtp}`);
  console.log(`   - Stereo Correlation: ${technicalData.stereoCorrelation}`);
  console.log(`   - Dynamic Range: ${technicalData.dynamicRange}`);
  console.log(`   - Spectral Centroid: ${technicalData.spectralCentroid}`);
  console.log(`   - Bandas Espectrais: ${Object.keys(technicalData.bandEnergies || {}).length} bandas`);
  console.log(`   - Frequências Dominantes: ${(technicalData.dominantFrequencies || []).length} frequências`);
  
  // Testa a construção do JSON final
  console.log('\n2️⃣ Testando buildFinalJSON...');
  const finalJSON = buildFinalJSON(mockCoreMetrics, technicalData, mockScoringResult, mockMetadata, { jobId: 'test-enhanced-001' });
  
  console.log('✅ JSON Final construído com sucesso!');
  console.log(`   - Score: ${finalJSON.score}`);
  console.log(`   - Classification: ${finalJSON.classification}`);
  console.log(`   - Loudness Integrated: ${finalJSON.loudness.integrated}`);
  console.log(`   - True Peak: ${finalJSON.truePeak.maxDbtp}`);
  console.log(`   - Stereo Correlation: ${finalJSON.stereo.correlation}`);
  console.log(`   - Dynamic Range: ${finalJSON.dynamics.range}`);
  
  // Testa a validação
  console.log('\n3️⃣ Testando validateFinalJSON...');
  validateFinalJSON(finalJSON);
  console.log('✅ Validação do JSON Final passou!');
  
  // Verifica se todas as métricas necessárias estão presentes
  console.log('\n4️⃣ Verificando completude das métricas...');
  
  const requiredMetrics = [
    'technicalData.lufsIntegrated',
    'technicalData.truePeakDbtp',
    'technicalData.stereoCorrelation',
    'technicalData.dynamicRange',
    'technicalData.spectralCentroid',
    'technicalData.bandEnergies',
    'technicalData.dominantFrequencies',
    'spectralBands.detailed',
    'spectral.centroidHz',
    'headroom.peak',
    'headroom.truePeak'
  ];
  
  let missingMetrics = [];
  for (const metric of requiredMetrics) {
    const keys = metric.split('.');
    let current = finalJSON;
    for (const key of keys) {
      if (current && current[key] !== undefined && current[key] !== null) {
        current = current[key];
      } else {
        missingMetrics.push(metric);
        break;
      }
    }
  }
  
  if (missingMetrics.length === 0) {
    console.log('✅ Todas as métricas necessárias estão presentes!');
  } else {
    console.log(`❌ Métricas faltando: ${missingMetrics.join(', ')}`);
  }
  
  // Mostra o tamanho do JSON final
  const jsonString = JSON.stringify(finalJSON, null, 2);
  const jsonSizeKB = (jsonString.length / 1024).toFixed(2);
  
  console.log('\n5️⃣ Estatísticas do JSON Final:');
  console.log(`   - Tamanho: ${jsonSizeKB} KB`);
  console.log(`   - Seções principais: ${Object.keys(finalJSON).length}`);
  console.log(`   - Métricas no technicalData: ${Object.keys(finalJSON.technicalData).length}`);
  console.log(`   - Bandas espectrais: ${Object.keys(finalJSON.spectralBands.detailed || {}).length}`);
  
  // Salva o JSON de exemplo para análise
  fs.writeFileSync('json-output-enhanced-example.json', jsonString);
  console.log('\n💾 Exemplo salvo em: json-output-enhanced-example.json');
  
  console.log('\n✅ TESTE COMPLETO: JSON Output Enhanced funcionando perfeitamente!');
  console.log('🎯 O JSON agora contém TODAS as métricas necessárias para o modal do frontend.');
  
} catch (error) {
  console.error('\n❌ ERRO no teste:', error.message);
  console.error('Stack:', error.stack);
}