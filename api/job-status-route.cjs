/**
 * ============================================================================
 * JOB STATUS & DOWNLOAD ROUTES
 * ============================================================================
 * 
 * GET /automaster/:jobId - Status do job
 * GET /automaster/:jobId/download - Download seguro via signed URL
 * 
 * Features:
 * - Rate limiting (100 status checks/hora)
 * - Download protegido com signed URL temporária
 * - Logs estruturados
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 2.0.0 (Production-Ready)
 * 
 * ============================================================================
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const automasterQueue = require('../queue/automaster-queue.cjs');
const storageService = require('../services/storage-service.cjs');
const { createServiceLogger } = require('../services/logger.cjs');

const router = express.Router();
const logger = createServiceLogger('api-status');

// ============================================================================
// RATE LIMITING
// ============================================================================

// Status check rate limit: 100 checks/hora
const statusLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100,
  message: {
    success: false,
    error: 'Rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// ROUTE GET /automaster/:jobId
// ============================================================================

router.get('/automaster/:jobId', statusLimiter, async (req, res) => {
  const { jobId } = req.params;
  const requestLogger = logger.child({ jobId, ip: req.ip });

  try {
    // Buscar job no BullMQ
    const job = await automasterQueue.getJob(jobId);

    if (!job) {
      requestLogger.warn('Job não encontrado');
      return res.status(404).json({
        success: false,
        error: 'Job não encontrado',
        jobId
      });
    }

    // Obter estado do job
    const state = await job.getState();
    const progress = job.progress || 0;

    // Resposta base
    const response = {
      success: true,
      jobId,
      status: state,
      progress
    };

    // Se concluído, incluir resultado
    if (state === 'completed') {
      response.result = job.returnvalue;
      response.finished_at = job.finishedOn;
      requestLogger.info({ state, progress }, 'Status retornado');
    }

    // Se falhou, incluir erro
    if (state === 'failed') {
      response.error = job.failedReason;
      response.failed_at = job.finishedOn;
      response.attempts = job.attemptsMade;
      requestLogger.warn({ state, error: job.failedReason }, 'Job falhou');
    }

    // Se ativo, incluir timestamp de início
    if (state === 'active') {
      response.started_at = job.processedOn;
    }

    res.json(response);

  } catch (error) {
    requestLogger.error({ error: error.message }, 'Erro ao buscar status');

    res.status(500).json({
      success: false,
      error: 'Erro ao buscar status do job',
      details: error.message
    });
  }
});

// ============================================================================
// ROUTE GET /automaster/:jobId/download
// ============================================================================

router.get('/automaster/:jobId/download', statusLimiter, async (req, res) => {
  const { jobId } = req.params;
  const requestLogger = logger.child({ jobId, ip: req.ip });

  try {
    // Buscar job no BullMQ
    const job = await automasterQueue.getJob(jobId);

    if (!job) {
      requestLogger.warn('Job não encontrado');
      return res.status(404).json({
        success: false,
        error: 'Job não encontrado',
        jobId
      });
    }

    // Verificar se job está concluído
    const state = await job.getState();
    if (state !== 'completed') {
      requestLogger.warn({ state }, 'Job não concluído');
      return res.status(400).json({
        success: false,
        error: 'Job não está concluído',
        status: state
      });
    }

    // Gerar signed URL temporária (5 minutos)
    requestLogger.info('Gerando signed URL');
    const downloadUrl = await storageService.getSignedDownloadUrl(jobId, 300);

    requestLogger.info('Download URL gerada');

    res.json({
      success: true,
      jobId,
      download_url: downloadUrl,
      expires_in: 300 // segundos
    });

  } catch (error) {
    requestLogger.error({ error: error.message }, 'Erro ao gerar download URL');

    res.status(500).json({
      success: false,
      error: 'Erro ao gerar URL de download',
      details: error.message
    });
  }
});

module.exports = router;
