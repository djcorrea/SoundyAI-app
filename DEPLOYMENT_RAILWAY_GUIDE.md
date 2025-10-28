# 🚂 GUIA COMPLETO DE DEPLOY NO RAILWAY

## 📊 Arquitetura de Produção

### 🏗️ Estrutura Dual-Service
```
┌─────────────────────┐    ┌─────────────────────┐
│    🌐 API Service   │    │  ⚙️ Worker Service  │
│                     │    │                     │
│ • Express.js        │    │ • Bull Worker       │
│ • Endpoints         │    │ • Job Processing    │
│ • Job Creation      │    │ • Audio Analysis    │
│ • PostgreSQL        │◄──►│ • PostgreSQL        │
│                     │    │                     │
│     Port: 3001      │    │   Background Job    │
└─────────────────────┘    └─────────────────────┘
           │                          │
           └──────────┬─────────────┘
                      ▼
          ┌─────────────────────┐
          │   📦 Upstash Redis  │
          │   (Shared Queue)    │
          └─────────────────────┘
```

## 🚀 PASSO A PASSO - DEPLOY COMPLETO

### 1️⃣ Preparar Ambiente Railway
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login no Railway
railway login

# Criar projeto
railway new
```

### 2️⃣ Configurar Redis Upstash
```bash
# No dashboard Railway:
# 1. Add Service > Database > Redis
# 2. Copiar REDIS_URL
# 3. Adicionar nas variáveis de ambiente
```

### 3️⃣ Configurar PostgreSQL
```bash
# No dashboard Railway:
# 1. Add Service > Database > PostgreSQL  
# 2. Copiar DATABASE_URL
# 3. Adicionar nas variáveis de ambiente
```

### 4️⃣ Deploy API Service

#### 🔧 Configuração da API
```bash
# Conectar repositório
railway link

# Configurar como Web Service
railway service create api-service
```

#### 📝 Variáveis de Ambiente (API)
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
API_VERSION=v1
SERVICE_TYPE=api
```

#### 🏗️ Build Commands (API)
```json
{
  "scripts": {
    "start:web": "node work/api/server.js",
    "build": "echo 'API Service Ready'",
    "dev": "nodemon work/api/server.js"
  }
}
```

### 5️⃣ Deploy Worker Service

#### ⚙️ Configuração do Worker
```bash
# Criar segundo serviço
railway service create worker-service
```

#### 📝 Variáveis de Ambiente (Worker)
```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SERVICE_TYPE=worker
WORKER_CONCURRENCY=5
```

#### 🏗️ Build Commands (Worker)
```json
{
  "scripts": {
    "start:worker": "node work/worker-redis.js",
    "build": "echo 'Worker Service Ready'",
    "dev": "nodemon work/worker-redis.js"
  }
}
```

### 6️⃣ Deploy Automático

#### 📋 Usando railway.json
```json
{
  "deploy": {
    "startCommand": "npm run start:web",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### 🤖 Script de Deploy
```bash
#!/bin/bash
# deploy-railway.sh

echo "🚂 Iniciando Deploy Railway..."

# Deploy API Service
echo "🌐 Deploying API Service..."
railway service api-service
railway up --detach

# Deploy Worker Service  
echo "⚙️ Deploying Worker Service..."
railway service worker-service
railway up --detach

echo "✅ Deploy Completo!"
echo "🔗 URLs geradas automaticamente pelo Railway"
```

## 🔍 MONITORAMENTO EM PRODUÇÃO

### 📊 Logs do Sistema
```bash
# Ver logs da API
railway logs --service api-service

# Ver logs do Worker
railway logs --service worker-service

# Logs em tempo real
railway logs --follow
```

### 🩺 Health Checks

#### API Health Endpoint
```javascript
// work/api/server.js
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api',
    redis: process.env.REDIS_URL ? 'connected' : 'disconnected',
    database: process.env.DATABASE_URL ? 'connected' : 'disconnected'
  });
});
```

#### Worker Health Logs
```javascript
// Logs automáticos no worker-redis.js
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 🚀 MODO PRODUÇÃO ATIVADO
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 🔧 Redis: CONFIGURADO
[WORKER-REDIS][2024-01-15T10:30:00.000Z] -> 🗃️ Postgres: CONFIGURADO
```

## 🔧 CONFIGURAÇÕES AVANÇADAS

### 🚨 Alertas e Notificações
```javascript
// Configurar Webhooks Railway para Slack/Discord
{
  "webhooks": {
    "deploy": "https://hooks.slack.com/...",
    "crash": "https://hooks.slack.com/..."
  }
}
```

### 📈 Scaling Automático
```bash
# Railway Dashboard:
# 1. Service Settings
# 2. Auto-scaling
# 3. Min: 1, Max: 3 instances
# 4. CPU Threshold: 70%
# 5. Memory Threshold: 80%
```

### 🔐 Segurança de Produção
```env
# Variáveis sensíveis
JWT_SECRET=ultra-secure-jwt-secret-key
API_KEY_ENCRYPTION=your-encryption-key
RATE_LIMIT_MAX=1000
CORS_ORIGINS=https://yourdomain.com
```

## 🎯 CHECKLIST DE PRODUÇÃO

### ✅ Pré-Deploy
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Redis Upstash conectado
- [ ] PostgreSQL conectado  
- [ ] Health checks implementados
- [ ] Logs de produção ativos
- [ ] Rate limiting configurado

### ✅ Pós-Deploy
- [ ] API responde em `/health`
- [ ] Worker processa jobs
- [ ] Logs aparecem no Railway
- [ ] Queue Redis funcionando
- [ ] Database queries executando
- [ ] Performance monitorada

## 🚨 TROUBLESHOOTING

### 🔴 Problemas Comuns

#### Redis Não Conecta
```bash
# Verificar REDIS_URL
railway variables

# Testar conexão
railway shell
node -e "console.log(process.env.REDIS_URL)"
```

#### Worker Não Processa
```bash
# Verificar logs
railway logs --service worker-service

# Verificar se worker está rodando
railway ps
```

#### API Não Responde
```bash
# Verificar porta
railway logs --service api-service | grep PORT

# Testar health check
curl https://your-api.railway.app/health
```

## 📞 SUPORTE E RECURSOS

### 🔗 Links Úteis
- [Railway Dashboard](https://railway.app/dashboard)
- [Railway CLI Docs](https://docs.railway.app/cli)
- [Upstash Redis Console](https://console.upstash.com/)
- [Railway Environment Variables](https://docs.railway.app/deploy/variables)

### 📧 Contato
- Railway Support: help@railway.app
- Upstash Support: support@upstash.com

---
**🎉 Seu SoundyAI está pronto para produção no Railway!**