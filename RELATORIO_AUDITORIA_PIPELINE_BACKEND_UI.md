# 🔍 RELATÓRIO DE AUDITORIA COMPLETA - PIPELINE BACKEND → UI

**Data:** 11 de setembro de 2025  
**Objetivo:** Identificar causa raiz dos campos vazios no modal e erro `[STATUS_UNIFIED] Valor inválido: null`  

---

## 📊 SUMÁRIO EXECUTIVO

**Status:** ⚠️ **PROBLEMAS CRÍTICOS IDENTIFICADOS**

### Problemas Principais:
1. **Divergência de Contrato:** Backend usa `snake_case`, UI espera `camelCase`
2. **Mapeamento Incompleto:** Função `normalizeBackendAnalysisData` não mapeia todos os campos
3. **Referência Comparação:** Campos `null` chegam em `calcularStatusSugestaoUnificado`
4. **Race Condition:** UI renderiza antes do mapeamento completo

### Impacto:
- ❌ "Métricas Principais" vazias
- ❌ "Scores & Diagnóstico" vazio  
- ❌ Erro `[STATUS_UNIFIED] Valor inválido: null`
- ❌ Tabela comparação só mostra alvos

---

## 🗺️ FLUXO MAPEADO (Real)

```
Upload → API cria job → Worker processa → Pipeline completo → 
Persistence DB → Polling endpoint → Normalização → Renderização UI
                                        ↑
                               **BREAK POINT CRÍTICO**
```

### Detalhamento:
1. **Upload** → `/api/upload-audio` → S3 Backblaze ✅
2. **Job Creation** → `/api/audio/analyze` → Postgres `jobs` table ✅  
3. **Worker** → `worker-root.js` → Pipeline `api/audio/pipeline-complete.js` ✅
4. **Pipeline** → Fases 5.1-5.4 → JSON estruturado ✅
5. **Persistence** → Campo `result` (JSONB) no Postgres ✅
6. **Polling** → `/api/jobs/[id]` → Retorna `result` direto ⚠️
7. **Normalização** → `normalizeBackendAnalysisData()` → **MAPEAMENTO INCOMPLETO** ❌
8. **Renderização** → `displayModalResults()` → Campos vazios ❌

---

## 🔑 CONTRATO ATUAL vs ESPERADO

### Backend Output (Real - Payload Job 164f0709-e8bf-432f-8a23-c2f6616ebad3):
```json
{
  "technicalData": {
    "peak_db": -14.6,           // Backend: snake_case
    "rms_level": -26.4,         // Backend: snake_case
    "lufs_integrated": -16.6,   // Backend: snake_case
    "true_peak": -1.83,         // Backend: snake_case ≠ truePeakDbtp
    "dynamic_range": 7.9,       // Backend: snake_case
    "crest_factor": 11.8,       // Backend: snake_case
    "stereo_correlation": 0.78, // Backend: snake_case
    "stereo_width": 0.61,       // Backend: snake_case
    "spectral_centroid": 2409,  // Backend: snake_case
    "tonalBalance": { ... },    // ✅ Já está certo
    "spectral_balance": { ... } // ✅ Já está certo
  }
}
```

### UI Expectation (normalizeBackendAnalysisData):
```json
{
  "technicalData": {
    "peak": -14.6,              // UI espera: camelCase sem sufixo
    "rms": -26.4,               // UI espera: camelCase sem sufixo
    "lufsIntegrated": -16.6,    // UI espera: camelCase
    "truePeakDbtp": -1.83,      // UI espera: nome específico
    "dynamicRange": 7.9,        // UI espera: camelCase
    "crestFactor": 11.8,        // UI espera: camelCase
    "stereoCorrelation": 0.78,  // UI espera: camelCase
    "stereoWidth": 0.61,        // UI espera: camelCase
    "spectralCentroid": 2409    // UI espera: camelCase
  }
}
```

---

## 📋 TABELA DE MAPEAMENTOS DIVERGENTES

| Campo Backend | UI Esperado | Status | Impacto |
|:-------------|:------------|:-------|:---------|
| `peak_db` | `peak` | ❌ **DIVERGE** | Métricas Principais vazias |
| `rms_level` | `rms` / `rmsLevel` | ❌ **DIVERGE** | Métricas Principais vazias |
| `lufs_integrated` | `lufsIntegrated` | ⚠️ **MAPEADO** | OK |
| `true_peak` | `truePeakDbtp` | ❌ **DIVERGE** | True Peak vazio |
| `dynamic_range` | `dynamicRange` | ❌ **DIVERGE** | DR vazio |
| `crest_factor` | `crestFactor` | ❌ **DIVERGE** | Crest Factor vazio |
| `stereo_correlation` | `stereoCorrelation` | ❌ **DIVERGE** | Correlação Estéreo vazia |
| `stereo_width` | `stereoWidth` | ❌ **DIVERGE** | Largura Estéreo vazia |
| `spectral_centroid` | `spectralCentroid` | ❌ **DIVERGE** | Centroide vazio |

### Campos Ausentes no Backend:
| Campo UI | Backend | Status |
|:---------|:--------|:-------|
| `score` | `qualityOverall` | ⚠️ **ALIAS NECESSÁRIO** |
| `classification` | `classification` | ✅ **OK** |
| `problems` | `problems` | ✅ **OK** |
| `suggestions` | `suggestions` | ✅ **OK** |

---

## ⚠️ CAUSA RAIZ IDENTIFICADA

### 1. Erro `[STATUS_UNIFIED] Valor inválido: null`

**Localização:** `status-suggestion-unified-v1.js:31`

**Causa:** Função `calcularStatusSugestaoUnificado` recebe `null` quando:
```javascript
pushRow('LUFS Integrado', tech.lufsIntegrated, ref.lufs_target, ref.tol_lufs, ' LUFS');
//                        ↑ undefined        ↑ valor válido
```

**Sequência do Erro:**
1. Backend envia `lufs_integrated: -16.6`
2. Normalização busca `tech.lufsIntegrated` → **undefined**
3. `renderReferenceComparisons()` passa `undefined` como `val`
4. `calcularStatusSugestaoUnificado(undefined, -14, 0.2)` → guarda `null` 
5. Console: `[STATUS_UNIFIED] Valor inválido: null`

### 2. Campos Vazios nas "Métricas Principais"

**Causa:** `displayModalResults()` usa `getMetric()` que busca campos inexistentes:
```javascript
const getLufsIntegratedValue = () => {
    return getMetric('lufs_integrated', 'lufsIntegrated');
    //     Backend: ✅ lufs_integrated existe
    //     UI tech: ❌ lufsIntegrated NÃO existe (não foi mapeado)
};
```

### 3. "Scores & Diagnóstico" Vazio

**Causa:** Campos `score` e classificação não mapeados corretamente:
```javascript
// Backend retorna:
{ "qualityOverall": 10, "classification": "Excepcional" }

// UI busca:
analysis.score → undefined (deveria ser analysis.qualityOverall)
```

---

## 🛠️ PLANO DE CORREÇÃO SEGURO

### Fase 1: Correção do Mapeamento (CRÍTICA)
**Prioridade:** ALTA | **Risco:** BAIXO | **Tempo:** 2h

#### 1.1 Corrigir `normalizeBackendAnalysisData` 
**Arquivo:** `public/audio-analyzer-integration.js:5544`

```javascript
// 🔧 CORREÇÃO: Mapear TODOS os campos snake_case → camelCase
if (source.peak_db !== undefined) tech.peak = source.peak_db;
if (source.rms_level !== undefined) {
    tech.rms = source.rms_level;
    tech.rmsLevel = source.rms_level; // Alias para compatibilidade
}
if (source.true_peak !== undefined) tech.truePeakDbtp = source.true_peak;
if (source.dynamic_range !== undefined) tech.dynamicRange = source.dynamic_range;
if (source.crest_factor !== undefined) tech.crestFactor = source.crest_factor;
if (source.stereo_correlation !== undefined) tech.stereoCorrelation = source.stereo_correlation;
if (source.stereo_width !== undefined) tech.stereoWidth = source.stereo_width;
if (source.spectral_centroid !== undefined) tech.spectralCentroid = source.spectral_centroid;
```

#### 1.2 Mapear Score e Classificação
```javascript
// 🔧 CORREÇÃO: Mapear score principal
if (backendData.qualityOverall !== undefined) {
    normalized.score = backendData.qualityOverall;
    normalized.qualityOverall = backendData.qualityOverall; // Manter original
}
if (backendData.classification !== undefined) {
    normalized.classification = backendData.classification;
}
```

### Fase 2: Proteção Contra Null (CRÍTICA)
**Prioridade:** ALTA | **Risco:** BAIXO | **Tempo:** 1h

#### 2.1 Tornar `calcularStatusSugestaoUnificado` Seguro
**Arquivo:** `public/status-suggestion-unified-v1.js:28`

```javascript
function calcularStatusSugestaoUnificado(valor, alvo, tolerancia, unidade = '', metrica = '', opcoes = {}) {
    // 🛡️ GUARD: Log detalhado para debug
    if (!Number.isFinite(valor)) {
        console.warn(`[STATUS_UNIFIED] Valor inválido: ${valor} para métrica '${metrica}' - SKIP`);
        return { 
            status: 'sem_dados', 
            cor: 'na', 
            sugestao: `Métrica '${metrica}' não disponível`, 
            dif: NaN,
            erro: `Valor não disponível: ${valor}`
        };
    }
    // ... resto da função permanece igual
}
```

#### 2.2 Tornar `renderReferenceComparisons` Seguro
**Arquivo:** `public/audio-analyzer-integration.js:4850`

```javascript
const pushRow = (label, val, target, tol, unit='') => {
    // 🛡️ GUARD: Skip métricas indisponíveis
    if (!Number.isFinite(val)) {
        console.warn(`[REF_COMPARE] Métrica '${label}' não disponível (val=${val}) - SKIP`);
        return; // Não adicionar linha na tabela
    }
    // ... resto da função permanece igual
};
```

### Fase 3: Telemetria e Debug (OPCIONAL)
**Prioridade:** MÉDIA | **Risco:** ZERO | **Tempo:** 30min

#### 3.1 Adicionar Telemetria
```javascript
// Em displayModalResults(), após normalização:
console.log('🔍 [AUDIT_METRICS] Métricas mapeadas:');
console.log('🔍 [AUDIT_METRICS] peak:', analysis.technicalData?.peak);
console.log('🔍 [AUDIT_METRICS] lufsIntegrated:', analysis.technicalData?.lufsIntegrated);
console.log('🔍 [AUDIT_METRICS] truePeakDbtp:', analysis.technicalData?.truePeakDbtp);
console.log('🔍 [AUDIT_METRICS] score:', analysis.score);
console.log('🔍 [AUDIT_METRICS] classification:', analysis.classification);

// Telemetria de completude
const requiredFields = ['peak', 'rms', 'lufsIntegrated', 'truePeakDbtp', 'dynamicRange'];
const missingFields = requiredFields.filter(f => !Number.isFinite(analysis.technicalData?.[f]));
console.log('🔍 [AUDIT_COMPLETENESS] Missing fields:', missingFields);
window.__DEBUG_ANALYSIS = { analysis, missingFields, hasAllMainMetrics: missingFields.length === 0 };
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Teste Manual:
1. **Upload áudio comum** (MP3/WAV)
2. **Verificar console:**
   ```
   ✅ [NORMALIZE] Métricas principais mapeadas: { peak: -14.6, rms: -26.4, ... }
   ✅ [AUDIT_COMPLETENESS] Missing fields: []
   ```
3. **Modal deve mostrar:**
   - ✅ "Métricas Principais" TODAS preenchidas
   - ✅ "Scores & Diagnóstico" com valor e classificação
   - ✅ "Comparação de Referência" com "Valor" preenchido
   - ✅ Sem erro `[STATUS_UNIFIED]` no console

### Testes A/B:
1. **Before:** Campos vazios, erro null
2. **After:** Todos campos preenchidos, sem erros

---

## 🚨 IMPLEMENTAÇÃO URGENTE

### Arquivos a Modificar:
1. `public/audio-analyzer-integration.js` → **normalizeBackendAnalysisData** (Linha 5544)
2. `public/status-suggestion-unified-v1.js` → **calcularStatusSugestaoUnificado** (Linha 28)

### Tempo Estimado: **3 horas**
### Risco: **BAIXO** (apenas mapeamento e guards)

### Backward Compatibility: ✅ **PRESERVADA**
- Mantém aliases para campos antigos
- Não quebra funcionamento existente
- Apenas adiciona mapeamentos faltantes

---

## 💡 MELHORIAS FUTURAS (NÃO URGENTES)

1. **Contrato Unificado:** Padronizar backend para camelCase
2. **Validação Schema:** JSON Schema para validar payload
3. **TypeScript:** Tipos para prevenir erros de contrato
4. **Cache Inteligente:** Cache baseado em hash do arquivo
5. **Testes E2E:** Testes automatizados do fluxo completo

---

**Próximos Passos:** Implementar correções das Fases 1 e 2 imediatamente para resolver campos vazios e erro null.
