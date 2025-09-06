// 🎯 SISTEMA DE ANÁLISE DE ÁUDIO - BACKEND ONLY
// Migração completa do Web Audio API para Backend Node.js (Fases 5.1-5.5)
// Substituição total do audio-analyzer.js e audio-analyzer-integration.js

console.log('🚀 Sistema de Análise Backend carregado - Zero dependências Web Audio API');

/**
 * 🎯 CONFIGURAÇÕES DO SISTEMA BACKEND
 */
const BACKEND_CONFIG = {
  // Base URL do servidor (ajustar para produção)
  BASE_URL: window.location.origin,
  
  // Endpoints da API
  PRESIGN_ENDPOINT: '/api/audio/presign',
  PROCESS_ENDPOINT: '/api/audio/process', 
  JOBS_ENDPOINT: '/api/audio/jobs',
  
  // Configurações de upload
  MAX_FILE_SIZE: 60 * 1024 * 1024, // 60MB
  ALLOWED_TYPES: ['audio/wav', 'audio/flac', 'audio/mp3', 'audio/mpeg'],
  ALLOWED_EXTENSIONS: ['.wav', '.flac', '.mp3'],
  
  // Polling
  POLLING_INTERVAL: 2000, // 2 segundos
  MAX_POLLING_TIME: 300000, // 5 minutos
  
  // Debug
  DEBUG_MODE: true
};

/**
 * 🎯 ESTADO GLOBAL DO SISTEMA
 */
const AudioAnalysisState = {
  currentJob: null,
  pollingInterval: null,
  isProcessing: false,
  uploadProgress: 0,
  analysisProgress: 0,
  currentFile: null
};

/**
 * 🎯 FUNÇÃO PRINCIPAL - ANALISAR ÁUDIO NO BACKEND
 * @param {File} file - Arquivo de áudio selecionado
 * @returns {Promise<Object>} - Resultado da análise
 */
async function analyzeWithBackend(file) {
  if (!file) {
    throw new Error('Arquivo não fornecido');
  }
  
  log('🎵 Iniciando análise de áudio no backend');
  log('📄 Arquivo:', { name: file.name, size: formatFileSize(file.size), type: file.type });
  
  // Reset do estado
  AudioAnalysisState.currentJob = null;
  AudioAnalysisState.isProcessing = true;
  AudioAnalysisState.uploadProgress = 0;
  AudioAnalysisState.analysisProgress = 0;
  AudioAnalysisState.currentFile = file;
  
  try {
    // Validações
    validateAudioFile(file);
    
    // Mostrar loading
    showAnalysisLoading();
    updateProgress('🔍 Validando arquivo...', 5);
    
    // 1. Obter URL de presign
    updateProgress('🔗 Obtendo URL de upload...', 10);
    const presignData = await getPresignedUrl(file);
    log('✅ URL de presign obtida:', presignData.fileKey);
    
    // 2. Upload do arquivo
    updateProgress('📤 Enviando arquivo para análise...', 15);
    await uploadFileToBackend(file, presignData);
    log('✅ Upload concluído');
    
    // 3. Iniciar processamento
    updateProgress('⚡ Iniciando processamento no servidor...', 30);
    const job = await startProcessing(presignData.fileKey, file.name);
    AudioAnalysisState.currentJob = job;
    log('✅ Job iniciado:', job.jobId);
    
    // 4. Polling até completar
    updateProgress('🔄 Processando áudio (isso pode levar alguns segundos)...', 35);
    const result = await pollJobCompletion(job.jobId);
    log('✅ Análise concluída');
    
    // 5. Processar e exibir resultados
    updateProgress('📊 Preparando resultados...', 95);
    await displayAnalysisResults(result);
    updateProgress('✅ Análise completa!', 100);
    
    AudioAnalysisState.isProcessing = false;
    return result;
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
    AudioAnalysisState.isProcessing = false;
    
    // Mostrar erro no modal
    showAnalysisError(error.message);
    throw error;
  }
}

/**
 * 🔍 VALIDAR ARQUIVO DE ÁUDIO
 * @param {File} file - Arquivo a validar
 */
function validateAudioFile(file) {
  // Validar tamanho
  if (file.size > BACKEND_CONFIG.MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande. Máximo: ${formatFileSize(BACKEND_CONFIG.MAX_FILE_SIZE)}`);
  }
  
  if (file.size === 0) {
    throw new Error('Arquivo vazio');
  }
  
  // Validar tipo
  const isValidType = BACKEND_CONFIG.ALLOWED_TYPES.includes(file.type) ||
                     BACKEND_CONFIG.ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  
  if (!isValidType) {
    throw new Error(`Formato não suportado. Use: ${BACKEND_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`);
  }
  
  log('✅ Arquivo validado');
}

/**
 * 🔗 OBTER URL DE PRESIGN
 * @param {File} file - Arquivo para upload
 * @returns {Promise<Object>} - Dados do presign
 */
async function getPresignedUrl(file) {
  const response = await fetch(`${BACKEND_CONFIG.BASE_URL}${BACKEND_CONFIG.PRESIGN_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao obter URL de upload: ${error}`);
  }
  
  return await response.json();
}

/**
 * 📤 UPLOAD DO ARQUIVO PARA O BACKEND
 * @param {File} file - Arquivo a enviar
 * @param {Object} presignData - Dados do presign
 */
async function uploadFileToBackend(file, presignData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Progress tracking
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        AudioAnalysisState.uploadProgress = progress;
        
        // Mapear 15% - 25% do progresso total para upload
        const totalProgress = 15 + (progress * 0.1);
        updateProgress(`📤 Enviando: ${progress}%`, totalProgress);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        log('✅ Upload concluído');
        resolve();
      } else {
        reject(new Error(`Erro no upload: ${xhr.status} ${xhr.statusText}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Erro de rede durante upload'));
    });
    
    xhr.open('PUT', presignData.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * ⚡ INICIAR PROCESSAMENTO NO BACKEND
 * @param {string} fileKey - Chave do arquivo
 * @param {string} fileName - Nome original do arquivo
 * @returns {Promise<Object>} - Dados do job
 */
async function startProcessing(fileKey, fileName) {
  const response = await fetch(`${BACKEND_CONFIG.BASE_URL}${BACKEND_CONFIG.PROCESS_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileKey: fileKey,
      fileName: fileName,
      options: {
        // Opções do pipeline Node.js
        enableConcurrency: true,
        timeout: 300000, // 5 minutos
        outputFormat: 'json'
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao iniciar processamento: ${error}`);
  }
  
  return await response.json();
}

/**
 * 🔄 POLLING DO STATUS DO JOB
 * @param {string} jobId - ID do job
 * @returns {Promise<Object>} - Resultado final
 */
async function pollJobCompletion(jobId) {
  const startTime = Date.now();
  let lastProgress = 35;
  
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        // Verificar timeout
        if (Date.now() - startTime > BACKEND_CONFIG.MAX_POLLING_TIME) {
          clearInterval(AudioAnalysisState.pollingInterval);
          reject(new Error('Timeout: processamento demorou mais que o esperado'));
          return;
        }
        
        // Consultar status
        const response = await fetch(`${BACKEND_CONFIG.BASE_URL}${BACKEND_CONFIG.JOBS_ENDPOINT}/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`Erro ao consultar job: ${response.status}`);
        }
        
        const jobData = await response.json();
        log('📊 Status do job:', jobData.status);
        
        // Atualizar progress baseado no status e progress do backend
        if (jobData.status === 'processing') {
          const backendProgress = jobData.progress || lastProgress;
          lastProgress = Math.min(35 + (backendProgress * 0.6), 90); // 35% - 90%
          updateProgress('🔄 Analisando áudio...', lastProgress);
        }
        
        // Verificar se completou
        if (jobData.status === 'completed') {
          clearInterval(AudioAnalysisState.pollingInterval);
          log('✅ Job completado');
          resolve(jobData.result);
          return;
        }
        
        // Verificar se falhou
        if (jobData.status === 'failed') {
          clearInterval(AudioAnalysisState.pollingInterval);
          reject(new Error(jobData.error || 'Processamento falhou'));
          return;
        }
        
        // Continue polling
        log('⏳ Aguardando conclusão...');
        
      } catch (error) {
        clearInterval(AudioAnalysisState.pollingInterval);
        reject(error);
      }
    };
    
    // Iniciar polling
    AudioAnalysisState.pollingInterval = setInterval(poll, BACKEND_CONFIG.POLLING_INTERVAL);
    poll(); // Primeira execução imediata
  });
}

/**
 * 📊 EXIBIR RESULTADOS DA ANÁLISE
 * @param {Object} result - Resultado do backend
 */
async function displayAnalysisResults(result) {
  log('📊 Exibindo resultados:', result);
  
  try {
    // Ocultar loading e mostrar resultados
    hideAnalysisLoading();
    showAnalysisResults();
    
    // Extrair dados técnicos
    const technicalData = extractTechnicalData(result);
    
    // Renderizar no modal
    renderTechnicalDataInModal(technicalData);
    
    // Scroll para resultados
    const resultsElement = document.getElementById('audioAnalysisResults');
    if (resultsElement) {
      resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    log('✅ Resultados exibidos no modal');
    
  } catch (error) {
    console.error('❌ Erro ao exibir resultados:', error);
    showAnalysisError('Erro ao processar resultados da análise');
  }
}

/**
 * 🔧 EXTRAIR DADOS TÉCNICOS DO RESULTADO
 * @param {Object} result - Resultado do backend
 * @returns {Object} - Dados técnicos formatados
 */
function extractTechnicalData(result) {
  // O resultado vem do pipeline Node.js (fases 5.1-5.4)
  // Estrutura esperada: { score, classification, technicalData, metadata, ... }
  
  if (!result || typeof result !== 'object') {
    throw new Error('Resultado inválido do backend');
  }
  
  // Extrair dados principais
  const data = {
    score: result.score || 0,
    classification: result.classification || 'Desconhecido',
    scoringMethod: result.scoringMethod || 'Equal Weight V3',
    
    // Métricas LUFS
    lufs: {
      integrated: result.technicalData?.lufsIntegrated || 0,
      shortTerm: result.technicalData?.lufsShortTerm || 0,
      momentary: result.technicalData?.lufsMomentary || 0,
      lra: result.technicalData?.lra || 0
    },
    
    // True Peak
    truePeak: {
      dbtp: result.technicalData?.truePeakDbtp || 0,
      linear: result.technicalData?.truePeakLinear || 0
    },
    
    // Análise estéreo
    stereo: {
      correlation: result.technicalData?.stereoCorrelation || 0,
      width: result.technicalData?.stereoWidth || 0,
      balance: result.technicalData?.balanceLR || 0
    },
    
    // Bandas espectrais
    bands: result.technicalData?.bandEnergies || {},
    
    // Metadados
    metadata: {
      fileName: AudioAnalysisState.currentFile?.name || 'arquivo.wav',
      fileSize: AudioAnalysisState.currentFile?.size || 0,
      processingTime: result.metadata?.processingTime || 0,
      sampleRate: result.technicalData?.sampleRate || 48000,
      duration: result.metadata?.duration || 0,
      buildVersion: result.buildVersion || 'backend-v5.5',
      pipelineVersion: result.pipelineVersion || 'Node.js 5.1-5.5'
    }
  };
  
  log('🔧 Dados técnicos extraídos:', data);
  return data;
}

/**
 * 🖼️ RENDERIZAR DADOS TÉCNICOS NO MODAL
 * @param {Object} data - Dados técnicos formatados
 */
function renderTechnicalDataInModal(data) {
  const container = document.getElementById('modalTechnicalData');
  if (!container) {
    throw new Error('Container modalTechnicalData não encontrado');
  }
  
  // HTML dos resultados
  const html = `
    <div class="analysis-summary">
      <div class="score-display">
        <div class="score-value">${data.score.toFixed(1)}%</div>
        <div class="score-label">${data.classification}</div>
        <div class="score-method">Método: ${data.scoringMethod}</div>
      </div>
    </div>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <h5>📢 LUFS (Loudness)</h5>
        <div class="metric-value">${data.lufs.integrated.toFixed(1)} LUFS</div>
        <div class="metric-details">
          <span>Short-term: ${data.lufs.shortTerm.toFixed(1)} LUFS</span>
          <span>LRA: ${data.lufs.lra.toFixed(1)} LU</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h5>🏔️ True Peak</h5>
        <div class="metric-value">${data.truePeak.dbtp.toFixed(1)} dBTP</div>
        <div class="metric-details">
          <span>Linear: ${data.truePeak.linear.toFixed(3)}</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h5>🎧 Análise Estéreo</h5>
        <div class="metric-value">${(data.stereo.correlation * 100).toFixed(1)}%</div>
        <div class="metric-details">
          <span>Correlação: ${data.stereo.correlation.toFixed(3)}</span>
          <span>Width: ${data.stereo.width.toFixed(3)}</span>
          <span>Balance: ${data.stereo.balance.toFixed(3)}</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h5>📊 Informações</h5>
        <div class="metric-details">
          <span>Arquivo: ${data.metadata.fileName}</span>
          <span>Tamanho: ${formatFileSize(data.metadata.fileSize)}</span>
          <span>Processamento: ${data.metadata.processingTime}ms</span>
          <span>Pipeline: ${data.metadata.pipelineVersion}</span>
        </div>
      </div>
    </div>
    
    <div class="analysis-powered-by">
      <small>🚀 Processado pelo Backend Node.js (Fases 5.1-5.5) | Zero dependências Web Audio API</small>
    </div>
  `;
  
  container.innerHTML = html;
  log('🖼️ Dados renderizados no modal');
}

/**
 * 📊 MOSTRAR LOADING DA ANÁLISE
 */
function showAnalysisLoading() {
  const uploadArea = document.getElementById('audioUploadArea');
  const loadingArea = document.getElementById('audioAnalysisLoading');
  const resultsArea = document.getElementById('audioAnalysisResults');
  
  if (uploadArea) uploadArea.style.display = 'none';
  if (loadingArea) loadingArea.style.display = 'block';
  if (resultsArea) resultsArea.style.display = 'none';
}

/**
 * 📊 OCULTAR LOADING DA ANÁLISE
 */
function hideAnalysisLoading() {
  const loadingArea = document.getElementById('audioAnalysisLoading');
  if (loadingArea) loadingArea.style.display = 'none';
}

/**
 * 📊 MOSTRAR RESULTADOS DA ANÁLISE
 */
function showAnalysisResults() {
  const resultsArea = document.getElementById('audioAnalysisResults');
  if (resultsArea) resultsArea.style.display = 'block';
}

/**
 * ❌ MOSTRAR ERRO DA ANÁLISE
 * @param {string} message - Mensagem de erro
 */
function showAnalysisError(message) {
  const uploadArea = document.getElementById('audioUploadArea');
  const loadingArea = document.getElementById('audioAnalysisLoading');
  const resultsArea = document.getElementById('audioAnalysisResults');
  
  if (loadingArea) loadingArea.style.display = 'none';
  if (resultsArea) resultsArea.style.display = 'none';
  if (uploadArea) uploadArea.style.display = 'block';
  
  // Mostrar erro na área de upload
  const uploadContent = uploadArea?.querySelector('.upload-content');
  if (uploadContent) {
    uploadContent.innerHTML = `
      <div class="upload-icon error">❌</div>
      <h4 style="color: #ff6b6b;">Erro na Análise</h4>
      <p style="color: #ff6b6b;">${message}</p>
      <button onclick="resetAudioModal()" class="upload-btn" style="background: #ff6b6b;">
        Tentar Novamente
      </button>
    `;
  }
}

/**
 * 🔄 RESETAR MODAL DE ÁUDIO
 */
function resetAudioModal() {
  const uploadArea = document.getElementById('audioUploadArea');
  const loadingArea = document.getElementById('audioAnalysisLoading');
  const resultsArea = document.getElementById('audioAnalysisResults');
  
  if (uploadArea) uploadArea.style.display = 'block';
  if (loadingArea) loadingArea.style.display = 'none';
  if (resultsArea) resultsArea.style.display = 'none';
  
  // Reset do input
  const fileInput = document.getElementById('modalAudioFileInput');
  if (fileInput) fileInput.value = '';
  
  // Reset do estado
  AudioAnalysisState.currentJob = null;
  AudioAnalysisState.isProcessing = false;
  AudioAnalysisState.uploadProgress = 0;
  AudioAnalysisState.analysisProgress = 0;
  AudioAnalysisState.currentFile = null;
  
  if (AudioAnalysisState.pollingInterval) {
    clearInterval(AudioAnalysisState.pollingInterval);
    AudioAnalysisState.pollingInterval = null;
  }
  
  // Restaurar conteúdo original da área de upload
  const uploadContent = uploadArea?.querySelector('.upload-content');
  if (uploadContent) {
    uploadContent.innerHTML = `
      <div class="upload-icon">🎵</div>
      <h4>Analisar seu áudio</h4>
      <p>Arraste seu arquivo aqui ou clique para selecionar</p>
      <p class="supported-formats">Suporta: WAV, FLAC, MP3 (máx. 60MB)</p>
      <p class="format-recommendation">💡 Prefira WAV ou FLAC para maior precisão na análise</p>
      <input type="file" id="modalAudioFileInput" 
             accept="audio/wav,audio/flac,audio/mp3,audio/mpeg,.wav,.flac,.mp3" 
             style="position:absolute;left:-9999px;opacity:0;width:1px;height:1px;" tabindex="-1">
      <label for="modalAudioFileInput"
          class="upload-btn"
          style="touch-action: manipulation; -webkit-tap-highlight-color: rgba(0, 150, 255, 0.3); width:100%; pointer-events:auto; display:inline-block; text-align:center; cursor:pointer;">
          Escolher Arquivo
      </label>
    `;
  }
  
  log('🔄 Modal resetado');
}

/**
 * ⚡ ATUALIZAR PROGRESSO
 * @param {string} message - Mensagem de progresso
 * @param {number} percentage - Porcentagem (0-100)
 */
function updateProgress(message, percentage) {
  const progressText = document.getElementById('audioProgressText');
  const progressFill = document.getElementById('audioProgressFill');
  
  if (progressText) progressText.textContent = message;
  if (progressFill) progressFill.style.width = `${Math.min(percentage, 100)}%`;
  
  if (BACKEND_CONFIG.DEBUG_MODE) {
    log(`📊 Progresso: ${percentage.toFixed(1)}% - ${message}`);
  }
}

/**
 * 🛠️ UTILITÁRIOS
 */

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function log(...args) {
  if (BACKEND_CONFIG.DEBUG_MODE) {
    console.log('[BACKEND-AUDIO]', ...args);
  }
}

/**
 * 🎯 INTEGRAÇÃO COM O MODAL EXISTENTE
 */

// Conectar o input de arquivo ao sistema backend
function setupFileInput() {
  const fileInput = document.getElementById('modalAudioFileInput');
  if (fileInput && !fileInput.hasAttribute('data-backend-setup')) {
    fileInput.addEventListener('change', async function(event) {
      const file = event.target.files[0];
      if (file) {
        log('📁 Arquivo selecionado:', file.name);
        try {
          await analyzeWithBackend(file);
        } catch (error) {
          console.error('❌ Erro na análise:', error);
        }
      }
    });
    
    fileInput.setAttribute('data-backend-setup', 'true');
    log('✅ Input de arquivo conectado ao backend');
  }
}

// Tornar setupFileInput disponível globalmente
window.setupFileInput = setupFileInput;

document.addEventListener('DOMContentLoaded', function() {
  log('🚀 Inicializando sistema de análise backend');
  
  // Setup inicial
  setupFileInput();
  
  // Observer para quando o modal for recriado
  const modalContainer = document.getElementById('audioAnalysisModal');
  if (modalContainer) {
    const observer = new MutationObserver(() => {
      setupFileInput();
    });
    observer.observe(modalContainer, { childList: true, subtree: true });
  }
});

/**
 * 🌐 FUNÇÕES GLOBAIS PARA INTEGRAÇÃO
 */

// Função global para ser chamada por outros scripts
window.analyzeWithBackend = analyzeWithBackend;
window.resetAudioModal = resetAudioModal;

// Função para enviar resultados para o chat (integração existente)
window.sendModalAnalysisToChat = function() {
  log('💬 Enviando resultados para o chat');
  
  const technicalData = document.getElementById('modalTechnicalData');
  if (!technicalData || !technicalData.innerHTML.trim()) {
    alert('Nenhuma análise para enviar. Faça uma análise primeiro.');
    return;
  }
  
  // Extrair dados básicos para o chat
  const scoreElement = technicalData.querySelector('.score-value');
  const classificationElement = technicalData.querySelector('.score-label');
  
  const score = scoreElement?.textContent || 'N/A';
  const classification = classificationElement?.textContent || 'N/A';
  
  const message = `🎵 Análise de áudio concluída:\n\nScore: ${score}\nClassificação: ${classification}\n\nProcessado pelo backend Node.js (Zero Web Audio API)`;
  
  // Enviar para o chat (função existente)
  if (typeof window.addMessageToChat === 'function') {
    window.addMessageToChat('user', message);
  } else {
    // Fallback: adicionar ao input do chat
    const chatInput = document.querySelector('.chat-text-input');
    if (chatInput) {
      chatInput.value = message;
    }
  }
  
  log('✅ Resultados enviados para o chat');
};

// Função para download do relatório (integração existente)  
window.downloadModalAnalysis = function() {
  log('📄 Gerando relatório de download');
  
  if (!AudioAnalysisState.currentFile) {
    alert('Nenhuma análise para baixar.');
    return;
  }
  
  // Criar relatório simples em texto
  const technicalData = document.getElementById('modalTechnicalData');
  const content = `
RELATÓRIO DE ANÁLISE DE ÁUDIO
=============================

Arquivo: ${AudioAnalysisState.currentFile.name}
Tamanho: ${formatFileSize(AudioAnalysisState.currentFile.size)}
Data: ${new Date().toLocaleString('pt-BR')}

${technicalData?.textContent || 'Dados não disponíveis'}

=============================
Gerado pelo SoundyAI Backend (Node.js Fases 5.1-5.5)
Zero dependências Web Audio API
  `.trim();
  
  // Download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analise_${AudioAnalysisState.currentFile.name}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  log('✅ Relatório baixado');
};

console.log('✅ Sistema de Análise Backend carregado completamente');
console.log('🎯 Funções disponíveis:');
console.log('   - analyzeWithBackend(file)');
console.log('   - resetAudioModal()'); 
console.log('   - sendModalAnalysisToChat()');
console.log('   - downloadModalAnalysis()');
console.log('🚀 Pronto para análises usando 100% backend Node.js!');
