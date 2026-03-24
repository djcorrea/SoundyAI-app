#!/usr/bin/env node
'use strict';

/**
 * batch-test.cjs
 * 
 * Executa automaster-v1.cjs para TODOS os arquivos WAV da pasta atual,
 * nos modos MEDIUM, HIGH e IMPACTO (EXTREME), salvando resultados e logs.
 * 
 * Uso:
 *   node batch-test.cjs
 * 
 * Estrutura de saída:
 *   test-results/MEDIUM/nomedamusica_medium.wav
 *   test-results/HIGH/nomedamusica_high.wav
 *   test-results/IMPACTO/nomedamusica_impacto.wav
 *   test-results/logs/nomedamusica_medium.log
 *   test-results/logs/nomedamusica_high.log
 *   test-results/logs/nomedamusica_impacto.log
 *   test-results/summary.txt
 */

const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const AUTOMASTER_SCRIPT = path.resolve(__dirname, 'automaster-v1.cjs');
const INPUT_DIR         = path.resolve(__dirname, '..', 'testeauto');
const RESULTS_DIR       = path.resolve(INPUT_DIR, 'test-results');

/** Modos a executar: name = label de exibição, mode = argumento real do automaster */
const MODES = [
  { name: 'MEDIUM',  dir: 'MEDIUM',  suffix: '_medium',  mode: 'MEDIUM'  },
  { name: 'HIGH',    dir: 'HIGH',    suffix: '_high',    mode: 'HIGH'    },
  { name: 'IMPACTO', dir: 'IMPACTO', suffix: '_impacto', mode: 'EXTREME' },
];

/**
 * Padrões de sufixo em WAVs temporários/intermediários do automaster.
 * Esses arquivos não devem ser processados como faixas de entrada.
 */
const TEMP_PATTERNS = [
  '.eq_pregain',
  '.trim_ceiling',
  '.audit_preclip',
  '_temp.wav',
  '_iter',
  '_stabilized',
];

// ============================================================
// HELPERS
// ============================================================

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Executa automaster-v1.cjs e retorna { stdout, stderr, error, elapsed }.
 * Nunca rejeita — erros ficam no campo `error`.
 */
function runAutomaster(inputPath, outputPath, mode) {
  return new Promise((resolve) => {
    const startTs = Date.now();

    execFile(
      'node',
      [AUTOMASTER_SCRIPT, inputPath, outputPath, mode],
      {
        maxBuffer: 20 * 1024 * 1024, // 20 MB — suficiente para qualquer log
        timeout:   600_000,          // 10 minutos máx por faixa
      },
      (error, stdout, stderr) => {
        const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
        resolve({ stdout: stdout || '', stderr: stderr || '', error, elapsed });
      }
    );
  });
}

/**
 * Extrai JSON do stdout e linhas de WARNING/ERROR do stderr.
 * Retorna { json, warnings, errorLines }.
 */
function parseOutput(stdout, stderr) {
  let json = null;
  try {
    const trimmed = stdout.trim();
    if (trimmed) json = JSON.parse(trimmed);
  } catch (_) {
    // stdout não era JSON válido — será registrado "bruto" no log
  }

  const warnings   = [];
  const errorLines = [];

  for (const line of (stderr || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/⚠️|WARNING|WARN/i.test(trimmed)) warnings.push(trimmed);
    if (/ERROR|Erro|falhou|❌/i.test(trimmed)) errorLines.push(trimmed);
  }

  return { json, warnings, errorLines };
}

/**
 * Garante que `value` (número ou null) seja exibido como string formatada.
 */
function fmt(value, decimals = 2) {
  return value !== null && value !== undefined ? Number(value).toFixed(decimals) : 'N/A';
}

/**
 * Monta o conteúdo do arquivo .log para uma execução.
 */
function buildLog(wavFile, modeConfig, elapsed, stdout, stderr, parsed) {
  const { json, warnings, errorLines } = parsed;

  const lufs   = fmt(json?.final_lufs);
  const tp     = fmt(json?.final_tp);
  const gr     = fmt(json?.delta_lufs);
  const success = json?.success ?? false;
  const aborted = json?.impact_aborted ? ` (ABORTADO: ${json.abort_reason})` : '';
  const status  = success ? 'OK' : `FAILED${aborted}`;

  const lines = [
    '==== TEST RESULT ====',
    `File: ${wavFile}`,
    `Mode: ${modeConfig.name} (modo real: ${modeConfig.mode})`,
    `LUFS: ${lufs}`,
    `TP:   ${tp}`,
    `GR:   ${gr} dB`,
    `Time: ${elapsed}s`,
    `Status: ${status}`,
    '====================',
    '',
  ];

  if (warnings.length > 0) {
    lines.push('--- WARNINGS ---');
    warnings.forEach(w => lines.push(w));
    lines.push('');
  }

  if (errorLines.length > 0) {
    lines.push('--- ERRORS ---');
    errorLines.forEach(e => lines.push(e));
    lines.push('');
  }

  lines.push('--- STDOUT (JSON) ---');
  lines.push(stdout.trim() || '(vazio)');
  lines.push('');
  lines.push('--- STDERR ---');
  lines.push(stderr.trim() || '(vazio)');
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const totalStart = Date.now();

  // Criar estrutura de pastas
  ensureDir(RESULTS_DIR);
  for (const m of MODES) {
    ensureDir(path.join(RESULTS_DIR, m.dir));
  }
  ensureDir(path.join(RESULTS_DIR, 'logs'));

  // Listar arquivos WAV da pasta testeauto (não recursivo)
  const allFiles = fs.readdirSync(INPUT_DIR);
  const wavFiles = allFiles.filter(f => {
    // Apenas .wav
    if (path.extname(f).toLowerCase() !== '.wav') return false;
    // Ignorar temporários/intermediários
    if (TEMP_PATTERNS.some(p => f.includes(p))) return false;
    return true;
  });

  if (wavFiles.length === 0) {
    console.log(`Nenhum arquivo WAV encontrado em: ${INPUT_DIR}`);
    return;
  }

  const total = wavFiles.length * MODES.length;
  console.log('\n================================================');
  console.log(' AutoMaster Batch Test');
  console.log('================================================');
  console.log(`Arquivos WAV encontrados : ${wavFiles.length}`);
  console.log(`Modos                    : ${MODES.map(m => m.name).join(', ')}`);
  console.log(`Total de execuções       : ${total}`);
  console.log('================================================\n');

  // Acumuladores
  const allResults  = [];
  let totalWarnings = 0;
  let totalFailures = 0;

  // ── Processar em sequência (sem paralelismo) ──
  for (const wavFile of wavFiles) {
    const baseName  = path.basename(wavFile, '.wav');
    const inputPath = path.resolve(INPUT_DIR, wavFile);

    console.log(`\n► ${wavFile}`);

    for (const modeConfig of MODES) {
      const outputFile = `${baseName}${modeConfig.suffix}.wav`;
      const outputPath = path.join(RESULTS_DIR, modeConfig.dir, outputFile);
      const logPath    = path.join(RESULTS_DIR, 'logs', `${baseName}${modeConfig.suffix}.log`);

      process.stdout.write(`  [${modeConfig.name.padEnd(8)}] aguardando... `);

      const { stdout, stderr, error, elapsed } = await runAutomaster(
        inputPath, outputPath, modeConfig.mode
      );
      const parsed                    = parseOutput(stdout, stderr);
      const { json, warnings } = parsed;

      const success   = json?.success ?? false;
      const lufs      = fmt(json?.final_lufs);
      const tp        = fmt(json?.final_tp);
      const warnCount = warnings.length;
      const statusIcon = success ? '✅' : '❌';

      // Limpar a linha temporária e imprimir resultado
      process.stdout.write(
        `\r  [${modeConfig.name.padEnd(8)}] ${statusIcon}  LUFS=${lufs}  TP=${tp}  ${elapsed}s` +
        (warnCount > 0 ? `  ⚠️  ${warnCount} warn` : '') +
        '\n'
      );

      if (!success)    totalFailures++;
      totalWarnings += warnCount;

      // Salvar log completo
      const logContent = buildLog(wavFile, modeConfig, elapsed, stdout, stderr, parsed);
      fs.writeFileSync(logPath, logContent, 'utf8');

      // Acumular para o summary
      allResults.push({
        file:        wavFile,
        mode:        modeConfig.name,
        lufs:        json?.final_lufs ?? null,
        tp:          json?.final_tp   ?? null,
        gr:          json?.delta_lufs ?? null,
        elapsed,
        success,
        warnings:    warnCount,
        aborted:     json?.impact_aborted ?? false,
        abortReason: json?.abort_reason   ?? null,
      });
    }
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);

  // ── Calcular médias de LUFS por modo ──
  const lufsAverages = {};
  for (const m of MODES) {
    const valid = allResults.filter(r => r.mode === m.name && r.lufs !== null);
    lufsAverages[m.name] = valid.length > 0
      ? (valid.reduce((s, r) => s + r.lufs, 0) / valid.length).toFixed(2)
      : 'N/A';
  }

  // ── Gerar summary.txt ──
  const summaryLines = [
    '================================================',
    ' AutoMaster Batch Test — Resumo',
    '================================================',
    `Data                : ${new Date().toLocaleString('pt-BR')}`,
    `Arquivos processados: ${wavFiles.length}`,
    `Execuções totais    : ${allResults.length}`,
    `Falhas              : ${totalFailures}`,
    `Warnings totais     : ${totalWarnings}`,
    `Tempo total         : ${totalElapsed}s`,
    '',
    '--- Média de LUFS por modo ---',
    ...MODES.map(m => `  ${m.name.padEnd(8)}: ${lufsAverages[m.name]} LUFS`),
    '',
    '--- Resultados detalhados ---',
    `${'Arquivo'.padEnd(35)} ${'Modo'.padEnd(8)} ${'LUFS '.padStart(8)} ${'TP  '.padStart(7)} ${'GR  '.padStart(7)} ${'Tempo'.padStart(7)}  Status`,
    '─'.repeat(100),
  ];

  for (const r of allResults) {
    const lufsStr = fmt(r.lufs);
    const tpStr   = fmt(r.tp);
    const grStr   = fmt(r.gr);
    const status  = r.success
      ? 'OK'
      : r.aborted
        ? `ABORTADO (${r.abortReason})`
        : 'FAILED';

    summaryLines.push(
      `${r.file.padEnd(35)} ${r.mode.padEnd(8)} ${lufsStr.padStart(8)} ${tpStr.padStart(7)} ${grStr.padStart(7)} ${(r.elapsed + 's').padStart(7)}  ${status}`
    );
  }

  summaryLines.push('');
  summaryLines.push('================================================');

  const summaryPath = path.join(RESULTS_DIR, 'summary.txt');
  fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf8');

  // ── Resultado final no console ──
  console.log('\n================================================');
  console.log(' BATCH CONCLUÍDO');
  console.log('================================================');
  console.log(`Arquivos processados : ${wavFiles.length}`);
  console.log(`Execuções totais     : ${allResults.length}`);
  console.log(`Falhas               : ${totalFailures}`);
  console.log(`Warnings totais      : ${totalWarnings}`);
  console.log(`Tempo total          : ${totalElapsed}s`);
  console.log('');
  console.log('Médias LUFS por modo:');
  for (const m of MODES) {
    console.log(`  ${m.name.padEnd(8)}: ${lufsAverages[m.name]} LUFS`);
  }
  console.log(`\nSummary salvo em   : ${summaryPath}`);
  console.log('================================================\n');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
