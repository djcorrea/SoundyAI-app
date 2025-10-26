/**
 * 🎵 ANALYZE CONTROLLER - BULLMQ INTEGRATION
 * Controlador de análise de áudio usando filas distribuídas
 * Mantém compatibilidade com API existente
 */

import express from "express";
import { audioQueue } from "../infrastructure/queue/queue.js";

const router = express.Router();

/**
 * Validação de entrada
 */
function validateAnalyzeRequest(body) {
  const { fileKey, mode = "genre", fileName } = body;

  if (!fileKey || typeof fileKey !== "string") {
    throw new Error("fileKey é obrigatório e deve ser uma string");
  }

  if (!["genre", "reference"].includes(mode)) {
    throw new Error('Modo deve ser "genre" ou "reference"');
  }

  return { fileKey, mode, fileName };
}

/**
 * Middleware de CORS
 */
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

/**
 * POST /api/analyze - Criar job de análise na fila
 */
router.post("/analyze", async (req, res) => {
  const startTime = Date.now();

  try {
    console.log(`[ANALYZE] Nova requisição de análise iniciada`);

    // Validar entrada
    const { fileKey, mode, fileName } = validateAnalyzeRequest(req.body);
    console.log(`[ANALYZE] Dados validados:`, { fileKey, mode, fileName });

    // Feature flag para migração gradual
    const useRedisQueue = process.env.USE_REDIS_QUEUE === 'true';
    
    if (!useRedisQueue) {
      console.log(`[ANALYZE] ⚠️ Redis Queue desabilitado via feature flag`);
      return res.status(503).json({
        success: false,
        error: "Sistema de fila temporariamente indisponível",
        message: "Use o sistema legado temporariamente",
        code: "QUEUE_DISABLED"
      });
    }

    // Adicionar job à fila
    const job = await audioQueue.add('analyze', {
      fileKey,
      mode,
      fileName,
      createdAt: Date.now(),
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, {
      priority: mode === 'reference' ? 1 : 5, // Prioridade alta para referência
      delay: 0
    });

    const processingTime = Date.now() - startTime;

    console.log(`[ANALYZE] Job criado na fila: ${job.id} em ${processingTime}ms`);

    // Resposta compatível com API existente
    res.status(200).json({
      success: true,
      jobId: job.id,
      fileKey,
      mode,
      fileName: fileName || null,
      status: 'queued',
      createdAt: new Date().toISOString(),
      queuePosition: await job.getPosition(),
      performance: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
        queueSystem: 'bullmq'
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error("[ANALYZE] Erro na criação do job:", error);

    const statusCode = error.message.includes("obrigatório") || 
                      error.message.includes("deve ser") ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message.includes("obrigatório") ? "Parâmetro obrigatório ausente" : "Erro interno",
      message: error.message,
      code: statusCode === 400 ? "VALIDATION_ERROR" : "QUEUE_ERROR",
      performance: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;