#!/usr/bin/env node

/**
 * 🔊 REFS HYBRID NORMALIZE - Sistema de Normalização Híbrida
 * 
 * CONCEITO HÍBRIDO:
 * 1. 📊 FREQUÊNCIAS: Calculadas do áudio normalizado (-18 LUFS) para comparação justa
 * 2. 🎵 MÉTRICAS GLOBAIS: Calculadas do áudio ORIGINAL (preserva dinâmica real)
 * 
 * Isso garante:
 * - Bandas espectrais comparáveis entre gêneros (todas em -18 LUFS)
 * - Métricas globais autênticas (LUFS, True Peak, Dinâmica originais)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Importar utilitários
const loudnessUtils = require('./loudness-utils.cjs');
const spectralUtils = require('./spectral-utils.cjs');

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  inputDir: 'REFs',
  outputDir: 'public/refs/out',
  lufsTarget: -18.0,
  truePeakCeiling: -1.0,
  sampleRate: 48000,
  genresDirs: ['funk_mandela', 'eletronico', 'funk_bruxaria', 'trance']
};

const RUN_ID = `hybrid_norm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

class Logger {
  constructor(runId) {
    this.runId = runId;
  }
  
  info(msg, data = {}) {
    console.log(`[INFO] ${msg}`, Object.keys(data).length ? data : '');
  }
  
  warn(msg, data = {}) {
    console.log(`[WARN] ${msg}`, Object.keys(data).length ? data : '');
  }
  
  error(msg, data = {}) {
    console.log(`[ERROR] ${msg}`, Object.keys(data).length ? data : '');
  }
}

const logger = new Logger(RUN_ID);

// ============================================================================
// DECODIFICADOR WAV SIMPLES
// ============================================================================

class WAVDecoder {
  static readWAVFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    
    // Verificar cabeçalho WAV
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || 
        buffer.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Arquivo não é WAV válido');
    }
    
    // Encontrar chunk 'fmt '
    let offset = 12;
    let fmtFound = false, dataFound = false;
    let numChannels, sampleRate, bitsPerSample, dataOffset, dataSize;
    
    while (offset < buffer.length && (!fmtFound || !dataFound)) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      
      if (chunkId === 'fmt ') {
        numChannels = buffer.readUInt16LE(offset + 10);
        sampleRate = buffer.readUInt32LE(offset + 12);
        bitsPerSample = buffer.readUInt16LE(offset + 22);
        fmtFound = true;
      } else if (chunkId === 'data') {
        dataOffset = offset + 8;
        dataSize = chunkSize;
        dataFound = true;
      }
      
      offset += 8 + chunkSize;
    }
    
    if (!fmtFound || !dataFound) {
      throw new Error('Chunks fmt ou data não encontrados');
    }
    
    // Ler dados de áudio como float32
    const bytesPerSample = bitsPerSample / 8;
    const numSamples = dataSize / bytesPerSample / numChannels;
    const audioData = [];
    
    for (let ch = 0; ch < numChannels; ch++) {
      audioData[ch] = new Float32Array(numSamples);
    }
    
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const byteOffset = dataOffset + (i * numChannels + ch) * bytesPerSample;
        let sample;
        
        if (bitsPerSample === 16) {
          sample = buffer.readInt16LE(byteOffset) / 32768.0;
        } else if (bitsPerSample === 24) {
          const byte1 = buffer.readUInt8(byteOffset);
          const byte2 = buffer.readUInt8(byteOffset + 1);
          const byte3 = buffer.readUInt8(byteOffset + 2);
          const int24 = (byte3 << 16) | (byte2 << 8) | byte1;
          sample = (int24 > 8388607 ? int24 - 16777216 : int24) / 8388608.0;
        } else if (bitsPerSample === 32) {
          sample = buffer.readInt32LE(byteOffset) / 2147483648.0;
        }
        
        audioData[ch][i] = sample;
      }
    }
    
    return {
      sampleRate,
      numChannels,
      audioData,
      numSamples
    };
  }
}

// ============================================================================
// PROCESSADOR HÍBRIDO PRINCIPAL
// ============================================================================

class HybridAudioProcessor {
  
  /**
   * Processa um arquivo: 
   * 1. Calcula métricas globais do áudio ORIGINAL
   * 2. Normaliza para -18 LUFS
   * 3. Calcula bandas espectrais do áudio NORMALIZADO
   */
  static async processTrack(filePath) {
    logger.info(`🎵 Processando: ${path.basename(filePath)}`);
    
    // Carregar áudio original
    const originalAudio = WAVDecoder.readWAVFile(filePath);
    
    // 1. MÉTRICAS GLOBAIS do áudio ORIGINAL
    const originalMetrics = await this.calculateOriginalMetrics(originalAudio);
    
    // 2. Normalizar para -18 LUFS
    const normalizedAudio = await this.normalizeToLUFS(originalAudio, CONFIG.lufsTarget);
    
    // 3. BANDAS ESPECTRAIS do áudio NORMALIZADO  
    const spectralBands = await this.calculateSpectralBands(normalizedAudio);
    
    return {
      file: path.basename(filePath),
      original_metrics: originalMetrics,
      normalized_bands: spectralBands,
      processing_info: {
        lufs_target: CONFIG.lufsTarget,
        normalization_applied: true,
        hybrid_mode: true
      }
    };
  }
  
  /**
   * Calcula métricas globais do áudio ORIGINAL (sem normalização)
   */
  static async calculateOriginalMetrics(audioData) {
    // Converter para mono se necessário
    const mono = audioData.numChannels === 1 ? 
      audioData.audioData[0] : 
      this.mixToMono(audioData.audioData);
    
    // LUFS integrado (EBU R128)
    const lufs = loudnessUtils.calculateIntegratedLUFS(audioData);
    
    // True Peak
    const truePeak = this.calculateTruePeak(audioData);
    
    // Dinâmica (diferença alto/baixo)
    const dynamicRange = this.calculateDynamicRange(mono);
    
    // RMS para variação de volume
    const rms = this.calculateRMS(mono);
    
    // Correlação estéreo
    const stereoCorr = audioData.numChannels === 2 ? 
      this.calculateStereoCorrelation(audioData.audioData[0], audioData.audioData[1]) : 1.0;
    
    return {
      lufs_integrated: parseFloat(lufs.toFixed(2)),
      true_peak_dbtp: parseFloat(truePeak.toFixed(2)),
      dynamic_range: parseFloat(dynamicRange.toFixed(2)),
      rms_db: parseFloat((-Math.log10(rms) * 20).toFixed(2)),
      stereo_correlation: parseFloat(stereoCorr.toFixed(3)),
      lra: 0, // Placeholder - implementar se necessário
      note: "Métricas calculadas do áudio original (sem normalização)"
    };
  }
  
  /**
   * Normaliza áudio para LUFS target usando ganho estático
   */
  static async normalizeToLUFS(audioData, targetLUFS) {
    // Calcular LUFS atual
    const currentLUFS = loudnessUtils.calculateIntegratedLUFS(audioData);
    
    // Calcular ganho necessário (em dB)
    const gainDB = targetLUFS - currentLUFS;
    const gainLinear = Math.pow(10, gainDB / 20);
    
    // Aplicar ganho a todos os canais
    const normalizedData = {
      ...audioData,
      audioData: audioData.audioData.map(channel => 
        channel.map(sample => sample * gainLinear)
      )
    };
    
    logger.info(`🔧 Normalização: ${currentLUFS.toFixed(1)} → ${targetLUFS} LUFS (ganho: ${gainDB.toFixed(1)} dB)`);
    
    return normalizedData;
  }
  
  /**
   * Calcula bandas espectrais do áudio NORMALIZADO
   */
  static async calculateSpectralBands(audioData) {
    // Converter para mono
    const mono = audioData.numChannels === 1 ? 
      audioData.audioData[0] : 
      this.mixToMono(audioData.audioData);
    
    // Calcular bandas espectrais
    const bands = spectralUtils.calculateSpectralBands(mono, audioData.sampleRate);
    
    return {
      sub: bands.sub,
      low_bass: bands.low_bass,
      upper_bass: bands.upper_bass,
      low_mid: bands.low_mid,
      mid: bands.mid,
      high_mid: bands.high_mid,
      brilho: bands.brilho,
      presenca: bands.presenca,
      note: "Bandas calculadas do áudio normalizado (-18 LUFS) para comparação justa"
    };
  }
  
  // Utilitários auxiliares
  static mixToMono(audioChannels) {
    const mono = new Float32Array(audioChannels[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = audioChannels.reduce((sum, ch) => sum + ch[i], 0) / audioChannels.length;
    }
    return mono;
  }
  
  static calculateTruePeak(audioData) {
    let maxPeak = 0;
    for (const channel of audioData.audioData) {
      for (const sample of channel) {
        maxPeak = Math.max(maxPeak, Math.abs(sample));
      }
    }
    return 20 * Math.log10(maxPeak);
  }
  
  static calculateDynamicRange(samples) {
    const sorted = [...samples].map(Math.abs).sort((a, b) => b - a);
    const p95 = sorted[Math.floor(sorted.length * 0.05)];
    const p5 = sorted[Math.floor(sorted.length * 0.95)];
    return 20 * Math.log10(p95 / Math.max(p5, 1e-10));
  }
  
  static calculateRMS(samples) {
    const sum = samples.reduce((acc, sample) => acc + sample * sample, 0);
    return Math.sqrt(sum / samples.length);
  }
  
  static calculateStereoCorrelation(left, right) {
    let sumL = 0, sumR = 0, sumLR = 0, sumLL = 0, sumRR = 0;
    
    for (let i = 0; i < left.length; i++) {
      sumL += left[i];
      sumR += right[i];
      sumLR += left[i] * right[i];
      sumLL += left[i] * left[i];
      sumRR += right[i] * right[i];
    }
    
    const n = left.length;
    const numerator = n * sumLR - sumL * sumR;
    const denominator = Math.sqrt((n * sumLL - sumL * sumL) * (n * sumRR - sumR * sumR));
    
    return denominator > 0 ? numerator / denominator : 0;
  }
}

// ============================================================================
// SISTEMA DE AGREGAÇÃO POR GÊNERO
// ============================================================================

class GenreAggregator {
  
  static aggregateGenreTracks(tracks) {
    if (!tracks || tracks.length === 0) {
      throw new Error('Nenhuma track para agregar');
    }
    
    logger.info(`📊 Agregando ${tracks.length} tracks`);
    
    // Agregar métricas originais (média aritmética simples)
    const originalMetrics = this.aggregateOriginalMetrics(tracks);
    
    // Agregar bandas normalizadas (conversão dB→linear→média→dB)
    const normalizedBands = this.aggregateNormalizedBands(tracks);
    
    return {
      num_tracks: tracks.length,
      original_metrics: originalMetrics,
      normalized_bands: normalizedBands,
      processing_note: "Híbrido: métricas originais + bandas normalizadas"
    };
  }
  
  static aggregateOriginalMetrics(tracks) {
    const metrics = tracks.map(t => t.original_metrics);
    
    return {
      lufs_integrated: this.average(metrics.map(m => m.lufs_integrated)),
      true_peak_dbtp: this.average(metrics.map(m => m.true_peak_dbtp)),
      dynamic_range: this.average(metrics.map(m => m.dynamic_range)),
      rms_db: this.average(metrics.map(m => m.rms_db)),
      stereo_correlation: this.average(metrics.map(m => m.stereo_correlation)),
      note: "Médias das métricas originais (preserva dinâmica real)"
    };
  }
  
  static aggregateNormalizedBands(tracks) {
    const allBands = tracks.map(t => t.normalized_bands);
    const bandNames = ['sub', 'low_bass', 'upper_bass', 'low_mid', 'mid', 'high_mid', 'brilho', 'presenca'];
    
    const result = {};
    
    for (const bandName of bandNames) {
      const bandValues = allBands.map(bands => bands[bandName].energy_db);
      
      // Conversão correta: dB → linear → média → dB
      const linearValues = bandValues.map(db => Math.pow(10, db / 10));
      const avgLinear = this.average(linearValues);
      const avgDB = 10 * Math.log10(avgLinear);
      
      result[bandName] = {
        target_db: parseFloat(avgDB.toFixed(1)),
        energy_pct: this.average(allBands.map(bands => bands[bandName].energy_pct)),
        tolerance_db: 2.5
      };
    }
    
    result.note = "Bandas agregadas com conversão dB→linear→média→dB";
    return result;
  }
  
  static average(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

// ============================================================================
// SISTEMA PRINCIPAL
// ============================================================================

class HybridReferenceBuilder {
  
  static async processGenre(genreName) {
    logger.info(`🎪 Processando gênero: ${genreName}`);
    
    const genreDir = path.join(CONFIG.inputDir, genreName);
    if (!fs.existsSync(genreDir)) {
      throw new Error(`Diretório não existe: ${genreDir}`);
    }
    
    // Encontrar arquivos WAV
    const wavFiles = fs.readdirSync(genreDir)
      .filter(file => file.toLowerCase().endsWith('.wav'))
      .map(file => path.join(genreDir, file));
    
    if (wavFiles.length === 0) {
      throw new Error(`Nenhum arquivo WAV encontrado em ${genreDir}`);
    }
    
    logger.info(`📁 Encontrados ${wavFiles.length} arquivos WAV`);
    
    // Processar cada track
    const processedTracks = [];
    for (const wavFile of wavFiles) {
      try {
        const trackData = await HybridAudioProcessor.processTrack(wavFile);
        processedTracks.push(trackData);
      } catch (error) {
        logger.error(`Erro processando ${wavFile}:`, { error: error.message });
      }
    }
    
    if (processedTracks.length === 0) {
      throw new Error('Nenhuma track processada com sucesso');
    }
    
    // Agregar resultados
    const aggregatedData = GenreAggregator.aggregateGenreTracks(processedTracks);
    
    // Construir JSON final
    const jsonOutput = {
      [genreName]: {
        version: "v2_hybrid_norm",
        generated_at: new Date().toISOString(),
        run_id: RUN_ID,
        processing_mode: "hybrid",
        ...aggregatedData,
        
        // Compatibilidade com sistema existente
        legacy_compatibility: {
          lufs_target: aggregatedData.original_metrics.lufs_integrated,
          true_peak_target: aggregatedData.original_metrics.true_peak_dbtp,
          dr_target: aggregatedData.original_metrics.dynamic_range,
          stereo_target: aggregatedData.original_metrics.stereo_correlation,
          
          bands: Object.fromEntries(
            Object.entries(aggregatedData.normalized_bands)
              .filter(([key]) => key !== 'note')
              .map(([name, data]) => [name, {
                target_db: data.target_db,
                energy_pct: data.energy_pct,
                tol_db: data.tolerance_db,
                severity: "soft"
              }])
          )
        }
      }
    };
    
    return jsonOutput;
  }
  
  static async run() {
    logger.info('🚀 Iniciando processamento híbrido...');
    
    for (const genreName of CONFIG.genresDirs) {
      try {
        const result = await this.processGenre(genreName);
        
        // Salvar JSON
        const outputFile = path.join(CONFIG.outputDir, `${genreName}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
        
        logger.info(`✅ ${genreName}: Salvo em ${outputFile}`);
        
      } catch (error) {
        logger.error(`❌ Erro em ${genreName}:`, { error: error.message });
      }
    }
    
    logger.info('🎯 Processamento híbrido concluído!');
  }
}

// ============================================================================
// EXECUÇÃO
// ============================================================================

if (require.main === module) {
  HybridReferenceBuilder.run()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('Erro fatal:', { error: error.message });
      process.exit(1);
    });
}

module.exports = { HybridAudioProcessor, GenreAggregator, HybridReferenceBuilder };
