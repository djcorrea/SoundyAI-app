# 🔍 AUDITORIA COMPLETA: SISTEMA DE SCORING E TOLERÂNCIAS

**Data**: 27 de setembro de 2025  
**Objetivo**: Auditar completamente o sistema de score (cores + número) e uso de tolerâncias para implementar score contínuo baseado em distância da tolerância.

---

## 📋 SUMÁRIO EXECUTIVO

### ✅ SITUAÇÃO ATUAL IDENTIFICADA

O sistema SoundyAI possui:
- **Score numérico**: Baseado em distância absoluta do alvo (problema identificado)
- **Cores RYG**: Baseadas em tolerâncias (funcionando corretamente)  
- **Tolerâncias**: Definidas por gênero/métrica na Tabela de Referências
- **Inconsistências**: Nomenclaturas duplicadas e lógica assimétrica

### 🎯 IMPLEMENTAÇÃO REQUERIDA

**Função única** para calcular score contínuo por tolerância:
- **Verde**: dentro da tolerância → score = 100
- **Amarelo**: fora da tolerância até buffer → score decresce de 100 → Y_MIN
- **Vermelho**: além do buffer → score decresce de Y_MIN → 0

---

## 📁 MAPA DE ARQUIVOS RELEVANTES

### 1. **CONFIGURAÇÕES E REFERÊNCIAS**

#### 📄 `config/scoring-v2-config.json` 
**Função**: Configuração principal de scoring com targets por gênero
- ✅ Contém targets e tolerâncias para todos os gêneros
- ✅ Definições de `tol_inner` e `tol_outer` (equivalem a tolerância e buffer)
- ✅ Métricas inventariadas com pesos
- ⚠️ **Problema**: Score usa lógica de desvio do alvo, não da tolerância

#### 📄 `public/refs/funk_mandela.json` (e outros gêneros)
**Função**: Tabelas de referência por gênero
- ✅ Contém `target_db`, `tol_db` para cada banda espectral
- ✅ Targets para LUFS, True Peak, DR, LRA, etc.
- ✅ Estrutura híbrida compatível com sistema legado

### 2. **CÁLCULO DE SCORE NUMÉRICO**

#### 📄 `public/audio-analyzer-integration.js` (linhas 5512+)
**Função**: Função principal `calculateMetricScore()`
- ⚠️ **PROBLEMA PRINCIPAL**: Usa distância do alvo absoluto
- ✅ Estrutura da função está correta para modificação
- ✅ Curva de penalização já implementada (suave, não linear)

```javascript
// ATUAL - PROBLEMÁTICO
function calculateMetricScore(actualValue, targetValue, tolerance) {
    const diff = Math.abs(actualValue - targetValue); // ❌ Distância do alvo
    if (diff <= tolerance) return 100;               // ✅ Correto
    // Penalização baseada em múltiplos da tolerância...
}
```

#### 📄 `public/lib/audio/features/scoring.js` (linhas 150+)
**Função**: Engine de scoring `_computeEqualWeightV3()`
- ✅ Lógica de equal weight implementada
- ⚠️ **PROBLEMA**: Também usa distância do alvo absoluto
- ✅ Curva suave já implementada

### 3. **CÁLCULO DE CORES RYG**

#### 📄 `public/friendly-labels.js` (linha 220+)
**Função**: `createEnhancedDiffCell()`
- ✅ **FUNCIONA CORRETAMENTE**: Usa tolerância para determinar cor
- ✅ Verde: `absDiff <= tolerance`
- ✅ Amarelo: `absDiff <= tolerance * 2`  
- ✅ Vermelho: `absDiff > tolerance * 2`

#### 📄 `auditoria-direcionada-evidencias.js` (linha 767+)
**Função**: `determineColor()`
- ✅ **REFERÊNCIA CORRETA**: Exemplo de como deveria funcionar
- ✅ Usa tolerância como base para zona verde/amarela/vermelha

### 4. **FLUXO DE DADOS**

#### 📄 `api/jobs/[id].js`
**Função**: Endpoint que retorna resultados da análise
- ✅ Retorna `result` como objeto JSONB do banco
- ✅ Contém score calculado e métricas

#### 📄 `work/api/audio/json-output.js` (linha 944+)
**Função**: Formatação da saída JSON do backend
- ✅ Calcula `isWithinTolerance` corretamente
- ✅ Define status baseado em tolerância

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. **SCORE USA ALVO ABSOLUTO (CRÍTICO)**

**Localização**: `calculateMetricScore()` e `_computeEqualWeightV3()`

**Problema**: 
```javascript
const diff = Math.abs(actualValue - targetValue); // ❌ ERRADO
```

**Solução**:
```javascript
const diff = Math.abs(actualValue - targetValue);
const toleranceDistance = Math.max(0, diff - tolerance); // ✅ CORRETO
```

### 2. **MÉTRICAS ASSIMÉTRICAS INCONSISTENTES**

**True Peak**: 
- ✅ **CORRETO**: `invert: true` - só penaliza acima do target
- ✅ Lógica assimétrica adequada (> -1 dBTP é problema)

**DR e LRA**:
- ⚠️ **VERIFICAR**: DR muito alto pode indicar falta de compressão
- ⚠️ **VERIFICAR**: LRA muito alto pode indicar falta de consistência
- 📝 **AÇÃO**: Confirmar se lógica deve ser assimétrica

### 3. **DUPLICATAS E INCONSISTÊNCIAS**

**Nomenclatura de Bandas**:
- ✅ **IDENTIFICADO**: "bass (60-150Hz)" mapeado como `low_bass`
- ✅ **IDENTIFICADO**: Diferenciação entre `low_bass` e `upper_bass`
- ✅ **IDENTIFICADO**: Mapeamento correto no `friendly-labels.js`

**Correlações Altas** (do scoring-v2-config.json):
- `truePeakDbtp` ↔ `samplePeak` (~0.95)
- `crestFactor` ↔ `dynamicRange` (~0.90)  
- `stereoCorrelation` ↔ `stereoWidth` (-0.88 inversa)
- `clippingPct` ↔ `clippingSamples` (~0.98)

### 4. **FALTA DE HISTERESE**

**Problema**: Valores oscilando na borda da tolerância podem "piscar" entre cores.

**Solução**: Implementar histerese com diferentes limiares para subida/descida.

---

## ✅ FLUXO ATUAL MAPEADO

### Backend → API → Frontend

1. **Backend**: `work/api/audio/json-output.js`
   - Calcula métricas técnicas
   - Aplica referências por gênero
   - Gera score usando `calculateMetricScore()`

2. **API**: `api/jobs/[id].js`
   - Retorna resultado como JSON do banco
   - Score e análise já calculados

3. **Frontend**: `public/audio-analyzer-integration.js`
   - Recebe dados via polling
   - Aplica cores usando `createEnhancedDiffCell()`
   - Exibe chips/badges com cores RYG

---

## 🔧 PLANO DE IMPLEMENTAÇÃO

### FASE 1: CORRIGIR FUNÇÃO DE SCORE CONTÍNUO

**Arquivo**: `public/audio-analyzer-integration.js`

**Modificação**: Função `calculateMetricScore()`

```javascript
function calculateMetricScore(actualValue, targetValue, tolerance, yellowMin = 70, buffer = null) {
    if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || !Number.isFinite(tolerance) || tolerance <= 0) {
        return null;
    }
    
    const diff = Math.abs(actualValue - targetValue);
    
    // 🟢 VERDE: Dentro da tolerância = 100 pontos
    if (diff <= tolerance) {
        return 100;
    }
    
    // 🟡 AMARELO: Fora da tolerância até buffer
    const bufferZone = buffer || (tolerance * 1.5); // Default: 1.5x tolerância
    const toleranceDistance = diff - tolerance; // Distância além da tolerância
    
    if (toleranceDistance <= bufferZone) {
        // Decaimento linear de 100 para yellowMin
        const ratio = toleranceDistance / bufferZone;
        return Math.round(100 - ((100 - yellowMin) * ratio));
    }
    
    // 🔴 VERMELHO: Além do buffer
    const redZone = bufferZone * 2; // Zona vermelha = 2x buffer
    const redDistance = toleranceDistance - bufferZone;
    
    if (redDistance >= redZone) {
        return 20; // Mínimo nunca zera
    }
    
    // Decaimento linear de yellowMin para 20
    const ratio = redDistance / redZone;
    return Math.round(yellowMin - ((yellowMin - 20) * ratio));
}
```

### FASE 2: ATUALIZAR PARÂMETROS POR GÊNERO

**Arquivo**: Adicionar ao `config/scoring-v2-config.json`

```json
{
  "scoring_parameters": {
    "funk_mandela": {
      "yellowMin": 75,
      "buffer": 1.5,
      "severity": 1.0,
      "hysteresis": 0.1
    }
  }
}
```

### FASE 3: IMPLEMENTAR HISTERESE

**Conceito**: Diferentes limiares para mudança de cor:

```javascript
function getColorWithHysteresis(diff, tolerance, previousColor, hysteresis = 0.1) {
    const hyst = tolerance * hysteresis;
    
    if (previousColor === 'green') {
        return diff <= (tolerance + hyst) ? 'green' : (diff <= tolerance * 2 ? 'yellow' : 'red');
    } else if (previousColor === 'yellow') {
        return diff <= (tolerance - hyst) ? 'green' : (diff <= tolerance * 2 + hyst ? 'yellow' : 'red');
    } else { // red
        return diff <= (tolerance - hyst) ? 'green' : (diff <= tolerance * 2 - hyst ? 'yellow' : 'red');
    }
}
```

### FASE 4: VALIDAÇÃO E TESTES

**Arquivo**: Criar `test-scoring-continuous.html`

**Casos de teste**:
- T = -20, τ = 5, valor = -26 → Score ≈ 75 (amarelo)
- T = -20, τ = 5, valor = -27 → Score ≈ 65 (amarelo)
- T = -20, τ = 5, valor = -32 → Score ≈ 30 (vermelho)

---

## 🚀 CRONOGRAMA DE IMPLEMENTAÇÃO

### Semana 1: Análise e Preparação
- ✅ Auditoria completa (FEITO)
- 📝 Definir parâmetros específicos por gênero
- 📝 Validar lógica assimétrica DR/LRA

### Semana 2: Implementação Core
- 🔧 Modificar `calculateMetricScore()`
- 🔧 Atualizar configurações JSON
- 🔧 Implementar função de histerese

### Semana 3: Testes e Validação
- 🧪 Testes A/B com sistema atual
- 🧪 Validação com casos extremos
- 🧪 Verificação de performance

### Semana 4: Deploy e Monitoramento
- 🚀 Deploy gradual (feature flag)
- 📊 Monitoramento de comportamento
- 🔄 Ajustes baseados em feedback

---

## 📊 IMPACTO ESPERADO

### ✅ MELHORIAS
- **Score responsivo**: Variação contínua conforme distância da tolerância
- **Feedback intuitivo**: Score sobe/desce com pequenos ajustes (±1-3 dB)
- **Consistência**: Cores e números alinhados
- **Configurabilidade**: Parâmetros por gênero/métrica

### ⚠️ RISCOS MITIGADOS
- **Compatibilidade**: Sistema mantém estrutura atual
- **Performance**: Modificações mínimas, sem impacto
- **UX**: Transição suave, sem quebras

---

## 🔚 CONCLUSÃO

O sistema SoundyAI está **pronto para receber o score contínuo**. A infraestrutura existe, apenas precisa da correção da lógica de cálculo de `distância do alvo` para `distância da tolerância`.

**Status**: ✅ **AUDITORIA COMPLETA - PRONTO PARA IMPLEMENTAÇÃO**

**Próximo Passo**: Implementar Fase 1 (modificar `calculateMetricScore()`)