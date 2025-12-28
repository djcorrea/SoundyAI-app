# 🔧 AUDIT: Score Engine V3.3 - Correções de Gates

**Data:** 2025-01-27  
**Versão:** 3.3.0  
**Status:** ✅ CORRIGIDO

---

## 📋 PROBLEMAS IDENTIFICADOS

### 1. TRUE_PEAK_WARNING Disparando Incorretamente
**Sintoma:** Logs mostravam WARNING para TP = -1.0 dBTP no modo streaming.

**Causa Raiz:**
```javascript
// CÓDIGO ANTIGO (BUG):
else if (truePeak !== null && truePeak > tpMax - 0.5) {
```

Para streaming:
- `tpMax = -1.0`
- `tpMax - 0.5 = -1.5`
- Se TP = -1.0 → `-1.0 > -1.5` = **TRUE** → WARNING incorreto!

**Correção:**
```javascript
// CÓDIGO CORRIGIDO (V3.3):
else if (truePeak !== null) {
    const tpTarget = targets.truePeak?.target ?? tpMax;
    const warningThreshold = Math.min(tpTarget + 0.3, tpMax);
    
    if (truePeak > warningThreshold && truePeak <= tpMax) {
        // WARNING apenas se TP está ACIMA do target em zona de risco
    }
}
```

---

### 2. Gates Não Aplicados na UI
**Sintoma:** Score alto (73-77%) mesmo com TP > 0 dBTP.

**Causa Raiz:**
- `calculateAnalysisScores()` em `audio-analyzer-integration.js` NÃO chamava os gates V3
- Os gates existiam apenas em `scoring.js::computeMixScore`, mas a UI usava pipeline diferente

**Correção:**
Integração de gates V3 diretamente em `__safeCalculateAnalysisScores()`:

```javascript
// Gates aplicados na UI (audio-analyzer-integration.js):
// GATE #1: TRUE PEAK CRÍTICO (> 0 dBTP) → cap 35%
// GATE #2: TRUE PEAK CLIPPING (> mode max) → cap 30%
// GATE #3: TRUE PEAK WARNING (zona de risco) → cap 70%
// GATE #4: CLIPPING SEVERO (> 5%) → cap 40%
// GATE #5: LUFS EXCESSIVO → cap 50%
```

---

## ✅ ARQUIVOS MODIFICADOS

### 1. `public/lib/audio/features/scoring.js`
- **Linha 1061-1078:** Corrigido threshold do TRUE_PEAK_WARNING
- **Linha 1806-1920:** Atualizados testes de aceitação para V3.3

### 2. `public/audio-analyzer-integration.js`
- **Linha 15376-15450:** Adicionada integração de gates V3 em `__safeCalculateAnalysisScores()`

---

## 🧪 CASOS DE TESTE

Execute `window.testScoringGates()` no console:

| Caso | Condição | Score Esperado | Gate |
|------|----------|----------------|------|
| 1 | TP = +4.7 dBTP | ≤ 35% | TRUE_PEAK_CRITICAL |
| 2 | TP = -1.0 dBTP (streaming target) | ≥ 60% | NENHUM |
| 3 | Clipping = 10% | ≤ 40% | CLIPPING_SEVERE |
| 4 | LUFS = -6.0 (streaming) | ≤ 50% | LUFS_EXCESSIVE |
| 5 | TP = +2.9 dBTP | ≤ 35% | TRUE_PEAK_CRITICAL |

---

## 📊 LÓGICA DE THRESHOLDS POR MODO

| Modo | Target TP | Max TP | Warning Threshold |
|------|-----------|--------|-------------------|
| streaming | -1.0 | -1.0 | N/A (target = max) |
| pista | -0.3 | 0.0 | 0.0 (target + 0.3, limitado ao max) |
| reference | -1.0 | 0.0 | -0.7 (target + 0.3) |

---

## ✅ VALIDAÇÃO

Para validar as correções:

1. Abra o console do navegador
2. Execute: `window.testScoringGates()`
3. Verifique que todos os testes passam
4. Analise um áudio com TP > 0 dBTP e confirme score ≤ 35%

---

## 📝 NOTAS IMPORTANTES

1. **NUNCA** aceitar TP > 0 dBTP - é clipping digital absoluto
2. Para streaming, TP = -1.0 dBTP é o **TARGET**, não deve disparar warning
3. Os gates são aplicados em DUAS pipelines:
   - `scoring.js::computeMixScore` (para chamadas diretas)
   - `audio-analyzer-integration.js::__safeCalculateAnalysisScores` (para UI)

---

**Responsável:** GitHub Copilot  
**Revisão:** Pendente
