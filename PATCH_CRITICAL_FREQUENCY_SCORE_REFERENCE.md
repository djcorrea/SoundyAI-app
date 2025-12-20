# 🚨 PATCH CRÍTICO: Score de Frequência e Sugestões no Modo REFERENCE

**Data:** 20 de dezembro de 2025  
**Severidade:** CRÍTICA  
**Modo Afetado:** REFERENCE (comparação A/B entre faixas)

---

## 📋 SUMÁRIO EXECUTIVO

Corrigido bug crítico onde:
- ✅ Score de Frequência ficava 100% mesmo com tabela A/B mostrando bandas vermelhas
- ✅ Sugestões de frequência não eram geradas no modo reference
- ✅ isGenreMode estava true incorretamente em modo reference
- ✅ Validação de bandas não reconhecia technicalData.bandSub/bandBass/...

---

## 🔍 ROOT CAUSES IDENTIFICADOS

### **ROOT CAUSE #1: Validação de Bandas Incompatível com technicalData**

**Função Afetada:** `__bandsAreMeaningful(bands)`  
**Linha:** ~13410

**Problema:**
A função procura por keys: `['sub','bass','lowMid','mid','highMid','presence','air']`

Mas **technicalData** usa keys diferentes:
```javascript
technicalData.bandSub      // ❌ não reconhecido como 'sub'
technicalData.bandBass     // ❌ não reconhecido como 'bass'
technicalData.bandLowMid   // ❌ não reconhecido como 'lowMid'
...
```

**Resultado:**
- `userBandsOK = false`
- `refBandsOK = false`
- Score de Frequência desativado
- Retorna 100 como fallback

---

### **ROOT CAUSE #2: isGenreMode Usando SOUNDY_MODE_ENGINE Incorretamente**

**Linha:** ~13670

**Problema:**
```javascript
const isGenreMode = SOUNDY_MODE_ENGINE.isGenre();
```

`SOUNDY_MODE_ENGINE.isGenre()` pode retornar true mesmo em modo reference, causando:
- Lógica errada para extração de bandas
- Score calculado com targets de gênero ao invés de valores da faixa de referência

---

### **ROOT CAUSE #3: calculateFrequencyScore Retorna null mas UI Mostra 100**

**Linha:** ~20666

**Problema:**
Quando não há bandas válidas, retorna `null`:
```javascript
if (scores.length === 0) {
    return null;
}
```

Mas o código que consome esse score trata `null` como 100%:
```javascript
const frequencyScore = calculateFrequencyScore(analysis, refData);
// Se frequencyScore === null, normalização usa 100 como fallback
```

---

### **ROOT CAUSE #4: Sugestões de Frequência Não Geradas no Reference**

**Problema:**
Sistema de sugestões verifica:
```javascript
if (!refData.bands || !isGenreMode) return; // ❌ bloqueia reference
```

Sugestões só rodam se `isGenreMode === true`, mas no reference deveria ser false.

---

## 🛠️ CORREÇÕES APLICADAS

### **FIX #1: Adapter de Extração de Bandas (Único e Reutilizável)**

**Arquivo:** audio-analyzer-integration.js  
**Inserir antes de:** `__bandsAreMeaningful` (~linha 13400)

```javascript
// 🎯 ADAPTER UNIVERSAL: Extrai bandas de qualquer estrutura (technicalData, bands, spectral_balance)
function extractBandsMap(analysisOrTechnicalData) {
    if (!analysisOrTechnicalData) return null;
    
    const DEBUG_BANDS_EXTRACT = window.__DEBUG_SCORE_REFERENCE__ || false;
    
    // Normalizar input: pode ser analysis completo ou só technicalData
    const tech = analysisOrTechnicalData.technicalData || analysisOrTechnicalData;
    
    // Fonte 1: technicalData.bands (estrutura padrão)
    if (tech.bands && typeof tech.bands === 'object') {
        const bandsObj = tech.bands;
        const result = {};
        
        // Mapear keys padrão
        const keyMap = {
            'sub': tech.bandSub || bandsObj.sub || bandsObj.bandSub,
            'bass': tech.bandBass || bandsObj.bass || bandsObj.bandBass || bandsObj.low_bass,
            'lowMid': tech.bandLowMid || bandsObj.lowMid || bandsObj.bandLowMid || bandsObj.low_mid,
            'mid': tech.bandMid || bandsObj.mid || bandsObj.bandMid,
            'highMid': tech.bandHighMid || bandsObj.highMid || bandsObj.bandHighMid || bandsObj.high_mid,
            'presence': tech.bandPresence || bandsObj.presence || bandsObj.bandPresence || bandsObj.presenca,
            'air': tech.bandAir || bandsObj.air || bandsObj.bandAir || bandsObj.brilho
        };
        
        Object.entries(keyMap).forEach(([key, val]) => {
            if (val !== undefined) {
                // Extrair valor numérico
                const numVal = typeof val === 'object' ? 
                    (val.energy_db ?? val.rms_db ?? val.value ?? val) : 
                    val;
                if (Number.isFinite(numVal)) {
                    result[key] = numVal;
                }
            }
        });
        
        if (Object.keys(result).length >= 3) {
            if (DEBUG_BANDS_EXTRACT) console.log('[EXTRACT-BANDS] ✅ Fonte 1: technicalData.bands + bandXxx', result);
            return result;
        }
    }
    
    // Fonte 2: Propriedades diretas technicalData.bandSub/bandBass/...
    const directKeys = {
        'sub': tech.bandSub,
        'bass': tech.bandBass,
        'lowMid': tech.bandLowMid,
        'mid': tech.bandMid,
        'highMid': tech.bandHighMid,
        'presence': tech.bandPresence,
        'air': tech.bandAir
    };
    
    const directResult = {};
    Object.entries(directKeys).forEach(([key, val]) => {
        if (Number.isFinite(val)) {
            directResult[key] = val;
        }
    });
    
    if (Object.keys(directResult).length >= 3) {
        if (DEBUG_BANDS_EXTRACT) console.log('[EXTRACT-BANDS] ✅ Fonte 2: technicalData.bandXxx', directResult);
        return directResult;
    }
    
    // Fonte 3: spectral_balance
    if (tech.spectral_balance && typeof tech.spectral_balance === 'object') {
        const sb = tech.spectral_balance;
        const sbResult = {};
        
        const sbMap = {
            'sub': sb.sub,
            'bass': sb.bass || sb.low_bass,
            'lowMid': sb.lowMid || sb.low_mid,
            'mid': sb.mid,
            'highMid': sb.highMid || sb.high_mid,
            'presence': sb.presence || sb.presenca,
            'air': sb.air || sb.brilho
        };
        
        Object.entries(sbMap).forEach(([key, val]) => {
            const numVal = typeof val === 'object' ? 
                (val.energy_db ?? val.rms_db ?? val) : 
                val;
            if (Number.isFinite(numVal)) {
                sbResult[key] = numVal;
            }
        });
        
        if (Object.keys(sbResult).length >= 3) {
            if (DEBUG_BANDS_EXTRACT) console.log('[EXTRACT-BANDS] ✅ Fonte 3: spectral_balance', sbResult);
            return sbResult;
        }
    }
    
    if (DEBUG_BANDS_EXTRACT) console.warn('[EXTRACT-BANDS] ⚠️ Nenhuma fonte de bandas válida');
    return null;
}
```

---

### **FIX #2: Atualizar __bandsAreMeaningful para Usar Adapter**

**Linha:** ~13410

```javascript
function __bandsAreMeaningful(bands) {
    if (!bands) return false;
    
    // 🎯 USAR ADAPTER: Se bands não tem keys padrão, tentar extrair
    let normalizedBands = bands;
    const hasStandardKeys = ['sub','bass','lowMid','mid','highMid','presence','air']
        .some(k => bands[k] !== undefined);
    
    if (!hasStandardKeys) {
        // Tentar extrair via adapter
        normalizedBands = extractBandsMap(bands);
        if (!normalizedBands) return false;
    }
    
    const k = __keys(normalizedBands).filter(k => 
        ['sub','bass','lowMid','mid','highMid','presence','air'].includes(k)
    );
    
    if (k.length < __MIN_BANDS) return false;
    
    // precisa ter variação real (evita vetor todo zero)
    const vals = k.map(k => normalizedBands[k]).filter(__num);
    if (vals.length < __MIN_BANDS) return false;
    
    const max = Math.max(...vals), min = Math.min(...vals);
    return isFinite(max) && isFinite(min) && (Math.abs(max - min) > 0.2);
}
```

---

### **FIX #3: Corrigir Detecção de isGenreMode**

**Linha:** ~13670

```javascript
// 🎯 ROOT CAUSE FIX: Detectar modo APENAS pelo state.render.mode
// NUNCA usar SOUNDY_MODE_ENGINE.isGenre() para lógica de score
const explicitMode = state.render?.mode || window.currentAnalysisMode;
const isGenreMode = explicitMode === 'genre';

console.log('🎯 [MODE-DETECTION] Mode detectado:', {
    explicitMode,
    isGenreMode,
    source: state.render?.mode ? 'state.render.mode' : 'currentAnalysisMode',
    warning: isGenreMode && referenceComparisonMetrics ? 
        '⚠️ Modo genre mas tem referenceComparisonMetrics - verificar!' : null
});
```

---

### **FIX #4: calculateFrequencyScore Retornar 0 ao invés de null**

**Linha:** ~20666

```javascript
// Se não encontrou scores válidos, retornar 0 (não null nem 100)
if (scores.length === 0) {
    console.warn('[FREQ-SCORE] ⚠️ Nenhuma banda válida processada - retornando score=0');
    try {
        console.log('[AUDIT-SCORE]', {
            func: 'calculateFrequencyScore',
            value: 'N/A',
            target: 'N/A',
            diff: 'N/A',
            tolerance: 'N/A',
            result: 0, // ✅ MUDADO DE null PARA 0
            condition: 'no valid scores',
            scoresCount: 0,
            isReferenceMode,
            bandsAvailable: refData.bands ? Object.keys(refData.bands) : []
        });
    } catch (err) {
        console.warn('[AUDIT-ERROR]', 'calculateFrequencyScore (no scores)', err);
    }
    return 0; // ✅ MUDADO DE null PARA 0
}
```

---

### **FIX #5: Usar Adapter no calculateFrequencyScore**

**Linha:** ~20519 (início da função)

```javascript
function calculateFrequencyScore(analysis, refData) {
    if (!analysis || !refData || !refData.bands) return 0; // ✅ retorna 0 não null
    
    // 🎯 USAR ADAPTER UNIVERSAL para extrair bandas
    const bandsToUse = extractBandsMap(analysis);
    
    if (!bandsToUse) {
        console.warn('[FREQ-SCORE] ⚠️ Adapter não conseguiu extrair bandas');
        return 0;
    }
    
    console.log('[FREQ-SCORE] ✅ Bandas extraídas via adapter:', Object.keys(bandsToUse));
    
    // ... resto da função continua igual
```

---

### **FIX #6: Gerar Sugestões de Frequência no Modo Reference**

**Arquivo:** Procurar pela função que gera sugestões (~linha 24800)

**Adicionar após geração de sugestões existentes:**

```javascript
// 🎯 SUGESTÕES DE FREQUÊNCIA EM MODO REFERENCE
function generateFrequencySuggestionsReference(userBands, refBands, analysis) {
    const suggestions = [];
    
    if (!userBands || !refBands) return suggestions;
    
    const DEBUG_SUGGESTIONS = window.__DEBUG_SCORE_REFERENCE__ || false;
    
    const bandNames = {
        'sub': 'Sub (20-60Hz)',
        'bass': 'Bass (60-150Hz)',
        'lowMid': 'Low-Mid (150-500Hz)',
        'mid': 'Mid (500-2kHz)',
        'highMid': 'High-Mid (2-5kHz)',
        'presence': 'Presence (5-10kHz)',
        'air': 'Air (10-20kHz)'
    };
    
    const bandIcons = {
        'sub': '🔊',
        'bass': '🎸',
        'lowMid': '🎹',
        'mid': '🎤',
        'highMid': '🎺',
        'presence': '🎻',
        'air': '✨'
    };
    
    // Threshold: >3dB = sugestão (médio), >6dB = crítico
    const THRESHOLD_MEDIUM = 3.0;
    const THRESHOLD_CRITICAL = 6.0;
    
    Object.entries(bandNames).forEach(([key, displayName]) => {
        const userVal = userBands[key];
        const refVal = refBands[key];
        
        if (!Number.isFinite(userVal) || !Number.isFinite(refVal)) return;
        
        const delta = userVal - refVal; // positivo = você tem mais, negativo = você tem menos
        const absDelta = Math.abs(delta);
        
        if (absDelta > THRESHOLD_MEDIUM) {
            const priority = absDelta > THRESHOLD_CRITICAL ? 'high' : 'medium';
            const icon = bandIcons[key] || '🎵';
            
            let text, action;
            if (delta > 0) {
                // Usuário tem energia MAIOR que referência
                text = `${icon} Banda ${displayName} está ${absDelta.toFixed(1)}dB acima da referência`;
                action = `Reduza em ${absDelta.toFixed(1)}dB usando EQ ou compressor multiband`;
            } else {
                // Usuário tem energia MENOR que referência
                text = `${icon} Banda ${displayName} está ${Math.abs(delta).toFixed(1)}dB abaixo da referência`;
                action = `Aumente em ${Math.abs(delta).toFixed(1)}dB usando EQ ou excitador`;
            }
            
            suggestions.push({
                category: 'frequency',
                priority,
                text,
                action,
                metric: `${key}Band`,
                delta: delta.toFixed(2),
                userValue: userVal.toFixed(2),
                refValue: refVal.toFixed(2)
            });
            
            if (DEBUG_SUGGESTIONS) {
                console.log(`[FREQ-SUGGESTION] ${key}: user=${userVal.toFixed(2)}dB, ref=${refVal.toFixed(2)}dB, delta=${delta.toFixed(2)}dB → ${priority}`);
            }
        }
    });
    
    if (DEBUG_SUGGESTIONS) {
        console.log(`[FREQ-SUGGESTION] Total de sugestões geradas: ${suggestions.length}`);
    }
    
    return suggestions;
}
```

**Integrar no pipeline de sugestões:**

Procurar onde sugestões são agregadas e adicionar:

```javascript
// Após gerar sugestões de loudness, dinâmica, etc...

// 🎯 SUGESTÕES DE FREQUÊNCIA (MODO REFERENCE)
if (isReferenceMode && !isGenreMode) {
    const userBandsForSuggestions = extractBandsMap(analysis);
    const refBandsForSuggestions = extractBandsMap(referenceAnalysis);
    
    if (userBandsForSuggestions && refBandsForSuggestions) {
        const freqSuggestions = generateFrequencySuggestionsReference(
            userBandsForSuggestions, 
            refBandsForSuggestions, 
            analysis
        );
        
        allSuggestions.push(...freqSuggestions);
        
        console.log(`[SUGGESTIONS] ✅ ${freqSuggestions.length} sugestões de frequência adicionadas (modo reference)`);
    }
}
```

---

## 📊 LOG DE VALIDAÇÃO FINAL

**Adicionar após cálculo de todos os scores (~linha 21050):**

```javascript
// 🎯 LOG DE VALIDAÇÃO COMPLETO (remover após confirmação)
if (window.__DEBUG_SCORE_REFERENCE__) {
    const userBandsDebug = extractBandsMap(analysis);
    const refBandsDebug = refData ? extractBandsMap({ bands: refData.bands }) : null;
    
    const bandDeltas = {};
    if (userBandsDebug && refBandsDebug) {
        Object.keys(userBandsDebug).forEach(key => {
            if (refBandsDebug[key] !== undefined) {
                bandDeltas[key] = (userBandsDebug[key] - refBandsDebug[key]).toFixed(2) + 'dB';
            }
        });
    }
    
    console.group('🔍 [VALIDATION-FINAL] Score de Frequência Auditoria');
    console.table({
        mode: state.render?.mode,
        isGenreMode,
        userBandsOK,
        refBandsOK,
        frequencyScore: scores.frequencia,
        frequencySuggestionsCount: allSuggestions.filter(s => s.category === 'frequency').length
    });
    console.log('📊 User Bands:', userBandsDebug);
    console.log('📊 Ref Bands:', refBandsDebug);
    console.log('📊 Deltas:', bandDeltas);
    console.groupEnd();
}
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

Execute no console do browser após patch:

```javascript
// Ativar debug
window.__DEBUG_SCORE_REFERENCE__ = true;

// Verificar extração de bandas
const testUser = extractBandsMap(window.__soundyState?.userAnalysis);
const testRef = extractBandsMap(window.__soundyState?.referenceAnalysis);

console.log('User bands:', testUser);
console.log('Ref bands:', testRef);

// Verificar se tabela A/B e score usam mesmos dados
const tableDeltas = [...document.querySelectorAll('.ab-compare-table tbody tr')]
    .map(tr => ({
        metric: tr.cells[0]?.textContent,
        user: tr.cells[1]?.textContent,
        ref: tr.cells[2]?.textContent,
        delta: tr.cells[3]?.textContent
    }));

console.table(tableDeltas);

// Score deve refletir deltas da tabela
// Se tabela mostra muitas bandas "corrigir", score NÃO pode ser 100
```

---

## 🎓 RESUMO DAS MUDANÇAS

1. **Adapter Universal** (`extractBandsMap`): Extrai bandas de qualquer estrutura
2. **__bandsAreMeaningful**: Usa adapter se keys padrão não existem
3. **isGenreMode**: Corrigido para usar `state.render.mode === 'genre'`
4. **calculateFrequencyScore**: Retorna 0 ao invés de null, usa adapter
5. **Sugestões**: Nova função `generateFrequencySuggestionsReference`
6. **Debug**: Flag `window.__DEBUG_SCORE_REFERENCE__` para logs detalhados

---

**STATUS:** ✅ PATCH COMPLETO - PRONTO PARA APLICAÇÃO
