// public/analysis-history.js
// 🕐 Sistema de Histórico de Análises - Frontend (APENAS PRO)
// Reutiliza displayModalResults() existente para exibir análises antigas

(function initAnalysisHistory() {
    'use strict';

    console.log('🕐 [HISTORY-FE] Inicializando módulo de histórico...');

    // ═══════════════════════════════════════════════════════════════════
    // 🔧 CONFIGURAÇÕES
    // ═══════════════════════════════════════════════════════════════════
    
    const API_BASE = '/api/history';
    const HISTORY_PANEL_ID = 'historyPanel';
    const HISTORY_LIST_ID = 'historyList';
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔐 VERIFICAÇÃO DE PLANO PRO
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Verifica se usuário tem acesso ao histórico (PRO/DJ)
     * @returns {boolean}
     */
    function hasHistoryAccess() {
        const plan = detectUserPlan();
        return plan === 'pro' || plan === 'dj';
    }
    
    /**
     * Detecta plano do usuário de múltiplas fontes
     * @returns {string} 'free' | 'plus' | 'pro' | 'dj'
     */
    function detectUserPlan() {
        // 1. Análise atual
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        if (analysis?.plan && ['free', 'plus', 'pro', 'dj'].includes(analysis.plan)) {
            return analysis.plan;
        }
        
        // 2. window.userPlan
        if (window.userPlan && ['free', 'plus', 'pro', 'dj'].includes(window.userPlan)) {
            return window.userPlan;
        }
        
        // 3. Capabilities
        if (window.PlanCapabilities?.detectUserPlan) {
            return window.PlanCapabilities.detectUserPlan();
        }
        
        return 'free';
    }
    
    /**
     * Obtém userId do usuário autenticado
     * @returns {string|null}
     */
    function getCurrentUserId() {
        // Firebase Auth
        if (window.auth?.currentUser?.uid) {
            return window.auth.currentUser.uid;
        }
        
        // Fallback de localStorage (para sessões persistentes)
        const storedUid = localStorage.getItem('soundyai_uid');
        if (storedUid) {
            return storedUid;
        }
        
        return null;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 📋 API CALLS
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Busca lista de análises do histórico
     * @returns {Promise<Array>}
     */
    async function fetchHistory() {
        const userId = getCurrentUserId();
        const userPlan = detectUserPlan();
        
        if (!userId) {
            console.warn('🕐 [HISTORY-FE] Usuário não autenticado');
            return [];
        }
        
        if (!hasHistoryAccess()) {
            console.log('🕐 [HISTORY-FE] Plano não tem acesso ao histórico:', userPlan);
            return [];
        }
        
        try {
            const response = await fetch(API_BASE, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-user-plan': userPlan
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.history) {
                console.log(`🕐 [HISTORY-FE] ✅ ${data.history.length} análises carregadas`);
                return data.history;
            }
            
            console.warn('🕐 [HISTORY-FE] Resposta sem histórico:', data);
            return [];
            
        } catch (error) {
            console.error('🕐 [HISTORY-FE] ❌ Erro ao buscar histórico:', error);
            return [];
        }
    }
    
    /**
     * Busca análise específica pelo ID
     * @param {string} historyId 
     * @returns {Promise<Object|null>}
     */
    async function fetchHistoryItem(historyId) {
        const userId = getCurrentUserId();
        const userPlan = detectUserPlan();
        
        if (!userId || !hasHistoryAccess()) {
            return null;
        }
        
        try {
            const response = await fetch(`${API_BASE}/${historyId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-user-plan': userPlan
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.analysis) {
                console.log(`🕐 [HISTORY-FE] ✅ Análise carregada: ${data.analysis.trackName}`);
                return data.analysis;
            }
            
            return null;
            
        } catch (error) {
            console.error('🕐 [HISTORY-FE] ❌ Erro ao buscar análise:', error);
            return null;
        }
    }
    
    /**
     * Remove análise do histórico
     * @param {string} historyId 
     * @returns {Promise<boolean>}
     */
    async function deleteHistoryItem(historyId) {
        const userId = getCurrentUserId();
        const userPlan = detectUserPlan();
        
        if (!userId || !hasHistoryAccess()) {
            return false;
        }
        
        try {
            const response = await fetch(`${API_BASE}/${historyId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-user-plan': userPlan
                }
            });
            
            const data = await response.json();
            return data.success === true;
            
        } catch (error) {
            console.error('🕐 [HISTORY-FE] ❌ Erro ao deletar:', error);
            return false;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎨 UI - PAINEL DO HISTÓRICO
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Cria o painel de histórico (modal lateral)
     */
    function createHistoryPanel() {
        // Verificar se já existe
        if (document.getElementById(HISTORY_PANEL_ID)) {
            return;
        }
        
        const panel = document.createElement('div');
        panel.id = HISTORY_PANEL_ID;
        panel.className = 'history-panel';
        panel.innerHTML = `
            <div class="history-panel-overlay" id="historyPanelOverlay"></div>
            <div class="history-panel-content">
                <div class="history-panel-header">
                    <h3>🕐 Histórico de Análises</h3>
                    <button class="history-panel-close" id="historyPanelClose">&times;</button>
                </div>
                <div class="history-panel-body">
                    <div class="history-loading" id="historyLoading">
                        <div class="history-spinner"></div>
                        <p>Carregando histórico...</p>
                    </div>
                    <div class="history-empty" id="historyEmpty" style="display: none;">
                        <p>📭 Nenhuma análise salva ainda</p>
                        <p class="history-empty-hint">Suas análises serão salvas automaticamente aqui.</p>
                    </div>
                    <ul class="history-list" id="${HISTORY_LIST_ID}" style="display: none;"></ul>
                </div>
                <div class="history-panel-footer">
                    <p class="history-limit-info">Máximo de 50 análises salvas</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Event listeners
        document.getElementById('historyPanelOverlay').addEventListener('click', closeHistoryPanel);
        document.getElementById('historyPanelClose').addEventListener('click', closeHistoryPanel);
        
        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panel.classList.contains('active')) {
                closeHistoryPanel();
            }
        });
        
        console.log('🕐 [HISTORY-FE] ✅ Painel de histórico criado');
    }
    
    /**
     * Abre o painel de histórico
     */
    async function openHistoryPanel() {
        if (!hasHistoryAccess()) {
            console.log('🕐 [HISTORY-FE] ⛔ Usuário não tem acesso ao histórico');
            showUpgradePrompt();
            return;
        }
        
        createHistoryPanel();
        
        const panel = document.getElementById(HISTORY_PANEL_ID);
        const loadingEl = document.getElementById('historyLoading');
        const emptyEl = document.getElementById('historyEmpty');
        const listEl = document.getElementById(HISTORY_LIST_ID);
        
        // Mostrar painel
        panel.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Mostrar loading
        loadingEl.style.display = 'flex';
        emptyEl.style.display = 'none';
        listEl.style.display = 'none';
        
        // Buscar histórico
        const history = await fetchHistory();
        
        // Esconder loading
        loadingEl.style.display = 'none';
        
        if (history.length === 0) {
            emptyEl.style.display = 'flex';
        } else {
            renderHistoryList(history);
            listEl.style.display = 'block';
        }
    }
    
    /**
     * Fecha o painel de histórico
     */
    function closeHistoryPanel() {
        const panel = document.getElementById(HISTORY_PANEL_ID);
        if (panel) {
            panel.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    /**
     * Renderiza a lista de análises
     * @param {Array} history 
     */
    function renderHistoryList(history) {
        const listEl = document.getElementById(HISTORY_LIST_ID);
        if (!listEl) return;
        
        listEl.innerHTML = history.map(item => {
            const date = new Date(item.createdAt);
            const dateStr = date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const typeIcon = item.analysisType === 'reference' ? '🎯' : '🎵';
            const typeLabel = item.analysisType === 'reference' ? 'Referência' : 'Por Gênero';
            
            return `
                <li class="history-item" data-id="${item.id}">
                    <div class="history-item-main" onclick="window.SoundyHistory.openFromHistory('${item.id}')">
                        <div class="history-item-icon">${typeIcon}</div>
                        <div class="history-item-info">
                            <div class="history-item-name">${escapeHtml(item.trackName)}</div>
                            <div class="history-item-meta">
                                <span class="history-item-type">${typeLabel}</span>
                                <span class="history-item-genre">${escapeHtml(item.genreOrReferenceName)}</span>
                            </div>
                            <div class="history-item-date">${dateStr}</div>
                        </div>
                    </div>
                    <button class="history-item-delete" onclick="event.stopPropagation(); window.SoundyHistory.deleteFromHistory('${item.id}')" title="Remover do histórico">
                        🗑️
                    </button>
                </li>
            `;
        }).join('');
    }
    
    /**
     * Escapa HTML para prevenir XSS
     * @param {string} str 
     * @returns {string}
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, (match) => {
            const escapeMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return escapeMap[match];
        });
    }
    
    /**
     * Mostra prompt de upgrade para não-PRO
     */
    function showUpgradePrompt() {
        // Usar modal de upgrade existente se disponível
        if (window.showEntitlementUpgradeModal) {
            window.showEntitlementUpgradeModal('history', detectUserPlan());
            return;
        }
        
        // Fallback: alert simples
        alert('📊 O Histórico de Análises está disponível apenas para usuários PRO.\n\nFaça upgrade do seu plano para acessar todas as suas análises anteriores!');
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎬 ABRIR ANÁLISE DO HISTÓRICO
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Abre uma análise do histórico no modal de resultados
     * ✅ CRÍTICO: Reutiliza displayModalResults() existente
     * @param {string} historyId 
     */
    async function openFromHistory(historyId) {
        console.log(`🕐 [HISTORY-FE] Abrindo análise do histórico: ${historyId}`);
        
        // Fechar painel do histórico
        closeHistoryPanel();
        
        // Mostrar loading
        showHistoryLoading('Carregando análise...');
        
        try {
            // Buscar análise completa
            const item = await fetchHistoryItem(historyId);
            
            if (!item || !item.result) {
                hideHistoryLoading();
                alert('❌ Não foi possível carregar esta análise.');
                return;
            }
            
            // ✅ CRÍTICO: O result é exatamente o JSON que alimenta displayModalResults()
            const analysisData = item.result;
            
            // Marcar como análise do histórico (para evitar re-salvar)
            analysisData._fromHistory = true;
            analysisData._historyId = historyId;
            
            console.log('🕐 [HISTORY-FE] ✅ Dados da análise carregados:', {
                trackName: item.trackName,
                analysisType: item.analysisType,
                hasResult: !!analysisData,
                resultKeys: Object.keys(analysisData || {}).length
            });
            
            hideHistoryLoading();
            
            // ✅ REUTILIZAR A MESMA FUNÇÃO DO SISTEMA
            if (typeof window.displayModalResults === 'function') {
                console.log('🕐 [HISTORY-FE] Chamando displayModalResults()...');
                await window.displayModalResults(analysisData);
                
                // Abrir modal de resultados se necessário
                const modal = document.getElementById('audioUploadModal') || 
                             document.getElementById('audioResultModal');
                if (modal) {
                    modal.style.display = 'flex';
                    
                    // Mostrar seção de resultados
                    const resultsSection = document.getElementById('audioAnalysisResults');
                    if (resultsSection) {
                        resultsSection.style.display = 'block';
                    }
                    
                    // Esconder outras seções
                    const uploadSection = document.getElementById('audioAnalysisUpload');
                    const loadingSection = document.getElementById('audioAnalysisLoading');
                    if (uploadSection) uploadSection.style.display = 'none';
                    if (loadingSection) loadingSection.style.display = 'none';
                }
                
                console.log('🕐 [HISTORY-FE] ✅ Análise do histórico exibida com sucesso!');
            } else {
                console.error('🕐 [HISTORY-FE] ❌ displayModalResults não disponível!');
                alert('❌ Erro ao exibir análise. Recarregue a página.');
            }
            
        } catch (error) {
            hideHistoryLoading();
            console.error('🕐 [HISTORY-FE] ❌ Erro ao abrir análise:', error);
            alert('❌ Erro ao carregar análise do histórico.');
        }
    }
    
    /**
     * Remove análise do histórico
     * @param {string} historyId 
     */
    async function deleteFromHistory(historyId) {
        if (!confirm('Deseja remover esta análise do histórico?')) {
            return;
        }
        
        const success = await deleteHistoryItem(historyId);
        
        if (success) {
            // Remover da lista
            const itemEl = document.querySelector(`.history-item[data-id="${historyId}"]`);
            if (itemEl) {
                itemEl.remove();
            }
            
            // Verificar se lista ficou vazia
            const listEl = document.getElementById(HISTORY_LIST_ID);
            if (listEl && listEl.children.length === 0) {
                listEl.style.display = 'none';
                document.getElementById('historyEmpty').style.display = 'flex';
            }
            
            console.log('🕐 [HISTORY-FE] ✅ Análise removida do histórico');
        } else {
            alert('❌ Erro ao remover análise.');
        }
    }
    
    /**
     * Mostra loading overlay
     * @param {string} message 
     */
    function showHistoryLoading(message = 'Carregando...') {
        let overlay = document.getElementById('historyLoadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'historyLoadingOverlay';
            overlay.className = 'history-loading-overlay';
            overlay.innerHTML = `
                <div class="history-loading-content">
                    <div class="history-spinner"></div>
                    <p id="historyLoadingMessage">${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            document.getElementById('historyLoadingMessage').textContent = message;
        }
        overlay.style.display = 'flex';
    }
    
    /**
     * Esconde loading overlay
     */
    function hideHistoryLoading() {
        const overlay = document.getElementById('historyLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔗 INTEGRAÇÃO COM MENU LATERAL
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Configura visibilidade do item de histórico no menu lateral
     * O item já existe no HTML (id="historyMenuItem")
     */
    function setupHistoryMenuItem() {
        const historyMenuItem = document.getElementById('historyMenuItem');
        
        if (!historyMenuItem) {
            console.log('🕐 [HISTORY-FE] Item de menu "historyMenuItem" não encontrado no HTML');
            return;
        }
        
        // Atualizar visibilidade baseado no plano
        updateHistoryMenuVisibility();
        
        console.log('🕐 [HISTORY-FE] ✅ Item de histórico configurado');
    }
    
    /**
     * Atualiza visibilidade do item de histórico baseado no plano
     * - Se PRO/DJ: mostra o item
     * - Se FREE/PLUS: esconde o item
     */
    function updateHistoryMenuVisibility() {
        const historyMenuItem = document.getElementById('historyMenuItem');
        
        if (!historyMenuItem) return;
        
        const isPro = hasHistoryAccess();
        
        if (isPro) {
            historyMenuItem.style.display = '';  // Mostra
            console.log('🕐 [HISTORY-FE] 🔓 Histórico visível (PRO/DJ)');
        } else {
            historyMenuItem.style.display = 'none';  // Esconde
            console.log('🕐 [HISTORY-FE] 🔒 Histórico oculto (plano não-PRO)');
        }
    }
    
    /**
     * Handler para ação do menu de histórico
     * Deve ser integrado no handleSidePanelAction existente
     * @param {string} action 
     */
    function handleHistoryAction(action) {
        if (action === 'history') {
            openHistoryPanel();
            return true;
        }
        return false;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🚀 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    
    function initialize() {
        // Aguardar DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupHistoryMenuItem();
            });
        } else {
            setupHistoryMenuItem();
        }
        
        // Atualizar quando estado de auth mudar (login/logout)
        if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
            window.auth.onAuthStateChanged((user) => {
                // Aguardar carregamento do plano
                setTimeout(updateHistoryMenuVisibility, 1000);
            });
        }
        
        // Também observar mudanças no window.userPlan
        let lastPlan = detectUserPlan();
        setInterval(() => {
            const currentPlan = detectUserPlan();
            if (currentPlan !== lastPlan) {
                lastPlan = currentPlan;
                updateHistoryMenuVisibility();
            }
        }, 2000);
        
        console.log('🕐 [HISTORY-FE] ✅ Módulo de histórico inicializado');
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 📤 EXPORTAR PARA WINDOW
    // ═══════════════════════════════════════════════════════════════════
    
    window.SoundyHistory = {
        hasAccess: hasHistoryAccess,
        open: openHistoryPanel,
        close: closeHistoryPanel,
        openFromHistory: openFromHistory,
        deleteFromHistory: deleteFromHistory,
        handleAction: handleHistoryAction,
        updateVisibility: updateHistoryMenuVisibility
    };
    
    // Inicializar
    initialize();
    
})();
