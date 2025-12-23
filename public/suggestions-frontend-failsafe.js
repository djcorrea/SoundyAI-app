/**
 * 🛡️ FAILSAFE FRONTEND: FILTRO DE SUGESTÕES POR STATUS DA TABELA
 * 
 * Sistema de segurança adicional que filtra sugestões no frontend
 * baseado no status visual da tabela renderizada.
 * 
 * OBJETIVO: Garantir que mesmo se o backend falhar, o frontend nunca
 * mostrará sugestões para métricas com status "OK" (verde).
 * 
 * @module suggestions-frontend-failsafe
 */

(function() {
    'use strict';
    
    console.log('[FAILSAFE-FRONTEND] 🛡️ Sistema de proteção de sugestões carregado');
    
    /**
     * Normaliza chave de métrica (mesmo sistema do backend)
     */
    function normalizeMetricKey(input) {
        if (typeof input === 'object' && input !== null) {
            input = input.metric || input.type || input.metricKey || input.category || '';
        }
        
        const key = String(input).toLowerCase().trim();
        
        const keyMap = {
            'lufs': 'lufs',
            'lufs_integrated': 'lufs',
            'lufsintegrated': 'lufs',
            'loudness': 'lufs',
            'truepeak': 'truepeak',
            'true_peak': 'truepeak',
            'truepeakdbtp': 'truepeak',
            'peak': 'truepeak',
            'clipping': 'truepeak',
            'dr': 'dynamicrange',
            'dynamic_range': 'dynamicrange',
            'dynamicrange': 'dynamicrange',
            'lra': 'lra',
            'loudness_range': 'lra',
            'stereo': 'stereo',
            'stereo_correlation': 'stereo',
            'correlation': 'stereo',
            'rms': 'rms',
            'crest': 'crestfactor',
            'crest_factor': 'crestfactor',
            'bass': 'bass',
            'low': 'bass',
            'sub': 'bass',
            'lowmid': 'lowmid',
            'low_mid': 'lowmid',
            'mid': 'mid',
            'highmid': 'highmid',
            'high_mid': 'highmid',
            'high': 'high',
            'air': 'air',
            'brilliance': 'air'
        };
        
        return keyMap[key] || key;
    }
    
    /**
     * Extrai statusByKey da tabela renderizada
     * 
     * Lê a tabela de métricas e cria um mapa { metricKey: status }
     * baseado nas classes CSS das células de status
     * 
     * @returns {Object} - Mapa de status { key: 'ok'|'yellow'|'warn' }
     */
    function extractStatusFromTable() {
        const statusByKey = {};
        
        // Seletores possíveis de tabelas
        const tableSelectors = [
            '#referenceComparisons table',
            '#genreComparison table',
            '.metrics-table',
            'table.comparison-table'
        ];
        
        for (const selector of tableSelectors) {
            const table = document.querySelector(selector);
            if (!table) continue;
            
            const rows = table.querySelectorAll('tbody tr');
            console.log(`[FAILSAFE] Encontrada tabela com ${rows.length} linhas em ${selector}`);
            
            for (const row of rows) {
                // Extrair label da métrica (primeira coluna)
                const labelCell = row.querySelector('td:first-child');
                if (!labelCell) continue;
                
                const label = labelCell.textContent.trim();
                
                // Extrair status (última coluna com classe CSS)
                const statusCell = row.querySelector('td.ok, td.yellow, td.warn, td[class*="ok"], td[class*="yellow"], td[class*="warn"]');
                if (!statusCell) continue;
                
                // Determinar status pela classe CSS
                let status = 'unknown';
                if (statusCell.classList.contains('ok') || statusCell.className.includes('ok')) {
                    status = 'ok';
                } else if (statusCell.classList.contains('yellow') || statusCell.className.includes('yellow')) {
                    status = 'yellow';
                } else if (statusCell.classList.contains('warn') || statusCell.className.includes('warn')) {
                    status = 'warn';
                }
                
                // Normalizar label para key
                const key = normalizeMetricKey(label);
                statusByKey[key] = status;
                
                console.log(`[FAILSAFE] Métrica extraída: ${label} → ${key} → ${status}`);
            }
        }
        
        console.log('[FAILSAFE] statusByKey extraído:', statusByKey);
        return statusByKey;
    }
    
    /**
     * Filtra sugestões baseado no status da tabela
     * 
     * @param {Array} suggestions - Lista de sugestões
     * @param {Object} statusByKey - Mapa de status da tabela
     * @returns {Array} - Sugestões filtradas
     */
    function filterSuggestionsByTableStatus(suggestions, statusByKey) {
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            return [];
        }
        
        if (!statusByKey || Object.keys(statusByKey).length === 0) {
            console.warn('[FAILSAFE] statusByKey vazio - retornando todas as sugestões');
            return suggestions;
        }
        
        const filtered = [];
        let removedCount = 0;
        
        for (const sug of suggestions) {
            const key = normalizeMetricKey(sug);
            const tableStatus = statusByKey[key];
            
            // Se tableStatus vier do backend, usar ele
            if (sug.tableStatus && sug.tableStatus === 'ok') {
                removedCount++;
                console.log(`[FAILSAFE] ❌ Removida (backend): ${key} (tableStatus=ok)`);
                continue;
            }
            
            // Senão, verificar statusByKey extraído da tabela
            if (tableStatus === 'ok') {
                removedCount++;
                console.log(`[FAILSAFE] ❌ Removida (frontend): ${key} (tableStatus=ok)`);
                continue;
            }
            
            filtered.push(sug);
        }
        
        console.log('[FAILSAFE] ✅ Filtro aplicado:', {
            input: suggestions.length,
            output: filtered.length,
            removed: removedCount
        });
        
        return filtered;
    }
    
    /**
     * Aplica failsafe em todas as fontes de sugestões
     */
    function applyFailsafeToAllSuggestions() {
        console.log('[FAILSAFE] 🔍 Aplicando failsafe global...');
        
        // Extrair status da tabela
        const statusByKey = extractStatusFromTable();
        
        if (Object.keys(statusByKey).length === 0) {
            console.warn('[FAILSAFE] ⚠️ Nenhum status extraído da tabela - failsafe não será aplicado');
            return;
        }
        
        // Filtrar suggestions no window (se existirem)
        if (window.currentAnalysis && Array.isArray(window.currentAnalysis.suggestions)) {
            const before = window.currentAnalysis.suggestions.length;
            window.currentAnalysis.suggestions = filterSuggestionsByTableStatus(
                window.currentAnalysis.suggestions, 
                statusByKey
            );
            console.log(`[FAILSAFE] window.currentAnalysis.suggestions: ${before} → ${window.currentAnalysis.suggestions.length}`);
        }
        
        // Filtrar aiSuggestions no window (se existirem)
        if (window.currentAnalysis && Array.isArray(window.currentAnalysis.aiSuggestions)) {
            const before = window.currentAnalysis.aiSuggestions.length;
            window.currentAnalysis.aiSuggestions = filterSuggestionsByTableStatus(
                window.currentAnalysis.aiSuggestions, 
                statusByKey
            );
            console.log(`[FAILSAFE] window.currentAnalysis.aiSuggestions: ${before} → ${window.currentAnalysis.aiSuggestions.length}`);
        }
        
        // Filtrar no __soundyState (se existir)
        if (window.__soundyState && window.__soundyState.currentAnalysis) {
            if (Array.isArray(window.__soundyState.currentAnalysis.suggestions)) {
                const before = window.__soundyState.currentAnalysis.suggestions.length;
                window.__soundyState.currentAnalysis.suggestions = filterSuggestionsByTableStatus(
                    window.__soundyState.currentAnalysis.suggestions, 
                    statusByKey
                );
                console.log(`[FAILSAFE] __soundyState.suggestions: ${before} → ${window.__soundyState.currentAnalysis.suggestions.length}`);
            }
            
            if (Array.isArray(window.__soundyState.currentAnalysis.aiSuggestions)) {
                const before = window.__soundyState.currentAnalysis.aiSuggestions.length;
                window.__soundyState.currentAnalysis.aiSuggestions = filterSuggestionsByTableStatus(
                    window.__soundyState.currentAnalysis.aiSuggestions, 
                    statusByKey
                );
                console.log(`[FAILSAFE] __soundyState.aiSuggestions: ${before} → ${window.__soundyState.currentAnalysis.aiSuggestions.length}`);
            }
        }
        
        console.log('[FAILSAFE] ✅ Failsafe aplicado em todas as fontes');
        
        // Forçar re-render se houver sistema de UI
        if (window.aiUIController && typeof window.aiUIController.checkForAISuggestions === 'function') {
            console.log('[FAILSAFE] 🔄 Forçando re-render do UI Controller...');
            window.aiUIController.checkForAISuggestions(window.currentAnalysis);
        }
    }
    
    /**
     * Hook de integração: interceptar renderização de sugestões
     */
    function hookSuggestionRendering() {
        // Interceptar renderSuggestions se existir
        if (window.renderSuggestions) {
            const originalRenderSuggestions = window.renderSuggestions;
            window.renderSuggestions = function(suggestions, ...args) {
                console.log('[FAILSAFE] 🪝 Interceptando renderSuggestions...');
                const statusByKey = extractStatusFromTable();
                const filtered = filterSuggestionsByTableStatus(suggestions, statusByKey);
                return originalRenderSuggestions.call(this, filtered, ...args);
            };
            console.log('[FAILSAFE] ✅ renderSuggestions hooked');
        }
        
        // Interceptar displaySuggestions se existir
        if (window.aiSuggestionsSystem && window.aiSuggestionsSystem.displaySuggestions) {
            const originalDisplay = window.aiSuggestionsSystem.displaySuggestions;
            window.aiSuggestionsSystem.displaySuggestions = function(suggestions, source) {
                console.log('[FAILSAFE] 🪝 Interceptando displaySuggestions...');
                const statusByKey = extractStatusFromTable();
                const filtered = filterSuggestionsByTableStatus(suggestions, statusByKey);
                return originalDisplay.call(this, filtered, source);
            };
            console.log('[FAILSAFE] ✅ aiSuggestionsSystem.displaySuggestions hooked');
        }
    }
    
    // Expor funções globalmente
    window.SuggestionsFailsafe = {
        normalizeMetricKey,
        extractStatusFromTable,
        filterSuggestionsByTableStatus,
        applyFailsafeToAllSuggestions,
        hookSuggestionRendering
    };
    
    // Auto-aplicar hooks quando carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[FAILSAFE] 🚀 DOM carregado - aplicando hooks...');
            hookSuggestionRendering();
        });
    } else {
        console.log('[FAILSAFE] 🚀 DOM já carregado - aplicando hooks imediatamente...');
        hookSuggestionRendering();
    }
    
    // Aplicar failsafe após cada renderização de tabela
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                // Verificar se tabela foi adicionada
                const hasTable = mutation.addedNodes && Array.from(mutation.addedNodes).some(node => 
                    node.nodeName === 'TABLE' || (node.querySelector && node.querySelector('table'))
                );
                
                if (hasTable) {
                    console.log('[FAILSAFE] 🔍 Tabela detectada - aplicando failsafe...');
                    setTimeout(applyFailsafeToAllSuggestions, 500); // delay para garantir renderização completa
                    break;
                }
            }
        }
    });
    
    // Observar body inteiro
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        console.log('[FAILSAFE] 👁️ MutationObserver ativo');
    }
    
    console.log('[FAILSAFE] ✅ Sistema de proteção frontend ativado');
})();
