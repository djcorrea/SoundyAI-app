// debug-core-metrics-DIRETO.js - TESTAR SÓ O CORE METRICS
import "dotenv/config";

console.log("🔍 DEBUGANDO CORE METRICS DIRETAMENTE!");

try {
  // Importar core metrics
  const { calculateCoreMetrics } = await import("./work/api/audio/core-metrics.js");
  const { segmentAudioTemporal } = await import("./work/api/audio/temporal-segmentation.js");
  const decodeAudioFile = (await import("./work/api/audio/audio-decoder.js")).default;
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
  console.log(`🎵 WAV de teste: ${testWav.length} bytes`);

  // Fases 5.1 e 5.2
  const audioData = await decodeAudioFile(testWav, "debug-core.wav", { jobId: "debug-core" });
  const segmentedData = segmentAudioTemporal(audioData, { jobId: "debug-core", fileName: "debug-core.wav" });
  
  console.log("✅ Decodificação e segmentação OK!");
  console.log(`📊 FFT frames: ${segmentedData.framesFFT.count}`);
  console.log(`📊 Primeiro frame FFT length: ${segmentedData.framesFFT.left[0].length}`);
  console.log(`📊 Primeiro frame FFT tem dados: ${!segmentedData.framesFFT.left[0].every(x => x === 0)}`);

  // TESTAR CORE METRICS DIRETAMENTE
  console.log("\n🔧 TESTANDO CORE METRICS...");
  
  try {
    const coreMetrics = await calculateCoreMetrics(segmentedData, {
      fileName: "debug-core.wav",
      jobId: "debug-core"
    });
    
    console.log("🎉 CORE METRICS FUNCIONOU!");
    console.log(`📊 LUFS: ${coreMetrics.lufs}`);
    console.log(`📊 True Peak: ${coreMetrics.truePeak}`);
    console.log(`📊 Spectral Balance: ${coreMetrics.spectralBalance ? 'SIM' : 'NÃO'}`);
    
  } catch (coreError) {
    console.error("💀 ERRO NO CORE METRICS:", coreError.message);
    console.error("📜 Stack:", coreError.stack);
    
    // Tentar descobrir qual parte está falhando
    console.log("\n🔍 DEBUGANDO ENTRADA DO CORE METRICS:");
    console.log(`   segmentedData existe: ${!!segmentedData}`);
    console.log(`   framesFFT existe: ${!!segmentedData.framesFFT}`);
    console.log(`   framesFFT.left existe: ${!!segmentedData.framesFFT.left}`);
    console.log(`   framesFFT.left length: ${segmentedData.framesFFT.left?.length}`);
    console.log(`   originalChannels existe: ${!!segmentedData.originalChannels}`);
    console.log(`   timestamps existe: ${!!segmentedData.timestamps}`);
    
    if (segmentedData.framesFFT.left?.length > 0) {
      const frame = segmentedData.framesFFT.left[0];
      console.log(`   Primeiro frame type: ${frame.constructor.name}`);
      console.log(`   Primeiro frame length: ${frame.length}`);
      console.log(`   Primeiro frame é array: ${Array.isArray(frame)}`);
      console.log(`   Primeiro frame primeiro valor: ${frame[0]}`);
    }
  }

} catch (error) {
  console.error("💀 ERRO GERAL:", error.message);
  console.error("📜 Stack:", error.stack);
}