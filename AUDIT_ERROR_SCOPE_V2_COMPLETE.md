# 🎯 AUDIT: ERROR SCOPE V2 - Correção de Mensagens Invertidas

**Data:** 2025-01-27
**Status:** ✅ IMPLEMENTADO

## 📋 PROBLEMA ORIGINAL

Mensagens de erro estavam **invertidas** entre chat e análise:
- Limite de chat exibia: "Limite de **análises** atingido"
- Limite de análise exibia: "Limite de **mensagens** atingido"

### Causa Raiz
O `ErrorMapper` V1 mapeava o código `LIMIT_REACHED` sempre para `ANALYSIS_LIMIT_REACHED` usando `CODE_TO_TEMPLATE`, ignorando completamente o contexto (scope) da requisição.

---

## ✅ SOLUÇÃO IMPLEMENTADA

### Fase 1: Backend - Contrato com SCOPE

Todos os endpoints de erro 403 agora retornam um payload estruturado com `scope`:

```json
{
  "code": "LIMIT_REACHED",
  "scope": "chat" | "analysis",
  "feature": "chat" | "analysis_genre" | "analysis_reference",
  "plan": "free" | "plus" | "pro" | "studio",
  "message": "Limite atingido...",
  "meta": {
    "cap": 20,
    "used": 20,
    "remaining": 0,
    "resetDate": "2025-02-01"
  }
}
```

**Arquivos Modificados:**
1. `work/api/chat.js` - Added `scope: 'chat'`, `feature`, `meta`
2. `work/api/audio/analyze.js` - Added `scope: 'analysis'`, `feature`, `meta`
3. `work/lib/entitlements.js` - Updated `buildPlanRequiredResponse` with scope

### Fase 2: Frontend - ErrorMapper V2

Refatorado para usar **templates separados por scope**:

**Arquivo:** `public/error-mapper.js`

```javascript
// Antes: Um só template para LIMIT_REACHED
CODE_TO_TEMPLATE = {
  'LIMIT_REACHED': 'ANALYSIS_LIMIT_REACHED' // 🔴 SEMPRE análise!
}

// Depois: Templates separados por scope
const CHAT_TEMPLATES = {
  LIMIT_REACHED: { icon: '💬', title: 'Limite de mensagens atingido', ... }
}
const ANALYSIS_TEMPLATES = {
  LIMIT_REACHED: { icon: '📊', title: 'Limite de análises atingido', ... }
}

// Nova função principal
mapBlockUi({ scope, code, feature, plan, meta }) {
  const templates = scope === 'chat' ? CHAT_TEMPLATES : ANALYSIS_TEMPLATES;
  return templates[code];
}
```

### Fase 3: Integração Frontend

**Arquivo:** `public/audio-analyzer-integration.js`
- `createAnalysisJob()`: Preserva JSON estruturado em vez de `throw new Error(texto)`
- `showModalError()`: Extrai `scope` e chama `mapBlockUi()`

**Arquivo:** `public/script.js`
- Tratamento de erros de chat agora usa `mapBlockUi({ scope: 'chat', ... })`

---

## 📊 TABELA DE MAPEAMENTO FINAL

| Código Backend | Scope Chat | Scope Analysis |
|----------------|-----------|----------------|
| LIMIT_REACHED | 💬 Limite de **mensagens** | 📊 Limite de **análises** |
| SYSTEM_PEAK_USAGE | ⏳ Sistema em alta demanda | ⏳ Plataforma em alta demanda |
| IMAGE_PEAK_USAGE | 📸 Limite de imagens atingido | - |
| FEATURE_LOCKED | - | 🔒 Recurso Premium |
| AUTH_REQUIRED | 🔑 Login necessário (para conversar) | 🔑 Login necessário (para analisar) |

---

## 🔒 REGRA DE OURO

> **Se `scope="chat"`, NUNCA exibir copy de análise.**
> **Se `scope="analysis"`, NUNCA exibir copy de chat.**

---

## 🧪 CHECKLIST DE TESTE

### Chat (scope: chat)
- [ ] Enviar mensagem até atingir limite → Ver "Limite de **mensagens** atingido"
- [ ] Enviar imagem até atingir limite → Ver "Limite de **imagens** atingido"
- [ ] Sistema em pico → Ver "Sistema em alta demanda"

### Análise (scope: analysis)
- [ ] Analisar áudio até atingir limite → Ver "Limite de **análises** atingido"
- [ ] Tentar análise por referência no Free → Ver "Recurso Premium"
- [ ] Sistema em pico → Ver "Plataforma em alta demanda"

### Cross-check crítico
- [ ] Atingir limite de chat e verificar que NÃO menciona "análise"
- [ ] Atingir limite de análise e verificar que NÃO menciona "mensagem"

---

## 📁 ARQUIVOS MODIFICADOS

| Arquivo | Mudança |
|---------|---------|
| `work/api/chat.js` | Added `scope:'chat'`, `feature`, `meta` to 403 responses |
| `work/api/audio/analyze.js` | Added `scope:'analysis'`, `feature`, `meta` to 403 responses |
| `work/lib/entitlements.js` | Updated `buildPlanRequiredResponse(plan, used, scope)` |
| `public/error-mapper.js` | Complete rewrite V2 with `CHAT_TEMPLATES`, `ANALYSIS_TEMPLATES`, `mapBlockUi()` |
| `public/audio-analyzer-integration.js` | Preserve JSON in errors, use `mapBlockUi()` in `showModalError()` |
| `public/script.js` | Use `mapBlockUi({ scope:'chat' })` for chat errors |

---

## 🔧 API ErrorMapper V2

```javascript
// Nova função principal
window.ErrorMapper.mapBlockUi({
  scope: 'chat' | 'analysis', // OBRIGATÓRIO para mensagem correta
  code: 'LIMIT_REACHED',      // Código do backend
  feature: 'chat',            // Feature específica
  plan: 'free',               // Plano do usuário
  meta: {                     // Metadados
    cap: 20,
    used: 20,
    resetDate: '2025-02-01'
  }
})

// Retorna
{
  icon: '💬',
  title: 'Limite de mensagens atingido',
  message: 'Você utilizou suas 20 mensagens...',
  primaryCta: { label: '✨ Ver Planos', action: 'upgrade' },
  severity: 'limit',
  _debug: { scope: 'chat', code: 'LIMIT_REACHED', ... }
}

// Compatibilidade V1
window.ErrorMapper.mapErrorToUi({ code, plan, feature, meta })
// Internamente chama inferScope() e mapBlockUi()
```

---

## ✅ CONCLUSÃO

O sistema agora diferencia corretamente mensagens de erro entre chat e análise usando o campo `scope` enviado pelo backend. A inversão de mensagens foi corrigida na raiz.
