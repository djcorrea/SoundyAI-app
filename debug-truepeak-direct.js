/**
 * 🔍 Debug direto do True Peak até JSON
 */

import { analyzeTruePeaks } from './work/lib/audio/features/truepeak.js';

console.log('🔍 Debug direto do True Peak...\n');

// Criar sinal de teste
const sampleRate = 48000;
const duration = 0.1; // 100ms
const frequency = 1000; // 1kHz
const amplitude = 0.5; // -6 dBFS

const length = Math.floor(sampleRate * duration);
const leftChannel = new Float32Array(length);
const rightChannel = new Float32Array(length);

for (let i = 0; i < length; i++) {
  const t = i / sampleRate;
  const sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
  leftChannel[i] = sample;
  rightChannel[i] = sample;
}

try {
  console.log('🏔️ 1. Chamando analyzeTruePeaks...');
  const truePeakResult = analyzeTruePeaks(leftChannel, rightChannel, sampleRate);
  
  console.log('\n📋 2. Resultado de analyzeTruePeaks:');
  console.log(`   true_peak_dbtp: ${truePeakResult.true_peak_dbtp}`);
  console.log(`   true_peak_linear: ${truePeakResult.true_peak_linear}`);
  console.log(`   truePeakDbtp: ${truePeakResult.truePeakDbtp}`);
  console.log(`   maxDbtp exists: ${truePeakResult.hasOwnProperty('maxDbtp')}`);
  
  // Simular o que core-metrics.js faz
  console.log('\n🔧 3. Simulando core-metrics.js:');
  const standardizedTruePeak = {
    maxDbtp: truePeakResult.true_peak_dbtp,
    maxLinear: truePeakResult.true_peak_linear,
    ...truePeakResult
  };
  
  console.log(`   standardizedTruePeak.maxDbtp: ${standardizedTruePeak.maxDbtp}`);
  console.log(`   standardizedTruePeak.maxLinear: ${standardizedTruePeak.maxLinear}`);
  
  // Simular o que json-output.js faz
  console.log('\n📤 4. Simulando extractTechnicalData (json-output.js):');
  const coreMetrics = { truePeak: standardizedTruePeak };
  
  function safeSanitize(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') {
      if (!isFinite(value) || isNaN(value)) return fallback;
      return Math.round(value * 1000) / 1000;
    }
    return fallback;
  }
  
  const technicalData = {};
  if (coreMetrics.truePeak) {
    technicalData.truePeakDbtp = safeSanitize(coreMetrics.truePeak.maxDbtp);
    technicalData.truePeakLinear = safeSanitize(coreMetrics.truePeak.maxLinear);
  }
  
  console.log(`   technicalData.truePeakDbtp: ${technicalData.truePeakDbtp}`);
  console.log(`   technicalData.truePeakLinear: ${technicalData.truePeakLinear}`);
  
  console.log('\n🎯 ANÁLISE:');
  if (technicalData.truePeakDbtp && Number.isFinite(technicalData.truePeakDbtp)) {
    console.log('✅ SUCESSO: Pipeline funciona, valor deve aparecer no modal!');
    console.log(`✅ Valor final: ${technicalData.truePeakDbtp} dBTP`);
  } else {
    console.log('❌ PROBLEMA: Valor não está sendo propagado corretamente!');
    console.log(`❌ Valor recebido: ${technicalData.truePeakDbtp} (tipo: ${typeof technicalData.truePeakDbtp})`);
  }

} catch (error) {
  console.error('❌ ERRO:', error.message);
  console.error(error.stack);
}