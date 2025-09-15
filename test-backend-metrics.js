/**
 * Teste do backend - simula processamento para verificar se métricas estão sendo incluídas
 */

// Simular core metrics como se viessem do pipeline real
const mockCoreMetrics = {
  fft: {
    processedFrames: 1000,
    aggregated: {
      spectralCentroidHz: 1500.5,
      spectralRolloffHz: 8500.2,
      spectralBandwidthHz: 2300.8,
      spectralSpreadHz: 2300.8,
      spectralFlatness: 0.0023,
      spectralCrest: 15.6,
      spectralSkewness: 2.1,
      spectralKurtosis: 8.3,
      zeroCrossingRate: 0.15,
      spectralFlux: 0.08
    }
  },
  spectralBands: {
    processedFrames: 1000,
    aggregated: {
      bands: {
        sub: { energy: 1200, percentage: 8.5, name: 'Sub', description: 'Sub-bass', frequencyRange: '20-60Hz' },
        bass: { energy: 2800, percentage: 18.2, name: 'Bass', description: 'Bass', frequencyRange: '60-150Hz' },
        lowMid: { energy: 3200, percentage: 22.1, name: 'Low-Mid', description: 'Low-mid', frequencyRange: '150-500Hz' },
        mid: { energy: 2900, percentage: 19.8, name: 'Mid', description: 'Mid', frequencyRange: '500-2000Hz' },
        highMid: { energy: 2100, percentage: 14.2, name: 'High-Mid', description: 'High-mid', frequencyRange: '2000-5000Hz' },
        presence: { energy: 1800, percentage: 12.1, name: 'Presence', description: 'Presence', frequencyRange: '5000-10000Hz' },
        air: { energy: 750, percentage: 5.1, name: 'Air', description: 'Air', frequencyRange: '10000-20000Hz' }
      },
      totalPercentage: 100.0,
      valid: true
    }
  },
  spectralCentroid: {
    processedFrames: 1000,
    aggregated: {
      centroidHz: 1500.5,
      brightnessCategory: 'Médio'
    }
  },
  lufs: {
    integrated: -12.8,
    originalLUFS: -12.8,
    normalizedTo: -23.0,
    gainAppliedDB: -10.2,
    lra: 8.5
  },
  truePeak: {
    maxDbtp: -1.2,
    maxLinear: 0.88,
    clippingSamples: 0,
    clippingPct: 0
  },
  stereo: {
    correlation: 0.85,
    width: 0.3,
    balance: 0.02,
    isMonoCompatible: false,
    hasPhaseIssues: false,
    correlationCategory: 'Correlacionado',
    widthCategory: 'Estreito'
  },
  dynamics: {
    dynamicRange: 12.5,
    crestFactor: 14.2,
    peakRmsDb: -8.5,
    averageRmsDb: -15.2,
    drCategory: 'Bom'
  },
  rms: {
    left: -14.8,
    right: -15.1,
    average: -14.95,
    peak: -8.2,
    frameCount: 1000
  }
};

const mockMetadata = {
  fileName: 'test.wav',
  fileSize: 50000000,
  duration: 180.5,
  sampleRate: 48000,
  channels: 2,
  format: 'audio/wav',
  bitDepth: 24
};

// Importar e testar
import { generateJSONOutput } from './work/api/audio/json-output.js';

console.log('🧪 TESTE: Backend Metrics JSON');

try {
  const jsonOutput = generateJSONOutput(mockCoreMetrics, null, mockMetadata, { 
    jobId: 'backend-test',
    fileName: 'test.wav'
  });
  
  // Verificar métricas espectrais
  console.log('\n📊 VERIFICAÇÃO DE MÉTRICAS ESPECTRAIS:');
  
  const spectralFields = [
    'spectralCentroidHz', 'spectralRolloffHz', 'spectralBandwidthHz', 'spectralSpreadHz',
    'spectralFlatness', 'spectralCrest', 'spectralSkewness', 'spectralKurtosis', 
    'zeroCrossingRate', 'spectralFlux'
  ];
  
  let missingCount = 0;
  spectralFields.forEach(field => {
    if (jsonOutput[field] != null && jsonOutput[field] !== 0) {
      console.log(`✅ ${field}: ${jsonOutput[field]}`);
    } else {
      console.log(`❌ ${field}: ${jsonOutput[field]} (AUSENTE)`);
      missingCount++;
    }
  });
  
  // Verificar bandas espectrais
  console.log('\n📊 VERIFICAÇÃO DE BANDAS ESPECTRAIS:');
  if (jsonOutput.spectralBands && jsonOutput.spectralBands.detailed) {
    console.log('✅ spectralBands.detailed:', Object.keys(jsonOutput.spectralBands.detailed));
  } else {
    console.log('❌ spectralBands.detailed: AUSENTE');
    missingCount++;
  }
  
  if (jsonOutput.spectralBands && jsonOutput.spectralBands.simplified) {
    console.log('✅ spectralBands.simplified:', Object.keys(jsonOutput.spectralBands.simplified));
  } else {
    console.log('❌ spectralBands.simplified: AUSENTE');
    missingCount++;
  }
  
  // Verificar seção spectral
  console.log('\n📊 VERIFICAÇÃO DA SEÇÃO SPECTRAL:');
  if (jsonOutput.spectral) {
    const spectralKeys = Object.keys(jsonOutput.spectral);
    console.log('✅ spectral section:', spectralKeys);
    console.log(`✅ spectral.processedFrames: ${jsonOutput.spectral.processedFrames}`);
    console.log(`✅ spectral.hasData: ${jsonOutput.spectral.hasData}`);
  } else {
    console.log('❌ spectral section: AUSENTE');
    missingCount++;
  }
  
  console.log(`\n📊 RESULTADO: ${missingCount === 0 ? '✅ TODAS MÉTRICAS INCLUÍDAS!' : `❌ ${missingCount} MÉTRICAS AUSENTES`}`);
  
  // Tamanho do JSON
  const jsonString = JSON.stringify(jsonOutput);
  console.log(`📦 Tamanho JSON: ${Math.round(jsonString.length / 1024)}KB`);
  
  // Mostrar algumas seções importantes
  console.log('\n📋 RESUMO JSON:');
  console.log(`Score: ${jsonOutput.score}`);
  console.log(`Classification: ${jsonOutput.classification}`);
  console.log(`Processing frames - FFT: ${jsonOutput.processing?.fftFrames}, Bands: ${jsonOutput.processing?.spectralBandsFrames}, Centroid: ${jsonOutput.processing?.spectralCentroidFrames}`);
  
} catch (error) {
  console.error('❌ Erro no teste:', error.message);
  console.error(error.stack);
}