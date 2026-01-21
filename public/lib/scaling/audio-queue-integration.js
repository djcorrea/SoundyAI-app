// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

/**
 * 🔌 INTEGRAÇÃO AUDIO QUEUE - FASE 1
 * Carrega automaticamente o sistema de fila sem quebrar funcionalidade existente
 */

// Importar sistema de fila
import { audioQueue, processAudioFile, getAudioQueueStatus } from '/lib/scaling/audio-processing-queue.js';

/**
 * Interceptor para análise de áudio existente
 * Redireciona automaticamente para a fila quando há múltiplos arquivos
 */
window.addEventListener('DOMContentLoaded', function() {
  log('🔌 Integrando Audio Queue ao sistema existente...');
  
  // Detectar se há sistema de análise ativo
  if (window.AudioAnalyzer) {
    enhanceExistingAudioAnalyzer();
  }
  
  // Aguardar carregamento do sistema principal
  setTimeout(() => {
    if (window.AudioAnalyzer) {
      enhanceExistingAudioAnalyzer();
    }
  }, 2000);
  
  // Interface de monitoramento
  createQueueMonitoringUI();
});

/**
 * Melhora o AudioAnalyzer existente com sistema de fila
 */
function enhanceExistingAudioAnalyzer() {
  const originalAnalyzer = window.AudioAnalyzer;
  if (!originalAnalyzer || originalAnalyzer._queueEnhanced) return;
  
  log('🔧 Integrando fila com AudioAnalyzer existente...');
  
  // Backup do método original
  const originalAnalyzeFile = originalAnalyzer.prototype.analyzeFile;
  
  // Substituir método com versão com fila
  originalAnalyzer.prototype.analyzeFile = async function(file, options = {}) {
    // Verificar se devemos usar fila
    const queueStatus = getAudioQueueStatus();
    const shouldUseQueue = queueStatus.running.length > 0 || queueStatus.queue.total > 0;
    
    if (shouldUseQueue || options.useQueue !== false) {
      log('📥 Usando fila para processar:', file.name);
      
      // Mostrar feedback para usuário
      showQueueFeedback(file.name, queueStatus);
      
      try {
        // Processar via fila
        const result = await processAudioFile(file, {
          ...options,
          userId: window.auth?.currentUser?.uid || 'anonymous',
          priority: options.priority || 5,
          label: `analysis:${file.name}`,
          timeout: options.timeout || 120000
        });
        
        hideQueueFeedback();
        return result;
        
      } catch (error) {
        hideQueueFeedback();
        warn('⚠️ Erro na fila, usando método original:', error.message);
        
        // Fallback para método original
        return originalAnalyzeFile.call(this, file, options);
      }
    } else {
      // Usar método original para primeiro arquivo
      return originalAnalyzeFile.call(this, file, options);
    }
  };
  
  // Marcar como aprimorado
  originalAnalyzer._queueEnhanced = true;
  log('✅ AudioAnalyzer aprimorado com sistema de fila');
}

/**
 * Mostra feedback da fila para o usuário
 */
function showQueueFeedback(fileName, queueStatus) {
  // Remover feedback anterior
  hideQueueFeedback();
  
  const statusDiv = document.createElement('div');
  statusDiv.id = 'audio-queue-feedback';
  statusDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 123, 255, 0.9);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 300px;
    backdrop-filter: blur(10px);
  `;
  
  const estimatedWait = queueStatus.estimatedWaitTime;
  const queuePosition = queueStatus.queue.total + 1;
  
  statusDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">
      🎵 Processando Áudio
    </div>
    <div style="font-size: 12px; opacity: 0.9;">
      📁 ${fileName}<br>
      📊 Posição na fila: ${queuePosition}<br>
      ⏱️ Tempo estimado: ${estimatedWait}s<br>
      🔄 Processando: ${queueStatus.running}/${queueStatus.maxConcurrent}
    </div>
  `;
  
  document.body.appendChild(statusDiv);
}

/**
 * Remove feedback da fila
 */
function hideQueueFeedback() {
  const existing = document.getElementById('audio-queue-feedback');
  if (existing) {
    existing.remove();
  }
}

/**
 * Cria interface de monitoramento da fila (modo debug)
 */
function createQueueMonitoringUI() {
  // Só mostrar em desenvolvimento ou quando solicitado
  const showMonitoring = window.location.search.includes('debug=queue') || 
                        window.location.hostname === 'localhost';
  
  if (!showMonitoring) return;
  
  const monitorDiv = document.createElement('div');
  monitorDiv.id = 'queue-monitor';
  monitorDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    padding: 10px;
    border-radius: 5px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    z-index: 9999;
    min-width: 200px;
  `;
  
  document.body.appendChild(monitorDiv);
  
  // Atualizar status a cada 2 segundos
  setInterval(() => {
    const status = getAudioQueueStatus();
    monitorDiv.innerHTML = `
      <div><strong>🎵 AUDIO QUEUE STATUS</strong></div>
      <div>Queue: ${status.queue.total} | Running: ${status.running}</div>
      <div>Capacity: ${status.capacity}</div>
      <div>Completed: ${status.metrics.completedJobs}</div>
      <div>Failed: ${status.metrics.failedJobs}</div>
      <div>Avg Time: ${Math.round(status.metrics.averageProcessingTime/1000)}s</div>
    `;
  }, 2000);
}

/**
 * Função para configurar a fila dinamicamente
 */
window.configureAudioProcessing = function(options = {}) {
  log('🔧 Configurando processamento de áudio:', options);
  
  // Configurar número de processamentos simultâneos baseado na performance do dispositivo
  if (options.auto) {
    const cores = navigator.hardwareConcurrency || 2;
    const maxConcurrent = Math.min(Math.max(Math.floor(cores / 2), 1), 3);
    audioQueue.configure({ maxConcurrent });
    log(`🤖 Auto-configuração: ${maxConcurrent} processamentos simultâneos (${cores} cores detectados)`);
  } else {
    audioQueue.configure(options);
  }
};

/**
 * Função para obter estatísticas de performance
 */
window.getAudioProcessingStats = function() {
  return {
    queue: getAudioQueueStatus(),
    hardware: {
      cores: navigator.hardwareConcurrency || 'unknown',
      memory: navigator.deviceMemory || 'unknown',
      connection: navigator.connection?.effectiveType || 'unknown'
    }
  };
};

log('✅ Audio Queue integrada com sucesso ao sistema existente');
