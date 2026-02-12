# AutoMaster V1 - Guia de Testes Completo

## 🧪 Suite de Testes Production-Ready

Este documento contém todos os testes necessários para validar o sistema antes de deploy.

---

## 📋 Checklist Pré-Deploy

### Instalação

- [ ] Node.js 18+ instalado
- [ ] FFmpeg instalado (`ffmpeg -version`)
- [ ] Redis rodando (local ou Railway)
- [ ] Dependências instaladas (`npm install`)
- [ ] `.env` configurado com credenciais R2/S3
- [ ] Storage bucket criado (R2 ou S3)

### Configuração

- [ ] `REDIS_URL` válido
- [ ] `WORKER_CONCURRENCY` entre 1-4
- [ ] `STORAGE_PROVIDER` definido (r2 ou s3)
- [ ] Credenciais R2/S3 válidas
- [ ] `R2_BUCKET` ou `S3_BUCKET` existe

---

## 🔬 Testes Básicos

### 1. Health Check

```bash
curl http://localhost:3000/health
```

**Esperado:**

```json
{
  "status": "ok",
  "service": "automaster-api",
  "timestamp": "2026-02-11T..."
}
```

**❌ Se falhar:** API não está rodando. Execute `node api/server.cjs`.

---

### 2. Worker Iniciando

**Comando:**

```bash
node queue/automaster-worker.cjs
```

**Output esperado:**

```json
{
  "level": "info",
  "service": "automaster-worker",
  "concurrency": 1,
  "timeout_ms": 120000,
  "msg": "AutoMaster Worker iniciado"
}

{
  "level": "info",
  "service": "automaster-worker",
  "concurrency": 1,
  "msg": "Worker pronto"
}
```

**❌ Se falhar:**

- **"WORKER_CONCURRENCY inválido"**: Ajuste para 1-4
- **"Connection refused"**: Redis não está rodando
- **"ENOENT master-pipeline.cjs"**: Arquivo não encontrado

---

### 3. Upload Básico

**Preparação:**

```bash
# Criar arquivo WAV de teste (10s de silêncio)
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 10 test.wav -y
```

**Comando:**

```bash
curl -v -X POST http://localhost:3000/automaster \
  -F "audio=@test.wav" \
  -F "mode=BALANCED" \
  | jq
```

**Esperado:**

```json
{
  "success": true,
  "jobId": "abc123-def456-...",
  "status": "queued",
  "message": "Job enfileirado com sucesso"
}
```

**Logs do Worker:**

```json
{
  "level": "info",
  "jobId": "abc123-def456",
  "mode": "BALANCED",
  "msg": "Job iniciado"
}
```

**❌ Se falhar:**

- **400 "Apenas arquivos WAV são permitidos"**: Extensão incorreta
- **400 "Invalid MIME type"**: Arquivo não é WAV real
- **413 "File too large"**: Arquivo > 120MB
- **500**: Verificar logs do API e Worker

---

## 🔐 Testes de Segurança

### 4. Rate Limiting - Upload

**Objetivo:** Verificar limite de 10 uploads/hora.

**Script:**

```bash
#!/bin/bash
echo "Testando rate limiting (10 uploads/hora)"

for i in {1..12}; do
  echo "Upload $i..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/automaster \
    -F "audio=@test.wav" \
    -F "mode=BALANCED")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n1)
  
  echo "HTTP $HTTP_CODE: $BODY"
  
  if [ "$HTTP_CODE" == "429" ]; then
    echo "✅ Rate limit atingido no upload $i"
    break
  fi
  
  sleep 1
done
```

**Esperado:** 11º ou 12º upload retorna HTTP 429.

**❌ Se não limitar:** Rate limiting não está ativo. Verificar [upload-route.cjs](api/upload-route.cjs).

---

### 5. Rate Limiting - Status Check

**Objetivo:** Verificar limite de 100 checks/hora.

**Script:**

```bash
#!/bin/bash
echo "Testando rate limiting status (100 checks/hora)"

for i in {1..105}; do
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000/automaster/test-job-id)
  
  if [ "$HTTP_CODE" == "429" ]; then
    echo "✅ Rate limit atingido no check $i"
    break
  fi
done
```

**Esperado:** 101º check retorna HTTP 429.

---

### 6. Limite de Jobs por Usuário

**Objetivo:** Verificar máximo de 3 jobs simultâneos por userId.

**Script:**

```bash
#!/bin/bash
USER_ID="test-user-concurrent-limit"

echo "Enviando 4 jobs com userId=$USER_ID"

for i in {1..4}; do
  echo "Job $i..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/automaster \
    -F "audio=@test.wav" \
    -F "mode=BALANCED" \
    -F "userId=$USER_ID")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n1)
  
  echo "HTTP $HTTP_CODE: $BODY"
  
  if [ "$HTTP_CODE" == "429" ]; then
    if echo "$BODY" | grep -q "Too many concurrent jobs"; then
      echo "✅ Limite de jobs por usuário funcionando"
      break
    fi
  fi
  
  sleep 1
done
```

**Esperado:** 4º job retorna HTTP 429 com mensagem "Too many concurrent jobs".

---

### 7. Validação MIME Type

**Objetivo:** Rejeitar arquivos falsos.

**Script:**

```bash
# Criar arquivo falso
echo "This is not a WAV file" > fake.wav

curl -X POST http://localhost:3000/automaster \
  -F "audio=@fake.wav" \
  -F "mode=BALANCED" \
  | jq
```

**Esperado:**

```json
{
  "success": false,
  "error": "Invalid audio file",
  "details": ["Invalid MIME type (not audio/wav)"]
}
```

**❌ Se aceitar:** Validação MIME não está ativa.

---

### 8. Validação WAV Header

**Objetivo:** Rejeitar arquivos sem header RIFF/WAVE.

**Script:**

```bash
# Criar arquivo binário sem header WAV
dd if=/dev/urandom of=invalid.wav bs=1024 count=100

curl -X POST http://localhost:3000/automaster \
  -F "audio=@invalid.wav" \
  -F "mode=BALANCED" \
  | jq
```

**Esperado:**

```json
{
  "success": false,
  "error": "Invalid audio file",
  "details": ["Invalid WAV header"]
}
```

---

## 🎯 Testes Funcionais

### 9. Progress Tracking

**Objetivo:** Verificar updates de progresso detalhados.

**Script:**

```bash
#!/bin/bash

# 1. Upload
JOBID=$(curl -s -X POST http://localhost:3000/automaster \
  -F "audio=@test.wav" \
  -F "mode=BALANCED" \
  | jq -r '.jobId')

echo "Job ID: $JOBID"

# 2. Polling com tracking de mudanças de progresso
LAST_PROGRESS=0

while true; do
  RESPONSE=$(curl -s http://localhost:3000/automaster/$JOBID)
  STATUS=$(echo "$RESPONSE" | jq -r '.status')
  PROGRESS=$(echo "$RESPONSE" | jq -r '.progress')
  
  if [ "$PROGRESS" != "$LAST_PROGRESS" ]; then
    echo "[$STATUS] Progress: $PROGRESS%"
    LAST_PROGRESS=$PROGRESS
  fi
  
  [ "$STATUS" = "completed" ] && break
  [ "$STATUS" = "failed" ] && echo "❌ Job falhou" && break
  
  sleep 1
done
```

**Esperado:**

```
Job ID: abc123-def456
[active] Progress: 10%
[active] Progress: 25%
[active] Progress: 50%
[active] Progress: 80%
[active] Progress: 90%
[active] Progress: 95%
[completed] Progress: 100%
```

**❌ Se não atualizar:** Worker não está chamando `job.updateProgress()`.

---

### 10. Download Seguro

**Objetivo:** Obter signed URL e fazer download.

**Script:**

```bash
#!/bin/bash

# 1. Upload e aguardar conclusão
JOBID=$(curl -s -X POST http://localhost:3000/automaster \
  -F "audio=@test.wav" \
  -F "mode=BALANCED" \
  | jq -r '.jobId')

echo "Aguardando job $JOBID..."

while true; do
  STATUS=$(curl -s http://localhost:3000/automaster/$JOBID | jq -r '.status')
  [ "$STATUS" = "completed" ] && break
  sleep 2
done

# 2. Obter signed URL
DOWNLOAD_URL=$(curl -s http://localhost:3000/automaster/$JOBID/download | jq -r '.download_url')

if [ "$DOWNLOAD_URL" = "null" ]; then
  echo "❌ Falha ao obter download URL"
  exit 1
fi

echo "Download URL: $DOWNLOAD_URL"

# 3. Download do arquivo
curl -o result.wav "$DOWNLOAD_URL"

# 4. Verificar arquivo
if [ -f result.wav ]; then
  SIZE=$(stat -f%z result.wav 2>/dev/null || stat -c%s result.wav)
  echo "✅ Arquivo baixado: $SIZE bytes"
  ffprobe result.wav 2>&1 | grep "Audio:"
else
  echo "❌ Arquivo não foi baixado"
fi
```

**Esperado:**

```
Aguardando job abc123-def456...
Download URL: https://...r2.cloudflarestorage.com/...
✅ Arquivo baixado: 1764044 bytes
Audio: pcm_s16le, 44100 Hz, stereo
```

---

### 11. Graceful Shutdown

**Objetivo:** Worker aguarda jobs ativos antes de desligar.

**Procedimento:**

1. Terminal 1: Iniciar worker

```bash
node queue/automaster-worker.cjs
```

2. Terminal 2: Enviar job longo

```bash
# Criar áudio de 5 minutos
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 300 long-audio.wav -y

curl -X POST http://localhost:3000/automaster \
  -F "audio=@long-audio.wav" \
  -F "mode=BALANCED"
```

3. Terminal 1: Enviar SIGTERM

```bash
# CTRL+C ou
kill -SIGTERM <PID>
```

**Esperado (Logs):**

```json
{
  "level": "info",
  "signal": "SIGTERM",
  "msg": "Iniciando graceful shutdown"
}

{
  "level": "info",
  "msg": "Fila pausada, aguardando jobs ativos"
}

// ... worker continua processando job ativo ...

{
  "level": "info",
  "msg": "Todos os jobs ativos finalizados"
}

{
  "level": "info",
  "msg": "Conexão Redis encerrada"
}

{
  "level": "info",
  "msg": "Shutdown completo"
}
```

**❌ Se matar imediatamente:** Graceful shutdown não está funcionando.

---

### 12. Cleanup Automático Redis

**Objetivo:** Verificar remoção de jobs antigos.

**Script:**

```bash
#!/bin/bash

echo "Enviando 10 jobs..."

for i in {1..10}; do
  curl -s -X POST http://localhost:3000/automaster \
    -F "audio=@test.wav" \
    -F "mode=BALANCED" \
    > /dev/null
  echo "Job $i enviado"
done

echo "Aguardando 70 minutos..."
echo "(Jobs completed são removidos após 1 hora)"

sleep 4200  # 70 minutos

echo "Verificando quantos jobs ainda existem no Redis..."

# Você pode usar redis-cli para inspecionar
redis-cli KEYS "bull:automaster:*"
```

**Esperado:** Após 1 hora, jobs completed são removidos automaticamente.

**Verificação manual via Redis:**

```bash
redis-cli

127.0.0.1:6379> KEYS "bull:automaster:*"
# Deve mostrar apenas jobs recentes
```

---

## 🏗️ Testes de Infraestrutura

### 13. Storage R2/S3

**Objetivo:** Verificar upload e download funcionando.

**Manual:**

1. Fazer upload de job
2. Aguardar conclusão
3. Verificar no dashboard R2/S3:
   - Bucket: `soundyai-automaster`
   - Key input: `input/{jobId}.wav`
   - Key output: `output/{jobId}_master.wav`

**Dashboard Cloudflare R2:**

```
Dashboard → R2 → soundyai-automaster → Objects
```

Deve listar:

```
input/abc123-def456.wav
output/abc123-def456_master.wav
```

**❌ Se não aparecer:** Credenciais R2/S3 inválidas ou bucket não existe.

---

### 14. Logs Estruturados

**Objetivo:** Verificar formato JSON em produção.

**Comando:**

```bash
NODE_ENV=production LOG_LEVEL=info node queue/automaster-worker.cjs
```

**Output esperado (JSON):**

```json
{"level":30,"time":1707667200000,"service":"automaster-worker","concurrency":1,"timeout_ms":120000,"msg":"Worker configurado"}
{"level":30,"time":1707667200001,"service":"automaster-worker","concurrency":1,"msg":"Worker pronto"}
```

**Em desenvolvimento (pretty print):**

```bash
NODE_ENV=development node queue/automaster-worker.cjs
```

**Output esperado (colorido):**

```
[10:00:00.000] INFO (automaster-worker): Worker configurado
    concurrency: 1
    timeout_ms: 120000
```

---

### 15. Concurrency Validation

**Objetivo:** Worker rejeita concurrency inválido.

**Script:**

```bash
# Concurrency = 0 (inválido)
WORKER_CONCURRENCY=0 node queue/automaster-worker.cjs

# Concurrency = 5 (inválido, max 4)
WORKER_CONCURRENCY=5 node queue/automaster-worker.cjs
```

**Esperado:**

```json
{
  "level": "error",
  "service": "automaster-worker",
  "concurrency": 0,
  "msg": "WORKER_CONCURRENCY inválido (deve ser 1-4)"
}
```

E worker faz `process.exit(1)`.

---

## 🚀 Testes de Performance

### 16. Throughput Básico

**Objetivo:** Processar 10 jobs seguidos.

**Script:**

```bash
#!/bin/bash

echo "Processando 10 jobs..."
START=$(date +%s)

for i in {1..10}; do
  JOBID=$(curl -s -X POST http://localhost:3000/automaster \
    -F "audio=@test.wav" \
    -F "mode=BALANCED" \
    | jq -r '.jobId')
  
  echo "Job $i: $JOBID enfileirado"
done

END=$(date +%s)
DURATION=$((END - START))
echo "10 jobs enfileirados em $DURATION segundos"

echo "Aguardando conclusão de todos..."

# Aguardar último job
sleep 60

echo "✅ Teste de throughput concluído"
```

**Esperado:**

- Enfileiramento: < 10s para 10 jobs
- Processamento: ~15-30s por job (concurrency 1)
- Total: ~5-10 minutos para 10 jobs

---

### 17. Concurrency Scaling

**Objetivo:** Comparar throughput com diferentes concurrencies.

**Procedimento:**

1. **Concurrency 1:**

```bash
WORKER_CONCURRENCY=1 node queue/automaster-worker.cjs &
# Processar 10 jobs
# Medir tempo total
```

2. **Concurrency 2:**

```bash
WORKER_CONCURRENCY=2 node queue/automaster-worker.cjs &
# Processar 10 jobs
# Medir tempo total
```

3. **Concurrency 4:**

```bash
WORKER_CONCURRENCY=4 node queue/automaster-worker.cjs &
# Processar 10 jobs
# Medir tempo total
```

**Esperado:**

- Concurrency 1: ~5-10 minutos
- Concurrency 2: ~2.5-5 minutos (2x mais rápido)
- Concurrency 4: ~1.5-3 minutos (3-4x mais rápido)

---

## ✅ Checklist Final

### Funcionalidades Core

- [ ] Upload de arquivo WAV funciona
- [ ] Job é enfileirado no Redis
- [ ] Worker processa job
- [ ] Progress tracking atualiza (10%, 25%, 50%, 80%, 90%, 100%)
- [ ] Output é gerado e validado
- [ ] Output é enviado para R2/S3
- [ ] Workspace temporário é limpo
- [ ] Status polling retorna estado correto
- [ ] Download endpoint gera signed URL
- [ ] Signed URL permite download

### Segurança

- [ ] Rate limiting de upload (10/hora)
- [ ] Rate limiting de status (100/hora)
- [ ] Limite de jobs por usuário (3 simultâneos)
- [ ] Validação MIME type rejeita fakes
- [ ] Validação WAV header rejeita inválidos
- [ ] Timeout máximo 120s é respeitado
- [ ] Signed URLs expiram após 5 minutos

### Infraestrutura

- [ ] Worker valida concurrency no boot (1-4)
- [ ] Graceful shutdown aguarda jobs ativos
- [ ] Cleanup automático de jobs Redis funciona
- [ ] Logs estruturados em JSON (produção)
- [ ] Logs pretty print (desenvolvimento)
- [ ] Storage R2/S3 funciona (upload + download)
- [ ] Redis connection retry funciona
- [ ] Worker reconnect após Redis queda

### Performance

- [ ] 10 jobs processados em tempo razoável
- [ ] Concurrency scaling melhora throughput
- [ ] API responde em < 100ms (upload)
- [ ] Não há vazamento de memória após 100 jobs

---

## 🐛 Debug Comum

### "Connection refused" (Redis)

```bash
# Verificar Redis
docker ps | grep redis

# Iniciar Redis
docker run -d -p 6379:6379 redis:alpine

# Testar conexão
redis-cli ping
```

### "ENOENT master-pipeline.cjs"

```bash
# Verificar caminho
ls automaster/master-pipeline.cjs

# Ajustar MASTER_PIPELINE_SCRIPT em worker
```

### "Storage upload failed"

```bash
# Testar credenciais R2
aws s3 ls s3://soundyai-automaster \
  --endpoint-url $R2_ENDPOINT \
  --profile r2

# Verificar variáveis
echo $R2_ENDPOINT
echo $R2_BUCKET
```

---

**SoundyAI Engineering • 2026**
