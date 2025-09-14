// debug-segmentacao-DETALHES.js - VER QUE MERDA ESTÁ SAINDO DA SEGMENTAÇÃO
import "dotenv/config";

console.log("🔍 DEBUGANDO SEGMENTAÇÃO DETALHADAMENTE!");

try {
  // Importar apenas a segmentação
  const { segmentAudioTemporal } = await import("./work/api/audio/temporal-segmentation.js");
  const decodeAudioFile = (await import("./work/api/audio/audio-decoder.js")).default;
  console.log("✅ Módulos importados!");

  // Criar WAV de teste igual ao anterior
  function createTestWav() {
    const sampleRate = 48000;
    const duration = 1; // 1 segundo
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
    
    // Data (sine wave 440Hz)
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
  console.log(`🎵 WAV de teste: ${testWav.length} bytes`);

  // FASE 5.1: Decodificação
  console.log("\n🔧 FASE 5.1: Decodificação...");
  const audioData = await decodeAudioFile(testWav, "debug-test.wav", { jobId: "debug" });
  
  console.log("📊 DADOS APÓS DECODIFICAÇÃO:");
  console.log(`   Sample Rate: ${audioData.sampleRate}`);
  console.log(`   Channels: ${audioData.numberOfChannels}`);
  console.log(`   Duration: ${audioData.duration}s`);
  console.log(`   Length: ${audioData.length} samples per channel`);
  console.log(`   Left channel type: ${audioData.getChannelData(0).constructor.name}`);
  console.log(`   Right channel type: ${audioData.getChannelData(1).constructor.name}`);
  console.log(`   Left channel first 10 samples: [${Array.from(audioData.getChannelData(0).slice(0, 10)).join(', ')}]`);
  console.log(`   Right channel first 10 samples: [${Array.from(audioData.getChannelData(1).slice(0, 10)).join(', ')}]`);

  // FASE 5.2: Segmentação
  console.log("\n🔧 FASE 5.2: Segmentação...");
  const segmentedData = segmentAudioTemporal(audioData, { jobId: "debug", fileName: "debug-test.wav" });
  
  console.log("📊 DADOS APÓS SEGMENTAÇÃO:");
  console.log(`   originalChannels existe: ${!!segmentedData.originalChannels}`);
  console.log(`   timestamps existe: ${!!segmentedData.timestamps}`);
  console.log(`   framesFFT.count: ${segmentedData.framesFFT.count}`);
  console.log(`   framesRMS.count: ${segmentedData.framesRMS.count}`);
  
  if (segmentedData.originalChannels) {
    console.log(`   originalChannels.left type: ${segmentedData.originalChannels.left.constructor.name}`);
    console.log(`   originalChannels.left length: ${segmentedData.originalChannels.left.length}`);
    console.log(`   originalChannels.left first 5: [${Array.from(segmentedData.originalChannels.left.slice(0, 5)).join(', ')}]`);
  }

  if (segmentedData.framesFFT.left.length > 0) {
    const firstFrame = segmentedData.framesFFT.left[0];
    console.log(`   First FFT frame type: ${firstFrame.constructor.name}`);
    console.log(`   First FFT frame length: ${firstFrame.length}`);
    console.log(`   First FFT frame first 5: [${Array.from(firstFrame.slice(0, 5)).join(', ')}]`);
    console.log(`   First FFT frame is all zeros: ${firstFrame.every(x => x === 0)}`);
    console.log(`   First FFT frame max value: ${Math.max(...firstFrame)}`);
    console.log(`   First FFT frame min value: ${Math.min(...firstFrame)}`);
  }

  console.log("\n🎯 DEBUG DA SEGMENTAÇÃO COMPLETO!");

} catch (error) {
  console.error("💀 ERRO NO DEBUG:", error.message);
  console.error("📜 Stack:", error.stack);
}