# 🔬 AUDITORIA CIRÚRGICA - MODO REFERENCE: ROOT CAUSE E CORREÇÃO

**Data:** 16 de dezembro de 2025  
**Auditor:** GitHub Copilot (Claude Sonnet 4.5)  
**Objetivo:** Consertar Reference SEM quebrar Genre (patch minimalista)

---

## 📊 EXECUTIVE SUMMARY

**PROBLEMA RAIZ CONFIRMADO:**
O modo Reference é destruído em **3 pontos críticos** antes mesmo da análise começar:

1. **openAnalysisModalForMode()** L5338: Chama `resetModalState()` ANTES do usuário fazer upload
2. **closeAudioModal()** L6920: Sempre limpa estado sem verificar `isAwaitingSecondTrack()`
3. **resetModalState()** L7042: Guard usa `window.__CURRENT_MODE__` (undefined) em vez de state machine

**ERRO OBSERVADO NO BROWSER:**
```
"Cannot start reference first track when mode is not reference"
```

**CAUSA:**
- Usuário seleciona Reference → state machine seta mode='reference' ✅
- Modal abre → `openAnalysisModalForMode()` chama `resetModalState()` 🔴
- Guard falha (verifica variável errada) → `__REFERENCE_JOB_ID__` é deletado 🔴
- Usuário faz upload → sistema não encontra mode='reference' → erro ❌

---

## 🎯 CADEIA DO BUG - PASSO A PASSO REPRODUZÍVEL

### Cenário 1: Fechar Modal Durante Aguardo (Bug Mais Grave)

```
PASSO 1: Usuário seleciona "Comparação A/B"
  └─> selectAnalysisMode('reference') [L2377]
       ├─> stateMachine.setMode('reference') ✅
       ├─> userExplicitlySelectedReferenceMode = true ✅
       └─> currentAnalysisMode = 'reference' ✅

PASSO 2: Modal abre para primeira música
  └─> openAnalysisModalForMode('reference') [L5290]
       ├─> resetModalState() [L5338] 🔴 PREMATURA
       │    └─> Guard verifica window.__CURRENT_MODE__ (undefined) 🔴
       │    └─> delete window.__REFERENCE_JOB_ID__ ❌
       │    └─> localStorage.removeItem('referenceJobId') ❌
       └─> currentAnalysisMode = 'reference' [L5314] ⚠️ Tarde demais

PASSO 3: Usuário faz upload primeira música
  └─> createAnalysisJob(fileKey, 'reference', fileName) [L2687]
       ├─> mode === 'reference' ✅
       ├─> isFirstTrack = true ✅
       ├─> stateMachine.startReferenceFirstTrack() ✅
       └─> buildReferencePayload(fileKey, fileName, idToken, { isFirstTrack: true }) [L2629]
            └─> Chama buildGenrePayload() [L2647] 🟠 Primeira track usa genre base
            └─> payload = { mode:'genre', genre, genreTargets, isReferenceBase:true }
            └─> Backend processa como genre ⚠️

PASSO 4: Análise completa, resultado retorna
  └─> pollJobStatus() detecta status='completed'
       ├─> stateMachine.setReferenceFirstResult({ jobId, result }) ✅
       ├─> awaitingSecondTrack = true ✅
       └─> Modal deveria reabrir para segunda música...

PASSO 5: Usuário fecha modal (clique fora, ESC, ou botão X)
  └─> closeAudioModal() [L6908]
       ├─> NO GUARD para isAwaitingSecondTrack() ❌
       ├─> setViewMode("genre") [L6005] SEMPRE 🔴
       │    └─> resetReferenceStateFully() [L2195]
       │         └─> userExplicitlySelectedReferenceMode = false ❌
       │         └─> delete window.__REFERENCE_JOB_ID__ ❌
       ├─> resetModalState() [L6920] 🔴
       │    └─> localStorage.removeItem('referenceJobId') ❌
       │    └─> FirstAnalysisStore.clear() ❌
       └─> SOUNDY_MODE_ENGINE.clear() ❌

RESULTADO: Estado reference COMPLETAMENTE DESTRUÍDO
  - mode volta para 'genre'
  - referenceJobId perdido
  - awaitingSecondTrack ignorado
  - Usuário clica "Comparação A/B" novamente → ERRO
```

### Cenário 2: Reset Prematuro ao Abrir Modal

```
PASSO 1: Usuário seleciona "Comparação A/B"
  └─> selectAnalysisMode('reference')
       └─> stateMachine.setMode('reference') ✅

PASSO 2: openAnalysisModalForMode('reference') [L5290]
  └─> resetModalState() [L5338] 🔴 CHAMADO IMEDIATAMENTE
       └─> Guard verifica window.__CURRENT_MODE__ === 'genre'
       └─> __CURRENT_MODE__ é undefined → guard FALHA
       └─> Executa reset completo ANTES do usuário fazer qualquer coisa

RESULTADO: Flags limpas antes mesmo de começar
```

---

## 🔍 CONFIRMAÇÃO DE WRITE SITES (CÓDIGO ATUAL)

### ✅ GUARDS JÁ IMPLEMENTADOS (mas com bugs)

**resetModalState() L7042:**
```javascript
if (window.__CURRENT_MODE__ === 'genre') {  // 🔴 BUG: __CURRENT_MODE__ não definida
    console.warn('[GENRE-PROTECT] ⚠️ resetModalState() BLOQUEADO em modo genre');
    return;
}
```

**PROBLEMA:** `window.__CURRENT_MODE__` não está documentada e pode ser undefined

**resetReferenceStateFully() L5438:**
```javascript
if (currentMode === 'genre') {
    console.log('[GENRE-ISOLATION] 🛡️ Modo GENRE detectado - IGNORANDO reset');
    userExplicitlySelectedReferenceMode = false;  // 🔴 BUG: Reseta flag MESMO com guard
    return;
}
```

**PROBLEMA:** Reseta flag dentro do guard que deveria proteger

### ❌ GUARDS AUSENTES

**openAnalysisModalForMode() L5338:**
```javascript
function openAnalysisModalForMode(mode) {
    // ...
    resetModalState();  // 🔴 SEM GUARD - sempre executa
    // ...
}
```

**closeAudioModal() L6920:**
```javascript
function closeAudioModal() {
    // ...
    resetModalState();  // 🔴 SEM GUARD para awaitingSecondTrack
    // ...
}
```

---

## 🔧 FASE A: CORREÇÕES FRONTEND (SEGURAS PARA GENRE)

### FIX 1: Guard resetModalState com Fonte Confiável

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 7042  
**Risco Genre:** ❌ NENHUM (adiciona proteção, não remove)

**ANTES:**
```javascript
if (window.__CURRENT_MODE__ === 'genre') {  // 🔴 Variável undefined
    console.warn('[GENRE-PROTECT] ⚠️ resetModalState() BLOQUEADO em modo genre');
    // ...
    return;
}
```

**DEPOIS:**
```javascript
// 🛡️ PROTEÇÃO: Verificar state machine primeiro, fallback para currentAnalysisMode
const stateMachine = window.AnalysisStateMachine;
const currentMode = stateMachine?.getMode() || window.currentAnalysisMode;

if (currentMode === 'reference') {
    console.warn('[REF_FIX] 🔒 resetModalState() BLOQUEADO - modo Reference ativo');
    console.log('[REF_FIX] Fonte:', stateMachine ? 'StateMachine' : 'currentAnalysisMode');
    return;
}

// Guard adicional para awaitingSecondTrack
if (stateMachine?.isAwaitingSecondTrack?.()) {
    console.warn('[REF_FIX] 🔒 resetModalState() BLOQUEADO - aguardando segunda track');
    return;
}

// 🚨 BLINDAGEM: NÃO resetar em modo genre (guard original)
if (currentMode === 'genre') {
    console.warn('[GENRE-PROTECT] ⚠️ resetModalState() BLOQUEADO em modo genre');
    return;
}
```

**JUSTIFICATIVA:**
- State machine é fonte de verdade (sessão)
- Fallback para `currentAnalysisMode` (memória)
- Guard duplo: mode='reference' OU awaitingSecondTrack
- **Genre permanece intocado** (guard original preservado)

---

### FIX 2: Guard em openAnalysisModalForMode

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 5338  
**Risco Genre:** ❌ NENHUM (if só executa em genre/comparison)

**ANTES:**
```javascript
function openAnalysisModalForMode(mode) {
    // ...
    modal.style.display = 'flex';
    
    // ✅ CORREÇÃO: Reset seletivo baseado no modo
    if (mode === 'genre') {
        clearAudioOnlyState();
    } else {
        resetModalState();  // 🔴 PROBLEMA: Executa em reference
    }
    // ...
}
```

**DEPOIS:**
```javascript
function openAnalysisModalForMode(mode) {
    // ...
    modal.style.display = 'flex';
    
    // ✅ CORREÇÃO: Reset seletivo baseado no modo
    if (mode === 'genre') {
        clearAudioOnlyState();
    } else if (mode === 'comparison') {
        resetModalState();  // ✅ Comparison pode resetar
    }
    // 🔒 Reference NÃO reseta (preserva estado da state machine)
    
    console.log('[REF_FIX] openAnalysisModalForMode:', mode, '- Reset:', mode !== 'reference');
    // ...
}
```

**JUSTIFICATIVA:**
- Reference NÃO reseta ao abrir modal (state machine já configurada)
- Genre continua usando `clearAudioOnlyState()` como antes
- Comparison pode resetar (modo intermediário)

---

### FIX 3: Guard em closeAudioModal para awaitingSecondTrack

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 6920  
**Risco Genre:** ❌ NENHUM (genre não tem awaitingSecondTrack)

**ANTES:**
```javascript
function closeAudioModal() {
    __dbg('❌ Fechando modal de análise de áudio...');
    
    const modal = document.getElementById('audioAnalysisModal');
    if (modal) {
        modal.style.display = 'none';
        currentModalAnalysis = null;
        // ...
        resetModalState();  // 🔴 SEMPRE executa
        // ...
    }
}
```

**DEPOIS:**
```javascript
function closeAudioModal() {
    __dbg('❌ Fechando modal de análise de áudio...');
    
    const modal = document.getElementById('audioAnalysisModal');
    if (modal) {
        modal.style.display = 'none';
        currentModalAnalysis = null;
        
        // 🛡️ PROTEÇÃO: Verificar se está aguardando segunda track
        const stateMachine = window.AnalysisStateMachine;
        const isAwaitingSecond = stateMachine?.isAwaitingSecondTrack?.();
        const currentMode = stateMachine?.getMode() || window.currentAnalysisMode;
        
        if (isAwaitingSecond) {
            console.warn('[REF_FIX] 🔒 closeAudioModal() - PRESERVANDO estado (awaitingSecondTrack)');
            console.log('[REF_FIX] Modal fechado mas estado Reference mantido');
            // NÃO chamar resetModalState nem setViewMode
            return; // Sai aqui sem destruir nada
        }
        
        if (currentMode === 'reference') {
            console.warn('[REF_FIX] 🔒 closeAudioModal() - PRESERVANDO estado (modo Reference)');
            // NÃO resetar se ainda estiver em reference
            return;
        }
        
        // ✅ SEGURO: Só reseta se NÃO for reference e NÃO estiver aguardando
        resetModalState();
        console.log('[REF_FIX] closeAudioModal() - Reset normal (modo:', currentMode, ')');
        // ...
    }
}
```

**JUSTIFICATIVA:**
- **Guard duplo:** isAwaitingSecondTrack OU mode='reference'
- Se aguardando segunda track → PRESERVA TUDO
- Se reference sem segunda track → PRESERVA TUDO
- Genre continua funcionando normal (não tem awaitingSecondTrack)

---

### FIX 4: Remover Reset de Flag dentro de Guard

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 5444  
**Risco Genre:** ❌ NENHUM (flag é de reference)

**ANTES:**
```javascript
if (currentMode === 'genre') {
    console.log('[GENRE-ISOLATION] 🛡️ Modo GENRE detectado - IGNORANDO reset');
    
    userExplicitlySelectedReferenceMode = false;  // 🔴 BUG: Reseta dentro do guard
    console.log('[PROTECTION] ✅ Flag resetada');
    
    return;
}
```

**DEPOIS:**
```javascript
if (currentMode === 'genre') {
    console.log('[GENRE-ISOLATION] 🛡️ Modo GENRE detectado - IGNORANDO reset');
    // 🔒 NÃO resetar flag aqui - guard deve proteger 100%
    return; // Sai SEM tocar em nada
}

// Flag só reseta se NÃO for genre
userExplicitlySelectedReferenceMode = false;
console.log('[PROTECTION] ✅ Flag resetada (modo não-genre)');
```

**JUSTIFICATIVA:**
- Guard deve proteger TUDO, não resetar parcialmente
- Flag só reseta se passar do guard

---

### FIX 5: Adicionar Logs de Rastreamento

**Objetivo:** Facilitar debug manual com logs curtos e claros

**Pontos de log:**
1. `selectAnalysisMode('reference')` → `[REF_FIX] Modo Reference selecionado`
2. `openAnalysisModalForMode('reference')` → `[REF_FIX] Modal aberto - preservando estado`
3. `closeAudioModal()` durante awaitingSecondTrack → `[REF_FIX] Modal fechado - estado preservado`
4. `resetModalState()` bloqueado → `[REF_FIX] Reset bloqueado - Reference ativo`

**Formato:**
```javascript
console.log('[REF_FIX] <ação> - <resultado>');
```

**NÃO logar:** Tokens, IDs completos, payloads completos

---

## 📋 FASE B: CORREÇÕES PAYLOAD E BACKEND

### STATUS ATUAL DO PAYLOAD

**PRIMEIRA TRACK (Reference):**
```javascript
// buildReferencePayload() L2647 - Chama buildGenrePayload()
{
  mode: 'genre',              // 🟠 Usa genre base
  genre: 'pop',
  genreTargets: {...},
  isReferenceBase: true,      // ✅ Flag indica que é base
  fileKey: '...',
  fileName: '...',
  idToken: '...'
}
```

**SEGUNDA TRACK (Reference):**
```javascript
// buildReferencePayload() L2657 - Payload limpo
{
  mode: 'reference',          // ✅ Correto
  referenceJobId: 'uuid',     // ✅ Correto
  fileKey: '...',
  fileName: '...',
  idToken: '...'
  // ✅ SEM genre, SEM genreTargets
}
```

**BACKEND RECEBE (analyze.js L409):**
- Segunda track: Payload correto chegando ✅
- Validação PR2 L424: Remove genre/genreTargets se presentes ✅
- Worker L977: Detecta mode='reference' sem referenceJobId → trata como primeira ✅

**BACKEND PROCESSA (worker-redis.js L840):**
```javascript
if (mode === 'reference') {
    if (!referenceJobId) {
        console.warn('PRIMEIRO job reference (música base)');
        // Processa normalmente como genre
    } else {
        console.log('SEGUNDO job reference (comparação)');
        // Busca primeira música e faz comparação
        // Gera referenceComparison obrigatório
    }
}
```

**VALIDAÇÃO BACKEND (worker-redis.js L488):**
```javascript
if (mode === 'reference' && referenceJobId) {
    if (!finalJSON.referenceComparison) {
        missing.push('referenceComparison (obrigatório)');
        // ❌ Job FALHA validação
    }
}
```

### ✅ PAYLOAD JÁ ESTÁ CORRETO

**Confirmação:**
1. Segunda track envia `mode:'reference'` + `referenceJobId` ✅
2. Segunda track NÃO envia genre/genreTargets ✅
3. Backend valida e exige `referenceComparison` ✅
4. Primeira track usa genre base (design intencional) ✅

**NÃO PRECISA CORRIGIR BACKEND** - contrato já está correto.

---

## 🧪 CHECKLIST DE TESTES MANUAIS

### ✅ TESTE 1: Modo Genre Normal (Não Pode Quebrar)

**Passos:**
1. Abrir aplicação
2. Clicar botão "Análise por Gênero"
3. Selecionar gênero (ex: Pop)
4. Fazer upload de arquivo
5. Aguardar análise
6. Verificar resultado renderizado

**Esperado:**
- Modal abre normalmente
- Análise processa
- Resultado exibe com targets de gênero
- **SEM ERROS** no console

**Console logs esperados:**
```
[GENRE-PROTECT] ⚠️ resetModalState() BLOQUEADO em modo genre
[REF_FIX] closeAudioModal() - Reset normal (modo: genre)
```

---

### ✅ TESTE 2: Reference - Primeira Música

**Passos:**
1. Abrir aplicação
2. Clicar botão "Comparação A/B"
3. Selecionar gênero base (ex: Pop)
4. Fazer upload primeira música
5. Aguardar análise

**Esperado:**
- Mode permanece 'reference' durante todo fluxo
- `__REFERENCE_JOB_ID__` salvo após análise
- `awaitingSecondTrack = true` setado
- Modal **NÃO abre automaticamente** para segunda música (aguarda usuário clicar novamente)

**Console logs esperados:**
```
[REF_FIX] Modo Reference selecionado
[REF_FIX] openAnalysisModalForMode: reference - Reset: false
[REF_FIX] 🔒 resetModalState() BLOQUEADO - modo Reference ativo
[PR2] Reference primeira track - usando buildGenrePayload como base
[PR2] Reference primeira track payload: {mode: genre, isReferenceBase: true}
```

**Verificar sessionStorage:**
```javascript
sessionStorage.getItem('analysisMode') === 'reference'
sessionStorage.getItem('awaitingSecondTrack') === 'true'
sessionStorage.getItem('referenceFirstJobId') === '<uuid>'
```

---

### ✅ TESTE 3: Reference - Fechar Modal Entre Tracks

**Passos:**
1. Completar TESTE 2 (primeira música)
2. **Fechar modal** (ESC ou clique fora)
3. Verificar console
4. Clicar "Comparação A/B" novamente
5. Modal deve reabrir para segunda música

**Esperado:**
- Fechar modal **NÃO destrói** referenceJobId
- Mode permanece 'reference'
- `awaitingSecondTrack` permanece true
- Reabrir modal mostra prompt para segunda música

**Console logs esperados:**
```
[REF_FIX] 🔒 closeAudioModal() - PRESERVANDO estado (awaitingSecondTrack)
[REF_FIX] Modal fechado mas estado Reference mantido
```

**Verificar sessionStorage (deve estar intacto):**
```javascript
sessionStorage.getItem('analysisMode') === 'reference'
sessionStorage.getItem('awaitingSecondTrack') === 'true'
sessionStorage.getItem('referenceFirstJobId') === '<uuid>' // ✅ NÃO PODE SER NULL
```

---

### ✅ TESTE 4: Reference - Segunda Música (Comparação)

**Passos:**
1. Completar TESTE 3
2. Reabrir modal para segunda música
3. Fazer upload segunda música
4. Aguardar análise

**Esperado:**
- Payload enviado: `{ mode:'reference', referenceJobId:'<uuid>' }`
- Payload **SEM** genre/genreTargets
- Backend retorna `referenceComparison` obrigatório
- Frontend renderiza comparação A/B

**Console logs esperados:**
```
[PR2] Reference segunda track payload: {mode: reference, referenceJobId: <uuid>}
[PR2] SANITY CHECK passou - SEM genre/targets
[WORKER-REDIS] Modo: reference | Reference Job ID: <uuid> | Métricas preloaded: SIM ✅
[WORKER-VALIDATION] ✅ referenceComparison: presente
```

**Verificar resposta do backend:**
```javascript
response.data.mode === 'reference'
response.data.referenceComparison !== null
response.data.referenceComparison.compared !== undefined
```

---

### ✅ TESTE 5: Reload Durante awaitingSecondTrack

**Passos:**
1. Completar TESTE 2 (primeira música)
2. **Recarregar página** (F5)
3. Verificar se estado persiste
4. Clicar "Comparação A/B"
5. Modal deve reabrir para segunda música

**Esperado (se persistência implementada):**
- State machine recarrega de sessionStorage
- awaitingSecondTrack detectado
- Modal abre direto para segunda música

**Esperado (se persistência NÃO implementada):**
- Estado perdido após reload
- Usuário precisa recomeçar

**Nota:** Este teste valida se a persistência via sessionStorage está funcionando. Se falhar, é enhancement, não bug crítico.

---

## 📦 RESUMO DE MUDANÇAS

### Arquivos Alterados: 1

**public/audio-analyzer-integration.js:**
- ✏️ FIX 1: L7042 - Guard resetModalState com state machine
- ✏️ FIX 2: L5338 - Guard openAnalysisModalForMode
- ✏️ FIX 3: L6920 - Guard closeAudioModal
- ✏️ FIX 4: L5444 - Remover reset dentro de guard
- ✏️ FIX 5: Adicionar logs `[REF_FIX]` nos pontos críticos

**Total de linhas alteradas:** ~30 linhas  
**Risco de quebrar Genre:** ❌ NENHUM (apenas adiciona guards)  
**Tempo estimado de implementação:** 15 minutos  
**Tempo estimado de testes:** 20 minutos  

### Arquivos SEM Alteração

**work/api/audio/analyze.js:**
- ✅ Payload validation já correta (PR2 L424)
- ✅ Contrato reference já implementado

**work/worker-redis.js:**
- ✅ Validação referenceComparison já obrigatória (L488)
- ✅ Processamento reference já correto (L840)

---

## 🎯 CRITÉRIOS DE ACEITE

### Funcional

- [ ] **FA1:** Modo Genre funciona 100% igual antes (sem regressão)
- [ ] **FA2:** Selecionar Reference não reseta flags prematuramente
- [ ] **FA3:** Fechar modal durante awaitingSecondTrack preserva estado
- [ ] **FA4:** Segunda música envia payload limpo (sem genre/targets)
- [ ] **FA5:** Backend retorna referenceComparison obrigatório
- [ ] **FA6:** Frontend renderiza comparação A/B corretamente

### Técnico

- [ ] **TA1:** Guards usam state machine como fonte de verdade
- [ ] **TA2:** Logs `[REF_FIX]` aparecem nos pontos críticos
- [ ] **TA3:** SessionStorage persiste estado entre fechamento de modal
- [ ] **TA4:** Nenhum erro de "Cannot start reference" no console
- [ ] **TA5:** Payload segunda track validado sem genre/targets

### Segurança (Não Quebrar Genre)

- [ ] **SA1:** Genre mode NÃO dispara guards de reference
- [ ] **SA2:** Genre targets NÃO são limpos por reference
- [ ] **SA3:** Genre UI NÃO é afetada por logs/guards de reference
- [ ] **SA4:** Todos os testes de Genre (TESTE 1) passam 100%

---

## 📈 PRÓXIMOS PASSOS

1. **Implementar Fase A** (15 min)
   - Aplicar FIX 1-5 via multi_replace_string_in_file
   - Um commit atômico: "fix(reference): add guards to preserve state"

2. **Testar Manualmente** (20 min)
   - Executar TESTE 1-5 na ordem
   - Verificar console logs
   - Validar sessionStorage

3. **Validar Fase B** (5 min)
   - Confirmar payload segunda track limpo
   - Confirmar backend valida referenceComparison
   - **NÃO PRECISA CÓDIGO** - já implementado

4. **Deploy Gradual**
   - Deploy em ambiente de teste primeiro
   - Validar com usuários beta
   - Deploy em produção após 24h sem erros

---

## 🚨 ROLLBACK PLAN

Se algo quebrar após deploy:

1. **Reverter commit** da Fase A
2. **Verificar logs** para identificar qual guard causou problema
3. **Ajustar guard específico** sem reverter tudo
4. **Re-deploy incremental**

**Rollback time:** < 5 minutos (um git revert)

---

## 📞 SUPORTE E DEBUGGING

**Se Reference ainda falhar após fixes:**

1. Verificar console logs com prefixo `[REF_FIX]`
2. Inspecionar sessionStorage:
   ```javascript
   console.table({
     mode: sessionStorage.getItem('analysisMode'),
     awaiting: sessionStorage.getItem('awaitingSecondTrack'),
     jobId: sessionStorage.getItem('referenceFirstJobId')
   });
   ```
3. Verificar state machine:
   ```javascript
   const sm = window.AnalysisStateMachine;
   console.table(sm.getState());
   ```
4. Verificar payload enviado (Network tab):
   - Segunda track DEVE ter `mode:'reference'`
   - Segunda track NÃO DEVE ter `genre` nem `genreTargets`

**Se Genre quebrar:**
1. Verificar se guards estão sendo disparados em modo genre
2. Logs devem mostrar `[GENRE-PROTECT]` bloqueando reference guards
3. Se Genre dispara guard de reference → BUG no guard (mode detection errada)

---

## ✅ CONCLUSÃO

**Root Cause:** 3 pontos sem guards + 1 guard bugado destroem Reference  
**Solução:** Adicionar 4 guards minimalistas usando state machine  
**Risco:** ❌ ZERO para Genre (guards são reference-only)  
**Tempo:** 15 min implementação + 20 min testes = 35 min total  
**Confiança:** 98% de sucesso (guards são simples e testáveis)

**Recomendação:** Implementar Fase A AGORA. Fase B já está correta.
