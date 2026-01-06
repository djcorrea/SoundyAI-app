###############################################################################
# 🧪 SCRIPT DE TESTE RÁPIDO - SoundyAI Concurrency Test (Windows PowerShell)
###############################################################################
#
# Este script facilita a execução do teste de concorrência com parâmetros
# pré-configurados no Windows.
#
# USO:
#   1. Configure as variáveis abaixo
#   2. Execute: .\run-test.ps1
#
###############################################################################

# ═══════════════════════════════════════════════════════════════════════════
# 📋 CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════════════════════

# Caminho para o arquivo de áudio (obrigatório)
$AUDIO_FILE = ".\test-audio.wav"

# Firebase ID Token (obrigatório)
# Para obter um token válido, execute:
#   node get-firebase-token.js --email=seu@email.com --password=suasenha
# Ou carregue de um arquivo:
$FIREBASE_TOKEN_FILE = ".firebase-token"

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 EXECUÇÃO
# ═══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════"
Write-Host "🧪 EXECUTANDO TESTE DE CONCORRÊNCIA - SoundyAI"
Write-Host "═══════════════════════════════════════════════════════════════════════════"
Write-Host ""

# Verificar se o arquivo de áudio existe
if (-not (Test-Path $AUDIO_FILE)) {
    Write-Host "❌ Erro: Arquivo de áudio não encontrado: $AUDIO_FILE" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, configure a variável AUDIO_FILE com o caminho correto."
    Write-Host ""
    exit 1
}

Write-Host "✅ Arquivo de áudio encontrado: $AUDIO_FILE" -ForegroundColor Green

# Obter token do arquivo ou variável
$FIREBASE_TOKEN = $null

if (Test-Path $FIREBASE_TOKEN_FILE) {
    $FIREBASE_TOKEN = Get-Content $FIREBASE_TOKEN_FILE -Raw
    $FIREBASE_TOKEN = $FIREBASE_TOKEN.Trim()
    Write-Host "✅ Firebase token carregado de: $FIREBASE_TOKEN_FILE" -ForegroundColor Green
}
elseif ([string]::IsNullOrEmpty($FIREBASE_TOKEN)) {
    Write-Host "❌ Erro: Firebase token não configurado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Configure o token de uma das formas:"
    Write-Host "  1. Crie o arquivo .firebase-token com o token"
    Write-Host "  2. Execute: node get-firebase-token.js --email=... --password=..."
    Write-Host "  3. Ou defina a variável `$FIREBASE_TOKEN neste script"
    Write-Host ""
    exit 1
}
else {
    Write-Host "✅ Firebase token configurado" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Iniciando teste de concorrência..." -ForegroundColor Cyan
Write-Host ""

# Executar o teste
node test-concurrency.js --audioFile="$AUDIO_FILE" --idToken="$FIREBASE_TOKEN"

# Capturar código de saída
$EXIT_CODE = $LASTEXITCODE

Write-Host ""
if ($EXIT_CODE -eq 0) {
    Write-Host "✅ Teste concluído com sucesso!" -ForegroundColor Green
}
else {
    Write-Host "❌ Teste falhou com código: $EXIT_CODE" -ForegroundColor Red
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════"
Write-Host ""

exit $EXIT_CODE
