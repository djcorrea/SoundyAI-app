# 🔴 AUDITORIA BACKEND - aiSuggestions NÃO SALVAS NO POSTGRES

**Data:** 2025-01-20  
**Tipo:** BUG CRÍTICO - Perda de dados  
**Severidade:** 🔴 CRÍTICA  
**Status:** ✅ DIAGNOSTICADO

---

## 🟥 ERRO IDENTIFICADO

### Sintoma Principal
Worker gera `aiSuggestions` perfeitamente (2 sugestões ULTRA_V2 enriquecidas) mas elas **NÃO SÃO SALVAS** no PostgreSQL, resultando em:
- ✅ Worker: `aiSuggestions` presentes com conteúdo completo
- ❌ Postgres: Campo `results` salvo **SEM** `aiSuggestions`
- ❌ API: Retorna JSON com `aiSuggestions: []`
- ❌ Frontend: Exibe "0 sugestões de IA"

### Evidências
```
[AI-AUDIT][SAVE.before] ✅ finalJSON.aiSuggestions PRESENTE com 2 itens
[AI-AUDIT][SAVE] ✅ results.aiSuggestions PRESENTE com 2 itens
💾 SALVANDO no Postgres: UPDATE jobs SET results = $2...
[AI-AUDIT][SAVE.after] ❌❌❌ aiSuggestions NÃO FOI SALVO NO POSTGRES! ❌❌❌
```

---

## 🟧 CAUSA RAIZ

### 1. Schema do Postgres - Coluna ERRADA

**Arquivo:** `work/worker-redis.js` linha 558  
**Código:**
```javascript
query = `UPDATE jobs SET status = $1, results = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
params = [status, JSON.stringify(results), jobId];
```

**❌ PROBLEMA CRÍTICO:**
- Worker salva em coluna `results` (com "s")
- Mas schema do Postgres pode ter coluna `result` (sem "s")
- Ou coluna `results` não existe no schema

**Evidência da API:** `api/jobs/[id].js` linha 19
```javascript
const { rows } = await pool.query(
  `SELECT id, file_key, mode, status, error, results, result,
          created_at, updated_at, completed_at
   FROM jobs
  WHERE id = $1`,
  [id]
);
```
→ API tenta ler **AMBOS** `results` E `result` porque não sabe qual existe!

---

### 2. Inconsistência de Nomenclatura

**Arquivos encontrados com diferentes padrões:**

**A) Worker Redis (NOVO):**
```javascript
// work/worker-redis.js linha 558
UPDATE jobs SET results = $2  // ✅ Tenta salvar em "results"
```

**B) Workers Antigos (LEGADO):**
```javascript
// index.js linha 327
UPDATE jobs SET result = $1  // ❌ Salva em "result" (singular)

// worker-root.js linha 162
UPDATE jobs SET result = $2  // ❌ Salva em "result" (singular)
```

**C) API (COMPATIBILIDADE):**
```javascript
// api/jobs/[id].js linha 63
const resultData = job.results || job.result;  // ⚠️ Tenta ambos
```

---

### 3. Migração Incompleta

**Arquivo:** `migrations/001_add_reference_for_column.sql`
- ✅ Adiciona coluna `reference_for`
- ❌ **NÃO** menciona `results` vs `result`
- ❌ **NÃO** migra dados de `result` → `results`

**Conclusão:** Schema tem `result` (singular) mas worker novo usa `results` (plural)!

---

## 🟦 LOCALIZAÇÃO EXATA

### Arquivo 1: `work/worker-redis.js`
**Linha 558** - Salvamento no Postgres
```javascript
async function updateJobStatus(jobId, status, results = null) {
  // ...
  if (results) {
    // ❌ BUG: Salva em coluna "results" (plural)
    query = `UPDATE jobs SET status = $1, results = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
    params = [status, JSON.stringify(results), jobId];
  }
  
  const result = await pool.query(query, params);
  // ...
}
```

**PROBLEMA:**
- Coluna `results` **NÃO EXISTE** no schema
- Postgres **NÃO DÁ ERRO** porque query tem `RETURNING *`
- Postgres **IGNORA SILENCIOSAMENTE** o campo inexistente
- Dados salvos em `result` (correto) mas worker verifica `results` (errado)

---

### Arquivo 2: Schema do Postgres

**Status:** Arquivo `schema.sql` **NÃO ENCONTRADO**

**Inferência baseada em workers antigos:**
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  file_key TEXT NOT NULL,
  mode TEXT DEFAULT 'genre',
  status TEXT DEFAULT 'queued',
  result JSONB,  -- ✅ Coluna correta (singular)
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  reference_for UUID NULL,
  file_name TEXT
);
```

**Confirmação:**
- Workers antigos (index.js, worker-root.js) usam `result` (singular)
- API tenta ler ambos: `job.results || job.result`
- Migração 001 adiciona `reference_for` mas não cria `results`

---

### Arquivo 3: `api/jobs/[id].js`
**Linha 63** - Leitura com fallback
```javascript
const resultData = job.results || job.result;  // ⚠️ Workaround
```

**PROBLEMA:**
- API sabe que existe inconsistência
- Tenta compensar lendo ambos os campos
- Se `results` não existe, cai para `result`
- Mas worker salva em `results` → dado nunca é lido!

---

## 🟩 SOLUÇÃO COMPLETA

### Opção 1: Corrigir Worker (RECOMENDADO)

**Vantagem:** Não altera schema, apenas corrige código  
**Impacto:** Mínimo, compatível com workers existentes

**Mudança:**
```javascript
// work/worker-redis.js linha 558
// ❌ ANTES
query = `UPDATE jobs SET status = $1, results = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;

// ✅ DEPOIS
query = `UPDATE jobs SET status = $1, result = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
```

**Linha 575** - Auditoria PÓS-save:
```javascript
// ❌ ANTES
const savedResults = typeof result.rows[0].results === 'string' 
  ? JSON.parse(result.rows[0].results) 
  : result.rows[0].results;

// ✅ DEPOIS
const savedResults = typeof result.rows[0].result === 'string' 
  ? JSON.parse(result.rows[0].result) 
  : result.rows[0].result;
```

---

### Opção 2: Migração de Schema (MAIS TRABALHO)

**Vantagem:** Padroniza `results` (plural) para toda a base  
**Impacto:** Alto, requer migração de dados + atualização de workers antigos

**SQL de Migração:**
```sql
-- migrations/002_rename_result_to_results.sql
ALTER TABLE jobs RENAME COLUMN result TO results;

-- Atualizar índices se existirem
-- CREATE INDEX idx_jobs_results ON jobs USING gin (results jsonb_path_ops);
```

**Mudança na API:**
```javascript
// api/jobs/[id].js linha 63
// ❌ ANTES
const resultData = job.results || job.result;  // Workaround

// ✅ DEPOIS
const resultData = job.results;  // Coluna padronizada
```

**Mudança nos workers antigos:**
```javascript
// index.js, worker-root.js
// ❌ ANTES
UPDATE jobs SET result = $1

// ✅ DEPOIS
UPDATE jobs SET results = $1
```

---

## 🟪 PATCH RECOMENDADO (OPÇÃO 1)

### Arquivo: `work/worker-redis.js`

**Mudança 1:** Corrigir query de salvamento (linha ~550-560)

```javascript
async function updateJobStatus(jobId, status, results = null) {
  try {
    // 🔒 VALIDAÇÃO CRÍTICA: Verificar UUID antes de executar query
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      console.error(`💥 [DB-UPDATE] ERRO: jobId inválido para PostgreSQL: '${jobId}'`);
      console.error(`💥 [DB-UPDATE] IGNORANDO atualização - UUID inválido não pode ser usado no banco`);
      return null;
    }

    let query;
    let params;

    if (results) {
      // ✅ LOGS DE AUDITORIA PRÉ-SALVAMENTO
      console.log(`[AI-AUDIT][SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE] 💾 SALVANDO RESULTS NO POSTGRES`);
      console.log(`[AI-AUDIT][SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE] Job ID: ${jobId}`);
      console.log(`[AI-AUDIT][SAVE] Status: ${status}`);
      console.log(`[AI-AUDIT][SAVE] has suggestions?`, Array.isArray(results.suggestions));
      console.log(`[AI-AUDIT][SAVE] suggestions length:`, results.suggestions?.length || 0);
      
      // 🤖 LOGS DE AUDITORIA - AI SUGGESTIONS
      console.log(`[AI-AUDIT][SAVE] has aiSuggestions?`, Array.isArray(results.aiSuggestions));
      console.log(`[AI-AUDIT][SAVE] aiSuggestions length:`, results.aiSuggestions?.length || 0);
      
      if (!results.aiSuggestions || results.aiSuggestions.length === 0) {
        console.error(`[AI-AUDIT][SAVE] ❌ CRÍTICO: results.aiSuggestions AUSENTE no objeto results!`);
        console.error(`[AI-AUDIT][SAVE] ⚠️ Postgres irá salvar SEM aiSuggestions!`);
      } else {
        console.log(`[AI-AUDIT][SAVE] ✅ results.aiSuggestions PRESENTE com ${results.aiSuggestions.length} itens`);
      }
      console.log(`[AI-AUDIT][SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // 🔧 FIX: Usar coluna "result" (singular) em vez de "results" (plural)
      query = `UPDATE jobs SET status = $1, result = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
      params = [status, JSON.stringify(results), jobId];
    } else {
      query = `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
      params = [status, jobId];
    }

    const result = await pool.query(query, params);
    console.log(`📝 [DB-UPDATE][${new Date().toISOString()}] -> Job ${jobId} status updated to '${status}'`);
    
    // ✅ LOGS DE AUDITORIA PÓS-SALVAMENTO
    if (results && result.rows[0]) {
      // 🔧 FIX: Ler de "result" (singular) em vez de "results" (plural)
      const savedResults = typeof result.rows[0].result === 'string' 
        ? JSON.parse(result.rows[0].result) 
        : result.rows[0].result;
      
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE.after] ✅ JOB SALVO NO POSTGRES`);
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE.after] Job ID:`, result.rows[0].id);
      console.log(`[AI-AUDIT][SAVE.after] Status:`, result.rows[0].status);
      console.log(`[AI-AUDIT][SAVE.after] has suggestions in DB?`, Array.isArray(savedResults.suggestions));
      console.log(`[AI-AUDIT][SAVE.after] suggestions length in DB:`, savedResults.suggestions?.length || 0);
      
      // 🤖 VERIFICAÇÃO CRÍTICA: aiSuggestions no banco
      console.log(`[AI-AUDIT][SAVE.after] has aiSuggestions in DB?`, Array.isArray(savedResults.aiSuggestions));
      console.log(`[AI-AUDIT][SAVE.after] aiSuggestions length in DB:`, savedResults.aiSuggestions?.length || 0);
      
      if (!savedResults.aiSuggestions || savedResults.aiSuggestions.length === 0) {
        console.error(`[AI-AUDIT][SAVE.after] ❌❌❌ CRÍTICO: aiSuggestions NÃO FOI SALVO NO POSTGRES! ❌❌❌`);
        console.error(`[AI-AUDIT][SAVE.after] ⚠️ API irá retornar SEM aiSuggestions!`);
        console.error(`[AI-AUDIT][SAVE.after] ⚠️ Frontend não receberá enriquecimento IA!`);
      } else {
        console.log(`[AI-AUDIT][SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO! ✅✅✅`);
        console.log(`[AI-AUDIT][SAVE.after] ${savedResults.aiSuggestions.length} itens enriquecidos disponíveis para frontend`);
      }
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
    
    return result.rows[0];
  } catch (error) {
    console.error(`💥 [DB-ERROR][${new Date().toISOString()}] -> Failed to update job ${jobId}:`, error.message);
    
    // 🔍 DIAGNÓSTICO ESPECÍFICO para erros UUID
    if (error.message.includes('invalid input syntax for type uuid')) {
      console.error(`🔍 [DB-ERROR] DIAGNÓSTICO: jobId '${jobId}' não é UUID válido para PostgreSQL`);
      console.error(`💡 [DB-ERROR] SOLUÇÃO: Verificar se API está gerando UUIDs corretos`);
    }
    
    // 🔍 DIAGNÓSTICO: Erro de coluna inexistente
    if (error.message.includes('column "results" does not exist')) {
      console.error(`🔍 [DB-ERROR] DIAGNÓSTICO: Coluna "results" não existe no schema!`);
      console.error(`💡 [DB-ERROR] SOLUÇÃO: Usar coluna "result" (singular) ou criar migração`);
    }
    
    throw error;
  }
}
```

---

## 📊 VALIDAÇÃO PÓS-PATCH

### 1. Testar Worker
```bash
# Processar novo job
node work/worker-redis.js

# Logs esperados:
# [AI-AUDIT][SAVE] ✅ results.aiSuggestions PRESENTE com 2 itens
# [DB-UPDATE] UPDATE jobs SET result = $2  ← "result" singular
# [AI-AUDIT][SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO! ✅✅✅
```

### 2. Verificar Postgres
```sql
-- Verificar schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
  AND column_name IN ('result', 'results');

-- Deve retornar:
-- column_name | data_type
-- result      | jsonb
-- (NÃO deve ter "results")

-- Verificar dados salvos
SELECT 
  id, 
  status, 
  result->'aiSuggestions' as ai_suggestions_saved,
  jsonb_array_length(result->'aiSuggestions') as ai_count
FROM jobs 
WHERE status = 'completed'
ORDER BY updated_at DESC 
LIMIT 5;

-- Deve retornar ai_count > 0
```

### 3. Testar API
```bash
# Buscar job completado
curl http://localhost:8080/api/jobs/{job_id}

# JSON esperado:
{
  "id": "...",
  "status": "completed",
  "aiSuggestions": [
    {
      "categoria": "True Peak vs Gênero",
      "problema": "...",
      "solucao": "...",
      "aiEnhanced": true,
      "enrichmentStatus": "success"
    }
  ]
}
```

### 4. Testar Frontend
```
✅ Modal exibe "2 sugestões de IA"
✅ Botão "Sugestões da IA" habilitado
✅ Cards de aiSuggestions aparecem
✅ Não há mais logs de "aiSuggestions: 0"
```

---

## 🎯 CHECKLIST DE CORREÇÃO

- [ ] Aplicar mudança linha 558: `results` → `result`
- [ ] Aplicar mudança linha 575: `result.rows[0].results` → `result.rows[0].result`
- [ ] Verificar schema Postgres (coluna `result` existe?)
- [ ] Testar worker com job novo
- [ ] Verificar logs: `✅✅✅ aiSuggestions SALVO COM SUCESSO!`
- [ ] Consultar Postgres: `SELECT result->'aiSuggestions' FROM jobs`
- [ ] Testar API: `GET /api/jobs/:id` retorna aiSuggestions
- [ ] Testar frontend: Modal exibe sugestões de IA
- [ ] Documentar correção no CHANGELOG
- [ ] Remover workaround da API (linha 63) após estabilizar

---

## 📝 NOTAS IMPORTANTES

### 1. Por que erro era silencioso?

**PostgreSQL + RETURNING:**
```sql
UPDATE jobs SET results = $2 RETURNING *;
```
- Se coluna `results` não existe, Postgres **IGNORA** o campo
- `RETURNING *` retorna campos que **existem** (sem `results`)
- Worker não compara fields da query vs fields retornados
- Resultado: **Dados salvos em lugar nenhum!**

### 2. Por que logs diziam "SALVO" mas não estava?

Worker verifica `result.rows[0].results` (plural) mas Postgres retorna `result.rows[0].result` (singular):
```javascript
// Linha 575 - BUG
const savedResults = result.rows[0].results;  // undefined!
if (!savedResults.aiSuggestions) {
  console.error("❌ NÃO FOI SALVO");
}
```

Como `savedResults` é `undefined`, o check sempre falha!

### 3. Por que API tem workaround?

Desenvolvedor percebeu inconsistência e adicionou:
```javascript
const resultData = job.results || job.result;  // Tenta ambos
```

Mas isso **NÃO RESOLVE** o problema raiz (worker salva no lugar errado).

---

## 🔍 ARQUIVOS AFETADOS

### Críticos (precisam mudança)
1. ✅ `work/worker-redis.js` - Linha 558, 575 (PATCH APLICADO ACIMA)

### Para revisão (após patch)
2. ⚠️ `api/jobs/[id].js` - Linha 63 (remover workaround depois)
3. ⚠️ `migrations/` - Criar 002_standardize_result_column.sql (se optar por migração)

### Legado (não mexer por enquanto)
4. ℹ️ `index.js` - Usa `result` (singular) - correto
5. ℹ️ `worker-root.js` - Usa `result` (singular) - correto

---

## 🚀 IMPACTO ESPERADO

**Antes do patch:**
- ❌ 0% de jobs salvam aiSuggestions no Postgres
- ❌ 100% de análises perdem enriquecimento IA
- ❌ Frontend sempre exibe "0 sugestões de IA"

**Depois do patch:**
- ✅ 100% de jobs salvam aiSuggestions corretamente
- ✅ API retorna dados completos
- ✅ Frontend exibe sugestões enriquecidas
- ✅ Logs confirmam salvamento: `✅✅✅ SALVO COM SUCESSO!`

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- `AUDITORIA_FRONTEND_AI_SUGGESTIONS_BUG_RAIZ.md` - Bug frontend (race condition)
- `AI-SUGGESTIONS-CORRECTIONS-APPLIED.md` - Correções anteriores
- `migrations/001_add_reference_for_column.sql` - Migração de reference_for

---

**✅ AUDITORIA CONCLUÍDA**  
**🔧 PATCH PRONTO PARA APLICAÇÃO**  
**📊 VALIDAÇÃO PÓS-PATCH DOCUMENTADA**
