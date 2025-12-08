// 🎯 OFFICIAL GENRE TARGETS LOADER
// Carrega targets de gênero DIRETAMENTE dos arquivos JSON SEM ALTERAÇÕES
// Substitui loadGenreTargets() para garantir FONTE ÚNICA em todo o sistema

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache global para evitar leituras repetidas
const officialTargetsCache = new Map();

/**
 * 🎯 CARREGA TARGETS OFICIAIS SEM ALTERAÇÕES
 * 
 * ⚠️ REGRA ABSOLUTA: Esta função NÃO pode:
 * - Alterar valores (target, tolerance, critical)
 * - Renomear campos (lufs_target, true_peak_target)
 * - Restruturar objetos (flat vs nested)
 * - Adicionar campos calculados (critical)
 * - Remover campos originais (target_range, target_db)
 * - Aplicar mapeamentos (BAND_MAPPING)
 * - Usar fallbacks hardcoded
 * 
 * ✅ RETORNA: Objeto exatamente igual ao JSON do arquivo
 * 
 * @param {string} genre - Nome do gênero (ex: 'trance', 'funk_mandela')
 * @returns {Object|null} - Targets oficiais do arquivo ou null se não existir
 */
export async function getOfficialGenreTargets(genre) {
  console.log('[OFFICIAL-TARGETS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[OFFICIAL-TARGETS] FUNÇÃO: getOfficialGenreTargets');
  console.log('[OFFICIAL-TARGETS] Genre solicitado:', genre);
  console.log('[OFFICIAL-TARGETS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Normalizar nome do gênero (apenas lowercase e trim)
  const normalizedGenre = String(genre || '').toLowerCase().trim();
  
  // Validar gênero
  if (!normalizedGenre || normalizedGenre === 'default' || normalizedGenre === 'unknown') {
    console.error(`[OFFICIAL-TARGETS] ❌ Gênero inválido: "${genre}"`);
    return null;
  }
  
  // Verificar cache
  if (officialTargetsCache.has(normalizedGenre)) {
    const cachedTargets = officialTargetsCache.get(normalizedGenre);
    console.log('[OFFICIAL-TARGETS] ✅ Cache hit:', normalizedGenre);
    console.log('[OFFICIAL-TARGETS] Cache contém:', {
      hasLegacyCompatibility: !!cachedTargets?.legacy_compatibility,
      hasHybridProcessing: !!cachedTargets?.hybrid_processing,
      topLevelKeys: Object.keys(cachedTargets || {})
    });
    return cachedTargets;
  }
  
  // Construir path do arquivo JSON
  const jsonPath = path.resolve(
    __dirname, 
    '../../../../public/refs/out', 
    `${normalizedGenre}.json`
  );
  
  console.log('[OFFICIAL-TARGETS] Path construído:', jsonPath);
  
  // Verificar se arquivo existe
  if (!fs.existsSync(jsonPath)) {
    console.error(`[OFFICIAL-TARGETS] ❌ Arquivo não encontrado: ${jsonPath}`);
    return null;
  }
  
  try {
    // Ler arquivo JSON
    const rawContent = fs.readFileSync(jsonPath, 'utf8');
    const jsonData = JSON.parse(rawContent);
    
    console.log('[OFFICIAL-TARGETS] ✅ JSON lido com sucesso');
    console.log('[OFFICIAL-TARGETS] Top-level keys:', Object.keys(jsonData));
    
    // 🔥 CORREÇÃO CRÍTICA: Extrair objeto interno do JSON
    // Estrutura esperada: { "genre_name": { ...targets... } }
    const rootKey = Object.keys(jsonData)[0];
    const officialTargets = jsonData[rootKey];
    
    if (!officialTargets || typeof officialTargets !== 'object') {
      console.error('[OFFICIAL-TARGETS] ❌ Estrutura JSON inválida - não encontrado objeto de gênero');
      return null;
    }
    
    console.log('[OFFICIAL-TARGETS] ✅ Objeto de gênero extraído:', rootKey);
    console.log('[OFFICIAL-TARGETS] Estrutura:', {
      hasVersion: !!officialTargets.version,
      hasLegacyCompatibility: !!officialTargets.legacy_compatibility,
      hasHybridProcessing: !!officialTargets.hybrid_processing,
      hasLufsTarget: officialTargets.legacy_compatibility?.lufs_target !== undefined,
      hasBands: !!officialTargets.legacy_compatibility?.bands
    });
    
    // 🔍 VALIDAÇÃO RIGOROSA: Confirmar presença de legacy_compatibility
    if (!officialTargets.legacy_compatibility) {
      console.error('[OFFICIAL-TARGETS] ⚠️ AVISO: JSON sem legacy_compatibility');
      console.error('[OFFICIAL-TARGETS] Estrutura disponível:', Object.keys(officialTargets));
    }
    
    // 🔥 VALIDAÇÃO FINAL: Confirmar que targets NÃO foram alterados
    const hasOriginalStructure = 
      officialTargets.legacy_compatibility?.lufs_target !== undefined &&
      officialTargets.legacy_compatibility?.bands !== undefined;
    
    if (!hasOriginalStructure) {
      console.error('[OFFICIAL-TARGETS] ❌ FALHA: JSON não contém estrutura esperada');
      return null;
    }
    
    // Cachear targets ORIGINAIS
    officialTargetsCache.set(normalizedGenre, officialTargets);
    
    console.log('[OFFICIAL-TARGETS] ✅ Targets oficiais cacheados');
    console.log('[OFFICIAL-TARGETS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[OFFICIAL-TARGETS] AUDITORIA DE SAÍDA:');
    console.log('[OFFICIAL-TARGETS] Genre:', normalizedGenre);
    console.log('[OFFICIAL-TARGETS] LUFS target:', officialTargets.legacy_compatibility?.lufs_target);
    console.log('[OFFICIAL-TARGETS] True Peak target:', officialTargets.legacy_compatibility?.true_peak_target);
    console.log('[OFFICIAL-TARGETS] DR target:', officialTargets.legacy_compatibility?.dr_target);
    console.log('[OFFICIAL-TARGETS] Bandas disponíveis:', 
      officialTargets.legacy_compatibility?.bands ? Object.keys(officialTargets.legacy_compatibility.bands) : []
    );
    console.log('[OFFICIAL-TARGETS] Banda low_bass:', 
      officialTargets.legacy_compatibility?.bands?.low_bass
    );
    console.log('[OFFICIAL-TARGETS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🔒 RETORNAR TARGETS SEM MODIFICAÇÕES
    return officialTargets;
    
  } catch (error) {
    console.error('[OFFICIAL-TARGETS] ❌ Erro ao processar JSON:', error.message);
    console.error('[OFFICIAL-TARGETS] Stack:', error.stack);
    return null;
  }
}

/**
 * 🔧 LIMPA CACHE DE TARGETS OFICIAIS
 * Útil para forçar recarga em caso de atualização de arquivos
 */
export function clearOfficialTargetsCache() {
  const cacheSize = officialTargetsCache.size;
  officialTargetsCache.clear();
  console.log(`[OFFICIAL-TARGETS] 🗑️ Cache limpo: ${cacheSize} entradas removidas`);
}

/**
 * 🔍 VALIDA SE TARGETS SÃO OFICIAIS (não foram alterados)
 * Compara estrutura contra arquivo original
 */
export async function validateTargetsAreOfficial(targets, genre) {
  const officialTargets = await getOfficialGenreTargets(genre);
  
  if (!officialTargets) {
    console.error('[OFFICIAL-TARGETS] ❌ Validação falhou: targets oficiais não encontrados');
    return false;
  }
  
  // Comparar LUFS
  const officialLufs = officialTargets.legacy_compatibility?.lufs_target;
  const providedLufs = targets?.legacy_compatibility?.lufs_target || 
                       targets?.lufs?.target ||
                       targets?.lufs_target;
  
  if (officialLufs !== providedLufs) {
    console.error('[OFFICIAL-TARGETS] ❌ DIVERGÊNCIA: LUFS oficial:', officialLufs, '| fornecido:', providedLufs);
    return false;
  }
  
  // Comparar True Peak
  const officialTruePeak = officialTargets.legacy_compatibility?.true_peak_target;
  const providedTruePeak = targets?.legacy_compatibility?.true_peak_target ||
                           targets?.truePeak?.target ||
                           targets?.true_peak_target;
  
  if (officialTruePeak !== providedTruePeak) {
    console.error('[OFFICIAL-TARGETS] ❌ DIVERGÊNCIA: True Peak oficial:', officialTruePeak, '| fornecido:', providedTruePeak);
    return false;
  }
  
  console.log('[OFFICIAL-TARGETS] ✅ Validação: targets estão oficiais');
  return true;
}
