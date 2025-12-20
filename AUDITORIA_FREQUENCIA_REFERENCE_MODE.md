# 🔍 AUDITORIA COMPLETA: Score de Frequência no Modo REFERENCE

**Data:** 20/12/2025  
**Arquivo:** `audio-analyzer-integration.js`  
**Problema:** Score de Frequência incorreto (0 ou 100) e ausência de sugestões no modo REFERENCE

---

## 🎯 RESUMO EXECUTIVO

### Problema Reportado
No modo REFERENCE (comparação A/B entre 2 faixas):
- ✅ Tabela A/B renderiza corretamente com valores reais
- ❌ **Score de Frequência fica 0** (logs: "Desativando score de Frequência")
- ❌ **Não aparecem sugestões de FREQUÊNCIA** mesmo com grandes diferenças nas bandas
- ❌ Logs mostram: `userBandsOK: false`, `refBandsOK: false`
- ❌ `isGenreMode: true` mesmo com `mode='reference'`

### Impacto
- **Crítico:** Usuário não consegue avaliar qualidade espectral no modo A/B
- **UX:** Score final incorreto (não reflete análise real das bandas)
- **Confiabilidade:** Falta de sugestões impede melhorias

---

## 🔬 ROOT CAUSE ANALYSIS

### ROOT CAUSE #1: `__bandsAreMeaningful()` procura keys incompatíveis
**Localização:** Linha ~13510  
**Sintoma:** `userBandsOK = false, refBandsOK = false`

**Problema:**
```javascript
// CÓDIGO ATUAL (LINHA ~13515):
const k = __keys(normalizedBands).filter(k => 
    ['sub','bass','lowMid','mid','highMid','presence','air'].includes(k)
);
```

**Causa:**
- `technicalData` tem keys: `bandSub`, `bandBass`, `bandLowMid`, etc.
- Função procura: `sub`, `bass`, `lowMid`, etc.
- **Resultado:** Nenhuma key encontrada → `userBandsOK = false`

**Evidência (logs):**
```
[VERIFY_AB_ORDER] userBands: 'ausente', refBands: 'ausente'
[SCORES-GUARD] Desativando score de Frequência
```

---

### ROOT CAUSE #2: `isGenreMode` detectado incorretamente
**Localização:** Linhas ~13954, ~21008  
**Sintoma:** `isGenreMode: true` em modo reference

**Problema:**
```javascript
// LINHA 13954:
const isGenreMode = SOUNDY_MODE_ENGINE.isGenre();

// LINHA 21008:
const isGenreMode = SOUNDY_MODE_ENGINE.isGenre();
```

**Causa:**
- `SOUNDY_MODE_ENGINE.isGenre()` retorna `true` mesmo em modo reference
- Função não verifica `state.render.mode` corretamente
- **Resultado:** Lógica busca genre targets ao invés de referenceAnalysis

**Evidência (logs):**
```
[MODE-DETECTION] explicitMode: 'reference'
[VERIFY_AB_ORDER] isGenreMode: true  ← BUG!
```

---

### ROOT CAUSE #3: Guard desativa score prematuramente
**Localização:** Linha ~13907  
**Sintoma:** Score de Frequência sempre 0 ou desativado

**Problema:**
```javascript
// LINHA 13907:
if (!refBandsOK || !userBandsOK || selfCompare) {
    disableFrequency = true;
    console.warn('⚠️ [SCORES-GUARD] Desativando score de Frequência');
    // ...
    referenceDataForScores = {
        // ... métricas escalares ...
        bands: null, // força desativado
```

**Causa:**
- Guard é ativado por `userBandsOK = false` (causado por ROOT CAUSE #1)
- Quando desativado, `bands = null` → `calculateFrequencyScore` retorna 0
- **Problema crítico:** Score 0 entra no cálculo final SEM renormalizar pesos
- **Resultado:** Score final incorreto (penalizado injustamente)

**Impacto no Score Final:**
```javascript
// LINHA 21142-21185 (calculateSubscores):
const frequencyScore = calculateFrequencyScore(analysis, refData);
// frequencyScore = 0 (não null!)

// LINHA 21184-21185:
if (frequencyScore !== null) {  // ← 0 !== null, então entra!
    weightedSum += frequencyScore * weights.frequencia; // 0 * 0.3 = 0
}
```

**Peso da Frequência:** 30% (0.3) → 30 pontos perdidos no score final!

---

### ROOT CAUSE #4: Sugestões de frequência não aparecem
**Localização:** Linha ~24935  
**Sintoma:** 0 sugestões de frequência no modo reference

**Problema:**
```javascript
// LINHA 24935-24943:
if (isReferenceMode && !isGenreModeCheck && state?.reference?.referenceAnalysis) {
    console.log('[SUGGESTIONS-GEN] 🎵 Gerando sugestões...');
    
    const userBands = extractBandsMap(state.reference.userAnalysis);
    const refBands = extractBandsMap(state.reference.referenceAnalysis);
    
    if (userBands && refBands) {
        // ... gera sugestões ...
```

**Causa:**
- `extractBandsMap()` retorna `null` (ver ROOT CAUSE #1)
- Condição `if (userBands && refBands)` nunca é satisfeita
- **Resultado:** Loop de sugestões nunca executa

**Evidência (logs):**
```
[SUGGESTIONS-GEN] ⚠️ Não foi possível extrair bandas para sugestões
```

---

## 🎯 SOLUÇÃO PROPOSTA

### CORREÇÃO #1: Melhorar `extractBandsMap()` (adapter universal)
**Arquivo:** `audio-analyzer-integration.js`  
**Localização:** Linha ~13411  

**Objetivo:**
- Buscar bandas em TODAS as estruturas possíveis (retrocompatibilidade)
- Normalizar para formato padrão: `{sub, bass, lowMid, mid, highMid, presence, air}`

**Prioridade de Busca:**
1. `technicalData.bandSub`, `bandBass`, etc. (estrutura atual)
2. `technicalData.spectral_balance.sub`, etc.
3. `technicalData.bands` (array) → converter
4. `technicalData` direto (campos soltos)
5. `analysis.bands` (legado)

**Implementação:**
```javascript
function extractBandsMap(analysisOrTechnicalData) {
    if (!analysisOrTechnicalData) return null;
    
    const DEBUG = window.__DEBUG_SCORE_REFERENCE__ || false;
    const tech = analysisOrTechnicalData.technicalData || analysisOrTechnicalData;
    
    // Fonte 1: Campos diretos no technicalData
    const directKeys = {
        'sub': tech.bandSub,
        'bass': tech.bandBass,
        'lowMid': tech.bandLowMid,
        'mid': tech.bandMid,
        'highMid': tech.bandHighMid,
        'presence': tech.bandPresence,
        'air': tech.bandAir
    };
    
    // Verificar se tem pelo menos 5 bandas válidas
    const validDirect = Object.entries(directKeys)
        .filter(([k, v]) => Number.isFinite(v))
        .length;
    
    if (validDirect >= 5) {
        const result = {};
        Object.entries(directKeys).forEach(([k, v]) => {
            if (Number.isFinite(v)) result[k] = v;
        });
        if (DEBUG) console.log('[EXTRACT-BANDS] ✅ Fonte: campos diretos (bandXxx)');
        return result;
    }
    
    // Fonte 2: spectral_balance
    if (tech.spectral_balance && typeof tech.spectral_balance === 'object') {
        const sb = tech.spectral_balance;
        const mapping = {
            'sub': sb.sub || sb.bandSub,
            'bass': sb.bass || sb.low_bass || sb.bandBass,
            'lowMid': sb.lowMid || sb.low_mid || sb.bandLowMid,
            'mid': sb.mid || sb.bandMid,
            'highMid': sb.highMid || sb.high_mid || sb.bandHighMid,
            'presence': sb.presence || sb.presenca || sb.bandPresence,
            'air': sb.air || sb.brilho || sb.bandAir
        };
        
        const validSB = Object.values(mapping).filter(v => Number.isFinite(v)).length;
        if (validSB >= 5) {
            const result = {};
            Object.entries(mapping).forEach(([k, v]) => {
                if (Number.isFinite(v)) result[k] = v;
            });
            if (DEBUG) console.log('[EXTRACT-BANDS] ✅ Fonte: spectral_balance');
            return result;
        }
    }
    
    // Fonte 3: Objeto bands (normalizado)
    if (tech.bands && typeof tech.bands === 'object' && !Array.isArray(tech.bands)) {
        const validBands = Object.values(tech.bands).filter(v => Number.isFinite(v)).length;
        if (validBands >= 5) {
            if (DEBUG) console.log('[EXTRACT-BANDS] ✅ Fonte: bands object');
            return tech.bands;
        }
    }
    
    if (DEBUG) console.warn('[EXTRACT-BANDS] ⚠️ Nenhuma fonte válida encontrada');
    return null;
}
```

---

### CORREÇÃO #2: Corrigir detecção de `isGenreMode`
**Arquivo:** `audio-analyzer-integration.js`  
**Localizações:** Linhas ~13954, ~21008

**Problema Atual:**
```javascript
const isGenreMode = SOUNDY_MODE_ENGINE.isGenre();
```

**Correção:**
```javascript
// Usar APENAS state.render.mode como fonte da verdade
const explicitMode = state.render?.mode || window.currentAnalysisMode;
const isGenreMode = explicitMode === 'genre';

if (DEBUG) {
    console.log('[MODE-DETECTION] isGenreMode:', isGenreMode, {
        source: explicitMode,
        stateRenderMode: state.render?.mode,
        currentAnalysisMode: window.currentAnalysisMode
    });
}
```

**Rationale:**
- `state.render.mode` é configurado explicitamente no fluxo de referência
- `SOUNDY_MODE_ENGINE.isGenre()` tem heurísticas que causam falsos positivos
- Modo deve ser **determinístico**, não inferido

---

### CORREÇÃO #3: Renormalizar pesos quando score ausente
**Arquivo:** `audio-analyzer-integration.js`  
**Localização:** Linha ~21180

**Problema Atual:**
```javascript
// LINHA 21184-21185:
if (frequencyScore !== null) {
    weightedSum += frequencyScore * weights.frequencia; // 0 * 0.3 = 0 ← BUG!
}
```

**Correção:**
```javascript
// Calcular subscores e rastrear quais são válidos
const subscores = {
    loudness: calculateLoudnessScore(analysis, refData),
    dynamics: calculateDynamicsScore(analysis, refData),
    stereo: calculateStereoScore(analysis, refData),
    technical: calculateTechnicalScore(analysis, refData),
    frequency: calculateFrequencyScore(analysis, refData)
};

// Filtrar apenas subscores válidos (não null, não undefined)
const validScores = {};
Object.entries(subscores).forEach(([key, value]) => {
    if (value !== null && value !== undefined && Number.isFinite(value)) {
        validScores[key] = value;
    }
});

// Renormalizar pesos apenas para subscores disponíveis
const availableKeys = Object.keys(validScores);
const totalWeight = availableKeys.reduce((sum, key) => sum + (weights[key] || 0), 0);

if (totalWeight === 0 || availableKeys.length === 0) {
    console.warn('[SCORE-CALC] ⚠️ Nenhum subscore válido - retornando 0');
    return 0;
}

// Calcular weighted sum normalizado
let weightedSum = 0;
availableKeys.forEach(key => {
    const normalizedWeight = (weights[key] || 0) / totalWeight;
    weightedSum += validScores[key] * normalizedWeight;
    
    console.log(`[SCORE-CALC] ${key}: ${validScores[key]}% × ${(normalizedWeight * 100).toFixed(1)}% = ${(validScores[key] * normalizedWeight).toFixed(1)}`);
});

console.log('[SCORE-CALC] ✅ Score final (renormalizado):', Math.round(weightedSum));
```

**Exemplo:**
```
Subscores disponíveis: loudness(85), dynamics(92), stereo(78)
Pesos originais: loudness(0.3), dynamics(0.25), stereo(0.15), frequency(0.3 - AUSENTE)
Peso total disponível: 0.3 + 0.25 + 0.15 = 0.7

Renormalização:
- loudness: 0.3 / 0.7 = 0.43 (43%)
- dynamics: 0.25 / 0.7 = 0.36 (36%)
- stereo: 0.15 / 0.7 = 0.21 (21%)

Score final: (85 × 0.43) + (92 × 0.36) + (78 × 0.21) = 86.4
```

---

### CORREÇÃO #4: Garantir sugestões de frequência
**Arquivo:** `audio-analyzer-integration.js`  
**Localização:** Linha ~24935

**Já existe o código!** Apenas precisa do adapter corrigido (CORREÇÃO #1).

**Validação adicional:**
```javascript
if (isReferenceMode && !isGenreModeCheck && state?.reference) {
    console.log('[FREQ-SUGGESTIONS] 🎵 Gerando sugestões de frequência...');
    
    const userBands = extractBandsMap(state.reference.userAnalysis);
    const refBands = extractBandsMap(state.reference.referenceAnalysis);
    
    if (!userBands || !refBands) {
        console.error('[FREQ-SUGGESTIONS] ❌ Falha ao extrair bandas:', {
            userBands: !!userBands,
            refBands: !!refBands,
            userAnalysisKeys: state.reference.userAnalysis ? Object.keys(state.reference.userAnalysis) : null,
            refAnalysisKeys: state.reference.referenceAnalysis ? Object.keys(state.reference.referenceAnalysis) : null
        });
        return; // Abortar geração de sugestões
    }
    
    // ... resto do código existente (linhas 24940-25012) ...
}
```

---

## ✅ VALIDAÇÃO DA SOLUÇÃO

### Testes Manuais

**Teste 1: Score de Frequência Correto**
```javascript
// Abrir console no modo REFERENCE com 2 faixas diferentes
window.__DEBUG_SCORE_REFERENCE__ = true;

// Esperado:
[EXTRACT-BANDS] ✅ Fonte: campos diretos (bandXxx)
[MODE-DETECTION] isGenreMode: false
[FREQ-SCORE] ✅ Bandas extraídas: sub, bass, lowMid, mid, highMid, presence, air
[SCORE-CALC] frequency: 67% × 30% = 20.1
```

**Teste 2: Sugestões de Frequência Aparecem**
```javascript
// Contar sugestões de frequência no DOM
document.querySelectorAll('[data-suggestion-type="frequency"]').length

// Esperado: 3-7 sugestões (dependendo das diferenças)
```

**Teste 3: userBandsOK e refBandsOK Válidos**
```javascript
// Verificar logs de validação
// Esperado:
[VERIFY_AB_ORDER] userBandsOK: true
[VERIFY_AB_ORDER] refBandsOK: true
```

**Teste 4: Score Final Renormalizado**
```javascript
// Quando frequência ausente (forçar bands = null):
// Esperado:
[SCORE-CALC] Subscores disponíveis: 4 de 5 (frequency ausente)
[SCORE-CALC] Score final (renormalizado): 84
// (não deve despencar por conta da frequência)
```

---

## 📊 IMPACTO DAS CORREÇÕES

| Correção | Impacto | Retrocompatibilidade | Risco |
|----------|---------|---------------------|-------|
| #1 Adapter | ✅ Crítico | ✅ Total | 🟢 Baixo |
| #2 isGenreMode | ✅ Crítico | ✅ Total | 🟢 Baixo |
| #3 Renormalização | ✅ Alto | ✅ Total | 🟢 Baixo |
| #4 Sugestões | ✅ Médio | ✅ Total | 🟢 Baixo |

**Retrocompatibilidade:**
- ✅ Modo GENRE não afetado
- ✅ Estruturas legadas suportadas (fallback em cascata)
- ✅ Sem quebra de API ou contratos

**Risco:**
- 🟢 **Baixo:** Mudanças cirúrgicas e isoladas
- 🟢 **Testável:** Logs de debug facilitam validação
- 🟢 **Reversível:** Patches podem ser revertidos independentemente

---

## 🔧 IMPLEMENTAÇÃO

### Arquivos Afetados
- `audio-analyzer-integration.js` (único arquivo)

### Linhas Modificadas
1. **Linha ~13411:** Melhorar `extractBandsMap()` (+60 linhas)
2. **Linha ~13954:** Corrigir `isGenreMode` (5 linhas)
3. **Linha ~21008:** Corrigir `isGenreMode` (5 linhas)
4. **Linha ~21180:** Renormalizar pesos (+35 linhas)
5. **Linha ~24940:** Validação adicional (+10 linhas)

**Total:** ~115 linhas modificadas/adicionadas

### Tempo Estimado
- Implementação: 30-45 minutos
- Testes: 15-20 minutos
- **Total:** ~1 hora

---

## 📝 CONCLUSÃO

### Root Causes Identificados
1. ✅ Adapter de bandas incompleto
2. ✅ Detecção de modo incorreta
3. ✅ Pesos não renormalizados
4. ✅ Sugestões dependem do adapter quebrado

### Soluções Propostas
1. ✅ Adapter robusto com múltiplas fontes
2. ✅ Detecção determinística de modo
3. ✅ Renormalização automática de pesos
4. ✅ Validação adicional para sugestões

### Benefícios
- ✅ Score de Frequência preciso no modo REFERENCE
- ✅ Sugestões contextualizadas por banda
- ✅ Score final justo (não penaliza dados ausentes)
- ✅ Logs de debug para manutenção futura

### Próximos Passos
1. Aplicar patch via `multi_replace_string_in_file`
2. Executar testes manuais (4 cenários)
3. Validar com `get_errors`
4. Commit com mensagem descritiva

---

**Fim da Auditoria**
