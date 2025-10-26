// 🧪 TEST LRA DEBUG - Diagnóstico específico do LRA

import { EnhancedCoreMetricsProcessor } from './lib/audio/features/core-metrics-enhanced.js';

console.log('🧪 [DEBUG] Iniciando teste LRA isolado...');

// Gerar audio mock
const sampleRate = 48000;
const duration = 2; // segundos
const frequency = 440; // Hz (A4)
const amplitude = 0.5;

const numSamples = sampleRate * duration;
const leftChannel = new Float32Array(numSamples);
const rightChannel = new Float32Array(numSamples);

for (let i = 0; i < numSamples; i++) {
  const time = i / sampleRate;
  const sample = amplitude * Math.sin(2 * Math.PI * frequency * time);
  leftChannel[i] = sample;
  rightChannel[i] = sample * 0.9; // Slight difference for stereo
}

console.log('🧪 [DEBUG] Audio mock gerado');

const processor = new EnhancedCoreMetricsProcessor();

async function testLRA() {
  try {
    console.log('🧪 [DEBUG] Testando LRA Enhanced...');
    
    const result = await processor.calculateEnhancedLRA(
      leftChannel, 
      rightChannel, 
      sampleRate, 
      { jobId: 'debug-lra' }
    );
    
    console.log('🧪 [DEBUG] Resultado LRA:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('🧪 [ERROR] LRA Test falhou:', error.message);
    console.error('🧪 [ERROR] Stack:', error.stack);
  }
}

testLRA();