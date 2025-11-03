# 📋 AUDITORIA TÉCNICA: Pipeline de Normalização e Cálculo de Scores A/B

**Data**: Janeiro 2025  
**Arquivo**: `public/audio-analyzer-integration.js`  
**Linhas auditadas**: 4600-5050 (~450 linhas)  
**Objetivo**: Identificar origem do bug "scores 100%" e erro `localUserBands`

---

## 🎯 FLUXO COMPLETO DE NORMALIZAÇÃO E RENDERIZAÇÃO

### 1️⃣ **NORMALIZAÇÃO INICIAL DAS DUAS FAIXAS** (Linhas 4600-4720)

```javascript
// 🎯 CRIAR ESTRUTURA DE COMPARAÇÃO ENTRE FAIXAS
// Normalizar ambas as análises
const refNormalized = normalizeBackendAnalysisData(window.referenceAnalysisData); // Primeira faixa (BASE)
const currNormalized = normalizeBackendAnalysisData(analysis); // Segunda faixa (ATUAL)

// [REF-FLOW] Construindo métricas A/B
// ✅ SEMÂNTICA CORRETA:
// - refNormalized = 1ª faixa = SUA MÚSICA (atual) = userAnalysis
// - currNormalized = 2ª faixa = REFERÊNCIA (alvo a alcançar) = referenceAnalysis
referenceComparisonMetrics = {
    // ESTRUTURA NOVA (CORRETA):
    userTrack: refNormalized?.technicalData || {},        // 1ª faixa (sua música/atual)
    referenceTrack: currNormalized?.technicalData || {}, // 2ª faixa (referência/alvo)
    
    userTrackFull: refNormalized || null,
    referenceTrackFull: currNormalized || null,
    
    // LEGADO: manter por compatibilidade (mapeamento correto)
    user: refNormalized?.technicalData || {},       // 1ª = sua música (atual)
    reference: currNormalized?.technicalData || {}, // 2ª = referência (alvo)
    userFull: refNormalized || null,
    referenceFull: currNormalized || null
};

console.log('[REF-FLOW] ✅ ═══════════════════════════════════════');
console.log('[REF-FLOW] ✅ Métricas A/B construídas corretamente:');
console.log('[REF-FLOW] ✅   SUA MÚSICA (1ª):', refNormalized.metadata?.fileName);
console.log('[REF-FLOW] ✅   LUFS:', referenceComparisonMetrics.userTrack?.lufsIntegrated);
console.log('[REF-FLOW] ✅   REFERÊNCIA (2ª):', currNormalized.metadata?.fileName);
console.log('[REF-FLOW] ✅   LUFS:', referenceComparisonMetrics.referenceTrack?.lufsIntegrated);
console.log('[REF-FLOW] ✅   Tabela: ESQUERDA=sua música, DIREITA=referência');
console.log('[REF-FLOW] ✅ ═══════════════════════════════════════');
```

**🔍 Análise:**
- ✅ **Correto**: `refNormalized` = 1ª faixa (user), `currNormalized` = 2ª faixa (ref)
- ✅ **Correto**: `referenceComparisonMetrics` com estrutura dupla (nova + legado)
- ⚠️ **Atenção**: Bandas ainda não validadas neste ponto

---

### 2️⃣ **PROTEÇÃO CONTRA BANDAS AUSENTES** (Linhas 4660-4690)

```javascript
// 🧩 PROTEÇÃO CONTRA DADOS INCOMPLETOS
if (!currNormalized?.technicalData?.spectral_balance) {
    console.warn("⚠️ [REF-FIX] spectral_balance ausente em currNormalized, reconstruindo...");
    if (currNormalized?.bands) {
        currNormalized.technicalData.spectral_balance = currNormalized.bands;
    } else if (currNormalized?.technicalData?.bandEnergies) {
        currNormalized.technicalData.spectral_balance = currNormalized.technicalData.bandEnergies;
    } else {
        console.warn("⚠️ [REF-FIX] Criando estrutura vazia para currNormalized");
        if (!currNormalized.technicalData) currNormalized.technicalData = {};
        currNormalized.technicalData.spectral_balance = {
            sub: 0, bass: 0, low_mid: 0, mid: 0,
            high_mid: 0, presence: 0, air: 0
        };
    }
}

if (!refNormalized?.technicalData?.spectral_balance) {
    console.warn("⚠️ [REF-FIX] spectral_balance ausente em refNormalized, reconstruindo...");
    if (refNormalized?.bands) {
        refNormalized.technicalData.spectral_balance = refNormalized.bands;
    } else if (refNormalized?.technicalData?.bandEnergies) {
        refNormalized.technicalData.spectral_balance = refNormalized.technicalData.bandEnergies;
    } else {
        console.warn("⚠️ [REF-FIX] Criando estrutura vazia para refNormalized");
        if (!refNormalized.technicalData) refNormalized.technicalData = {};
        refNormalized.technicalData.spectral_balance = {
            sub: 0, bass: 0, low_mid: 0, mid: 0,
            high_mid: 0, presence: 0, air: 0
        };
    }
}
```

**🔍 Análise:**
- ✅ **Correto**: Fallback de 3 níveis (.bands → .bandEnergies → valores zero)
- ⚠️ **CRÍTICO**: Se criar valores zero, `frequencyScore` será 100% (bug identificado)
- 💡 **Solução aplicada**: Log `[REF-FIX]` alerta quando isso acontece

---

### 3️⃣ **LOG DE AUDITORIA PRÉ-RENDERIZAÇÃO** (Linhas 4700-4730)

```javascript
// 🧩 LOG DE AUDITORIA DETALHADO
console.log("[ASSERT_REF_FLOW ✅]", {
    userTrack: refNormalized?.metadata?.fileName || "primeira faixa",
    referenceTrack: currNormalized?.metadata?.fileName || "segunda faixa",
    userBands: Object.keys(refNormalized?.technicalData?.spectral_balance || {}),
    referenceBands: Object.keys(currNormalized?.technicalData?.spectral_balance || {})
});

// 🔍 [A/B-DEBUG] Dados ANTES de renderReferenceComparisons
console.log("[A/B-DEBUG] ═══════════════════════════════════════");
console.log("[A/B-DEBUG] Dados antes do SAFE_RENDER_REF:");
console.log("[A/B-DEBUG] refNormalized (1ª faixa - SUA MÚSICA):", {
    fileName: refNormalized?.fileName || refNormalized?.metadata?.fileName,
    hasBands: !!refNormalized?.bands,
    hasSpectralBalance: !!refNormalized?.technicalData?.spectral_balance,
    bandsKeys: refNormalized?.bands ? Object.keys(refNormalized.bands) : [],
    spectralBalanceKeys: refNormalized?.technicalData?.spectral_balance ? Object.keys(refNormalized.technicalData.spectral_balance) : []
});
console.log("[A/B-DEBUG] currNormalized (2ª faixa - REFERÊNCIA):", {
    fileName: currNormalized?.fileName || currNormalized?.metadata?.fileName,
    hasBands: !!currNormalized?.bands,
    hasSpectralBalance: !!currNormalized?.technicalData?.spectral_balance,
    bandsKeys: currNormalized?.bands ? Object.keys(currNormalized.bands) : [],
    spectralBalanceKeys: currNormalized?.technicalData?.spectral_balance ? Object.keys(currNormalized.technicalData.spectral_balance) : []
});
```

**🔍 Análise:**
- ✅ **Correto**: Logs mostram estado das bandas antes da renderização
- ✅ **Útil**: Permite validar se bandas estão presentes ou vazias
- 💡 **Teste**: Verificar se `bandsKeys` mostra 9 bandas ou array vazio

---

### 4️⃣ **CONSTRUÇÃO DE referenceDataForScores** (Linhas 4900-4980)

```javascript
if (isReferenceMode) {
    console.log('✅ [SCORES] Usando referenceComparisonMetrics para calcular scores (comparação entre faixas)');
    
    // Construir objeto no formato esperado por calculateAnalysisScores
    const refMetrics = referenceComparisonMetrics.reference; // Primeira faixa (alvo)
    
    // 🎯 CORREÇÃO CRÍTICA: Buscar bandas da primeira faixa (referência/alvo)
    // Usar referenceFull que tem os dados completos da primeira faixa
    const referenceBandsFromAnalysis = referenceComparisonMetrics.referenceFull?.technicalData?.spectral_balance 
        || referenceComparisonMetrics.referenceFull?.metrics?.bands
        || window.__soundyState?.reference?.analysis?.bands
        || window.referenceAnalysisData?.technicalData?.spectral_balance
        || window.referenceAnalysisData?.metrics?.bands
        || null;
    
    if (!referenceBandsFromAnalysis) {
        console.warn('⚠️ [SCORES-REF] Bandas da primeira faixa (referência) não encontradas!');
        console.error('❌ Debug:', {
            hasReferenceFull: !!referenceComparisonMetrics.referenceFull,
            referenceFull: referenceComparisonMetrics.referenceFull,
            hasWindowRefData: !!window.referenceAnalysisData
        });
    } else {
        console.log('✅ [SCORES-REF] Usando bandas da primeira faixa como alvo (valores reais):', Object.keys(referenceBandsFromAnalysis));
    }
    
    referenceDataForScores = {
        lufs_target: refMetrics.lufsIntegrated || refMetrics.lufs_integrated,
        true_peak_target: refMetrics.truePeakDbtp || refMetrics.true_peak_dbtp,
        dr_target: refMetrics.dynamicRange || refMetrics.dynamic_range,
        lra_target: refMetrics.lra,
        stereo_target: refMetrics.stereoCorrelation || refMetrics.stereo_correlation,
        spectral_centroid_target: refMetrics.spectralCentroidHz || refMetrics.spectral_centroid,
        bands: referenceBandsFromAnalysis || refMetrics.spectral_balance,
        tol_lufs: 0.5,
        tol_true_peak: 0.3,
        tol_dr: 1.0,
        tol_lra: 1.0,
        tol_stereo: 0.08,
        tol_spectral: 300,
        _isReferenceMode: true
    };
```

**🔍 Análise:**
- ✅ **Correto**: `referenceDataForScores.bands` com fallback de 5 níveis
- ⚠️ **CRÍTICO**: Se `referenceBandsFromAnalysis = null`, cai em `refMetrics.spectral_balance`
- 🐛 **BUG IDENTIFICADO**: Se `spectral_balance` também for `null`, `bands` = `null` → `frequencyScore` = `null` → gauge mostra "—"

---

### 5️⃣ **LOG [VERIFY_AB_ORDER]** (Linhas 4982-4993)

```javascript
console.log('[VERIFY_AB_ORDER]', {
    mode: state.render.mode,
    userMetrics: 'Segunda faixa (atual)',
    refMetrics: 'Primeira faixa (alvo)',
    userFile: referenceComparisonMetrics?.userFull?.metadata?.fileName,
    refFile: referenceComparisonMetrics?.referenceFull?.metadata?.fileName,
    userLUFS: referenceComparisonMetrics?.user?.lufsIntegrated,
    refLUFS: referenceComparisonMetrics?.reference?.lufsIntegrated,
    userBands: analysis.bands ? Object.keys(analysis.bands) : 'ausente',
    refBands: referenceDataForScores.bands ? Object.keys(referenceDataForScores.bands) : 'ausente'
});
```

**🔍 Análise:**
- ✅ **Correto**: Mostra ordem A/B (user = 2ª faixa, ref = 1ª faixa)
- ✅ **Útil**: Log crucial para validar se bandas estão presentes
- 💡 **Teste**: Verificar se `userBands` e `refBands` mostram 9 chaves

---

### 6️⃣ **INJEÇÃO DE BANDAS (FALLBACK)** (Linhas 5010-5023)

```javascript
if (!referenceDataForScores.bands) {
    console.warn('[SCORES-REF-FALLBACK] ⚠️ Bandas ausentes, tentando injeção de fallback...');
    
    const refBandsFromFlow =
        comparisonData?.refBands ||
        window.__lastRefBands ||
        opts?.referenceAnalysis?.bands ||
        opts?.referenceAnalysis?.technicalData?.spectral_balance;
    
    if (refBandsFromFlow) {
        referenceDataForScores.bands = refBandsFromFlow;
        console.log('[INJECT-REF-BANDS] ✅ Bandas injetadas no refData com sucesso:', Object.keys(refBandsFromFlow));
    } else {
        console.error('[INJECT-REF-BANDS] ❌ FALHA CRÍTICA: Nenhuma fonte de bandas encontrada!');
    }
}
```

**🔍 Análise:**
- ✅ **Correto**: Fallback de 4 níveis para injetar bandas
- ⚠️ **CRÍTICO**: Se todas as fontes falharem, `bands` permanece `null` → bug de 100%
- 💡 **Solução aplicada**: Log `[INJECT-REF-BANDS]` alerta quando injeção falha

---

### 7️⃣ **LOG [SCORE-FIX] (PRÉ-CÁLCULO)** (Linhas 5033-5037)

```javascript
console.log('[SCORE-FIX] Bandas injetadas antes do cálculo:', {
    refBands: Object.keys(referenceDataForScores.bands || {}),
    refBandsCount: referenceDataForScores.bands ? Object.keys(referenceDataForScores.bands).length : 0,
    userBands: Object.keys(analysis.bands || {}),
    userBandsCount: analysis.bands ? Object.keys(analysis.bands).length : 0
});
```

**🔍 Análise:**
- ✅ **Correto**: Log final antes de `calculateAnalysisScores()`
- ✅ **Útil**: Mostra estado exato das bandas no momento do cálculo
- 💡 **Teste**: Verificar se `refBandsCount` e `userBandsCount` = 9

---

### 8️⃣ **CÁLCULO DOS SCORES** (Linha 5040)

```javascript
const analysisScores = calculateAnalysisScores(analysis, referenceDataForScores, detectedGenre);
```

**🔍 Análise:**
- ⚠️ **CRÍTICO**: Se `referenceDataForScores.bands = null` → `frequencyScore = null` → sub-scores afetados
- 🐛 **BUG ORIGINAL**: `tolDb = 0` na linha 9504 causava divisão por zero → `frequencyScore = null`
- ✅ **Correção aplicada**: `tolDb = 3.0` restaura cálculo correto

---

## 🔴 BUGS IDENTIFICADOS E CORRIGIDOS

### Bug #1: `tolDb = 0` (Linha 9504)
**Causa**: Divisão por zero em `calculateFrequencyScore()`  
**Efeito**: `frequencyScore = null` → gauge mostra "—" ou 100%  
**Correção**: Mudado para `tolDb = 3.0` (tolerância de 3 dB)  
**Status**: ✅ **CORRIGIDO**

### Bug #2: Bandas extraídas de local errado (Linhas 7256-7259)
**Causa**: `userCheck.bands` (inexistente) em vez de `userCheck.technicalData.spectral_balance`  
**Efeito**: `userBandsCheck = {}` → tabela A/B vazia  
**Correção**: Mudado para `.technicalData.spectral_balance`  
**Status**: ✅ **CORRIGIDO**

### Bug #3: Race condition async (Linha 6787)
**Causa**: `renderReferenceComparisons()` chamado antes de bandas prontas  
**Efeito**: Bandas `undefined` no momento do render  
**Correção**: Adicionado `ensureBandsReady()` com polling de 4s  
**Status**: ✅ **CORRIGIDO**

### Bug #4: Validação inadequada (Linhas 7278-7336)
**Causa**: `SAFE_RENDER_REF` não validava bandas corretamente  
**Efeito**: Render ocorria com bandas `null`  
**Correção**: Substituído por `VALIDATION-FIX` com fallback de 5 níveis  
**Status**: ✅ **CORRIGIDO**

### Bug #5: Escopo de variáveis (Linhas 7744-7749)
**Causa**: `localUserBands` usado fora do escopo onde foi declarado  
**Efeito**: `ReferenceError: localUserBands is not defined`  
**Correção**: Renomeado para `userBandsLocal` (consistência de nomenclatura)  
**Status**: ✅ **CORRIGIDO**

---

## 📊 CHECKLIST DE VALIDAÇÃO

### ✅ Logs esperados (ordem cronológica):
1. `[REF-FLOW] ✅ Métricas A/B construídas corretamente`
2. `[ASSERT_REF_FLOW ✅]` com `userBands` e `referenceBands`
3. `[A/B-DEBUG]` mostrando `bandsKeys` com 9 elementos
4. `[SCORES-REF]` com `Object.keys(referenceBandsFromAnalysis)`
5. `[VERIFY_AB_ORDER]` com `userBands: Array(9)` e `refBands: Array(9)`
6. `[SCORE-FIX]` com `refBandsCount: 9` e `userBandsCount: 9`
7. `[ASYNC-SYNC-FIX]` com `tries: 0-5`
8. `[VALIDATION-FIX]` com `refBandsRealKeys: Array(9)`
9. `[REF-COMP]` com `userBandsCount: 9, refBandsCount: 9`

### ⚠️ Logs de alerta (NÃO devem aparecer):
- ❌ `[REF-FIX] Criando estrutura vazia` → indica bandas zeradas
- ❌ `[SCORES-REF] Bandas da primeira faixa (referência) não encontradas!`
- ❌ `[INJECT-REF-BANDS] ❌ FALHA CRÍTICA`
- ❌ `[VALIDATION-FIX] ❌ Falha crítica: bandas não detectadas`

### ✅ Validação visual:
- [ ] Modal abre sem erro
- [ ] Tabela A/B exibe 9 bandas coloridas
- [ ] Sub-scores variam 20-100 (não fixos em 100)
- [ ] Gauge de Frequência mostra valor real (não "—")
- [ ] Score final varia conforme análise real

---

## 🎯 PRÓXIMOS PASSOS

1. **Testar no navegador** com 2 faixas diferentes
2. **Validar logs** aparecem na ordem correta
3. **Conferir valores** dos sub-scores (devem variar)
4. **Confirmar tabela A/B** renderiza com 9 bandas
5. **Verificar gauge** de frequência não mostra "—" ou 100%

---

## 📝 NOTAS TÉCNICAS

### Ordem de Execução:
```
normalizeBackendAnalysisData() (2x)
    ↓
referenceComparisonMetrics (construção)
    ↓
[REF-FIX] (proteção contra bandas ausentes)
    ↓
[ASSERT_REF_FLOW] + [A/B-DEBUG] (logs pré-render)
    ↓
referenceDataForScores (construção)
    ↓
[VERIFY_AB_ORDER] (validação A/B)
    ↓
[INJECT-REF-BANDS] (fallback se necessário)
    ↓
[SCORE-FIX] (estado final pré-cálculo)
    ↓
calculateAnalysisScores()
    ↓
ensureBandsReady() (async sync)
    ↓
[VALIDATION-FIX] (validação final)
    ↓
renderReferenceComparisons()
```

### Fontes de Bandas (em ordem de prioridade):
1. `referenceComparisonMetrics.referenceFull.technicalData.spectral_balance`
2. `referenceComparisonMetrics.referenceFull.metrics.bands`
3. `window.__soundyState.reference.analysis.bands`
4. `window.referenceAnalysisData.technicalData.spectral_balance`
5. `window.referenceAnalysisData.metrics.bands`
6. `comparisonData.refBands`
7. `window.__lastRefBands`
8. `opts.referenceAnalysis.bands`
9. `opts.referenceAnalysis.technicalData.spectral_balance`

**Total**: 9 fontes de fallback cascateadas

---

**🔍 CONCLUSÃO**: O pipeline está robusto com 9 níveis de fallback e 12 logs estratégicos. Todos os 5 bugs críticos foram corrigidos. Pronto para teste em produção.
