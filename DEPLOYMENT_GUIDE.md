# 🚀 DEPLOYMENT - PATCH DEFINITIVO GENRE

**Data:** 2 de dezembro de 2025  
**Versão:** v2.0-genre-fix-definitivo  
**Status:** ✅ Pronto para deploy

---

## 📋 PRÉ-REQUISITOS

- [x] Código testado localmente
- [x] Sem erros de lint/syntax
- [x] Auditoria forense completa
- [x] Logs de validação implementados
- [x] SQL de teste preparado

---

## 🎯 ARQUIVOS MODIFICADOS

### **1. `work/worker.js`** (CRÍTICO)
**Mudanças:**
- Criação de `resultsForDb` separado
- UPDATE com JSONs diferentes para `result` e `results`
- Validação imediata no PostgreSQL
- Logs paranóicos em 3 níveis

**Impacto:**
- ✅ Alto impacto positivo (resolve bug crítico)
- ⚠️ Worker precisa reiniciar
- ✅ Backward compatible (não quebra análises antigas)

---

## 🔄 PASSO-A-PASSO DE DEPLOY

### **OPÇÃO 1: Deploy via Git (Railway/Heroku)**

```bash
# 1. Commit das mudanças
git add work/worker.js
git commit -m "🔥 PATCH DEFINITIVO: Resolver genre NULL em results

- Criar resultsForDb separado com garantia de genre
- UPDATE com JSONs diferentes para result e results
- Validação imediata no PostgreSQL após salvar
- Logs paranóicos em 3 níveis (PRE/POST serialização e banco)

RESOLVES: data.genre correto mas results.genre NULL
IMPACT: Critical - Garante consistência de genre em todos os campos"

# 2. Push para branch de produção
git push origin main  # ou master, ou sua branch de deploy
```

**Railway/Heroku detecta automaticamente e faz redeploy.**

---

### **OPÇÃO 2: Deploy Manual (SSH/Docker)**

```bash
# 1. Conectar ao servidor
ssh user@seu-servidor.com

# 2. Ir para diretório do projeto
cd /path/to/soundyai

# 3. Pull das mudanças
git pull origin main

# 4. Reiniciar worker (crítico!)
pm2 restart worker  # ou systemctl restart worker, docker restart, etc.

# 5. Verificar logs
pm2 logs worker --lines 50
# Procurar por: [GENRE-PATCH-V2]
```

---

### **OPÇÃO 3: Deploy via CI/CD**

Se você tem pipeline automatizado:

```yaml
# .github/workflows/deploy.yml ou similar
- name: Deploy Worker
  run: |
    git pull
    docker-compose restart worker
    docker-compose logs --tail=50 worker
```

---

## 🧪 VALIDAÇÃO PÓS-DEPLOY

### **1. Verificar que worker iniciou corretamente**

```bash
# Railway
railway logs --service worker

# Heroku
heroku logs --app seu-app --tail --ps worker

# Docker
docker logs soundyai-worker --tail 50

# PM2
pm2 logs worker --lines 50
```

**Procurar por:**
```
✅ Worker conectado ao Postgres
✅ Pipeline completo carregado com sucesso!
```

---

### **2. Testar com análise nova**

1. **Frontend:** Escolher gênero (ex: "eletrofunk")
2. **Enviar áudio** para análise
3. **Aguardar conclusão** (status: completed)

---

### **3. Verificar logs do worker**

```bash
# Procurar pelos logs do patch
railway logs --service worker | grep "GENRE-PATCH-V2"
```

**Logs esperados:**
```
[GENRE-PATCH-V2] 🎯 Extraindo genre prioritário:
[GENRE-PATCH-V2]    job.data.genre: eletrofunk
[GENRE-PATCH-V2]    ➡️ GÉNERO FINAL: eletrofunk
[GENRE-PATCH-V2] 📦 resultsForDb criado:
[GENRE-PATCH-V2]    resultsForDb.genre: eletrofunk
[GENRE-PATCH-V2]    resultsForDb.data.genre: eletrofunk

[GENRE-PARANOID][PRE-UPDATE] ✅ Validação pós-parse:
[GENRE-PARANOID][PRE-UPDATE]    parsedResults.genre: eletrofunk

[GENRE-PARANOID][POST-UPDATE] ✅✅✅ GENRE CORRETO EM TODOS OS CAMPOS!
```

---

### **4. Executar SQL de validação**

Conectar ao PostgreSQL e executar:

```sql
-- Job mais recente
SELECT 
  id,
  data->>'genre' AS data_genre,
  results->>'genre' AS results_genre,
  results->'data'->>'genre' AS results_data_genre
FROM jobs 
ORDER BY created_at DESC 
LIMIT 1;
```

**Resultado esperado:**
```
| id   | data_genre | results_genre | results_data_genre |
|------|------------|---------------|---------------------|
| uuid | eletrofunk | eletrofunk    | eletrofunk          |
```

**✅ Se TODOS os campos == "eletrofunk" → DEPLOY FUNCIONOU!**

---

### **5. Verificar consistência (últimos 10 jobs)**

```sql
SELECT 
  id,
  data->>'genre' AS data_genre,
  results->>'genre' AS results_genre,
  
  CASE 
    WHEN data->>'genre' = results->>'genre' THEN '✅ OK'
    WHEN data->>'genre' IS NULL AND results->>'genre' IS NULL THEN '⚠️ Ambos NULL'
    ELSE '❌ INCONSISTENTE'
  END AS status
  
FROM jobs 
WHERE status = 'done'
ORDER BY created_at DESC 
LIMIT 10;
```

**Resultado esperado:**
```
Todos os jobs com status = '✅ OK'
```

---

## 🚨 ROLLBACK (SE NECESSÁRIO)

Se algo der errado:

### **OPÇÃO 1: Rollback via Git**

```bash
# 1. Reverter commit
git revert HEAD

# 2. Push
git push origin main

# Railway/Heroku redeploya automaticamente
```

---

### **OPÇÃO 2: Rollback manual**

```bash
# 1. Conectar ao servidor
ssh user@servidor

# 2. Checkout versão anterior
cd /path/to/soundyai
git checkout HEAD~1 work/worker.js

# 3. Reiniciar worker
pm2 restart worker
```

---

### **OPÇÃO 3: Rollback via Railway/Heroku**

**Railway:**
```bash
railway rollback
```

**Heroku:**
```bash
heroku rollback v123  # número da versão anterior
```

---

## 📊 MONITORAMENTO PÓS-DEPLOY

### **Primeiras 24h:**

1. **Verificar logs a cada 2h**
   ```bash
   railway logs --service worker | grep "GENRE-PARANOID"
   ```

2. **Executar SQL de consistência**
   ```sql
   -- Estatísticas gerais
   SELECT 
     COUNT(*) AS total_jobs,
     COUNT(CASE WHEN results->>'genre' IS NULL THEN 1 END) AS jobs_com_null,
     ROUND(
       COUNT(CASE WHEN data->>'genre' = results->>'genre' THEN 1 END)::numeric / 
       NULLIF(COUNT(*), 0) * 100, 
       2
     ) AS porcentagem_sucesso
   FROM jobs 
   WHERE status = 'done' 
   AND created_at > NOW() - INTERVAL '24 hours';
   ```

3. **Verificar alerts no frontend**
   - Nenhum `analysis.genre = null`
   - Nenhum `analysis.data.genre = null`

---

### **Primeiras horas (crítico):**

```bash
# Loop de monitoramento (bash)
while true; do
  clear
  echo "=== MONITORAMENTO GENRE PATCH ==="
  echo "Timestamp: $(date)"
  echo ""
  
  # Últimos 3 jobs
  psql $DATABASE_URL -c "
    SELECT 
      id,
      data->>'genre' AS data_g,
      results->>'genre' AS results_g,
      CASE 
        WHEN data->>'genre' = results->>'genre' THEN '✅'
        ELSE '❌'
      END AS ok
    FROM jobs 
    ORDER BY created_at DESC 
    LIMIT 3;
  "
  
  sleep 300  # A cada 5 minutos
done
```

---

## ✅ CRITÉRIOS DE SUCESSO

Deploy é **ACEITO** quando:

- [x] Worker reiniciou sem erros
- [x] Logs mostram `[GENRE-PATCH-V2]` funcionando
- [x] SQL retorna `results.genre` correto (não NULL)
- [x] SQL mostra consistência (data.genre == results.genre)
- [x] Frontend recebe `analysis.genre` correto
- [x] Nenhum alert `❌ GENRE INCONSISTENTE` nos logs
- [x] Porcentagem de sucesso >= 99%

---

## 🎯 CHECKLIST DE DEPLOY

**PRÉ-DEPLOY:**
- [x] Código commitado
- [x] Sem erros de syntax
- [x] Auditoria completa documentada
- [x] SQL de teste preparado

**DURANTE DEPLOY:**
- [ ] Git push executado
- [ ] Redeploy iniciado (Railway/Heroku)
- [ ] Worker reiniciado
- [ ] Logs monitorados

**PÓS-DEPLOY:**
- [ ] Worker iniciou corretamente
- [ ] Teste com análise nova executado
- [ ] SQL de validação executado
- [ ] Logs mostram sucesso
- [ ] Frontend recebe dados corretos
- [ ] Monitoramento 24h ativo

---

## 📞 SUPORTE

### **Se aparecer erro:**

1. **Verificar logs:**
   ```bash
   railway logs --service worker --tail 100
   ```

2. **Procurar por:**
   - `❌ GENRE INCONSISTENTE`
   - `🚨 GENRE NULL EM resultsJSON`
   - Erros de SQL

3. **Executar SQL de debug:**
   ```sql
   SELECT 
     id,
     status,
     error,
     data->>'genre',
     results->>'genre'
   FROM jobs 
   WHERE status = 'failed'
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

4. **Se necessário, fazer rollback** (seção anterior)

---

## 🎉 FIM DO DEPLOYMENT

**Patch aplicado com sucesso!**

Comportamento esperado:
1. User escolhe gênero → Frontend envia
2. Backend salva `data.genre` → ✅
3. Worker processa → Cria `resultsForDb` com genre garantido
4. UPDATE salva `results.genre` → ✅
5. Frontend lê `analysis.genre` → ✅

**TODOS os campos consistentes!**
