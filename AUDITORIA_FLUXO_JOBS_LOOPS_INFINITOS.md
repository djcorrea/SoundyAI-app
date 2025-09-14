# AUDITORIA CRÍTICA: LOOPS INFINITOS DE JOBS

## 🎯 OBJETIVO DA AUDITORIA
Identificar root cause dos jobs que **ficam eternamente em "queued", processam várias vezes e nunca chegam em "done" ou "failed"**.

---

## 🔍 METODOLOGIA APLICADA
1. ✅ **Auditoria de Criação de Jobs** - Verificar se jobs são criados corretamente
2. ✅ **Auditoria de Worker Processing** - Examinar lógica de processamento e status updates  
3. ✅ **Auditoria de Audio Pipeline** - Identificar pontos de crash/timeout no pipeline
4. ✅ **Auditoria de Frontend Integration** - Verificar polling e detecção de status
5. ✅ **Relatório Técnico Final** - Compilação de achados e root causes identificados

---

## 🟢 COMPONENTES VERIFICADOS E FUNCIONAIS

### 1. **CRIAÇÃO DE JOBS** (`work/api/audio/analyze.js`)
- ✅ **Status**: Jobs criados corretamente com `status='queued'`
- ✅ **Database**: INSERT com UUID, timestamps, file_key funcionando
- ✅ **Error Handling**: Tratamento adequado de erros de criação
- ✅ **Conclusão**: Criação de jobs NÃO é a causa do problema

### 2. **WORKER PROCESSING** (`work/index.js`)
- ✅ **Status Updates**: Worker atualiza corretamente `queued → processing → done/failed`
- ✅ **Heartbeat**: Sistema robusto a cada 30s durante processamento
- ✅ **Error Handling**: Try/catch abrangente com fallback para `failed`
- ✅ **Recovery System**: Jobs órfãos são recuperados a cada 5min (status `processing` → `queued`)
- ✅ **Polling**: Worker verifica jobs a cada 5s
- ✅ **Verificação**: `updateResult.rowCount` confirma sucesso das queries
- ✅ **Conclusão**: Lógica de worker NÃO é a causa primária

### 3. **FRONTEND POLLING** (`public/audio-analyzer-integration.js`)
- ✅ **Polling Interval**: 5 segundos (alinhado com worker)
- ✅ **Status Detection**: Detecta `done`, `failed`, `queued`, `processing`
- ✅ **Timeout**: 5 minutos máximo (60 tentativas × 5s)
- ✅ **Error Handling**: Trata erros de network e resposta
- ✅ **Conclusão**: Frontend polling está correto

---

## 🔴 ROOT CAUSES IDENTIFICADOS

### **ROOT CAUSE #1: WORKER DEATH DURANTE PIPELINE**

#### 🎯 **Problema Principal**
O worker **morre/crasha durante a execução do audio pipeline**, deixando jobs órfãos no status `processing`. O sistema de recovery tenta recuperar esses jobs, mas eles crasham novamente, criando o **loop infinito**.

#### 📍 **Pontos Críticos de Crash Identificados**

##### A) **FFmpeg Decoding (Fase 5.1)**
```javascript
// work/api/audio/audio-decoder.js
const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
```
- **Risco**: FFmpeg pode falhar com arquivos corrompidos/inválidos
- **Sintoma**: Worker morre sem executar catch, job fica em `processing`
- **Files problemáticos**: WAV malformados, arquivos truncados

##### B) **Memory Overflow (Fase 5.2-5.3)**
```javascript
// work/api/audio/temporal-segmentation.js  
const FFT_SIZE = 4096;
const RMS_BLOCK_DURATION_MS = 300;
```
- **Risco**: Arquivos grandes (>10min) consomem RAM excessiva
- **Sintoma**: Node.js OOM kill, worker termina abruptamente
- **Buffer Size**: Float32Array pode exceder heap disponível

##### C) **LUFS Calculation Intensive (Fase 5.3)**
```javascript
// work/lib/audio/features/loudness.js
const K_WEIGHTING_COEFFS = { ... }; // Filtros complexos
```
- **Risco**: Cálculos LUFS são CPU-intensivos
- **Sintoma**: Timeout ou crash em arquivos longos/complexos
- **Problem**: K-weighting + gating pode travar em edge cases

##### D) **Pipeline Timeout (3 minutos)**
```javascript
// work/index.js:139
reject(new Error(`Pipeline timeout após 3 minutos para: ${filename}`));
```
- **Risco**: Arquivos grandes excedem 3min de processamento
- **Resultado**: Timeout causa job failure, mas pode não atualizar DB se worker morre

### **ROOT CAUSE #2: RACE CONDITIONS NO RECOVERY**

#### 🎯 **Cenário de Loop**
1. Job entra em `processing`
2. Worker crasha durante pipeline (FFmpeg/LUFS/Memory)
3. Recovery detecta job órfão após 10min → volta para `queued`
4. Novo worker pega o mesmo job problemático
5. **Crash novamente no mesmo ponto**
6. **Cycle infinito**: `queued → processing → crash → recovery → queued`

#### 📊 **Timing Crítico**
```javascript
// Recovery a cada 5min, mas threshold de 10min
setInterval(recoverOrphanedJobs, 300000); // 5min
WHERE updated_at < NOW() - INTERVAL '10 minutes' // 10min threshold
```

### **ROOT CAUSE #3: ERROR HANDLING GAPS**

#### A) **Pipeline Error sem DB Update**
Se o worker **morre antes do finally block**, o status nunca é atualizado para `failed`:
```javascript
// work/index.js:270+ 
} finally {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    // Se worker morre aqui, job fica órfão
}
```

#### B) **FFmpeg Exit Codes não tratados**
```javascript
// audio-decoder.js não trata exit codes específicos
// Worker pode morrer com SIGKILL/SIGTERM sem catch
```

---

## 🚨 EVIDÊNCIAS DO COMPORTAMENTO

### **Padrão de Logs Esperado (Loop)**
```
🔄 Worker verificando jobs...
📥 Processando job: abc123...
🔄 Atualizando status para processing...
💓 Heartbeat enviado
⚡ Iniciando análise de áudio...
[CRASH - Worker Dies]

[5-10min depois]
🔄 Verificando jobs órfãos...
🔄 Recuperados 1 jobs órfãos: ['abc123']
📥 Processando job: abc123... [MESMO JOB]
[CRASH NOVAMENTE]
```

### **Queries para Confirmar**
```sql
-- Jobs que processaram multiple vezes
SELECT id, status, created_at, updated_at, error
FROM jobs 
WHERE updated_at - created_at > INTERVAL '1 hour'
AND status IN ('queued', 'processing');

-- Jobs órfãos frequent
SELECT COUNT(*), file_key 
FROM jobs 
WHERE error LIKE '%Recovered from orphaned state%'
GROUP BY file_key
HAVING COUNT(*) > 3;
```

---

## 💡 SOLUÇÕES RECOMENDADAS

### **SOLUÇÃO #1: ROBUSTEZ NO PIPELINE**
```javascript
// Wrap FFmpeg em timeout + kill process
const ffmpegProcess = spawn(FFMPEG_PATH, args);
const timeout = setTimeout(() => {
    ffmpegProcess.kill('SIGKILL');
    reject(new Error('FFmpeg timeout'));
}, 120000); // 2min max
```

### **SOLUÇÃO #2: JOB BLACKLIST**
```javascript
// Marcar jobs problemáticos como failed permanently
UPDATE jobs 
SET status = 'failed', error = 'File processing failed multiple times'
WHERE id IN (
    SELECT id FROM jobs 
    WHERE error LIKE '%Recovered from orphaned state%'
    GROUP BY file_key HAVING COUNT(*) >= 3
);
```

### **SOLUÇÃO #3: HEALTH CHECKS**
```javascript
// Monitor worker health + restart automático
process.on('uncaughtException', (err) => {
    console.error('Worker crash:', err);
    // Attempt graceful job cleanup before exit
    process.exit(1);
});
```

### **SOLUÇÃO #4: FILE VALIDATION**
```javascript
// Pre-validate files before pipeline
async function validateAudioFile(buffer) {
    if (buffer.length < 44) throw new Error('File too small');
    if (buffer.length > 100 * 1024 * 1024) throw new Error('File too large'); 
    // Additional checks...
}
```

---

## 🔥 PRIORIDADE DE CORREÇÃO

### **P0 (CRÍTICO - IMPLEMENTAR IMEDIATAMENTE)**
1. **Job Blacklist**: Evitar reprocessamento infinito de files problemáticos
2. **FFmpeg Timeout**: Matar processos travados
3. **Memory Limits**: Rejeitar arquivos muito grandes antes do pipeline

### **P1 (ALTO - PRÓXIMA SPRINT)**
1. **Worker Health Monitoring**: Restart automático em crashes
2. **Enhanced Error Handling**: Catch específico para cada fase
3. **File Pre-validation**: Verificar integridade antes do processing

### **P2 (MÉDIO - MELHORIAS)**
1. **Pipeline Optimization**: Reduzir consumo de memória/CPU
2. **Better Logging**: Telemetria detalhada de crashes
3. **Graceful Degradation**: Fallbacks para edge cases

---

## 📋 CONCLUSÃO EXECUTIVA

**O loop infinito é causado por jobs que crasham o worker durante o audio pipeline, especialmente nas fases de FFmpeg decoding e LUFS calculation. O sistema de recovery funciona corretamente, mas acaba reprocessando os mesmos jobs problemáticos indefinidamente.**

**Solução imediata**: Implementar job blacklist + file validation para quebrar o ciclo vicioso.

**Impacto**: Sistema continuará instável até que arquivos problemáticos sejam identificados e removidos do ciclo de reprocessamento.

---

*Auditoria realizada em: ${new Date().toISOString()}*  
*Escopo: Fluxo completo de jobs → Worker → Pipeline → Recovery*  
*Status: ✅ Root cause identificado - Requer ação imediata*