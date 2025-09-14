// test-fresh-instance.js - Teste com instância nova do CoreMetricsProcessor
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

async function testFreshInstance() {
  console.log("🧪 TESTE: Instância nova vs. instância global");
  
  try {
    // Preparar dados
    const testWav = createTestWav();
    const audioBuffer = await decodeAudioFile(testWav, "test.wav", { jobId: "test" });
    const segmentResult = await segmentAudioTemporal(audioBuffer, { fileName: "test.wav", jobId: "test" });
    
    console.log(`✅ Dados preparados: ${segmentResult.framesFFT.count} frames FFT`);
    
    // TESTE 1: Instância global (função calculateCoreMetrics)
    console.log("\n🔴 TESTE 1: Instância global (calculateCoreMetrics)");
    try {
      const { calculateCoreMetrics } = await import("./work/api/audio/core-metrics.js");
      const result1 = await calculateCoreMetrics(segmentResult, { jobId: "global-test" });
      console.log("✅ Instância global funcionou!");
      console.log(`  - LUFS: ${result1.lufs}`);
      console.log(`  - True Peak: ${result1.truePeak}`);
    } catch (error1) {
      console.log("❌ Instância global falhou:");
      console.log(`  - Erro: ${error1.message}`);
      console.log(`  - Code: ${error1.code}`);
    }
    
    // TESTE 2: Instância nova (criar CoreMetricsProcessor diretamente)
    console.log("\n🟢 TESTE 2: Instância nova (CoreMetricsProcessor direto)");
    try {
      // Importar a classe diretamente
      const coreMetricsModule = await import("./work/api/audio/core-metrics.js");
      const moduleSource = await import('fs').then(fs => fs.readFileSync('./work/api/audio/core-metrics.js', 'utf8'));
      
      // Como não posso importar a classe diretamente, vou criar uma nova instância via eval controlado
      // (isso é apenas para teste, não para produção)
      
      console.log("⚠️ Não é possível testar instância nova sem refatorar o código");
      console.log("  - A classe CoreMetricsProcessor não está exportada");
      console.log("  - Apenas a função calculateCoreMetrics está disponível");
      console.log("  - Esta função usa uma instância global singleton");
      
    } catch (error2) {
      console.log("❌ Instância nova falhou:");
      console.log(`  - Erro: ${error2.message}`);
    }
    
    // TESTE 3: Múltiplas chamadas seguidas para verificar cache corrompido
    console.log("\n🟡 TESTE 3: Múltiplas chamadas (verificar cache)");
    for (let i = 0; i < 3; i++) {
      try {
        const { calculateCoreMetrics } = await import("./work/api/audio/core-metrics.js");
        const result = await calculateCoreMetrics(segmentResult, { jobId: `multi-${i}` });
        console.log(`✅ Chamada ${i + 1}: LUFS=${result.lufs}`);
      } catch (error) {
        console.log(`❌ Chamada ${i + 1} falhou: ${error.message}`);
        break;
      }
    }
    
  } catch (error) {
    console.error("❌ Erro geral:", error.message);
  }
}

testFreshInstance();