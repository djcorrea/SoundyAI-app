# 🧪 Guia de Teste - Granular V1

## ⚡ TESTE RÁPIDO (5 minutos)

### 1. Verificar instalação dos arquivos
```powershell
# Verificar se arquivos foram criados
Test-Path "work\lib\audio\features\spectral-bands-granular.js"
Test-Path "references\techno.v1.json"
Test-Path ".env.example"

# Verificar modificações
Select-String -Path "work\api\audio\core-metrics.js" -Pattern "analyzeGranularSpectralBands"
Select-String -Path "work\api\audio\json-output.js" -Pattern "engineVersion"
```

### 2. Testar modo LEGACY (comportamento original)
```powershell
# 1. Criar/editar .env
$envContent = @"
ANALYZER_ENGINE=legacy
"@
Set-Content -Path ".env" -Value $envContent

# 2. Reiniciar servidor/worker (se estiver rodando)
# Ctrl+C no terminal e rodar novamente

# 3. Fazer upload de uma música

# 4. Verificar resultado no console:
# ✅ Deve aparecer: "routing_to_legacy"
# ✅ NÃO deve ter campos: engineVersion, granular, suggestions
```

**Resultado esperado** (payload JSON):
```json
{
  "score": 74,
  "classification": "Bom",
  "spectralBands": {
    "sub": { "energy_db": -28.3, "percentage": 15.2, "range": "20-60Hz" },
    "bass": { "energy_db": -29.1, "percentage": 22.5, "range": "60-150Hz" },
    "lowMid": { "energy_db": -31.4, "percentage": 18.7, "range": "150-500Hz" },
    "mid": { "energy_db": -30.8, "percentage": 16.3, "range": "500-2000Hz" },
    "highMid": { "energy_db": -34.2, "percentage": 12.8, "range": "2000-5000Hz" },
    "presence": { "energy_db": -40.1, "percentage": 9.2, "range": "5000-10000Hz" },
    "air": { "energy_db": -42.5, "percentage": 5.3, "range": "10000-20000Hz" }
  }
}
```

---

### 3. Testar modo GRANULAR_V1 (sem referência)
```powershell
# 1. Editar .env
$envContent = @"
ANALYZER_ENGINE=granular_v1
"@
Set-Content -Path ".env" -Value $envContent

# 2. Reiniciar servidor/worker

# 3. Fazer upload de uma música

# 4. Verificar resultado no console:
# ✅ Deve aparecer: "routing_to_legacy" (fallback automático)
# ✅ NÃO deve ter campos: engineVersion, granular, suggestions
```

**Motivo do fallback**: Sem arquivo de referência carregado, o sistema volta para legacy automaticamente.

---

### 4. Testar modo GRANULAR_V1 (com referência) - ⚠️ REQUER INTEGRAÇÃO WORKER

**IMPORTANTE**: Este teste requer modificar `work/index.js` para carregar a referência.  
Por enquanto, o sistema está preparado mas precisa dessa integração final.

#### Modificação necessária em `work/index.js`:
```javascript
// Adicionar no início do processamento do job
async function processJob(job) {
  // ... código existente ...
  
  // 🆕 GRANULAR V1: Carregar referência se engine ativo
  let reference = null;
  if (process.env.ANALYZER_ENGINE === 'granular_v1' && job.genre) {
    const referencePath = path.join(__dirname, '..', 'references', `${job.genre}.v1.json`);
    try {
      const referenceData = await fs.promises.readFile(referencePath, 'utf-8');
      reference = JSON.parse(referenceData);
      console.log(`✅ [GRANULAR] Referência carregada: ${job.genre}`);
    } catch (err) {
      console.warn(`⚠️ [GRANULAR] Referência ${job.genre} não encontrada, usando legacy`);
    }
  }
  
  // Passar reference para o pipeline
  const result = await pipelineComplete.processAudioComplete(buffer, filename, {
    jobId: job.id,
    reference: reference // 🆕 Adicionar aqui
  });
  
  // ... resto do código ...
}
```

Após essa modificação:
```powershell
# 1. Criar job com genre=techno no banco
# 2. Fazer upload
# 3. Verificar logs:
# ✅ "Referência carregada: techno"
# ✅ "routing_to_granular_v1"
# ✅ "granular_bands completed"
```

**Resultado esperado** (payload JSON):
```json
{
  "score": 74,
  "classification": "Bom",
  "spectralBands": {
    "sub": { "energy_db": -28.3, "percentage": 15.2, "range": "20-60Hz" },
    "bass": { "energy_db": -29.1, "percentage": 22.5, "range": "60-150Hz" },
    "lowMid": { "energy_db": -31.4, "percentage": 18.7, "range": "150-500Hz" },
    "mid": { "energy_db": -30.8, "percentage": 16.3, "range": "500-2000Hz" },
    "highMid": { "energy_db": -34.2, "percentage": 12.8, "range": "2000-5000Hz" },
    "presence": { "energy_db": -40.1, "percentage": 9.2, "range": "5000-10000Hz" },
    "air": { "energy_db": -42.5, "percentage": 5.3, "range": "10000-20000Hz" }
  },
  "engineVersion": "granular_v1",
  "granular": [
    { "id": "sub_low", "range": [20, 40], "energyDb": -28.3, "deviation": -0.3, "status": "ideal" },
    { "id": "sub_high", "range": [40, 60], "energyDb": -32.1, "deviation": -3.1, "status": "adjust" },
    // ... mais 11 sub-bandas
  ],
  "suggestions": [
    {
      "freq_range": [40, 60],
      "type": "boost",
      "amount": 3.1,
      "message": "Falta energia em 40–60 Hz — reforçar ~3.1 dB (harmônicos kick).",
      "priority": "medium"
    },
    // ... mais sugestões
  ],
  "granularMetadata": {
    "genre": "techno",
    "stepHz": 20,
    "framesProcessed": 1028
  }
}
```

---

## 🔍 VERIFICAÇÃO DE COMPATIBILIDADE FRONTEND

### Checklist de campos obrigatórios (ambos os engines):
```javascript
// ✅ SEMPRE presentes (legacy e granular)
spectralBands: {
  sub: { energy_db, percentage, range },
  bass: { energy_db, percentage, range },
  lowMid: { energy_db, percentage, range },
  mid: { energy_db, percentage, range },
  highMid: { energy_db, percentage, range },
  presence: { energy_db, percentage, range },
  air: { energy_db, percentage, range }
}

// ✅ Apenas granular_v1 (aditivos)
engineVersion: "granular_v1"
granular: [ ... ]
suggestions: [ ... ]
granularMetadata: { ... }
```

### Teste no console do navegador:
```javascript
// Após receber resultado da API
const result = await fetch('/api/analyze').then(r => r.json());

// Verificar estrutura básica
console.assert(result.spectralBands !== undefined, "❌ spectralBands ausente");
console.assert(result.spectralBands.sub !== undefined, "❌ banda sub ausente");
console.assert(result.spectralBands.bass !== undefined, "❌ banda bass ausente");

// Verificar granular (se engine ativo)
if (result.engineVersion === 'granular_v1') {
  console.assert(result.granular !== undefined, "❌ granular ausente");
  console.assert(Array.isArray(result.granular), "❌ granular não é array");
  console.assert(result.granular.length === 13, "❌ granular deve ter 13 sub-bandas");
  
  console.assert(result.suggestions !== undefined, "❌ suggestions ausente");
  console.assert(Array.isArray(result.suggestions), "❌ suggestions não é array");
}

console.log("✅ Payload validado com sucesso!");
```

---

## 🐛 TROUBLESHOOTING

### Problema: "routing_to_legacy" mesmo com ANALYZER_ENGINE=granular_v1
**Causa**: Referência não foi carregada/passada corretamente.

**Solução**:
1. Verificar se `references/techno.v1.json` existe
2. Verificar se `work/index.js` está carregando a referência
3. Verificar se `options.reference` chega em `calculateSpectralBandsMetrics`
4. Adicionar logs:
```javascript
console.log('[DEBUG] Engine:', process.env.ANALYZER_ENGINE);
console.log('[DEBUG] Reference:', options.reference ? 'presente' : 'ausente');
```

---

### Problema: Erro "Cannot read property 'bands' of undefined"
**Causa**: Estrutura de referência inválida.

**Solução**:
1. Validar JSON de referência:
```powershell
Get-Content "references\techno.v1.json" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```
2. Verificar campos obrigatórios:
   - `bands` (array)
   - `grouping` (objeto)
   - `severity` (objeto)

---

### Problema: Performance degradada (tempo > 2x legacy)
**Causa**: Cálculo de mediana muito lento.

**Solução temporária**:
```powershell
# Voltar para legacy
$envContent = @"
ANALYZER_ENGINE=legacy
"@
Set-Content -Path ".env" -Value $envContent
```

**Solução permanente**:
1. Otimizar `calculateMedian` usando algoritmo quickselect
2. Cache de bins FFT por sub-banda
3. Processar frames em paralelo (Worker threads)

---

### Problema: Sugestões não aparecem no frontend
**Causa**: Campo `type` ausente (erro antigo do sistema de sugestões).

**Solução**: Já corrigido automaticamente por `FORCE_TYPE_FIELD()` em `json-output.js`.

Verificar se `suggestions` tem campo `type`:
```javascript
result.suggestions.forEach(s => {
  console.assert(s.type !== undefined, "❌ type ausente:", s);
});
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Funcional
- [ ] Legacy retorna 7 bandas sem campos extras
- [ ] Granular sem reference faz fallback para legacy
- [ ] Granular com reference retorna sub-bandas
- [ ] Sugestões têm campo `type` preenchido
- [ ] engineVersion aparece apenas em granular_v1

### Performance
- [ ] Tempo de processamento < 2x legacy
- [ ] Memória não aumenta > 20%
- [ ] Sem memory leaks após 100 jobs

### Compatibilidade
- [ ] Frontend exibe 7 bandas corretamente (ambos engines)
- [ ] Payload JSON válido (ambos engines)
- [ ] LUFS/TP/DR inalterados (ambos engines)

### Rollback
- [ ] Mudar .env para legacy funciona imediatamente
- [ ] Sem erros ao remover references/*.json
- [ ] Logs indicam claramente qual engine está ativo

---

## 📊 MÉTRICAS DE SUCESSO

### Performance aceitável
- ✅ Overhead ≤ 15%
- ✅ Latência adicional ≤ 100ms
- ✅ Memória adicional ≤ 10%

### Qualidade de análise
- ✅ Sub-bandas detectam problemas isolados
- ✅ Sugestões são acionáveis (frequência + amount)
- ✅ Status (ideal/adjust/fix) coerente com desvio σ

### Experiência do desenvolvedor
- ✅ Rollback em < 1 minuto (mudar .env)
- ✅ Logs claros indicando engine ativo
- ✅ Zero quebras no pipeline legado

---

**Data**: 16 de outubro de 2025  
**Versão**: granular_v1
