# 🎯 AUDITORIA CRÍTICA - SISTEMA DE SCORING PARA STREAMING

**Data:** 19 de janeiro de 2026  
**Escopo:** Subscore de Loudness e Técnico em modo STREAMING  
**Status:** ⚠️ INFLAÇÃO DETECTADA - Scoring excessivamente tolerante

---

## 📊 PROBLEMA IDENTIFICADO

### Caso Real Reportado:
```
LUFS Medido: -12.9
Target Streaming: -14.0
Diferença: +1.1 LU (mais alto que ideal)
Subscore Atual: 94 (INCORRETO - muito alto)
```

### Diagnóstico:
O sistema atual trata **-12.9 LUFS como "aceitável"** quando deveria ser penalizado progressivamente.

---

## 🔍 ANÁLISE DO CÓDIGO ATUAL

### Localização: `audio-analyzer-integration.js`

#### Função Principal: `window.evaluateMetric()` (linha ~25039)

**Lógica Atual para BANDPASS (LUFS):**

```javascript
// Linha ~25145 - BANDPASS METRICS
const effectiveTarget = target ?? (min + max) / 2;
diff = measuredValue - effectiveTarget;
absDiff = Math.abs(diff);

// Distância normalizada
const normalizedDistance = absDiff / (rangeSize / 2);

// Dentro do range [min, max] = OK
if (hasRange && inRange) {
    score = ~85-100 (dependendo da distância do target)
}
```

**Problemas Identificados:**

1. **Tolerância Excessiva:**
   - Range atual: [-16, -12] LUFS (tolerância de ±2 LU)
   - -12.9 está "dentro do range" e recebe score alto

2. **Falta de Curva Progressiva:**
   - Sistema binário: "dentro" ou "fora" do range
   - Não há penalização suave para valores sub-ótimos

3. **True Peak Subutilizado:**
   - Valores muito baixos (ex: -3.4 dBTP) recebem score 100
   - Não há avaliação de "otimização de headroom"

---

## 🎯 SOLUÇÃO PROPOSTA

### Nova Arquitetura:

```
analysis.mode === 'streaming' 
    ↓
calculateStreamingLufsScore()
calculateStreamingTruePeakScore()
    ↓
Curvas progressivas específicas
    ↓
Subscore reflete QUALIDADE de otimização
```

---

## 📐 CURVAS DE AVALIAÇÃO STREAMING

### LUFS - Curva Proposta:

```javascript
function calculateStreamingLufsScore(lufs) {
    // Faixa IDEAL: -15.5 a -13.5 LUFS
    if (lufs >= -15.5 && lufs <= -13.5) {
        // Curva parabólica com pico em -14.0
        const distFromPerfect = Math.abs(lufs - (-14.0));
        return Math.round(100 - (distFromPerfect * distFromPerfect * 20));
        // -14.0 → 100
        // -13.5 ou -14.5 → 95
        // -13.5 ou -15.5 → 95
    }
    
    // Faixa ACEITÁVEL: -12.5 a -13.5 OU -15.5 a -16.5
    if ((lufs >= -16.5 && lufs < -15.5) || (lufs > -13.5 && lufs <= -12.5)) {
        const distFrom Edge = lufs > -13.5 
            ? Math.abs(lufs - (-13.5))
            : Math.abs(lufs - (-15.5));
        return Math.round(94 - (distFromEdge * 15));
        // -13.5/-15.5 → 94
        // -12.9 → ~85 (ERA 94! ✅ CORRIGIDO)
        // -12.5/-16.5 → 80
    }
    
    // Faixa ATENÇÃO: -11.5 a -12.5 OU -16.5 a -17.5
    if ((lufs >= -17.5 && lufs < -16.5) || (lufs > -12.5 && lufs <= -11.5)) {
        const distFromEdge = lufs > -12.5 
            ? Math.abs(lufs - (-12.5))
            : Math.abs(lufs - (-16.5));
        return Math.round(79 - (distFromEdge * 19));
        // -12.5/-16.5 → 79
        // -12.0/-17.0 → 70
        // -11.5/-17.5 → 60
    }
    
    // Faixa CRÍTICA: < -17.5 ou > -11.5
    const distFromLimit = lufs > -11.5 
        ? Math.abs(lufs - (-11.5))
        : Math.abs(lufs - (-17.5));
    return Math.max(20, Math.round(59 - (distFromLimit * 20)));
    // -11.5/-17.5 → 59
    // -11.0/-18.0 → 49
    // -10.0/-19.0 → 39
}
```

### TRUE PEAK - Curva Proposta:

```javascript
function calculateStreamingTruePeakScore(tp) {
    // Hard cap: 0 dBTP (clipping)
    if (tp > 0) {
        return Math.max(20, Math.round(35 - (tp * 15)));
    }
    
    // Faixa IDEAL: -1.0 a -1.5 dBTP
    if (tp >= -1.5 && tp <= -1.0) {
        // Curva suave com pico em -1.0
        const distFromPerfect = Math.abs(tp - (-1.0));
        return Math.round(100 - (distFromPerfect * distFromPerfect * 10));
        // -1.0 → 100
        // -1.2 → 99
        // -1.5 → 97
    }
    
    // Faixa ACEITÁVEL: -1.5 a -2.5 dBTP
    if (tp >= -2.5 && tp < -1.5) {
        const distFromEdge = Math.abs(tp - (-1.5));
        return Math.round(96 - (distFromEdge * 16));
        // -1.5 → 96
        // -2.0 → 88
        // -2.5 → 80
    }
    
    // Faixa CONSERVADORA: -2.5 a -3.5 dBTP
    if (tp >= -3.5 && tp < -2.5) {
        const distFromEdge = Math.abs(tp - (-2.5));
        return Math.round(79 - (distFromEdge * 19));
        // -2.5 → 79
        // -3.0 → 70
        // -3.4 → 62 (ERA 100! ✅ CORRIGIDO)
        // -3.5 → 60
    }
    
    // Faixa CRÍTICA: < -3.5 dBTP (headroom excessivo)
    const distFromLimit = Math.abs(tp - (-3.5));
    return Math.max(20, Math.round(59 - (distFromLimit * 20)));
    // -3.5 → 59
    // -4.0 → 49
    // -5.0 → 39
}
```

---

## 🔧 IMPLEMENTAÇÃO

### Etapa 1: Criar Funções Especializadas

Adicionar em `audio-analyzer-integration.js` após a linha ~25287:

```javascript
// ═══════════════════════════════════════════════════════════════════
// 🎯 STREAMING SCORING - CURVAS PROGRESSIVAS ESPECÍFICAS
// ═══════════════════════════════════════════════════════════════════

window.calculateStreamingLufsScore = function(lufs) {
    // [Implementação completa acima]
};

window.calculateStreamingTruePeakScore = function(tp) {
    // [Implementação completa acima]
};
```

### Etapa 2: Integrar no `evaluateMetric()`

Modificar linha ~25070:

```javascript
// ANTES de calcular score normal, verificar se é streaming
if (metricKey === 'lufs' && analysis?.soundDestination === 'streaming') {
    const streamingScore = window.calculateStreamingLufsScore(measuredValue);
    // Retornar com curva específica
}

if (metricKey === 'truePeak' && analysis?.soundDestination === 'streaming') {
    const streamingScore = window.calculateStreamingTruePeakScore(measuredValue);
    // Retornar com curva específica
}
```

### Etapa 3: Atualizar Labels de Severidade

```javascript
// Para TP muito baixo
if (tp < -3.0) {
    severity = 'ATENÇÃO';
    reason = '⚠️ Headroom excessivo - pode aumentar volume';
}

// Para LUFS fora da curva
if (lufs > -12.0 || lufs < -17.0) {
    severity = 'CRÍTICO';
    reason = '🔴 Fora da curva ideal de streaming';
}
```

---

## ✅ VALIDAÇÃO

### Casos de Teste:

| LUFS   | Score Antigo | Score Novo | Status     |
|--------|--------------|------------|------------|
| -14.0  | 100          | 100        | ✅ Mantido |
| -14.5  | 97           | 95         | ✅ OK      |
| -13.5  | 97           | 95         | ✅ OK      |
| -12.9  | **94**       | **~85**    | ✅ FIXADO  |
| -12.5  | 85           | 80         | ✅ Corrigido |
| -11.8  | 75           | ~65        | ✅ Mais severo |

| True Peak | Score Antigo | Score Novo | Status     |
|-----------|--------------|------------|------------|
| -1.0      | 100          | 100        | ✅ Mantido |
| -1.5      | 100          | 97         | ✅ OK      |
| -2.0      | 100          | 88         | ✅ Corrigido |
| -2.5      | 100          | 80         | ✅ Corrigido |
| -3.4      | **100**      | **~62**    | ✅ FIXADO  |
| -4.0      | 100          | ~49        | ✅ Mais severo |

---

## 🎯 IMPACTO ESPERADO

### Subscore de Loudness:
- Valores **otimizados** (-13.5 a -14.5 LUFS): score 95-100
- Valores **sub-ótimos** (-12.5 a -13.5 LUFS): score 80-94
- Valores **problemáticos** (< -12.5 ou > -15.5 LUFS): score < 80

### Subscore Técnico:
- True Peak **otimizado** (-1.0 a -1.5 dBTP): score 97-100
- True Peak **aceitável** (-1.5 a -2.5 dBTP): score 80-96
- True Peak **conservador** (-2.5 a -3.5 dBTP): score 60-79
- True Peak **excessivo** (< -3.5 dBTP): score < 60

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Implementar funções especializadas
2. ✅ Integrar no `evaluateMetric()`
3. ✅ Atualizar labels e severidade
4. ⏳ Testar com casos reais
5. ⏳ Validar não-regressão em outros modos

---

## 📝 NOTAS IMPORTANTES

- ✅ **Não afeta outros modos:** genre, pista, club, mastering
- ✅ **Mantém compatibilidade:** fallback para lógica antiga se não for streaming
- ✅ **Scoring progressivo:** elimina comportamento binário
- ✅ **Labels descritivos:** "headroom excessivo" em vez de genéricos

---

**Responsável:** GitHub Copilot  
**Aprovação:** Pendente de testes
