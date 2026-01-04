# 🚀 GUIA RÁPIDO - ATIVAR PLANO DJ BETA

## 🎯 Como Ativar o Beta DJ em um Usuário

### Método 1: Via API (Recomendado)

```bash
curl -X POST http://localhost:3000/api/activate-dj-beta \
  -H "Content-Type: application/json" \
  -d '{"email": "dj@exemplo.com"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Plano DJ Beta ativado com sucesso",
  "user": {
    "uid": "abc123...",
    "email": "dj@exemplo.com",
    "plan": "dj",
    "expiresAt": "2026-01-19T12:00:00.000Z",
    "daysRemaining": 15
  }
}
```

---

### Método 2: Via Firestore (Manual)

1. Abrir Firebase Console
2. Ir para **Firestore Database**
3. Navegar até `usuarios/{uid}`
4. Clicar em **Editar documento**
5. Atualizar campos:

```javascript
{
  "plan": "dj",
  "djExpiresAt": "2026-01-19T12:00:00.000Z",  // Calcular 15 dias à frente
  "djExpired": false,
  "plusExpiresAt": null,
  "proExpiresAt": null,
  "updatedAt": "2026-01-04T12:00:00.000Z"
}
```

---

## 🧪 Como Testar a Expiração

### Teste Rápido (sem esperar 15 dias)

1. Ativar plano DJ normalmente
2. No Firestore, editar manualmente:
   ```javascript
   {
     "plan": "free",
     "djExpired": true
   }
   ```
3. Fazer **logout**
4. Fazer **login** novamente
5. ✅ Modal de encerramento deve aparecer

---

## 📋 Verificar Status do Beta

### Via Console do Navegador

```javascript
// Abrir DevTools (F12) e executar:
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';
import { auth, db } from './firebase.js';

const userDoc = await getDoc(doc(db, 'usuarios', auth.currentUser.uid));
const data = userDoc.data();

console.log('Plan:', data.plan);
console.log('DJ Expires At:', data.djExpiresAt);
console.log('DJ Expired:', data.djExpired);
```

---

## 🔧 Comandos Úteis

### Ver logs do sistema

```javascript
// No console do navegador, filtrar por:
[DJ-BETA]
[BETA-DJ]
```

### Forçar exibição do modal

```javascript
// No console do navegador:
window.openBetaExpiredModal();
```

### Fechar modal programaticamente

```javascript
window.closeBetaExpiredModal();
```

---

## ⚠️ Troubleshooting

### Modal não aparece?

1. Verificar se `djExpired === true` no Firestore
2. Limpar sessionStorage:
   ```javascript
   sessionStorage.removeItem('betaDjModalShown');
   ```
3. Fazer logout e login novamente

### API não responde?

1. Verificar se servidor está rodando: `node server.js`
2. Testar endpoint diretamente: `http://localhost:3000/api/activate-dj-beta`
3. Verificar logs do servidor

### Plano não expira?

1. Verificar campo `djExpiresAt` no Firestore
2. Confirmar que data está no passado
3. Fazer nova interação (login/logout) para forçar verificação

---

## 📞 Suporte Rápido

**Logs importantes:**
- `🎧 [DJ-BETA]` - Ativação/gerenciamento do plano
- `⏰ [USER-PLANS]` - Lógica de expiração
- `🔐 [ENTITLEMENTS]` - Verificação de permissões

**Arquivos principais:**
- Backend: [work/lib/user/userPlans.js](work/lib/user/userPlans.js)
- Entitlements: [work/lib/entitlements.js](work/lib/entitlements.js)
- Frontend: [public/audio-analyzer-integration.js](public/audio-analyzer-integration.js)
- API: [api/activate-dj-beta.js](api/activate-dj-beta.js)
