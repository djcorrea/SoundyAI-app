# Script para atualizar todos os arquivos JSON de gêneros
# com os novos valores de targets

$ErrorActionPreference = "Stop"

# Definição dos novos valores para cada gênero
$genreUpdates = @{
    "funk_bruxaria" = @{
        lufs = -7.5; truePeak = -0.15; dr = 6.0; stereo = 0.875; rms = -10.5
        tolLufs = 1.0; tolPeak = 0.15; tolDr = 1.0; tolStereo = 0.075
        bands = @{
            sub = @{min = -28; max = -22; target = -25; tol = 3}
            low_bass = @{min = -28; max = -22; target = -25; tol = 3}
            upper_bass = @{min = -31; max = -25; target = -28; tol = 3}
            low_mid = @{min = -31; max = -25; target = -28; tol = 3}
            mid = @{min = -35; max = -28; target = -31.5; tol = 3.5}
            high_mid = @{min = -42; max = -33; target = -37.5; tol = 4.5}
            brilho = @{min = -50; max = -40; target = -45; tol = 5}
            presenca = @{min = -46; max = -40; target = -43; tol = 3}
        }
    }
    "funk_automotivo" = @{
        lufs = -9.0; truePeak = -0.25; dr = 6.75; stereo = 0.915; rms = -12.0
        tolLufs = 1.0; tolPeak = 0.25; tolDr = 1.25; tolStereo = 0.065
        bands = @{
            sub = @{min = -29; max = -23; target = -26; tol = 3}
            low_bass = @{min = -29; max = -23; target = -26; tol = 3}
            upper_bass = @{min = -32; max = -26; target = -29; tol = 3}
            low_mid = @{min = -32; max = -26; target = -29; tol = 3}
            mid = @{min = -35; max = -28; target = -31.5; tol = 3.5}
            high_mid = @{min = -42; max = -33; target = -37.5; tol = 4.5}
            brilho = @{min = -48; max = -38; target = -43; tol = 5}
            presenca = @{min = -44; max = -38; target = -41; tol = 3}
        }
    }
    "eletrofunk" = @{
        lufs = -10.0; truePeak = -0.25; dr = 7.25; stereo = 0.915; rms = -13.0
        tolLufs = 1.0; tolPeak = 0.25; tolDr = 1.25; tolStereo = 0.065
        bands = @{
            sub = @{min = -29; max = -23; target = -26; tol = 3}
            low_bass = @{min = -30; max = -24; target = -27; tol = 3}
            upper_bass = @{min = -32; max = -26; target = -29; tol = 3}
            low_mid = @{min = -32; max = -26; target = -29; tol = 3}
            mid = @{min = -35; max = -28; target = -31.5; tol = 3.5}
            high_mid = @{min = -42; max = -33; target = -37.5; tol = 4.5}
            brilho = @{min = -48; max = -38; target = -43; tol = 5}
            presenca = @{min = -44; max = -38; target = -41; tol = 3}
        }
    }
    "tech_house" = @{
        lufs = -10.5; truePeak = -0.65; dr = 8.5; stereo = 0.915; rms = -13.5
        tolLufs = 1.0; tolPeak = 0.35; tolDr = 1.5; tolStereo = 0.065
        bands = @{
            sub = @{min = -32; max = -25; target = -28.5; tol = 3.5}
            low_bass = @{min = -31; max = -25; target = -28; tol = 3}
            upper_bass = @{min = -33; max = -27; target = -30; tol = 3}
            low_mid = @{min = -33; max = -27; target = -30; tol = 3}
            mid = @{min = -36; max = -28; target = -32; tol = 4}
            high_mid = @{min = -43; max = -34; target = -38.5; tol = 4.5}
            brilho = @{min = -46; max = -36; target = -41; tol = 5}
            presenca = @{min = -44; max = -38; target = -41; tol = 3}
        }
    }
    "techno" = @{
        lufs = -10.5; truePeak = -0.65; dr = 8.5; stereo = 0.915; rms = -13.5
        tolLufs = 1.0; tolPeak = 0.35; tolDr = 1.5; tolStereo = 0.065
        bands = @{
            sub = @{min = -32; max = -25; target = -28.5; tol = 3.5}
            low_bass = @{min = -31; max = -25; target = -28; tol = 3}
            upper_bass = @{min = -33; max = -27; target = -30; tol = 3}
            low_mid = @{min = -33; max = -27; target = -30; tol = 3}
            mid = @{min = -36; max = -28; target = -32; tol = 4}
            high_mid = @{min = -43; max = -34; target = -38.5; tol = 4.5}
            brilho = @{min = -46; max = -36; target = -41; tol = 5}
            presenca = @{min = -44; max = -38; target = -41; tol = 3}
        }
    }
    "house" = @{
        lufs = -10.5; truePeak = -0.65; dr = 8.5; stereo = 0.915; rms = -13.5
        tolLufs = 1.0; tolPeak = 0.35; tolDr = 1.5; tolStereo = 0.065
        bands = @{
            sub = @{min = -32; max = -25; target = -28.5; tol = 3.5}
            low_bass = @{min = -31; max = -25; target = -28; tol = 3}
            upper_bass = @{min = -33; max = -27; target = -30; tol = 3}
            low_mid = @{min = -33; max = -27; target = -30; tol = 3}
            mid = @{min = -36; max = -28; target = -32; tol = 4}
            high_mid = @{min = -43; max = -34; target = -38.5; tol = 4.5}
            brilho = @{min = -46; max = -36; target = -41; tol = 5}
            presenca = @{min = -44; max = -38; target = -41; tol = 3}
        }
    }
    "trap" = @{
        lufs = -10.5; truePeak = -0.65; dr = 10.0; stereo = 0.875; rms = -13.5
        tolLufs = 1.5; tolPeak = 0.35; tolDr = 2.0; tolStereo = 0.075
        bands = @{
            sub = @{min = -30; max = -24; target = -27; tol = 3}
            low_bass = @{min = -30; max = -24; target = -27; tol = 3}
            upper_bass = @{min = -32; max = -26; target = -29; tol = 3}
            low_mid = @{min = -32; max = -26; target = -29; tol = 3}
            mid = @{min = -35; max = -28; target = -31.5; tol = 3.5}
            high_mid = @{min = -43; max = -34; target = -38.5; tol = 4.5}
            brilho = @{min = -48; max = -38; target = -43; tol = 5}
            presenca = @{min = -44; max = -38; target = -41; tol = 3}
        }
    }
    "trance" = @{
        lufs = -10.5; truePeak = -0.65; dr = 10.5; stereo = 0.915; rms = -13.5
        tolLufs = 1.5; tolPeak = 0.35; tolDr = 1.5; tolStereo = 0.065
        bands = @{
            sub = @{min = -33; max = -25; target = -29; tol = 4}
            low_bass = @{min = -31; max = -25; target = -28; tol = 3}
            upper_bass = @{min = -34; max = -28; target = -31; tol = 3}
            low_mid = @{min = -34; max = -28; target = -31; tol = 3}
            mid = @{min = -36; max = -28; target = -32; tol = 4}
            high_mid = @{min = -43; max = -34; target = -38.5; tol = 4.5}
            brilho = @{min = -46; max = -36; target = -41; tol = 5}
            presenca = @{min = -44; max = -38; target = -41; tol = 3}
        }
    }
    "brazilian_phonk" = @{
        lufs = -9.0; truePeak = -0.25; dr = 7.0; stereo = 0.915; rms = -12.0
        tolLufs = 1.0; tolPeak = 0.25; tolDr = 1.0; tolStereo = 0.065
        bands = @{
            sub = @{min = -28; max = -22; target = -25; tol = 3}
            low_bass = @{min = -28; max = -22; target = -25; tol = 3}
            upper_bass = @{min = -31; max = -25; target = -28; tol = 3}
            low_mid = @{min = -31; max = -25; target = -28; tol = 3}
            mid = @{min = -35; max = -28; target = -31.5; tol = 3.5}
            high_mid = @{min = -42; max = -33; target = -37.5; tol = 4.5}
            brilho = @{min = -50; max = -40; target = -45; tol = 5}
            presenca = @{min = -46; max = -40; target = -43; tol = 3}
        }
    }
    "phonk" = @{
        lufs = -9.0; truePeak = -0.25; dr = 7.0; stereo = 0.915; rms = -12.0
        tolLufs = 1.0; tolPeak = 0.25; tolDr = 1.0; tolStereo = 0.065
        bands = @{
            sub = @{min = -28; max = -22; target = -25; tol = 3}
            low_bass = @{min = -28; max = -22; target = -25; tol = 3}
            upper_bass = @{min = -31; max = -25; target = -28; tol = 3}
            low_mid = @{min = -31; max = -25; target = -28; tol = 3}
            mid = @{min = -35; max = -28; target = -31.5; tol = 3.5}
            high_mid = @{min = -42; max = -33; target = -37.5; tol = 4.5}
            brilho = @{min = -50; max = -40; target = -45; tol = 5}
            presenca = @{min = -46; max = -40; target = -43; tol = 3}
        }
    }
}

$basePath = "c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\refs\out"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  ATUALIZAÇÃO EM MASSA DE GÊNEROS" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

foreach ($genreKey in $genreUpdates.Keys) {
    $filePath = Join-Path $basePath "$genreKey.json"
    
    if (-not (Test-Path $filePath)) {
        Write-Host "❌ Arquivo não encontrado: $genreKey.json" -ForegroundColor Red
        continue
    }
    
    Write-Host "🔄 Atualizando $genreKey.json..." -ForegroundColor Yellow
    
    try {
        # Ler JSON
        $json = Get-Content $filePath -Raw | ConvertFrom-Json
        $data = $genreUpdates[$genreKey]
        
        # Atualizar original_metrics
        $json.$genreKey.hybrid_processing.original_metrics.lufs_integrated = $data.lufs
        $json.$genreKey.hybrid_processing.original_metrics.true_peak_dbtp = $data.truePeak
        $json.$genreKey.hybrid_processing.original_metrics.dynamic_range = $data.dr
        $json.$genreKey.hybrid_processing.original_metrics.rms_db = $data.rms
        $json.$genreKey.hybrid_processing.original_metrics.stereo_correlation = $data.stereo
        
        # Atualizar legacy_compatibility
        $json.$genreKey.legacy_compatibility.lufs_target = $data.lufs
        $json.$genreKey.legacy_compatibility.true_peak_target = $data.truePeak
        $json.$genreKey.legacy_compatibility.dr_target = $data.dr
        $json.$genreKey.legacy_compatibility.stereo_target = $data.stereo
        $json.$genreKey.legacy_compatibility.tol_lufs = $data.tolLufs
        $json.$genreKey.legacy_compatibility.tol_true_peak = $data.tolPeak
        $json.$genreKey.legacy_compatibility.tol_dr = $data.tolDr
        $json.$genreKey.legacy_compatibility.tol_stereo = $data.tolStereo
        
        # Atualizar bandas espectrais em spectral_bands
        foreach ($bandName in $data.bands.Keys) {
            $bandData = $data.bands[$bandName]
            
            if ($json.$genreKey.hybrid_processing.spectral_bands.$bandName) {
                $json.$genreKey.hybrid_processing.spectral_bands.$bandName.target_range = @{
                    min = $bandData.min
                    max = $bandData.max
                }
                $json.$genreKey.hybrid_processing.spectral_bands.$bandName.target_db = $bandData.target
                $json.$genreKey.hybrid_processing.spectral_bands.$bandName.tol_db = $bandData.tol
            }
        }
        
        # Atualizar bandas espectrais em legacy_compatibility.bands
        foreach ($bandName in $data.bands.Keys) {
            $bandData = $data.bands[$bandName]
            
            if ($json.$genreKey.legacy_compatibility.bands.$bandName) {
                $json.$genreKey.legacy_compatibility.bands.$bandName.target_range = @{
                    min = $bandData.min
                    max = $bandData.max
                }
                $json.$genreKey.legacy_compatibility.bands.$bandName.target_db = $bandData.target
                $json.$genreKey.legacy_compatibility.bands.$bandName.tol_db = $bandData.tol
            }
        }
        
        # Salvar JSON atualizado
        $json | ConvertTo-Json -Depth 10 | Set-Content $filePath -Encoding UTF8
        
        Write-Host "   ✅ $genreKey.json atualizado com sucesso!" -ForegroundColor Green
        
    } catch {
        Write-Host "   ❌ ERRO ao atualizar $genreKey.json: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  VALIDANDO TODOS OS ARQUIVOS" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$allValid = $true
foreach ($genreKey in $genreUpdates.Keys) {
    $filePath = Join-Path $basePath "$genreKey.json"
    
    if (Test-Path $filePath) {
        try {
            Get-Content $filePath | ConvertFrom-Json | Out-Null
            Write-Host "✅ $genreKey.json - VÁLIDO" -ForegroundColor Green
        } catch {
            Write-Host "❌ $genreKey.json - INVÁLIDO: $_" -ForegroundColor Red
            $allValid = $false
        }
    }
}

Write-Host ""
if ($allValid) {
    Write-Host "🎉 TODOS OS ARQUIVOS FORAM ATUALIZADOS E VALIDADOS COM SUCESSO!" -ForegroundColor Green
} else {
    Write-Host "⚠️  ALGUNS ARQUIVOS APRESENTARAM ERROS. VERIFIQUE ACIMA." -ForegroundColor Yellow
}
