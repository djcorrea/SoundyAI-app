#!/usr/bin/env node
/**
 * AutoMaster V1 - Rescue Mode (Gain-Only)
 * 
 * OBJETIVO: Criar headroom técnico aplicando APENAS ganho (volume).
 * 
 * Filosofia conservadora:
 *   - NÃO usa limiter, compressor, EQ ou saturação
 *   - APENAS volume (atenuação)
 *   - Se não resolver com ganho simples => ABORTAR
 * 
 * Fluxo:
 *   1. Medir TP atual
 *   2. Calcular ganho: desired_tp (-1.2 dBTP) - TP_in
 *   3. Aplicar ganho (se negativo)
 *   4. Medir novamente
 *   5. Se TP_after > -1.0 dBTP => ABORT (ISP/clipping não corrigível)
 *   6. Se OK => retornar arquivo temporário
 * 
 * Uso:
 *   node rescue-mode.cjs <input.wav> <output_tmp.wav>
 * 
 * Saída:
 *   JSON: { status: "RESCUED" | "ABORT_UNSAFE", ... }
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONSTANTES
// ============================================================

const DESIRED_TP = -1.2;  // Target conservador para criar headroom
const SAFE_TP_LIMIT = -1.0;  // Limite de segurança após ganho

// ============================================================
// VALIDAÇÃO DE ENTRADA
// ============================================================

function validateInput() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    exitWithError('INVALID_ARGS', 'Uso: node rescue-mode.cjs <input.wav> <output_tmp.wav>');
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = path.resolve(args[1]);

  if (!fs.existsSync(inputPath)) {
    exitWithError('FILE_NOT_FOUND', `Arquivo não encontrado: ${inputPath}`);
  }

  const inputExt = path.extname(inputPath).toLowerCase();
  if (inputExt !== '.wav') {
    exitWithError('INVALID_FORMAT', `Input deve ser WAV (recebido: ${inputExt})`);
  }

  const outputExt = path.extname(outputPath).toLowerCase();
  if (outputExt !== '.wav') {
    exitWithError('INVALID_FORMAT', `Output deve ser WAV (recebido: ${outputExt})`);
  }

  return { inputPath, outputPath };
}

// ============================================================
// MEDIÇÃO DE TRUE PEAK
// ============================================================

function measureTruePeak(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-nostats',
      '-i', filePath,
      '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
        
        if (!jsonMatch) {
          reject(new Error('Não foi possível extrair True Peak'));
          return;
        }

        const data = JSON.parse(jsonMatch[0]);
        const tp = parseFloat(data.input_tp);

        if (isNaN(tp)) {
          reject(new Error('True Peak inválido'));
          return;
        }

        resolve(tp);
      } catch (parseError) {
        reject(new Error(`Erro ao medir True Peak: ${parseError.message}`));
      }
    });
  });
}

// ============================================================
// APLICAÇÃO DE GANHO (VOLUME)
// ============================================================

function applyGainOnly(inputPath, outputPath, gainDb) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-hide_banner',
      '-nostats',
      '-i', inputPath,
      '-af', `volume=${gainDb.toFixed(4)}dB`,
      '-ar', '44100',
      '-c:a', 'pcm_s16le',
      outputPath
    ];

    execFile('ffmpeg', args, { timeout: 180000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Erro ao aplicar ganho: ${error.message}`));
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error('Arquivo de saída não foi criado'));
        return;
      }

      resolve(outputPath);
    });
  });
}

// ============================================================
// LÓGICA PRINCIPAL DO RESCUE MODE
// ============================================================

async function runRescueMode(inputPath, outputPath) {
  try {
    // 1. Medir True Peak do arquivo original
    const tpBefore = await measureTruePeak(inputPath);

    // 2. Verificar se já está OK
    if (tpBefore <= SAFE_TP_LIMIT) {
      return {
        status: 'ALREADY_SAFE',
        message: 'Arquivo já possui True Peak seguro. Nenhuma atenuação necessária.',
        tp_before: parseFloat(tpBefore.toFixed(2)),
        tp_after: parseFloat(tpBefore.toFixed(2)),
        gain_applied_db: 0,
        output_file: null
      };
    }

    // 3. Calcular ganho necessário
    const gainDb = DESIRED_TP - tpBefore;

    // Se ganho >= 0, não precisa atenuar
    if (gainDb >= 0) {
      return {
        status: 'ALREADY_SAFE',
        message: 'True Peak dentro do limite. Nenhuma atenuação necessária.',
        tp_before: parseFloat(tpBefore.toFixed(2)),
        tp_after: parseFloat(tpBefore.toFixed(2)),
        gain_applied_db: 0,
        output_file: null
      };
    }

    // 4. Aplicar ganho negativo (atenuação)
    await applyGainOnly(inputPath, outputPath, gainDb);

    // 5. Medir novamente
    const tpAfter = await measureTruePeak(outputPath);

    // 6. Verificar se resolveu
    if (tpAfter > SAFE_TP_LIMIT) {
      // Limpar arquivo temporário
      fs.unlinkSync(outputPath);

      return {
        status: 'ABORT_UNSAFE_INPUT',
        message: 'Arquivo possui picos inter-sample ou limitação prévia que impede correção segura. Reenvie um pré-master sem processamento.',
        tp_before: parseFloat(tpBefore.toFixed(2)),
        tp_after: parseFloat(tpAfter.toFixed(2)),
        gain_applied_db: parseFloat(gainDb.toFixed(2)),
        output_file: null,
        details: 'Mesmo após atenuação por ganho, True Peak continua acima do limite de segurança.'
      };
    }

    // 7. Sucesso - arquivo rescatado
    return {
      status: 'RESCUED',
      message: 'Headroom técnico criado com sucesso via gain-only.',
      tp_before: parseFloat(tpBefore.toFixed(2)),
      tp_after: parseFloat(tpAfter.toFixed(2)),
      gain_applied_db: parseFloat(gainDb.toFixed(2)),
      output_file: path.basename(outputPath),
      output_path: outputPath
    };

  } catch (error) {
    throw new Error(`Rescue Mode falhou: ${error.message}`);
  }
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
    const { inputPath, outputPath } = validateInput();
    const result = await runRescueMode(inputPath, outputPath);
    
    outputResult(result);
    
    // Exit code baseado no status
    const exitCode = (result.status === 'RESCUED' || result.status === 'ALREADY_SAFE') ? 0 : 1;
    process.exit(exitCode);
    
  } catch (error) {
    exitWithError('RESCUE_ERROR', error.message);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

// Exportar para uso programático
module.exports = { runRescueMode, DESIRED_TP, SAFE_TP_LIMIT };
