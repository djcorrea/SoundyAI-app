// debug-fft-frames.js - Debug específico para investigar frames FFT vazios
import "dotenv/config";
import { decodeAudioFile } from "./work/api/audio/audio-decoder.js";
import { segmentAudioTemporal } from "./work/api/audio/temporal-segmentation.js";

// Criar WAV simples de teste
function createTestWav() {
  const sampleRate = 48000;
  const duration = 1;
  const samples = sampleRate * duration;
  
  // Header WAV
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
  
  // Data - sine wave 440Hz
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

async function debugFrames() {
  console.log("🔍 DEBUG: Investigando frames FFT vazios");
  
  try {
    // 1. Criar áudio de teste
    const testWav = createTestWav();
    console.log(`✅ WAV criado: ${testWav.length} bytes`);
    
    // 2. Decodificar
    console.log("\n📊 FASE 1: Decodificação");
    const audioBuffer = await decodeAudioFile(testWav, "debug-test.wav", { jobId: "debug-job" });
    console.log("✅ Decodificação concluída:");
    console.log("  - Sample rate:", audioBuffer.sampleRate);
    console.log("  - Channels:", audioBuffer.numberOfChannels);
    console.log("  - Duration:", audioBuffer.duration.toFixed(3) + "s");
    console.log("  - Left samples:", audioBuffer.getChannelData(0).length);
    console.log("  - Right samples:", audioBuffer.getChannelData(1).length);
    
    // Verificar se samples são válidos
    const leftData = audioBuffer.getChannelData(0);
    const rightData = audioBuffer.getChannelData(1);
    
    console.log("  - Left sample[0]:", leftData[0]);
    console.log("  - Left sample[1000]:", leftData[1000]);
    console.log("  - Right sample[0]:", rightData[0]);
    console.log("  - Right sample[1000]:", rightData[1000]);
    
    // 3. Segmentação temporal
    console.log("\n🔪 FASE 2: Segmentação temporal");
    const segmentResult = await segmentAudioTemporal(
      audioBuffer,
      "debug-test.wav",
      "debug-job",
      null
    );
    
    console.log("✅ Segmentação concluída:");
    console.log("  - FFT frames left:", segmentResult.framesFFT?.left?.length);
    console.log("  - FFT frames right:", segmentResult.framesFFT?.right?.length);
    console.log("  - RMS frames left:", segmentResult.framesRMS?.left?.length);
    console.log("  - RMS frames right:", segmentResult.framesRMS?.right?.length);
    console.log("  - Original channels:", segmentResult.originalChannels ? "OK" : "MISSING");
    console.log("  - Timestamps FFT:", segmentResult.framesFFT?.timestamps?.length);
    console.log("  - Timestamps RMS:", segmentResult.framesRMS?.timestamps?.length);
    
    // 4. Verificar primeiros frames FFT
    if (segmentResult.framesFFT && segmentResult.framesFFT.left) {
      console.log("\n🔍 ANÁLISE DO FRAME 0:");
      const frame0Left = segmentResult.framesFFT.left[0];
      const frame0Right = segmentResult.framesFFT.right[0];
      
      console.log("  - Frame 0 left length:", frame0Left?.length);
      console.log("  - Frame 0 right length:", frame0Right?.length);
      console.log("  - Frame 0 left[0]:", frame0Left?.[0]);
      console.log("  - Frame 0 left[100]:", frame0Left?.[100]);
      console.log("  - Frame 0 right[0]:", frame0Right?.[0]);
      console.log("  - Frame 0 right[100]:", frame0Right?.[100]);
      
      // Verificar se há NaN ou Infinity
      let hasNaN = false;
      let hasInfinity = false;
      for (let i = 0; i < Math.min(10, frame0Left?.length || 0); i++) {
        if (isNaN(frame0Left[i])) hasNaN = true;
        if (!isFinite(frame0Left[i])) hasInfinity = true;
      }
      console.log("  - Frame 0 left tem NaN:", hasNaN);
      console.log("  - Frame 0 left tem Infinity:", hasInfinity);
      
      // 5. Testar FFT engine diretamente
      console.log("\n⚙️ FASE 3: Teste direto do FFT engine");
      const { FastFFT } = await import("./work/lib/audio/fft.js");
      const fftEngine = new FastFFT(4096);
      
      if (frame0Left && frame0Left.length > 0) {
        try {
          const fftResult = fftEngine.fft(frame0Left);
          console.log("✅ FFT processou frame 0:");
          console.log("  - FFT magnitude length:", fftResult.magnitude?.length);
          console.log("  - FFT phase length:", fftResult.phase?.length);
          console.log("  - FFT magnitude[0]:", fftResult.magnitude?.[0]);
          console.log("  - FFT magnitude[10]:", fftResult.magnitude?.[10]);
          
          if (!fftResult.magnitude || fftResult.magnitude.length === 0) {
            console.log("❌ FFT retornou magnitude vazio!");
          }
        } catch (fftError) {
          console.log("❌ Erro no FFT:", fftError.message);
        }
      } else {
        console.log("❌ Frame 0 está vazio ou inválido!");
      }
    } else {
      console.log("❌ Nenhum frame FFT foi gerado na estrutura framesFFT!");
    }
    
  } catch (error) {
    console.error("❌ Erro:", error.message);
    console.error("Stack:", error.stack);
  }
}

debugFrames();