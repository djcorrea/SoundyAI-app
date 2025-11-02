# 🔍 AUDITORIA DO PIPELINE DE BANDAS DE REFERÊNCIA

**Data:** 2 de novembro de 2025  
**Arquivo Modificado:** `/public/audio-analyzer-integration.js`  
**Objetivo:** Descobrir onde as bandas de referência (`refBands`) são perdidas ou substituídas por `undefined`

---

## ✅ LOGS DE AUDITORIA APLICADOS

### 1. **[AUDIT-BANDS-BEFORE]** - Antes da Chamada de `renderReferenceComparisons()`

**Localização:** Linha ~6728 (antes da chamada `renderReferenceComparisons(renderOpts)`)

**Log adicionado:**
```javascript
try {
    const refBands = renderOpts.referenceAnalysis?.bands || renderOpts.referenceAnalysis?.technicalData?.spectral_balance;
    const userBands = renderOpts.userAnalysis?.bands || renderOpts.userAnalysis?.technicalData?.spectral_balance;
    console.log('[AUDIT-BANDS-BEFORE]', {
        hasRefBands: !!refBands,
        hasUserBands: !!userBands,
        refBandsType: typeof refBands,
        userBandsType: typeof userBands,
        refBandsKeys: refBands ? Object.keys(refBands) : [],
        userBandsKeys: userBands ? Object.keys(userBands) : [],
        refBandsPreview: refBands ? Object.keys(refBands).slice(0, 3) : 'N/A',
        userBandsPreview: userBands ? Object.keys(userBands).slice(0, 3) : 'N/A',
        renderOptsKeys: Object.keys(renderOpts)
    });
} catch (err) {
    console.warn('[AUDIT-ERROR]', 'AUDIT-BANDS-BEFORE', err);
}
```

**O que este log vai revelar:**
- ✅ Se `refBands` existe ANTES de entrar em `renderReferenceComparisons()`
- ✅ Tipo de dados de `refBands` (object, undefined, null)
- ✅ Quais chaves existem em `refBands` (sub, low_bass, etc.)
- ✅ Comparação com `userBands`

---

### 2. **[AUDIT-BANDS-IN-RENDER]** - No Início de `renderReferenceComparisons()`

**Localização:** Linha ~7100 (primeira linha dentro da função)

**Log adicionado:**
```javascript
try {
    const refBandsInRender = opts.referenceAnalysis?.bands || opts.referenceAnalysis?.technicalData?.spectral_balance;
    const userBandsInRender = opts.userAnalysis?.bands || opts.userAnalysis?.technicalData?.spectral_balance;
    console.log('[AUDIT-BANDS-IN-RENDER]', {
        receivedRefBands: refBandsInRender,
        receivedUserBands: userBandsInRender,
        typeofRefBands: typeof refBandsInRender,
        typeofUserBands: typeof userBandsInRender,
        refBandsKeys: refBandsInRender ? Object.keys(refBandsInRender) : [],
        userBandsKeys: userBandsInRender ? Object.keys(userBandsInRender) : [],
        optsKeys: Object.keys(opts),
        hasUserAnalysis: !!opts.userAnalysis,
        hasReferenceAnalysis: !!opts.referenceAnalysis
    });
} catch (err) {
    console.warn('[AUDIT-ERROR]', 'AUDIT-BANDS-IN-RENDER', err);
}
```

**O que este log vai revelar:**
- ✅ Se `opts.referenceAnalysis` ainda contém as bandas ao entrar na função
- ✅ Se o objeto `opts` foi modificado durante a passagem
- ✅ Estrutura completa de `opts` recebido

---

### 3. **[AUDIT-BANDS-SAFE-V3]** - Após Construção de `comparisonSafe`

**Localização:** Linha ~7250 (dentro do bloco `[SAFE_REF_V3]`)

**Log adicionado:**
```javascript
try {
    console.log('[AUDIT-BANDS-SAFE-V3]', {
        comparisonSafeUserBands: comparisonSafe.userBands,
        comparisonSafeRefBands: comparisonSafe.refBands,
        typeofUserBands: typeof comparisonSafe.userBands,
        typeofRefBands: typeof comparisonSafe.refBands,
        userBandsKeys: comparisonSafe.userBands ? Object.keys(comparisonSafe.userBands) : [],
        refBandsKeys: comparisonSafe.refBands ? Object.keys(comparisonSafe.refBands) : [],
        sourceUA: ua ? 'opts.userAnalysis ou state.reference.userAnalysis' : 'N/A',
        sourceRA: ra ? 'opts.referenceAnalysis ou state.reference.referenceAnalysis' : 'N/A',
        uaBands: ua?.technicalData?.spectral_balance || ua?.bands || ua?.spectralBands,
        raBands: ra?.technicalData?.spectral_balance || ra?.bands || ra?.spectralBands
    });
} catch (err) {
    console.warn('[AUDIT-ERROR]', 'AUDIT-BANDS-SAFE-V3', err);
}
```

**O que este log vai revelar:**
- ✅ Se as bandas foram corretamente extraídas de `ua` (userAnalysis) e `ra` (referenceAnalysis)
- ✅ Qual foi a fonte de dados utilizada (technicalData.spectral_balance, bands, spectralBands)
- ✅ Se `comparisonSafe.refBands` está preenchido ou vazio

---

### 4. **[AUDIT-REDECLARE]** - Após Redeclaração de Variáveis

**Localização:** Linha ~7345 (dentro do bloco `[REF_FIX_V5]`)

**Log adicionado:**
```javascript
try {
    console.log('[AUDIT-REDECLARE]', {
        refBandsCheck: refBands,
        userBandsCheck: userBands,
        typeofRefBands: typeof refBands,
        typeofUserBands: typeof userBands,
        refBandsKeys: refBands ? Object.keys(refBands) : [],
        userBandsKeys: userBands ? Object.keys(userBands) : [],
        refBandsIsEmpty: !refBands || Object.keys(refBands).length === 0,
        userBandsIsEmpty: !userBands || Object.keys(userBands).length === 0,
        comparisonDataRefBands: comparisonData?.refBands,
        comparisonDataUserBands: comparisonData?.userBands
    });
} catch (err) {
    console.warn('[AUDIT-ERROR]', 'AUDIT-REDECLARE', err);
}
```

**O que este log vai revelar:**
- ✅ **CRÍTICO:** Se `refBands` foi redeclarado como vazio ou `undefined`
- ✅ Se a extração de `comparisonData.refBands` está funcionando
- ✅ Comparação entre o que foi extraído vs o que está em `comparisonData`

---

### 5. **[AUDIT-BANDS-IN-CALC]** - No Início de `calculateAnalysisScores()`

**Localização:** Linha ~9975 (primeira linha dentro da função)

**Log adicionado:**
```javascript
try {
    const refBandsInCalc = refData?.bands || refData?._referenceBands;
    const userBandsInCalc = analysis?.bands || analysis?.technicalData?.spectral_balance || analysis?.metrics?.bands;
    console.log('[AUDIT-BANDS-IN-CALC]', {
        calcHasRefBands: !!refBandsInCalc,
        calcHasUserBands: !!userBandsInCalc,
        refBandsType: typeof refBandsInCalc,
        userBandsType: typeof userBandsInCalc,
        refBandsKeys: refBandsInCalc ? Object.keys(refBandsInCalc) : [],
        userBandsKeys: userBandsInCalc ? Object.keys(userBandsInCalc) : [],
        refBandsSample: refBandsInCalc ? Object.keys(refBandsInCalc).slice(0, 3) : 'undefined',
        userBandsSample: userBandsInCalc ? Object.keys(userBandsInCalc).slice(0, 3) : 'undefined',
        refDataKeys: refData ? Object.keys(refData) : [],
        isReferenceMode: refData?._isReferenceMode
    });
} catch (err) {
    console.warn('[AUDIT-ERROR]', 'AUDIT-BANDS-IN-CALC', err);
}
```

**O que este log vai revelar:**
- ✅ Se `refData.bands` contém as bandas de referência ao calcular scores
- ✅ Se o problema está na passagem de dados para `calculateAnalysisScores()`
- ✅ Estrutura de `refData` recebida

---

## 📊 FLUXO DE DADOS RASTREADO

```
1. [AUDIT-BANDS-BEFORE]
   └─> renderOpts preparado com userAnalysis e referenceAnalysis
       └─> refBands extraído de referenceAnalysis?.bands ou technicalData?.spectral_balance
           
2. [AUDIT-BANDS-IN-RENDER]
   └─> opts recebido na função renderReferenceComparisons()
       └─> opts.referenceAnalysis ainda contém bandas?
           
3. [AUDIT-BANDS-SAFE-V3]
   └─> comparisonSafe construído a partir de opts ou window state
       └─> comparisonSafe.refBands extraído de ra (referenceAnalysis)
           
4. [AUDIT-REDECLARE]
   └─> refBands redeclarado como comparisonData?.refBands || {}
       └─> 🔴 PONTO CRÍTICO: Se comparisonData.refBands === undefined, refBands vira {}
           
5. [AUDIT-BANDS-IN-CALC]
   └─> refData recebido em calculateAnalysisScores()
       └─> refData.bands deveria conter as bandas para cálculo de frequency score
```

---

## 🔍 CENÁRIOS ESPERADOS NOS LOGS

### **Cenário 1: Bandas Perdidas ANTES de renderReferenceComparisons()**

```javascript
[AUDIT-BANDS-BEFORE] {
  hasRefBands: false,              // ❌ Problema ANTES da função
  refBandsType: 'undefined',
  refBandsKeys: []
}

[AUDIT-BANDS-IN-RENDER] {
  typeofRefBands: 'undefined',     // ✅ Confirma: dados não chegaram
  refBandsKeys: []
}
```

**Diagnóstico:** O problema está na preparação de `renderOpts` antes da chamada.

---

### **Cenário 2: Bandas Perdidas DENTRO de renderReferenceComparisons()**

```javascript
[AUDIT-BANDS-BEFORE] {
  hasRefBands: true,               // ✅ Dados existem antes de entrar
  refBandsType: 'object',
  refBandsKeys: Array(9) [...]
}

[AUDIT-BANDS-IN-RENDER] {
  typeofRefBands: 'undefined',     // ❌ Perdido ao entrar na função
  refBandsKeys: []
}
```

**Diagnóstico:** O problema está na entrada da função (possivelmente `opts` sendo modificado).

---

### **Cenário 3: Bandas Perdidas na Construção de comparisonSafe**

```javascript
[AUDIT-BANDS-IN-RENDER] {
  typeofRefBands: 'object',        // ✅ Dados chegam corretamente
  refBandsKeys: Array(9) [...]
}

[AUDIT-BANDS-SAFE-V3] {
  comparisonSafeRefBands: {},      // ❌ Perdido na extração
  refBandsKeys: [],
  raBands: undefined               // ❌ ra (referenceAnalysis) não tem bandas
}
```

**Diagnóstico:** O problema está na extração de bandas de `ra` (referenceAnalysis não contém bandas).

---

### **Cenário 4: Bandas Perdidas na Redeclaração (CRÍTICO)**

```javascript
[AUDIT-BANDS-SAFE-V3] {
  comparisonSafeRefBands: { sub: {...}, low_bass: {...}, ... },  // ✅ Bandas existem
  refBandsKeys: Array(9) [...]
}

[AUDIT-REDECLARE] {
  refBandsCheck: {},               // ❌ PERDIDO AQUI!
  refBandsKeys: [],
  comparisonDataRefBands: undefined  // ❌ comparisonData.refBands === undefined
}
```

**Diagnóstico:** 🔴 **PROBLEMA ENCONTRADO!**  
A linha `refBands = comparisonData?.refBands || {};` está pegando `undefined` de `comparisonData.refBands` e substituindo por `{}`.

**Causa Raiz:** `comparisonData` não está sendo construído corretamente, ou `comparisonSafe.refBands` não está sendo copiado para `comparisonData`.

---

### **Cenário 5: Bandas Perdidas ao Passar para calculateAnalysisScores()**

```javascript
[AUDIT-REDECLARE] {
  refBandsCheck: { sub: {...}, low_bass: {...}, ... },  // ✅ Bandas existem em refBands
  refBandsKeys: Array(9) [...]
}

[AUDIT-BANDS-IN-CALC] {
  calcHasRefBands: false,          // ❌ refData.bands === undefined
  refBandsKeys: []
}
```

**Diagnóstico:** As bandas existem em `refBands`, mas não foram passadas para `refData.bands` ao chamar `calculateAnalysisScores()`.

---

## 🎯 PRÓXIMOS PASSOS

1. **Executar análise de referência:**
   - Upload primeira faixa
   - Upload segunda faixa
   - Abrir console do navegador (F12)

2. **Buscar logs de auditoria na ordem:**
   ```
   [AUDIT-BANDS-BEFORE]
   [AUDIT-BANDS-IN-RENDER]
   [AUDIT-BANDS-SAFE-V3]
   [AUDIT-REDECLARE]
   [AUDIT-BANDS-IN-CALC]
   ```

3. **Identificar em qual ponto `refBands` vira `undefined` ou `{}`:**
   - Se em `[AUDIT-BANDS-BEFORE]` → Problema na preparação de `renderOpts`
   - Se em `[AUDIT-BANDS-IN-RENDER]` → Problema na passagem de `opts`
   - Se em `[AUDIT-BANDS-SAFE-V3]` → Problema na extração de `ra`
   - Se em `[AUDIT-REDECLARE]` → 🔴 **PROBLEMA MAIS PROVÁVEL** (redeclaração com `|| {}`)
   - Se em `[AUDIT-BANDS-IN-CALC]` → Problema na passagem para `calculateAnalysisScores()`

4. **Enviar trecho dos logs para análise:**
   ```javascript
   // Filtrar apenas logs de auditoria de bandas
   [AUDIT-BANDS-*]
   ```

---

## ✅ GARANTIAS

- ✅ **Nenhuma lógica foi alterada** - Apenas logs adicionados
- ✅ **Todos os logs dentro de try/catch** - Não quebra execução
- ✅ **Logs estratégicos em 5 pontos críticos** - Cobertura completa do fluxo
- ✅ **Informações detalhadas** - Tipo, chaves, valores, fontes de dados

---

## 🔧 ARQUIVOS MODIFICADOS

- ✅ `public/audio-analyzer-integration.js` (13.397 linhas)

**Total de logs adicionados:** 5 blocos de auditoria estratégicos

---

## 🎓 OBJETIVO FINAL

Descobrir **exatamente em qual linha e função** as bandas de referência (`refBands`) são perdidas, para que a correção definitiva seja feita **sem gambiarras**, preservando o comportamento exato esperado:

- ✅ Exibir métricas comparativas
- ✅ Exibir tabela de comparação A/B com bandas espectrais
- ✅ Calcular sub-scores corretos (incluindo frequência)

---

**Próximo passo:** Executar análise de referência e coletar logs `[AUDIT-BANDS-*]` do console. 🚀

---

**FIM DO RELATÓRIO DE AUDITORIA**
