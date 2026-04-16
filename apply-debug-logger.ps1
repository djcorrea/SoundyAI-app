# ============================================================
# apply-debug-logger.ps1
# Substitui console.log/error/warn por debugLog/debugError/debugWarn
# em todos os arquivos JS e inline scripts HTML do frontend.
#
# REGRAS:
#  - NÃO modifica logger.js (evita loop infinito)
#  - Ignora arquivos de backup / obsolete / deprecated
#  - Preserva encoding UTF-8 (com ou sem BOM)
#  - Idempotente: rodar duas vezes é seguro (não há mais console.*
#    após a primeira execução)
# ============================================================

$publicDir = Join-Path $PSScriptRoot "public"

# Arquivos que NUNCA devem ser tocados
$SKIP_FILES = @(
  "logger.js",
  "apply-logger-system.cjs",
  "apply-logger-simple.cjs",
  "add-logger-to-all-html.cjs",
  "apply-debug-logger.ps1"
)

# Sufixos de arquivos de backup / obsolete — ignorar
$SKIP_SUFFIXES = @(
  ".backup",
  ".bak",
  ".backup_v5",
  ".DEPRECATED",
  ".obsolete-webaudio",
  ".obsolete"
)

# ── Helpers ──────────────────────────────────────────────────────────────────

function ShouldSkip($file) {
  if ($SKIP_FILES -contains $file.Name) { return $true }
  foreach ($suffix in $SKIP_SUFFIXES) {
    if ($file.Name.EndsWith($suffix)) { return $true }
  }
  return $false
}

function ApplyReplacements($text) {
  $t = $text
  $t = $t -replace 'console\.log\(',   'debugLog('
  $t = $t -replace 'console\.error\(', 'debugError('
  $t = $t -replace 'console\.warn\(',  'debugWarn('
  return $t
}

function ProcessFile($filePath) {
  # Ler preservando BOM (ReadAllText detecta BOM automaticamente)
  $raw = [System.IO.File]::ReadAllText($filePath)

  # Verificar se há algo a substituir
  if ($raw -notmatch 'console\.(log|error|warn)\(') { return $false }

  $updated = ApplyReplacements $raw
  if ($updated -eq $raw) { return $false }

  # Detectar se arquivo tinha BOM
  $bytes = [System.IO.File]::ReadAllBytes($filePath)
  $hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)

  if ($hasBOM) {
    $enc = New-Object System.Text.UTF8Encoding($true)   # UTF-8 com BOM
  } else {
    $enc = New-Object System.Text.UTF8Encoding($false)  # UTF-8 sem BOM
  }

  [System.IO.File]::WriteAllText($filePath, $updated, $enc)
  return $true
}

# ── Processar arquivos JS ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗"
Write-Host "║   apply-debug-logger.ps1 — SoundyAI Frontend Log Control   ║"
Write-Host "╚══════════════════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "📁 Diretório: $publicDir"
Write-Host ""

$jsStats    = @{ modified = 0; skipped = 0; unchanged = 0 }
$htmlStats  = @{ modified = 0; skipped = 0; unchanged = 0 }

# Todos os .js recursivos
$jsFiles = Get-ChildItem -Path $publicDir -Recurse -Include "*.js"

foreach ($file in $jsFiles) {
  if (ShouldSkip $file) {
    $jsStats.skipped++
    continue
  }
  $changed = ProcessFile $file.FullName
  if ($changed) {
    $jsStats.modified++
    $rel = $file.FullName.Replace($publicDir + "\", "")
    Write-Host "  ✅ JS  $rel"
  } else {
    $jsStats.unchanged++
  }
}

Write-Host ""
Write-Host "──────────────────────────────────────────────────────────────"
Write-Host "  JS → modificados: $($jsStats.modified)  sem alteração: $($jsStats.unchanged)  ignorados: $($jsStats.skipped)"
Write-Host "──────────────────────────────────────────────────────────────"
Write-Host ""

# ── Processar inline scripts nos HTML ────────────────────────────────────────

$htmlFiles = Get-ChildItem -Path "$publicDir\*.html"

foreach ($file in $htmlFiles) {
  $raw = [System.IO.File]::ReadAllText($file.FullName)

  if ($raw -notmatch 'console\.(log|error|warn)\(') {
    $htmlStats.unchanged++
    continue
  }

  $updated = ApplyReplacements $raw
  if ($updated -ne $raw) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($file.FullName, $updated, $enc)
    $htmlStats.modified++
    Write-Host "  ✅ HTML $($file.Name)"
  } else {
    $htmlStats.unchanged++
  }
}

Write-Host ""
Write-Host "──────────────────────────────────────────────────────────────"
Write-Host "  HTML → modificados: $($htmlStats.modified)  sem alteração: $($htmlStats.unchanged)"
Write-Host "──────────────────────────────────────────────────────────────"
Write-Host ""

$totalMod = $jsStats.modified + $htmlStats.modified
Write-Host "CONCLUIDO - $totalMod arquivo(s) atualizados"
Write-Host ""
Write-Host "  Para ativar debug no navegador:"
Write-Host "    window.DEBUG_MODE = true"
Write-Host ""
