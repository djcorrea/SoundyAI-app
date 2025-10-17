# 🔧 CORREÇÃO DO ROTEADOR GRANULAR_V1

**Data:** 17 de outubro de 2025  
**Arquivo:** `work/api/audio/core-metrics.js`  
**Objetivo:** Garantir que o engine `granular_v1` seja corretamente ativado e execute a análise espectral por sub-bandas

---

## 🎯 PROBLEMA IDENTIFICADO

O roteador do engine espectral estava configurado corretamente, mas precisava de melhorias nos logs e validações para facilitar o debug e garantir a ativação do `granular_v1`.

---

## ✅ CORREÇÕES APLICADAS

### 1. **Melhorias no Roteador `calculateSpectralBandsMetrics`**

**Antes:**
```javascript
const engine = process.env.ANALYZER_ENGINE || 'legacy';

console.log('🔍 [SPECTRAL_BANDS] Roteador de engine:', {
  engine,
  hasReference: !!reference,
  referenceGenre: reference?.genre || 'N/A',
  willUseGranular: engine === 'granular_v1' && !!reference
});

if (engine === 'granular_v1' && reference) {
  console.log('✅ [SPECTRAL_BANDS] Engine granular_v1 ativado');
  // ...
  return await this.calculateGranularSubBands(framesFFT, reference, { jobId });
}
```

**Depois:**
```javascript
const engine = process.env.ANALYZER_ENGINE || 'legacy';

console.log('🔍 [SPECTRAL_BANDS] Roteador de engine:', {
  engine,
  envValue: process.env.ANALYZER_ENGINE,  // 🆕 Mostra valor exato da env
  hasReference: !!reference,
  referenceGenre: reference?.genre || 'N/A',
  willUseGranular: engine === 'granular_v1' && !!reference
});

// ✅ VALIDAÇÃO EXPLÍCITA: Verificar se granular_v1 pode ser ativado
if (engine === 'granular_v1') {
  if (!reference) {
    console.warn('⚠️ [SPECTRAL_BANDS] Engine granular_v1 configurado mas reference ausente. Usando legacy.');
    logAudio('spectral_bands', 'granular_requires_reference', { jobId });
    return await this.calculateSpectralBandsLegacy(framesFFT, { jobId });
  }
  
  console.log('✅ [SPECTRAL_BANDS] Engine granular_v1 ativado');
  logAudio('spectral_bands', 'routing_to_granular_v1', { 
    jobId, 
    referenceGenre: reference.genre || 'unknown' 
  });
  
  const result = await this.calculateGranularSubBands(framesFFT, reference, { jobId });
  
  console.log('🌈 [GRANULAR_V1] Análise concluída:', {
    subBandsCount: result?.granular?.length || 0,
    hasBands: !!result?.bands,
    hasSuggestions: !!result?.suggestions
  });
  
  return result;
}
```

**Melhorias:**
- 🆕 Log do valor exato de `process.env.ANALYZER_ENGINE`
- 🆕 Validação explícita se `reference` está ausente quando `granular_v1` está ativo
- 🆕 Warning claro quando reference está ausente
- 🆕 Log de confirmação após análise concluída com contagem de sub-bandas

---

### 2. **Melhorias na Função `calculateGranularSubBands`**

**Antes:**
```javascript
console.log('🌈 [GRANULAR_V1] Iniciando análise granular:', {
  jobId,
  referenceGenre: reference.genre || 'unknown',
  frameCount: framesFFT?.frames?.length || 0
});

const granularResult = await analyzeGranularSpectralBands(framesFFT, reference);

console.log('✅ [GRANULAR_V1] Análise concluída:', {
  subBandsCount: granularResult.granular?.length || 0,
  suggestionsCount: granularResult.suggestions?.length || 0,
  algorithm: granularResult.algorithm,
  hasBands: !!granularResult.bands
});
```

**Depois:**
```javascript
console.log('🌈 [GRANULAR_V1] Iniciando análise granular:', {
  jobId,
  referenceGenre: reference?.genre || 'unknown',
  frameCount: framesFFT?.frames?.length || 0,
  hasReference: !!reference,               // 🆕 Verificação explícita
  referenceKeys: reference ? Object.keys(reference) : []  // 🆕 Debug structure
});

// 🎯 CHAMADA CRÍTICA: Passar reference para analyzeGranularSpectralBands
const granularResult = await analyzeGranularSpectralBands(framesFFT, reference);

console.log('✅ [GRANULAR_V1] Análise concluída:', {
  jobId,                                    // 🆕 Incluir jobId no log
  subBandsCount: granularResult?.granular?.length || 0,
  suggestionsCount: granularResult?.suggestions?.length || 0,
  algorithm: granularResult?.algorithm || 'N/A',
  hasBands: !!granularResult?.bands,
  hasGranular: !!granularResult?.granular, // 🆕 Verificar campo granular
  engineVersion: granularResult?.engineVersion || 'N/A'  // 🆕 Versão do engine
});
```

**Melhorias:**
- 🆕 Safe navigation operator (`?.`) em todos os acessos à `reference`
- 🆕 Log da estrutura completa da `reference` (keys)
- 🆕 Verificação explícita da existência de `granular` no resultado
- 🆕 Log da versão do engine no resultado
- 🆕 Logs de erro mais detalhados com stack trace

---

## 🧪 COMO TESTAR

### 1. **Verificar Ambiente**
```bash
# Verificar se ANALYZER_ENGINE está no .env
cat .env | grep ANALYZER_ENGINE

# Deve retornar:
# ANALYZER_ENGINE=granular_v1
```

### 2. **Reiniciar Worker**
```bash
pm2 restart workers
pm2 logs workers --lines 50
```

### 3. **Fazer Upload de Áudio**
- Acessar frontend
- Fazer upload de um áudio
- Monitorar logs do worker em tempo real

### 4. **Logs Esperados**

**✅ Sucesso - Granular V1 Ativado:**
```log
🔍 [SPECTRAL_BANDS] Roteador de engine: {
  engine: 'granular_v1',
  envValue: 'granular_v1',
  hasReference: true,
  referenceGenre: 'techno',
  willUseGranular: true
}
✅ [SPECTRAL_BANDS] Engine granular_v1 ativado
🌈 [GRANULAR_V1] Iniciando análise granular: {
  jobId: 'abc123...',
  referenceGenre: 'techno',
  frameCount: 150,
  hasReference: true,
  referenceKeys: ['genre', 'bands', ...]
}
✅ [GRANULAR_V1] Análise concluída: {
  jobId: 'abc123...',
  subBandsCount: 13,
  suggestionsCount: 5,
  algorithm: 'granular_v1',
  hasBands: true,
  hasGranular: true,
  engineVersion: 'granular_v1'
}
🌈 [GRANULAR_V1] Análise concluída: {
  subBandsCount: 13,
  hasBands: true,
  hasSuggestions: true
}
```

**⚠️ Warning - Reference Ausente:**
```log
🔍 [SPECTRAL_BANDS] Roteador de engine: {
  engine: 'granular_v1',
  envValue: 'granular_v1',
  hasReference: false,
  referenceGenre: 'N/A',
  willUseGranular: false
}
⚠️ [SPECTRAL_BANDS] Engine granular_v1 configurado mas reference ausente. Usando legacy.
📌 [SPECTRAL_BANDS] Engine legacy ativado (engine: legacy)
```

**📌 Legacy Mode:**
```log
🔍 [SPECTRAL_BANDS] Roteador de engine: {
  engine: 'legacy',
  envValue: undefined,
  hasReference: true,
  referenceGenre: 'techno',
  willUseGranular: false
}
📌 [SPECTRAL_BANDS] Engine legacy ativado (engine: legacy)
```

---

### 3. **Melhorias no `json-output.js`**

**Antes:**
```javascript
// 🌈 GRANULAR V1: Campos aditivos (apenas se granular_v1 ativo)
...(coreMetrics.spectralBands?.algorithm === 'granular_v1' && {
  engineVersion: coreMetrics.spectralBands.algorithm,
  granular: coreMetrics.spectralBands.granular || [],
  suggestions: FORCE_TYPE_FIELD(coreMetrics.spectralBands.suggestions || []),
  granularMetadata: coreMetrics.spectralBands.metadata || null
}),
```

**Depois:**
```javascript
// 🌈 GRANULAR V1: Campos aditivos (apenas se granular_v1 ativo)
...(coreMetrics.spectralBands?.algorithm === 'granular_v1' && (() => {
  console.log('🌈 [JSON_OUTPUT] Incluindo campos granular_v1:', {
    algorithm: coreMetrics.spectralBands.algorithm,
    granularCount: coreMetrics.spectralBands.granular?.length || 0,
    suggestionsCount: coreMetrics.spectralBands.suggestions?.length || 0,
    hasMetadata: !!coreMetrics.spectralBands.metadata
  });
  
  return {
    engineVersion: coreMetrics.spectralBands.algorithm,
    granular: coreMetrics.spectralBands.granular || [],
    suggestions: FORCE_TYPE_FIELD(coreMetrics.spectralBands.suggestions || []),
    granularMetadata: coreMetrics.spectralBands.metadata || null
  };
})()),
```

**Melhorias:**
- 🆕 Log de confirmação quando campos granular são incluídos no JSON
- 🆕 Contagem de sub-bandas e sugestões no log
- 🆕 Verificação de metadados granulares
- ✅ Mantém compatibilidade com estrutura existente

---

## 🎯 ESTRUTURA DO JSON FINAL

Com `granular_v1` ativo, o JSON deve conter:

```json
{
  "spectralBands": {
    "engineVersion": "granular_v1",
    "algorithm": "granular_v1",
    "bands": {
      "sub": { "energy": 0.12, "avgMagnitude": 450 },
      "bass": { "energy": 0.25, "avgMagnitude": 1200 },
      "lowMid": { "energy": 0.18, "avgMagnitude": 890 },
      "mid": { "energy": 0.15, "avgMagnitude": 750 },
      "highMid": { "energy": 0.14, "avgMagnitude": 680 },
      "presence": { "energy": 0.10, "avgMagnitude": 520 },
      "brilliance": { "energy": 0.06, "avgMagnitude": 340 }
    },
    "granular": [
      { "range": "20-60 Hz", "energy": 0.08, "sigma": 0.02, "status": "ok" },
      { "range": "60-100 Hz", "energy": 0.15, "sigma": 0.03, "status": "warning" },
      // ... 13 sub-bandas no total
    ],
    "suggestions": [
      {
        "frequency": "60-100 Hz",
        "issue": "Energia acima da tolerância",
        "severity": "warning",
        "recommendation": "Reduzir em -2dB"
      }
    ]
  }
}
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Implementação (Backend)
- [x] Import de `analyzeGranularSpectralBands` presente no topo do arquivo
- [x] Função `calculateSpectralBandsMetrics` com roteador correto
- [x] Verificação de `process.env.ANALYZER_ENGINE`
- [x] Validação explícita de `reference` quando `granular_v1` ativo
- [x] Função `calculateGranularSubBands` implementada
- [x] Logs detalhados de debug em todos os pontos críticos
- [x] Fallback para legacy em caso de erro
- [x] Safe navigation operators (`?.`) para evitar crashes
- [x] `json-output.js` preparado para incluir campos granular
- [x] Log de confirmação em `json-output.js` quando granular é incluído

### Testes (Validação)
- [ ] Worker reiniciado após alterações
- [ ] Teste com upload de áudio real
- [ ] JSON final contém campo `granular`
- [ ] JSON final contém campo `engineVersion`
- [ ] JSON final contém campo `suggestions`
- [ ] Frontend continua mostrando 7 bandas legacy
- [ ] Sub-bandas aparecem no objeto `granular` do JSON

---

## 🚀 PRÓXIMOS PASSOS

1. **Reiniciar worker:** `pm2 restart workers`
2. **Monitorar logs:** `pm2 logs workers --lines 100`
3. **Fazer upload de teste**
4. **Verificar JSON de resposta** contém:
   - `spectralBands.engineVersion: "granular_v1"`
   - `spectralBands.granular: [...]` com 13 sub-bandas
   - `spectralBands.suggestions: [...]` com sugestões frequenciais

---

## 📝 OBSERVAÇÕES

- ✅ O roteador agora valida explicitamente a presença de `reference` antes de ativar `granular_v1`
- ✅ Logs detalhados facilitam debug e identificação de problemas
- ✅ Safe navigation operators previnem crashes por dados ausentes
- ✅ Fallback para legacy garante robustez mesmo em caso de erros
- ✅ Estrutura do JSON preserva compatibilidade com frontend (7 bandas legacy)
- ✅ Sub-bandas granulares ficam em campo separado (`granular`)

---

**Status:** ✅ Implementação concluída e pronta para testes
