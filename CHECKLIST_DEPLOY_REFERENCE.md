# ✅ CHECKLIST FINAL: Deploy Reference Mode Fixes

**Data**: 18/12/2025  
**Status**: 🟢 PRONTO PARA DEPLOY  
**Tempo estimado**: 5 minutos

---

## 📋 RESUMO DO QUE FOI FEITO

### 🔍 Auditoria completa realizada:

1. ✅ Confirmado: **apenas 1 handler** ativo (`work/api/jobs/[id].js`)
2. ✅ Identificado: **lógica de downgrade** (validação Genre executada para reference)
3. ✅ Confirmado: **log "(SEGUNDO JOB)" não existe** no código atual (Railway rodando versão antiga)

### 🛠️ 5 correções aplicadas:

| # | Correção | Arquivo | Linhas |
|---|---|---|---|
| 1 | Headers rastreabilidade + nextAction | work/api/jobs/[id].js | 16-25, 161-195 |
| 2 | Reset condicional (não limpa baseJobId) | public/reference-flow.js | 125-151 |
| 3 | Setar baseJobId imediatamente | public/audio-analyzer-integration.js | 7578-7582 |
| 4 | Detectar nextAction no polling | public/audio-analyzer-integration.js | 3244-3264 |
| 5 | Logs com traceId (rastreabilidade) | Múltiplos arquivos | - |

### 📄 Documentação criada:

1. [CORRECAO_REFERENCE_LOOP_INFINITO_PRODUCAO.md](CORRECAO_REFERENCE_LOOP_INFINITO_PRODUCAO.md) - 805 linhas
2. [CONTRATO_REFERENCE_MODE_ANTES_DEPOIS.md](CONTRATO_REFERENCE_MODE_ANTES_DEPOIS.md) - Tabela JSON completa
3. [AUDITORIA_TECNICA_COMPLETA_REFERENCE.md](AUDITORIA_TECNICA_COMPLETA_REFERENCE.md) - Auditoria técnica

---

## 🚀 PASSO A PASSO PARA DEPLOY

### 1️⃣ Verificar commit local

```bash
# Confirmar que todas as mudanças estão commitadas:
git status

# Se houver arquivos não commitados:
git add -A
git commit -m "fix(reference): corrigir loop infinito + adicionar rastreabilidade completa"
```

### 2️⃣ Push para repositório

```bash
# Push para branch main (ou sua branch de produção):
git push origin main
```

### 3️⃣ Forçar rebuild no Railway

**Opção A - Dashboard Railway** (RECOMENDADO):
1. Acessar: https://railway.app/project/<seu-projeto>
2. Clicar em **"Redeploy"** ou **"Force Redeploy"**
3. Aguardar build finalizar (~3-5 min)

**Opção B - CLI Railway**:
```bash
railway up --force
```

**Opção C - Push vazio** (força trigger):
```bash
git commit --allow-empty -m "trigger: force railway rebuild"
git push origin main
```

### 4️⃣ Validar versão em produção

**Checar headers HTTP**:
```bash
# Substitua <seu-app> pelo nome do seu app:
curl -I https://seu-app.up.railway.app/api/jobs/test

# DEVE CONTER:
# X-JOBS-HANDLER: work/api/jobs/[id].js
# X-BUILD: <hash-do-commit-atual>
# X-REF-GUARD: V7
```

**Checar hash do commit**:
```bash
# Pegar hash local:
git rev-parse HEAD

# Comparar com X-BUILD no curl acima
# Devem ser iguais!
```

### 5️⃣ Testar fluxo reference completo

**Frontend (Browser DevTools)**:

1. Abrir: https://seu-app.up.railway.app
2. Abrir DevTools (F12) → Console
3. Selecionar **"Comparação A/B"**
4. Upload **primeira música** (qualquer arquivo MP3)
5. **AGUARDAR** processamento (1-2 min)

**Logs esperados no Console**:
```javascript
✅ [REF-FLOW] ✅ baseJobId setado imediatamente: <jobId>
✅ [POLL-TRACE] { 
     traceId: 'ref_...',
     status: 'completed',
     nextAction: 'upload_second_track',
     willOpenModal: true
   }
✅ [POLLING][REFERENCE] 🎯 Base completada { hasNextAction: true }
```

**Comportamento esperado**:
- ✅ Modal 1ª música **fecha automaticamente**
- ✅ Modal 2ª música **abre imediatamente**
- ✅ Mensagem: "Agora faça upload da segunda música para comparar"

**❌ NÃO deve aparecer**:
```
❌ [API-FIX][GENRE] ⚠️ Job marcado como "completed" mas falta dados essenciais
❌ Polling infinito (modal não fecha)
```

### 6️⃣ Validar fluxo Genre (não quebrou)

**Teste rápido**:

1. Voltar para home
2. Selecionar **"Por Gênero"** (ex: Rock)
3. Upload música qualquer
4. **AGUARDAR** processamento
5. Verificar que **suggestions aparecem**
6. Verificar que **status = completed**

**Logs backend esperados** (Railway logs):
```
✅ [API-JOBS][GENRE] 🔵 Genre Mode detectado com status COMPLETED
✅ [API-JOBS][GENRE] ✅ Todos os dados essenciais presentes - status COMPLETED mantido
```

**❌ NÃO deve aparecer**:
```
❌ [REF-GUARD-V7] (não deve executar para Genre)
```

---

## 🔍 CHECKLIST DE VALIDAÇÃO

### ✅ Backend (Railway logs)

Abrir: Railway Dashboard → Logs → Filtrar por últimos 10 minutos

**Procurar por**:
- ✅ `[REF-GUARD-V7] ✅ EARLY_RETURN_EXECUTANDO para reference`
- ✅ `[REF-GUARD-V7] ✅ BASE completed { nextAction: 'upload_second_track' }`
- ✅ `[PROBE_STATUS_HANDLER] HIT work/api/jobs/[id].js`

**NÃO deve aparecer**:
- ❌ `[API-FIX] Job <id> (SEGUNDO JOB)`
- ❌ `[API-FIX][GENRE] Retornando status "processing" para frontend aguardar`

### ✅ Frontend (Browser Console)

**Procurar por**:
- ✅ `[REF-FLOW] ✅ baseJobId setado imediatamente`
- ✅ `[POLL-TRACE] { nextAction: 'upload_second_track' }`
- ✅ `[POLLING][REFERENCE] 🎯 Base completada { hasNextAction: true }`

**NÃO deve aparecer**:
- ❌ `[REF-FLOW] ⚠️ Iniciando nova análise - resetando fluxo anterior`
- ❌ Loop infinito de `🔄 Verificando status do job`

### ✅ SessionStorage (Application tab)

**Checar**:
1. Application → Session Storage → `REF_FLOW_V1`
2. Verificar campos:
```json
{
  "stage": "awaiting_second",
  "baseJobId": "<uuid-válido>",  // ✅ NÃO null
  "baseMetrics": { "lufsIntegrated": -14.2, ... },
  "traceId": "ref_1766030000000"
}
```

---

## 🆘 TROUBLESHOOTING

### ❌ Problema: Modal não fecha após primeira música

**Causa provável**: Railway não fez rebuild (código antigo ainda rodando)

**Solução**:
```bash
# 1. Verificar hash do build:
curl -I https://seu-app.up.railway.app/api/jobs/test | grep X-BUILD

# 2. Comparar com hash local:
git rev-parse HEAD

# 3. Se diferentes, forçar rebuild:
# Railway Dashboard → Redeploy
```

### ❌ Problema: Log "(SEGUNDO JOB)" ainda aparece

**Causa**: Railway não atualizou código

**Solução**:
```bash
# Forçar rebuild completo:
railway down
railway up --force
```

### ❌ Problema: Header X-BUILD retorna "local-dev"

**Causa**: Variável de ambiente `RAILWAY_GIT_COMMIT_SHA` não está setada

**Solução**:
1. Railway Dashboard → Settings → Variables
2. Verificar se `RAILWAY_GIT_COMMIT_SHA` existe
3. Se não existir, Railway deve criar automaticamente no próximo deploy

### ❌ Problema: Fluxo Genre quebrou

**Causa improvável**: Early return está capturando Genre por engano

**Solução**:
```bash
# Checar logs backend para:
[REF-GUARD-V7] 🚨 ALERTA: Reference escapou do early return!

# Se aparecer, há bug na detecção de mode
# Rollback:
git revert HEAD
git push origin main
```

---

## 📊 MÉTRICAS DE SUCESSO

### 🎯 KPIs esperados após deploy:

| Métrica | Antes | Depois | Meta |
|---|---|---|---|
| **Taxa de conclusão Reference** | 0% (loop infinito) | 100% | 95%+ |
| **Tempo médio Reference** | ∞ (travado) | 3-5 min | <10 min |
| **Modal 2 aberto** | 0% | 100% | 95%+ |
| **Erros "[API-FIX][GENRE]" para ref** | 100% | 0% | 0% |
| **Taxa de conclusão Genre** | 100% | 100% | 95%+ |

### 📈 Onde monitorar:

**Railway Logs**:
- Filtrar por: `[REF-GUARD-V7]`
- Contar: quantos `✅ BASE completed` aparecem
- Validar: NÃO aparecem logs de Genre para reference

**Browser Console**:
- Filtrar por: `[POLL-TRACE]`
- Validar: `willOpenModal: true` aparece
- Validar: baseJobId não é null

**Sentry/Error tracking** (se configurado):
- Monitorar: redução de erros "Polling timeout"
- Monitorar: redução de erros "baseJobId is null"

---

## ✅ CRITÉRIOS DE ACEITE FINAIS

| # | Critério | Como validar | Status |
|---|---|---|---|
| 1 | Primeira música processa | Upload MP3 → status completed | ⏳ Pendente deploy |
| 2 | Modal 1 fecha | Observar UI após completed | ⏳ Pendente deploy |
| 3 | Modal 2 abre | Observar UI imediatamente após | ⏳ Pendente deploy |
| 4 | Sem downgrade reference | Logs NÃO contêm `[API-FIX][GENRE]` para ref | ⏳ Pendente deploy |
| 5 | Genre funciona | Teste modo Genre → suggestions aparecem | ⏳ Pendente deploy |
| 6 | baseJobId persistido | SessionStorage contém baseJobId válido | ⏳ Pendente deploy |
| 7 | Logs rastreáveis | Mesmo traceId em frontend + backend | ⏳ Pendente deploy |
| 8 | Headers corretos | cURL retorna X-BUILD, X-REF-GUARD | ⏳ Pendente deploy |

---

## 🎉 SUCESSO!

Após completar todos os passos:

1. ✅ Loop infinito resolvido
2. ✅ Modal 1 fecha, Modal 2 abre
3. ✅ baseJobId persistido corretamente
4. ✅ Rastreabilidade completa (traceId)
5. ✅ Fluxo Genre preservado
6. ✅ Logs organizados para debug futuro

**Parabéns! 🚀**

---

## 📞 SUPORTE

Se precisar de ajuda durante o deploy:

1. Checar documentos de referência:
   - [AUDITORIA_TECNICA_COMPLETA_REFERENCE.md](AUDITORIA_TECNICA_COMPLETA_REFERENCE.md)
   - [CONTRATO_REFERENCE_MODE_ANTES_DEPOIS.md](CONTRATO_REFERENCE_MODE_ANTES_DEPOIS.md)

2. Revisar commits:
   ```bash
   git log --oneline -5
   ```

3. Rollback se necessário:
   ```bash
   git revert HEAD
   git push origin main
   ```

---

**FIM DO CHECKLIST**  
**Boa sorte com o deploy! 🚀**
