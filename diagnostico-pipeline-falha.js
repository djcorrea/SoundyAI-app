/**
 * 🔧 DIAGNÓSTICO ESPECÍFICO: Por que o pipeline completo falha?
 * 
 * Baseado na análise dos jobs reais, o worker está sempre caindo no fallback.
 * Vou simular exatamente o que acontece no Railway.
 */

import "dotenv/config";
import AWS from "aws-sdk";
import * as mm from "music-metadata";

console.log("🔧 [DIAGNÓSTICO] Testando por que pipeline completo falha...");

// ========== REPRODUZIR EXATAMENTE O CÓDIGO DO index.js ==========

// 1. Verificar se processAudioComplete está definido
let processAudioComplete = null;

async function simulateCompleteAnalysis(audioBuffer, filename, genre) {
  console.log("🎯 [PIPELINE] Executando pipeline COMPLETO...");
  
  // Simular análise (versão simplificada)
  const durationMs = audioBuffer.length / (44100 * 2 * 2) * 1000;
  await new Promise(resolve => setTimeout(resolve, 100)); // Simular processamento
  
  return {
    status: "success",
    mode: "pipeline_complete_mathematical",
    overallScore: 7.8,
    qualityOverall: 7.8,
    classification: "Profissional",
    technicalData: {
      lufs_integrated: -12.5,
      true_peak: -1.8,
      dynamic_range: 8.2,
      rms_level: -18.3,
      peak_db: -11.2,
      spectral_balance: {
        sub: 0.12,
        bass: 0.28,
        mids: 0.35,
        treble: 0.25
      },
      durationSec: Math.round(durationMs / 1000 * 100) / 100,
      sampleRate: 44100,
      channels: 2
    },
    problems: [],
    suggestions: ["Pipeline completo executado com sucesso"]
  };
}

// 2. Atribuir função (como no index.js)
processAudioComplete = simulateCompleteAnalysis;
console.log("✅ processAudioComplete definido:", !!processAudioComplete);

// 3. Configurar S3 (como no index.js)
const s3 = new AWS.S3({
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  endpoint: process.env.B2_ENDPOINT,
  s3ForcePathStyle: true,
});

console.log("✅ S3 configurado");

// 4. Simular processamento de job (exatamente como index.js)
async function simulateJobProcessing() {
  console.log("\n🎵 [SIMULATE] Processando job simulado...");
  
  const job = {
    id: "test-job-123",
    file_key: "uploads/test.wav",
    filename: "test.wav",
    genre: "electronic"
  };
  
  let result;
  
  try {
    if (processAudioComplete) {
      console.log("🎯 Usando pipeline completo");
      
      // Simular download do arquivo
      console.log("📥 Baixando arquivo do B2...");
      
      // TESTE REAL: tentar baixar um arquivo que sabemos que existe
      const params = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: "uploads/1757641137308.wav", // Arquivo real do job interceptado
      };
      
      console.log("📡 Tentando baixar:", params);
      
      const data = await s3.getObject(params).promise();
      const audioBuffer = data.Body;
      
      console.log("✅ Arquivo baixado. Tamanho:", audioBuffer.length, "bytes");
      
      // Processar com pipeline completo
      result = await processAudioComplete(audioBuffer, job.filename, job.genre || 'electronic');
      
      console.log("✅ Pipeline completo processou com sucesso:", result);
      
    } else {
      console.log("⚠️ processAudioComplete não definido - usando fallback");
      throw new Error("processAudioComplete não existe");
    }
    
  } catch (error) {
    console.error("❌ ERRO no pipeline completo:", error.message);
    console.error("Stack:", error.stack);
    
    console.log("⚠️ Caindo para fallback metadata...");
    
    // Fallback exatamente como no index.js
    try {
      const params = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: "uploads/1757641137308.wav",
      };
      
      const data = await s3.getObject(params).promise();
      const metadata = await mm.parseBuffer(data.Body);
      
      result = {
        ok: true,
        file: job.file_key,
        mode: "fallback_metadata",
        score: 50,
        status: "success",
        metadata: {
          processedAt: new Date().toISOString()
        },
        warnings: ["Pipeline completo indisponível. Resultado mínimo via metadata."],
        analyzedAt: new Date().toISOString(),
        usedFallback: true,
        scoringMethod: "error_fallback",
        technicalData: {
          bitrate: metadata.format?.bitrate || 1411200,
          channels: metadata.format?.numberOfChannels || 2,
          sampleRate: metadata.format?.sampleRate || 44100,
          durationSec: metadata.format?.duration || 180
        },
        classification: "Básico",
        frontendCompatible: true
      };
      
      console.log("✅ Fallback executado:", result);
      
    } catch (fallbackError) {
      console.error("❌ ERRO até no fallback:", fallbackError);
      throw fallbackError;
    }
  }
  
  return result;
}

// Executar simulação
simulateJobProcessing()
  .then(result => {
    console.log("\n🎯 RESULTADO FINAL:");
    console.log(JSON.stringify(result, null, 2));
    
    console.log("\n📊 ANÁLISE:");
    if (result.mode === "fallback_metadata") {
      console.log("❌ CONFIRMADO: Pipeline completo falhou, usou fallback");
      console.log("🔍 Isso explica por que as métricas não aparecem no frontend");
    } else {
      console.log("✅ Pipeline completo funcionou");
    }
  })
  .catch(error => {
    console.error("❌ ERRO GERAL:", error);
  });
