// ✅ PARITY VERIFICATION - Validar que otimizações mantêm precisão das métricas
// Compara resultados baseline vs otimizado e verifica tolerâncias rígidas

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 📏 Tolerâncias definidas (limites máximos de variação aceitável)
 */
const TOLERANCES = {
  // LUFS ITU-R BS.1770-4
  lufsIntegrated: 0.10,        // ±0.10 LU
  lufsShortTerm: 0.15,         // ±0.15 LU (menos crítico)
  lufsMomentary: 0.20,         // ±0.20 LU (menos crítico)
  lra: 0.20,                   // ±0.20 LU
  
  // True Peak ITU-R BS.1770-4
  truePeakDbtp: 0.10,          // ±0.10 dBTP
  
  // Dinâmica
  rms: 0.20,                   // ±0.20 dB
  dynamicRange: 0.20,          // ±0.20 dB (DR)
  crestFactor: 0.20,           // ±0.20 dB
  
  // Estéreo
  correlation: 0.02,           // ±0.02 (range -1 a +1)
  stereoWidth: 0.05,           // ±0.05
  
  // Bandas Espectrais (porcentagem)
  spectralBandPp: 0.5,         // ±0.5 pontos percentuais por banda
  
  // BPM
  bpm: 0.5,                    // ±0.5 BPM
  
  // Métricas espectrais (Hz e valores normalizados)
  spectralCentroidHz: 50,      // ±50 Hz
  spectralRolloffHz: 100,      // ±100 Hz
  spectralFlatness: 0.05,      // ±0.05
  spectralCrest: 0.5           // ±0.5 dB
};

/**
 * 📊 Carregar resultados de um experimento
 */
async function loadExperimentResults(resultsPath) {
  const resultsFile = await fs.readFile(resultsPath, 'utf-8');
  const results = JSON.parse(resultsFile);
  return results;
}

/**
 * 📐 Verificar métrica individual
 */
function verifyMetric(name, baseline, optimized, tolerance) {
  // Tratar valores null/undefined
  if (baseline === null || baseline === undefined) {
    return {
      metric: name,
      baseline: null,
      optimized,
      tolerance,
      diff: null,
      diffPercent: null,
      withinTolerance: optimized === null || optimized === undefined,
      status: (optimized === null || optimized === undefined) ? 'BOTH_NULL' : 'BASELINE_NULL'
    };
  }
  
  if (optimized === null || optimized === undefined) {
    return {
      metric: name,
      baseline,
      optimized: null,
      tolerance,
      diff: null,
      diffPercent: null,
      withinTolerance: false,
      status: 'OPTIMIZED_NULL'
    };
  }
  
  const diff = Math.abs(optimized - baseline);
  const diffPercent = baseline !== 0 ? (diff / Math.abs(baseline)) * 100 : 0;
  const withinTolerance = diff <= tolerance;
  
  return {
    metric: name,
    baseline: parseFloat(baseline.toFixed(6)),
    optimized: parseFloat(optimized.toFixed(6)),
    tolerance,
    diff: parseFloat(diff.toFixed(6)),
    diffPercent: parseFloat(diffPercent.toFixed(2)),
    withinTolerance,
    status: withinTolerance ? 'PASS' : 'FAIL'
  };
}

/**
 * 🧪 Comparar resultados completos
 */
function compareResults(baseline, optimized) {
  const comparisons = [];
  
  // LUFS
  comparisons.push(verifyMetric(
    'LUFS Integrated',
    baseline.lufs?.integrated,
    optimized.lufs?.integrated,
    TOLERANCES.lufsIntegrated
  ));
  
  comparisons.push(verifyMetric(
    'LUFS Short-Term',
    baseline.lufs?.shortTerm,
    optimized.lufs?.shortTerm,
    TOLERANCES.lufsShortTerm
  ));
  
  comparisons.push(verifyMetric(
    'LRA',
    baseline.lufs?.lra,
    optimized.lufs?.lra,
    TOLERANCES.lra
  ));
  
  // True Peak
  comparisons.push(verifyMetric(
    'True Peak dBTP',
    baseline.truePeak?.maxDbtp,
    optimized.truePeak?.maxDbtp,
    TOLERANCES.truePeakDbtp
  ));
  
  // RMS
  comparisons.push(verifyMetric(
    'RMS Average',
    baseline.rms?.average,
    optimized.rms?.average,
    TOLERANCES.rms
  ));
  
  // Dinâmica
  comparisons.push(verifyMetric(
    'Dynamic Range',
    baseline.dynamics?.dynamicRange,
    optimized.dynamics?.dynamicRange,
    TOLERANCES.dynamicRange
  ));
  
  comparisons.push(verifyMetric(
    'Crest Factor',
    baseline.dynamics?.crestFactor,
    optimized.dynamics?.crestFactor,
    TOLERANCES.crestFactor
  ));
  
  // Estéreo
  comparisons.push(verifyMetric(
    'Stereo Correlation',
    baseline.stereo?.correlation,
    optimized.stereo?.correlation,
    TOLERANCES.correlation
  ));
  
  comparisons.push(verifyMetric(
    'Stereo Width',
    baseline.stereo?.width,
    optimized.stereo?.width,
    TOLERANCES.stereoWidth
  ));
  
  // BPM - DISABLED (removed for performance optimization)
  // comparisons.push(verifyMetric(
  //   'BPM',
  //   baseline.bpm,
  //   optimized.bpm,
  //   TOLERANCES.bpm
  // ));
  
  // Bandas Espectrais (7 bandas)
  if (baseline.spectralBands?.bands && optimized.spectralBands?.bands) {
    const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'];
    for (const band of bands) {
      comparisons.push(verifyMetric(
        `Spectral Band: ${band}`,
        baseline.spectralBands.bands[band]?.percentage,
        optimized.spectralBands.bands[band]?.percentage,
        TOLERANCES.spectralBandPp
      ));
    }
  }
  
  // Métricas espectrais agregadas
  comparisons.push(verifyMetric(
    'Spectral Centroid (Hz)',
    baseline.fft?.spectralCentroidHz,
    optimized.fft?.spectralCentroidHz,
    TOLERANCES.spectralCentroidHz
  ));
  
  comparisons.push(verifyMetric(
    'Spectral Rolloff (Hz)',
    baseline.fft?.spectralRolloffHz,
    optimized.fft?.spectralRolloffHz,
    TOLERANCES.spectralRolloffHz
  ));
  
  comparisons.push(verifyMetric(
    'Spectral Flatness',
    baseline.fft?.spectralFlatness,
    optimized.fft?.spectralFlatness,
    TOLERANCES.spectralFlatness
  ));
  
  return comparisons;
}

/**
 * 📊 Gerar relatório de paridade
 */
function generateParityReport(comparisons, baselineExp, optimizedExp) {
  const passed = comparisons.filter(c => c.status === 'PASS' || c.status === 'BOTH_NULL');
  const failed = comparisons.filter(c => c.status === 'FAIL');
  const warnings = comparisons.filter(c => c.status === 'BASELINE_NULL' || c.status === 'OPTIMIZED_NULL');
  
  const passRate = (passed.length / comparisons.length) * 100;
  
  let report = `# ✅ RELATÓRIO DE PARIDADE DE MÉTRICAS\n\n`;
  report += `**Data:** ${new Date().toISOString()}\n\n`;
  report += `**Baseline:** ${baselineExp}\n`;
  report += `**Otimizado:** ${optimizedExp}\n\n`;
  
  report += `## 📊 Resumo\n\n`;
  report += `- **Total de métricas:** ${comparisons.length}\n`;
  report += `- **✅ Passou:** ${passed.length} (${passRate.toFixed(1)}%)\n`;
  report += `- **❌ Falhou:** ${failed.length}\n`;
  report += `- **⚠️ Avisos:** ${warnings.length}\n\n`;
  
  if (failed.length === 0 && warnings.length === 0) {
    report += `## 🎉 RESULTADO: PASS\n\n`;
    report += `Todas as métricas estão dentro das tolerâncias definidas!\n\n`;
  } else if (failed.length > 0) {
    report += `## ❌ RESULTADO: FAIL\n\n`;
    report += `Algumas métricas excederam as tolerâncias. Revise as otimizações.\n\n`;
  } else {
    report += `## ⚠️ RESULTADO: WARNINGS\n\n`;
    report += `Algumas métricas têm valores null. Verifique se isso é esperado.\n\n`;
  }
  
  // Métricas que falharam
  if (failed.length > 0) {
    report += `## ❌ Métricas que Falharam\n\n`;
    report += `| Métrica | Baseline | Otimizado | Diff | Diff% | Tolerância | Status |\n`;
    report += `|---------|---------|-----------|------|-------|------------|--------|\n`;
    
    for (const c of failed) {
      report += `| ${c.metric} | ${c.baseline} | ${c.optimized} | ${c.diff} | ${c.diffPercent}% | ±${c.tolerance} | ❌ FAIL |\n`;
    }
    report += `\n`;
  }
  
  // Métricas que passaram
  report += `## ✅ Métricas que Passaram\n\n`;
  report += `| Métrica | Baseline | Otimizado | Diff | Diff% | Tolerância | Status |\n`;
  report += `|---------|---------|-----------|------|-------|------------|--------|\n`;
  
  for (const c of passed) {
    if (c.status === 'BOTH_NULL') {
      report += `| ${c.metric} | null | null | - | - | ±${c.tolerance} | ✅ PASS (both null) |\n`;
    } else {
      report += `| ${c.metric} | ${c.baseline} | ${c.optimized} | ${c.diff} | ${c.diffPercent}% | ±${c.tolerance} | ✅ PASS |\n`;
    }
  }
  report += `\n`;
  
  // Avisos
  if (warnings.length > 0) {
    report += `## ⚠️ Avisos\n\n`;
    report += `| Métrica | Baseline | Otimizado | Status |\n`;
    report += `|---------|---------|-----------|--------|\n`;
    
    for (const c of warnings) {
      report += `| ${c.metric} | ${c.baseline || 'null'} | ${c.optimized || 'null'} | ⚠️ ${c.status} |\n`;
    }
    report += `\n`;
  }
  
  return report;
}

/**
 * 🚀 Main
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Uso: node verify-parity.js <baseline-results.json> <optimized-results.json>');
    console.log('');
    console.log('Exemplo:');
    console.log('  node verify-parity.js results/baseline/results.json results/bands-impl-opt/results.json');
    process.exit(1);
  }
  
  const baselinePath = path.resolve(__dirname, args[0]);
  const optimizedPath = path.resolve(__dirname, args[1]);
  
  console.log('[PARITY] 🔬 Verificação de Paridade de Métricas');
  console.log(`[PARITY] Baseline: ${baselinePath}`);
  console.log(`[PARITY] Otimizado: ${optimizedPath}`);
  
  // Carregar resultados
  const baselineResults = await loadExperimentResults(baselinePath);
  const optimizedResults = await loadExperimentResults(optimizedPath);
  
  console.log(`[PARITY] Baseline: ${baselineResults.experiments.length} experimentos`);
  console.log(`[PARITY] Otimizado: ${optimizedResults.experiments.length} experimentos`);
  
  // Comparar primeiro run bem-sucedido de cada experimento
  const allComparisons = [];
  
  for (let i = 0; i < baselineResults.experiments.length; i++) {
    const baselineExp = baselineResults.experiments[i];
    const optimizedExp = optimizedResults.experiments[i];
    
    if (!baselineExp || !optimizedExp) {
      console.warn(`[PARITY] ⚠️ Experimento ${i} ausente em um dos arquivos`);
      continue;
    }
    
    console.log(`\n[PARITY] Comparando: ${baselineExp.experimentName} vs ${optimizedExp.experimentName}`);
    
    const baselineRun = baselineExp.runs.find(r => r.success);
    const optimizedRun = optimizedExp.runs.find(r => r.success);
    
    if (!baselineRun || !optimizedRun) {
      console.warn(`[PARITY] ⚠️ Nenhum run bem-sucedido encontrado`);
      continue;
    }
    
    const comparisons = compareResults(baselineRun.result, optimizedRun.result);
    
    const passed = comparisons.filter(c => c.status === 'PASS' || c.status === 'BOTH_NULL').length;
    const failed = comparisons.filter(c => c.status === 'FAIL').length;
    
    console.log(`[PARITY] ✅ Passou: ${passed}/${comparisons.length}`);
    console.log(`[PARITY] ❌ Falhou: ${failed}/${comparisons.length}`);
    
    allComparisons.push({
      baselineExp: baselineExp.experimentName,
      optimizedExp: optimizedExp.experimentName,
      comparisons
    });
  }
  
  // Gerar relatório consolidado
  console.log(`\n[PARITY] Gerando relatório consolidado...`);
  
  let consolidatedReport = `# ✅ RELATÓRIO CONSOLIDADO DE PARIDADE\n\n`;
  consolidatedReport += `**Data:** ${new Date().toISOString()}\n\n`;
  consolidatedReport += `**Comparações:** ${allComparisons.length}\n\n`;
  
  for (const comp of allComparisons) {
    const report = generateParityReport(comp.comparisons, comp.baselineExp, comp.optimizedExp);
    consolidatedReport += `\n---\n\n${report}`;
  }
  
  // Salvar relatório
  const outputDir = path.join(__dirname, 'results', 'parity-reports');
  await fs.mkdir(outputDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const reportPath = path.join(outputDir, `parity-report-${timestamp}.md`);
  
  await fs.writeFile(reportPath, consolidatedReport);
  
  console.log(`\n[PARITY] ========================================`);
  console.log(`[PARITY] ✅ Relatório salvo: ${reportPath}`);
  console.log(`[PARITY] ========================================`);
  
  // Determinar resultado final
  const totalFailed = allComparisons.reduce((sum, comp) => {
    return sum + comp.comparisons.filter(c => c.status === 'FAIL').length;
  }, 0);
  
  if (totalFailed > 0) {
    console.log(`[PARITY] ❌ FAIL: ${totalFailed} métricas fora da tolerância`);
    process.exit(1);
  } else {
    console.log(`[PARITY] ✅ PASS: Todas as métricas dentro da tolerância`);
    process.exit(0);
  }
}

// Executar
main().catch(error => {
  console.error('[PARITY] ❌ Erro fatal:', error);
  process.exit(1);
});
