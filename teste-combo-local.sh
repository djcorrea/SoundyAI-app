#!/bin/bash

# teste-combo-local.sh
# 🧪 Teste local do combo API + Worker

echo "🧪 [TESTE] Testando start-combo.js localmente..."
echo "========================================"

# Verificar se .env existe
if [ ! -f "work/.env" ]; then
  echo "❌ [TESTE] Arquivo work/.env não encontrado!"
  echo "📝 [TESTE] Crie work/.env com:"
  echo "REDIS_URL=rediss://guided-snapper-23234.upstash.io:6379"
  exit 1
fi

echo "✅ [TESTE] Arquivo .env encontrado"

# Verificar dependências
echo "📦 [TESTE] Verificando dependências..."
cd work
if [ ! -d "node_modules" ]; then
  echo "📦 [TESTE] Instalando dependências do work/..."
  npm install
fi

cd ..
if [ ! -d "node_modules" ]; then
  echo "📦 [TESTE] Instalando dependências da raiz..."
  npm install
fi

echo "✅ [TESTE] Dependências verificadas"

# Testar start-combo
echo "🚀 [TESTE] Iniciando combo API + Worker..."
echo "💡 [TESTE] Use Ctrl+C para parar"
echo "📍 [TESTE] API: http://localhost:3000"
echo "📍 [TESTE] Health: http://localhost:8082/health"
echo ""

# Executar com timeout de 30s para teste
timeout 30s node work/start-combo.js || {
  echo ""
  echo "⏰ [TESTE] Teste finalizado (30s timeout)"
  echo "✅ [TESTE] Se não houve erros, o combo está funcionando!"
}