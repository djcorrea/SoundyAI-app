#!/usr/bin/env node
/**
 * AutoMaster V1 - Núcleo Técnico
 * 
 * Script isolado para masterização básica usando FFmpeg.
 * NÃO integrado com filas, banco, API ou frontend.
 * 
 * Uso:
 *   node automaster-v1.js <input.wav> <output.wav> <target-lufs> <ceiling-dbtp>
 * 
 * Exemplo:
 *   node automaster-v1.js input.wav output.wav -11 -0.8
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
// PROCESSAMENTO DE MASTERIZAÇÃO
// ============================================================

function processAudio(config) {
  return new Promise((resolve, reject) => {
    const { inputPath, outputPath, targetLufs, ceilingDbtp } = config;

    // Converter ceiling em dBTP (ex: -0.8) para valor linear exigido pelo alimiter
    function dbToLinear(db) {
      return Math.pow(10, db / 20);
    }

    // Calcular e clampar para o intervalo aceito pelo alimiter [0.0625, 1]
    const rawLinear = dbToLinear(ceilingDbtp);
    const linearLimit = Math.max(0.0625, Math.min(1, rawLinear));

    // Construir filtro de áudio FFmpeg
    // loudnorm usa TP em dBTP; alimiter usa limit em valor linear
    console.log(`   Ceiling dBTP: ${ceilingDbtp} → Linear: ${linearLimit.toFixed(6)}`);

    const audioFilter = [
      `loudnorm=I=${targetLufs}:TP=${ceilingDbtp}:LRA=7:measured_I=-16:measured_TP=-1.5:measured_LRA=11:measured_thresh=-26.0`,
      `alimiter=limit=${linearLimit.toFixed(6)}:attack=5:release=50:level=false`
    ].join(',');

    const args = [
      '-i', inputPath,
      '-af', audioFilter,
      '-ar', '44100',           // Sample rate padrão
      '-y',                     // Sobrescrever output sem perguntar
      outputPath
    ];

    console.log('🔧 Parâmetros FFmpeg:', args.join(' '));
    console.log('');

    const startTime = Date.now();
    const ffmpegProcess = execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });

    let stderrData = '';

    ffmpegProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      // FFmpeg envia progresso para stderr - não logar tudo para não poluir
    });

    ffmpegProcess.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (code === 0) {
        // Sucesso - verificar se arquivo foi criado
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
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    
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
