# 🔧 PATCH UNIFICADO - CORREÇÃO DO FLUXO REFERENCE MODE

## Arquivo: `public/audio-analyzer-integration.js`

---

### PATCH 1: buildReferencePayload() - Primeira Track (Linha ~2642)

```diff
--- a/public/audio-analyzer-integration.js
+++ b/public/audio-analyzer-integration.js
@@ -2642,18 +2642,28 @@ function buildReferencePayload(fileKey, fileName, idToken, options = {}) {
     console.log('[PR2] buildReferencePayload()', { isFirstTrack, referenceJobId });
     
     if (isFirstTrack) {
-        // PRIMEIRA TRACK: envia como genre para análise base
-        console.log('[PR2] Reference primeira track - usando buildGenrePayload como base');
-        const basePayload = buildGenrePayload(fileKey, fileName, idToken);
+        // ✅ CORREÇÃO: PRIMEIRA TRACK em reference deve enviar mode='reference'
+        // Backend sabe que é primeira track pela ausência de referenceJobId
+        console.log('[PR2] Reference primeira track - criando payload limpo de reference');
         
-        // Adicionar flag indicando que é base de referência
-        basePayload.isReferenceBase = true;
+        const payload = {
+            fileKey,
+            mode: 'reference',  // ✅ FIX: mode correto para reference
+            fileName,
+            isReferenceBase: true,  // Flag para backend saber que é primeira
+            referenceJobId: null,   // null = primeira track
+            idToken
+        };
         
-        console.log('[PR2] Reference primeira track payload:', {
-            mode: basePayload.mode,
-            isReferenceBase: basePayload.isReferenceBase,
-            hasGenre: !!basePayload.genre
+        console.log('[PR2] ✅ Reference primeira track payload:', {
+            mode: payload.mode,
+            isReferenceBase: payload.isReferenceBase,
+            hasGenre: false,  // ✅ NUNCA incluir genre em reference
+            hasTargets: false  // ✅ NUNCA incluir genreTargets em reference
         });
         
-        return basePayload;
+        // 🔒 SANITY CHECK: Garantir que NÃO tem genre/genreTargets
+        if (payload.genre || payload.genreTargets) {
+            console.error('[PR2] SANITY_FAIL: Reference primeira track tem genre/targets!', payload);
+            throw new Error('[PR2] Reference primeira track NÃO deve ter genre/genreTargets');
+        }
+        
+        return payload;
```

**Razão**: A primeira track em reference estava chamando `buildGenrePayload()` que criava payload com `mode: 'genre'` e incluía `genreTargets`. Isso fazia o backend rejeitar a requisição como "mode is not reference".

**Impacto**: ✅ Primeira música agora envia corretamente `mode: 'reference'` sem contaminação de gênero.

---

### PATCH 2: buildReferencePayload() - Segunda Track (Linha ~2664)

```diff
@@ -2664,11 +2674,12 @@ function buildReferencePayload(fileKey, fileName, idToken, options = {}) {
     } else {
-        // SEGUNDA TRACK: payload limpo SEM genre/genreTargets
+        // ✅ SEGUNDA TRACK: payload com referenceJobId para comparação
         if (!referenceJobId) {
             throw new Error('[PR2] buildReferencePayload: segunda track requer referenceJobId');
         }
         
         const payload = {
             fileKey,
-            mode: 'reference',
+            mode: 'reference',  // ✅ mode correto
             fileName,
-            referenceJobId,
+            referenceJobId,     // JobId da primeira música
+            isReferenceBase: false,  // Segunda track = comparação
             idToken
         };
```

**Razão**: Adicionar clareza com flag `isReferenceBase: false` e comentários explícitos.

**Impacto**: ✅ Segunda música envia referenceJobId corretamente para comparação A vs B.

---

### PATCH 3: resetModalState() - Guard de Preservação (Linha ~7155)

```diff
--- a/public/audio-analyzer-integration.js
+++ b/public/audio-analyzer-integration.js
@@ -7155,8 +7155,14 @@ function resetModalState() {
         return; // NÃO executar reset
     }
     
-    // 🔒 PATCH: PRESERVAR GÊNERO ANTES DE QUALQUER OPERAÇÃO
-    preserveGenreState();
+    // ✅ CORREÇÃO: NÃO preservar gênero em modo reference
+    // Isso estava causando contaminação de estado
+    if (currentMode !== 'reference') {
+        // 🔒 PATCH: PRESERVAR GÊNERO SOMENTE EM MODO GENRE
+        preserveGenreState();
+    } else {
+        console.log('[REF_FIX] 🔒 preserveGenreState() BLOQUEADO - modo Reference não usa gênero');
+    }
     
     // ===============================================================
     // 🔒 BLOCO 1 — PRESERVAR GÊNERO ANTES DO RESET
```

**Razão**: `preserveGenreState()` estava sendo chamada **sempre**, mesmo em modo reference, causando logs `[PRESERVE-GENRE] __CURRENT_SELECTED_GENRE já existe: eletrofunk`.

**Impacto**: ✅ Reference mode não tenta preservar/restaurar gênero, evitando contaminação de estado.

---

### PATCH 4: resetModalState() - Preservação Condicional (Linha ~7162)

```diff
@@ -7162,22 +7168,28 @@ function resetModalState() {
     let __PRESERVED_GENRE__ = null;
     let __PRESERVED_TARGETS__ = null;
 
-    try {
-        const genreSelect = document.getElementById("audioRefGenreSelect");
-
-        __PRESERVED_GENRE__ =
-            window.__CURRENT_SELECTED_GENRE ||
-            window.PROD_AI_REF_GENRE ||
-            (genreSelect ? genreSelect.value : null);
-        
-        __PRESERVED_TARGETS__ =
-            window.__CURRENT_GENRE_TARGETS ||
-            window.currentGenreTargets ||
-            window.__activeRefData?.targets;
-
-        console.log("[SAFE-RESET] ⚠️ Preservando gênero selecionado:", __PRESERVED_GENRE__);
-        console.log("[SAFE-RESET] ⚠️ Preservando targets:", __PRESERVED_TARGETS__ ? Object.keys(__PRESERVED_TARGETS__) : 'null');
-    } catch (e) {
-        console.warn("[SAFE-RESET] Falha ao capturar gênero antes do reset:", e);
+    // ✅ CORREÇÃO: Só preservar gênero se NÃO estiver em modo reference
+    if (currentMode !== 'reference') {
+        try {
+            const genreSelect = document.getElementById("audioRefGenreSelect");
+
+            __PRESERVED_GENRE__ =
+                window.__CURRENT_SELECTED_GENRE ||
+                window.PROD_AI_REF_GENRE ||
+                (genreSelect ? genreSelect.value : null);
+            
+            __PRESERVED_TARGETS__ =
+                window.__CURRENT_GENRE_TARGETS ||
+                window.currentGenreTargets ||
+                window.__activeRefData?.targets;
+
+            console.log("[SAFE-RESET] ⚠️ Preservando gênero selecionado:", __PRESERVED_GENRE__);
+            console.log("[SAFE-RESET] ⚠️ Preservando targets:", __PRESERVED_TARGETS__ ? Object.keys(__PRESERVED_TARGETS__) : 'null');
+        } catch (e) {
+            console.warn("[SAFE-RESET] Falha ao capturar gênero antes do reset:", e);
+        }
+    } else {
+        console.log("[REF_FIX] 🔒 Preservação de gênero/targets BLOQUEADA - modo Reference ativo");
     }
```

**Razão**: Variáveis `__PRESERVED_GENRE__` e `__PRESERVED_TARGETS__` estavam sendo preenchidas mesmo em reference, causando logs `[SAFE-RESET] Preservando targets...`.

**Impacto**: ✅ Em reference, variáveis ficam `null` e log de bloqueio é mostrado.

---

### PATCH 5: resetModalState() - Restauração Condicional (Linha ~7286)

```diff
@@ -7286,22 +7298,25 @@ function resetModalState() {
     // 🔒 BLOCO 3 — RESTAURAR GÊNERO E TARGETS APÓS O RESET
     // ===============================================================
     try {
-        const genreSelect = document.getElementById("audioRefGenreSelect");
+        // ✅ CORREÇÃO: Só restaurar gênero se NÃO estiver em modo reference
+        if (currentMode !== 'reference') {
+            const genreSelect = document.getElementById("audioRefGenreSelect");
 
-        if (__PRESERVED_GENRE__ && typeof __PRESERVED_GENRE__ === "string") {
-            window.__CURRENT_SELECTED_GENRE = __PRESERVED_GENRE__;
-            window.PROD_AI_REF_GENRE = __PRESERVED_GENRE__;
+            if (__PRESERVED_GENRE__ && typeof __PRESERVED_GENRE__ === "string") {
+                window.__CURRENT_SELECTED_GENRE = __PRESERVED_GENRE__;
+                window.PROD_AI_REF_GENRE = __PRESERVED_GENRE__;
 
-            if (genreSelect) {
-                genreSelect.value = __PRESERVED_GENRE__;
-            }
+                if (genreSelect) {
+                    genreSelect.value = __PRESERVED_GENRE__;
+                }
 
-            console.log("[SAFE-RESET] ✅ Gênero restaurado após reset:", __PRESERVED_GENRE__);
+                console.log("[SAFE-RESET] ✅ Gênero restaurado após reset:", __PRESERVED_GENRE__);
+            } else {
+                console.warn("[SAFE-RESET] ⚠️ Nenhum gênero válido preservado.");
+            }
         } else {
-            console.warn("[SAFE-RESET] ⚠️ Nenhum gênero válido preservado.");
+            console.log("[REF_FIX] 🔒 Restauração de gênero BLOQUEADA - modo Reference ativo");
         }
         
-        // 🔒 PATCH: RESTAURAR TARGETS TAMBÉM
-        if (__PRESERVED_TARGETS__) {
+        // 🔒 PATCH: RESTAURAR TARGETS TAMBÉM (somente em modo genre)
+        if (__PRESERVED_TARGETS__ && currentMode !== 'reference') {
             window.__CURRENT_GENRE_TARGETS = __PRESERVED_TARGETS__;
             window.currentGenreTargets = __PRESERVED_TARGETS__;
```

**Razão**: Restauração de gênero/targets ocorria mesmo em reference, reintroduzindo contaminação.

**Impacto**: ✅ Em reference, nenhuma restauração ocorre, mantendo estado limpo.

---

## 📊 RESUMO DAS MUDANÇAS

| Função | Linha Aprox. | Mudança | Impacto |
|--------|--------------|---------|---------|
| `buildReferencePayload()` | 2642-2660 | ✅ Primeira track envia `mode: 'reference'` | Corrige payload para backend aceitar |
| `buildReferencePayload()` | 2664-2676 | ✅ Adiciona `isReferenceBase: false` | Clareza na segunda track |
| `resetModalState()` | 7155-7165 | ✅ Guard `preserveGenreState()` | Bloqueia preservação em reference |
| `resetModalState()` | 7162-7192 | ✅ Preservação condicional | Não captura gênero em reference |
| `resetModalState()` | 7286-7300 | ✅ Restauração condicional | Não restaura gênero em reference |

**Total de linhas alteradas**: ~80 linhas  
**Funções modificadas**: 2 (`buildReferencePayload`, `resetModalState`)  
**Arquivos modificados**: 1 (`audio-analyzer-integration.js`)

---

## ✅ VALIDAÇÃO

### Sem Erros de Sintaxe
```bash
✅ No errors found in audio-analyzer-integration.js
```

### Logs Esperados em Reference Mode

**✅ DEVEM APARECER**:
```
[REF_FIX] 🔒 preserveGenreState() BLOQUEADO
[REF_FIX] 🔒 Preservação de gênero/targets BLOQUEADA
[PR2] Reference primeira track - criando payload limpo de reference
[PR2] ✅ Reference primeira track payload: { mode: 'reference', ... }
```

**❌ NÃO DEVEM APARECER**:
```
[PRESERVE-GENRE] __CURRENT_SELECTED_GENRE já existe: eletrofunk
[SAFE-RESET] Preservando targets...
[MODE ✅] Mode enviado: "genre"
[GENRE-PAYLOAD-SEND] payload: { genre:'eletrofunk', ... }
Cannot start reference first track, mode is not reference
```

---

## 🚀 COMO APLICAR

### Opção 1: Git Patch
```bash
# Salvar este conteúdo como reference-fix.patch
git apply reference-fix.patch
```

### Opção 2: Manual
1. Abrir `public/audio-analyzer-integration.js`
2. Localizar cada função mencionada (usar Ctrl+F)
3. Aplicar mudanças conforme os diffs acima
4. Salvar arquivo

### Opção 3: Já Aplicado ✅
As mudanças já foram aplicadas no arquivo atual.

---

## 📞 VERIFICAÇÃO PÓS-DEPLOY

1. **Hard Refresh**: `Ctrl + Shift + R`
2. **Verificar Sources**: Buscar string `✅ CORREÇÃO: PRIMEIRA TRACK em reference`
3. **Testar Reference Mode**: Fazer upload e verificar logs no console
4. **Testar Genre Mode**: Garantir que não quebrou

---

**FIM DO PATCH UNIFICADO** | Status: ✅ APLICADO | Data: 16/12/2025
