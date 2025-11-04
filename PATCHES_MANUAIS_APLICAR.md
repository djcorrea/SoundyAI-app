# 🔧 PATCHES MANUAIS PARA APLICAR

**Status atual**: 
- ✅ PATCH 1 aplicado (commit a5e1e9b) - enforceABWiring antes de renderReferenceComparisons
- ⏳ PATCH 2 pendente - refHardGuards no início de renderReferenceComparisons  
- ⏳ PATCH 3 pendente - normalizeBackendAnalysisDataSafe wrapper
- ⏳ PATCH 4 pendente - const→let + recovery logic

---

## ⚠️ IMPORTANTE

O arquivo `audio-analyzer-integration.js` tem **14.297 linhas**. Os patches precisam ser aplicados manualmente em locais muito específicos. Siga as instruções abaixo **COM CUIDADO**.

---

## 📝 PATCH 2: refHardGuards no início de renderReferenceComparisons

**Local**: Logo após `function renderReferenceComparisons(opts = {}) {`  
**Linha aproximada**: ~7866

### Como aplicar:

1. Abra `public/audio-analyzer-integration.js`
2. Procure por: `function renderReferenceComparisons(opts = {}) {`
3. **IMEDIATAMENTE APÓS** a abertura da função (logo após o `{`), adicione:

```javascript
// ==== PATCH 2: REF-PATCH: guardas duras no início da render A/B ====
(function refHardGuards(){
  const s = window.__soundyState || {};
  const globalRef = window.referenceAnalysisData || s.referenceAnalysis || null;
  opts = opts || {};
  if (!opts.userAnalysis && analysis?.userAnalysis) opts.userAnalysis = analysis.userAnalysis;
  if (!opts.referenceAnalysis && analysis?.referenceAnalysis) opts.referenceAnalysis = analysis.referenceAnalysis;
  if (!opts.referenceAnalysis && globalRef) {
    console.warn("[REF-PATCH] Reinjetando referência a partir do global (opts vazio)");
    opts.referenceAnalysis = deepCloneSafe(globalRef);
  }
  if (!opts.userAnalysis || !opts.referenceAnalysis) {
    console.error("[REF-PATCH] Faltam dados para A/B", {
      hasUser: !!opts.userAnalysis, hasRef: !!opts.referenceAnalysis, mode: analysis?.mode
    });
    throw new Error("Missing user/reference analysis for A/B");
  }
  const uName = opts.userAnalysis?.metadata?.fileName || opts.userAnalysis?.fileName;
  const rName = opts.referenceAnalysis?.metadata?.fileName || opts.referenceAnalysis?.fileName;
  if (uName && rName && uName === rName) {
    if (globalRef && (globalRef?.metadata?.fileName || globalRef?.fileName) !== uName) {
      console.warn("[REF-PATCH] Substituindo referência por global para evitar self-compare");
      opts.referenceAnalysis = deepCloneSafe(globalRef);
    } else {
      console.error("[REF-PATCH] Self-compare não resolvido — abortando A/B");
      throw new Error("Self-compare detected");
    }
  }
  opts.usedReferenceAnalysis = true;
  if (window.__refRenderInProgress) {
    console.warn("[REF-PATCH] Render A/B em progresso — ignorando chamada duplicada");
    return;
  }
  window.__refRenderInProgress = true;
})();
```

4. **NO FINAL** da função (antes do último `}`), adicione:

```javascript
// Sanidade final
if (opts.usedReferenceAnalysis !== true) {
  console.error("[REF-PATCH] usedReferenceAnalysis caiu para false — isso mascara bug");
  throw new Error("Reference not used");
}
window.__refRenderInProgress = false;
```

---

## 📝 PATCH 3: normalizeBackendAnalysisDataSafe (wrapper defensivo)

### Parte A: Criar a função wrapper

**Local**: Logo ANTES da primeira chamada de `normalizeBackendAnalysisData`  
**Linha aproximada**: Antes de 4600

Adicione esta função:

```javascript
// ==== PATCH 3: Wrapper defensivo para normalizeBackendAnalysisData ====
function normalizeBackendAnalysisDataSafe(input) {
  if (!input) return null;
  return normalizeBackendAnalysisData(deepCloneSafe(input));
}
```

### Parte B: Comentar linha 4850 (normalização redundante)

**Local**: Dentro de `displayModalResults`, após criação de referenceComparisonMetrics  
**Linha aproximada**: ~4850

Procure por:
```javascript
analysis = normalizeBackendAnalysisData(analysis);
```

**COMENTE** essa linha e adicione log:
```javascript
// ❌ PATCH 3: Normalização redundante REMOVIDA para evitar contaminação
// analysis = normalizeBackendAnalysisData(analysis);
console.log('[NORMALIZE-SKIP] ✅ Redundant normalization removed per AUDIT');
```

---

## 📝 PATCH 4: Recuperação de contaminação (const → let)

**Local**: Dentro do bloco de cálculo de scores  
**Linha aproximada**: ~4998

### Passo 1: Mudar `const` para `let`

Procure por:
```javascript
let userFull  = referenceComparisonMetrics?.userFull;
let refFull   = referenceComparisonMetrics?.referenceFull;
```

**Confirme que já está como `let`** (você pode ter feito isso em commit anterior).  
Se ainda for `const`, mude para `let`.

### Passo 2: Adicionar lógica de recuperação

Logo APÓS a definição de `userFull` e `refFull`, adicione:

```javascript
// ==== PATCH 4: Recuperação de contaminação ====
if (userMd.fileName === refMd.fileName && state.previousAnalysis) {
    console.error('[INTEGRITY-CHECK] ❌ FALHA CRÍTICA: userFile === refFile');
    console.error('[INTEGRITY-CHECK] ❌ Provável contaminação de dados!');
    console.error('[INTEGRITY-CHECK] ❌ Tentando recuperar de state.previousAnalysis...');
    
    if (state.previousAnalysis.metadata?.fileName !== refMd.fileName) {
        console.warn('[INTEGRITY-CHECK] ⚠️ Recuperando userFull de state.previousAnalysis');
        userFull = state.previousAnalysis;
        userMd = userFull.metadata || {};
        userTd = userFull.technicalData || {};
        userBands = __normalizeBandKeys(__getBandsSafe(userFull));
        
        console.log('[INTEGRITY-CHECK] ✅ Dados recuperados:', {
            fileName: userMd.fileName,
            lufs: userTd.lufsIntegrated
        });
    }
}
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

Após aplicar todos os patches:

- [ ] PATCH 2: `refHardGuards()` no início de `renderReferenceComparisons`
- [ ] PATCH 2: Sanidade final no fim de `renderReferenceComparisons`
- [ ] PATCH 3: Função `normalizeBackendAnalysisDataSafe()` criada
- [ ] PATCH 3: Linha 4850 comentada (redundant normalization)
- [ ] PATCH 4: `userFull`/`refFull` como `let` (não `const`)
- [ ] PATCH 4: Lógica de recuperação adicionada após definição de `userFull`

---

## 🚀 APÓS APLICAR OS PATCHES

1. **Salvar arquivo**
2. **Commitar**:
   ```bash
   git add public/audio-analyzer-integration.js
   git commit -m "fix(audit): Apply PATCH 2-4 manually - refHardGuards + normalizeBackendAnalysisDataSafe + recovery logic"
   ```
3. **Push para Railway**:
   ```bash
   git push origin restart
   ```
4. **Aguardar deploy** (2-3 minutos)
5. **Testar com F12 aberto**:
   - Upload primeira faixa
   - Upload SEGUNDA faixa DIFERENTE
   - Verificar logs `[REF-PATCH]`
   - Confirmar `selfCompare: false`
   - Confirmar scores diferentes de 100%

---

## 📊 LOGS ESPERADOS APÓS OS PATCHES

```javascript
[REF-PATCH] Sem userSrc/refSrc para A/B: false
[REF-PATCH] Self-compare detectado: false
✅ analysis.userAnalysis frozen
✅ analysis.referenceAnalysis frozen
[NORMALIZE-SKIP] ✅ Redundant normalization removed per AUDIT
[VERIFY_AB_ORDER] {
  userFile: 'primeira.wav',  ✅ DIFERENTE
  refFile: 'segunda.wav',    ✅ DIFERENTE
  selfCompare: false         ✅ CORRETO!
}
[INTEGRITY-CHECK] ✅ Validação passou - window.__FIRST_ANALYSIS_FROZEN__ existe e é diferente de analysis
```

---

## ⚠️ SE DER ERRO

Se após aplicar os patches der erro de:
- `deepCloneSafe is not defined`
- `__normalizeBandKeys is not defined`
- `__getBandsSafe is not defined`

**Significa que essas funções não existem no arquivo**. Nesse caso:

1. Me avise qual erro aparece
2. Podemos criar essas funções ou usar alternativas

---

**🎯 Próximo passo**: Aplicar os patches manualmente seguindo as instruções acima, depois commitar e testar!
