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
 * 4. Se falhar, tenta fallback para GENRE_THRESHOLDS hardcoded
 * 5. Valida estrutura
 * 6. Converte para formato interno
 * 7. Cacheia resultado
 * 8. Retorna null APENAS se tudo falhar
 */
export async function loadGenreTargets(genre) {
  // 🚨🚨🚨 LOG SUPER VISÍVEL - ENTRADA 🚨🚨🚨
  console.error('\n\n');
  console.error('╔═══════════════════════════════════════════════════════════╗');
  console.error('║  🎯 LOADGENRETARGETS CHAMADO                             ║');
  console.error('╚═══════════════════════════════════════════════════════════╝');
  console.error('Genre recebido:', genre);
  console.error('Tipo:', typeof genre);
  console.error('\n');
  
  console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[TARGET-LOADER] ENTRADA DA FUNÇÃO loadGenreTargets');
  console.log('[TARGET-LOADER] genre recebido:', genre);
  console.log('[TARGET-LOADER] tipo:', typeof genre);
  console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Normalizar nome do gênero
  const normalizedGenre = normalizeGenreName(genre);
  
  console.log('[TARGET-LOADER] normalizedGenre:', normalizedGenre);
  
  // Se não houver gênero válido, tentar fallback imediatamente
  if (!normalizedGenre || normalizedGenre === 'default' || normalizedGenre === 'unknown') {
    console.log(`[TARGETS] Gênero inválido ou default: "${genre}" - tentando fallback hardcoded`);
    return await loadFromHardcodedFallback(normalizedGenre);
  }
  
  // Verificar cache
  if (targetsCache.has(normalizedGenre)) {
    console.log(`[TARGETS] ✅ Cache hit: ${normalizedGenre}`);
    
    // 🔍 AUDITORIA LOG 1: Estrutura do cache
    const cachedTargets = targetsCache.get(normalizedGenre);
    console.log('[AUDIT-TARGETS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT-TARGETS] LOG 1: ESTRUTURA DO CACHE');
    console.log('[AUDIT-TARGETS] Genre:', normalizedGenre);
    console.log('[AUDIT-TARGETS] Top-level keys:', Object.keys(cachedTargets));
    console.log('[AUDIT-TARGETS] Tem .bands?', 'bands' in cachedTargets);
    console.log('[AUDIT-TARGETS] Tem .low_bass?', 'low_bass' in cachedTargets);
    console.log('[AUDIT-TARGETS] Tem .sub?', 'sub' in cachedTargets);
    if (cachedTargets.bands) {
      console.log('[AUDIT-TARGETS] cachedTargets.bands keys:', Object.keys(cachedTargets.bands));
      console.log('[AUDIT-TARGETS] cachedTargets.bands.low_bass:', cachedTargets.bands.low_bass);
    }
    if (cachedTargets.low_bass) {
      console.log('[AUDIT-TARGETS] cachedTargets.low_bass (achatado):', cachedTargets.low_bass);
    }
    console.log('[AUDIT-TARGETS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return cachedTargets;
  }
  
  // Tentar carregar JSON do filesystem
  let jsonPath; // Declarar fora do bloco try para acessar no catch
  
  try {
    jsonPath = path.resolve(
      __dirname, 
      '../../../../public/refs/out', 
      `${normalizedGenre}.json`
    );
    
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[TARGET-LOADER] PATH CONSTRUÍDO:');
    console.log('[TARGET-LOADER] __dirname:', __dirname);
    console.log('[TARGET-LOADER] jsonPath:', jsonPath);
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // Verificar se arquivo existe
    const fileExists = fs.existsSync(jsonPath);
    console.log('[TARGET-LOADER] fs.existsSync:', fileExists);
    
    if (!fileExists) {
      console.warn(`[TARGETS] ⚠️ File not found: ${jsonPath}`);
      console.warn(`[TARGETS] ⚠️ Tentando fallback hardcoded...`);
      console.warn('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.warn('[AUDIT] ⚠️ FALLBACK ACIONADO: Arquivo não existe');
      console.warn('[AUDIT] Genre:', normalizedGenre);
      console.warn('[AUDIT] Path esperado:', jsonPath);
      console.warn('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return await loadFromHardcodedFallback(normalizedGenre);
    }
    
    // Ler e parsear JSON
    console.log('[TARGET-LOADER] Lendo arquivo...');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    console.log('[TARGET-LOADER] Arquivo lido, parseando JSON...');
    const parsed = JSON.parse(rawData);
    console.log('[TARGET-LOADER] JSON parseado com sucesso');
    console.log('[TARGET-LOADER] Top-level keys:', Object.keys(parsed));
    
    // Extrair targets do primeiro nível (formato: { "funk_mandela": { ... } })
    const genreData = parsed[normalizedGenre] || parsed;
    console.log('[TARGET-LOADER] genreData keys:', Object.keys(genreData || {}));
    
    // 🎯 PRIORIZAR legacy_compatibility → hybrid_processing → objeto direto
    const rawTargets = genreData.legacy_compatibility || genreData.hybrid_processing || genreData;
    const blockUsed = genreData.legacy_compatibility ? 'legacy_compatibility' : 
                      genreData.hybrid_processing ? 'hybrid_processing' : 
                      'direct_object';
    
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[TARGET-LOADER] EXTRAÇÃO DE TARGETS:');
    console.log('[TARGET-LOADER] normalizedGenre:', normalizedGenre);
    console.log('[TARGET-LOADER] parsed[normalizedGenre] existe?', !!parsed[normalizedGenre]);
    console.log('[TARGET-LOADER] 🎯 BLOCO USADO:', blockUsed);
    console.log('[TARGET-LOADER] rawTargets keys:', Object.keys(rawTargets || {}));
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Validar estrutura mínima
    if (!validateTargetsStructure(rawTargets)) {
      console.error(`[TARGETS] ❌ Invalid structure in ${normalizedGenre}.json - tentando fallback hardcoded`);
      return await loadFromHardcodedFallback(normalizedGenre);
    }
    
    // Converter para formato interno
    const convertedTargets = convertToInternalFormat(rawTargets, normalizedGenre);
    
    // Validar targets convertidos
    if (!convertedTargets || Object.keys(convertedTargets).length === 0) {
      console.error(`[TARGETS] ❌ Conversion failed for ${normalizedGenre} - tentando fallback hardcoded`);
      return await loadFromHardcodedFallback(normalizedGenre);
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
    
    // 🎯 LOG DE AUDITORIA: Confirmar que JSON oficial foi usado
    console.log('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT] ✅ JSON OFICIAL USADO');
    console.log('[AUDIT] Arquivo:', jsonPath);
    console.log('[AUDIT] Genre:', normalizedGenre);
    console.log('[AUDIT] LUFS oficial:', convertedTargets.lufs?.target);
    console.log('[AUDIT] TruePeak oficial:', convertedTargets.truePeak?.target);
    console.log('[AUDIT] DR oficial:', convertedTargets.dr?.target);
    console.log('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🚨🚨 LOG SUPER VISÍVEL - RETORNO 🚨🚨🚨
    console.error('\n');
    console.error('╔═══════════════════════════════════════════════════════════╗');
    console.error('║  ✅ TARGETS CARREGADOS COM SUCESSO                       ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error('Genre:', normalizedGenre);
    console.error('LUFS retornando:', convertedTargets.lufs?.target);
    console.error('TruePeak retornando:', convertedTargets.truePeak?.target);
    console.error('DR retornando:', convertedTargets.dr?.target);
    console.error('Arquivo usado:', jsonPath);
    console.error('\n\n');
    
    return convertedTargets;
    
  } catch (error) {
    console.error(`[TARGETS] ❌ Erro ao carregar ${normalizedGenre}:`, error.message);
    console.error(`[TARGETS] Stack:`, error.stack);
    console.warn(`[TARGETS] Tentando fallback hardcoded...`);
    console.warn('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('[AUDIT] ⚠️ FALLBACK ACIONADO: Erro ao ler arquivo');
    console.warn('[AUDIT] Genre:', normalizedGenre);
    console.warn('[AUDIT] Erro:', error.message);
    console.warn('[AUDIT] Path tentado:', jsonPath);
    console.warn('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return await loadFromHardcodedFallback(normalizedGenre);
  }
}

/**
 * 🛡️ FALLBACK: CARREGA THRESHOLDS HARDCODED
 * 
 * Quando o arquivo JSON não existe ou é inválido, carrega os thresholds
 * hardcoded do arquivo problems-suggestions-v2.js (GENRE_THRESHOLDS).
 * 
 * @param {string} normalizedGenre - Nome do gênero normalizado
 * @returns {Object|null} - Thresholds hardcoded ou null se não existir
 */
async function loadFromHardcodedFallback(normalizedGenre) {
  try {
    console.log(`[TARGETS] 🛡️ Tentando fallback hardcoded para: ${normalizedGenre}`);
    
    // Importar GENRE_THRESHOLDS dinamicamente
    const module = await import('../features/problems-suggestions-v2.js');
    const GENRE_THRESHOLDS = module.GENRE_THRESHOLDS;
    
    if (!GENRE_THRESHOLDS || typeof GENRE_THRESHOLDS !== 'object') {
      console.error('[TARGETS] ❌ GENRE_THRESHOLDS não encontrado no módulo');
      return null;
    }
    
    // Buscar threshold específico do gênero
    let genreThreshold = GENRE_THRESHOLDS[normalizedGenre];
    
    // Se não encontrar, tentar "default"
    if (!genreThreshold) {
      console.warn(`[TARGETS] ⚠️ Gênero ${normalizedGenre} não encontrado em GENRE_THRESHOLDS - usando "default"`);
      genreThreshold = GENRE_THRESHOLDS['default'];
    }
    
    if (!genreThreshold) {
      console.error('[TARGETS] ❌ Nem gênero específico nem "default" encontrado em GENRE_THRESHOLDS');
      return null;
    }
    
    console.log(`[TARGETS] ✅ Fallback hardcoded carregado: ${normalizedGenre}`);
    console.log(`[TARGETS] 📊 Métricas disponíveis:`, Object.keys(genreThreshold));
    
    // 🚨 LOG DE AUDITORIA CRÍTICO: Fallback hardcoded usado
    console.error('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[AUDIT] 🚨 FALLBACK HARDCODED USADO (GENRE_THRESHOLDS)');
    console.error('[AUDIT] Genre:', normalizedGenre);
    console.error('[AUDIT] LUFS fallback:', genreThreshold.lufs?.target);
    console.error('[AUDIT] TruePeak fallback:', genreThreshold.truePeak?.target);
    console.error('[AUDIT] DR fallback:', genreThreshold.dr?.target);
    console.error('[AUDIT] ⚠️ VALORES PODEM DIVERGIR DO JSON OFICIAL!');
    console.error('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🚨🚨🚨 LOG SUPER VISÍVEL - FALLBACK USADO 🚨🚨🚨
    console.error('\n');
    console.error('╔═══════════════════════════════════════════════════════════╗');
    console.error('║  🚨 ATENÇÃO: FALLBACK HARDCODED USADO!                   ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error('Genre:', normalizedGenre);
    console.error('LUFS fallback:', genreThreshold.lufs?.target);
    console.error('TruePeak fallback:', genreThreshold.truePeak?.target);
    console.error('DR fallback:', genreThreshold.dr?.target);
    console.error('⚠️  VALORES PODEM ESTAR DESATUALIZADOS!');
    console.error('\n\n');
    
    // Cachear resultado
    targetsCache.set(normalizedGenre, genreThreshold);
    
    return genreThreshold;
    
  } catch (error) {
    console.error(`[TARGETS] ❌ Erro ao carregar fallback hardcoded:`, error.message);
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
      // 🔧 FASE 3: Criar sub-objeto bands para estrutura padronizada
      converted.bands = converted.bands || {};
      
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
        
        // 🔧 FASE 3: Adicionar banda DENTRO de converted.bands (estrutura padronizada)
        converted.bands[internalBandName] = {
          target: target,
          tolerance: tolerance,
          critical: tolerance * 1.5,
          // PATCH: Preservar target_range e target_db originais quando disponíveis
          target_range: bandData.target_range || null,
          target_db: bandData.target_db || null
        };
      }
    }
    
    // Validar que pelo menos algumas métricas foram convertidas
    if (Object.keys(converted).length === 0) {
      console.error(`[TARGETS] Nenhuma métrica válida foi convertida para ${genre}`);
      return null;
    }
    
    console.log(`[TARGETS] ✅ Conversão concluída: ${Object.keys(converted).length} métricas`);
    
    // 🔍 AUDITORIA LOG 2: Estrutura DEPOIS da conversão
    console.log('[AUDIT-TARGETS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT-TARGETS] LOG 2: ESTRUTURA DEPOIS DE convertToInternalFormat');
    console.log('[AUDIT-TARGETS] Genre:', genre);
    console.log('[AUDIT-TARGETS] Top-level keys:', Object.keys(converted));
    console.log('[AUDIT-TARGETS] Tem .bands?', 'bands' in converted);
    console.log('[AUDIT-TARGETS] Tem .low_bass?', 'low_bass' in converted);
    console.log('[AUDIT-TARGETS] Tem .sub?', 'sub' in converted);
    if (converted.bands) {
      console.log('[AUDIT-TARGETS] converted.bands keys:', Object.keys(converted.bands));
      console.log('[AUDIT-TARGETS] converted.bands.low_bass:', JSON.stringify(converted.bands.low_bass, null, 2));
      console.log('[AUDIT-TARGETS] converted.bands.sub:', JSON.stringify(converted.bands.sub, null, 2));
    }
    if (converted.low_bass) {
      console.log('[AUDIT-TARGETS] converted.low_bass (achatado):', JSON.stringify(converted.low_bass, null, 2));
    }
    if (converted.sub) {
      console.log('[AUDIT-TARGETS] converted.sub (achatado):', JSON.stringify(converted.sub, null, 2));
    }
    console.log('[AUDIT-TARGETS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
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
