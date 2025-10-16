# 🔍 TROUBLESHOOTING: API Key não detectada

**Data:** 16 de outubro de 2025  
**Problema:** `⚠️ [AI-LAYER] API Key não configurada - usando sugestões originais`

---

## ✅ CORREÇÕES APLICADAS

### 1. **Função async não aguardada**
**Problema:** `autoConfigureApiKey()` é async, mas o construtor não pode esperar  
**Solução:** Chamada dentro de `process()` antes de verificar a chave

```javascript
async process(existingSuggestions, analysisContext) {
    // 🔑 GARANTIR que a API Key foi carregada (aguardar se necessário)
    if (!this.apiKey || this.apiKey === 'demo-mode') {
        console.log('🔄 [AI-LAYER] Tentando carregar API Key...');
        await this.autoConfigureApiKey();
    }
    
    // Validações iniciais
    if (!this.apiKey || this.apiKey === 'demo-mode') {
        console.warn('⚠️ [AI-LAYER] API Key não configurada - usando sugestões originais');
        return existingSuggestions;
    }
    // ...
}
```

### 2. **Logs de debug detalhados**
Adicionados logs para rastrear cada passo:

```javascript
🔍 [AI-LAYER] Iniciando auto-configuração da API Key...
🌐 [AI-LAYER] Tentando buscar do backend /api/config...
📡 [AI-LAYER] Response status: 200
📦 [AI-LAYER] Config recebida: { configured: true, hasKey: true, keyPreview: 'sk-proj-...' }
🔑 [AI-LAYER] ✅ API Key carregada do backend (Railway)
```

---

## 🧪 COMO VALIDAR

### 1. **Verificar endpoint do backend**

No console do navegador:
```javascript
fetch('/api/config')
  .then(r => r.json())
  .then(d => console.log('Config:', d));
```

**Resultado esperado:**
```json
{
  "openaiApiKey": "sk-proj-...",
  "aiModel": "gpt-3.5-turbo",
  "configured": true
}
```

**Se retornar:**
```json
{
  "openaiApiKey": "not-configured",
  "configured": false
}
```
→ **Problema:** API Key NÃO está configurada no Railway

---

### 2. **Verificar logs no console**

Após fazer upload de um áudio, procure por:

✅ **Sucesso:**
```
🔍 [AI-LAYER] Iniciando auto-configuração da API Key...
🌐 [AI-LAYER] Tentando buscar do backend /api/config...
📡 [AI-LAYER] Response status: 200
📦 [AI-LAYER] Config recebida: {...}
🔑 [AI-LAYER] ✅ API Key carregada do backend (Railway)
🤖 [AI-LAYER] Enriquecendo 8 sugestões com IA...
✅ [AI-LAYER] 8 sugestões enriquecidas com sucesso
```

❌ **Falha:**
```
🔍 [AI-LAYER] Iniciando auto-configuração da API Key...
🌐 [AI-LAYER] Tentando buscar do backend /api/config...
❌ [AI-LAYER] Erro ao buscar do backend: Failed to fetch
⚠️ [AI-LAYER] API Key NÃO configurada
⚠️ [AI-LAYER] API Key não configurada - usando sugestões originais
```

---

## 🚨 POSSÍVEIS CAUSAS E SOLUÇÕES

### Causa 1: Railway não configurado
**Sintoma:** Endpoint retorna `"not-configured"`

**Solução:**
1. Acessar Railway Dashboard
2. Ir em **Variables**
3. Adicionar:
   ```
   OPENAI_API_KEY=sk-proj-...
   ```
4. Salvar e redeploy

---

### Causa 2: Servidor não respondendo
**Sintoma:** `Failed to fetch` ou `NetworkError`

**Solução:**
1. Verificar se `server.js` tem o endpoint:
```javascript
app.get("/api/config", (req, res) => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  // ...
});
```

2. Verificar se servidor está rodando:
```bash
# Local:
node server.js

# Railway:
railway logs
```

---

### Causa 3: CORS bloqueando requisição
**Sintoma:** `CORS policy` no console

**Solução:**
Verificar se `server.js` tem CORS configurado:
```javascript
import cors from "cors";
app.use(cors());
```

---

### Causa 4: Endpoint não retornando JSON correto
**Sintoma:** `Unexpected token` ou parsing error

**Solução:**
Verificar estrutura do endpoint:
```javascript
app.get("/api/config", (req, res) => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    res.json({  // ← Deve ser res.json(), NÃO res.send()
      openaiApiKey: openaiApiKey,
      aiModel: process.env.AI_MODEL || 'gpt-3.5-turbo',
      configured: true
    });
  } else {
    res.json({
      openaiApiKey: 'not-configured',
      configured: false
    });
  }
});
```

---

## 📊 LOGS COMPLETOS ESPERADOS

### Fluxo Completo (Sucesso):

```javascript
// 1. Upload do áudio
[AUDIO-DEBUG] 🎵 Processando análise por gênero...

// 2. Sugestões geradas
🎯 [SUGGESTIONS] Enhanced Engine: 8 sugestões geradas

// 3. AI Layer ativado
🤖 [AI-LAYER] Enriquecendo sugestões do Enhanced Engine...

// 4. Auto-configuração
🔍 [AI-LAYER] Iniciando auto-configuração da API Key...
🌐 [AI-LAYER] Tentando buscar do backend /api/config...
📡 [AI-LAYER] Response status: 200
📦 [AI-LAYER] Config recebida: { configured: true, hasKey: true }
🔑 [AI-LAYER] ✅ API Key carregada do backend (Railway)

// 5. Processamento IA
🤖 [AI-LAYER] Chamando OpenAI API (gpt-3.5-turbo)...
✅ [AI-LAYER] Resposta recebida em 1.2s

// 6. Enriquecimento aplicado
🎨 [AI-UI] Renderizando 8 sugestões enriquecidas
✅ [AI-INTEGRATION] 8 sugestões exibidas (fonte: ai)
```

---

## 🛠️ TESTE MANUAL RÁPIDO

Execute no console do navegador:

```javascript
// Teste 1: Endpoint
fetch('/api/config')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Teste 2: AI Layer
if (window.aiSuggestionLayer) {
  window.aiSuggestionLayer.autoConfigureApiKey()
    .then(() => {
      console.log('✅ API Key:', 
        window.aiSuggestionLayer.apiKey ? 
        window.aiSuggestionLayer.apiKey.substring(0, 10) + '...' : 
        'NOT CONFIGURED'
      );
    });
}
```

---

## 📞 CHECKLIST DE VALIDAÇÃO

Antes de considerar "resolvido", verificar:

- [ ] Endpoint `/api/config` retorna JSON válido
- [ ] `config.openaiApiKey` não é `"not-configured"`
- [ ] Log `🔑 [AI-LAYER] ✅ API Key carregada do backend` aparece
- [ ] Log `🤖 [AI-LAYER] Enriquecendo X sugestões com IA...` aparece
- [ ] Log `✅ [AI-LAYER] X sugestões enriquecidas com sucesso` aparece
- [ ] Sugestões exibidas têm conteúdo enriquecido (problema, causa, solução)

---

## 🔄 ÚLTIMA ALTERAÇÃO

**Commit:** `fix: API Key async aguardada antes de validação`  
**Arquivos modificados:**
- `public/ai-suggestion-layer.js` - Linha 103-115 (await autoConfigureApiKey)
- `public/ai-suggestion-layer.js` - Linha 38-60 (logs detalhados)

---

## 📚 REFERÊNCIAS

- **Documentação anterior:** `CORRECAO_API_KEY_E_VISUAL_METRICAS.md`
- **Railway Docs:** https://docs.railway.app/guides/variables
- **Fetch API:** https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API

---

**Status:** 🔧 EM TESTE  
**Próximo passo:** Validar com Railway deployed + hard refresh no browser
