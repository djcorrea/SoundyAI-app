# ✅ ETAPA C — CHECKLIST DE TESTES DE REGRESSÃO
**Data:** 16 de dezembro de 2025  
**Engenheiro:** GitHub Copilot (Claude Sonnet 4.5)

---

## 🎯 OBJETIVO DOS TESTES

Validar que:
1. ✅ Modo **Reference (A/B)** funciona end-to-end
2. ✅ Modo **Genre** continua funcionando sem regressão
3. ✅ Transições entre modos não vazam estado
4. ✅ Refresh/reload durante reference tem comportamento definido

---

## 🧪 TESTE 1: GENRE NORMAL (Garantir Não Quebrou)

### Objetivo
Validar que análise por gênero funciona 100% igual ao comportamento original.

### Pré-condições
- Aplicação aberta e autenticada
- Nenhum estado de reference ativo (sessionStorage limpo)

### Passos
1. Clicar em "Análise por Gênero"
2. Selecionar gênero (ex: Pop, Rock, Hip-Hop)
3. Upload arquivo MP3/WAV (~5MB)
4. Aguardar análise completar (30-60 segundos)
5. **Abrir DevTools antes do upload** (F12)
6. **Abrir Network tab e filtrar por `/api/audio/analyze`**
7. **Abrir Console tab**

### Critérios de Sucesso

#### UI
- [ ] Modal abre normalmente
- [ ] Seletor de gênero funciona
- [ ] Upload é aceito
- [ ] Progress bar exibe progresso (0% → 100%)
- [ ] Resultado exibe score e targets de gênero
- [ ] Tabela de targets aparece com valores (LUFS, True Peak, DR, Stereo Width)
- [ ] Sugestões de AI são exibidas (se habilitadas)

#### Console
- [ ] **NÃO mostra logs `[REF_FIX]`** (genre não deve entrar em código reference)
- [ ] **NÃO mostra logs sobre `awaitingSecondTrack`**
- [ ] Mostra: `🎯 Modo selecionado: genre`
- [ ] Mostra: `[PR2] Usando buildGenrePayload`

#### Network (Payload enviado)
```json
{
  "mode": "genre",
  "genre": "pop",
  "genreTargets": {
    "lufs_target": -14,
    "true_peak_target": -1,
    "dr_target": 8,
    "stereo_target": 30
  },
  "fileKey": "users/...",
  "fileName": "test.mp3",
  "idToken": "..."
}
```

**Validações:**
- [ ] `mode === "genre"` (não "reference")
- [ ] `genreTargets` está presente e preenchido
- [ ] **NÃO tem** `referenceJobId`
- [ ] **NÃO tem** `isReferenceBase`

#### sessionStorage
```javascript
// Executar no console após análise:
console.table({
    mode: sessionStorage.getItem('analysisMode'),
    awaiting: sessionStorage.getItem('awaitingSecondTrack'),
    refJobId: sessionStorage.getItem('referenceFirstJobId'),
    stateJSON: sessionStorage.getItem('analysisState_v1')
});
```

**Esperado:**
```
mode: "genre" ou null
awaiting: null ou "false"
refJobId: null
stateJSON: contém mode:"genre" E awaitingSecondTrack:false
```

---

## 🧪 TESTE 2: REFERENCE 1ª TRACK (Validar setReferenceFirstResult)

### Objetivo
Validar que primeira track de reference:
- Seta `awaitingSecondTrack=true`
- Salva `referenceFirstJobId` em sessionStorage
- Preserva estado ao fechar modal

### Pré-condições
- Aplicação aberta e autenticada
- **sessionStorage limpo** (refresh de página ou clear storage)
- DevTools aberto (F12) com Console e Network tabs visíveis

### Passos
1. Clicar em "Comparação A/B" ou "Modo Reference"
2. Selecionar gênero base (ex: Pop)
3. Upload primeira música MP3/WAV
4. Aguardar análise completar
5. **IMEDIATAMENTE após conclusão**, verificar console
6. **Abrir Network tab e localizar request `/api/audio/analyze`**

### Critérios de Sucesso

#### UI
- [ ] Modal abre com título "Comparação A/B" ou "Análise de Referência"
- [ ] Seletor de gênero presente (para baseline)
- [ ] Upload é aceito
- [ ] Análise completa com score

#### Console (CRÍTICO)
```
🎯 Modo selecionado: reference
[PROTECTION] ✅ Flag userExplicitlySelectedReferenceMode ATIVADA
[REF_FIX] 🎯 Modo Reference selecionado pelo usuário
[PR2] buildReferencePayload() { isFirstTrack: true, referenceJobId: null }
[PR2] Reference primeira track - usando buildGenrePayload como base
[REF_FIX] 🎯 Primeira track Reference completada
[REF_FIX] Setando awaitingSecondTrack=true para preservar estado
[REF_FIX] ✅ awaitingSecondTrack=true
[REF_FIX] referenceFirstJobId salvo: <uuid>
[REF_FIX] sessionStorage atualizado - estado protegido
```

**Validações:**
- [ ] Aparece `[REF_FIX] ✅ awaitingSecondTrack=true`
- [ ] UUID de `referenceFirstJobId` está presente
- [ ] Nenhum erro sobre "Cannot start reference first track"

#### Network (Payload - 1ª track)
```json
{
  "mode": "genre",
  "genre": "pop",
  "genreTargets": {...},
  "isReferenceBase": true,
  "fileKey": "...",
  "fileName": "track1.mp3",
  "idToken": "..."
}
```

**Validações:**
- [ ] `mode === "genre"` (design intencional - usa genre como baseline)
- [ ] `isReferenceBase === true` (flag indicando origem reference)
- [ ] `genreTargets` está presente (necessário para análise base)
- [ ] **NÃO tem** `referenceJobId` (primeira track não tem)

#### sessionStorage (CRÍTICO)
```javascript
// Executar no console após análise completar:
console.table({
    mode: sessionStorage.getItem('analysisMode'),
    awaiting: sessionStorage.getItem('awaitingSecondTrack'),
    refJobId: sessionStorage.getItem('referenceFirstJobId')
});

// Verificar state machine:
const stateMachine = window.AnalysisStateMachine;
console.log('State Machine:', stateMachine?.getState());
```

**Esperado:**
```
mode: "reference"
awaiting: "true"           // ✅ CRÍTICO
refJobId: "<uuid>"         // ✅ CRÍTICO

State Machine:
{
  mode: "reference",
  userExplicitlySelected: true,
  referenceFirstJobId: "<uuid>",
  referenceFirstResult: {...},
  awaitingSecondTrack: true,
  timestamp: "2025-12-16T..."
}
```

---

## 🧪 TESTE 3: FECHAR/REABRIR MODAL (Validar Preservação de Estado)

### Objetivo
Validar que estado reference é preservado ao fechar/reabrir modal.

### Pré-condições
- **TESTE 2 completado com sucesso**
- `awaitingSecondTrack === true` confirmado em sessionStorage
- Modal ainda aberto (exibindo resultado da primeira track)

### Passos
1. **Fechar modal** (clicar fora ou pressionar ESC)
2. **Verificar console ao fechar**
3. Aguardar 5 segundos
4. **Verificar sessionStorage ainda está intacto**
5. Clicar novamente em "Comparação A/B"
6. **Verificar que modal reabre pronto para segunda música**

### Critérios de Sucesso

#### Console (ao fechar)
```
[REF_FIX] 🔒 closeAudioModal() - PRESERVANDO estado (awaitingSecondTrack)
```

**Validações:**
- [ ] Aparece log `PRESERVANDO estado`
- [ ] **NÃO aparece** log de `resetModalState()` ou limpeza de flags

#### sessionStorage (após fechar)
```javascript
// Executar no console após fechar modal:
console.table({
    mode: sessionStorage.getItem('analysisMode'),
    awaiting: sessionStorage.getItem('awaitingSecondTrack'),
    refJobId: sessionStorage.getItem('referenceFirstJobId')
});
```

**Esperado (DEVE ESTAR IGUAL AO TESTE 2):**
```
mode: "reference"
awaiting: "true"          // ✅ PRESERVADO
refJobId: "<uuid>"        // ✅ PRESERVADO
```

#### UI (ao reabrir)
- [ ] Modal abre automaticamente em modo "segunda música"
- [ ] Título indica "Upload da Música de Comparação" ou similar
- [ ] Campo de upload está disponível
- [ ] **NÃO pede** para selecionar gênero novamente
- [ ] **NÃO mostra erro** "Cannot start reference"

---

## 🧪 TESTE 4: REFERENCE 2ª TRACK (Validar Payload Limpo)

### Objetivo
Validar que segunda track de reference:
- Envia payload com `mode: "reference"` (não genre)
- **NÃO inclui** `genre` ou `genreTargets`
- Inclui `referenceJobId`
- Backend retorna `referenceComparison` preenchido

### Pré-condições
- **TESTE 3 completado com sucesso**
- Modal reaberto e pronto para segunda música
- DevTools aberto com Network e Console tabs

### Passos
1. **Com modal reaberto** (awaiting segunda track)
2. **Abrir Network tab ANTES de fazer upload**
3. Upload segunda música (diferente da primeira)
4. **Localizar request `/api/audio/analyze` no Network tab**
5. Aguardar análise completar
6. **Verificar resposta do backend** (response body)
7. **Verificar UI exibe comparação A/B**

### Critérios de Sucesso

#### Console
```
[PR2] buildReferencePayload() { isFirstTrack: false, referenceJobId: "<uuid>" }
[PR2] Reference segunda track payload: {mode: reference, referenceJobId: <uuid>}
[REF_FIX] 🎯 Segunda track Reference completada
[REF_FIX] Preparando renderização de comparação A/B
```

**Validações:**
- [ ] Aparece `isFirstTrack: false`
- [ ] `referenceJobId` está presente
- [ ] Aparece `Segunda track Reference completada`

#### Network (Payload - 2ª track) ⚠️ CRÍTICO
```json
{
  "mode": "reference",
  "referenceJobId": "<uuid-primeira-track>",
  "fileKey": "...",
  "fileName": "track2.mp3",
  "idToken": "..."
}
```

**Validações OBRIGATÓRIAS:**
- [ ] ✅ `mode === "reference"` (não "genre")
- [ ] ✅ `referenceJobId` presente com UUID válido
- [ ] ❌ **NÃO tem** `genre`
- [ ] ❌ **NÃO tem** `genreTargets`
- [ ] ❌ **NÃO tem** `isReferenceBase`
- [ ] ❌ **NÃO tem** `hasTargets`

**Se payload tiver `genre` ou `genreTargets` → FALHA CRÍTICA**

#### Network (Response do backend)
```json
{
  "success": true,
  "jobId": "<uuid-segunda-track>",
  "status": "queued"
}

// Depois do polling:
{
  "mode": "reference",
  "jobId": "<uuid-segunda-track>",
  "referenceComparison": {
    "compared": {
      "lufs": {...},
      "truePeak": {...},
      "dr": {...}
    },
    "deltas": {
      "lufs": -2.5,
      "truePeak": 0.3,
      "dr": 1
    }
  },
  "score": 82,
  "technicalData": {...}
}
```

**Validações OBRIGATÓRIAS:**
- [ ] ✅ `referenceComparison` está presente
- [ ] ✅ `referenceComparison.compared` tem dados de ambas as tracks
- [ ] ✅ `referenceComparison.deltas` tem diferenças calculadas
- [ ] ❌ **NÃO deve ter** `genreTargets` na resposta

#### UI (Comparação A/B)
- [ ] Modal exibe tabela de comparação lado a lado
- [ ] Primeira track vs Segunda track claramente identificadas
- [ ] Deltas (diferenças) exibidos com cores:
  - Verde: melhoria
  - Vermelho: piora
  - Amarelo: neutro
- [ ] Score comparativo exibido
- [ ] Sugestões baseadas nas diferenças (não em targets de gênero)

#### sessionStorage (após segunda track)
```javascript
// Executar no console:
console.table({
    mode: sessionStorage.getItem('analysisMode'),
    awaiting: sessionStorage.getItem('awaitingSecondTrack'),
    refJobId: sessionStorage.getItem('referenceFirstJobId')
});
```

**Esperado:**
```
mode: "reference"
awaiting: "false" ou null    // Pode ser limpo após segunda track completar
refJobId: "<uuid>"           // Ainda presente (para histórico)
```

---

## 🧪 TESTE 5: ERRO EM REFERENCE (Validar Fallback Explícito)

### Objetivo
Validar que erro em reference **NÃO faz fallback automático** para genre.

### Pré-condições
- Aplicação aberta e autenticada
- DevTools aberto com Console tab

### Passos - Cenário A: Simular erro com arquivo corrompido
1. Clicar em "Comparação A/B"
2. Selecionar gênero
3. **Upload arquivo inválido:**
   - Renomear um `.txt` para `.mp3`
   - Ou usar arquivo MP3 corrompido
4. Aguardar erro aparecer

### Passos - Cenário B: Simular erro com desconexão
1. Clicar em "Comparação A/B"
2. Selecionar gênero
3. Upload arquivo válido
4. **Durante o polling** (quando estiver analisando):
   - Abrir DevTools → Network tab
   - Ativar "Offline" mode
5. Aguardar timeout/erro

### Critérios de Sucesso

#### Console (logs detalhados)
```
[REF-FLOW] ═════════════════════════════════════
[REF-FLOW] ERRO CRÍTICO: Reference falhou sem primeira análise
[REF-FLOW] Erro: <mensagem de erro>
[REF-FLOW] Stack: <stack trace completo>
[REF-FLOW] State Machine: {...}
[REF-FLOW] ═════════════════════════════════════
```

**Validações:**
- [ ] Aparece bloco de logs `[REF-FLOW]` com separadores
- [ ] Mensagem de erro está clara
- [ ] Stack trace está presente
- [ ] Estado da state machine é logado

#### UI (Dialog de Confirmação) ⚠️ CRÍTICO
```
┌──────────────────────────────────────────┐
│ A análise de referência encontrou um    │
│ erro.                                    │
│                                          │
│ Deseja tentar novamente (OK) ou usar    │
│ análise por gênero (Cancelar)?          │
│                                          │
│         [OK]        [Cancelar]           │
└──────────────────────────────────────────┘
```

**Validações OBRIGATÓRIAS:**
- [ ] ✅ Dialog `confirm()` aparece (não `alert()` simples)
- [ ] ✅ Texto menciona "tentar novamente" e "análise por gênero"
- [ ] ❌ **NÃO há** `setTimeout` de 2 segundos mudando modo automaticamente
- [ ] ❌ **NÃO há** mensagem "Redirecionando para gênero..."

#### Comportamento (Usuário clica OK)
- [ ] Dialog fecha
- [ ] Modo permanece `reference`
- [ ] Mensagem aparece: "Tente fazer upload da primeira faixa novamente"
- [ ] Modal continua aberto em modo reference

#### Comportamento (Usuário clica Cancelar)
- [ ] Dialog fecha
- [ ] Console mostra: `[REF-FLOW] Usuário optou por fallback para gênero`
- [ ] `currentAnalysisMode` muda para `genre`
- [ ] Modal reconfigura para modo genre
- [ ] Usuário pode fazer nova análise de gênero

---

## 🧪 TESTE 6: ALTERNAR REFERENCE → GENRE → REFERENCE (Validar Isolamento)

### Objetivo
Validar que transições entre modos não vazam estado.

### Pré-condições
- Aplicação aberta e autenticada
- sessionStorage limpo

### Passos
1. **Iniciar Reference (primeira track)**
   - Clicar "Comparação A/B"
   - Upload primeira música
   - Aguardar completar
   - Verificar `awaitingSecondTrack=true`

2. **Mudar para Genre**
   - **Fechar modal**
   - Clicar "Análise por Gênero"
   - Selecionar gênero
   - Upload música

3. **Verificar limpeza de estado Reference**
   ```javascript
   console.table({
       awaiting: sessionStorage.getItem('awaitingSecondTrack'),
       refJobId: sessionStorage.getItem('referenceFirstJobId')
   });
   ```
   - Esperado: `awaiting` e `refJobId` devem ser `null` ou `"false"`

4. **Aguardar análise Genre completar**
   - Verificar resultado normal de genre
   - Verificar payload tinha `genreTargets`

5. **Mudar de volta para Reference**
   - Fechar modal
   - Clicar "Comparação A/B"
   - Upload primeira música
   - Verificar novo fluxo reference começa limpo

### Critérios de Sucesso

#### Console (ao mudar genre → reference)
```
[GENRE-BARRIER] 🚧 BARREIRA 4 ATIVADA: Modo gênero selecionado
[GENRE-ISOLATION] 🧹 Limpeza completa do estado de referência
[PROTECTION] ✅ Flag userExplicitlySelectedReferenceMode resetada para false
```

#### sessionStorage (após mudar para genre)
- [ ] `awaitingSecondTrack` é `null` ou `"false"`
- [ ] `referenceFirstJobId` é `null`
- [ ] `analysisState_v1` tem `mode: "genre"` E `awaitingSecondTrack: false`

#### Validação de Isolamento
- [ ] Genre **NÃO vê** dados da primeira track reference
- [ ] Genre processa normalmente com `genreTargets`
- [ ] Reference após genre **NÃO vê** dados do genre
- [ ] Novo reference começa do zero (nova primeira track)

---

## 🧪 TESTE 7: REFRESH DURANTE AWAITING (Validar Persistência)

### Objetivo
Validar que refresh de página durante `awaitingSecondTrack=true` mantém estado.

### Pré-condições
- **TESTE 2 completado**
- `awaitingSecondTrack === true` confirmado
- Modal pode estar aberto ou fechado

### Passos
1. **Com estado awaiting ativo**
2. **Recarregar página** (F5 ou Ctrl+R)
3. Aguardar aplicação carregar
4. **Verificar sessionStorage ainda está intacto**
5. Clicar em "Comparação A/B"
6. **Verificar comportamento**

### Critérios de Sucesso

#### sessionStorage (após reload)
```javascript
// Executar no console após reload:
console.table({
    mode: sessionStorage.getItem('analysisMode'),
    awaiting: sessionStorage.getItem('awaitingSecondTrack'),
    refJobId: sessionStorage.getItem('referenceFirstJobId')
});

// Verificar state machine restaurou:
const stateMachine = window.AnalysisStateMachine;
console.log('Restored State:', stateMachine?.getState());
```

**Esperado:**
```
mode: "reference"
awaiting: "true"          // ✅ PRESERVADO após reload
refJobId: "<uuid>"        // ✅ PRESERVADO após reload

Restored State:
{
  mode: "reference",
  awaitingSecondTrack: true,
  referenceFirstJobId: "<uuid>",
  ...
}
```

#### Comportamento (Ideal)
- [ ] State machine restaura de sessionStorage
- [ ] Modal abre direto para segunda música
- [ ] **NÃO pede** primeira música novamente
- [ ] Permite upload de segunda música

#### Comportamento (Aceitável)
- [ ] Modal mostra mensagem: "Sessão anterior detectada - deseja continuar?"
- [ ] Opção de retomar ou reiniciar
- [ ] Se reiniciar, limpa estado completamente

#### Comportamento (NÃO aceitável)
- [ ] ❌ Perde estado silenciosamente
- [ ] ❌ Pede primeira música sem aviso
- [ ] ❌ Mostra erro "Cannot start reference"

---

## 📊 CHECKLIST RESUMIDA (Para Validação Rápida)

### Funcional
- [ ] **FA1:** Genre funciona 100% normal (TESTE 1)
- [ ] **FA2:** Reference primeira track seta `awaitingSecondTrack=true` (TESTE 2)
- [ ] **FA3:** Fechar modal preserva estado (TESTE 3)
- [ ] **FA4:** Reference segunda track tem payload limpo SEM `genre`/`genreTargets` (TESTE 4)
- [ ] **FA5:** Backend retorna `referenceComparison` (TESTE 4)
- [ ] **FA6:** UI renderiza comparação A/B (TESTE 4)
- [ ] **FA7:** Erro reference mostra `confirm()` dialog (TESTE 5)
- [ ] **FA8:** Transição genre↔reference não vaza estado (TESTE 6)
- [ ] **FA9:** Refresh mantém estado awaiting (TESTE 7)

### Segurança (Não Quebrar Genre)
- [ ] **SA1:** Genre payload tem `genreTargets` (TESTE 1)
- [ ] **SA2:** Genre **NÃO mostra** logs `[REF_FIX]` (TESTE 1)
- [ ] **SA3:** Genre **NÃO tem** `awaitingSecondTrack` ativo (TESTE 1)
- [ ] **SA4:** Genre funciona após transição de reference (TESTE 6)

### Técnico
- [ ] **TA1:** Console mostra `[REF_FIX] ✅ awaitingSecondTrack=true` (TESTE 2)
- [ ] **TA2:** Console mostra `PRESERVANDO estado` ao fechar (TESTE 3)
- [ ] **TA3:** sessionStorage persiste entre fechar/abrir (TESTE 3)
- [ ] **TA4:** Network mostra payload segunda track SEM genre (TESTE 4)
- [ ] **TA5:** Response tem `referenceComparison` não-null (TESTE 4)
- [ ] **TA6:** Nenhum erro "Cannot start reference first track" (TODOS)

---

## 🚨 CRITÉRIOS DE FALHA CRÍTICA

**Se algum desses ocorrer, correção é OBRIGATÓRIA:**

1. ❌ **TESTE 1 falha** → Genre quebrou (regressão crítica)
2. ❌ **TESTE 4 payload tem `genre` ou `genreTargets`** → Vazamento de dados
3. ❌ **TESTE 5 fallback automático sem `confirm()`** → UX ruim + bugs mascarados
4. ❌ **TESTE 6 vazamento de estado entre modos** → Contaminação de dados

---

## 📝 TEMPLATE DE RELATÓRIO DE TESTES

```markdown
# Relatório de Testes - Reference Mode
Data: ___/___/2025
Testador: ____________

## TESTE 1: Genre Normal
- [ ] PASSOU
- [ ] FALHOU - Motivo: _______________

## TESTE 2: Reference 1ª Track
- [ ] PASSOU
- [ ] FALHOU - Motivo: _______________
- awaitingSecondTrack=true? [ ] SIM [ ] NÃO
- referenceFirstJobId presente? [ ] SIM [ ] NÃO

## TESTE 3: Fechar/Reabrir Modal
- [ ] PASSOU
- [ ] FALHOU - Motivo: _______________

## TESTE 4: Reference 2ª Track
- [ ] PASSOU
- [ ] FALHOU - Motivo: _______________
- Payload SEM genre/genreTargets? [ ] SIM [ ] NÃO
- referenceComparison presente? [ ] SIM [ ] NÃO

## TESTE 5: Erro em Reference
- [ ] PASSOU
- [ ] FALHOU - Motivo: _______________
- Dialog confirm() apareceu? [ ] SIM [ ] NÃO

## TESTE 6: Alternar Modos
- [ ] PASSOU
- [ ] FALHOU - Motivo: _______________

## TESTE 7: Refresh Durante Awaiting
- [ ] PASSOU
- [ ] FALHOU - Motivo: _______________

## RESUMO
- Total testes: 7
- Passou: ___
- Falhou: ___
- Taxa de sucesso: ___%

## OBSERVAÇÕES
_______________________________________________
_______________________________________________
```

---

**Status:** ✅ Checklist de testes completa  
**Próxima ação:** Executar TESTE 1-7 em ordem e preencher relatório
