#!/usr/bin/env node
/**
 * AutoMaster V1 - Recomendação de Modo (Educação)
 * 
 * OBJETIVO: Recomendar um modo de masterização baseado em métricas medidas.
 * 
 * Determinístico. Sem IA. Sem promessas de "master humano".
 * Recomendação objetiva e honesta.
 * 
 * Regras:
 *   - Se LUFS muito alto (pouco headroom) → STREAMING (mais conservador)
 *   - Se LUFS moderado com headroom → BALANCED (padrão)
 *   - Se LUFS baixo com muito headroom → BALANCED ou IMPACT
 *   - IMPACT só com headroom suficiente e reconhecimento do risco
 * 
 * Uso CLI:
 *   node recommend-mode.cjs <lufs_i> <true_peak_db> [target_lufs]
 * 
 * Uso Programático:
 *   const { recommendMode } = require('./recommend-mode.cjs');
 *   const rec = recommendMode({ lufs_i: -12.3, true_peak_db: -0.6 }, -11);
 * 
 * Saída:
 *   JSON puro no stdout
 */

// ============================================================
// CONSTANTES
// ============================================================

const TP_CEILING = -1.0;  // dBTP fixo para todos os modos (V1)

// ============================================================
// LÓGICA DE RECOMENDAÇÃO
// ============================================================

/**
 * Recomenda modo baseado em métricas medidas e target do gênero.
 * 
 * @param {Object} measured - Métricas medidas do áudio
 * @param {number} measured.lufs_i - LUFS integrado
 * @param {number} measured.true_peak_db - True Peak em dBTP
 * @param {number} [targetLufs=-11] - Target LUFS do gênero (para referência)
 * @returns {Object} Recomendação
 */
function recommendMode(measured, targetLufs = -11) {
  const { lufs_i, true_peak_db } = measured;
  const reason_codes = [];

  // Calcular headroom disponível
  const headroom = Math.abs(lufs_i - targetLufs);
  const tpHeadroom = Math.abs(true_peak_db - TP_CEILING);

  // ============================================================
  // REGRAS DETERMINÍSTICAS
  // ============================================================

  // Verificar input já muito alto
  const isVeryLoud = lufs_i > (targetLufs + 2);
  const isLoud = lufs_i > (targetLufs);
  const hasLowHeadroom = tpHeadroom < 0.5;
  const hasGoodHeadroom = tpHeadroom >= 2.0;
  const isDynamic = headroom >= 5;

  if (isVeryLoud) reason_codes.push('VERY_LOUD_INPUT');
  if (isLoud) reason_codes.push('LOUD_INPUT');
  if (hasLowHeadroom) reason_codes.push('LOW_HEADROOM');
  if (isDynamic) reason_codes.push('DYNAMIC_MIX');
  if (hasGoodHeadroom) reason_codes.push('GOOD_HEADROOM');

  // Decidir modo
  let recommended_mode;
  let user_copy;

  if (isVeryLoud || hasLowHeadroom) {
    // Input já muito alto ou pouco headroom → conservador
    recommended_mode = 'STREAMING';
    user_copy = 'Seu áudio já está com volume alto. Recomendamos o modo Streaming para preservar a dinâmica e evitar distorção.';
  } else if (isLoud) {
    // Input alto mas com algum headroom → balanceado
    recommended_mode = 'BALANCED';
    user_copy = 'Seu áudio tem volume moderado. O modo Balanced oferece o melhor equilíbrio entre loudness e qualidade.';
  } else if (isDynamic && hasGoodHeadroom) {
    // Input com bastante headroom → BALANCED (padrão seguro)
    // IMPACT é uma opção mas não recomendamos por padrão
    recommended_mode = 'BALANCED';
    user_copy = 'Sua mix tem boa dinâmica e headroom. O modo Balanced é ideal. Você pode escolher Impact para mais densidade, mas pode reduzir dinâmica.';
  } else {
    // Caso padrão → BALANCED
    recommended_mode = 'BALANCED';
    user_copy = 'O modo Balanced é recomendado para sua faixa. Oferece loudness competitivo com preservação de dinâmica.';
  }

  return {
    recommended_mode,
    reason_codes,
    user_copy,
    safe_note: 'Todos os modos aplicam True Peak protegido em -1.0 dBTP. Modos mais altos podem reduzir dinâmica.',
    analysis: {
      lufs_i,
      true_peak_db,
      target_lufs_genre: targetLufs,
      headroom_lufs: parseFloat(headroom.toFixed(1)),
      headroom_tp: parseFloat(tpHeadroom.toFixed(1))
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

  if (args.length < 2) {
    exitWithError('INVALID_ARGS', 'Uso: node recommend-mode.cjs <lufs_i> <true_peak_db> [target_lufs]');
  }

  const lufs_i = parseFloat(args[0]);
  const true_peak_db = parseFloat(args[1]);
  const targetLufs = args[2] ? parseFloat(args[2]) : -11;

  if (isNaN(lufs_i) || isNaN(true_peak_db)) {
    exitWithError('INVALID_PARAMS', 'lufs_i e true_peak_db devem ser números válidos');
  }

  if (args[2] && isNaN(targetLufs)) {
    exitWithError('INVALID_PARAMS', 'target_lufs deve ser um número válido');
  }

  const result = recommendMode({ lufs_i, true_peak_db }, targetLufs);
  outputResult(result);
  process.exit(0);
}

// ============================================================
// EXPORTAÇÃO
// ============================================================

module.exports = { recommendMode };
