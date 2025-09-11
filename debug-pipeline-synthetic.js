// Debug pipeline com arquivo sintético
import fs from "fs";

// Importar módulos
let modules = {};

async function loadModules() {
  console.log("📦 Carregando módulos do pipeline...");
  
  try {
    console.log("   ⏳ 1. Audio Decoder...");
    const decoder = await import('./api/audio/audio-decoder.js');
    modules.decoder = decoder;
    console.log("   ✅ 1. Audio Decoder carregado");
  } catch (err) {
    console.log("   ❌ 1. Audio Decoder FALHOU:", err.message);
    return false;
  }

  try {
    console.log("   ⏳ 2. Temporal Segmentation...");
    const segmentation = await import('./api/audio/temporal-segmentation.js');
    modules.segmentation = segmentation;
    console.log("   ✅ 2. Temporal Segmentation carregado");
  } catch (err) {
    console.log("   ❌ 2. Temporal Segmentation FALHOU:", err.message);
    return false;
  }

  try {
    console.log("   ⏳ 3. Core Metrics...");
    const metrics = await import('./api/audio/core-metrics.js');
    modules.metrics = metrics;
    console.log("   ✅ 3. Core Metrics carregado");
  } catch (err) {
    console.log("   ❌ 3. Core Metrics FALHOU:", err.message);
    return false;
  }

  try {
    console.log("   ⏳ 4. JSON Output...");
    const output = await import('./api/audio/json-output.js');
    modules.output = output;
    console.log("   ✅ 4. JSON Output carregado");
  } catch (err) {
    console.log("   ❌ 4. JSON Output FALHOU:", err.message);
    return false;
  }

  console.log("✅ Todos os módulos carregados com sucesso!");
  return true;
}

// Gerar WAV sintético de 3 segundos
function generateTestWav() {
  const sampleRate = 48000;
  const duration = 3; // 3 segundos
  const samples = sampleRate * duration;
  const channels = 2;
  
  // Header WAV
  const buffer = Buffer.alloc(44 + samples * channels * 4); // Float32 = 4 bytes
  
  // RIFF Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples * channels * 4, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM size
  buffer.writeUInt16LE(3, 20);  // Format = IEEE Float
  buffer.writeUInt16LE(channels, 22); // Channels
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(sampleRate * channels * 4, 28); // Byte rate
  buffer.writeUInt16LE(channels * 4, 32); // Block align
  buffer.writeUInt16LE(32, 34); // Bits per sample
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * channels * 4, 40);
  
  // Audio data - sine wave 440Hz + 880Hz (L/R)
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const left = 0.3 * Math.sin(2 * Math.PI * 440 * t);  // 440Hz
    const right = 0.3 * Math.sin(2 * Math.PI * 880 * t); // 880Hz
    
    buffer.writeFloatLE(left, offset);
    buffer.writeFloatLE(right, offset + 4);
    offset += 8;
  }
  
  return buffer;
}

async function testPipelineStep(stepName, stepFunction, timeout = 30000) {
  console.log(`\n🧪 Testando: ${stepName}`);
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${stepName} travou após ${timeout}ms`));
    }, timeout);

    stepFunction()
      .then(result => {
        clearTimeout(timer);
        console.log(`✅ ${stepName} concluído com sucesso`);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        console.log(`❌ ${stepName} falhou:`, error.message);
        reject(error);
      });
  });
}

async function debugPipeline() {
  console.log("🕵️ DEBUG PIPELINE - Teste com arquivo sintético");
  console.log("===============================================\n");

  // 1. Carregar módulos
  const modulesLoaded = await loadModules();
  if (!modulesLoaded) {
    console.log("❌ Falha ao carregar módulos - encerrando");
    return;
  }

  try {
    // 2. Gerar arquivo teste
    let fileBuffer = null;
    fileBuffer = await testPipelineStep("Geração do arquivo WAV sintético", async () => {
      return generateTestWav();
    }, 5000);

    console.log(`📊 Arquivo sintético gerado: ${fileBuffer.length} bytes`);

    // 3. Fase 5.1 - Decodificação
    let audioData = null;
    audioData = await testPipelineStep("Fase 5.1 - Decodificação", async () => {
      return modules.decoder.decodeAudioFile(fileBuffer, "test_synthetic.wav");
    }, 60000); // 1 minuto timeout

    console.log(`📊 Audio decodificado: ${audioData.sampleRate}Hz, ${audioData.duration}s, ${audioData.length} samples`);

    // 4. Fase 5.2 - Segmentação
    let segmentedData = null;
    segmentedData = await testPipelineStep("Fase 5.2 - Segmentação", async () => {
      return modules.segmentation.segmentAudioTemporal(audioData);
    }, 30000);

    console.log(`📊 Segmentação: ${segmentedData.framesFFT.count} frames FFT, ${segmentedData.framesRMS.count} frames RMS`);

    // 5. Fase 5.3 - Core Metrics (provável culpado)
    let coreMetrics = null;
    segmentedData.originalLeft = audioData.leftChannel;
    segmentedData.originalRight = audioData.rightChannel;
    
    console.log("⚠️ TESTE CRÍTICO: Iniciando Core Metrics...");
    coreMetrics = await testPipelineStep("Fase 5.3 - Core Metrics", async () => {
      return modules.metrics.calculateCoreMetrics(segmentedData);
    }, 180000); // 3 minutos timeout

    console.log(`📊 Core Metrics: LUFS ${coreMetrics.lufs.integrated}, True Peak ${coreMetrics.truePeak.maxDbtp}`);

    // 6. Fase 5.4 - JSON Output
    let finalJSON = null;
    finalJSON = await testPipelineStep("Fase 5.4 - JSON Output", async () => {
      const metadata = {
        fileName: "test_synthetic.wav",
        fileSize: fileBuffer.length,
        processingTime: 0
      };
      return modules.output.generateJSONOutput(coreMetrics, null, metadata);
    }, 10000);

    console.log(`📊 JSON Final: Score ${finalJSON.score}%`);

    console.log("\n🎉 PIPELINE COMPLETO - ARQUIVO SINTÉTICO FUNCIONOU!");
    console.log("==================================================");
    console.log("✅ Pipeline está funcionando corretamente");
    console.log("🔍 Problema pode estar em:");
    console.log("   - Arquivos específicos com encoding problemático");
    console.log("   - Recursos limitados no Railway (CPU/Memória)");
    console.log("   - Arquivos muito grandes ou corrompidos");

  } catch (error) {
    console.log(`\n❌ PIPELINE TRAVOU: ${error.message}`);
    console.log("=====================================");
    console.log("🔍 Análise:");
    
    if (error.message.includes("TIMEOUT")) {
      const phase = error.message.split(":")[1]?.trim();
      console.log(`- TRAVAMENTO CONFIRMADO na fase: ${phase}`);
      console.log("- Esta é a fase que está causando o problema!");
      
      if (phase && phase.includes("Core Metrics")) {
        console.log("- DIAGNÓSTICO: Core Metrics está travando");
        console.log("- CAUSA PROVÁVEL: FFT, LUFS ou True Peak calculation em loop infinito");
        console.log("- SOLUÇÃO: Simplificar ou otimizar os cálculos matemáticos");
      }
    } else {
      console.log("- Erro de execução:", error.message);
    }
  }
}

debugPipeline();
