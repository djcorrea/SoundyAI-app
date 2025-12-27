import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

const DIRECTORIES = [
  path.join(ROOT, 'work', 'refs', 'out'),
  path.join(ROOT, 'public', 'refs', 'out')
];

const WORK_OUT_DIR = path.join(ROOT, 'work', 'refs', 'out');
const PUBLIC_OUT_DIR = path.join(ROOT, 'public', 'refs', 'out');

const SKIP_FILES = new Set([
  'genres.json',
  'restore-result.json'
]);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeRangePair([min, max]) {
  // Se veio positivo (erro comum de sinal), converter para dB negativo preservando magnitude.
  if (isFiniteNumber(min) && isFiniteNumber(max) && min > 0 && max > 0) {
    const newMin = -Math.max(min, max);
    const newMax = -Math.min(min, max);
    return [newMin, newMax];
  }
  // Garantir ordem.
  if (isFiniteNumber(min) && isFiniteNumber(max) && min > max) {
    return [max, min];
  }
  return [min, max];
}

function setIfExists(obj, key, value) {
  if (!obj || typeof obj !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    obj[key] = value;
  }
}

function upsert(obj, key, value) {
  if (!obj || typeof obj !== 'object') return;
  obj[key] = value;
}

function applyMetricPatch(block, metricKey, patch) {
  if (!block || typeof block !== 'object') return;

  // Só substitui target se já existir (evita “criar schema” novo fora do escopo).
  if (Object.prototype.hasOwnProperty.call(block, `${metricKey}_target`)) {
    block[`${metricKey}_target`] = patch.target;
  }

  // tol_* sempre preservado; se existir, atualiza? (pelo pedido, não redefinir sem necessidade)
  // Aqui NÃO alteramos tol_*.

  // Adicionar min/max opcionais (underscore) sempre que patch tiver.
  if (patch.min != null) upsert(block, `${metricKey}_min`, patch.min);
  if (patch.max != null) upsert(block, `${metricKey}_max`, patch.max);

  if (patch.warn_from != null) {
    upsert(block, `${metricKey}_warn_from`, patch.warn_from);
  }
}

function applyBandsPatch(bandsObj, bandRanges) {
  if (!bandsObj || typeof bandsObj !== 'object') return;

  const mapping = {
    sub: ['sub'],
    bass: ['low_bass', 'upper_bass'],
    low_mid: ['low_mid'],
    mid: ['mid'],
    high_mid: ['high_mid'],
    brilho: ['brilho'],
    presenca: ['presenca']
  };

  for (const [canonical, keys] of Object.entries(mapping)) {
    const range = bandRanges[canonical];
    if (!range) continue;

    let [min, max] = normalizeRangePair(range);
    if (!isFiniteNumber(min) || !isFiniteNumber(max)) continue;

    for (const key of keys) {
      const band = bandsObj[key];
      if (!band || typeof band !== 'object') continue;

      if (band.target_range && typeof band.target_range === 'object') {
        if (Object.prototype.hasOwnProperty.call(band.target_range, 'min')) band.target_range.min = min;
        else if (Object.prototype.hasOwnProperty.call(band.target_range, 'min_db')) band.target_range.min_db = min;
        else band.target_range.min = min;

        if (Object.prototype.hasOwnProperty.call(band.target_range, 'max')) band.target_range.max = max;
        else if (Object.prototype.hasOwnProperty.call(band.target_range, 'max_db')) band.target_range.max_db = max;
        else band.target_range.max = max;
      }
    }
  }
}

const PATCHES = {
  funk_mandela: {
    true_peak: { target: -0.5, warn_from: -0.1, min: -3.0, max: 0.0 },
    lufs: { target: -7.2, min: -9.5, max: -3.1 },
    dr: { target: 6.0, min: 3.6, max: 11.7 },
    bands: {
      sub: [-28.3, -17.2],
      bass: [-27.9, -19.1],
      low_mid: [-29.7, -21.5],
      mid: [24.1, 29.5],
      high_mid: [-34.6, -28.4],
      brilho: [-44.3, -33.1],
      presenca: [-42.8, -32.0]
    }
  },
  edm: {
    true_peak: { target: -1.0, warn_from: -0.5, min: -3.0, max: 0.0 },
    lufs: { target: -9.0, min: -12.2, max: -6.3 },
    dr: { target: 6.4, min: 3.9, max: 9.9 },
    bands: {
      sub: [-27.0, -18.0],
      bass: [-27.0, -19.0],
      low_mid: [-31.5, -24.0],
      mid: [26.5, 32.0],
      high_mid: [-38.0, -31.5],
      presenca: [-46.0, -36.0],
      brilho: [-44.0, -34.0]
    }
  },
  funk_bruxaria: {
    true_peak: { target: -0.2, warn_from: -0.1, min: -2.5, max: 0.0 },
    lufs: { target: -5.8, min: -7.0, max: -3.1 },
    dr: { target: 5.5, min: 3.5, max: 9.5 },
    bands: {
      sub: [-27.5, -16.5],
      bass: [-27.0, -18.5],
      low_mid: [-31.0, -22.5],
      mid: [24.0, 29.0],
      high_mid: [-36.0, -29.5],
      presenca: [-44.5, -32.0],
      brilho: [-48.0, -33.0]
    }
  },
  funk_bh: {
    true_peak: { target: -0.8, warn_from: -0.3, min: -2.5, max: 0.0 },
    lufs: { target: -8.5, min: -10.0, max: -5.5 },
    dr: { target: 7.5, min: 5.0, max: 11.0 },
    bands: {
      sub: [-29.5, -18.0],
      bass: [-28.5, -19.5],
      low_mid: [-33.0, -24.0],
      mid: [25.0, 30.0],
      high_mid: [-38.0, -31.0],
      presenca: [-46.0, -36.0],
      brilho: [-46.0, -36.0]
    }
  },
  eletrofunk: {
    true_peak: { target: -0.5, warn_from: -0.15, min: -2.0, max: 0.0 },
    lufs: { target: -8.5, min: -10.5, max: -6.5 },
    dr: { target: 6.5, min: 4.5, max: 9.5 },
    bands: {
      sub: [-27.0, -18.0],
      bass: [-26.5, -19.0],
      low_mid: [-32.0, -24.5],
      mid: [26.5, 32.5],
      high_mid: [-38.5, -32.0],
      presenca: [-46.0, -36.5],
      brilho: [-44.0, -34.0]
    }
  },
  progressive_trance: {
    true_peak: { target: -1.0, warn_from: -0.5, min: -3.0, max: 0.0 },
    lufs: { target: -8.5, min: -11.5, max: -6.5 },
    dr: { target: 8.0, min: 6.5, max: 11.0 },
    bands: {
      sub: [-25.2, -17.5],
      bass: [-26.0, -19.5],
      low_mid: [-33.0, -25.0],
      mid: [28.0, 33.0],
      high_mid: [-39.0, -33.0],
      presenca: [-46.5, -37.5],
      brilho: [-44.0, -33.0]
    }
  },
  fullon: {
    true_peak: { target: -1.0, warn_from: -0.5, min: -3.0, max: 0.0 },
    lufs: { target: -7.5, min: -9.0, max: -6.5 },
    dr: { target: 7.0, min: 5.5, max: 10.0 },
    bands: {
      sub: [-24.5, -16.0],
      bass: [-24.5, -18.0],
      low_mid: [-32.5, -24.5],
      mid: [28.5, 33.5],
      high_mid: [-38.0, -32.0],
      presenca: [-44.5, -36.0],
      brilho: [-41.5, -32.5]
    }
  },
  house: {
    true_peak: { target: -1.0, warn_from: -0.5, min: -3.0, max: 0.0 },
    lufs: { target: -9.5, min: -12.5, max: -6.5 },
    dr: { target: 8.0, min: 6.0, max: 11.0 },
    bands: {
      sub: [-25.5, -18.0],
      bass: [-25.5, -19.0],
      low_mid: [-32.0, -25.0],
      mid: [27.5, 32.5],
      high_mid: [-39.0, -33.5],
      presenca: [-47.0, -39.0],
      brilho: [-44.0, -35.0]
    }
  },
  tech_house: {
    true_peak: { target: -1.0, warn_from: -0.5, min: -3.0, max: 0.0 },
    lufs: { target: -9.5, min: -11.5, max: -7.5 },
    dr: { target: 7.0, min: 5.5, max: 10.0 },
    bands: {
      sub: [-25.0, -17.5],
      bass: [-24.0, -17.5],
      low_mid: [-32.5, -25.5],
      mid: [27.5, 32.5],
      high_mid: [-39.0, -33.0],
      presenca: [-46.5, -38.0],
      brilho: [-43.0, -34.0]
    }
  },
  trap: {
    true_peak: { target: -1.0, warn_from: -0.5, min: -2.5, max: 0.0 },
    lufs: { target: -10.5, min: -12.5, max: -8.5 },
    dr: { target: 7.0, min: 5.0, max: 10.5 },
    bands: {
      sub: [-23.5, -16.0],
      bass: [-24.5, -18.0],
      low_mid: [-31.0, -24.0],
      mid: [26.0, 31.5],
      high_mid: [-40.0, -34.0],
      presenca: [-47.5, -39.0],
      brilho: [-45.0, -36.0]
    }
  },
  brazilian_phonk: {
    true_peak: { target: -0.2, warn_from: -0.05, min: -2.0, max: 0.0 },
    lufs: { target: -6.5, min: -8.0, max: -4.5 },
    dr: { target: 4.5, min: 3.0, max: 7.0 },
    bands: {
      sub: [-22.5, -14.5],
      bass: [-23.5, -16.5],
      low_mid: [-29.5, -21.5],
      mid: [24.0, 30.0],
      high_mid: [-37.0, -30.0],
      presenca: [-46.0, -35.0],
      brilho: [-46.0, -34.5]
    }
  },
  rap_drill: {
    true_peak: { target: -1.0, warn_from: -0.5, min: -2.0, max: 0.0 },
    lufs: { target: -11.5, min: -14.0, max: -9.0 },
    dr: { target: 8.0, min: 5.5, max: 12.0 },
    bands: {
      sub: [-24.0, -16.5],
      bass: [-24.5, -18.5],
      low_mid: [-30.0, -23.5],
      mid: [26.0, 32.0],
      high_mid: [-39.5, -33.0],
      presenca: [-45.5, -36.5],
      brilho: [-44.5, -34.5]
    }
  }
};

function patchTargetBlock(block, patch) {
  if (!block || typeof block !== 'object') return;

  // Métricas principais
  applyMetricPatch(block, 'lufs', patch.lufs);
  applyMetricPatch(block, 'dr', patch.dr);

  // True peak tem nome true_peak_*
  if (Object.prototype.hasOwnProperty.call(block, 'true_peak_target')) {
    block.true_peak_target = patch.true_peak.target;
  }
  upsert(block, 'true_peak_min', patch.true_peak.min);
  upsert(block, 'true_peak_max', 0.0); // regra absoluta
  if (patch.true_peak.warn_from != null) {
    upsert(block, 'true_peak_warn_from', patch.true_peak.warn_from);
  }

  // lufs/dr minmax
  upsert(block, 'lufs_min', patch.lufs.min);
  upsert(block, 'lufs_max', patch.lufs.max);
  upsert(block, 'dr_min', patch.dr.min);
  upsert(block, 'dr_max', patch.dr.max);

  // Bands
  if (block.bands && typeof block.bands === 'object') {
    applyBandsPatch(block.bands, patch.bands);
  }
}

function patchGenreObject(genreObj, patch) {
  // Atualizar top-level se tiver targets “flat” (ex.: funk_mandela)
  patchTargetBlock(genreObj, patch);

  // Atualizar legacy_compatibility se existir
  if (genreObj.legacy_compatibility && typeof genreObj.legacy_compatibility === 'object') {
    patchTargetBlock(genreObj.legacy_compatibility, patch);
  }

  // Atualizar hybrid_processing.spectral_bands (bandas) sem mexer em original_metrics
  if (genreObj.hybrid_processing && typeof genreObj.hybrid_processing === 'object') {
    if (genreObj.hybrid_processing.spectral_bands && typeof genreObj.hybrid_processing.spectral_bands === 'object') {
      applyBandsPatch(genreObj.hybrid_processing.spectral_bands, patch.bands);
    }
  }
}

function ensureMinMaxDefaults(genreObj) {
  // Para gêneros não listados: adicionar min/max sem inventar targets novos.
  // Regra absoluta: true_peak_max=0.0.
  // true_peak_min: se existir no JSON mantém; senão default -3.0 (safe).
  const blocks = [genreObj, genreObj?.legacy_compatibility].filter(Boolean);

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;

    // Só cria lufs_min/max e dr_min/max se houver target numérico.
    if (isFiniteNumber(block.lufs_target)) {
      if (!isFiniteNumber(block.lufs_min) || !isFiniteNumber(block.lufs_max)) {
        const tol = isFiniteNumber(block.tol_lufs) ? block.tol_lufs : 1.0;
        upsert(block, 'lufs_min', block.lufs_target - tol);
        upsert(block, 'lufs_max', block.lufs_target + tol);
      }
    }

    if (isFiniteNumber(block.dr_target)) {
      if (!isFiniteNumber(block.dr_min) || !isFiniteNumber(block.dr_max)) {
        const tol = isFiniteNumber(block.tol_dr) ? block.tol_dr : 1.0;
        upsert(block, 'dr_min', block.dr_target - tol);
        upsert(block, 'dr_max', block.dr_target + tol);
      }
    }

    if (isFiniteNumber(block.true_peak_target)) {
      if (!isFiniteNumber(block.true_peak_min)) {
        upsert(block, 'true_peak_min', -3.0);
      }
      upsert(block, 'true_peak_max', 0.0);
      if (isFiniteNumber(block.true_peak_warn_from)) {
        // manter
      }

      // Garantir consistência básica
      if (block.true_peak_target > 0) {
        // Não alterar target automaticamente (para não “inventar”), mas deixa explícito no log.
      }
    }
  }
}

function main() {
  const apply = process.argv.includes('--apply');

  const changes = [];
  const warnings = [];

  for (const dir of DIRECTORIES) {
    const entries = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

    for (const file of entries) {
      if (SKIP_FILES.has(file)) continue;

      const filePath = path.join(dir, file);
      let raw;
      try {
        raw = fs.readFileSync(filePath, 'utf8');
      } catch (e) {
        warnings.push(`[READ_FAIL] ${filePath}: ${e.message}`);
        continue;
      }

      let json;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        warnings.push(`[PARSE_FAIL] ${filePath}: ${e.message}`);
        continue;
      }

      const rootKeys = Object.keys(json);
      if (rootKeys.length === 0) continue;

      const genreKey = rootKeys[0];
      const genreObj = json[genreKey];
      if (!genreObj || typeof genreObj !== 'object') continue;

      const before = JSON.stringify(json);

      const patch = PATCHES[genreKey];
      if (patch) {
        patchGenreObject(genreObj, patch);
      }

      // Sempre garantir TP max=0 e min/max defaults nos alvos existentes
      ensureMinMaxDefaults(genreObj);

      const after = JSON.stringify(json);

      if (before !== after) {
        changes.push(filePath);
        if (apply) {
          fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
        }
      }
    }
  }

  // ✅ Sincronização mínima: se existe em work/refs/out, deve existir em public/refs/out
  // (o frontend faz fetch('/refs/out/<genre>.json'), então ausência quebra targets no modo gênero)
  if (apply) {
    try {
      const workFiles = fs.readdirSync(WORK_OUT_DIR).filter(f => f.endsWith('.json') && !SKIP_FILES.has(f));
      for (const file of workFiles) {
        const src = path.join(WORK_OUT_DIR, file);
        const dst = path.join(PUBLIC_OUT_DIR, file);
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
          changes.push(dst);
        }
      }
    } catch (e) {
      warnings.push(`[SYNC_FAIL] ${e?.message || e}`);
    }
  }

  console.log('✅ Genre targets update script');
  console.log('Mode:', apply ? 'APPLY' : 'DRY-RUN');
  console.log('Changed files:', changes.length);
  for (const c of changes) console.log(' -', c);
  if (warnings.length) {
    console.log('\nWarnings:', warnings.length);
    for (const w of warnings) console.log(' -', w);
  }

  if (!apply) {
    console.log('\nTo apply, run: node scripts/apply-genre-targets-update.js --apply');
  }
}

main();
