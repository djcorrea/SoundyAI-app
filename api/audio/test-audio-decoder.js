/**
 * Testes para Audio Decoder - Fase 5.1
 * 
 * Validação da implementação de decodificação de áudio server-side
 * Garante compatibilidade com o pipeline existente
 */

import { decodeAudioFile, checkFFmpegAvailable, getAudioInfo } from './audio-decoder.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Configurações de teste
const TEST_FILES_DIR = process.env.TEST_AUDIO_DIR || './test-audio';

/**
 * Gerar arquivo WAV sintético para testes
 */
function generateTestWav(durationSeconds = 1, frequency = 440) {
  const sampleRate = 48000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const numChannels = 2; // Estéreo para corresponder ao novo decoder
  const bytesPerSample = 4; // Float32
  
  // Cabeçalho WAV
  const dataSize = numSamples * numChannels * bytesPerSample;
  const fileSize = 44 + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;
  
  // RIFF Header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  
  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
  buffer.writeUInt16LE(3, offset); offset += 2;  // format (IEEE Float)
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset); offset += 4; // byte rate
  buffer.writeUInt16LE(numChannels * bytesPerSample, offset); offset += 2; // block align
  buffer.writeUInt16LE(32, offset); offset += 2; // bits per sample
  
  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Gerar sine wave estéreo (frequências ligeiramente diferentes para cada canal)
  for (let i = 0; i < numSamples; i++) {
    const leftSample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
    const rightSample = Math.sin(2 * Math.PI * (frequency * 1.1) * i / sampleRate) * 0.4; // Frequência e amplitude ligeiramente diferentes
    
    buffer.writeFloatLE(leftSample, offset);
    offset += 4;
    buffer.writeFloatLE(rightSample, offset);
    offset += 4;
  }
  
  return buffer;
}

/**
 * Executar teste com resultado formatado
 */
async function runTest(testName, testFn) {
  console.log(`\n🧪 ${testName}`);
  console.log('═'.repeat(50));
  
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
 * Teste 1: Verificar disponibilidade do FFmpeg
 */
async function testFFmpegAvailable() {
  const available = await checkFFmpegAvailable();
  
  if (!available) {
    throw new Error('FFmpeg não está disponível no sistema');
  }
  
  return { ffmpegAvailable: true };
}

/**
 * Teste 2: Decodificar WAV sintético
 */
async function testDecodeSyntheticWav() {
  const testWav = generateTestWav(2, 440); // 2 segundos, 440Hz
  const result = await decodeAudioFile(testWav, 'test-synthetic.wav');
  
  // Validações
  if (result.sampleRate !== 48000) {
    throw new Error(`Sample rate inválido: ${result.sampleRate} !== 48000`);
  }
  
  if (result.numberOfChannels !== 2) {
    throw new Error(`Número de canais inválido: ${result.numberOfChannels} !== 2`);
  }
  
  if (Math.abs(result.duration - 2.0) > 0.1) {
    throw new Error(`Duração inválida: ${result.duration} !== ~2.0`);
  }
  
  if (!(result.data instanceof Float32Array)) {
    throw new Error(`Tipo de dados inválido: ${typeof result.data} !== Float32Array`);
  }
  
  if (result.length !== result.data.length) {
    throw new Error(`Length inconsistente: ${result.length} !== ${result.data.length}`);
  }
  
  // Verificar se os canais estéreo estão presentes
  if (!result.leftChannel || !(result.leftChannel instanceof Float32Array)) {
    throw new Error(`Canal esquerdo inválido ou ausente`);
  }
  
  if (!result.rightChannel || !(result.rightChannel instanceof Float32Array)) {
    throw new Error(`Canal direito inválido ou ausente`);
  }
  
  if (result.leftChannel.length !== result.rightChannel.length) {
    throw new Error(`Canais com tamanhos diferentes: L=${result.leftChannel.length}, R=${result.rightChannel.length}`);
  }
  
  // Verificar método getChannelData
  if (typeof result.getChannelData !== 'function') {
    throw new Error(`Método getChannelData não encontrado`);
  }
  
  const leftChannelData = result.getChannelData(0);
  const rightChannelData = result.getChannelData(1);
  
  if (leftChannelData !== result.leftChannel) {
    throw new Error(`getChannelData(0) não retorna o canal esquerdo correto`);
  }
  
  if (rightChannelData !== result.rightChannel) {
    throw new Error(`getChannelData(1) não retorna o canal direito correto`);
  }
  
  // Verificar se o sinal é aproximadamente uma sine wave (canal esquerdo)
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (let i = 0; i < Math.min(1000, result.leftChannel.length); i++) {
    const sample = result.leftChannel[i];
    
    if (sample > 0.1) positiveCount++;
    if (sample < -0.1) negativeCount++;
    
    if (Math.abs(sample) > 1.0) {
      throw new Error(`Sample fora do range: ${sample} > 1.0`);
    }
  }
  
  if (positiveCount < 100 || negativeCount < 100) {
    throw new Error(`Sinal não parece uma sine wave: +${positiveCount}, -${negativeCount}`);
  }
  
  return {
    sampleRate: result.sampleRate,
    duration: result.duration,
    length: result.length,
    channels: result.numberOfChannels,
    dataType: result.data.constructor.name,
    signalCheck: { positiveCount, negativeCount },
    stereoChannels: {
      leftLength: result.leftChannel.length,
      rightLength: result.rightChannel.length,
      getChannelDataWorking: true
    }
  };
}

/**
 * Teste 3: Validar tratamento de erros
 */
async function testErrorHandling() {
  const errors = [];
  
  // Teste 1: Formato não suportado
  try {
    const fakeBuffer = Buffer.from('fake data');
    await decodeAudioFile(fakeBuffer, 'test.mp3');
    errors.push('Deveria ter rejeitado MP3');
  } catch (error) {
    if (!error.message.includes('UNSUPPORTED_FORMAT')) {
      errors.push(`Erro inesperado para MP3: ${error.message}`);
    }
  }
  
  // Teste 2: Arquivo muito pequeno
  try {
    const tinyBuffer = Buffer.alloc(10);
    await decodeAudioFile(tinyBuffer, 'tiny.wav');
    errors.push('Deveria ter rejeitado arquivo muito pequeno');
  } catch (error) {
    if (!error.message.includes('WAV_INVALID')) {
      errors.push(`Erro inesperado para arquivo pequeno: ${error.message}`);
    }
  }
  
  // Teste 3: Arquivo muito grande
  try {
    const hugeBuffer = Buffer.alloc(200 * 1024 * 1024); // 200MB
    await decodeAudioFile(hugeBuffer, 'huge.wav');
    errors.push('Deveria ter rejeitado arquivo muito grande');
  } catch (error) {
    if (!error.message.includes('FILE_TOO_LARGE')) {
      errors.push(`Erro inesperado para arquivo grande: ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Validação de erros falhou: ${errors.join(', ')}`);
  }
  
  return { errorHandling: 'OK', testsExecuted: 3 };
}

/**
 * Teste 4: Performance e memória
 */
async function testPerformance() {
  const memoryBefore = process.memoryUsage();
  const startTime = Date.now();
  
  // Gerar arquivo maior para teste de performance
  const largeWav = generateTestWav(10, 440); // 10 segundos
  const result = await decodeAudioFile(largeWav, 'performance-test.wav');
  
  const processingTime = Date.now() - startTime;
  const memoryAfter = process.memoryUsage();
  
  const memoryDelta = {
    heapUsed: (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024,
    heapTotal: (memoryAfter.heapTotal - memoryBefore.heapTotal) / 1024 / 1024,
    external: (memoryAfter.external - memoryBefore.external) / 1024 / 1024
  };
  
  // Validações de performance
  if (processingTime > 30000) { // 30 segundos
    throw new Error(`Processamento muito lento: ${processingTime}ms > 30000ms`);
  }
  
  if (memoryDelta.heapUsed > 500) { // 500MB
    throw new Error(`Uso excessivo de memória: ${memoryDelta.heapUsed.toFixed(1)}MB`);
  }
  
  return {
    processingTime: `${processingTime}ms`,
    audioLength: `${result.duration.toFixed(1)}s`,
    samplesProcessed: result.length,
    memoryDelta: {
      heapUsed: `${memoryDelta.heapUsed.toFixed(1)}MB`,
      heapTotal: `${memoryDelta.heapTotal.toFixed(1)}MB`,
      external: `${memoryDelta.external.toFixed(1)}MB`
    },
    efficiency: `${(result.length / processingTime * 1000).toFixed(0)} samples/s`
  };
}

/**
 * Teste 5: Compatibilidade com AudioBuffer
 */
async function testAudioBufferCompatibility() {
  const testWav = generateTestWav(1, 1000); // 1 segundo, 1kHz
  const result = await decodeAudioFile(testWav, 'compatibility-test.wav');
  
  // Testar interface AudioBuffer nativa do result
  // Validar getChannelData para ambos os canais
  if (result.getChannelData(0) !== result.leftChannel) {
    throw new Error('getChannelData(0) não retorna o canal esquerdo correto');
  }
  
  if (result.getChannelData(1) !== result.rightChannel) {
    throw new Error('getChannelData(1) não retorna o canal direito correto');
  }
  
  // Testar erro para canal inexistente
  try {
    result.getChannelData(2);
    throw new Error('Deveria ter rejeitado canal 2');
  } catch (error) {
    if (!error.message.includes('Canal 2 não existe')) {
      throw error;
    }
  }
  
  // Verificar propriedades básicas
  if (result.numberOfChannels !== 2) {
    throw new Error(`numberOfChannels incorreto: ${result.numberOfChannels} !== 2`);
  }
  
  if (result.sampleRate !== 48000) {
    throw new Error(`sampleRate incorreto: ${result.sampleRate} !== 48000`);
  }
  
  return {
    interfaceCompatible: true,
    sampleRate: result.sampleRate,
    numberOfChannels: result.numberOfChannels,
    length: result.length,
    duration: result.duration,
    channelDataTypes: {
      left: result.getChannelData(0).constructor.name,
      right: result.getChannelData(1).constructor.name
    },
    stereoTest: 'passed'
  };
}

/**
 * Executar todos os testes
 */
async function runAllTests() {
  console.log('🚀 INICIANDO TESTES DO AUDIO DECODER - FASE 5.1');
  console.log('═'.repeat(70));
  
  const results = [];
  
  // Lista de testes
  const tests = [
    ['Verificar FFmpeg Disponível', testFFmpegAvailable],
    ['Decodificar WAV Sintético', testDecodeSyntheticWav],
    ['Tratamento de Erros', testErrorHandling],
    ['Performance e Memória', testPerformance],
    ['Compatibilidade AudioBuffer', testAudioBufferCompatibility]
  ];
  
  // Executar testes
  for (const [name, testFn] of tests) {
    const result = await runTest(name, testFn);
    results.push({ name, ...result });
    
    // Aguardar um pouco entre testes para limpar memória
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    console.log(`Audio Decoder está pronto para integração com o pipeline.`);
  } else {
    console.log(`\n⚠️  ALGUNS TESTES FALHARAM!`);
    console.log(`Revise os erros antes de prosseguir para a Fase 5.2.`);
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
  testFFmpegAvailable,
  testDecodeSyntheticWav,
  testErrorHandling,
  testPerformance,
  testAudioBufferCompatibility,
  generateTestWav
};
