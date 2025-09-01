/**
 * Reference Calibrator - Ajusta tolerâncias em refs/out/<genero>.json
 * Objetivo: medir arquivos reais com o mesmo pipeline do builder e sugerir novas tol_* e tol_db.
 * Regras: Node ESM sem dependências; mesma janela/hop e normalização por LUFS do JSON.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuso do motor FFT/STFT e métricas de loudness/true-peak
import { STFTEngine, nextPowerOfTwo } from '../lib/audio/fft.js';
import { calculateLoudnessMetrics } from '../lib/audio/features/loudness.js';
import { analyzeTruePeaks } from '../lib/audio/features/truepeak.js';

// Config calibrador (deve espelhar o builder)
const CONFIG = {
  sampleRate: 48000,
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

// ---------- Utils básicos ----------
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

// WAV reader (igual ao builder, limitado a WAV PCM/float32)
async function readWavFile(filePath) {
  const buf = await fsp.readFile(filePath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Formato não suportado (apenas WAV)');
  }
  let offset = 12;
  let format, numChannels, sampleRate, bitsPerSample, dataOffset = -1, dataSize = 0;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === 'fmt ') {
      format = buf.readUInt16LE(chunkStart);
      numChannels = buf.readUInt16LE(chunkStart + 2);
      sampleRate = buf.readUInt32LE(chunkStart + 4);
      bitsPerSample = buf.readUInt16LE(chunkStart + 14);
    } else if (chunkId === 'data') {
      dataOffset = chunkStart;
      dataSize = chunkSize;
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }
  if (dataOffset < 0) throw new Error('Chunk data não encontrado');
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * numChannels));
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  let pos = dataOffset;
  for (let i = 0; i < frameCount; i++) {
    let sL;
    if (format === 3 && bitsPerSample === 32) {
      sL = buf.readFloatLE(pos);
    } else if (bitsPerSample === 16) {
      sL = buf.readInt16LE(pos) / 32768;
    } else if (bitsPerSample === 24) {
      const b0 = buf[pos]; const b1 = buf[pos + 1]; const b2 = buf[pos + 2];
      let val = b0 | (b1 << 8) | (b2 << 16); if (val & 0x800000) val |= 0xFF000000; sL = val / 8388608;
    } else if (bitsPerSample === 32) {
      sL = buf.readInt32LE(pos) / 2147483648;
    } else { throw new Error(`PCM não suportado: ${bitsPerSample} bits`); }
    pos += bytesPerSample;
    let sR;
    if (numChannels > 1) {
      if (format === 3 && bitsPerSample === 32) {
        sR = buf.readFloatLE(pos);
      } else if (bitsPerSample === 16) {
        sR = buf.readInt16LE(pos) / 32768;
      } else if (bitsPerSample === 24) {
        const c0 = buf[pos]; const c1 = buf[pos + 1]; const c2 = buf[pos + 2];
        let v = c0 | (c1 << 8) | (c2 << 16); if (v & 0x800000) v |= 0xFF000000; sR = v / 8388608;
      } else if (bitsPerSample === 32) {
        sR = buf.readInt32LE(pos) / 2147483648;
      } else { throw new Error(`PCM não suportado: ${bitsPerSample} bits`); }
      pos += bytesPerSample;
    } else {
      sR = sL;
    }
    left[i] = sL; right[i] = sR;
  }
  return { left, right, sampleRate, channels: numChannels };
}

function resampleLinear(channel, fromRate, toRate) {
  if (fromRate === toRate) return channel;
  const ratio = toRate / fromRate;
  const outLen = Math.floor(channel.length * ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio; const i0 = Math.floor(srcPos); const i1 = Math.min(i0 + 1, channel.length - 1); const t = srcPos - i0;
    out[i] = channel[i0] * (1 - t) + channel[i1] * t;
  }
  return out;
}

function applyGainDb(data, gainDb) { const g = Math.pow(10, gainDb / 20); for (let i = 0; i < data.length; i++) data[i] *= g; }

function stereoWidth01(left, right) {
  const n = Math.min(left.length, right.length); let sumMid = 0, sumSide = 0;
  for (let i = 0; i < n; i++) { const mid = (left[i] + right[i]) * 0.5; const side = (left[i] - right[i]) * 0.5; sumMid += mid * mid; sumSide += side * side; }
  const rmsMid = Math.sqrt(sumMid / n); const rmsSide = Math.sqrt(sumSide / n);
  // Sanidade: restringe 0..1
  return rmsMid > 0 ? Math.min(1, Math.max(0, rmsSide / rmsMid)) : 0;
}

function rmsDb(left, right) { const n = Math.min(left.length, right.length); let sum = 0; for (let i = 0; i < n; i++) { const m = (left[i] + right[i]) * 0.5; sum += m * m; } const rms = Math.sqrt(sum / n); return rms > 0 ? 20 * Math.log10(rms) : -Infinity; }

function bandToBins(range, freqBins) {
  const [f0, f1] = range; let i0 = 1, i1 = freqBins.length - 1;
  for (let i = 1; i < freqBins.length; i++) { if (freqBins[i] >= f0) { i0 = i; break; } }
  for (let i = i0; i < freqBins.length; i++) { if (freqBins[i] >= f1) { i1 = i; break; } }
  return [i0, Math.max(i1, i0 + 1)];
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
    let global = 0; for (let i = g0; i < g1; i++) global += framePow[i];
    if (global <= 0) continue;
    for (const { key, bins } of binRanges) {
      let sum = 0; for (let i = bins[0]; i < bins[1]; i++) sum += framePow[i];
      const rel = sum > 0 ? 10 * Math.log10(sum / global) : -80;
      bandAccum.set(key, bandAccum.get(key) + rel);
    }
    totalFrames++;
  }
  const profile = {}; for (const { key } of binRanges) { profile[key] = totalFrames > 0 ? bandAccum.get(key) / totalFrames : -80; }
  return profile;
}

function measureTrackNormalized(left, right, sampleRate, lufsTarget) {
  const lufs = calculateLoudnessMetrics(left, right, sampleRate);
  const gainDb = lufsTarget - lufs.lufs_integrated;
  const L = new Float32Array(left); const R = new Float32Array(right);
  applyGainDb(L, gainDb); applyGainDb(R, gainDb);
  const tp = analyzeTruePeaks(L, R, sampleRate);
  const stereo = stereoWidth01(L, R);
  const rms = rmsDb(L, R);
  const peakDb = Math.max(tp.sample_peak_left_db || -Infinity, tp.sample_peak_right_db || -Infinity);
  const dr = (peakDb > -Infinity && rms > -Infinity) ? (peakDb - rms) : 0;
  const bandsDb = computeBandProfile(L, R, sampleRate);
  return {
    lufs_integrated: lufsTarget,
    lra: lufs.lra,
    true_peak_dbtp: tp.true_peak_dbtp,
    stereo_width: stereo,
    dr: dr,
    bands_db: bandsDb
  };
}

function classify(delta, tol) {
  const a = Math.abs(delta);
  if (a <= tol) return 'OK';
  if (a <= 1.5 * tol) return 'leve';
  if (a <= 2.5 * tol) return 'moderado';
  return 'alto';
}

function bumpPatch(version) {
  if (!version) return '1.0.1';
  const m = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return `${version}.1`;
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

async function loadRefJSON(genre) {
  const fp = path.resolve(process.cwd(), 'refs', 'out', `${genre}.json`);
  if (!fs.existsSync(fp)) throw new Error(`Referência não encontrada: ${fp}`);
  const json = JSON.parse(await fsp.readFile(fp, 'utf8'));
  const g = json[genre];
  if (!g) throw new Error(`Chave do gênero ausente no JSON: ${genre}`);
  return { fp, json, g };
}

async function collectInputFiles(args) {
  const out = [];
  for (const a of args) {
    const p = path.resolve(process.cwd(), a);
    if (!fs.existsSync(p)) { console.warn(`Ignorado: ${a} (não existe)`); continue; }
    const stat = await fsp.stat(p);
    if (stat.isDirectory()) {
      const files = (await fsp.readdir(p)).filter(f => /\.wav$/i.test(f)).map(f => path.join(p, f));
      out.push(...files);
    } else if (stat.isFile()) {
      out.push(p);
    }
  }
  // Remover duplicatas
  return Array.from(new Set(out));
}

function printHeader(title) { console.log(`\n=== ${title} ===`); }

async function main() {
  const argv = process.argv.slice(2);
  const genre = argv.find(a => !a.startsWith('-'));
  if (!genre) {
    console.error('Uso: node tools/ref-calibrator.js <genero> <arquivos_ou_pastas...> [--write] [--min-ok=0.8]');
    process.exit(1);
  }
  const write = argv.includes('--write');
  const autoWrite = argv.includes('--auto-write');
  const minOkArg = argv.find(a => a.startsWith('--min-ok='));
  const minOk = minOkArg ? Math.max(0, Math.min(1, Number(minOkArg.split('=')[1]) || 0.8)) : 0.8;
  const extra = argv.filter(a => a !== genre && !a.startsWith('--'));

  const { fp, json, g } = await loadRefJSON(genre);
  const lufsTarget = Number(g.lufs_target ?? -14);
  // Sanidade para stereo_target 0..1
  if (Number.isFinite(g.stereo_target) && (g.stereo_target < 0 || g.stereo_target > 1)) {
    const old = g.stereo_target; g.stereo_target = clamp(g.stereo_target, 0, 1);
    console.warn(`⚠️ stereo_target fora de 0–1 no JSON (=${round2(old)}). Ajustado em memória para ${round2(g.stereo_target)} para a calibração.`);
  }
  const files = await collectInputFiles(extra.length ? extra : [path.join('refs', genre)]);
  if (!files.length) { console.error('Nenhum arquivo WAV fornecido nem encontrado no diretório padrão.'); process.exit(1); }

  printHeader(`Calibração de ${genre} | arquivos: ${files.length}`);
  console.log(`Alvo LUFS: ${lufsTarget} | Tol atuais: lufs=${g.tol_lufs}, tp=${g.tol_true_peak}, dr=${g.tol_dr}, lra=${g.tol_lra}, stereo=${g.tol_stereo}`);

  // Medições por arquivo
  const perFile = [];
  for (const f of files) {
    try {
      const wav = await readWavFile(f);
      let L = wav.left, R = wav.right;
      if (wav.sampleRate !== CONFIG.sampleRate) {
        L = resampleLinear(L, wav.sampleRate, CONFIG.sampleRate);
        R = resampleLinear(R, wav.sampleRate, CONFIG.sampleRate);
      }
      const m = measureTrackNormalized(L, R, CONFIG.sampleRate, lufsTarget);
      perFile.push({ file: f, m });
    } catch (e) {
      console.warn(`⚠️ Falha ao medir ${path.basename(f)}: ${e.message}`);
    }
  }
  if (!perFile.length) { console.error('Nenhum arquivo pôde ser medido.'); process.exit(1); }

  // Parâmetros principais a comparar
  const params = [
    { key: 'true_peak_dbtp', target: 'true_peak_target', tol: 'tol_true_peak', min: 0.1, max: 2.0, round: round2 },
    { key: 'dr', target: 'dr_target', tol: 'tol_dr', min: 0.8, max: 4.0, round: round1 },
    { key: 'lra', target: 'lra_target', tol: 'tol_lra', min: 0.8, max: 4.0, round: round1 },
    { key: 'stereo_width', target: 'stereo_target', tol: 'tol_stereo', min: 0.02, max: 0.15, round: round2 }
  ];

  // Relatório por arquivo
  printHeader('Resultados por arquivo');
  for (const { file, m } of perFile) {
    console.log(`\n• ${path.basename(file)}`);
    for (const p of params) {
      const tgt = Number(g[p.target]); const tol = Number(g[p.tol]);
      if (!Number.isFinite(tgt) || !Number.isFinite(tol)) continue;
      const val = m[p.key]; const delta = val - tgt; const sev = classify(delta, tol);
      console.log(`  ${p.key}: val=${p.round(val)} | tgt=${p.round(tgt)} | Δ=${p.round(delta)} | sev=${sev}`);
    }
    // Bandas (somente as presentes no JSON)
    if (g.bands) {
      const keys = Object.keys(g.bands);
      for (const bk of keys) {
        const bandVal = m.bands_db[bk];
        if (!Number.isFinite(bandVal)) continue;
        const tgt = Number(g.bands[bk].target_db); const tol = Number(g.bands[bk].tol_db);
        const delta = bandVal - tgt; const sev = classify(delta, tol);
        console.log(`  band:${bk}: val=${round1(bandVal)} | tgt=${round1(tgt)} | Δ=${round1(delta)} | sev=${sev}`);
      }
    }
  }

  // Agregações de deltas para sugerir tolerâncias
  printHeader('Agregações e proposta de tolerâncias');
  const proposals = { top: {}, bands: {} };
  const okRatesCurrent = { top: {}, bands: {} };
  const okRatesProposed = { top: {}, bands: {} };
  const mads = { top: {}, bands: {} };

  for (const p of params) {
    const tgt = Number(g[p.target]); if (!Number.isFinite(tgt)) continue;
    const deltas = perFile.map(x => (x.m[p.key] - tgt)).filter(Number.isFinite);
    // Estatísticas
    const med = deltas.length ? median(deltas) : 0;
    const madVal = deltas.length ? mad(deltas, med) : 0;
    mads.top[p.key] = madVal;
    const tolRobust = robustTol(deltas, p.min);
    const tolNew = clamp(p.round(tolRobust), p.min, p.max);
  const okRate = perFile.filter(x => Math.abs(x.m[p.key] - tgt) <= Number(g[p.tol])).length / perFile.length;
  const okRateNew = perFile.filter(x => Math.abs(x.m[p.key] - tgt) <= tolNew).length / perFile.length;
  okRatesCurrent.top[p.key] = okRate; okRatesProposed.top[p.key] = okRateNew;
  console.log(`- ${p.key}: MAD=${p.round(madVal)} | ok_atual=${(okRate*100).toFixed(0)}% | tol_atual=${g[p.tol]} → tol_nova=${tolNew} | ok_previsto=${(okRateNew*100).toFixed(0)}%`);
    proposals.top[p.tol] = tolNew;
  }

  if (g.bands) {
    const keys = Object.keys(g.bands);
    for (const bk of keys) {
      const tgt = Number(g.bands[bk].target_db);
      if (!Number.isFinite(tgt)) continue;
      const deltas = perFile.map(x => (x.m.bands_db[bk] - tgt)).filter(Number.isFinite);
      const med = deltas.length ? median(deltas) : 0;
      const madVal = deltas.length ? mad(deltas, med) : 0;
      mads.bands[bk] = madVal;
      const tolRobust = robustTol(deltas, 0.5);
      const tolNew = clamp(round1(tolRobust), 0.5, 3.0);
      // taxa OK atual
      const tolAtual = Number(g.bands[bk].tol_db);
      const okRate = perFile.filter(x => Math.abs(x.m.bands_db[bk] - tgt) <= tolAtual).length / perFile.length;
      const okRateNew = perFile.filter(x => Math.abs(x.m.bands_db[bk] - tgt) <= tolNew).length / perFile.length;
  okRatesCurrent.bands[bk] = okRate; okRatesProposed.bands[bk] = okRateNew;
  console.log(`- band:${bk}: MAD=${round1(madVal)} | ok_atual=${(okRate*100).toFixed(0)}% | tol_atual=${tolAtual} → tol_nova=${tolNew} | ok_previsto=${(okRateNew*100).toFixed(0)}%`);
      proposals.bands[bk] = tolNew;
    }
  }

  // Checagem de cobertura (percentual OK com tolerâncias atuais)
  printHeader('Cobertura OK com tolerâncias atuais');
  function okRateFor(paramKey, target, tol) {
    const ok = perFile.filter(x => Math.abs(x.m[paramKey] - target) <= tol).length;
    return ok / perFile.length;
  }
  for (const p of params) {
    const tgt = Number(g[p.target]); const tol = Number(g[p.tol]); if (!Number.isFinite(tgt) || !Number.isFinite(tol)) continue;
    console.log(`- ${p.key}: ${(okRateFor(p.key, tgt, tol)*100).toFixed(0)}% OK`);
  }
  if (g.bands) {
    const keys = Object.keys(g.bands);
    for (const bk of keys) {
      const tgt = Number(g.bands[bk].target_db); const tol = Number(g.bands[bk].tol_db);
      const ok = perFile.filter(x => Number.isFinite(x.m.bands_db[bk]) && Math.abs(x.m.bands_db[bk] - tgt) <= tol).length / perFile.length;
      console.log(`- band:${bk}: ${(ok*100).toFixed(0)}% OK`);
    }
  }

  // Resumo %OK antes/depois (geral)
  const allCurr = [
    ...Object.values(okRatesCurrent.top),
    ...Object.values(okRatesCurrent.bands)
  ];
  const allNew = [
    ...Object.values(okRatesProposed.top),
    ...Object.values(okRatesProposed.bands)
  ];
  const mean = arr => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const overallCurr = mean(allCurr);
  const overallNew = mean(allNew);
  console.log(`\n%OK geral (atual): ${(overallCurr*100).toFixed(1)}%`);
  console.log(`%OK geral (proposto): ${(overallNew*100).toFixed(1)}%`);

  // Diagnóstico de bloqueios quando cobertura proposta < 80%
  if (overallNew < (minOk * 100 ? minOk : 0.8)) {
    console.log('\n⚠️ Cobertura proposta abaixo do limiar. Possíveis bloqueios:');
    // listar top 3 bandas com menor ok previsto
    const bandRates = Object.entries(okRatesProposed.bands).map(([k, v]) => ({ k, v: v ?? 0 }));
    bandRates.sort((a, b) => (a.v - b.v));
    const worstBands = bandRates.slice(0, 3).map(x => `${x.k}=${((x.v||0)*100).toFixed(0)}%`);
    if (worstBands.length) console.log(`- Bandas críticas: ${worstBands.join(', ')}`);
    // parâmetros top com menor ok
    const topRates = Object.entries(okRatesProposed.top).map(([k, v]) => ({ k, v: v ?? 0 }));
    topRates.sort((a, b) => (a.v - b.v));
    const worstTop = topRates.slice(0, 2).map(x => `${x.k}=${((x.v||0)*100).toFixed(0)}%`);
    if (worstTop.length) console.log(`- Parâmetros críticos: ${worstTop.join(', ')}`);
    // outliers simples: arquivos com soma de severidades altas
    const outlierScores = perFile.map(pf => {
      let score = 0;
      for (const [bk, rate] of Object.entries(g.bands || {})) {
        const v = pf.m.bands_db[bk];
        if (!Number.isFinite(v)) continue;
        const d = Math.abs(v - Number(rate.target_db));
        const t = Number(rate.tol_db) || 1;
        if (d > 2.5 * t) score += 2; else if (d > 1.5 * t) score += 1;
      }
      return { file: pf.file, score };
    }).sort((a, b) => b.score - a.score);
    const worst = outlierScores.slice(0, 3).filter(x => x.score > 0);
    if (worst.length) {
      console.log('- Possíveis outliers:');
      for (const w of worst) console.log(`  • ${path.basename(w.file)} (score=${w.score})`);
    }
    console.log('- Sugestões: remova/sep. outliers, considere subestilos, adicione mais faixas equilibradas.');
  }

  // Opcional: escrita
  const shouldWrite = write || (autoWrite && overallNew >= minOk);
  if (shouldWrite) {
    printHeader('Atualizando JSON de referência (--write)');
    // Aplicar propostas
    const gNew = { ...g };
    for (const [tolKey, val] of Object.entries(proposals.top)) gNew[tolKey] = val;
    if (gNew.bands) {
      gNew.bands = { ...gNew.bands };
      for (const [bk, tolVal] of Object.entries(proposals.bands)) {
        if (gNew.bands[bk]) gNew.bands[bk] = { ...gNew.bands[bk], tol_db: tolVal };
      }
    }
    // Atualizar contagem real de faixas processadas
    gNew.num_tracks = perFile.length;
    // Bump version & timestamp
    const versionOld = g.version || json.version || '1.0.0';
    gNew.version = bumpPatch(versionOld);
    gNew.generated_at = new Date().toISOString();

    const out = { ...json, [genre]: gNew };
    await fsp.writeFile(fp, JSON.stringify(out, null, 2), 'utf8');
    console.log(`✔️ Atualizado ${fp} (versão ${versionOld} → ${gNew.version})`);
  } else {
    console.log('\nℹ️ Use --write para aplicar as novas tol_* no JSON.');
    if (autoWrite) {
      console.log(`ℹ️ --auto-write ativo, mas %OK atual (${(overallCurr*100).toFixed(1)}%) < min-ok (${(minOk*100).toFixed(0)}%), então não foi aplicado.`);
    }
  }
}

// Executar somente quando chamado diretamente (compatível com Windows)
try {
  const thisFile = fileURLToPath(import.meta.url);
  if (thisFile === process.argv[1]) {
    main().catch(err => { console.error('❌ Erro na calibração:', err); process.exit(1); });
  }
} catch (e) {
  // Fallback: tenta sempre rodar se não conseguir resolver
  main().catch(err => { console.error('❌ Erro na calibração:', err); process.exit(1); });
}
