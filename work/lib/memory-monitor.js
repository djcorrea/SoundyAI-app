/**
 * Memory Monitor — SoundyAI
 *
 * Utilitário leve para rastrear uso de memória por etapa do pipeline.
 * Não altera comportamento do produto. Só loga.
 *
 * Uso:
 *   import { logMemoryDelta, clearMemoryDelta } from '../../lib/memory-monitor.js';
 *   logMemoryDelta('pipeline', 'after-decode', jobId);
 *   clearMemoryDelta(jobId); // chamar ao final do job
 *
 * Filtrar nos logs:
 *   grep '\[MEM\]' railway.log | jq .
 */

// Snapshots anteriores por jobId para calcular delta
const _snapshots = new Map();

/**
 * Retorna snapshot atual de memória em MB
 */
function memorySnapshot() {
  const m = process.memoryUsage();
  return {
    rss:          Math.round(m.rss          / 1024 / 1024),
    heapUsed:     Math.round(m.heapUsed     / 1024 / 1024),
    heapTotal:    Math.round(m.heapTotal    / 1024 / 1024),
    external:     Math.round(m.external     / 1024 / 1024),
    arrayBuffers: Math.round(m.arrayBuffers / 1024 / 1024),
  };
}

/**
 * Loga memória atual e delta vs snapshot anterior para o mesmo jobId.
 *
 * @param {string} module  - ex: 'pipeline', 'worker'
 * @param {string} point   - ex: 'after-decode', 'end-success'
 * @param {string} jobId   - ID do job (para calcular deltas)
 */
export function logMemoryDelta(module, point, jobId) {
  try {
    const now = memorySnapshot();
    const key = String(jobId || 'unknown');
    const prev = _snapshots.get(key);

    const delta = prev
      ? {
          rss:          now.rss          - prev.rss,
          heapUsed:     now.heapUsed     - prev.heapUsed,
          external:     now.external     - prev.external,
          arrayBuffers: now.arrayBuffers - prev.arrayBuffers,
        }
      : null;

    _snapshots.set(key, now);

    const entry = {
      tag: '[MEM]',
      ts: new Date().toISOString(),
      module,
      point,
      jobId: key.substring(0, 8),
      rss_mb:          now.rss,
      heap_mb:         now.heapUsed,
      external_mb:     now.external,
      arrayBuffers_mb: now.arrayBuffers,
      delta_rss_mb:          delta?.rss          ?? null,
      delta_heap_mb:         delta?.heapUsed     ?? null,
      delta_external_mb:     delta?.external     ?? null,
      delta_arrayBuffers_mb: delta?.arrayBuffers ?? null,
    };

    console.log('[MEM]', JSON.stringify(entry));
  } catch (_) {
    // Nunca deixar o monitor quebrar o pipeline
  }
}

/**
 * Remove o snapshot armazenado para o jobId após o job terminar.
 * Evita acúmulo no Map em processos de longa duração.
 *
 * @param {string} jobId
 */
export function clearMemoryDelta(jobId) {
  try {
    _snapshots.delete(String(jobId || 'unknown'));
  } catch (_) {}
}
