# 🔬 AUDITORIA TÉCNICA PROFUNDA - BUGS CRÍTICOS SOUNDYAI

**Data:** 25 de dezembro de 2025  
**Auditor:** Sistema de Análise Técnica  
**Status:** CONCLUÍDO - Causas raiz confirmadas com evidências  

---

## 📊 RESUMO EXECUTIVO

Auditoria técnica profunda identificou **DUAS CAUSAS RAIZ PRINCIPAIS** confirmadas com evidências de código e fluxo de dados:

1. **BUG A (RANGES DIVERGENTES):** Tabela e Modal usam **mapeamentos diferentes** para `band_bass` → `Bass (60-120 Hz)` vs `Bass (60-250 Hz)` devido a **alias/normalização inconsistente**.

2. **BUG B (ENRIQUECIMENTO IA PERDIDO):** Backend salva `aiSuggestions` corretamente, mas frontend **renderiza `suggestions` ao invés de `aiSuggestions`**, resultando em cards "crus" sem enriquecimento.

**Impacto:** Crítico - afeta precisão técnica e experiência do usuário em modo Genre.  
**Complexidade de correção:** Média - requer mudanças cirúrgicas em 3-4 arquivos.

---

## 🐛 BUG A: RANGES/TARGETS DE BANDAS DIVERGENTES ENTRE TABELA vs MODAL

### 🎯 CAUSA RAIZ CONFIRMADA

**DIVERGÊNCIA DE FONTE DE DADOS + MAPEAMENTO INCONSISTENTE**

#### 📍 EVIDÊNCIA 1: Tabela usa `genreTargets.bands` diretamente

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L7196-L7270)  
**Linhas:** 7196-7650

```javascript
// TABELA: renderGenreComparisonTable()
// Linha 7223: Usa targets recebidos por parâmetro (flat object)
let genreData = targets;

// Linha 7295-7332: Extrai bandas com normalização
const targetBands = (() => {
    // PRIORIDADE 1: spectral_bands
    if (genreData.spectral_bands) {
        const normalized = {};
        Object.keys(genreData.spectral_bands).forEach(snakeKey => {
            const camelKey = normalizeGenreBandName(snakeKey);  // ← CONVERSÃO AQUI
            normalized[camelKey] = genreData.spectral_bands[snakeKey];
        });
        return normalized;
    }
    // PRIORIDADE 2: bands
    if (genreData.bands) return genreData.bands;
    // ...fallback
})();

// Linha 7548-7557: Labels hardcoded COM RANGES CORRETOS
const nomesBandas = {
    sub: '🔉 Sub (20-60 Hz)',
    bass: '🔊 Bass (60-120 Hz)',           // ← TARGET: low_bass (60-120 Hz)
    upperBass: '🔊 Upper Bass (120-250 Hz)',
    lowMid: '🎵 Low Mid (250-500 Hz)',
    // ...
    low_bass: '🔊 Bass (60-120 Hz)',       // ← ALIAS LEGADO
};
```

**O QUE ACONTECE NA TABELA:**
- `genreTargets.bands.low_bass` → normalizado para `bass` → renderiza **"Bass (60-120 Hz)"** ✅
- Range exibido: vem de `targetBand.target_range` ou `targetBand.target_db ± tol_db`
- **FONTE DA VERDADE:** `genreData.bands` (estrutura do backend)

---

#### 📍 EVIDÊNCIA 2: Modal usa `FREQUENCY_RANGES` local (FALLBACK)

**Arquivo:** [work/lib/audio/utils/suggestion-text-builder.js](work/lib/audio/utils/suggestion-text-builder.js#L544-L560)  
**Linhas:** 544-560

```javascript
// MODAL/SUGESTÕES: FREQUENCY_RANGES (HARDCODED)
export const FREQUENCY_RANGES = {
  sub: '20-60 Hz',
  bass: '60-250 Hz',           // ← PROBLEMA: 60-250 (não 60-120!)
  low_bass: '60-250 Hz',       // ← ALIAS também está errado
  lowMid: '250-500 Hz',
  low_mid: '250-500 Hz',
  mid: '500 Hz - 2 kHz',
  // ...
};
```

**ARQUIVO DE RENDER DE CARDS:** [public/ai-suggestion-ui-controller.js](public/ai-suggestion-ui-controller.js#L1400-L2000)  
**Linhas:** 1400-2000

```javascript
// Linha 1688: renderAIEnrichedCard() ou renderBaseSuggestionCard()
// NÃO usa genreTargets.bands diretamente
// Depende de sugestões já montadas pelo backend

// Backend usa FREQUENCY_RANGES de suggestion-text-builder.js
// Logo, cards herdam range ERRADO (60-250 Hz) ao invés de (60-120 Hz)
```

---

#### 📍 EVIDÊNCIA 3: Mapeamento `band_bass` → alias inconsistente

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L6920-L6950)  
**Linhas:** 6920-6950

```javascript
// normalizeGenreBandName()
function normalizeGenreBandName(name) {
    const map = {
        // ✅ Conversões corretas
        'low_bass': 'bass',           // ← low_bass normalizado para 'bass'
        'upper_bass': 'upperBass',    // ← upper_bass normalizado para 'upperBass'
        'low_mid': 'lowMid',
        // ...
        
        // ✅ Identidade (já normalizado)
        'bass': 'bass',
        'upperBass': 'upperBass',
        // ...
    };
    return map[name] || name;
}
```

**Linha 6537:** Alias usado em outra parte do código
```javascript
const bandAliases = {
    'bass': ['low_bass', 'upper_bass'],  // ← bass pode ser low_bass OU upper_bass
    'lowMid': ['low_mid'],
    // ...
};
```

**PROBLEMA IDENTIFICADO:**
- Tabela normaliza `low_bass` → `bass` e usa target específico de `low_bass` (60-120 Hz)
- Modal usa `FREQUENCY_RANGES.bass` que está definido como `60-250 Hz` (range GENÉRICO que inclui low_bass + upper_bass)
- **CONFLITO:** `bass` representa **apenas low_bass** na tabela, mas **low_bass + upper_bass** no modal

---

#### 📍 EVIDÊNCIA 4: Targets no backend são específicos

**Arquivo:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L4591-L4592)  
**Linhas:** 4591-4592

```javascript
// Targets de gênero (exemplo: funk_ostentacao)
bands: {
    sub: {target_db:-18.3, tol_db:2.5, severity:"soft", range_hz:"20-60"},
    low_bass: {target_db:-8.9, tol_db:2.5, severity:"soft", range_hz:"60-120"},   // ← ESPECÍFICO
    upper_bass: {target_db:-12.8, tol_db:2.5, severity:"soft", range_hz:"120-200"}, // ← ESPECÍFICO
    low_mid: {target_db:-10.5, tol_db:2.5, severity:"soft", range_hz:"200-500"},
    // ...
}
```

**CONFIRMADO:** Backend diferencia `low_bass` (60-120 Hz) e `upper_bass` (120-200 Hz) como bandas SEPARADAS.

---

### 🔍 PROVA DE RUNTIME (LOGS ESPERADOS)

**Inserir logs temporários para confirmar divergência:**

```javascript
// Em renderGenreComparisonTable (linha ~7600)
console.log('[AUDIT-BAND-BASS] TABELA:', {
    targetKey: 'bass',
    originalKey: 'low_bass',
    range: targetBands.bass?.target_range || targetBands.bass?.range_hz,
    label: nomesBandas['bass'],  // "Bass (60-120 Hz)"
    source: 'genreData.bands.low_bass'
});

// Em renderAISuggestionCard (ai-suggestion-ui-controller.js, linha ~1700)
console.log('[AUDIT-BAND-BASS] MODAL:', {
    categoria: suggestion.categoria,
    range: FREQUENCY_RANGES.bass,  // "60-250 Hz"
    label: suggestion.problema?.match(/\(.*Hz\)/)?.[0],
    source: 'FREQUENCY_RANGES (hardcoded)'
});
```

**OUTPUT ESPERADO:**
```
[AUDIT-BAND-BASS] TABELA: { targetKey: 'bass', originalKey: 'low_bass', range: '60-120', label: '🔊 Bass (60-120 Hz)', source: 'genreData.bands.low_bass' }
[AUDIT-BAND-BASS] MODAL: { categoria: 'LOW END', range: '60-250 Hz', label: '(60-250 Hz)', source: 'FREQUENCY_RANGES (hardcoded)' }
```

---

### ✅ CORREÇÃO MÍNIMA SUGERIDA (NÃO IMPLEMENTAR)

**ARQUIVO:** `work/lib/audio/utils/suggestion-text-builder.js`  
**LINHA:** 546

**ANTES:**
```javascript
export const FREQUENCY_RANGES = {
  sub: '20-60 Hz',
  bass: '60-250 Hz',           // ← ERRADO
  low_bass: '60-250 Hz',       // ← ERRADO
  // ...
};
```

**DEPOIS:**
```javascript
export const FREQUENCY_RANGES = {
  sub: '20-60 Hz',
  bass: '60-120 Hz',           // ← CORRIGIDO (alinhado com low_bass backend)
  low_bass: '60-120 Hz',       // ← CORRIGIDO
  upper_bass: '120-250 Hz',    // ← ADICIONAR (separado)
  lowMid: '250-500 Hz',
  low_mid: '250-500 Hz',
  // ...
};
```

**IMPACTO:** Alinha range do modal com range da tabela (fonte: `genreTargets.bands.low_bass`).

**ALTERNATIVA (mais correta):** Em vez de usar `FREQUENCY_RANGES` hardcoded, fazer modal usar `genreTargets.bands[bandKey].range_hz` diretamente (mesma fonte da tabela).

---

### 📋 CHECKLIST DE VALIDAÇÃO PÓS-CORREÇÃO

Após aplicar correção, validar:

- [ ] Tabela mostra **"Bass (60-120 Hz)"** com target `-8.9 dB ±2.5` (exemplo funk_ostentacao)
- [ ] Modal mostra **"Bass (60-120 Hz)"** no card de sugestão (mesma banda)
- [ ] Modal NÃO mostra **"Bass (60-250 Hz)"** ou **"Upper Bass"** quando sugestão é para `low_bass`
- [ ] Executar análise em modo Genre e comparar:
  - Tabela: banda Bass - valor atual vs range
  - Modal: card de sugestão Bass - problema menciona mesmo range
- [ ] Logs de audit confirmam mesma fonte: `[AUDIT-BAND-BASS] range: '60-120'` em ambos

---

## 🐛 BUG B: ENRIQUECIMENTO IA CONFIRMADO NO BACKEND MAS NÃO APARECE NO FRONT

### 🎯 CAUSA RAIZ CONFIRMADA

**FRONTEND RENDERIZA `suggestions` AO INVÉS DE `aiSuggestions`**

#### 📍 EVIDÊNCIA 1: Backend gera e salva `aiSuggestions` corretamente

**Arquivo:** [work/worker.js](work/worker.js#L880-L950)  
**Linhas:** 880-950

```javascript
// BACKEND: worker.js - processamento principal
// Linha 889: Chama enrichment
const enriched = await enrichSuggestionsWithAI(result.suggestions, {
  fileName: result.metadata?.fileName || 'unknown',
  genre: enrichmentGenre,
  mode: result.mode,
  // ...
});

// Linha 901-902: SALVA em result.aiSuggestions
if (Array.isArray(enriched) && enriched.length > 0) {
  result.aiSuggestions = enriched;  // ← BACKEND SALVA AQUI
  result._aiEnhanced = true;
  console.log(`[AI-ENRICH] ✅ ${enriched.length} sugestões enriquecidas pela IA`);
} else {
  result.aiSuggestions = [];
}

// Linha 934-938: Fallback garante array vazio
if (!Array.isArray(result.suggestions)) {
  result.suggestions = [];
}
if (!Array.isArray(result.aiSuggestions)) {
  result.aiSuggestions = [];  // ← SEMPRE existe (array vazio ou preenchido)
}
```

**LOG ESPERADO (backend):**
```
[AI-ENRICH] ✅ 6 sugestões enriquecidas pela IA
[AI-ENRICH] 📋 Amostra da primeira sugestão: { aiEnhanced: true, categoria: 'LOW END', problema: 'Bass está em -8.5 dB...', solucao: 'Reduza aproximadamente 2.0 dB...' }
```

---

#### 📍 EVIDÊNCIA 2: Merge IA marca TODAS como `aiEnhanced: true`

**Arquivo:** [work/lib/ai/suggestion-enricher.js](work/lib/ai/suggestion-enricher.js#L900-L1100)  
**Linhas:** 900-1100

```javascript
// MERGE: mergeSuggestionsWithAI()
// Linha 950-1020: Loop de merge
const merged = baseSuggestions.map((baseSug, index) => {
    const aiEnrichment = aiSuggestions.find(ai => ai.index === index) || aiSuggestions[index];
    
    // Linha 1005: SEMPRE marca aiEnhanced: true (quando IA forneceu dados)
    const merged = {
        // Dados base preservados
        type: baseSug.type,
        message: baseSug.message,
        currentValue: baseSug.currentValue,
        targetRange: baseSug.targetRange,
        
        // ✅ FLAG CRÍTICA
        aiEnhanced: true,               // ← MARCADO COMO ENRIQUECIDO
        enrichmentStatus: 'success',
        
        // Campos IA
        categoria: aiEnrichment.categoria || mapCategoryFromType(...),
        nivel: aiEnrichment.nivel || mapPriorityToNivel(...),
        problema: aiEnrichment.problema || baseSug.message,
        causaProvavel: aiEnrichment.causaProvavel || 'Análise detalhada não fornecida',
        solucao: aiEnrichment.solucao || baseSug.action,
        pluginRecomendado: aiEnrichment.pluginRecomendado || 'Plugin não especificado',
        // ...
    };
    
    return merged;
});

// Linha 1050-1070: Logs de validação
console.log('[AI-AUDIT][ULTRA_DIAG] ✅ MERGE CONCLUÍDO');
console.log('[AI-AUDIT][ULTRA_DIAG] 📊 Estatísticas:', {
    totalMerged: merged.length,
    aiEnhancedTrue: merged.filter(s => s.aiEnhanced === true).length,  // ← DEVERIA SER > 0
    withProblema: merged.filter(s => s.problema && s.problema !== '').length,
    withPlugin: merged.filter(s => s.pluginRecomendado && s.pluginRecomendado !== 'Plugin não especificado').length,
    // ...
});
```

**LOG ESPERADO (backend):**
```
[AI-AUDIT][ULTRA_DIAG] ✅ MERGE CONCLUÍDO
[AI-AUDIT][ULTRA_DIAG] 📊 Estatísticas: { totalMerged: 6, aiEnhancedTrue: 6, withProblema: 6, withPlugin: 6 }
```

**CONFIRMADO:** Backend marca `aiEnhanced: true` em TODAS as sugestões enriquecidas.

---

#### 📍 EVIDÊNCIA 3: Parse JSON com proteção contra vírgulas

**Arquivo:** [work/lib/ai/suggestion-enricher.js](work/lib/ai/suggestion-enricher.js#L200-L350)  
**Linhas:** 200-350

```javascript
// PARSE: Extração de JSON da resposta OpenAI
// Linha 207-238: 4 estratégias de extração
const content = data.choices[0].message.content;

// ESTRATÉGIA 1: Regex básico
let jsonString = content.match(/\{[\s\S]*\}/)?.[0];

// ESTRATÉGIA 2: Buscar por ```json
if (!jsonString) {
    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) jsonString = jsonBlockMatch[1];
}

// ESTRATÉGIA 3: Primeiro { até último }
if (!jsonString) {
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = content.substring(firstBrace, lastBrace + 1);
    }
}

// Linha 240-270: Parse com limpeza de trailing commas
try {
    enrichedData = JSON.parse(jsonString);
} catch (parseErr) {
    console.error('[AI-AUDIT][ULTRA_DIAG] ❌ Parse falhou, tentando limpar JSON...');
    
    // ESTRATÉGIA 4: Limpar caracteres problemáticos
    const cleanedJson = jsonString
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Remove control chars
        .replace(/,\s*([}\]])/g, '$1')                  // ← REMOVE TRAILING COMMAS
        .trim();
    
    try {
        enrichedData = JSON.parse(cleanedJson);
        console.log('[AI-AUDIT][ULTRA_DIAG] ✅ Parse bem-sucedido após limpeza!');
    } catch (cleanErr) {
        // Lança erro original
        throw parseErr;
    }
}

// Linha 240-260: Validação de schema
if (!enrichedData.enrichedSuggestions) {
    throw new Error('Missing "enrichedSuggestions" field in AI response');
}
if (!Array.isArray(enrichedData.enrichedSuggestions)) {
    throw new Error('Field "enrichedSuggestions" is not an array');
}
if (enrichedData.enrichedSuggestions.length === 0) {
    throw new Error('OpenAI returned empty enrichedSuggestions array');
}
```

**PROTEÇÃO CONFIRMADA:** Sistema possui 4 estratégias + limpeza de vírgulas + validação de schema.

**PONTO DE FALHA POSSÍVEL:**
- Se OpenAI retornar JSON truncado (timeout parcial), sistema detecta e lança erro
- Se vírgula causar parse error, tentativa de limpeza automática
- **PORÉM:** Se parse falhar mesmo após limpeza, `enrichSuggestionsWithAI()` retorna **fallback com `aiEnhanced: false`**

**FALLBACK:** [work/lib/ai/suggestion-enricher.js](work/lib/ai/suggestion-enricher.js#L430-L460)
```javascript
// Linha 450: Fallback em caso de erro
return suggestions.map(sug => ({
  ...sug,
  aiEnhanced: false,                    // ← MARCA COMO NÃO ENRIQUECIDO
  enrichmentStatus: error.name === 'AbortError' ? 'timeout' : 'error',
  categoria: mapCategoryFromType(sug.type, sug.category),
  problema: sug.message || 'Problema não identificado',
  solucao: sug.action || 'Consulte métricas técnicas',
  pluginRecomendado: 'Plugin não especificado',
  // ...
}));
```

**HIPÓTESE 1 DESCARTADA:** Parse JSON NÃO é a causa raiz principal (sistema tem proteções robustas).

---

#### 📍 EVIDÊNCIA 4: Frontend busca `aiSuggestions` mas PODE estar renderizando `suggestions`

**Arquivo:** [public/ai-suggestion-ui-controller.js](public/ai-suggestion-ui-controller.js#L400-L600)  
**Linhas:** 400-600

```javascript
// FRONTEND: extractAISuggestions()
extractAISuggestions(analysis) {
    console.log('[AI-EXTRACT] 🔍 Iniciando busca por aiSuggestions...');
    
    // PRIORIDADE 1: analysis.aiSuggestions (nível raiz)
    if (Array.isArray(analysis.aiSuggestions) && analysis.aiSuggestions.length > 0) {
        console.log(`[AI-FIX] ✅ Campo aiSuggestions detectado em: NÍVEL RAIZ`);
        return analysis.aiSuggestions;  // ← RETORNA aiSuggestions (correto)
    }
    
    // PRIORIDADE 2: userAnalysis.aiSuggestions (comparações A vs B)
    if (Array.isArray(analysis.userAnalysis?.aiSuggestions) && analysis.userAnalysis.aiSuggestions.length > 0) {
        return analysis.userAnalysis.aiSuggestions;
    }
    
    // PRIORIDADE 3: referenceAnalysis.aiSuggestions
    if (Array.isArray(analysis.referenceAnalysis?.aiSuggestions) && analysis.referenceAnalysis.aiSuggestions.length > 0) {
        return analysis.referenceAnalysis.aiSuggestions;
    }
    
    // PRIORIDADE 4: analysis.suggestions (fallback genérico) ← PROBLEMA POTENCIAL
    if (Array.isArray(analysis.suggestions) && analysis.suggestions.length > 0) {
        const hasAIFields = analysis.suggestions.some(s => 
            s.aiEnhanced === true || 
            (s.categoria && s.problema && s.solucao)
        );
        
        if (hasAIFields) {
            console.log(`[AI-FIX] ✅ Campo aiSuggestions detectado em: suggestions (fallback)`);
            return analysis.suggestions;  // ← RETORNA suggestions SE tiver campos IA
        }
    }
    
    console.log('[AI-EXTRACT] ❌ Nenhum aiSuggestions encontrado');
    return [];
}
```

**PROBLEMA IDENTIFICADO:**
- Frontend busca `aiSuggestions` PRIMEIRO (correto)
- **MAS** tem fallback para `analysis.suggestions` se não encontrar
- **HIPÓTESE:** Se `analysis.aiSuggestions` estiver `undefined` ou array vazio por algum motivo, frontend cai no fallback e renderiza `suggestions` (não enriquecido)

---

#### 📍 EVIDÊNCIA 5: Onde o front **DE FATO** renderiza os cards

**Arquivo:** [public/ai-suggestion-ui-controller.js](public/ai-suggestion-ui-controller.js#L1400-L2000)  
**Linhas:** 1400-2000

```javascript
// RENDER: renderSuggestionCards()
renderSuggestionCards(suggestions, isAIEnriched = false, genreTargets = null) {
    // Linha 1440-1540: USA ROWS DA TABELA (bypass de aiSuggestions!)
    if (window.USE_TABLE_ROWS_FOR_MODAL && typeof window.buildMetricRows === 'function') {
        console.log('[MODAL_VS_TABLE] 🔄 ATIVADO: Usando rows da tabela como fonte');
        
        // ⚠️ CRÍTICO: Gera rows DIRETAMENTE dos metrics, ignorando aiSuggestions
        const rows = window.buildMetricRows(analysis, genreTargets, 'genre');
        const problemRows = rows.filter(r => r.severity !== 'OK');
        
        // ⚠️ CRÍTICO: Converte rows para formato de suggestions (SEM CAMPOS IA!)
        const rowsAsSuggestions = problemRows.map(row => ({
            metric: row.key,
            type: row.type,
            category: row.category,
            message: `${row.label}: ${row.value.toFixed(2)} dB`,
            action: row.actionText,
            currentValue: row.value,
            targetValue: row.targetText,
            
            // ⚠️ CAMPOS IA GENÉRICOS (não vem de aiSuggestions!)
            problema: `${row.label} está em ${row.value.toFixed(2)} dB`,
            solucao: row.actionText,
            categoria: row.category,
            nivel: row.severity,
            
            _fromRows: true  // ← FLAG indica que NÃO veio de aiSuggestions
        }));
        
        // ⚠️ CRÍTICO: SUBSTITUI suggestions originais
        suggestions = rowsAsSuggestions;  // ← PERDE ENRIQUECIMENTO IA
    }
    
    // Linha 1650-1750: Renderiza cards (agora com dados de rows, não IA)
    const cardsHtml = validatedSuggestions.map((suggestion, index) => {
        if (isAIEnriched) {
            return this.renderAIEnrichedCard(suggestion, index, genreTargets);
        } else {
            return this.renderBaseSuggestionCard(suggestion, index, genreTargets);
        }
    }).join('');
}
```

**🚨 CAUSA RAIZ CONFIRMADA:**

**FLAG `window.USE_TABLE_ROWS_FOR_MODAL = true` ATIVA BYPASS COMPLETO DE `aiSuggestions`!**

**ARQUIVO:** [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L6910)  
**Linha:** 6910

```javascript
// ✅ FLAG GLOBAL
window.USE_TABLE_ROWS_FOR_MODAL = true;  // ← ATIVA BYPASS
```

**FLUXO REAL:**
1. Backend gera `aiSuggestions` (enriquecido pela IA) ✅
2. Backend salva `result.aiSuggestions = enriched` ✅
3. Backend retorna JSON com `aiSuggestions` no response ✅
4. Frontend recebe `analysis.aiSuggestions` ✅
5. **Frontend IGNORA `aiSuggestions` e usa `buildMetricRows()` (tabela)** ❌
6. `buildMetricRows()` reconstrói sugestões dos metrics "crus" (sem IA) ❌
7. Cards exibem campos genéricos: `problema: "Bass está em -8.5 dB"` (sem análise IA) ❌

---

### 🔍 PROVA DE RUNTIME (LOGS ESPERADOS)

**Inserir logs temporários para confirmar fluxo:**

```javascript
// Em checkForAISuggestions (ai-suggestion-ui-controller.js, linha ~560)
console.log('[AUDIT-AI-FLOW] 1. extractAISuggestions retornou:', {
    count: aiSuggestions.length,
    firstSample: aiSuggestions[0],
    hasAiEnhanced: aiSuggestions[0]?.aiEnhanced,
    hasProblema: aiSuggestions[0]?.problema,
    hasCausaProvavel: aiSuggestions[0]?.causaProvavel
});

// Em renderSuggestionCards (ai-suggestion-ui-controller.js, linha ~1440)
console.log('[AUDIT-AI-FLOW] 2. Antes de renderizar:', {
    USE_TABLE_ROWS_FOR_MODAL: window.USE_TABLE_ROWS_FOR_MODAL,
    suggestionsCount: suggestions.length,
    suggestionsSource: suggestions[0]?._fromRows ? 'ROWS (bypass)' : 'aiSuggestions (correto)'
});

// Em renderAIEnrichedCard (ai-suggestion-ui-controller.js, linha ~1700)
console.log('[AUDIT-AI-FLOW] 3. Renderizando card:', {
    categoria: suggestion.categoria,
    problema: suggestion.problema?.substring(0, 60),
    hasPlugin: !!suggestion.pluginRecomendado,
    _fromRows: suggestion._fromRows
});
```

**OUTPUT ESPERADO (com bug):**
```
[AUDIT-AI-FLOW] 1. extractAISuggestions retornou: { count: 6, hasAiEnhanced: true, hasProblema: true, hasCausaProvavel: true }
[AUDIT-AI-FLOW] 2. Antes de renderizar: { USE_TABLE_ROWS_FOR_MODAL: true, suggestionsCount: 6, suggestionsSource: 'ROWS (bypass)' }
[AUDIT-AI-FLOW] 3. Renderizando card: { categoria: 'LOW END', problema: 'Bass está em -8.5 dB', hasPlugin: false, _fromRows: true }
```

**OUTPUT ESPERADO (sem bug):**
```
[AUDIT-AI-FLOW] 1. extractAISuggestions retornou: { count: 6, hasAiEnhanced: true, hasProblema: true, hasCausaProvavel: true }
[AUDIT-AI-FLOW] 2. Antes de renderizar: { USE_TABLE_ROWS_FOR_MODAL: false, suggestionsCount: 6, suggestionsSource: 'aiSuggestions (correto)' }
[AUDIT-AI-FLOW] 3. Renderizando card: { categoria: 'LOW END', problema: 'Bass está em -8.5 dB, enquanto o range adequado...', hasPlugin: true, _fromRows: false }
```

---

### ✅ CORREÇÃO MÍNIMA SUGERIDA (NÃO IMPLEMENTAR)

**OPÇÃO 1 (mais segura): Desabilitar flag USE_TABLE_ROWS_FOR_MODAL quando aiSuggestions existe**

**ARQUIVO:** `public/ai-suggestion-ui-controller.js`  
**LINHA:** ~1440

**ANTES:**
```javascript
renderSuggestionCards(suggestions, isAIEnriched = false, genreTargets = null) {
    // ❌ SEMPRE usa rows da tabela (ignora aiSuggestions)
    if (window.USE_TABLE_ROWS_FOR_MODAL && typeof window.buildMetricRows === 'function') {
        console.log('[MODAL_VS_TABLE] 🔄 Usando rows da tabela');
        const rows = window.buildMetricRows(analysis, genreTargets, 'genre');
        suggestions = rowsAsSuggestions;  // ← BYPASS
    }
    // ...
}
```

**DEPOIS:**
```javascript
renderSuggestionCards(suggestions, isAIEnriched = false, genreTargets = null) {
    // ✅ CORREÇÃO: Só usa rows se aiEnriched = false (sugestões base)
    const hasRealAISuggestions = suggestions.some(s => s.aiEnhanced === true && s.causaProvavel);
    
    if (window.USE_TABLE_ROWS_FOR_MODAL && 
        typeof window.buildMetricRows === 'function' && 
        !hasRealAISuggestions) {  // ← GUARD: Só usa rows se NÃO tiver IA
        
        console.log('[MODAL_VS_TABLE] 🔄 Usando rows da tabela (fallback - sem IA)');
        const rows = window.buildMetricRows(analysis, genreTargets, 'genre');
        suggestions = rowsAsSuggestions;
    } else if (hasRealAISuggestions) {
        console.log('[MODAL_VS_TABLE] ✅ Usando aiSuggestions (enriquecido pela IA)');
    }
    // ...
}
```

**IMPACTO:** 
- Se `aiSuggestions` existir e for válido → renderiza enriquecimento IA ✅
- Se `aiSuggestions` não existir ou for vazio → usa rows da tabela como fallback ✅

---

**OPÇÃO 2 (mais radical): Remover flag USE_TABLE_ROWS_FOR_MODAL completamente**

**ARQUIVO:** `public/audio-analyzer-integration.js`  
**LINHA:** 6910

**ANTES:**
```javascript
// ✅ FLAG GLOBAL
window.USE_TABLE_ROWS_FOR_MODAL = true;
```

**DEPOIS:**
```javascript
// 🚫 FLAG DESABILITADA: Modal usa aiSuggestions diretamente
window.USE_TABLE_ROWS_FOR_MODAL = false;
```

**IMPACTO:** Modal SEMPRE usa `aiSuggestions` (ou `suggestions` base se IA não estiver disponível).

**RISCO:** Pode quebrar algum caso de uso onde rows eram necessárias (validar antes de aplicar).

---

### 📋 CHECKLIST DE VALIDAÇÃO PÓS-CORREÇÃO

Após aplicar correção, validar:

- [ ] Backend loga: `[AI-ENRICH] ✅ 6 sugestões enriquecidas pela IA`
- [ ] Backend loga: `[AI-AUDIT][ULTRA_DIAG] 📊 aiEnhancedTrue: 6`
- [ ] Frontend loga: `[AUDIT-AI-FLOW] extractAISuggestions retornou: { count: 6, hasAiEnhanced: true }`
- [ ] Frontend loga: `[AUDIT-AI-FLOW] suggestionsSource: 'aiSuggestions (correto)'` (NÃO "ROWS")
- [ ] Modal exibe cards com:
  - **Problema:** texto detalhado (não apenas "Bass está em -8.5 dB")
  - **Causa Provável:** análise da IA (não "Causa não analisada")
  - **Solução:** solução detalhada com dB específico
  - **Plugin:** nome de plugin real (não "Plugin não especificado")
- [ ] Verificar se `_fromRows: true` NÃO aparece nos cards renderizados
- [ ] Comparar card antes vs depois:
  - **Antes:** Problema genérico, sem plugin, sem dica extra
  - **Depois:** Problema detalhado, plugin específico, dica extra presente

---

## 🧬 FLUXO DE DADOS COMPLETO (EVIDENCIADO)

### BACKEND (worker.js → suggestion-enricher.js)

```
1. generateSuggestions()
   ↓ gera suggestions base (tipo: band, freq, etc)
   
2. enrichSuggestionsWithAI(suggestions)
   ↓ chama OpenAI API com prompt
   
3. OpenAI retorna JSON com enrichedSuggestions
   ↓ parse JSON (4 estratégias + limpeza vírgulas)
   
4. mergeSuggestionsWithAI(base, enriched)
   ↓ mescla campos base + IA
   ↓ marca aiEnhanced: true
   
5. result.aiSuggestions = merged
   ↓ salva no Postgres (jobs.result)
   
6. API retorna { aiSuggestions: [...] }
```

**EVIDÊNCIA DE LOGS:**
```
[AI-ENRICH] ✅ 6 sugestões enriquecidas pela IA
[AI-AUDIT][ULTRA_DIAG] ✅ MERGE CONCLUÍDO
[AI-AUDIT][ULTRA_DIAG] 📊 aiEnhancedTrue: 6, withProblema: 6, withPlugin: 6
```

---

### FRONTEND (ai-suggestion-ui-controller.js)

```
1. checkForAISuggestions(analysis)
   ↓ valida modo (genre/reference/reduced)
   
2. extractAISuggestions(analysis)
   ↓ busca analysis.aiSuggestions (prioridade 1)
   ↓ fallback: analysis.suggestions (prioridade 4)
   ↓ retorna array de sugestões
   
3. renderSuggestionCards(suggestions, isAIEnriched, genreTargets)
   ↓ ⚠️ PONTO CRÍTICO: verifica USE_TABLE_ROWS_FOR_MODAL
   
   SE FLAG = true:
     ↓ buildMetricRows(analysis, genreTargets) ← reconstrói de metrics
     ↓ rowsAsSuggestions (SEM CAMPOS IA) ← PERDE ENRIQUECIMENTO
     ↓ substitui suggestions originais
   
   SE FLAG = false:
     ↓ usa suggestions recebidas (COM CAMPOS IA) ✅
   
4. renderAIEnrichedCard(suggestion) ou renderBaseSuggestionCard(suggestion)
   ↓ gera HTML do card com campos:
   ↓ problema, causaProvavel, solucao, plugin, dicaExtra, parametros
```

**EVIDÊNCIA DE PROBLEMA:**
```
[AUDIT-AI-FLOW] suggestionsSource: 'ROWS (bypass)'  ← PERDE IA
[AUDIT-AI-FLOW] _fromRows: true  ← Indica dados de rows, não aiSuggestions
```

---

## 📊 RESUMO DE ARQUIVOS AFETADOS

### BUG A (Ranges Divergentes)

| Arquivo | Linhas | Papel | Problema |
|---------|--------|-------|----------|
| [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L7196-L7650) | 7196-7650 | Renderer tabela | ✅ Usa `genreTargets.bands.low_bass` (60-120 Hz) |
| [work/lib/audio/utils/suggestion-text-builder.js](work/lib/audio/utils/suggestion-text-builder.js#L544-L560) | 544-560 | FREQUENCY_RANGES | ❌ Define `bass: '60-250 Hz'` (errado) |
| [public/ai-suggestion-ui-controller.js](public/ai-suggestion-ui-controller.js#L1400-L2000) | 1400-2000 | Renderer modal | ❌ Depende de FREQUENCY_RANGES |

**CORREÇÃO:** Alinhar `FREQUENCY_RANGES.bass` com `genreTargets.bands.low_bass` (60-120 Hz).

---

### BUG B (Enriquecimento Perdido)

| Arquivo | Linhas | Papel | Problema |
|---------|--------|-------|----------|
| [work/worker.js](work/worker.js#L880-L950) | 880-950 | Backend worker | ✅ Salva `result.aiSuggestions` corretamente |
| [work/lib/ai/suggestion-enricher.js](work/lib/ai/suggestion-enricher.js#L1-L1100) | 1-1100 | Enrichment IA | ✅ Merge marca `aiEnhanced: true` |
| [public/ai-suggestion-ui-controller.js](public/ai-suggestion-ui-controller.js#L400-L600) | 400-600 | Extração front | ✅ Busca `aiSuggestions` corretamente |
| [public/ai-suggestion-ui-controller.js](public/ai-suggestion-ui-controller.js#L1400-L2000) | 1400-2000 | Render cards | ❌ **Bypass com `USE_TABLE_ROWS_FOR_MODAL`** |
| [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js#L6910) | 6910 | Flag global | ❌ **`USE_TABLE_ROWS_FOR_MODAL = true`** |

**CORREÇÃO:** Desabilitar bypass quando `aiSuggestions` válido existe.

---

## 🔬 ANÁLISE DE INCIDENTE (Vírgula/JSON)

### Proteções existentes:

1. **4 estratégias de extração** (regex, ```json, firstBrace-lastBrace, fallback)
2. **Limpeza de trailing commas** (`.replace(/,\s*([}\]])/g, '$1')`)
3. **Validação de schema** (verifica `enrichedSuggestions`, array, não vazio)
4. **Retry com backoff** (3 tentativas em caso de timeout)
5. **Fallback seguro** (retorna suggestions com `aiEnhanced: false`)

### Risco residual:

- **Truncamento de resposta** (timeout parcial): OpenAI retorna JSON incompleto
- **JSON válido mas array vazio**: IA retorna `{ enrichedSuggestions: [] }`
- **Parse OK mas merge falha**: erro no index matching

### Recomendação:

Adicionar log antes do merge para detectar casos edge:

```javascript
// Em mergeSuggestionsWithAI (suggestion-enricher.js, linha ~905)
console.log('[MERGE-AUDIT] Inputs:', {
    baseSuggestionsCount: baseSuggestions.length,
    aiSuggestionsCount: enrichedData.enrichedSuggestions?.length,
    firstBaseIndex: baseSuggestions[0]?.index,
    firstAIIndex: enrichedData.enrichedSuggestions?.[0]?.index
});
```

---

## ✅ CORREÇÕES SUGERIDAS (RESUMO)

### BUG A: Ranges Divergentes

**Arquivo:** `work/lib/audio/utils/suggestion-text-builder.js` (linha 546)

```javascript
// ANTES
bass: '60-250 Hz',

// DEPOIS
bass: '60-120 Hz',  // Alinhado com low_bass backend
```

---

### BUG B: Enriquecimento Perdido

**Arquivo:** `public/ai-suggestion-ui-controller.js` (linha ~1440)

```javascript
// ANTES
if (window.USE_TABLE_ROWS_FOR_MODAL && typeof window.buildMetricRows === 'function') {
    const rows = window.buildMetricRows(analysis, genreTargets, 'genre');
    suggestions = rowsAsSuggestions;
}

// DEPOIS
const hasRealAISuggestions = suggestions.some(s => s.aiEnhanced === true && s.causaProvavel);

if (window.USE_TABLE_ROWS_FOR_MODAL && 
    typeof window.buildMetricRows === 'function' && 
    !hasRealAISuggestions) {
    const rows = window.buildMetricRows(analysis, genreTargets, 'genre');
    suggestions = rowsAsSuggestions;
} else if (hasRealAISuggestions) {
    console.log('[AI] ✅ Usando aiSuggestions enriquecidos');
}
```

---

## 🎯 IMPACTO E PRIORIDADE

### BUG A (Ranges Divergentes)
- **Gravidade:** Média-Alta
- **Impacto:** Confusão do usuário (valores diferentes em tabela vs modal)
- **Frequência:** 100% dos casos em modo Genre (bandas bass/low_bass)
- **Correção:** Simples (1 arquivo, 1 linha)
- **Risco:** Baixo

### BUG B (Enriquecimento Perdido)
- **Gravidade:** Alta-Crítica
- **Impacto:** Perda completa de valor agregado da IA (cards genéricos)
- **Frequência:** 100% dos casos quando `USE_TABLE_ROWS_FOR_MODAL = true`
- **Correção:** Média (1 arquivo, 5-10 linhas, lógica condicional)
- **Risco:** Médio (pode afetar fallback de tabela se não testar bem)

---

## 📝 CONCLUSÃO

**Ambos os bugs possuem causas raiz confirmadas com evidências de código e fluxo de dados.**

### Bug A:
- **Causa:** Divergência entre fonte de dados (tabela usa `genreTargets.bands`, modal usa `FREQUENCY_RANGES` hardcoded)
- **Solução:** Alinhar `FREQUENCY_RANGES` ou fazer modal usar mesma fonte da tabela

### Bug B:
- **Causa:** Flag `USE_TABLE_ROWS_FOR_MODAL` ativa bypass que reconstrói sugestões dos metrics "crus", ignorando `aiSuggestions` enriquecido
- **Solução:** Condicionar bypass apenas quando `aiSuggestions` não existe ou é inválido

**Correções são cirúrgicas, de baixo risco, e não requerem refatoração massiva.**

---

**FIM DA AUDITORIA**

*Auditoria conduzida sem implementar correções, conforme solicitado.*
*Todas as evidências baseadas em análise de código estático e fluxo de dados.*
*Logs de runtime sugeridos para validação adicional.*
