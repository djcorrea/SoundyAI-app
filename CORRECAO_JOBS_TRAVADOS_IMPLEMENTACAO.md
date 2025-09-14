# 🔧 CORREÇÃO DEFINITIVA - JOBS TRAVADOS

## PROBLEMAS IDENTIFICADOS NA AUDITORIA:

### 1. 🔴 downloadFileFromBucket - SEM TIMEOUT
**Risco:** Streams podem travar indefinidamente
**Impacto:** Job fica "processing" forever

### 2. 🔴 processAudioComplete - SEM TIMEOUT  
**Risco:** FFmpeg pode travar ou processo infinito
**Impacto:** Job nunca termina

### 3. 🔴 Status Updates - SEM VERIFICAÇÃO
**Risco:** Query UPDATE pode falhar silenciosamente
**Impacto:** Job completed mas status continua "processing"

### 4. 🔴 Jobs Órfãos - SEM RECOVERY
**Risco:** Worker morre, jobs ficam "processing"
**Impacto:** Jobs nunca são reprocessados

---

## ✅ SOLUÇÃO COMPLETA:

### IMPLEMENTAR TIMEOUTS OBRIGATÓRIOS:
```javascript
// 1. Download com timeout de 2 minutos
function downloadWithTimeout(key, timeoutMs = 120000) {
  return Promise.race([
    downloadFileFromBucket(key),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Download timeout')), timeoutMs)
    )
  ]);
}

// 2. Pipeline com timeout de 5 minutos
function analyzeWithTimeout(filePath, job, timeoutMs = 300000) {
  return Promise.race([
    analyzeAudioWithPipeline(filePath, job),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Pipeline timeout')), timeoutMs)
    )
  ]);
}
```

### IMPLEMENTAR HEARTBEAT:
```javascript
// Heartbeat a cada 30s durante processing
let heartbeatInterval;

function startHeartbeat(jobId) {
  heartbeatInterval = setInterval(async () => {
    await client.query(
      "UPDATE jobs SET updated_at = NOW() WHERE id = $1 AND status = 'processing'",
      [jobId]
    );
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
```

### IMPLEMENTAR RECOVERY DE JOBS ÓRFÃOS:
```javascript
// Recuperar jobs órfãos a cada 10 minutos
setInterval(async () => {
  // Jobs "processing" há mais de 10 minutos = órfãos
  await client.query(`
    UPDATE jobs 
    SET status = 'queued', updated_at = NOW() 
    WHERE status = 'processing' 
    AND updated_at < NOW() - INTERVAL '10 minutes'
  `);
}, 600000);
```

### VERIFICAR STATUS UPDATES:
```javascript
// Sempre verificar se UPDATE funcionou
const updateResult = await client.query(
  "UPDATE jobs SET status = $1, result = $2::jsonb WHERE id = $3",
  ["done", JSON.stringify(result), job.id]
);

if (updateResult.rowCount === 0) {
  throw new Error(`Failed to update job ${job.id} status`);
}
```

---

## 🎯 PRÓXIMOS PASSOS:

1. **Implementar timeouts em downloadFileFromBucket**
2. **Implementar timeouts em processAudioComplete**  
3. **Adicionar heartbeat durante processing**
4. **Implementar recovery de jobs órfãos**
5. **Verificar rowCount em todos os UPDATEs**
6. **Testar com jobs que ficam travados**

---

## ⚠️ URGÊNCIA:
Esta correção é **CRÍTICA** para produção.
Jobs travados causam:
- Usuários frustrados
- Recursos desperdiçados  
- Sistema aparentemente "quebrado"
- Perda de confiança no produto