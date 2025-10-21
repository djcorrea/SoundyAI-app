/**
 * ScoreDiagnosticCard.js
 * Componente isolado para exibir Score Final e Barras de Categoria
 * 
 * @typedef {Object} CategoryData
 * @property {'loudness'|'frequency'|'stereo'|'dynamic'|'technical'} id
 * @property {string} label
 * @property {number} value - Score 0-100
 * @property {string} emoji
 * @property {string} color - Cor hex
 * 
 * @typedef {Object} ScoreDiagnosticProps
 * @property {number} totalScore - Score final 0-100
 * @property {CategoryData[]} categories - Array de 5 categorias
 * @property {string} [genre='padrão'] - Gênero de referência
 * @property {boolean} [isLoading=false] - Estado de carregamento
 * @property {string|null} [error=null] - Mensagem de erro
 */

/**
 * Renderiza o card de Score & Diagnóstico
 * @param {ScoreDiagnosticProps} props
 * @returns {string} HTML do card
 */
export function renderScoreDiagnosticCard(props) {
    const {
        totalScore,
        categories = [],
        genre = 'padrão',
        isLoading = false,
        error = null
    } = props;
    
    // Estado: Loading
    if (isLoading) {
        return `
            <section class="score-diagnostic-card" 
                     aria-label="Carregando score e diagnóstico"
                     aria-busy="true"
                     data-testid="score-card-loading">
                <h2 class="card-title">Score & Diagnóstico</h2>
                <div class="skeleton-loader">
                    <div class="skeleton-bar" style="width: 80%;"></div>
                    <div class="skeleton-bar" style="width: 90%;"></div>
                    <div class="skeleton-bar" style="width: 70%;"></div>
                    <div class="skeleton-bar" style="width: 85%;"></div>
                    <div class="skeleton-bar" style="width: 95%;"></div>
                </div>
            </section>
        `;
    }
    
    // Estado: Error
    if (error) {
        return `
            <section class="score-diagnostic-card error" 
                     aria-label="Erro ao carregar score"
                     data-testid="score-card-error">
                <h2 class="card-title">Score & Diagnóstico</h2>
                <div class="error-message">
                    <span class="error-icon" role="img" aria-label="Erro">⚠️</span>
                    <p>${error || 'Não foi possível carregar o score.'}</p>
                    <button class="retry-btn" 
                            onclick="window.retryScoreCalculation()"
                            aria-label="Tentar carregar score novamente">
                        Tentar Novamente
                    </button>
                </div>
            </section>
        `;
    }
    
    // Determinar cor do score final
    const scoreColor = totalScore >= 80 ? '#00ff92' : 
                      totalScore >= 60 ? '#ffd700' : 
                      totalScore >= 40 ? '#ff9500' : '#ff3366';
    
    // Renderizar barras de categorias
    const categoryBars = categories.map(cat => {
        const catValue = Number.isFinite(cat.value) ? cat.value : 0;
        const displayValue = Math.round(catValue);
        
        return `
            <div class="category-row" 
                 role="row"
                 data-testid="category-row-${cat.id}">
                <span class="category-label">${cat.emoji || ''} ${cat.label}</span>
                <div class="category-progress-container">
                    <span class="category-value" 
                          style="color: ${cat.color};"
                          data-testid="category-value-${cat.id}">
                        ${displayValue}
                    </span>
                    <div class="progress-bar-mini" 
                         role="progressbar" 
                         aria-valuenow="${catValue}" 
                         aria-valuemin="0" 
                         aria-valuemax="100"
                         aria-label="Score de ${cat.label}: ${displayValue} de 100">
                        <div class="progress-fill-mini" 
                             style="width: ${Math.min(Math.max(catValue, 0), 100)}%; 
                                    background: ${cat.color};"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Estado: Success (renderização normal)
    return `
        <section class="score-diagnostic-card" 
                 aria-labelledby="score-diagnostic-heading"
                 aria-live="polite"
                 data-testid="score-card-success"
                 data-score="${Math.round(totalScore)}">
            <h2 id="score-diagnostic-heading" class="card-title">
                Score & Diagnóstico
            </h2>
            
            <div class="score-final-container">
                <div class="score-final-label">SCORE FINAL</div>
                <div class="score-final-value" 
                     style="color: ${scoreColor};" 
                     aria-label="Score final ${Math.round(totalScore)} de 100"
                     data-testid="score-final-value"
                     data-target-score="${Math.round(totalScore)}">
                    0
                </div>
                <div class="score-final-meta">
                    Gênero: ${genre} • Ponderação adaptativa
                </div>
            </div>
            
            <div class="categories-container" 
                 role="table" 
                 aria-label="Scores por categoria">
                ${categoryBars}
            </div>
        </section>
    `;
}

/**
 * Animação de contagem do score (counter animation)
 * Chamada automaticamente quando o card é inserido no DOM
 * @param {HTMLElement} element - Elemento .score-final-value
 * @param {number} targetScore - Score final a ser exibido
 */
function animateScoreNumber(element, targetScore) {
    if (!element || !Number.isFinite(targetScore)) return;
    
    let start = 0;
    const end = Math.round(targetScore);
    const duration = 1500; // 1.5 segundos
    const frameRate = 1000 / 60; // 60 FPS
    const increment = (end - start) / (duration / frameRate);
    
    const timer = setInterval(() => {
        start += increment;
        
        if (start >= end) {
            start = end;
            clearInterval(timer);
            element.classList.add('animate-in');
        }
        
        element.textContent = Math.floor(start);
    }, frameRate);
}

/**
 * Observer para detectar quando o card é inserido e iniciar animação
 */
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Verificar se é o card ou se contém o card
                    const card = node.classList?.contains('score-diagnostic-card') 
                        ? node 
                        : node.querySelector?.('.score-diagnostic-card');
                    
                    if (card) {
                        const scoreElement = card.querySelector('.score-final-value');
                        const targetScore = scoreElement?.dataset?.targetScore;
                        
                        if (scoreElement && targetScore) {
                            // Delay de 200ms para garantir que o DOM esteja estável
                            setTimeout(() => {
                                animateScoreNumber(scoreElement, parseFloat(targetScore));
                            }, 200);
                        }
                    }
                }
            });
        });
    });
    
    // Observar todo o documento (otimizar para container específico se possível)
    if (document.body) {
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    } else {
        // Se o body ainda não existe, aguardar DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
        });
    }
}

/**
 * Função global para retry de cálculo de score
 * Deve ser chamada quando o botão "Tentar Novamente" é clicado
 */
if (typeof window !== 'undefined') {
    window.retryScoreCalculation = async function() {
        const lastAnalysisResult = window.__LAST_ANALYSIS_RESULT__;
        if (!lastAnalysisResult) {
            console.error('[SCORE_CARD] Nenhuma análise anterior encontrada para retry');
            alert('Por favor, faça upload do áudio novamente.');
            return;
        }
        
        try {
            console.log('[SCORE_CARD] Tentando recalcular score...');
            
            // Renderizar skeleton enquanto processa
            const container = document.querySelector('.score-diagnostic-card');
            if (container) {
                container.outerHTML = renderScoreDiagnosticCard({
                    totalScore: 0,
                    categories: [],
                    isLoading: true
                });
            }
            
            // Reprocessar análise completa (se função disponível)
            if (typeof window.displayResults === 'function') {
                window.displayResults(lastAnalysisResult);
                console.log('[SCORE_CARD] Score recalculado com sucesso');
            } else {
                throw new Error('Função displayResults não disponível');
            }
        } catch (error) {
            console.error('[SCORE_CARD] Falha ao recalcular:', error);
            alert('Erro ao recalcular score. Por favor, faça upload novamente.');
            
            // Renderizar estado de erro novamente
            const container = document.querySelector('.score-diagnostic-card');
            if (container) {
                container.outerHTML = renderScoreDiagnosticCard({
                    totalScore: 0,
                    categories: [],
                    error: 'Falha ao recalcular. Tente novamente.'
                });
            }
        }
    };
}
