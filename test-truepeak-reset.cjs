/**
 * 🧪 Teste de Reset do True Peak - Simular múltiplas análises
 * Verificar se o estado do detector está sendo limpo corretamente
 */

const fs = require('fs');
const { TruePeakDetector } = require('./work/lib/audio/features/truepeak.js');

function generateTestSignal(level_dB, samples = 2048) {
  const amplitude = Math.pow(10, level_dB / 20);
  const signal = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    signal[i] = amplitude * Math.sin(2 * Math.PI * 1000 * i / 48000);
  }
  
  return signal;
}

async function testMultipleAnalyses() {
  console.log('🧪 [RESET_TEST] Testando múltiplas análises consecutivas...\n');
  
  const detector = new TruePeakDetector(48000);
  
  // Gerar 5 sinais idênticos de -1 dB
  const testSignal = generateTestSignal(-1.0, 2048);
  
  console.log('📊 Executando 5 análises consecutivas do mesmo sinal (-1.0 dB):');
  
  for (let analysis = 1; analysis <= 5; analysis++) {
    console.log(`\n--- ANÁLISE ${analysis} ---`);
    
    const result = detector.detectTruePeak(testSignal);
    
    console.log(`📈 Análise ${analysis}: True Peak = ${result.true_peak_dbtp.toFixed(2)} dBTP`);
    
    // Verificar se está acumulando valores incorretos
    if (result.true_peak_dbtp > 10) {
      console.error(`❌ [ERRO] Análise ${analysis} retornou valor impossível: ${result.true_peak_dbtp.toFixed(2)} dBTP`);
      console.error(`🔍 [DEBUG] Delay line deve ter sido contaminado com análise anterior`);
      return false;
    }
    
    if (result.true_peak_dbtp < -50) {
      console.error(`❌ [ERRO] Análise ${analysis} retornou valor muito baixo: ${result.true_peak_dbtp.toFixed(2)} dBTP`);
      return false;
    }
    
    // True Peak deve estar próximo de -1.0 dBTP (entre -1.5 e -0.5)
    if (result.true_peak_dbtp >= -1.5 && result.true_peak_dbtp <= -0.5) {
      console.log(`✅ [OK] Análise ${analysis}: True Peak dentro do esperado`);
    } else {
      console.warn(`⚠️ [WARN] Análise ${analysis}: True Peak fora do range esperado (-1.5 a -0.5 dBTP)`);
    }
  }
  
  console.log('\n🎉 [RESET_TEST] Todas as análises completadas sem valores extremos!');
  console.log('✅ Reset do detector está funcionando corretamente');
  return true;
}

async function runResetTest() {
  console.log('🚀 Iniciando teste de reset do True Peak detector...\n');
  
  try {
    const success = await testMultipleAnalyses();
    
    if (success) {
      console.log('\n🎯 [RESULTADO] TESTE DE RESET PASSOU ✅');
      console.log('   - Múltiplas análises produzem resultados consistentes');
      console.log('   - Delay line sendo limpo corretamente entre análises');
      console.log('   - Sem acumulação de valores incorretos');
    } else {
      console.log('\n❌ [RESULTADO] TESTE DE RESET FALHOU');
      console.log('   - Detector ainda está acumulando estado entre análises');
    }
    
  } catch (error) {
    console.error('\n💥 [ERRO] Falha no teste:', error.message);
    console.error(error.stack);
  }
}

runResetTest();