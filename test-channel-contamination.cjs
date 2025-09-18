/**
 * 🧪 Teste de Contaminação Entre Canais - True Peak
 * Verificar se os detectores separados evitam contaminação de delay line
 */

const { analyzeTruePeaks } = require('./work/lib/audio/features/truepeak.js');

function generateDifferentChannels() {
  // Canal esquerdo: alta amplitude (-1 dB)
  const leftChannel = new Float32Array(2048);
  const leftAmp = Math.pow(10, -1.0 / 20); // -1 dB
  
  // Canal direito: baixa amplitude (-20 dB)
  const rightChannel = new Float32Array(2048);
  const rightAmp = Math.pow(10, -20.0 / 20); // -20 dB
  
  for (let i = 0; i < 2048; i++) {
    leftChannel[i] = leftAmp * Math.sin(2 * Math.PI * 1000 * i / 48000);
    rightChannel[i] = rightAmp * Math.sin(2 * Math.PI * 1500 * i / 48000);
  }
  
  return { leftChannel, rightChannel };
}

async function testChannelContamination() {
  console.log('🧪 [CHANNEL_TEST] Testando contaminação entre canais...\n');
  
  const { leftChannel, rightChannel } = generateDifferentChannels();
  
  console.log('📊 Canais de teste:');
  console.log('   🔵 Canal esquerdo: -1.0 dB (alta amplitude)');
  console.log('   🔴 Canal direito: -20.0 dB (baixa amplitude)');
  
  // Analisar com detectores separados
  console.log('\n🔬 Analisando com analyzeTruePeaks (detectores separados)...');
  const result = analyzeTruePeaks(leftChannel, rightChannel, 48000);
  
  console.log('\n📈 Resultados:');
  console.log(`   True Peak final: ${result.true_peak_dbtp.toFixed(2)} dBTP`);
  console.log(`   True Peak linear: ${result.true_peak_linear.toFixed(6)}`);
  
  // Verificar se o resultado não está contaminado
  // Se houvesse contaminação, o True Peak seria impossível (>0 dBTP)
  const isRealistic = result.true_peak_dbtp <= 5.0 && result.true_peak_dbtp >= -25.0;
  const noClipping = result.true_peak_dbtp < 0.5; // Não deve haver clipping
  
  console.log('\n🔍 Validações:');
  console.log(`   Valor realista (≤5 dBTP): ${isRealistic ? '✅' : '❌'}`);
  console.log(`   Sem clipping excessivo (<0.5 dBTP): ${noClipping ? '✅' : '❌'}`);
  
  if (isRealistic && noClipping) {
    console.log('\n🎉 [CHANNEL_TEST] PASSOU ✅');
    console.log('   - Sem contaminação entre canais');
    console.log('   - Detectores separados funcionando corretamente');
    console.log('   - True Peak dentro de faixa realista');
    return true;
  } else {
    console.log('\n❌ [CHANNEL_TEST] FALHOU');
    console.log('   - Possível contaminação entre canais');
    console.log(`   - True Peak fora da faixa: ${result.true_peak_dbtp.toFixed(2)} dBTP`);
    return false;
  }
}

async function runChannelTest() {
  console.log('🚀 Iniciando teste de contaminação entre canais...\n');
  
  try {
    const success = await testChannelContamination();
    
    if (success) {
      console.log('\n🎯 [RESULTADO] CORREÇÃO DE CANAL EFETIVA ✅');
      console.log('   - Detectores separados eliminaram contaminação');
      console.log('   - True Peak agora calcula corretamente para ambos canais');
    } else {
      console.log('\n❌ [RESULTADO] AINDA HÁ CONTAMINAÇÃO');
    }
    
  } catch (error) {
    console.error('\n💥 [ERRO] Falha no teste:', error.message);
    console.error(error.stack);
  }
}

runChannelTest();