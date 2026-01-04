# 🎯 FLUXO DE ONBOARDING CLEAN PREMIUM

**Implementação completa de primeiro acesso com Firebase Auth + Design Clean Premium**

---

## 📋 O QUE FOI IMPLEMENTADO

### Backend (Node.js + Firebase Admin)

1. **Novo e-mail onboarding** (`lib/email/onboarding-email.js`)
   - Design clean premium (inspiração Apple/Linear)
   - SEM senha no e-mail
   - Link do Firebase para criar senha
   - Compatível com Gmail (tabelas HTML, inline CSS)
   - Tolerante a falhas

2. **Webhook Hotmart modificado** (`api/webhook/hotmart.js`)
   - Remove geração de senha provisória
   - Cria usuário Firebase SEM senha
   - Gera `generatePasswordResetLink` como "criar senha"
   - Envia novo e-mail onboarding

### Frontend (HTML + Firebase Modular)

3. **Página primeiro-acesso.html**
   - Design minimalista clean premium
   - Formulário de criar senha
   - Validações (senhas iguais, mínimo 6 chars)
   - Estados: loading, erro, sucesso
   - Mobile-first responsivo
   - Usa `confirmPasswordReset` do Firebase

4. **Login.html atualizado**
   - Toast de sucesso quando `?reset=success`
   - Mensagem: "Senha definida! Faça login."
   - Limpa URL após exibir

---

## 🚀 COMO TESTAR

### Teste Local (Desenvolvimento)

**1. Ajustar variáveis de ambiente (.env):**
```bash
APP_URL=http://localhost:3000
RESEND_API_KEY=re_live_xxxxxxxxxxxxx
EMAIL_FROM="SoundyAI <noreply@soundyai.com.br>"
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

**2. Iniciar servidor:**
```bash
node server.js
```

**3. Simular webhook Hotmart:**

```bash
curl -X POST http://localhost:3000/api/webhook/hotmart \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PURCHASE_APPROVED",
    "data": {
      "buyer": {
        "email": "teste@exemplo.com",
        "name": "João Teste"
      },
      "purchase": {
        "transaction": "TEST123456",
        "status": "approved"
      }
    }
  }'
```

**4. Verificar logs do servidor:**
```
🆕 [HOTMART] Criando usuário: teste@exemplo.com
✅ [HOTMART] Usuário criado: uid123 (senha via link)
🔗 [ONBOARDING] Link gerado para: teste@exemplo.com
📧 [ONBOARDING] Enviando...
✅ [ONBOARDING] E-mail enviado!
```

**5. Abrir e-mail recebido:**
- Gmail do usuário teste
- Clicar em "Criar senha e acessar"

**6. Fluxo esperado:**
```
E-mail → Link → primeiro-acesso.html?oobCode=xxxxx 
→ Define senha 
→ Redireciona para /login.html?reset=success 
→ Toast verde "Senha definida!"
→ Login normal
```

---

### Teste em Produção (Railway)

**1. Deploy do backend:**
```bash
git add .
git commit -m "feat: onboarding clean premium + Firebase password reset"
git push origin main
```

**2. Configurar variáveis no Railway:**
```
APP_URL=https://soundyai.com.br
RESEND_API_KEY=re_live_xxxxxxxxxxxxx
EMAIL_FROM=SoundyAI <noreply@soundyai.com.br>
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

**3. Testar com compra real ou sandbox Hotmart:**
- Fazer compra teste no link da Hotmart
- Aguardar webhook (max 30s)
- Verificar e-mail do comprador

**4. Verificar logs no Railway:**
```bash
railway logs --tail
```

---

## 🔍 CASOS DE TESTE

### ✅ Caso 1: Novo usuário (nunca usou SoundyAI)
- **Entrada:** E-mail não existe no Firebase
- **Esperado:** 
  - Usuário criado sem senha
  - E-mail recebido com link de criar senha
  - Link abre primeiro-acesso.html
  - Define senha OK
  - Login funciona

### ✅ Caso 2: Usuário existente (recompra/upgrade)
- **Entrada:** E-mail já existe no Firebase
- **Esperado:**
  - Plano renovado
  - E-mail recebido com link de "redefinir senha"
  - Pode definir nova senha
  - Login funciona

### ❌ Caso 3: Link expirado (após 1 hora)
- **Entrada:** Abrir link antigo
- **Esperado:**
  - Mensagem: "Link expirado"
  - Botão desabilitado
  - Opção: "Voltar para login"

### ❌ Caso 4: Link inválido/já usado
- **Entrada:** Tentar usar link 2x
- **Esperado:**
  - Mensagem: "Link inválido ou já usado"
  - Solicitar novo link

### ❌ Caso 5: Senhas não coincidem
- **Entrada:** Senhas diferentes no form
- **Esperado:**
  - Erro: "As senhas não coincidem"
  - Form não envia

### ❌ Caso 6: Senha muito curta
- **Entrada:** Senha com menos de 6 chars
- **Esperado:**
  - Erro: "Mínimo 6 caracteres"
  - Form não envia

---

## 🎨 DESIGN SPECS

### E-mail (Clean Premium)
- **Paleta:** Fundo neutro (#f5f5f7), texto escuro (#1d1d1f), destaque roxo (#6366f1)
- **Tipografia:** System fonts (-apple-system, Segoe UI, Roboto)
- **Espaçamento:** Generoso (32-48px entre seções)
- **CTA:** Botão único, cor destaque, sem degradê pesado
- **Ícones:** Checkmarks minimalistas (✓)
- **Mobile:** Responsivo via tabelas HTML

### Página primeiro-acesso.html
- **Container:** 420px max-width, fundo branco, sombra suave
- **Inputs:** Border 2px, radius 10px, focus com glow roxo
- **Botão:** Roxo (#6366f1), hover com elevação sutil
- **Loading:** Spinner inline no botão
- **Mensagens:** Toast com border lateral colorida
- **Mobile:** Padding ajustado, fonte legível

---

## 📊 MONITORAMENTO

### Logs importantes

**Backend:**
```
🆕 [HOTMART] Criando usuário: {email}
✅ [HOTMART] Usuário criado: {uid} (senha via link)
🔗 [ONBOARDING] Link gerado para: {email}
📧 [ONBOARDING] Enviando...
✅ [ONBOARDING] E-mail enviado! {emailId}
```

**Frontend (console do navegador):**
```
✅ Código válido para: teste@exemplo.com
✅ Senha definida com sucesso!
❌ Erro ao verificar código: Link expirado
```

### Métricas sugeridas

- Taxa de cliques no link (Resend analytics)
- Taxa de conversão (link → senha definida)
- Tempo médio entre e-mail e primeiro login
- Taxa de erro "link expirado"

---

## ⚠️ TROUBLESHOOTING

### E-mail não chega
- Verificar `RESEND_API_KEY` é LIVE (não test)
- Verificar domínio `soundyai.com.br` está verificado no Resend
- Checar spam/lixeira
- Ver logs do Resend dashboard

### Link abre mas não funciona
- Verificar `APP_URL` está correto no backend
- Ver console do navegador (F12)
- Verificar Firebase config está correta
- Testar com link novo (gerar outro)

### Erro "Link expirado" imediato
- Firebase gera links com TTL de 1 hora
- Verificar relógio do servidor não está dessinc
- Gerar novo link

### "Senha muito fraca" mesmo com 6+ chars
- Firebase tem algoritmo próprio de força
- Usar letras + números + símbolos
- Mínimo 8 caracteres recomendado

---

## 🔄 ROLLBACK (se necessário)

Se houver problema crítico, reverter para versão anterior:

```bash
# Restaurar webhook antigo (com senha no e-mail)
git revert HEAD
git push origin main

# Ou editar manualmente:
# 1. Voltar import: sendWelcomeProEmail
# 2. Voltar createNewUser com tempPassword
# 3. Remover geração de link
```

---

## ✅ CHECKLIST DE DEPLOY

- [ ] Backend testado local (webhook simulado)
- [ ] E-mail chega e renderiza bem no Gmail
- [ ] Link do e-mail abre primeiro-acesso.html
- [ ] Senha é definida com sucesso
- [ ] Login funciona após definir senha
- [ ] Toast de sucesso aparece no login
- [ ] Tratamento de erros funciona (link expirado, senhas diferentes)
- [ ] Mobile funciona (teste em celular real)
- [ ] Variáveis de ambiente configuradas no Railway
- [ ] Logs no Railway mostram sucesso
- [ ] Teste de ponta-a-ponta em produção

---

## 📞 SUPORTE

Para dúvidas ou problemas:
1. Verificar logs do Railway
2. Verificar console do navegador (F12)
3. Verificar Resend dashboard
4. Verificar Firebase Authentication console
5. Revisar esta documentação

**Última atualização:** 04/01/2026
**Versão:** 3.0.0 (Clean Premium Onboarding)
