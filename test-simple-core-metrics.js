// 🔍 TESTE SIMPLES - Core Metrics Spectral Bands
// Testa se spectralBands.bands está sendo calculado corretamente no pipeline

console.log('🔍 TESTE SIMPLES: Core Metrics Spectral Bands...\n');

async function testCoreMetrics() {
  try {
    // Carregar core metrics
    console.log('⏳ Carregando CoreAudioMetricsCalculator...');
    const coreMetricsModule = await import('./work/api/audio/core-metrics.js');
    console.log('✅ Carregado\n');

    // Gerar áudio sintético simples
    console.log('🎵 Gerando áudio sintético...');
    const sampleRate = 48000;
    const duration = 2; // 2 segundos
    const samples = sampleRate * duration;
    
    const leftChannel = new Float32Array(samples);
    const rightChannel = new Float32Array(samples);
    
    // Tom com múltiplas frequências para garantir espectro interessante
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // 200Hz (bass), 800Hz (mid), 3000Hz (high-mid)
      const signal = 
        Math.sin(2 * Math.PI * 200 * t) * 0.4 +    // Bass
        Math.sin(2 * Math.PI * 800 * t) * 0.3 +    // Mid
        Math.sin(2 * Math.PI * 3000 * t) * 0.2;    // High-mid
      
      leftChannel[i] = signal;
      rightChannel[i] = signal;
    }
    
    console.log(`✅ Áudio gerado: ${samples} samples, ${sampleRate}Hz\n`);

    // Testar Core Metrics
    console.log('🔄 Executando calculateCoreMetrics...');
    const segmentedData = {
      leftChannel,
      rightChannel,
      sampleRate,
      _metadata: { fileName: 'test_synthetic.wav' }
    };

    const result = await coreMetricsModule.calculateCoreMetrics(segmentedData);
    
    console.log('\n📊 RESULTADO CRÍTICO - spectralBands:');
    console.log('─'.repeat(50));
    console.log('hasSpectralBands:', !!result.spectralBands);
    console.log('spectralBands keys:', result.spectralBands ? Object.keys(result.spectralBands) : null);
    console.log('spectralBands.bands exists:', !!result.spectralBands?.bands);
    console.log('spectralBands.bands keys:', result.spectralBands?.bands ? Object.keys(result.spectralBands.bands) : null);
    console.log('spectralBands valid:', result.spectralBands?.valid);
    console.log('spectralBands totalPercentage:', result.spectralBands?.totalPercentage);
    console.log('spectralBands _status:', result.spectralBands?._status);

    if (result.spectralBands?.bands) {
      console.log('\n🎯 BANDAS ENCONTRADAS:');
      console.log('─'.repeat(50));
      Object.entries(result.spectralBands.bands).forEach(([name, data]) => {
        console.log(`${name}:`, {
          energy_db: data.energy_db?.toFixed(2) || 'N/A',
          percentage: data.percentage?.toFixed(1) || 'N/A',
          status: data.status || 'N/A'
        });
      });
      
      console.log('\n✅ SUCESSO: spectralBands.bands está sendo calculado!');
      console.log('💡 O problema não é no Core Metrics, deve ser no JSON Output');
      
    } else {
      console.error('\n❌ FALHA: spectralBands.bands não foi calculado');
      console.error('🔧 Problema está no cálculo das bandas espectrais');
      
      // Debug mais profundo
      console.log('\n🔍 Debug detalhado do resultado:');
      console.log('result keys:', Object.keys(result));
      console.log('spectralBands structure:', result.spectralBands);
    }

    // Testar JSON Output se as bandas existirem
    if (result.spectralBands?.bands) {
      console.log('\n🔄 Testando JSON Output...');
      try {
        const jsonOutputModule = await import('./work/api/audio/json-output.js');
        const jsonResult = jsonOutputModule.generateJSONOutput(result, null, { fileName: 'test.wav' });
        
        console.log('\n📊 JSON Output - spectral_balance:');
        console.log('hasSpectralBalance:', !!jsonResult.technicalData?.spectral_balance);
        console.log('spectral_balance _status:', jsonResult.technicalData?.spectral_balance?._status);
        
        if (jsonResult.technicalData?.spectral_balance?._status === 'not_calculated') {
          console.error('❌ JSON Output está retornando not_calculated mesmo com bandas válidas!');
          console.error('🔧 Problema está na condição if (coreMetrics.spectralBands?.bands)');
        } else {
          console.log('✅ JSON Output processou as bandas corretamente');
        }
        
      } catch (jsonError) {
        console.error('💥 Erro no JSON Output:', jsonError.message);
      }
    }

  } catch (error) {
    console.error('\n💥 ERRO CRÍTICO:', error);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testCoreMetrics().then(() => {
  console.log('\n🏁 Teste concluído');
}).catch(err => {
  console.error('\n💥 Falha no teste:', err);
});