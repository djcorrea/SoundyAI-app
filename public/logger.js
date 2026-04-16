/**
 * Sistema Centralizado de Controle de Logs - SoundyAI
 *
 * OBJETIVO: Controlar todos os logs do sistema com uma única flag DEBUG_MODE
 * - Em produção (DEBUG_MODE = false): Nenhum log aparece no DevTools
 * - Em desenvolvimento (DEBUG_MODE = true): Todos os logs funcionam normalmente
 *
 * ── ATIVAR DEBUG VIA NAVEGADOR ──────────────────────────────────────────────
 *   localStorage.setItem("debug", "true");  // ativa
 *   localStorage.setItem("debug", "false"); // desativa
 *   location.reload();                      // recarregar para aplicar
 * ────────────────────────────────────────────────────────────────────────────
 *
 * IMPORTANTE: NÃO modificar este arquivo sem autorização
 */

(function() {
  'use strict';

  // ===========================
  // FLAG GLOBAL DE DEBUG
  // ===========================
  // Pode ser sobrescrita via: window.DEBUG_MODE = true
  // Ou ativada persistentemente via: localStorage.setItem("debug", "true")
  var DEBUG = (
    (typeof localStorage !== 'undefined' && localStorage.getItem('debug') === 'true') ||
    (typeof window !== 'undefined' && window.DEBUG_MODE === true)
  );

  // Expor flag global para que outros scripts possam checar
  if (typeof window !== 'undefined') {
    window.DEBUG_MODE = DEBUG;
  }

  // ===========================
  // HELPERS PÚBLICOS (nova API)
  // ===========================

  /**
   * debug log — substitui console.log()
   * Uso: debugLog('mensagem', dados)
   */
  function debugLog() {
    if (window.DEBUG_MODE && console && console.log) {
      console.log.apply(console, arguments);
    }
  }

  /**
   * debug error — substitui console.error()
   * Uso: debugError('erro', ex)
   */
  function debugError() {
    if (window.DEBUG_MODE && console && console.error) {
      console.error.apply(console, arguments);
    }
  }

  /**
   * debug warn — substitui console.warn()
   * Uso: debugWarn('aviso')
   */
  function debugWarn() {
    if (window.DEBUG_MODE && console && console.warn) {
      console.warn.apply(console, arguments);
    }
  }

  // ===========================
  // ALIASES RETROCOMPATÍVEIS
  // ===========================
  // Mantidos para não quebrar código que usa window.log / window.warn / window.error

  function log() {
    if (window.DEBUG_MODE && console && console.log) {
      console.log.apply(console, arguments);
    }
  }

  function warn() {
    if (window.DEBUG_MODE && console && console.warn) {
      console.warn.apply(console, arguments);
    }
  }

  function error() {
    if (window.DEBUG_MODE && console && console.error) {
      console.error.apply(console, arguments);
    }
  }

  function info() {
    if (window.DEBUG_MODE && console && console.info) {
      console.info.apply(console, arguments);
    }
  }

  function debug() {
    if (window.DEBUG_MODE && console && console.debug) {
      console.debug.apply(console, arguments);
    }
  }

  // ===========================
  // EXPORTAÇÕES GLOBAIS
  // ===========================
  if (typeof window !== 'undefined') {
    // Nova API (solicitada)
    window.debugLog   = debugLog;
    window.debugError = debugError;
    window.debugWarn  = debugWarn;

    // API legada (retrocompatibilidade)
    window.log   = log;
    window.warn  = warn;
    window.error = error;
    window.info  = info;
    window.debug = debug;

    // Objeto logger completo
    window.logger = {
      log:        log,
      warn:       warn,
      error:      error,
      info:       info,
      debug:      debug,
      debugLog:   debugLog,
      debugError: debugError,
      debugWarn:  debugWarn,
      DEBUG:      DEBUG
    };
  }
})();
