# 🔍 AUDITORIA DE LOGS APLICADA AO SISTEMA DE SCORES

**Data:** 2 de novembro de 2025  
**Arquivo Modificado:** `/public/audio-analyzer-integration.js`  
**Objetivo:** Inserir logs de auditoria detalhados em todas as funções de cálculo de score

---

## ✅ MODIFICAÇÕES REALIZADAS

### 1. **calculateMetricScore()** (Linha ~9238)

**Logs adicionados:**
- ✅ Log quando validação falha (tolerance <= 0 ou valores inválidos)
- ✅ Log quando diferença está dentro da tolerância (retorna 100)
- ✅ Log quando aplica curva de penalização (retorna score calculado)

**Informações logadas:**
```javascript
{
  func: 'calculateMetricScore',
  value: actualValue,
  target: targetValue,
  diff: Math.abs(actualValue - targetValue),
  tolerance,
  result,
  condition: 'diff <= tolerance' | 'diff > tolerance' | 'validação falhou',
  ratio: diff / tolerance,
  penaltyLevel: '1-1.5x' | '1.5-2x' | '2-3x' | '>3x',
  reason: 'motivo da falha' (se aplicável)
}
```

---

### 2. **calculateLoudnessScore()** (Linha ~9325)

**Logs adicionados:**
- ✅ Log quando nenhum score válido é calculado (retorna null)
- ✅ Log final com resultado agregado

**Informações logadas:**
```javascript
{
  func: 'calculateLoudnessScore',
  value: { lufs, truePeak, crest },
  target: { lufs, truePeak, crest },
  diff: 'ver logs individuais',
  tolerance: { lufs, truePeak, crest },
  result,
  condition: 'average of X metrics',
  individualScores: [score1, score2, ...],
  average
}
```

**Métricas rastreadas:**
- LUFS Integrado
- True Peak (dBTP)
- Crest Factor

---

### 3. **calculateDynamicsScore()** (Linha ~9415)

**Logs adicionados:**
- ✅ Log quando nenhum score válido é calculado (retorna null)
- ✅ Log final com resultado agregado

**Informações logadas:**
```javascript
{
  func: 'calculateDynamicsScore',
  value: { dr, lra, crest, compression },
  target: { dr, lra, crest, compression },
  diff: 'ver logs individuais',
  tolerance: { dr, lra, crest, compression },
  result,
  condition: 'average of X metrics',
  individualScores: [score1, score2, ...],
  average
}
```

**Métricas rastreadas:**
- Dynamic Range (DR)
- Loudness Range (LRA)
- Crest Factor
- Compression Ratio

---

### 4. **calculateStereoScore()** (Linha ~9510)

**Logs adicionados:**
- ✅ Log quando nenhum score válido é calculado (retorna null)
- ✅ Log final com resultado agregado

**Informações logadas:**
```javascript
{
  func: 'calculateStereoScore',
  value: { correlation, width, balance, separation },
  target: { correlation, width, balance, separation },
  diff: 'ver logs individuais',
  tolerance: { correlation, width, balance, separation },
  result,
  condition: 'average of X metrics',
  individualScores: [score1, score2, ...],
  average
}
```

**Métricas rastreadas:**
- Correlação Estéreo
- Largura Estéreo (Width)
- Balanço L/R
- Separação de Canais

---

### 5. **calculateFrequencyScore()** (Linha ~9600)

**Logs adicionados:**
- ✅ Log quando nenhum score válido é calculado (retorna null)
- ✅ Log final com resultado agregado
- ✅ Inclui informação sobre modo reference vs genre

**Informações logadas:**
```javascript
{
  func: 'calculateFrequencyScore',
  value: 'bandas espectrais (ver logs individuais)',
  target: 'bandas de referência',
  diff: 'ver logs individuais por banda',
  tolerance: '0 (modo reference)' | 'target_range',
  result,
  condition: 'average of X bands',
  individualScores: [score1, score2, ...],
  average,
  isReferenceMode: true | false,
  bandsProcessed: 7
}
```

**Bandas rastreadas:**
- Sub (20-60 Hz)
- Bass (60-250 Hz)
- Low Mid (250-500 Hz)
- Mid (500-2000 Hz)
- High Mid (2000-4000 Hz)
- Presence (4000-6000 Hz)
- Air (6000-20000 Hz)

**⚠️ ATENÇÃO:** Este log vai revelar se `tolerance = 0` está causando o problema no modo reference.

---

### 6. **calculateTechnicalScore()** (Linha ~9750)

**Logs adicionados:**
- ✅ Log final com resultado agregado
- ✅ Inclui informação sobre hard cap aplicado (truePeak > 0)

**Informações logadas:**
```javascript
{
  func: 'calculateTechnicalScore',
  value: { clipping, dcOffset, thd, truePeak, issues },
  target: 'valores ideais (0 para clipping/dc/thd, <0 para truePeak)',
  diff: 'N/A (avaliação por faixas)',
  tolerance: 'N/A',
  result,
  condition: 'average of X metrics',
  individualScores: [score1, score2, ...],
  average,
  hasTruePeakData: true | false,
  hardCapApplied: true | false
}
```

**Métricas rastreadas:**
- Clipping (%)
- DC Offset
- THD (Total Harmonic Distortion)
- True Peak (para hard cap)
- Issues detectados

---

### 7. **calculateAnalysisScores()** (Linha ~9920)

**Log final adicionado:**
```javascript
{
  loudness: 20,
  dinamica: 88,
  frequencia: null,  // ← ESTE É O PROBLEMA
  estereo: 100,
  tecnico: 85,
  finalScore: 63,
  weights: {
    loudness: 0.30,
    dinamica: 0.25,
    frequencia: 0.20,
    estereo: 0.10,
    tecnico: 0.15
  },
  genre: 'default',
  weightedCalculation: {
    loudness: 6.0,    // 20 * 0.30
    dinamica: 22.0,   // 88 * 0.25
    frequencia: 'N/A', // null * 0.20
    estereo: 10.0,    // 100 * 0.10
    tecnico: 12.75    // 85 * 0.15
  },
  isReferenceMode: true
}
```

**Informações logadas:**
- Sub-scores individuais
- Score final
- Pesos aplicados
- Cálculo ponderado detalhado
- Modo de operação (reference vs genre)

---

## 📋 CHECKLIST DE VALIDAÇÃO

Após aplicar essas modificações, o console do Railway/navegador deve mostrar:

### ✅ **Logs esperados no modo reference:**

```
[AUDIT-SCORE] { func: "calculateMetricScore", value: -16.54, target: -21.47, diff: 4.93, tolerance: 0.5, result: 20, condition: "diff > tolerance", ratio: 9.86, penaltyLevel: ">3x" }

[AUDIT-SCORE] { func: "calculateMetricScore", value: 2.70, target: 1.00, diff: 1.70, tolerance: 0.3, result: 20, condition: "diff > tolerance", ratio: 5.67, penaltyLevel: ">3x" }

[AUDIT-SCORE] { func: "calculateLoudnessScore", value: {...}, target: {...}, result: 20, condition: "average of 2 metrics", individualScores: [20, 20] }

[AUDIT-SCORE] { func: "calculateDynamicsScore", value: {...}, target: {...}, result: 88, condition: "average of 2 metrics", individualScores: [88, 88] }

[AUDIT-SCORE] { func: "calculateStereoScore", value: {...}, target: {...}, result: 100, condition: "average of 1 metrics", individualScores: [100] }

[AUDIT-SCORE] { func: "calculateFrequencyScore", value: "N/A", target: "N/A", result: null, condition: "no valid scores", scoresCount: 0, isReferenceMode: true }
                                                                                    ^^^^
                                                                                    ESTE É O PROBLEMA

[AUDIT-SCORE] { func: "calculateTechnicalScore", value: {...}, target: {...}, result: 85, condition: "average of 3 metrics" }

[AUDIT-FINAL-SCORES] { loudness: 20, dinamica: 88, frequencia: null, estereo: 100, tecnico: 85, finalScore: 63, weightedCalculation: {...} }
```

---

## 🔍 DIAGNÓSTICO ESPERADO

### **Problema confirmado:**

Se os logs mostrarem:

```javascript
[AUDIT-SCORE] { 
  func: "calculateFrequencyScore",
  result: null,
  condition: "no valid scores",
  scoresCount: 0,
  isReferenceMode: true
}
```

**Então o problema é confirmado:** `tolDb = 0` no modo reference está impedindo o cálculo de scores de frequência.

---

### **Problema NÃO confirmado:**

Se os logs mostrarem:

```javascript
[AUDIT-SCORE] { 
  func: "calculateFrequencyScore",
  result: 85,
  condition: "average of 7 bands",
  individualScores: [80, 90, 85, 88, 82, 87, 83]
}
```

**Então o problema está em outro lugar**, provavelmente:
- Frontend exibindo valores de cache
- Modo reference não sendo detectado (`isReferenceMode: false`)
- Tolerâncias sendo sobrescritas antes do cálculo

---

## 🎯 PRÓXIMOS PASSOS

1. **Executar análise no modo reference:**
   - Upload primeira faixa
   - Upload segunda faixa
   - Abrir console do navegador (F12)

2. **Buscar logs de auditoria:**
   ```javascript
   // Filtrar apenas logs de auditoria
   [AUDIT-SCORE]
   [AUDIT-FINAL-SCORES]
   ```

3. **Verificar valores críticos:**
   - `frequencia: null` → Confirma problema de tolerância zero
   - `frequencia: <número>` → Problema está em outro lugar

4. **Validar cálculo final:**
   - Verificar `weightedCalculation` → Deve mostrar multiplicação correta
   - Verificar `finalScore` → Deve ser média ponderada dos sub-scores válidos

---

## ✅ GARANTIAS

- ✅ **Nenhuma lógica foi alterada** - Apenas logs adicionados
- ✅ **Todos os logs dentro de try/catch** - Não quebra execução se houver erro
- ✅ **Formato JSON direto** - Legível no Railway Log Explorer
- ✅ **Logs granulares** - Cada função tem seu próprio log
- ✅ **Log central final** - Resumo de todos os scores calculados

---

## 📊 FORMATO DOS LOGS

Todos os logs seguem o padrão:

```javascript
[AUDIT-SCORE] {
  func: 'NOME_DA_FUNÇÃO',
  value: valor_atual,
  target: valor_alvo,
  diff: Math.abs(value - target),
  tolerance: tolerância_aplicada,
  result: score_calculado,
  condition: 'condição_aplicada',
  // ... campos específicos por função
}
```

---

## 🔧 ARQUIVOS MODIFICADOS

- ✅ `public/audio-analyzer-integration.js` (13.297 linhas → 13.330+ linhas)

**Total de logs adicionados:** 8 blocos de auditoria (7 funções + 1 log final)

---

## 🎓 CONCLUSÃO

Com essa auditoria aplicada, será possível:

1. **Confirmar o diagnóstico:** Ver se `frequencia: null` realmente ocorre
2. **Identificar valores exatos:** Ver `diff`, `tolerance` e `ratio` em tempo real
3. **Rastrear fluxo completo:** Da métrica individual até o score final
4. **Validar cálculo ponderado:** Confirmar multiplicação de pesos
5. **Detectar outros problemas:** Cache, modo incorreto, tolerâncias erradas

**Próximo passo:** Executar análise e coletar logs do console. 🚀

---

**FIM DO RELATÓRIO**
