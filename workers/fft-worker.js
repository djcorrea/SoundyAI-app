/**
 * 🌊 FFT WORKER THREAD - PARALELIZAÇÃO DE TRANSFORMADA RÁPIDA
 * Worker Thread dedicado para processamento FFT sem bloquear main thread
 * Mantém compatibilidade com pipeline existente em work/
 */

import { parentPort, workerData } from 'worker_threads';
import { FastFFT } from '../work/lib/audio/fft.js';

// Log função do worker
function logWorker(stage, data = {}) {
  console.log(`[FFT-WORKER ${process.pid}] ${stage}:`, data);
}

// Verificar se está sendo executado como Worker Thread
if (!parentPort) {
  console.error('❌ [FFT-WORKER] Este arquivo deve ser executado como Worker Thread');
  process.exit(1);
}

// Instanciar engine FFT
const fftEngine = new FastFFT();
logWorker('INITIALIZED', { pid: process.pid, threadId: workerData?.threadId || 'unknown' });

// Handler principal do Worker Thread
parentPort.on('message', async (data) => {
  const { taskId, signal, requestId } = data;
  const startTime = Date.now();
  
  logWorker('TASK_START', { 
    taskId, 
    requestId: requestId?.substring(0, 8) || 'unknown',
    signalLength: signal?.length || 0 
  });

  try {
    // Validar entrada
    if (!signal || !Array.isArray(signal) && !(signal instanceof Float32Array)) {
      throw new Error('Signal deve ser Array ou Float32Array');
    }

    if (signal.length === 0) {
      throw new Error('Signal não pode estar vazio');
    }

    // Converter para Float32Array se necessário
    const signalArray = signal instanceof Float32Array ? signal : new Float32Array(signal);
    
    // Validar potência de 2
    const N = signalArray.length;
    if (N & (N - 1)) {
      throw new Error(`FFT requer tamanho potência de 2, recebido: ${N}`);
    }

    logWorker('FFT_COMPUTING', { 
      size: N, 
      taskId, 
      requestId: requestId?.substring(0, 8) 
    });

    // Executar FFT
    const fftResult = fftEngine.fft(signalArray);
    
    // Validar resultado
    if (!fftResult || !fftResult.magnitude || !fftResult.phase) {
      throw new Error('FFT retornou resultado inválido');
    }

    const processingTime = Date.now() - startTime;
    
    logWorker('FFT_COMPLETED', { 
      taskId, 
      processingTime,
      magnitudeLength: fftResult.magnitude.length,
      maxMagnitude: Math.max(...fftResult.magnitude).toFixed(4)
    });

    // Retornar resultado via postMessage
    parentPort.postMessage({
      success: true,
      taskId,
      requestId,
      result: {
        real: Array.from(fftResult.real),        // Converter para Array para transferência
        imag: Array.from(fftResult.imag),
        magnitude: Array.from(fftResult.magnitude),
        phase: Array.from(fftResult.phase)
      },
      processingTime,
      workerId: process.pid
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logWorker('FFT_ERROR', { 
      taskId, 
      error: error.message, 
      processingTime 
    });

    // Retornar erro via postMessage
    parentPort.postMessage({
      success: false,
      taskId,
      requestId,
      error: {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack
      },
      processingTime,
      workerId: process.pid
    });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  logWorker('SHUTDOWN', { reason: 'SIGINT' });
  process.exit(0);
});

process.on('SIGTERM', () => {
  logWorker('SHUTDOWN', { reason: 'SIGTERM' });
  process.exit(0);
});

logWorker('READY', { pid: process.pid });