/**
 * patch-event-delegation.cjs
 * 
 * Aplica 2 mudanças em audio-analyzer-integration.js:
 * 1. Remove wiring imperativo do accordion (dentro de renderGenreComparisonTable)
 * 2. Adiciona IIFE initDiagnosticEventDelegation após renderGenreComparisonTable
 *
 * Compatível com CRLF.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'audio-analyzer-integration.js');
let content = fs.readFileSync(filePath, 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 1: Remover wiring imperativo do accordion e substituir por log
// ─────────────────────────────────────────────────────────────────────────────
const OLD_IMPERATIVE = `        // 🎯 Wiring imperativo do accordion (sem depender de window.toggleDiagTable global)
        const _diagToggleBtn = container.querySelector('.genre-diag-toggle');
        if (_diagToggleBtn) {
            _diagToggleBtn.addEventListener('click', function () {
                const body = this.nextElementSibling;
                if (!body) return;
                const willExpand = body.hasAttribute('hidden');
                if (willExpand) {
                    body.removeAttribute('hidden');
                    this.setAttribute('aria-expanded', 'true');
                } else {
                    body.setAttribute('hidden', '');
                    this.setAttribute('aria-expanded', 'false');
                }
                const arrow = this.querySelector('.dt-toggle-arrow');
                if (arrow) arrow.textContent = willExpand ? '▲' : '▼';
            });
            log('[GENRE-TABLE] 🎯 Accordion toggle wired imperatively');
        }`;

const NEW_LOG = `        // 🎯 Accordion toggle via document delegation (persistente — ver initDiagnosticEventDelegation)
        log('[GENRE-TABLE] 🎯 Accordion toggle via delegação persistente no document');`;

// Normalizar para comparação (strip \r)
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOld = OLD_IMPERATIVE.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedOld)) {
  console.error('PATCH 1 FALHOU: string não encontrada');
  process.exit(1);
}

let patched = normalizedContent.replace(normalizedOld, NEW_LOG);
console.log('✅ PATCH 1 aplicado: wiring imperativo removido');

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 2: Adicionar IIFE initDiagnosticEventDelegation após renderGenreComparisonTable
// ─────────────────────────────────────────────────────────────────────────────
const ANCHOR_BEFORE = `    console.groupEnd();
}

// 🎯 NOVO: Atualizar step ativo no modo referência
function updateReferenceStep(step) {`;

const NEW_WITH_IIFE = `    console.groupEnd();
}

// ── DELEGAÇÃO PERSISTENTE DE EVENTOS DIAGNÓSTICO ─────────────────────────────
// Ligado UMA VEZ ao document — sobrevive a qualquer re-render de innerHTML.
// Cobre: .genre-diag-toggle (accordion "Diagnóstico completo")
// ─────────────────────────────────────────────────────────────────────────────
(function initDiagnosticEventDelegation() {
    if (window.__DIAG_EVENTS_DELEGATED__) return; // guard anti-duplo
    window.__DIAG_EVENTS_DELEGATED__ = true;

    document.addEventListener('click', function (e) {
        const toggleBtn = e.target.closest('.genre-diag-toggle');
        if (!toggleBtn) return;

        const body = toggleBtn.nextElementSibling;
        if (!body) return;

        const willExpand = body.hasAttribute('hidden');
        if (willExpand) {
            body.removeAttribute('hidden');
            toggleBtn.setAttribute('aria-expanded', 'true');
        } else {
            body.setAttribute('hidden', '');
            toggleBtn.setAttribute('aria-expanded', 'false');
        }

        const arrow = toggleBtn.querySelector('.dt-toggle-arrow');
        if (arrow) arrow.textContent = willExpand ? '▲' : '▼';

        log('[DIAG-DELEGATION] 🎯 Accordion toggled via delegação');
    });

    log('[DIAG-DELEGATION] ✅ Delegação de eventos diagnóstico ativa no document');
})();

// 🎯 NOVO: Atualizar step ativo no modo referência
function updateReferenceStep(step) {`;

const normalizedAnchor = ANCHOR_BEFORE.replace(/\r\n/g, '\n');
if (!patched.includes(normalizedAnchor)) {
  console.error('PATCH 2 FALHOU: âncora "console.groupEnd" + updateReferenceStep não encontrada');
  process.exit(1);
}

patched = patched.replace(normalizedAnchor, NEW_WITH_IIFE);
console.log('✅ PATCH 2 aplicado: IIFE initDiagnosticEventDelegation adicionada');

// Reescrever com CRLF
fs.writeFileSync(filePath, patched.replace(/\n/g, '\r\n'), 'utf8');
console.log('✅ Arquivo salvo com CRLF');

// Verificação rápida de sintaxe
const vm = require('vm');
try {
  new vm.Script(patched);
  console.log('✅ SYNTAX OK');
} catch (e) {
  console.error('❌ SYNTAX ERROR:', e.message);
  process.exit(1);
}

console.log('🎉 patch-event-delegation concluído com sucesso');
