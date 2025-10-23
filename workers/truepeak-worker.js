/**
 * 🎚️ True Peak Worker - Análise True Peak via FFmpeg em Thread Paralela
 * 
 * Executa:
 * - True Peak 4x Oversampling via FFmpeg ebur128
 * - Detecção de picos L/R independentes
 * - Fallback para loop JavaScript se necessário
 * 
 * NENHUMA alteração de lógica - apenas movido para Worker Thread
 */

import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import { analyzeTruePeaksFFmpeg } from '../lib/audio/features/truepeak-ffmpeg.js';
import { assertFinite } from '../lib/audio/error-handling.js';

async function calculateTruePeakMetrics() {
  const startWorker = performance.now();
  console.time('⚡ [Worker TruePeak] Total');
  
  try {
    const { leftChannel, rightChannel, sampleRate, tempFilePath, jobId } = workerData;
    
    if (!leftChannel || !rightChannel) {
      throw new Error('TruePeak Worker: canais de áudio inválidos');
    }
    
    if (leftChannel.length !== rightChannel.length) {
      throw new Error('TruePeak Worker: canais com tamanhos diferentes');
    }

    console.log(`[Worker TruePeak] Iniciando análise 4x oversampling (${leftChannel.length} samples)`);
    
    // Calcular True Peak (MESMA LÓGICA do core-metrics.js)
    const truePeakMetrics = await analyzeTruePeaksFFmpeg(
      leftChannel,
      rightChannel,
      sampleRate,
      tempFilePath
    );
    
    // Validar resultado
    if (truePeakMetrics.true_peak_dbtp !== null) {
      assertFinite({ maxDbtp: truePeakMetrics.true_peak_dbtp }, 'truepeak_worker');
      
      // Validações de range (MESMA LÓGICA do core-metrics.js)
      if (!isFinite(truePeakMetrics.true_peak_dbtp)) {
        throw new Error(`TruePeak Worker: valor inválido (${truePeakMetrics.true_peak_dbtp} dBTP)`);
      }
      
      if (truePeakMetrics.true_peak_dbtp > 50 || truePeakMetrics.true_peak_dbtp < -200) {
        throw new Error(`TruePeak Worker: fora do range realista (${truePeakMetrics.true_peak_dbtp} dBTP)`);
      }
      
      if (truePeakMetrics.true_peak_dbtp > -1.0) {
        console.warn(`[Worker TruePeak] ⚠️ Possível clipping: ${truePeakMetrics.true_peak_dbtp.toFixed(2)} dBTP`);
      }
    }
    
    // Formatar resultado (MESMO FORMATO do core-metrics.js)
    const result = {
      maxDbtp: truePeakMetrics.true_peak_dbtp,
      maxLinear: truePeakMetrics.true_peak_linear,
      leftPeakDbtp: truePeakMetrics.left_peak_dbtp,
      rightPeakDbtp: truePeakMetrics.right_peak_dbtp,
      leftPeakLinear: truePeakMetrics.left_peak_linear,
      rightPeakLinear: truePeakMetrics.right_peak_linear,
      error: truePeakMetrics.error
    };
    
    const endWorker = performance.now();
    const timeMs = (endWorker - startWorker).toFixed(2);
    console.timeEnd('⚡ [Worker TruePeak] Total');
    console.log(`⏱️ [Worker TruePeak] levou ${timeMs} ms (${(timeMs / 1000).toFixed(2)} s)`);
    console.log(`[Worker TruePeak] ✅ True Peak: ${result.maxDbtp?.toFixed(2) || 'null'} dBTP`);
    
    parentPort.postMessage({ success: true, data: result });
    
  } catch (error) {
    const endWorker = performance.now();
    const timeMs = (endWorker - startWorker).toFixed(2);
    console.error('[Worker TruePeak] ❌ Erro:', error.message);
    console.timeEnd('⚡ [Worker TruePeak] Total');
    console.log(`⏱️ [Worker TruePeak] falhou após ${timeMs} ms (${(timeMs / 1000).toFixed(2)} s)`);
    parentPort.postMessage({ success: false, error: error.message });
  }
}

calculateTruePeakMetrics();
