import { generateJSONOutput } from './api/audio/json-output.js';

// Mock baseado exatamente no JSON PostgreSQL que você enviou
console.log('🔍 Simulando dados REAIS do PostgreSQL...');

const mockCoreMetricsReal = {
  lufs: {
    integrated: -25.472,
    shortTerm: -25.094,
    momentary: -16.373,
    lra: 6.547
  },
  truePeak: {
    maxDbtp: 9.799,
    maxLinear: 3.09
  },
  stereo: {
    correlation: 0.853,
    width: 0.44,
    balance: 0.0
  },
  dynamics: {
    dynamic_range: 10.009,
    tt_dr: 10.009,
    p95_rms: -15.704,
    p10_rms: -15.812,
    crest_factor_db: 46.455,
    peak_db: -1.207,
    rms_db: -9.317,
    crest_legacy: 46.455
  },
  metadata: {
    sampleRate: 48000,
    channels: 2,
    duration: 172.44447916666667
  },
  // 🔥 PROBLEMA: Dados FFT podem estar faltando em produção!
  fft: null // Simular cenário onde FFT não foi processado
};

console.log('\n🚨 TESTE 1: Sem dados FFT (cenário atual PostgreSQL)');
const jsonSemFFT = generateJSONOutput(mockCoreMetricsReal, null, {
  fileName: "1757900633847.wav",
  fileSize: 45634520
});

console.log('✅ technicalData keys:', Object.keys(jsonSemFFT.technicalData));
console.log('❌ bandEnergies:', !!jsonSemFFT.technicalData.bandEnergies ? 'EXISTE' : 'FALTANDO');
console.log('❌ frequencyBands:', !!jsonSemFFT.technicalData.frequencyBands ? 'EXISTE' : 'FALTANDO');
console.log('❌ spectralCentroidHz:', !!jsonSemFFT.technicalData.spectralCentroidHz ? 'EXISTE' : 'FALTANDO');

console.log('\n🔥 TESTE 2: Com dados FFT completos (como deveria ser)');
mockCoreMetricsReal.fft = {
  frameCount: 1000,
  frameSize: 4096,
  hopSize: 1024,
  windowType: 'hann',
  frequencyBands: {
    left: {
      subBass: { min: 20, max: 60, energy: 942.396 },
      bass: { min: 60, max: 250, energy: 1897.123 },
      lowMid: { min: 250, max: 500, energy: 7456.234 },
      mid: { min: 500, max: 2000, energy: 21543.876 },
      highMid: { min: 2000, max: 4000, energy: 28976.543 },
      presence: { min: 4000, max: 6000, energy: 66432.187 },
      brilliance: { min: 6000, max: 20000, energy: 195674.321 }
    }
  },
  aggregated: {
    spectralCentroidHz: 12105.497,
    spectralRolloffHz: 20648.438,
    spectralBandwidthHz: 2500.0,
    spectralSpread: 1200.5,
    spectralFlatness: 0.15,
    spectralCrest: 12.4,
    spectralSkewness: 0.3,
    spectralKurtosis: 2.1,
    zeroCrossingRate: 0.05,
    spectralFlux: 3709.913,
    calculatedAt: new Date().toISOString(),
    framesBased: false,
    totalFrames: 1000
  }
};

const jsonComFFT = generateJSONOutput(mockCoreMetricsReal, null, {
  fileName: "1757900633847.wav",
  fileSize: 45634520
});

console.log('✅ technicalData keys:', Object.keys(jsonComFFT.technicalData));
console.log('✅ bandEnergies:', !!jsonComFFT.technicalData.bandEnergies ? 'EXISTE' : 'FALTANDO');
console.log('✅ frequencyBands:', !!jsonComFFT.technicalData.frequencyBands ? 'EXISTE' : 'FALTANDO');
console.log('✅ spectralCentroidHz:', !!jsonComFFT.technicalData.spectralCentroidHz ? 'EXISTE' : 'FALTANDO');
console.log('✅ frequenciaCentral:', !!jsonComFFT.technicalData.frequenciaCentral ? 'EXISTE' : 'FALTANDO');
console.log('✅ limiteAgudos85:', !!jsonComFFT.technicalData.limiteAgudos85 ? 'EXISTE' : 'FALTANDO');

console.log('\n🎯 CONCLUSÃO:');
console.log('O problema não está no json-output.js, mas sim no processamento FFT em produção!');
console.log('O pipeline precisa garantir que coreMetrics.fft seja populado com dados completos.');

console.log('\n🔧 PRÓXIMOS PASSOS:');
console.log('1. Verificar se core-metrics.js está processando FFT corretamente em produção');
console.log('2. Garantir que calculateFFTMetrics() é chamado e retorna dados');
console.log('3. Verificar se há erros silenciosos no processamento FFT');