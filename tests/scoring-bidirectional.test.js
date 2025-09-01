// Testes simples (manual) para validar scoreTolerance bidirecional
import { computeMixScore } from '../lib/audio/features/scoring.js';

function runCase(name, value, target, tolMin, tolMax){
  const ref = { lufs_target: target, tol_lufs_min: tolMin, tol_lufs_max: tolMax };
  const technical = { lufsIntegrated: value };
  const res = computeMixScore(technical, ref);
  const metric = res.perMetric.find(m=>m.key==='lufsIntegrated');
  console.log(name, { value, target, tolMin, tolMax, status: metric.status, severity: metric.severity, scorePct: metric.scorePct });
  return metric;
}

runCase('OK_center', -14, -14, 1, 1);
runCase('LOW_edge', -15.2, -14, 1, 1);
runCase('HIGH_edge', -12.7, -14, 1, 1);
runCase('HIGH_severe', -9, -14, 1, 1);

// Band test
const ref2 = { bands: { high_mid: { target_db: -10, tol_min: 2, tol_max: 3 } } };
const technical2 = { bandEnergies: { high_mid: { rms_db: -4 } } };
const res2 = computeMixScore(technical2, ref2);
const m2 = res2.perMetric.find(m=>m.key==='band_high_mid');
console.log('Band high_mid', { status: m2.status, severity: m2.severity, diff: m2.diff });
