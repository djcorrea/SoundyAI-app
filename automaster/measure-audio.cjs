#!/usr/bin/env node
/**
 * AutoMaster V1 - Medição Técnica de Áudio
 * 
 * OBJETIVO: Medir True Peak (dBTP) e Integrated Loudness (LUFS-I) usando FFmpeg loudnorm.
 * 
 * Este script APENAS MEDE. Nunca modifica arquivos.
 * 
 * Uso:
 *   node measure-audio.cjs <input.wav>
 * 
 * Saída:
 *   JSON puro no stdout com { lufs_i, true_peak_db }
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// VALIDAÇÃO DE ENTRADA
// ============================================================

function validateInput() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    exitWithError('INVALID_ARGS', 'Uso: node measure-audio.cjs <input.wav>');
  }

  const inputPath = path.resolve(args[0]);

  if (!fs.existsSync(inputPath)) {
    exitWithError('FILE_NOT_FOUND', `Arquivo não encontrado: ${inputPath}`);
  }

  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== '.wav') {
    exitWithError('INVALID_FORMAT', `Apenas WAV é suportado (recebido: ${ext})`);
  }

  return inputPath;
}

// ============================================================
// MEDIÇÃO VIA FFMPEG LOUDNORM
// ============================================================

function measureAudio(inputPath) {
  return new Promise((resolve, reject) => {
    // Usar loudnorm em modo análise para extrair LUFS-I e True Peak
    const args = [
      '-hide_banner',
      '-nostats',
      '-i', inputPath,
      '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        // loudnorm imprime JSON no stderr
        const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
        
        if (!jsonMatch) {
          reject(new Error('Não foi possível extrair métricas do loudnorm'));
          return;
        }

        const data = JSON.parse(jsonMatch[0]);
        
        const lufs_i = parseFloat(data.input_i);
        const true_peak_db = parseFloat(data.input_tp);

        if (isNaN(lufs_i) || isNaN(true_peak_db)) {
          reject(new Error('Métricas inválidas retornadas pelo FFmpeg'));
          return;
        }

        resolve({
          lufs_i: parseFloat(lufs_i.toFixed(2)),
          true_peak_db: parseFloat(true_peak_db.toFixed(2))
        });
      } catch (parseError) {
        reject(new Error(`Erro ao parsear loudnorm: ${parseError.message}`));
      }
    });
  });
}

// ============================================================
// SAÍDA JSON
// ============================================================

function outputResult(result) {
  console.log(JSON.stringify(result));
}

function exitWithError(code, message) {
  const result = {
    error: code,
    message
  };
  
  console.error(JSON.stringify(result));
  process.exit(1);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  try {
    const inputPath = validateInput();
    const metrics = await measureAudio(inputPath);
    outputResult(metrics);
    process.exit(0);
  } catch (error) {
    exitWithError('MEASUREMENT_ERROR', error.message);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

// Exportar para uso programático
module.exports = { measureAudio };
