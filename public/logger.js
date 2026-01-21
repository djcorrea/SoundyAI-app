/**
 * Sistema Centralizado de Controle de Logs - SoundyAI
 * 
 * OBJETIVO: Controlar todos os logs do sistema com uma única flag DEBUG
 * - Em produção (DEBUG = false): Nenhum log aparece no DevTools
 * - Em desenvolvimento (DEBUG = true): Todos os logs funcionam normalmente
 * 
 * IMPORTANTE: NÃO modificar este arquivo sem autorização
 */

(function() {
  'use strict';
  
  // ===========================
  // FLAG GLOBAL DE DEBUG
  // ===========================
  // Altere para true para ativar logs no ambiente de desenvolvimento
  var DEBUG = true;
  
  /**
   * Log padrão (informações gerais)
   * Substitui: console.log()
   */
  function log() {
    if (DEBUG && console && console.log) {
      console.log.apply(console, arguments);
    }
  }
  
  /**
   * Log de aviso (warnings não críticos)
   * Substitui: console.warn()
   */
  function warn() {
    if (DEBUG && console && console.warn) {
      console.warn.apply(console, arguments);
    }
  }
  
  /**
   * Log de erro (erros e exceções)
   * Substitui: console.error()
   */
  function error() {
    if (DEBUG && console && console.error) {
      console.error.apply(console, arguments);
    }
  }
  
  /**
   * Log de informação (alias para log)
   * Para manter compatibilidade com código existente
   */
  function info() {
    if (DEBUG && console && console.info) {
      console.info.apply(console, arguments);
    }
  }
  
  /**
   * Log de debug (informações técnicas detalhadas)
   * Para manter compatibilidade com código existente
   */
  function debug() {
    if (DEBUG && console && console.debug) {
      console.debug.apply(console, arguments);
    }
  }
  
  // ===========================
  // EXPORTAÇÕES GLOBAIS
  // ===========================
  // Expor no escopo global (window)
  if (typeof window !== 'undefined') {
    window.log = log;
    window.warn = warn;
    window.error = error;
    window.info = info;
    window.debug = debug;
    
    // Também manter objeto logger para compatibilidade
    window.logger = {
      log: log,
      warn: warn,
      error: error,
      info: info,
      debug: debug,
      DEBUG: DEBUG
    };
  }
})();
