# Script para adicionar hook do Demo Mode no script.js
$file = Join-Path $PSScriptRoot "public\script.js"
$content = Get-Content $file -Raw -Encoding UTF8

# Hook para interceptar ANTES de verificar anônimo
$searchPattern = 'if \(window\.SoundyAnonymous && window\.SoundyAnonymous\.isAnonymousMode\) \{\s+if \(!window\.SoundyAnonymous\.interceptMessage\(\)\)'

$newCode = @'
// 🔥 MODO DEMO: Verificar limite de mensagens (PRIORIDADE)
        if (window.SoundyDemo && window.SoundyDemo.isActive) {
            if (!window.SoundyDemo.interceptMessage()) {
                console.log('🚫 [SCRIPT] Mensagem bloqueada - limite demo atingido');
                return;
            }
        }
        // 🔓 MODO ANÔNIMO: Verificar limite de mensagens
        else if (window.SoundyAnonymous && window.SoundyAnonymous.isAnonymousMode) {
            if (!window.SoundyAnonymous.interceptMessage())
'@

$newContent = [regex]::Replace($content, $searchPattern, $newCode)

if ($content -eq $newContent) {
    Write-Host "ERRO: Padrao nao encontrado" -ForegroundColor Red
    exit 1
} else {
    Set-Content $file -Value $newContent -NoNewline -Encoding UTF8
    Write-Host "SUCESSO: Hook do Demo Mode adicionado!" -ForegroundColor Green
}
