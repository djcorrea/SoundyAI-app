#!/bin/bash

###############################################################################
# 🧪 SCRIPT DE TESTE RÁPIDO - SoundyAI Concurrency Test
###############################################################################
#
# Este script facilita a execução do teste de concorrência com parâmetros
# pré-configurados.
#
# USO:
#   1. Configure as variáveis abaixo
#   2. Execute: ./run-test.sh
#
###############################################################################

# ═══════════════════════════════════════════════════════════════════════════
# 📋 CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════════════════════

# Caminho para o arquivo de áudio (obrigatório)
AUDIO_FILE="./test-audio.wav"

# Firebase ID Token (obrigatório)
# Para obter um token válido, execute:
#   node get-firebase-token.js --email=seu@email.com --password=suasenha
# Ou carregue de um arquivo:
FIREBASE_TOKEN_FILE=".firebase-token"

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 EXECUÇÃO
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "🧪 EXECUTANDO TESTE DE CONCORRÊNCIA - SoundyAI"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Verificar se o arquivo de áudio existe
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Erro: Arquivo de áudio não encontrado: $AUDIO_FILE"
    echo ""
    echo "Por favor, configure a variável AUDIO_FILE com o caminho correto."
    echo ""
    exit 1
fi

echo "✅ Arquivo de áudio encontrado: $AUDIO_FILE"

# Obter token do arquivo ou variável
if [ -f "$FIREBASE_TOKEN_FILE" ]; then
    FIREBASE_TOKEN=$(cat "$FIREBASE_TOKEN_FILE")
    echo "✅ Firebase token carregado de: $FIREBASE_TOKEN_FILE"
elif [ -z "$FIREBASE_TOKEN" ]; then
    echo "❌ Erro: Firebase token não configurado"
    echo ""
    echo "Configure o token de uma das formas:"
    echo "  1. Crie o arquivo .firebase-token com o token"
    echo "  2. Execute: node get-firebase-token.js --email=... --password=..."
    echo "  3. Ou defina a variável FIREBASE_TOKEN neste script"
    echo ""
    exit 1
else
    echo "✅ Firebase token configurado"
fi

echo ""
echo "🚀 Iniciando teste de concorrência..."
echo ""

# Executar o teste
node test-concurrency.js \
    --audioFile="$AUDIO_FILE" \
    --idToken="$FIREBASE_TOKEN"

# Capturar código de saída
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Teste concluído com sucesso!"
else
    echo "❌ Teste falhou com código: $EXIT_CODE"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

exit $EXIT_CODE
