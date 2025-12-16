# 🔍 AUDITORIA CIRÚRGICA - WRITE SITES E DIAGNÓSTICO

**Data:** 16 de dezembro de 2025  
**Auditor:** GitHub Copilot (Claude Sonnet 4.5)  
**Objetivo:** Identificar TODOS os pontos onde mode pode ser contaminado para 'genre' durante fluxo Reference

---

## 📍 SEÇÃO A: WRITE SITES - MAPEAMENTO COMPLETO

### CATEGORIA 1: Escritas Diretas em `currentAnalysisMode`

| # | Arquivo | Linha | Função | Contexto | Valor Escrito | Risco Reference |
|---|---------|-------|--------|----------|---------------|-----------------|
| **W1** | audio-analyzer-integration.js | 2160 | Declaração | Inicialização global | `'genre'` (default) | ✅ SEGURO (inicial) |
| **W2** | audio-analyzer-integration.js | 2390 | selectAnalysisMode | Após state machine setMode | `mode` (parâmetro) | ✅ SEGURO (correto) |
| **W3** | audio-analyzer-integration.js | 5024 | openReferenceUploadModal | Forçar reference na 2ª música | `'reference'` | ✅ SEGURO (correto) |
| **W4** | audio-analyzer-integration.js | 5116 | openAnalysisModalForMode | Definir mode ao abrir modal | `mode` (parâmetro) | ⚠️ **POTENCIAL RACE** |
| **W5** | audio-analyzer-integration.js | 5265 | openAnalysisModalForGenre | Forçar genre no modal de gênero | `'genre'` | 🔴 **CONTAMINAÇÃO** |
| **W6** | audio-analyzer-integration.js | 5314 | openAnalysisModalForMode | Definir mode (duplicado de W4?) | `mode` (parâmetro) | 🔴 **DUPLICAÇÃO** |
| **W7** | audio-analyzer-integration.js | 7766 | (função desconhecida) | Contexto não mapeado | `'reference'` | ❓ INVESTIGAR |
| **W8** | audio-analyzer-integration.js | 8091 | Fallback de erro | FALLBACK_TO_GENRE após erro | `'genre'` | 🔴 **FALLBACK CRÍTICO** |
| **W9** | audio-analyzer-integration.js | 8340 | (função desconhecida) | Contexto não mapeado | `'genre'` | ❓ INVESTIGAR |
| **W10** | audio-analyzer-integration.js | 11007 | (função desconhecida) | Contexto não mapeado | `'reference'` | ❓ INVESTIGAR |

---

### CATEGORIA 2: Chamadas `setViewMode()`

**Função `setViewMode(mode)` - Linha 2180**

**Efeito colateral:** 
```javascript
function setViewMode(mode) {
    // ...
    if (mode === "genre") {
        resetReferenceStateFully();  // 🔴 LIMPA FLAGS REFERENCE
    } else if (mode === "reference") {
        // ... configura reference UI
    }
}
```

| # | Arquivo | Linha | Função Chamadora | Argumento | Risco Reference |
|---|---------|-------|------------------|-----------|-----------------|
| **S1** | audio-analyzer-integration.js | 18 | resetMode | `"genre"` | ✅ SEGURO (reset intencional) |
| **S2** | audio-analyzer-integration.js | 25 | MODE_ENGINE | `"genre"` | ⚠️ **POTENCIAL** (sem ref check) |
| **S3** | audio-analyzer-integration.js | 30 | MODE_ENGINE | `"reference"` | ✅ SEGURO (correto) |
| **S4** | audio-analyzer-integration.js | 6005 | closeAudioModal | `"genre"` | 🔴 **CONTAMINAÇÃO CRÍTICA** |
| **S5** | audio-analyzer-integration.js | 8337 | (função desconhecida) | `"genre"` | ❓ INVESTIGAR |

**DESCOBERTA CRÍTICA:**
- **S4 (linha 6005):** `closeAudioModal()` **SEMPRE** chama `setViewMode("genre")` sem verificar se está em reference mode
- Isso causa chamada de `resetReferenceStateFully()` que **LIMPA FLAGS** mesmo durante aguardo de 2ª música

---

### CATEGORIA 3: Chamadas `resetModalState()`

**Função `resetModalState()` - Linha 7038**

**Efeito:** Limpa `__REFERENCE_JOB_ID__`, `localStorage.referenceJobId`, `FirstAnalysisStore`

**Guard atual:**
```javascript
if (window.__CURRENT_MODE__ === 'genre') {
    return; // Bloqueia reset
}
```

**PROBLEMA:** Guard verifica `__CURRENT_MODE__` (indefinida?) em vez de `stateMachine.getMode()`

| # | Arquivo | Linha | Função Chamadora | Contexto | Risco Reference |
|---|---------|-------|------------------|----------|-----------------|
| **R1** | audio-analyzer-integration.js | 4943 | openReferenceUploadModal | ❌ COMENTADO (removido) | ✅ JÁ CORRIGIDO |
| **R2** | audio-analyzer-integration.js | 5338 | openAnalysisModalForMode | Ao abrir modal para mode | 🔴 **CRÍTICO** (prematura) |
| **R3** | audio-analyzer-integration.js | 6920 | closeAudioModal | Ao fechar modal | 🔴 **CRÍTICO** (durante awaiting) |
| **R4** | audio-analyzer-integration.js | 9917 | HTML onclick | Botão UI | ⚠️ Depende do guard |

**DESCOBERTA CRÍTICA:**
- **R2 (linha 5338):** `openAnalysisModalForMode()` chama `resetModalState()` **ANTES** de iniciar upload
  - Momento: ENTRE seleção do modo (selectAnalysisMode) e upload do arquivo
  - Se guard `__CURRENT_MODE__` estiver desatualizado, **limpa flags que acabaram de ser setadas**
- **R3 (linha 6920):** `closeAudioModal()` chama `resetModalState()`
  - Se modal fechar durante aguardo de 2ª música, **perde referenceJobId**

---

### CATEGORIA 4: Chamadas `resetReferenceStateFully()`

**Função `resetReferenceStateFully(preserveGenre)` - Linha 5435**

**Efeito:** 
- Limpa `userExplicitlySelectedReferenceMode = false`
- Limpa `__REFERENCE_JOB_ID__`
- Limpa `localStorage.referenceJobId`
- Limpa variáveis globais reference

**Guard atual:**
```javascript
const currentMode = window.currentAnalysisMode;
if (currentMode === 'genre') {
    userExplicitlySelectedReferenceMode = false; // ⚠️ Reseta mesmo com guard
    return;
}
```

| # | Arquivo | Linha | Função Chamadora | Contexto | Risco Reference |
|---|---------|-------|------------------|----------|-----------------|
| **F1** | audio-analyzer-integration.js | 2195 | setViewMode | Quando mode="genre" | 🔴 **CONTAMINAÇÃO** (via S4) |
| **F2** | audio-analyzer-integration.js | 2357 | selectAnalysisMode | Quando mode="genre" explícito | ✅ SEGURO (intencional) |
| **F3** | audio-analyzer-integration.js | 5996 | closeAudioModal | Ao fechar modal | 🔴 **CRÍTICO** (via S4) |
| **F4** | audio-analyzer-integration.js | 8328 | (função desconhecida) | Contexto não mapeado | ❓ INVESTIGAR |
| **F5** | audio-analyzer-integration.js | 9039 | (função desconhecida) | Contexto não mapeado | ❓ INVESTIGAR |

**CADEIA DE CONTAMINAÇÃO DESCOBERTA:**
```
closeAudioModal() [linha 6908]
  └─> setViewMode("genre") [linha 6005]
       └─> resetReferenceStateFully() [linha 2195]
            └─> userExplicitlySelectedReferenceMode = false
            └─> delete __REFERENCE_JOB_ID__
            └─> localStorage.removeItem('referenceJobId')
```

**IMPACTO:** Se usuário fechar modal **durante aguardo de 2ª música**, todo o estado reference é destruído.

---

### CATEGORIA 5: Fallback Automático para Genre

**Código crítico identificado - Linha 8091:**
```javascript
if (window.FEATURE_FLAGS?.FALLBACK_TO_GENRE && currentAnalysisMode === 'reference') {
    // ...
    currentAnalysisMode = 'genre';
    configureModalForMode('genre');
}
```

**Contexto:** Dentro de `pollJobStatus()` ou handler de erro

**PROBLEMA:** 
- Fallback **silencioso** de reference para genre quando há erro
- Mascara bugs ao invés de expô-los
- Usuário não é notificado claramente

---

## 🚨 DIAGNÓSTICO DE BLOQUEADORES

### 🔴 CRITICAL - Bloqueadores Imediatos

#### **C1. resetModalState Chamado Prematuramente**
**Local:** `openAnalysisModalForMode()` linha 5338  
**Causa:** Modal abre → chama `resetModalState()` ANTES de upload começar  
**Momento:** Entre `selectAnalysisMode('reference')` e início do upload  
**Impacto:** Se guard falhar, **limpa flags setadas há segundos**  
**Evidência:**
```javascript
function openAnalysisModalForMode(mode) {
    resetModalState();  // 🔴 PREMATURA
    // ... depois abre modal
    window.currentAnalysisMode = mode;  // 🔴 TARDE DEMAIS
}
```

**Fix Obrigatório:**
```javascript
function openAnalysisModalForMode(mode) {
    // Guard: NÃO resetar se mode='reference'
    if (mode !== 'reference') {
        resetModalState();
    }
    // ... resto
}
```

**Risco Genre:** ❌ NENHUM (if só executa em genre)  
**Critério de Aceite:** Reference seleciona modo → modal abre → flags permanecem intactas

---

#### **C2. closeAudioModal Força Genre Sempre**
**Local:** `closeAudioModal()` linhas 6005 + 6920  
**Causa:** Ao fechar modal, **sempre** chama `setViewMode("genre")` + `resetModalState()`  
**Momento:** Usuário fecha modal durante aguardo de 2ª música  
**Impacto:** **Destrói estado reference** completo  
**Evidência:**
```javascript
function closeAudioModal() {
    // ...
    setViewMode("genre");  // 🔴 SEMPRE genre
    resetReferenceStateFully(genreToPreserve);  // 🔴 Limpa reference
    resetModalState();  // 🔴 Limpa storage
}
```

**Fix Obrigatório:**
```javascript
function closeAudioModal() {
    // Guard: NÃO forçar genre se aguardando 2ª track
    const stateMachine = window.AnalysisStateMachine;
    if (!stateMachine || !stateMachine.isAwaitingSecondTrack()) {
        setViewMode("genre");
        resetModalState();
    } else {
        console.log('[CLOSE-MODAL] Reference aguardando 2ª track - preservando estado');
    }
    // ... resto
}
```

**Risco Genre:** ❌ NENHUM (genre não tem awaitingSecondTrack)  
**Critério de Aceite:** Fechar modal durante reference → estado preservado, modal reabre OK

---

#### **C3. Guard de resetModalState Usa Variável Errada**
**Local:** `resetModalState()` linha 7042  
**Causa:** Guard verifica `window.__CURRENT_MODE__` (indefinida)  
**Momento:** Qualquer chamada de `resetModalState()`  
**Impacto:** Guard **sempre falha**, reset sempre executa  
**Evidência:**
```javascript
function resetModalState() {
    if (window.__CURRENT_MODE__ === 'genre') {  // 🔴 __CURRENT_MODE__ não existe
        return;
    }
    // ... limpa tudo
}
```

**Fix Obrigatório:**
```javascript
function resetModalState() {
    // Guard: verificar state machine + fallback para currentAnalysisMode
    const stateMachine = window.AnalysisStateMachine;
    if (stateMachine && stateMachine.getMode() === 'reference') {
        console.warn('[GENRE-PROTECT] resetModalState() BLOQUEADO - reference mode');
        return;
    }
    if (window.currentAnalysisMode === 'reference') {
        console.warn('[GENRE-PROTECT] resetModalState() BLOQUEADO - currentAnalysisMode=reference');
        return;
    }
    // ... resto
}
```

**Risco Genre:** ❌ NENHUM (adiciona guard, não remove)  
**Critério de Aceite:** Reference mode → resetModalState() logado e bloqueado

---

#### **C4. Duplicação de Escrita currentAnalysisMode**
**Local:** `openAnalysisModalForMode()` linhas 5116 e 5314  
**Causa:** Mesma função (ou duas versões?) escrevem mode em 2 pontos  
**Momento:** Ao abrir modal  
**Impacto:** Race condition potencial entre escritas  
**Evidência:** Grep retornou 2 matches na mesma função  

**Fix Obrigatório:** Investigar e consolidar para single write

**Risco Genre:** ⚠️ BAIXO (pode afetar timing)  
**Critério de Aceite:** Apenas 1 escrita de `currentAnalysisMode` por função

---

### 🟠 HIGH - Contaminação Grave

#### **H1. Fallback Silencioso para Genre**
**Local:** Linha 8091 (dentro de polling/erro)  
**Causa:** `FALLBACK_TO_GENRE` ativo + erro em reference → força genre  
**Momento:** Durante análise da 1ª ou 2ª track  
**Impacto:** Mascara bugs, usuário não percebe que mudou para genre  
**Evidência:**
```javascript
if (window.FEATURE_FLAGS?.FALLBACK_TO_GENRE && currentAnalysisMode === 'reference') {
    currentAnalysisMode = 'genre';  // 🔴 Silencioso
    configureModalForMode('genre');
}
```

**Fix Obrigatório:**
```javascript
// REMOVER fallback silencioso OU tornar explícito
if (window.FEATURE_FLAGS?.FALLBACK_TO_GENRE && currentAnalysisMode === 'reference') {
    console.error('[FALLBACK] Reference FALHOU - NÃO fallback automático');
    // Mostrar erro claro ao usuário
    showModalError('Modo Reference falhou. Por favor, tente novamente ou use modo Genre.');
    // NÃO mudar currentAnalysisMode
}
```

**Risco Genre:** ❌ NENHUM (só afeta reference)  
**Critério de Aceite:** Reference erro → mensagem explícita, NÃO muda para genre automaticamente

---

#### **H2. resetReferenceStateFully Reseta Flag Mesmo com Guard**
**Local:** `resetReferenceStateFully()` linha 5444  
**Causa:** Guard detecta mode='genre' mas **ainda reseta** flag  
**Momento:** Qualquer chamada em genre mode  
**Impacto:** Limpa `userExplicitlySelectedReferenceMode` mesmo quando deveria preservar  
**Evidência:**
```javascript
if (currentMode === 'genre') {
    console.log('[GENRE-ISOLATION] Modo GENRE - IGNORANDO reset');
    userExplicitlySelectedReferenceMode = false;  // 🔴 RESETA MESMO ASSIM
    return;
}
```

**Fix Obrigatório:**
```javascript
if (currentMode === 'genre') {
    console.log('[GENRE-ISOLATION] Modo GENRE - IGNORANDO reset');
    // NÃO resetar flag aqui
    return;  // Sair sem tocar em nada
}
```

**Risco Genre:** ❌ NENHUM (flag é de reference)  
**Critério de Aceite:** Genre mode → flag reference não é tocada

---

### 🟡 MEDIUM - Inconsistências

#### **M1. __CURRENT_MODE__ Indefinida**
**Local:** Múltiplos guards  
**Causa:** Variável `window.__CURRENT_MODE__` não tem declaração clara  
**Impacto:** Guards falham, comportamento imprevisível  
**Fix:** Deprecar e usar apenas `stateMachine.getMode()`

#### **M2. Escritas em Locais Não Mapeados**
**Locais:** Linhas 7766, 8340, 11007  
**Causa:** Contexto não identificado no grep  
**Impacto:** Potenciais contaminações não auditadas  
**Fix:** Investigar cada linha manualmente

---

## 📊 MAPA DE RISCO - WRITE SITES

### Matriz de Risco (10 Write Sites principais)

| Write Site | Risco | Frequência | Momento Crítico | Ação Requerida |
|------------|-------|------------|-----------------|----------------|
| **W2** selectAnalysisMode L2390 | ✅ SEGURO | Raro (user click) | Correto | Manter |
| **W4** openAnalysisModalForMode L5116 | ⚠️ RACE | Frequente | Após selectAnalysisMode | Investigar duplicação |
| **W5** openAnalysisModalForGenre L5265 | 🔴 CONTAMINAÇÃO | Raro | Só em genre | Guard adicional |
| **W6** openAnalysisModalForMode L5314 | 🔴 DUPLICAÇÃO | Frequente | Mesmo que W4 | Consolidar |
| **W8** Fallback L8091 | 🔴 CRÍTICO | Raro (erro) | Durante análise | Remover/explicitar |
| **S4** closeAudioModal→setViewMode L6005 | 🔴 CRÍTICO | Frequente (close) | Awaiting 2nd track | Guard isAwaitingSecondTrack |
| **R2** openAnalysisModalForMode→reset L5338 | 🔴 CRÍTICO | Frequente | Prematura (antes upload) | Guard mode !== 'reference' |
| **R3** closeAudioModal→reset L6920 | 🔴 CRÍTICO | Frequente (close) | Awaiting 2nd track | Guard isAwaitingSecondTrack |
| **F1** setViewMode→resetReferenceFully L2195 | 🔴 CONTAMINAÇÃO | Via S4 | Cadeia de close | Fix S4 resolve F1 |
| **F3** closeAudioModal→resetReferenceFully L5996 | 🔴 CRÍTICO | Frequente (close) | Awaiting 2nd track | Guard isAwaitingSecondTrack |

---

## 🎯 CADEIA DE CAUSAS - FLUXO REAL

### Cenário Real: Usuário Seleciona Reference e Fecha Modal

```
1. Usuário clica "Comparação A/B"
   └─> selectAnalysisMode('reference') [L2306]
        ├─> stateMachine.setMode('reference') ✅
        └─> currentAnalysisMode = 'reference' ✅

2. Sistema abre modal
   └─> openAnalysisModalForMode('reference') [L5290]
        ├─> resetModalState() [L5338] 🔴 PREMATURA
        │    └─> Guard verifica __CURRENT_MODE__ (undefined) → FALHA
        │    └─> delete __REFERENCE_JOB_ID__ ❌
        │    └─> localStorage.removeItem('referenceJobId') ❌
        └─> currentAnalysisMode = 'reference' [L5314] ⚠️ TARDE

3. Usuário fecha modal (sem fazer upload)
   └─> closeAudioModal() [L6908]
        ├─> setViewMode("genre") [L6005] 🔴 FORÇA GENRE
        │    └─> resetReferenceStateFully() [L2195]
        │         └─> userExplicitlySelectedReferenceMode = false ❌
        ├─> resetReferenceStateFully(genreToPreserve) [L5996] 🔴 DUPLICADO
        └─> resetModalState() [L6920] 🔴 DUPLICADO
             └─> Limpa tudo novamente ❌

4. Sistema agora está em mode='genre' ❌
   └─> Reference foi destruído sem o usuário fazer nada
```

**CONCLUSÃO:** Reference é destruído em **2 pontos críticos** antes mesmo de começar.

---

## 📋 CHECKLIST DE CORREÇÕES OBRIGATÓRIAS

### Nível CRITICAL (deve corrigir TODOS antes de testar)

- [ ] **C1:** Guard em `openAnalysisModalForMode()` linha 5338 - NÃO chamar `resetModalState()` se mode='reference'
- [ ] **C2:** Guard em `closeAudioModal()` linha 6005/6920 - NÃO chamar `setViewMode("genre")` nem `resetModalState()` se `isAwaitingSecondTrack()`
- [ ] **C3:** Corrigir guard de `resetModalState()` linha 7042 - verificar `stateMachine.getMode()` em vez de `__CURRENT_MODE__`
- [ ] **C4:** Investigar e remover duplicação de escrita `currentAnalysisMode` em `openAnalysisModalForMode()`

### Nível HIGH (corrigir antes de produção)

- [ ] **H1:** Remover ou explicitar fallback para genre linha 8091
- [ ] **H2:** Remover reset de flag em guard de `resetReferenceStateFully()` linha 5444

### Nível MEDIUM (corrigir quando possível)

- [ ] **M1:** Deprecar `__CURRENT_MODE__`, usar apenas `stateMachine.getMode()`
- [ ] **M2:** Investigar escritas nas linhas 7766, 8340, 11007

---

## 🔬 PRÓXIMOS PASSOS (SEÇÕES B-E)

Seção A concluída. Aguardando aprovação para prosseguir:

- **Seção B:** Confirmar autoridade da State Machine (ordem de scripts, logs de inicialização)
- **Seção C:** Auditar e corrigir payload Reference (buildReferencePayload contaminação)
- **Seção D:** Garantir state machine avança após 1ª track (setReferenceFirstResult nunca chamado)
- **Seção E:** Backend contrato Reference (mode='reference' + referenceComparison obrigatório)

**Recomendação:** Implementar correções C1-C4 primeiro (nível CRITICAL) e testar antes de continuar.
