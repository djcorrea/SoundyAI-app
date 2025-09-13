/**
 * 🔄 CACHE INVALIDATION SYSTEM - INTELLIGENT CACHE MANAGEMENT
 * Sistema inteligente para invalidar cache quando detectados resultados inconsistentes
 * Evita que dados corrompidos/incompletos sejam persistidos
 */

import { globalErrorLogger, ERROR_TYPES, ERROR_SEVERITY } from './error-visibility-system.js';

// 📊 Métricas essenciais que devem estar presentes
const REQUIRED_METRICS = [
  'peak', 'rms', 'lufsIntegrated', 'dynamicRange', 
  'stereoWidth', 'crestFactor', 'spectralCentroid', 'spectralBalance'
];

// 🔍 Configurações de validação
const VALIDATION_CONFIG = {
  minScore: 0,
  maxScore: 10,
  minDuration: 0.1,
  maxDuration: 3600, // 1 hora
  requiredProperties: ['score', 'analysis', 'metadata'],
  requiredAnalysisProps: ['lufs', 'dynamics', 'frequency', 'spatial']
};

/**
 * 🧩 Sistema de invalidação inteligente de cache
 */
export class IntelligentCacheInvalidator {
  constructor() {
    this.invalidationHistory = [];
    this.validationStats = {
      total: 0,
      valid: 0,
      invalid: 0,
      cached: 0,
      fresh: 0
    };
  }

  /**
   * 🔍 Valida se dados de análise estão completos e consistentes
   */
  validateAnalysisData(data, source = 'unknown') {
    this.validationStats.total++;
    
    const validation = {
      isValid: true,
      issues: [],
      source: source,
      timestamp: new Date().toISOString(),
      data: this._sanitizeDataForLog(data)
    };

    try {
      // 1. Verificar estrutura básica
      if (!data || typeof data !== 'object') {
        validation.isValid = false;
        validation.issues.push('Data is null, undefined or not an object');
        return validation;
      }

      // 2. Verificar propriedades principais
      VALIDATION_CONFIG.requiredProperties.forEach(prop => {
        if (!data.hasOwnProperty(prop)) {
          validation.isValid = false;
          validation.issues.push(`Missing required property: ${prop}`);
        }
      });

      // 3. Verificar score válido
      if (data.score !== undefined) {
        const score = parseFloat(data.score);
        if (isNaN(score) || score < VALIDATION_CONFIG.minScore || score > VALIDATION_CONFIG.maxScore) {
          validation.isValid = false;
          validation.issues.push(`Invalid score: ${data.score} (must be 0-10)`);
        }
      }

      // 4. Verificar análise detalhada
      if (data.analysis) {
        const missingMetrics = REQUIRED_METRICS.filter(metric => {
          return !this._hasValidMetric(data.analysis, metric);
        });

        if (missingMetrics.length > 0) {
          validation.isValid = false;
          validation.issues.push(`Missing metrics: ${missingMetrics.join(', ')}`);
        }

        // Verificar propriedades de análise
        VALIDATION_CONFIG.requiredAnalysisProps.forEach(prop => {
          if (!data.analysis.hasOwnProperty(prop)) {
            validation.isValid = false;
            validation.issues.push(`Missing analysis property: ${prop}`);
          }
        });
      }

      // 5. Verificar metadata
      if (data.metadata) {
        if (data.metadata.duration) {
          const duration = parseFloat(data.metadata.duration);
          if (isNaN(duration) || duration < VALIDATION_CONFIG.minDuration || duration > VALIDATION_CONFIG.maxDuration) {
            validation.isValid = false;
            validation.issues.push(`Invalid duration: ${data.metadata.duration}`);
          }
        }
      }

    } catch (error) {
      validation.isValid = false;
      validation.issues.push(`Validation error: ${error.message}`);
    }

    // Atualizar estatísticas
    if (validation.isValid) {
      this.validationStats.valid++;
    } else {
      this.validationStats.invalid++;
    }

    return validation;
  }

  /**
   * 🗑️ Invalida cache quando dados são inconsistentes
   */
  invalidateInconsistentCache(data, jobId, reason = 'Data inconsistency detected') {
    const invalidationRecord = {
      jobId: jobId,
      reason: reason,
      timestamp: new Date().toISOString(),
      dataIssues: this.validateAnalysisData(data, 'cache-invalidation').issues,
      cachesCleared: []
    };

    // 1. Limpar cache de referências
    if (typeof window !== 'undefined' && window.__refDataCache) {
      Object.keys(window.__refDataCache).forEach(key => {
        delete window.__refDataCache[key];
      });
      invalidationRecord.cachesCleared.push('__refDataCache');
    }

    // 2. Limpar localStorage relacionado ao job
    if (typeof localStorage !== 'undefined') {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes(jobId) || key.includes('analysis') || key.includes('audio'))) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          invalidationRecord.cachesCleared.push(`localStorage:${key}`);
        });
      } catch (e) {
        // Ignore storage errors
      }
    }

    // 3. Limpar cache de análise global
    if (typeof window !== 'undefined') {
      const globalCacheVars = [
        '__AUDIO_ANALYSIS_CACHE__',
        '__refCache',
        '__audioCache',
        '__stemsCache',
        '__metricsCache'
      ];

      globalCacheVars.forEach(varName => {
        if (window[varName]) {
          if (typeof window[varName] === 'object') {
            Object.keys(window[varName]).forEach(key => delete window[varName][key]);
          } else {
            delete window[varName];
          }
          invalidationRecord.cachesCleared.push(varName);
        }
      });
    }

    // 4. Forçar bypass de cache para próximas requisições
    if (typeof window !== 'undefined') {
      window.REFS_BYPASS_CACHE = true;
      window.FORCE_FRESH_ANALYSIS = true;
      
      // Reset após 30 segundos
      setTimeout(() => {
        window.REFS_BYPASS_CACHE = false;
        window.FORCE_FRESH_ANALYSIS = false;
      }, 30000);
    }

    // 5. Log detalhado
    globalErrorLogger.logError(
      ERROR_TYPES.PROCESSING_ERROR,
      ERROR_SEVERITY.MEDIUM,
      `Cache invalidated: ${reason}`,
      {
        jobId: jobId,
        cachesCleared: invalidationRecord.cachesCleared.length,
        dataIssues: invalidationRecord.dataIssues.length,
        bypassEnabled: true
      }
    );

    console.warn('🗑️ CACHE INVALIDATION:', invalidationRecord);
    console.warn(`💥 Invalidated ${invalidationRecord.cachesCleared.length} caches for job ${jobId}`);
    console.warn('🔄 Forcing fresh analysis for next requests...');

    // Salvar no histórico
    this.invalidationHistory.push(invalidationRecord);
    if (this.invalidationHistory.length > 50) {
      this.invalidationHistory.shift();
    }

    return invalidationRecord;
  }

  /**
   * 🔧 Verifica se métrica tem valor válido
   */
  _hasValidMetric(analysis, metricName) {
    // Buscar métrica em diferentes locais da análise
    const locations = [
      analysis[metricName],
      analysis.lufs?.[metricName],
      analysis.dynamics?.[metricName], 
      analysis.frequency?.[metricName],
      analysis.spatial?.[metricName]
    ];

    return locations.some(value => {
      return value !== undefined && 
             value !== null && 
             !isNaN(parseFloat(value)) && 
             isFinite(value);
    });
  }

  /**
   * 🧹 Sanitiza dados para log (remove informações sensíveis)
   */
  _sanitizeDataForLog(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = {
      hasScore: data.score !== undefined,
      hasAnalysis: !!data.analysis,
      hasMetadata: !!data.metadata,
      scoreValue: data.score,
      analysisKeys: data.analysis ? Object.keys(data.analysis) : [],
      metadataKeys: data.metadata ? Object.keys(data.metadata) : []
    };

    return sanitized;
  }

  /**
   * 📊 Obtém estatísticas de validação
   */
  getValidationStats() {
    return {
      ...this.validationStats,
      successRate: this.validationStats.total > 0 ? 
        (this.validationStats.valid / this.validationStats.total * 100).toFixed(1) + '%' : '0%',
      invalidationCount: this.invalidationHistory.length
    };
  }

  /**
   * 📋 Obtém histórico de invalidações
   */
  getInvalidationHistory() {
    return [...this.invalidationHistory];
  }

  /**
   * 🧹 Limpa históricos
   */
  clearHistory() {
    this.invalidationHistory = [];
    this.validationStats = {
      total: 0,
      valid: 0,
      invalid: 0,
      cached: 0,
      fresh: 0
    };
  }
}

// 🌐 Instância global
export const globalCacheInvalidator = new IntelligentCacheInvalidator();

/**
 * 🔧 Funções de conveniência
 */
export const validateAnalysisData = (data, source) => 
  globalCacheInvalidator.validateAnalysisData(data, source);

export const invalidateCache = (data, jobId, reason) => 
  globalCacheInvalidator.invalidateInconsistentCache(data, jobId, reason);

export const isDataValid = (data) => 
  globalCacheInvalidator.validateAnalysisData(data).isValid;

export const forceCleanAnalysis = () => {
  if (typeof window !== 'undefined') {
    window.REFS_BYPASS_CACHE = true;
    window.FORCE_FRESH_ANALYSIS = true;
    return true;
  }
  return false;
};

export default globalCacheInvalidator;