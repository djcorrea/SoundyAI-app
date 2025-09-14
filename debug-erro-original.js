// debug-erro-original.js - VER O ERRO ORIGINAL SEM CATCH
import "dotenv/config";

console.log("🔍 DEBUGANDO ERRO ORIGINAL!");

try {
  const { segmentAudioTemporal } = await import("./work/api/audio/temporal-segmentation.js");
  const decodeAudioFile = (await import("./work/api/audio/audio-decoder.js")).default;
  const { FastFFT } = await import("./work/lib/audio/fft.js");
  const { ensureFiniteArray } = await import("./work/lib/audio/error-handling.js");
  console.log("✅ Módulos importados!");

  // Criar WAV de teste
  function createTestWav() {
    const sampleRate = 48000;
    const duration = 1;
    const samples = sampleRate * duration;
    
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + samples * 4, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(2, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 4, 28);
    header.writeUInt16LE(4, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(samples * 4, 40);
    
    const data = Buffer.alloc(samples * 4);
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
      const sample16 = Math.round(sample * 32767);
      
      data.writeInt16LE(sample16, i * 4);
      data.writeInt16LE(sample16, i * 4 + 2);
    }
    
    return Buffer.concat([header, data]);
  }

  const testWav = createTestWav();
  const audioData = await decodeAudioFile(testWav, "debug-erro.wav", { jobId: "debug-erro" });
  const segmentedData = segmentAudioTemporal(audioData, { jobId: "debug-erro", fileName: "debug-erro.wav" });
  
  console.log("✅ Dados prontos!");
  
  // Testar exatamente como o core-metrics faz
  const leftFrames = segmentedData.framesFFT.left;
  const rightFrames = segmentedData.framesFFT.right;
  
  console.log(`📊 Frames: left=${leftFrames.length}, right=${rightFrames.length}`);
  
  const fft = new FastFFT();
  console.log("✅ FFT engine criado!");
  
  // Testar frame 0 especificamente
  const frame0Left = leftFrames[0];
  const frame0Right = rightFrames[0];
  
  console.log(`📊 Frame 0 left: type=${frame0Left.constructor.name}, length=${frame0Left.length}`);
  console.log(`📊 Frame 0 left first 5: [${Array.from(frame0Left.slice(0, 5)).join(', ')}]`);
  console.log(`📊 Frame 0 left é null/undefined: ${frame0Left == null}`);
  console.log(`📊 Frame 0 left length é 0: ${frame0Left.length === 0}`);
  
  // Testar FFT no frame 0
  console.log("\n🔧 TESTANDO FFT frame 0...");
  const leftFFT = fft.fft(frame0Left);
  
  console.log(`📊 leftFFT: existe=${!!leftFFT}, type=${typeof leftFFT}`);
  console.log(`📊 leftFFT.magnitude: existe=${!!leftFFT.magnitude}, type=${leftFFT.magnitude?.constructor.name}, length=${leftFFT.magnitude?.length}`);
  
  if (leftFFT.magnitude) {
    console.log(`📊 leftFFT.magnitude first 3: [${Array.from(leftFFT.magnitude.slice(0, 3)).join(', ')}]`);
    
    // Testar ensureFiniteArray
    console.log("\n🔧 TESTANDO ensureFiniteArray...");
    try {
      ensureFiniteArray(leftFFT.magnitude, 'debug_test', 'left_magnitude_frame_0');
      console.log("✅ ensureFiniteArray PASSOU!");
    } catch (ensureError) {
      console.error("💀 ensureFiniteArray FALHOU:", ensureError.message);
    }
  }

  console.log("\n🎯 DEBUG ERRO ORIGINAL COMPLETO!");

} catch (error) {
  console.error("💀 ERRO:", error.message);
  console.error("📜 Stack:", error.stack);
}