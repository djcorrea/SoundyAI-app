#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { runMasterPipeline } = require('../automaster/master-pipeline.cjs');

// Config via CLI
const argv = require('minimist')(process.argv.slice(2));
const limit = typeof argv.limit === 'number' ? argv.limit : (argv._[0] ? parseInt(argv._[0], 10) : 0);
const pattern = argv.pattern || argv.p || null;
const srcDir = path.resolve(process.cwd(), 'musicas');
const outDir = path.resolve(process.cwd(), 'tests', 'out');
const reportPath = path.resolve(process.cwd(), 'tests', 'report.json');

if (!fs.existsSync(srcDir)) {
  console.error('Pasta de amostras nao encontrada:', srcDir);
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const files = fs.readdirSync(srcDir)
  .filter(f => f.toLowerCase().endsWith('.wav'))
  .filter(f => (pattern ? f.includes(pattern) : true))
  .slice(0, limit > 0 ? limit : undefined);

if (files.length === 0) {
  console.error('Nenhum arquivo WAV encontrado com os filtros fornecidos.');
  process.exit(1);
}

(async () => {
  const report = [];

  for (const file of files) {
    const input = path.join(srcDir, file);
    const base = path.basename(file, path.extname(file));
    const output = path.join(outDir, `${base}_out.wav`);
    const logJsonPath = path.join(outDir, `${base}.json`);

    console.log('Processando', file);

    try {
      const result = await runMasterPipeline({ inputPath: input, outputPath: output, mode: 'BALANCED' });
      fs.writeFileSync(logJsonPath, JSON.stringify(result, null, 2));
      report.push({ file, success: true, result });
    } catch (err) {
      const errObj = { file, success: false, error: String(err && err.message ? err.message : err) };
      fs.writeFileSync(logJsonPath, JSON.stringify(errObj, null, 2));
      report.push(errObj);
    }
  }

  fs.writeFileSync(reportPath, JSON.stringify({ run_at: new Date().toISOString(), items: report }, null, 2));
  console.log('Execucao concluida. Relatorio salvo em', reportPath);
})();
