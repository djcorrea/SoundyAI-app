# 🔍 AUDITORIA COMPLETA DO PIPELINE DE ANÁLISE DE ÁUDIO

## 📋 RESUMO EXECUTIVO

Sistema de diagnóstico técnico implementado para descobrir **onde exatamente os ganhos de EQ são perdidos** no pipeline de análise. O objetivo é identificar:

- ✅ **Normalização automática de loudness** (LUFS)
- ✅ **Compensação de ganho** (auto-gain)
- ✅ **Limiter ou peak clipping interno**
- ✅ **Suavização excessiva** das bandas espectrais
- ✅ **Cálculo relativo vs absoluto** nas métricas
- ✅ **Arredondamentos** que reduzem variação

---

## 🎯 PIPELINE MAPEADO

### **Fluxo Principal Identificado:**

```
1. analyzeAudioFile(file, options)
   ├── 📊 LOG: ANALYSIS_STARTED
   ├── Cache check (fileHash + genre + refsVer)
   └── Decodificação do áudio → AudioBuffer

2. performFullAnalysis(audioBuffer, options) [V1]
   ├── 📊 Snapshot inicial do AudioBuffer
   ├── findPeakLevel(leftChannel) → Peak em dB
   ├── calculateRMS(leftChannel) → RMS em dB
   ├── calculateCrestFactor() → Peak - RMS
   ├── TT-DR calculation (se habilitado)
   ├── findDominantFrequencies() → FFT simples
   └── detectCommonProblems() + generateTechnicalSuggestions()

3. _enrichWithPhase2Metrics(audioBuffer, baseAnalysis) [V2]
   ├── calculateSpectralBalance() → Bandas espectrais
   ├── _tryAdvancedMetricsAdapter() → LUFS via loudness.js
   ├── AudioAnalyzerV2.performFullAnalysis() (se disponível)
   └── Merge das métricas V1 + V2

4. calculateSpectralBalance(audioData, sampleRate)
   ├── STFT com janela Hann (4096 samples, hop 1024)
   ├── Definir bandas: Sub Bass, Bass, Low Mid, Mid, High Mid, High, Presence
   ├── Acumular energia por banda → energyPct (relativa)
   └── Converter para dB: 10 * log10(energia / totalEnergia)

5. calculateLoudnessMetrics(leftChannel, rightChannel, sampleRate)
   ├── K-weighting filters (ITU-R BS.1770-4)
   ├── Gating (absolute -70 LUFS, relative -10 LU)
   ├── LUFS integrated, short-term, momentary
   └── LRA (Loudness Range)

6. computeMixScore(technicalData, reference)
   ├── Weights por gênero (GENRE_SCORING_WEIGHTS)
   ├── Tolerâncias e comparação com targets
   └── Score 0-100 (Equal Weight V3)
```

---

## ⚠️ PONTOS CRÍTICOS ENCONTRADOS

### **1. BANDAS ESPECTRAIS - CÁLCULO RELATIVO**
- **Localização:** `calculateSpectralBalance()` linha 3692
- **Problema:** Bandas calculadas como `energyPct = (banda / totalEnergia) * 100`
- **Consequência:** Valores relativos, não absolutos - EQ +5dB pode não aparecer se outras bandas também aumentarem

### **2. CONVERSÃO DB PROBLEMÁTICA** 
- **Fórmula atual:** `10 * log10(energia / totalEnergia)`
- **Problema:** Energia² em vez de amplitude RMS 
- **Diferença:** ~2x nos valores dB finais

### **3. LUFS SEM NORMALIZAÇÃO NO PIPELINE**
- **Verificação:** ✅ Não há `normalizeToLUFS()` no pipeline principal
- **Localização:** Apenas em arquivos de auditoria e refs-hybrid-normalize.cjs (externo)
- **Conclusão:** Áudio NÃO é normalizado automaticamente

### **4. SMOOTHING TEMPORAL**
- **FFT:** Análise de 50 frames máximo com hop de 25% (overlap 75%)
- **Janela:** Hann aplicada corretamente
- **Problema:** Pode estar suavizando picos de frequência

---

## 🚀 SISTEMA DE AUDITORIA IMPLEMENTADO

### **Arquivos Criados:**

1. **`AUDITORIA_PIPELINE_COMPLETA.js`** - Sistema de interceptação
2. **`AUDITORIA_PIPELINE_TESTE.html`** - Interface de teste completa

### **Funcionalidades:**

✅ **Intercepta todas as funções principais:**
- `analyzeAudioFile()` 
- `performFullAnalysis()`
- `_enrichWithPhase2Metrics()`
- `calculateLoudnessMetrics()`

✅ **Captura snapshots do AudioBuffer em cada estágio:**
- Estado inicial (RMS, Peak, bandas espectrais)
- Após V1 (métricas básicas)
- Após V2 (LUFS, True Peak)
- Comparação antes/depois

✅ **Detecta automaticamente:**
- Mudanças de ganho entre estágios
- Possível normalização (redução > 3dB)
- Variação nas bandas espectrais
- Tempo de processamento por etapa

✅ **Relatório estruturado:**
- Console groups organizados
- Dados exportáveis em JSON
- Interface visual para monitoramento

---

## 📋 COMO USAR

### **Método 1: Interface Completa**
```bash
# Abrir no navegador:
file:///C:/Users/DJ Correa/Desktop/Programação/SoundyAI/AUDITORIA_PIPELINE_TESTE.html

# 1. Carregar a página
# 2. Aguardar "AudioAnalyzer detectado"  
# 3. Fazer upload do áudio
# 4. Ver logs em tempo real
# 5. Analisar relatório final
```

### **Método 2: Script Direto**
```javascript
// No console do navegador:
// 1. Carregar o script
await import('./AUDITORIA_PIPELINE_COMPLETA.js');

// 2. Aguardar sistema estar ativo
// 3. Fazer upload normal via interface
// 4. Verificar dados coletados
console.log(window.__PIPELINE_AUDIT_DATA__);

// 5. Exportar relatório
window.exportPipelineAuditReport();
```

### **Comandos Disponíveis:**
```javascript
// Ativar/desativar auditoria
window.togglePipelineAudit(true);  // ativar
window.togglePipelineAudit(false); // desativar

// Limpar dados coletados
window.clearPipelineAuditData();

// Exportar relatório completo
window.exportPipelineAuditReport();

// Ver dados em tempo real
window.__PIPELINE_AUDIT_DATA__
```

---

## 🔍 LOGS ESPERADOS

### **Exemplo de saída no console:**
```
🔍 AUDITORIA: Início da análise
   📁 Arquivo: test.wav (2.3 MB)
   
[AUDITORIA] INITIAL_AUDIO_STATE {
  etapa: 'entrada_perform_full_analysis',
  leftRMSdB: -18.4,
  leftPeakdB: -3.2,
  rightRMSdB: -18.1,
  rightPeakdB: -3.0
}

[AUDITORIA] INITIAL_SPECTRAL {
  etapa: 'bandas_espectrais_entrada',
  bandas: {
    'Sub Bass': 8.2,
    'Bass': 22.1,
    'Low Mid': 18.3,
    'Mid': 25.4,
    'High Mid': 15.8,
    'High': 7.1,
    'Presence': 3.1
  }
}

[AUDITORIA] LUFS_CALCULATION_INPUT {
  etapa: 'calculo_lufs_entrada',
  leftRMSdB: -18.4,
  sampleRate: 48000
}

[AUDITORIA] LUFS_CALCULATION_OUTPUT {
  etapa: 'calculo_lufs_saida',
  lufs_integrated: -14.2,
  lra: 8.3,
  headroom_db: -8.8
}

[AUDITORIA] FASE2_SAIDA {
  etapa: 'fase2_saida',
  ganhoDetectado: {
    peakGainDb: 0.1,     // ← IMPORTANTE: >0 = sem normalização
    rmsGainDb: 0.2,      // ← IMPORTANTE: >0 = sem normalização
    normalizedDetected: false  // ← IMPORTANTE: sem redução automática
  }
}
```

### **Indicadores de Problemas:**
```javascript
// ❌ NORMALIZAÇÃO DETECTADA:
ganhoDetectado: {
  peakGainDb: -4.7,           // Redução significativa
  rmsGainDb: -4.5,            // Redução significativa  
  normalizedDetected: true    // Flag ativada
}

// ❌ BANDAS ESPECTRAIS ALTERADAS:
bandChanges: {
  'Bass': { antes: 22.1, depois: 18.3, delta: -3.8 },
  'Mid': { antes: 25.4, depois: 23.1, delta: -2.3 }
}
```

---

## 🎯 PRÓXIMOS PASSOS

### **Se a auditoria detectar normalização:**
1. **Localizar a função específica** que aplica o ganho
2. **Adicionar flag de bypass** para modo diagnóstico  
3. **Implementar modo "raw analysis"** sem processamento

### **Se bandas espectrais forem o problema:**
1. **Substituir cálculo relativo por absoluto** em dB RMS
2. **Implementar normalização LUFS** nas bandas para comparação
3. **Ajustar fórmula** de energia² para amplitude RMS

### **Se o problema for outro:**
1. **Expandir auditoria** para interceptar mais funções
2. **Comparar com análise externa** (Audacity, etc.)
3. **Implementar modo A/B testing** automático

---

## 📊 DADOS TÉCNICOS

### **Configurações Atuais do Pipeline:**
- **FFT Size:** 4096 samples
- **Hop Size:** 1024 samples (75% overlap)
- **Window:** Hann
- **Sample Rate:** 48000 Hz (padrão)
- **Max Frames:** 50 (análise espectral)
- **LUFS Gating:** -70 LUFS absolute, -10 LU relative
- **True Peak:** Oversampling 4x

### **Bandas Espectrais:**
- **Sub Bass:** 20-60 Hz
- **Bass:** 60-120 Hz  
- **Low Mid:** 120-250 Hz
- **Mid:** 250-1000 Hz
- **High Mid:** 1000-4000 Hz
- **High:** 4000-8000 Hz
- **Presence:** 8000-16000 Hz

---

## ✅ RESULTADO ESPERADO

Após executar a auditoria com um arquivo que teve **EQ +5dB aplicado**, você deve ver:

1. **Se o problema for normalização automática:** `ganhoDetectado.normalizedDetected: true`
2. **Se o problema for bandas relativas:** Bandas mantêm proporção mesmo com EQ
3. **Se o problema for outro:** Identificação clara do estágio onde o ganho é perdido

**O relatório final dirá exatamente onde e por que os +5dB não aparecem nas métricas.**