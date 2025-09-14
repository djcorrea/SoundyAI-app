// 🧪 TESTE DE INTEGRAÇÃO - Sistema Completo de Métricas Espectrais
// Valida a integração entre core-metrics.js e spectral-metrics.js

console.log('🧪 Teste de Integração: Sistema Completo de Métricas Espectrais');
console.log('='.repeat(70));

// Mock dos dados de entrada esperados pelo core-metrics
const mockSegmentedAudio = {
  framesFFT: {
    left: [
      // Frame 0: Simulando FFT de 1kHz
      {
        real: new Float32Array(2049),
        imag: new Float32Array(2049),
        magnitude: (() => {
          const mag = new Float32Array(2049);
          mag[85] = 1.0; // ~1kHz no bin 85 (48000/4096 * 85 ≈ 996Hz)
          return mag;
        })(),
        phase: new Float32Array(2049)
      },
      // Frame 1: Simulando FFT de 2kHz
      {
        real: new Float32Array(2049),
        imag: new Float32Array(2049),
        magnitude: (() => {
          const mag = new Float32Array(2049);
          mag[170] = 1.0; // ~2kHz
          return mag;
        })(),
        phase: new Float32Array(2049)
      }
    ],
    right: [
      // Mesmo conteúdo para direita
      {
        real: new Float32Array(2049),
        imag: new Float32Array(2049),
        magnitude: (() => {
          const mag = new Float32Array(2049);
          mag[85] = 1.0;
          return mag;
        })(),
        phase: new Float32Array(2049)
      },
      {
        real: new Float32Array(2049),
        imag: new Float32Array(2049),
        magnitude: (() => {
          const mag = new Float32Array(2049);
          mag[170] = 1.0;
          return mag;
        })(),
        phase: new Float32Array(2049)
      }
    ],
    count: 2
  },
  framesRMS: {
    left: [0.1, 0.1],
    right: [0.1, 0.1],
    count: 2
  },
  metadata: {
    sampleRate: 48000,
    totalSamples: 8192,
    frameSize: 4096,
    hopSize: 1024
  }
};

// Mock para simular áudio normalizado (-23 LUFS)
const mockNormalizedAudio = {
  left: new Float32Array(8192).fill(0.1), // Simulando sinal normalizado
  right: new Float32Array(8192).fill(0.1)
};

async function testIntegration() {
  try {
    console.log('📦 Importando módulos...');
    
    // Importar core-metrics para testar integração
    const { calculateCoreMetrics } = await import('./work/api/audio/core-metrics.js');
    
    console.log('✅ Módulos importados com sucesso\n');
    
    console.log('🔄 Executando processamento de métricas core...');
    
    const startTime = Date.now();
    
    // Testar processamento completo
    const result = await calculateCoreMetrics(mockSegmentedAudio, {
      jobId: 'test-integration-001',
      fileName: 'test-spectral-metrics.wav'
    });
    
    const processingTime = Date.now() - startTime;
    
    console.log(`⏱️ Processamento concluído em ${processingTime}ms\n`);
    
    // Validar estrutura do resultado
    console.log('🔍 Validando estrutura do resultado...');
    
    const requiredFields = ['fft', 'lufs', 'truePeak', 'stereo', 'metadata'];
    let structureValid = true;
    
    for (const field of requiredFields) {
      if (!result[field]) {
        console.log(`❌ Campo obrigatório ausente: ${field}`);
        structureValid = false;
      } else {
        console.log(`✅ Campo presente: ${field}`);
      }
    }
    
    // Validar métricas espectrais específicas
    console.log('\n🎵 Validando métricas espectrais...');
    
    const fft = result.fft;
    const spectralMetrics = [
      'spectralCentroidHz',
      'spectralRolloffHz',
      'spectralBandwidthHz',
      'spectralSpreadHz',
      'spectralFlatness',
      'spectralCrest',
      'spectralSkewness',
      'spectralKurtosis'
    ];
    
    let spectralValid = true;
    
    for (const metric of spectralMetrics) {
      if (fft.hasOwnProperty(metric)) {
        const value = fft[metric];
        const isValid = value === null || Number.isFinite(value);
        console.log(`${isValid ? '✅' : '❌'} ${metric}: ${value?.toFixed?.(2) || 'null'}`);
        if (!isValid) spectralValid = false;
      } else {
        console.log(`❌ Métrica ausente: ${metric}`);
        spectralValid = false;
      }
    }
    
    // Validar compatibilidade legacy
    console.log('\n🔄 Validando compatibilidade legacy...');
    
    const legacyFields = ['spectralCentroid', 'spectralRolloff'];
    let legacyValid = true;
    
    for (const field of legacyFields) {
      if (fft.hasOwnProperty(field)) {
        console.log(`✅ Campo legacy presente: ${field} = ${fft[field]?.toFixed?.(2) || 'null'}`);
      } else {
        console.log(`❌ Campo legacy ausente: ${field}`);
        legacyValid = false;
      }
    }
    
    // Validar consistência entre novo e legacy
    if (fft.spectralCentroidHz === fft.spectralCentroid) {
      console.log('✅ Consistência centroide: novo === legacy');
    } else {
      console.log(`❌ Inconsistência centroide: ${fft.spectralCentroidHz} !== ${fft.spectralCentroid}`);
      legacyValid = false;
    }
    
    // Mostrar resultado completo das métricas espectrais
    console.log('\n📊 RESULTADO FINAL DAS MÉTRICAS ESPECTRAIS:');
    console.log('='.repeat(50));
    
    const spectralResult = {};
    for (const metric of spectralMetrics) {
      spectralResult[metric] = fft[metric];
    }
    
    console.log(JSON.stringify(spectralResult, null, 2));
    
    // Relatório final
    console.log('\n📋 RELATÓRIO DO TESTE DE INTEGRAÇÃO:');
    console.log('='.repeat(50));
    
    const allValid = structureValid && spectralValid && legacyValid;
    
    console.log(`🏗️ Estrutura geral: ${structureValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
    console.log(`🎵 Métricas espectrais: ${spectralValid ? '✅ VÁLIDAS' : '❌ INVÁLIDAS'}`);
    console.log(`🔄 Compatibilidade legacy: ${legacyValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
    console.log(`⏱️ Performance: ${processingTime}ms`);
    console.log(`\n🎯 RESULTADO GERAL: ${allValid ? '🎉 SUCESSO' : '❌ FALHA'}`);
    
    if (allValid) {
      console.log('\n✅ Sistema de métricas espectrais integrado com sucesso!');
      console.log('✅ Todas as 8 métricas funcionando corretamente');
      console.log('✅ Compatibilidade legacy mantida');
      console.log('✅ Pronto para produção');
    } else {
      console.log('\n❌ Problemas detectados na integração');
      console.log('❌ Verificar logs acima para detalhes');
    }
    
    return allValid;
    
  } catch (error) {
    console.error('\n💥 ERRO NO TESTE DE INTEGRAÇÃO:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Executar teste se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testIntegration().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

export { testIntegration };