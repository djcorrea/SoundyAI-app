# 🔍 PR-REFERENCE-AUDIT.md - Diagnóstico do Modo Reference

**Data:** 15 de dezembro de 2025  
**Auditor:** GitHub Copilot (Claude Sonnet 4.5)  
**Objetivo:** Diagnosticar bloqueio do modo reference pela state machine

---

## 🎯 PROBLEMA REPORTADO

**Erro:** "Cannot start reference first track: mode is not reference"  
**Contexto:** State machine bloqueia fluxo reference e ocorre fallback para genre

---

## 📋 MAPEAMENTO DE FONTES DE VERDADE

### 1. **currentAnalysisMode** (20+ ocorrências)

| Arquivo | Linha | Operação | Modo | Descrição |
|---------|-------|----------|------|-----------|
| audio-analyzer-integration.js | 2160 | Declaração | Ambos | `let currentAnalysisMode = 'genre'` |
| audio-analyzer-integration.js | 2310 | Leitura | Ambos | `const previousMode = window.currentAnalysisMode` |
| audio-analyzer-integration.js | 2384 | **ESCRITA** | Ambos | `window.currentAnalysisMode = mode` (selectAnalysisMode) |
| audio-analyzer-integration.js | 5005 | **ESCRITA** | Reference | `currentAnalysisMode = 'reference'` (openReferenceUploadModal) |
| audio-analyzer-integration.js | 5097 | **ESCRITA** | Ambos | `currentAnalysisMode = mode` (openAnalysisModalForMode) |
| audio-analyzer-integration.js | 5246 | **ESCRITA** | Genre | `window.currentAnalysisMode = 'genre'` (openGenreAnalysisModal) |
| audio-analyzer-integration.js | 5295 | **ESCRITA** | Ambos | `window.currentAnalysisMode = mode` (openAnalysisModalForMode) |

**ANÁLISE:** 
- ✅ Setado corretamente em `selectAnalysisMode()` linha 2384
- ⚠️ Possível sobrescrita em `openAnalysisModalForMode()` linha 5295
- 🔴 **SUSPEITO**: Múltiplas escritas podem causar race condition

---

### 2. **userExplicitlySelectedReferenceMode** (20+ ocorrências)

| Arquivo | Linha | Operação | Valor | Contexto |
|---------|-------|----------|-------|----------|
| audio-analyzer-integration.js | 2171 | Declaração | `false` | Inicialização |
| audio-analyzer-integration.js | 2354 | **RESET** | `false` | selectAnalysisMode (genre) |
| audio-analyzer-integration.js | 2370 | **SET** | `true` | selectAnalysisMode (reference) ✅ |
| audio-analyzer-integration.js | 5424 | **RESET** | `false` | resetReferenceStateFully |
| audio-analyzer-integration.js | 5433 | **RESET** | `false` | resetReferenceStateFully (duplicado?) |

**ANÁLISE:**
- ✅ Flag setada corretamente quando usuário seleciona reference
- 🔴 **PROBLEMA**: Resetada em `resetReferenceStateFully()` - pode executar após seleção?
- 🔴 **SUSPEITO**: Reset duplicado nas linhas 5424 e 5433

---

### 3. **AnalysisStateMachine.setMode()** (1 ocorrência)

| Arquivo | Linha | Operação | Contexto |
|---------|-------|----------|----------|
| audio-analyzer-integration.js | 2333 | **SET** | `stateMachine.setMode(mode, { userExplicitlySelected: true })` |

**ANÁLISE:**
- ✅ State machine setada CORRETAMENTE em `selectAnalysisMode()`
- ⚠️ **CRÍTICO**: Esta é a ÚNICA vez que setMode é chamada
- 🔍 Verificar se state machine persiste após esta linha

---

### 4. **setViewMode()** (6 ocorrências)

| Arquivo | Linha | Operação | Modo | Contexto |
|---------|-------|----------|------|----------|
| audio-analyzer-integration.js | 18 | Chamada | "genre" | Dentro de resetMode() |
| audio-analyzer-integration.js | 25 | Chamada | "genre" | Se reference sem jobId |
| audio-analyzer-integration.js | 30 | Chamada | "reference" | Se reference com jobId |
| audio-analyzer-integration.js | 2180 | **DEFINIÇÃO** | - | Função setViewMode(mode) |
| audio-analyzer-integration.js | 5986 | Chamada | "genre" | closeAudioModal |
| audio-analyzer-integration.js | 8318 | Chamada | "genre" | Dentro de alguma lógica |

**ANÁLISE:**
- ⚠️ setViewMode("genre") chamado em múltiplos lugares
- 🔴 **CRÍTICO**: Linha 5986 - `closeAudioModal()` força viewMode="genre"
- 🔴 **SUSPEITO**: Linha 8318 pode ser chamado durante fluxo reference

---

### 5. **resetModalState()** (3 ocorrências ativas)

| Arquivo | Linha | Operação | Contexto |
|---------|-------|----------|----------|
| audio-analyzer-integration.js | 5319 | **CHAMADA** | openAnalysisModalForMode |
| audio-analyzer-integration.js | 6901 | **CHAMADA** | closeAudioModal |
| audio-analyzer-integration.js | 7019 | **DEFINIÇÃO** | Função resetModalState() |

**ANÁLISE:**
- ⚠️ Linha 7024: Guard BLOQUEIO se `__CURRENT_MODE__ === 'genre'`
- 🔴 **PROBLEMA**: Guard verifica `__CURRENT_MODE__`, NÃO `currentAnalysisMode`
- 🔴 **CRÍTICO**: `resetModalState()` pode ser chamado ANTES de iniciar upload reference

---

## 🔍 SEQUÊNCIA DE EVENTOS (HIPÓTESE)

### Fluxo Esperado (Reference)
```
1. Usuário clica "Comparação A/B"
2. selectAnalysisMode('reference') executa:
   - stateMachine.setMode('reference', { userExplicitlySelected: true }) ✅
   - userExplicitlySelectedReferenceMode = true ✅
   - window.currentAnalysisMode = 'reference' ✅
3. openAnalysisModalForMode('reference') executa:
   - resetModalState()? ⚠️
   - window.currentAnalysisMode = mode ✅
4. Upload arquivo
5. handleModalFileSelection() executa:
   - createAnalysisJob('reference')
   - stateMachine.startReferenceFirstTrack()
```

### Fluxo Real (Com Bug)
```
1. ✅ selectAnalysisMode('reference')
   - stateMachine.mode = 'reference'
   - userFlag = true
   
2. ⚠️ openAnalysisModalForMode('reference')
   - Chama resetModalState() linha 5319
   - resetModalState() PODE rodar se guard falhar
   
3. 🔴 resetModalState() executa:
   - Guard verifica __CURRENT_MODE__ (pode ser null/genre ainda)
   - Se guard falhar, executa limpeza
   - userExplicitlySelectedReferenceMode pode ser resetada? ❓
   
4. ⚠️ Algum ponto entre 2-3:
   - window.currentAnalysisMode sobrescrito?
   - stateMachine.mode perdido?
   
5. ❌ handleModalFileSelection()
   - stateMachine.mode = null ou 'genre'
   - startReferenceFirstTrack() FALHA
   - Erro: "mode is not reference"
```

---

## 🚨 CULPADOS PROVÁVEIS (Top 3)

### 🥇 CULPADO #1: `resetModalState()` chamado prematuramente

**Arquivo:** audio-analyzer-integration.js  
**Linha:** 5319 (dentro de `openAnalysisModalForMode`)  
**Evidência:**
```javascript
function openAnalysisModalForMode(mode) {
    // ...
    resetModalState(); // ⚠️ LINHA 5319
    // ...
}
```

**Problema:**
- `resetModalState()` pode executar ANTES do state machine ser consultada
- Guard usa `__CURRENT_MODE__` que pode estar desatualizado
- Pode resetar flags antes do upload começar

**Correção Proposta:**
- Adicionar guard em `resetModalState()` que verifica `stateMachine.getMode()`
- OU remover `resetModalState()` de `openAnalysisModalForMode()` quando mode='reference'

---

### 🥈 CULPADO #2: Race condition entre setMode e variáveis legacy

**Arquivo:** audio-analyzer-integration.js  
**Linha:** 2333 + 2384  
**Evidência:**
```javascript
// Linha 2333: State machine setada
stateMachine.setMode(mode, { userExplicitlySelected: true });

// Linha 2384: Variável legacy setada DEPOIS
window.currentAnalysisMode = mode;
```

**Problema:**
- Código entre linhas 2333-2384 pode executar e sobrescrever
- Se algo rodar assíncrono, mode pode ser perdido
- State machine e legacy não sincronizam

**Correção Proposta:**
- Setar `window.currentAnalysisMode` ANTES de `stateMachine.setMode()`
- OU remover completamente variável legacy (apenas state machine)

---

### 🥉 CULPADO #3: `setViewMode("genre")` forçado em closeAudioModal

**Arquivo:** audio-analyzer-integration.js  
**Linha:** 5986  
**Evidência:**
```javascript
function closeAudioModal() {
    // ...
    setViewMode("genre"); // ⚠️ LINHA 5986 - FORÇA GENRE
    // ...
}
```

**Problema:**
- Se modal fechar durante fluxo reference, força viewMode para genre
- `setViewMode("genre")` chama `resetReferenceStateFully()` linha 2194
- Pode contaminar estado reference

**Correção Proposta:**
- Adicionar guard: só chamar `setViewMode("genre")` se não estiver em reference flow
- Verificar `stateMachine.isAwaitingSecondTrack()` antes de forçar genre

---

## 🧪 REPRODUÇÃO GUIADA (Checklist)

### Pré-requisitos
- [ ] Abrir console (F12)
- [ ] Executar `window.DEBUG_REFERENCE_AUDIT = true`
- [ ] Recarregar página (F5)
- [ ] Confirmar mensagem: "Watchers installed"

### Passo 1: Selecionar Modo Reference
- [ ] Clicar em "Análise de Áudio"
- [ ] Selecionar "Comparação A/B (Referência)"
- [ ] **Verificar no console:**
  - `[🔍 REF-AUDIT] BEFORE_SET_MODE`
  - `[🔍 REF-AUDIT] AFTER_SET_MODE`
  - Confirmar: `mode: "reference"`, `userExplicitlySelected: true`

### Passo 2: Upload Arquivo
- [ ] Escolher arquivo de áudio
- [ ] Clicar em "Analisar"
- [ ] **Verificar no console:**
  - `[🔍 REF-AUDIT] START_HANDLE_MODAL_FILE_SELECTION`
  - `[🔍 REF-AUDIT] BEFORE_START_REFERENCE_FIRST_TRACK`

### Passo 3: Capturar Mudanças
- [ ] Executar `analyzeReferenceAudit()` no console
- [ ] **Procurar por:**
  - `[⚠️ MODE-CHANGE]` - Mudanças de modo
  - Stack trace das mudanças
  - Linha exata da mudança

### Passo 4: Identificar Culpado
- [ ] Analisar output de `analyzeReferenceAudit()`
- [ ] Verificar `changes` array
- [ ] Identificar primeira mudança `reference → genre` ou `reference → null`
- [ ] Copiar stack trace

---

## 📊 INSTRUMENTAÇÃO ADICIONADA

### debugDump() - Pontos de Captura
1. `BEFORE_SET_MODE` - Antes de setar state machine
2. `AFTER_SET_MODE` - Depois de setar state machine
3. `AFTER_RESET_MODAL_STATE` - Depois de resetModalState()
4. `START_HANDLE_MODAL_FILE_SELECTION` - Início do upload
5. `BEFORE_START_REFERENCE_FIRST_TRACK` - Antes de iniciar first track
6. `AFTER_START_REFERENCE_FIRST_TRACK` - Depois de iniciar first track
7. `ENTER_SET_VIEW_MODE` - Entrada em setViewMode()
8. `EXIT_SET_VIEW_MODE` - Saída de setViewMode()
9. `BEFORE_GUARD_STATE_MACHINE` - Antes do guard em openReferenceUploadModal

### Watchers Instalados
1. `window.currentAnalysisMode` - Loga toda mudança + stack trace
2. `window.userExplicitlySelectedReferenceMode` - Loga toda mudança + stack trace

### Funções de Análise
- `analyzeReferenceAudit()` - Gera relatório de auditoria
- `exportReferenceAudit()` - Exporta log como JSON
- `clearReferenceAudit()` - Limpa log

---

## 💊 PATCH PROPOSTO (Correção Mínima)

### Opção 1: Guard em resetModalState baseado em State Machine

```javascript
function resetModalState() {
    // FIX_REFERENCE_MODE_SYNC
    if (window.FIX_REFERENCE_MODE_SYNC) {
        const stateMachine = window.AnalysisStateMachine;
        if (stateMachine && stateMachine.getMode() === 'reference') {
            console.warn('[FIX] resetModalState BLOQUEADO - state machine em reference');
            return;
        }
    }
    
    // Resto da função...
}
```

### Opção 2: Remover resetModalState de openAnalysisModalForMode quando reference

```javascript
function openAnalysisModalForMode(mode) {
    console.log(`📂 [AUDIO-MODAL] Abrindo modal para modo: ${mode}`);
    
    // FIX_REFERENCE_MODE_SYNC
    if (!window.FIX_REFERENCE_MODE_SYNC || mode !== 'reference') {
        resetModalState();
    }
    
    // Resto da função...
}
```

### Opção 3: Sincronizar variáveis ANTES de state machine

```javascript
function selectAnalysisMode(mode) {
    // FIX_REFERENCE_MODE_SYNC
    if (window.FIX_REFERENCE_MODE_SYNC) {
        // Setar variáveis legacy PRIMEIRO
        window.currentAnalysisMode = mode;
        if (mode === 'reference') {
            userExplicitlySelectedReferenceMode = true;
        }
    }
    
    // Depois setar state machine
    stateMachine.setMode(mode, { userExplicitlySelected: true });
    
    // Resto da função...
}
```

---

## ✅ PRÓXIMOS PASSOS

1. **Testar com Instrumentação:**
   - Executar checklist de reprodução
   - Capturar logs completos
   - Identificar linha exata do culpado

2. **Aplicar Patch:**
   - Escolher opção de correção (1, 2 ou 3)
   - Implementar atrás de flag `FIX_REFERENCE_MODE_SYNC`
   - Testar modo reference
   - Validar modo genre não quebrou

3. **Validar Fix:**
   - Reference primeira track funciona
   - Reference segunda track funciona
   - Genre continua funcionando normalmente
   - Nenhum `[INV_FAIL]` ou `[MODE-CHANGE]` indevido

---

## 📝 CONCLUSÃO PRELIMINAR

**HIPÓTESE PRINCIPAL:**  
`resetModalState()` é chamado em `openAnalysisModalForMode()` (linha 5319) ANTES do fluxo reference iniciar, causando limpeza prematura de flags ou contaminação de estado.

**EVIDÊNCIAS:**
1. State machine setada corretamente em `selectAnalysisMode()`
2. Mas `resetModalState()` executa logo depois
3. Guard de `resetModalState()` verifica variável errada (`__CURRENT_MODE__` em vez de state machine)
4. Possível race condition entre set e reset

**AÇÃO RECOMENDADA:**  
Aplicar **Opção 2** (guard em openAnalysisModalForMode) - menor risco, mais isolado.

**RISCO DE REGRESSÃO:**  
❌ **BAIXO** - Patch afeta apenas fluxo reference, género mantém comportamento atual.

---

**Status:** 🔍 **AGUARDANDO TESTE COM INSTRUMENTAÇÃO**  
**Próximo passo:** Executar checklist de reprodução com `DEBUG_REFERENCE_AUDIT = true`
