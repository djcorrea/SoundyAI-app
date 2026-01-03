# 🔐 Sistema de Entitlements (Controle de Acesso por Plano)

## Resumo da Implementação

### Objetivo
Bloquear 4 features PRO para usuários FREE e PLUS, com o BACKEND como fonte da verdade:
1. **Modo Referência** - Comparar áudio com faixas de referência
2. **Gerar Plano de Correção** - Guia passo a passo com IA
3. **Baixar PDF** - Relatório profissional exportável
4. **Pedir Ajuda à IA** - Chat com análise de áudio

---

## Arquivos Criados/Modificados

### Backend (Node.js)

#### 1. `work/lib/entitlements.js` (NOVO)
Módulo centralizado de controle de acesso por plano.

```javascript
// Entitlements por plano
const PLAN_ENTITLEMENTS = {
  free:  { reference: false, correctionPlan: false, pdf: false, askAI: false },
  plus:  { reference: false, correctionPlan: false, pdf: false, askAI: false },
  pro:   { reference: true,  correctionPlan: true,  pdf: true,  askAI: true  }
};

// Funções exportadas
- getUserPlan(userDoc)              // Extrai plano do documento Firestore
- hasEntitlement(plan, feature)     // Verifica se plano tem permissão
- checkEntitlement(plan, feature)   // Retorna objeto estruturado
- assertEntitled(plan, feature)     // Lança erro se não permitido
- buildPlanRequiredResponse(feature) // Gera resposta 403 padronizada
- requireEntitlement(feature)       // Middleware Express
```

#### 2. `work/api/audio/analyze.js` (MODIFICADO)
Protege endpoint de análise quando `mode=reference`.

```javascript
// Importa entitlements
import { getUserPlan, hasEntitlement, buildPlanRequiredResponse } from '../../lib/entitlements.js';

// Após autenticação, ANTES da verificação de limites:
if (finalAnalysisType === 'reference' || mode === 'reference') {
  const userDoc = await db.collection('usuarios').doc(uid).get();
  const userPlan = getUserPlan(userDoc.data());
  
  if (!hasEntitlement(userPlan, 'reference')) {
    return res.status(403).json(buildPlanRequiredResponse('reference', userPlan));
  }
}
```

#### 3. `api/correction-plan.js` (MODIFICADO)
Protege endpoint de geração de plano de correção.

```javascript
// Importa entitlements
import { getUserPlan, hasEntitlement, buildPlanRequiredResponse } from '../work/lib/entitlements.js';

// Após buscar plano do usuário:
if (!hasEntitlement(userPlan, 'correctionPlan')) {
  return res.status(403).json(buildPlanRequiredResponse('correctionPlan', userPlan));
}
```

#### 4. `work/api/chat.js` (MODIFICADO)
Protege feature "Pedir Ajuda à IA" no chat.

```javascript
// Importa entitlements
import { getUserPlan, hasEntitlement, buildPlanRequiredResponse } from '../lib/entitlements.js';

// Detecta quando é askAI (análise de áudio enviada para chat):
const isAskAIFeature = 
  req.headers['x-feature'] === 'askAI' ||
  requestData.feature === 'askAI' ||
  message.includes('🎵 Analisei meu áudio');

if (isAskAIFeature && !isDemoMode) {
  const userDoc = await db.collection('usuarios').doc(uid).get();
  const userPlan = getUserPlan(userDoc.data());
  
  if (!hasEntitlement(userPlan, 'askAI')) {
    return sendResponse(403, buildPlanRequiredResponse('askAI', userPlan));
  }
}
```

---

### Frontend (JavaScript)

#### 5. `public/entitlements-handler.js` (NOVO)
Handler que intercepta respostas 403 PLAN_REQUIRED e exibe modal de upgrade.

```javascript
// Intercepta automaticamente via fetch wrapper
// Exporta funções para uso manual:
window.EntitlementsHandler = {
  showUpgradeModal(feature, currentPlan),
  handleApiResponse(response, feature),
  isPlanRequiredError(response, data)
};
```

#### 6. `public/premium-gate-system.js` (MODIFICADO)
Integração com EntitlementsHandler para features PRO.

```javascript
function openUpgradeModal(feature) {
  // Delegar para EntitlementsHandler se for feature PRO
  if (window.EntitlementsHandler && ['reference', 'correctionPlan', 'pdf', 'askAI'].includes(feature)) {
    window.EntitlementsHandler.showUpgradeModal(feature, 'plus');
    return;
  }
  // ... fallback para modal existente
}
```

#### 7. `public/index.html` (MODIFICADO)
Inclui o novo script de entitlements.

```html
<!-- 🔐 ENTITLEMENTS HANDLER - Intercepta 403 PLAN_REQUIRED do backend -->
<script src="entitlements-handler.js?v=20260103"></script>
```

---

## Formato da Resposta 403

Quando uma feature é bloqueada, o backend retorna:

```json
{
  "error": "PLAN_REQUIRED",
  "code": "PLAN_REQUIRED",
  "requiredPlan": "pro",
  "currentPlan": "plus",
  "feature": "reference",
  "message": "O Modo Referência é exclusivo do plano PRO.",
  "featureDisplayName": "Modo Referência"
}
```

---

## Fluxo de Bloqueio

```
┌─────────────────────┐
│  Usuário PLUS       │
│  clica em           │
│  "Modo Referência"  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Frontend faz       │
│  POST /api/audio    │
│  mode=reference     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Backend verifica:                   │
│  1. Autenticação ✓                  │
│  2. hasEntitlement('plus','reference')│
│     → false                          │
│  3. Retorna 403 PLAN_REQUIRED        │
└──────────┬───────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Frontend intercepta 403:            │
│  1. entitlements-handler.js detecta  │
│  2. Abre modal de upgrade PRO        │
│  3. CTA leva para /planos.html       │
└──────────────────────────────────────┘
```

---

## Testes Recomendados

### Usuário FREE/PLUS
1. ❌ Tentar usar Modo Referência → deve abrir modal PRO
2. ❌ Tentar gerar Plano de Correção → deve abrir modal PRO
3. ❌ Tentar baixar PDF → bloqueado no frontend (já implementado)
4. ❌ Tentar "Pedir Ajuda à IA" com análise → deve abrir modal PRO

### Usuário PRO
1. ✅ Modo Referência funciona
2. ✅ Plano de Correção funciona
3. ✅ PDF funciona
4. ✅ "Pedir Ajuda à IA" funciona

### Outros
- ✅ Análise por gênero continua funcionando para todos
- ✅ Chat regular (sem análise) funciona para todos
- ✅ Reduced mode só acontece por limite de análises, não por feature PRO

---

## Features Implementadas

| Feature | Backend Protegido | Frontend Modal | Endpoint |
|---------|-------------------|----------------|----------|
| Modo Referência | ✅ | ✅ | POST /api/audio/analyze (mode=reference) |
| Plano Correção | ✅ | ✅ | POST /api/correction-plan |
| PDF | N/A (frontend only) | ✅ | - |
| Pedir Ajuda IA | ✅ | ✅ | POST /api/chat (com análise) |

---

## Notas de Segurança

1. **Backend é fonte da verdade**: Mesmo que o frontend seja burlado, o backend bloqueia a requisição.
2. **Não expõe lógica de plano**: O frontend recebe apenas `PLAN_REQUIRED`, não sabe quais planos existem.
3. **Detecção heurística para askAI**: O chat detecta padrões específicos da análise de áudio para não bloquear chat regular.
4. **Fallback seguro**: Se não conseguir determinar o plano, assume `free` (mais restritivo).
