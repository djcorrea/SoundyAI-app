# 📋 PR2-TEST.md - Plano de Testes do Modo Reference Corrigido

**Data:** 15 de dezembro de 2025  
**Autor:** GitHub Copilot (Claude Sonnet 4.5)  
**Objetivo:** Validar correções do modo Reference/A-B após implementação PR2

---

## 🎯 OBJETIVO DOS TESTES

Validar que após PR2:
1. ✅ Modo Reference funciona corretamente (primeira e segunda track)
2. ✅ Modo Genre continua funcionando normalmente (não quebrado)
3. ✅ Payloads são construídos corretamente por modo
4. ✅ State machine gerencia estado sem contaminação
5. ✅ Backend executa branch correto (genre vs reference)

---

## ⚙️ PREPARAÇÃO

### Pré-requisitos
- [ ] Servidor rodando: `python -m http.server 3000`
- [ ] Backend rodando: `node work/server.js`
- [ ] Console do navegador aberto (F12)
- [ ] Filtros console configurados: `[STATE_MACHINE]`, `[PR2]`, `[REFTRACE]`
- [ ] Arquivo de áudio de teste preparado (MP3/WAV)

### Verificações Iniciais
- [ ] Script `analysis-state-machine.js` carregado antes de `audio-analyzer-integration.js`
- [ ] `window.AnalysisStateMachine` disponível no console
- [ ] Testar `debugStateMachine()` no console

---

## 📝 TESTE 1: Modo Genre Normal (Validação de Não-Regressão)

### Objetivo
Garantir que modo Genre continua funcionando normalmente após PR2.

### Passos

1. **Abrir aplicação**
   ```
   http://localhost:3000
   ```

2. **Selecionar modo Genre**
   - Clicar em "Análise de Áudio"
   - Selecionar "Análise por Gênero"
   - Escolher gênero: **Funk**

3. **Upload de arquivo**
   - Fazer upload de arquivo de teste
   - Aguardar análise completa

### Logs Esperados

#### Frontend
```javascript
[STATE_MACHINE] setMode(genre, explicit=true)
[STATE_MACHINE] Persisted { mode: "genre", userExplicitlySelected: true, ... }
[PR2] Usando buildGenrePayload
[PR2] Genre payload: { mode: "genre", genre: "funk", hasTargets: true, targetKeys: 8 }
[REFTRACE] PAYLOAD_BUILD_END { payload: { mode: "genre", genre: "funk", ... } }
[REFTRACE] PAYLOAD_SANITY_CHECK { uiMode: "genre", payloadMode: "genre", match: true }
[REFTRACE] REQUEST_SENT { endpoint: "/api/audio/analyze" }
```

#### Backend
```
[PR1-TRACE] API-xxx ENDPOINT /analyze RECEBEU REQUEST
[PR1-TRACE] API-xxx PAYLOAD RECEBIDO: { mode: "genre", genre: "funk", hasGenreTargets: true, genreTargetsKeys: 8 }
[PR1-INVARIANT] API-xxx ✅ mode=genre with genre and targets
```

### Validações

- [ ] **Payload correto:**
  - `mode: "genre"`
  - `genre: "funk"` (ou gênero selecionado)
  - `genreTargets: {...}` (objeto com targets)
  - `hasTargets: true`
  - NÃO tem `referenceJobId`
  - NÃO tem `isReferenceBase`

- [ ] **State machine:**
  - `mode: "genre"`
  - `userExplicitlySelected: true`
  - `referenceFirstJobId: null`
  - `awaitingSecondTrack: false`

- [ ] **Resposta backend:**
  - `jobId` válido (UUID)
  - `mode: "genre"`
  - `status: "queued"`

- [ ] **Resultado final:**
  - Score calculado
  - Gráficos renderizados
  - Sugestões de melhoria de gênero exibidas

### Resultado Esperado
✅ **SUCESSO:** Modo Genre funciona normalmente, sem violações de invariantes.

---

## 📝 TESTE 2: Modo Reference - Primeira Track

### Objetivo
Validar envio e salvamento da primeira música em modo Reference.

### Passos

1. **Limpar estado (F5 ou `debugStateMachine()` → resetAll)**

2. **Selecionar modo Reference**
   - Clicar em "Análise de Áudio"
   - Selecionar "Comparação A/B (Referência)"
   - Escolher gênero: **Funk** (necessário para análise base)

3. **Upload primeira música**
   - Fazer upload de arquivo de teste
   - Aguardar análise completa

4. **Verificar estado após análise**
   - Console: `debugStateMachine()`

### Logs Esperados

#### Frontend
```javascript
[STATE_MACHINE] setMode(reference, explicit=true)
[STATE_MACHINE] startReferenceFirstTrack()
[PR2] Usando buildReferencePayload { isFirstTrack: true, referenceJobId: null }
[PR2] Reference primeira track - usando buildGenrePayload como base
[PR2] Reference primeira track payload: { mode: "genre", isReferenceBase: true, hasGenre: true }
[REFTRACE] PAYLOAD_BUILD_END { payload: { mode: "genre", isReferenceBase: true, genre: "funk", ... } }
[REFTRACE] PAYLOAD_SANITY_CHECK { uiMode: "reference", payloadMode: "genre", isReferenceBase: true, match: true }
[REFTRACE] REQUEST_SENT
[REFTRACE] POLL_RESULT_RECEIVED { status: "completed", mode: "genre" }
[REFTRACE] FIRST_TRACK_SAVED { jobId: "uuid-...", userExplicitlySelectedReferenceMode: true }
[PR2] Primeira track salva na state machine
[STATE_MACHINE] setReferenceFirstResult
[STATE_MACHINE] Now awaiting second track { referenceFirstJobId: "uuid-...", awaitingSecondTrack: true }
```

#### Backend
```
[PR1-TRACE] API-xxx ENDPOINT /analyze RECEBEU REQUEST
[PR1-TRACE] API-xxx PAYLOAD RECEBIDO: { mode: "genre", isReferenceBase: true, genre: "funk", hasGenreTargets: true, referenceJobId: null }
[PR1-TRACE] API-xxx ✅ First reference track - genre=funk is acceptable
```

### Validações

- [ ] **Payload correto (primeira track):**
  - `mode: "genre"` (análise base)
  - `isReferenceBase: true` (flag diferenciando de genre puro)
  - `genre: "funk"`
  - `genreTargets: {...}`
  - NÃO tem `referenceJobId` (primeira track)

- [ ] **State machine após análise:**
  - `mode: "reference"`
  - `userExplicitlySelected: true`
  - `referenceFirstJobId: "uuid-..."` (salvo)
  - `awaitingSecondTrack: true` ✅ **CRÍTICO**
  - `referenceFirstResult: {...}` (dados salvos)

- [ ] **Modal segunda música:**
  - Modal reabre automaticamente
  - Título: "Upload da Música de Referência"
  - Subtítulo: "Etapa 2/2"
  - Guard NÃO bloqueou (isAwaitingSecondTrack = true)

- [ ] **Resultado primeira track:**
  - Score calculado normalmente
  - Sugestões de gênero exibidas (como análise genre normal)

### Resultado Esperado
✅ **SUCESSO:** Primeira track salva, state machine aguardando segunda track, modal reaberto.

---

## 📝 TESTE 3: Modo Reference - Segunda Track (Comparação A/B)

### Objetivo
Validar envio da segunda música e geração de comparação A/B.

### Passos

1. **Continuação do Teste 2** (não recarregar página)

2. **Verificar estado antes do upload**
   - Console: `debugStateMachine()`
   - Confirmar `awaitingSecondTrack: true`

3. **Upload segunda música**
   - No modal que reabriu, fazer upload de **arquivo diferente**
   - Aguardar análise completa

4. **Verificar resultado A/B**
   - Verificar se interface de comparação foi renderizada
   - Verificar se há dados de ambas as músicas

### Logs Esperados

#### Frontend
```javascript
[STATE_MACHINE] Current State: { mode: "reference", awaitingSecondTrack: true, referenceFirstJobId: "uuid-..." }
[STATE_MACHINE] startReferenceSecondTrack()
[PR2] Usando buildReferencePayload { isFirstTrack: false, referenceJobId: "uuid-..." }
[PR2] Reference segunda track payload: { mode: "reference", referenceJobId: "uuid-...", hasGenre: false, hasTargets: false }
[REFTRACE] PAYLOAD_BUILD_END { payload: { mode: "reference", referenceJobId: "uuid-...", fileKey: "..." } }
[REFTRACE] PAYLOAD_SANITY_CHECK { uiMode: "reference", payloadMode: "reference", match: true, referenceJobIdPresent: true }
[PR2-SANITY-CHECK] ✅ Reference segunda track NÃO tem genre/genreTargets
[REFTRACE] REQUEST_SENT
```

#### Backend
```
[PR1-TRACE] API-xxx ENDPOINT /analyze RECEBEU REQUEST
[PR1-TRACE] API-xxx PAYLOAD RECEBIDO: { mode: "reference", referenceJobId: "uuid-...", genre: null, hasGenreTargets: false }
[PR2-CORRECTION] API-xxx ✅ Reference segunda track - modo reference puro
[PR1-INVARIANT] API-xxx ✅ Reference segunda track - modo reference puro
```

### Validações Críticas

- [ ] **Payload correto (segunda track):**
  - `mode: "reference"` ✅ **CRÍTICO**
  - `referenceJobId: "uuid-..."` ✅ **CRÍTICO**
  - `fileKey: "..."` (arquivo da segunda música)
  - `fileName: "..."`
  - **NÃO tem `genre`** ✅ **CRÍTICO**
  - **NÃO tem `genreTargets`** ✅ **CRÍTICO**
  - **NÃO tem `isReferenceBase`**

- [ ] **State machine após segunda track:**
  - `mode: "reference"`
  - `awaitingSecondTrack: true` (até receber resultado)

- [ ] **Backend processamento:**
  - Log indica "Reference segunda track"
  - **NÃO** gera sugestões de genre_target_miss
  - **SIM** gera dados de `referenceComparison` (se implementado)

- [ ] **Resultado comparação A/B:**
  - Dados da primeira música exibidos
  - Dados da segunda música exibidos
  - Comparação lado a lado (se implementado)
  - Diferenças destacadas (LUFS, frequências, etc.)

### Resultado Esperado
✅ **SUCESSO:** Segunda track enviada com payload limpo (sem genre/targets), comparação A/B gerada.

---

## 🚨 VERIFICAÇÕES DE SEGURANÇA

### Invariantes que NÃO Devem Violar

- [ ] **Invariante 1:** Se `mode=reference` (UI), flag `userExplicitlySelected` deve ser `true`
- [ ] **Invariante 2:** Se `awaitingSecondTrack=true`, deve ter `referenceFirstJobId`
- [ ] **Invariante 3:** Se `referenceFirstJobId` existe, `mode` deve ser `reference`
- [ ] **Invariante 4:** Payload de segunda track reference NÃO pode ter `genre` nem `genreTargets`
- [ ] **Invariante 5:** Guard `openReferenceUploadModal` só abre se `isAwaitingSecondTrack()` retorna `true`

### Logs de Violação a Procurar
Se aparecer algum destes, é BUG:
```
[INV_FAIL] REFERENCE_MODE_EXPLICIT_FLAG
[INV_FAIL] REFERENCE_PAYLOAD_NO_GENRE
[INV_FAIL] REFERENCE_PAYLOAD_NO_TARGETS
[PR2-SANITY-FAIL] REFERENCE mode segunda track TEM genre/genreTargets!
[PR2-GUARD] ❌ BLOQUEIO: State machine não está aguardando segunda track
[MODE_MISMATCH] { uiMode: "reference", payloadMode: "genre", expected: "reference" }
```

---

## 🐛 TROUBLESHOOTING

### Problema: Modal não reabre após primeira track

**Diagnóstico:**
```javascript
debugStateMachine()
// Verificar: awaitingSecondTrack === true ?
```

**Possíveis causas:**
- State machine não chamou `setReferenceFirstResult`
- Guard bloqueou por `isAwaitingSecondTrack() = false`

**Solução:**
- Ver console: `[STATE_MACHINE] setReferenceFirstResult`
- Confirmar `referenceFirstJobId` salvo

---

### Problema: Segunda track tem genre/genreTargets no payload

**Diagnóstico:**
```javascript
// No console, ver:
[PR2] Reference segunda track payload: { ... }
// Se tiver genre/genreTargets = BUG
```

**Possíveis causas:**
- `buildReferencePayload` não detectou `isFirstTrack=false`
- Lógica de payload não usou função correta

**Solução:**
- Revisar `createAnalysisJob` linha de determinação isFirstTrack
- Confirmar `currentState.awaitingSecondTrack` é `true`

---

### Problema: Backend retorna `mode:"genre"` na segunda track

**Diagnóstico:**
```
[PR1-TRACE] API-xxx PAYLOAD RECEBIDO: { mode: "genre", ... }
// Backend recebeu mode errado
```

**Possíveis causas:**
- Frontend enviou payload errado
- Backend não limpou genre/genreTargets do payload

**Solução:**
- Frontend: Ver `[REFTRACE] REQUEST_SENT` - payload deve ter `mode:"reference"`
- Backend: Ver `[PR2-CORRECTION]` - deve remover genre/targets se presentes

---

## 📊 RESUMO DE SUCESSO

### Teste 1 (Genre)
- ✅ Payload: `mode:"genre"` + `genre` + `genreTargets`
- ✅ State machine: `mode:"genre"`, flags corretas
- ✅ Resultado: Análise normal com sugestões de gênero

### Teste 2 (Reference 1ª track)
- ✅ Payload: `mode:"genre"` + `isReferenceBase:true` + `genre` + `genreTargets`
- ✅ State machine: `mode:"reference"`, `awaitingSecondTrack:true`, `referenceFirstJobId` salvo
- ✅ Modal: Reabre automaticamente para segunda track

### Teste 3 (Reference 2ª track)
- ✅ Payload: `mode:"reference"` + `referenceJobId` + **SEM** `genre`/`genreTargets`
- ✅ Backend: Recebe payload limpo, não gera sugestões de genre
- ✅ Resultado: Comparação A/B entre duas músicas

---

## ✅ CHECKLIST FINAL

- [ ] Modo Genre não quebrou (teste 1)
- [ ] Primeira track reference salva corretamente (teste 2)
- [ ] Segunda track reference enviada com payload limpo (teste 3)
- [ ] State machine gerencia estado sem contaminação
- [ ] Nenhuma violação de invariante nos 3 testes
- [ ] Backend recebe payloads corretos (logs PR1-TRACE)
- [ ] Guards funcionando (não bloqueiam indevidamente)
- [ ] Modal reabre após primeira track
- [ ] Interface A/B renderiza ambas as músicas (se implementado)

---

## 🔍 LOGS PARA ENVIAR EM CASO DE BUG

Se algum teste falhar, copiar do console:
1. Todos os logs `[STATE_MACHINE]`
2. Todos os logs `[PR2]`
3. Todos os logs `[REFTRACE]`
4. Todos os logs `[INV_FAIL]` (se existirem)
5. Resultado de `debugStateMachine()` antes e depois do erro

---

**Fim do Plano de Testes PR2**
