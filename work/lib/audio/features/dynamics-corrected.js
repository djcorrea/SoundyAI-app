// 🎚️ DYNAMICS METRICS CORRECTED - DR, LRA, Crest Factor
// Implementação profissional com valores realistas para produção musical

import { logAudio, makeErr } from '../error-handling.js';

/**
 * 🎯 Configurações para métricas de dinâmica
 */
const DYNAMICS_CONFIG = {
  // Dynamic Range
  DR_WINDOW_MS: 300,      // Janela RMS para análise (conforme padrão)
  DR_HOP_MS: 100,         // Sobreposição de janelas
  DR_MIN_WINDOWS: 10,     // Mínimo de janelas para análise válida
  
  // Crest Factor
  CREST_MIN_RMS: 1e-10,   // RMS mínimo para cálculo válido
  CREST_MIN_PEAK: 1e-10,  // Peak mínimo para cálculo válido
  
  // Valores de referência profissionais
  DR_REFERENCE: {
    funk: { min: 3, max: 6, typical: 4.5 },
    trance: { min: 6, max: 10, typical: 8 },
    classical: { min: 12, max: 20, typical: 16 },
    pop: { min: 4, max: 8, typical: 6 },
    rock: { min: 5, max: 12, typical: 8.5 }
  }
};

/**
 * 🎚️ DYNAMIC RANGE CORRETO: Diferença entre pico RMS e RMS médio
 * Implementação profissional com janelas deslizantes
 */
export class DynamicRangeCalculator {
  
  /**
   * 📊 Calcular RMS em janelas deslizantes
   */
  static calculateWindowedRMS(audioData, sampleRate, windowMs = 300, hopMs = 100) {
    const windowSamples = Math.round((windowMs / 1000) * sampleRate);
    const hopSamples = Math.round((hopMs / 1000) * sampleRate);
    const rmsValues = [];
    
    for (let start = 0; start + windowSamples <= audioData.length; start += hopSamples) {
      let sumSquares = 0;
      
      for (let i = start; i < start + windowSamples; i++) {
        sumSquares += audioData[i] * audioData[i];
      }
      
      const rms = Math.sqrt(sumSquares / windowSamples);
      if (rms > DYNAMICS_CONFIG.CREST_MIN_RMS) {
        rmsValues.push(20 * Math.log10(rms)); // Converter para dB
      }
    }
    
    return rmsValues;
  }
  
  /**
   * 🎯 Calcular Dynamic Range profissional
   * DR = Pico RMS mais alto - RMS médio
   */
  static calculateDynamicRange(leftChannel, rightChannel, sampleRate = 48000) {
    try {
      // Combinar canais em mono para análise consistente
      const length = Math.min(leftChannel.length, rightChannel.length);
      const monoData = new Float32Array(length);
      
      for (let i = 0; i < length; i++) {
        monoData[i] = (leftChannel[i] + rightChannel[i]) / 2;
      }
      
      // Calcular RMS em janelas
      const rmsValues = this.calculateWindowedRMS(
        monoData, 
        sampleRate, 
        DYNAMICS_CONFIG.DR_WINDOW_MS, 
        DYNAMICS_CONFIG.DR_HOP_MS
      );
      
      if (rmsValues.length < DYNAMICS_CONFIG.DR_MIN_WINDOWS) {
        logAudio('dynamics', 'insufficient_windows', { 
          windows: rmsValues.length, 
          required: DYNAMICS_CONFIG.DR_MIN_WINDOWS 
        });
        return null;
      }
      
      // Encontrar pico RMS e calcular média
      const peakRMS = Math.max(...rmsValues);
      const averageRMS = rmsValues.reduce((sum, val) => sum + val, 0) / rmsValues.length;
      const dynamicRange = peakRMS - averageRMS;
      
      // Validar resultado
      if (!isFinite(dynamicRange) || dynamicRange < 0) {
        logAudio('dynamics', 'invalid_dr', { 
          peakRMS: peakRMS.toFixed(2), 
          averageRMS: averageRMS.toFixed(2), 
          dr: dynamicRange.toFixed(2) 
        });
        return null;
      }
      
      // Log para auditoria
      logAudio('dynamics', 'dr_calculated', {
        peakRmsDb: peakRMS.toFixed(2),
        averageRmsDb: averageRMS.toFixed(2),
        dynamicRangeDb: dynamicRange.toFixed(2),
        windows: rmsValues.length,
        windowMs: DYNAMICS_CONFIG.DR_WINDOW_MS
      });
      
      return {
        dynamicRange: dynamicRange,
        peakRmsDb: peakRMS,
        averageRmsDb: averageRMS,
        windowCount: rmsValues.length,
        algorithm: 'Peak_RMS_minus_Average_RMS',
        referenceGenres: this.classifyDynamicRange(dynamicRange)
      };
      
    } catch (error) {
      logAudio('dynamics', 'dr_error', { error: error.message });
      return null;
    }
  }
  
  /**
   * 🎵 Classificar gênero baseado em Dynamic Range
   */
  static classifyDynamicRange(dr) {
    const genres = [];
    const ref = DYNAMICS_CONFIG.DR_REFERENCE;
    
    for (const [genre, range] of Object.entries(ref)) {
      if (dr >= range.min && dr <= range.max) {
        genres.push({
          genre,
          match: 'typical',
          confidence: this.calculateConfidence(dr, range)
        });
      }
    }
    
    return genres.length > 0 ? genres : [{ 
      genre: 'unknown', 
      match: 'atypical', 
      confidence: 0 
    }];
  }
  
  /**
   * 📈 Calcular confiança da classificação
   */
  static calculateConfidence(dr, range) {
    const center = range.typical;
    const tolerance = (range.max - range.min) / 2;
    const distance = Math.abs(dr - center);
    return Math.max(0, 1 - (distance / tolerance));
  }
}

/**
 * 🏔️ CREST FACTOR CORRETO: conforme especificação
 * Regra: tudo em dBFS
 * crestDb = truePeakDbtp - rmsDbfs
 * assert(crestDb >= 0 && crestDb <= 20)
 */
export class CrestFactorCalculator {
  
  /**
   * 🎯 Calcular Crest Factor seguindo especificação exata
   * @param {Float32Array} leftChannel - Canal esquerdo
   * @param {Float32Array} rightChannel - Canal direito  
   * @param {number} truePeakDbtp - True Peak em dBTP (será tratado como dBFS)
   * @returns {Object} Resultado do cálculo do Crest Factor
   */
  static calculateCrestFactor(leftChannel, rightChannel, truePeakDbtp = null) {
    try {
      const length = Math.min(leftChannel.length, rightChannel.length);
      
      if (length === 0) {
        return null;
      }
      
      let sumSquares = 0;
      
      // Calcular RMS do canal médio
      for (let i = 0; i < length; i++) {
        const midSample = (leftChannel[i] + rightChannel[i]) / 2;
        sumSquares += midSample * midSample;
      }
      
      if (sumSquares === 0) {
        logAudio('dynamics', 'crest_silence_detected', { samples: length });
        return null;
      }
      
      const rmsLinear = Math.sqrt(sumSquares / length);
      
      if (rmsLinear < DYNAMICS_CONFIG.CREST_MIN_RMS) {
        logAudio('dynamics', 'crest_insufficient_rms', { 
          rmsLinear: rmsLinear.toExponential(3) 
        });
        return null;
      }
      
      // ESPECIFICAÇÃO: tudo em dBFS
      const rmsDbfs = 20 * Math.log10(rmsLinear);   // se ainda estiver em linear
      const peakDbfs = truePeakDbtp;                // trate dBTP como dBFS para crest
      
      if (peakDbfs === null || !isFinite(peakDbfs)) {
        logAudio('dynamics', 'crest_no_true_peak', { truePeakDbtp });
        return null;
      }
      
      const crestDb = peakDbfs - rmsDbfs;
      
      // ESPECIFICAÇÃO: assert(crestDb >= 0 && crestDb <= 20)
      if (crestDb < 0 || crestDb > 20 || !isFinite(crestDb)) {
        logAudio('dynamics', 'crest_out_of_range', { 
          peakDbfs: peakDbfs.toFixed(2), 
          rmsDbfs: rmsDbfs.toFixed(2), 
          crestDb: crestDb.toFixed(2),
          valid: false
        });
        
        // Retornar mesmo assim, mas marcar como inválido
        return {
          crestFactorDb: crestDb,
          peakDbfs: peakDbfs,
          rmsDbfs: rmsDbfs,
          rmsLinear: rmsLinear,
          valid: false,
          outOfRange: true,
          algorithm: 'TruePeak_dBTP_minus_RMS_dBFS',
          assertion: 'FAILED: crestDb should be 0-20 dB'
        };
      }
      
      // Log para auditoria
      logAudio('dynamics', 'crest_calculated', {
        peakDbfs: peakDbfs.toFixed(2),
        rmsDbfs: rmsDbfs.toFixed(2),
        crestFactorDb: crestDb.toFixed(2),
        samples: length,
        assertion: 'PASSED: 0 <= crestDb <= 20'
      });
      
      return {
        crestFactorDb: crestDb,
        peakDbfs: peakDbfs,
        rmsDbfs: rmsDbfs,
        rmsLinear: rmsLinear,
        valid: true,
        outOfRange: false,
        algorithm: 'TruePeak_dBTP_minus_RMS_dBFS',
        assertion: 'PASSED: 0 <= crestDb <= 20',
        interpretation: this.interpretCrestFactor(crestDb)
      };
      
    } catch (error) {
      logAudio('dynamics', 'crest_error', { error: error.message });
      return null;
    }
  }
  
  /**
   * 📊 Interpretar valor do Crest Factor
   */
  static interpretCrestFactor(crestDb) {
    if (crestDb < 6) {
      return { level: 'heavily_compressed', description: 'Muito comprimido' };
    } else if (crestDb < 12) {
      return { level: 'moderately_compressed', description: 'Moderadamente comprimido' };
    } else if (crestDb < 18) {
      return { level: 'lightly_compressed', description: 'Levemente comprimido' };
    } else {
      return { level: 'natural_dynamics', description: 'Dinâmica natural' };
    }
  }
}

/**
 * 📊 LRA (Loudness Range) Helper - para extensão futura
 * Nota: LRA principal está em loudness.js, esta é extensão
 */
export class LRACalculator {
  
  /**
   * 🎯 Validar LRA existente e adicionar contexto
   */
  static validateAndEnhanceLRA(lraValue, shortTermValues = []) {
    if (lraValue === null || !isFinite(lraValue)) {
      return null;
    }
    
    // Adicionar contexto profissional
    const interpretation = this.interpretLRA(lraValue);
    
    return {
      lra: lraValue,
      interpretation,
      silenceDetected: lraValue < 0.5,
      validMeasurement: lraValue >= 0.1 && isFinite(lraValue),
      algorithm: 'ITU_BS_1770_4_with_gating'
    };
  }
  
  /**
   * 📈 Interpretar valor LRA
   */
  static interpretLRA(lra) {
    if (lra < 1) {
      return { level: 'very_compressed', description: 'Extremamente comprimido' };
    } else if (lra < 3) {
      return { level: 'compressed', description: 'Muito comprimido' };
    } else if (lra < 6) {
      return { level: 'moderate', description: 'Moderadamente dinâmico' };
    } else if (lra < 10) {
      return { level: 'dynamic', description: 'Dinâmico' };
    } else {
      return { level: 'very_dynamic', description: 'Muito dinâmico' };
    }
  }
}

/**
 * 🎛️ Agregador principal das métricas de dinâmica
 */
export function calculateDynamicsMetrics(leftChannel, rightChannel, sampleRate = 48000, existingLRA = null, truePeakDbtp = null) {
  const dr = DynamicRangeCalculator.calculateDynamicRange(leftChannel, rightChannel, sampleRate);
  const crest = CrestFactorCalculator.calculateCrestFactor(leftChannel, rightChannel, truePeakDbtp);
  const lra = LRACalculator.validateAndEnhanceLRA(existingLRA);
  
  return {
    dynamicRange: dr?.dynamicRange || null,
    dynamicRangeDetails: dr,
    crestFactor: crest?.crestFactorDb || null,  // Atualizado para usar crestFactorDb
    crestFactorDetails: crest,
    lra: lra?.lra || null,
    lraDetails: lra
  };
}

console.log('🎚️ Dynamics Metrics Calculator carregado - DR, Crest Factor e LRA profissionais');