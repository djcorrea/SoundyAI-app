/**
 * ═══════════════════════════════════════════════════════════
 * AUTOMASTER V1 — PEAK OUTLIER DETECTOR
 * ═══════════════════════════════════════════════════════════
 *
 * Detecta janelas de áudio com picos anormalmente altos
 * (outliers) que reduzem o headroom global de forma injusta,
 * e aplica correção local conservadora via gain reduction
 * com fade in/out — sem tocar o resto da música.
 *
 * Condições de ativação (todas devem ser verdadeiras):
 *   headroom < 1.2 dB
 *   LUFS < -11.0 LUFS
 *   hasOutliers === true
 *
 * Guardrails rígidos:
 *   gain reduction máx: -3 dB por região
 *   duração afetada máx: 5% da música
 *   LUFS não pode cair mais de 1.0 LU
 *   se headroom não melhorou: descarta correção
 */

'use strict';

// ─── Parâmetros configuráveis ───────────────────────────────────────────────
const WINDOW_MS              = 200;    // Duração de cada janela de análise (ms)
const OUTLIER_THRESHOLD_DB   = 3.0;   // Janela é outlier se peak > mediana + N dB
const MAX_GAIN_REDUCTION_DB  = 3.0;   // Redução máxima por região (dB)
const MIN_GAIN_REDUCTION_DB  = 1.0;   // Redução mínima para valer a pena aplicar
const FADE_MS                = 15;    // Fade in/out por região (ms)
const MAX_AFFECTED_RATIO     = 0.05;  // Máx 5% da duração total afetada

// Condições de ativação
const ACTIVATION_HEADROOM_MAX = 1.2;  // headroom < 1.2 dB para ativar
const ACTIVATION_LUFS_MAX    = -11.0; // LUFS < -11.0 para ativar

// ─── Detecção ───────────────────────────────────────────────────────────────

/**
 * Detecta janelas de 200ms com picos outliers em relação à mediana geral.
 *
 * @param {string}   filePath   Caminho absoluto do arquivo WAV
 * @param {Function} execAsync  util.promisify(exec)
 * @returns {Promise<Object>}
 *   { hasOutliers, outliers?, medianPeak?, severity?, totalAffectedMs?, reason? }
 */
async function detectPeakOutliers(filePath, execAsync) {
  // 1. Obter metadados do arquivo (SR, canais, duração)
  const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
  let sampleRate  = 44100;
  let numChannels = 2;
  let duration    = 0;

  try {
    const probeResult = await execAsync(probeCmd, { timeout: 15000 });
    const probeOutput = typeof probeResult === 'string'
      ? probeResult
      : (probeResult.stdout || '') + (probeResult.stderr || '');
    // Extrair JSON do output do ffprobe
    const jsonMatch = probeOutput.match(/\{[\s\S]+\}/);
    if (jsonMatch) {
      const probeData = JSON.parse(jsonMatch[0]);
      const audioStream = (probeData.streams || []).find(s => s.codec_type === 'audio') || probeData.streams?.[0];
      if (audioStream?.sample_rate) sampleRate  = parseInt(audioStream.sample_rate) || 44100;
      if (audioStream?.channels)    numChannels = parseInt(audioStream.channels)    || 2;
      if (probeData.format?.duration) duration  = parseFloat(probeData.format.duration) || 0;
    }
  } catch (e) {
    console.error('[PEAK DETECT] ffprobe falhou:', e.message);
  }

  if (duration <= 0) {
    console.error('[PEAK DETECT] Duração desconhecida — skip');
    return { hasOutliers: false, reason: 'duration_unknown' };
  }

  // 2. Analisar picos por janelas via astats
  const windowSamples  = Math.floor(sampleRate * WINDOW_MS / 1000);
  const windowDuration = windowSamples / sampleRate;

  const cmd = `ffmpeg -nostats -hide_banner -i "${filePath}" -af "asetnsamples=n=${windowSamples}:p=0,astats=metadata=1:reset=1" -f null - 2>&1`;

  let output = '';
  try {
    const result = await execAsync(cmd, { timeout: 180000 });
    output = typeof result === 'string' ? result : (result.stdout || '') + (result.stderr || '');
  } catch (e) {
    console.error('[PEAK DETECT] Análise por janelas falhou:', e.message);
    return { hasOutliers: false, reason: 'analysis_failed' };
  }

  // 3. Parsear picos por canal por janela
  // astats emite "Peak level dB: X" para cada canal de cada janela
  const peakDbPattern = /Peak level dB:\s*([-\d.]+)/g;
  const allPeaks = [];
  let match;
  while ((match = peakDbPattern.exec(output)) !== null) {
    const val = parseFloat(match[1]);
    if (isFinite(val) && val > -100) allPeaks.push(val);
  }

  if (allPeaks.length < numChannels * 3) {
    return { hasOutliers: false, reason: 'insufficient_data' };
  }

  // Agrupar picos por janela (numChannels peaks por janela)
  const windows = [];
  for (let i = 0; i + numChannels - 1 < allPeaks.length; i += numChannels) {
    const channelPeaks = allPeaks.slice(i, i + numChannels);
    const maxPeak      = Math.max(...channelPeaks);
    const windowIndex  = windows.length;
    const timestamp    = windowIndex * windowDuration;
    if (timestamp < duration) {
      windows.push({
        timestamp,
        end: Math.min(timestamp + windowDuration, duration),
        peak_db: maxPeak,
        index: windowIndex
      });
    }
  }

  if (windows.length < 5) {
    return { hasOutliers: false, reason: 'insufficient_windows' };
  }

  // 4. Calcular mediana dos picos (robusta a outliers)
  const sorted = [...windows].sort((a, b) => a.peak_db - b.peak_db);
  const median = sorted[Math.floor(sorted.length / 2)].peak_db;

  // 5. Identificar outliers: janelas com pico > mediana + OUTLIER_THRESHOLD_DB
  const outliers = windows.filter(w => w.peak_db > median + OUTLIER_THRESHOLD_DB);

  if (outliers.length === 0) {
    return { hasOutliers: false, medianPeak: median };
  }

  // 6. Severity
  const maxOutlierPeak = Math.max(...outliers.map(w => w.peak_db));
  const maxExcess      = maxOutlierPeak - median;
  let severity;
  if      (outliers.length <= 2 && maxExcess < 5)     severity = 'leve';
  else if (outliers.length <= 5 && maxExcess < 8)     severity = 'moderado';
  else                                                 severity = 'severo';

  // 7. Guardrail: mais de 5% da música afetada?
  const totalAffectedMs    = outliers.length * WINDOW_MS;
  const totalDurationMs    = duration * 1000;
  const affectedRatio      = totalAffectedMs / totalDurationMs;

  if (affectedRatio > MAX_AFFECTED_RATIO) {
    console.error(`[PEAK DETECT] Muitas regiões afetadas (${(affectedRatio * 100).toFixed(1)}% > ${MAX_AFFECTED_RATIO * 100}%) — padrão dinâmico normal`);
    return {
      hasOutliers: false,
      reason: 'too_many_affected_regions',
      affected_ratio: affectedRatio,
      outlierCount: outliers.length
    };
  }

  console.error(`[PEAK DETECT] ${outliers.length} janelas outlier (severity=${severity})`);
  console.error(`[PEAK DETECT] Mediana: ${median.toFixed(1)} dBFS | Max outlier: ${maxOutlierPeak.toFixed(1)} dBFS (excesso: +${maxExcess.toFixed(1)} dB)`);
  outliers.forEach(w => {
    console.error(`[PEAK DETECT]   t=${w.timestamp.toFixed(2)}s peak=${w.peak_db.toFixed(1)} dBFS (+${(w.peak_db - median).toFixed(1)} dB acima da mediana)`);
  });

  return {
    hasOutliers: true,
    outliers,
    medianPeak: median,
    severity,
    totalAffectedMs,
    windows
  };
}

// ─── Correção Local ─────────────────────────────────────────────────────────

/**
 * Aplica gain reduction local nas regiões outlier com fade in/out.
 * Não altera o resto da música.
 *
 * @param {string}   filePath    Arquivo de entrada
 * @param {string}   outputPath  Arquivo de saída corrigido
 * @param {Array}    outliers    Lista de janelas outlier
 * @param {number}   medianPeak  Mediana dos picos (para calcular excesso)
 * @param {Function} execAsync
 * @returns {Promise<Array>}  Info de cada região corrigida
 */
async function applyLocalPeakCorrection(filePath, outputPath, outliers, medianPeak, execAsync) {
  if (!outliers || outliers.length === 0) {
    throw new Error('Nenhum outlier para corrigir');
  }

  const fadeSec = FADE_MS / 1000;
  const volumeFilters = [];
  const reductionLog = [];

  for (const region of outliers) {
    const excess      = region.peak_db - medianPeak;
    // Redução: suficiente para baixar o pico ao nível da mediana + 0.5dB de margem
    const rawReduction = Math.min(Math.max(excess - 0.5, MIN_GAIN_REDUCTION_DB), MAX_GAIN_REDUCTION_DB);
    const gainLinear   = Math.pow(10, -rawReduction / 20);

    const start = Math.max(0, region.timestamp);
    const end   = region.end;

    // Regiões muito curtas para fade — pular
    if (end - start < fadeSec * 2 + 0.005) {
      console.error(`[PEAK FIX] Região t=${start.toFixed(2)}-${end.toFixed(2)}s muito curta para fade — pulando`);
      continue;
    }

    const fadeInStart  = start;
    const fadeInEnd    = start + fadeSec;
    const holdEnd      = end - fadeSec;
    const fadeOutEnd   = end;

    // Expressão de volume com rampa linear de fade in/out
    const f  = fadeSec.toFixed(6);
    const t0 = fadeInStart.toFixed(6);
    const t1 = fadeInEnd.toFixed(6);
    const t2 = holdEnd.toFixed(6);
    const t3 = fadeOutEnd.toFixed(6);
    const g  = gainLinear.toFixed(6);

    const expr = `volume='if(between(t,${t0},${t1}),lerp(1,${g},(t-${t0})/${f}),` +
                 `if(between(t,${t1},${t2}),${g},` +
                 `if(between(t,${t2},${t3}),lerp(${g},1,(t-${t2})/${f}),1)))'`;

    volumeFilters.push(expr);
    reductionLog.push({ t_start: start, t_end: end, reduction_db: rawReduction });
    console.error(`[PEAK FIX] -${rawReduction.toFixed(1)} dB em t=${start.toFixed(2)}-${end.toFixed(2)}s`);
  }

  if (volumeFilters.length === 0) {
    throw new Error('Nenhum filtro gerado (regiões muito curtas)');
  }

  const filterChain = volumeFilters.join(',');
  const cmd = `ffmpeg -y -nostats -hide_banner -i "${filePath}" -af "${filterChain}" -c:a pcm_s24le "${outputPath}"`;

  try {
    await execAsync(cmd, { timeout: 180000 });
  } catch (e) {
    throw new Error(`FFmpeg falhou ao aplicar correção: ${e.message}`);
  }

  return reductionLog;
}

// ─── Orquestrador ───────────────────────────────────────────────────────────

/**
 * Verifica condições, detecta outliers, aplica correção se necessário,
 * reanalisame e retorna resultado.
 *
 * @param {string}   filePath         Arquivo de entrada original
 * @param {string}   tempOutputPath   Caminho para arquivo corrigido temporário
 * @param {Object}   metrics          Métricas do mini-analyzer
 * @param {Function} execAsync
 * @param {Function} analyzeWithBands Função de análise (para reanálise)
 * @returns {Promise<Object>}
 *   { applied, correctedPath?, newMetrics?, correctionInfo? }
 */
async function runPeakOutlierCorrection(filePath, tempOutputPath, metrics, execAsync, analyzeWithBands) {
  const headroom = Math.abs(metrics.truePeak);
  const lufs     = metrics.lufs;

  // ── Verificar condições de ativação ────────────────────────────────────────
  if (headroom >= ACTIVATION_HEADROOM_MAX) {
    console.error(`[PEAK FIX] Skip: headroom=${headroom.toFixed(2)} dB >= ${ACTIVATION_HEADROOM_MAX} (saudável)`);
    return { applied: false };
  }
  if (lufs >= ACTIVATION_LUFS_MAX) {
    console.error(`[PEAK FIX] Skip: LUFS=${lufs.toFixed(1)} >= ${ACTIVATION_LUFS_MAX} (muito alta para correção de outlier)`);
    return { applied: false };
  }

  console.error('');
  console.error('════════════════════════════════════════════════════════');
  console.error('🔍 PEAK OUTLIER DETECTION');
  console.error('════════════════════════════════════════════════════════');
  console.error(`   Headroom: ${headroom.toFixed(2)} dB < ${ACTIVATION_HEADROOM_MAX} | LUFS: ${lufs.toFixed(1)} < ${ACTIVATION_LUFS_MAX}`);
  console.error('   Analisando picos por janelas de 200ms...');

  // ── Detecção ───────────────────────────────────────────────────────────────
  const detection = await detectPeakOutliers(filePath, execAsync);

  if (!detection.hasOutliers) {
    console.error(`[PEAK FIX] Nenhum outlier: ${detection.reason || 'dinâmica normal'}`);
    console.error('════════════════════════════════════════════════════════');
    return { applied: false };
  }

  console.error(`[PEAK FIX] ✅ Outliers encontrados (severity=${detection.severity}) — aplicando correção local...`);

  // ── Correção ───────────────────────────────────────────────────────────────
  let reductionLog;
  try {
    reductionLog = await applyLocalPeakCorrection(
      filePath,
      tempOutputPath,
      detection.outliers,
      detection.medianPeak,
      execAsync
    );
  } catch (e) {
    console.error(`[PEAK FIX] Correção falhou: ${e.message} — continuando sem correção`);
    return { applied: false };
  }

  if (reductionLog.length === 0) {
    console.error('[PEAK FIX] Nenhuma região corrigida — continuando sem correção');
    return { applied: false };
  }

  // ── Reanálise ──────────────────────────────────────────────────────────────
  console.error('[PEAK FIX] Reanalisando áudio corrigido...');
  let newMetrics;
  try {
    newMetrics = await analyzeWithBands(tempOutputPath, execAsync);
  } catch (e) {
    console.error(`[PEAK FIX] Reanálise falhou: ${e.message} — descartando correção`);
    return { applied: false };
  }

  const newHeadroom = Math.abs(newMetrics.truePeak);
  const headroomGain = newHeadroom - headroom;

  console.error(`[PEAK FIX] Headroom: ${headroom.toFixed(2)} → ${newHeadroom.toFixed(2)} dB (+${headroomGain.toFixed(2)} dB)`);
  console.error(`[PEAK FIX] LUFS:     ${lufs.toFixed(2)} → ${newMetrics.lufs.toFixed(2)} LUFS`);

  // ── Guardrails pós-correção ────────────────────────────────────────────────
  if (headroomGain < 0.2) {
    console.error('[PEAK FIX] Headroom não melhorou significativamente (<0.2 dB) — descartando correção');
    return { applied: false };
  }

  if (newMetrics.lufs < lufs - 1.0) {
    console.error(`[PEAK FIX] LUFS caiu demais (${(lufs - newMetrics.lufs).toFixed(2)} LU > 1.0 LU) — descartando correção`);
    return { applied: false };
  }

  // ── Resultado bem-sucedido ─────────────────────────────────────────────────
  const avgReductionDb = reductionLog.reduce((s, r) => s + r.reduction_db, 0) / reductionLog.length;

  const correctionInfo = {
    peak_correction_applied:    true,
    peak_correction_amount_db:  parseFloat(avgReductionDb.toFixed(2)),
    peak_correction_regions:    reductionLog.length,
    affected_duration_ms:       detection.totalAffectedMs,
    peak_correction_severity:   detection.severity,
    peak_headroom_before:       parseFloat(headroom.toFixed(2)),
    peak_headroom_after:        parseFloat(newHeadroom.toFixed(2)),
    reason:                     'outlier peaks reducing headroom'
  };

  console.error(`[PEAK FIX] ✅ Sucesso: headroom ${headroom.toFixed(2)} → ${newHeadroom.toFixed(2)} dB | ${reductionLog.length} regiões corrigidas`);
  console.error('════════════════════════════════════════════════════════');

  return {
    applied:        true,
    correctedPath:  tempOutputPath,
    newMetrics,
    correctionInfo
  };
}

module.exports = { detectPeakOutliers, applyLocalPeakCorrection, runPeakOutlierCorrection };
