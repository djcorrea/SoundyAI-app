// 🔐 INVARIANTS VALIDATOR (Audit Mode)
// Verifica relações e sanidade entre métricas sem quebrar fluxo legado.
// Retorna lista de warnings + flags booleans. Só ativa em AUDIT_MODE.

function isFiniteNumber(v){ return typeof v === 'number' && Number.isFinite(v); }

export function validateInvariants(metrics = {}) {
  const AUDIT_MODE = (typeof process !== 'undefined' && process.env.AUDIT_MODE === '1') || (typeof window !== 'undefined' && window.AUDIT_MODE === true);
  if (!AUDIT_MODE) return { active:false, warnings:[], flags:{} };
  const warnings = [];
  const flags = {};

  // 1. True Peak vs Sample Peak headroom
  if (isFiniteNumber(metrics.truePeakDbtp) && isFiniteNumber(metrics.samplePeakLeftDb) && isFiniteNumber(metrics.samplePeakRightDb)) {
    const samplePeakDb = Math.max(metrics.samplePeakLeftDb, metrics.samplePeakRightDb);
    if (samplePeakDb < metrics.truePeakDbtp - 0.1) {
      warnings.push('True Peak reportado menor que sample peak esperado (inconsistência possível).');
      flags.truePeakBelowSample = true;
    }
  }

  // 2. LUFS plausibility
  if (isFiniteNumber(metrics.lufsIntegrated)) {
    if (metrics.lufsIntegrated > -1 || metrics.lufsIntegrated < -60) {
      warnings.push('LUFS integrado fora de faixa plausível (-60..-1).');
      flags.lufsOutOfRange = true;
    }
  }

  // 3. DR vs Crest: se ambos presentes e divergência exagerada
  if (isFiniteNumber(metrics.crestFactor) && isFiniteNumber(metrics.dr_stat)) {
    if (metrics.dr_stat > metrics.crestFactor + 6) {
      warnings.push('dr_stat muito acima do crestFactor (verificar janelas).');
      flags.drStatCrestMismatch = true;
    }
  }

  // 4. THD plausibility
  if (isFiniteNumber(metrics.thdPercent) && metrics.thdPercent < 0) {
    warnings.push('THD negativo (inconsistência).');
    flags.thdNegative = true;
  }

  // 5. Headroom: truePeak deve estar <= 0dBTP e preferencialmente <= -1dBTP
  if (isFiniteNumber(metrics.truePeakDbtp)) {
    if (metrics.truePeakDbtp > 0) { warnings.push('True Peak > 0 dBTP (clipping potencial).'); flags.truePeakOverZero = true; }
    if (metrics.truePeakDbtp > -1 && metrics.truePeakDbtp <= 0) { flags.truePeakNearLimit = true; }
  }

  // 6. DC offset por canal
  if (isFiniteNumber(metrics.dcOffsetLeft) || isFiniteNumber(metrics.dcOffsetRight)) {
    const thr = 0.02;
    if (Math.abs(metrics.dcOffsetLeft||0) > thr || Math.abs(metrics.dcOffsetRight||0) > thr) {
      warnings.push('DC offset elevado (>2%).');
      flags.dcOffsetHigh = true;
    }
  }

  // 7. Bandas OUT ratio (se bandNorm presente)
  if (metrics.bandNorm && metrics.bandNorm.bands) {
    const bands = Object.values(metrics.bandNorm.bands);
    const withTarget = bands.filter(b => b && b.status && b.status !== 'NA' && b.status !== 'MISSING');
    const outCount = withTarget.filter(b => b.status === 'OUT').length;
    if (withTarget.length >= 4) {
      const ratio = outCount / withTarget.length;
      if (ratio > 0.5) { warnings.push('Mais de 50% das bandas fora do alvo.'); flags.tooManyBandsOut = true; }
      else if (ratio > 0.3) { flags.bandOutModerate = true; }
    }
  }

  // 8. Clipping lógica: clippingSamples >0 mas truePeak <= -3 pode indicar false positive
  if (isFiniteNumber(metrics.clippingSamples) && metrics.clippingSamples > 0 && isFiniteNumber(metrics.truePeakDbtp) && metrics.truePeakDbtp <= -3) {
    warnings.push('Clipping samples detectados mas true peak baixo (verificar threshold).');
    flags.clippingInconsistent = true;
  }

  // 9. LRA plausibility vs dr_stat
  if (isFiniteNumber(metrics.lra) && isFiniteNumber(metrics.dr_stat)) {
    if (metrics.lra > metrics.dr_stat + 10) { warnings.push('LRA muito acima de dr_stat (possível cálculo inconsistente).'); flags.lraDrMismatch = true; }
  }

  // 10. NaN/Infinity guard
  for (const [k,v] of Object.entries(metrics)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      warnings.push(`Valor não finito em ${k}`);
      flags.nonFinite = true;
      break;
    }
  }

  return { active:true, warnings, flags };
}

export default { validateInvariants };
