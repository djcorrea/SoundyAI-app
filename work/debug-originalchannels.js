// 🔍 DEBUG: Testar se originalChannels está chegando no core-metrics
import { segmentAudioTemporal } from './api/audio/temporal-segmentation.js';

async function debugOriginalChannels() {
  try {
    console.log('🔍 [DEBUG] Iniciando teste de originalChannels...');
    
    // Criar um buffer de áudio simples para teste
    const sampleRate = 48000;
    const duration = 1; // 1 segundo
    const samples = sampleRate * duration;
    
    // Gerar audio simples (sine wave)
    const leftChannel = new Float32Array(samples);
    const rightChannel = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      leftChannel[i] = Math.sin(2 * Math.PI * 440 * t) * 0.1; // 440Hz
      rightChannel[i] = Math.sin(2 * Math.PI * 880 * t) * 0.1; // 880Hz
    }
    
    console.log('🔍 [DEBUG] Audio buffer criado:', {
      sampleRate,
      leftSamples: leftChannel.length,
      rightSamples: rightChannel.length,
      duration
    });
    
    // Criar audioBuffer fake para testar
    const audioBuffer = {
      numberOfChannels: 2,
      sampleRate: sampleRate,
      getChannelData: (channel) => channel === 0 ? leftChannel : rightChannel
    };
    
    console.log('🔍 [DEBUG] Chamando segmentAudioTemporal...');
    const result = await segmentAudioTemporal(audioBuffer, { jobId: 'debug-test' });
    
    console.log('🔍 [DEBUG] Resultado da segmentação:');
    console.log('- Tem originalChannels?', 'originalChannels' in result);
    console.log('- Valor de originalChannels:', result.originalChannels);
    console.log('- Campos no nível raiz:', Object.keys(result));
    console.log('- Tipo do resultado:', typeof result);
    
    // Verificar se os campos obrigatórios estão presentes
    const requiredFields = ['framesFFT', 'framesRMS', 'originalChannels', 'timestamps'];
    const missingFields = requiredFields.filter(field => !(field in result));
    
    if (missingFields.length > 0) {
      console.error('❌ [ERROR] Campos faltando:', missingFields);
    } else {
      console.log('✅ [SUCCESS] Todos os campos obrigatórios estão presentes');
    }
    
    // Testar se core-metrics aceita esse resultado
    console.log('🔍 [DEBUG] Testando validação do core-metrics...');
    
    // Importar a validação
    const { calculateCoreMetrics } = await import('./api/audio/core-metrics.js');
    
    try {
      console.log('🔍 [DEBUG] Chamando calculateCoreMetrics...');
      const coreResult = await calculateCoreMetrics(result, { jobId: 'debug-test' });
      console.log('✅ [SUCCESS] Core metrics calculado com sucesso!');
      console.log('- Métricas principais:', Object.keys(coreResult));
    } catch (coreError) {
      console.error('❌ [ERROR] Erro no core-metrics:', coreError.message);
      console.error('- Código do erro:', coreError.code);
      console.error('- Stage:', coreError.stage);
    }
    
  } catch (error) {
    console.error('❌ [ERROR] Erro no debug:', error.message);
    console.error(error.stack);
  }
}

debugOriginalChannels().catch(console.error);