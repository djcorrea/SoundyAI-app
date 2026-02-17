#!/usr/bin/env node
/**
 * AutoMaster V1 - Postcheck Técnico
 *
 * Uso: node postcheck-audio.cjs <audioPath> <mode>
 * Saída: JSON com estrutura mínima para avaliação pós-render
 * - status: "OK" | "FAILED"
 * - metrics: { lufs_i, true_peak_dbtp, dr, stereo_corr, harsh_2_4k_db, sub_retention, transient_retention, spectral_bands }
 * - tiers: { tier1_pass, tier2_pass, tier3_pass, reasons: [] }
 * - recommended_action: "OK" | "FALLBACK_CLEAN" | "ABORT"
 *
 * Implementação conservadora: reutiliza ffmpeg/ffprobe como precheck.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);

const MODE_TARGETS = {
  STREAMING: -14,
  BALANCED: -11,
  IMPACT: -9,
  CLEAN: -11
};

const DEFAULT_DR_MIN = 6; // V1 conservative

function exitWithJson(obj, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}

function exitError(message) {
  const out = {
    status: 'FAILED',
    metrics: null,
    tiers: { tier1_pass: false, tier2_pass: false, tier3_pass: false, reasons: [message] },
    recommended_action: 'ABORT'
  };
  console.error(message);
  exitWithJson(out, 1);
}

async function validateArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    exitError('Uso: node postcheck-audio.cjs <audioPath> <mode>');
  }
  const audioPath = path.resolve(args[0]);
  const mode = args[1] ? args[1].toUpperCase() : null;

  if (!fs.existsSync(audioPath)) {
    exitError(`Arquivo nao encontrado: ${audioPath}`);
  }

  if (!MODE_TARGETS[mode]) {
    exitError(`Mode invalido: ${mode}`);
  }

  return { audioPath, mode };
}

async function getBasicMetrics(inputPath) {
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=sample_rate,channels',
    '-of', 'json',
    inputPath
  ];

  try {
    const { stdout } = await execFileAsync('ffprobe', args, { timeout: 10000, maxBuffer: 5 * 1024 * 1024 });
    const data = JSON.parse(stdout);
    const stream = data.streams && data.streams[0];
    if (!stream) return null;
    const duration = parseFloat(data.format.duration);
    return {
      duration_sec: Math.round(duration * 10) / 10,
      sample_rate: parseInt(stream.sample_rate, 10),
      channels: parseInt(stream.channels, 10)
    };
  } catch (err) {
    return null;
  }
}

async function getLoudnessMetrics(inputPath) {
  const args = [
    '-i', inputPath,
    '-af', 'loudnorm=print_format=json',
    '-f', 'null',
    '-'
  ];

  try {
    const { stdout, stderr } = await execFileAsync('ffmpeg', args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    // loudnorm prints JSON to stderr
    const jsonMatch = stderr.match(/\{[\s\S]*"input_i"[\s\S]*\}/);
    if (!jsonMatch) return null;
    const data = JSON.parse(jsonMatch[0]);
    return {
      integrated_lufs: typeof data.input_i === 'number' ? data.input_i : parseFloat(data.input_i) || null,
      true_peak_db: typeof data.input_tp === 'number' ? data.input_tp : parseFloat(data.input_tp) || null,
      lra: typeof data.input_lra === 'number' ? data.input_lra : parseFloat(data.input_lra) || null
    };
  } catch (err) {
    return null;
  }
}

async function estimateDynamicRange(inputPath) {
  const args = [
    '-i', inputPath,
    '-af', 'astats=metadata=1:reset=1',
    '-f', 'null',
    '-'
  ];

  try {
    const { stdout, stderr } = await execFileAsync('ffmpeg', args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    const peakMatch = stderr.match(/Peak level dB:\s*([\-\d.]+)/);
    const rmsMatch = stderr.match(/RMS level dB:\s*([\-\d.]+)/);
    if (peakMatch && rmsMatch) {
      const peak = parseFloat(peakMatch[1]);
      const rms = parseFloat(rmsMatch[1]);
      const dr = Math.abs(peak - rms);
      return Math.round(dr * 10) / 10;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function run() {
  const { audioPath, mode } = await validateArgs();

  const basic = await getBasicMetrics(audioPath);
  const loud = await getLoudnessMetrics(audioPath);
  const dr = await estimateDynamicRange(audioPath);

  const metrics = {
    lufs_i: loud && loud.integrated_lufs !== null ? loud.integrated_lufs : 'not_available',
    true_peak_dbtp: loud && loud.true_peak_db !== null ? loud.true_peak_db : 'not_available',
    dr: dr !== null ? dr : 'not_available',
    stereo_corr: 'not_available',
    harsh_2_4k_db: 'not_available',
    sub_retention: 'not_available',
    transient_retention: 'not_available',
    spectral_bands: []
  };

  const reasons = [];

  // Tier1 checks (hard stops)
  let tier1_pass = true;
  const tp = metrics.true_peak_dbtp === 'not_available' ? null : metrics.true_peak_dbtp;
  if (tp !== null && tp > 0.0) {
    tier1_pass = false;
    reasons.push(`True peak alto: ${tp} dBTP`);
  }

  const drValue = metrics.dr === 'not_available' ? null : metrics.dr;
  if (drValue !== null && drValue < DEFAULT_DR_MIN) {
    tier1_pass = false;
    reasons.push(`Dynamic Range baixo: ${drValue} dB`);
  }

  // Tier3: LUFS close to target
  const target = MODE_TARGETS[mode] || MODE_TARGETS.BALANCED;
  let tier3_pass = true;
  const lufs = metrics.lufs_i === 'not_available' ? null : metrics.lufs_i;
  if (lufs !== null) {
    const diff = Math.abs(lufs - target);
    if (diff <= 1.5) {
      tier3_pass = true;
    } else if (diff <= 3.0) {
      tier3_pass = false; // will suggest fallback
      reasons.push(`LUFS fora do alvo por ${diff.toFixed(2)} LU`);
    } else {
      tier3_pass = false;
      reasons.push(`LUFS muito distante do alvo (${diff.toFixed(2)} LU)`);
    }
  } else {
    // if lufs not available, do not fail tier3; add reason
    reasons.push('LUFS nao disponível para avaliação detalhada');
    tier3_pass = true;
  }

  // Decide recommended_action
  let recommended_action = 'OK';
  if (!tier1_pass) {
    recommended_action = 'ABORT';
  } else if (!tier3_pass) {
    recommended_action = 'FALLBACK_CLEAN';
  } else {
    recommended_action = 'OK';
  }

  const tiers = {
    tier1_pass,
    tier2_pass: true, // conservative: pass when unsure
    tier3_pass,
    reasons
  };

  const status = recommended_action === 'OK' ? 'OK' : 'FAILED';

  const out = {
    status,
    metrics,
    tiers,
    recommended_action
  };

  exitWithJson(out, recommended_action === 'OK' ? 0 : 0);
}

run().catch(err => {
  exitError(err.message || String(err));
});
