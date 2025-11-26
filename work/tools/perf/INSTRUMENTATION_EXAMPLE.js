// 🔬 EXEMPLO DE INSTRUMENTAÇÃO DO PIPELINE
// Este arquivo mostra como adicionar medições sem alterar a lógica

/**
 * ANTES DA INSTRUMENTAÇÃO:
 * ========================
 * 
 * async function calculateCoreMetrics(segmentedAudio, options = {}) {
 *   const lufsMetrics = await calculateLUFSMetrics(leftChannel, rightChannel);
 *   const truePeakMetrics = await calculateTruePeakMetrics(leftChannel, rightChannel);
 *   return { lufs: lufsMetrics, truePeak: truePeakMetrics };
 * }
 */

/**
 * DEPOIS DA INSTRUMENTAÇÃO:
 * =========================
 */

import { withPhase, measureAsync } from '../tools/perf/instrumentation.js';

async function calculateCoreMetrics(segmentedAudio, options = {}) {
  // Envolver a função inteira em uma fase
  return await withPhase('CORE_METRICS', async () => {
    
    // Medir LUFS
    const lufsMetrics = await measureAsync('LUFS_CALCULATION', async () => {
      return await calculateLUFSMetrics(leftChannel, rightChannel);
    }, { 
      samples: leftChannel.length,
      sampleRate: 48000 
    });
    
    // Medir True Peak
    const truePeakMetrics = await measureAsync('TRUE_PEAK_CALCULATION', async () => {
      return await calculateTruePeakMetrics(leftChannel, rightChannel);
    }, {
      samples: leftChannel.length,
      method: 'ffmpeg_ebur128'
    });
    
    return { lufs: lufsMetrics, truePeak: truePeakMetrics };
  });
}

/**
 * BENEFÍCIOS:
 * ===========
 * 
 * 1. Mede tempo de cada subfase automaticamente
 * 2. Captura CPU usage e memória
 * 3. Hierarquia de fases: CORE_METRICS > LUFS_CALCULATION
 * 4. Metadados customizados (samples, sampleRate, method)
 * 5. Zero impacto na lógica de negócio
 * 6. Pode ser desativado via config (overhead ~0.1%)
 */

/**
 * EXEMPLO: INSTRUMENTAR BANDAS ESPECTRAIS
 * ========================================
 */

async function calculateSpectralBandsMetrics(framesFFT, options = {}) {
  return await withPhase('SPECTRAL_BANDS', async () => {
    
    const bandsResults = [];
    
    // Medir loop de processamento de frames
    await measureAsync('SPECTRAL_BANDS_FRAME_LOOP', async () => {
      for (let frameIndex = 0; frameIndex < framesFFT.frames.length; frameIndex++) {
        const frame = framesFFT.frames[frameIndex];
        
        // Medir análise de banda individual (opcional, pode ser muito granular)
        const result = await measureAsync(`SPECTRAL_BANDS_FRAME_${frameIndex}`, async () => {
          return this.spectralBandsCalculator.analyzeBands(
            frame.leftFFT.magnitude,
            frame.rightFFT.magnitude,
            frameIndex
          );
        }, { frameIndex, magnitudeLength: frame.leftFFT.magnitude.length });
        
        if (result.valid) {
          bandsResults.push(result);
        }
      }
    }, { totalFrames: framesFFT.frames.length });
    
    // Medir agregação
    const aggregatedBands = await measureAsync('SPECTRAL_BANDS_AGGREGATION', async () => {
      return SpectralBandsAggregator.aggregate(bandsResults);
    }, { validFrames: bandsResults.length });
    
    return aggregatedBands;
  });
}

/**
 * EXEMPLO: INSTRUMENTAR BPM COM MÉTODOS SEPARADOS
 * =================================================
 */

function calculateBpmMetrics(leftChannel, rightChannel, options = {}) {
  return withPhase('BPM_DETECTION', async () => {
    
    // Combinar canais (medido)
    const monoSignal = await measureAsync('BPM_MONO_CONVERSION', async () => {
      const mono = new Float32Array(leftChannel.length);
      for (let i = 0; i < leftChannel.length; i++) {
        mono[i] = Math.sqrt((leftChannel[i] ** 2 + rightChannel[i] ** 2) / 2);
      }
      return mono;
    }, { samples: leftChannel.length });
    
    // Método A: Music Tempo
    const musicTempoBpm = await measureAsync('BPM_METHOD_A_MUSIC_TEMPO', async () => {
      return this.calculateMusicTempoBpm(monoSignal, sampleRate, BPM_MIN, BPM_MAX);
    }, { method: 'music-tempo', minBpm: BPM_MIN, maxBpm: BPM_MAX });
    
    // Método B: Autocorrelação
    const autocorrBpm = await measureAsync('BPM_METHOD_B_AUTOCORRELATION', async () => {
      return this.calculateAutocorrelationBpm(monoSignal, sampleRate, BPM_MIN, BPM_MAX);
    }, { method: 'autocorrelation', minBpm: BPM_MIN, maxBpm: BPM_MAX });
    
    // Cross-validation
    const consolidated = await measureAsync('BPM_CROSS_VALIDATION', async () => {
      return this.crossValidateBpmResults(musicTempoBpm, autocorrBpm);
    }, { 
      method1Bpm: musicTempoBpm.bpm, 
      method2Bpm: autocorrBpm.bpm 
    });
    
    return consolidated;
  });
}

/**
 * EXEMPLO: INSTRUMENTAR FFT LOOP
 * ================================
 */

async function calculateFFTMetrics(framesFFT, options = {}) {
  return await withPhase('FFT_PROCESSING', async () => {
    
    const fftResults = {
      left: [],
      right: [],
      magnitudeSpectrum: []
    };
    
    const maxFrames = Math.min(framesFFT.count, 1000);
    
    // Medir loop inteiro
    await measureAsync('FFT_FRAME_LOOP', async () => {
      for (let i = 0; i < maxFrames; i++) {
        // NOTA: Aqui você pode medir frame individual se necessário
        // Mas pode ser muito granular (1000+ medições)
        
        const leftFFT = framesFFT.left[i];
        const rightFFT = framesFFT.right[i];
        
        fftResults.left.push(leftFFT);
        fftResults.right.push(rightFFT);
        
        const magnitude = this.calculateMagnitudeSpectrum(leftFFT, rightFFT);
        fftResults.magnitudeSpectrum.push(magnitude);
      }
    }, { totalFrames: maxFrames });
    
    // Medir agregação espectral
    const aggregatedSpectral = await measureAsync('FFT_SPECTRAL_AGGREGATION', async () => {
      return SpectralMetricsAggregator.aggregate(metricsArray);
    }, { metricsCount: metricsArray.length });
    
    return fftResults;
  });
}

/**
 * DICAS DE INSTRUMENTAÇÃO:
 * =========================
 * 
 * 1. **Granularidade**: Medir fases principais (não cada linha)
 *    - ✅ BOM: LUFS_CALCULATION, TRUE_PEAK_CALCULATION
 *    - ❌ RUIM: LUFS_BLOCK_1, LUFS_BLOCK_2, ...
 * 
 * 2. **Hierarquia**: Usar withPhase() para contexto
 *    - PIPELINE > CORE_METRICS > LUFS_CALCULATION
 * 
 * 3. **Metadados**: Incluir info útil para debug
 *    - { samples, sampleRate, method, frameIndex }
 * 
 * 4. **Async vs Sync**:
 *    - measureAsync() para funções async
 *    - measure() para funções síncronas
 * 
 * 5. **Overhead**: ~0.1% por medição
 *    - Não instrumentar loops apertados (> 10k iterações)
 * 
 * 6. **Desabilitar**: Set enabled: false em configureInstrumentation()
 *    - Para produção sem overhead
 */

/**
 * EXEMPLO COMPLETO: PIPELINE INSTRUMENTADO
 * =========================================
 */

export async function processAudioComplete(audioBuffer, fileName, options = {}) {
  // Configurar instrumentação no início
  configureInstrumentation({ 
    enabled: true, 
    jobId: options.jobId 
  });
  
  return await withPhase('PIPELINE_COMPLETE', async () => {
    
    // Fase 5.1: Decode
    const audioData = await withPhase('PHASE_5_1_DECODE', async () => {
      return await decodeAudioFile(audioBuffer, fileName, options);
    });
    
    // Fase 5.2: Segmentation
    const segmentedData = await withPhase('PHASE_5_2_SEGMENTATION', async () => {
      return segmentAudioTemporal(audioData, options);
    });
    
    // Fase 5.3: Core Metrics
    const coreMetrics = await withPhase('PHASE_5_3_CORE_METRICS', async () => {
      return await calculateCoreMetrics(segmentedData, options);
    });
    
    // Fase 5.4: JSON Output
    const finalJSON = await withPhase('PHASE_5_4_JSON_OUTPUT', async () => {
      return generateJSONOutput(coreMetrics, reference, metadata, options);
    });
    
    return finalJSON;
  });
}

/**
 * RESULTADO: MEDIÇÕES AUTOMÁTICAS
 * ================================
 * 
 * O sistema gerará automaticamente:
 * 
 * {
 *   "name": "PIPELINE_COMPLETE > PHASE_5_3_CORE_METRICS > LUFS_CALCULATION",
 *   "durationMs": 1234.56,
 *   "cpuUserMs": 1100.23,
 *   "cpuSystemMs": 134.33,
 *   "rssMb": 512.45,
 *   "heapUsedMb": 256.78,
 *   "metadata": {
 *     "samples": 4800000,
 *     "sampleRate": 48000
 *   }
 * }
 * 
 * Estas medições são agregadas em:
 * - results.json (bruto)
 * - summary.md (tabela formatada)
 * - results.csv (para análise)
 */

console.log('✅ Exemplo de instrumentação carregado');
