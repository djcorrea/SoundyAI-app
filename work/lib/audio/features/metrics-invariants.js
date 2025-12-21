/**
 * 🔍 VALIDAÇÃO DE INVARIANTES MATEMÁTICAS
 * Sistema de checks determinísticos para detectar inconsistências
 * 
 * USAGE:
 * import { validateMetricsInvariants } from './metrics-invariants.js';
 * const result = validateMetricsInvariants(coreMetrics, jobId);
 * if (!result.valid) console.error('Invariantes falharam!');
 */

import { logAudio } from '../error-handling.js';

export function validateMetricsInvariants(coreMetrics, jobId = 'unknown') {
  const warnings = [];
  const tolerance = 0.5; // dB
  
  console.log(`[INVARIANTS][${jobId}] 🔍 Validando invariantes matemáticas...`);
  
  // ========== CHECK 1: RMS Average <= RMS Peak ==========
  if (coreMetrics.rms?.average && coreMetrics.rms?.peak) {
    if (coreMetrics.rms.average > coreMetrics.rms.peak + tolerance) {
      warnings.push({
        check: 'RMS_CONSISTENCY',
        severity: 'CRITICAL',
        message: `RMS Average (${coreMetrics.rms.average.toFixed(2)} dB) > RMS Peak (${coreMetrics.rms.peak.toFixed(2)} dB)`,
        expected: `<= ${coreMetrics.rms.peak.toFixed(2)} dB`,
        actual: `${coreMetrics.rms.average.toFixed(2)} dB`,
        impact: 'Violação matemática: média não pode exceder pico'
      });
    } else {
      console.log(`[INVARIANTS][${jobId}] ✅ RMS Average <= RMS Peak OK`);
    }
  }
  
  // ========== CHECK 2: True Peak >= Sample Peak ==========
  if (coreMetrics.truePeak?.maxDbtp && coreMetrics.samplePeak?.maxDb) {
    const diff = coreMetrics.truePeak.maxDbtp - coreMetrics.samplePeak.maxDb;
    
    if (diff < -tolerance) {
      warnings.push({
        check: 'PEAK_CONSISTENCY',
        severity: 'CRITICAL',
        message: `True Peak (${coreMetrics.truePeak.maxDbtp.toFixed(2)} dBTP) < Sample Peak (${coreMetrics.samplePeak.maxDb.toFixed(2)} dBFS)`,
        expected: `>= ${(coreMetrics.samplePeak.maxDb - tolerance).toFixed(2)} dBTP`,
        actual: `${coreMetrics.truePeak.maxDbtp.toFixed(2)} dBTP`,
        impact: 'Violação da definição matemática de True Peak (intersample deve >= sample)'
      });
    } else if (diff > 2.0) {
      warnings.push({
        check: 'PEAK_CONSISTENCY',
        severity: 'WARNING',
        message: `True Peak muito acima de Sample Peak (+${diff.toFixed(2)} dB)`,
        expected: `${coreMetrics.samplePeak.maxDb.toFixed(2)} a ${(coreMetrics.samplePeak.maxDb + 2.0).toFixed(2)} dBTP`,
        actual: `${coreMetrics.truePeak.maxDbtp.toFixed(2)} dBTP`,
        impact: 'Diferença anormalmente alta'
      });
    } else {
      console.log(`[INVARIANTS][${jobId}] ✅ True Peak >= Sample Peak OK (diff=+${diff.toFixed(2)} dB)`);
    }
  } else if (coreMetrics.samplePeak) {
    console.log(`[INVARIANTS][${jobId}] ℹ️ CHECK 2 parcial: Sample Peak existe mas True Peak ausente`);
  }
  
  // ========== CHECK 3: Dynamic Range >= 0 ==========
  if (coreMetrics.dynamics?.dynamicRange !== undefined) {
    const dr = coreMetrics.dynamics.dynamicRange;
    
    if (dr < 0) {
      warnings.push({
        check: 'DR_RANGE',
        severity: 'CRITICAL',
        message: `Dynamic Range negativo: ${dr.toFixed(2)} dB`,
        expected: `>= 0 dB`,
        actual: `${dr.toFixed(2)} dB`,
        impact: 'DR não pode ser negativo por definição (peak >= average)'
      });
    } else if (dr > 30) {
      warnings.push({
        check: 'DR_RANGE',
        severity: 'WARNING',
        message: `Dynamic Range muito alto: ${dr.toFixed(2)} dB`,
        expected: `< 30 dB (típico para música)`,
        actual: `${dr.toFixed(2)} dB`,
        impact: 'Valor incomum, pode indicar erro ou áudio especial'
      });
    } else {
      console.log(`[INVARIANTS][${jobId}] ✅ Dynamic Range dentro do range OK (${dr.toFixed(2)} dB)`);
    }
  }
  
  // ========== CHECK 4: LRA = 0.0 com LUFS normal ==========
  if (coreMetrics.loudness?.range !== undefined && coreMetrics.loudness?.integrated) {
    const lra = coreMetrics.loudness.range;
    const lufs = coreMetrics.loudness.integrated;
    
    if (lra === 0.0 && lufs > -50) {
      warnings.push({
        check: 'LRA_ZERO',
        severity: 'INFO',
        message: `LRA = 0.0 LU mas LUFS = ${lufs.toFixed(1)} LUFS (áudio não-silencioso)`,
        expected: `> 0.1 LU para áudio dinâmico`,
        actual: `0.0 LU`,
        impact: 'Sugere compressão extrema, limiter severo ou possível erro'
      });
    } else {
      console.log(`[INVARIANTS][${jobId}] ✅ LRA OK (${lra.toFixed(2)} LU)`);
    }
  }
  
  // ========== RESUMO ==========
  const critical = warnings.filter(w => w.severity === 'CRITICAL');
  const warning = warnings.filter(w => w.severity === 'WARNING');
  const info = warnings.filter(w => w.severity === 'INFO');
  
  console.log(`[INVARIANTS][${jobId}] ========== RESUMO ==========`);
  console.log(`[INVARIANTS][${jobId}] CRITICAL: ${critical.length}`);
  console.log(`[INVARIANTS][${jobId}] WARNING: ${warning.length}`);
  console.log(`[INVARIANTS][${jobId}] INFO: ${info.length}`);
  console.log(`[INVARIANTS][${jobId}] ============================`);
  
  if (critical.length > 0) {
    console.error(`[INVARIANTS][${jobId}] ❌ Falhas críticas detectadas!`);
    critical.forEach(w => console.error(`[INVARIANTS][${jobId}] [CRITICAL] ${w.check}: ${w.message}`));
  }
  
  return {
    valid: critical.length === 0,
    warnings,
    summary: {
      totalChecks: 4,
      critical: critical.length,
      warning: warning.length,
      info: info.length
    }
  };
}
