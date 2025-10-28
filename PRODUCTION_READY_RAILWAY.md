# 🚂 RAILWAY PRODUCTION - CONFIGURAÇÃO COMPLETA

## 📋 Status do Projeto

### ✅ O que já está pronto:
- [x] **Sistema de Logs Ultra-Detalhado** - Implementado
- [x] **DEBUG Logs Estratégicos** - queue.add() monitorado
- [x] **Worker EVENT Handlers** - Todos os 5 eventos implementados
- [x] **Auditoria API ↔ Worker** - 9 requisitos cumpridos
- [x] **Configuração REDIS_URL** - Padronizada
- [x] **Scripts de Produção** - start:web e start:worker
- [x] **Arquivo railway.json** - Configuração dual-service
- [x] **railway.env.example** - Template de variáveis
- [x] **deploy-railway.sh** - Script automático de deploy

## 🚀 DEPLOY NO RAILWAY - ARQUITETURA DUAL

### 🏗️ Estrutura de Produção
```
Railway Project: soundyai-production
├── 🌐 api-service (Público)
│   ├── Start: npm run start:web
│   ├── Port: 3001
│   └── Health: /health
└── ⚙️ worker-service (Interno)
    ├── Start: npm run start:worker
    ├── Port: Nenhum
    └── Background: true
```

## 📊 MONITORAMENTO EM PRODUÇÃO

### 🔍 Logs Automáticos

#### 🌐 API Service Logs
```bash
[API][2024-01-15T10:30:00.000Z] -> 🚀 INICIANDO API Server...
[API][2024-01-15T10:30:00.000Z] -> 🔧 Porta: 3001
[API][2024-01-15T10:30:00.000Z] -> 🌍 ENV: production
[API][2024-01-15T10:30:00.000Z] -> 🗃️ Database: CONFIGURADO
[API][2024-01-15T10:30:00.000Z] -> 📦 Redis: CONFIGURADO

[DEBUG] Chegou no ponto antes do queue.add()
[DEBUG] Passou do queue.add()
[API] Job 123 criado com sucesso na fila audio-analyzer
```

#### ⚙️ Worker Service Logs
```bash
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 🚀 INICIANDO Worker Redis Exclusivo...
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 📋 PID: 42
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 🌍 ENV: production
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 🚀 MODO PRODUÇÃO ATIVADO
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 🔧 Redis: CONFIGURADO
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 🗃️ Postgres: CONFIGURADO

[EVENT] 🟡 Job WAITING: 123
[EVENT] 🔵 Job ACTIVE: 123
[EVENT] ✅ Job COMPLETED: 123
```

### 📈 Commands de Monitoramento

```bash
# Ver logs em tempo real
railway logs --follow --service api-service
railway logs --follow --service worker-service

# Ver últimos 100 logs
railway logs --tail 100 --service api-service

# Filtrar logs por tipo
railway logs --service api-service | grep "[DEBUG]"
railway logs --service worker-service | grep "[EVENT]"

# Status dos serviços
railway status

# Informações das URLs
railway domain
```

## 🔧 VARIÁVEIS DE AMBIENTE

### 📝 Configuração Completa

#### API Service
```env
NODE_ENV=production
PORT=3001
SERVICE_TYPE=api
API_VERSION=v1
DATABASE_URL=postgresql://railway_provided
REDIS_URL=redis://railway_provided
```

#### Worker Service
```env
NODE_ENV=production
SERVICE_TYPE=worker
WORKER_CONCURRENCY=5
DATABASE_URL=postgresql://railway_provided
REDIS_URL=redis://railway_provided
```

## 🚨 TROUBLESHOOTING PRODUÇÃO

### ❌ Problemas Comuns e Soluções

#### 1. Worker não processa jobs
```bash
# Verificar se worker está rodando
railway ps --service worker-service

# Ver logs do worker
railway logs --service worker-service

# Testar conexão Redis
railway shell --service worker-service
node -e "console.log(process.env.REDIS_URL)"
```

#### 2. API não responde
```bash
# Verificar saúde da API
curl https://your-domain.railway.app/health

# Ver logs da API
railway logs --service api-service

# Verificar porta
railway variables --service api-service | grep PORT
```

#### 3. Jobs ficam presos na fila
```bash
# Verificar logs de ambos os serviços
railway logs --service api-service | grep "queue.add"
railway logs --service worker-service | grep "EVENT"

# Limpar fila Redis (cuidado!)
railway shell --service worker-service
redis-cli -u $REDIS_URL flushdb
```

## 🎯 HEALTH CHECKS

### 🩺 Endpoints de Monitoramento

#### API Health Check
```javascript
GET /health
Response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "api",
  "redis": "connected",
  "database": "connected",
  "queue": "audio-analyzer"
}
```

#### Worker Health (via logs)
```bash
# Worker emite logs de saúde a cada 30 segundos
[WORKER-REDIS] -> ❤️ Worker is alive, PID: 42
[WORKER-REDIS] -> 📊 Jobs processed: 15
[WORKER-REDIS] -> 🧠 Memory: 45MB
```

## 📊 PERFORMANCE E ESCALA

### 🚀 Auto-scaling Configuration

```json
{
  "services": {
    "api-service": {
      "scaling": {
        "min": 1,
        "max": 3,
        "cpu_threshold": 70,
        "memory_threshold": 80
      }
    },
    "worker-service": {
      "scaling": {
        "min": 1,
        "max": 5,
        "cpu_threshold": 80,
        "memory_threshold": 85
      }
    }
  }
}
```

### 📈 Métricas de Monitoramento

```bash
# CPU e Memória
railway metrics --service api-service
railway metrics --service worker-service

# Requisições por minuto
railway logs --service api-service | grep "POST /api/audio/analyze" | wc -l

# Jobs processados por hora
railway logs --service worker-service | grep "Job COMPLETED" | wc -l
```

## 🔐 SEGURANÇA DE PRODUÇÃO

### 🛡️ Configurações Recomendadas

```env
# Rate Limiting
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000

# CORS
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Security Headers
HELMET_ENABLED=true
HTTPS_ONLY=true

# Logging
LOG_LEVEL=info
SENSITIVE_DATA_MASKING=true
```

## 📞 SUPORTE

### 🆘 Quando Precisar de Ajuda

1. **Logs não aparecem**: Verificar se serviço está rodando
2. **503 Error**: Verificar health checks e variáveis
3. **Jobs não processam**: Verificar conexão Redis entre serviços
4. **Performance baixa**: Considerar scaling automático

### 🔗 Links Úteis
- [Railway Dashboard](https://railway.app/dashboard)
- [Railway Metrics](https://railway.app/dashboard/metrics)
- [Railway Logs](https://railway.app/dashboard/logs)

---

**🎉 SoundyAI rodando em produção com monitoramento completo!**

**📈 Próximos passos:**
1. Execute `./deploy-railway.sh`
2. Configure as variáveis sensíveis no Railway Dashboard
3. Monitore os logs para garantir funcionamento
4. Configure alerts e webhooks se necessário