// 🎯 GENRE TARGETS LOADER
// Carrega targets de gênero dos arquivos JSON e converte para formato interno
// Mantém compatibilidade total com GENRE_THRESHOLDS como fallback

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🚨 LOG DE INICIALIZAÇÃO DO MÓDULO
console.error('\n\n');
console.error('╔══════════════════════════════════════════════════════════════╗');
console.error('║  🔥 GENRE-TARGETS-LOADER.JS INICIALIZADO                    ║');
console.error('╚══════════════════════════════════════════════════════════════╝');
console.error('[LOADER-INIT] Módulo carregado em:', new Date().toISOString());
console.error('[LOADER-INIT] __dirname:', __dirname);
console.error('[LOADER-INIT] __filename:', __filename);
console.error('\n\n');

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
  console.error('\n\n\n\n\n');
  console.error('╔═══════════════════════════════════════════════════════════╗');
  console.error('║  🎯🎯🎯 LOADGENRETARGETS CHAMADO 🎯🎯🎯                 ║');
  console.error('╚═══════════════════════════════════════════════════════════╝');
  console.error('Genre recebido:', genre);
  console.error('Tipo:', typeof genre);
  console.error('Timestamp:', new Date().toISOString());
  console.error('\n');
  
  // ═════════════════════════════════════════════════════════════════
  // 🔍 AUDITORIA DE PATHS E FILESYSTEM
  // ═════════════════════════════════════════════════════════════════
  console.error("========== [AUDIT-PATH] INICIANDO AUDITORIA DE TARGETS ==========");
  
  console.error("[AUDIT-PATH] __dirname:", __dirname);
  console.error("[AUDIT-PATH] process.cwd():", process.cwd());
  
  try {
    const cwdContents = fs.readdirSync(process.cwd());
    console.error("[AUDIT-PATH] Conteúdo de process.cwd():", cwdContents);
  } catch (e) {
    console.error("[AUDIT-PATH] Erro lendo process.cwd():", e.message);
  }
  
  try {
    const dirnameContents = fs.readdirSync(__dirname);
    console.error("[AUDIT-PATH] Conteúdo de __dirname:", dirnameContents);
  } catch (e) {
    console.error("[AUDIT-PATH] Erro lendo __dirname:", e.message);
  }
  
  // Verificar vários paths possíveis para refs/out (auditoria)
  const possiblePaths = [
    path.join(__dirname, "../../../refs/out"),  // ✅ PATH CORRETO no worker
    path.join(process.cwd(), "work", "refs", "out"),
    path.join(process.cwd(), "refs", "out"),
    path.join(__dirname, "../../../../public/refs/out"),  // Path antigo (público)
    path.join(__dirname, "../../../public/refs/out"),
  ];
  
  console.error("[AUDIT-PATH] Testando paths possíveis para refs/out:");
  for (const testPath of possiblePaths) {
    try {
      const exists = fs.existsSync(testPath);
      console.error(`[AUDIT-PATH] Path: ${testPath}`);
      console.error(`[AUDIT-PATH]   Existe? ${exists}`);
      if (exists) {
        const contents = fs.readdirSync(testPath);
        console.error(`[AUDIT-PATH]   Conteúdo (${contents.length} arquivos):`, contents.slice(0, 10));
      }
    } catch (e) {
      console.error(`[AUDIT-PATH]   Erro: ${e.message}`);
    }
  }
  
  console.error("========== [AUDIT-PATH] FIM DA AUDITORIA ==========");
  console.error('\n\n');
  // ═════════════════════════════════════════════════════════════════
  
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
    // 🎯 CORREÇÃO CRÍTICA: Path correto para work/refs/out no worker
    jsonPath = path.resolve(
      __dirname, 
      '../../../refs/out', 
      `${normalizedGenre}.json`
    );
    
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[TARGET-LOADER] PATH CONSTRUÍDO:');
    console.log('[TARGET-LOADER] __dirname:', __dirname);
    console.log('[TARGET-LOADER] jsonPath:', jsonPath);
    console.log('[TARGET-LOADER] jsonPath ABSOLUTO:', path.resolve(jsonPath));
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🔍 AUDITORIA: Verificar se diretório pai existe
    const parentDir = path.dirname(jsonPath);
    console.log('[AUDIT-PATH] Diretório pai do JSON:', parentDir);
    try {
      const parentExists = fs.existsSync(parentDir);
      console.log('[AUDIT-PATH] Diretório pai existe?', parentExists);
      if (parentExists) {
        const parentContents = fs.readdirSync(parentDir);
        console.log('[AUDIT-PATH] Arquivos no diretório pai:', parentContents.slice(0, 15));
      }
    } catch (e) {
      console.log('[AUDIT-PATH] Erro verificando diretório pai:', e.message);
    }
    
    // Verificar se arquivo existe
    const fileExists = fs.existsSync(jsonPath);
    console.log('[TARGET-LOADER] fs.existsSync:', fileExists);
    console.log('[AUDIT-PATH] Arquivo específico existe?', fileExists);
    console.log('[AUDIT-PATH] Procurando por:', `${normalizedGenre}.json`);
    
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
    const fileSize = rawData.length;
    console.log('[TARGET-LOADER] Arquivo lido com sucesso!');
    console.log('[AUDIT-PATH] ✅ ARQUIVO JSON LIDO COM SUCESSO');
    console.log('[AUDIT-PATH] Tamanho do arquivo:', fileSize, 'bytes');
    console.log('[AUDIT-PATH] Path usado:', jsonPath);
    
    console.log('[TARGET-LOADER] Parseando JSON...');
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
    
    // 🔍 AUDITORIA: Valores brutos extraídos do JSON
    console.log('[AUDIT-PATH] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT-PATH] VALORES BRUTOS DO JSON:');
    console.log('[AUDIT-PATH] lufs_target:', rawTargets.lufs_target);
    console.log('[AUDIT-PATH] true_peak_target:', rawTargets.true_peak_target);
    console.log('[AUDIT-PATH] dr_target:', rawTargets.dr_target);
    console.log('[AUDIT-PATH] tol_lufs:', rawTargets.tol_lufs);
    console.log('[AUDIT-PATH] tol_true_peak:', rawTargets.tol_true_peak);
    console.log('[AUDIT-PATH] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[TARGET-LOADER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Validar estrutura mínima
    if (!validateTargetsStructure(rawTargets)) {
      console.error(`[TARGETS] ❌ Invalid structure in ${normalizedGenre}.json - tentando fallback hardcoded`);
      return await loadFromHardcodedFallback(normalizedGenre);
    }
    
    // Converter para formato interno
    const convertedTargets = convertToInternalFormat(rawTargets, normalizedGenre);
    
    // 🔍 AUDITORIA: Valores APÓS conversão
    console.log('[AUDIT-PATH] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AUDIT-PATH] VALORES APÓS convertToInternalFormat:');
    console.log('[AUDIT-PATH] convertedTargets.lufs:', convertedTargets.lufs);
    console.log('[AUDIT-PATH] convertedTargets.truePeak:', convertedTargets.truePeak);
    console.log('[AUDIT-PATH] convertedTargets.dr:', convertedTargets.dr);
    console.log('[AUDIT-PATH] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Validar targets convertidos
    if (!convertedTargets || Object.keys(convertedTargets).length === 0) {
      console.error(`[TARGETS] ❌ Conversion failed for ${normalizedGenre} - tentando fallback hardcoded`);
      return await loadFromHardcodedFallback(normalizedGenre);
    }
    
    // Cachear resultado
    targetsCache.set(normalizedGenre, convertedTargets);
    
    // 🚨🚨🚨 LOG SUPER VISÍVEL - SUCESSO 🚨🚨🚨
    console.error('\n\n');
    console.error('╔═══════════════════════════════════════════════════════════╗');
    console.error('║  ✅✅✅ JSON OFICIAL CARREGADO COM SUCESSO ✅✅✅        ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error('[GENRE-LOADER] Arquivo:', normalizedGenre + '.json');
    console.error('[GENRE-LOADER] Path:', jsonPath);
    console.error('[GENRE-LOADER] LUFS carregado:', convertedTargets.lufs?.target);
    console.error('[GENRE-LOADER] TruePeak carregado:', convertedTargets.truePeak?.target);
    console.error('[GENRE-LOADER] DR carregado:', convertedTargets.dr?.target);
    console.error('[GENRE-LOADER] Bands disponíveis:', convertedTargets.bands ? Object.keys(convertedTargets.bands).length : 0);
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error('\n\n');
    
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
 * 🛡️ FALLBACK REMOVIDO - Sistema agora FALHA EXPLICITAMENTE
 * 
 * MUDANÇA CRÍTICA: O fallback para GENRE_THRESHOLDS hardcoded foi REMOVIDO.
 * Se o arquivo JSON não existir, o sistema deve FALHAR com erro claro.
 * 
 * Isso garante que:
 * 1. Nunca usaremos targets desatualizados
 * 2. Problemas de configuração serão detectados imediatamente
 * 3. Não haverá divergência silenciosa entre UI e sugestões
 * 
 * @param {string} normalizedGenre - Nome do gênero normalizado
 * @returns {null} - Sempre retorna null (fallback desabilitado)
 */
async function loadFromHardcodedFallback(normalizedGenre) {
  console.error('\n\n\n\n\n');
  console.error('╔═══════════════════════════════════════════════════════════╗');
  console.error('║  🚨 ERRO CRÍTICO: ARQUIVO JSON NÃO ENCONTRADO 🚨         ║');
  console.error('║  ❌ FALLBACK HARDCODED FOI DESABILITADO ❌               ║');
  console.error('╚═══════════════════════════════════════════════════════════╝');
  console.error('[TARGETS] Genre solicitado:', normalizedGenre);
  console.error('[TARGETS] Arquivo esperado: work/refs/out/' + normalizedGenre + '.json');
  console.error('[TARGETS] ⚠️ O sistema NÃO usará valores hardcoded desatualizados');
  console.error('[TARGETS] ⚠️ Verifique se o arquivo JSON existe e está correto');
  console.error('[TARGETS] ⚠️ Se necessário, execute o script de geração de targets');
  console.error('╚═══════════════════════════════════════════════════════════╝');
  console.error('\n\n\n\n\n');
  
  // 🚨 LOG DE AUDITORIA CRÍTICO: Fallback desabilitado
  console.error('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('[AUDIT] 🚨 FALLBACK HARDCODED DESABILITADO');
  console.error('[AUDIT] Genre:', normalizedGenre);
  console.error('[AUDIT] ❌ Sistema falhou explicitamente');
  console.error('[AUDIT] ✅ Garantido: Nenhum valor hardcoded usado');
  console.error('[AUDIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Retornar null - o sistema upstream deve tratar isso como erro
  return null;
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
  
  let normalized = genre
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
  
  // 🎯 MAPEAMENTO LEGADO → OFICIAL
  // Converte IDs antigos para os novos IDs oficiais
  normalized = normalizeGenreId(normalized);
  
  return normalized;
}

/**
 * 🎯 MAPEAMENTO CENTRALIZADO: IDs LEGADOS → IDs OFICIAIS
 * 
 * Esta função é o ÚNICO ponto de conversão de gêneros legados.
 * Todo o sistema usa os novos IDs após esta normalização.
 * 
 * MAPEAMENTO:
 * - trance → progressive_trance
 * - phonk → rap_drill
 * - funk_automotivo → edm
 * - techno → fullon
 * 
 * @param {string} genreId - ID do gênero (pode ser legado ou novo)
 * @returns {string} - ID oficial normalizado
 */
export function normalizeGenreId(genreId) {
  if (!genreId || typeof genreId !== 'string') {
    return genreId;
  }
  
  // Mapeamento de IDs legados para IDs oficiais
  const LEGACY_TO_OFFICIAL = {
    'trance': 'progressive_trance',
    'phonk': 'rap_drill',
    'funk_automotivo': 'edm',
    'techno': 'fullon'
  };
  
  const normalized = genreId.toLowerCase().trim();
  
  // Se é um ID legado, converter para oficial
  if (LEGACY_TO_OFFICIAL[normalized]) {
    console.log(`[GENRE-NORMALIZE] 🔄 Convertendo legado: "${normalized}" → "${LEGACY_TO_OFFICIAL[normalized]}"`);
    return LEGACY_TO_OFFICIAL[normalized];
  }
  
  // Já é um ID oficial ou outro gênero válido
  return normalized;
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

/**
 * 🎯 LOADGENRETARGETSFROMWORKER - FUNÇÃO SEGURA E DEFINITIVA
 * 
 * Carrega targets EXCLUSIVAMENTE da pasta interna do worker.
 * NUNCA retorna fallback hardcoded.
 * SEMPRE lança erro se arquivo não existir.
 * 
 * @param {string} genre - Nome do gênero (ex: 'funk_mandela', 'trance')
 * @returns {Promise<Object>} - Targets convertidos para formato interno
 * @throws {Error} - Se arquivo não existir ou for inválido
 * 
 * Caminho base: work/refs/out/<genre>.json
 */
export async function loadGenreTargetsFromWorker(genre) {
  console.error('\n');
  console.error('╔═══════════════════════════════════════════════════════════╗');
  console.error('║  🎯 LOADGENRETARGETSFROMWORKER - MODO SEGURO            ║');
  console.error('╚═══════════════════════════════════════════════════════════╝');
  console.error('[TARGETS-WORKER] Genre recebido:', genre);
  console.error('[TARGETS-WORKER] Timestamp:', new Date().toISOString());
  
  // 1. VALIDAR GÊNERO
  if (!genre || typeof genre !== 'string') {
    const error = `[TARGET-ERROR] Gênero inválido: ${genre}`;
    console.error(error);
    throw new Error(error);
  }

  // 🎯 Usar gênero exatamente como recebido (sem normalização ou mapeamento legado)
  const normalizedGenre = genre.trim();
  console.error('[TARGETS-WORKER] Genre exato (sem normalização):', normalizedGenre);

  // 2. VERIFICAR CACHE
  if (targetsCache.has(normalizedGenre)) {
    console.error('[TARGETS-WORKER] ✅ Cache HIT:', normalizedGenre);
    return targetsCache.get(normalizedGenre);
  }
  
  // 3. DETECTAR PATH CORRETO AUTOMATICAMENTE (MULTI-TENTATIVA)
  console.error('[TARGETS-WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('[TARGETS-WORKER] 🔍 INICIANDO DETECÇÃO AUTOMÁTICA DE PATH');
  console.error('[TARGETS-WORKER] process.cwd():', process.cwd());
  console.error('[TARGETS-WORKER] __dirname:', __dirname);
  console.error('[TARGETS-WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Lista de caminhos candidatos (ordem de prioridade)
  const candidatePaths = [
    // 1. Railway: /app/refs/out (root do worker é /app, arquivos copiados diretamente)
    path.resolve(process.cwd(), 'refs', 'out'),
    
    // 2. Local dev: /projeto/work/refs/out (root é pasta do projeto)
    path.resolve(process.cwd(), 'work', 'refs', 'out'),
    
    // 3. Relativo ao __dirname (work/lib/audio/utils -> ../../../refs/out)
    path.resolve(__dirname, '..', '..', '..', 'refs', 'out'),
    
    // 4. Railway alternativo: /app/work/refs/out
    path.resolve('/app', 'work', 'refs', 'out'),
    
    // 5. Railway direto: /app/refs/out
    path.resolve('/app', 'refs', 'out'),
    
    // 6. Caso especial: se cwd já terminar com /work
    path.resolve(process.cwd(), '..', 'work', 'refs', 'out')
  ];
  
  console.error('[TARGETS-WORKER] 🔎 Testando caminhos candidatos:');
  
  let foundPath = null;
  let jsonPath = null;
  
  for (let i = 0; i < candidatePaths.length; i++) {
    const candidatePath = candidatePaths[i];
    const testJsonPath = path.join(candidatePath, `${normalizedGenre}.json`);
    
    console.error(`[TARGETS-WORKER] [${i + 1}/${candidatePaths.length}] Testando:`, candidatePath);
    
    // Verificar se diretório existe
    const dirExists = fs.existsSync(candidatePath);
    console.error(`[TARGETS-WORKER]   → Diretório existe? ${dirExists}`);
    
    if (dirExists) {
      // Listar arquivos no diretório
      try {
        const files = fs.readdirSync(candidatePath);
        console.error(`[TARGETS-WORKER]   → Arquivos encontrados (${files.length}):`, files.slice(0, 5).join(', '));
        
        // Verificar se o JSON específico existe
        if (fs.existsSync(testJsonPath)) {
          console.error(`[TARGETS-WORKER]   → ✅ ARQUIVO ENCONTRADO!`);
          foundPath = candidatePath;
          jsonPath = testJsonPath;
          break;
        } else {
          console.error(`[TARGETS-WORKER]   → ❌ ${normalizedGenre}.json não encontrado neste diretório`);
        }
      } catch (e) {
        console.error(`[TARGETS-WORKER]   → Erro listando diretório:`, e.message);
      }
    } else {
      console.error(`[TARGETS-WORKER]   → ❌ Diretório não existe`);
    }
  }
  
  // 4. VALIDAR SE ENCONTROU O ARQUIVO
  if (!foundPath || !jsonPath) {
    const error = `[TARGET-ERROR] JSON oficial não encontrado para o gênero: ${genre} (${normalizedGenre}). Todos os caminhos testados falharam.`;
    console.error('╔═══════════════════════════════════════════════════════════╗');
    console.error('║  ❌ ERRO CRÍTICO: ARQUIVO NÃO ENCONTRADO                ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error(error);
    console.error('[TARGETS-WORKER] Caminhos testados:');
    candidatePaths.forEach((p, i) => {
      console.error(`  [${i + 1}] ${p}`);
    });
    throw new Error(error);
  }
  
  console.error('╔═══════════════════════════════════════════════════════════╗');
  console.error('║  ✅ PATH ENCONTRADO COM SUCESSO                          ║');
  console.error('╚═══════════════════════════════════════════════════════════╝');
  console.error('[TARGETS-WORKER] 🎯 Path base encontrado:', foundPath);
  console.error('[TARGETS-WORKER] 📄 Arquivo completo:', jsonPath);
  console.error('[TARGETS-WORKER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  
  // 5. LER E PARSEAR JSON
  let rawData, parsed;
  try {
    rawData = fs.readFileSync(jsonPath, 'utf-8');
    parsed = JSON.parse(rawData);
    console.error('[TARGETS-WORKER] ✅ JSON parseado com sucesso');
    console.error('[TARGETS-WORKER] Tamanho:', rawData.length, 'bytes');
  } catch (error) {
    const errorMsg = `[TARGET-ERROR] Erro ao ler/parsear JSON para ${genre}: ${error.message}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  // 6. EXTRAIR DADOS (suportar estruturas aninhadas)
  const genreData = parsed[normalizedGenre] || parsed;
  const rawTargets = genreData.legacy_compatibility || genreData.hybrid_processing || genreData;
  
  console.error('[TARGETS-WORKER] Top-level keys:', Object.keys(rawTargets));
  console.error('[TARGETS-WORKER] lufs_target:', rawTargets.lufs_target);
  console.error('[TARGETS-WORKER] true_peak_target:', rawTargets.true_peak_target);
  console.error('[TARGETS-WORKER] dr_target:', rawTargets.dr_target);
  
  // 7. VALIDAR ESTRUTURA MÍNIMA
  if (!validateTargetsStructure(rawTargets)) {
    const error = `[TARGET-ERROR] Estrutura inválida no JSON de ${genre}`;
    console.error(error);
    throw new Error(error);
  }
  
  // 8. CONVERTER PARA FORMATO INTERNO
  const convertedTargets = convertToInternalFormat(rawTargets, normalizedGenre);
  
  if (!convertedTargets || Object.keys(convertedTargets).length === 0) {
    const error = `[TARGET-ERROR] Conversão falhou para ${genre}`;
    console.error(error);
    throw new Error(error);
  }
  
  // 9. CACHEAR RESULTADO
  targetsCache.set(normalizedGenre, convertedTargets);
  
  // 10. LOG DE SUCESSO
  console.error('╔═══════════════════════════════════════════════════════════╗');
  console.error('║  ✅✅✅ TARGETS CARREGADOS COM SUCESSO ✅✅✅            ║');
  console.error('╚═══════════════════════════════════════════════════════════╝');
  console.error('[TARGETS-WORKER] Genre:', normalizedGenre);
  console.error('[TARGETS-WORKER] Path:', jsonPath);
  console.error('[TARGETS-WORKER] LUFS:', convertedTargets.lufs?.target);
  console.error('[TARGETS-WORKER] TruePeak:', convertedTargets.truePeak?.target);
  console.error('[TARGETS-WORKER] DR:', convertedTargets.dr?.target);
  console.error('[TARGETS-WORKER] Bands:', convertedTargets.bands ? Object.keys(convertedTargets.bands).length : 0);
  console.error('[TARGETS-WORKER] ✅ Targets retornados com garantia de integridade');
  console.error('\n');
  
  return convertedTargets;
}

console.log('🎯 Genre Targets Loader carregado - Sistema de carregamento dinâmico ativo');
