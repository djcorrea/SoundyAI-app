// 🧪 Teste direto do True Peak com normalizacao corrigida

const fs = require('fs');

// Carregar módulo corrigido
async function testTruePeakCorrected() {
  try {
    console.log('🧪 Testando True Peak com normalização corrigida...');
    
    // Importar módulo como ES6 (simulando browser)
    const moduleCode = fs.readFileSync('work/lib/audio/features/truepeak.js', 'utf8');
    
    // Simular exports/environment para Node.js
    const exports = {};
    const process = { env: {} };
    
    // Avaliar código com exports mock
    eval(`
      ${moduleCode.replace('export {', '// export {')}
      
      // Exports manuais
      exports.TruePeakDetector = TruePeakDetector;
      exports.analyzeTruePeaks = analyzeTruePeaks;
    `);
    
    const { TruePeakDetector, analyzeTruePeaks } = exports;
    
    // Criar sinal de teste: senoidal 1kHz em -6dBFS
    const sampleRate = 48000;
    const duration = 0.1; // 100ms
    const length = Math.floor(sampleRate * duration);
    const amplitude = Math.pow(10, -6.0 / 20); // -6dBFS ≈ 0.501
    
    console.log(`📊 Sinal teste: amplitude=${amplitude.toFixed(6)} (-6dBFS)`);
    
    const leftChannel = new Float32Array(length);
    const rightChannel = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const sample = amplitude * Math.sin(2 * Math.PI * 1000 * t);
      leftChannel[i] = sample;
      rightChannel[i] = sample;
    }
    
    // Testar True Peak
    console.log('\n🏔️ Executando análise True Peak...');
    const result = analyzeTruePeaks(leftChannel, rightChannel, sampleRate);
    
    console.log('\n📋 RESULTADOS:');
    console.log(`   True Peak: ${result.truePeakDbtp.toFixed(2)} dBTP`);
    console.log(`   Sample Peak: ${result.samplePeakDb.toFixed(2)} dBFS`);
    console.log(`   Diferença: ${(result.truePeakDbtp - result.samplePeakDb).toFixed(2)} dB`);
    console.log(`   True Peak Linear: ${result.true_peak_linear.toFixed(6)}`);
    console.log(`   Oversampling: ${result.oversampling_factor}x`);
    console.log(`   Mode: ${result.true_peak_mode}`);
    
    // Validações
    const expectedSamplePeak = -6.0; // -6dBFS
    const samplePeakError = Math.abs(result.samplePeakDb - expectedSamplePeak);
    
    console.log('\n✅ VALIDAÇÕES:');
    console.log(`   Sample Peak esperado: ${expectedSamplePeak.toFixed(2)} dBFS`);
    console.log(`   Sample Peak medido: ${result.samplePeakDb.toFixed(2)} dBFS`);
    console.log(`   Erro Sample Peak: ${samplePeakError.toFixed(3)} dB ${samplePeakError < 0.1 ? '✅' : '❌'}`);
    
    console.log(`   True Peak >= Sample Peak: ${result.truePeakDbtp >= result.samplePeakDb ? '✅' : '❌'}`);
    console.log(`   True Peak razoável (< +5dB Sample): ${result.truePeakDbtp < (result.samplePeakDb + 5) ? '✅' : '❌'}`);
    
    // Status final
    const isValid = (
      samplePeakError < 0.1 && 
      result.truePeakDbtp >= result.samplePeakDb && 
      result.truePeakDbtp < (result.samplePeakDb + 5)
    );
    
    console.log(`\n🎯 RESULTADO FINAL: ${isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
    
    if (isValid) {
      console.log('🎉 True Peak normalizado funcionando corretamente!');
    } else {
      console.log('💥 True Peak ainda tem problemas de calibração');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    return null;
  }
}

// Executar teste
testTruePeakCorrected().then(result => {
  if (result) {
    console.log('\n📊 Teste concluído com resultado');
  } else {
    console.log('\n💥 Teste falhou');
  }
});