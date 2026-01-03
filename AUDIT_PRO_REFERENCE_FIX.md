# 🔐 AUDITORIA: Correção PRO Bloqueado no Modo Referência

**Data:** 2025-01-XX  
**Status:** ✅ CORRIGIDO  
**Severidade:** CRÍTICA (usuários pagantes sendo bloqueados)

---

## 📋 PROBLEMA IDENTIFICADO

### Sintoma
Usuários com plano PRO (confirmado no Firestore e após upgrade via Stripe) continuavam sendo bloqueados ao tentar usar o **Modo Referência**, exibindo o modal de upgrade indevidamente.

### Causa Raiz
A função `getCurrentContext()` em `plan-capabilities.js` usava `window.userPlan` como fallback para detectar o plano do usuário:

```javascript
// ❌ CÓDIGO ANTIGO - PROBLEMÁTICO
function getCurrentContext() {
    const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
    const plan = analysis?.plan || window.userPlan || 'free';  // ⚠️ window.userPlan NUNCA era definido!
    // ...
}
```

**Problema:** `window.userPlan` **nunca foi definido em nenhum lugar do código**. Isso fazia com que:
1. Antes de qualquer análise, `plan` era sempre `'free'` (fallback)
2. Usuários PRO eram bloqueados porque o sistema pensava que eram FREE
3. O plano só ficava correto DEPOIS de uma análise retornar do backend com `analysis.plan`

---

## 🔧 CORREÇÕES APLICADAS

### 1. `public/plan-capabilities.js` - Detecção Robusta de Plano

**Adicionado:**

```javascript
// 🔐 Cache do plano do usuário (atualizado via fetchUserPlan)
let _cachedUserPlan = null;

/**
 * 🔐 FUNÇÃO CRÍTICA: Detecta o plano do usuário de múltiplas fontes
 * Ordem de prioridade:
 * 1. Análise atual (window.currentModalAnalysis?.plan)
 * 2. Cache local (_cachedUserPlan - atualizado via Firestore)
 * 3. window.userPlan (se definido por outro módulo)
 * 4. Fallback: 'free' (APENAS se nenhuma fonte disponível)
 */
function detectUserPlan() { ... }

/**
 * 🔐 FUNÇÃO ASSÍNCRONA: Busca plano do usuário diretamente do Firestore
 */
async function fetchUserPlan() { ... }

/**
 * 🔐 INICIALIZAÇÃO AUTOMÁTICA: Busca plano quando Firebase está pronto
 */
function initializePlanDetection() { ... }
```

**Modificado:** `getCurrentContext()` agora usa `detectUserPlan()` que busca de múltiplas fontes.

### 2. `public/audio-analyzer-integration.js` - Verificação Assíncrona

**Adicionado no topo do arquivo:**

```javascript
/**
 * 🔐 Verifica se o usuário pode usar o modo de referência
 * REGRA: Apenas plano PRO tem acesso ao modo referência
 */
async function checkReferenceEntitlement() { ... }

/**
 * 🔐 Versão síncrona para fail-safes (usa cache, menos precisa)
 */
function checkReferenceEntitlementSync() { ... }
```

**Modificado:** Função `selectAnalysisMode(mode)` agora é **async** e faz verificação assíncrona com fallback para Firestore:

```javascript
async function selectAnalysisMode(mode) {
    if (mode === 'reference') {
        let currentPlan = window.PlanCapabilities?.detectUserPlan?.() || 'free';
        
        // Se plano é 'free' mas usuário está autenticado, forçar refresh do Firestore
        if (currentPlan === 'free' && window.auth?.currentUser) {
            const freshPlan = await window.PlanCapabilities?.fetchUserPlan?.();
            if (freshPlan) currentPlan = freshPlan;
        }
        
        // 🔐 REGRA CRÍTICA: PRO NUNCA é bloqueado
        const shouldBlock = currentPlan !== 'pro';
        // ...
    }
}
```

### 3. Fail-safes Atualizados

Todos os fail-safes em `audio-analyzer-integration.js` foram atualizados para usar `checkReferenceEntitlementSync()`:

- `handleReferenceFileSelection(type)` - linha ~4640
- `openReferenceUploadModal()` - linha ~6380  
- `handleReferenceFileSelection(file)` - linha ~11850
- `selectAnalysisMode(mode)` (duplicata) - linha ~6650

---

## 📊 ARQUIVOS MODIFICADOS

| Arquivo | Modificação |
|---------|-------------|
| `public/plan-capabilities.js` | +110 linhas: `detectUserPlan()`, `fetchUserPlan()`, `initializePlanDetection()`, API expandida |
| `public/audio-analyzer-integration.js` | +55 linhas: `checkReferenceEntitlement()`, `checkReferenceEntitlementSync()`, fail-safes atualizados |

---

## ✅ COMPORTAMENTO ESPERADO APÓS CORREÇÃO

### Usuário PRO
1. Faz login → `initializePlanDetection()` busca plano do Firestore → `_cachedUserPlan = 'pro'`
2. Clica em "Modo Referência" → `selectAnalysisMode('reference')` detecta `plan = 'pro'`
3. `shouldBlock = false` → Análise de referência prossegue normalmente

### Usuário FREE/PLUS
1. Faz login → `initializePlanDetection()` busca plano do Firestore → `_cachedUserPlan = 'free'`
2. Clica em "Modo Referência" → `selectAnalysisMode('reference')` detecta `plan = 'free'`
3. `shouldBlock = true` → Modal de upgrade é exibido imediatamente

---

## 🧪 COMO TESTAR

### No Console do Navegador

```javascript
// Verificar estado atual
window.PlanCapabilities._debug();

// Forçar refresh do plano do Firestore
await window.PlanCapabilities._refreshPlan();

// Verificar entitlement de referência
window.checkReferenceEntitlementSync();
await window.checkReferenceEntitlement();
```

### Cenários de Teste

1. **Usuário PRO autenticado:** Deve poder acessar Modo Referência
2. **Usuário FREE autenticado:** Deve ver modal de upgrade ao clicar em Modo Referência
3. **Usuário PLUS autenticado:** Deve ver modal de upgrade ao clicar em Modo Referência
4. **Após upgrade PRO:** Deve poder acessar imediatamente (sem reload)

---

## 🔒 GARANTIAS DE SEGURANÇA

1. **Múltiplas fontes de verdade:** Análise > Cache > Firestore > Fallback
2. **Refresh automático:** Plano é buscado do Firestore quando usuário autentica
3. **Retry com delay:** Se cache não está preenchido, tenta buscar do Firestore
4. **Fail-safes síncronos:** Bloqueiam rapidamente mesmo se async falhar
5. **Regra explícita:** `currentPlan !== 'pro'` é a única verificação (clara e simples)

---

## 📝 NOTAS

- A função `selectAnalysisMode` foi convertida para `async` - isso é backward-compatible pois onclick handlers aceitam async functions
- O campo `window.userPlan` agora É definido pelo `fetchUserPlan()` para compatibilidade com código legado
- Os campos `plan` (novo) e `plano` (legado) são ambos verificados no Firestore
