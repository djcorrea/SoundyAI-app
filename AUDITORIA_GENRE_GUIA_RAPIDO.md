# 🎯 AUDITORIA GENRE - GUIA RÁPIDO

## 📊 LOGS IMPLEMENTADOS

### 🟥 CONTROLLER (`work/api/audio/analyze.js`)
```javascript
// Linha ~371 - Início da rota
🟥 [AUDIT:CONTROLLER-BODY] Payload recebido do front
   └─ req.body completo

// Linha ~434 - Antes de criar job
🟥 [AUDIT:CONTROLLER-PAYLOAD] Payload enviado para Postgres
   └─ fileKey, mode, fileName, referenceJobId, genre, genreTargets

// Linha ~116 - Antes de enfileirar
🟥 [AUDIT:CONTROLLER-QUEUE] Payload enviado para BullMQ
   └─ jobId, externalId, genre, genreTargets
```

### 🔵 WORKER PRINCIPAL (`work/worker.js`)
```javascript
// Linha ~326 - Início do processJob
🔵 [AUDIT:WORKER-ENTRY] Job recebido pelo worker
   └─ job.data completo + genre + mode + genreTargets

// Linha ~591 - Dentro de resolveGenreForOutput
🟠 [AUDIT:GENRE-CHECK] Resolução de gênero no worker
   └─ genreFromJob, genreFromOptions, genreFromAnalysis, resolvedGenre

// Linha ~609 - Bloco de erro
🔴 [AUDIT:GENRE-ERROR] ERRO: Modo genre sem gênero válido
   └─ job.data completo + todas as fontes

// Linha ~1050 - Antes do UPDATE
🟣 [AUDIT:RESULT-BEFORE-SAVE] Resultado ANTES de salvar no Postgres
   └─ resultsForDb completo + genre em todas estruturas
```

### 🔵 WORKER REDIS (`work/worker-redis.js`)
```javascript
// Linha ~648 - Início do audioProcessor
🔵 [AUDIT:WORKER-ENTRY] Job recebido pelo worker
   └─ job.data completo + genre + mode + genreTargets

// Linha ~534 - Antes do UPDATE
🟣 [AUDIT:RESULT-BEFORE-SAVE] Resultado final antes de retornar
   └─ results completo + results.genre + results.metadata.genre

// Linha ~987 - Catch block
🔴 [AUDIT:GENRE-ERROR] Gênero chegou NU no pipeline
   └─ job.data completo
```

---

## 🔍 ORDEM DOS LOGS (Fluxo Normal)

```
1. 🟥 [AUDIT:CONTROLLER-BODY] ← Frontend envia payload
2. 🟥 [AUDIT:CONTROLLER-PAYLOAD] ← Controller prepara para Postgres
3. 🟥 [AUDIT:CONTROLLER-QUEUE] ← Controller enfileira no Redis
4. 🔵 [AUDIT:WORKER-ENTRY] ← Worker consome da fila
5. 🟠 [AUDIT:GENRE-CHECK] ← Worker resolve gênero
6. 🟣 [AUDIT:RESULT-BEFORE-SAVE] ← Worker prepara para salvar
7. ✅ Job concluído - Genre salvo no banco
```

---

## 🚨 DIAGNÓSTICO RÁPIDO

| Se genre NULL aparece em... | O problema está em... |
|-----------------------------|----------------------|
| 🟥 CONTROLLER-BODY | Frontend não enviou |
| 🟥 CONTROLLER-PAYLOAD | Extração do req.body |
| 🟥 CONTROLLER-QUEUE | createJobInDatabase |
| 🔵 WORKER-ENTRY | Redis ou serialização |
| 🟠 GENRE-CHECK | resolveGenreForOutput |
| 🟣 RESULT-BEFORE-SAVE | Montagem de resultsForDb |
| Banco após 🟣 OK | Query SQL ou JSON.stringify |

---

## 📋 COMANDO PARA TESTAR

```bash
# Postman ou Frontend
POST http://localhost:8080/api/audio/analyze
{
  "fileKey": "test.mp3",
  "mode": "genre",
  "genre": "techno",
  "genreTargets": { "techno": true },
  "fileName": "test.mp3"
}
```

**Acompanhe os logs no console do worker em tempo real!**

---

## ✅ CHECKLIST

- [x] Logs no controller (3 logs)
- [x] Logs no worker principal (4 logs - já existiam)
- [x] Logs no worker Redis (3 logs)
- [x] Documento de referência completo
- [x] Guia rápido de diagnóstico
- [x] Nenhuma lógica alterada

**Status:** PRONTO PARA USO 🎯
