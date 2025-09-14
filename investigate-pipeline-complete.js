// INVESTIGAÇÃO COMPLETA - AUDIT PIPELINE RAILWAY
// Descobrir exatamente onde está falhando a análise real

import "dotenv/config";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simular exatamente o ambiente do Railway
async function investigateFullPipeline() {
  console.log("🔍 INVESTIGAÇÃO COMPLETA - PIPELINE RAILWAY");
  console.log("=".repeat(60));

  // 1. Verificar se consegue carregar o pipeline
  console.log("\n1️⃣ TESTE: CARREGAMENTO DO PIPELINE");
  let processAudioComplete = null;

  try {
    const imported = await import("./work/api/audio/pipeline-complete.js");
    processAudioComplete = imported.processAudioComplete;
    console.log("✅ Pipeline completo carregado com sucesso!");
    console.log("📋 Função pipeline:", typeof processAudioComplete);
  } catch (err) {
    console.error("❌ CRÍTICO: Falha ao carregar pipeline:", err.message);
    console.error("📜 Stack:", err.stack);
    return;
  }

  // 2. Conectar ao banco como no Railway
  console.log("\n2️⃣ TESTE: CONEXÃO COM BANCO");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao Postgres");
  } catch (err) {
    console.error("❌ Erro ao conectar ao banco:", err);
    return;
  }

  // 3. Configurar S3/Backblaze como no Railway
  console.log("\n3️⃣ TESTE: CONFIGURAÇÃO S3/BACKBLAZE");
  console.log("   B2_KEY_ID:", process.env.B2_KEY_ID ? "✅ Configurado" : "❌ Ausente");
  console.log("   B2_APP_KEY:", process.env.B2_APP_KEY ? "✅ Configurado" : "❌ Ausente");
  console.log("   B2_BUCKET_NAME:", process.env.B2_BUCKET_NAME || "❌ Ausente");
  console.log("   B2_ENDPOINT:", process.env.B2_ENDPOINT || "❌ Ausente");

  const s3 = new AWS.S3({
    endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
    region: "us-east-005",
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
    signatureVersion: "v4",
  });

  // 4. Pegar um job real que foi processado em fallback
  console.log("\n4️⃣ TESTE: BUSCAR JOB REAL COM FALLBACK");
  const jobQuery = await client.query(`
    SELECT id, file_key, status, result 
    FROM jobs 
    WHERE status = 'done' 
    AND result::text LIKE '%fallback_metadata%'
    ORDER BY updated_at DESC 
    LIMIT 1
  `);

  if (jobQuery.rows.length === 0) {
    console.error("❌ Nenhum job com fallback encontrado");
    await client.end();
    return;
  }

  const job = jobQuery.rows[0];
  console.log(`📊 Job encontrado: ${job.id.substring(0,8)} - ${job.file_key}`);

  // 5. Tentar baixar o arquivo exatamente como o Railway faz
  console.log("\n5️⃣ TESTE: DOWNLOAD DO ARQUIVO");
  let localFilePath = null;

  try {
    console.log(`🔍 Baixando: ${job.file_key}`);
    const s3Params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: job.file_key,
    };

    const data = await s3.getObject(s3Params).promise();
    console.log(`✅ Arquivo baixado: ${data.Body.length} bytes`);

    // Salvar localmente para teste
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    localFilePath = path.join(tempDir, `test_${Date.now()}_${path.basename(job.file_key)}`);
    await fs.promises.writeFile(localFilePath, data.Body);
    console.log(`💾 Arquivo salvo em: ${localFilePath}`);

  } catch (err) {
    console.error("❌ Erro ao baixar arquivo:", err.message);
    await client.end();
    return;
  }

  // 6. TESTE CRÍTICO: Executar o pipeline exatamente como o Railway
  console.log("\n6️⃣ TESTE CRÍTICO: EXECUÇÃO DO PIPELINE");
  console.log("🚀 Executando processAudioComplete...");

  try {
    const fileBuffer = await fs.promises.readFile(localFilePath);
    const filename = path.basename(localFilePath);
    
    console.log(`📊 Buffer: ${fileBuffer.length} bytes`);
    console.log(`📂 Filename: ${filename}`);

    const startTime = Date.now();
    
    // EXECUTAR EXATAMENTE COMO NO RAILWAY
    const result = await processAudioComplete(fileBuffer, filename, {
      jobId: job.id,
      reference: null
    });

    const executionTime = Date.now() - startTime;
    console.log(`⏱️ Pipeline executado em: ${executionTime}ms`);

    // 7. ANALISAR RESULTADO
    console.log("\n7️⃣ ANÁLISE DO RESULTADO:");
    console.log("📋 Tipo do resultado:", typeof result);
    console.log("📋 Keys:", Object.keys(result));
    
    if (result.mode) {
      console.log(`📋 Mode: ${result.mode}`);
    }
    
    if (result.status) {
      console.log(`📋 Status: ${result.status}`);
    }

    if (result.error) {
      console.log(`❌ Erro no pipeline: ${JSON.stringify(result.error, null, 2)}`);
    }

    if (result.warnings) {
      console.log(`⚠️ Warnings: ${JSON.stringify(result.warnings, null, 2)}`);
    }

    if (result.technicalData) {
      console.log(`📊 Technical Data keys: ${Object.keys(result.technicalData)}`);
      
      // Verificar se tem métricas reais
      if (result.technicalData.lufsIntegrated) {
        console.log(`🎵 LUFS Integrated: ${result.technicalData.lufsIntegrated}`);
      }
      if (result.technicalData.truePeakDbtp) {
        console.log(`🎵 True Peak: ${result.technicalData.truePeakDbtp}`);
      }
    }

    // 8. DETERMINAR SE É REAL OU FALLBACK
    console.log("\n8️⃣ DIAGNÓSTICO FINAL:");
    const isRealAnalysis = (
      result.mode !== 'fallback_metadata' &&
      result.scoringMethod !== 'error_fallback' &&
      !result.usedFallback &&
      result.technicalData &&
      result.technicalData.lufsIntegrated !== undefined &&
      result.technicalData.truePeakDbtp !== undefined
    );

    if (isRealAnalysis) {
      console.log("🎉 SUCESSO: ANÁLISE REAL FUNCIONANDO!");
      console.log("🎯 O pipeline está processando corretamente");
    } else {
      console.log("❌ PROBLEMA: CAINDO EM FALLBACK");
      console.log("🔍 Razões possíveis:");
      
      if (result.mode === 'fallback_metadata') {
        console.log("   - Pipeline retornou mode='fallback_metadata'");
      }
      if (result.scoringMethod === 'error_fallback') {
        console.log("   - Scoring method indica erro");
      }
      if (result.usedFallback) {
        console.log("   - Flag usedFallback=true");
      }
      if (!result.technicalData || !result.technicalData.lufsIntegrated) {
        console.log("   - Métricas técnicas ausentes ou incompletas");
      }
    }

  } catch (pipelineError) {
    console.error("❌ ERRO CRÍTICO NO PIPELINE:");
    console.error("📜 Message:", pipelineError.message);
    console.error("📜 Stack:", pipelineError.stack);

    if (pipelineError.stage) {
      console.error("📍 Stage:", pipelineError.stage);
    }
    if (pipelineError.code) {
      console.error("📍 Code:", pipelineError.code);
    }
  }

  // 9. Cleanup
  console.log("\n9️⃣ CLEANUP");
  try {
    if (localFilePath && fs.existsSync(localFilePath)) {
      await fs.promises.unlink(localFilePath);
      console.log("🗑️ Arquivo temporário removido");
    }
  } catch (err) {
    console.warn("⚠️ Erro ao remover arquivo temporário:", err.message);
  }

  await client.end();
  console.log("📝 Investigação concluída");
}

// Executar investigação
investigateFullPipeline()
  .then(() => {
    console.log("\n🏁 INVESTIGAÇÃO FINALIZADA");
    process.exit(0);
  })
  .catch(error => {
    console.error("\n💥 FALHA NA INVESTIGAÇÃO:", error);
    process.exit(1);
  });