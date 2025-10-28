#!/bin/bash

# � Script de Deploy Automático para Railway
# SoundyAI - Dual Service Deployment

echo "� =========================================="
echo "🚂 SOUNDYAI - RAILWAY DEPLOYMENT SCRIPT"
echo "🚂 =========================================="
echo ""

# Verificar se Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI não encontrado!"
    echo "� Instale com: npm install -g @railway/cli"
    exit 1
fi

# Verificar se está logado
if ! railway whoami &> /dev/null; then
    echo "🔐 Fazendo login no Railway..."
    railway login
fi

echo "✅ Railway CLI configurado!"
echo ""

# Criar projeto se não existir
echo "🏗️ Configurando projeto Railway..."
if ! railway status &> /dev/null; then
    echo "� Criando novo projeto..."
    railway new soundyai-production
else
    echo "✅ Projeto existente detectado"
fi

echo ""
echo "🌐 =========================================="
echo "🌐 DEPLOY DO API SERVICE"
echo "🌐 =========================================="

# Criar/Configurar API Service
echo "🔧 Configurando API Service..."
railway service create api-service 2>/dev/null || echo "⚠️ API Service já existe"

# Definir variáveis de ambiente para API
echo "📝 Configurando variáveis de ambiente da API..."
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set SERVICE_TYPE=api
railway variables set API_VERSION=v1

# Deploy da API
echo "� Deploying API Service..."
railway up --detach --service api-service

echo ""
echo "⚙️ =========================================="
echo "⚙️ DEPLOY DO WORKER SERVICE" 
echo "⚙️ =========================================="

# Criar/Configurar Worker Service
echo "🔧 Configurando Worker Service..."
railway service create worker-service 2>/dev/null || echo "⚠️ Worker Service já existe"

# Definir variáveis de ambiente para Worker
echo "📝 Configurando variáveis de ambiente do Worker..."
railway variables set NODE_ENV=production --service worker-service
railway variables set SERVICE_TYPE=worker --service worker-service
railway variables set WORKER_CONCURRENCY=5 --service worker-service

# Deploy do Worker
echo "🚀 Deploying Worker Service..."
railway up --detach --service worker-service

echo ""
echo "🗃️ =========================================="
echo "�️ CONFIGURAÇÃO DE DATABASES"
echo "🗃️ =========================================="

# Adicionar PostgreSQL se não existir
echo "🐘 Verificando PostgreSQL..."
if ! railway add postgresql &> /dev/null; then
    echo "⚠️ PostgreSQL já configurado ou falha na criação"
else
    echo "✅ PostgreSQL adicionado com sucesso!"
fi

# Adicionar Redis se não existir  
echo "📦 Verificando Redis..."
if ! railway add redis &> /dev/null; then
    echo "⚠️ Redis já configurado ou falha na criação"
else
    echo "✅ Redis adicionado com sucesso!"
fi

echo ""
echo "🔗 =========================================="
echo "🔗 OBTENDO INFORMAÇÕES DE DEPLOY"
echo "🔗 =========================================="

# Mostrar status dos serviços
echo "📊 Status dos serviços:"
railway status

echo ""
echo "🌍 URLs dos serviços:"
railway domain

echo ""
echo "📋 =========================================="
echo "📋 PRÓXIMOS PASSOS"
echo "📋 =========================================="

echo "1️⃣ Configure as variáveis de ambiente sensíveis:"
echo "   • DATABASE_URL (PostgreSQL)"
echo "   • REDIS_URL (Redis/Upstash)"
echo ""
echo "2️⃣ Verificar logs:"
echo "   • railway logs --service api-service"
echo "   • railway logs --service worker-service"
echo ""
echo "3️⃣ Testar health checks:"
echo "   • curl https://[seu-dominio]/health"
echo ""
echo "4️⃣ Monitorar performance:"
echo "   • Railway Dashboard: https://railway.app/dashboard"
echo ""

echo "✅ =========================================="
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "✅ =========================================="
echo ""
echo "🎉 SoundyAI está rodando em produção no Railway!"
echo "📖 Consulte DEPLOYMENT_RAILWAY_GUIDE.md para mais detalhes"
echo ""