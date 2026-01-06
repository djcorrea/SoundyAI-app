/**
 * 🧪 SCRIPT DE TESTE DE CONCORRÊNCIA - PRODUÇÃO
 * 
 * Testa o comportamento do sistema SoundyAI sob carga de 50 análises simultâneas
 * em ambiente de produção (Railway/HiWi).
 * 
 * ⚠️ ATENÇÃO:
 * - Este script NÃO modifica o backend
 * - Usa apenas endpoints públicos da API
 * - Requer autenticação Firebase válida
 * - Dispara requisições reais contra produção
 * 
 * 📋 PRÉ-REQUISITOS:
 * 1. Arquivo de áudio válido (.wav, .mp3 ou .flac)
 * 2. Firebase ID Token válido (usuário PRO recomendado)
 * 3. Credenciais B2 configuradas no .env
 * 
 * 🚀 USO:
 * node test-concurrency.js --audioFile=./audio.wav --idToken=YOUR_TOKEN
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
// 📋 CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  // 🌐 API de Produção
  API_BASE_URL: 'https://soundyai-app-production.up.railway.app/api',
  
  // 🎯 Parâmetros do teste
  TOTAL_REQUESTS: 50,              // Total de análises simultâneas
  CONCURRENCY_LIMIT: 10,            // Máximo de requisições simultâneas
  POLLING_INTERVAL: 5000,           // Intervalo de polling (ms)
  MAX_WAIT_TIME: 600000,            // Timeout máximo por análise (10 min)
  
  // 📊 Backblaze B2
  B2_KEY_ID: process.env.B2_KEY_ID,
  B2_APP_KEY: process.env.B2_APP_KEY,
  B2_BUCKET_NAME: process.env.B2_BUCKET_NAME,
  B2_ENDPOINT: process.env.B2_ENDPOINT,
};

// ═══════════════════════════════════════════════════════════════════
// 📊 MÉTRICAS GLOBAIS
// ═══════════════════════════════════════════════════════════════════

const METRICS = {
  totalDispatched: 0,
  totalQueued: 0,
  totalCompleted: 0,
  totalFailed: 0,
  totalTimeout: 0,
  startTime: null,
  endTime: null,
  requests: [], // Array para armazenar detalhes de cada requisição
};

// ═══════════════════════════════════════════════════════════════════
// 🔧 FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════

/**
 * Formatar timestamp para log
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Log formatado
 */
function log(emoji, message, data = null) {
  console.log(`[${timestamp()}] ${emoji} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Validar parâmetros obrigatórios
 */
function validateConfig() {
  const errors = [];
  
  if (!CONFIG.B2_KEY_ID) errors.push('B2_KEY_ID não configurado');
  if (!CONFIG.B2_APP_KEY) errors.push('B2_APP_KEY não configurado');
  if (!CONFIG.B2_BUCKET_NAME) errors.push('B2_BUCKET_NAME não configurado');
  if (!CONFIG.B2_ENDPOINT) errors.push('B2_ENDPOINT não configurado');
  
  if (errors.length > 0) {
    log('❌', 'Erros de configuração:');
    errors.forEach(err => console.log(`   - ${err}`));
    return false;
  }
  
  return true;
}

/**
 * Parse argumentos da linha de comando
 */
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.split('=');
    args[key.replace('--', '')] = value;
  });
  return args;
}

// ═══════════════════════════════════════════════════════════════════
// 🌐 BACKBLAZE B2 - UPLOAD DE ARQUIVO
// ═══════════════════════════════════════════════════════════════════

/**
 * Obter token de autorização do B2
 */
async function getB2AuthToken() {
  try {
    const auth = Buffer.from(`${CONFIG.B2_KEY_ID}:${CONFIG.B2_APP_KEY}`).toString('base64');
    
    const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`B2 Auth failed: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      authToken: data.authorizationToken,
      apiUrl: data.apiUrl,
      downloadUrl: data.downloadUrl
    };
  } catch (error) {
    throw new Error(`Erro ao autenticar com B2: ${error.message}`);
  }
}

/**
 * Fazer upload de arquivo para B2
 */
async function uploadToB2(filePath) {
  try {
    log('📤', 'Iniciando upload para Backblaze B2...', { filePath });
    
    // 1. Autenticar com B2
    const auth = await getB2AuthToken();
    
    // 2. Obter upload URL
    const uploadUrlResponse = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        'Authorization': auth.authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: CONFIG.B2_BUCKET_NAME
      })
    });
    
    if (!uploadUrlResponse.ok) {
      throw new Error(`B2 Upload URL failed: ${uploadUrlResponse.status}`);
    }
    
    const uploadData = await uploadUrlResponse.json();
    
    // 3. Ler arquivo
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fileKey = `test-concurrency/${Date.now()}-${fileName}`;
    const sha1 = crypto.createHash('sha1').update(fileBuffer).digest('hex');
    
    // 4. Upload do arquivo
    const uploadResponse = await fetch(uploadData.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': uploadData.authorizationToken,
        'X-Bz-File-Name': encodeURIComponent(fileKey),
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length,
        'X-Bz-Content-Sha1': sha1
      },
      body: fileBuffer
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`B2 Upload failed: ${uploadResponse.status}`);
    }
    
    const uploadResult = await uploadResponse.json();
    
    log('✅', 'Upload para B2 concluído!', {
      fileKey,
      fileSize: fileBuffer.length,
      fileName: uploadResult.fileName
    });
    
    return {
      fileKey,
      fileName: uploadResult.fileName,
      fileSize: fileBuffer.length
    };
    
  } catch (error) {
    throw new Error(`Erro no upload para B2: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🎯 TESTE DE ANÁLISE
// ═══════════════════════════════════════════════════════════════════

/**
 * Disparar análise de áudio
 */
async function triggerAnalysis(requestIndex, fileKey, fileName, idToken) {
  const startTime = Date.now();
  
  const requestData = {
    index: requestIndex,
    fileKey,
    fileName,
    status: 'pending',
    startTime,
    dispatchTime: null,
    queueTime: null,
    completeTime: null,
    jobId: null,
    error: null,
    httpStatus: null,
  };
  
  try {
    log('🚀', `[${requestIndex}/${CONFIG.TOTAL_REQUESTS}] Disparando análise...`);
    
    const response = await fetch(`${CONFIG.API_BASE_URL}/audio/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        fileKey,
        fileName,
        mode: 'genre',
        idToken
      })
    });
    
    requestData.dispatchTime = Date.now();
    requestData.httpStatus = response.status;
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.message || errorData.error}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.jobId) {
      requestData.jobId = result.jobId;
      requestData.status = 'queued';
      requestData.queueTime = Date.now();
      
      METRICS.totalQueued++;
      
      log('✅', `[${requestIndex}] Análise enfileirada!`, {
        jobId: result.jobId,
        queueTime: `${requestData.queueTime - startTime}ms`
      });
      
      return requestData;
    } else {
      throw new Error('Resposta inválida do servidor');
    }
    
  } catch (error) {
    requestData.status = 'failed';
    requestData.error = error.message;
    requestData.completeTime = Date.now();
    
    METRICS.totalFailed++;
    
    log('❌', `[${requestIndex}] Erro ao disparar análise:`, {
      error: error.message,
      httpStatus: requestData.httpStatus
    });
    
    return requestData;
  }
}

/**
 * Verificar status de um job
 */
async function checkJobStatus(jobId) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/jobs/${jobId}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      return { status: 'error', message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return {
      status: data.status,
      progress: data.progress,
      result: data.result,
      error: data.error
    };
    
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

/**
 * Monitorar job até conclusão ou timeout
 */
async function monitorJob(requestData) {
  const startTime = Date.now();
  
  log('🔍', `[${requestData.index}] Monitorando job: ${requestData.jobId}`);
  
  while (true) {
    const elapsed = Date.now() - startTime;
    
    // Verificar timeout
    if (elapsed > CONFIG.MAX_WAIT_TIME) {
      requestData.status = 'timeout';
      requestData.completeTime = Date.now();
      
      METRICS.totalTimeout++;
      
      log('⏱️', `[${requestData.index}] Timeout atingido (${CONFIG.MAX_WAIT_TIME / 1000}s)`);
      return requestData;
    }
    
    // Verificar status do job
    const jobStatus = await checkJobStatus(requestData.jobId);
    
    if (jobStatus.status === 'completed') {
      requestData.status = 'completed';
      requestData.completeTime = Date.now();
      
      METRICS.totalCompleted++;
      
      const totalTime = requestData.completeTime - requestData.startTime;
      const processingTime = requestData.completeTime - requestData.queueTime;
      
      log('✅', `[${requestData.index}] Análise concluída!`, {
        totalTime: `${totalTime}ms`,
        processingTime: `${processingTime}ms`
      });
      
      return requestData;
    }
    
    if (jobStatus.status === 'failed' || jobStatus.status === 'error') {
      requestData.status = 'failed';
      requestData.error = jobStatus.error || jobStatus.message;
      requestData.completeTime = Date.now();
      
      METRICS.totalFailed++;
      
      log('❌', `[${requestData.index}] Análise falhou:`, {
        error: requestData.error
      });
      
      return requestData;
    }
    
    // Aguardar antes de próxima verificação
    await new Promise(resolve => setTimeout(resolve, CONFIG.POLLING_INTERVAL));
  }
}

/**
 * Controlar concorrência das requisições
 */
async function runWithConcurrency(tasks, concurrencyLimit) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
    const promise = task().then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

// ═══════════════════════════════════════════════════════════════════
// 📊 RELATÓRIO FINAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Gerar relatório final do teste
 */
function generateReport() {
  const totalTime = METRICS.endTime - METRICS.startTime;
  const avgTime = METRICS.requests
    .filter(r => r.completeTime && r.startTime)
    .reduce((sum, r) => sum + (r.completeTime - r.startTime), 0) / METRICS.totalCompleted || 0;
  
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📊 RELATÓRIO FINAL - TESTE DE CONCORRÊNCIA');
  console.log('═'.repeat(80));
  console.log('');
  
  console.log('🎯 CONFIGURAÇÃO DO TESTE:');
  console.log(`   Total de requisições: ${CONFIG.TOTAL_REQUESTS}`);
  console.log(`   Limite de concorrência: ${CONFIG.CONCURRENCY_LIMIT}`);
  console.log(`   Timeout por análise: ${CONFIG.MAX_WAIT_TIME / 1000}s`);
  console.log(`   Intervalo de polling: ${CONFIG.POLLING_INTERVAL / 1000}s`);
  console.log('');
  
  console.log('📈 RESULTADOS:');
  console.log(`   ✅ Concluídas com sucesso: ${METRICS.totalCompleted}`);
  console.log(`   ❌ Com erro: ${METRICS.totalFailed}`);
  console.log(`   ⏱️ Timeout: ${METRICS.totalTimeout}`);
  console.log(`   📊 Taxa de sucesso: ${((METRICS.totalCompleted / CONFIG.TOTAL_REQUESTS) * 100).toFixed(2)}%`);
  console.log('');
  
  console.log('⏱️ TEMPOS:');
  console.log(`   Tempo total do teste: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   Tempo médio por análise: ${(avgTime / 1000).toFixed(2)}s`);
  console.log('');
  
  console.log('🔍 DETALHAMENTO POR STATUS:');
  const statusGroups = METRICS.requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(statusGroups).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  
  // Salvar relatório detalhado em arquivo JSON
  const reportFile = `test-concurrency-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify({
    config: CONFIG,
    metrics: METRICS,
    summary: {
      totalTime,
      avgTime,
      successRate: (METRICS.totalCompleted / CONFIG.TOTAL_REQUESTS) * 100
    }
  }, null, 2));
  
  log('💾', `Relatório detalhado salvo em: ${reportFile}`);
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('🧪 TESTE DE CONCORRÊNCIA - SoundyAI PRODUÇÃO');
  console.log('═'.repeat(80));
  console.log('');
  
  // 1. Validar configuração
  if (!validateConfig()) {
    process.exit(1);
  }
  
  // 2. Parse argumentos
  const args = parseArgs();
  
  if (!args.audioFile) {
    log('❌', 'Parâmetro obrigatório ausente: --audioFile');
    console.log('\nUso:');
    console.log('  node test-concurrency.js --audioFile=./audio.wav --idToken=YOUR_TOKEN');
    process.exit(1);
  }
  
  if (!args.idToken) {
    log('❌', 'Parâmetro obrigatório ausente: --idToken');
    console.log('\nUso:');
    console.log('  node test-concurrency.js --audioFile=./audio.wav --idToken=YOUR_TOKEN');
    process.exit(1);
  }
  
  const audioFilePath = path.resolve(args.audioFile);
  
  if (!fs.existsSync(audioFilePath)) {
    log('❌', `Arquivo não encontrado: ${audioFilePath}`);
    process.exit(1);
  }
  
  log('✅', 'Configuração validada!');
  console.log('');
  
  // 3. Upload do arquivo para B2
  const uploadResult = await uploadToB2(audioFilePath);
  console.log('');
  
  // 4. Iniciar métricas
  METRICS.startTime = Date.now();
  
  log('🚀', `Disparando ${CONFIG.TOTAL_REQUESTS} análises simultâneas...`);
  console.log('');
  
  // 5. Criar tasks para disparar análises
  const dispatchTasks = Array.from({ length: CONFIG.TOTAL_REQUESTS }, (_, i) => {
    return async () => {
      const requestData = await triggerAnalysis(
        i + 1,
        uploadResult.fileKey,
        uploadResult.fileName,
        args.idToken
      );
      
      METRICS.totalDispatched++;
      METRICS.requests.push(requestData);
      
      return requestData;
    };
  });
  
  // 6. Disparar análises com controle de concorrência
  const dispatchedRequests = await runWithConcurrency(dispatchTasks, CONFIG.CONCURRENCY_LIMIT);
  
  log('✅', 'Todas as requisições foram disparadas!');
  console.log('');
  
  // 7. Monitorar jobs que foram enfileirados com sucesso
  const queuedRequests = dispatchedRequests.filter(r => r.status === 'queued');
  
  log('🔍', `Monitorando ${queuedRequests.length} jobs enfileirados...`);
  console.log('');
  
  const monitorTasks = queuedRequests.map(requestData => {
    return async () => await monitorJob(requestData);
  });
  
  await runWithConcurrency(monitorTasks, CONFIG.CONCURRENCY_LIMIT);
  
  // 8. Finalizar métricas
  METRICS.endTime = Date.now();
  
  log('✅', 'Teste de concorrência concluído!');
  console.log('');
  
  // 9. Gerar relatório
  generateReport();
}

// ═══════════════════════════════════════════════════════════════════
// 🎬 INICIAR
// ═══════════════════════════════════════════════════════════════════

main().catch(error => {
  log('❌', 'Erro fatal no script:', { error: error.message });
  console.error(error);
  process.exit(1);
});
