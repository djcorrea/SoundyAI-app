# 🔍 AUDITORIA COMPLETA: INVERSÃO DE MENSAGENS DE ERRO (CHAT vs ANÁLISE)

**Data:** 2026-01-06  
**Auditor:** Sistema Automatizado + Revisão Manual  
**Status:** 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

---

## 📋 RESUMO EXECUTIVO

### Problema Principal
Mensagens de bloqueio/limite estão **INVERTIDAS ou GENÉRICAS**:
- Chat mostra mensagem de análise
- Análise mostra mensagem genérica ou técnica
- Sem distinção clara entre `scope=chat` e `scope=analysis`

### Causa Raiz
1. **Backend NÃO envia `scope`** - Frontend não sabe se erro veio de chat ou análise
2. **ErrorMapper ignora `scope`** - Mapeia baseado apenas em `code`, não em contexto
3. **Catch blocks perdem dados** - `createJob` faz `throw new Error(string)` perdendo JSON estruturado

---

## 🗺️ FASE 1: MAPEAMENTO COMPLETO

### 1.1 ENDPOINTS DO BACKEND QUE RETORNAM BLOQUEIOS

#### `/api/chat` (work/api/chat.js)
| Status | Code | Payload |
|--------|------|---------|
| 429 | `RATE_LIMIT_EXCEEDED` | `{ error, message, retryAfter }` |
| 403 | `LIMIT_REACHED` | `{ error, message, remaining, plan, limit }` |
| 403 | `SYSTEM_PEAK_USAGE` | `{ error, message, remaining, plan, limit }` |
| 403 | `IMAGE_PEAK_USAGE` | `{ error, message, remaining, plan, limit }` |
| 500 | `LIMIT_CHECK_ERROR` | `{ error, message }` |

**🔴 PROBLEMA:** Payload NÃO inclui `scope: "chat"`

#### `/api/audio/analyze` (work/api/audio/analyze.js)
| Status | Code | Payload |
|--------|------|---------|
| 403 | `DEMO_LIMIT_REACHED` | `{ success, error, message, requiresLogin }` |
| 403 | `PLAN_REQUIRED` | `{ success, error, message, feature, currentPlan }` |
| 403 | `LIMIT_REACHED` | `{ success, error, message, remainingFull, plan, mode }` |
| 403 | `SYSTEM_PEAK_USAGE` | `{ success, error, message, remainingFull, plan, mode }` |
| 500 | `LIMIT_CHECK_ERROR` | `{ success, error, message }` |

**🔴 PROBLEMA:** Payload NÃO inclui `scope: "analysis"`

---

### 1.2 HANDLERS DO FRONTEND

#### script.js - Chat Handler (linhas 1755-1870)
```
fetch('/api/chat') 
  → response.status === 429 → preserva errorData 
  → response.status === 403 → { error: errorData.code, message } ← PERDE dados!
  → ErrorMapper.mapErrorToUi({ code, plan, feature: 'chat' }) 
  → renderChatError()
```

**🟡 PARCIALMENTE CORRETO:** Passa `feature: 'chat'` mas ErrorMapper ignora isso

#### audio-analyzer-integration.js - Analysis Handler (linhas 4517-4570)
```
fetch('/api/audio/analyze')
  → !response.ok → throw new Error(`Erro ao criar job: ${status} - ${errorText}`) ← PERDE TUDO!
  → catch(error) → showModalError(error.message)
  → ErrorMapper tentando extrair code do texto via regex ← FRÁGIL!
```

**🔴 CRÍTICO:** Não extrai JSON estruturado, apenas texto cru

---

### 1.3 FLUXO DE ERRO ATUAL (DEFEITUOSO)

```
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: /api/chat retorna 403                                   │
│ { error: "LIMIT_REACHED", plan: "free", limit: 20 }             │
│ ⚠️ SEM scope: "chat"                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: script.js linha 1762                                   │
│ data = { error: errorData.code || 'FORBIDDEN', ... }            │
│ ⚠️ Pode perder plan/limit se estrutura diferente                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ ErrorMapper.mapErrorToUi({                                       │
│   code: "LIMIT_REACHED",                                         │
│   plan: data.plan,                                               │
│   feature: "chat"  ← hardcoded pelo caller                       │
│ })                                                               │
│ ⚠️ Ignora feature, usa CODE_TO_TEMPLATE["LIMIT_REACHED"]        │
│    → Template "ANALYSIS_LIMIT_REACHED" ← ERRADO!                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI EXIBIDA:                                                      │
│ "📊 Limite de análises atingido"  ← ERRADO! Era chat!           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1.4 MAPEAMENTO CODE_TO_TEMPLATE ATUAL (error-mapper.js linha 232)

```javascript
const CODE_TO_TEMPLATE = {
    'LIMIT_REACHED': 'ANALYSIS_LIMIT_REACHED',       // ← SEMPRE análise!
    'CHAT_LIMIT_REACHED': 'CHAT_LIMIT_REACHED',      // ← Nunca usado pelo backend
    'MESSAGE_LIMIT_REACHED': 'CHAT_LIMIT_REACHED',   // ← Nunca usado pelo backend
}
```

**🔴 PROBLEMA:** Backend envia `LIMIT_REACHED` para AMBOS (chat e análise).
O mapper não consegue distinguir sem `scope`.

---

### 1.5 FLUXO DE ANÁLISE (PROBLEMA ADICIONAL)

```
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: /api/audio/analyze retorna 403                          │
│ { success: false, error: "LIMIT_REACHED", plan: "plus", ...}    │
│ ⚠️ SEM scope: "analysis"                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: audio-analyzer-integration.js linha 4517               │
│ const errorText = await response.text();                         │
│ throw new Error(`Erro ao criar job: ${response.status} - ${errorText}`);
│ ❌ PERDA TOTAL DO JSON ESTRUTURADO!                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ catch (error) - linha 11460                                      │
│ showModalError(error.message)                                    │
│ → message = "Erro ao criar job: 403 - {\"success\":false,...}"  │
│ ❌ JSON como string na UI!                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ showModalError() tenta extrair code via REGEX (linha 13457)      │
│ const codePatterns = [/SYSTEM_PEAK_USAGE/i, /LIMIT_REACHED/i...] │
│ ⚠️ FRÁGIL! Depende de texto não escapado no error.message       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 FASE 2: CONTRATO PADRONIZADO

### 2.1 NOVO FORMATO DE ERRO (PROPOSTA)

```typescript
interface BlockResponse {
  success: false;
  code: "LIMIT_REACHED" | "FEATURE_LOCKED" | "SYSTEM_PEAK_USAGE" | "RATE_LIMIT" | "AUTH_REQUIRED";
  scope: "chat" | "analysis";
  feature?: "chat" | "analysis_genre" | "analysis_reference" | "askAI" | "images";
  plan: "free" | "plus" | "pro" | "studio";
  meta: {
    cap: number;
    used: number;
    remaining: number;
    resetDate: string; // ISO date
  };
  // Mensagem técnica para logs (NÃO exibir na UI)
  _debug?: string;
}
```

### 2.2 MUDANÇAS NECESSÁRIAS NO BACKEND

#### work/api/chat.js - Adicionar scope
```javascript
return sendResponse(403, {
  error: chatCheck.errorCode || 'LIMIT_REACHED',
  scope: 'chat',                              // ✅ NOVO
  feature: hasImages ? 'images' : 'chat',     // ✅ NOVO
  message: errorMessage,
  remaining: chatCheck.remaining,
  plan: chatCheck.user.plan,
  limit: limits.maxMessagesPerMonth,
  meta: {                                      // ✅ NOVO
    cap: limits.maxMessagesPerMonth,
    used: user.messagesMonth,
    remaining: chatCheck.remaining,
    resetDate: getNextResetDate()
  }
});
```

#### work/api/audio/analyze.js - Adicionar scope
```javascript
return res.status(403).json({
  success: false,
  error: analysisCheck.errorCode || "LIMIT_REACHED",
  scope: 'analysis',                           // ✅ NOVO
  feature: mode === 'reference' ? 'analysis_reference' : 'analysis_genre', // ✅ NOVO
  message: errorMessage,
  remainingFull: analysisCheck.remainingFull,
  plan: analysisCheck.user.plan,
  mode: analysisCheck.mode,
  meta: {                                      // ✅ NOVO
    cap: limits.maxFullAnalysesPerMonth,
    used: user.analysesMonth,
    remaining: analysisCheck.remainingFull,
    resetDate: getNextResetDate()
  }
});
```

---

## 🎨 FASE 3: NOVO ERROR MAPPER

### 3.1 NOVA FUNÇÃO: mapBlockUi()

```javascript
function mapBlockUi({ scope, code, feature, plan, meta }) {
  // 1. PRIORIDADE: scope determina família de mensagens
  // 2. code determina variante específica
  // 3. plan personaliza copy
  // 4. meta fornece dados dinâmicos (cap, used, resetDate)
  
  // REGRA DE OURO: Se scope="chat", NUNCA usar copy de análise e vice-versa
}
```

### 3.2 TEMPLATES SEPARADOS POR SCOPE

```javascript
const CHAT_TEMPLATES = {
  LIMIT_REACHED: {
    icon: '💬',
    title: 'Limite de mensagens atingido',
    getMessage: (plan, meta) => {
      // Mensagens específicas para CHAT
    }
  },
  SYSTEM_PEAK_USAGE: { /* ... */ },
  IMAGE_PEAK_USAGE: { /* ... */ }
};

const ANALYSIS_TEMPLATES = {
  LIMIT_REACHED: {
    icon: '📊',
    title: 'Limite de análises atingido',
    getMessage: (plan, meta) => {
      // Mensagens específicas para ANÁLISE
    }
  },
  SYSTEM_PEAK_USAGE: { /* ... */ },
  FEATURE_LOCKED: { /* ... */ }
};
```

### 3.3 FALLBACK INTELIGENTE (quando backend não envia scope)

```javascript
function inferScope(endpoint, code) {
  // Inferir baseado no endpoint original
  if (endpoint?.includes('/api/chat')) return 'chat';
  if (endpoint?.includes('/api/audio')) return 'analysis';
  
  // Inferir baseado no código
  if (code === 'IMAGE_PEAK_USAGE') return 'chat';
  if (code === 'DEMO_LIMIT_REACHED') return 'analysis';
  
  // Default
  return 'unknown';
}
```

---

## ✅ FASE 4: CHECKLIST DE TESTES

### 4.1 Testes de Chat
- [ ] `LIMIT_REACHED` free → "💬 Você utilizou suas 20 mensagens..."
- [ ] `LIMIT_REACHED` plus → "💬 Você utilizou todas as 80 mensagens..."
- [ ] `LIMIT_REACHED` pro → "💬 Limite de 300 mensagens..."
- [ ] `LIMIT_REACHED` studio → "💬 Você atingiu o limite mensal..."
- [ ] `SYSTEM_PEAK_USAGE` → "⏳ Sistema em alta demanda..."
- [ ] `IMAGE_PEAK_USAGE` → "📸 Limite de imagens atingido..."

### 4.2 Testes de Análise
- [ ] `LIMIT_REACHED` free → "📊 Você já utilizou sua análise gratuita..."
- [ ] `LIMIT_REACHED` plus → "📊 Você utilizou todas as 20 análises..."
- [ ] `LIMIT_REACHED` pro → "📊 Você atingiu o limite de 60 análises..."
- [ ] `LIMIT_REACHED` studio → "📊 Você atingiu o limite mensal..."
- [ ] `SYSTEM_PEAK_USAGE` → "⏳ Plataforma em alta demanda..."
- [ ] `FEATURE_LOCKED` reference free → "🔒 Análise por Referência..."
- [ ] `FEATURE_LOCKED` reference plus → "🔒 Análise por Referência..."

### 4.3 Testes de Consistência
- [ ] Nenhum erro mostra JSON cru
- [ ] Nenhum erro mostra status code
- [ ] Nenhum erro mostra "Algo deu errado" quando code é conhecido
- [ ] Chat NUNCA mostra "análises" no texto
- [ ] Análise NUNCA mostra "mensagens" no texto

---

## 📁 ARQUIVOS A MODIFICAR

### Backend
1. `work/api/chat.js` - Adicionar `scope: 'chat'` em todas respostas de erro
2. `work/api/audio/analyze.js` - Adicionar `scope: 'analysis'` em todas respostas de erro
3. `work/lib/user/userPlans.js` - Adicionar helper `getNextResetDate()`

### Frontend
1. `public/error-mapper.js` - Refatorar completamente para usar `scope`
2. `public/script.js` - Preservar dados estruturados do backend
3. `public/audio-analyzer-integration.js` - Extrair JSON antes de throw, passar para showModalError

---

## 🚨 PRIORIDADE DE CORREÇÃO

1. **CRÍTICO** - `audio-analyzer-integration.js` linha 4517-4534: Extrair JSON antes de throw
2. **CRÍTICO** - `error-mapper.js`: Separar templates por scope
3. **ALTO** - Backend: Adicionar `scope` em todas respostas
4. **MÉDIO** - Frontend: Inferir scope quando backend não enviar (retrocompatibilidade)

---

## 📝 PRÓXIMOS PASSOS

1. ✅ Auditoria completa (este documento)
2. ⏳ Implementar correções no backend (adicionar scope)
3. ⏳ Refatorar error-mapper.js (separar por scope)
4. ⏳ Corrigir audio-analyzer-integration.js (extrair JSON)
5. ⏳ Testes manuais de todos os cenários
6. ⏳ Documentar copy final de cada cenário
