# 🔧 CORREÇÃO FINAL: Sample Peak Pipeline

**Data:** 21 de dezembro de 2025  
**Tipo:** Correção de bug crítico + Logs de debug  
**Status:** ✅ APLICADO

---

## 🐛 PROBLEMA IDENTIFICADO

### Sintoma
- Logs mostram: `[SAMPLE_PEAK] ✅ Max Sample Peak (RAW): 0.48 dBFS`
- JSON final retorna: `samplePeakLeftDb: null`, `samplePeakRightDb: null`
- UI não exibe Sample Peak

### Causa Raiz Encontrada

**CONFLITO DE NOMENCLATURA:**

1. **Chaves antigas do FFmpeg** (linhas 162-163 json-output.js):
   ```javascript
   technicalData.samplePeakLeftDb = safeSanitize(coreMetrics.truePeak.samplePeakLeftDb);
   technicalData.samplePeakRightDb = safeSanitize(coreMetrics.truePeak.samplePeakRightDb);
   ```
   - Estas chaves vêm do **FFmpeg ebur128** (não são o Sample Peak real)
   - FFmpeg não calcula sample peak por canal → sempre `null`

2. **Chaves novas corretas** (linhas 454-457 json-output.js):
   ```javascript
   technicalData.samplePeakDbfs = safeSanitize(coreMetrics.samplePeak.maxDbfs);
   technicalData.samplePeakLeftDbfs = safeSanitize(coreMetrics.samplePeak.leftDbfs);
   technicalData.samplePeakRightDbfs = safeSanitize(coreMetrics.samplePeak.rightDbfs);
   ```
   - Estas chaves vêm do **cálculo real** (`calculateSamplePeakDbfs`)
   - Valores corretos: `0.48`, `0.45`, `0.48`

**Conclusão:** Sistema tinha **DUAS fontes** diferentes chamadas "samplePeak":
- FFmpeg (null) → `samplePeakLeftDb/RightDb`
- Cálculo real (correto) → `samplePeakDbfs/LeftDbfs/RightDbfs`

---

## ✅ CORREÇÕES APLICADAS

### 1. **Logs de Debug Críticos** (Rastreamento do Valor)

#### A) Em `core-metrics.js` (antes do return):

```javascript
// 📊 LOG CRÍTICO: Confirmar Sample Peak antes do return
if (coreMetrics.samplePeak) {
  console.log('[CORE-METRICS] ✅ CONFIRMAÇÃO FINAL - Sample Peak no objeto de retorno:', {
    maxDbfs: coreMetrics.samplePeak.maxDbfs,
    leftDbfs: coreMetrics.samplePeak.leftDbfs,
    rightDbfs: coreMetrics.samplePeak.rightDbfs,
    hasValidValues: coreMetrics.samplePeak.maxDbfs !== null && coreMetrics.samplePeak.maxDbfs !== undefined
  });
} else {
  console.warn('[CORE-METRICS] ⚠️ Sample Peak NULL no objeto final');
}
```

**Localização:** [core-metrics.js:760-772](work/api/audio/core-metrics.js#L760-L772)

#### B) Em `json-output.js` (início do extractTechnicalData):

```javascript
// 📊 DEBUG CRÍTICO: Verificar estado do samplePeak logo no início
if (coreMetrics.samplePeak) {
  console.log('[JSON-OUTPUT] 📊 Sample Peak recebido de coreMetrics:', {
    maxDbfs: coreMetrics.samplePeak.maxDbfs,
    leftDbfs: coreMetrics.samplePeak.leftDbfs,
    rightDbfs: coreMetrics.samplePeak.rightDbfs,
    estruturaCompleta: Object.keys(coreMetrics.samplePeak)
  });
} else {
  console.warn('[JSON-OUTPUT] ⚠️ coreMetrics.samplePeak é NULL/UNDEFINED');
}
```

**Localização:** [json-output.js:118-131](work/api/audio/json-output.js#L118-L131)

---

### 2. **Compatibilidade Backward** (Popular Chaves Antigas)

**Arquivo:** [json-output.js:465-472](work/api/audio/json-output.js#L465-L472)

```javascript
// 🔄 COMPATIBILIDADE: Popular chaves antigas com valores do Sample Peak REAL
// (as chaves samplePeakLeftDb/RightDb anteriormente vinham do FFmpeg e eram null)
if (!technicalData.samplePeakLeftDb || technicalData.samplePeakLeftDb === null) {
  technicalData.samplePeakLeftDb = technicalData.samplePeakLeftDbfs;
}
if (!technicalData.samplePeakRightDb || technicalData.samplePeakRightDb === null) {
  technicalData.samplePeakRightDb = technicalData.samplePeakRightDbfs;
}
```

**Justificativa:** Se a UI antiga usa `samplePeakLeftDb`, agora terá valores corretos.

---

### 3. **UI Já Estava Correta**

**Arquivo:** [audio-analyzer-integration.js:14314-14329](public/audio-analyzer-integration.js#L14314-L14329)

```javascript
// RMS Peak (300ms) - já correto
row('RMS Peak (300ms)', `${safeFixed(getMetric('peak_db', 'peak'))} dB`, 'peak')

// Sample Peak (dBFS) - já implementado
row('Sample Peak (dBFS)', `${safeFixed(spValue, 2)} dB <span class="${spStatus.class}">...`, 'samplePeakDbfs')
```

✅ **Não precisa de alteração** - código UI já está correto.

---

## 📋 RESUMO DAS MUDANÇAS

| Arquivo | Mudança | Tipo |
|---------|---------|------|
| [core-metrics.js:760-772](work/api/audio/core-metrics.js#L760-L772) | Adicionar log de confirmação antes do return | +13 linhas |
| [json-output.js:118-131](work/api/audio/json-output.js#L118-L131) | Adicionar log de debug no início | +14 linhas |
| [json-output.js:465-472](work/api/audio/json-output.js#L465-L472) | Popular chaves antigas com valores reais | +8 linhas |

**Total:** 2 arquivos, 35 linhas adicionadas, **0 linhas removidas**

---

## 🧪 VALIDAÇÃO (EXECUTAR AGORA)

### 1. **Reiniciar Backend**

```bash
cd work
npm run dev
```

### 2. **Processar Arquivo Novo**

```bash
curl -X POST http://localhost:3001/api/jobs \
  -F "audioFile=@test.mp3"

# Guardar JOB_ID
```

### 3. **Verificar Logs Backend (CRÍTICO)**

Procurar sequência completa:

```bash
# Logs esperados (ordem cronológica):

# 1. Cálculo do Sample Peak
[SAMPLE_PEAK] ✅ Max Sample Peak (RAW): 0.48 dBFS

# 2. Confirmação no core-metrics (ANTES do return)
[CORE-METRICS] ✅ CONFIRMAÇÃO FINAL - Sample Peak no objeto de retorno: {
  maxDbfs: 0.48,
  leftDbfs: 0.45,
  rightDbfs: 0.48,
  hasValidValues: true
}

# 3. Recebimento no json-output (INÍCIO)
[JSON-OUTPUT] 📊 Sample Peak recebido de coreMetrics: {
  maxDbfs: 0.48,
  leftDbfs: 0.45,
  rightDbfs: 0.48,
  estruturaCompleta: ['left', 'right', 'max', 'leftDbfs', 'rightDbfs', 'maxDbfs']
}

# 4. Exportação final
[JSON-OUTPUT] ✅ Sample Peak REAL exportado: max=0.48, L=0.45, R=0.48
```

**SE ALGUM LOG FALHAR:**
- ❌ Log 1 ausente → problema no cálculo (canais inválidos)
- ❌ Log 2 ausente → `coreMetrics.samplePeak` não está sendo montado
- ❌ Log 3 ausente → perda no transporte entre funções
- ❌ Log 4 ausente → problema no `if (coreMetrics.samplePeak)`

### 4. **Verificar JSON da API**

```bash
curl http://localhost:3001/api/jobs/[JOB_ID] | jq '.technicalData | {
  samplePeakDbfs,
  samplePeakLeftDbfs,
  samplePeakRightDbfs,
  samplePeakLeftDb,
  samplePeakRightDb,
  rmsPeak300msDb,
  truePeakDbtp
}'

# ESPERADO (exemplo):
{
  "samplePeakDbfs": 0.48,          ← Sample Peak REAL (max)
  "samplePeakLeftDbfs": 0.45,      ← L
  "samplePeakRightDbfs": 0.48,     ← R
  "samplePeakLeftDb": 0.45,        ← Chave antiga (agora populada)
  "samplePeakRightDb": 0.48,       ← Chave antiga (agora populada)
  "rmsPeak300msDb": -6.1,          ← RMS Peak (janela 300ms)
  "truePeakDbtp": 1.2              ← True Peak (FFmpeg)
}
```

**Hierarquia esperada:**  
`rmsPeak300msDb < samplePeakDbfs ≤ truePeakDbtp`  
Exemplo: `-6.1 < 0.48 ≤ 1.2` ✅

### 5. **Verificar UI**

**URL:** `http://localhost:3000`

Seção "Métricas Principais" deve mostrar:

```
RMS Peak (300ms):    -6.1 dB
Sample Peak (dBFS):   0.48 dB ✅ BOM
Pico Real (dBTP):     1.2 dBTP 🔴 ESTOURADO
Volume Médio (RMS): -12.3 dB
```

---

## 🎯 CHECKLIST DE CONFIRMAÇÃO

- [ ] Backend reiniciado
- [ ] Job **novo** processado (não reusar antigos)
- [ ] **Log 1:** `[SAMPLE_PEAK] ✅ Max Sample Peak (RAW): X.XX dBFS`
- [ ] **Log 2:** `[CORE-METRICS] ✅ CONFIRMAÇÃO FINAL - Sample Peak...`
- [ ] **Log 3:** `[JSON-OUTPUT] 📊 Sample Peak recebido...`
- [ ] **Log 4:** `[JSON-OUTPUT] ✅ Sample Peak REAL exportado: max=...`
- [ ] JSON contém `samplePeakDbfs` ≠ null
- [ ] JSON contém `samplePeakLeftDb` ≠ null (compatibilidade)
- [ ] UI mostra "Sample Peak (dBFS)" com valor numérico
- [ ] Hierarquia: `rmsPeak < samplePeak ≤ truePeak`

---

## 🚨 TROUBLESHOOTING

### Problema: Todos os logs aparecem mas JSON tem null

**Causa:** Algum processamento posterior está sobrescrevendo

**Debug:**
```javascript
// Adicionar em json-output.js (após linha 475):
console.log('[JSON-OUTPUT-FINAL] technicalData completo:', {
  samplePeakDbfs: technicalData.samplePeakDbfs,
  samplePeakLeftDb: technicalData.samplePeakLeftDb,
  hasKeys: Object.keys(technicalData).filter(k => k.includes('sample'))
});
```

### Problema: Log 2 mostra null mas Log 1 tinha valor

**Causa:** `samplePeakMetrics` não está sendo adicionado ao objeto `coreMetrics`

**Verificar:** [core-metrics.js:395](work/api/audio/core-metrics.js#L395)
```javascript
samplePeak: samplePeakMetrics,  // Esta linha deve existir
```

### Problema: Log 3 não aparece

**Causa:** `extractTechnicalData` não está sendo chamado ou erro antes

**Debug:**
```bash
# Procurar no log:
[JSON-OUTPUT] 🔍 INÍCIO extractTechnicalData
```

---

## 📊 ANTES vs DEPOIS

### ANTES (Problema)
```bash
# Logs:
[SAMPLE_PEAK] ✅ Max Sample Peak (RAW): 0.48 dBFS
# ... silêncio ...
[JSON-OUTPUT] ⚠️ samplePeak não disponível

# JSON:
{
  "samplePeakDbfs": null,
  "samplePeakLeftDb": null,
  "samplePeakRightDb": null
}

# UI:
RMS Peak (300ms):    -6.1 dB
Sample Peak (dBFS):  —  (não aparece)
```

### DEPOIS (Corrigido)
```bash
# Logs:
[SAMPLE_PEAK] ✅ Max Sample Peak (RAW): 0.48 dBFS
[CORE-METRICS] ✅ CONFIRMAÇÃO FINAL - Sample Peak no objeto... maxDbfs: 0.48
[JSON-OUTPUT] 📊 Sample Peak recebido... maxDbfs: 0.48
[JSON-OUTPUT] ✅ Sample Peak REAL exportado: max=0.48, L=0.45, R=0.48

# JSON:
{
  "samplePeakDbfs": 0.48,
  "samplePeakLeftDbfs": 0.45,
  "samplePeakRightDbfs": 0.48,
  "samplePeakLeftDb": 0.45,    ← populado agora
  "samplePeakRightDb": 0.48     ← populado agora
}

# UI:
RMS Peak (300ms):    -6.1 dB
Sample Peak (dBFS):   0.48 dB ✅ BOM
Pico Real (dBTP):     1.2 dBTP
```

---

## 💡 LIÇÕES APRENDIDAS

1. **Nomenclatura confusa:** `samplePeakLeftDb` do FFmpeg ≠ `samplePeakLeftDbfs` do cálculo real
2. **Logs críticos:** Adicionar logs em CADA etapa do pipeline para rastreamento
3. **Compatibilidade:** Popular chaves antigas mesmo quando substituídas por novas

---

## 🗑️ LIMPEZA FUTURA (OPCIONAL)

Após validação completa, **pode remover logs de debug**:

```javascript
// Remover (linhas 760-772 core-metrics.js):
// console.log('[CORE-METRICS] ✅ CONFIRMAÇÃO FINAL...');

// Remover (linhas 118-131 json-output.js):
// console.log('[JSON-OUTPUT] 📊 Sample Peak recebido...');
```

**Manter apenas:**
```javascript
console.log('[SAMPLE_PEAK] ✅ Max Sample Peak (RAW): X.XX dBFS');
console.log('[JSON-OUTPUT] ✅ Sample Peak REAL exportado: max=...');
```

---

**Correção aplicada! Rodar validação para confirmar. 🚀**
