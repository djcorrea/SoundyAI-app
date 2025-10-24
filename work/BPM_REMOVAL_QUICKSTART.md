# 🚀 GUIA RÁPIDO - REMOÇÃO DE BPM

**Tempo estimado**: 30-45 minutos  
**Ganho esperado**: -30% de tempo de processamento (~46 segundos)

---

## 📋 PRÉ-REQUISITOS

✅ Git instalado e configurado  
✅ Node.js 18+ instalado  
✅ PowerShell 5.1+ (Windows)  
✅ Acesso ao diretório `work/`

---

## 🎯 OPÇÃO 1: EXECUÇÃO AUTOMÁTICA (Recomendado)

### 1. Executar Script Automatizado

```powershell
cd work
.\remove-bpm.ps1
```

O script irá:
1. ✅ Criar branch `perf/remove-bpm`
2. ✅ Fazer backup dos arquivos originais
3. ⏸️  **PAUSAR** para você aplicar modificações manuais
4. ✅ Validar sintaxe após modificações
5. ✅ Commitar mudanças automaticamente

---

### 2. Durante a Pausa do Script

**Abra o arquivo `BPM_REMOVAL_AUDIT.md` e siga as instruções detalhadas para cada arquivo.**

Ou use os patches abaixo como referência rápida:

#### **📝 Patch 1: `api/audio/core-metrics.js`**

**Linha 249-256** - Substituir por:
```javascript
// ========= BPM REMOVED - performance optimization =========
// BPM calculation was the #1 bottleneck (30% of total time).
// Removed to improve processing speed from ~150s to ~104s.
const bpmMetrics = { 
  bpm: null, 
  bpmConfidence: null, 
  bpmSource: 'DISABLED' 
};
```

**Linha 280-282** - Substituir por:
```javascript
bpm: null, // BPM REMOVED - performance optimization
bpmConfidence: null, // BPM REMOVED - performance optimization  
bpmSource: 'DISABLED', // BPM REMOVED - performance optimization
```

**Linha 1315-1770** - Remover 6 métodos completos (~455 linhas):
- `calculateBpmMetrics()` (linha 1315-1410)
- `calculateMusicTempoBpm()` (linha 1413-1435)
- `calculateAdvancedOnsetBpm()` (linha 1437-1487)
- `calculateAutocorrelationBpm()` (linha 1490-1563)
- `calculateBpmFromOnsets()` (linha 1582-1625)
- `crossValidateBpmResults()` (linha 1628-1770)

---

#### **📝 Patch 2: `lib/audio/features/context-detector.js`**

**Linha 40-56** - Substituir função por:
```javascript
function autocorrelateTempo(x, time) {
  // BPM REMOVED - performance optimization (30% gain)
  return { bpm: null, confidence: null, bestR: null };
}
```

**Linha 127-133** - Ajustar retorno:
```javascript
bpm: null, // BPM REMOVED - performance optimization
bpmConfidence: null, // BPM REMOVED - performance optimization
```

---

#### **📝 Patch 3: `lib/audio/features/reference-matcher.js`**

**Linha 36-39** - Comentar:
```javascript
// BPM REMOVED - performance optimization
// if (Number.isFinite(sample.bpm) && Number.isFinite(ref.bpm)) {
//   const diff = Math.abs(sample.bpm - ref.bpm);
//   d += weights.bpm * Math.min(1, diff / 20); 
//   wSum += weights.bpm;
// }
```

**Linha 75** - Ajustar peso:
```javascript
const weights = { 
  bpm: 0, // BPM REMOVED
  density: 1.2, 
  fingerprint: 3, 
  subgenre: 0.8 
};
```

---

#### **📝 Patch 4: `tools/perf/verify-parity.js`**

**Linha 37** - Comentar:
```javascript
// bpm: 0.5, // BPM REMOVED - no longer validated
```

**Linha 176-181** - Comentar:
```javascript
// BPM REMOVED - no longer validated
// validateMetric('BPM', baseline.bpm, optimized.bpm, TOLERANCES.bpm);
```

---

#### **📝 Patch 5: `tools/perf/INSTRUMENTATION_EXAMPLE.js`**

**Linha 98** - Adicionar nota:
```javascript
/**
 * ⚠️ DEPRECATED: BPM calculation removed for performance optimization
 * This example is kept for historical reference only.
 * See BPM_REMOVAL_AUDIT.md for details.
 * 
 * EXEMPLO: INSTRUMENTAR BPM COM MÉTODOS SEPARADOS (NÃO MAIS USADO)
 */
```

---

### 3. Após Modificações

Pressione **ENTER** no script. Ele irá:
- ✅ Validar sintaxe de todos os arquivos
- ✅ Commitar mudanças automaticamente

---

## 🎯 OPÇÃO 2: EXECUÇÃO MANUAL

### 1. Criar Branch
```powershell
git checkout -b perf/remove-bpm
```

### 2. Aplicar Patches Manualmente
Use os patches da Opção 1 acima como referência.

### 3. Validar Sintaxe
```powershell
node --check api/audio/core-metrics.js
node --check lib/audio/features/context-detector.js
node --check lib/audio/features/reference-matcher.js
node --check tools/perf/verify-parity.js
```

### 4. Commitar
```powershell
git add .
git commit -m "perf: Remove BPM calculation for 30% performance gain"
```

---

## ✅ VALIDAÇÃO PÓS-REMOÇÃO

### 1. Testar Pipeline
```powershell
cd work
node api/audio/pipeline-complete.js
```

**Verificar**:
- ✅ Nenhum erro de execução
- ✅ `bpm: null` no resultado final
- ✅ Todas as outras métricas presentes

---

### 2. Benchmark de Performance
```powershell
npm run perf:baseline
```

**Comparar**:
- ⏱️ Tempo antes: ~150s
- ⏱️ Tempo depois: ~104s (esperado)
- 📉 Ganho: -46s (-30%)

---

### 3. Validar Paridade
```powershell
npm run perf:parity results/before.json results/after.json
```

**Garantir PASS em**:
- ✅ LUFS Integrated (±0.10 LU)
- ✅ True Peak dBTP (±0.10 dBTP)
- ✅ RMS / DR / Crest (±0.20 dB)
- ✅ Bandas Espectrais (±0.5 pp)

---

## 🚀 CRIAR PULL REQUEST

```powershell
git push origin perf/remove-bpm
```

**No GitHub/GitLab**:
1. Criar PR com título: `perf: Remove BPM calculation (30% performance gain)`
2. Anexar `BPM_REMOVAL_AUDIT.md`
3. Anexar resultados de benchmark (antes/depois)
4. Anexar relatório de paridade
5. Marcar como **Breaking Change** (BPM sempre `null`)

---

## ⚠️ ROLLBACK DE EMERGÊNCIA

Se precisar reverter:

### Opção 1: Reverter Commit
```powershell
git revert HEAD
```

### Opção 2: Restaurar Backup
```powershell
# Copiar do diretório .backup_bpm_removal_*
cp .backup_bpm_removal_*/api/audio/core-metrics.js api/audio/core-metrics.js
# (repetir para outros arquivos)
```

### Opção 3: Restaurar do Branch Anterior
```powershell
git checkout branch-23-outubro work/api/audio/core-metrics.js
# (repetir para outros arquivos)
```

---

## 📊 CHECKLIST FINAL

### Antes de Mergear
- [ ] Todos os testes passam
- [ ] Paridade validada (PASS)
- [ ] Benchmark mostra -30% de redução
- [ ] Nenhum erro de sintaxe
- [ ] Documentação atualizada
- [ ] PR criado com provas
- [ ] Breaking change comunicado

---

## 🎉 SUCESSO!

Após seguir este guia, você terá:
- ✅ BPM removido com segurança
- ✅ Performance melhorada em 30%
- ✅ Todas as outras métricas inalteradas
- ✅ Mudanças documentadas e versionadas

**Tempo total**: ~150s → ~104s  
**Ganho**: -46 segundos (-30%)  
**Código**: ~455 linhas removidas

---

**Criado por**: GitHub Copilot  
**Data**: 23 de outubro de 2025  
**Versão**: 1.0
