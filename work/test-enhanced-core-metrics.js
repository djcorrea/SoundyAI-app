// 🧪 TEST ENHANCED CORE METRICS - Fase 2.2
// Teste das 4 métricas core com precisão profissional

import { calculateEnhancedCoreMetrics } from './lib/audio/features/core-metrics-enhanced.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 [TEST] Iniciando teste das Enhanced Core Metrics...');

// Mock de dados de áudio (48kHz, 2s de duração)
const SAMPLE_RATE = 48000;
const DURATION_SECONDS = 2;
const SAMPLES_PER_CHANNEL = SAMPLE_RATE * DURATION_SECONDS;

console.log(`🧪 [TEST] Gerando mock de áudio: ${SAMPLE_RATE}Hz, ${DURATION_SECONDS}s, ${SAMPLES_PER_CHANNEL} samples`);

// Gerar sine wave de teste (440Hz - A4)
const frequency = 440; // Hz
const amplitude = 0.5; // -6dB aproximadamente

const leftChannel = new Float32Array(SAMPLES_PER_CHANNEL);
const rightChannel = new Float32Array(SAMPLES_PER_CHANNEL);

for (let i = 0; i < SAMPLES_PER_CHANNEL; i++) {
  const time = i / SAMPLE_RATE;
  const sample = amplitude * Math.sin(2 * Math.PI * frequency * time);
  
  leftChannel[i] = sample;
  rightChannel[i] = sample * 0.9; // Slight difference for stereo
}

console.log('🧪 [TEST] Mock audio gerado com sucesso');

// Preparar dados de entrada
const audioData = {
  leftChannel,
  rightChannel,
  sampleRate: SAMPLE_RATE
};

const options = {
  jobId: 'test-enhanced-metrics',
  fileName: 'test-440hz-sine.wav',
  tempFilePath: null // Sem arquivo temporário para este teste
};

console.log('🧪 [TEST] Iniciando cálculo das Enhanced Core Metrics...');

async function runTest() {
  try {
    const startTime = Date.now();
    
    const enhancedMetrics = await calculateEnhancedCoreMetrics(audioData, options);
    
    const processingTime = Date.now() - startTime;
    
    console.log('🧪 [TEST] ✅ Enhanced Core Metrics calculadas com sucesso!');
    console.log(`🧪 [TEST] ⏱️ Tempo de processamento: ${processingTime}ms`);
    
    console.log('\n📊 [RESULTADOS] Enhanced Core Metrics:');
    console.log('==========================================');
    
    // True Peak
    console.log(`🎯 True Peak:`);
    console.log(`   - maxDbtp: ${enhancedMetrics.truePeak.maxDbtp?.toFixed(2) || 'null'} dBTP`);
    console.log(`   - maxLinear: ${enhancedMetrics.truePeak.maxLinear?.toFixed(6) || 'null'}`);
    console.log(`   - method: ${enhancedMetrics.truePeak.method}`);
    console.log(`   - valid: ${enhancedMetrics.truePeak.valid}`);
    console.log(`   - hasClipping: ${enhancedMetrics.truePeak.hasClipping || false}`);
    
    // LUFS
    console.log(`\n🔊 LUFS:`);
    console.log(`   - integrated: ${enhancedMetrics.lufs.integrated?.toFixed(2) || 'null'} LUFS`);
    console.log(`   - shortTerm: ${enhancedMetrics.lufs.shortTerm?.toFixed(2) || 'null'} LUFS`);
    console.log(`   - momentary: ${enhancedMetrics.lufs.momentary?.toFixed(2) || 'null'} LUFS`);
    console.log(`   - method: ${enhancedMetrics.lufs.method}`);
    console.log(`   - valid: ${enhancedMetrics.lufs.valid}`);
    
    // RMS
    console.log(`\n📊 RMS:`);
    console.log(`   - average: ${enhancedMetrics.rms.average?.toFixed(2) || 'null'} dB`);
    console.log(`   - peak: ${enhancedMetrics.rms.peak?.toFixed(2) || 'null'} dB`);
    console.log(`   - left: ${enhancedMetrics.rms.left?.toFixed(2) || 'null'} dB`);
    console.log(`   - right: ${enhancedMetrics.rms.right?.toFixed(2) || 'null'} dB`);
    console.log(`   - method: ${enhancedMetrics.rms.method}`);
    console.log(`   - valid: ${enhancedMetrics.rms.valid}`);
    console.log(`   - validWindows: ${enhancedMetrics.rms.validWindows || 0}`);
    
    // LRA
    console.log(`\n📈 LRA:`);
    console.log(`   - value: ${enhancedMetrics.lra.value?.toFixed(2) || 'null'} LU`);
    console.log(`   - percentile10: ${enhancedMetrics.lra.percentile10?.toFixed(2) || 'null'}`);
    console.log(`   - percentile95: ${enhancedMetrics.lra.percentile95?.toFixed(2) || 'null'}`);
    console.log(`   - method: ${enhancedMetrics.lra.method}`);
    console.log(`   - valid: ${enhancedMetrics.lra.valid}`);
    
    // Metadata
    console.log(`\n🔧 Metadata:`);
    console.log(`   - processingTime: ${enhancedMetrics.metadata.processingTime}ms`);
    console.log(`   - phase: ${enhancedMetrics.metadata.phase}`);
    console.log(`   - allMetricsCalculated: ${enhancedMetrics.metadata.allMetricsCalculated}`);
    console.log(`   - audioLength: ${enhancedMetrics.metadata.audioLength} samples`);
    console.log(`   - sampleRate: ${enhancedMetrics.metadata.sampleRate} Hz`);
    
    console.log('\n==========================================');
    
    // Validação dos resultados
    console.log('\n🧪 [VALIDAÇÃO] Verificando resultados:');
    
    const validMetrics = [
      enhancedMetrics.truePeak.valid,
      enhancedMetrics.lufs.valid,
      enhancedMetrics.rms.valid,
      enhancedMetrics.lra.valid
    ];
    
    const validCount = validMetrics.filter(v => v).length;
    console.log(`✅ Métricas válidas: ${validCount}/4`);
    
    if (validCount === 4) {
      console.log('🎉 [SUCCESS] Todas as 4 métricas core foram calculadas com sucesso!');
    } else {
      console.log('⚠️ [WARNING] Algumas métricas falharam:');
      console.log(`   - True Peak: ${enhancedMetrics.truePeak.valid ? '✅' : '❌'}`);
      console.log(`   - LUFS: ${enhancedMetrics.lufs.valid ? '✅' : '❌'}`);
      console.log(`   - RMS: ${enhancedMetrics.rms.valid ? '✅' : '❌'}`);
      console.log(`   - LRA: ${enhancedMetrics.lra.valid ? '✅' : '❌'}`);
    }
    
    // Validar ranges esperados
    console.log('\n🧪 [VALIDAÇÃO] Verificando ranges esperados:');
    
    if (enhancedMetrics.rms.valid && enhancedMetrics.rms.average !== null) {
      const expectedRmsRange = [-20, -3]; // Para sine wave de -6dB
      const actualRms = enhancedMetrics.rms.average;
      if (actualRms >= expectedRmsRange[0] && actualRms <= expectedRmsRange[1]) {
        console.log(`✅ RMS dentro do range esperado: ${actualRms.toFixed(2)} dB (${expectedRmsRange[0]} a ${expectedRmsRange[1]} dB)`);
      } else {
        console.log(`⚠️ RMS fora do range esperado: ${actualRms.toFixed(2)} dB (esperado: ${expectedRmsRange[0]} a ${expectedRmsRange[1]} dB)`);
      }
    }
    
    if (enhancedMetrics.lufs.valid && enhancedMetrics.lufs.integrated !== null) {
      const expectedLufsRange = [-25, -10]; // Range típico para sine wave
      const actualLufs = enhancedMetrics.lufs.integrated;
      if (actualLufs >= expectedLufsRange[0] && actualLufs <= expectedLufsRange[1]) {
        console.log(`✅ LUFS dentro do range esperado: ${actualLufs.toFixed(2)} LUFS (${expectedLufsRange[0]} a ${expectedLufsRange[1]} LUFS)`);
      } else {
        console.log(`⚠️ LUFS fora do range esperado: ${actualLufs.toFixed(2)} LUFS (esperado: ${expectedLufsRange[0]} a ${expectedLufsRange[1]} LUFS)`);
      }
    }
    
    console.log('\n🧪 [TEST] Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('🧪 [TEST] ❌ Erro durante o teste:', error.message);
    console.error('🧪 [TEST] Stack:', error.stack);
    process.exit(1);
  }
}

// Executar teste
runTest().then(() => {
  console.log('🧪 [TEST] Finalizado');
  process.exit(0);
}).catch(error => {
  console.error('🧪 [TEST] Erro crítico:', error);
  process.exit(1);
});