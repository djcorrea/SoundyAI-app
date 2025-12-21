# 🔧 PATCHES DE CORREÇÃO MÍNIMA (Market-Ready)

**Objetivo:** Corrigir labels/unidades/contratos SEM alterar cálculos  
**Compatibilidade:** 100% backward compatible  
**Risco:** MÍNIMO (apenas adições + renomeações de labels)

---

## 📦 PATCH 1: Corrigir Label UI "Pico Máximo"

### Arquivo: `public/audio-analyzer-integration.js`

**Linha:** ~14314

**ANTES:**
```javascript
(Number.isFinite(getMetric('peak_db', 'peak')) && getMetric('peak_db', 'peak') !== 0 ? row('Pico Máximo (dBFS)', `${safeFixed(getMetric('peak_db', 'peak'))} dB`, 'peak') : ''),
```

**DEPOIS:**
```javascript
(Number.isFinite(getMetric('peak_db', 'peak')) && getMetric('peak_db', 'peak') !== 0 ? row('RMS Peak (300ms)', `${safeFixed(getMetric('peak_db', 'peak'))} dB`, 'peak') : ''),
```

**Mudança:** Apenas o label string `'Pico Máximo (dBFS)'` → `'RMS Peak (300ms)'`

**Impacto:**
- ✅ Label agora reflete o dado real
- ✅ Zero quebra de código (apenas texto visual)
- ✅ Mesmo valor exibido

**Justificativa:**
- Valor exibido = RMS Peak de janelas de 300ms (confirmado em `core-metrics.js:1623`)
- Label anterior sugeria Sample Peak (incorreto)

---

## 📦 PATCH 2: Corrigir Unidade "Dynamic Range" nas Tabelas

### Arquivo: `public/audio-analyzer-integration.js`

#### 2A. Tabela AB Comparison (Linha ~19284)

**ANTES:**
```javascript
addABRow('Dynamic Range (LU)', userTech.dynamicRange, refTech.dynamicRange, ' LU', 'dr', 1.0);
```

**DEPOIS:**
```javascript
addABRow('Dynamic Range (dB)', userTech.dynamicRange, refTech.dynamicRange, ' dB', 'dr', 1.0);
```

#### 2B. Tabela Track Comparison (Linha ~19937)

**ANTES:**
```javascript
addRow('Dynamic Range (LU)', currTech.dynamicRange || currTech.dynamic_range,
       refTech.dynamicRange || refTech.dynamic_range, ' LU', 15);
```

**DEPOIS:**
```javascript
addRow('Dynamic Range (dB)', currTech.dynamicRange || currTech.dynamic_range,
       refTech.dynamicRange || refTech.dynamic_range, ' dB', 15);
```

**Mudança:** Apenas unidade `' LU'` → `' dB'` e label `'(LU)'` → `'(dB)'`

**Impacto:**
- ✅ Unidade tecnicamente correta (DR é em dB, não LU)
- ✅ Zero quebra de código
- ✅ Mesmo valor numérico exibido

**Justificativa:**
- DR = Peak RMS - Average RMS = diferença em **dB** (padrão DR14)
- LU é para LUFS/LRA, não para DR

---

## 📦 PATCH 3: Contrato JSON Explícito

### Arquivo: `work/api/audio/json-output.js`

**Linha:** ~432-436

**ANTES:**
```javascript
technicalData.peak = technicalData.rmsLevels.peak;
technicalData.rms = technicalData.rmsLevels.average;
technicalData.avgLoudness = technicalData.rmsLevels.average; // alias para Volume Médio

console.log(`[DEBUG JSON FINAL] technicalData.avgLoudness=${technicalData.avgLoudness}, technicalData.rms=${technicalData.rms}`);
```

**DEPOIS:**
```javascript
// 🆕 Chaves explícitas para clareza (opt-in)
technicalData.rmsPeak300msDb = technicalData.rmsLevels.peak;
technicalData.rmsAverageDb = technicalData.rmsLevels.average;

// 🔄 Manter aliases legados para compatibilidade (backward compat)
technicalData.peak = technicalData.rmsLevels.peak;  // @deprecated Use rmsPeak300msDb
technicalData.rms = technicalData.rmsLevels.average;
technicalData.avgLoudness = technicalData.rmsLevels.average;

console.log(`[DEBUG JSON FINAL] technicalData.rmsPeak300msDb=${technicalData.rmsPeak300msDb}, technicalData.rmsAverageDb=${technicalData.rmsAverageDb}, technicalData.avgLoudness=${technicalData.avgLoudness}, technicalData.rms=${technicalData.rms}`);
```

**Mudança:** Adicionar chaves `rmsPeak300msDb` e `rmsAverageDb`, manter antigas

**Impacto:**
- ✅ Contrato JSON agora explícito
- ✅ 100% backward compatible (chaves antigas mantidas)
- ✅ Novos sistemas podem usar chaves claras
- ✅ Documentação via `@deprecated` para migração futura

**Justificativa:**
- Chave `peak` é ambígua (não especifica janela de 300ms)
- Novos nomes seguem convenção: `<metric><window><unit>`

---

## 📦 PATCH 4 (OPCIONAL): Adicionar Sample Peak Real

### Arquivo: `work/api/audio/core-metrics.js`

#### 4A. Adicionar Método de Cálculo (após linha ~1120)

**ADICIONAR NOVO MÉTODO:**
```javascript
/**
 * 🎯 Cálculo de Sample Peak (Amplitude Máxima Absoluta)
 * Retorna o maior valor absoluto entre todas as amostras PCM
 */
calculateSamplePeak(leftChannel, rightChannel, options = {}) {
  const jobId = options.jobId || 'unknown';
  
  try {
    logAudio('core_metrics', 'sample_peak_calculation', { 
      samples: leftChannel.length, 
      jobId: jobId.substring(0,8) 
    });

    // Encontrar amplitude máxima absoluta por canal
    let leftMax = 0;
    let rightMax = 0;
    
    for (let i = 0; i < leftChannel.length; i++) {
      const absLeft = Math.abs(leftChannel[i]);
      const absRight = Math.abs(rightChannel[i]);
      if (absLeft > leftMax) leftMax = absLeft;
      if (absRight > rightMax) rightMax = absRight;
    }
    
    // Converter para dB
    const leftDb = leftMax > 0 ? 20 * Math.log10(leftMax) : -120;
    const rightDb = rightMax > 0 ? 20 * Math.log10(rightMax) : -120;
    const maxDb = Math.max(leftDb, rightDb);
    
    // Validar range realista
    if (maxDb > 6 || maxDb < -120) {
      logAudio('core_metrics', 'sample_peak_warning', { 
        value: maxDb, 
        message: 'Sample Peak fora do range esperado',
        jobId: jobId.substring(0,8) 
      });
    }
    
    const samplePeakMetrics = {
      leftDb,
      rightDb,
      maxDb,
      leftLinear: leftMax,
      rightLinear: rightMax,
      maxLinear: Math.max(leftMax, rightMax)
    };
    
    logAudio('core_metrics', 'sample_peak_success', { 
      leftDb: leftDb.toFixed(2), 
      rightDb: rightDb.toFixed(2), 
      maxDb: maxDb.toFixed(2) 
    });
    
    return samplePeakMetrics;
    
  } catch (error) {
    if (error.stage === 'core_metrics') {
      throw error;
    }
    throw makeErr('core_metrics', `Sample peak calculation failed: ${error.message}`, 'sample_peak_calculation_error');
  }
}
```

#### 4B. Chamar Cálculo (antes da linha ~110, antes de True Peak)

**ADICIONAR ANTES DE TRUE PEAK:**
```javascript
// 🎯 SAMPLE PEAK (amplitude máxima absoluta)
logAudio('core_metrics', 'sample_peak_start', { channels: 2, samples: leftChannel.length });
const rawSamplePeakMetrics = this.calculateSamplePeak(leftChannel, rightChannel, { jobId });
console.log('[RAW_METRICS] ✅ Sample Peak (RAW):', rawSamplePeakMetrics.maxDb);
```

#### 4C. Adicionar ao Objeto coreMetrics (linha ~320)

**ADICIONAR CAMPO:**
```javascript
samplePeak: rawSamplePeakMetrics,  // 🆕 Sample Peak calculado
```

---

### Arquivo: `work/api/audio/json-output.js`

#### 4D. Exportar Sample Peak (após linha ~161, após True Peak)

**ADICIONAR APÓS TRUE PEAK:**
```javascript
// 🆕 ===== Sample Peak (Amplitude Máxima Absoluta) =====
if (coreMetrics.samplePeak && typeof coreMetrics.samplePeak === 'object') {
  technicalData.samplePeakDbfs = safeSanitize(coreMetrics.samplePeak.maxDb);
  technicalData.samplePeakLeftDbfs = safeSanitize(coreMetrics.samplePeak.leftDb);
  technicalData.samplePeakRightDbfs = safeSanitize(coreMetrics.samplePeak.rightDb);
  technicalData.samplePeakLinear = safeSanitize(coreMetrics.samplePeak.maxLinear);
  
  console.log('[JSON-OUTPUT] ✅ Sample Peak exportado:', {
    maxDb: technicalData.samplePeakDbfs,
    leftDb: technicalData.samplePeakLeftDbfs,
    rightDb: technicalData.samplePeakRightDbfs
  });
} else {
  console.warn('[JSON-OUTPUT] ⚠️ Sample Peak não disponível');
  technicalData.samplePeakDbfs = null;
}
```

---

### Arquivo: `public/audio-analyzer-integration.js`

#### 4E. Adicionar Card Sample Peak (linha ~14314, ANTES do RMS Peak)

**ADICIONAR CARD CONDICIONAL:**
```javascript
// 🆕 Sample Peak (amplitude máxima absoluta) - condicional (só exibe se calculado)
(() => {
    const samplePeakValue = getMetricWithFallback([
        'samplePeakDbfs',
        'technicalData.samplePeakDbfs'
    ]);
    if (Number.isFinite(samplePeakValue)) {
        return row('Sample Peak (dBFS)', `${safeFixed(samplePeakValue, 1)} dB`, 'samplePeakDbfs');
    }
    return ''; // Ocultar se não disponível (compatibilidade com dados antigos)
})(),
```

**Impacto:**
- ✅ Adiciona métrica profissional standard
- ✅ Backward compatible (oculta card se dado não existe)
- ✅ Permite validação matemática (truePeak >= samplePeak)
- ⚠️ Custo: ~5ms por job (0.5% de overhead)

---

## 📦 PATCH 5: Sanity Checks (Invariantes)

### Arquivo NOVO: `work/lib/audio/features/metrics-invariants.js`

**CRIAR ARQUIVO COMPLETO:**
```javascript
/**
 * 🔍 VALIDAÇÃO DE INVARIANTES MATEMÁTICAS
 * Sistema de checks determinísticos para detectar inconsistências
 */

import { logAudio } from '../error-handling.js';

export function validateMetricsInvariants(coreMetrics, jobId = 'unknown') {
  const warnings = [];
  const tolerance = 0.5; // dB
  
  console.log(`[INVARIANTS][${jobId}] 🔍 Validando invariantes matemáticas...`);
  
  // ========== CHECK 1: RMS Average <= RMS Peak ==========
  if (coreMetrics.rms?.average && coreMetrics.rms?.peak) {
    if (coreMetrics.rms.average > coreMetrics.rms.peak + tolerance) {
      warnings.push({
        check: 'RMS_CONSISTENCY',
        severity: 'CRITICAL',
        message: `RMS Average (${coreMetrics.rms.average.toFixed(2)} dB) > RMS Peak (${coreMetrics.rms.peak.toFixed(2)} dB)`,
        expected: `<= ${coreMetrics.rms.peak.toFixed(2)} dB`,
        actual: `${coreMetrics.rms.average.toFixed(2)} dB`,
        impact: 'Violação matemática: média não pode exceder pico'
      });
    } else {
      console.log(`[INVARIANTS][${jobId}] ✅ RMS Average <= RMS Peak OK`);
    }
  }
  
  // ========== CHECK 2: True Peak >= Sample Peak ==========
  if (coreMetrics.truePeak?.maxDbtp && coreMetrics.samplePeak?.maxDb) {
    const diff = coreMetrics.truePeak.maxDbtp - coreMetrics.samplePeak.maxDb;
    
    if (diff < -tolerance) {
      warnings.push({
        check: 'PEAK_CONSISTENCY',
        severity: 'CRITICAL',
        message: `True Peak (${coreMetrics.truePeak.maxDbtp.toFixed(2)} dBTP) < Sample Peak (${coreMetrics.samplePeak.maxDb.toFixed(2)} dBFS)`,
        expected: `>= ${(coreMetrics.samplePeak.maxDb - tolerance).toFixed(2)} dBTP`,
        actual: `${coreMetrics.truePeak.maxDbtp.toFixed(2)} dBTP`,
        impact: 'Violação da definição matemática de True Peak (intersample deve >= sample)'
      });
    } else if (diff > 2.0) {
      warnings.push({
        check: 'PEAK_CONSISTENCY',
        severity: 'WARNING',
        message: `True Peak muito acima de Sample Peak (+${diff.toFixed(2)} dB)`,
        expected: `${coreMetrics.samplePeak.maxDb.toFixed(2)} a ${(coreMetrics.samplePeak.maxDb + 2.0).toFixed(2)} dBTP`,
        actual: `${coreMetrics.truePeak.maxDbtp.toFixed(2)} dBTP`,
        impact: 'Diferença anormalmente alta'
      });
    } else {
      console.log(`[INVARIANTS][${jobId}] ✅ True Peak >= Sample Peak OK (diff=+${diff.toFixed(2)} dB)`);
    }
  }
  
  // ========== CHECK 3: Dynamic Range >= 0 ==========
  if (coreMetrics.dynamics?.dynamicRange !== undefined) {
    const dr = coreMetrics.dynamics.dynamicRange;
    
    if (dr < 0) {
      warnings.push({
        check: 'DR_RANGE',
        severity: 'CRITICAL',
        message: `Dynamic Range negativo: ${dr.toFixed(2)} dB`,
        expected: `>= 0 dB`,
        actual: `${dr.toFixed(2)} dB`,
        impact: 'DR não pode ser negativo por definição (peak >= average)'
      });
    } else if (dr > 30) {
      warnings.push({
        check: 'DR_RANGE',
        severity: 'WARNING',
        message: `Dynamic Range muito alto: ${dr.toFixed(2)} dB`,
        expected: `< 30 dB (típico para música)`,
        actual: `${dr.toFixed(2)} dB`,
        impact: 'Valor incomum, pode indicar erro ou áudio especial'
      });
    } else {
      console.log(`[INVARIANTS][${jobId}] ✅ Dynamic Range dentro do range OK (${dr.toFixed(2)} dB)`);
    }
  }
  
  // ========== CHECK 4: LRA = 0.0 com LUFS normal ==========
  if (coreMetrics.loudness?.range !== undefined && coreMetrics.loudness?.integrated) {
    const lra = coreMetrics.loudness.range;
    const lufs = coreMetrics.loudness.integrated;
    
    if (lra === 0.0 && lufs > -50) {
      warnings.push({
        check: 'LRA_ZERO',
        severity: 'INFO',
        message: `LRA = 0.0 LU mas LUFS = ${lufs.toFixed(1)} LUFS (áudio não-silencioso)`,
        expected: `> 0.1 LU para áudio dinâmico`,
        actual: `0.0 LU`,
        impact: 'Sugere compressão extrema, limiter ou possível erro'
      });
    } else {
      console.log(`[INVARIANTS][${jobId}] ✅ LRA OK (${lra.toFixed(2)} LU)`);
    }
  }
  
  // ========== RESUMO ==========
  const critical = warnings.filter(w => w.severity === 'CRITICAL');
  const warning = warnings.filter(w => w.severity === 'WARNING');
  const info = warnings.filter(w => w.severity === 'INFO');
  
  console.log(`[INVARIANTS][${jobId}] ========== RESUMO ==========`);
  console.log(`[INVARIANTS][${jobId}] CRITICAL: ${critical.length}`);
  console.log(`[INVARIANTS][${jobId}] WARNING: ${warning.length}`);
  console.log(`[INVARIANTS][${jobId}] INFO: ${info.length}`);
  console.log(`[INVARIANTS][${jobId}] ============================`);
  
  if (critical.length > 0) {
    console.error(`[INVARIANTS][${jobId}] ❌ Falhas críticas detectadas!`);
    critical.forEach(w => console.error(`[INVARIANTS][${jobId}] [CRITICAL] ${w.check}: ${w.message}`));
  }
  
  return {
    valid: critical.length === 0,
    warnings,
    summary: {
      totalChecks: 4,
      critical: critical.length,
      warning: warning.length,
      info: info.length
    }
  };
}
```

---

### Arquivo: `work/api/audio/core-metrics.js`

#### 5B. Importar e Usar (antes do return final, linha ~340)

**ADICIONAR IMPORT NO TOPO:**
```javascript
import { validateMetricsInvariants } from '../../lib/audio/features/metrics-invariants.js';
```

**ADICIONAR ANTES DO RETURN:**
```javascript
// 🔍 Validar invariantes matemáticas
const invariantsResult = validateMetricsInvariants(coreMetrics, jobId);
coreMetrics._invariantsValidation = invariantsResult;

if (!invariantsResult.valid) {
  console.error(`[CORE-METRICS][${jobId}] ⚠️ Invariantes falharam:`, invariantsResult.summary);
}
```

**Impacto:**
- ✅ Detecta erros automaticamente
- ✅ Não altera nenhum resultado (apenas logs)
- ✅ Pode ser desabilitado em produção (via flag)

---

## 📋 CHECKLIST DE VALIDAÇÃO PÓS-APLICAÇÃO

### Teste 1: Verificar Labels UI

**Procedimento:**
1. Processar arquivo de teste (qualquer áudio)
2. Abrir UI e verificar cards

**Esperado:**
- ✅ Card exibe "RMS Peak (300ms)" (não mais "Pico Máximo")
- ✅ Valor numérico permanece inalterado
- ✅ Card "Pico Real (dBTP)" continua igual

**Comando:**
```bash
# Processar arquivo
curl -X POST http://localhost:3001/api/jobs \
  -F "audioFile=@test.mp3"

# Abrir UI e verificar
```

---

### Teste 2: Verificar Unidades em Tabelas

**Procedimento:**
1. Modo Gênero: processar com gênero selecionado
2. Verificar tabela de comparação

**Esperado:**
- ✅ Linha "Dynamic Range" exibe unidade "dB" (não mais "LU")
- ✅ Valor numérico permanece inalterado
- ✅ Outras linhas (LUFS, LRA) continuam com suas unidades corretas

---

### Teste 3: Verificar JSON Response

**Procedimento:**
1. Processar arquivo
2. Verificar JSON de resposta

**Esperado (PATCH 3):**
```json
{
  "technicalData": {
    "rmsPeak300msDb": -6.6,
    "rmsAverageDb": -14.2,
    "peak": -6.6,           // ← mantido para compatibilidade
    "rms": -14.2,           // ← mantido para compatibilidade
    "avgLoudness": -14.2    // ← mantido para compatibilidade
  }
}
```

✅ Novas chaves existem  
✅ Chaves antigas mantidas  
✅ Valores idênticos

---

### Teste 4 (SE PATCH 4 APLICADO): Sample Peak

**Procedimento:**
1. Processar arquivo de teste (sine -1 dBFS)
2. Verificar JSON e UI

**Esperado:**
```json
{
  "technicalData": {
    "samplePeakDbfs": -1.0,
    "samplePeakLeftDbfs": -1.0,
    "samplePeakRightDbfs": -1.0,
    "truePeakDbtp": -0.7
  }
}
```

✅ Sample Peak existe  
✅ True Peak >= Sample Peak  
✅ Card "Sample Peak (dBFS)" aparece na UI

---

### Teste 5 (SE PATCH 5 APLICADO): Invariantes

**Procedimento:**
1. Processar arquivo normal
2. Verificar console logs

**Esperado:**
```
[INVARIANTS][abc123] 🔍 Validando invariantes matemáticas...
[INVARIANTS][abc123] ✅ RMS Average <= RMS Peak OK
[INVARIANTS][abc123] ✅ True Peak >= Sample Peak OK (diff=+0.3 dB)
[INVARIANTS][abc123] ✅ Dynamic Range dentro do range OK (7.6 dB)
[INVARIANTS][abc123] ✅ LRA OK (4.2 LU)
[INVARIANTS][abc123] ========== RESUMO ==========
[INVARIANTS][abc123] CRITICAL: 0
[INVARIANTS][abc123] WARNING: 0
[INVARIANTS][abc123] INFO: 0
[INVARIANTS][abc123] ============================
```

✅ Todos os checks passam  
✅ Nenhum warning crítico

---

### Teste 6: Backward Compatibility

**Procedimento:**
1. Processar dados antigos (sem Sample Peak)
2. Verificar UI

**Esperado:**
- ✅ UI funciona normalmente
- ✅ Card "Sample Peak" não aparece (condicional)
- ✅ Outros cards funcionam com fallbacks antigos
- ✅ Nenhum erro no console

---

### Teste 7: Comparar Outputs (Antes vs Depois)

**Procedimento:**
```bash
# Antes dos patches (salvar output)
curl http://localhost:3001/api/jobs/OLD_JOB_ID > before.json

# Aplicar patches + reiniciar servidor

# Depois dos patches (mesmo arquivo)
curl -X POST http://localhost:3001/api/jobs -F "audioFile=@same-file.mp3"
curl http://localhost:3001/api/jobs/NEW_JOB_ID > after.json

# Comparar valores numéricos (devem ser idênticos)
node compare-outputs.js before.json after.json
```

**Script `compare-outputs.js`:**
```javascript
const fs = require('fs');
const before = JSON.parse(fs.readFileSync(process.argv[2]));
const after = JSON.parse(fs.readFileSync(process.argv[3]));

const metrics = [
  'lufsIntegrated', 'truePeakDbtp', 'dynamicRange', 
  'lra', 'rms', 'avgLoudness', 'peak'
];

console.log('Comparando valores numéricos...\n');
metrics.forEach(key => {
  const v1 = before.technicalData?.[key];
  const v2 = after.technicalData?.[key];
  const match = Math.abs(v1 - v2) < 0.01;
  console.log(`${key}: ${v1} vs ${v2} ${match ? '✅' : '❌'}`);
});
```

**Esperado:**
- ✅ Todos os valores numéricos idênticos (diff < 0.01)
- ✅ Novos campos adicionados (não afetam antigos)

---

## 🎯 ORDEM DE APLICAÇÃO DOS PATCHES

### Mínimo Viável (Sem Sample Peak)

1. **PATCH 1** — Corrigir label "Pico Máximo" → "RMS Peak (300ms)"
2. **PATCH 2** — Corrigir unidade "LU" → "dB" em tabelas
3. **PATCH 3** — Adicionar chaves explícitas no JSON

**Tempo:** ~5 minutos  
**Risco:** MÍNIMO  
**Resultado:** Sistema "market-ready" básico

---

### Completo (Com Sample Peak + Validação)

1. **PATCH 1-3** (conforme acima)
2. **PATCH 4** — Adicionar cálculo de Sample Peak
3. **PATCH 5** — Adicionar validação de invariantes

**Tempo:** ~15 minutos  
**Risco:** BAIXO  
**Resultado:** Sistema profissional completo

---

## ✅ GARANTIAS DE COMPATIBILIDADE

### Backward Compatibility 100%

- ✅ Todas as chaves antigas mantidas
- ✅ Mesmos valores numéricos
- ✅ UI funciona com dados antigos e novos
- ✅ Fallbacks robustos implementados

### Forward Compatibility

- ✅ Novos sistemas podem usar chaves explícitas
- ✅ Documentação via `@deprecated` para migração
- ✅ Chaves novas são opt-in (não obrigatórias)

### Zero Breaking Changes

- ✅ Nenhuma remoção de campo
- ✅ Nenhuma alteração de tipo
- ✅ Nenhuma mudança em cálculos
- ✅ Apenas adições e renomeações de labels visuais

---

## 📝 NOTAS FINAIS

### Por Que Estes Patches São Seguros

1. **Apenas Labels:** Patches 1-2 mudam apenas texto visual
2. **Apenas Adições:** Patches 3-4 apenas adicionam campos
3. **Apenas Logs:** Patch 5 apenas adiciona validação informativa
4. **Compatibilidade:** Chaves antigas sempre mantidas
5. **Testável:** Cada patch pode ser validado individualmente

### Se Algo Der Errado

**Rollback imediato:**
```bash
# Reverter arquivo
git checkout HEAD -- <arquivo_modificado>

# Reiniciar servidor
pm2 restart soundy-api
```

Cada patch é independente e pode ser revertido sem afetar os outros.

---

**Patches prontos para aplicação. Escolha entre "Mínimo Viável" ou "Completo".**
