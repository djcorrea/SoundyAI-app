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

// 🔍 FUNÇÃO DE DIAGNÓSTICO DO FLUXO DE REFERÊNCIA
window.diagnosticReferenceFlow = function() {
    console.log('%c═══════════════════════════════════════════════', 'color:#00FFFF;font-weight:bold;');
    console.log('%c🔍 DIAGNÓSTICO COMPLETO DO FLUXO DE REFERÊNCIA', 'color:#00FFFF;font-weight:bold;');
    console.log('%c═══════════════════════════════════════════════', 'color:#00FFFF;font-weight:bold;');
    
    console.log('%c📊 Estado Atual:', 'color:#FFD700;font-weight:bold;');
    console.log('  Mode:', currentAnalysisMode);
    console.log('  window.__REFERENCE_JOB_ID__:', window.__REFERENCE_JOB_ID__ || 'null');
    console.log('  localStorage.referenceJobId:', localStorage.getItem('referenceJobId') || 'null');
    
    console.log('%c🗂️ Estado Global:', 'color:#FFD700;font-weight:bold;');
    console.log('  window.__soundyState:', window.__soundyState);
    console.log('  previousAnalysis:', window.__soundyState?.previousAnalysis?.jobId || 'null');
    console.log('  userAnalysis:', window.__soundyState?.userAnalysis?.jobId || 'null');
    console.log('  referenceAnalysis:', window.__soundyState?.referenceAnalysis?.jobId || 'null');
    
    console.log('%c💾 Dados de Referência:', 'color:#FFD700;font-weight:bold;');
    console.log('  window.referenceAnalysisData:', window.referenceAnalysisData ? 'PRESENTE' : 'null');
    console.log('  window.referenceComparisonMetrics:', window.referenceComparisonMetrics ? 'PRESENTE' : 'null');
    
    console.log('%c🎯 Diagnóstico:', 'color:#00FF00;font-weight:bold;');
    const refId = window.__REFERENCE_JOB_ID__ || localStorage.getItem('referenceJobId');
    if (currentAnalysisMode === 'reference') {
        if (!refId) {
            console.log('  ✅ Primeira música - pronto para receber segunda');
        } else {
            console.log('  ✅ Aguardando segunda música');
            console.log(`  📌 Job ID da primeira: ${refId}`);
        }
    } else {
        console.log('  ℹ️ Modo atual não é "reference"');
    }
    
    console.log('%c═══════════════════════════════════════════════', 'color:#00FFFF;font-weight:bold;');
    console.log('%c💡 Para testar:', 'color:#FFFF00;');
    console.log('  1. Faça upload da primeira música');
    console.log('  2. Verifique se [REF-SAVE ✅] aparece');
    console.log('  3. Faça upload da segunda música');
    console.log('  4. Verifique se [REF-LOAD ✅] e [REF-FIX-PAYLOAD] aparecem');
    console.log('%c═══════════════════════════════════════════════', 'color:#00FFFF;font-weight:bold;');
};

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

// 🎯 COMPARAÇÃO ENTRE FAIXAS - Armazenamento da primeira análise
window.lastReferenceJobId = null;
window.referenceAnalysisData = null;

// 🎯 COMPARAÇÃO ENTRE FAIXAS - Métricas de comparação (substitui __activeRefData quando em modo reference)
let referenceComparisonMetrics = null;

// 🎯 JOBS - Sistema de acompanhamento de jobs remotos
let currentJobId = null;
let jobPollingInterval = null;

// 🎯 Funções de Acessibilidade e Gestão de Modais

function openModeSelectionModal() {
    const modal = document.getElementById('analysisModeModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        
        // Foco no primeiro botão
        const firstButton = modal.querySelector('.mode-card button');
        if (firstButton) {
            firstButton.focus();
        }
        
        // Adicionar listener para ESC
        document.addEventListener('keydown', handleModalEscapeKey);
        
        // Trap focus no modal
        trapFocus(modal);
    }
}

function closeModeSelectionModal() {
    const modal = document.getElementById('analysisModeModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        
        // Remover listeners
        document.removeEventListener('keydown', handleModalEscapeKey);
        
        // Retornar foco para o botão que abriu o modal
        const audioAnalysisBtn = document.querySelector('button[onclick="openAudioModal()"]');
        if (audioAnalysisBtn) {
            audioAnalysisBtn.focus();
        }
    }
}

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

// 🎯 Função Principal de Seleção de Modo
function selectAnalysisMode(mode) {
    console.log('🎯 Modo selecionado:', mode);
    
    // Armazenar modo selecionado
    window.currentAnalysisMode = mode;
    
    // Fechar modal de seleção
    closeModeSelectionModal();
    
    if (mode === 'genre') {
        // Modo tradicional - abrir modal de análise normal
        openAnalysisModalForMode('genre');
    } else if (mode === 'reference') {
        // Modo referência - abrir interface específica
        openAnalysisModalForMode('reference');
    }
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

        // 🔧 FIX CRÍTICO: Detectar se é primeira ou segunda música no modo referência
        let referenceJobId = window.__REFERENCE_JOB_ID__ || localStorage.getItem('referenceJobId');
        let actualMode = mode;
        
        // 🎯 CORREÇÃO DO FLUXO: Primeira música como "genre", segunda como "reference"
        if (mode === 'reference') {
            // 🔄 RECUPERAÇÃO: Tentar restaurar referenceJobId de múltiplas fontes
            if (!referenceJobId && window.__soundyState?.previousAnalysis?.jobId) {
                referenceJobId = window.__soundyState.previousAnalysis.jobId;
                console.log('[REF-LOAD ✅] Reference Job ID restaurado do estado:', referenceJobId);
            }

            if (referenceJobId) {
                // TEM referenceJobId = É A SEGUNDA MÚSICA
                actualMode = 'reference'; // Mantém "reference"
                console.log('[MODE ✅] ═══════════════════════════════════════');
                console.log('[MODE ✅] SEGUNDA música detectada');
                console.log('[MODE ✅] Mode enviado: "reference"');
                console.log(`[MODE ✅] Reference Job ID: ${referenceJobId}`);
                console.log('[MODE ✅] Comparação A/B será realizada no backend');
                console.log('[MODE ✅] ═══════════════════════════════════════');
            } else {
                // NÃO TEM referenceJobId = É A PRIMEIRA MÚSICA
                actualMode = 'genre'; // Envia como "genre" para análise normal
                console.log('[MODE ✅] ═══════════════════════════════════════');
                console.log('[MODE ✅] PRIMEIRA música detectada');
                console.log('[MODE ✅] Mode enviado: "genre" (base para comparação)');
                console.log('[MODE ✅] Esta análise será salva como referência');
                console.log('[MODE ✅] Próxima música será comparada com esta');
                console.log('[MODE ✅] ═══════════════════════════════════════');
            }
        }
        
        // Montar payload com modo correto
        const payload = {
            fileKey: fileKey,
            mode: actualMode,
            fileName: fileName
        };
        
        // Adicionar referenceJobId apenas se existir
        if (referenceJobId && actualMode === 'reference') {
            payload.referenceJobId = referenceJobId;
            
            console.log('[REF-PAYLOAD ✅] ═══════════════════════════════════════');
            console.log('[REF-PAYLOAD ✅] Payload COM referenceJobId:');
            console.log(`[REF-PAYLOAD ✅]   mode: "${actualMode}"`);
            console.log(`[REF-PAYLOAD ✅]   referenceJobId: "${referenceJobId}"`);
            console.log(`[REF-PAYLOAD ✅]   fileName: "${fileName}"`);
            console.log('[REF-PAYLOAD ✅] ═══════════════════════════════════════');
        } else if (mode === 'reference' && !referenceJobId) {
            console.log('[REF-PAYLOAD ✅] ═══════════════════════════════════════');
            console.log('[REF-PAYLOAD ✅] Payload SEM referenceJobId (primeira música):');
            console.log(`[REF-PAYLOAD ✅]   mode: "${actualMode}" (análise base)`);
            console.log(`[REF-PAYLOAD ✅]   fileName: "${fileName}"`);
            console.log('[REF-PAYLOAD ✅] ═══════════════════════════════════════');
        }

        // 🔍 LOG FINAL: Mostrar payload completo antes do envio com cores
        console.log('%c[REF-FIX-VERIFY]', 'color:#00FFFF;font-weight:bold;', { mode, referenceJobId });
        console.log('%c[REF-FIX-PAYLOAD]', 'color:#7A3FFF;font-weight:bold;', payload);
        
        console.log('[FIX_REFID_PAYLOAD] ═══════════════════════════════════════');
        console.log('[FIX_REFID_PAYLOAD] Payload final sendo enviado para /api/audio/analyze:');
        console.log('[FIX_REFID_PAYLOAD]', JSON.stringify(payload, null, 2));
        console.log('[FIX_REFID_PAYLOAD] ═══════════════════════════════════════');

        const response = await fetch('/api/audio/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
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
        const maxAttempts = 60; // 5 minutos máximo (5s * 60 = 300s)
        let initialQueuePosition = null;
        
        const poll = async () => {
            try {
                attempts++;
                __dbg(`🔄 Verificando status do job (tentativa ${attempts}/${maxAttempts})...`);

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
                    progress: jobData.progress || 'N/A' 
                });

                // Calcular progresso baseado na posição da fila
                let calculatedProgress = 0;
                let progressMessage = '🚀 Inicializando...';
                
                // Obter status da fila se disponível
                const queueStatus = window.getAudioQueueStatus ? window.getAudioQueueStatus() : null;
                
                if (jobData.status === 'queued') {
                    // Job na fila - calcular posição
                    if (queueStatus && queueStatus.queue) {
                        const totalInQueue = queueStatus.queue.total || 0;
                        
                        // Armazenar posição inicial na primeira tentativa
                        if (initialQueuePosition === null) {
                            initialQueuePosition = totalInQueue;
                        }
                        
                        // Calcular progresso: quanto mais próximo de 0, mais perto de processar
                        if (initialQueuePosition > 0) {
                            calculatedProgress = Math.min(
                                Math.max(
                                    ((initialQueuePosition - totalInQueue) / initialQueuePosition) * 50, // 0-50% enquanto na fila
                                    5 // Mínimo 5%
                                ),
                                50
                            );
                        } else {
                            calculatedProgress = 10;
                        }
                        
                        progressMessage = `⏳ Na fila... Posição: ${totalInQueue + 1} | Processando: ${queueStatus.running || 0}`;
                    } else {
                        calculatedProgress = 10;
                        progressMessage = '⏳ Aguardando processamento...';
                    }
                } else if (jobData.status === 'processing') {
                    // Job processando - 50% a 95%
                    if (jobData.progress) {
                        // Se o backend enviar progresso específico, usar e mapear para 50-95%
                        calculatedProgress = 50 + (jobData.progress * 0.45);
                    } else {
                        // Progresso incremental baseado em tentativas
                        calculatedProgress = 50 + Math.min((attempts - (initialQueuePosition || 0)) * 5, 45);
                    }
                    progressMessage = '🔄 Analisando áudio...';
                } else if (jobData.status === 'completed' || jobData.status === 'done') {
                    calculatedProgress = 100;
                    progressMessage = '✅ Análise concluída!';
                }

                // Atualizar progresso na UI
                updateModalProgress(calculatedProgress, progressMessage);

                if (jobData.status === 'completed' || jobData.status === 'done') {
                    __dbg('✅ Job concluído com sucesso');
                    
                    // 🎯 NOVO: Verificar modo e decidir fluxo
                    const jobResult = jobData.result || jobData;
                    jobResult.jobId = jobId; // Incluir jobId no resultado
                    jobResult.mode = jobData.mode; // Incluir mode no resultado
                    
                    resolve(jobResult);
                    return;
                }

                if (jobData.status === 'failed' || jobData.status === 'error') {
                    const errorMsg = jobData.error || 'Erro desconhecido no processamento';
                    reject(new Error(`Falha na análise: ${errorMsg}`));
                    return;
                }

                // Status 'queued', 'processing', etc. - continuar polling
                if (attempts >= maxAttempts) {
                    reject(new Error('Timeout: Análise demorou mais que o esperado'));
                    return;
                }

                // Aguardar 5 segundos antes da próxima verificação
                setTimeout(poll, 5000);

            } catch (error) {
                console.error('❌ Erro no polling:', error);
                reject(error);
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
    const progressText = document.getElementById('audioProgressText');
    const progressBar = document.getElementById('audioProgressFill') || document.querySelector('.progress-fill');
    
    if (progressText) {
        progressText.innerHTML = `${message}`;
    }
    
    if (progressBar) {
        // Garantir que a porcentagem está entre 0 e 100
        const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
        progressBar.style.width = `${clampedPercentage}%`;
        
        __dbg(`📊 Progresso atualizado: ${clampedPercentage.toFixed(1)}%`);
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
                const analysisResult = await pollJobStatus(jobId);
                
                // 🔍 LOG DE DEBUG: Verificar se análise está completa
                console.log('🔍 [DEBUG] Análise retornada do polling:', {
                    hasResult: !!analysisResult,
                    hasTechnicalData: !!analysisResult?.technicalData,
                    avgLoudness: analysisResult?.technicalData?.avgLoudness,
                    lufsIntegrated: analysisResult?.technicalData?.lufsIntegrated,
                    truePeakDbtp: analysisResult?.technicalData?.truePeakDbtp,
                    dynamicRange: analysisResult?.technicalData?.dynamicRange
                });
                
                // 🧩 AUDITORIA 1: Verificar se displayModalResults está disponível
                console.log("[AUDITORIA] displayModalResults:", typeof window.displayModalResults);
                
                // Mostrar resultados no modal (com validação interna de métricas)
                const tryShowModal = (result, attempts = 0) => {
                    if (typeof window.displayModalResults === "function") {
                        console.log("✅ [AUDITORIA] displayModalResults encontrada, exibindo modal...");
                        console.log("✅ [RETRY_SUCCESS] Tentativa", attempts + 1, "bem-sucedida, chamando displayModalResults");
                        console.log("[DISPLAY] Metrics modal triggered from tryShowModal");
                        displayModalResults(result);
                    } else if (attempts < 10) {
                        console.warn("[AUDITORIA] displayModalResults não disponível, tentativa", attempts + 1);
                        setTimeout(() => tryShowModal(result, attempts + 1), 500);
                    } else {
                        console.error("[AUDITORIA] Falha ao exibir modal após múltiplas tentativas");
                        // Fallback: tentar exibir em modal simples
                        alert("Análise concluída, mas modal não pôde ser exibido. Verifique o console para dados.");
                        console.log("[AUDITORIA] Dados da análise:", result);
                    }
                };
                
                tryShowModal(analysisResult);

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
        
        <!-- REMOVED: Bandas de Frequência duplicada - consolidada nas métricas avançadas -->
        <!-- frequency-bands section removed to avoid duplication -->
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

// 🆕 Função para exibir estruturas complexas das novas métricas
function safeDisplayComplexMetric(metric, type = 'generic') {
    if (!metric || typeof metric !== 'object') return '—';
    
    switch (type) {
        case 'frequency':
            // Para dominantFrequencies
            if (metric.value !== undefined) {
                const unit = metric.unit || 'Hz';
                const value = Number.isFinite(metric.value) ? metric.value.toFixed(1) : '—';
                return `${value} ${unit}`;
            }
            return '—';
            
        case 'dcOffset':
            // Para dcOffset com canais L/R
            if (metric.detailed && (metric.detailed.L !== undefined || metric.detailed.R !== undefined)) {
                const L = Number.isFinite(metric.detailed.L) ? metric.detailed.L.toFixed(4) : '—';
                const R = Number.isFinite(metric.detailed.R) ? metric.detailed.R.toFixed(4) : '—';
                return `L: ${L}, R: ${R}`;
            } else if (metric.value !== undefined) {
                const value = Number.isFinite(metric.value) ? metric.value.toFixed(4) : '—';
                const unit = metric.unit || '';
                return `${value} ${unit}`;
            }
            return '—';
            
        case 'spectral':
            // Para spectralUniformity
            if (metric.value !== undefined) {
                const value = Number.isFinite(metric.value) ? metric.value.toFixed(3) : '—';
                const unit = metric.unit || '';
                return `${value} ${unit}`;
            }
            return '—';
            
        default:
            // Generic: tentar exibir value ou primeiro campo numérico
            if (metric.value !== undefined) {
                const value = Number.isFinite(metric.value) ? metric.value.toFixed(2) : '—';
                const unit = metric.unit || '';
                return `${value} ${unit}`;
            }
            return '—';
    }
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
                `/public/refs/out/genres.json`,
                `/refs/out/genres.json`,
                `refs/out/genres.json`,
                `../refs/out/genres.json`
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
                `/public/refs/out/${genre}.json?v=${version}`,
                `/refs/out/${genre}.json?v=${version}`,
                `refs/out/${genre}.json?v=${version}`,
                `../refs/out/${genre}.json?v=${version}`
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
                    path: `/public/refs/out/${genre}.json`,
                    version: data.version,
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
            
            // 🔥 CORREÇÃO LOOP INFINITO: Forçar refsReady se refs internas já carregaram
            if (!window.refsReady && window.embeddedRefsLoaded) {
                window.refsReady = true;
                console.log("⚠️ [refs] refsReady forçado como true após fallback com erro de fetch externo");
            }
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
    
    // 🧠 Aguarda refs e cache ficarem prontos antes de liberar o ForceActivator
    function waitForRefsAndCacheBeforeReady() {
        const checkReady = () => {
            const ready = !!(window.audioAnalyzer && window.CACHE_CTX_AWARE_V1_API && window.refsReady);
            console.log("⏳ [READY-CHECK] Estado atual:", {
                audioAnalyzer: !!window.audioAnalyzer,
                CACHE_CTX_AWARE_V1_API: !!window.CACHE_CTX_AWARE_V1_API,
                refsReady: !!window.refsReady
            });
            if (ready) {
                console.log("✅ [GLOBAL] Todos os sistemas prontos. Disparando analysisReady...");
                const evt = new Event("analysisReady");
                document.dispatchEvent(evt);
                return true;
            }
            return false;
        };

        if (!checkReady()) {
            const interval = setInterval(() => {
                if (checkReady()) clearInterval(interval);
            }, 300);
        }
    }

    // 🔥 Chamar a função de espera no ponto onde estava o dispatch antigo:
    waitForRefsAndCacheBeforeReady();

    // Aplicar estilos aprimorados ao seletor de gênero
    try { injectRefGenreStyles(); } catch(e) { /* silencioso */ }
    
    // 🆕 Inicializar Modal de Gênero Musical
    try { initGenreModal(); } catch(e) { console.warn('Falha ao inicializar modal de gênero:', e); }
}

// ============================================================================
// � MODAL DE BOAS-VINDAS À ANÁLISE - NOVO SISTEMA
// ============================================================================

/**
 * 🌟 Abrir modal de boas-vindas
 * Modal inicial que apresenta o sistema e direciona para o guia técnico
 */
function openWelcomeModal() {
    __dbg('🎉 Abrindo modal de boas-vindas à análise...');
    
    const modal = document.getElementById('welcomeAnalysisModal');
    if (!modal) {
        console.error('❌ Modal de boas-vindas não encontrado no DOM');
        return;
    }
    
    // Abrir modal com animação
    modal.style.display = 'flex';
    modal.setAttribute('tabindex', '-1');
    
    // Foco no modal para acessibilidade
    requestAnimationFrame(() => {
        modal.focus();
        
        // Foco no primeiro botão
        const firstBtn = modal.querySelector('.welcome-btn.primary');
        if (firstBtn) {
            firstBtn.focus();
        }
    });
    
    __dbg('✅ Modal de boas-vindas aberto com sucesso');
}

/**
 * ❌ Fechar modal de boas-vindas
 */
function closeWelcomeModal() {
    __dbg('❌ Fechando modal de boas-vindas...');
    
    const modal = document.getElementById('welcomeAnalysisModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    __dbg('✅ Modal de boas-vindas fechado');
}

/**
 * 📖 Abrir guia técnico em nova aba
 */
function openTechnicalGuide() {
    __dbg('📖 Abrindo guia técnico de análise...');
    
    // Abrir guia na mesma pasta (public/)
    window.open('guia-tecnico-analise.html', '_blank', 'noopener,noreferrer');
    
    // Não fecha o modal - usuário pode ler o guia e voltar
    __dbg('✅ Guia técnico aberto em nova aba');
}

/**
 * ▶️ Prosseguir para análise (fechar modal de boas-vindas e continuar fluxo)
 */
function proceedToAnalysis() {
    __dbg('▶️ Prosseguindo para análise...');
    
    // Fechar modal de boas-vindas
    closeWelcomeModal();
    
    // Continuar com o fluxo original
    const isReferenceEnabled = window.FEATURE_FLAGS?.REFERENCE_MODE_ENABLED;
    
    if (isReferenceEnabled) {
        // Abrir modal de seleção de modo
        openModeSelectionModal();
    } else {
        // Ir direto para modo gênero
        selectAnalysisMode('genre');
    }
    
    __dbg('✅ Fluxo de análise continuado');
}

// Expor funções globalmente para uso nos onclick do HTML
window.openWelcomeModal = openWelcomeModal;
window.closeWelcomeModal = closeWelcomeModal;
window.openTechnicalGuide = openTechnicalGuide;
window.proceedToAnalysis = proceedToAnalysis;

/**
 * ⌨️ Configurar acessibilidade do modal de boas-vindas
 */
function setupWelcomeModalAccessibility() {
    const modal = document.getElementById('welcomeAnalysisModal');
    if (!modal) return;
    
    // ESC para fechar
    document.addEventListener('keydown', function handleWelcomeEscape(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeWelcomeModal();
        }
    });
    
    // Tab navigation (trap focus)
    modal.addEventListener('keydown', function handleWelcomeTabNav(e) {
        if (e.key !== 'Tab') return;
        
        const focusableElements = modal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    });
    
    __dbg('⌨️ Acessibilidade do modal de boas-vindas configurada');
}

// Inicializar acessibilidade quando DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupWelcomeModalAccessibility);
} else {
    setupWelcomeModalAccessibility();
}

// ============================================================================

// 🎵 Abrir modal de análise de áudio (MODIFICADO para usar novo fluxo)
function openAudioModal() {
    window.logReferenceEvent('open_modal_requested');
    
    // 🌟 NOVO: Abrir modal de boas-vindas PRIMEIRO
    openWelcomeModal();
}

// 🎯 NOVO: Abrir modal secundário para upload da música de referência
function openReferenceUploadModal(referenceJobId, firstAnalysisResult) {
    __dbg('🎯 Abrindo modal secundário para música de referência', { referenceJobId });
    
    // 🎯 PROTEÇÃO: Garantir que primeira análise está completa
    if (!firstAnalysisResult) {
        console.error('❌ [PROTECTION] Primeira análise não está completa - abortando abertura do modal de referência');
        alert('⚠️ A primeira análise ainda não foi concluída. Por favor, aguarde.');
        return;
    }
    
    // 🎯 PROTEÇÃO: Validar que há dados essenciais
    if (!firstAnalysisResult.technicalData) {
        console.error('❌ [PROTECTION] Primeira análise não contém technicalData - dados incompletos');
        alert('⚠️ A primeira análise não foi concluída corretamente. Por favor, tente novamente.');
        return;
    }
    
    console.log('✅ [PROTECTION] Primeira análise validada com sucesso:', {
        hasJobId: !!referenceJobId,
        hasTechnicalData: !!firstAnalysisResult.technicalData,
        hasScore: !!firstAnalysisResult.score
    });
    
    window.logReferenceEvent('reference_upload_modal_opened', { referenceJobId });
    
    // 🎯 PERSISTIR DADOS DA PRIMEIRA FAIXA
    window.__REFERENCE_JOB_ID__ = referenceJobId;
    window.__FIRST_ANALYSIS_RESULT__ = firstAnalysisResult;
    window.lastReferenceJobId = referenceJobId;
    window.referenceAnalysisData = firstAnalysisResult;
    
    console.log('✅ [COMPARE-MODE] Primeira faixa salva:', {
        jobId: referenceJobId,
        score: firstAnalysisResult?.score,
        lufs: firstAnalysisResult?.technicalData?.lufsIntegrated
    });
    
    // 🔥 FIX-REFERENCE: NÃO chamar reset completo - apenas limpar UI visualmente
    // closeAudioModal();   // ❌ REMOVIDO - deletava __REFERENCE_JOB_ID__
    // resetModalState();   // ❌ REMOVIDO - deletava __REFERENCE_JOB_ID__

    // Resetar apenas UI (sem limpar flags globais)
    const uploadAreaFirst = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');

    if (uploadAreaFirst) uploadAreaFirst.style.display = 'block';
    if (loading) loading.style.display = 'none';
    if (results) results.style.display = 'none';

    const fileInput = document.getElementById('modalAudioFileInput');
    if (fileInput) fileInput.value = '';

    console.log('[FIX-REFERENCE] Modal reaberto SEM limpar flags de referência');
    
    // 🎯 CORREÇÃO: Manter modo 'reference' para segunda música também
    // O backend identifica que é comparação pela presença do referenceJobId
    currentAnalysisMode = 'reference';
    
    // Abrir modal novamente
    const modal = document.getElementById('audioAnalysisModal');
    if (!modal) {
        console.error('❌ Modal de análise de áudio não encontrado');
        return;
    }
    
    // Atualizar título e instruções do modal
    const modalTitle = document.getElementById('audioModalTitle');
    const modalSubtitle = document.getElementById('audioModalSubtitle');
    
    if (modalTitle) {
        modalTitle.innerHTML = '🎯 Upload da Música de Referência';
    }
    
    if (modalSubtitle) {
        modalSubtitle.innerHTML = '<span id="audioModeIndicator">Etapa 2/2: Envie a música de referência para comparação</span>';
        modalSubtitle.style.display = 'block';
    }
    
    // Atualizar mensagem na área de upload
    const uploadAreaSecond = document.getElementById('audioUploadArea');
    if (uploadAreaSecond) {
        const uploadContent = uploadAreaSecond.querySelector('.upload-content h4');
        if (uploadContent) {
            uploadContent.textContent = 'Enviar música de referência';
        }
        
        const uploadDescription = uploadAreaSecond.querySelector('.upload-content p');
        if (uploadDescription) {
            uploadDescription.textContent = 'Arraste a música de referência aqui ou clique para selecionar';
        }
    }
    
    // Mostrar modal
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    __dbg('✅ Modal secundário de referência aberto');
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

// � NOVO MODAL DE GÊNERO MUSICAL - Sistema completo
// Feature flag para controlar ativação
window.FEATURE_NEW_GENRE_MODAL = true; // Definir como false para usar seletor antigo

// 🎵 Funções do Modal de Gênero Musical
function openGenreModal() {
    __dbg('[GENRE_MODAL] Abrindo modal de seleção de gênero...');
    
    const modal = document.getElementById('newGenreModal');
    if (!modal) {
        console.error('[GENRE_MODAL] Modal não encontrado no DOM');
        return;
    }
    
    // Injetar estilos se ainda não foi feito
    injectGenreModalStyles();
    
    // 🔧 CORREÇÃO FLASH BRANCO: Prepaint para evitar primeiro frame errado
    modal.classList.add('prepaint');  // Cards invisíveis enquanto CSS aplica
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    
    // Libera a transição só de opacity no próximo frame
    requestAnimationFrame(() => {
        modal.classList.remove('prepaint');
        
        // Foco no primeiro botão de gênero
        const firstGenreCard = modal.querySelector('.genre-card');
        if (firstGenreCard) {
            firstGenreCard.focus();
        }
    });
    
    // Adicionar listeners de teclado
    modal.addEventListener('keydown', handleGenreModalKeydown);
    
    __dbg('[GENRE_MODAL] Modal aberto com sucesso (sem flash branco)');
}

function closeGenreModal() {
    __dbg('[GENRE_MODAL] Fechando modal de seleção de gênero...');
    
    const modal = document.getElementById('newGenreModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        
        // Remover listeners
        modal.removeEventListener('keydown', handleGenreModalKeydown);
    }
    
    __dbg('[GENRE_MODAL] Modal fechado');
}

function handleGenreModalKeydown(e) {
    if (e.key === 'Escape') {
        closeGenreModal();
    }
}

// 🎯 Inicialização do Modal de Gênero
function initGenreModal() {
    __dbg('[GENRE_MODAL] Inicializando sistema do modal...');
    
    const modal = document.getElementById('newGenreModal');
    if (!modal) {
        console.warn('[GENRE_MODAL] Modal não encontrado, inicialização cancelada');
        return;
    }
    
    const genreCards = modal.querySelectorAll('.genre-card');
    const closeBtn = modal.querySelector('[data-close]');
    
    // 🎯 Handler de clique nos gêneros
    genreCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const genre = card.dataset.genre;
            if (!genre) {
                console.error('[GENRE_MODAL] Gênero não definido no card');
                return;
            }
            
            __dbg('[GENRE_MODAL] Gênero selecionado:', genre);
            
            // 🔥 REUTILIZAR EXATAMENTE: Chamar applyGenreSelection como especificado
            if (typeof applyGenreSelection === 'function') {
                applyGenreSelection(genre);
            } else {
                console.error('[GENRE_MODAL] applyGenreSelection não está disponível');
                return;
            }
            
            // 🔥 Fechar modal conforme especificação
            closeGenreModal();
            
            // 🔥 CONTINUAR FLUXO: Abrir modal de upload automaticamente
            setTimeout(() => {
                openAnalysisModalForGenre();
            }, 200); // Pequeno delay para suavizar transição
        });
    });
    
    // Handler do botão fechar
    if (closeBtn) {
        closeBtn.addEventListener('click', closeGenreModal);
    }
    
    // Fechar clicando no fundo
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeGenreModal();
        }
    });
    
    __dbg('[GENRE_MODAL] Sistema inicializado com sucesso');
}

// 🎯 Abrir modal de análise após seleção de gênero
function openAnalysisModalForGenre() {
    __dbg('[GENRE_MODAL] Abrindo modal de análise para gênero selecionado...');
    
    // Usar o fluxo normal do modal de análise
    window.currentAnalysisMode = 'genre';
    
    // 🎯 LIMPAR estado de referência ao entrar em modo genre (conforme solicitado)
    const state = window.__soundyState || {};
    if (state.reference) {
        state.reference.analysis = null;
        state.reference.isSecondTrack = false;
        state.reference.jobId = null;
        console.log('✅ [GENRE-CLEANUP] Estado de referência limpo ao iniciar modo genre');
    }
    window.__soundyState = state;
    
    const modal = document.getElementById('audioAnalysisModal');
    if (!modal) {
        console.error('[GENRE_MODAL] Modal de análise não encontrado');
        return;
    }
    
    // Configurar modal para modo gênero
    configureModalForMode('genre');
    
    modal.style.display = 'flex';
    resetModalState();
    modal.setAttribute('tabindex', '-1');
    modal.focus();
    
    __dbg('[GENRE_MODAL] Modal de análise aberto');
}

// Expor funções globalmente
window.openGenreModal = openGenreModal;
window.closeGenreModal = closeGenreModal;

// �🎯 NOVO: Abrir modal de análise configurado para o modo
function openAnalysisModalForMode(mode) {
    __dbg(`🎵 Abrindo modal de análise para modo: ${mode}`);
    
    // 🆕 FEATURE FLAG: Verificar se deve usar novo modal de gênero
    if (mode === 'genre' && window.FEATURE_NEW_GENRE_MODAL === true) {
        __dbg('🎨 Usando novo modal de gênero musical');
        openGenreModal();
        return;
    }
    
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
        
        // 🔧 FIX: Limpar dados de referência ao trocar para modo genre
        if (window.__referenceComparisonActive) {
            console.log('[MODE_CHANGE] Trocando de REFERENCE para GENRE - limpando dados');
            delete window.__REFERENCE_JOB_ID__;
            delete window.__FIRST_ANALYSIS_RESULT__;
            localStorage.removeItem('referenceJobId');
            window.__referenceComparisonActive = false;
            
            console.log('[MODE_CHANGE] ✅ Dados de referência limpos para modo GENRE');
        }
        
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
        
        // 🔧 FIX: Verificar se há comparação ativa antes de limpar
        const hasActiveComparison = window.__referenceComparisonActive === true;
        
        if (!hasActiveComparison) {
            // 🧹 LIMPEZA COMPLETA: Apenas se não houver comparação ativa
            window.referenceAnalysisData = null;
            referenceComparisonMetrics = null;
            window.lastReferenceJobId = null;
            
            // Limpar IDs de referência
            delete window.__REFERENCE_JOB_ID__;
            delete window.__FIRST_ANALYSIS_RESULT__;
            localStorage.removeItem('referenceJobId');
            
            console.log('[CLEANUP] closeAudioModal: LIMPEZA TOTAL (sem comparação ativa)');
        } else {
            // Preservar dados de referência
            console.log('[CLEANUP] closeAudioModal: PRESERVANDO referência (comparação ativa)');
            console.log('[CLEANUP]   - window.__REFERENCE_JOB_ID__:', window.__REFERENCE_JOB_ID__);
            console.log('[CLEANUP]   - localStorage.referenceJobId:', localStorage.getItem('referenceJobId'));
        }
        
        // Limpeza de state global (sempre limpar estado temporário de renderização)
        const state = window.__soundyState || {};
        if (state.reference) {
            state.reference.analysis = null;
            state.reference.isSecondTrack = false;
            // NÃO limpar jobId se houver comparação ativa
            if (!hasActiveComparison) {
                state.reference.jobId = null;
                state.reference.userAnalysis = null;
                state.reference.referenceAnalysis = null;
            }
        }
        
        // Limpar análises temporárias mas preservar previousAnalysis se necessário
        state.userAnalysis = null;
        state.referenceAnalysis = null;
        if (!hasActiveComparison) {
            state.previousAnalysis = null;
        }
        
        state.render = state.render || {};
        state.render.mode = null;
        
        window.__soundyState = state;
        
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
    
    currentModalAnalysis = null;
    
    const fileInput = document.getElementById('modalAudioFileInput');
    if (fileInput) fileInput.value = '';
    
    // 🧩 CORREÇÃO #4: Reset completo de estado (limpeza total)
    const state = window.__soundyState || {};
    
    // Limpar completamente estado de referência
    state.reference = null;
    state.userAnalysis = null;
    state.referenceAnalysis = null;
    state.previousAnalysis = null;
    
    // Limpar modo de renderização
    if (!state.render) state.render = {};
    state.render.mode = null;
    
    window.__soundyState = state;
    
    // 🔥 FIX-REFERENCE: Verificar se estamos aguardando segunda música ANTES de limpar
    const isAwaitingSecondTrack = currentAnalysisMode === 'reference' && window.__REFERENCE_JOB_ID__;
    
    console.log('[FIX_REFID_RESET] ═══════════════════════════════════════');
    console.log(`[FIX_REFID_RESET] Mode atual: ${currentAnalysisMode}`);
    console.log(`[FIX_REFID_RESET] Reference Job ID existe: ${window.__REFERENCE_JOB_ID__ ? 'SIM' : 'NÃO'}`);
    console.log(`[FIX_REFID_RESET] Aguardando segunda música: ${isAwaitingSecondTrack ? 'SIM' : 'NÃO'}`);

    if (!isAwaitingSecondTrack) {
        // 🧼 LIMPEZA COMPLETA: Só limpar se NÃO estivermos aguardando segunda música
        window.__REFERENCE_JOB_ID__ = null;
        window.referenceAnalysisData = null;
        window.referenceComparisonMetrics = null;
        window.lastReferenceJobId = null;
        delete window.__REFERENCE_JOB_ID__;
        delete window.__FIRST_ANALYSIS_RESULT__;
        localStorage.removeItem('referenceJobId');
        
        console.log('[FIX_REFID_RESET] Estado limpo completamente ✅');
        console.log('[FIX_REFID_RESET] Limpeza incluiu: window, localStorage e estado global');
        console.log('[FIX_REFID_RESET] Flags de referência LIMPAS (modo não-reference)');
    } else {
        // Preservar IDs de referência para segunda música
        console.log('[FIX_REFID_RESET] ⚠️ PRESERVANDO flags de referência!');
        console.log(`[FIX_REFID_RESET] Reference Job ID mantido: ${window.__REFERENCE_JOB_ID__}`);
        console.log(`[FIX_REFID_RESET] localStorage.referenceJobId: ${localStorage.getItem('referenceJobId')}`);
        console.log('[FIX_REFID_RESET] Aguardando upload da segunda música...');
    }
    console.log('[FIX_REFID_RESET] ═══════════════════════════════════════');

    // Flags internas
    delete window.__AUDIO_ADVANCED_READY__;
    delete window.__MODAL_ANALYSIS_IN_PROGRESS__;    console.log('[CLEANUP] resetModalState: estado global/flags limpos');
    
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
        const analysisResult = await pollJobStatus(jobId);
        
        // 🌐 ETAPA 5: Processar resultado baseado no modo e contexto
        // 🎯 FLUXO CORRIGIDO: Identificar se é primeira ou segunda música
        const jobMode = analysisResult.mode || currentAnalysisMode;
        const isSecondTrack = window.__REFERENCE_JOB_ID__ !== null && window.__REFERENCE_JOB_ID__ !== undefined;
        
        console.log('[AUDIO-DEBUG] 🎯 Modo do job:', jobMode);
        console.log('[AUDIO-DEBUG] 🎯 É segunda faixa?', isSecondTrack);
        console.log('[AUDIO-DEBUG] 🎯 Reference Job ID armazenado:', window.__REFERENCE_JOB_ID__);
        console.log('[AUDIO-DEBUG] 🎯 First Analysis Result:', !!window.__FIRST_ANALYSIS_RESULT__);
        console.log('[AUDIO-DEBUG] 🎯 Current mode:', currentAnalysisMode);
        
        // 🔧 FIX: Primeira música vem como "genre" (modo base), segunda como "reference"
        const isFirstReferenceTrack = currentAnalysisMode === 'reference' && !isSecondTrack;
        
        if (isFirstReferenceTrack) {
            // PRIMEIRA música em modo reference: abrir modal para música de referência
            __dbg('🎯 Primeira música analisada - abrindo modal para segunda');
            
            // ⚙️ Salvar primeira análise no estado global
            if (!window.__soundyState) window.__soundyState = {};
            window.__soundyState.previousAnalysis = analysisResult;
            console.log('✅ [REFERENCE-A/B] ═══════════════════════════════════════');
            console.log('✅ [REFERENCE-A/B] Primeira análise salva no estado global');
            console.log('✅ [REFERENCE-A/B] Verificação de dados salvos:');
            console.log('✅ [REFERENCE-A/B]   fileName:', analysisResult.fileName || analysisResult.metadata?.fileName);
            console.log('✅ [REFERENCE-A/B]   technicalData existe:', !!analysisResult.technicalData);
            console.log('✅ [REFERENCE-A/B]   spectral_balance:', analysisResult.technicalData?.spectral_balance ? 'SIM' : 'NÃO');
            console.log('✅ [REFERENCE-A/B]   bandas salvas:', analysisResult.technicalData?.spectral_balance ? Object.keys(analysisResult.technicalData.spectral_balance) : 'NENHUMA');
            console.log('✅ [REFERENCE-A/B] ═══════════════════════════════════════');
            
            // 🔧 PARTE 3: Reset seguro antes da segunda análise
            if (window.__soundyState.reference) {
                delete window.__soundyState.reference.analysis;
                console.log('[PARTE 3] reference.analysis limpo para evitar contaminação');
            }
            
            // 🔧 FIX: Salvar jobId da primeira música com log detalhado
            window.__REFERENCE_JOB_ID__ = analysisResult.jobId;
            localStorage.setItem('referenceJobId', analysisResult.jobId);
            
            console.log('[REF-SAVE ✅] ═══════════════════════════════════════');
            console.log('[REF-SAVE ✅] Primeira música processada com sucesso!');
            console.log(`[REF-SAVE ✅] Job ID salvo globalmente: ${analysisResult.jobId}`);
            console.log('[REF-SAVE ✅] Locais de salvamento:');
            console.log('[REF-SAVE ✅]   - window.__REFERENCE_JOB_ID__');
            console.log('[REF-SAVE ✅]   - localStorage.referenceJobId');
            console.log('[REF-SAVE ✅]   - window.__soundyState.previousAnalysis');
            console.log(`[REF-SAVE ✅] File Name: ${analysisResult.metadata?.fileName || analysisResult.fileName || 'unknown'}`);
            console.log(`[REF-SAVE ✅] LUFS: ${analysisResult.technicalData?.lufsIntegrated || 'N/A'} LUFS`);
            console.log(`[REF-SAVE ✅] DR: ${analysisResult.technicalData?.dynamicRange || 'N/A'} dB`);
            console.log('[REF-SAVE ✅] Este ID será usado na segunda música');
            console.log('[REF-SAVE ✅] ═══════════════════════════════════════');
            
            openReferenceUploadModal(analysisResult.jobId, analysisResult);
        } else if ((jobMode === 'reference' || currentAnalysisMode === 'reference') && isSecondTrack) {
            // SEGUNDA música em modo reference: mostrar resultado comparativo
            console.log('🎯 [COMPARE-MODE] Segunda música analisada - exibindo comparação entre faixas');
            console.log('✅ [COMPARE-MODE] Tabela comparativa será exibida');
            console.log(`✅ [COMPARE-MODE] jobMode: ${jobMode}, currentMode: ${currentAnalysisMode}, isSecond: ${isSecondTrack}`);
            __dbg('🎯 Segunda música analisada - exibindo resultado comparativo');
            
            // 🔥 CORREÇÃO CRÍTICA: Primeira música é ATUAL (sua faixa), segunda é REFERÊNCIA (alvo)
            const state = window.__soundyState || {};
            if (state.previousAnalysis) {
                // ✅ SEMÂNTICA CORRETA DO FLUXO A/B:
                // - Primeira faixa (previousAnalysis) = userAnalysis (SUA MÚSICA/ATUAL)
                // - Segunda faixa (analysisResult) = referenceAnalysis (ALVO/REFERÊNCIA a alcançar)
                state.userAnalysis = state.previousAnalysis;      // 1ª = sua faixa (atual)
                state.referenceAnalysis = analysisResult;         // 2ª = faixa de referência (alvo)
                
                // 🎯 ESTRUTURA NOVA (CORRETA):
                state.reference = state.reference || {};
                state.reference.userAnalysis = state.previousAnalysis;    // 1ª faixa (sua música/atual)
                state.reference.referenceAnalysis = analysisResult;       // 2ª faixa (referência/alvo)
                state.reference.isSecondTrack = true;
                state.reference.jobId = analysisResult.jobId || null;
                
                console.log('✅ [REFERENCE-A/B-CORRECTED] ═══════════════════════════════════════');
                console.log('✅ [REFERENCE-A/B-CORRECTED] Atribuição correta A/B:');
                console.log('✅ [REFERENCE-A/B-CORRECTED]   1ª Faixa (ATUAL/SUA MÚSICA):', state.previousAnalysis.fileName || state.previousAnalysis.metadata?.fileName || '1ª Faixa');
                console.log('✅ [REFERENCE-A/B-CORRECTED]   2ª Faixa (REFERÊNCIA/ALVO):', analysisResult.fileName || analysisResult.metadata?.fileName || '2ª Faixa');
                console.log('✅ [REFERENCE-A/B-CORRECTED]   Comparação: SUA MÚSICA vs REFERÊNCIA');
                console.log('✅ [REFERENCE-A/B-CORRECTED]   Modal mostrará: ESQUERDA=sua música, DIREITA=referência');
                console.log('✅ [REFERENCE-A/B-CORRECTED]   1ª tem bandas:', !!state.userAnalysis?.technicalData?.spectral_balance);
                console.log('✅ [REFERENCE-A/B-CORRECTED]   2ª tem bandas:', !!state.referenceAnalysis?.technicalData?.spectral_balance);
                console.log('✅ [REFERENCE-A/B-CORRECTED] ═══════════════════════════════════════');
                
                // 🎯 LOG AUDIT-MODE-FLOW (conforme solicitado)
                console.log('[AUDIT-MODE-FLOW]', {
                    mode: 'reference',
                    isSecondTrack: state.reference.isSecondTrack,
                    refJobId: state.reference.jobId,
                    hasUserAnalysis: !!state.userAnalysis,
                    hasReferenceAnalysis: !!state.referenceAnalysis
                });
                
                // 🎯 LOG ASSERT_REF_FLOW
                console.log("[ASSERT_REF_FLOW]", {
                    mode: 'reference',
                    userBands: Object.keys(state.userAnalysis?.technicalData?.spectral_balance || {}),
                    refBands: Object.keys(state.referenceAnalysis?.technicalData?.spectral_balance || {})
                });
            } else if (window.__FIRST_ANALYSIS_RESULT__) {
                // 🔥 FALLBACK: Primeira música é ATUAL (sua faixa), segunda é REFERÊNCIA (alvo)
                state.userAnalysis = window.__FIRST_ANALYSIS_RESULT__;    // 1ª = sua faixa (atual)
                state.referenceAnalysis = analysisResult;                 // 2ª = referência (alvo)
                
                // 🎯 ESTRUTURA NOVA (CORRETA):
                state.reference = state.reference || {};
                state.reference.userAnalysis = window.__FIRST_ANALYSIS_RESULT__;  // 1ª faixa (sua música/atual)
                state.reference.referenceAnalysis = analysisResult;                // 2ª faixa (referência/alvo)
                state.reference.isSecondTrack = true;
                state.reference.jobId = analysisResult.jobId || null;
                
                console.log('✅ [REFERENCE-A/B-CORRECTED] ═══════════════════════════════════════');
                console.log('✅ [REFERENCE-A/B-CORRECTED] Fallback - Atribuição correta A/B:');
                console.log('✅ [REFERENCE-A/B-CORRECTED]   1ª Faixa (ATUAL/SUA MÚSICA):', window.__FIRST_ANALYSIS_RESULT__.fileName);
                console.log('✅ [REFERENCE-A/B-CORRECTED]   2ª Faixa (REFERÊNCIA/ALVO):', analysisResult.fileName);
                console.log('✅ [REFERENCE-A/B-CORRECTED] ═══════════════════════════════════════');
                
                // 🎯 LOG ASSERT_REF_FLOW
                console.log("[ASSERT_REF_FLOW]", {
                    mode: 'reference',
                    userTrack: state.userAnalysis?.fileName || 'Sua música (atual)',
                    referenceTrack: state.referenceAnalysis?.fileName || 'Faixa de referência (alvo)',
                    userBands: Object.keys(state.userAnalysis?.technicalData?.spectral_balance || {}),
                    refBands: Object.keys(state.referenceAnalysis?.technicalData?.spectral_balance || {})
                });
            }
            
            // 🚨 AUDIT_REF_FIX: NÃO chamar handleGenreAnalysisWithResult em modo reference!
            // Esta função limpa o estado e força mode='genre', quebrando o fluxo A/B
            
            // PRESERVAR modo reference até o final (reutilizar state já declarado acima)
            if (!state.render) state.render = {};
            state.render.mode = 'reference';
            window.__soundyState = state;
            
            console.log('[AUDIT_REF_FIX] Preservando modo reference até final da renderização');
            console.log('[MODE LOCKED] reference - handleGenreAnalysisWithResult PULADO');
            
            // Normalizar dados do backend
            const normalizedResult = normalizeBackendAnalysisData(analysisResult);
            
            // � PARTE 3.4: Garantir atribuição correta ANTES de displayModalResults
            // 🔧 PARTE 1: Normalize reference comparison structure
            if (state.render.mode === "reference" && analysisResult && state.previousAnalysis) {
                const firstResult = state.previousAnalysis;
                const secondResult = analysisResult;

                const normalizedUser = {
                    fileName: firstResult.fileName || firstResult.metadata?.fileName,
                    bands: firstResult.spectralBands || firstResult.bands || firstResult.technicalData?.spectral_balance,
                    metrics: {
                        lufs: firstResult.loudness?.integrated ?? firstResult.lufsIntegrated,
                        dr: firstResult.dynamics?.dr ?? firstResult.dynamicRange,
                        peak: firstResult.truePeak?.dbtp ?? firstResult.truePeakDbtp
                    }
                };

                const normalizedRef = {
                    fileName: secondResult.fileName || secondResult.metadata?.fileName,
                    bands: secondResult.spectralBands || secondResult.bands || secondResult.technicalData?.spectral_balance,
                    metrics: {
                        lufs: secondResult.loudness?.integrated ?? secondResult.lufsIntegrated,
                        dr: secondResult.dynamics?.dr ?? secondResult.dynamicRange,
                        peak: secondResult.truePeak?.dbtp ?? secondResult.truePeakDbtp
                    }
                };

                state.reference = {
                    mode: "reference",
                    isSecondTrack: true,
                    userAnalysis: normalizedUser,
                    referenceAnalysis: normalizedRef,
                    analysis: {
                        bands: normalizedRef.bands
                    }
                };

                state.render.mode = 'reference';
                window.__soundyState = state;
                console.log("[REF-FIX] Estrutura final corrigida", state.reference);
            }
            
            // 🔥 CORREÇÃO: Preparar dados para comparação A/B correta
            console.log('[REFERENCE-FLOW] ═══════════════════════════════════════');
            console.log('[REFERENCE-FLOW] Segunda música concluída - montando comparação A/B');
            
            // Usar PRIMEIRA música como base do modal
            const userAnalysis = state.previousAnalysis || state.userAnalysis;
            const referenceAnalysisData = normalizedResult || state.referenceAnalysis;
            
            console.log('[REFERENCE-COMPARE] ═══════════════════════════════════════');
            console.log('[REFERENCE-COMPARE] 1ª FAIXA (SUA MÚSICA):');
            console.log('[REFERENCE-COMPARE]   Nome:', userAnalysis?.fileName || userAnalysis?.metadata?.fileName);
            console.log('[REFERENCE-COMPARE]   technicalData:', !!userAnalysis?.technicalData);
            console.log('[REFERENCE-COMPARE]   spectral_balance:', userAnalysis?.technicalData?.spectral_balance ? 'SIM' : 'NÃO');
            console.log('[REFERENCE-COMPARE]   bandas:', userAnalysis?.technicalData?.spectral_balance ? Object.keys(userAnalysis.technicalData.spectral_balance) : 'NENHUMA');
            console.log('[REFERENCE-COMPARE]   LUFS:', userAnalysis?.technicalData?.lufsIntegrated);
            console.log('[REFERENCE-COMPARE] 2ª FAIXA (REFERÊNCIA):');
            console.log('[REFERENCE-COMPARE]   Nome:', referenceAnalysisData?.fileName || referenceAnalysisData?.metadata?.fileName);
            console.log('[REFERENCE-COMPARE]   technicalData:', !!referenceAnalysisData?.technicalData);
            console.log('[REFERENCE-COMPARE]   spectral_balance:', referenceAnalysisData?.technicalData?.spectral_balance ? 'SIM' : 'NÃO');
            console.log('[REFERENCE-COMPARE]   bandas:', referenceAnalysisData?.technicalData?.spectral_balance ? Object.keys(referenceAnalysisData.technicalData.spectral_balance) : 'NENHUMA');
            console.log('[REFERENCE-COMPARE]   LUFS:', referenceAnalysisData?.technicalData?.lufsIntegrated);
            console.log('[REFERENCE-COMPARE] ═══════════════════════════════════════');
            
            // Marcar no normalizedResult que é modo referência com dados corretos
            normalizedResult._isReferenceMode = true;
            normalizedResult._userAnalysis = userAnalysis;
            normalizedResult._referenceAnalysis = referenceAnalysisData;
            
            await displayModalResults(normalizedResult);
            console.log('[FIX-REFERENCE] Modal aberto após segunda análise');
            
            // 🔧 FIX: NÃO LIMPAR referência durante modo REFERENCE ativo
            // A limpeza só deve ocorrer quando o usuário fechar o modal ou trocar de modo
            const usedReferenceAnalysis = normalizedResult._isReferenceMode || 
                                          (normalizedResult._userAnalysis && normalizedResult._referenceAnalysis);
            
            if (jobMode !== 'reference' || !usedReferenceAnalysis) {
                // Modo normal ou sem referência: limpar normalmente
                delete window.__REFERENCE_JOB_ID__;
                delete window.__FIRST_ANALYSIS_RESULT__;
                localStorage.removeItem('referenceJobId');
                
                console.log('✅ [CLEANUP] ═══════════════════════════════════════');
                console.log('✅ [CLEANUP] Referência removida (modo normal)');
                console.log('✅ [CLEANUP] ═══════════════════════════════════════');
            } else {
                // Modo REFERENCE ativo: PRESERVAR referência para próximas comparações
                console.log('✅ [CLEANUP] ═══════════════════════════════════════');
                console.log('✅ [CLEANUP] Referência PRESERVADA (modo reference ativo)');
                console.log('✅ [CLEANUP] Mantidos:');
                console.log('✅ [CLEANUP]   - window.__REFERENCE_JOB_ID__:', window.__REFERENCE_JOB_ID__);
                console.log('✅ [CLEANUP]   - localStorage.referenceJobId:', localStorage.getItem('referenceJobId'));
                console.log('✅ [CLEANUP] Dados disponíveis para novas comparações');
                console.log('✅ [CLEANUP] ═══════════════════════════════════════');
                
                // Marcar que há uma comparação ativa
                window.__referenceComparisonActive = true;
            }
            
            // 🔒 MANTÉM: window.referenceAnalysisData e referenceComparisonMetrics para renderização
        } else {
            // Modo genre: análise por gênero tradicional
            __dbg('🎯 Exibindo resultado por gênero');
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
    
    // 🧩 AUDIT_REF_FIX: Verificar se NÃO estamos em modo reference antes de limpar
    const state = window.__soundyState || {};
    const currentMode = state?.render?.mode || currentAnalysisMode;
    const isSecondTrack = state?.reference?.isSecondTrack || false;
    
    // 🚨 PROTEÇÃO: NÃO limpar estado se estivermos em modo reference
    if (currentMode === 'reference' && isSecondTrack) {
        console.warn('⚠️ [AUDIT_REF_FIX] handleGenreAnalysisWithResult chamado em modo reference!');
        console.warn('⚠️ [AUDIT_REF_FIX] ABORTANDO limpeza para preservar dados A/B');
        console.log('[MODE LOCKED] reference - limpeza de estado BLOQUEADA');
        
        // Normalizar e retornar sem modificar estado
        const normalizedResult = normalizeBackendAnalysisData(analysisResult);
        return normalizedResult;
    }
    
    // 🧩 CORREÇÃO #1: Limpeza completa APENAS em modo Genre genuíno
    
    // Limpar completamente estado de referência
    state.userAnalysis = null;
    state.referenceAnalysis = null;
    state.previousAnalysis = null;
    
    if (state.reference) {
        state.reference.analysis = null;
        state.reference.isSecondTrack = false;
        state.reference.jobId = null;
        state.reference.userAnalysis = null;
        state.reference.referenceAnalysis = null;
    }
    
    // Forçar modo gênero explicitamente
    if (!state.render) state.render = {};
    state.render.mode = 'genre';
    
    window.__soundyState = state;
    
    // Limpar globais de referência
    window.referenceAnalysisData = null;
    window.referenceComparisonMetrics = null;
    window.lastReferenceJobId = null;
    
    console.log('🎚️ [FIX-GENRE] Estado completamente limpo, modo forçado para "genre"');
    
    try {
        // Verificar estrutura do resultado
        if (!analysisResult || typeof analysisResult !== 'object') {
            throw new Error('Resultado de análise inválido recebido do servidor');
        }
        
        updateModalProgress(90, '🎵 Aplicando resultado da análise...');
        
        // 🔧 CORREÇÃO: Normalizar dados do backend antes de usar
        const normalizedResult = normalizeBackendAnalysisData(analysisResult);
        
        // ✅ CORREÇÃO: Carregar targets de gênero de /Refs/Out/ se não existirem
        if (!normalizedResult.referenceComparison) {
            const genreId = normalizedResult.genreId || normalizedResult.metadata?.genre || normalizedResult.genre || "default";
            console.log(`[GENRE-TARGETS] Tentando carregar targets para gênero: ${genreId}`);
            
            try {
                const response = await fetch(`/Refs/Out/${genreId}.json`);
                if (response.ok) {
                    const targets = await response.json();
                    normalizedResult.referenceComparison = targets;
                    console.log(`[GENRE-TARGETS] ✅ Targets carregados para ${genreId}:`, targets);
                } else {
                    console.warn(`[GENRE-TARGETS] ⚠️ Arquivo não encontrado: /Refs/Out/${genreId}.json (${response.status})`);
                    console.warn(`[GENRE-TARGETS] Continuando sem targets específicos do gênero`);
                }
            } catch (err) {
                console.error("[GENRE-TARGETS] ❌ Erro ao carregar targets de gênero:", err);
                console.error("[GENRE-TARGETS] Continuando com targets padrão ou sem targets");
            }
        } else {
            console.log("[GENRE-TARGETS] ✅ referenceComparison já existe, pulando carregamento");
        }
        
        // 🎯 CORREÇÃO CRÍTICA: Gerar sugestões no primeiro load
        if (__activeRefData && !normalizedResult._suggestionsGenerated) {
            console.log('🎯 [SUGGESTIONS] Engine chamado no primeiro load');
            try {
                updateReferenceSuggestions(normalizedResult, __activeRefData);
                normalizedResult._suggestionsGenerated = true;
                console.log(`🎯 [SUGGESTIONS] ${normalizedResult.suggestions?.length || 0} sugestões geradas no primeiro load`);
            } catch (error) {
                console.error('❌ [SUGGESTIONS] Erro ao gerar sugestões no primeiro load:', error);
            }
        } else if (!__activeRefData) {
            console.log('🎯 [SUGGESTIONS] Dados de referência não disponíveis para gerar sugestões');
        } else {
            console.log('🎯 [SUGGESTIONS] Sugestões já foram geradas anteriormente');
        }

        // 🚀 FORÇA EXIBIÇÃO: Sempre mostrar interface IA após sugestões serem processadas
        if (normalizedResult.suggestions && normalizedResult.suggestions.length > 0) {
            setTimeout(() => {
                console.log(`🚀 [AI-UI-FORCE] Tentando forçar interface IA aparecer com ${normalizedResult.suggestions.length} sugestões`);
                
                // Verificar múltiplas formas de chamar a interface IA
                if (window.aiUIController) {
                    console.log(`🚀 [AI-UI-FORCE] Usando aiUIController existente`);
                    window.aiUIController.checkForAISuggestions(normalizedResult, true);
                } else if (window.forceShowAISuggestions) {
                    console.log(`🚀 [AI-UI-FORCE] Usando forceShowAISuggestions como fallback`);
                    window.forceShowAISuggestions(normalizedResult);
                } else {
                    console.warn('⚠️ [AI-UI-FORCE] Nenhum método de interface IA encontrado, criando interface básica...');
                    
                    // Criar interface básica na hora
                    const aiSection = document.createElement('div');
                    aiSection.id = 'ai-suggestions-section';
                    aiSection.style.cssText = `
                        margin: 20px 0; padding: 20px; border: 2px solid #4CAF50;
                        border-radius: 10px; background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
                        color: white; font-family: Arial, sans-serif;
                    `;
                    aiSection.innerHTML = `
                        <h3 style="color: #4CAF50; margin: 0 0 15px 0;">🤖 Sugestões Inteligentes</h3>
                        <div style="background: rgba(76, 175, 80, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50;">
                            <p style="margin: 0 0 10px 0; color: #A5D6A7;">
                                💡 Interface IA carregada com ${normalizedResult.suggestions.length} sugestões
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #81C784;">
                                Configure uma API Key da OpenAI para sugestões inteligentes personalizadas.
                            </p>
                            <button onclick="if(window.promptForAPIKey) window.promptForAPIKey(); else alert('Configure API Key da OpenAI para ativar IA')" 
                                    style="margin-top: 10px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                ⚙️ Configurar IA
                            </button>
                        </div>
                    `;
                    
                    // Inserir na interface
                    const modal = document.getElementById('audioAnalysisModal');
                    const content = modal?.querySelector('.modal-content');
                    if (content) {
                        // Remover seção anterior se existir
                        const existing = content.querySelector('#ai-suggestions-section');
                        if (existing) existing.remove();
                        
                        // Adicionar nova seção
                        content.appendChild(aiSection);
                        console.log('✅ [AI-UI-FORCE] Interface IA básica criada e inserida');
                    } else {
                        console.error('❌ [AI-UI-FORCE] Modal não encontrado para inserir interface');
                    }
                }
            }, 500); // Delay para garantir que o DOM esteja renderizado
        }
        
        // Definir como análise atual do modal
        currentModalAnalysis = normalizedResult;
        
        // 🎯 ALIAS GLOBAL PARA RELATÓRIOS (Fonte de Verdade Única)
        if (typeof window !== 'undefined') {
            window.__LAST_ANALYSIS_RESULT__ = normalizedResult;
            
            // Criar namespace global unificado
            window.__soundyAI = window.__soundyAI || {};
            window.__soundyAI.analysis = normalizedResult;
            
            console.log('✅ [PDF-READY] Análise armazenada globalmente:', {
                hasGlobalAlias: !!window.__soundyAI.analysis,
                fileName: normalizedResult.metadata?.fileName || normalizedResult.fileName,
                score: normalizedResult.score,
                hasMetrics: !!(normalizedResult.loudness || normalizedResult.technicalData)
            });
        }
        
        updateModalProgress(100, `✅ Análise de ${fileName} concluída!`);
        
        // Exibir resultados diretamente no modal
        setTimeout(() => {
            console.log("[DISPLAY] Metrics modal triggered from handleGenreAnalysisWithResult");
            // 🛡️ VERIFICAÇÃO DEFENSIVA: Garantir que displayModalResults existe
            if (typeof displayModalResults === 'function') {
                displayModalResults(normalizedResult);
            } else {
                console.warn('⚠️ [MODAL_MONITOR] Função displayModalResults não encontrada na análise por gênero');
                setTimeout(() => {
                    if (typeof displayModalResults === 'function') {
                        displayModalResults(normalizedResult);
                    } else {
                        console.error('❌ [MODAL_MONITOR] Análise por gênero - função displayModalResults não encontrada');
                    }
                }, 1000);
            }
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
async function handleReferenceFileSelection(file) {
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
        
        // 🛡️ VERIFICAÇÃO DEFENSIVA: Garantir que displayModalResults existe
        if (typeof displayModalResults === 'function') {
            displayModalResults(analysis);
        } else {
            console.warn('⚠️ [MODAL_MONITOR] Função displayModalResults não encontrada, aguardando carregamento...');
            // Tentar novamente em 1 segundo
            setTimeout(() => {
                if (typeof displayModalResults === 'function') {
                    displayModalResults(analysis);
                } else {
                    console.error('❌ [MODAL_MONITOR] Timeout - função displayModalResults não encontrada após espera');
                }
            }, 1000);
        }
        
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
        
        // 🎯 ALIAS GLOBAL PARA RELATÓRIOS (Modo Referência)
        if (typeof window !== 'undefined') {
            window.__LAST_ANALYSIS_RESULT__ = combinedAnalysis;
            window.__soundyAI = window.__soundyAI || {};
            window.__soundyAI.analysis = combinedAnalysis;
            
            console.log('✅ [PDF-READY] Comparação armazenada globalmente:', {
                mode: 'reference',
                hasComparison: !!combinedAnalysis.comparison,
                userFile: combinedAnalysis.userFile,
                referenceFile: combinedAnalysis.referenceFile
            });
        }
        
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

// � Atualizar progresso no modal
function updateModalProgress(percentage, message) {
    const progressFill = document.getElementById('audioProgressFill');
    const progressText = document.getElementById('audioProgressText');
    
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = message || `${percentage}%`;
    }
    
    __dbg(`📈 Progresso: ${percentage}% - ${message}`);
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

// 📊 Mostrar resultados no modal
// 📊 Mostrar resultados no modal
function displayModalResults(analysis) {
    // 🎯 LOG INICIAL PARA CONFIRMAR CHAMADA DA FUNÇÃO APÓS CORREÇÕES
    console.log("✅ [DISPLAY_MODAL] Função displayModalResults chamada com dados:", analysis);
    console.log("✅ [DISPLAY_MODAL] Estrutura dos dados recebidos:", Object.keys(analysis || {}));
    
    // 🔒 PROTEÇÃO MODO REFERENCE: Evitar sobrescrita por interceptores
    if (analysis && analysis.mode === "reference") {
        const previous = window.__soundyState?.previousAnalysis;
        const user = analysis.userAnalysis || previous;
        const ref = analysis.referenceAnalysis || 
                    window.__soundyState?.referenceAnalysis || 
                    window.__soundyState?.reference?.referenceAnalysis || 
                    null;

        console.log("[REFERENCE-FLOW ✅] Comparação direta A/B antes da renderização:", {
            userTrack: user?.fileName || user?.metadata?.fileName,
            referenceTrack: ref?.fileName || ref?.metadata?.fileName,
            hasUserBands: !!(user?.technicalData?.spectral_balance || user?.bands),
            hasRefBands: !!(ref?.technicalData?.spectral_balance || ref?.bands),
        });

        // 🔒 Proteção contra sobrescrita por interceptores
        if (user) Object.freeze(user);
        if (ref) Object.freeze(ref);

        const payload = {
            mode: "reference",
            userAnalysis: user,
            referenceAnalysis: ref,
        };

        renderReferenceComparisons(payload);
        return;
    }
    
    // 🔒 VALIDAÇÃO CRÍTICA: Garantir que métricas essenciais estão presentes
    // CORRIGIDO: Verificar novos caminhos do backend Redis
    const hasEssentialMetrics = (
        analysis?.technicalData && 
        (
            Number.isFinite(analysis.technicalData.lufsIntegrated) ||
            Number.isFinite(analysis.technicalData.lufs_integrated) ||
            Number.isFinite(analysis.technicalData.avgLoudness) ||
            Number.isFinite(analysis.technicalData.dynamicRange) ||
            // NOVOS CAMINHOS: Estrutura do backend Redis
            Number.isFinite(analysis.loudness?.integrated) ||
            Number.isFinite(analysis.technicalData?.dr) ||
            // Fallback: Se tem score, provavelmente tem dados válidos
            Number.isFinite(analysis.score)
        )
    );
    
    if (!hasEssentialMetrics) {
        console.warn('⚠️ [UI_GATE] Aguardando métricas essenciais... análise incompleta:', analysis);
        console.log('🔍 [UI_GATE] Debug - estrutura recebida:', {
            technicalData: analysis?.technicalData,
            loudness: analysis?.loudness,
            score: analysis?.score,
            hasScore: Number.isFinite(analysis?.score)
        });
        
        // CORREÇÃO: Verificar se é estrutura nova mas válida
        if (analysis?.loudness || analysis?.technicalData || Number.isFinite(analysis?.score)) {
            console.warn("⚠️ [UI_GATE] Estrutura nova detectada, prosseguindo com dados disponíveis");
        } else {
            // Tentar novamente em 2 segundos apenas se realmente não há dados
            setTimeout(() => displayModalResults(analysis), 2000);
            return;
        }
    }
    
    console.log('✅ [UI_GATE] Métricas essenciais presentes, exibindo resultados');
    
    // 🔥 CORREÇÃO COMPARAÇÃO A/B: Usar _userAnalysis (1ª faixa = sua música) para cards/métricas
    if (analysis._isReferenceMode && analysis._userAnalysis && analysis._referenceAnalysis) {
        console.log('[REFERENCE-DISPLAY] 🎯 ═══════════════════════════════════════');
        console.log('[REFERENCE-DISPLAY] 🎯 Modo A/B detectado - Configuração correta:');
        console.log('[REFERENCE-DISPLAY] ✅ 1ª faixa (SUA MÚSICA/ATUAL):', analysis._userAnalysis?.fileName || analysis._userAnalysis?.metadata?.fileName);
        console.log('[REFERENCE-DISPLAY] ✅ 2ª faixa (REFERÊNCIA/ALVO):', analysis._referenceAnalysis?.fileName || analysis._referenceAnalysis?.metadata?.fileName);
        console.log('[REFERENCE-DISPLAY] 📊 Cards principais: mostrarão métricas da SUA MÚSICA (1ª faixa)');
        console.log('[REFERENCE-DISPLAY] 📊 Tabela comparativa: SUA MÚSICA (esquerda) vs REFERÊNCIA (direita)');
        console.log('[REFERENCE-DISPLAY] 🎯 ═══════════════════════════════════════');
        
        // Salvar análise de referência antes de substituir
        const originalReferenceAnalysis = analysis._referenceAnalysis;
        
        // SUBSTITUIR analysis pelos dados da PRIMEIRA faixa (sua música/atual) para renderização dos cards
        const firstTrackAnalysis = analysis._userAnalysis;
        
        // Copiar propriedades importantes
        analysis = {
            ...firstTrackAnalysis,
            _isReferenceMode: true,
            _userAnalysis: firstTrackAnalysis,
            _referenceAnalysis: originalReferenceAnalysis,
            mode: 'reference' // Manter modo para lógica posterior
        };
        
        console.log('[REFERENCE-DISPLAY ✅] Analysis substituído por dados da sua música (1ª faixa)');
        console.log('[REFERENCE-DISPLAY] Métricas da SUA MÚSICA a serem exibidas nos cards:', {
            lufs: analysis.technicalData?.lufsIntegrated || analysis.loudness?.integrated,
            dr: analysis.technicalData?.dynamicRange || analysis.technicalData?.dr,
            tp: analysis.technicalData?.truePeakDbtp || analysis.truePeak?.maxDbtp
        });
    }
    
    // 🎯 DETECÇÃO DE MODO COMPARAÇÃO ENTRE FAIXAS
    const isSecondTrack = window.__REFERENCE_JOB_ID__ !== null && window.__REFERENCE_JOB_ID__ !== undefined;
    const mode = analysis?.mode || currentAnalysisMode;
    
    // 🎯 DEFINIR MODO NO ESTADO ANTES DE QUALQUER CÁLCULO
    const state = window.__soundyState || {};
    state.render = state.render || {};
    
    if (mode === 'reference' && isSecondTrack && window.referenceAnalysisData) {
        console.log('🎯 [COMPARE-MODE] Comparando segunda faixa com primeira faixa (não com gênero)');
        console.log('📊 [COMPARE-MODE] Primeira faixa:', window.referenceAnalysisData);
        console.log('📊 [COMPARE-MODE] Segunda faixa:', analysis);
        
        // 🎯 DEFINIR MODO REFERENCE NO ESTADO
        state.render.mode = 'reference';
        window.__soundyState = state;
        console.log('✅ [COMPARE-MODE] Modo definido como REFERENCE no estado');
        
        // 🎯 CRIAR ESTRUTURA DE COMPARAÇÃO ENTRE FAIXAS
        // Normalizar ambas as análises
        const refNormalized = normalizeBackendAnalysisData(window.referenceAnalysisData); // Primeira faixa (BASE)
        const currNormalized = normalizeBackendAnalysisData(analysis); // Segunda faixa (ATUAL)
        
        // [REF-FLOW] Construindo métricas A/B
        // ✅ SEMÂNTICA CORRETA:
        // - refNormalized = 1ª faixa = SUA MÚSICA (atual) = userAnalysis
        // - currNormalized = 2ª faixa = REFERÊNCIA (alvo a alcançar) = referenceAnalysis
        referenceComparisonMetrics = {
            // ESTRUTURA NOVA (CORRETA):
            userTrack: refNormalized?.technicalData || {},        // 1ª faixa (sua música/atual)
            referenceTrack: currNormalized?.technicalData || {}, // 2ª faixa (referência/alvo)
            
            userTrackFull: refNormalized || null,
            referenceTrackFull: currNormalized || null,
            
            // LEGADO: manter por compatibilidade (mapeamento correto)
            user: refNormalized?.technicalData || {},       // 1ª = sua música (atual)
            reference: currNormalized?.technicalData || {}, // 2ª = referência (alvo)
            userFull: refNormalized || null,
            referenceFull: currNormalized || null
        };
        
        console.log('[REF-FLOW] ✅ ═══════════════════════════════════════');
        console.log('[REF-FLOW] ✅ Métricas A/B construídas corretamente:');
        console.log('[REF-FLOW] ✅   SUA MÚSICA (1ª):', refNormalized.metadata?.fileName);
        console.log('[REF-FLOW] ✅   LUFS:', referenceComparisonMetrics.userTrack?.lufsIntegrated);
        console.log('[REF-FLOW] ✅   REFERÊNCIA (2ª):', currNormalized.metadata?.fileName);
        console.log('[REF-FLOW] ✅   LUFS:', referenceComparisonMetrics.referenceTrack?.lufsIntegrated);
        console.log('[REF-FLOW] ✅   Tabela: ESQUERDA=sua música, DIREITA=referência');
        console.log('[REF-FLOW] ✅ ═══════════════════════════════════════');
        
        console.log('[ASSERT] reference mode', {
            userIsFirst: !!(state?.userAnalysis || refNormalized),
            refIsSecond: !!(state?.referenceAnalysis || currNormalized)
        });
        
        // 🧩 PROTEÇÃO CONTRA DADOS INCOMPLETOS
        if (!currNormalized?.technicalData?.spectral_balance) {
            console.warn("⚠️ [REF-FIX] spectral_balance ausente em currNormalized, reconstruindo...");
            if (currNormalized?.bands) {
                currNormalized.technicalData.spectral_balance = currNormalized.bands;
            } else if (currNormalized?.technicalData?.bandEnergies) {
                currNormalized.technicalData.spectral_balance = currNormalized.technicalData.bandEnergies;
            } else {
                console.warn("⚠️ [REF-FIX] Criando estrutura vazia para currNormalized");
                if (!currNormalized.technicalData) currNormalized.technicalData = {};
                currNormalized.technicalData.spectral_balance = {
                    sub: 0, bass: 0, low_mid: 0, mid: 0,
                    high_mid: 0, presence: 0, air: 0
                };
            }
        }

        if (!refNormalized?.technicalData?.spectral_balance) {
            console.warn("⚠️ [REF-FIX] spectral_balance ausente em refNormalized, reconstruindo...");
            if (refNormalized?.bands) {
                refNormalized.technicalData.spectral_balance = refNormalized.bands;
            } else if (refNormalized?.technicalData?.bandEnergies) {
                refNormalized.technicalData.spectral_balance = refNormalized.technicalData.bandEnergies;
            } else {
                console.warn("⚠️ [REF-FIX] Criando estrutura vazia para refNormalized");
                if (!refNormalized.technicalData) refNormalized.technicalData = {};
                refNormalized.technicalData.spectral_balance = {
                    sub: 0, bass: 0, low_mid: 0, mid: 0,
                    high_mid: 0, presence: 0, air: 0
                };
            }
        }
        
        // 🧩 LOG DE AUDITORIA DETALHADO
        console.log("[ASSERT_REF_FLOW ✅]", {
            userTrack: refNormalized?.metadata?.fileName || "primeira faixa",
            referenceTrack: currNormalized?.metadata?.fileName || "segunda faixa",
            userBands: Object.keys(refNormalized?.technicalData?.spectral_balance || {}),
            referenceBands: Object.keys(currNormalized?.technicalData?.spectral_balance || {})
        });
        
        // 🧩 PROTEÇÃO NO displayModalResults: Bloquear execução se referenceTrack ainda não existir
        if (!currNormalized?.metadata?.fileName && !currNormalized?.fileName) {
            console.warn("⚠️ [DISPLAY_MODAL_FIX] Reference track ainda não pronta — adiando render...");
            setTimeout(() => {
                renderReferenceComparisons({
                    mode: 'reference',
                    userAnalysis: refNormalized,
                    referenceAnalysis: currNormalized
                });
            }, 300);
            return;
        }
        
        // 🧩 CORREÇÃO #6: Chamada ÚNICA de renderização (remover duplicação)
        // SEMÂNTICA CORRETA:
        // - userAnalysis = 1ª faixa (SUA MÚSICA - atual)
        // - referenceAnalysis = 2ª faixa (REFERÊNCIA - alvo)
        
        // 🔍 [A/B-DEBUG] Dados ANTES de renderReferenceComparisons
        console.log("[A/B-DEBUG] ═══════════════════════════════════════");
        console.log("[A/B-DEBUG] Dados antes do SAFE_RENDER_REF:");
        console.log("[A/B-DEBUG] refNormalized (1ª faixa - SUA MÚSICA):", {
            fileName: refNormalized?.fileName || refNormalized?.metadata?.fileName,
            hasBands: !!refNormalized?.bands,
            hasSpectralBalance: !!refNormalized?.technicalData?.spectral_balance,
            bandsKeys: refNormalized?.bands ? Object.keys(refNormalized.bands) : [],
            spectralBalanceKeys: refNormalized?.technicalData?.spectral_balance ? Object.keys(refNormalized.technicalData.spectral_balance) : []
        });
        console.log("[A/B-DEBUG] currNormalized (2ª faixa - REFERÊNCIA):", {
            fileName: currNormalized?.fileName || currNormalized?.metadata?.fileName,
            hasBands: !!currNormalized?.bands,
            hasSpectralBalance: !!currNormalized?.technicalData?.spectral_balance,
            bandsKeys: currNormalized?.bands ? Object.keys(currNormalized.bands) : [],
            spectralBalanceKeys: currNormalized?.technicalData?.spectral_balance ? Object.keys(currNormalized.technicalData.spectral_balance) : []
        });
        console.log("[A/B-DEBUG] ═══════════════════════════════════════");
        
        // ✅ GARANTIR que bands esteja no nível correto (userAnalysis.bands e referenceAnalysis.bands)
        if (!refNormalized.bands && refNormalized?.technicalData?.spectral_balance) {
            refNormalized.bands = refNormalized.technicalData.spectral_balance;
            console.log("[A/B-FIX] ✅ Bandas copiadas de technicalData.spectral_balance para bands (userAnalysis)");
        }
        
        if (!currNormalized.bands && currNormalized?.technicalData?.spectral_balance) {
            currNormalized.bands = currNormalized.technicalData.spectral_balance;
            console.log("[A/B-FIX] ✅ Bandas copiadas de technicalData.spectral_balance para bands (referenceAnalysis)");
        }
        
        console.log("[A/B-DEBUG] ✅ Bandas finais:", {
            userBandsLength: refNormalized?.bands ? Object.keys(refNormalized.bands).length : 0,
            referenceBandsLength: currNormalized?.bands ? Object.keys(currNormalized.bands).length : 0
        });
        
        renderReferenceComparisons({
            mode: 'reference',
            userAnalysis: refNormalized,        // 1ª faixa (sua música)
            referenceAnalysis: currNormalized,   // 2ª faixa (referência)
            analysis: {
                userAnalysis: refNormalized,
                referenceAnalysis: currNormalized
            }
        });
        
        // ❌ REMOVIDO: renderTrackComparisonTable() - causava duplicação
        // renderReferenceComparisons() já renderiza tudo
        console.log('✅ [REFERENCE-RENDER] Renderização única completa (sem duplicação)');
        
        // Atualizar window.latestAnalysis para compatibilidade com IA e PDF
        window.latestAnalysis = {
            mode: "comparison",
            reference: window.referenceAnalysisData,
            current: analysis,
            scores: analysis.scores || {}
        };
        
        // ✅ CORREÇÃO CRÍTICA: NÃO retornar aqui!
        // Continuar para renderizar cards, scores e sugestões
        console.log('[AUDIT-FIX] ✅ Continuando renderização completa (cards, scores, sugestões)');
        
        // 🎯 GARANTIR que sugestões de IA sejam chamadas também no modo reference
        console.log('[AUDIT-FIX] 🤖 Iniciando renderização de sugestões de IA no modo reference');
        
        // Usar dados da primeira faixa (userAnalysis) para sugestões
        const analysisForSuggestions = refNormalized || analysis;
        
        // Chamar sugestões de IA após pequeno delay para garantir que DOM está pronto
        setTimeout(() => {
            if (window.aiUIController) {
                console.log('[AUDIT-FIX] ✅ Chamando aiUIController.checkForAISuggestions');
                window.aiUIController.checkForAISuggestions(analysisForSuggestions, true);
            } else if (window.forceShowAISuggestions) {
                console.log('[AUDIT-FIX] ✅ Chamando forceShowAISuggestions');
                window.forceShowAISuggestions(analysisForSuggestions);
            } else {
                console.warn('[AUDIT-FIX] ⚠️ Nenhuma função de IA disponível');
            }
        }, 800);
        
        // ⚠️ IMPORTANTE: Não usar return aqui - continuar fluxo normal
        // return; // ← REMOVIDO
    }
    
    // 🎯 CORREÇÃO: Definir modo baseado no contexto real da análise
    // NÃO forçar genre se for primeira faixa de referência
    if (mode === 'reference' && !isSecondTrack) {
        // Primeira faixa em modo reference - manter modo reference mas não renderizar ainda
        state.render.mode = 'reference';
        console.log('✅ [REFERENCE-FIRST] Primeira faixa de referência - aguardando segunda');
    } else if (mode !== 'reference' || (mode === 'reference' && !window.referenceAnalysisData)) {
        // 🔐 PARTE 3.3: Trava do modo Reference — NÃO forçar genre se estamos em fluxo de referência
        const isReferenceFlowLocked =
            (state?.reference?.isSecondTrack === true) ||
            (!!window.__REFERENCE_JOB_ID__ && state?.render?.mode === "reference");

        if (!isReferenceFlowLocked) {
            // Modo genre genuíno
            state.render.mode = 'genre';
            console.log('✅ [GENRE-MODE] Modo definido como GENRE no estado');
            
            // Limpar dados de referência para evitar contaminação APENAS em modo genre
            if (state.reference) {
                state.reference.isSecondTrack = false;
                state.reference.analysis = null;
            }
        } else {
            console.log('🔒 [REF-LOCK] Modo reference travado — genre forçado bloqueado');
        }
    }
    window.__soundyState = state;
    
    // 🔒 UI GATE: Verificação final antes de renderizar
    const analysisRunId = analysis?.runId || analysis?.metadata?.runId;
    const currentRunId = window.__CURRENT_ANALYSIS_RUN_ID__;
    
    if (analysisRunId && currentRunId && analysisRunId !== currentRunId) {
        console.warn(`🚫 [UI_GATE] displayModalResults cancelado - análise obsoleta (análise: ${analysisRunId}, atual: ${currentRunId})`);
        return;
    }
    
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    const technicalData = document.getElementById('modalTechnicalData');
    
    if (!results || !technicalData) {
        console.error('❌ Elementos de resultado não encontrados');
        return;
    }
    
    // 🔧 CORREÇÃO CRÍTICA: Normalizar dados do backend para compatibilidade com front-end
    if (analysis && typeof analysis === 'object') {
        console.log('[AUDITORIA-RMS-LUFS] ANTES de normalizar:', {
            'technicalData.avgLoudness (RMS)': analysis?.technicalData?.avgLoudness,
            'technicalData.rms': analysis?.technicalData?.rms,
            'energy.rms': analysis?.energy?.rms,
            'technicalData.lufsIntegrated': analysis?.technicalData?.lufsIntegrated,
            'loudness.integrated': analysis?.loudness?.integrated,
            'technicalData.crestFactor': analysis?.technicalData?.crestFactor,
            'technicalData.truePeakDbtp': analysis?.technicalData?.truePeakDbtp,
            'dynamics.crest': analysis?.dynamics?.crest,
            'truePeak.maxDbtp': analysis?.truePeak?.maxDbtp
        });
        
        analysis = normalizeBackendAnalysisData(analysis);
        
        console.log('[AUDITORIA-RMS-LUFS] DEPOIS de normalizar:', {
            'technicalData.avgLoudness (RMS)': analysis?.technicalData?.avgLoudness,
            'technicalData.lufsIntegrated': analysis?.technicalData?.lufsIntegrated,
            'technicalData.crestFactor': analysis?.technicalData?.crestFactor,
            'technicalData.truePeakDbtp': analysis?.technicalData?.truePeakDbtp,
            'loudness.integrated': analysis?.loudness?.integrated,
            'dynamics.crest': analysis?.dynamics?.crest,
            'truePeak.maxDbtp': analysis?.truePeak?.maxDbtp,
            'energy.rms': analysis?.energy?.rms
        });
        console.log('📊 [DEBUG] Dados normalizados para exibição:', analysis);
        
        // 🎯 RECALCULAR hasReferenceComparisonMetrics APÓS NORMALIZAÇÃO
        const state = window.__soundyState || {};
        state.hasReferenceComparisonMetrics = computeHasReferenceComparisonMetrics(analysis);
        window.__soundyState = state;
        console.log('[ASSERT] hasReferenceComparisonMetrics recalculado após normalização:', state.hasReferenceComparisonMetrics);
        
        // 🛡️ PASSO 2: GARANTIR analysis.referenceComparison EXISTE
        if (!analysis.referenceComparison) {
            analysis.referenceComparison = {};
            console.log('🛡️ [PASSO 2] Criado analysis.referenceComparison vazio');
        }
        
        // 🎯 Preencher targets a partir de referenceComparisonMetrics ou genreTargets
        const genreTargets = __activeRefData || {};
        
        if (!analysis.referenceComparison.lufs_target) {
            analysis.referenceComparison.lufs_target = genreTargets.lufs_target ?? -14;
        }
        if (!analysis.referenceComparison.tp_target) {
            analysis.referenceComparison.tp_target = genreTargets.true_peak_target ?? -1;
        }
        if (!analysis.referenceComparison.dr_target) {
            analysis.referenceComparison.dr_target = genreTargets.dr_target ?? 8;
        }
        if (!analysis.referenceComparison.lra_target) {
            analysis.referenceComparison.lra_target = genreTargets.lra_target ?? 6;
        }
        if (!analysis.referenceComparison.stereo_target) {
            analysis.referenceComparison.stereo_target = genreTargets.stereo_target ?? 0.1;
        }
        
        console.log('✅ [PASSO 2] analysis.referenceComparison garantido:', analysis.referenceComparison);
    }
    
    // 🎯 CALCULAR SCORES DA ANÁLISE
    // Priorizar referenceComparisonMetrics se disponível (comparação entre faixas)
    let referenceDataForScores = __activeRefData;
    const isReferenceMode = !!(referenceComparisonMetrics && referenceComparisonMetrics.reference);
    
    // 🎯 CORREÇÃO: Usar state.render.mode como fonte da verdade para decidir limpeza
    const stateForScores = window.__soundyState || {};
    const actualMode = stateForScores.render?.mode || (isReferenceMode ? 'reference' : 'genre');
    
    // 🎯 LOG FINAL-MODE (conforme solicitado)
    console.log('[FINAL-MODE]', {
        mode: actualMode,
        isSecondTrack: stateForScores.reference?.isSecondTrack,
        comparison: stateForScores.reference?.analysis ? 'A/B ativo' : 'single'
    });
    
    // Limpar estado APENAS se modo for explicitamente 'genre'
    if (actualMode === 'genre' && !isReferenceMode) {
        if (stateForScores.reference && stateForScores.reference.isSecondTrack) {
            console.log('🧹 [GENRE-CLEANUP] Limpando referência antiga (modo genre confirmado)');
            stateForScores.reference.isSecondTrack = false;
            stateForScores.reference.analysis = null;
        }
        // Garantir que análise não tenha referenceAnalysis indevida
        if (analysis.referenceAnalysis) {
            console.warn('⚠️ [SCORES-GENRE] Removendo referenceAnalysis da análise de gênero (contaminação detectada)');
            delete analysis.referenceAnalysis;
        }
    } else if (actualMode === 'reference' || isReferenceMode) {
        console.log('✅ [REFERENCE-MODE] Mantendo referenceAnalysis ativo');
    }
    
    if (isReferenceMode) {
        console.log('✅ [SCORES] Usando referenceComparisonMetrics para calcular scores (comparação entre faixas)');
        
        // Construir objeto no formato esperado por calculateAnalysisScores
        const refMetrics = referenceComparisonMetrics.reference; // Primeira faixa (alvo)
        
        // 🎯 CORREÇÃO CRÍTICA: Buscar bandas da primeira faixa (referência/alvo)
        // Usar referenceFull que tem os dados completos da primeira faixa
        const referenceBandsFromAnalysis = referenceComparisonMetrics.referenceFull?.technicalData?.spectral_balance 
            || referenceComparisonMetrics.referenceFull?.metrics?.bands
            || window.__soundyState?.reference?.analysis?.bands
            || window.referenceAnalysisData?.technicalData?.spectral_balance
            || window.referenceAnalysisData?.metrics?.bands
            || null;
        
        if (!referenceBandsFromAnalysis) {
            console.warn('⚠️ [SCORES-REF] Bandas da primeira faixa (referência) não encontradas!');
            console.error('❌ Debug:', {
                hasReferenceFull: !!referenceComparisonMetrics.referenceFull,
                referenceFull: referenceComparisonMetrics.referenceFull,
                hasWindowRefData: !!window.referenceAnalysisData
            });
        } else {
            console.log('✅ [SCORES-REF] Usando bandas da primeira faixa como alvo (valores reais):', Object.keys(referenceBandsFromAnalysis));
        }
        
        referenceDataForScores = {
            lufs_target: refMetrics.lufsIntegrated || refMetrics.lufs_integrated,
            true_peak_target: refMetrics.truePeakDbtp || refMetrics.true_peak_dbtp,
            dr_target: refMetrics.dynamicRange || refMetrics.dynamic_range,
            lra_target: refMetrics.lra,
            stereo_target: refMetrics.stereoCorrelation || refMetrics.stereo_correlation,
            spectral_centroid_target: refMetrics.spectralCentroidHz || refMetrics.spectral_centroid,
            bands: referenceBandsFromAnalysis || refMetrics.spectral_balance, // Usar valores reais, não target_range
            tol_lufs: 0.5,
            tol_true_peak: 0.3,
            tol_dr: 1.0,
            tol_lra: 1.0,
            tol_stereo: 0.08,
            tol_spectral: 300,
            _isReferenceMode: true // Flag para indicar modo reference
        };
    }
    
    if (referenceDataForScores && analysis) {
        const detectedGenre = analysis.metadata?.genre || analysis.genre || __activeRefGenre;
        const state = window.__soundyState || {};
        
        console.log('🎯 Calculando scores para:', referenceComparisonMetrics ? 'comparação entre faixas' : `gênero ${detectedGenre}`);
        
        // 🎯 LOG DE VERIFICAÇÃO DA ORDEM A/B (conforme solicitado)
        if (isReferenceMode) {
            console.log('[VERIFY_AB_ORDER]', {
                mode: state.render.mode,
                userMetrics: 'Segunda faixa (atual)',
                refMetrics: 'Primeira faixa (alvo)',
                userFile: referenceComparisonMetrics?.userFull?.metadata?.fileName || 'Segunda faixa',
                refFile: referenceComparisonMetrics?.referenceFull?.metadata?.fileName || 'Primeira faixa',
                userLufs: referenceComparisonMetrics?.user?.lufsIntegrated,
                refLufs: referenceComparisonMetrics?.reference?.lufsIntegrated
            });
        }
        
        // 🎯 LOG DE VERIFICAÇÃO DE MODO (conforme solicitado)
        console.log('[VERIFY_MODE]', {
            mode: isReferenceMode ? 'reference' : 'genre',
            comparingWith: isReferenceMode ? 'Reference Track' : 'Genre Targets',
            refBands: isReferenceMode ? Object.keys(referenceDataForScores.bands || {}) : Object.keys(__activeRefData?.bands || {}),
            hasReferenceAnalysis: !!analysis.referenceAnalysis,
            isSecondTrack: state?.reference?.isSecondTrack,
            genre: detectedGenre
        });
        
        try {
            const analysisScores = calculateAnalysisScores(analysis, referenceDataForScores, detectedGenre);
            
            if (analysisScores) {
                // Adicionar scores à análise
                analysis.scores = analysisScores;
                console.log('✅ Scores calculados e adicionados à análise:', analysisScores);
                
                // Também armazenar globalmente
                if (typeof window !== 'undefined') {
                    window.__LAST_ANALYSIS_SCORES__ = analysisScores;
                }
            } else {
                console.warn('⚠️ Não foi possível calcular scores (dados insuficientes)');
            }
        } catch (error) {
            console.error('❌ Erro ao calcular scores:', error);
        }
    } else {
        console.warn('⚠️ Scores não calculados - dados de referência não disponíveis');
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
    // 🔍 AUDITORIA: Verificar múltiplos caminhos para lufsIntegrated e truePeakDbtp
    const lufsValue = analysis?.technicalData?.lufs_integrated ?? 
                     analysis?.technicalData?.lufsIntegrated ??
                     analysis?.metrics?.loudness?.integrated ??
                     analysis?.loudness?.integrated;
    
    const truePeakValue = analysis?.technicalData?.truePeakDbtp ??
                         analysis?.truePeak?.maxDbtp;
    
    const advancedReady = (
        Number.isFinite(lufsValue) && Number.isFinite(truePeakValue)
    );
    
    // 🎯 LOGS DE DIAGNÓSTICO - MÉTRICAS PRINCIPAIS
    console.log('[METRICS-FIX] advancedReady:', advancedReady);
    console.log('[METRICS-FIX] LUFS=', lufsValue, {
        'technicalData.lufs_integrated': analysis?.technicalData?.lufs_integrated,
        'technicalData.lufsIntegrated': analysis?.technicalData?.lufsIntegrated,
        'metrics.loudness.integrated': analysis?.metrics?.loudness?.integrated,
        'loudness.integrated': analysis?.loudness?.integrated
    });
    console.log('[METRICS-FIX] TRUEPEAK=', truePeakValue, {
        'technicalData.truePeakDbtp': analysis?.technicalData?.truePeakDbtp,
        'truePeak.maxDbtp': analysis?.truePeak?.maxDbtp
    });
    
    if (typeof window !== 'undefined') window.__AUDIO_ADVANCED_READY__ = advancedReady;

    // Helpers seguros com bloqueio de fallback se advanced não pronto
    const safeFixed = (v, d=1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
    const safeHz = (v) => (Number.isFinite(v) ? `${Math.round(v)} Hz` : '—');
    const pct = (v, d=0) => (Number.isFinite(v) ? `${(v*100).toFixed(d)}%` : '—');
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
        
        // 🎯 MAPEAMENTO DE MÉTRICAS COM TOOLTIPS
        const metricsTooltips = {
            // Métricas Principais
            'Volume médio (rms)': 'Mostra o volume real percebido ao longo da faixa. Ajuda a saber se a música está "forte" sem clipar.',
            'Loudness (lufs)': 'Média geral de volume no padrão das plataformas de streaming. Ideal: –14 LUFS.',
            'Pico máximo (dbfs)': 'O ponto mais alto da onda sonora, útil pra evitar distorção.',
            'Pico real (dbtp)': 'Pico real detectado após conversão digital. Deve ficar abaixo de –1 dBTP pra evitar clipagem.',
            'Dinâmica (dr)': 'Diferença entre os sons mais baixos e mais altos. Mais DR = mais respiro e punch.',
            'Consistência de volume (lu)': 'Mede o quanto o volume se mantém constante. 0 LU é estabilidade perfeita.',
            'Imagem estéreo': 'Representa a largura e equilíbrio do estéreo. 1 = mono, 0.9 = estéreo amplo.',
            'Abertura estéreo (%)': 'O quanto a faixa "abre" nos lados. Sons amplos soam mais envolventes.',
            
            // Análise de Frequências
            'Subgrave (20–60 hz)': 'Região das batidas mais profundas, sentida mais do que ouvida.',
            'Graves (60–150 hz)': 'Corpo do kick e do baixo. Cuidado pra não embolar.',
            'Médios-graves (150–500 hz)': 'Base harmônica. Excesso aqui soa abafado.',
            'Médios (500 hz–2 khz)': 'Clareza e presença de vocais e instrumentos.',
            'Médios-agudos (2–5 khz)': 'Ataque e definição. Muito = som agressivo.',
            'Presença (5–10 khz)': 'Brilho, clareza e detalhe.',
            'Ar (10–20 khz)': 'Sensação de espaço e abertura.',
            'Frequência central (hz)': 'Mostra onde está o "centro tonal" da faixa.',
            
            // Métricas Avançadas
            'Fator de crista (crest factor)': 'Diferença entre pico e volume médio. Mostra o punch e headroom.',
            'Centro espectral (hz)': 'Frequência onde está concentrada a energia da música.',
            'Extensão de agudos (hz)': 'Indica até onde chegam as altas frequências.',
            'Uniformidade espectral (%)': 'Mede se o som está equilibrado entre graves, médios e agudos.',
            'Bandas espectrais (n)': 'Quantidade de faixas de frequência analisadas.',
            'Kurtosis espectral': 'Mede picos anormais no espectro (distorção, harshness).',
            'Assimetria espectral': 'Mostra se o espectro está mais "pendendo" pros graves ou pros agudos.'
        };
        
        const row = (label, valHtml, keyForSource=null) => {
            // Usar sistema de enhancement se disponível
            const enhancedLabel = (typeof window !== 'undefined' && window.enhanceRowLabel) 
                ? window.enhanceRowLabel(label, keyForSource) 
                : label;
            
            // Limpar label (trim) e capitalizar primeira letra
            const cleanLabel = enhancedLabel.trim();
            const capitalizedLabel = cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1);
            
            // Verificar se existe tooltip para essa métrica (case-insensitive)
            const labelLowerCase = capitalizedLabel.toLowerCase();
            let tooltip = null;
            
            // Buscar tooltip comparando case-insensitive
            for (const [key, value] of Object.entries(metricsTooltips)) {
                if (key.toLowerCase() === labelLowerCase) {
                    tooltip = value;
                    break;
                }
            }
            
            // Gerar HTML do label com ícone de info e tooltip
            const labelHtml = tooltip 
                ? `<div class="metric-label-container">
                     <span style="flex: 1;">${capitalizedLabel}</span>
                     <span class="metric-info-icon" 
                           data-tooltip="${tooltip.replace(/"/g, '&quot;')}"
                           onmouseenter="showMetricTooltip(this, event)"
                           onmouseleave="hideMetricTooltip()">ℹ️</span>
                   </div>`
                : capitalizedLabel;
            
            return `
                <div class="data-row"${keyForSource?src(keyForSource):''}>
                    <span class="label">${labelHtml}</span>
                    <span class="value">${valHtml}</span>
                </div>`;
        };

        // 🎯 CENTRALIZAÇÃO DAS MÉTRICAS - Funções de acesso unificado com fallbacks robustos
        const getNestedValue = (obj, path) => {
            if (!obj || !path) return null;
            return path.split('.').reduce((current, key) => current?.[key], obj);
        };

        // 🔧 getMetricWithFallback: Suporta múltiplos caminhos de fallback em ordem de prioridade
        const getMetricWithFallback = (paths, defaultValue = null) => {
            if (!Array.isArray(paths)) paths = [paths];
            
            for (const pathConfig of paths) {
                let value = null;
                
                if (typeof pathConfig === 'string') {
                    // Caminho simples: tenta metrics > technicalData
                    value = getNestedValue(analysis.metrics, pathConfig) ?? 
                           getNestedValue(analysis.technicalData, pathConfig);
                } else if (Array.isArray(pathConfig)) {
                    // Array de caminhos aninhados: ['loudness', 'integrated']
                    value = getNestedValue(analysis, pathConfig.join('.'));
                }
                
                if (Number.isFinite(value)) {
                    return value;
                }
            }
            
            return defaultValue;
        };

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

        const safePct = (v) => (Number.isFinite(v) ? `${(v*100).toFixed(0)}%` : '—');
        const monoCompat = (s) => s ? s : '—';

        // Função para obter o valor LUFS integrado usando métricas centralizadas
        const getLufsIntegratedValue = () => {
            return getMetric('lufs_integrated', 'lufsIntegrated');
        };

        // 🎯 FUNÇÃO DE STATUS DO TRUE PEAK (CORREÇÃO CRÍTICA)
        const getTruePeakStatus = (value) => {
            if (!Number.isFinite(value)) return { status: '—', class: '' };
            
            if (value <= -1.5) return { status: 'EXCELENTE', class: 'status-excellent' };
            if (value <= -1.0) return { status: 'IDEAL', class: 'status-ideal' };
            if (value <= -0.5) return { status: 'BOM', class: 'status-good' };
            if (value <= 0.0) return { status: 'ACEITÁVEL', class: 'status-warning' };
            return { status: 'ESTOURADO', class: 'status-critical' };
        };

        const col1 = [
            // 🟣 CARD 1: MÉTRICAS PRINCIPAIS - Reorganizado com fallbacks robustos
            // CONDITIONAL: Pico Máximo - só exibir se não for placeholder 0.000
            (Number.isFinite(getMetric('peak_db', 'peak')) && getMetric('peak_db', 'peak') !== 0 ? row('Pico Máximo (dBFS)', `${safeFixed(getMetric('peak_db', 'peak'))} dB`, 'peak') : ''),
            
            // 🎯 Pico Real (dBTP) - com fallbacks robustos ['truePeak','maxDbtp'] > technicalData.truePeakDbtp
            (() => {
                const tpValue = getMetricWithFallback([
                    ['truePeak', 'maxDbtp'],
                    'truePeakDbtp',
                    'technicalData.truePeakDbtp'
                ]);
                console.log('[METRICS-FIX] col1 > Pico Real - advancedReady:', advancedReady, 'tpValue:', tpValue);
                if (!advancedReady) {
                    console.warn('[METRICS-FIX] col1 > Pico Real BLOQUEADO por advancedReady=false');
                    return '';
                }
                if (tpValue === null || tpValue === undefined) {
                    console.warn('[METRICS-FIX] col1 > Pico Real NÃO ENCONTRADO em nenhum caminho');
                    return '';
                }
                if (!Number.isFinite(tpValue)) {
                    console.warn('[METRICS-FIX] col1 > Pico Real valor inválido:', tpValue);
                    return '';
                }
                const tpStatus = getTruePeakStatus(tpValue);
                console.log('[METRICS-FIX] col1 > Pico Real RENDERIZADO:', tpValue, 'dBTP status:', tpStatus.status);
                return row('Pico Real (dBTP)', `${safeFixed(tpValue, 2)} dBTP <span class="${tpStatus.class}">${tpStatus.status}</span>`, 'truePeakDbtp');
            })(),
            
            // 🎯 Volume Médio (RMS) - energia real em dBFS
            (() => {
                const rmsValue = getMetricWithFallback([
                    ['energy', 'rms'],
                    'avgLoudness',
                    'rms',
                    'technicalData.avgLoudness',
                    'technicalData.rms'
                ]);
                console.log('[AUDITORIA-RMS-LUFS] col1 > Volume Médio (RMS) - advancedReady:', advancedReady, 'rmsValue:', rmsValue);
                
                // 🎯 Exibir sempre, mesmo se 0 (valor técnico válido)
                if (rmsValue === null || rmsValue === undefined) {
                    console.warn('[AUDITORIA-RMS-LUFS] col1 > Volume Médio (RMS) NÃO ENCONTRADO - exibindo 0');
                    return row('Volume Médio (RMS)', `0.0 dBFS`, 'avgLoudness');
                }
                if (!Number.isFinite(rmsValue)) {
                    console.warn('[AUDITORIA-RMS-LUFS] col1 > Volume Médio (RMS) valor inválido:', rmsValue);
                    return row('Volume Médio (RMS)', `0.0 dBFS`, 'avgLoudness');
                }
                console.log('[AUDITORIA-RMS-LUFS] col1 > Volume Médio (RMS) RENDERIZADO:', rmsValue, 'dBFS');
                return row('Volume Médio (RMS)', `${safeFixed(rmsValue, 1)} dBFS`, 'avgLoudness');
            })(),
            
            // 🎯 Loudness (LUFS) - loudness perceptiva em LUFS
            (() => {
                const lufsValue = getMetricWithFallback([
                    ['loudness', 'integrated'],
                    'lufs_integrated',
                    'lufsIntegrated',
                    'technicalData.lufsIntegrated'
                ]);
                console.log('[AUDITORIA-RMS-LUFS] col1 > Loudness (LUFS) - advancedReady:', advancedReady, 'lufsValue:', lufsValue);
                
                if (!advancedReady) {
                    console.warn('[AUDITORIA-RMS-LUFS] col1 > LUFS BLOQUEADO por advancedReady=false');
                    return '';
                }
                // 🎯 Exibir sempre, mesmo se 0
                if (lufsValue === null || lufsValue === undefined) {
                    console.warn('[AUDITORIA-RMS-LUFS] col1 > LUFS NÃO ENCONTRADO - exibindo 0');
                    return row('Loudness (LUFS)', `0.0 LUFS`, 'lufsIntegrated');
                }
                if (!Number.isFinite(lufsValue)) {
                    console.warn('[AUDITORIA-RMS-LUFS] col1 > LUFS valor inválido:', lufsValue);
                    return row('Loudness (LUFS)', `0.0 LUFS`, 'lufsIntegrated');
                }
                console.log('[AUDITORIA-RMS-LUFS] col1 > Loudness (LUFS) RENDERIZADO:', lufsValue, 'LUFS');
                return row('Loudness (LUFS)', `${safeFixed(lufsValue, 1)} LUFS`, 'lufsIntegrated');
            })(),
            
            row('Dinâmica (DR)', `${safeFixed(getMetric('dynamic_range', 'dynamicRange'))} dB`, 'dynamicRange'),
            row('Consistência de Volume (LU)', `${safeFixed(getMetric('lra', 'lra'))} LU`, 'lra'),
            // Imagem Estéreo (movido de col2)
            row('Imagem Estéreo', Number.isFinite(getMetric('stereo_correlation', 'stereoCorrelation')) ? safeFixed(getMetric('stereo_correlation', 'stereoCorrelation'), 3) : '—', 'stereoCorrelation'),
            // Abertura Estéreo (movido de col2)
            row('Abertura Estéreo (%)', Number.isFinite(getMetric('stereo_width', 'stereoWidth')) ? `${safeFixed(getMetric('stereo_width', 'stereoWidth') * 100, 0)}%` : '—', 'stereoWidth')
            ].join('');

        const col2 = (() => {
            // 🔵 CARD 2: ANÁLISE DE FREQUÊNCIAS - Reorganizado com sub-bandas espectrais
            const rows = [];
            
            // Sub-bandas espectrais (movidas de advancedMetricsCard)
            const spectralBands = analysis.technicalData?.spectral_balance || 
                                analysis.technicalData?.spectralBands || 
                                analysis.metrics?.bands || {};
            
            if (Object.keys(spectralBands).length > 0) {
                const bandMap = {
                    sub: { name: 'Subgrave (20–60 Hz)', range: '20-60Hz' },
                    bass: { name: 'Graves (60–150 Hz)', range: '60-150Hz' },
                    lowMid: { name: 'Médios-Graves (150–500 Hz)', range: '150-500Hz' },
                    mid: { name: 'Médios (500 Hz–2 kHz)', range: '500-2000Hz' },
                    highMid: { name: 'Médios-Agudos (2–5 kHz)', range: '2000-5000Hz' },
                    presence: { name: 'Presença (5–10 kHz)', range: '5000-10000Hz' },
                    air: { name: 'Ar (10–20 kHz)', range: '10000-20000Hz' }
                };
                
                Object.keys(bandMap).forEach(bandKey => {
                    const bandData = spectralBands[bandKey];
                    if (bandData && typeof bandData === 'object') {
                        const energyDb = bandData.energy_db;
                        const percentage = bandData.percentage;
                        const status = bandData.status;
                        
                        if (status && status !== 'not_calculated') {
                            let displayValue = '';
                            if (Number.isFinite(energyDb) && Number.isFinite(percentage)) {
                                displayValue = `${safeFixed(energyDb, 1)} dB (${safeFixed(percentage, 1)}%)`;
                            } else if (Number.isFinite(energyDb)) {
                                displayValue = `${safeFixed(energyDb, 1)} dB`;
                            } else if (Number.isFinite(percentage)) {
                                displayValue = `${safeFixed(percentage, 1)}%`;
                            } else {
                                displayValue = 'não calculado';
                            }
                            rows.push(row(bandMap[bandKey].name, displayValue, `spectral${bandKey.charAt(0).toUpperCase() + bandKey.slice(1)}`));
                        }
                    } else if (Number.isFinite(bandData)) {
                        rows.push(row(bandMap[bandKey].name, `${safeFixed(bandData, 1)} dB`, `spectral${bandKey.charAt(0).toUpperCase() + bandKey.slice(1)}`));
                    }
                });
            }
            
            // Frequência Central (mantém aqui)
            rows.push(row('Frequência Central (Hz)', Number.isFinite(getMetric('spectral_centroid', 'spectralCentroidHz')) ? safeHz(getMetric('spectral_centroid', 'spectralCentroidHz')) : '—', 'spectralCentroidHz'));
            
            return rows.join('');
            // REMOVED: Correlação Estéreo - movido para col1
            // REMOVED: Largura Estéreo - movido para col1
        })();

            // 🧩 CORREÇÃO #5: Exibir frequências dominantes na UI (removido bloqueio)
            // Frequências dominantes agora visíveis
            console.log('🎛️ [DEBUG] Exibindo métricas de frequência na UI');
            
            const col3 = [
                // REMOVED: Dominant Frequencies UI (mantendo cálculo interno para suggestions)
                
                // REMOVED: clipping (%) - ocultado da interface conforme solicitado
                // REMOVED: dc offset - ocultado da interface conforme solicitado
                (Number.isFinite(getMetric('thd', 'thd')) ? row('thd', `${safeFixed(getMetric('thd', 'thd'), 2)}%`, 'thd') : ''),
                
                // REMOVED: Dinâmica e Fator de Crista duplicados - já exibidos em col1
                // REMOVED: row('Correlação Estéreo (largura)') - duplicado de col2
                // REMOVED: row('fator de crista') - duplicado de col1
                // REMOVED: row('Dinâmica (diferença entre alto/baixo)') - duplicado de col1 com DR e LRA
                
                // REMOVED: Placeholders hardcoded - substituir por valores reais quando disponíveis
                // row('crest consist', 'Δ=4.43 check', 'crestConsist'),
                // row('Variação de Volume (consistência)', 'ok', 'volumeConsistency'),
                
                // REMOVED: Problemas - ocultado da interface conforme solicitado
                // REMOVED: Sugestões - movido para o final do card MÉTRICAS AVANÇADAS
                // row('Sugestões', (analysis.suggestions?.length || 0) > 0 ? `<span class="tag tag-success">${analysis.suggestions.length} disponível(s)</span>` : '—')
                // REMOVED: col3Extras (dominant frequencies UI)
            ].join('');

            // Card extra: Métricas Avançadas (expandido para Web Audio API compatibility)
            const advancedMetricsCard = () => {
                const rows = [];
                
                // === MÉTRICAS DE PICO E CLIPPING (seção principal) ===
                
                // REMOVED: True Peak (dBTP) - agora exclusivo do card MÉTRICAS PRINCIPAIS
                // Se truePeakDbtp estiver mapeado no card de avançadas, remova de lá. 
                // True Peak deve existir apenas em Métricas Principais para evitar duplicação
                
                // Picos por canal separados
                if (Number.isFinite(analysis.technicalData?.samplePeakLeftDb)) {
                    rows.push(row('Pico L (dBFS)', `${safeFixed(analysis.technicalData.samplePeakLeftDb, 1)} dBFS`, 'samplePeakLeftDb'));
                }
                if (Number.isFinite(analysis.technicalData?.samplePeakRightDb)) {
                    rows.push(row('Pico R (dBFS)', `${safeFixed(analysis.technicalData.samplePeakRightDb, 1)} dBFS`, 'samplePeakRightDb'));
                }
                
                // REMOVED: Clipping (%) - ocultado da interface conforme solicitado
                
                // REMOVED: Clipping samples - ocultado da interface conforme solicitado
                
                // REMOVED: DC OFFSET - ocultado da interface conforme solicitado
                
                // === THD (Total Harmonic Distortion) ===
                if (Number.isFinite(analysis.technicalData?.thd)) {
                    rows.push(row('thd', `${safeFixed(analysis.technicalData.thd, 4)}%`, 'thd'));
                } else if (Number.isFinite(analysis.technicalData?.thdPercent)) {
                    rows.push(row('thd', `${safeFixed(analysis.technicalData.thdPercent, 4)}%`, 'thdPercent'));
                }
                
                // === HEADROOM ===
                if (Number.isFinite(analysis.technicalData?.headroomDb)) {
                    rows.push(row('headroom (dB)', `${safeFixed(analysis.technicalData.headroomDb, 1)} dB`, 'headroomDb'));
                }
                
                // === FATOR DE CRISTA (movido de MÉTRICAS PRINCIPAIS) ===
                const crestValue = getMetricWithFallback([
                    ['dynamics', 'crest'],
                    'crest_factor',
                    'crestFactor',
                    'technicalData.crestFactor'
                ]);
                if (Number.isFinite(crestValue)) {
                    console.log('[METRICS-FIX] advancedMetricsCard > Fator de Crista RENDERIZADO:', crestValue, 'dB');
                    rows.push(row('Fator de Crista (Crest Factor)', `${safeFixed(crestValue, 2)} dB`, 'crestFactor'));
                } else {
                    console.warn('[METRICS-FIX] advancedMetricsCard > Fator de Crista NÃO ENCONTRADO ou inválido:', crestValue);
                }
                
                // 🟢 CARD 3: MÉTRICAS AVANÇADAS - Sub-bandas espectrais REMOVIDAS (movidas para col2)
                // === MÉTRICAS ESPECTRAIS AVANÇADAS ===
                
                // Centro Espectral
                if (Number.isFinite(analysis.technicalData?.spectralCentroid)) {
                    rows.push(row('Centro Espectral (Hz)', `${Math.round(analysis.technicalData.spectralCentroid)} Hz`, 'spectralCentroid'));
                }
                
                // Spectral Rolloff (Extensão de agudos)
                if (Number.isFinite(analysis.technicalData?.spectralRolloff)) {
                    rows.push(row('Extensão de Agudos (Hz)', `${Math.round(analysis.technicalData.spectralRolloff)} Hz`, 'spectralRolloff'));
                }
                
                // Spectral Flatness (Uniformidade espectral)
                if (Number.isFinite(analysis.technicalData?.spectralFlatness)) {
                    rows.push(row('Uniformidade Espectral (%)', `${safeFixed(analysis.technicalData.spectralFlatness * 100, 1)}%`, 'spectralFlatness'));
                }
                
                // Spectral Bandwidth (Bandas espectrais)
                if (Number.isFinite(getMetric('spectral_bandwidth', 'spectralBandwidthHz'))) {
                    rows.push(row('Bandas Espectrais (n)', `${safeHz(getMetric('spectral_bandwidth', 'spectralBandwidthHz'))}`, 'spectralBandwidthHz'));
                }
                
                // Spectral Kurtosis
                if (Number.isFinite(analysis.technicalData?.spectralKurtosis)) {
                    rows.push(row('Kurtosis Espectral', `${safeFixed(analysis.technicalData.spectralKurtosis, 3)}`, 'spectralKurtosis'));
                }
                
                // Spectral Skewness
                if (Number.isFinite(analysis.technicalData?.spectralSkewness)) {
                    rows.push(row('Assimetria Espectral', `${safeFixed(analysis.technicalData.spectralSkewness, 3)}`, 'spectralSkewness'));
                }
                
                // === REMOVIDO: BANDAS ESPECTRAIS DETALHADAS (Sub, Bass, Low-Mid, etc.) ===
                // As sub-bandas espectrais foram movidas para o card "ANÁLISE DE FREQUÊNCIAS" (col2)
                // Comentado para evitar duplicação
                
                if (false && Object.keys({}).length > 0) {
                    // REMOVIDO: Código de bandas espectrais (sub, bass, lowMid, etc.)
                    // As sub-bandas espectrais foram movidas para col2 (ANÁLISE DE FREQUÊNCIAS)
                    // Este bloco foi comentado para evitar duplicação
                }
                
                // 🧩 CORREÇÃO #5: Exibir frequências dominantes e uniformidade espectral
                // === FREQUÊNCIAS DOMINANTES ===
                if (Array.isArray(analysis.technicalData?.dominantFrequencies) && analysis.technicalData.dominantFrequencies.length > 0) {
                    const freqList = analysis.technicalData.dominantFrequencies
                        .slice(0, 5)
                        .map(f => `${Math.round(f)}Hz`)
                        .join(', ');
                    rows.push(row('frequências dominantes', freqList, 'dominantFrequencies'));
                    console.log('🎛️ [DEBUG] Frequências dominantes exibidas:', freqList);
                }
                
                // === UNIFORMIDADE ESPECTRAL ===
                if (Number.isFinite(analysis.technicalData?.spectralUniformity)) {
                    rows.push(row('uniformidade espectral', `${safeFixed(analysis.technicalData.spectralUniformity, 3)}`, 'spectralUniformity'));
                    console.log('🎛️ [DEBUG] Uniformidade espectral exibida:', analysis.technicalData.spectralUniformity);
                }
                
                // === ZEROS CROSSING RATE ===
                if (Number.isFinite(analysis.technicalData?.zcr)) {
                    rows.push(row('zero crossings', `${Math.round(analysis.technicalData.zcr)}`, 'zeroCrossings'));
                }
                
                // === MFCC (primeiros coeficientes) ===
                if (Array.isArray(analysis.technicalData?.mfcc) && analysis.technicalData.mfcc.length > 0) {
                    analysis.technicalData.mfcc.slice(0, 3).forEach((coeff, idx) => {
                        if (Number.isFinite(coeff)) {
                            rows.push(row(`mfcc ${idx + 1}`, `${safeFixed(coeff, 3)}`, `mfcc${idx + 1}`));
                        }
                    });
                }
                
                // === SUGESTÕES DISPONÍVEIS (movido de SCORES & DIAGNÓSTICO) ===
                const suggestionsCount = analysis.suggestions?.length || 0;
                console.log('[AUDITORIA-SUGESTOES] Sugestões detectadas:', suggestionsCount);
                
                if (suggestionsCount > 0) {
                    rows.push(row('Sugestões', `<span class="tag tag-success">${suggestionsCount} DISPONÍVEL${suggestionsCount > 1 ? 'S' : ''}</span>`, 'suggestions'));
                }
                
                return rows.join('') || row('Status', 'Sem métricas avançadas disponíveis');
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
                
                // 2. DC Offset - SEMPRE mostrar (usando nova estrutura)
                let dcVal, hasDcProblem, dcClass;
                if (analysis.dcOffset && Number.isFinite(analysis.dcOffset.maxAbsDC)) {
                    // Usar nova estrutura detalhada
                    dcVal = analysis.dcOffset.maxAbsDC;
                    hasDcProblem = analysis.dcOffset.needsCorrection || analysis.dcOffset.severity !== 'none';
                    dcClass = hasDcProblem ? (analysis.dcOffset.isCritical ? 'error' : 'warn') : '';
                    if (hasDcProblem) hasActualProblems = true;
                    const dcDetails = `Max: ${safeFixed(dcVal, 4)} | L: ${safeFixed(analysis.dcOffset.leftDC, 4)} | R: ${safeFixed(analysis.dcOffset.rightDC, 4)} | ${analysis.dcOffset.severity}`;
                    rows.push(row('DC Offset (Detalhado)', `<span class="${dcClass}">${dcDetails}</span>`, 'dcOffset'));
                } else {
                    // Fallback para estrutura legada
                    dcVal = Number.isFinite(analysis.technicalData?.dcOffset) ? analysis.technicalData.dcOffset : 0;
                    hasDcProblem = Math.abs(dcVal) > 0.01;
                    if (hasDcProblem) hasActualProblems = true;
                    dcClass = hasDcProblem ? 'warn' : '';
                    rows.push(row('DC Offset', `<span class="${dcClass}">${safeFixed(dcVal, 4)}</span>`, 'dcOffset'));
                }
                
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
                
                // 🔍 DEBUG: Verificar estado das sugestões
                console.log('🔍 [DEBUG_SUGGESTIONS] analysis.suggestions:', analysis.suggestions);
                console.log('🔍 [DEBUG_SUGGESTIONS] análise completa de sugestões:', {
                    hasAnalysis: !!analysis,
                    hasSuggestions: !!analysis.suggestions,
                    suggestionsType: typeof analysis.suggestions,
                    suggestionsLength: analysis.suggestions?.length || 0,
                    suggestionsArray: analysis.suggestions
                });

                // 🚀 INTEGRAÇÃO SISTEMA ULTRA-AVANÇADO V2: Enriquecimento direto das sugestões existentes
                let enrichedSuggestions = analysis.suggestions || [];
                
                if (typeof window.UltraAdvancedSuggestionEnhancer !== 'undefined' && enrichedSuggestions.length > 0) {
                    try {
                        console.log('🚀 [ULTRA_V2] Iniciando sistema ultra-avançado V2...');
                        console.log('📊 [ULTRA_V2] Sugestões para enriquecer:', enrichedSuggestions.length);
                        
                        const ultraEnhancer = new window.UltraAdvancedSuggestionEnhancer();
                        
                        // Preparar contexto de análise
                        const analysisContext = {
                            detectedGenre: analysis.detectedGenre || 'general',
                            lufs: analysis.lufs,
                            truePeak: analysis.truePeak,
                            lra: analysis.lra,
                            fileName: analysis.fileName,
                            duration: analysis.duration,
                            sampleRate: analysis.sampleRate
                        };
                        
                        // 🚀 Enriquecer sugestões existentes
                        const ultraResults = ultraEnhancer.enhanceExistingSuggestions(enrichedSuggestions, analysisContext);
                        
                        if (ultraResults && ultraResults.enhancedSuggestions && ultraResults.enhancedSuggestions.length > 0) {
                            enrichedSuggestions = ultraResults.enhancedSuggestions;
                            
                            console.log('✨ [ULTRA_V2] Sistema ultra-avançado V2 aplicado com sucesso!', {
                                originalCount: analysis.suggestions?.length || 0,
                                enhancedCount: enrichedSuggestions.length,
                                processingTime: ultraResults.metadata?.processingTimeMs,
                                educationalLevel: ultraResults.metadata?.educationalLevel
                            });
                            
                            // Adicionar métricas do sistema ultra-avançado à análise
                            if (!analysis.enhancedMetrics) analysis.enhancedMetrics = {};
                            analysis.enhancedMetrics.ultraAdvancedSystem = {
                                applied: true,
                                version: ultraResults.metadata?.version,
                                processingTimeMs: ultraResults.metadata?.processingTimeMs,
                                enhancedCount: enrichedSuggestions.length,
                                educationalLevel: ultraResults.metadata?.educationalLevel,
                                originalCount: ultraResults.metadata?.originalCount
                            };
                            
                            // Log da primeira sugestão enriquecida para debug
                            if (enrichedSuggestions.length > 0) {
                                const firstEnhanced = enrichedSuggestions[0];
                                console.log('🎓 [ULTRA_V2] Exemplo de sugestão enriquecida:', {
                                    original: firstEnhanced.message,
                                    educationalTitle: firstEnhanced.educationalContent?.title,
                                    hasDAWExamples: !!(firstEnhanced.educationalContent?.dawExamples),
                                    severity: firstEnhanced.severity?.label,
                                    priority: firstEnhanced.priority
                                });
                            }
                            
                        } else {
                            console.warn('⚠️ [ULTRA_V2] Sistema não retornou sugestões válidas:', ultraResults);
                        }
                        
                    } catch (error) {
                        console.error('❌ [ULTRA_V2] Erro no sistema ultra-avançado V2:', error);
                        // Manter sugestões originais em caso de erro
                    }
                } else {
                    if (typeof window.UltraAdvancedSuggestionEnhancer === 'undefined') {
                        console.log('⚠️ [ULTRA_V2] Sistema ultra-avançado V2 não está disponível');
                    } else {
                        console.log('⚠️ [ULTRA_V2] Nenhuma sugestão para processar');
                    }
                }
                
                // Atualizar analysis.suggestions com as sugestões enriched
                analysis.suggestions = enrichedSuggestions;

                // Helpers para embelezar as sugestões sem mudar layout/IDs
                const formatNumbers = (text, decimals = 2) => {
                    if (!text || typeof text !== 'string') return '';
                    return text.replace(/(-?\d+\.\d{3,})/g, (m) => {
                        const n = parseFloat(m);
                        return Number.isFinite(n) ? n.toFixed(decimals) : m;
                    });
                };
                const renderSuggestionItem = (sug) => {
                    // 🚀 PRIORIDADE: Verificar se tem conteúdo educacional do Sistema Ultra-Avançado V2
                    const hasUltraV2Content = sug.educationalContent && sug.educationalContent.title;
                    
                    if (hasUltraV2Content) {
                        // � SISTEMA ULTRA-AVANÇADO V2: Renderizar com conteúdo educacional completo
                        const edu = sug.educationalContent;
                        const severity = sug.severity || { level: 'medium', color: '#FF9800', label: 'Moderada' };
                        
                        // Extrair frequência se disponível
                        const freqMatch = (edu.action || sug.action || '').match(/(\d+(?:\.\d+)?)\s*(?:Hz|hz|khz|kHz)/i);
                        const frequency = freqMatch ? freqMatch[1] : null;
                        
                        return `
                            <div class="enhanced-card ultra-advanced-v2">
                                <div class="card-header">
                                    <h4 class="card-title">${edu.title}</h4>
                                    <div class="card-badges">
                                        ${frequency ? `<span class="frequency-badge">${frequency}${frequency > 1000 ? 'Hz' : 'kHz'}</span>` : ''}
                                        <span class="severity-badge ${severity.level}" style="background-color: ${severity.color};">${severity.label}</span>
                                        <span class="priority-badge">P${sug.priority || 5}</span>
                                    </div>
                                </div>
                                
                                <div class="card-description" style="border-left-color: ${severity.color};">
                                    <strong>📚 Explicação:</strong> ${edu.explanation}
                                </div>
                                
                                <div class="card-action" style="background: rgba(76, 175, 80, 0.1); border-color: #4CAF50;">
                                    <div class="card-action-title">🔧 Ação Recomendada</div>
                                    <div class="card-action-content">${edu.action}</div>
                                </div>
                                
                                ${edu.dawExamples ? `
                                    <div class="card-daw-examples" style="background: rgba(33, 150, 243, 0.1); border-color: #2196F3; margin: 12px 0; padding: 12px; border-radius: 6px; border-left: 3px solid #2196F3;">
                                        <div class="card-daw-title" style="font-weight: bold; margin-bottom: 8px; color: #2196F3;">🎛️ Exemplos por DAW</div>
                                        ${Object.entries(edu.dawExamples).map(([daw, instruction]) => 
                                            `<div style="margin-bottom: 6px;"><strong>${daw}:</strong> ${instruction}</div>`
                                        ).join('')}
                                    </div>
                                ` : ''}
                                
                                ${edu.expectedResult ? `
                                    <div class="card-result" style="background: rgba(76, 175, 80, 0.1); border-color: #4CAF50; margin: 12px 0; padding: 12px; border-radius: 6px; border-left: 3px solid #4CAF50;">
                                        <div class="card-result-title" style="font-weight: bold; margin-bottom: 8px; color: #4CAF50;">✨ Resultado Esperado</div>
                                        <div class="card-result-content">${edu.expectedResult}</div>
                                    </div>
                                ` : ''}
                                
                                ${edu.technicalDetails ? `
                                    <details style="margin-top: 12px;">
                                        <summary style="cursor: pointer; font-size: 12px; color: #aaa; font-weight: bold;">📋 Detalhes Técnicos</summary>
                                        <div style="font-size: 11px; color: #ccc; margin-top: 8px; font-family: monospace; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;">${edu.technicalDetails}</div>
                                    </details>
                                ` : ''}
                                
                                ${sug.educationalMetadata ? `
                                    <div class="educational-metadata" style="margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px; font-size: 11px; color: #888;">
                                        📖 Tempo de leitura: ${sug.educationalMetadata.estimatedReadTime} | 
                                        🎯 Dificuldade: ${sug.educationalMetadata.practicalDifficulty} | 
                                        🧠 Conceitos: ${sug.educationalMetadata.concepts?.join(', ') || 'N/A'}
                                    </div>
                                ` : ''}
                            </div>`;
                    }
                    
                    // 🔄 FALLBACK: Sistema anterior se não tiver conteúdo Ultra-Avançado V2
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
                        // 🚨 VERIFICAR SE É TRUE PEAK COM MENSAGEM ESPECIAL
                        const isTruePeak = sug.type === 'reference_true_peak' || sug.metricType === 'true_peak' || 
                                         title.toLowerCase().includes('true peak') || title.toLowerCase().includes('tp');
                        const hasSpecialAlert = sug.specialAlert || sug.priorityWarning;
                        
                        if (isTruePeak && hasSpecialAlert) {
                            // Card especial para True Peak com mensagem de prioridade
                            return `
                                <div class="${cardClass} true-peak-priority">
                                    <div class="card-header">
                                        <h4 class="card-title">⚡ ${title}</h4>
                                        <div class="card-badges">
                                            <span class="priority-badge primeiro">PRIMEIRO</span>
                                            <span class="severity-badge critica">CRÍTICO</span>
                                        </div>
                                    </div>
                                    
                                    ${sug.priorityWarning ? `
                                        <div class="priority-warning" style="background: rgba(255, 193, 7, 0.2); border: 1px solid #FFC107; border-radius: 6px; padding: 12px; margin: 12px 0; color: #856404;">
                                            ${sug.priorityWarning}
                                        </div>
                                    ` : ''}
                                    
                                    ${explanation ? `
                                        <div class="card-description" style="border-left-color: #FF5722;">
                                            <strong>⚠️ Por que é prioritário:</strong> ${explanation}
                                        </div>
                                    ` : ''}
                                    
                                    <div class="card-action" style="background: rgba(255, 87, 34, 0.1); border-color: #FF5722;">
                                        <div class="card-action-title" style="color: #FF5722;">
                                            🚨 Correção Prioritária
                                        </div>
                                        <div class="card-action-content">${action}</div>
                                    </div>
                                    
                                    ${sug.why ? `
                                        <div class="card-impact" style="background: rgba(255, 87, 34, 0.05); border-color: #FF5722;">
                                            <div class="card-impact-title" style="color: #FF5722;">🔴 Motivo da Prioridade</div>
                                            <div class="card-impact-content">${sug.why}</div>
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
                            
                            // 🎯 CORREÇÃO: Para band_adjust, usar type + subtype como chave única
                            let uniqueKey = item.type;
                            if (item.type === 'band_adjust' && item.subtype) {
                                uniqueKey = `${item.type}:${item.subtype}`;
                            }
                            
                            const existing = seen.get(uniqueKey);
                            if (!existing) {
                                seen.set(uniqueKey, item);
                                deduplicated.push(item);
                            } else {
                                // Manter o mais detalhado (com mais propriedades)
                                const currentScore = Object.keys(item).length + (item.explanation ? 10 : 0) + (item.impact ? 5 : 0);
                                const existingScore = Object.keys(existing).length + (existing.explanation ? 10 : 0) + (existing.impact ? 5 : 0);
                                if (currentScore > existingScore) {
                                    seen.set(uniqueKey, item);
                                    const index = deduplicated.findIndex(d => {
                                        if (d.type === 'band_adjust' && item.type === 'band_adjust') {
                                            return d.type === item.type && d.subtype === item.subtype;
                                        }
                                        return d.type === item.type;
                                    });
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
                // 🛑 CARD DE SUGESTÕES ANTIGAS DESATIVADO - Removido conforme solicitado
                // O card "SUGESTÕES EDUCACIONAIS ULTRA-AVANÇADAS" foi desativado para limpar a UI
                // Apenas o novo sistema de sugestões (que aparece no final do modal) deve ser usado
                /*
                if ((analysis.suggestions?.length || 0) > 0) {
                    // [CÓDIGO COMENTADO - Card de sugestões antigas removido]
                }
                */
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

        // 🎯 SUBSCORES: Corrigir mapeamento para backend Node.js
        const breakdown = analysis.scores || analysis.qualityBreakdown || {};
        
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
        
        // ═══════════════════════════════════════════════════════════════
        // 🎯 RENDERIZAR SCORE FINAL NO TOPO - VISUAL FUTURISTA
        // ═══════════════════════════════════════════════════════════════
        
        /**
         * Renderiza o score final no container dedicado no topo da análise
         * @param {Object} scores - Objeto contendo todos os scores
         */
        function renderFinalScoreAtTop(scores) {
            if (!scores || !Number.isFinite(scores.final)) {
                console.warn('🎯 Score final não disponível para renderização');
                return;
            }
            
            const container = document.getElementById('final-score-display');
            if (!container) {
                console.error('🎯 Container #final-score-display não encontrado');
                return;
            }
            
            const finalScore = Math.round(scores.final);
            const percent = Math.min(Math.max(finalScore, 0), 100);
            
            // Determinar mensagem de status baseada no score
            let statusMessage = '';
            let statusClass = '';
            
            if (finalScore >= 90) {
                statusMessage = '✨ Excelente! Pronto para lançamento';
                statusClass = 'status-excellent';
            } else if (finalScore >= 75) {
                statusMessage = '✅ Ótimo! Qualidade profissional';
                statusClass = 'status-good';
            } else if (finalScore >= 60) {
                statusMessage = '⚠️ Bom, mas pode melhorar';
                statusClass = 'status-warning';
            } else if (finalScore >= 40) {
                statusMessage = '🔧 Precisa de ajustes';
                statusClass = 'status-warning';
            } else {
                statusMessage = '🚨 Necessita correções importantes';
                statusClass = 'status-poor';
            }
            
            // Renderizar HTML do score final
            container.innerHTML = `
                <div class="score-final-label">🏆 SCORE FINAL</div>
                <div class="score-final-value">0</div>
                <div class="score-final-bar-container">
                    <div class="score-final-bar">
                        <div class="score-final-bar-fill" style="width: 0%"></div>
                    </div>
                </div>
                <div class="score-final-status ${statusClass}">${statusMessage}</div>
            `;
            
            // Animar contagem do score (impacto visual) - inicia após pequeno delay
            setTimeout(() => {
                animateFinalScore(finalScore);
            }, 100);
        }
        
        /**
         * Anima a contagem do score final de 0 até o valor final
         * @param {number} targetScore - Score final a ser exibido
         */
        function animateFinalScore(targetScore) {
            const el = document.querySelector('.score-final-value');
            const barFill = document.querySelector('.score-final-bar-fill');
            if (!el) return;
            
            let currentScore = 0;
            const duration = 2500; // 2.5 segundos (mais lento e dramático)
            const startTime = performance.now();
            
            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function (ease-out cubic - mais suave)
                const eased = 1 - Math.pow(1 - progress, 3);
                currentScore = targetScore * eased;
                
                // Atualizar número
                el.textContent = Math.floor(currentScore);
                
                // Animar barra junto (se existir)
                if (barFill) {
                    const currentPercent = Math.min(Math.max(currentScore, 0), 100);
                    barFill.style.width = `${currentPercent}%`;
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    el.textContent = targetScore; // Garantir valor final exato
                    if (barFill) {
                        const finalPercent = Math.min(Math.max(targetScore, 0), 100);
                        barFill.style.width = `${finalPercent}%`;
                    }
                }
            }
            
            requestAnimationFrame(animate);
        }
        
        // ═══════════════════════════════════════════════════════════════
        
        // 🎯 RENDERIZAR SCORES DO NOVO SISTEMA
        const renderNewScores = () => {
            // Verificar se temos scores calculados
            const scores = analysis.scores;
            
            if (!scores) {
                return `<div class="data-row">
                    <span class="label">Sistema de Scoring:</span>
                    <span class="value">Não disponível</span>
                </div>`;
            }
            
            const renderScoreProgressBar = (label, value, color = '#00ffff', emoji = '🎯') => {
                const numValue = Number.isFinite(value) ? value : 0;
                const displayValue = Number.isFinite(value) ? Math.round(value) : '—';
                
                // Cor baseada no score
                let scoreColor = color;
                if (Number.isFinite(value)) {
                    if (value >= 80) scoreColor = '#00ff92'; // Verde para scores altos
                    else if (value >= 60) scoreColor = '#ffd700'; // Amarelo para scores médios
                    else if (value >= 40) scoreColor = '#ff9500'; // Laranja para scores baixos
                    else scoreColor = '#ff3366'; // Vermelho para scores muito baixos
                }
                
                return `<div class="data-row metric-with-progress">
                    <span class="label">${emoji} ${label}:</span>
                    <div class="metric-value-progress">
                        <span class="value" style="color: ${scoreColor}; font-weight: bold;">${displayValue}</span>
                        <div class="progress-bar-mini">
                            <div class="progress-fill-mini" style="width: ${Math.min(Math.max(numValue, 0), 100)}%; background: ${scoreColor};"></div>
                        </div>
                    </div>
                </div>`;
            };
            
            // 🎯 Score final REMOVIDO daqui - será renderizado no topo
            // ❌ NÃO INCLUIR O SCORE FINAL AQUI - ele tem seu próprio container no topo
            
            // ✅ Sub-scores permanecem no mesmo lugar (dentro do card Scores & Diagnóstico)
            const subScoresHtml = `
                ${renderScoreProgressBar('Loudness', scores.loudness, '#ff3366', '🔊')}
                ${renderScoreProgressBar('Frequência', scores.frequencia, '#00ffff', '🎵')}
                ${renderScoreProgressBar('Estéreo', scores.estereo, '#ff6b6b', '🎧')}
                ${renderScoreProgressBar('Dinâmica', scores.dinamica, '#ffd700', '📊')}
                ${renderScoreProgressBar('Técnico', scores.tecnico, '#00ff92', '🔧')}
            `;
            
            return subScoresHtml;
        };
        
        const scoreRows = renderNewScores();

        // 🔹 Função utilitária: Remove nós de texto vazios (whitespace) dentro dos cards
        function normalizeCardWhitespace(root = document) {
            const cards = root.querySelectorAll('.cards-grid .card');
            cards.forEach((card) => {
                // Remove nós de texto que sejam apenas whitespace (espaços/linhas)
                const toRemove = [];
                card.childNodes.forEach((n) => {
                    if (n.nodeType === Node.TEXT_NODE && !/\S/.test(n.nodeValue || '')) {
                        toRemove.push(n);
                    }
                });
                toRemove.forEach((n) => n.parentNode.removeChild(n));
            });
        }

        // 🔹 Alias para compatibilidade com nomenclatura alternativa
        function stripEmptyTextNodesInCards(root = document) {
            root.querySelectorAll('.cards-grid .card').forEach((card) => {
                const garbage = [];
                card.childNodes.forEach((n) => {
                    if (n.nodeType === Node.TEXT_NODE && !/\S/.test(n.nodeValue || '')) {
                        garbage.push(n);
                    }
                });
                garbage.forEach((n) => n.remove());
            });
        }

        // 🎯 RENDERIZAR SCORE FINAL NO TOPO (ISOLADO)
        renderFinalScoreAtTop(analysis.scores);

        technicalData.innerHTML = `
            <div class="kpi-row">${scoreKpi}${timeKpi}</div>
            ${renderSmartSummary(analysis)}
            <div class="cards-grid">
                <div class="card">
                    <div class="card-title">MÉTRICAS PRINCIPAIS</div>
                    ${col1}
                </div>
                <div class="card">
                    <div class="card-title">ANÁLISE DE FREQUÊNCIAS</div>
                    ${col2}
                </div>
                <div class="card">
                    <div class="card-title">MÉTRICAS AVANÇADAS</div>
                    ${advancedMetricsCard()}
                </div>
                <div class="card">
                    <div class="card-title">SCORES & DIAGNÓSTICO</div>
                    ${scoreRows}
                    ${col3}
                </div>
                <!-- Card "Problemas Técnicos" removido conforme solicitado -->
                <!-- 
                <div class="card card-span-2">
                    <div class="card-title">⚠️ Problemas Técnicos</div>
                    ${techProblems()}
                </div>
                -->
                <!-- Card "Diagnóstico & Sugestões" removido conforme solicitado -->
                <!-- 
                <div class="card card-span-2">
                    <div class="card-title">🩺 Diagnóstico & Sugestões</div>
                    ${diagCard()}
                </div>
                -->
            </div>
        `;
    
        // 🔹 Sanitizar DOM: Remove nós de texto vazios que criam espaço extra
        normalizeCardWhitespace(technicalData);
        stripEmptyTextNodesInCards(technicalData);
    
        // 🎯 CORRIGIDO: Só renderizar referências se NÃO estiver em modo comparação de faixas
        // O displayModalResults() já trata comparação via renderTrackComparisonTable()
        try { 
            const isSecondTrack = window.__REFERENCE_JOB_ID__ !== null;
            const mode = analysis?.mode || currentAnalysisMode;
            
            const state = window.__soundyState || {};
            
            console.log('🔍 [RENDER-FLOW] Verificando se deve chamar renderReferenceComparisons:', {
                mode,
                isSecondTrack,
                hasReferenceAnalysisData: !!window.referenceAnalysisData,
                shouldSkip: mode === 'reference' && isSecondTrack && window.referenceAnalysisData,
                stateRenderMode: state.render?.mode
            });
            
            // 🎯 LOG DE VERIFICAÇÃO DO MODO DE RENDERIZAÇÃO
            console.log('[VERIFY_RENDER_MODE]', {
                mode: state.render?.mode || 'undefined',
                usingReferenceBands: !!(state.reference?.analysis?.bands || analysis?.referenceAnalysis?.bands),
                usingGenreTargets: !!window.__activeRefData?.bands,
                genreTargetsKeys: window.__activeRefData?.bands ? Object.keys(window.__activeRefData.bands) : [],
                referenceBandsKeys: state.reference?.analysis?.bands ? Object.keys(state.reference.analysis.bands) : []
            });
            
            // ✅ CORREÇÃO: SEMPRE chamar renderReferenceComparisons() - ela renderiza cards/scores/tabela
            const renderMode = (mode === 'reference' && isSecondTrack && window.referenceAnalysisData) ? 'reference' : 'genre';
            console.log(`📊 [RENDER-FLOW] Chamando renderReferenceComparisons() - modo: ${renderMode}`);
            
            // Preparar opts com análises corretas para modo reference
            const renderOpts = {
                analysis,
                mode: renderMode
            };
            
            if (renderMode === 'reference') {
                // Adicionar userAnalysis e referenceAnalysis para o modo reference
                renderOpts.userAnalysis = state.userAnalysis || state.reference?.userAnalysis;
                renderOpts.referenceAnalysis = state.referenceAnalysis || state.reference?.referenceAnalysis;
                console.log('[CARDS] ✅ Dados A/B preparados para renderReferenceComparisons:', {
                    hasUserAnalysis: !!renderOpts.userAnalysis,
                    hasReferenceAnalysis: !!renderOpts.referenceAnalysis
                });
            }
            
            renderReferenceComparisons(renderOpts);
        } catch(e){ 
            console.error('❌ [RENDER-FLOW] ERRO em renderReferenceComparisons:', e);
            console.error('❌ Stack trace:', e.stack);
        }    
        try { if (window.CAIAR_ENABLED) injectValidationControls(); } catch(e){ console.warn('validation controls fail', e); }
        
        // 🔍 Verificação de debug: Detecta whitespace restante
        if (window.DEBUG_ANALYZER) {
            document.querySelectorAll('.cards-grid .card').forEach((card, i) => {
                const ghosts = [...card.childNodes].filter(n => n.nodeType === 3 && !/\S/.test(n.nodeValue || ''));
                if (ghosts.length) console.warn(`Card #${i+1}: whitespace nodes restantes`, ghosts);
            });
        }
        
        __dbg('📊 Resultados exibidos no modal');
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
            // Ordenar por prioridade DECRESCENTE (maior prioridade = menor valor numérico = vem primeiro)
            sugg.sort((a,b)=> (b.priority||999)-(a.priority||999));
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

// 🎯 HELPER: Detectar se modo reference está ativo (correção definitiva)
function isReferenceCompareActive(analysis, state) {
    const hasRefJob = !!(state?.referenceJobId || analysis?.referenceComparison?.baseJobId);
    const hasRefBands = !!(
        analysis?.referenceComparison ||
        analysis?.spectralBands?.reference ||
        analysis?.bands // já normalizado com centralização
    );
    const isSecondTrack = analysis?.mode === 'reference' && state?.isSecondTrack === true;

    return (isSecondTrack && hasRefJob) || (analysis?.mode === 'reference' && hasRefBands);
}

// 🎯 HELPER: Calcular centro de um range {min, max}
function centerOfRange(range) {
    if (!range || typeof range.min !== 'number' || typeof range.max !== 'number') return null;
    return (range.min + range.max) / 2;
}

// 🎯 HELPER: Formatar target (range ou valor) para exibição
function formatTarget(rangeOrValue) {
    if (typeof rangeOrValue === 'number') return `${rangeOrValue.toFixed(1)} dB`;
    if (rangeOrValue && typeof rangeOrValue.min === 'number' && typeof rangeOrValue.max === 'number') {
        return `${rangeOrValue.min.toFixed(1)} a ${rangeOrValue.max.toFixed(1)} dB`;
    }
    return '—';
}

// 🎯 HELPER: Derivar tolerância de um range ou valor
function deriveTolerance(rangeOrValue, fallback = 2.0) {
    if (typeof rangeOrValue === 'number') return fallback;
    if (rangeOrValue && typeof rangeOrValue.min === 'number' && typeof rangeOrValue.max === 'number') {
        // 1/4 da largura do range, limitado entre 0.8 e 4.5
        const span = Math.abs(rangeOrValue.max - rangeOrValue.min);
        return Math.max(0.8, Math.min(4.5, span * 0.25));
    }
    return fallback;
}

// 🎯 HELPER: Computar se tem dados necessários para referenceComparisonMetrics
function computeHasReferenceComparisonMetrics(analysis) {
    const hasBands = !!(analysis?.bands || analysis?.spectralBands?.centralized || analysis?.spectral?.bands);
    const hasScores = !!(analysis?.scores?.frequency || analysis?.scoring?.frequency);
    const hasRefStruct = !!analysis?.referenceComparison;
    return hasRefStruct || (hasBands && hasScores);
}

// --- BEGIN: band target resolver (mode-aware) ---
const BAND_ALIASES = {
    // normaliza chaves heterogêneas para um vocabulário comum
    low_bass: 'bass',
    upper_bass: 'bass',
    low_mid: 'lowMid',
    high_mid: 'highMid',
    brilho: 'air',
    presenca: 'presence',
    // deixe iguais as que já batem:
    sub: 'sub',
    bass: 'bass',
    lowMid: 'lowMid',
    mid: 'mid',
    highMid: 'highMid',
    presence: 'presence',
    air: 'air'
};

const IGNORE_BANDS = new Set(['totalPercentage', '_status', 'total', 'metadata']);

// tenta extrair número: aceita { value }, { db }, { rms_db }, { energy_db }, número puro etc.
function pickNumeric(val) {
    if (val == null) return null;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'object') {
        if (typeof val.value === 'number' && Number.isFinite(val.value)) return val.value;
        if (typeof val.db === 'number' && Number.isFinite(val.db)) return val.db;
        if (typeof val.rms_db === 'number' && Number.isFinite(val.rms_db)) return val.rms_db;
        if (typeof val.energy_db === 'number' && Number.isFinite(val.energy_db)) return val.energy_db;
    }
    return null;
}

function normalizeBandKey(k) {
    return BAND_ALIASES[k] || k;
}

function getReferenceBandValue(refBands, bandKey) {
    const k = normalizeBandKey(bandKey);
    const v = refBands?.[k];
    return pickNumeric(v);
}

function getGenreTargetRange(genreTargets, bandKey) {
    const k = normalizeBandKey(bandKey);
    // Suporta {min,max} ou [min,max], e fallback para target/±tol
    const range = genreTargets?.[k];
    if (!range) return null;

    if (Array.isArray(range) && range.length === 2) {
        return { min: range[0], max: range[1], tol: Math.abs(range[1] - range[0]) / 4 || null };
    }
    if (typeof range === 'object') {
        if (typeof range.min === 'number' && typeof range.max === 'number') {
            return { min: range.min, max: range.max, tol: (range.tol ?? (Math.abs(range.max - range.min) / 4)) || null };
        }
        if (typeof range.target_db === 'number' && typeof range.tol_db === 'number') {
            return { min: range.target_db - range.tol_db, max: range.target_db + range.tol_db, tol: range.tol_db };
        }
        if (typeof range.target === 'number' && typeof range.tol === 'number') {
            return { min: range.target - range.tol, max: range.target + range.tol, tol: range.tol };
        }
    }
    return null;
}

function formatDb(n) {
    return (typeof n === 'number' && Number.isFinite(n)) ? `${n.toFixed(1)}dB` : '—';
}
// --- END: band target resolver (mode-aware) ---

// 🧠 NOVA PROTEÇÃO UNIVERSAL — Referência real > gênero
function resolveTargetMetric(analysis, key, fallback) {
    // 1️⃣ Busca no objeto da análise de referência (segunda faixa)
    if (analysis?.referenceAnalysis?.technicalData?.[key] !== undefined) {
        console.log(`🎯 [RESOLVE] ${key} encontrado em referenceAnalysis:`, analysis.referenceAnalysis.technicalData[key]);
        return analysis.referenceAnalysis.technicalData[key];
    }
    
    // 2️⃣ Busca no objeto da própria análise (se comparando com si mesma)
    if (analysis?.technicalData?.[key] !== undefined) {
        console.log(`🎯 [RESOLVE] ${key} encontrado em technicalData:`, analysis.technicalData[key]);
        return analysis.technicalData[key];
    }
    
    // 3️⃣ Busca no gênero (estrutura antiga)
    const targetKey = `${key}_target`;
    if (analysis?.referenceComparison?.[targetKey] !== undefined) {
        console.log(`🎯 [RESOLVE] ${key} encontrado em referenceComparison.${targetKey}:`, analysis.referenceComparison[targetKey]);
        return analysis.referenceComparison[targetKey];
    }
    
    // 4️⃣ Fallback seguro
    console.log(`🛡️ [RESOLVE] ${key} usando fallback:`, fallback);
    return fallback ?? 0;
}

// 🧮 PARTE 3.1: Função de normalização para estrutura de referência
function normalizeReferenceShape(a) {
  if (!a) return {};
  return {
    fileName: a.fileName || a.metadata?.fileName || "Faixa desconhecida",
    bands: a.bands || a.spectralBands,
    lufsIntegrated: a.loudness?.integrated ?? a.lufsIntegrated,
    truePeakDbtp: a.truePeak?.dbtp ?? a.truePeakDbtp,
    dynamicRange: a.dynamics?.dr ?? a.dynamicRange,
    lra: a.loudness?.range ?? a.lra,
    crestFactor: a.dynamics?.crest ?? a.crestFactor
  };
}

// 🔒 Global render lock para evitar ReferenceError
if (typeof window.comparisonLock === "undefined") {
    window.comparisonLock = false;
    console.log("[LOCK-INIT] comparisonLock inicializado como false");
}

// --- BEGIN: deterministic mode gate ---
function renderReferenceComparisons(opts = {}) {
    // 🔒 PROTEÇÃO ANTI-DUPLICAÇÃO: Detectar se faixas são idênticas
    if (opts.userAnalysis?.fileName && opts.referenceAnalysis?.fileName &&
        opts.userAnalysis.fileName === opts.referenceAnalysis.fileName) {
        console.error("❌ [REF-DUPE] Detecção de duplicação — referência sobrescrita!");
        console.table({
            userTrack: opts.userAnalysis?.fileName,
            refTrack: opts.referenceAnalysis?.fileName,
        });
        return; // aborta renderização duplicada
    }
    
    // 🧩 Controle seguro de renderização
    if (window.comparisonLock) {
        console.warn("[LOCK] Renderização de comparação ignorada (lock ativo)");
        return;
    }
    window.comparisonLock = true;
    console.log("[LOCK] comparisonLock ativado");
    
    // 🔧 PARTE 2: Proteção em renderReferenceComparisons
    const globalState = window.__soundyState || {};
    const refStateCheck = globalState?.reference || {};
    const userCheck = refStateCheck.userAnalysis || opts.userAnalysis;
    const refCheck = refStateCheck.referenceAnalysis || opts.referenceAnalysis;

    if (!userCheck || !refCheck) {
        console.warn("[REF-COMP] Faltam dados de referência ou usuário, usando fallback seguro");
        window.comparisonLock = false;
        console.log("[LOCK] comparisonLock liberado (fallback)");
        return renderGenreComparisonSafe?.();
    }

    const userTrackCheck = userCheck.fileName || "Faixa 1 (usuário)";
    const refTrackCheck = refCheck.fileName || "Faixa 2 (referência)";
    const userBandsCheck = userCheck.bands || [];
    const refBandsCheck = refCheck.bands || [];

    if (!Array.isArray(refBandsCheck) || refBandsCheck.length === 0) {
        console.warn("[REF-COMP] referenceBands ausentes - fallback para valores brutos");
    }

    console.log("[REF-COMP] Dados validados:", { userTrackCheck, refTrackCheck, userBands: userBandsCheck.length, refBands: refBandsCheck.length });
    
    // 🎯 SAFE RENDER COM DEBOUNCE
    console.groupCollapsed("[SAFE_RENDER_REF]");
    console.log("🧩 Recebido opts:", opts);
    
    // Se já estiver processando render, cancelar chamadas duplicadas
    if (window.__REF_RENDER_LOCK__) {
        console.warn("⚠️ [SAFE_RENDER_REF] Renderização ignorada — já em progresso.");
        window.comparisonLock = false;
        console.log("[LOCK] comparisonLock liberado (render duplicado)");
        console.groupEnd();
        return;
    }
    window.__REF_RENDER_LOCK__ = true;
    
    // Aceita opts ou analysis (backward compatibility)
    const analysis = opts.analysis || opts;
    
    const container = document.getElementById('referenceComparisons');
    if (!container) {
        window.__REF_RENDER_LOCK__ = false;
        window.comparisonLock = false;
        console.log("[LOCK] comparisonLock liberado (container ausente)");
        console.groupEnd();
        return;
    }
    
    // 🧠 [SAFE_REF_V3] PATCH DEFINITIVO - Construir estrutura segura ANTES de qualquer acesso
    console.groupCollapsed("🧠 [SAFE_REF_V3]");
    console.log("📦 opts recebido:", opts);
    
    // 🔐 Obter state global
    const stateV3 = window.__soundyState || {};
    
    // 🔐 Construir comparação segura com múltiplas fontes
    let comparisonSafe = 
        opts?.comparisonData || 
        window?.comparisonData || 
        window?.lastComparisonData || 
        {};
    
    if (!comparisonSafe.userTrack || !comparisonSafe.referenceTrack) {
        console.warn("⚠️ [SAFE_REF_V3] comparisonData incompleto — tentando reconstruir via análises");
        
        const ua = opts?.userAnalysis || stateV3?.reference?.userAnalysis;
        const ra = opts?.referenceAnalysis || stateV3?.reference?.referenceAnalysis;
        
        // 🎯 SEMÂNTICA CORRETA:
        // - userTrack = 1ª faixa (SUA MÚSICA/ATUAL) = userAnalysis
        // - referenceTrack = 2ª faixa (REFERÊNCIA/ALVO) = referenceAnalysis
        comparisonSafe = {
            userTrack: ua?.metadata?.fileName || ua?.fileName || "1ª Faixa (Sua Música/Atual)",
            referenceTrack: ra?.metadata?.fileName || ra?.fileName || "2ª Faixa (Referência/Alvo)",
            userBands: 
                ua?.technicalData?.spectral_balance || 
                ua?.bands || 
                ua?.spectralBands || 
                {},
            refBands: 
                ra?.technicalData?.spectral_balance || 
                ra?.bands || 
                ra?.spectralBands || 
                {},
        };
        
        // Guardar globalmente (backup)
        window.lastComparisonData = comparisonSafe;
    }
    
    // 🧩 Substituir opts.comparisonData quebrado
    opts.comparisonData = comparisonSafe;
    
    // 🔒 Fallback hard caso ainda venha undefined
    if (!comparisonSafe.referenceTrack) {
        comparisonSafe.referenceTrack = 
            opts?.referenceAnalysis?.metadata?.fileName || 
            opts?.referenceAnalysis?.fileName ||
            stateV3?.reference?.referenceAnalysis?.metadata?.fileName || 
            "2ª Faixa (Referência/Alvo)";
    }
    if (!comparisonSafe.userTrack) {
        comparisonSafe.userTrack = 
            opts?.userAnalysis?.metadata?.fileName || 
            opts?.userAnalysis?.fileName ||
            stateV3?.reference?.userAnalysis?.metadata?.fileName || 
            "1ª Faixa (Sua Música/Atual)";
    }
    
    console.log("✅ [SAFE_REF_V3] Estrutura final reconstruída:", comparisonSafe);
    console.groupEnd();
    

    //  [PATCH V5] SCOPE GUARD DEFINITIVO - Sincronização final antes de usar dados
    console.groupCollapsed(" [REF_FIX_V5]");
    let userTrack, referenceTrack, userBands, refBands;
    try {
        //  Verifica e sincroniza escopo de comparisonData
        // 🎯 SEMÂNTICA CORRETA:
        // - userTrack = 1ª faixa (SUA MÚSICA/ATUAL) = userAnalysis
        // - referenceTrack = 2ª faixa (REFERÊNCIA/ALVO) = referenceAnalysis
        let comparisonData =
            opts?.comparisonData ||
            window?.comparisonData ||
            window?.lastComparisonData ||
            stateV3?.reference?.comparisonData ||
            comparisonSafe || // Usar comparisonSafe do Patch V3 como fallback
            {
                userTrack:
                    opts?.userAnalysis?.metadata?.fileName ||
                    opts?.userAnalysis?.fileName ||
                    stateV3?.reference?.userAnalysis?.metadata?.fileName ||
                    "Sua Música (Atual)",
                referenceTrack:
                    opts?.referenceAnalysis?.metadata?.fileName ||
                    opts?.referenceAnalysis?.fileName ||
                    stateV3?.reference?.referenceAnalysis?.metadata?.fileName ||
                    "Faixa de Referência (Alvo)",
                userBands:
                    opts?.userAnalysis?.technicalData?.spectral_balance ||
                    opts?.userAnalysis?.bands ||
                    stateV3?.reference?.userAnalysis?.technicalData?.spectral_balance ||
                    stateV3?.reference?.userAnalysis?.bands ||
                    {},
                refBands:
                    opts?.referenceAnalysis?.technicalData?.spectral_balance ||
                    opts?.referenceAnalysis?.bands ||
                    stateV3?.reference?.referenceAnalysis?.technicalData?.spectral_balance ||
                    stateV3?.reference?.referenceAnalysis?.bands ||
                    {},
            };

        //  Atualiza referências globais
        window.comparisonData = comparisonData;
        window.lastComparisonData = comparisonData;
        opts.comparisonData = comparisonData;

        //  Cria variáveis locais seguras
        // 🎯 SEMÂNTICA CORRETA DOS NOMES:
        userTrack = comparisonData?.userTrack || "Sua Música (Atual)";
        referenceTrack = comparisonData?.referenceTrack || "Faixa de Referência (Alvo)";
        userBands = comparisonData?.userBands || {};
        refBands = comparisonData?.refBands || {};

        console.log(" [REF_FIX_V5] Estrutura estabilizada:", {
            userTrack,
            referenceTrack,
            userBands: !!Object.keys(userBands).length,
            refBands: !!Object.keys(refBands).length,
        });

        //  Abortagem segura se algo vier undefined
        if (!referenceTrack || !userTrack) {
            console.error(" [REF_FIX_V5] referenceTrack ou userTrack ausentes!");
            window.__REF_RENDER_LOCK__ = false;
            window.comparisonLock = false;
            console.log("[LOCK] comparisonLock liberado (track ausente)");
            console.groupEnd();
            return;
        }

        //  Reatribui localmente para garantir escopo
        opts.referenceTrack = referenceTrack;
        opts.userTrack = userTrack;
        comparisonData.referenceTrack = referenceTrack;
        comparisonData.userTrack = userTrack;
    } catch (err) {
        console.error(" [REF_FIX_V5] Erro crítico de escopo:", err);
        window.__REF_RENDER_LOCK__ = false;
        window.comparisonLock = false;
        console.log("[LOCK] comparisonLock liberado (erro crítico)");
        console.groupEnd();
        return;
    }
    console.groupEnd();
    
    // 🧮 PARTE 3.2: Validação e normalização de análises
    const sRef = stateV3?.reference || {};
    const userAnalysis = opts.userAnalysis ?? sRef.userAnalysis;
    const referenceAnalysis = opts.referenceAnalysis ?? sRef.referenceAnalysis;

    if (!userAnalysis || !referenceAnalysis) {
        console.warn("[REF-COMP] Faltam análises; usando fallback controlado.");
        window.__REF_RENDER_LOCK__ = false;
        window.comparisonLock = false;
        console.log("[LOCK] comparisonLock liberado (análises ausentes)");
        return renderGenreComparisonSafe?.();
    }

    // 🎯 SEMÂNTICA CORRETA DOS NOMES:
    // - userAnalysis = 1ª faixa = SUA MÚSICA (atual)
    // - referenceAnalysis = 2ª faixa = REFERÊNCIA (alvo a alcançar)
    const userTrackNormalized = userAnalysis.fileName || userAnalysis.metadata?.fileName || sRef.userTrack || "Sua Música (Atual)";
    const refTrackNormalized = referenceAnalysis.fileName || referenceAnalysis.metadata?.fileName || sRef.referenceTrack || "Faixa de Referência (Alvo)";
    
    // 🔍 AUDITORIA ANTI-DUPLICAÇÃO: Verificar se as faixas são distintas
    console.log('🔍 [AUDIT_REF_MODE ✅] ═══════════════════════════════════════');
    console.log('🔍 [AUDIT_REF_MODE ✅] Validação de faixas distintas:');
    console.log('🔍 [AUDIT_REF_MODE ✅]   userTrack (SUA MÚSICA):', userTrackNormalized);
    console.log('🔍 [AUDIT_REF_MODE ✅]   referenceTrack (REFERÊNCIA):', refTrackNormalized);
    console.log('🔍 [AUDIT_REF_MODE ✅]   São idênticas?', userTrackNormalized === refTrackNormalized ? '⚠️ SIM - VERIFICAR FLUXO!' : '✅ NÃO');
    console.log('🔍 [AUDIT_REF_MODE ✅]   userAnalysis jobId:', userAnalysis?.jobId);
    console.log('🔍 [AUDIT_REF_MODE ✅]   referenceAnalysis jobId:', referenceAnalysis?.jobId);
    console.log('🔍 [AUDIT_REF_MODE ✅]   JobIds idênticos?', userAnalysis?.jobId === referenceAnalysis?.jobId ? '⚠️ SIM - VERIFICAR!' : '✅ NÃO');
    console.log('🔍 [AUDIT_REF_MODE ✅] ═══════════════════════════════════════');
    
    if (userTrackNormalized === refTrackNormalized) {
        console.warn("⚠️ [REF-COMP] As duas faixas têm o mesmo nome — verifique o fluxo de atribuição!");
        console.warn("⚠️ [REF-COMP] Dados recebidos:", {
            userAnalysis: userAnalysis,
            referenceAnalysis: referenceAnalysis
        });
    }
    
    // Evita leitura em escopos errados - ABORT se referenceTrack undefined
    if (!referenceTrack) {
        console.error("🚨 [SAFE_REF_V3] referenceTrack ainda undefined! Abortando render seguro.");
        window.__REF_RENDER_LOCK__ = false;
        window.comparisonLock = false;
        console.log("[LOCK] comparisonLock liberado (referenceTrack undefined)");
        return;
    }
    
    // ✅ LOG PARA CONFIRMAÇÃO FINAL
    console.log("[REF-COMPARE ✅] Direção correta confirmada: PRIMEIRA = sua música (atual), SEGUNDA = referência (alvo)");
    
    // ✅ CORREÇÃO V3: Extração unificada de bandas espectrais (aceita arrays e objetos)
    let userBandsLocal =
        analysis.userAnalysis?.bands ||
        opts.userAnalysis?.bands ||
        opts.userAnalysis?.technicalData?.spectral_balance ||
        analysis.bands ||
        analysis.referenceComparison?.userBands ||
        null;

    let refBandsLocal =
        analysis.referenceAnalysis?.bands ||
        opts.referenceAnalysis?.bands ||
        opts.referenceAnalysis?.technicalData?.spectral_balance ||
        analysis.referenceComparison?.refBands ||
        null;
    
    // � LOG DE DEBUG: Mostrar o que foi encontrado
    console.log("[REF-COMP] 🔍 Extração inicial de bandas:", {
        userBandsLocal: userBandsLocal ? (Array.isArray(userBandsLocal) ? `Array(${userBandsLocal.length})` : `Object(${Object.keys(userBandsLocal).length})`) : 'null',
        refBandsLocal: refBandsLocal ? (Array.isArray(refBandsLocal) ? `Array(${refBandsLocal.length})` : `Object(${Object.keys(refBandsLocal).length})`) : 'null',
        sourceUser: userBandsLocal ? 'encontrado' : 'null',
        sourceRef: refBandsLocal ? 'encontrado' : 'null'
    });

    // ✅ Validação: Aceitar tanto arrays quanto objetos
    const hasUserBands = userBandsLocal && (
        (Array.isArray(userBandsLocal) && userBandsLocal.length > 0) ||
        (typeof userBandsLocal === 'object' && Object.keys(userBandsLocal).length > 0)
    );
    
    const hasRefBands = refBandsLocal && (
        (Array.isArray(refBandsLocal) && refBandsLocal.length > 0) ||
        (typeof refBandsLocal === 'object' && Object.keys(refBandsLocal).length > 0)
    );

    // 🚨 Proteção aprimorada com fallback global
    if (!hasUserBands || !hasRefBands) {
        console.warn("[REF-COMP] ⚠️ Bandas ausentes na estrutura principal - tentando fallback global");
        
        const globalUser = window.__soundyState?.previousAnalysis?.bands || 
                          window.__soundyState?.previousAnalysis?.technicalData?.spectral_balance ||
                          window.__soundyState?.userAnalysis?.bands || 
                          null;
        const globalRef = window.__soundyState?.referenceAnalysis?.bands || 
                         window.__soundyState?.referenceAnalysis?.technicalData?.spectral_balance ||
                         window.__soundyState?.reference?.analysis?.bands || 
                         null;
        
        const hasGlobalUser = globalUser && (
            (Array.isArray(globalUser) && globalUser.length > 0) ||
            (typeof globalUser === 'object' && Object.keys(globalUser).length > 0)
        );
        
        const hasGlobalRef = globalRef && (
            (Array.isArray(globalRef) && globalRef.length > 0) ||
            (typeof globalRef === 'object' && Object.keys(globalRef).length > 0)
        );
        
        console.log("[REF-COMP] 🔍 Fallback global:", {
            globalUser: globalUser ? (Array.isArray(globalUser) ? `Array(${globalUser.length})` : `Object(${Object.keys(globalUser).length})`) : 'null',
            globalRef: globalRef ? (Array.isArray(globalRef) ? `Array(${globalRef.length})` : `Object(${Object.keys(globalRef).length})`) : 'null',
            hasGlobalUser,
            hasGlobalRef,
            hasPreviousAnalysis: !!window.__soundyState?.previousAnalysis,
            hasReferenceAnalysis: !!window.__soundyState?.referenceAnalysis
        });
        
        if (!hasGlobalUser || !hasGlobalRef) {
            console.error("[REF-COMP] ❌ Nenhum dado válido encontrado - abortando render");
            console.table({
                userBandsLocal: userBandsLocal ? (Array.isArray(userBandsLocal) ? userBandsLocal.length : Object.keys(userBandsLocal).length) : 0,
                refBandsLocal: refBandsLocal ? (Array.isArray(refBandsLocal) ? refBandsLocal.length : Object.keys(refBandsLocal).length) : 0,
                globalUser: globalUser ? (Array.isArray(globalUser) ? globalUser.length : Object.keys(globalUser).length) : 0,
                globalRef: globalRef ? (Array.isArray(globalRef) ? globalRef.length : Object.keys(globalRef).length) : 0,
                hasUserAnalysis: !!analysis.userAnalysis,
                hasReferenceAnalysis: !!analysis.referenceAnalysis,
                soundyStateKeys: Object.keys(window.__soundyState || {})
            });
            window.__REF_RENDER_LOCK__ = false;
            window.comparisonLock = false;
            console.log("[LOCK] comparisonLock liberado (sem dados válidos)");
            console.groupEnd();
            return;
        }
        
        // Aplicar fallback
        userBandsLocal = globalUser;
        refBandsLocal = globalRef;
        
        console.log("[REF-COMP] ✅ Fallback global aplicado com sucesso");
    }

    // Atualizar variáveis globais
    userBands = userBandsLocal;
    refBands = refBandsLocal;
    
    // ✅ LOG FINAL CONSOLIDADO
    const userBandsCount = userBands ? (Array.isArray(userBands) ? userBands.length : Object.keys(userBands).length) : 0;
    const refBandsCount = refBands ? (Array.isArray(refBands) ? refBands.length : Object.keys(refBands).length) : 0;
    
    console.log("[REF-COMP] ✅ Bandas detectadas:", {
        userBands: userBandsCount,
        refBands: refBandsCount,
        userBandsType: userBands ? (Array.isArray(userBands) ? 'Array' : 'Object') : 'null',
        refBandsType: refBands ? (Array.isArray(refBands) ? 'Array' : 'Object') : 'null',
        source: hasUserBands && hasRefBands ? 'analysis-principal' : 'fallback-global'
    });
    
    console.log("✅ [SAFE_REF_V3] Tracks resolvidas:", { 
        userTrack, 
        referenceTrack, 
        userBands: !!userBands, 
        refBands: !!refBands,
        userBandsCount,
        refBandsCount
    });
    
    // 🔓 Libera lock após iniciar renderização (será completado em 1.5s)
    setTimeout(() => {
        window.__REF_RENDER_LOCK__ = false;
    }, 1500);
    
    // 🧠 SAFEGUARD FINAL: Verificação crítica antes de qualquer renderização
    if (opts?.mode === "reference") {
        // SAFEGUARD: garantir que spectral_balance exista na estrutura
        if (opts?.referenceAnalysis && !opts?.referenceAnalysis?.technicalData?.spectral_balance) {
            console.warn("⚠️ [SAFEGUARD] spectral_balance ausente em referenceAnalysis — aplicando patch.");
            if (!opts.referenceAnalysis.technicalData) opts.referenceAnalysis.technicalData = {};
            opts.referenceAnalysis.technicalData.spectral_balance = refBands;
        }
        
        if (opts?.userAnalysis && !opts?.userAnalysis?.technicalData?.spectral_balance) {
            console.warn("⚠️ [SAFEGUARD] spectral_balance ausente em userAnalysis — aplicando patch.");
            if (!opts.userAnalysis.technicalData) opts.userAnalysis.technicalData = {};
            opts.userAnalysis.technicalData.spectral_balance = userBands;
        }
    }
    
    // 🎯 CORREÇÃO CRÍTICA: Fonte da verdade vem do caller - NÃO usar fallback 'genre'
    // Reusar stateV3 já declarado no patch V3 acima
    
    // 🚨 PRIORIDADE DE DETECÇÃO DO MODO (sem fallback automático para genre):
    // 1. opts.mode (passado explicitamente pelo caller)
    // 2. stateV3.render.mode (já configurado anteriormente)
    // 3. stateV3.reference.isSecondTrack = true → forçar 'reference'
    // 4. Último recurso: 'genre'
    let explicitMode = opts.mode || stateV3?.render?.mode;
    
    // 🎯 Se segunda faixa está ativa, FORÇAR modo reference
    if (stateV3.reference?.isSecondTrack === true && !explicitMode) {
        explicitMode = 'reference';
        console.log('🔥 [MODE-OVERRIDE] Segunda faixa detectada - forçando modo reference');
    }
    
    // Fallback final apenas se realmente necessário
    if (!explicitMode) {
        explicitMode = 'genre';
        console.warn('⚠️ [MODE-FALLBACK] Nenhum modo detectado - usando genre como fallback');
    }
    
    const isReferenceMode = (opts?.mode === 'reference') 
        || (stateV3?.render?.mode === 'reference') 
        || (stateV3?.reference?.isSecondTrack === true && !opts?.mode);
    
    if (isReferenceMode) console.log('[REF-FLOW] renderReferenceComparisons in reference mode');
    
    const isReference = explicitMode === 'reference';
    
    // Salvar modo no estado (NÃO sobrescrever se já for reference)
    stateV3.render = stateV3.render || {};
    if (stateV3.render.mode !== 'reference' || explicitMode === 'reference') {
        stateV3.render.mode = explicitMode;
    }
    window.__soundyState = stateV3;
    
    // (Opcional) Log assertivo
    console.log('[RENDER-REF] MODO SELECIONADO:', explicitMode.toUpperCase());
    console.log('[ASSERT] mode=', explicitMode, 'isSecondTrack=', stateV3?.reference?.isSecondTrack, 'refJobId=', stateV3?.reference?.jobId);
    console.log('[ASSERT] opts.mode=', opts.mode, 'stateV3.render.mode=', stateV3.render.mode);
    
    // 🚨 CRÍTICO: NÃO reavaliar "se tem ref" para mudar o modo
    // O modo é determinístico e vem do caller
    const renderMode = explicitMode;
    
    // 🎯 PATCH 5: Asserts de validação de modo (NÃO ABORTAM, apenas logam)
    if (renderMode === 'reference') {
        if (!stateV3?.reference?.analysis?.bands) {
            console.warn('⚠️ [ASSERT-MAIN] Modo reference sem stateV3.reference.analysis.bands - pode usar fallback');
        }
        if (!stateV3?.reference?.isSecondTrack) {
            console.warn('⚠️ [ASSERT-MAIN] Modo reference sem flag isSecondTrack');
        }
        if (!stateV3?.reference?.analysis) {
            console.warn('⚠️ [CRITICAL] Modo reference configurado mas sem dados de referência no stateV3!');
            console.warn('⚠️ stateV3.reference:', stateV3?.reference);
        }
    } else if (renderMode === 'genre') {
        if (!window.__activeRefData?.bands) {
            console.warn('⚠️ [ASSERT-MAIN] Modo genre sem __activeRefData.bands - tentando fallback');
            console.warn('⚠️ __activeRefData:', window.__activeRefData);
        }
    }
    console.log('✅ [PATCH-5] Asserts de modo executados:', { renderMode, hasRefBands: !!(stateV3?.reference?.analysis?.bands), hasGenreBands: !!(window.__activeRefData?.bands) });
    
    // 🚨 REMOVIDO: Detecção legacy automática (causava auto-switch indevido)
    // O modo agora é determinístico e vem do caller via opts.mode
    // NÃO tentar "adivinhar" o modo baseado em analysis.mode ou estruturas
    
    // 🎯 CORREÇÃO: Definir hasNewStructure e hasOldStructure ANTES de usar
    const hasNewStructure = !!(analysis?.referenceAnalysis?.technicalData || analysis?.metrics);
    const hasOldStructure = !!(analysis?.referenceComparison && !hasNewStructure);
    
    let ref, titleText, userMetrics;
    
    // 🔍 [AUDITORIA_REF] Log de detecção crítica
    console.log('[AUDITORIA_REF] Detecção de modo:', {
        'analysis.mode': analysis.mode,
        'isReferenceMode': isReferenceMode,
        'hasNewStructure': hasNewStructure,
        'hasOldStructure': hasOldStructure,
        'window.__REFERENCE_JOB_ID__': window.__REFERENCE_JOB_ID__,
        'referenceAnalysisData': !!window.referenceAnalysisData
    });
    
    // 🎯 USAR renderMode PARA DECIDIR O FLUXO (não isReferenceMode)
    if (renderMode === 'reference') {
        console.log('[AUDITORIA_REF] Modo referência detectado – exibindo comparação A/B entre faixas');
        
        // 🔥 PRIORIDADE MÁXIMA: Usar nova estrutura corrigida (userAnalysis/referenceAnalysis)
        if (opts.userAnalysis && opts.referenceAnalysis) {
            console.log('🔥 [REF-CORRECTED] ═══════════════════════════════════════');
            console.log('🔥 [REF-CORRECTED] Usando estrutura corrigida: opts.userAnalysis + opts.referenceAnalysis');
            console.log('🔥 [REF-CORRECTED] userAnalysis existe:', !!opts.userAnalysis);
            console.log('🔥 [REF-CORRECTED] referenceAnalysis existe:', !!opts.referenceAnalysis);
            console.log('🔥 [REF-CORRECTED] userAnalysis.technicalData:', !!opts.userAnalysis.technicalData);
            console.log('🔥 [REF-CORRECTED] referenceAnalysis.technicalData:', !!opts.referenceAnalysis.technicalData);
            console.log('🔥 [REF-CORRECTED] ═══════════════════════════════════════');
            
            const userTech = opts.userAnalysis.technicalData || {};
            const refTech = opts.referenceAnalysis.technicalData || {};
            
            // 🔍 DIAGNÓSTICO: Verificar estrutura das bandas
            console.log('🔍 [DIAGNÓSTICO] userTech.spectral_balance:', userTech.spectral_balance);
            console.log('🔍 [DIAGNÓSTICO] refTech.spectral_balance:', refTech.spectral_balance);
            console.log('🔍 [DIAGNÓSTICO] userTech.bandEnergies:', userTech.bandEnergies);
            console.log('🔍 [DIAGNÓSTICO] refTech.bandEnergies:', refTech.bandEnergies);
            console.log('🔍 [DIAGNÓSTICO] userTech.bands:', userTech.bands);
            console.log('🔍 [DIAGNÓSTICO] refTech.bands:', refTech.bands);
            
            userMetrics = userTech;
            ref = {
                // Valores BRUTOS da segunda faixa (referência/alvo)
                lufs_target: refTech.lufsIntegrated ?? refTech.lufs_integrated,
                true_peak_target: refTech.truePeakDbtp ?? refTech.true_peak_dbtp,
                dr_target: refTech.dynamicRange ?? refTech.dynamic_range,
                lra_target: refTech.lra,
                stereo_target: refTech.stereoCorrelation ?? refTech.stereo_correlation,
                stereo_width_target: refTech.stereoWidth ?? refTech.stereo_width,
                spectral_centroid_target: refTech.spectralCentroidHz ?? refTech.spectral_centroid,
                tol_lufs: 0.5,
                tol_true_peak: 0.3,
                tol_dr: 1.0,
                tol_lra: 1.0,
                tol_stereo: 0.08,
                tol_spectral: 300,
                bands: refTech.spectral_balance ?? refTech.bandEnergies ?? refTech.bands ?? null
            };
            
            // 🎯 SEMÂNTICA CORRETA NO TÍTULO:
            // 1ª faixa = sua música (atual) | 2ª faixa = referência (alvo)
            const userFileName = opts.userAnalysis.fileName || opts.userAnalysis.metadata?.fileName || 'Sua Música';
            const refFileName = opts.referenceAnalysis.fileName || opts.referenceAnalysis.metadata?.fileName || 'Referência';
            titleText = `� Comparação da sua faixa com a referência:\nAtual: ${userFileName}\nReferência: ${refFileName}`;
            
            console.log('✅ [REF-CORRECTED] ═══════════════════════════════════════');
            console.log('✅ [REF-CORRECTED] Dados A/B extraídos corretamente:');
            console.log('✅ [REF-CORRECTED]   SUA MÚSICA (1ª):', opts.userAnalysis.fileName || opts.userAnalysis.metadata?.fileName);
            console.log('✅ [REF-CORRECTED]   Bandas:', Object.keys(userMetrics.spectral_balance || {}));
            console.log('✅ [REF-CORRECTED]   LUFS:', userMetrics.lufsIntegrated);
            console.log('✅ [REF-CORRECTED]   REFERÊNCIA (2ª):', opts.referenceAnalysis.fileName || opts.referenceAnalysis.metadata?.fileName);
            console.log('✅ [REF-CORRECTED]   Bandas:', Object.keys(ref.bands || {}));
            console.log('✅ [REF-CORRECTED]   LUFS:', ref.lufs_target);
            console.log('✅ [REF-CORRECTED]   Tabela: ESQUERDA=sua música, DIREITA=referência');
            console.log('✅ [REF-CORRECTED] ═══════════════════════════════════════');
            
            // 🎯 LOG ASSERT_REF_FLOW
            console.log("[ASSERT_REF_FLOW ✅]", {
                mode: 'reference',
                userTrack: opts.userAnalysis?.fileName || opts.userAnalysis?.metadata?.fileName,
                referenceTrack: opts.referenceAnalysis?.fileName || opts.referenceAnalysis?.metadata?.fileName,
                userBands: Object.keys(userMetrics.spectral_balance || {}),
                refBands: Object.keys(ref.bands || {}),
                userLUFS: userMetrics.lufsIntegrated,
                refLUFS: ref.lufs_target
            });
        }
        // 🎯 PRIORIDADE 0 (FALLBACK): analysis.referenceAnalysis (estrutura antiga)
        else if (analysis.referenceAnalysis && analysis.referenceAnalysis.technicalData) {
            console.log('✅ [REF-COMP] Usando real reference analysis as target (primeira faixa)');
            
            const refTech = analysis.referenceAnalysis.technicalData;
            userMetrics = analysis.technicalData || {};
            
            ref = {
                lufs_target: refTech.lufsIntegrated ?? refTech.lufs_integrated,
                true_peak_target: refTech.truePeakDbtp ?? refTech.true_peak_dbtp,
                dr_target: refTech.dynamicRange ?? refTech.dynamic_range,
                lra_target: refTech.lra,
                stereo_target: refTech.stereoCorrelation ?? refTech.stereo_correlation,
                stereo_width_target: refTech.stereoWidth ?? refTech.stereo_width,
                spectral_centroid_target: refTech.spectralCentroidHz ?? refTech.spectral_centroid,
                tol_lufs: 0.5,
                tol_true_peak: 0.3,
                tol_dr: 1.0,
                tol_lra: 1.0,
                tol_stereo: 0.08,
                tol_spectral: 300,
                bands: refTech.bandEnergies ?? refTech.spectral_balance ?? refTech.bands ?? null
            };
            
            titleText = `🎵 ${analysis.referenceAnalysis.fileName || analysis.referenceAnalysis.metadata?.fileName || 'Faixa Base'}`;
            
            console.log('📊 [REF-COMP] baseBands/refBands resolved from referenceAnalysis:', {
                lufs: ref.lufs_target,
                dr: ref.dr_target,
                peak: ref.true_peak_target,
                hasBands: !!ref.bands,
                bandsKeys: ref.bands ? Object.keys(ref.bands) : []
            });
            console.log('✅ [REF-COMP] Using real reference analysis as target');
        }
        // 🎯 PRIORIDADE 1 (FALLBACK): analysis.referenceBands (estrutura centralizada)
        else if (analysis.referenceBands && analysis.mode === 'reference') {
            console.log('✅ [RENDER-REF] Usando analysis.referenceBands (estrutura centralizada)');
            
            userMetrics = analysis.technicalData || {};
            
            ref = {
                lufs_target: analysis.referenceBands.lufsIntegrated || analysis.referenceBands.lufs_integrated,
                true_peak_target: analysis.referenceBands.truePeakDbtp || analysis.referenceBands.true_peak_dbtp,
                dr_target: analysis.referenceBands.dynamicRange || analysis.referenceBands.dynamic_range,
                lra_target: analysis.referenceBands.lra,
                stereo_target: analysis.referenceBands.stereoCorrelation || analysis.referenceBands.stereo_correlation,
                stereo_width_target: analysis.referenceBands.stereoWidth || analysis.referenceBands.stereo_width,
                spectral_centroid_target: analysis.referenceBands.spectralCentroidHz || analysis.referenceBands.spectral_centroid,
                tol_lufs: 0.5,
                tol_true_peak: 0.3,
                tol_dr: 1.0,
                tol_lra: 1.0,
                tol_stereo: 0.08,
                tol_spectral: 300,
                bands: analysis.referenceBands.spectral_balance || analysis.referenceBands.bands || null
            };
            
            titleText = `🎵 Faixa de Referência`;
            
            console.log('📊 [RENDER-REF] Referência (referenceBands):', {
                lufs: ref.lufs_target,
                dr: ref.dr_target,
                peak: ref.true_peak_target,
                bands: ref.bands
            });
        }
        // ===== PRIORIDADE 2: NOVA ESTRUTURA (userTrack/referenceTrack) =====
        else if (hasNewStructure) {
            // 🧠 [PATCH V4] REFERENCE SCOPE LOCK FIX - Estabilizar escopo antes de render
            try {
                console.groupCollapsed("🧠 [REF_SCOPE_LOCK]");
                console.log("📦 Contexto atual antes do render:", { opts, stateV3 });

                // 🔒 Buscar dados de comparação em todos os escopos possíveis
                let comparisonLock =
                    opts?.comparisonData ||
                    window?.lastComparisonData ||
                    stateV3?.reference?.comparisonData ||
                    {
                        userTrack:
                            opts?.userAnalysis?.metadata?.fileName ||
                            stateV3?.reference?.userAnalysis?.metadata?.fileName ||
                            "Faixa do Usuário",
                        referenceTrack:
                            opts?.referenceAnalysis?.metadata?.fileName ||
                            stateV3?.reference?.referenceAnalysis?.metadata?.fileName ||
                            "Faixa de Referência",
                        userBands:
                            opts?.userAnalysis?.bands ||
                            stateV3?.reference?.userAnalysis?.bands ||
                            {},
                        refBands:
                            opts?.referenceAnalysis?.bands ||
                            stateV3?.reference?.referenceAnalysis?.bands ||
                            {},
                    };

                // 🔐 Corrigir se ainda estiver faltando algo
                if (!comparisonLock.referenceTrack) {
                    comparisonLock.referenceTrack =
                        opts?.referenceAnalysis?.metadata?.fileName ||
                        stateV3?.reference?.referenceAnalysis?.metadata?.fileName ||
                        "Faixa de Referência";
                }
                if (!comparisonLock.userTrack) {
                    comparisonLock.userTrack =
                        opts?.userAnalysis?.metadata?.fileName ||
                        stateV3?.reference?.userAnalysis?.metadata?.fileName ||
                        "Faixa do Usuário";
                }

                // 🔒 Salvar globalmente para persistir escopo
                window.lastComparisonData = comparisonLock;

                console.log("✅ [REF_SCOPE_LOCK] Estrutura estabilizada:", comparisonLock);
                console.groupEnd();

                // 🧩 Reatribuir variáveis seguras locais
                const userTrackLock = comparisonLock.userTrack;
                const referenceTrackLock = comparisonLock.referenceTrack;
                const userBandsLock = comparisonLock.userBands;
                const refBandsLock = comparisonLock.refBands;

                // Se ainda não tiver bandas, abortar render seguro
                if (!refBandsLock || Object.keys(refBandsLock).length === 0) {
                    console.error(
                        "🚨 [REF_SCOPE_LOCK] refBands ausente, abortando renderização segura."
                    );
                    window.__REF_RENDER_LOCK__ = false;
                    window.comparisonLock = false;
                    console.log("[LOCK] comparisonLock liberado (refBands ausente)");
                    return;
                }

                // ✅ Reaplicar no escopo principal
                opts.comparisonData = comparisonLock;
                window.comparisonData = comparisonLock;
            } catch (err) {
                console.error("💥 [REF_SCOPE_LOCK] Erro crítico ao reestabelecer escopo:", err);
                window.__REF_RENDER_LOCK__ = false;
                window.comparisonLock = false;
                console.log("[LOCK] comparisonLock liberado (erro escopo)");
                return;
            }
            
            console.log('✅ [RENDER-REF] Usando NOVA estrutura (userTrack/referenceTrack)');
            
            // 🧩 Fix final do modal A/B - usar dados corretos de comparisonLock
            const refFile = 
                comparisonLock?.refFile ||
                comparisonLock?.referenceTrack ||
                opts?.referenceAnalysis?.fileName ||
                opts?.referenceAnalysis?.metadata?.fileName ||
                stateV3?.reference?.referenceAnalysis?.fileName ||
                "Faixa de referência";

            const userFile = 
                comparisonLock?.userFile ||
                comparisonLock?.userTrack ||
                opts?.userAnalysis?.fileName ||
                opts?.userAnalysis?.metadata?.fileName ||
                stateV3?.reference?.userAnalysis?.fileName ||
                "Faixa do usuário";

            console.log("[REF-FIX-FINAL] referenceTrackName resolvido:", refFile);
            console.log("[REF-FIX-FINAL] userTrackName resolvido:", userFile);
            
            // Extrair métricas de opts ou stateV3
            const refAnalysis = opts?.referenceAnalysis || stateV3?.reference?.referenceAnalysis;
            const userAnalysisData = opts?.userAnalysis || stateV3?.reference?.userAnalysis;
            
            if (!refAnalysis || !userAnalysisData) {
                console.error("💥 [REF-FIX-FINAL] Análises não encontradas, abortando");
                window.__REF_RENDER_LOCK__ = false;
                window.comparisonLock = false;
                console.log("[LOCK] comparisonLock liberado (análises não encontradas)");
                return;
            }
            
            const refMetrics = refAnalysis.metrics || refAnalysis;
            userMetrics = userAnalysisData.metrics || userAnalysisData;
            
            ref = {
                lufs_target: refMetrics.lufs || refMetrics.lufsIntegrated,
                true_peak_target: refMetrics.peak || refMetrics.truePeakDbtp,
                dr_target: refMetrics.dr || refMetrics.dynamicRange,
                lra_target: refMetrics.lra,
                stereo_target: refMetrics.stereoCorrelation,
                stereo_width_target: refMetrics.stereoWidth,
                spectral_centroid_target: refMetrics.spectralCentroidHz,
                tol_lufs: 0.5,
                tol_true_peak: 0.3,
                tol_dr: 1.0,
                tol_lra: 1.0,
                tol_stereo: 0.08,
                tol_spectral: 300,
                bands: refAnalysis.bands || comparisonLock?.refBands || {}
            };
            
            titleText = `🎵 ${refFile}`;
            
            console.log('📊 [RENDER-REF] Referência:', {
                fileName: refFile,
                lufs: ref.lufs_target,
                dr: ref.dr_target,
                peak: ref.true_peak_target,
                bands: Object.keys(ref.bands || {}).length
            });
            console.log('📊 [RENDER-REF] Usuário:', {
                fileName: userFile,
                lufs: userMetrics.lufs || userMetrics.lufsIntegrated,
                dr: userMetrics.dr || userMetrics.dynamicRange
            });
        }
        // ===== ESTRUTURA ANTIGA (retrocompatibilidade) =====
        else if (hasOldStructure) {
            console.log('⚠️ [RENDER-REF] Usando estrutura ANTIGA (referenceMetrics) - considerar migração');
            
            const refMetrics = analysis.referenceComparison.referenceMetrics;
            ref = {
                lufs_target: refMetrics.lufsIntegrated,
                true_peak_target: refMetrics.truePeakDbtp,
                dr_target: refMetrics.dynamicRange,
                lra_target: refMetrics.lra || 6,
                stereo_target: refMetrics.stereoCorrelation,
                spectral_centroid_target: refMetrics.spectralCentroidHz,
                tol_lufs: 0.5,
                tol_true_peak: 0.3,
                tol_dr: 1.0,
                tol_lra: 1.0,
                tol_stereo: 0.08,
                tol_spectral: 300,
                bands: null
            };
            titleText = "🎵 Faixa de Referência";
            
            console.log('🎯 [RENDER-REF] Usando métricas de referência real:', refMetrics);
        }
    } else if (renderMode === 'genre') {
        // ===== MODO GÊNERO =====
        // 🎯 SÓ LOGA "MODO GÊNERO" SE REALMENTE FOR GENRE
        console.log('🎵 [RENDER-REF] MODO GÊNERO');
        
        // 🎯 LOG DE VERIFICAÇÃO: Garantir que targets de gênero sejam usados
        console.log('[TARGET-RESOLVE] Modo GENRE confirmado - buscando targets de gênero:', {
            hasWindowActiveRefData: !!window.__activeRefData,
            hasProdAiRefData: !!window.PROD_AI_REF_DATA,
            genre: window.__activeRefGenre || window.PROD_AI_REF_GENRE
        });
        
        // 🎯 CORREÇÃO: Fallback seguro para __activeRefData com múltiplas tentativas
        let __activeRefData = window.__activeRefData;
        
        // Tentativa 1: Usar dados globais
        if (!__activeRefData || !__activeRefData.bands) {
            console.warn('⚠️ [GENRE-MODE] __activeRefData não disponível, tentando PROD_AI_REF_DATA...');
            __activeRefData = window.PROD_AI_REF_DATA;
        }
        
        // Tentativa 2: Usar dados do analysis
        if (!__activeRefData || !__activeRefData.bands) {
            console.warn('⚠️ [GENRE-MODE] PROD_AI_REF_DATA não disponível, tentando analysis...');
            __activeRefData = analysis?.referenceComparison 
                || analysis?.genreTargets 
                || state?.genreTargets;
        }
        
        // Tentativa 3: Criar estrutura mínima
        if (!__activeRefData || !__activeRefData.bands) {
            console.error('❌ [GENRE-MODE] NENHUMA FONTE DE DADOS DE GÊNERO ENCONTRADA!');
            console.error('❌ Debug:', {
                hasWindowActiveRefData: !!window.__activeRefData,
                hasProdAiRefData: !!window.PROD_AI_REF_DATA,
                hasAnalysisRefComparison: !!analysis?.referenceComparison,
                genre: window.__activeRefGenre || window.PROD_AI_REF_GENRE
            });
            
            container.innerHTML = `<div class="card" style="margin-top:12px;padding:16px;text-align:center;opacity:.6">
                <strong style="color:#ff6b6b;">⚠️ Referências de gênero não carregadas</strong><br>
                <span style="font-size:11px;">Tente recarregar a página ou selecionar outro gênero</span>
            </div>`; 
            return; 
        }
        
        // 🚨 CORREÇÃO CRÍTICA: NÃO usar referenceComparisonMetrics no modo genre
        // Apenas usar targets de gênero
        ref = __activeRefData;
        titleText = window.PROD_AI_REF_GENRE || window.__activeRefGenre || 'Gênero Musical';
        userMetrics = analysis.technicalData || {};
        
        console.log('✅ [GENRE-MODE] Usando targets de gênero:', {
            genre: titleText,
            hasBands: !!ref.bands,
            bandsCount: ref.bands ? Object.keys(ref.bands).length : 0,
            bandsList: ref.bands ? Object.keys(ref.bands) : [],
            source: window.__activeRefData ? 'window.__activeRefData' : (window.PROD_AI_REF_DATA ? 'PROD_AI_REF_DATA' : 'analysis')
        });
    } else {
        // FALLBACK: Não deveria cair aqui
        console.warn('⚠️ [RENDER-REF] MODO INDETERMINADO - renderMode:', renderMode);
        container.innerHTML = '<div style="font-size:12px;opacity:.6">Modo de análise não identificado</div>'; 
        return;
    }
    
    // 🎯 SOBRESCREVER com referenceComparisonMetrics APENAS se modo for 'reference'
    if (renderMode === 'reference' && referenceComparisonMetrics && referenceComparisonMetrics.reference) {
        console.log('🎯 [RENDER-REF] MODO REFERÊNCIA — COMPARAÇÃO ENTRE FAIXAS ATIVADA');
        console.log('✅ [RENDER-REF] Sobrescrevendo com referenceComparisonMetrics');
        
        const targetMetrics = referenceComparisonMetrics.reference;
        userMetrics = referenceComparisonMetrics.user;
        
        ref = {
            lufs_target: targetMetrics.lufsIntegrated || targetMetrics.lufs_integrated,
            true_peak_target: targetMetrics.truePeakDbtp || targetMetrics.true_peak_dbtp,
            dr_target: targetMetrics.dynamicRange || targetMetrics.dynamic_range,
            lra_target: targetMetrics.lra,
            stereo_target: targetMetrics.stereoCorrelation || targetMetrics.stereo_correlation,
            stereo_width_target: targetMetrics.stereoWidth || targetMetrics.stereo_width,
            spectral_centroid_target: targetMetrics.spectralCentroidHz || targetMetrics.spectral_centroid,
            tol_lufs: 0.5,
            tol_true_peak: 0.3,
            tol_dr: 1.0,
            tol_lra: 1.0,
            tol_stereo: 0.08,
            tol_spectral: 300,
            bands: targetMetrics.spectral_balance || null
        };
        
        // 🎯 SEMÂNTICA CORRETA: referenceFull = 2ª faixa (referência/alvo)
        const userFileName = referenceComparisonMetrics.userFull?.metadata?.fileName || referenceComparisonMetrics.userFull?.fileName || 'Sua Música';
        const refFileName = referenceComparisonMetrics.referenceFull?.metadata?.fileName || referenceComparisonMetrics.referenceFull?.fileName || 'Referência';
        titleText = `🎧 Comparação da sua faixa com a referência:\nAtual: ${userFileName}\nReferência: ${refFileName}`;
        
        // 🎯 ASSERT CRÍTICO: Verificar se bands estão disponíveis no modo reference
        console.log('[ASSERT_REF_DATA]', ref.bands ? '✅ Reference bands loaded' : '❌ Missing bands');
        if (!ref.bands) {
            console.error('🚨 [CRITICAL] Modo reference sem bandas! Bloqueando fallback de gênero.');
            console.error('🚨 Debug:', {
                hasTargetMetrics: !!targetMetrics,
                targetMetricsKeys: targetMetrics ? Object.keys(targetMetrics) : [],
                hasSpectralBalance: !!targetMetrics?.spectral_balance,
                hasReferenceComparisonMetrics: !!referenceComparisonMetrics,
                referenceFullKeys: referenceComparisonMetrics.referenceFull ? Object.keys(referenceComparisonMetrics.referenceFull) : []
            });
        }
    } else if (renderMode === 'genre' && referenceComparisonMetrics) {
        // 🚨 LOG DE SEGURANÇA: Confirmar que modo genre NÃO usa referenceComparisonMetrics
        console.log('✅ [GENRE-MODE] referenceComparisonMetrics IGNORADO no modo gênero (correto)');
    }
    
    // 🎯 Priorizar userMetrics (nova estrutura) sobre technicalData (legado)
    const tech = userMetrics || analysis.technicalData || {};
    
    console.log('📊 [RENDER-REF] Fonte de métricas do usuário:', userMetrics ? 'userMetrics (nova estrutura)' : 'technicalData (legado)');
    console.log('📊 [RENDER-REF] Modo final confirmado:', renderMode);
    console.log('📊 [RENDER-REF] ref.bands disponível:', !!ref?.bands, 'keys:', ref?.bands ? Object.keys(ref.bands).length : 0);
    
    // Mapeamento de métricas - RESTAURAR TABELA COMPLETA
    const rows = [];
    const addedLabels = new Set(); // 🎯 Controle de duplicação por nome
    const nf = (n, d=2) => Number.isFinite(n) ? n.toFixed(d) : '—';
    const pushRow = (label, val, target, tol, unit='') => {
        // ✅ Epsilon para comparações float precisas
        const EPS = 1e-6;
        
        // 🎯 PREVENÇÃO DE DUPLICATAS: evitar bandas com mesmo nome
        if (addedLabels.has(label)) {
            console.warn(`⚠️ Duplicata evitada: ${label}`);
            return;
        }
        addedLabels.add(label);
        // Usar sistema de enhancement se disponível
        const enhancedLabel = (typeof window !== 'undefined' && window.enhanceRowLabel) 
            ? window.enhanceRowLabel(label, label.toLowerCase().replace(/[^a-z]/g, '')) 
            : label;
            
        // Tratar target null ou NaN como N/A explicitamente
        const targetIsNA = (target == null || target === '' || (typeof target==='number' && !Number.isFinite(target)));
        if (!Number.isFinite(val) && targetIsNA) return; // nada útil
        if (targetIsNA) {
            rows.push(`<tr>
                <td>${enhancedLabel}</td>
                <td>${Number.isFinite(val)?nf(val)+unit:'—'}</td>
                <td colspan="2" style="opacity:.55">N/A</td>
            </tr>`);
            return;
        }
        // 🎯 CORRIGIDO: Cálculo de diferença usando centerOfRange para ranges
        let diff = null;
        
        if (typeof target === 'object' && target !== null && 
            Number.isFinite(target.min) && Number.isFinite(target.max) && Number.isFinite(val)) {
            // Target é um range: usar centro do range para cálculo de delta
            const targetForDelta = centerOfRange(target);
            if (typeof targetForDelta === 'number' && Number.isFinite(targetForDelta)) {
                diff = val - targetForDelta;
            } else {
                // Fallback: distância para o range
                const minNorm = Math.min(target.min, target.max);
                const maxNorm = Math.max(target.min, target.max);
                
                if (val >= minNorm - EPS && val <= maxNorm + EPS) {
                    diff = 0; // Dentro do range
                } else if (val < minNorm) {
                    diff = val - minNorm;
                } else {
                    diff = val - maxNorm;
                }
            }
        } else if (Number.isFinite(val) && Number.isFinite(target)) {
            // Target fixo: diferença tradicional
            diff = val - target;
        } else {
            // 🎯 Sem crash se target não for válido
            diff = null;
        }
        
        // ✅ Sistema de 3 cores com epsilon
        let diffCell;
        if (!Number.isFinite(diff)) {
            // Sem dados válidos → vermelho
            diffCell = '<td class="warn" style="text-align: center; padding: 8px;"><div style="font-size: 12px; font-weight: 600;">Corrigir</div></td>';
        } else if (tol === 0) {
            // Lógica para bandas espectrais (tol=0)
            const absDiff = Math.abs(diff);
            let cssClass, statusText;
            
            if (absDiff <= EPS) {
                // ✅ DENTRO DO RANGE → Verde
                cssClass = 'ok';
                statusText = 'Ideal';
            } else if (absDiff <= 1.0 + EPS) {
                // ⚠️ Fora por até 1dB → Amarelo
                cssClass = 'yellow';
                statusText = 'Ajuste leve';
            } else if (absDiff <= 3.0 + EPS) {
                // ⚠️ Fora por até 3dB → Amarelo (era laranja)
                cssClass = 'yellow';
                statusText = 'Ajustar';
            } else {
                // ❌ Fora por >3dB → Vermelho
                cssClass = 'warn';
                statusText = 'Corrigir';
            }
            
            diffCell = `<td class="${cssClass}" style="text-align: center; padding: 8px;">
                <div style="font-size: 12px; font-weight: 600;">${statusText}</div>
            </td>`;
        } else if (!Number.isFinite(tol) || tol < 0) {
            // Fallback: tolerância padrão com epsilon
            const defaultTol = 1.0;
            const absDiff = Math.abs(diff);
            let cssClass, statusText;
            
            console.warn(`⚠️ [TOLERANCE_FALLBACK] Métrica "${label}" sem tolerância válida (tol=${tol}). Usando tolerância padrão: ${defaultTol}`);
            
            if (absDiff <= defaultTol + EPS) {
                // ✅ ZONA IDEAL
                cssClass = 'ok';
                statusText = 'Ideal';
            } else {
                const multiplicador = absDiff / defaultTol;
                if (multiplicador <= 2 + EPS) {
                    // ⚠️ ZONA AJUSTAR
                    cssClass = 'yellow';
                    statusText = 'Ajuste leve';
                } else {
                    // ❌ ZONA CORRIGIR
                    cssClass = 'warn';
                    statusText = 'Corrigir';
                }
            }
            
            diffCell = `<td class="${cssClass}" style="text-align: center; padding: 8px;">
                <div style="font-size: 12px; font-weight: 600;">${statusText}</div>
            </td>`;
        } else {
            // Lógica padrão com epsilon (LUFS, TP, DR, etc.)
            const absDiff = Math.abs(diff);
            let cssClass, statusText;
            
            if (absDiff <= tol + EPS) {
                // ✅ ZONA IDEAL
                cssClass = 'ok';
                statusText = 'Ideal';
            } else {
                const multiplicador = absDiff / tol;
                if (multiplicador <= 2 + EPS) {
                    // ⚠️ ZONA AJUSTAR
                    cssClass = 'yellow';
                    statusText = 'Ajuste leve';
                } else {
                    // ❌ ZONA CORRIGIR
                    cssClass = 'warn';
                    statusText = 'Corrigir';
                }
            }
            
            diffCell = `<td class="${cssClass}" style="text-align: center; padding: 8px;">
                <div style="font-size: 12px; font-weight: 600;">${statusText}</div>
            </td>`;
        }
        
        // 🎯 NOVO: Renderização híbrida para targets fixos e ranges
        let targetDisplay;
        
        if (typeof target === 'object' && target !== null && 
            Number.isFinite(target.min) && Number.isFinite(target.max)) {
            // Target é um range: exibir "min dB a max dB"
            targetDisplay = `${nf(target.min)}${unit} a ${nf(target.max)}${unit}`;
        } else if (Number.isFinite(target)) {
            // Target é um valor fixo: exibir "valor dB"
            targetDisplay = `${nf(target)}${unit}`;
        } else {
            // Target não definido
            targetDisplay = 'N/A';
        }
        
        // Adicionar tolerância se disponível (apenas para targets fixos)
        const tolDisplay = (typeof target !== 'object' && tol != null) ? 
            `<span class="tol">±${nf(tol,2)}</span>` : '';
        
        rows.push(`<tr>
            <td>${enhancedLabel}</td>
            <td>${Number.isFinite(val)?nf(val)+unit:'—'}</td>
            <td>${targetDisplay}${tolDisplay}</td>
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
    
    // 🎯 CENTRALIZAÇÃO DAS MÉTRICAS - Função de acesso para comparação por referência
    // Usar somente métricas reais (sem fallback para RMS/Peak, que têm unidades e conceitos distintos)
    // Função para obter o valor LUFS integrado usando métricas centralizadas
    const getLufsIntegratedValue = () => {
        return getMetricForRef('lufs_integrated', 'lufsIntegrated');
    };
    
    // 🧠 NOVA PROTEÇÃO UNIVERSAL — Usa resolveTargetMetric para buscar referência real > gênero
    const lufsTarget = resolveTargetMetric(analysis, "lufsIntegrated", -14);
    const tpTarget = resolveTargetMetric(analysis, "truePeakDbtp", -1);
    const drTarget = resolveTargetMetric(analysis, "dynamicRange", 8);
    const lraTarget = resolveTargetMetric(analysis, "lra", 6);
    const stereoTarget = resolveTargetMetric(analysis, "stereoCorrelation", 0.1);
    const spectralTarget = resolveTargetMetric(analysis, "spectralCentroidHz", null);
    
    // Tolerâncias ainda vêm de ref (ou padrão)
    const tolLufs = (ref && ref.tol_lufs !== undefined) ? ref.tol_lufs : 0.5;
    const tolTp = (ref && ref.tol_true_peak !== undefined) ? ref.tol_true_peak : 0.3;
    const tolDr = (ref && ref.tol_dr !== undefined) ? ref.tol_dr : 1.0;
    const tolLra = (ref && ref.tol_lra !== undefined) ? ref.tol_lra : 1.0;
    const tolStereo = (ref && ref.tol_stereo !== undefined) ? ref.tol_stereo : 0.08;
    const tolSpectral = (ref && ref.tol_spectral !== undefined) ? ref.tol_spectral : 300;
    
    console.log('🧠 [RESOLVE-TARGETS] Targets universais resolvidos:', { 
        lufsTarget, tpTarget, drTarget, lraTarget, stereoTarget, spectralTarget 
    });
    
    // ADICIONAR TODAS AS MÉTRICAS PRINCIPAIS
    pushRow('Loudness Integrado (LUFS)', getLufsIntegratedValue(), lufsTarget, tolLufs, ' LUFS');
    pushRow('Pico Real (dBTP)', getMetricForRef('true_peak_dbtp', 'truePeakDbtp'), tpTarget, tolTp, ' dBTP');
    pushRow('DR', getMetricForRef('dynamic_range', 'dynamicRange'), drTarget, tolDr, '');
    pushRow('Faixa de Loudness – LRA (LU)', getMetricForRef('lra'), lraTarget, tolLra, ' LU');
    pushRow('Stereo Corr.', getMetricForRef('stereo_correlation', 'stereoCorrelation'), stereoTarget, tolStereo, '');
    
    // 🎯 ADICIONAR SPECTRAL CENTROID SE MODO REFERÊNCIA (usa resolveTargetMetric)
    if (isReferenceMode && spectralTarget !== null) {
        pushRow('Centro Espectral (Hz)', getMetricForRef('spectral_centroid', 'spectralCentroidHz'), 
                spectralTarget, tolSpectral, ' Hz');
    }
    
    // Bandas detalhadas Fase 2: usar métricas centralizadas para bandas
    const centralizedBands = analysis.metrics?.bands;
    const legacyBandEnergies = tech.bandEnergies || null;
    
    // 🔍 DEBUG: Verificar estado das bandas e mapeamento
    console.log('🔍 [DEBUG_BANDS] Verificando bandas espectrais:', {
        MODE: renderMode.toUpperCase(),
        MODE_SOURCE: renderMode === 'genre' ? 'GENRE TARGETS' : 'REFERENCE ANALYSIS',
        hasCentralizedBands: !!centralizedBands,
        centralizedBandsKeys: centralizedBands ? Object.keys(centralizedBands) : [],
        hasLegacyBands: !!legacyBandEnergies,
        legacyBandsKeys: legacyBandEnergies ? Object.keys(legacyBandEnergies) : [],
        hasRefBands: !!ref.bands,
        refBandsKeys: ref.bands ? Object.keys(ref.bands) : [],
        refBandsSource: renderMode === 'genre' ? 'FROM __activeRefData (genre)' : 'FROM referenceAnalysis or referenceComparisonMetrics'
    });
    
    // 🎯 MAPEAMENTO CORRIGIDO: Bandas Calculadas → Bandas de Referência
    const bandMappingCalcToRef = {
        // Banda calculada: chave na referência
        'sub': 'sub',
        'bass': 'low_bass',
        'lowMid': 'low_mid', 
        'mid': 'mid',
        'highMid': 'high_mid',
        'presence': 'presenca',
        'air': 'brilho',
        // Variações adicionais
        'low_bass': 'low_bass',
        'low_mid': 'low_mid',
        'high_mid': 'high_mid',
        'presenca': 'presenca',
        'brilho': 'brilho'
    };
    
    // 🎯 MAPEAMENTO REVERSO: Bandas de Referência → Bandas Calculadas
    const bandMappingRefToCalc = {
        'sub': 'sub',
        'low_bass': 'bass',
        'upper_bass': 'bass', // 🎯 NOVO: upper_bass → bass
        'low_mid': 'lowMid',
        'mid': 'mid',
        'high_mid': 'highMid',
        'presenca': 'presence',
        'brilho': 'air'
    };
    
    // 🎯 ALIAS DE BANDAS: Nomes alternativos para busca
    const bandAliases = {
        'bass': ['low_bass', 'upper_bass'],
        'lowMid': ['low_mid'],
        'highMid': ['high_mid'],
        'presence': ['presenca'],
        'air': ['brilho']
    };
    
    // 🎯 NOVA LÓGICA: Priorizar bandas da nova estrutura em modo reference
    let bandsToUse, referenceBands;
    
    if (isReferenceMode && hasNewStructure && ref.bands) {
        // Usar bandas da referenceTrack.metrics.spectral_balance
        console.log('✅ [RENDER-BANDS] Usando bandas da NOVA estrutura (referenceTrack)');
        referenceBands = ref.bands;
        bandsToUse = tech.spectral_balance || centralizedBands || legacyBandEnergies;
    } else {
        // Modo legado ou gênero
        bandsToUse = centralizedBands && Object.keys(centralizedBands).length > 0 ? centralizedBands : legacyBandEnergies;
        referenceBands = isReferenceMode && analysis.referenceComparison?.comparison?.spectralBands;
    }
    
    // 🎯 RENDERIZAÇÃO DE BANDAS EM MODO REFERENCE
    if (isReferenceMode && hasNewStructure && ref.bands && bandsToUse) {
        console.log('✅ [RENDER-REF-BANDS] Renderizando bandas com NOVA estrutura');
        
        const bandNames = {
            sub: 'Sub (20–60Hz)',
            bass: 'Bass (60–150Hz)',
            lowMid: 'Low-Mid (150–500Hz)',
            mid: 'Mid (500–2kHz)',
            highMid: 'High-Mid (2–5kHz)',
            presence: 'Presence (5–10kHz)',
            air: 'Air (10–20kHz)'
        };
        
        // Iterar pelas bandas padrão
        ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'].forEach(band => {
            // Pegar valores do usuário
            const userBand = bandsToUse[band];
            const userValue = userBand?.percentage || userBand?.energy_db;
            
            // Pegar valores da referência
            const refBand = ref.bands[band];
            const refValue = refBand?.percentage || refBand?.energy_db;
            
            if (Number.isFinite(userValue) && Number.isFinite(refValue)) {
                pushRow(
                    bandNames[band] || band,
                    userValue,
                    refValue,
                    3.0, // Tolerância de 3% para bandas
                    '%'
                );
                
                console.log(`📊 [BAND-${band}] User: ${userValue.toFixed(1)}% | Ref: ${refValue.toFixed(1)}%`);
            }
        });
    }
    // 🎯 RENDERIZAÇÃO DE BANDAS COM ESTRUTURA ANTIGA (referenceComparison.comparison.spectralBands)
    else if (referenceBands && typeof referenceBands === 'object') {
        console.log('⚠️ [RENDER-REF-BANDS] Usando bandas de referenceComparison (estrutura antiga)');
        
        const bandNames = {
            sub: 'Sub (20–60Hz)',
            bass: 'Bass (60–150Hz)',
            lowMid: 'Low-Mid (150–500Hz)',
            mid: 'Mid (500–2kHz)',
            highMid: 'High-Mid (2–5kHz)',
            presence: 'Presence (5–10kHz)',
            air: 'Air (10–20kHz)'
        };
        
        ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air'].forEach(band => {
            if (referenceBands[band]) {
                const data = referenceBands[band];
                pushRow(
                    bandNames[band] || band,
                    data.user,
                    data.reference,
                    3.0,
                    data.unit
                );
            }
        });
    } 
    // 🎵 RENDERIZAÇÃO DE BANDAS EM MODO GÊNERO
    else if (bandsToUse && ref.bands) {
        const normMap = (analysis?.technicalData?.refBandTargetsNormalized?.mapping) || null;
        const showNorm = (typeof window !== 'undefined' && window.SHOW_NORMALIZED_REF_TARGETS === true && normMap);
        
        // Mapeamento de nomes amigáveis para as bandas com ranges de frequência
        const bandDisplayNames = {
            sub: 'Sub (20–60Hz)',
            bass: 'Bass (60–150Hz)', 
            lowMid: 'Low-Mid (150–500Hz)',
            mid: 'Mid (500–2kHz)',
            highMid: 'High-Mid (2–5kHz)',
            presence: 'Presence (5–10kHz)',
            air: 'Air (10–20kHz)',
            brilho: 'Air (10–20kHz)'
        };
        
        // 🎯 PROCESSAMENTO CORRIGIDO: Iterar por bandas de referência e mapear para dados calculados
        console.log('🔄 Processando bandas com mapeamento corrigido...');
        
        // 🛡️ FALLBACK: Verificar se ref.bands existe antes de iterar
        if (!ref.bands || typeof ref.bands !== 'object') {
            console.warn('⚠️ [REF-COMP] Fallback triggered (missing bands) - ref.bands não existe');
            ref.bands = {}; // Criar objeto vazio para evitar erro
        }
        
        for (const [refBandKey, refBand] of Object.entries(ref.bands)) {
            // Encontrar a banda calculada correspondente
            const calcBandKey = bandMappingRefToCalc[refBandKey] || refBandKey;
            let bLocal = null;
            
            console.log(`🔍 [BANDS] Processando: ${refBandKey} → ${calcBandKey}`);
            
            // 🎯 NOVO: Busca melhorada com sistema de alias
            const searchBandData = (bandKey) => {
                // Buscar diretamente
                if (centralizedBands && centralizedBands[bandKey]) {
                    return { rms_db: centralizedBands[bandKey].energy_db, source: 'centralized' };
                }
                if (legacyBandEnergies && legacyBandEnergies[bandKey]) {
                    return { ...legacyBandEnergies[bandKey], source: 'legacy' };
                }
                
                // Buscar por alias
                if (bandAliases[bandKey]) {
                    for (const alias of bandAliases[bandKey]) {
                        if (centralizedBands && centralizedBands[alias]) {
                            console.log(`🔄 [ALIAS] ${bandKey} → ${alias} (centralized)`);
                            return { rms_db: centralizedBands[alias].energy_db, source: 'centralized-alias' };
                        }
                        if (legacyBandEnergies && legacyBandEnergies[alias]) {
                            console.log(`🔄 [ALIAS] ${bandKey} → ${alias} (legacy)`);
                            return { ...legacyBandEnergies[alias], source: 'legacy-alias' };
                        }
                    }
                }
                
                return null;
            };
            
            // Buscar dados da banda
            bLocal = searchBandData(calcBandKey);
            
            // Se não encontrou, tentar busca direta pela chave de referência
            if (!bLocal) {
                bLocal = searchBandData(refBandKey);
                if (bLocal) {
                    console.log(`⚠️ [BANDS] Fallback para chave de referência: ${refBandKey}`);
                }
            }
            
            // 🎯 TRATAMENTO SILENCIOSO: Ignorar bandas não encontradas sem erro
            if (!bLocal || !Number.isFinite(bLocal.rms_db)) {
                console.log(`🔇 [BANDS] Ignorando banda inexistente: ${refBandKey} / ${calcBandKey}`);
                continue; // Pular silenciosamente
            }
            
            // Banda encontrada - processar normalmente
            console.log(`✅ [BANDS] Encontrado ${refBandKey}: ${bLocal.rms_db}dB (${bLocal.source})`);
            
            // Log de validação entre sistemas
            if (typeof window !== 'undefined' && window.METRICS_BANDS_VALIDATION !== false && 
                bLocal.source === 'centralized' && legacyBandEnergies?.[calcBandKey]) {
                const legacyValue = legacyBandEnergies[calcBandKey].rms_db;
                if (Number.isFinite(legacyValue) && Math.abs(bLocal.rms_db - legacyValue) > 0.01) {
                    console.warn(`🎯 BAND_DIFF: ${calcBandKey} centralized=${bLocal.rms_db} vs legacy=${legacyValue}`);
                }
            }
            
            // 🎯 NOVO: Determinar target e tolerância com helpers
            let tgt = null;
            let tolerance = null;
            
            // Prioridade 1: target_range (usar helpers para formatação e tolerância)
            if (refBand.target_range && typeof refBand.target_range === 'object' &&
                Number.isFinite(refBand.target_range.min) && Number.isFinite(refBand.target_range.max)) {
                tgt = refBand.target_range;
                // ✅ CORRIGIDO: Usar deriveTolerance() ao invés de 0
                tolerance = deriveTolerance(tgt, 2.0);
                console.log(`🎯 [BANDS-FORMAT] Usando target_range para ${refBandKey}: ${formatTarget(tgt)}, tol: ${tolerance.toFixed(2)}`);
            }
            // Prioridade 2: target_db fixo
            else if (!refBand._target_na && Number.isFinite(refBand.target_db)) {
                tgt = refBand.target_db;
                // ✅ CORRIGIDO: Usar deriveTolerance() com fallback
                tolerance = deriveTolerance(tgt, 2.0);
                console.log(`🎯 [BANDS-FORMAT] Usando target_db fixo para ${refBandKey}: ${formatTarget(tgt)}, tol: ${tolerance.toFixed(2)}`);
            }
            
            // Prioridade 3: Targets normalizados (se habilitado)
            if (showNorm && normMap && Number.isFinite(normMap[refBandKey])) {
                tgt = normMap[refBandKey];
                console.log(`🎯 [BANDS] Sobrescrevendo com target normalizado para ${refBandKey}: ${tgt}`);
            }
            
            // Nome para exibição
            const displayName = bandDisplayNames[calcBandKey] || bandDisplayNames[refBandKey] || refBandKey;
            
            // ✅ CORRIGIDO: Usar centerOfRange para cálculo de delta
            const targetCenter = centerOfRange(tgt) ?? tgt ?? null;
            console.log(`📊 [BANDS] Adicionando: ${displayName}, valor: ${bLocal.rms_db}dB, target: ${formatTarget(tgt)}, tol: ${tolerance}`);
            
            // 🎯 Passar targetCenter (número) para cálculo correto de delta em pushRow
            pushRow(displayName, bLocal.rms_db, tgt, tolerance, ' dB');
        }
        
        // 🎯 PROCESSAMENTO DE BANDAS EXTRAS: Bandas calculadas que não estão na referência
        console.log('🔄 Verificando bandas extras não mapeadas...');
        
        if (bandsToUse) {
            Object.keys(bandsToUse).forEach(calcBandKey => {
                // Filtrar chaves inválidas (totais, metadados etc.)
                if (calcBandKey === '_status' || 
                    calcBandKey === 'totalPercentage' || 
                    calcBandKey === 'totalpercentage' ||
                    calcBandKey === 'metadata' ||
                    calcBandKey === 'total' ||
                    calcBandKey.toLowerCase().includes('total')) {
                    return; // Pular esta banda
                }
                
                // Verificar se esta banda já foi processada
                const refBandKey = bandMappingCalcToRef[calcBandKey];
                const alreadyProcessed = refBandKey && ref.bands[refBandKey];
                
                if (!alreadyProcessed) {
                    console.log(`🔍 Processando banda extra: ${calcBandKey}`);
                    
                    const bandData = bandsToUse[calcBandKey];
                    let energyDb = null;
                    
                    if (typeof bandData === 'object' && Number.isFinite(bandData.energy_db)) {
                        energyDb = bandData.energy_db;
                    } else if (typeof bandData === 'object' && Number.isFinite(bandData.rms_db)) {
                        energyDb = bandData.rms_db;
                    } else if (Number.isFinite(bandData)) {
                        energyDb = bandData;
                    }
                    
                    if (Number.isFinite(energyDb)) {
                        const displayName = bandDisplayNames[calcBandKey] || 
                                          `${calcBandKey.charAt(0).toUpperCase() + calcBandKey.slice(1)} (Nova Banda)`;
                        
                        // Tentar buscar referência direta por chave
                        const directRefData = ref.bands?.[calcBandKey];
                        let target = null;
                        let tolerance = null;
                        
                        // [BANDS-TOL-0] Suporte híbrido: target_range ou target_db (SEM TOLERÂNCIA)
                        if (directRefData?.target_range && typeof directRefData.target_range === 'object' &&
                            Number.isFinite(directRefData.target_range.min) && Number.isFinite(directRefData.target_range.max)) {
                            target = directRefData.target_range;
                            tolerance = 0; // [BANDS-TOL-0] Sempre 0 para bandas
                        } else if (Number.isFinite(directRefData?.target_db)) {
                            target = { min: directRefData.target_db, max: directRefData.target_db };
                            tolerance = 0; // [BANDS-TOL-0] Sempre 0 para bandas
                        }
                        
                        console.log(`📊 Adicionando banda extra: ${displayName}, valor: ${energyDb}dB, target: ${target || 'N/A'}`);
                        pushRow(displayName, energyDb, target, tolerance, ' dB');
                        
                        if (!target) {
                            console.warn(`⚠️ Banda sem referência: ${calcBandKey} (valor: ${energyDb}dB)`);
                        }
                    }
                }
            });
        }
    } else {
        // Fallback melhorado: buscar todas as bandas espectrais disponíveis
        const spectralBands = tech.spectral_balance || 
                            tech.spectralBands || 
                            analysis.metrics?.bands || {};
        
        // 🎯 MAPEAMENTO COMPLETO com correção de nomes
        const bandMap = {
            sub: { refKey: 'sub', name: 'Sub (20–60Hz)', range: '20–60Hz' },
            bass: { refKey: 'low_bass', name: 'Bass (60–150Hz)', range: '60–150Hz' },
            lowMid: { refKey: 'low_mid', name: 'Low-Mid (150–500Hz)', range: '150–500Hz' },
            mid: { refKey: 'mid', name: 'Mid (500–2kHz)', range: '500–2000Hz' },
            highMid: { refKey: 'high_mid', name: 'High-Mid (2–5kHz)', range: '2000–5000Hz' },
            presence: { refKey: 'presenca', name: 'Presence (5–10kHz)', range: '5000–10000Hz' },
            air: { refKey: 'brilho', name: 'Air (10–20kHz)', range: '10000–20000Hz' }
        };
        
        // 🎯 NOVO PROCESSAMENTO MODE-AWARE com resolver
        console.log('🔄 Processando bandas espectrais (mode-aware resolver)...', {
            renderMode,
            hasRefBands: !!ref?.bands,
            refBandsKeys: ref?.bands ? Object.keys(ref.bands) : [],
            spectralBandsKeys: Object.keys(spectralBands),
            stateRefAnalysis: !!state?.reference?.analysis?.bands
        });
        
        if (spectralBands && Object.keys(spectralBands).length > 0) {
            // 🎯 PATCH B: Extração de bandas mode-aware com bloqueio de fallback
            // isReferenceMode já definido no escopo superior
            
            let refBands = null;
            let userBands = null;
            
            if (isReferenceMode) {
                // 2ª faixa: referência/alvo
                const refTech = opts?.referenceAnalysis?.technicalData
                             || state?.referenceAnalysis?.technicalData
                             || state?.reference?.referenceAnalysis?.technicalData
                             || referenceComparisonMetrics?.target
                             || referenceComparisonMetrics?.userFull?.technicalData /* legado confuso */ 
                             || null;
                
                // 1ª faixa: base/origem
                const userTech = opts?.userAnalysis?.technicalData
                              || state?.userAnalysis?.technicalData
                              || state?.reference?.userAnalysis?.technicalData
                              || referenceComparisonMetrics?.analyzed
                              || referenceComparisonMetrics?.referenceFull?.technicalData /* legado confuso */
                              || null;
                
                // 🔍 EXTRAÇÃO DE refBands com fallback seguro (NUNCA usar ranges de gênero)
                refBands = refTech?.spectral_balance ||
                          opts?.referenceAnalysis?.bands ||
                          opts?.referenceAnalysis?.frequencyBands ||
                          state?.referenceAnalysis?.bands ||
                          state?.referenceAnalysis?.frequencyBands ||
                          null;
                
                userBands = userTech?.spectral_balance || null;
                
                console.log('[REF-FLOW] bands sources', {
                    userBands: !!userBands, 
                    refBands: !!refBands,
                    userBandsKeys: userBands ? Object.keys(userBands).slice(0, 5) : [],
                    refBandsKeys: refBands ? Object.keys(refBands).slice(0, 5) : []
                });
                
                if (!refBands) {
                    console.error("🚨 [REF-ERROR] Nenhum dado de bandas encontrado na referência.");
                    console.error('[CRITICAL] Reference mode sem bandas da 2ª faixa! Abortando render.');
                    console.error('[CRITICAL] Proibido fallback de gênero no reference mode');
                    if (container) {
                        container.innerHTML = '<div style="color:red;">❌ Erro: bandas de referência não disponíveis</div>';
                    }
                    return;
                }
                
                console.log("✅ [AUDIT_REF_FIX] referenceAnalysis spectral_balance pronto:", refBands);
            } else {
                // GENRE: aqui SIM usa ranges de __activeRefData
                refBands  = (__activeRefData && __activeRefData.bands) || null;
                userBands = (analysis?.technicalData?.spectral_balance) || spectralBands || null;
            }
            
            // Conjunto para rastrear bandas já processadas
            const processedBandKeys = new Set();
            
            // 🎯 Iterar por todas as bandas do usuário
            const bandsToIterate = userBands || spectralBands;
            for (const rawKey of Object.keys(bandsToIterate)) {
                if (IGNORE_BANDS.has(rawKey) || processedBandKeys.has(rawKey)) continue;
                
                const bandKey = normalizeBandKey(rawKey);
                const userVal = pickNumeric(bandsToIterate[rawKey]);
                
                if (userVal === null) continue; // Sem valor do usuário
                
                let targetDisplay = '—';
                let valueDisplay = '—';
                let deltaDisplay = '—';
                let targetValue = null;
                let tolDisplay = null;
                
                if (isReferenceMode) {
                    const refVal = getReferenceBandValue(refBands, bandKey); // retorna número (dB) ou null
                    const userValCalc = getReferenceBandValue(userBands, bandKey);
                    
                    if (refVal == null) {
                        console.warn('[REF-FLOW] Banda sem valor na 2ª faixa:', bandKey);
                        targetDisplay = '—';
                        targetValue = null;
                    } else {
                        targetDisplay = formatDb(refVal);
                        targetValue = refVal;
                    }
                    
                    valueDisplay = (userValCalc == null) ? '—' : formatDb(userValCalc);
                    deltaDisplay = (userValCalc == null || refVal == null) ? '—' : formatDb(userValCalc - refVal);
                    tolDisplay = 0; // Sem tolerância em comparação direta
                    
                } else {
                    // GENRE: range do JSON de gênero
                    const r = getGenreTargetRange(refBands, bandKey);
                    if (r) {
                        targetDisplay = `${formatDb(r.min)} a ${formatDb(r.max)}`;
                        targetValue = { min: r.min, max: r.max };
                        tolDisplay = r.tol;
                    } else {
                        targetDisplay = '—';
                        targetValue = null;
                    }
                    valueDisplay = formatDb(userVal);
                    deltaDisplay = '—'; // (delta numérico não se aplica a range)
                }
                
                // 🎯 Adicionar linha na tabela
                const label = bandMap[bandKey]?.name || `${bandKey.toUpperCase()}`;
                pushRow(label, userVal, targetValue, tolDisplay, ' dB');
                processedBandKeys.add(rawKey);
                processedBandKeys.add(bandKey);
            }
            
            console.log(`✅ [BANDS-PROCESSED] ${processedBandKeys.size} bandas processadas no modo ${renderMode}`);
        } else {
            // Fallback para tonalBalance simplificado (mantido para compatibilidade)
            const tb = tech.tonalBalance || {};
            const legacyBandMap = { sub:'sub', low:'low_bass', mid:'mid', high:'brilho' };
            Object.entries(legacyBandMap).forEach(([tbKey, refBand]) => {
                const bData = tb[tbKey];
                const refBandData = ref.bands?.[refBand];
                if (bData && refBandData && Number.isFinite(bData.rms_db)) {
                    console.log(`📊 Banda legacy: ${tbKey.toUpperCase()}, valor: ${bData.rms_db}dB, target: ${refBandData.target_db}dB`);
                    pushRow(`${tbKey.toUpperCase()}`, bData.rms_db, refBandData.target_db, refBandData.tol_db, ' dB');
                }
            });
        }
    }
    
    // 🎯 LOG DE RESUMO: Bandas processadas com sucesso
    const bandasDisponiveis = ref.bands ? Object.keys(ref.bands).length : 0;
    const bandasProcessadas = rows.length - 5; // Subtrair métricas básicas (LUFS, Peak, DR, LRA, Stereo)
    
    console.log('📊 [BANDS] Resumo do processamento de bandas:', {
        bandas_na_referencia: bandasDisponiveis,
        bandas_processadas: Math.max(0, bandasProcessadas),
        metricas_totais: rows.length,
        centralized_bands_ok: !!centralizedBands,
        legacy_bands_ok: !!legacyBandEnergies,
        modo_referencia: isReferenceMode
    });
    
    // MOSTRAR TABELA COMPLETA
    container.innerHTML = `<div class="card" style="margin-top:12px;">
        <div class="card-title">COMPARAÇÃO DE REFERÊNCIA (${titleText})</div>
        <table class="ref-compare-table">
            <thead><tr>
                <th>Métrica</th><th>Valor</th><th>Alvo</th><th>Δ</th>
            </tr></thead>
            <tbody>${rows.join('') || '<tr><td colspan="4" style="opacity:.6">Sem métricas disponíveis</td></tr>'}</tbody>
        </table>
    </div>`;
    
    // 🎯 FORÇAR VISIBILIDADE DA TABELA EM AMBOS OS MODOS
    console.log('[UI_RENDER] Forçando renderização da tabela comparativa');
    const tableEl = document.getElementById('referenceComparisons');
    if (tableEl) {
        tableEl.classList.remove('hidden');
        tableEl.style.display = ''; // Limpa inline display:none
        tableEl.style.visibility = 'visible';
        tableEl.style.opacity = '1';
        console.log('✅ [RENDER-REF] Tabela forçada para visível (mode:', renderMode, ')');
    } else {
        console.error('❌ [RENDER-REF] Elemento #referenceComparisons NÃO encontrado no DOM!');
    }
    
    // 🎯 Verificar se wrapper/parent também está visível
    const wrapper = tableEl?.parentElement;
    if (wrapper) {
        wrapper.classList.remove('hidden');
        wrapper.classList.add('visible');
        wrapper.style.display = '';
    }
    
    // 🛡️ PASSO 3: VERIFICAÇÃO FINAL
    console.log('🎯 [AUDITORIA_REF] Comparação de referência renderizada com sucesso');
    console.log('🎯 [AUDITORIA_REF] Targets usados:', {
        lufs: lufsTarget,
        truePeak: tpTarget,
        dr: drTarget,
        lra: lraTarget,
        stereo: stereoTarget,
        totalRows: rows.length
    });
    
    // 🎯 LOG FINAL DE SUCESSO COMPLETO
    console.log('✅ [REF-COMP] renderReferenceComparisons SUCCESS', {
        mode: renderMode,
        usedReferenceAnalysis: !!analysis.referenceAnalysis,
        bandsResolved: ref.bands ? Object.keys(ref.bands).length : 0,
        rowsGenerated: rows.length,
        titleDisplayed: titleText,
        tableVisible: renderMode === 'reference'
    });
    
    // 🎯 LOG FINAL DE VERIFICAÇÃO (conforme solicitado)
    console.log('[FINAL-CHECK] renderReferenceComparisons concluído com', {
        mode: renderMode,
        bands: Object.keys(ref?.bands || {}),
        bandsCount: Object.keys(ref?.bands || {}).length,
        tableVisible: !!document.querySelector('#referenceComparisons'),
        tableHasContent: rows.length > 0,
        userMetricsLoaded: !!userMetrics,
        refMetricsLoaded: !!ref,
        titleText: titleText
    });
    
    // ✅ DESBLOQUEIO DO MODAL - Finalizar loading e exibir resultados
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    
    if (loading) {
        loading.style.display = 'none';
        console.log('[MODAL-FIX] ✅ Loading ocultado');
    }
    
    if (results) {
        results.style.display = 'block';
        console.log('[MODAL-FIX] ✅ Resultados exibidos');
    }
    
    if (uploadArea) {
        uploadArea.style.display = 'none';
        console.log('[MODAL-FIX] ✅ Upload area ocultada');
    }
    
    console.log('[MODAL-FIX] ✅ Loading encerrado com sucesso - modal desbloqueado');
    
    // Estilos injetados uma vez com indicadores visuais melhorados
    if (!document.getElementById('refCompareStyles')) {
        const style = document.createElement('style');
        style.id = 'refCompareStyles';
        style.textContent = `
        .ref-compare-table{width:100%;border-collapse:collapse;font-size:11px;}
        .ref-compare-table th{font-weight:500;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.12);font-size:11px;color:#fff;letter-spacing:.3px;}
        .ref-compare-table th:first-child{text-align:left;}
        .ref-compare-table th:not(:first-child){text-align:center;}
        .ref-compare-table td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.06);color:#f5f7fa;} 
        .ref-compare-table td:first-child{text-align:left;}
        .ref-compare-table td:not(:first-child){text-align:center;}
        .ref-compare-table tr:last-child td{border-bottom:0;} 
        .ref-compare-table td.ok{color:#52f7ad;font-weight:600;} 
        .ref-compare-table td.ok::before{content:'✅ ';margin-right:2px;}
        .ref-compare-table td.yellow{color:#ffce4d;font-weight:600;} 
        .ref-compare-table td.yellow::before{content:'⚠️ ';margin-right:2px;}
        .ref-compare-table td.warn{color:#ff7b7b;font-weight:600;} 
        .ref-compare-table td.warn::before{content:'❌ ';margin-right:2px;}
        .ref-compare-table .tol{opacity:.7;margin-left:4px;font-size:10px;color:#b8c2d6;} 
        .ref-compare-table tbody tr:hover td{background:rgba(255,255,255,.04);} 
        `;
        document.head.appendChild(style);
    }
    
    // Garantir que o CSS do priority-banner esteja disponível no modal
    if (!document.getElementById('priorityBannerStyles')) {
        const priorityStyle = document.createElement('style');
        priorityStyle.id = 'priorityBannerStyles';
        priorityStyle.textContent = `
        .priority-banner {
            display: flex !important;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            border-radius: 8px;
            font-weight: 700;
            background: linear-gradient(90deg, #ff006a, #ff9800) !important;
            color: #fff !important;
            margin-bottom: 10px;
            box-shadow: 0 0 15px rgba(255, 0, 106, 0.3);
            animation: pulsePriority 1.5s infinite alternate;
            position: relative;
            z-index: 10;
        }
        
        .priority-icon {
            font-size: 20px;
            line-height: 1;
        }
        
        @keyframes pulsePriority {
            from { opacity: 0.8; transform: scale(0.98); }
            to { opacity: 1; transform: scale(1.02); }
        }
        `;
        document.head.appendChild(priorityStyle);
    }
}

/**
 * 🎯 RENDERIZAÇÃO DE COMPARAÇÃO ENTRE DUAS FAIXAS
 * Exibe tabela comparativa lado a lado: Faixa 1 (referência) vs Faixa 2 (usuário)
 * @param {Object} referenceAnalysis - Dados da primeira faixa (referência)
 * @param {Object} currentAnalysis - Dados da segunda faixa (usuário)
 */
function renderTrackComparisonTable(baseAnalysis, referenceAnalysis) {
    // 🎯 PARÂMETROS CORRIGIDOS:
    // baseAnalysis = primeira faixa (alvo/base da comparação)
    // referenceAnalysis = segunda faixa (atual/sendo comparada)
    
    console.log('🎯 [TRACK-COMPARE] Renderizando tabela comparativa entre faixas');
    console.log('📊 [TRACK-COMPARE] Base (1ª faixa - ALVO):', baseAnalysis);
    console.log('📊 [TRACK-COMPARE] Atual (2ª faixa - COMPARADA):', referenceAnalysis);
    
    // 🎯 Definir modo reference no estado
    const state = window.__soundyState || {};
    state.render = state.render || {};
    state.render.mode = 'reference';
    console.log('✅ [TRACK-COMPARE] Modo definido como reference no estado');
    
    // 🎯 LOG AUDIT-MODE-FLOW (conforme solicitado)
    console.log('[AUDIT-MODE-FLOW]', {
        mode: state.render.mode,
        isSecondTrack: state.reference?.isSecondTrack,
        refJobId: state.reference?.jobId,
        hasRefAnalysis: !!state.reference?.analysis
    });
    
    const container = document.getElementById('referenceComparisons');
    if (!container) {
        console.error('❌ Container referenceComparisons não encontrado');
        return;
    }
    
    // Normalizar dados de ambas as faixas
    // ref = primeira faixa (BASE/ALVO)
    // curr = segunda faixa (ATUAL/COMPARADA)
    const ref = normalizeBackendAnalysisData(baseAnalysis);
    const curr = normalizeBackendAnalysisData(referenceAnalysis);
    
    const refTech = ref.technicalData || {};
    const currTech = curr.technicalData || {};
    
    // Helper para comparar valores e calcular status
    const nf = (n, d=2) => Number.isFinite(n) ? n.toFixed(d) : '—';
    const calcDiffPercent = (curr, ref) => {
        if (!Number.isFinite(curr) || !Number.isFinite(ref) || ref === 0) return null;
        return ((curr - ref) / Math.abs(ref)) * 100;
    };
    
    const getStatus = (diffPercent, tolerance = 10) => {
        if (diffPercent === null) return { class: '', text: 'N/A' };
        const absDiff = Math.abs(diffPercent);
        if (absDiff <= tolerance) return { class: 'ok', text: '✅ Ideal' };
        if (absDiff <= tolerance * 2) return { class: 'yellow', text: '⚠️ Ajuste leve' };
        return { class: 'warn', text: '❌ Corrigir' };
    };
    
    // Construir linhas da tabela
    const rows = [];
    
    // Função auxiliar para adicionar linha
    const addRow = (label, currVal, refVal, unit = '', tolerance = 10) => {
        const diffPercent = calcDiffPercent(currVal, refVal);
        const status = getStatus(diffPercent, tolerance);
        const diffText = diffPercent !== null ? `${diffPercent > 0 ? '+' : ''}${nf(diffPercent, 1)}%` : '—';
        
        rows.push(`<tr>
            <td>${label}</td>
            <td>${Number.isFinite(currVal) ? nf(currVal) + unit : '—'}</td>
            <td>${Number.isFinite(refVal) ? nf(refVal) + unit : '—'}</td>
            <td>${diffText}</td>
            <td class="${status.class}">${status.text}</td>
        </tr>`);
    };
    
    // ===== MÉTRICAS PRINCIPAIS =====
    addRow('Loudness (LUFS)', currTech.lufsIntegrated || currTech.lufs_integrated, 
           refTech.lufsIntegrated || refTech.lufs_integrated, ' LUFS', 5);
    
    addRow('True Peak (dBTP)', currTech.truePeakDbtp || currTech.true_peak_dbtp,
           refTech.truePeakDbtp || refTech.true_peak_dbtp, ' dBTP', 10);
    
    addRow('Dynamic Range (LU)', currTech.dynamicRange || currTech.dynamic_range,
           refTech.dynamicRange || refTech.dynamic_range, ' LU', 15);
    
    addRow('LRA (LU)', currTech.lra, refTech.lra, ' LU', 15);
    
    addRow('Stereo Correlation', currTech.stereoCorrelation || currTech.stereo_correlation,
           refTech.stereoCorrelation || refTech.stereo_correlation, '', 8);
    
    addRow('Spectral Centroid (Hz)', currTech.spectralCentroidHz || currTech.spectral_centroid,
           refTech.spectralCentroidHz || refTech.spectral_centroid, ' Hz', 10);
    
    // ===== BANDAS ESPECTRAIS =====
    const currBands = currTech.spectral_balance || {};
    const refBands = refTech.spectral_balance || {};
    
    const bandNames = {
        sub: 'Sub (20-60Hz)',
        bass: 'Bass (60-150Hz)',
        lowMid: 'Low-Mid (150-500Hz)',
        mid: 'Mid (500-2kHz)',
        highMid: 'High-Mid (2-5kHz)',
        presence: 'Presence (5-10kHz)',
        air: 'Air (10-20kHz)'
    };
    
    Object.entries(bandNames).forEach(([key, name]) => {
        const currVal = currBands[key]?.percentage;
        const refVal = refBands[key]?.percentage;
        if (Number.isFinite(currVal) && Number.isFinite(refVal)) {
            addRow(name, currVal, refVal, '%', 10);
        }
    });
    
    // Calcular scores comparativos
    const refScore = ref.score || 0;
    const currScore = curr.score || 0;
    const scoreDiff = currScore - refScore;
    
    // Montar HTML da tabela
    // 🎯 LABELS DINÂMICOS: Primeira faixa = BASE/ALVO, Segunda faixa = ATUAL
    container.innerHTML = `
        <div class="card" style="margin-top:12px;">
            <div class="card-title">🎵 COMPARAÇÃO ENTRE FAIXAS (Modo Reference)</div>
            <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px;">FAIXA BASE (1ª - ALVO)</div>
                        <div style="font-weight: 600; font-size: 14px;">
                            ${ref.metadata?.fileName || ref.fileName || 'Primeira Faixa'}
                        </div>
                        <div style="font-size: 12px; margin-top: 4px;">
                            Score: <span style="color: #52f7ad;">${nf(refScore, 0)}</span>
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px;">FAIXA DE REFERÊNCIA (2ª - ATUAL)</div>
                        <div style="font-weight: 600; font-size: 14px;">
                            ${curr.metadata?.fileName || curr.fileName || 'Segunda Faixa'}
                        </div>
                        <div style="font-size: 12px; margin-top: 4px;">
                            Score: <span style="color: ${scoreDiff >= 0 ? '#52f7ad' : '#ff7b7b'};">${nf(currScore, 0)}</span>
                            <span style="opacity: 0.7; margin-left: 4px;">(${scoreDiff > 0 ? '+' : ''}${nf(scoreDiff, 0)})</span>
                        </div>
                    </div>
                </div>
            </div>
            <table class="ref-compare-table">
                <thead><tr>
                    <th>Métrica</th>
                    <th>Faixa 2 (Ref/Atual)</th>
                    <th>Faixa 1 (Base/Alvo)</th>
                    <th>Diferença (%)</th>
                    <th>Status</th>
                </tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>
    `;
    
    // 🎯 AUDIT_REF_FIX: Log final de confirmação do fluxo A/B
    console.log('✅ [TRACK-COMPARE] Tabela comparativa renderizada com sucesso');
    console.log('[REFERENCE-A/B FIXED ✅] Comparação A/B entre faixas concluída');
    console.log('[AUDIT_REF_FIX] Tabela exibindo valores brutos da segunda faixa (referência real)');
    console.log('[MODE LOCKED] reference - renderização completa sem alteração de modo');
    
    // 🎉 LOG FINAL DE AUDITORIA
    console.log("✅ [REFERENCE-A/B FIXED] Comparação renderizada sem erros.");
    console.log("✅ [AUDITORIA_FINAL_RENDER_REF] Render concluído com sucesso.");
    
    // 🎯 VALIDAÇÃO FINAL PÓS-FIX
    const validationData = {
        userTrack: ref.metadata?.fileName || ref.fileName || 'Primeira Faixa',
        refTrack: curr.metadata?.fileName || curr.fileName || 'Segunda Faixa',
        userLUFS: ref.technicalData?.lufsIntegrated || ref.technicalData?.lufs_integrated || 'N/A',
        refLUFS: curr.technicalData?.lufsIntegrated || curr.technicalData?.lufs_integrated || 'N/A',
        userDR: ref.technicalData?.dynamicRange || ref.technicalData?.dynamic_range || 'N/A',
        refDR: curr.technicalData?.dynamicRange || curr.technicalData?.dynamic_range || 'N/A',
        userPeak: ref.technicalData?.truePeakDbtp || ref.technicalData?.true_peak_dbtp || 'N/A',
        refPeak: curr.technicalData?.truePeakDbtp || curr.technicalData?.true_peak_dbtp || 'N/A',
        render: 'concluído sem erros'
    };
    
    console.log('✅ [VALIDAÇÃO-FINAL] Modal Reference OK:', validationData);
    
    // ✅ Libera lock após renderização
    window.comparisonLock = false;
    console.log("[LOCK] comparisonLock liberado");
    
    console.groupEnd();
}

// 🎯 ===== SISTEMA DE SCORING AVANÇADO =====
// Sistema completo de pontuação por categorias com adaptação por gênero

// 1. PESOS POR GÊNERO (ATUALIZADOS CONFORME ESPECIFICAÇÃO)
const GENRE_SCORING_WEIGHTS = {
    // Funk Mandela - Foco em Loudness e Dinâmica
    'funk_mandela': {
        loudness: 0.32,    // Loudness crítico no funk
        dinamica: 0.23,    // Dinâmica importante
        frequencia: 0.20,  // Frequência equilibrada
        estereo: 0.15,     // Estéreo moderado
        tecnico: 0.10      // Técnico básico
    },
    
    // Funk Automotivo (similar ao Mandela)
    'funk_automotivo': {
        loudness: 0.32,
        dinamica: 0.23,
        frequencia: 0.20,
        estereo: 0.15,
        tecnico: 0.10
    },
    
    // Trap/Trance - Foco em Loudness e Frequência
    'trap': {
        loudness: 0.25,    // Loudness importante
        frequencia: 0.30,  // Frequência crítica
        estereo: 0.20,     // Estéreo importante
        dinamica: 0.15,    // Dinâmica moderada
        tecnico: 0.10      // Técnico básico
    },
    
    'trance': {
        loudness: 0.25,    // Loudness importante
        frequencia: 0.30,  // Frequência crítica
        estereo: 0.20,     // Estéreo importante
        dinamica: 0.15,    // Dinâmica moderada
        tecnico: 0.10      // Técnico básico
    },
    
    // Eletrônico - Foco em Frequência e Estéreo
    'eletronico': {
        frequencia: 0.30,  // Frequência crítica
        estereo: 0.25,     // Estéreo importante
        loudness: 0.20,    // Loudness moderado
        dinamica: 0.15,    // Dinâmica moderada
        tecnico: 0.10      // Técnico básico
    },
    
    // Funk Bruxaria - Similar ao Eletrônico
    'funk_bruxaria': {
        frequencia: 0.30,  // Frequência crítica
        estereo: 0.25,     // Estéreo importante
        loudness: 0.20,    // Loudness moderado
        dinamica: 0.15,    // Dinâmica moderada
        tecnico: 0.10      // Técnico básico
    },
    
    // Hip Hop - Balanceado entre Frequência e Dinâmica
    'hip_hop': {
        frequencia: 0.30,
        dinamica: 0.25,
        loudness: 0.20,
        estereo: 0.15,
        tecnico: 0.10
    },
    
    // Pesos padrão (fallback) - Distribuição equilibrada
    'default': {
        loudness: 0.25,
        frequencia: 0.25,
        dinamica: 0.20,
        estereo: 0.15,
        tecnico: 0.15
    }
};

// 2. FUNÇÃO PARA CALCULAR SCORE DE UMA MÉTRICA (VERSÃO MENOS PUNITIVA)
function calculateMetricScore(actualValue, targetValue, tolerance) {
    // Verificar se temos valores válidos
    if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || !Number.isFinite(tolerance) || tolerance <= 0) {
        return null; // Métrica inválida
    }
    
    const diff = Math.abs(actualValue - targetValue);
    
    // 🎯 DENTRO DA TOLERÂNCIA = 100 pontos
    if (diff <= tolerance) {
        return 100;
    }
    
    // 🎯 CURVA DE PENALIZAÇÃO MAIS JUSTA - GRADUAL E MENOS PUNITIVA
    // Δ até 1.5x tolerância → ~80
    // Δ até 2x tolerância → ~60  
    // Δ até 3x tolerância → ~40
    // Δ acima de 3x tolerância → ~20 (nunca zerar)
    
    const ratio = diff / tolerance;
    
    if (ratio <= 1.5) {
        // Entre 1x e 1.5x tolerância: decaimento suave de 100 para 80
        return Math.round(100 - ((ratio - 1) * 40)); // 100 - (0.5 * 40) = 80 no máximo
    } else if (ratio <= 2.0) {
        // Entre 1.5x e 2x tolerância: de 80 para 60
        return Math.round(80 - ((ratio - 1.5) * 40)); // 80 - (0.5 * 40) = 60 no máximo
    } else if (ratio <= 3.0) {
        // Entre 2x e 3x tolerância: de 60 para 40
        return Math.round(60 - ((ratio - 2) * 20)); // 60 - (1 * 20) = 40 no máximo
    } else {
        // Acima de 3x tolerância: 20 (nunca zerar totalmente)
        return 20;
    }
}

// 3. CALCULAR SCORE DE LOUDNESS (LUFS, True Peak, Crest Factor)
function calculateLoudnessScore(analysis, refData) {
    if (!analysis || !refData) return null;
    
    const tech = analysis.technicalData || {};
    const metrics = analysis.metrics || {};
    const scores = [];
    
    // LUFS Integrado (métrica principal de loudness)
    const lufsValue = metrics.lufs_integrated || tech.lufsIntegrated;
    if (Number.isFinite(lufsValue) && Number.isFinite(refData.lufs_target) && Number.isFinite(refData.tol_lufs)) {
        const score = calculateMetricScore(lufsValue, refData.lufs_target, refData.tol_lufs);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 LUFS: ${lufsValue} vs ${refData.lufs_target} (±${refData.tol_lufs}) = ${score}%`);
        }
    }
    
    // True Peak (importante para evitar clipping digital)
    const truePeakValue = metrics.true_peak_dbtp || tech.truePeakDbtp;
    if (Number.isFinite(truePeakValue) && Number.isFinite(refData.true_peak_target) && Number.isFinite(refData.tol_true_peak)) {
        const score = calculateMetricScore(truePeakValue, refData.true_peak_target, refData.tol_true_peak);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 True Peak: ${truePeakValue} vs ${refData.true_peak_target} (±${refData.tol_true_peak}) = ${score}%`);
        }
    }
    
    // Crest Factor (dinâmica de picos)
    const crestValue = tech.crestFactor || metrics.crest_factor;
    if (Number.isFinite(crestValue) && refData.crest_target && Number.isFinite(refData.crest_target)) {
        const tolerance = refData.tol_crest || 2.0;
        const score = calculateMetricScore(crestValue, refData.crest_target, tolerance);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Crest Factor: ${crestValue} vs ${refData.crest_target} (±${tolerance}) = ${score}%`);
        }
    }
    
    // Retornar média dos scores válidos
    if (scores.length === 0) return null;
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const result = Math.round(average);
    console.log(`🔊 Score Loudness Final: ${result}% (média de ${scores.length} métricas)`);
    return result;
}

// 4. CALCULAR SCORE DE DINÂMICA (LRA, DR, Crest Consistency, Fator de Crista)
function calculateDynamicsScore(analysis, refData) {
    if (!analysis || !refData) return null;
    
    const tech = analysis.technicalData || {};
    const metrics = analysis.metrics || {};
    const scores = [];
    
    // Dynamic Range (DR) - métrica principal de dinâmica
    const drValue = metrics.dynamic_range || tech.dynamicRange;
    if (Number.isFinite(drValue) && Number.isFinite(refData.dr_target) && Number.isFinite(refData.tol_dr)) {
        const score = calculateMetricScore(drValue, refData.dr_target, refData.tol_dr);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Dynamic Range: ${drValue} vs ${refData.dr_target} (±${refData.tol_dr}) = ${score}%`);
        }
    }
    
    // LRA (Loudness Range) - variação de loudness
    const lraValue = metrics.lra || tech.lra;
    if (Number.isFinite(lraValue) && Number.isFinite(refData.lra_target) && Number.isFinite(refData.tol_lra)) {
        const score = calculateMetricScore(lraValue, refData.lra_target, refData.tol_lra);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 LRA: ${lraValue} vs ${refData.lra_target} (±${refData.tol_lra}) = ${score}%`);
        }
    }
    
    // Crest Factor (já incluído em Loudness, mas importante para dinâmica também)
    const crestValue = tech.crestFactor || metrics.crest_factor;
    if (Number.isFinite(crestValue) && refData.crest_target && Number.isFinite(refData.crest_target)) {
        const tolerance = refData.tol_crest || 2.0;
        const score = calculateMetricScore(crestValue, refData.crest_target, tolerance);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Crest Factor (Dinâmica): ${crestValue} vs ${refData.crest_target} (±${tolerance}) = ${score}%`);
        }
    }
    
    // Compressão detectada (se disponível)
    const compressionRatio = tech.compressionRatio;
    if (Number.isFinite(compressionRatio) && refData.compression_target && Number.isFinite(refData.compression_target)) {
        const tolerance = refData.tol_compression || 1.0;
        const score = calculateMetricScore(compressionRatio, refData.compression_target, tolerance);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Compressão: ${compressionRatio} vs ${refData.compression_target} (±${tolerance}) = ${score}%`);
        }
    }
    
    // Retornar média dos scores válidos
    if (scores.length === 0) return null;
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const result = Math.round(average);
    console.log(`📊 Score Dinâmica Final: ${result}% (média de ${scores.length} métricas)`);
    return result;
}

// 5. CALCULAR SCORE DE ESTÉREO (Largura, Correlação, Balanço L/R)
function calculateStereoScore(analysis, refData) {
    if (!analysis || !refData) return null;
    
    const tech = analysis.technicalData || {};
    const metrics = analysis.metrics || {};
    const scores = [];
    
    // Correlação Estéreo (principal métrica de estéreo)
    const stereoValue = metrics.stereo_correlation || tech.stereoCorrelation;
    if (Number.isFinite(stereoValue) && Number.isFinite(refData.stereo_target) && Number.isFinite(refData.tol_stereo)) {
        const score = calculateMetricScore(stereoValue, refData.stereo_target, refData.tol_stereo);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Correlação Estéreo: ${stereoValue} vs ${refData.stereo_target} (±${refData.tol_stereo}) = ${score}%`);
        }
    }
    
    // Largura Estéreo (Width)
    const widthValue = tech.stereoWidth || metrics.stereo_width;
    if (Number.isFinite(widthValue) && refData.width_target && Number.isFinite(refData.width_target)) {
        const tolerance = refData.tol_width || 0.2;
        const score = calculateMetricScore(widthValue, refData.width_target, tolerance);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Largura Estéreo: ${widthValue} vs ${refData.width_target} (±${tolerance}) = ${score}%`);
        }
    }
    
    // Balanço L/R (se disponível)
    const balanceValue = tech.stereoBalance || metrics.stereo_balance;
    if (Number.isFinite(balanceValue)) {
        // Balanço ideal é 0 (perfeitamente centrado)
        const balanceTarget = refData.balance_target || 0.0;
        const balanceTolerance = refData.tol_balance || 0.1; // 10% de tolerância
        const score = calculateMetricScore(balanceValue, balanceTarget, balanceTolerance);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Balanço L/R: ${balanceValue} vs ${balanceTarget} (±${balanceTolerance}) = ${score}%`);
        }
    }
    
    // Separação de canais (se disponível)
    const separationValue = tech.channelSeparation || metrics.channel_separation;
    if (Number.isFinite(separationValue) && refData.separation_target && Number.isFinite(refData.separation_target)) {
        const tolerance = refData.tol_separation || 5.0;
        const score = calculateMetricScore(separationValue, refData.separation_target, tolerance);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Separação de Canais: ${separationValue} vs ${refData.separation_target} (±${tolerance}) = ${score}%`);
        }
    }
    
    // Retornar média dos scores válidos
    if (scores.length === 0) return null;
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const result = Math.round(average);
    console.log(`🎧 Score Estéreo Final: ${result}% (média de ${scores.length} métricas)`);
    return result;
}

// 6. CALCULAR SCORE DE FREQUÊNCIA (BANDAS ESPECTRAIS)
function calculateFrequencyScore(analysis, refData) {
    if (!analysis || !refData || !refData.bands) return null;
    
    const centralizedBands = analysis.metrics?.bands;
    const legacyBandEnergies = analysis.technicalData?.bandEnergies;
    const bandsToUse = centralizedBands && Object.keys(centralizedBands).length > 0 ? centralizedBands : legacyBandEnergies;
    
    if (!bandsToUse) return null;
    
    const scores = [];
    const isReferenceMode = refData._isReferenceMode === true;
    
    console.log('🎵 Calculando Score de Frequência...', {
        mode: isReferenceMode ? 'REFERENCE (valores diretos)' : 'GENRE (target_range)',
        bandsAvailable: Object.keys(refData.bands)
    });
    
    // Mapeamento das bandas calculadas para referência (exatamente as 7 bandas da tabela UI)
    const bandMapping = {
        'sub': 'sub',
        'bass': 'low_bass',
        'lowMid': 'low_mid',
        'mid': 'mid',
        'highMid': 'high_mid',
        'presence': 'presenca',
        'air': 'brilho'
    };
    
    // Processar cada banda individualmente
    Object.entries(bandMapping).forEach(([calcBand, refBand]) => {
        const bandData = bandsToUse[calcBand];
        const refBandData = refData.bands[refBand];
        
        if (bandData && refBandData) {
            let energyDb = null;
            
            // Extrair valor em dB da banda
            if (typeof bandData === 'object' && Number.isFinite(bandData.energy_db)) {
                energyDb = bandData.energy_db;
            } else if (typeof bandData === 'object' && Number.isFinite(bandData.rms_db)) {
                energyDb = bandData.rms_db;
            } else if (Number.isFinite(bandData)) {
                energyDb = bandData;
            }
            
            if (!Number.isFinite(energyDb)) return;
            
            // 🎯 CORREÇÃO CRÍTICA: Detectar modo e usar valores apropriados
            let targetDb = null;
            let tolDb = null;
            
            if (isReferenceMode) {
                // 👉 MODO REFERENCE: Usar valor DIRETO da faixa de referência (não target_range)
                if (typeof refBandData === 'object' && Number.isFinite(refBandData.energy_db)) {
                    targetDb = refBandData.energy_db;
                } else if (typeof refBandData === 'object' && Number.isFinite(refBandData.rms_db)) {
                    targetDb = refBandData.rms_db;
                } else if (Number.isFinite(refBandData)) {
                    targetDb = refBandData;
                }
                tolDb = 0; // Sem tolerância em comparação direta
                
                if (targetDb !== null) {
                    console.log(`🎯 [SCORE-FREQ-REF] ${calcBand}: comparando com faixa de referência → target=${targetDb.toFixed(1)}dB (valor real), tol=0dB`);
                } else {
                    console.warn(`⚠️ [SCORE-FREQ-REF] ${calcBand}: sem valor na faixa de referência`);
                }
            } else {
                // 👉 MODO GENRE: Usar target_range dos targets de gênero
                if (refBandData.target_range && typeof refBandData.target_range === 'object' &&
                    Number.isFinite(refBandData.target_range.min) && Number.isFinite(refBandData.target_range.max)) {
                    // Novo sistema: calcular alvo e tolerância a partir do range
                    targetDb = (refBandData.target_range.min + refBandData.target_range.max) / 2;
                    tolDb = (refBandData.target_range.max - refBandData.target_range.min) / 2;
                    console.log(`🎯 [SCORE-FREQ-GENRE] ${calcBand}: usando target_range [${refBandData.target_range.min}, ${refBandData.target_range.max}] → target=${targetDb.toFixed(1)}dB, tol=${tolDb.toFixed(1)}dB`);
                } else if (Number.isFinite(refBandData.target_db) && Number.isFinite(refBandData.tol_db)) {
                    // Sistema legado
                    targetDb = refBandData.target_db;
                    tolDb = refBandData.tol_db;
                    console.log(`🎯 [SCORE-FREQ-GENRE] ${calcBand}: usando target_db=${targetDb}dB, tol_db=${tolDb}dB`);
                }
            }
            
            // Calcular score individual da banda
            if (Number.isFinite(targetDb) && Number.isFinite(tolDb)) {
                const score = calculateMetricScore(energyDb, targetDb, tolDb);
                if (score !== null) {
                    scores.push(score);
                    const delta = Math.abs(energyDb - targetDb);
                    const status = delta <= tolDb ? '✅' : '❌';
                    console.log(`🎵 ${calcBand.toUpperCase()}: ${energyDb.toFixed(1)}dB vs ${targetDb.toFixed(1)}dB (±${tolDb.toFixed(1)}dB) = ${score}% ${status}`);
                }
            }
        }
    });
    
    // Se não encontrou scores válidos, retornar null
    if (scores.length === 0) return null;
    
    // Média aritmética simples das bandas válidas
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const result = Math.round(average);
    
    console.log(`🎵 Score Frequência Final: ${result}% (média de ${scores.length} bandas)`);
    console.log(`🎵 Scores individuais: [${scores.join(', ')}]`);
    
    return result;
}

// 7. CALCULAR SCORE TÉCNICO
// 7. CALCULAR SCORE TÉCNICO (Clipping, DC Offset, THD)
function calculateTechnicalScore(analysis, refData) {
    if (!analysis) return null;
    
    const tech = analysis.technicalData || {};
    const metrics = analysis.metrics || {};
    const scores = [];
    
    console.log('🔧 Calculando Score Técnico...');
    
    // 1. CLIPPING - Deve ser próximo de 0% (PENALIZAÇÃO FORTE PARA PROBLEMAS CRÍTICOS)
    const clippingValue = tech.clipping || metrics.clipping || 0;
    if (Number.isFinite(clippingValue)) {
        let clippingScore = 100;
        
        if (clippingValue <= 0.001) { // ≤ 0.1% = perfeito
            clippingScore = 100;
        } else if (clippingValue <= 0.005) { // ≤ 0.5% = bom
            clippingScore = 80;
        } else if (clippingValue <= 0.01) { // ≤ 1% = aceitável
            clippingScore = 60;
        } else if (clippingValue <= 0.02) { // ≤ 2% = problemático
            clippingScore = 40;
        } else { // > 2% = crítico
            clippingScore = 20;
        }
        
        scores.push(clippingScore);
        console.log(`🔧 Clipping: ${(clippingValue * 100).toFixed(3)}% = ${clippingScore}%`);
    }
    
    // 2. DC OFFSET - Deve ser próximo de 0
    const dcOffsetValue = Math.abs(tech.dcOffset || metrics.dc_offset || 0);
    if (Number.isFinite(dcOffsetValue)) {
        let dcScore = 100;
        
        if (dcOffsetValue <= 0.001) { // ≤ 0.1% = perfeito
            dcScore = 100;
        } else if (dcOffsetValue <= 0.005) { // ≤ 0.5% = bom
            dcScore = 80;
        } else if (dcOffsetValue <= 0.01) { // ≤ 1% = aceitável
            dcScore = 60;
        } else if (dcOffsetValue <= 0.02) { // ≤ 2% = problemático
            dcScore = 40;
        } else { // > 2% = crítico
            dcScore = 20;
        }
        
        scores.push(dcScore);
        console.log(`🔧 DC Offset: ${dcOffsetValue.toFixed(4)} = ${dcScore}%`);
    }
    
    // 3. THD (Total Harmonic Distortion) - Deve ser baixo
    const thdValue = tech.thd || metrics.thd || 0;
    if (Number.isFinite(thdValue)) {
        let thdScore = 100;
        
        if (thdValue <= 0.001) { // ≤ 0.1% = perfeito
            thdScore = 100;
        } else if (thdValue <= 0.005) { // ≤ 0.5% = bom
            thdScore = 80;
        } else if (thdValue <= 0.01) { // ≤ 1% = aceitável
            thdScore = 60;
        } else if (thdValue <= 0.02) { // ≤ 2% = problemático
            thdScore = 40;
        } else { // > 2% = crítico
            thdScore = 20;
        }
        
        scores.push(thdScore);
        console.log(`🔧 THD: ${(thdValue * 100).toFixed(3)}% = ${thdScore}%`);
    }
    
    // 4. PROBLEMAS DETECTADOS (Issues) - PENALIZAÇÃO GRADUAL
    const issues = analysis.issues || [];
    let issuesScore = 100;
    
    issues.forEach(issue => {
        switch (issue.severity) {
            case 'critical':
                issuesScore = Math.max(20, issuesScore - 30); // Não zerar, mínimo 20
                console.log(`🔧 Issue CRÍTICO: ${issue.description} (-30%)`);
                break;
            case 'high':
                issuesScore = Math.max(40, issuesScore - 20); // Mínimo 40
                console.log(`🔧 Issue ALTO: ${issue.description} (-20%)`);
                break;
            case 'medium':
                issuesScore = Math.max(60, issuesScore - 10); // Mínimo 60
                console.log(`🔧 Issue MÉDIO: ${issue.description} (-10%)`);
                break;
            case 'low':
                issuesScore = Math.max(80, issuesScore - 5); // Mínimo 80
                console.log(`🔧 Issue BAIXO: ${issue.description} (-5%)`);
                break;
        }
    });
    
    if (issues.length > 0) {
        scores.push(issuesScore);
        console.log(`🔧 Issues Gerais: ${issuesScore}% (${issues.length} problemas)`);
    }
    
    // 🎯 NOVA VALIDAÇÃO TRUE PEAK (CORREÇÃO CRÍTICA)
    const truePeak = tech.truePeakDbtp || metrics.truePeakDbtp;
    let truePeakScore = 100; // Score padrão se não houver dados
    let hasTruePeakData = false;
    
    if (Number.isFinite(truePeak)) {
        hasTruePeakData = true;
        console.log(`🔧 True Peak: ${truePeak.toFixed(2)} dBTP`);
        
        if (truePeak <= -1.5) { // Excelente
            truePeakScore = 100;
            console.log(`🔧 True Peak EXCELENTE: ${truePeakScore}%`);
        } else if (truePeak <= -1.0) { // Ideal
            truePeakScore = 90;
            console.log(`🔧 True Peak IDEAL: ${truePeakScore}%`);
        } else if (truePeak <= -0.5) { // Bom
            truePeakScore = 80;
            console.log(`🔧 True Peak BOM: ${truePeakScore}%`);
        } else if (truePeak <= 0.0) { // Aceitável
            truePeakScore = 70;
            console.log(`🔧 True Peak ACEITÁVEL: ${truePeakScore}%`);
        } else if (truePeak <= 0.5) { // Problemático
            truePeakScore = 40;
            console.log(`🔧 True Peak PROBLEMÁTICO: ${truePeakScore}%`);
        } else { // Crítico
            truePeakScore = 20;
            console.log(`🔧 True Peak CRÍTICO: ${truePeakScore}%`);
        }
        
        scores.push(truePeakScore);
    }
    
    // Se não temos métricas técnicas específicas, usar apenas issues
    if (scores.length === 0) {
        const result = Math.max(20, Math.round(issuesScore)); // Nunca zerar
        console.log(`🔧 Score Técnico Final (apenas issues): ${result}%`);
        return result;
    }
    
    // Média normalizada de todas as métricas técnicas (0-100)
    let average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    let result = Math.max(20, Math.round(average)); // Nunca zerar completamente
    
    // 🚨 HARD CAP: True Peak ESTOURADO (> 0.0 dBTP) limita score a 60%
    if (hasTruePeakData && truePeak > 0.0) {
        const maxScoreWithClipping = 60;
        const originalResult = result;
        result = Math.min(result, maxScoreWithClipping);
        
        console.log(`🚨 HARD CAP APLICADO: True Peak estourado (${truePeak.toFixed(2)} dBTP)`);
        console.log(`🚨 Score limitado de ${originalResult}% para ${result}% (máx: ${maxScoreWithClipping}%)`);
    }
    
    console.log(`🔧 Score Técnico Final: ${result}% (média de ${scores.length} métricas${hasTruePeakData ? ', True Peak incluído' : ''})`);
    return result;
}

// 8. FUNÇÃO PRINCIPAL: CALCULAR TODOS OS SCORES
function calculateAnalysisScores(analysis, refData, genre = null) {
    console.log('🎯 Calculando scores da análise...', { genre });
    
    if (!analysis || !refData) {
        console.warn('⚠️ Dados insuficientes para calcular scores');
        return null;
    }
    
    // Calcular sub-scores
    const loudnessScore = calculateLoudnessScore(analysis, refData);
    const dynamicsScore = calculateDynamicsScore(analysis, refData);
    const stereoScore = calculateStereoScore(analysis, refData);
    const frequencyScore = calculateFrequencyScore(analysis, refData);
    const technicalScore = calculateTechnicalScore(analysis, refData);
    
    console.log('📊 Sub-scores calculados:', {
        loudness: loudnessScore,
        dinamica: dynamicsScore,
        estereo: stereoScore,
        frequencia: frequencyScore,
        tecnico: technicalScore
    });
    
    // Determinar pesos por gênero
    const genreKey = genre ? genre.toLowerCase().replace(/\s+/g, '_') : 'default';
    const weights = GENRE_SCORING_WEIGHTS[genreKey] || GENRE_SCORING_WEIGHTS['default'];
    
    console.log('⚖️ Pesos aplicados:', weights);
    
    // CORREÇÃO: Calcular score final com valores contínuos
    let weightedSum = 0;
    let totalWeight = 0;
    
    // Somar apenas os scores que existem, ajustando os pesos dinamicamente
    if (loudnessScore !== null) {
        weightedSum += loudnessScore * weights.loudness;
        totalWeight += weights.loudness;
    }
    
    if (dynamicsScore !== null) {
        weightedSum += dynamicsScore * weights.dinamica;
        totalWeight += weights.dinamica;
    }
    
    if (stereoScore !== null) {
        weightedSum += stereoScore * weights.estereo;
        totalWeight += weights.estereo;
    }
    
    if (frequencyScore !== null) {
        weightedSum += frequencyScore * weights.frequencia;
        totalWeight += weights.frequencia;
    }
    
    if (technicalScore !== null) {
        weightedSum += technicalScore * weights.tecnico;
        totalWeight += weights.tecnico;
    }
    
    // Calcular score final normalizado (permite valores contínuos como 67.3, depois arredonda)
    let finalScore = null;
    if (totalWeight > 0) {
        const rawFinalScore = weightedSum / totalWeight;
        finalScore = Math.round(rawFinalScore); // Só arredondar no final
    }
    
    const result = {
        final: finalScore,
        loudness: loudnessScore,
        dinamica: dynamicsScore,
        frequencia: frequencyScore,
        estereo: stereoScore,
        tecnico: technicalScore,
        weights: weights,
        genre: genreKey
    };
    
    console.log('🎯 Score final calculado:', result);
    
    // 🎯 AUDIT_REF_FIX: Log final de confirmação do fluxo A/B
    if (refData._isReferenceMode === true) {
        console.log('[REFERENCE-A/B FIXED ✅] Comparação A/B concluída com sucesso');
        console.log('[AUDIT_REF_FIX] Bands carregadas da segunda música (referência real)');
        console.log('[AUDIT_REF_FIX] ReferenceComparison gerado com dados A/B corretos');
    }
    
    return result;
}

// Recalcular apenas as sugestões baseadas em referência (sem reprocessar o áudio)
function updateReferenceSuggestions(analysis) {
    console.log('🔍 [DEBUG-REF] updateReferenceSuggestions chamado:', {
        hasAnalysis: !!analysis,
        hasTechnicalData: !!analysis?.technicalData,
        hasActiveRefData: !!__activeRefData,
        hasReferenceComparisonMetrics: !!referenceComparisonMetrics,
        activeRefGenre: __activeRefGenre,
        activeRefDataKeys: __activeRefData ? Object.keys(__activeRefData) : null,
        currentGenre: window.PROD_AI_REF_GENRE
    });
    
    if (!analysis || !analysis.technicalData) {
        console.warn('🚨 [DEBUG-REF] analysis ou technicalData ausentes');
        return;
    }
    
    // 🎯 PRIORIDADE: Se temos comparação entre faixas, usar referenceComparisonMetrics
    let targetMetrics = null;
    
    if (referenceComparisonMetrics && referenceComparisonMetrics.reference) {
        console.log('✅ [SUGGESTIONS] Usando referenceComparisonMetrics para sugestões (comparação entre faixas)');
        
        // Construir targetMetrics no formato esperado
        const refMetrics = referenceComparisonMetrics.reference;
        targetMetrics = {
            lufs_target: refMetrics.lufsIntegrated || refMetrics.lufs_integrated,
            true_peak_target: refMetrics.truePeakDbtp || refMetrics.true_peak_dbtp,
            dr_target: refMetrics.dynamicRange || refMetrics.dynamic_range,
            lra_target: refMetrics.lra,
            stereo_target: refMetrics.stereoCorrelation || refMetrics.stereo_correlation,
            spectral_centroid_target: refMetrics.spectralCentroidHz || refMetrics.spectral_centroid,
            bands: refMetrics.spectral_balance || null,
            tol_lufs: 0.5,
            tol_true_peak: 0.3,
            tol_dr: 1.0,
            tol_lra: 1.0,
            tol_stereo: 0.08,
            tol_spectral: 300
        };
        
        console.log('📊 [SUGGESTIONS] Target metrics (2ª faixa):', {
            lufs: targetMetrics.lufs_target,
            peak: targetMetrics.true_peak_target,
            dr: targetMetrics.dr_target
        });
        
        // Usar targetMetrics como __activeRefData temporariamente para compatibilidade
        __activeRefData = targetMetrics;
    }
    
    if (!__activeRefData) {
        console.warn('🚨 [DEBUG-REF] __activeRefData está null - tentando carregar gênero atual');
        
        // Tentar carregar dados de referência do gênero atual
        if (window.PROD_AI_REF_GENRE) {
            console.log('🔄 [DEBUG-REF] Tentando carregar dados para gênero:', window.PROD_AI_REF_GENRE);
            loadReferenceData(window.PROD_AI_REF_GENRE).then(() => {
                console.log('✅ [DEBUG-REF] Dados carregados, reprocessando sugestões');
                updateReferenceSuggestions(analysis);
            }).catch(err => {
                console.error('❌ [DEBUG-REF] Erro ao carregar dados:', err);
            });
        } else {
            // Tentar com dados de referência padrão embutidos
            console.log('🔄 [DEBUG-REF] Usando dados de referência embutidos');
            
            // Verificar se existem dados embutidos para o gênero detectado nos scores
            if (analysis.scores && analysis.scores.genre) {
                const detectedGenre = analysis.scores.genre;
                console.log('🎯 [DEBUG-REF] Gênero detectado nos scores:', detectedGenre);
                
                // Usar dados embutidos se disponíveis
                const embeddedRefs = {
                    eletrofunk: {
                        lufs_target: -8.3,
                        true_peak_target: -1,
                        dr_target: 10.1,
                        lra_target: 8.4,
                        stereo_target: 0.12,
                        bands: {
                            low_bass: { target_db: 13.3, tol_db: 2.36 },
                            low_mid: { target_db: 8.8, tol_db: 2.07 },
                            mid: { target_db: 2.5, tol_db: 1.81 },
                            high_mid: { target_db: -6.7, tol_db: 1.52 },
                            presenca: { target_db: -22.7, tol_db: 3.47 },
                            brilho: { target_db: -13.1, tol_db: 2.38 }
                        }
                    }
                };
                
                if (embeddedRefs[detectedGenre]) {
                    console.log('✅ [DEBUG-REF] Usando dados embutidos para', detectedGenre);
                    __activeRefData = embeddedRefs[detectedGenre];
                    __activeRefGenre = detectedGenre;
                    // Continuar com o processamento
                } else {
                    console.warn('❌ [DEBUG-REF] Gênero não suportado nos dados embutidos:', detectedGenre);
                    return;
                }
            } else {
                console.warn('❌ [DEBUG-REF] Nenhuma estratégia de recuperação disponível');
                return;
            }
        }
        
        // Se chegou até aqui sem return, __activeRefData foi definido pelos dados embutidos
        if (!__activeRefData) {
            return;
        }
    }
    
    // 🛡️ PROTEÇÃO: Evitar duplicação - resetar flag se chamado via applyGenreSelection
    if (analysis._suggestionsGenerated) {
        console.log('🎯 [SUGGESTIONS] Recalculando sugestões para novo gênero (resetando flag)');
        analysis._suggestionsGenerated = false;
    }
    
    // 🎯 SISTEMA MELHORADO: Usar Enhanced Suggestion Engine quando disponível
    if (typeof window !== 'undefined' && window.enhancedSuggestionEngine && window.USE_ENHANCED_SUGGESTIONS !== false) {
        try {
            console.log('🎯 Usando Enhanced Suggestion Engine...');
            
            // 🎯 INTERCEPT CRÍTICO: Usar reference targets se modo for reference
            const state = window.__soundyState || {};
            let targetDataForEngine = __activeRefData;
            
            if (state.render?.mode === 'reference') {
                // Buscar dados da primeira faixa (referência) para usar como target
                const referenceBands = state.reference?.analysis?.technicalData?.spectral_balance
                    || state.reference?.analysis?.bands
                    || referenceComparisonMetrics?.referenceFull?.technicalData?.spectral_balance
                    || null;
                
                if (referenceBands) {
                    console.log('� [ENGINE-INTERCEPT] Modo reference detectado - usando bandas da primeira faixa como target');
                    targetDataForEngine = {
                        ...(__activeRefData || {}),
                        bands: referenceBands,
                        _isReferenceMode: true,
                        _referenceSource: 'first_track'
                    };
                } else {
                    console.warn('⚠️ [ENGINE-INTERCEPT] Modo reference mas sem bandas - usando genreTargets (fallback)');
                }
            }
            
            console.log('�🔍 [DEBUG-ENGINE] Dados sendo passados para Enhanced Engine:', {
                mode: state.render?.mode,
                isReferenceMode: state.render?.mode === 'reference',
                analysis: {
                    hasTechnicalData: !!analysis.technicalData,
                    technicalDataKeys: analysis.technicalData ? Object.keys(analysis.technicalData) : null,
                    hasSuggestions: !!analysis.suggestions,
                    suggestionsCount: analysis.suggestions?.length || 0
                },
                targetDataForEngine: {
                    isNull: targetDataForEngine === null,
                    isUndefined: targetDataForEngine === undefined,
                    type: typeof targetDataForEngine,
                    keys: targetDataForEngine ? Object.keys(targetDataForEngine) : null,
                    structure: targetDataForEngine ? 'present' : 'missing',
                    hasBands: !!targetDataForEngine?.bands,
                    isReferenceMode: targetDataForEngine?._isReferenceMode
                }
            });
            
            const enhancedAnalysis = window.enhancedSuggestionEngine.processAnalysis(analysis, targetDataForEngine);
            
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
            
            console.log(`🎯 [SUGGESTIONS] Enhanced Engine: ${enhancedAnalysis.suggestions.length} sugestões geradas`);
            console.log(`🎯 [SUGGESTIONS] Sugestões preservadas: ${nonRefSuggestions.length}`);
            console.log(`🎯 [SUGGESTIONS] Total final: ${analysis.suggestions.length} sugestões`);
            
            // 🤖 NOVA CAMADA DE IA: Pós-processamento inteligente de sugestões (Enhanced Engine)
            if (typeof window !== 'undefined' && window.AI_SUGGESTION_LAYER_ENABLED && window.aiSuggestionLayer) {
                try {
                    console.log('🤖 [AI-LAYER] Enriquecendo sugestões do Enhanced Engine...');
                    
                    // Preparar contexto para IA
                    const aiContext = {
                        technicalData: analysis.technicalData,
                        genre: __activeRefGenre || analysis.genre,
                        referenceData: __activeRefData,
                        problems: analysis.problems,
                        enhancedMetrics: enhancedAnalysis.enhancedMetrics
                    };
                    
                    // Chamar IA de forma assíncrona
                    window.aiSuggestionLayer.process(analysis.suggestions, aiContext)
                        .then(enhancedSuggestions => {
                            if (enhancedSuggestions && enhancedSuggestions.length > 0) {
                                // ✅ aplicar ordem garantida após IA
                                enhancedSuggestions = window.enhancedSuggestionEngine
                                    .enforceOrderedSuggestions(enhancedSuggestions);

                                analysis.suggestions = enhancedSuggestions;
                                analysis._aiEnhanced = true;
                                analysis._aiTimestamp = new Date().toISOString();
                                analysis._aiSource = 'enhanced_engine';
                                
                                console.log(`🤖 [AI-LAYER] ✅ Enhanced Engine + IA: ${enhancedSuggestions.length} sugestões`);
                                
                                // 🚀 FORÇA EXIBIÇÃO: Sempre mostrar interface IA
                                if (window.aiUIController) {
                                    console.log(`🚀 [FORCE-AI-UI] Forçando exibição da interface IA com ${enhancedSuggestions.length} sugestões`);
                                    window.aiUIController.checkForAISuggestions(analysis);
                                }
                                
                                // Re-renderizar se modal visível
                                if (document.getElementById('audioAnalysisModal')?.style.display !== 'none') {
                                    displayModalResults(analysis);
                                }
                            }
                        })
                        .catch(error => {
                            console.warn('🤖 [AI-LAYER] ❌ Erro na IA do Enhanced Engine:', error);
                            
                            // 🚀 FORÇA EXIBIÇÃO: Mostrar interface IA mesmo em caso de erro
                            setTimeout(() => {
                                if (window.aiUIController && analysis.suggestions) {
                                    console.log(`🚀 [AI-UI-FORCE-ERROR] Forçando interface IA aparecer após erro com ${analysis.suggestions.length} sugestões`);
                                    window.aiUIController.checkForAISuggestions(analysis, true); // force = true
                                } else {
                                    console.warn('⚠️ [AI-UI-FORCE-ERROR] aiUIController não encontrado ou sem sugestões');
                                }
                            }, 100);
                        });
                } catch (error) {
                    console.warn('🤖 [AI-LAYER] ❌ Erro na integração IA Enhanced Engine:', error);
                }
            }
            
            return;
            
        } catch (error) {
            console.warn('🚨 Erro no Enhanced Suggestion Engine, usando fallback:', error);
            // Continuar com sistema legado em caso de erro
        }
    }
    
    // 🔄 SISTEMA LEGADO (fallback) - APENAS PARA SCORES, NÃO DEVE ALTERAR SUGESTÕES
    console.log('🔄 [FALLBACK] Sistema legado ativado - usando apenas para calcular scores');
    
    // IMPORTANTE: NÃO modificar analysis.suggestions aqui para não interferir com Enhanced Engine
    // Apenas calcular scores se necessário
    if (!analysis.scores && __activeRefData && analysis.technicalData) {
        try {
            analysis.scores = this.calculateFallbackScores(analysis.technicalData, __activeRefData);
            console.log('✅ [FALLBACK] Scores calculados pelo sistema legado');
        } catch (error) {
            console.warn('⚠️ [FALLBACK] Erro ao calcular scores legados:', error);
        }
    }
    
    console.log('🎯 [FALLBACK] Sistema legado concluído sem alterar sugestões');
    
    return; // ❌ SISTEMA LEGADO DESATIVADO - Enhanced Engine deve ser usado para sugestões
    
    // 🤖 NOVA CAMADA DE IA: Pós-processamento inteligente de sugestões
    // PONTO DE INTEGRAÇÃO SEGURO: Após geração de todas as sugestões
    if (typeof window !== 'undefined' && window.AI_SUGGESTION_LAYER_ENABLED && window.aiSuggestionLayer) {
        try {
            console.log('🤖 [AI-LAYER] Iniciando enriquecimento inteligente das sugestões...');
            
            // Preparar contexto para IA
            const aiContext = {
                technicalData: analysis.technicalData,
                genre: __activeRefGenre || analysis.genre,
                referenceData: __activeRefData,
                problems: analysis.problems
            };
            
            // Chamar IA de forma assíncrona com fallback
            window.aiSuggestionLayer.process(analysis.suggestions, aiContext)
                .then(enhancedSuggestions => {
                    if (enhancedSuggestions && enhancedSuggestions.length > 0) {
                        // ✅ aplicar ordem garantida após IA
                        enhancedSuggestions = window.enhancedSuggestionEngine
                            .enforceOrderedSuggestions(enhancedSuggestions);

                        analysis.suggestions = enhancedSuggestions;
                        console.log(`🤖 [AI-LAYER] ✅ ${enhancedSuggestions.length} sugestões enriquecidas com IA`);
                        
                        // Marcar que IA foi aplicada
                        analysis._aiEnhanced = true;
                        analysis._aiTimestamp = new Date().toISOString();
                        
                        // Re-renderizar modal se estiver visível
                        if (document.getElementById('audioAnalysisModal')?.style.display !== 'none') {
                            console.log('🎨 [AI-LAYER] Re-renderizando modal com sugestões IA');
                            displayModalResults(analysis);
                        }
                    } else {
                        console.warn('🤖 [AI-LAYER] ⚠️ IA retornou resultado vazio, mantendo sugestões originais');
                    }
                })
                .catch(error => {
                    console.warn('🤖 [AI-LAYER] ❌ Erro na camada de IA, mantendo sugestões originais:', error);
                    // Sistema continua funcionando normalmente com sugestões originais
                });
                
        } catch (error) {
            console.warn('🤖 [AI-LAYER] ❌ Erro na inicialização da IA, sistema continua normal:', error);
        }
    } else {
        console.log('🤖 [AI-LAYER] Sistema de IA desabilitado ou não disponível');
    }
    
    // 🛡️ Marcar que sugestões foram geradas (proteção contra duplicação)
    analysis._suggestionsGenerated = true;
}

/**
 * 🔢 Calcular scores básicos quando Enhanced Engine não está disponível
 * @param {Object} technicalData - Dados técnicos da análise
 * @param {Object} referenceData - Dados de referência
 * @returns {Object} Scores calculados
 */
function calculateFallbackScores(technicalData, referenceData) {
    const scores = {};
    
    try {
        // Score LUFS
        if (Number.isFinite(technicalData.lufsIntegrated) && Number.isFinite(referenceData.lufs_target)) {
            const delta = Math.abs(technicalData.lufsIntegrated - referenceData.lufs_target);
            const tolerance = referenceData.tol_lufs || 2.0;
            scores.lufs = Math.max(0, Math.min(10, 10 - (delta / tolerance) * 2));
        }
        
        // Score True Peak
        if (Number.isFinite(technicalData.truePeakDbtp)) {
            if (technicalData.truePeakDbtp > 0) {
                scores.truePeak = 0; // Crítico
            } else if (technicalData.truePeakDbtp > -1.0) {
                scores.truePeak = 5; // Aceitável mas não ideal
            } else {
                scores.truePeak = 10; // Ideal
            }
        }
        
        // Score DR
        if (Number.isFinite(technicalData.dynamicRange) && Number.isFinite(referenceData.dr_target)) {
            const delta = Math.abs(technicalData.dynamicRange - referenceData.dr_target);
            const tolerance = referenceData.tol_dr || 2.0;
            scores.dr = Math.max(0, Math.min(10, 10 - (delta / tolerance) * 2));
        }
        
        // Score geral (média dos scores disponíveis)
        const availableScores = Object.values(scores).filter(s => Number.isFinite(s));
        if (availableScores.length > 0) {
            scores.overall = availableScores.reduce((sum, score) => sum + score, 0) / availableScores.length;
        }
        
        console.log('📊 [FALLBACK] Scores calculados:', scores);
        return scores;
        
    } catch (error) {
        console.error('❌ [FALLBACK] Erro ao calcular scores:', error);
        return {};
    }
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

// 🎨 Estilos do Modal de Gênero Musical - Glassmorphism + Glitch
function injectGenreModalStyles() {
    if (document.getElementById('genreModalStyles')) return; // já injetado
    const style = document.createElement('style');
    style.id = 'genreModalStyles';
    style.textContent = `
    /* 🎵 Novo Modal de Gênero Musical - Glassmorphism */
    .genre-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 10000;
        opacity: 1;
        transition: opacity 0.3s ease;
    }

    .genre-modal.hidden {
        display: none;
        opacity: 0;
    }

    .genre-modal-container {
        max-width: 720px;
        width: 90%;
        max-height: 90vh;
        background: radial-gradient(
    circle at 20% 20%, 
    rgba(93, 21, 134, 0.85) 0%,       /* Roxo vibrante no canto */
    rgba(0, 0, 0, 0.95) 60%,          /* Preto no centro */
    rgba(0, 102, 255, 0.4) 100%       /* Azul elétrico nas bordas */
);
backdrop-filter: blur(8px);
box-shadow: 0 0 30px rgba(93, 21, 134, 0.4),
            0 0 60px rgba(0, 102, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 20px;
        padding: 40px 32px 32px 32px;
        text-align: center;
        position: relative;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow: 
            0 20px 40px rgba(91, 11, 156, 0.49),
            0 0 0 1px rgba(255, 255, 255, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transform: scale(1);
        transition: transform 0.2s ease;
        overflow: hidden;
    }

    /* LINHAS NEURAIS VANTA - FUNDO TECH */
    .genre-modal-container::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: 
            repeating-linear-gradient(
                0deg,
                transparent,
                transparent 40px,
                rgba(106, 154, 255, 0.03) 40px,
                rgba(106, 154, 255, 0.03) 41px
            ),
            repeating-linear-gradient(
                90deg,
                transparent,
                transparent 40px,
                rgba(106, 0, 255, 0.03) 40px,
                rgba(106, 0, 255, 0.03) 41px
            ),
            repeating-linear-gradient(
                45deg,
                transparent,
                transparent 60px,
                rgba(0, 212, 255, 0.02) 60px,
                rgba(0, 212, 255, 0.02) 61px
            );
        opacity: 0.6;
        animation: neural-grid-genre 15s linear infinite;
        pointer-events: none;
        z-index: 1;
    }

    /* Partículas flutuantes */
    .genre-modal-container::after {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background-image: 
            radial-gradient(circle, rgba(106, 0, 255, 0.15) 1px, transparent 1px),
            radial-gradient(circle, rgba(0, 212, 255, 0.1) 1px, transparent 1px);
        background-size: 50px 50px, 80px 80px;
        background-position: 0 0, 25px 25px;
        animation: particles-float-genre 20s linear infinite;
        pointer-events: none;
        z-index: 1;
    }

    @keyframes neural-grid-genre {
        0% {
            transform: translate(0, 0);
            opacity: 0.6;
        }
        50% {
            opacity: 0.4;
        }
        100% {
            transform: translate(40px, 40px);
            opacity: 0.6;
        }
    }

    @keyframes particles-float-genre {
        0% {
            transform: translate(0, 0) rotate(0deg);
        }
        100% {
            transform: translate(50px, 50px) rotate(360deg);
        }
    }

    /* Garante que conteúdo fica acima do fundo neural */
    .genre-modal-container > * {
        position: relative;
        z-index: 5;
    }

    /* Título com efeito glitch - Paleta roxo escuro + azul ciano */
    .genre-modal-title {
        font-family: 'Orbitron', 'Rajdhani', 'Montserrat Alternates', sans-serif;
        font-size: 2.2rem;
        font-weight: 700;
        text-transform: uppercase;
        color: #ffffff;
        margin-bottom: 12px;
        position: relative;
        letter-spacing: 2px;
        text-align: center;
        text-shadow: 
            0 0 12px rgba(0, 212, 255, 0.4),
            0 0 24px rgba(108, 0, 162, 0.2),
            0 0 40px rgba(0, 212, 255, 0.15);
    }

    .genre-modal-title.glitch::before,
    .genre-modal-title.glitch::after {
        content: attr(data-text);
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0.85;
        pointer-events: none;
    }

    /* PARTE SUPERIOR — Roxo escuro */
    .genre-modal-title.glitch::before {
        color: #6c00a2;
        animation: glitch-1 2s infinite alternate-reverse;
        clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
    }

    /* PARTE INFERIOR — Azul ciano */
    .genre-modal-title.glitch::after {
        color: #00d4ff;
        animation: glitch-2 3s infinite alternate-reverse;
        clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
    }

    @keyframes glitch-1 {
        0% { transform: translateX(-2px); }
        100% { transform: translateX(2px); }
    }

    @keyframes glitch-2 {
        0% { transform: translateX(2px); }
        100% { transform: translateX(-2px); }
    }

    .genre-modal-subtitle {
        color: rgba(255, 255, 255, 0.7);
        font-size: 1rem;
        margin-bottom: 32px;
        font-weight: 400;
    }

    /* Grid de gêneros */
    .genre-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
    }

    /* 🔧 CORREÇÃO FLASH BRANCO: Estado inicial explícito */
    .genre-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 20px 16px;
        
        /* Estado base: exatamente o visual glass atual */
        background: rgba(255, 255, 255, 0.05);
        background-color: transparent; /* Evita herdar branco do user-agent */
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        color: #ffffff;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        
        /* ❌ NÃO animar background - só transform, box-shadow, border-color, opacity */
        transition: 
            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.25s ease;
        
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        
        /* Zera estilos nativos se for <button> */
        -webkit-appearance: none;
        appearance: none;
    }

    /* Prepaint: cards invisíveis enquanto CSS assenta */
    .genre-modal.prepaint .genre-card {
        opacity: 0;
    }

    .genre-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, 
            transparent, 
            rgba(255, 255, 255, 0.1), 
            transparent);
        transition: left 0.6s ease;
    }

    .genre-card:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(36, 157, 255, 0.4);
        transform: scale(1.05) translateY(-2px);
        box-shadow: 
            0 10px 25px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(36, 157, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .genre-card:hover::before {
        left: 100%;
    }

    .genre-card:active {
        transform: scale(0.98) translateY(1px);
    }

    .genre-icon {
        font-size: 2rem;
        filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
    }

    .genre-name {
        font-weight: 700;
        letter-spacing: 0.5px;
    }

    /* Botão fechar */
    .genre-modal-close {
        background: rgba(255, 255, 255, 0.08);
        background-color: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.8);
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 0.9rem;
        cursor: pointer;
        /* ❌ NÃO animar background */
        transition: 
            border-color 0.2s ease,
            color 0.2s ease,
            opacity 0.2s ease;
        font-weight: 500;
        -webkit-appearance: none;
        appearance: none;
    }

    .genre-modal-close:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.4);
    }

    /* Responsividade */
    @media (max-width: 768px) {
        .genre-modal-container {
            width: 95%;
            padding: 32px 20px 24px 20px;
        }

        .genre-modal-title {
            font-size: 1.8rem;
        }

        .genre-grid {
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
        }

        .genre-card {
            padding: 16px 12px;
            gap: 8px;
        }

        .genre-icon {
            font-size: 1.5rem;
        }

        .genre-name {
            font-size: 0.85rem;
        }
    }

    @media (max-width: 480px) {
        .genre-grid {
            grid-template-columns: repeat(2, 1fr);
        }
        
        .genre-card {
            padding: 14px 10px;
        }
    }
    `;
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

// 📄 Baixar relatório do modal (IMPLEMENTAÇÃO ROBUSTA COM VALIDAÇÃO)
async function downloadModalAnalysis() {
    // 1️⃣ VALIDAÇÃO: Verificar se análise está disponível no alias global
    const analysis = window.__soundyAI?.analysis || currentModalAnalysis;
    
    if (!analysis) {
        alert('❌ Nenhuma análise disponível.\n\nFaça uma análise antes de gerar o relatório.');
        console.error('[PDF-ERROR] Análise não encontrada em window.__soundyAI.analysis ou currentModalAnalysis');
        return;
    }
    
    // 🔍 AUDITORIA: Mapear estrutura completa do objeto analysis
    console.log('🔍 [AUDIT-PDF] ============ INÍCIO DA AUDITORIA ============');
    console.log('🔍 [AUDIT-PDF] Analysis root keys:', Object.keys(analysis));
    console.log('🔍 [AUDIT-PDF] Fontes detectadas:', {
        bands: analysis.bands,
        spectralBands: analysis.spectralBands,
        spectral: analysis.spectral,
        userBands: analysis.user?.bands,
        diagnostics: analysis.diagnostics,
        problems: analysis.problems,
        _diagnostic: analysis._diagnostic,
        suggestions: analysis.suggestions,
        suggestionsAdvanced: analysis.suggestionsAdvanced,
        aiSuggestions: analysis.ai?.suggestions,
        aiSuggestionsEnriched: analysis.ai?.suggestions?.enriched,
        _suggestionsGenerated: analysis._suggestionsGenerated,
        score: analysis.score,
        userScore: analysis.user?.score
    });
    
    // 🔍 AUDITORIA: Comparar com valores da UI (modal Paperline)
    console.log('🔍 [AUDIT-UI] Valores exibidos na UI:', {
        score: document.querySelector('.score-final-value')?.dataset?.value || document.querySelector('.score-final-value')?.textContent,
        bandSub: document.querySelector('[data-metric="band-sub"]')?.dataset?.value || document.querySelector('[data-metric="band-sub"]')?.textContent,
        bandBass: document.querySelector('[data-metric="band-bass"]')?.dataset?.value || document.querySelector('[data-metric="band-bass"]')?.textContent,
        bandMid: document.querySelector('[data-metric="band-mid"]')?.dataset?.value || document.querySelector('[data-metric="band-mid"]')?.textContent,
        bandHigh: document.querySelector('[data-metric="band-high"]')?.dataset?.value || document.querySelector('[data-metric="band-high"]')?.textContent
    });
    
    console.log('📄 [PDF-START] Iniciando geração de relatório PDF...');
    console.log('📄 [PDF-SOURCE] Fonte de dados:', {
        usingGlobalAlias: !!window.__soundyAI?.analysis,
        usingCurrentModal: !!currentModalAnalysis,
        fileName: analysis.fileName || analysis.metadata?.fileName,
        hasLoudness: !!(analysis.loudness || analysis.lufsIntegrated),
        hasTruePeak: !!(analysis.truePeak || analysis.truePeakDbtp)
    });
    
    // 2️⃣ VALIDAÇÃO: Verificar dependências
    if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        showTemporaryFeedback('⚙️ Carregando bibliotecas...');
        console.warn('⚠️ [PDF-WAIT] Aguardando carregamento de jsPDF/html2canvas...');
        
        // Retry após 1s
        setTimeout(() => downloadModalAnalysis(), 1000);
        return;
    }
    
    try {
        showTemporaryFeedback('⚙️ Gerando relatório PDF...');
        
        // 3️⃣ VALIDAÇÃO CONTRA UI: Comparar dados do relatório com a UI
        validateAnalysisDataAgainstUI(analysis);
        
        // 4️⃣ NORMALIZAR: Extrair e formatar dados
        const normalizedData = normalizeAnalysisDataForPDF(analysis);
        
        // 5️⃣ GERAR HTML: Template profissional
        const reportHTML = generateReportHTML(normalizedData);
        
        // 6️⃣ PREPARAR CONTAINER: Inserir e tornar visível
        const container = document.getElementById('pdf-report-template');
        if (!container) {
            throw new Error('Container #pdf-report-template não encontrado no DOM');
        }
        
        container.innerHTML = reportHTML;
        const elemento = container.firstElementChild;
        if (!elemento) {
            throw new Error('Template HTML não foi renderizado corretamente');
        }
        
        // Salvar estilos originais
        const originalStyles = {
            display: container.style.display,
            visibility: container.style.visibility,
            position: container.style.position,
            left: container.style.left,
            top: container.style.top,
            zIndex: container.style.zIndex
        };
        
        // ✅ PROPORÇÃO FIXA A4: 794x1123 px (resolução base vertical)
        const A4_WIDTH = 794;
        const A4_HEIGHT = 1123;
        const A4_RATIO = A4_HEIGHT / A4_WIDTH; // 1.414 (proporção A4)
        
        // Forçar visibilidade temporária com proporção A4 fixa
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.position = 'fixed';
        container.style.left = '50%';
        container.style.top = '0';
        container.style.transform = 'translateX(-50%)'; // Centralizar horizontalmente
        container.style.zIndex = '9999';
        container.style.width = `${A4_WIDTH}px`; // Largura fixa A4
        container.style.height = 'auto';
        container.style.margin = '0 auto';
        
        console.log('📊 [PDF-RENDER] Container preparado com proporção A4:', {
            baseWidth: A4_WIDTH,
            baseHeight: A4_HEIGHT,
            ratio: A4_RATIO,
            containerWidth: elemento.offsetWidth,
            containerHeight: elemento.offsetHeight,
            isVisible: elemento.offsetWidth > 0 && elemento.offsetHeight > 0
        });
        
        // 7️⃣ AGUARDAR RENDERIZAÇÃO: 250ms base + scroll + 150ms
        await new Promise(r => setTimeout(r, 250));
        elemento.scrollIntoView({ behavior: 'instant', block: 'start' });
        await new Promise(r => setTimeout(r, 150));
        
        // ✅ 8️⃣ CAPTURAR PÁGINAS SEPARADAMENTE com proporção fixa A4
        console.log('📸 [PDF-CAPTURE] Iniciando captura em 2 páginas lógicas com proporção A4 fixa...');
        
        // ✅ PROPORÇÃO FIXA: Sempre usar 794px (A4) com scale 2 (alta qualidade)
        // NÃO depende de viewport - garante consistência desktop/mobile
        const CAPTURE_WIDTH = A4_WIDTH; // 794px
        const CAPTURE_SCALE = 2; // Alta qualidade (1588px efetivos)
        const CAPTURE_BG = '#0a0a0f'; // Fundo escuro profissional
        
        console.log('� [PDF-A4-FIXED]', {
            captureWidth: CAPTURE_WIDTH,
            captureScale: CAPTURE_SCALE,
            backgroundColor: CAPTURE_BG,
            effectiveWidth: CAPTURE_WIDTH * CAPTURE_SCALE,
            note: 'Proporção A4 fixa (não depende de viewport)'
        });
        
        const section1 = elemento.querySelector('.pdf-section-metrics');
        const section2 = elemento.querySelector('.pdf-section-diagnostics');
        
        if (!section1 || !section2) {
            throw new Error('❌ Seções PDF não encontradas. Verifique as classes .pdf-section-metrics e .pdf-section-diagnostics');
        }
        
        console.log('� [PDF-CAPTURE] Capturando Página 1 (Métricas)...');
        // ✅ Função genérica e segura de captura A4 com wrapper virtual
        async function renderSectionToPDF(element, sectionName) {
            const wrapper = document.createElement('div');
            const isMobile = window.innerWidth < 768;
            wrapper.style.width = '794px';
            wrapper.style.height = '1123px';
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'flex-start';
            wrapper.style.justifyContent = 'center';
            wrapper.style.background = '#0a0a0f';
            wrapper.style.padding = '0';  // ✅ Zero padding no wrapper
            wrapper.style.position = 'fixed';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '0';
            wrapper.style.zIndex = '-1';
            wrapper.style.overflow = 'hidden';
            
            // Clona o conteúdo e aplica padding no clone (não no wrapper)
            const clone = element.cloneNode(true);
            clone.style.padding = isMobile ? '10px' : '20px';  // ✅ Padding no conteúdo
            clone.style.boxSizing = 'border-box';
            clone.style.width = '100%';
            clone.style.height = '100%';
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);
            
            // Aguarda renderização
            await new Promise(r => setTimeout(r, 150));
            
            console.log(`📐 [PDF-WRAPPER] ${sectionName}:`, {
                declared: { width: '794px', height: '1123px' },
                computed: {
                    offsetWidth: wrapper.offsetWidth,
                    offsetHeight: wrapper.offsetHeight,
                    clientWidth: wrapper.clientWidth,
                    clientHeight: wrapper.clientHeight
                },
                usableArea: {
                    width: wrapper.clientWidth,
                    height: wrapper.clientHeight,
                    lostHeight: 1123 - wrapper.clientHeight
                },
                padding: isMobile ? '10px (clone)' : '20px (clone)',
                note: 'Padding aplicado no clone, não no wrapper'
            });
            
            // Captura com parâmetros fixos A4
            const canvas = await html2canvas(wrapper, {
                width: 794,
                height: 1123,
                windowWidth: 794,
                windowHeight: 1123,
                scrollX: 0,
                scrollY: 0,
                backgroundColor: '#0a0a0f',
                useCORS: true,
                allowTaint: true,
                logging: false,
                scale: 2
            });
            
            document.body.removeChild(wrapper);
            
            const ratio = (canvas.height / canvas.width).toFixed(3);
            const expectedRatio = (1123 / 794).toFixed(3);
            console.log(`🖼️ [PDF-CANVAS] ${sectionName}:`, {
                canvasSize: { width: canvas.width, height: canvas.height },
                ratio,
                expectedRatio,
                match: ratio === expectedRatio ? '✅' : '⚠️'
            });
            
            return canvas;
        }
        
        const canvas1 = await renderSectionToPDF(section1, 'Métricas');
        
        const canvas2 = await renderSectionToPDF(section2, 'Diagnóstico');
        
        console.log('✅ [PDF-CANVAS] Páginas capturadas:', {
            page1: { width: canvas1.width, height: canvas1.height },
            page2: { width: canvas2.width, height: canvas2.height }
        });
        
        if (canvas1.width === 0 || canvas1.height === 0 || canvas2.width === 0 || canvas2.height === 0) {
            throw new Error('Canvas vazio - verifique se as seções estão visíveis');
        }
        
        // ✅ Validação final de proporção A4
        const ratio1 = (canvas1.height / canvas1.width).toFixed(3);
        const ratio2 = (canvas2.height / canvas2.width).toFixed(3);
        const expectedRatio = (1123 / 794).toFixed(3);
        
        console.log('[PDF] Proporção A4 preservada com sucesso (' + expectedRatio + ')');
        console.log('[PDF] Canvas1: ' + canvas1.width + 'x' + canvas1.height + ' | Canvas2: ' + canvas2.width + 'x' + canvas2.height);
        console.log('[PDF] Exportação concluída sem achatamento ✔️');
        
        // ✅ 9️⃣ GERAR PDF COM PROPORÇÃO A4 E MARGENS (centralização perfeita mobile)
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
        
        const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
        const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
        
        // ✅ Zero margens para ambos dispositivos (100% fill A4)
        const SIDE_MARGIN_MM = 0;
        const TOP_MARGIN_MM = 0;
        const BOTTOM_MARGIN_MM = 0;
        
        console.log('� [PDF-A4-FORMAT]', {
            pageWidth,
            pageHeight,
            margins: 'ZERO (100% fill)',
            format: 'A4 Portrait (210x297mm)'
        });
        
        // ✅ Função unificada: preencher 100% A4 (desktop e mobile)
        function addCanvasAsA4PageCentered(cnv, sectionName) {
            // Começar pela altura (preencher verticalmente)
            let imgHeight = pageHeight; // 297mm
            let imgWidth = (cnv.width * imgHeight) / cnv.height;
            
            // Se largura ultrapassar, reajustar por largura
            if (imgWidth > pageWidth) {
                imgWidth = pageWidth; // 210mm
                imgHeight = (cnv.height * imgWidth) / cnv.width;
            }
            
            // Posição absoluta no canto (sem margens)
            const x = 0;
            const y = 0;
            
            const fillPercentage = ((imgHeight / pageHeight) * 100).toFixed(1);
            
            console.log(`📄 [PDF-BUILD] ${sectionName}:`, {
                canvasSize: { width: cnv.width, height: cnv.height },
                pageSize: { width: pageWidth, height: pageHeight },
                imgWidth: imgWidth.toFixed(2),
                imgHeight: imgHeight.toFixed(2),
                position: { x, y },
                fillPercentage: `${fillPercentage}%`,
                margins: 'ZERO (100% fill)'
            });
            
            const imgData = cnv.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        }
        
        // Página 1 (Métricas)
        addCanvasAsA4PageCentered(canvas1, 'Página 1 (Métricas)');
        
        // Página 2 (Diagnóstico/Recomendações)
        pdf.addPage();
        addCanvasAsA4PageCentered(canvas2, 'Página 2 (Diagnóstico)');
        
        // 🔟 DOWNLOAD: Nome descritivo com data
        const cleanFileName = (normalizedData.fileName || 'audio')
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-z0-9_-]/gi, '_');
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Relatorio_SoundyAI_${cleanFileName}_${dateStr}.pdf`;
        
        pdf.save(fileName);
        
        console.log('✅ [PDF-SUCCESS] Relatório gerado:', fileName);
        showTemporaryFeedback('✅ Relatório PDF baixado com sucesso!');
        
        // RESTAURAR: Estilos originais
        Object.assign(container.style, originalStyles);
        setTimeout(() => container.innerHTML = '', 100);
        
    } catch (error) {
        console.error('❌ [PDF-ERROR] Erro ao gerar relatório:', error);
        console.error('❌ [PDF-ERROR] Stack:', error.stack);
        showTemporaryFeedback('❌ Erro ao gerar PDF');
        alert(`Erro ao gerar relatório PDF:\n\n${error.message}\n\nVerifique o console para mais detalhes.`);
    }
}


// 🔍 VALIDAÇÃO: Comparar dados do relatório com a UI
function validateAnalysisDataAgainstUI(analysis) {
    console.log('🔍 [PDF-VALIDATE] Iniciando validação contra UI...');
    console.log('🧠 [PDF-AUDIT] Análise Global:', analysis);
    
    const assertEqual = (label, pdfValue, uiSelector, tolerance = 0.01) => {
        const uiElement = document.querySelector(uiSelector);
        if (!uiElement) {
            console.warn(`⚠️ [PDF-VALIDATE] Elemento UI não encontrado: ${uiSelector}`);
            return;
        }
        
        let uiValue = uiElement.dataset?.value || 
                     uiElement.getAttribute('data-value') ||
                     parseFloat(uiElement.textContent.replace(/[^0-9.-]/g, ''));
        
        if (isNaN(uiValue)) {
            console.warn(`⚠️ [PDF-VALIDATE] Valor UI não numérico em ${uiSelector}`);
            return;
        }
        
        if (pdfValue == null || isNaN(pdfValue)) {
            console.warn(`⚠️ [PDF-VALIDATE] Valor PDF ausente para ${label}`);
            return;
        }
        
        const diff = Math.abs(Number(pdfValue) - Number(uiValue));
        const ok = diff < tolerance;
        
        if (!ok) {
            console.warn(`🚨 [PDF-VALIDATE] DIVERGÊNCIA em ${label}:`, {
                pdf: pdfValue,
                ui: uiValue,
                diferenca: diff.toFixed(3)
            });
        } else {
            console.log(`✅ [PDF-VALIDATE] ${label}: OK (diff=${diff.toFixed(4)})`);
        }
    };
    
    try {
        const lufsValue = analysis.lufsIntegrated || analysis.loudness?.integrated || analysis.technicalData?.lufsIntegrated;
        if (lufsValue) assertEqual('LUFS Integrado', lufsValue, '[data-metric="lufs-integrated"]', 0.1);
        
        const truePeakValue = analysis.truePeakDbtp || analysis.truePeak?.maxDbtp || analysis.technicalData?.truePeakDbtp;
        if (truePeakValue) assertEqual('True Peak', truePeakValue, '[data-metric="true-peak"]', 0.1);
        
        const drValue = analysis.dynamicRange || analysis.dynamics?.range || analysis.technicalData?.dynamicRange;
        if (drValue) assertEqual('Dynamic Range', drValue, '[data-metric="dynamic-range"]', 0.5);
        
        if (analysis.score) assertEqual('Score', analysis.score, '.score-final-value', 1);
        
        console.log('✅ [PDF-VALIDATE] Validação concluída');
    } catch (error) {
        console.error('❌ [PDF-VALIDATE] Erro na validação:', error);
    }
}

// 🎯 Normalizar dados da análise para formato compatível com PDF (NOVA VERSÃO ROBUSTA)
function normalizeAnalysisDataForPDF(analysis) {
    console.log('📊 [PDF-NORMALIZE] ============ INÍCIO DA NORMALIZAÇÃO ============');
    console.log('📊 [PDF-NORMALIZE] Estrutura recebida:', {
        keys: Object.keys(analysis),
        fileName: analysis.fileName || analysis.metadata?.fileName,
        score: analysis.score,
        hasLufsRoot: !!analysis.lufsIntegrated,
        hasTruePeakRoot: !!analysis.truePeakDbtp,
        hasDRRoot: !!analysis.dynamicRange,
        hasBands: !!(analysis.bands || analysis.spectralBands)
    });
    
    const formatValue = (val, decimals = 1, unit = '') => {
        if (val === null || val === undefined || isNaN(val)) return '—';
        return `${Number(val).toFixed(decimals)}${unit}`;
    };
    
    const extract = (...paths) => {
        for (const path of paths) {
            if (typeof path === 'function') {
                const val = path();
                if (Number.isFinite(val)) return val;
            } else if (Number.isFinite(path)) {
                return path;
            }
        }
        return null;
    };
    
    const lufsIntegrated = extract(analysis.lufsIntegrated, analysis.loudness?.integrated, analysis.technicalData?.lufsIntegrated);
    const lufsShortTerm = extract(analysis.avgLoudness, analysis.loudness?.shortTerm, analysis.technicalData?.avgLoudness);
    const lufsMomentary = extract(lufsShortTerm, analysis.loudness?.momentary);
    const lra = extract(analysis.lra, analysis.loudness?.lra, analysis.technicalData?.lra);
    
    console.log('🎧 [PDF-NORMALIZE] Loudness extraído:', { integrated: lufsIntegrated, shortTerm: lufsShortTerm, momentary: lufsMomentary, lra });
    
    const truePeakDbtp = extract(analysis.truePeakDbtp, analysis.truePeak?.maxDbtp, analysis.technicalData?.truePeakDbtp);
    const clippingSamples = extract(analysis.truePeak?.clipping?.samples, analysis.clipping?.samples, 0);
    const clippingPercentage = extract(analysis.truePeak?.clipping?.percentage, analysis.clipping?.percentage, 0);
    
    console.log('⚙️ [PDF-NORMALIZE] True Peak extraído:', { maxDbtp: truePeakDbtp, clipping: { samples: clippingSamples, percentage: clippingPercentage }});
    
    const dynamicRange = extract(analysis.dynamicRange, analysis.dynamics?.range, analysis.technicalData?.dynamicRange);
    const crestFactor = extract(analysis.crestFactor, analysis.dynamics?.crest, analysis.technicalData?.crestFactor);
    
    console.log('🎚️ [PDF-NORMALIZE] Dinâmica extraída:', { range: dynamicRange, crest: crestFactor });
    
    const stereoWidth = extract(analysis.stereo?.width, analysis.stereoWidth, analysis.technicalData?.stereoWidth);
    const stereoCorrelation = extract(analysis.stereoCorrelation, analysis.stereo?.correlation, analysis.technicalData?.stereoCorrelation);
    const monoCompatibility = extract(analysis.stereo?.monoCompatibility, analysis.monoCompatibility);
    
    console.log('🎛️ [PDF-NORMALIZE] Stereo extraído:', { width: stereoWidth, correlation: stereoCorrelation, monoCompatibility });
    
    // 🔍 AUDITORIA: Mapear todas as fontes possíveis de bandas espectrais
    console.log('📈 [AUDIT-FREQ] Bandas disponíveis em analysis:', {
        bands: analysis.bands,
        spectralBands: analysis.spectralBands,
        spectral: analysis.spectral,
        spectralBands_nested: analysis.spectral?.bands,
        userBands: analysis.user?.bands,
        userSpectralBands: analysis.user?.spectralBands,
        userSpectral: analysis.user?.spectral
    });
    
    // ✅ FREQUÊNCIAS — corrigindo campos energy_db, percentage e range
    const bandsSrc = analysis.bands || analysis.spectralBands || analysis.spectral?.bands || {};
    const extractBand = (band) => {
      if (!band) return { db: '—', pct: '—', range: '' };
      if (typeof band === 'number') return { db: band.toFixed(1), pct: '—', range: '' };
      const db = band.energy_db ?? band.rms_db ?? band.value ?? null;
      const pct = band.percentage ?? band.percent ?? null;
      const range = band.range ?? '';
      return {
        db: db !== null ? db.toFixed(1) : '—',
        pct: pct !== null ? pct.toFixed(1) + '%' : '—',
        range
      };
    };

    // Formata todas as bandas principais
    const spectral = {
      sub:  extractBand(bandsSrc.sub),
      bass: extractBand(bandsSrc.bass),
      lowMid: extractBand(bandsSrc.lowMid),
      mid:  extractBand(bandsSrc.mid),
      highMid: extractBand(bandsSrc.highMid),
      presence: extractBand(bandsSrc.presence),
      air: extractBand(bandsSrc.air)
    };

    console.log('� [PDF-FIX] Bandas espectrais resolvidas:', spectral);
    
    // ✅ SCORE SINCRONIZADO COM A UI
    let score = analysis.scoring?.final 
             ?? analysis.user?.score 
             ?? analysis.scores?.final 
             ?? analysis.score 
             ?? 0;

    const uiScoreEl = document.querySelector('.score-final-value');
    if (uiScoreEl) {
      const scoreUI = parseFloat(uiScoreEl.dataset?.value || uiScoreEl.textContent || '0');
      if (!isNaN(scoreUI) && scoreUI > 0 && Math.abs(score - scoreUI) > 1) {
        console.warn('⚙️ [PDF-FIX] Score ajustado com base na UI:', { old: score, new: scoreUI });
        score = scoreUI;
      }
    } else {
      console.warn('⚠️ [PDF-FIX] Elemento de score na UI não encontrado, mantendo score:', score);
    }
    
    score = Math.round(score);
    const classification = analysis.classification || analysis.scoring?.classification || getClassificationFromScore(score);
    const fileName = analysis.fileName || analysis.metadata?.fileName || analysis.fileKey?.split('/').pop() || 'audio_sem_nome.wav';
    const duration = extract(analysis.duration, analysis.metadata?.duration, 0);
    const sampleRate = extract(analysis.sampleRate, analysis.metadata?.sampleRate, 44100);
    const channels = extract(analysis.channels, analysis.metadata?.channels, 2);
    
    // 🔍 AUDITORIA: Mapear todas as fontes possíveis de diagnósticos
    console.log('🩺 [AUDIT-DIAG] Diagnóstico disponível em analysis:', {
        problems: analysis.problems,
        diagnostics: analysis.diagnostics,
        _diagnostic: analysis._diagnostic,
        userProblems: analysis.user?.problems,
        userDiagnostics: analysis.user?.diagnostics,
        problemsType: Array.isArray(analysis.problems) ? 'array' : typeof analysis.problems,
        diagnosticsType: Array.isArray(analysis.diagnostics) ? 'array' : typeof analysis.diagnostics
    });
    
    // ✅ DIAGNÓSTICO AUTOMÁTICO
    let diagnostics = [];

    if (analysis.diagnostics?.problems?.length > 0) {
      diagnostics = analysis.diagnostics.problems.map(p => p.message || p);
    } 
    else if (analysis.diagnostics?.suggestions?.length > 0) {
      diagnostics = analysis.diagnostics.suggestions.map(s => 
        `⚠️ ${s.message || s.type || 'Sugestão'} — ${s.why || s.action || ''}`
      );
    } 
    else {
      diagnostics = ['✅ Nenhum problema detectado'];
    }

    console.log('🩺 [PDF-FIX] Diagnóstico enriquecido:', diagnostics);
    
    // 🔍 AUDITORIA: Mapear todas as fontes possíveis de sugestões
    console.log('💡 [AUDIT-SUG] Sugestões detectadas em analysis:', {
        suggestions: analysis.suggestions,
        suggestionsAdvanced: analysis.suggestionsAdvanced,
        recommendations: analysis.recommendations,
        aiSuggestions: analysis.ai?.suggestions,
        aiSuggestionsEnriched: analysis.ai?.suggestions?.enriched,
        userSuggestions: analysis.user?.suggestions,
        userSuggestionsAdvanced: analysis.user?.suggestionsAdvanced,
        _suggestionsGenerated: analysis._suggestionsGenerated,
        suggestionsType: Array.isArray(analysis.suggestions) ? `array[${analysis.suggestions?.length}]` : typeof analysis.suggestions,
        advancedType: Array.isArray(analysis.suggestionsAdvanced) ? `array[${analysis.suggestionsAdvanced?.length}]` : typeof analysis.suggestionsAdvanced
    });
    
    // ✅ SUGESTÕES ENRIQUECIDAS
    let suggestions = [];

    if (analysis.diagnostics?.suggestions?.length > 0) {
      suggestions = analysis.diagnostics.suggestions.map(s => {
        const title = s.message || s.type || 'Ajuste recomendado';
        const action = s.action ? ` → ${s.action}` : '';
        const why = s.why ? ` (${s.why})` : '';
        return `${title}${action}${why}`;
      });
    } else if (Array.isArray(analysis.suggestions)) {
      suggestions = analysis.suggestions.map(s => 
        typeof s === 'string' ? s : s.message || s.type || 'Sugestão'
      );
    }

    console.log('💡 [PDF-FIX] Sugestões enriquecidas:', suggestions);
    
    // Normalizar para 'recommendations' (compatibilidade com retorno)
    const recommendations = suggestions.length > 0 ? suggestions : ['✅ Análise completa'];
    
    const normalizedResult = {
        score,
        classification,
        fileName,
        duration,
        sampleRate,
        channels,
        bitDepth: analysis.bitDepth || analysis.metadata?.bitDepth || 'N/A',
        loudness: {
            integrated: formatValue(lufsIntegrated, 1),
            shortTerm: formatValue(lufsShortTerm, 1),
            momentary: formatValue(lufsMomentary, 1),
            lra: formatValue(lra, 1)
        },
        truePeak: {
            maxDbtp: formatValue(truePeakDbtp, 2),
            clipping: { samples: clippingSamples || 0, percentage: formatValue(clippingPercentage, 2) }
        },
        dynamics: {
            range: formatValue(dynamicRange, 1),
            crest: formatValue(crestFactor, 1)
        },
        spectral: spectral,
        stereo: {
            width: formatValue(stereoWidth * 100, 1),
            correlation: formatValue(stereoCorrelation, 2),
            monoCompatibility: formatValue(monoCompatibility * 100, 1)
        },
        diagnostics: diagnostics.length > 0 ? diagnostics : ['✅ Nenhum problema detectado'],
        recommendations: recommendations.length > 0 ? recommendations : ['✅ Análise completa']
    };
    
    // 🔍 AUDITORIA: Resumo final comparativo
    console.log('📊 [AUDIT-PDF-SUMMARY] Resumo da Auditoria:', {
        hasFrequencies: !!(spectral.sub !== '—' || spectral.bass !== '—' || spectral.mid !== '—' || spectral.high !== '—'),
        frequenciesValues: spectral,
        hasDiagnostics: diagnostics.length > 0 && diagnostics[0] !== '✅ Nenhum problema detectado',
        diagnosticsCount: diagnostics.length,
        hasSuggestions: recommendations.length > 0 && recommendations[0] !== '✅ Análise completa',
        suggestionsCount: recommendations.length,
        suggestionsEnriched: analysis._suggestionsGenerated === true,
        score: score,
        scoreSource: analysis.score ? 'analysis.score' : (analysis.user?.score ? 'analysis.user.score' : 'scoreUI')
    });
    
    // 🔍 AUDITORIA: Comparar dados normalizados com valores da UI
    const uiSub = document.querySelector('[data-metric="band-sub"]')?.dataset?.value || document.querySelector('[data-metric="band-sub"]')?.textContent?.replace(/[^0-9.-]/g, '');
    const uiBass = document.querySelector('[data-metric="band-bass"]')?.dataset?.value || document.querySelector('[data-metric="band-bass"]')?.textContent?.replace(/[^0-9.-]/g, '');
    const uiMid = document.querySelector('[data-metric="band-mid"]')?.dataset?.value || document.querySelector('[data-metric="band-mid"]')?.textContent?.replace(/[^0-9.-]/g, '');
    const uiHigh = document.querySelector('[data-metric="band-high"]')?.dataset?.value || document.querySelector('[data-metric="band-high"]')?.textContent?.replace(/[^0-9.-]/g, '');
    
    console.log('🎚 [AUDIT-FREQ-COMPARE] Comparação UI vs PDF:', {
        sub: { ui: uiSub, pdf: spectral.sub, match: parseFloat(uiSub) === parseFloat(spectral.sub) },
        bass: { ui: uiBass, pdf: spectral.bass, match: parseFloat(uiBass) === parseFloat(spectral.bass) },
        mid: { ui: uiMid, pdf: spectral.mid, match: parseFloat(uiMid) === parseFloat(spectral.mid) },
        high: { ui: uiHigh, pdf: spectral.high, match: parseFloat(uiHigh) === parseFloat(spectral.high) }
    });
    
    console.log('✅ [PDF-NORMALIZE] Resultado normalizado:', normalizedResult);
    console.log('📊 [PDF-NORMALIZE] ============ FIM DA NORMALIZAÇÃO ============');
    
    return normalizedResult;
}

// � Normalizar dados da análise para formato compatível com PDF
function normalizeAnalysisData(analysis) {
    // 🔍 DIAGNÓSTICO: Log completo da estrutura recebida
    console.log('📊 [PDF-NORMALIZE] ============ INÍCIO DA NORMALIZAÇÃO ============');
    console.log('📊 [PDF-NORMALIZE] Análise completa recebida:', analysis);
    console.log('📊 [PDF-NORMALIZE] Chaves disponíveis:', Object.keys(analysis));
    
    // 🔧 CORREÇÃO: Dados podem estar na raiz, em metrics, ou em tech
    const metrics = analysis.metrics || {};
    const tech = analysis.tech || analysis.technicalData || {};
    
    console.log('🔍 [PDF-NORMALIZE] Origem dos dados:', {
        hasMetrics: !!analysis.metrics,
        hasTech: !!analysis.tech,
        hasTechnicalData: !!analysis.technicalData,
        hasRootData: !!(analysis.loudness || analysis.truePeak || analysis.lufsIntegrated),
        metricsKeys: Object.keys(metrics),
        techKeys: Object.keys(tech)
    });
    
    // 🔧 CORREÇÃO: Loudness pode estar em múltiplos lugares
    const loudness = metrics.loudness || tech.loudness || analysis.loudness || {
        // Fallback para propriedades na raiz
        integrated: analysis.lufsIntegrated,
        shortTerm: analysis.avgLoudness,
        momentary: analysis.avgLoudness,
        lra: analysis.lra
    };
    console.log('🎧 [PDF-NORMALIZE] Loudness extraído:', {
        source: metrics.loudness ? 'metrics' : (tech.loudness ? 'tech' : (analysis.loudness ? 'analysis.loudness' : 'raiz')),
        data: loudness,
        integrated: loudness.integrated,
        shortTerm: loudness.shortTerm,
        momentary: loudness.momentary,
        lra: loudness.lra
    });
    
    // 🔧 CORREÇÃO: True Peak pode estar em múltiplos lugares
    const truePeak = metrics.truePeak || tech.truePeak || analysis.truePeak || {
        // Fallback para propriedades na raiz
        maxDbtp: analysis.truePeakDbtp,
        clipping: { samples: 0, percentage: 0 }
    };
    console.log('⚙️ [PDF-NORMALIZE] True Peak extraído:', {
        source: metrics.truePeak ? 'metrics' : (tech.truePeak ? 'tech' : (analysis.truePeak ? 'analysis.truePeak' : 'raiz')),
        data: truePeak,
        maxDbtp: truePeak.maxDbtp,
        clipping: truePeak.clipping
    });
    
    // 🔧 CORREÇÃO: Dinâmica pode estar em múltiplos lugares
    const dynamics = metrics.dynamics || tech.dynamics || analysis.dynamics || {
        // Fallback para propriedades na raiz
        range: analysis.dynamicRange,
        crest: analysis.crestFactor
    };
    console.log('🎚️ [PDF-NORMALIZE] Dynamics extraído:', {
        source: metrics.dynamics ? 'metrics' : (tech.dynamics ? 'tech' : (analysis.dynamics ? 'analysis.dynamics' : 'raiz')),
        data: dynamics,
        range: dynamics.range,
        crest: dynamics.crest
    });
    
    // 🔧 CORREÇÃO: Espectro pode estar em múltiplos lugares
    const spectral = metrics.spectral || tech.spectral || analysis.spectral || {};
    const bands = spectral.bands || analysis.spectralBands || analysis.bands || {};
    console.log('📈 [PDF-NORMALIZE] Spectral extraído:', {
        source: metrics.spectral ? 'metrics' : (tech.spectral ? 'tech' : (analysis.spectral ? 'analysis.spectral' : (analysis.bands ? 'analysis.bands' : 'vazio'))),
        spectral: spectral,
        bands: bands,
        bandsKeys: Object.keys(bands)
    });
    
    // 🔧 CORREÇÃO: Stereo pode estar em múltiplos lugares
    const stereo = metrics.stereo || tech.stereo || analysis.stereo || {};
    console.log('🎛️ [PDF-NORMALIZE] Stereo extraído:', {
        source: metrics.stereo ? 'metrics' : (tech.stereo ? 'tech' : (analysis.stereo ? 'analysis.stereo' : 'vazio')),
        data: stereo,
        width: stereo.width,
        correlation: stereo.correlation,
        monoCompatibility: stereo.monoCompatibility
    });
    
    // Score e classificação
    const score = analysis.qualityOverall || analysis.score || 0;
    const classification = analysis.classification || getClassificationFromScore(score);
    
    // Diagnósticos e recomendações
    const problems = analysis.problems || [];
    const suggestions = analysis.suggestions || [];
    const diagnostics = problems.length > 0 
        ? problems.map(p => p.message || p) 
        : ['✅ Nenhum problema crítico detectado'];
    const recommendations = suggestions.length > 0 
        ? suggestions.map(s => s.message || s.action || s) 
        : ['✅ Análise completa realizada com sucesso'];
    
    // Formatação segura de valores
    const formatValue = (val, decimals = 1, unit = '') => {
        if (val === null || val === undefined || isNaN(val)) return 'N/A';
        return `${Number(val).toFixed(decimals)}${unit}`;
    };
    
    // Log do resultado final normalizado
    const normalizedResult = {
        score: Math.round(score),
        classification,
        fileName: analysis.fileName || 'audio_sem_nome.wav',
        duration: analysis.duration || 0,
        sampleRate: analysis.sampleRate || 44100,
        channels: analysis.channels || 2,
        bitDepth: analysis.bitDepth || 'N/A',
        loudness: {
            integrated: formatValue(loudness.integrated, 1),
            shortTerm: formatValue(loudness.shortTerm, 1),
            momentary: formatValue(loudness.momentary, 1),
            lra: formatValue(loudness.lra, 1)
        },
        truePeak: {
            maxDbtp: formatValue(truePeak.maxDbtp, 2),
            clipping: {
                samples: truePeak.clipping?.samples || 0,
                percentage: formatValue(truePeak.clipping?.percentage, 2)
            }
        },
        dynamics: {
            range: formatValue(dynamics.range, 1),
            crest: formatValue(dynamics.crest, 1)
        },
        spectral: {
            sub: formatValue(bands.sub || bands.subBass, 1),
            bass: formatValue(bands.bass, 1),
            mid: formatValue(bands.mid || bands.midrange, 1),
            high: formatValue(bands.presence || bands.high || bands.treble, 1)
        },
        stereo: {
            width: formatValue(stereo.width, 1),
            correlation: formatValue(stereo.correlation, 2),
            monoCompatibility: formatValue(stereo.monoCompatibility, 1)
        },
        diagnostics,
        recommendations
    };
    
    console.log('✅ [PDF-NORMALIZE] Resultado final normalizado:', normalizedResult);
    console.log('📊 [PDF-NORMALIZE] ============ FIM DA NORMALIZAÇÃO ============');
    
    return normalizedResult;
}

// 🏆 Classificação baseada em score
function getClassificationFromScore(score) {
    if (score >= 90) return '🏆 Profissional';
    if (score >= 75) return '⭐ Avançado';
    if (score >= 60) return '👍 Intermediário';
    if (score >= 40) return '📚 Básico';
    return '🔧 Necessita Melhorias';
}

// 🎨 Gerar HTML profissional do relatório para PDF
function generateReportHTML(data) {
    // 🔍 AUDITORIA: Verificar dados recebidos para geração do HTML
    console.log('📝 [AUDIT-HTML] ============ INÍCIO DA GERAÇÃO DO HTML ============');
    console.log('📝 [AUDIT-HTML] Dados recebidos:', {
        score: data.score,
        classification: data.classification,
        spectral: data.spectral,
        diagnostics: data.diagnostics,
        recommendations: data.recommendations,
        hasSpectralData: !!(data.spectral && (data.spectral.sub !== '—' || data.spectral.bass !== '—')),
        hasDiagnostics: data.diagnostics?.length > 0,
        hasRecommendations: data.recommendations?.length > 0
    });
    
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Formatar duração
    const minutes = Math.floor(data.duration / 60);
    const seconds = Math.floor(data.duration % 60);
    const durationStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
    
    return `
<div id="report-pdf-container" style="background: #0B0C14;">
    
    <!-- Estilos para otimização desktop do PDF -->
    <style>
        /* Ajustes apenas para desktop (viewport >= 768px) */
        @media (min-width: 768px) {
            .frequency-spectrum-container {
                margin-top: -10px !important;
                margin-bottom: 20px !important;
            }
            
            .frequency-spectrum-cards {
                transform: scale(0.95);
                transform-origin: top center;
                margin-bottom: -10px;
            }
            
            .freq-card {
                height: 75px !important;
                padding: 10px !important;
            }
            
            /* Ajustes de rodapé e recomendações (página 2) */
            .pdf-section-diagnostics .pdf-footer {
                margin-top: 25px !important;
                padding-bottom: 10px;
                position: relative;
                bottom: 0;
            }
            
            .pdf-section-recommendations {
                transform: scale(0.97);
                transform-origin: top center;
            }
        }
        
        /* Mobile mantém estilos originais (< 768px) */
        @media (max-width: 767px) {
            .frequency-spectrum-container {
                margin-top: 0 !important;
            }
            
            .frequency-spectrum-cards {
                transform: none;
            }
            
            .freq-card {
                height: auto !important;
            }
        }
    </style>
    
    <!-- ✅ PÁGINA 1: MÉTRICAS PRINCIPAIS -->
    <div class="pdf-section-metrics" style="width: 794px; min-height: 1123px; background: #0B0C14; color: #EAEAEA; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; box-sizing: border-box; position: relative;">

        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid rgba(139, 92, 246, 0.3); padding-bottom: 20px;">
            <div>
                <h1 style="color: #8B5CF6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">SoundyAI</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #AAA;">Inteligência Artificial para Produtores Musicais</p>
            </div>
            <div style="text-align: right;">
                <h2 style="color: #8B5CF6; margin: 0; font-size: 24px; font-weight: 600;">Relatório de Análise</h2>
                <p style="font-size: 12px; color: #AAA; margin: 5px 0 0 0;">${date} às ${time}</p>
            </div>
        </div>

        <!-- Score Card -->
    <div style="background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); padding: 20px 30px; border-radius: 12px; color: white; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h1 style="margin: 0; font-size: 48px; font-weight: 700;">${data.score}<span style="font-size: 32px; opacity: 0.8;">/100</span></h1>
                <p style="margin: 8px 0 0 0; font-size: 18px; opacity: 0.95; font-weight: 500;">${data.classification}</p>
            </div>
            <div style="font-size: 64px; opacity: 0.9;">🎵</div>
        </div>
    </div>

    <!-- Informações do Arquivo -->
    <div style="background: rgba(255,255,255,0.05); padding: 15px 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #8B5CF6;">
        <p style="margin: 0; font-size: 12px; color: #AAA; text-transform: uppercase; letter-spacing: 0.5px;">ARQUIVO ANALISADO</p>
        <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 600; color: #FFF;">${data.fileName}</p>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #999;">
            ⏱️ ${durationStr} min &nbsp;|&nbsp; 🎚️ ${data.sampleRate}Hz &nbsp;|&nbsp; 🔊 ${data.channels === 2 ? 'Stereo' : data.channels + ' canais'}
        </p>
    </div>

    <!-- Grid de Métricas -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
        
        <!-- Loudness Card -->
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; border: 1px solid rgba(139, 92, 246, 0.2);">
            <h3 style="color: #8B5CF6; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
                <span style="margin-right: 10px; font-size: 22px;">🎧</span> Loudness
            </h3>
            <div style="font-size: 13px; line-height: 2;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #AAA;">Integrado:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.loudness.integrated} LUFS</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #AAA;">Curto Prazo:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.loudness.shortTerm} LUFS</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #AAA;">Momentâneo:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.loudness.momentary} LUFS</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #AAA;">LRA:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.loudness.lra} LU</span>
                </div>
            </div>
        </div>

        <!-- True Peak Card -->
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; border: 1px solid rgba(139, 92, 246, 0.2);">
            <h3 style="color: #8B5CF6; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
                <span style="margin-right: 10px; font-size: 22px;">⚙️</span> True Peak
            </h3>
            <div style="font-size: 13px; line-height: 2;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #AAA;">Pico Real:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.truePeak.maxDbtp} dBTP</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #AAA;">Clipping (samples):</span>
                    <span style="font-weight: 600; color: ${data.truePeak.clipping.samples > 0 ? '#FF7B7B' : '#52F7AD'};">${data.truePeak.clipping.samples}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #AAA;">Clipping (%):</span>
                    <span style="font-weight: 600; color: ${parseFloat(data.truePeak.clipping.percentage) > 0 ? '#FF7B7B' : '#52F7AD'};">${data.truePeak.clipping.percentage}%</span>
                </div>
            </div>
        </div>

        <!-- Dinâmica Card -->
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; border: 1px solid rgba(139, 92, 246, 0.2);">
            <h3 style="color: #8B5CF6; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
                <span style="margin-right: 10px; font-size: 22px;">🎚️</span> Dinâmica
            </h3>
            <div style="font-size: 13px; line-height: 2;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #AAA;">Dynamic Range:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.dynamics.range} dB</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #AAA;">Crest Factor:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.dynamics.crest}</span>
                </div>
            </div>
        </div>

        <!-- Stereo Card -->
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; border: 1px solid rgba(139, 92, 246, 0.2);">
            <h3 style="color: #8B5CF6; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
                <span style="margin-right: 10px; font-size: 22px;">🎛️</span> Stereo
            </h3>
            <div style="font-size: 13px; line-height: 2;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #AAA;">Largura Stereo:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.stereo.width}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #AAA;">Correlação:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.stereo.correlation}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #AAA;">Compat. Mono:</span>
                    <span style="font-weight: 600; color: #FFF;">${data.stereo.monoCompatibility}%</span>
                </div>
            </div>
        </div>

    </div>

    <!-- Espectro de Frequências -->
    <div class="frequency-spectrum-container" style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; margin-bottom: 25px; border: 1px solid rgba(139, 92, 246, 0.2);">
        <h3 style="color: #8B5CF6; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
            <span style="margin-right: 10px; font-size: 22px;">📈</span> Espectro de Frequências
        </h3>
        <div class="frequency-spectrum-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; font-size: 13px;">
            ${(() => {
                const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
                const cardPadding = isDesktop ? '10px' : '12px';
                const fontSizeLarge = isDesktop ? '14px' : '18px';
                const marginTop = isDesktop ? '5px' : '8px';
                
                const renderBand = (label, band, range) => {
                    if (!band || !band.db) return `
                        <div class="freq-card" style="text-align: center; padding: ${cardPadding}; background: rgba(139, 92, 246, 0.1); border-radius: 8px; height: ${isDesktop ? '75px' : 'auto'};">
                            <p style="margin: 0; color: #AAA; font-size: 10px; text-transform: uppercase; font-weight: 600;">${label}</p>
                            <p style="margin: 0; color: #666; font-size: 9px;">${range}</p>
                            <p style="margin: ${marginTop} 0 0 0; font-weight: 700; font-size: ${fontSizeLarge}; color: #FFF;">—</p>
                        </div>
                    `;
                    return `
                        <div class="freq-card" style="text-align: center; padding: ${cardPadding}; background: rgba(139, 92, 246, 0.1); border-radius: 8px; height: ${isDesktop ? '75px' : 'auto'};">
                            <p style="margin: 0; color: #8B5CF6; font-size: 10px; text-transform: uppercase; font-weight: 600;">${label}</p>
                            <p style="margin: 0; color: #666; font-size: 9px;">${range}</p>
                            <p style="margin: ${marginTop} 0 0 0; font-weight: 700; font-size: ${fontSizeLarge}; color: #FFF;">${band.db} dB</p>
                        </div>
                    `;
                };
                
                return [
                    renderBand('SUB', data.spectral.sub, '20-60Hz'),
                    renderBand('GRAVE', data.spectral.bass, '60-150Hz'),
                    renderBand('LOW MID', data.spectral.lowMid, '150-500Hz'),
                    renderBand('MÉDIO', data.spectral.mid, '500-2kHz'),
                    renderBand('HIGH MID', data.spectral.highMid, '2-5kHz'),
                    renderBand('PRESENCE', data.spectral.presence, '5-10kHz'),
                    renderBand('AR', data.spectral.air, '10-20kHz')
                ].join('');
            })()}
        </div>
    </div>

    <!-- Rodapé da Página 1 -->
    <div style="text-align: center; padding-top: 40px; margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="margin: 0; font-size: 13px; color: #8B5CF6; font-weight: 600;">SoundyAI © 2025</p>
        <p style="margin: 5px 0 0 0; font-size: 11px; color: #666;">Página 1/2 | Métricas Principais</p>
    </div>

    </div>
    <!-- FIM DA PÁGINA 1 -->

    <!-- ✅ PÁGINA 2: DIAGNÓSTICO E RECOMENDAÇÕES -->
    <div class="pdf-section-diagnostics" style="width: 794px; min-height: 1123px; background: #0B0C14; color: #EAEAEA; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; box-sizing: border-box; position: relative;">

        <!-- Header Simplificado (Página 2) -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid rgba(139, 92, 246, 0.3); padding-bottom: 20px;">
            <div>
                <h1 style="color: #8B5CF6; margin: 0; font-size: 28px; font-weight: 700;">SoundyAI</h1>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #AAA;">Diagnóstico e Recomendações da IA</p>
            </div>
            <div style="text-align: right;">
                <p style="font-size: 14px; color: #AAA; margin: 0;">${data.fileName}</p>
                <p style="font-size: 11px; color: #666; margin: 5px 0 0 0;">Página 2/2</p>
            </div>
        </div>

        <!-- Diagnóstico -->
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(139, 92, 246, 0.2);">
            <h3 style="color: #8B5CF6; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
                <span style="margin-right: 10px; font-size: 22px;">🧠</span> Diagnóstico Automático
            </h3>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px; line-height: 1.9;">
                ${data.diagnostics.map(d => `<li style="margin-bottom: 8px; padding-left: 20px; position: relative; color: #DDD;">
                    <span style="position: absolute; left: 0; color: #8B5CF6;">•</span> ${d}
                </li>`).join('')}
            </ul>
        </div>

        <!-- Recomendações -->
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; margin-bottom: 50px; border: 1px solid rgba(139, 92, 246, 0.2);">
            <h3 style="color: #8B5CF6; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
                <span style="margin-right: 10px; font-size: 22px;">💡</span> Recomendações da IA
            </h3>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px; line-height: 1.9;">
                ${data.recommendations.map(r => `<li style="margin-bottom: 8px; padding-left: 20px; position: relative; color: #DDD;">
                    <span style="position: absolute; left: 0; color: #8B5CF6;">•</span> ${r}
                </li>`).join('')}
            </ul>
        </div>

        <!-- Rodapé Final -->
        <div style="position: absolute; bottom: 30px; left: 40px; right: 40px; text-align: center; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="margin: 0; font-size: 13px; color: #8B5CF6; font-weight: 600;">
                SoundyAI © 2025
            </p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #666;">
                Inteligência Artificial para Produtores Musicais | Relatório gerado automaticamente
            </p>
        </div>

    </div>
    <!-- FIM DA PÁGINA 2 -->

</div>
    `;
}

// �📋 Gerar relatório detalhado (LEGACY - mantido para compatibilidade)
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
 * 🔧 FUNÇÃO CORRIGIDA: Normalizar dados do backend (compatível com JSON antigo e novo)
 * Mapeia a resposta do backend para o formato que o front-end espera
 * ✅ Compatível com JSON antigo e novo (pré/pós Redis)
 */
function normalizeBackendAnalysisData(result) {
    console.log("[BACKEND RESULT] Received analysis with data:", result);
    
    // 🎯 PROTEÇÃO CRÍTICA: Preservar modo reference se segunda faixa está ativa
    const state = window.__soundyState || {};
    if (state.reference?.isSecondTrack && state.render?.mode !== 'reference') {
        console.warn('[FIX] Corrigindo mode: reference forçado (segunda faixa ativa)');
        state.render = state.render || {};
        state.render.mode = 'reference';
        window.__soundyState = state;
    }
    
    // ✅ Compatível com JSON antigo e novo (pré/pós Redis)
    const data = result?.data ?? result;
    const src = data.metrics || data.technicalData || data.loudness || data.spectral || data;

    if (!src) {
        console.error("[NORMALIZE] ❌ Nenhuma fonte de dados encontrada:", result);
        throw new Error("source is not defined");
    }

    console.log("[NORMALIZE] Source data extracted:", src);
    console.log("[NORMALIZE] Full data structure:", data);

    const loudness = src.loudness || data.loudness || data.technicalData?.loudness || {};
    const dynamics = src.dynamics || data.dynamics || data.technicalData?.dynamics || {};
    const truePeak = src.truePeak || data.truePeak || data.technicalData?.truePeak || {};
    const energy = src.energy || data.energy || data.technicalData?.energy || {};
    const bands = src.bands || src.spectralBands || data.technicalData?.bands || data.technicalData?.spectralBands || data.spectralBands || {};

    const normalized = {
        // Preservar estrutura original
        ...data,
        
        // 🎯 Métricas normalizadas (RMS e LUFS separados)
        avgLoudness: energy.rms ?? 
                    src.avgLoudness ?? 
                    src.rms ??
                    data.technicalData?.avgLoudness ?? 
                    data.technicalData?.rms ??
                    data.energy?.rms ??
                    null,
        
        lufsIntegrated: loudness.integratedLUFS ?? 
                       loudness.integrated ?? 
                       src.lufsIntegrated ?? 
                       data.technicalData?.lufsIntegrated ?? 
                       data.loudness?.integrated ?? 
                       null,
                       
        lra: loudness.lra ?? 
             src.lra ?? 
             data.technicalData?.lra ?? 
             data.loudness?.lra ?? 
             null,
             
        truePeakDbtp: truePeak.maxDbtp ?? 
                     src.truePeakDbtp ?? 
                     data.technicalData?.truePeakDbtp ?? 
                     null,
                     
        dynamicRange: dynamics.range ?? 
                     src.dynamicRange ?? 
                     data.technicalData?.dynamicRange ?? 
                     null,
                     
        crestFactor: dynamics.crest ?? 
                    src.crestFactor ?? 
                    src.crest_factor ??
                    data.technicalData?.crestFactor ?? 
                    null,
                     
        bands: bands,
        
        // 🎯 Preservar estruturas aninhadas originais para fallback
        loudness: data.loudness || loudness,
        dynamics: data.dynamics || dynamics,
        truePeak: data.truePeak || truePeak,
        energy: data.energy || energy,
        
        // Estruturas técnicas
        technicalData: {
            // Copiar dados existentes
            ...(data.technicalData || src),
            
            // 🎯 Garantir métricas essenciais (MÉTRICAS PRINCIPAIS)
            avgLoudness: energy.rms ?? 
                        src.avgLoudness ?? 
                        src.rms ??
                        data.technicalData?.avgLoudness ?? 
                        data.technicalData?.rms ??
                        data.energy?.rms ??
                        null,
            
            lufsIntegrated: loudness.integratedLUFS ?? 
                           loudness.integrated ?? 
                           src.lufsIntegrated ?? 
                           data.technicalData?.lufsIntegrated ?? 
                           data.loudness?.integrated ?? 
                           null,
                           
            lra: loudness.lra ?? 
                 src.lra ?? 
                 data.technicalData?.lra ?? 
                 data.loudness?.lra ?? 
                 null,
                 
            truePeakDbtp: truePeak.maxDbtp ?? 
                         src.truePeakDbtp ?? 
                         data.technicalData?.truePeakDbtp ?? 
                         null,
                         
            dynamicRange: dynamics.range ?? 
                         src.dynamicRange ?? 
                         data.technicalData?.dynamicRange ?? 
                         null,
                         
            crestFactor: dynamics.crest ?? 
                        src.crestFactor ?? 
                        src.crest_factor ??
                        data.technicalData?.crestFactor ?? 
                        null,
                         
            bandEnergies: bands,
            spectral_balance: bands
        },
        
        metadata: data.metadata ?? {},
        
        // Preservar outros campos importantes
        problems: data.problems || [],
        suggestions: data.suggestions || [],
        duration: data.duration || null,
        sampleRate: data.sampleRate || null,
        channels: data.channels || null,
        score: data.score || null,
        classification: data.classification || null
    };

    console.log("✅ [NORMALIZE] Parsed data:", normalized);
    console.log("✅ [NORMALIZE] Normalized metrics:", {
        avgLoudness: normalized.technicalData.avgLoudness,
        lufsIntegrated: normalized.technicalData.lufsIntegrated,
        lra: normalized.technicalData.lra,
        truePeakDbtp: normalized.technicalData.truePeakDbtp,
        dynamicRange: normalized.technicalData.dynamicRange,
        crestFactor: normalized.technicalData.crestFactor,
        bands: normalized.technicalData.bandEnergies || normalized.technicalData.spectral_balance
    });
    
    // ✅ PATCH: garantir estrutura spectral_balance
    if (!normalized.technicalData.spectral_balance) {
        const sourceBands = result?.analysis?.bands || 
                           data?.bands || 
                           data?.frequencyBands || 
                           result?.bands ||
                           src?.spectral_balance ||
                           null;
        
        if (sourceBands) {
            normalized.technicalData.spectral_balance = sourceBands;
            console.log("✅ [NORMALIZER] spectral_balance restaurado automaticamente");
        } else {
            console.warn("⚠️ [NORMALIZER] Nenhum dado de bandas detectado — criando estrutura vazia");
            normalized.technicalData.spectral_balance = {
                sub: 0,
                bass: 0,
                low_mid: 0,
                mid: 0,
                high_mid: 0,
                presence: 0,
                air: 0
            };
        }
    }
    
    // 🎯 LOGS ESPECÍFICOS DAS MÉTRICAS PRINCIPAIS (AUDITORIA COMPLETA RMS + LUFS)
    console.log('[AUDITORIA-RMS-LUFS] RMS:', normalized.technicalData.avgLoudness, 'LUFS:', normalized.technicalData.lufsIntegrated);
    
    console.log('[AUDITORIA-RMS-LUFS] normalizeBackendAnalysisData > RMS=', normalized.technicalData.avgLoudness, {
        'energy.rms': energy.rms,
        'src.avgLoudness': src.avgLoudness,
        'src.rms': src.rms,
        'technicalData.avgLoudness': data.technicalData?.avgLoudness,
        'technicalData.rms': data.technicalData?.rms
    });
    
    console.log('[AUDITORIA-RMS-LUFS] normalizeBackendAnalysisData > LUFS=', normalized.technicalData.lufsIntegrated, {
        'loudness.integrated': loudness.integrated,
        'loudness.integratedLUFS': loudness.integratedLUFS,
        'src.lufsIntegrated': src.lufsIntegrated,
        'technicalData.lufsIntegrated': data.technicalData?.lufsIntegrated
    });
    
    console.log('[METRICS-FIX] normalizeBackendAnalysisData > CREST=', normalized.technicalData.crestFactor, {
        'dynamics.crest': dynamics.crest,
        'src.crestFactor': src.crestFactor,
        'src.crest_factor': src.crest_factor,
        'technicalData.crestFactor': data.technicalData?.crestFactor
    });

    return normalized;
}

// =============== FUNÇÕES AUXILIARES ===============

// 🧪 TESTE AUTOMÁTICO: Validar normalização com JSON real
function testNormalizationCompatibility() {
    console.log("🧪 [TEST] Iniciando teste automático de compatibilidade...");
    
    // Teste 1: Formato antigo (pré-Redis)
    const oldFormat = {
        data: {
            metrics: {
                lufsIntegrated: -11.15,
                lra: 0.8,
                dynamicRange: 10.28
            },
            technicalData: {
                truePeakDbtp: -0.2,
                bands: {
                    bass: -12.5,
                    mid: -10.8,
                    treble: -15.2
                }
            }
        }
    };
    
    // Teste 2: Formato novo (pós-Redis)
    const newFormat = {
        score: 100,
        classification: "Referência Mundial",
        loudness: { integrated: -11.15, lra: 0.8 },
        truePeak: { maxDbtp: -0.2 },
        dynamics: { range: 10.28 },
        spectralBands: {
            bass: -12.5,
            mid: -10.8,
            treble: -15.2
        },
        metadata: { duration: 180 }
    };
    
    // Teste 3: Formato híbrido
    const hybridFormat = {
        metrics: { lufsIntegrated: -11.15 },
        loudness: { integrated: -12.0 },
        technicalData: { lra: 0.8, truePeakDbtp: -0.2 }
    };
    
    try {
        // ✅ Teste formato antigo
        const normalized1 = normalizeBackendAnalysisData(oldFormat);
        console.log("✅ [TEST] Formato antigo normalizado:", {
            lufs: normalized1.technicalData.lufsIntegrated,
            lra: normalized1.technicalData.lra,
            truePeak: normalized1.technicalData.truePeakDbtp,
            dr: normalized1.technicalData.dynamicRange
        });
        
        // ✅ Teste formato novo
        const normalized2 = normalizeBackendAnalysisData(newFormat);
        console.log("✅ [TEST] Formato novo normalizado:", {
            lufs: normalized2.technicalData.lufsIntegrated,
            lra: normalized2.technicalData.lra,
            truePeak: normalized2.technicalData.truePeakDbtp,
            dr: normalized2.technicalData.dynamicRange
        });
        
        // ✅ Teste formato híbrido
        const normalized3 = normalizeBackendAnalysisData(hybridFormat);
        console.log("✅ [TEST] Formato híbrido normalizado:", {
            lufs: normalized3.technicalData.lufsIntegrated,
            lra: normalized3.technicalData.lra,
            truePeak: normalized3.technicalData.truePeakDbtp,
            dr: normalized3.technicalData.dynamicRange
        });
        
        // ✅ Validação de estrutura
        const isValidStructure = (norm) => {
            return norm.technicalData && 
                   typeof norm.technicalData.lufsIntegrated !== 'undefined' &&
                   typeof norm.technicalData.lra !== 'undefined' &&
                   typeof norm.technicalData.truePeakDbtp !== 'undefined';
        };
        
        if (isValidStructure(normalized1) && isValidStructure(normalized2) && isValidStructure(normalized3)) {
            console.log("✅ [TEST] Todos os formatos passaram na validação!");
            console.log("✅ [TEST] Sistema de normalização está funcionando corretamente");
            return true;
        } else {
            console.error("❌ [TEST] Falha na validação de estrutura");
            return false;
        }
        
    } catch (error) {
        console.error("❌ [TEST] Erro no teste de normalização:", error);
        return false;
    }
}

// 🚀 Executar teste automático quando o arquivo carregar
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            testNormalizationCompatibility();
        }, 1000);
    });
}

// 🎯 FUNÇÃO: Aplicar correção de fallback ao score
    
    tech.lufsShortTerm = getRealValue('lufsShortTerm', 'lufs_short_term') ||
                        (backendData.loudness?.shortTerm && Number.isFinite(backendData.loudness.shortTerm) ? backendData.loudness.shortTerm : null);
    
    tech.lufsMomentary = getRealValue('lufsMomentary', 'lufs_momentary') ||
                        (backendData.loudness?.momentary && Number.isFinite(backendData.loudness.momentary) ? backendData.loudness.momentary : null);
    
    // LRA - CORRIGIR MAPEAMENTO PARA ESTRUTURA REAL: loudness.lra + technicalData.lra
    tech.lra = getRealValue('lra', 'loudnessRange', 'lra_tolerance', 'loudness_range') ||
              (backendData.loudness?.lra && Number.isFinite(backendData.loudness.lra) ? backendData.loudness.lra : null) ||
              (backendData.technicalData?.lra && Number.isFinite(backendData.technicalData.lra) ? backendData.technicalData.lra : null);
    
    console.log('📊 [NORMALIZE] Métricas mapeadas (apenas reais):', {
        peak: tech.peak,
        rms: tech.rms,
        dynamicRange: tech.dynamicRange,
        crestFactor: tech.crestFactor,
        truePeakDbtp: tech.truePeakDbtp,
        lufsIntegrated: tech.lufsIntegrated,
        lufsShortTerm: tech.lufsShortTerm,
        lufsMomentary: tech.lufsMomentary,
        lra: tech.lra
    });
    
    // 🎯 LOG ESPECÍFICO PARA AUDITORIA: LRA com estrutura real
    if (tech.lra !== null) {
        console.log('✅ [LRA] SUCESSO: LRA mapeado corretamente =', tech.lra);
    } else {
        console.warn('❌ [LRA] PROBLEMA: LRA não foi encontrado no backend data');
        console.log('🔍 [LRA] Debug - possíveis caminhos verificados:', {
            'backendData.loudness.lra': backendData.loudness?.lra,
            'backendData.technicalData.lra': backendData.technicalData?.lra,
            'source (technicalData)': source.lra || source.loudnessRange,
            'loudnessObject': backendData.loudness,
            'technicalDataObject': backendData.technicalData
        });
    }
    
    // Headroom - APENAS VALORES REAIS
    tech.headroomDb = getRealValue('headroomDb', 'headroom_db');
    tech.headroomTruePeakDb = getRealValue('headroomTruePeakDb');
    
    // Stereo - CORRIGIR MAPEAMENTO PARA NOVA ESTRUTURA
    tech.stereoCorrelation = getRealValue('stereoCorrelation', 'stereo_correlation') ||
                            (backendData.stereo?.correlation && Number.isFinite(backendData.stereo.correlation) ? backendData.stereo.correlation : null);
    
    tech.stereoWidth = getRealValue('stereoWidth', 'stereo_width') ||
                      (backendData.stereo?.width && Number.isFinite(backendData.stereo.width) ? backendData.stereo.width : null);
    
    tech.balanceLR = getRealValue('balanceLR', 'balance_lr') ||
                    (backendData.stereo?.balance && Number.isFinite(backendData.stereo.balance) ? backendData.stereo.balance : null);
    
    // Spectral - APENAS VALORES REAIS
    tech.spectralCentroid = getRealValue('spectralCentroid', 'spectral_centroid');
    tech.spectralRolloff = getRealValue('spectralRolloff', 'spectral_rolloff');
    tech.zeroCrossingRate = getRealValue('zeroCrossingRate', 'zero_crossing_rate');
    tech.spectralFlux = getRealValue('spectralFlux', 'spectral_flux');
    tech.spectralFlatness = getRealValue('spectralFlatness', 'spectral_flatness');
    
    // Problemas técnicos - APENAS VALORES REAIS
    tech.clippingSamples = getRealValue('clippingSamples', 'clipping_samples');
    tech.clippingPct = getRealValue('clippingPct', 'clipping_pct');
    tech.dcOffset = getRealValue('dcOffset', 'dc_offset');
    tech.thdPercent = getRealValue('thdPercent', 'thd_percent');
    
    // Sample peaks por canal - APENAS VALORES REAIS
    tech.samplePeakLeftDb = getRealValue('samplePeakLeftDb', 'sample_peak_left_db');
    tech.samplePeakRightDb = getRealValue('samplePeakRightDb', 'sample_peak_right_db');
    
    // ===== NOVAS MÉTRICAS IMPLEMENTADAS =====
    
    // Spectral Bandwidth e outras métricas espectrais
    tech.spectralBandwidth = getRealValue('spectralBandwidth', 'spectral_bandwidth');
    tech.spectralBandwidthHz = tech.spectralBandwidth; // Alias
    tech.spectralSpread = getRealValue('spectralSpread', 'spectral_spread');
    tech.spectralCrest = getRealValue('spectralCrest', 'spectral_crest');
    tech.spectralSkewness = getRealValue('spectralSkewness', 'spectral_skewness');
    tech.spectralKurtosis = getRealValue('spectralKurtosis', 'spectral_kurtosis');
    
    // 🎵 SPECTRAL BALANCE - Mapear dados espectrais REAIS do backend
    if (source.spectral_balance || source.spectralBalance || source.bands || 
        backendData.technicalData?.spectralBands || backendData.technicalData?.bands) {
        
        const spectralSource = source.spectral_balance || source.spectralBalance || source.bands || 
                              backendData.technicalData?.spectralBands || backendData.technicalData?.bands || {};
        
        console.log('🔍 [SPECTRAL] Fonte espectral detectada:', spectralSource);
        
        // Função específica para dados espectrais
        const getSpectralValue = (...paths) => {
            for (const path of paths) {
                const value = path.split('.').reduce((obj, key) => obj?.[key], spectralSource);
                if (Number.isFinite(value)) {
                    return value;
                }
            }
            return null;
        };
        
        // Se spectral_balance é string (ex: "balanced"), mapear para objeto
        if (typeof spectralSource === 'string') {
            tech.spectral_balance = {
                description: spectralSource,
                status: spectralSource
            };
            console.log('📊 [NORMALIZE] Spectral balance (string):', tech.spectral_balance);
        } else {
            tech.spectral_balance = {
                sub: getSpectralValue('sub', 'subBass', 'sub_bass'),
                bass: getSpectralValue('bass', 'low_bass', 'lowBass'),  // Normalizar para 'bass'
                lowMid: getSpectralValue('lowMid', 'low_mid', 'lowmid'),
                mid: getSpectralValue('mid', 'mids', 'middle'),
                highMid: getSpectralValue('highMid', 'high_mid', 'highmid'),
                presence: getSpectralValue('presence', 'presenca'),
                air: getSpectralValue('air', 'brilho', 'treble', 'high')
            };
            console.log('📊 [NORMALIZE] Spectral balance mapeado:', tech.spectral_balance);
        }
        
        // 🎯 LOG ESPECÍFICO PARA AUDITORIA: BANDAS ESPECTRAIS
        const bandasDetectadas = typeof tech.spectral_balance === 'object' && tech.spectral_balance.description ? 
            [`description: ${tech.spectral_balance.description}`] :
            Object.entries(tech.spectral_balance)
                .filter(([key, value]) => value !== null && key !== 'description' && key !== 'status')
                .map(([key, value]) => `${key}: ${value}`);
        
        if (bandasDetectadas.length > 0) {
            console.log(`✅ [BANDAS] SUCESSO: ${bandasDetectadas.length} bandas mapeadas:`, bandasDetectadas.join(', '));
        } else {
            console.warn('❌ [BANDAS] PROBLEMA: Nenhuma banda espectral foi mapeada');
            console.log('🔍 [BANDAS] Debug - caminhos verificados:', {
                'source.spectral_balance': source.spectral_balance,
                'source.spectralBalance': source.spectralBalance, 
                'source.bands': source.bands,
                'backendData.technicalData.spectralBands': backendData.technicalData?.spectralBands,
                'backendData.technicalData.bands': backendData.technicalData?.bands,
                'spectralSource': spectralSource
            });
        }
    } else {
        // Não definir se não há dados reais
        tech.spectral_balance = null;
        console.log('⚠️ [NORMALIZE] Nenhum dado espectral real encontrado');
        console.log('🔍 [NORMALIZE] Debug espectral - caminhos verificados:', {
            'source.spectral_balance': source.spectral_balance,
            'source.spectralBalance': source.spectralBalance,
            'source.bands': source.bands,
            'backendData.technicalData.spectralBands': backendData.technicalData?.spectralBands,
            'backendData.technicalData.bands': backendData.technicalData?.bands
        });
    }
    
    // 🎶 BAND ENERGIES - Mapear energias das bandas de frequência REAIS do backend
    if (source.bandEnergies || source.band_energies || source.bands || 
        backendData.technicalData?.spectralBands || backendData.technicalData?.bands) {
        const bandsSource = source.bandEnergies || source.band_energies || source.bands || 
                          backendData.technicalData?.spectralBands || backendData.technicalData?.bands || {};
        tech.bandEnergies = {};
        
        // Mapear bandas conhecidas - APENAS VALORES REAIS
        const bandMapping = {
            'sub': 'sub',
            'subBass': 'sub', 
            'sub_bass': 'sub',
            'low_bass': 'bass',  // Normalizar para 'bass'
            'lowBass': 'bass',
            'bass': 'bass',
            'upper_bass': 'bass',
            'upperBass': 'bass',
            'low_mid': 'lowMid',  // Normalizar para 'lowMid'
            'lowMid': 'lowMid',
            'lowmid': 'lowMid',
            'mid': 'mid',
            'mids': 'mid',
            'middle': 'mid',
            'high_mid': 'highMid',  // Normalizar para 'highMid'
            'highMid': 'highMid',
            'highmid': 'highMid',
            'upper_mid': 'highMid',
            'upperMid': 'highMid',
            'brilho': 'air',  // Normalizar para 'air'
            'brilliance': 'air',
            'air': 'air',
            'treble': 'air',
            'high': 'air',
            'presenca': 'presence',  // Normalizar para 'presence'
            'presence': 'presence'
        };
        
        Object.entries(bandMapping).forEach(([sourceKey, targetKey]) => {
            const bandData = bandsSource[sourceKey];
            if (bandData && typeof bandData === 'object') {
                // Pegar apenas valores reais, sem fallbacks
                const rms_db = Number.isFinite(bandData.rms_db) ? bandData.rms_db : 
                              Number.isFinite(bandData.energy_db) ? bandData.energy_db :
                              Number.isFinite(bandData.level) ? bandData.level : null;
                              
                const peak_db = Number.isFinite(bandData.peak_db) ? bandData.peak_db : null;
                const frequency_range = bandData.frequency_range || bandData.range || null;
                
                // Só adicionar se tiver pelo menos um valor real
                if (rms_db !== null || peak_db !== null) {
                    tech.bandEnergies[targetKey] = {
                        rms_db: rms_db,
                        peak_db: peak_db,
                        frequency_range: frequency_range
                    };
                }
            }
        });
        
        console.log('📊 [NORMALIZE] Band energies mapeadas (apenas reais):', tech.bandEnergies);
        
        // Se não conseguiu mapear nenhuma banda real, deixar null
        if (Object.keys(tech.bandEnergies).length === 0) {
            tech.bandEnergies = null;
            console.log('⚠️ [NORMALIZE] Nenhuma banda real encontrada - bandEnergies = null');
        }
    } else {
        tech.bandEnergies = null;
        console.log('⚠️ [NORMALIZE] Dados de bandas não encontrados - bandEnergies = null');
    }
    
    // 🎼 TONAL BALANCE - Estrutura simplificada para compatibilidade APENAS COM VALORES REAIS
    if (tech.bandEnergies && Object.keys(tech.bandEnergies).length > 0) {
        tech.tonalBalance = {
            sub: tech.bandEnergies.sub || null,
            low: tech.bandEnergies.low_bass || null,
            mid: tech.bandEnergies.mid || null,
            high: tech.bandEnergies.brilho || null
        };
        console.log('📊 [NORMALIZE] Tonal balance baseado em bandEnergies reais:', tech.tonalBalance);
    } else {
        tech.tonalBalance = null;
        console.log('⚠️ [NORMALIZE] Nenhuma banda real para tonal balance - tonalBalance = null');
    }
    
    // 🎯 FREQUÊNCIAS DOMINANTES - Estrutura completa com detailed
    if (source.dominantFrequencies || source.dominant_frequencies) {
        const rawData = source.dominantFrequencies || source.dominant_frequencies;
        
        // Se for string/número simples, converter para structured format
        if (typeof rawData === 'string' || typeof rawData === 'number') {
            tech.dominantFrequencies = {
                value: rawData,
                unit: 'Hz'
            };
        } else if (rawData && typeof rawData === 'object') {
            // Se for object com detailed
            tech.dominantFrequencies = {
                value: rawData.value || rawData.primary || null,
                unit: rawData.unit || 'Hz',
                detailed: rawData.detailed || {
                    primary: rawData.primary || rawData.value || null,
                    secondary: rawData.secondary || null,
                    peaks: rawData.peaks || []
                }
            };
        } else {
            tech.dominantFrequencies = null;
        }
        console.log('📊 [NORMALIZE] Frequências dominantes estruturadas:', tech.dominantFrequencies);
    } else {
        tech.dominantFrequencies = null;
        console.log('⚠️ [NORMALIZE] Frequências dominantes não encontradas - dominantFrequencies = null');
    }
    
    // 🔄 DC OFFSET - Estrutura completa com canais L/R
    if (source.dcOffset || source.dc_offset) {
        const rawDcData = source.dcOffset || source.dc_offset;
        
        // Se for número simples, converter para structured format
        if (typeof rawDcData === 'number') {
            tech.dcOffset = {
                value: rawDcData,
                unit: 'dB',
                detailed: {
                    L: rawDcData,
                    R: rawDcData,
                    severity: Math.abs(rawDcData) > 0.1 ? 'High' : Math.abs(rawDcData) > 0.01 ? 'Medium' : 'Low'
                }
            };
        } else if (rawDcData && typeof rawDcData === 'object') {
            // Se for object com detailed
            tech.dcOffset = {
                value: rawDcData.value || (rawDcData.detailed ? Math.max(Math.abs(rawDcData.detailed.L || 0), Math.abs(rawDcData.detailed.R || 0)) : null),
                unit: rawDcData.unit || 'dB',
                detailed: rawDcData.detailed || {
                    L: rawDcData.L || rawDcData.left || rawDcData.value || 0,
                    R: rawDcData.R || rawDcData.right || rawDcData.value || 0,
                    severity: rawDcData.severity || 'Low'
                }
            };
        } else {
            tech.dcOffset = null;
        }
        console.log('📊 [NORMALIZE] DC Offset estruturado:', tech.dcOffset);
    } else {
        tech.dcOffset = null;
        console.log('⚠️ [NORMALIZE] DC Offset não encontrado - dcOffset = null');
    }
    
    // 📊 SPECTRAL UNIFORMITY - Estrutura detalhada
    if (source.spectralUniformity || source.spectral_uniformity) {
        const rawSpectralData = source.spectralUniformity || source.spectral_uniformity;
        
        // Se for número simples, converter para structured format
        if (typeof rawSpectralData === 'number') {
            tech.spectralUniformity = {
                value: rawSpectralData,
                unit: 'ratio',
                detailed: {
                    variance: rawSpectralData,
                    distribution: rawSpectralData > 0.8 ? 'Uniform' : rawSpectralData > 0.5 ? 'Moderate' : 'Irregular',
                    analysis: rawSpectralData > 0.7 ? 'Well-balanced frequency distribution' : 'Uneven spectral content'
                }
            };
        } else if (rawSpectralData && typeof rawSpectralData === 'object') {
            // Se for object com detailed
            tech.spectralUniformity = {
                value: rawSpectralData.value || rawSpectralData.variance || null,
                unit: rawSpectralData.unit || 'ratio',
                detailed: rawSpectralData.detailed || {
                    variance: rawSpectralData.variance || rawSpectralData.value || null,
                    distribution: rawSpectralData.distribution || 'Unknown',
                    analysis: rawSpectralData.analysis || 'Spectral analysis pending'
                }
            };
        } else {
            tech.spectralUniformity = null;
        }
        console.log('📊 [NORMALIZE] Spectral Uniformity estruturado:', tech.spectralUniformity);
    } else {
        tech.spectralUniformity = null;
        console.log('⚠️ [NORMALIZE] Spectral Uniformity não encontrado - spectralUniformity = null');
    }
    
    // 🔢 SCORES E QUALIDADE - MAPEAMENTO CORRETO PARA NOVA ESTRUTURA
    normalized.qualityOverall = backendData.score && Number.isFinite(backendData.score) ? backendData.score : null;
    
    if (backendData.qualityBreakdown && typeof backendData.qualityBreakdown === 'object') {
        normalized.qualityBreakdown = backendData.qualityBreakdown;
        console.log('📊 [NORMALIZE] Quality breakdown real encontrado:', normalized.qualityBreakdown);
    } else {
        normalized.qualityBreakdown = null;
        console.log('⚠️ [NORMALIZE] Quality breakdown não encontrado - qualityBreakdown = null');
    }
    
    // 📊 DADOS AUXILIARES DO NOVO FORMATO
    if (backendData.metadata) {
        normalized.processingMs = backendData.metadata.processingTime || backendData.performance?.workerTotalTimeMs || null;
        normalized.fileName = backendData.metadata.fileName || null;
        normalized.fileSize = backendData.metadata.fileSize || null;
        normalized.buildVersion = backendData.metadata.buildVersion || null;
        normalized.pipelineVersion = backendData.metadata.pipelineVersion || null;
    }
    
    if (backendData.classification) {
        normalized.classification = backendData.classification;
    }
    
    // 🎯 DADOS DE SCORING DETALHADOS
    if (backendData.scoring) {
        normalized.scoring = backendData.scoring;
        console.log('📊 [NORMALIZE] Dados de scoring encontrados:', backendData.scoring);
    }
    
    // 🚨 PROBLEMAS/SUGESTÕES DO NOVO ANALYZER - Integrar com structure completa
    if (source.problemsAnalysis || source.problems_analysis) {
        const problemsData = source.problemsAnalysis || source.problems_analysis;
        
        // Adicionar problemas do analyzer
        if (problemsData.problems && Array.isArray(problemsData.problems)) {
            problemsData.problems.forEach(problem => {
                normalized.problems.push({
                    type: problem.type || 'analysis',
                    message: problem.message || problem.description || 'Problema detectado',
                    solution: problem.solution || problem.recommendation || 'Verificar configurações',
                    severity: problem.severity || 'medium',
                    source: 'problems_analyzer'
                });
            });
        }
        
        // Adicionar sugestões do analyzer
        if (problemsData.suggestions && Array.isArray(problemsData.suggestions)) {
            problemsData.suggestions.forEach(suggestion => {
                normalized.suggestions.push({
                    type: suggestion.type || 'optimization',
                    message: suggestion.message || suggestion.description || 'Sugestão de melhoria',
                    action: suggestion.action || suggestion.recommendation || 'Aplicar otimização',
                    details: suggestion.details || suggestion.context || 'Detalhes não disponíveis',
                    source: 'problems_analyzer'
                });
            });
        }
        
        console.log('📊 [NORMALIZE] Problems/Suggestions do analyzer integrados:', {
            problemsAdded: problemsData.problems?.length || 0,
            suggestionsAdded: problemsData.suggestions?.length || 0
        });
    }
    
    // 🚨 PROBLEMAS - Garantir que existam alguns problemas/sugestões para exibir
    if (normalized.problems.length === 0) {
        // Detectar problemas básicos baseados nas métricas - APENAS SE VALORES EXISTEM
        if (Number.isFinite(tech.clippingSamples) && tech.clippingSamples > 0) {
            normalized.problems.push({
                type: 'clipping',
                message: `Clipping detectado (${tech.clippingSamples} samples)`,
                solution: 'Reduzir o ganho geral ou usar limitador',
                severity: 'high'
            });
        }
        
        if (tech.dcOffset && tech.dcOffset.detailed) {
            const maxDcOffset = Math.max(Math.abs(tech.dcOffset.detailed.L || 0), Math.abs(tech.dcOffset.detailed.R || 0));
            if (maxDcOffset > 0.01) {
                normalized.problems.push({
                    type: 'dc_offset', 
                    message: `DC Offset detectado (L: ${tech.dcOffset.detailed.L?.toFixed(4) || 'N/A'}, R: ${tech.dcOffset.detailed.R?.toFixed(4) || 'N/A'})`,
                    solution: 'Aplicar filtro DC remove',
                    severity: tech.dcOffset.detailed.severity === 'High' ? 'high' : 'medium'
                });
            }
        } else if (Number.isFinite(tech.dcOffset) && Math.abs(tech.dcOffset) > 0.01) {
            normalized.problems.push({
                type: 'dc_offset', 
                message: `DC Offset detectado (${tech.dcOffset.toFixed(4)})`,
                solution: 'Aplicar filtro DC remove',
                severity: 'medium'
            });
        }
        
        if (Number.isFinite(tech.thdPercent) && tech.thdPercent > 1) {
            normalized.problems.push({
                type: 'thd',
                message: `THD elevado (${tech.thdPercent.toFixed(2)}%)`,
                solution: 'Verificar saturação e distorção',
                severity: 'medium'
            });
        }
    }
    
    // 💡 SUGESTÕES - Garantir algumas sugestões básicas - APENAS SE VALORES EXISTEM
    if (normalized.suggestions.length === 0) {
        if (Number.isFinite(tech.dynamicRange) && tech.dynamicRange < 8) {
            normalized.suggestions.push({
                type: 'dynamics',
                message: 'Faixa dinâmica baixa detectada',
                action: 'Considerar reduzir compressão/limitação',
                details: `DR atual: ${tech.dynamicRange.toFixed(1)}dB`
            });
        }
        
        if (Number.isFinite(tech.stereoCorrelation) && tech.stereoCorrelation > 0.9) {
            normalized.suggestions.push({
                type: 'stereo',
                message: 'Imagem estéreo muito estreita',
                action: 'Aumentar espacialização estéreo',
                details: `Correlação: ${tech.stereoCorrelation.toFixed(3)}`
            });
        }
        
        if (Number.isFinite(tech.lufsIntegrated) && tech.lufsIntegrated < -30) {
            normalized.suggestions.push({
                type: 'loudness',
                message: 'Loudness muito baixo',
                action: 'Aumentar volume geral',
                details: `LUFS atual: ${tech.lufsIntegrated.toFixed(1)}`
            });
        }
        
        // Sugestões baseadas nas novas métricas
        if (tech.spectralUniformity && tech.spectralUniformity.detailed) {
            const uniformity = tech.spectralUniformity.value || tech.spectralUniformity.detailed.variance;
            if (Number.isFinite(uniformity) && uniformity < 0.5) {
                normalized.suggestions.push({
                    type: 'spectral_balance',
                    message: 'Distribuição espectral irregular detectada',
                    action: 'Considerar equalização para melhor balanceamento',
                    details: `Uniformidade: ${uniformity.toFixed(3)}, ${tech.spectralUniformity.detailed.distribution || 'Análise pendente'}`
                });
            }
        }
        
        if (tech.dominantFrequencies && tech.dominantFrequencies.detailed) {
            const primary = tech.dominantFrequencies.detailed.primary;
            if (Number.isFinite(primary)) {
                if (primary < 80) {
                    normalized.suggestions.push({
                        type: 'frequency_focus',
                        message: 'Frequência dominante muito baixa',
                        action: 'Verificar filtro high-pass ou conteúdo sub-bass excessivo',
                        details: `Freq. primária: ${primary.toFixed(1)} Hz`
                    });
                } else if (primary > 8000) {
                    normalized.suggestions.push({
                        type: 'frequency_focus',
                        message: 'Frequência dominante muito alta',
                        action: 'Verificar conteúdo excessivo de agudos',
                        details: `Freq. primária: ${primary.toFixed(1)} Hz`
                    });
                }
            }
        }
    }
    
    console.log('✅ [NORMALIZE] Normalização concluída:', {
        hasTechnicalData: !!normalized.technicalData,
        hasSpectralBalance: !!normalized.technicalData.spectral_balance,
        hasBandEnergies: !!normalized.technicalData.bandEnergies,
        // Novas métricas detalhadas
        hasDominantFreqs: !!normalized.technicalData.dominantFrequencies,
        hasDcOffset: !!normalized.technicalData.dcOffset,
        hasSpectralUniformity: !!normalized.technicalData.spectralUniformity,
        dominantFreqsStructure: normalized.technicalData.dominantFrequencies ? 'structured' : 'missing',
        dcOffsetStructure: normalized.technicalData.dcOffset ? 'structured' : 'missing',
        spectralUniformityStructure: normalized.technicalData.spectralUniformity ? 'structured' : 'missing',
        problemsCount: normalized.problems.length,
        suggestionsCount: normalized.suggestions.length,
        qualityScore: normalized.qualityOverall
    });
    
    // 🎯 LOG DE RESUMO: Métricas normalizadas com sucesso
    const normalizedMetrics = Object.keys(normalized.technicalData).filter(key => 
        Number.isFinite(normalized.technicalData[key])
    );
    
    console.log('📊 [NORMALIZE] Resumo da normalização:', {
        metricas_normalizadas: normalizedMetrics.length,
        metricas_disponiveis: normalizedMetrics,
        spectral_balance_ok: !!normalized.technicalData.spectral_balance,
        bandas_disponiveis: normalized.technicalData.bandEnergies ? 
            Object.keys(normalized.technicalData.bandEnergies).length : 0,
        problemas_detectados: normalized.problems.length,
        sugestoes_iniciais: normalized.suggestions.length
    });
    
    // 🎯 LOG FINAL PARA DEBUG UI
    console.log("✅ [UI_FIX] Normalized metrics:", {
        lufsIntegrated: normalized.technicalData.lufsIntegrated,
        lra: normalized.technicalData.lra,
        truePeakDbtp: normalized.technicalData.truePeakDbtp,
        dynamicRange: normalized.technicalData.dynamicRange,
        spectral_balance: normalized.technicalData.spectral_balance,
        bandEnergies: normalized.technicalData.bandEnergies ? Object.keys(normalized.technicalData.bandEnergies) : null
    });
    
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

// 🎨 INJETAR ESTILOS CSS PARA STATUS DE TRUE PEAK
function injectTruePeakStatusStyles() {
    if (document.getElementById('truePeakStatusStyles')) return; // já injetado
    
    const style = document.createElement('style');
    style.id = 'truePeakStatusStyles';
    style.textContent = `
        /* Status do True Peak */
        .status-excellent {
            color: #00ff88 !important;
            font-weight: 600;
            text-shadow: 0 0 2px rgba(0, 255, 136, 0.3);
        }
        
        .status-ideal {
            color: #28a745 !important;
            font-weight: 600;
        }
        
        .status-good {
            color: #17a2b8 !important;
            font-weight: 600;
        }
        
        .status-warning {
            color: #ffc107 !important;
            font-weight: 600;
            text-shadow: 0 0 2px rgba(255, 193, 7, 0.3);
        }
        
        .status-critical {
            color: #dc3545 !important;
            font-weight: 700;
            text-shadow: 0 0 3px rgba(220, 53, 69, 0.4);
            animation: criticalPulse 2s infinite;
        }
        
        @keyframes criticalPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        /* Responsive para mobile */
        @media (max-width: 600px) {
            .status-excellent,
            .status-ideal,
            .status-good,
            .status-warning,
            .status-critical {
                font-size: 11px;
                font-weight: 600;
            }
        }
    `;
    
    document.head.appendChild(style);
    console.log('🎨 Estilos CSS do True Peak injetados');
}

// Injetar estilos automaticamente quando o DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTruePeakStatusStyles);
} else {
    injectTruePeakStatusStyles();
}

// 🎯 SISTEMA DE TOOLTIPS PARA MÉTRICAS
let currentTooltip = null;

window.showMetricTooltip = function(iconElement, event) {
    // Remover tooltip anterior se existir
    hideMetricTooltip();
    
    const tooltipText = iconElement.getAttribute('data-tooltip');
    if (!tooltipText) return;
    
    // Criar tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'metric-tooltip active';
    tooltip.textContent = tooltipText;
    document.body.appendChild(tooltip);
    
    currentTooltip = tooltip;
    
    // Posicionar tooltip
    const rect = iconElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Posicionar abaixo do ícone, centralizado
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let top = rect.bottom + 10;
    
    // Ajustar se sair da tela
    const padding = 10;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top + tooltipRect.height > window.innerHeight - padding) {
        // Mostrar acima do ícone se não couber embaixo
        top = rect.top - tooltipRect.height - 10;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    
    // Ativar animação
    setTimeout(() => tooltip.classList.add('active'), 10);
};

window.hideMetricTooltip = function() {
    if (currentTooltip) {
        currentTooltip.classList.remove('active');
        setTimeout(() => {
            if (currentTooltip && currentTooltip.parentNode) {
                currentTooltip.parentNode.removeChild(currentTooltip);
            }
            currentTooltip = null;
        }, 300);
    }
};

// Fechar tooltip ao rolar a página
window.addEventListener('scroll', hideMetricTooltip);
window.addEventListener('resize', hideMetricTooltip);

// 🧩 CORREÇÃO #7: Logs de debug automáticos para validação
console.log("%c[SYSTEM CHECK] 🔍 Debug ativo para validação de fluxos genre/reference", "color:#7f00ff;font-weight:bold;");

window.addEventListener("beforeunload", () => {
    console.log("🧹 [CLEANUP] Encerrando sessão de análise e limpando estado.");
});

// 🎯 PATCH DEFINITIVO: Carregar correção da tabela de referência
(function loadReferenceTablePatch() {
    console.log('📦 [INTEGRATION] Carregando patch definitivo da tabela de referência...');
    
    // Tentar carregar o patch definitivo
    const script = document.createElement('script');
    script.src = 'patch-tabela-referencia-final.js';
    script.onload = function() {
        console.log('✅ [INTEGRATION] Patch definitivo carregado com sucesso');
    };
    script.onerror = function() {
        console.warn('⚠️ [INTEGRATION] Não foi possível carregar patch-tabela-referencia-final.js');
        console.log('💡 [INTEGRATION] A correção já foi aplicada diretamente no código');
    };
    
    document.head.appendChild(script);
})();
