# 🎯 PHASE 2: ROOT CAUSE AUDIT - DIVERGÊNCIA CRÍTICA ENCONTRADA

**Data:** 2025-01-XX  
**Status:** ✅ ROOT CAUSE CONFIRMADO  
**Severidade:** 🔴 CRÍTICA - Sistema NÃO está usando JSON filesystem corretamente

---

## 🔍 DESCOBERTA CRÍTICA

### ESTRUTURA REAL DO JSON
```json
{
  "tech_house": {                           // ← Nível 1: Wrapper do gênero
    "version": "v2_hybrid_safe",
    "hybrid_processing": {                  // ← Nível 2: Bloco experimental
      "original_metrics": {
        "lufs_integrated": -10.5,
        "true_peak_dbtp": -0.65,
        "dynamic_range": 8.5
      },
      "spectral_bands": {
        "sub": { "target_range": {-32, -25}, "target_db": -28.5 },
        "low_bass": { "target_range": {-31, -25}, "target_db": -28 },
        "upper_bass": { "target_range": {-33, -27}, "target_db": -30 }
      }
    },
    "legacy_compatibility": {               // ← Nível 2: Bloco CORRETO
      "lufs_target": -10.5,                // ✅ Formato esperado pelo loader
      "true_peak_target": -0.65,
      "dr_target": 8.5,
      "stereo_target": 0.915,
      "tol_lufs": 1.0,
      "bands": {
        "sub": { "target_db": -28.5, "tol_db": 0 },
        "low_bass": { "target_db": -28, "tol_db": 0 },
        "upper_bass": { "target_db": -30, "tol_db": 0 }
      }
    }
  }
}
```

---

## 🐛 PROBLEMA IDENTIFICADO

### genre-targets-loader.js LINHA 103
```javascript
const rawTargets = parsed[normalizedGenre] || parsed;
```

**O que acontece:**
1. `parsed` = JSON completo (objeto com chave "tech_house")
2. `parsed[normalizedGenre]` = `parsed["tech_house"]` = objeto com `hybrid_processing` + `legacy_compatibility`
3. `rawTargets` = `{ version: "v2_hybrid_safe", hybrid_processing: {...}, legacy_compatibility: {...} }`

### validateTargetsStructure LINHA 218
```javascript
const requiredFields = ['lufs_target', 'true_peak_target', 'dr_target', 'bands'];
for (const field of requiredFields) {
  if (targets[field] === undefined) {
    console.error(`[TARGETS] Campo obrigatório ausente: ${field}`);
    return false;
  }
}
```

**O que acontece:**
1. Busca `rawTargets.lufs_target` → ❌ **NÃO EXISTE** (está dentro de `legacy_compatibility`)
2. Busca `rawTargets.true_peak_target` → ❌ **NÃO EXISTE**
3. Busca `rawTargets.dr_target` → ❌ **NÃO EXISTE**
4. Busca `rawTargets.bands` → ❌ **NÃO EXISTE**
5. Validação **FALHA**
6. Sistema cai no **FALLBACK HARDCODED** (GENRE_THRESHOLDS)

---

## 💥 CONSEQUÊNCIA CRÍTICA

**O sistema NUNCA está usando os targets do filesystem JSON!**

Todos os valores exibidos (sugestões, tabela, PDF, score) vêm de `GENRE_THRESHOLDS` hardcoded em `problems-suggestions-v2.js`, NÃO do Tech House JSON criado com esmero.

### PROVA:
- Tech House JSON: `lufs_target: -10.5`
- GENRE_THRESHOLDS fallback: `lufs_target: -9.0` (valor default)
- Se sistema mostra `-9.0`, está usando fallback
- Se sistema mostra `-10.5`, está (miraculosamente) usando JSON

---

## 🔧 CORREÇÃO NECESSÁRIA

### Opção 1: Ler legacy_compatibility explicitamente (RECOMENDADO)
```javascript
// genre-targets-loader.js linha 103
const genreData = parsed[normalizedGenre] || parsed;
const rawTargets = genreData.legacy_compatibility || genreData.hybrid_processing || genreData;
```

**Lógica:**
1. Se JSON tem `legacy_compatibility`, usa esse bloco (PRIORIDADE)
2. Se não, tenta `hybrid_processing` (FALLBACK)
3. Se não, usa o objeto direto (FALLBACK FINAL)

### Opção 2: Achatar estrutura do JSON (NÃO RECOMENDADO)
Remover o wrapper `tech_house` e colocar `lufs_target` diretamente no nível raiz.

**Problema:** Quebra estrutura v2_hybrid_safe, perde metadados, força reprocessamento de todos os JSONs.

---

## 📊 IMPACTO NO SISTEMA

| Camada                | Lê de                      | Formato Recebido           | Status Atual          |
|-----------------------|----------------------------|----------------------------|-----------------------|
| **Loader**            | `parsed[normalizedGenre]`  | `{ hybrid_processing, legacy_compatibility }` | ❌ FALHA NA VALIDAÇÃO |
| **Fallback**          | GENRE_THRESHOLDS hardcoded | `{ lufs: {...}, bands: {...} }` | ✅ ATIVO (incorreto)  |
| **Suggestion Engine** | customTargets (do fallback)| Formato interno nested     | ✅ FUNCIONA (com valores errados) |
| **json-output.js**    | options.genreTargets (do fallback) | Formato interno nested | ⚠️ CONVERSÃO QUEBRADA |
| **Frontend (tabela)** | analysis.data.genreTargets | ❌ Objetos em vez de números | ❌ EXIBIÇÃO QUEBRADA  |
| **PDF**               | analysis.data.genreTargets | ❌ Objetos em vez de números | ❌ EXIBIÇÃO QUEBRADA  |

**Diagnóstico final:**
- Sistema está usando **fallback hardcoded** para TUDO
- JSON filesystem está sendo **completamente ignorado**
- Divergência não é entre blocos JSON, mas entre JSON vs hardcoded
- Sugestões, tabela, PDF, score: TODOS usam GENRE_THRESHOLDS

---

## ✅ PLANO DE CORREÇÃO

### FASE 1: Corrigir leitura do JSON (CRÍTICO)
**Arquivo:** `work/lib/audio/utils/genre-targets-loader.js`  
**Linha:** 103  
**Mudança:**
```javascript
// ❌ ANTES:
const rawTargets = parsed[normalizedGenre] || parsed;

// ✅ DEPOIS:
const genreData = parsed[normalizedGenre] || parsed;
const rawTargets = genreData.legacy_compatibility || genreData.hybrid_processing || genreData;
```

**Log adicional:**
```javascript
console.log('[TARGET-LOADER] genreData keys:', Object.keys(genreData || {}));
console.log('[TARGET-LOADER] Usando bloco:', 
  genreData.legacy_compatibility ? 'legacy_compatibility' : 
  genreData.hybrid_processing ? 'hybrid_processing' : 
  'direto');
```

### FASE 2: Corrigir conversão para frontend (json-output.js)
**Arquivo:** `work/api/audio/json-output.js`  
**Linhas:** 962-976  
**Mudança:**
```javascript
// ❌ ANTES:
lufs: options.genreTargets.lufs_target ?? options.genreTargets.lufs ?? null,

// ✅ DEPOIS:
lufs: options.genreTargets.lufs?.target ?? null,
```

### FASE 3: Validação
1. Reprocessar áudio Tech House
2. Verificar logs: `"[TARGET-LOADER] Usando bloco: legacy_compatibility"`
3. Confirmar valores na tabela: LUFS = -10.5 (não -9.0)
4. Confirmar sugestões usam mesmo valor
5. Confirmar PDF mostra mesmo valor

---

## 🎯 RESULTADO ESPERADO

Após correções:
- ✅ Loader lê `legacy_compatibility` do JSON
- ✅ Sistema para de cair no fallback hardcoded
- ✅ Todos os valores vêm de Tech House JSON (-10.5 LUFS)
- ✅ Sugestões, tabela, PDF, score: TODOS alinhados
- ✅ Conversão frontend corrigida (números em vez de objetos)

**Garantia:** Zero risco de quebra - se JSON não tiver `legacy_compatibility`, fallback para `hybrid_processing` ou objeto direto mantém compatibilidade.
