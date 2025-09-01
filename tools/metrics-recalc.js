/**
 * Metrics Recalculator - Reprocessa todas as faixas de um gênero e recalcula métricas agregadas
 * Uso: npm run metrics:recalc -- --genre=funk_mandela --save
 * Features: Idempotente, paralelismo limitado, dry-run, logs detalhados
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

// Importar pipeline existente
import { STFTEngine, nextPowerOfTwo } from '../lib/audio/fft.js';
import { calculateLoudnessMetrics } from '../lib/audio/features/loudness.js';
import { analyzeTruePeaks } from '../lib/audio/features/truepeak.js';

const CONFIG = {
  sampleRate: 48000,
  lufsTarget: -14, // Alinhado com reference-builder.js
  windowSeconds: 1.0,
  hopSeconds: 0.5,
  bands: [
    { key: 'sub', range: [20, 60] },
    { key: 'low_bass', range: [60, 120] },
    { key: 'upper_bass', range: [120, 200] },
    { key: 'low_mid', range: [200, 500] },
    { key: 'mid', range: [500, 2000] },
    { key: 'high_mid', range: [2000, 4000] },
    { key: 'brilho', range: [4000, 8000] },
    { key: 'presenca', range: [8000, 12000] },
    { key: 'air', range: [12000, 16000] }
  ]
};

// ========== Utilitários ==========

function round1(x) { return Number.isFinite(x) ? Math.round(x * 10) / 10 : x; }
function round2(x) { return Number.isFinite(x) ? Math.round(x * 100) / 100 : x; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function median(values) {
  const arr = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function mad(values, med) {
  const dev = values.map(v => Math.abs(v - med));
  return median(dev);
}

function robustTol(values, minTol) {
  if (!values.length) return minTol;
  const m = median(values);
  const M = mad(values, m);
  return Math.max(minTol, 1.4826 * M);
}

// ========== WAV Reader ==========

function readWavFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  
  // Parse básico WAV (apenas PCM 16/24/32-bit)
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Não é um arquivo WAV válido');
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Formato WAV inválido');
  
  let offset = 12;
  let fmtChunk = null, dataChunk = null;
  
  while (offset < buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    
    if (chunkId === 'fmt ') {
      fmtChunk = { offset: offset + 8, size: chunkSize };
    } else if (chunkId === 'data') {
      dataChunk = { offset: offset + 8, size: chunkSize };
      break;
    }
    offset += 8 + chunkSize;
  }
  
  if (!fmtChunk || !dataChunk) throw new Error('Chunks fmt/data não encontrados');
  
  const channels = buffer.readUInt16LE(fmtChunk.offset + 2);
  const sampleRate = buffer.readUInt32LE(fmtChunk.offset + 4);
  const bitsPerSample = buffer.readUInt16LE(fmtChunk.offset + 14);
  
  if (![16, 24, 32].includes(bitsPerSample)) throw new Error(`Bits/sample ${bitsPerSample} não suportado`);
  if (channels < 1 || channels > 2) throw new Error(`${channels} canais não suportado`);
  
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(dataChunk.size / (channels * bytesPerSample));
  
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const sampleOffset = dataChunk.offset + i * channels * bytesPerSample;
    
    let leftSample, rightSample;
    
    if (bitsPerSample === 16) {
      leftSample = buffer.readInt16LE(sampleOffset) / 32768.0;
      rightSample = channels > 1 ? buffer.readInt16LE(sampleOffset + 2) / 32768.0 : leftSample;
    } else if (bitsPerSample === 24) {
      const l1 = buffer.readUInt8(sampleOffset);
      const l2 = buffer.readUInt8(sampleOffset + 1);
      const l3 = buffer.readInt8(sampleOffset + 2);
      leftSample = (l1 + (l2 << 8) + (l3 << 16)) / 8388608.0;
      
      if (channels > 1) {
        const r1 = buffer.readUInt8(sampleOffset + 3);
        const r2 = buffer.readUInt8(sampleOffset + 4);
        const r3 = buffer.readInt8(sampleOffset + 5);
        rightSample = (r1 + (r2 << 8) + (r3 << 16)) / 8388608.0;
      } else {
        rightSample = leftSample;
      }
    } else { // 32-bit
      leftSample = buffer.readInt32LE(sampleOffset) / 2147483648.0;
      rightSample = channels > 1 ? buffer.readInt32LE(sampleOffset + 4) / 2147483648.0 : leftSample;
    }
    
    left[i] = leftSample;
    right[i] = rightSample;
  }
  
  return { left, right, sampleRate };
}

// ========== Audio Processing ==========

function resampleLinear(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const index0 = Math.floor(srcIndex);
    const index1 = Math.min(index0 + 1, input.length - 1);
    const fraction = srcIndex - index0;
    
    output[i] = input[index0] * (1 - fraction) + input[index1] * fraction;
  }
  
  return output;
}

function applyGainDb(buffer, gainDb) {
  const gain = Math.pow(10, gainDb / 20);
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] *= gain;
  }
}

function rmsDb(left, right) {
  let sum = 0;
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i++) {
    sum += (left[i] * left[i] + right[i] * right[i]) / 2;
  }
  const rms = Math.sqrt(sum / len);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

function stereoWidth01(left, right) {
  let sumLR = 0, sumL = 0, sumR = 0;
  const len = Math.min(left.length, right.length);
  
  for (let i = 0; i < len; i++) {
    sumLR += left[i] * right[i];
    sumL += left[i] * left[i];
    sumR += right[i] * right[i];
  }
  
  const denom = Math.sqrt(sumL * sumR);
  if (denom === 0) return 0;
  
  const correlation = sumLR / denom;
  return clamp((1 - correlation) / 2, 0, 1); // 0=mono, 1=completamente decorrelacionado
}

function bandToBins(range, freqBins) {
  const start = Math.round(range[0] * freqBins.length / (freqBins[freqBins.length - 1] || 1));
  const end = Math.round(range[1] * freqBins.length / (freqBins[freqBins.length - 1] || 1));
  return [Math.max(0, start), Math.min(freqBins.length, end)];
}

function computeBandProfile(left, right, sampleRate) {
  const win = Math.round(CONFIG.windowSeconds * sampleRate);
  const hop = Math.round(CONFIG.hopSeconds * sampleRate);
  const fftSize = nextPowerOfTwo(win);
  const stft = new STFTEngine(fftSize, hop, 'hann');
  
  const mono = new Float32Array(Math.min(left.length, right.length));
  for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (left[i] + right[i]);
  
  const { spectrogram, freqBins } = stft.analyze(mono, sampleRate);

  const binRanges = CONFIG.bands.map(b => ({ key: b.key, bins: bandToBins(b.range, freqBins) }));
  const bandAccum = new Map(CONFIG.bands.map(b => [b.key, 0]));
  let totalFrames = 0;
  
  for (const frameMag of spectrogram) {
    const framePow = frameMag.map(v => v * v);
    const [g0, g1] = bandToBins([20, 16000], freqBins);
    let global = 0; 
    for (let i = g0; i < g1; i++) global += framePow[i];
    if (global <= 0) continue;
    
    for (const { key, bins } of binRanges) {
      let sum = 0; 
      for (let i = bins[0]; i < bins[1]; i++) sum += framePow[i];
      const rel = sum > 0 ? 10 * Math.log10(sum / global) : -80;
      bandAccum.set(key, bandAccum.get(key) + rel);
    }
    totalFrames++;
  }
  
  const profile = {};
  for (const { key } of binRanges) { 
    profile[key] = totalFrames > 0 ? bandAccum.get(key) / totalFrames : -80; 
  }
  
  return profile;
}

// ========== Medição Principal ==========

function measureTrack(left, right, sampleRate) {
  try {
    // LUFS / LRA
    const lufs = calculateLoudnessMetrics(left, right, sampleRate);
    const gainDb = CONFIG.lufsTarget - lufs.lufs_integrated;
    
    // Normalizar para alvo LUFS
    const leftN = new Float32Array(left);
    const rightN = new Float32Array(right);
    applyGainDb(leftN, gainDb);
    applyGainDb(rightN, gainDb);

    // True Peak
    const tp = analyzeTruePeaks(leftN, rightN, sampleRate);

    // Stereo width
    const stereo = stereoWidth01(leftN, rightN);

    // DR (crest factor aprox.)
    const rms = rmsDb(leftN, rightN);
    const peakDb = Math.max(tp.sample_peak_left_db || -Infinity, tp.sample_peak_right_db || -Infinity);
    const dr = (peakDb > -Infinity && rms > -Infinity) ? (peakDb - rms) : 0;

    // Band profile (dB relativos)
    const bandsDb = computeBandProfile(leftN, rightN, sampleRate);

    // Derivados
    const calor = bandsDb.low_mid ?? 0; // 200–500 Hz relativo
    const brilho = Math.max(bandsDb.brilho ?? -80, bandsDb.presenca ?? -80, bandsDb.air ?? -80);
    const clareza = (bandsDb.high_mid ?? 0) - (0.7 * (bandsDb.upper_bass ?? 0) + 0.3 * (bandsDb.low_mid ?? 0));

    return {
      lufs_integrated: lufs.integrated, // USANDO VALOR MEDIDO REAL
      lra: lufs.lra,
      true_peak_dbtp: tp.true_peak_dbtp,
      stereo_width: stereo,
      dr: dr,
      bands_db: bandsDb,
      calor, brilho, clareza,
      // Métricas extras
      rms_db: rms,
      sample_peak_left_db: tp.sample_peak_left_db,
      sample_peak_right_db: tp.sample_peak_right_db,
      headroom_db: tp.true_peak_dbtp ? Math.abs(tp.true_peak_dbtp) : null,
      // BPM e Key seriam calculados aqui se disponíveis
      bpm: null,
      key: null
    };
  } catch (error) {
    console.warn(`⚠️ Erro ao medir faixa: ${error.message}`);
    return null;
  }
}

// ========== Agregação Estatística ==========

function aggregateMetrics(trackMetrics) {
  if (!trackMetrics.length) return null;
  
  const result = {
    num_tracks: trackMetrics.length,
    aggregation_method: "robust_median_mad",
    generated_at: new Date().toISOString()
  };
  
  // Métricas principais
  const mainMetrics = ['lufs_integrated', 'lra', 'true_peak_dbtp', 'stereo_width', 'dr', 'calor', 'brilho', 'clareza'];
  
  for (const metric of mainMetrics) {
    const values = trackMetrics.map(t => t[metric]).filter(Number.isFinite);
    if (values.length === 0) continue;
    
    const med = median(values);
    const madVal = mad(values, med);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    values.sort((a, b) => a - b);
    const p10 = values[Math.floor(values.length * 0.1)];
    const p25 = values[Math.floor(values.length * 0.25)];
    const p50 = med;
    const p75 = values[Math.floor(values.length * 0.75)];
    const p90 = values[Math.floor(values.length * 0.9)];
    
    result[metric] = {
      mean: round2(mean),
      median: round2(med),
      mad: round2(madVal),
      p10: round2(p10),
      p25: round2(p25),
      p50: round2(p50),
      p75: round2(p75),
      p90: round2(p90),
      min: round2(values[0]),
      max: round2(values[values.length - 1]),
      count: values.length
    };
  }
  
  // Bandas espectrais
  const bands = {};
  for (const band of CONFIG.bands) {
    const values = trackMetrics.map(t => t.bands_db[band.key]).filter(Number.isFinite);
    if (values.length === 0) continue;
    
    const med = median(values);
    const madVal = mad(values, med);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    values.sort((a, b) => a - b);
    const p10 = values[Math.floor(values.length * 0.1)];
    const p25 = values[Math.floor(values.length * 0.25)];
    const p50 = med;
    const p75 = values[Math.floor(values.length * 0.75)];
    const p90 = values[Math.floor(values.length * 0.9)];
    
    bands[band.key] = {
      mean: round1(mean),
      median: round1(med),
      mad: round1(madVal),
      p10: round1(p10),
      p25: round1(p25),
      p50: round1(p50),
      p75: round1(p75),
      p90: round1(p90),
      min: round1(values[0]),
      max: round1(values[values.length - 1]),
      count: values.length,
      // Targets para análise
      target_db: round1(med),
      tol_db: round1(Math.max(0.5, robustTol(values, 0.5)))
    };
  }
  
  result.bands = bands;
  
  return result;
}

// ========== Geração de Preset de Análise ==========

function generateAnalysisPreset(aggregated) {
  if (!aggregated) return null;
  
  // Usar medianas como targets, percentis 25-75 como faixas aceitáveis
  const preset = {
    version: `recalc-${new Date().toISOString().slice(0, 10)}`,
    generated_at: aggregated.generated_at,
    num_tracks: aggregated.num_tracks,
    source: "metrics_recalc_tool",
    
    // Targets principais baseados em mediana
    lufs_target: aggregated.lufs_integrated?.median || -14,
    tol_lufs: Math.max(0.5, aggregated.lufs_integrated?.mad * 1.4826 || 1.0),
    
    true_peak_target: aggregated.true_peak_dbtp?.median || -1.0,
    tol_true_peak: Math.max(0.1, aggregated.true_peak_dbtp?.mad * 1.4826 || 0.5),
    
    dr_target: aggregated.dr?.median || 8.0,
    tol_dr: Math.max(0.5, aggregated.dr?.mad * 1.4826 || 1.0),
    
    lra_target: aggregated.lra?.median || 3.0,
    tol_lra: Math.max(0.5, aggregated.lra?.mad * 1.4826 || 1.5),
    
    stereo_target: aggregated.stereo_width?.median || 0.3,
    tol_stereo: Math.max(0.02, aggregated.stereo_width?.mad * 1.4826 || 0.1),
    
    // Derivados (opcionais)
    calor_target: aggregated.calor?.median,
    brilho_target: aggregated.brilho?.median,
    clareza_target: aggregated.clareza?.median,
    
    // Bandas espectrais
    bands: aggregated.bands
  };
  
  return preset;
}

// ========== Processamento Principal ==========

async function processGenre(genre, options = {}) {
  const { dry = false, concurrency = 4, save = false } = options;
  
  console.log(`\n🎵 === Reprocessando gênero: ${genre} ===`);
  console.log(`Modo: ${dry ? 'DRY-RUN' : 'PROCESSAMENTO'} | Concorrência: ${concurrency}`);
  
  // Descobrir arquivos
  const samplesDir = path.resolve('refs', genre, 'samples');
  if (!fs.existsSync(samplesDir)) {
    throw new Error(`Pasta de samples não encontrada: ${samplesDir}`);
  }
  
  const files = (await fsp.readdir(samplesDir))
    .filter(f => /\.(wav|mp3|flac)$/i.test(f))
    .map(f => path.join(samplesDir, f));
  
  if (files.length === 0) {
    throw new Error(`Nenhum arquivo de áudio encontrado em: ${samplesDir}`);
  }
  
  console.log(`📁 Encontrados ${files.length} arquivos:`);
  files.forEach((f, i) => console.log(`  ${i + 1}. ${path.basename(f)}`));
  
  if (dry) {
    console.log('\n✅ DRY-RUN: Processamento simulado com sucesso');
    return { files: files.length, processed: 0, aggregated: null, preset: null };
  }
  
  // Processar arquivos com limite de concorrência
  const trackMetrics = [];
  let processed = 0;
  
  console.log('\n🔄 Iniciando processamento de faixas...');
  
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const promises = batch.map(async (file) => {
      const startTime = Date.now();
      
      try {
        console.log(`📊 Processando: ${path.basename(file)}`);
        
        const wav = readWavFile(file);
        let { left, right, sampleRate } = wav;
        
        // Reamostrar se necessário
        if (sampleRate !== CONFIG.sampleRate) {
          console.log(`  🔄 Reamostrando: ${sampleRate}Hz → ${CONFIG.sampleRate}Hz`);
          left = resampleLinear(left, sampleRate, CONFIG.sampleRate);
          right = resampleLinear(right, sampleRate, CONFIG.sampleRate);
        }
        
        const metrics = measureTrack(left, right, CONFIG.sampleRate);
        
        if (metrics) {
          metrics._file = path.basename(file);
          metrics._processingTime = Date.now() - startTime;
          trackMetrics.push(metrics);
          console.log(`  ✅ Concluído: ${metrics._processingTime}ms`);
        } else {
          console.log(`  ❌ Falha na medição`);
        }
        
        processed++;
        
      } catch (error) {
        console.warn(`  ⚠️ Erro: ${error.message}`);
      }
    });
    
    await Promise.all(promises);
    console.log(`📈 Progresso: ${processed}/${files.length} (${Math.round(processed/files.length*100)}%)`);
  }
  
  if (trackMetrics.length === 0) {
    throw new Error('Nenhuma faixa foi processada com sucesso');
  }
  
  console.log(`\n✅ Processamento concluído: ${trackMetrics.length}/${files.length} faixas`);
  
  // Agregação
  console.log('\n📊 Calculando métricas agregadas...');
  const aggregated = aggregateMetrics(trackMetrics);
  
  // Gerar preset
  console.log('🎯 Gerando preset de análise...');
  const preset = generateAnalysisPreset(aggregated);
  
  // Salvar se solicitado
  if (save && !dry) {
    await saveResults(genre, { aggregated, preset, trackMetrics });
  }
  
  return { files: files.length, processed: trackMetrics.length, aggregated, preset };
}

async function saveResults(genre, { aggregated, preset, trackMetrics }) {
  const outDir = path.resolve('refs', 'out');
  await fsp.mkdir(outDir, { recursive: true });
  
  // Manifest individual por faixa
  const manifestPath = path.join(outDir, `${genre}-tracks-manifest.json`);
  const manifest = {
    genre,
    generated_at: new Date().toISOString(),
    schema_version: "1.0",
    source: "metrics_recalc_tool",
    tracks: trackMetrics.map(t => ({
      file: t._file,
      processing_time_ms: t._processingTime,
      metrics: {
        lufs_integrated: t.lufs_integrated,
        lra: t.lra,
        true_peak_dbtp: t.true_peak_dbtp,
        stereo_width: t.stereo_width,
        dr: t.dr,
        calor: t.calor,
        brilho: t.brilho,
        clareza: t.clareza,
        bands_db: t.bands_db
      }
    }))
  };
  
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`💾 Manifest salvo: ${manifestPath}`);
  
  // Métricas agregadas
  const aggregatedPath = path.join(outDir, `${genre}-aggregated.json`);
  await fsp.writeFile(aggregatedPath, JSON.stringify(aggregated, null, 2));
  console.log(`📊 Agregados salvos: ${aggregatedPath}`);
  
  // Preset para análise (compatível com sistema existente)
  const presetPath = path.join(outDir, `${genre}.json`);
  
  // Verificar se já existe preset
  let existingPreset = {};
  if (fs.existsSync(presetPath)) {
    try {
      const existing = await fsp.readFile(presetPath, 'utf8');
      existingPreset = JSON.parse(existing);
      console.log(`🔄 Atualizando preset existente: ${presetPath}`);
    } catch (error) {
      console.warn(`⚠️ Erro ao ler preset existente: ${error.message}`);
    }
  }
  
  // Mesclar com dados existentes (preservar estrutura se houver)
  const finalPreset = {
    [genre]: {
      ...existingPreset[genre],
      ...preset,
      // Manter compatibilidade com schema antigo
      legacy_compatibility: {
        lufs_target: preset.lufs_target,
        tol_lufs: preset.tol_lufs,
        true_peak_target: preset.true_peak_target,
        tol_true_peak: preset.tol_true_peak,
        dr_target: preset.dr_target,
        tol_dr: preset.tol_dr,
        lra_target: preset.lra_target,
        tol_lra: preset.tol_lra,
        stereo_target: preset.stereo_target,
        tol_stereo: preset.tol_stereo,
        calor_target: preset.calor_target,
        brilho_target: preset.brilho_target,
        clareza_target: preset.clareza_target,
        bands: preset.bands
      }
    }
  };
  
  await fsp.writeFile(presetPath, JSON.stringify(finalPreset, null, 2));
  console.log(`🎯 Preset salvo: ${presetPath}`);
}

// ========== Invalidação de Cache ==========

async function invalidateCaches(genre) {
  console.log('\n🔄 Invalidando caches...');
  
  // Copiar para public (se script existir)
  try {
    const copyScript = path.resolve('tools', 'copy-refs-to-public.js');
    if (fs.existsSync(copyScript)) {
      const { spawn } = await import('node:child_process');
      await new Promise((resolve, reject) => {
        const proc = spawn('node', [copyScript], { stdio: 'inherit' });
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Exit code: ${code}`)));
      });
      console.log('✅ Referências copiadas para public/');
    }
  } catch (error) {
    console.warn(`⚠️ Falha ao copiar refs: ${error.message}`);
  }
  
  // Outras invalidações poderiam ir aqui (Redis, CDN, etc.)
  console.log('🆕 Cache invalidado');
}

// ========== CLI ==========

async function main() {
  const args = process.argv.slice(2);
  
  // Parse argumentos
  const genre = args.find(a => !a.startsWith('-')) || 
                args.find(a => a.startsWith('--genre='))?.split('=')[1];
  
  const dry = args.includes('--dry');
  const save = args.includes('--save') && !dry; // Não salvar em dry-run
  const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1]) || 4;
  
  if (!genre) {
    console.error(`
❌ Uso: node metrics-recalc.js <genre> [options]

Exemplos:
  node metrics-recalc.js funk_mandela --dry              # Dry-run
  node metrics-recalc.js funk_mandela --save             # Processar e salvar
  node metrics-recalc.js funk_mandela --save --concurrency=2  # Limite de concorrência

Opções:
  --dry               Simular processamento (não calcula métricas)
  --save              Salvar resultados em refs/out/
  --concurrency=N     Limite de faixas simultâneas (default: 4)
`);
    process.exit(1);
  }
  
  try {
    const startTime = Date.now();
    
    console.log(`🚀 Iniciando reprocessamento de ${genre}`);
    console.log(`⚙️ Configuração: LUFS=${CONFIG.lufsTarget}, Janela=${CONFIG.windowSeconds}s, Hop=${CONFIG.hopSeconds}s`);
    
    const result = await processGenre(genre, { dry, save, concurrency });
    
    const totalTime = Date.now() - startTime;
    
    console.log(`\n🎉 === REPROCESSAMENTO CONCLUÍDO ===`);
    console.log(`⏱️ Tempo total: ${totalTime}ms`);
    console.log(`📁 Arquivos encontrados: ${result.files}`);
    console.log(`✅ Faixas processadas: ${result.processed}`);
    
    if (result.aggregated && result.preset) {
      console.log(`\n📊 === MÉTRICAS AGREGADAS ===`);
      console.log(`LUFS: ${result.preset.lufs_target} ± ${result.preset.tol_lufs}`);
      console.log(`True Peak: ${result.preset.true_peak_target} ± ${result.preset.tol_true_peak}`);
      console.log(`DR: ${result.preset.dr_target} ± ${result.preset.tol_dr}`);
      console.log(`LRA: ${result.preset.lra_target} ± ${result.preset.tol_lra}`);
      console.log(`Estéreo: ${result.preset.stereo_target} ± ${result.preset.tol_stereo}`);
      
      if (result.preset.bands) {
        console.log(`\n🎛️ === BANDAS ESPECTRAIS ===`);
        for (const [band, data] of Object.entries(result.preset.bands)) {
          console.log(`${band}: ${data.target_db}dB ± ${data.tol_db}dB`);
        }
      }
    }
    
    if (save && !dry) {
      await invalidateCaches(genre);
      console.log('\n✅ Resultados salvos e caches invalidados');
      console.log(`📍 Arquivos gerados em: refs/out/${genre}*`);
    }
    
  } catch (error) {
    console.error(`\n❌ Erro: ${error.message}`);
    if (process.env.DEBUG) console.error(error.stack);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('metrics-recalc.js')) {
  main().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });
}

export { processGenre, measureTrack, aggregateMetrics, generateAnalysisPreset };
