/**
 * Refs Pipeline - Descoberta de gêneros, builder e calibrator automáticos.
 * - Descobre pastas em refs/ com arquivos .wav
 * - Roda builder por gênero
 * - Roda calibrator por gênero (min-ok=0.8, --auto-write)
 * - Gera um sumário final com %OK e se gravou JSON
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const REFS_DIR = path.resolve(ROOT, 'refs');
const OUT_DIR = path.join(REFS_DIR, 'out');

async function listGenresWithWav() {
  const entries = await fsp.readdir(REFS_DIR, { withFileTypes: true });
  const genres = [];
  const mp3Only = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === 'out') continue;
    const dir = path.join(REFS_DIR, e.name);
    const files = await fsp.readdir(dir).catch(() => []);
    const wavs = files.filter(f => f.toLowerCase().endsWith('.wav'));
    if (wavs.length > 0) {
      genres.push({ name: e.name, count: wavs.length });
    } else if (files.some(f => f.toLowerCase().endsWith('.mp3'))) {
      mp3Only.push(e.name);
    }
  }
  if (mp3Only.length) {
    console.log('Pastas ignoradas (apenas MP3 no momento):', mp3Only.join(', '));
  }
  return genres;
}

function runNode(args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', code => resolve({ code, out, err }));
  });
}

async function ensureOutDir() { await fsp.mkdir(OUT_DIR, { recursive: true }); }

async function buildGenre(genre) {
  const res = await runNode(['tools/reference-builder.js', genre]);
  const outPath = path.join(OUT_DIR, `${genre}.json`);
  const exists = fs.existsSync(outPath);
  return { genre, code: res.code, exists, out: res.out, err: res.err, outPath };
}

async function calibrateGenre(genre) {
  const res = await runNode(['tools/ref-calibrator.js', genre, path.join('refs', genre), '--min-ok=0.8', '--auto-write']);
  // Extrair %OK atual/proposto
  const okCurrMatch = res.out.match(/%OK geral \(atual\):\s*([\d\.]+)%/);
  const okNewMatch = res.out.match(/%OK geral \(proposto\):\s*([\d\.]+)%/);
  const okCurr = okCurrMatch ? Number(okCurrMatch[1]) : null;
  const okNew = okNewMatch ? Number(okNewMatch[1]) : null;
  const wrote = /Atualizando JSON de referência/.test(res.out);
  return { genre, code: res.code, okCurr, okNew, wrote, out: res.out, err: res.err };
}

async function main() {
  await ensureOutDir();
  const genres = await listGenresWithWav();
  if (genres.length === 0) {
    console.log('Nenhum gênero com WAV encontrado em refs/.');
    process.exit(0);
  }
  console.log('Gêneros detectados com WAVs:', genres.map(g => `${g.name}(${g.count})`).join(', '));

  const results = [];
  for (const g of genres) {
    console.log(`\n--- BUILD ${g.name} ---`);
    const b = await buildGenre(g.name);
  if (b.out && b.out.trim()) console.log(b.out.trim());
  if (b.err && b.err.trim()) console.error(b.err.trim());
  console.log(b.exists ? `✔️ JSON gerado: ${b.outPath}` : `⚠️ JSON ausente para ${g.name}`);

    console.log(`--- CALIBRATE ${g.name} ---`);
    const c = await calibrateGenre(g.name);
  if (c.out && c.out.trim()) console.log(c.out.trim());
  if (c.err && c.err.trim()) console.error(c.err.trim());
  console.log(`%OK atual=${c.okCurr ?? 'n/a'}% | %OK proposto=${c.okNew ?? 'n/a'}% | wrote=${c.wrote}`);
    results.push({ genre: g.name, files: g.count, jsonExists: b.exists, okCurr: c.okCurr, okNew: c.okNew, wrote: c.wrote });
  }

  // Salvar sumário
  const summaryPath = path.join(OUT_DIR, 'pipeline-summary.json');
  await fsp.writeFile(summaryPath, JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2), 'utf8');
  console.log(`\nResumo salvo em ${summaryPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error('Erro no pipeline:', e); process.exit(1); });
}
