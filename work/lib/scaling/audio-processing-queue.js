/**
 * 🎵 AUDIO PROCESSING QUEUE - FASE 1
 * Sistema de fila inteligente para processamento de áudio
 * Previne sobrecarga e melhora performance com múltiplos usuários
 */

// Configurações padrão UNIFICADAS
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_QUEUE_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const DEFAULT_JOB_TIMEOUT = 150 * 1000; // 2.5 minutos UNIFICADO

/**
 * Processador de fila de áudio avançado
 */
class AudioProcessingQueue {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || DEFAULT_MAX_CONCURRENT;
    this.queueTimeout = options.queueTimeout || DEFAULT_QUEUE_TIMEOUT;
    this.defaultJobTimeout = options.jobTimeout || DEFAULT_JOB_TIMEOUT;
    
    this.queue = [];
    this.running = [];
    this.completed = 0;
    this.failed = 0;
    this.nextId = 1;
    
    // Métricas de performance
    this.metrics = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
      queuedJobs: 0,
      runningJobs: 0
    };
    
    console.log('🎵 AudioProcessingQueue inicializada:', {
      maxConcurrent: this.maxConcurrent,
      queueTimeout: this.queueTimeout,
      jobTimeout: this.defaultJobTimeout
    });
  }
  
  /**
   * Adiciona trabalho de áudio à fila
   */
  async add(audioFile, options = {}) {
    return new Promise((resolve, reject) => {
      const job = {
        id: this.nextId++,
        audioFile,
        options,
        resolve,
        reject,
        priority: options.priority || 5,
        timeout: options.timeout || this.defaultJobTimeout,
        label: options.label || `audio-${Date.now()}`,
        enqueuedAt: Date.now(),
        userId: options.userId || 'anonymous'
      };
      
      // Verificar limite de fila por usuário
      const userJobs = this.queue.filter(j => j.userId === job.userId).length;
      if (userJobs >= 3) {
        reject(new Error('Muitos trabalhos na fila para este usuário. Aguarde a conclusão.'));
        return;
      }
      
      this.queue.push(job);
      this.metrics.totalJobs++;
      this.metrics.queuedJobs = this.queue.length;
      
      console.log(`➕ Trabalho adicionado à fila: ${job.label} (ID: ${job.id}, Prioridade: ${job.priority})`);
      
      // Configurar timeout da fila
      setTimeout(() => {
        const stillQueued = this.queue.find(q => q.id === job.id);
        if (stillQueued) {
          this.removeFromQueue(job.id);
          reject(new Error('Timeout na fila - trabalho removido'));
        }
      }, this.queueTimeout);
      
      this.process();
    });
  }
  
  /**
   * Processa próximo trabalho da fila
   */
  async process() {
    if (this.running.length >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    // Ordenar por prioridade (menor número = maior prioridade)
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.enqueuedAt - b.enqueuedAt; // FIFO para mesma prioridade
    });
    
    const job = this.queue.shift();
    this.running.push(job);
    this.metrics.queuedJobs = this.queue.length;
    this.metrics.runningJobs = this.running.length;
    
    const startTime = Date.now();
    console.log(`🔄 Processando: ${job.label} (ID: ${job.id})`);
    
    try {
      // Timeout do trabalho individual
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout no processamento')), job.timeout);
      });
      
      // Processar áudio
      const resultPromise = this.processAudio(job.audioFile, job.options);
      const result = await Promise.race([resultPromise, timeoutPromise]);
      
      // Sucesso
      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      
      console.log(`✅ Concluído: ${job.label} (${processingTime}ms)`);
      job.resolve(result);
      
    } catch (error) {
      // Falha
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      
      console.error(`❌ Falhou: ${job.label} - ${error.message}`);
      job.reject(error);
      
    } finally {
      // Remover da lista de execução
      this.running = this.running.filter(r => r.id !== job.id);
      this.metrics.runningJobs = this.running.length;
      
      // Processar próximo
      this.process();
    }
  }
  
  /**
   * Processa arquivo de áudio (integração com sistema existente)
   */
  async processAudio(audioFile, options = {}) {
    try {
      // Usar sistema de análise existente
      if (window.AudioAnalyzer) {
        const analyzer = new window.AudioAnalyzer();
        return await analyzer.analyzeFile(audioFile, options);
      }
      
      // Fallback para import dinâmico
      const { AudioAnalyzer } = await import('/public/audio-analyzer.js');
      const analyzer = new AudioAnalyzer();
      return await analyzer.analyzeFile(audioFile, options);
      
    } catch (error) {
      console.error('Erro no processamento de áudio:', error);
      throw error;
    }
  }
  
  /**
   * Atualiza métricas de performance
   */
  updateMetrics(success, processingTime) {
    if (success) {
      this.metrics.completedJobs++;
    } else {
      this.metrics.failedJobs++;
    }
    
    // Calcular tempo médio (média móvel)
    const totalCompleted = this.metrics.completedJobs + this.metrics.failedJobs;
    if (totalCompleted === 1) {
      this.metrics.averageProcessingTime = processingTime;
    } else {
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (totalCompleted - 1) + processingTime) / totalCompleted;
    }
  }
  
  /**
   * Remove trabalho da fila
   */
  removeFromQueue(jobId) {
    this.queue = this.queue.filter(job => job.id !== jobId);
    this.metrics.queuedJobs = this.queue.length;
  }
  
  /**
   * Obtém status da fila
   */
  getStatus() {
    return {
      queue: {
        total: this.queue.length,
        byPriority: this.getQueueByPriority()
      },
      running: this.running.length,
      maxConcurrent: this.maxConcurrent,
      metrics: this.metrics,
      capacity: `${this.running.length}/${this.maxConcurrent}`,
      estimatedWaitTime: this.estimateWaitTime()
    };
  }
  
  /**
   * Agrupa fila por prioridade
   */
  getQueueByPriority() {
    const byPriority = {};
    this.queue.forEach(job => {
      byPriority[job.priority] = (byPriority[job.priority] || 0) + 1;
    });
    return byPriority;
  }
  
  /**
   * Estima tempo de espera
   */
  estimateWaitTime() {
    if (this.queue.length === 0) return 0;
    
    const avgTime = this.metrics.averageProcessingTime || 60000; // 1 min padrão
    const queuePosition = this.queue.length;
    const availableSlots = Math.max(this.maxConcurrent - this.running.length, 0);
    
    if (availableSlots > 0) {
      return Math.ceil(avgTime / 1000); // Segundos
    }
    
    const waitingJobs = Math.ceil(queuePosition / this.maxConcurrent);
    return Math.ceil((waitingJobs * avgTime) / 1000); // Segundos
  }
  
  /**
   * Ajusta configurações dinamicamente
   */
  configure(options = {}) {
    if (options.maxConcurrent && options.maxConcurrent >= 1 && options.maxConcurrent <= 4) {
      this.maxConcurrent = options.maxConcurrent;
      console.log(`🔧 Concorrência ajustada para: ${this.maxConcurrent}`);
    }
    
    if (options.jobTimeout && options.jobTimeout > 0) {
      this.defaultJobTimeout = options.jobTimeout;
      console.log(`⏱️ Timeout de trabalho ajustado para: ${this.defaultJobTimeout}ms`);
    }
  }
  
  /**
   * Limpa fila (emergência)
   */
  clear() {
    const queuedCount = this.queue.length;
    this.queue.forEach(job => {
      job.reject(new Error('Fila limpa pelo administrador'));
    });
    this.queue = [];
    this.metrics.queuedJobs = 0;
    
    console.log(`🧹 Fila limpa: ${queuedCount} trabalhos cancelados`);
  }
}

/**
 * Instância global da fila
 */
export const audioQueue = new AudioProcessingQueue();

/**
 * Função helper para adicionar à fila facilmente
 */
export async function processAudioFile(audioFile, options = {}) {
  return audioQueue.add(audioFile, options);
}

/**
 * Configurar fila dinamicamente
 */
export function configureAudioQueue(options) {
  return audioQueue.configure(options);
}

/**
 * Obter status da fila
 */
export function getAudioQueueStatus() {
  return audioQueue.getStatus();
}

// Integração com sistema existente
if (typeof window !== 'undefined') {
  window.audioQueue = audioQueue;
  window.processAudioFile = processAudioFile;
  window.getAudioQueueStatus = getAudioQueueStatus;
  
  // Debug helpers
  window.__AUDIO_QUEUE_STATUS__ = () => audioQueue.getStatus();
  window.__AUDIO_QUEUE_CLEAR__ = () => audioQueue.clear();
  window.__AUDIO_QUEUE_CONFIG__ = (opts) => audioQueue.configure(opts);
  
  console.log('🎵 Audio Processing Queue carregada globalmente');
}

export default audioQueue;
