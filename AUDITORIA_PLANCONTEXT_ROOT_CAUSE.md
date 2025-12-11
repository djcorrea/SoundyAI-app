# 🔴 AUDITORIA CRÍTICA: MODO REDUZIDO NÃO ATIVA
**Data:** 10/12/2025  
**Status:** 🔴 BUG CRÍTICO IDENTIFICADO  
**Impacto:** ALTO - Modo reduzido NUNCA é ativado, usuários FREE/PLUS recebem análises FULL mesmo após limite

---

## 🎯 CAUSA RAIZ IDENTIFICADA

### ❌ PROBLEMA CRÍTICO NO `analyze.js` (linha 553-557)

```javascript
// ❌ CÓDIGO ATUAL (INCORRETO):
const planContext = {
  plan: analysisCheck.user.plan,
  analysisMode: analysisMode, // ❌ "full" | "reduced"
  features: features,
  uid: uid
};
```

**O QUE ESTÁ ERRADO:**
- A variável `analysisMode` **NÃO EXISTE** neste escopo!
- Esta variável nunca foi declarada ou atribuída antes da linha 553
- JavaScript lê `analysisMode` como `undefined`
- O `planContext` vai para o Redis com `analysisMode: undefined`

---

## 📊 FLUXO COMPLETO AUDITADO

### ✅ ETAPA 1: `analyze.js` - VALIDAÇÃO DE LIMITES (CORRETO)

**Linha 458:**
```javascript
const analysisCheck = await canUseAnalysis(uid);
```

**Retorno de `canUseAnalysis()` (correto):**
```javascript
{
  allowed: true,
  mode: "reduced",  // ✅ Correto: após 3 análises FREE = "reduced"
  user: { plan: "free", analysesMonth: 3, ... },
  remainingFull: 0
}
```

**Linha 460-475:**
```javascript
if (!analysisCheck.allowed) {
  return res.status(403).json({ ok: false, error: "blocked" });
}
```
✅ **OK**: Validação de bloqueio funciona corretamente.

---

### ❌ ETAPA 2: `analyze.js` - MONTAGEM DO `planContext` (ERRADO)

**Linha 553-557:**
```javascript
const planContext = {
  plan: analysisCheck.user.plan,        // ✅ "free"
  analysisMode: analysisMode,           // ❌ undefined (variável não existe!)
  features: features,                   // ✅ correto
  uid: uid                              // ✅ correto
};
```

**Linha 563:**
```javascript
const jobRecord = await createJobInDatabase(
  fileKey, mode, fileName, 
  referenceJobId, genre, genreTargets, 
  planContext  // ❌ { analysisMode: undefined } vai para o Redis
);
```

**PAYLOAD ENVIADO AO REDIS (linha 150):**
```javascript
{
  jobId: "uuid-123",
  fileKey: "s3-key",
  mode: "genre",
  genre: "electronic",
  planContext: {
    plan: "free",
    analysisMode: undefined,  // ❌ UNDEFINED!
    features: { canSuggestions: true, ... },
    uid: "user123"
  }
}
```

---

### ✅ ETAPA 3: `worker.js` - EXTRAÇÃO DO `planContext` (CORRETO)

**Linha 447-456:**
```javascript
let extractedPlanContext = null;
if (job.data && typeof job.data === 'object') {
  extractedPlanContext = job.data.planContext;  // ✅ Extrai corretamente
}
```

**Linha 478:**
```javascript
const options = {
  jobId: job.id,
  mode: job.mode,
  genre: finalGenre,
  planContext: extractedPlanContext || null  // ✅ Repassa corretamente
};
```

**OBJETO REPASSADO:**
```javascript
{
  planContext: {
    plan: "free",
    analysisMode: undefined,  // ❌ Ainda undefined
    features: { ... },
    uid: "user123"
  }
}
```

---

### ✅ ETAPA 4: `pipeline-complete.js` - VALIDAÇÃO DO MODO (CORRETO)

**Linha 1422:**
```javascript
const planContext = options.planContext || null;
```

**Linha 1428:**
```javascript
finalJSON.analysisMode = planContext.analysisMode;  
// ❌ Recebe undefined do Redis
```

**Linha 1432 (CONDIÇÃO NUNCA É VERDADEIRA):**
```javascript
if (planContext.analysisMode === 'reduced') {
  // ❌ NUNCA ENTRA AQUI porque:
  // undefined === 'reduced' → false
  console.log('[PLAN-FILTER] ⚠️ MODO REDUZIDO ATIVADO');
  // Este código NUNCA executa!
}
```

**RESULTADO FINAL:**
- Modo reduzido **NUNCA é ativado**
- Pipeline sempre retorna análise FULL
- Usuários FREE/PLUS recebem dados completos após limite
- Sistema de limites é **COMPLETAMENTE IGNORADO**

---

## 🔥 IMPACTO DO BUG

### 1. **Perda de Receita**
- Usuários FREE recebem análises FULL ilimitadas
- Nenhum incentivo para upgrade (PLUS/PRO)
- Limites do sistema são inúteis

### 2. **Custos Computacionais**
- Processamento FULL para todos os usuários
- IA generativa sempre ativada
- Análise espectral sempre processada
- Sugestões sempre geradas

### 3. **Experiência Inconsistente**
- Frontend pode mostrar "modo reduzido" no UI
- Backend retorna dados completos
- Usuário confuso sobre seu plano real

---

## ✅ CORREÇÃO NECESSÁRIA

### **Arquivo:** `work/api/audio/analyze.js`

**LINHA 553 - SUBSTITUIR:**

```javascript
// ❌ ANTES (INCORRETO):
const planContext = {
  plan: analysisCheck.user.plan,
  analysisMode: analysisMode, // ❌ variável não existe
  features: features,
  uid: uid
};
```

**✅ DEPOIS (CORRETO):**

```javascript
// ✅ CORRETO: Usar analysisCheck.mode (vem de canUseAnalysis)
const planContext = {
  plan: analysisCheck.user.plan,
  analysisMode: analysisCheck.mode,  // ✅ "full" | "reduced" | "blocked"
  features: features,
  uid: uid
};
```

---

## 📋 VALIDAÇÃO DA CORREÇÃO

### **1. Verificar `canUseAnalysis()` retorna `mode`**

**Arquivo:** `work/lib/user/userPlans.js` (linha 292)

```javascript
async function canUseAnalysis(uid) {
  // ...código de validação...
  
  return {
    allowed: true,
    mode: "reduced",  // ✅ Campo mode EXISTE
    user: normalizedUser,
    remainingFull: remainingFull,
    errorCode: null
  };
}
```

✅ **CONFIRMADO**: `canUseAnalysis()` retorna `{ mode: "full"|"reduced"|"blocked" }`

---

### **2. Testar Fluxo Completo**

**TESTE MANUAL:**

1. **Criar usuário FREE no Firestore:**
```javascript
{
  uid: "test-free-user",
  plan: "free",
  analysesMonth: 3,  // ← Já usou 3 análises
  billingMonth: "2025-12"
}
```

2. **Fazer POST /api/audio/analyze como este usuário**

3. **Verificar logs:**
```
[ANALYZE] canUseAnalysis result: { allowed: true, mode: "reduced", remainingFull: 0 }
[ANALYZE] Plan Context montado: { plan: "free", analysisMode: "reduced", ... }
[WORKER] job.data.planContext: PRESENTE
[WORKER] planContext.analysisMode: "reduced"
[PLAN-FILTER] ⚠️ MODO REDUZIDO ATIVADO
[PLAN-FILTER] ✅ Bandas neutralizadas: 10 bandas
[PLAN-FILTER] ✅ Sugestões limpas (arrays vazios)
```

4. **Verificar resposta JSON:**
```json
{
  "analysisMode": "reduced",
  "score": 85,
  "truePeak": -0.5,
  "lufs": -14.0,
  "dynamicRange": 8,
  "bands": {
    "sub": { "db": "-", "target_db": "-", "diff": 0, "status": "unavailable" },
    "bass": { "db": "-", "target_db": "-", "diff": 0, "status": "unavailable" }
  },
  "suggestions": [],
  "aiSuggestions": [],
  "spectrum": null,
  "limitWarning": "Você atingiu o limite de análises completas do plano FREE. Atualize seu plano para desbloquear análise completa."
}
```

---

## 🎯 RESUMO EXECUTIVO

| Componente | Status | Problema Identificado |
|-----------|--------|----------------------|
| `userPlans.js` | ✅ CORRETO | `canUseAnalysis()` retorna `mode` corretamente |
| `analyze.js` | ❌ **ERRO CRÍTICO** | Usa variável `analysisMode` que não existe (undefined) |
| `worker.js` | ✅ CORRETO | Extrai e repassa `planContext` corretamente |
| `pipeline-complete.js` | ✅ CORRETO | Validação `analysisMode === 'reduced'` está correta |

**CAUSA RAIZ:**  
Linha 554 de `analyze.js` usa `analysisMode` (undefined) em vez de `analysisCheck.mode`.

**CORREÇÃO:**  
Substituir `analysisMode: analysisMode` por `analysisMode: analysisCheck.mode`.

**IMPACTO DA CORREÇÃO:**  
- Sistema de limites funcionará corretamente
- Modo reduzido será ativado após limites FREE/PLUS
- Custos computacionais reduzidos
- Experiência de usuário consistente

---

## 📝 PRÓXIMOS PASSOS

1. ✅ Aplicar patch no `analyze.js` (linha 554)
2. ✅ Validar sintaxe (sem erros)
3. 🔄 Testar manualmente com usuário FREE (3+ análises)
4. 🔄 Verificar logs completos do fluxo
5. 🔄 Confirmar JSON reduzido no frontend
6. 🔄 Deploy em produção
7. 🔄 Monitorar logs: `[PLAN-FILTER] MODO REDUZIDO ATIVADO`

---

**FIM DA AUDITORIA**
