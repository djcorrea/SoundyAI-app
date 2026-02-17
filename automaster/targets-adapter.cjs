#!/usr/bin/env node
/**
 * AutoMaster V1 - Adaptador de Targets por Gênero
 * 
 * OBJETIVO: Ler targets do gênero DOS ARQUIVOS EXISTENTES (work/refs/out/<genre>.json)
 *           e retornar um objeto mínimo para o AutoMaster, SEM ALTERAR NADA nos targets.
 * 
 * O AutoMaster V1 usa TP ceiling fixo de -1.0 dBTP para TODOS os modos.
 * O targetLufs vem direto do JSON do gênero (campo lufs_target).
 * O modo (STREAMING/BALANCED/IMPACT) NÃO altera targets — só muda a estratégia DSP.
 * 
 * Uso CLI:
 *   node targets-adapter.cjs <genreKey> [MODE]
 * 
 * Uso Programático:
 *   const { getMasterTargets } = require('./targets-adapter.cjs');
 *   const targets = await getMasterTargets({ genreKey: 'trap', mode: 'BALANCED' });
 * 
 * Saída:
 *   JSON puro no stdout
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CONSTANTES
// ============================================================

// Diretório fonte de verdade dos targets
const REFS_DIR = path.resolve(__dirname, '..', 'work', 'refs', 'out');
const GENRES_INDEX = path.join(REFS_DIR, 'genres.json');

// True Peak ceiling fixo para todos os modos (decisão técnica V1)
const TP_CEILING_FIXED = -1.0;

// Tolerâncias fixas V1 (conservadoras)
const V1_TOLERANCES = {
  lufs: 1.5,
  tp: 0.3
};

// Modos válidos (referência, não altera targets)
const VALID_MODES = ['STREAMING', 'BALANCED', 'IMPACT'];

// ============================================================
// FUNÇÕES DE CARREGAMENTO (SOMENTE LEITURA)
// ============================================================

/**
 * Carrega a lista de gêneros disponíveis.
 * @returns {Array<{key: string, label: string, legacy_key?: string}>}
 */
function loadGenresList() {
  if (!fs.existsSync(GENRES_INDEX)) {
    throw new Error(`Índice de gêneros não encontrado: ${GENRES_INDEX}`);
  }

  const raw = fs.readFileSync(GENRES_INDEX, 'utf-8');
  const data = JSON.parse(raw);

  if (!data.genres || !Array.isArray(data.genres)) {
    throw new Error('Formato inválido em genres.json: campo "genres" ausente ou não é array');
  }

  return data.genres;
}

/**
 * Resolve genreKey incluindo legacy_key mappings.
 * @param {string} genreKey - Chave do gênero
 * @returns {{resolvedKey: string, isLegacy: boolean}} Chave resolvida
 */
function resolveGenreKey(genreKey) {
  const genres = loadGenresList();
  const normalizedInput = genreKey.toLowerCase().trim();

  // Busca direta
  const direct = genres.find(g => g.key === normalizedInput);
  if (direct) {
    return { resolvedKey: direct.key, isLegacy: false };
  }

  // Busca por legacy_key
  const legacy = genres.find(g => g.legacy_key === normalizedInput);
  if (legacy) {
    return { resolvedKey: legacy.key, isLegacy: true };
  }

  return null;
}

/**
 * Carrega targets de um gênero específico (somente leitura).
 * @param {string} genreKey - Chave do gênero
 * @returns {Object} Target data do JSON
 */
function loadGenreTargets(genreKey) {
  const genrePath = path.join(REFS_DIR, `${genreKey}.json`);

  if (!fs.existsSync(genrePath)) {
    throw new Error(`Arquivo de targets não encontrado: ${genrePath}`);
  }

  const raw = fs.readFileSync(genrePath, 'utf-8');
  const data = JSON.parse(raw);

  // O JSON tem a chave do gênero como primeiro nível
  const genreData = data[genreKey];
  if (!genreData) {
    // Tentar qualquer chave de primeiro nível
    const keys = Object.keys(data);
    if (keys.length === 1) {
      return data[keys[0]];
    }
    throw new Error(`Estrutura inesperada no JSON de ${genreKey}: chave raiz não encontrada`);
  }

  return genreData;
}

/**
 * Extrai lufs_target do objeto de targets.
 * Busca em múltiplos locais possíveis (compatibilidade com formatos v1 e v2).
 * @param {Object} genreData - Dados do gênero
 * @returns {number} lufs_target
 */
function extractLufsTarget(genreData) {
  // Ordem de prioridade:
  // 1. Campo raiz lufs_target
  if (typeof genreData.lufs_target === 'number' && !isNaN(genreData.lufs_target)) {
    return genreData.lufs_target;
  }

  // 2. legacy_compatibility.lufs_target
  if (genreData.legacy_compatibility && typeof genreData.legacy_compatibility.lufs_target === 'number') {
    return genreData.legacy_compatibility.lufs_target;
  }

  // 3. hybrid_processing.original_metrics.lufs_integrated
  if (genreData.hybrid_processing &&
      genreData.hybrid_processing.original_metrics &&
      typeof genreData.hybrid_processing.original_metrics.lufs_integrated === 'number') {
    return genreData.hybrid_processing.original_metrics.lufs_integrated;
  }

  throw new Error('TARGET_LUFS_INVALID: não foi possível extrair lufs_target do JSON');
}

/**
 * Extrai tolerância de LUFS do objeto de targets.
 * @param {Object} genreData - Dados do gênero
 * @returns {number} tolerância de LUFS
 */
function extractTolLufs(genreData) {
  if (typeof genreData.tol_lufs === 'number' && !isNaN(genreData.tol_lufs)) {
    return genreData.tol_lufs;
  }

  if (genreData.legacy_compatibility && typeof genreData.legacy_compatibility.tol_lufs === 'number') {
    return genreData.legacy_compatibility.tol_lufs;
  }

  return V1_TOLERANCES.lufs;
}

// ============================================================
// API PRINCIPAL
// ============================================================

/**
 * Retorna targets mínimos para o AutoMaster, lidos dos JSONs existentes.
 * NÃO modifica nenhum arquivo. O modo NÃO altera targets (só estratégia DSP).
 * 
 * @param {Object} params
 * @param {string} params.genreKey - Chave do gênero (ex: "trap", "funk_mandela")
 * @param {string} [params.mode="BALANCED"] - Modo (não altera targets, só referência)
 * @returns {Promise<Object>} Objeto com targets para o AutoMaster
 */
async function getMasterTargets({ genreKey, mode = 'BALANCED' }) {
  // Validar mode
  const upperMode = (mode || 'BALANCED').toUpperCase();
  if (!VALID_MODES.includes(upperMode)) {
    throw new Error(`MODE_INVALID: ${mode}. Valores: ${VALID_MODES.join(', ')}`);
  }

  // Resolver genreKey (incluindo legacy mappings)
  const resolved = resolveGenreKey(genreKey);
  if (!resolved) {
    throw new Error(`GENRE_NOT_FOUND: "${genreKey}" não existe em genres.json`);
  }

  // Carregar targets (somente leitura)
  const genreData = loadGenreTargets(resolved.resolvedKey);

  // Extrair lufs_target
  const targetLufs = extractLufsTarget(genreData);

  // Extrair tolerância
  const tolLufs = extractTolLufs(genreData);

  // Validar targetLufs
  if (isNaN(targetLufs) || targetLufs === undefined || targetLufs === null) {
    throw new Error(`TARGET_LUFS_INVALID: lufs_target é NaN/undefined para ${resolved.resolvedKey}`);
  }

  // Construir resultado mínimo
  return {
    genreKey: resolved.resolvedKey,
    genreKeyRequested: genreKey,
    isLegacyKey: resolved.isLegacy,
    mode: upperMode,
    targetLufs,
    tpCeiling: TP_CEILING_FIXED,
    tolerances: {
      lufs: tolLufs,
      tp: V1_TOLERANCES.tp
    },
    source: {
      path: path.join(REFS_DIR, `${resolved.resolvedKey}.json`),
      field: 'lufs_target'
    }
  };
}

// ============================================================
// SAÍDA JSON
// ============================================================

function outputResult(result) {
  console.log(JSON.stringify(result));
}

function exitWithError(code, message) {
  console.error(JSON.stringify({ error: code, message }));
  process.exit(1);
}

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    exitWithError('INVALID_ARGS', 'Uso: node targets-adapter.cjs <genreKey> [MODE]');
  }

  const [genreKey, mode] = args;

  getMasterTargets({ genreKey, mode: mode || 'BALANCED' })
    .then(result => {
      outputResult(result);
      process.exit(0);
    })
    .catch(error => {
      const code = error.message.includes(':') ? error.message.split(':')[0] : 'ADAPTER_ERROR';
      exitWithError(code, error.message);
    });
}

// ============================================================
// EXPORTAÇÃO
// ============================================================

module.exports = { getMasterTargets, loadGenresList, TP_CEILING_FIXED, V1_TOLERANCES, VALID_MODES };
