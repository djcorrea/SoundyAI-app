/**
 * ═══════════════════════════════════════════════════════════
 * AUTOMASTER V1 — MINI ANALYZER
 * ═══════════════════════════════════════════════════════════
 *
 * Analisador leve (CJS puro + FFmpeg) que extrai as mesmas
 * métricas do analisador completo, sem dependência de buffer
 * decodificado, FFT ou I/O ESM.
 *
 * Retorna contrato padronizado:
 * {
 *   lufs, truePeak, crestFactor,
 *   bands: { sub, bass, mid, highMid, air }
 * }
 *
 * Se qualquer medição de banda falhar, o campo retorna null
 * e o buildMasteringPlan usa valores default (comportamento
 * anterior é preservado).
 *
 * Bandas (compatíveis com spectral-bands.js do analisador):
 *   sub      20–60 Hz     (sub-bass profundo)
 *   bass     60–150 Hz    (graves — punch)
 *   mid      150–2000 Hz  (corpo — lowMid + mid combinados)
 *   highMid  2000–10000 Hz (presença + highMid combinados)
 *   air      10000–20000 Hz (ar — brilho topo)
 */

'use strict';

const DEFAULT_CREST_FACTOR = 7.0;

/**
 * Mede o RMS de uma faixa de frequência usando FFmpeg com
 * filtros highpass + lowpass em cascata + astats.
 *
 * @param {string} filePath      Caminho do arquivo WAV
 * @param {number|null} freqLow  Frequência de corte inferior (null = sem highpass)
 * @param {number|null} freqHigh Frequência de corte superior (null = sem lowpass)
 * @param {Function} execAsync   util.promisify(exec)
 * @returns {Promise<number|null>} RMS em dBFS ou null se falhou
 */
async function measureBandRMS(filePath, freqLow, freqHigh, execAsync) {
  const filters = [];

  if (freqLow != null)  filters.push(`highpass=f=${freqLow}`);
  if (freqHigh != null) filters.push(`lowpass=f=${freqHigh}`);
  filters.push('astats=metadata=1:reset=0');

  const filterChain = filters.join(',');

  // -hide_banner reduz saída; NÃO usar -v quiet pois astats imprime em nível info
  const cmd = `ffmpeg -nostats -hide_banner -i "${filePath}" -af "${filterChain}" -f null -`;

  try {
    // execAsync pode estar no formato { stdout, stderr } ou só string
    // ffmpeg escreve astats no stderr
    const result = await execAsync(cmd + ' 2>&1', { timeout: 30000 });
    const output = typeof result === 'string' ? result : (result.stdout || '') + (result.stderr || '');

    // astats emite "RMS level dB: <valor>" para cada canal e overall
    // Queremos o Overall (ou a última ocorrência)
    const rmsMatches = [...output.matchAll(/RMS level dB:\s*([-\d.]+)/g)];
    if (rmsMatches.length === 0) return null;

    // Último match = canal overall (astats com reset=0 emite sumário no final)
    const rmsValues = rmsMatches.map(m => parseFloat(m[1])).filter(v => isFinite(v) && !isNaN(v));
    if (rmsValues.length === 0) return null;

    // Média dos valores disponíveis (L + R, ou só um canal)
    const avg = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
    return avg;
  } catch {
    return null;
  }
}

/**
 * Analisa arquivo de áudio e retorna métricas completas:
 * LUFS, True Peak, Crest Factor + 5 bandas espectrais.
 *
 * PASSAGEM 1 (sequencial): loudnorm + astats → LUFS / TP / CF
 * PASSAGEM 2 (paralela):   5x FFmpeg banda → bands.*.energy_db
 *
 * @param {string}   filePath  Caminho absoluto do WAV
 * @param {Function} execAsync util.promisify(exec)
 * @returns {Promise<Object>}  Contrato padronizado de métricas
 */
async function analyzeWithBands(filePath, execAsync) {
  console.error('[MINI-ANALYZER] Iniciando análise com bandas...');

  // ═══════════════════════════════════════════════════════════
  // PASSAGEM 1: LUFS / TP / CF  (idêntica a analyzeAudioMetrics)
  // ═══════════════════════════════════════════════════════════
  const pass1Cmd = `ffmpeg -i "${filePath}" -af "loudnorm=print_format=json,astats=metadata=1:reset=1" -f null - 2>&1`;

  let lufs = -20.0;
  let truePeak = -1.0;
  let crestFactor = DEFAULT_CREST_FACTOR;
  let cfCalculated = false;

  try {
    const pass1 = await execAsync(pass1Cmd, { timeout: 60000 });
    const out1 = typeof pass1 === 'string' ? pass1 : (pass1.stdout || '') + (pass1.stderr || '');

    const lufsMatch  = out1.match(/"input_i"\s*:\s*"([^"]+)"/);
    const peakMatch  = out1.match(/"input_tp"\s*:\s*"([^"]+)"/);
    const rmsMatch   = out1.match(/RMS level dB:\s*([-\d.]+)/);
    const pkLvlMatch = out1.match(/Peak level dB:\s*([-\d.]+)/);

    if (lufsMatch)  lufs     = parseFloat(lufsMatch[1]);
    if (peakMatch)  truePeak = parseFloat(peakMatch[1]);

    if (rmsMatch && pkLvlMatch) {
      const cf = parseFloat(pkLvlMatch[1]) - parseFloat(rmsMatch[1]);
      if (cf > 0 && cf <= 30) { crestFactor = cf; cfCalculated = true; }
    }
  } catch (e) {
    console.error('[MINI-ANALYZER] Passagem 1 falhou:', e.message);
  }

  console.error(`[MINI-ANALYZER] P1: LUFS=${lufs.toFixed(1)} TP=${truePeak.toFixed(1)} CF=${crestFactor.toFixed(1)}${cfCalculated ? '' : ' (fallback)'}`);

  // ═══════════════════════════════════════════════════════════
  // PASSAGEM 2: 5 BANDAS EM PARALELO
  //
  // Compatível com spectral-bands.js (sub/bass/mid/highMid/air).
  // Intervalos ajustados para:
  //   sub     20–60 Hz   → energia do sub-bass profundo
  //   bass    60–150 Hz  → punch dos graves
  //   mid     150–2000 Hz→ corpo (lowMid + mid combinados)
  //   highMid 2–10 kHz   → presença (highMid + presence)
  //   air     10–20 kHz  → ar
  //
  // OBS.: valores são RMS absolutos em dBFS por banda.
  // Bandas mais estreitas produzem valores naturalmente mais
  // baixos — os thresholds em buildMasteringPlan já compensam.
  // ═══════════════════════════════════════════════════════════
  const bandDefs = [
    { key: 'sub',     lo: 20,    hi: 60    },
    { key: 'bass',    lo: 60,    hi: 150   },
    { key: 'mid',     lo: 150,   hi: 2000  },
    { key: 'highMid', lo: 2000,  hi: 10000 },
    { key: 'air',     lo: 10000, hi: null  },  // null = sem lowpass (até Nyquist)
  ];

  const bandPromises = bandDefs.map(({ lo, hi }) =>
    measureBandRMS(filePath, lo, hi, execAsync)
  );

  const bandResults = await Promise.all(bandPromises);

  const bands = {};
  bandDefs.forEach(({ key }, idx) => {
    const val = bandResults[idx];
    bands[key] = val !== null ? { energy_db: val } : null;
    if (val !== null) {
      console.error(`[MINI-ANALYZER] Band ${key.padEnd(7)}: ${val.toFixed(1)} dBFS`);
    } else {
      console.error(`[MINI-ANALYZER] Band ${key.padEnd(7)}: N/A (falhou)`);
    }
  });

  const allBandsFailed = Object.values(bands).every(b => b === null);
  if (allBandsFailed) {
    console.error('[MINI-ANALYZER] ⚠️ Todas as bandas falharam — plano usará defaults');
  }

  return {
    lufs,
    truePeak,
    crestFactor,
    bands: allBandsFailed ? null : bands,
    success: true
  };
}

module.exports = { analyzeWithBands };
