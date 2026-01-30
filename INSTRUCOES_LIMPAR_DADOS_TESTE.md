# 🧹 INSTRUÇÕES: LIMPAR DADOS DE TESTE

## ⚠️ IMPORTANTE
Execute estas etapas no **Firebase Console** para apagar dados de teste SEM quebrar a lógica do sistema.

---

## 📋 ETAPA 1: APAGAR VISITANTES DE TESTE

### Acesse Firestore
1. Abra [Firebase Console](https://console.firebase.google.com/)
2. Selecione projeto: **prodai-58436**
3. Menu lateral → **Firestore Database**
4. Clique na coleção: **`referral_visitors`**

### Identifique documentos de teste
Procure por:
- `partnerId: "papohertz"` ou qualquer ID de teste
- `registered: false` e data muito antiga
- Documentos com dados de teste óbvios

### Delete documentos
1. Clique no documento
2. Botão ⋮ (três pontos) → **Delete document**
3. Confirme

**ATENÇÃO:** NÃO delete a coleção inteira, apenas documentos de teste.

---

## 📋 ETAPA 2: APAGAR USUÁRIOS DE TESTE (OPCIONAL)

### Acesse coleção usuarios
1. Firestore Database → coleção **`usuarios`**
2. Procure por usuários com:
   - `referralCode: "papohertz"` (ou ID de teste)
   - Email de teste
   - Plan: "free" e sem atividade

### Delete usuários de teste
1. Clique no documento
2. Botão ⋮ → **Delete document**
3. Confirme

---

## ✅ SISTEMA ESTÁ PRONTO PARA VÁRIOS INFLUENCERS

### 🎯 COMO FUNCIONA
O sistema **JÁ É MULTI-INFLUENCER**, cada parceiro tem:

1. **Coleção `partners`** (Firestore)
   - Documento por parceiro (ID = código de referral)
   - Exemplo: `papohertz`, `estudioherta`, `influencerX`

2. **Login independente**
   - Cada parceiro faz login com seu email/senha
   - Vê APENAS seus dados

3. **Links únicos**
   - `https://soundyai.com/?ref=papohertz`
   - `https://soundyai.com/?ref=influencerX`

---

## 📝 COMO ADICIONAR NOVO INFLUENCER

### Passo 1: Criar documento em `partners`
No Firestore Console:

```
Coleção: partners
Documento ID: influencerX  ← (código único do parceiro)

Campos:
{
  "name": "Nome do Influencer",
  "email": "influencer@gmail.com",
  "referralCode": "influencerX",
  "commissionPercent": 30,
  "active": true,
  "createdAt": [timestamp atual],
  "totalEarnings": 0
}
```

### Passo 2: Criar conta no Firebase Auth
1. Firebase Console → **Authentication**
2. Botão **Add user**
3. Email: `influencer@gmail.com`
4. Senha: `senha_segura_123`
5. Envie credenciais para o parceiro

### Passo 3: Parceiro acessa o painel
```
URL: https://soundyai.com/partner-dashboard.html

Login:
Email: influencer@gmail.com
Senha: senha_segura_123
```

### Passo 4: Parceiro divulga seu link
```
https://soundyai.com/?ref=influencerX
```

---

## 🔐 SEGURANÇA

✅ **Cada parceiro vê APENAS seus dados**
- Query: `where('partnerId', '==', 'influencerX')`
- Isolamento total por código

✅ **Não há limite de parceiros**
- Pode adicionar quantos quiser

✅ **Sistema escalável**
- Backend usa Admin SDK
- Frontend filtra por partnerId

---

## 📊 EXEMPLO COMPLETO: 3 INFLUENCERS

### Firestore `partners`
```
partners/
  papohertz/
    name: "Papo Hertz"
    email: "papohertz@gmail.com"
    referralCode: "papohertz"
    commissionPercent: 30
    active: true
  
  estudioherta/
    name: "Estúdio Herta"
    email: "estudio@herta.com"
    referralCode: "estudioherta"
    commissionPercent: 25
    active: true
  
  djcorrea/
    name: "DJ Correa"
    email: "dj@soundyai.com"
    referralCode: "djcorrea"
    commissionPercent: 40
    active: true
```

### Firebase Auth
```
Users:
- papohertz@gmail.com (senha: xxx)
- estudio@herta.com (senha: yyy)
- dj@soundyai.com (senha: zzz)
```

### Links de divulgação
```
https://soundyai.com/?ref=papohertz
https://soundyai.com/?ref=estudioherta
https://soundyai.com/?ref=djcorrea
```

### Visitantes rastreados
```
referral_visitors/
  uuid-1/
    partnerId: "papohertz"
    registered: true
    uid: "firebase-uid-123"
  
  uuid-2/
    partnerId: "estudioherta"
    registered: false
  
  uuid-3/
    partnerId: "djcorrea"
    registered: true
    uid: "firebase-uid-456"
```

---

## 🎯 CONFIRMAÇÃO FINAL

### ✅ SISTEMA ATUAL
- **Multi-influencer**: SIM
- **Limite de parceiros**: Nenhum
- **Isolamento de dados**: Total
- **Pronto para uso**: SIM

### 🚀 PARA COMEÇAR
1. Limpe dados de teste (Firestore Console)
2. Crie documento em `partners` para cada influencer
3. Crie conta no Authentication
4. Envie credenciais + link personalizado

### 📞 SUPORTE
Qualquer dúvida, pode chamar!

---

**Documentação gerada em:** 29/01/2026  
**Status:** ✅ Sistema multi-influencer ativo e funcional
