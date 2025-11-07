# 🚀 GUIA RÁPIDO: Interpretação dos Logs de aiSuggestions

## 📌 Objetivo
Este guia ensina como **interpretar os logs de auditoria** do fluxo de `aiSuggestions` para identificar rapidamente onde está o problema.

---

## 🔍 TAGS DE LOG

### Pipeline (Enrichment)
- `[AI-AUDIT][ULTRA_DIAG]` - Logs do pipeline-complete.js e suggestion-enricher.js
- `[AI-AUDIT][SAVE.before]` - Worker antes de salvar no Postgres
- `[AI-AUDIT][SAVE]` - Worker durante salvamento
- `[AI-AUDIT][SAVE.after]` - Worker confirmando salvamento no Postgres
- `[AI-AUDIT][API.out]` - API retornando dados ao frontend

---

## 📊 FLUXO NORMAL (SUCESSO)

```
[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA...
[AI-AUDIT][ULTRA_DIAG] ✅ 3 sugestões enriquecidas retornadas
[AI-AUDIT][SAVE.before] has aiSuggestions? true
[AI-AUDIT][SAVE.before] aiSuggestions length: 3
[AI-AUDIT][SAVE.before] ✅ finalJSON.aiSuggestions contém 3 itens
[AI-AUDIT][SAVE] has aiSuggestions? true
[AI-AUDIT][SAVE] aiSuggestions length: 3
[AI-AUDIT][SAVE] ✅ results.aiSuggestions PRESENTE com 3 itens
[AI-AUDIT][SAVE.after] has aiSuggestions in DB? true
[AI-AUDIT][SAVE.after] aiSuggestions length in DB: 3
[AI-AUDIT][SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO! ✅✅✅
[AI-AUDIT][API.out] ✅ aiSuggestions (IA enriquecida) sendo enviadas: 3
```

**DIAGNÓSTICO:** ✅ Sistema funcionando perfeitamente - todos os pontos OK

---

## ❌ CENÁRIOS DE ERRO

### Cenário 1: Falha no Enrichment da IA

```
[AI-AUDIT][ULTRA_DIAG] 🚀 Enviando sugestões base para IA...
[AI-AUDIT][ULTRA_DIAG] ❌ Falha ao executar enrichSuggestionsWithAI: Timeout exceeded
[AI-AUDIT][SAVE.before] has aiSuggestions? false
[AI-AUDIT][SAVE.before] ❌ CRÍTICO: finalJSON.aiSuggestions está vazio!
[AI-AUDIT][SAVE.before] Mode: reference
```

**DIAGNÓSTICO:** ❌ Problema no enrichment (OpenAI API)
- **Causa:** Timeout, API key inválida, erro de parse JSON, ou OpenAI offline
- **Arquivo:** work/lib/ai/suggestion-enricher.js
- **Solução:**
  1. Verificar `process.env.OPENAI_API_KEY` está definida
  2. Testar conectividade: `curl https://api.openai.com/v1/models`
  3. Verificar logs detalhados do suggestion-enricher.js

---

### Cenário 2: Dados Perdidos no Worker

```
[AI-AUDIT][ULTRA_DIAG] ✅ 3 sugestões enriquecidas retornadas
[AI-AUDIT][SAVE.before] has aiSuggestions? true
[AI-AUDIT][SAVE.before] aiSuggestions length: 3
[AI-AUDIT][SAVE] has aiSuggestions? false ⚠️
[AI-AUDIT][SAVE] ❌ CRÍTICO: results.aiSuggestions AUSENTE no objeto results!
```

**DIAGNÓSTICO:** ❌ Dados perdidos entre linha 720 e updateJobStatus()
- **Causa:** `finalJSON` sendo modificado ou reassigned sem copiar `aiSuggestions`
- **Arquivo:** work/worker-redis.js entre linha 720 e 756
- **Solução:**
  1. Buscar por `finalJSON =` ou `delete finalJSON.aiSuggestions`
  2. Verificar se há merge com Redis que sobrescreve dados
  3. Adicionar log: `console.log('finalJSON keys:', Object.keys(finalJSON))`

---

### Cenário 3: Falha no Salvamento Postgres

```
[AI-AUDIT][SAVE] has aiSuggestions? true
[AI-AUDIT][SAVE] aiSuggestions length: 3
[AI-AUDIT][SAVE] ✅ results.aiSuggestions PRESENTE com 3 itens
[AI-AUDIT][SAVE.after] has aiSuggestions in DB? false ⚠️
[AI-AUDIT][SAVE.after] ❌❌❌ CRÍTICO: aiSuggestions NÃO FOI SALVO NO POSTGRES!
```

**DIAGNÓSTICO:** ❌ Problema no PostgreSQL ou na query
- **Causa:** Truncamento de JSON, limite de tamanho do campo, ou erro no parse
- **Arquivo:** work/worker-redis.js updateJobStatus()
- **Solução:**
  1. Verificar tamanho do JSON: `console.log('JSON size:', JSON.stringify(results).length)`
  2. Query PostgreSQL: `SELECT pg_column_size(results) FROM jobs WHERE id = '<uuid>'`
  3. Verificar tipo do campo: `\d jobs` (deve ser JSONB ou TEXT longo)

---

### Cenário 4: API não Retorna (mesmo com DB OK)

```
[AI-AUDIT][SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO!
[AI-AUDIT][SAVE.after] 3 itens enriquecidos disponíveis
[AI-AUDIT][API.out] ⚠️ aiSuggestions ausente - IA pode não ter sido executada ⚠️
```

**DIAGNÓSTICO:** ❌ Problema no endpoint API
- **Causa:** Merge incorreto do `results` ou `result` no retorno da API
- **Arquivo:** api/jobs/[id].js linha 42-79
- **Solução:**
  1. Verificar parse: `const resultData = job.results || job.result`
  2. Verificar merge: `response = { ...fullResult }`
  3. Log temporário: `console.log('fullResult.aiSuggestions:', fullResult.aiSuggestions)`

---

## 🔎 COMANDOS DE DIAGNÓSTICO

### 1. Verificar Logs do Worker
```bash
# Filtrar apenas logs de aiSuggestions
grep "aiSuggestions" worker.log | grep "\[AI-AUDIT\]"

# Ver fluxo completo de um job específico
grep "<job-uuid>" worker.log | grep "\[AI-AUDIT\]"
```

### 2. Verificar Postgres Diretamente
```sql
-- Ver se aiSuggestions está no banco
SELECT 
  id, 
  status, 
  results->'aiSuggestions' AS ai_suggestions,
  jsonb_array_length(results->'aiSuggestions') AS ai_count
FROM jobs 
WHERE mode = 'reference' 
ORDER BY created_at DESC 
LIMIT 5;
```

### 3. Verificar API Response
```bash
# Fazer request direto
curl http://localhost:3000/api/jobs/<uuid> | jq '.aiSuggestions | length'

# Deve retornar número > 0 se funcionando
```

---

## 🎯 CHECKLIST RÁPIDO

### ✅ Sistema Funcionando
- [ ] `[ULTRA_DIAG] ✅ X sugestões enriquecidas`
- [ ] `[SAVE.before] ✅ finalJSON.aiSuggestions contém X itens`
- [ ] `[SAVE] ✅ results.aiSuggestions PRESENTE`
- [ ] `[SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO`
- [ ] `[API.out] ✅ aiSuggestions sendo enviadas`

### ❌ Sistema com Problema
Identifique o PRIMEIRO checkpoint que falha:

| Checkpoint | Falha Aqui? | Arquivo para Investigar |
|------------|-------------|-------------------------|
| `[ULTRA_DIAG]` | ❌ | work/lib/ai/suggestion-enricher.js |
| `[SAVE.before]` | ❌ | work/api/audio/pipeline-complete.js |
| `[SAVE]` | ❌ | work/worker-redis.js (linha 720-756) |
| `[SAVE.after]` | ❌ | work/worker-redis.js updateJobStatus() |
| `[API.out]` | ❌ | api/jobs/[id].js |

---

## 🛠️ TROUBLESHOOTING ESPECÍFICO

### Problema: "Timeout exceeded"
```
[AI-AUDIT][ULTRA_DIAG] ❌ Tipo: Timeout (25s excedido)
```
**Solução:**
1. Reduzir número de sugestões base (máximo 5)
2. Aumentar timeout em suggestion-enricher.js linha 65: `setTimeout(() => controller.abort(), 30000)`
3. Verificar latência da OpenAI: `time curl https://api.openai.com/v1/models`

---

### Problema: "Failed to parse JSON"
```
[AI-AUDIT][ULTRA_DIAG] ❌ Tipo: Erro de parse JSON
```
**Solução:**
1. Verificar resposta bruta da OpenAI no log
2. Regex de extração está em suggestion-enricher.js linha 105: `/\{[\s\S]*\}/`
3. Testar prompt manualmente na OpenAI Playground

---

### Problema: Modo Genre OK, Reference Falha
```
Mode: genre → [SAVE.after] ✅ aiSuggestions SALVO
Mode: reference → [SAVE.before] ❌ aiSuggestions vazio
```
**Solução:**
1. Comparar chamadas de enrichment no pipeline-complete.js:
   - Linha 321 (reference sucesso)
   - Linha 362 (reference not found)
   - Linha 384 (reference error)
   - Linha 405 (genre mode)
2. Verificar se `mode: 'reference'` está sendo passado corretamente
3. Verificar se `referenceComparison` está presente no contexto

---

## 📞 CONTATO RÁPIDO

**Se ainda estiver com problemas após usar este guia:**
1. Cole os logs de `[AI-AUDIT]` no chat
2. Informe o modo de análise (genre/reference)
3. Informe o jobId UUID para rastreamento

---

**📅 Atualizado:** 2025-01-XX  
**🔖 Versão:** 1.0 - Guia de Interpretação de Logs
