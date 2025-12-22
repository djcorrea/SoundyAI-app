# 🚨 ROOT CAUSE: Inconsistência Tabela vs Sugestões

## PROBLEMA IDENTIFICADO

### Sintoma
- **Tabela**: Mostra 8-10 métricas fora do alvo (ATENÇÃO/CRÍTICA)
- **Modal**: Renderiza apenas 1-2 sugestões

### Root Cause Confirmado

1. **Backend gera sugestões por CATEGORIA, não por MÉTRICA individual:**
   ```javascript
   // work/lib/audio/features/problems-suggestions-v2.js
   this.analyzeLUFS()              // 1 sugestão
   this.analyzeTruePeak()          // 1 sugestão  
   this.analyzeDynamicRange()      // 1 sugestão
   this.analyzeStereoMetrics()     // 1 sugestão
   this.analyzeSpectralBands()     // 1 sugestão TOTAL (não 1 por banda!)
   // Total: 5 sugestões máximo
   ```

2. **Tabela renderiza linha INDIVIDUAL para cada métrica:**
   - LUFS
   - True Peak
   - Dynamic Range
   - LRA
   - Stereo Width
   - Sub (20-60 Hz)
   - Bass (60-120 Hz)
   - Upper Bass (120-250 Hz)
   - Low Mid (250-500 Hz)
   - Mid (500-2k Hz)
   - High Mid (2k-4k Hz)
   - Presence (10k-20k Hz)
   - Air (4k-10k Hz)
   
   **Total: até 13 linhas na tabela**

3. **analyzeSpectralBands() itera TODAS as bandas mas gera apenas UMA sugestão**:
   ```javascript
   // Linha 1055-1205 em problems-suggestions-v2.js
   Object.keys(bandTargets).forEach(bandKey => {
       // Calcula severity para CADA banda
       // MAS só adiciona UMA sugestão no final!
   });
   
   // Linha 1200: suggestions.push(suggestion) ← UMA VEZ APENAS
   ```

4. **Frontend SUBSTITUI array ao invés de mesclar:**
   ```javascript
   // Linha 15348 em audio-analyzer-integration.js
   analysis.suggestions = enrichedSuggestions; // ❌ SUBSTITUI
   ```

## FLUXO ATUAL (BUGADO)

```
Backend:
  analyze() → 5 sugestões (LUFS, TP, DR, Stereo, 1 banda agregada)
    ↓
Frontend filtro:
  5 → 3 (remove 2 OK) → filteredSuggestions
    ↓
ULTRA_V2 enriquece:
  3 → 3 enrichedSuggestions
    ↓
analysis.suggestions = enrichedSuggestions ← ❌ SUBSTITUI (perde contexto)
    ↓
Modal renderiza: 3 cards

Tabela renderiza: 10 linhas (6 métricas + 4 bandas fora do alvo)

DIVERGÊNCIA: 3 cards ≠ 10 linhas
```

## CORREÇÃO NECESSÁRIA

### Estratégia: Builder Unificado

1. **NÃO alterar backend** (mantém lógica educacional por categoria)
2. **Criar builder no frontend** que extrai dados da tabela
3. **Mesclar com backend** ao invés de substituir

### Implementação

```javascript
// APÓS renderGenreComparisonTable()
function buildSuggestionsFromTable(analysis, genreTargets, userMetrics) {
    const tableBasedSuggestions = [];
    
    // Para cada métrica NA TABELA com severity != OK
    // Gerar sugestão correspondente
    
    return tableBasedSuggestions;
}

// MESCLAR ao invés de substituir
const backendSuggestions = filteredSuggestions; // do backend
const tableSuggestions = buildSuggestionsFromTable(...);

// Mesclar por métrica (backend priority)
const merged = mergeSuggestionArrays(backendSuggestions, tableSuggestions);

analysis.suggestions = merged; // agora tem 1:1 com tabela
```

## LOGS DE AUDITORIA

```javascript
console.log('[AUDIT] Tabela renderizou:', {
    totalRows: rows.length,
    metricsCount,
    bandsCount,
    severityBreakdown: {
        ok: rows.filter(r => r.includes('severity-ok')).length,
        caution: rows.filter(r => r.includes('severity-caution')).length,
        critical: rows.filter(r => r.includes('severity-critical')).length
    }
});

console.log('[AUDIT] Sugestões disponíveis:', {
    backend: backendSuggestions.length,
    table: tableSuggestions.length,
    merged: merged.length,
    expected: rows.length - okCount
});

if (merged.length < expected) {
    console.error('[AUDIT] ❌ MISSING SUGGESTIONS:', {
        missing: expected - merged.length,
        tableKeys: extractedKeys,
        suggestionKeys: merged.map(s => s.metric)
    });
}
```

## EVIDÊNCIAS

### Arquivo comprometido 1: analyzeSpectralBands()
**Local**: work/lib/audio/features/problems-suggestions-v2.js:1055-1205

**Problema**: Itera todas as bandas mas gera UMA sugestão

### Arquivo comprometido 2: diagCard()
**Local**: public/audio-analyzer-integration.js:15348

**Problema**: `analysis.suggestions = enrichedSuggestions` substitui array

### Arquivo comprometido 3: enhanced-suggestion-engine.js
**Local**: work/lib/audio/features/enhanced-suggestion-engine.js:702

**Problema**: `filtered.slice(0, maxSuggestions)` limita artificialmente

## PRIORIDADE

🔴 **CRÍTICA** - Usuários veem tabela com muitos problemas mas modal mostra poucos cards
