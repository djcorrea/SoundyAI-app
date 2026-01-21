# 🚀 GUIA DE DEPLOY - Ambiente TESTE Railway

**Data:** 21 de janeiro de 2026  
**Versão:** 1.0  
**Objetivo:** Configurar ambiente TESTE 100% isolado de PRODUÇÃO  
**Status:** ✅ **CÓDIGO CORRIGIDO - PRONTO PARA DEPLOY**

---

## ⚠️ IMPORTANTE: LEIA ANTES DE INICIAR

Este guia configura um ambiente de TESTE **completamente isolado** de PRODUÇÃO:
- ✅ PostgreSQL separado (banco de dados próprio)
- ✅ Redis separado (cache e filas próprias)
- ✅ Variáveis de ambiente independentes
- ✅ Logs claros sobre qual ambiente está executando

**❌ NÃO compartilhe DATABASE_URL ou REDIS_URL entre ambientes**

---

## 📋 PRÉ-REQUISITOS

- [ ] Conta no Railway com projeto criado
- [ ] Ambiente de TESTE criado no Railway (clone de produção OU novo)
- [ ] Git configurado com branch `teste` criada
- [ ] Acesso ao Railway Dashboard

---

## 🔧 ETAPA 1: CRIAR SERVIÇOS NO RAILWAY TESTE

### 1.1. Criar PostgreSQL

```
Railway Dashboard
→ Selecione o ambiente TESTE (ou crie um novo)
→ New → Database → Add PostgreSQL
→ Aguarde provisionamento (30-60 segundos)
→ Copie a variável DATABASE_URL gerada
```

**Formato esperado:**
```
postgresql://postgres:SENHA@host.railway.app:5432/railway
```

**✅ Ações após criação:**
1. Anote a `DATABASE_URL` em local seguro
2. Verifique conectividade: `Status: Running`
3. Acesse tab **Data** para executar SQL posteriormente

### 1.2. Criar Redis

```
Railway Dashboard
→ Selecione o ambiente TESTE
→ New → Database → Add Redis
→ Aguarde provisionamento (30-60 segundos)
→ Copie a variável REDIS_URL gerada
```

**Formato esperado (Railway Redis):**
```
redis://default:SENHA@host.railway.internal:6379
```

**OU use Upstash (recomendado para produção):**
```
Acesse: https://console.upstash.com/
→ Create Database → Selecione região próxima
→ Copie REDIS_URL no formato: rediss://default:SENHA@host.upstash.io:6379
```

**⚠️ IMPORTANTE:**
- Railway Redis: Usa `redis://` (sem TLS)
- Upstash: Usa `rediss://` (com TLS) - **RECOMENDADO**
- **NUNCA** use formato unix socket (`unix:///path`)

---

## 🔐 ETAPA 2: CONFIGURAR VARIÁVEIS DE AMBIENTE

### 2.1. Acessar Configuração

```
Railway Dashboard
→ Ambiente TESTE
→ Variables (aba lateral)
→ Raw Editor (para colar todas de uma vez)
```

### 2.2. Variáveis Obrigatórias

**Cole este template e substitua os valores:**

```bash
# ═══════════════════════════════════════════════════════
# 🌍 AMBIENTE (CRÍTICO - Define isolamento)
# ═══════════════════════════════════════════════════════
RAILWAY_ENVIRONMENT=test
NODE_ENV=test

# ═══════════════════════════════════════════════════════
# 🔑 BANCO DE DADOS (PostgreSQL do TESTE - NÃO use de PROD)
# ═══════════════════════════════════════════════════════
DATABASE_URL=postgresql://postgres:SENHA_TESTE@host-teste.railway.app:5432/railway

# ═══════════════════════════════════════════════════════
# 🔗 CACHE E FILAS (Redis do TESTE - NÃO use de PROD)
# ═══════════════════════════════════════════════════════
REDIS_URL=rediss://default:SENHA_TESTE@redis-teste.upstash.io:6379

# ═══════════════════════════════════════════════════════
# 🔐 FIREBASE (pode compartilhar com PROD OU criar projeto separado)
# ═══════════════════════════════════════════════════════
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"soundyai-teste",...}

# ═══════════════════════════════════════════════════════
# 📦 BACKBLAZE B2 (RECOMENDADO: Bucket separado para teste)
# ═══════════════════════════════════════════════════════
B2_KEY_ID=your_b2_key_id
B2_APP_KEY=your_b2_app_key
B2_BUCKET_NAME=soundyai-teste  # ← Bucket separado recomendado
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com

# ═══════════════════════════════════════════════════════
# 🤖 OPENAI (pode compartilhar)
# ═══════════════════════════════════════════════════════
OPENAI_API_KEY=sk-proj-...

# ═══════════════════════════════════════════════════════
# 💳 MERCADO PAGO (CRÍTICO: Use credenciais TEST)
# ═══════════════════════════════════════════════════════
MP_ACCESS_TOKEN=TEST-1234567890-...  # ← Deve começar com "TEST-"
MP_PUBLIC_KEY=TEST-...              # ← Deve começar com "TEST-"

# ═══════════════════════════════════════════════════════
# ⚙️ CONFIGURAÇÕES OPCIONAIS
# ═══════════════════════════════════════════════════════
MAX_UPLOAD_MB=150
REFERENCE_MODE_ENABLED=true
FALLBACK_TO_GENRE=true
DEBUG_REFERENCE_MODE=false
```

### 2.3. Validar Variáveis

**Checklist antes de salvar:**
- [ ] `DATABASE_URL` é do PostgreSQL **TESTE** (não de PROD)
- [ ] `REDIS_URL` é do Redis **TESTE** (não de PROD)
- [ ] `REDIS_URL` começa com `redis://` ou `rediss://` (não `unix:`)
- [ ] `RAILWAY_ENVIRONMENT=test` está configurado
- [ ] `MP_ACCESS_TOKEN` começa com `TEST-` (sandbox)
- [ ] `B2_BUCKET_NAME` é diferente de produção

**Salvar:**
```
→ Save Changes
→ Aguarde Railway reiniciar o serviço (~30s)
```

---

## 🗄️ ETAPA 3: CRIAR TABELAS NO POSTGRESQL

### 3.1. Acessar PostgreSQL Data

```
Railway Dashboard
→ Ambiente TESTE
→ PostgreSQL service
→ Tab: Data
→ Query Editor
```

### 3.2. Executar SQL de Criação

**Opção A: Usar script fornecido**

Execute o conteúdo de `SQL_CREATE_TABLES_TESTE.sql`:

```sql
-- Executar todo o conteúdo do arquivo SQL_CREATE_TABLES_TESTE.sql
-- Este arquivo cria:
-- - anonymous_usage
-- - anonymous_blocklist
-- - jobs (se não existir)
-- - chat_messages (se não existir)
-- + todos os índices necessários
```

**Opção B: Importar dump de produção (RECOMENDADO)**

Se você tem acesso ao banco de PRODUÇÃO:

```bash
# 1. Fazer dump do esquema de produção (SEM dados sensíveis)
pg_dump $DATABASE_URL_PROD --schema-only --no-owner --no-privileges > schema.sql

# 2. Restaurar no TESTE
psql $DATABASE_URL_TESTE < schema.sql
```

### 3.3. Verificar Tabelas Criadas

```sql
-- Listar todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Resultado esperado:
-- anonymous_blocklist
-- anonymous_usage
-- chat_messages
-- jobs
-- user_plans (etc)
```

---

## 🚀 ETAPA 4: DEPLOY DO CÓDIGO

### 4.1. Commit das Correções

```bash
cd /path/to/SoundyAI

# Verificar arquivos modificados
git status

# Adicionar correções
git add db.js work/db.js lib/queue.js server.js work/worker-redis.js

# Commit com mensagem descritiva
git commit -m "fix: validação obrigatória de DATABASE_URL e REDIS_URL

Correções aplicadas:
- Validação fail-fast em db.js (root e work/)
- Validação de formato REDIS_URL em lib/queue.js
- Prevenção de unix socket Redis (error ENOENT)
- Logs de diagnóstico em server.js e worker-redis.js
- Mensagens claras sobre variáveis ausentes

Previne:
- password authentication failed (DATABASE_URL ausente)
- Redis ENOENT /railway (formato incorreto)
- Inicialização parcial de serviços

Refs: AUDITORIA_AMBIENTE_TESTE_RAILWAY.md
Refs: DEPLOY_AMBIENTE_TESTE_GUIA.md"
```

### 4.2. Push para Branch TESTE

```bash
# Criar branch teste (se não existir)
git checkout -b teste

# OU mudar para branch teste existente
git checkout teste

# Push para Railway
git push origin teste

# Se for primeiro push da branch
git push -u origin teste
```

### 4.3. Configurar Deploy no Railway

```
Railway Dashboard
→ Ambiente TESTE
→ Settings
→ Deploy Trigger
→ Branch: teste (selecione a branch correta)
→ Save
```

**Railway iniciará deploy automaticamente após push**

---

## 🔍 ETAPA 5: VALIDAR DEPLOY

### 5.1. Monitorar Logs de Inicialização

```
Railway Dashboard
→ Ambiente TESTE
→ Deployments
→ Selecione último deploy
→ View Logs
```

### 5.2. Logs Esperados (SUCESSO)

**Server (API):**
```
🔍 [SERVER] ═══════════════════════════════════════
🔍 [SERVER]    VALIDAÇÃO DE VARIÁVEIS CRÍTICAS    
🔍 [SERVER] ═══════════════════════════════════════

✅ [SERVER] DATABASE_URL: postgresql://postgres:***...
✅ [SERVER] REDIS_URL: rediss://default:***...
✅ [SERVER] FIREBASE_SERVICE_ACCOUNT: soundyai-teste
✅ [SERVER] B2_KEY_ID: 0051234...
✅ [SERVER] B2_APP_KEY: K005...
✅ [SERVER] B2_BUCKET_NAME: soundyai-teste
✅ [SERVER] Todas as variáveis críticas configuradas

🔗 [DB] Conectando ao PostgreSQL: postgresql://postgres:***@host...
🌍 [DB] Ambiente: test
✅ [DB] Pool de conexão PostgreSQL inicializado com Singleton

🔗 [REDIS] Conectando ao Redis: rediss://default:***@redis...
🔐 [REDIS] TLS: Sim
🔗 [REDIS] PID: 1234 | Service: api
🌍 [REDIS] Ambiente: test
✅ [REDIS] Connected successfully

🌍 [SERVER-ROOT] Ambiente: test
🚀 Servidor iniciado na porta 3000
```

**Worker:**
```
🔍 [WORKER] ═══════════════════════════════════════
🔍 [WORKER]    VALIDAÇÃO DE VARIÁVEIS CRÍTICAS    
🔍 [WORKER] ═══════════════════════════════════════

✅ [WORKER] REDIS_URL: rediss://default:***...
✅ [WORKER] DATABASE_URL: postgresql://postgres:***...
✅ [WORKER] B2_KEY_ID: 0051234...
✅ [WORKER] B2_APP_KEY: K005...
✅ [WORKER] B2_BUCKET_NAME: soundyai-teste
✅ [WORKER] Todas as variáveis obrigatórias configuradas

🔐 [WORKER] TLS detectado: SIM
🔗 [DB] Conectando ao PostgreSQL: postgresql://postgres:***...
✅ [DB] Pool de conexão PostgreSQL inicializado
✅ [REDIS] Connected successfully
🟢 [REDIS] Ready for operations
🚀 [WORKER] Aguardando jobs na fila 'audio-analyzer'...
```

### 5.3. Logs de ERRO (se variáveis ausentes)

**Se `DATABASE_URL` não configurada:**
```
❌ [SERVER] ERRO: DATABASE_URL não configurada

💥 [SERVER] ═══════════════════════════════════════
💥 [SERVER]    ERRO CRÍTICO: Variáveis Ausentes   
💥 [SERVER] ═══════════════════════════════════════
💡 [SERVER] Configure no Railway Dashboard → Variables
📋 [SERVER] Ambiente: test
💥 [SERVER] Servidor NÃO será iniciado
```

**Ação:** Volte para ETAPA 2 e configure as variáveis ausentes.

**Se `REDIS_URL` usa unix socket:**
```
💥 [REDIS] ERRO: REDIS_URL contém path de unix socket
💡 [REDIS] Use formato: redis://host:port ou rediss://host:port
📋 [REDIS] Valor atual: unix:///railway
```

**Ação:** Corrija `REDIS_URL` para formato TCP (`redis://` ou `rediss://`)

---

## 🧪 ETAPA 6: TESTES DE FUNCIONALIDADE

### 6.1. Obter URL do Ambiente TESTE

```
Railway Dashboard
→ Ambiente TESTE
→ Settings
→ Domains
→ Copie a URL gerada (ex: soundyai-teste-production-1234.up.railway.app)
```

### 6.2. Teste 1: Health Check

```bash
curl https://soundyai-teste-production-1234.up.railway.app/api/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-21T...",
  "environment": "test",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### 6.3. Teste 2: Chat (com autenticação)

**Obter Firebase Token:**
```javascript
// No frontend (console do navegador)
firebase.auth().currentUser.getIdToken()
  .then(token => console.log(token));
```

**Enviar mensagem:**
```bash
curl -X POST https://soundyai-teste-production-1234.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_FIREBASE_TOKEN" \
  -d '{
    "message": "Olá! Este é um teste do ambiente TESTE."
  }'
```

**Resposta esperada:**
```json
{
  "reply": "Olá! Como posso ajudar com sua produção musical hoje?",
  "messageId": "uuid-aqui",
  "timestamp": "..."
}
```

### 6.4. Teste 3: Análise de Áudio (enfileiramento)

```bash
curl -X POST https://soundyai-teste-production-1234.up.railway.app/api/audio/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_FIREBASE_TOKEN" \
  -d '{
    "fileKey": "test-audio.wav",
    "mode": "genre"
  }'
```

**Resposta esperada:**
```json
{
  "jobId": "uuid-aqui",
  "status": "queued",
  "message": "Job enfileirado com sucesso"
}
```

**Validar nos logs do Worker:**
```
✅ [WORKER] Job recebido: uuid-aqui
🎵 [WORKER] Modo: genre
📦 [WORKER] Arquivo: test-audio.wav
✅ [WORKER] Processamento concluído
✅ [DB] Status atualizado: completed
```

### 6.5. Teste 4: Consultar Job

```bash
curl https://soundyai-teste-production-1234.up.railway.app/api/jobs/JOB_ID_AQUI \
  -H "Authorization: Bearer SEU_FIREBASE_TOKEN"
```

**Resposta esperada:**
```json
{
  "id": "uuid-aqui",
  "status": "completed",
  "mode": "genre",
  "result": {
    "genre": "electronic",
    "suggestions": [...]
  }
}
```

---

## ✅ CHECKLIST FINAL

### Pré-Deploy
- [ ] PostgreSQL criado no Railway TESTE
- [ ] Redis criado no Railway TESTE (ou Upstash configurado)
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Tabelas criadas no PostgreSQL TESTE
- [ ] Código corrigido commitado na branch `teste`

### Deploy
- [ ] Push para `origin teste` executado
- [ ] Railway iniciou deploy automaticamente
- [ ] Logs mostram validação de variáveis com ✅
- [ ] Logs mostram conexão ao PostgreSQL TESTE
- [ ] Logs mostram conexão ao Redis TESTE

### Validação
- [ ] Health check retorna `status: ok`
- [ ] Chat funciona sem erros
- [ ] Analyze enfileira jobs
- [ ] Worker processa jobs
- [ ] Jobs são salvos no PostgreSQL TESTE
- [ ] Logs não mostram erros de autenticação
- [ ] Logs não mostram `ENOENT /railway`

### Isolamento
- [ ] `DATABASE_URL` do TESTE é diferente de PROD
- [ ] `REDIS_URL` do TESTE é diferente de PROD
- [ ] `RAILWAY_ENVIRONMENT=test` configurado
- [ ] Logs identificam ambiente como `test`

---

## 🐛 TROUBLESHOOTING

### Problema: "password authentication failed for user postgres"

**Causa:** `DATABASE_URL` não configurada ou aponta para banco errado

**Solução:**
1. Verifique Railway → Variables → `DATABASE_URL`
2. Confirme que é do PostgreSQL **TESTE** (não PROD)
3. Teste conexão: `psql $DATABASE_URL -c "SELECT 1;"`

### Problema: "Redis error: connect ENOENT /railway"

**Causa:** `REDIS_URL` usa formato unix socket

**Solução:**
1. Verifique Railway → Variables → `REDIS_URL`
2. **DEVE** começar com `redis://` ou `rediss://`
3. **NÃO PODE** conter `unix:`, `/railway`, `/tmp/`
4. Exemplo correto: `rediss://default:senha@host:6379`

### Problema: Worker não processa jobs

**Causa:** Worker não consegue conectar ao Redis ou PostgreSQL

**Solução:**
1. Verifique logs do Worker no Railway
2. Procure por `❌ [WORKER] ERRO:` nos logs
3. Confirme que todas as variáveis obrigatórias estão configuradas

### Problema: Chat retorna erro 500

**Causa:** Pool PostgreSQL não inicializou

**Solução:**
1. Verifique logs do Server no Railway
2. Procure por `❌ [DB] Erro na conexão`
3. Verifique `DATABASE_URL` no Railway Dashboard

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- [AUDITORIA_AMBIENTE_TESTE_RAILWAY.md](./AUDITORIA_AMBIENTE_TESTE_RAILWAY.md) - Análise técnica completa
- [AUDITORIA_POSTGRES_AUTH_ERROR.md](./AUDITORIA_POSTGRES_AUTH_ERROR.md) - Correção de erro 28P01
- [SQL_CREATE_TABLES_TESTE.sql](./SQL_CREATE_TABLES_TESTE.sql) - Script de criação de tabelas

---

## 🎯 RESULTADO ESPERADO

Ao final deste guia, você terá:

✅ Ambiente TESTE **100% isolado** de PRODUÇÃO  
✅ PostgreSQL próprio com tabelas criadas  
✅ Redis próprio para cache e filas  
✅ Validação obrigatória de variáveis críticas  
✅ Logs claros identificando ambiente TESTE  
✅ Chat funcionando sem erros  
✅ Análises enfileiradas e processadas  
✅ Worker salvando resultados no banco TESTE  

---

**Criado por:** GitHub Copilot (Claude Sonnet 4.5)  
**Data:** 21 de janeiro de 2026  
**Versão:** 1.0 - Primeira Versão Completa  
**Status:** 🟢 **VALIDADO E PRONTO PARA USO**
