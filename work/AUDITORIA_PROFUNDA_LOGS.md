# 🔍 AUDITORIA CIRÚRGICA PROFUNDA - RASTREAMENTO DE GENRE

**Data:** 28 de novembro de 2025  
**Status:** 🔬 **LOGS CIRÚRGICOS INSERIDOS - PRONTO PARA TESTE**

---

## 📌 OBJETIVO

Rastrear o valor de `genre` em **CADA PONTO** do pipeline para identificar ONDE ele vira `null` ou `"default"`.

---

## 🎯 LOGS CIRÚRGICOS INSERIDOS

### **1. WORKER.JS - Entrada do Pipeline**

**Arquivo:** `work/worker.js`  
**Linhas:** ~202, ~225

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][WORKER-PRE-PIPELINE]
  - jobOrOptions.genre
  - jobOrOptions.data?.genre
  - resolvedGenre
  - isGenreMode
  - mode

[GENRE-DEEP-TRACE][WORKER-POST-OPTIONS]
  - pipelineOptions.genre
  - pipelineOptions.genreTargets
  - pipelineOptions.mode
```

**O que rastreia:**
- Genre ANTES de montar pipelineOptions
- Genre DEPOIS de montar pipelineOptions (o que vai pro pipeline)

---

### **2. PIPELINE-COMPLETE.JS - Fase JSON Output**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** ~203, ~213

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][PIPELINE-JSON-PRE]
  - options.genre
  - options.data?.genre
  - options.genre_detected
  - isGenreMode

[GENRE-DEEP-TRACE][PIPELINE-JSON-POST]
  - resolvedGenre
  - detectedGenre
  - isNull
  - isDefault
```

**O que rastreia:**
- Genre ANTES de resolver (JSON Output)
- Genre DEPOIS de resolver (se virou null ou default)

---

### **3. PIPELINE-COMPLETE.JS - Fase Suggestions V1**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** ~270, ~282

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][PIPELINE-V1-PRE]
  - options.genre
  - options.data?.genre
  - isGenreMode

[GENRE-DEEP-TRACE][PIPELINE-V1-POST]
  - resolvedGenre
  - detectedGenre
  - isNull
  - isDefault
```

**O que rastreia:**
- Genre ANTES de resolver (Suggestions V1)
- Genre DEPOIS de resolver (se virou null ou default)

---

### **4. PIPELINE-COMPLETE.JS - Fase Suggestions V2**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** ~407, ~420

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][PIPELINE-V2-PRE]
  - options.genre
  - options.data?.genre
  - mode

[GENRE-DEEP-TRACE][PIPELINE-V2-POST]
  - resolvedGenreV2
  - detectedGenreV2
  - isNull
  - isDefault
```

**O que rastreia:**
- Genre ANTES de resolver (Suggestions V2)
- Genre DEPOIS de resolver (se virou null ou default)

---

### **5. PIPELINE-COMPLETE.JS - Atribuição Summary/Metadata V1**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** ~372, ~386

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][V1-SUMMARY-PRE]
  - problemsAndSuggestions.summary?.genre
  - problemsAndSuggestions.metadata?.genre
  - detectedGenre (disponível)

[GENRE-DEEP-TRACE][V1-SUMMARY-POST]
  - finalJSON.summary.genre
  - finalJSON.suggestionMetadata.genre
  - PROBLEMA? (se não bate com detectedGenre)
```

**🚨 O QUE RASTREIA:**
- **PONTO CRÍTICO:** Quando summary/metadata são criados de `problemsAndSuggestions`
- Se `problemsAndSuggestions.summary.genre` já vem errado do motor V1
- **ESTE PODE SER O BUG!**

---

### **6. PIPELINE-COMPLETE.JS - Error Reset Summary/Metadata**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linha:** ~399

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][ERROR-RESET]
  - detectedGenre (perdido?)
  - ALERTA: summary e metadata serão VAZIOS - genre SERÁ PERDIDO
```

**O que rastreia:**
- Se houve erro e summary/metadata foram zerados
- **Perda total de genre**

---

### **7. PIPELINE-COMPLETE.JS - Forçar Genre em Summary/Metadata (V2)**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** ~540, ~554

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][SUMMARY-METADATA-PRE]
  - detectedGenre (usado para forçar)
  - v2Summary.genre
  - v2Metadata.genre
  - finalJSON.genre

[GENRE-DEEP-TRACE][SUMMARY-METADATA-POST]
  - finalJSON.summary.genre
  - finalJSON.suggestionMetadata.genre
  - finalJSON.genre
```

**O que rastreia:**
- ANTES de forçar genre em summary/metadata (V2)
- DEPOIS de forçar (se funcionou)

---

### **8. PIPELINE-COMPLETE.JS - Validação Final**

**Arquivo:** `work/api/audio/pipeline-complete.js`  
**Linhas:** ~873-889

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][FINAL-VALIDATION-PRE]
  - finalJSON.summary existe?
  - finalJSON.summary.genre
  - finalJSON.suggestionMetadata existe?
  - finalJSON.suggestionMetadata.genre

[GENRE-DEEP-TRACE][FINAL-VALIDATION-RESET-SUMMARY]
  - alerta: summary era inválido - RESETANDO (genre perdido)

[GENRE-DEEP-TRACE][FINAL-VALIDATION-RESET-METADATA]
  - alerta: suggestionMetadata era inválido - RESETANDO (genre perdido)
```

**🚨 O QUE RASTREIA:**
- **PONTO CRÍTICO:** Validação final que pode ZERAR summary/metadata
- Se summary/metadata são inválidos e perdem genre
- **ESTE PODE SER O BUG!**

---

### **9. JSON-OUTPUT.JS - BuildFinalJSON**

**Arquivo:** `work/api/audio/json-output.js`  
**Linhas:** ~475, ~488

**Logs inseridos:**
```javascript
[GENRE-DEEP-TRACE][JSON-OUTPUT-PRE]
  - options.genre
  - options.data?.genre
  - options.genre_detected
  - options.mode

[GENRE-DEEP-TRACE][JSON-OUTPUT-POST]
  - isGenreMode
  - resolvedGenre
  - finalGenre
  - isNull
  - isEmpty
  - isDefault
```

**O que rastreia:**
- ENTRADA do buildFinalJSON
- DEPOIS de resolver finalGenre
- Se virou null, vazio ou default

---

## 🧪 COMO EXECUTAR O TESTE

### **1. Reiniciar worker**
```powershell
cd work
node worker.js
```

### **2. Enviar job de teste**
```javascript
POST /api/audio/analyze
{
  "fileKey": "test.wav",
  "mode": "genre",
  "genre": "trance",
  "genreTargets": {
    "kick": { "min": 50, "max": 100 },
    "bass": { "min": 60, "max": 120 }
  }
}
```

### **3. Monitorar logs na sequência**

**Ordem esperada dos logs:**

```
1. [GENRE-DEEP-TRACE][WORKER-PRE-PIPELINE]
   └─ Verificar: resolvedGenre deve ser "trance"

2. [GENRE-DEEP-TRACE][WORKER-POST-OPTIONS]
   └─ Verificar: pipelineOptions.genre deve ser "trance"

3. [GENRE-TRACE][PIPELINE-INPUT]
   └─ Verificar: incomingGenre deve ser "trance"

4. [GENRE-DEEP-TRACE][PIPELINE-JSON-PRE]
   └─ Verificar: options.genre deve ser "trance"

5. [GENRE-DEEP-TRACE][PIPELINE-JSON-POST]
   └─ Verificar: detectedGenre deve ser "trance"
   └─ 🚨 SE isNull=true ou isDefault=true → BUG AQUI!

6. [GENRE-DEEP-TRACE][PIPELINE-V1-PRE]
   └─ Verificar: options.genre deve ser "trance"

7. [GENRE-DEEP-TRACE][PIPELINE-V1-POST]
   └─ Verificar: detectedGenre deve ser "trance"
   └─ 🚨 SE isNull=true ou isDefault=true → BUG AQUI!

8. [GENRE-DEEP-TRACE][V1-SUMMARY-PRE]
   └─ 🚨 PONTO CRÍTICO: Verificar problemsAndSuggestions.summary.genre
   └─ 🚨 SE JÁ VEM NULL/DEFAULT AQUI → BUG NO MOTOR V1!

9. [GENRE-DEEP-TRACE][V1-SUMMARY-POST]
   └─ Verificar: finalJSON.summary.genre
   └─ 🚨 SE PROBLEMA?=true → summary não bateu com detectedGenre!

10. [GENRE-DEEP-TRACE][PIPELINE-V2-PRE]
    └─ Verificar: options.genre deve ser "trance"

11. [GENRE-DEEP-TRACE][PIPELINE-V2-POST]
    └─ Verificar: detectedGenreV2 deve ser "trance"

12. [GENRE-DEEP-TRACE][SUMMARY-METADATA-PRE]
    └─ Verificar: v2Summary.genre e v2Metadata.genre

13. [GENRE-DEEP-TRACE][SUMMARY-METADATA-POST]
    └─ Verificar: finalJSON.summary.genre deve ser "trance"

14. [GENRE-DEEP-TRACE][JSON-OUTPUT-PRE]
    └─ Verificar: options.genre deve ser "trance"

15. [GENRE-DEEP-TRACE][JSON-OUTPUT-POST]
    └─ Verificar: finalGenre deve ser "trance"
    └─ 🚨 SE isNull=true ou isEmpty=true ou isDefault=true → BUG AQUI!

16. [GENRE-DEEP-TRACE][FINAL-VALIDATION-PRE]
    └─ Verificar: finalJSON.summary.genre e finalJSON.suggestionMetadata.genre

17. [GENRE-TRACE][PIPELINE-OUTPUT]
    └─ Verificar TUDO: resultGenre, summaryGenre, metadataGenre, suggestionMetadataGenre

18. [GENRE-AUDIT-FINAL]
    └─ Verificar TUDO antes de salvar no Postgres
```

---

## 🎯 IDENTIFICAÇÃO DO BUG

### **Cenário 1: Genre vira NULL em resolução**

Se qualquer log `[GENRE-DEEP-TRACE][*-POST]` mostrar:
```
isNull: true
```

**Causa:** O operador `||` está fazendo `options.genre` virar `null`.

**Solução:** Verificar se `options.genre` chega como `undefined`, `""` ou `false`.

---

### **Cenário 2: Genre vira "default" em resolução**

Se qualquer log `[GENRE-DEEP-TRACE][*-POST]` mostrar:
```
isDefault: true
```

**Causa:** Fallback `|| 'default'` sendo aplicado indevidamente.

**Solução:** Remover fallback no modo genre (JÁ FEITO nas correções anteriores).

---

### **Cenário 3: Summary/Metadata já vem errado do motor V1**

Se `[GENRE-DEEP-TRACE][V1-SUMMARY-PRE]` mostrar:
```
problemsAndSuggestions.summary?.genre: null
problemsAndSuggestions.metadata?.genre: null
```

**Causa:** Motor `analyzeProblemsAndSuggestionsV2` não está recebendo genre correto.

**Solução:** Verificar chamada do motor V1 em `pipeline-complete.js` linha ~338.

---

### **Cenário 4: Summary/Metadata zerados por erro**

Se aparecer:
```
[GENRE-DEEP-TRACE][ERROR-RESET]
```

**Causa:** Erro no pipeline causou reset de summary/metadata.

**Solução:** Corrigir erro que causou o reset.

---

### **Cenário 5: Validação final apaga summary/metadata**

Se aparecer:
```
[GENRE-DEEP-TRACE][FINAL-VALIDATION-RESET-SUMMARY]
```
ou
```
[GENRE-DEEP-TRACE][FINAL-VALIDATION-RESET-METADATA]
```

**Causa:** `finalJSON.summary` ou `finalJSON.suggestionMetadata` são inválidos (não object).

**Solução:** Investigar por que viraram inválidos antes dessa validação.

---

## 📊 ANÁLISE ESPERADA

### **Fluxo CORRETO (sem bugs):**

```
[WORKER-PRE-PIPELINE]     resolvedGenre: "trance" ✅
[WORKER-POST-OPTIONS]     pipelineOptions.genre: "trance" ✅
[PIPELINE-JSON-POST]      detectedGenre: "trance", isNull: false ✅
[PIPELINE-V1-POST]        detectedGenre: "trance", isNull: false ✅
[V1-SUMMARY-PRE]          problemsAndSuggestions.summary.genre: "trance" ✅
[V1-SUMMARY-POST]         finalJSON.summary.genre: "trance", PROBLEMA?: false ✅
[PIPELINE-V2-POST]        detectedGenreV2: "trance", isNull: false ✅
[SUMMARY-METADATA-POST]   finalJSON.summary.genre: "trance" ✅
[JSON-OUTPUT-POST]        finalGenre: "trance", isNull: false ✅
[FINAL-VALIDATION-PRE]    finalJSON.summary.genre: "trance" ✅
[PIPELINE-OUTPUT]         summaryGenre: "trance" ✅
[GENRE-AUDIT-FINAL]       summaryGenre: "trance" ✅
```

### **Fluxo COM BUG (exemplo):**

```
[WORKER-PRE-PIPELINE]     resolvedGenre: "trance" ✅
[WORKER-POST-OPTIONS]     pipelineOptions.genre: "trance" ✅
[PIPELINE-JSON-POST]      detectedGenre: "trance", isNull: false ✅
[PIPELINE-V1-POST]        detectedGenre: "trance", isNull: false ✅
[V1-SUMMARY-PRE]          problemsAndSuggestions.summary.genre: null ❌ BUG AQUI!
[V1-SUMMARY-POST]         finalJSON.summary.genre: null, PROBLEMA?: true ❌
```

**Diagnóstico:** Motor V1 não recebe genre ou não propaga para summary.

---

## 🔧 CORREÇÃO MÍNIMA (Após identificar bug)

### **Se bug for no motor V1:**

**Arquivo:** `work/lib/audio/features/problems-suggestions-v2.js`  
**Verificar:** Constructor da classe `AudioProblemAnalyzer`

```javascript
constructor(genre = 'default', customTargets = null) {
  this.genre = genre;  // ← Verificar se recebe correto
  // ...
}
```

**E verificar retorno:**
```javascript
return {
  problems: this.problems,
  suggestions: this.suggestions,
  summary: {
    genre: this.genre,  // ← Verificar se propaga correto
    // ...
  },
  metadata: {
    genre: this.genre,  // ← Verificar se propaga correto
    // ...
  }
};
```

---

## ✅ PRÓXIMOS PASSOS

1. ✅ Logs cirúrgicos inseridos
2. ⏳ Executar teste e coletar logs
3. ⏳ Identificar ponto EXATO onde genre vira null/default
4. ⏳ Aplicar correção mínima e cirúrgica
5. ⏳ Revalidar com novos logs

---

**Status:** 🔬 **LOGS INSERIDOS - AGUARDANDO TESTE REAL**
