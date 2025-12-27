import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const DIRECTORIES = [
  path.join(ROOT, 'work', 'refs', 'out'),
  path.join(ROOT, 'public', 'refs', 'out')
];

const SKIP_FILES = new Set([
  'genres.json',
  'restore-result.json'
]);

const GENRES_FILE = path.join(ROOT, 'work', 'refs', 'out', 'genres.json');

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function approxZero(v, eps = 1e-9) {
  return isFiniteNumber(v) && Math.abs(v) <= eps;
}

function getRootGenreObject(json) {
  if (!json || typeof json !== 'object') return null;
  const keys = Object.keys(json);
  if (keys.length === 0) return null;
  const genreKey = keys[0];
  const genreObj = json[genreKey];
  if (!genreObj || typeof genreObj !== 'object') return null;
  return { genreKey, genreObj };
}

function isTargetsLikeBlock(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return isFiniteNumber(obj.lufs_target) && isFiniteNumber(obj.true_peak_target) && (isFiniteNumber(obj.dr_target) || isFiniteNumber(obj.dynamic_range_target));
}

function resolveEffectiveBlock(genreObj) {
  // Preferir o primeiro bloco que realmente parece um bloco de targets.
  // (Evita cair em hybrid_processing/original_metrics que não tem lufs_target/dr_target.)
  if (isTargetsLikeBlock(genreObj.legacy_compatibility)) return genreObj.legacy_compatibility;
  if (isTargetsLikeBlock(genreObj)) return genreObj;
  if (isTargetsLikeBlock(genreObj.direct)) return genreObj.direct;
  return genreObj;
}

function getRangeMinMax(rangeObj) {
  if (!rangeObj || typeof rangeObj !== 'object') return null;
  const min = rangeObj.min ?? rangeObj.min_db;
  const max = rangeObj.max ?? rangeObj.max_db;
  if (!isFiniteNumber(min) || !isFiniteNumber(max)) return null;
  return { min, max };
}

function getBandMinMax(band) {
  if (!band || typeof band !== 'object') return null;
  // Formato novo/canônico
  const byRange = getRangeMinMax(band.target_range);
  if (byRange) return byRange;

  // Formato alternativo (alguns JSONs antigos): min_db/max_db no nível da banda
  if (isFiniteNumber(band.min_db) && isFiniteNumber(band.max_db)) {
    return { min: band.min_db, max: band.max_db };
  }

  // Formato alternativo: target_db +/- tol_db
  if (isFiniteNumber(band.target_db) && isFiniteNumber(band.tol_db)) {
    return { min: band.target_db - band.tol_db, max: band.target_db + band.tol_db };
  }

  return null;
}

function validateTargetsBlock(block, fileLabel, errors, opts = {}) {
  if (!block || typeof block !== 'object') {
    errors.push(`${fileLabel}: bloco de targets inválido (não é objeto)`);
    return;
  }

  if (!isFiniteNumber(block.lufs_target)) {
    errors.push(`${fileLabel}: lufs_target deve ser number finito (recebido: ${typeof block.lufs_target})`);
  }
  if (!isFiniteNumber(block.true_peak_target)) {
    errors.push(`${fileLabel}: true_peak_target deve ser number finito (recebido: ${typeof block.true_peak_target})`);
  }
  const drValue = isFiniteNumber(block.dr_target) ? block.dr_target : block.dynamic_range_target;
  if (!isFiniteNumber(drValue)) {
    errors.push(`${fileLabel}: dr_target deve ser number finito (recebido: ${typeof block.dr_target})`);
  }

  // true_peak_min/max obrigatórios
  if (!isFiniteNumber(block.true_peak_min)) {
    errors.push(`${fileLabel}: true_peak_min ausente ou inválido`);
  }
  if (!approxZero(block.true_peak_max)) {
    errors.push(`${fileLabel}: true_peak_max deve ser 0.0 (ou extremamente próximo). Recebido: ${String(block.true_peak_max)}`);
  }

  // Regras de ordenação
  if (isFiniteNumber(block.true_peak_min) && isFiniteNumber(block.true_peak_target) && isFiniteNumber(block.true_peak_max)) {
    const eps = 1e-9;
    if (block.true_peak_min - eps > block.true_peak_target || block.true_peak_target - eps > block.true_peak_max) {
      errors.push(
        `${fileLabel}: violação true_peak_min <= true_peak_target <= true_peak_max (min=${block.true_peak_min}, target=${block.true_peak_target}, max=${block.true_peak_max})`
      );
    }
  }

  // Bands
  if (opts.skipBands) return;

  if (!block.bands || typeof block.bands !== 'object') {
    errors.push(`${fileLabel}: bands ausente ou inválido`);
    return;
  }

  const bandKeys = Object.keys(block.bands);
  if (bandKeys.length === 0) {
    errors.push(`${fileLabel}: bands vazio`);
    return;
  }

  for (const bandKey of bandKeys) {
    const band = block.bands[bandKey];
    if (!band || typeof band !== 'object') {
      errors.push(`${fileLabel}: band '${bandKey}' inválida (não é objeto)`);
      continue;
    }
    const mm = getBandMinMax(band);
    if (!mm) {
      errors.push(`${fileLabel}: band '${bandKey}' range inválido (esperado target_range.min/max, min_db/max_db ou target_db/tol_db)`);
      continue;
    }
    if (mm.min > mm.max) {
      errors.push(`${fileLabel}: band '${bandKey}' target_range.min > max (${mm.min} > ${mm.max})`);
    }
  }
}

function readGenresList(errors) {
  if (!fs.existsSync(GENRES_FILE)) {
    errors.push(`Arquivo ausente: ${GENRES_FILE}`);
    return { required: new Set(['default']), optional: new Set() };
  }

  let json;
  try {
    json = JSON.parse(fs.readFileSync(GENRES_FILE, 'utf8'));
  } catch (e) {
    errors.push(`${GENRES_FILE}: falha ao ler/parsear JSON: ${e.message}`);
    return { required: new Set(['default']), optional: new Set() };
  }

  const required = new Set(['default']);
  const optional = new Set();

  const list = Array.isArray(json?.genres) ? json.genres : [];
  for (const g of list) {
    if (g && typeof g === 'object') {
      if (typeof g.key === 'string' && g.key.trim()) required.add(g.key.trim());
      if (typeof g.legacy_key === 'string' && g.legacy_key.trim()) optional.add(g.legacy_key.trim());
    }
  }

  return { required, optional };
}

function main() {
  const errors = [];

  const { required: requiredBasenames, optional: optionalBasenames } = readGenresList(errors);

  for (const dir of DIRECTORIES) {
    if (!fs.existsSync(dir)) {
      errors.push(`Diretório ausente: ${dir}`);
      continue;
    }

    // Garantir que todos os gêneros canônicos existam nos 2 diretórios
    for (const base of requiredBasenames) {
      const fp = path.join(dir, `${base}.json`);
      if (!fs.existsSync(fp)) {
        errors.push(`${fp}: arquivo de targets canônico ausente`);
      }
    }

    const allowed = new Set([...requiredBasenames, ...optionalBasenames]);
    const files = fs
      .readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.json'))
      .filter(f => !SKIP_FILES.has(f))
      .filter(f => allowed.has(path.basename(f, '.json')));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const expectedGenreKey = path.basename(file, '.json');

      let json;
      try {
        json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        errors.push(`${filePath}: falha ao ler/parsear JSON: ${e.message}`);
        continue;
      }

      const root = getRootGenreObject(json);
      if (!root) {
        errors.push(`${filePath}: formato inesperado (root inválido)`);
        continue;
      }

      const { genreKey, genreObj } = root;
      if (genreKey !== expectedGenreKey) {
        errors.push(`${filePath}: root key '${genreKey}' não corresponde ao nome do arquivo '${expectedGenreKey}.json'`);
        continue;
      }
      if (Object.keys(json).length !== 1) {
        errors.push(`${filePath}: formato inesperado (esperado exatamente 1 root key)`);
        continue;
      }
      const effective = resolveEffectiveBlock(genreObj);

      const isDefault = genreKey === 'default';

      validateTargetsBlock(effective, `${filePath} (${genreKey} / effective)`, errors, { skipBands: isDefault });

      // Também validar top-level e legacy_compatibility se tiverem campos (para evitar inconsistência interna)
      if (genreObj && typeof genreObj === 'object') {
        if (isFiniteNumber(genreObj.lufs_target) || isFiniteNumber(genreObj.true_peak_target) || isFiniteNumber(genreObj.dr_target)) {
          validateTargetsBlock(genreObj, `${filePath} (${genreKey} / top-level)`, errors, { skipBands: isDefault });
        }
        if (genreObj.legacy_compatibility && typeof genreObj.legacy_compatibility === 'object') {
          validateTargetsBlock(genreObj.legacy_compatibility, `${filePath} (${genreKey} / legacy_compatibility)`, errors, { skipBands: isDefault });
        }
      }
    }
  }

  if (errors.length) {
    console.error(`❌ validate-genre-targets: ${errors.length} erro(s)`);
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }

  console.log('✅ validate-genre-targets: OK');
}

main();
