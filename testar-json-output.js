// testar-json-output.js - Testar a extração do json-output diretamente

// Simular estrutura do coreMetrics como seria produzida pelo core-metrics.js
const mockCoreMetrics = {
  fft: {
    aggregated: {
      spectralCentroidHz: 2847.5,
      spectralRolloffHz: 8420.3,
      spectralBandwidthHz: 1256.7,
      spectralSpreadHz: 891.2,
      spectralFlatness: 0.123,
      spectralCrest: 2.89,
      spectralSkewness: 0.67,
      spectralKurtosis: 3.21,
      zeroCrossingRate: 0.089,
      spectralFlux: 0.456,
      calculatedAt: Date.now()
    },
    frequencyBands: {
      left: {
        subBass: { energy: 0.12 },
        bass: { energy: 0.34 },
        lowMids: { energy: 0.28 },
        mids: { energy: 0.45 },
        highMids: { energy: 0.38 },
        presence: { energy: 0.29 },
        brilliance: { energy: 0.15 }
      }
    },
    frameCount: 512
  },
  lufs: {
    integrated: -14.5,
    shortTerm: -12.8,
    momentary: -11.2,
    lra: 7.3
  },
  truePeak: {
    maxDbtp: -2.1,
    maxLinear: 0.78
  }
};

console.log('🔍 TESTE: json-output.js com dados simulados do core-metrics...\n');

// Importar a função do json-output
try {
  const { extractTechnicalData } = await import('./api/audio/json-output.js');
  
  console.log('✅ Função extractTechnicalData importada com sucesso!');
  
  const result = extractTechnicalData(mockCoreMetrics);
  
  console.log('\n📊 RESULTADO DA EXTRAÇÃO:');
  console.log('Total de campos:', Object.keys(result).length);
  
  // Verificar métricas espectrais
  const metricasEspectrais = [
    'spectralCentroidHz', 'spectralRolloffHz', 'spectralFlatness',
    'spectralBandwidthHz', 'spectralCrest', 'zeroCrossingRate'
  ];
  
  console.log('\n🎯 MÉTRICAS ESPECTRAIS:');
  metricasEspectrais.forEach(metrica => {
    if (result[metrica] !== undefined) {
      console.log(`✅ ${metrica}: ${result[metrica]}`);
    } else {
      console.log(`❌ ${metrica}: AUSENTE`);
    }
  });
  
  // Verificar aliases
  console.log('\n🔗 ALIASES (Modal compatibility):');
  console.log(`✅ frequenciaCentral: ${result.frequenciaCentral || 'AUSENTE'}`);
  console.log(`✅ limiteAgudos85: ${result.limiteAgudos85 || 'AUSENTE'}`);
  
  // Verificar bandEnergies  
  console.log('\n🎶 BAND ENERGIES:');
  if (result.bandEnergies) {
    console.log('✅ bandEnergies:', Object.keys(result.bandEnergies));
  } else {
    console.log('❌ bandEnergies: AUSENTE');
  }
  
} catch (error) {
  console.error('❌ Erro ao importar json-output.js:', error.message);
  console.error('Stack:', error.stack);
}