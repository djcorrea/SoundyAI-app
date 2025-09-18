/**
 * 🕵️ Debug True Peak Alto - Capturar exatamente onde valores >1.0 são gerados
 */

const { TruePeakDetector } = require('./work/lib/audio/features/truepeak.js');

function generateExtremeMusic() {
  // Gerar sinal que teoricamente pode causar True Peak >0 dBTP
  const samples = 1024;
  const leftChannel = new Float32Array(samples);
  const rightChannel = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    // Múltiplas frequências com amplitude próxima do máximo
    const f1 = 0.98 * Math.sin(2 * Math.PI * 1000 * i / 48000);
    const f2 = 0.30 * Math.sin(2 * Math.PI * 3000 * i / 48000 + Math.PI / 4);
    const f3 = 0.15 * Math.sin(2 * Math.PI * 5000 * i / 48000 + Math.PI / 2);
    
    const mixedSignal = f1 + f2 + f3;
    
    // Normalizar para não clippar no domínio sample mas permitir True Peak alto
    const normalizedSignal = mixedSignal / 1.1; // Reduzir ligeiramente
    
    leftChannel[i] = normalizedSignal;
    rightChannel[i] = normalizedSignal * 0.95; // Canal direito levemente menor
  }
  
  return { leftChannel, rightChannel };
}

async function debugHighTruePeak() {
  console.log('🕵️ [DEBUG_HIGH_TP] Investigando geração de True Peak >0 dBTP...\n');
  
  // Gerar sinal de teste
  const { leftChannel, rightChannel } = generateExtremeMusic();
  
  console.log('🔬 Testando com sinal de múltiplas frequências:');
  console.log('   - 3 senóides sobrepostas');
  console.log('   - Sample peak deve estar próximo de -1 dB');
  console.log('   - True Peak pode exceder devido a picos intersample\n');
  
  // Testar com detector individual para ver logs detalhados
  console.log('📡 Analisando canal esquerdo com logs de debug...');
  const detector = new TruePeakDetector(48000);
  const result = detector.detectTruePeak(leftChannel);
  
  console.log('\n📊 Resultado do debug:');
  console.log(`   True Peak detectado: ${result.true_peak_dbtp.toFixed(2)} dBTP`);
  console.log(`   True Peak linear: ${result.true_peak_linear.toFixed(6)}`);
  console.log(`   Posição do pico: ${result.peak_position.toFixed(1)} samples`);
  
  if (result.true_peak_dbtp > 0) {
    console.log('\n🎯 [SUCESSO] Conseguimos replicar True Peak >0 dBTP!');
    console.log('   - Confirma que algoritmo pode gerar valores altos legitimamente');
    console.log('   - 3.28 dBTP é possível para certas combinações de frequência');
  } else {
    console.log('\n🤔 [INTERESSANTE] Não conseguimos replicar True Peak >0 dBTP');
    console.log('   - Pode ser específico do tipo de música/masterização');
    console.log('   - Ou há outro fator que não reproduzimos');
  }
  
  // Verificar sample peak para comparação
  const maxSample = Math.max(...leftChannel.map(Math.abs));
  const samplePeakdB = 20 * Math.log10(maxSample);
  console.log(`\n📐 Sample Peak de referência: ${samplePeakdB.toFixed(2)} dB`);
  console.log(`   Diferença TP-SP: ${(result.true_peak_dbtp - samplePeakdB).toFixed(2)} dB`);
  
  return result.true_peak_dbtp;
}

async function runDebugTest() {
  console.log('🚀 Iniciando debug de True Peak alto...\n');
  
  try {
    const truePeakResult = await debugHighTruePeak();
    
    console.log('\n🎯 [CONCLUSÃO DO DEBUG]');
    if (truePeakResult > 0) {
      console.log('✅ True Peak >0 dBTP é reproduzível com sinais específicos');
      console.log('✅ 3.28 dBTP na sua música é provavelmente legítimo');
      console.log('⚠️ Indica música com clipping/limitação agressiva');
    } else {
      console.log('🤷 Não reproduzimos True Peak >0 dBTP em teste sintético');
      console.log('🔍 Sua música pode ter características específicas');
      console.log('💡 Recomendado: análise do arquivo real da música');
    }
    
  } catch (error) {
    console.error('\n💥 [ERRO] Debug falhou:', error.message);
  }
}

runDebugTest();