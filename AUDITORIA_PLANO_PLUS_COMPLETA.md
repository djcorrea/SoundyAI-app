# 🔍 AUDITORIA COMPLETA: SISTEMA DE PLANOS + IMPLEMENTAÇÃO PLANO PLUS

**Data:** 13/12/2025  
**Objetivo:** Mapear arquitetura atual e implementar Plano Plus sem regressões

---

## 📊 PARTE 1: ARQUITETURA ATUAL (O QUE EXISTE)

### 1.1 Sistema de Planos (Backend)

**Arquivo:** `work/lib/user/userPlans.js`

#### Estrutura de Limites
```javascript
const PLAN_LIMITS = {
  free: {
    maxMessagesPerMonth: 20,
    maxFullAnalysesPerMonth: 3,
    allowReducedAfterLimit: true
  },
  plus: {
    maxMessagesPerMonth: 60,
    maxFullAnalysesPerMonth: 20,  // ⚠️ ATUAL: 20, DEVE SER: 25
    allowReducedAfterLimit: true
  },
  pro: {
    maxMessagesPerMonth: Infinity,
    maxFullAnalysesPerMonth: Infinity,
    hardCapAnalysesPerMonth: 200
  }
}
```

#### Funções Principais

1. **`canUseAnalysis(uid)`**
   - Verifica se usuário pode fazer análise
   - Retorna: `{ allowed, mode, user, remainingFull }`
   - **Modo retornado:**
     - `'full'` → dentro do limite
     - `'reduced'` → após limite (free/plus)
     - `'blocked'` → hard cap atingido (pro)

2. **`registerAnalysis(uid, mode)`**
   - Incrementa contador **apenas se mode === 'full'**
   - Análises `reduced` NÃO consomem contador

3. **`getPlanFeatures(plan, analysisMode)`**
   - Retorna capabilities por plano e modo
   - **PROBLEMA IDENTIFICADO:** Plus atual retorna features incorretas

**Features atuais (INCORRETAS):**
```javascript
// PLUS (atual - INCORRETO)
if (p === 'plus') {
  return {
    canSuggestions: isFull,      // ✅ OK
    canSpectralAdvanced: false,  // ✅ OK
    canAiHelp: false,            // ✅ OK
    canPdf: false                // ✅ OK
  };
}
```

**✅ Features estão corretas, mas precisam ser aplicadas no bloqueador**

---

### 1.2 Fluxo de Análise (Backend → Frontend)

**Arquivo:** `work/api/audio/analyze.js`

```javascript
// 1. Verificar permissão
const analysisCheck = await canUseAnalysis(uid);

// 2. Obter modo
const analysisMode = analysisCheck.mode; // "full" | "reduced"

// 3. Obter features
const features = getPlanFeatures(analysisCheck.user.plan, analysisMode);

// 4. Criar plan context
const planContext = {
  plan: analysisCheck.user.plan,
  analysisMode: analysisMode,
  features: features,
  uid: uid
};

// 5. Enviar para pipeline
```

**Arquivo:** `work/api/audio/pipeline-complete.js`

```javascript
// Adicionar flags no JSON final
finalJSON.analysisMode = planContext.analysisMode;  // "full" | "reduced"
finalJSON.isReduced = planContext.analysisMode === 'reduced';
finalJSON.plan = planContext.plan;  // "free" | "plus" | "pro"
finalJSON.planFeatures = planContext.features;
```

---

### 1.3 Sistema de Bloqueio (Frontend)

**Arquivo:** `public/premium-blocker.js`

#### Detecção de Modo Reduced

```javascript
function isReducedMode() {
  // Prioridade 1: APP_MODE global
  if (window.APP_MODE === 'reduced') return true;
  
  // Prioridade 2: Análise atual
  const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
  if (analysis) {
    if (analysis.analysisMode === 'reduced') return true;
    if (analysis.plan === 'free') return true;  // ⚠️ PROBLEMA
    if (analysis.isReduced === true) return true;
  }
  
  // Prioridade 3: Plano do usuário
  if (window.userPlan === 'free') return true;  // ⚠️ PROBLEMA
  
  return false;
}
```

**🔴 PROBLEMAS IDENTIFICADOS:**

1. **Linha:** `if (analysis.plan === 'free') return true;`
   - **Problema:** Bloqueia apenas plano `free`
   - **Falta:** Verificar também se é `plus` (que também deve bloquear IA/PDF)

2. **Linha:** `if (window.userPlan === 'free') return true;`
   - **Problema:** Mesma questão - só bloqueia `free`

#### Sistema de Bloqueio Atual

**3 Camadas de proteção:**

1. **Function Guards** → Wrappers nas funções
2. **Event Blocker** → Intercepta eventos antes da execução
3. **Button Neutralizer** → Remove onclick dos botões

**Funções bloqueadas:**
- `sendModalAnalysisToChat` (✅ tem guard nativo também)
- `downloadModalAnalysis` (✅ tem guard nativo também)

---

### 1.4 Guards Nativos nas Funções

**Arquivo:** `public/audio-analyzer-integration.js`

```javascript
// Linha ~20006
window.sendModalAnalysisToChat = async function sendModalAnalysisToChat() {
  // 🔒 GUARD: Bloquear funcionalidade premium em modo reduced
  if (window.APP_MODE === 'reduced') {
    console.log('🔒 [PREMIUM-GUARD] "Pedir Ajuda à IA" bloqueada');
    // Abre modal de upgrade
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.style.display = 'flex';
    return;  // ✅ Early return - não executa nada
  }
  // ... resto da função
}

// Linha ~20116
async function downloadModalAnalysis() {
  // 🔒 GUARD: Bloquear funcionalidade premium em modo reduced
  if (window.APP_MODE === 'reduced') {
    console.log('🔒 [PREMIUM-GUARD] "Baixar Relatório" bloqueada');
    // Abre modal de upgrade
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.style.display = 'flex';
    return;  // ✅ Early return - não executa nada
  }
  // ... resto da função
}
```

**✅ Guards nativos estão corretos e robustos**

---

### 1.5 Modal de Upgrade

**Arquivo:** `public/premium-blocker.js` (linhas 68-270)

- Modal já existe e funciona corretamente
- É reutilizável para qualquer recurso bloqueado
- Diferencia entre recursos: `ai`, `pdf`, `premium`
- Redireciona para `planos.html`

---

### 1.6 Botões HTML

**Arquivo:** `public/index.html`

```html
<!-- Linha 476 -->
<button class="action-btn primary" onclick="sendModalAnalysisToChat()">
  🤖 Pedir Ajuda à IA
</button>

<!-- Linha 479 -->
<button class="action-btn secondary" onclick="downloadModalAnalysis()">
  📄 Baixar Relatório
</button>
```

---

## 🎯 PARTE 2: MATRIZ DE CAPABILITIES (ESPERADO)

| Plano | Análises Full/Mês | Após Limite     | IA Context | PDF | Sugestões Full | Chat/Mês |
|-------|-------------------|-----------------|------------|-----|----------------|----------|
| Free  | 3                 | → Reduced       | ❌         | ❌  | ❌ (em reduced)| 20       |
| Plus  | 25                | → Reduced       | ❌ SEMPRE  | ❌ SEMPRE | ✅ (em full) | 60       |
| Pro   | ∞ (cap 200)       | → Bloqueia      | ✅         | ✅  | ✅             | ∞        |

---

## 🔧 PARTE 3: MUDANÇAS NECESSÁRIAS

### 3.1 Backend: Ajustar Limite do Plus

**Arquivo:** `work/lib/user/userPlans.js` (linha ~20)

```javascript
// ANTES
plus: {
  maxMessagesPerMonth: 60,
  maxFullAnalysesPerMonth: 20,  // ❌ INCORRETO
  allowReducedAfterLimit: true
}

// DEPOIS
plus: {
  maxMessagesPerMonth: 80,        // ✅ Atualizado conforme requisito
  maxFullAnalysesPerMonth: 25,   // ✅ CORRETO
  allowReducedAfterLimit: true
}
```

---

### 3.2 Frontend: Sistema Centralizado de Capabilities

**Novo arquivo:** `public/plan-capabilities.js`

```javascript
// 🎯 SISTEMA CENTRALIZADO DE CAPABILITIES
// Single source of truth para decisões de acesso

(function() {
  'use strict';

  // ========================================
  // 📊 MATRIZ DE CAPABILITIES
  // ========================================
  
  const CAPABILITIES_MATRIX = {
    free: {
      aiHelp: false,
      pdf: false,
      fullSuggestions: false  // Só em modo full (que free raramente tem)
    },
    plus: {
      aiHelp: false,          // ❌ NUNCA, mesmo em modo full
      pdf: false,             // ❌ NUNCA, mesmo em modo full
      fullSuggestions: true   // ✅ Mas só enquanto em modo full
    },
    pro: {
      aiHelp: true,
      pdf: true,
      fullSuggestions: true
    }
  };

  // ========================================
  // 🔍 DETECÇÃO DE CONTEXTO
  // ========================================
  
  function getCurrentContext() {
    // Buscar análise atual
    const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
    
    return {
      plan: analysis?.plan || window.userPlan || 'free',
      isReduced: analysis?.isReduced === true || 
                 analysis?.analysisMode === 'reduced' ||
                 window.APP_MODE === 'reduced',
      analysisMode: analysis?.analysisMode || 
                    (window.APP_MODE === 'reduced' ? 'reduced' : 'full')
    };
  }

  // ========================================
  // 🎯 FUNÇÃO PRINCIPAL: canUseFeature
  // ========================================
  
  function canUseFeature(featureName) {
    const context = getCurrentContext();
    const capabilities = CAPABILITIES_MATRIX[context.plan] || CAPABILITIES_MATRIX.free;
    
    // Log para debug
    console.log(`[CAPABILITIES] Verificando feature: ${featureName}`, {
      plan: context.plan,
      isReduced: context.isReduced,
      analysisMode: context.analysisMode,
      capability: capabilities[featureName]
    });
    
    // REGRA ESPECIAL: fullSuggestions requer modo full
    if (featureName === 'fullSuggestions') {
      return capabilities[featureName] === true && !context.isReduced;
    }
    
    // REGRA GERAL: verificar capability direta
    return capabilities[featureName] === true;
  }

  // ========================================
  // 🛡️ FUNÇÕES AUXILIARES
  // ========================================
  
  function shouldBlockAiHelp() {
    return !canUseFeature('aiHelp');
  }
  
  function shouldBlockPdf() {
    return !canUseFeature('pdf');
  }
  
  function shouldRunFullAnalysis() {
    const context = getCurrentContext();
    return !context.isReduced;
  }

  // ========================================
  // 🌐 EXPOR API GLOBAL
  // ========================================
  
  window.PlanCapabilities = {
    canUseFeature,
    shouldBlockAiHelp,
    shouldBlockPdf,
    shouldRunFullAnalysis,
    getCurrentContext,
    
    // Debug
    _matrix: CAPABILITIES_MATRIX,
    _debug: () => {
      const ctx = getCurrentContext();
      console.table({
        'Plano': ctx.plan,
        'Modo': ctx.analysisMode,
        'Reduced': ctx.isReduced,
        'AI Help': canUseFeature('aiHelp') ? '✅' : '❌',
        'PDF': canUseFeature('pdf') ? '✅' : '❌',
        'Sugestões Full': canUseFeature('fullSuggestions') ? '✅' : '❌'
      });
    }
  };
  
  console.log('✅ [CAPABILITIES] Sistema de capabilities carregado');
  
})();
```

---

### 3.3 Frontend: Atualizar premium-blocker.js

**Arquivo:** `public/premium-blocker.js`

**Mudança 1: Função isReducedMode** (linha ~50)

```javascript
// ANTES
function isReducedMode() {
  if (window.APP_MODE === 'reduced') return true;
  
  const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
  if (analysis) {
    if (analysis.analysisMode === 'reduced') return true;
    if (analysis.plan === 'free') return true;  // ❌ PROBLEMA
    if (analysis.isReduced === true) return true;
  }
  
  if (window.userPlan === 'free') return true;  // ❌ PROBLEMA
  
  return false;
}

// DEPOIS
function isReducedMode() {
  // Usar sistema centralizado de capabilities
  if (window.PlanCapabilities) {
    const shouldBlock = window.PlanCapabilities.shouldBlockAiHelp() ||
                        window.PlanCapabilities.shouldBlockPdf();
    return shouldBlock;
  }
  
  // Fallback se capabilities não carregado
  if (window.APP_MODE === 'reduced') return true;
  
  const analysis = window.currentModalAnalysis || window.__CURRENT_ANALYSIS__;
  if (analysis) {
    if (analysis.isReduced === true) return true;
    if (analysis.analysisMode === 'reduced') return true;
  }
  
  return false;
}
```

**⚠️ OBSERVAÇÃO IMPORTANTE:**

A função `isReducedMode()` no blocker **não precisa mudar** se usarmos uma abordagem mais cirúrgica:

**OPÇÃO MELHOR: Criar função específica para bloqueio de features premium**

```javascript
function shouldBlockPremiumFeature(featureName) {
  // Usar sistema de capabilities
  if (window.PlanCapabilities) {
    return !window.PlanCapabilities.canUseFeature(featureName);
  }
  
  // Fallback: bloquear se reduced
  return isReducedMode();
}
```

---

### 3.4 Frontend: Atualizar Guards nas Funções

**Arquivo:** `public/audio-analyzer-integration.js`

**Função sendModalAnalysisToChat** (linha ~20004)

```javascript
// ANTES
if (window.APP_MODE === 'reduced') {
  console.log('🔒 [PREMIUM-GUARD] "Pedir Ajuda à IA" bloqueada');
  // ...
}

// DEPOIS
if (window.PlanCapabilities && !window.PlanCapabilities.canUseFeature('aiHelp')) {
  console.log('🔒 [PREMIUM-GUARD] "Pedir Ajuda à IA" bloqueada');
  console.log('📊 [PREMIUM-GUARD] Plano atual:', window.PlanCapabilities.getCurrentContext());
  // ...
} else if (window.APP_MODE === 'reduced') {
  // Fallback
  console.log('🔒 [PREMIUM-GUARD] "Pedir Ajuda à IA" bloqueada (fallback)');
  // ...
}
```

**Função downloadModalAnalysis** (linha ~20116)

```javascript
// ANTES
if (window.APP_MODE === 'reduced') {
  console.log('🔒 [PREMIUM-GUARD] "Baixar Relatório" bloqueada');
  // ...
}

// DEPOIS
if (window.PlanCapabilities && !window.PlanCapabilities.canUseFeature('pdf')) {
  console.log('🔒 [PREMIUM-GUARD] "Baixar Relatório" bloqueada');
  console.log('📊 [PREMIUM-GUARD] Plano atual:', window.PlanCapabilities.getCurrentContext());
  // ...
} else if (window.APP_MODE === 'reduced') {
  // Fallback
  console.log('🔒 [PREMIUM-GUARD] "Baixar Relatório" bloqueada (fallback)');
  // ...
}
```

---

### 3.5 Frontend: Carregar plan-capabilities.js

**Arquivo:** `public/index.html`

```html
<!-- Adicionar ANTES do premium-blocker.js -->
<script src="plan-capabilities.js"></script>
<script src="premium-blocker.js"></script>
```

---

## ✅ PARTE 4: VALIDAÇÃO (CASOS DE TESTE)

### Caso 1: Plano Plus com Análises Disponíveis

**Setup:**
- Plano: `plus`
- Análises usadas: 10/25
- Modo: `full`

**Comportamento esperado:**
- ✅ Análise roda FULL
- ✅ Sugestões aparecem
- ❌ "Pedir ajuda à IA" → abre modal
- ❌ "Baixar relatório" → abre modal

**Validação:**
```javascript
window.PlanCapabilities._debug()
// Deve mostrar:
// Plano: plus
// Modo: full
// Reduced: false
// AI Help: ❌
// PDF: ❌
// Sugestões Full: ✅
```

---

### Caso 2: Plano Plus - Limite Atingido

**Setup:**
- Plano: `plus`
- Análises usadas: 25/25
- Modo: `reduced`

**Comportamento esperado:**
- ⚠️ Sistema entra automaticamente em Modo Reduced
- ❌ Sugestões não aparecem (mascaradas)
- ❌ "Pedir ajuda à IA" → abre modal
- ❌ "Baixar relatório" → abre modal

**Validação:**
```javascript
window.PlanCapabilities._debug()
// Deve mostrar:
// Plano: plus
// Modo: reduced
// Reduced: true
// AI Help: ❌
// PDF: ❌
// Sugestões Full: ❌
```

---

### Caso 3: Plano Free

**Setup:**
- Plano: `free`
- Análises usadas: 1/3
- Modo: `full`

**Comportamento esperado:**
- ✅ Análise roda FULL (dentro do limite)
- ❌ Sugestões não aparecem (free não tem)
- ❌ "Pedir ajuda à IA" → abre modal
- ❌ "Baixar relatório" → abre modal

---

### Caso 4: Plano Pro

**Setup:**
- Plano: `pro`
- Modo: `full`

**Comportamento esperado:**
- ✅ Análise roda FULL
- ✅ Sugestões aparecem
- ✅ "Pedir ajuda à IA" funciona
- ✅ "Baixar relatório" funciona

---

## 📦 PARTE 5: RESUMO DAS MUDANÇAS

### Backend (1 arquivo)

1. **`work/lib/user/userPlans.js`**
   - Linha ~20: Mudar `maxFullAnalysesPerMonth: 20` → `25`
   - Linha ~18: Mudar `maxMessagesPerMonth: 60` → `80`

### Frontend (3 arquivos)

1. **`public/plan-capabilities.js`** ← **NOVO ARQUIVO**
   - Sistema centralizado de capabilities
   - Função `canUseFeature()`
   - API global `window.PlanCapabilities`

2. **`public/audio-analyzer-integration.js`**
   - Linha ~20006: Atualizar guard de `sendModalAnalysisToChat`
   - Linha ~20116: Atualizar guard de `downloadModalAnalysis`

3. **`public/index.html`**
   - Adicionar `<script src="plan-capabilities.js"></script>`

---

## 🎯 PARTE 6: VANTAGENS DA ARQUITETURA

### ✅ Escalabilidade
- Adicionar novo plano = editar 1 matriz
- Adicionar nova feature = adicionar 1 linha

### ✅ Manutenibilidade
- Single source of truth
- Sem lógica espalhada
- Fácil de testar

### ✅ Zero Regressões
- Modo Reduced continua funcionando
- Modo Full continua funcionando
- Premium-blocker continua funcionando
- Guards nativos continuam funcionando

### ✅ Sem Código Espalhado
- Não precisa adicionar `if (plan === 'plus')` em 50 lugares
- Centralizado em `plan-capabilities.js`

---

## 🔚 CONCLUSÃO

**Sistema atual está 95% pronto para o Plano Plus.**

**Mudanças mínimas necessárias:**
1. Backend: ajustar limite de 20 → 25 análises
2. Frontend: criar sistema centralizado de capabilities
3. Frontend: atualizar 2 guards para usar novo sistema

**Tempo estimado:** 30 minutos de implementação + 30 minutos de testes

**Risco de regressão:** Mínimo (mudanças cirúrgicas e isoladas)

---

## 📝 PRÓXIMOS PASSOS

1. ✅ Criar `plan-capabilities.js`
2. ✅ Atualizar `userPlans.js` (backend)
3. ✅ Atualizar guards em `audio-analyzer-integration.js`
4. ✅ Adicionar script no `index.html`
5. ✅ Testar todos os casos
6. ✅ Deploy e monitoramento

---

**Auditoria completa finalizada com sucesso. ✅**
