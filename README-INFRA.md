# AutoMaster V1 - Infraestrutura SaaS

Sistema de masterização profissional com arquitetura escalável para produção.

## 🏗️ Arquitetura

```
Frontend/API (Express)
    ↓
Redis (BullMQ Queue)
    ↓
Worker(s) → master-pipeline.cjs → automaster-v1.cjs (DSP)
    ↓
Storage Output
```

## 📦 Componentes

### 1. API (Express)
- **POST /automaster** - Upload e enfileiramento
- **GET /automaster/:jobId** - Status do job (polling)

### 2. Queue (BullMQ + Redis)
- Fila distribuída
- Retry automático (2 tentativas)
- Backoff exponencial
- Limpeza automática

### 3. Worker (BullMQ Processor)
- Stateless
- Concorrência controlada
- Timeout 90s
- Isolamento por job
- Cleanup automático

### 4. Storage
- `/storage/input` - Uploads
- `/storage/output` - Resultados
- `/tmp` - Workspaces temporários

## 🚀 Deploy Local

### Pré-requisitos

```bash
# Node.js 18+
node --version

# Redis
docker run -d -p 6379:6379 redis:alpine

# FFmpeg
ffmpeg -version
```

### Instalação

```bash
npm install express multer bullmq ioredis uuid
```

### Estrutura de Diretórios

```bash
mkdir -p storage/input storage/output tmp
```

### Executar Worker

```bash
# Terminal 1: Worker
REDIS_URL=redis://localhost:6379 \
WORKER_CONCURRENCY=2 \
node queue/automaster-worker.cjs
```

### Executar API

```bash
# Terminal 2: API Express
PORT=3000 \
REDIS_URL=redis://localhost:6379 \
MAX_FILE_MB=120 \
MAX_DURATION_MINUTES=15 \
node api/server.cjs
```

## ☁️ Deploy Railway

### 1. Criar Projeto Railway

```bash
railway init
```

### 2. Adicionar Redis

No painel Railway:
1. New → Database → Redis
2. Copiar `REDIS_URL` das variáveis

### 3. Configurar Variáveis de Ambiente

```bash
railway variables set REDIS_URL=redis://...
railway variables set WORKER_CONCURRENCY=4
railway variables set MAX_FILE_MB=120
railway variables set MAX_DURATION_MINUTES=15
railway variables set NODE_ENV=production
```

### 4. Deploy Worker

Criar `railway.worker.json`:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node queue/automaster-worker.cjs",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Deploy worker:
```bash
railway up --service worker
```

### 5. Deploy API

Criar `railway.api.json`:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node api/server.cjs",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

Deploy API:
```bash
railway up --service api
```

### 6. Scaling Horizontal

No painel Railway:
- Worker: Ajustar `WORKER_CONCURRENCY` (2-8)
- API: Adicionar réplicas (Settings → Replicas)
- Redis: Upgrade para plano maior se necessário

## 🔧 Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `REDIS_URL` | URL do Redis | `redis://localhost:6379` |

### Opcionais

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `WORKER_CONCURRENCY` | Jobs simultâneos por worker | `2` |
| `MAX_FILE_MB` | Tamanho máximo do arquivo | `120` |
| `MAX_DURATION_MINUTES` | Duração máxima do áudio | `15` |
| `PORT` | Porta da API | `3000` |

## 📡 Uso da API

### 1. Upload

```bash
curl -X POST http://localhost:3000/automaster \
  -F "audio=@music.wav" \
  -F "mode=BALANCED"
```

Resposta:
```json
{
  "success": true,
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued",
  "message": "Job enfileirado com sucesso"
}
```

### 2. Polling de Status

```bash
curl http://localhost:3000/automaster/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### Status: waiting
```json
{
  "success": true,
  "jobId": "...",
  "status": "waiting",
  "progress": 0
}
```

#### Status: active
```json
{
  "success": true,
  "jobId": "...",
  "status": "active",
  "progress": 45,
  "started_at": 1234567890
}
```

#### Status: completed
```json
{
  "success": true,
  "jobId": "...",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "jobId": "...",
    "duration_ms": 18340,
    "output": "/storage/output/xxx_master.wav",
    "pipeline_result": {...}
  },
  "finished_at": 1234567890
}
```

#### Status: failed
```json
{
  "success": true,
  "jobId": "...",
  "status": "failed",
  "progress": 0,
  "error": "Pipeline falhou: ...",
  "failed_at": 1234567890,
  "attempts": 2
}
```

## 🔒 Segurança

### Implementadas

✅ Validação de extensão WAV  
✅ Limite de tamanho (120MB)  
✅ Validação de duração via ffprobe  
✅ UUID para nomes internos  
✅ Proteção contra path traversal  
✅ Timeout obrigatório  
✅ Isolamento por job  
✅ Cleanup automático

### Recomendadas para Produção

- [ ] Rate limiting (express-rate-limit)
- [ ] Autenticação JWT
- [ ] HTTPS obrigatório
- [ ] CORS configurado
- [ ] Webhook callbacks
- [ ] Monitoramento (Sentry, DataDog)
- [ ] Logs estruturados (Winston, Pino)

## 📊 Monitoramento

### BullMQ Board (Dashboard UI)

```bash
npm install @bull-board/express @bull-board/api

node api/bull-board.cjs
```

Acesse: http://localhost:3000/admin/queues

### Métricas Redis

```bash
redis-cli INFO stats
redis-cli MEMORY STATS
```

### Logs Worker

```bash
railway logs --service worker --follow
```

## 🐛 Troubleshooting

### Worker não processa jobs

```bash
# Verificar conexão Redis
redis-cli PING

# Verificar fila
redis-cli LLEN bull:automaster:waiting

# Reiniciar worker
railway restart --service worker
```

### Job travado em "active"

```bash
# Limpar jobs stalled
redis-cli DEL bull:automaster:active
railway restart --service worker
```

### Timeout excessivo

```bash
# Aumentar timeout
railway variables set WORKER_TIMEOUT_MS=120000

# Reduzir concorrência
railway variables set WORKER_CONCURRENCY=1
```

### Erro de espaço em disco

```bash
# Limpar tmp
rm -rf tmp/*

# Limpar jobs antigos
redis-cli DEL bull:automaster:completed
redis-cli DEL bull:automaster:failed
```

## 📈 Performance

### Otimizações

| Cenário | Configuração Recomendada |
|---------|--------------------------|
| Baixo volume (<10 jobs/hora) | 1 worker, concurrency=1 |
| Médio volume (10-50 jobs/hora) | 2 workers, concurrency=2 |
| Alto volume (>50 jobs/hora) | 4+ workers, concurrency=4 |

### Limites Railway

- **Free Tier:** 500MB RAM, 0.5 vCPU
- **Hobby:** 8GB RAM, 8 vCPU
- **Pro:** 32GB RAM, 32 vCPU

## 🔄 Atualizações

### Deploy Zero-Downtime

```bash
# 1. Deploy nova versão do worker
railway up --service worker

# 2. Aguardar jobs ativos finalizarem
railway logs --service worker | grep "Shutdown completo"

# 3. Deploy API
railway up --service api
```

## 📝 Logs

### Formato

```
[REDIS] Conectado com sucesso
[QUEUE] Job a1b2c3d4 enfileirado
[WORKER] Processando job a1b2c3d4 (BALANCED)
[WORKER] ✓ Job a1b2c3d4 concluído em 18340ms
[API] Upload recebido: 45.2MB
```

### Níveis

- `INFO`: Operações normais
- `ERROR`: Falhas recuperáveis
- `WARN`: Situações anormais

## 📚 Recursos

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Railway Documentation](https://docs.railway.app/)
- [Redis Best Practices](https://redis.io/docs/management/optimization/)

## 🆘 Suporte

- **Issues:** GitHub Issues
- **Discussões:** GitHub Discussions
- **Email:** engineering@soundyai.com

---

**SoundyAI Engineering • 2026**
