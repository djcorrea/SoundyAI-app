// test-pipeline-completo-REAL.js - TESTAR SE A MERDA FUNCIONA
import "dotenv/config";

console.log("🔥 TESTANDO PIPELINE COMPLETO PARA ACABAR COM O FALLBACK!");

try {
  // Importar pipeline completo
  const { processAudioComplete } = await import("./work/api/audio/pipeline-complete.js");
  console.log("✅ Pipeline importado com sucesso!");

  // Gerar um WAV de teste pequeno
  const fs = await import("fs");
  
  // Criar um WAV básico de 1 segundo
  function createTestWav() {
    const sampleRate = 48000;
    const duration = 1; // 1 segundo
    const samples = sampleRate * duration;
    
    // Header WAV
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + samples * 4, 4); // fileSize
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // subchunk1Size
    header.writeUInt16LE(1, 20); // audioFormat (PCM)
    header.writeUInt16LE(2, 22); // numChannels (stereo)
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 4, 28); // byteRate
    header.writeUInt16LE(4, 32); // blockAlign
    header.writeUInt16LE(16, 34); // bitsPerSample
    header.write('data', 36);
    header.writeUInt32LE(samples * 4, 40); // subchunk2Size
    
    // Data (sine wave 440Hz)
    const data = Buffer.alloc(samples * 4);
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
      const sample16 = Math.round(sample * 32767);
      
      // Left channel
      data.writeInt16LE(sample16, i * 4);
      // Right channel  
      data.writeInt16LE(sample16, i * 4 + 2);
    }
    
    return Buffer.concat([header, data]);
  }

  const testWav = createTestWav();
  console.log(`🎵 WAV de teste criado: ${testWav.length} bytes`);

  // TESTAR PIPELINE COMPLETO
  console.log("🚀 INICIANDO TESTE DO PIPELINE...");
  const startTime = Date.now();
  
  const result = await processAudioComplete(testWav, "test-pipeline.wav", {
    jobId: "test-123",
    reference: null
  });
  
  const totalTime = Date.now() - startTime;
  console.log(`⏱️ Pipeline executado em ${totalTime}ms`);

  // VERIFICAR RESULTADO
  console.log("\n📊 RESULTADO DO PIPELINE:");
  console.log(`✅ Status: ${result.status || 'N/A'}`);
  console.log(`✅ Score: ${result.score || 'N/A'}`);
  console.log(`✅ Scoring Method: ${result.scoringMethod || 'N/A'}`);
  console.log(`✅ Engine: ${result.metadata?.engineVersion || 'N/A'}`);
  console.log(`✅ Pipeline Phase: ${result.metadata?.pipelinePhase || 'N/A'}`);

  // VERIFICAR DADOS TÉCNICOS
  if (result.technicalData) {
    console.log("\n📈 DADOS TÉCNICOS:");
    console.log(`🎚️ LUFS: ${result.technicalData.lufs || 'N/A'}`);
    console.log(`📊 True Peak: ${result.technicalData.truePeak || 'N/A'}`);
    console.log(`🌈 Spectral Balance: ${result.technicalData.spectralBalance ? 'SIM' : 'NÃO'}`);
    
    if (result.technicalData.lufs !== undefined) {
      console.log("🎉 ANÁLISE REAL FUNCIONANDO! LUFS CALCULADO!");
    } else {
      console.log("❌ AINDA EM FALLBACK - LUFS NÃO CALCULADO");
    }
  }

  // VERIFICAR WARNINGS/ERRORS
  if (result.warnings && result.warnings.length > 0) {
    console.log("\n⚠️ WARNINGS:");
    result.warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (result.error) {
    console.log("\n❌ ERROR:");
    console.log(`   ${result.error.message || result.error}`);
  }

  if (result._worker) {
    console.log("\n🤖 WORKER INFO:");
    console.log(`   Source: ${result._worker.source}`);
    console.log(`   Error: ${result._worker.error || 'N/A'}`);
  }

  console.log("\n🎯 TESTE COMPLETO!");

} catch (error) {
  console.error("💀 ERRO NO TESTE:", error.message);
  console.error("📜 Stack:", error.stack);
}