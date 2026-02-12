# ☑️ AutoMaster SaaS - Checklist de Deployment

## 📋 Pré-Deployment

### Ambiente Local

- [ ] Node.js 18+ instalado
- [ ] FFmpeg instalado e no PATH
- [ ] Redis rodando (local ou Docker)
- [ ] Dependências instaladas (`npm install`)
- [ ] Diretórios criados (`storage/input`, `storage/output`, `tmp`)

### Core DSP Validado

- [ ] `automaster-v1.cjs` funcional
- [ ] `master-pipeline.cjs` funcional
- [ ] `test-precision.cjs` passando (todos os 3 modos)
- [ ] Two-pass loudnorm operacional
- [ ] Tolerâncias corretas (±0.2 LU LUFS, +0.05 dB TP)

### Infraestrutura SaaS Criada

- [ ] `queue/redis-connection.cjs` criado
- [ ] `queue/automaster-queue.cjs` criado
- [ ] `queue/automaster-worker.cjs` criado
- [ ] `api/upload-route.cjs` criado
- [ ] `api/job-status-route.cjs` criado
- [ ] `api/server.cjs` criado

## 🧪 Testes Locais

### Teste 1: Worker Standalone

```bash
# Terminal 1: Redis
docker run -d -p 6379:6379 redis:alpine

# Terminal 2: Worker
REDIS_URL=redis://localhost:6379 \
WORKER_CONCURRENCY=1 \
node queue/automaster-worker.cjs
```

Esperado:
```
[REDIS] Conectado com sucesso
[REDIS] Pronto para receber comandos
[WORKER] AutoMaster Worker iniciado
[WORKER] Concurrency: 1
[WORKER] Pronto (concurrency: 1)
```

- [ ] Worker iniciou sem erros
- [ ] Redis conectado
- [ ] Logs claros

### Teste 2: API Standalone

```bash
# Terminal 3: API
PORT=3000 \
REDIS_URL=redis://localhost:6379 \
MAX_FILE_MB=120 \
MAX_DURATION_MINUTES=15 \
node api/server.cjs
```

Esperado:
```
[API] Servidor rodando na porta 3000
[API] Health check: http://localhost:3000/health
```

- [ ] API iniciou sem erros
- [ ] Health check responde (GET /health)

### Teste 3: Upload Dummy

```bash
# Gerar arquivo de teste
ffmpeg -f lavfi -i "sine=frequency=440:duration=30" test-audio-sine-30s.wav

# Upload
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test-audio-sine-30s.wav" \
  -F "mode=BALANCED"
```

Esperado:
```json
{
  "success": true,
  "jobId": "...",
  "status": "queued"
}
```

- [ ] Upload aceito
- [ ] jobId retornado
- [ ] Worker processou job
- [ ] Output gerado em `storage/output/`

### Teste 4: Status Polling

```bash
curl http://localhost:3000/automaster/{jobId}
```

- [ ] Status `waiting` → `active` → `completed`
- [ ] Progress 0% → 100%
- [ ] Resultado final inclui `pipeline_result`

### Teste 5: Validações

**Arquivo não-WAV:**
```bash
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test.mp3" \
  -F "mode=BALANCED"
```
- [ ] Rejeita com erro claro

**Arquivo muito grande (>120MB):**
```bash
# Gerar arquivo >120MB
ffmpeg -f lavfi -i "sine=frequency=440:duration=900" large.wav

curl -X POST http://localhost:3000/automaster \
  -F "audio=@large.wav" \
  -F "mode=BALANCED"
```
- [ ] Rejeita com erro claro

**Duração >15 minutos:**
```bash
# Gerar arquivo 20 minutos
ffmpeg -f lavfi -i "sine=frequency=440:duration=1200" long.wav

curl -X POST http://localhost:3000/automaster \
  -F "audio=@long.wav" \
  -F "mode=BALANCED"
```
- [ ] Rejeita com erro claro

**Mode inválido:**
```bash
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test-audio-sine-30s.wav" \
  -F "mode=ULTRA"
```
- [ ] Rejeita com erro claro

## ☁️ Deploy Railway

### Setup Inicial

- [ ] Conta Railway criada
- [ ] CLI Railway instalado (`npm i -g @railway/cli`)
- [ ] Projeto Railway criado (`railway init`)
- [ ] Redis adicionado (Database → Redis)
- [ ] `REDIS_URL` obtido

### Variáveis de Ambiente

```bash
railway variables set REDIS_URL="redis://..."
railway variables set WORKER_CONCURRENCY=4
railway variables set MAX_FILE_MB=120
railway variables set MAX_DURATION_MINUTES=15
railway variables set NODE_ENV=production
```

- [ ] Todas variáveis configuradas
- [ ] `REDIS_URL` com credenciais corretas

### Deploy Worker

```bash
railway up --service worker
railway logs --service worker
```

- [ ] Worker deployado
- [ ] Logs mostram conexão Redis
- [ ] Sem erros de inicialização

### Deploy API

```bash
railway up --service api
railway logs --service api
```

- [ ] API deployada
- [ ] Health check acessível
- [ ] Domínio público gerado

### Teste em Produção

```bash
# Obter URL da API
API_URL=$(railway url --service api)

# Upload
curl -X POST $API_URL/automaster \
  -F "audio=@test-audio-sine-30s.wav" \
  -F "mode=BALANCED"

# Status
curl $API_URL/automaster/{jobId}
```

- [ ] Upload funciona
- [ ] Worker processa
- [ ] Status retorna corretamente
- [ ] Output gerado

## 🔒 Segurança

### Validações Implementadas

- [ ] Extensão WAV obrigatória
- [ ] Limite de tamanho (120MB)
- [ ] Validação de duração via ffprobe
- [ ] UUID para nomes internos
- [ ] Proteção contra path traversal (regex jobId)
- [ ] Timeout obrigatório (90s)
- [ ] Isolamento por job
- [ ] Cleanup automático

### Recomendações Futuras

- [ ] Rate limiting
- [ ] Autenticação JWT
- [ ] HTTPS obrigatório
- [ ] CORS restrito
- [ ] Webhook callbacks
- [ ] Logs estruturados

## 📊 Monitoramento

### Métricas a Observar

- [ ] Tempo médio de processamento
- [ ] Taxa de sucesso/falha
- [ ] Uso de memória Redis
- [ ] Uso de disco (`storage/`, `tmp/`)
- [ ] Latência da API

### Ferramentas

- [ ] Railway Metrics (CPU, RAM)
- [ ] Redis INFO
- [ ] BullMQ Board (opcional)

## 🐛 Troubleshooting Checklist

### Worker não processa

- [ ] Redis está acessível?
- [ ] `REDIS_URL` correto?
- [ ] FFmpeg instalado no container?
- [ ] Diretórios `tmp/` e `storage/` existem?

### API não responde

- [ ] Porta `PORT` configurada?
- [ ] Health check `/health` funciona?
- [ ] Redis acessível pela API?

### Jobs travam em "active"

- [ ] Timeout muito baixo?
- [ ] Worker crashou durante processamento?
- [ ] Limpar jobs stalled: `redis-cli DEL bull:automaster:active`

### Erro de espaço em disco

- [ ] Limpar `tmp/`: `rm -rf tmp/*`
- [ ] Limpar jobs antigos no Redis
- [ ] Aumentar storage no Railway

## ✅ Sign-off Final

- [ ] Todos os testes passaram
- [ ] Core DSP intacto e validado
- [ ] Worker stateless e escalável
- [ ] API respondendo corretamente
- [ ] Validações robustas
- [ ] Logs claros e estruturados
- [ ] Cleanup automático funcionando
- [ ] Documentação completa (README-INFRA.md)

---

**Data:** _____________  
**Responsável:** _____________  
**Aprovado por:** _____________
