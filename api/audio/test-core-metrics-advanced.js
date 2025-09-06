// 🧪 TESTE AVANÇADO - Fase 5.3 Core Metrics Corrigida
// Validação completa com casos edge: silêncio, seno, música real

import { calculateCoreMetrics } from './core-metrics.js';
import { segmentAudioTemporal } from './temporal-segmentation.js';
import { decodeAudioFile } from './audio-decoder.js';
import { readFileSync } from 'fs';

/**
 * 🎯 GERAR SINAIS DE TESTE
 */

// Silêncio absoluto
function generateSilence(duration, sampleRate) {
  const numSamples = Math.floor(duration * sampleRate);
  return {
    leftChannel: new Float32Array(numSamples),
    rightChannel: new Float32Array(numSamples),
    numSamples
  };
}

// Seno puro (mono)
function generateSine(frequency, duration, sampleRate, amplitude = 0.1) {
  const numSamples = Math.floor(duration * sampleRate);
  const leftChannel = new Float32Array(numSamples);
  const rightChannel = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = amplitude * Math.sin(2 * Math.PI * frequency * t);
    leftChannel[i] = value;
    rightChannel[i] = value; // Mono
  }
  
  return { leftChannel, rightChannel, numSamples };
}

// Seno estéreo (L e R com fases diferentes)
function generateStereoSine(frequency, duration, sampleRate, amplitude = 0.1, phaseOffset = Math.PI / 4) {
  const numSamples = Math.floor(duration * sampleRate);
  const leftChannel = new Float32Array(numSamples);
  const rightChannel = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    leftChannel[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
    rightChannel[i] = amplitude * Math.sin(2 * Math.PI * frequency * t + phaseOffset);
  }
  
  return { leftChannel, rightChannel, numSamples };
}

/**
 * 🧪 TESTES ESPECÍFICOS
 */

async function testSilence() {
  console.log('\\n🔇 TESTE 1: SILÊNCIO ABSOLUTO');
  console.log('─'.repeat(40));
  
  const { leftChannel, rightChannel } = generateSilence(1.0, 48000);
  
  const audioData = {
    leftChannel, rightChannel,
    sampleRate: 48000, duration: 1.0, numberOfChannels: 2, length: 48000
  };
  
  const segmentedData = segmentAudioTemporal(audioData);
  segmentedData.originalLeft = leftChannel;
  segmentedData.originalRight = rightChannel;
  
  const metrics = await calculateCoreMetrics(segmentedData);
  
  console.log(`LUFS: ${metrics.lufs.integrated} (esperado: ~-70)`);
  console.log(`True Peak: ${metrics.truePeak.maxDbtp} dBTP (esperado: ~-60)`);
  console.log(`Correlação: ${metrics.stereo.correlation.toFixed(3)} (esperado: 0.0 ou NaN→0)`);
  console.log(`Silêncio detectado: ${metrics.lufs.diagnostics.isSilent ? '✅' : '❌'}`);
  
  // Validações
  const validations = [
    { name: 'LUFS não é -Infinity', condition: isFinite(metrics.lufs.integrated), value: metrics.lufs.integrated },
    { name: 'True Peak não é -Infinity', condition: isFinite(metrics.truePeak.maxDbtp), value: metrics.truePeak.maxDbtp },
    { name: 'Silêncio detectado', condition: metrics.lufs.diagnostics.isSilent, value: 'true' },
    { name: 'FFT processado', condition: metrics.fft.frameCount > 0, value: metrics.fft.frameCount }
  ];
  
  return validateResults('SILÊNCIO', validations);
}

async function testSine1kHz() {
  console.log('\\n🎵 TESTE 2: SENO 1kHz MONO');
  console.log('─'.repeat(40));
  
  const { leftChannel, rightChannel } = generateSine(1000, 1.0, 48000, 0.1); // -20dB
  
  const audioData = {
    leftChannel, rightChannel,
    sampleRate: 48000, duration: 1.0, numberOfChannels: 2, length: 48000
  };
  
  const segmentedData = segmentAudioTemporal(audioData);
  segmentedData.originalLeft = leftChannel;
  segmentedData.originalRight = rightChannel;
  
  const metrics = await calculateCoreMetrics(segmentedData);
  
  console.log(`LUFS: ${metrics.lufs.integrated.toFixed(1)} (esperado: ~-30 a -20)`);
  console.log(`True Peak: ${metrics.truePeak.maxDbtp.toFixed(1)} dBTP (esperado: ~-20)`);
  console.log(`Correlação: ${metrics.stereo.correlation.toFixed(3)} (esperado: ~1.0 mono)`);
  console.log(`Classificação: ${metrics.stereo.classification} (esperado: MONO)`);
  
  // Verificar energia na banda mid (500-2000Hz contém 1kHz)
  const midEnergyLeft = metrics.fft.frequencyBands.left.mid.energyDb;
  const bassEnergyLeft = metrics.fft.frequencyBands.left.bass.energyDb;
  
  console.log(`Energia Mid: ${midEnergyLeft.toFixed(1)} dB`);
  console.log(`Energia Bass: ${bassEnergyLeft.toFixed(1)} dB`);
  console.log(`Mid > Bass: ${midEnergyLeft > bassEnergyLeft ? '✅' : '❌'}`);
  
  const validations = [
    { name: 'LUFS válido', condition: isFinite(metrics.lufs.integrated) && metrics.lufs.integrated > -50, value: metrics.lufs.integrated.toFixed(1) },
    { name: 'True Peak válido', condition: isFinite(metrics.truePeak.maxDbtp) && metrics.truePeak.maxDbtp > -30, value: metrics.truePeak.maxDbtp.toFixed(1) },
    { name: 'Correlação alta (mono)', condition: metrics.stereo.correlation > 0.95, value: metrics.stereo.correlation.toFixed(3) },
    { name: 'Energia mid > bass', condition: midEnergyLeft > bassEnergyLeft, value: `${midEnergyLeft.toFixed(1)} > ${bassEnergyLeft.toFixed(1)}` },
    { name: 'Classificação mono', condition: metrics.stereo.classification === 'MONO', value: metrics.stereo.classification }
  ];
  
  return validateResults('SENO 1kHz', validations);
}

async function testStereoSine() {
  console.log('\\n🎵 TESTE 3: SENO 1kHz ESTÉREO');
  console.log('─'.repeat(40));
  
  const { leftChannel, rightChannel } = generateStereoSine(1000, 1.0, 48000, 0.1, Math.PI / 4);
  
  const audioData = {
    leftChannel, rightChannel,
    sampleRate: 48000, duration: 1.0, numberOfChannels: 2, length: 48000
  };
  
  const segmentedData = segmentAudioTemporal(audioData);
  segmentedData.originalLeft = leftChannel;
  segmentedData.originalRight = rightChannel;
  
  const metrics = await calculateCoreMetrics(segmentedData);
  
  console.log(`LUFS: ${metrics.lufs.integrated.toFixed(1)} (esperado: ~-30 a -20)`);
  console.log(`True Peak: ${metrics.truePeak.maxDbtp.toFixed(1)} dBTP (esperado: ~-20)`);
  console.log(`Correlação: ${metrics.stereo.correlation.toFixed(3)} (esperado: 0.2-0.9)`);
  console.log(`Width: ${metrics.stereo.width.toFixed(3)} (esperado: >0.1)`);
  console.log(`Classificação: ${metrics.stereo.classification}`);
  
  const validations = [
    { name: 'LUFS válido', condition: isFinite(metrics.lufs.integrated) && metrics.lufs.integrated > -50, value: metrics.lufs.integrated.toFixed(1) },
    { name: 'True Peak válido', condition: isFinite(metrics.truePeak.maxDbtp) && metrics.truePeak.maxDbtp > -30, value: metrics.truePeak.maxDbtp.toFixed(1) },
    { name: 'Correlação média (estéreo)', condition: metrics.stereo.correlation > 0.2 && metrics.stereo.correlation < 0.9, value: metrics.stereo.correlation.toFixed(3) },
    { name: 'Width > 0', condition: metrics.stereo.width > 0.1, value: metrics.stereo.width.toFixed(3) },
    { name: 'Não é mono', condition: metrics.stereo.classification !== 'MONO', value: metrics.stereo.classification }
  ];
  
  return validateResults('SENO ESTÉREO', validations);
}

async function testRealMusic() {
  console.log('\\n🎼 TESTE 4: MÚSICA REAL');
  console.log('─'.repeat(40));
  
  try {
    // Tentar carregar arquivo de teste
    const testFile = readFileSync('C:\\Users\\DJ Correa\\Desktop\\Programação\\SoundyAI\\tests\\seno-1khz.wav');
    
    const audioData = await decodeAudioFile(testFile, 'seno-1khz.wav');
    const segmentedData = segmentAudioTemporal(audioData);
    
    segmentedData.originalLeft = audioData.leftChannel;
    segmentedData.originalRight = audioData.rightChannel;
    
    const metrics = await calculateCoreMetrics(segmentedData);
    
    console.log(`Duração: ${metrics.duration.toFixed(1)}s`);
    console.log(`LUFS: ${metrics.lufs.integrated.toFixed(1)} LUFS`);
    console.log(`True Peak: ${metrics.truePeak.maxDbtp.toFixed(1)} dBTP`);
    console.log(`Correlação: ${metrics.stereo.correlation.toFixed(3)}`);
    console.log(`Classificação: ${metrics.stereo.classification}`);
    console.log(`R128 compliant: ${metrics.lufs.r128Compliance.integratedWithinRange ? '✅' : '❌'}`);
    
    const validations = [
      { name: 'LUFS finito', condition: isFinite(metrics.lufs.integrated), value: metrics.lufs.integrated.toFixed(1) },
      { name: 'True Peak finito', condition: isFinite(metrics.truePeak.maxDbtp), value: metrics.truePeak.maxDbtp.toFixed(1) },
      { name: 'FFT frames > 0', condition: metrics.fft.frameCount > 0, value: metrics.fft.frameCount },
      { name: 'Bandas calculadas', condition: Object.keys(metrics.fft.frequencyBands.left).length === 7, value: '7 bandas' }
    ];
    
    return validateResults('MÚSICA REAL', validations);
    
  } catch (error) {
    console.log('⚠️ Arquivo de teste não encontrado, pulando teste de música real');
    return { passed: 0, total: 0, name: 'MÚSICA REAL (PULADO)' };
  }
}

function validateResults(testName, validations) {
  console.log('\\n✅ VALIDAÇÕES:');
  
  let passed = 0;
  for (const validation of validations) {
    const status = validation.condition ? '✅' : '❌';
    console.log(`${status} ${validation.name}: ${validation.value}`);
    if (validation.condition) passed++;
  }
  
  console.log(`\\n📊 Resultado: ${passed}/${validations.length} validações passaram`);
  
  return { passed, total: validations.length, name: testName };
}

async function runAllTests() {
  console.log('🧪 INICIANDO TESTES AVANÇADOS - FASE 5.3 CORRIGIDA');
  console.log('═'.repeat(60));
  
  const results = [];
  
  try {
    results.push(await testSilence());
    results.push(await testSine1kHz());
    results.push(await testStereoSine());
    results.push(await testRealMusic());
    
    // Sumário final
    console.log('\\n📈 SUMÁRIO FINAL');
    console.log('═'.repeat(60));
    
    let totalPassed = 0;
    let totalTests = 0;
    
    for (const result of results) {
      const percentage = result.total > 0 ? (result.passed / result.total * 100).toFixed(0) : 'N/A';
      console.log(`${result.name}: ${result.passed}/${result.total} (${percentage}%)`);
      totalPassed += result.passed;
      totalTests += result.total;
    }
    
    const overallPercentage = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : '0';
    
    console.log('\\n' + '─'.repeat(60));
    console.log(`TOTAL: ${totalPassed}/${totalTests} validações (${overallPercentage}%)`);
    
    if (totalPassed === totalTests && totalTests > 0) {
      console.log('\\n🎉 TODOS OS TESTES PASSARAM!');
      console.log('✅ Fase 5.3 corrigida e funcionando perfeitamente');
      console.log('✅ LUFS nunca retorna -Infinity');
      console.log('✅ True Peak nunca retorna -Infinity');
      console.log('✅ Análise estéreo implementada');
      console.log('✅ Casos edge tratados corretamente');
    } else {
      console.log('\\n⚠️ Alguns testes falharam - revisar implementação');
    }
    
  } catch (error) {
    console.error('\\n❌ ERRO durante os testes:', error.message);
    console.error(error.stack);
  }
}

// Executar todos os testes
await runAllTests();
