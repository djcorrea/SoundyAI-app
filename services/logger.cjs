/**
 * Logger Estruturado
 * 
 * Logger JSON para produção com níveis de log e contexto.
 * Usa pino para performance máxima.
 * 
 * @module services/logger
 */

const pino = require('pino');

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Pretty print local, JSON em produção
const logger = pino({
  level: LOG_LEVEL,
  ...(NODE_ENV === 'development' ? {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  } : {})
});

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Cria child logger com contexto específico
 * 
 * @param {string} service - Nome do serviço
 * @param {object} context - Contexto adicional
 * @returns {Logger}
 */
function createServiceLogger(service, context = {}) {
  return logger.child({ service, ...context });
}

/**
 * Cria child logger para um job específico
 * 
 * @param {string} jobId - ID do job
 * @param {object} context - Contexto adicional
 * @returns {Logger}
 */
function createJobLogger(jobId, context = {}) {
  return logger.child({ jobId, ...context });
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  logger,
  createServiceLogger,
  createJobLogger
};
