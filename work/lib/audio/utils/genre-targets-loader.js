// 🎯 GENRE TARGETS LOADER
// Carrega targets de gênero dos arquivos JSON e converte para formato interno
// Mantém compatibilidade total com GENRE_THRESHOLDS como fallback

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache global para evitar leituras repetidas
const targetsCache = new Map();

/**
 * 🔧 MAPEAMENTO DE BANDAS ESPECTRAIS
 * Converte nomenclatura dos JSONs para nomenclatura interna
 */
const BAND_MAPPING = {
  'sub': 'sub',
  'low_bass': 'bass',
  'upper_bass': 'bass',
  'low_mid': 'lowMid',
  'mid': 'mid',
  'high_mid': 'highMid',
  'brilho': 'brilho',
  'presenca': 'presenca'
};

/**
 * 📥 CARREGA TARGETS DE GÊNERO DO FILESYSTEM
 * 
 * @param {string} genre - Nome do gênero (ex: 'funk_mandela', 'trance')
 * @returns {Object|null} - Targets convertidos para formato interno ou null se falhar
 * 
 * Comportamento:
 * 1. Normaliza nome do gênero
 * 2. Verifica cache
 * 3. Tenta carregar JSON do filesystem
 * 4. Valida estrutura
 * 5. Converte para formato interno
 * 6. Cacheia resultado
 * 7. Retorna null em caso de erro (usar fallback hardcoded)
 */
export function loadGenreTargets(genre) {
  console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[TARGET-LOADER] ENTRADA DA FUNÇÃO loadGenreTargets');
  console.log('[TARGET-LOADER] genre recebido:', genre);
  console.log('[TARGET-LOADER] tipo:', typeof genre);
  console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Normalizar nome do gênero
  const normalizedGenre = normalizeGenreName(genre);
  
  console.log('[TARGET-LOADER] normalizedGenre:', normalizedGenre);
  
  // Se não houver gênero válido, retornar null (usar fallback)
  if (!normalizedGenre || normalizedGenre === 'default' || normalizedGenre === 'unknown') {
    console.log(`[TARGETS] Gênero inválido ou default: "${genre}" - usando fallback hardcoded`);
    return null;
  }
  
  // Verificar cache
  if (targetsCache.has(normalizedGenre)) {
    console.log(`[TARGETS] ✅ Cache hit: ${normalizedGenre}`);
    return targetsCache.get(normalizedGenre);
  }
  
  // Tentar carregar JSON do filesystem
  const jsonPath = path.resolve(
    __dirname, 
    '../../../../public/refs/out', 
    `${normalizedGenre}.json`
  );
  
  console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[TARGET-LOADER] PATH CONSTRUÍDO:');
  console.log('[TARGET-LOADER] __dirname:', __dirname);
  console.log('[TARGET-LOADER] jsonPath:', jsonPath);
  console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Verificar se arquivo existe
    const fileExists = fs.existsSync(jsonPath);
    console.log('[TARGET-LOADER] fs.existsSync:', fileExists);
    
    if (!fileExists) {
      console.warn(`[TARGETS] ⚠️ File not found: ${jsonPath}`);
      console.warn(`[TARGETS] ⚠️ Usando fallback hardcoded`);
      return null;
    }
    
    // Ler e parsear JSON
    console.log('[TARGET-LOADER] Lendo arquivo...');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    console.log('[TARGET-LOADER] Arquivo lido, parseando JSON...');
    const parsed = JSON.parse(rawData);
    console.log('[TARGET-LOADER] JSON parseado com sucesso');
    console.log('[TARGET-LOADER] Top-level keys:', Object.keys(parsed));
    
    // Extrair targets do primeiro nível (formato: { "funk_mandela": { ... } })
    const rawTargets = parsed[normalizedGenre] || parsed;
    
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[TARGET-LOADER] EXTRAÇÃO DE TARGETS:');
    console.log('[TARGET-LOADER] normalizedGenre:', normalizedGenre);
    console.log('[TARGET-LOADER] parsed[normalizedGenre] existe?', !!parsed[normalizedGenre]);
    console.log('[TARGET-LOADER] rawTargets keys:', Object.keys(rawTargets || {}));
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Validar estrutura mínima
    if (!validateTargetsStructure(rawTargets)) {
      console.error(`[TARGETS] ❌ Invalid structure in ${normalizedGenre}.json - using fallback`);
      return null;
    }
    
    // Converter para formato interno
    const convertedTargets = convertToInternalFormat(rawTargets, normalizedGenre);
    
    // Validar targets convertidos
    if (!convertedTargets || Object.keys(convertedTargets).length === 0) {
      console.error(`[TARGETS] ❌ Conversion failed for ${normalizedGenre} - using fallback`);
      return null;
    }
    
    // Cachear resultado
    targetsCache.set(normalizedGenre, convertedTargets);
    
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[TARGET-LOADER] SUCESSO - TARGETS CONVERTIDOS:');
    console.log(`[TARGETS] ✅ Loaded from filesystem: ${normalizedGenre}`);
    console.log(`[TARGETS] 📊 Métricas carregadas:`, Object.keys(convertedTargets));
    console.log('[TARGET-LOADER] convertedTargets.lufs:', convertedTargets.lufs);
    console.log('[TARGET-LOADER] convertedTargets.dr:', convertedTargets.dr);
    console.log('[TARGET-LOADER] convertedTargets.truePeak:', convertedTargets.truePeak);
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return convertedTargets;
    
  } catch (error) {
    console.error(`[TARGETS] ❌ Erro ao carregar ${normalizedGenre}:`, error.message);
    console.error(`[TARGETS] Stack:`, error.stack);
    return null;
  }
}

/**
 * 🔍 VALIDA ESTRUTURA MÍNIMA DOS TARGETS
 */
function validateTargetsStructure(targets) {
  if (!targets || typeof targets !== 'object') {
    console.error('[TARGETS] Targets não é um objeto válido');
    return false;
  }
  
  // Validar campos obrigatórios
  const requiredFields = ['lufs_target', 'true_peak_target', 'dr_target', 'bands'];
  for (const field of requiredFields) {
    if (targets[field] === undefined) {
      console.error(`[TARGETS] Campo obrigatório ausente: ${field}`);
      return false;
    }
  }
  
  // Validar que bands é um objeto
  if (!targets.bands || typeof targets.bands !== 'object') {
    console.error('[TARGETS] Campo "bands" não é um objeto válido');
    return false;
  }
  
  // Validar que há pelo menos uma banda
  const bandsCount = Object.keys(targets.bands).length;
  if (bandsCount === 0) {
    console.error('[TARGETS] Nenhuma banda espectral encontrada');
    return false;
  }
  
  console.log(`[TARGETS] ✅ Estrutura válida: ${bandsCount} bandas encontradas`);
  return true;
}

/**
 * 🔄 CONVERTE TARGETS DO JSON PARA FORMATO INTERNO
 * 
 * Formato JSON (entrada):
 * {
 *   lufs_target: -9,
 *   tol_lufs: 2.5,
 *   true_peak_target: -1,
 *   tol_true_peak: 1,
 *   bands: {
 *     sub: { target_db: -28, tol_db: 6 }
 *   }
 * }
 * 
 * Formato interno (saída):
 * {
 *   lufs: { target: -9, tolerance: 2.5, critical: 3.75 },
 *   truePeak: { target: -1, tolerance: 1, critical: 1.5 },
 *   sub: { target: -28, tolerance: 6, critical: 9 }
 * }
 */
function convertToInternalFormat(rawTargets, genre) {
  const converted = {};
  
  try {
    // 🎵 LUFS
    if (isFiniteNumber(rawTargets.lufs_target)) {
      const tolerance = isFiniteNumber(rawTargets.tol_lufs) ? rawTargets.tol_lufs : 2.5;
      converted.lufs = {
        target: rawTargets.lufs_target,
        tolerance: tolerance,
        critical: tolerance * 1.5
      };
    }
    
    // 🔊 TRUE PEAK
    if (isFiniteNumber(rawTargets.true_peak_target)) {
      const tolerance = isFiniteNumber(rawTargets.tol_true_peak) ? rawTargets.tol_true_peak : 1.0;
      converted.truePeak = {
        target: rawTargets.true_peak_target,
        tolerance: tolerance,
        critical: tolerance * 1.5
      };
    }
    
    // 📊 DYNAMIC RANGE
    if (isFiniteNumber(rawTargets.dr_target)) {
      const tolerance = isFiniteNumber(rawTargets.tol_dr) ? rawTargets.tol_dr : 3.0;
      converted.dr = {
        target: rawTargets.dr_target,
        tolerance: tolerance,
        critical: tolerance * 1.5
      };
    }
    
    // 🎚️ STEREO CORRELATION
    if (isFiniteNumber(rawTargets.stereo_target)) {
      const tolerance = isFiniteNumber(rawTargets.tol_stereo) ? rawTargets.tol_stereo : 0.25;
      converted.stereo = {
        target: rawTargets.stereo_target,
        tolerance: tolerance,
        critical: tolerance * 1.5
      };
    }
    
    // 🎼 BANDAS ESPECTRAIS
    if (rawTargets.bands && typeof rawTargets.bands === 'object') {
      for (const [bandKey, bandData] of Object.entries(rawTargets.bands)) {
        // Mapear nome da banda
        const internalBandName = BAND_MAPPING[bandKey] || bandKey;
        
        // Validar dados da banda
        if (!bandData || typeof bandData !== 'object') {
          console.warn(`[TARGETS] Banda ${bandKey} tem estrutura inválida - ignorando`);
          continue;
        }
        
        // Extrair target (priorizar target_db, fallback para target_range.min/max)
        let target = null;
        if (isFiniteNumber(bandData.target_db)) {
          target = bandData.target_db;
        } else if (bandData.target_range && 
                   isFiniteNumber(bandData.target_range.min) && 
                   isFiniteNumber(bandData.target_range.max)) {
          // Usar centro do range como target
          target = (bandData.target_range.min + bandData.target_range.max) / 2;
        }
        
        if (target === null) {
          console.warn(`[TARGETS] Banda ${bandKey} sem target válido - ignorando`);
          continue;
        }
        
        // Extrair tolerance
        let tolerance = 3.0; // Fallback padrão
        if (isFiniteNumber(bandData.tol_db)) {
          tolerance = bandData.tol_db;
        } else if (bandData.target_range && 
                   isFiniteNumber(bandData.target_range.min) && 
                   isFiniteNumber(bandData.target_range.max)) {
          // Usar 1/4 da largura do range como tolerance
          const rangeWidth = Math.abs(bandData.target_range.max - bandData.target_range.min);
          tolerance = rangeWidth * 0.25;
        }
        
        // Adicionar banda convertida
        converted[internalBandName] = {
          target: target,
          tolerance: tolerance,
          critical: tolerance * 1.5
        };
      }
    }
    
    // Validar que pelo menos algumas métricas foram convertidas
    if (Object.keys(converted).length === 0) {
      console.error(`[TARGETS] Nenhuma métrica válida foi convertida para ${genre}`);
      return null;
    }
    
    console.log(`[TARGETS] ✅ Conversão concluída: ${Object.keys(converted).length} métricas`);
    return converted;
    
  } catch (error) {
    console.error(`[TARGETS] ❌ Erro na conversão:`, error.message);
    return null;
  }
}

/**
 * 🔧 NORMALIZA NOME DE GÊNERO
 * 
 * Exemplos:
 * - "Funk Mandela" → "funk_mandela"
 * - "funk mandela" → "funk_mandela"
 * - "TRANCE" → "trance"
 * - "Eletrônico" → "eletronico"
 */
function normalizeGenreName(genre) {
  if (!genre || typeof genre !== 'string') {
    return 'default';
  }
  
  return genre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')           // Espaços → underscores
    .replace(/[àáâãä]/g, 'a')       // Acentos
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9_]/g, '');    // Remove caracteres especiais
}

/**
 * 🔢 VALIDA SE É NÚMERO FINITO
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 🗑️ LIMPA CACHE (útil para testes ou reload)
 */
export function clearTargetsCache() {
  const size = targetsCache.size;
  targetsCache.clear();
  console.log(`[TARGETS] 🗑️ Cache cleared (${size} entries removed)`);
}

console.log('🎯 Genre Targets Loader carregado - Sistema de carregamento dinâmico ativo');
