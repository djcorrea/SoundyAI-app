// 🥁 BPM ANALYZER - Detecção de BPM usando music-tempo
// Módulo isolado para análise de tempo/ritmo sem impactar métricas existentes

import MusicTempo from "music-tempo";

/**
 * calculateBpm(frames, sampleRate)
 * Calcula BPM a partir dos frames de áudio processados
 * 
 * @param {Array} frames - Frames de áudio (array de arrays ou flat array)
 * @param {number} sampleRate - Taxa de amostragem (geralmente 48000)
 * @returns {Object} { bpm: number|null, confidence: number }
 */
export function calculateBpm(frames, sampleRate = 48000) {
  try {
    console.log('[BPM] Iniciando cálculo de BPM...');
    
    // Validar entrada
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      console.warn('[BPM] Frames inválidos ou vazios');
      return { bmp: null, confidence: 0 };
    }

    // Garantir que temos um sinal flat (concatenar canais se necessário)
    let signal;
    if (Array.isArray(frames[0])) {
      // Se frames é array de arrays, flatten
      signal = frames.flat();
    } else {
      // Já é um array flat
      signal = frames;
    }

    if (signal.length < 1000) {
      console.warn('[BPM] Sinal muito curto para análise de BPM');
      return { bpm: null, confidence: 0 };
    }

    console.log(`[BPM] Processando sinal de ${signal.length} amostras @ ${sampleRate}Hz`);

    // Criar onset envelope simples baseado na energia do sinal
    const peaks = [];
    const windowSize = Math.floor(sampleRate * 0.1); // Janela de 100ms
    
    for (let i = windowSize; i < signal.length - windowSize; i += windowSize) {
      let energy = 0;
      let prevEnergy = 0;
      
      // Energia da janela atual
      for (let j = i; j < i + windowSize; j++) {
        energy += Math.abs(signal[j]);
      }
      
      // Energia da janela anterior
      for (let j = i - windowSize; j < i; j++) {
        prevEnergy += Math.abs(signal[j]);
      }
      
      // Detectar onset se a energia aumentou significativamente
      if (energy > prevEnergy * 1.3 && energy > 0.02) {
        peaks.push(i / sampleRate); // Converter para segundos
      }
    }

    console.log(`[BPM] Detectados ${peaks.length} picos/onsets`);

    if (peaks.length < 4) {
      console.warn('[BPM] Muito poucos picos detectados para análise');
      return { bpm: null, confidence: 0 };
    }

    // Usar music-tempo para calcular BPM
    const mt = new MusicTempo(peaks);
    const detectedBpm = Math.round(mt.tempo);
    const confidence = mt.confidence || 0.8;

    console.log(`[BPM] BPM detectado: ${detectedBpm}, confiança: ${confidence.toFixed(2)}`);

    // Validar range de BPM (60-200 é um range razoável)
    if (detectedBpm < 60 || detectedBpm > 200) {
      console.warn(`[BPM] BPM fora do range esperado: ${detectedBpm}`);
      return { bpm: null, confidence: 0 };
    }

    return { 
      bpm: detectedBpm, 
      confidence: Math.min(1, Math.max(0, confidence))
    };

  } catch (err) {
    console.error("[BPM] Erro ao calcular BPM:", err);
    return { bpm: null, confidence: 0 };
  }
}

console.log('🥁 BPM Analyzer carregado');