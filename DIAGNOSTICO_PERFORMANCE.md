# 🔍 DIAGNÓSTICO DE PERFORMANCE - ANÁLISE DE ÁUDIO

## ❌ PROBLEMA IDENTIFICADO

A análise ainda está demorando muito tempo e os logs de instrumentação não aparecem.

## 🎯 POSSÍVEIS CAUSAS

### 1. **Código Instrumentado NÃO Está Sendo Executado**
- O código em produção pode estar usando uma versão antiga
- O worker pode estar rodando código cacheado
- O arquivo `core-metrics.js` pode ter sido sobrescrito

### 2. **Logs Não Estão Sendo Capturados**
- Console.log pode estar sendo redirecionado
- Worker pode estar rodando em background sem output
- Logs podem estar em arquivo separado (Railway/Vercel logs)

### 3. **Otimizações NÃO Estão Ativas**
- Workers paralelos não estão sendo usados
- FFT otimizado não foi aplicado
- True Peak FFmpeg não está funcionando
- BPM ainda processa áudio completo (não limitado a 30s)

## 🔬 DIAGNÓSTICO PASSO A PASSO

### PASSO 1: Verificar Código Atual

Execute no terminal:

```powershell
# Verificar se instrumentação está no código
Get-Content "api\audio\core-metrics.js" | Select-String "performance.now|logStep"

# Deve mostrar várias linhas com performance.now() e logStep()
```

**Resultado esperado:** 10+ linhas encontradas

**Se NÃO aparecer:** Código foi sobrescrito, precisa reaplicar instrumentação

---

### PASSO 2: Testar Análise Direta

Execute:

```powershell
node test-performance-direto.js "tests\musica.flac.wav"
```

**O que observar:**
- ✅ Deve aparecer banner: `🚀 ===== AUDITORIA DE TEMPO INICIADA =====`
- ✅ Deve aparecer timing de cada fase: `⏱️ [Normalização] levou X ms`
- ✅ Deve aparecer timing de workers: `⏱️ [Worker FFT] levou X ms`
- ✅ Deve aparecer total: `⏱️ [⏳ TOTAL PIPELINE] levou X ms`

**Se NÃO aparecer nada disso:** Código não está sendo executado corretamente

---

### PASSO 3: Verificar Worker Paralelo

Abra `api\audio\core-metrics.js` e procure por:

```javascript
const [fftResults, lufsMetrics, truePeakMetrics, bpmResult] = await runWorkersParallel([
```

**Deve estar assim (COM runWorkersParallel)**
**NÃO deve estar assim (código antigo sequencial):**

```javascript
// ❌ CÓDIGO ANTIGO (SEM WORKERS)
const fftResults = await this.calculateFFT(...);
const lufsMetrics = await this.calculateLUFS(...);
```

---

### PASSO 4: Verificar FFT Otimizado

Abra `api\audio\core-metrics.js` e procure o import:

```javascript
import { optimizedFFT } from '../../lib/audio/fft-optimized.js';
```

**Deve usar `fft-optimized.js` e NÃO `fft-engine.js`**

---

### PASSO 5: Verificar True Peak FFmpeg

Abra `workers\truepeak-worker.js` e procure:

```javascript
import { calculateTruePeakFFmpeg } from '../lib/audio/truepeak-ffmpeg.js';
```

**Deve usar `truepeak-ffmpeg.js` (via FFmpeg)**
**NÃO deve usar código JavaScript puro de interpolação**

---

### PASSO 6: Verificar BPM Limitado

Abra `lib\audio\bpm-analyzer.js` e procure:

```javascript
const MAX_SAMPLES_BPM = 48000 * 30; // Limitar a 30 segundos
```

**Deve ter esta constante limitando o processamento**

---

## 🚨 DIAGNÓSTICO CRÍTICO

### Se NENHUM log aparece:

**Causa provável:** Worker está rodando código antigo cacheado ou código foi revertido.

**Solução:**

1. **Reiniciar worker completamente:**
   ```powershell
   # Se estiver no Railway/Vercel, fazer redeploy
   # Se estiver local:
   taskkill /F /IM node.exe
   node work/worker.js
   ```

2. **Verificar se código está correto:**
   ```powershell
   # Ver primeiras 150 linhas de core-metrics.js
   Get-Content "api\audio\core-metrics.js" -Head 150
   ```

3. **Re-executar teste direto:**
   ```powershell
   node test-performance-direto.js "tests\musica.flac.wav"
   ```

---

### Se logs aparecem mas tempo ainda alto (>60s):

**Causa provável:** Otimizações não estão ativas.

**Verificar no log:**
- **LUFS > 30s?** → LUFS não foi otimizado (ainda em JavaScript)
- **FFT > 15s?** → FFT não está usando biblioteca otimizada
- **Workers SÃO sequenciais?** → Paralelização falhou
- **BPM > 10s?** → Limite de 30s não foi aplicado

**Solução:** Revisar implementação de cada otimização (documentação em `OTIMIZACAO_*_IMPLEMENTADA.md`)

---

### Se logs aparecem e tempo está OK (<20s):

**✅ SUCESSO!** Sistema funcionando conforme esperado.

**Próximos passos:**
1. Deploy para produção
2. Monitorar logs em Railway/Vercel
3. Validar com usuários reais

---

## 📊 TABELA DE DIAGNÓSTICO RÁPIDO

| Sintoma | Causa Provável | Solução |
|---------|---------------|---------|
| **Sem logs de timing** | Código instrumentado não executado | Verificar `core-metrics.js` e reiniciar worker |
| **Logs aparecem, tempo >60s** | Otimizações não ativas | Verificar imports e configurações |
| **Worker trava/não responde** | Erro não capturado | Verificar `work/worker.js` logs |
| **LUFS >30s isoladamente** | LUFS não otimizado | Verificar se está usando código JavaScript puro |
| **FFT >20s isoladamente** | FFT não otimizado | Verificar import de `fft-optimized.js` |
| **Workers rodam em série** | Promise.all falhou | Verificar `runWorkersParallel` em `core-metrics.js` |
| **BPM >10s** | Limite 30s não aplicado | Verificar `MAX_SAMPLES_BPM` em `bpm-analyzer.js` |

---

## 🎯 AÇÃO IMEDIATA RECOMENDADA

Execute AGORA no terminal:

```powershell
# 1. Verificar código atual
Write-Host "🔍 1. Verificando instrumentação..." -ForegroundColor Cyan
$lines = Get-Content "api\audio\core-metrics.js" | Select-String "performance.now|logStep"
Write-Host "   Linhas encontradas: $($lines.Count)" -ForegroundColor $(if($lines.Count -gt 10){'Green'}else{'Red'})

# 2. Testar análise direta
Write-Host "`n🧪 2. Executando teste direto..." -ForegroundColor Cyan
node test-performance-direto.js "tests\musica.flac.wav"
```

**Resultado esperado:**
- ✅ 10+ linhas com performance.now/logStep
- ✅ Logs de timing aparecem
- ✅ Tempo total <20s

**Se falhar:** Reportar resultado para análise detalhada.

---

## 📝 CHECKLIST DE VALIDAÇÃO

Após executar diagnóstico, preencher:

- [ ] Código instrumentado está em `api/audio/core-metrics.js`
- [ ] Logs de timing aparecem ao executar teste direto
- [ ] Workers paralelos estão configurados (runWorkersParallel)
- [ ] FFT otimizado está importado (fft-optimized.js)
- [ ] True Peak FFmpeg está ativo (truepeak-ffmpeg.js)
- [ ] BPM limitado a 30s (MAX_SAMPLES_BPM)
- [ ] Tempo total <20s confirmado

**Se todos os itens OK:** Sistema está funcionando corretamente!

---

**Data:** 23 de outubro de 2025  
**Status:** 🔍 Aguardando execução de diagnóstico
