// 🔍 ANÁLISE DOS LOGS DE DEPLOY - Métricas Espectrais Calculadas
// Vamos mapear todas as métricas que o pipeline está calculando

console.log('🔍 ANÁLISE COMPLETA: Métricas calculadas no pipeline\n');

// Baseado nos logs, o pipeline está calculando:
const pipelineMetrics = {
  spectral: {
    centroid: {
      description: 'Centro de massa espectral (Hz)',
      samples: [685.28, 412.73, 456.60, 612.89, 681.20, 366.78, 666.23, 884.01, 960.44, 1017.75],
      logFormat: '[AUDIO] centroid_calculated stage=spectral',
      avgValue: null // será calculado
    },
    rolloff: {
      description: 'Frequência de rolloff espectral (Hz)',
      samples: [691.41, 574.22, 632.81, 585.94, 785.16, 433.59, 1277.34, 2191.41, 2460.94],
      logFormat: '[AUDIO] rolloff_calculated stage=spectral',
      avgValue: null
    },
    bandwidth: {
      description: 'Largura de banda espectral',
      calculated: true
    },
    spread: {
      description: 'Dispersão espectral',
      calculated: true
    },
    flatness: {
      description: 'Planeza espectral',
      calculated: true
    },
    crest: {
      description: 'Fator de cresta espectral',
      calculated: true
    },
    skewness: {
      description: 'Assimetria espectral',
      calculated: true
    },
    kurtosis: {
      description: 'Curtose espectral',
      calculated: true
    }
  },
  
  amplitude: {
    energy: {
      description: 'Energia por frame',
      samples: [10684.826062, 5362.074379, 3806.673391, 55395.333364, 12822.159999],
      logFormat: 'energy field in spectral logs'
    },
    meanMag2: {
      description: 'Magnitude média quadrática',
      samples: [5.214654, 2.616923, 1.857820, 27.035302, 6.257765],
      logFormat: 'meanMag2 field in spectral logs'
    }
  },
  
  lufs: {
    integrated: 'LUFS integrado (-23 a 0)',
    shortTerm: 'LUFS short-term',
    momentary: 'LUFS momentary',
    lra: 'Loudness Range (LRA)'
  },
  
  truePeak: {
    maxDbtp: 'True Peak máximo (dBTP)',
    maxLinear: 'True Peak linear',
    oversamplingFactor: 'Fator de oversampling',
    clippingCount: 'Contagem de clipping'
  },
  
  stereo: {
    correlation: 'Correlação estéreo',
    balance: 'Balanço L/R',
    width: 'Largura estéreo',
    isMonoCompatible: 'Compatibilidade mono',
    hasPhaseIssues: 'Problemas de fase'
  },
  
  bands: {
    sub: '20-60 Hz (Sub-bass)',
    low_bass: '60-250 Hz (Bass)',
    upper_bass: '250-500 Hz (Upper Bass)',
    low_mid: '500-1k Hz (Low Mid)',
    mid: '1k-2k Hz (Mid)',
    high_mid: '2k-4k Hz (High Mid)',
    brilho: '4k-8k Hz (Brilliance)',
    presenca: '8k-12k Hz (Presence)'
  },
  
  derived: {
    dynamicRange: 'Faixa dinâmica (dB)',
    crestFactor: 'Fator de cresta',
    headroom: 'Headroom disponível',
    rmsLevels: 'Níveis RMS por frame',
    clippingSamples: 'Amostras com clipping',
    dcOffset: 'Offset DC',
    thdPercent: 'Distorção harmônica total (%)'
  }
};

// Calcular valores médios dos samples
pipelineMetrics.spectral.centroid.avgValue = 
  pipelineMetrics.spectral.centroid.samples.reduce((a,b) => a+b, 0) / 
  pipelineMetrics.spectral.centroid.samples.length;

pipelineMetrics.spectral.rolloff.avgValue = 
  pipelineMetrics.spectral.rolloff.samples.reduce((a,b) => a+b, 0) / 
  pipelineMetrics.spectral.rolloff.samples.length;

console.log('📊 MÉTRICAS ESPECTRAIS IDENTIFICADAS:');
console.log(`  Centroid médio: ${pipelineMetrics.spectral.centroid.avgValue.toFixed(1)} Hz`);
console.log(`  Rolloff médio: ${pipelineMetrics.spectral.rolloff.avgValue.toFixed(1)} Hz`);
console.log(`  Frames processados: ${pipelineMetrics.spectral.centroid.samples.length} samples`);

console.log('\n🎯 MÉTRICAS QUE DEVEM APARECER NA UI:');
console.log('✅ Já mapeadas:');
console.log('  - Score geral');
console.log('  - LUFS (integrated, short-term, momentary)');
console.log('  - True Peak (dBTP)');
console.log('  - Correlação estéreo');
console.log('  - LRA');

console.log('\n❌ FALTANDO na UI:');
console.log('  - Spectral Centroid (centro de massa espectral)');
console.log('  - Spectral Rolloff (frequência de corte)');
console.log('  - Spectral Bandwidth, Spread, Flatness');
console.log('  - Energy e Mean Magnitude por frame');
console.log('  - Bandas de frequência detalhadas (8 bandas)');
console.log('  - Crest Factor, Dynamic Range');
console.log('  - Clipping samples, DC Offset, THD');
console.log('  - Informações detalhadas de True Peak');

console.log('\n🔧 FREQUÊNCIAS DETECTADAS NOS LOGS:');
console.log('  Range baixo: 340-500 Hz (fundamentais)');
console.log('  Range médio: 500-1200 Hz (harmônicos)');
console.log('  Range alto: 2000-9000 Hz (brilho/presença)');
console.log('  Picos especiais: 3449Hz, 5477Hz (overtones)');

console.log('\n⚠️ PROBLEMAS IDENTIFICADOS:');
console.log('1. UI mostra apenas métricas básicas');
console.log('2. Tabela de frequências com valores "exatos" (não médias)');
console.log('3. Métricas espectrais avançadas não mapeadas');
console.log('4. Bandas de frequência não detalhadas');
console.log('5. Informações de energia por frame ausentes');

console.log('\n💡 SOLUÇÕES NECESSÁRIAS:');
console.log('1. Mapear todas as métricas espectrais no normalizeBackendAnalysisData');
console.log('2. Criar campos na UI para métricas avançadas');
console.log('3. Corrigir tabela de frequências com valores calculados');
console.log('4. Adicionar seção de análise espectral detalhada');
console.log('5. Mapear bandas de frequência individuais');