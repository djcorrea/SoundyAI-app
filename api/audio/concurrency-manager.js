// 🎯 FASE 5.5 - GERENCIADOR DE CONCORRÊNCIA
// Sistema de controle de concorrência para pipeline de áudio
// Garante limite de FFTs simultâneos e fila FIFO para processamento controlado

import EventEmitter from 'events';

/**
 * Configurações de concorrência (configuráveis via ENV)
 */
const CONCURRENCY_LIMITS = {
  // Limite de FFTs simultâneos (computacionalmente pesado)
  MAX_FFT_WORKERS: parseInt(process.env.SOUNDY_MAX_FFT_WORKERS) || 4,
  
  // Limite de stems separation simultâneos (muito pesado) 
  MAX_STEMS_WORKERS: parseInt(process.env.SOUNDY_MAX_STEMS_WORKERS) || 2,
  
  // Timeout para jobs (em ms)
  JOB_TIMEOUT: parseInt(process.env.SOUNDY_JOB_TIMEOUT) || 300000, // 5 minutos
  
  // Enable/disable logging
  ENABLE_LOGGING: process.env.SOUNDY_CONCURRENCY_LOGGING !== 'false'
};

/**
 * Tipos de jobs para diferentes pools
 */
export const JOB_TYPES = {
  FFT_PROCESSING: 'fft_processing',
  STEMS_SEPARATION: 'stems_separation',
  GENERAL: 'general'
};

/**
 * Estados de jobs
 */
const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running', 
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
};

/**
 * Job individual na fila
 */
class Job {
  constructor(id, type, processFn, data, options = {}) {
    this.id = id;
    this.type = type;
    this.processFn = processFn;
    this.data = data;
    this.options = options;
    this.status = JOB_STATUS.QUEUED;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.result = null;
    this.error = null;
    this.timeoutId = null;
  }

  /**
   * Executar o job
   */
  async execute() {
    this.status = JOB_STATUS.RUNNING;
    this.startedAt = Date.now();

    try {
      // Configurar timeout se especificado
      if (this.options.timeout) {
        this.timeoutId = setTimeout(() => {
          this.status = JOB_STATUS.TIMEOUT;
          this.error = new Error(`Job ${this.id} timeout após ${this.options.timeout}ms`);
        }, this.options.timeout);
      }

      // Executar função de processamento
      this.result = await this.processFn(this.data);
      
      if (this.status === JOB_STATUS.TIMEOUT) {
        throw this.error;
      }

      this.status = JOB_STATUS.COMPLETED;
      this.completedAt = Date.now();

      return this.result;

    } catch (error) {
      this.status = JOB_STATUS.FAILED;
      this.error = error;
      this.completedAt = Date.now();
      throw error;

    } finally {
      // Limpar timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
    }
  }

  /**
   * Obter estatísticas do job
   */
  getStats() {
    const now = Date.now();
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      queueTime: this.startedAt ? (this.startedAt - this.createdAt) : (now - this.createdAt),
      runTime: this.completedAt && this.startedAt ? (this.completedAt - this.startedAt) : null,
      totalTime: this.completedAt ? (this.completedAt - this.createdAt) : (now - this.createdAt),
      error: this.error?.message
    };
  }
}

/**
 * Pool de workers para um tipo específico de job
 */
class WorkerPool extends EventEmitter {
  constructor(name, maxWorkers) {
    super();
    this.name = name;
    this.maxWorkers = maxWorkers;
    this.queue = [];
    this.activeJobs = new Map();
    this.completedJobs = [];
    this.isProcessing = false;
  }

  /**
   * Adicionar job à fila
   */
  async addJob(job) {
    this.queue.push(job);
    this._log(`📥 Job ${job.id} adicionado à fila ${this.name} (${this.queue.length} na fila)`);
    
    // Emitir evento
    this.emit('jobQueued', job);
    
    // Iniciar processamento se não estiver rodando
    if (!this.isProcessing) {
      this._processQueue();
    }

    // Aguardar conclusão do job
    return new Promise((resolve, reject) => {
      job._resolve = resolve;
      job._reject = reject;
    });
  }

  /**
   * Processar fila de jobs
   */
  async _processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    this._log(`🚀 Iniciando processamento da fila ${this.name}`);

    while (this.queue.length > 0 || this.activeJobs.size > 0) {
      // Iniciar novos jobs se há slots disponíveis
      while (this.queue.length > 0 && this.activeJobs.size < this.maxWorkers) {
        const job = this.queue.shift();
        this._startJob(job);
      }

      // Aguardar pelo menos um job completar se não há slots
      if (this.activeJobs.size >= this.maxWorkers) {
        await this._waitForJobCompletion();
      }

      // Pequena pausa para evitar loop muito intenso
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
    this._log(`✅ Processamento da fila ${this.name} concluído`);
  }

  /**
   * Iniciar execução de um job
   */
  async _startJob(job) {
    this.activeJobs.set(job.id, job);
    this._log(`⚡ Iniciando job ${job.id} (${this.activeJobs.size}/${this.maxWorkers} workers ativos)`);

    this.emit('jobStarted', job);

    try {
      const result = await job.execute();
      
      this._log(`✅ Job ${job.id} concluído com sucesso`);
      this.emit('jobCompleted', job);
      
      if (job._resolve) {
        job._resolve(result);
      }

    } catch (error) {
      this._log(`❌ Job ${job.id} falhou: ${error.message}`);
      this.emit('jobFailed', job, error);
      
      if (job._reject) {
        job._reject(error);
      }

    } finally {
      // Remover job dos ativos e adicionar ao histórico
      this.activeJobs.delete(job.id);
      this.completedJobs.push(job);

      // Limitar histórico para evitar vazamento de memória
      if (this.completedJobs.length > 100) {
        this.completedJobs.shift();
      }
    }
  }

  /**
   * Aguardar conclusão de pelo menos um job
   */
  async _waitForJobCompletion() {
    return new Promise((resolve) => {
      const onJobDone = () => {
        this.removeListener('jobCompleted', onJobDone);
        this.removeListener('jobFailed', onJobDone);
        resolve();
      };

      this.once('jobCompleted', onJobDone);
      this.once('jobFailed', onJobDone);
    });
  }

  /**
   * Obter estatísticas do pool
   */
  getStats() {
    const activeStats = Array.from(this.activeJobs.values()).map(job => job.getStats());
    const completedStats = this.completedJobs.slice(-10).map(job => job.getStats());

    return {
      name: this.name,
      maxWorkers: this.maxWorkers,
      queueSize: this.queue.length,
      activeJobs: this.activeJobs.size,
      completedJobs: this.completedJobs.length,
      isProcessing: this.isProcessing,
      activeJobStats: activeStats,
      recentCompletedStats: completedStats
    };
  }

  /**
   * Log interno
   */
  _log(message) {
    if (CONCURRENCY_LIMITS.ENABLE_LOGGING) {
      console.log(`[POOL_${this.name}] ${message}`);
    }
  }
}

/**
 * Gerenciador principal de concorrência
 */
class ConcurrencyManager extends EventEmitter {
  constructor() {
    super();
    
    // Criar pools para diferentes tipos de jobs
    this.pools = {
      [JOB_TYPES.FFT_PROCESSING]: new WorkerPool('FFT', CONCURRENCY_LIMITS.MAX_FFT_WORKERS),
      [JOB_TYPES.STEMS_SEPARATION]: new WorkerPool('STEMS', CONCURRENCY_LIMITS.MAX_STEMS_WORKERS),
      [JOB_TYPES.GENERAL]: new WorkerPool('GENERAL', 8) // Pool geral sem limite crítico
    };

    // Contador de jobs para IDs únicos
    this.jobCounter = 0;

    // Repassar eventos dos pools
    Object.values(this.pools).forEach(pool => {
      pool.on('jobQueued', (job) => this.emit('jobQueued', job));
      pool.on('jobStarted', (job) => this.emit('jobStarted', job));
      pool.on('jobCompleted', (job) => this.emit('jobCompleted', job));
      pool.on('jobFailed', (job, error) => this.emit('jobFailed', job, error));
    });

    this._log('🚀 Gerenciador de concorrência inicializado');
    this._log(`📊 Limites: FFT=${CONCURRENCY_LIMITS.MAX_FFT_WORKERS}, STEMS=${CONCURRENCY_LIMITS.MAX_STEMS_WORKERS}`);
  }

  /**
   * Executar job com controle de concorrência
   * @param {string} type - Tipo do job (JOB_TYPES)
   * @param {Function} processFn - Função de processamento
   * @param {*} data - Dados para processar
   * @param {Object} options - Opções do job
   * @returns {Promise} Resultado do processamento
   */
  async executeJob(type, processFn, data, options = {}) {
    // Validar tipo de job
    if (!Object.values(JOB_TYPES).includes(type)) {
      throw new Error(`Tipo de job inválido: ${type}`);
    }

    // Gerar ID único
    const jobId = `${type}_${++this.jobCounter}_${Date.now()}`;

    // Configurar timeout padrão
    const jobOptions = {
      timeout: CONCURRENCY_LIMITS.JOB_TIMEOUT,
      ...options
    };

    // Criar job
    const job = new Job(jobId, type, processFn, data, jobOptions);

    // Obter pool apropriado
    const pool = this.pools[type];
    if (!pool) {
      throw new Error(`Pool não encontrado para tipo: ${type}`);
    }

    this._log(`📝 Job ${jobId} criado para pool ${type}`);

    // Executar job no pool
    return await pool.addJob(job);
  }

  /**
   * Wrapper para jobs de FFT (Fase 5.3)
   */
  async executeFFTJob(processFn, data, options = {}) {
    return await this.executeJob(JOB_TYPES.FFT_PROCESSING, processFn, data, options);
  }

  /**
   * Wrapper para jobs de stems separation (futuro)
   */
  async executeStemsJob(processFn, data, options = {}) {
    return await this.executeJob(JOB_TYPES.STEMS_SEPARATION, processFn, data, options);
  }

  /**
   * Wrapper para jobs gerais
   */
  async executeGeneralJob(processFn, data, options = {}) {
    return await this.executeJob(JOB_TYPES.GENERAL, processFn, data, options);
  }

  /**
   * Obter estatísticas completas
   */
  getStats() {
    const poolStats = {};
    Object.entries(this.pools).forEach(([type, pool]) => {
      poolStats[type] = pool.getStats();
    });

    return {
      limits: CONCURRENCY_LIMITS,
      pools: poolStats,
      totalActiveJobs: Object.values(this.pools).reduce((sum, pool) => sum + pool.activeJobs.size, 0),
      totalQueuedJobs: Object.values(this.pools).reduce((sum, pool) => sum + pool.queue.length, 0)
    };
  }

  /**
   * Aguardar todas as filas ficarem vazias
   */
  async waitForIdle() {
    const checkIdle = () => {
      return Object.values(this.pools).every(pool => 
        pool.queue.length === 0 && pool.activeJobs.size === 0
      );
    };

    if (checkIdle()) {
      return;
    }

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (checkIdle()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Limpar recursos
   */
  shutdown() {
    this._log('🔄 Iniciando shutdown do gerenciador de concorrência...');
    
    Object.values(this.pools).forEach(pool => {
      pool.removeAllListeners();
    });

    this.removeAllListeners();
    this._log('✅ Shutdown concluído');
  }

  /**
   * Log interno
   */
  _log(message) {
    if (CONCURRENCY_LIMITS.ENABLE_LOGGING) {
      console.log(`[CONCURRENCY] ${message}`);
    }
  }
}

// Instância singleton do gerenciador
let concurrencyManager = null;

/**
 * Obter instância do gerenciador de concorrência
 */
export function getConcurrencyManager() {
  if (!concurrencyManager) {
    concurrencyManager = new ConcurrencyManager();
  }
  return concurrencyManager;
}

/**
 * Funções de conveniência para uso direto
 */
export async function executeFFTWithConcurrency(processFn, data, options = {}) {
  const manager = getConcurrencyManager();
  return await manager.executeFFTJob(processFn, data, options);
}

export async function executeStemsWithConcurrency(processFn, data, options = {}) {
  const manager = getConcurrencyManager();
  return await manager.executeStemsJob(processFn, data, options);
}

export async function executeGeneralWithConcurrency(processFn, data, options = {}) {
  const manager = getConcurrencyManager();
  return await manager.executeGeneralJob(processFn, data, options);
}

/**
 * Configurações e constantes exportadas
 */
export { CONCURRENCY_LIMITS };

/**
 * Log de inicialização
 */
console.log('🎯 Fase 5.5 - Gerenciador de Concorrência carregado');
console.log(`📊 Configuração: FFT_WORKERS=${CONCURRENCY_LIMITS.MAX_FFT_WORKERS}, STEMS_WORKERS=${CONCURRENCY_LIMITS.MAX_STEMS_WORKERS}`);

export default {
  getConcurrencyManager,
  executeFFTWithConcurrency,
  executeStemsWithConcurrency,
  executeGeneralWithConcurrency,
  CONCURRENCY_LIMITS
};
