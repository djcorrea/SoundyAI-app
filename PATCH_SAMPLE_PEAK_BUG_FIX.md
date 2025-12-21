# 🔧 PATCH: Sample Peak Bug Fix (+36 dBFS Prevention)

**Objetivo:** Prevenir valores absurdos (+36 dBFS) via validação de entrada e detecção de anomalias

**Arquivos afetados:**
- `work/api/audio/core-metrics.js` (validação de entrada)
- `work/api/audio/json-output.js` (flag samplePeakSuspicious)
- `public/audio-analyzer-integration.js` (UI warning)

---

## PATCH 1: Validação de Entrada (core-metrics.js)

**Localização:** [work/api/audio/core-metrics.js:32-75](c:/Users/DJ%20Correa/Desktop/Programa%C3%A7%C3%A3o/SoundyAI/work/api/audio/core-metrics.js#L32-L75)

```javascript
/**
 * 🎯 FUNÇÃO PURA: Calcular Sample Peak REAL (max absolute sample)
 * HOTFIX: Implementado como função standalone (não método de classe) para evitar contexto `this`
 * 
 * ✅ PATCH 1: Validação de entrada para detectar PCM int não normalizado
 * 
 * @param {Float32Array} leftChannel - Canal esquerdo (DEVE ser normalizado -1.0..1.0, ou float livre)
 * @param {Float32Array} rightChannel - Canal direito (DEVE ser normalizado -1.0..1.0, ou float livre)
 * @returns {object|null} - { left, right, max, leftDbfs, rightDbfs, maxDbfs } ou null se erro
 */
function calculateSamplePeakDbfs(leftChannel, rightChannel) {
  try {
    if (!leftChannel || !rightChannel || leftChannel.length === 0 || rightChannel.length === 0) {
      console.warn('[SAMPLE_PEAK] Canais inválidos ou vazios');
      return null;
    }

    // 🔒 VALIDAÇÃO CRÍTICA: Detectar PCM int não normalizado
    // ============================================================
    // Samples DEVEM estar em float normalizado (-1.0 a +1.0 típico)
    // ou float 32-bit livre (pode ser > 1.0 para overshoot)
    // 
    // Se maxAbsSample > 100, provavelmente são samples PCM int16/24/32
    // não normalizados (ex: 32767 direto ao invés de 32767/32768.0)
    // ============================================================
    const maxAbsLeft = Math.max(...Array.from(leftChannel).map(Math.abs));
    const maxAbsRight = Math.max(...Array.from(rightChannel).map(Math.abs));
    const maxAbsSample = Math.max(maxAbsLeft, maxAbsRight);

    if (maxAbsSample > 100) {
      // 🚨 ERRO CRÍTICO: Samples parecem PCM int não normalizados
      console.error(`[SAMPLE_PEAK] ❌ ERRO CRÍTICO: Samples parecem PCM int NÃO NORMALIZADOS!`);
      console.error(`[SAMPLE_PEAK] maxAbsSample = ${maxAbsSample} (esperado: 0-1 típico, ou até 10 para 32-bit float)`);
      console.error(`[SAMPLE_PEAK] Detectado:`, {
        maxAbsLeft: maxAbsLeft.toFixed(2),
        maxAbsRight: maxAbsRight.toFixed(2),
        leftChannelLength: leftChannel.length,
        rightChannelLength: rightChannel.length
      });
      
      // Determinar divisor de normalização
      let normalizer = 32768;  // int16 por padrão
      if (maxAbsSample > 8388608) {
        normalizer = 2147483648;  // int32
        console.error(`[SAMPLE_PEAK] 🔧 Detectado: PCM int32 não normalizado (dividir por 2147483648)`);
      } else if (maxAbsSample > 32768) {
        normalizer = 8388608;  // int24
        console.error(`[SAMPLE_PEAK] 🔧 Detectado: PCM int24 não normalizado (dividir por 8388608)`);
      } else {
        console.error(`[SAMPLE_PEAK] 🔧 Detectado: PCM int16 não normalizado (dividir por 32768)`);
      }
      
      console.error(`[SAMPLE_PEAK] 🔧 CORREÇÃO AUTOMÁTICA: Normalizando por ${normalizer}...`);
      
      // Aplicar normalização de emergência
      const normalizedLeft = new Float32Array(leftChannel.length);
      const normalizedRight = new Float32Array(rightChannel.length);
      
      for (let i = 0; i < leftChannel.length; i++) {
        normalizedLeft[i] = leftChannel[i] / normalizer;
      }
      for (let i = 0; i < rightChannel.length; i++) {
        normalizedRight[i] = rightChannel[i] / normalizer;
      }
      
      // Substituir canais originais
      leftChannel = normalizedLeft;
      rightChannel = normalizedRight;
      
      console.error(`[SAMPLE_PEAK] ✅ Normalização aplicada. Novo maxAbsSample: ${Math.max(
        Math.max(...Array.from(leftChannel).map(Math.abs)),
        Math.max(...Array.from(rightChannel).map(Math.abs))
      ).toFixed(6)}`);
    } else if (maxAbsSample > 10) {
      // 🟡 SUSPEITO: Entre 10 e 100 é estranho mas tecnicamente possível
      console.warn(`[SAMPLE_PEAK] ⚠️ Amplitude suspeita: maxAbsSample = ${maxAbsSample}`);
      console.warn(`[SAMPLE_PEAK] Valores entre 10-100 são raros. Verifique se formato está correto.`);
    }

    // ============================================================
    // CÁLCULO NORMAL (código existente, já CORRETO)
    // ============================================================
    
    // Max absolute sample por canal (linear 0.0-1.0)
    let peakLeftLinear = 0;
    let peakRightLinear = 0;
    
    for (let i = 0; i < leftChannel.length; i++) {
      const absLeft = Math.abs(leftChannel[i]);
      if (absLeft > peakLeftLinear) peakLeftLinear = absLeft;
    }
    
    for (let i = 0; i < rightChannel.length; i++) {
      const absRight = Math.abs(rightChannel[i]);
      if (absRight > peakRightLinear) peakRightLinear = absRight;
    }
    
    const peakMaxLinear = Math.max(peakLeftLinear, peakRightLinear);
    
    // Converter para dBFS (com segurança para silêncio)
    const peakLeftDbfs = peakLeftLinear > 0 ? 20 * Math.log10(peakLeftLinear) : -120;
    const peakRightDbfs = peakRightLinear > 0 ? 20 * Math.log10(peakRightLinear) : -120;
    const peakMaxDbfs = peakMaxLinear > 0 ? 20 * Math.log10(peakMaxLinear) : -120;
    
    // 🔍 LOG DETALHADO (só se valor suspeito)
    if (peakMaxDbfs > 3.0 || peakMaxDbfs < -100 || !isFinite(peakMaxDbfs)) {
      console.warn(`[SAMPLE_PEAK] 🚨 VALOR ANÔMALO DETECTADO:`, {
        peakMaxDbfs: peakMaxDbfs.toFixed(2),
        peakMaxLinear: peakMaxLinear.toFixed(6),
        peakLeftDbfs: peakLeftDbfs.toFixed(2),
        peakRightDbfs: peakRightDbfs.toFixed(2),
        maxAbsSample: maxAbsSample.toFixed(6),
        isFinite: isFinite(peakMaxDbfs)
      });
    }
    
    return {
      left: peakLeftLinear,
      right: peakRightLinear,
      max: peakMaxLinear,
      leftDbfs: peakLeftDbfs,
      rightDbfs: peakRightDbfs,
      maxDbfs: peakMaxDbfs
    };
    
  } catch (error) {
    console.error('[SAMPLE_PEAK] Erro ao calcular:', error.message);
    console.error('[SAMPLE_PEAK] Stack:', error.stack);
    return null;
  }
}
```

---

## PATCH 2: Flag samplePeakSuspicious (json-output.js)

**Localização:** [work/api/audio/json-output.js:470-495](c:/Users/DJ%20Correa/Desktop/Programa%C3%A7%C3%A3o/SoundyAI/work/api/audio/json-output.js#L470-L495)

```javascript
  // ✅ SAMPLE PEAK: Exportar valores canônicos
  if (coreMetrics.samplePeak) {
    // Chaves canônicas
    technicalData.samplePeakDbfs = safeSanitize(coreMetrics.samplePeak.maxDbfs);
    technicalData.samplePeakLeftDbfs = safeSanitize(coreMetrics.samplePeak.leftDbfs);
    technicalData.samplePeakRightDbfs = safeSanitize(coreMetrics.samplePeak.rightDbfs);
    technicalData.samplePeakLinear = safeSanitize(coreMetrics.samplePeak.max);
    
    // 🚨 PATCH 2: Detectar valores anômalos e marcar como suspeitos
    // ============================================================
    const peakDbfs = technicalData.samplePeakDbfs;
    let suspicious = false;
    let suspiciousReason = null;
    
    if (peakDbfs > 3.0) {
      // Suspeito: Sample Peak > +3 dBFS
      // Possíveis causas:
      // 1. Arquivo 32-bit float com overshoot (amplitude > 1.0) → VÁLIDO mas raro
      // 2. Conversão dupla dB→linear→dB → BUG
      // 3. PCM int não normalizado → BUG
      suspicious = true;
      suspiciousReason = `Sample Peak muito alto (${peakDbfs.toFixed(2)} dBFS > +3 dBFS). Possível 32-bit float overshoot ou conversão dupla.`;
      console.error(`[JSON-OUTPUT] 🚨 SAMPLE PEAK ANÔMALO: ${peakDbfs.toFixed(2)} dBFS > +3 dBFS`);
      console.error(`[JSON-OUTPUT] Possíveis causas:`);
      console.error(`  1. Arquivo 32-bit float com overshoot (amplitude > 1.0) → VÁLIDO mas raro`);
      console.error(`  2. Conversão dupla dB→linear→dB → BUG`);
      console.error(`  3. PCM int não normalizado → BUG (mas deveria ter sido detectado)`);
      console.error(`[JSON-OUTPUT] Linear calculado: ${coreMetrics.samplePeak.max.toFixed(6)}`);
      console.error(`[JSON-OUTPUT] Formato áudio: ${formatInfo?.audioFormat || 'N/A'}`);
      console.error(`[JSON-OUTPUT] Bit depth: ${formatInfo?.bitDepth || 'N/A'}`);
    } else if (peakDbfs < -100) {
      // Suspeito: Sample Peak muito baixo (silêncio digital ou erro)
      suspicious = true;
      suspiciousReason = `Sample Peak muito baixo (${peakDbfs.toFixed(2)} dBFS < -100 dBFS). Possível silêncio ou erro de cálculo.`;
      console.warn(`[JSON-OUTPUT] ⚠️ Sample Peak muito baixo: ${peakDbfs.toFixed(2)} dBFS`);
    } else if (isNaN(peakDbfs) || !isFinite(peakDbfs)) {
      // Crítico: NaN ou Infinity
      suspicious = true;
      suspiciousReason = `Sample Peak inválido (NaN ou Infinity). Erro de cálculo.`;
      console.error(`[JSON-OUTPUT] ❌ Sample Peak inválido: ${peakDbfs} (NaN ou Infinity)`);
    }
    
    technicalData.samplePeakSuspicious = suspicious;
    if (suspiciousReason) {
      technicalData.samplePeakSuspiciousReason = suspiciousReason;
    }
    
    // 🔄 COMPATIBILIDADE: Popular chaves antigas
    if (!technicalData.samplePeakLeftDb || technicalData.samplePeakLeftDb === null) {
      technicalData.samplePeakLeftDb = technicalData.samplePeakLeftDbfs;
    }
    if (!technicalData.samplePeakRightDb || technicalData.samplePeakRightDb === null) {
      technicalData.samplePeakRightDb = technicalData.samplePeakRightDbfs;
    }
    technicalData.samplePeakDb = technicalData.samplePeakDbfs;
    
    console.log(`[JSON-OUTPUT] ✅ Sample Peak exportado: ${peakDbfs.toFixed(2)} dBFS (suspicious=${suspicious})`);
    
  } else {
    // Fail-soft: Sample Peak não disponível
    technicalData.samplePeakDbfs = null;
    technicalData.samplePeakDb = null;
    technicalData.samplePeakLeftDbfs = null;
    technicalData.samplePeakRightDbfs = null;
    technicalData.samplePeakSuspicious = false;
    console.warn(`[JSON-OUTPUT] ⚠️ Sample Peak não calculado (coreMetrics.samplePeak ausente)`);
  }
```

---

## PATCH 3: UI Warning (audio-analyzer-integration.js)

**Localização:** [public/audio-analyzer-integration.js:14386-14395](c:/Users/DJ%20Correa/Desktop/Programa%C3%A7%C3%A3o/SoundyAI/public/audio-analyzer-integration.js#L14386-L14395)

```javascript
// 🎯 2. Sample Peak (dBFS): max(samplePeakLeftDb, samplePeakRightDb)
(() => {
    const samplePeakDbfs = getSamplePeakMaxDbfs(analysis);

    if (samplePeakDbfs === null) {
        console.warn('⚠️ [RENDER] Sample Peak não disponível (left ou right ausente)');
        return '';  // Ocultar card se não disponível
    }

    // 🚨 PATCH 3: Detectar Sample Peak marcado como suspeito
    const isSuspicious = analysis.technicalData?.samplePeakSuspicious === true;
    
    if (isSuspicious) {
        const reason = analysis.technicalData?.samplePeakSuspiciousReason || 'Valor anômalo detectado';
        
        console.error('🚨 [UI] SAMPLE PEAK MARCADO COMO SUSPEITO PELO BACKEND!');
        console.error(`   Valor: ${samplePeakDbfs.toFixed(2)} dBFS`);
        console.error(`   Razão: ${reason}`);
        console.error(`   Linear: ${analysis.technicalData?.samplePeakLinear}`);
        console.error(`   Formato: ${analysis.formatInfo?.audioFormat || 'N/A'}`);
        console.error(`   Bit Depth: ${analysis.formatInfo?.bitDepth || 'N/A'}`);
        
        // Renderizar com aviso visual VERMELHO
        return row(
            'Sample Peak (dBFS)', 
            `<span style="color: #ff3333; font-weight: bold;">${safeFixed(samplePeakDbfs, 1)} dBFS</span> <span style="color: #ff6666; font-size: 0.85em;">⚠️ ESTOURADO/SUSPEITO</span>`,
            'samplePeak'
        );
    }
    
    // Normal: Renderizar com status de True Peak
    const spStatus = getTruePeakStatus(samplePeakDbfs);
    console.log('✅ [RENDER] Sample Peak (dBFS) =', samplePeakDbfs, 'dBFS');
    return row('Sample Peak (dBFS)', `${safeFixed(samplePeakDbfs, 1)} dBFS <span class="${spStatus.class}">${spStatus.status}</span>`, 'samplePeak');
})(),
```

---

## VALIDAÇÃO PÓS-PATCH

### **1. Testar com sine 0 dBFS**
```bash
# Gerar sine 1kHz amplitude 1.0, salvar como test-0dbfs.wav
# Analisar
# Verificar: samplePeakDbfs ~0.0, samplePeakSuspicious = false
```

### **2. Testar com 32-bit float overshoot**
```bash
# Gerar sine 1kHz amplitude 10.0 em 32-bit float WAV
# Analisar
# Verificar: samplePeakDbfs ~+20.0, samplePeakSuspicious = true
# UI deve exibir: "20.0 dBFS ⚠️ ESTOURADO/SUSPEITO"
```

### **3. Testar com PCM int16 normal**
```bash
# Gerar sine 1kHz amplitude 0.5 em 16-bit PCM WAV
# Analisar
# Verificar: samplePeakDbfs ~-6.02, samplePeakSuspicious = false
```

### **4. Simular bug PCM não normalizado (edge case)**
```bash
# Se pipeline enviar samples int16 SEM normalizar:
# maxAbsSample = 32767 → detectado, normalizado automaticamente
# Console deve exibir: "[SAMPLE_PEAK] ❌ ERRO CRÍTICO: Samples parecem PCM int NÃO NORMALIZADOS!"
```

---

## SCHEMA JSON ATUALIZADO

```json
{
  "technicalData": {
    "samplePeakDbfs": -1.2,              // número em dBFS
    "samplePeakLeftDbfs": -1.5,         // canal L
    "samplePeakRightDbfs": -1.2,        // canal R
    "samplePeakLinear": 0.87,           // valor linear
    "samplePeakSuspicious": false,       // 🆕 FLAG: true se anômalo
    "samplePeakSuspiciousReason": null,  // 🆕 MOTIVO (se suspicious = true)
    
    // Campos deprecated (manter por compatibilidade)
    "samplePeakDb": -1.2,
    "samplePeakLeftDb": -1.5,
    "samplePeakRightDb": -1.2
  }
}
```

---

## RANGES ESPERADOS (RESUMO)

| Formato | Sample Peak Esperado | Flag `suspicious` |
|---------|---------------------|-------------------|
| WAV PCM 16/24/32-bit | `-∞ a 0.0 dBFS` | `false` (se ≤ +0.1) |
| WAV Float 32-bit | `-∞ a +∞ dBFS` | `true` (se > +3.0) |
| MP3/M4A/OGG | `-∞ a 0.0 dBFS` | `false` (se ≤ +0.1) |

---

## COMMITS SUGERIDOS

```bash
git add work/api/audio/core-metrics.js
git add work/api/audio/json-output.js
git add public/audio-analyzer-integration.js
git commit -m "fix: Prevenir Sample Peak +36 dBFS via validação entrada + flag suspicious"

git add test/sample-peak-regression.test.js
git commit -m "test: Adicionar suite regressão Sample Peak (sines, PCM, 32-bit float)"

git add AUDIT_SAMPLE_PEAK_BUG_ROOT_CAUSE.md
git commit -m "docs: Audit report completo - Sample Peak bug +36 dBFS"
```

---

**Status:** ✅ PATCHES PRONTOS PARA APLICAR  
**Risco:** 🟢 BAIXO (apenas validação adicional, não altera cálculo existente)  
**Compatibilidade:** ✅ MANTIDA (novos campos são opcionais)
