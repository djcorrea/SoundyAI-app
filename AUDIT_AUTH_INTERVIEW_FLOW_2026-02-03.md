# 🔍 AUDITORIA COMPLETA - FLUXO DE AUTENTICAÇÃO E ENTREVISTA
## SoundyAI - Análise de Sistema de Planos e Redirecionamentos

**Data:** 03/02/2026  
**Objetivo:** Transformar entrevista em benefício premium (PRO/STUDIO) e remover do fluxo FREE

---

## 📋 1. SITUAÇÃO ATUAL

### 1.1 Fluxo de Cadastro/Login Atual

#### **Arquivo:** [public/auth.js](public/auth.js)

**Linha 213-214:** Login - Usuário novo sem Firestore
```javascript
// Usuário não existe no Firestore - redirecionar para entrevista
window.location.href = "entrevista.html";
```

**Linha 288-295:** Login - Verificação entrevistaConcluida
```javascript
if (userData.entrevistaConcluida === false) {
  window.location.href = "entrevista.html";
} else {
  window.location.href = "index.html";
}
```

**Linha 421-424:** Login Google - Redirecionamento entrevista
```javascript
if (userData.entrevistaConcluida === false) {
  log('🎯 [GOOGLE-AUTH] Redirecionando para entrevista');
  window.location.href = "entrevista.html";
}
```

**Linha 1255-1258:** Confirmação de cadastro
```javascript
log('🚀 [CONFIRM] Redirecionando para entrevista.html em 1.5s...');
setTimeout(() => {
  window.location.replace("entrevista.html");
}, 1500);
```

**Linha 1930-1938:** onAuthStateChanged - Verificação entrevista
```javascript
if (snap.exists() && snap.data().entrevistaConcluida === false) {
  window.location.href = "entrevista.html";
} else if (snap.exists() && snap.data().entrevistaConcluida === true) {
  window.location.href = "entrevista.html"; // BUG: deveria ir para index
} else {
  window.location.href = "entrevista.html";
}
```

### 1.2 Estrutura da Entrevista

#### **Arquivo:** [public/entrevista.html](public/entrevista.html)

- Formulário de personalização com 6 perguntas:
  1. Nome artístico
  2. Nível técnico (Iniciante/Intermediário/Avançado/Profissional)
  3. DAW utilizada
  4. Estilo musical
  5. Maior dificuldade
  6. Sobre você

#### **Arquivo:** [public/entrevista.js](public/entrevista.js)

**Linha 67-73:** Salva perfil no Firestore
```javascript
await db.collection('usuarios').doc(user.uid).set({
  perfil: answers,
  entrevistaConcluida: true
}, { merge: true });

log('🎉 Entrevista concluída - redirecionando para index.html');
window.location.href = 'index.html';
```

### 1.3 Sistema de Planos

#### **Arquivo:** [work/lib/user/userPlans.js](work/lib/user/userPlans.js)

**Planos disponíveis:**
- **FREE:** 1 análise/mês, 20 mensagens/mês
- **PLUS:** 20 análises/mês, 80 mensagens/mês
- **PRO:** 60 análises/mês, mensagens ilimitadas, modo referência
- **STUDIO:** 400 análises/mês (hard cap), mensagens ilimitadas, plano correção
- **DJ:** Beta temporário (15 dias) com features PRO

**Campo entrevistaConcluida:**
- Usado em verificações de autenticação
- Campo `perfil` contém respostas da entrevista
- Preservado durante normalização de planos (linha 277-282)

### 1.4 Webhooks de Pagamento

#### **Arquivo:** [work/api/webhook/stripe.js](work/api/webhook/stripe.js)

**Linha 126-264:** handleCheckoutCompleted
- Processa evento `checkout.session.completed`
- Ativa plano PLUS/PRO/STUDIO no Firestore
- **NÃO adiciona flag de "recém-ativado"**
- **NÃO redireciona para entrevista**

---

## ⚠️ 2. PROBLEMAS IDENTIFICADOS

### 2.1 Entrevista Forçada para FREE
❌ Todos os usuários (inclusive FREE) são forçados a preencher entrevista após cadastro
❌ Bloqueia acesso ao app principal até completar formulário
❌ Pode causar abandono de novos usuários

### 2.2 Lógica Inconsistente
❌ `entrevistaConcluida: true` ainda redireciona para entrevista (linha 1932)
❌ Não há verificação de plano antes de mostrar entrevista
❌ Entrevista acessível via URL direta por qualquer plano

### 2.3 Falta Sistema de Convite Pós-Upgrade
❌ Usuário que faz upgrade não é notificado sobre entrevista
❌ Não há modal de "personalize sua experiência"
❌ Benefício premium não é apresentado adequadamente

### 2.4 Sem Proteção Backend
❌ Entrevista não valida plano no backend
❌ Qualquer usuário pode salvar perfil via Firestore

---

## ✅ 3. SOLUÇÃO PROPOSTA

### 3.1 Novo Fluxo FREE

```
Cadastro → Auth Confirmado → index.html (app principal)
                                ↓
                          (entrevista nunca aparece)
```

### 3.2 Novo Fluxo PRO/STUDIO (Pós-Upgrade)

```
Pagamento Confirmado → Webhook marca flag: needsInterviewInvite: true
                              ↓
      Próximo login/refresh → Modal aparece: "Personalize sua experiência"
                              ↓
              [Personalizar agora] → entrevista.html
                        ou
              [Fazer depois] → index.html (flag permanece)
```

### 3.3 Campos Firestore (usuarios collection)

**Adicionar:**
```javascript
{
  needsInterviewInvite: boolean,      // true após upgrade, false após mostrar modal
  interviewInviteShownAt: timestamp,  // quando modal foi mostrado
  entrevistaConcluida: boolean,       // se preencheu entrevista
  perfil: object,                     // respostas da entrevista (se concluída)
  plan: string                        // free/plus/pro/studio/dj
}
```

---

## 🛠️ 4. IMPLEMENTAÇÃO

### 4.1 Arquivo: auth.js (Frontend)

#### Mudança #1: Remover redirecionamento forçado para entrevista no cadastro
**Linha 213-214 (REMOVER)**
**Linha 1255-1258 (ALTERAR)**

#### Mudança #2: Verificar plano antes de redirecionar para entrevista
**Linha 288-295 (ALTERAR)**

#### Mudança #3: Corrigir lógica onAuthStateChanged
**Linha 1930-1938 (CORRIGIR)**

### 4.2 Arquivo: entrevista.html (Frontend)

#### Mudança #1: Adicionar verificação de plano no carregamento

### 4.3 Arquivo: entrevista.js (Frontend)

#### Mudança #1: Bloquear acesso FREE
#### Mudança #2: Marcar needsInterviewInvite como false após conclusão

### 4.4 Arquivo: stripe.js (Backend - Webhook)

#### Mudança #1: Adicionar flag needsInterviewInvite no checkout completed

### 4.5 Arquivo: userPlans.js (Backend)

#### Mudança #1: Preservar needsInterviewInvite na normalização

### 4.6 Novo Arquivo: interview-invite-modal.js (Frontend)

#### Sistema de modal pós-upgrade

---

## 🎯 5. CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Remover redirecionamento forçado FREE → entrevista
- [ ] Adicionar verificação de plano em entrevista.html
- [ ] Criar modal de convite pós-upgrade
- [ ] Adicionar flag needsInterviewInvite no webhook
- [ ] Implementar detecção de flag no frontend
- [ ] Bloquear acesso FREE à entrevista (frontend)
- [ ] Adicionar validação de plano na API de salvar perfil
- [ ] Testar fluxo FREE completo
- [ ] Testar fluxo PRO/STUDIO completo
- [ ] Testar proteção de URL direta

---

## 📊 6. IMPACTO ESPERADO

### Conversão
✅ Usuários FREE chegam direto ao app (reduz fricção)
✅ Entrevista vira diferencial premium (aumenta valor percebido)
✅ Modal pós-upgrade apresenta benefício no momento certo

### Segurança
✅ Entrevista bloqueada para FREE (frontend + backend)
✅ Flags de controle no Firestore
✅ Validação consistente em todos os fluxos

### Experiência
✅ FREE não é bloqueado por formulário desnecessário
✅ PRO/STUDIO vê benefício personalizado
✅ Modal não invasivo (pode adiar)

---

## 🚨 7. RISCOS E MITIGAÇÕES

### Risco: Usuários antigos com entrevistaConcluida: false
**Mitigação:** Normalizar automaticamente FREE para `entrevistaConcluida: true`

### Risco: URL direta para entrevista.html
**Mitigação:** Verificação de plano na página + redirect automático

### Risco: Race condition no modal pós-upgrade
**Mitigação:** Flag persistente no Firestore, não em localStorage

---

## 📝 8. PRÓXIMOS PASSOS

1. ✅ Auditoria completa (este documento)
2. 🔄 Implementação das mudanças (em andamento)
3. ⏳ Testes unitários de cada fluxo
4. ⏳ Deploy gradual (teste → produção)
5. ⏳ Monitoramento de conversão pós-deploy
