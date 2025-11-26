// 🌐 FEATURE FLAGS CENTRAL
// Uso seguro: todos default off para não alterar comportamento legado.
// Prioridade: ENV > window > defaults.

function readEnv(name, def=false) {
  if (typeof process !== 'undefined' && process.env && Object.prototype.hasOwnProperty.call(process.env, name)) {
    const v = process.env[name];
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
  }
  if (typeof window !== 'undefined' && Object.prototype.hasOwnProperty.call(window, name)) {
    const wv = window[name];
    if (wv === true) return true;
    if (wv === false) return false;
  }
  return def;
}

export const FLAGS = {
  AUDIT_MODE: readEnv('AUDIT_MODE', false),
  TP_UPGRADE: readEnv('TP_UPGRADE', false),
  DR_REDEF: readEnv('DR_REDEF', true), // permitir dr_stat por padrão apenas se AUDIT_MODE
  SCORING_V2: readEnv('SCORING_V2', true),
  SCORING_COLOR_RATIO_V2: readEnv('SCORING_COLOR_RATIO_V2', true),
  BAND_NORM: readEnv('BAND_NORM', true),
  DC_HPF20: readEnv('DC_HPF20', true),
  INVARIANTS_CHECK: readEnv('INVARIANTS_CHECK', true)
};

// Gate secundário: se não estiver em AUDIT_MODE, desliga upgrades para proteger legado
if (!FLAGS.AUDIT_MODE) {
  FLAGS.TP_UPGRADE = false;
  FLAGS.DR_REDEF = false;
  FLAGS.SCORING_V2 = false;
  FLAGS.BAND_NORM = false;
  FLAGS.DC_HPF20 = false;
  FLAGS.INVARIANTS_CHECK = false;
  // NÃO desativar SCORING_COLOR_RATIO_V2: método deve valer também fora de AUDIT_MODE
}

export default FLAGS;
