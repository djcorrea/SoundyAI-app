# 📋 CONTRATO REFERENCE MODE: ANTES vs DEPOIS

**Data**: 18/12/2025  
**Objetivo**: Documentar mudanças no JSON retornado pelo endpoint GET /api/jobs/:id

---

## 🔄 REFERENCE BASE (1ª música)

### ❌ ANTES (comportamento bugado em produção)

**Endpoint**: `GET /api/jobs/:id`  
**Status retornado**: `processing` (downgrade incorreto)  
**Motivo**: Validação Genre executada incorretamente para reference

```json
{
  "ok": true,
  "job": {
    "id": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
    "status": "processing",  // ❌ DOWNGRADE INCORRETO
    "file_key": "musica-a.mp3",
    "mode": "reference",
    "referenceStage": "base",
    "requiresSecondTrack": true,
    "referenceJobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
    "created_at": "2025-12-18T10:00:00.000Z",
    "updated_at": "2025-12-18T10:01:30.000Z",
    "completed_at": "2025-12-18T10:01:30.000Z",
    "results": {
      "mode": "reference",
      "referenceStage": "base",
      "status": "completed",
      "score": 85,
      "technicalData": {
        "lufsIntegrated": -14.2,
        "truePeakDbtp": -1.8,
        "dynamicRange": 8.5,
        "sampleRate": 44100,
        "bitDepth": 16,
        "channels": 2,
        "duration": 180
      },
      "metrics": {
        "loudness": { "value": -14.2, "unit": "LUFS" },
        "truePeak": { "value": -1.8, "unit": "dBTP" },
        "dr": { "value": 8.5, "unit": "dB" }
      },
      "suggestions": [],  // ✅ VAZIO É NORMAL PARA BASE
      "aiSuggestions": []  // ✅ VAZIO É NORMAL PARA BASE
    },
    "error": null
  }
}
```

**Headers HTTP**:
```
X-STATUS-HANDLER: work/api/jobs/[id].js#PROBE_A
X-STATUS-TS: 1766030000000
```

**Logs backend (incorretos)**:
```
[API-FIX][GENRE] ⚠️ Job marcado como "completed" mas falta dados essenciais
[API-FIX][GENRE] Dados ausentes: { suggestions: true, aiSuggestions: true, technicalData: false }
[API-FIX][GENRE] Retornando status "processing" para frontend aguardar comparacao completa
```

**Comportamento frontend**:
- ❌ Polling infinito (aguarda status completed que nunca chega)
- ❌ Modal 1ª música não fecha
- ❌ Modal 2ª música nunca abre
- ❌ baseJobId permanece null

---

### ✅ DEPOIS (comportamento correto com correções)

**Endpoint**: `GET /api/jobs/:id`  
**Status retornado**: `completed` (mantido corretamente)  
**Motivo**: Early return executado antes de validação Genre

```json
{
  "ok": true,
  "job": {
    "id": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
    "status": "completed",  // ✅ MANTIDO COMPLETED
    "file_key": "musica-a.mp3",
    "mode": "reference",
    "referenceStage": "base",
    "requiresSecondTrack": true,  // ✅ SINALIZA PRÓXIMO PASSO
    "referenceJobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
    "nextAction": "upload_second_track",  // ✅ NOVO: Frontend sabe o que fazer
    "traceId": "trace_1766030000000",  // ✅ NOVO: Rastreabilidade
    "created_at": "2025-12-18T10:00:00.000Z",
    "updated_at": "2025-12-18T10:01:30.000Z",
    "completed_at": "2025-12-18T10:01:30.000Z",
    "results": {
      "mode": "reference",
      "referenceStage": "base",
      "status": "completed",
      "score": 85,
      "technicalData": {
        "lufsIntegrated": -14.2,
        "truePeakDbtp": -1.8,
        "dynamicRange": 8.5,
        "sampleRate": 44100,
        "bitDepth": 16,
        "channels": 2,
        "duration": 180
      },
      "metrics": {
        "loudness": { "value": -14.2, "unit": "LUFS" },
        "truePeak": { "value": -1.8, "unit": "dBTP" },
        "dr": { "value": 8.5, "unit": "dB" }
      },
      "suggestions": [],  // ✅ VAZIO CONTINUA VÁLIDO
      "aiSuggestions": []  // ✅ VAZIO CONTINUA VÁLIDO
    },
    "error": null
  }
}
```

**Headers HTTP** (rastreabilidade completa):
```
X-JOBS-HANDLER: work/api/jobs/[id].js
X-STATUS-HANDLER: work/api/jobs/[id].js#PROBE_A
X-STATUS-TS: 1766030000000
X-BUILD: abc123def456...  // Hash do commit do Railway/Vercel
X-REF-GUARD: V7
X-EARLY-RETURN: EXECUTED
X-MODE: reference
```

**Logs backend (corretos)**:
```
[REF-GUARD-V7] ✅ EARLY_RETURN_EXECUTANDO para reference {
  traceId: 'trace_1766030000000',
  jobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  mode: 'reference',
  stage: 'base',
  status: 'completed'
}

[REF-GUARD-V7] ✅ BASE completed {
  traceId: 'trace_1766030000000',
  jobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  requiresSecondTrack: true,
  nextAction: 'upload_second_track',
  referenceJobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5'
}
```

**Comportamento frontend**:
- ✅ Polling para quando recebe `status: completed` e `nextAction: 'upload_second_track'`
- ✅ Modal 1ª música fecha automaticamente
- ✅ Modal 2ª música abre imediatamente
- ✅ baseJobId persistido corretamente desde o início

---

## 🔄 REFERENCE COMPARE (2ª música)

### ❌ ANTES (comportamento hipotético sem correção)

**Endpoint**: `GET /api/jobs/:id`  
**Status retornado**: `processing` ou `completed` inconsistente

```json
{
  "ok": true,
  "job": {
    "id": "88e052bf-1234-5678-9abc-def012345678",
    "status": "completed",
    "file_key": "musica-b.mp3",
    "mode": "reference",
    "referenceStage": "compare",
    "referenceJobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",  // ID da base
    "created_at": "2025-12-18T10:02:00.000Z",
    "updated_at": "2025-12-18T10:03:30.000Z",
    "completed_at": "2025-12-18T10:03:30.000Z",
    "results": {
      "mode": "reference",
      "referenceStage": "compare",
      "status": "completed",
      "score": 78,
      "technicalData": { /* métricas track B */ },
      "metrics": { /* métricas track B */ },
      "referenceComparison": {
        "baseJobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
        "comparisons": [
          {
            "metric": "lufsIntegrated",
            "base": -14.2,
            "current": -12.8,
            "delta": "+1.4",
            "status": "louder"
          },
          {
            "metric": "truePeakDbtp",
            "base": -1.8,
            "current": -0.5,
            "delta": "+1.3",
            "status": "higher_peak"
          }
        ]
      },
      "suggestions": [
        {
          "id": "ref_lufs",
          "metric": "Loudness (LUFS)",
          "currentValue": "-12.8 LUFS",
          "targetValue": "-14.2 LUFS",
          "delta": "+1.4 dB",
          "priority": "high",
          "suggestion": "Reduzir gain em 1.4 dB para igualar a referência"
        }
      ],
      "aiSuggestions": [
        {
          "category": "loudness",
          "message": "Sua música está 1.4 dB mais alta que a referência...",
          "action": "Reduzir gain",
          "priority": "high"
        }
      ]
    },
    "error": null
  }
}
```

---

### ✅ DEPOIS (comportamento correto com correção)

**Endpoint**: `GET /api/jobs/:id`  
**Status retornado**: `completed`  
**Motivo**: Early return executado, compare tem suggestions obrigatórias

```json
{
  "ok": true,
  "job": {
    "id": "88e052bf-1234-5678-9abc-def012345678",
    "status": "completed",  // ✅ COMPLETED COM SUGGESTIONS
    "file_key": "musica-b.mp3",
    "mode": "reference",
    "referenceStage": "compare",
    "referenceJobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
    "nextAction": "show_comparison",  // ✅ NOVO: Sinaliza exibir comparação
    "traceId": "trace_1766030100000",  // ✅ NOVO: Rastreabilidade
    "created_at": "2025-12-18T10:02:00.000Z",
    "updated_at": "2025-12-18T10:03:30.000Z",
    "completed_at": "2025-12-18T10:03:30.000Z",
    "results": {
      "mode": "reference",
      "referenceStage": "compare",
      "status": "completed",
      "score": 78,
      "technicalData": {
        "lufsIntegrated": -12.8,
        "truePeakDbtp": -0.5,
        "dynamicRange": 7.2,
        "sampleRate": 44100,
        "bitDepth": 16,
        "channels": 2,
        "duration": 185
      },
      "metrics": {
        "loudness": { "value": -12.8, "unit": "LUFS" },
        "truePeak": { "value": -0.5, "unit": "dBTP" },
        "dr": { "value": 7.2, "unit": "dB" }
      },
      "referenceComparison": {
        "baseJobId": "76704faf-de4d-4cab-adfa-5f1384d19cc5",
        "comparisons": [
          {
            "metric": "lufsIntegrated",
            "base": -14.2,
            "current": -12.8,
            "delta": "+1.4",
            "status": "louder",
            "recommendation": "reduce"
          },
          {
            "metric": "truePeakDbtp",
            "base": -1.8,
            "current": -0.5,
            "delta": "+1.3",
            "status": "higher_peak",
            "recommendation": "reduce"
          },
          {
            "metric": "dynamicRange",
            "base": 8.5,
            "current": 7.2,
            "delta": "-1.3",
            "status": "less_dynamic",
            "recommendation": "increase"
          }
        ],
        "summary": {
          "totalMetrics": 3,
          "metricsOutOfRange": 3,
          "overallMatch": "poor"
        }
      },
      "suggestions": [
        {
          "id": "ref_lufs",
          "metric": "Loudness (LUFS)",
          "currentValue": "-12.8 LUFS",
          "targetValue": "-14.2 LUFS",
          "delta": "+1.4 dB",
          "deltaNum": 1.4,
          "priority": "high",
          "suggestion": "Reduzir gain em 1.4 dB para igualar a referência"
        },
        {
          "id": "ref_peak",
          "metric": "True Peak",
          "currentValue": "-0.5 dBTP",
          "targetValue": "-1.8 dBTP",
          "delta": "+1.3 dB",
          "deltaNum": 1.3,
          "priority": "high",
          "suggestion": "Reduzir pico em 1.3 dB para igualar a referência"
        },
        {
          "id": "ref_dr",
          "metric": "Dynamic Range",
          "currentValue": "7.2 dB",
          "targetValue": "8.5 dB",
          "delta": "-1.3 dB",
          "deltaNum": -1.3,
          "priority": "medium",
          "suggestion": "Aumentar dinâmica em 1.3 dB para igualar a referência"
        }
      ],
      "aiSuggestions": [
        {
          "category": "loudness",
          "message": "Sua música está 1.4 dB mais alta que a referência. Isso pode causar fadiga auditiva e reduzir a dinâmica percebida.",
          "action": "Reduzir gain geral em 1.4 dB no master ou limiter",
          "priority": "high",
          "technical": true
        },
        {
          "category": "dynamics",
          "message": "Sua música tem menos dinâmica (-1.3 dB DR) comparado à referência. Isso indica compressão/limiting excessivos.",
          "action": "Reduzir ratio do compressor ou threshold do limiter",
          "priority": "medium",
          "technical": true
        },
        {
          "category": "peak",
          "message": "Seu true peak está 1.3 dB mais alto. Risco de clipping em conversão de formato ou streaming.",
          "action": "Aplicar true peak limiter com ceiling em -1.8 dBTP",
          "priority": "high",
          "technical": true
        }
      ]
    },
    "error": null
  }
}
```

**Headers HTTP**:
```
X-JOBS-HANDLER: work/api/jobs/[id].js
X-STATUS-HANDLER: work/api/jobs/[id].js#PROBE_A
X-STATUS-TS: 1766030100000
X-BUILD: abc123def456...
X-REF-GUARD: V7
X-EARLY-RETURN: EXECUTED
X-MODE: reference
```

**Logs backend**:
```
[REF-GUARD-V7] ✅ EARLY_RETURN_EXECUTANDO para reference {
  traceId: 'trace_1766030100000',
  jobId: '88e052bf-1234-5678-9abc-def012345678',
  mode: 'reference',
  stage: 'compare',
  status: 'completed'
}

[REF-GUARD-V7] ✅ COMPARE completed {
  traceId: 'trace_1766030100000',
  jobId: '88e052bf-1234-5678-9abc-def012345678',
  nextAction: 'show_comparison'
}
```

**Comportamento frontend**:
- ✅ Polling para quando recebe `status: completed` e `nextAction: 'show_comparison'`
- ✅ Exibe tabela de comparação
- ✅ Renderiza suggestions + aiSuggestions
- ✅ Permite download do relatório

---

## 📊 TABELA COMPARATIVA: CAMPOS NOVOS

| Campo | BASE (antes) | BASE (depois) | COMPARE (antes) | COMPARE (depois) |
|---|---|---|---|---|
| **status** | `processing` ❌ | `completed` ✅ | `completed` ✅ | `completed` ✅ |
| **requiresSecondTrack** | `true` ✅ | `true` ✅ | `false` ✅ | `false` ✅ |
| **nextAction** | ❌ Ausente | ✅ `upload_second_track` | ❌ Ausente | ✅ `show_comparison` |
| **traceId** | ❌ Ausente | ✅ `trace_<timestamp>` | ❌ Ausente | ✅ `trace_<timestamp>` |
| **suggestions** | `[]` ✅ | `[]` ✅ | `[...]` ✅ | `[...]` ✅ |
| **aiSuggestions** | `[]` ✅ | `[]` ✅ | `[...]` ✅ | `[...]` ✅ |
| **referenceComparison** | ❌ Ausente | ❌ Ausente | ✅ `{...}` | ✅ `{...}` |

### Headers HTTP novos:

| Header | Antes | Depois | Propósito |
|---|---|---|---|
| **X-JOBS-HANDLER** | ❌ Ausente | ✅ `work/api/jobs/[id].js` | Identificar handler ativo |
| **X-BUILD** | ❌ Ausente | ✅ Hash do commit | Rastrear versão em produção |
| **X-REF-GUARD** | ✅ `V7` | ✅ `V7` | Confirmar early return executado |
| **X-EARLY-RETURN** | ✅ `EXECUTED` | ✅ `EXECUTED` | Confirmar que não passou por Genre validation |
| **X-MODE** | ❌ Ausente | ✅ `reference` | Confirmar modo detectado |

---

## 🔍 FLUXO DE LOGS COM TRACEID

### BASE (1ª música)

**1. Frontend cria job**:
```javascript
[REF-FLOW] onFirstTrackSelected() {
  traceId: 'trace_1766030000000',
  currentStage: 'idle'
}

[REF-FLOW] Stage: BASE_UPLOADING {
  traceId: 'trace_1766030000000',
  baseJobId: null  // Ainda null (normal neste ponto)
}
```

**2. Job criado, baseJobId setado imediatamente**:
```javascript
[REF-FLOW] ✅ baseJobId setado imediatamente: 76704faf-de4d-4cab-adfa-5f1384d19cc5

[REF-STATE-TRACE] {
  traceId: 'trace_1766030000000',
  event: 'onFirstTrackProcessing',
  jobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  oldBaseJobId: null,
  newBaseJobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  stage: 'BASE_PROCESSING'
}
```

**3. Polling inicia**:
```javascript
[POLL-TRACE] {
  traceId: 'trace_1766030000000',
  timestamp: '2025-12-18T10:00:05.000Z',
  jobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  status: 'processing',
  mode: 'reference',
  referenceStage: 'base',
  nextAction: undefined,
  requiresSecondTrack: undefined,
  baseJobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  willOpenModal: false
}
```

**4. Backend processa e retorna completed**:
```javascript
[REF-GUARD-V7] ✅ EARLY_RETURN_EXECUTANDO para reference {
  traceId: 'trace_1766030000000',
  jobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  mode: 'reference',
  stage: 'base',
  status: 'completed'
}

[REF-GUARD-V7] ✅ BASE completed {
  traceId: 'trace_1766030000000',
  jobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  requiresSecondTrack: true,
  nextAction: 'upload_second_track',
  referenceJobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5'
}
```

**5. Frontend recebe completed e abre modal 2**:
```javascript
[POLL-TRACE] {
  traceId: 'trace_1766030000000',
  timestamp: '2025-12-18T10:01:30.000Z',
  jobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  status: 'completed',  // ✅ COMPLETED
  mode: 'reference',
  referenceStage: 'base',
  nextAction: 'upload_second_track',  // ✅ SINALIZA MODAL 2
  requiresSecondTrack: true,
  baseJobId: '76704faf-de4d-4cab-adfa-5f1384d19cc5',
  willOpenModal: true  // ✅ TRUE - VAI ABRIR MODAL
}

[POLLING][REFERENCE] 🎯 Base completada {
  hasNextAction: true,
  traceId: 'trace_1766030000000'
}
```

---

## ✅ CRITÉRIOS DE ACEITE

| Critério | Status | Evidência |
|---|---|---|
| **1. BASE retorna completed** | ✅ PASS | `status: 'completed'` mantido, sem downgrade |
| **2. Modal 1 fecha** | ✅ PASS | `nextAction: 'upload_second_track'` detectado |
| **3. Modal 2 abre** | ✅ PASS | `openReferenceUploadModal()` chamado |
| **4. Sem downgrade por suggestions** | ✅ PASS | Early return impede validação Genre |
| **5. Fluxo Genre funciona** | ✅ PASS | Genre validation só executa se `effectiveMode === 'genre'` |
| **6. baseJobId persistido** | ✅ PASS | `onFirstTrackProcessing()` chamado antes de polling |
| **7. Logs com traceId** | ✅ PASS | Mesmo traceId atravessa frontend + backend |
| **8. Headers rastreáveis** | ✅ PASS | `X-BUILD`, `X-JOBS-HANDLER`, `X-REF-GUARD` adicionados |

---

## FIM DO DOCUMENTO
**Versão**: 1.0  
**Data**: 18/12/2025  
**Status**: Contrato definido + implementado
