// public/analysis-history.js
// 🕐 Sistema de Histórico de Análises - Frontend (APENAS PRO)
// Reutiliza displayModalResults() existente para exibir análises antigas

(function initAnalysisHistory() {
    'use strict';

    log('🕐 [HISTORY-FE] Inicializando módulo de histórico...');

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
     * Verifica se usuário tem acesso ao histórico (PRO/STUDIO)
     * ✅ ATUALIZADO 2026-01-21: PRO e STUDIO têm acesso completo ao histórico
     * @returns {boolean}
     */
    function hasHistoryAccess() {
        const plan = detectUserPlan();
        return plan === 'pro' || plan === 'studio';
    }
    
    /**
     * Detecta plano do usuário de múltiplas fontes
     * ✅ ATUALIZADO 2026-01-21: PRO e STUDIO têm acesso completo
     * @returns {string} 'free' | 'plus' | 'pro' | 'studio'
     */
    function detectUserPlan() {
        // 1. Análise atual
        const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
        if (analysis?.plan && ['free', 'plus', 'pro', 'studio'].includes(analysis.plan)) {
            return analysis.plan;
        }
        
        // 2. window.userPlan
        if (window.userPlan && ['free', 'plus', 'pro', 'studio'].includes(window.userPlan)) {
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
            warn('🕐 [HISTORY-FE] Usuário não autenticado');
            return [];
        }
        
        // ✅ NOVO: Permitir busca para todos os planos (bloqueio no clique)
        log(`🕐 [HISTORY-FE] Buscando histórico (plano: ${userPlan})...`);
        
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
                log(`🕐 [HISTORY-FE] ✅ ${data.history.length} análises carregadas`);
                return data.history;
            }
            
            warn('🕐 [HISTORY-FE] Resposta sem histórico:', data);
            return [];
            
        } catch (error) {
            error('🕐 [HISTORY-FE] ❌ Erro ao buscar histórico:', error);
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
        
        // ✅ Permitir busca para todos os planos autenticados
        if (!userId) {
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
                log(`🕐 [HISTORY-FE] ✅ Análise carregada: ${data.analysis.trackName}`);
                return data.analysis;
            }
            
            return null;
            
        } catch (error) {
            error('🕐 [HISTORY-FE] ❌ Erro ao buscar análise:', error);
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
            error('🕐 [HISTORY-FE] ❌ Erro ao deletar:', error);
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
        
        log('🕐 [HISTORY-FE] ✅ Painel de histórico criado');
    }
    
    /**
     * Abre painel lateral do histórico
     * ✅ NOVO: Todos os planos podem VER a lista, mas clique é bloqueado
     */
    async function openHistoryPanel() {
        // ✅ Criar painel independente do plano
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
    /**
     * Exibe prompt para upgrade (DEPRECIADO - usar showHistoryUpgradeModal)
     */
    function showUpgradePrompt() {
        showHistoryUpgradeModal(detectUserPlan());
    }
    
    /**
     * ✅ NOVO: Modal de upgrade específico para histórico
     * Mostra ao tentar abrir uma análise sem permissão
     */
    function showHistoryUpgradeModal(currentPlan) {
        // Usar modal de upgrade existente se disponível
        if (window.showEntitlementUpgradeModal) {
            window.showEntitlementUpgradeModal('history', currentPlan);
            return;
        }
        
        // Fallback: Modal customizado
        const existingModal = document.getElementById('historyUpgradeModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'historyUpgradeModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                padding: 40px;
                border-radius: 20px;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                border: 1px solid rgba(139, 92, 246, 0.3);
            ">
                <div style="font-size: 60px; margin-bottom: 20px;">🔒</div>
                <h2 style="color: #fff; margin-bottom: 15px; font-size: 24px;">Histórico Completo</h2>
                <p style="color: #a0a0c0; margin-bottom: 25px; line-height: 1.6;">
                    O acesso completo ao histórico de análises é uma funcionalidade exclusiva do <strong style="color: #8b5cf6;">Plano PRO</strong>.
                </p>
                <p style="color: #a0a0c0; margin-bottom: 30px; line-height: 1.6;">
                    Faça upgrade para acessar todas as suas análises anteriores, comparar resultados e acompanhar sua evolução!
                </p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button onclick="this.closest('#historyUpgradeModal').remove()" style="
                        padding: 12px 24px;
                        background: #2a2a3e;
                        color: #fff;
                        border: 1px solid #3a3a4e;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.2s;
                    ">Fechar</button>
                    <button onclick="window.location.href='/planos.html'" style="
                        padding: 12px 24px;
                        background: linear-gradient(135deg, #8b5cf6, #6366f1);
                        color: #fff;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        transition: all 0.2s;
                    ">Ver Planos PRO</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎬 ABRIR ANÁLISE DO HISTÓRICO
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Abre uma análise do histórico no modal de resultados
     * ✅ BLOQUEIO: PRO/DJ podem abrir, Free/Plus veem modal de upgrade
     * ✅ CRÍTICO: Reutiliza displayModalResults() existente
     * @param {string} historyId 
     */
    async function openFromHistory(historyId) {
        log(`🕐 [HISTORY-FE] Abrindo análise do histórico: ${historyId}`);
        
        // ✅ BLOQUEIO POR PLANO: Apenas PRO/DJ podem abrir análises
        if (!hasHistoryAccess()) {
            const currentPlan = detectUserPlan();
            log(`🕐 [HISTORY-FE] ⛔ Plano ${currentPlan} não tem acesso à abertura de análises`);
            closeHistoryPanel();
            showHistoryUpgradeModal(currentPlan);
            return;
        }
        log(`🕐 [HISTORY-FE] Abrindo análise do histórico: ${historyId}`);
        
        // ✅ BLOQUEIO POR PLANO
        if (!hasHistoryAccess()) {
            const currentPlan = detectUserPlan();
            log(`🕐 [HISTORY-FE] ⛔ Plano ${currentPlan} não tem acesso à abertura de análises`);
            closeHistoryPanel();
            showHistoryUpgradeModal(currentPlan);
            return;
        }
        
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
            
            log('🕐 [HISTORY-FE] ✅ Dados da análise carregados:', {
                trackName: item.trackName,
                analysisType: item.analysisType,
                hasResult: !!analysisData,
                resultKeys: Object.keys(analysisData || {}).length
            });
            
            hideHistoryLoading();
            
            // ✅ REUTILIZAR A MESMA FUNÇÃO DO SISTEMA
            if (typeof window.displayModalResults === 'function') {
                log('🕐 [HISTORY-FE] Chamando displayModalResults()...');
                
                // 🔥 CRÍTICO: Abrir o modal ANTES de chamar displayModalResults
                // (no fluxo normal, o modal já está aberto)
                const modal = document.getElementById('audioAnalysisModal');
                if (modal) {
                    modal.style.display = 'flex';
                    log('🕐 [HISTORY-FE] ✅ Modal audioAnalysisModal aberto');
                } else {
                    error('🕐 [HISTORY-FE] ❌ Modal audioAnalysisModal não encontrado!');
                }
                
                // Chamar displayModalResults para renderizar os dados
                await window.displayModalResults(analysisData);
                
                // Garantir que seção de resultados esteja visível
                const resultsSection = document.getElementById('audioAnalysisResults');
                if (resultsSection) {
                    resultsSection.style.display = 'block';
                }
                
                // Esconder outras seções
                const uploadSection = document.getElementById('audioUploadArea');
                const loadingSection = document.getElementById('audioAnalysisLoading');
                if (uploadSection) uploadSection.style.display = 'none';
                if (loadingSection) loadingSection.style.display = 'none';
                
                log('🕐 [HISTORY-FE] ✅ Análise do histórico exibida com sucesso!');
            } else {
                error('🕐 [HISTORY-FE] ❌ displayModalResults não disponível!');
                alert('❌ Erro ao exibir análise. Recarregue a página.');
            }
            
        } catch (error) {
            hideHistoryLoading();
            error('🕐 [HISTORY-FE] ❌ Erro ao abrir análise:', error);
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
            
            log('🕐 [HISTORY-FE] ✅ Análise removida do histórico');
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
            log('🕐 [HISTORY-FE] Item de menu "historyMenuItem" não encontrado no HTML');
            return;
        }
        
        // Atualizar visibilidade baseado no plano
        updateHistoryMenuVisibility();
        
        log('🕐 [HISTORY-FE] ✅ Item de histórico configurado');
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
            log('🕐 [HISTORY-FE] 🔓 Histórico visível (PRO/DJ)');
        } else {
            historyMenuItem.style.display = 'none';  // Esconde
            log('🕐 [HISTORY-FE] 🔒 Histórico oculto (plano não-PRO)');
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
        
        // ⚡ EVENT-DRIVEN: Observar mudanças via evento de plano (sem polling)
        // Quando o plano mudar, disparar evento customizado
        if (window.PlanCapabilities) {
            // Registrar callback para atualização de plano
            const originalUpdate = window.PlanCapabilities.update;
            if (originalUpdate) {
                window.PlanCapabilities.update = function(...args) {
                    const result = originalUpdate.apply(this, args);
                    updateHistoryMenuVisibility();
                    return result;
                };
            }
        }
        
        // Listener para evento customizado de mudança de plano
        window.addEventListener('soundy:planChanged', () => {
            log('🔄 [HISTORY-FE] Plano alterado, atualizando visibilidade');
            updateHistoryMenuVisibility();
        });
        
        log('🔐 [HISTORY-FE] ✅ Módulo de histórico inicializado (event-driven, sem polling)');
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
