// 🎵 CORE METRICS - Fase 5.3 Pipeline Migration
// FFT, LUFS ITU-R BS.1770-4, True Peak 4x Oversampling, Stereo Analysis
// Migração equivalente das métricas do Web Audio API para Node.js
// 🚀 FASE 5.5: Controle de concorrência para FFT processing

import { FastFFT } from '../../lib/audio/fft.js';
import { calculateLoudnessMetrics } from '../../lib/audio/features/loudness.js';
import { TruePeakDetector } from '../../lib/audio/features/truepeak.js';
import { executeFFTWithConcurrency } from './concurrency-manager.js';

/**
 * 🎯 CONFIGURAÇÕES DA FASE 5.3 (AUDITORIA)
 * Valores fixos conforme especificação do pipeline original
 */
const CORE_METRICS_CONFIG = {
  SAMPLE_RATE: 48000,
  FFT_SIZE: 4096,
  FFT_HOP_SIZE: 1024,
  WINDOW_TYPE: 'hann',
  
  // LUFS ITU-R BS.1770-4
  LUFS_BLOCK_DURATION_MS: 400,      // 400ms blocks
  LUFS_SHORT_TERM_DURATION_MS: 3000, // 3s short-term
  LUFS_ABSOLUTE_THRESHOLD: -70.0,    // LUFS
  LUFS_RELATIVE_THRESHOLD: -10.0,    // LU
  
  // True Peak
  TRUE_PEAK_OVERSAMPLING: 4          // 4x oversampling
};

/**
 * 🧮 Instâncias dos processadores de áudio
 */
class CoreMetricsProcessor {
  constructor() {
    this.fftEngine = new FastFFT();
    this.truePeakDetector = new TruePeakDetector();
    
    // Cache para otimização
    this.cache = {
      hannWindow: new Map(),
      fftResults: new Map()
    };
    
    console.log('✅ Core Metrics Processor inicializado (Fase 5.3)');
  }

  /**
   * 🎯 PROCESSAMENTO PRINCIPAL - Fase 5.3
   * @param {Object} segmentedAudio - Saída da Fase 5.2 (temporal-segmentation.js)
   * @returns {Object} - Métricas core calculadas
   */
  async processMetrics(segmentedAudio) {
    console.log('🚀 Iniciando cálculo de métricas core (Fase 5.3)...');
    const startTime = Date.now();

    // Validar entrada da Fase 5.2
    this.validateInputFrom5_2(segmentedAudio);

    // Garantir que temos os canais originais
    const { leftChannel, rightChannel } = this.ensureOriginalChannels(segmentedAudio);

    try {
      // 1. FFT dos frames windowed
      const fftResults = await this.calculateFFTMetrics(segmentedAudio.framesFFT);
      
      // 2. LUFS dos dados originais contínuos
      const lufsResults = await this.calculateLUFSMetrics(
        leftChannel,
        rightChannel,
        segmentedAudio.sampleRate
      );
      
      // 3. True Peak dos dados originais
      const truePeakResults = await this.calculateTruePeakMetrics(
        leftChannel,
        rightChannel,
        segmentedAudio.sampleRate
      );

      // 4. Análise estéreo (correlação, width)
      const stereoResults = await this.calculateStereoMetrics(
        leftChannel,
        rightChannel
      );

      const processingTime = Date.now() - startTime;
      
      const results = {
        // Dados originais preservados
        originalLength: segmentedAudio.originalLength,
        sampleRate: segmentedAudio.sampleRate,
        duration: segmentedAudio.duration,
        numberOfChannels: segmentedAudio.numberOfChannels,
        
        // FFT Results
        fft: fftResults,
        
        // LUFS Results (ITU-R BS.1770-4)
        lufs: lufsResults,
        
        // True Peak Results (4x oversampling)
        truePeak: truePeakResults,
        
        // Stereo Analysis Results
        stereo: stereoResults,
        
        // Metadata da Fase 5.3
        _metadata: {
          phase: '5.3-core-metrics',
          processingTime,
          calculatedAt: new Date().toISOString(),
          config: {
            fft: {
              size: CORE_METRICS_CONFIG.FFT_SIZE,
              hop: CORE_METRICS_CONFIG.FFT_HOP_SIZE,
              window: CORE_METRICS_CONFIG.WINDOW_TYPE
            },
            lufs: {
              blockMs: CORE_METRICS_CONFIG.LUFS_BLOCK_DURATION_MS,
              shortTermMs: CORE_METRICS_CONFIG.LUFS_SHORT_TERM_DURATION_MS,
              absoluteThreshold: CORE_METRICS_CONFIG.LUFS_ABSOLUTE_THRESHOLD,
              relativeThreshold: CORE_METRICS_CONFIG.LUFS_RELATIVE_THRESHOLD
            },
            truePeak: {
              oversampling: CORE_METRICS_CONFIG.TRUE_PEAK_OVERSAMPLING
            }
          }
        }
      };

      console.log(`✅ Métricas core calculadas em ${processingTime}ms`);
      console.log(`   - FFT frames processados: ${fftResults.frameCount}`);
      console.log(`   - LUFS integrado: ${this.formatValue(lufsResults.integrated, 'LUFS')}`);
      console.log(`   - True Peak máximo: ${this.formatValue(truePeakResults.maxDbtp, 'dBTP')}`);
      console.log(`   - Correlação estéreo: ${this.formatValue(stereoResults.correlation, '', 3)}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Erro no cálculo de métricas core:', error.message);
      throw new Error(`CORE_METRICS_ERROR: ${error.message}`);
    }
  }

  /**
   * 🎯 GARANTIR CANAIS ORIGINAIS VÁLIDOS
   * @param {Object} segmentedAudio - Dados da segmentação temporal
   * @returns {Object} - { leftChannel, rightChannel }
   */
  ensureOriginalChannels(segmentedAudio) {
    let leftChannel = segmentedAudio.originalLeft;
    let rightChannel = segmentedAudio.originalRight;

    // Se não temos originalLeft/Right, reconstruir dos frames RMS sem perda
    if (!leftChannel || !rightChannel) {
      console.log('⚠️ Canais originais ausentes, reconstruindo dos frames RMS...');
      
      leftChannel = this.reconstructFromFrames(segmentedAudio.framesRMS.left, segmentedAudio.framesRMS.hopSize);
      rightChannel = this.reconstructFromFrames(segmentedAudio.framesRMS.right, segmentedAudio.framesRMS.hopSize);
      
      console.log(`✅ Canais reconstruídos: ${leftChannel.length} samples por canal`);
    }

    // Validar que temos dados válidos
    if (!leftChannel || !rightChannel || leftChannel.length === 0 || rightChannel.length === 0) {
      throw new Error('INVALID_CHANNELS: Canais de áudio ausentes ou vazios');
    }

    // Converter para Float32Array se necessário
    if (!(leftChannel instanceof Float32Array)) {
      leftChannel = new Float32Array(leftChannel);
    }
    if (!(rightChannel instanceof Float32Array)) {
      rightChannel = new Float32Array(rightChannel);
    }

    console.log(`✅ Canais validados: ${leftChannel.length} samples, L/R balanceados`);
    
    return { leftChannel, rightChannel };
  }

  /**
   * 🎯 RECONSTRUIR ÁUDIO ORIGINAL DOS FRAMES RMS
   * @param {Array<Float32Array>} frames - Frames RMS
   * @param {number} hopSize - Hop size usado
   * @returns {Float32Array} - Canal reconstruído
   */
  reconstructFromFrames(frames, hopSize) {
    if (!frames || frames.length === 0) {
      return new Float32Array(0);
    }

    // Calcular tamanho total estimado
    const estimatedLength = (frames.length - 1) * hopSize + frames[0].length;
    const reconstructed = new Float32Array(estimatedLength);

    // Reconstruir usando overlap-add dos frames
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const startIdx = i * hopSize;
      
      // Adicionar frame com overlap-add
      for (let j = 0; j < frame.length && startIdx + j < reconstructed.length; j++) {
        if (j < hopSize || i === frames.length - 1) {
          // Primeira parte do frame ou último frame completo
          reconstructed[startIdx + j] = frame[j];
        } else {
          // Overlap region - média simples
          reconstructed[startIdx + j] = (reconstructed[startIdx + j] + frame[j]) * 0.5;
        }
      }
    }

    return reconstructed;
  }

  /**
   * 🎯 CALCULAR FFT de todos os frames windowed
   * 🚀 FASE 5.5: Com controle de concorrência
   * @param {Object} framesFFT - Frames FFT da Fase 5.2
   * @returns {Object} - Resultados FFT processados
   */
  async calculateFFTMetrics(framesFFT) {
    console.log(`📊 Processando ${framesFFT.count} frames FFT com controle de concorrência...`);
    
    const results = {
      frameCount: framesFFT.count,
      frameSize: framesFFT.frameSize,
      hopSize: framesFFT.hopSize,
      windowType: framesFFT.windowType,
      
      // Espectrogramas (magnitude para cada frame)
      spectrograms: {
        left: [],
        right: []
      },
      
      // Bandas de frequência agregadas
      frequencyBands: {
        left: {},
        right: {}
      },
      
      // Análise espectral média
      averageSpectrum: {
        left: null,
        right: null
      }
    };

    // 🚀 CONTROLE DE CONCORRÊNCIA: Processar FFTs em batches controlados
    const batchSize = 10; // Processar em lotes de 10 frames por vez
    const batches = [];
    
    // Dividir frames em batches
    for (let i = 0; i < framesFFT.count; i += batchSize) {
      const endIndex = Math.min(i + batchSize, framesFFT.count);
      batches.push({ startIndex: i, endIndex, batchId: Math.floor(i / batchSize) });
    }

    console.log(`🔄 FFT dividido em ${batches.length} batches de até ${batchSize} frames`);

    // Processar cada batch com controle de concorrência
    for (const batch of batches) {
      await executeFFTWithConcurrency(
        async (batchData) => {
          const { startIndex, endIndex, batchId } = batchData;
          console.log(`⚡ Processando batch ${batchId}: frames ${startIndex}-${endIndex-1}`);
          
          // Processar frames do batch
          for (let i = startIndex; i < endIndex; i++) {
            // Canal esquerdo
            const leftFFT = this.fftEngine.fft(framesFFT.left[i]);
            results.spectrograms.left.push({
              magnitude: Array.from(leftFFT.magnitude.slice(0, CORE_METRICS_CONFIG.FFT_SIZE / 2)),
              phase: Array.from(leftFFT.phase.slice(0, CORE_METRICS_CONFIG.FFT_SIZE / 2)),
              frameIndex: i,
              timestamp: (i * framesFFT.hopSize) / CORE_METRICS_CONFIG.SAMPLE_RATE
            });
            
            // Canal direito
            const rightFFT = this.fftEngine.fft(framesFFT.right[i]);
            results.spectrograms.right.push({
              magnitude: Array.from(rightFFT.magnitude.slice(0, CORE_METRICS_CONFIG.FFT_SIZE / 2)),
              phase: Array.from(rightFFT.phase.slice(0, CORE_METRICS_CONFIG.FFT_SIZE / 2)),
              frameIndex: i,
              timestamp: (i * framesFFT.hopSize) / CORE_METRICS_CONFIG.SAMPLE_RATE
            });
          }
          
          console.log(`✅ Batch ${batchId} processado: ${endIndex - startIndex} frames FFT`);
          return { batchId, framesProcessed: endIndex - startIndex };
        },
        batch,
        { 
          timeout: 30000, // 30s timeout por batch
          priority: 'normal' 
        }
      );
    }

    // Calcular espectro médio após todo processamento FFT
    results.averageSpectrum.left = this.calculateAverageSpectrum(results.spectrograms.left);
    results.averageSpectrum.right = this.calculateAverageSpectrum(results.spectrograms.right);
    
    // Calcular bandas de frequência padrão
    results.frequencyBands.left = this.calculateFrequencyBands(results.averageSpectrum.left);
    results.frequencyBands.right = this.calculateFrequencyBands(results.averageSpectrum.right);

    console.log(`✅ FFT processado com concorrência: ${results.frameCount} frames, ${results.spectrograms.left.length} espectrogramas`);
    
    return results;
  }

  /**
   * 🎯 CALCULAR LUFS ITU-R BS.1770-4
   * @param {Float32Array} leftChannel - Canal esquerdo original
   * @param {Float32Array} rightChannel - Canal direito original  
   * @param {number} sampleRate - Sample rate
   * @returns {Object} - Métricas LUFS completas
   */
  async calculateLUFSMetrics(leftChannel, rightChannel, sampleRate) {
    console.log(`🔊 Calculando LUFS ITU-R BS.1770-4...`);
    
    // Detectar silêncio ou áudio muito baixo
    const leftRMS = this.calculateRMS(leftChannel);
    const rightRMS = this.calculateRMS(rightChannel);
    const avgRMS = (leftRMS + rightRMS) / 2;
    
    if (avgRMS < 1e-10) {
      console.log('⚠️ Áudio muito baixo ou silencioso detectado');
      return this.createSilentLUFSResult();
    }
    
    try {
      // Usar a implementação existente do pipeline
      const lufsResults = calculateLoudnessMetrics(
        Array.from(leftChannel), 
        Array.from(rightChannel), 
        sampleRate
      );
      
      // Padronizar formato de saída e tratar -Infinity
      const integrated = this.sanitizeValue(lufsResults.lufs_integrated || lufsResults.integrated, -70.0);
      const shortTerm = this.sanitizeValue(lufsResults.lufs_short_term || lufsResults.shortTerm || integrated, integrated);
      const momentary = this.sanitizeValue(lufsResults.lufs_momentary || lufsResults.momentary || integrated, integrated);
      const lra = this.sanitizeValue(lufsResults.lra || lufsResults.range, 0.0);
      
      const standardizedResults = {
        // Valores principais
        integrated: integrated,
        shortTerm: shortTerm,
        momentary: momentary,
        
        // Loudness Range
        lra: lra,
        
        // Gating info
        gatingInfo: {
          absoluteThreshold: CORE_METRICS_CONFIG.LUFS_ABSOLUTE_THRESHOLD,
          relativeThreshold: CORE_METRICS_CONFIG.LUFS_RELATIVE_THRESHOLD,
          gatedLoudness: this.sanitizeValue(lufsResults.lufs_gated || lufsResults.gated, integrated),
          ungatedLoudness: this.sanitizeValue(lufsResults.lufs_ungated || lufsResults.ungated, integrated),
          gatedBlocks: lufsResults.gated_blocks || 0,
          totalBlocks: lufsResults.total_blocks || 0
        },
        
        // Conformidade EBU R128
        r128Compliance: {
          integratedWithinRange: integrated >= -27 && integrated <= -20,
          truePeakBelowCeiling: true, // Será atualizado pela métrica True Peak
          lraWithinRange: lra <= 20.0
        },
        
        // Metadados
        blockDurationMs: CORE_METRICS_CONFIG.LUFS_BLOCK_DURATION_MS,
        shortTermDurationMs: CORE_METRICS_CONFIG.LUFS_SHORT_TERM_DURATION_MS,
        standard: 'ITU-R BS.1770-4',
        
        // Diagnósticos
        diagnostics: {
          avgRMS: avgRMS,
          leftRMS: leftRMS,
          rightRMS: rightRMS,
          isSilent: avgRMS < 1e-8,
          isLowLevel: avgRMS < 1e-6
        }
      };

      console.log(`✅ LUFS calculado: ${this.formatValue(standardizedResults.integrated, 'LUFS')}`);
      
      return standardizedResults;
      
    } catch (error) {
      console.error('❌ Erro no cálculo LUFS:', error.message);
      return this.createSilentLUFSResult();
    }
  }

  /**
   * 🎯 CRIAR RESULTADO LUFS PARA SILÊNCIO
   * @returns {Object} - Resultado LUFS padronizado para silêncio
   */
  createSilentLUFSResult() {
    return {
      integrated: -70.0,    // Threshold absoluto
      shortTerm: -70.0,
      momentary: -70.0,
      lra: 0.0,
      
      gatingInfo: {
        absoluteThreshold: CORE_METRICS_CONFIG.LUFS_ABSOLUTE_THRESHOLD,
        relativeThreshold: CORE_METRICS_CONFIG.LUFS_RELATIVE_THRESHOLD,
        gatedLoudness: -70.0,
        ungatedLoudness: -70.0,
        gatedBlocks: 0,
        totalBlocks: 0
      },
      
      r128Compliance: {
        integratedWithinRange: false,
        truePeakBelowCeiling: true,
        lraWithinRange: true
      },
      
      blockDurationMs: CORE_METRICS_CONFIG.LUFS_BLOCK_DURATION_MS,
      shortTermDurationMs: CORE_METRICS_CONFIG.LUFS_SHORT_TERM_DURATION_MS,
      standard: 'ITU-R BS.1770-4',
      
      diagnostics: {
        avgRMS: 0.0,
        leftRMS: 0.0,
        rightRMS: 0.0,
        isSilent: true,
        isLowLevel: true
      }
    };
  }

  /**
   * 🎯 CALCULAR TRUE PEAK 4x Oversampling
   * @param {Float32Array} leftChannel - Canal esquerdo original
   * @param {Float32Array} rightChannel - Canal direito original
   * @param {number} sampleRate - Sample rate
   * @returns {Object} - Métricas True Peak
   */
  async calculateTruePeakMetrics(leftChannel, rightChannel, sampleRate) {
    console.log(`🏔️ Calculando True Peak 4x oversampling...`);
    
    // Detectar silêncio
    const leftMax = this.calculateAbsMax(leftChannel);
    const rightMax = this.calculateAbsMax(rightChannel);
    
    if (leftMax < 1e-10 && rightMax < 1e-10) {
      console.log('⚠️ Áudio silencioso detectado para True Peak');
      return this.createSilentTruePeakResult();
    }
    
    try {
      // Detectar true peaks em ambos os canais
      const leftPeak = this.truePeakDetector.detectTruePeak(Array.from(leftChannel));
      const rightPeak = this.truePeakDetector.detectTruePeak(Array.from(rightChannel));
      
      // True Peak máximo entre os canais
      const maxLinear = Math.max(
        this.sanitizeValue(leftPeak.true_peak_linear, 0.0),
        this.sanitizeValue(rightPeak.true_peak_linear, 0.0)
      );
      
      const maxDbtp = maxLinear > 1e-10 ? 20 * Math.log10(maxLinear) : -60.0;
      
      const results = {
        // Valores principais
        maxDbtp: this.sanitizeValue(maxDbtp, -60.0),
        maxLinear: maxLinear,
        
        // Por canal
        channels: {
          left: {
            peakDbtp: this.sanitizeValue(leftPeak.true_peak_dbtp, -60.0),
            peakLinear: this.sanitizeValue(leftPeak.true_peak_linear, 0.0),
            peakPosition: leftPeak.peak_position || 0,
            peakTime: (leftPeak.peak_position || 0) / sampleRate
          },
          right: {
            peakDbtp: this.sanitizeValue(rightPeak.true_peak_dbtp, -60.0),
            peakLinear: this.sanitizeValue(rightPeak.true_peak_linear, 0.0),
            peakPosition: rightPeak.peak_position || 0,
            peakTime: (rightPeak.peak_position || 0) / sampleRate
          }
        },
        
        // Análise de clipping
        clippingAnalysis: {
          isClipping: maxDbtp > -0.1,
          clippingMargin: Math.max(-0.1 - maxDbtp, 0),
          clippingRisk: maxDbtp > -1.0 ? 'HIGH' : maxDbtp > -3.0 ? 'MEDIUM' : 'LOW'
        },
        
        // Conformidade 
        compliance: {
          ebuR128: maxDbtp <= -1.0,
          streaming: maxDbtp <= -1.0,
          broadcast: maxDbtp <= -0.1
        },
        
        // Configuração usada
        oversampling: CORE_METRICS_CONFIG.TRUE_PEAK_OVERSAMPLING,
        standard: 'ITU-R BS.1770-4',
        
        // Diagnósticos
        diagnostics: {
          leftMax: leftMax,
          rightMax: rightMax,
          isSilent: maxLinear < 1e-10,
          samplePeakLeft: leftMax,
          samplePeakRight: rightMax,
          clippingCount: (leftPeak.clipping_count || 0) + (rightPeak.clipping_count || 0)
        }
      };

      console.log(`✅ True Peak calculado: ${this.formatValue(results.maxDbtp, 'dBTP')}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Erro no cálculo True Peak:', error.message);
      return this.createSilentTruePeakResult();
    }
  }

  /**
   * 🎯 CRIAR RESULTADO TRUE PEAK PARA SILÊNCIO
   * @returns {Object} - Resultado True Peak padronizado para silêncio
   */
  createSilentTruePeakResult() {
    return {
      maxDbtp: -60.0,
      maxLinear: 0.0,
      
      channels: {
        left: {
          peakDbtp: -60.0,
          peakLinear: 0.0,
          peakPosition: 0,
          peakTime: 0.0
        },
        right: {
          peakDbtp: -60.0,
          peakLinear: 0.0,
          peakPosition: 0,
          peakTime: 0.0
        }
      },
      
      clippingAnalysis: {
        isClipping: false,
        clippingMargin: 59.9,
        clippingRisk: 'LOW'
      },
      
      compliance: {
        ebuR128: true,
        streaming: true,
        broadcast: true
      },
      
      oversampling: CORE_METRICS_CONFIG.TRUE_PEAK_OVERSAMPLING,
      standard: 'ITU-R BS.1770-4',
      
      diagnostics: {
        leftMax: 0.0,
        rightMax: 0.0,
        isSilent: true,
        samplePeakLeft: 0.0,
        samplePeakRight: 0.0,
        clippingCount: 0
      }
    };
  }

  /**
   * 🎯 CALCULAR ANÁLISE ESTÉREO (Correlação + Width)
   * @param {Float32Array} leftChannel - Canal esquerdo
   * @param {Float32Array} rightChannel - Canal direito
   * @returns {Object} - Métricas de imagem estéreo
   */
  async calculateStereoMetrics(leftChannel, rightChannel) {
    console.log(`📡 Calculando análise estéreo...`);
    
    const correlation = this.calculateCorrelation(leftChannel, rightChannel);
    const width = this.calculateStereoWidth(leftChannel, rightChannel);
    const balance = this.calculateStereoBalance(leftChannel, rightChannel);
    
    // Mid-Side analysis
    const { mid, side } = this.calculateMidSide(leftChannel, rightChannel);
    const midRMS = this.calculateRMS(mid);
    const sideRMS = this.calculateRMS(side);
    const msRatio = sideRMS > 0 ? midRMS / sideRMS : 1.0;
    
    const results = {
      // Correlação entre canais (-1 a +1)
      correlation: this.sanitizeValue(correlation, 0.0),
      
      // Largura estéreo (0 = mono, 1 = estéreo total)
      width: this.sanitizeValue(width, 0.0),
      
      // Balanceamento L/R (-1 = só L, 0 = centro, +1 = só R)
      balance: this.sanitizeValue(balance, 0.0),
      
      // Mid-Side analysis
      midSide: {
        midRMS: midRMS,
        sideRMS: sideRMS,
        ratio: this.sanitizeValue(msRatio, 1.0),
        widthFromMS: sideRMS > midRMS * 0.1 ? 1.0 : 0.0
      },
      
      // Classificação da imagem estéreo
      classification: this.classifyStereoImage(correlation, width, balance),
      
      // Diagnósticos
      diagnostics: {
        leftRMS: this.calculateRMS(leftChannel),
        rightRMS: this.calculateRMS(rightChannel),
        correlationValid: !isNaN(correlation) && isFinite(correlation),
        widthValid: !isNaN(width) && isFinite(width)
      }
    };

    console.log(`✅ Estéreo analisado: correlação ${this.formatValue(correlation, '', 3)}, width ${this.formatValue(width, '', 3)}`);
    
    return results;
  }

  /**
   * 🎯 CALCULAR ESPECTRO MÉDIO
   * @param {Array} spectrograms - Array de espectrogramas
   * @returns {Array} - Magnitude média
   */
  calculateAverageSpectrum(spectrograms) {
    if (!spectrograms.length) return [];
    
    const spectrumLength = spectrograms[0].magnitude.length;
    const averageMagnitude = new Array(spectrumLength).fill(0);
    
    // Somar todas as magnitudes
    for (const frame of spectrograms) {
      for (let i = 0; i < spectrumLength; i++) {
        averageMagnitude[i] += frame.magnitude[i];
      }
    }
    
    // Calcular média
    for (let i = 0; i < spectrumLength; i++) {
      averageMagnitude[i] /= spectrograms.length;
    }
    
    return averageMagnitude;
  }

  /**
   * 🎯 CALCULAR BANDAS DE FREQUÊNCIA PADRÃO
   * @param {Array} averageSpectrum - Espectro médio
   * @returns {Object} - Bandas de frequência
   */
  calculateFrequencyBands(averageSpectrum) {
    const nyquist = CORE_METRICS_CONFIG.SAMPLE_RATE / 2;
    const binSize = nyquist / (averageSpectrum.length - 1);
    
    const bands = {
      subBass: { min: 20, max: 60, energy: 0 },      // Sub-bass
      bass: { min: 60, max: 250, energy: 0 },        // Bass
      lowMid: { min: 250, max: 500, energy: 0 },     // Low-mid
      mid: { min: 500, max: 2000, energy: 0 },       // Mid
      highMid: { min: 2000, max: 4000, energy: 0 },  // High-mid
      presence: { min: 4000, max: 8000, energy: 0 }, // Presence
      brilliance: { min: 8000, max: 20000, energy: 0 } // Brilliance
    };
    
    // Calcular energia por banda
    for (const [bandName, band] of Object.entries(bands)) {
      const minBin = Math.floor(band.min / binSize);
      const maxBin = Math.floor(band.max / binSize);
      
      let energy = 0;
      for (let i = minBin; i <= maxBin && i < averageSpectrum.length; i++) {
        energy += averageSpectrum[i] * averageSpectrum[i]; // Energia = magnitude²
      }
      
      band.energy = energy;
      band.energyDb = 10 * Math.log10(Math.max(energy, 1e-10));
    }
    
    return bands;
  }

  /**
   * 🔍 VALIDAR ENTRADA DA FASE 5.2
   * @param {Object} segmentedAudio - Dados da segmentação temporal
   */
  validateInputFrom5_2(segmentedAudio) {
    const required = ['originalLength', 'sampleRate', 'duration', 'numberOfChannels', 'framesFFT', 'framesRMS'];
    
    for (const field of required) {
      if (!segmentedAudio.hasOwnProperty(field)) {
        throw new Error(`INVALID_INPUT_5_2: Campo obrigatório ausente: ${field}`);
      }
    }
    
    // Validar sample rate
    if (segmentedAudio.sampleRate !== CORE_METRICS_CONFIG.SAMPLE_RATE) {
      throw new Error(`SAMPLE_RATE_MISMATCH: Esperado ${CORE_METRICS_CONFIG.SAMPLE_RATE}, recebido ${segmentedAudio.sampleRate}`);
    }
    
    // Validar frames FFT
    if (!segmentedAudio.framesFFT.left || !segmentedAudio.framesFFT.right) {
      throw new Error('MISSING_FFT_FRAMES: Frames FFT left/right ausentes');
    }
    
    if (segmentedAudio.framesFFT.frameSize !== CORE_METRICS_CONFIG.FFT_SIZE) {
      throw new Error(`FFT_SIZE_MISMATCH: Esperado ${CORE_METRICS_CONFIG.FFT_SIZE}, recebido ${segmentedAudio.framesFFT.frameSize}`);
    }
    
    console.log('✅ Entrada da Fase 5.2 validada com sucesso');
  }

  // === MÉTODOS AUXILIARES ===

  /**
   * 🎯 SANITIZAR VALORES (tratar NaN, Infinity)
   * @param {number} value - Valor a sanitizar
   * @param {number} fallback - Valor de fallback
   * @returns {number} - Valor sanitizado
   */
  sanitizeValue(value, fallback) {
    if (isNaN(value) || !isFinite(value)) {
      return fallback;
    }
    return value;
  }

  /**
   * 🎯 FORMATAR VALORES PARA DISPLAY
   * @param {number} value - Valor a formatar
   * @param {string} unit - Unidade
   * @param {number} decimals - Casas decimais
   * @returns {string} - Valor formatado
   */
  formatValue(value, unit = '', decimals = 1) {
    if (isNaN(value) || !isFinite(value)) {
      return `--${unit}`;
    }
    return `${value.toFixed(decimals)}${unit}`;
  }

  /**
   * 🎯 CALCULAR RMS
   * @param {Float32Array} channel - Canal de áudio
   * @returns {number} - Valor RMS
   */
  calculateRMS(channel) {
    let sum = 0;
    for (let i = 0; i < channel.length; i++) {
      sum += channel[i] * channel[i];
    }
    return Math.sqrt(sum / channel.length);
  }

  /**
   * 🎯 CALCULAR MÁXIMO ABSOLUTO
   * @param {Float32Array} channel - Canal de áudio
   * @returns {number} - Valor máximo absoluto
   */
  calculateAbsMax(channel) {
    let max = 0;
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i]);
      if (abs > max) max = abs;
    }
    return max;
  }

  /**
   * 🎯 CALCULAR CORRELAÇÃO ENTRE CANAIS
   * @param {Float32Array} left - Canal esquerdo
   * @param {Float32Array} right - Canal direito
   * @returns {number} - Correlação (-1 a +1)
   */
  calculateCorrelation(left, right) {
    const length = Math.min(left.length, right.length);
    if (length === 0) return 0.0;

    // Médias
    let meanL = 0, meanR = 0;
    for (let i = 0; i < length; i++) {
      meanL += left[i];
      meanR += right[i];
    }
    meanL /= length;
    meanR /= length;

    // Covariância e variâncias
    let covariance = 0, varL = 0, varR = 0;
    for (let i = 0; i < length; i++) {
      const devL = left[i] - meanL;
      const devR = right[i] - meanR;
      covariance += devL * devR;
      varL += devL * devL;
      varR += devR * devR;
    }

    const denominator = Math.sqrt(varL * varR);
    return denominator > 0 ? covariance / denominator : 0.0;
  }

  /**
   * 🎯 CALCULAR LARGURA ESTÉREO
   * @param {Float32Array} left - Canal esquerdo
   * @param {Float32Array} right - Canal direito
   * @returns {number} - Largura (0 a 1)
   */
  calculateStereoWidth(left, right) {
    const length = Math.min(left.length, right.length);
    if (length === 0) return 0.0;

    let sumDiff = 0, sumSum = 0;
    for (let i = 0; i < length; i++) {
      const diff = left[i] - right[i];
      const sum = left[i] + right[i];
      sumDiff += diff * diff;
      sumSum += sum * sum;
    }

    return sumSum > 0 ? Math.sqrt(sumDiff / sumSum) : 0.0;
  }

  /**
   * 🎯 CALCULAR BALANCEAMENTO ESTÉREO
   * @param {Float32Array} left - Canal esquerdo
   * @param {Float32Array} right - Canal direito
   * @returns {number} - Balance (-1 a +1)
   */
  calculateStereoBalance(left, right) {
    const leftRMS = this.calculateRMS(left);
    const rightRMS = this.calculateRMS(right);
    const total = leftRMS + rightRMS;
    
    return total > 0 ? (rightRMS - leftRMS) / total : 0.0;
  }

  /**
   * 🎯 CALCULAR MID-SIDE
   * @param {Float32Array} left - Canal esquerdo
   * @param {Float32Array} right - Canal direito
   * @returns {Object} - { mid, side }
   */
  calculateMidSide(left, right) {
    const length = Math.min(left.length, right.length);
    const mid = new Float32Array(length);
    const side = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      mid[i] = (left[i] + right[i]) * 0.5;
      side[i] = (left[i] - right[i]) * 0.5;
    }

    return { mid, side };
  }

  /**
   * 🎯 CLASSIFICAR IMAGEM ESTÉREO
   * @param {number} correlation - Correlação
   * @param {number} width - Largura
   * @param {number} balance - Balanceamento
   * @returns {string} - Classificação
   */
  classifyStereoImage(correlation, width, balance) {
    if (Math.abs(balance) > 0.5) {
      return 'UNBALANCED';
    } else if (correlation > 0.9 && width < 0.1) {
      return 'MONO';
    } else if (correlation < -0.5) {
      return 'OUT_OF_PHASE';
    } else if (width > 0.7 && correlation > 0.1 && correlation < 0.8) {
      return 'WIDE_STEREO';
    } else if (width > 0.3 && correlation > 0.4) {
      return 'STEREO';
    } else {
      return 'NARROW_STEREO';
    }
  }
}

/**
 * 🎯 FUNÇÃO PRINCIPAL - Interface da Fase 5.3
 * @param {Object} segmentedAudio - Saída da temporal-segmentation.js (Fase 5.2)
 * @returns {Object} - Métricas core calculadas
 */
export async function calculateCoreMetrics(segmentedAudio) {
  const processor = new CoreMetricsProcessor();
  return await processor.processMetrics(segmentedAudio);
}

/**
 * 🎯 FUNÇÃO DE CONVENIÊNCIA - Pipeline 5.1 + 5.2 + 5.3
 * @param {Buffer} fileBuffer - Buffer do arquivo de áudio
 * @param {string} filename - Nome do arquivo
 * @returns {Object} - Pipeline completo até métricas core
 */
export async function processAudioWithCoreMetrics(fileBuffer, filename) {
  // Importações dinâmicas para evitar dependências circulares
  const { decodeAudioFile } = await import('./audio-decoder.js');
  const { segmentAudioTemporal } = await import('./temporal-segmentation.js');
  
  console.log('🚀 Iniciando pipeline completo 5.1 + 5.2 + 5.3...');
  
  try {
    // Fase 5.1: Decodificação
    const audioData = await decodeAudioFile(fileBuffer, filename);
    
    // Fase 5.2: Segmentação temporal
    const segmentedData = segmentAudioTemporal(audioData);
    
    // Preservar dados originais para LUFS e True Peak
    segmentedData.originalLeft = audioData.leftChannel;
    segmentedData.originalRight = audioData.rightChannel;
    
    // Fase 5.3: Métricas core
    const metricsData = await calculateCoreMetrics(segmentedData);
    
    return {
      phase1: audioData,
      phase2: segmentedData,
      phase3: metricsData,
      pipeline: {
        version: '5.3',
        phases: ['5.1-decoding', '5.2-temporal-segmentation', '5.3-core-metrics'],
        totalProcessingTime: (metricsData._metadata?.processingTime || 0) + 
                           (segmentedData._metadata?.processingTime || 0) +
                           (audioData._metadata?.processingTime || 0)
      }
    };
    
  } catch (error) {
    console.error('❌ Erro no pipeline 5.1+5.2+5.3:', error.message);
    throw error;
  }
}

// Exportar configurações para testes
export { CORE_METRICS_CONFIG, CoreMetricsProcessor };

console.log('📦 Core Metrics (Fase 5.3) carregado - FFT, LUFS ITU-R BS.1770-4, True Peak 4x');
