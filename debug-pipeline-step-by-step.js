// Debug pipeline - identificar onde está travando
import "dotenv/config";
import fs from "fs";
import AWS from "aws-sdk";

// Setup básico S3
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  signatureVersion: "v4",
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

// Importar pipeline step by step
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

async function downloadFile(fileKey) {
  console.log(`📥 Baixando arquivo: ${fileKey}`);
  
  const localPath = `/tmp/${Date.now()}_${Math.random().toString(36).substring(2)}.wav`;
  
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(localPath);
    const readStream = s3.getObject({ Bucket: BUCKET_NAME, Key: fileKey }).createReadStream();

    readStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", () => {
      console.log(`✅ Arquivo baixado: ${localPath}`);
      resolve(localPath);
    });

    readStream.pipe(writeStream);
  });
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
  console.log("🕵️ DEBUG PIPELINE - Identificar onde trava");
  console.log("==========================================\n");

  // 1. Carregar módulos
  const modulesLoaded = await loadModules();
  if (!modulesLoaded) {
    console.log("❌ Falha ao carregar módulos - encerrando");
    return;
  }

  // 2. Usar um dos arquivos problemáticos identificados
  const fileKey = "uploads/1757557620994.wav"; // Arquivo que sabemos que trava
  
  let localPath = null;
  let fileBuffer = null;
  
  try {
    // 3. Download
    localPath = await testPipelineStep("Download do arquivo", async () => {
      return await downloadFile(fileKey);
    }, 10000);

    // 4. Ler buffer
    fileBuffer = await testPipelineStep("Leitura do buffer", async () => {
      return fs.readFileSync(localPath);
    }, 5000);

    console.log(`📊 Buffer carregado: ${fileBuffer.length} bytes`);

    // 5. Fase 5.1 - Decodificação
    let audioData = null;
    audioData = await testPipelineStep("Fase 5.1 - Decodificação", async () => {
      return modules.decoder.decodeAudioFile(fileBuffer, "test.wav");
    }, 60000); // 1 minuto timeout

    console.log(`📊 Audio decodificado: ${audioData.sampleRate}Hz, ${audioData.duration}s`);

    // 6. Fase 5.2 - Segmentação
    let segmentedData = null;
    segmentedData = await testPipelineStep("Fase 5.2 - Segmentação", async () => {
      return modules.segmentation.segmentAudioTemporal(audioData);
    }, 30000);

    console.log(`📊 Segmentação: ${segmentedData.framesFFT.count} frames FFT, ${segmentedData.framesRMS.count} frames RMS`);

    // 7. Fase 5.3 - Core Metrics (provável culpado)
    let coreMetrics = null;
    segmentedData.originalLeft = audioData.leftChannel;
    segmentedData.originalRight = audioData.rightChannel;
    
    coreMetrics = await testPipelineStep("Fase 5.3 - Core Metrics", async () => {
      return modules.metrics.calculateCoreMetrics(segmentedData);
    }, 120000); // 2 minutos timeout

    console.log(`📊 Core Metrics: LUFS ${coreMetrics.lufs.integrated}, True Peak ${coreMetrics.truePeak.maxDbtp}`);

    // 8. Fase 5.4 - JSON Output
    let finalJSON = null;
    finalJSON = await testPipelineStep("Fase 5.4 - JSON Output", async () => {
      const metadata = {
        fileName: "test.wav",
        fileSize: fileBuffer.length,
        processingTime: 0
      };
      return modules.output.generateJSONOutput(coreMetrics, null, metadata);
    }, 10000);

    console.log(`📊 JSON Final: Score ${finalJSON.score}%`);

    console.log("\n🎉 PIPELINE COMPLETO - SEM TRAVAMENTO!");
    console.log("=====================================");
    console.log("O problema pode estar na concorrência ou recursos do Railway");

  } catch (error) {
    console.log(`\n❌ PIPELINE TRAVOU: ${error.message}`);
    console.log("=====================================");
    console.log("🔍 Análise:");
    
    if (error.message.includes("TIMEOUT")) {
      console.log("- Travamento confirmado na fase:", error.message.split(":")[1]);
      console.log("- Recomendação: Otimizar ou quebrar esta fase em etapas menores");
    } else {
      console.log("- Erro de execução:", error.message);
      console.log("- Stack:", error.stack);
    }
  } finally {
    // Cleanup
    if (localPath) {
      try {
        fs.unlinkSync(localPath);
        console.log("🧹 Arquivo temporário removido");
      } catch (e) {
        console.log("⚠️ Não foi possível remover arquivo temporário");
      }
    }
  }
}

debugPipeline();
