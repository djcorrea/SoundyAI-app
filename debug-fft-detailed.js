// Adicionar logs temporários no core-metrics.js para debug
// Esta é uma versão de debug que vai nos mostrar exatamente o que está acontecendo

import "dotenv/config";
import { decodeAudioFile } from "./work/api/audio/audio-decoder.js";
import { segmentAudioTemporal } from "./work/api/audio/temporal-segmentation.js";

// WAV de teste
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

// Função de debug que replica exatamente o calculateFFTMetrics
async function debugCalculateFFTMetrics(framesFFT, options = {}) {
  const { FastFFT } = await import("./work/lib/audio/fft.js");
  const { ensureFiniteArray } = await import("./work/lib/audio/error-handling.js");
  
  console.log("\n🔧 DEBUG calculateFFTMetrics:");
  
  const { left: leftFrames, right: rightFrames, count } = framesFFT;
  console.log(`  - Desestruturação: left=${leftFrames?.length}, right=${rightFrames?.length}, count=${count}`);
  
  if (count === 0) {
    console.log("❌ Count é 0!");
    return;
  }
  
  const fftEngine = new FastFFT();
  console.log("  - FFT engine criado");
  
  const maxFrames = Math.min(count, 1000);
  console.log(`  - Processing ${maxFrames} frames`);
  
  for (let i = 0; i < Math.min(3, maxFrames); i++) { // Só os primeiros 3 frames para debug
    console.log(`\n    🔍 FRAME ${i}:`);
    
    const leftFrame = leftFrames[i];
    const rightFrame = rightFrames[i];
    
    console.log(`      - leftFrame: ${leftFrame?.constructor?.name}[${leftFrame?.length}]`);
    console.log(`      - rightFrame: ${rightFrame?.constructor?.name}[${rightFrame?.length}]`);
    
    if (!leftFrame || leftFrame.length === 0) {
      console.log("❌ leftFrame é vazio!");
      continue;
    }
    
    console.log(`      - leftFrame[0]: ${leftFrame[0]}`);
    console.log(`      - leftFrame[100]: ${leftFrame[100]}`);
    console.log(`      - leftFrame type: ${typeof leftFrame[0]}`);
    console.log(`      - leftFrame valid: ${!isNaN(leftFrame[0]) && isFinite(leftFrame[0])}`);
    
    // Tentar FFT
    try {
      console.log("      - Executando FFT...");
      const leftFFT = fftEngine.fft(leftFrame);
      console.log(`      - FFT resultado: magnitude[${leftFFT.magnitude?.length}], phase[${leftFFT.phase?.length}]`);
      console.log(`      - magnitude[0]: ${leftFFT.magnitude?.[0]}`);
      console.log(`      - magnitude[10]: ${leftFFT.magnitude?.[10]}`);
      
      if (!leftFFT || !leftFFT.magnitude || leftFFT.magnitude.length === 0) {
        console.log("❌ FFT retornou magnitude vazio!");
        continue;
      }
      
      // Tentar validação
      try {
        ensureFiniteArray(leftFFT.magnitude, 'core_metrics', `left_magnitude_frame_${i}`);
        console.log("✅ ensureFiniteArray passou!");
      } catch (validateError) {
        console.log(`❌ ensureFiniteArray falhou: ${validateError.message}`);
      }
      
    } catch (fftError) {
      console.log(`❌ FFT falhou: ${fftError.message}`);
    }
  }
}

async function runDebug() {
  try {
    const testWav = createTestWav();
    const audioBuffer = await decodeAudioFile(testWav, "debug.wav", { jobId: "debug" });
    const segmentResult = await segmentAudioTemporal(audioBuffer, { fileName: "debug.wav", jobId: "debug" });
    
    await debugCalculateFFTMetrics(segmentResult.framesFFT, { jobId: "debug" });
    
  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

runDebug();