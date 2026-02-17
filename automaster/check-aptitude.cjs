#!/usr/bin/env node
/**
 * AutoMaster V1 - Gate de Aptidão Técnica
 * 
 * OBJETIVO: Determinar se uma faixa está APTA para masterização segura.
 * 
 * Regras (conservadoras):
 *   - Se TPK_in > -1.0 dBTP => NÃO_APTA (risco de clipping)
 *   - Se LUFS_I_in > (targetLUFS + 3.0) => NÃO_APTA (já muito alto)
 *   - Caso contrário => APTA
 * 
 * Uso:
 *   node check-aptitude.cjs <lufs_i> <true_peak_db> <target_lufs>
 * 
 * Saída:
 *   JSON: { isApt, reasons[], recommended_actions[] }
 */

const TP_THRESHOLD = -1.0;     // True Peak máximo aceitável
const LUFS_MARGIN = 3.0;        // Margem acima do target LUFS

// ============================================================
// VALIDAÇÃO DE ENTRADA
// ============================================================

function validateInput() {
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    exitWithError('INVALID_ARGS', 'Uso: node check-aptitude.cjs <lufs_i> <true_peak_db> <target_lufs>');
  }

  const lufs_i = parseFloat(args[0]);
  const true_peak_db = parseFloat(args[1]);
  const target_lufs = parseFloat(args[2]);

  if (isNaN(lufs_i) || isNaN(true_peak_db) || isNaN(target_lufs)) {
    exitWithError('INVALID_PARAMS', 'Todos os parâmetros devem ser números válidos');
  }

  return { lufs_i, true_peak_db, target_lufs };
}

// ============================================================
// LÓGICA DE APTIDÃO
// ============================================================

function checkAptitude(measure, targetLufs) {
  const reasons = [];
  const recommended_actions = [];

  // REGRA 1: True Peak muito alto
  const tpHigh = measure.true_peak_db > TP_THRESHOLD;
  if (tpHigh) {
    reasons.push(`TRUE_PEAK_TOO_HIGH (${measure.true_peak_db} dBTP > ${TP_THRESHOLD} dBTP)`);
    recommended_actions.push('RUN_RESCUE_GAIN_ONLY');
    recommended_actions.push('REUPLOAD_PREMASTER');
  }

  // REGRA 2: LUFS muito acima do target
  const lufsLimit = targetLufs + LUFS_MARGIN;
  const lufsHigh = measure.lufs_i > lufsLimit;
  if (lufsHigh) {
    reasons.push(`LUFS_TOO_HIGH (${measure.lufs_i} LUFS > ${lufsLimit} LUFS)`);
    recommended_actions.push('RUN_RESCUE_GAIN_ONLY');
    recommended_actions.push('REUPLOAD_PREMASTER');
  }

  const isApt = reasons.length === 0;

  return {
    isApt,
    reasons,
    recommended_actions: isApt ? [] : recommended_actions,
    measured: {
      lufs_i: measure.lufs_i,
      true_peak_db: measure.true_peak_db
    },
    thresholds: {
      tp_max: TP_THRESHOLD,
      lufs_max: lufsLimit
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
  const result = {
    error: code,
    message
  };
  
  console.error(JSON.stringify(result));
  process.exit(1);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  try {
    const { lufs_i, true_peak_db, target_lufs } = validateInput();
    
    const result = checkAptitude(
      { lufs_i, true_peak_db },
      target_lufs
    );
    
    outputResult(result);
    process.exit(result.isApt ? 0 : 1);
  } catch (error) {
    exitWithError('APTITUDE_ERROR', error.message);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

// Exportar para uso programático
module.exports = { checkAptitude, TP_THRESHOLD, LUFS_MARGIN };
