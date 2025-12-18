# ✅ VALIDAÇÃO PRODUÇÃO: Reference Mode com cURL

**Objetivo**: Validar correções em produção usando headers e logs  
**Pré-requisito**: ⚠️ **RAILWAY DEVE TER FEITO REDEPLOY**

---

## 🚨 PASSO 0: CONFIRMAR REDEPLOY

### Por que isso é crítico:

O log "(SEGUNDO JOB)" **NÃO EXISTE** no código atual. Se ainda aparece, Railway está rodando código antigo.

### Como forçar redeploy:

**Opção A - Dashboard Railway**:
1. Acessar https://railway.app/dashboard
2. Selecionar projeto SoundyAI
3. Clicar em "Deploy" → "Redeploy"
4. Aguardar build completo (~5-10 minutos)

**Opção B - Git push**:
```bash
git commit --allow-empty -m "force redeploy"
git push origin main
```

**Opção C - Railway CLI**:
```bash
railway up --force
```

---

## 📋 PASSO 1: VALIDAR VERSÃO DO BUILD

### Comando:

```bash
curl -I https://soundyai-app-production.up.railway.app/api/jobs/test
```

### Headers esperados:

```http
HTTP/1.1 404 Not Found  (jobId "test" não existe - OK)
X-JOBS-HANDLER: work/api/jobs/[id].js
X-STATUS-HANDLER: work/api/jobs/[id].js#PROBE_A
X-STATUS-TS: 1766030123456
X-BUILD: <commit-hash-SHA>
Content-Type: application/json
```

### ✅ O que validar:

| Header | Validação | Significado |
|--------|-----------|-------------|
| **X-JOBS-HANDLER** | `work/api/jobs/[id].js` | Handler correto está respondendo |
| **X-BUILD** | Hash do commit recente | Versão atual do código está rodando |
| **X-STATUS-HANDLER** | `#PROBE_A` | Probe de auditoria ativo |

### ❌ Se X-BUILD não aparecer:

Railway não fez rebuild. Repetir PASSO 0.

---

## 📋 PASSO 2: CRIAR JOB DE TESTE (REFERENCE MODE)

### 2.1 - Abrir app em produção:

```
https://soundyai-app-production.up.railway.app
```

### 2.2 - Abrir DevTools:

- Chrome/Edge: `F12` ou `Ctrl+Shift+I`
- Firefox: `F12`
- Safari: `Cmd+Option+I`

### 2.3 - Aba Network → XHR:

Deixar aberta para capturar requests

### 2.4 - Selecionar modo Reference:

- Clicar em "Comparação A/B" ou botão de modo reference
- Fazer upload de uma música qualquer (MP3, WAV, etc)

### 2.5 - Aguardar job ser criado:

No console do browser, deve aparecer:
```
[REF-FLOW] startNewReferenceFlow()
[REF-FLOW] onFirstTrackSelected()
[REF-FLOW] ✅ baseJobId setado imediatamente: <uuid-job-id>
```

### 2.6 - Copiar jobId:

Do console ou da aba Network, copiar o UUID do job (ex: `76704faf-de4d-4cab-adfa-5f1384d19cc5`)

---

## 📋 PASSO 3: VALIDAR HEADERS DURANTE POLLING

### Comando (substituir `<jobId>` pelo UUID real):

```bash
curl -I https://soundyai-app-production.up.railway.app/api/jobs/<jobId>
```

**Exemplo**:
```bash
curl -I https://soundyai-app-production.up.railway.app/api/jobs/76704faf-de4d-4cab-adfa-5f1384d19cc5
```

### Headers esperados (reference mode):

```http
HTTP/1.1 200 OK
X-JOBS-HANDLER: work/api/jobs/[id].js
X-REF-GUARD: V7
X-EARLY-RETURN: EXECUTED
X-MODE: reference
X-BUILD: <commit-hash>
Content-Type: application/json; charset=utf-8
```

### ✅ Checklist de validação:

| Header | Valor esperado | Status | Significado |
|--------|----------------|--------|-------------|
| **X-REF-GUARD** | `V7` | ✅ ou ❌ | Early return foi executado |
| **X-EARLY-RETURN** | `EXECUTED` | ✅ ou ❌ | Reference não passou por validação Genre |
| **X-MODE** | `reference` | ✅ ou ❌ | Modo detectado corretamente |
| **X-BUILD** | Hash commit recente | ✅ ou ❌ | Versão correta rodando |

### ❌ Se headers não aparecerem:

**Possíveis causas**:
1. Railway não fez redeploy (repetir PASSO 0)
2. Job ainda está em `queued` ou `pending` (aguardar 5-10 segundos)
3. Job é de modo `genre` (criar novo job em modo reference)

---

## 📋 PASSO 4: VALIDAR JSON RETORNADO

### Comando (incluir `-v` para ver response body):

```bash
curl -v https://soundyai-app-production.up.railway.app/api/jobs/<jobId>
```

### Response esperada (BASE completada):

```json
{
  "id": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
  "jobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
  "status": "completed",
  "mode": "reference",
  "referenceStage": "base",
  "nextAction": "upload_second_track",
  "requiresSecondTrack": true,
  "referenceJobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
  "suggestions": [],
  "aiSuggestions": [],
  "technicalData": {...},
  "metrics": {...},
  "score": 85,
  "traceId": "ref_1766030000000"
}
```

### ✅ Checklist de campos críticos:

| Campo | Valor esperado | Status | Motivo |
|-------|----------------|--------|--------|
| **status** | `completed` | ✅ ou ❌ | Nunca deve ser `processing` para base |
| **nextAction** | `upload_second_track` | ✅ ou ❌ | Sinaliza frontend abrir modal 2 |
| **requiresSecondTrack** | `true` | ✅ ou ❌ | Indica que segunda track é necessária |
| **referenceStage** | `base` | ✅ ou ❌ | Stage correto |
| **suggestions** | `[]` (vazio) | ✅ ou ❌ | Vazio é válido para base |
| **aiSuggestions** | `[]` (vazio) | ✅ ou ❌ | Vazio é válido para base |
| **traceId** | `ref_...` | ✅ ou ❌ | Permite rastrear fluxo completo |

### ❌ Se status for "processing":

**PROBLEMA CRÍTICO**: Early return não está funcionando

**Debug**:
1. Verificar logs Railway (buscar por `[REF-GUARD-V7]`)
2. Verificar se `X-REF-GUARD: V7` aparece nos headers
3. Se não aparecer, Railway não fez rebuild

---

## 📋 PASSO 5: VALIDAR LOGS NO RAILWAY

### 5.1 - Acessar Railway Dashboard:

```
https://railway.app/dashboard → Projeto SoundyAI → Deployments → Logs
```

### 5.2 - Filtrar logs por traceId:

Buscar pelo traceId que apareceu no JSON (ex: `ref_1766030000000`)

### 5.3 - Logs que DEVEM aparecer:

```
✅ [REF-GUARD-V7] DIAGNOSTICO_COMPLETO { jobId: '...', effectiveMode: 'reference', effectiveStage: 'base' }
✅ [REF-GUARD-V7] ✅ EARLY_RETURN_EXECUTANDO para reference { traceId: 'ref_...', mode: 'reference' }
✅ [REF-GUARD-V7] ✅ BASE completed { traceId: 'ref_...', requiresSecondTrack: true, nextAction: 'upload_second_track' }
✅ [REF-GUARD-V7] 📤 EARLY RETURN - status: completed stage: base
```

### 5.4 - Logs que NÃO DEVEM aparecer:

```
❌ [API-FIX][GENRE] ⚠️ Job marcado como "completed" mas falta dados essenciais
❌ (SEGUNDO JOB)
❌ [API-FIX][GENRE] Retornando status "processing"
❌ [REF-GUARD-V7] 🚨 ALERTA: Reference escapou do early return!
```

### ✅ Se logs corretos aparecerem:

**SUCESSO** - Early return está funcionando, reference não passa por validação Genre

### ❌ Se logs incorretos aparecerem:

**PROBLEMA** - Railway ainda rodando código antigo, repetir PASSO 0

---

## 📋 PASSO 6: VALIDAR FRONTEND (BROWSER CONSOLE)

### 6.1 - Com DevTools aberto (aba Console):

Repetir upload de música em modo Reference

### 6.2 - Logs que DEVEM aparecer:

```
✅ [REF-FLOW] startNewReferenceFlow()
✅ [REF-FLOW] Novo fluxo iniciado ref_1766030000000
✅ [REF-FLOW] onFirstTrackSelected() { traceId: 'ref_...', currentStage: 'idle' }
✅ [REF-FLOW] ✅ baseJobId setado imediatamente: <uuid>
✅ [REF-STATE-TRACE] { event: 'onFirstTrackProcessing', jobId: '...', stage: 'BASE_PROCESSING' }
✅ [POLL-TRACE] { traceId: 'ref_...', status: 'completed', nextAction: 'upload_second_track', willOpenModal: true }
✅ [POLLING][REFERENCE] 🎯 Base completada { hasNextAction: true, traceId: 'ref_...' }
✅ [POLLING][REFERENCE] ✅ Modal 2 aberto { traceId: 'ref_...' }
```

### 6.3 - Logs que NÃO DEVEM aparecer:

```
❌ [REF-FLOW] ⚠️ Fluxo em andamento - NÃO resetando
   (se aparecer com stage BASE_UPLOADING/BASE_PROCESSING, é ESPERADO - reset foi prevenido ✅)
❌ [POLL-TRACE] { willOpenModal: false }
   (significa nextAction não foi detectado - PROBLEMA ❌)
```

---

## 📋 PASSO 7: VALIDAR SESSIONSTORAGE

### 7.1 - Abrir DevTools → Application/Storage:

- Chrome/Edge: Aba "Application"
- Firefox: Aba "Storage"
- Safari: Aba "Storage"

### 7.2 - Navegar para Session Storage:

```
Session Storage → https://soundyai-app-production.up.railway.app → REF_FLOW_V1
```

### 7.3 - Valor esperado (após modal 2 abrir):

```json
{
  "stage": "awaiting_second",
  "baseJobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
  "baseMetrics": {
    "score": 85,
    "technicalData": {...}
  },
  "traceId": "ref_1766030000000"
}
```

### ✅ Checklist:

| Campo | Valor esperado | Status | Motivo |
|-------|----------------|--------|--------|
| **stage** | `awaiting_second` | ✅ ou ❌ | Estado correto após base completar |
| **baseJobId** | UUID não-null | ✅ ou ❌ | Job da primeira track salvo |
| **baseMetrics** | Objeto com score | ✅ ou ❌ | Métricas da primeira track salvas |
| **traceId** | `ref_...` | ✅ ou ❌ | Mesmo ID atravessa todo fluxo |

### ❌ Se baseJobId for null:

**PROBLEMA**: Reset foi chamado incorretamente ou baseJobId não foi setado

**Debug**:
1. Buscar logs `[REF-FLOW] ✅ baseJobId setado imediatamente` no console
2. Se não aparecer, correção frontend não foi aplicada

---

## 📋 PASSO 8: VALIDAR FLUXO E2E COMPLETO

### 8.1 - Fluxo esperado:

| Passo | Ação | Resultado esperado | Status |
|-------|------|-------------------|--------|
| 1 | Abrir app | UI carrega normalmente | ✅ ou ❌ |
| 2 | Selecionar "Comparação A/B" | Botão destacado, modo ativo | ✅ ou ❌ |
| 3 | Upload primeira música | Modal 1 abre "Analisando..." | ✅ ou ❌ |
| 4 | Aguardar processamento | Barra de progresso aparece | ✅ ou ❌ |
| 5 | Job completa | **Modal 1 fecha automaticamente** | ✅ ou ❌ |
| 6 | 500ms depois | **Modal 2 abre automaticamente** | ✅ ou ❌ |
| 7 | Modal 2 conteúdo | "Upload segunda música para comparar" | ✅ ou ❌ |
| 8 | Upload segunda música | Modal comparação abre | ✅ ou ❌ |
| 9 | Comparação exibida | Gráficos A vs B aparecem | ✅ ou ❌ |
| 10 | Suggestions aparecem | Lista de sugestões renderizada | ✅ ou ❌ |

### ✅ Critério de sucesso:

**TODOS os 10 passos devem passar**

### ❌ Se modal 1 não fechar:

**PROBLEMA**: nextAction não está sendo retornado pelo backend

**Debug**:
1. Verificar PASSO 4 (JSON deve ter `nextAction: 'upload_second_track'`)
2. Verificar logs Railway (deve ter `[REF-GUARD-V7] ✅ BASE completed`)
3. Se não tiver, Railway não fez rebuild

### ❌ Se modal 2 não abrir:

**PROBLEMA**: Frontend não detectou nextAction

**Debug**:
1. Console do browser deve ter `[POLL-TRACE] { willOpenModal: true }`
2. Se tiver `willOpenModal: false`, correção frontend não aplicada
3. Verificar se arquivo `audio-analyzer-integration.js` tem correção nas linhas 3244-3280

---

## 🎯 RESUMO DE VALIDAÇÃO

### Checklist final:

| Item | Status | Comando/Local |
|------|--------|---------------|
| 1. Railway fez redeploy | ✅ ou ❌ | Dashboard Railway |
| 2. X-BUILD presente | ✅ ou ❌ | `curl -I /api/jobs/test` |
| 3. X-REF-GUARD: V7 | ✅ ou ❌ | `curl -I /api/jobs/<jobId>` |
| 4. X-EARLY-RETURN: EXECUTED | ✅ ou ❌ | `curl -I /api/jobs/<jobId>` |
| 5. status: completed (não processing) | ✅ ou ❌ | `curl /api/jobs/<jobId>` |
| 6. nextAction: upload_second_track | ✅ ou ❌ | `curl /api/jobs/<jobId>` |
| 7. Logs Railway corretos | ✅ ou ❌ | Railway Dashboard → Logs |
| 8. Logs frontend corretos | ✅ ou ❌ | Browser Console |
| 9. baseJobId salvo em sessionStorage | ✅ ou ❌ | DevTools → Application → Session Storage |
| 10. Modal 1 fecha → Modal 2 abre | ✅ ou ❌ | Teste E2E manual |

### ✅ Todos os 10 itens passaram:

**SUCESSO COMPLETO** - Correções funcionando em produção

### ❌ Algum item falhou:

Consultar seção de debug do item específico acima

---

## 🚨 TROUBLESHOOTING

### Problema: "(SEGUNDO JOB)" ainda aparece nos logs

**Causa**: Railway não fez rebuild  
**Solução**: Repetir PASSO 0 (forçar redeploy)

### Problema: X-REF-GUARD não aparece nos headers

**Causa**: Job não está em modo reference  
**Solução**: Criar novo job selecionando "Comparação A/B" explicitamente

### Problema: status retorna "processing" em vez de "completed"

**Causa**: Early return não executou, Genre validation rodou  
**Solução**: Verificar logs Railway, buscar por `[REF-GUARD-V7] 🚨 ALERTA`

### Problema: Modal 2 não abre

**Causa 1**: nextAction não retornado pelo backend  
**Solução**: Verificar PASSO 4 (JSON deve ter nextAction)

**Causa 2**: Frontend não detectou nextAction  
**Solução**: Verificar console browser, buscar `[POLL-TRACE] { willOpenModal: false }`

### Problema: baseJobId vira null

**Causa**: Reset chamado durante progresso  
**Solução**: Verificar logs console, buscar `[REF-FLOW] ⚠️ Fluxo em andamento - NÃO resetando`  
(se aparecer, correção funcionou - baseJobId foi PRESERVADO ✅)

---

## FIM DO CHECKLIST

**Próximo passo**: Executar PASSO 0 → PASSO 8 em ordem  
**Tempo estimado**: 15-20 minutos (incluindo redeploy)
