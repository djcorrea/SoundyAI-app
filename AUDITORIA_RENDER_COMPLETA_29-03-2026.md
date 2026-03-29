# AUDITORIA COMPLETA: FLUXO DE RENDER DE ANÁLISE
**Data:** 29 de março de 2026  
**Status:** 🔴 CRÍTICO — 6 causas raiz identificadas  

---

## CAUSA RAIZ #1: RACE CONDITION EM window.displayModalResults
**Severidade: 🔴 CRÍTICA** | **Impacto: Score final não renderiza, veredito não renderiza, tabela nova não funciona**

### Problema
Quatro scripts **competem simultaneamente** para interceptar e sobrescrever `window.displayModalResults`. Último a escrever "vence", mas não há sincronização.

| Script | Arquivo | Tipo | Linha(s) | Quando |
|--------|---------|------|----------|--------|
| **ai-suggestions-integration.js** | `/public/` | Wrapper + clonagem | L1498-L1500 | Carga `defer` |
| **demo-cta-force.js** | `/public/` | Polling + wrapper | L224-L235 | Polling 100ms |
| **monitor-modal-ultra-avancado.js** | `/public/` | Fallback interception | L6-L18 | Carga `defer` |
| **verdict-engine.js** | `/public/` | MutationObserver + patch fallback | L537-L542 | Carga `defer` |

### Mecanismo exato
Cada script faz:
```javascript
window.displayModalResults = function(newFunction) {
  // wrapper + customLogic
  return originalFunction + myLogic;
}
```

**Ordem de carregamento em home.html (L1796-L1838):**
1. L1796: pipeline-order-correction.js
2. L1801: audio-analyzer.js → **injeciona audio-analyzer-v2.js dinamicamente** (L618)
3. L1826: score-engine-v3.js
4. L1832: analysis-state-machine.js
5. **L1835: verdict-engine.js** ← redefine window.displayModalResults
6. **L1838: audio-analyzer-integration.js** ← define displayModalResults "original"
7. ⚠️ **`defer`** = ordem NÃO-DETERMINÍSTICA entre esses 4

**Consequência:**
- `verdict-engine.js` pode executar **antes** de `audio-analyzer-integration.js` carregar
- Quando isso acontece: `window.displayModalResults` ainda é `undefined` quando verdict-engine tenta wrappear
- `ai-suggestions-integration.js` pode sobrescrever o wrapper do verdict-engine
- `demo-cta-force.js` faz polling enquanto os outros redefinem → captura versão "meia"

### Prova documental
- **Grep:** 83 referências a `displayModalResults` em 7 scripts públicos
- **Padrão encontrado:** 4 atribuições diretas `window.displayModalResults = `
- **Teste automatizado Playwright:** `window.displayModalResults === "undefined"` (funções declaradas em closure, não expostas globalmente até primeira atribuição)

---

## CAUSA RAIZ #2: CONFLITO DE CONSTANTES ENTRE audio-analyzer.js E audio-analyzer-v2.js
**Severidade: 🟠 ALTA** | **Impacto: Script execution quebrada, downstream falha silenciosamente**

### Problema
Ambos descrevem **`const RUNID_ENFORCED`** na **mesma linha (L14)**:

**audio-analyzer.js L14:**
```javascript
const RUNID_ENFORCED = /* padrão */;
```

**audio-analyzer-v2.js L14:**
```javascript
const RUNID_ENFORCED = /* padrão */;
```

### Mecanismo
1. home.html L1801 carrega `audio-analyzer.js`
2. audio-analyzer.js L618 **injeta dinamicamente** `audio-analyzer-v2.js` via script tag
3. Quando v2 carrega, ambas tentam declarar `RUNID_ENFORCED` no escopo global
4. Segunda declaração gera **SyntaxError** (ou silenciosamente referência inválida em alguns engines JS)
5. Script execution quebra → `verdict-engine.js`, `analysis-state-machine.js` não conseguem referências externas

### Localização
- **Def v1:** [audio-analyzer.js:L14](public/audio-analyzer.js#L14)
- **Def v2:** [audio-analyzer-v2.js:L14](public/audio-analyzer-v2.js#L14)
- **Injeção dinâmica:** [audio-analyzer.js:L618](public/audio-analyzer.js#L618)

---

## CAUSA RAIZ #3: DUPLICATE FUNCTION DEFINITIONS EM audio-analyzer-integration.js
**Severidade: 🟠 ALTA** | **Impacto: Render flow ambíguo, tabela antiga renasce**

### 3A: Duas definições de displayModalResults
Linhas **3001** e **15753** — segunda sobrescreve primeira em runtime

| Def | Linha | Tipo | Comportamento | Status |
|-----|-------|------|---|---|
| v1 | L3001-L4600 | Simples syncro | Renderiza `ref-compare-table` (antigo) | ❌ Desatualizada |
| v2 | L15753-L21642 | Async completo | Renderiza `genre-view` + nova tabela | ✅ Ativa |

**Problema:** Se v2 é definida depois mas interceptores de v1 rodam antes dessa definição → wrappers chamam v1 original → renderiza tabela antiga.

### 3B: Duas definições de renderReferenceComparisons
Linhas **4392** e **22320**

| Def | Linha | Uso | Tabela |
|-----|-------|-----|--------|
| v1 | L4392 | ❌ Desatualizada | ref-compare antiga |
| v2 | L22320 | ✅ Com guards extensos | tabela nova (NÃO chamada em modo genre) |

**Problema:** Se fluxo segue para L4392 em vez de L22320 → renderiza tabela que você removeu do projeto.

### 3C: Fluxo de gênero duplicado dentro de displayModalResults v2
Linhas **21375-21380** E **21498-21501** — MESMO bloco, DUAS vezes

```javascript
// Primeira execução (L21375-21380):
if (analysis.mode === 'genre') {
  renderGenreView(analysis);
  return; // ← EARLY RETURN AQUI
}

// Segunda execução (L21498-21501):
if (analysis.mode === 'genre') {
  console.log("STEP 6");
  // renderGenreView novamente? (nunca executa por causa do return acima)
}
```

**Problema:** 
- Early return na primeira bloqueia qualquer código após L21380
- Mas há um segundo bloco `if (mode === 'genre')` que parece duplicado
- Se o second bloco era uma "tentativa de fallback", ele **nunca executa** por causa do return anterior
- Causa confusão e possível perda de render se a primeira passagem falhava silenciosamente

---

## CAUSA RAIZ #4: EARLY RETURNS BLOQUEANDO RENDER CHAIN
**Severidade: 🔴 CRÍTICA** | **Impacto: Score, veredito, tabela gênero não renderizam**

### Gates dentro de displayModalResults v2 (L15753-L21642)

| Gate | Linha | Condição | Bloqueia | Efeito |
|------|-------|----------|----------|--------|
| **Gate #1** | L16541 | `!analysis` | TUDO | Score, veredito, modo, tudo |
| **Gate #2** | L17312 | `analysis.mode === 'single'` | Fora do modo single | Retorna cedo se não for single |
| **Gate #3** | L17323 | `analysis.mode === 'reference'` | Fora do modo ref | Retorna cedo se não for reference |
| **Gate #4 (renderFinalScoreAtTop)** | L21003-L21009 | `scores.final` inválido | Tudo após render | **MITIGADO com fallback** |
| **Gate #5** | L21375 | `analysis.mode === 'genre'` | Duplicado bloco abaixo | `return;` bloqueia segunda execução |
| **Gate #6** | L21323 | Dentro renderGenreView | Sem genreTargets | Bloqueia tabela gênero |

### Fluxo crítico: renderFinalScoreAtTop (L20998-L21085)

```javascript
function renderFinalScoreAtTop(scores) {
  // L21003-21009: Validação COM fallback (mitigação parcial — user-applied)
  if (!isFinite(scores.final)) {
    scores = { final: 50, intermediate: 0 };
  }
  // ... resto renderiza com fallback
}
```

**Problema original:** Se `analysis.scores` **não existe** ou **scores.final é undefined** ANTES do fallback, retorna em L21003 mesmo com patch.

**Status:** Parcialmente mitigado via fallback, mas ainda vulnerável se `analysis.scores` object inteiro está undefined.

---

## CAUSA RAIZ #5: VEREDITO NÃO RENDERIZA
**Severidade: 🟠 ALTA** | **Impacto: #diagnostic-container vazio**

### Localização
- **Chamada:** [audio-analyzer-integration.js L21340-L21343](public/audio-analyzer-integration.js#L21340)
- **Padrão:** `setTimeout(() => renderDiagnostic(...), 500)`
- **Dependência:** `window.buildDiagnosticContext()` DEVE estar disponível

### Problema
1. `renderDiagnostic()` requer `window.buildDiagnosticContext` estar definido
2. `buildDiagnosticContext` é definido em **QUAL ARQUIVO?** (NÃO IDENTIFICADO NA AUDITORIA — precisa verificar)
3. Timeout de 500ms pode ser insuficiente se scripts carregam lentamente
4. **Se renderFinalScoreAtTop faz early return (Gate #4), renderDiagnostic NUNCA executa** (está após na cadeia)

### Gates que bloqueiam veredito
1. Gate #4 em renderFinalScoreAtTop (L21003) → bloqueia tudo que vem depois
2. Se `buildDiagnosticContext` não existe → erro silencioso em setTimeout
3. 500ms timeout pode disparar antes de dependências carregarem

---

## CAUSA RAIZ #6: TABELA ANTIGA REAPARECE
**Severidade: 🟠 ALTA** | **Impacto: UX — usuário vê interface antiga ao expandir diagnóstico**

### Fluxo que executa tabela antiga
1. **displayModalResults v1** (L3001) é chamada (via race condition de wrapper)
2. L4181: chama `renderReferenceComparisons()` — renderiza tabela antiga
3. `#referenceComparisons` container preenchido com HTML antigo
4. **displayModalResults v2** (L15753) depois tenta renderizar em `#modalTechnicalData` (container **DIFERENTE**!)

### Por que ambas coexistem
- v1 renderiza em `#referenceComparisons` (tabela antiga)
- v2 renderiza em `#modalTechnicalData` (novo container gênero)
- Se **ambas executam** (race condition): ambas renderizam em containers diferentes
- Resultado: ambas **visíveis** na mesma página

### Localização exata
- **Tabela v1 (antiga):** [audio-analyzer-integration.js L4181 → L4392](public/audio-analyzer-integration.js#L4181)
- **Tabela v2 (nova):** [audio-analyzer-integration.js L10654-L11244 renderGenreComparisonTable](public/audio-analyzer-integration.js#L10654)
- **Chamada v2:** [audio-analyzer-integration.js L21380 renderGenreView](public/audio-analyzer-integration.js#L21380)

---

## SEQUÊNCIA COMPLETAMENTE DE EXECUÇÃO (O QUE DEVERIA ACONTECER)

```
runAnalysis() 
    ↓
handleGenreAnalysisWithResult() 
    ↓
displayModalResults(analysis) ← QUAL VERSÃO? (v1 vs v2 vs interceptor?)
    ↓ [RACE CONDITION AQUI]
    ↓
renderFinalScoreAtTop(analysis.scores)
    ├─ Gate #4: se scores.final inválido → fallback NOW (mitigado)
    └─ Se retorna aqui → resto não executa ❌
    ↓
renderGenreView(analysis)
    ├─ Carrega genreTargets
    └─ Chama renderGenreComparisonTable()
    ↓
renderGenreComparisonTable() 
    ├─ Constrói tabela expansível com 5 cards
    └─ Popula #modalTechnicalData (container novo)
    ↓
renderDiagnostic() 
    ├─ setTimeout(..., 500ms) ← PROBLEMA: timing incerto
    └─ Precisa window.buildDiagnosticContext() ← DEPENDÊNCIA NÃO RASTREADA
    ↓
[FINAL]
```

---

## RESUMO EXECUTIVO: 6 PROBLEMAS + IMPACTO

| # | Problema | Arquivo | Linha(s) | Root Cause | Fix Requerido |
|---|----------|---------|----------|-----------|---|
| 1 | **Score final não renderiza** | audio-analyzer-integration.js | L21003-L21009 + L20998-L21085 | Gate #4 validação inválida + race condition displayModalResults v1 vs v2 | Consolidar displayModalResults em 1 def, remover v1 completamente, garantir scores antes render |
| 2 | **Veredito não renderiza** | audio-analyzer-integration.js | L21340-L21343 | Timeout 500ms + buildDiagnosticContext NÃO RASTREADO + Gate #4 bloqueia se renderFinalScoreAtTop retorna | Remover timeout, verificar buildDiagnosticContext importado, garantir executa após score render |
| 3 | **Tabela nova não renderiza** | audio-analyzer-integration.js | L21375-L21380 (Gate #5) + L10654 (tabela) | Early return bloqueia downstream + race condition displayModalResults + genreTargets pode não carregar | Remover return antecipado, consolidar modo gênero em um bloco, remover second bloco L21498 |
| 4 | **Tabela antiga reaparece** | audio-analyzer-integration.js | L4181 (renderiza v1) + L4392 (def v1) | Ambas displayModalResults versões executam via race; v1 render legacy HTML em container diferente | Remover displayModalResults v1 completamente (L3001-L4600), forçar v2 apenas, limpar #referenceComparisons no init |
| 5 | **window.displayModalResults undefined** | 4 scripts | L1498 (ai-suggest), L224 (demo-cta), L537 (verdict), L6 (monitor) | 4 scripts sobrescrevem simultaneamente, race condition, ordem não-determinística | Centralizar interception em 1 lugar OR coordenar ordem de execução COM sincronização (ex: callbacks, EventTarget) |
| 6 | **RUNID_ENFORCED SyntaxError** | audio-analyzer.js + audio-analyzer-v2.js | L14 ambos | Dupla declaração idêntica, injeção dinâmica v2 quebra script | Renomear uma constante (ex: `RUNID_ENFORCED_V2`) OR mover para scope único OR condicionar segunda def |

---

## PRÓXIMOS PASSOS PARA VALIDAÇÃO

### 1️⃣ Verificar qual versão de displayModalResults está ativa EM RUNTIME
```javascript
// DevTools Console na home.html após análise:
window.displayModalResults.toString()
// OUTPUT: vai mostrar qual versão está sendo chamada (v1 simples vs v2 async complexo)
```

### 2️⃣ Verificar se buildDiagnosticContext existe
```javascript
// DevTools Console:
typeof window.buildDiagnosticContext
// Se "undefined" → veredito nunca renderiza (missing dependency)
```

### 3️⃣ Verificar ordem de execution de interceptadores
Adicionar `console.log` com timestamp em cada script interceptador:
- ai-suggestions-integration.js L1498: `console.log("AI SUGGEST INTERCEPT", Date.now())`
- demo-cta-force.js L224: `console.log("DEMO CTA INTERCEPT", Date.now())`
- monitor-modal-ultra-avancado.js L6: `console.log("MONITOR INTERCEPT", Date.now())`
- verdict-engine.js L537: `console.log("VERDICT INTERCEPT", Date.now())`

**Resultado esperado:** qual script últimamente escreve em `window.displayModalResults` é o que "vence".

### 4️⃣ Simular SEM interceptadores (teste isolamento)
Temporariamente comentar:
- `/public/ai-suggestions-integration.js`
- `/public/demo-cta-force.js`
- `/public/monitor-modal-ultra-avancado.js`

**Rodar análise gênero.** Se score/veredito/tabela aparecerem → prova que race condition é culpada.

### 5️⃣ Verificar RUNID_ENFORCED conflict
```bash
grep -n "const RUNID_ENFORCED" public/audio-analyzer*.js
# OUTPUT: mostra ambas declarações na mesma linha
```

---

## CONCLUSÃO

**Problema primário:** Race condition em window.displayModalResults causada por 4 scripts interceptadores **sem sincronização**, combinado com:
- Duas definições de displayModalResults (v1 vs v2) no mesmo arquivo
- Conflito de constantes entre audio-analyzer.js e audio-analyzer-v2.js
- Early returns duplos bloqueando render chain
- Missing dependency tracking para buildDiagnosticContext

**Resultado observado:** 
- Score final **não renderiza** (Gate #4 + race condition)
- Veredito **não renderiza** (buildDiagnosticContext missing + timeout incerto)
- Tabela nova **não renderiza** (early return + race condition)
- Tabela antiga **reaparece** (v1 executa via race condition)

**Severidade:** 🔴 **CRÍTICA** — Múltiplos pontos de falha, sem fallback adequado.
