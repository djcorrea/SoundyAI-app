/**
 * 🔍 ERROR VISIBILITY SYSTEM - CENTRAL LOGGING
 * Sistema centralizado de logs e alertas para debugging de erros e timeouts
 * Implementado para facilitar identificação de problemas no pipeline
 */

// 📊 Tipos de erro padronizados
export const ERROR_TYPES = {
  TIMEOUT_ABSOLUTE: 'TIMEOUT_ABSOLUTE',     // Frontend timeout de 3 min
  TIMEOUT_ATTEMPTS: 'TIMEOUT_ATTEMPTS',     // Máximo de tentativas atingido
  TIMEOUT_QUEUE: 'TIMEOUT_QUEUE',          // Job ficou muito tempo na fila
  TIMEOUT_WORKER: 'TIMEOUT_WORKER',        // Worker excedeu limite
  TIMEOUT_JOB: 'TIMEOUT_JOB',              // Job individual timeout
  POLLING_ERROR: 'POLLING_ERROR',          // Erro de comunicação com API
  NETWORK_ERROR: 'NETWORK_ERROR',          // Falha de rede/conectividade
  WORKER_UNAVAILABLE: 'WORKER_UNAVAILABLE', // Pool de workers esgotado
  QUEUE_OVERFLOW: 'QUEUE_OVERFLOW',        // Muitos jobs na fila
  PROCESSING_ERROR: 'PROCESSING_ERROR'      // Erro durante processamento
};

// 🎯 Severidade dos erros
export const ERROR_SEVERITY = {
  CRITICAL: 'CRITICAL',   // Sistema não funciona
  HIGH: 'HIGH',          // Funcionalidade comprometida
  MEDIUM: 'MEDIUM',      // Degradação de performance
  LOW: 'LOW'             // Problema menor/cosmético
};

/**
 * 📝 Logger centralizado com contexto detalhado
 */
export class ErrorVisibilityLogger {
  constructor() {
    this.errorHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * 🚨 Log de erro com contexto completo
   */
  logError(type, severity, message, details = {}) {
    const errorEntry = {
      type,
      severity,
      message,
      details: {
        ...details,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
        url: typeof window !== 'undefined' ? window.location.href : 'N/A'
      },
      id: Date.now() + Math.random()
    };

    // Adicionar ao histórico
    this.errorHistory.unshift(errorEntry);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }

    // Console output formatado
    this._outputToConsole(errorEntry);

    // Salvar em localStorage para debugging
    this._saveToStorage(errorEntry);

    return errorEntry;
  }

  /**
   * ⏱️ Log específico para timeouts
   */
  logTimeout(component, timeoutMs, details = {}) {
    return this.logError(
      ERROR_TYPES.TIMEOUT_ABSOLUTE,
      ERROR_SEVERITY.HIGH,
      `Timeout em ${component} após ${timeoutMs/1000}s`,
      {
        component,
        timeoutMs,
        ...details
      }
    );
  }

  /**
   * 🔍 Output formatado no console
   */
  _outputToConsole(errorEntry) {
    const { type, severity, message, details } = errorEntry;
    
    // Emoji baseado na severidade
    const severityEmoji = {
      [ERROR_SEVERITY.CRITICAL]: '🔥',
      [ERROR_SEVERITY.HIGH]: '🚨',
      [ERROR_SEVERITY.MEDIUM]: '⚠️',
      [ERROR_SEVERITY.LOW]: 'ℹ️'
    };

    const emoji = severityEmoji[severity] || '❓';
    
    console.group(`${emoji} [${type}] ${message}`);
    console.error(`🕒 Timestamp: ${details.timestamp}`);
    console.error(`📊 Severity: ${severity}`);
    
    // Detalhes específicos
    Object.entries(details).forEach(([key, value]) => {
      if (key !== 'timestamp' && key !== 'userAgent' && key !== 'url') {
        console.error(`🔍 ${key}:`, value);
      }
    });
    
    console.groupEnd();
  }

  /**
   * 💾 Salvar em localStorage para debugging
   */
  _saveToStorage(errorEntry) {
    try {
      if (typeof localStorage !== 'undefined') {
        const key = `soundy_error_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify(errorEntry));
        
        // Limpar entradas antigas (manter últimas 20)
        const allKeys = Object.keys(localStorage)
          .filter(k => k.startsWith('soundy_error_'))
          .sort()
          .reverse();
          
        if (allKeys.length > 20) {
          allKeys.slice(20).forEach(k => localStorage.removeItem(k));
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * 📋 Obter histórico de erros
   */
  getErrorHistory() {
    return [...this.errorHistory];
  }

  /**
   * 📊 Estatísticas de erros
   */
  getErrorStats() {
    const stats = {
      total: this.errorHistory.length,
      byType: {},
      bySeverity: {},
      last24h: 0
    };

    const day24hAgo = Date.now() - (24 * 60 * 60 * 1000);

    this.errorHistory.forEach(error => {
      // Por tipo
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      
      // Por severidade
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // Últimas 24h
      if (new Date(error.details.timestamp).getTime() > day24hAgo) {
        stats.last24h++;
      }
    });

    return stats;
  }

  /**
   * 🗑️ Limpar histórico
   */
  clearHistory() {
    this.errorHistory = [];
    
    // Limpar localStorage também
    try {
      if (typeof localStorage !== 'undefined') {
        Object.keys(localStorage)
          .filter(k => k.startsWith('soundy_error_'))
          .forEach(k => localStorage.removeItem(k));
      }
    } catch (e) {
      // Ignore storage errors
    }
  }
}

// 🌐 Instância global
export const globalErrorLogger = new ErrorVisibilityLogger();

/**
 * 🔧 Funções de conveniência para logging rápido
 */
export const logTimeout = (component, timeoutMs, details) => 
  globalErrorLogger.logTimeout(component, timeoutMs, details);

export const logCriticalError = (message, details) => 
  globalErrorLogger.logError(ERROR_TYPES.PROCESSING_ERROR, ERROR_SEVERITY.CRITICAL, message, details);

export const logNetworkError = (message, details) => 
  globalErrorLogger.logError(ERROR_TYPES.NETWORK_ERROR, ERROR_SEVERITY.HIGH, message, details);

export const logWorkerError = (message, details) => 
  globalErrorLogger.logError(ERROR_TYPES.WORKER_UNAVAILABLE, ERROR_SEVERITY.MEDIUM, message, details);

/**
 * 📱 Notificação visual para usuário (opcional)
 */
export function showUserNotification(type, message, duration = 5000) {
  if (typeof document === 'undefined') return;

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 16px;
    background: ${type === 'error' ? '#ff4444' : '#ffa500'};
    color: white;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, duration);
}

export default globalErrorLogger;