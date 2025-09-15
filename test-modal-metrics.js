import { generateJSONOutput } from './api/audio/json-output.js';

console.log('🔍 Testando métricas para o modal...');

// Mock de dados completos baseado no que o pipeline deveria produzir
const mockCoreMetrics = {
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
  fft: {
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
    duration: 172.44
  }
};

// Gerar JSON output
const jsonOutput = generateJSONOutput(mockCoreMetrics, null, {
  fileName: "test-modal.wav",
  fileSize: 45634520
});

console.log('\n📋 VERIFICAÇÃO DAS MÉTRICAS DO MODAL:');

// Verificar métricas que aparecem no modal
const modalMetrics = [
  'Volume Médio (energia)',
  'Dinâmica (diferença entre alto/baixo)',
  'Fator de crista',
  'pico real (dbtp)',
  'Volume Integrado (padrão streaming)',
  'Largura Estéreo',
  'Balanço Esquerdo/Direito',
  'Frequência Central (trifilo)',
  'Limite de Agudos (85%)',
  'zero crossing rate',
  'Mudança Espectral',
  'Uniformidade (linear vs peaks)',
  'Variação de Volume (consistência)'
];

console.log('\n✅ technicalData.bandEnergies:', {
  exists: !!(jsonOutput.technicalData.bandEnergies),
  keys: jsonOutput.technicalData.bandEnergies ? Object.keys(jsonOutput.technicalData.bandEnergies) : [],
  sample: jsonOutput.technicalData.bandEnergies?.subBass
});

console.log('\n✅ technicalData.frequencyBands:', {
  exists: !!(jsonOutput.technicalData.frequencyBands),
  keys: jsonOutput.technicalData.frequencyBands ? Object.keys(jsonOutput.technicalData.frequencyBands) : []
});

console.log('\n🎵 Métricas espectrais para o modal:');
console.log('- frequenciaCentral:', jsonOutput.technicalData.frequenciaCentral);
console.log('- limiteAgudos85:', jsonOutput.technicalData.limiteAgudos85);
console.log('- mudancaEspectral:', jsonOutput.technicalData.mudancaEspectral);
console.log('- uniformidade:', jsonOutput.technicalData.uniformidade);
console.log('- spectralCentroidHz:', jsonOutput.technicalData.spectralCentroidHz);
console.log('- spectralRolloffHz:', jsonOutput.technicalData.spectralRolloffHz);
console.log('- spectralFlux:', jsonOutput.technicalData.spectralFlux);
console.log('- spectralFlatness:', jsonOutput.technicalData.spectralFlatness);

console.log('\n🎚️ Métricas dinâmicas:');
console.log('- dynamicRange:', jsonOutput.technicalData.dynamicRange);
console.log('- ttDR:', jsonOutput.technicalData.ttDR);
console.log('- crestFactor:', jsonOutput.technicalData.crestFactor);
console.log('- truePeakDbtp:', jsonOutput.technicalData.truePeakDbtp);

console.log('\n🔊 Métricas stereo:');
console.log('- stereoCorrelation:', jsonOutput.technicalData.stereoCorrelation);
console.log('- stereoWidth:', jsonOutput.technicalData.stereoWidth);
console.log('- balanceLR:', jsonOutput.technicalData.balanceLR);

console.log('\n📊 Métricas LUFS:');
console.log('- lufsIntegrated:', jsonOutput.technicalData.lufsIntegrated);
console.log('- lufsShortTerm:', jsonOutput.technicalData.lufsShortTerm);
console.log('- lufsMomentary:', jsonOutput.technicalData.lufsMomentary);
console.log('- lra:', jsonOutput.technicalData.lra);

console.log('\n🏁 Teste concluído.');