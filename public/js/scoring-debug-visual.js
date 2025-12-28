/**
 * ============================================================================
 * SCORING DEBUG VISUAL - Badge na UI
 * ============================================================================
 * 
 * Exibe informações de debug do scoring próximo ao score final.
 * Apenas visível em modo de desenvolvimento ou com ?debug=score
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';
  
  // Verificar se deve exibir debug
  const isDebugMode = () => {
    if (typeof window === 'undefined') return false;
    
    // Query param ?debug=score
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'score') return true;
    
    // Flag global
    if (window.DEBUG_SCORE === true) return true;
    if (window.AUDIT_MODE === true) return true;
    
    // Localhost sempre mostra
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') return true;
    
    return false;
  };
  
  // Estilos do badge
  const STYLES = `
    .scoring-debug-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 11px;
      color: #e0e0e0;
      z-index: 99999;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      transition: all 0.3s ease;
    }
    
    .scoring-debug-badge.minimized {
      padding: 8px 12px;
      cursor: pointer;
    }
    
    .scoring-debug-badge.minimized .debug-content {
      display: none;
    }
    
    .scoring-debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #333;
    }
    
    .scoring-debug-title {
      font-weight: bold;
      color: #6366f1;
    }
    
    .scoring-debug-toggle {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 14px;
    }
    
    .debug-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
    }
    
    .debug-label {
      color: #888;
    }
    
    .debug-value {
      font-weight: bold;
    }
    
    .debug-value.engine-v3 { color: #22c55e; }
    .debug-value.engine-current { color: #fbbf24; }
    .debug-value.mode-streaming { color: #3b82f6; }
    .debug-value.mode-pista { color: #f97316; }
    .debug-value.mode-reference { color: #8b5cf6; }
    .debug-value.fallback-true { color: #ef4444; }
    .debug-value.fallback-false { color: #22c55e; }
    .debug-value.critical { color: #ef4444; font-weight: bold; }
    
    .debug-gates {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #333;
    }
    
    .debug-gate-item {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
      padding: 4px 8px;
      margin: 4px 0;
      font-size: 10px;
    }
    
    .debug-gate-type {
      color: #ef4444;
      font-weight: bold;
    }
    
    .debug-gate-message {
      color: #888;
      margin-top: 2px;
    }
  `;
  
  // Criar elemento de debug
  function createDebugBadge() {
    if (!isDebugMode()) return null;
    
    // Adicionar estilos
    if (!document.getElementById('scoring-debug-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'scoring-debug-styles';
      styleEl.textContent = STYLES;
      document.head.appendChild(styleEl);
    }
    
    // Criar badge
    const badge = document.createElement('div');
    badge.id = 'scoring-debug-badge';
    badge.className = 'scoring-debug-badge';
    badge.innerHTML = `
      <div class="scoring-debug-header">
        <span class="scoring-debug-title">🔧 Scoring Debug</span>
        <button class="scoring-debug-toggle" title="Minimizar">−</button>
      </div>
      <div class="debug-content">
        <div class="debug-row">
          <span class="debug-label">Engine:</span>
          <span class="debug-value" id="debug-engine">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Mode:</span>
          <span class="debug-value" id="debug-mode">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Genre:</span>
          <span class="debug-value" id="debug-genre">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Fallback:</span>
          <span class="debug-value" id="debug-fallback">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Score Original:</span>
          <span class="debug-value" id="debug-original-score">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Score Final:</span>
          <span class="debug-value" id="debug-final-score">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Cap Aplicado:</span>
          <span class="debug-value" id="debug-cap">--</span>
        </div>
        <div class="debug-gates" id="debug-gates">
          <!-- Gates serão inseridos aqui -->
        </div>
      </div>
    `;
    
    // Toggle minimização
    badge.querySelector('.scoring-debug-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      badge.classList.toggle('minimized');
      e.target.textContent = badge.classList.contains('minimized') ? '+' : '−';
    });
    
    // Expandir ao clicar (se minimizado)
    badge.addEventListener('click', () => {
      if (badge.classList.contains('minimized')) {
        badge.classList.remove('minimized');
        badge.querySelector('.scoring-debug-toggle').textContent = '−';
      }
    });
    
    document.body.appendChild(badge);
    return badge;
  }
  
  // Atualizar badge com dados do score
  function updateDebugBadge(scoreResult) {
    if (!isDebugMode()) return;
    
    let badge = document.getElementById('scoring-debug-badge');
    if (!badge) {
      badge = createDebugBadge();
    }
    if (!badge) return;
    
    // Engine
    const engineEl = badge.querySelector('#debug-engine');
    const engine = scoreResult.scoringEngineVersion || scoreResult.engineUsed || 'unknown';
    engineEl.textContent = engine;
    engineEl.className = `debug-value ${engine.includes('v3') ? 'engine-v3' : 'engine-current'}`;
    
    // Mode
    const modeEl = badge.querySelector('#debug-mode');
    const mode = scoreResult.modeUsed || 'streaming';
    modeEl.textContent = mode;
    modeEl.className = `debug-value mode-${mode}`;
    
    // Genre
    const genreEl = badge.querySelector('#debug-genre');
    genreEl.textContent = scoreResult.genreUsed || 'default';
    
    // Fallback
    const fallbackEl = badge.querySelector('#debug-fallback');
    const hasFallback = scoreResult.fallbackUsed === true;
    fallbackEl.textContent = hasFallback ? `Sim (${scoreResult.fallbackReason || '?'})` : 'Não';
    fallbackEl.className = `debug-value fallback-${hasFallback}`;
    
    // Scores
    const originalScoreEl = badge.querySelector('#debug-original-score');
    const originalScore = scoreResult.originalScoreBeforeGates ?? scoreResult.scorePct;
    originalScoreEl.textContent = `${originalScore}%`;
    
    const finalScoreEl = badge.querySelector('#debug-final-score');
    finalScoreEl.textContent = `${scoreResult.scorePct}%`;
    finalScoreEl.className = `debug-value ${scoreResult.hasCriticalError ? 'critical' : ''}`;
    
    // Cap
    const capEl = badge.querySelector('#debug-cap');
    capEl.textContent = scoreResult.finalScoreCapApplied ? `${scoreResult.finalScoreCapApplied}%` : 'Nenhum';
    capEl.className = `debug-value ${scoreResult.finalScoreCapApplied ? 'critical' : ''}`;
    
    // Gates
    const gatesEl = badge.querySelector('#debug-gates');
    const gates = scoreResult.gatesTriggered || [];
    
    if (gates.length === 0) {
      gatesEl.innerHTML = '<div style="color: #22c55e;">✓ Nenhum gate ativado</div>';
    } else {
      gatesEl.innerHTML = '<div style="color: #ef4444; margin-bottom: 4px;">⚠️ Gates Ativados:</div>' +
        gates.map(g => `
          <div class="debug-gate-item">
            <div class="debug-gate-type">${g.type}</div>
            <div class="debug-gate-message">${g.reason}</div>
          </div>
        `).join('');
    }
  }
  
  // Expor globalmente
  window.ScoringDebug = {
    update: updateDebugBadge,
    create: createDebugBadge,
    isDebugMode: isDebugMode
  };
  
  // Interceptar window.__LAST_MIX_SCORE para atualização automática
  let lastScoreValue = null;
  
  Object.defineProperty(window, '__LAST_MIX_SCORE', {
    get: () => lastScoreValue,
    set: (value) => {
      lastScoreValue = value;
      if (value && isDebugMode()) {
        updateDebugBadge(value);
      }
    },
    configurable: true
  });
  
  // Criar badge inicial se em modo debug
  if (document.readyState === 'complete') {
    if (isDebugMode()) createDebugBadge();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      if (isDebugMode()) createDebugBadge();
    });
  }
  
  console.log('[SCORING_DEBUG] 🔧 Debug visual carregado. Ative com ?debug=score');
})();
