/**
 * 🔍 TESTE: Verificar erros reais sem fallbacks
 * 
 * Com os fallbacks removidos, vamos ver qual é o erro real que impede
 * o cálculo das métricas espectrais na produção.
 */

console.log('🧪 TESTE: Análise de áudio SEM FALLBACKS');
console.log('=' .repeat(60));

// Simular um processamento real
async function testRealProcessing() {
  console.log('🎵 Simulando análise de áudio real...');
  
  try {
    // Importar as dependências do pipeline
    const path = await import('path');
    const fs = await import('fs');
    
    // Simular estrutura de arquivo de teste
    const testFile = {
      originalname: 'test-audio.wav',
      buffer: Buffer.alloc(1024), // Buffer vazio para teste
      mimetype: 'audio/wav'
    };
    
    console.log('🔗 Arquivo de teste criado');
    
    // Tentar importar e executar o pipeline
    const { segmentAudioTemporal } = await import('./api/audio/temporal-segmentation.js');
    const { CoreMetricsProcessor } = await import('./api/audio/core-metrics.js');
    const { generateJSONOutput } = await import('./api/audio/json-output.js');
    
    console.log('✅ Módulos importados com sucesso');
    
    // Executar pipeline completo
    console.log('🚀 Iniciando pipeline completo...');
    
    // Fase 5.2: Segmentação
    console.log('📊 Fase 5.2: Segmentação...');
    
    // Criar um mock de áudio decodificado (similar ao que vem da Fase 5.1)
    const mockAudioBuffer = {
      sampleRate: 48000,
      leftChannel: new Float32Array(48000),  // 1 segundo de áudio silencioso - canal esquerdo
      rightChannel: new Float32Array(48000), // 1 segundo de áudio silencioso - canal direito
      numberOfChannels: 2,
      length: 48000,
      duration: 1.0 // 1 segundo
    };
    
    const segmentedAudio = segmentAudioTemporal(mockAudioBuffer);
    
    // Fase 5.3: Core Metrics  
    console.log('🧮 Fase 5.3: Core Metrics...');
    const processor = new CoreMetricsProcessor();
    const coreMetrics = await processor.processMetrics(segmentedAudio);
    
    // Fase 5.4: JSON Output
    console.log('📝 Fase 5.4: JSON Output...');
    const jsonOutput = generateJSONOutput(coreMetrics);
    
    console.log('✅ Pipeline executado com sucesso!');
    console.log('📊 Métricas espectrais presentes:', {
      fftAggregated: !!coreMetrics.fft?.aggregated,
      spectralCentroidHz: jsonOutput.technicalData.spectralCentroidHz,
      spectralRolloffHz: jsonOutput.technicalData.spectralRolloffHz,
      bandEnergies: !!jsonOutput.technicalData.bandEnergies
    });
    
    return jsonOutput;
    
  } catch (error) {
    console.error('❌ ERRO NO PIPELINE:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    // Identificar onde exatamente falhou
    if (error.message.includes('FFT')) {
      console.error('🔍 DIAGNÓSTICO: Erro relacionado ao FFT processing');
    }
    if (error.message.includes('spectrum')) {
      console.error('🔍 DIAGNÓSTICO: Erro no SpectrumAnalyzer');
    }
    if (error.message.includes('segment')) {
      console.error('🔍 DIAGNÓSTICO: Erro na segmentação de áudio');
    }
    
    throw error;
  }
}

// Executar teste
testRealProcessing()
  .then(result => {
    console.log('\n🎯 RESULTADO DO TESTE:');
    console.log('✅ Pipeline funcionou - métricas espectrais calculadas com sucesso');
    console.log('📊 JSON completo:', JSON.stringify(result.technicalData, null, 2));
  })
  .catch(error => {
    console.log('\n❌ TESTE FALHOU:');
    console.log('❌ Erro capturado:', error.message);
    console.log('❌ Agora sabemos onde está o problema real!');
  });