/**
 * ============================================================================
 * JOB STORE - PERSISTÊNCIA DE ESTADO (REDIS)
 * ============================================================================
 * 
 * Fonte de verdade para status de jobs, independente do BullMQ.
 * Jobs expiram apenas após 7 dias.
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * ============================================================================
 */

const redis = require('../queue/redis-connection.cjs');

const JOB_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

/**
 * Cria novo registro de job
 */
async function createJob(jobId, data) {
  const jobKey = `job:automaster:${jobId}`;
  
  const jobData = {
    job_id: jobId,
    user_id: data.userId || null,
    status: 'queued',
    input_key: data.inputKey,
    output_key: null,
    mode: data.mode,
    original_filename: data.original_filename || null,
    attempt: 1,
    max_attempts: data.maxAttempts || 3,
    created_at: Date.now(),
    started_at: null,
    finished_at: null,
    processing_ms: null,
    error_code: null,
    error_message: null,
    progress: 0
  };

  await redis.hset(jobKey, jobData);
  await redis.expire(jobKey, JOB_TTL_SECONDS);
  
  return jobData;
}

/**
 * Atualiza status do job
 */
async function updateJobStatus(jobId, status, metadata = {}) {
  const jobKey = `job:automaster:${jobId}`;
  
  const updates = {
    status,
    ...metadata
  };

  if (status === 'processing' && !metadata.started_at) {
    updates.started_at = Date.now();
  }

  if (['completed', 'failed'].includes(status) && !metadata.finished_at) {
    updates.finished_at = Date.now();
  }

  await redis.hset(jobKey, updates);
}

/**
 * Busca job
 */
async function getJob(jobId) {
  const jobKey = `job:automaster:${jobId}`;
  const data = await redis.hgetall(jobKey);
  
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  // Converter números
  return {
    ...data,
    attempt: parseInt(data.attempt, 10),
    max_attempts: parseInt(data.max_attempts, 10),
    created_at: data.created_at ? parseInt(data.created_at, 10) : null,
    started_at: data.started_at ? parseInt(data.started_at, 10) : null,
    finished_at: data.finished_at ? parseInt(data.finished_at, 10) : null,
    processing_ms: data.processing_ms ? parseInt(data.processing_ms, 10) : null,
    progress: parseInt(data.progress || 0, 10)
  };
}

/**
 * Marca job como failed
 */
async function setJobError(jobId, errorCode, errorMessage, attempt) {
  const jobKey = `job:automaster:${jobId}`;
  
  await redis.hset(jobKey, {
    status: 'failed',
    error_code: errorCode,
    error_message: errorMessage.substring(0, 500), // Limitar tamanho
    attempt: attempt || 1,
    finished_at: Date.now()
  });
}

/**
 * Incrementa tentativa
 */
async function incrementAttempt(jobId) {
  const jobKey = `job:automaster:${jobId}`;
  const newAttempt = await redis.hincrby(jobKey, 'attempt', 1);
  return newAttempt;
}

/**
 * Atualiza progresso
 */
async function updateProgress(jobId, progress) {
  const jobKey = `job:automaster:${jobId}`;
  await redis.hset(jobKey, { progress: Math.min(100, Math.max(0, progress)) });
}

module.exports = {
  createJob,
  updateJobStatus,
  getJob,
  setJobError,
  incrementAttempt,
  updateProgress
};
