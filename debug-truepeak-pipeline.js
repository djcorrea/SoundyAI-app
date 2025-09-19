/**
 * 🔍 Debug completo do pipeline True Peak
 * Rastrear o valor desde truepeak.js até o JSON final
 */

import { calculateCoreMetrics } from './work/api/audio/core-metrics.js';
import { generateJSONOutput } from './work/api/audio/json-output.js';

console.log('🔍 Debug completo do pipeline True Peak...\n');

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
  console.log('📊 1. Calculando Core Metrics...');
  const coreMetrics = await calculateCoreMetrics(leftChannel, rightChannel, sampleRate, {
    jobId: 'debug-truepeak'
  });
  
  console.log('\n📋 2. Core Metrics - True Peak:');
  console.log(`   coreMetrics.truePeak existe: ${!!coreMetrics.truePeak}`);
  if (coreMetrics.truePeak) {
    console.log(`   coreMetrics.truePeak.maxDbtp: ${coreMetrics.truePeak.maxDbtp}`);
    console.log(`   coreMetrics.truePeak.maxLinear: ${coreMetrics.truePeak.maxLinear}`);
    console.log(`   coreMetrics.truePeak.true_peak_dbtp: ${coreMetrics.truePeak.true_peak_dbtp}`);
    console.log(`   coreMetrics.truePeak.true_peak_linear: ${coreMetrics.truePeak.true_peak_linear}`);
  }
  
  console.log('\n📤 3. Gerando JSON Output...');
  const jsonOutput = generateJSONOutput(coreMetrics, null, {}, {
    jobId: 'debug-truepeak',
    fileName: 'test.wav'
  });
  
  console.log('\n📋 4. JSON Output - Technical Data:');
  console.log(`   technicalData.truePeakDbtp: ${jsonOutput.technicalData?.truePeakDbtp}`);
  console.log(`   technicalData.truePeakLinear: ${jsonOutput.technicalData?.truePeakLinear}`);
  
  console.log('\n📋 5. JSON Final - True Peak:');
  console.log(`   truePeak existe: ${!!jsonOutput.truePeak}`);
  if (jsonOutput.truePeak) {
    console.log(`   truePeak.maxDbtp: ${jsonOutput.truePeak.maxDbtp}`);
    console.log(`   truePeak.maxLinear: ${jsonOutput.truePeak.maxLinear}`);
  }
  
  console.log('\n🎯 RESUMO:');
  console.log(`   Valor calculado: ${coreMetrics.truePeak?.maxDbtp || 'MISSING'} dBTP`);
  console.log(`   Valor no technicalData: ${jsonOutput.technicalData?.truePeakDbtp || 'MISSING'} dBTP`);
  console.log(`   Valor no JSON final: ${jsonOutput.truePeak?.maxDbtp || 'MISSING'} dBTP`);
  
  if (jsonOutput.technicalData?.truePeakDbtp && Number.isFinite(jsonOutput.technicalData.truePeakDbtp)) {
    console.log('✅ SUCESSO: True Peak chegando no JSON com valor válido!');
  } else {
    console.log('❌ PROBLEMA: True Peak não está chegando ou está inválido!');
  }

} catch (error) {
  console.error('❌ ERRO no pipeline:', error.message);
  console.error(error.stack);
}