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
 *   - Margem de segurança: +0.05 dB (mínima — apenas cobre imprecisão do medidor)
 *   - Preciso e previsível: resultado esperado ≈ -1.05 dBTP
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
const SAFETY_MARGIN = 0.05;    // Margem mínima: apenas cobre imprecisão de medição do loudnorm (~±0.03 dB)

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

/**
 * Mede True Peak de um arquivo já gerado (pós-ganho).
 * Reutiliza o mesmo método de analyzeTruePeak para consistência de medição.
 */
function measureTruePeakOfFile(filePath) {
  return analyzeTruePeak(filePath);
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
    // toFixed(4): 4 casas decimais (~0.0001 dB de resolução) sem riscos de parsing
    const args = [
      '-y',
      '-i', inputPath,
      '-af', `volume=${gainDB.toFixed(4)}dB`,
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

    // 5. Calcular ganho negativo mínimo necessário
    //
    // Fórmula exata:
    //   gainDB = (TARGET_TP - inputTP) - SAFETY_MARGIN
    //          = (-1.0 - inputTP) - 0.05
    //
    // Exemplos:
    //   inputTP = +1.90 → gainDB = -1.0 - 1.90 - 0.05 = -2.95 dB → resultado ≈ -1.05 dBTP
    //   inputTP = +0.40 → gainDB = -1.0 - 0.40 - 0.05 = -1.45 dB → resultado ≈ -1.05 dBTP
    //   inputTP = -0.80 → não entra aqui (já está abaixo do target)
    //
    // Nota: gainDB é negativo (redução). SAFETY_MARGIN cobre imprecisão do loudnorm (~±0.03 dB).
    const gainDB = (TARGET_TP - inputTP) - SAFETY_MARGIN;

    console.error(`[FIX-TP] Antes: ${inputTP.toFixed(3)} dBTP  |  Target: ${TARGET_TP} dBTP  |  Gain a aplicar: ${gainDB.toFixed(3)} dB`);

    // 6. Aplicar correção (preservando sample rate)
    const outputPath = await applyGainCorrection(inputPath, gainDB, sampleRate);

    // 7. Verificação pós-ganho (pós-medida interna)
    //    Garante que o resultado real está dentro do limite antes de retornar.
    //    Se a estimativa do loudnorm tiver desvio que ultrapasse a SAFETY_MARGIN,
    //    aplica ajuste fino sem nova margem.
    const tpAfterGain = await measureTruePeakOfFile(outputPath);
    console.error(`[FIX-TP] Após fix: ${tpAfterGain.toFixed(3)} dBTP`);

    let finalOutputPath = outputPath;
    let totalGainApplied = gainDB;
    let fineTuneApplied = false;

    if (tpAfterGain > TARGET_TP) {
      // Ajuste fino: exatamente a diferença restante + mínima margem de 0.02 dB
      const fineTuneGain = (TARGET_TP - tpAfterGain) - 0.02;
      console.error(`[FIX-TP] Ajuste fino necessário: ${tpAfterGain.toFixed(3)} dBTP > ${TARGET_TP} dBTP → aplicando ${fineTuneGain.toFixed(3)} dB`);
      finalOutputPath = await applyGainCorrection(outputPath, fineTuneGain, sampleRate);
      // Sobrescrever outputPath com o resultado do ajuste fino
      fs.renameSync(finalOutputPath, outputPath);
      finalOutputPath = outputPath;
      totalGainApplied = parseFloat((gainDB + fineTuneGain).toFixed(4));
      fineTuneApplied = true;
      const tpAfterFineTune = await measureTruePeakOfFile(outputPath);
      console.error(`[FIX-TP] Após ajuste fino: ${tpAfterFineTune.toFixed(3)} dBTP`);
    }

    // 8. Retornar resultado
    outputResult({
      status: 'FIXED',
      message: 'True Peak corrigido com ganho negativo.',
      input_tp: parseFloat(inputTP.toFixed(3)),
      tp_after_fix: parseFloat(tpAfterGain.toFixed(3)),
      applied_gain_db: parseFloat(totalGainApplied.toFixed(3)),
      fine_tune_applied: fineTuneApplied,
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
