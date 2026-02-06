# 🔓 GUIA DE INTEGRAÇÃO: Desbloquear First Analysis Lock após Upgrade

## 📋 Quando Usar

Após o usuário fazer upgrade **REAL** de plano FREE → Plus/Pro/Studio através de:
- ✅ Pagamento Stripe confirmado (webhook)
- ✅ Pagamento Hotmart confirmado (webhook)
- ✅ Atualização do Firestore campo `plan` para `plus`, `pro` ou `studio`

## 🔐 Como Funciona o Lock

O sistema V5 cria um **lock global persistente** quando detecta:
- Usuário no plano FREE
- Primeira análise completa (full)
- Flag `isFirstFreeAnalysis === true` OU flag `hasCompletedFirstFreeAnalysis === false`

Este lock:
- ✅ Bloqueia sugestões inteligentes com blur
- ✅ Intercepta cliques em "Pedir ajuda IA"
- ✅ Intercepta cliques em "Baixar relatório PDF"
- ✅ Exibe CTA de upgrade após 35 segundos
- ❌ **NÃO pode ser removido** exceto com razão `'UPGRADE_TO_PAID_PLAN'`

## 🚀 Implementação no Frontend

### Opção 1: Chamar após atualização de plano detectada

```javascript
// Em auth.js ou plan-capabilities.js
// Quando Firebase Auth ou Firestore listener detectar mudança de plano

function onUserPlanUpdated(newPlan) {
    const isPaidPlan = ['plus', 'pro', 'studio'].includes(newPlan);
    
    if (isPaidPlan && window.__FIRST_ANALYSIS_CTA__) {
        console.log('🔓 Plano atualizado para', newPlan, '- desbloqueando conteúdo');
        const unlocked = window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade();
        
        if (unlocked) {
            console.log('✅ First Analysis Lock removido com sucesso');
        }
    }
}

// Exemplo de Firebase onSnapshot
firebase.firestore().collection('usuarios').doc(userId).onSnapshot(doc => {
    const data = doc.data();
    const currentPlan = data.plan || 'free';
    
    onUserPlanUpdated(currentPlan);
});
```

### Opção 2: Polling após redirect de pagamento

```javascript
// Em planos.html ou após redirect do Stripe/Hotmart

async function checkUpgradeCompletion() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;
        
        const doc = await firebase.firestore().collection('usuarios').doc(user.uid).get();
        const userData = doc.data();
        const plan = userData.plan || 'free';
        
        const isPaidPlan = ['plus', 'pro', 'studio'].includes(plan);
        
        if (isPaidPlan && window.__FIRST_ANALYSIS_CTA__) {
            console.log('🔓 Upgrade detectado -', plan);
            window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade();
            
            // Redirecionar de volta para análise
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    } catch (err) {
        console.error('Erro ao verificar upgrade:', err);
    }
}

// Executar ao carregar página de confirmação
if (window.location.search.includes('payment_success')) {
    setTimeout(checkUpgradeCompletion, 2000);
}
```

### Opção 3: Event listener customizado

```javascript
// Disparar evento customizado quando upgrade for confirmado

// Em webhook handler ou payment confirmation:
document.dispatchEvent(new CustomEvent('userUpgraded', {
    detail: { plan: 'plus', userId: 'abc123' }
}));

// Em first-analysis-upgrade-cta.js adicionar listener:
document.addEventListener('userUpgraded', (e) => {
    const { plan } = e.detail;
    if (['plus', 'pro', 'studio'].includes(plan)) {
        console.log('🔓 Evento de upgrade recebido');
        window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade();
    }
});
```

## 📊 Verificação de Status

### Console do Navegador

```javascript
// Verificar se lock está ativo
await window.__FIRST_ANALYSIS_CTA__.getStatus()
// Retorna:
// {
//   isFirstFreeFullAnalysis: false,
//   lockActive: true,  ← Se true, lock está ativo
//   lockReason: "Primeira análise FREE FULL detectada",
//   blurApplied: true,
//   ctaVisible: false,
//   hasShownCTA: true
// }

// Verificar estado do lock global
window.FIRST_ANALYSIS_LOCK
// {
//   active: true,
//   reason: "Primeira análise FREE FULL detectada",
//   appliedAt: "2026-02-03T14:32:15.123Z"
// }
```

## 🔧 Fluxo Completo Recomendado

```javascript
// 1. auth.js - Adicionar listener de mudança de plano
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;
    
    const unsubscribe = firebase.firestore()
        .collection('usuarios')
        .doc(user.uid)
        .onSnapshot((doc) => {
            if (!doc.exists) return;
            
            const data = doc.data();
            const newPlan = data.plan || 'free';
            const oldPlan = window.__currentUserPlan || 'free';
            
            // Detectar mudança FREE → PAID
            if (oldPlan === 'free' && ['plus', 'pro', 'studio'].includes(newPlan)) {
                console.log('🎉 UPGRADE DETECTADO:', oldPlan, '→', newPlan);
                
                // Desbloquear First Analysis Lock
                if (window.__FIRST_ANALYSIS_CTA__?.unlockAfterUpgrade) {
                    const unlocked = window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade();
                    if (unlocked) {
                        console.log('✅ Conteúdo premium desbloqueado');
                        
                        // Opcional: Mostrar toast de sucesso
                        showSuccessToast('Plano atualizado! Conteúdo desbloqueado.');
                    }
                }
            }
            
            window.__currentUserPlan = newPlan;
        });
});

// 2. planos.html - Polling após retorno de pagamento
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('payment_status') === 'success') {
    let attempts = 0;
    const maxAttempts = 10;
    
    const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            const user = firebase.auth().currentUser;
            if (!user) return;
            
            const doc = await firebase.firestore().collection('usuarios').doc(user.uid).get();
            const plan = doc.data()?.plan || 'free';
            
            if (['plus', 'pro', 'studio'].includes(plan)) {
                clearInterval(pollInterval);
                
                console.log('🎉 Upgrade confirmado:', plan);
                
                // Salvar no localStorage para próxima página
                localStorage.setItem('soundy_upgrade_completed', plan);
                
                // Redirecionar
                setTimeout(() => {
                    window.location.href = 'index.html?upgraded=true';
                }, 1500);
            }
        } catch (err) {
            console.error('Erro ao verificar plano:', err);
        }
        
        if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            console.warn('⏱️ Timeout ao verificar upgrade');
        }
    }, 2000);
}

// 3. index.html - Verificar ao carregar
window.addEventListener('DOMContentLoaded', () => {
    const upgradedPlan = localStorage.getItem('soundy_upgrade_completed');
    
    if (upgradedPlan && window.__FIRST_ANALYSIS_CTA__) {
        console.log('🔓 Upgrade detectado no localStorage:', upgradedPlan);
        
        setTimeout(() => {
            window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade();
            localStorage.removeItem('soundy_upgrade_completed');
        }, 1000);
    }
});
```

## ⚠️ IMPORTANTE

### O que NÃO fazer:

❌ **NÃO** chamar `removeBlur()` ou `restore()` diretamente sem razão `'UPGRADE_TO_PAID_PLAN'`
```javascript
// ❌ ERRADO - será bloqueado
window.__FIRST_ANALYSIS_CTA__.removeBlur();
// Console: [FIRST-ANALYSIS-LOCK] tentativa de remover bloqueio IGNORADA
```

❌ **NÃO** tentar remover classes CSS manualmente
```javascript
// ❌ ERRADO - será re-aplicado pelo MutationObserver
document.querySelector('.first-analysis-suggestions-blocked')
    .classList.remove('first-analysis-suggestions-blocked');
// Console: [FIRST-ANALYSIS-LOCK] reaplicado
```

### O que fazer:

✅ **SEMPRE** usar `unlockAfterUpgrade()` após detecção de upgrade real
```javascript
// ✅ CORRETO
window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade();
```

✅ **SEMPRE** validar upgrade no backend antes de desbloquear
```javascript
// ✅ CORRETO
const backendConfirmed = await fetch('/api/verify-upgrade').then(r => r.json());
if (backendConfirmed.isPaidPlan) {
    window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade();
}
```

## 🧪 Teste de Integração

```javascript
// 1. Console: Simular estado de lock
window.FIRST_ANALYSIS_LOCK.activate('Teste');
await window.__FIRST_ANALYSIS_CTA__.getStatus()
// { lockActive: true, ... }

// 2. Console: Tentar remover sem autorização (deve falhar)
window.__FIRST_ANALYSIS_CTA__.removeBlur()
// Console: ❌ Tentativa de remover blur BLOQUEADA

// 3. Console: Simular upgrade real
window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade()
// Console: 
// 🔓 UNLOCK após upgrade de plano...
// [FIRST-ANALYSIS-LOCK] removido (UPGRADE)
// ✅ Conteúdo desbloqueado completamente

// 4. Console: Verificar status
await window.__FIRST_ANALYSIS_CTA__.getStatus()
// { lockActive: false, blurApplied: false, ... }
```

## 📝 Logs Esperados

### Durante Upgrade:
```
🎉 UPGRADE DETECTADO: free → plus
🔓 UNLOCK após upgrade de plano...
[FIRST-ANALYSIS-LOCK] removido (UPGRADE)
🌫️ Removendo blur das sugestões...
🔓 Restaurando funções originais...
✅ Conteúdo desbloqueado completamente
✅ Conteúdo premium desbloqueado
```

### Se tentar desbloquear sem upgrade:
```
❌ Tentativa de remover blur BLOQUEADA
[FIRST-ANALYSIS-LOCK] tentativa de remover bloqueio IGNORADA
Tentativa: unknown
Stack: Error at ...
```

## 🚀 Próximos Passos

1. ✅ Sistema V5 implementado (`public/first-analysis-upgrade-cta.js`)
2. ⏳ Adicionar listener de upgrade em `auth.js` ou `plan-capabilities.js`
3. ⏳ Adicionar polling em `planos.html` após pagamento
4. ⏳ Testar fluxo completo: FREE → Pagamento → Upgrade → Unlock
5. ⏳ Validar que lock não afeta planos pagos existentes
6. ⏳ Validar que lock não afeta segunda análise FREE (reduced mode)

---

**Arquivo de Referência:** `public/first-analysis-upgrade-cta.js` (V5)  
**API Principal:** `window.__FIRST_ANALYSIS_CTA__.unlockAfterUpgrade()`  
**Documentação:** `AUDIT_FIRST_ANALYSIS_LOCK_V5_INCONTORNAVEL_2026-02-03.md`
