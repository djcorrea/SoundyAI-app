// WAV validation uses ffprobe instead of MIME to support PCM 24-bit and DAW exports safely.

/**
 * ============================================================================
 * UPLOAD ROUTE - ENDPOINT DE MASTERIZAÇÃO
 * ============================================================================
 * 
 * POST /automaster
 * - Recebe arquivo WAV via multipart/form-data
 * - Valida via ffprobe (suporta PCM 16/24/32-bit)
 * - Enfileira job no BullMQ
 * - Retorna jobId para polling
 * 
 * Features:
 * - Rate limiting (10 uploads/hora por IP)
 * - Limite de 3 jobs simultâneos por userId
 * - Storage persistente (R2/S3)
 * - Validação determinística via ffprobe
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 3.0.0 (FFProbe Validation)
 * 
 * ============================================================================
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const automasterQueue = require('../queue/automaster-queue.cjs');
const jobStore = require('../services/job-store.cjs');
const storageService = require('../services/storage-service.cjs');
const audioValidator = require('../services/audio-validator.cjs');
const { createServiceLogger } = require('../services/logger.cjs');

const router = express.Router();
const logger = createServiceLogger('api-upload');

// ============================================================================
// CONSTANTES
// ============================================================================

const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || '120', 10);
const MAX_CONCURRENT_JOBS_PER_USER = 3;
const TMP_UPLOAD_DIR = path.resolve(__dirname, '../tmp/uploads');

// Garantir diretório temporário
(async () => {
  try {
    await fs.mkdir(TMP_UPLOAD_DIR, { recursive: true });
  } catch (error) {
    logger.error({ error: error.message }, 'Falha ao criar diretório tmp/uploads');
  }
})();

// ============================================================================
// RATE LIMITING
// ============================================================================

// Upload rate limit: 10 uploads/hora
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  message: {
    success: false,
    error: 'Rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// MULTER CONFIG (DISK STORAGE TEMPORÁRIO)
// ============================================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const tmpFilename = `${uuidv4()}-${Date.now()}.wav`;
    cb(null, tmpFilename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_MB * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    // Validação básica de extensão
    if (!file.originalname.toLowerCase().endsWith('.wav')) {
      return cb(new Error('Apenas arquivos WAV são permitidos'), false);
    }
    cb(null, true);
  }
});

// ============================================================================
// HELPER: CONTAR JOBS ATIVOS POR USUÁRIO
// ============================================================================

async function countActiveJobsByUser(userId) {
  if (!userId) return 0;

  try {
    const waiting = await automasterQueue.getWaiting();
    const active = await automasterQueue.getActive();
    
    const allJobs = [...waiting, ...active];
    const userJobs = allJobs.filter(job => job.data.userId === userId);
    
    return userJobs.length;
  } catch (error) {
    logger.error({ error: error.message }, 'Falha ao contar jobs ativos');
    return 0;
  }
}

// ============================================================================
// ROUTE POST /automaster
// ============================================================================

router.post('/automaster', uploadLimiter, upload.single('audio'), async (req, res) => {
  const startTime = Date.now();
  const jobId = uuidv4();
  const requestLogger = logger.child({ jobId, ip: req.ip });
  let tmpFilePath = null;

  try {
    // 1. Validar arquivo recebido
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    tmpFilePath = req.file.path;

    requestLogger.info({ 
      originalName: req.file.originalname,
      size: req.file.size,
      tmpPath: tmpFilePath
    }, 'Upload recebido');

    // 2. Validar mode
    const mode = (req.body.mode || 'BALANCED').toUpperCase();
    if (!['STREAMING', 'BALANCED', 'IMPACT'].includes(mode)) {
      throw new Error(`Mode inválido: ${mode}`);
    }

    // 3. Extrair userId (opcional - pode vir de autenticação futura)
    const userId = req.body.userId || req.headers['x-user-id'] || null;

    // 4. Verificar limite de jobs por usuário
    if (userId) {
      const activeJobs = await countActiveJobsByUser(userId);
      if (activeJobs >= MAX_CONCURRENT_JOBS_PER_USER) {
        requestLogger.warn({ userId, activeJobs }, 'Limite de jobs excedido');
        
        // Cleanup arquivo temporário
        await fs.unlink(tmpFilePath).catch(() => {});
        
        return res.status(429).json({
          success: false,
          error: 'Too many concurrent jobs'
        });
      }
    }

    // 5. Validar arquivo de áudio via ffprobe
    requestLogger.info('Validando arquivo com ffprobe');
    const validation = await audioValidator.validateAudioFile(
      tmpFilePath,
      req.file.originalname,
      req.file.size
    );
    
    if (!validation.valid) {
      requestLogger.warn({ 
        errors: validation.errors,
        metadata: validation.metadata 
      }, 'Validação falhou');
      
      // Cleanup arquivo temporário
      await fs.unlink(tmpFilePath).catch(() => {});
      
      return res.status(400).json({
        success: false,
        error: 'Invalid audio file',
        details: validation.errors
      });
    }

    requestLogger.info({ metadata: validation.metadata }, 'Arquivo validado com sucesso');

    // 6. Ler arquivo para buffer e fazer upload para storage persistente (R2/S3)
    requestLogger.info('Enviando para storage');
    const fileBuffer = await fs.readFile(tmpFilePath);
    const inputKey = await storageService.uploadInput(fileBuffer, jobId);

    // 7. Cleanup arquivo temporário
    await fs.unlink(tmpFilePath).catch((error) => {
      requestLogger.warn({ error: error.message }, 'Falha ao deletar arquivo temporário');
    });
    tmpFilePath = null;

    // 8. Criar job no jobStore (persistência independente do BullMQ)
    await jobStore.createJob(jobId, {
      userId,
      inputKey,
      mode,
      maxAttempts: 3
    });

    // 9. Enfileirar job
    requestLogger.info({ mode, inputKey }, 'Enfileirando job');
    await automasterQueue.add('process', {
      jobId,
      inputKey,
      mode,
      userId
    });

    const durationMs = Date.now() - startTime;

    requestLogger.info({ duration_ms: durationMs }, 'Job enfileirado');

    res.status(202).json({
      success: true,
      jobId,
      status: 'queued',
      message: 'Job enfileirado com sucesso'
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    requestLogger.error({ 
      error: error.message,
      duration_ms: durationMs 
    }, 'Erro no upload');

    // Cleanup arquivo temporário em caso de erro
    if (tmpFilePath) {
      await fs.unlink(tmpFilePath).catch(() => {});
    }

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
