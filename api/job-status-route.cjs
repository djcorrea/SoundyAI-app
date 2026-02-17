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
const storageService = require('../services/storage-service.cjs');
const { createServiceLogger } = require('../services/logger.cjs');
const jobStore = require('../services/job-store.cjs');

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
    // Buscar job no jobStore (fonte de verdade)
    const jobData = await jobStore.getJob(jobId);

    if (!jobData) {
      requestLogger.warn('Job não encontrado');
      return res.status(404).json({
        success: false,
        error: 'Job não encontrado',
        jobId
      });
    }

    // Resposta base do jobStore
    const response = {
      success: true,
      jobId: jobData.job_id,
      status: jobData.status,
      progress: jobData.progress,
      mode: jobData.mode,
      created_at: jobData.created_at,
      started_at: jobData.started_at,
      finished_at: jobData.finished_at,
      processing_ms: jobData.processing_ms
    };

    // Se concluído, incluir output_key
    if (jobData.status === 'completed' && jobData.output_key) {
      response.output_key = jobData.output_key;
    }

    // Se falhou, incluir erro
    if (jobData.status === 'failed') {
      response.error_code = jobData.error_code;
      response.error_message = jobData.error_message;
      response.attempt = jobData.attempt;
    }

    // Se processing, incluir attempt atual
    if (jobData.status === 'processing') {
      response.attempt = jobData.attempt;
    }

    requestLogger.info({ status: jobData.status }, 'Status retornado');

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
    // Buscar job no jobStore (fonte de verdade)
    const jobData = await jobStore.getJob(jobId);

    if (!jobData) {
      requestLogger.warn('Job não encontrado');
      return res.status(404).json({
        success: false,
        error: 'Job não encontrado',
        jobId
      });
    }

    // Verificar se job está concluído
    if (jobData.status !== 'completed') {
      requestLogger.warn({ status: jobData.status }, 'Job não concluído');
      return res.status(400).json({
        success: false,
        error: 'Job não está concluído',
        status: jobData.status
      });
    }

    // Verificar se output_key está presente
    if (!jobData.output_key) {
      requestLogger.error('Job completed mas output_key ausente');
      return res.status(500).json({
        success: false,
        error: 'Output não disponível'
      });
    }

    // Gerar signed URL temporária usando output_key (5 minutos)
    requestLogger.info({ output_key: jobData.output_key }, 'Gerando signed URL');
    const downloadUrl = await storageService.getSignedDownloadUrl(jobData.output_key, 300);

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
