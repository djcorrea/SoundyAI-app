/**
 * 🔊 LUFS Worker - Análise LUFS ITU-R BS.1770-4 em Thread Paralela
 * 
 * Executa:
 * - LUFS Integrated, Short-Term, Momentary
 * - LRA (Loudness Range)
 * - K-weighting filters
 * - Gating (absolute + relative)
 * 
 * NENHUMA alteração de lógica - apenas movido para Worker Thread
 */

import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import { calculateLoudnessMetrics } from '../../lib/audio/features/loudness.js';
import { assertFinite } from '../../lib/audio/error-handling.js';

async function calculateLUFSMetrics() {
  const startWorker = performance.now();
  console.time('⚡ [Worker LUFS] Total');
  
  try {
    const { leftChannel, rightChannel, sampleRate, jobId } = workerData;
    
    if (!leftChannel || !rightChannel) {
      throw new Error('LUFS Worker: canais de áudio inválidos');
    }
    
    if (leftChannel.length !== rightChannel.length) {
      throw new Error('LUFS Worker: canais com tamanhos diferentes');
    }

    console.log(`[Worker LUFS] Iniciando análise ITU-R BS.1770-4 (${leftChannel.length} samples)`);
    
    // Calcular LUFS (MESMA LÓGICA do core-metrics.js)
    const lufsMetrics = await calculateLoudnessMetrics(
      leftChannel,
      rightChannel,
      sampleRate,
      {
        jobId,
        blockDurationMs: 400,
        shortTermDurationMs: 3000,
        absoluteThreshold: -70.0,
        relativeThreshold: -10.0
      }
    );
    
    // Validar resultado
    assertFinite(lufsMetrics, 'lufs_worker');
    
    if (lufsMetrics.integrated === null || lufsMetrics.integrated === undefined) {
      throw new Error('LUFS Worker: integrated LUFS é null');
    }
    
    const endWorker = performance.now();
    const timeMs = (endWorker - startWorker).toFixed(2);
    console.timeEnd('⚡ [Worker LUFS] Total');
    console.log(`⏱️ [Worker LUFS] levou ${timeMs} ms (${(timeMs / 1000).toFixed(2)} s)`);
    console.log(`[Worker LUFS] ✅ LUFS Integrated: ${lufsMetrics.integrated.toFixed(2)} dB`);
    
    parentPort.postMessage({ success: true, data: lufsMetrics });
    
  } catch (error) {
    const endWorker = performance.now();
    const timeMs = (endWorker - startWorker).toFixed(2);
    console.error('[Worker LUFS] ❌ Erro:', error.message);
    console.timeEnd('⚡ [Worker LUFS] Total');
    console.log(`⏱️ [Worker LUFS] falhou após ${timeMs} ms (${(timeMs / 1000).toFixed(2)} s)`);
    parentPort.postMessage({ success: false, error: error.message });
  }
}

calculateLUFSMetrics();
