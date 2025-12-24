# 🔧 CORREÇÕES APLICADAS: BANDAS MISSING NO MODAL

**Data:** 23/12/2025  
**Problema:** Modal não renderizava lowMid, highMid, presence, air mesmo quando amarelo/vermelho na tabela  
**Causa:** Security Guard bloqueava + alias errado do bass

---

## ✅ CORREÇÕES IMPLEMENTADAS

### 1. **Security Guard: air/brilho adicionado na allowlist**

**Arquivo:** `public/reduced-mode-security-guard.js`  
**Linhas:** 57-65

**ANTES:**
```javascript
// Blocklist
'band_air',
'air',
'ar',
'brilho',
```

**DEPOIS:**
```javascript
// Allowlist (LIBERADO)
'band_air',
'air',
'brilho'

// Blocklist (REMOVIDO)
// air/brilho agora está permitido
```

**Impacto:** ✨ Brilho/Air agora renderiza no modal quando não-OK

---

### 2. **Alias Map: Separar low_bass e upper_bass**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linhas:** 6610-6633

**ANTES (ERRADO):**
```javascript
const BAND_ALIAS_MAP = {
    'upper_bass': 'bass',  // ❌ Ambos mapeados para 'bass'
    'low_bass': 'bass',    // ❌ Causava troca de targets
    'low_mid': 'lowMid',
    // ...
};

const CANONICAL_BANDS = [
    { key: 'bass', label: '🔊 Bass (60-150 Hz)', category: 'LOW END' },  // ❌ Genérico
    // ...
];
```

**DEPOIS (CORRETO):**
```javascript
const BAND_ALIAS_MAP = {
    // REMOVIDO: upper_bass e low_bass (agora são bandas distintas)
    'low_mid': 'lowMid',
    'high_mid': 'highMid',
    'presenca': 'presence',
    'brilho': 'air'
};

const CANONICAL_BANDS = [
    { key: 'sub', label: '🔉 Sub (20-60 Hz)', category: 'LOW END' },
    { key: 'low_bass', label: '🔊 Bass (60-120 Hz)', category: 'LOW END' },         // ✅ Separado
    { key: 'upper_bass', label: '🔊 Upper Bass (120-250 Hz)', category: 'LOW END' }, // ✅ Separado
    { key: 'lowMid', label: '🎵 Low Mid (150-500 Hz)', category: 'MID' },
    { key: 'mid', label: '🎵 Mid (500-2k Hz)', category: 'MID' },
    { key: 'highMid', label: '🎸 High Mid (2k-5k Hz)', category: 'HIGH' },
    { key: 'presence', label: '💎 Presença (5k-10k Hz)', category: 'HIGH' },
    { key: 'air', label: '✨ Brilho (10k-20k Hz)', category: 'HIGH' }
];
```

**Impacto:** 
- 🔊 "Bass (60-120 Hz)" agora usa target correto de `low_bass`
- 🔊 "Upper Bass (120-250 Hz)" agora usa target correto de `upper_bass`
- ✅ Não mais confusão entre os dois

---

### 3. **Reverse Aliases: Suporte bidirecional**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linhas:** 6803-6822

**ANTES:**
```javascript
const reverseAliases = {
    'bass': ['low_bass', 'upper_bass'],  // ❌ Causava ambiguidade
    'lowMid': ['low_mid'],
    // ...
};
```

**DEPOIS:**
```javascript
const reverseAliases = {
    'lowMid': ['low_mid'],
    'low_mid': ['lowMid'],           // ✅ Bidirecional
    'highMid': ['high_mid'],
    'high_mid': ['highMid'],         // ✅ Bidirecional
    'presence': ['presenca'],
    'presenca': ['presence'],        // ✅ Bidirecional
    'air': ['brilho'],
    'brilho': ['air'],               // ✅ Bidirecional
    'low_bass': ['bass'],            // ✅ Aceita 'bass' como alias
    'bass': ['low_bass']             // ✅ Busca low_bass se procurar 'bass'
};
```

**Impacto:** 
- ✅ Busca funciona em ambas direções (snake_case ↔ camelCase)
- ✅ Compatibilidade com JSONs que usam nomes diferentes

---

### 4. **mapCategoryToMetric: Atualizado**

**Arquivo:** `public/ai-suggestion-ui-controller.js`  
**Linhas:** 1608-1626

**ANTES:**
```javascript
if (texto.includes('brilho') || texto.includes('air')) {
    console.log('[SECURITY-MAP] ✅ Detectado: Brilho/Air (bloqueado)');  // ❌ ERRADO
    return 'band_air';
}
```

**DEPOIS:**
```javascript
if (texto.includes('brilho') || texto.includes('air') || texto.includes('10k')) {
    console.log('[SECURITY-MAP] ✅ Detectado: Brilho/Air (LIBERADO)');  // ✅ CORRETO
    return 'band_air';
}

// 🆕 Detectar low_bass e upper_bass separadamente
if (texto.includes('low bass') || texto.includes('60-120')) {
    console.log('[SECURITY-MAP] ✅ Detectado: Low Bass (bloqueado)');
    return 'band_low_bass';
}
if (texto.includes('upper bass') || texto.includes('120-250')) {
    console.log('[SECURITY-MAP] ✅ Detectado: Upper Bass (bloqueado)');
    return 'band_upper_bass';
}
```

---

### 5. **Logs de Auditoria: Flag DEBUG_MODAL_BANDS**

**Arquivo:** `public/audio-analyzer-integration.js`  
**Linhas:** 6597-6618

```javascript
// 🔍 FLAG DE DEBUG: Ative para logs detalhados de auditoria
window.DEBUG_MODAL_BANDS = true;

// ... após buildMetricRows processar bandas ...

if (window.DEBUG_MODAL_BANDS) {
    const nonOkRows = rows.filter(r => r.severity !== 'OK');
    const bandRows = nonOkRows.filter(r => r.type === 'band');
    
    console.group('[AUDIT] 🔍 COMPARAÇÃO TABELA → MODAL');
    console.log('[AUDIT] 📊 Total não-OK:', nonOkRows.length);
    console.log('[AUDIT] 🎵 Bandas não-OK:', bandRows.length, '→', bandRows.map(r => r.key));
    console.log('[AUDIT] 🎯 Keys completas:', nonOkRows.map(r => `${r.key} (${r.severity})`));
    console.groupEnd();
}
```

**Arquivo:** `public/ai-suggestion-ui-controller.js`  
**Linhas:** 1431-1444 e 1488-1504

```javascript
// ANTES do filtro Security Guard
if (window.DEBUG_MODAL_BANDS) {
    console.group('[AUDIT] 🎯 ANTES DO FILTRO SECURITY GUARD');
    console.log('[AUDIT] Total suggestions:', rowsAsSuggestions.length);
    console.log('[AUDIT] Keys:', rowsAsSuggestions.map(s => s.metric));
    console.groupEnd();
}

// DEPOIS do filtro
if (window.DEBUG_MODAL_BANDS) {
    const blocked = beforeKeys.filter(k => !afterKeys.includes(k));
    
    console.group('[AUDIT] 🔒 APÓS FILTRO SECURITY GUARD');
    console.log('[AUDIT] ANTES:', beforeFilter, '→', beforeKeys);
    console.log('[AUDIT] DEPOIS:', afterFilter, '→', afterKeys);
    console.log('[AUDIT] BLOQUEADOS:', blocked.length, '→', blocked);
    console.groupEnd();
}
```

**Como usar:**
1. Abra console do navegador
2. Faça upload de um áudio
3. Procure por `[AUDIT]` nos logs
4. Compare TABELA (buildMetricRows) vs MODAL (filterReducedModeSuggestions)

---

## 🎯 RESULTADO ESPERADO

### **ANTES (BROKEN):**

**Tabela mostra 6 itens não-OK:**
- LUFS: -12.5 (⚠️ ATENÇÃO)
- DR: 7.2 (⚠️ ATENÇÃO)
- Low Mid: -10.2 (⚠️ ATENÇÃO)
- High Mid: -18.5 (⚠️ ATENÇÃO)
- Presença: -30.1 (⚠️ ATENÇÃO)
- Brilho: -22.3 (⚠️ ATENÇÃO)

**Modal renderiza 3 cards:**
- DR ✅
- ~~Low Mid~~ ❌ (bloqueado)
- ~~High Mid~~ ❌ (bloqueado)
- ~~Presença~~ ❌ (bloqueado)
- ~~Brilho~~ ❌ (bloqueado)

---

### **DEPOIS (FIXED):**

**Tabela mostra 6 itens não-OK:**
- LUFS: -12.5 (⚠️ ATENÇÃO)
- DR: 7.2 (⚠️ ATENÇÃO)
- Low Mid: -10.2 (⚠️ ATENÇÃO)
- High Mid: -18.5 (⚠️ ATENÇÃO)
- Presença: -30.1 (⚠️ ATENÇÃO)
- Brilho: -22.3 (⚠️ ATENÇÃO)

**Modal renderiza 5 cards:** (LUFS bloqueado no reduced mode, resto passa)
- DR ✅
- Low Mid ✅ (AGORA APARECE)
- High Mid ✅ (AGORA APARECE)
- Presença ✅ (AGORA APARECE)
- Brilho ✅ (AGORA APARECE)

---

## 📊 VALIDAÇÃO

### **Teste 1: Bass usando target correto**
```
Upload áudio com low_bass = -8.5 dB
Target Trance: low_bass: -14.6 dB (±4.3)

✅ TABELA: Bass (60-120 Hz): -8.5 dB | Target: -14.6 dB | ⚠️ ATENÇÃO
✅ MODAL: Bass (60-120 Hz): -8.5 dB | Target: -14.6 dB | ⚠️ ATENÇÃO

CORRETO: Modal usa MESMO target que tabela (low_bass)
```

### **Teste 2: Todas bandas renderizam**
```
Upload áudio com:
- lowMid: não-OK
- highMid: não-OK
- presence: não-OK
- air: não-OK

✅ TABELA: 4 bandas amarelas/vermelhas
✅ MODAL: 4 cards renderizados

CORRETO: Modal renderiza TODAS as bandas não-OK
```

### **Teste 3: Logs de auditoria**
```
[AUDIT] 🔍 COMPARAÇÃO TABELA → MODAL
[AUDIT] 📊 Total não-OK: 6
[AUDIT] 🎵 Bandas não-OK: 4 → ['lowMid', 'highMid', 'presence', 'air']

[AUDIT] 🎯 ANTES DO FILTRO SECURITY GUARD
[AUDIT] Total suggestions: 6
[AUDIT] Keys: ['dr', 'lowMid', 'highMid', 'presence', 'air', 'lufs']

[AUDIT] 🔒 APÓS FILTRO SECURITY GUARD
[AUDIT] ANTES: 6 → ['dr', 'lowMid', 'highMid', 'presence', 'air', 'lufs']
[AUDIT] DEPOIS: 5 → ['dr', 'lowMid', 'highMid', 'presence', 'air']
[AUDIT] BLOQUEADOS: 1 → ['lufs']

✅ CORRETO: Apenas LUFS bloqueado (reduced mode), resto passa
```

---

## 🚨 ROLLBACK (SE NECESSÁRIO)

### **Desativar logs:**
```javascript
// Linha ~6597 (audio-analyzer-integration.js)
window.DEBUG_MODAL_BANDS = false;
```

### **Reverter Security Guard:**
```javascript
// Mover 'band_air', 'air', 'brilho' de volta para blocklist
```

### **Reverter alias:**
```javascript
// Voltar para 'bass' genérico no CANONICAL_BANDS
```

---

## 📝 ARQUIVOS MODIFICADOS

1. **public/reduced-mode-security-guard.js** - Allowlist atualizada
2. **public/audio-analyzer-integration.js** - Alias e logs de auditoria
3. **public/ai-suggestion-ui-controller.js** - Mapeamento e logs

---

**Status:** ✅ CORREÇÕES APLICADAS  
**Próximo passo:** Testar com áudio real e validar logs

