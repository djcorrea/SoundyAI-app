// 🎵 AUDIO ANALYZER INTEGRATION
// Conecta o sistema de análise de áudio com o chat existente

// 📝 Carregar gerador de texto didático
if (typeof window !== 'undefined' && !window.SuggestionTextGenerator) {
    const script = document.createElement('script');
    script.src = 'suggestion-text-generator.js';
    script.async = true;
    script.onload = () => {
        log('[AudioIntegration] Gerador de texto didático carregado');
    };
    script.onerror = () => {
        warn('[AudioIntegration] Falha ao carregar gerador de texto didático');
    };
    document.head.appendChild(script);
}

// Debug flag (silencia logs em produção; defina window.DEBUG_ANALYZER = true para habilitar)
const __DEBUG_ANALYZER__ = true; // 🔧 TEMPORÁRIO: Ativado para debug do problema
const __dbg = (...a) => { if (__DEBUG_ANALYZER__) log('[AUDIO-DEBUG]', ...a); };
const __dwrn = (...a) => { if (__DEBUG_ANALYZER__) warn('[AUDIO-WARN]', ...a); };

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

// 🎯 Funções de Acessibilidade e Gestão de Modais

// 📊 CORREÇÃO: Contador Visual de Problemas
// Garante que contador sempre corresponde ao que usuário vê na interface
function countVisualProblems(analysis) {
    if (!analysis || !analysis.technicalData) {
        return { count: 0, problems: [], breakdown: { critical: 0, warning: 0 } };
    }

    const problemMetrics = [];
    const technicalData = analysis.technicalData;
    
    // Caregar referências do gênero atual para tolerâncias
    const refData = window.__activeRefData || {};
    const defaultTolerances = {
        lufs: 1.0,
        truePeak: 1.0,
        dynamicRange: 3.0,
        stereoCorrelation: 0.15
    };

    // 1. LUFS Integration - Verificar se está fora da tolerância
    if (Number.isFinite(technicalData.lufsIntegrated)) {
        const lufsTarget = refData.lufs_target || -14;
        const lufsTolerance = refData.lufs_tolerance || defaultTolerances.lufs;
        const lufsDiff = Math.abs(technicalData.lufsIntegrated - lufsTarget);
        
        if (lufsDiff > lufsTolerance) {
            const severity = lufsDiff > (lufsTolerance * 2) ? 'critical' : 'warning';
            problemMetrics.push({
                metric: 'LUFS',
                value: technicalData.lufsIntegrated,
                target: lufsTarget,
                tolerance: lufsTolerance,
                diff: lufsDiff,
                severity,
                issue: technicalData.lufsIntegrated > lufsTarget ? 
                       'Muito alto - pode causar limitação' : 
                       'Muito baixo - falta presença'
            });
        }
    }

    // 2. True Peak - Verificar clipping ou risco de clipping
    if (Number.isFinite(technicalData.truePeakDbtp)) {
        const truePeakTarget = refData.true_peak_target || -1;
        const truePeakTolerance = refData.true_peak_tolerance || defaultTolerances.truePeak;
        
        if (technicalData.truePeakDbtp > truePeakTarget + truePeakTolerance) {
            const severity = technicalData.truePeakDbtp > 0 ? 'critical' : 'warning';
            problemMetrics.push({
                metric: 'True Peak',
                value: technicalData.truePeakDbtp,
                target: truePeakTarget,
                tolerance: truePeakTolerance,
                severity,
                issue: technicalData.truePeakDbtp > 0 ? 
                       'CLIPPING DETECTADO' : 
                       'Risco de clipping'
            });
        }
    }

    // 3. Dynamic Range - Verificar compressão excessiva
    if (Number.isFinite(technicalData.dynamicRange)) {
        const drTarget = refData.dynamic_range_target || 10;
        const drTolerance = refData.dynamic_range_tolerance || defaultTolerances.dynamicRange;
        
        if (technicalData.dynamicRange < (drTarget - drTolerance)) {
            const severity = technicalData.dynamicRange < 4 ? 'critical' : 'warning';
            problemMetrics.push({
                metric: 'Dynamic Range',
                value: technicalData.dynamicRange,
                target: drTarget,
                tolerance: drTolerance,
                severity,
                issue: 'Compressão excessiva - som "achatado"'
            });
        }
    }

    // 4. Stereo Correlation - Verificar problemas mono/phase
    if (Number.isFinite(technicalData.stereoCorrelation)) {
        const correlationTarget = refData.stereo_correlation_target || 0.5;
        const correlationTolerance = refData.stereo_correlation_tolerance || defaultTolerances.stereoCorrelation;
        
        const correlationDiff = Math.abs(technicalData.stereoCorrelation - correlationTarget);
        if (correlationDiff > correlationTolerance) {
            problemMetrics.push({
                metric: 'Stereo Width',
                value: technicalData.stereoCorrelation,
                target: correlationTarget,
                tolerance: correlationTolerance,
                severity: 'warning',
                issue: technicalData.stereoCorrelation > 0.9 ? 
                       'Muito mono' : 
                       'Possível problema de fase'
            });
        }
    }

    // 5. Verificar problemas críticos detectados pelo engine (manter compatibilidade)
    if (analysis.problems && Array.isArray(analysis.problems)) {
        analysis.problems.forEach(problem => {
            if (problem.severity === 'critical' || problem.type === 'clipping') {
                problemMetrics.push({
                    metric: problem.metric || 'Detectado',
                    severity: 'critical',
                    issue: problem.description || problem.message || 'Problema crítico detectado',
                    fromEngine: true
                });
            }
        });
    }

    const breakdown = {
        critical: problemMetrics.filter(p => p.severity === 'critical').length,
        warning: problemMetrics.filter(p => p.severity === 'warning').length
    };

    // Debug log para rastreamento
    if (window.DEBUG_AUDIO_ANALYSIS) {
        log('🔍 Problem Count Fix - Visual Count:', {
            totalCount: problemMetrics.length,
            breakdown,
            originalProblemsArray: analysis.problems ? analysis.problems.length : 0,
            problems: problemMetrics
        });
    }

    return {
        count: problemMetrics.length,
        problems: problemMetrics,
        breakdown,
        note: problemMetrics.length > 0 ? 
              `${breakdown.critical} críticos, ${breakdown.warning} avisos` : 
              'Nenhum problema detectado'
    };
}

// 🌐 Anexar função ao escopo global para acesso externo
if (typeof window !== 'undefined') {
    window.countVisualProblems = countVisualProblems;
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

// 🎯 Seleção de Arquivos para Modo Referência
let uploadedFiles = {
    original: null,
    reference: null
};

function handleReferenceFileSelection(type) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav,.flac,.mp3';
    input.style.display = 'none';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validar arquivo
            if (file.size > 60 * 1024 * 1024) { // 60MB
                alert('❌ Arquivo muito grande. Limite: 60MB');
                return;
            }
            
            uploadedFiles[type] = file;
            log(`✅ Arquivo ${type} selecionado:`, file.name);
            
            // Atualizar interface
            updateFileStatus(type, file.name);
            
            // Avançar para próximo passo
            if (type === 'original') {
                updateProgressStep(2);
                promptReferenceFile();
            } else if (type === 'reference') {
                updateProgressStep(3);
                enableAnalysisButton();
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
        // Preparar FormData
        const formData = new FormData();
        formData.append('originalFile', uploadedFiles.original);
        formData.append('referenceFile', uploadedFiles.reference);
        formData.append('mode', 'reference');
        
        // Mostrar loading
        showAnalysisProgress();
        
        // Enviar para API
        const response = await fetch('/api/audio/analyze', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Erro na análise: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Exibir resultados
        displayReferenceComparison(result);
        
    } catch (error) {
        error('❌ Erro na análise:', error);
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
                <span class="label">Dinâmica:</span>
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
    log('🔄 FORÇA RECARGA DE REFERÊNCIAS:', genre);
    
    // Limpar tudo
    delete window.__refDataCache;
    window.__refDataCache = {};
    window.REFS_BYPASS_CACHE = true;
    window.__activeRefData = null;
    window.__activeRefGenre = null;
    delete window.PROD_AI_REF_DATA;
    
    log('💥 Cache limpo, forçando reload...');
    
    try {
        const result = await loadReferenceData(genre);
        log('✅ Recarga forçada concluída:', {
            version: result.version,
            lufs_target: result.lufs_target,
            true_peak_target: result.true_peak_target,
            presenca_band: result.bands?.presenca?.target_db
        });
        
        // Resetar flag
        window.REFS_BYPASS_CACHE = false;
        return result;
    } catch (error) {
        error('💥 Erro na recarga forçada:', error);
        window.REFS_BYPASS_CACHE = false;
        throw error;
    }
};

// 🔍 Função de Diagnóstico de Referências (somente dev)
window.diagnosRefSources = function(genre = null) {
    const targetGenre = genre || __activeRefGenre || 'funk_bruxaria';
    const currentData = __activeRefData;
    const cached = __refDataCache[targetGenre];
    
    log('🎯 REFERÊNCIAS DIAGNÓSTICO COMPLETO:', {
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
    const testUrl = `/refs/out/${targetGenre}.json?v=diagnostic`;
    fetch(testUrl).then(r => r.json()).then(j => {
        const data = j[targetGenre];
        log('🌐 EXTERNAL JSON TEST:', {
            url: testUrl,
            success: true,
            version: data?.version,
            num_tracks: data?.num_tracks,
            lufs_target: data?.lufs_target,
            true_peak_target: data?.true_peak_target,
            stereo_target: data?.stereo_target
        });
    }).catch(e => log('❌ EXTERNAL JSON FAILED:', testUrl, e.message));
    
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
        if (window.DEBUG_ANALYZER) warn('[METRIC_ANOMALY]', kind, key, context);
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
    } catch (e) { warn('[refEnrich] falha', e); }
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
        trance: { lufs_target: -14, tol_lufs: 0.5, true_peak_target: -7.26, tol_true_peak: 1.14, dr_target: 9.4, tol_dr: 0.8, lra_target: 10.7, tol_lra: 2.7, stereo_target: 0.17, tol_stereo: 0.03, bands: { sub:{target_db:-17.3,tol_db:2.5}, low_bass:{target_db:-14.6,tol_db:4.3}, upper_bass:{target_db:-14.8,tol_db:2.5}, low_mid:{target_db:-12.6,tol_db:3.7}, mid:{target_db:-12,tol_db:4.0}, high_mid:{target_db:-20.2,tol_db:3.6}, brilho:{target_db:-24.7,tol_db:2.5}, presenca:{target_db:-32.1,tol_db:3.6} } },
    // Perfil atualizado Funk Mandela 2025-08-fixed-flex.1 - REPROCESSADO 23/08/2025
    funk_mandela:   { 
        version: "2025-08-fixed-flex.2", 
        lufs_target: -8, tol_lufs: 1, tol_lufs_min: 1, tol_lufs_max: 1, 
        true_peak_target: -10.9, tol_true_peak: 2.0, true_peak_streaming_max: -10.9, true_peak_baile_max: 0.0, 
        dr_target: 8, tol_dr: 1, 
        lra_target: 9.9, lra_min: 7.6, lra_max: 12.2, tol_lra: 2.3, 
        stereo_target: 0.6, tol_stereo: 0.2, stereo_width_mids_highs_tolerance: "wide", 
        low_end_mono_cutoff: 100, clipping_sample_pct_max: 0.02, vocal_band_min_delta: -1.5,
        fixed: {
            lufs: { integrated: { target: -8.0, tolerance: 1.0 } },
            rms: { policy: "deriveFromLUFS" },
            truePeak: { streamingMax: -10.9, baileMax: 0.0 },
            dynamicRange: { dr: { target: 8.0, tolerance: 1.0 } },
            lowEnd: { mono: { cutoffHz: 100 } },
            vocalPresence: { bandHz: [1000, 4000], vocalBandMinDeltaDb: -1.5 }
        },
        flex: {
            clipping: { samplePctMax: 0.02 },
            lra: { min: 7.6, max: 12.2 },
            stereo: { width: { midsHighsTolerance: "wide" } }
        },
        pattern_rules: { 
            hard_constraints: ["lufs", "truePeak", "dynamicRange", "lowEnd", "vocalPresence"], 
            soft_constraints: ["clipping", "lra", "stereo", "tonalCurve"] 
        }, 
        bands: { 
            sub:{target_db:-6.7,tol_db:3.0,severity:"soft"}, 
            low_bass:{target_db:-8.0,tol_db:2.5,severity:"soft"}, 
            upper_bass:{target_db:-12.0,tol_db:2.5,severity:"soft"}, 
            low_mid:{target_db:-8.4,tol_db:2.0,severity:"soft"}, 
            mid:{target_db:-6.3,tol_db:2.0,severity:"hard",vocal_presence_range:true}, 
            high_mid:{target_db:-11.2,tol_db:2.5,severity:"soft"}, 
            brilho:{target_db:-14.8,tol_db:3.0,severity:"soft"}, 
            presenca:{target_db:-19.2,tol_db:3.5,severity:"hard",vocal_presence_range:true} 
        } 
    },
        funk_bruxaria: { 
            version: "1.0.1",
            generated_at: "2025-08-23T18:03:37.143Z",
            num_tracks: 29,
            lufs_target: -14,
            tol_lufs: 0.5,
            true_peak_target: -10.6,
            tol_true_peak: 1.27,
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
        funk_automotivo:{ lufs_target: -8,  tol_lufs: 1.2, true_peak_target: -9.58, tol_true_peak: 2.5, dr_target: 8.1, tol_dr: 2.0, lra_target: 6.6, tol_lra: 4.0, stereo_target: 0.3, tol_stereo: 0.15, bands: { sub:{target_db:-7.6,tol_db:6.0}, low_bass:{target_db:-6.6,tol_db:4.5}, upper_bass:{target_db:-11.4,tol_db:3.5}, low_mid:{target_db:-8.2,tol_db:3.5}, mid:{target_db:-6.7,tol_db:3.0}, high_mid:{target_db:-12.8,tol_db:4.5}, brilho:{target_db:-16.6,tol_db:4.5}, presenca:{target_db:-22.7,tol_db:5.0} } },
        eletronico:     { 
            version: "1.0.1",
            lufs_target: -14, tol_lufs: 0.5, tol_lufs_min: 0.5, tol_lufs_max: 0.5,  
            true_peak_target: -7.79, tol_true_peak: 1.57, true_peak_streaming_max: -7.79, true_peak_baile_max: 0.0,
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
    } catch (e) { if (window.DEBUG_ANALYZER) warn('buildAggregatedRefStats fail', e); }
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
            if (__DEBUG_ANALYZER__) log('[refs] tentando fetch:', url);
            const res = await fetch(url, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            if (res.ok) {
                if (__DEBUG_ANALYZER__) log('[refs] OK:', p);
                
                // Verificar se a resposta tem conteúdo JSON válido
                const text = await res.text();
                if (text.trim()) {
                    try {
                        return JSON.parse(text);
                    } catch (jsonError) {
                        warn('[refs] JSON inválido em', p, ':', text.substring(0, 100));
                        throw new Error(`JSON inválido em ${p}`);
                    }
                } else {
                    warn('[refs] Resposta vazia em', p);
                    throw new Error(`Resposta vazia em ${p}`);
                }
            } else {
                if (__DEBUG_ANALYZER__) warn('[refs] Falha', res.status, 'em', p);
                lastErr = new Error(`HTTP ${res.status} @ ${p}`);
            }
        } catch (e) {
            if (__DEBUG_ANALYZER__) warn('[refs] Erro fetch', p, e?.message || e);
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
                `/refs/out/genres.json`,
                `/public/refs/out/genres.json`,
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
        
        log('🔍 DEBUG loadReferenceData início:', { genre, bypassCache });
        
        // PRIORIDADE CORRIGIDA: external > embedded > fallback
        // 1) Tentar carregar JSON externo primeiro (sempre, independente de REFS_ALLOW_NETWORK)
        log('🌐 Tentando carregar JSON externo primeiro...');
        try {
            const version = __refDataCache[genre]?.version || 'force';
            const json = await fetchRefJsonWithFallback([
                `/refs/out/${genre}.json?v=${version}`,
                `/public/refs/out/${genre}.json?v=${version}`,
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
                log('🎯 REFS DIAGNOSTIC:', {
                    genre,
                    source: 'external',
                    path: `/refs/out/${genre}.json`,
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
            log('❌ External refs failed:', netError.message);
            log('🔄 Fallback para embedded refs...');
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
            log('🎯 REFS DIAGNOSTIC:', {
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
            log('⚠️ Using legacy REFS_ALLOW_NETWORK path - should not happen with new logic');
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
            log('🎯 REFS DIAGNOSTIC:', {
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
        warn('Falha ao carregar referências', genre, e);
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
    // Carregar refs e, se já houver análise no modal, atualizar sugestões de referência e re-renderizar
    return loadReferenceData(genre).then(() => {
        try {
            if (typeof currentModalAnalysis === 'object' && currentModalAnalysis) {
                // Recalcular sugestões reference_* com as novas tolerâncias
                try { updateReferenceSuggestions(currentModalAnalysis); } catch(e) { warn('updateReferenceSuggestions falhou', e); }
                // Re-renderização completa para refletir sugestões e comparações
                try { displayModalResults(currentModalAnalysis); } catch(e) { warn('re-render modal falhou', e); }
            }
        } catch (e) { warn('re-render comparação falhou', e); }
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
            const res = await window.audioAnalyzer.analyzeAudioFile(file);
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
if (typeof window !== 'undefined' && !window.__runAcceptanceAudioTests) {
    window.__runAcceptanceAudioTests = async function(opts = {}) {
        if (window.ACCEPTANCE_TEST_MODE !== true) {
            warn('Acceptance test mode desativado. Defina window.ACCEPTANCE_TEST_MODE = true antes de chamar.');
            return { skipped: true };
        }
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const sr = ctx.sampleRate;
        const makeBuffer = (seconds, channels=2) => ctx.createBuffer(channels, Math.max(1, Math.floor(sr*seconds)), sr);
        const toDb = v => v>0?20*Math.log10(v):-Infinity;
        const results = [];
        // 1. Silêncio 5s
        const bufSilence = makeBuffer(5,2); // já zero
        results.push({ name:'silence', analysis: await window.audioAnalyzer.analyzeAudioBufferDirect(bufSilence,'silence') });
        // 2. Seno 1kHz -12dBFS 10s
        const bufSine = makeBuffer(10,2); (['L','R']).forEach((_,ch)=>{ const chData = bufSine.getChannelData(ch); for(let i=0;i<chData.length;i++){ chData[i] = Math.sin(2*Math.PI*1000*i/sr)*Math.pow(10,-12/20); } });
        results.push({ name:'sine_1k_-12dBFS', analysis: await window.audioAnalyzer.analyzeAudioBufferDirect(bufSine,'sine') });
        // 3. Ruído rosa approx -14 LUFS (gerar ruído branco filtrado + normalizar)
        const bufPink = makeBuffer(10,2); for (let ch=0; ch<2; ch++){ const d=bufPink.getChannelData(ch); let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0; for(let i=0;i<d.length;i++){ const white=Math.random()*2-1; b0=0.99886*b0+white*0.0555179; b1=0.99332*b1+white*0.0750759; b2=0.96900*b2+white*0.1538520; b3=0.86650*b3+white*0.3104856; b4=0.55000*b4+white*0.5329522; b5=-0.7616*b5-white*0.0168980; const pink = b0+b1+b2+b3+b4+b5+b6+white*0.5362; b6=white*0.115926; d[i]=pink*0.11; } }
        // leve normalização amplitude
        results.push({ name:'pink_noise_target', analysis: await window.audioAnalyzer.analyzeAudioBufferDirect(bufPink,'pink') });
        // 4. Quase clipado (TP ≈ -0.1dB) -> seno 60Hz amplo -0.1
        const bufAlmost = makeBuffer(5,2); const ampAlmost = Math.pow(10, -0.1/20); for (let ch=0; ch<2; ch++){ const d=bufAlmost.getChannelData(ch); for(let i=0;i<d.length;i++){ d[i]= Math.sin(2*Math.PI*60*i/sr)*ampAlmost; } }
        results.push({ name:'almost_clipped', analysis: await window.audioAnalyzer.analyzeAudioBufferDirect(bufAlmost,'almostClip') });
        // 5. Clipado (samples >= 1.0)
        const bufClipped = makeBuffer(2,2); for (let ch=0; ch<2; ch++){ const d=bufClipped.getChannelData(ch); for(let i=0;i<d.length;i++){ const v=Math.sin(2*Math.PI*80*i/sr)*1.2; d[i]= Math.max(-1, Math.min(1, v)); } }
        results.push({ name:'clipped', analysis: await window.audioAnalyzer.analyzeAudioBufferDirect(bufClipped,'clipped') });
        // 6. Estéreo desequilibrado (L -3 dB, R 0 dB)
        const bufImbalance = makeBuffer(5,2); const gainL = Math.pow(10,-3/20), gainR = 1; for(let i=0;i<bufImbalance.length;i++){ const t=i/sr; const s=Math.sin(2*Math.PI*440*t); bufImbalance.getChannelData(0)[i]=s*gainL; bufImbalance.getChannelData(1)[i]=s*gainR; }
        results.push({ name:'stereo_imbalance', analysis: await window.audioAnalyzer.analyzeAudioBufferDirect(bufImbalance,'stereoImbalance') });
        // === Avaliação de critérios ===
        const evals = [];
        const approx = (val, target, tol) => Number.isFinite(val) && Math.abs(val - target) <= tol;
        for (const r of results) {
            const td = r.analysis?.technicalData || {};
            if (r.name==='silence') {
                evals.push({ case:'silence_lufs', pass: !Number.isFinite(td.lufsIntegrated) || td.lufsIntegrated < -100, observed: td.lufsIntegrated });
                evals.push({ case:'silence_tp', pass: !Number.isFinite(td.truePeakDbtp) || td.truePeakDbtp <= -90, observed: td.truePeakDbtp });
                evals.push({ case:'silence_lra', pass: !Number.isFinite(td.lra) || td.lra <= 0.1, observed: td.lra });
            }
            if (r.name==='sine_1k_-12dBFS') {
                evals.push({ case:'sine_peak', pass: approx(td.truePeakDbtp ?? td.peak, -12, 0.6), observed: td.truePeakDbtp ?? td.peak });
                if (Number.isFinite(td.truePeakDbtp) && Number.isFinite(td.headroomTruePeakDb)) {
                    evals.push({ case:'sine_headroom_match', pass: approx(td.headroomTruePeakDb, -td.truePeakDbtp, 0.11), observed: td.headroomTruePeakDb });
                }
                if (Number.isFinite(td.lufsIntegrated)) evals.push({ case:'sine_lufs', pass: approx(td.lufsIntegrated, -12, 0.7), observed: td.lufsIntegrated });
                evals.push({ case:'sine_lra', pass: (td.lra??0) <= 0.6, observed: td.lra });
            }
            if (r.name==='pink_noise_target') {
                if (Number.isFinite(td.lufsIntegrated)) evals.push({ case:'pink_lufs', pass: Math.abs(td.lufsIntegrated + 14) <= 1.0, observed: td.lufsIntegrated });
                if (Number.isFinite(td.lufsShortTerm) && Number.isFinite(td.lufsIntegrated)) evals.push({ case:'pink_st_integrated_gap', pass: Math.abs(td.lufsShortTerm - td.lufsIntegrated) <= 0.5, observed: td.lufsShortTerm - td.lufsIntegrated });
            }
            if (r.name==='almost_clipped') {
                if (Number.isFinite(td.truePeakDbtp)) evals.push({ case:'almost_headroom', pass: approx(td.headroomTruePeakDb, -td.truePeakDbtp, 0.11), observed: td.headroomTruePeakDb });
                const hasClipProb = (r.analysis.problems||[]).some(p=>p.type==='clipping');
                evals.push({ case:'almost_no_clip_problem', pass: !hasClipProb, observed: hasClipProb });
            }
            if (r.name==='clipped') {
                const hasClipProb = (r.analysis.problems||[]).some(p=>p.type==='clipping');
                evals.push({ case:'clipped_problem_present', pass: hasClipProb, observed: hasClipProb });
                if (Number.isFinite(td.truePeakDbtp)) evals.push({ case:'clipped_tp_non_negative', pass: td.truePeakDbtp >= -0.05, observed: td.truePeakDbtp });
            }
            if (r.name==='stereo_imbalance') {
                if (Number.isFinite(td.balanceLR)) evals.push({ case:'stereo_balance_sign', pass: td.balanceLR < 0, observed: td.balanceLR });
            }
        }
        const summary = { results: results.map(r=>({ name:r.name, tp:r.analysis?.technicalData?.truePeakDbtp, lufs:r.analysis?.technicalData?.lufsIntegrated, headroom:r.analysis?.technicalData?.headroomTruePeakDb, lra:r.analysis?.technicalData?.lra, balance:r.analysis?.technicalData?.balanceLR })), evals, pass: evals.every(e=>e.pass) };
        if (window.DEBUG_ANALYZER) log('ACCEPTANCE TEST SUMMARY', summary);
        return summary;
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
        error('Modal de seleção de modo não encontrado');
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
    
    const modal = document.getElementById('audioAnalysisModal');
    if (!modal) {
        error('Modal de análise não encontrado');
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
        
        // Processar baseado no modo de análise
        if (currentAnalysisMode === 'reference') {
            await handleReferenceFileSelection(file);
        } else {
            await handleGenreFileSelection(file);
        }
        
    } catch (error) {
        error('❌ Erro na análise do modal:', error);
        
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
                handleGenreFileSelection(file);
            }, 2000);
        } else {
            showModalError(`Erro ao analisar arquivo: ${error.message}`);
        }
    } finally {
        // 🔧 CORREÇÃO: Sempre limpar flag de análise em progresso
        if (typeof window !== 'undefined') {
            delete window.__MODAL_ANALYSIS_IN_PROGRESS__;
        }
        __dbg('✅ Flag de análise em progresso removida');
    }
}

// 🎯 NOVO: Validação comum de arquivo
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
    
    // Mostrar recomendação para MP3
    if (file.type === 'audio/mpeg' || file.type === 'audio/mp3' || file.name.toLowerCase().endsWith('.mp3')) {
        log('💡 MP3 detectado - Recomendação: Use WAV ou FLAC para maior precisão');
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
        log('🔍 [DIAGNÓSTICO] Analisando USER audio em modo referência');
        log('🔍 [DIAGNÓSTICO] Current mode:', window.currentAnalysisMode);
        log('🔍 [DIAGNÓSTICO] Genre ativo antes da análise:', window.PROD_AI_REF_GENRE);
        log('🔍 [DIAGNÓSTICO] Active ref data:', !!__activeRefData);
        
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
        const analysis = await window.audioAnalyzer.analyzeAudioFile(file, userAnalysisOptions);
        
        // 🐛 VALIDAÇÃO: Verificar que não há comparação com gênero
        if (analysis.comparison || analysis.mixScore) {
          warn('⚠️ [AVISO] Análise do usuário contaminada com comparação/score');
        }
        
        log('🔍 [DIAGNÓSTICO] User analysis (pura):', {
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
        log('🔍 [DIAGNÓSTICO] Analisando REFERENCE audio em modo referência');
        log('🔍 [DIAGNÓSTICO] Current mode:', window.currentAnalysisMode);
        log('🔍 [DIAGNÓSTICO] Genre ativo antes da análise:', window.PROD_AI_REF_GENRE);
        
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
        const analysis = await window.audioAnalyzer.analyzeAudioFile(file, refAnalysisOptions);
        
        // 🐛 VALIDAÇÃO: Verificar que não há comparação com gênero
        if (analysis.comparison || analysis.mixScore) {
          warn('⚠️ [AVISO] Análise da referência contaminada com comparação/score');
        }
        
        log('🔍 [DIAGNÓSTICO] Reference analysis (pura):', {
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
        
        log('✅ [SUCESSO] Métricas da referência extraídas:', referenceMetrics);
        
        referenceStepState.referenceAnalysis = analysis;
        referenceStepState.referenceMetrics = referenceMetrics;
        
        // Executar comparação
        updateReferenceStep('analysis');
        await performReferenceComparison();
        
        // 🎯 EXIBIR resultados da análise por referência
        const finalAnalysis = referenceStepState.finalAnalysis;
        
        updateModalProgress(100, '✅ Análise por referência concluída!');
        
        // 🎯 LOGS finais de validação
        log('🎉 [ANÁLISE POR REFERÊNCIA] Concluída com sucesso:');
        log('  - Baseline source:', finalAnalysis.comparison?.baseline_source);
        log('  - LUFS difference:', finalAnalysis.comparison?.loudness?.difference?.toFixed(2));
        log('  - Sugestões:', finalAnalysis.suggestions?.length || 0);
        log('  - Sem gênero:', !finalAnalysis.genre);
        
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
    log('🔍 [DIAGNÓSTICO] handleGenreFileSelection - modo:', window.currentAnalysisMode);
    log('🔍 [DIAGNÓSTICO] Este deveria ser APENAS modo gênero!');
    
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
            log('🔍 [DIAGNÓSTICO] Carregando referências de gênero:', genre);
            
            if (genre && (!__activeRefData || __activeRefGenre !== genre)) {
                updateModalProgress(25, `📚 Carregando referências: ${genre}...`);
                await loadReferenceData(genre);
                updateModalProgress(30, '📚 Referências ok');
            }
        } catch (_) { 
            log('🔍 [DIAGNÓSTICO] Erro ao carregar referências de gênero (não crítico)');
        }
    } else {
        log('🔍 [DIAGNÓSTICO] PULAR carregamento de referências - modo não é gênero');
    }
    
    // Analisar arquivo
    __dbg('🔬 Iniciando análise...');
    updateModalProgress(40, '🎵 Processando Waveform Digital...');
    
    // 🎯 CORREÇÃO: Passar modo correto para análise
    const analysisOptions = { 
      mode: window.currentAnalysisMode || 'genre' 
    };
    const analysis = await window.audioAnalyzer.analyzeAudioFile(file, analysisOptions);
    currentModalAnalysis = analysis;
    
    __dbg('✅ Análise concluída:', analysis);
    
    updateModalProgress(90, '🧠 Computando Métricas Avançadas...');
    
    // Aguardar um pouco para melhor UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    updateModalProgress(100, '✨ Análise Completa - Pronto!');
    
    // Mostrar resultados
    setTimeout(() => {
        // Telemetria: verificar elementos alvo antes de preencher o modal
        const exists = {
            audioUploadArea: !!document.getElementById('audioUploadArea'),
            audioAnalysisLoading: !!document.getElementById('audioAnalysisLoading'),
            audioAnalysisResults: !!document.getElementById('audioAnalysisResults'),
            modalTechnicalData: !!document.getElementById('modalTechnicalData')
        };
        __dbg('🛰️ [Telemetry] Front antes de preencher modal (existência de elementos):', exists);
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
        
        log('🔍 [COMPARAÇÃO] Métricas extraídas:');
        log('  - Usuário:', userMetrics);
        log('  - Referência:', referenceMetrics);
        
        // 🎯 CALCULAR diferenças PURAS (referência como baseline)
        const differences = {
            lufs: userMetrics.lufs - referenceMetrics.lufs,
            stereoCorrelation: userMetrics.stereoCorrelation - referenceMetrics.stereoCorrelation,
            dynamicRange: userMetrics.dynamicRange - referenceMetrics.dynamicRange,
            truePeak: userMetrics.truePeak - referenceMetrics.truePeak
        };
        
        log('🔍 [COMPARAÇÃO] Diferenças calculadas:', differences);
        
        // 🎯 GERAR sugestões baseadas APENAS na referência
        const referenceSuggestions = [];
        const THRESHOLD = 0.2; // Ignorar diferenças menores que 0.2dB
        
        // Loudness (LUFS)
        if (Math.abs(differences.lufs) > THRESHOLD) {
            const action = differences.lufs > 0 ? 'Diminuir' : 'Aumentar';
            const direction = differences.lufs > 0 ? 'decrease' : 'increase';
            referenceSuggestions.push({
                type: 'reference_loudness',
                message: `${action} volume em ${Math.abs(differences.lufs).toFixed(1)}dB para igualar à música de referência`,
                action: `${action} volume em ${Math.abs(differences.lufs).toFixed(1)}dB`,
                frequency_range: 'N/A',
                adjustment_db: Math.abs(differences.lufs),
                direction: direction,
                baseline_source: 'reference_audio'
            });
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
        
        // True Peak
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
        
        log(`🔍 [COMPARAÇÃO] Sugestões geradas: ${referenceSuggestions.length}`);
        
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
        log('🎉 [SUCESSO] Comparação por referência concluída:');
        log('  - Modo:', finalAnalysis.comparison.mode);
        log('  - Baseline source:', finalAnalysis.comparison.baseline_source);
        log('  - Sugestões:', referenceSuggestions.length);
        log('  - Sem contaminação de gênero:', !finalAnalysis.genre);
        
        referenceStepState.finalAnalysis = finalAnalysis;
        log('🔍 [DIAGNÓSTICO] Reference analysis tem comparação com gênero:', !!refAnalysis.comparison);
        
        // 🎯 NOVO: Verificar se análises estão "limpas" (sem contaminar com gênero)
        const userClean = !userAnalysis.comparison && !userAnalysis.reference;
        const refClean = !refAnalysis.comparison && !refAnalysis.reference;
        log('🔍 [DIAGNÓSTICO] User analysis clean (sem gênero):', userClean);
        log('🔍 [DIAGNÓSTICO] Reference analysis clean (sem gênero):', refClean);
        
        // Gerar comparação
        const comparison = generateComparison(userAnalysis, refAnalysis);
        
        // 🐛 DIAGNÓSTICO: Verificar se comparison está usando os dados corretos
        log('🔍 [DIAGNÓSTICO] Comparison gerada:', comparison);
        log('🔍 [DIAGNÓSTICO] baseline_source: reference_audio (confirmed)');
        
        // Gerar sugestões baseadas na comparação
        const suggestions = generateReferenceSuggestions(comparison);
        
        // 🐛 DIAGNÓSTICO: Verificar se sugestões são baseadas apenas na comparison
        log('🔍 [DIAGNÓSTICO] Sugestões geradas (count):', suggestions.length);
        log('🔍 [DIAGNÓSTICO] Primeiro tipo de sugestão:', suggestions[0]?.type);
        
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
        
        log('🔍 [DIAGNÓSTICO] Combined analysis diagnostic:', combinedAnalysis._diagnostic);
        
        currentModalAnalysis = combinedAnalysis;
        
        updateModalProgress(100, '✨ Comparação Completa!');
        
        // Mostrar resultados
        setTimeout(() => {
            displayModalResults(combinedAnalysis);
            window.logReferenceEvent('reference_comparison_completed');
        }, 800);
        
    } catch (error) {
        error('❌ Erro na comparação:', error);
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
    log('🔍 [DIAGNÓSTICO] generateReferenceSuggestions called with:', comparison);
    log('🔍 [DIAGNÓSTICO] Usando APENAS dados da comparison, não genre targets');
    log('🔍 [DIAGNÓSTICO] Genre ativo (NÃO usado):', window.PROD_AI_REF_GENRE);
    
    const suggestions = [];
    
    // Sugestões de loudness
    if (comparison.loudness.difference !== null) {
        const diff = comparison.loudness.difference;
        log('🔍 [DIAGNÓSTICO] Loudness difference:', diff);
        
        if (Math.abs(diff) > 1) {
            const suggestion = {
                type: 'reference_loudness',
                message: diff > 0 ? 'Sua música está mais alta que a referência' : 'Sua música está mais baixa que a referência',
                action: diff > 0 ? `Diminuir volume em ${Math.abs(diff).toFixed(1)}dB` : `Aumentar volume em ${Math.abs(diff).toFixed(1)}dB`,
                explanation: 'Para match de loudness com a referência',
                frequency_range: 'N/A',
                adjustment_db: Math.abs(diff),
                direction: diff > 0 ? 'decrease' : 'increase'
            };
            
            log('🔍 [DIAGNÓSTICO] Adicionando sugestão de loudness:', suggestion);
            suggestions.push(suggestion);
        }
    }
    
    // Sugestões espectrais
    Object.entries(comparison.spectral).forEach(([band, data]) => {
        log(`🔍 [DIAGNÓSTICO] Spectral band ${band}:`, data);
        
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
            
            log(`🔍 [DIAGNÓSTICO] Adicionando sugestão espectral para ${band}:`, suggestion);
            suggestions.push(suggestion);
        }
    });
    
    log('🔍 [DIAGNÓSTICO] Total sugestões geradas:', suggestions.length);
    log('🔍 [DIAGNÓSTICO] baseline_source: reference_audio (confirmed)');
    
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
                ${generateComparisonRow('Dinâmica', comparison.dynamics, 'dB')}
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
    const uploadArea = document.getElementById('audioUploadArea');
    const loading = document.getElementById('audioAnalysisLoading');
    const results = document.getElementById('audioAnalysisResults');
    const technicalData = document.getElementById('modalTechnicalData');
    
    if (!results || !technicalData) {
        error('❌ Elementos de resultado não encontrados');
        return;
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
    
    // Marcar se pacote avançado chegou (LUFS integrado + True Peak + LRA)
    const advancedReady = (
        Number.isFinite(analysis?.technicalData?.lufsIntegrated) &&
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

        const safePct = (v) => (Number.isFinite(v) ? `${(v*100).toFixed(0)}%` : '—');
        const monoCompat = (s) => s ? s : '—';

        // Função para obter o valor LUFS integrado usando a prioridade correta
        const getLufsIntegratedValue = () => {
            const data = analysis.technicalData;
            return data.lufs?.integrated ?? data.metrics?.lufs ?? data.lufsIntegrated;
        };

        const col1 = [
            row('Peak', `${safeFixed(analysis.technicalData.peak)} dB`, 'peak'),
            row('RMS', `${safeFixed(analysis.technicalData.rms)} dB`, 'rms'),
            row('DR', `${safeFixed(analysis.technicalData.dynamicRange)} dB`, 'dynamicRange'),
            row('Crest Factor', `${safeFixed(analysis.technicalData.crestFactor)}`, 'crestFactor'),
            row('True Peak', (advancedReady && Number.isFinite(analysis.technicalData.truePeakDbtp)) ? `${safeFixed(analysis.technicalData.truePeakDbtp)} dBTP` : (advancedReady? '—':'⏳'), 'truePeakDbtp'),
            row('Volume Integrado (padrão streaming)', (advancedReady && Number.isFinite(getLufsIntegratedValue())) ? `${safeFixed(getLufsIntegratedValue())} LUFS` : (advancedReady? '—':'⏳'), 'lufsIntegrated'),
            row('LRA', (advancedReady && Number.isFinite(analysis.technicalData.lra)) ? `${safeFixed(analysis.technicalData.lra)} dB` : (advancedReady? '—':'⏳'), 'lra')
            ].join('');

        const col2 = [
            row('Correlação', Number.isFinite(analysis.technicalData.stereoCorrelation) ? safeFixed(analysis.technicalData.stereoCorrelation, 2) : '—', 'stereoCorrelation'),
            row('Largura', Number.isFinite(analysis.technicalData.stereoWidth) ? safeFixed(analysis.technicalData.stereoWidth, 2) : '—', 'stereoWidth'),
            row('Balance', Number.isFinite(analysis.technicalData.balanceLR) ? safePct(analysis.technicalData.balanceLR) : '—', 'balanceLR'),
            row('Mono Compat.', monoCompat(analysis.technicalData.monoCompatibility), 'monoCompatibility'),
            row('Centroide', Number.isFinite(analysis.technicalData.spectralCentroid) ? safeHz(analysis.technicalData.spectralCentroid) : '—', 'spectralCentroid'),
            row('Rolloff (85%)', Number.isFinite(analysis.technicalData.spectralRolloff85) ? safeHz(analysis.technicalData.spectralRolloff85) : '—', 'spectralRolloff85'),
            row('Flux', Number.isFinite(analysis.technicalData.spectralFlux) ? safeFixed(analysis.technicalData.spectralFlux, 3) : '—', 'spectralFlux'),
            row('Flatness', Number.isFinite(analysis.technicalData.spectralFlatness) ? safeFixed(analysis.technicalData.spectralFlatness, 3) : '—', 'spectralFlatness')
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
            // ✅ CORREÇÃO: Contador Visual de Problemas
            const visualProblems = countVisualProblems(analysis);
            const problemCount = visualProblems.count;
            
            const col3 = [
                row('Tonal Balance', analysis.technicalData?.tonalBalance ? tonalSummary(analysis.technicalData.tonalBalance) : '—', 'tonalBalance'),
                (analysis.technicalData.dominantFrequencies.length > 0 ? row('Freq. Dominante', `${Math.round(analysis.technicalData.dominantFrequencies[0].frequency)} Hz`) : ''),
                row('Problemas', problemCount > 0 ? `<span class="tag tag-danger">${problemCount} detectado(s)</span>` : '—'),
                row('Sugestões', analysis.suggestions.length > 0 ? `<span class="tag tag-success">${analysis.suggestions.length} disponível(s)</span>` : '—'),
                col3Extras
            ].join('');

            // Card extra: Métricas Avançadas (novo card)
            const advancedMetricsCard = () => {
                const rows = [];
                // Removido LUFS ST/M conforme solicitado - manter apenas integrado
                
                // Headroom
                if (Number.isFinite(analysis.technicalData?.headroomDb)) {
                    // Mostrar headroom real se calculado a partir do pico, senão offset de loudness
                    const hrReal = Number.isFinite(analysis.technicalData.headroomTruePeakDb) ? analysis.technicalData.headroomTruePeakDb : null;
                    if (hrReal != null) {
                        rows.push(row('Headroom (Pico)', `${safeFixed(hrReal, 1)} dB`, 'headroomTruePeakDb'));
                    }
                    rows.push(row('Offset Loudness', `${safeFixed(analysis.technicalData.headroomDb, 1)} dB`, 'headroomDb'));
                }
                // Picos por canal
                if (Number.isFinite(analysis.technicalData?.samplePeakLeftDb)) {
                    rows.push(row('Sample Peak (L)', `${safeFixed(analysis.technicalData.samplePeakLeftDb, 1)} dB`, 'samplePeakLeftDb'));
                }
                if (Number.isFinite(analysis.technicalData?.samplePeakRightDb)) {
                    rows.push(row('Sample Peak (R)', `${safeFixed(analysis.technicalData.samplePeakRightDb, 1)} dB`, 'samplePeakRightDb'));
                }
                // Clipping (%)
                if (Number.isFinite(analysis.technicalData?.clippingPct)) {
                    rows.push(row('Clipping (%)', `${safeFixed(analysis.technicalData.clippingPct, 2)}%`, 'clippingPct'));
                }
                if (Number.isFinite(analysis.technicalData?.clippingSamplesTruePeak)) {
                    rows.push(row('Clipping (TP)', `${analysis.technicalData.clippingSamplesTruePeak} samples`, 'clippingSamplesTruePeak'));
                }
                // Frequências dominantes extras
                if (Array.isArray(analysis.technicalData?.dominantFrequencies) && analysis.technicalData.dominantFrequencies.length > 1) {
                    const extra = analysis.technicalData.dominantFrequencies.slice(1, 4)
                        .map((f, idx) => `${idx+2}. ${Math.round(f.frequency)} Hz (${f.occurrences || 1}x)`).join('<br>');
                    if (extra) rows.push(row('Top Freq. adicionais', `<span style="opacity:.9">${extra}</span>`));
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
                const peak = Number.isFinite(analysis.technicalData?.peak) ? analysis.technicalData.peak : -Infinity;
                const truePeak = Number.isFinite(analysis.technicalData?.truePeakDbtp) ? analysis.technicalData.truePeakDbtp : null;
                
                // Critérios de problema de clipping mais rigorosos e realistas
                const hasPeakClipping = peak > -0.1; // Mais rigoroso: -0.1dB ao invés de -0.5dB
                const hasTruePeakClipping = truePeak !== null && truePeak > -0.1; // True Peak acima de -0.1dBTP
                const hasSampleClipping = clipVal > 0;
                const hasPercentageClipping = clipPct > 0;
                
                const hasClippingProblem = hasPeakClipping || hasTruePeakClipping || hasSampleClipping || hasPercentageClipping;
                
                let clipText = '';
                let clipClass = '';
                
                if (hasClippingProblem) {
                    hasActualProblems = true;
                    clipClass = 'warn';
                    
                    // Mostrar informação mais detalhada do problema
                    const details = [];
                    if (hasPeakClipping) details.push(`Peak: ${peak.toFixed(2)}dB`);
                    if (hasTruePeakClipping) details.push(`TruePeak: ${truePeak.toFixed(2)}dBTP`);
                    if (hasSampleClipping) details.push(`${clipVal} samples (${clipPct.toFixed(3)}%)`);
                    
                    clipText = details.join(' | ');
                } else {
                    // Mostrar valores mesmo quando não há problema
                    const safeDetails = [];
                    safeDetails.push(`${clipVal} samples`);
                    if (peak > -Infinity) safeDetails.push(`Peak: ${peak.toFixed(2)}dB`);
                    if (truePeak !== null) safeDetails.push(`TP: ${truePeak.toFixed(2)}dBTP`);
                    
                    clipText = safeDetails.join(' | ');
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
                
                // 5. Crest Factor - SEMPRE mostrar  
                const crestVal = Number.isFinite(analysis.technicalData?.crestFactor) ? analysis.technicalData.crestFactor : 0;
                const hasCrestProblem = crestVal < 6 || crestVal > 20; // Valores normais: 6-20dB
                if (hasCrestProblem) hasActualProblems = true;
                const crestClass = hasCrestProblem ? 'warn' : '';
                rows.push(row('Crest Factor', `<span class="${crestClass}">${safeFixed(crestVal, 1)}dB</span>`, 'crestFactor'));
                
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
                            warn('[RenderSuggestion] Erro no gerador de texto:', error);
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
                if (analysis.problems && analysis.problems.length > 0) {
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
                if (analysis.suggestions.length > 0) {
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
        
        // Função para renderizar score com barra de progresso
        const renderScoreWithProgress = (label, value, color = '#00ffff') => {
            const numValue = parseFloat(value) || 0;
            const displayValue = value != null ? value : '—';
            
            if (value == null) {
                return `<div class="data-row">
                    <span class="label">${label}:</span>
                    <span class="value">—</span>
                </div>`;
            }
            
            return `<div class="data-row metric-with-progress">
                <span class="label">${label}:</span>
                <div class="metric-value-progress">
                    <span class="value">${displayValue}/100</span>
                    <div class="progress-bar-mini">
                        <div class="progress-fill-mini" style="width: ${Math.min(Math.max(numValue, 0), 100)}%; background: ${color}; color: ${color};"></div>
                    </div>
                </div>
            </div>`;
        };
        
        const scoreRows = breakdown ? `
            ${renderScoreWithProgress('Dinâmica', breakdown.dynamics, '#ffd700')}
            ${renderScoreWithProgress('Técnico', breakdown.technical, '#00ff92')}
            ${renderScoreWithProgress('Stereo', breakdown.stereo, '#ff6b6b')}
            ${renderScoreWithProgress('Loudness', breakdown.loudness, '#ff3366')}
            ${renderScoreWithProgress('Frequência', breakdown.frequency, '#00ffff')}
        ` : '';

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
                        <div class="card">
                    <div class="card-title">🏆 Scores & Diagnóstico</div>
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
    
    try { renderReferenceComparisons(analysis); } catch(e){ warn('ref compare fail', e);}    
        try { if (window.CAIAR_ENABLED) injectValidationControls(); } catch(e){ warn('validation controls fail', e); }
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
            } catch(err){ error('Erro suite validação', err); statusEl.textContent='Erro'; btnRun.textContent='Erro'; btnRun.disabled=false; }
        };
        btnForm.onclick = async ()=>{
            try { const mod = await import(`../lib/audio/validation/validation-suite.js?c=${Date.now()}`); ensureValidationPanel(); mod.renderSubjectiveForm('validationPanelInner'); statusEl.textContent='Formulário subjetivo aberto'; } catch(e){ warn(e); }
        };
        btnDownload.onclick = async ()=>{
            try { const mod = await import(`../lib/audio/validation/validation-suite.js?c=${Date.now()}`); const rep = mod.generateValidationReport(); if(rep){ downloadObjectAsJson(rep, 'prodai_validation_report.json'); statusEl.textContent = rep?.subjective?.pctImproved!=null? `Subj ${(rep.subjective.pctImproved*100).toFixed(0)}%`:'Relatório gerado'; } } catch(e){ warn(e); }
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
        try { const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 250); } catch(e){ warn('download json fail', e); }
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
    } catch (e) { warn('smart summary fail', e); return ''; }
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
    // Usar somente métricas reais (sem fallback para RMS/Peak, que têm unidades e conceitos distintos)
    // Função para obter o valor LUFS integrado usando a prioridade correta
    const getLufsIntegratedValue = () => {
        return tech.lufs?.integrated ?? tech.metrics?.lufs ?? tech.lufsIntegrated;
    };
    
    pushRow('Volume Integrado (padrão streaming)', getLufsIntegratedValue(), ref.lufs_target, ref.tol_lufs, ' LUFS');
    pushRow('True Peak', tech.truePeakDbtp, ref.true_peak_target, ref.tol_true_peak, ' dBTP');
    pushRow('DR', tech.dynamicRange, ref.dr_target, ref.tol_dr, '');
    pushRow('LRA', tech.lra, ref.lra_target, ref.tol_lra, '');
    pushRow('Stereo Corr.', tech.stereoCorrelation, ref.stereo_target, ref.tol_stereo, '');
    // Bandas detalhadas Fase 2: priorizar bandEnergies completas se disponíveis
    const preferLog = (typeof window !== 'undefined' && window.USE_LOG_BAND_ENERGIES === true);
    const bandEnergies = (preferLog ? (tech.bandEnergiesLog || tech.bandEnergies) : tech.bandEnergies) || null;
    if (bandEnergies && ref.bands) {
        const normMap = (analysis?.technicalData?.refBandTargetsNormalized?.mapping) || null;
        const showNorm = (typeof window !== 'undefined' && window.SHOW_NORMALIZED_REF_TARGETS === true && normMap);
        for (const [band, refBand] of Object.entries(ref.bands)) {
            const bLocal = bandEnergies[band];
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
            log('🎯 Usando Enhanced Suggestion Engine...');
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
            
            log(`🎯 Enhanced Suggestions: ${enhancedAnalysis.suggestions.length} sugestões geradas`);
            return;
            
        } catch (error) {
            warn('🚨 Erro no Enhanced Suggestion Engine, usando fallback:', error);
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
        
        // 🎯 LINGUAGEM ESPECÍFICA POR MÉTRICA
        let message, action;
        const absDiff = Math.abs(diff);
        
        if (type === 'reference_true_peak') {
            // True Peak: valores mais altos = menos limitação, valores mais baixos = mais limitação
            if (diff > 0) {
                message = `True Peak muito alto (${val.toFixed(1)}${unit} vs ${target}${unit})`;
                action = `Aumentar limitação para ${target}${unit}`;
            } else {
                message = `True Peak muito baixo (${val.toFixed(1)}${unit} vs ${target}${unit})`;
                action = `Reduzir limitação para ${target}${unit}`;
            }
        } else if (type === 'reference_loudness') {
            // LUFS: valores mais altos = mais alto, valores mais baixos = mais baixo
            if (diff > 0) {
                message = `Volume muito alto (+${absDiff.toFixed(1)} LUFS)`;
                action = `DIMINUIR ${absDiff.toFixed(1)} LUFS`;
            } else {
                message = `Volume muito baixo (-${absDiff.toFixed(1)} LUFS)`;
                action = `AUMENTAR ${absDiff.toFixed(1)} LUFS`;
            }
        } else if (type === 'reference_dynamics') {
            // Dynamic Range: valores altos = muita dinâmica, valores baixos = pouca dinâmica
            if (diff > 0) {
                message = `Dinâmica excessiva (+${absDiff.toFixed(1)} dB)`;
                action = `DIMINUIR ${absDiff.toFixed(1)} dB (mais compressão)`;
            } else {
                message = `Dinâmica insuficiente (-${absDiff.toFixed(1)} dB)`;
                action = `AUMENTAR ${absDiff.toFixed(1)} dB (menos compressão)`;
            }
        } else if (type === 'reference_stereo') {
            // Correlação Estéreo: valores altos = mais mono, valores baixos = mais estéreo
            if (diff > 0) {
                message = `Imagem estéreo muito estreita (+${absDiff.toFixed(2)})`;
                action = `AUMENTAR ${absDiff.toFixed(2)} (mais estéreo)`;
            } else {
                message = `Imagem estéreo muito ampla (-${absDiff.toFixed(2)})`;
                action = `DIMINUIR ${absDiff.toFixed(2)} (menos estéreo)`;
            }
        } else {
            // Fallback genérico para outros tipos
            const direction = diff > 0 ? 'acima' : 'abaixo';
            message = `${label} ${direction} do alvo (${target}${unit})`;
            action = `Ajustar ${label} ${direction==='acima'?'para baixo':'para cima'} ~${target}${unit}`;
        }
        
        sug.push({
            type,
            message,
            action,
            details: `Diferença: ${diff.toFixed(2)}${unit} • tolerância ±${tol}${unit} • gênero: ${window.PROD_AI_REF_GENRE || 'default'}`
        });
    };
    // Aplicar checks principais
    const lufsVal = Number.isFinite(tech.lufsIntegrated) ? tech.lufsIntegrated : null;
    addRefSug(lufsVal, ref.lufs_target, ref.tol_lufs, 'reference_loudness', 'LUFS', '');
    const tpVal = Number.isFinite(tech.truePeakDbtp) ? tech.truePeakDbtp : null;
    addRefSug(tpVal, ref.true_peak_target, ref.tol_true_peak, 'reference_true_peak', 'True Peak', ' dBTP');
    addRefSug(tech.dynamicRange, ref.dr_target, ref.tol_dr, 'reference_dynamics', 'DR', ' dB');
    if (Number.isFinite(tech.lra)) addRefSug(tech.lra, ref.lra_target, ref.tol_lra, 'reference_lra', 'LRA', ' dB');
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
        error('❌ Erro ao enviar análise para chat:', error);
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
    
    log('📄 Baixando relatório...');
    
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
        
        log('✅ Relatório baixado com sucesso');
        showTemporaryFeedback('📄 Relatório baixado!');
        
    } catch (error) {
        error('❌ Erro ao baixar relatório:', error);
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
    
    if (analysis.technicalData.dominantFrequencies.length > 0) {
        report += `🎯 FREQUÊNCIAS DOMINANTES:\n`;
        report += `${'-'.repeat(30)}\n`;
        analysis.technicalData.dominantFrequencies.slice(0, 10).forEach((freq, i) => {
            report += `${i + 1}. ${Math.round(freq.frequency)} Hz (${freq.occurrences} ocorrências)\n`;
        });
        report += `\n`;
    }
    
    if (analysis.problems && analysis.problems.length > 0) {
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
            const res = await window.audioAnalyzer.analyzeAudioFile(file);
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
        error('Error displaying reference results:', error);
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
