#!/usr/bin/env node
/**
 * AutoMaster V1 - Correção de True Peak
 * 
 * OBJETIVO: Tornar uma mix tecnicamente válida (True Peak seguro).
 * 
 * Este módulo NÃO é masterização:
 *   - Aplica APENAS ganho negativo (volume)
 *   - NÃO usa limiter, compressor ou EQ
 *   - NÃO consome crédito do usuário
 *   - NÃO promete melhoria sonora
 * 
 * Filosofia:
 *   - Target fixo: -1.0 dBTP (seguro para qualquer plataforma)
 *   - Margem de segurança: +0.2 dB
 *   - Conservador e previsível
 * 
 * Uso:
 *   node fix-true-peak.cjs <input.wav>
 * 
 * Saída:
 *   - JSON puro no stdout
 *   - Arquivo: <input>_safe.wav (se correção aplicada)
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONSTANTES
// ============================================================

const TARGET_TP = -1.0;        // dBTP seguro para pré-master
const SAFETY_MARGIN = 0.2;     // Margem adicional de segurança

// ============================================================
// VALIDAÇÃO DE ENTRADA
// ============================================================

function validateInput() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    exitWithError('INVALID_ARGS', 'Uso: node fix-true-peak.cjs <input.wav>');
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
// DETECÇÃO DE SAMPLE RATE
// ============================================================

function detectInputSampleRate(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=sample_rate',
      '-of', 'json',
      inputPath
    ];

    execFile('ffprobe', args, { maxBuffer: 10 * 1024 * 1024, timeout: 10000 }, (error, stdout) => {
      if (error) {
        reject(new Error(`Erro ao detectar sample rate: ${error.message}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const sampleRate = parseInt(data.streams[0].sample_rate, 10);
        
        if (isNaN(sampleRate) || sampleRate <= 0) {
          reject(new Error('Sample rate inválido'));
          return;
        }
        
        resolve(sampleRate);
      } catch (parseError) {
        reject(new Error(`Erro ao parsear ffprobe JSON: ${parseError.message}`));
      }
    });
  });
}

// ============================================================
// ANÁLISE DE TRUE PEAK
// ============================================================

function analyzeTruePeak(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-af', 'loudnorm=I=-16:TP=-1.0:LRA=7:print_format=json',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        // loudnorm imprime JSON no stderr
        const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
        if (!jsonMatch) {
          reject(new Error('Não foi possível extrair True Peak do áudio'));
          return;
        }

        const data = JSON.parse(jsonMatch[0]);
        const inputTP = parseFloat(data.input_tp);

        if (isNaN(inputTP)) {
          reject(new Error('True Peak inválido retornado pelo FFmpeg'));
          return;
        }

        resolve(inputTP);
      } catch (parseError) {
        reject(new Error(`Erro ao analisar True Peak: ${parseError.message}`));
      }
    });
  });
}

// ============================================================
// APLICAÇÃO DE GANHO NEGATIVO
// ============================================================

function applyGainCorrection(inputPath, gainDB, sampleRate) {
  return new Promise((resolve, reject) => {
    // Gerar nome do arquivo de saída
    const inputDir = path.dirname(inputPath);
    const inputBase = path.basename(inputPath, '.wav');
    const outputPath = path.join(inputDir, `${inputBase}_safe.wav`);

    // Aplicar APENAS ganho negativo (sem limiter, sem compressor)
    const args = [
      '-y',
      '-i', inputPath,
      '-af', `volume=${gainDB.toFixed(2)}dB`,
      '-ar', sampleRate.toString(),
      outputPath
    ];

    execFile('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Erro ao aplicar correção: ${error.message}`));
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error('Arquivo corrigido não foi criado'));
        return;
      }

      resolve(outputPath);
    });
  });
}

// ============================================================
// SAÍDA JSON
// ============================================================

function outputResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function exitWithError(code, message) {
  const result = {
    status: 'ERROR',
    code,
    message
  };
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  try {
    // 1. Validar entrada
    const inputPath = validateInput();

    // 2. Detectar sample rate (para preservação)
    const sampleRate = await detectInputSampleRate(inputPath);

    // 3. Analisar True Peak
    const inputTP = await analyzeTruePeak(inputPath);

    // 4. Verificar se precisa correção
    if (inputTP <= TARGET_TP) {
      // Já está seguro
      outputResult({
        status: 'OK',
        message: 'True Peak dentro do limite seguro. Nenhuma correção necessária.',
        input_tp: parseFloat(inputTP.toFixed(2)),
        target_tp: TARGET_TP,
        action: 'none'
      });
      process.exit(0);
      return;
    }

    // 5. Calcular ganho negativo necessário
    // Fórmula: gain = input_tp - target + margem
    // Exemplo: input_tp = +0.11 → gain = 0.11 - (-1.0) + 0.2 = 1.31 dB de redução
    const gainDB = -(inputTP - TARGET_TP + SAFETY_MARGIN);

    // 6. Aplicar correção (preservando sample rate)
    const outputPath = await applyGainCorrection(inputPath, gainDB, sampleRate);

    // 7. Retornar resultado
    outputResult({
      status: 'FIXED',
      message: 'True Peak corrigido com ganho negativo.',
      input_tp: parseFloat(inputTP.toFixed(2)),
      applied_gain_db: parseFloat(gainDB.toFixed(2)),
      output_file: path.basename(outputPath),
      target_tp: TARGET_TP,
      safety_margin: SAFETY_MARGIN,
      action: 'volume_reduction'
    });

    process.exit(0);

  } catch (error) {
    exitWithError('INTERNAL_ERROR', error.message);
  }
}

// Executar
main();
