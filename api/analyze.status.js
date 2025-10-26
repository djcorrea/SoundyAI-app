/**
 * 🎵 ANALYZE STATUS - BULLMQ JOB STATUS ENDPOINT
 * Consulta status de jobs na fila BullMQ
 */

import express from "express";
import { audioQueue } from "../infrastructure/queue/queue.js";

const router = express.Router();

/**
 * Mapear estados do BullMQ para API
 */
function mapJobState(bullState, job) {
  const stateMap = {
    'waiting': 'queued',
    'delayed': 'queued',
    'active': 'processing', 
    'completed': 'completed',
    'failed': 'failed',
    'paused': 'paused',
    'stuck': 'failed'
  };

  return stateMap[bullState] || 'unknown';
}

/**
 * GET /api/analyze/:jobId - Consultar status do job
 */
router.get("/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: "Job ID é obrigatório",
        code: "MISSING_JOB_ID"
      });
    }

    console.log(`[STATUS] Consultando job: ${jobId}`);

    // Buscar job na fila
    const job = await audioQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job não encontrado",
        message: "Job pode ter expirado ou não existe",
        code: "JOB_NOT_FOUND"
      });
    }

    // Obter estado e dados do job
    const jobState = await job.getState();
    const apiState = mapJobState(jobState, job);
    const progress = job.progress || 0;
    const position = await job.getPosition();

    // Construir resposta
    const response = {
      success: true,
      jobId: job.id,
      state: apiState,
      progress: progress,
      data: job.data,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    };

    // Adicionar posição na fila se ainda aguardando
    if (jobState === 'waiting' || jobState === 'delayed') {
      response.queuePosition = position;
    }

    // Adicionar resultado se completado
    if (jobState === 'completed' && job.returnvalue) {
      response.result = job.returnvalue;
    }

    // Adicionar erro se falhou
    if (jobState === 'failed' && job.failedReason) {
      response.reason = job.failedReason;
      response.attempts = {
        made: job.attemptsMade,
        remaining: job.opts.attempts - job.attemptsMade
      };
    }

    console.log(`[STATUS] Job ${jobId}: ${apiState}`);

    res.status(200).json(response);

  } catch (error) {
    console.error(`[STATUS] Erro ao consultar job:`, error);

    res.status(500).json({
      success: false,
      error: "Erro interno do servidor",
      message: error.message,
      code: "INTERNAL_ERROR"
    });
  }
});

export default router;