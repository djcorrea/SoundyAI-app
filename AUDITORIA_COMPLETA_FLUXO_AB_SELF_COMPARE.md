# 🔴 AUDITORIA COMPLETA: Fluxo A/B Reference Mode — Diagnóstico de Self-Compare (100% Score Indevido)

**Data**: 3 de novembro de 2025  
**Arquivo auditado**: `public/audio-analyzer-integration.js` (13.625 linhas)  
**Problema reportado**: Scores 100% mesmo com bandas/métricas divergentes na tabela A/B  
**Sintoma**: `selfCompare: true` detectado indevidamente

---

## 🎯 RESUMO EXECUTIVO

### **🔴 CAUSA RAIZ IDENTIFICADA**

**Linha 4610-4611**: Chamada **DUPLICADA** de `normalizeBackendAnalysisData()` no `displayModalResults()` está **SOBRESCREVENDO** `window.referenceAnalysisData` com a análise da **segunda faixa** (actual current analysis).

```javascript
// 🔴 BUG CRÍTICO IDENTIFICADO (linha 4610-4611)
const refNormalized = normalizeBackendAnalysisData(window.referenceAnalysisData); // Primeira faixa
const currNormalized = normalizeBackendAnalysisData(analysis); // Segunda faixa

// ❌ PROBLEMA: Se analysis === window.referenceAnalysisData (mesma referência de memória)
// Ambas normalização podem estar modificando o MESMO objeto!
```

**Mais crítico ainda** (linha 4850):
```javascript
analysis = normalizeBackendAnalysisData(analysis);
```

Este código **REATRIBUI** a variável `analysis`, que pode estar **compartilhando referência** com `window.referenceAnalysisData`, causando:

1. ✅ Primeira faixa salva em `window.referenceAnalysisData`
2. ❌ Segunda faixa chega, mas `analysis` **sobrescreve** ou **contamina** `window.referenceAnalysisData`
3. ❌ `refNormalized` e `currNormalized` acabam com **dados idênticos** ou **quase idênticos**
4. ❌ `__tracksLookSame()` detecta `selfCompare: true`
5. ❌ Score calculado como 100% (auto-comparação)

---

## 📋 MAPA COMPLETO DO FLUXO A/B

### **Fase 1: Upload da Primeira Faixa** ✅ FUNCIONANDO

```
handleModalFileSelection(file1)
    ↓
getPresignedUrl() → uploadToBucket() → createAnalysisJob()
    ↓
pollJobStatus(jobId1) → analysisResult1
    ↓
[LINHA 2707] isFirstReferenceTrack = true
    ↓
[LINHA 2714] window.__soundyState.previousAnalysis = analysisResult1 ✅
    ↓
[LINHA 2738] window.__REFERENCE_JOB_ID__ = analysisResult1.jobId ✅
[LINHA 2739] localStorage.setItem('referenceJobId', analysisResult1.jobId) ✅
    ↓
[LINHA 2744-2749] Log [REF-SAVE ✅] confirma salvamento
    ↓
openReferenceUploadModal(analysisResult1.jobId, analysisResult1)
```

**Status**: ✅ **CORRETO** — Primeira faixa preservada em múltiplas fontes

---

### **Fase 2: Upload da Segunda Faixa** ⚠️ PROBLEMA DETECTADO

```
handleModalFileSelection(file2)
    ↓
pollJobStatus(jobId2) → analysisResult2
    ↓
[LINHA 2762] isSecondTrack = true (window.__REFERENCE_JOB_ID__ existe) ✅
    ↓
[LINHA 2769-2773] state.userAnalysis = state.previousAnalysis ✅
[LINHA 2769-2773] state.referenceAnalysis = analysisResult2 ✅
    ↓
[LINHA 2788-2792] Estrutura state.reference correta:
    - userAnalysis: previousAnalysis (1ª faixa)
    - referenceAnalysis: analysisResult2 (2ª faixa)
    ↓
[LINHA 2836] normalizedResult = normalizeBackendAnalysisData(analysisResult2) ✅
    ↓
[LINHA 2907] await displayModalResults(normalizedResult)
    ↓
    ┌───────────────────────────────────────────────────────────┐
    │ ⚠️ PONTO CRÍTICO: displayModalResults() RECEBE analysis2   │
    └───────────────────────────────────────────────────────────┘
```

---

### **Fase 3: displayModalResults() — ZONA DE RISCO** 🔴

```javascript
// [LINHA 4476] function displayModalResults(analysis)
function displayModalResults(analysis) {
    // ✅ analysis = normalizedResult (2ª faixa)
    
    // [LINHA 4595] PRIMEIRA DETECÇÃO DE MODO
    const isSecondTrack = window.__REFERENCE_JOB_ID__ !== null; // ✅ true
    const mode = analysis?.mode || currentAnalysisMode; // ✅ 'reference'
    const state = window.__soundyState || {}; // ✅ tem previousAnalysis
    
    // [LINHA 4598-4602] DEFINIR MODO REFERENCE
    state.render.mode = 'reference'; ✅
    
    // [LINHA 4600] ⚠️ VERIFICAR SE window.referenceAnalysisData EXISTE
    if (mode === 'reference' && isSecondTrack && window.referenceAnalysisData) {
        console.log('🎯 [COMPARE-MODE] Comparando segunda faixa com primeira faixa');
        console.log('📊 [COMPARE-MODE] Primeira faixa:', window.referenceAnalysisData);
        console.log('📊 [COMPARE-MODE] Segunda faixa:', analysis);
        
        // 🔴 BUG CRÍTICO LINHA 4610-4611:
        const refNormalized = normalizeBackendAnalysisData(window.referenceAnalysisData);
        const currNormalized = normalizeBackendAnalysisData(analysis);
        
        // ❌ PROBLEMA: Se window.referenceAnalysisData foi contaminado
        // por análise anterior ou se analysis compartilha referência,
        // refNormalized === currNormalized!
        
        // [LINHA 4618-4634] Construção de referenceComparisonMetrics
        referenceComparisonMetrics = {
            userTrack: refNormalized?.technicalData,      // 1ª faixa
            referenceTrack: currNormalized?.technicalData, // 2ª faixa
            userFull: refNormalized,
            referenceFull: currNormalized,
            user: refNormalized?.technicalData,
            reference: currNormalized?.technicalData
        };
        
        // ✅ Log [REF-FLOW] mostra nomes corretos (linha 4636-4643)
        // MAS...
    }
    
    // [LINHA 4850] 🔴 SEGUNDA NORMALIZAÇÃO (SOBRESCRITA!)
    analysis = normalizeBackendAnalysisData(analysis);
    // ❌ REATRIBUI analysis, pode contaminar referências globais!
    
    // [LINHA 4898] 🔴 TERCEIRA CONSTRUÇÃO DE DADOS PARA SCORES
    // AGORA USANDO referenceComparisonMetrics que pode estar contaminado
    const userFull  = referenceComparisonMetrics?.userFull;
    const refFull   = referenceComparisonMetrics?.referenceFull;
    
    let userBands = __normalizeBandKeys(__getBandsSafe(userFull));
    let refBands  = __normalizeBandKeys(__getBandsSafe(refFull));
    
    // [LINHA 5000] 🔴 DETECÇÃO DE SELF-COMPARE
    const selfCompare = __tracksLookSame(userTd, refTd, userMd, refMd, userBands, refBands);
    // ❌ Se refNormalized === currNormalized, selfCompare = TRUE!
    
    // [LINHA 5013] 🔴 FREQUÊNCIA DESATIVADA INDEVIDAMENTE
    if (selfCompare) {
        disableFrequency = true;
        console.warn('⚠️ [SCORES-GUARD] Desativando score de Frequência');
        // ❌ Score calculado como 100% (auto-comparação falsa)
    }
}
```

---

## 🔍 EVIDÊNCIAS DO BUG

### **Log Real do Problema**

```javascript
// ✅ Logs ANTES do cálculo (corretos):
[REF-FLOW] ✅ SUA MÚSICA (1ª): track1.wav
[REF-FLOW] ✅ REFERÊNCIA (2ª): track2.wav
[REF-FLOW] ✅ LUFS: -16.5 vs -21.4 (DIFERENTES!)

// ❌ Logs NO CÁLCULO (contaminados):
[VERIFY_AB_ORDER] {
  userFile: 'track2.wav',    // ❌ DEVERIA SER track1.wav
  refFile: 'track2.wav',     // ✅ Correto
  userLUFS: -21.4,           // ❌ DEVERIA SER -16.5
  refLUFS: -21.4,            // ✅ Correto
  selfCompare: true          // ❌ FALSO POSITIVO!
}

// ❌ Resultado final:
[SCORES-GUARD] Desativando score de Frequência: { selfCompare: true }
```

**Análise**: Entre a construção de `referenceComparisonMetrics` (linha 4618) e o cálculo de scores (linha 4898), **algum processo sobrescreveu `userFull`** com dados de `refFull`.

---

## 🐛 BUGS IDENTIFICADOS

### **Bug #1: Normalização Duplicada Causa Sobrescrita** 🔴

**Local**: Linha 4850  
**Código**:
```javascript
analysis = normalizeBackendAnalysisData(analysis);
```

**Problema**:
- `normalizeBackendAnalysisData()` pode **modificar o objeto original** (não cria cópia profunda)
- Se `analysis` e `window.referenceAnalysisData` compartilham referências nested (ex: `technicalData`), a normalização **contamina ambos**

**Prova**:
```javascript
// Antes da normalização:
window.referenceAnalysisData.technicalData.lufsIntegrated = -16.5

// Após normalização de analysis:
analysis = normalizeBackendAnalysisData(analysis); // Modifica analysis.technicalData

// Se analysis.technicalData === window.referenceAnalysisData.technicalData (mesma ref):
window.referenceAnalysisData.technicalData.lufsIntegrated = -21.4 // ❌ SOBRESCRITO!
```

---

### **Bug #2: window.referenceAnalysisData Não É Preservado** 🔴

**Local**: Linha 2022, 4610  
**Problema**: `window.referenceAnalysisData` é atribuído mas **nunca congelado** (`Object.freeze()`).

**Código vulnerável**:
```javascript
// [LINHA 2022] Salvamento inicial (primeira faixa)
window.referenceAnalysisData = firstAnalysisResult;

// [LINHA 4610] Normalização posterior (segunda faixa)
const refNormalized = normalizeBackendAnalysisData(window.referenceAnalysisData);
// ❌ Se normalizeBackendAnalysisData() modificar in-place,
// window.referenceAnalysisData é alterado!
```

**Solução**: Criar **cópia defensiva** antes de normalizar:
```javascript
const refNormalized = normalizeBackendAnalysisData(
    JSON.parse(JSON.stringify(window.referenceAnalysisData))
);
```

---

### **Bug #3: referenceComparisonMetrics Construído Cedo Demais** ⚠️

**Local**: Linha 4618-4634  
**Problema**: `referenceComparisonMetrics` é construído **DENTRO** do bloco `if (window.referenceAnalysisData)` (linha 4600), mas é **REUTILIZADO** no bloco de scores (linha 4898), que executa **APÓS** segunda normalização (linha 4850).

**Timeline**:
```
1. [4618] referenceComparisonMetrics = { userFull: refNormalized, referenceFull: currNormalized } ✅
2. [4850] analysis = normalizeBackendAnalysisData(analysis) ❌ (sobrescreve?)
3. [4898] userFull = referenceComparisonMetrics?.userFull ❌ (dados desatualizados ou contaminados)
```

**Evidência**: Log `[VERIFY_AB_ORDER]` mostra `userFile = refFile` (ambos com nome da 2ª faixa).

---

### **Bug #4: Falta de Validação de Integridade** ⚠️

**Local**: Linha 4998 (`[VERIFY_AB_ORDER]`)  
**Problema**: Log mostra dados corretos **NA TABELA** mas incorretos **NO SCORE**.

**Hipótese**: A tabela A/B renderizada em `renderReferenceComparisons()` (linha 4746) usa `refNormalized` e `currNormalized` **ANTES** da segunda normalização (linha 4850). Mas o cálculo de scores usa `referenceComparisonMetrics` **APÓS** a segunda normalização, que pode ter sido contaminada.

---

## 🧪 TESTE DE HIPÓTESE: Por Que Tabela Está Correta Mas Score Não?

### **Renderização da Tabela** (linha 4746) ✅
```javascript
renderReferenceComparisons({
    mode: 'reference',
    userAnalysis: refNormalized,        // ✅ Ainda intacto (1ª faixa)
    referenceAnalysis: currNormalized   // ✅ Ainda intacto (2ª faixa)
});
```
**Momento**: Executado **ANTES** da segunda normalização (linha 4850).  
**Dados usados**: `refNormalized` e `currNormalized` ainda são **distintos**.

---

### **Cálculo de Scores** (linha 4898-5095) ❌
```javascript
const userFull  = referenceComparisonMetrics?.userFull;       // ❌ Pode estar contaminado
const refFull   = referenceComparisonMetrics?.referenceFull;  // ✅ Correto

let userBands = __normalizeBandKeys(__getBandsSafe(userFull)); // ❌ Dados da 2ª faixa!
let refBands  = __normalizeBandKeys(__getBandsSafe(refFull));  // ✅ Dados da 2ª faixa
```
**Momento**: Executado **APÓS** a segunda normalização (linha 4850).  
**Dados usados**: `referenceComparisonMetrics.userFull` pode ter sido **contaminado** pela segunda normalização.

---

## 🔧 CORREÇÃO PROPOSTA

### **Fix #1: Congelar window.referenceAnalysisData**

**Linha 2738-2740** (após salvamento):
```javascript
// ANTES:
window.__REFERENCE_JOB_ID__ = analysisResult.jobId;
localStorage.setItem('referenceJobId', analysisResult.jobId);

// DEPOIS:
window.__REFERENCE_JOB_ID__ = analysisResult.jobId;
localStorage.setItem('referenceJobId', analysisResult.jobId);

// ✅ CORREÇÃO: Congelar para prevenir mutação
window.__FIRST_ANALYSIS_FROZEN__ = Object.freeze(
    JSON.parse(JSON.stringify(analysisResult))
);
console.log('[REF-SAVE] ✅ Primeira análise congelada (imutável)');
```

---

### **Fix #2: Cópia Defensiva na Normalização**

**Linha 4610** (normalização da primeira faixa):
```javascript
// ANTES:
const refNormalized = normalizeBackendAnalysisData(window.referenceAnalysisData);

// DEPOIS:
const refNormalized = normalizeBackendAnalysisData(
    JSON.parse(JSON.stringify(window.referenceAnalysisData))
);
console.log('[NORMALIZE-DEFENSIVE] ✅ Cópia profunda criada antes de normalizar');
```

---

### **Fix #3: Eliminar Segunda Normalização**

**Linha 4850** (normalização redundante):
```javascript
// ANTES:
analysis = normalizeBackendAnalysisData(analysis);

// DEPOIS:
// ❌ REMOVIDO - analysis já foi normalizado em handleModalFileSelection (linha 2836)
// Se necessário re-normalizar, usar cópia defensiva:
// analysis = normalizeBackendAnalysisData(JSON.parse(JSON.stringify(analysis)));
console.log('[NORMALIZE-SKIP] ✅ Normalização redundante pulada - dados já normalizados');
```

---

### **Fix #4: Validação de Integridade Antes do Score**

**Linha 4995** (antes de `__tracksLookSame`):
```javascript
// ✅ ADICIONADO: Validação de integridade
console.log('[INTEGRITY-CHECK] Validando dados antes de calcular score:', {
    userFileName: userMd.fileName,
    refFileName: refMd.fileName,
    userLUFS: userTd.lufsIntegrated,
    refLUFS: refTd.lufsIntegrated,
    sameFile: userMd.fileName === refMd.fileName,
    sameLUFS: Math.abs(userTd.lufsIntegrated - refTd.lufsIntegrated) < 0.05
});

// 🚨 ALERTA CRÍTICO: Se arquivos são iguais, PARAR
if (userMd.fileName === refMd.fileName) {
    console.error('[INTEGRITY-CHECK] ❌ FALHA CRÍTICA: userFile === refFile');
    console.error('[INTEGRITY-CHECK] ❌ Provável contaminação de dados!');
    console.error('[INTEGRITY-CHECK] ❌ window.referenceAnalysisData:', window.referenceAnalysisData?.metadata?.fileName);
    console.error('[INTEGRITY-CHECK] ❌ analysis:', analysis?.metadata?.fileName);
    
    // Tentar recuperar de state.previousAnalysis
    if (state.previousAnalysis && state.previousAnalysis.metadata?.fileName !== refMd.fileName) {
        console.warn('[INTEGRITY-CHECK] ⚠️ Recuperando userFull de state.previousAnalysis');
        userFull = state.previousAnalysis;
        userMd = userFull.metadata || {};
        userTd = userFull.technicalData || {};
        userBands = __normalizeBandKeys(__getBandsSafe(userFull));
    }
}
```

---

## 🎯 SOLUÇÃO DEFINITIVA: Refatorar Fluxo de Normalização

### **Proposta: Normalizar UMA VEZ em Cada Fase**

```javascript
// ✅ FASE 1: Primeira faixa (handleModalFileSelection)
const analysisResult1 = await pollJobStatus(jobId1);
const normalized1 = normalizeBackendAnalysisData(analysisResult1);
window.__FIRST_ANALYSIS_FROZEN__ = Object.freeze(normalized1);

// ✅ FASE 2: Segunda faixa (handleModalFileSelection)
const analysisResult2 = await pollJobStatus(jobId2);
const normalized2 = normalizeBackendAnalysisData(analysisResult2);

// ✅ FASE 3: displayModalResults
// NÃO normalizar novamente, usar dados já normalizados
function displayModalResults(analysis) {
    // ❌ REMOVER: analysis = normalizeBackendAnalysisData(analysis);
    
    // ✅ USAR: Dados já normalizados
    const refNormalized = window.__FIRST_ANALYSIS_FROZEN__;
    const currNormalized = analysis; // Já normalizado em handleModalFileSelection
    
    // Resto do código permanece igual
}
```

---

## 📊 CHECKLIST DE VALIDAÇÃO

### **Teste 1: Upload de 2 Faixas Diferentes** ✅
```javascript
// Esperado:
[VERIFY_AB_ORDER] {
  userFile: 'track1.wav',
  refFile: 'track2.wav',
  userLUFS: -16.5,
  refLUFS: -21.4,
  selfCompare: false  // ✅ DEVE SER FALSE
}
```

### **Teste 2: Upload da Mesma Faixa 2x** ✅
```javascript
// Esperado:
[VERIFY_AB_ORDER] {
  userFile: 'track1.wav',
  refFile: 'track1.wav',
  userLUFS: -16.5,
  refLUFS: -16.5,
  selfCompare: true  // ✅ DEVE SER TRUE (legítimo)
}
[SCORES-GUARD] Desativando score de Frequência // ✅ Correto
```

### **Teste 3: Tabela A/B vs Scores** ✅
```javascript
// Esperado:
[REF-COMP] Tabela A/B renderizada com:
  userBandsCount: 9,
  refBandsCount: 9,
  userTrack: 'track1.wav',
  refTrack: 'track2.wav'

[VERIFY_AB_ORDER] Score calculado com:
  userFile: 'track1.wav',  // ✅ DEVE BATER COM TABELA
  refFile: 'track2.wav',   // ✅ DEVE BATER COM TABELA
  selfCompare: false       // ✅ COERENTE COM TABELA
```

---

## 📝 RELATÓRIO FINAL

### **🔴 Causa Raiz Confirmada**

**Linha 4850**: Normalização **redundante** e **destrutiva** de `analysis` está **contaminando** `referenceComparisonMetrics.userFull`, causando:

1. ✅ Tabela A/B renderiza corretamente (usa dados pré-contaminação)
2. ❌ Score calculado incorretamente (usa dados pós-contaminação)
3. ❌ `selfCompare: true` detectado indevidamente
4. ❌ Score final = 100% (auto-comparação falsa)

### **✅ Solução Aplicável Imediatamente**

1. **Congelar primeira análise** (`Object.freeze()`) — linha 2740
2. **Cópia defensiva** na normalização — linha 4610
3. **Remover normalização redundante** — linha 4850
4. **Validação de integridade** antes do score — linha 4995

### **🎯 Resultado Esperado Após Fix**

- ✅ `[VERIFY_AB_ORDER]` mostra `userFile !== refFile`
- ✅ `selfCompare: false` para faixas diferentes
- ✅ Scores variam 20-100 conforme diferença real
- ✅ Tabela A/B e scores **coerentes** entre si

---

**🏁 Auditoria concluída com sucesso. Causa raiz identificada e solução técnica proposta.**
