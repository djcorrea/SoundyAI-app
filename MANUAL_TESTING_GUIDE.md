# 🧪 Guia de Teste Manual: Granular V1

Este guia fornece comandos e procedimentos para testar a implementação do engine granular_v1.

---

## 📋 Pré-requisitos

- Node.js instalado
- Projeto SoundyAI configurado
- Acesso ao arquivo `.env`
- Pelo menos 1 arquivo de áudio WAV para teste

---

## 🧪 Teste 1: Módulo Isolado (Unitário)

### Objetivo
Validar que o módulo `spectral-bands-granular.js` funciona corretamente de forma isolada.

### Comandos

```bash
# Navegar até o diretório do projeto
cd "c:\Users\DJ Correa\Desktop\Programação\SoundyAI"

# Executar testes unitários
node work/tests/spectral-bands-granular.test.js
```

### Resultado Esperado

```
🧪 INICIANDO TESTES DO MÓDULO GRANULAR V1

============================================================

📋 Teste 1: Constantes e Configuração
✅ DEFAULT_GRANULAR_BANDS tem 13 bandas
✅ DEFAULT_GROUPING tem 7 grupos
✅ Peso ideal = 0
✅ Peso adjust = 1
✅ Peso fix = 3

🔧 Teste 2: Funções Utilitárias
✅ freqToBin(100Hz) ≈ 8-9
✅ freqToBin(1000Hz) ≈ 85
✅ linearToDb(1.0) = 0 dB
✅ linearToDb(0.5) ≈ -6 dB
✅ Desvio 0.5σ → ideal
✅ Desvio 2.0σ → adjust
✅ Desvio 3.5σ → fix

🎯 Teste 3: Análise Granular Completa
✅ Algorithm = granular_v1
✅ Granular tem 13 sub-bandas
✅ Groups tem 7 bandas principais
✅ Suggestions é um array
✅ Frames processados = 100
✅ Método de agregação = median
...

📊 RESUMO DOS TESTES

✅ Testes passados: 35
❌ Testes falhos: 0
📈 Taxa de sucesso: 100.0%

🎉 TODOS OS TESTES PASSARAM!
```

### ❌ Se falhar

- Verificar imports no arquivo de teste
- Verificar sintaxe do módulo granular
- Consultar logs de erro

---

## 🧪 Teste 2: Legacy (Regressão)

### Objetivo
Garantir que o modo `legacy` continua funcionando exatamente como antes.

### Comandos

```bash
# 1. Configurar .env para legacy
# Editar .env e definir:
ANALYZER_ENGINE=legacy

# 2. Iniciar worker (em um terminal separado)
node work/index.js

# 3. Upload de um arquivo de teste via frontend ou API
# (usar Postman, curl, ou interface web)
```

### Resultado Esperado nos Logs

```
[WORKER] Iniciando processamento do job...
🔄 [SPECTRAL_BANDS] Engine legacy ativado
🔍 [SPECTRAL_BANDS_CRITICAL] Início do cálculo
✅ [SPECTRAL_BANDS_CRITICAL] Frame 0 VÁLIDO - Analisando bandas...
...
[WORKER] Job concluído com sucesso
```

### Validar Payload

```json
{
  "score": 74,
  "classification": "Bom",
  "bands": {
    "sub": { "energy_db": -28.3, "percentage": 15.2, "status": "calculated" },
    "bass": { "energy_db": -29.1, "percentage": 22.5, "status": "calculated" },
    ...
  },
  "technicalData": {
    "lufsIntegrated": -13.2,
    "truePeakDbtp": -1.0,
    "dynamicRange": 11.8,
    ...
  }
  // NÃO deve ter: engineVersion, granular, suggestions
}
```

### ✅ Critérios de Sucesso

- [ ] Logs mostram `Engine legacy ativado`
- [ ] Bandas calculadas: sub, bass, lowMid, mid, highMid, presence, air
- [ ] Payload **NÃO** contém campos `engineVersion`, `granular`, `suggestions`
- [ ] LUFS, True Peak, DR calculados corretamente
- [ ] Score e classificação presentes

---

## 🧪 Teste 3: Granular V1

### Objetivo
Validar que o engine granular_v1 funciona e gera sub-bandas + sugestões.

### Comandos

```bash
# 1. Configurar .env para granular_v1
# Editar .env e definir:
ANALYZER_ENGINE=granular_v1

# 2. Reiniciar worker
# CTRL+C no terminal do worker anterior
node work/index.js

# 3. Upload do MESMO arquivo usado no Teste 2
```

### Resultado Esperado nos Logs

```
[WORKER] Iniciando processamento do job...
🚀 [SPECTRAL_BANDS] Engine granular_v1 ativado
🔍 [GRANULAR_V1] Início da análise granular: {
  hasFramesFFT: true,
  frameCount: 1028
}
🔍 [GRANULAR_V1] Frames convertidos: {
  originalCount: 1028,
  convertedCount: 1028
}
🚀 [GRANULAR_V1] Iniciando análise com 1028 frames
✅ [GRANULAR_V1] Análise concluída: {
  algorithm: 'granular_v1',
  groupsCount: 7,
  granularCount: 13,
  suggestionsCount: 3,
  subBandsIdeal: 9,
  subBandsAdjust: 2,
  subBandsFix: 2
}
[WORKER] Job concluído com sucesso
```

### Validar Payload

```json
{
  "score": 74,
  "classification": "Bom",
  "engineVersion": "granular_v1",
  
  "bands": {
    "sub": { "status": "yellow", "score": 1.0, "description": "Sub-bass com desvio moderado" },
    "bass": { "status": "green", "score": 0.0, "description": "Bass ideal" },
    ...
  },
  
  "granular": [
    {
      "id": "sub_low",
      "range": [20, 40],
      "energyDb": -28.3,
      "target": -28.0,
      "deviation": -0.3,
      "deviationSigmas": 0.2,
      "status": "ideal"
    },
    {
      "id": "sub_high",
      "range": [40, 60],
      "energyDb": -32.1,
      "target": -29.0,
      "deviation": -3.1,
      "deviationSigmas": 2.07,
      "status": "adjust"
    },
    // ... mais 11 sub-bandas
  ],
  
  "suggestions": [
    {
      "priority": "high",
      "freq_range": [40, 60],
      "type": "boost",
      "amount": 2.5,
      "metric": "frequency_balance",
      "deviation": -3.1,
      "message": "Falta energia em 40–60 Hz — reforçar ~2.5 dB (harmônicos do kick)."
    }
  ],
  
  "granularMetadata": {
    "referenceGenre": "techno",
    "schemaVersion": 1,
    "framesProcessed": 1028,
    "subBandsTotal": 13,
    "subBandsIdeal": 9,
    "subBandsAdjust": 2,
    "subBandsFix": 2
  },
  
  "technicalData": {
    "lufsIntegrated": -13.2,
    "truePeakDbtp": -1.0,
    "dynamicRange": 11.8,
    ...
  }
}
```

### ✅ Critérios de Sucesso

- [ ] Logs mostram `Engine granular_v1 ativado`
- [ ] Logs mostram `Análise concluída: 13 sub-bandas`
- [ ] Payload contém `engineVersion: "granular_v1"`
- [ ] Array `granular` com 13 sub-bandas
- [ ] Array `suggestions` presente (pode estar vazio se tudo ideal)
- [ ] Bandas principais agregadas (sub, bass, etc.)
- [ ] Metadados granulares presentes
- [ ] LUFS, True Peak, DR **idênticos ao Teste 2** (tolerância < 0.1%)

---

## 🧪 Teste 4: Comparação Legacy vs Granular

### Objetivo
Garantir que as métricas fundamentais (LUFS, TP, DR) são idênticas entre engines.

### Comandos

```bash
# 1. Processar com legacy e salvar resultado
ANALYZER_ENGINE=legacy
node work/index.js > output_legacy.json

# 2. Processar com granular_v1 e salvar resultado
ANALYZER_ENGINE=granular_v1
node work/index.js > output_granular.json

# 3. Comparar métricas críticas
```

### Script de Comparação (PowerShell)

```powershell
# comparar-metricas.ps1

$legacy = Get-Content output_legacy.json | ConvertFrom-Json
$granular = Get-Content output_granular.json | ConvertFrom-Json

$metricas = @(
    "technicalData.lufsIntegrated",
    "technicalData.truePeakDbtp",
    "technicalData.dynamicRange",
    "technicalData.lra",
    "technicalData.stereoCorrelation"
)

Write-Host "🔍 Comparando métricas críticas:`n"

foreach ($metrica in $metricas) {
    $parts = $metrica -split '\.'
    $legacyVal = $legacy
    $granularVal = $granular
    
    foreach ($part in $parts) {
        $legacyVal = $legacyVal.$part
        $granularVal = $granularVal.$part
    }
    
    $diff = [Math]::Abs($legacyVal - $granularVal)
    $diffPct = if ($legacyVal -ne 0) { ($diff / [Math]::Abs($legacyVal)) * 100 } else { 0 }
    
    $status = if ($diffPct -lt 0.1) { "✅" } else { "❌" }
    
    Write-Host "$status $metrica"
    Write-Host "   Legacy: $legacyVal"
    Write-Host "   Granular: $granularVal"
    Write-Host "   Diferença: $diff ($([Math]::Round($diffPct, 4))%)`n"
}
```

### Executar Comparação

```powershell
.\comparar-metricas.ps1
```

### Resultado Esperado

```
🔍 Comparando métricas críticas:

✅ technicalData.lufsIntegrated
   Legacy: -13.2
   Granular: -13.2
   Diferença: 0 (0%)

✅ technicalData.truePeakDbtp
   Legacy: -1.0
   Granular: -1.0
   Diferença: 0 (0%)

✅ technicalData.dynamicRange
   Legacy: 11.8
   Granular: 11.8
   Diferença: 0 (0%)

✅ technicalData.lra
   Legacy: 6.5
   Granular: 6.5
   Diferença: 0 (0%)

✅ technicalData.stereoCorrelation
   Legacy: 0.88
   Granular: 0.88
   Diferença: 0 (0%)
```

### ✅ Critérios de Sucesso

- [ ] Todas as métricas críticas **idênticas** (diferença < 0.1%)
- [ ] LUFS integrado: Δ < 0.01 LUFS
- [ ] True Peak: Δ < 0.01 dBTP
- [ ] Dynamic Range: Δ < 0.1 dB
- [ ] LRA: Δ < 0.1 LU
- [ ] Stereo Correlation: Δ < 0.001

---

## 🧪 Teste 5: Rollback

### Objetivo
Garantir que o rollback para legacy funciona instantaneamente.

### Comandos

```bash
# 1. Iniciar com granular_v1
ANALYZER_ENGINE=granular_v1
node work/index.js &
WORKER_PID=$!

# 2. Processar 1 audio
# (upload via frontend)

# 3. Fazer rollback (editar .env)
ANALYZER_ENGINE=legacy

# 4. Reiniciar worker
kill $WORKER_PID
node work/index.js &

# 5. Processar MESMO audio novamente
# (upload via frontend)
```

### Resultado Esperado

```
# Antes do rollback
🚀 [SPECTRAL_BANDS] Engine granular_v1 ativado

# Depois do rollback
🔄 [SPECTRAL_BANDS] Engine legacy ativado
```

### ✅ Critérios de Sucesso

- [ ] Rollback completo em < 1 minuto
- [ ] Nenhum erro ou crash
- [ ] Worker volta ao modo legacy
- [ ] Payload volta ao formato original
- [ ] Sistema 100% funcional após rollback

---

## 🧪 Teste 6: Performance

### Objetivo
Medir impacto de performance do engine granular_v1.

### Comandos

```bash
# 1. Benchmark Legacy
ANALYZER_ENGINE=legacy
time node work/index.js

# 2. Benchmark Granular
ANALYZER_ENGINE=granular_v1
time node work/index.js
```

### Resultado Esperado

```
# Legacy
Real time: 8.234s
User time: 6.123s
Sys time: 0.456s

# Granular V1
Real time: 9.468s (+ 15%)
User time: 7.041s (+ 15%)
Sys time: 0.512s (+ 12%)
```

### ✅ Critérios de Sucesso

- [ ] Latência adicional ≤ 15%
- [ ] Memória ≤ +10%
- [ ] Nenhum timeout ou crash
- [ ] CPU usage aceitável

---

## 🧪 Teste 7: Compatibilidade Frontend

### Objetivo
Garantir que o frontend renderiza corretamente ambos os payloads.

### Procedimento Manual

1. **Legacy**:
   - Configurar `ANALYZER_ENGINE=legacy`
   - Upload de audio
   - Verificar se bandas principais são exibidas
   - Verificar score e classificação

2. **Granular V1**:
   - Configurar `ANALYZER_ENGINE=granular_v1`
   - Upload do MESMO audio
   - Verificar se bandas principais são exibidas (mesmo visual)
   - Verificar se campos extras não quebram renderização

### ✅ Critérios de Sucesso

- [ ] Frontend renderiza ambos sem erros
- [ ] Bandas principais visíveis em ambos
- [ ] Score e classificação corretos em ambos
- [ ] Nenhum erro no console do navegador
- [ ] Layout não quebra com payload granular

---

## 📊 Resumo de Validação

### Checklist Final

| Teste | Status | Observações |
|-------|--------|-------------|
| 1. Módulo Isolado | ⏳ | Executar `node work/tests/spectral-bands-granular.test.js` |
| 2. Legacy (Regressão) | ⏳ | Comparar com baseline anterior |
| 3. Granular V1 | ⏳ | Validar estrutura do payload |
| 4. Comparação Legacy vs Granular | ⏳ | LUFS/TP/DR devem ser idênticos |
| 5. Rollback | ⏳ | Testar transição granular → legacy |
| 6. Performance | ⏳ | Latência ≤ +15% |
| 7. Compatibilidade Frontend | ⏳ | Renderização sem erros |

---

## 🚨 Troubleshooting

### Erro: "Cannot find module spectral-bands-granular.js"

```bash
# Verificar se o arquivo existe
ls work/lib/audio/features/spectral-bands-granular.js

# Se não existir, o arquivo não foi criado corretamente
```

### Erro: "ANALYZER_ENGINE is not defined"

```bash
# Verificar .env
cat .env | grep ANALYZER_ENGINE

# Se não existir, adicionar:
echo "ANALYZER_ENGINE=legacy" >> .env
```

### Erro: "granular is not iterable"

- Verificar estrutura do payload
- Garantir que `granular` é um array
- Checar logs de `[GRANULAR_V1]` para erros

### Worker crasha ao processar

- Verificar memória disponível
- Checar logs para exceções
- Fazer rollback imediato para `legacy`

---

## 📞 Suporte

Se todos os testes falharem:

1. **Rollback imediato**: `ANALYZER_ENGINE=legacy`
2. **Revisar logs** em busca de erros
3. **Consultar documentação**: `GRANULAR_V1_README.md`
4. **Executar checklist**: `IMPLEMENTATION_CHECKLIST.md`

---

**✅ Boa sorte nos testes!**
