// 🔍 TESTE CRÍTICO - Verificar pipeline FFT
// Testa se os frames FFT estão sendo gerados corretamente

console.log('🔍 TESTE CRÍTICO: Pipeline FFT para Spectral Bands...\n');

async function testFFTPipeline() {
  try {
    // Carregar módulos
    console.log('⏳ Carregando módulos...');
    const coreMetricsModule = await import('./work/api/audio/core-metrics.js');
    console.log('✅ Módulos carregados\n');

    // Gerar áudio sintético pequeno para teste
    console.log('🎵 Gerando áudio sintético para teste...');
    const sampleRate = 48000;
    const duration = 1; // 1 segundo apenas
    const samples = sampleRate * duration;
    
    const leftChannel = new Float32Array(samples);
    const rightChannel = new Float32Array(samples);
    
    // Tom puro em 440Hz (A4) com harmônicos
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const fundamental = Math.sin(2 * Math.PI * 440 * t) * 0.3;
      const harmonic2 = Math.sin(2 * Math.PI * 880 * t) * 0.2;  // 2ª harmônica
      const harmonic3 = Math.sin(2 * Math.PI * 1320 * t) * 0.1; // 3ª harmônica
      
      const signal = fundamental + harmonic2 + harmonic3;
      leftChannel[i] = signal;
      rightChannel[i] = signal;
    }
    
    console.log(`✅ Áudio gerado: ${samples} samples, ${sampleRate}Hz\n`);

    // Usar dados sintéticos diretamente no Core Metrics
    console.log('🔄 Testando Core Metrics diretamente...');
    const segmentedData = {
      leftChannel,
      rightChannel,
      sampleRate,
      _metadata: { fileName: 'test_synthetic.wav' }
    };

    // Fase 2: Core Metrics (inclui spectral bands)
    console.log('\n🔄 Fase 2: Core Metrics com Spectral Bands...');
    const coreMetricsCalculator = new coreMetricsModule.CoreAudioMetricsCalculator();
    
    // Testar apenas spectral bands
    const spectralResult = await coreMetricsCalculator.calculateSpectralBandsMetrics(
      segmentedData.framesFFT, 
      { jobId: 'test_fft' }
    );
    
    console.log('\n📊 Resultado das Spectral Bands:', {
      valid: spectralResult?.valid,
      totalPercentage: spectralResult?.totalPercentage,
      hasBands: !!spectralResult?.bands,
      bandsKeys: spectralResult?.bands ? Object.keys(spectralResult.bands) : null,
      sampleBand: spectralResult?.bands?.sub || null,
      _status: spectralResult?._status
    });

    if (spectralResult?.bands) {
      console.log('\n🎯 BANDAS CALCULADAS CORRETAMENTE:');
      Object.entries(spectralResult.bands).forEach(([name, data]) => {
        console.log(`   ${name}: ${data.energy_db?.toFixed(2) || 'N/A'} dB, ${data.percentage?.toFixed(1) || 'N/A'}%`);
      });
    } else {
      console.error('❌ BANDAS NÃO FORAM CALCULADAS!');
    }

    // Teste completo do core metrics
    console.log('\n🔄 Fase 3: Core Metrics Completo...');
    const fullMetrics = await coreMetricsCalculator.calculateCoreMetrics(segmentedData);
    
    console.log('\n📊 Core Metrics - Spectral Bands:', {
      hasSpectralBands: !!fullMetrics.spectralBands,
      spectralBandsValid: fullMetrics.spectralBands?.valid,
      spectralBandsHasBands: !!fullMetrics.spectralBands?.bands,
      spectralBandsKeys: fullMetrics.spectralBands?.bands ? Object.keys(fullMetrics.spectralBands.bands) : null
    });

    // Resultado final
    if (fullMetrics.spectralBands?.bands) {
      console.log('\n✅ SUCESSO: Pipeline FFT → Spectral Bands funcionando!');
      console.log('🎯 As bandas estão sendo calculadas corretamente');
      console.log('💡 O problema deve estar em outro lugar do pipeline');
    } else {
      console.error('\n❌ FALHA: Pipeline FFT → Spectral Bands não está funcionando');
      console.error('🔧 As bandas espectrais não estão sendo calculadas');
    }

  } catch (error) {
    console.error('\n💥 ERRO CRÍTICO no teste:', error);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testFFTPipeline().then(() => {
  console.log('\n🏁 Teste FFT concluído');
}).catch(err => {
  console.error('\n💥 Falha no teste:', err);
});