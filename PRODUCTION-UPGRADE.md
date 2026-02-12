# AutoMaster V1 - Production Upgrade

## 🚀 Resumo das Melhorias

Transformação completa do AutoMaster V1 de protótipo para sistema **production-ready** com:

### ✅ Implementações Realizadas

1. **Storage Persistente (R2/S3)**
   - Substituído filesystem local por Cloudflare R2 / AWS S3
   - Inputs e outputs persistem no storage
   - Signed URLs temporárias para downloads seguros

2. **Rate Limiting**
   - 10 uploads/hora por IP
   - 100 status checks/hora por IP
   - Proteção contra abuso

3. **Limite de Jobs por Usuário**
   - Máximo 3 jobs simultâneos por userId
   - Previne sobrecarga do sistema

4. **Graceful Shutdown (Worker)**
   - Pausa consumo da fila
   - Aguarda jobs ativos finalizarem
   - Fecha conexão Redis
   - Sem kills abruptos

5. **Auto Cleanup Redis**
   - Jobs completed: removidos após 1h ou após 1000 jobs
   - Jobs failed: removidos após 24h
   - Memória Redis otimizada

6. **Progress Tracking Detalhado**
   - 10% → Workspace criado
   - 25% → Input baixado do storage
   - 50% → Pipeline executando
   - 80% → Output verificado
   - 90% → Upload para storage
   - 95% → Cleanup
   - 100% → Concluído

7. **Validação de Concurrency**
   - Limite: 1-4 workers
   - Validação no boot (erro se fora do range)
   - Padrão: 1 (seguro para MVP)

8. **Download Protegido**
   - Endpoint: `GET /automaster/:jobId/download`
   - Signed URL temporária (5 minutos)
   - Nunca expõe caminho local

9. **Logs Estruturados (Pino)**
   - Formato JSON em produção
   - Pretty print em desenvolvimento
   - Contexto rico (jobId, userId, etc)
   - Performance máxima

10. **Segurança Extra**
    - Validação MIME type real via `file-type`
    - Validação WAV header binário
    - Timeout máximo 120s por job
    - Proteção contra arquivos falsos

---

## 📁 Arquivos Criados

### Novos Módulos

```
services/
├── storage-service.cjs       # R2/S3 storage integration
├── logger.cjs                # Structured logging (Pino)
└── audio-validator.cjs       # Security validations
```

### Arquivos Modificados

```
queue/
├── automaster-queue.cjs      # ✓ Cleanup automático
└── automaster-worker.cjs     # ✓ Storage, logger, progress, shutdown

api/
├── upload-route.cjs          # ✓ Rate limiting, validations, storage
├── job-status-route.cjs      # ✓ Rate limiting, download endpoint
└── server.cjs                # ✓ Logger, middleware

package.json                  # ✓ Novas dependências
.env.example                  # ✓ Novas variáveis
```

---

## 🔧 Novas Dependências

```bash
npm install \
  @aws-sdk/client-s3 \
  @aws-sdk/s3-request-presigner \
  file-type \
  express-rate-limit \
  pino \
  pino-pretty \
  uuid
```

---

## 🌍 Variáveis de Ambiente Obrigatórias

### Storage (Cloudflare R2 - Recomendado)

```bash
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY=<your-access-key>
R2_SECRET_KEY=<your-secret-key>
R2_BUCKET=soundyai-automaster
```

### Worker & API

```bash
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=1
MAX_FILE_MB=120
MAX_DURATION_MINUTES=15
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
```

---

## 🚦 Fluxo Atualizado

### 1. Upload

```
Cliente → POST /automaster (multipart/form-data)
  ↓
Rate Limiting (10/hora)
  ↓
Validação MIME + WAV header + tamanho
  ↓
Verificar limite de jobs por userId (max 3)
  ↓
Upload para R2/S3 (input/{jobId}.wav)
  ↓
Enfileirar job no Redis
  ↓
Retornar: { jobId, status: "queued" }
```

### 2. Processing (Worker)

```
Worker consome job
  ↓
10% → Criar workspace tmp/{jobId}/
  ↓
25% → Download input do R2/S3
  ↓
50% → Executar master-pipeline.cjs (NÃO MODIFICADO)
  ↓
80% → Verificar output
  ↓
90% → Upload output para R2/S3 (output/{jobId}_master.wav)
  ↓
95% → Cleanup workspace
  ↓
100% → Job concluído
```

### 3. Polling & Download

```
Cliente → GET /automaster/:jobId
  ↓
Rate Limiting (100/hora)
  ↓
Retornar: { status, progress, result }

Cliente → GET /automaster/:jobId/download
  ↓
Verificar job completed
  ↓
Gerar signed URL (5min)
  ↓
Retornar: { download_url, expires_in: 300 }
```

---

## 🐳 Deploy Local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar .env

```bash
cp .env.example .env
# Editar .env com suas credenciais R2/S3
```

### 3. Iniciar Redis

```bash
docker run -d -p 6379:6379 redis:alpine
```

### 4. Iniciar Worker

```bash
node queue/automaster-worker.cjs
```

**Output esperado:**

```
[Worker] Concurrency: 1, Timeout: 120000ms
[Worker] Pronto
```

### 5. Iniciar API

```bash
node api/server.cjs
```

**Output esperado:**

```
[API Server] Port: 3000
```

### 6. Testar Upload

```bash
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test.wav" \
  -F "mode=BALANCED"
```

**Resposta:**

```json
{
  "success": true,
  "jobId": "abc123-def456",
  "status": "queued"
}
```

### 7. Polling Status

```bash
curl http://localhost:3000/automaster/abc123-def456
```

**Resposta (processando):**

```json
{
  "success": true,
  "jobId": "abc123-def456",
  "status": "active",
  "progress": 50
}
```

**Resposta (concluído):**

```json
{
  "success": true,
  "jobId": "abc123-def456",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "duration_ms": 18432,
    "output_key": "output/abc123-def456_master.wav",
    "pipeline_result": { ... }
  }
}
```

### 8. Download

```bash
curl http://localhost:3000/automaster/abc123-def456/download
```

**Resposta:**

```json
{
  "success": true,
  "jobId": "abc123-def456",
  "download_url": "https://r2.cloudflarestorage.com/...[signed URL]",
  "expires_in": 300
}
```

---

## ☁️ Deploy Railway (Production)

### 1. Criar Projeto Railway

```bash
railway login
railway init
```

### 2. Adicionar Redis Database

```
Railway Dashboard → Add Database → Redis
```

Railway auto-provisiona e configura `REDIS_URL`.

### 3. Configurar Storage (Cloudflare R2)

**No Cloudflare:**

1. Dashboard → R2 → Create Bucket: `soundyai-automaster`
2. Manage R2 API Tokens → Create API Token
3. Copiar: Endpoint, Access Key, Secret Key

**No Railway:**

```
Variables:
  STORAGE_PROVIDER=r2
  R2_ENDPOINT=<seu-endpoint>
  R2_ACCESS_KEY=<seu-access-key>
  R2_SECRET_KEY=<seu-secret-key>
  R2_BUCKET=soundyai-automaster
```

### 4. Criar Serviço Worker

```
Railway → New Service → Deploy from GitHub
  Start Command: node queue/automaster-worker.cjs
  Variables:
    REDIS_URL=${{Redis.REDIS_URL}}
    WORKER_CONCURRENCY=2
    NODE_ENV=production
    LOG_LEVEL=info
```

### 5. Criar Serviço API

```
Railway → New Service → Deploy from GitHub
  Start Command: node api/server.cjs
  Variables:
    REDIS_URL=${{Redis.REDIS_URL}}
    MAX_FILE_MB=120
    MAX_DURATION_MINUTES=15
    PORT=3000
    NODE_ENV=production
    LOG_LEVEL=info
  Domain: Generate Domain (ou custom)
```

### 6. Escalar Horizontalmente

**Workers:**

```
Railway → Worker Service → Settings → Scale
  Mais instâncias = mais throughput
  Cada worker processa WORKER_CONCURRENCY jobs simultâneos
```

**API:**

```
Railway → API Service → Settings → Scale
  Load balancer automático
```

---

## 🔐 Segurança

### ✅ Checklist

- [x] Rate limiting ativo
- [x] MIME type validado
- [x] WAV header verificado
- [x] Timeout máximo 120s
- [x] Jobs isolados por workspace
- [x] Storage separado do filesystem
- [x] Signed URLs temporárias
- [x] Logs não expõem credenciais
- [x] Concurrency limitado (max 4)
- [x] Limite de jobs por usuário

---

## 📊 Performance

### Targets

- **Latência API:** < 100ms (upload)
- **Throughput:** 50-100 jobs/hora (1 worker concurrency 1)
- **Tempo médio:** 15-30s/job
- **Taxa de sucesso:** > 98%

### Scaling

**1 worker (concurrency 1):**
- ~2-4 jobs/min
- ~120-240 jobs/hora

**2 workers (concurrency 2 cada):**
- ~8-16 jobs/min
- ~480-960 jobs/hora

**4 workers (concurrency 4 cada):**
- ~32-64 jobs/min
- ~1920-3840 jobs/hora

---

## 🧪 Como Testar

### 1. Teste Upload Completo

```bash
# Terminal 1: Iniciar worker
node queue/automaster-worker.cjs

# Terminal 2: Iniciar API
node api/server.cjs

# Terminal 3: Upload
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test.wav" \
  -F "mode=BALANCED" \
  -F "userId=test-user-123"
```

### 2. Teste Rate Limiting

```bash
# Fazendo 11 uploads sequenciais (limite = 10/hora)
for i in {1..11}; do
  echo "Upload $i"
  curl -X POST http://localhost:3000/automaster \
    -F "audio=@test.wav" \
    -F "mode=BALANCED"
done

# O 11º deve retornar HTTP 429: Rate limit exceeded
```

### 3. Teste Limite de Jobs por Usuário

```bash
# Upload 4 jobs com mesmo userId (limite = 3)
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test1.wav" \
  -F "userId=test-user"

curl -X POST http://localhost:3000/automaster \
  -F "audio=@test2.wav" \
  -F "userId=test-user"

curl -X POST http://localhost:3000/automaster \
  -F "audio=@test3.wav" \
  -F "userId=test-user"

# Este deve retornar HTTP 429: Too many concurrent jobs
curl -X POST http://localhost:3000/automaster \
  -F "audio=@test4.wav" \
  -F "userId=test-user"
```

### 4. Teste Validação MIME Type

```bash
# Upload de arquivo .txt renomeado para .wav
echo "fake wav" > fake.wav

curl -X POST http://localhost:3000/automaster \
  -F "audio=@fake.wav" \
  -F "mode=BALANCED"

# Deve retornar HTTP 400: Invalid MIME type
```

### 5. Teste Graceful Shutdown

```bash
# Terminal 1: Worker
node queue/automaster-worker.cjs

# Terminal 2: Enviar job que leva 30s+
curl -X POST http://localhost:3000/automaster \
  -F "audio=@long-audio-15min.wav" \
  -F "mode=BALANCED"

# Terminal 1: CTRL+C ou kill SIGTERM
# Verificar logs: deve aguardar job ativo finalizar
```

### 6. Teste Download Seguro

```bash
# 1. Upload job
JOBID=$(curl -s -X POST http://localhost:3000/automaster \
  -F "audio=@test.wav" \
  -F "mode=BALANCED" | jq -r '.jobId')

# 2. Aguardar completar
while true; do
  STATUS=$(curl -s http://localhost:3000/automaster/$JOBID | jq -r '.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] && break
  sleep 2
done

# 3. Obter signed URL
DOWNLOAD_URL=$(curl -s http://localhost:3000/automaster/$JOBID/download | jq -r '.download_url')

# 4. Download do arquivo
curl -o result.wav "$DOWNLOAD_URL"
```

---

## 🛠️ Troubleshooting

### Worker não conecta no Redis

**Erro:**

```
[Worker] Erro: Connection refused
```

**Solução:**

```bash
# Verificar se Redis está rodando
docker ps | grep redis

# Iniciar Redis
docker run -d -p 6379:6379 redis:alpine

# Verificar REDIS_URL no .env
echo $REDIS_URL  # deve ser redis://localhost:6379
```

### Upload falha com "Invalid MIME type"

**Causa:** Arquivo não é WAV real.

**Solução:** Converter com FFmpeg:

```bash
ffmpeg -i input.mp3 -c:a pcm_s16le output.wav
```

### Worker crash ao processar job

**Logs:**

```json
{
  "level": "error",
  "jobId": "abc123",
  "error": "...",
  "stack": "..."
}
```

**Verificar:**

1. FFmpeg instalado: `ffmpeg -version`
2. Arquivo master-pipeline.cjs existe
3. Permissões de leitura/escrita em `tmp/`
4. Timeout não muito curto (mínimo 120s)

### Rate limit muito agressivo

**Ajustar em:**

[upload-route.cjs](api/upload-route.cjs#L37):

```javascript
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50  // ← aumentar para 50 uploads/hora
});
```

---

## 📝 Changelog

### v5.0.0 (Production-Ready)

**Breaking Changes:**

- Worker agora usa `inputKey` ao invés de `inputPath`
- Upload retorna job com `inputKey` no storage
- Download via endpoint `/automaster/:jobId/download`

**New Features:**

- ✅ Storage persistente (R2/S3)
- ✅ Rate limiting
- ✅ Limite de jobs por usuário
- ✅ Graceful shutdown
- ✅ Progress tracking detalhado
- ✅ Logs estruturados (Pino)
- ✅ Validação MIME type/WAV header
- ✅ Signed URLs para download
- ✅ Auto cleanup Redis

**Non-Breaking:**

- Core DSP **NÃO MODIFICADO**
- `master-pipeline.cjs` **NÃO MODIFICADO**
- Lógica de áudio **NÃO MODIFICADA**

---

## 🎯 Próximos Passos

### Opcional (Futuro)

1. **Autenticação JWT**
   - Middleware de auth
   - userId extraído do token

2. **Webhook de Conclusão**
   - Chamar URL externa quando job completa
   - Útil para integração com frontend

3. **Métricas Prometheus**
   - Expor endpoint `/metrics`
   - Grafana dashboards

4. **CDN para Downloads**
   - Cloudflare CDN na frente do R2
   - Cache de downloads frequentes

---

**SoundyAI Engineering • 2026**
