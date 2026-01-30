# 🤝 CRIAR PARCEIRO: PAPO HERTZ

**Data:** 27/01/2026  
**Parceiro:** Papo Hertz  
**ID:** papohertz

---

## 📋 PASSO A PASSO

### ✅ PASSO 1: Ajustar Email (se necessário)

Edite [scripts/create-partner.js](scripts/create-partner.js) linha 169 e confirme o email:

```javascript
email: 'contato@papohertz.com',  // ⚠️ ALTERE para o email REAL do parceiro
```

**⚠️ IMPORTANTE:** Use o mesmo email que será criado no Firebase Auth!

---

### ✅ PASSO 2: Executar Script (Criar no Firestore)

```powershell
# No terminal do projeto
cd scripts
node create-partner.js
```

**Resultado esperado:**
```
========================================
🤝 GERENCIADOR DE PARCEIROS - SoundyAI
========================================

🆕 [CREATE-PARTNER] Criando parceiro...
   ID: papohertz
   Nome: Papo Hertz
   Email: contato@papohertz.com
   Comissão: 50%

✅ [CREATE-PARTNER] Parceiro criado com sucesso!
```

**O que foi criado:**
- ✅ Documento em Firestore: `partners/papohertz`
- ✅ Código de referência: `papohertz`
- ✅ Status: Ativo (pode gerar conversões)

---

### ✅ PASSO 3: Criar Conta Firebase Auth

**Opção A: Via Firebase Console (recomendado)**

1. Acesse: https://console.firebase.google.com
2. Selecione projeto: **soundy-ai**
3. Menu lateral: **Authentication** → **Users**
4. Clicar: **Add User**
5. Preencher:
   - **Email:** `contato@papohertz.com` (mesmo do Firestore!)
   - **Password:** *(definir uma senha forte, ex: `PapoHz2026!Strong`)*
6. Clicar: **Add User**

**Opção B: Via Firebase Admin SDK (script)**

```javascript
// Adicionar ao final de scripts/create-partner.js (se preferir automatizar)
const auth = admin.auth();

await auth.createUser({
  email: 'contato@papohertz.com',
  password: 'PapoHz2026!Strong',  // ⚠️ Envie essa senha pro parceiro por canal seguro
  displayName: 'Papo Hertz'
});

console.log('✅ Conta Firebase Auth criada!');
```

---

### ✅ PASSO 4: Testar Acesso do Parceiro

**Link do painel:**
```
https://soundy.vercel.app/partner-dashboard.html
```

**Credenciais para o parceiro:**
- **Email:** `contato@papohertz.com`
- **Senha:** *(a que você definiu no Passo 3)*

**O que o parceiro verá:**
- 📊 Total de Cadastros
- 👥 Assinantes Ativos
- 💰 MRR Gerado
- 🎯 Comissão (50%)

---

### ✅ PASSO 5: Gerar Link de Indicação

**Link para o parceiro divulgar:**
```
https://soundy.vercel.app/?ref=papohertz
```

**Onde usar:**
- Bio do Instagram/TikTok
- Descrição de vídeos YouTube
- Posts em redes sociais
- Email marketing
- Stories com link

---

## 🧪 TESTAR FLUXO COMPLETO

### Teste 1: Captura de Referência
1. Acessar: `https://soundy.vercel.app/?ref=papohertz`
2. Abrir console do navegador (F12)
3. Verificar log: `🔗 [REFERRAL] Código capturado: papohertz`
4. Verificar localStorage:
   ```javascript
   localStorage.getItem('soundy_referral_code')  // Deve retornar: "papohertz"
   ```

### Teste 2: Cadastro com Referência
1. Criar nova conta no site
2. Após login, ir ao Firebase Console → Firestore → `usuarios/{uid}`
3. Verificar campos:
   ```javascript
   {
     referralCode: "papohertz",
     referralTimestamp: "2026-01-27T...",
     convertedAt: null,
     firstPaidPlan: null
   }
   ```

### Teste 3: Conversão (Pagamento)
1. Usar conta criada no Teste 2
2. Assinar plano PLUS/PRO/STUDIO (Stripe)
3. Após webhook processar, verificar Firestore:
   ```javascript
   {
     referralCode: "papohertz",
     convertedAt: "2026-01-27T...",  // ✅ Marcado!
     firstPaidPlan: "plus"
   }
   ```

### Teste 4: Painel do Parceiro
1. Login em `partner-dashboard.html` com credenciais
2. Verificar se aparece o usuário do Teste 2
3. Confirmar métricas:
   - Total Cadastros: 1
   - Assinantes Ativos: 1
   - MRR: R$ 47,99 (se PLUS)
   - Comissão: R$ 23,99 (50%)

---

## 🔍 VERIFICAR CRIAÇÃO

**No Firestore Console:**
```
partners/papohertz {
    partnerId: "papohertz",
    name: "Papo Hertz",
    email: "contato@papohertz.com",
    referralCode: "papohertz",
    commissionPercent: 50,
    active: true,
    createdAt: "2026-01-27T...",
    updatedAt: "2026-01-27T..."
}
```

**No Firebase Auth:**
```
Email: contato@papohertz.com
Provider: Password
UID: (gerado automaticamente)
```

---

## 📧 INFORMAR O PARCEIRO

**Template de email:**

```
Olá, Papo Hertz!

Seu acesso ao painel de parceiro do SoundyAI foi criado com sucesso! 🎉

🔗 Acesse seu painel:
https://soundy.vercel.app/partner-dashboard.html

🔑 Suas credenciais:
Email: contato@papohertz.com
Senha: [SENHA_DEFINIDA]

📊 No painel você pode acompanhar:
- Total de cadastros via seu link
- Assinantes ativos
- MRR gerado
- Sua comissão (50%)

🎯 Seu link de indicação:
https://soundy.vercel.app/?ref=papohertz

Compartilhe esse link nas suas redes sociais, descrições de vídeos, bio, etc.

Qualquer dúvida, estamos à disposição!

Equipe SoundyAI
```

---

## 🛠 COMANDOS ÚTEIS

**Listar todos os parceiros:**
```powershell
cd scripts
node create-partner.js
# (a função listPartners() é chamada automaticamente)
```

**Desativar parceiro:**
```javascript
// Editar create-partner.js e adicionar:
await deactivatePartner('papohertz');
```

**Atualizar comissão:**
```javascript
// Editar create-partner.js e adicionar:
await updatePartner('papohertz', {
  commissionPercent: 40  // Alterar de 50% para 40%
});
```

---

## ✅ CHECKLIST

Antes de entregar para o parceiro, confirmar:

- [ ] Documento criado no Firestore (`partners/papohertz`)
- [ ] Conta criada no Firebase Auth (email + senha)
- [ ] Testado login no `partner-dashboard.html`
- [ ] Testado fluxo completo (captura → cadastro → conversão)
- [ ] Link de indicação funcional (`?ref=papohertz`)
- [ ] Email/senha enviados ao parceiro por canal seguro
- [ ] Parceiro sabe como usar o painel

---

## 📚 DOCUMENTAÇÃO COMPLETA

Para mais detalhes, consulte:
- [SISTEMA_AFILIADOS_DOCUMENTACAO.md](SISTEMA_AFILIADOS_DOCUMENTACAO.md)

---

**Criado em:** 27/01/2026  
**Status:** ✅ PRONTO PARA EXECUÇÃO
