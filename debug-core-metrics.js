// debug-core-metrics.js - Debug específico para core-metrics
import "dotenv/config";
import { decodeAudioFile } from "./work/api/audio/audio-decoder.js";
import { segmentAudioTemporal } from "./work/api/audio/temporal-segmentation.js";
import { calculateCoreMetrics } from "./work/api/audio/core-metrics.js";

// Criar WAV simples de teste
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

async function debugCoreMetrics() {
  console.log("🔍 DEBUG: Investigando core-metrics FFT processing");
  
  try {
    // 1. Criar áudio de teste e decodificar
    const testWav = createTestWav();
    console.log(`✅ WAV criado: ${testWav.length} bytes`);
    
    const audioBuffer = await decodeAudioFile(testWav, "debug-test.wav", { jobId: "debug-job" });
    console.log(`✅ Decodificação: ${audioBuffer.numberOfChannels}ch, ${audioBuffer.sampleRate}Hz, ${audioBuffer.duration}s`);
    
    // 2. Segmentação temporal
    const segmentResult = await segmentAudioTemporal(audioBuffer, { fileName: "debug-test.wav", jobId: "debug-job" });
    console.log(`✅ Segmentação: ${segmentResult.framesFFT.count} frames FFT, ${segmentResult.framesRMS.count} frames RMS`);
    
    // 3. Verificar estrutura framesFFT
    console.log("\n🔍 ESTRUTURA framesFFT:");
    console.log("  - framesFFT.left:", Array.isArray(segmentResult.framesFFT.left) ? `Array[${segmentResult.framesFFT.left.length}]` : "NOT ARRAY");
    console.log("  - framesFFT.right:", Array.isArray(segmentResult.framesFFT.right) ? `Array[${segmentResult.framesFFT.right.length}]` : "NOT ARRAY");
    console.log("  - framesFFT.count:", segmentResult.framesFFT.count);
    
    if (segmentResult.framesFFT.left && segmentResult.framesFFT.left.length > 0) {
      const frame0 = segmentResult.framesFFT.left[0];
      console.log("  - frame[0]:", frame0 ? `${frame0.constructor.name}[${frame0.length}]` : "NULL");
      console.log("  - frame[0][0]:", frame0?.[0]);
      console.log("  - frame[0][100]:", frame0?.[100]);
    }
    
    // 4. Tentar processamento core-metrics
    console.log("\n⚙️ TESTE CORE-METRICS:");
    
    try {
      console.log("📊 Iniciando calculateCoreMetrics...");
      const coreResults = await calculateCoreMetrics(segmentResult, { jobId: "debug-job" });
      console.log("✅ Core metrics processado com sucesso!");
      console.log("  - LUFS:", coreResults.lufs);
      console.log("  - True Peak:", coreResults.truePeak);
      console.log("  - Spectral Balance:", coreResults.spectralBalance);
      
    } catch (coreError) {
      console.log("❌ Erro no calculateCoreMetrics:");
      console.log("  - Message:", coreError.message);
      console.log("  - Stage:", coreError.stage);
      console.log("  - Code:", coreError.code);
      
      // Debug mais profundo
      console.log("\n🔍 DEBUG PROFUNDO:");
      const { left: leftFrames, right: rightFrames, count } = segmentResult.framesFFT;
      console.log("  - Desestruturação count:", count);
      console.log("  - Desestruturação leftFrames:", leftFrames ? `${leftFrames.constructor.name}[${leftFrames.length}]` : "NULL");
      console.log("  - Desestruturação rightFrames:", rightFrames ? `${rightFrames.constructor.name}[${rightFrames.length}]` : "NULL");
      
      if (leftFrames && leftFrames.length > 0) {
        console.log("  - leftFrames[0]:", leftFrames[0] ? `${leftFrames[0].constructor.name}[${leftFrames[0].length}]` : "NULL");
        if (leftFrames[0] && leftFrames[0].length > 0) {
          console.log("  - leftFrames[0][0]:", leftFrames[0][0]);
          console.log("  - leftFrames[0] is valid:", !isNaN(leftFrames[0][0]) && isFinite(leftFrames[0][0]));
        }
      }
    }
    
  } catch (error) {
    console.error("❌ Erro geral:", error.message);
    console.error("Stack:", error.stack);
  }
}

debugCoreMetrics();