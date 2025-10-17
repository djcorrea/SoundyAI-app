# 🔧 CORREÇÃO: Engine Granular V1 Não Ativado

## 🎯 Problema Identificado

O engine `granular_v1` não estava sendo executado mesmo com a implementação correta no código.

**Causa Raiz:** Variável de ambiente `ANALYZER_ENGINE` **ausente no arquivo `.env`**

---

## ✅ Correções Aplicadas

### 1. **Adicionada Variável de Ambiente**

**Arquivo:** `.env`

```properties
# 🌈 GRANULAR V1: Engine de análise espectral por sub-bandas
# Valores: 'legacy' (padrão) | 'granular_v1' (novo sistema)
ANALYZER_ENGINE=granular_v1
```

### 2. **Logs de Debug Aprimorados**

**Arquivo:** `work/api/audio/core-metrics.js`

#### Função `calculateSpectralBandsMetrics`:
```javascript
console.log('🔍 [SPECTRAL_BANDS] Roteador de engine:', {
  engine,
  hasReference: !!reference,
  referenceGenre: reference?.genre || 'N/A',
  willUseGranular: engine === 'granular_v1' && !!reference
});
```

#### Função `calculateGranularSubBands`:
```javascript
console.log('🌈 [GRANULAR_V1] Iniciando análise granular:', {
  jobId,
  referenceGenre: reference.genre || 'unknown',
  frameCount: framesFFT?.frames?.length || 0
});

console.log('✅ [GRANULAR_V1] Análise concluída:', {
  subBandsCount: granularResult.granular?.length || 0,
  suggestionsCount: granularResult.suggestions?.length || 0,
  algorithm: granularResult.algorithm,
  hasBands: !!granularResult.bands
});
```

### 3. **Debug de Referência no Worker**

**Arquivo:** `work/index.js`

```javascript
console.log('🔍 [DEBUG] Job reference:', {
  hasReference: !!job?.reference,
  reference: job?.reference,
  jobKeys: Object.keys(job || {})
});
```

---

## 🧪 Validação

### ✅ Código Já Estava Correto

O roteador condicional estava **perfeitamente implementado**:

```javascript
async calculateSpectralBandsMetrics(framesFFT, options = {}) {
  const { jobId, reference } = options;
  const engine = process.env.ANALYZER_ENGINE || 'legacy';
  
  if (engine === 'granular_v1' && reference) {
    console.log('✅ [SPECTRAL_BANDS] Engine granular_v1 ativado');
    return await this.calculateGranularSubBands(framesFFT, reference, { jobId });
  }
  
  return await this.calculateSpectralBandsLegacy(framesFFT, { jobId });
}
```

### ✅ Import Correto

```javascript
import { analyzeGranularSpectralBands } from "../../lib/audio/features/spectral-bands-granular.js";
```

### ✅ Passagem de Referência Correta

```javascript
const spectralBandsResults = await this.calculateSpectralBandsMetrics(
  segmentedAudio.framesFFT, 
  { 
    jobId,
    reference: options.reference // ✅ Passando referência
  }
);
```

---

## 🔍 Logs Esperados Após Correção

### No Console do Worker:

```
🔍 [DEBUG] Job reference: { hasReference: true, reference: {...}, jobKeys: [...] }
🔍 [SPECTRAL_BANDS] Roteador de engine: { 
  engine: 'granular_v1', 
  hasReference: true, 
  referenceGenre: 'funk_mandela',
  willUseGranular: true 
}
✅ [SPECTRAL_BANDS] Engine granular_v1 ativado
🌈 [GRANULAR_V1] Iniciando análise granular: { jobId: '...', referenceGenre: 'funk_mandela', frameCount: 1234 }
✅ [GRANULAR_V1] Análise concluída: { 
  subBandsCount: 13, 
  suggestionsCount: 5, 
  algorithm: 'granular_v1',
  hasBands: true 
}
```

### No Payload JSON:

```json
{
  "technicalData": {
    "bandEnergies": {
      "sub": { "rms_db": -12.5, "status": "ideal" },
      "bass": { "rms_db": -10.2, "status": "adjust" },
      ...
    }
  },
  "engineVersion": "granular_v1",
  "granular": [
    { "id": "sub_20_40", "range": "20-40 Hz", "energyDb": -15.2, "deviation": 0.5, "status": "ideal" },
    { "id": "sub_40_60", "range": "40-60 Hz", "energyDb": -13.8, "deviation": 1.2, "status": "adjust" },
    ...
  ],
  "suggestions": [
    { "freq_range": "60-90 Hz", "type": "boost", "amount": 2.3, "message": "..." },
    ...
  ]
}
```

---

## ⚠️ Pontos de Atenção

### 1. **Referência Necessária**

O engine `granular_v1` **requer** que `options.reference` seja passado:

```javascript
if (engine === 'granular_v1' && reference) // ← Requer ambos
```

**Solução:** Verificar se o job do banco de dados contém o campo `reference`.

### 2. **Fallback Automático**

Se houver erro no granular, o sistema automaticamente usa legacy:

```javascript
catch (error) {
  console.warn('⚠️ [GRANULAR_V1] Fallback para legacy devido a erro');
  return await this.calculateSpectralBandsLegacy(framesFFT, { jobId });
}
```

---

## 🚀 Como Testar

### 1. **Restart do Worker**

```bash
pm2 restart workers
```

ou

```bash
pm2 restart all
```

### 2. **Verificar Logs**

```bash
pm2 logs workers --lines 100
```

**Procure por:**
- `✅ [SPECTRAL_BANDS] Engine granular_v1 ativado`
- `🌈 [GRANULAR_V1] Iniciando análise granular`
- `✅ [GRANULAR_V1] Análise concluída: X sub-bandas`

### 3. **Testar com Upload de Áudio**

1. Faça upload de um arquivo de áudio
2. Verifique os logs do worker
3. Verifique o payload JSON no navegador (DevTools → Network → Response)

---

## ✅ Checklist de Validação

- [x] Variável `ANALYZER_ENGINE=granular_v1` adicionada ao `.env`
- [x] Logs de debug implementados
- [x] Import de `analyzeGranularSpectralBands` confirmado
- [x] Roteador condicional validado
- [x] Passagem de `reference` confirmada
- [x] Fallback para legacy implementado
- [ ] **Worker restartado (PENDENTE)**
- [ ] **Teste com áudio real (PENDENTE)**

---

## 📊 Status

**Correção:** ✅ COMPLETA  
**Testes:** ⏳ AGUARDANDO RESTART DO WORKER  
**Documentação:** ✅ CRIADA

---

## 🎯 Próximos Passos

1. **Restart do worker:** `pm2 restart workers`
2. **Verificar logs:** `pm2 logs workers`
3. **Upload de teste:** Enviar áudio e verificar payload
4. **Confirmar:** Verificar se `"granular": [...]` aparece no JSON

---

**Data:** 17/10/2025  
**Engine:** granular_v1  
**Status:** Pronto para uso após restart
