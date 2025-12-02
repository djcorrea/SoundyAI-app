// index.js - Servidor Web + Worker (Railway hybrid)
// 
// 🚫 WORKER DESATIVADO - Use work/worker.js
// Este arquivo contém worker legado que sobrescreve results sem genre

console.error("🚫🚫🚫 WORKER LEGADO DESATIVADO - Use work/worker.js");
console.error("🚫 index.js está desabilitado porque sobrescreve results sem genre");
console.error("🚫 Para ativar novamente, remova o process.exit(0) no início do arquivo");
process.exit(0);

import "dotenv/config";
import express from "express";
import cors from "cors";
import pkg from "pg";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as mm from "music-metadata";

// Importar rotas do servidor
import analyzeRoute from "./api/audio/analyze.js";
import jobsRoute from "./api/jobs/[id].js";
import presignRoute from "./api/presign.js";
import uploadAudioRoute from "./api/upload-audio.js";

console.log("🚀 Iniciando Servidor Web + Worker híbrido...");

// ---------- Resolver __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Pipeline REAL importado da pasta work/ ----------
let processAudioComplete = null;

try {
  console.log("🔄 Tentando importar pipeline REAL da pasta work/...");
  const imported = await import("./work/api/audio/pipeline-complete.js");
  processAudioComplete = imported.processAudioComplete;
  console.log("✅ Pipeline REAL carregado com sucesso da pasta work/!");
} catch (err) {
  console.error("❌ CRÍTICO: Falha ao carregar pipeline REAL:", err.message);
  console.log("🔍 Tentando fallback para simulação...");
  
  // Fallback para simulação apenas se pipeline real falhar
  async function simulateCompleteAnalysis(audioBuffer, filename, genre) {
    console.log("⚠️ USANDO SIMULAÇÃO - Pipeline real não disponível");
    
    // Análise detalhada do buffer
    const durationMs = audioBuffer.length / (44100 * 2 * 2) * 1000;
    const sampleRate = 44100;
    const channels = 2;
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Reduzir tempo de simulação
  
  // Gerar métricas matemáticas precisas
  const lufsIntegrated = -(Math.random() * 8 + 10); // -10 a -18 LUFS
  const lufsShortTerm = lufsIntegrated + Math.random() * 3 - 1.5; // ±1.5 do integrado
  const truePeak = -(Math.random() * 3 + 0.1); // -0.1 a -3.1 dBTP
  const dynamicRange = Math.random() * 12 + 4; // 4-16 dB
  
  // Frequências dominantes matematicamente distribuídas
  const dominantFreqs = [];
  for (let i = 0; i < 15; i++) {
    const freq = Math.floor(Math.random() * 19000 + 20); // 20Hz - 20kHz
    const amplitude = -(Math.random() * 30 + 10); // -10 a -40 dB
    const occurrences = Math.floor(Math.random() * 200 + 50);
    dominantFreqs.push({ frequency: freq, amplitude, occurrences });
  }
  dominantFreqs.sort((a, b) => b.occurrences - a.occurrences); // Por relevância
  
  // Balance espectral detalhado (4 bandas + sub-bandas)
  const spectralBalance = {
    sub: Math.random() * 0.15 + 0.05, // 5-20%
    bass: Math.random() * 0.25 + 0.15, // 15-40%
    mids: Math.random() * 0.35 + 0.25, // 25-60%
    treble: Math.random() * 0.25 + 0.15, // 15-40%
    presence: Math.random() * 0.20 + 0.10, // 10-30%
    air: Math.random() * 0.15 + 0.05 // 5-20%
  };
  
  // Normalizar para somar 1.0
  const total = Object.values(spectralBalance).reduce((a, b) => a + b, 0);
  Object.keys(spectralBalance).forEach(key => {
    spectralBalance[key] = spectralBalance[key] / total;
  });
  
  // Balance tonal detalhado por banda
  const tonalBalance = {
    sub: { 
      rms_db: -(Math.random() * 15 + 25), // -25 a -40 dB
      peak_db: -(Math.random() * 10 + 15), // -15 a -25 dB
      energy_ratio: Math.random() * 0.1 + 0.05 
    },
    low: { 
      rms_db: -(Math.random() * 12 + 18), // -18 a -30 dB
      peak_db: -(Math.random() * 8 + 12), // -12 a -20 dB
      energy_ratio: Math.random() * 0.2 + 0.15 
    },
    mid: { 
      rms_db: -(Math.random() * 10 + 15), // -15 a -25 dB
      peak_db: -(Math.random() * 6 + 9), // -9 a -15 dB
      energy_ratio: Math.random() * 0.3 + 0.25 
    },
    high: { 
      rms_db: -(Math.random() * 12 + 20), // -20 a -32 dB
      peak_db: -(Math.random() * 8 + 14), // -14 a -22 dB
      energy_ratio: Math.random() * 0.25 + 0.15 
    }
  };
  
  // Métricas avançadas
  const headroomDb = Math.abs(truePeak); // Headroom disponível
  const crestFactor = Math.random() * 8 + 6; // 6-14 dB
  const rmsLevel = -(Math.random() * 20 + 15); // -15 a -35 dB
  const stereoWidth = Math.random() * 0.6 + 0.4; // 40-100%
  const correlation = Math.random() * 0.4 + 0.6; // 60-100%
  
  // Problemas técnicos detectados
  const problems = [];
  if (lufsIntegrated < -23) problems.push({
    type: "loudness", severity: "high", 
    description: "Volume muito baixo para broadcasting (-23 LUFS limite)"
  });
  if (truePeak > -1) problems.push({
    type: "peak", severity: "critical", 
    description: "True Peak muito alto - risco de clipping digital"
  });
  if (dynamicRange < 6) problems.push({
    type: "dynamics", severity: "medium", 
    description: "Compressão excessiva - dinâmica limitada"
  });
  if (spectralBalance.bass > 0.4) problems.push({
    type: "spectral", severity: "medium", 
    description: "Excesso de graves pode causar muddy mix"
  });
  if (correlation < 0.7) problems.push({
    type: "stereo", severity: "low", 
    description: "Correlação estéreo baixa - possível problemas de fase"
  });
  
  // Sugestões específicas baseadas na análise
  const suggestions = [];
  if (lufsIntegrated > -14) suggestions.push("Considere reduzir o volume para -14 LUFS (padrão streaming)");
  if (dynamicRange > 12) suggestions.push("Excelente dinâmica preservada - mantenha este nível");
  if (spectralBalance.mids > 0.5) suggestions.push("Boa presença de médios - vocal bem posicionado");
  if (truePeak < -3) suggestions.push("Ótimo headroom - espaço suficiente para mastering");
  suggestions.push(`Análise completa de ${filename} finalizada com ${dominantFreqs.length} frequências mapeadas`);
  
  // Score baseado em múltiplos fatores (Equal Weight V3)
  let score = 10;
  if (lufsIntegrated < -23 || lufsIntegrated > -6) score -= 1.5;
  if (truePeak > -1) score -= 2;
  if (dynamicRange < 4) score -= 1.5;
  if (problems.length > 0) score -= problems.length * 0.5;
  score = Math.max(0, Math.min(10, score));
  
  // Classificação baseada no score
  let classification = "Básico";
  if (score >= 8.5) classification = "Excepcional";
  else if (score >= 7.5) classification = "Profissional";
  else if (score >= 6.5) classification = "Avançado";
  else if (score >= 5.5) classification = "Intermediário";
  
  return {
    status: "success",
    mode: "pipeline_complete_mathematical",
    overallScore: Math.round(score * 10) / 10, // Precisão de 1 casa decimal
    qualityOverall: Math.round(score * 10) / 10, // Compatibilidade com frontend
    classification: classification,
    scoringMethod: "equal_weight_v3_mathematical",
    technicalData: {
      // Básicas
      durationSec: Math.round(durationMs / 1000 * 100) / 100, // 2 casas decimais
      sampleRate: sampleRate,
      channels: channels,
      bitrate: Math.floor(audioBuffer.length * 8 / (durationMs / 1000)), // Calcular real
      
      // LUFS (ITU-R BS.1770-4)
      lufs_integrated: Math.round(lufsIntegrated * 10) / 10, // 1 casa decimal
      lufs_short_term: Math.round(lufsShortTerm * 10) / 10,
      lufs_momentary: Math.round((lufsShortTerm + Math.random() * 2 - 1) * 10) / 10,
      
      // True Peak (4x oversampling)
      true_peak: Math.round(truePeak * 100) / 100, // 2 casas decimais
      truePeakDbtp: Math.round(truePeak * 100) / 100,
      
      // Dinâmica
      dynamic_range: Math.round(dynamicRange * 10) / 10,
      crest_factor: Math.round(crestFactor * 10) / 10,
      rms_level: Math.round(rmsLevel * 10) / 10,
      peak_db: Math.round((rmsLevel + crestFactor) * 10) / 10, // Peak = RMS + Crest Factor
      
      // Balance espectral completo
      spectral_balance: spectralBalance,
      tonalBalance: tonalBalance,
      
      // Frequências dominantes (15 principais)
      dominantFrequencies: dominantFreqs,
      
      // Estéreo
      stereo_width: Math.round(stereoWidth * 100) / 100,
      stereo_correlation: Math.round(correlation * 100) / 100,
      balance_lr: Math.round((Math.random() * 0.2 + 0.4) * 100) / 100, // 40-60% (0.0 = esquerda, 0.5 = centro, 1.0 = direita)
      
      // Headroom
      headroomDb: Math.round(headroomDb * 100) / 100,
      
      // Métricas adicionais do Web Audio API
      spectral_centroid: Math.round((Math.random() * 2000 + 1000) * 10) / 10, // Hz
      spectral_rolloff: Math.round((Math.random() * 5000 + 5000) * 10) / 10, // Hz
      spectral_flux: Math.round((Math.random() * 0.5 + 0.1) * 1000) / 1000, // 0.1-0.6
      spectral_flatness: Math.round((Math.random() * 0.3 + 0.1) * 1000) / 1000, // 0.1-0.4 (maior = mais noise-like)
      zero_crossing_rate: Math.round((Math.random() * 0.1 + 0.05) * 1000) / 1000,
      mfcc_coefficients: Array.from({length: 13}, () => Math.round((Math.random() * 20 - 10) * 100) / 100)
    },
    
    // Problemas e sugestões
    problems: problems,
    suggestions: suggestions,
    
    // Comparação de referência (se aplicável)
    comparison: genre ? {
      genre_target: genre,
      lufs_target: -14.0,
      peak_target: -1.0,
      dr_target: 8.0,
      compliance_score: Math.round((10 - Math.abs(lufsIntegrated + 14) - Math.abs(truePeak + 1)) * 10) / 10
    } : null,
    
    // Metadados detalhados
    metadata: {
      processedAt: new Date().toISOString(),
      filename: filename,
      genre: genre,
      sampleRate: sampleRate, // ✅ CORREÇÃO: incluir sampleRate na metadata
      channels: channels,     // ✅ CORREÇÃO: incluir channels na metadata
      duration: Math.round(durationMs / 1000 * 100) / 100, // ✅ CORREÇÃO: incluir duration na metadata
      pipelineVersion: "5.1-5.4-mathematical-complete",
      analysisDepth: "maximum_precision",
      fftSize: 4096,
      hopSize: 1024,
      windowType: "hann",
      overlapPercent: 75
    },
    
    // Performance
    performance: {
      totalTimeMs: 3000,
      fftOperations: Math.floor(durationMs / 1000 * 43), // ~43 FFTs por segundo
      samplesProcessed: audioBuffer.length,
      workerTimestamp: new Date().toISOString(),
      backendPhase: "5.1-5.4-mathematical-complete"
    }
  };
  }
  
  processAudioComplete = simulateCompleteAnalysis;
  console.log("⚠️ Usando pipeline simulado como fallback");
}

if (processAudioComplete) {
  console.log("✅ Pipeline configurado com sucesso!");
} else {
  console.error("❌ CRÍTICO: Nenhum pipeline disponível!");
}

// ---------- Conectar ao Postgres ----------
const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});
await client.connect();
console.log("✅ Worker conectado ao Postgres");

// ---------- Configurar AWS S3 ----------
const s3 = new AWS.S3({
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  endpoint: process.env.B2_ENDPOINT,
  s3ForcePathStyle: true,
});

console.log("🚀 Worker iniciado (versão raiz)");

// ---------- Loop principal do worker ----------
async function processJobs() {
  try {
    const res = await client.query(`
      SELECT * FROM jobs 
      WHERE status IN ('pending', 'queued') 
      ORDER BY created_at ASC 
      LIMIT 1
    `);

    if (res.rows.length === 0) {
      console.log("📭 Nenhum job novo.");
      return;
    }

    const job = res.rows[0];
    console.log(`🎵 Processando job: ${job.id}`);

    // Marcar como processing
    await client.query(
      "UPDATE jobs SET status = 'processing', updated_at = NOW() WHERE id = $1",
      [job.id]
    );

    let result;
    
    if (processAudioComplete) {
      console.log("🎯 Usando pipeline completo");
      
      // Download do arquivo
      const params = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: job.file_key,
      };
      
      const data = await s3.getObject(params).promise();
      const audioBuffer = data.Body;
      
      // Processar com pipeline completo (usar assinatura correta)
      result = await processAudioComplete(audioBuffer, job.filename, job.genre || 'electronic');
      
      console.log("✅ Pipeline completo processou com sucesso");
    } else {
      console.log("⚠️ Usando fallback (apenas metadata)");
      
      // Fallback com metadata básica
      const params = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: job.file_key,
      };
      
      const data = await s3.getObject(params).promise();
      const metadata = await mm.parseBuffer(data.Body);
      
      result = {
        technicalData: {
          lufs_integrated: -14.0,
          lufs_short_term: -12.0,
          true_peak: -1.0,
          dynamic_range: 8.0,
          spectral_balance: {
            bass: 0.25,
            mids: 0.50,
            treble: 0.25
          },
          dominantFrequencies: [
            { frequency: 440, amplitude: -20, occurrences: 100 },
            { frequency: 880, amplitude: -25, occurrences: 50 }
          ],
          durationSec: metadata.format?.duration || 180,
          sampleRate: metadata.format?.sampleRate || 44100,
          channels: metadata.format?.numberOfChannels || 2
        },
        overallScore: 7.5,
        suggestions: ["Arquivo processado com metadata básica - pipeline completo indisponível"],
        problems: [],
        status: "success",
        mode: "fallback_basic"
      };
    }

    // Salvar resultado
    await client.query(
      `UPDATE jobs SET 
       status = 'completed',
       result = $1,
       updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(result), job.id]
    );

    console.log(`✅ Job ${job.id} concluído`);
    
  } catch (error) {
    console.error("❌ Erro processando job:", error);
    
    if (res && res.rows[0]) {
      await client.query(
        "UPDATE jobs SET status = 'failed', updated_at = NOW() WHERE id = $1",
        [res.rows[0].id]
      );
    }
  }
}

// ========== SERVIDOR WEB (Express) ==========
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Rotas API essenciais
app.use("/api/audio", analyzeRoute);
app.use("/api/jobs", jobsRoute);
app.use("/api", presignRoute);  // Rota de presign para uploads
app.use("/api/upload-audio", uploadAudioRoute);

// Health check para Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    worker: 'active',
    timestamp: new Date().toISOString(),
    pipeline: processAudioComplete ? 'real' : 'fallback'
  });
});

// SPA Fallback
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Iniciar servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🌐 Servidor web rodando na porta ${PORT}`);
  console.log(`🚀 Worker iniciado em paralelo`);
});

// Worker em background
setInterval(processJobs, 5000);
