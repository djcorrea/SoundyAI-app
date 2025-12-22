/**
 * 🔍 SAMPLE PEAK DIAGNOSTICS - Diagnóstico completo de anomalias +33/+36 dB
 * 
 * Implementa:
 * 1. Logs detalhados de min/max/maxAbs/%(|x|>1) no buffer
 * 2. Confirmação de escala esperada
 * 3. Detecção de divisores errados para PCM 24-bit
 * 4. Caminho canônico via FFmpeg f32le
 * 5. Sanity checks: samplePeak vs truePeak
 * 6. Fallback FFmpeg (astats/volumedetect) se suspeito
 */

import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import ffmpegStatic from 'ffmpeg-static';

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';

/**
 * 🔍 TAREFA 1: Analisa buffer antes do cálculo de Sample Peak
 * Loga min/max/maxAbs/%(|x|>1) para diagnosticar escala errada
 */
export function analyzeBufferScale(leftChannel, rightChannel, context = '') {
  const analysis = {
    left: analyzeChannel(leftChannel, 'LEFT'),
    right: analyzeChannel(rightChannel, 'RIGHT'),
    context
  };
  
  // Detectar se valores estão fora de [-1, 1]
  const hasOutOfRange = analysis.left.outOfRangePct > 0 || analysis.right.outOfRangePct > 0;
  const maxAbsValue = Math.max(analysis.left.maxAbs, analysis.right.maxAbs);
  
  // 🚨 DIAGNÓSTICO: Se maxAbs >> 1, escala está errada
  let suspectedScale = 'float32_normalized'; // Padrão esperado
  let divisorNeeded = 1.0;
  
  if (maxAbsValue > 1e6 && maxAbsValue < 1e9) {
    // Provável int24 sem normalização (full scale = 8388608)
    suspectedScale = 'int24_not_normalized';
    divisorNeeded = 8388608; // 2^23
    console.error(`🚨 [SCALE_ERROR] Buffer parece int24 sem normalização! maxAbs=${maxAbsValue.toFixed(0)}, esperado divisor=8388608`);
  } else if (maxAbsValue > 30000 && maxAbsValue < 40000) {
    // Provável int16 sem normalização (full scale = 32768)
    suspectedScale = 'int16_not_normalized';
    divisorNeeded = 32768; // 2^15
    console.error(`🚨 [SCALE_ERROR] Buffer parece int16 sem normalização! maxAbs=${maxAbsValue.toFixed(0)}, esperado divisor=32768`);
  } else if (maxAbsValue > 1.0 && maxAbsValue < 2.0) {
    // Provável clipping ou erro de conversão leve
    suspectedScale = 'float32_slight_overflow';
    divisorNeeded = 1.0;
    console.warn(`⚠️ [SCALE_WARNING] Valores ligeiramente acima de 1.0 (max=${maxAbsValue.toFixed(4)})`);
  } else if (maxAbsValue <= 1.0) {
    // Escala correta
    suspectedScale = 'float32_normalized';
    divisorNeeded = 1.0;
    console.log(`✅ [SCALE_OK] Buffer em escala Float32 normalizada [-1, 1], maxAbs=${maxAbsValue.toFixed(4)}`);
  }
  
  // Log completo
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 [BUFFER_ANALYSIS] ${context}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 LEFT:  min=${analysis.left.min.toFixed(6)}, max=${analysis.left.max.toFixed(6)}, maxAbs=${analysis.left.maxAbs.toFixed(6)}`);
  console.log(`📊 RIGHT: min=${analysis.right.min.toFixed(6)}, max=${analysis.right.max.toFixed(6)}, maxAbs=${analysis.right.maxAbs.toFixed(6)}`);
  console.log(`⚠️  Out of range: L=${analysis.left.outOfRangePct.toFixed(2)}%, R=${analysis.right.outOfRangePct.toFixed(2)}%`);
  console.log(`🎯 Suspected scale: ${suspectedScale}`);
  console.log(`🔧 Divisor needed: ${divisorNeeded} ${divisorNeeded !== 1.0 ? '⚠️  CORRECTION NEEDED!' : '✅'}`);
  console.log(`${'='.repeat(80)}\n`);
  
  return {
    ...analysis,
    maxAbsValue,
    hasOutOfRange,
    suspectedScale,
    divisorNeeded,
    needsCorrection: divisorNeeded !== 1.0
  };
}

function analyzeChannel(channel, label) {
  if (!channel || channel.length === 0) {
    return { min: 0, max: 0, maxAbs: 0, outOfRangeCount: 0, outOfRangePct: 0 };
  }
  
  let min = Infinity;
  let max = -Infinity;
  let maxAbs = 0;
  let outOfRangeCount = 0;
  
  for (let i = 0; i < channel.length; i++) {
    const val = channel[i];
    
    if (val < min) min = val;
    if (val > max) max = val;
    
    const absVal = Math.abs(val);
    if (absVal > maxAbs) maxAbs = absVal;
    
    // Contar valores fora de [-1, 1]
    if (absVal > 1.0) {
      outOfRangeCount++;
    }
  }
  
  const outOfRangePct = (outOfRangeCount / channel.length) * 100;
  
  return { min, max, maxAbs, outOfRangeCount, outOfRangePct };
}

/**
 * 🔍 TAREFA 2: Confirma escala esperada do buffer
 */
export function confirmExpectedScale(audioData, source = 'unknown') {
  console.log(`\n🔍 [SCALE_CONFIRMATION] Source: ${source}`);
  
  const expected = {
    source,
    scale: 'float32',
    range: '[-1.0, 1.0]',
    sampleRate: 48000,
    channels: 2
  };
  
  const actual = {
    sampleRate: audioData.sampleRate || audioData.length / (audioData.duration || 1),
    channels: audioData.numberOfChannels || 2,
    length: audioData.length || audioData.leftChannel?.length || 0,
    duration: audioData.duration || 0
  };
  
  console.log(`Expected: scale=${expected.scale}, range=${expected.range}, sr=${expected.sampleRate}Hz, ch=${expected.channels}`);
  console.log(`Actual:   sr=${actual.sampleRate}Hz, ch=${actual.channels}, length=${actual.length}, dur=${actual.duration.toFixed(2)}s`);
  
  const scaleOK = actual.sampleRate === expected.sampleRate && actual.channels === expected.channels;
  console.log(scaleOK ? '✅ Scale confirmed' : '⚠️  Scale mismatch!');
  
  return { expected, actual, scaleOK };
}

/**
 * 🔍 TAREFA 3: Identifica caminho com divisor errado para PCM 24-bit
 */
export function detectWrongPCM24Divisor(audioBuffer, metadata = {}) {
  console.log(`\n🔍 [PCM24_CHECK] Verificando se buffer foi convertido com divisor errado`);
  
  // Analisar buffer
  const analysis = analyzeBufferScale(audioBuffer.leftChannel, audioBuffer.rightChannel, 'PCM24 Check');
  
  // Se maxAbs está na ordem de 8388608 (2^23), é PCM 24-bit sem normalização
  if (analysis.suspectedScale === 'int24_not_normalized') {
    console.error(`❌ [PCM24_ERROR] Detectado PCM 24-bit sem normalização!`);
    console.error(`   Full scale deveria ser: 2^23 = 8388608`);
    console.error(`   Divisor necessário: 8388608`);
    console.error(`   MaxAbs atual: ${analysis.maxAbsValue.toFixed(0)}`);
    console.error(`   Sample Peak calculado sem correção seria: ${(20 * Math.log10(analysis.maxAbsValue)).toFixed(2)} dB ⚠️  ERRADO!`);
    console.error(`   Sample Peak correto após divisão: ${(20 * Math.log10(analysis.maxAbsValue / 8388608)).toFixed(2)} dB ✅`);
    
    return {
      hasPCM24Error: true,
      divisorNeeded: 8388608,
      currentMaxAbs: analysis.maxAbsValue,
      wrongPeakDb: 20 * Math.log10(analysis.maxAbsValue),
      correctPeakDb: 20 * Math.log10(analysis.maxAbsValue / 8388608),
      errorMagnitude: 20 * Math.log10(8388608) // ~138 dB de erro!
    };
  }
  
  console.log(`✅ [PCM24_OK] Buffer não parece ter erro de PCM 24-bit`);
  return { hasPCM24Error: false };
}

/**
 * 🔍 TAREFA 4: Caminho canônico - decodificar sempre com FFmpeg para f32le
 * Esta função garante que SEMPRE convertemos para Float32 normalizado
 */
export async function decodeToFloat32Canonical(inputBuffer, tempPath = null) {
  console.log(`\n🔍 [CANONICAL_DECODE] Decodificando via FFmpeg para f32le (Float32 normalizado)`);
  
  // Criar arquivo temporário se necessário
  const needsTemp = !tempPath;
  if (needsTemp) {
    const tmpId = randomBytes(8).toString('hex');
    tempPath = join(tmpdir(), `audio_canonical_${Date.now()}_${tmpId}.tmp`);
    await writeFile(tempPath, inputBuffer);
  }
  
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-nostdin',
      '-i', tempPath,
      '-vn',
      '-ar', '48000',
      '-ac', '2',
      '-c:a', 'pcm_f32le',  // 🎯 FLOAT32 LE - ESCALA NORMALIZADA [-1, 1]
      '-f', 'wav',
      'pipe:1'
    ];
    
    const ff = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    const chunks = [];
    let stderr = '';
    
    ff.stdout.on('data', chunk => chunks.push(chunk));
    ff.stderr.on('data', chunk => { stderr += chunk.toString(); });
    
    ff.on('close', async (code) => {
      // Limpar temp file se criamos
      if (needsTemp) {
        try { await unlink(tempPath); } catch {}
      }
      
      if (code !== 0) {
        reject(new Error(`FFmpeg f32le decode failed: ${stderr}`));
        return;
      }
      
      const wavBuffer = Buffer.concat(chunks);
      console.log(`✅ [CANONICAL_DECODE] FFmpeg f32le decode OK: ${wavBuffer.length} bytes`);
      resolve(wavBuffer);
    });
    
    ff.on('error', async (err) => {
      if (needsTemp) {
        try { await unlink(tempPath); } catch {}
      }
      reject(err);
    });
  });
}

/**
 * 🔍 TAREFA 5: Sanity checks - detecta Sample Peak suspeito
 */
export function samplePeakSanityCheck(samplePeakDbfs, truePeakDbtp, context = '') {
  console.log(`\n🔍 [SANITY_CHECK] ${context}`);
  console.log(`   Sample Peak: ${samplePeakDbfs?.toFixed(2)} dBFS`);
  console.log(`   True Peak:   ${truePeakDbtp?.toFixed(2)} dBTP`);
  
  const checks = {
    samplePeakDbfs,
    truePeakDbtp,
    context,
    warnings: [],
    isSuspicious: false,
    needsFallback: false
  };
  
  // Check 1: Sample Peak não pode ser > True Peak + 1 dB
  if (samplePeakDbfs > truePeakDbtp + 1.0) {
    checks.warnings.push(`Sample Peak (${samplePeakDbfs.toFixed(2)}) > True Peak (${truePeakDbtp.toFixed(2)}) + 1 dB`);
    checks.isSuspicious = true;
    console.error(`❌ [SANITY_FAIL] Sample Peak > True Peak + 1 dB (impossível!)`);
  }
  
  // Check 2: Sample Peak não pode ser > +1 dBFS (max teórico é 0 dBFS)
  if (samplePeakDbfs > 1.0) {
    checks.warnings.push(`Sample Peak (${samplePeakDbfs.toFixed(2)}) > +1 dBFS (impossível em Float32 [-1,1])`);
    checks.isSuspicious = true;
    console.error(`❌ [SANITY_FAIL] Sample Peak > +1 dBFS (escala errada!)`);
  }
  
  // Check 3: Sample Peak extremamente alto (> +10 dB indica erro grave)
  if (samplePeakDbfs > 10.0) {
    checks.warnings.push(`Sample Peak (${samplePeakDbfs.toFixed(2)}) > +10 dB (erro de escala grave)`);
    checks.isSuspicious = true;
    checks.needsFallback = true;
    console.error(`❌ [SANITY_FAIL] Sample Peak > +10 dB - ERRO GRAVE DE ESCALA!`);
  }
  
  // Check 4: Diferença muito grande entre Sample e True Peak
  const delta = Math.abs(samplePeakDbfs - truePeakDbtp);
  if (delta > 30.0) {
    checks.warnings.push(`Delta Sample-True Peak = ${delta.toFixed(2)} dB (> 30 dB é suspeito)`);
    checks.isSuspicious = true;
    checks.needsFallback = true;
    console.error(`❌ [SANITY_FAIL] Delta > 30 dB entre Sample e True Peak!`);
  }
  
  if (checks.warnings.length === 0) {
    console.log(`✅ [SANITY_OK] Todos os checks passaram`);
  } else {
    console.error(`⚠️  [SANITY_WARNINGS] ${checks.warnings.length} problema(s) detectado(s)`);
    checks.warnings.forEach((w, i) => console.error(`   ${i + 1}. ${w}`));
  }
  
  if (checks.needsFallback) {
    console.error(`🔧 [FALLBACK_NEEDED] Rodando FFmpeg astats/volumedetect para confirmar...`);
  }
  
  return checks;
}

/**
 * 🔍 TAREFA 6: Fallback FFmpeg - usa astats/volumedetect para pegar valor correto
 */
export async function ffmpegSamplePeakFallback(audioFilePath) {
  console.log(`\n🔧 [FALLBACK] Executando FFmpeg astats para obter Sample Peak confiável`);
  
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-nostdin',
      '-i', audioFilePath,
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
      
      // Parse astats output
      const result = parseAstatsOutput(stderr);
      
      console.log(`✅ [FALLBACK] FFmpeg astats result:`);
      console.log(`   Sample Peak L: ${result.samplePeakLeftDb?.toFixed(2)} dBFS`);
      console.log(`   Sample Peak R: ${result.samplePeakRightDb?.toFixed(2)} dBFS`);
      console.log(`   Sample Peak Max: ${result.samplePeakMaxDb?.toFixed(2)} dBFS`);
      
      resolve(result);
    });
    
    ff.on('error', reject);
  });
}

function parseAstatsOutput(stderr) {
  const lines = stderr.split('\n');
  const result = {
    samplePeakLeftDb: null,
    samplePeakRightDb: null,
    samplePeakMaxDb: null,
    rmsPeakLeftDb: null,
    rmsPeakRightDb: null
  };
  
  for (const line of lines) {
    // Overall.Max_level ou Overall.Peak_level
    if (line.includes('Overall.Max_level') || line.includes('Overall.Peak_level')) {
      const match = line.match(/(-?\d+\.\d+)\s+dB/);
      if (match) {
        const peakDb = parseFloat(match[1]);
        result.samplePeakMaxDb = peakDb;
      }
    }
    
    // Channel 0 (left)
    if (line.includes('Channel: 0')) {
      const nextLines = lines.slice(lines.indexOf(line), lines.indexOf(line) + 10).join('\n');
      const maxMatch = nextLines.match(/Max level:\s+(-?\d+\.\d+)\s+dB/);
      if (maxMatch) {
        result.samplePeakLeftDb = parseFloat(maxMatch[1]);
      }
    }
    
    // Channel 1 (right)
    if (line.includes('Channel: 1')) {
      const nextLines = lines.slice(lines.indexOf(line), lines.indexOf(line) + 10).join('\n');
      const maxMatch = nextLines.match(/Max level:\s+(-?\d+\.\d+)\s+dB/);
      if (maxMatch) {
        result.samplePeakRightDb = parseFloat(maxMatch[1]);
      }
    }
  }
  
  // Se não conseguiu parsear, tentar volumedetect como fallback
  if (result.samplePeakMaxDb === null) {
    const volMatch = stderr.match(/max_volume:\s+(-?\d+\.\d+)\s+dB/);
    if (volMatch) {
      result.samplePeakMaxDb = parseFloat(volMatch[1]);
    }
  }
  
  return result;
}

/**
 * 🔧 Correção de Sample Peak se detectado erro de escala
 */
export function correctSamplePeakIfNeeded(samplePeakMetrics, bufferAnalysis) {
  if (!bufferAnalysis.needsCorrection) {
    console.log(`✅ [CORRECTION] Nenhuma correção necessária`);
    return samplePeakMetrics;
  }
  
  console.log(`\n🔧 [CORRECTION] Aplicando correção de escala`);
  console.log(`   Divisor detectado: ${bufferAnalysis.divisorNeeded}`);
  console.log(`   Sample Peak ANTES: ${samplePeakMetrics.maxDbfs?.toFixed(2)} dBFS`);
  
  // Aplicar correção: dividir valor linear pelo divisor
  const correctionDb = 20 * Math.log10(bufferAnalysis.divisorNeeded);
  
  const corrected = {
    left: samplePeakMetrics.left / bufferAnalysis.divisorNeeded,
    right: samplePeakMetrics.right / bufferAnalysis.divisorNeeded,
    max: samplePeakMetrics.max / bufferAnalysis.divisorNeeded,
    leftDbfs: samplePeakMetrics.leftDbfs - correctionDb,
    rightDbfs: samplePeakMetrics.rightDbfs - correctionDb,
    maxDbfs: samplePeakMetrics.maxDbfs - correctionDb,
    _corrected: true,
    _correctionDb: correctionDb,
    _divisor: bufferAnalysis.divisorNeeded
  };
  
  console.log(`   Sample Peak DEPOIS: ${corrected.maxDbfs?.toFixed(2)} dBFS`);
  console.log(`   Correção aplicada: ${correctionDb.toFixed(2)} dB`);
  
  return corrected;
}

export default {
  analyzeBufferScale,
  confirmExpectedScale,
  detectWrongPCM24Divisor,
  decodeToFloat32Canonical,
  samplePeakSanityCheck,
  ffmpegSamplePeakFallback,
  correctSamplePeakIfNeeded
};
