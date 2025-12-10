# 🚀 GUIA RÁPIDO DE CONFIGURAÇÃO - SISTEMA DE PLANOS

## 📋 CHECKLIST DE DEPLOY

### 1️⃣ **Variáveis de Ambiente (Railway)**
```bash
# Adicionar no Railway:
MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu_token_aqui
```

### 2️⃣ **Configurar Webhook no Mercado Pago**
1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Vá em "Webhooks"
3. Adicione URL: `https://seu-dominio.up.railway.app/webhook/mercadopago`
4. Selecione evento: `payment`
5. Salve

### 3️⃣ **Atualizar Frontend - Análise de Áudio**

**ANTES (sem autenticação):**
```javascript
const response = await fetch('/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    fileKey: 'uploads/audio.wav', 
    mode: 'genre' 
  })
});
```

**DEPOIS (com autenticação):**
```javascript
// Obter token do Firebase Auth
const idToken = await firebase.auth().currentUser.getIdToken();

const response = await fetch('/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    fileKey: 'uploads/audio.wav', 
    mode: 'genre',
    idToken: idToken  // ✅ ADICIONAR
  })
});
```

### 4️⃣ **Atualizar Frontend - Mercado Pago**

**Criar preferência com external_reference:**
```javascript
const createPreference = async () => {
  const user = firebase.auth().currentUser;
  const idToken = await user.getIdToken();
  
  const response = await fetch('/api/create-preference', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      plan: 'pro',  // ou 'plus'
      duration: 30  // ou 120 para combo
    })
  });
  
  const data = await response.json();
  // Redirecionar para data.init_point
};
```

**Backend - Endpoint de criação de preferência:**
```javascript
// api/create-preference.js (criar se não existir)
import express from 'express';
import fetch from 'node-fetch';
import { auth } from './firebaseAdmin.js';

const router = express.Router();

router.post('/create-preference', async (req, res) => {
  try {
    // Validar autenticação
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    
    const { plan, duration } = req.body;
    
    // Mapear plano para preço
    const prices = {
      'plus': 47.00,
      'pro': 69.99,
      'pro_combo': 157.00
    };
    
    const productId = duration === 120 ? 'pro_combo' : plan;
    const price = prices[productId];
    
    // Criar preferência no Mercado Pago
    const preference = {
      items: [{
        title: `SoundyAI - Plano ${plan.toUpperCase()}`,
        quantity: 1,
        unit_price: price,
        currency_id: 'BRL'
      }],
      external_reference: uid,  // ✅ CRÍTICO: UID do Firebase
      metadata: {
        product_id: productId,
        plan: plan,
        duration_days: duration
      },
      back_urls: {
        success: 'https://seu-frontend.com/payment-success',
        failure: 'https://seu-frontend.com/payment-failure',
        pending: 'https://seu-frontend.com/payment-pending'
      },
      auto_return: 'approved'
    };
    
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });
    
    const data = await mpResponse.json();
    
    res.json({ 
      success: true, 
      init_point: data.init_point,
      preference_id: data.id
    });
    
  } catch (error) {
    console.error('Erro ao criar preferência:', error);
    res.status(500).json({ error: 'Erro ao processar pagamento' });
  }
});

export default router;
```

### 5️⃣ **Firestore - Estrutura de Dados**

**Coleção `usuarios`:**
```javascript
{
  uid: "firebase_user_id",
  plan: "free" | "plus" | "pro",
  
  // Expiração de planos
  plusExpiresAt: null,  // ISO string ou null
  proExpiresAt: null,   // ISO string ou null
  
  // Contadores diários
  messagesToday: 0,
  analysesToday: 0,
  lastResetAt: "2025-12-10",  // ISO date string (YYYY-MM-DD)
  
  // Timestamps
  createdAt: "2025-12-10T12:00:00.000Z",
  updatedAt: "2025-12-10T12:00:00.000Z",
  
  // Campos legados (manter para compatibilidade)
  email: "user@example.com",
  plano: "gratis",  // Legado, usar 'plan' agora
  mensagensEnviadas: 5,  // Legado, usar 'messagesToday'
  imagemAnalises: {
    quantidade: 2,
    mesAtual: 11,
    anoAtual: 2025
  }
}
```

### 6️⃣ **Testar Sistema**

**Teste 1: Limites FREE**
```bash
# Login como usuário free
# Enviar 20 mensagens → OK
# Enviar 21ª mensagem → 429 "Limite atingido"
# Fazer 3 análises → OK
# Fazer 4ª análise → 429 "Limite atingido"
```

**Teste 2: Pagamento**
```bash
# 1. Criar preferência de pagamento
# 2. Pagar via Mercado Pago (sandbox)
# 3. Webhook deve ser chamado automaticamente
# 4. Verificar Firestore: plan='pro'
# 5. Tentar enviar > 20 mensagens → OK (sem limite)
```

**Teste 3: Webhook Manual**
```bash
# Simular webhook (desenvolvimento):
curl -X POST http://localhost:3000/webhook/mercadopago \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "data": { "id": "123456789" }
  }'

# Nota: Precisa configurar pagamento real no Mercado Pago
# para ter um payment ID válido para teste
```

### 7️⃣ **Monitoramento**

**Logs importantes:**
```bash
# Sistema de limites
[USER-PLANS] Chat check: uid (5/20) - OK
[USER-PLANS] Análise check: uid (2/3) - OK
[USER-PLANS] Plano aplicado: uid → pro até 2026-01-09

# Webhook
[WEBHOOK] Notificação recebida do Mercado Pago
[WEBHOOK] Status do pagamento: approved
[WEBHOOK] Aplicando plano: pro (30 dias) para uid
```

### 8️⃣ **Troubleshooting**

**Erro: "AUTH_TOKEN_MISSING"**
```javascript
// Solução: Frontend deve enviar idToken
const idToken = await firebase.auth().currentUser.getIdToken();
fetch('/analyze', { 
  body: JSON.stringify({ fileKey, mode, idToken })  // ✅
});
```

**Erro: "External reference (UID) ausente"**
```javascript
// Solução: Mercado Pago preference deve ter external_reference
const preference = {
  items: [...],
  external_reference: firebase.auth().currentUser.uid  // ✅
};
```

**Erro: "MERCADOPAGO_ACCESS_TOKEN não configurado"**
```bash
# Solução: Adicionar variável no Railway
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxx
```

**Webhook não está sendo chamado**
```
1. Verificar URL no painel Mercado Pago
2. URL deve ser HTTPS
3. Verificar se endpoint está respondendo 200 OK
4. Testar manualmente: curl -X GET https://seu-dominio/webhook/mercadopago
```

---

## ✅ SISTEMA PRONTO PARA PRODUÇÃO

Após completar todos os passos acima, o sistema estará 100% funcional:
- ✅ Limites por plano funcionando
- ✅ Autenticação obrigatória em análises
- ✅ Webhook processando pagamentos
- ✅ Reset diário automático
- ✅ Expiração de planos automática

**Dúvidas?** Consulte os relatórios:
- `AUDITORIA_FLUXO_PLANOS_COMPLETA.md`
- `IMPLEMENTACAO_SISTEMA_PLANOS_COMPLETA.md`
