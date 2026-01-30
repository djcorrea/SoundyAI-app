# 🐛 BUG FIX: ReferralCode sendo perdido no fluxo demo → cadastro

**Data:** 27/01/2026  
**Status:** ✅ CORRIGIDO  
**Prioridade:** 🔴 CRÍTICA

---

## 📋 PROBLEMA ORIGINAL

**Sintoma:**
- Usuário acessa com `?ref=papohertz`
- Usa o modo demo (sem criar conta)
- Cria conta depois
- Campo `referralCode` salvo como `null` no Firestore

**Impacto:**
- Parceiros perdem crédito por indicações
- MRR/comissões calculadas incorretamente
- Sistema de afiliados não funciona para fluxo demo → cadastro

---

## 🔍 CAUSA RAIZ

### Três pontos de falha identificados:

#### 1️⃣ **auth.js linha 197** - Logout por SMS não verificado
```javascript
// ❌ ANTES (ERRADO)
await auth.signOut();
localStorage.clear();  // ⚠️ APAGA O REFERRAL CODE!
```

**Cenário:**
- Usuário tenta fazer login mas SMS não está verificado
- Sistema força logout e limpa **TODO** o localStorage
- referralCode é perdido

#### 2️⃣ **script.js linha 607** - Logout geral
```javascript
// ❌ ANTES (ERRADO)
var adminBypass = localStorage.getItem('soundy_admin_bypass');
localStorage.clear();  // ⚠️ APAGA O REFERRAL CODE!
if (adminBypass) {
    localStorage.setItem('soundy_admin_bypass', adminBypass);
}
```

**Cenário:**
- Usuário faz logout após usar demo
- Sistema preserva apenas `admin_bypass`
- referralCode é perdido

#### 3️⃣ **index.html linha 1732** - Logout duplicado
```javascript
// ❌ ANTES (ERRADO)
var adminBypass = localStorage.getItem('soundy_admin_bypass');
localStorage.clear();  // ⚠️ APAGA O REFERRAL CODE!
if (adminBypass) {
    localStorage.setItem('soundy_admin_bypass', adminBypass);
}
```

**Cenário:**
- Mesmo problema do script.js, duplicado em index.html

---

## ✅ SOLUÇÃO IMPLEMENTADA

### Preservar referralCode em todos os pontos de limpeza

#### 1️⃣ **auth.js (linha 197)** - CORRIGIDO
```javascript
// ✅ DEPOIS (CORRETO)
await auth.signOut();

// 🔗 PRESERVAR referralCode antes de limpar localStorage
const referralCode = localStorage.getItem('soundy_referral_code');
const referralTimestamp = localStorage.getItem('soundy_referral_timestamp');
localStorage.clear();
if (referralCode) {
  localStorage.setItem('soundy_referral_code', referralCode);
  localStorage.setItem('soundy_referral_timestamp', referralTimestamp);
  console.log('🔗 [REFERRAL] Código preservado após logout:', referralCode);
}
```

#### 2️⃣ **script.js (linha 607)** - CORRIGIDO
```javascript
// ✅ DEPOIS (CORRETO)
// 🔗 Preservar dados importantes antes de limpar
var adminBypass = localStorage.getItem('soundy_admin_bypass');
var referralCode = localStorage.getItem('soundy_referral_code');
var referralTimestamp = localStorage.getItem('soundy_referral_timestamp');

localStorage.clear();

// Restaurar dados preservados
if (adminBypass) {
    localStorage.setItem('soundy_admin_bypass', adminBypass);
}
if (referralCode) {
    localStorage.setItem('soundy_referral_code', referralCode);
    localStorage.setItem('soundy_referral_timestamp', referralTimestamp);
    console.log('🔗 [REFERRAL] Código preservado após logout:', referralCode);
}
```

#### 3️⃣ **index.html (linha 1732)** - CORRIGIDO
```javascript
// ✅ DEPOIS (CORRETO)
// Mesmo código de script.js aplicado
```

#### 4️⃣ **auth.js (linha 1583)** - LOG DE DEBUG ADICIONADO
```javascript
// 🔍 Log adicional para facilitar debug
log('🔍 [REFERRAL-DEBUG] Lendo localStorage ANTES do cadastro...');
log('   localStorage.soundy_referral_code:', localStorage.getItem('soundy_referral_code'));
log('   localStorage.soundy_referral_timestamp:', localStorage.getItem('soundy_referral_timestamp'));

const referralCode = localStorage.getItem('soundy_referral_code') || null;
const referralTimestamp = localStorage.getItem('soundy_referral_timestamp') || null;
```

---

## 🧪 FLUXO DE TESTE

### Teste 1: Fluxo Demo → Cadastro (CRÍTICO)

1. Acessar com referência: `https://soundy.vercel.app/?ref=papohertz`
2. **Verificar console:**
   ```
   🔗 [REFERRAL] Código capturado: papohertz
   🕐 [REFERRAL] Timestamp: 2026-01-27T...
   ```

3. Usar sistema em modo demo (sem criar conta)
4. Rodar análises, usar chatbot, navegar entre telas

5. Fazer logout (botão sair)
6. **Verificar console:**
   ```
   🔗 [REFERRAL] Código preservado após logout: papohertz
   ```

7. Criar nova conta
8. **Verificar console:**
   ```
   🔍 [REFERRAL-DEBUG] Lendo localStorage ANTES do cadastro...
      localStorage.soundy_referral_code: papohertz
      localStorage.soundy_referral_timestamp: 2026-01-27T...
   🔗 [REFERRAL] Código detectado: papohertz
   🕐 [REFERRAL] Timestamp: 2026-01-27T...
   💾 [AUTH-LISTENER] Criando documento usuarios/ com dados:
   🧹 [REFERRAL] Código limpo do localStorage (usado com sucesso)
   ```

9. **Verificar Firestore:**
   ```javascript
   usuarios/{uid} {
     referralCode: "papohertz",         // ✅ NÃO NULL!
     referralTimestamp: "2026-01-27...",
     convertedAt: null,
     firstPaidPlan: null
   }
   ```

### Teste 2: Logout com SMS não verificado

1. Criar conta mas NÃO verificar SMS
2. Tentar fazer login
3. **Verificar console:**
   ```
   ⚠️ [SEGURANÇA] Login bloqueado - telefone não verificado no Auth
   🔗 [REFERRAL] Código preservado após logout: papohertz
   ```

4. **Verificar localStorage ainda tem:**
   ```javascript
   localStorage.getItem('soundy_referral_code')  // "papohertz"
   ```

### Teste 3: Múltiplos Logouts

1. Entrar com `?ref=papohertz`
2. Fazer logout 3x seguidas
3. **Verificar que referralCode sobrevive:**
   ```javascript
   localStorage.getItem('soundy_referral_code')  // "papohertz"
   ```

---

## 📊 ARQUIVOS MODIFICADOS

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `public/auth.js` | 197-213 | Preservar referralCode no logout SMS |
| `public/auth.js` | 1583-1589 | Adicionar log de debug |
| `public/script.js` | 600-622 | Preservar referralCode no logout |
| `public/index.html` | 1727-1747 | Preservar referralCode no logout |

---

## ✅ VALIDAÇÃO

### Antes (QUEBRADO)
```
Fluxo: ?ref=papohertz → demo → logout → cadastro
Resultado: referralCode = null ❌
```

### Depois (FUNCIONANDO)
```
Fluxo: ?ref=papohertz → demo → logout → cadastro
Resultado: referralCode = "papohertz" ✅
```

---

## 🎯 COMPORTAMENTO ESPERADO

1. **Captura persistente:**
   - `?ref=papohertz` salvo em localStorage
   - Sobrevive a navegação, demo, logouts

2. **Uso único:**
   - Usado apenas quando criar conta
   - Limpo APÓS salvar no Firestore (linha 1623-1624 de auth.js)

3. **Logs claros:**
   - Console mostra quando código é capturado
   - Console mostra quando código é preservado
   - Console mostra quando código é salvo no Firestore
   - Console mostra quando código é limpo

---

## 🔒 SEGURANÇA MANTIDA

- ✅ `admin_bypass` continua sendo preservado
- ✅ Todas as outras keys de auth são limpas corretamente
- ✅ Firebase Auth tokens continuam sendo invalidados
- ✅ sessionStorage continua sendo limpo
- ✅ Firestore Rules continuam protegendo contra fraudes

---

## 📝 NOTAS ADICIONAIS

### Funções `logout()` em auth.js e chat.js

Essas funções **NÃO foram modificadas** porque já usam remoção cirúrgica de keys:

```javascript
const keysToRemove = [
  'user',
  'idToken',
  'authToken',
  'firebase:authUser',
  'soundy_user_profile',
  'soundy_auth_state',
  'currentUserData'
];

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
});
```

Como usam `removeItem()` apenas nas keys específicas, **NÃO tocam no referralCode**.

### Por que não usar `sessionStorage`?

sessionStorage seria perdido ao abrir nova aba ou fechar navegador. Como o fluxo pode demorar (usuário pode voltar dias depois), **localStorage é a escolha correta**.

---

## 🚀 DEPLOY

**Status:** ✅ Pronto para produção

**Checklist antes do deploy:**
- [x] Correções aplicadas em 3 arquivos
- [x] Logs de debug adicionados
- [x] Comportamento validado localmente
- [ ] Testar em staging
- [ ] Deploy em produção
- [ ] Monitorar logs nos primeiros cadastros
- [ ] Validar no Firestore que referralCode não está mais null

---

**Fix implementado em:** 27/01/2026  
**Responsável:** Sistema IA Sênior (Claude Sonnet 4.5)
