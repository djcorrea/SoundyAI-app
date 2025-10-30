# 🧪 GUIA DE TESTES E VERIFICAÇÃO DO PIPELINE PDF

## 📋 OBJETIVO

Este guia mostra **como testar manualmente** o pipeline de relatórios PDF e verificar se os dados estão sendo puxados corretamente.

---

## 🎯 TESTE 1: VERIFICAR OBJETO GLOBAL

### **Console do Navegador:**

```javascript
// 1. Verificar se o objeto global existe
console.log('Análise global:', window.__soundyAI?.analysis);

// 2. Verificar estrutura completa
console.log('Chaves disponíveis:', Object.keys(window.__soundyAI?.analysis || {}));

// 3. Verificar modo (gênero vs referência)
const analysis = window.__soundyAI?.analysis;
console.log('Modo:', analysis?.mode || 'GÊNERO (single)');

// 4. Verificar se é modo referência
if (analysis?.mode === 'reference' || (analysis?.user && analysis?.reference)) {
    console.log('✅ MODO REFERÊNCIA DETECTADO');
    console.log('Score do usuário:', analysis.user?.score);
    console.log('Score da referência:', analysis.reference?.score);
} else {
    console.log('✅ MODO GÊNERO DETECTADO');
    console.log('Score:', analysis?.score);
}
```

**Resultado esperado:**
```
Análise global: { score: 95, fileName: "audio.wav", ... }
Chaves disponíveis: ["score", "classification", "fileName", "bands", "suggestions", ...]
Modo: GÊNERO (single)
✅ MODO GÊNERO DETECTADO
Score: 95
```

---

## 🎯 TESTE 2: VERIFICAR BANDAS ESPECTRAIS

### **Console do Navegador:**

```javascript
const analysis = window.__soundyAI?.analysis;

// 1. Verificar todas as fontes possíveis de bandas
console.log('=== AUDITORIA DE BANDAS ===');
console.log('analysis.bands:', analysis?.bands);
console.log('analysis.spectralBands:', analysis?.spectralBands);
console.log('analysis.spectral?.bands:', analysis?.spectral?.bands);

// 2. Verificar estrutura detalhada
if (analysis?.bands) {
    console.log('✅ analysis.bands existe!');
    console.log('Chaves:', Object.keys(analysis.bands));
    console.log('Sub:', analysis.bands.sub);
    console.log('Bass:', analysis.bands.bass);
    console.log('Mid:', analysis.bands.mid);
    console.log('High:', analysis.bands.high);
} else if (analysis?.spectralBands) {
    console.log('✅ analysis.spectralBands existe!');
    console.log('Chaves:', Object.keys(analysis.spectralBands));
} else {
    console.warn('🚨 PROBLEMA: Nenhuma fonte de bandas encontrada!');
    console.warn('PDF mostrará "—" em todas as bandas');
}

// 3. Verificar valores numéricos
const bands = analysis?.bands || analysis?.spectralBands || {};
['sub', 'bass', 'mid', 'high'].forEach(band => {
    const value = bands[band]?.rms_db ?? bands[band];
    console.log(`${band}:`, Number.isFinite(value) ? value : 'NULL');
});
```

**Resultado esperado (SE OK):**
```
=== AUDITORIA DE BANDAS ===
analysis.bands: { sub: {...}, bass: {...}, mid: {...}, high: {...} }
✅ analysis.bands existe!
Chaves: ["sub", "bass", "mid", "high"]
Sub: { rms_db: -20.1 }
Bass: { rms_db: -18.5 }
Mid: { rms_db: -16.2 }
High: { rms_db: -19.8 }
sub: -20.1
bass: -18.5
mid: -16.2
high: -19.8
```

**Resultado esperado (SE PROBLEMA):**
```
=== AUDITORIA DE BANDAS ===
analysis.bands: undefined
analysis.spectralBands: undefined
analysis.spectral?.bands: undefined
🚨 PROBLEMA: Nenhuma fonte de bandas encontrada!
PDF mostrará "—" em todas as bandas
sub: NULL
bass: NULL
mid: NULL
high: NULL
```

---

## 🎯 TESTE 3: VERIFICAR SUGESTÕES E ENRIQUECIMENTO

### **Console do Navegador:**

```javascript
const analysis = window.__soundyAI?.analysis;

// 1. Verificar se sugestões existem
console.log('=== AUDITORIA DE SUGESTÕES ===');
console.log('analysis.suggestions:', analysis?.suggestions);
console.log('Count:', analysis?.suggestions?.length || 0);

// 2. Verificar se foram enriquecidas
if (analysis?._suggestionsGenerated === true) {
    console.log('✅ Sugestões foram ENRICHED!');
} else if (analysis?._suggestionsGenerated === false) {
    console.warn('⚠️ Sugestões NÃO foram enriched!');
    console.warn('PDF mostrará sugestões GENÉRICAS');
} else {
    console.warn('⚠️ Flag _suggestionsGenerated AUSENTE');
    console.warn('Status de enriquecimento DESCONHECIDO');
}

// 3. Verificar estrutura das sugestões
if (analysis?.suggestions?.length > 0) {
    console.log('Primeira sugestão:', analysis.suggestions[0]);
    console.log('Estrutura:', {
        message: analysis.suggestions[0].message || '(não existe)',
        action: analysis.suggestions[0].action || '(não existe)',
        priority: analysis.suggestions[0].priority || '(não existe)',
        stringDireta: typeof analysis.suggestions[0] === 'string'
    });
}

// 4. Verificar se SuggestionTextGenerator está disponível
console.log('SuggestionTextGenerator carregado?', !!window.SuggestionTextGenerator);
```

**Resultado esperado (SE OK):**
```
=== AUDITORIA DE SUGESTÕES ===
analysis.suggestions: [{ message: "...", action: "...", priority: "high" }, ...]
Count: 7
✅ Sugestões foram ENRICHED!
Primeira sugestão: { message: "Adicionar boost em sub-bass", action: "...", priority: "high" }
Estrutura: { message: "...", action: "...", priority: "high", stringDireta: false }
SuggestionTextGenerator carregado? true
```

**Resultado esperado (SE PROBLEMA):**
```
=== AUDITORIA DE SUGESTÕES ===
analysis.suggestions: ["Ajustar loudness", "Verificar true peak", ...]
Count: 5
⚠️ Flag _suggestionsGenerated AUSENTE
Status de enriquecimento DESCONHECIDO
Primeira sugestão: "Ajustar loudness"
Estrutura: { message: "(não existe)", action: "(não existe)", priority: "(não existe)", stringDireta: true }
SuggestionTextGenerator carregado? false
```

---

## 🎯 TESTE 4: VERIFICAR DIVERGÊNCIAS UI vs OBJETO GLOBAL

### **Console do Navegador:**

```javascript
const analysis = window.__soundyAI?.analysis;

// 1. Score
const scoreUI = document.querySelector('.score-final-value')?.dataset?.value || 
                document.querySelector('.score-final-value')?.textContent;
const scorePDF = analysis?.score;
console.log('Score UI:', scoreUI);
console.log('Score PDF:', scorePDF);
console.log('Diferença:', Math.abs(Number(scoreUI) - Number(scorePDF)));

// 2. LUFS Integrado
const lufsUI = document.querySelector('[data-metric="lufs-integrated"]')?.dataset?.value;
const lufsPDF = analysis?.lufsIntegrated;
console.log('LUFS UI:', lufsUI);
console.log('LUFS PDF:', lufsPDF);
console.log('Diferença:', Math.abs(Number(lufsUI) - Number(lufsPDF)));

// 3. True Peak
const tpUI = document.querySelector('[data-metric="true-peak"]')?.dataset?.value;
const tpPDF = analysis?.truePeakDbtp;
console.log('True Peak UI:', tpUI);
console.log('True Peak PDF:', tpPDF);
console.log('Diferença:', Math.abs(Number(tpUI) - Number(tpPDF)));

// 4. Dynamic Range
const drUI = document.querySelector('[data-metric="dynamic-range"]')?.dataset?.value;
const drPDF = analysis?.dynamicRange;
console.log('Dynamic Range UI:', drUI);
console.log('Dynamic Range PDF:', drPDF);
console.log('Diferença:', Math.abs(Number(drUI) - Number(drPDF)));
```

**Resultado esperado (SE OK):**
```
Score UI: 95
Score PDF: 95
Diferença: 0

LUFS UI: -14.2
LUFS PDF: -14.2
Diferença: 0

True Peak UI: -1.2
True Peak PDF: -1.2
Diferença: 0

Dynamic Range UI: 12.4
Dynamic Range PDF: 12.4
Diferença: 0
```

**Resultado esperado (SE DIVERGÊNCIA):**
```
Score UI: 98
Score PDF: 95
Diferença: 3  ⚠️ DIVERGÊNCIA > 1!
```

---

## 🎯 TESTE 5: EXECUTAR PDF E ANALISAR LOGS

### **Passo a passo:**

1. Abra o DevTools (F12)
2. Vá para a aba **Console**
3. Limpe o console (Ctrl+L ou botão 🚫)
4. Clique em **"Baixar Relatório"**
5. Observe os logs em ordem

### **Logs esperados (ORDEM CORRETA):**

```
📄 [PDF-START] Iniciando geração de relatório PDF...
📄 [PDF-SOURCE] Fonte de dados: { usingGlobalAlias: true, fileName: "audio.wav" }

🔍 [PDF-VALIDATE] Iniciando validação contra UI...
✅ [PDF-VALIDATE] LUFS Integrado: OK (diff=0.0045)
✅ [PDF-VALIDATE] True Peak: OK (diff=0.0120)
✅ [PDF-VALIDATE] Dynamic Range: OK (diff=0.2500)
✅ [PDF-VALIDATE] Score: OK (diff=0.5000)

📊 [PDF-NORMALIZE] ============ INÍCIO DA NORMALIZAÇÃO ============
📊 [PDF-NORMALIZE] Estrutura recebida: { keys: [...], score: 95 }

🔍 [AUDIT-SCORE] Modo: GÊNERO
🔍 [AUDIT-SCORE] Usando analysis.score: 95

🎧 [PDF-NORMALIZE] Loudness extraído: { integrated: -14.2, ... }
⚙️ [PDF-NORMALIZE] True Peak extraído: { maxDbtp: -1.2, ... }
🎚️ [PDF-NORMALIZE] Dinâmica extraída: { range: 12.4, crest: 4.2 }
🎛️ [PDF-NORMALIZE] Stereo extraído: { width: 0.85, ... }

🔍 [AUDIT-BANDS] Fonte: analysis.bands
🔍 [AUDIT-BANDS] Estrutura: { sub: {...}, bass: {...} }
🔍 [AUDIT-BANDS] Chaves disponíveis: ["sub", "bass", "mid", "high"]
📈 [PDF-NORMALIZE] Bandas espectrais extraídas: { sub: -20.1, bass: -18.5, mid: -16.2, high: -19.8 }

🔍 [AUDIT-SUGGESTIONS] Diagnósticos - Fonte: analysis.problems, Count: 3
🔍 [AUDIT-SUGGESTIONS] Recomendações - Fonte: analysis.suggestions, Count: 7
✅ [AUDIT-SUGGESTIONS] Sugestões foram ENRICHED (flag: _suggestionsGenerated=true)

📊 [AUDIT-SUMMARY] ============ RESUMO DA AUDITORIA ============
📊 [AUDIT-SUMMARY] Análise: {
  modo: "GÊNERO",
  arquivo: "audio.wav",
  scoreUsado: 95,
  bandasSource: "analysis.bands",
  bandasNull: false,
  suggestionsSource: "analysis.suggestions",
  suggestionsEnriched: true,
  diagnosticsSource: "analysis.problems"
}

✅ [PDF-NORMALIZE] Resultado normalizado: { ... }
📊 [PDF-NORMALIZE] ============ FIM DA NORMALIZAÇÃO ============
```

### **❌ Logs de PROBLEMA a serem evitados:**

```
🚨 [AUDIT-BANDS] ⚠️ PROBLEMA: Todas as bandas são NULL!
🚨 [AUDIT-BANDS] Causa provável: Backend não enviou "bands", "spectralBands" ou "spectral.bands"
🚨 [AUDIT-BANDS] Solução: Implementar fallback para computar de spectrum ou extrair da UI
```

```
⚠️ [AUDIT-SUGGESTIONS] Sugestões NÃO foram enriched (flag: _suggestionsGenerated=false)
⚠️ [AUDIT-SUGGESTIONS] PDF pode estar usando sugestões GENÉRICAS!
```

```
🚨 [PDF-VALIDATE] DIVERGÊNCIA em Score: { pdf: 98, ui: 100, diferenca: "2.000" }
```

---

## 🎯 TESTE 6: VERIFICAR PDF GERADO

### **Checklist Visual do PDF:**

#### **1. Cabeçalho**
- [ ] Nome do arquivo está correto
- [ ] Data e hora estão corretas

#### **2. Card de Score**
- [ ] Score exibido (ex: `95/100`)
- [ ] Classificação correta (ex: `🏆 Profissional`)

#### **3. Métricas (4 cards)**
- [ ] **Loudness:**
  - [ ] Integrado: `-14.2 LUFS` (não `—`)
  - [ ] Curto Prazo: valor numérico
  - [ ] Momentâneo: valor numérico
  - [ ] LRA: valor numérico

- [ ] **True Peak:**
  - [ ] Pico Real: `-1.2 dBTP` (não `—`)
  - [ ] Clipping (samples): número
  - [ ] Clipping (%): número

- [ ] **Dinâmica:**
  - [ ] Dynamic Range: `12.4 dB` (não `—`)
  - [ ] Crest Factor: valor numérico

- [ ] **Stereo:**
  - [ ] Largura: `85.0%` (não `—`)
  - [ ] Correlação: valor numérico
  - [ ] Compat. Mono: valor numérico

#### **4. Espectro de Frequências**
- [ ] **Sub (20-60Hz):** `-20.1 dB` (não `—`) ⚠️ **CRÍTICO**
- [ ] **Grave (60-250Hz):** `-18.5 dB` (não `—`) ⚠️ **CRÍTICO**
- [ ] **Médio (250-4kHz):** `-16.2 dB` (não `—`) ⚠️ **CRÍTICO**
- [ ] **Agudo (4k-20kHz):** `-19.8 dB` (não `—`) ⚠️ **CRÍTICO**

**SE TODAS AS BANDAS MOSTRAREM "—":**
```
🚨 PROBLEMA CONFIRMADO: Backend não está enviando dados de bandas!
```

#### **5. Diagnóstico**
- [ ] Lista de problemas detectados (ou `✅ Nenhum problema detectado`)
- [ ] Formatação correta (bullet points)

#### **6. Recomendações**
- [ ] Lista de sugestões (ou `✅ Análise completa`)
- [ ] Sugestões **contextualizadas** (não genéricas como "Ajustar loudness")
- [ ] Exemplo de sugestão enriquecida: `"Adicionar boost de +2dB em sub-bass (20-60Hz) para atingir energia similar ao gênero Trap (-18dB)"`

**SE SUGESTÕES FOREM GENÉRICAS:**
```
⚠️ PROBLEMA CONFIRMADO: Enriquecimento não foi executado!
```

---

## 🎯 TESTE 7: MODO REFERÊNCIA (SE APLICÁVEL)

### **Console do Navegador:**

```javascript
const analysis = window.__soundyAI?.analysis;

// 1. Verificar modo
console.log('Modo:', analysis?.mode);
console.log('Tem user?', !!analysis?.user);
console.log('Tem reference?', !!analysis?.reference);
console.log('Tem comparison?', !!analysis?.comparison);

// 2. Verificar scores
console.log('Score do usuário:', analysis?.user?.score);
console.log('Score da referência:', analysis?.reference?.score);
console.log('Score na raiz:', analysis?.score);

// 3. Verificar qual score será usado no PDF
if (analysis?.mode === 'reference' || (analysis?.user && analysis?.reference)) {
    console.log('✅ Modo referência detectado!');
    console.log('PDF deve usar:', analysis?.user?.score || analysis?.comparison?.score?.user);
} else {
    console.log('PDF usará:', analysis?.score);
}
```

**Resultado esperado:**
```
Modo: reference
Tem user? true
Tem reference? true
Tem comparison? true
Score do usuário: 78
Score da referência: 95
Score na raiz: undefined
✅ Modo referência detectado!
PDF deve usar: 78
```

**No PDF gerado:**
- [ ] Score exibido é **78** (do usuário), **NÃO 95** (da referência)
- [ ] Bandas são do usuário (`analysis.user.bands`)
- [ ] Sugestões incluem comparação com referência

---

## 📊 TABELA DE VERIFICAÇÃO FINAL

| Item                        | Status | Observações |
|-----------------------------|--------|-------------|
| Objeto global existe        | ✅ / ❌ |             |
| Score correto (modo gênero) | ✅ / ❌ |             |
| Score correto (modo ref)    | ✅ / ❌ |             |
| Bandas espectrais OK        | ✅ / ❌ | ⚠️ CRÍTICO  |
| Sugestões enriquecidas      | ✅ / ❌ |             |
| Validação UI passou         | ✅ / ❌ |             |
| PDF sem "—" nas bandas      | ✅ / ❌ | ⚠️ CRÍTICO  |
| Logs de auditoria OK        | ✅ / ❌ |             |

---

## 🚨 PROBLEMAS CONHECIDOS E SOLUÇÕES

### **PROBLEMA 1: Todas as bandas mostram "—"**

**Diagnóstico:**
```javascript
const analysis = window.__soundyAI?.analysis;
console.log(analysis?.bands); // undefined
console.log(analysis?.spectralBands); // undefined
console.log(analysis?.spectral?.bands); // undefined
```

**Causa:** Backend não está enviando dados de bandas.

**Solução temporária:**
1. Verificar se backend está computando bandas corretamente
2. Verificar se `normalizeBackendAnalysisData` está preservando bandas
3. Implementar fallback para computar de `spectrum` (FFT)

---

### **PROBLEMA 2: Sugestões genéricas no PDF**

**Diagnóstico:**
```javascript
const analysis = window.__soundyAI?.analysis;
console.log(analysis?._suggestionsGenerated); // false ou undefined
console.log(window.SuggestionTextGenerator); // undefined
```

**Causa:** `SuggestionTextGenerator` não carregou ou falhou.

**Solução temporária:**
1. Verificar se `suggestion-text-generator.js` está sendo carregado
2. Verificar console por erros de carregamento
3. Tentar enriquecer manualmente antes de gerar PDF

---

### **PROBLEMA 3: Score incorreto no modo referência**

**Diagnóstico:**
```javascript
const analysis = window.__soundyAI?.analysis;
console.log('Modo:', analysis?.mode); // "reference"
console.log('Score na raiz:', analysis?.score); // undefined ou 0
console.log('Score do usuário:', analysis?.user?.score); // 78
```

**PDF mostra:** `0/100` (incorreto)

**Solução:** Logs de auditoria já detectam isso e corrigem automaticamente.

---

## ✅ CONCLUSÃO

Após executar todos os testes:

1. ✅ Se **TODOS os logs estiverem OK** e **PDF não tiver "—" nas bandas** → **Sistema funcionando perfeitamente**
2. ⚠️ Se **bandas mostrarem "—"** → **Backend não está enviando dados de bandas**
3. ⚠️ Se **sugestões forem genéricas** → **Enriquecimento falhou**
4. ⚠️ Se **score incorreto no modo ref** → **Usar analysis.user.score**

**Próximos passos se houver problemas:**
1. Implementar fallbacks para bandas (spectrum, UI)
2. Verificar carregamento de SuggestionTextGenerator
3. Corrigir extração de score no modo referência

---

**Arquivo:** `GUIA_TESTES_PIPELINE_PDF.md`  
**Gerado em:** 30/10/2025
