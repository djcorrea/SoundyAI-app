# ✅ CHECKLIST DE VERIFICAÇÃO RÁPIDA

**Use este checklist antes e depois do deploy**

---

## 📋 PRÉ-DEPLOY

### Código
- [x] Webhook alterado de STUDIO → PLUS
- [x] Duração alterada de 120 → 30 dias
- [x] Configuração de planos atualizada
- [x] Server.js atualizado
- [x] Job de expiração suporta STUDIO
- [x] Job de notificação criado
- [x] Sem erros de sintaxe

### Documentação
- [x] Auditoria completa criada
- [x] Changelog profissional criado
- [x] Resumo executivo criado
- [x] Instruções de deploy documentadas

---

## 🚀 DEPLOY

```bash
# 1. Commit
git add .
git commit -m "feat: alterar Hotmart de STUDIO 4 meses para PLUS 1 mês"

# 2. Push
git push origin main

# 3. Aguardar Railway
# Acessar: https://railway.app/
# Verificar: Build successful ✅
```

---

## ✅ PÓS-DEPLOY

### Verificação Imediata (Railway Logs)

- [ ] ✅ `🎓 [HOTMART] Webhook registrado: POST /api/webhook/hotmart`
- [ ] ✅ Server iniciou sem erros
- [ ] ✅ Nenhum erro de import/export

### Teste Manual (OPCIONAL)

```bash
# Enviar payload fake
curl -X POST https://sua-url.railway.app/api/webhook/hotmart \
  -H "Content-Type: application/json" \
  -d '{"event":"PURCHASE_APPROVED","data":{"buyer":{"email":"teste@test.com","name":"Teste"},"purchase":{"transaction":"TEST123","status":"approved"}}}'

# Verificar resposta: 200 OK
```

**Verificar logs:**
- [ ] ✅ `💳 [HOTMART-ASYNC] Ativando PLUS para...`
- [ ] ✅ `✅ [HOTMART-ASYNC] Plano PLUS ativado: ... até ...`
- [ ] ✅ `✅ [HOTMART-ASYNC] E-mail de onboarding enviado`

### Configurar Jobs (Railway Dashboard)

**Job 1: Expiração**
- [ ] Nome: "Expirar planos"
- [ ] Comando: `node lib/jobs/expire-plans.js`
- [ ] Cron: `0 3 * * *`
- [ ] ✅ Salvo

**Job 2: Notificação**
- [ ] Nome: "Notificar expiração"
- [ ] Comando: `node lib/jobs/notify-expiration.js`
- [ ] Cron: `0 9 * * *`
- [ ] ✅ Salvo

---

## 🎯 VERIFICAÇÃO NA PRIMEIRA COMPRA REAL

### Firestore (`usuarios` collection)

```javascript
// Buscar por email do comprador
usuarios/<uid> {
  // ✅ VERIFICAR ESTES CAMPOS:
  plan: "plus",  // ✅ DEVE SER "plus" (NÃO "studio")
  plusExpiresAt: "2026-XX-XX",  // ✅ DEVE ESTAR PREENCHIDO (30 dias)
  studioExpiresAt: null,  // ✅ DEVE SER null
  hotmartTransactionId: "HPM_...",  // ✅ Deve existir
  origin: "hotmart"  // ✅ Deve ser "hotmart"
}
```

### Logs Railway

```
✅ [HOTMART-ASYNC] Ativando PLUS para abc123 (30 dias)
✅ [HOTMART-ASYNC] Plano PLUS ativado: abc123 até 2026-XX-XX
✅ [HOTMART-ASYNC] Transação marcada como processada
✅ [HOTMART-ASYNC] E-mail de onboarding enviado
```

### Email Recebido

- [ ] Assunto contém "PLUS"
- [ ] Corpo menciona "1 mês" ou "30 dias"
- [ ] Link de acesso funciona

---

## 🔍 MONITORAMENTO CONTÍNUO

### Primeira Semana
- [ ] Pelo menos 1 compra processada com sucesso
- [ ] Nenhum erro nos logs
- [ ] Usuário consegue acessar plataforma

### Após 7 Dias
- [ ] Job de notificação rodou (verificar logs)
- [ ] Email de "7 dias" foi enviado (verificar logs)

### Após 30 Dias
- [ ] Job de expiração rodou
- [ ] Plano mudou para FREE
- [ ] Email de expiração foi enviado

---

## ❌ PROBLEMAS COMUNS

### ❌ Webhook não ativa plano

**Sintomas:**
- Compra feita mas plano continua FREE
- Logs: "🚫 [HOTMART-ABORT]"

**Verificar:**
1. Payload Hotmart está correto?
2. Status de compra é "approved"?
3. Email do comprador é válido?
4. Firestore está acessível?

**Solução:**
- Verificar logs completos
- Procurar por "🚫 [HOTMART-ABORT]"
- Ver qual validação falhou

### ❌ Plano ativado mas é STUDIO (não PLUS)

**Sintomas:**
- `studioExpiresAt` preenchido
- `plusExpiresAt` vazio

**Causa:**
- Deploy não aconteceu
- Código antigo ainda rodando

**Solução:**
```bash
# Forçar novo deploy
git commit --allow-empty -m "trigger deploy"
git push origin main
```

### ❌ Jobs não rodam

**Sintomas:**
- Planos não expiram após 30 dias
- Notificações não são enviadas

**Causa:**
- Railway Cron não configurado

**Solução:**
- Ir em Railway → Settings → Cron Jobs
- Adicionar jobs conforme instruções acima

---

## 📞 SUPORTE

**Arquivos de referência:**
- `AUDIT_HOTMART_INTEGRATION_COMPLETE_2026-01-30.md` - Auditoria completa
- `CHANGELOG_HOTMART_PLUS_1MES_2026-01-30.md` - Changelog e instruções
- `RESUMO_EXECUTIVO_HOTMART_2026-01-30.md` - Resumo executivo

**Logs Railway:**
```bash
# Acessar Railway dashboard
# Project → Deployments → Logs
# Filtrar por: [HOTMART]
```

**Firestore:**
```bash
# Console Firebase
# Firestore Database → usuarios
# Buscar por email do comprador
```

---

## ✅ CONCLUSÃO

**Quando marcar como concluído?**

- [x] Código deployado
- [x] Logs sem erros
- [ ] Jobs configurados
- [ ] Primeira compra processada com sucesso
- [ ] Plano PLUS ativado corretamente
- [ ] Email recebido

**Tudo OK?** 🎉 IMPLEMENTAÇÃO CONCLUÍDA COM SUCESSO!

---

**Criado em:** 30/01/2026  
**Última atualização:** 30/01/2026
