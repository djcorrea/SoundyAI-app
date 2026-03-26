#!/usr/bin/env node
/**
 * AutoMaster V1 - Precheck Gate Técnico
 * 
 * OBJETIVO: Determinar se uma faixa PODE ou NÃO seguir para masterização.
 * 
 * Este script APENAS ANALISA. Nunca modifica arquivos.
 * 
 * Uso:
 *   node precheck-audio.cjs <input.wav>
 * 
 * Saída:
 *   JSON puro no stdout com status: OK | WARNING | BLOCKED
 * 
 * Proibido:
 *   - Masterizar, aplicar efeitos, normalizar, renderizar
 *   - Usar IA, sugerir UX, integrar com API/filas
 *   - Inventar métricas ou usar heurística criativa
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONSTANTES DE GATE (REGRAS CONSERVADORAS)
// ============================================================

// Validação básica
const MIN_DURATION_SEC = 10;
const VALID_SAMPLE_RATES = [44100, 48000];
const VALID_CHANNELS = [1, 2]; // mono ou stereo

// Thresholds para classificação
const GATE_RULES = {
  // BLOCKED: condições que impedem masterização
  BLOCKED: {
    max_true_peak_db: -0.1,         // Clipping iminente
    min_duration_sec: 10,            // Muito curta
    max_silence_ratio: 0.5,          // >50% silêncio
    min_estimated_dr: 3,             // DR crítico (over-compressed)
  },
  
  // WARNING: riscos técnicos mas pode processar
  WARNING: {
    min_integrated_lufs: -8,         // Já muito alto
    max_lra: 3,                      // Muito "achatado"
    min_true_peak_db: -0.5,          // Próximo de clipar
  }
};

// ============================================================
// VALIDAÇÃO DE ENTRADA
// ============================================================

function validateInput() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    exitWithError('INVALID_ARGS', 'Uso: node precheck-audio.cjs <input.wav>');
  }

  const inputPath = path.resolve(args[0]);

  // Validar existência
  if (!fs.existsSync(inputPath)) {
    exitWithError('FILE_NOT_FOUND', `Arquivo não encontrado: ${inputPath}`);
  }

  // Validar extensão
  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== '.wav') {
    exitWithError('INVALID_FORMAT', `Apenas WAV é suportado (recebido: ${ext})`);
  }

  return inputPath;
}

// ============================================================
// VERIFICAÇÃO DE FFMPEG
// ============================================================

function checkFFmpeg() {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-version'], { timeout: 5000 }, (error) => {
      if (error) {
        reject(new Error('FFmpeg não encontrado no PATH'));
      } else {
        resolve();
      }
    });
  });
}

// ============================================================
// NORMALIZAÇÃO DE ENTRADA (garante decode consistente entre ambientes)
// ============================================================

function normalizeInput(inputPath) {
  const normalizedPath = path.join(
    path.dirname(inputPath),
    `__precheck_norm_${Date.now()}.wav`
  );

  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '2',
      normalizedPath
    ];

    execFile('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Normalização falhou: ${stderr || error.message}`));
        return;
      }

      console.error('[PRECHECK NORMALIZED]', JSON.stringify({ input: inputPath, normalized: normalizedPath }));
      resolve(normalizedPath);
    });
  });
}

// ============================================================
// EXTRAÇÃO DE MÉTRICAS (FFprobe + FFmpeg)
// ============================================================

async function extractMetrics(inputPath, normalizedPath) {
  // 1. Métricas básicas via ffprobe (do original — duration, sample_rate, channels)
  const basicMetrics = await getBasicMetrics(inputPath);
  
  // 2. Métricas de loudness via ffmpeg loudnorm (do arquivo normalizado)
  const loudnessMetrics = await getLoudnessMetrics(normalizedPath);
  
  // 3. Silêncio via ffmpeg silencedetect (do arquivo normalizado)
  const silenceRatio = await getSilenceRatio(normalizedPath, basicMetrics.duration_sec);
  
  // 4. Dynamic Range via leitura direta do FFmpeg astats
  const estimatedDR = await getDynamicRangeFFmpeg(normalizedPath);

  return {
    duration_sec: basicMetrics.duration_sec,
    sample_rate: basicMetrics.sample_rate,
    channels: basicMetrics.channels,
    integrated_lufs: loudnessMetrics.integrated_lufs,
    true_peak_db: loudnessMetrics.true_peak_db,
    lra: loudnessMetrics.lra,
    estimated_dr: estimatedDR,
    silence_ratio: silenceRatio
  };
}

// ============================================================
// MÉTRICAS BÁSICAS (via ffprobe)
// ============================================================

function getBasicMetrics(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=sample_rate,channels',
      '-of', 'json',
      inputPath
    ];

    execFile('ffprobe', args, { timeout: 10000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`ffprobe falhou: ${stderr || error.message}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const stream = data.streams && data.streams[0];
        
        if (!stream) {
          reject(new Error('Stream de áudio não encontrado'));
          return;
        }

        const duration = parseFloat(data.format.duration);
        const sampleRate = parseInt(stream.sample_rate, 10);
        const channels = parseInt(stream.channels, 10);

        // Validar valores
        if (isNaN(duration) || duration < MIN_DURATION_SEC) {
          exitWithError('INVALID_DURATION', `Duração mínima: ${MIN_DURATION_SEC}s (encontrado: ${duration.toFixed(1)}s)`);
        }

        if (!VALID_SAMPLE_RATES.includes(sampleRate)) {
          exitWithError('INVALID_SAMPLE_RATE', `Sample rate inválido: ${sampleRate} (aceito: ${VALID_SAMPLE_RATES.join(', ')})`);
        }

        if (!VALID_CHANNELS.includes(channels)) {
          exitWithError('INVALID_CHANNELS', `Canais inválidos: ${channels} (aceito: mono/stereo)`);
        }

        resolve({
          duration_sec: Math.round(duration * 10) / 10,
          sample_rate: sampleRate,
          channels: channels
        });
      } catch (parseError) {
        reject(new Error(`Erro ao parsear ffprobe: ${parseError.message}`));
      }
    });
  });
}

// ============================================================
// MÉTRICAS DE LOUDNESS (via ffmpeg loudnorm)
// ============================================================

function getLoudnessMetrics(inputPath) {
  return new Promise((resolve, reject) => {
    // loudnorm em modo análise (print_format=json)
    const args = [
      '-i', inputPath,
      '-af', 'loudnorm=print_format=json',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      // loudnorm imprime JSON no stderr
      try {
        // Extrair bloco JSON do stderr
        const jsonMatch = stderr.match(/\{[\s\S]*"input_i"[\s\S]*\}/);
        if (!jsonMatch) {
          reject(new Error('Não foi possível extrair métricas de loudness'));
          return;
        }

        const data = JSON.parse(jsonMatch[0]);
        
        resolve({
          integrated_lufs: parseFloat(data.input_i) || null,
          true_peak_db: parseFloat(data.input_tp) || null,
          lra: parseFloat(data.input_lra) || null
        });
      } catch (parseError) {
        reject(new Error(`Erro ao parsear loudnorm: ${parseError.message}`));
      }
    });
  });
}

// ============================================================
// DETECÇÃO DE SILÊNCIO (via ffmpeg silencedetect)
// ============================================================

function getSilenceRatio(inputPath, durationSec) {
  return new Promise((resolve, reject) => {
    // Detectar silêncios abaixo de -50dB por mais de 0.5s
    const args = [
      '-i', inputPath,
      '-af', 'silencedetect=n=-50dB:d=0.5',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        // silencedetect imprime no stderr
        const silenceMatches = stderr.match(/silence_duration: ([\d.]+)/g);
        
        if (!silenceMatches || silenceMatches.length === 0) {
          resolve(0); // Sem silêncios detectados
          return;
        }

        // Somar todas as durações de silêncio
        let totalSilence = 0;
        for (const match of silenceMatches) {
          const duration = parseFloat(match.split(': ')[1]);
          totalSilence += duration;
        }

        const ratio = totalSilence / durationSec;
        resolve(Math.round(ratio * 1000) / 1000); // 3 casas decimais
      } catch (parseError) {
        resolve(null); // Se falhar, não bloquear
      }
    });
  });
}

// ============================================================
// DYNAMIC RANGE (leitura direta via astats do FFmpeg)
// ============================================================

function getDynamicRangeFFmpeg(filePath) {
  return new Promise((resolve) => {
    const args = [
      '-i', filePath,
      '-af', 'astats=metadata=1:reset=1',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        // astats imprime "Dynamic range: X.X" no stderr
        const drMatch = stderr.match(/Dynamic range:\s*([\d.]+)/);

        if (drMatch) {
          resolve(Math.round(parseFloat(drMatch[1]) * 10) / 10);
        } else {
          resolve(null);
        }
      } catch (_) {
        resolve(null);
      }
    });
  });
}

// ============================================================
// CLASSIFICAÇÃO (OK / WARNING / BLOCKED)
// ============================================================

function classify(metrics) {
  const reasons = [];

  // ============================================================
  // BLOCKED: Condições impeditivas
  // ============================================================

  // Clipping iminente
  if (metrics.true_peak_db !== null && metrics.true_peak_db > GATE_RULES.BLOCKED.max_true_peak_db) {
    return {
      status: 'BLOCKED',
      reason: `True Peak muito alto (${metrics.true_peak_db.toFixed(2)} dBTP). Risco de clipping.`
    };
  }

  // Duração muito curta
  if (metrics.duration_sec < GATE_RULES.BLOCKED.min_duration_sec) {
    return {
      status: 'BLOCKED',
      reason: `Duração muito curta (${metrics.duration_sec}s). Mínimo: ${GATE_RULES.BLOCKED.min_duration_sec}s.`
    };
  }

  // Silêncio excessivo
  if (metrics.silence_ratio !== null && metrics.silence_ratio > GATE_RULES.BLOCKED.max_silence_ratio) {
    return {
      status: 'BLOCKED',
      reason: `Silêncio excessivo (${(metrics.silence_ratio * 100).toFixed(1)}%). Faixa inválida.`
    };
  }

  // DR crítico (over-compressed)
  if (metrics.estimated_dr !== null && metrics.estimated_dr < GATE_RULES.BLOCKED.min_estimated_dr) {
    return {
      status: 'BLOCKED',
      reason: `Dynamic Range crítico (${metrics.estimated_dr} dB). Faixa já over-compressed.`
    };
  }

  // ============================================================
  // WARNING: Riscos técnicos mas pode processar
  // ============================================================

  // LUFS já muito alto
  if (metrics.integrated_lufs !== null && metrics.integrated_lufs > GATE_RULES.WARNING.min_integrated_lufs) {
    reasons.push(`LUFS alto (${metrics.integrated_lufs.toFixed(1)} LUFS)`);
  }

  // True Peak próximo de clipar
  if (metrics.true_peak_db !== null && metrics.true_peak_db > GATE_RULES.WARNING.min_true_peak_db) {
    reasons.push(`True Peak próximo de 0 (${metrics.true_peak_db.toFixed(2)} dBTP)`);
  }

  // LRA muito baixo (faixa "achatada")
  if (metrics.lra !== null && metrics.lra < GATE_RULES.WARNING.max_lra) {
    reasons.push(`LRA baixo (${metrics.lra.toFixed(1)} LU)`);
  }

  if (reasons.length > 0) {
    return {
      status: 'WARNING',
      reason: reasons.join('. ') + '. Risco técnico presente.'
    };
  }

  // ============================================================
  // OK: Apta para masterização
  // ============================================================

  return {
    status: 'OK',
    reason: 'Faixa tecnicamente apta para masterização.'
  };
}

// ============================================================
// SAÍDA JSON (stdout puro)
// ============================================================

function outputResult(status, reason, metrics) {
  const result = {
    status,
    reason,
    metrics
  };

  // JSON puro, sem logs adicionais
  console.log(JSON.stringify(result, null, 2));
}

function exitWithError(code, message) {
  // Saída JSON de erro
  const result = {
    status: 'BLOCKED',
    reason: `[${code}] ${message}`,
    metrics: null
  };
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  let normalizedPath = null;

  try {
    // 1. Validar entrada
    const inputPath = validateInput();

    // 2. Verificar FFmpeg
    await checkFFmpeg();

    // 3. Normalizar input (garante decode consistente entre ambientes)
    normalizedPath = await normalizeInput(inputPath);

    // 4. Extrair métricas
    const metrics = await extractMetrics(inputPath, normalizedPath);

    // 5. Classificar
    const { status, reason } = classify(metrics);

    // 6. Saída JSON pura
    outputResult(status, reason, metrics);

    // Cleanup antes de sair
    if (normalizedPath && fs.existsSync(normalizedPath)) {
      try { fs.unlinkSync(normalizedPath); } catch (_) {}
    }

    // Exit code baseado em status
    process.exit(status === 'BLOCKED' ? 1 : 0);

  } catch (error) {
    // Cleanup em caso de erro
    if (normalizedPath && fs.existsSync(normalizedPath)) {
      try { fs.unlinkSync(normalizedPath); } catch (_) {}
    }
    exitWithError('INTERNAL_ERROR', error.message);
  }
}

// Executar
main();
