# 🔍 AUDITORIA & CORREÇÃO: Score Engine V3

**Data:** 2025-12-28  
**Status:** ✅ CORRIGIDO  
**Versão:** 3.2.0-v3-global

---

## 📋 PROBLEMA ORIGINAL

O usuário reportou:
- **True Peak:** +4.70 dBTP (alvo: -1.0 dBTP, diferença: +5.70)
- **LUFS:** -3.35 (alvo: -10.5, diferença: +7.15)
- **Score Final:** 73% (INCOERENTE!)
- **Subscores altos** mesmo com métricas críticas

**Comportamento esperado:** Score ≤ 35% e classificação "Inaceitável"

---

## 🔬 DIAGNÓSTICO

### A) Mapeamento do Pipeline

Foram identificados **dois pipelines separados** de cálculo de score:

| Pipeline | Arquivo | Método |
|----------|---------|--------|
| **A** | `audio-analyzer.js` | `import('/lib/audio/features/scoring.js')` ✅ |
| **B** | `audio-analyzer-integration.js` | `window.computeMixScore()` ❌ |

### B) Problema de Integração

O `scoring.js` usava `export { computeMixScore }` mas **NÃO** expunha `window.computeMixScore`.  
Resultado: O Pipeline B chamava uma função **inexistente** ou usava fallback diferente.

### C) Gates V3 Corretos mas Não Aplicados

A função `_applyV3GatesSynchronously()` estava implementada corretamente com:
- `TRUE_PEAK_CRITICAL`: TP > 0 dBTP → cap 35%
- `TRUE_PEAK_CLIPPING`: TP > max do modo → cap 30%
- `CLIPPING_SEVERE`: > 5% → cap 40%
- `LUFS_EXCESSIVE`: > max + margem → cap 50%

**Porém**, esses gates não eram aplicados quando `window.computeMixScore` não existia.

---

## 🔧 CORREÇÕES APLICADAS

### 1. Expor `computeMixScore` no Window

**Arquivo:** `public/lib/audio/features/scoring.js`  
**Linha:** ~1710

```javascript
// 🚨 CRÍTICO: EXPOR computeMixScore NO WINDOW
window.computeMixScore = computeMixScore;
console.info('[SCORING] ✅ window.computeMixScore exposto globalmente');
```

### 2. Carregar `scoring.js` como Módulo no HTML

**Arquivo:** `public/index.html`

```html
<!-- 🚨 SCORING.JS - MÓDULO PRINCIPAL DE CÁLCULO -->
<script type="module" src="/lib/audio/features/scoring.js?v=3.2.0"></script>
```

### 3. Gate Absoluto para TP > 0 dBTP

**Arquivo:** `public/lib/audio/features/scoring.js`

Adicionado gate crítico que SEMPRE aciona independente do modo:

```javascript
const tpAbsoluteMax = 0; // Nunca aceitar TP positivo

if (truePeak !== null && truePeak > tpAbsoluteMax) {
  gates.push({ type: 'TRUE_PEAK_CRITICAL', ... });
  finalScoreCap = Math.min(finalScoreCap, 35);
  classificationOverride = 'Inaceitável';
}
```

### 4. Debug e Logs Aprimorados

Adicionado log detalhado para diagnóstico:

```javascript
console.log('[HARD_GATE] 📊 Valores extraídos:', {
  truePeak, clipping, dcOffset, lufs, mode,
  technicalDataKeys: Object.keys(technicalData)
});
```

### 5. Função de Teste de Aceitação

**Uso:** `window.testScoringGates()` no console

Testa os 4 casos críticos:
1. TP +4.7 dBTP → score ≤ 35%
2. TP -1.0 dBTP → score ≥ 60%
3. Clipping 10% → score ≤ 40%
4. LUFS -6.0 → score ≤ 50%

---

## 📁 ARQUIVOS ALTERADOS

| Arquivo | Alteração |
|---------|-----------|
| `public/lib/audio/features/scoring.js` | Versão 3.2.0 - Expor window.computeMixScore, gate absoluto TP, testes |
| `lib/audio/features/scoring.js` | Sincronizado |
| `public/index.html` | Adicionado carregamento de scoring.js como módulo |

---

## ✅ VALIDAÇÃO

### Comandos de Teste

1. **Verificar carregamento:**
```javascript
console.log('computeMixScore:', typeof window.computeMixScore);
// Esperado: "function"
```

2. **Executar testes de gates:**
```javascript
window.testScoringGates();
// Esperado: 4/4 testes passam
```

3. **Verificar debug do último score:**
```javascript
console.log(window.__lastScoreDebug);
// Mostra: gates, caps, valores brutos
```

### Caso de Teste Principal

Entrada equivalente ao problema reportado:
```javascript
const result = window.computeMixScore({
  truePeakDbtp: 4.7,
  lufsIntegrated: -3.35
}, null, { mode: 'streaming' });

console.log(result.scorePct);        // ≤ 35
console.log(result.classification);  // "Inaceitável"
console.log(result.gatesTriggered);  // [{ type: 'TRUE_PEAK_CRITICAL', ... }]
```

---

## 🎯 RESULTADO ESPERADO

| Métrica | Valor | Gate | Score Max |
|---------|-------|------|-----------|
| TP > 0 dBTP | +4.7 | TRUE_PEAK_CRITICAL | 35% |
| LUFS -6.0 | excessivo | LUFS_EXCESSIVE | 50% |
| Clipping 10% | severo | CLIPPING_SEVERE | 40% |

**Combinação:** O gate mais restritivo vence → Score final ≤ 35%

---

## 📝 NOTAS

- A tabela de comparação **não foi alterada** (já estava correta)
- Os subscores ainda podem ser altos individualmente, mas o **score final** será capado
- O `window.__lastScoreDebug` sempre contém informações de diagnóstico
- Use `window.testScoringGates()` para validar antes de produção
