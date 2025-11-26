// 🔬 INSTRUMENTATION MODULE - Performance Measurement System
// Carimbos de tempo com process.hrtime.bigint() para auditoria completa do pipeline

import { performance } from 'perf_hooks';
import v8 from 'v8';
import os from 'os';

/**
 * 📊 Estado global da instrumentação
 */
const INSTRUMENTATION_STATE = {
  enabled: true,
  measurements: new Map(),
  phaseStack: [],
  currentJobId: null,
  startTime: null,
  gcStats: {
    before: null,
    after: null
  }
};

/**
 * 🎯 Estrutura de medição individual
 */
class Measurement {
  constructor(name, jobId) {
    this.name = name;
    this.jobId = jobId;
    this.startNs = process.hrtime.bigint();
    this.startCpu = process.cpuUsage();
    this.startMemory = process.memoryUsage();
    this.endNs = null;
    this.endCpu = null;
    this.endMemory = null;
    this.durationMs = null;
    this.cpuUserMs = null;
    this.cpuSystemMs = null;
    this.rssMb = null;
    this.heapUsedMb = null;
    this.metadata = {};
  }

  end() {
    this.endNs = process.hrtime.bigint();
    this.endCpu = process.cpuUsage(this.startCpu);
    this.endMemory = process.memoryUsage();
    
    // Calcular durações
    const durationNs = this.endNs - this.startNs;
    this.durationMs = Number(durationNs) / 1_000_000; // ns -> ms
    
    // CPU usage em ms
    this.cpuUserMs = this.endCpu.user / 1000; // μs -> ms
    this.cpuSystemMs = this.endCpu.system / 1000;
    
    // Memória em MB
    this.rssMb = this.endMemory.rss / (1024 * 1024);
    this.heapUsedMb = this.endMemory.heapUsed / (1024 * 1024);
    this.heapTotalMb = this.endMemory.heapTotal / (1024 * 1024);
    
    return this;
  }

  toJSON() {
    return {
      name: this.name,
      jobId: this.jobId,
      startNs: this.startNs.toString(),
      endNs: this.endNs?.toString(),
      durationMs: this.durationMs,
      cpuUserMs: this.cpuUserMs,
      cpuSystemMs: this.cpuSystemMs,
      cpuTotalMs: this.cpuUserMs + this.cpuSystemMs,
      rssMb: this.rssMb,
      heapUsedMb: this.heapUsedMb,
      heapTotalMb: this.heapTotalMb,
      metadata: this.metadata
    };
  }
}

/**
 * ⚙️ Configurar instrumentação
 */
export function configureInstrumentation(options = {}) {
  INSTRUMENTATION_STATE.enabled = options.enabled !== false;
  INSTRUMENTATION_STATE.currentJobId = options.jobId || 'unknown';
  INSTRUMENTATION_STATE.startTime = process.hrtime.bigint();
  
  // Capturar stats GC iniciais se v8 disponível
  try {
    INSTRUMENTATION_STATE.gcStats.before = v8.getHeapStatistics();
  } catch (e) {
    // v8 não disponível
  }
  
  console.log(`[INSTRUMENTATION] Configurado: enabled=${INSTRUMENTATION_STATE.enabled}, jobId=${INSTRUMENTATION_STATE.currentJobId}`);
}

/**
 * ⏱️ Medir função síncrona
 * @param {string} name - Nome da medição
 * @param {Function} fn - Função a executar
 * @param {object} metadata - Metadados adicionais
 * @returns {*} Retorno da função
 */
export function measure(name, fn, metadata = {}) {
  if (!INSTRUMENTATION_STATE.enabled) {
    return fn();
  }
  
  const measurement = new Measurement(name, INSTRUMENTATION_STATE.currentJobId);
  measurement.metadata = metadata;
  
  try {
    const result = fn();
    measurement.end();
    storeMeasurement(measurement);
    return result;
  } catch (error) {
    measurement.end();
    measurement.metadata.error = error.message;
    storeMeasurement(measurement);
    throw error;
  }
}

/**
 * ⏱️ Medir função assíncrona
 * @param {string} name - Nome da medição
 * @param {Function} fn - Função async a executar
 * @param {object} metadata - Metadados adicionais
 * @returns {Promise<*>} Retorno da função
 */
export async function measureAsync(name, fn, metadata = {}) {
  if (!INSTRUMENTATION_STATE.enabled) {
    return await fn();
  }
  
  const measurement = new Measurement(name, INSTRUMENTATION_STATE.currentJobId);
  measurement.metadata = metadata;
  
  try {
    const result = await fn();
    measurement.end();
    storeMeasurement(measurement);
    return result;
  } catch (error) {
    measurement.end();
    measurement.metadata.error = error.message;
    storeMeasurement(measurement);
    throw error;
  }
}

/**
 * 🔄 Criar escopo de fase (contexto hierárquico)
 * @param {string} phaseName - Nome da fase
 * @param {Function} fn - Função async a executar
 * @returns {Promise<*>} Retorno da função
 */
export async function withPhase(phaseName, fn) {
  if (!INSTRUMENTATION_STATE.enabled) {
    return await fn();
  }
  
  // Push phase to stack
  INSTRUMENTATION_STATE.phaseStack.push(phaseName);
  const fullPhaseName = INSTRUMENTATION_STATE.phaseStack.join(' > ');
  
  const measurement = new Measurement(fullPhaseName, INSTRUMENTATION_STATE.currentJobId);
  measurement.metadata.phase = phaseName;
  measurement.metadata.depth = INSTRUMENTATION_STATE.phaseStack.length;
  
  try {
    const result = await fn();
    measurement.end();
    storeMeasurement(measurement);
    return result;
  } catch (error) {
    measurement.end();
    measurement.metadata.error = error.message;
    storeMeasurement(measurement);
    throw error;
  } finally {
    // Pop phase from stack
    INSTRUMENTATION_STATE.phaseStack.pop();
  }
}

/**
 * 📦 Armazenar medição
 */
function storeMeasurement(measurement) {
  const key = `${measurement.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  INSTRUMENTATION_STATE.measurements.set(key, measurement);
}

/**
 * 📊 Obter todas as medições
 */
export function getMeasurements() {
  return Array.from(INSTRUMENTATION_STATE.measurements.values());
}

/**
 * 📊 Obter medições por nome (pattern matching)
 */
export function getMeasurementsByPattern(pattern) {
  const regex = new RegExp(pattern);
  return getMeasurements().filter(m => regex.test(m.name));
}

/**
 * 📊 Estatísticas agregadas por nome
 */
export function getAggregatedStats(namePattern = null) {
  let measurements = getMeasurements();
  
  if (namePattern) {
    const regex = new RegExp(namePattern);
    measurements = measurements.filter(m => regex.test(m.name));
  }
  
  // Agrupar por nome
  const grouped = new Map();
  for (const m of measurements) {
    if (!grouped.has(m.name)) {
      grouped.set(m.name, []);
    }
    grouped.get(m.name).push(m);
  }
  
  // Calcular estatísticas para cada grupo
  const stats = {};
  for (const [name, items] of grouped.entries()) {
    const durations = items.map(i => i.durationMs).filter(d => d !== null);
    const cpuTotals = items.map(i => (i.cpuUserMs || 0) + (i.cpuSystemMs || 0));
    const rss = items.map(i => i.rssMb).filter(r => r !== null);
    
    if (durations.length === 0) continue;
    
    stats[name] = {
      count: durations.length,
      duration: calculateStats(durations),
      cpuTotal: calculateStats(cpuTotals),
      rss: calculateStats(rss),
      firstMeasurement: items[0].toJSON(),
      lastMeasurement: items[items.length - 1].toJSON()
    };
  }
  
  return stats;
}

/**
 * 📈 Calcular estatísticas (média, mediana, p95, p99, min, max, stddev)
 */
function calculateStats(values) {
  if (values.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, stddev: 0, p95: 0, p99: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  
  // Mediana
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  
  // Percentis
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  const p99Index = Math.ceil(sorted.length * 0.99) - 1;
  const p95 = sorted[Math.min(p95Index, sorted.length - 1)];
  const p99 = sorted[Math.min(p99Index, sorted.length - 1)];
  
  // Desvio padrão
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sorted.length;
  const stddev = Math.sqrt(variance);
  
  return {
    mean: mean,
    median: median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stddev: stddev,
    p95: p95,
    p99: p99,
    count: values.length
  };
}

/**
 * 🧹 Limpar medições
 */
export function clearMeasurements() {
  INSTRUMENTATION_STATE.measurements.clear();
  INSTRUMENTATION_STATE.phaseStack = [];
  console.log('[INSTRUMENTATION] Medições limpadas');
}

/**
 * 📊 Gerar relatório de resumo
 */
export function generateSummaryReport() {
  const stats = getAggregatedStats();
  const totalTime = INSTRUMENTATION_STATE.startTime
    ? Number(process.hrtime.bigint() - INSTRUMENTATION_STATE.startTime) / 1_000_000
    : 0;
  
  // Capturar GC stats finais
  let gcStats = null;
  try {
    INSTRUMENTATION_STATE.gcStats.after = v8.getHeapStatistics();
    gcStats = {
      before: INSTRUMENTATION_STATE.gcStats.before,
      after: INSTRUMENTATION_STATE.gcStats.after
    };
  } catch (e) {
    // v8 não disponível
  }
  
  return {
    jobId: INSTRUMENTATION_STATE.currentJobId,
    totalTimeMs: totalTime,
    measurementCount: INSTRUMENTATION_STATE.measurements.size,
    stats: stats,
    systemInfo: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemoryMb: os.totalmem() / (1024 * 1024),
      freeMemoryMb: os.freemem() / (1024 * 1024),
      nodeVersion: process.version
    },
    gcStats: gcStats,
    timestamp: new Date().toISOString()
  };
}

/**
 * 💾 Exportar medições para JSON
 */
export function exportMeasurementsJSON() {
  const measurements = getMeasurements().map(m => m.toJSON());
  return JSON.stringify(measurements, null, 2);
}

/**
 * 🔧 Worker thread instrumentation helper
 * Para interceptar tempo de fila, serialização e execução em workers
 */
export function createWorkerInstrumentation(workerName) {
  return {
    measurePostMessage(data) {
      const startNs = process.hrtime.bigint();
      const payloadSize = JSON.stringify(data).length;
      
      return {
        startNs,
        payloadSize,
        end() {
          const endNs = process.hrtime.bigint();
          const durationMs = Number(endNs - startNs) / 1_000_000;
          
          return {
            workerName,
            phase: 'postMessage',
            startNs: startNs.toString(),
            endNs: endNs.toString(),
            durationMs,
            payloadSize
          };
        }
      };
    },
    
    measureWorkerExecution(taskName) {
      const startNs = process.hrtime.bigint();
      
      return {
        startNs,
        end() {
          const endNs = process.hrtime.bigint();
          const durationMs = Number(endNs - startNs) / 1_000_000;
          
          return {
            workerName,
            taskName,
            phase: 'execution',
            startNs: startNs.toString(),
            endNs: endNs.toString(),
            durationMs
          };
        }
      };
    }
  };
}

/**
 * 🎯 Reset global state (para testes)
 */
export function resetInstrumentation() {
  INSTRUMENTATION_STATE.enabled = true;
  INSTRUMENTATION_STATE.measurements.clear();
  INSTRUMENTATION_STATE.phaseStack = [];
  INSTRUMENTATION_STATE.currentJobId = null;
  INSTRUMENTATION_STATE.startTime = null;
  INSTRUMENTATION_STATE.gcStats = { before: null, after: null };
  console.log('[INSTRUMENTATION] Estado resetado');
}

// Export state para debugging
export { INSTRUMENTATION_STATE };

console.log('✅ Instrumentation module loaded');
