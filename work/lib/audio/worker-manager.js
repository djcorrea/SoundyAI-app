/**
 * 🔧 Worker Manager - Utilitário para executar Worker Threads
 * 
 * Função auxiliar para rodar workers em paralelo de forma segura.
 * Gerencia timeout, erros e comunicação via message passing.
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Executa um worker e retorna uma Promise com o resultado
 * 
 * @param {string} workerPath - Caminho relativo do worker (ex: './workers/fft-worker.js')
 * @param {object} data - Dados a serem passados para o worker
 * @param {object} options - Opções adicionais
 * @param {number} options.timeout - Timeout em ms (padrão: 120000 = 2 minutos)
 * @returns {Promise<any>} - Resultado do worker
 */
export function runWorker(workerPath, data, options = {}) {
  const timeout = options.timeout || 120000; // 2 minutos padrão
  
  return new Promise((resolve, reject) => {
    let worker;
    let timeoutId;
    let resolved = false;
    
    try {
      // Criar worker
      worker = new Worker(workerPath, { 
        workerData: data,
        // Permitir módulos ES6
        type: 'module'
      });
      
      // Configurar timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          worker.terminate();
          reject(new Error(`Worker timeout após ${timeout}ms: ${workerPath}`));
        }
      }, timeout);
      
      // Listener de mensagem (resultado do worker)
      worker.on('message', (message) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          worker.terminate();
          
          if (message.success) {
            resolve(message.data);
          } else {
            reject(new Error(`Worker falhou: ${message.error || 'erro desconhecido'}`));
          }
        }
      });
      
      // Listener de erro
      worker.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          worker.terminate();
          reject(new Error(`Worker error: ${error.message}`));
        }
      });
      
      // Listener de exit
      worker.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          
          if (code !== 0) {
            reject(new Error(`Worker saiu com código ${code}`));
          } else {
            // Exit 0 sem mensagem = sucesso sem resultado
            resolve(null);
          }
        }
      });
      
    } catch (error) {
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (worker) worker.terminate();
        reject(new Error(`Erro ao criar worker: ${error.message}`));
      }
    }
  });
}

/**
 * Executa múltiplos workers em paralelo com Promise.all
 * 
 * @param {Array<{path: string, data: object, name: string}>} workers - Array de workers
 * @param {object} options - Opções globais
 * @returns {Promise<Array<any>>} - Array com resultados dos workers
 */
export async function runWorkersParallel(workers, options = {}) {
  const startTime = Date.now();
  
  console.log(`\n🚀 [Worker Manager] Iniciando ${workers.length} workers em paralelo...`);
  
  try {
    const promises = workers.map((worker, index) => {
      console.log(`   ${index + 1}. ${worker.name || worker.path}`);
      return runWorker(worker.path, worker.data, options);
    });
    
    const results = await Promise.all(promises);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ [Worker Manager] Todos os workers concluídos em ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)\n`);
    
    return results;
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ [Worker Manager] Erro após ${elapsed}ms: ${error.message}\n`);
    throw error;
  }
}

/**
 * Converte buffer Float32Array para formato serializável (Array)
 * Workers não podem transferir TypedArrays diretamente em alguns casos
 * 
 * @param {Float32Array} buffer - Buffer a ser serializado
 * @returns {Array<number>} - Array JavaScript padrão
 */
export function serializeFloat32Array(buffer) {
  if (!buffer || !buffer.length) return [];
  return Array.from(buffer);
}

/**
 * Converte Array de volta para Float32Array
 * 
 * @param {Array<number>} array - Array JavaScript
 * @returns {Float32Array} - TypedArray
 */
export function deserializeFloat32Array(array) {
  if (!array || !array.length) return new Float32Array(0);
  return new Float32Array(array);
}
