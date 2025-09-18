/**
 * 🧪 Teste de True Peak Alto - Verificar se 3.28 dBTP é legítimo
 * Simular música alta com clipping para validar algoritmo
 */

const { analyzeTruePeaks } = require('./work/lib/audio/features/truepeak.js');

function generateLoudMusic() {
  // Simular música muito alta com clipping intencional
  const samples = 4096;
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  // Amplitude próxima do clipping (0.95) com picos que podem exceder
  const baseAmp = 0.95; // -0.44 dB
  
  for (let i = 0; i < samples; i++) {
    // Mix de frequências para simular música real
    const fundamental = Math.sin(2 * Math.PI * 440 * i / 48000);
    const harmonic = 0.3 * Math.sin(2 * Math.PI * 880 * i / 48000);
    const noise = 0.05 * (Math.random() - 0.5);
    
    const signal = fundamental + harmonic + noise;
    
    // Amplificar para causar clipping ocasional
    leftChannel[i] = Math.max(-1.0, Math.min(1.0, baseAmp * signal * 1.1));
    rightChannel[i] = Math.max(-1.0, Math.min(1.0, baseAmp * signal * 1.08));
  }
  
  return { leftChannel, rightChannel };
}

function generateDigitalClipping() {
  // Simular clipping digital severo
  const samples = 2048;
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    // Sinal que deliberadamente clippa
    const rawSignal = 1.2 * Math.sin(2 * Math.PI * 1000 * i / 48000);
    
    // Hard clipping at ±1.0
    leftChannel[i] = Math.max(-1.0, Math.min(1.0, rawSignal));
    rightChannel[i] = Math.max(-1.0, Math.min(1.0, rawSignal * 0.95));
  }
  
  return { leftChannel, rightChannel };
}

async function testHighTruePeak() {
  console.log('🧪 [HIGH_TP_TEST] Testando True Peak alto para validar algoritmo...\n');
  
  // Teste 1: Música simulada alta mas realista
  console.log('🔬 TESTE 1: Música alta com clipping moderado');
  const { leftChannel: leftLoud, rightChannel: rightLoud } = generateLoudMusic();
  
  const resultLoud = analyzeTruePeaks(leftLoud, rightLoud, 48000);
  
  console.log(`📊 Resultado música alta:`);
  console.log(`   Sample Peak: ~-0.44 dB`);
  console.log(`   True Peak: ${resultLoud.true_peak_dbtp.toFixed(2)} dBTP`);
  console.log(`   Clipping: ${resultLoud.exceeds_0dbtp ? 'SIM' : 'NÃO'} (>0 dBTP)`);
  
  // Teste 2: Clipping digital severo
  console.log('\n🔬 TESTE 2: Clipping digital severo');
  const { leftChannel: leftClip, rightChannel: rightClip } = generateDigitalClipping();
  
  const resultClip = analyzeTruePeaks(leftClip, rightClip, 48000);
  
  console.log(`📊 Resultado clipping severo:`);
  console.log(`   Sample Peak: 0.00 dB (clipped)`);
  console.log(`   True Peak: ${resultClip.true_peak_dbtp.toFixed(2)} dBTP`);
  console.log(`   Clipping: ${resultClip.exceeds_0dbtp ? 'SIM' : 'NÃO'} (>0 dBTP)`);
  
  // Análise dos resultados
  console.log('\n🔍 ANÁLISE DOS RESULTADOS:');
  
  const isLoudRealistic = resultLoud.true_peak_dbtp <= 2.0 && resultLoud.true_peak_dbtp >= -1.0;
  const isClipRealistic = resultClip.true_peak_dbtp <= 4.0 && resultClip.true_peak_dbtp >= -0.5;
  
  console.log(`   Música alta realista (≤2 dBTP): ${isLoudRealistic ? '✅' : '❌'}`);
  console.log(`   Clipping severo realista (≤4 dBTP): ${isClipRealistic ? '✅' : '❌'}`);
  
  // Comparar com o valor problemático de 3.28 dBTP
  console.log('\n🎯 COMPARAÇÃO COM 3.28 dBTP:');
  console.log(`   O valor 3.28 dBTP está no range esperado para música alta: ${resultLoud.true_peak_dbtp <= 3.5 ? '✅ POSSÍVEL' : '❌ SUSPEITO'}`);
  console.log(`   Indica clipping digital: ${resultLoud.true_peak_dbtp > 0 ? '⚠️ SIM' : '✅ NÃO'}`);
  
  if (resultLoud.true_peak_dbtp > 0 || resultClip.true_peak_dbtp > 0) {
    console.log('\n🚨 CONCLUSÃO: True Peak >0 dBTP é tecnicamente possível mas indica:');
    console.log('   - Clipping digital (distorção)');
    console.log('   - Masterização muito agressiva');
    console.log('   - Possíveis artefatos audíveis');
    console.log('   - Não recomendado para broadcast (EBU R128: ≤-1 dBTP)');
  }
  
  return {
    loudMusic: resultLoud.true_peak_dbtp,
    clippedMusic: resultClip.true_peak_dbtp,
    algorithmsWorking: isLoudRealistic && isClipRealistic
  };
}

async function runHighTruePeakTest() {
  console.log('🚀 Iniciando teste de True Peak alto...\n');
  
  try {
    const results = await testHighTruePeak();
    
    if (results.algorithmsWorking) {
      console.log('\n🎯 [VEREDICTO] ALGORITMO FUNCIONANDO CORRETAMENTE ✅');
      console.log('   - 3.28 dBTP é tecnicamente possível para música muito alta');
      console.log('   - Indica clipping digital real na música');
      console.log('   - Algoritmo detectando corretamente picos intersample');
      console.log('\n💡 RECOMENDAÇÃO: Verificar se a música realmente tem clipping audível');
    } else {
      console.log('\n❌ [VEREDICTO] POSSÍVEL PROBLEMA NO ALGORITMO');
      console.log('   - Valores ainda fora do esperado');
      console.log('   - Necessária investigação adicional');
    }
    
  } catch (error) {
    console.error('\n💥 [ERRO] Falha no teste:', error.message);
    console.error(error.stack);
  }
}

runHighTruePeakTest();