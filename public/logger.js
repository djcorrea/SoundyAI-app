/**
 * Sistema Centralizado de Controle de Logs - SoundyAI
 * 
 * OBJETIVO: Controlar todos os logs do sistema com uma única flag DEBUG
 * - Em produção (DEBUG = false): Nenhum log aparece no DevTools
 * - Em desenvolvimento (DEBUG = true): Todos os logs funcionam normalmente
 * 
 * IMPORTANTE: NÃO modificar este arquivo sem autorização
 */

// ===========================
// FLAG GLOBAL DE DEBUG
// ===========================
// Altere para true para ativar logs no ambiente de desenvolvimento
const DEBUG = false;

/**
 * Log padrão (informações gerais)
 * Substitui: console.log()
 */
function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

/**
 * Log de aviso (warnings não críticos)
 * Substitui: console.warn()
 */
function warn(...args) {
  if (DEBUG) {
    console.warn(...args);
  }
}

/**
 * Log de erro (erros e exceções)
 * Substitui: console.error()
 */
function error(...args) {
  if (DEBUG) {
    console.error(...args);
  }
}

/**
 * Log de informação (alias para log)
 * Para manter compatibilidade com código existente
 */
function info(...args) {
  if (DEBUG) {
    console.info(...args);
  }
}

/**
 * Log de debug (informações técnicas detalhadas)
 * Para manter compatibilidade com código existente
 */
function debug(...args) {
  if (DEBUG) {
    console.debug(...args);
  }
}

// ===========================
// EXPORTAÇÕES
// ===========================
// Para uso em módulos ES6
if (typeof window !== 'undefined') {
  window.logger = {
    log,
    warn,
    error,
    info,
    debug,
    DEBUG  // Exporta a flag para verificação externa
  };
}

// Para uso em Node.js ou módulos CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    log,
    warn,
    error,
    info,
    debug,
    DEBUG
  };
}

// Exportação padrão para ES6 modules
export { log, warn, error, info, debug, DEBUG };
