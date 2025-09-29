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
        const maxAttempts = 60; // 5 minutos máximo (5s * 60 = 300s)
        
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

                // Atualizar progresso na UI se disponível
                if (jobData.progress) {
                    updateModalProgress(jobData.progress, `Processando análise... ${jobData.progress}%`);
                }

                if (jobData.status === 'completed' || jobData.status === 'done') {
                    __dbg('✅ Job concluído com sucesso');
                    resolve(jobData.result || jobData);
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
    const progressBar = document.querySelector('.progress-fill');
    
    if (progressText) {
        progressText.innerHTML = `${message}`;
    }
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
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
                
                // 🎯 [REFATORACAO] Redirecionar para fluxo AI unificado
                try { 
                    console.debug('[REFATORACAO] Redirecionando updateReferenceSuggestions para fluxo AI');
                    // Processar dados sem renderizar DOM (deixar para o AI)
                    updateReferenceSuggestions(currentModalAnalysis); 
                    
                    // Triggerar re-processamento AI se disponível
                    if (window.aiSuggestionIntegration && currentModalAnalysis?.suggestions) {
                        console.debug('[REFATORACAO] Triggering AI reprocessing após mudança de gênero');
                        window.aiSuggestionIntegration.processSuggestions(currentModalAnalysis.suggestions, currentModalAnalysis);
                    }
                } catch(e) { console.warn('Processamento de sugestões falhou', e); }
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
        
        // 🎯 [REFATORACAO] Gerar sugestões e processar via fluxo AI unificado
        if (__activeRefData && !normalizedResult._suggestionsGenerated) {
            console.log('🎯 [REFATORACAO] Gerando sugestões para fluxo AI no primeiro load');
            try {
                // Gerar dados de sugestões sem renderizar DOM
                updateReferenceSuggestions(normalizedResult, __activeRefData);
                normalizedResult._suggestionsGenerated = true;
                console.log(`🎯 [REFATORACAO] ${normalizedResult.suggestions?.length || 0} sugestões geradas`);
                
                // Processar via sistema AI se disponível
                if (window.aiSuggestionIntegration && normalizedResult.suggestions) {
                    console.debug('[REFATORACAO] Processando sugestões via sistema AI');
                    setTimeout(() => {
                        window.aiSuggestionIntegration.processSuggestions(normalizedResult.suggestions, normalizedResult);
                    }, 100); // Pequeno delay para garantir que o modal está pronto
                }
            } catch (error) {
                console.error('❌ [REFATORACAO] Erro ao processar sugestões:', error);
            }
        } else if (!__activeRefData) {
            console.log('🎯 [REFATORACAO] Dados de referência não disponíveis - AI renderizará placeholder');
        } else {
            console.log('🎯 [REFATORACAO] Sugestões já processadas anteriormente');
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
    // � AUDITORIA DO MODAL ORIGINAL
    // 🚨 AUDITORIA CRÍTICA: FLUXO ORIGINAL ATIVO
    console.group('🚨 [AUDITORIA-FLUXO] displayModalResults chamado (fluxo antigo)');
    console.error('[AUDITORIA-FLUXO] SISTEMA ORIGINAL RENDERIZANDO - Este pode ser o problema!');
    
    console.group('🔍 [AUDITORIA-MODAL-ORIGINAL] displayModalResults CHAMADO');
    console.debug('[AUDITORIA-MODAL] Origem da chamada:', (new Error()).stack.split('\n')[1]?.trim());
    console.debug('[AUDITORIA-MODAL] Análise recebida:', {
        hasAnalysis: !!analysis,
        hasSuggestions: !!analysis?.suggestions,
        suggestionsLength: analysis?.suggestions?.length || 0,
        runId: analysis?.runId || analysis?.metadata?.runId,
        currentRunId: window.__CURRENT_ANALYSIS_RUN_ID__
    });

    // 🎯 [REFATORACAO] Verificar se fluxo AI está ativo
    if (window.__AI_RENDER_MODE_ACTIVE__ || window.__BLOCK_ORIGINAL_RENDERING__) {
        console.debug('[REFATORACAO] displayModalResults bloqueado - fluxo AI ativo');
        console.debug('[REFATORACAO] Dados processados mas renderização delegada ao sistema AI');
        console.groupEnd();
        return;
    }

    // �🔒 UI GATE: Verificação final antes de renderizar
    const analysisRunId = analysis?.runId || analysis?.metadata?.runId;
    const currentRunId = window.__CURRENT_ANALYSIS_RUN_ID__;
    
    if (analysisRunId && currentRunId && analysisRunId !== currentRunId) {
        console.warn(`🚫 [UI_GATE] displayModalResults cancelado - análise obsoleta (análise: ${analysisRunId}, atual: ${currentRunId})`);
        console.groupEnd();
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
        analysis = normalizeBackendAnalysisData(analysis);
        console.log('📊 [DEBUG] Dados normalizados para exibição:', analysis);
    }
    
    // 🤖 ATIVAR IA SE AINDA NÃO ESTIVER CONFIGURADA
    if (window.aiSuggestionLayer && !window.aiSuggestionLayer.apiKey) {
        console.log('🤖 Configurando IA para desenvolvimento...');
        // Configurar uma key de desenvolvimento (substitua pela sua)
        window.aiSuggestionLayer.setApiKey('dev-mode-enabled', 'gpt-3.5-turbo');
    }

    // 🎯 CALCULAR SCORES DA ANÁLISE
    if (analysis) {
        const detectedGenre = analysis.metadata?.genre || analysis.genre || __activeRefGenre || 'funk_mandela';
        console.log('🎯 Calculando scores para gênero:', detectedGenre);
        
        // 🔧 CORREÇÃO: Garantir que referência exista, senão usar fallback
        let refData = __activeRefData;
        if (!refData) {
            console.warn('⚠️ __activeRefData ausente, tentando fallback de referência');
            // Tentar usar referência embarcada
            const embeddedRefs = window.audioRefs || {};
            refData = embeddedRefs[detectedGenre] || embeddedRefs['funk_mandela'];
        }
        
        if (refData) {
            try {
                const analysisScores = calculateAnalysisScores(analysis, refData, detectedGenre);
                
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
            console.error('❌ Nenhuma referência disponível para calcular scores');
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
            // CONDITIONAL: Pico de Amostra - só exibir se não for placeholder 0.000
            (Number.isFinite(getMetric('peak_db', 'peak')) && getMetric('peak_db', 'peak') !== 0 ? row('Pico de Amostra', `${safeFixed(getMetric('peak_db', 'peak'))} dB`, 'peak') : ''),
            row('Volume Médio (RMS)', `${safeFixed(getMetric('rms_level', 'avgLoudness'))} dBFS`, 'avgLoudness'),
            row('Dynamic Range (DR)', `${safeFixed(getMetric('dynamic_range', 'dynamicRange'))} dB`, 'dynamicRange'),
            row('Loudness Range (LRA)', `${safeFixed(getMetric('lra', 'lra'))} LU`, 'lra'),
            // 🥁 BPM – exibir como métrica principal, null-safe (mostra — quando ausente)
            row('BPM', `${Number.isFinite(getMetric('bpm', 'bpm')) ? safeFixed(getMetric('bpm', 'bpm'), 0) : '—'}`, 'bpm'),
            row('Fator de Crista', `${safeFixed(getMetric('crest_factor', 'crestFactor'))} dB`, 'crestFactor'),
            // REMOVED: True Peak placeholder/ampulheta - só exibir quando há valor válido
            (advancedReady && Number.isFinite(getMetric('truePeakDbtp', 'truePeakDbtp')) ? (() => {
                const tpValue = getMetric('truePeakDbtp', 'truePeakDbtp');
                const tpStatus = getTruePeakStatus(tpValue);
                return row('Pico Real (dBTP)', `${safeFixed(tpValue)} dBTP <span class="${tpStatus.class}">${tpStatus.status}</span>`, 'truePeakDbtp');
            })() : ''),
            // REMOVED: LUFS placeholder/ampulheta - só exibir quando há valor válido  
            (advancedReady && Number.isFinite(getLufsIntegratedValue()) ? row('LUFS Integrado (EBU R128)', `${safeFixed(getLufsIntegratedValue())} LUFS`, 'lufsIntegrated') : ''),
            (advancedReady && Number.isFinite(getMetric('lufs_short_term', 'lufsShortTerm')) ? row('LUFS Curto Prazo', `${safeFixed(getMetric('lufs_short_term', 'lufsShortTerm'))} LUFS`, 'lufsShortTerm') : ''),
            (advancedReady && Number.isFinite(getMetric('lufs_momentary', 'lufsMomentary')) ? row('LUFS Momentâneo', `${safeFixed(getMetric('lufs_momentary', 'lufsMomentary'))} LUFS`, 'lufsMomentary') : '')
            ].join('');

        const col2 = [
            row('Correlação Estéreo (largura)', Number.isFinite(getMetric('stereo_correlation', 'stereoCorrelation')) ? safeFixed(getMetric('stereo_correlation', 'stereoCorrelation'), 3) : '—', 'stereoCorrelation'),
            row('Largura Estéreo', Number.isFinite(getMetric('stereo_width', 'stereoWidth')) ? safeFixed(getMetric('stereo_width', 'stereoWidth'), 2) : '—', 'stereoWidth'),
            row('Balanço Esquerdo/Direito', Number.isFinite(getMetric('balance_lr', 'balanceLR')) ? safePct(getMetric('balance_lr', 'balanceLR')) : '—', 'balanceLR'),
            row('Frequência Central (brilho)', Number.isFinite(getMetric('spectral_centroid', 'spectralCentroidHz')) ? safeHz(getMetric('spectral_centroid', 'spectralCentroidHz')) : '—', 'spectralCentroidHz')
            // REMOVED: Limite de Agudos (85%) - feeds score but inconsistent calculation
            // REMOVED: Largura Espectral (Hz) - moved to technical section (not core, doesn't feed score)
            // REMOVED: zero crossing rate - not used in scoring, placeholder only
            // REMOVED: Mudança Espectral - not used in scoring, placeholder only
            // REMOVED: Uniformidade (linear vs peaks) - feeds score but buggy, hide UI
        ].join('');

            // REMOVED: col3Extras (Dominant Frequencies)  
            // Reason: REMOVAL_SKIPPED_USED_BY_SCORE:dominantFrequencies - usado por enhanced-suggestion-engine.js
            console.warn('REMOVAL_SKIPPED_USED_BY_SCORE:dominantFrequencies - mantendo cálculo interno, ocultando UI');
            
            const col3 = [
                // REMOVED: Dominant Frequencies UI (mantendo cálculo interno para suggestions)
                
                // Métricas avançadas baseadas nas imagens
                (Number.isFinite(getMetric('clipping_pct', 'clippingPct')) ? row('clipping (%)', `${safeFixed(getMetric('clipping_pct', 'clippingPct'), 2)}%`, 'clippingPct') : ''),
                (analysis.technicalData?.dcOffset?.detailed ? row('dc offset', `L: ${safeFixed(analysis.technicalData.dcOffset.detailed.L, 4)} / R: ${safeFixed(analysis.technicalData.dcOffset.detailed.R, 4)} (${analysis.technicalData.dcOffset.detailed.severity || 'Low'})`) : ''),
                (Number.isFinite(getMetric('thd', 'thd')) ? row('thd', `${safeFixed(getMetric('thd', 'thd'), 2)}%`, 'thd') : ''),
                
                // REMOVED: Dinâmica e Fator de Crista duplicados - já exibidos em col1
                // REMOVED: row('Correlação Estéreo (largura)') - duplicado de col2
                // REMOVED: row('fator de crista') - duplicado de col1
                // REMOVED: row('Dinâmica (diferença entre alto/baixo)') - duplicado de col1 com DR e LRA
                
                // REMOVED: Placeholders hardcoded - substituir por valores reais quando disponíveis
                // row('crest consist', 'Δ=4.43 check', 'crestConsist'),
                // row('Variação de Volume (consistência)', 'ok', 'volumeConsistency'),
                
                row('Problemas', (analysis.problems?.length || 0) > 0 ? `<span class="tag tag-danger">${analysis.problems.length} detectado(s)</span>` : '—'),
                row('Sugestões', (analysis.suggestions?.length || 0) > 0 ? `<span class="tag tag-success">${analysis.suggestions.length} disponível(s)</span>` : '—')
                // REMOVED: col3Extras (dominant frequencies UI)
            ].join('');

            // Card extra: Métricas Avançadas (expandido para Web Audio API compatibility)
            const advancedMetricsCard = () => {
                const rows = [];
                
                // === MÉTRICAS DE PICO E CLIPPING (seção principal) ===
                
                // True Peak (dBTP)
                if (Number.isFinite(analysis.technicalData?.truePeakDbtp)) {
                    const tpStatus = getTruePeakStatus(analysis.technicalData.truePeakDbtp);
                    rows.push(row('True Peak (dBTP)', `${safeFixed(analysis.technicalData.truePeakDbtp, 2)} dBTP <span class="${tpStatus.class}">${tpStatus.status}</span>`, 'truePeakDbtp'));
                }
                
                // Picos por canal separados
                if (Number.isFinite(analysis.technicalData?.samplePeakLeftDb)) {
                    rows.push(row('Pico L (dBFS)', `${safeFixed(analysis.technicalData.samplePeakLeftDb, 1)} dBFS`, 'samplePeakLeftDb'));
                }
                if (Number.isFinite(analysis.technicalData?.samplePeakRightDb)) {
                    rows.push(row('Pico R (dBFS)', `${safeFixed(analysis.technicalData.samplePeakRightDb, 1)} dBFS`, 'samplePeakRightDb'));
                }
                
                // Clipping (%)
                if (Number.isFinite(analysis.technicalData?.clippingPct)) {
                    rows.push(row('clipping (%)', `${safeFixed(analysis.technicalData.clippingPct, 3)}%`, 'clippingPct'));
                }
                
                // Clipping samples
                if (Number.isFinite(analysis.technicalData?.clippingSamples)) {
                    rows.push(row('samples clipped', `${analysis.technicalData.clippingSamples}`, 'clippingSamples'));
                }
                
                // === DC OFFSET ===
                if (analysis.dcOffset && Number.isFinite(analysis.dcOffset.maxAbsDC)) {
                    rows.push(row('dc offset', `${safeFixed(analysis.dcOffset.maxAbsDC, 5)}`, 'dcOffset'));
                }
                
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
                
                // === BANDAS ESPECTRAIS DETALHADAS (DINÂMICAS) ===
                // Buscar bandas em múltiplas localizações do JSON
                const spectralBands = analysis.technicalData?.spectral_balance || 
                                    analysis.technicalData?.spectralBands || 
                                    analysis.metrics?.bands || {};
                
                if (Object.keys(spectralBands).length > 0) {
                    // Mapeamento das bandas do novo sistema
                    const bandMap = {
                        sub: { name: 'Sub (20-60Hz)', range: '20-60Hz' },
                        bass: { name: 'Bass (60-150Hz)', range: '60-150Hz' },
                        lowMid: { name: 'Low-Mid (150-500Hz)', range: '150-500Hz' },
                        mid: { name: 'Mid (500-2kHz)', range: '500-2000Hz' },
                        highMid: { name: 'High-Mid (2-5kHz)', range: '2000-5000Hz' },
                        presence: { name: 'Presence (5-10kHz)', range: '5000-10000Hz' },
                        air: { name: 'Air (10-20kHz)', range: '10000-20000Hz' }
                    };
                    
                    // Percorrer dinamicamente todas as bandas disponíveis
                    Object.keys(bandMap).forEach(bandKey => {
                        const bandData = spectralBands[bandKey];
                        if (bandData && typeof bandData === 'object') {
                            // Verificar se tem energy_db e percentage (novo formato)
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
                            // Formato legado (apenas valor numérico)
                            rows.push(row(bandMap[bandKey].name, `${safeFixed(bandData, 1)} dB`, `spectral${bandKey.charAt(0).toUpperCase() + bandKey.slice(1)}`));
                        }
                    });
                    
                    // Se não encontrou nenhuma banda nas chaves esperadas, tentar buscar qualquer banda disponível
                    if (rows.filter(r => r.includes('spectral')).length === 0) {
                        Object.keys(spectralBands).forEach(bandKey => {
                            if (bandKey === '_status' || bandKey === 'totalPercentage') return; // Pular metadados
                            
                            const bandData = spectralBands[bandKey];
                            if (bandData && typeof bandData === 'object') {
                                const energyDb = bandData.energy_db;
                                const percentage = bandData.percentage;
                                const range = bandData.range || bandData.frequencyRange || 'N/A';
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
                                    
                                    const displayName = `${bandKey.charAt(0).toUpperCase() + bandKey.slice(1)} (${range})`;
                                    rows.push(row(displayName, displayValue, `spectral${bandKey.charAt(0).toUpperCase() + bandKey.slice(1)}`));
                                }
                            } else if (Number.isFinite(bandData)) {
                                const displayName = `${bandKey.charAt(0).toUpperCase() + bandKey.slice(1)}`;
                                rows.push(row(displayName, `${safeFixed(bandData, 1)} dB`, `spectral${bandKey.charAt(0).toUpperCase() + bandKey.slice(1)}`));
                            }
                        });
                    }
                }
                
                // === MÉTRICAS ESPECTRAIS AVANÇADAS ===
                
                // Spectral Centroid
                if (Number.isFinite(analysis.technicalData?.spectralCentroid)) {
                    rows.push(row('spectral centroid', `${Math.round(analysis.technicalData.spectralCentroid)} Hz`, 'spectralCentroid'));
                }
                
                // Spectral Rolloff
                if (Number.isFinite(analysis.technicalData?.spectralRolloff)) {
                    rows.push(row('spectral rolloff', `${Math.round(analysis.technicalData.spectralRolloff)} Hz`, 'spectralRolloff'));
                }
                
                // Spectral Flatness
                if (Number.isFinite(analysis.technicalData?.spectralFlatness)) {
                    rows.push(row('spectral flatness', `${safeFixed(analysis.technicalData.spectralFlatness, 4)}`, 'spectralFlatness'));
                }
                
                // Spectral Bandwidth (moved from main UI - not core metric)
                if (Number.isFinite(getMetric('spectral_bandwidth', 'spectralBandwidthHz'))) {
                    rows.push(row('spectral bandwidth', `${safeHz(getMetric('spectral_bandwidth', 'spectralBandwidthHz'))}`, 'spectralBandwidthHz'));
                }
                
                // Spectral Kurtosis
                if (Number.isFinite(analysis.technicalData?.spectralKurtosis)) {
                    rows.push(row('spectral kurtosis', `${safeFixed(analysis.technicalData.spectralKurtosis, 3)}`, 'spectralKurtosis'));
                }
                
                // Spectral Skewness
                if (Number.isFinite(analysis.technicalData?.spectralSkewness)) {
                    rows.push(row('spectral skewness', `${safeFixed(analysis.technicalData.spectralSkewness, 3)}`, 'spectralSkewness'));
                }
                
                // === FREQUÊNCIAS DOMINANTES ===
                // REMOVED: Dominant Frequencies display (mantendo cálculo interno para enhanced-suggestion-engine.js)
                console.warn('REMOVAL_SKIPPED_USED_BY_SCORE:dominantFrequencies - ocultando UI, mantendo cálculo');
                
                // === MÉTRICAS DE UNIFORMIDADE ===  
                // REMOVED: Spectral Uniformity display (mantendo cálculo interno para problems-suggestions.js)
                console.warn('REMOVAL_SKIPPED_USED_BY_SCORE:spectralUniformity - ocultando UI, mantendo cálculo');
                
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
            
            // Score final com destaque
            const finalScoreHtml = Number.isFinite(scores.final) ? `
                <div class="data-row" style="border: 2px solid rgba(0, 255, 255, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 10px; background: rgba(0, 255, 255, 0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="label" style="font-size: 16px; font-weight: bold;">🏆 SCORE FINAL</span>
                        <span style="font-size: 24px; font-weight: bold; color: ${scores.final >= 80 ? '#00ff92' : scores.final >= 60 ? '#ffd700' : scores.final >= 40 ? '#ff9500' : '#ff3366'};">
                            ${Math.round(scores.final)}
                        </span>
                    </div>
                    <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">
                        Gênero: ${scores.genre || 'padrão'} • Ponderação adaptativa
                    </div>
                </div>
            ` : '';
            
            // Sub-scores
            const subScoresHtml = `
                ${renderScoreProgressBar('Loudness', scores.loudness, '#ff3366', '🔊')}
                ${renderScoreProgressBar('Frequência', scores.frequencia, '#00ffff', '🎵')}
                ${renderScoreProgressBar('Estéreo', scores.estereo, '#ff6b6b', '🎧')}
                ${renderScoreProgressBar('Dinâmica', scores.dinamica, '#ffd700', '📊')}
                ${renderScoreProgressBar('Técnico', scores.tecnico, '#00ff92', '🔧')}
            `;
            
            return finalScoreHtml + subScoresHtml;
        };
        
        const scoreRows = renderNewScores();

        technicalData.innerHTML = `
            <div class="kpi-row">${scoreKpi}${timeKpi}</div>
                ${renderSmartSummary(analysis) }
                    <div class="cards-grid">
                        <div class="card">
                    <div class="card-title">🎛️ Métricas Principais</div>
                    ${col1}
                </div>
                        <div class="card">
                    <div class="card-title">🎧 Análise Estéreo & Espectral</div>
                    ${col2}
                </div>
                        <!-- REMOVED: 🔊 Bandas Espectrais (Consolidado) - duplicação removida, mantida apenas em Métricas Avançadas -->
                        
                        <div class="card">
                    <div class="card-title">�🏆 Scores & Diagnóstico</div>
                    ${scoreRows}
                    ${col3}
                </div>
                        <div class="card">
                            <div class="card-title">📊 Métricas Avançadas (Technical)</div>
                            ${advancedMetricsCard()}
                        </div>
                        <div class="card card-span-2">
                            <div class="card-title">⚠️ Problemas Técnicos</div>
                            ${techProblems()}
                        </div>
                        <!-- Card "Diagnóstico & Sugestões" removido conforme solicitado -->
                        <!-- 
                        <div class="card card-span-2">
                            <div class="card-title">🩺 Diagnóstico & Sugestões</div>
                            ${diagCard()}
                        </div>
                        -->
            </div>
        `;
    
    try { renderReferenceComparisons(analysis); } catch(e){ console.warn('ref compare fail', e);}    
        try { if (window.CAIAR_ENABLED) injectValidationControls(); } catch(e){ console.warn('validation controls fail', e); }
    
    // 🔍 AUDITORIA FINAL DO MODAL
    console.debug('[AUDITORIA-MODAL] Modal renderizado - estado final:', {
        suggestionsLength: analysis?.suggestions?.length || 0,
        suggestionsTypes: analysis?.suggestions?.map(s => s.type || s.metric) || [],
        modalElement: !!document.getElementById('modalTechnicalData'),
        suggestionsListElement: !!document.getElementById('suggestions-list'),
        suggestionsListContent: document.getElementById('suggestions-list')?.innerHTML?.length || 0
    });
    console.groupEnd();
}

// ✅ [FIXED] displayModalResults redirecionado para fluxo AI unificado
function displayModalResults(analysis) {
    // ✅ [FIXED] Modal antigo redirecionado para fluxo AI unificado
    console.log("[FIXED] displayModalResults redirecionado para sistema AI");
    console.debug("[FIXED] Análise disponível:", {
        hasAnalysis: !!analysis,
        hasSuggestions: !!analysis?.suggestions,
        suggestionsLength: analysis?.suggestions?.length || 0
    });
    
    // Delegar para o sistema AI unificado
    if (window.aiSuggestionUIController) {
        console.log("[FIXED] Delegando para aiSuggestionUIController.openFullModal()");
        window.aiSuggestionUIController.openFullModal();
    } else {
        console.warn("[FIXED] aiSuggestionUIController não encontrado, tentando método alternativo");
        // Fallback: procurar pelo controlador na janela
        const modalElement = document.querySelector('.ai-full-modal, .modal, [data-modal]');
        if (modalElement) {
            modalElement.style.display = 'flex';
            modalElement.classList.add('show');
            console.log("[FIXED] Modal aberto via fallback DOM");
        }
    }
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
            // 🎯 CORREÇÃO CRÍTICA: Ordenar por prioridade DECRESCENTE (maior primeiro)
            // True Peak deve aparecer primeiro (priority alta), não por último
            sugg.sort((a,b)=> (b.priority||0)-(a.priority||0));
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
    
    // Mapeamento de métricas - RESTAURAR TABELA COMPLETA
    const rows = [];
    const nf = (n, d=2) => Number.isFinite(n) ? n.toFixed(d) : '—';
    const pushRow = (label, val, target, tol, unit='') => {
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
        const diff = Number.isFinite(val) && Number.isFinite(target) ? (val - target) : null;
        
        // 🎯 CORREÇÃO: Mostrar apenas status visual (não valores numéricos)
        let diffCell;
        if (!Number.isFinite(diff) || !Number.isFinite(tol) || tol <= 0) {
            diffCell = '<td class="na" style="text-align: center;"><span style="opacity: 0.6;">—</span></td>';
        } else {
            const absDiff = Math.abs(diff);
            let cssClass, statusIcon, statusText;
            
            // Mesma lógica de limites do sistema unificado
            if (absDiff <= tol) {
                // ✅ ZONA IDEAL
                cssClass = 'ok';
                statusIcon = '✅';
                statusText = 'Ideal';
            } else {
                const multiplicador = absDiff / tol;
                if (multiplicador <= 2) {
                    // ⚠️ ZONA AJUSTAR
                    cssClass = 'yellow';
                    statusIcon = '⚠️';
                    statusText = 'Ajuste leve';
                } else {
                    // ❌ ZONA CORRIGIR
                    cssClass = 'warn';
                    statusIcon = '❌';
                    statusText = 'Corrigir';
                }
            }
            
            diffCell = `<td class="${cssClass}" style="text-align: center; padding: 8px;">
                <div style="font-size: 12px; font-weight: 600;">${statusText}</div>
            </td>`;
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
    
    // 🎯 CENTRALIZAÇÃO DAS MÉTRICAS - Função de acesso para comparação por referência
    // Usar somente métricas reais (sem fallback para RMS/Peak, que têm unidades e conceitos distintos)
    // Função para obter o valor LUFS integrado usando métricas centralizadas
    const getLufsIntegratedValue = () => {
        return getMetricForRef('lufs_integrated', 'lufsIntegrated');
    };
    
    // ADICIONAR TODAS AS MÉTRICAS PRINCIPAIS
    pushRow('Loudness Integrado (LUFS)', getLufsIntegratedValue(), ref.lufs_target, ref.tol_lufs, ' LUFS');
    pushRow('Pico Real (dBTP)', getMetricForRef('true_peak_dbtp', 'truePeakDbtp'), ref.true_peak_target, ref.tol_true_peak, ' dBTP');
    pushRow('DR', getMetricForRef('dynamic_range', 'dynamicRange'), ref.dr_target, ref.tol_dr, '');
    pushRow('Faixa de Loudness – LRA (LU)', getMetricForRef('lra'), ref.lra_target, ref.tol_lra, ' LU');
    pushRow('Stereo Corr.', getMetricForRef('stereo_correlation', 'stereoCorrelation'), ref.stereo_target, ref.tol_stereo, '');
    
    // Bandas detalhadas Fase 2: usar métricas centralizadas para bandas
    const centralizedBands = analysis.metrics?.bands;
    const legacyBandEnergies = tech.bandEnergies || null;
    
    // 🔍 DEBUG: Verificar estado das bandas e mapeamento
    console.log('🔍 [DEBUG_BANDS] Verificando bandas espectrais:', {
        hasCentralizedBands: !!centralizedBands,
        centralizedBandsKeys: centralizedBands ? Object.keys(centralizedBands) : [],
        hasLegacyBands: !!legacyBandEnergies,
        legacyBandsKeys: legacyBandEnergies ? Object.keys(legacyBandEnergies) : [],
        hasRefBands: !!ref.bands,
        refBandsKeys: ref.bands ? Object.keys(ref.bands) : []
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
    
    // Priorizar bandas centralizadas se disponíveis
    const bandsToUse = centralizedBands && Object.keys(centralizedBands).length > 0 ? centralizedBands : legacyBandEnergies;
    
    if (bandsToUse && ref.bands) {
        const normMap = (analysis?.technicalData?.refBandTargetsNormalized?.mapping) || null;
        const showNorm = (typeof window !== 'undefined' && window.SHOW_NORMALIZED_REF_TARGETS === true && normMap);
        
        // Mapeamento de nomes amigáveis para as bandas com ranges de frequência
        const bandDisplayNames = {
            sub: 'Sub (20–60Hz)',
            bass: 'Bass (60–150Hz)', 
            low_bass: 'Bass (60–150Hz)',
            lowMid: 'Low-Mid (150–500Hz)',
            low_mid: 'Low-Mid (150–500Hz)',
            mid: 'Mid (500–2kHz)',
            highMid: 'High-Mid (2–5kHz)',
            high_mid: 'High-Mid (2–5kHz)',
            presence: 'Presence (5–10kHz)',
            presenca: 'Presence (5–10kHz)',
            air: 'Air (10–20kHz)',
            brilho: 'Air (10–20kHz)'
        };
        
        // 🎯 PROCESSAMENTO CORRIGIDO: Iterar por bandas de referência e mapear para dados calculados
        console.log('🔄 Processando bandas com mapeamento corrigido...');
        
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
            
            // Determinar target
            let tgt = null;
            if (!refBand._target_na && Number.isFinite(refBand.target_db)) tgt = refBand.target_db;
            if (showNorm && normMap && Number.isFinite(normMap[refBandKey])) tgt = normMap[refBandKey];
            
            // Nome para exibição
            const displayName = bandDisplayNames[calcBandKey] || bandDisplayNames[refBandKey] || refBandKey;
            
            console.log(`📊 [BANDS] Adicionando: ${displayName}, valor: ${bLocal.rms_db}dB, target: ${tgt}dB`);
            pushRow(displayName, bLocal.rms_db, tgt, refBand.tol_db, ' dB');
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
                        const target = directRefData?.target_db || null;
                        const tolerance = directRefData?.tol_db || null;
                        
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
            low_bass: { refKey: 'low_bass', name: 'Bass (60–150Hz)', range: '60–150Hz' },
            lowMid: { refKey: 'low_mid', name: 'Low-Mid (150–500Hz)', range: '150–500Hz' },
            low_mid: { refKey: 'low_mid', name: 'Low-Mid (150–500Hz)', range: '150–500Hz' },
            mid: { refKey: 'mid', name: 'Mid (500–2kHz)', range: '500–2000Hz' },
            highMid: { refKey: 'high_mid', name: 'High-Mid (2–5kHz)', range: '2000–5000Hz' },
            high_mid: { refKey: 'high_mid', name: 'High-Mid (2–5kHz)', range: '2000–5000Hz' },
            presence: { refKey: 'presenca', name: 'Presence (5–10kHz)', range: '5000–10000Hz' },
            presenca: { refKey: 'presenca', name: 'Presence (5–10kHz)', range: '5000–10000Hz' },
            air: { refKey: 'brilho', name: 'Air (10–20kHz)', range: '10000–20000Hz' },
            brilho: { refKey: 'brilho', name: 'Air (10–20kHz)', range: '10000–20000Hz' }
        };
        
        // 🎯 PROCESSAMENTO CORRIGIDO para fallback: usar mapeamento bidirecional
        console.log('🔄 Processando bandas espectrais (modo fallback)...');
        
        if (spectralBands && Object.keys(spectralBands).length > 0) {
            // Conjunto para rastrear bandas já processadas
            const processedBandKeys = new Set();
            
            // Primeiro: processar bandas que têm referência (usando mapeamento)
            Object.entries(bandMap).forEach(([calcBandKey, bandInfo]) => {
                const bandData = spectralBands[calcBandKey];
                const refBandData = ref.bands?.[bandInfo.refKey];
                
                if (bandData && !processedBandKeys.has(calcBandKey)) {
                    let energyDb = null;
                    
                    // Verificar formato dos dados da banda
                    if (typeof bandData === 'object' && bandData.energy_db !== undefined) {
                        energyDb = bandData.energy_db;
                    } else if (typeof bandData === 'object' && bandData.rms_db !== undefined) {
                        energyDb = bandData.rms_db;
                    } else if (Number.isFinite(bandData)) {
                        energyDb = bandData;
                    }
                    
                    if (Number.isFinite(energyDb)) {
                        // Se tem referência, usar target, senão N/A
                        const target = refBandData?.target_db || null;
                        const tolerance = refBandData?.tol_db || null;
                        
                        console.log(`📊 Banda (fallback): ${bandInfo.name}, valor: ${energyDb}dB, target: ${target || 'N/A'}`);
                        pushRow(bandInfo.name, energyDb, target, tolerance, ' dB');
                        processedBandKeys.add(calcBandKey);
                        
                        if (!target) {
                            console.warn(`⚠️ Banda sem target: ${calcBandKey} → ${bandInfo.refKey}`);
                        }
                    }
                }
            });
            
            // Segundo: processar bandas restantes que não foram mapeadas
            Object.keys(spectralBands).forEach(bandKey => {
                if (!processedBandKeys.has(bandKey) && 
                    bandKey !== '_status' && 
                    bandKey !== 'totalPercentage' &&
                    bandKey !== 'totalpercentage' &&
                    bandKey !== 'metadata' &&
                    bandKey !== 'total' &&
                    !bandKey.toLowerCase().includes('total')) {
                    
                    const bandData = spectralBands[bandKey];
                    let energyDb = null;
                    
                    if (typeof bandData === 'object' && Number.isFinite(bandData.energy_db)) {
                        energyDb = bandData.energy_db;
                    } else if (typeof bandData === 'object' && Number.isFinite(bandData.rms_db)) {
                        energyDb = bandData.rms_db;
                    } else if (Number.isFinite(bandData)) {
                        energyDb = bandData;
                    }
                    
                    if (Number.isFinite(energyDb)) {
                        // Buscar nome formatado ou criar um
                        const displayName = bandMap[bandKey]?.name || 
                                          `${bandKey.charAt(0).toUpperCase() + bandKey.slice(1)} (Detectada)`;
                        
                        // Tentar encontrar referência por chave direta
                        const directRefData = ref.bands?.[bandKey];
                        const target = directRefData?.target_db || null;
                        const tolerance = directRefData?.tol_db || null;
                        
                        console.log(`📊 Banda não mapeada: ${displayName}, valor: ${energyDb}dB, target: ${target || 'N/A'}`);
                        pushRow(displayName, energyDb, target, tolerance, ' dB');
                        
                        if (!target) {
                            console.warn(`⚠️ Banda não mapeada sem target: ${bandKey}`);
                        }
                    }
                }
            });
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
        <div class="card-title">📌 Comparação de Referência (${titleText})</div>
        <table class="ref-compare-table">
            <thead><tr>
                <th>Métrica</th><th>Valor</th><th>Alvo</th><th>Δ</th>
            </tr></thead>
            <tbody>${rows.join('') || '<tr><td colspan="4" style="opacity:.6">Sem métricas disponíveis</td></tr>'}</tbody>
        </table>
    </div>`;
    // Estilos injetados uma vez com indicadores visuais melhorados
    if (!document.getElementById('refCompareStyles')) {
        const style = document.createElement('style');
        style.id = 'refCompareStyles';
        style.textContent = `
        .ref-compare-table{width:100%;border-collapse:collapse;font-size:11px;}
        .ref-compare-table th{font-weight:500;text-align:left;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.12);font-size:11px;color:#fff;letter-spacing:.3px;}
        .ref-compare-table td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.06);color:#f5f7fa;} 
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

// 1.5. FUNÇÃO PARA OBTER PARÂMETROS DE SCORING DINÂMICOS
function getScoringParameters(genre, metricKey) {
    // Tenta buscar parâmetros do scoring-v2-config.json se disponível
    const globalConfig = window.__SCORING_V2_CONFIG__ || {};
    const scoringParams = globalConfig.scoring_parameters || {};
    
    // Buscar parâmetros específicos do gênero, senão usar defaults
    const genreParams = scoringParams[genre] || scoringParams.default || {};
    
    // Defaults seguros
    const defaults = {
        yellowMin: 70,
        bufferFactor: 1.5,
        severity: null,
        hysteresis: 0.2,
        invert: false
    };
    
    // Casos especiais por métrica
    if (metricKey === 'truePeakDbtp' || metricKey === 'dcOffset' || 
        metricKey === 'thdPercent' || metricKey === 'clippingPct') {
        defaults.invert = true;
    }
    
    return {
        yellowMin: genreParams.yellowMin || defaults.yellowMin,
        bufferFactor: genreParams.bufferFactor || defaults.bufferFactor,
        severity: genreParams.severity || defaults.severity,
        hysteresis: genreParams.hysteresis || defaults.hysteresis,
        invert: defaults.invert
    };
}

// 2. FUNÇÃO PARA CALCULAR SCORE DE UMA MÉTRICA (REDIRECIONAMENTO PARA SCORING.JS)
function calculateMetricScore(actualValue, targetValue, tolerance, metricName = 'generic', options = {}) {
    // 🎯 AUDITORIA DETALHADA: Verificar disponibilidade do scoring.js
    const hasWindow = typeof window !== 'undefined';
    const hasFunction = hasWindow && typeof window.calculateMetricScore === 'function';
    const isDifferent = hasWindow && window.calculateMetricScore !== calculateMetricScore;
    const hasVersion = hasWindow && !!window.__MIX_SCORING_VERSION__;
    
    console.log('🔍 [SCORING] Auditoria de disponibilidade:', {
        hasWindow,
        hasFunction,
        isDifferent,
        hasVersion,
        version: hasWindow ? window.__MIX_SCORING_VERSION__ : 'no-window',
        functionType: hasWindow ? typeof window.calculateMetricScore : 'no-window'
    });
    
    // 🎯 CORREÇÃO: Usar a versão do scoring.js se disponível, mas evitar recursão
    if (hasWindow && hasFunction && isDifferent) {
        
        // ✅ USAR SCORING.JS GLOBAL (com ou sem versão)
        console.log('✅ [SCORING] Usando scoring.js global:', {
            version: window.__MIX_SCORING_VERSION__ || 'detected-without-version',
            hasGlobalFunction: true,
            hasVersion: !!window.__MIX_SCORING_VERSION__
        });
        return window.calculateMetricScore(actualValue, targetValue, tolerance, metricName, options);
    }
    
    // FALLBACK: Versão básica para compatibilidade (caso scoring.js não tenha carregado)
    console.warn('⚠️ FALLBACK: usando calculateMetricScore local (scoring.js não disponível)', {
        hasWindow: typeof window !== 'undefined',
        hasFunction: typeof window?.calculateMetricScore === 'function',
        hasScoringVersion: !!window?.__MIX_SCORING_VERSION__,
        isDifferent: window?.calculateMetricScore !== calculateMetricScore,
        scoringVersion: window?.__MIX_SCORING_VERSION__
    });
    
    // Parâmetros configuráveis com defaults
    const {
        yellowMin = 70,
        bufferFactor = 1.5,
        severity = null,
        invert = false,
        hysteresis = 0.2,
        previousZone = null
    } = options;
    
    // Verificar se temos valores válidos
    if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || !Number.isFinite(tolerance) || tolerance <= 0) {
        return null;
    }
    
    let diff;
    
    // Tratamento para métricas assimétricas
    if (invert) {
        diff = Math.max(0, actualValue - targetValue);
    } else {
        diff = Math.abs(actualValue - targetValue);
    }
    
    // 🟢 VERDE: Dentro da tolerância = 100 pontos
    if (diff <= tolerance) {
        return 100;
    }
    
    // Calcular distância além da tolerância
    const toleranceDistance = diff - tolerance;
    const bufferZone = tolerance * bufferFactor;
    const severityFactor = severity || (tolerance * 2);
    
    // 🟡 AMARELO: Entre tolerância e tolerância+buffer
    if (toleranceDistance <= bufferZone) {
        const ratio = toleranceDistance / bufferZone;
        return Math.round(100 - ((100 - yellowMin) * ratio));
    }
    
    // 🔴 VERMELHO: Além do buffer
    const extraDistance = toleranceDistance - bufferZone;
    const redScore = Math.max(0, yellowMin - (extraDistance / severityFactor) * yellowMin);
    
    return Math.round(redScore);
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
        const genre = refData.genre || 'default';
        const scoringParams = getScoringParameters(genre, 'lufsIntegrated');
        const score = calculateMetricScore(lufsValue, refData.lufs_target, refData.tol_lufs, scoringParams);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 LUFS: ${lufsValue} vs ${refData.lufs_target} (±${refData.tol_lufs}) = ${score}%`);
        }
    }
    
    // True Peak (importante para evitar clipping digital)
    const truePeakValue = metrics.true_peak_dbtp || tech.truePeakDbtp;
    if (Number.isFinite(truePeakValue) && Number.isFinite(refData.true_peak_target) && Number.isFinite(refData.tol_true_peak)) {
        const genre = refData.genre || 'default';
        const scoringParams = getScoringParameters(genre, 'truePeakDbtp');
        const score = calculateMetricScore(truePeakValue, refData.true_peak_target, refData.tol_true_peak, scoringParams);
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
        // DR: valores muito altos podem indicar falta de compressão (dependendo do gênero)
        // Para a maioria dos gêneros, usar comportamento padrão (simétrico)
        const score = calculateMetricScore(drValue, refData.dr_target, refData.tol_dr);
        if (score !== null) {
            scores.push(score);
            console.log(`📊 Dynamic Range: ${drValue} vs ${refData.dr_target} (±${refData.tol_dr}) = ${score}%`);
        }
    }
    
    // LRA (Loudness Range) - variação de loudness
    const lraValue = metrics.lra || tech.lra;
    if (Number.isFinite(lraValue) && Number.isFinite(refData.lra_target) && Number.isFinite(refData.tol_lra)) {
        // LRA: valores muito altos podem indicar falta de controle de dinâmica
        // Para a maioria dos gêneros, usar comportamento padrão (simétrico)
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
    console.log('🎵 Calculando Score de Frequência...');
    
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
            
            // Calcular score individual da banda usando valor, alvo e tolerância
            if (Number.isFinite(energyDb) && 
                Number.isFinite(refBandData.target_db) && 
                Number.isFinite(refBandData.tol_db)) {
                
                const score = calculateMetricScore(energyDb, refBandData.target_db, refBandData.tol_db);
                if (score !== null) {
                    scores.push(score);
                    const delta = Math.abs(energyDb - refBandData.target_db);
                    const status = delta <= refBandData.tol_db ? '✅' : '❌';
                    console.log(`🎵 ${calcBand.toUpperCase()}: ${energyDb}dB vs ${refBandData.target_db}dB (±${refBandData.tol_db}dB) = ${score}% ${status}`);
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
    
    return result;
}

// Recalcular apenas as sugestões baseadas em referência (sem reprocessar o áudio)
function updateReferenceSuggestions(analysis) {
    // 🔍 AUDITORIA: MANIPULAÇÃO DOM DETECTADA
    console.group('🔍 [AUDITORIA-FLUXO] updateReferenceSuggestions manipulando DOM');
    console.warn('[AUDITORIA-FLUXO] Esta função pode estar sobrescrevendo o sistema AI!');
    
    console.log('🔍 [DEBUG-REF] updateReferenceSuggestions chamado:', {
        hasAnalysis: !!analysis,
        hasTechnicalData: !!analysis?.technicalData,
        hasActiveRefData: !!__activeRefData,
        activeRefGenre: __activeRefGenre,
        activeRefDataKeys: __activeRefData ? Object.keys(__activeRefData) : null,
        currentGenre: window.PROD_AI_REF_GENRE
    });
    
    if (!analysis || !analysis.technicalData) {
        console.warn('🚨 [DEBUG-REF] analysis ou technicalData ausentes');
        return;
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
            console.log('🔍 [DEBUG-ENGINE] Dados sendo passados para Enhanced Engine:', {
                analysis: {
                    hasTechnicalData: !!analysis.technicalData,
                    technicalDataKeys: analysis.technicalData ? Object.keys(analysis.technicalData) : null,
                    hasSuggestions: !!analysis.suggestions,
                    suggestionsCount: analysis.suggestions?.length || 0
                },
                activeRefData: {
                    isNull: __activeRefData === null,
                    isUndefined: __activeRefData === undefined,
                    type: typeof __activeRefData,
                    keys: __activeRefData ? Object.keys(__activeRefData) : null,
                    structure: __activeRefData ? 'present' : 'missing'
                }
            });
            
            const enhancedAnalysis = window.enhancedSuggestionEngine.processAnalysis(analysis, __activeRefData);
            
            // Preservar sugestões não-referência existentes se necessário
            const existingSuggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions : [];
            const nonRefSuggestions = existingSuggestions.filter(s => {
                const type = s?.type || '';
                return !type.startsWith('reference_') && !type.startsWith('band_adjust') && !type.startsWith('heuristic_');
            });
            
            // 🎯 CORREÇÃO CRÍTICA: Aplicar ordenação determinística SEMPRE
            const allSuggestions = [...enhancedAnalysis.suggestions, ...nonRefSuggestions];
            analysis.suggestions = applyFinalDeterministicOrdering(allSuggestions);
            
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
            console.log(`🎯 [SUGGESTIONS] Total final: ${analysis.suggestions.length} sugestões (ordem determinística aplicada)`);
            
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
    
    // 🎯 FUNÇÃO DE ORDENAÇÃO DETERMINÍSTICA UNIVERSAL
    function applyFinalDeterministicOrdering(suggestions) {
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            return suggestions;
        }

        // 🎯 CONSTANTE DE PRIORIDADE TÉCNICA (conforme solicitado no pedido)
        const SUGGESTION_PRIORITY = {
            // Nível 1: CRÍTICO - True Peak deve ser sempre primeiro
            true_peak: 10,
            reference_true_peak: 10,
            reference_true_peak_critical: 10,
            reference_true_peak_warning: 10,
            heuristic_true_peak: 10,
            
            // Nível 2: LOUDNESS - Segundo mais importante
            lufs: 20,
            reference_loudness: 20,
            heuristic_lufs: 20,
            
            // Nível 3: DINÂMICA - Terceiro
            dr: 30,
            reference_dynamics: 30,
            heuristic_lra: 30,
            
            // Nível 4: LRA - Quarto
            lra: 40,
            reference_lra: 40,
            
            // Nível 5: ESTÉREO - Quinto
            stereo: 50,
            reference_stereo: 50,
            heuristic_stereo: 50,
            
            // Nível 6: BANDAS ESPECTRAIS - Por último (conforme solicitado)
            sub: 100,
            bass: 110,
            low_mid: 120,
            lowMid: 120,
            mid: 130,
            high_mid: 140,
            highMid: 140,
            presence: 150,
            presenca: 150,
            air: 160,
            brilho: 160,
            
            // Tipos de banda
            band_adjust: 170,
            reference_band_comparison: 170,
            heuristic_spectral_imbalance: 170
        };

        // 🎯 FUNÇÃO DE COMPARAÇÃO ESTÁVEL (conforme solicitado no pedido)
        function stableSuggestionSort(a, b) {
            // Normalizar metricKey/tipo para busca de prioridade
            const getMetricKey = (suggestion) => {
                return suggestion.metricKey || 
                       suggestion.type || 
                       suggestion.subtype || 
                       suggestion.band || 
                       'unknown';
            };

            const keyA = getMetricKey(a);
            const keyB = getMetricKey(b);
            
            const pa = SUGGESTION_PRIORITY[keyA] ?? 9999;
            const pb = SUGGESTION_PRIORITY[keyB] ?? 9999;
            
            // 1. Primeiro: ordenar por prioridade técnica
            if (pa !== pb) return pa - pb;
            
            // 2. Segundo: ordenar por priority numérica (mais alta primeiro)
            const priorityA = a.priority || 0;
            const priorityB = b.priority || 0;
            if (priorityA !== priorityB) return priorityB - priorityA;
            
            // 3. Terceiro: ordenar por severidade
            const severityOrder = { 'red': 1, 'orange': 2, 'yellow': 3, 'green': 4 };
            const severityA = severityOrder[a.severity?.level] || 999;
            const severityB = severityOrder[b.severity?.level] || 999;
            if (severityA !== severityB) return severityA - severityB;
            
            // 4. Quarto: ordenar alfabeticamente para estabilidade
            return (keyA || '').localeCompare(keyB || '');
        }

        // 🎯 APLICAR ORDENAÇÃO
        const orderedSuggestions = [...suggestions].sort(stableSuggestionSort);
        
        console.log('🎯 [ORDENAÇÃO] Aplicada ordenação determinística:', {
            originalCount: suggestions.length,
            orderedCount: orderedSuggestions.length,
            firstSuggestion: orderedSuggestions[0] ? {
                type: orderedSuggestions[0].type,
                metricKey: orderedSuggestions[0].metricKey,
                priority: SUGGESTION_PRIORITY[orderedSuggestions[0].type || orderedSuggestions[0].metricKey] || 'not_found'
            } : null,
            truePeakFirst: orderedSuggestions[0] && (
                orderedSuggestions[0].type?.includes('true_peak') || 
                orderedSuggestions[0].metricKey?.includes('true_peak')
            )
        });
        
        return orderedSuggestions;
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
    // 🎯 TRUE PEAK - SUGESTÕES ESPECÍFICAS E TÉCNICAS (CORREÇÃO CRÍTICA)
    const tpVal = Number.isFinite(tech.truePeakDbtp) ? tech.truePeakDbtp : null;
    if (tpVal !== null) {
        if (tpVal > 0.0) {
            // CRÍTICO: True Peak estourado
            sug.push({
                type: 'reference_true_peak_critical',
                message: `True Peak ESTOURADO: ${tpVal.toFixed(2)} dBTP (crítico para plataformas)`,
                action: `Use limiter com oversampling 4x, ceiling em -1.0 dBTP para evitar distorção digital`,
                details: `Diferença: +${(tpVal - (-1.0)).toFixed(2)} dBTP acima do seguro • Pode causar clipping em DACs • gênero: ${window.PROD_AI_REF_GENRE || 'N/A'}`,
                priority: 'high',
                technical: {
                    currentValue: tpVal,
                    targetValue: -1.0,
                    severity: 'critical',
                    recommendation: 'limiter_with_oversampling'
                }
            });
        } else if (tpVal > -1.0) {
            // ACEITÁVEL: Mas próximo do limite
            sug.push({
                type: 'reference_true_peak_warning',
                message: `True Peak aceitável mas próximo do limite: ${tpVal.toFixed(2)} dBTP`,
                action: `Considere usar limiter com ceiling em -1.5 dBTP para maior margem de segurança`,
                details: `Margem atual: ${(-1.0 - tpVal).toFixed(2)} dB até o limite • Para streaming: ideal ≤ -1.0 dBTP • gênero: ${window.PROD_AI_REF_GENRE || 'N/A'}`,
                priority: 'medium',
                technical: {
                    currentValue: tpVal,
                    targetValue: -1.0,
                    severity: 'medium',
                    recommendation: 'conservative_limiting'
                }
            });
        }
        // Se tpVal <= -1.0, não gerar sugestão (está ideal)
    }
    addRefSug(tech.dynamicRange, ref.dr_target, ref.tol_dr, 'reference_dynamics', 'DR', ' dB');
    if (Number.isFinite(tech.lra)) addRefSug(tech.lra, ref.lra_target, ref.tol_lra, 'reference_lra', 'LRA', ' LU');
    if (Number.isFinite(tech.stereoCorrelation)) addRefSug(tech.stereoCorrelation, ref.stereo_target, ref.tol_stereo, 'reference_stereo', 'Stereo Corr', '');
    
    console.log(`🎯 [SUGGESTIONS] Sistema legado: ${sug.length} sugestões geradas`);
    
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
        
        // � [REFATORACAO] RENDERIZAÇÃO DOM DESATIVADA - Usando fluxo AI unificado
        console.debug('[REFATORACAO] updateReferenceSuggestions - DOM direto desativado');
        console.debug('[REFATORACAO] referenceSuggestions processadas mas não renderizadas:', {
            length: referenceSuggestions?.length || 0,
            types: referenceSuggestions?.map(s => s.category || s.type) || [],
            redirectTo: 'Fluxo AI (displaySuggestions + renderFullSuggestions)'
        });
        
        // DADOS PROCESSADOS: Manter para compatibilidade, mas não renderizar DOM
        if (referenceSuggestions && referenceSuggestions.length > 0) {
            console.debug('[REFATORACAO] Sugestões disponíveis para fluxo AI:', referenceSuggestions.length);
            // DOM será atualizado pelo sistema AI via displaySuggestions()
        } else {
            console.debug('[REFATORACAO] Nenhuma sugestão - AI renderizará placeholder');
            // AI renderizará mensagem adequada
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
 * 🔧 NOVA FUNÇÃO: Normalizar dados do backend para compatibilidade com front-end
 * Mapeia a resposta do backend Railway para o formato que o front-end espera
 */
function normalizeBackendAnalysisData(backendData) {
    console.log('🔧 [NORMALIZE] Iniciando normalização dos dados do backend:', backendData);
    
    // Se já está no formato correto, retornar como está
    if (backendData.technicalData && backendData.technicalData.peak !== undefined) {
        console.log('📊 [NORMALIZE] Dados já estão normalizados');
        return backendData;
    }
    
    // Criar estrutura normalizada - SEM FALLBACKS FICTÍCIOS
    const normalized = {
        ...backendData,
        technicalData: backendData.technicalData || {},
        problems: backendData.problems || [],
        suggestions: backendData.suggestions || [],
        duration: backendData.duration || null,
        sampleRate: backendData.sampleRate || null,
        channels: backendData.channels || null
    };
    
    // 🎯 MAPEAR MÉTRICAS BÁSICAS - SEM FALLBACKS FICTÍCIOS
    const tech = normalized.technicalData;
    const source = backendData.technicalData || backendData.metrics || backendData;
    
    console.log('🔍 [NORMALIZE] Dados de origem recebidos:', source);
    console.log('🔍 [NORMALIZE] Estrutura completa do backend:', backendData);
    
    // 🎯 ALIAS MAP - Mapeamento de nomes divergentes de métricas
    const aliasMap = {
        // Métricas principais
        'dr': ['dynamic_range', 'dynamicRange'],
        'lra': ['loudness.lra', 'loudnessRange', 'lra_tolerance', 'loudness_range'],
        'crestFactor': ['dynamics.crest', 'crest_factor'],
        'truePeakDbtp': ['truePeak.maxDbtp', 'true_peak_dbtp', 'truePeak'],
        'lufsIntegrated': ['loudness.integrated', 'lufs_integrated', 'lufs'],
        
        // Bandas espectrais - normalização de nomes
        'low_mid': ['lowMid', 'low_mid', 'lowmid'],
        'high_mid': ['highMid', 'high_mid', 'highmid'],
        'presenca': ['presence', 'presenca'],
        'brilho': ['air', 'brilho', 'treble', 'high'],
        'low_bass': ['bass', 'low_bass', 'lowBass'],
        'upper_bass': ['bass', 'low_bass', 'upper_bass', 'upperBass'], // upper_bass → bass como fallback
        'sub': ['sub', 'subBass', 'sub_bass'],
        'mid': ['mid', 'mids', 'middle']
    };
    
    // Função para pegar valor real ou null (sem fallbacks fictícios) + suporte a alias
    const getRealValue = (...paths) => {
        for (const path of paths) {
            const value = path.split('.').reduce((obj, key) => obj?.[key], source);
            if (Number.isFinite(value)) {
                return value;
            }
            // NOVO: Também verificar na estrutura raiz do backendData
            const rootValue = path.split('.').reduce((obj, key) => obj?.[key], backendData);
            if (Number.isFinite(rootValue)) {
                return rootValue;
            }
            
            // 🎯 NOVO: Verificar alias se não encontrou valor direto
            if (aliasMap[path]) {
                for (const aliasPath of aliasMap[path]) {
                    const aliasValue = aliasPath.split('.').reduce((obj, key) => obj?.[key], source);
                    if (Number.isFinite(aliasValue)) {
                        console.log(`🔄 [ALIAS] ${path} → ${aliasPath}: ${aliasValue}`);
                        return aliasValue;
                    }
                    // Verificar alias na estrutura raiz também
                    const rootAliasValue = aliasPath.split('.').reduce((obj, key) => obj?.[key], backendData);
                    if (Number.isFinite(rootAliasValue)) {
                        console.log(`🔄 [ALIAS] ${path} → ${aliasPath}: ${rootAliasValue}`);
                        return rootAliasValue;
                    }
                }
            }
        }
        return null; // Retorna null se não há valor real
    };
    
    // Peak e RMS - APENAS VALORES REAIS
    tech.peak = getRealValue('peak', 'peak_db', 'peakLevel');
    tech.rms = getRealValue('rms', 'rms_db', 'rmsLevel');
    tech.rmsLevel = tech.rms;
    
    // Dynamic Range - APENAS VALORES REAIS
    tech.dynamicRange = getRealValue('dynamicRange', 'dynamic_range', 'dr');
    
    // Crest Factor - APENAS VALORES REAIS
    tech.crestFactor = getRealValue('crestFactor', 'crest_factor');
    
    // True Peak - CORRIGIR MAPEAMENTO PARA NOVA ESTRUTURA
    tech.truePeakDbtp = getRealValue('truePeakDbtp', 'true_peak_dbtp', 'truePeak') || 
                       (backendData.truePeak?.maxDbtp && Number.isFinite(backendData.truePeak.maxDbtp) ? backendData.truePeak.maxDbtp : null);
    
    // LUFS - CORRIGIR MAPEAMENTO PARA NOVA ESTRUTURA
    tech.lufsIntegrated = getRealValue('lufsIntegrated', 'lufs_integrated', 'lufs') ||
                         (backendData.loudness?.integrated && Number.isFinite(backendData.loudness.integrated) ? backendData.loudness.integrated : null);
    
    tech.lufsShortTerm = getRealValue('lufsShortTerm', 'lufs_short_term') ||
                        (backendData.loudness?.shortTerm && Number.isFinite(backendData.loudness.shortTerm) ? backendData.loudness.shortTerm : null);
    
    tech.lufsMomentary = getRealValue('lufsMomentary', 'lufs_momentary') ||
                        (backendData.loudness?.momentary && Number.isFinite(backendData.loudness.momentary) ? backendData.loudness.momentary : null);
    
    // LRA - CORRIGIR MAPEAMENTO PARA NOVA ESTRUTURA + MÚLTIPLOS ALIASES
    tech.lra = getRealValue('lra', 'loudnessRange', 'lra_tolerance', 'loudness_range') ||
              (backendData.loudness?.lra && Number.isFinite(backendData.loudness.lra) ? backendData.loudness.lra : null) ||
              (backendData.lra && Number.isFinite(backendData.lra) ? backendData.lra : null);
    
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
    
    // 🎯 LOG ESPECÍFICO PARA AUDITORIA: LRA
    if (tech.lra !== null) {
        console.log('✅ [LRA] SUCESSO: LRA mapeado corretamente =', tech.lra);
    } else {
        console.warn('❌ [LRA] PROBLEMA: LRA não foi encontrado no backend data');
        console.log('🔍 [LRA] Debug - backend data:', backendData);
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
    
    // 🎵 SPECTRAL BALANCE - Mapear dados espectrais REAIS
    if (source.spectral_balance || source.spectralBalance || source.bands) {
        const spectralSource = source.spectral_balance || source.spectralBalance || source.bands || {};
        
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
        
        // 🎯 LOG ESPECÍFICO PARA AUDITORIA: BANDAS ESPECTRAIS
        const bandasDetectadas = Object.entries(tech.spectral_balance)
            .filter(([key, value]) => value !== null)
            .map(([key, value]) => `${key}: ${value}`);
        
        if (bandasDetectadas.length > 0) {
            console.log(`✅ [BANDAS] SUCESSO: ${bandasDetectadas.length} bandas mapeadas:`, bandasDetectadas.join(', '));
        } else {
            console.warn('❌ [BANDAS] PROBLEMA: Nenhuma banda espectral foi mapeada');
        }
    } else {
        // Não definir se não há dados reais
        tech.spectral_balance = null;
        console.log('⚠️ [NORMALIZE] Nenhum dado espectral real encontrado - spectral_balance = null');
    }
    
    // 🎶 BAND ENERGIES - Mapear energias das bandas de frequência REAIS
    if (source.bandEnergies || source.band_energies || source.bands) {
        const bandsSource = source.bandEnergies || source.band_energies || source.bands || {};
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
