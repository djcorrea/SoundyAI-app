/**
 * Memory Monitor — Instrumentação de uso de RAM por etapa do pipeline.
 *
 * @module work/lib/memory-monitor
 *
 * Como usar:
 *   import { logMemory, logMemoryDelta } from '../lib/memory-monitor.js';
 *   logMemory('pipeline', 'after-decode', jobId);
 *
 * A saída é um JSON estruturado (uma linha) fácil de filtrar:
 *   grep '\[MEM\]' logs/worker.log | jq .
 */

/**
 * Converter bytes em MB (2 casas decimais)
 */
function mb(bytes) {
  return +(bytes / 1024 / 1024).toFixed(2);
}

/**
 * Snapshot do uso de memória atual do processo.
 * @returns {{ rss: number, heapTotal: number, heapUsed: number, external: number, arrayBuffers: number }} — valores em MB
 */
export function memorySnapshot() {
  const m = process.memoryUsage();
  return {
    rss: mb(m.rss),
    heapTotal: mb(m.heapTotal),
    heapUsed: mb(m.heapUsed),
    external: mb(m.external),
    arrayBuffers: mb(m.arrayBuffers),
  };
}

/**
 * Log estruturado de memória.
 *
 * @param {string} stage  — ex: 'decode', 'segmentation', 'core_metrics', 'pipeline'
 * @param {string} point  — ex: 'start', 'after-fft', 'end'
 * @param {string} [jobId] — identificador do job (primeiros 8 chars)
 */
export function logMemory(stage, point, jobId) {
  const snap = memorySnapshot();
  const line = {
    tag: '[MEM]',
    ts: new Date().toISOString(),
    stage,
    point,
    job: jobId ? jobId.substring(0, 8) : '-',
    ...snap,
  };
  console.log(JSON.stringify(line));
}

// Guardamos a última snapshot para calcular delta
const _prev = new Map();

/**
 * Log + delta em relação à última chamada para o mesmo jobId.
 *
 * @param {string} stage
 * @param {string} point
 * @param {string} [jobId]
 */
export function logMemoryDelta(stage, point, jobId) {
  const snap = memorySnapshot();
  const key = jobId || '__global__';
  const prev = _prev.get(key);

  const delta = prev
    ? {
        dRss: +(snap.rss - prev.rss).toFixed(2),
        dHeapUsed: +(snap.heapUsed - prev.heapUsed).toFixed(2),
        dExternal: +(snap.external - prev.external).toFixed(2),
        dArrayBuffers: +(snap.arrayBuffers - prev.arrayBuffers).toFixed(2),
      }
    : null;

  _prev.set(key, snap);

  const line = {
    tag: '[MEM]',
    ts: new Date().toISOString(),
    stage,
    point,
    job: jobId ? jobId.substring(0, 8) : '-',
    ...snap,
    ...(delta || {}),
  };
  console.log(JSON.stringify(line));
}

/**
 * Limpar delta guardado para um job (chamar no cleanup).
 */
export function clearMemoryDelta(jobId) {
  _prev.delete(jobId || '__global__');
}
