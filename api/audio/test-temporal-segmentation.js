/**
 * Testes para Temporal Segmentation - Fase 5.2
 * 
 * Validação completa da segmentação temporal com casos de teste específicos
 * Garante conformidade com os requisitos da auditoria
 */

import { segmentAudioTemporal, validateSegmentationConfig, calculateFrameTiming } from './temporal-segmentation.js';

// Simulação de dados da Fase 5.1 para testes
function createMockAudioBuffer(durationSeconds, frequency = 440) {
  const sampleRate = 48000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  
  const leftChannel = new Float32Array(numSamples);
  const rightChannel = new Float32Array(numSamples);
  
  // Gerar sine waves com frequências ligeiramente diferentes
  for (let i = 0; i < numSamples; i++) {
    leftChannel[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
    rightChannel[i] = Math.sin(2 * Math.PI * (frequency * 1.1) * i / sampleRate) * 0.4;
  }
  
  return {
    sampleRate: sampleRate,
    numberOfChannels: 2,
    length: numSamples,
    duration: durationSeconds,
    data: leftChannel,
    leftChannel: leftChannel,
    rightChannel: rightChannel,
    getChannelData: function(channel) {
      if (channel === 0) return this.leftChannel;
      if (channel === 1) return this.rightChannel;
      throw new Error(`Canal ${channel} não existe`);
    },
    _metadata: {
      originalFormat: '.wav',
      processingTime: 100,
      decodedAt: new Date().toISOString(),
      stereoProcessing: true
    }
  };
}

/**
 * Executar teste com resultado formatado
 */
async function runTest(testName, testFn) {
  console.log(`\n🧪 ${testName}`);
  console.log('═'.repeat(60));
  
  const startTime = Date.now();
  
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    console.log(`✅ SUCESSO (${duration}ms)`);
    if (result && typeof result === 'object') {
      console.log('Resultado:', JSON.stringify(result, null, 2));
    }
    
    return { success: true, duration, result };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log(`❌ FALHA (${duration}ms)`);
    console.log(`Erro: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    
    return { success: false, duration, error: error.message };
  }
}

/**
 * Teste 1: Validar configuração da segmentação
 */
async function testSegmentationConfig() {
  const config = validateSegmentationConfig();
  
  // Verificações obrigatórias
  if (config.sampleRate !== 48000) {
    throw new Error(`Sample rate incorreto: ${config.sampleRate} !== 48000`);
  }
  
  if (config.fft.size !== 4096) {
    throw new Error(`FFT size incorreto: ${config.fft.size} !== 4096`);
  }
  
  if (config.fft.hop !== 1024) {
    throw new Error(`FFT hop incorreto: ${config.fft.hop} !== 1024`);
  }
  
  if (config.fft.overlap !== '75.0%') {
    throw new Error(`FFT overlap incorreto: ${config.fft.overlap} !== 75.0%`);
  }
  
  if (config.rms.blockDurationMs !== 300) {
    throw new Error(`RMS block duration incorreto: ${config.rms.blockDurationMs} !== 300`);
  }
  
  if (config.rms.hopDurationMs !== 100) {
    throw new Error(`RMS hop duration incorreto: ${config.rms.hopDurationMs} !== 100`);
  }
  
  if (config.rms.blockSamples !== 14400) {
    throw new Error(`RMS block samples incorreto: ${config.rms.blockSamples} !== 14400`);
  }
  
  if (config.rms.hopSamples !== 4800) {
    throw new Error(`RMS hop samples incorreto: ${config.rms.hopSamples} !== 4800`);
  }
  
  return {
    configValid: true,
    ...config
  };
}

/**
 * Teste 2: Segmentação de áudio de 1 segundo (validação obrigatória)
 */
async function testOneSecondAudio() {
  const audioBuffer = createMockAudioBuffer(1.0, 1000); // 1 segundo, 1kHz
  const segmented = segmentAudioTemporal(audioBuffer);
  
  // Validação FFT: deve gerar exatamente 43 janelas
  const expectedFFTFrames = Math.floor((48000 - 4096) / 1024) + 1; // 43
  if (segmented.framesFFT.count !== expectedFFTFrames) {
    throw new Error(`FFT frames incorreto: ${segmented.framesFFT.count} !== ${expectedFFTFrames}`);
  }
  
  // Validação RMS: deve gerar 5 blocos (0s, 100ms, 200ms, 300ms, 400ms)
  const expectedRMSFrames = 5;
  if (segmented.framesRMS.count !== expectedRMSFrames) {
    throw new Error(`RMS frames incorreto: ${segmented.framesRMS.count} !== ${expectedRMSFrames}`);
  }
  
  // Verificar tamanhos dos frames
  if (segmented.framesFFT.left[0].length !== 4096) {
    throw new Error(`FFT frame size incorreto: ${segmented.framesFFT.left[0].length} !== 4096`);
  }
  
  if (segmented.framesRMS.left[0].length !== 14400) {
    throw new Error(`RMS frame size incorreto: ${segmented.framesRMS.left[0].length} !== 14400`);
  }
  
  // Verificar consistência entre canais
  if (segmented.framesFFT.left.length !== segmented.framesFFT.right.length) {
    throw new Error(`FFT channels inconsistentes: L=${segmented.framesFFT.left.length}, R=${segmented.framesFFT.right.length}`);
  }
  
  if (segmented.framesRMS.left.length !== segmented.framesRMS.right.length) {
    throw new Error(`RMS channels inconsistentes: L=${segmented.framesRMS.left.length}, R=${segmented.framesRMS.right.length}`);
  }
  
  return {
    audioLength: audioBuffer.length,
    duration: audioBuffer.duration,
    fftFrames: segmented.framesFFT.count,
    rmsFrames: segmented.framesRMS.count,
    fftFrameSize: segmented.framesFFT.frameSize,
    rmsFrameSize: segmented.framesRMS.frameSize,
    timing: calculateFrameTiming(audioBuffer.length)
  };
}

/**
 * Teste 3: Janela Hann aplicada corretamente
 */
async function testHannWindowing() {
  const audioBuffer = createMockAudioBuffer(0.5, 440); // 0.5 segundos
  const segmented = segmentAudioTemporal(audioBuffer);
  
  // Verificar que a janela foi aplicada (primeiro e último sample devem ser próximos de zero)
  const firstFrame = segmented.framesFFT.left[0];
  
  if (Math.abs(firstFrame[0]) > 0.01) {
    throw new Error(`Janela Hann não aplicada: primeiro sample = ${firstFrame[0]} (deveria ser ~0)`);
  }
  
  if (Math.abs(firstFrame[firstFrame.length - 1]) > 0.01) {
    throw new Error(`Janela Hann não aplicada: último sample = ${firstFrame[firstFrame.length - 1]} (deveria ser ~0)`);
  }
  
  // Verificar que o meio da janela tem amplitude maior
  const middleSample = firstFrame[Math.floor(firstFrame.length / 2)];
  if (Math.abs(middleSample) < 0.1) {
    throw new Error(`Janela Hann suspeita: meio da janela = ${middleSample} (deveria ter amplitude maior)`);
  }
  
  return {
    hannApplied: true,
    firstSample: firstFrame[0],
    lastSample: firstFrame[firstFrame.length - 1],
    middleSample: middleSample,
    frameCount: segmented.framesFFT.count
  };
}

/**
 * Teste 4: Zero-padding em áudio curto
 */
async function testZeroPadding() {
  const audioBuffer = createMockAudioBuffer(0.25, 440); // 0.25 segundos (12000 samples)
  const segmented = segmentAudioTemporal(audioBuffer);
  
  // Verificar que o último frame RMS tem zero-padding
  const lastRMSFrame = segmented.framesRMS.left[segmented.framesRMS.left.length - 1];
  
  // Deve haver zeros no final do último frame
  let zeroCount = 0;
  for (let i = lastRMSFrame.length - 1; i >= 0; i--) {
    if (lastRMSFrame[i] === 0.0) {
      zeroCount++;
    } else {
      break;
    }
  }
  
  if (zeroCount === 0) {
    throw new Error('Zero-padding não detectado no último frame RMS');
  }
  
  return {
    audioLength: audioBuffer.length,
    rmsFrames: segmented.framesRMS.count,
    lastFrameZeros: zeroCount,
    frameSize: lastRMSFrame.length,
    zeroPaddingWorking: true
  };
}

/**
 * Teste 5: Cobertura temporal completa
 */
async function testTemporalCoverage() {
  const audioBuffer = createMockAudioBuffer(2.0, 440); // 2 segundos
  const timing = calculateFrameTiming(audioBuffer.length);
  
  // Verificar que os frames cobrem todo o áudio
  const audioDuration = audioBuffer.duration;
  
  // FFT deve cobrir quase todo o áudio
  if (timing.fft.lastFrameAt < audioDuration * 0.8) {
    throw new Error(`FFT não cobre o áudio: último frame em ${timing.fft.lastFrameAt}s de ${audioDuration}s`);
  }
  
  // RMS deve cobrir pelo menos 80% do áudio
  if (timing.rms.lastFrameAt < audioDuration * 0.8) {
    throw new Error(`RMS não cobre o áudio: último frame em ${timing.rms.lastFrameAt}s de ${audioDuration}s`);
  }
  
  return {
    audioDuration: audioDuration,
    fftCoverage: `${((timing.fft.lastFrameAt / audioDuration) * 100).toFixed(1)}%`,
    rmsCoverage: `${((timing.rms.lastFrameAt / audioDuration) * 100).toFixed(1)}%`,
    fftFrames: timing.fft.frameCount,
    rmsFrames: timing.rms.frameCount,
    coverageValid: true
  };
}

/**
 * Teste 6: Precisão determinística
 */
async function testDeterminism() {
  const audioBuffer = createMockAudioBuffer(1.0, 440);
  
  // Executar segmentação duas vezes
  const result1 = segmentAudioTemporal(audioBuffer);
  const result2 = segmentAudioTemporal(audioBuffer);
  
  // Verificar que os resultados são idênticos
  if (result1.framesFFT.count !== result2.framesFFT.count) {
    throw new Error(`FFT count não determinístico: ${result1.framesFFT.count} !== ${result2.framesFFT.count}`);
  }
  
  if (result1.framesRMS.count !== result2.framesRMS.count) {
    throw new Error(`RMS count não determinístico: ${result1.framesRMS.count} !== ${result2.framesRMS.count}`);
  }
  
  // Verificar que os dados dos frames são idênticos
  const frame1 = result1.framesFFT.left[0];
  const frame2 = result2.framesFFT.left[0];
  
  for (let i = 0; i < Math.min(frame1.length, frame2.length); i++) {
    if (Math.abs(frame1[i] - frame2[i]) > 1e-10) {
      throw new Error(`Frame FFT não determinístico no sample ${i}: ${frame1[i]} !== ${frame2[i]}`);
    }
  }
  
  return {
    deterministicFFT: true,
    deterministicRMS: true,
    fftFrames: result1.framesFFT.count,
    rmsFrames: result1.framesRMS.count,
    precision: '1e-10'
  };
}

/**
 * Executar todos os testes da Fase 5.2
 */
async function runAllTests() {
  console.log('🚀 INICIANDO TESTES DE SEGMENTAÇÃO TEMPORAL - FASE 5.2');
  console.log('═'.repeat(70));
  
  const results = [];
  
  // Lista de testes
  const tests = [
    ['Validar Configuração', testSegmentationConfig],
    ['Áudio 1 Segundo (Obrigatório)', testOneSecondAudio],
    ['Janela Hann Aplicada', testHannWindowing],
    ['Zero-padding', testZeroPadding],
    ['Cobertura Temporal', testTemporalCoverage],
    ['Determinismo', testDeterminism]
  ];
  
  // Executar testes
  for (const [name, testFn] of tests) {
    const result = await runTest(name, testFn);
    results.push({ name, ...result });
    
    // Aguardar um pouco entre testes
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Resumo final
  console.log('\n📊 RESUMO DOS TESTES');
  console.log('═'.repeat(70));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Sucessos: ${successful}/${total}`);
  console.log(`❌ Falhas: ${total - successful}/${total}`);
  
  if (successful === total) {
    console.log(`\n🎉 TODOS OS TESTES PASSARAM!`);
    console.log(`Fase 5.2 está pronta para integração com as próximas fases.`);
  } else {
    console.log(`\n⚠️  ALGUNS TESTES FALHARAM!`);
    console.log(`Revise os erros antes de prosseguir para a Fase 5.3.`);
  }
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`\n⏱️  Tempo total de execução: ${totalDuration}ms`);
  
  return { successful, total, results, totalDuration };
}

// Executar testes se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then((summary) => {
      process.exit(summary.successful === summary.total ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ ERRO CRÍTICO NOS TESTES:', error);
      process.exit(1);
    });
}

export {
  runAllTests,
  testSegmentationConfig,
  testOneSecondAudio,
  testHannWindowing,
  testZeroPadding,
  testTemporalCoverage,
  testDeterminism,
  createMockAudioBuffer
};
