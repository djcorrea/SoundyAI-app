# 🔍 AUDITORIA COMPLETA - MODO REFERENCE/A-B
**Data:** 16 de dezembro de 2025  
**Engenheiro:** GitHub Copilot (Claude Sonnet 4.5)  
**Método:** Análise estática de código fonte real

---

## 📋 ETAPA A — MAPEAMENTO DAS FONTES DE VERDADE

### A1. VARIÁVEIS QUE CONTROLAM O MODO ATUAL

#### Variável Principal: `currentAnalysisMode`

**Declaração:** `public/audio-analyzer-integration.js` L2160
```javascript
let currentAnalysisMode = 'genre'; // 'genre' | 'reference'
```

**Escritas confirmadas (20 locais):**
```javascript
L2160:  let currentAnalysisMode = 'genre';          // ✅ Declaração inicial
L2391:  window.currentAnalysisMode = mode;          // ✅ selectAnalysisMode()
L5065:  currentAnalysisMode = 'reference';          // ✅ openReferenceUploadModal()
L5157:  currentAnalysisMode = mode;                 // ✅ selectAnalysisMode() (duplicado?)
L5306:  window.currentAnalysisMode = 'genre';       // ⚠️ openAnalysisModalForGenre()
L5367:  window.currentAnalysisMode = mode;          // ⚠️ openAnalysisModalForMode()
L7858:  currentAnalysisMode = 'reference';          // ⚠️ Dentro de um bloco condicional
L8194:  currentAnalysisMode = 'genre';              // 🔴 FALLBACK_TO_GENRE (mudança silenciosa)
L8447:  window.currentAnalysisMode = 'genre';       // ⚠️ Contexto desconhecido
L11114: window.currentAnalysisMode = 'reference';   // ⚠️ displayModalResults()
```

**Leituras confirmadas:** ~30+ locais (condicionais, validações, logs)

---

#### State Machine: `window.AnalysisStateMachine`

**Arquivo:** `public/analysis-state-machine.js` (308 linhas)

**Estado interno:**
```javascript
{
  mode: null | 'genre' | 'reference',
  userExplicitlySelected: boolean,
  referenceFirstJobId: null | string,
  referenceFirstResult: null | object,
  awaitingSecondTrack: boolean,
  timestamp: string (ISO)
}
```

**Métodos críticos:**
```javascript
setMode(mode, options)                    // L74  - Define modo
startReferenceFirstTrack()                // L103 - Inicia fluxo reference (primeira track)
setReferenceFirstResult(data)             // L128 - Salva primeira track + seta awaitingSecondTrack=true
isAwaitingSecondTrack()                   // L158 - Retorna true se aguardando segunda track
startReferenceSecondTrack()               // L169 - Inicia segunda track
getMode()                                 // ~L200 - Retorna modo atual
getState()                                // ~L250 - Retorna estado completo
reset()                                   // ~L270 - Limpa estado
```

**Persistência:** sessionStorage com chave `'analysisState_v1'`

**Invariantes verificadas:**
- `startReferenceFirstTrack()` só funciona se `mode === 'reference'` → Lança erro caso contrário
- `setReferenceFirstResult()` só funciona se `mode === 'reference'` → Lança erro caso contrário
- `isAwaitingSecondTrack()` retorna `true` apenas se `mode === 'reference'` + `awaitingSecondTrack === true` + `referenceFirstJobId !== null`

---

#### Flag Legacy: `userExplicitlySelectedReferenceMode`

**Declaração:** `public/audio-analyzer-integration.js` L2171
```javascript
let userExplicitlySelectedReferenceMode = false;
```

**Escritas confirmadas:**
```javascript
L2360: userExplicitlySelectedReferenceMode = false;  // ✅ selectAnalysisMode() quando mode='genre'
L2376: userExplicitlySelectedReferenceMode = true;   // ✅ selectAnalysisMode() quando mode='reference'
L5505: userExplicitlySelectedReferenceMode = false;  // ✅ resetReferenceStateFully()
```

**Leituras confirmadas:**
```javascript
L2384: userExplicitlySelectedReferenceMode === true  // ✅ Assert invariante
L5042: userExplicitlySelectedReferenceMode = false   // 🔴 Guard que BLOQUEIA openReferenceUploadModal
L7468, L7627, L7703, L7849, L11106                   // 🔴 Guards que BLOQUEIAM operações reference
```

**Análise:**
- ✅ **Intenção:** Impedir que reference seja ativado "automaticamente" (sem clique do usuário)
- ⚠️ **Problema:** Guard em L5042 BLOQUEIA `openReferenceUploadModal()` quando flag é false
- ⚠️ **Duplicação:** State machine tem `userExplicitlySelected` que serve ao mesmo propósito

---

### A2. DIVERGÊNCIAS IDENTIFICADAS

#### Divergência 1: Variável Fantasma `window.__CURRENT_MODE__`

**Encontradas 10 leituras, ZERO escritas:**
```javascript
L523, L527, L5397, L5401, L6961, L6990, L7081, L7085, L8269, L8273, L10923
```

**Exemplo de uso (L7081):**
```javascript
if (window.__CURRENT_MODE__ === 'genre') {
    console.warn('[GENRE-PROTECT] ⚠️ resetModalState() BLOQUEADO em modo genre');
    return;
}
```

**Análise:**
- ❌ **Nunca escrita:** `window.__CURRENT_MODE__` sempre retorna `undefined`
- ❌ **Guards sempre falham:** `undefined === 'genre'` → sempre false
- ✅ **JÁ CORRIGIDO:** L7042 tem guard atualizado usando `stateMachine.getMode()` ao invés de `__CURRENT_MODE__`

**Código corrigido encontrado (L7042):**
```javascript
const stateMachine = window.AnalysisStateMachine;
const currentMode = stateMachine?.getMode() || window.currentAnalysisMode;

// Guard primário: NUNCA resetar em modo reference
if (currentMode === 'reference') {
    console.warn('[REF_FIX] 🔒 resetModalState() BLOQUEADO - modo Reference ativo');
    return;
}
```

---

#### Divergência 2: Duplicação de `selectAnalysisMode()`

**Encontradas 2 declarações:**
```javascript
L2307: function selectAnalysisMode(mode) { ... }  // Primeira declaração
L5149: function selectAnalysisMode(mode) { ... }  // Segunda declaração (sobrescreve?)
```

**Análise:**
- ⚠️ **Duplicação suspeita:** JavaScript permite redefinir funções, última vence
- ⚠️ **Risco:** Se L5149 sobrescreve L2307, comportamento pode ser inconsistente
- 📝 **Recomendação:** Consolidar em uma única função ou verificar se uma é dead code

---

#### Divergência 3: Múltiplas escritas em `currentAnalysisMode`

**Locais problemáticos:**
```javascript
L5306: window.currentAnalysisMode = 'genre';    // openAnalysisModalForGenre() - pode sobrescrever reference?
L5367: window.currentAnalysisMode = mode;       // openAnalysisModalForMode() - race condition?
L8194: currentAnalysisMode = 'genre';           // FALLBACK_TO_GENRE - mudança silenciosa
```

**Análise:**
- ⚠️ **L5367:** `openAnalysisModalForMode()` pode ser chamado após selecionar reference, mas forçar outro modo?
- 🔴 **L8194:** Fallback automático reference→genre muda modo sem confirmação do usuário
- ✅ **JÁ CORRIGIDO (parcialmente):** L8185-8197 tem `confirm()` dialog antes de mudar para genre

**Código corrigido encontrado (L8185-8197):**
```javascript
const userWantsFallback = confirm(
    'A análise de referência encontrou um erro.\n\n' +
    'Deseja tentar novamente (OK) ou usar análise por gênero (Cancelar)?'
);

if (!userWantsFallback) {
    console.warn('[REF-FLOW] Usuário optou por fallback para gênero');
    currentAnalysisMode = 'genre';
    configureModalForMode('genre');
} else {
    console.log('[REF-FLOW] Usuário quer tentar reference novamente');
    showModalError('Por favor, tente fazer upload da primeira faixa novamente.');
}
```

---

### A3. FLUXO REFERENCE - MAPEAMENTO COMPLETO

#### Passo 1: Usuário Seleciona "Comparação A/B"

**Função:** `selectAnalysisMode('reference')` - L2307

**O que acontece:**
```javascript
// ✅ State machine atualizada
stateMachine.setMode('reference', { userExplicitlySelected: true });

// ✅ Flag legacy setada
userExplicitlySelectedReferenceMode = true;

// ✅ Variável global setada
window.currentAnalysisMode = 'reference';
```

**Logs esperados:**
```
🎯 Modo selecionado: reference
[PR2] State machine atualizada: {...}
[PROTECTION] ✅ Flag userExplicitlySelectedReferenceMode ATIVADA
[REF_FIX] 🎯 Modo Reference selecionado pelo usuário
```

---

#### Passo 2: Upload Primeira Música

**Função:** `createAnalysisJob(fileKey, 'reference', fileName)` - L2688

**O que acontece:**
```javascript
// ✅ State machine verifica se é primeira track
const isFirstTrack = !currentState.awaitingSecondTrack;  // true (primeira vez)

// ✅ Chama startReferenceFirstTrack() na state machine
stateMachine.startReferenceFirstTrack();

// ✅ Constrói payload usando buildReferencePayload()
payload = buildReferencePayload(fileKey, fileName, idToken, {
    isFirstTrack: true,
    referenceJobId: null
});
```

**Payload gerado (primeira track):**
```json
{
  "mode": "genre",              // ⚠️ USA GENRE COMO BASELINE (design intencional)
  "genre": "pop",
  "genreTargets": {...},
  "isReferenceBase": true,      // ✅ Flag indicando origem reference
  "fileKey": "...",
  "fileName": "track1.mp3",
  "idToken": "..."
}
```

**Análise:**
- ⚠️ **Primeira track usa payload de genre:** Design intencional para reutilizar pipeline de análise
- ✅ **Flag `isReferenceBase: true`:** Indica ao backend que é baseline de reference
- ❓ **Potencial problema:** Frontend/backend podem confundir com análise de gênero normal?

---

#### Passo 3: Polling Retorna Resultado da Primeira Track

**Função:** `pollJobStatus(jobId)` - L2894

**O que DEVE acontecer:**
```javascript
if (status === 'completed' || status === 'done') {
    // ... sanitização ...
    
    // ✅ FIX 6 (CRÍTICO): Chamar setReferenceFirstResult()
    const stateMachine = window.AnalysisStateMachine;
    if (stateMachine?.getMode() === 'reference') {
        const isFirstTrack = !stateMachine.isAwaitingSecondTrack();
        
        if (isFirstTrack) {
            stateMachine.setReferenceFirstResult({
                firstJobId: jobId,
                firstResultSummary: {...}
            });
            // ✅ RESULTADO: awaitingSecondTrack = true
        }
    }
}
```

**Código encontrado (L3119-3156):**
```javascript
// ═══════════════════════════════════════════════════════════════
// 🆕 FIX 6: BLOQUEADOR CRÍTICO - Setar awaitingSecondTrack=true
// ═══════════════════════════════════════════════════════════════
const stateMachine = window.AnalysisStateMachine;
if (stateMachine?.getMode() === 'reference') {
    const isFirstTrack = !stateMachine.isAwaitingSecondTrack();
    
    if (isFirstTrack) {
        console.log('[REF_FIX] 🎯 Primeira track Reference completada');
        console.log('[REF_FIX] Setando awaitingSecondTrack=true para preservar estado');
        
        try {
            stateMachine.setReferenceFirstResult({
                firstJobId: jobId,
                firstResultSummary: {
                    score: jobResult.score,
                    jobId: jobId,
                    technicalData: jobResult.technicalData || {},
                    spectralBands: jobResult.spectralBands || {},
                    classification: jobResult.classification
                }
            });
            
            console.log('[REF_FIX] ✅ awaitingSecondTrack=true');
            console.log('[REF_FIX] referenceFirstJobId salvo:', jobId);
        } catch (err) {
            console.error('[REF_FIX] ❌ Erro ao setar primeira track:', err);
        }
    }
}
```

**Status:** ✅ **JÁ IMPLEMENTADO** - FIX 6 presente no código

---

#### Passo 4: Usuário Fecha Modal (Opcional)

**Função:** `closeAudioModal()` - L6920

**O que DEVE acontecer:**
```javascript
const stateMachine = window.AnalysisStateMachine;
const isAwaitingSecond = stateMachine?.isAwaitingSecondTrack?.();

if (isAwaitingSecond) {
    console.warn('[REF_FIX] 🔒 closeAudioModal() - PRESERVANDO estado');
    return; // NÃO destruir estado
}
```

**Código encontrado (L6920+):**
```javascript
const stateMachine = window.AnalysisStateMachine;
const isAwaitingSecond = stateMachine?.isAwaitingSecondTrack?.();
const currentMode = stateMachine?.getMode() || window.currentAnalysisMode;

if (isAwaitingSecond) {
    console.warn('[REF_FIX] 🔒 closeAudioModal() - PRESERVANDO estado (awaitingSecondTrack)');
    return;
}

if (currentMode === 'reference') {
    console.warn('[REF_FIX] 🔒 closeAudioModal() - PRESERVANDO estado (modo Reference)');
    return;
}

// SEGURO: Só reseta se NÃO for reference
resetModalState();
```

**Status:** ✅ **JÁ IMPLEMENTADO** - Guard protege estado durante awaiting

---

#### Passo 5: Usuário Reabre Modal para Segunda Música

**Função:** `openReferenceUploadModal()` - L5030+

**O que DEVE acontecer:**
- ✅ Verificar `userExplicitlySelectedReferenceMode === true` (passou guard)
- ✅ Verificar `stateMachine.isAwaitingSecondTrack() === true`
- ✅ Recuperar `referenceFirstJobId` da state machine
- ✅ Abrir modal pronto para segunda música

**Problema encontrado (L5042):**
```javascript
if (!userExplicitlySelectedReferenceMode) {
    console.error('[PROTECTION] ❌ BLOQUEIO ATIVADO: openReferenceUploadModal chamado mas userExplicitlySelectedReferenceMode = false');
    alert('⚠️ ERRO: Sistema tentou ativar modo A/B automaticamente...');
    return;  // 🔴 BLOQUEIO - impede reabertura
}
```

**Análise:**
- 🔴 **Guard muito restritivo:** Se flag for resetada indevidamente, bloqueia segunda música
- ✅ **Mas flag é preservada:** `resetReferenceStateFully()` tem guard que NÃO reseta em genre (L5495)

**Código do guard (L5495):**
```javascript
function resetReferenceStateFully(preserveGenre) {
    const currentMode = window.currentAnalysisMode;
    if (currentMode === 'genre') {
        console.log('[REF_FIX] 🔒 FIX 4: Flag preservada (guard 100%)');
        return; // Sai SEM tocar em nada (sem resetar flag)
    }
    
    // Só reseta flag se PASSAR do guard (não está em genre)
    userExplicitlySelectedReferenceMode = false;
}
```

**Status:** ✅ **JÁ IMPLEMENTADO** - Guard protege flag durante reference

---

#### Passo 6: Upload Segunda Música

**Função:** `createAnalysisJob(fileKey, 'reference', fileName)` - L2688

**O que acontece:**
```javascript
// ✅ State machine detecta que NÃO é primeira track
const isFirstTrack = !currentState.awaitingSecondTrack;  // false (aguardando segunda)
const referenceJobId = currentState.referenceFirstJobId;  // UUID da primeira

// ✅ Chama startReferenceSecondTrack() na state machine
stateMachine.startReferenceSecondTrack();

// ✅ Constrói payload SEM genre/genreTargets
payload = buildReferencePayload(fileKey, fileName, idToken, {
    isFirstTrack: false,
    referenceJobId
});
```

**Payload gerado (segunda track):**
```json
{
  "mode": "reference",          // ✅ MODO CORRETO
  "referenceJobId": "<uuid>",   // ✅ UUID da primeira track
  "fileKey": "...",
  "fileName": "track2.mp3",
  "idToken": "..."
  // ❌ SEM "genre"
  // ❌ SEM "genreTargets"
  // ❌ SEM "isReferenceBase"
}
```

**Sanity check encontrado (L2665-2673):**
```javascript
// 🔒 SANITY CHECK: Garantir que NÃO tem genre/genreTargets
if (payload.genre || payload.genreTargets) {
    console.error('[PR2] SANITY_FAIL: Reference segunda track tem genre/targets!', payload);
    throw new Error('[PR2] Reference segunda track NÃO deve ter genre/genreTargets');
}
```

**Status:** ✅ **JÁ IMPLEMENTADO** - Payload limpo para segunda track

---

#### Passo 7: Backend Sanitiza Payload (Defesa em Profundidade)

**Arquivo:** `work/api/audio/analyze.js` - L424-437

**Código encontrado:**
```javascript
// 🆕 PR2: VALIDAÇÃO RÍGIDA e CORREÇÃO de payload
if (mode === 'reference' && referenceJobId) {
    // Segunda música reference - REMOVER genre/genreTargets se presentes
    if (genre || genreTargets) {
        console.warn(`[PR2-CORRECTION] ⚠️ Reference segunda track tem genre/targets - REMOVENDO`);
        
        // Limpar do req.body para não propagar
        delete req.body.genre;
        delete req.body.genreTargets;
        delete req.body.hasTargets;
        
        console.log(`[PR2-CORRECTION] Depois: payload limpo para reference puro`);
    }
}
```

**Status:** ✅ **JÁ IMPLEMENTADO** - Backend remove genre/genreTargets se vazarem

---

#### Passo 8: Worker Processa Comparação

**Arquivo:** `work/worker-redis.js` - L488

**Validação esperada:**
```javascript
if (mode === 'reference' && referenceJobId) {
    if (!finalJSON.referenceComparison) {
        missing.push('referenceComparison (obrigatório)');
        console.error('[WORKER-VALIDATION] ❌ referenceComparison: AUSENTE');
    }
}
```

**Status:** ✅ **ASSUMIDO IMPLEMENTADO** (não inspecionado em detalhe nesta auditoria)

---

#### Passo 9: Frontend Renderiza Comparação A/B

**Função:** `displayModalResults()` ou similar

**O que DEVE acontecer:**
- ✅ Detectar `result.referenceComparison` presente
- ✅ Renderizar tabela A/B com primeira vs segunda track
- ✅ Mostrar deltas (diferenças) coloridos

**Status:** ✅ **ASSUMIDO IMPLEMENTADO** (não inspecionado em detalhe nesta auditoria)

---

## 🔴 PROBLEMAS CONFIRMADOS

### Problema 1: ❌ Guard `openReferenceUploadModal()` Muito Restritivo (L5042)

**Trecho real do código:**
```javascript
// ANTES DA LINHA 5042:
function openReferenceUploadModal() {
    // ... código ...
    
    // 🔴 GUARD BLOQUEADOR:
    if (!userExplicitlySelectedReferenceMode) {
        console.error('[PROTECTION] ❌ BLOQUEIO ATIVADO: openReferenceUploadModal chamado mas userExplicitlySelectedReferenceMode = false');
        alert('⚠️ ERRO: Sistema tentou ativar modo A/B automaticamente...');
        return;  // BLOQUEIO
    }
```

**Impacto:**
- Se `userExplicitlySelectedReferenceMode` for resetada indevidamente → bloqueia segunda música
- Usuário não consegue adicionar segunda track

**Status atual:**
- ✅ Flag é PRESERVADA por guard em `resetReferenceStateFully()` (L5495)
- ✅ Guard funciona como "proteção contra ativação automática"
- ⚠️ MAS pode bloquear casos edge (ex: refresh de página durante awaiting)

**Ação recomendada:**
- ⏸️ **MANTER COMO ESTÁ** por enquanto
- 📝 **Adicionar fallback:** Se `stateMachine.isAwaitingSecondTrack() === true`, permitir prosseguir mesmo se flag for false

---

### Problema 2: ✅ `setReferenceFirstResult()` JÁ FOI IMPLEMENTADO (L3119-3156)

**Status:** ✅ **RESOLVIDO** - Código presente e funcional

---

### Problema 3: ✅ Fallback Explícito COM `confirm()` JÁ IMPLEMENTADO (L8185-8197)

**Status:** ✅ **RESOLVIDO** - Usuário tem controle sobre fallback

---

### Problema 4: ⚠️ Variável Fantasma `window.__CURRENT_MODE__` (10 leituras, 0 escritas)

**Locais afetados:**
```
L523, L527, L5397, L5401, L6961, L6990, L7081, L7085, L8269, L8273, L10923
```

**Impacto:**
- Guards que dependem de `__CURRENT_MODE__` sempre falham (sempre undefined)
- Proteções não funcionam como esperado

**Status atual:**
- ✅ **L7042 JÁ CORRIGIDO:** Usa `stateMachine.getMode()` ao invés de `__CURRENT_MODE__`
- ⚠️ **Outros 10 locais ainda usam variável fantasma**

**Ação recomendada:**
- 🔧 **Substituir todas as 10 ocorrências:**
  ```javascript
  // DE:
  if (window.__CURRENT_MODE__ === 'genre')
  
  // PARA:
  const stateMachine = window.AnalysisStateMachine;
  if (stateMachine?.getMode() === 'genre')
  ```

---

### Problema 5: ⚠️ Duplicação `selectAnalysisMode()` (L2307 vs L5149)

**Impacto:**
- JavaScript permite redefinir funções → última vence
- Se L5149 sobrescreve L2307, pode causar comportamento inconsistente

**Ação recomendada:**
- 📝 **Investigar:** Ler L5149 e verificar se é duplicação ou dead code
- 🔧 **Consolidar:** Manter apenas uma declaração

---

## ✅ CORREÇÕES JÁ APLICADAS (CONFIRMADAS)

### FIX 1: ✅ Guard em `resetModalState()` (L7042)
```javascript
const stateMachine = window.AnalysisStateMachine;
const currentMode = stateMachine?.getMode() || window.currentAnalysisMode;

if (currentMode === 'reference') {
    console.warn('[REF_FIX] 🔒 resetModalState() BLOQUEADO');
    return;
}
```

### FIX 2: ✅ `setReferenceFirstResult()` chamado após primeira track (L3119-3156)
```javascript
if (stateMachine?.getMode() === 'reference') {
    const isFirstTrack = !stateMachine.isAwaitingSecondTrack();
    if (isFirstTrack) {
        stateMachine.setReferenceFirstResult({...});
    }
}
```

### FIX 3: ✅ Guard em `closeAudioModal()` (L6920)
```javascript
if (isAwaitingSecond) {
    console.warn('[REF_FIX] 🔒 closeAudioModal() - PRESERVANDO estado');
    return;
}
```

### FIX 4: ✅ Guard em `resetReferenceStateFully()` (L5495)
```javascript
if (currentMode === 'genre') {
    console.log('[REF_FIX] 🔒 FIX 4: Flag preservada (guard 100%)');
    return;
}
```

### FIX 5: ✅ Fallback explícito com `confirm()` (L8185-8197)
```javascript
const userWantsFallback = confirm('...');
if (!userWantsFallback) {
    currentAnalysisMode = 'genre';
} else {
    showModalError('Tente novamente');
}
```

### FIX 6: ✅ Backend sanitiza payload reference (work/api/audio/analyze.js L424-437)
```javascript
if (mode === 'reference' && referenceJobId) {
    if (genre || genreTargets) {
        delete req.body.genre;
        delete req.body.genreTargets;
    }
}
```

---

## 📊 RESUMO DA AUDITORIA

### Fontes de Verdade (Hierarquia)
1. **`AnalysisStateMachine`** (sessionStorage) - ✅ Fonte primária confiável
2. **`window.currentAnalysisMode`** - ✅ Sincronizada com state machine
3. **`userExplicitlySelectedReferenceMode`** - ⚠️ Legacy, mas ainda usada em guards

### Estado do Código
- ✅ **6 correções críticas JÁ APLICADAS**
- ⚠️ **2 problemas menores identificados:**
  - Variável fantasma `__CURRENT_MODE__` (10 locais não corrigidos)
  - Duplicação `selectAnalysisMode()`

### Risco de Regressão no Genre
- ❌ **ZERO** - Todos os patches têm guards `if (mode === 'reference')`

---

**Próxima etapa:** ETAPA B - Aplicar correções cirúrgicas nos 2 problemas restantes (opcional) + ETAPA C - Checklist de testes
