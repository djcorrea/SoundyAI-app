# 🚀 GUIA RÁPIDO - Logs de Diagnóstico IA (SoundyAI)

**Atualizado**: 7 de novembro de 2025

---

## 📊 LOGS ESPERADOS (SUCESSO)

### ✅ **Backend - Pipeline**

```bash
[AI-AUDIT][ULTRA_DIAG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[AI-AUDIT][ULTRA_DIAG] 🎯 INICIANDO FASE DE GERAÇÃO DE SUGESTÕES
[AI-AUDIT][ULTRA_DIAG] Arquivo: user_track.wav
[AI-AUDIT][ULTRA_DIAG] JobId: abc123xyz
[AI-AUDIT][ULTRA_DIAG] 📊 Parâmetros: { genre: 'Funk', mode: 'reference', hasReferenceJobId: true }
[AI-AUDIT][ULTRA_DIAG] ✅ Sugestões base detectadas: 5 itens
[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA...
```

### ✅ **Módulo IA - Enriquecimento**

```bash
[AI-AUDIT][ULTRA_DIAG] 🤖 INICIANDO ENRIQUECIMENTO COM IA
[AI-AUDIT][ULTRA_DIAG] 📊 Sugestões base recebidas: 5
[AI-AUDIT][ULTRA_DIAG] 📝 Prompt preparado: { caracteres: 2847, estimativaTokens: 712 }
[AI-AUDIT][ULTRA_DIAG] 🌐 Enviando requisição para OpenAI API...
[AI-AUDIT][ULTRA_DIAG] ✅ Resposta recebida da OpenAI API
[AI-AUDIT][ULTRA_DIAG] 📊 Tokens usados: { prompt: 712, completion: 453, total: 1165 }
[AI-AUDIT][ULTRA_DIAG] ✅ ENRIQUECIMENTO CONCLUÍDO COM SUCESSO
[AI-AUDIT][ULTRA_DIAG] 📊 Total de sugestões enriquecidas: 5
```

### ✅ **API - Retorno**

```bash
[AI-AUDIT][ULTRA_DIAG] 📤 RETORNANDO JOB PARA FRONTEND
[AI-AUDIT][ULTRA_DIAG] 🆔 Job ID: abc123xyz
[AI-AUDIT][ULTRA_DIAG] 🤖 aiSuggestions (IA enriquecida): { presente: true, quantidade: 5 }
[AI-AUDIT][ULTRA_DIAG] 🔄 aiSuggestions presentes no merge Redis/Postgres: true
```

### ✅ **Frontend**

```bash
[AI-SUGGESTIONS] 💎 Exibindo 5 sugestões enriquecidas com IA
```

---

## ❌ LOGS DE ERRO (DIAGNÓSTICO)

### **Erro 1: OPENAI_API_KEY não configurada**

```bash
[AI-AUDIT][ULTRA_DIAG] ⚠️ OPENAI_API_KEY não configurada - retornando sugestões base
[AI-AUDIT][ULTRA_DIAG] ⚠️ Para ativar IA: configure OPENAI_API_KEY no arquivo .env
```

**Solução**:
```bash
# Adicionar no arquivo .env
OPENAI_API_KEY=sk-proj-...sua-chave-aqui...
```

---

### **Erro 2: OpenAI API - Chave inválida (401)**

```bash
[AI-AUDIT][ULTRA_DIAG] ❌ OpenAI API erro: 401 Unauthorized
[AI-AUDIT][ULTRA_DIAG] ❌ ERRO NO ENRIQUECIMENTO IA
[AI-AUDIT][ULTRA_DIAG] 💥 Mensagem: OpenAI API error: 401
```

**Solução**:
1. Verificar se a chave está correta
2. Acessar https://platform.openai.com/api-keys
3. Gerar nova chave se necessário

---

### **Erro 3: Rate Limit Excedido (429)**

```bash
[AI-AUDIT][ULTRA_DIAG] ❌ OpenAI API erro: 429 { "error": { "message": "Rate limit exceeded" } }
```

**Solução**:
1. Aguardar 1 minuto e tentar novamente
2. Fazer upgrade do plano OpenAI (se necessário)
3. Verificar quota em https://platform.openai.com/usage

---

### **Erro 4: Quota Esgotada**

```bash
[AI-AUDIT][ULTRA_DIAG] ❌ OpenAI API erro: 429 { "error": { "message": "You exceeded your current quota" } }
```

**Solução**:
1. Adicionar créditos na conta OpenAI
2. Verificar billing em https://platform.openai.com/settings/organization/billing

---

### **Erro 5: Parse JSON Falhou**

```bash
[AI-AUDIT][ULTRA_DIAG] ❌ Erro ao fazer parse da resposta: Unexpected token
[AI-AUDIT][ULTRA_DIAG] Conteúdo (primeiros 500 chars): Here is the enriched...
```

**Solução**:
1. IA retornou texto ao invés de JSON
2. Verificar prompt em `buildEnrichmentPrompt()`
3. Adicionar mais exemplos no prompt

---

### **Erro 6: Sugestões Base Vazias**

```bash
[AI-AUDIT][ULTRA_DIAG] ⚠️ Nenhuma sugestão para enriquecer - retornando array vazio
```

**Solução**:
1. Pipeline não gerou sugestões base
2. Verificar métricas do áudio (LUFS, True Peak, etc)
3. Verificar função `generateComparisonSuggestions()`

---

## 🔍 CHECKLIST DE DIAGNÓSTICO RÁPIDO

### Se o frontend mostra: `🤖 Exibindo sugestões base (IA não configurada)`

**Verificar em ordem**:

1. ✅ **Logs do backend contêm**:
   ```bash
   [AI-AUDIT][ULTRA_DIAG] ✅ Sugestões base detectadas: X itens
   ```
   - ❌ Se não: Pipeline não gerou sugestões → verificar métricas

2. ✅ **Logs do backend contêm**:
   ```bash
   [AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA...
   ```
   - ❌ Se não: IA não foi chamada → bug no código

3. ✅ **Logs do backend contêm**:
   ```bash
   [AI-AUDIT][ULTRA_DIAG] ✅ Resposta recebida da OpenAI API
   ```
   - ❌ Se não: Verificar erro de API (401, 429, etc)

4. ✅ **Logs do backend contêm**:
   ```bash
   [AI-AUDIT][ULTRA_DIAG] ✅ ENRIQUECIMENTO CONCLUÍDO COM SUCESSO
   ```
   - ❌ Se não: Parse JSON falhou → verificar prompt

5. ✅ **Logs da API contêm**:
   ```bash
   [AI-AUDIT][ULTRA_DIAG] 🔄 aiSuggestions presentes no merge Redis/Postgres: true
   ```
   - ❌ Se não: aiSuggestions não foi salvo → verificar worker

6. ✅ **Response da API contém**:
   ```json
   {
     "aiSuggestions": [
       {
         "aiEnhanced": true,
         "enrichmentStatus": "success",
         "categoria": "LOUDNESS",
         ...
       }
     ]
   }
   ```
   - ❌ Se não: API não retornou campo → verificar `api/jobs/[id].js`

---

## 🧪 TESTE MANUAL RÁPIDO

### **1. Verificar se OPENAI_API_KEY está configurada**

```bash
# Linux/Mac
cat .env | grep OPENAI_API_KEY

# Windows PowerShell
Select-String -Path .env -Pattern "OPENAI_API_KEY"
```

**Esperado**: `OPENAI_API_KEY=sk-proj-...`

---

### **2. Testar conexão com OpenAI API**

```bash
# Via curl
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Esperado: JSON com lista de modelos incluindo "gpt-4o-mini"
```

---

### **3. Verificar logs em tempo real**

```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: Logs filtrados
npm run dev | grep -E '\[AI-AUDIT\]\[ULTRA_DIAG\]'

# Fazer upload de áudio e observar logs
```

---

### **4. Verificar resposta da API de jobs**

```bash
# Pegar ID do job após upload
JOB_ID="abc123xyz"

# Consultar API
curl http://localhost:5000/api/jobs/$JOB_ID | jq '.aiSuggestions'

# Esperado: Array com sugestões enriquecidas
```

---

## 📊 ESTATÍSTICAS DE USO

### **Consumo Médio de Tokens**

| Cenário | Prompt Tokens | Completion Tokens | Total | Custo (USD) |
|---------|---------------|-------------------|-------|-------------|
| **5 sugestões** | ~700 | ~450 | ~1150 | ~$0.0012 |
| **10 sugestões** | ~1200 | ~800 | ~2000 | ~$0.0020 |

**Modelo**: gpt-4o-mini  
**Preço**: $0.15/1M input tokens + $0.60/1M output tokens

---

## 🎯 RESUMO

### ✅ **Sistema está FUNCIONAL**

- ✅ Pipeline gera sugestões base
- ✅ IA é chamada em 4 pontos estratégicos
- ✅ OpenAI API integrada corretamente
- ✅ aiSuggestions retornado para frontend

### ⚠️ **Causas comuns de "IA não configurada"**

1. **OPENAI_API_KEY ausente** → Configurar `.env`
2. **OPENAI_API_KEY inválida** → Verificar no dashboard OpenAI
3. **Rate limit** → Aguardar ou fazer upgrade
4. **Quota esgotada** → Adicionar créditos
5. **Parse JSON falhou** → Prompt precisa ajustes

### 🔧 **Ferramentas de Debug**

```bash
# Ver logs de IA
grep '\[AI-AUDIT\]\[ULTRA_DIAG\]' server.log

# Ver tokens consumidos
grep 'Tokens usados' server.log

# Ver erros de API
grep 'OpenAI API erro' server.log

# Ver aiSuggestions retornados
grep 'aiSuggestions presentes no merge' server.log
```

---

**Documento criado**: 7 de novembro de 2025  
**Para dúvidas**: Verificar `AUDITORIA_MODULO_SUGESTOES_IA_COMPLETA.md`
