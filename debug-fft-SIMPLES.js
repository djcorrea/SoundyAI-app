// debug-fft-SIMPLES.js - TESTAR SÓ O FFT
import "dotenv/config";

console.log("🔍 TESTANDO SÓ O FFT!");

try {
  const { FastFFT } = await import("./work/lib/audio/fft.js");
  console.log("✅ FastFFT importado!");

  const fft = new FastFFT();
  console.log("✅ FFT instanciado!");

  // Criar um frame de teste simples
  const testFrame = new Float32Array(4096);
  for (let i = 0; i < testFrame.length; i++) {
    testFrame[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.5;
  }
  
  console.log(`🎵 Frame de teste criado: ${testFrame.length} samples`);
  console.log(`📊 Primeiro valor: ${testFrame[0]}`);
  console.log(`📊 Último valor: ${testFrame[testFrame.length - 1]}`);
  console.log(`📊 Todos zeros: ${testFrame.every(x => x === 0)}`);

  // Testar FFT
  console.log("\n🔧 TESTANDO FFT...");
  const result = fft.fft(testFrame);
  
  console.log("📊 RESULTADO FFT:");
  console.log(`   result existe: ${!!result}`);
  console.log(`   result type: ${typeof result}`);
  console.log(`   result keys: ${Object.keys(result)}`);
  
  if (result.magnitude) {
    console.log(`   magnitude type: ${result.magnitude.constructor.name}`);
    console.log(`   magnitude length: ${result.magnitude.length}`);
    console.log(`   magnitude primeiro: ${result.magnitude[0]}`);
    console.log(`   magnitude todos zeros: ${result.magnitude.every(x => x === 0)}`);
    console.log(`   magnitude max: ${Math.max(...result.magnitude)}`);
  } else {
    console.log("   ❌ magnitude não existe!");
  }

  console.log("\n🎯 TESTE FFT COMPLETO!");

} catch (error) {
  console.error("💀 ERRO NO FFT:", error.message);
  console.error("📜 Stack:", error.stack);
}