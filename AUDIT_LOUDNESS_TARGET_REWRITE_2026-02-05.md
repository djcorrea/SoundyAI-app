# 🎯 AUDITORIA: Reescrita Completa do Cálculo de Loudness Target
**Data:** 2026-02-05  
**Fase:** 16 - Paradigm Shift  
**Branch:** automasterv1  
**Arquivos alterados:** decision-engine.cjs, automaster-v1.cjs

---

## 📋 RESUMO EXECUTIVO

### Mudança Fundamental
**ANTES:** Ganho limitado pelo True Peak inicial  
**DEPOIS:** Ganho baseado em limiter stress aceitável por modo

### Princípio Revolucionário
```
effectiveHeadroom = headroom inicial + compressão aceitável do limiter + redistribuição loudnorm
```

**"O True Peak inicial NÃO é limite final de loudness"**

---

## 🎯 PROBLEMA IDENTIFICADO

### Filosofia Anterior (Fases 1-15)
```javascript
// LIMITAÇÃO CONSERVADORA
const maxGainByTP = Math.abs(truePeak) - 1.2;
let allowedOffset = Math.min(formula, maxGainByTP);  // ❌ Limitado por TP
```

**Consequência:**  
- Mix com -20 LUFS e -3 dBTP só podia subir ~1.8 dB
- Modo HIGH não conseguia atingir targets agressivos
- Limitação artificial impedindo uso correto do limiter

### Exemplo Prático
**Input:** -20 LUFS, -3 dBTP, modo HIGH  
**Target desejado:** -12 LUFS (+8 dB)  
**Resultado anterior:** ~-18 LUFS (limitado pelo TP inicial)  
**Resultado novo:** -12 LUFS (permite 6 dB de limiter stress)

---

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Limiter Stress por Modo
```javascript
// decision-engine.cjs linha ~154
let limiterStressPermitido = 4.0;  // Default MEDIUM
if (modeKey === 'LOW') limiterStressPermitido = 2.0;
else if (modeKey === 'MEDIUM') limiterStressPermitido = 4.0;
else if (modeKey === 'HIGH') limiterStressPermitido = 6.0;

const effectiveHeadroom = headroom + limiterStressPermitido;
```

**Explicação:**  
- LOW: 2 dB de compressão limiter aceitável (conservador)
- MEDIUM: 4 dB de compressão limiter aceitável (equilibrado)
- HIGH: 6 dB de compressão limiter aceitável (agressivo)

### 2. Targets Dinâmicos por Faixa de LUFS

#### Estratégia 1: Mix Muito Baixa (< -18 LUFS)
```javascript
strategy = 'aggressive_push';
let maxTarget = -13.0;  // Default MEDIUM
if (modeKey === 'LOW') maxTarget = -14.0;
else if (modeKey === 'MEDIUM') maxTarget = -13.0;
else if (modeKey === 'HIGH') maxTarget = -12.0;

const gainAllowed = effectiveHeadroom;
const gainToTarget = maxTarget - currentLUFS;
const gainFinal = Math.min(gainToTarget, gainAllowed);
```

**Objetivo:** Subir máximo possível até stress limite do limiter

#### Estratégia 2: Mix Média (-18 a -13 LUFS)
```javascript
strategy = 'moderate_push';
let targetRange = { min: -13.0, max: -12.0 };  // MEDIUM
if (modeKey === 'LOW') targetRange = { min: -14.0, max: -13.0 };
else if (modeKey === 'MEDIUM') targetRange = { min: -13.0, max: -12.0 };
else if (modeKey === 'HIGH') targetRange = { min: -12.0, max: -11.0 };

const gainAllowed = effectiveHeadroom * 0.8;  // 80% do headroom
const idealTarget = (targetRange.max + targetRange.min) / 2;
```

**Objetivo:** Subida moderada baseada em capacidade real

#### Estratégia 3: Mix Alta (> -13 LUFS)
```javascript
strategy = 'preserve';
const maxGain = 1.0;
const safeGain = Math.min(effectiveHeadroom * 0.3, maxGain);
targetLUFS = currentLUFS + safeGain;
```

**Objetivo:** Preservar dinâmica, apenas correção leve

### 3. Remoção da Hierarquia de Offsets Fixos

**REMOVIDO (linhas 270-296):**
```javascript
// ❌ ANTIGO - Contraditório com Phase 15
if (modeKey === 'LOW') {
  if (offsetWithHierarchy > 2.0) offsetWithHierarchy = 2.0;
}
// Similar para MEDIUM (4.0) e HIGH (6.0)
```

**Motivo:** Negava aumentos de maxOffsetLU da Phase 15 (4/8/12 LU)

### 4. Regra Absoluta de Transiente

**automaster-v1.cjs linha ~2750:**
```javascript
// ANTES: if (cfDrop > 1.5)
// DEPOIS: if (cfDrop > 2.0)  // 🎯 REGRA ABSOLUTA

if (cfDrop > 2.0) {
  console.log('   ⚠️ CF drop excessivo detectado (>2.0 dB)');
  console.log('   Ação: Reduzir gain progressivamente para proteger transientes');
```

**Threshold aumentado de 1.5 → 2.0 dB** para permitir mais headroom antes de redução

### 5. Pre-Gain Baseado em Limiter Stress

**automaster-v1.cjs linha ~2434:**
```javascript
// ANTES:
// const maxGainByTP = Math.abs(measuredTP) - 1.2;
// const preGainMax = maxGainByTP + 1.5;

// DEPOIS:
const headroom = Math.abs(measuredTP);
let preGainLimiterStress = 2.0;  // Default (MEDIUM / 2)
if (args.mode === 'LOW') preGainLimiterStress = 1.0;
else if (args.mode === 'MEDIUM') preGainLimiterStress = 2.0;
else if (args.mode === 'HIGH') preGainLimiterStress = 3.0;

const preGainMax = headroom + preGainLimiterStress;
```

**Conservadorismo:** Pre-gain usa 50% do limiter stress (1/2/3 vs 2/4/6) porque loudnorm fará ajuste fino depois

---

## 🔧 ARQUIVOS MODIFICADOS

### decision-engine.cjs
**Linhas modificadas:** 140-320 (completa reescrita da seção de cálculo)

**Mudanças:**
1. ❌ Removido `maxGainByTP` (linha ~154)
2. ✅ Adicionado `limiterStressPermitido` por modo
3. ✅ Adicionado `effectiveHeadroom` calculation
4. ❌ Removida limitação `allowedOffset = Math.min(formula, maxGainByTP)`
5. ✅ Implementadas 3 estratégias dinâmicas (aggressive/moderate/preserve)
6. ❌ Removida hierarquia de offsets fixos (2/4/6)
7. ✅ Target calculation baseado em faixa de LUFS

### automaster-v1.cjs
**Linhas modificadas:** 2434-2455 (pre-gain), 2750 (transient threshold)

**Mudanças:**
1. ❌ Removido `maxGainByTP` do pre-gain
2. ✅ Adicionado `preGainLimiterStress` (50% do limiter stress)
3. ✅ Pre-gain baseado em `headroom + preGainLimiterStress`
4. ✅ CF drop threshold aumentado de 1.5 → 2.0 dB

---

## 📊 COMPARAÇÃO ANTES/DEPOIS

### Cenário 1: Mix Baixa com Headroom
**Input:** -20 LUFS, -3 dBTP, CF 12 dB, modo HIGH

| Métrica | ANTES (Phase 15) | DEPOIS (Phase 16) |
|---------|------------------|-------------------|
| Headroom inicial | 3.0 dB | 3.0 dB |
| Max gain by TP | 1.8 dB | N/A (removido) |
| Limiter stress | N/A | 6.0 dB |
| Effective headroom | 3.0 dB | 9.0 dB |
| Target permitido | ~-18 LUFS | -12 LUFS |
| Resultado esperado | Conservador | **Agressivo** ✅ |

### Cenário 2: Mix Média
**Input:** -16 LUFS, -2 dBTP, CF 10 dB, modo MEDIUM

| Métrica | ANTES | DEPOIS |
|---------|-------|--------|
| Effective headroom | 2.0 dB | 6.0 dB (2+4) |
| Target estratégia | Offset fixo +4 LU | Moderate push |
| Target range | -12 LUFS | -13 a -12 LUFS |
| Resultado | Limitado por TP | **Dinâmico** ✅ |

### Cenário 3: Mix Alta (Preservação)
**Input:** -11 LUFS, -1 dBTP, CF 14 dB, modo LOW

| Métrica | ANTES | DEPOIS |
|---------|-------|--------|
| Estratégia | Offset fixo | **Preserve** |
| Max gain | 2.0 LU (hierarchy) | 1.0 dB (explícito) |
| Objetivo | Aumentar loudness | **Preservar dinâmica** ✅ |

---

## 🧪 VALIDAÇÃO

### Sintaxe
```bash
✅ decision-engine.cjs: No errors found
✅ automaster-v1.cjs: No errors found
```

### Lógica de Controle
1. ✅ Limiter stress limits implementados (2/4/6 dB)
2. ✅ Estratégias dinâmicas por faixa de LUFS
3. ✅ CF drop threshold absoluto (2.0 dB)
4. ✅ Pre-gain conservador (50% limiter stress)
5. ✅ Hierarquia de offsets removida

### Casos de Teste Esperados

**Teste 1: Mix -20 LUFS, modo HIGH**
- Estratégia: `aggressive_push`
- Target: -12 LUFS
- Ganho permitido: headroom + 6 dB
- **Esperado:** Deve alcançar ~-12 LUFS mesmo com 4-6 dB de compressão limiter

**Teste 2: Mix -15 LUFS, modo MEDIUM**
- Estratégia: `moderate_push`
- Target range: -13 a -12 LUFS
- Ganho permitido: 80% do effective headroom
- **Esperado:** Target intermediário sem estressar limiter excessivamente

**Teste 3: Mix -11 LUFS, modo LOW**
- Estratégia: `preserve`
- Max gain: 1.0 dB
- **Esperado:** Apenas correção leve, dinâmica preservada

---

## 🔐 SEGURANÇA E GUARDRAILS

### Proteções Mantidas
1. ✅ **Saturation fallback** (delta < 0.7 LU, CF < 10 dB)
2. ✅ **Tone priority fallback** (CF < 8 dB)
3. ✅ **Transient protection** (CF drop > 2.0 dB)
4. ✅ **NaN validation** em todos os cálculos
5. ✅ **Metrics validation** pós-loudnorm com fallback

### Novos Limites Físicos
- **Limiter stress:** 2/4/6 dB por modo (controle fino)
- **CF drop absoluto:** > 2.0 dB trigger reduction
- **Mix alta:** Max 1.0 dB gain para preservar dinâmica

---

## 📚 CONTEXTO HISTÓRICO

### Phase 14 (Bug Fixes)
- Cap dinâmico por modo (-10/-9/-8)
- Regra para mix baixa (< -18 LUFS)
- NaN protection
- Tone priority para mix alta (> -12 LUFS)

### Phase 15 (Dynamic Gain Unlock)
- Mode limits aumentados (4/8/12 LU)
- maxGainByTP calculation
- Pre-gain unlock com `maxGainByTP + 1.5`
- **BUG:** Hierarquia de offsets ainda clamping em 2/4/6

### Phase 16 (Loudness Target Rewrite) ⬅️ **ATUAL**
- ❌ Removida TODA lógica baseada em TP
- ✅ Limiter stress como limite real
- ✅ Targets dinâmicos por faixa de LUFS
- ✅ CF drop threshold 1.5 → 2.0 dB
- ✅ Hierarquia de offsets removida
- ✅ Pre-gain baseado em limiter stress

---

## 🎯 IMPACTO ESPERADO

### Positivo
1. **Loudness real:** Mix baixa pode alcançar targets comerciais (-12/-13 LUFS)
2. **Uso correto do limiter:** 2-6 dB de compressão aceitável por modo
3. **Flexibilidade:** Targets dinâmicos adaptam-se ao input
4. **Previsibilidade:** Modo HIGH sempre mais agressivo que MEDIUM que LOW

### Riscos Mitigados
1. **Over-limiting:** CF drop > 2.0 dB trigger protection
2. **Over-saturation:** Saturation fallback mantido
3. **Tone loss:** Preservação explícita para mix alta (> -13 LUFS)
4. **Transient loss:** Transient protection mantida e refinada

---

## 📝 PRÓXIMOS PASSOS

### Testes Recomendados
1. ⏳ Testar mix -20 LUFS modo HIGH (deve alcançar ~-12 LUFS)
2. ⏳ Verificar CF drop com mix dinâmica (threshold 2.0 dB)
3. ⏳ Validar preservação em mix alta (> -13 LUFS)
4. ⏳ Confirmar diferenciação LOW vs MEDIUM vs HIGH

### Ajustes Potenciais
- Ajustar limiter stress values se necessário (2/4/6 → ?)
- Refinar target ranges por modo
- Ajustar % do effective headroom usado (0.8 → ?)

---

## ✅ CONCLUSÃO

**Reescrita fundamental completa.**  
Removida limitação conservadora por True Peak inicial.  
Implementado sistema baseado em limiter stress aceitável.  
Targets dinâmicos adaptam estratégia ao contexto do input.  

**Status:** ✅ Implementado e validado (sintaxe)  
**Próximo:** Testes práticos com diferentes tipos de mix

---

**Engenheiro responsável:** GitHub Copilot (Claude Sonnet 4.5)  
**Auditoria:** AUDIT_LOUDNESS_TARGET_REWRITE_2026-02-05.md
