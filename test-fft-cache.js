// test-fft-cache.js - Testar se o cache do FFT está corrompido
import "dotenv/config";

async function testFFTCache() {
  console.log("🔍 TESTE: Cache FFT corrompido");
  
  const { FastFFT } = await import("./work/lib/audio/fft.js");
  
  // Criar dados de teste idênticos
  const testData = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) {
    testData[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.5;
  }
  
  console.log("✅ Dados de teste criados: Float32Array[4096]");
  console.log(`  - testData[0]: ${testData[0]}`);
  console.log(`  - testData[100]: ${testData[100]}`);
  
  // TESTE 1: FFT engine novo
  console.log("\n🟢 TESTE 1: FFT Engine novo");
  const freshFFT = new FastFFT();
  try {
    const result1 = freshFFT.fft(testData);
    console.log("✅ FFT novo funcionou:");
    console.log(`  - magnitude length: ${result1.magnitude.length}`);
    console.log(`  - magnitude[0]: ${result1.magnitude[0]}`);
    console.log(`  - magnitude[10]: ${result1.magnitude[10]}`);
  } catch (error1) {
    console.log("❌ FFT novo falhou:", error1.message);
  }
  
  // TESTE 2: FFT engine reutilizado (simular instância global)
  console.log("\n🔴 TESTE 2: FFT Engine reutilizado");
  try {
    const result2 = freshFFT.fft(testData);
    console.log("✅ FFT reutilizado funcionou:");
    console.log(`  - magnitude length: ${result2.magnitude.length}`);
    console.log(`  - magnitude[0]: ${result2.magnitude[0]}`);
    console.log(`  - magnitude[10]: ${result2.magnitude[10]}`);
  } catch (error2) {
    console.log("❌ FFT reutilizado falhou:", error2.message);
  }
  
  // TESTE 3: FFT com dados corrompidos para verificar estado interno
  console.log("\n🟡 TESTE 3: Corromper estado interno");
  
  // Tentar corromper o cache
  console.log("Cache antes:", freshFFT.cache.size);
  
  // Adicionar entrada inválida no cache
  freshFFT.cache.set(4096, { cosTable: null, sinTable: null });
  console.log("Cache após corrupção:", freshFFT.cache.size);
  
  try {
    const result3 = freshFFT.fft(testData);
    console.log("✅ FFT com cache corrompido funcionou:");
    console.log(`  - magnitude length: ${result3.magnitude.length}`);
    console.log(`  - magnitude[0]: ${result3.magnitude[0]}`);
  } catch (error3) {
    console.log("❌ FFT com cache corrompido falhou:", error3.message);
  }
  
  // TESTE 4: FFT com cache limpo
  console.log("\n🔵 TESTE 4: FFT com cache limpo");
  freshFFT.cache.clear();
  try {
    const result4 = freshFFT.fft(testData);
    console.log("✅ FFT com cache limpo funcionou:");
    console.log(`  - magnitude length: ${result4.magnitude.length}`);
    console.log(`  - magnitude[0]: ${result4.magnitude[0]}`);
  } catch (error4) {
    console.log("❌ FFT com cache limpo falhou:", error4.message);
  }
}

testFFTCache();