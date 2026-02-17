/**
 * ============================================================================
 * JOB LOCK - LOCK DISTRIBUÍDO (REDIS)
 * ============================================================================
 * 
 * Previne execução duplicada de jobs.
 * TTL: 600s (10min - com heartbeat a cada 15s)
 * Ownership: apenas o worker que adquiriu pode renovar/liberar
 * 
 * Autor: SoundyAI Engineering
 * Data: 2026-02-11
 * Versão: 2.0.0 (Ownership + Heartbeat)
 * ============================================================================
 */

const redis = require('../queue/redis-connection.cjs');

const LOCK_TTL_SECONDS = 600; // 10 minutos (com heartbeat)

/**
 * Tenta adquirir lock para um job
 * @returns {Object|null} {workerId} se adquiriu, null se já está locked
 */
async function acquireLock(jobId, workerId = process.pid.toString()) {
  const lockKey = `lock:automaster:${jobId}`;
  
  // SET NX EX (atomic)
  const result = await redis.set(lockKey, workerId, 'NX', 'EX', LOCK_TTL_SECONDS);
  
  if (result === 'OK') {
    return { workerId };
  }
  
  return null;
}

/**
 * Libera lock apenas se o workerId é o dono (atomic via Lua)
 */
async function releaseLock(jobId, workerId) {
  const lockKey = `lock:automaster:${jobId}`;
  
  // Script Lua para delete condicional (atomic)
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  
  const result = await redis.eval(luaScript, 1, lockKey, workerId);
  return result === 1;
}

/**
 * Verifica se job está locked
 */
async function isLocked(jobId) {
  const lockKey = `lock:automaster:${jobId}`;
  const exists = await redis.exists(lockKey);
  return exists === 1;
}

/**
 * Renova TTL do lock apenas se o workerId é o dono (heartbeat)
 */
async function renewLock(jobId, workerId) {
  const lockKey = `lock:automaster:${jobId}`;
  
  // Script Lua para EXPIRE condicional (atomic)
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;
  
  const result = await redis.eval(luaScript, 1, lockKey, workerId, LOCK_TTL_SECONDS);
  return result === 1;
}

module.exports = {
  acquireLock,
  releaseLock,
  isLocked,
  renewLock,
  LOCK_TTL_SECONDS
};
