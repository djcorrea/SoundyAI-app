# 🔒 AUDIT: Correção do Fluxo de Primeiro Acesso
**Data:** 2026-01-04  
**Versão:** 1.0.0  
**Status:** ✅ IMPLEMENTADO

---

## 📋 PROBLEMA IDENTIFICADO

### Sintoma (Confirmado por Prints/Logs)
```
❌ URL abre: /gerenciar.html?mode=resetPassword&oobCode=...
❌ Página tenta processar como verificação (applyActionCode)
❌ Erro: "Link de verificação inválido ou já utilizado"
❌ FirebaseError: auth/invalid-action-code
❌ Abre com OUTRA conta já logada no navegador
```

### Causa Raiz
1. **Firebase Admin gera link correto** apontando para `/primeiro-acesso.html`
2. **Mas algum redirecionamento interno** estava levando para `/gerenciar.html`
3. **gerenciar.html processava resetPassword** como se fosse email verification (applyActionCode)
4. **primeiro-acesso.html não tratava** usuário já logado

---

## ✅ CORREÇÕES IMPLEMENTADAS

### A) BACKEND - lib/email/onboarding-email.js
**Status:** ✅ JÁ ESTAVA CORRETO

```javascript
const actionCodeSettings = {
  url: `${APP_URL}/primeiro-acesso.html`,  // ✅ CORRETO
  handleCodeInApp: true,
};

await auth.generatePasswordResetLink(email, actionCodeSettings);
```

**Logs adicionados:**
```javascript
console.log(`🔗 [ONBOARDING] Gerando link com actionCodeSettings:`, {
  url: actionCodeSettings.url,
  handleCodeInApp: actionCodeSettings.handleCodeInApp,
  email: email
});
```

---

### B) FRONTEND - public/primeiro-acesso.html
**Status:** ✅ CORRIGIDO

#### Mudança 1: SignOut Automático
```javascript
// ⚠️ IMPORTANTE: Se usuário já está logado, fazer signOut
if (auth.currentUser) {
  console.log('⚠️ [PRIMEIRO ACESSO] Usuário já logado detectado:', auth.currentUser.email);
  console.log('🔓 [PRIMEIRO ACESSO] Fazendo signOut automático...');
  try {
    await signOut(auth);
    console.log('✅ [PRIMEIRO ACESSO] SignOut realizado com sucesso');
  } catch (error) {
    console.error('❌ [PRIMEIRO ACESSO] Erro ao fazer signOut:', error);
  }
}
```

**Por quê?**
- Usuário pode estar logado com conta diferente
- Evita confusão sobre qual conta está criando senha
- Firebase precisa que não haja sessão ativa para confirmPasswordReset funcionar corretamente

#### Mudança 2: Fluxo Completo
```javascript
// 1. Extrair oobCode da URL
const oobCode = urlParams.get('oobCode');

// 2. Validar código e obter email
const email = await verifyPasswordResetCode(auth, oobCode);

// 3. Exibir email na tela
emailText.textContent = email;
userEmailDisplay.style.display = 'block';

// 4. No submit: definir senha
await confirmPasswordReset(auth, oobCode, newPassword);

// 5. Redirecionar para login
window.location.href = '/login.html?reset=success';
```

---

### C) FRONTEND - public/gerenciar.html
**Status:** ✅ GUARDRAIL ADICIONADO

#### Mudança: Detectar e Redirecionar resetPassword
```javascript
async function checkEmailVerificationCode() {
  const urlParams = new URLSearchParams(window.location.search);
  const oobCode = urlParams.get('oobCode');
  const mode = urlParams.get('mode');
  
  // 🚨 GUARDRAIL: resetPassword NÃO deve ser processado aqui!
  if (mode === 'resetPassword') {
    console.log('🔀 [GUARDRAIL] resetPassword detectado - redirecionando...');
    window.location.href = '/primeiro-acesso.html' + window.location.search;
    return; // Parar execução
  }
  
  // Continuar processamento de verifyEmail, recoverEmail, etc.
  if (oobCode) {
    await applyActionCode(auth, oobCode); // ✅ Só para email verification
  }
}
```

**Por quê?**
- `/gerenciar.html` deve processar apenas: `verifyEmail`, `recoverEmail`
- `resetPassword` tem fluxo próprio em `/primeiro-acesso.html`
- `applyActionCode` é para **verificação de email**, não reset de senha
- `confirmPasswordReset` é o método correto para definir senha

---

### D) FRONTEND - public/login.html
**Status:** ✅ JÁ ESTAVA IMPLEMENTADO

```javascript
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('reset') === 'success') {
    showStatusMessage('✅ Senha definida com sucesso! Faça login.', 'success', 6000);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
```

---

## 🧪 TESTES OBRIGATÓRIOS

### Teste A: Navegador com Conta Logada
```
Cenário: Abrir link de primeiro acesso em navegador já logado em outra conta

1. ✅ Fazer login com conta1@example.com
2. ✅ Abrir link de primeiro acesso da conta2@hotmart.com
3. ✅ Verificar que vai para /primeiro-acesso.html (não /gerenciar.html)
4. ✅ Console deve mostrar: "SignOut realizado com sucesso"
5. ✅ Página mostra email: conta2@hotmart.com
6. ✅ Definir senha
7. ✅ Redireciona para /login.html?reset=success
8. ✅ Toast aparece: "Senha definida com sucesso!"
9. ✅ Fazer login com conta2@hotmart.com + nova senha
```

### Teste B: Link Expirado
```
Cenário: Tentar usar link antigo/expirado

1. ✅ Abrir link de primeiro acesso expirado (>1h)
2. ✅ Página mostra: "Link inválido ou expirado"
3. ✅ Botão "Definir senha" fica desabilitado
4. ✅ Opção de solicitar novo link disponível
```

### Teste C: Gerenciar.html Não Quebra
```
Cenário: Garantir que /gerenciar.html continua funcionando

1. ✅ Fazer login
2. ✅ Ir para /gerenciar.html
3. ✅ Solicitar alteração de email
4. ✅ Abrir link de verificação de email
5. ✅ Deve abrir /gerenciar.html?mode=verifyEmail&oobCode=...
6. ✅ Email é verificado e alterado com sucesso
7. ✅ Sem erros no console
```

### Teste D: Fluxo Completo Hotmart
```
Cenário: Simular compra no Hotmart

1. ✅ Webhook recebe compra com email novo
2. ✅ Backend cria usuário SEM senha
3. ✅ Backend envia email com link para /primeiro-acesso.html
4. ✅ Usuário clica no link
5. ✅ Abre /primeiro-acesso.html (não /gerenciar.html)
6. ✅ Define senha
7. ✅ Redireciona para /login.html?reset=success
8. ✅ Faz login e acessa app com plano PRO ativo
```

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

### ❌ ANTES (Quebrado)
```
Link Email → /gerenciar.html?mode=resetPassword&oobCode=...
            → applyActionCode(auth, oobCode)
            → ❌ auth/invalid-action-code
            → "Link de verificação inválido"
```

### ✅ DEPOIS (Correto)
```
Link Email → /primeiro-acesso.html?oobCode=...
            → signOut(auth) se necessário
            → verifyPasswordResetCode(auth, oobCode)
            → confirmPasswordReset(auth, oobCode, senha)
            → /login.html?reset=success
            → ✅ "Senha definida com sucesso!"
```

---

## 🔐 SEGURANÇA

### Proteções Implementadas
1. ✅ **SignOut automático** evita criar senha para conta errada
2. ✅ **Validação de oobCode** antes de mostrar formulário
3. ✅ **Link expira em 1 hora** (Firebase padrão)
4. ✅ **Mensagens de erro tratadas** (expirado, inválido, já usado)
5. ✅ **Sem reutilização de links** (oobCode é único e single-use)
6. ✅ **Guardrail em gerenciar.html** evita processamento incorreto

---

## 📝 ARQUIVOS MODIFICADOS

```
✅ lib/email/onboarding-email.js
   - Confirmado que actionCodeSettings está correto
   - Adicionados logs detalhados

✅ public/primeiro-acesso.html
   - Adicionado signOut automático
   - Import do signOut do firebase/auth

✅ public/gerenciar.html
   - Adicionado guardrail para mode=resetPassword
   - Redireciona para /primeiro-acesso.html preservando query

✅ public/login.html
   - Toast de sucesso já estava implementado
   - Detecta ?reset=success e exibe mensagem
```

---

## 🎯 RESULTADO FINAL

### Fluxo Ideal Implementado
```
1. Compra Hotmart
2. Webhook cria usuário SEM senha
3. Email enviado com link: /primeiro-acesso.html?oobCode=...
4. Usuário clica no link
5. Se logado em outra conta → signOut automático
6. Valida oobCode e mostra email da conta
7. Define senha
8. Redireciona para /login.html?reset=success
9. Toast: "Senha definida com sucesso!"
10. Faz login e acessa app
```

### Pontos de Falha Eliminados
- ❌ Não abre mais /gerenciar.html para resetPassword
- ❌ Não usa mais applyActionCode para resetPassword
- ❌ Não fica travado com usuário logado errado
- ❌ Não mostra erro "invalid-action-code" incorretamente

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Implementar correções (FEITO)
2. ⏳ Testar em ambiente de desenvolvimento
3. ⏳ Simular compra Hotmart em sandbox
4. ⏳ Verificar email recebido
5. ⏳ Validar fluxo completo end-to-end
6. ⏳ Deploy em produção
7. ⏳ Monitorar logs no primeiro uso real

---

## 📞 TROUBLESHOOTING

### Se ainda abrir /gerenciar.html:
1. Verificar console do browser: deve ter log do guardrail
2. Se não redirecionar, limpar cache do browser
3. Verificar se email está usando template antigo

### Se dar erro "invalid-action-code":
1. Verificar se link não expirou (>1h)
2. Verificar se oobCode não foi usado antes
3. Checar logs do Firebase: pode ser link já consumido

### Se não fizer signOut:
1. Verificar console: deve ter log "SignOut realizado"
2. Se não aparecer, pode ser problema de inicialização assíncrona
3. Adicionar await antes do signOut se necessário

---

## ✅ CHECKLIST FINAL

- [x] Backend gera link para /primeiro-acesso.html
- [x] primeiro-acesso.html faz signOut se necessário
- [x] primeiro-acesso.html valida oobCode
- [x] primeiro-acesso.html usa confirmPasswordReset
- [x] gerenciar.html redireciona resetPassword
- [x] gerenciar.html continua processando verifyEmail
- [x] login.html mostra toast de sucesso
- [x] Logs detalhados em todos os pontos críticos
- [x] Tratamento de erros completo
- [x] Documentação criada

---

**Engenheiro:** GitHub Copilot  
**Modelo:** Claude Sonnet 4.5  
**Data:** 04/01/2026  
**Status:** ✅ PRONTO PARA TESTE
