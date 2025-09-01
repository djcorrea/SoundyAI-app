// Copia JSONs de refs/out para public/refs/out para garantir disponibilidade em produção (Vercel)
// Mudança aditiva e segura: não altera HTML/CSS nem contratos.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function copyJsonFiles(srcDir, dstDir) {
  const entries = await fsp.readdir(srcDir, { withFileTypes: true });
  await ensureDir(dstDir);
  let count = 0;
  for (const ent of entries) {
    if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) {
      const src = path.join(srcDir, ent.name);
      const dst = path.join(dstDir, ent.name);
      await fsp.copyFile(src, dst);
      count++;
    }
  }
  return count;
}

async function main() {
  try {
    const ROOT = process.cwd();
    const srcDir = path.join(ROOT, 'refs', 'out');
    const dstDir = path.join(ROOT, 'public', 'refs', 'out');
    if (!fs.existsSync(srcDir)) {
      console.log('[copy-refs] Pasta de origem ausente, pulando:', srcDir);
      return;
    }
    const n = await copyJsonFiles(srcDir, dstDir);
    console.log(`[copy-refs] Copiados ${n} JSON(s) para`, dstDir);
  } catch (e) {
    console.warn('[copy-refs] Falha ao copiar refs:', e?.message || e);
  }
}

main();
