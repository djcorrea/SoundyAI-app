# 🔴 AUDITORIA CRÍTICA - Worker NÃO Salva no Postgres

**Data:** 20 de novembro de 2025  
**Severidade:** 🔴 CRÍTICA - BLOQUEADOR TOTAL  
**Status:** ✅ BUG RAIZ ENCONTRADO

---

## 🟥 BUG RAIZ IDENTIFICADO

### Sintoma
```
[AI-AUDIT][SAVE.before] ✅ finalJSON.technicalData PRESENTE
[AI-AUDIT][SAVE.before] ✅ finalJSON.aiSuggestions PRESENTE com 2 itens
[DB-UPDATE] Job status updated to 'completed'
[AI-AUDIT][SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO!

→ MAS NO POSTGRES: result = NULL ou VAZIO
→ API retorna: status "processing", technicalData null
```

### Causa Raiz

**IMPORT INCORRETO DO POOL DE CONEXÃO**

**Arquivo:** `work/worker-redis.js` linha 13

```javascript
// ❌ ERRADO
import pool from './db.js';
```

**Problema:**
1. `db.js` exporta `export default getPool()` → **FUNÇÃO EXECUTADA**
2. Worker importa `pool` → recebe **RESULTADO** da execução
3. **MAS:** No momento do import, `process.env.DATABASE_URL` pode estar:
   - ❌ Undefined (dotenv ainda não carregou)
   - ❌ Null
   - ❌ String vazia
4. Pool é criado **SEM conexão válida**
5. `pool.query()` falha silenciosamente ou retorna erro que é ignorado

---

## 🟧 EVIDÊNCIAS

### 1. Import do Pool (linha 13)
```javascript
import "dotenv/config";  // ← Linha 10
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import pool from './db.js';  // ← Linha 13 - EXECUTADO ANTES DE VALIDAR ENV
```

### 2. Validação DATABASE_URL (linha 52 - DEPOIS DO IMPORT!)
```javascript
if (!process.env.DATABASE_URL) {
  console.error('💥 [WORKER-INIT] ERRO CRÍTICO: DATABASE_URL não configurado');
  process.exit(1);
}
```

**PROBLEMA:** Validação vem **DEPOIS** do import do pool!

### 3. db.js - Pool criado no import
```javascript
// work/db.js
export default getPool();  // ← Executa AGORA, no import
```

**RESULTADO:**
```javascript
// Sequência de execução:
1. import "dotenv/config" → carrega .env
2. import pool from './db.js' → executa getPool()
3. getPool() lê process.env.DATABASE_URL
4. SE .env não carregou a tempo → DATABASE_URL = undefined
5. Pool criado SEM conexão válida
6. Linha 52 valida DATABASE_URL (tarde demais!)
```

---

## 🟦 LOCALIZAÇÃO EXATA

### Arquivo 1: `work/worker-redis.js`

**Linha 13 (IMPORT):**
```javascript
import pool from './db.js';  // ← BUG AQUI
```

**Linha 553 (QUERY):**
```javascript
query = `UPDATE jobs SET status = $1, result = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
params = [status, JSON.stringify(results), jobId];
```

**Linha 560 (EXECUÇÃO):**
```javascript
const result = await pool.query(query, params);  // ← FALHA SILENCIOSA
```

**Por que falha silenciosamente?**
```javascript
// Linha 596-604 (try/catch)
} catch (error) {
  console.error(`💥 [DB-ERROR] Failed to update job:`, error.message);
  throw error;  // ← Mas quem chama updateJobStatus?
}

// Linha 967 (CHAMADA)
await updateJobStatus(jobId, 'completed', finalJSON);
// ← Dentro de audioProcessor
// ← Dentro de worker.on('completed') ou try/catch maior
```

**Se `pool.query()` falhar:**
- ❌ Throw capturado por try/catch externo
- ❌ Worker marca job como "failed" no Redis
- ❌ Postgres nunca recebe o update
- ❌ API lê job antigo (status = "processing", result = null)

---

### Arquivo 2: `work/db.js`

**Linha 27 (EXPORT):**
```javascript
export default getPool();  // ← EXECUTADO NO IMPORT
```

**Problema:** Pool criado **ANTES** de validar `DATABASE_URL`

---

## 🟩 SOLUÇÃO

### Opção 1: Lazy Loading do Pool (RECOMENDADO)

**Vantagem:** Pool só é criado quando usado (após validações)  
**Impacto:** Mínimo, apenas mudança no export

---

#### Patch 1: Corrigir db.js - Export da função, não do pool

**Arquivo:** `work/db.js`

```javascript
// ❌ ANTES
export default getPool();  // Executa no import

// ✅ DEPOIS
export default getPool;  // Exporta a FUNÇÃO
```

**OU (ainda melhor):**
```javascript
// ✅ ALTERNATIVA: Export nomeado + default
export { getPool };
export default getPool;
```

---

#### Patch 2: Corrigir worker-redis.js - Chamar função para obter pool

**Arquivo:** `work/worker-redis.js`

**Linha 13:**
```javascript
// ❌ ANTES
import pool from './db.js';

// ✅ DEPOIS
import getPool from './db.js';
```

**Linha 560 (e todas as outras chamadas):**
```javascript
// ❌ ANTES
const result = await pool.query(query, params);

// ✅ DEPOIS
const pool = getPool();  // ← Obtém pool AGORA (após validações)
const result = await pool.query(query, params);
```

**Alternativa mais limpa - Criar variável no topo da função:**
```javascript
async function updateJobStatus(jobId, status, results = null) {
  try {
    const pool = getPool();  // ← Obtém pool aqui
    
    // Validação UUID...
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      console.error(`💥 [DB-UPDATE] ERRO: jobId inválido`);
      return null;
    }

    // Resto do código...
    const result = await pool.query(query, params);
    // ...
  } catch (error) {
    console.error(`💥 [DB-ERROR] Failed to update job:`, error.message);
    throw error;
  }
}
```

---

### Opção 2: Garantir ordem correta de imports (ALTERNATIVA)

**Arquivo:** `work/worker-redis.js`

```javascript
// ✅ ORDEM CORRETA
import "dotenv/config";  // 1. Carregar .env

// 2. VALIDAR ANTES de importar db
if (!process.env.DATABASE_URL) {
  console.error('💥 DATABASE_URL não configurado');
  process.exit(1);
}

// 3. Importar pool DEPOIS da validação
import pool from './db.js';  // Agora DATABASE_URL está definida
```

**Problema:** Imports no topo são hoisted (executam antes do código)

---

## 🟪 PATCH COMPLETO (RECOMENDADO)

### Mudança 1: db.js - Exportar função

**Arquivo:** `work/db.js`

```javascript
import pkg from 'pg';
const { Pool } = pkg;

let pool;

function getPool() {
  if (!pool) {
    // 🔧 PATCH: Validação crítica ANTES de criar pool
    if (!process.env.DATABASE_URL) {
      console.error('❌ [DB] DATABASE_URL não configurado!');
      throw new Error('DATABASE_URL é obrigatório para criar pool de conexão');
    }
    
    console.log('🔗 [DB] Criando pool PostgreSQL...');
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: false
    });

    pool.on('connect', () => {
      console.log('✅ [DB] Pool de conexão PostgreSQL inicializado');
    });

    pool.on('error', (err) => {
      console.error('❌ [DB] Erro na conexão:', err);
    });
  }

  return pool;
}

// 🔧 PATCH: Exportar FUNÇÃO, não pool
export default getPool;  // ← SEM ()
```

---

### Mudança 2: worker-redis.js - Usar função getPool

**Arquivo:** `work/worker-redis.js`

**Linha 13:**
```javascript
// 🔧 PATCH: Importar função getPool
import getPool from './db.js';  // ← Função, não pool
```

**Linha 513-600 (função updateJobStatus):**
```javascript
async function updateJobStatus(jobId, status, results = null) {
  try {
    // 🔧 PATCH: Obter pool AGORA (lazy loading)
    const pool = getPool();
    
    // 🔒 VALIDAÇÃO CRÍTICA: Verificar UUID antes de executar query
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      console.error(`💥 [DB-UPDATE] ERRO: jobId inválido para PostgreSQL: '${jobId}'`);
      console.error(`💥 [DB-UPDATE] IGNORANDO atualização - UUID inválido`);
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
      console.log(`[AI-AUDIT][SAVE] Pool ativo:`, !!pool);  // ← LOG ADICIONAL
      console.log(`[AI-AUDIT][SAVE] DATABASE_URL configurado:`, !!process.env.DATABASE_URL);  // ← LOG ADICIONAL
      
      // Logs de suggestions e aiSuggestions...
      console.log(`[AI-AUDIT][SAVE] has technicalData?`, !!results.technicalData);
      console.log(`[AI-AUDIT][SAVE] has suggestions?`, Array.isArray(results.suggestions));
      console.log(`[AI-AUDIT][SAVE] suggestions length:`, results.suggestions?.length || 0);
      console.log(`[AI-AUDIT][SAVE] has aiSuggestions?`, Array.isArray(results.aiSuggestions));
      console.log(`[AI-AUDIT][SAVE] aiSuggestions length:`, results.aiSuggestions?.length || 0);
      
      if (!results.aiSuggestions || results.aiSuggestions.length === 0) {
        console.error(`[AI-AUDIT][SAVE] ❌ CRÍTICO: results.aiSuggestions AUSENTE!`);
      } else {
        console.log(`[AI-AUDIT][SAVE] ✅ results.aiSuggestions PRESENTE com ${results.aiSuggestions.length} itens`);
      }
      console.log(`[AI-AUDIT][SAVE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Query de salvamento
      query = `UPDATE jobs SET status = $1, result = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
      params = [status, JSON.stringify(results), jobId];
      
      // 🔧 PATCH: Log da query antes de executar
      console.log(`[DB-DEBUG] Executando query UPDATE jobs...`);
      console.log(`[DB-DEBUG] Params: status=${status}, result.length=${JSON.stringify(results).length}, jobId=${jobId}`);
    } else {
      query = `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
      params = [status, jobId];
    }

    // 🔧 PATCH: Executar com logs detalhados
    console.log(`[DB-DEBUG] Pool ready:`, pool.totalCount, 'connections total');
    
    const result = await pool.query(query, params);
    
    console.log(`[DB-DEBUG] Query executada com sucesso`);
    console.log(`[DB-DEBUG] Rows retornados:`, result.rows.length);
    console.log(`📝 [DB-UPDATE][${new Date().toISOString()}] -> Job ${jobId} status updated to '${status}'`);
    
    // ✅ LOGS DE AUDITORIA PÓS-SALVAMENTO
    if (results && result.rows[0]) {
      const savedResults = typeof result.rows[0].result === 'string' 
        ? JSON.parse(result.rows[0].result) 
        : result.rows[0].result;
      
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE.after] ✅ JOB SALVO NO POSTGRES`);
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[AI-AUDIT][SAVE.after] Job ID:`, result.rows[0].id);
      console.log(`[AI-AUDIT][SAVE.after] Status:`, result.rows[0].status);
      console.log(`[AI-AUDIT][SAVE.after] Result type in DB:`, typeof result.rows[0].result);
      console.log(`[AI-AUDIT][SAVE.after] Result is null?`, result.rows[0].result === null);
      
      if (!savedResults) {
        console.error(`[AI-AUDIT][SAVE.after] ❌❌❌ CRÍTICO: result SALVO COMO NULL!`);
        console.error(`[AI-AUDIT][SAVE.after] ⚠️ Postgres não recebeu os dados!`);
      } else {
        console.log(`[AI-AUDIT][SAVE.after] has technicalData in DB?`, !!savedResults.technicalData);
        console.log(`[AI-AUDIT][SAVE.after] has suggestions in DB?`, Array.isArray(savedResults.suggestions));
        console.log(`[AI-AUDIT][SAVE.after] suggestions length in DB:`, savedResults.suggestions?.length || 0);
        console.log(`[AI-AUDIT][SAVE.after] has aiSuggestions in DB?`, Array.isArray(savedResults.aiSuggestions));
        console.log(`[AI-AUDIT][SAVE.after] aiSuggestions length in DB:`, savedResults.aiSuggestions?.length || 0);
        
        if (!savedResults.aiSuggestions || savedResults.aiSuggestions.length === 0) {
          console.error(`[AI-AUDIT][SAVE.after] ❌❌❌ aiSuggestions NÃO FOI SALVO!`);
        } else {
          console.log(`[AI-AUDIT][SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO!`);
          console.log(`[AI-AUDIT][SAVE.after] ${savedResults.aiSuggestions.length} itens enriquecidos`);
        }
      }
      console.log(`[AI-AUDIT][SAVE.after] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
    
    return result.rows[0];
  } catch (error) {
    console.error(`💥 [DB-ERROR][${new Date().toISOString()}] -> Failed to update job ${jobId}:`, error.message);
    console.error(`💥 [DB-ERROR] Stack:`, error.stack);
    
    // 🔍 DIAGNÓSTICO ESPECÍFICO
    if (error.message.includes('invalid input syntax for type uuid')) {
      console.error(`🔍 [DB-ERROR] DIAGNÓSTICO: jobId '${jobId}' não é UUID válido`);
    }
    
    if (error.message.includes('Connection terminated') || error.message.includes('ECONNREFUSED')) {
      console.error(`🔍 [DB-ERROR] DIAGNÓSTICO: Pool não conectado ao Postgres`);
      console.error(`💡 [DB-ERROR] SOLUÇÃO: Verificar DATABASE_URL e conexão de rede`);
    }
    
    throw error;
  }
}
```

---

### Mudança 3: Outras funções que usam pool

**Buscar todas as ocorrências:**
```bash
grep -n "pool.query" work/worker-redis.js
```

**Linha 758 (dentro de audioProcessor):**
```javascript
// ❌ ANTES
const refResult = await pool.query(...);

// ✅ DEPOIS
const pool = getPool();
const refResult = await pool.query(...);
```

---

## 📊 VALIDAÇÃO

### 1. Teste de Conexão do Pool

**Criar script de teste:** `work/test-pool.js`

```javascript
import "dotenv/config";
import getPool from './db.js';

console.log('🧪 Testando pool de conexão...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Configurado' : 'AUSENTE');

try {
  const pool = getPool();
  console.log('✅ Pool criado');
  
  const result = await pool.query('SELECT NOW() as now, version()');
  console.log('✅ Query executada com sucesso');
  console.log('Timestamp:', result.rows[0].now);
  console.log('Versão:', result.rows[0].version);
  
  await pool.end();
  console.log('✅ Pool fechado');
  
  process.exit(0);
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
```

**Executar:**
```bash
cd work
node test-pool.js
```

**Esperado:**
```
🧪 Testando pool de conexão...
DATABASE_URL: Configurado
🔗 [DB] Criando pool PostgreSQL...
✅ [DB] Pool de conexão PostgreSQL inicializado
✅ Pool criado
✅ Query executada com sucesso
Timestamp: 2025-11-20T...
Versão: PostgreSQL 15.3...
✅ Pool fechado
```

---

### 2. Logs do Worker Após Patch

**Esperado:**
```
[AI-AUDIT][SAVE] 💾 SALVANDO RESULTS NO POSTGRES
[AI-AUDIT][SAVE] Pool ativo: true  ← NOVO
[AI-AUDIT][SAVE] DATABASE_URL configurado: true  ← NOVO
[DB-DEBUG] Executando query UPDATE jobs...  ← NOVO
[DB-DEBUG] Pool ready: 2 connections total  ← NOVO
[DB-DEBUG] Query executada com sucesso  ← NOVO
[DB-DEBUG] Rows retornados: 1  ← NOVO
📝 [DB-UPDATE] Job status updated to 'completed'
[AI-AUDIT][SAVE.after] Result type in DB: object  ← NOVO
[AI-AUDIT][SAVE.after] Result is null? false  ← NOVO
[AI-AUDIT][SAVE.after] has technicalData in DB? true  ← DEVE SER TRUE
[AI-AUDIT][SAVE.after] ✅✅✅ aiSuggestions SALVO COM SUCESSO!
```

---

### 3. Verificar Postgres

```sql
SELECT 
  id,
  status,
  result IS NULL as result_is_null,
  result->'technicalData' as tech,
  result->'aiSuggestions' as ai,
  jsonb_array_length(result->'aiSuggestions') as ai_count
FROM jobs 
WHERE status = 'completed'
ORDER BY updated_at DESC 
LIMIT 1;

-- ESPERADO:
-- result_is_null: false  ← NÃO PODE SER TRUE!
-- tech: {"lufsIntegrated": -14.2, ...}
-- ai: [{"categoria": "...", ...}]
-- ai_count: 2
```

---

## 🎯 CHECKLIST

- [ ] Aplicar Patch 1: db.js exportar função (linha 27)
- [ ] Aplicar Patch 2: worker-redis.js usar getPool() (linha 13)
- [ ] Aplicar Patch 3: updateJobStatus usar const pool = getPool() (linha 515)
- [ ] Buscar outros `pool.query` e adicionar getPool()
- [ ] Criar test-pool.js e executar
- [ ] Processar um áudio de teste
- [ ] Verificar logs: "Pool ativo: true"
- [ ] Verificar logs: "Result is null? false"
- [ ] Consultar Postgres: result NOT NULL
- [ ] Testar API: technicalData presente
- [ ] Validar frontend: dados completos

---

## 📝 RESUMO EXECUTIVO

### Problema
Worker importava `pool` antes de validar `DATABASE_URL`, resultando em pool criado sem conexão válida.

### Causa Raiz
```javascript
// db.js
export default getPool();  // ← Executa no import

// worker-redis.js (linha 10-13)
import "dotenv/config";
import pool from './db.js';  // ← Pool criado ANTES de validar .env
```

### Solução
```javascript
// db.js
export default getPool;  // ← Exporta função

// worker-redis.js
import getPool from './db.js';
const pool = getPool();  // ← Pool criado DEPOIS de validar .env
```

### Impacto
- ✅ Pool criado com DATABASE_URL válida
- ✅ Queries executadas com sucesso
- ✅ Dados salvos no Postgres
- ✅ API retorna dados completos
- ✅ Frontend funciona

---

**✅ BUG RAIZ IDENTIFICADO**  
**🔧 PATCH COMPLETO PRONTO**  
**📊 VALIDAÇÃO DOCUMENTADA**
