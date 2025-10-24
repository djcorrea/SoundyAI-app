/**
 * 🥁 BPM Worker - Análise BPM (Beats Per Minute) em Thread Paralela
 * 
 * Executa:
 * - BPM detection via music-tempo
 * - Autocorrelação
 * - Onset detection
 * - Limitado a 30s (otimização #1)
 * 
 * NENHUMA alteração de lógica - apenas movido para Worker Thread
 */

import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import { calculateBpm } from '../api/audio/bpm-analyzer.js';

async function calculateBPMMetrics() {
  const startWorker = performance.now();
  console.time('⚡ [Worker BPM] Total');
  
  try {
    const { leftChannel, rightChannel, sampleRate, jobId } = workerData;
    
    if (!leftChannel || !rightChannel) {
      throw new Error('BPM Worker: canais de áudio inválidos');
    }

    console.log(`[Worker BPM] Iniciando análise (${leftChannel.length} samples, limitado a 30s)`);
    
    // Criar frames de áudio (mono mix para BPM)
    const monoSignal = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoSignal[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    
    // Calcular BPM (MESMA LÓGICA do core-metrics.js)
    const bpmResult = calculateBpm(monoSignal, sampleRate);
    
    // Validar resultado
    if (bpmResult.bpm === null || bpmResult.bpm === undefined) {
      console.warn('[Worker BPM] ⚠️ BPM não detectado, retornando null');
    }
    
    if (bpmResult.bpm !== null && (bpmResult.bpm < 30 || bpmResult.bpm > 300)) {
      console.warn(`[Worker BPM] ⚠️ BPM fora do range esperado: ${bpmResult.bpm}`);
    }
    
    const endWorker = performance.now();
    const timeMs = (endWorker - startWorker).toFixed(2);
    console.timeEnd('⚡ [Worker BPM] Total');
    console.log(`⏱️ [Worker BPM] levou ${timeMs} ms (${(timeMs / 1000).toFixed(2)} s)`);
    console.log(`[Worker BPM] ✅ BPM: ${bpmResult.bpm?.toFixed(1) || 'null'} (confiança: ${bpmResult.confidence?.toFixed(2) || 'N/A'})`);
    
    parentPort.postMessage({ success: true, data: bpmResult });
    
  } catch (error) {
    const endWorker = performance.now();
    const timeMs = (endWorker - startWorker).toFixed(2);
    console.error('[Worker BPM] ❌ Erro:', error.message);
    console.timeEnd('⚡ [Worker BPM] Total');
    console.log(`⏱️ [Worker BPM] falhou após ${timeMs} ms (${(timeMs / 1000).toFixed(2)} s)`);
    
    // BPM é não-crítico, retornar null ao invés de falhar
    parentPort.postMessage({ 
      success: true, 
      data: { bpm: null, confidence: null, error: error.message } 
    });
  }
}

calculateBPMMetrics();
