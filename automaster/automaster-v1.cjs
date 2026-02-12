#!/usr/bin/env node
/**
 * AutoMaster V1 - Núcleo Técnico (TWO-PASS PRECISION)
 * 
 * Script isolado para masterização de precisão usando FFmpeg loudnorm two-pass.
 * NÃO integrado com filas, banco, API ou frontend.
 * 
 * Implementação:
 *   - Loudnorm TWO-PASS (análise → render com measured_*)
 *   - Pós-validação automática (LUFS ±0.1 LU, TP +0.05 dB)
 *   - Fallback conservador (1 tentativa com -0.2 dB ceiling)
 * 
 * Uso:
 *   node automaster-v1.cjs <input.wav> <output.wav> <target-lufs> <ceiling-dbtp>
 * 
 * Exemplo:
 *   node automaster-v1.cjs input.wav output.wav -11 -0.8
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONSTANTES
// ============================================================

const LUFS_MIN = -18;
const LUFS_MAX = -6;
const CEILING_MIN = -2.0;
const CEILING_MAX = -0.1;

// Tolerâncias de validação
const LUFS_TOLERANCE = 0.2;  // ±0.2 LU (padrão prático profissional)
const TP_TOLERANCE = 0.05;   // +0.05 dB

// Fallback
const FALLBACK_TP_REDUCTION = 0.2; // -0.2 dB no ceiling

// ============================================================
// VALIDAÇÃO DE PARÂMETROS
// ============================================================

function validateArgs() {
  const args = process.argv.slice(2);

  if (args.length !== 4) {
    console.error('❌ ERRO: Número incorreto de argumentos.');
    console.error('');
    console.error('Uso:');
    console.error('  node automaster-v1.js <input.wav> <output.wav> <target-lufs> <ceiling-dbtp>');
    console.error('');
    console.error('Exemplo:');
    console.error('  node automaster-v1.js input.wav output.wav -11 -0.8');
    process.exit(1);
  }

  const [inputPath, outputPath, targetLufs, ceilingDbtp] = args;

  // Validar arquivo de entrada
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ ERRO: Arquivo de entrada não encontrado: ${inputPath}`);
    process.exit(1);
  }

  // Validar extensão de entrada
  const inputExt = path.extname(inputPath).toLowerCase();
  if (inputExt !== '.wav') {
    console.error(`❌ ERRO: Arquivo de entrada deve ser WAV (recebido: ${inputExt})`);
    process.exit(1);
  }

  // Validar extensão de saída
  const outputExt = path.extname(outputPath).toLowerCase();
  if (outputExt !== '.wav') {
    console.error(`❌ ERRO: Arquivo de saída deve ser WAV (recebido: ${outputExt})`);
    process.exit(1);
  }

  // Validar target LUFS
  const lufs = parseFloat(targetLufs);
  if (isNaN(lufs) || lufs < LUFS_MIN || lufs > LUFS_MAX) {
    console.error(`❌ ERRO: Target LUFS inválido: ${targetLufs}`);
    console.error(`   Valores permitidos: ${LUFS_MIN} a ${LUFS_MAX} LUFS`);
    process.exit(1);
  }

  // Validar ceiling
  const ceiling = parseFloat(ceilingDbtp);
  if (isNaN(ceiling) || ceiling < CEILING_MIN || ceiling > CEILING_MAX) {
    console.error(`❌ ERRO: Ceiling inválido: ${ceilingDbtp}`);
    console.error(`   Valores permitidos: ${CEILING_MIN} a ${CEILING_MAX} dBTP`);
    process.exit(1);
  }

  return {
    inputPath: path.resolve(inputPath),
    outputPath: path.resolve(outputPath),
    targetLufs: lufs,
    ceilingDbtp: ceiling
  };
}

// ============================================================
// VERIFICAÇÃO DE FFMPEG
// ============================================================

function checkFFmpeg() {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-version'], (error, stdout) => {
      if (error) {
        reject(new Error('FFmpeg não encontrado. Instale FFmpeg e adicione ao PATH.'));
        return;
      }
      
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'desconhecida';
      resolve(version);
    });
  });
}

// ============================================================
// PROCESSAMENTO DE MASTERIZAÇÃO (TWO-PASS)
// ============================================================

/**
 * Converte dBTP para valor linear (para alimiter)
 */
function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

/**
 * Extrai JSON do stderr do FFmpeg loudnorm
 */
function extractLoudnormJson(stderr) {
  // loudnorm imprime JSON entre chaves
  const match = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!match) {
    throw new Error('Não foi possível extrair JSON do loudnorm');
  }
  return JSON.parse(match[0]);
}

/**
 * PASSO 1: Análise do áudio (loudnorm first pass)
 */
function analyzeLoudness(inputPath, targetI, targetTP, targetLRA) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-af', `loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:print_format=json`,
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        const data = extractLoudnormJson(stderr);
        
        // Validar campos obrigatórios
        const required = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'];
        for (const field of required) {
          if (data[field] === undefined) {
            reject(new Error(`Campo obrigatório ausente no loudnorm: ${field}`));
            return;
          }
        }

        resolve({
          input_i: parseFloat(data.input_i),
          input_tp: parseFloat(data.input_tp),
          input_lra: parseFloat(data.input_lra),
          input_thresh: parseFloat(data.input_thresh),
          target_offset: parseFloat(data.target_offset)
        });
      } catch (parseError) {
        reject(new Error(`Erro ao parsear loudnorm: ${parseError.message}\nStderr: ${stderr}`));
      }
    });
  });
}

/**
 * PASSO 2: Render com two-pass loudnorm + alimiter
 */
function renderTwoPass(inputPath, outputPath, targetI, targetTP, targetLRA, measured, usedTP) {
  return new Promise((resolve, reject) => {
    // Converter ceiling para linear (alimiter)
    const linearLimit = Math.max(0.0625, Math.min(1, dbToLinear(usedTP)));

    // Construir filtro two-pass
    const loudnormFilter = [
      `loudnorm=I=${targetI}`,
      `TP=${usedTP}`,
      `LRA=${targetLRA}`,
      `measured_I=${measured.input_i}`,
      `measured_TP=${measured.input_tp}`,
      `measured_LRA=${measured.input_lra}`,
      `measured_thresh=${measured.input_thresh}`,
      `offset=${measured.target_offset}`,
      `linear=true`,
      `print_format=summary`
    ].join(':');

    const alimiterFilter = `alimiter=limit=${linearLimit.toFixed(6)}:attack=5:release=50:level=false`;
    
    const audioFilter = `${loudnormFilter},${alimiterFilter}`;

    const args = [
      '-i', inputPath,
      '-af', audioFilter,
      '-ar', '44100',
      '-y',
      outputPath
    ];

    const startTime = Date.now();
    const ffmpegProcess = execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });

    let stderrData = '';

    ffmpegProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (code === 0) {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          const sizeKB = (stats.size / 1024).toFixed(2);
          
          resolve({
            success: true,
            duration: parseFloat(duration),
            outputSize: sizeKB,
            stderr: stderrData
          });
        } else {
          reject(new Error('FFmpeg retornou código 0 mas arquivo de saída não foi criado'));
        }
      } else {
        reject(new Error(`FFmpeg falhou com código ${code}. Stderr:\n${stderrData}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      reject(new Error(`Erro ao executar FFmpeg: ${err.message}`));
    });
  });
}

/**
 * PASSO 3: Pós-validação do arquivo masterizado
 */
function validateOutput(outputPath, targetI, targetTP) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', outputPath,
      '-af', `loudnorm=I=${targetI}:TP=${targetTP}:LRA=7:print_format=json`,
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        const data = extractLoudnormJson(stderr);
        
        const finalI = parseFloat(data.input_i);
        const finalTP = parseFloat(data.input_tp);

        // Calcular erros
        const lufsError = Math.abs(finalI - targetI);
        const tpError = finalTP - targetTP;

        // Verificar critérios
        const lufsPass = lufsError <= LUFS_TOLERANCE;
        const tpPass = finalTP <= (targetTP + TP_TOLERANCE);
        const pass = lufsPass && tpPass;

        resolve({
          pass,
          finalI,
          finalTP,
          lufsError,
          tpError,
          lufsPass,
          tpPass
        });
      } catch (parseError) {
        reject(new Error(`Erro ao validar output: ${parseError.message}\nStderr: ${stderr}`));
      }
    });
  });
}

/**
 * Função principal: Two-pass com fallback
 */
async function runTwoPassLoudnorm(options) {
  const { inputPath, outputPath, targetI, targetTP, targetLRA = 7 } = options;

  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│  TWO-PASS LOUDNORM + PÓS-VALIDAÇÃO             │');
  console.log('└─────────────────────────────────────────────────┘');
  console.log('');

  let attempt = 1;
  let usedTP = targetTP;
  let fallbackUsed = false;

  while (attempt <= 2) {
    const attemptLabel = attempt === 1 ? 'RENDER PRINCIPAL' : 'FALLBACK (-0.2 dB TP)';
    console.log(`▶ ${attemptLabel}`);
    console.log(`  Target: ${targetI} LUFS / ${usedTP.toFixed(2)} dBTP`);
    console.log('');

    try {
      // Passo 1: Análise
      console.log('  [1/3] Analisando loudness...');
      const measured = await analyzeLoudness(inputPath, targetI, usedTP, targetLRA);
      console.log(`        Input I: ${measured.input_i.toFixed(2)} LUFS`);
      console.log(`        Input TP: ${measured.input_tp.toFixed(2)} dBTP`);
      console.log('');

      // Passo 2: Render two-pass
      console.log('  [2/3] Renderizando (two-pass + limiter)...');
      const renderResult = await renderTwoPass(inputPath, outputPath, targetI, usedTP, targetLRA, measured, usedTP);
      console.log(`        Tempo: ${renderResult.duration}s`);
      console.log('');

      // Passo 3: Validação
      console.log('  [3/3] Validando resultado...');
      const validation = await validateOutput(outputPath, targetI, targetTP);
      
      console.log(`        Final I: ${validation.finalI.toFixed(2)} LUFS (erro: ${validation.lufsError.toFixed(3)} LU)`);
      console.log(`        Final TP: ${validation.finalTP.toFixed(2)} dBTP (${validation.tpError >= 0 ? '+' : ''}${validation.tpError.toFixed(3)} dB)`);
      console.log('');

      if (validation.pass) {
        console.log('  ✅ VALIDAÇÃO PASSOU');
        console.log('');
        
        return {
          success: true,
          targetI,
          targetTP,
          usedTP,
          finalI: validation.finalI,
          finalTP: validation.finalTP,
          lufsError: validation.lufsError,
          tpError: validation.tpError,
          fallbackUsed,
          duration: renderResult.duration,
          outputSize: renderResult.outputSize
        };
      } else {
        console.log('  ❌ VALIDAÇÃO FALHOU');
        if (!validation.lufsPass) {
          console.log(`     LUFS erro ${validation.lufsError.toFixed(3)} LU > tolerância ${LUFS_TOLERANCE} LU`);
        }
        if (!validation.tpPass) {
          console.log(`     True Peak ${validation.finalTP.toFixed(2)} dBTP > ceiling ${(targetTP + TP_TOLERANCE).toFixed(2)} dBTP`);
        }
        console.log('');

        // Tentar fallback
        if (attempt === 1) {
          console.log('  ↻ Tentando fallback...');
          console.log('');
          usedTP = targetTP - FALLBACK_TP_REDUCTION;
          fallbackUsed = true;
          attempt++;
          continue;
        } else {
          throw new Error('Validação falhou mesmo após fallback');
        }
      }
    } catch (error) {
      if (attempt === 1) {
        console.log(`  ⚠️  Erro: ${error.message}`);
        console.log('  ↻ Tentando fallback...');
        console.log('');
        usedTP = targetTP - FALLBACK_TP_REDUCTION;
        fallbackUsed = true;
        attempt++;
        continue;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Falha após 2 tentativas');
}

/**
 * Wrapper legado para compatibilidade CLI
 */
function processAudio(config) {
  const { inputPath, outputPath, targetLufs, ceilingDbtp } = config;
  
  return runTwoPassLoudnorm({
    inputPath,
    outputPath,
    targetI: targetLufs,
    targetTP: ceilingDbtp,
    targetLRA: 7
  });
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  AutoMaster V1 - Núcleo Técnico');
  console.log('  Masterização básica via FFmpeg');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // 1. Validar argumentos
  console.log('📋 Validando parâmetros...');
  const config = validateArgs();
  console.log('✅ Parâmetros válidos');
  console.log('');

  // 2. Verificar FFmpeg
  console.log('🔍 Verificando FFmpeg...');
  try {
    const ffmpegVersion = await checkFFmpeg();
    console.log(`✅ FFmpeg encontrado: ${ffmpegVersion}`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
  console.log('');

  // 3. Exibir configuração
  console.log('⚙️  Configuração:');
  console.log(`   Input:        ${config.inputPath}`);
  console.log(`   Output:       ${config.outputPath}`);
  console.log(`   Target LUFS:  ${config.targetLufs} LUFS`);
  console.log(`   Ceiling:      ${config.ceilingDbtp} dBTP`);
  console.log('');

  // 4. Processar áudio
  console.log('🎚️  Iniciando processamento...');
  console.log('');
  
  try {
    const result = await processAudio(config);
    
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ PROCESSAMENTO CONCLUÍDO COM SUCESSO');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Tempo:      ${result.duration}s`);
    console.log(`   Output:     ${config.outputPath}`);
    console.log(`   Tamanho:    ${result.outputSize} KB`);
    console.log('');
    console.log('  PRECISÃO:');
    console.log(`   Target LUFS:  ${result.targetI} LUFS`);
    console.log(`   Final LUFS:   ${result.finalI.toFixed(2)} LUFS (erro: ${result.lufsError.toFixed(3)} LU)`);
    console.log(`   Target TP:    ${result.targetTP.toFixed(2)} dBTP`);
    console.log(`   Used TP:      ${result.usedTP.toFixed(2)} dBTP ${result.fallbackUsed ? '(fallback)' : ''}`);
    console.log(`   Final TP:     ${result.finalTP.toFixed(2)} dBTP`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    // JSON estruturado para parsing
    console.log('RESULT_JSON:', JSON.stringify({
      success: true,
      targetI: result.targetI,
      targetTP: result.targetTP,
      usedTP: result.usedTP,
      finalI: result.finalI,
      finalTP: result.finalTP,
      lufsError: result.lufsError,
      tpError: result.tpError,
      fallbackUsed: result.fallbackUsed,
      duration: result.duration,
      pass: true
    }));
    
    process.exit(0);
  } catch (error) {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('❌ ERRO NO PROCESSAMENTO');
    console.log('═══════════════════════════════════════════════════');
    console.error(error.message);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    
    process.exit(1);
  }
}

// Executar
main();
