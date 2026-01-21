// CAIAR Logger Utility
// Flag global: CAIAR_ENABLED (default false). Não altera UI; apenas logging detalhado.
// Ativação:
//  window.CAIAR_ENABLED = true;  (browser)
//  ou variável de ambiente CAIAR_ENABLED=1 (node)
// Escopo do logging: entrada -> métricas -> sugestões -> score -> saída final.

function _isEnabled() {
  try {
    if (typeof window !== 'undefined') {
      if (typeof window.CAIAR_ENABLED === 'undefined') window.CAIAR_ENABLED = false; // default
      return !!window.CAIAR_ENABLED;
    }
    if (typeof process !== 'undefined' && process.env) return process.env.CAIAR_ENABLED === '1';
  } catch {}
  return false;
}

export function caiarIsEnabled() { return _isEnabled(); }

export function caiarLog(stage, message, data) {
  if (!_isEnabled()) return;
  const ts = (typeof performance !== 'undefined' && performance.now) ? performance.now().toFixed(1) + 'ms' : new Date().toISOString();
  if (data !== undefined) console.log(`[CAIAR][${ts}] ${stage} :: ${message}`, data);
  else console.log(`[CAIAR][${ts}] ${stage} :: ${message}`);
}

export function caiarGroup(stage, message, fn) {
  if (!_isEnabled()) return fn && fn();
  const ts = (typeof performance !== 'undefined' && performance.now) ? performance.now().toFixed(1) + 'ms' : new Date().toISOString();
  try { console.group(`[CAIAR][${ts}] ${stage} :: ${message}`); } catch {}
  try { fn && fn(); } finally { try { console.groupEnd(); } catch {} }
}

// Expor helper global opcional para módulos que não importam explicitamente
try {
  if (typeof window !== 'undefined') {
    window.__caiarLog = (stage, msg, data) => caiarLog(stage, msg, data);
    window.__caiarGroup = (stage, msg, fn) => caiarGroup(stage, msg, fn);
  }
} catch {}

export default { caiarIsEnabled, caiarLog, caiarGroup };
