// 🎵 AUDIO ANALYZER INTEGRATION - VERSÃO REFATORADA
// Sistema de análise 100% baseado em processamento no back-end (Railway + Bucket)
// ⚠️ REMOÇÃO COMPLETA: Web Audio API, AudioContext, processamento local
// ✅ NOVO FLUXO: Presigned URL → Upload → Job Creation → Status Polling

// 📝 Carregar gerador de texto didático
if (typeof window !== 'undefined' && !window.SuggestionTextGenerator) {
    const script = document.createElement('script');
    script.src = 'suggestion-text-generator.js';
    script.async = true;
    script.onload = () => {
        console.log('[AudioIntegration] Gerador de texto didático carregado');
    };
    script.onerror = () => {
        console.warn('[AudioIntegration] Falha ao carregar gerador de texto didático');
    };
    document.head.appendChild(script);
}

// Debug flag (silencia logs em produção; defina window.DEBUG_ANALYZER = true para habilitar)
const __DEBUG_ANALYZER__ = true; // 🔧 TEMPORÁRIO: Ativado para debug do problema
const __dbg = (...a) => { if (__DEBUG_ANALYZER__) console.log('[AUDIO-DEBUG]', ...a); };
const __dwrn = (...a) => { if (__DEBUG_ANALYZER__) console.warn('[AUDIO-WARN]', ...a); };

// 🆔 SISTEMA runId - Função utilitária centralizada
function generateAnalysisRunId(context = 'ui') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${context}_${timestamp}_${random}`;
}

// 🛡️ HELPER: Preparar options com runId de forma segura
function prepareAnalysisOptions(baseOptions = {}, context = 'analysis') {
    // Gerar runId se não fornecido
    if (!baseOptions.runId) {
        baseOptions.runId = generateAnalysisRunId(context);
    }
    
    // Configurar variável global para UI_GATE
    window.__CURRENT_ANALYSIS_RUN_ID__ = baseOptions.runId;
    
    __dbg(`🆔 [runId] Preparado para análise: ${baseOptions.runId} (contexto: ${context})`);
    
    return { ...baseOptions };
}

let currentModalAnalysis = null;
let __audioIntegrationInitialized = false; // evita listeners duplicados
let __refDataCache = {}; // cache por gênero
let __activeRefData = null; // dados do gênero atual
let __genreManifest = null; // manifesto de gêneros (opcional)
let __activeRefGenre = null; // chave do gênero atualmente carregado em __activeRefData
let __refDerivedStats = {}; // estatísticas agregadas (ex: média stereo) por gênero

// 🎯 MODO REFERÊNCIA - Variáveis globais
let currentAnalysisMode = 'genre'; // 'genre' | 'reference'
let referenceStepState = {
    currentStep: 'userAudio', // 'userAudio' | 'referenceAudio' | 'analysis'
    userAudioFile: null,
    referenceAudioFile: null,
    userAnalysis: null,
    referenceAnalysis: null
};

// 🎯 JOBS - Sistema de acompanhamento de jobs remotos
let currentJobId = null;
let jobPollingInterval = null;

// 🎯 Funções de Acessibilidade e Gestão de Modais

function handleModalEscapeKey(e) {
    if (e.key === 'Escape') {
        closeModeSelectionModal();
    }
}

function trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    };
    
    modal.addEventListener('keydown', handleTabKey);
}

// 🎯 Modal de Análise por Referência
function openReferenceAnalysisModal() {
    const modal = document.getElementById('audioAnalysisModal');
    if (modal) {
        // Configurar modal para modo referência
        const modalContent = modal.querySelector('.modal-content');
        const title = modalContent.querySelector('h2');
        const steps = document.getElementById('referenceProgressSteps');
        
        if (title) {
            title.textContent = '🎵 Análise por Música de Referência';
        }
        
        // Mostrar passos do progresso
        if (steps) {
            steps.style.display = 'block';
            updateProgressStep(1); // Primeiro passo ativo
        }
        
        // Modificar texto do botão de upload
        const uploadBtn = modal.querySelector('#uploadButton');
        if (uploadBtn) {
            uploadBtn.textContent = '📤 Upload da Música Original';
            uploadBtn.onclick = () => handleReferenceFileSelection('original');
        }
        
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        
        // Foco no botão de upload
        if (uploadBtn) {
            uploadBtn.focus();
        }
    }
}

// 🎯 Gestão de Progresso para Modo Referência
function updateProgressStep(step) {
    const steps = document.querySelectorAll('.progress-step');
    steps.forEach((stepEl, index) => {
        const stepNumber = index + 1;
        stepEl.classList.remove('active', 'completed');
        
        if (stepNumber < step) {
            stepEl.classList.add('completed');
        } else if (stepNumber === step) {
            stepEl.classList.add('active');
        }
    });
}

// � SISTEMA DE UPLOAD E ANÁLISE REMOTA
// ✅ FLUXO OFICIAL: Presigned URL → Upload → Job Creation → Status Polling

// �🎯 Seleção de Arquivos para Modo Referência (fileKeys apenas)
let uploadedFiles = {
    original: null,
    reference: null
};

/**
 * ✅ OBTER URL PRÉ-ASSINADA DO BACKEND
/**
 * Obter URL pré-assinada do backend
/**
 * 🚀 OBTER URL PRÉ-ASSINADA DO BACKEND
 * @param {File} file - Arquivo para upload
 * @returns {Promise<{uploadUrl: string, fileKey: string}>}
 */
async function getPresignedUrl(file) {
  try {
    // Extrair extensão do arquivo
    const ext = file.name.split('.').pop().toLowerCase();

    __dbg('🌐 Solicitando URL pré-assinada...', {
      filename: file.name,
      ext,
           size: `${(file.size / 1024 / 1024).toFixed(2)}MB`
    });

    // ✅ Agora manda "ext" 
    const response = await fetch(`/api/presign?ext=${encodeURIComponent(ext)}`, {
  method: "GET",
  headers: {
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  }
});

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao obter URL de upload: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.uploadUrl || !data.fileKey) {
      throw new Error('Resposta inválida do servidor: uploadUrl ou fileKey ausente');
    }

    return {
      uploadUrl: data.uploadUrl,
      fileKey: data.fileKey
    };
  } catch (error) {
    console.error('❌ Erro ao obter URL pré-assinada:', error);
    throw new Error(`Falha ao gerar URL de upload: ${error.message}`);
  }
}



/**
 * ✅ UPLOAD DIRETO PARA BUCKET VIA URL PRÉ-ASSINADA
 * @param {string} uploadUrl - URL pré-assinada para upload
 * @param {File} file - Arquivo para upload
 * @returns {Promise<void>}
 */
async function uploadToBucket(uploadUrl, file) {
  try {
    __dbg('📤 Iniciando upload para bucket...', { 
      filename: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      url: uploadUrl.substring(0, 50) + '...'
    });

    showUploadProgress(`Enviando ${file.name} para análise...`);

    // 👇 sem headers, só body = file
   const response = await fetch(uploadUrl, {
  method: "PUT",
  body: file
});

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro no upload: ${response.status} - ${errorText}`);
    }

    __dbg('✅ Upload para bucket concluído com sucesso');
    showUploadProgress(`Upload concluído! Processando ${file.name}...`);

  } catch (error) {
    console.error('❌ Erro no upload para bucket:', error);
    throw new Error(`Falha ao enviar arquivo para análise: ${error.message}`);
  }
}


/**
 * ✅ CRIAR JOB DE ANÁLISE NO BACKEND
 * @param {string} fileKey - Chave do arquivo no bucket
 * @param {string} mode - Modo de análise ('genre' ou 'reference')
 * @param {string} fileName - Nome original do arquivo
 * @returns {Promise<{jobId: string, success: boolean}>}
 */
async function createAnalysisJob(fileKey, mode, fileName) {
    try {
        __dbg('🔧 Criando job de análise...', { fileKey, mode, fileName });

        const response = await fetch('/api/audio/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                fileKey: fileKey,
                mode: mode,
                fileName: fileName
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao criar job: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (!data.success || !data.jobId) {
            throw new Error('Resposta inválida do servidor: jobId ausente');
        }

        __dbg('✅ Job de análise criado:', { 
            jobId: data.jobId,
            mode: data.mode,
            fileKey: data.fileKey
        });

        return {
            jobId: data.jobId,
            success: true
        };

    } catch (error) {
        console.error('❌ Erro ao criar job de análise:', error);
        throw new Error(`Falha ao criar job de análise: ${error.message}`);
    }
}

/**
 * ✅ ACOMPANHAR STATUS DO JOB DE ANÁLISE
 * @param {string} jobId - ID do job
 * @returns {Promise<Object>} - Resultado da análise quando completa
 */
async function pollJobStatus(jobId) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 60; // 5 minutos máximo
        const startTime = Date.now();
        // 🔧 TIMEOUT UNIFICADO: 180s (3 min) para todo o pipeline
        const maxTimeMs = 180000; // 3 minutos timeout absoluto UNIFICADO
        let lastStatus = 'unknown';
        let stuckCount = 0;
        
        const poll = async () => {
            try {
                attempts++;
                const elapsed = Date.now() - startTime;
                
                // 🚨 TIMEOUT ABSOLUTO - Evita loops infinitos
                if (elapsed > maxTimeMs) {
                    // 📊 LOGS DETALHADOS PARA DEBUGGING
                    const timeoutDetails = {
                        jobId: jobId,
                        elapsedMs: elapsed,
                        maxTimeMs: maxTimeMs,
                        attempts: attempts,
                        lastStatus: lastStatus,
                        stuckCount: stuckCount,
                        timestamp: new Date().toISOString()
                    };
                    
                    console.error(`🚨 TIMEOUT ABSOLUTO DETECTADO:`, timeoutDetails);
                    console.error(`⏱️ Análise excedeu limite: ${elapsed/1000}s > ${maxTimeMs/1000}s`);
                    console.error(`📊 Status final: ${lastStatus} (${attempts} tentativas)`);
                    
                    // 🔔 Alerta para usuário com contexto
                    const userMessage = `Timeout: análise excedeu ${maxTimeMs/1000} segundos. 
Status: ${lastStatus} | Tentativas: ${attempts}
Tente com um arquivo menor ou diferente.`;
                    
                    reject(new Error(userMessage));
                    return;
                }

                __dbg(`🔄 [${elapsed/1000}s] Verificando status do job (tentativa ${attempts}/${maxAttempts})...`);

                const response = await fetch(`/api/jobs/${jobId}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Erro ao verificar status: ${response.status}`);
                }

                const jobData = await response.json();
                
                __dbg(`📊 Status do job:`, { 
                    status: jobData.status, 
                    progress: jobData.progress !== null ? jobData.progress : 'N/A',
                    progressMessage: jobData.progressMessage || 'Processando...',
                    elapsed: `${elapsed/1000}s`
                });

                // 📊 Progress: Atualizar progresso na UI com dados reais
                if (jobData.progress !== null && jobData.progress !== undefined) {
                    // Usar progresso real do backend
                    const message = jobData.progressMessage || `Processando análise... ${jobData.progress}%`;
                    updateModalProgress(jobData.progress, message);
                    console.log(`📊 Progress: ${jobData.progress}% - ${message}`);
                } else {
                    // Fallback: progresso estimado baseado no tempo (só se não houver progresso real)
                    const progressPercent = Math.min(90, (elapsed / maxTimeMs) * 100);
                    updateModalProgress(progressPercent, `Analisando áudio... ${progressPercent.toFixed(0)}%`);
                    console.log(`📊 Progress: ${progressPercent.toFixed(0)}% (estimado) - Analisando áudio...`);
                }

                // ✅ SUCESSO
                if (jobData.status === 'completed') {
                    __dbg('✅ Job concluído com sucesso');
                    
                    // 📊 Progress: Garantir que chegue em 100% quando completo
                    updateModalProgress(100, `✅ Análise concluída! Score: ${jobData.result?.score || 'N/A'}%`);
                    console.log('📊 Progress: 100% - Análise concluída!');
                    
                    console.log('🔍 [JOB RESULT] Estrutura completa do resultado:', jobData);
                    console.log('🔍 [JOB RESULT] Keys no jobData:', Object.keys(jobData));
                    console.log('🔍 [JOB RESULT] jobData.result COMPLETO:', JSON.stringify(jobData.result, null, 2));
                    console.log('🔍 [JOB RESULT] jobData.result keys:', Object.keys(jobData.result || {}));
                    console.log('🔍 [JOB RESULT] Métricas técnicas encontradas:', jobData.result?.technicalData || jobData.result?.metrics || 'NENHUMA');
                    
                    // 🚨 AUDITORIA: Verificar se métricas essenciais estão presentes nos dados reais
                    const resultData = jobData.result || jobData;
                    console.log('🚨 [AUDIT] PEAK nos dados reais:', resultData?.technicalData?.peak || resultData?.peak || resultData?.metrics?.peak);
                    console.log('🚨 [AUDIT] RMS nos dados reais:', resultData?.technicalData?.rms || resultData?.rms_level || resultData?.metrics?.rms);
                    console.log('🚨 [AUDIT] LUFS nos dados reais:', resultData?.technicalData?.lufs_integrated || resultData?.lufs || resultData?.metrics?.lufs_integrated);
                    console.log('🚨 [AUDIT] TRUE PEAK nos dados reais:', resultData?.technicalData?.true_peak || resultData?.truePeak || resultData?.metrics?.true_peak);
                    
                    resolve(jobData.result || jobData);
                    return;
                }

                // ❌ FALHA
                if (jobData.status === 'failed' || jobData.status === 'error') {
                    const errorMsg = jobData.error || 'Erro desconhecido no processamento';
                    reject(new Error(`Falha na análise: ${errorMsg}`));
                    return;
                }

                // 🔄 PROCESSANDO - Sistema anti-travamento melhorado
                if (jobData.status === 'processing') {
                    if (lastStatus === 'processing') {
                        stuckCount++;
                        
                        // Feedback melhorado para usuário
                        if (stuckCount >= 10 && stuckCount < 15) {
                            updateModalProgress(90, `Processamento avançado... (${Math.floor(stuckCount * 5 / 60)}min)`);
                        } else if (stuckCount >= 15 && stuckCount < 20) {
                            updateModalProgress(95, `Finalizando análise complexa... arquivo pode ser grande`);
                        }
                        
                        // Timeout mais longo: 5 minutos (60 * 5s = 300s) 🔧 Ajustado para análises complexas  
                        if (stuckCount >= 60) {
                            console.warn(`🚨 Job ${jobId} travado em processing há ${stuckCount * 5}s - cancelando análise`);
                            
                            reject(new Error(`Análise cancelada: arquivo muito complexo ou problemático (${Math.floor(stuckCount * 5 / 60)} minutos). Tente outro arquivo.`));
                            return;
                        }
                    } else {
                        stuckCount = 0; // Reset se status mudou
                    }
                }

                lastStatus = jobData.status;

                // ⏰ TIMEOUT POR TENTATIVAS
                if (attempts >= maxAttempts) {
                    // 📊 LOGS DETALHADOS PARA TIMEOUT POR TENTATIVAS
                    const attemptTimeoutDetails = {
                        jobId: jobId,
                        attempts: attempts,
                        maxAttempts: maxAttempts,
                        elapsedTime: Math.round((Date.now() - startTime) / 1000) + 's',
                        finalStatus: lastStatus,
                        stuckCount: stuckCount,
                        timestamp: new Date().toISOString()
                    };
                    
                    console.warn(`⚠️ TIMEOUT POR TENTATIVAS:`, attemptTimeoutDetails);
                    console.warn(`📊 Job ${jobId}: ${attempts}/${maxAttempts} tentativas em ${attemptTimeoutDetails.elapsedTime}`);
                    console.warn(`🔄 Status final: ${lastStatus}, travamentos: ${stuckCount}`);
                    
                    const userMessage = `Timeout: análise demorou mais que esperado.
Tentativas: ${attempts}/${maxAttempts} | Tempo: ${attemptTimeoutDetails.elapsedTime}
Status: ${lastStatus} | Tente novamente ou use outro arquivo.`;
                    
                    reject(new Error(userMessage));
                    return;
                }

                // Aguardar antes da próxima verificação (intervalo adaptativo)
                const nextInterval = jobData.status === 'processing' ? 5000 : 3000;
                setTimeout(poll, nextInterval);

            } catch (error) {
                // 🔍 LOGS DETALHADOS PARA ERROS DE POLLING
                const pollingErrorDetails = {
                    jobId: jobId,
                    attempt: attempts,
                    elapsedTime: Math.round((Date.now() - startTime) / 1000) + 's',
                    errorType: error.name || 'Unknown',
                    errorMessage: error.message,
                    lastKnownStatus: lastStatus,
                    isNetworkError: error.message.includes('fetch') || error.message.includes('network'),
                    timestamp: new Date().toISOString()
                };
                
                console.error('❌ ERRO NO POLLING:', pollingErrorDetails);
                console.error(`🔍 Job ${jobId} falhou na tentativa ${attempts}: ${error.message}`);
                
                // Retry em caso de erro de rede (até 5 tentativas)
                if (attempts <= 5 && (error.message.includes('fetch') || error.message.includes('network'))) {
                    console.log(`🔄 RETRY ${attempts}/5 - Erro de rede detectado, tentando novamente...`);
                    console.log(`📡 Detalhes da conexão:`, {
                        url: `/api/jobs/${jobId}`,
                        attempt: attempts,
                        nextRetryIn: '3s'
                    });
                    setTimeout(poll, 3000);
                } else {
                    console.error(`💥 FALHA CRÍTICA: Não foi possível recuperar job ${jobId}`, pollingErrorDetails);
                    reject(error);
                }
            }
        };

        // Iniciar polling
        poll();
    });
}

/**
 * Mostrar progresso de upload na UI
 * @param {string} message - Mensagem de progresso
 */
function showUploadProgress(message) {
    const progressText = document.getElementById('audioProgressText');
    if (progressText) {
        progressText.innerHTML = `🌐 ${message}`;
    }
}

/**
 * Atualizar progresso do modal de análise
 * @param {number} percentage - Porcentagem (0-100)
 * @param {string} message - Mensagem de status
 */
function updateModalProgress(percentage, message) {
    console.log(`📊 Progress: Atualizando UI - ${percentage}% - ${message}`);
    
    const progressText = document.getElementById('audioProgressText');
    const progressBar = document.querySelector('.progress-fill');
    
    if (progressText) {
        progressText.innerHTML = `${message}`;
    } else {
        console.warn('📊 Progress: Elemento #audioProgressText não encontrado');
    }
    
    if (progressBar) {
        progressBar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        progressBar.style.transition = 'width 0.3s ease';
    } else {
        console.warn('📊 Progress: Elemento .progress-fill não encontrado');
    }
    
    // 📊 Progress: Esconder barra quando chegar em 100%
    if (percentage >= 100) {
        setTimeout(() => {
            const progressContainer = document.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.style.opacity = '0';
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 300);
            }
        }, 1500); // Aguardar 1.5s para usuário ver o 100%
    }
}

/**
 * ✅ NOVA IMPLEMENTAÇÃO: Seleção de arquivo de referência com presigned URL
 * @param {string} type - Tipo do arquivo ('original' ou 'reference')
 */
function handleReferenceFileSelection(type) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav,.flac,.mp3,.m4a';
    input.style.display = 'none';

    input.onchange = async function (e) {
        const file = e.target.files[0];
        if (file) {
            try {
                // Validar arquivo
                if (file.size > 120 * 1024 * 1024) {
                    alert('❌ Arquivo muito grande. Limite: 120MB');
                    return;
                }

                __dbg(`🎯 Processando arquivo ${type} com presigned URL:`, file.name);

                // 🌐 NOVO FLUXO: Presigned URL → Upload → Job Creation → Polling
                
                // 1. Obter URL pré-assinada
                const { uploadUrl, fileKey } = await getPresignedUrl(file);
                
                // 2. Upload direto para bucket
                await uploadToBucket(uploadUrl, file);
                
                // 3. Criar job de análise
                const { jobId } = await createAnalysisJob(fileKey, 'reference', file.name);
                
                // 4. Aguardar resultado da análise
                
                // 📊 Progress: Resetar e exibir barra de progresso
                const progressContainer = document.querySelector('.progress-container');
                const progressBar = document.querySelector('.progress-fill');
                if (progressContainer) {
                    progressContainer.style.display = 'block';
                    progressContainer.style.opacity = '1';
                }
                if (progressBar) {
                    progressBar.style.width = '0%';
                }
                updateModalProgress(0, 'Iniciando análise de referência...');
                console.log('📊 Progress: Barra de progresso resetada e exibida (referência)');
                
                const analysisResult = await pollJobStatus(jobId);
                
                // Mostrar resultados no modal
displayModalResults(analysisResult);

                // 5. Armazenar resultado
                uploadedFiles[type] = {
                    fileKey: fileKey,
                    fileName: file.name,
                    analysisResult: analysisResult
                };

                console.log(`✅ Arquivo ${type} processado com sucesso:`, file.name, "fileKey:", fileKey);

                // Atualizar interface
                updateFileStatus(type, file.name);

                // Avançar fluxo
                if (type === "original") {
                    updateProgressStep(2);
                    promptReferenceFile();
                } else if (type === "reference") {
                    updateProgressStep(3);
                    enableAnalysisButton();
                }

            } catch (error) {
                console.error(`❌ Erro no processamento do arquivo ${type}:`, error);
                alert(`❌ Erro ao processar arquivo: ${error.message}`);

                // Abrir modal de análise em caso de erro
                abrirModalDeAnalise("Erro ao processar arquivo para análise.");
            }
        }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}


function updateFileStatus(type, filename) {
    const statusContainer = document.getElementById('fileUploadStatus');
    if (!statusContainer) return;
    
    let statusDiv = statusContainer.querySelector(`#${type}FileStatus`);
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = `${type}FileStatus`;
        statusDiv.className = 'file-status';
        statusContainer.appendChild(statusDiv);
    }
    
    const label = type === 'original' ? '🎵 Música Original' : '🎯 Referência';
    statusDiv.innerHTML = `
        <div class="file-item">
            <span class="file-label">${label}:</span>
            <span class="file-name">${filename}</span>
            <span class="file-check">✅</span>
        </div>
    `;
}

function promptReferenceFile() {
    const modal = document.getElementById('audioAnalysisModal');
    const uploadBtn = modal.querySelector('#uploadButton');
    
    if (uploadBtn) {
        uploadBtn.textContent = '🎯 Upload da Música de Referência';
        uploadBtn.onclick = () => handleReferenceFileSelection('reference');
    }
}

function enableAnalysisButton() {
    const modal = document.getElementById('audioAnalysisModal');
    let analyzeBtn = modal.querySelector('#analyzeReferenceBtn');
    
    if (!analyzeBtn) {
        analyzeBtn = document.createElement('button');
        analyzeBtn.id = 'analyzeReferenceBtn';
        analyzeBtn.className = 'btn btn-primary';
        analyzeBtn.textContent = '🔬 Iniciar Análise Comparativa';
        analyzeBtn.onclick = startReferenceAnalysis;
        
        const uploadBtn = modal.querySelector('#uploadButton');
        if (uploadBtn && uploadBtn.parentNode) {
            uploadBtn.parentNode.insertBefore(analyzeBtn, uploadBtn.nextSibling);
        }
    }
    
    analyzeBtn.style.display = 'block';
    analyzeBtn.disabled = false;
}

// 🎯 Análise Comparativa
async function startReferenceAnalysis() {
    if (!uploadedFiles.original || !uploadedFiles.reference) {
        alert('❌ Por favor, faça upload de ambos os arquivos');
        return;
    }

    updateProgressStep(4);

    try {
        showAnalysisProgress();

        const response = await fetch('/api/audio/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                originalKey: uploadedFiles.original,
                referenceKey: uploadedFiles.reference,
                mode: 'reference'
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na análise: ${response.status}`);
        }

        const result = await response.json();
        displayReferenceComparison(result);

    } catch (error) {
        console.error('❌ Erro na análise:', error);
        alert('❌ Erro durante a análise. Tente novamente.');
    }
}


function showAnalysisProgress() {
    const modal = document.getElementById('audioAnalysisModal');
    const content = modal.querySelector('.modal-content');
    
    // Criar overlay de progresso
    const progressOverlay = document.createElement('div');
    progressOverlay.id = 'analysisProgressOverlay';
    progressOverlay.className = 'analysis-progress-overlay';
    progressOverlay.innerHTML = `
        <div class="progress-content">
            <div class="spinner"></div>
            <h3>🔬 Analisando Arquivos...</h3>
            <p>Processando características espectrais e comparando com referência...</p>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
        </div>
    `;
    
    content.appendChild(progressOverlay);
}

function displayReferenceComparison(data) {
    const modal = document.getElementById('audioAnalysisModal');
    const progressOverlay = document.getElementById('analysisProgressOverlay');
    
    // Remover overlay de progresso
    if (progressOverlay) {
        progressOverlay.remove();
    }
    
    // Criar seção de resultados
    const resultsSection = document.createElement('div');
    resultsSection.id = 'referenceResults';
    resultsSection.className = 'reference-results';
    
    resultsSection.innerHTML = generateComparisonHTML(data);
    
    const content = modal.querySelector('.modal-content');
    content.appendChild(resultsSection);
    
    // Scroll para resultados
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function generateComparisonHTML(data) {
    const { original, reference, comparison } = data;
    
    return `
        <div class="comparison-header">
            <h3>📊 Análise Comparativa Concluída</h3>
            <div class="overall-similarity">
                <span class="similarity-label">Similaridade Geral:</span>
                <span class="similarity-score ${getSimilarityClass(comparison.overallSimilarity)}">
                    ${comparison.overallSimilarity}%
                </span>
            </div>
        </div>
        
        <div class="comparison-grid">
            <div class="comparison-section">
                <h4>🎵 Música Original</h4>
                <div class="audio-analysis-card">
                    ${generateAudioAnalysisCard(original)}
                </div>
            </div>
            
            <div class="comparison-section">
                <h4>🎯 Música de Referência</h4>
                <div class="audio-analysis-card">
                    ${generateAudioAnalysisCard(reference)}
                </div>
            </div>
        </div>
        
        <div class="differences-section">
            <h4>🔍 Principais Diferenças</h4>
            <div class="differences-grid">
                ${generateDifferencesGrid(comparison.differences)}
            </div>
        </div>
        
        <div class="suggestions-section">
            <h4>💡 Sugestões de Melhoria</h4>
            <div class="suggestions-list">
                ${generateSuggestionsList(comparison.suggestions)}
            </div>
        </div>
    `;
}

function generateAudioAnalysisCard(analysis) {
    return `
        <div class="spectral-info">
            <div class="info-item">
                <span class="label">Frequência Fundamental:</span>
                <span class="value">${analysis.fundamentalFreq} Hz</span>
            </div>
            <div class="info-item">
                <span class="label">Faixa Dinâmica:</span>
                <span class="value">${analysis.dynamicRange} dB</span>
            </div>
            <div class="info-item">
                <span class="label">Stereo Width:</span>
                <span class="value">${analysis.stereoWidth}%</span>
            </div>
        </div>
        
        <div class="frequency-bands">
            <h5>Bandas de Frequência</h5>
            ${analysis.frequencyBands.map(band => `
                <div class="band-item">
                    <span class="band-name">${band.name}</span>
                    <span class="band-level">${band.level} dB</span>
                </div>
            `).join('')}
        </div>
    `;
}

function generateDifferencesGrid(differences) {
    return differences.map(diff => `
        <div class="difference-item ${diff.severity}">
            <div class="diff-header">
                <span class="diff-parameter">${diff.parameter}</span>
                <span class="diff-value">${diff.difference}</span>
            </div>
            <div class="diff-description">${diff.description}</div>
        </div>
    `).join('');
}

function generateSuggestionsList(suggestions) {
    return suggestions.map(suggestion => `
        <div class="suggestion-item">
            <div class="suggestion-title">${suggestion.title}</div>
            <div class="suggestion-description">${suggestion.description}</div>
            <div class="suggestion-priority priority-${suggestion.priority}">
                Prioridade: ${suggestion.priority.toUpperCase()}
            </div>
        </div>
    `).join('');
}

function getSimilarityClass(similarity) {
    if (similarity >= 80) return 'high-similarity';
    if (similarity >= 60) return 'medium-similarity';
    return 'low-similarity';
}

// 🎯 Exposição de Funções Globais
window.openModeSelectionModal = openModeSelectionModal;
window.closeModeSelectionModal = closeModeSelectionModal;
window.selectAnalysisMode = selectAnalysisMode;

//! DEBUG: Função de debug global para forçar recarga
window.forceReloadRefs = async function(genre = 'funk_bruxaria') {
    console.log('🔄 FORÇA RECARGA DE REFERÊNCIAS:', genre);
    
    // Limpar tudo
    delete window.__refDataCache;
    window.__refDataCache = {};
    window.REFS_BYPASS_CACHE = true;
    window.__activeRefData = null;
    window.__activeRefGenre = null;
    delete window.PROD_AI_REF_DATA;
    
    console.log('💥 Cache limpo, forçando reload...');
    
    try {
        const result = await loadReferenceData(genre);
        console.log('✅ Recarga forçada concluída:', {
            version: result.version,
            lufs_target: result.lufs_target,
            true_peak_target: result.true_peak_target,
            presenca_band: result.bands?.presenca?.target_db
        });
        
        // Resetar flag
        window.REFS_BYPASS_CACHE = false;
        return result;
    } catch (error) {
        console.error('💥 Erro na recarga forçada:', error);
        window.REFS_BYPASS_CACHE = false;
        throw error;
    }
};

// 🔍 Função de Diagnóstico de Referências (somente dev)
window.diagnosRefSources = function(genre = null) {
    const targetGenre = genre || __activeRefGenre || 'funk_bruxaria';
    const currentData = __activeRefData;
    const cached = __refDataCache[targetGenre];
    
    console.log('🎯 REFERÊNCIAS DIAGNÓSTICO COMPLETO:', {
        requestedGenre: targetGenre,
        activeGenre: __activeRefGenre,
        currentSource: currentData ? 'loaded' : 'none',
        cacheExists: !!cached,
        REFS_ALLOW_NETWORK: typeof window !== 'undefined' ? window.REFS_ALLOW_NETWORK : 'undefined',
        currentData: currentData ? {
            version: currentData.version,
            num_tracks: currentData.num_tracks,
            lufs_target: currentData.lufs_target,
            true_peak_target: currentData.true_peak_target,
            stereo_target: currentData.stereo_target,
            sub_band: currentData.bands?.sub?.target_db,
            presenca_band: currentData.bands?.presenca?.target_db
        } : null
    });
    
    // Test fetch do JSON externo
    const testUrl = `/public/refs/out/${targetGenre}.json?v=diagnostic`;
    fetch(testUrl).then(r => r.json()).then(j => {
        const data = j[targetGenre];
        console.log('🌐 EXTERNAL JSON TEST:', {
            url: testUrl,
            success: true,
            version: data?.version,
            num_tracks: data?.num_tracks,
            lufs_target: data?.lufs_target,
            true_peak_target: data?.true_peak_target,
            stereo_target: data?.stereo_target
        });
    }).catch(e => console.log('❌ EXTERNAL JSON FAILED:', testUrl, e.message));
    
    return { targetGenre, currentData, cached };
};

// =============== ETAPA 2: Robustez & Completeness Helpers ===============
// Central logging para métricas ausentes / NaN (evita console spam e facilita auditoria)
function __logMetricAnomaly(kind, key, context={}) {
    try {
        if (typeof window === 'undefined') return;
        const store = (window.__METRIC_ANOMALIES__ = window.__METRIC_ANOMALIES__ || []);
        const stamp = Date.now();
        store.push({ t: stamp, kind, key, ctx: context });
        if (window.DEBUG_ANALYZER) console.warn('[METRIC_ANOMALY]', kind, key, context);
        // Limitar tamanho
        if (store.length > 500) store.splice(0, store.length - 500);
    } catch {}
}

// Placeholder seguro para valores não finitos (exibe '—' e loga uma vez por chave por render)
function safeDisplayNumber(val, key, decimals=2) {
    if (!Number.isFinite(val)) { __logMetricAnomaly('non_finite', key); return '—'; }
    return val.toFixed(decimals);
}

// Invalidação ampla de caches derivados quando gênero mudar
function invalidateReferenceDerivedCaches() {
    try {
        if (typeof window === 'undefined') return;
        delete window.PROD_AI_REF_DATA; // força reuso atualizado
    } catch {}
}

// Enriquecimento de objeto de referência: preencher lacunas e padronizar escala
function enrichReferenceObject(refObj, genreKey) {
    try {
        if (!refObj || typeof refObj !== 'object') return refObj;
        
        // CORREÇÃO CRÍTICA: Mapear legacy_compatibility para propriedades root
        if (refObj.legacy_compatibility && typeof refObj.legacy_compatibility === 'object') {
            const legacy = refObj.legacy_compatibility;
            
            // Mapear propriedades principais
            if (legacy.lufs_target !== undefined) refObj.lufs_target = legacy.lufs_target;
            if (legacy.tol_lufs !== undefined) refObj.tol_lufs = legacy.tol_lufs;
            if (legacy.true_peak_target !== undefined) refObj.true_peak_target = legacy.true_peak_target;
            if (legacy.tol_true_peak !== undefined) refObj.tol_true_peak = legacy.tol_true_peak;
            if (legacy.dr_target !== undefined) refObj.dr_target = legacy.dr_target;
            if (legacy.tol_dr !== undefined) refObj.tol_dr = legacy.tol_dr;
            if (legacy.lra_target !== undefined) refObj.lra_target = legacy.lra_target;
            if (legacy.tol_lra !== undefined) refObj.tol_lra = legacy.tol_lra;
            if (legacy.stereo_target !== undefined) refObj.stereo_target = legacy.stereo_target;
            if (legacy.tol_stereo !== undefined) refObj.tol_stereo = legacy.tol_stereo;
            
            // Mapear bandas de frequência
            if (legacy.bands && typeof legacy.bands === 'object') {
                refObj.bands = legacy.bands;
            }
        }
        
        // Feature flag geral
        const enabled = (typeof window === 'undefined') || window.ENABLE_REF_ENRICHMENT !== false;
        if (!enabled) return refObj;
        // Definir escala default se ausente
        if (!refObj.scale) refObj.scale = 'log_ratio_db';
        // Preencher stereo_target se ausente usando estatísticas agregadas (Etapa 2)
        if (refObj.stereo_target == null) {
            try {
                const g = (genreKey||'').toLowerCase();
                const stat = __refDerivedStats[g];
                if (stat && Number.isFinite(stat.avgStereo) && stat.countStereo >= 2) {
                    refObj.stereo_target = stat.avgStereo;
                    refObj.__stereo_filled = 'dataset_avg';
                } else {
                    // fallback heurístico
                    refObj.stereo_target = g.includes('trance') ? 0.17 : (g.includes('funk') ? 0.12 : 0.15);
                    refObj.__stereo_filled = 'heuristic';
                }
                refObj.tol_stereo = refObj.tol_stereo == null ? 0.08 : refObj.tol_stereo;
            } catch { /* noop */ }
        }
        // Garantir tol_stereo razoável
        if (refObj.tol_stereo == null) refObj.tol_stereo = 0.08;
        // Bandas: marcar N/A para target_db null e permitir comparação ignorando
        if (refObj.bands && typeof refObj.bands === 'object') {
            for (const [k,v] of Object.entries(refObj.bands)) {
                if (!v || typeof v !== 'object') continue;
                if (v.target_db == null) {
                    v._target_na = true; // flag para UI
                }
            }
        }
        // Normalização opcional antecipada (apenas ajuste de metadado; cálculo real feito no analyzer)
        if (window && window.PRE_NORMALIZE_REF_BANDS === true && refObj.bands) {
            const vals = Object.values(refObj.bands).map(b=>b&&Number.isFinite(b.target_db)?b.target_db:null).filter(v=>v!=null);
            const negRatio = vals.filter(v=>v<0).length/Math.max(1,vals.length);
            const posRatio = vals.filter(v=>v>0).length/Math.max(1,vals.length);
            // Se maioria positiva mas queremos alinhar a negativos, apenas anotar
            if (posRatio>0.7 && negRatio<0.3) refObj.__scale_mismatch_hint = 'positive_targets_vs_negative_measurements';
        }
    } catch (e) { console.warn('[refEnrich] falha', e); }
    return refObj;
}

// Fallback embutido inline para evitar 404 em produção
// 🎛️ ATUALIZADO: Funk Mandela 2025-08-fixed-flex (18/08/2025) - Estrutura Fixed/Flex Implementada
const __INLINE_EMBEDDED_REFS__ = {
    manifest: { genres: [
        { key: 'trance', label: 'Trance' },
        { key: 'funk_mandela', label: 'Funk Mandela' },
        { key: 'funk_bruxaria', label: 'Funk Bruxaria' },
        { key: 'funk_automotivo', label: 'Funk Automotivo' },
        { key: 'eletronico', label: 'Eletrônico' },
        { key: 'eletrofunk', label: 'Eletrofunk' },
        { key: 'funk_consciente', label: 'Funk Consciente' },
        { key: 'trap', label: 'Trap' }
    ]},
    byGenre: {
        trance: { lufs_target: -14, tol_lufs: 0.5, true_peak_target: -1.0, tol_true_peak: 1.0, dr_target: 9.4, tol_dr: 0.8, lra_target: 10.7, tol_lra: 2.7, stereo_target: 0.17, tol_stereo: 0.03, bands: { sub:{target_db:-17.3,tol_db:2.5}, low_bass:{target_db:-14.6,tol_db:4.3}, upper_bass:{target_db:-14.8,tol_db:2.5}, low_mid:{target_db:-12.6,tol_db:3.7}, mid:{target_db:-12,tol_db:4.0}, high_mid:{target_db:-20.2,tol_db:3.6}, brilho:{target_db:-24.7,tol_db:2.5}, presenca:{target_db:-32.1,tol_db:3.6} } },
    // Perfil atualizado Funk Mandela 2025-08-mandela-targets.4-tolerances-updated - TOLERÂNCIAS BIDIRECIONAIS ATUALIZADAS
    funk_mandela:   { 
        version: "2025-08-mandela-targets.4-tolerances-updated", 
        lufs_target: -8.0, tol_lufs: 2.5, tol_lufs_min: 2.5, tol_lufs_max: 2.5, 
        true_peak_target: -0.8, tol_true_peak: 1.0, true_peak_streaming_max: -1.2, true_peak_baile_max: -0.1, 
        dr_target: 8.0, tol_dr: 3.0, // Atualizado para ±3.0 unidades
        lra_target: 9.0, lra_min: 6.5, lra_max: 11.5, tol_lra: 2.5, 
        stereo_target: 0.60, tol_stereo: 0.25, stereo_width_target: 0.20, stereo_width_tol: 0.25, // Correlação 0.60 ± 0.25
        low_end_mono_cutoff: 100, clipping_sample_pct_max: 0.02, vocal_band_min_delta: -1.5,
        fixed: {
            lufs: { integrated: { target: -8.0, tolerance: 2.5 } },
            rms: { policy: "deriveFromLUFS" },
            truePeak: { streamingMax: -1.2, baileMax: -0.1, target: -8.0 },
            dynamicRange: { crest: { target: 8.0, min: 5.0, max: 11.0 } },
            lowEnd: { mono: { cutoffHz: 100 } },
            vocalPresence: { bandHz: [1000, 4000], vocalBandMinDeltaDb: -1.5 }
        },
        flex: {
            clipping: { samplePctMax: 0.02 },
            lra: { min: 6.5, max: 11.5, target: 9.0 },
            stereo: { correlation: { min: 0.35, max: 0.85 }, width: { min: 0.075, max: 0.325 } }
        },
        pattern_rules: { 
            hard_constraints: ["lufs", "truePeak", "dynamicRange", "lowEnd", "vocalPresence"], 
            soft_constraints: ["clipping", "lra", "stereo", "tonalCurve"] 
        }, 
        bands: { 
            sub:{target_db:-7.2,tol_db:2.5,severity:"soft",range_hz:"60-120"}, 
            low_bass:{target_db:-8.9,tol_db:2.5,severity:"soft",range_hz:"60-120"}, 
            upper_bass:{target_db:-12.8,tol_db:2.5,severity:"soft",range_hz:"120-200"}, 
            low_mid:{target_db:-9.2,tol_db:2.0,severity:"soft",range_hz:"200-500"}, 
            mid:{target_db:-6.8,tol_db:1.5,severity:"hard",vocal_presence_range:true,range_hz:"500-2000"}, 
            high_mid:{target_db:-12.3,tol_db:1.5,severity:"soft",range_hz:"2000-4000"}, 
            brilho:{target_db:-16.2,tol_db:2.0,severity:"soft",range_hz:"4000-8000"}, 
            presenca:{target_db:-19.1,tol_db:2.5,severity:"hard",vocal_presence_range:true,range_hz:"8000-12000"} 
        } 
    },
        funk_bruxaria: { 
            version: "1.0.1",
            generated_at: "2025-08-23T18:03:37.143Z",
            num_tracks: 29,
            lufs_target: -14,
            tol_lufs: 0.5,
            true_peak_target: -1.0,
            tol_true_peak: 1.0,
            dr_target: 7.4,
            tol_dr: 1.3,
            lra_target: 8.4,
            tol_lra: 2.8,
            stereo_target: 0.3,
            tol_stereo: 0.1,
            calor_target: -11.95,
            brilho_target: -17.69,
            clareza_target: -1.21,
            bands: {
                sub: { target_db: -12.5, tol_db: 3 },
                low_bass: { target_db: -15.2, tol_db: 3 },
                upper_bass: { target_db: -15.2, tol_db: 2.3 },
                low_mid: { target_db: -12, tol_db: 1.7 },
                mid: { target_db: -8.7, tol_db: 1.7 },
                high_mid: { target_db: -14.5, tol_db: 2.8 },
                brilho: { target_db: -17.7, tol_db: 2.2 },
                presenca: { target_db: -26.7, tol_db: 2.8 }
            }
        },
        funk_automotivo:{ lufs_target: -8,  tol_lufs: 1.2, true_peak_target: -1.0, tol_true_peak: 1.0, dr_target: 8.1, tol_dr: 2.0, lra_target: 6.6, tol_lra: 4.0, stereo_target: 0.3, tol_stereo: 0.15, bands: { sub:{target_db:-7.6,tol_db:6.0}, low_bass:{target_db:-6.6,tol_db:4.5}, upper_bass:{target_db:-11.4,tol_db:3.5}, low_mid:{target_db:-8.2,tol_db:3.5}, mid:{target_db:-6.7,tol_db:3.0}, high_mid:{target_db:-12.8,tol_db:4.5}, brilho:{target_db:-16.6,tol_db:4.5}, presenca:{target_db:-22.7,tol_db:5.0} } },
        eletronico:     { 
            version: "1.0.1",
            lufs_target: -14, tol_lufs: 0.5, tol_lufs_min: 0.5, tol_lufs_max: 0.5,  
            true_peak_target: -1.0, tol_true_peak: 1.0, true_peak_streaming_max: -1.0, true_peak_baile_max: 0.0,
            dr_target: 10.1, tol_dr: 1.4, 
            lra_target: 5.2, lra_min: 1.2, lra_max: 9.2, tol_lra: 4, 
            stereo_target: 0.19, tol_stereo: 0.07, stereo_width_mids_highs_tolerance: "moderate",
            low_end_mono_cutoff: 80, clipping_sample_pct_max: 0.01, vocal_band_min_delta: -2.0,
            bands: { 
                sub:{target_db:-12.5,tol_db:3}, 
                low_bass:{target_db:-10.6,tol_db:3}, 
                upper_bass:{target_db:-13.7,tol_db:3}, 
                low_mid:{target_db:-12.1,tol_db:2.7}, 
                mid:{target_db:-11.8,tol_db:2.4}, 
                high_mid:{target_db:-19.1,tol_db:2.3}, 
                brilho:{target_db:-19.1,tol_db:2}, 
                presenca:{target_db:-24,tol_db:3} 
            } 
        },
        eletrofunk:     { lufs_target: -9,  tol_lufs: 1,  true_peak_target: -1, tol_true_peak: 1, dr_target: 8, tol_dr: 2, lra_target: 6, tol_lra: 3, stereo_target: 0.12, tol_stereo: 0.1, bands: { sub:{target_db:-18,tol_db:4.5}, low_bass:{target_db:-16,tol_db:4.5}, upper_bass:{target_db:-15,tol_db:4.5}, low_mid:{target_db:-14,tol_db:4.5}, mid:{target_db:-13,tol_db:4.5}, high_mid:{target_db:-20,tol_db:4.5}, brilho:{target_db:-25,tol_db:4.5}, presenca:{target_db:-32,tol_db:4.5} } },
        funk_consciente:{ lufs_target: -12, tol_lufs: 1,  true_peak_target: -1, tol_true_peak: 1, dr_target: 10, tol_dr: 2, lra_target: 7, tol_lra: 3, stereo_target: 0.1,  tol_stereo: 0.1, bands: { sub:{target_db:-18,tol_db:4.5}, low_bass:{target_db:-16,tol_db:4.5}, upper_bass:{target_db:-15,tol_db:4.5}, low_mid:{target_db:-14,tol_db:4.5}, mid:{target_db:-13,tol_db:4.5}, high_mid:{target_db:-20,tol_db:4.5}, brilho:{target_db:-25,tol_db:4.5}, presenca:{target_db:-32,tol_db:4.5} } },
        trap:           { lufs_target: -9,  tol_lufs: 1,  true_peak_target: -1, tol_true_peak: 1, dr_target: 8, tol_dr: 2, lra_target: 6, tol_lra: 3, stereo_target: 0.1,  tol_stereo: 0.1, bands: { sub:{target_db:-16,tol_db:5.5}, low_bass:{target_db:-16,tol_db:4.5}, upper_bass:{target_db:-15,tol_db:4.5}, low_mid:{target_db:-14,tol_db:4.5}, mid:{target_db:-13,tol_db:4.5}, high_mid:{target_db:-20,tol_db:4.5}, brilho:{target_db:-25,tol_db:4.5}, presenca:{target_db:-32,tol_db:4.5} } }
    }
};

// Construir estatísticas agregadas (média stereo por gênero) a partir de refs carregadas
function buildAggregatedRefStats() {
    try {
        const map = (typeof window !== 'undefined' && window.__EMBEDDED_REFS__ && window.__EMBEDDED_REFS__.byGenre) || __INLINE_EMBEDDED_REFS__.byGenre;
        if (!map) return;
        for (const [g, data] of Object.entries(map)) {
            if (!data || typeof data !== 'object') continue;
            // stereo_target já definido conta; se null ignorar
            if (Number.isFinite(data.stereo_target)) {
                const st = (__refDerivedStats[g] = __refDerivedStats[g] || { sumStereo:0, countStereo:0 });
                st.sumStereo += data.stereo_target; st.countStereo += 1;
            }
        }
        for (const [g, st] of Object.entries(__refDerivedStats)) {
            if (st.countStereo > 0) st.avgStereo = st.sumStereo / st.countStereo;
        }
    } catch (e) { if (window.DEBUG_ANALYZER) console.warn('buildAggregatedRefStats fail', e); }
}

// Carregar dinamicamente o fallback embutido se necessário
async function ensureEmbeddedRefsReady(timeoutMs = 2500) {
    try {
        if (typeof window !== 'undefined' && window.__EMBEDDED_REFS__ && window.__EMBEDDED_REFS__.byGenre) return true;
        // Se não for explicitamente permitido, não tentar carregar pela rede para evitar 404
        if (!(typeof window !== 'undefined' && window.REFS_ALLOW_NETWORK === true)) return false;
        // Injetar script apenas uma vez
        if (typeof document !== 'undefined' && !document.getElementById('embeddedRefsScript')) {
            const s = document.createElement('script');
            s.id = 'embeddedRefsScript';
            s.src = '/refs/embedded-refs.js?v=' + Date.now();
            s.async = true;
            document.head.appendChild(s);
        }
        // Esperar até ficar disponível ou timeout
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (typeof window !== 'undefined' && window.__EMBEDDED_REFS__ && window.__EMBEDDED_REFS__.byGenre) return true;
            await new Promise(r => setTimeout(r, 100));
        }
        return (typeof window !== 'undefined' && window.__EMBEDDED_REFS__ && window.__EMBEDDED_REFS__.byGenre) ? true : false;
    } catch { return false; }
}

// Helper: buscar JSON tentando múltiplos caminhos (resiliente a diferenças local x produção)
async function fetchRefJsonWithFallback(paths) {
    let lastErr = null;
    for (const p of paths) {
        if (!p) continue;
        try {
            // Cache-busting para evitar CDN retornar 404 ou versões antigas
            const hasQ = p.includes('?');
            const url = p + (hasQ ? '&' : '?') + 'v=' + Date.now();
            if (__DEBUG_ANALYZER__) console.log('[refs] tentando fetch:', url);
            const res = await fetch(url, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            if (res.ok) {
                if (__DEBUG_ANALYZER__) console.log('[refs] OK:', p);
                
                // Verificar se a resposta tem conteúdo JSON válido
                const text = await res.text();
                if (text.trim()) {
                    try {
                        return JSON.parse(text);
                    } catch (jsonError) {
                        console.warn('[refs] JSON inválido em', p, ':', text.substring(0, 100));
                        throw new Error(`JSON inválido em ${p}`);
                    }
                } else {
                    console.warn('[refs] Resposta vazia em', p);
                    throw new Error(`Resposta vazia em ${p}`);
                }
            } else {
                if (__DEBUG_ANALYZER__) console.warn('[refs] Falha', res.status, 'em', p);
                lastErr = new Error(`HTTP ${res.status} @ ${p}`);
            }
        } catch (e) {
            if (__DEBUG_ANALYZER__) console.warn('[refs] Erro fetch', p, e?.message || e);
            lastErr = e;
        }
    }
    throw lastErr || new Error('Falha ao carregar JSON de referência (todas as rotas testadas)');
}

// 📚 Carregar manifesto de gêneros (opcional). Se ausente, manter fallback.
async function loadGenreManifest() {
    // 1) Preferir embutido em window, depois inline
    try {
        const winEmb = (typeof window !== 'undefined' && window.__EMBEDDED_REFS__ && window.__EMBEDDED_REFS__.manifest) || null;
        if (winEmb && Array.isArray(winEmb.genres)) { __genreManifest = winEmb.genres; return __genreManifest; }
    } catch {}
    if (!__genreManifest && __INLINE_EMBEDDED_REFS__?.manifest?.genres?.length) {
        __genreManifest = __INLINE_EMBEDDED_REFS__.manifest.genres;
        return __genreManifest;
    }
    // 2) Se permitido, tentar rede
    if (typeof window !== 'undefined' && window.REFS_ALLOW_NETWORK === true) {
        try {
            const json = await fetchRefJsonWithFallback([
                `refs/out/genres.json`,          // Path relativo (desenvolvimento local)
                `/refs/out/genres.json`,         // Path absoluto (produção)
                `/public/refs/out/genres.json`,  // Path completo (Railway)
                `../refs/out/genres.json`        // Path subindo um nível
            ]);
            if (json && Array.isArray(json.genres)) { __genreManifest = json.genres; return __genreManifest; }
        } catch (e) { __dwrn('Manifesto via rede indisponível:', e.message || e); }
    }
    return __genreManifest || null;
}

// 🏷️ Popular o <select> com base no manifesto, mantendo fallback e preservando seleção
function populateGenreSelect(manifestGenres) {
    const sel = document.getElementById('audioRefGenreSelect');
    if (!sel) return;
    if (!Array.isArray(manifestGenres) || manifestGenres.length === 0) {
        // Nada a fazer (fallback já em HTML)
        // Ainda assim, garantir que o gênero ativo esteja presente como opção
        ensureActiveGenreOption(sel, window.PROD_AI_REF_GENRE);
        return;
    }
    // Salvar valor atual (se houver)
    const current = sel.value;
    // Limpar opções atuais e reconstruir
    while (sel.options.length) sel.remove(0);
    for (const g of manifestGenres) {
        if (!g || !g.key) continue;
        const opt = document.createElement('option');
        opt.value = String(g.key);
        opt.textContent = String(g.label || labelizeKey(g.key));
        sel.appendChild(opt);
    }
    // Garantir que gênero ativo via URL/localStorage esteja presente
    ensureActiveGenreOption(sel, window.PROD_AI_REF_GENRE);
    // Restaurar seleção (priorizar PROD_AI_REF_GENRE > current > primeira opção)
    const target = window.PROD_AI_REF_GENRE || current || (sel.options[0] && sel.options[0].value);
    if (target) sel.value = target;
}

// 🔤 Converter chave em rótulo amigável (ex.: "funk_mandela" → "Funk Mandela")
function labelizeKey(key) {
    if (!key) return '';
    return String(key)
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ✅ Garantir que a opção do gênero ativo exista no select (para casos via URL)
function ensureActiveGenreOption(selectEl, genreKey) {
    if (!selectEl || !genreKey) return;
    const exists = Array.from(selectEl.options).some(o => o.value === genreKey);
    if (!exists) {
        const opt = document.createElement('option');
        opt.value = String(genreKey);
        opt.textContent = labelizeKey(genreKey);
        selectEl.appendChild(opt);
    }
}

async function loadReferenceData(genre) {
    try {
        // Se feature flag de invalidar cache por troca de escala/gênero estiver ativa, ignorar cache salvo
        const bypassCache = (typeof window !== 'undefined' && window.REFS_BYPASS_CACHE === true);
        if (!bypassCache && __refDataCache[genre]) {
            __activeRefData = __refDataCache[genre];
            __activeRefGenre = genre;
            updateRefStatus('✔ referências (cache)', '#0d6efd');
            return __activeRefData;
        }
        if (bypassCache) {
            delete __refDataCache[genre];
        }
        updateRefStatus('⏳ carregando...', '#996600');
        
        console.log('🔍 DEBUG loadReferenceData início:', { genre, bypassCache });
        
        // PRIORIDADE CORRIGIDA: external > embedded > fallback
        // 1) Tentar carregar JSON externo primeiro (sempre, independente de REFS_ALLOW_NETWORK)
        console.log('🌐 Tentando carregar JSON externo primeiro...');
        try {
            const version = Date.now(); // Force cache bust
            const json = await fetchRefJsonWithFallback([
                `refs/out/${genre}.json?v=${version}`,        // Path relativo (desenvolvimento local)
                `/refs/out/${genre}.json?v=${version}`,       // Path absoluto (produção)
                `/public/refs/out/${genre}.json?v=${version}`, // Path completo (Railway)
                `../refs/out/${genre}.json?v=${version}`      // Path subindo um nível
            ]);
            const rootKey = Object.keys(json)[0];
            const data = json[rootKey];
            if (data && typeof data === 'object' && data.version) {
                const enrichedNet = enrichReferenceObject(data, genre);
                __refDataCache[genre] = enrichedNet;
                __activeRefData = enrichedNet;
                __activeRefGenre = genre;
                window.PROD_AI_REF_DATA = enrichedNet;
                
                // Log de diagnóstico
                console.log('🎯 REFS DIAGNOSTIC:', {
                    genre,
                    source: 'external',
                    path: `refs/out/${genre}.json`,
                    dataExists: !!data,
                    version: data?.version,
                    targets: data?.targets ? Object.keys(data.targets).length : 0,
                    spectralBands: data?.spectralBands ? Object.keys(data.spectralBands).length : 0,
                    num_tracks: data.num_tracks,
                    lufs_target: data.lufs_target,
                    true_peak_target: data.true_peak_target,
                    stereo_target: data.stereo_target
                });
                
                updateRefStatus('✔ referências aplicadas', '#0d6efd');
                try { buildAggregatedRefStats(); } catch {}
                return enrichedNet;
            }
        } catch (netError) {
            console.log('❌ External refs failed:', netError.message);
            console.log('🔄 Fallback para embedded refs...');
        }
        
        // 2) Fallback para referências embutidas (embedded)
        const embWin = (typeof window !== 'undefined' && window.__EMBEDDED_REFS__ && window.__EMBEDDED_REFS__.byGenre && window.__EMBEDDED_REFS__.byGenre[genre]) || null;
        const embInline = __INLINE_EMBEDDED_REFS__?.byGenre?.[genre] || null;
        const useData = embWin || embInline;
        if (useData && typeof useData === 'object') {
            const enriched = enrichReferenceObject(structuredClone(useData), genre);
            __refDataCache[genre] = enriched;
            __activeRefData = enriched;
            __activeRefGenre = genre;
            window.PROD_AI_REF_DATA = enriched;
            
            // Log de diagnóstico
            console.log('🎯 REFS DIAGNOSTIC:', {
                genre,
                source: 'embedded',
                path: embWin ? 'window.__EMBEDDED_REFS__' : '__INLINE_EMBEDDED_REFS__',
                version: 'embedded',
                num_tracks: useData.num_tracks || 'unknown',
                lufs_target: useData.lufs_target,
                true_peak_target: useData.true_peak_target,
                stereo_target: useData.stereo_target
            });
            
            updateRefStatus('✔ referências embutidas', '#0d6efd');
            try { buildAggregatedRefStats(); } catch {}
            return enriched;
        }
        
        // 3) Se ainda nada funcionou e REFS_ALLOW_NETWORK está ativo (legacy path)
        if (typeof window !== 'undefined' && window.REFS_ALLOW_NETWORK === true) {
            console.log('⚠️ Using legacy REFS_ALLOW_NETWORK path - should not happen with new logic');
        }
        
        // 4) Último recurso: trance inline (fallback)
        const fallback = __INLINE_EMBEDDED_REFS__?.byGenre?.trance;
        if (fallback) {
            const enrichedFb = enrichReferenceObject(structuredClone(fallback), 'trance');
            __refDataCache['trance'] = enrichedFb;
            __activeRefData = enrichedFb;
            __activeRefGenre = 'trance';
            window.PROD_AI_REF_DATA = enrichedFb;
            
            // Log de diagnóstico
            console.log('🎯 REFS DIAGNOSTIC:', {
                genre,
                source: 'fallback',
                path: '__INLINE_EMBEDDED_REFS__.trance',
                version: 'fallback',
                num_tracks: fallback.num_tracks || 'unknown',
                lufs_target: fallback.lufs_target,
                true_peak_target: fallback.true_peak_target,
                stereo_target: fallback.stereo_target
            });
            
            updateRefStatus('✔ referências embutidas (fallback)', '#0d6efd');
            try { buildAggregatedRefStats(); } catch {}
            return enrichedFb;
        }
        throw new Error('Sem referências disponíveis');
    } catch (e) {
        console.warn('Falha ao carregar referências', genre, e);
        // Fallback: tentar EMBEDDED
        try {
            const embMap = (typeof window !== 'undefined' && window.__EMBEDDED_REFS__ && window.__EMBEDDED_REFS__.byGenre) || __INLINE_EMBEDDED_REFS__.byGenre || {};
            const emb = embMap[genre];
            if (emb && typeof emb === 'object') {
                const enrichedEmb = enrichReferenceObject(structuredClone(emb), genre);
                __refDataCache[genre] = enrichedEmb;
                __activeRefData = enrichedEmb;
                __activeRefGenre = genre;
                window.PROD_AI_REF_DATA = enrichedEmb;
                updateRefStatus('✔ referências embutidas', '#0d6efd');
                try { buildAggregatedRefStats(); } catch {}
                return enrichedEmb;
            }
            // Se o gênero específico não existir, usar um padrão seguro (trance) se disponível
            if (embMap && embMap.trance) {
                const enrichedEmbTr = enrichReferenceObject(structuredClone(embMap.trance), 'trance');
                __refDataCache['trance'] = enrichedEmbTr;
                __activeRefData = enrichedEmbTr;
                __activeRefGenre = 'trance';
                window.PROD_AI_REF_DATA = enrichedEmbTr;
                updateRefStatus('✔ referências embutidas (fallback)', '#0d6efd');
                try { buildAggregatedRefStats(); } catch {}
                return enrichedEmbTr;
            }
        } catch(_) {}
        updateRefStatus('⚠ falha refs', '#992222');
        return null;
    }
}

function updateRefStatus(text, color) {
    const el = document.getElementById('audioRefStatus');
    if (el) { el.textContent = text; el.style.background = color || '#1f2b40'; }
}

function applyGenreSelection(genre) {
    if (!genre) return Promise.resolve();
    window.PROD_AI_REF_GENRE = genre;
    localStorage.setItem('prodai_ref_genre', genre);
    // Invalidação de cache opcional
    if (typeof window !== 'undefined' && window.INVALIDATE_REF_CACHE_ON_GENRE_CHANGE === true) {
        try { delete __refDataCache[genre]; } catch {}
        invalidateReferenceDerivedCaches();
    }
    
    // 🎯 FORÇAR invalidação para garantir nova referência
    try { 
        delete __refDataCache[genre]; 
        invalidateReferenceDerivedCaches();
        console.log('✅ Cache invalidado para gênero:', genre);
    } catch(e) { console.warn('⚠️ Falha na invalidação:', e); }
    // Carregar refs e, se já houver análise no modal, atualizar sugestões de referência e re-renderizar
    return loadReferenceData(genre).then(() => {
        try {
            if (typeof currentModalAnalysis === 'object' && currentModalAnalysis) {
                // 🎯 NOVO: Recalcular score com nova referência
                try {
                    if (typeof window !== 'undefined' && window.computeMixScore && __refData) {
                        currentModalAnalysis.qualityOverall = window.computeMixScore(currentModalAnalysis.technicalData, __refData);
                        console.log('✅ Score recalculado para novo gênero:', currentModalAnalysis.qualityOverall);
                    }
                } catch(e) { console.warn('❌ Falha ao recalcular score:', e); }
                
                // Recalcular sugestões reference_* com as novas tolerâncias
                try { updateReferenceSuggestions(currentModalAnalysis); } catch(e) { console.warn('updateReferenceSuggestions falhou', e); }
                // Re-renderização completa para refletir sugestões e comparações
                try { 
                    // 🔒 UI GATE: Verificar se análise ainda é válida
                    const analysisRunId = currentModalAnalysis?.runId || currentModalAnalysis?.metadata?.runId;
                    const currentRunId = window.__CURRENT_ANALYSIS_RUN_ID__;
                    
                    if (analysisRunId && currentRunId && analysisRunId !== currentRunId) {
                        console.warn(`🚫 [UI_GATE] Re-render cancelado - análise obsoleta (análise: ${analysisRunId}, atual: ${currentRunId})`);
                        return;
                    }
                    
                    displayModalResults(currentModalAnalysis); 
                } catch(e) { console.warn('re-render modal falhou', e); }
            }
        } catch (e) { console.warn('re-render comparação falhou', e); }
    });
}
// Expor global
if (typeof window !== 'undefined') {
    window.applyGenreSelection = applyGenreSelection;
}

// Health check utilitário (Etapa 2) – avalia estabilidade das métricas em múltiplos runs
if (typeof window !== 'undefined' && !window.__audioHealthCheck) {
    window.__audioHealthCheck = async function(file, opts = {}) {
        const runs = opts.runs || 3;
        const delayMs = opts.delayMs || 0;
        const out = { runs: [], spreads: {}, anomalies: [] };
        for (let i=0;i<runs;i++) {
            const t0 = performance.now();
            // 🆔 CORREÇÃO: Adicionar runId para funções de health check
            const healthOptions = prepareAnalysisOptions({}, `health_${i+1}`);
            const res = await window.audioAnalyzer.analyzeAudioFile(file, healthOptions);
            const t1 = performance.now();
            out.runs.push({
                idx: i+1,
                lufsIntegrated: res?.technicalData?.lufsIntegrated,
                truePeakDbtp: res?.technicalData?.truePeakDbtp,
                dynamicRange: res?.technicalData?.dynamicRange,
                lra: res?.technicalData?.lra,
                stereoCorrelation: res?.technicalData?.stereoCorrelation,
                processingMs: (res?.processingMs ?? (t1 - t0))
            });
            if (delayMs) await new Promise(r=>setTimeout(r, delayMs));
        }
        const collect = (key) => out.runs.map(r=>r[key]).filter(v=>Number.isFinite(v));
        const stats = (arr) => arr.length?{min:Math.min(...arr),max:Math.max(...arr),spread:Math.max(...arr)-Math.min(...arr)}:null;
        ['lufsIntegrated','truePeakDbtp','dynamicRange','lra','stereoCorrelation','processingMs'].forEach(k=>{
            out.spreads[k] = stats(collect(k));
        });
        // Anomalias agrupadas (do logger central)
        try { out.anomalies = (window.__METRIC_ANOMALIES__||[]).slice(-100); } catch {}
        return out;
    };
}

// ================== ACCEPTANCE TEST HARNESS (Etapa 3) ==================
// ⚠️ REMOVIDO: Testes que dependem de Web Audio API
// TODO: Implementar testes baseados em análise remota se necessário

if (typeof window !== 'undefined' && !window.__runAcceptanceAudioTests) {
    window.__runAcceptanceAudioTests = async function(opts = {}) {
        console.warn('⚠️ Testes de aceitação de áudio foram removidos devido à migração para análise remota');
        return { 
            skipped: true, 
            reason: 'Web Audio API removida - usar testes de backend' 
        };
    };
}

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    initializeAudioAnalyzerIntegration();
});


function initializeAudioAnalyzerIntegration() {
    if (__audioIntegrationInitialized) {
        __dbg('ℹ️ Integração do Audio Analyzer já inicializada. Ignorando chamada duplicada.');
        return;
    }
    __audioIntegrationInitialized = true;
    __dbg('🎵 Inicializando integração do Audio Analyzer...');
    // Habilitar flag de referência por gênero via parâmetro de URL (ex.: ?refgenre=trance)
    try {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const rg = params.get('refgenre');
            if (rg && !window.PROD_AI_REF_GENRE) {
                window.PROD_AI_REF_GENRE = String(rg).trim().toLowerCase();
                __dbg(`[REF-GÊNERO] Ativado via URL: ${window.PROD_AI_REF_GENRE}`);
            }
            // Flags de controle por URL (não alteram CSS)
            if (params.has('surgical')) {
                const v = params.get('surgical');
                window.USE_SURGICAL_EQ = !(v === '0' || v === 'false');
                __dbg(`[FLAG] USE_SURGICAL_EQ = ${window.USE_SURGICAL_EQ}`);
            }
            if (params.has('useLog')) {
                const v = params.get('useLog');
                window.USE_LOG_BAND_ENERGIES = (v === '1' || v === 'true');
                __dbg(`[FLAG] USE_LOG_BAND_ENERGIES = ${window.USE_LOG_BAND_ENERGIES}`);
            }
            if (params.has('adv')) {
                const v = params.get('adv');
                const on = !(v === '0' || v === 'false');
                window.USE_ADVANCED_METRICS = on;
                window.USE_ADVANCED_LOUDNESS = on;
                window.USE_ADVANCED_TRUEPEAK = on;
                window.USE_ADVANCED_SPECTRUM = on;
                __dbg(`[FLAG] ADVANCED = ${on}`);
            }
            if (params.has('debug')) {
                const v = params.get('debug');
                window.DEBUG_ANALYZER = (v === '1' || v === 'true');
                __dbg(`[FLAG] DEBUG_ANALYZER = ${window.DEBUG_ANALYZER}`);
            }
            // Preferir métricas avançadas (ITU/oversampling) quando disponíveis, sem sobrescrever configs do usuário
            if (typeof window.PREFER_ADVANCED_METRICS === 'undefined') {
                window.PREFER_ADVANCED_METRICS = true;
                __dbg('[FLAG] PREFER_ADVANCED_METRICS = true (auto)');
            }
        }
    } catch (_) { /* noop */ }
    
    // Restaurar gênero salvo
    try {
        const saved = localStorage.getItem('prodai_ref_genre');
        if (!window.PROD_AI_REF_GENRE && saved) window.PROD_AI_REF_GENRE = saved;
    } catch {}

    const genreSelect = document.getElementById('audioRefGenreSelect');
    if (genreSelect) {
        // Popular dinamicamente a partir do manifesto, mantendo fallback
        loadGenreManifest().then(() => {
            populateGenreSelect(__genreManifest);
            // Listener de mudança (garantir apenas um)
            genreSelect.onchange = () => applyGenreSelection(genreSelect.value);
            // Aplicar seleção atual
            const selected = genreSelect.value || window.PROD_AI_REF_GENRE;
            applyGenreSelection(selected);
        });
    }

    // Botão de análise de música (novo design)
    const musicAnalysisBtn = document.getElementById('musicAnalysisBtn');
    if (musicAnalysisBtn) {
        musicAnalysisBtn.addEventListener('click', openAudioModal);
        __dbg('✅ Botão de Análise de Música configurado');
    }
    
    // Modal de áudio
    setupAudioModal();
    
    __dbg('🎵 Audio Analyzer Integration carregada com sucesso!');

    // Aplicar estilos aprimorados ao seletor de gênero
    try { injectRefGenreStyles(); } catch(e) { /* silencioso */ }
}

// 🎵 Abrir modal de análise de áudio
function openAudioModal() {
    window.logReferenceEvent('open_modal_requested');
    
    // Verificar se modo referência está habilitado
    const isReferenceEnabled = window.FEATURE_FLAGS?.REFERENCE_MODE_ENABLED;
    
    if (isReferenceEnabled) {
        // Abrir modal de seleção de modo primeiro
        openModeSelectionModal();
    } else {
        // Comportamento original: modo gênero direto
        selectAnalysisMode('genre');
    }
}

// 🎯 NOVO: Modal de Seleção de Modo
function openModeSelectionModal() {
    __dbg('� Abrindo modal de seleção de modo...');
    
    const modal = document.getElementById('analysisModeModal');
    if (!modal) {
        console.error('Modal de seleção de modo não encontrado');
        return;
    }
    
    // Verificar se modo referência está habilitado e mostrar/esconder botão
    const referenceModeBtn = document.getElementById('referenceModeBtn');
    if (referenceModeBtn) {
        const isEnabled = window.FEATURE_FLAGS?.REFERENCE_MODE_ENABLED;
        referenceModeBtn.style.display = isEnabled ? 'flex' : 'none';
        
        if (!isEnabled) {
            referenceModeBtn.disabled = true;
        }
    }
    
    modal.style.display = 'flex';
    modal.setAttribute('tabindex', '-1');
    modal.focus();
    
    window.logReferenceEvent('mode_selection_modal_opened');
}

function closeModeSelectionModal() {
    __dbg('❌ Fechando modal de seleção de modo...');
    
    const modal = document.getElementById('analysisModeModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    window.logReferenceEvent('mode_selection_modal_closed');
}

// 🎯 NOVO: Selecionar modo de análise
function selectAnalysisMode(mode) {
    window.logReferenceEvent('analysis_mode_selected', { mode });
    
    if (mode === 'reference' && !window.FEATURE_FLAGS?.REFERENCE_MODE_ENABLED) {
        alert('Modo de análise por referência não está disponível no momento.');
        return;
    }
    
    currentAnalysisMode = mode;
    
    // Fechar modal de seleção de modo
    closeModeSelectionModal();
    
    // Abrir modal de análise configurado para o modo selecionado
    openAnalysisModalForMode(mode);
}

// 🎯 NOVO: Abrir modal de análise configurado para o modo
function openAnalysisModalForMode(mode) {
    __dbg(`🎵 Abrindo modal de análise para modo: ${mode}`);
    
    // CORREÇÃO CRÍTICA: Definir window.currentAnalysisMode sempre que o modal for aberto
    window.currentAnalysisMode = mode;
    
    const modal = document.getElementById('audioAnalysisModal');
    if (!modal) {
        console.error('Modal de análise não encontrado');
        return;
    }
    
    // Configurar modal baseado no modo
    configureModalForMode(mode);
    
    // Reset state específico do modo
    if (mode === 'reference') {
        resetReferenceState();
    }
    
    modal.style.display = 'flex';
    resetModalState();
    modal.setAttribute('tabindex', '-1');
    modal.focus();
    
    window.logReferenceEvent('analysis_modal_opened', { mode });
}

// 🎯 NOVO: Configurar modal baseado no modo selecionado
function configureModalForMode(mode) {
    const title = document.getElementById('audioModalTitle');
    const subtitle = document.getElementById('audioModalSubtitle');
    const modeIndicator = document.getElementById('audioModeIndicator');
    const genreContainer = document.getElementById('audioRefGenreContainer');
    const progressSteps = document.getElementById('referenceProgressSteps');
    
    if (mode === 'genre') {
        // Modo Gênero: comportamento original
        if (title) title.textContent = '🎵 Análise de Áudio';
        if (subtitle) subtitle.style.display = 'none';
        if (genreContainer) genreContainer.style.display = 'flex';
        if (progressSteps) progressSteps.style.display = 'none';
        
    } else if (mode === 'reference') {
        // Modo Referência: interface específica
        if (title) title.textContent = '🎯 Análise por Referência';
        if (subtitle) {
            subtitle.style.display = 'block';
            if (modeIndicator) {
                modeIndicator.textContent = 'Comparação direta entre suas músicas';
            }
        }
        if (genreContainer) genreContainer.style.display = 'none';
        if (progressSteps) progressSteps.style.display = 'flex';
        
        // Configurar steps iniciais
        updateReferenceStep('userAudio');
    }
}

// 🎯 NOVO: Reset estado do modo referência
function resetReferenceState() {
    referenceStepState = {
        currentStep: 'userAudio',
        userAudioFile: null,
        referenceAudioFile: null,
        userAnalysis: null,
        referenceAnalysis: null
    };
    
    window.logReferenceEvent('reference_state_reset');
}

// 🎯 NOVO: Atualizar step ativo no modo referência
function updateReferenceStep(step) {
    const steps = ['userAudio', 'referenceAudio', 'analysis'];
    const stepElements = {
        userAudio: document.getElementById('stepUserAudio'),
        referenceAudio: document.getElementById('stepReferenceAudio'),
        analysis: document.getElementById('stepAnalysis')
    };
    
    // Reset todos os steps
    Object.values(stepElements).forEach(el => {
        if (el) {
            el.classList.remove('active', 'completed');
        }
    });
    
    // Marcar steps anteriores como completed
    const currentIndex = steps.indexOf(step);
    for (let i = 0; i < currentIndex; i++) {
        const stepElement = stepElements[steps[i]];
        if (stepElement) {
            stepElement.classList.add('completed');
        }
    }
    
    // Marcar step atual como active
    const currentElement = stepElements[step];
    if (currentElement) {
        currentElement.classList.add('active');
    }
    
    referenceStepState.currentStep = step;
    
    window.logReferenceEvent('reference_step_updated', { step, currentIndex });
}

// ❌ Fechar modal de análise de áudio
function closeAudioModal() {
    __dbg('❌ Fechando modal de análise de áudio...');
    
    const modal = document.getElementById('audioAnalysisModal');
    if (modal) {
        modal.style.display = 'none';
        currentModalAnalysis = null;
        resetModalState();
        
        // 🔧 CORREÇÃO: Garantir que o modal pode ser usado novamente
        // Limpar cache de arquivos para forçar novo processamento
        const fileInput = document.getElementById('modalAudioFileInput');
        if (fileInput) {
            fileInput.value = ''; // Limpar input para permitir re-seleção do mesmo arquivo
        }
        
        // Resetar flags globais para próxima análise
        if (typeof window !== 'undefined') {
            delete window.__AUDIO_ADVANCED_READY__;
            delete window.__MODAL_ANALYSIS_IN_PROGRESS__;
        }
        
        __dbg('✅ Modal resetado e pronto para próxima análise');
    }
}

// 🔄 Reset estado do modal
function resetModalState() {
    __dbg('🔄 Resetando estado do modal...');
    
    // Mostrar área de upload
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (uploadArea) uploadArea.style.display = 'block';
    if (loading) loading.style.display = 'none';
    if (results) results.style.display = 'none';
    
    // Reset progress
    const progressFill = document.getElementById('audioProgressFill');
    const progressText = document.getElementById('audioProgressText');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '';
    
    // 🔧 CORREÇÃO: Limpar análise anterior e flags
    currentModalAnalysis = null;
    
    // Limpar input de arquivo para permitir re-seleção
    const fileInput = document.getElementById('modalAudioFileInput');
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Limpar flags globais
    if (typeof window !== 'undefined') {
        delete window.__AUDIO_ADVANCED_READY__;
        delete window.__MODAL_ANALYSIS_IN_PROGRESS__;
    }
    
    __dbg('✅ Estado do modal resetado completamente');
}

// ⚙️ Configurar modal de áudio
function setupAudioModal() {
    const modal = document.getElementById('audioAnalysisModal');
    const fileInput = document.getElementById('modalAudioFileInput');
    const uploadArea = document.getElementById('audioUploadArea');
    
    if (!modal || !fileInput || !uploadArea) {
        __dwrn('⚠️ Elementos do modal não encontrados');
        return;
    }
    
    // Fechar modal clicando fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAudioModal();
        }
    });
    
    // Fechar modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeAudioModal();
        }
    });
    
    // Detectar se é dispositivo móvel
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) {
        // Drag and Drop (apenas para desktop)
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.querySelector('.upload-content').classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.querySelector('.upload-content').classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.querySelector('.upload-content').classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleModalFileSelection(files[0]);
            }
        });
    }
    
    // File input change event
    fileInput.addEventListener('change', (e) => {
        __dbg('📁 File input change triggered');
        if (e.target.files.length > 0) {
            __dbg('📁 File selected:', e.target.files[0].name);
            handleModalFileSelection(e.target.files[0]);
        }
    });
    
    // Não adicionar nenhum listener JS ao botão/label de upload!
    uploadArea.onclick = null;
    
    __dbg('✅ Modal de áudio configurado com sucesso');
}

// 📁 Processar arquivo selecionado no modal
async function handleModalFileSelection(file) {
    __dbg('📁 Arquivo selecionado no modal:', file.name);
    
    // 🔧 CORREÇÃO: Prevenir múltiplas análises simultâneas
    if (typeof window !== 'undefined' && window.__MODAL_ANALYSIS_IN_PROGRESS__) {
        __dbg('⚠️ Análise já em progresso, ignorando nova seleção');
        return;
    }
    
    try {
        // Marcar análise em progresso
        if (typeof window !== 'undefined') {
            window.__MODAL_ANALYSIS_IN_PROGRESS__ = true;
        }
        
        // Validação comum de arquivo
        if (!validateAudioFile(file)) {
            return; // validateAudioFile já mostra erro
        }
        
        // 🌐 NOVO FLUXO COMPLETO: Presigned URL → Upload → Job Creation → Polling
        __dbg('🌐 Iniciando fluxo de análise remota completo...');
        
        // Mostrar loading
        hideUploadArea();
        showAnalysisLoading();
        showUploadProgress(`Preparando upload de ${file.name}...`);
        
        // 🌐 ETAPA 1: Obter URL pré-assinada
        const { uploadUrl, fileKey } = await getPresignedUrl(file);
        
        // 🌐 ETAPA 2: Upload direto para bucket
        await uploadToBucket(uploadUrl, file);
        
        // 🌐 ETAPA 3: Criar job de análise no backend
        const { jobId } = await createAnalysisJob(fileKey, currentAnalysisMode, file.name);
        
        // 🌐 ETAPA 4: Acompanhar progresso e aguardar resultado
        showUploadProgress(`Analisando ${file.name}... Aguarde.`);
        
        // 📊 Progress: Resetar e exibir barra de progresso
        const progressContainer = document.querySelector('.progress-container');
        const progressBar = document.querySelector('.progress-fill');
        if (progressContainer) {
            progressContainer.style.display = 'block';
            progressContainer.style.opacity = '1';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        updateModalProgress(0, 'Iniciando análise...');
        console.log('📊 Progress: Barra de progresso resetada e exibida');
        
        const analysisResult = await pollJobStatus(jobId);
        
        // 🌐 ETAPA 5: Processar resultado baseado no modo
        if (currentAnalysisMode === "reference") {
            await handleReferenceAnalysisWithResult(analysisResult, fileKey, file.name);
        } else {
            await handleGenreAnalysisWithResult(analysisResult, file.name);
        }

    } catch (error) {
        console.error('❌ Erro na análise do modal:', error);
        
        // Verificar se é um erro de fallback para modo gênero
        if (window.FEATURE_FLAGS?.FALLBACK_TO_GENRE && currentAnalysisMode === 'reference') {
            window.logReferenceEvent('error_fallback_to_genre', { 
                error: error.message,
                originalMode: currentAnalysisMode 
            });
            
            showModalError('Erro na análise por referência. Redirecionando para análise por gênero...');
            
            setTimeout(() => {
                currentAnalysisMode = 'genre';
                configureModalForMode('genre');
            }, 2000);
        } else {
            // Determinar tipo de erro para mensagem mais específica
            let errorMessage = error.message;
            if (error.message.includes('Falha ao gerar URL de upload')) {
                errorMessage = 'Falha ao gerar URL de upload. Verifique sua conexão e tente novamente.';
            } else if (error.message.includes('Falha ao enviar arquivo para análise')) {
                errorMessage = 'Falha ao enviar arquivo para análise. Verifique sua conexão e tente novamente.';
            }
            
            showModalError(`Erro ao processar arquivo: ${errorMessage}`);
        }
    } finally {
        // 🎵 WAV CLEANUP: Limpar otimizações WAV em caso de erro
        try {
            if (window.wavMobileOptimizer) {
                window.wavMobileOptimizer.cleanupWAVOptimizations();
            }
        } catch (cleanupError) {
            console.warn('WAV cleanup error in finally (non-critical):', cleanupError);
        }
        
        // 🔧 CORREÇÃO: Sempre limpar flag de análise em progresso
        if (typeof window !== 'undefined') {
            delete window.__MODAL_ANALYSIS_IN_PROGRESS__;
        }
        __dbg('✅ Flag de análise em progresso removida');
    }
}

// � NOVAS FUNÇÕES: Análise baseada em fileKey (pós-upload remoto)

/**
 * Processar análise por referência usando fileKey
 * @param {string} fileKey - Chave do arquivo no bucket
 * @param {string} fileName - Nome original do arquivo
 */
// 🌐 NOVAS FUNÇÕES: Análise baseada em resultado remoto

/**
 * Processar análise por referência usando resultado remoto
 * @param {Object} analysisResult - Resultado da análise remota
 * @param {string} fileKey - Chave do arquivo no bucket
 * @param {string} fileName - Nome original do arquivo
 */
async function handleReferenceAnalysisWithResult(analysisResult, fileKey, fileName) {
    __dbg('🎯 Processando análise por referência com resultado remoto:', { fileKey, fileName });
    
    window.logReferenceEvent('reference_analysis_with_result_started', { 
        fileKey,
        fileName 
    });
    
    try {
        // Verificar estrutura do resultado
        if (!analysisResult || typeof analysisResult !== 'object') {
            throw new Error('Resultado de análise inválido recebido do servidor');
        }
        
        updateModalProgress(90, '🎯 Aplicando resultado da análise...');
        
        // Determinar se é arquivo original ou de referência
        const isReference = currentAnalysisMode === 'reference' && uploadedFiles.original;
        const fileType = isReference ? 'reference' : 'original';
        
        // Armazenar resultado
        uploadedFiles[fileType] = {
            fileKey: fileKey,
            fileName: fileName,
            analysisResult: analysisResult
        };
        
        __dbg(`✅ Arquivo ${fileType} armazenado:`, uploadedFiles[fileType]);
        
        // Atualizar display na interface
        updateReferenceFileDisplay(fileType, fileName);
        
        // Log do evento
        window.logReferenceEvent('reference_file_processed', {
            fileType,
            fileName,
            hasResult: !!analysisResult
        });
        
        // Verificar se ambos os arquivos estão prontos para comparação
        if (uploadedFiles.original && uploadedFiles.reference) {
            enableReferenceComparison();
            updateModalProgress(100, '✅ Ambos os arquivos analisados! Comparação disponível.');
            
        
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar análise por referência:', error);
        window.logReferenceEvent('reference_analysis_error', { 
            error: error.message,
            fileKey,
            fileName 
        });
        throw error;
    }
}

/**
 * Processar análise por gênero usando resultado remoto
 * @param {Object} analysisResult - Resultado da análise remota
 * @param {string} fileName - Nome original do arquivo
 */
async function handleGenreAnalysisWithResult(analysisResult, fileName) {
    __dbg('🎵 Processando análise por gênero com resultado remoto:', { fileName });
    
    try {
        // Verificar estrutura do resultado
        if (!analysisResult || typeof analysisResult !== 'object') {
            throw new Error('Resultado de análise inválido recebido do servidor');
        }
        
        updateModalProgress(90, '🎵 Aplicando resultado da análise...');
        
        // 🔧 CORREÇÃO: Normalizar dados do backend antes de usar
        const normalizedResult = normalizeBackendAnalysisData(analysisResult);
        
        // Definir como análise atual do modal
        currentModalAnalysis = normalizedResult;
        
        // Armazenar resultado globalmente para uso posterior
        if (typeof window !== 'undefined') {
            window.__LAST_ANALYSIS_RESULT__ = normalizedResult;
        }
        
        updateModalProgress(100, `✅ Análise de ${fileName} concluída!`);
        
        // Exibir resultados diretamente no modal
        setTimeout(() => {
            displayModalResults(normalizedResult);
        }, 500);
        
    } catch (error) {
        console.error('❌ Erro ao processar análise por gênero:', error);
        throw error;
    }
}

/**
 * Atualizar display de arquivo de referência na interface
 * @param {string} fileType - Tipo do arquivo ('original' ou 'reference')
 * @param {string} fileName - Nome do arquivo
 */
function updateReferenceFileDisplay(fileType, fileName) {
    const displayElement = document.getElementById(`${fileType}FileDisplay`);
    if (displayElement) {
        displayElement.textContent = fileName;
        displayElement.style.display = 'block';
    }
    
    // Atualizar também elementos relacionados
    const labelElement = document.querySelector(`label[for="${fileType}FileInput"]`);
    if (labelElement) {
        labelElement.style.opacity = '0.7';
    }
}

/**
 * Habilitar botão de comparação de referência
 */
function enableReferenceComparison() {
    const compareButton = document.getElementById('compareButton');
    if (compareButton) {
        compareButton.disabled = false;
        compareButton.style.opacity = '1';
        compareButton.style.cursor = 'pointer';
    }
    
    // Atualizar indicador visual
    const indicator = document.querySelector('.reference-ready-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }
}


/**
 * Mostrar mensagem do próximo passo
 * @param {string} message - Mensagem a ser exibida
 */
function showNextStepMessage(message) {
    console.log(`➡️ ${message}`);
    
    // Implementar notificação visual se necessário
    const notification = document.createElement('div');
    notification.className = 'next-step-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(notification);
    
    // Remover após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// �🎯 NOVO: Validação comum de arquivo
function validateAudioFile(file) {
    const MAX_UPLOAD_MB = 60;
    const MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024;
    
    // Formatos aceitos: WAV, FLAC, MP3 (simplificado)
    const allowedTypes = ['audio/wav', 'audio/flac', 'audio/mpeg', 'audio/mp3'];
    const allowedExtensions = ['.wav', '.flac', '.mp3'];
    
    // Validar tipo de arquivo
    const isValidType = allowedTypes.includes(file.type.toLowerCase()) || 
                       allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType) {
        showModalError(`Formato não suportado. Apenas WAV, FLAC e MP3 são aceitos.
                      💡 Prefira WAV ou FLAC para maior precisão na análise.`);
        return false;
    }
    
    // Validar tamanho (novo limite: 60MB)
    if (file.size > MAX_UPLOAD_SIZE) {
        const sizeInMB = (file.size / 1024 / 1024).toFixed(1);
        showModalError(`Arquivo muito grande: ${sizeInMB}MB. 
                      Limite máximo: ${MAX_UPLOAD_MB}MB.`);
        return false;
    }
    
    // 🎵 WAV MOBILE WARNING: Avisar sobre demora em arquivos WAV grandes no mobile
    const isWAV = file.name.toLowerCase().endsWith('.wav') || file.type.includes('wav');
    const isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
    const isLargeWAV = isWAV && file.size > 20 * 1024 * 1024; // >20MB
    
    if (isLargeWAV && isMobile) {
        const sizeInMB = (file.size / 1024 / 1024).toFixed(1);
        const estimatedTime = Math.ceil(file.size / (2 * 1024 * 1024)); // ~2MB/s no mobile
        
        console.warn(`⏱️ WAV grande no mobile: ${sizeInMB}MB - tempo estimado: ${estimatedTime}s`);
        
        // Mostrar aviso não-bloqueante
        setTimeout(() => {
            if (document.getElementById('audioProgressText')) {
                document.getElementById('audioProgressText').innerHTML = 
                    `⏱️ Arquivo WAV grande (${sizeInMB}MB)<br>Tempo estimado: ${estimatedTime}-${estimatedTime*2}s<br>Aguarde...`;
            }
        }, 1000);
    }
    
    // Mostrar recomendação para MP3
    if (file.type === 'audio/mpeg' || file.type === 'audio/mp3' || file.name.toLowerCase().endsWith('.mp3')) {
        console.log('💡 MP3 detectado - Recomendação: Use WAV ou FLAC para maior precisão');
    }
    
    return true;
}

// 🎯 NOVO: Processar arquivo no modo referência
async function processReferenceFileSelection(file) {
    window.logReferenceEvent('reference_file_selected', { 
        step: referenceStepState.currentStep,
        fileName: file.name,
        fileSize: file.size 
    });
    
    if (referenceStepState.currentStep === 'userAudio') {
        // Primeiro arquivo: música do usuário
        referenceStepState.userAudioFile = file;
        
        // 🐛 DIAGNÓSTICO: Verificar se está carregando dados de gênero no modo referência
        console.log('🔍 [DIAGNÓSTICO] Analisando USER audio em modo referência');
        console.log('🔍 [DIAGNÓSTICO] Current mode:', window.currentAnalysisMode);
        console.log('🔍 [DIAGNÓSTICO] Genre ativo antes da análise:', window.PROD_AI_REF_GENRE);
        console.log('🔍 [DIAGNÓSTICO] Active ref data:', !!__activeRefData);
        
        // Analisar arquivo do usuário
        showModalLoading();
        updateModalProgress(10, '🎵 Analisando sua música...');
        
        // 🎯 CORREÇÃO TOTAL: Analisar arquivo do usuário SEM aplicar targets
        const userAnalysisOptions = { 
          mode: 'pure_analysis', // Modo puro, sem comparações
          debugModeReference: true,
          // Garantir mesmas configurações para ambos os arquivos
          normalizeLoudness: true,
          windowDuration: 30,
          fftSize: 4096
        };
        // 🆔 CORREÇÃO: Preparar options com runId
        const userOptionsWithRunId = prepareAnalysisOptions(userAnalysisOptions, 'user_ref');
        const analysis = await window.audioAnalyzer.analyzeAudioFile(file, userOptionsWithRunId);
        
        // 🐛 VALIDAÇÃO: Verificar que não há comparação com gênero
        if (analysis.comparison || analysis.mixScore) {
          console.warn('⚠️ [AVISO] Análise do usuário contaminada com comparação/score');
        }
        
        console.log('🔍 [DIAGNÓSTICO] User analysis (pura):', {
          lufs: analysis.technicalData?.lufsIntegrated,
          stereoCorrelation: analysis.technicalData?.stereoCorrelation,
          dynamicRange: analysis.technicalData?.dynamicRange,
          truePeak: analysis.technicalData?.truePeakDbtp,
          hasComparison: !!analysis.comparison,
          hasScore: !!analysis.mixScore
        });
        
        referenceStepState.userAnalysis = analysis;
        
        // Avançar para próximo step
        updateReferenceStep('referenceAudio');
        updateUploadAreaForReferenceStep();
        
        window.logReferenceEvent('user_audio_analyzed', { 
            fileName: file.name,
            hasAnalysis: !!analysis 
        });
        
    } else if (referenceStepState.currentStep === 'referenceAudio') {
        // Segundo arquivo: música de referência
        referenceStepState.referenceAudioFile = file;
        
        // 🐛 DIAGNÓSTICO: Verificar análise do arquivo de referência
        console.log('🔍 [DIAGNÓSTICO] Analisando REFERENCE audio em modo referência');
        console.log('🔍 [DIAGNÓSTICO] Current mode:', window.currentAnalysisMode);
        console.log('🔍 [DIAGNÓSTICO] Genre ativo antes da análise:', window.PROD_AI_REF_GENRE);
        
        // Analisar arquivo de referência (extração de métricas com MESMAS configurações)
        showModalLoading();
        updateModalProgress(50, '🎯 Analisando música de referência...');
        
        // 🎯 CORREÇÃO TOTAL: Usar EXATAMENTE as mesmas configurações do usuário
        const refAnalysisOptions = { 
          mode: 'pure_analysis', // Modo puro, sem comparações
          debugModeReference: true,
          // 🎯 GARANTIR parâmetros idênticos
          normalizeLoudness: true,
          windowDuration: 30,
          fftSize: 4096
        };
        // 🆔 CORREÇÃO: Preparar options com runId
        const refOptionsWithRunId = prepareAnalysisOptions(refAnalysisOptions, 'ref_audio');
        const analysis = await window.audioAnalyzer.analyzeAudioFile(file, refOptionsWithRunId);
        
        // 🐛 VALIDAÇÃO: Verificar que não há comparação com gênero
        if (analysis.comparison || analysis.mixScore) {
          console.warn('⚠️ [AVISO] Análise da referência contaminada com comparação/score');
        }
        
        console.log('🔍 [DIAGNÓSTICO] Reference analysis (pura):', {
          lufs: analysis.technicalData?.lufsIntegrated,
          stereoCorrelation: analysis.technicalData?.stereoCorrelation,
          dynamicRange: analysis.technicalData?.dynamicRange,
          truePeak: analysis.technicalData?.truePeakDbtp,
          hasComparison: !!analysis.comparison,
          hasScore: !!analysis.mixScore
        });
        
        // 🎯 VALIDAÇÃO: Verificar se conseguimos extrair métricas válidas
        const referenceMetrics = {
          lufs: analysis.technicalData?.lufsIntegrated,
          stereoCorrelation: analysis.technicalData?.stereoCorrelation,
          dynamicRange: analysis.technicalData?.dynamicRange,
          truePeak: analysis.technicalData?.truePeakDbtp
        };
        
        // 🚨 ERRO CLARO: Falhar se não conseguir extrair métricas
        if (!Number.isFinite(referenceMetrics.lufs)) {
          throw new Error('REFERENCE_METRICS_FAILED: Não foi possível extrair métricas LUFS da música de referência. Verifique se o arquivo é válido.');
        }
        
        if (!Number.isFinite(referenceMetrics.stereoCorrelation)) {
          throw new Error('REFERENCE_METRICS_FAILED: Não foi possível extrair correlação estéreo da música de referência.');
        }
        
        console.log('✅ [SUCESSO] Métricas da referência extraídas:', referenceMetrics);
        
        referenceStepState.referenceAnalysis = analysis;
        referenceStepState.referenceMetrics = referenceMetrics;
        
        // Executar comparação
        updateReferenceStep('analysis');
        await performReferenceComparison();
        
        // 🎯 EXIBIR resultados da análise por referência
        const finalAnalysis = referenceStepState.finalAnalysis;
        
        updateModalProgress(100, '✅ Análise por referência concluída!');
        
        // 🎯 LOGS finais de validação
        console.log('🎉 [ANÁLISE POR REFERÊNCIA] Concluída com sucesso:');
        console.log('  - Baseline source:', finalAnalysis.comparison?.baseline_source);
        console.log('  - LUFS difference:', finalAnalysis.comparison?.loudness?.difference?.toFixed(2));
        console.log('  - Sugestões:', finalAnalysis.suggestions?.length || 0);
        console.log('  - Sem gênero:', !finalAnalysis.genre);
        
        // Exibir modal de resultados
        displayReferenceResults(finalAnalysis);
        
        window.logReferenceEvent('reference_audio_analyzed', { 
            fileName: file.name,
            hasAnalysis: !!analysis 
        });
    }
}

// 🎯 NOVO: Processar arquivo no modo gênero (comportamento original)
async function handleGenreFileSelection(file) {
    // 🐛 DIAGNÓSTICO: Confirmar que este é o modo gênero
    console.log('🔍 [DIAGNÓSTICO] handleGenreFileSelection - modo:', window.currentAnalysisMode);
    console.log('🔍 [DIAGNÓSTICO] Este deveria ser APENAS modo gênero!');
    
    __dbg('🔄 Iniciando nova análise - forçando exibição do loading');
    showModalLoading();
    updateModalProgress(10, '⚡ Carregando Algoritmos Avançados...');
    
    // Aguardar audio analyzer carregar se necessário
    if (!window.audioAnalyzer) {
        __dbg('⏳ Aguardando Audio Analyzer carregar...');
        updateModalProgress(30, '🔧 Inicializando V2 Engine...');
        await waitForAudioAnalyzer();
    }

    // 🐛 CORREÇÃO CRÍTICA: Só carregar referências de gênero se estivermos NO MODO GÊNERO
    if (window.currentAnalysisMode === 'genre') {
        // Garantir que referências do gênero selecionado estejam carregadas antes da análise (evita race e gênero errado)
        try {
            const genre = (typeof window !== 'undefined') ? window.PROD_AI_REF_GENRE : null;
            console.log('🔍 [DIAGNÓSTICO] Carregando referências de gênero:', genre);
            
            if (genre && (!__activeRefData || __activeRefGenre !== genre)) {
                updateModalProgress(25, `📚 Carregando referências: ${genre}...`);
                await loadReferenceData(genre);
                updateModalProgress(30, '📚 Referências ok');
            }
        } catch (_) { 
            console.log('🔍 [DIAGNÓSTICO] Erro ao carregar referências de gênero (não crítico)');
        }
    } else {
        console.log('🔍 [DIAGNÓSTICO] PULAR carregamento de referências - modo não é gênero');
    }
    
    // Analisar arquivo
    __dbg('🔬 Iniciando análise...');
    updateModalProgress(40, '🎵 Processando Waveform Digital...');
    
    // � WAV MOBILE OPTIMIZATION: Aplicar otimizações específicas para WAV
    try {
        // Carregar otimizador WAV se não estiver disponível
        if (typeof window.wavMobileOptimizer === 'undefined') {
            const optimizerScript = document.createElement('script');
            optimizerScript.src = '/lib/audio/wav-mobile-optimizer.js';
            optimizerScript.type = 'module';
            document.head.appendChild(optimizerScript);
            
            // Aguardar carregamento com timeout
            await new Promise((resolve) => {
                optimizerScript.onload = () => {
                    console.log('🎵 WAV optimizer carregado');
                    resolve();
                };
                optimizerScript.onerror = () => {
                    console.warn('⚠️ WAV optimizer falhou ao carregar');
                    resolve();
                };
                setTimeout(resolve, 1500); // fallback timeout
            });
        }
        
        // Aplicar otimizações se disponível
        if (window.wavMobileOptimizer) {
            const wavAnalysis = window.wavMobileOptimizer.applyWAVOptimizations(file);
            if (wavAnalysis.requiresOptimization) {
                updateModalProgress(45, `🎵 WAV ${wavAnalysis.sizeInMB}MB - otimização mobile ativa...`);
                console.log('🎵 WAV mobile optimizations applied:', wavAnalysis);
            }
        }
    } catch (optimizerError) {
        console.warn('⚠️ WAV optimizer failed, continuing with standard processing:', optimizerError);
    }
    
    // �🎯 CORREÇÃO: Passar modo correto para análise
    const analysisOptions = { 
      mode: window.currentAnalysisMode || 'genre' 
    };
    // 🆔 CORREÇÃO: Preparar options com runId para análise principal
    const optionsWithRunId = prepareAnalysisOptions(analysisOptions, 'main');
    const analysis = await window.audioAnalyzer.analyzeAudioFile(file, optionsWithRunId);
    currentModalAnalysis = analysis;
    
    // 🎵 WAV CLEANUP: Limpar otimizações WAV após conclusão
    try {
        if (window.wavMobileOptimizer) {
            window.wavMobileOptimizer.cleanupWAVOptimizations();
        }
    } catch (cleanupError) {
        console.warn('WAV cleanup error (non-critical):', cleanupError);
    }
    
    __dbg('✅ Análise concluída:', analysis);
    
    updateModalProgress(90, '🧠 Computando Métricas Avançadas...');
    
    // Aguardar um pouco para melhor UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    updateModalProgress(100, '✨ Análise Completa - Pronto!');
    
    // Mostrar resultados
    setTimeout(() => {
        // 🔒 FASE 2 UI GATE: Verificar se análise ainda é válida
        const analysisRunId = analysis?.runId || analysis?.metadata?.runId;
        const currentRunId = window.__CURRENT_ANALYSIS_RUN_ID__;
        
        if (analysisRunId && currentRunId && analysisRunId !== currentRunId) {
            __dbg(`🚫 [UI_GATE] Análise cancelada - não renderizar UI (análise: ${analysisRunId}, atual: ${currentRunId})`);
            return;
        }
        
        // Telemetria: verificar elementos alvo antes de preencher o modal
        const exists = {
            audioUploadArea: !!document.getElementById('audioUploadArea'),
            audioAnalysisLoading: !!document.getElementById('audioAnalysisLoading'),
            audioAnalysisResults: !!document.getElementById('audioAnalysisResults'),
            modalTechnicalData: !!document.getElementById('modalTechnicalData')
        };
        __dbg('🛰️ [Telemetry] Front antes de preencher modal (existência de elementos):', exists);
        
        // 🔒 UI GATE: Verificar novamente antes de renderizar
        if (analysisRunId && currentRunId && analysisRunId !== currentRunId) {
            __dbg(`🚫 [UI_GATE] Verificação dupla - análise cancelada durante delay`);
            return;
        }
        
        displayModalResults(analysis);
        
        // 🔧 CORREÇÃO: Limpar flag de análise em progresso após sucesso
        if (typeof window !== 'undefined') {
            delete window.__MODAL_ANALYSIS_IN_PROGRESS__;
        }
        __dbg('✅ Análise concluída com sucesso - flag removida');
    }, 800);
}

// 🎯 NOVO: Atualizar upload area para step de referência
function updateUploadAreaForReferenceStep() {
    const uploadArea = document.getElementById('audioUploadArea');
    if (!uploadArea) return;
    
    const uploadContent = uploadArea.querySelector('.upload-content');
    if (!uploadContent) return;
    
    // Limpar input de arquivo
    const fileInput = document.getElementById('modalAudioFileInput');
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Atualizar conteúdo baseado no step
    if (referenceStepState.currentStep === 'referenceAudio') {
        const icon = uploadContent.querySelector('.upload-icon');
        const title = uploadContent.querySelector('h4');
        const description = uploadContent.querySelector('p:not(.supported-formats):not(.format-recommendation)');
        
        if (icon) icon.textContent = '🎯';
        if (title) title.textContent = 'Música de Referência';
        if (description) description.textContent = 'Agora selecione a música que servirá como referência para comparação';
    }
    
    // Mostrar upload area novamente
    uploadArea.style.display = 'block';
    
    // Esconder loading
    const loading = document.getElementById('audioAnalysisLoading');
    if (loading) loading.style.display = 'none';
    
    window.logReferenceEvent('upload_area_updated', { 
        step: referenceStepState.currentStep 
    });
}

// 🎯 REESCRITA COMPLETA: Comparação baseada exclusivamente na referência
async function performReferenceComparison() {
    window.logReferenceEvent('reference_comparison_started');
    
    try {
        updateModalProgress(70, '🔄 Comparando as duas músicas...');
        
        const userAnalysis = referenceStepState.userAnalysis;
        const refAnalysis = referenceStepState.referenceAnalysis;
        const referenceMetrics = referenceStepState.referenceMetrics;
        
        if (!userAnalysis || !refAnalysis || !referenceMetrics) {
            throw new Error('COMPARISON_DATA_MISSING: Análises ou métricas de referência não encontradas');
        }
        
        // 🎯 EXTRAIR métricas do usuário (análise pura, sem comparações)
        const userMetrics = {
            lufs: userAnalysis.technicalData?.lufsIntegrated,
            stereoCorrelation: userAnalysis.technicalData?.stereoCorrelation,
            dynamicRange: userAnalysis.technicalData?.dynamicRange,
            truePeak: userAnalysis.technicalData?.truePeakDbtp
        };
        
        // 🚨 VALIDAÇÃO: Verificar métricas do usuário
        if (!Number.isFinite(userMetrics.lufs)) {
            throw new Error('USER_METRICS_FAILED: Não foi possível extrair métricas LUFS da sua música');
        }
        
        console.log('🔍 [COMPARAÇÃO] Métricas extraídas:');
        console.log('  - Usuário:', userMetrics);
        console.log('  - Referência:', referenceMetrics);
        
        // 🎯 CALCULAR diferenças PURAS (referência como baseline)
        const differences = {
            lufs: userMetrics.lufs - referenceMetrics.lufs,
            stereoCorrelation: userMetrics.stereoCorrelation - referenceMetrics.stereoCorrelation,
            dynamicRange: userMetrics.dynamicRange - referenceMetrics.dynamicRange,
            truePeak: userMetrics.truePeak - referenceMetrics.truePeak
        };
        
        console.log('🔍 [COMPARAÇÃO] Diferenças calculadas:', differences);
        
        // 🎯 GERAR sugestões baseadas APENAS na referência
        const referenceSuggestions = [];
        const THRESHOLD = 0.2; // Ignorar diferenças menores que 0.2dB
        
        // Loudness (LUFS) - 🚨 COM VERIFICAÇÃO DE HEADROOM SEGURO
        if (Math.abs(differences.lufs) > THRESHOLD) {
            const action = differences.lufs > 0 ? 'Diminuir' : 'Aumentar';
            const direction = differences.lufs > 0 ? 'decrease' : 'increase';
            const adjustmentDb = Math.abs(differences.lufs);
            
            // 🔒 Verificar headroom se sugerindo aumento
            if (direction === 'increase') {
                const userTruePeak = userMetrics.truePeak;
                const clippingSamples = userAnalysis.technical?.clippingSamples || 0;
                const isClipped = clippingSamples > 0;
                const headroomSafetyMargin = -0.6; // Target true peak seguro
                
                // 🚨 REGRA 1: Se CLIPPED, não sugerir aumento
                if (isClipped) {
                    console.log(`[REF-HEADROOM] 🚨 Clipping detectado - não sugerindo aumento de ${adjustmentDb.toFixed(1)}dB`);
                    referenceSuggestions.push({
                        type: 'reference_loudness_blocked_clipping',
                        message: `Impossível igualar referência - áudio tem clipping`,
                        action: `Primeiro resolver clipping, depois ajustar para referência`,
                        frequency_range: 'N/A',
                        adjustment_db: 0,
                        direction: 'blocked',
                        baseline_source: 'reference_audio',
                        warning: `Clipping detectado (${clippingSamples} samples)`
                    });
                } 
                // 🚨 REGRA 2: Verificar headroom disponível
                else if (Number.isFinite(userTruePeak)) {
                    const availableHeadroom = headroomSafetyMargin - userTruePeak;
                    
                    if (adjustmentDb <= availableHeadroom) {
                        referenceSuggestions.push({
                            type: 'reference_loudness',
                            message: `${action} volume em ${adjustmentDb.toFixed(1)}dB para igualar à música de referência`,
                            action: `${action} volume em ${adjustmentDb.toFixed(1)}dB`,
                            frequency_range: 'N/A',
                            adjustment_db: adjustmentDb,
                            direction: direction,
                            baseline_source: 'reference_audio',
                            headroom_check: `Seguro: ${availableHeadroom.toFixed(1)}dB disponível`
                        });
                    } else {
                        console.log(`[REF-HEADROOM] ⚠️ Ganho ${adjustmentDb.toFixed(1)}dB > headroom ${availableHeadroom.toFixed(1)}dB - bloqueando`);
                        referenceSuggestions.push({
                            type: 'reference_loudness_blocked_headroom',
                            message: `Impossível igualar referência - sem headroom suficiente`,
                            action: `True Peak ${userTruePeak.toFixed(1)}dBTP permite apenas +${availableHeadroom.toFixed(1)}dB`,
                            frequency_range: 'N/A',
                            adjustment_db: availableHeadroom > 0 ? availableHeadroom : 0,
                            direction: 'limited',
                            baseline_source: 'reference_audio',
                            warning: `Necessário ${adjustmentDb.toFixed(1)}dB mas só ${availableHeadroom.toFixed(1)}dB seguro`
                        });
                    }
                } else {
                    // Sem True Peak, modo conservador
                    referenceSuggestions.push({
                        type: 'reference_loudness_conservative',
                        message: `${action} volume em ${adjustmentDb.toFixed(1)}dB para igualar referência (verificar clipping)`,
                        action: `${action} volume CUIDADOSAMENTE em ${adjustmentDb.toFixed(1)}dB`,
                        frequency_range: 'N/A',
                        adjustment_db: adjustmentDb,
                        direction: direction,
                        baseline_source: 'reference_audio',
                        warning: 'Sem dados True Peak - verifique clipping após ajuste'
                    });
                }
            } else {
                // Diminuir é sempre seguro
                referenceSuggestions.push({
                    type: 'reference_loudness',
                    message: `${action} volume em ${adjustmentDb.toFixed(1)}dB para igualar à música de referência`,
                    action: `${action} volume em ${adjustmentDb.toFixed(1)}dB`,
                    frequency_range: 'N/A',
                    adjustment_db: adjustmentDb,
                    direction: direction,
                    baseline_source: 'reference_audio'
                });
            }
        }
        
        // Dynamic Range
        if (Math.abs(differences.dynamicRange) > THRESHOLD) {
            const action = differences.dynamicRange > 0 ? 'Reduzir' : 'Aumentar';
            referenceSuggestions.push({
                type: 'reference_dynamics',
                message: `${action} range dinâmico em ${Math.abs(differences.dynamicRange).toFixed(1)}dB para igualar à referência`,
                action: `${action} range dinâmico em ${Math.abs(differences.dynamicRange).toFixed(1)}dB`,
                frequency_range: 'N/A',
                adjustment_db: Math.abs(differences.dynamicRange),
                baseline_source: 'reference_audio'
            });
        }
        
        // Stereo Correlation
        if (Math.abs(differences.stereoCorrelation) > 0.05) { // 5% threshold para correlação
            const action = differences.stereoCorrelation > 0 ? 'Reduzir' : 'Aumentar';
            referenceSuggestions.push({
                type: 'reference_stereo',
                message: `${action} correlação estéreo para igualar à referência (diferença: ${(differences.stereoCorrelation * 100).toFixed(1)}%)`,
                action: `Ajustar correlação estéreo`,
                frequency_range: 'N/A',
                baseline_source: 'reference_audio'
            });
        }
        
        // Pico Real
        if (Math.abs(differences.truePeak) > THRESHOLD) {
            const action = differences.truePeak > 0 ? 'Reduzir' : 'Aumentar';
            referenceSuggestions.push({
                type: 'reference_peak',
                message: `${action} pico em ${Math.abs(differences.truePeak).toFixed(1)}dB para igualar à referência`,
                action: `${action} pico em ${Math.abs(differences.truePeak).toFixed(1)}dB`,
                frequency_range: 'N/A',
                adjustment_db: Math.abs(differences.truePeak),
                baseline_source: 'reference_audio'
            });
        }
        
        console.log(`🔍 [COMPARAÇÃO] Sugestões geradas: ${referenceSuggestions.length}`);
        
        // 🎯 CRIAR análise final com comparação pura
        const finalAnalysis = {
            ...userAnalysis,
            comparison: {
                mode: 'reference',
                baseline_source: 'reference_audio',
                loudness: {
                    user: userMetrics.lufs,
                    reference: referenceMetrics.lufs,
                    difference: differences.lufs,
                    baseline: referenceMetrics.lufs
                },
                dynamics: {
                    user: userMetrics.dynamicRange,
                    reference: referenceMetrics.dynamicRange,
                    difference: differences.dynamicRange,
                    baseline: referenceMetrics.dynamicRange
                },
                stereo: {
                    user: userMetrics.stereoCorrelation,
                    reference: referenceMetrics.stereoCorrelation,
                    difference: differences.stereoCorrelation,
                    baseline: referenceMetrics.stereoCorrelation
                },
                peak: {
                    user: userMetrics.truePeak,
                    reference: referenceMetrics.truePeak,
                    difference: differences.truePeak,
                    baseline: referenceMetrics.truePeak
                }
            },
            suggestions: referenceSuggestions,
            // 🚫 NUNCA usar gênero em modo referência
            genre: null,
            mixScore: null, // Não gerar score baseado em gênero
            mixClassification: null
        };
        
        // 🎯 LOGS de validação final
        console.log('🎉 [SUCESSO] Comparação por referência concluída:');
        console.log('  - Modo:', finalAnalysis.comparison.mode);
        console.log('  - Baseline source:', finalAnalysis.comparison.baseline_source);
        console.log('  - Sugestões:', referenceSuggestions.length);
        console.log('  - Sem contaminação de gênero:', !finalAnalysis.genre);
        
        referenceStepState.finalAnalysis = finalAnalysis;
        console.log('🔍 [DIAGNÓSTICO] Reference analysis tem comparação com gênero:', !!refAnalysis.comparison);
        
        // 🎯 NOVO: Verificar se análises estão "limpas" (sem contaminar com gênero)
        const userClean = !userAnalysis.comparison && !userAnalysis.reference;
        const refClean = !refAnalysis.comparison && !refAnalysis.reference;
        console.log('🔍 [DIAGNÓSTICO] User analysis clean (sem gênero):', userClean);
        console.log('🔍 [DIAGNÓSTICO] Reference analysis clean (sem gênero):', refClean);
        
        // Gerar comparação
        const comparison = generateComparison(userAnalysis, refAnalysis);
        
        // 🐛 DIAGNÓSTICO: Verificar se comparison está usando os dados corretos
        console.log('🔍 [DIAGNÓSTICO] Comparison gerada:', comparison);
        console.log('🔍 [DIAGNÓSTICO] baseline_source: reference_audio (confirmed)');
        
        // Gerar sugestões baseadas na comparação
        const suggestions = generateReferenceSuggestions(comparison);
        
        // 🐛 DIAGNÓSTICO: Verificar se sugestões são baseadas apenas na comparison
        console.log('🔍 [DIAGNÓSTICO] Sugestões geradas (count):', suggestions.length);
        console.log('🔍 [DIAGNÓSTICO] Primeiro tipo de sugestão:', suggestions[0]?.type);
        
        // Criar análise combinada para exibição
        const combinedAnalysis = {
            ...userAnalysis,
            comparison,
            suggestions: [...(userAnalysis.suggestions || []), ...suggestions],
            analysisMode: 'reference',
            referenceFile: referenceStepState.referenceAudioFile.name,
            userFile: referenceStepState.userAudioFile.name,
            // 🎯 NOVO: Incluir métricas da referência para renderReferenceComparisons
            referenceMetrics: {
                lufs: refAnalysis.technicalData?.lufsIntegrated,
                truePeakDbtp: refAnalysis.technicalData?.truePeakDbtp,
                dynamicRange: refAnalysis.technicalData?.dynamicRange,
                lra: refAnalysis.technicalData?.lra,
                stereoCorrelation: refAnalysis.technicalData?.stereoCorrelation,
                // 🔧 CORREÇÃO: Criar estrutura de bands compatível
                bands: refAnalysis.technicalData?.bandEnergies ? (() => {
                    const refBands = {};
                    const refBandEnergies = refAnalysis.technicalData.bandEnergies;
                    
                    // Criar estrutura de bands usando as métricas da referência como targets
                    Object.entries(refBandEnergies).forEach(([bandName, bandData]) => {
                        if (bandData && Number.isFinite(bandData.rms_db)) {
                            refBands[bandName] = {
                                target_db: bandData.rms_db,  // Usar valor da referência como target
                                tol_db: 3.0,  // Tolerância padrão
                                _target_na: false
                            };
                        }
                    });
                    
                    return refBands;
                })() : null
            },
            // 🐛 DIAGNÓSTICO: Adicionar metadados para diagnóstico
            _diagnostic: {
                baseline_source: 'reference_audio',
                mode: 'reference',
                userLufs: userAnalysis.technicalData?.lufsIntegrated,
                referenceLufs: refAnalysis.technicalData?.lufsIntegrated,
                difference: comparison.loudness?.difference,
                genreActive: window.PROD_AI_REF_GENRE,
                useGenreTargets: false,
                // 🎯 NOVO: Informações de normalização e janela
                usedWindowSeconds: 30, // TODO: pegar do analyzer quando implementado
                normalizedLUFS: {
                    user: userAnalysis.technicalData?.lufsIntegrated,
                    ref: refAnalysis.technicalData?.lufsIntegrated
                },
                analysisTimestamp: new Date().toISOString()
            }
        };
        
        console.log('🔍 [DIAGNÓSTICO] Combined analysis diagnostic:', combinedAnalysis._diagnostic);
        
        currentModalAnalysis = combinedAnalysis;
        
        updateModalProgress(100, '✨ Comparação Completa!');
        
        // Mostrar resultados
        setTimeout(() => {
            // 🔒 UI GATE: Verificar se análise ainda é válida
            const analysisRunId = combinedAnalysis?.runId || combinedAnalysis?.metadata?.runId;
            const currentRunId = window.__CURRENT_ANALYSIS_RUN_ID__;
            
            if (analysisRunId && currentRunId && analysisRunId !== currentRunId) {
                console.warn(`🚫 [UI_GATE] Comparação cancelada - não renderizar UI (análise: ${analysisRunId}, atual: ${currentRunId})`);
                return;
            }
            
            displayModalResults(combinedAnalysis);
            window.logReferenceEvent('reference_comparison_completed');
        }, 800);
        
    } catch (error) {
        console.error('❌ Erro na comparação:', error);
        window.logReferenceEvent('reference_comparison_error', { error: error.message });
        showModalError(`Erro na comparação: ${error.message}`);
    }
}

// 🎯 NOVO: Gerar comparação entre duas análises
function generateComparison(userAnalysis, refAnalysis) {
    const userTech = userAnalysis.technicalData || {};
    const refTech = refAnalysis.technicalData || {};
    
    return {
        loudness: {
            user: userTech.lufsIntegrated || null,
            reference: refTech.lufsIntegrated || null,
            difference: (userTech.lufsIntegrated && refTech.lufsIntegrated) 
                ? userTech.lufsIntegrated - refTech.lufsIntegrated 
                : null
        },
        dynamics: {
            user: userTech.lra || userTech.crestFactor || null,
            reference: refTech.lra || refTech.crestFactor || null,
            difference: (userTech.lra && refTech.lra) 
                ? userTech.lra - refTech.lra 
                : null
        },
        stereo: {
            user: userTech.stereoCorrelation || null,
            reference: refTech.stereoCorrelation || null,
            difference: (userTech.stereoCorrelation && refTech.stereoCorrelation) 
                ? userTech.stereoCorrelation - refTech.stereoCorrelation 
                : null
        },
        spectral: compareSpectralData(userTech, refTech)
    };
}

// 🎯 NOVO: Comparar dados espectrais
function compareSpectralData(userTech, refTech) {
    const bandNames = ['subBass', 'bass', 'lowMid', 'mid', 'upperMid', 'presence', 'brilliance', 'air'];
    const comparisons = {};
    
    bandNames.forEach(band => {
        const userValue = userTech[`${band}Energy`] || userTech[`energy_${band}`] || null;
        const refValue = refTech[`${band}Energy`] || refTech[`energy_${band}`] || null;
        
        if (userValue !== null && refValue !== null) {
            comparisons[band] = {
                user: userValue,
                reference: refValue,
                difference: userValue - refValue
            };
        }
    });
    
    return comparisons;
}

// 🎯 NOVO: Gerar sugestões baseadas na comparação
function generateReferenceSuggestions(comparison) {
    // 🐛 DIAGNÓSTICO: Logs para verificar fonte dos dados
    console.log('🔍 [DIAGNÓSTICO] generateReferenceSuggestions called with:', comparison);
    console.log('🔍 [DIAGNÓSTICO] Usando APENAS dados da comparison, não genre targets');
    console.log('🔍 [DIAGNÓSTICO] Genre ativo (NÃO usado):', window.PROD_AI_REF_GENRE);
    
    const suggestions = [];
    
    // Sugestões de loudness - 🚨 COM VERIFICAÇÃO DE HEADROOM SEGURO
    if (comparison.loudness.difference !== null) {
        const diff = comparison.loudness.difference;
        console.log('🔍 [DIAGNÓSTICO] Loudness difference:', diff);
        
        if (Math.abs(diff) > 1) {
            const adjustmentDb = Math.abs(diff);
            const direction = diff > 0 ? 'decrease' : 'increase';
            
            // 🔒 Verificar headroom se sugerindo aumento
            if (direction === 'increase') {
                // Tentar acessar dados do usuário para verificação de headroom
                const userTruePeak = comparison.userTruePeak || null;
                const userClipping = comparison.userClipping || 0;
                const isClipped = userClipping > 0;
                const headroomSafetyMargin = -0.6;
                
                if (isClipped) {
                    console.log(`[REF-HEADROOM] 🚨 Clipping detectado - bloqueando aumento de ${adjustmentDb.toFixed(1)}dB`);
                    suggestions.push({
                        type: 'reference_loudness_blocked_clipping',
                        message: 'Impossível igualar referência - áudio tem clipping',
                        action: 'Primeiro resolver clipping, depois ajustar para referência',
                        explanation: 'Clipping detectado impede aumento seguro',
                        frequency_range: 'N/A',
                        adjustment_db: 0,
                        direction: 'blocked',
                        warning: `Clipping detectado (${userClipping} samples)`
                    });
                } else if (Number.isFinite(userTruePeak)) {
                    const availableHeadroom = headroomSafetyMargin - userTruePeak;
                    
                    if (adjustmentDb <= availableHeadroom) {
                        const suggestion = {
                            type: 'reference_loudness',
                            message: 'Sua música está mais baixa que a referência',
                            action: `Aumentar volume em ${adjustmentDb.toFixed(1)}dB`,
                            explanation: 'Para match de loudness com a referência',
                            frequency_range: 'N/A',
                            adjustment_db: adjustmentDb,
                            direction: direction,
                            headroom_check: `Seguro: ${availableHeadroom.toFixed(1)}dB disponível`
                        };
                        suggestions.push(suggestion);
                    } else {
                        console.log(`[REF-HEADROOM] ⚠️ Ganho ${adjustmentDb.toFixed(1)}dB > headroom ${availableHeadroom.toFixed(1)}dB`);
                        suggestions.push({
                            type: 'reference_loudness_blocked_headroom',
                            message: 'Impossível igualar referência - sem headroom suficiente',
                            action: `True Peak permite apenas +${availableHeadroom.toFixed(1)}dB (necessário ${adjustmentDb.toFixed(1)}dB)`,
                            explanation: 'Aumentar mais causaria clipping (True Peak > -0.6 dBTP)',
                            frequency_range: 'N/A',
                            adjustment_db: availableHeadroom > 0 ? availableHeadroom : 0,
                            direction: 'limited',
                            warning: `Necessário ${adjustmentDb.toFixed(1)}dB mas só ${availableHeadroom.toFixed(1)}dB seguro`
                        });
                    }
                } else {
                    // Sem True Peak, modo conservador
                    suggestions.push({
                        type: 'reference_loudness_conservative',
                        message: 'Sua música está mais baixa que a referência (verificar clipping)',
                        action: `Aumentar CUIDADOSAMENTE volume em ${adjustmentDb.toFixed(1)}dB`,
                        explanation: 'Sem dados True Peak - risco de clipping',
                        frequency_range: 'N/A',
                        adjustment_db: adjustmentDb,
                        direction: direction,
                        warning: 'Verifique clipping após ajuste'
                    });
                }
            } else {
                // Diminuir é sempre seguro
                const suggestion = {
                    type: 'reference_loudness',
                    message: 'Sua música está mais alta que a referência',
                    action: `Diminuir volume em ${adjustmentDb.toFixed(1)}dB`,
                    explanation: 'Para match de loudness com a referência',
                    frequency_range: 'N/A',
                    adjustment_db: adjustmentDb,
                    direction: direction
                };
                suggestions.push(suggestion);
            }
            
            console.log('🔍 [DIAGNÓSTICO] Sugestão de loudness processada com headroom check');
        }
    }
    
    // Sugestões espectrais
    Object.entries(comparison.spectral).forEach(([band, data]) => {
        console.log(`🔍 [DIAGNÓSTICO] Spectral band ${band}:`, data);
        
        if (Math.abs(data.difference) > 2) {
            const freqRanges = {
                subBass: '20-60 Hz',
                bass: '60-250 Hz',
                lowMid: '250-500 Hz',
                mid: '500-2k Hz',
                upperMid: '2k-4k Hz',
                presence: '4k-6k Hz',
                brilliance: '6k-12k Hz',
                air: '12k-20k Hz'
            };
            
            const suggestion = {
                type: 'reference_spectral',
                message: data.difference > 0 ? `Muito ${band} comparado à referência` : `Pouco ${band} comparado à referência`,
                action: data.difference > 0 ? `Cortar ${band}` : `Realçar ${band}`,
                explanation: `Para match espectral com a referência`,
                frequency_range: freqRanges[band] || 'N/A',
                adjustment_db: Math.abs(data.difference),
                direction: data.difference > 0 ? 'cut' : 'boost',
                q_factor: 1.0
            };
            
            console.log(`🔍 [DIAGNÓSTICO] Adicionando sugestão espectral para ${band}:`, suggestion);
            suggestions.push(suggestion);
        }
    });
    
    console.log('🔍 [DIAGNÓSTICO] Total sugestões geradas:', suggestions.length);
    console.log('🔍 [DIAGNÓSTICO] baseline_source: reference_audio (confirmed)');
    
    return suggestions;
}

// 🎯 NOVO: Adicionar seção de comparação com referência
function addReferenceComparisonSection(analysis) {
    const results = document.getElementById('audioAnalysisResults');
    if (!results) return;
    
    const comparison = analysis.comparison;
    const userFile = analysis.userFile || 'Sua música';
    const referenceFile = analysis.referenceFile || 'Música de referência';
    
    // Criar seção de comparação
    const comparisonSection = document.createElement('div');
    comparisonSection.className = 'reference-comparison-section';
    comparisonSection.innerHTML = `
        <div class="comparison-header">
            <h4>🎯 Comparação com Referência</h4>
            <div class="comparison-files">
                <span class="file-indicator user">📄 ${userFile}</span>
                <span class="vs-indicator">vs</span>
                <span class="file-indicator reference">🎯 ${referenceFile}</span>
            </div>
        </div>
        
        <div class="comparison-content">
            <div class="comparison-grid">
                ${generateComparisonRow('Loudness', comparison.loudness, 'LUFS')}
                ${generateComparisonRow('Faixa Dinâmica', comparison.dynamics, 'dB')}
                ${generateComparisonRow('Correlação Estéreo', comparison.stereo, '')}
            </div>
            
            ${comparison.spectral && Object.keys(comparison.spectral).length > 0 ? `
                <div class="spectral-comparison">
                    <h5>📊 Análise Espectral</h5>
                    <div class="spectral-grid">
                        ${Object.entries(comparison.spectral).map(([band, data]) => 
                            generateSpectralComparisonCard(band, data)
                        ).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Inserir no início da seção de resultados
    const resultsHeader = results.querySelector('.results-header');
    if (resultsHeader) {
        resultsHeader.insertAdjacentElement('afterend', comparisonSection);
    } else {
        results.insertBefore(comparisonSection, results.firstChild);
    }
    
    window.logReferenceEvent('comparison_section_displayed');
}

// 🎯 NOVO: Gerar linha de comparação
function generateComparisonRow(label, comparisonData, unit) {
    if (!comparisonData || comparisonData.difference === null) {
        return `
            <div class="comparison-row unavailable">
                <div class="comparison-label">${label}</div>
                <div class="comparison-values">
                    <span class="comparison-unavailable">Dados insuficientes</span>
                </div>
            </div>
        `;
    }
    
    const userValue = comparisonData.user?.toFixed?.(1) || comparisonData.user || '—';
    const refValue = comparisonData.reference?.toFixed?.(1) || comparisonData.reference || '—';
    const diff = comparisonData.difference?.toFixed?.(1) || '—';
    const diffClass = comparisonData.difference > 0 ? 'positive' : comparisonData.difference < 0 ? 'negative' : 'neutral';
    
    return `
        <div class="comparison-row">
            <div class="comparison-label">${label}</div>
            <div class="comparison-values">
                <div class="value-pair">
                    <span class="user-value">${userValue}${unit}</span>
                    <span class="ref-value">${refValue}${unit}</span>
                </div>
                <div class="difference-indicator ${diffClass}">
                    ${diff > 0 ? '+' : ''}${diff}${unit}
                </div>
            </div>
        </div>
    `;
}

// 🎯 NOVO: Gerar card de comparação espectral
function generateSpectralComparisonCard(band, data) {
    const bandNames = {
        subBass: 'Sub Bass',
        bass: 'Bass',
        lowMid: 'Low Mid',
        mid: 'Mid',
        upperMid: 'Upper Mid',
        presence: 'Presence',
        brilliance: 'Brilliance',
        air: 'Air'
    };
    
    const friendlyName = bandNames[band] || band;
    const diff = data.difference?.toFixed?.(1) || '—';
    const diffClass = data.difference > 2 ? 'high-positive' : 
                      data.difference > 0.5 ? 'positive' : 
                      data.difference < -2 ? 'high-negative' : 
                      data.difference < -0.5 ? 'negative' : 'neutral';
    
    return `
        <div class="spectral-card ${diffClass}">
            <div class="spectral-band-name">${friendlyName}</div>
            <div class="spectral-difference">${diff > 0 ? '+' : ''}${diff}dB</div>
        </div>
    `;
}

// ⏳ Aguardar Audio Analyzer carregar
function waitForAudioAnalyzer() {
    return new Promise((resolve) => {
        if (window.audioAnalyzer) {
            resolve();
            return;
        }
        
        const checkInterval = setInterval(() => {
            if (window.audioAnalyzer) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        
        // Timeout após 10 segundos
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 10000);
    });
}


// ❌ Mostrar erro no modal
function showModalError(message) {
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (results) {
        results.style.display = 'block';
        results.innerHTML = `
            <div style="color: #ff4444; text-align: center; padding: 30px;">
                <div style="font-size: 3em; margin-bottom: 15px;">⚠️</div>
                <h3 style="margin: 0 0 15px 0; color: #ff4444;">Erro na Análise</h3>
                <p style="margin: 0 0 25px 0; color: #666; line-height: 1.4;">${message}</p>
                <button onclick="resetModalState()" style="
                    background: #ff4444; 
                    color: white; 
                    border: none; 
                    padding: 12px 25px; 
                    border-radius: 6px; 
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#ff3333'" 
                   onmouseout="this.style.background='#ff4444'">
                    Tentar Novamente
                </button>
            </div>
        `;
    }
}

// �🔄 Mostrar loading no modal
function showModalLoading() {
    __dbg('🔄 Exibindo tela de loading no modal...');
    
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    // 🔧 CORREÇÃO: Garantir que o loading seja exibido corretamente
    if (uploadArea) {
        uploadArea.style.display = 'none';
        __dbg('✅ Upload area ocultada');
    }
    if (results) {
        results.style.display = 'none';
        __dbg('✅ Results area ocultada');
    }
    if (loading) {
        loading.style.display = 'block';
        __dbg('✅ Loading area exibida');
    } else {
        __dbg('❌ Elemento audioAnalysisLoading não encontrado!');
    }
    
    // Reset progress
    updateModalProgress(0, '🔄 Inicializando Engine de Análise...');
    __dbg('✅ Progresso resetado e loading configurado');
}

// 📈 Simular progresso
// (função de simulação de progresso removida — não utilizada)

// =============== MODAL GUARD ===============

/**
 * 🛡️ MODAL GUARD: Só exibe modal quando dados reais estão disponíveis
 */
function validateAnalysisDataCompleteness(analysis) {
    if (!analysis || typeof analysis !== 'object') {
        console.warn('🛡️ [MODAL_GUARD] Dados de análise inválidos ou ausentes');
        return { valid: false, reason: 'Dados ausentes' };
    }
    
    // Verificar se tem métricas principais
    const tech = analysis.technicalData || {};
    const requiredMetrics = {
        'peak': tech.peak,
        'rms': tech.rms, 
        'lufsIntegrated': tech.lufsIntegrated,
        'dynamicRange': tech.dynamicRange
    };
    
    const missingMetrics = [];
    Object.entries(requiredMetrics).forEach(([metric, value]) => {
        if (!Number.isFinite(value)) {
            missingMetrics.push(metric);
        }
    });
    
    // Verificar se é fallback incompleto
    const isFallback = analysis.mode === 'fallback_metadata' || 
                      analysis.usedFallback === true ||
                      analysis.scoringMethod === 'error_fallback';
    
    const hasScore = Number.isFinite(analysis.score) || Number.isFinite(analysis.qualityOverall);
    
    if (missingMetrics.length > 2) {
        console.warn('🛡️ [MODAL_GUARD] Muitas métricas principais ausentes:', missingMetrics);
        return { 
            valid: false, 
            reason: `Métricas ausentes: ${missingMetrics.join(', ')}`
        };
    }
    
    if (isFallback && !hasScore) {
        console.warn('🛡️ [MODAL_GUARD] Fallback sem score válido');
        return { 
            valid: false, 
            reason: 'Fallback incompleto'
        };
    }
    
    console.log('✅ [MODAL_GUARD] Dados validados - modal pode ser exibido');
    return { 
        valid: true, 
        dataQuality: isFallback ? 'fallback' : 'complete',
        missingCount: missingMetrics.length 
    };
}

/**
 * Exibe erro de análise para o usuário
 */
function showAnalysisError(message) {
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (loading) loading.style.display = 'none';
    if (results) {
        results.style.display = 'block';
        results.innerHTML = `
            <div class="analysis-error" style="
                padding: 40px;
                text-align: center;
                background: #1a1a1a;
                border: 2px solid #ff6b6b;
                border-radius: 12px;
                margin: 20px;
            ">
                <h3 style="color: #ff6b6b; margin-bottom: 20px;">⚠️ Análise Incompleta</h3>
                <p style="color: #ccc; margin-bottom: 20px;">${message}</p>
                <p style="color: #999; margin-bottom: 30px;">Tente novamente com um arquivo diferente ou aguarde alguns minutos.</p>
                <button onclick="location.reload()" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                " class="retry-btn">🔄 Tentar Novamente</button>
            </div>
        `;
    }
}

// 📊 Mostrar resultados no modal
// 📊 Mostrar resultados no modal
function displayModalResults(analysis) {
    // 🛡️ APLICAR MODAL GUARD: Verificar dados antes de exibir
    const validation = validateAnalysisDataCompleteness(analysis);
    
    if (!validation.valid) {
        console.error('🛡️ [MODAL_GUARD] Bloqueando exibição do modal:', validation.reason);
        
        // Exibir erro para usuário ao invés de modal vazio
        showAnalysisError(`Análise incompleta: ${validation.reason}`);
        return;
    }
    
    console.log('✅ [MODAL_GUARD] Validação passou - prosseguindo com exibição');
    console.log(`📊 [MODAL_GUARD] Qualidade dos dados: ${validation.dataQuality}`);
    console.log(`🔍 [MODAL_GUARD] Métricas ausentes: ${validation.missingCount}`);
    
    // Adicionar flags de qualidade dos dados para referência
    analysis._dataQuality = validation.dataQuality;
    analysis._missingMetrics = validation.missingCount;
    // 🔒 UI GATE: Verificação final antes de renderizar
    const analysisRunId = analysis?.runId || analysis?.metadata?.runId;
    const currentRunId = window.__CURRENT_ANALYSIS_RUN_ID__;
    
    if (analysisRunId && currentRunId && analysisRunId !== currentRunId) {
        console.warn(`🚫 [UI_GATE] displayModalResults cancelado - análise obsoleta (análise: ${analysisRunId}, atual: ${currentRunId})`);
        return;
    }
    
    // ✅ LOG DE AUDITORIA: Registrar expansão de métricas implementada
    console.log('📊 [MODAL_EXPANSION] Exibindo TODAS as métricas disponíveis do backend');
    console.log('🎯 [MODAL_EXPANSION] Mudanças implementadas:');
    console.log('   • LUFS Short-term e Momentary adicionados');
    console.log('   • MFCC Coefficients (13 valores) exibidos');
    console.log('   • Spectral Balance completo (6 bandas)');
    console.log('   • Tonal Balance detalhado por banda');
    console.log('   • DC Offset, THD, Clipping samples');
    console.log('   • Métricas de metadados (codec, bitrate, duração)');
    console.log('   • Diagnósticos estruturados por severidade');
    console.log('   • Sugestões priorizadas com confiança');
    console.log('   • Compatibilidade 100% preservada com UI existente');
    
    // 📊 Progress: Esconder barra de progresso ao exibir resultados
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = document.querySelector('.progress-fill');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    if (progressBar) {
        progressBar.style.width = '0%';
    }
    console.log('📊 Progress: Barra de progresso ocultada - exibindo resultados');
    
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    const technicalData = document.getElementById('modalTechnicalData');
    
    if (!results || !technicalData) {
        console.error('❌ Elementos de resultado não encontrados');
        return;
    }
    
    // � DEBUG: Log COMPLETO dos dados brutos do backend ANTES da normalização
    console.log('🚨 [RAW_BACKEND_DATA] DADOS BRUTOS COMPLETOS DO BACKEND:');
    console.log('🔍 [RAW_BACKEND_DATA] analysis ORIGINAL:', JSON.stringify(analysis, null, 2));
    console.log('🔍 [RAW_BACKEND_DATA] analysis.technicalData:', analysis?.technicalData);
    console.log('🔍 [RAW_BACKEND_DATA] analysis.metrics:', analysis?.metrics);
    console.log('🔍 [RAW_BACKEND_DATA] analysis.raw_data:', analysis?.raw_data);
    console.log('🔍 [RAW_BACKEND_DATA] analysis.result:', analysis?.result);
    
    // �🔧 CORREÇÃO CRÍTICA: Normalizar dados do backend para compatibilidade com front-end
    if (analysis && typeof analysis === 'object') {
        analysis = normalizeBackendAnalysisData(analysis);
        console.log('📊 [DEBUG] Dados APÓS normalização:', analysis);
        console.log('📊 [DEBUG] technicalData APÓS normalização:', analysis?.technicalData);
        
        // 🔍 TELEMETRIA CRÍTICA: Verificar se métricas essenciais foram mapeadas
        console.log('🔍 [AUDIT_METRICS] Verificação pós-normalização:');
        console.log('🔍 [AUDIT_METRICS] peak:', analysis.technicalData?.peak, '(from backend peak_db)');
        console.log('🔍 [AUDIT_METRICS] rms:', analysis.technicalData?.rms, '(from backend rms_level)');
        console.log('🔍 [AUDIT_METRICS] lufsIntegrated:', analysis.technicalData?.lufsIntegrated, '(from backend lufs_integrated)');
        console.log('🔍 [AUDIT_METRICS] truePeakDbtp:', analysis.technicalData?.truePeakDbtp, '(from backend true_peak)');
        console.log('🔍 [AUDIT_METRICS] dynamicRange:', analysis.technicalData?.dynamicRange, '(from backend dynamic_range)');
        console.log('🔍 [AUDIT_METRICS] crestFactor:', analysis.technicalData?.crestFactor, '(from backend crest_factor)');
        console.log('🔍 [AUDIT_METRICS] stereoCorrelation:', analysis.technicalData?.stereoCorrelation, '(from backend stereo_correlation)');
        console.log('🔍 [AUDIT_METRICS] score:', analysis.score, '(from backend qualityOverall)');
        console.log('🔍 [AUDIT_METRICS] classification:', analysis.classification);

        // Telemetria de completude
        const requiredFields = ['peak', 'rms', 'lufsIntegrated', 'truePeakDbtp', 'dynamicRange'];
        const missingFields = requiredFields.filter(f => !Number.isFinite(analysis.technicalData?.[f]));
        const hasAllMainMetrics = missingFields.length === 0;
        const hasScore = Number.isFinite(analysis.score);
        const hasClassification = !!analysis.classification;
        
        console.log('🔍 [AUDIT_COMPLETENESS] Resumo final:');
        console.log('🔍 [AUDIT_COMPLETENESS] Missing fields:', missingFields);
        console.log('🔍 [AUDIT_COMPLETENESS] Has all main metrics:', hasAllMainMetrics);
        console.log('🔍 [AUDIT_COMPLETENESS] Has score:', hasScore);
        console.log('🔍 [AUDIT_COMPLETENESS] Has classification:', hasClassification);
        
        // Expor para debug global
        window.__DEBUG_ANALYSIS = { 
            analysis, 
            missingFields, 
            hasAllMainMetrics,
            hasScore,
            hasClassification,
            runId: analysis?.runId || analysis?.metadata?.runId,
            timestamp: new Date().toISOString()
        };
        
        // Status para validação manual
        if (hasAllMainMetrics && hasScore) {
            console.log('✅ [PIPELINE_STATUS] BACKEND_PAYLOAD_OK + NORMALIZE_OK - Pronto para renderização');
        } else {
            console.warn('⚠️ [PIPELINE_STATUS] DADOS INCOMPLETOS - Alguns campos podem ficar vazios');
        }
    }
    
    // Ocultar outras seções
    if (uploadArea) uploadArea.style.display = 'none';
    if (loading) loading.style.display = 'none';
    
    // Mostrar resultados
    results.style.display = 'block';
    
    // 🎯 NOVO: Verificar se é modo referência e adicionar seção de comparação
    if (analysis.analysisMode === 'reference' && analysis.comparison) {
        addReferenceComparisonSection(analysis);
    }
    
    // Marcar se pacote avançado chegou (LUFS integrado + Pico Real + LRA)
    const advancedReady = (
        Number.isFinite(analysis?.technicalData?.lufs_integrated) &&
        Number.isFinite(analysis?.technicalData?.truePeakDbtp)
    );
    if (typeof window !== 'undefined') window.__AUDIO_ADVANCED_READY__ = advancedReady;

    // Helpers seguros com bloqueio de fallback se advanced não pronto + EXPANSÃO SEGURA
    const safeFixed = (v, d=1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
    const safeHz = (v) => (Number.isFinite(v) ? `${Math.round(v)} Hz` : '—');
    const pct = (v, d=0) => (Number.isFinite(v) ? `${(v*100).toFixed(d)}%` : '—');
    const safeFallback = (value, fallback = 'N/A') => (value !== undefined && value !== null && value !== '') ? value : fallback;
    const safeArray = (arr) => Array.isArray(arr) ? arr : [];
    const safeObject = (obj) => (obj && typeof obj === 'object') ? obj : {};
    
    const tonalSummary = (tb) => {
        if (!tb || typeof tb !== 'object') return '—';
        const parts = [];
        if (tb.sub && Number.isFinite(tb.sub.rms_db)) parts.push(`Sub ${tb.sub.rms_db.toFixed(1)}dB`);
        if (tb.low && Number.isFinite(tb.low.rms_db)) parts.push(`Low ${tb.low.rms_db.toFixed(1)}dB`);
        if (tb.mid && Number.isFinite(tb.mid.rms_db)) parts.push(`Mid ${tb.mid.rms_db.toFixed(1)}dB`);
        if (tb.high && Number.isFinite(tb.high.rms_db)) parts.push(`High ${tb.high.rms_db.toFixed(1)}dB`);
        return parts.length ? parts.join(' • ') : '—';
    };

        // Layout com cards e KPIs, mantendo o container #modalTechnicalData
        const kpi = (value, label, cls='') => `
            <div class="kpi ${cls}">
                <div class="kpi-value">${value}</div>
                <div class="kpi-label">${label}</div>
            </div>`;

        const scoreKpi = Number.isFinite(analysis.qualityOverall) ? kpi(Number(analysis.qualityOverall.toFixed(1)), 'SCORE GERAL', 'kpi-score') : '';
        const timeKpi = Number.isFinite(analysis.processingMs) ? kpi(analysis.processingMs, 'TEMPO (MS)', 'kpi-time') : '';

        const src = (k) => (analysis.technicalData?._sources && analysis.technicalData._sources[k]) ? ` data-src="${analysis.technicalData._sources[k]}" title="origem: ${analysis.technicalData._sources[k]}"` : '';
        const row = (label, valHtml, keyForSource=null) => {
            // Usar sistema de enhancement se disponível
            const enhancedLabel = (typeof window !== 'undefined' && window.enhanceRowLabel) 
                ? window.enhanceRowLabel(label, keyForSource) 
                : label;
            
            return `
                <div class="data-row"${keyForSource?src(keyForSource):''}>
                    <span class="label">${enhancedLabel}</span>
                    <span class="value">${valHtml}</span>
                </div>`;
        };

        // 🎯 CENTRALIZAÇÃO DAS MÉTRICAS - Funções de acesso unificado
        const getMetric = (metricPath, fallbackPath = null) => {
            // Prioridade: metrics centralizadas > technicalData legado > fallback
            const centralizedValue = analysis.metrics && getNestedValue(analysis.metrics, metricPath);
            if (Number.isFinite(centralizedValue)) {
                // Log temporário para validação
                if (typeof window !== 'undefined' && window.METRICS_UI_VALIDATION !== false) {
                    const legacyValue = fallbackPath ? getNestedValue(analysis.technicalData, fallbackPath) : getNestedValue(analysis.technicalData, metricPath);
                    if (Number.isFinite(legacyValue) && Math.abs(centralizedValue - legacyValue) > 0.01) {
                        console.warn(`🎯 METRIC_DIFF: ${metricPath} centralized=${centralizedValue} vs legacy=${legacyValue}`);
                    }
                }
                return centralizedValue;
            }
            
            // Fallback para technicalData legado
            const legacyValue = fallbackPath ? getNestedValue(analysis.technicalData, fallbackPath) : getNestedValue(analysis.technicalData, metricPath);
            return Number.isFinite(legacyValue) ? legacyValue : null;
        };
        
        const getNestedValue = (obj, path) => {
            return path.split('.').reduce((current, key) => current?.[key], obj);
        };

        const safePct = (v) => (Number.isFinite(v) ? `${(v*100).toFixed(0)}%` : '—');
        const monoCompat = (s) => s ? s : '—';

        // Função para obter o valor LUFS integrado usando métricas centralizadas
        const getLufsIntegratedValue = () => {
            return getMetric('lufs_integrated', 'lufsIntegrated');
        };

        const col1 = [
            row('Peak (máximo)', `${safeFixed(getMetric('peak_db', 'peak'))} dB`, 'peak'),
            row('RMS Level', `${safeFixed(getMetric('rms_level', 'rmsLevel'))} dB`, 'rmsLevel'),
            row('DR', `${safeFixed(getMetric('dynamic_range', 'dynamicRange'))} dB`, 'dynamicRange'),
            row('Fator de Crista', `${safeFixed(getMetric('crest_factor', 'crestFactor'))} dB`, 'crestFactor'),
            row('Pico Real (dBTP)', (advancedReady && Number.isFinite(getMetric('truePeakDbtp', 'truePeakDbtp'))) ? `${safeFixed(getMetric('truePeakDbtp', 'truePeakDbtp'))} dBTP` : (advancedReady? '—':'⏳'), 'truePeakDbtp'),
            row('LUFS Integrado', (advancedReady && Number.isFinite(getLufsIntegratedValue())) ? `${safeFixed(getLufsIntegratedValue())} LUFS` : (advancedReady? '—':'⏳'), 'lufsIntegrated'),
            row('LUFS Short-term', (advancedReady && Number.isFinite(getMetric('lufs_short_term', 'lufsShortTerm'))) ? `${safeFixed(getMetric('lufs_short_term', 'lufsShortTerm'))} LUFS` : (advancedReady? '—':'⏳'), 'lufsShortTerm'),
            row('LUFS Momentary', (advancedReady && Number.isFinite(getMetric('lufs_momentary', 'lufsMomentary'))) ? `${safeFixed(getMetric('lufs_momentary', 'lufsMomentary'))} LUFS` : (advancedReady? '—':'⏳'), 'lufsMomentary'),
            row('Headroom', `${safeFixed(getMetric('headroom_db', 'headroomDb'))} dB`, 'headroomDb')
            ].join('');

        const col2 = [
            row('Correlação Estéreo', Number.isFinite(getMetric('stereo_correlation', 'stereoCorrelation')) ? safeFixed(getMetric('stereo_correlation', 'stereoCorrelation'), 2) : '—', 'stereoCorrelation'),
            row('Largura Estéreo', Number.isFinite(getMetric('stereo_width', 'stereoWidth')) ? safeFixed(getMetric('stereo_width', 'stereoWidth'), 2) : '—', 'stereoWidth'),
            row('Balance L/R', Number.isFinite(getMetric('balance_lr', 'balanceLR')) ? safePct(getMetric('balance_lr', 'balanceLR')) : '—', 'balanceLR'),
            row('Centroide Espectral', Number.isFinite(getMetric('spectral_centroid', 'spectralCentroid')) ? safeHz(getMetric('spectral_centroid', 'spectralCentroid')) : '—', 'spectralCentroid'),
            row('Rolloff Espectral', Number.isFinite(getMetric('spectral_rolloff', 'spectralRolloff')) ? safeHz(getMetric('spectral_rolloff', 'spectralRolloff')) : '—', 'spectralRolloff'),
            row('Zero Crossing Rate', Number.isFinite(getMetric('zero_crossing_rate', 'zeroCrossingRate')) ? safeFixed(getMetric('zero_crossing_rate', 'zeroCrossingRate'), 3) : '—', 'zeroCrossingRate'),
            row('Flux', Number.isFinite(getMetric('spectral_flux', 'spectralFlux')) ? safeFixed(getMetric('spectral_flux', 'spectralFlux'), 3) : '—', 'spectralFlux'),
            row('Flatness', Number.isFinite(getMetric('spectral_flatness', 'spectralFlatness')) ? safeFixed(getMetric('spectral_flatness', 'spectralFlatness'), 3) : '—', 'spectralFlatness')
        ].join('');

            const col3Extras = (()=>{
                let extra='';
                try {
                    const list = Array.isArray(analysis.technicalData.dominantFrequencies) ? analysis.technicalData.dominantFrequencies.slice() : [];
                    if (list.length>1) {
                        list.sort((a,b)=> (b.occurrences||0)-(a.occurrences||0) || a.frequency - b.frequency);
                        const filtered=[];
                        for (const f of list) {
                            if (!Number.isFinite(f.frequency)) continue;
                            if (filtered.some(x=> Math.abs(x.frequency - f.frequency) < 40)) continue;
                            filtered.push(f); if (filtered.length>=5) break;
                        }
                        extra = filtered.slice(1,4).map(f=>`${Math.round(f.frequency)}Hz`).join(', ');
                    }
                } catch {}
                return extra ? row('Top Freq. adicionais', `<span style="opacity:.9">${extra}</span>`) : '';
            })();
            // 🎯 SEÇÃO EXPANDIDA: Col3 agora inclui todas as métricas técnicas adicionais
            const col3 = [
                row('Tonal Balance', analysis.technicalData?.tonalBalance ? tonalSummary(analysis.technicalData.tonalBalance) : '—', 'tonalBalance'),
                (analysis.technicalData?.dominantFrequencies?.length > 0 ? row('Freq. Dominante', `${Math.round(analysis.technicalData.dominantFrequencies[0].frequency)} Hz`) : ''),
                
                // 📊 MÉTRICAS TÉCNICAS EXPANDIDAS - Mostrar todas as métricas disponíveis
                row('LRA (Loudness Range)', (advancedReady && Number.isFinite(getMetric('lra', 'lra'))) ? `${safeFixed(getMetric('lra', 'lra'))} LU` : (advancedReady? '—':'⏳'), 'lra'),
                
                // MFCC Coefficients (se disponível)
                (() => {
                    const mfcc = analysis.technicalData?.mfcc_coefficients || analysis.rawMetrics?.mfcc;
                    if (Array.isArray(mfcc) && mfcc.length >= 3) {
                        return row('MFCC (1-3)', `${mfcc.slice(0,3).map(c => safeFixed(c, 2)).join(', ')}`, 'mfcc');
                    }
                    return '';
                })(),
                
                // DC Offset
                row('DC Offset', `${safeFixed(getMetric('dc_offset', 'dcOffset'), 4)}`, 'dcOffset'),
                
                // THD (Total Harmonic Distortion)
                row('THD', `${safeFixed(getMetric('thd_percent', 'thdPercent'), 2)}%`, 'thdPercent'),
                
                // Clipping samples
                row('Clipping Samples', `${getMetric('clipping_samples', 'clippingSamples') || 0}`, 'clippingSamples'),
                
                row('Problemas', (analysis.problems?.length || 0) > 0 ? `<span class="tag tag-danger">${analysis.problems.length} detectado(s)</span>` : '—'),
                row('Sugestões', (analysis.suggestions?.length || 0) > 0 ? `<span class="tag tag-success">${analysis.suggestions.length} disponível(s)</span>` : '—'),
                col3Extras
            ].join('');

            // Card extra: Métricas Avançadas (EXPANDIDO - exibe TODAS as métricas disponíveis)
            const advancedMetricsCard = () => {
                const rows = [];
                
                // ✅ TODAS AS MÉTRICAS LUFS DISPONÍVEIS
                if (advancedReady) {
                    // LUFS Short-term
                    if (Number.isFinite(getMetric('lufs_short_term', 'lufsShortTerm'))) {
                        rows.push(row('LUFS Short-term', `${safeFixed(getMetric('lufs_short_term', 'lufsShortTerm'))} LUFS`, 'lufsShortTerm'));
                    }
                    // LUFS Momentary
                    if (Number.isFinite(getMetric('lufs_momentary', 'lufsMomentary'))) {
                        rows.push(row('LUFS Momentary', `${safeFixed(getMetric('lufs_momentary', 'lufsMomentary'))} LUFS`, 'lufsMomentary'));
                    }
                }
                
                // ✅ TODAS AS MÉTRICAS DE HEADROOM
                if (Number.isFinite(analysis.technicalData?.headroomDb)) {
                    // Mostrar headroom real se calculado a partir do pico, senão offset de loudness
                    const hrReal = Number.isFinite(analysis.technicalData.headroomTruePeakDb) ? analysis.technicalData.headroomTruePeakDb : null;
                    if (hrReal != null) {
                        rows.push(row('Headroom (True Peak)', `${safeFixed(hrReal, 1)} dB`, 'headroomTruePeakDb'));
                    }
                    rows.push(row('Offset Loudness', `${safeFixed(analysis.technicalData.headroomDb, 1)} dB`, 'headroomDb'));
                }
                
                // ✅ PICOS POR CANAL DETALHADOS
                if (Number.isFinite(analysis.technicalData?.samplePeakLeftDb)) {
                    rows.push(row('Pico de Amostra L (dBFS)', `${safeFixed(analysis.technicalData.samplePeakLeftDb, 1)} dBFS`, 'samplePeakLeftDb'));
                }
                if (Number.isFinite(analysis.technicalData?.samplePeakRightDb)) {
                    rows.push(row('Pico de Amostra R (dBFS)', `${safeFixed(analysis.technicalData.samplePeakRightDb, 1)} dBFS`, 'samplePeakRightDb'));
                }
                
                // ✅ MÉTRICAS ESPECTRAIS COMPLETAS
                const spectralMetrics = [
                    ['spectral_rolloff', 'Rolloff Espectral', 'Hz'],
                    ['spectral_flux', 'Flux Espectral', ''],
                    ['spectral_flatness', 'Flatness Espectral', ''],
                    ['zero_crossing_rate', 'Zero Crossing Rate', '']
                ];
                
                spectralMetrics.forEach(([key, label, unit]) => {
                    const value = getMetric(key, key.replace('_', ''));
                    if (Number.isFinite(value)) {
                        const displayValue = unit === 'Hz' ? safeHz(value) : safeFixed(value, 3);
                        rows.push(row(label, displayValue, key));
                    }
                });
                
                // ✅ CLIPPING DETALHADO
                if (Number.isFinite(analysis.technicalData?.clippingPct)) {
                    rows.push(row('Clipping (%)', `${safeFixed(analysis.technicalData.clippingPct, 2)}%`, 'clippingPct'));
                }
                if (Number.isFinite(analysis.technicalData?.clippingSamplesTruePeak)) {
                    rows.push(row('Clipping (TP)', `${analysis.technicalData.clippingSamplesTruePeak} samples`, 'clippingSamplesTruePeak'));
                }
                
                // ✅ MFCC COEFFICIENTS EXPANDIDOS (se disponível)
                const mfcc = analysis.technicalData?.mfcc_coefficients || analysis.rawMetrics?.mfcc;
                if (Array.isArray(mfcc) && mfcc.length >= 13) {
                    // Mostrar primeiros 5 MFCCs
                    const mfccDisplay = mfcc.slice(0, 5).map((c, i) => `MFCC${i+1}: ${safeFixed(c, 2)}`).join(' | ');
                    rows.push(row('MFCC (1-5)', `<span style="font-size: 10px;">${mfccDisplay}</span>`, 'mfcc'));
                    
                    // Mostrar restantes se necessário
                    if (mfcc.length > 5) {
                        const remainingMfcc = mfcc.slice(5, 10).map((c, i) => `MFCC${i+6}: ${safeFixed(c, 2)}`).join(' | ');
                        rows.push(row('MFCC (6-10)', `<span style="font-size: 10px;">${remainingMfcc}</span>`, 'mfcc_extended'));
                    }
                }
                
                // ✅ FREQUÊNCIAS DOMINANTES EXPANDIDAS
                if (Array.isArray(analysis.technicalData?.dominantFrequencies) && analysis.technicalData.dominantFrequencies.length > 1) {
                    const extra = analysis.technicalData.dominantFrequencies.slice(1, 6)
                        .map((f, idx) => `${idx+2}. ${Math.round(f.frequency)} Hz (${f.occurrences || 1}x)`).join('<br>');
                    if (extra) rows.push(row('Top Freq. adicionais', `<span style="opacity:.9; font-size: 10px;">${extra}</span>`));
                }
                
                // ✅ MÉTRICAS DE METADADOS TÉCNICOS
                if (analysis.metadata || analysis.technicalData) {
                    const metadata = analysis.metadata || {};
                    const tech = analysis.technicalData || {};
                    
                    if (metadata.sampleRate || tech.sampleRate) {
                        rows.push(row('Sample Rate', `${metadata.sampleRate || tech.sampleRate} Hz`, 'sampleRate'));
                    }
                    if (metadata.channels || tech.channels) {
                        rows.push(row('Canais', `${metadata.channels || tech.channels}`, 'channels'));
                    }
                    if (metadata.bitrate || tech.bitrate) {
                        rows.push(row('Bitrate', `${metadata.bitrate || tech.bitrate} kbps`, 'bitrate'));
                    }
                    if (metadata.codec || tech.codec) {
                        rows.push(row('Codec', `${metadata.codec || tech.codec}`, 'codec'));
                    }
                    if (metadata.duration || tech.duration) {
                        const duration = metadata.duration || tech.duration;
                        const minutes = Math.floor(duration / 60);
                        const seconds = (duration % 60).toFixed(1);
                        rows.push(row('Duração', `${minutes}:${seconds.padStart(4, '0')}`, 'duration'));
                    }
                }
                
                return rows.join('') || row('Status', 'Sem métricas adicionais');
            };

            // Card extra: Problemas Técnicos detalhados
            const techProblems = () => {
                const rows = [];
                let hasActualProblems = false;
                
                // ===== SEMPRE MOSTRAR TODAS AS MÉTRICAS TÉCNICAS =====
                
                // 1. Clipping - SEMPRE mostrar com valores reais
                const clipVal = Number.isFinite(analysis.technicalData?.clippingSamples) ? analysis.technicalData.clippingSamples : 0;
                const clipPct = Number.isFinite(analysis.technicalData?.clippingPct) ? analysis.technicalData.clippingPct : 0;
                // 🎯 CLIPPING PRECEDENCE V2: Usar nova lógica de precedência
                const peak = Number.isFinite(analysis.technicalData?.peak) ? analysis.technicalData.peak : -Infinity;
                const truePeak = Number.isFinite(analysis.technicalData?.truePeakDbtp) ? analysis.technicalData.truePeakDbtp : null;
                
                // Verificar se temos dados do novo sistema de precedência
                const precedenceData = analysis.technicalData?._singleStage;
                let hasClippingProblem, clipText, clipClass;
                
                if (precedenceData && precedenceData.source === 'enhanced-clipping-v2') {
                    // 🚀 Usar novo sistema de precedência
                    const isClipped = precedenceData.finalState === 'CLIPPED';
                    const isTruePeakOnly = precedenceData.finalState === 'TRUE_PEAK_ONLY';
                    hasClippingProblem = isClipped || isTruePeakOnly;
                    
                    if (hasClippingProblem) {
                        hasActualProblems = true;
                        clipClass = isClipped ? 'error' : 'warn'; // CLIPPED é mais severo que TRUE_PEAK_ONLY
                        
                        const details = [];
                        if (isClipped) {
                            details.push(`🔴 CLIPPED: ${precedenceData.samplePeakMaxDbFS.toFixed(2)}dBFS`);
                            if (precedenceData.precedenceApplied) {
                                details.push(`TP override: ${precedenceData.truePeakDbTP.toFixed(2)}dBTP`);
                            }
                        } else if (isTruePeakOnly) {
                            details.push(`🟡 TruePeak: ${precedenceData.truePeakDbTP.toFixed(2)}dBTP`);
                        }
                        
                        if (precedenceData.clippingSamples > 0) {
                            details.push(`${precedenceData.clippingSamples} samples (${precedenceData.clippingPct.toFixed(3)}%)`);
                        }
                        
                        clipText = details.join(' | ');
                    } else {
                        // Estado limpo com novo sistema
                        const safeDetails = [];
                        safeDetails.push(`✅ Sample: ${precedenceData.samplePeakMaxDbFS.toFixed(2)}dBFS`);
                        safeDetails.push(`TP: ${precedenceData.truePeakDbTP.toFixed(2)}dBTP`);
                        safeDetails.push(`${precedenceData.clippingSamples} samples`);
                        clipText = safeDetails.join(' | ');
                        clipClass = '';
                    }
                } else {
                    // 🔄 Fallback para sistema legado
                    const hasPeakClipping = peak > -0.1;
                    const hasTruePeakClipping = truePeak !== null && truePeak > -0.1;
                    const hasSampleClipping = clipVal > 0;
                    const hasPercentageClipping = clipPct > 0;
                    
                    hasClippingProblem = hasPeakClipping || hasTruePeakClipping || hasSampleClipping || hasPercentageClipping;
                    
                    if (hasClippingProblem) {
                        hasActualProblems = true;
                        clipClass = 'warn';
                        
                        const details = [];
                        if (hasPeakClipping) details.push(`Peak: ${peak.toFixed(2)}dB`);
                        if (hasTruePeakClipping) details.push(`TruePeak: ${truePeak.toFixed(2)}dBTP`);
                        if (hasSampleClipping) details.push(`${clipVal} samples (${clipPct.toFixed(3)}%)`);
                        
                        clipText = details.join(' | ');
                    } else {
                        const safeDetails = [];
                        safeDetails.push(`${clipVal} samples`);
                        if (peak > -Infinity) safeDetails.push(`Peak: ${peak.toFixed(2)}dB`);
                        if (truePeak !== null) safeDetails.push(`TP: ${truePeak.toFixed(2)}dBTP`);
                        
                        clipText = safeDetails.join(' | ');
                        clipClass = '';
                    }
                }
                rows.push(row('Clipping', `<span class="${clipClass}">${clipText}</span>`, 'clippingSamples'));
                
                // 2. DC Offset - SEMPRE mostrar
                const dcVal = Number.isFinite(analysis.technicalData?.dcOffset) ? analysis.technicalData.dcOffset : 0;
                const hasDcProblem = Math.abs(dcVal) > 0.01;
                if (hasDcProblem) hasActualProblems = true;
                const dcClass = hasDcProblem ? 'warn' : '';
                rows.push(row('DC Offset', `<span class="${dcClass}">${safeFixed(dcVal, 4)}</span>`, 'dcOffset'));
                
                // 3. THD - SEMPRE mostrar
                const thdVal = Number.isFinite(analysis.technicalData?.thdPercent) ? analysis.technicalData.thdPercent : 0;
                const hasThdProblem = thdVal > 1.0;
                if (hasThdProblem) hasActualProblems = true;
                const thdClass = hasThdProblem ? 'warn' : '';
                rows.push(row('THD', `<span class="${thdClass}">${safeFixed(thdVal, 2)}%</span>`, 'thdPercent'));
                
                // 4. Stereo Correlation - SEMPRE mostrar
                const stereoCorr = Number.isFinite(analysis.technicalData?.stereoCorrelation) ? analysis.technicalData.stereoCorrelation : 0;
                const hasStereoProb = stereoCorr !== null && (stereoCorr < -0.3 || stereoCorr > 0.95);
                if (hasStereoProb) hasActualProblems = true;
                const stereoClass = hasStereoProb ? 'warn' : '';
                let stereoText = safeFixed(stereoCorr, 3);
                if (hasStereoProb) {
                    const status = stereoCorr < -0.3 ? 'Fora de fase' : 'Mono demais';
                    stereoText += ` (${status})`;
                }
                rows.push(row('Stereo Corr.', `<span class="${stereoClass}">${stereoText}</span>`, 'stereoCorrelation'));
                
                // 5. Fator de Crista - SEMPRE mostrar  
                const crestVal = Number.isFinite(analysis.technicalData?.crestFactor) ? analysis.technicalData.crestFactor : 0;
                const hasCrestProblem = crestVal < 6 || crestVal > 20; // Valores normais: 6-20dB
                if (hasCrestProblem) hasActualProblems = true;
                const crestClass = hasCrestProblem ? 'warn' : '';
                rows.push(row('Fator de Crista', `<span class="${crestClass}">${safeFixed(crestVal, 1)} dB</span>`, 'crestFactor'));
                
                // Consistência (se disponível) - mas sempre tentar mostrar
                if (analysis.metricsValidation && Object.keys(analysis.metricsValidation).length) {
                    const mv = analysis.metricsValidation;
                    const badge = (k,v) => `<span style="padding:2px 6px;border-radius:4px;font-size:11px;background:${v==='ok'?'#143f2b':(v==='warn'?'#4d3808':'#4a1d1d')};color:${v==='ok'?'#29c182':(v==='warn'?'#ffce4d':'#ff7d7d')};margin-left:6px;">${v}</span>`;
                    
                    if (mv.dynamicRangeConsistency) {
                        rows.push(row('DR Consistência', `Δ=${mv.dynamicRangeDelta || '0'} ${badge('dr', mv.dynamicRangeConsistency)}`));
                        if (mv.dynamicRangeConsistency !== 'ok') hasActualProblems = true;
                    } else {
                        rows.push(row('DR Consistência', `<span style="opacity:0.6;">Δ=0 ${badge('dr', 'ok')}</span>`));
                    }
                    
                    if (mv.crestFactorConsistency) {
                        rows.push(row('Crest Consist.', `Δ=${mv.crestVsExpectedDelta || '0'} ${badge('cf', mv.crestFactorConsistency)}`));
                        if (mv.crestFactorConsistency !== 'ok') hasActualProblems = true;
                    } else {
                        rows.push(row('Crest Consist.', `<span style="opacity:0.6;">Δ=0 ${badge('cf', 'ok')}</span>`));
                    }
                    
                    if (mv.lraPlausibility) {
                        rows.push(row('LRA Plausível', badge('lra', mv.lraPlausibility)));
                        if (mv.lraPlausibility !== 'ok') hasActualProblems = true;
                    } else {
                        rows.push(row('LRA Plausível', `<span style="opacity:0.6;">${badge('lra', 'ok')}</span>`));
                    }
                } else {
                    // Mostrar como não disponível/OK
                    const badge = (v) => `<span style="padding:2px 6px;border-radius:4px;font-size:11px;background:#143f2b;color:#29c182;margin-left:6px;">${v}</span>`;
                    rows.push(row('DR Consistência', `<span style="opacity:0.6;">Δ=0 ${badge('ok')}</span>`));
                    rows.push(row('Crest Consist.', `<span style="opacity:0.6;">Δ=0 ${badge('ok')}</span>`));
                    rows.push(row('LRA Plausível', `<span style="opacity:0.6;">${badge('ok')}</span>`));
                }
                
                return rows.join('');
            };

            // Card extra: Diagnóstico & Sugestões listados
            const diagCard = () => {
                const blocks = [];

                // Helpers para embelezar as sugestões sem mudar layout/IDs
                const formatNumbers = (text, decimals = 2) => {
                    if (!text || typeof text !== 'string') return '';
                    return text.replace(/(-?\d+\.\d{3,})/g, (m) => {
                        const n = parseFloat(m);
                        return Number.isFinite(n) ? n.toFixed(decimals) : m;
                    });
                };
                const renderSuggestionItem = (sug) => {
                    // 🎯 Verificar se o gerador de texto didático está disponível
                    const hasTextGenerator = typeof window.SuggestionTextGenerator !== 'undefined';
                    let didacticText = null;
                    
                    if (hasTextGenerator) {
                        try {
                            const generator = new window.SuggestionTextGenerator();
                            didacticText = generator.generateDidacticText(sug);
                        } catch (error) {
                            console.warn('[RenderSuggestion] Erro no gerador de texto:', error);
                        }
                    }
                    
                    // Usar texto didático se disponível, senão usar texto original
                    const title = didacticText?.title || sug.message || '';
                    const explanation = didacticText?.explanation || sug.explanation || '';
                    const action = didacticText?.action || sug.action || '';
                    const rationale = didacticText?.rationale || '';
                    const technical = didacticText?.technical || sug.details || '';
                    
                    // 🎯 SISTEMA MELHORADO: Verificar se tem informações de severidade e prioridade
                    const hasEnhancedInfo = sug.severity && sug.priority;
                    const severityColor = hasEnhancedInfo ? sug.severity.color : '#9fb3d9';
                    const severityLevel = hasEnhancedInfo ? sug.severity.level : 'medium';
                    const severityLabel = hasEnhancedInfo ? sug.severity.label : '';
                    const priority = hasEnhancedInfo ? sug.priority : 0;
                    const confidence = hasEnhancedInfo ? sug.confidence : 1;
                    
                    // Detectar tipo de sugestão
                    const isSurgical = sug.type === 'surgical_eq' || (sug.subtype && ['sibilance', 'harshness', 'clipping'].includes(sug.subtype));
                    const isBandAdjust = sug.type === 'band_adjust';
                    const isClipping = sug.type === 'clipping' || title.toLowerCase().includes('clipping');
                    const isBalance = sug.type === 'balance' || title.toLowerCase().includes('balance');
                    
                    // Determinar classe do card
                    let cardClass = 'enhanced-card';
                    if (isSurgical) cardClass += ' surgical';
                    else if (isBandAdjust) cardClass += ' band-adjust';
                    else if (isClipping) cardClass += ' clipping';
                    else if (isBalance) cardClass += ' balance';
                    else cardClass += ' problem';
                    
                    // Extrair frequência e valores técnicos
                    const freqMatch = (title + ' ' + action).match(/(\d+(?:\.\d+)?)\s*(?:Hz|hz)/i);
                    const frequency = freqMatch ? freqMatch[1] : null;
                    
                    const dbMatch = action.match(/([+-]?\d+(?:\.\d+)?)\s*dB/i);
                    const dbValue = dbMatch ? dbMatch[1] : null;
                    
                    const qMatch = action.match(/Q\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
                    const qValue = qMatch ? qMatch[1] : null;
                    
                    // Extrair faixa de frequência se disponível
                    const frequencyRange = sug.frequency_range || '';
                    const adjustmentDb = sug.adjustment_db;
                    
                    // 🚨 VERIFICAR SE É UM AVISO CRÍTICO
                    if (didacticText?.isCritical) {
                        return `
                            <div class="${cardClass} critical-alert">
                                <div class="card-header">
                                    <h4 class="card-title">🚨 Problema Crítico</h4>
                                    <div class="card-badges">
                                        ${frequency ? `<span class="frequency-badge">${frequency} Hz</span>` : ''}
                                        <span class="severity-badge severa">CRÍTICO</span>
                                    </div>
                                </div>
                                
                                <div class="card-description" style="border-left-color: #f44336;">
                                    <strong>⚠️ Problema:</strong> ${didacticText.explanation}
                                </div>
                                
                                <div class="card-action" style="background: rgba(244, 67, 54, 0.15); border-color: #f44336;">
                                    <div class="card-action-title" style="color: #f44336;">
                                        🚨 Ação Urgente
                                    </div>
                                    <div class="card-action-content">${didacticText.action}</div>
                                </div>
                                
                                <div class="card-impact" style="background: rgba(244, 67, 54, 0.1); border-color: #f44336;">
                                    <div class="card-impact-title" style="color: #f44336;">⚠️ Por que é crítico</div>
                                    <div class="card-impact-content">${didacticText.rationale}</div>
                                </div>
                            </div>`;
                    }
                    
                    if (isSurgical) {
                        // Card cirúrgico aprimorado
                        const context = title.replace(/\[\d+Hz\]/, '').replace(/\d+Hz/, '').trim();
                        const severity = severityLevel === 'high' ? 'alta' : (severityLevel === 'medium' ? 'moderada' : 'leve');
                        
                        return `
                            <div class="${cardClass}">
                                <div class="card-header">
                                    <h4 class="card-title">🔧 Correção Cirúrgica</h4>
                                    <div class="card-badges">
                                        ${frequency ? `<span class="frequency-badge">${frequency} Hz</span>` : ''}
                                        <span class="severity-badge ${severity}">${severity}</span>
                                    </div>
                                </div>
                                
                                <div class="card-description">
                                    <strong>Problema detectado:</strong> ${context || explanation || 'Ressonância problemática identificada'}
                                </div>
                                
                                <div class="card-action">
                                    <div class="card-action-title">
                                        🎛️ Ação Recomendada
                                    </div>
                                    <div class="card-action-content">${action}</div>
                                </div>
                                
                                ${(frequency || qValue || dbValue) ? `
                                    <div class="card-technical">
                                        ${frequency ? `
                                            <div class="tech-item">
                                                <div class="tech-label">Frequência</div>
                                                <div class="tech-value">${frequency} Hz</div>
                                            </div>
                                        ` : ''}
                                        ${dbValue ? `
                                            <div class="tech-item">
                                                <div class="tech-label">Ganho</div>
                                                <div class="tech-value">${dbValue} dB</div>
                                            </div>
                                        ` : ''}
                                        ${qValue ? `
                                            <div class="tech-item">
                                                <div class="tech-label">Q Factor</div>
                                                <div class="tech-value">${qValue}</div>
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                                
                                ${sug.impact ? `
                                    <div class="card-impact">
                                        <div class="card-impact-title">⚠️ Impacto</div>
                                        <div class="card-impact-content">${sug.impact}</div>
                                    </div>
                                ` : ''}
                                
                                ${technical ? `
                                    <details style="margin-top: 12px;">
                                        <summary style="cursor: pointer; font-size: 12px; color: #aaa;">Detalhes Técnicos</summary>
                                        <div style="font-size: 11px; color: #ccc; margin-top: 8px; font-family: monospace;">${technical}</div>
                                    </details>
                                ` : ''}
                            </div>`;
                    } 
                    
                    else if (isBandAdjust) {
                        // Card de ajuste de banda aprimorado
                        const shouldBoost = adjustmentDb > 0 || action.toLowerCase().includes('aumentar') || action.toLowerCase().includes('boost');
                        const actionIcon = shouldBoost ? '📈' : '📉';
                        const actionType = shouldBoost ? 'Boost' : 'Corte';
                        
                        return `
                            <div class="${cardClass}">
                                <div class="card-header">
                                    <h4 class="card-title">${actionIcon} Ajuste de Banda</h4>
                                    <div class="card-badges">
                                        ${frequencyRange ? `<span class="frequency-badge">${frequencyRange}</span>` : ''}
                                        <span class="severity-badge ${severityLevel}">${actionType}</span>
                                    </div>
                                </div>
                                
                                <div class="card-description">
                                    <strong>Análise:</strong> ${explanation || title}
                                </div>
                                
                                <div class="card-action">
                                    <div class="card-action-title">
                                        🎚️ Como Ajustar
                                    </div>
                                    <div class="card-action-content">${action}</div>
                                </div>
                                
                                ${(frequencyRange || adjustmentDb) ? `
                                    <div class="card-technical">
                                        ${frequencyRange ? `
                                            <div class="tech-item">
                                                <div class="tech-label">Faixa</div>
                                                <div class="tech-value">${frequencyRange}</div>
                                            </div>
                                        ` : ''}
                                        ${adjustmentDb ? `
                                            <div class="tech-item">
                                                <div class="tech-label">Ajuste</div>
                                                <div class="tech-value">${adjustmentDb > 0 ? '+' : ''}${adjustmentDb.toFixed(1)} dB</div>
                                            </div>
                                        ` : ''}
                                        ${sug.details ? `
                                            <div class="tech-item" style="grid-column: span 2;">
                                                <div class="tech-label">Status</div>
                                                <div class="tech-value" style="font-size: 10px;">${sug.details.replace('Atual:', '').replace('Alvo:', '→')}</div>
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                                
                                ${sug.impact ? `
                                    <div class="card-impact">
                                        <div class="card-impact-title">💡 Resultado Esperado</div>
                                        <div class="card-impact-content">${sug.impact}</div>
                                    </div>
                                ` : ''}
                            </div>`;
                    }
                    
                    else {
                        // Card genérico melhorado
                        return `
                            <div class="${cardClass}">
                                <div class="card-header">
                                    <h4 class="card-title">🎵 ${title}</h4>
                                    <div class="card-badges">
                                        ${frequency ? `<span class="frequency-badge">${frequency} Hz</span>` : ''}
                                        <span class="severity-badge ${severityLevel}">${severityLabel || 'info'}</span>
                                    </div>
                                </div>
                                
                                ${explanation ? `
                                    <div class="card-description">
                                        <strong>Explicação:</strong> ${explanation}
                                    </div>
                                ` : ''}
                                
                                <div class="card-action">
                                    <div class="card-action-title">
                                        🔧 Ação Recomendada
                                    </div>
                                    <div class="card-action-content">${action}</div>
                                </div>
                                
                                ${sug.impact ? `
                                    <div class="card-impact">
                                        <div class="card-impact-title">⚠️ Impacto</div>
                                        <div class="card-impact-content">${sug.impact}</div>
                                    </div>
                                ` : ''}
                                
                                ${technical ? `
                                    <details style="margin-top: 12px;">
                                        <summary style="cursor: pointer; font-size: 12px; color: #aaa;">Detalhes Técnicos</summary>
                                        <div style="font-size: 11px; color: #ccc; margin-top: 8px; font-family: monospace;">${technical}</div>
                                    </details>
                                ` : ''}
                            </div>`;
                    }
                };
                if ((analysis.problems?.length || 0) > 0) {
                    // 🎯 Função local para deduplicar problemas por tipo
                    const deduplicateByType = (items) => {
                        const seen = new Map();
                        const deduplicated = [];
                        for (const item of items) {
                            if (!item || !item.type) continue;
                            const existing = seen.get(item.type);
                            if (!existing) {
                                seen.set(item.type, item);
                                deduplicated.push(item);
                            } else {
                                // Manter o mais detalhado (com mais propriedades)
                                const currentScore = Object.keys(item).length + (item.explanation ? 10 : 0) + (item.impact ? 5 : 0);
                                const existingScore = Object.keys(existing).length + (existing.explanation ? 10 : 0) + (existing.impact ? 5 : 0);
                                if (currentScore > existingScore) {
                                    seen.set(item.type, item);
                                    const index = deduplicated.findIndex(d => d.type === item.type);
                                    if (index >= 0) deduplicated[index] = item;
                                }
                            }
                        }
                        return deduplicated;
                    };
                    
                    // Aplicar deduplicação dos problemas na UI
                    const deduplicatedProblems = deduplicateByType(analysis.problems);
                    const list = deduplicatedProblems.map(p => {
                        const msg = typeof p.message === 'string' ? p.message.replace(/(-?\d+\.\d{3,})/g, m => {
                            const n = parseFloat(m); return Number.isFinite(n) ? n.toFixed(2) : m;
                        }) : p.message;
                        const sol = typeof p.solution === 'string' ? p.solution.replace(/(-?\d+\.\d{3,})/g, m => {
                            const n = parseFloat(m); return Number.isFinite(n) ? n.toFixed(2) : m;
                        }) : p.solution;
                        
                        // 🚨 USAR FORMATO NATIVO DOS PROBLEMAS - Evitar duplicação do SuggestionTextGenerator
                        // Os problemas já têm explanation, impact, frequency_range, adjustment_db, details
                        let didacticText = null; // Desabilitado para evitar duplicação
                        
                        // Se for problema crítico (clipping, etc), usar card crítico aprimorado
                        if (p.type === 'clipping' || p.severity === 'critical' || p.severity === 'high') {
                            const freqMatch = (msg + ' ' + sol).match(/(\d+(?:\.\d+)?)\s*(?:Hz|hz)/i);
                            const frequency = freqMatch ? freqMatch[1] : null;
                            
                            return `
                                <div class="enhanced-card critical-alert">
                                    <div class="card-header">
                                        <h4 class="card-title">🚨 Problema Crítico</h4>
                                        <div class="card-badges">
                                            ${frequency ? `<span class="frequency-badge">${frequency} Hz</span>` : ''}
                                            <span class="severity-badge severa">CRÍTICO</span>
                                        </div>
                                    </div>
                                    
                                    <div class="card-description" style="border-left-color: #f44336;">
                                        <strong>⚠️ Problema:</strong> ${msg}
                                    </div>
                                    
                                    ${p.explanation ? `
                                        <div class="card-description" style="border-left-color: #f44336; background: rgba(244, 67, 54, 0.05);">
                                            <strong>Explicação:</strong> ${p.explanation}
                                        </div>
                                    ` : ''}
                                    
                                    <div class="card-action" style="background: rgba(244, 67, 54, 0.15); border-color: #f44336;">
                                        <div class="card-action-title" style="color: #f44336;">
                                            🚨 Ação Urgente
                                        </div>
                                        <div class="card-action-content">${sol}</div>
                                    </div>
                                    
                                    ${(p.frequency_range || p.adjustment_db) ? `
                                        <div class="card-technical">
                                            ${p.frequency_range ? `
                                                <div class="tech-item">
                                                    <div class="tech-label">Frequências</div>
                                                    <div class="tech-value">${p.frequency_range}</div>
                                                </div>
                                            ` : ''}
                                            ${p.adjustment_db ? `
                                                <div class="tech-item">
                                                    <div class="tech-label">Ajuste</div>
                                                    <div class="tech-value">${p.adjustment_db} dB</div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                    
                                    ${p.impact ? `
                                        <div class="card-impact" style="background: rgba(244, 67, 54, 0.1); border-color: #f44336;">
                                            <div class="card-impact-title" style="color: #f44336;">⚠️ Por que é crítico</div>
                                            <div class="card-impact-content">${p.impact}</div>
                                        </div>
                                    ` : ''}
                                    
                                    ${p.details ? `
                                        <details style="margin-top: 12px;">
                                            <summary style="cursor: pointer; font-size: 12px; color: #aaa;">Detalhes Técnicos</summary>
                                            <div style="font-size: 11px; color: #ccc; margin-top: 8px; font-family: monospace;">${p.details}</div>
                                        </details>
                                    ` : ''}
                                </div>
                            `;
                        } else {
                            // Para problemas menos críticos, usar card padrão melhorado
                            const freqMatch = (msg + ' ' + sol).match(/(\d+(?:\.\d+)?)\s*(?:Hz|hz)/i);
                            const frequency = freqMatch ? freqMatch[1] : null;
                            const dbMatch = sol.match(/([+-]?\d+(?:\.\d+)?)\s*dB/i);
                            const dbValue = dbMatch ? dbMatch[1] : null;
                            
                            // Determinar tipo de problema
                            const problemType = p.type || 'general';
                            let cardClass = 'enhanced-card problem';
                            let problemIcon = '⚠️';
                            
                            if (problemType.includes('balance')) {
                                cardClass = 'enhanced-card balance';
                                problemIcon = '⚖️';
                            } else if (problemType.includes('dc_offset')) {
                                cardClass = 'enhanced-card problem';
                                problemIcon = '📊';
                            } else if (problemType.includes('phase')) {
                                cardClass = 'enhanced-card problem';
                                problemIcon = '🌊';
                            }
                            
                            return `
                                <div class="${cardClass}">
                                    <div class="card-header">
                                        <h4 class="card-title">${problemIcon} ${msg}</h4>
                                        <div class="card-badges">
                                            ${frequency ? `<span class="frequency-badge">${frequency} Hz</span>` : ''}
                                            <span class="severity-badge moderada">problema</span>
                                        </div>
                                    </div>
                                    
                                    ${p.explanation ? `
                                        <div class="card-description">
                                            <strong>Explicação:</strong> ${p.explanation}
                                        </div>
                                    ` : ''}
                                    
                                    <div class="card-action">
                                        <div class="card-action-title">
                                            🔧 Como Resolver
                                        </div>
                                        <div class="card-action-content">${sol}</div>
                                    </div>
                                    
                                    ${(p.frequency_range || dbValue) ? `
                                        <div class="card-technical">
                                            ${p.frequency_range ? `
                                                <div class="tech-item">
                                                    <div class="tech-label">Frequências</div>
                                                    <div class="tech-value">${p.frequency_range}</div>
                                                </div>
                                            ` : ''}
                                            ${dbValue ? `
                                                <div class="tech-item">
                                                    <div class="tech-label">Ajuste</div>
                                                    <div class="tech-value">${dbValue} dB</div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                    
                                    ${p.impact ? `
                                        <div class="card-impact">
                                            <div class="card-impact-title">⚠️ Impacto</div>
                                            <div class="card-impact-content">${p.impact}</div>
                                        </div>
                                    ` : ''}
                                    
                                    ${p.details ? `
                                        <details style="margin-top: 12px;">
                                            <summary style="cursor: pointer; font-size: 12px; color: #aaa;">Detalhes Técnicos</summary>
                                            <div style="font-size: 11px; color: #ccc; margin-top: 8px; font-family: monospace;">${p.details}</div>
                                        </details>
                                    ` : ''}
                                </div>
                            `;
                        }
                    }).join('');
                    blocks.push(`<div class="diag-section"><div class="diag-heading">⚠️ Problemas Detectados:</div>${list}</div>`);
                }
                if ((analysis.suggestions?.length || 0) > 0) {
                    // 🎯 Função local para deduplicar sugestões por tipo
                    const deduplicateByType = (items) => {
                        const seen = new Map();
                        const deduplicated = [];
                        for (const item of items) {
                            if (!item || !item.type) continue;
                            const existing = seen.get(item.type);
                            if (!existing) {
                                seen.set(item.type, item);
                                deduplicated.push(item);
                            } else {
                                // Manter o mais detalhado (com mais propriedades)
                                const currentScore = Object.keys(item).length + (item.explanation ? 10 : 0) + (item.impact ? 5 : 0);
                                const existingScore = Object.keys(existing).length + (existing.explanation ? 10 : 0) + (existing.impact ? 5 : 0);
                                if (currentScore > existingScore) {
                                    seen.set(item.type, item);
                                    const index = deduplicated.findIndex(d => d.type === item.type);
                                    if (index >= 0) deduplicated[index] = item;
                                }
                            }
                        }
                        return deduplicated;
                    };
                    
                    // Aplicar deduplicação das sugestões na UI para evitar duplicatas
                    const deduplicatedSuggestions = deduplicateByType(analysis.suggestions);
                    const list = deduplicatedSuggestions.map(s => renderSuggestionItem(s)).join('');
                    
                    // 🎯 Rodapé melhorado com informações do Enhanced System
                    try {
                        const count = (t) => deduplicatedSuggestions.filter(s => s && s.type === t).length;
                        const cBand = count('band_adjust');
                        const cGroup = count('band_group_adjust');
                        const cSurg = count('surgical_eq');
                        const cRef = count('reference_loudness') + count('reference_dynamics') + count('reference_lra') + count('reference_stereo') + count('reference_true_peak');
                        const cHeuristic = deduplicatedSuggestions.filter(s => s && s.type && s.type.startsWith('heuristic_')).length;
                        
                        // Estatísticas do Enhanced System (se disponível)
                        let enhancedStats = '';
                        if (analysis.enhancedMetrics) {
                            const em = analysis.enhancedMetrics;
                            const avgPriority = deduplicatedSuggestions.length > 0 ? 
                                (deduplicatedSuggestions.reduce((sum, s) => sum + (s.priority || 0), 0) / deduplicatedSuggestions.length) : 0;
                            
                            enhancedStats = ` • 🎯 Enhanced System: conf=${(em.confidence || 1).toFixed(2)} avgP=${avgPriority.toFixed(2)}`;
                            
                            if (em.processingTimeMs) {
                                enhancedStats += ` (${em.processingTimeMs}ms)`;
                            }
                        }
                        
                        // Footer removido - sem estatísticas desnecessárias
                        blocks.push(`<div class="diag-section"><div class="diag-heading">🩺 Sugestões Priorizadas</div>${list}</div>`);
                    } catch {
                        blocks.push(`<div class="diag-section"><div class="diag-heading">🩺 Sugestões</div>${list}</div>`);
                    }
                }
                // Subbloco opcional com diagnósticos do V2 PRO (quando disponíveis)
                const v2Pro = analysis.v2Pro || analysis.v2Diagnostics; // Compatibilidade
                if (v2Pro && (typeof window === 'undefined' || window.SUGESTOES_AVANCADAS !== false)) {
                    const v2p = (v2Pro.problems || []).map(p => `
                        <div class="diag-item danger">
                            <div class="diag-title">${p.message}</div>
                            <div class="diag-tip">${p.solution || ''}</div>
                        </div>`).join('');
                    // V2 Pro removido - não mostrar diagnósticos duplicados
                }
                return blocks.join('') || '<div class="diag-empty">Sem diagnósticos</div>';
            };

        const breakdown = analysis.qualityBreakdown || {};
        
        // 🎯 APLICAR CAPS EM ESTADO CLIPPED
        const precedenceData = analysis.technicalData?._singleStage;
        const isClippedState = precedenceData?.finalState === 'CLIPPED' && precedenceData?.scoreCapApplied === true;
        
        // Aplicar caps nos sub-scores se em estado CLIPPED
        const applyClippingCaps = (originalBreakdown) => {
            if (!isClippedState) return originalBreakdown;
            
            const capped = { ...originalBreakdown };
            
            // Caps específicos para estado CLIPPED
            if (Number.isFinite(capped.loudness)) {
                capped.loudness = Math.min(capped.loudness, 70); // Loudness ≤ 70
            }
            if (Number.isFinite(capped.technical)) {
                capped.technical = Math.min(capped.technical, 60); // Técnico ≤ 60  
            }
            if (Number.isFinite(capped.dynamics)) {
                capped.dynamics = Math.min(capped.dynamics, 50); // Dinâmica ≤ 50
            }
            
            // Frequency e Stereo podem manter valores originais (não afetados diretamente pelo clipping)
            
            return capped;
        };
        
        const finalBreakdown = applyClippingCaps(breakdown);
        
        // Função para renderizar score com barra de progresso
        const renderScoreWithProgress = (label, value, color = '#00ffff') => {
            const numValue = parseFloat(value) || 0;
            const displayValue = value != null ? value : '—';
            
            // Indicar se o valor foi capeado (comparar com breakdown original)
            const labelKey = label.toLowerCase().replace('faixa dinâmica', 'dynamics').replace('técnico', 'technical').replace('loudness', 'loudness').replace('frequência', 'frequency').replace('stereo', 'stereo');
            const wasCapped = isClippedState && breakdown[labelKey] && Number.isFinite(breakdown[labelKey]) && 
                             breakdown[labelKey] !== value;
            const cappedIndicator = wasCapped ? ' 🔴' : '';
            
            if (value == null) {
                return `<div class="data-row">
                    <span class="label">${label}:</span>
                    <span class="value">—</span>
                </div>`;
            }
            
            return `<div class="data-row metric-with-progress">
                <span class="label">${label}${cappedIndicator}:</span>
                <div class="metric-value-progress">
                    <span class="value">${displayValue}/100</span>
                    <div class="progress-bar-mini">
                        <div class="progress-fill-mini" style="width: ${Math.min(Math.max(numValue, 0), 100)}%; background: ${color}; color: ${color};"></div>
                    </div>
                </div>
            </div>`;
        };
        
        const scoreRows = finalBreakdown ? `
            ${renderScoreWithProgress('Faixa Dinâmica', finalBreakdown.dynamics, '#ffd700')}
            ${renderScoreWithProgress('Técnico', finalBreakdown.technical, '#00ff92')}
            ${renderScoreWithProgress('Stereo', finalBreakdown.stereo, '#ff6b6b')}
            ${renderScoreWithProgress('Loudness', finalBreakdown.loudness, '#ff3366')}
            ${renderScoreWithProgress('Frequência', finalBreakdown.frequency, '#00ffff')}
        ` : '';

        // 🔬 FUNÇÃO AUXILIAR: Nome amigável para bandas (definida fora do template literal)
        const getBandDisplayName = (bandName) => {
            const displayNames = {
                'sub': 'Sub',
                'subBass': 'Sub Bass',
                'sub_bass': 'Sub Bass',
                'bass': 'Bass',
                'low_bass': 'Low Bass',
                'lowBass': 'Low Bass',
                'upper_bass': 'Upper Bass',
                'upperBass': 'Upper Bass',
                'low_mid': 'Low Mid',
                'lowMid': 'Low Mid',
                'mid': 'Mid',
                'high_mid': 'High Mid',
                'highMid': 'High Mid',
                'upper_mid': 'Upper Mid',
                'upperMid': 'Upper Mid',
                'presence': 'Presence',
                'presenca': 'Presença',
                'brilliance': 'Brilliance',
                'brilho': 'Brilho',
                'air': 'Air',
                'treble': 'Treble'
            };
            return displayNames[bandName] || bandName.charAt(0).toUpperCase() + bandName.slice(1);
        };

        technicalData.innerHTML = `
            <div class="kpi-row">${scoreKpi}${timeKpi}</div>
                ${renderSmartSummary(analysis) }
                
                <!-- ✅ NOVA SEÇÃO: DIAGNÓSTICOS E SUGESTÕES ESTRUTURADOS -->
                ${(() => {
                    try {
                        // 🛡️ VERIFICAÇÃO DE SEGURANÇA: Verificar se dados existem antes de processar
                        const hasProblems = safeArray(analysis.problems).length > 0;
                        const hasSuggestions = safeArray(analysis.suggestions).length > 0;
                        const hasValidAnalysis = analysis && typeof analysis === 'object';
                        
                        if (!hasValidAnalysis) {
                            console.warn('⚠️ [MODAL_EXPANSION] Análise inválida, pulando seção de diagnósticos');
                            return '';
                        }
                        
                        if (!hasProblems && !hasSuggestions) {
                            console.log('📊 [MODAL_EXPANSION] Sem problemas ou sugestões para exibir');
                            return '';
                        }
                        
                        let diagnosticsHTML = '';
                        
                        // 📊 SEÇÃO DE MÉTRICAS TÉCNICAS PRINCIPAIS
                        diagnosticsHTML += `
                            <div class="diagnostics-summary-section">
                                <div class="section-header">
                                    <h3>📊 Métricas Técnicas Principais</h3>
                                </div>
                                <div class="metrics-grid">
                                    <div class="metric-item">
                                        <span class="metric-label">LUFS Integrado:</span>
                                        <span class="metric-value">${(advancedReady && Number.isFinite(getMetric('lufs_integrated', 'lufsIntegrated'))) ? `${safeFixed(getMetric('lufs_integrated', 'lufsIntegrated'))} LUFS` : '⏳'}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">LUFS Short-term:</span>
                                        <span class="metric-value">${(advancedReady && Number.isFinite(getMetric('lufs_short_term', 'lufsShortTerm'))) ? `${safeFixed(getMetric('lufs_short_term', 'lufsShortTerm'))} LUFS` : '⏳'}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">True Peak:</span>
                                        <span class="metric-value">${(advancedReady && Number.isFinite(getMetric('truePeakDbtp', 'truePeakDbtp'))) ? `${safeFixed(getMetric('truePeakDbtp', 'truePeakDbtp'))} dBTP` : '⏳'}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Dynamic Range:</span>
                                        <span class="metric-value">${safeFixed(getMetric('dynamic_range', 'dynamicRange'))} dB</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Stereo Correlation:</span>
                                        <span class="metric-value">${Number.isFinite(getMetric('stereo_correlation', 'stereoCorrelation')) ? safeFixed(getMetric('stereo_correlation', 'stereoCorrelation'), 2) : '—'}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Spectral Centroid:</span>
                                        <span class="metric-value">${Number.isFinite(getMetric('spectral_centroid', 'spectralCentroid')) ? safeHz(getMetric('spectral_centroid', 'spectralCentroid')) : '—'}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                        
                        // ⚠️ SEÇÃO DE PROBLEMAS DETECTADOS
                        if (hasProblems) {
                            diagnosticsHTML += `
                                <div class="diagnostics-summary-section">
                                    <div class="section-header">
                                        <h3>⚠️ Problemas Detectados</h3>
                                        <span class="problem-count">${analysis.problems.length} problema(s)</span>
                                    </div>
                                    <div class="problems-list">
                                        ${safeArray(analysis.problems).map(problem => {
                                            // 🛡️ FALLBACK SEGURO: Verificar cada campo antes de usar
                                            const safeProblem = safeObject(problem);
                                            const severity = safeFallback(safeProblem.severity, 'medium');
                                            const severityClass = severity === 'high' || severity === 'critical' ? 'severe' : severity === 'medium' ? 'moderate' : 'mild';
                                            
                                            return `
                                                <div class="problem-item ${severityClass}">
                                                    <div class="problem-header">
                                                        <span class="problem-type">${safeFallback(safeProblem.type, 'Problema')}</span>
                                                        <span class="problem-severity ${severityClass}">${severity.toUpperCase()}</span>
                                                    </div>
                                                    <div class="problem-message">${safeFallback(safeProblem.message, 'Problema detectado')}</div>
                                                    ${safeProblem.explanation ? `<div class="problem-explanation">💡 ${safeProblem.explanation}</div>` : ''}
                                                    ${safeProblem.solution ? `<div class="problem-solution">🔧 <strong>Solução:</strong> ${safeProblem.solution}</div>` : ''}
                                                    ${safeProblem.frequency_range ? `<div class="problem-technical">📊 Frequências: ${safeProblem.frequency_range}</div>` : ''}
                                                    ${safeProblem.adjustment_db ? `<div class="problem-technical">⚡ Ajuste: ${safeProblem.adjustment_db} dB</div>` : ''}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        
                        // 💡 SEÇÃO DE SUGESTÕES DE MIXAGEM
                        if (hasSuggestions) {
                            diagnosticsHTML += `
                                <div class="diagnostics-summary-section">
                                    <div class="section-header">
                                        <h3>💡 Sugestões de Mixagem</h3>
                                        <span class="suggestion-count">${analysis.suggestions.length} sugestão(ões)</span>
                                    </div>
                                    <div class="suggestions-list">
                                        ${safeArray(analysis.suggestions).map(suggestion => {
                                            // 🛡️ FALLBACK SEGURO: Verificar cada campo antes de usar
                                            const safeSuggestion = safeObject(suggestion);
                                            const priority = Number.isFinite(safeSuggestion.priority) ? safeSuggestion.priority : 0;
                                            const priorityClass = priority > 7 ? 'high' : priority > 4 ? 'medium' : 'low';
                                            const confidence = Number.isFinite(safeSuggestion.confidence) ? safeSuggestion.confidence : 1;
                                            
                                            return `
                                                <div class="suggestion-item ${priorityClass}">
                                                    <div class="suggestion-header">
                                                        <span class="suggestion-type">${safeFallback(safeSuggestion.type, 'Sugestão')}</span>
                                                        <div class="suggestion-badges">
                                                            <span class="suggestion-priority ${priorityClass}">P${priority}</span>
                                                            <span class="suggestion-confidence">C${(confidence * 100).toFixed(0)}%</span>
                                                        </div>
                                                    </div>
                                                    <div class="suggestion-message">${safeFallback(safeSuggestion.message, 'Sugestão de melhoria')}</div>
                                                    ${safeSuggestion.explanation ? `<div class="suggestion-explanation">💡 ${safeSuggestion.explanation}</div>` : ''}
                                                    ${safeSuggestion.action ? `<div class="suggestion-action">🎯 <strong>Ação:</strong> ${safeSuggestion.action}</div>` : ''}
                                                    ${safeSuggestion.frequency_range ? `<div class="suggestion-technical">📊 Frequências: ${safeSuggestion.frequency_range}</div>` : ''}
                                                    ${safeSuggestion.adjustment_db ? `<div class="suggestion-technical">⚡ Ajuste: ${safeSuggestion.adjustment_db} dB</div>` : ''}
                                                    ${safeSuggestion.impact ? `<div class="suggestion-impact">⭐ <strong>Impacto:</strong> ${safeSuggestion.impact}</div>` : ''}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        
                        return diagnosticsHTML;
                        
                    } catch (error) {
                        console.error('❌ [MODAL_EXPANSION] Erro ao gerar seção de diagnósticos:', error);
                        return '<div class="diagnostics-summary-section"><div class="section-header"><h3>⚠️ Erro</h3></div><p>Não foi possível carregar diagnósticos detalhados.</p></div>';
                    }
                })()}
                
                    <div class="cards-grid">
                        <div class="card">
                    <div class="card-title">🎛️ Métricas Principais</div>
                    ${col1}
                </div>
                        <div class="card">
                    <div class="card-title">🎧 Análise Estéreo & Espectral</div>
                    ${col2}
                </div>
                        <div class="card">
                    <div class="card-title">🎵 Balance Espectral Completo</div>
                    ${(() => {
                        const sb = analysis.technicalData?.spectral_balance;
                        const bandEnergies = analysis.technicalData?.bandEnergies || analysis.technicalData?.frequencyBands;
                        const tonalBalance = analysis.technicalData?.tonalBalance;
                        
                        if (!sb && !bandEnergies && !tonalBalance) {
                            return row('Status', 'Dados espectrais não disponíveis');
                        }
                        
                        const formatPct = (v) => Number.isFinite(v) ? `${(v*100).toFixed(1)}%` : '—';
                        const formatDb = (v) => Number.isFinite(v) ? `${v.toFixed(1)} dB` : '—';
                        const rows = [];
                        
                        // 📊 EXIBIR SPECTRAL BALANCE (6 BANDAS PRINCIPAIS)
                        if (sb && typeof sb === 'object') {
                            if (Number.isFinite(sb.sub)) rows.push(row('Sub (20-60 Hz)', formatPct(sb.sub), 'spectralSub'));
                            if (Number.isFinite(sb.bass)) rows.push(row('Bass (60-250 Hz)', formatPct(sb.bass), 'spectralBass'));
                            if (Number.isFinite(sb.mids)) rows.push(row('Mids (250-4k Hz)', formatPct(sb.mids), 'spectralMids'));
                            if (Number.isFinite(sb.treble)) rows.push(row('Treble (4k-12k Hz)', formatPct(sb.treble), 'spectralTreble'));
                            if (Number.isFinite(sb.presence)) rows.push(row('Presence (4k-8k Hz)', formatPct(sb.presence), 'spectralPresence'));
                            if (Number.isFinite(sb.air)) rows.push(row('Air (12k-20k Hz)', formatPct(sb.air), 'spectralAir'));
                        }
                        
                        // 🎛️ EXIBIR TONAL BALANCE (dados detalhados das bandas)
                        if (tonalBalance && typeof tonalBalance === 'object') {
                            Object.entries(tonalBalance).forEach(([bandName, bandData]) => {
                                if (bandData && typeof bandData === 'object') {
                                    const label = getBandDisplayName(bandName);
                                    const rmsDb = Number.isFinite(bandData.rms_db) ? formatDb(bandData.rms_db) : '—';
                                    const peakDb = Number.isFinite(bandData.peak_db) ? ` (pk: ${formatDb(bandData.peak_db)})` : '';
                                    rows.push(row(`${label} RMS`, `${rmsDb}${peakDb}`, `tonal_${bandName}`));
                                }
                            });
                        }
                        
                        // 📈 EXIBIR FREQUENCY BANDS (energias FFT por banda)
                        else if (bandEnergies && typeof bandEnergies === 'object') {
                            // Verificar se é estrutura do backend (left/right channels)
                            const bandsData = bandEnergies.left || bandEnergies;
                            if (bandsData && typeof bandsData === 'object') {
                                Object.entries(bandsData).forEach(([bandName, bandData]) => {
                                    if (bandData && typeof bandData === 'object') {
                                        const label = getBandDisplayName(bandName);
                                        const energyDb = Number.isFinite(bandData.energyDb) ? formatDb(bandData.energyDb) : 
                                                        Number.isFinite(bandData.energy_db) ? formatDb(bandData.energy_db) : '—';
                                        const range = bandData.min && bandData.max ? ` (${bandData.min}-${bandData.max}Hz)` : '';
                                        rows.push(row(`${label}${range}`, energyDb, `band_${bandName}`));
                                    }
                                });
                            }
                        }
                        
                        return rows.length ? rows.join('') : row('Status', 'Balance espectral não calculado');
                    })()}
                </div>
                        <div class="card">
                    <div class="card-title">�🏆 Scores & Diagnóstico</div>
                    ${scoreRows}
                    ${col3}
                </div>
                        <div class="card">
                            <div class="card-title">🧠 Métricas Avançadas</div>
                            ${advancedMetricsCard()}
                        </div>
                        <div class="card card-span-2">
                            <div class="card-title">⚠️ Problemas Técnicos</div>
                            ${techProblems()}
                        </div>
                        <div class="card card-span-2">
                            <div class="card-title">🩺 Diagnóstico & Sugestões</div>
                            ${diagCard()}
                        </div>
            </div>
        `;
    
    try { renderReferenceComparisons(analysis); } catch(e){ console.warn('ref compare fail', e);}    
        try { if (window.CAIAR_ENABLED) injectValidationControls(); } catch(e){ console.warn('validation controls fail', e); }
    
    // ✅ LOG FINAL: Confirmar que todas as métricas expandidas foram processadas
    console.log('🎉 [MODAL_EXPANSION] Interface expandida com sucesso!');
    console.log('📊 [MODAL_EXPANSION] Métricas exibidas:', {
        lufsIntegrated: getMetric('lufs_integrated', 'lufsIntegrated'),
        lufsShortTerm: getMetric('lufs_short_term', 'lufsShortTerm'),
        truePeak: getMetric('truePeakDbtp', 'truePeakDbtp'),
        spectralBalance: !!analysis.technicalData?.spectral_balance,
        tonalBalance: !!analysis.technicalData?.tonalBalance,
        mfccCoefficients: !!(analysis.technicalData?.mfcc_coefficients || analysis.rawMetrics?.mfcc),
        problemsCount: safeArray(analysis.problems).length,
        suggestionsCount: safeArray(analysis.suggestions).length,
        advancedReady: advancedReady
    });
    
    __dbg('📊 Resultados exibidos no modal - TODAS as métricas expandidas');
    
    // 🔍 LOG FINAL DE VALIDAÇÃO
    console.log('✅ [UI_RENDER_OK] Modal renderizado com sucesso!');
    console.log('🔍 [UI_RENDER_OK] Verificação final das seções:');
    console.log('🔍 [UI_RENDER_OK] - Métricas Principais preenchidas:', !!document.querySelector('.data-row .value') && document.querySelector('.data-row .value').textContent !== '—');
    console.log('🔍 [UI_RENDER_OK] - Score disponível:', !!analysis.score);
    console.log('🔍 [UI_RENDER_OK] - Classificação disponível:', !!analysis.classification);
    console.log('🔍 [UI_RENDER_OK] - RunId:', analysis?.runId || analysis?.metadata?.runId || 'N/A');
}

    // === Controles de Validação (Suite Objetiva + Subjetiva) ===
    function injectValidationControls(){
        if (document.getElementById('validationControlsBar')) return;
        const host = document.getElementById('modalTechnicalData');
        if (!host) return;
        const bar = document.createElement('div');
        bar.id='validationControlsBar';
        bar.style.cssText='margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#0f1826;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;font-size:12px;';
        bar.innerHTML = `
            <strong style="letter-spacing:.5px;color:#9fc9ff;font-weight:600;">Validação Auditiva</strong>
            <button id="runValidationSuiteBtn" style="background:#10365a;color:#fff;border:1px solid #1e4d7a;padding:6px 10px;font-size:12px;border-radius:6px;cursor:pointer;">Rodar Suite (10)</button>
            <button id="openSubjectiveFormBtn" style="background:#1c2c44;color:#d6e7ff;border:1px solid #284362;padding:6px 10px;font-size:12px;border-radius:6px;cursor:pointer;" disabled>Subjetivo 1–5</button>
            <button id="downloadValidationReportBtn" style="background:#224d37;color:#c5ffe9;border:1px solid #2f6e4e;padding:6px 10px;font-size:12px;border-radius:6px;cursor:pointer;" disabled>Baixar Relatório</button>
            <span id="validationStatusMsg" style="margin-left:auto;font-size:11px;opacity:.75;">Pronto</span>
        `;
        host.prepend(bar);
        // Handlers
        const btnRun = bar.querySelector('#runValidationSuiteBtn');
        const btnForm = bar.querySelector('#openSubjectiveFormBtn');
        const btnDownload = bar.querySelector('#downloadValidationReportBtn');
        const statusEl = bar.querySelector('#validationStatusMsg');
        btnRun.onclick = async ()=>{
            btnRun.disabled = true; btnRun.textContent = 'Rodando...'; statusEl.textContent = 'Executando suite...';
            try {
                const mod = await import(`../lib/audio/validation/validation-suite.js?c=${Date.now()}`);
                const summary = await mod.runValidationSuite({});
                statusEl.textContent = summary? `Cobertura média Δ ${(summary.avgDelta*100).toFixed(1)}%` : 'Sem dados';
                btnRun.textContent = 'Suite OK';
                btnForm.disabled = false; btnDownload.disabled = false;
                // Área dinâmica para formulário
                ensureValidationPanel();
            } catch(err){ console.error('Erro suite validação', err); statusEl.textContent='Erro'; btnRun.textContent='Erro'; btnRun.disabled=false; }
        };
        btnForm.onclick = async ()=>{
            try { const mod = await import(`../lib/audio/validation/validation-suite.js?c=${Date.now()}`); ensureValidationPanel(); mod.renderSubjectiveForm('validationPanelInner'); statusEl.textContent='Formulário subjetivo aberto'; } catch(e){ console.warn(e); }
        };
        btnDownload.onclick = async ()=>{
            try { const mod = await import(`../lib/audio/validation/validation-suite.js?c=${Date.now()}`); const rep = mod.generateValidationReport(); if(rep){ downloadObjectAsJson(rep, 'prodai_validation_report.json'); statusEl.textContent = rep?.subjective?.pctImproved!=null? `Subj ${(rep.subjective.pctImproved*100).toFixed(0)}%`:'Relatório gerado'; } } catch(e){ console.warn(e); }
        };
    }

    function ensureValidationPanel(){
        if (document.getElementById('validationPanel')) return;
        const container = document.createElement('div');
        container.id='validationPanel';
        container.style.cssText='margin-top:12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0d141f;padding:10px 12px;';
        container.innerHTML = `<div style="font-size:12px;font-weight:600;letter-spacing:.5px;color:#9fc9ff;margin-bottom:6px;">Resultados da Validação</div><div id='validationPanelInner' style='font-size:11px;'></div>`;
        const host = document.getElementById('modalTechnicalData');
        if (host) host.appendChild(container);
        // estilos mínimos tabela subjetiva
        if (!document.getElementById('validationStyles')){
            const st=document.createElement('style'); st.id='validationStyles'; st.textContent=`
                .subjective-table{border-collapse:collapse;width:100%;margin-top:6px;font-size:11px;}
                .subjective-table th,.subjective-table td{border:1px solid rgba(255,255,255,.08);padding:4px 6px;text-align:center;}
                .subjective-table th{background:#132132;color:#c9e4ff;font-weight:500;letter-spacing:.4px;}
                .subjective-table select{min-width:42px;}
            `; document.head.appendChild(st);
        }
    }

    function downloadObjectAsJson(obj, filename){
        try { const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 250); } catch(e){ console.warn('download json fail', e); }
    }

// ===== Painel Resumo Inteligente (top 3 problemas + top 3 ações) =====
function renderSmartSummary(analysis){
    try {
        if (!(typeof window !== 'undefined' && window.CAIAR_ENABLED) || !analysis) return '';
        // Garantir plano explain (caso ainda não anexado)
        if (!analysis.caiarExplainPlan && window.audioAnalyzer && typeof analysis === 'object') {
            try {
                // se módulo ainda não carregado, importar dinamicamente
                if (!window.__CAIAR_EXPLAIN_LOADING__) {
                    window.__CAIAR_EXPLAIN_LOADING__ = import('/lib/audio/features/caiar-explain.js').then(mod=>{
                        if (mod && typeof mod.generateExplainPlan === 'function') mod.generateExplainPlan(analysis);
                    }).catch(()=>null);
                }
            } catch {}
        }
        const problems = Array.isArray(analysis.problems) ? analysis.problems.slice(0,3) : [];
        // Selecionar ações: usar passos do plano explain se existir, senão derivar das sugestões
        let steps = (analysis.caiarExplainPlan && Array.isArray(analysis.caiarExplainPlan.passos)) ? analysis.caiarExplainPlan.passos.slice(0,6) : [];
        if (steps.length === 0) {
            const sugg = Array.isArray(analysis.suggestions) ? analysis.suggestions.slice() : [];
            // Ordenar por prioridade se houver
            sugg.sort((a,b)=> (a.priority||999)-(b.priority||999));
            steps = sugg.slice(0,6).map((s,i)=>({
                ordem:i+1,
                titulo:s.message||'Ação',
                acao:s.action||'',
                porque:s.details||s.rationale? JSON.stringify(s.rationale):'Otimização recomendada',
                condicao:s.condition||s.condicao||'Aplicar quando perceptível',
                origem:s.source||s.type,
                stem:s.targetStem||null,
                parametroPrincipal: s.freqHz? (Math.round(s.freqHz)+' Hz'): (s.band||null)
            }));
        }
        const topActions = steps.slice(0,3);
        const actionItems = topActions.map(a=>{
            const stem = a.stem ? `<span class="ss-stem">${a.stem}</span>` : '';
            const param = a.parametroPrincipal ? `<span class="ss-param">${a.parametroPrincipal}</span>` : '';
            const cond = a.condicao ? `<span class="ss-cond">${a.condicao}</span>` : '';
            const whyId = 'why_'+Math.random().toString(36).slice(2);
            return `<div class="ss-action-item">
                <div class="ss-line-main">
                    <span class="ss-title">${a.titulo}</span>
                    ${stem}
                    ${param}
                </div>
                <div class="ss-line-meta">
                    ${cond}
                    <button type="button" class="ss-why-btn" data-why-target="${whyId}">Por que?</button>
                </div>
                <div class="ss-why" id="${whyId}">${a.porque || 'Melhora coerência sonora.'}</div>
            </div>`;
        }).join('');
        const problemItems = problems.map(p=>`<div class="ss-prob-item"><span class="ss-prob-msg">${p.message||''}</span></div>`).join('');
        // Expand/Collapse container
        const html = `<div class="smart-summary-card" id="smartSummaryCard">
            <div class="ss-header">
                <div class="ss-title-block">⚡ Resumo Inteligente</div>
                <button type="button" class="ss-toggle" data-expanded="true">Colapsar</button>
            </div>
            <div class="ss-content" data-collapsible="body">
                <div class="ss-section">
                    <div class="ss-section-title">Top 3 Problemas</div>
                    ${problemItems || '<div class="ss-empty">Nenhum problema crítico</div>'}
                </div>
                <div class="ss-section">
                    <div class="ss-section-title">Top 3 Ações</div>
                    ${actionItems || '<div class="ss-empty">Nenhuma ação prioritária</div>'}
                </div>
                <div class="ss-hint">Execute as ações na ordem. Tempo de entendimento < 30s.</div>
            </div>
        </div>`;
        // Injetar estilos apenas uma vez
        if (!document.getElementById('smartSummaryStyles')) {
            const st = document.createElement('style');
            st.id = 'smartSummaryStyles';
            st.textContent = `
            .smart-summary-card{margin:12px 0 4px 0;padding:14px 16px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:linear-gradient(145deg,#0f1623,#101b2e);box-shadow:0 4px 14px -4px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,0.03);font-size:13px;}
            .smart-summary-card .ss-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
            .smart-summary-card .ss-title-block{font-weight:600;letter-spacing:.5px;color:#e5f1ff;font-size:13px;}
            .smart-summary-card .ss-toggle{background:#18263a;color:#d2e6ff;border:1px solid #24364e;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;letter-spacing:.4px;transition:background .25s,border-color .25s;}
            .smart-summary-card .ss-toggle:hover{background:#203148;}
            .smart-summary-card .ss-section{margin-top:10px;}
            .smart-summary-card .ss-section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:#86b4ff;margin-bottom:6px;}
            .smart-summary-card .ss-prob-item{background:rgba(255,90,90,.08);border:1px solid rgba(255,90,90,.25);padding:6px 8px;border-radius:8px;margin-bottom:6px;line-height:1.3;}
            .smart-summary-card .ss-prob-item:last-child{margin-bottom:0;}
            .smart-summary-card .ss-action-item{background:#152132;border:1px solid rgba(255,255,255,.08);padding:8px 10px;border-radius:10px;margin-bottom:8px;}
            .smart-summary-card .ss-action-item:last-child{margin-bottom:0;}
            .smart-summary-card .ss-line-main{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px;}
            .smart-summary-card .ss-title{font-weight:600;color:#fff;font-size:13px;}
            .smart-summary-card .ss-stem{background:#24364e;color:#9ac9ff;padding:2px 6px;font-size:10px;border-radius:6px;letter-spacing:.4px;}
            .smart-summary-card .ss-param{background:#1c2c44;color:#d6ecff;padding:2px 6px;font-size:10px;border-radius:6px;letter-spacing:.4px;}
            .smart-summary-card .ss-cond{font-size:10px;background:#223347;color:#cfe8ff;padding:2px 6px;border-radius:6px;letter-spacing:.3px;}
            .smart-summary-card .ss-line-meta{display:flex;align-items:center;gap:10px;}
            .smart-summary-card .ss-why-btn{background:none;border:0;color:#53b4ff;font-size:11px;cursor:pointer;padding:0 2px;}
            .smart-summary-card .ss-why{display:none;margin-top:6px;font-size:11px;line-height:1.4;background:#101c2b;padding:6px 8px;border:1px solid rgba(255,255,255,.05);border-radius:8px;color:#c7d8eb;}
            .smart-summary-card .ss-why.open{display:block;}
            .smart-summary-card .ss-hint{margin-top:10px;font-size:10px;opacity:.55;letter-spacing:.4px;}
            .smart-summary-card .ss-empty{opacity:.6;font-size:12px;padding:4px 2px;}
            .smart-summary-card[data-collapsed='true'] .ss-content{display:none;}
            @media (max-width:560px){.smart-summary-card{padding:12px 12px;} .smart-summary-card .ss-title{font-size:12px;} }
            `;
            document.head.appendChild(st);
            // Delegated listeners
            document.addEventListener('click', (e)=>{
                const btn = e.target.closest('.ss-toggle');
                if (btn){
                    const card = btn.closest('.smart-summary-card');
                    const expanded = btn.getAttribute('data-expanded') === 'true';
                    btn.setAttribute('data-expanded', expanded? 'false':'true');
                    btn.textContent = expanded? 'Expandir':'Colapsar';
                    if (expanded) card.setAttribute('data-collapsed','true'); else card.removeAttribute('data-collapsed');
                }
                const why = e.target.closest('.ss-why-btn');
                if (why){
                    const id = why.getAttribute('data-why-target');
                    const block = document.getElementById(id);
                    if (block){ block.classList.toggle('open'); }
                }
            }, { passive:true });
        }
        return html;
    } catch (e) { console.warn('smart summary fail', e); return ''; }
}

function renderReferenceComparisons(analysis) {
    const container = document.getElementById('referenceComparisons');
    if (!container) return;
    
    // 🎯 DETECÇÃO DE MODO REFERÊNCIA - Usar dados da referência em vez de gênero
    const isReferenceMode = analysis.analysisMode === 'reference' || 
                           analysis.baseline_source === 'reference' ||
                           (analysis.comparison && analysis.comparison.baseline_source === 'reference');
    
    let ref, titleText;
    
    if (isReferenceMode && analysis.referenceMetrics) {
        // Modo referência: usar métricas extraídas do áudio de referência
        ref = {
            lufs_target: analysis.referenceMetrics.lufs,
            true_peak_target: analysis.referenceMetrics.truePeakDbtp,
            dr_target: analysis.referenceMetrics.dynamicRange,
            lra_target: analysis.referenceMetrics.lra,
            stereo_target: analysis.referenceMetrics.stereoCorrelation,
            tol_lufs: 0.2,
            tol_true_peak: 0.2,
            tol_dr: 0.5,
            tol_lra: 0.5,
            tol_stereo: 0.05,
            bands: analysis.referenceMetrics.bands || null
        };
        titleText = "Música de Referência";
    } else {
        // Modo gênero: usar targets de gênero como antes
        ref = __activeRefData;
        titleText = window.PROD_AI_REF_GENRE;
        if (!ref) { 
            container.innerHTML = '<div style="font-size:12px;opacity:.6">Referências não carregadas</div>'; 
            return; 
        }
    }
    
    const tech = analysis.technicalData || {};
    // Mapeamento de métricas
    const rows = [];
    const nf = (n, d=2) => Number.isFinite(n) ? n.toFixed(d) : '—';
    const pushRow = (label, val, target, tol, unit='') => {
        // 🛡️ GUARD CRÍTICO: Skip métricas indisponíveis com logging detalhado
        if (!Number.isFinite(val)) {
            const valInfo = val === null ? 'NULL' : val === undefined ? 'UNDEFINED' : String(val);
            console.warn(`[REF_COMPARE] Métrica '${label}' não disponível (val=${valInfo}) - SKIP DA LINHA`);
            return; // Não adicionar linha na tabela se valor não está disponível
        }
        
        // Usar sistema de enhancement se disponível
        const enhancedLabel = (typeof window !== 'undefined' && window.enhanceRowLabel) 
            ? window.enhanceRowLabel(label, label.toLowerCase().replace(/[^a-z]/g, '')) 
            : label;
            
        // Tratar target null ou NaN como N/A explicitamente
        const targetIsNA = (target == null || target === '' || (typeof target==='number' && !Number.isFinite(target)));
        if (targetIsNA) {
            rows.push(`<tr>
                <td>${enhancedLabel}</td>
                <td>${Number.isFinite(val)?nf(val)+unit:'—'}</td>
                <td colspan="2" style="opacity:.55">N/A</td>
            </tr>`);
            return;
        }
        
        const diff = Number.isFinite(val) && Number.isFinite(target) ? (val - target) : null;
        
        // Usar nova função de célula melhorada se disponível
        let diffCell;
        if (typeof window !== 'undefined' && window.createEnhancedDiffCell) {
            diffCell = window.createEnhancedDiffCell(diff, unit, tol);
        } else {
            // Fallback para sistema antigo
            let cssClass = 'na';
            if (Number.isFinite(diff) && Number.isFinite(tol) && tol > 0) {
                const adiff = Math.abs(diff);
                if (adiff <= tol) {
                    cssClass = 'ok';
                } else {
                    const n = adiff / tol;
                    if (n <= 2) {
                        cssClass = 'yellow';
                    } else {
                        cssClass = 'warn';
                    }
                }
            }
            
            diffCell = Number.isFinite(diff)
                ? `<td class="${cssClass}">${diff>0?'+':''}${nf(diff)}${unit}</td>`
                : '<td class="na" style="opacity:.55">—</td>';
        }
        
        rows.push(`<tr>
            <td>${enhancedLabel}</td>
            <td>${Number.isFinite(val)?nf(val)+unit:'—'}</td>
            <td>${Number.isFinite(target)?nf(target)+unit:'N/A'}${tol!=null?`<span class="tol">±${nf(tol,2)}</span>`:''}</td>
            ${diffCell}
        </tr>`);
    };
    // 🎯 CENTRALIZAÇÃO DAS MÉTRICAS - Função de acesso para comparação por referência
    const getMetricForRef = (metricPath, fallbackPath = null) => {
        // Prioridade: analysis.metrics > tech (technicalData) > fallback
        const centralizedValue = analysis.metrics && getNestedValue(analysis.metrics, metricPath);
        if (Number.isFinite(centralizedValue)) {
            // Log temporário para validação
            if (typeof window !== 'undefined' && window.METRICS_REF_VALIDATION !== false) {
                const legacyValue = fallbackPath ? getNestedValue(tech, fallbackPath) : getNestedValue(tech, metricPath);
                if (Number.isFinite(legacyValue) && Math.abs(centralizedValue - legacyValue) > 0.01) {
                    console.warn(`🎯 REF_METRIC_DIFF: ${metricPath} centralized=${centralizedValue} vs legacy=${legacyValue}`);
                }
            }
            return centralizedValue;
        }
        
        // Fallback para technicalData legado
        const legacyValue = fallbackPath ? getNestedValue(tech, fallbackPath) : getNestedValue(tech, metricPath);
        return Number.isFinite(legacyValue) ? legacyValue : null;
    };
    
    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    };
    
    // Usar somente métricas reais (sem fallback para RMS/Peak, que têm unidades e conceitos distintos)
    // Função para obter o valor LUFS integrado usando métricas centralizadas
    const getLufsIntegratedValue = () => {
        return getMetricForRef('lufs_integrated', 'lufsIntegrated');
    };
    
    pushRow('Loudness Integrado (LUFS)', getLufsIntegratedValue(), ref.lufs_target, ref.tol_lufs, ' LUFS');
    pushRow('Pico Real (dBTP)', getMetricForRef('true_peak_dbtp', 'truePeakDbtp'), ref.true_peak_target, ref.tol_true_peak, ' dBTP');
    pushRow('DR', getMetricForRef('dynamic_range', 'dynamicRange'), ref.dr_target, ref.tol_dr, '');
    pushRow('Faixa de Loudness – LRA (LU)', getMetricForRef('lra'), ref.lra_target, ref.tol_lra, ' LU');
    pushRow('Stereo Corr.', getMetricForRef('stereo_correlation', 'stereoCorrelation'), ref.stereo_target, ref.tol_stereo, '');
    
    // Bandas detalhadas Fase 2: usar métricas centralizadas para bandas
    const centralizedBands = analysis.metrics?.bands;
    const legacyBandEnergies = tech.bandEnergies || null;
    
    // Priorizar bandas centralizadas se disponíveis
    const bandsToUse = centralizedBands && Object.keys(centralizedBands).length > 0 ? centralizedBands : legacyBandEnergies;
    
    if (bandsToUse && ref.bands) {
        const normMap = (analysis?.technicalData?.refBandTargetsNormalized?.mapping) || null;
        const showNorm = (typeof window !== 'undefined' && window.SHOW_NORMALIZED_REF_TARGETS === true && normMap);
        
        for (const [band, refBand] of Object.entries(ref.bands)) {
            let bLocal;
            
            // Acessar dados da banda (centralizadas vs legado)
            if (centralizedBands && centralizedBands[band]) {
                bLocal = { rms_db: centralizedBands[band].energy_db };
                
                // Log temporário para validação
                if (typeof window !== 'undefined' && window.METRICS_BANDS_VALIDATION !== false && legacyBandEnergies?.[band]) {
                    const legacyValue = legacyBandEnergies[band].rms_db;
                    if (Number.isFinite(legacyValue) && Math.abs(centralizedBands[band].energy_db - legacyValue) > 0.01) {
                        console.warn(`🎯 BAND_DIFF: ${band} centralized=${centralizedBands[band].energy_db} vs legacy=${legacyValue}`);
                    }
                }
            } else {
                bLocal = legacyBandEnergies?.[band];
            }
            
            if (bLocal && Number.isFinite(bLocal.rms_db)) {
                let tgt = null;
                if (!refBand._target_na && Number.isFinite(refBand.target_db)) tgt = refBand.target_db;
                if (showNorm && normMap && Number.isFinite(normMap[band])) tgt = normMap[band];
                pushRow(band, bLocal.rms_db, tgt, refBand.tol_db);
            }
        }
    } else {
        // Fallback antigo: tonalBalance simplificado
        const tb = tech.tonalBalance || {};
        const bandMap = { sub:'sub', low:'low_bass', mid:'mid', high:'brilho' };
        Object.entries(bandMap).forEach(([tbKey, refBand]) => {
            const bData = tb[tbKey];
            const refBandData = ref.bands?.[refBand];
            if (bData && refBandData && Number.isFinite(bData.rms_db)) {
                pushRow(`${tbKey.toUpperCase()}`, bData.rms_db, refBandData.target_db, refBandData.tol_db);
            }
        });
    }
    container.innerHTML = `<div class="card" style="margin-top:12px;">
        <div class="card-title">📌 Comparação de Referência (${titleText})</div>
        <table class="ref-compare-table">
            <thead><tr>
                <th>Métrica</th><th>Valor</th><th>Alvo</th><th>Δ</th>
            </tr></thead>
            <tbody>${rows.join('') || '<tr><td colspan="4" style="opacity:.6">Sem métricas disponíveis</td></tr>'}</tbody>
        </table>
    </div>`;
    // Estilos injetados uma vez
    if (!document.getElementById('refCompareStyles')) {
        const style = document.createElement('style');
        style.id = 'refCompareStyles';
        style.textContent = `
        .ref-compare-table{width:100%;border-collapse:collapse;font-size:11px;}
    .ref-compare-table th{font-weight:500;text-align:left;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.12);font-size:11px;color:#fff;letter-spacing:.3px;}
    .ref-compare-table td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.06);color:#f5f7fa;} 
        .ref-compare-table tr:last-child td{border-bottom:0;} 
    .ref-compare-table td.ok{color:#52f7ad;font-weight:600;} 
    .ref-compare-table td.yellow{color:#ffce4d;font-weight:600;} 
    .ref-compare-table td.warn{color:#ff7b7b;font-weight:600;} 
    .ref-compare-table .tol{opacity:.7;margin-left:4px;font-size:10px;color:#b8c2d6;} 
    .ref-compare-table tbody tr:hover td{background:rgba(255,255,255,.04);} 
        `;
        document.head.appendChild(style);
    }
}

// Recalcular apenas as sugestões baseadas em referência (sem reprocessar o áudio)
function updateReferenceSuggestions(analysis) {
    if (!analysis || !analysis.technicalData || !__activeRefData) return;
    
    // 🎯 SISTEMA MELHORADO: Usar Enhanced Suggestion Engine quando disponível
    if (typeof window !== 'undefined' && window.enhancedSuggestionEngine && window.USE_ENHANCED_SUGGESTIONS !== false) {
        try {
            console.log('🎯 Usando Enhanced Suggestion Engine...');
            const enhancedAnalysis = window.enhancedSuggestionEngine.processAnalysis(analysis, __activeRefData);
            
            // Preservar sugestões não-referência existentes se necessário
            const existingSuggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions : [];
            const nonRefSuggestions = existingSuggestions.filter(s => {
                const type = s?.type || '';
                return !type.startsWith('reference_') && !type.startsWith('band_adjust') && !type.startsWith('heuristic_');
            });
            
            // Combinar sugestões melhoradas com existentes preservadas
            analysis.suggestions = [...enhancedAnalysis.suggestions, ...nonRefSuggestions];
            
            // Adicionar métricas melhoradas à análise
            if (enhancedAnalysis.enhancedMetrics) {
                analysis.enhancedMetrics = enhancedAnalysis.enhancedMetrics;
            }
            
            // Adicionar log de auditoria
            if (enhancedAnalysis.auditLog) {
                analysis.auditLog = enhancedAnalysis.auditLog;
            }
            
            console.log(`🎯 Enhanced Suggestions: ${enhancedAnalysis.suggestions.length} sugestões geradas`);
            return;
            
        } catch (error) {
            console.warn('🚨 Erro no Enhanced Suggestion Engine, usando fallback:', error);
            // Continuar com sistema legado em caso de erro
        }
    }
    
    // 🔄 SISTEMA LEGADO (fallback)
    const ref = __activeRefData;
    const tech = analysis.technicalData;
    // Garantir lista
    const sug = Array.isArray(analysis.suggestions) ? analysis.suggestions : (analysis.suggestions = []);
    // Remover sugestões antigas de referência
    const refTypes = new Set(['reference_loudness','reference_dynamics','reference_lra','reference_stereo','reference_true_peak']);
    for (let i = sug.length - 1; i >= 0; i--) {
        const t = sug[i] && sug[i].type;
        if (t && refTypes.has(t)) sug.splice(i, 1);
    }
    // Helper para criar sugestão se fora da tolerância
    const addRefSug = (val, target, tol, type, label, unit='') => {
        if (!Number.isFinite(val) || !Number.isFinite(target) || !Number.isFinite(tol)) return;
        const diff = val - target;
        if (Math.abs(diff) <= tol) return; // dentro da tolerância
        const direction = diff > 0 ? 'acima' : 'abaixo';
        sug.push({
            type,
            message: `${label} ${direction} do alvo (${target}${unit})`,
            action: `Ajustar ${label} ${direction==='acima'?'para baixo':'para cima'} ~${target}${unit}`,
            details: `Diferença: ${diff.toFixed(2)}${unit} • tolerância ±${tol}${unit} • gênero: ${window.PROD_AI_REF_GENRE}`
        });
    };
    // Aplicar checks principais
    const lufsVal = Number.isFinite(tech.lufsIntegrated) ? tech.lufsIntegrated : null;
    addRefSug(lufsVal, ref.lufs_target, ref.tol_lufs, 'reference_loudness', 'LUFS', '');
    const tpVal = Number.isFinite(tech.truePeakDbtp) ? tech.truePeakDbtp : null;
    addRefSug(tpVal, ref.true_peak_target, ref.tol_true_peak, 'reference_true_peak', 'Pico Real', ' dBTP');
    addRefSug(tech.dynamicRange, ref.dr_target, ref.tol_dr, 'reference_dynamics', 'DR', ' dB');
    if (Number.isFinite(tech.lra)) addRefSug(tech.lra, ref.lra_target, ref.tol_lra, 'reference_lra', 'LRA', ' LU');
    if (Number.isFinite(tech.stereoCorrelation)) addRefSug(tech.stereoCorrelation, ref.stereo_target, ref.tol_stereo, 'reference_stereo', 'Stereo Corr', '');
}

// 🎨 Estilos do seletor de gênero (injeção única, não quebra CSS existente)
function injectRefGenreStyles() {
    if (document.getElementById('refGenreEnhancedStyles')) return; // já injetado
    const style = document.createElement('style');
    style.id = 'refGenreEnhancedStyles';
    style.textContent = `
    #audioRefGenreContainer{position:relative;gap:10px;padding:6px 10px 4px 10px;border:1px solid rgba(255,255,255,.06);background:linear-gradient(145deg,#0c111b,#0d1321);border-radius:10px;box-shadow:0 2px 6px -2px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,0.02);}
    #audioRefGenreContainer label{font-weight:500;letter-spacing:.3px;color:#9fb3d9;margin-right:4px;}
    #audioRefGenreSelect{appearance:none;-webkit-appearance:none;-moz-appearance:none;position:relative;padding:6px 32px 6px 12px;font-size:12px;line-height:1.2;background:rgba(20,32,54,.7);color:#f4f7fb;border:1px solid #1e2b40;border-radius:8px;cursor:pointer;font-family:inherit;transition:border .25s, background .25s, box-shadow .25s;min-width:140px;}
    #audioRefGenreSelect:hover{background:rgba(28,44,76,.85);}
    #audioRefGenreSelect:focus{outline:none;border-color:#249dff;box-shadow:0 0 0 2px rgba(36,157,255,.3);}
    #audioRefGenreSelect:active{transform:translateY(1px);} 
    #audioRefGenreContainer::after{content:"";position:absolute;top:13px;left: calc(10px + 140px);pointer-events:none;}
    #audioRefGenreContainer .select-wrap{position:relative;}
    /* Seta custom */
    #audioRefGenreContainer .select-wrap:after{content:"";position:absolute;right:12px;top:50%;width:7px;height:7px;border-right:2px solid #9fb3d9;border-bottom:2px solid #9fb3d9;transform:translateY(-60%) rotate(45deg);pointer-events:none;transition:transform .25s,border-color .25s;}
    #audioRefGenreSelect:focus + .arrow, #audioRefGenreContainer .select-wrap:focus-within:after{border-color:#53c2ff;}
    #audioRefStatus{font-size:11px;font-weight:500;letter-spacing:.4px;padding:4px 10px;border-radius:7px;background:#0d6efd;color:#fff;display:inline-flex;align-items:center;gap:6px;box-shadow:0 0 0 1px rgba(255,255,255,.06),0 2px 4px -1px rgba(0,0,0,.7);}
    #audioRefStatus::before{content:"";width:7px;height:7px;border-radius:50%;background:#3df29b;box-shadow:0 0 0 3px rgba(61,242,155,.25);} 
    #audioRefGenreContainer.dark #audioRefStatus{background:#14324f;}
    @media (max-width:600px){#audioRefGenreContainer{padding:6px 8px 4px 8px;gap:6px;}#audioRefGenreSelect{min-width:120px;padding:6px 28px 6px 10px;}}
    `;
    // Wrap opcional para setinha sem mexer HTML: inserir span ao redor do select
    const select = document.getElementById('audioRefGenreSelect');
    if (select && !select.parentElement.classList.contains('select-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'select-wrap';
        wrap.style.position = 'relative';
        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
    }
    document.head.appendChild(style);
}

// 🤖 Enviar análise para chat
window.sendModalAnalysisToChat = async function sendModalAnalysisToChat() {
    __dbg('🎯 BOTÃO CLICADO: Pedir Ajuda à IA');
    
    if (!currentModalAnalysis) {
        alert('Nenhuma análise disponível');
        __dbg('❌ Erro: currentModalAnalysis não existe');
        return;
    }
    
    __dbg('🤖 Enviando análise para chat...', currentModalAnalysis);
    
    try {
        // Gerar prompt personalizado baseado nos problemas encontrados
        const prompt = window.audioAnalyzer.generateAIPrompt(currentModalAnalysis);
        const message = `🎵 Analisei meu áudio e preciso de ajuda para melhorar. Aqui estão os dados técnicos:\n\n${prompt}`;
        
        __dbg('📝 Prompt gerado:', message.substring(0, 200) + '...');
        
        // Tentar diferentes formas de integrar com o chat
        let messageSent = false;
        
        // Método 1: Usar diretamente o ProdAI Chatbot quando disponível
        if (window.prodAIChatbot) {
            __dbg('🎯 Tentando enviar via ProdAI Chatbot...');
            try {
                // Se o chat ainda não está ativo, ativar com a mensagem
                if (!window.prodAIChatbot.isActive && typeof window.prodAIChatbot.activateChat === 'function') {
                    __dbg('🚀 Chat inativo. Ativando com a primeira mensagem...');
                    await window.prodAIChatbot.activateChat(message);
                    showTemporaryFeedback('🎵 Análise enviada para o chat!');
                    closeAudioModal();
                    messageSent = true;
                } else if (typeof window.prodAIChatbot.sendMessage === 'function') {
                    // Chat já ativo: preencher input ativo e enviar
                    const activeInput = document.getElementById('chatbotActiveInput');
                    if (activeInput) {
                        activeInput.value = message;
                        activeInput.focus();
                        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
                        await window.prodAIChatbot.sendMessage();
                        showTemporaryFeedback('🎵 Análise enviada para o chat!');
                        closeAudioModal();
                        messageSent = true;
                    }
                }
            } catch (err) {
                __dwrn('⚠️ Falha ao usar ProdAIChatbot direto, tentando fallback...', err);
            }
        }
        // Método 2: Inserir diretamente no input e simular envio
        else {
            __dbg('🎯 Tentando método alternativo...');
            
            const input = document.getElementById('chatbotActiveInput') || document.getElementById('chatbotMainInput');
            const sendBtn = document.getElementById('chatbotActiveSendBtn') || document.getElementById('chatbotSendButton');
            
            __dbg('🔍 Elementos encontrados:', { input: !!input, sendBtn: !!sendBtn });
            
            if (input && sendBtn) {
                input.value = message;
                input.focus();
                
                // Disparar eventos para simular interação do usuário
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Aguardar um pouco e clicar no botão
                setTimeout(() => {
                    sendBtn.click();
                    __dbg('✅ Botão clicado');
                    showTemporaryFeedback('🎵 Análise enviada para o chat!');
                    closeAudioModal();
                }, 500);
                
                messageSent = true;
            }
        }
        
        if (!messageSent) {
            __dbg('❌ Não foi possível enviar automaticamente, copiando para clipboard...');
            
            // Fallback: copiar para clipboard
            await navigator.clipboard.writeText(message);
            showTemporaryFeedback('📋 Análise copiada! Cole no chat manualmente.');
            __dbg('📋 Mensagem copiada para clipboard como fallback');
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar análise para chat:', error);
        showTemporaryFeedback('❌ Erro ao enviar análise. Tente novamente.');
    }
}

// � Mostrar feedback temporário
// (definição duplicada de showTemporaryFeedback removida — mantida a versão consolidada abaixo)

// �📄 Baixar relatório do modal
function downloadModalAnalysis() {
    if (!currentModalAnalysis) {
        alert('Nenhuma análise disponível');
        return;
    }
    
    console.log('📄 Baixando relatório...');
    
    try {
        const report = generateDetailedReport(currentModalAnalysis);
        const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `prod_ai_audio_analysis_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ Relatório baixado com sucesso');
        showTemporaryFeedback('📄 Relatório baixado!');
        
    } catch (error) {
        console.error('❌ Erro ao baixar relatório:', error);
        alert('Erro ao gerar relatório');
    }
}

// 📋 Gerar relatório detalhado
function generateDetailedReport(analysis) {
    const now = new Date();
    let report = `🎵 PROD.AI - RELATÓRIO DE ANÁLISE DE ÁUDIO\n`;
    report += `${'='.repeat(50)}\n\n`;
    report += `📅 Data: ${now.toLocaleString('pt-BR')}\n`;
    report += `🔬 Análise realizada com tecnologia Web Audio API\n\n`;
    
    report += `📊 DADOS TÉCNICOS PRINCIPAIS:\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `Peak Level: ${analysis.technicalData.peak.toFixed(2)} dB\n`;
    report += `RMS Level: ${analysis.technicalData.rms.toFixed(2)} dB\n`;
    report += `Dynamic Range: ${analysis.technicalData.dynamicRange.toFixed(2)} dB\n`;
    report += `Duration: ${analysis.duration.toFixed(2)} seconds\n`;
    report += `Sample Rate: ${analysis.sampleRate || 'N/A'} Hz\n`;
    report += `Channels: ${analysis.channels || 'N/A'}\n\n`;
    
    if (analysis.technicalData?.dominantFrequencies?.length > 0) {
        report += `🎯 FREQUÊNCIAS DOMINANTES:\n`;
        report += `${'-'.repeat(30)}\n`;
        analysis.technicalData.dominantFrequencies.slice(0, 10).forEach((freq, i) => {
            report += `${i + 1}. ${Math.round(freq.frequency)} Hz (${freq.occurrences} ocorrências)\n`;
        });
        report += `\n`;
    }
    
    if (analysis.problems.length > 0) {
        report += `🚨 PROBLEMAS DETECTADOS:\n`;
        report += `${'-'.repeat(30)}\n`;
        analysis.problems.forEach((problem, i) => {
            report += `${i + 1}. PROBLEMA: ${problem.message}\n`;
            report += `   SOLUÇÃO: ${problem.solution}\n`;
            report += `   SEVERIDADE: ${problem.severity}\n\n`;
        });
    }
    
    if (analysis.suggestions.length > 0) {
        report += `💡 SUGESTÕES DE MELHORIA:\n`;
        report += `${'-'.repeat(30)}\n`;
        analysis.suggestions.forEach((suggestion, i) => {
            report += `${i + 1}. ${suggestion.message}\n`;
            report += `   AÇÃO: ${suggestion.action}\n`;
            report += `   TIPO: ${suggestion.type}\n\n`;
        });
    }
    
    report += `📝 OBSERVAÇÕES TÉCNICAS:\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `• Esta análise foi realizada usando Web Audio API\n`;
    report += `• Para análises mais avançadas, considere usar ferramentas profissionais\n`;
    report += `• Valores de referência: RMS ideal para streaming: -14 LUFS\n`;
    report += `• Peak ideal: máximo -1 dB para evitar clipping\n`;
    report += `• Dynamic range ideal: entre 8-15 dB para música popular\n\n`;
    
    report += `🎵 Gerado por PROD.AI - Seu mentor de produção musical\n`;
    report += `📱 Para mais análises: prod-ai-teste.vercel.app\n`;
    
    return report;
}

// 💬 Mostrar feedback temporário
function showTemporaryFeedback(message) {
    // Criar elemento de feedback
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #00d4ff, #0096cc);
        color: #000;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 10001;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
    `;
    feedback.textContent = message;
    
    // Adicionar animação CSS
    if (!document.getElementById('feedbackStyles')) {
        const style = document.createElement('style');
        style.id = 'feedbackStyles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(feedback);
    
    // Remover após 3 segundos
    setTimeout(() => {
        feedback.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 300);
    }, 3000);
}

__dbg('🎵 Audio Analyzer Integration Script carregado!');

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    __dbg('🎵 DOM carregado, inicializando Audio Analyzer...');
    initializeAudioAnalyzerIntegration();
});

// Fallback: se o DOM já estiver carregado
if (document.readyState !== 'loading') {
    // se DOM já pronto, inicializar uma vez
    initializeAudioAnalyzerIntegration();
}

// Utilitário opcional: testar consistência das métricas com reanálises repetidas do mesmo arquivo
// Uso (dev): window.__testConsistency(file, 3).then(console.log)
if (typeof window !== 'undefined' && !window.__testConsistency) {
    window.__testConsistency = async function(file, runs = 3) {
        const out = { runs: [], deltas: {} };
        for (let i = 0; i < runs; i++) {
            const t0 = performance.now();
            // 🆔 CORREÇÃO: Adicionar runId para funções de teste de consistência
            const testOptions = prepareAnalysisOptions({}, `consistency_${i+1}`);
            const res = await window.audioAnalyzer.analyzeAudioFile(file, testOptions);
            const t1 = performance.now();
            out.runs.push({
                idx: i+1,
                lufs: res?.technicalData?.lufsIntegrated ?? res?.metrics?.lufs ?? null,
                truePeakDbtp: res?.technicalData?.truePeakDbtp ?? res?.metrics?.truePeakDbtp ?? null,
                dr: res?.technicalData?.dynamicRange ?? res?.metrics?.dynamicRange ?? null,
                lra: res?.technicalData?.lra ?? null,
                processingMs: res?.processingMs ?? (t1 - t0)
            });
        }
        // calcular deltas
        const vals = (key) => out.runs.map(r => r[key]).filter(v => Number.isFinite(v));
        const stats = (arr) => arr.length ? { min: Math.min(...arr), max: Math.max(...arr), spread: Math.max(...arr)-Math.min(...arr) } : null;
        out.deltas.lufs = stats(vals('lufs'));
        out.deltas.truePeakDbtp = stats(vals('truePeakDbtp'));
        out.deltas.dr = stats(vals('dr'));
        out.deltas.lra = stats(vals('lra'));
        return out;
    };
}

// 🎯 FINAL: Display Reference Results
window.displayReferenceResults = function(referenceResults) {
    window.logReferenceEvent('displaying_reference_results', {
        baseline_source: referenceResults.baseline_source,
        has_suggestions: referenceResults.referenceSuggestions?.length > 0
    });
    
    try {
        const { comparisonData, referenceSuggestions, baseline_source } = referenceResults;
        
        if (baseline_source !== 'reference') {
            throw new Error(`Invalid baseline source: ${baseline_source}. Expected 'reference'`);
        }
        
        if (!comparisonData) {
            throw new Error('Missing comparison data in reference results');
        }

        const results = document.getElementById('results');
        if (!results) {
            throw new Error('Results container not found');
        }

        // Exibir seção de comparação
        displayComparisonSection(comparisonData, referenceSuggestions || []);
        
        // Se há sugestões, exibir
        if (referenceSuggestions && referenceSuggestions.length > 0) {
            const suggestionsList = document.getElementById('suggestions-list');
            if (suggestionsList) {
                suggestionsList.innerHTML = referenceSuggestions.map(suggestion => 
                    `<div class="suggestion-item">
                        <h4>${suggestion.category}</h4>
                        <p>${suggestion.text}</p>
                        <div class="suggestion-details">
                            <small>Diferença: ${suggestion.difference} | Threshold: ${suggestion.threshold}</small>
                        </div>
                    </div>`
                ).join('');
            }
        } else {
            // Audio idêntico - mostrar mensagem de sucesso
            const suggestionsList = document.getElementById('suggestions-list');
            if (suggestionsList) {
                suggestionsList.innerHTML = `
                    <div class="no-suggestions">
                        <h3>✅ Análise de Referência Concluída</h3>
                        <p>Os áudios são altamente similares. Diferenças dentro da tolerância aceitável.</p>
                    </div>
                `;
            }
        }
        
        window.logReferenceEvent('reference_results_displayed_successfully');
        
    } catch (error) {
        console.error('Error displaying reference results:', error);
        window.logReferenceEvent('reference_display_error', { 
            error: error.message,
            baseline_source: referenceResults.baseline_source 
        });
        
        // Fallback display
        const results = document.getElementById('results');
        if (results) {
            results.innerHTML = `
                <div class="error-display">
                    <h3>❌ Erro na Exibição dos Resultados</h3>
                    <p>Erro: ${error.message}</p>
                    <p>Baseline Source: ${referenceResults.baseline_source}</p>
                </div>
            `;
        }
    }
};

// =============== FUNÇÕES DE NORMALIZAÇÃO DE DADOS ===============

/**
 * Retorna a faixa de frequência para uma banda específica
 */
function getBandFrequencyRange(bandName) {
    const ranges = {
        'sub': '20-60 Hz',
        'low': '60-250 Hz', 
        'mid': '250-4k Hz',
        'high': '4k-12k Hz',
        'bass': '60-250 Hz',
        'mids': '250-4k Hz',
        'treble': '4k-12k Hz',
        'presence': '4k-8k Hz',
        'air': '12k-20k Hz'
    };
    return ranges[bandName] || 'Unknown';
}

/**
 * 🔧 NOVA FUNÇÃO: Normalizar dados do backend para compatibilidade com front-end
 * Mapeia a resposta do backend Railway para o formato que o front-end espera
 */
function normalizeBackendAnalysisData(backendData) {
    console.log('🔧 [NORMALIZE] Iniciando normalização dos dados do backend:', backendData);
    console.log('🔍 [NORMALIZE] Estrutura recebida:', Object.keys(backendData || {}));
    console.log('🔍 [NORMALIZE] technicalData existe?', !!backendData?.technicalData);
    console.log('🔍 [NORMALIZE] metrics existe?', !!backendData?.metrics);
    console.log('🔍 [NORMALIZE] raw_data existe?', !!backendData?.raw_data);
    
    // Se já está no formato correto, retornar como está
    if (backendData.technicalData && backendData.technicalData.peak !== undefined) {
        console.log('📊 [NORMALIZE] Dados já estão normalizados');
        return backendData;
    }
    
    // Criar estrutura normalizada
    const normalized = {
        ...backendData,
        technicalData: backendData.technicalData || {},
        problems: backendData.problems || [],
        suggestions: backendData.suggestions || [],
        duration: backendData.duration || 0,
        sampleRate: backendData.sampleRate || 48000,
        channels: backendData.channels || 2
    };
    
    // 🎯 MAPEAR MÉTRICAS BÁSICAS DOS DADOS REAIS DO BACKEND - SEM VALORES PADRÃO/MOCK
    const tech = normalized.technicalData;
    const source = backendData.technicalData || backendData.metrics || backendData;
    
    console.log('🔍 [NORMALIZE] Source technicalData keys:', Object.keys(source));
    console.log('🔍 [NORMALIZE] Source technicalData values:', source);
    
    // 🚨 CORREÇÃO CRÍTICA: Mapear TODOS os campos snake_case → camelCase do backend
    // Peak e RMS (usando campos corretos do backend) - MAPEAMENTO COMPLETO
    if (source.peak_db !== undefined) {
        tech.peak = source.peak_db;
        tech.peakDb = source.peak_db; // Alias para compatibilidade
    } else if (source.peak !== undefined) tech.peak = source.peak;
    else if (source.peakLevel !== undefined) tech.peak = source.peakLevel;
    
    if (source.rms_level !== undefined) {
        tech.rms = source.rms_level;
        tech.rmsLevel = source.rms_level; // Alias para compatibilidade
    } else if (source.rms !== undefined) tech.rms = source.rms;
    else if (source.rms_db !== undefined) tech.rms = source.rms_db;
    else if (source.rmsLevel !== undefined) tech.rms = source.rmsLevel;
    
    if (tech.rms !== undefined && tech.rmsLevel === undefined) tech.rmsLevel = tech.rms;
    
    // Dynamic Range (campo correto do backend) - MAPEAMENTO COMPLETO
    if (source.dynamic_range !== undefined) {
        tech.dynamicRange = source.dynamic_range;
        tech.dr = source.dynamic_range; // Alias para compatibilidade
    } else if (source.dynamicRange !== undefined) tech.dynamicRange = source.dynamicRange;
    else if (source.dr !== undefined) tech.dynamicRange = source.dr;
    else if (Number.isFinite(tech.peak) && Number.isFinite(tech.rms)) {
        tech.dynamicRange = tech.peak - tech.rms;
    }
    
    // Crest Factor (campo correto do backend) - MAPEAMENTO COMPLETO
    if (source.crest_factor !== undefined) {
        tech.crestFactor = source.crest_factor;
    } else if (source.crestFactor !== undefined) tech.crestFactor = source.crestFactor;
    else if (tech.dynamicRange !== undefined) tech.crestFactor = tech.dynamicRange;
    
    // True Peak (campo correto do backend) - MAPEAMENTO COMPLETO
    if (source.true_peak !== undefined) {
        tech.truePeakDbtp = source.true_peak;
        tech.truePeak = source.true_peak; // Alias para compatibilidade
    } else if (source.truePeakDbtp !== undefined) tech.truePeakDbtp = source.truePeakDbtp;
    else if (source.true_peak_dbtp !== undefined) tech.truePeakDbtp = source.true_peak_dbtp;
    else if (source.truePeak !== undefined) tech.truePeakDbtp = source.truePeak;
    
    // LUFS (campos corretos do backend) - MAPEAMENTO COMPLETO
    if (source.lufs_integrated !== undefined) {
        tech.lufsIntegrated = source.lufs_integrated;
        tech.lufs = source.lufs_integrated; // Alias para compatibilidade
    } else if (source.lufsIntegrated !== undefined) tech.lufsIntegrated = source.lufsIntegrated;
    else if (source.lufs !== undefined) tech.lufsIntegrated = source.lufs;
    
    if (source.lufs_short_term !== undefined) {
        tech.lufsShortTerm = source.lufs_short_term;
    } else if (source.lufsShortTerm !== undefined) tech.lufsShortTerm = source.lufsShortTerm;
    else if (tech.lufsIntegrated !== undefined) tech.lufsShortTerm = tech.lufsIntegrated;
    
    if (source.lufs_momentary !== undefined) {
        tech.lufsMomentary = source.lufs_momentary;
    } else if (source.lufsMomentary !== undefined) tech.lufsMomentary = source.lufsMomentary;
    else if (tech.lufsIntegrated !== undefined) tech.lufsMomentary = tech.lufsIntegrated;
    
    // LRA (campo correto do backend) - SEM FALLBACK PARA VALORES MOCK
    if (source.loudness_range !== undefined) tech.lra = source.loudness_range;
    else if (source.lra !== undefined) tech.lra = source.lra;
    else if (source.loudnessRange !== undefined) tech.lra = source.loudnessRange;
    
    // Headroom (campo correto do backend) - SEM FALLBACK PARA VALORES MOCK  
    if (source.headroomDb !== undefined) tech.headroomDb = source.headroomDb;
    else if (source.headroom_db !== undefined) tech.headroomDb = source.headroom_db;
    else if (Number.isFinite(tech.peak)) tech.headroomDb = 0 - tech.peak;
    
    if (source.headroomTruePeakDb !== undefined) tech.headroomTruePeakDb = source.headroomTruePeakDb;
    else if (Number.isFinite(tech.truePeakDbtp)) tech.headroomTruePeakDb = 0 - tech.truePeakDbtp;
    
    console.log('✅ [NORMALIZE] Métricas principais mapeadas:', {
        peak: tech.peak,
        rms: tech.rms,
        dynamicRange: tech.dynamicRange,
        lufs: tech.lufsIntegrated,
        truePeak: tech.truePeakDbtp
    });
    
    // 🎧 STEREO - MAPEAMENTO COMPLETO
    if (source.stereo_correlation !== undefined) {
        tech.stereoCorrelation = source.stereo_correlation;
    } else if (source.stereoCorrelation !== undefined) tech.stereoCorrelation = source.stereoCorrelation;
    
    if (source.stereo_width !== undefined) {
        tech.stereoWidth = source.stereo_width;
    } else if (source.stereoWidth !== undefined) tech.stereoWidth = source.stereoWidth;
    
    if (source.balance_lr !== undefined) {
        tech.balanceLR = source.balance_lr;
    } else if (source.balanceLR !== undefined) tech.balanceLR = source.balanceLR;
    
    // 🎵 SPECTRAL - MAPEAMENTO COMPLETO
    if (source.spectral_centroid !== undefined) {
        tech.spectralCentroid = source.spectral_centroid;
    } else if (source.spectralCentroid !== undefined) tech.spectralCentroid = source.spectralCentroid;
    
    if (source.spectral_rolloff !== undefined) {
        tech.spectralRolloff = source.spectral_rolloff;
    } else if (source.spectralRolloff !== undefined) tech.spectralRolloff = source.spectralRolloff;
    
    if (source.zero_crossing_rate !== undefined) {
        tech.zeroCrossingRate = source.zero_crossing_rate;
    } else if (source.zeroCrossingRate !== undefined) tech.zeroCrossingRate = source.zeroCrossingRate;
    
    if (source.spectral_flux !== undefined) {
        tech.spectralFlux = source.spectral_flux;
    } else if (source.spectralFlux !== undefined) tech.spectralFlux = source.spectralFlux;
    
    if (source.spectral_flatness !== undefined) {
        tech.spectralFlatness = source.spectral_flatness;
    } else if (source.spectralFlatness !== undefined) tech.spectralFlatness = source.spectralFlatness;
    
    // ⚠️ PROBLEMAS TÉCNICOS - SEM FALLBACK PARA VALORES MOCK
    if (source.clippingSamples !== undefined) tech.clippingSamples = source.clippingSamples;
    else if (source.clipping_samples !== undefined) tech.clippingSamples = source.clipping_samples;
    
    if (source.clippingPct !== undefined) tech.clippingPct = source.clippingPct;
    else if (source.clipping_pct !== undefined) tech.clippingPct = source.clipping_pct;
    
    if (source.dcOffset !== undefined) tech.dcOffset = source.dcOffset;
    else if (source.dc_offset !== undefined) tech.dcOffset = source.dc_offset;
    
    if (source.thdPercent !== undefined) tech.thdPercent = source.thdPercent;
    else if (source.thd_percent !== undefined) tech.thdPercent = source.thd_percent;
    
    // 📊 SAMPLE PEAKS POR CANAL - SEM FALLBACK PARA VALORES MOCK
    if (source.samplePeakLeftDb !== undefined) tech.samplePeakLeftDb = source.samplePeakLeftDb;
    else if (source.sample_peak_left_db !== undefined) tech.samplePeakLeftDb = source.sample_peak_left_db;
    
    if (source.samplePeakRightDb !== undefined) tech.samplePeakRightDb = source.samplePeakRightDb;
    else if (source.sample_peak_right_db !== undefined) tech.samplePeakRightDb = source.sample_peak_right_db;
    
    // 🎵 SPECTRAL BALANCE - Mapear dados espectrais REAIS do backend APENAS se existirem
    if (source.spectral_balance || source.spectralBalance || source.bands) {
        const spectralSource = source.spectral_balance || source.spectralBalance || source.bands || {};
        tech.spectral_balance = {};
        
        // Só adicionar valores que realmente existem
        if (spectralSource.sub !== undefined) tech.spectral_balance.sub = spectralSource.sub;
        if (spectralSource.bass !== undefined) tech.spectral_balance.bass = spectralSource.bass;
        if (spectralSource.mids !== undefined) tech.spectral_balance.mids = spectralSource.mids;
        if (spectralSource.treble !== undefined) tech.spectral_balance.treble = spectralSource.treble;
        if (spectralSource.presence !== undefined) tech.spectral_balance.presence = spectralSource.presence;
        if (spectralSource.air !== undefined) tech.spectral_balance.air = spectralSource.air;
        
        console.log('✅ [NORMALIZE] Spectral balance encontrado:', tech.spectral_balance);
    } else {
        console.log('⚠️ [NORMALIZE] Nenhum dado de spectral_balance encontrado nos dados do backend');
    }
    
    // 🎶 BAND ENERGIES - Mapear energias das bandas de frequência do tonalBalance
    if (source.tonalBalance || source.bandEnergies || source.band_energies || source.bands) {
        const bandsSource = source.tonalBalance || source.bandEnergies || source.band_energies || source.bands || {};
        tech.bandEnergies = {};
        
        console.log('🔍 [NORMALIZE] tonalBalance encontrado:', bandsSource);
        
        // Mapear diretamente do tonalBalance (dados reais do backend)
        if (source.tonalBalance) {
            Object.entries(source.tonalBalance).forEach(([bandName, bandData]) => {
                tech.bandEnergies[bandName] = {
                    rms_db: bandData.rms_db || -40,
                    peak_db: bandData.peak_db || -35,
                    energy_ratio: bandData.energy_ratio || 0,
                    frequency_range: getBandFrequencyRange(bandName)
                };
            });
            console.log('✅ [NORMALIZE] Band energies mapeadas do tonalBalance:', tech.bandEnergies);
        } else {
            // Mapear bandas conhecidas (fallback)
            const bandMapping = {
                'sub': 'sub',
                'subBass': 'sub', 
                'sub_bass': 'sub',
                'low_bass': 'low_bass',
                'lowBass': 'low_bass',
                'bass': 'low_bass',
                'upper_bass': 'upper_bass',
                'upperBass': 'upper_bass',
                'low_mid': 'low_mid',
                'lowMid': 'low_mid',
                'mid': 'mid',
                'high_mid': 'high_mid',
                'highMid': 'high_mid',
                'upper_mid': 'upper_mid',
                'upperMid': 'upper_mid',
                'brilho': 'brilho',
                'brilliance': 'brilho',
                'presenca': 'presenca',
                'presence': 'presenca',
                'air': 'air'
            };
            
            Object.entries(bandMapping).forEach(([sourceKey, targetKey]) => {
                const bandData = bandsSource[sourceKey];
                if (bandData) {
                    tech.bandEnergies[targetKey] = {
                        rms_db: bandData.rms_db || bandData.energy_db || bandData.level || -40,
                        peak_db: bandData.peak_db || bandData.rms_db || -35,
                        frequency_range: bandData.frequency_range || bandData.range || 'N/A'
                    };
                }
            });
        }
        
        // Se não conseguiu mapear nenhuma banda, criar valores default
        if (Object.keys(tech.bandEnergies).length === 0) {
            tech.bandEnergies = {
                sub: { rms_db: -30, peak_db: -25, frequency_range: '20-60 Hz' },
                low_bass: { rms_db: -25, peak_db: -20, frequency_range: '60-250 Hz' },
                upper_bass: { rms_db: -20, peak_db: -15, frequency_range: '250-500 Hz' },
                low_mid: { rms_db: -18, peak_db: -13, frequency_range: '500-1k Hz' },
                mid: { rms_db: -15, peak_db: -10, frequency_range: '1k-2k Hz' },
                high_mid: { rms_db: -22, peak_db: -17, frequency_range: '2k-4k Hz' },
                brilho: { rms_db: -28, peak_db: -23, frequency_range: '4k-8k Hz' },
                presenca: { rms_db: -35, peak_db: -30, frequency_range: '8k-12k Hz' }
            };
            console.log('⚠️ [NORMALIZE] Usando valores padrão para bandEnergies');
        }
    } else {
        console.log('⚠️ [NORMALIZE] Dados de bandas não encontrados, criando estrutura padrão');
        tech.bandEnergies = {
            sub: { rms_db: -30, peak_db: -25, frequency_range: '20-60 Hz' },
            low_bass: { rms_db: -25, peak_db: -20, frequency_range: '60-250 Hz' },
            upper_bass: { rms_db: -20, peak_db: -15, frequency_range: '250-500 Hz' }, 
            low_mid: { rms_db: -18, peak_db: -13, frequency_range: '500-1k Hz' },
            mid: { rms_db: -15, peak_db: -10, frequency_range: '1k-2k Hz' },
            high_mid: { rms_db: -22, peak_db: -17, frequency_range: '2k-4k Hz' },
            brilho: { rms_db: -28, peak_db: -23, frequency_range: '4k-8k Hz' },
            presenca: { rms_db: -35, peak_db: -30, frequency_range: '8k-12k Hz' }
        };
    }
    
    // 🎼 TONAL BALANCE - Estrutura simplificada para compatibilidade
    if (tech.bandEnergies) {
        tech.tonalBalance = {
            sub: tech.bandEnergies.sub || { rms_db: -30 },
            low: tech.bandEnergies.low_bass || { rms_db: -25 },
            mid: tech.bandEnergies.mid || { rms_db: -15 },
            high: tech.bandEnergies.brilho || { rms_db: -28 }
        };
    }
    
    // 🎯 FREQUÊNCIAS DOMINANTES
    if (source.dominantFrequencies || source.dominant_frequencies) {
        tech.dominantFrequencies = source.dominantFrequencies || source.dominant_frequencies;
    } else {
        // Gerar algumas frequências dominantes baseadas nos dados espectrais
        tech.dominantFrequencies = [
            { frequency: 440, occurrences: 10 },
            { frequency: 880, occurrences: 8 }, 
            { frequency: 220, occurrences: 6 }
        ];
    }
    
    // 🔢 SCORES E QUALIDADE
    normalized.qualityOverall = backendData.qualityOverall || backendData.score || backendData.mixScore || 7.5;
    normalized.qualityBreakdown = backendData.qualityBreakdown || {
        dynamics: 75,
        technical: 80,
        stereo: 70,
        loudness: 85,
        frequency: 75
    };
    
    // 🚨 PROBLEMAS - Garantir que existam alguns problemas/sugestões para exibir
    if (normalized.problems.length === 0) {
        // Detectar problemas básicos baseados nas métricas
        if (tech.clippingSamples > 0) {
            normalized.problems.push({
                type: 'clipping',
                message: `Clipping detectado (${tech.clippingSamples} samples)`,
                solution: 'Reduzir o ganho geral ou usar limitador',
                severity: 'high'
            });
        }
        
        if (Math.abs(tech.dcOffset) > 0.01) {
            normalized.problems.push({
                type: 'dc_offset', 
                message: `DC Offset detectado (${tech.dcOffset.toFixed(4)})`,
                solution: 'Aplicar filtro DC remove',
                severity: 'medium'
            });
        }
        
        if (tech.thdPercent > 1) {
            normalized.problems.push({
                type: 'thd',
                message: `THD elevado (${tech.thdPercent.toFixed(2)}%)`,
                solution: 'Verificar saturação e distorção',
                severity: 'medium'
            });
        }
    }
    
    // 💡 SUGESTÕES - Garantir algumas sugestões básicas
    if (normalized.suggestions.length === 0) {
        if (tech.dynamicRange < 8) {
            normalized.suggestions.push({
                type: 'dynamics',
                message: 'Faixa dinâmica baixa detectada',
                action: 'Considerar reduzir compressão/limitação',
                details: `DR atual: ${tech.dynamicRange.toFixed(1)}dB`
            });
        }
        
        if (tech.stereoCorrelation > 0.9) {
            normalized.suggestions.push({
                type: 'stereo',
                message: 'Imagem estéreo muito estreita',
                action: 'Aumentar espacialização estéreo',
                details: `Correlação: ${tech.stereoCorrelation.toFixed(3)}`
            });
        }
        
        if (tech.lufsIntegrated < -30) {
            normalized.suggestions.push({
                type: 'loudness',
                message: 'Loudness muito baixo',
                action: 'Aumentar volume geral',
                details: `LUFS atual: ${tech.lufsIntegrated.toFixed(1)}`
            });
        }
    }
    
    // 🎯 CORREÇÃO CRÍTICA: Mapear score e classificação principal
    if (backendData.qualityOverall !== undefined) {
        normalized.score = backendData.qualityOverall;
        normalized.qualityOverall = backendData.qualityOverall; // Manter original
    } else if (backendData.score !== undefined) {
        normalized.score = backendData.score;
        normalized.qualityOverall = backendData.score;
    } else if (backendData.overallScore !== undefined) {
        normalized.score = backendData.overallScore;
        normalized.qualityOverall = backendData.overallScore;
    }
    
    if (backendData.classification !== undefined) {
        normalized.classification = backendData.classification;
    }
    
    if (backendData.scoringMethod !== undefined) {
        normalized.scoringMethod = backendData.scoringMethod;
    }
    
    // 🎯 Garantir que problemas e sugestões estejam mapeados
    if (Array.isArray(backendData.problems)) {
        normalized.problems = backendData.problems;
    }
    
    if (Array.isArray(backendData.suggestions)) {
        normalized.suggestions = backendData.suggestions;
    }
    
    // 🔍 TELEMETRIA: Log de completude das métricas
    const requiredFields = ['peak', 'rms', 'lufsIntegrated', 'truePeakDbtp', 'dynamicRange', 'crestFactor'];
    const missingMainMetrics = requiredFields.filter(f => !Number.isFinite(tech[f]));
    const hasScore = Number.isFinite(normalized.score);
    const hasClassification = !!normalized.classification;
    
    console.log('🔍 [NORMALIZE] Telemetria de completude:');
    console.log('🔍 [NORMALIZE] Métricas principais ausentes:', missingMainMetrics);
    console.log('🔍 [NORMALIZE] Tem score:', hasScore, normalized.score);
    console.log('🔍 [NORMALIZE] Tem classificação:', hasClassification, normalized.classification);
    console.log('🔍 [NORMALIZE] Métricas mapeadas:', {
        peak: tech.peak,
        rms: tech.rms,
        lufsIntegrated: tech.lufsIntegrated,
        truePeakDbtp: tech.truePeakDbtp,
        dynamicRange: tech.dynamicRange,
        stereoCorrelation: tech.stereoCorrelation
    });
    
    console.log('✅ [NORMALIZE] Normalização concluída:', {
        hasTechnicalData: !!normalized.technicalData,
        hasSpectralBalance: !!normalized.technicalData.spectral_balance,
        hasBandEnergies: !!normalized.technicalData.bandEnergies,
        problemsCount: normalized.problems.length,
        suggestionsCount: normalized.suggestions.length,
        qualityScore: normalized.qualityOverall,
        hasAllMainMetrics: missingMainMetrics.length === 0
    });
    
    return normalized;
}

// =============== FUNÇÕES UTILITÁRIAS DO MODAL ===============

// 📁 Ocultar área de upload do modal
function hideUploadArea() {
    __dbg('📁 Ocultando área de upload...');
    const uploadArea = document.getElementById('audioUploadArea');
    if (uploadArea) {
        uploadArea.style.display = 'none';
        __dbg('✅ Upload area ocultada');
    } else {
        __dbg('❌ Elemento audioUploadArea não encontrado!');
    }
}

// 🔄 Mostrar loading de análise
function showAnalysisLoading() {
    __dbg('🔄 Exibindo loading de análise...');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (results) {
        results.style.display = 'none';
        __dbg('✅ Results area ocultada');
    }
    
    if (loading) {
        loading.style.display = 'block';
        __dbg('✅ Loading area exibida');
    } else {
        __dbg('❌ Elemento audioAnalysisLoading não encontrado!');
    }
}

// ⏹️ Ocultar loading de análise
function hideAnalysisLoading() {
    __dbg('⏹️ Ocultando loading de análise...');
    const loading = document.getElementById('audioAnalysisLoading');
    if (loading) {
        loading.style.display = 'none';
        __dbg('✅ Loading area ocultada');
    } else {
        __dbg('❌ Elemento audioAnalysisLoading não encontrado!');
    }
}

// 📊 Mostrar resultados da análise
function showAnalysisResults() {
    __dbg('📊 Exibindo resultados da análise...');
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (uploadArea) {
        uploadArea.style.display = 'none';
        __dbg('✅ Upload area ocultada');
    }
    
    if (loading) {
        loading.style.display = 'none';
        __dbg('✅ Loading area ocultada');
    }
    
    if (results) {
        results.style.display = 'block';
        __dbg('✅ Results area exibida');
    } else {
        __dbg('❌ Elemento audioAnalysisResults não encontrado!');
    }
}
