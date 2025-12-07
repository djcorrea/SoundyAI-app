# 🔧 DESIGN: normalizeGenreTargets() - Função Universal

**Data:** 7 de dezembro de 2025  
**Objetivo:** Projetar função que converte QUALQUER estrutura de targets para formato esperado pelos sistemas  
**Status:** 📐 PROJETO (NÃO IMPLEMENTAR AINDA)

---

## 🎯 REQUISITOS

### Deve Suportar:
1. ✅ JSON moderno com `spectral_bands`
2. ✅ JSON legado com `bands`
3. ✅ JSON com apenas `target` (sem range)
4. ✅ JSON com `min_max: [min, max]`
5. ✅ JSON com `target_range: {min, max}`
6. ✅ Nomes de bandas camelCase (`bass`, `presence`, `air`)
7. ✅ Nomes de bandas snake_case (`low_bass`, `presenca`, `brilho`)

### Deve Gerar:
```javascript
{
    // Campos escalares (sempre presentes)
    lufs_target: number,
    true_peak_target: number,
    dr_target: number,
    lra_target: number,
    stereo_target: number,
    tol_lufs: number,
    tol_true_peak: number,
    tol_dr: number,
    tol_lra: number,
    tol_stereo: number,
    
    // Bandas normalizadas (sempre "bands")
    bands: {
        sub: { target_db, min, max },
        low_bass: { target_db, min, max },
        low_mid: { target_db, min, max },
        mid: { target_db, min, max },
        high_mid: { target_db, min, max },
        presenca: { target_db, min, max },
        brilho: { target_db, min, max }
    }
}
```

---

## 📐 DESIGN DA FUNÇÃO

```javascript
/**
 * 🔧 FUNÇÃO NORMALIZADORA UNIVERSAL DE TARGETS
 * Converte QUALQUER estrutura de targets para formato esperado pelos sistemas
 * 
 * @param {Object} rawTargets - Targets crus do backend (qualquer formato)
 * @returns {Object} Targets normalizados no formato esperado
 */
function normalizeGenreTargets(rawTargets) {
    if (!rawTargets || typeof rawTargets !== 'object') {
        console.error('[NORMALIZE] ❌ rawTargets inválido');
        return null;
    }
    
    console.log('[NORMALIZE] 🔧 Normalizando targets...');
    console.log('[NORMALIZE] Input keys:', Object.keys(rawTargets));
    
    // ═══════════════════════════════════════════════════════════
    // PARTE 1: NORMALIZAR CAMPOS ESCALARES
    // ═══════════════════════════════════════════════════════════
    const normalized = {
        // Targets principais (sempre copiar)
        lufs_target: rawTargets.lufs_target ?? rawTargets.lufsTarget ?? null,
        true_peak_target: rawTargets.true_peak_target ?? rawTargets.truePeakTarget ?? null,
        dr_target: rawTargets.dr_target ?? rawTargets.drTarget ?? null,
        lra_target: rawTargets.lra_target ?? rawTargets.lraTarget ?? null,
        stereo_target: rawTargets.stereo_target ?? rawTargets.stereoTarget ?? null,
        
        // Tolerâncias (valores padrão se ausentes)
        tol_lufs: rawTargets.tol_lufs ?? rawTargets.tolLufs ?? 1.0,
        tol_true_peak: rawTargets.tol_true_peak ?? rawTargets.tolTruePeak ?? 0.25,
        tol_dr: rawTargets.tol_dr ?? rawTargets.tolDr ?? 1.25,
        tol_lra: rawTargets.tol_lra ?? rawTargets.tolLra ?? 2.5,
        tol_stereo: rawTargets.tol_stereo ?? rawTargets.tolStereo ?? 0.065
    };
    
    console.log('[NORMALIZE] ✅ Campos escalares normalizados:', {
        lufs: normalized.lufs_target,
        peak: normalized.true_peak_target,
        dr: normalized.dr_target
    });
    
    // ═══════════════════════════════════════════════════════════
    // PARTE 2: NORMALIZAR BANDAS ESPECTRAIS
    // ═══════════════════════════════════════════════════════════
    
    // 🎯 PASSO 1: Encontrar fonte de bandas
    const rawBands = 
        rawTargets.bands ||                    // Formato legado/esperado
        rawTargets.spectral_bands ||           // Formato moderno
        rawTargets.spectralBands ||            // camelCase alternativo
        {};
    
    console.log('[NORMALIZE] 🎵 Fonte de bandas:', 
        rawTargets.bands ? 'bands (legado)' :
        rawTargets.spectral_bands ? 'spectral_bands (moderno)' :
        rawTargets.spectralBands ? 'spectralBands (camelCase)' :
        'NENHUMA');
    
    // 🎯 PASSO 2: Normalizar cada banda individualmente
    normalized.bands = normalizeBands(rawBands);
    
    console.log('[NORMALIZE] ✅ Normalização concluída:', {
        hasScalars: !!(normalized.lufs_target && normalized.dr_target),
        hasBands: !!normalized.bands,
        bandCount: normalized.bands ? Object.keys(normalized.bands).length : 0
    });
    
    return normalized;
}

/**
 * 🎵 NORMALIZAR ESTRUTURA DE BANDAS
 * Converte bandas de QUALQUER formato para formato esperado
 */
function normalizeBands(rawBands) {
    if (!rawBands || typeof rawBands !== 'object') {
        console.warn('[NORMALIZE-BANDS] ⚠️ Sem bandas para normalizar');
        return {};
    }
    
    const normalizedBands = {};
    
    // Mapeamento de nomes (qualquer → esperado)
    const nameMapping = {
        // Moderno → Legado esperado
        'sub': 'sub',
        'bass': 'low_bass',
        'low_bass': 'low_bass',
        'upper_bass': 'upper_bass',
        'upperBass': 'upper_bass',
        'lowMid': 'low_mid',
        'low_mid': 'low_mid',
        'mid': 'mid',
        'highMid': 'high_mid',
        'high_mid': 'high_mid',
        'presence': 'presenca',
        'presenca': 'presenca',
        'air': 'brilho',
        'brilho': 'brilho'
    };
    
    // Processar cada banda crua
    Object.entries(rawBands).forEach(([rawName, rawData]) => {
        // Normalizar nome da banda
        const normalizedName = nameMapping[rawName] || rawName;
        
        // Normalizar dados da banda
        normalizedBands[normalizedName] = normalizeBandData(rawData, rawName);
    });
    
    console.log('[NORMALIZE-BANDS] ✅ Bandas normalizadas:', Object.keys(normalizedBands));
    
    return normalizedBands;
}

/**
 * 🎶 NORMALIZAR DADOS DE UMA BANDA INDIVIDUAL
 * Extrai target_db, min, max de QUALQUER formato
 */
function normalizeBandData(rawData, bandName) {
    if (!rawData || typeof rawData !== 'object') {
        console.warn(`[NORMALIZE-BAND] ⚠️ Dados inválidos para banda ${bandName}`);
        return null;
    }
    
    const normalized = {};
    
    // ═══════════════════════════════════════════════════════════
    // PASSO 1: Extrair target_db (valor central)
    // ═══════════════════════════════════════════════════════════
    normalized.target_db = 
        rawData.target_db ??         // Formato legado
        rawData.targetDb ??          // camelCase
        rawData.target ??            // Formato moderno
        rawData.energy_db ??         // Fallback (valores diretos)
        rawData.rms_db ??            // Fallback alternativo
        null;
    
    // ═══════════════════════════════════════════════════════════
    // PASSO 2: Extrair min/max (intervalo ideal)
    // ═══════════════════════════════════════════════════════════
    
    // 🎯 PRIORIDADE 1: target_range: {min, max} (formato moderno)
    if (rawData.target_range && 
        typeof rawData.target_range.min === 'number' &&
        typeof rawData.target_range.max === 'number') {
        normalized.min = rawData.target_range.min;
        normalized.max = rawData.target_range.max;
        console.log(`[NORMALIZE-BAND] ${bandName}: target_range detectado [${normalized.min}, ${normalized.max}]`);
    }
    // 🎯 PRIORIDADE 2: min_max: [min, max] (formato legado array)
    else if (Array.isArray(rawData.min_max) && rawData.min_max.length === 2) {
        normalized.min = rawData.min_max[0];
        normalized.max = rawData.min_max[1];
        console.log(`[NORMALIZE-BAND] ${bandName}: min_max detectado [${normalized.min}, ${normalized.max}]`);
    }
    // 🎯 PRIORIDADE 3: min/max diretos (formato legado flat)
    else if (typeof rawData.min === 'number' && typeof rawData.max === 'number') {
        normalized.min = rawData.min;
        normalized.max = rawData.max;
        console.log(`[NORMALIZE-BAND] ${bandName}: min/max diretos [${normalized.min}, ${normalized.max}]`);
    }
    // 🎯 PRIORIDADE 4: Calcular a partir de target ± tolerance
    else if (typeof normalized.target_db === 'number' && typeof rawData.tolerance === 'number') {
        normalized.min = normalized.target_db - rawData.tolerance;
        normalized.max = normalized.target_db + rawData.tolerance;
        console.log(`[NORMALIZE-BAND] ${bandName}: Calculado de tolerance [${normalized.min}, ${normalized.max}]`);
    }
    // 🎯 PRIORIDADE 5: Calcular a partir de target_db ± tol_db
    else if (typeof normalized.target_db === 'number' && typeof rawData.tol_db === 'number') {
        normalized.min = normalized.target_db - rawData.tol_db;
        normalized.max = normalized.target_db + rawData.tol_db;
        console.log(`[NORMALIZE-BAND] ${bandName}: Calculado de tol_db [${normalized.min}, ${normalized.max}]`);
    }
    // ❌ FALLBACK: Sem range disponível
    else {
        console.warn(`[NORMALIZE-BAND] ⚠️ ${bandName}: Sem range disponível - usando apenas target_db`);
        normalized.min = null;
        normalized.max = null;
    }
    
    // ═══════════════════════════════════════════════════════════
    // PASSO 3: Validação final
    // ═══════════════════════════════════════════════════════════
    if (normalized.target_db === null) {
        console.error(`[NORMALIZE-BAND] ❌ ${bandName}: Sem target_db válido`);
        return null;
    }
    
    console.log(`[NORMALIZE-BAND] ✅ ${bandName}: target_db=${normalized.target_db}, range=[${normalized.min}, ${normalized.max}]`);
    
    return normalized;
}
```

---

## 🧪 TESTES DA FUNÇÃO

### Teste 1: JSON Moderno (spectral_bands)
```javascript
const input = {
    lufs_target: -14,
    spectral_bands: {
        sub: { 
            target: -28.5, 
            tolerance: 3.5,
            target_range: { min: -32, max: -25 }
        },
        bass: { target: -26, target_range: { min: -30, max: -22 } }
    }
};

const output = normalizeGenreTargets(input);
// Esperado:
// {
//     lufs_target: -14,
//     bands: {
//         sub: { target_db: -28.5, min: -32, max: -25 },
//         low_bass: { target_db: -26, min: -30, max: -22 }
//     }
// }
```

### Teste 2: JSON Legado (bands + min_max)
```javascript
const input = {
    lufs_target: -14,
    bands: {
        sub: { target_db: -28.5, min_max: [-32, -25] },
        low_bass: { target_db: -26, min_max: [-30, -22] }
    }
};

const output = normalizeGenreTargets(input);
// Esperado: mesmo formato normalizado
```

### Teste 3: JSON Apenas target (sem range)
```javascript
const input = {
    lufs_target: -14,
    bands: {
        sub: { target_db: -28.5, tol_db: 3.5 }
    }
};

const output = normalizeGenreTargets(input);
// Esperado:
// {
//     lufs_target: -14,
//     bands: {
//         sub: { target_db: -28.5, min: -32, max: -25 }  // Calculado
//     }
// }
```

---

## 🔗 INTEGRAÇÃO COM SISTEMAS EXISTENTES

### 1️⃣ Atualizar injectGenreTargetsIntoRefData()

**ANTES:**
```javascript
function injectGenreTargetsIntoRefData(refData, genreTargets) {
    // Injeta diretamente (pode quebrar)
    if (genreTargets.bands) {
        refData.bands = genreTargets.bands;
    }
}
```

**DEPOIS:**
```javascript
function injectGenreTargetsIntoRefData(refData, genreTargets) {
    // 🔧 NORMALIZAR antes de injetar
    const normalized = normalizeGenreTargets(genreTargets);
    
    if (!normalized) {
        console.error('[INJECT] ❌ Falha na normalização');
        return refData;
    }
    
    // Injetar campos normalizados
    const fields = [
        "lufs_target", "true_peak_target", "dr_target",
        "lra_target", "stereo_target", "bands",  // ✅ Sempre "bands"
        "tol_lufs", "tol_true_peak", "tol_dr",
        "tol_lra", "tol_stereo"
    ];
    
    fields.forEach(key => {
        if (normalized[key] !== undefined) {
            refData[key] = normalized[key];
        }
    });
    
    console.log('[INJECT] ✅ Targets normalizados injetados');
    return refData;
}
```

### 2️⃣ Atualizar contexto ULTRA_V2

**ANTES:**
```javascript
analysisContext.targetDataForEngine = officialGenreTargets;  // Pode estar aninhado
```

**DEPOIS:**
```javascript
// 🔧 NORMALIZAR antes de passar para ULTRA_V2
const normalized = normalizeGenreTargets(officialGenreTargets);

// Criar estrutura FLAT para ULTRA_V2
analysisContext.targetDataForEngine = {
    // Copiar bandas para root (estrutura flat)
    ...normalized.bands,  // sub: {...}, low_bass: {...}, etc.
    // Preservar campos escalares
    lufs_target: normalized.lufs_target,
    dr_target: normalized.dr_target
    // ...
};
```

### 3️⃣ Garantir Compatibilidade Reversa

```javascript
// ✅ JSON legado ainda funciona
const legacyTargets = {
    bands: { sub: { target_db: -28, min_max: [-32, -24] } }
};
const normalized = normalizeGenreTargets(legacyTargets);
// → { bands: { sub: { target_db: -28, min: -32, max: -24 } } }

// ✅ JSON moderno funciona
const modernTargets = {
    spectral_bands: { sub: { target: -28, target_range: {min: -32, max: -24} } }
};
const normalized = normalizeGenreTargets(modernTargets);
// → { bands: { sub: { target_db: -28, min: -32, max: -24 } } }
```

---

## ✅ GARANTIAS

1. ✅ **Não quebra score** - campos escalares sempre presentes
2. ✅ **Não quebra frequency score** - `bands` sempre presente com nomes corretos
3. ✅ **Não quebra ULTRA_V2** - pode criar estrutura flat adicional se necessário
4. ✅ **Compatibilidade reversa** - suporta JSON legado
5. ✅ **Compatibilidade futura** - suporta JSON moderno

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO (NÃO EXECUTAR AINDA)

- [ ] Implementar `normalizeGenreTargets()`
- [ ] Implementar `normalizeBands()`
- [ ] Implementar `normalizeBandData()`
- [ ] Atualizar `injectGenreTargetsIntoRefData()`
- [ ] Atualizar contexto ULTRA_V2
- [ ] Testar com JSON legado
- [ ] Testar com JSON moderno
- [ ] Validar score não quebrou
- [ ] Validar sugestões corretas

---

**Status:** 📐 **PROJETO COMPLETO - AGUARDANDO APROVAÇÃO PARA IMPLEMENTAR**

---

## 🔗 ARQUIVOS RELACIONADOS

- `AUDITORIA_PROFUNDA_TARGETS_DEPENDENCIAS.md` - Auditoria completa
- `PLANO_CORRECAO_SEM_REGRESSAO.md` - Plano de correção (próximo)
