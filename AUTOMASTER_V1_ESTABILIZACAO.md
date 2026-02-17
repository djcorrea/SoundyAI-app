# AutoMaster V1 - Estabilização Produção

## IMPLEMENTAÇÃO COMPLETA

Versão estabilizada do AutoMaster V1 com:
- ✅ Lock distribuído (previne duplicação)
- ✅ Job Store persistente (Redis, 7 dias)
- ✅ Classificação de erros (recuperável/não-recuperável)
- ✅ Retry inteligente (até 3 tentativas com backoff exponencial)
- ✅ Cleanup rigoroso de /tmp
- ✅ Idempotência forte
- ✅ Teste de concorrência

---

## ARQUIVOS CRIADOS/MODIFICADOS

### Novos Módulos

1. **`services/job-store.cjs`**
   - Persistência de job state no Redis
   - TTL: 7 dias
   - Campos: job_id, user_id, status, input_key, output_key, attempt, timestamps, error_code

2. **`services/job-lock.cjs`**
   - Lock distribuído via Redis SET NX EX
   - TTL: 180s (alinhado com timeout do worker)
   - Previne execução duplicada

3. **`services/error-classifier.cjs`**
   - Classifica erros em RECOVERABLE/NON_RECOVERABLE
   - Códigos: INVALID_INPUT, CODEC_UNSUPPORTED, NETWORK_ERROR, etc.
   - Lógica de retry decision

4. **`test/concurrency-test.cjs`**
   - Teste de 5 jobs simultâneos
   - Métricas: p50/p95 de duração, success rate
   - Validação de limpeza de /tmp

5. **`test/check-tmp.cjs`**
   - Utilitário para verificar e limpar /tmp
   - Uso: `node test/check-tmp.cjs [--clean]`

### Arquivos Modificados

6. **`queue/automaster-worker.cjs`**
   - Integração com jobStore, jobLock, errorClassifier
   - Idempotência: verifica se job já foi concluído
   - Lock antes de processar
   - Classificação de erros antes de retry
   - Cleanup rigoroso em finally

7. **`queue/automaster-queue.cjs`**
   - Timeout aumentado: 180s (alinhado com lock TTL)
   - Attempts: 3 (alinhado com error-classifier)
   - Backoff: 10s base

8. **`api/upload-route.cjs`**
   - Cria job no jobStore ao enfileirar
   - Persistência independente do BullMQ

9. **`api/job-status-route.cjs`**
   - Usa jobStore como fonte de verdade
   - Retorna status persistente (não expira com BullMQ)

---

## INSTRUÇÕES DE EXECUÇÃO

### 1. Pré-requisitos

```bash
# Redis deve estar rodando
redis-server

# Se não tiver Redis instalado:
# Windows: winget install Redis.Redis
# Mac: brew install redis
# Linux: apt-get install redis-server
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar .env

```env
NODE_ENV=development
PORT=3000
WORKER_CONCURRENCY=1

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage (B2/S3)
# ... suas credenciais existentes ...
```

### 4. Iniciar API

```bash
# Terminal 1
node server.js
```

Deve exibir:
```
✓ Servidor rodando em http://localhost:3000
✓ Redis conectado
```

### 5. Iniciar Worker

```bash
# Terminal 2
node queue/automaster-worker.cjs
```

Deve exibir:
```
{"level":"info","msg":"AutoMaster Worker iniciado","concurrency":1,"timeout_ms":180000}
{"level":"info","msg":"Worker pronto","concurrency":1}
```

### 6. Executar Teste de Concorrência

```bash
# Terminal 3
node test/concurrency-test.cjs
```

**Saída esperada:**
```
═══════════════════════════════════════════════════════
  TESTE DE CONCORRÊNCIA - AUTOMASTER V1
═══════════════════════════════════════════════════════

→ Submetendo 5 jobs simultâneos...

✓ Jobs submetidos:
  1. f4a3b2c1-...
  2. e5d4c3b2-...
  ...

→ Aguardando conclusão...

═══════════════════════════════════════════════════════
  RESULTADOS
═══════════════════════════════════════════════════════

✓ Sucesso: 5/5
✗ Falhou:  0/5

Métricas de Duração:
  Média: 38.42s
  p50:   37.50s
  p95:   42.10s

Limpeza de /tmp:
  ✓ /tmp está limpo

Tempo total do teste: 45.23s

═══════════════════════════════════════════════════════
  CRITÉRIOS DE ACEITE
═══════════════════════════════════════════════════════

✓ Taxa de sucesso >= 80%: PASS (100%)
✓ /tmp limpo após jobs:   PASS

═══════════════════════════════════════════════════════
  ✓ TESTE PASSOU
═══════════════════════════════════════════════════════
```

### 7. Verificar limpeza de /tmp

```bash
node test/check-tmp.cjs

# Se necessário forçar limpeza:
node test/check-tmp.cjs --clean
```

---

## ENDPOINTS

### POST /automaster

Submete job de masterização.

```bash
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test.wav" \
  -F "mode=BALANCED"
```

**Resposta:**
```json
{
  "success": true,
  "jobId": "f4a3b2c1-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
  "status": "queued",
  "message": "Job enfileirado com sucesso"
}
```

### GET /automaster/:jobId

Consulta status do job.

```bash
curl http://localhost:3000/automaster/f4a3b2c1-d5e6-7f8g-9h0i-1j2k3l4m5n6o
```

**Resposta (processing):**
```json
{
  "success": true,
  "jobId": "f4a3b2c1-...",
  "status": "processing",
  "progress": 50,
  "mode": "BALANCED",
  "created_at": 1707676800000,
  "started_at": 1707676805000,
  "attempt": 1
}
```

**Resposta (completed):**
```json
{
  "success": true,
  "jobId": "f4a3b2c1-...",
  "status": "completed",
  "progress": 100,
  "mode": "BALANCED",
  "created_at": 1707676800000,
  "started_at": 1707676805000,
  "finished_at": 1707676840000,
  "processing_ms": 35000,
  "output_key": "outputs/f4a3b2c1-..."
}
```

**Resposta (failed):**
```json
{
  "success": true,
  "jobId": "f4a3b2c1-...",
  "status": "failed",
  "progress": 50,
  "mode": "BALANCED",
  "created_at": 1707676800000,
  "started_at": 1707676805000,
  "finished_at": 1707676820000,
  "processing_ms": 15000,
  "error_code": "CODEC_UNSUPPORTED",
  "error_message": "Codec de áudio não suportado",
  "attempt": 1
}
```

### GET /automaster/:jobId/download

Retorna signed URL temporária para download.

```bash
curl http://localhost:3000/automaster/f4a3b2c1-.../download
```

---

## CRITÉRIOS DE ACEITE

### ✅ OBRIGATÓRIOS (TODOS DEVEM PASSAR)

1. **Concorrência:** 5 jobs simultâneos completam com >= 80% sucesso (4/5)
   - Validação: `node test/concurrency-test.cjs`

2. **Lock:** Nenhum job roda duas vezes em paralelo
   - Validação: Logs do worker NÃO devem mostrar duplicação de jobId

3. **Cleanup:** /tmp não acumula lixo após jobs
   - Validação: `node test/check-tmp.cjs`

4. **Erro Não-Recuperável:** Jobs inválidos falham rápido sem retry infinito
   - Validação: Submeter arquivo inválido e verificar que falha em attempt=1

5. **Status Persistente:** Endpoint GET /automaster/:jobId retorna status consistente
   - Validação: Consultar job após 1 hora (não expira do Redis por 7 dias)

---

## LOGS ESTRUTURADOS

Todos os logs são JSON estruturado (Pino format):

```json
{"level":"info","jobId":"f4a3b2c1-...","mode":"BALANCED","msg":"Job iniciado"}
{"level":"info","jobId":"f4a3b2c1-...","msg":"Lock adquirido"}
{"level":"info","jobId":"f4a3b2c1-...","workspace":"/tmp/f4a3b2c1-...","msg":"Workspace criado"}
{"level":"info","jobId":"f4a3b2c1-...","inputKey":"uploads/...","msg":"Input baixado do storage"}
{"level":"info","jobId":"f4a3b2c1-...","totalLines":1,"msg":"Pipeline output received"}
{"level":"info","jobId":"f4a3b2c1-...","duration_ms":35420,"msg":"Job concluído"}
```

Erros:
```json
{"level":"error","jobId":"f4a3b2c1-...","error":"Codec not supported","error_type":"NON_RECOVERABLE","error_code":"CODEC_UNSUPPORTED","msg":"Job falhou"}
```

---

## TROUBLESHOOTING

### Worker não inicia

```bash
# Verificar Redis
redis-cli ping
# Deve retornar: PONG

# Verificar conexão
node -e "const redis = require('./queue/redis-connection.cjs'); redis.ping().then(() => console.log('OK')).catch(console.error)"
```

### Jobs ficam em "queued"

- Worker está rodando?
- Logs do worker mostram erros?
- Redis está acessível?

### /tmp acumula arquivos

```bash
# Verificar
node test/check-tmp.cjs

# Limpar forçadamente
node test/check-tmp.cjs --clean
```

### Teste de concorrência falha

- Verificar que worker está com `WORKER_CONCURRENCY=1` (para test local)
- Aumentar timeout se máquina for lenta
- Verificar logs para entender causa de falhas

---

## OBSERVAÇÕES FINAIS

### Zero Regressão

- ✅ Fluxo fim-a-fim continua igual
- ✅ Nenhuma mudança no DSP (FFmpeg pipeline)
- ✅ Endpoints existentes mantêm compatibilidade

### Performance Esperada

- p50: ~37s (DSP ~35s + overhead 2s)
- p95: ~42s
- Concorrência: 1 job/vez (produção pode aumentar WORKER_CONCURRENCY)

### Próximos Passos (FORA DO ESCOPO)

- Métricas de RAM (requer instrumentação adicional)
- Heartbeat de lock (opcional, TTL atual é seguro)
- Retry customizado por erro (atual é genérico)
- UI para monitoramento de jobs

---

**STATUS:** PRODUCTION READY ✅

Todos os critérios de aceite foram implementados e testados.
