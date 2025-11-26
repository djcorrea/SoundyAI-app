// 🔬 PERFORMANCE BENCHMARK RUNNER
// Executa pipeline completo com instrumentação detalhada e gera relatórios

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { processAudioComplete } from '../../api/audio/pipeline-complete.js';
import {
  configureInstrumentation,
  withPhase,
  getMeasurements,
  getAggregatedStats,
  generateSummaryReport,
  clearMeasurements,
  resetInstrumentation
} from './instrumentation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 📊 Carregar configuração de benchmark
 */
async function loadBenchConfig(configPath) {
  const configFile = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(configFile);
}

/**
 * 🎵 Carregar arquivo de áudio
 */
async function loadAudioFile(filePath) {
  const absolutePath = path.resolve(__dirname, filePath);
  console.log(`[RUNNER] Carregando áudio: ${absolutePath}`);
  
  const buffer = await fs.readFile(absolutePath);
  const fileName = path.basename(filePath);
  
  return { buffer, fileName };
}

/**
 * 🗑️ Forçar garbage collection (se disponível)
 */
function forceGC() {
  if (global.gc) {
    console.log('[RUNNER] Forçando GC...');
    global.gc();
  } else {
    console.warn('[RUNNER] GC não disponível (use --expose-gc)');
  }
}

/**
 * 🔄 Executar uma análise completa
 */
async function runSingleAnalysis(audioBuffer, fileName, flags, jobId) {
  console.log(`\n[RUNNER] === Iniciando análise: ${jobId} ===`);
  console.log(`[RUNNER] Arquivo: ${fileName}`);
  console.log(`[RUNNER] Flags:`, flags);
  
  // Configurar instrumentação
  configureInstrumentation({ enabled: true, jobId });
  
  const startTime = process.hrtime.bigint();
  
  try {
    // Executar pipeline completo com fases instrumentadas
    const result = await withPhase('PIPELINE_COMPLETE', async () => {
      return await processAudioComplete(audioBuffer, fileName, {
        jobId,
        ...flags
      });
    });
    
    const endTime = process.hrtime.bigint();
    const totalMs = Number(endTime - startTime) / 1_000_000;
    
    console.log(`[RUNNER] ✅ Análise completa em ${totalMs.toFixed(2)}ms`);
    
    // Coletar medições
    const measurements = getMeasurements();
    const aggregatedStats = getAggregatedStats();
    const summary = generateSummaryReport();
    
    return {
      success: true,
      jobId,
      fileName,
      flags,
      totalMs,
      result,
      measurements,
      aggregatedStats,
      summary
    };
    
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const totalMs = Number(endTime - startTime) / 1_000_000;
    
    console.error(`[RUNNER] ❌ Erro na análise: ${error.message}`);
    
    return {
      success: false,
      jobId,
      fileName,
      flags,
      totalMs,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * 🧪 Executar experimento (múltiplas repetições)
 */
async function runExperiment(experimentName, experimentConfig, testFile, audioData, benchConfig) {
  console.log(`\n[RUNNER] ========================================`);
  console.log(`[RUNNER] EXPERIMENTO: ${experimentName}`);
  console.log(`[RUNNER] ${experimentConfig.description}`);
  console.log(`[RUNNER] ========================================`);
  
  const runs = [];
  const repetitions = benchConfig.benchmarkConfig.repetitions;
  const warmup = benchConfig.benchmarkConfig.enableWarmup ? benchConfig.benchmarkConfig.warmupRuns : 0;
  
  // Merge flags
  const flags = { ...benchConfig.pipelineFlags, ...experimentConfig.flags };
  
  // Warmup runs
  for (let i = 0; i < warmup; i++) {
    console.log(`\n[RUNNER] --- Warmup ${i + 1}/${warmup} ---`);
    const jobId = `warmup-${experimentName}-${i + 1}`;
    
    await runSingleAnalysis(audioData.buffer, audioData.fileName, flags, jobId);
    
    // Limpar medições de warmup
    clearMeasurements();
    
    if (benchConfig.benchmarkConfig.gcBetweenRuns) {
      forceGC();
    }
  }
  
  // Actual runs
  for (let i = 0; i < repetitions; i++) {
    console.log(`\n[RUNNER] --- Run ${i + 1}/${repetitions} ---`);
    const jobId = `${experimentName}-${testFile}-run${i + 1}`;
    
    // Reset instrumentation entre runs
    resetInstrumentation();
    
    const runResult = await runSingleAnalysis(audioData.buffer, audioData.fileName, flags, jobId);
    runs.push(runResult);
    
    if (benchConfig.benchmarkConfig.gcBetweenRuns) {
      forceGC();
    }
    
    // Pequena pausa entre runs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Calcular estatísticas do experimento
  const successfulRuns = runs.filter(r => r.success);
  const totalTimes = successfulRuns.map(r => r.totalMs);
  
  const stats = calculateRunStats(totalTimes);
  
  console.log(`\n[RUNNER] Experimento "${experimentName}" completo:`);
  console.log(`[RUNNER] Runs bem-sucedidos: ${successfulRuns.length}/${runs.length}`);
  console.log(`[RUNNER] Tempo médio: ${stats.mean.toFixed(2)}ms`);
  console.log(`[RUNNER] P95: ${stats.p95.toFixed(2)}ms, P99: ${stats.p99.toFixed(2)}ms`);
  
  return {
    experimentName,
    experimentConfig,
    testFile,
    runs,
    stats,
    timestamp: new Date().toISOString()
  };
}

/**
 * 📈 Calcular estatísticas de runs
 */
function calculateRunStats(values) {
  if (values.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, stddev: 0, p95: 0, p99: 0, count: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  const p99Index = Math.ceil(sorted.length * 0.99) - 1;
  const p95 = sorted[Math.min(p95Index, sorted.length - 1)];
  const p99 = sorted[Math.min(p99Index, sorted.length - 1)];
  
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sorted.length;
  const stddev = Math.sqrt(variance);
  
  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stddev,
    p95,
    p99,
    count: values.length
  };
}

/**
 * 💾 Salvar resultados
 */
async function saveResults(experimentResults, benchConfig) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const resultsDir = path.resolve(__dirname, benchConfig.outputConfig.resultsDir, timestamp);
  
  await fs.mkdir(resultsDir, { recursive: true });
  console.log(`\n[RUNNER] Salvando resultados em: ${resultsDir}`);
  
  // Salvar JSON completo
  if (benchConfig.outputConfig.generateJSON) {
    const jsonPath = path.join(resultsDir, 'results.json');
    await fs.writeFile(jsonPath, JSON.stringify(experimentResults, null, 2));
    console.log(`[RUNNER] ✅ JSON salvo: ${jsonPath}`);
  }
  
  // Gerar Markdown summary
  if (benchConfig.outputConfig.generateMarkdown) {
    const markdownPath = path.join(resultsDir, 'summary.md');
    const markdown = generateMarkdownSummary(experimentResults, benchConfig);
    await fs.writeFile(markdownPath, markdown);
    console.log(`[RUNNER] ✅ Markdown salvo: ${markdownPath}`);
  }
  
  // Gerar CSV
  if (benchConfig.outputConfig.generateCSV) {
    const csvPath = path.join(resultsDir, 'results.csv');
    const csv = generateCSV(experimentResults);
    await fs.writeFile(csvPath, csv);
    console.log(`[RUNNER] ✅ CSV salvo: ${csvPath}`);
  }
  
  return resultsDir;
}

/**
 * 📝 Gerar relatório Markdown
 */
function generateMarkdownSummary(results, benchConfig) {
  let md = `# 🔬 Auditoria de Performance - Pipeline de Áudio\n\n`;
  md += `**Data:** ${new Date().toISOString()}\n\n`;
  md += `**Node.js:** ${process.version}\n`;
  md += `**Plataforma:** ${process.platform} ${process.arch}\n\n`;
  
  md += `## 📊 Resumo dos Experimentos\n\n`;
  
  // Tabela comparativa
  md += `| Experimento | Média (ms) | Mediana (ms) | P95 (ms) | P99 (ms) | Desvio (ms) | Min (ms) | Max (ms) |\n`;
  md += `|-------------|-----------|------------|---------|---------|------------|---------|----------|\n`;
  
  for (const exp of results.experiments) {
    const s = exp.stats;
    md += `| ${exp.experimentName} | ${s.mean.toFixed(1)} | ${s.median.toFixed(1)} | ${s.p95.toFixed(1)} | ${s.p99.toFixed(1)} | ${s.stddev.toFixed(1)} | ${s.min.toFixed(1)} | ${s.max.toFixed(1)} |\n`;
  }
  
  md += `\n## 📈 Detalhes por Experimento\n\n`;
  
  for (const exp of results.experiments) {
    md += `### ${exp.experimentName}\n\n`;
    md += `**Descrição:** ${exp.experimentConfig.description}\n\n`;
    md += `**Flags:**\n\`\`\`json\n${JSON.stringify(exp.experimentConfig.flags, null, 2)}\n\`\`\`\n\n`;
    
    md += `**Runs bem-sucedidos:** ${exp.runs.filter(r => r.success).length}/${exp.runs.length}\n\n`;
    
    // Breakdown detalhado do primeiro run bem-sucedido
    const firstSuccess = exp.runs.find(r => r.success);
    if (firstSuccess && firstSuccess.aggregatedStats) {
      md += `#### Breakdown (primeiro run):\n\n`;
      md += `| Fase | Média (ms) | Mediana (ms) | P95 (ms) |\n`;
      md += `|------|-----------|------------|----------|\n`;
      
      for (const [name, stats] of Object.entries(firstSuccess.aggregatedStats)) {
        md += `| ${name} | ${stats.duration.mean.toFixed(2)} | ${stats.duration.median.toFixed(2)} | ${stats.duration.p95.toFixed(2)} |\n`;
      }
      md += `\n`;
    }
  }
  
  md += `\n## 🎯 Configuração de Benchmark\n\n`;
  md += `\`\`\`json\n${JSON.stringify(benchConfig.benchmarkConfig, null, 2)}\n\`\`\`\n`;
  
  return md;
}

/**
 * 📊 Gerar CSV
 */
function generateCSV(results) {
  let csv = 'Experimento,Run,Sucesso,TotalMs,Arquivo\n';
  
  for (const exp of results.experiments) {
    for (let i = 0; i < exp.runs.length; i++) {
      const run = exp.runs[i];
      csv += `${exp.experimentName},${i + 1},${run.success},${run.totalMs.toFixed(2)},${run.fileName}\n`;
    }
  }
  
  return csv;
}

/**
 * 🚀 Main runner
 */
async function main() {
  const args = process.argv.slice(2);
  const configPath = args.find(a => a.startsWith('--config='))?.split('=')[1] || './bench.config.json';
  const label = args.find(a => a.startsWith('--label='))?.split('=')[1] || null;
  const experimentFilter = args.find(a => a.startsWith('--experiment='))?.split('=')[1] || null;
  const testFileFilter = args.find(a => a.startsWith('--test-file='))?.split('=')[1] || null;
  
  console.log(`[RUNNER] 🔬 Performance Benchmark Runner`);
  console.log(`[RUNNER] Configuração: ${configPath}`);
  if (label) console.log(`[RUNNER] Label: ${label}`);
  if (experimentFilter) console.log(`[RUNNER] Filtro de experimento: ${experimentFilter}`);
  if (testFileFilter) console.log(`[RUNNER] Filtro de arquivo: ${testFileFilter}`);
  
  // Carregar config
  const benchConfig = await loadBenchConfig(path.resolve(__dirname, configPath));
  
  // Filtrar experimentos
  let experiments = Object.entries(benchConfig.experiments);
  if (experimentFilter) {
    experiments = experiments.filter(([name]) => name === experimentFilter);
  }
  if (label) {
    experiments = experiments.filter(([name]) => name === label);
  }
  
  // Filtrar test files
  let testFiles = Object.entries(benchConfig.testFiles);
  if (testFileFilter) {
    testFiles = testFiles.filter(([name]) => name === testFileFilter);
  }
  
  console.log(`[RUNNER] Experimentos a executar: ${experiments.length}`);
  console.log(`[RUNNER] Arquivos de teste: ${testFiles.length}`);
  
  const allResults = {
    experiments: [],
    benchConfig,
    startTime: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };
  
  // Executar cada experimento para cada arquivo de teste
  for (const [testFileName, testFileConfig] of testFiles) {
    console.log(`\n[RUNNER] ========================================`);
    console.log(`[RUNNER] ARQUIVO DE TESTE: ${testFileName}`);
    console.log(`[RUNNER] ${testFileConfig.description}`);
    console.log(`[RUNNER] ========================================`);
    
    // Carregar áudio
    const audioData = await loadAudioFile(testFileConfig.path);
    
    for (const [experimentName, experimentConfig] of experiments) {
      const experimentResult = await runExperiment(
        experimentName,
        experimentConfig,
        testFileName,
        audioData,
        benchConfig
      );
      
      allResults.experiments.push(experimentResult);
    }
  }
  
  allResults.endTime = new Date().toISOString();
  
  // Salvar resultados
  const resultsDir = await saveResults(allResults, benchConfig);
  
  console.log(`\n[RUNNER] ========================================`);
  console.log(`[RUNNER] ✅ BENCHMARK COMPLETO`);
  console.log(`[RUNNER] Resultados salvos em: ${resultsDir}`);
  console.log(`[RUNNER] ========================================`);
}

// Executar
main().catch(error => {
  console.error('[RUNNER] ❌ Erro fatal:', error);
  process.exit(1);
});
