# ✅ CHECKLIST DE TESTES - MODO REFERÊNCIA (A/B)

## 🎯 OBJETIVO
Validar que o modo de Análise por Referência (A/B) funciona **100% independente** do modo de análise de gênero, com fluxo estável de duas faixas sem perder estado ou requerer gênero/targets.

---

## 📋 PRÉ-REQUISITOS

1. ✅ Abrir console do navegador (F12)
2. ✅ Limpar sessionStorage e localStorage antes de cada teste
3. ✅ Verificar se backend está rodando corretamente
4. ✅ Ter dois arquivos de áudio prontos (Track A e Track B)

---

## 🧪 TESTES OBRIGATÓRIOS

### ✅ TESTE 1: Modo Reference - Primeira Track (Base)

**Passo a passo:**
1. Acessar SoundyAI
2. Clicar em **"Comparação A/B"** (modo reference)
3. **VERIFICAR NO CONSOLE:**
   - `[INVARIANTE #0] openReferenceUploadModal() ENTRADA` deve aparecer
   - `stateMachine.getMode()` deve ser `'reference'`
   - `userExplicitlySelectedReferenceMode` deve ser `true`
4. Fazer upload da **Track A** (música base)
5. Aguardar análise completar

**Resultado Esperado:**
- ✅ Track A completa sem erros
- ✅ Console mostra: `[REF_FIX] 🎯 Primeira track Reference completada`
- ✅ Console mostra: `setReferenceFirstResult(jobId=...)`
- ✅ Console mostra: `awaitingSecondTrack=true`
- ✅ Modal **automaticamente reabre** para upload da Track B
- ✅ NENHUM erro de "Targets obrigatórios ausentes"
- ✅ Backend valida JSON sem exigir `referenceComparison` (é stage='base')

---

### ✅ TESTE 2: Modo Reference - Segunda Track (Comparação)

**Passo a passo:**
1. **Após Track A completar**, o modal deve estar aberto para Track B
2. **VERIFICAR NO CONSOLE:**
   - `[INVARIANTE #0]` log deve mostrar:
     - `stateMachine.isAwaitingSecondTrack()` = `true`
     - `stateMachine.referenceFirstJobId` = ID da Track A
3. Fazer upload da **Track B**
4. Aguardar análise completar

**Resultado Esperado:**
- ✅ Track B completa sem erros
- ✅ Console mostra: `[REF_FIX] 🎯 Segunda track Reference completada`
- ✅ Console mostra: `startReferenceSecondTrack()` chamado
- ✅ Backend recebe `referenceStage='compare'` e `referenceJobId` da Track A
- ✅ Worker valida que `referenceComparison` está presente
- ✅ Modal exibe **comparação A/B** com ambas as faixas lado a lado
- ✅ Tabelas de comparação exibem deltas entre Track A e B

---

### ✅ TESTE 3: Modo Genre - Validação de Não-Regressão

**Passo a passo:**
1. Limpar sessionStorage/localStorage
2. Acessar SoundyAI
3. Selecionar **Análise de Gênero**
4. Escolher gênero (ex: "Pop")
5. Fazer upload de uma música
6. Aguardar análise completar

**Resultado Esperado:**
- ✅ Análise de gênero completa SEM erros
- ✅ Console mostra: `mode='genre'`
- ✅ Backend recebe `analysisType='genre'` e `genre='pop'`
- ✅ Worker valida que `genreTargets` está presente
- ✅ Modal exibe análise completa com sugestões de AI
- ✅ **NENHUMA referência** a `referenceComparison`, `referenceStage`, ou `referenceJobId`
- ✅ Suggestion Engine executa normalmente

---

### ✅ TESTE 4: Proteção de Estado - Fechar Modal entre Tracks

**Passo a passo:**
1. Iniciar modo Reference
2. Fazer upload da Track A
3. Aguardar análise completar
4. Modal reabre para Track B
5. **Fechar o modal** (clicar no X)
6. **VERIFICAR NO CONSOLE:**
   - `closeAudioModal` deve preservar estado
   - `FirstAnalysisStore.has()` deve retornar `true`
   - `stateMachine.isAwaitingSecondTrack()` deve retornar `true`
7. Clicar novamente em **"Comparação A/B"**

**Resultado Esperado:**
- ✅ Modal reabre com estado preservado
- ✅ Mensagem indica que está aguardando Track B
- ✅ `referenceFirstJobId` ainda existe
- ✅ `FirstAnalysisStore` ainda contém dados da Track A
- ✅ Possível fazer upload da Track B normalmente

---

### ✅ TESTE 5: Backend - Validação de Payload

**Passo a passo:**
1. Abrir DevTools → Network tab
2. Iniciar modo Reference
3. Fazer upload Track A
4. **VERIFICAR REQUEST `analyze.js`:**
   - Body deve ter:
     - `mode='reference'`
     - `analysisType='reference'`
     - `referenceStage='base'`
     - `isReferenceBase=true`
     - `referenceJobId=null`
     - **SIM:** `genre` presente
     - **SIM:** `genreTargets` presente
5. Fazer upload Track B
6. **VERIFICAR REQUEST `analyze.js`:**
   - Body deve ter:
     - `mode='reference'`
     - `analysisType='reference'`
     - `referenceStage='compare'`
     - `isReferenceBase=false`
     - `referenceJobId=<ID da Track A>`
     - **NÃO:** `genre` ausente
     - **NÃO:** `genreTargets` ausente

**Resultado Esperado:**
- ✅ Payload Track A: contém `genre` e `genreTargets`
- ✅ Payload Track B: **NÃO** contém `genre` nem `genreTargets`
- ✅ Backend aceita ambos os payloads sem erro

---

### ✅ TESTE 6: Worker - Validação de JSON Final

**Passo a passo:**
1. Verificar logs do backend/worker no terminal
2. Durante análise de Track A (base):
   - **VERIFICAR LOG:**
     - `[WORKER-VALIDATION] referenceStage: base`
     - `[WORKER-VALIDATION] ⏭️ referenceComparison: NÃO OBRIGATÓRIO`
     - `[WORKER-VALIDATION] ✅✅✅ JSON COMPLETO`
3. Durante análise de Track B (compare):
   - **VERIFICAR LOG:**
     - `[WORKER-VALIDATION] referenceStage: compare`
     - `[WORKER-VALIDATION] ✅ referenceComparison: presente`
     - `[WORKER-VALIDATION] ✅✅✅ JSON COMPLETO`

**Resultado Esperado:**
- ✅ Worker aceita Track A sem `referenceComparison`
- ✅ Worker EXIGE `referenceComparison` para Track B
- ✅ Nenhum erro de "Campos faltando"

---

### ✅ TESTE 7: Frontend - Logs de Invariantes

**Passo a passo:**
1. Durante todo o fluxo Reference, **VERIFICAR NO CONSOLE:**
   - `[INVARIANTE #0] openReferenceUploadModal() ENTRADA`
   - `[INVARIANTE #1 OK] State machine está em reference`
   - `stateMachine.isAwaitingSecondTrack()` correto em cada etapa
2. **NÃO DEVE APARECER:**
   - `window.__CURRENT_MODE__` (removido)
   - Erros de "Cannot access 'referenceJobId' before initialization"
   - Erros de "Targets obrigatórios ausentes" em reference mode

**Resultado Esperado:**
- ✅ Todos os logs de invariantes presentes
- ✅ Nenhum erro relacionado a `window.__CURRENT_MODE__`
- ✅ State machine sempre consistente

---

### ✅ TESTE 8: Suggestion Engine - Isolamento Completo

**Passo a passo:**
1. Verificar logs do backend durante análise de Track A (reference)
2. **VERIFICAR LOG:**
   - `[DEBUG-SUGGESTIONS] ⏭️ SKIP: Modo não é "genre", pulando Suggestion Engine`
   - `[DEBUG-SUGGESTIONS] ✅ Estruturas vazias definidas para reference mode`
3. Fazer análise de gênero depois
4. **VERIFICAR LOG:**
   - `[DEBUG-SUGGESTIONS] ▶️ Executando Suggestion Engine para mode="genre"`

**Resultado Esperado:**
- ✅ Suggestion Engine **NÃO executa** em reference mode
- ✅ Suggestion Engine **executa normalmente** em genre mode
- ✅ Nenhum erro de "Cannot read property 'lufs_target'"

---

## 🚨 CRITÉRIOS DE FALHA

### ❌ TESTE FALHA SE:

1. Track A exigir `referenceComparison` no worker
2. Track B não incluir `referenceJobId` no payload
3. Modo genre deixar de funcionar ou apresentar erros
4. Estado ser perdido ao fechar modal entre tracks
5. `window.__CURRENT_MODE__` aparecer nos logs (variável fantasma)
6. Suggestion Engine executar em reference mode
7. Backend rejeitar payload por falta de `genre` em Track B
8. Console mostrar erro "Targets obrigatórios ausentes" em reference mode

---

## 📊 RELATÓRIO DE TESTES

Após executar todos os testes, preencher:

| Teste | Status | Observações |
|-------|--------|-------------|
| 1. Reference Track A | ✅/❌ | |
| 2. Reference Track B | ✅/❌ | |
| 3. Genre Não-Regressão | ✅/❌ | |
| 4. Proteção de Estado | ✅/❌ | |
| 5. Validação Payload | ✅/❌ | |
| 6. Validação Worker | ✅/❌ | |
| 7. Logs Invariantes | ✅/❌ | |
| 8. Isolamento Suggestion | ✅/❌ | |

---

## 🔧 COMANDOS ÚTEIS (Console)

```javascript
// Verificar estado atual
window.snapshotState()

// Verificar state machine
window.AnalysisStateMachine.getState()

// Verificar FirstAnalysisStore
window.FirstAnalysisStore.has()
window.FirstAnalysisStore.get()

// Limpar estado (apenas para debug)
sessionStorage.clear()
localStorage.clear()
window.AnalysisStateMachine.reset()
```

---

## ✅ APROVAÇÃO FINAL

**Todos os 8 testes devem passar** para considerar o modo Reference pronto para produção.

**Data do teste:** _____________  
**Testador:** _____________  
**Resultado:** ✅ APROVADO / ❌ REPROVADO
