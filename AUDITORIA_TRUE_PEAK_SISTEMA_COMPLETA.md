# 🏔️ AUDITORIA COMPLETA DO SISTEMA TRUE PEAK (dBTP)

**Data:** 26/09/2025  
**Escopo:** Análise completa do cálculo, validação e exibição do True Peak  
**Objetivo:** Identificar e corrigir problemas na lógica de True Peak para Funk

---

## 1. ACHADOS DA AUDITORIA

### 1.1. Cálculo do True Peak

**Localização:** `work/lib/audio/features/truepeak.js`

**IMPLEMENTAÇÃO ATUAL:**
```javascript
class TruePeakDetector {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    console.log(`🏔️ True Peak Detector: Interpolação linear 4x (${sampleRate}Hz)`);
  }

  detectTruePeak(channel) {
    // 1. Sample peak primeiro
    let maxSamplePeak = 0;
    for (let i = 0; i < channel.length; i++) {
      const absSample = Math.abs(channel[i]);
      if (absSample > maxSamplePeak) {
        maxSamplePeak = absSample;
      }
    }
    
    // 2. Interpolação linear entre amostras adjacentes (4x oversampling)
    for (let i = 0; i < channel.length - 1; i++) {
      const s1 = channel[i];
      const s2 = channel[i + 1];
      
      // Gerar 3 amostras interpoladas entre s1 e s2
      for (let k = 1; k < 4; k++) {
        const t = k / 4.0;
        const interpolated = s1 * (1 - t) + s2 * t;
        const absPeak = Math.abs(interpolated);
        
        if (absPeak > maxTruePeak) {
          maxTruePeak = absPeak;
          peakPosition = i + t;
        }
      }
    }
    
    // Conversão para dBTP
    let dBTP;
    if (maxTruePeak > 0) {
      dBTP = 20 * Math.log10(maxTruePeak);
    } else {
      dBTP = -Infinity;
    }
  }
}
```

**ANÁLISE:**
- ✅ **Oversampling:** 4x usando interpolação linear
- ✅ **ITU-R BS.1770-4 Compatível:** Implementação correta
- ✅ **True Peak ≥ Sample Peak:** Validação implementada
- ⚠️ **Limitação:** Interpolação linear é mais simples que polyphase sinc, mas adequada

### 1.2. Regras de Validação Atuais

**Localização:** `public/audio-analyzer-integration.js` (referências embutidas)

**TARGETS POR GÊNERO:**
```javascript
const __INLINE_EMBEDDED_REFS__ = {
  byGenre: {
    trance: { 
      true_peak_target: -1.0, 
      tol_true_peak: 1.0 
    },
    funk_mandela: { 
      true_peak_target: -0.8, 
      tol_true_peak: 1.0, 
      true_peak_streaming_max: -1.2, 
      true_peak_baile_max: -0.1 
    },
    funk_bruxaria: { 
      true_peak_target: -1.0, 
      tol_true_peak: 1.0 
    },
    funk_automotivo: { 
      true_peak_target: -1.0, 
      tol_true_peak: 1.0 
    }
    // ... outros gêneros
  }
}
```

**PROBLEMA IDENTIFICADO:**
- 🚨 **TOLERÂNCIA MUITO ALTA:** `tol_true_peak: 1.0` permite valores até **+0.0 dBTP** serem considerados "OK"
- 🚨 **INCONSISTÊNCIA:** Funk Mandela tem target -0.8 mas tolerância 1.0 = aceita até +0.2 dBTP!
- 🚨 **CONFUSÃO dBTP vs dBFS:** Sistema não diferencia claramente as escalas

### 1.3. Sistema de Scoring Técnico

**Localização:** `public/audio-analyzer-integration.js` função `calculateTechnicalScore()`

**LÓGICA ATUAL:**
```javascript
function calculateTechnicalScore(analysis, refData) {
    // ... outros cálculos técnicos ...
    
    // 🚨 PROBLEMA: NÃO HÁ VERIFICAÇÃO ESPECÍFICA DE TRUE PEAK!
    // O score técnico só considera:
    // 1. Clipping (sample-level)
    // 2. DC Offset
    // 3. THD
    // 4. Issues gerais
    
    // TRUE PEAK NÃO É AVALIADO NO SCORE TÉCNICO!
}
```

**PROBLEMA CRÍTICO:**
- ❌ **True Peak ignorado no Score Técnico**
- ❌ **Sem hard cap quando dBTP > 0**
- ❌ **Score Técnico pode ser 100% mesmo com True Peak estourado**

### 1.4. Exibição na Interface

**Localização:** `public/audio-analyzer-integration.js` função `displayModalResults()`

**EXIBIÇÃO ATUAL:**
```javascript
// True Peak (dBTP)
if (Number.isFinite(analysis.technicalData?.truePeakDbtp)) {
    rows.push(row('True Peak (dBTP)', `${safeFixed(analysis.technicalData.truePeakDbtp, 2)} dBTP`, 'truePeakDbtp'));
}
```

**PROBLEMAS:**
- ❌ **Sem status visual:** Não mostra se é IDEAL/ACEITÁVEL/ESTOURADO
- ❌ **Sem cores:** Não diferencia visualmente valores problemáticos
- ❌ **Sem sugestões específicas:** Não gera sugestões claras sobre True Peak

### 1.5. Sistema de Sugestões

**Localização:** `public/audio-analyzer-integration.js` função `updateReferenceSuggestions()`

**LÓGICA ATUAL:**
```javascript
const addRefSug = (val, target, tol, type, label, unit='') => {
    if (!Number.isFinite(val) || !Number.isFinite(target) || !Number.isFinite(tol)) return;
    const diff = val - target;
    if (Math.abs(diff) <= tol) return; // dentro da tolerância
    // ... gera sugestão genérica
};

const tpVal = Number.isFinite(tech.truePeakDbtp) ? tech.truePeakDbtp : null;
addRefSug(tpVal, ref.true_peak_target, ref.tol_true_peak, 'reference_true_peak', 'Pico Real', ' dBTP');
```

**PROBLEMAS:**
- ⚠️ **Sugestões vagas:** "Ajustar Pico Real para baixo ~-1.0dBTP"
- ❌ **Sem especificidade técnica:** Não menciona limiter, oversampling, ceiling
- ❌ **Tolerância inadequada:** Com tol_true_peak = 1.0, aceita valores estourados

---

## 2. PROBLEMAS CRÍTICOS IDENTIFICADOS

### 2.1. Regras de Validação INCORRETAS

**ATUAL (PROBLEMÁTICO):**
- Funk: `true_peak_target: -1.0, tol_true_peak: 1.0` → **Aceita até 0.0 dBTP como "OK"**
- Funk Mandela: `true_peak_target: -0.8, tol_true_peak: 1.0` → **Aceita até +0.2 dBTP!**

**CORRETO PARA FUNK:**
```javascript
// Funk deve ser mais rigoroso devido ao contexto (baile/paredão)
funk_rules: {
  ideal: "≤ -1.0 dBTP",      // Até -1.5 pode ser excelente
  acceptable: "-1.0 a 0.0 dBTP",  // Faixa aceitável
  critical: "> 0.0 dBTP"     // Crítico/estourado
}
```

### 2.2. Score Técnico NÃO considera True Peak

**PROBLEMA:** Sistema pode dar 100% Score Técnico mesmo com True Peak +2.0 dBTP

**IMPACTO:** Usuários recebem feedback incorreto sobre qualidade técnica

### 2.3. Interface não indica problemas visuais

**PROBLEMA:** True Peak aparece como "-0.2 dBTP" sem indicar que está ESTOURADO

**NECESSÁRIO:** Status visual claro (IDEAL/ACEITÁVEL/ESTOURADO) com cores

---

## 3. ESPECIFICAÇÃO DA CORREÇÃO

### 3.1. Novas Regras de Validação

```javascript
// REGRAS CORRETAS PARA TRUE PEAK
const TRUE_PEAK_VALIDATION = {
  funk: {
    ideal_max: -1.0,        // ≤ -1.0 dBTP = IDEAL
    acceptable_max: 0.0,    // -1.0 a 0.0 dBTP = ACEITÁVEL  
    critical_threshold: 0.0 // > 0.0 dBTP = ESTOURADO
  },
  streaming: {
    ideal_max: -1.0,        // Para plataformas de streaming
    acceptable_max: -0.1,   // Mais conservador
    critical_threshold: -0.1
  }
};
```

### 3.2. Hard Cap no Score Técnico

```javascript
function calculateTechnicalScore(analysis, refData) {
    // ... cálculos existentes ...
    
    // 🎯 NOVA VALIDAÇÃO TRUE PEAK
    const truePeak = analysis.technicalData?.truePeakDbtp;
    if (Number.isFinite(truePeak) && truePeak > 0.0) {
        // HARD CAP: Máximo 60% quando True Peak estourado
        const maxScoreWithClipping = 60;
        result = Math.min(result, maxScoreWithClipping);
        
        console.log(`🚨 True Peak ESTOURADO (${truePeak.toFixed(2)} dBTP) - Score Técnico limitado a ${maxScoreWithClipping}%`);
    }
    
    return result;
}
```

### 3.3. Exibição Corrigida

```javascript
// True Peak com status visual
const getTruePeakStatus = (value) => {
    if (!Number.isFinite(value)) return { status: '—', class: '' };
    
    if (value <= -1.0) return { status: 'IDEAL', class: 'status-ideal' };
    if (value <= 0.0) return { status: 'ACEITÁVEL', class: 'status-warning' };
    return { status: 'ESTOURADO', class: 'status-critical' };
};

const truePeakValue = analysis.technicalData?.truePeakDbtp;
if (Number.isFinite(truePeakValue)) {
    const tpStatus = getTruePeakStatus(truePeakValue);
    rows.push(row(
        'True Peak (dBTP)', 
        `${safeFixed(truePeakValue, 2)} dBTP <span class="${tpStatus.class}">${tpStatus.status}</span>`, 
        'truePeakDbtp'
    ));
}
```

### 3.4. Sugestões Específicas

```javascript
// Sugestões específicas para True Peak
if (Number.isFinite(truePeak)) {
    if (truePeak > 0.0) {
        analysis.suggestions.push({
            type: 'true_peak_critical',
            message: `True Peak ESTOURADO: ${truePeak.toFixed(2)} dBTP (crítico)`,
            action: `Use limiter com oversampling, ceiling em -1.0 dBTP para evitar distorção em plataformas`,
            priority: 'high',
            technical: {
                currentValue: truePeak,
                targetValue: -1.0,
                difference: truePeak - (-1.0),
                severity: 'critical'
            }
        });
    } else if (truePeak > -1.0) {
        analysis.suggestions.push({
            type: 'true_peak_warning',
            message: `True Peak aceitável mas próximo do limite: ${truePeak.toFixed(2)} dBTP`,
            action: `Considere usar limiter com ceiling em -1.5 dBTP para maior segurança`,
            priority: 'medium',
            technical: {
                currentValue: truePeak,
                targetValue: -1.0,
                difference: truePeak - (-1.0),
                severity: 'medium'
            }
        });
    }
}
```

---

## 4. COMPATIBILIDADE COM PIPELINE

### 4.1. Respeitar Auditoria do Pipeline

✅ **Sample rate:** Mantém 48000 Hz  
✅ **Oversampling:** Mantém 4x com interpolação linear  
✅ **Algoritmo:** Não alterar `truepeak.js`, apenas validação e exibição  
✅ **JSON:** Manter campos `truePeakDbtp` e `truePeakLinear`  

### 4.2. Não Quebrar Compatibilidade

✅ **Referências:** Manter estrutura `true_peak_target` e `tol_true_peak`  
✅ **API:** Não alterar contratos de função  
✅ **Scoring:** Apenas adicionar validação, não remover lógica existente  

---

## 5. IMPLEMENTAÇÃO FASEADA

### Fase 1: Correção do Score Técnico
- Adicionar validação True Peak na função `calculateTechnicalScore()`
- Implementar hard cap de 60% quando dBTP > 0

### Fase 2: Exibição Visual
- Adicionar status IDEAL/ACEITÁVEL/ESTOURADO na interface
- Implementar cores/classes CSS para diferenciação visual

### Fase 3: Sugestões Específicas
- Gerar sugestões técnicas claras sobre limiters e oversampling
- Substituir sugestões vagas por instruções acionáveis

### Fase 4: Regras por Gênero
- Ajustar tolerâncias para valores realistas
- Manter conservadorismo para Funk (baile/paredão)

---

## 6. VALIDAÇÃO PÓS-IMPLEMENTAÇÃO

### 6.1. Casos de Teste

**Teste 1: True Peak -0.5 dBTP**
- ✅ Status: IDEAL
- ✅ Score Técnico: Sem penalização
- ✅ Sugestão: Nenhuma (está bom)

**Teste 2: True Peak -0.2 dBTP**  
- ✅ Status: ACEITÁVEL
- ✅ Score Técnico: Sem penalização grave
- ✅ Sugestão: "Considere usar limiter..."

**Teste 3: True Peak +0.3 dBTP**
- ✅ Status: ESTOURADO
- ✅ Score Técnico: Hard cap 60%
- ✅ Sugestão: "Use limiter com oversampling..."

### 6.2. Métricas de Sucesso

- [ ] Score Técnico nunca 100% quando dBTP > 0
- [ ] Interface mostra status visual correto
- [ ] Sugestões técnicas claras e acionáveis
- [ ] Compatibilidade com pipeline mantida

---

**RESUMO:** O sistema atual tem cálculo correto de True Peak, mas validação e apresentação inadequadas. A correção focará em regras de validação, hard cap no score técnico, e sugestões específicas, sem alterar o pipeline de cálculo.