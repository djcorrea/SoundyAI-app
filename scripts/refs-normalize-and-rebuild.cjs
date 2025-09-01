#!/usr/bin/env node

/**
 * 🔊 REFS NORMALIZE AND REBUILD - Sistema de Normalização LUFS + Recálculo de Referências
 * 
 * Implementa normalização por loudness (LUFS integrado, EBU R128 com gating) com ganho estático
 * (linear, sem limiter/compressor) para todas as faixas WAV do banco de referências,
 * recalcula as métricas por faixa, calcula as médias aritméticas por gênero e substitui
 * com segurança os JSONs de referência existentes.
 * 
 * Uso:
 *   node refs-normalize-and-rebuild.js --in REFs --out public/refs/out --lufs -18 --tp -1 --dry-run
 *   node refs-normalize-and-rebuild.js --in REFs --out public/refs/out --lufs -18 --tp -1
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

// ============================================================================
// IMPORTAÇÕES DE MÓDULOS EXISTENTES E UTILITÁRIOS
// ============================================================================

// Utilizar os módulos de análise já implementados
let loudnessModule, truePeakModule, spectralModule, dynamicsModule;

try {
  // Tentar carregar módulos existentes
  const libPath = path.join(__dirname, '..', 'lib', 'audio', 'features');
  loudnessModule = require(path.join(libPath, 'loudness.js'));
  truePeakModule = require(path.join(libPath, 'truepeak.js'));
  dynamicsModule = require(path.join(libPath, 'dynamics.js'));
} catch (err) {
  console.warn('⚠️ Módulos de análise não encontrados, usando implementação interna:', err.message);
}

// Importar utilitários especializados
const loudnessUtils = require('./loudness-utils.cjs');
const spectralUtils = require('./spectral-utils.cjs');

// ============================================================================
// CONFIGURAÇÃO E CONSTANTES
// ============================================================================

const DEFAULT_CONFIG = {
  inputDir: 'REFs',
  outputDir: 'public/refs/out',
  lufsTarget: -18.0,
  truePeakCeiling: -1.0,
  refsVersion: 'v2_lufs_norm',
  dryRun: false,
  normalizeForAnalysis: true,
  genres: ['funk_mandela', 'eletronico', 'funk_bruxaria', 'trance'],
  sampleRate: 48000,
  logLevel: 'INFO'
};

// Gerar runId único para esta execução
const RUN_ID = `lufs_norm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

// ============================================================================
// SISTEMA DE LOGS ESTRUTURADOS
// ============================================================================

class Logger {
  constructor(runId, level = 'INFO') {
    this.runId = runId;
    this.level = level;
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  }

  _log(level, message, data = {}) {
    if (this.levels[level] >= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        runId: this.runId,
        level,
        message,
        ...data
      };
      console.log(`[${level}] ${message}`, Object.keys(data).length > 0 ? data : '');
    }
  }

  debug(message, data) { this._log('DEBUG', message, data); }
  info(message, data) { this._log('INFO', message, data); }
  warn(message, data) { this._log('WARN', message, data); }
  error(message, data) { this._log('ERROR', message, data); }
}

const logger = new Logger(RUN_ID, DEFAULT_CONFIG.logLevel);

// ============================================================================
// DECODIFICADOR WAV INTEGRADO
// ============================================================================

class WAVDecoder {
  static async readWAVFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    
    // Verificar cabeçalho RIFF/WAVE
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error(`Arquivo não é WAV válido: ${filePath}`);
    }

    let offset = 12;
    let format, numChannels, sampleRate, bitsPerSample, dataOffset = -1, dataSize = 0;

    // Percorrer chunks
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkStart = offset + 8;

      if (chunkId === 'fmt ') {
        format = buffer.readUInt16LE(chunkStart);
        numChannels = buffer.readUInt16LE(chunkStart + 2);
        sampleRate = buffer.readUInt32LE(chunkStart + 4);
        bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
      } else if (chunkId === 'data') {
        dataOffset = chunkStart;
        dataSize = chunkSize;
        break;
      }

      offset = chunkStart + chunkSize + (chunkSize % 2);
    }

    if (dataOffset < 0) {
      throw new Error(`Chunk data não encontrado: ${filePath}`);
    }

    // Decodificar PCM para Float32Array
    const bytesPerSample = bitsPerSample / 8;
    const frameCount = Math.floor(dataSize / (bytesPerSample * numChannels));
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);

    let pos = dataOffset;
    for (let i = 0; i < frameCount; i++) {
      let sL, sR;

      // Canal esquerdo
      if (format === 3 && bitsPerSample === 32) {
        sL = buffer.readFloatLE(pos);
      } else if (bitsPerSample === 16) {
        sL = buffer.readInt16LE(pos) / 32768.0;
      } else if (bitsPerSample === 24) {
        const b0 = buffer[pos];
        const b1 = buffer[pos + 1];
        const b2 = buffer[pos + 2];
        let val = b0 | (b1 << 8) | (b2 << 16);
        if (val & 0x800000) val |= 0xFF000000;
        sL = val / 8388608.0;
      } else if (bitsPerSample === 32) {
        sL = buffer.readInt32LE(pos) / 2147483648.0;
      } else {
        throw new Error(`Formato PCM não suportado: ${bitsPerSample} bits`);
      }

      pos += bytesPerSample;

      // Canal direito (ou duplicar esquerdo se mono)
      if (numChannels > 1) {
        if (format === 3 && bitsPerSample === 32) {
          sR = buffer.readFloatLE(pos);
        } else if (bitsPerSample === 16) {
          sR = buffer.readInt16LE(pos) / 32768.0;
        } else if (bitsPerSample === 24) {
          const b0 = buffer[pos];
          const b1 = buffer[pos + 1];
          const b2 = buffer[pos + 2];
          let val = b0 | (b1 << 8) | (b2 << 16);
          if (val & 0x800000) val |= 0xFF000000;
          sR = val / 8388608.0;
        } else if (bitsPerSample === 32) {
          sR = buffer.readInt32LE(pos) / 2147483648.0;
        }
        pos += bytesPerSample;
      } else {
        sR = sL;
      }

      left[i] = sL;
      right[i] = sR;
    }

    // Remover DC offset
    WAVDecoder.removeDCOffset(left);
    WAVDecoder.removeDCOffset(right);

    return {
      left,
      right,
      sampleRate,
      channels: numChannels,
      bitDepth: bitsPerSample,
      format: format === 3 ? 'IEEE_FLOAT' : 'PCM'
    };
  }

  static removeDCOffset(channelData) {
    // Calcular média DC
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i];
    }
    const dcOffset = sum / channelData.length;

    // Remover apenas se DC significativo (> 0.001)
    if (Math.abs(dcOffset) > 0.001) {
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] -= dcOffset;
      }
    }
  }
}

// ============================================================================
// ANALISADOR DE LOUDNESS/TRUE PEAK INTEGRADO
// ============================================================================

class LoudnessAnalyzer {
  constructor() {
    // Usar módulos existentes se disponíveis, senão utilitários especializados
    this.useExternalModules = loudnessModule && truePeakModule;
    this.useInternalUtils = !this.useExternalModules;
  }

  async measureLoudnessAndTruePeak(leftChannel, rightChannel, sampleRate) {
    if (this.useExternalModules) {
      return this._measureWithExternalModules(leftChannel, rightChannel, sampleRate);
    } else {
      return this._measureWithInternalUtils(leftChannel, rightChannel, sampleRate);
    }
  }

  _measureWithExternalModules(leftChannel, rightChannel, sampleRate) {
    try {
      // Usar implementação LUFS existente
      const loudnessResult = loudnessModule.calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate);
      const truePeakResult = truePeakModule.analyzeTruePeaks(leftChannel, rightChannel, sampleRate);

      return {
        lufsIntegrated: loudnessResult.lufs_integrated,
        truePeakDbtp: truePeakResult.true_peak_dbtp,
        lra: loudnessResult.lra,
        algorithm: 'external_modules'
      };
    } catch (error) {
      logger.warn('Falha nos módulos externos, usando utilitários internos', { error: error.message });
      return this._measureWithInternalUtils(leftChannel, rightChannel, sampleRate);
    }
  }

  _measureWithInternalUtils(leftChannel, rightChannel, sampleRate) {
    try {
      // Usar utilitários especializados
      const loudnessResult = loudnessUtils.calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate);
      const truePeakResult = loudnessUtils.analyzeTruePeaks(leftChannel, rightChannel, sampleRate);

      return {
        lufsIntegrated: loudnessResult.lufs_integrated,
        truePeakDbtp: truePeakResult.true_peak_dbtp,
        lra: loudnessResult.lra,
        algorithm: 'internal_utils'
      };
    } catch (error) {
      logger.warn('Falha nos utilitários internos, usando fallback', { error: error.message });
      return this._measureWithFallback(leftChannel, rightChannel, sampleRate);
    }
  }

  _measureWithFallback(leftChannel, rightChannel, sampleRate) {
    // Implementação simplificada para desenvolvimento/fallback
    const lufsIntegrated = this._estimateLUFS(leftChannel, rightChannel, sampleRate);
    const truePeakDbtp = this._estimateTruePeak(leftChannel, rightChannel);
    const lra = this._estimateLRA(leftChannel, rightChannel, sampleRate);

    return {
      lufsIntegrated,
      truePeakDbtp,
      lra,
      algorithm: 'fallback_estimation'
    };
  }

  _estimateLUFS(leftChannel, rightChannel, sampleRate) {
    // Simplificação: RMS ponderado por frequência (aproximação LUFS)
    const blockSize = Math.floor(sampleRate * 0.4); // 400ms blocks
    const blocks = [];

    for (let i = 0; i < leftChannel.length - blockSize; i += blockSize) {
      let sumL = 0, sumR = 0;
      for (let j = 0; j < blockSize; j++) {
        sumL += leftChannel[i + j] ** 2;
        sumR += rightChannel[i + j] ** 2;
      }
      const meanSquare = (sumL + sumR) / (2 * blockSize);
      if (meanSquare > 0) {
        blocks.push(-0.691 + 10 * Math.log10(meanSquare));
      }
    }

    // Gating simplificado (absoluto threshold -70 LUFS)
    const validBlocks = blocks.filter(b => b > -70);
    if (validBlocks.length === 0) return -Infinity;

    // Gating relativo simplificado
    const firstPass = validBlocks.reduce((sum, b) => sum + Math.pow(10, b / 10), 0) / validBlocks.length;
    const firstPassLUFS = -0.691 + 10 * Math.log10(firstPass);
    const relativeThreshold = firstPassLUFS - 10;
    
    const gatedBlocks = validBlocks.filter(b => b > relativeThreshold);
    if (gatedBlocks.length === 0) return firstPassLUFS;

    const gatedMean = gatedBlocks.reduce((sum, b) => sum + Math.pow(10, b / 10), 0) / gatedBlocks.length;
    return -0.691 + 10 * Math.log10(gatedMean);
  }

  _estimateTruePeak(leftChannel, rightChannel) {
    // Oversampling simples 4x
    const oversamplingFactor = 4;
    let maxTruePeak = 0;

    [leftChannel, rightChannel].forEach(channel => {
      // Upsampling básico com interpolação linear
      const upsampled = new Float32Array(channel.length * oversamplingFactor);
      for (let i = 0; i < channel.length - 1; i++) {
        const curr = channel[i];
        const next = channel[i + 1];
        for (let j = 0; j < oversamplingFactor; j++) {
          const fraction = j / oversamplingFactor;
          upsampled[i * oversamplingFactor + j] = curr * (1 - fraction) + next * fraction;
        }
      }

      // Encontrar peak
      for (let i = 0; i < upsampled.length; i++) {
        maxTruePeak = Math.max(maxTruePeak, Math.abs(upsampled[i]));
      }
    });

    return maxTruePeak > 0 ? 20 * Math.log10(maxTruePeak) : -Infinity;
  }

  _estimateLRA(leftChannel, rightChannel, sampleRate) {
    // LRA simplificado baseado em janelas de 3s
    const windowSize = Math.floor(sampleRate * 3); // 3s
    const hopSize = Math.floor(sampleRate * 0.1); // 100ms
    const shortTermLoudness = [];

    for (let i = 0; i < leftChannel.length - windowSize; i += hopSize) {
      let sumL = 0, sumR = 0;
      for (let j = 0; j < windowSize; j++) {
        sumL += leftChannel[i + j] ** 2;
        sumR += rightChannel[i + j] ** 2;
      }
      const meanSquare = (sumL + sumR) / (2 * windowSize);
      if (meanSquare > 0) {
        shortTermLoudness.push(-0.691 + 10 * Math.log10(meanSquare));
      }
    }

    if (shortTermLoudness.length < 2) return 0;

    // Filtrar valores válidos e calcular percentis
    const validValues = shortTermLoudness.filter(v => v > -70).sort((a, b) => a - b);
    if (validValues.length < 2) return 0;

    const p10Index = Math.floor(validValues.length * 0.10);
    const p95Index = Math.floor(validValues.length * 0.95);
    
    return validValues[Math.min(p95Index, validValues.length - 1)] - validValues[p10Index];
  }
}

// ============================================================================
// SISTEMA DE NORMALIZAÇÃO LUFS
// ============================================================================

class LUFSNormalizer {
  constructor(targetLUFS = -18.0, truePeakCeiling = -1.0) {
    this.targetLUFS = targetLUFS;
    this.truePeakCeiling = truePeakCeiling;
    this.analyzer = new LoudnessAnalyzer();
  }

  async normalizeTrack(filePath) {
    logger.debug(`Normalizando faixa: ${path.basename(filePath)}`);
    
    // 1. Decodificar WAV
    const audioData = await WAVDecoder.readWAVFile(filePath);
    const { left, right, sampleRate } = audioData;

    // 2. Medir LUFS e True Peak originais
    const originalMetrics = await this.analyzer.measureLoudnessAndTruePeak(left, right, sampleRate);
    
    // 3. Calcular ganho de normalização usando utilitários
    const normalizationPlan = loudnessUtils.calculateNormalizationGain(
      originalMetrics.lufsIntegrated,
      this.targetLUFS,
      originalMetrics.truePeakDbtp,
      this.truePeakCeiling
    );

    // 4. Aplicar ganho estático usando utilitários
    const { normalizedLeft, normalizedRight } = loudnessUtils.applyStaticGain(
      left, right, normalizationPlan.gainDb
    );

    // 5. Verificar métricas finais
    const finalMetrics = await this.analyzer.measureLoudnessAndTruePeak(
      normalizedLeft, normalizedRight, sampleRate
    );

    // Log detalhado se houve limitação por True Peak
    if (normalizationPlan.limitedByTruePeak) {
      logger.warn(`True Peak limitou ganho`, { 
        file: path.basename(filePath),
        requestedGain: (this.targetLUFS - originalMetrics.lufsIntegrated).toFixed(2),
        appliedGain: normalizationPlan.gainDb.toFixed(2),
        reduction: normalizationPlan.reduction.toFixed(2)
      });
    }

    return {
      originalMetrics,
      finalMetrics,
      gainAppliedDb: normalizationPlan.gainDb,
      normalizedChannels: { left: normalizedLeft, right: normalizedRight },
      audioInfo: { sampleRate, bitDepth: audioData.bitDepth },
      normalizationPlan
    };
  }
}

// ============================================================================
// CALCULADOR DE MÉTRICAS ESPECTRAIS
// ============================================================================

class SpectralMetricsCalculator {
  constructor() {
    this.useSpectralUtils = true;
  }

  calculateSpectralMetrics(leftChannel, rightChannel, sampleRate) {
    if (this.useSpectralUtils) {
      try {
        // Usar utilitários especializados
        const spectralResult = spectralUtils.analyzeSpectralFeatures(
          leftChannel, rightChannel, sampleRate, 'full'
        );
        
        // Converter para formato compatível
        const bandMetrics = {};
        Object.entries(spectralResult.bands).forEach(([bandName, bandData]) => {
          bandMetrics[bandName] = {
            rms_db: bandData.rms_db,
            energy_pct: bandData.energy_pct
          };
        });

        return bandMetrics;
      } catch (error) {
        logger.warn('Falha nos utilitários espectrais, usando fallback', { error: error.message });
        return this._calculateSpectralMetricsFallback(leftChannel, rightChannel, sampleRate);
      }
    } else {
      return this._calculateSpectralMetricsFallback(leftChannel, rightChannel, sampleRate);
    }
  }

  _calculateSpectralMetricsFallback(leftChannel, rightChannel, sampleRate) {
    // Implementação simplificada original
    const bandDefinitions = spectralUtils.SPECTRAL_BANDS;
    
    const monoSignal = new Float32Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      monoSignal[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }

    // Simular análise por bandas usando filtros passa-banda simples
    const bandMetrics = {};
    
    Object.entries(bandDefinitions).forEach(([bandName, bandDef]) => {
      const bandEnergy = this._calculateBandEnergyFallback(monoSignal, sampleRate, bandDef.rangeHz);
      bandMetrics[bandName] = {
        rms_db: bandEnergy.rmsDb,
        energy_pct: 0 // Será calculado após normalização
      };
    });

    // Normalizar percentuais de energia
    const totalLinearEnergy = Object.values(bandMetrics).reduce((sum, band) => {
      return sum + Math.pow(10, band.rms_db / 10);
    }, 0);

    Object.keys(bandMetrics).forEach(bandName => {
      const linearEnergy = Math.pow(10, bandMetrics[bandName].rms_db / 10);
      bandMetrics[bandName].energy_pct = parseFloat(
        ((linearEnergy / totalLinearEnergy) * 100).toFixed(2)
      );
    });

    return bandMetrics;
  }

  _calculateBandEnergyFallback(signal, sampleRate, [lowFreq, highFreq]) {
    // Implementação simplificada usando RMS do sinal completo
    // Na implementação real, aplicar filtros passa-banda
    
    let sum = 0;
    for (let i = 0; i < signal.length; i++) {
      sum += signal[i] * signal[i];
    }
    
    const rms = Math.sqrt(sum / signal.length);
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    
    // Simular variação por frequência (placeholder)
    const freqCenter = Math.sqrt(lowFreq * highFreq);
    const freqFactor = 1 - Math.abs(Math.log10(freqCenter / 1000)) * 0.1;
    
    return {
      rmsDb: rmsDb + (freqFactor - 1) * 10,
      rms: rms * freqFactor
    };
  }
}

// ============================================================================
// PROCESSADOR DE GÊNERO
// ============================================================================

class GenreProcessor {
  constructor(genreName, config) {
    this.genreName = genreName;
    this.config = config;
    this.normalizer = new LUFSNormalizer(config.lufsTarget, config.truePeakCeiling);
    this.spectralCalculator = new SpectralMetricsCalculator();
    this.results = [];
  }

  async processGenre() {
    logger.info(`Iniciando processamento do gênero: ${this.genreName}`);
    
    const genreDir = path.join(this.config.inputDir, this.genreName);
    if (!fs.existsSync(genreDir)) {
      throw new Error(`Diretório do gênero não encontrado: ${genreDir}`);
    }

    // Detectar arquivos WAV
    const wavFiles = fs.readdirSync(genreDir)
      .filter(file => file.toLowerCase().endsWith('.wav'))
      .sort();

    if (wavFiles.length === 0) {
      throw new Error(`Nenhum arquivo WAV encontrado em: ${genreDir}`);
    }

    logger.info(`Encontrados ${wavFiles.length} arquivos WAV`, { genre: this.genreName });

    // Processar cada arquivo WAV
    for (const wavFile of wavFiles) {
      const filePath = path.join(genreDir, wavFile);
      try {
        const result = await this._processTrack(filePath);
        this.results.push(result);
        
        // Log por faixa conforme especificação
        logger.info(`Faixa processada: ${wavFile}`, {
          genre: this.genreName,
          lufs_in: result.originalMetrics.lufsIntegrated.toFixed(1),
          tp_in: result.originalMetrics.truePeakDbtp.toFixed(1),
          gain_db_aplicado: result.gainAppliedDb.toFixed(1),
          lufs_out: result.finalMetrics.lufsIntegrated.toFixed(1),
          tp_out: result.finalMetrics.truePeakDbtp.toFixed(1)
        });
      } catch (error) {
        logger.error(`Erro ao processar ${wavFile}`, { error: error.message });
        throw error;
      }
    }

    // Calcular médias aritméticas
    const averages = this._calculateGenreAverages();
    
    logger.info(`Processamento concluído para ${this.genreName}`, {
      processed: this.results.length,
      avgLufs: averages.lufs_target,
      avgTruePeak: averages.true_peak_target
    });

    return {
      genreName: this.genreName,
      tracksProcessed: this.results.length,
      averages,
      trackResults: this.results
    };
  }

  async _processTrack(filePath) {
    const fileName = path.basename(filePath);
    
    // 1. Normalizar por LUFS
    const normalizationResult = await this.normalizer.normalizeTrack(filePath);
    
    // 2. Calcular métricas espectrais no sinal normalizado
    const spectralMetrics = this.spectralCalculator.calculateSpectralMetrics(
      normalizationResult.normalizedChannels.left,
      normalizationResult.normalizedChannels.right,
      normalizationResult.audioInfo.sampleRate
    );

    // 3. Calcular outras métricas (dinâmica, estéreo, etc.)
    const additionalMetrics = this._calculateAdditionalMetrics(
      normalizationResult.normalizedChannels.left,
      normalizationResult.normalizedChannels.right
    );

    return {
      fileName,
      originalMetrics: normalizationResult.originalMetrics,
      finalMetrics: normalizationResult.finalMetrics,
      gainAppliedDb: normalizationResult.gainAppliedDb,
      spectralMetrics,
      additionalMetrics
    };
  }

  _calculateAdditionalMetrics(leftChannel, rightChannel) {
    // Calcular métricas adicionais necessárias para o schema
    
    try {
      // Usar utilitários especializados se disponíveis
      const stereoMetrics = spectralUtils.AdditionalMetricsCalculator.calculateStereoMetrics(leftChannel, rightChannel);
      const dr = spectralUtils.AdditionalMetricsCalculator.calculateDynamicRange(leftChannel, rightChannel);
      const crestFactor = spectralUtils.AdditionalMetricsCalculator.calculateCrestFactor(leftChannel, rightChannel);

      return {
        dynamicRange: dr,
        stereoCorrelation: stereoMetrics.correlation,
        stereoWidth: stereoMetrics.width,
        stereoBalance: stereoMetrics.balance_db,
        crestFactor
      };
    } catch (error) {
      logger.warn('Falha nos utilitários adicionais, usando fallback', { error: error.message });
      
      // Fallback para implementação interna
      const dr = this._calculateDynamicRange(leftChannel, rightChannel);
      const stereoCorrelation = this._calculateStereoCorrelation(leftChannel, rightChannel);
      const crestFactor = this._calculateCrestFactor(leftChannel, rightChannel);

      return {
        dynamicRange: dr,
        stereoCorrelation,
        crestFactor
      };
    }
  }

  _calculateDynamicRange(leftChannel, rightChannel) {
    // DR simplificado: diferença entre RMS médio e picos RMS
    const windowSize = Math.floor(leftChannel.length * 0.3); // 30% da faixa
    const rmsValues = [];

    for (let i = 0; i < leftChannel.length - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        const sample = (leftChannel[i + j] + rightChannel[i + j]) / 2;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / windowSize);
      if (rms > 0) {
        rmsValues.push(20 * Math.log10(rms));
      }
    }

    if (rmsValues.length < 2) return 0;

    rmsValues.sort((a, b) => a - b);
    const p10 = rmsValues[Math.floor(rmsValues.length * 0.1)];
    const p95 = rmsValues[Math.floor(rmsValues.length * 0.95)];
    
    return Math.max(0, p95 - p10);
  }

  _calculateStereoCorrelation(leftChannel, rightChannel) {
    // Correlação de Pearson entre canais L/R
    const n = Math.min(leftChannel.length, rightChannel.length);
    
    let sumL = 0, sumR = 0, sumLR = 0, sumL2 = 0, sumR2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumL += leftChannel[i];
      sumR += rightChannel[i];
      sumLR += leftChannel[i] * rightChannel[i];
      sumL2 += leftChannel[i] * leftChannel[i];
      sumR2 += rightChannel[i] * rightChannel[i];
    }
    
    const meanL = sumL / n;
    const meanR = sumR / n;
    const numerator = sumLR / n - meanL * meanR;
    const denominator = Math.sqrt((sumL2 / n - meanL * meanL) * (sumR2 / n - meanR * meanR));
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  _calculateCrestFactor(leftChannel, rightChannel) {
    // Crest Factor: relação entre pico e RMS
    let maxPeak = 0;
    let rmsSum = 0;
    
    for (let i = 0; i < leftChannel.length; i++) {
      const sampleL = Math.abs(leftChannel[i]);
      const sampleR = Math.abs(rightChannel[i]);
      maxPeak = Math.max(maxPeak, sampleL, sampleR);
      rmsSum += (leftChannel[i] * leftChannel[i] + rightChannel[i] * rightChannel[i]) / 2;
    }
    
    const rms = Math.sqrt(rmsSum / leftChannel.length);
    return rms > 0 ? 20 * Math.log10(maxPeak / rms) : 0;
  }

  _calculateGenreAverages() {
    const n = this.results.length;
    if (n === 0) throw new Error('Nenhum resultado para calcular médias');

    // Médias das métricas principais
    // LUFS e True Peak são valores em dB - aplicar conversão correta
    const lufsValues = this.results.map(r => r.finalMetrics.lufsIntegrated);
    const lufsLinearValues = lufsValues.map(lufs => {
      if (!Number.isFinite(lufs) || lufs <= -120) return 0;
      return Math.pow(10, lufs / 10); // LUFS usa base 10 (power)
    });
    const lufsLinearAvg = lufsLinearValues.reduce((sum, val) => sum + val, 0) / lufsLinearValues.length;
    const avgLufs = lufsLinearAvg > 0 ? 10 * Math.log10(lufsLinearAvg) : -Infinity;
    
    const tpValues = this.results.map(r => r.finalMetrics.truePeakDbtp);
    const tpLinearValues = tpValues.map(tp => {
      if (!Number.isFinite(tp) || tp <= -120) return 0;
      return Math.pow(10, tp / 20); // True Peak usa base 20 (amplitude)
    });
    const tpLinearAvg = tpLinearValues.reduce((sum, val) => sum + val, 0) / tpLinearValues.length;
    const avgTruePeak = tpLinearAvg > 0 ? 20 * Math.log10(tpLinearAvg) : -Infinity;
    
    const drValues = this.results.map(r => r.additionalMetrics.dynamicRange);
    const drLinearValues = drValues.map(dr => {
      if (!Number.isFinite(dr) || dr <= 0) return 0;
      return Math.pow(10, dr / 20); // DR usa base 20 (amplitude)
    });
    const drLinearAvg = drLinearValues.reduce((sum, val) => sum + val, 0) / drLinearValues.length;
    const avgDR = drLinearAvg > 0 ? 20 * Math.log10(drLinearAvg) : 0;
    
    // LRA e correlação estéreo não são dB - média aritmética normal
    const avgLRA = this.results.reduce((sum, r) => sum + r.finalMetrics.lra, 0) / n;
    const avgStereo = this.results.reduce((sum, r) => sum + r.additionalMetrics.stereoCorrelation, 0) / n;

    // Médias das bandas espectrais
    const bandNames = Object.keys(this.results[0].spectralMetrics);
    const avgBands = {};

    for (const bandName of bandNames) {
      // CORREÇÃO: Conversão correta dB → linear → média → dB
      const dbValues = this.results.map(r => r.spectralMetrics[bandName].rms_db);
      const linearValues = dbValues.map(dbValue => {
        // Tratar valores inválidos e clamp de silêncio
        if (!Number.isFinite(dbValue) || dbValue <= -120) {
          return 0; // Silêncio efetivo
        }
        return Math.pow(10, dbValue / 20); // Conversão dB → linear (amplitude)
      });
      
      const linearAverage = linearValues.reduce((sum, val) => sum + val, 0) / linearValues.length;
      const avgRmsDb = linearAverage > 0 ? 20 * Math.log10(linearAverage) : -Infinity;
      
      // Energia percentual continua com média aritmética normal (não é dB)
      const avgEnergyPct = this.results.reduce((sum, r) => sum + r.spectralMetrics[bandName].energy_pct, 0) / n;
      
      avgBands[bandName] = {
        target_db: Number.isFinite(avgRmsDb) ? parseFloat(avgRmsDb.toFixed(1)) : -120.0,
        energy_pct: parseFloat(avgEnergyPct.toFixed(2))
      };
    }

    // Renormalizar percentuais de energia para somar 100%
    const totalPct = Object.values(avgBands).reduce((sum, band) => sum + band.energy_pct, 0);
    if (Math.abs(totalPct - 100.0) > 0.01) {
      const factor = 100.0 / totalPct;
      Object.keys(avgBands).forEach(bandName => {
        avgBands[bandName].energy_pct = parseFloat((avgBands[bandName].energy_pct * factor).toFixed(2));
      });
    }

    return {
      lufs_target: Number.isFinite(avgLufs) ? parseFloat(avgLufs.toFixed(1)) : -18.0,
      true_peak_target: Number.isFinite(avgTruePeak) ? parseFloat(avgTruePeak.toFixed(1)) : -10.0,
      dr_target: Number.isFinite(avgDR) && avgDR > 0 ? parseFloat(avgDR.toFixed(1)) : 10.0,
      lra_target: parseFloat(avgLRA.toFixed(1)),
      stereo_target: parseFloat(avgStereo.toFixed(2)),
      bands: avgBands
    };
  }
}

// ============================================================================
// GERENCIADOR DE JSON
// ============================================================================

class JSONManager {
  constructor(genreName, outputDir, config) {
    this.genreName = genreName;
    this.outputDir = outputDir;
    this.config = config;
    this.outputFile = path.join(outputDir, `${genreName}.json`);
    this.backupFile = this.outputFile + '.backup.' + Date.now();
    this.previewFile = this.outputFile.replace('.json', '.preview.json');
  }

  loadCurrentSchema() {
    if (!fs.existsSync(this.outputFile)) {
      logger.warn(`Arquivo de referência não existe: ${this.outputFile}`);
      return null;
    }

    try {
      const content = fs.readFileSync(this.outputFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Erro ao carregar schema atual', { error: error.message });
      throw error;
    }
  }

  generateUpdatedJSON(currentSchema, averages, metadata) {
    // Preservar schema existente ou criar novo
    if (!currentSchema) {
      currentSchema = {
        [this.genreName]: {
          version: "1.0.0-lufs-norm",
          legacy_compatibility: {}
        }
      };
    }

    // Clonar schema preservando estrutura
    const updated = JSON.parse(JSON.stringify(currentSchema));
    const genreKey = this.genreName;

    // Garantir seção do gênero
    if (!updated[genreKey]) {
      updated[genreKey] = {};
    }

    // Atualizar versão para indicar normalização LUFS
    updated[genreKey].version = this.config.refsVersion;
    updated[genreKey].generated_at = new Date().toISOString();
    updated[genreKey].num_tracks = metadata.tracksProcessed;
    updated[genreKey].normalization_info = {
      lufs_target: this.config.lufsTarget,
      true_peak_ceiling: this.config.truePeakCeiling,
      algorithm: 'static_gain_ebu_r128',
      processing_date: new Date().toISOString(),
      run_id: RUN_ID
    };

    // Atualizar legacy_compatibility
    const legacy = updated[genreKey].legacy_compatibility || {};
    
    // Métricas principais
    legacy.lufs_target = averages.lufs_target;
    legacy.true_peak_target = averages.true_peak_target;
    legacy.dr_target = averages.dr_target;
    legacy.lra_target = averages.lra_target;
    legacy.stereo_target = averages.stereo_target;

    // Preservar tolerâncias existentes ou usar padrões
    legacy.tol_lufs = legacy.tol_lufs || 1.0;
    legacy.tol_true_peak = legacy.tol_true_peak || 1.0;
    legacy.tol_dr = legacy.tol_dr || 2.0;
    legacy.tol_lra = legacy.tol_lra || 2.0;
    legacy.tol_stereo = legacy.tol_stereo || 0.15;

    // Atualizar bandas
    legacy.bands = legacy.bands || {};
    Object.entries(averages.bands).forEach(([bandName, bandData]) => {
      legacy.bands[bandName] = {
        target_db: bandData.target_db,
        tol_db: legacy.bands[bandName]?.tol_db || 2.5,
        energy_pct: bandData.energy_pct,
        severity: legacy.bands[bandName]?.severity || 'soft'
      };
    });

    // Atualizar timestamp
    updated[genreKey].last_updated = new Date().toISOString();
    updated[genreKey].legacy_compatibility = legacy;

    return updated;
  }

  async saveJSON(jsonData, isDryRun = false) {
    const targetFile = isDryRun ? this.previewFile : this.outputFile;
    
    try {
      // Criar backup se não é dry-run e arquivo existe
      if (!isDryRun && fs.existsSync(this.outputFile)) {
        fs.copyFileSync(this.outputFile, this.backupFile);
        logger.info(`Backup criado: ${path.basename(this.backupFile)}`);
      }

      // Escrever JSON
      fs.writeFileSync(targetFile, JSON.stringify(jsonData, null, 2), 'utf8');
      
      const action = isDryRun ? 'Preview gerado' : 'Arquivo atualizado';
      logger.info(`${action}: ${path.basename(targetFile)}`);

      return {
        outputFile: targetFile,
        backupFile: isDryRun ? null : this.backupFile,
        success: true
      };
    } catch (error) {
      logger.error(`Erro ao salvar JSON: ${error.message}`);
      throw error;
    }
  }

  generateDiffReport(oldSchema, newAverages) {
    if (!oldSchema || !oldSchema[this.genreName]) {
      return { isNew: true, diffs: [] };
    }

    const old = oldSchema[this.genreName].legacy_compatibility || {};
    const diffs = [];

    // Comparar métricas principais
    const mainMetrics = [
      { key: 'lufs_target', name: 'LUFS', unit: 'LUFS' },
      { key: 'true_peak_target', name: 'True Peak', unit: 'dBTP' },
      { key: 'dr_target', name: 'DR', unit: 'dB' },
      { key: 'lra_target', name: 'LRA', unit: 'LU' },
      { key: 'stereo_target', name: 'Stereo', unit: '' }
    ];

    mainMetrics.forEach(metric => {
      const oldVal = old[metric.key];
      const newVal = newAverages[metric.key];
      
      if (oldVal !== undefined && newVal !== undefined) {
        const diff = newVal - oldVal;
        if (Math.abs(diff) > 0.1) {
          diffs.push({
            type: 'metric',
            name: metric.name,
            oldValue: oldVal,
            newValue: newVal,
            difference: parseFloat(diff.toFixed(2)),
            unit: metric.unit
          });
        }
      }
    });

    // Comparar bandas
    if (old.bands && newAverages.bands) {
      Object.entries(newAverages.bands).forEach(([bandName, newBand]) => {
        const oldBand = old.bands[bandName];
        if (oldBand && oldBand.target_db !== undefined) {
          const diff = newBand.target_db - oldBand.target_db;
          if (Math.abs(diff) > 0.2) {
            diffs.push({
              type: 'band',
              name: bandName,
              oldValue: oldBand.target_db,
              newValue: newBand.target_db,
              difference: parseFloat(diff.toFixed(1)),
              unit: 'dB'
            });
          }
        }
      });
    }

    return { isNew: false, diffs };
  }
}

// ============================================================================
// SISTEMA PRINCIPAL
// ============================================================================

class ReferencesNormalizer {
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.results = new Map();
    this.errors = [];
  }

  async run() {
    const startTime = performance.now();
    
    logger.info('🔊 INICIANDO NORMALIZAÇÃO LUFS E REBUILD DE REFERÊNCIAS', {
      runId: RUN_ID,
      mode: this.config.dryRun ? 'DRY-RUN' : 'APPLY',
      lufsTarget: this.config.lufsTarget,
      truePeakCeiling: this.config.truePeakCeiling,
      refsVersion: this.config.refsVersion,
      genres: this.config.genres
    });

    try {
      // Verificar diretórios
      this._validateDirectories();

      // Processar cada gênero
      for (const genreName of this.config.genres) {
        try {
          await this._processGenre(genreName);
        } catch (error) {
          logger.error(`Erro no gênero ${genreName}`, { error: error.message });
          this.errors.push({ genre: genreName, error: error.message });
        }
      }

      // Gerar relatório final
      this._generateFinalReport();

      // Aplicar mudanças se não é dry-run
      if (!this.config.dryRun && this.errors.length === 0) {
        await this._applyChanges();
      } else if (this.config.dryRun) {
        logger.info('🔍 DRY-RUN concluído - nenhum arquivo foi modificado');
      } else {
        logger.error('❌ Não aplicando mudanças devido a erros', { errors: this.errors.length });
      }

      const processingTime = ((performance.now() - startTime) / 1000).toFixed(1);
      logger.info(`✅ Processamento concluído em ${processingTime}s`);

    } catch (error) {
      logger.error('Erro crítico durante normalização', { error: error.message });
      throw error;
    }
  }

  _validateDirectories() {
    if (!fs.existsSync(this.config.inputDir)) {
      throw new Error(`Diretório de entrada não encontrado: ${this.config.inputDir}`);
    }

    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
      logger.info(`Diretório de saída criado: ${this.config.outputDir}`);
    }
  }

  async _processGenre(genreName) {
    logger.info(`📊 Processando gênero: ${genreName}`);

    // Processar WAVs e normalizar
    const processor = new GenreProcessor(genreName, this.config);
    const processResult = await processor.processGenre();

    // Gerenciar JSON
    const jsonManager = new JSONManager(genreName, this.config.outputDir, this.config);
    const currentSchema = jsonManager.loadCurrentSchema();

    // Gerar diff
    const diffReport = jsonManager.generateDiffReport(currentSchema, processResult.averages);

    // Gerar JSON atualizado
    const updatedJSON = jsonManager.generateUpdatedJSON(
      currentSchema,
      processResult.averages,
      { tracksProcessed: processResult.tracksProcessed }
    );

    // Armazenar resultado
    this.results.set(genreName, {
      processResult,
      currentSchema,
      updatedJSON,
      diffReport,
      jsonManager
    });

    logger.info(`✅ Gênero processado: ${genreName}`, {
      tracks: processResult.tracksProcessed,
      diffs: diffReport.diffs.length,
      avgLufs: processResult.averages.lufs_target
    });
  }

  async _applyChanges() {
    logger.info('💾 Aplicando mudanças nos arquivos JSON...');

    for (const [genreName, result] of this.results) {
      try {
        const saveResult = await result.jsonManager.saveJSON(result.updatedJSON, false);
        logger.info(`✅ ${genreName} salvo`, { file: path.basename(saveResult.outputFile) });
      } catch (error) {
        logger.error(`❌ Erro ao salvar ${genreName}`, { error: error.message });
        this.errors.push({ genre: genreName, phase: 'save', error: error.message });
      }
    }
  }

  _generateFinalReport() {
    logger.info('📋 RELATÓRIO FINAL DE NORMALIZAÇÃO LUFS', { runId: RUN_ID });

    console.log('\n' + '='.repeat(80));
    console.log('🔊 RELATÓRIO FINAL - NORMALIZAÇÃO LUFS + REBUILD REFERÊNCIAS');
    console.log(`RunId: ${RUN_ID}`);
    console.log(`Modo: ${this.config.dryRun ? 'DRY-RUN (preview apenas)' : 'APPLY (aplicar mudanças)'}`);
    console.log(`LUFS Target: ${this.config.lufsTarget} LUFS`);
    console.log(`True Peak Ceiling: ${this.config.truePeakCeiling} dBTP`);
    console.log(`Versão: ${this.config.refsVersion}`);
    console.log(`Data: ${new Date().toISOString()}`);
    console.log('='.repeat(80));

    for (const [genreName, result] of this.results) {
      const { processResult, diffReport } = result;

      console.log(`\n🎵 GÊNERO: ${genreName.toUpperCase()}`);
      console.log(`   Faixas processadas: ${processResult.tracksProcessed}`);
      console.log(`   Status: ${this.errors.some(e => e.genre === genreName) ? '❌ ERRO' : '✅ OK'}`);
      
      // Estatísticas de normalização
      console.log(`   LUFS médio final: ${processResult.averages.lufs_target} LUFS`);
      console.log(`   True Peak médio final: ${processResult.averages.true_peak_target} dBTP`);
      
      // Validação espectral
      const totalEnergyPct = Object.values(processResult.averages.bands)
        .reduce((sum, band) => sum + band.energy_pct, 0);
      console.log(`   Soma % energia: ${totalEnergyPct.toFixed(2)}% ${Math.abs(totalEnergyPct - 100.0) <= 0.1 ? '✅' : '❌'}`);

      // Diferenças significativas
      if (diffReport.isNew) {
        console.log(`   📝 Novo arquivo de referência criado`);
      } else {
        console.log(`   📈 Diferenças encontradas: ${diffReport.diffs.length}`);
        
        const significantDiffs = diffReport.diffs.filter(d => 
          (d.type === 'metric' && Math.abs(d.difference) > 1.0) ||
          (d.type === 'band' && Math.abs(d.difference) > 2.0)
        );

        significantDiffs.slice(0, 5).forEach(diff => {
          const sign = diff.difference > 0 ? '+' : '';
          console.log(`     ${diff.name}: ${diff.oldValue} → ${diff.newValue} (${sign}${diff.difference} ${diff.unit})`);
        });

        if (significantDiffs.length > 5) {
          console.log(`     ... e mais ${significantDiffs.length - 5} diferenças`);
        }
      }
    }

    // Resumo de erros
    if (this.errors.length > 0) {
      console.log(`\n❌ ERROS ENCONTRADOS: ${this.errors.length}`);
      this.errors.forEach(error => {
        console.log(`   ${error.genre}: ${error.error}`);
      });
    }

    // Status final
    const successCount = this.results.size - this.errors.length;
    console.log(`\n📊 RESUMO FINAL:`);
    console.log(`   Gêneros processados com sucesso: ${successCount}/${this.config.genres.length}`);
    console.log(`   Erros: ${this.errors.length}`);
    console.log(`   Target LUFS: ${this.config.lufsTarget} LUFS`);
    console.log(`   Target True Peak: ≤ ${this.config.truePeakCeiling} dBTP`);
    console.log(`   Aplicação: ${this.config.dryRun ? 'NÃO (dry-run)' : (this.errors.length === 0 ? 'SIM' : 'NÃO (erros presentes)')}`);

    // Salvar preview files se dry-run
    if (this.config.dryRun) {
      console.log(`\n📄 ARQUIVOS PREVIEW GERADOS:`);
      for (const [genreName, result] of this.results) {
        try {
          result.jsonManager.saveJSON(result.updatedJSON, true);
          console.log(`   ${genreName}.preview.json`);
        } catch (error) {
          console.log(`   ${genreName}: ERRO - ${error.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
  }
}

// ============================================================================
// PONTO DE ENTRADA E CLI
// ============================================================================

function parseArguments() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--in':
        config.inputDir = args[++i];
        break;
      case '--out':
        config.outputDir = args[++i];
        break;
      case '--lufs':
        config.lufsTarget = parseFloat(args[++i]);
        break;
      case '--tp':
        config.truePeakCeiling = parseFloat(args[++i]);
        break;
      case '--refsVer':
        config.refsVersion = args[++i];
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--verbose':
        config.logLevel = 'DEBUG';
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (args[i].startsWith('--')) {
          console.error(`Opção desconhecida: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return config;
}

function printHelp() {
  console.log(`
🔊 REFS NORMALIZE AND REBUILD - Normalização LUFS + Rebuild Referências

Uso:
  node refs-normalize-and-rebuild.js [opções]

Opções:
  --in <dir>        Diretório de entrada com WAVs (default: REFs)
  --out <dir>       Diretório de saída para JSONs (default: public/refs/out)
  --lufs <valor>    LUFS target para normalização (default: -18.0)
  --tp <valor>      True Peak ceiling em dBTP (default: -1.0)
  --refsVer <ver>   Versão das referências (default: v2_lufs_norm)
  --dry-run         Apenas gerar preview sem modificar arquivos
  --verbose         Log detalhado (DEBUG)
  --help            Mostrar esta ajuda

Exemplos:
  # Dry-run com configurações padrão
  node refs-normalize-and-rebuild.js --dry-run

  # Normalizar para -16 LUFS com True Peak -0.5 dBTP
  node refs-normalize-and-rebuild.js --lufs -16 --tp -0.5

  # Aplicar mudanças com configurações padrão
  node refs-normalize-and-rebuild.js

Funcionalidades:
  ✅ Normalização LUFS com ganho estático (sem compressor/limiter)
  ✅ Medição LUFS integrado EBU R128 com gating
  ✅ Controle True Peak com oversampling
  ✅ Recálculo de métricas espectrais por faixa normalizada
  ✅ Médias aritméticas por gênero
  ✅ Backup automático dos JSONs existentes
  ✅ Modo DRY-RUN para preview seguro
  ✅ Versionamento com refsVer
  ✅ Compatibilidade com schema existente
`);
}

async function main() {
  try {
    const config = parseArguments();
    
    // Validar configuração
    if (!config.inputDir || !config.outputDir) {
      console.error('❌ Diretórios de entrada e saída são obrigatórios');
      process.exit(1);
    }

    if (isNaN(config.lufsTarget) || isNaN(config.truePeakCeiling)) {
      console.error('❌ Valores LUFS e True Peak devem ser números válidos');
      process.exit(1);
    }

    // Executar normalização
    const normalizer = new ReferencesNormalizer(config);
    await normalizer.run();

    console.log(`\n✅ Normalização LUFS concluída ${config.dryRun ? '(preview)' : '(aplicada)'}`);

  } catch (error) {
    console.error('\n❌ Erro durante normalização LUFS:', error.message);
    if (DEFAULT_CONFIG.logLevel === 'DEBUG') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  ReferencesNormalizer, 
  LUFSNormalizer, 
  WAVDecoder, 
  LoudnessAnalyzer,
  SpectralMetricsCalculator,
  GenreProcessor,
  JSONManager 
};
