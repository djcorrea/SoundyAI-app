# 🔬 AUDITORIA COMPLETA: REFERENCE A/B - CAUSA RAIZ DOS BUGS

**Data:** 19/12/2025  
**Escopo:** Análise de Referência A/B (modo reference)  
**Objetivo:** Identificar causa raiz de bugs que impedem renderização da tabela A vs B

---

## 📋 BUGS REPORTADOS

### Bug #1: "COMPARAÇÃO A/B INDISPONÍVEL"
- **Sintoma:** Modal mostra mensagem de erro "Dados da primeira música não estão disponíveis" em vez da tabela A/B
- **Localização:** Linha 11913 de `audio-analyzer-integration.js`
- **Gatilho:** Função `extractABMetrics()` retorna `ok: false`

### Bug #2: ReferenceError - analysisResult is not defined
- **Sintoma:** Modal não abre, console mostra ReferenceError
- **Localização:** Variáveis não declaradas sendo usadas no escopo de renderização
- **Impacto:** Aborta completamente o fluxo de renderização

### Bug #3: stateMachine is not defined
- **Sintoma:** Erro em `handleModalFileSelection`, reseta `currentAnalysisMode` para 'genre'
- **Localização:** Linha 7898+ de `audio-analyzer-integration.js`
- **Causa:** Script `analysis-state-machine.js` tem `defer` mas integration usa antes de carregar

### Bug #4: Tabela construída mas não visível
- **Sintoma:** Logs mostram "7 linhas construídas" mas tabela não aparece no UI
- **Causa Potencial:** DOM reset após render, CSS ocultando, ou container substituído

---

## 🎯 CAUSA RAIZ #1: SHAPE INCONSISTENTE DE DADOS

### Problema
O backend envia dados em **shapes diferentes** dependendo do contexto:

**Shape 1 - TechnicalData no top-level:**
```json
{
  "jobId": "xxx",
  "mode": "reference",
  "technicalData": {
    "lufsIntegrated": -14.5,
    "truePeakDbtp": -1.2,
    "dynamicRange": 8.3,
    "spectral_balance": { "sub": {...}, "bass": {...} }
  }
}
```

**Shape 2 - Bands e Metrics no top-level:**
```json
{
  "jobId": "xxx",
  "mode": "reference",
  "metrics": { "lufsIntegrated": -14.5 },
  "bands": { "sub": {...}, "bass": {...} }
}
```

**Shape 3 - Aninhado em data:**
```json
{
  "jobId": "xxx",
  "data": {
    "metrics": {...},
    "bands": {...}
  }
}
```

### Impacto
1. **extractABMetrics()** (linha 97) tenta validar `technicalData.lufsIntegrated` mas às vezes está em `metrics.lufsIntegrated`
2. **FirstAnalysisStore.setRef()** salva shape original, mas **renderReferenceComparisons** espera shape diferente
3. **Hidratação falha:** `window.referenceAnalysisData` tem `technicalData.spectral_balance` mas código busca `bands` no top-level

### Evidências no Código

**Linha 97-132 (extractABMetrics):**
```javascript
const technicalData = 
    analysisOrResult.technicalData ||
    analysisOrResult.data?.technicalData ||
    analysisOrResult.results?.technicalData ||
    {};

const metrics = extractMetrics(analysisOrResult);

const hasMinimalMetrics = (
    technicalData.lufsIntegrated != null ||
    metrics.lufsIntegrated != null ||
    // ... múltiplas tentativas
);
```

**Linha 11860-11902 (Validação A/B):**
```javascript
const refMetrics = extractABMetrics(refFromStore);

if (!refMetrics.ok) {
    console.error('[AB-BLOCK] abState:', abState);
    console.error('[AB-DATA] ref metrics extraction failed:', refMetrics.debugShape);
    
    // RENDERIZA ERRO "COMPARAÇÃO A/B INDISPONÍVEL"
    container.innerHTML = `
        <div class="card-title">⚠️ Comparação A/B Indisponível</div>
        <p>Não foi possível recuperar métricas da primeira música.</p>
    `;
}
```

**Linha 17092-17110 (Bandas no renderReferenceComparisons):**
```javascript
const refBandsReal =
    comparisonData?.refBands ||
    comparisonData?.referenceAnalysis?.bands ||  // ❌ Pode ser undefined
    comparisonData?.referenceAnalysis?.technicalData?.spectral_balance ||  // ✅ Shape correto
    window.__soundyState?.reference?.referenceAnalysis?.bands;

if (!refBandsReal || !userBandsReal) {
    console.error('[VALIDATION-FIX] ❌ Falha crítica: bandas não detectadas');
    return displayModalResultsError('Erro na análise');
}
```

---

## 🎯 CAUSA RAIZ #2: HIDRATAÇÃO INCOMPLETA DO STORE

### Problema
Quando a **primeira música (base)** é processada:

1. `handleModalFileSelection` (linha 8198) salva em `FirstAnalysisStore.setRef(refClone, refVid, jobId)`
2. Objeto salvo TEM `technicalData.spectral_balance` MAS NÃO TEM `bands` no top-level
3. Quando a **segunda música (compare)** chega, `renderReferenceComparisons` (linha 16546+) tenta acessar `referenceAnalysis.bands`
4. Como `bands` não existe, `extractABMetrics()` retorna `ok: false`
5. Renderiza mensagem de erro em vez da tabela

### Evidência

**Linha 16764-16810 (Tentativa de hidratação):**
```javascript
const refFromStore = FirstAnalysisStore.getRef();
const refMetricsCheck = extractABMetrics(refFromStore);

if (!refMetricsCheck.ok) {
    console.error('[AB-DATA] ❌ Store reference inválido:', refMetricsCheck.debugShape);
    
    // Tenta hidratar de window.referenceAnalysisData
    if (window.referenceAnalysisData) {
        const refFromWindow = extractABMetrics(window.referenceAnalysisData);
        if (refFromWindow.ok) {
            console.log('[AB-DATA] ✅ Hidratado de window.referenceAnalysisData');
            FirstAnalysisStore.setRef(hydratedRef);
        }
    }
}
```

### Fluxo do Bug

```
1. Upload Música A (base)
   ├─ Backend retorna: { technicalData: { lufsIntegrated, spectral_balance } }
   ├─ FirstAnalysisStore.setRef(analysisA)
   └─ window.__REFERENCE_JOB_ID__ = jobIdA
   
2. Upload Música B (compare)
   ├─ Backend retorna: { technicalData: { lufsIntegrated, spectral_balance } }
   ├─ renderReferenceComparisons() chamado
   ├─ const ref = FirstAnalysisStore.getRef()
   ├─ extractABMetrics(ref) tenta acessar ref.bands (undefined!)
   ├─ extractABMetrics(ref) tenta acessar ref.metrics (undefined!)
   ├─ hasMinimalMetrics = false
   └─ return { ok: false } → RENDERIZA ERRO
```

---

## 🎯 CAUSA RAIZ #3: VARIÁVEIS NÃO DECLARADAS (ReferenceError)

### Problema
Código usa variáveis **antes de declará-las**, causando `ReferenceError` que aborta o render.

### Evidências no Código

**Linha 15779 (Comentário de correção):**
```javascript
// 🎯 CORREÇÃO: Declarar mustBeReference ANTES de usar (previne ReferenceError)
```

**Linha 16397 (Global render lock):**
```javascript
// 🔒 Global render lock para evitar ReferenceError
```

### Localizações Suspeitas
Buscar por:
- `analysisResult` usado sem `const/let/var`
- `mustBeReference` usado antes de declaração
- Variáveis capturadas de closure mas closure executou fora de ordem

---

## 🎯 CAUSA RAIZ #4: stateMachine NÃO DEFINIDO

### Problema
`analysis-state-machine.js` carrega com `defer` (linha 706 de index.html) mas `handleModalFileSelection` tenta usar ANTES do carregamento.

**Linha 706 (index.html):**
```html
<script src="/analysis-state-machine.js?v=PR2"></script>  <!-- SEM defer -->
```

**Linha 7903 (audio-analyzer-integration.js):**
```javascript
const stateMachine = window.AnalysisStateMachine;  // Pode ser undefined!
const currentMode = stateMachine?.getMode() || window.currentAnalysisMode;
```

### Consequência
Se `stateMachine` for `undefined`:
1. `getMode()` falha silenciosamente
2. Fallback para `window.currentAnalysisMode`
3. Se também undefined, assume `'genre'` (linha 8800+)
4. Contamina modo reference → usuário perde contexto da primeira música

### Solução Atual (Insuficiente)
Usa optional chaining `?.` mas não previne reset indevido.

---

## 🎯 CAUSA RAIZ #5: DOM RESET APAGA TABELA

### Problema
Tabela é renderizada corretamente em `container.innerHTML` (linha 19067), mas **depois** algum código reseta o DOM.

### Localizações de container.innerHTML
```
Linha 7212:  container.innerHTML = tableHTML;
Linha 11911: container.innerHTML = (erro A/B indisponível)
Linha 15437: container.innerHTML = (validação)
Linha 18004: container.innerHTML = (fallback)
Linha 19067: container.innerHTML = abTableHTML;  ← RENDERIZAÇÃO CORRETA
Linha 19082: container.innerHTML = (erro de render)
Linha 22122: setTimeout(() => container.innerHTML = '', 100);  ← APAGA DEPOIS DE 100ms!
```

### Suspeito Principal: Linha 22122
```javascript
setTimeout(() => container.innerHTML = '', 100);
```

**Hipótese:** Código de cleanup ou debug esquecido que limpa container após render.

---

## 🎯 CAUSA RAIZ #6: CÁLCULO DE ROWS VAZIO

### Problema
`buildComparisonRows()` (linha 16412) retorna array vazio se métricas não forem encontradas nos paths esperados.

**Linha 16412-16500 (buildComparisonRows):**
```javascript
function buildComparisonRows(metricsA, metricsB) {
    if (!metricsA || !metricsB) {
        console.error('[AB-TABLE] ❌ Métricas ausentes');
        return [];  // ← ARRAY VAZIO
    }
    
    const metricsMappings = [
        { key: 'lufs', pathA: ['technicalData', 'lufsIntegrated'], ... },
        // ...
    ];
    
    for (const mapping of metricsMappings) {
        let valueA = metricsA;
        for (const key of mapping.pathA) {
            valueA = valueA?.[key];  // Se path errado, valueA fica undefined
        }
        // ...
    }
}
```

### Consequência
Se backend enviar métricas em path diferente (ex: `metrics.lufsIntegrated` em vez de `technicalData.lufsIntegrated`):
- Loop não encontra valores
- Rows vazias
- Tabela renderiza mas sem linhas

---

## 📊 RESUMO DE CAUSAS RAIZ

| # | Causa Raiz | Sintoma | Severidade | Arquivos Afetados |
|---|------------|---------|------------|-------------------|
| 1 | Shape inconsistente de dados (bands/metrics paths) | "A/B INDISPONÍVEL" | 🔴 CRÍTICA | audio-analyzer-integration.js (linhas 97, 11860, 17092) |
| 2 | Hidratação incompleta do FirstAnalysisStore | Falha ao recuperar primeira música | 🔴 CRÍTICA | audio-analyzer-integration.js (linha 16764+) |
| 3 | Variáveis não declaradas (analysisResult, mustBeReference) | ReferenceError, modal não abre | 🟠 ALTA | audio-analyzer-integration.js (múltiplos locais) |
| 4 | stateMachine undefined (carregamento assíncrono) | Reset para modo 'genre' indevido | 🟠 ALTA | index.html (706), audio-analyzer-integration.js (7903) |
| 5 | DOM reset apaga tabela após render | Tabela construída mas não visível | 🟡 MÉDIA | audio-analyzer-integration.js (linha 22122?) |
| 6 | buildComparisonRows retorna array vazio | Tabela sem linhas | 🟡 MÉDIA | audio-analyzer-integration.js (linha 16412) |

---

## 🎯 FLUXO COMPLETO DO BUG (CASO TÍPICO)

```
┌─────────────────────────────────────────────────────────────┐
│ USUÁRIO: Seleciona "Análise de Referência A/B"             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ window.currentAnalysisMode = 'reference'                    │
│ window.userExplicitlySelectedReferenceMode = true           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ USUÁRIO: Upload Música A (base)                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ handleModalFileSelection(fileA)                             │
│ ├─ Backend retorna: { technicalData: { ... } }             │
│ ├─ FirstAnalysisStore.setRef(analysisA) ✅                  │
│ └─ window.__REFERENCE_JOB_ID__ = jobIdA ✅                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Modal fecha, usuário volta ao modal                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ USUÁRIO: Upload Música B (compare)                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ handleModalFileSelection(fileB)                             │
│ ├─ Backend retorna: { technicalData: { ... } }             │
│ └─ Detecta: isSecondTrack = true                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ renderReferenceComparisons(ctx) CHAMADO                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ const ref = FirstAnalysisStore.getRef()                     │
│ └─ Retorna: { technicalData: {...}, NO bands/metrics }     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ extractABMetrics(ref)                                       │
│ ├─ Tenta: ref.technicalData.lufsIntegrated ✅ (existe)     │
│ ├─ Tenta: ref.metrics.lufsIntegrated ❌ (undefined)        │
│ ├─ hasMinimalMetrics = true APENAS se technicalData OK     │
│ └─ return { ok: ???, debugShape: {...} }                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴────────┐
                    │                │
               ok: false        ok: true
                    │                │
                    ↓                ↓
    ┌───────────────────┐   ┌──────────────────────┐
    │ RENDERIZA ERRO    │   │ buildComparisonRows  │
    │ "A/B INDISPONÍVEL"│   │ ├─ Extrai métricas   │
    └───────────────────┘   │ ├─ Constrói 7 linhas │
                            │ └─ Retorna rows[]    │
                            └──────────────────────┘
                                        ↓
                            ┌──────────────────────┐
                            │ container.innerHTML  │
                            │ = abTableHTML ✅     │
                            └──────────────────────┘
                                        ↓
                            ┌──────────────────────┐
                            │ setTimeout 100ms     │
                            │ container.innerHTML  │
                            │ = '' ❌ (APAGA!)     │
                            └──────────────────────┘
```

---

## 🔧 GATES QUE DISPARAM ERRO

### Gate #1: extractABMetrics retorna ok:false
**Localização:** Linha 97-132  
**Condição:** `hasMinimalMetrics = false`  
**Dispara em:** Linha 11860-11902  
**Resultado:** Renderiza "COMPARAÇÃO A/B INDISPONÍVEL"

### Gate #2: buildComparisonRows retorna array vazio
**Localização:** Linha 16412  
**Condição:** `!metricsA || !metricsB` ou paths errados  
**Dispara em:** Linha 12800  
**Resultado:** Tabela sem linhas

### Gate #3: Container não existe
**Localização:** Linha 17063  
**Condição:** `ensureReferenceContainer()` retorna null  
**Resultado:** Erro renderizado em local alternativo

### Gate #4: ReferenceError em variável não declarada
**Localização:** Variável não declarada usada  
**Resultado:** Aborta completamente, modal não abre

### Gate #5: stateMachine resetando modo
**Localização:** Linha 8800+ em catch  
**Condição:** `currentAnalysisMode === 'reference'` + erro + fallback permitido  
**Resultado:** Reseta para 'genre', perde contexto da primeira música

---

## 💡 SOLUÇÃO PROPOSTA (RESUMIDA)

### 1. Criar normalizeAnalysis() ÚNICO
- Unificar todos os shapes em formato consistente
- Garantir `bands` e `metrics` no top-level
- Aplicar em TODOS os pontos de entrada

### 2. Corrigir hidratação do Store
- Quando salvar em FirstAnalysisStore, normalizar primeiro
- Garantir que `bands` existe mesmo se backend enviar `technicalData.spectral_balance`

### 3. Eliminar setTimeout que apaga container
- Localizar linha 22122
- Remover ou adicionar guard de modo

### 4. Proteger stateMachine undefined
- Criar `getSafeStateMachine()` que retorna stub funcional
- Nunca permitir reset para 'genre' se contexto reference ativo

### 5. Declarar todas as variáveis antes de usar
- Lint para encontrar ReferenceError potenciais
- Declarar no topo das funções

### 6. Proteger buildComparisonRows
- Adicionar múltiplos paths de fallback
- Nunca retornar array vazio sem log de erro claro

---

## ✅ PRÓXIMOS PASSOS

1. ✅ **AUDITORIA COMPLETA** (este documento)
2. ⏳ **IMPLEMENTAR PATCHES CIRÚRGICOS:**
   - normalizeAnalysis()
   - Hidratação corrigida
   - Remoção de setTimeout malicioso
   - Guards de stateMachine
3. ⏳ **TESTES MANUAIS:**
   - Caso 1: Upload A → Upload B → Verificar tabela visível
   - Caso 2: Modo gênero → Verificar não quebrou
   - Caso 3: Erro no reference → Verificar não reseta para genre

---

**FIM DA AUDITORIA**
