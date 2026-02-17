#!/usr/bin/env node
/**
 * AutoMaster V1 - Perfis de Processamento por Modo
 * 
 * OBJETIVO: Definir parâmetros de comportamento do processamento DSP
 *           SEM ALTERAR os targets técnicos do gênero.
 * 
 * PRINCÍPIO FUNDAMENTAL:
 *   - GÊNERO define ONDE chegar (targets: LUFS, TP, DR)
 *   - MODO define COMO chegar (limiter, saturação, EQ)
 * 
 * Exemplo:
 *   funk_bruxaria tem target -9.2 LUFS
 *   → Streaming mode: chega em -9.2 LUFS com processamento suave
 *   → Impact mode: chega em -9.2 LUFS com processamento intenso
 * 
 * TARGETS NUNCA MUDAM ENTRE MODOS.
 * 
 * Uso:
 *   const { getProcessingProfile } = require('./processing-profiles.cjs');
 *   const profile = getProcessingProfile('STREAMING');
 */

// ============================================================
// PERFIS DE PROCESSAMENTO
// ============================================================

/**
 * Perfil STREAMING: Máxima preservação de dinâmica e naturalidade
 * 
 * Filosofia:
 *   - Prioriza qualidade sobre loudness competitivo
 *   - Limiter muito suave (evita distorção)
 *   - Zero saturação artificial
 *   - EQ mínimo (apenas correção conservadora)
 *   - Ideal para: streaming, álbuns, masterização audiófila
 */
const STREAMING_PROFILE = {
  mode: 'STREAMING',
  description: 'Máxima qualidade e preservação dinâmica',
  
  // Limiter
  limiter: {
    profile: 'soft',           // Attack/release mais lentos
    attack_ms: 20,             // Mais suave (padrão: 5ms)
    release_ms: 150,           // Mais natural (padrão: 50ms)
    knee_db: 2.0,              // Transição mais suave
    lookahead_ms: 5            // Máximo lookahead para evitar distorção
  },
  
  // Saturação (futuro)
  saturation: {
    enabled: false,
    intensity: 0.0,            // Nenhuma saturação
    type: 'none'
  },
  
  // EQ (futuro)
  eq: {
    enabled: false,
    intensity: 0.0,            // Nenhuma correção agressiva
    auto_balance: false
  },
  
  // Compressão multi-banda (futuro)
  multiband: {
    enabled: false,
    ratio: 1.0                 // Sem compressão adicional
  }
};

/**
 * Perfil BALANCED: Equilíbrio entre qualidade e impacto
 * 
 * Filosofia:
 *   - Compromisso entre dinâmica e loudness
 *   - Limiter padrão (nem muito suave, nem agressivo)
 *   - Saturação leve em graves (calor sutil)
 *   - EQ leve para correção de problemas comuns
 *   - Ideal para: uso geral, redes sociais, produtores
 */
const BALANCED_PROFILE = {
  mode: 'BALANCED',
  description: 'Equilíbrio entre qualidade e impacto',
  
  // Limiter
  limiter: {
    profile: 'balanced',
    attack_ms: 5,              // Padrão FFmpeg alimiter
    release_ms: 50,            // Padrão FFmpeg alimiter
    knee_db: 1.0,
    lookahead_ms: 3
  },
  
  // Saturação (futuro)
  saturation: {
    enabled: true,
    intensity: 0.25,           // Leve (sutil calor em graves)
    type: 'tape',              // Simulação de fita analógica
    target_bands: ['sub', 'low_bass']  // Apenas graves
  },
  
  // EQ (futuro)
  eq: {
    enabled: true,
    intensity: 0.3,            // Leve
    auto_balance: true,        // Ajuste automático de balanço espectral
    correction_only: true      // Apenas corrige problemas, não "melhora"
  },
  
  // Compressão multi-banda (futuro)
  multiband: {
    enabled: false,
    ratio: 1.2                 // Leve contenção de picos de banda
  }
};

/**
 * Perfil IMPACT: Máximo impacto e loudness competitivo
 * 
 * Filosofia:
 *   - Prioriza loudness e energia sobre dinâmica
 *   - Limiter agressivo (máxima contenção)
 *   - Saturação moderada (densidade e calor)
 *   - EQ moderado (realce de presença e brilho)
 *   - Ideal para: clubs, competição de loudness, mastering comercial
 * 
 * ATENÇÃO: Mesmo no Impact, targets de LUFS não mudam!
 *          Apenas a FORMA como chegamos neles é mais agressiva.
 */
const IMPACT_PROFILE = {
  mode: 'IMPACT',
  description: 'Máximo impacto e energia',
  
  // Limiter
  limiter: {
    profile: 'aggressive',
    attack_ms: 2,              // Rápido (maior contenção)
    release_ms: 30,            // Mais rápido (menos "pumping")
    knee_db: 0.5,              // Hard knee (transição abrupta)
    lookahead_ms: 1            // Menor lookahead (mais agressivo)
  },
  
  // Saturação (futuro)
  saturation: {
    enabled: true,
    intensity: 0.5,            // Moderada
    type: 'tube',              // Simulação de válvula (mais cor)
    target_bands: ['sub', 'low_bass', 'upper_bass', 'mid']
  },
  
  // EQ (futuro)
  eq: {
    enabled: true,
    intensity: 0.5,            // Moderada
    auto_balance: true,
    correction_only: false,    // Pode realçar características desejáveis
    enhancements: {
      presence_boost_db: 1.5,  // Realce de presença (4-6 kHz)
      air_boost_db: 1.0        // Realce de ar (10-15 kHz)
    }
  },
  
  // Compressão multi-banda (futuro)
  multiband: {
    enabled: true,
    ratio: 1.5,                // Contenção moderada de dinâmica por banda
    target_bands: ['sub', 'low_bass']  // Controle de graves principalmente
  }
};

// ============================================================
// MAPEAMENTO DE PERFIS
// ============================================================

const PROFILES = {
  STREAMING: STREAMING_PROFILE,
  BALANCED: BALANCED_PROFILE,
  IMPACT: IMPACT_PROFILE
};

const VALID_MODES = Object.keys(PROFILES);

// ============================================================
// API PRINCIPAL
// ============================================================

/**
 * Retorna perfil de processamento para um modo específico.
 * 
 * IMPORTANTE: Este perfil NÃO contém targets técnicos (LUFS, TP).
 *             Targets vêm de targets-adapter.cjs (leitura de work/refs/out/).
 * 
 * @param {string} mode - Modo (STREAMING, BALANCED, IMPACT)
 * @returns {Object} Perfil de processamento
 * @throws {Error} Se modo for inválido
 */
function getProcessingProfile(mode) {
  const upperMode = (mode || 'BALANCED').toUpperCase();

  if (!PROFILES[upperMode]) {
    throw new Error(
      `INVALID_MODE: "${mode}". Valores permitidos: ${VALID_MODES.join(', ')}`
    );
  }

  // Retornar cópia profunda para evitar mutações acidentais
  return JSON.parse(JSON.stringify(PROFILES[upperMode]));
}

/**
 * Combina targets de gênero com perfil de processamento.
 * 
 * RESULTADO: Objeto completo para o motor DSP com:
 *   - Targets técnicos (do gênero, imutáveis)
 *   - Parâmetros de comportamento (do modo)
 * 
 * @param {Object} genreTargets - Targets do gênero (de targets-adapter.cjs)
 * @param {string} mode - Modo de processamento
 * @returns {Object} Configuração completa para DSP
 */
function resolveProcessingTargets(genreTargets, mode) {
  const profile = getProcessingProfile(mode);

  return {
    // TARGETS TÉCNICOS (do gênero, NUNCA mudam)
    targets: {
      lufs: genreTargets.targetLufs,      // Vem do JSON do gênero
      true_peak: genreTargets.tpCeiling,  // Vem do adapter (fixo -1.0 no V1)
      tolerances: genreTargets.tolerances
    },
    
    // COMPORTAMENTO DO PROCESSAMENTO (do modo)
    processing: {
      mode: profile.mode,
      description: profile.description,
      limiter: profile.limiter,
      saturation: profile.saturation,
      eq: profile.eq,
      multiband: profile.multiband
    },
    
    // METADADOS
    metadata: {
      genreKey: genreTargets.genreKey,
      source: genreTargets.source,
      profile_version: '1.0.0'
    }
  };
}

/**
 * Valida se modo NÃO alterou targets técnicos.
 * 
 * Uso: Teste de segurança para garantir que profiles não introduzem bugs.
 * 
 * @param {Object} genreTargets - Targets originais do gênero
 * @param {Object} resolved - Resultado de resolveProcessingTargets()
 * @returns {boolean} true se targets estão preservados
 */
function validateTargetsPreserved(genreTargets, resolved) {
  const lufsMatch = resolved.targets.lufs === genreTargets.targetLufs;
  const tpMatch = resolved.targets.true_peak === genreTargets.tpCeiling;

  if (!lufsMatch || !tpMatch) {
    throw new Error(
      `TARGET_MUTATION_DETECTED: Modo alterou targets! ` +
      `LUFS esperado=${genreTargets.targetLufs}, recebido=${resolved.targets.lufs}, ` +
      `TP esperado=${genreTargets.tpCeiling}, recebido=${resolved.targets.true_peak}`
    );
  }

  return true;
}

// ============================================================
// EXPORTAÇÃO
// ============================================================

module.exports = {
  getProcessingProfile,
  resolveProcessingTargets,
  validateTargetsPreserved,
  VALID_MODES,
  PROFILES
};

// ============================================================
// CLI (para testes)
// ============================================================

if (require.main === module) {
  const mode = process.argv[2] || 'BALANCED';

  try {
    const profile = getProcessingProfile(mode);
    console.log(JSON.stringify(profile, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}
