/**
 * standardize-ref-targets.cjs
 * Padroniza lufs_target, tol_lufs, dr_target, tol_dr, lra_target, tol_lra
 * em TODOS os arquivos de public/refs/out/*.json
 *
 * Valores alvos globais:
 *   lufs_target = -20,  tol_lufs = 6
 *   dr_target   = 15,   tol_dr   = 5
 *   lra_target  = 10,   tol_lra  = 4
 *
 * REGRAS:
 *  - Não remove outros campos
 *  - Atualiza tanto na raiz do objeto do gênero quanto em legacy_compatibility (se existir)
 *  - Sincroniza work/refs/out/ após padronizar
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const PUB_DIR  = path.join(ROOT, 'public', 'refs', 'out');
const WORK_DIR = path.join(ROOT, 'work',   'refs', 'out');

const IGNORE = [/^ROLLBACK_/i, /^restore-result\.json$/i, /^pipeline-summary\.json$/i];

const STANDARD_TARGETS = {
    lufs_target : -20,
    tol_lufs    :   6,
    dr_target   :  15,
    tol_dr      :   5,
    lra_target  :  10,
    tol_lra     :   4,
};

function applyTargets(obj) {
    let changed = false;
    for (const [key, val] of Object.entries(STANDARD_TARGETS)) {
        if (obj[key] !== val) {
            obj[key] = val;
            changed = true;
        }
    }
    return changed;
}

function processFile(filePath) {
    const raw  = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);

    // Detectar estrutura: { genreName: { lufs_target, ... } } ou flat
    const keys    = Object.keys(json);
    const rootKey = keys[0];
    const obj     = (rootKey && typeof json[rootKey] === 'object') ? json[rootKey] : json;

    let changed = applyTargets(obj);

    // Também padronizar legacy_compatibility se existir
    if (obj.legacy_compatibility && typeof obj.legacy_compatibility === 'object') {
        const lc = obj.legacy_compatibility;
        for (const [key, val] of Object.entries(STANDARD_TARGETS)) {
            if (lc[key] !== undefined && lc[key] !== val) {
                lc[key] = val;
                changed = true;
            }
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
    }

    return changed;
}

function main() {
    const files = fs.readdirSync(PUB_DIR).filter(f => f.endsWith('.json') && !IGNORE.some(p => p.test(f)));

    console.log('\n=== standardize-ref-targets: public/refs/out/ ===\n');

    let updated = 0;
    for (const file of files) {
        const changed = processFile(path.join(PUB_DIR, file));
        console.log(`  ${changed ? '✅ ATUALIZADO' : '✔  sem mudança'} ${file}`);
        if (changed) updated++;
    }

    console.log(`\nResumo: ${updated} arquivo(s) padronizado(s).\n`);

    // Sync automático → work/refs/out/
    if (!fs.existsSync(WORK_DIR)) { fs.mkdirSync(WORK_DIR, { recursive: true }); }

    const crypto = require('crypto');
    let synced = 0;
    for (const file of files) {
        const src  = path.join(PUB_DIR,  file);
        const dest = path.join(WORK_DIR, file);
        const srcBuf = fs.readFileSync(src);
        const srcHash = crypto.createHash('md5').update(srcBuf).digest('hex');
        const destHash = fs.existsSync(dest)
            ? crypto.createHash('md5').update(fs.readFileSync(dest)).digest('hex')
            : null;
        if (srcHash !== destHash) { fs.writeFileSync(dest, srcBuf); synced++; }
    }
    if (synced > 0) console.log(`🔄 Sincronizados ${synced} arquivo(s) para work/refs/out/\n`);
}

main();
