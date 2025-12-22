/**
 * 🧪 SAMPLE PEAK REGRESSION TESTS
 * 
 * Testes de regressão para validar correção do Sample Peak em diferentes formatos:
 * - WAV PCM 16-bit
 * - WAV PCM 24-bit (problema principal)
 * - WAV PCM 32-bit
 * - WAV Float32
 * - MP3
 * 
 * Validação: Erro < 0.2 dB vs FFmpeg astats
 */

import { spawn } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import ffmpegStatic from 'ffmpeg-static';
import decodeAudioFile from '../api/audio/audio-decoder.js';
import { analyzeBufferScale, samplePeakSanityCheck } from '../api/audio/sample-peak-diagnostics.js';

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';

/**
 * Gera arquivo de teste com FFmpeg
 */
async function generateTestAudio(format, bitDepth, duration = 3) {
  const tmpId = randomBytes(8).toString('hex');
  const outputPath = join(tmpdir(), `test_${format}_${bitDepth}bit_${tmpId}.wav`);
  
  let codecArgs = [];
  switch (format) {
    case 'pcm_s16le':
      codecArgs = ['-acodec', 'pcm_s16le'];
      break;
    case 'pcm_s24le':
      codecArgs = ['-acodec', 'pcm_s24le'];
      break;
    case 'pcm_s32le':
      codecArgs = ['-acodec', 'pcm_s32le'];
      break;
    case 'pcm_f32le':
      codecArgs = ['-acodec', 'pcm_f32le'];
      break;
    default:
      throw new Error(`Formato não suportado: ${format}`);
  }
  
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', `sine=frequency=1000:duration=${duration}:sample_rate=48000`,
      '-ac', '2',
      '-ar', '48000',
      ...codecArgs,
      '-y',
      outputPath
    ];
    
    const ff = spawn(FFMPEG_PATH, args);
    
    let stderr = '';
    ff.stderr.on('data', chunk => { stderr += chunk.toString(); });
    
    ff.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg failed: ${stderr}`));
        return;
      }
      resolve(outputPath);
    });
    
    ff.on('error', reject);
  });
}

/**
 * Obtém Sample Peak via FFmpeg astats (ground truth)
 */
async function getFFmpegSamplePeak(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-nostdin',
      '-i', filePath,
      '-af', 'astats=metadata=1:reset=0',
      '-f', 'null',
      '-'
    ];
    
    const ff = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    
    let stderr = '';
    ff.stderr.on('data', chunk => { stderr += chunk.toString(); });
    
    ff.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg astats failed: ${stderr}`));
        return;
      }
      
      // Parse output
      const maxLevelMatch = stderr.match(/Overall.*Max level:\s+(-?\d+\.\d+)\s+dB/i) ||
                           stderr.match(/Overall.*Peak level:\s+(-?\d+\.\d+)\s+dB/i);
      
      if (!maxLevelMatch) {
        reject(new Error('Não foi possível parsear Sample Peak do FFmpeg'));
        return;
      }
      
      const samplePeakDb = parseFloat(maxLevelMatch[1]);
      resolve(samplePeakDb);
    });
    
    ff.on('error', reject);
  });
}

/**
 * Calcula Sample Peak via nosso sistema
 */
async function getOurSamplePeak(filePath) {
  try {
    const fileBuffer = await readFile(filePath);
    const audioData = await decodeAudioFile(fileBuffer, filePath, { jobId: 'test' });
    
    // Analisar buffer
    const analysis = analyzeBufferScale(
      audioData.leftChannel, 
      audioData.rightChannel, 
      `Test file: ${filePath}`
    );
    
    // Calcular Sample Peak
    let peakLeftLinear = 0;
    let peakRightLinear = 0;
    
    for (let i = 0; i < audioData.leftChannel.length; i++) {
      const absLeft = Math.abs(audioData.leftChannel[i]);
      if (absLeft > peakLeftLinear) peakLeftLinear = absLeft;
    }
    
    for (let i = 0; i < audioData.rightChannel.length; i++) {
      const absRight = Math.abs(audioData.rightChannel[i]);
      if (absRight > peakRightLinear) peakRightLinear = absRight;
    }
    
    const peakMaxLinear = Math.max(peakLeftLinear, peakRightLinear);
    
    // Aplicar correção se necessário
    let correctedLinear = peakMaxLinear;
    if (analysis.needsCorrection) {
      console.log(`⚠️  Aplicando correção: divisor=${analysis.divisorNeeded}`);
      correctedLinear = peakMaxLinear / analysis.divisorNeeded;
    }
    
    const samplePeakDb = correctedLinear > 0 ? 20 * Math.log10(correctedLinear) : -120;
    
    return {
      samplePeakDb,
      bufferAnalysis: analysis
    };
  } catch (error) {
    throw new Error(`Erro ao processar arquivo: ${error.message}`);
  }
}

/**
 * Executa teste de regressão para um formato
 */
async function runRegressionTest(format, bitDepth) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TESTE DE REGRESSÃO: ${format} (${bitDepth}-bit)`);
  console.log(`${'='.repeat(80)}`);
  
  let testFile = null;
  
  try {
    // 1. Gerar arquivo de teste
    console.log(`📝 Gerando arquivo de teste...`);
    testFile = await generateTestAudio(format, bitDepth);
    console.log(`✅ Arquivo gerado: ${testFile}`);
    
    // 2. Obter ground truth (FFmpeg)
    console.log(`📊 Obtendo Sample Peak via FFmpeg (ground truth)...`);
    const ffmpegPeak = await getFFmpegSamplePeak(testFile);
    console.log(`✅ FFmpeg Sample Peak: ${ffmpegPeak.toFixed(2)} dBFS`);
    
    // 3. Obter valor do nosso sistema
    console.log(`📊 Obtendo Sample Peak via nosso sistema...`);
    const { samplePeakDb, bufferAnalysis } = await getOurSamplePeak(testFile);
    console.log(`✅ Nosso Sample Peak: ${samplePeakDb.toFixed(2)} dBFS`);
    
    // 4. Calcular erro
    const errorDb = Math.abs(samplePeakDb - ffmpegPeak);
    const passed = errorDb < 0.2; // Tolerância de 0.2 dB
    
    console.log(`\n📊 RESULTADO:`);
    console.log(`   FFmpeg:  ${ffmpegPeak.toFixed(4)} dBFS`);
    console.log(`   Nosso:   ${samplePeakDb.toFixed(4)} dBFS`);
    console.log(`   Erro:    ${errorDb.toFixed(4)} dB`);
    console.log(`   Status:  ${passed ? '✅ PASSOU' : '❌ FALHOU'} (tolerância: 0.2 dB)`);
    
    if (bufferAnalysis.needsCorrection) {
      console.log(`   ⚠️  Correção aplicada: divisor=${bufferAnalysis.divisorNeeded}`);
    }
    
    return {
      format,
      bitDepth,
      ffmpegPeak,
      ourPeak: samplePeakDb,
      errorDb,
      passed,
      correctionApplied: bufferAnalysis.needsCorrection
    };
    
  } catch (error) {
    console.error(`❌ Teste falhou:`, error.message);
    return {
      format,
      bitDepth,
      error: error.message,
      passed: false
    };
  } finally {
    // Limpar arquivo de teste
    if (testFile) {
      try {
        await unlink(testFile);
      } catch {}
    }
  }
}

/**
 * Executa suite completa de testes
 */
async function runFullTestSuite() {
  console.log(`\n${'#'.repeat(80)}`);
  console.log(`# SAMPLE PEAK REGRESSION TEST SUITE`);
  console.log(`${'#'.repeat(80)}\n`);
  
  const testCases = [
    { format: 'pcm_s16le', bitDepth: 16 },
    { format: 'pcm_s24le', bitDepth: 24 }, // ⚠️  Problema principal
    { format: 'pcm_s32le', bitDepth: 32 },
    { format: 'pcm_f32le', bitDepth: 32 }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await runRegressionTest(testCase.format, testCase.bitDepth);
    results.push(result);
  }
  
  // Resumo final
  console.log(`\n${'#'.repeat(80)}`);
  console.log(`# RESUMO DOS TESTES`);
  console.log(`${'#'.repeat(80)}\n`);
  
  console.log(`| Formato       | Bit Depth | FFmpeg (dB) | Nosso (dB) | Erro (dB) | Status |`);
  console.log(`|---------------|-----------|-------------|------------|-----------|--------|`);
  
  for (const result of results) {
    if (result.error) {
      console.log(`| ${result.format.padEnd(13)} | ${result.bitDepth.toString().padEnd(9)} | ERROR       | ERROR      | ERROR     | ❌ ERRO |`);
    } else {
      const formatStr = result.format.padEnd(13);
      const bitDepthStr = result.bitDepth.toString().padEnd(9);
      const ffmpegStr = result.ffmpegPeak.toFixed(2).padStart(11);
      const ourStr = result.ourPeak.toFixed(2).padStart(10);
      const errorStr = result.errorDb.toFixed(4).padStart(9);
      const statusStr = result.passed ? '✅ PASS' : '❌ FAIL';
      
      console.log(`| ${formatStr} | ${bitDepthStr} | ${ffmpegStr} | ${ourStr} | ${errorStr} | ${statusStr} |`);
    }
  }
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log(`\n📊 RESULTADO FINAL: ${passedCount}/${totalCount} testes passaram`);
  
  if (passedCount === totalCount) {
    console.log(`✅ TODOS OS TESTES PASSARAM!`);
    return 0;
  } else {
    console.log(`❌ ALGUNS TESTES FALHARAM!`);
    return 1;
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullTestSuite()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

export { runRegressionTest, runFullTestSuite, getFFmpegSamplePeak, getOurSamplePeak };
