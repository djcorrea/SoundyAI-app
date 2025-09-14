/**
 * 🎯 AUDITORIA COMPLETA: PRECISÃO E QUALIDADE DAS MÉTRICAS DE ÁUDIO
 * 
 * Instrumentação detalhada do pipeline para identificar:
 * - Valores exagerados ou incoerentes
 * - Métricas com fallback/parciais
 * - Falta de normalização
 * - Algoritmos descalibrados
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Pipeline de áudio
import { processAudioComplete } from './work/api/audio/pipeline-complete.js';
import { calculateCoreMetrics } from './work/api/audio/core-metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 🔍 INSTRUMENTAÇÃO DE MÉTRICAS
 */
class MetricsAuditor {
  constructor() {
    this.auditData = {
      summary: {},
      metrics: {},
      problems: [],
      recommendations: [],
      comparisons: {},
      rawValues: {}
    };
  }

  /**
   * 📊 Instrumentar entrada dos dados de áudio
   */
  auditAudioInput(audioBuffer, fileName) {
    console.log(`\n🎵 AUDITANDO ENTRADA DE ÁUDIO: ${fileName}`);
    console.log('=' .repeat(60));
    
    const input = {
      fileName,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
      leftChannel: {
        length: audioBuffer.getChannelData(0).length,
        min: Math.min(...audioBuffer.getChannelData(0)),
        max: Math.max(...audioBuffer.getChannelData(0)),
        hasNaN: audioBuffer.getChannelData(0).some(v => !isFinite(v)),
        hasClipping: audioBuffer.getChannelData(0).some(v => Math.abs(v) >= 0.99)
      },
      rightChannel: audioBuffer.numberOfChannels > 1 ? {
        length: audioBuffer.getChannelData(1).length,
        min: Math.min(...audioBuffer.getChannelData(1)),
        max: Math.max(...audioBuffer.getChannelData(1)),
        hasNaN: audioBuffer.getChannelData(1).some(v => !isFinite(v)),
        hasClipping: audioBuffer.getChannelData(1).some(v => Math.abs(v) >= 0.99)
      } : null
    };

    console.log(`├─ Sample Rate: ${input.sampleRate}Hz`);
    console.log(`├─ Duration: ${input.duration.toFixed(2)}s`);
    console.log(`├─ Channels: ${input.numberOfChannels}`);
    console.log(`├─ Samples: ${input.length}`);
    console.log(`├─ Left Range: [${input.leftChannel.min.toFixed(6)}, ${input.leftChannel.max.toFixed(6)}]`);
    if (input.rightChannel) {
      console.log(`├─ Right Range: [${input.rightChannel.min.toFixed(6)}, ${input.rightChannel.max.toFixed(6)}]`);
    }
    console.log(`├─ Has NaN: ${input.leftChannel.hasNaN || (input.rightChannel?.hasNaN || false)}`);
    console.log(`└─ Has Clipping: ${input.leftChannel.hasClipping || (input.rightChannel?.hasClipping || false)}`);

    this.auditData.rawValues.audioInput = input;
    
    // Verificar problemas de entrada
    if (input.sampleRate !== 48000) {
      this.auditData.problems.push({
        type: 'SAMPLE_RATE_MISMATCH',
        severity: 'WARNING',
        description: `Sample rate ${input.sampleRate}Hz não é o padrão 48kHz`,
        impact: 'Pode afetar cálculos de LUFS e True Peak'
      });
    }

    if (input.leftChannel.hasNaN || (input.rightChannel?.hasNaN || false)) {
      this.auditData.problems.push({
        type: 'NAN_VALUES',
        severity: 'CRITICAL',
        description: 'Áudio contém valores NaN',
        impact: 'Corrompe todos os cálculos subsequentes'
      });
    }

    return input;
  }

  /**
   * 🔧 Instrumentar segmentação temporal
   */
  auditTemporalSegmentation(segmentedAudio) {
    console.log(`\n⏱️ AUDITANDO SEGMENTAÇÃO TEMPORAL`);
    console.log('=' .repeat(60));

    const segmentation = {
      framesFFT: {
        count: segmentedAudio.framesFFT?.count || 0,
        frameSize: segmentedAudio.framesFFT?.left?.[0]?.length || 0,
        hopSize: 1024, // Assumindo hop size padrão
        overlap: 0.75
      },
      framesRMS: {
        count: segmentedAudio.framesRMS?.count || 0,
        frameSize: segmentedAudio.framesRMS?.frameSize || 0,
        windowMs: segmentedAudio.framesRMS?.windowMs || 0
      },
      originalChannels: {
        leftLength: segmentedAudio.leftChannel?.length || 0,
        rightLength: segmentedAudio.rightChannel?.length || 0
      }
    };

    console.log(`├─ FFT Frames: ${segmentation.framesFFT.count}`);
    console.log(`├─ FFT Frame Size: ${segmentation.framesFFT.frameSize}`);
    console.log(`├─ FFT Hop Size: ${segmentation.framesFFT.hopSize} (${(segmentation.framesFFT.overlap * 100).toFixed(1)}% overlap)`);
    console.log(`├─ RMS Frames: ${segmentation.framesRMS.count}`);
    console.log(`├─ RMS Window: ${segmentation.framesRMS.windowMs}ms`);
    console.log(`└─ Channel Lengths: L=${segmentation.originalChannels.leftLength}, R=${segmentation.originalChannels.rightLength}`);

    this.auditData.rawValues.segmentation = segmentation;

    // Verificar problemas de segmentação
    if (segmentation.framesFFT.frameSize !== 4096) {
      this.auditData.problems.push({
        type: 'FFT_SIZE_INCORRECT',
        severity: 'ERROR',
        description: `FFT size ${segmentation.framesFFT.frameSize} não é 4096`,
        impact: 'Resolução espectral incorreta'
      });
    }

    if (segmentation.framesFFT.count === 0) {
      this.auditData.problems.push({
        type: 'NO_FFT_FRAMES',
        severity: 'CRITICAL',
        description: 'Nenhum frame FFT gerado',
        impact: 'Análise espectral impossível'
      });
    }

    return segmentation;
  }

  /**
   * 🎛️ Instrumentar cálculos FFT e espectro
   */
  auditFFTMetrics(fftResults) {
    console.log(`\n🌊 AUDITANDO MÉTRICAS FFT E ESPECTRO`);
    console.log('=' .repeat(60));

    const fft = {
      totalFrames: fftResults.left?.length || 0,
      magnitudeSpectrum: {
        count: fftResults.magnitudeSpectrum?.length || 0,
        averageMagnitude: 0,
        maxMagnitude: 0,
        minMagnitude: 0,
        hasZeros: false,
        hasInfinite: false
      },
      spectralFeatures: {
        centroid: {
          values: fftResults.spectralCentroid || [],
          avg: 0,
          min: 0,
          max: 0
        },
        rolloff: {
          values: fftResults.spectralRolloff || [],
          avg: 0,
          min: 0,
          max: 0
        },
        flatness: {
          values: fftResults.spectralFlatness || [],
          avg: 0,
          min: 0,
          max: 0
        }
      }
    };

    if (fftResults.magnitudeSpectrum && fftResults.magnitudeSpectrum.length > 0) {
      const allMagnitudes = fftResults.magnitudeSpectrum.flat();
      fft.magnitudeSpectrum.averageMagnitude = allMagnitudes.reduce((a, b) => a + b, 0) / allMagnitudes.length;
      fft.magnitudeSpectrum.maxMagnitude = Math.max(...allMagnitudes);
      fft.magnitudeSpectrum.minMagnitude = Math.min(...allMagnitudes);
      fft.magnitudeSpectrum.hasZeros = allMagnitudes.some(v => v === 0);
      fft.magnitudeSpectrum.hasInfinite = allMagnitudes.some(v => !isFinite(v));
    }

    // Calcular estatísticas das features espectrais
    ['centroid', 'rolloff', 'flatness'].forEach(feature => {
      const values = fft.spectralFeatures[feature].values;
      if (values.length > 0) {
        fft.spectralFeatures[feature].avg = values.reduce((a, b) => a + b, 0) / values.length;
        fft.spectralFeatures[feature].min = Math.min(...values);
        fft.spectralFeatures[feature].max = Math.max(...values);
      }
    });

    console.log(`├─ Frames Processados: ${fft.totalFrames}`);
    console.log(`├─ Magnitude Spectrum:`);
    console.log(`│  ├─ Count: ${fft.magnitudeSpectrum.count}`);
    console.log(`│  ├─ Avg: ${fft.magnitudeSpectrum.averageMagnitude.toFixed(6)}`);
    console.log(`│  ├─ Range: [${fft.magnitudeSpectrum.minMagnitude.toFixed(6)}, ${fft.magnitudeSpectrum.maxMagnitude.toFixed(6)}]`);
    console.log(`│  ├─ Has Zeros: ${fft.magnitudeSpectrum.hasZeros}`);
    console.log(`│  └─ Has Infinite: ${fft.magnitudeSpectrum.hasInfinite}`);
    console.log(`├─ Spectral Centroid: ${fft.spectralFeatures.centroid.avg.toFixed(2)} [${fft.spectralFeatures.centroid.min.toFixed(2)}-${fft.spectralFeatures.centroid.max.toFixed(2)}]`);
    console.log(`├─ Spectral Rolloff: ${fft.spectralFeatures.rolloff.avg.toFixed(2)} [${fft.spectralFeatures.rolloff.min.toFixed(2)}-${fft.spectralFeatures.rolloff.max.toFixed(2)}]`);
    console.log(`└─ Spectral Flatness: ${fft.spectralFeatures.flatness.avg.toFixed(4)} [${fft.spectralFeatures.flatness.min.toFixed(4)}-${fft.spectralFeatures.flatness.max.toFixed(4)}]`);

    this.auditData.rawValues.fft = fft;

    // Verificar problemas FFT
    if (fft.magnitudeSpectrum.hasInfinite) {
      this.auditData.problems.push({
        type: 'FFT_INFINITE_VALUES',
        severity: 'CRITICAL',
        description: 'FFT contém valores infinitos',
        impact: 'Corrompe análise espectral'
      });
    }

    if (fft.magnitudeSpectrum.averageMagnitude === 0) {
      this.auditData.problems.push({
        type: 'FFT_ZERO_MAGNITUDE',
        severity: 'ERROR',
        description: 'Magnitude FFT média é zero',
        impact: 'Possível silêncio ou erro de cálculo'
      });
    }

    return fft;
  }

  /**
   * 🔊 Instrumentar métricas LUFS
   */
  auditLUFSMetrics(lufsMetrics) {
    console.log(`\n🔊 AUDITANDO MÉTRICAS LUFS ITU-R BS.1770-4`);
    console.log('=' .repeat(60));

    const lufs = {
      integrated: lufsMetrics.integrated || lufsMetrics.lufs_integrated,
      shortTerm: lufsMetrics.shortTerm || lufsMetrics.lufs_short_term,
      momentary: lufsMetrics.momentary || lufsMetrics.lufs_momentary,
      lra: lufsMetrics.lra,
      ranges: {
        integrated: { min: -80, max: 20, realistic: [-60, 0] },
        shortTerm: { min: -80, max: 20, realistic: [-60, 0] },
        momentary: { min: -80, max: 20, realistic: [-60, 0] },
        lra: { min: 0, max: 50, realistic: [1, 25] }
      }
    };

    console.log(`├─ LUFS Integrated: ${lufs.integrated?.toFixed(2) || 'N/A'} LUFS`);
    console.log(`├─ LUFS Short-term: ${lufs.shortTerm?.toFixed(2) || 'N/A'} LUFS`);
    console.log(`├─ LUFS Momentary: ${lufs.momentary?.toFixed(2) || 'N/A'} LUFS`);
    console.log(`└─ LRA (Loudness Range): ${lufs.lra?.toFixed(2) || 'N/A'} LU`);

    this.auditData.rawValues.lufs = lufs;

    // Verificar problemas LUFS
    Object.keys(lufs.ranges).forEach(metric => {
      const value = lufs[metric];
      const range = lufs.ranges[metric];
      
      if (value !== undefined && value !== null) {
        if (value < range.min || value > range.max) {
          this.auditData.problems.push({
            type: 'LUFS_OUT_OF_RANGE',
            severity: 'ERROR',
            description: `${metric} LUFS ${value.toFixed(2)} fora do range técnico [${range.min}, ${range.max}]`,
            impact: 'Valor fisicamente impossível'
          });
        } else if (value < range.realistic[0] || value > range.realistic[1]) {
          this.auditData.problems.push({
            type: 'LUFS_UNREALISTIC',
            severity: 'WARNING',
            description: `${metric} LUFS ${value.toFixed(2)} fora do range realista [${range.realistic[0]}, ${range.realistic[1]}]`,
            impact: 'Possível erro de calibração'
          });
        }
      }
    });

    if (lufs.lra === 0) {
      this.auditData.problems.push({
        type: 'LRA_ZERO',
        severity: 'WARNING',
        description: 'LRA (Loudness Range) é exatamente 0',
        impact: 'Possível bug no gating ou áudio com dinâmica zero'
      });
    }

    return lufs;
  }

  /**
   * 🏔️ Instrumentar True Peak
   */
  auditTruePeakMetrics(truePeakMetrics) {
    console.log(`\n🏔️ AUDITANDO TRUE PEAK (4× OVERSAMPLING)`);
    console.log('=' .repeat(60));

    const truePeak = {
      dbtp: truePeakMetrics.maxDbtp || truePeakMetrics.true_peak_dbtp,
      linear: truePeakMetrics.maxLinear || truePeakMetrics.true_peak_linear,
      ranges: {
        dbtp: { min: -100, max: 20, realistic: [-60, 3] },
        linear: { min: 0, max: 10, realistic: [0.001, 1.5] }
      },
      fixedValues: {
        isFixedMinus60: false,
        isFixedZero: false
      }
    };

    // Detectar valores fixos suspeitos
    truePeak.fixedValues.isFixedMinus60 = Math.abs(truePeak.dbtp + 60) < 0.001;
    truePeak.fixedValues.isFixedZero = Math.abs(truePeak.linear) < 0.000001;

    console.log(`├─ True Peak dBTP: ${truePeak.dbtp?.toFixed(2) || 'N/A'} dBTP`);
    console.log(`├─ True Peak Linear: ${truePeak.linear?.toFixed(6) || 'N/A'}`);
    console.log(`├─ Suspeito -60dB fixo: ${truePeak.fixedValues.isFixedMinus60}`);
    console.log(`└─ Suspeito zero fixo: ${truePeak.fixedValues.isFixedZero}`);

    this.auditData.rawValues.truePeak = truePeak;

    // Verificar problemas True Peak
    if (truePeak.fixedValues.isFixedMinus60) {
      this.auditData.problems.push({
        type: 'TRUEPEAK_FIXED_MINUS_60',
        severity: 'ERROR',
        description: 'True Peak fixo em -60dBTP',
        impact: 'Possível fallback ou erro no oversampling'
      });
    }

    if (truePeak.fixedValues.isFixedZero) {
      this.auditData.problems.push({
        type: 'TRUEPEAK_FIXED_ZERO',
        severity: 'ERROR',
        description: 'True Peak linear fixo em zero',
        impact: 'Possível erro no cálculo ou áudio silencioso'
      });
    }

    if (truePeak.dbtp && (truePeak.dbtp < truePeak.ranges.dbtp.min || truePeak.dbtp > truePeak.ranges.dbtp.max)) {
      this.auditData.problems.push({
        type: 'TRUEPEAK_OUT_OF_RANGE',
        severity: 'ERROR',
        description: `True Peak ${truePeak.dbtp.toFixed(2)}dBTP fora do range técnico`,
        impact: 'Valor fisicamente impossível'
      });
    }

    return truePeak;
  }

  /**
   * 🎭 Instrumentar análise stereo
   */
  auditStereoMetrics(stereoMetrics) {
    console.log(`\n🎭 AUDITANDO ANÁLISE STEREO`);
    console.log('=' .repeat(60));

    const stereo = {
      correlation: stereoMetrics.correlation,
      width: stereoMetrics.width,
      phase: stereoMetrics.phase,
      ranges: {
        correlation: { min: -1, max: 1, realistic: [-0.5, 1] },
        width: { min: 0, max: 2, realistic: [0.5, 1.5] },
        phase: { min: -180, max: 180, realistic: [-90, 90] }
      },
      fixedValues: {
        correlationZero: false,
        correlationOne: false
      }
    };

    stereo.fixedValues.correlationZero = Math.abs(stereo.correlation) < 0.0001;
    stereo.fixedValues.correlationOne = Math.abs(Math.abs(stereo.correlation) - 1) < 0.0001;

    console.log(`├─ Correlação Stereo: ${stereo.correlation?.toFixed(4) || 'N/A'}`);
    console.log(`├─ Largura Stereo: ${stereo.width?.toFixed(4) || 'N/A'}`);
    console.log(`├─ Fase: ${stereo.phase?.toFixed(2) || 'N/A'}°`);
    console.log(`├─ Correlação zero suspeita: ${stereo.fixedValues.correlationZero}`);
    console.log(`└─ Correlação ±1 suspeita: ${stereo.fixedValues.correlationOne}`);

    this.auditData.rawValues.stereo = stereo;

    // Verificar problemas stereo
    if (stereo.fixedValues.correlationZero) {
      this.auditData.problems.push({
        type: 'STEREO_CORRELATION_ZERO',
        severity: 'WARNING',
        description: 'Correlação stereo exatamente zero',
        impact: 'Possível array vazio ou erro de cálculo'
      });
    }

    return stereo;
  }

  /**
   * 📊 Instrumentar scoring final
   */
  auditScoring(finalData) {
    console.log(`\n📊 AUDITANDO SCORING EQUAL WEIGHT V3`);
    console.log('=' .repeat(60));

    const scoring = {
      finalScore: finalData.score,
      classification: finalData.classification,
      metrics: finalData.metrics || {},
      weights: {
        equalWeight: true,
        suspectedInvalidMetrics: []
      }
    };

    console.log(`├─ Score Final: ${scoring.finalScore?.toFixed(1) || 'N/A'}/10`);
    console.log(`├─ Classificação: ${scoring.classification || 'N/A'}`);
    console.log(`└─ Métricas no Score: ${Object.keys(scoring.metrics).length}`);

    // Verificar se métricas inválidas estão entrando no score
    Object.keys(scoring.metrics).forEach(metric => {
      const value = scoring.metrics[metric];
      if (typeof value === 'number') {
        if (!isFinite(value)) {
          scoring.weights.suspectedInvalidMetrics.push({
            metric,
            value,
            issue: 'Non-finite value'
          });
        } else if (value === 0) {
          scoring.weights.suspectedInvalidMetrics.push({
            metric,
            value,
            issue: 'Zero value (possibly fallback)'
          });
        }
      }
    });

    this.auditData.rawValues.scoring = scoring;

    if (scoring.weights.suspectedInvalidMetrics.length > 0) {
      this.auditData.problems.push({
        type: 'INVALID_METRICS_IN_SCORE',
        severity: 'WARNING',
        description: `${scoring.weights.suspectedInvalidMetrics.length} métricas possivelmente inválidas no score`,
        impact: 'Score pode estar mascarado por fallbacks',
        details: scoring.weights.suspectedInvalidMetrics
      });
    }

    return scoring;
  }

  /**
   * 📋 Gerar relatório final
   */
  generateReport() {
    const timestamp = new Date().toISOString();
    
    this.auditData.summary = {
      timestamp,
      totalProblems: this.auditData.problems.length,
      criticalProblems: this.auditData.problems.filter(p => p.severity === 'CRITICAL').length,
      errorProblems: this.auditData.problems.filter(p => p.severity === 'ERROR').length,
      warningProblems: this.auditData.problems.filter(p => p.severity === 'WARNING').length,
      overallHealth: this.auditData.problems.filter(p => p.severity === 'CRITICAL').length === 0 ? 'FUNCTIONAL' : 'CRITICAL_ISSUES'
    };

    return this.auditData;
  }

  /**
   * 💾 Salvar relatório
   */
  async saveReport(filename = 'AUDITORIA_PRECISAO_METRICAS.json') {
    const reportData = this.generateReport();
    await fs.promises.writeFile(filename, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Relatório salvo em: ${filename}`);
    return filename;
  }
}

/**
 * 🚀 Execução principal da auditoria
 */
async function executarAuditoriaCompleta() {
  const auditor = new MetricsAuditor();
  
  console.log('🎯 INICIANDO AUDITORIA COMPLETA DE PRECISÃO DAS MÉTRICAS');
  console.log('=' .repeat(80));
  
  try {
    // Gerar áudio sintético para teste
    console.log('🎵 Gerando áudio sintético para auditoria...');
    const audioBuffer = generateSyntheticAudio();
    auditor.auditAudioInput(audioBuffer, 'synthetic_audio');

    // Como o pipeline completo precisa de um buffer de arquivo, vamos usar
    // uma abordagem direta com o CoreMetricsProcessor
    console.log('\n⏱️ SIMULANDO SEGMENTAÇÃO TEMPORAL...');
    const segmentedAudio = createMockSegmentedAudio(audioBuffer);
    auditor.auditTemporalSegmentation(segmentedAudio);

    // FASE 3: Core Metrics
    console.log('\n🎛️ FASE 3: CORE METRICS');
    const coreMetrics = await calculateCoreMetrics(segmentedAudio, {
      jobId: 'audit-test',
      fileName: 'synthetic_audio'
    });

    // Auditar cada conjunto de métricas
    auditor.auditFFTMetrics(coreMetrics.fft);
    auditor.auditLUFSMetrics(coreMetrics.lufs);
    auditor.auditTruePeakMetrics(coreMetrics.truePeak);
    auditor.auditStereoMetrics(coreMetrics.stereo);

    // Simular scoring
    console.log('\n📊 SIMULANDO SCORING...');
    const mockFinalData = createMockFinalData(coreMetrics);
    auditor.auditScoring(mockFinalData);

    // Gerar e salvar relatório
    const reportFile = await auditor.saveReport();
    
    // Imprimir resumo
    console.log('\n📋 RESUMO DA AUDITORIA');
    console.log('=' .repeat(60));
    console.log(`├─ Total de Problemas: ${auditor.auditData.summary.totalProblems}`);
    console.log(`├─ Críticos: ${auditor.auditData.summary.criticalProblems}`);
    console.log(`├─ Erros: ${auditor.auditData.summary.errorProblems}`);
    console.log(`├─ Avisos: ${auditor.auditData.summary.warningProblems}`);
    console.log(`└─ Status Geral: ${auditor.auditData.summary.overallHealth}`);

    if (auditor.auditData.problems.length > 0) {
      console.log('\n🚨 PROBLEMAS ENCONTRADOS:');
      auditor.auditData.problems.forEach((problem, index) => {
        console.log(`${index + 1}. [${problem.severity}] ${problem.type}`);
        console.log(`   ${problem.description}`);
        console.log(`   Impacto: ${problem.impact}`);
        if (problem.details) {
          console.log(`   Detalhes: ${JSON.stringify(problem.details, null, 2)}`);
        }
      });
    }

    return auditor.auditData;

  } catch (error) {
    console.error('❌ Erro na auditoria:', error.message);
    auditor.auditData.problems.push({
      type: 'AUDIT_EXECUTION_ERROR',
      severity: 'CRITICAL',
      description: `Falha na execução da auditoria: ${error.message}`,
      impact: 'Auditoria incompleta'
    });
    
    await auditor.saveReport('AUDITORIA_PRECISAO_METRICAS_ERROR.json');
    throw error;
  }
}

/**
 * 🎼 Gerar áudio sintético para teste
 */
function generateSyntheticAudio() {
  const sampleRate = 48000;
  const duration = 2; // 2 segundos
  const numberOfChannels = 2;
  const length = sampleRate * duration;

  // Simular AudioBuffer
  const audioBuffer = {
    sampleRate,
    duration,
    numberOfChannels,
    length,
    getChannelData: function(channel) {
      const data = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        // Gerar sine wave com algumas frequências diferentes para cada canal
        const t = i / sampleRate;
        if (channel === 0) {
          data[i] = 0.5 * Math.sin(2 * Math.PI * 440 * t) + // A4
                   0.3 * Math.sin(2 * Math.PI * 880 * t) + // A5
                   0.1 * Math.sin(2 * Math.PI * 1760 * t); // A6
        } else {
          data[i] = 0.5 * Math.sin(2 * Math.PI * 880 * t) + // A5
                   0.3 * Math.sin(2 * Math.PI * 440 * t) + // A4
                   0.1 * Math.sin(2 * Math.PI * 220 * t); // A3
        }
        // Adicionar envelope para evitar clicks
        const envelope = Math.sin(Math.PI * t / duration);
        data[i] *= envelope;
      }
      return data;
    }
  };

  return audioBuffer;
}

/**
 * 🔧 Criar dados segmentados simulados
 */
function createMockSegmentedAudio(audioBuffer) {
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);
  
  // Simular frames FFT (4096 samples, hop 1024)
  const frameSize = 4096;
  const hopSize = 1024;
  const framesFFT = {
    left: [],
    right: [],
    count: 0
  };

  for (let i = 0; i < leftChannel.length - frameSize; i += hopSize) {
    const leftFrame = leftChannel.slice(i, i + frameSize);
    const rightFrame = rightChannel.slice(i, i + frameSize);
    framesFFT.left.push(leftFrame);
    framesFFT.right.push(rightFrame);
    framesFFT.count++;
  }

  // Simular frames RMS
  const framesRMS = {
    left: [],
    right: [],
    count: framesFFT.count,
    frameSize: frameSize,
    windowMs: (frameSize / audioBuffer.sampleRate) * 1000
  };

  return {
    leftChannel,
    rightChannel,
    framesFFT,
    framesRMS,
    metadata: {
      originalSampleRate: audioBuffer.sampleRate,
      originalDuration: audioBuffer.duration
    }
  };
}

/**
 * 📊 Simular dados finais para scoring
 */
function createMockFinalData(coreMetrics) {
  return {
    score: 8.5,
    classification: "Muito Bom",
    metrics: {
      lufs_integrated: coreMetrics.lufs?.integrated || -23,
      true_peak_dbtp: coreMetrics.truePeak?.maxDbtp || -3,
      stereo_correlation: coreMetrics.stereo?.correlation || 0.7,
      spectral_centroid: coreMetrics.fft?.spectralCentroid?.[0] || 1500
    }
  };
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  executarAuditoriaCompleta().catch(console.error);
}

export { MetricsAuditor, executarAuditoriaCompleta };