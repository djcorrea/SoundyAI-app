# 🔥 CRIAR PARCEIRO NO FIRESTORE (MANUAL)

**Parceiro:** Papo Hertz  
**ID:** papohertz  
**Data:** 27/01/2026

---

## 🎯 PASSO A PASSO - FIRESTORE CONSOLE

### 1️⃣ Acessar Firebase Console

1. Abra: https://console.firebase.google.com
2. Selecione o projeto: **soundy-ai**
3. No menu lateral esquerdo, clique em: **Firestore Database**

---

### 2️⃣ Criar Coleção "partners" (se não existir)

**Se a coleção já existir, pule para o Passo 3.**

1. Na tela do Firestore, clique em: **Start collection**
2. Em "Collection ID", digite: `partners`
3. Clique em **Next**
4. **NÃO adicione documento ainda** - clique em **Cancel** (vamos criar direto com o ID correto)

---

### 3️⃣ Adicionar Documento do Parceiro

1. Na coleção `partners`, clique em: **Add document**

2. Em **Document ID**, digite exatamente: `papohertz`

3. Agora adicione os campos UM POR UM:

#### Campo 1: partnerId
- **Field:** `partnerId`
- **Type:** `string`
- **Value:** `papohertz`

#### Campo 2: name
- **Field:** `name`
- **Type:** `string`
- **Value:** `Papo Hertz`

#### Campo 3: referralCode
- **Field:** `referralCode`
- **Type:** `string`
- **Value:** `papohertz`

#### Campo 4: email
- **Field:** `email`
- **Type:** `string`
- **Value:** `contato@papohertz.com` ⚠️ **AJUSTE se necessário**

#### Campo 5: commissionPercent
- **Field:** `commissionPercent`
- **Type:** `number`
- **Value:** `50`

#### Campo 6: active
- **Field:** `active`
- **Type:** `boolean`
- **Value:** `true` ✅ (marcado)

#### Campo 7: description (opcional)
- **Field:** `description`
- **Type:** `string`
- **Value:** `Parceiro oficial - Papo Hertz`

#### Campo 8: website (opcional)
- **Field:** `website`
- **Type:** `string`
- **Value:** `https://youtube.com/@papohertz` ⚠️ **AJUSTE se necessário**

#### Campo 9: tier (opcional)
- **Field:** `tier`
- **Type:** `string`
- **Value:** `gold`

#### Campo 10: createdAt
- **Field:** `createdAt`
- **Type:** `string`
- **Value:** `2026-01-27T14:30:00.000Z`

#### Campo 11: updatedAt
- **Field:** `updatedAt`
- **Type:** `string`
- **Value:** `2026-01-27T14:30:00.000Z`

4. Clique em **Save**

---

## ✅ RESULTADO ESPERADO

Você deve ver no Firestore:

```
partners (coleção)
 └─ papohertz (documento)
     ├─ partnerId: "papohertz"
     ├─ name: "Papo Hertz"
     ├─ referralCode: "papohertz"
     ├─ email: "contato@papohertz.com"
     ├─ commissionPercent: 50
     ├─ active: true
     ├─ description: "Parceiro oficial - Papo Hertz"
     ├─ website: "https://youtube.com/@papohertz"
     ├─ tier: "gold"
     ├─ createdAt: "2026-01-27T14:30:00.000Z"
     └─ updatedAt: "2026-01-27T14:30:00.000Z"
```

---

## 🔐 PASSO 2: CRIAR CONTA FIREBASE AUTH

### 1️⃣ Acessar Authentication

1. No menu lateral do Firebase Console, clique em: **Authentication**
2. Clique na aba: **Users**
3. Clique no botão: **Add user**

### 2️⃣ Preencher Dados

- **Email:** `contato@papohertz.com` ⚠️ **MESMO email do Firestore!**
- **Password:** `PapoHz2026!Soundy` (ou qualquer senha forte)

### 3️⃣ Confirmar

- Clique em **Add user**
- ✅ Anote a senha para enviar ao parceiro!

---

## 🎯 INFORMAÇÕES PARA O PARCEIRO

**Envie essas informações ao Papo Hertz:**

---

### 📧 Email Template

```
Olá, Papo Hertz!

Seu acesso ao painel de parceiro do SoundyAI está pronto! 🎉

🔗 ACESSE SEU PAINEL:
https://soundy.vercel.app/partner-dashboard.html

🔑 SUAS CREDENCIAIS:
Email: contato@papohertz.com
Senha: PapoHz2026!Soundy

📊 NO PAINEL VOCÊ VERÁ:
- Total de cadastros via seu link
- Assinantes ativos
- MRR gerado mensalmente
- Sua comissão (50% do MRR)

🎯 SEU LINK DE INDICAÇÃO:
https://soundy.vercel.app/?ref=papohertz

Use esse link em:
✅ Bio do Instagram/TikTok/YouTube
✅ Descrições de vídeos
✅ Posts e Stories
✅ Email marketing
✅ Anúncios

Qualquer dúvida, estamos à disposição!

Abraços,
Equipe SoundyAI
```

---

---

## 🧪 TESTAR SE FUNCIONOU

### Teste 1: Login no Painel

1. Acesse: https://soundy.vercel.app/partner-dashboard.html
2. Faça login com:
   - Email: `contato@papohertz.com`
   - Senha: (a que você definiu)
3. ✅ Se entrar e ver o painel = SUCESSO!

### Teste 2: Link de Indicação

1. Abra aba anônima
2. Acesse: https://soundy.vercel.app/?ref=papohertz
3. Abra console (F12) e digite:
   ```javascript
   localStorage.getItem('soundy_referral_code')
   ```
4. ✅ Se retornar `"papohertz"` = FUNCIONOU!

### Teste 3: Cadastro e Conversão (COMPLETO)

1. Com link `?ref=papohertz` aberto, crie uma conta teste
2. Vá no Firestore Console → `usuarios/{uid}` do usuário criado
3. Verifique se tem:
   ```javascript
   {
     referralCode: "papohertz",
     referralTimestamp: "2026-01-27...",
     convertedAt: null,
     firstPaidPlan: null
   }
   ```
4. ✅ Se tiver = CAPTURA FUNCIONOU!

5. (Opcional) Assine um plano com essa conta teste
6. Após webhook processar, verifique se `convertedAt` foi preenchido
7. ✅ Se foi preenchido = CONVERSÃO FUNCIONOU!

---

## ❓ PROBLEMAS COMUNS

### "Missing or insufficient permissions"
**Causa:** Firestore Rules não permitem leitura da coleção `partners`  
**Solução:** Verifique em `firestore.rules` se tem:
```javascript
match /partners/{partnerId} {
  allow read: if request.auth != null;
  allow write: if false;
}
```

### "Acesso negado" no painel
**Causa:** Email no Auth é diferente do email no Firestore  
**Solução:** Sincronize os emails (devem ser IDÊNTICOS)

### Link de indicação não salva
**Causa:** Script de captura não está no `index.html`  
**Solução:** Verifique se tem o script nas linhas 12-33 de `public/index.html`

---

## 📋 CHECKLIST FINAL

Antes de entregar ao parceiro:

- [ ] Documento criado em `partners/papohertz` no Firestore
- [ ] Conta criada em Firebase Auth com mesmo email
- [ ] Testado login em `partner-dashboard.html`
- [ ] Testado link `?ref=papohertz` captura no localStorage
- [ ] Email/senha enviados ao parceiro por canal seguro
- [ ] Parceiro sabe acessar o painel

---

## 📚 DOCUMENTAÇÃO COMPLETA

Para mais detalhes técnicos:
- [SISTEMA_AFILIADOS_DOCUMENTACAO.md](SISTEMA_AFILIADOS_DOCUMENTACAO.md)

---

✅ **PRONTO!** Agora é só seguir os passos acima no Firebase Console.
