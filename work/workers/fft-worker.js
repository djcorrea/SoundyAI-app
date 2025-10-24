/**
 * 🎵 FFT Worker - Análise FFT + Métricas Espectrais em Thread Paralela
 * 
 * Executa:
 * - FFT Analysis (fft-optimized.js)
 * - Spectral Bands (7 bandas)
 * - Spectral Centroid
 * 
 * NENHUMA alteração de lógica - apenas movido para Worker Thread
 */

import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import { FastFFT } from '../lib/audio/fft-optimized.js';
import { SpectralMetricsCalculator, SpectralMetricsAggregator } from '../lib/audio/features/spectral-metrics.js';
import { SpectralBandsCalculator, SpectralBandsAggregator } from '../lib/audio/features/spectral-bands.js';
import { SpectralCentroidCalculator, SpectralCentroidAggregator } from '../lib/audio/features/spectral-centroid.js';
import { assertFinite } from '../lib/audio/error-handling.js';

const SAMPLE_RATE = 48000;
const FFT_SIZE = 4096;

async function calculateFFTMetrics() {
  const startWorker = performance.now();
  console.time('⚡ [Worker FFT] Total');
  
  try {
    const { framesFFT, jobId } = workerData;
    
    if (!framesFFT || !framesFFT.frames || framesFFT.frames.length === 0) {
      throw new Error('FFT Worker: framesFFT inválido ou vazio');
    }

    console.log(`[Worker FFT] Iniciando análise de ${framesFFT.frames.length} frames`);
    
    // Inicializar calculadores
    const fftEngine = new FastFFT();
    const spectralCalculator = new SpectralMetricsCalculator(SAMPLE_RATE, FFT_SIZE);
    const spectralBandsCalculator = new SpectralBandsCalculator(SAMPLE_RATE, FFT_SIZE);
    const spectralCentroidCalculator = new SpectralCentroidCalculator(SAMPLE_RATE, FFT_SIZE);
    
    // Agregadores
    const spectralAggregator = new SpectralMetricsAggregator();
    const bandsAggregator = new SpectralBandsAggregator();
    const centroidAggregator = new SpectralCentroidAggregator();
    
    const magnitudeSpectrum = [];
    const phaseSpectrum = [];
    
    // Loop por frames (MESMA LÓGICA do core-metrics.js)
    console.time('  └─ FFT Loop');
    
    for (let i = 0; i < framesFFT.frames.length; i++) {
      const frame = framesFFT.frames[i];
      
      // FFT
      const fftResult = fftEngine.fft(frame);
      magnitudeSpectrum.push(fftResult.magnitude);
      phaseSpectrum.push(fftResult.phase);
      
      // Métricas espectrais por frame
      const spectralMetrics = spectralCalculator.calculateFrameMetrics(fftResult.magnitude);
      spectralAggregator.addFrame(spectralMetrics);
      
      // Bandas espectrais por frame
      const bandsMetrics = spectralBandsCalculator.calculateFrameBands(fftResult.magnitude);
      bandsAggregator.addFrame(bandsMetrics);
      
      // Centroid por frame
      const centroidMetrics = spectralCentroidCalculator.calculateFrameCentroid(fftResult.magnitude);
      centroidAggregator.addFrame(centroidMetrics);
    }
    
    console.timeEnd('  └─ FFT Loop');
    
    // Agregar resultados
    console.time('  └─ Agregação');
    
    const spectralResults = spectralAggregator.getAggregatedMetrics();
    const bandsResults = bandsAggregator.getAggregatedBands();
    const centroidResults = centroidAggregator.getAggregatedCentroid();
    
    console.timeEnd('  └─ Agregação');
    
    // Resultado final
    const result = {
      // FFT
      magnitudeSpectrum,
      phaseSpectrum,
      
      // Spectral Metrics (8 métricas)
      spectral: {
        spectral_centroid: spectralResults.spectral_centroid,
        spectral_rolloff: spectralResults.spectral_rolloff,
        spectral_bandwidth: spectralResults.spectral_bandwidth,
        spectral_spread: spectralResults.spectral_spread,
        spectral_flatness: spectralResults.spectral_flatness,
        spectral_crest: spectralResults.spectral_crest,
        spectral_skewness: spectralResults.spectral_skewness,
        spectral_kurtosis: spectralResults.spectral_kurtosis
      },
      
      // Spectral Bands (7 bandas)
      spectralBands: bandsResults,
      
      // Spectral Centroid (Hz)
      spectralCentroidHz: centroidResults.centroidHz,
      spectralCentroidNormalized: centroidResults.centroidNormalized
    };
    
    assertFinite(result, 'fft_worker');
    
    const endWorker = performance.now();
    const timeMs = (endWorker - startWorker).toFixed(2);
    console.timeEnd('⚡ [Worker FFT] Total');
    console.log(`⏱️ [Worker FFT] levou ${timeMs} ms (${(timeMs / 1000).toFixed(2)} s)`);
    console.log(`[Worker FFT] ✅ Análise concluída: ${framesFFT.frames.length} frames`);
    
    parentPort.postMessage({ success: true, data: result });
    
  } catch (error) {
    const endWorker = performance.now();
    const timeMs = (endWorker - startWorker).toFixed(2);
    console.error('[Worker FFT] ❌ Erro:', error.message);
    console.timeEnd('⚡ [Worker FFT] Total');
    console.log(`⏱️ [Worker FFT] falhou após ${timeMs} ms (${(timeMs / 1000).toFixed(2)} s)`);
    parentPort.postMessage({ success: false, error: error.message });
  }
}

calculateFFTMetrics();
