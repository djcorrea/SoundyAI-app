# 🎓 INTEGRAÇÃO HOTMART - COMBO CURSO + PRO 4 MESES

## 📋 RESUMO DA IMPLEMENTAÇÃO

Esta documentação descreve a integração completa entre Hotmart e SoundyAI para o produto "Combo Curso + 4 meses PRO".

---

## 🏗️ ARQUITETURA IMPLEMENTADA

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Cliente compra na Hotmart]                                    │
│            │                                                    │
│            ▼                                                    │
│  [Hotmart processa pagamento]                                   │
│            │                                                    │
│            ▼                                                    │
│  [Hotmart envia webhook] ──► POST /api/webhook/hotmart          │
│            │                                                    │
│            ▼                                                    │
│  ┌──────────────────────────────────────────┐                  │
│  │ 1. Validar assinatura (X-Hotmart-Hottok) │                  │
│  │ 2. Verificar se é PURCHASE_APPROVED      │                  │
│  │ 3. Checar idempotência (transaction_id)  │                  │
│  │ 4. Buscar/criar usuário no Firebase      │                  │
│  │ 5. Ativar PRO por 120 dias               │                  │
│  │ 6. Marcar transação como processada      │                  │
│  │ 7. Enviar e-mail de boas-vindas          │                  │
│  └──────────────────────────────────────────┘                  │
│            │                                                    │
│            ▼                                                    │
│  [Usuário acessa SoundyAI com conta PRO ativa]                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 ARQUIVOS CRIADOS/MODIFICADOS

### Novos arquivos:
| Arquivo | Descrição |
|---------|-----------|
| `api/webhook/hotmart.js` | Endpoint do webhook Hotmart |
| `lib/email/hotmart-welcome.js` | Sistema de e-mail com Resend |
| `lib/jobs/expire-plans.js` | Job de expiração de planos |

### Arquivos modificados:
| Arquivo | Modificação |
|---------|-------------|
| `server.js` | Registro da rota `/api/webhook/hotmart` |
| `.env.example` | Novas variáveis de ambiente |

---

## ⚙️ CONFIGURAÇÃO DO AMBIENTE

### 1. Variáveis de Ambiente (Railway/Produção)

```env
# ========================================
# HOTMART
# ========================================
HOTMART_WEBHOOK_SECRET=seu_hottok_aqui

# ========================================
# RESEND (Email)
# ========================================
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=SoundyAI <noreply@soundyai.com.br>
APP_URL=https://soundyai.com.br
```

### 2. Configuração no Painel Hotmart

1. Acesse: **Ferramentas** → **Webhooks (API de Desenvolvedor)**
2. Clique em **"Criar Webhook"**
3. Configure:
   - **URL**: `https://soundyai.com.br/api/webhook/hotmart`
   - **Eventos**: Marque apenas `PURCHASE_APPROVED`
   - **Formato**: JSON
4. Copie o **Hottok** gerado
5. Adicione o Hottok na variável `HOTMART_WEBHOOK_SECRET`

### 3. Configuração no Resend

1. Crie uma conta em: https://resend.com
2. Vá em **API Keys** → **Create API Key**
3. Copie a chave e adicione em `RESEND_API_KEY`
4. Configure domínio (opcional, mas recomendado):
   - **Domains** → **Add Domain**
   - Configure os registros DNS conforme instruído
   - Aguarde verificação

---

## 🔐 SEGURANÇA IMPLEMENTADA

| Recurso | Descrição |
|---------|-----------|
| **Validação de assinatura** | Verifica header `X-Hotmart-Hottok` |
| **Idempotência** | Transações armazenadas em `hotmart_transactions` |
| **Criação segura de senha** | 12 caracteres com letras, números e símbolos |
| **Logs completos** | Rastreamento de todo o fluxo |
| **Resposta 200 sempre** | Evita reenvios infinitos da Hotmart |
| **E-mail único por transação** | Só envia se transação for nova |

---

## 🧪 CHECKLIST DE TESTES

### Teste 1: Usuário NOVO (primeira compra)
```
□ 1. Simular webhook com e-mail que NÃO existe no Firebase
□ 2. Verificar se usuário foi criado no Firebase Auth
□ 3. Verificar se documento existe em `usuarios/{uid}`
□ 4. Verificar se `plan = "pro"` e `proExpiresAt` = +120 dias
□ 5. Verificar se transação foi salva em `hotmart_transactions/{id}`
□ 6. Verificar se e-mail foi recebido com:
     □ Senha provisória
     □ Link de acesso
     □ Data de expiração
□ 7. Testar login com credenciais recebidas
□ 8. Verificar acesso às features PRO
```

### Teste 2: Usuário EXISTENTE (já tem conta)
```
□ 1. Simular webhook com e-mail de usuário existente
□ 2. Verificar que NÃO criou conta duplicada
□ 3. Verificar que plano foi atualizado para PRO
□ 4. Verificar que e-mail foi enviado SEM senha provisória
□ 5. Testar login com credenciais antigas
```

### Teste 3: Webhook DUPLICADO (idempotência)
```
□ 1. Enviar mesmo webhook 2x
□ 2. Verificar que segunda requisição retornou sucesso
□ 3. Verificar que plano NÃO foi duplicado
□ 4. Verificar que apenas 1 e-mail foi enviado
□ 5. Verificar log: "Transação já processada anteriormente"
```

### Teste 4: Webhook com status diferente
```
□ 1. Enviar webhook com status "pending"
□ 2. Verificar que NÃO ativou plano
□ 3. Verificar resposta: "Evento ignorado"
```

### Teste 5: Expiração do plano
```
□ 1. Criar usuário com proExpiresAt no passado
□ 2. Fazer qualquer ação (login, análise, etc)
□ 3. Verificar que normalizeUserDoc() rebaixou para FREE
□ 4. Alternativa: Executar node lib/jobs/expire-plans.js
```

---

## 🔧 COMANDOS ÚTEIS

### Testar webhook localmente (DEV)
```bash
# Endpoint de teste (apenas em DEV)
curl -X POST http://localhost:3000/api/webhook/hotmart/test \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@exemplo.com", "name": "Usuário Teste"}'
```

### Verificar status do endpoint
```bash
curl https://soundyai.com.br/api/webhook/hotmart
# Deve retornar: { "status": "ok", "service": "Hotmart Webhook", ... }
```

### Executar job de expiração manualmente
```bash
node lib/jobs/expire-plans.js
```

### Verificar transações processadas (Firestore)
```javascript
// No console do Firebase
const db = firebase.firestore();
const transactions = await db.collection('hotmart_transactions').get();
transactions.forEach(doc => console.log(doc.id, doc.data()));
```

---

## 📊 ESTRUTURA DOS DADOS

### Documento do usuário (`usuarios/{uid}`)
```javascript
{
  uid: "abc123",
  email: "usuario@email.com",
  name: "Nome do Usuário",
  plan: "pro",
  proExpiresAt: "2026-05-04T12:00:00.000Z",  // +120 dias
  origin: "hotmart",
  hotmartTransactionId: "HP1234567890",
  
  // Campos mensais
  messagesMonth: 0,
  analysesMonth: 0,
  billingMonth: "2026-01",
  
  createdAt: "2026-01-04T12:00:00.000Z",
  updatedAt: "2026-01-04T12:00:00.000Z"
}
```

### Documento de transação (`hotmart_transactions/{transactionId}`)
```javascript
{
  transactionId: "HP1234567890",
  buyerEmail: "usuario@email.com",
  status: "processed",
  origin: "hotmart",
  productName: "Combo Curso + PRO",
  processedAt: "2026-01-04T12:00:00.000Z",
  rawData: "{...}"  // Payload original (para debug)
}
```

---

## ⚠️ TROUBLESHOOTING

### Webhook não está chegando
1. Verificar se a URL está correta no painel Hotmart
2. Verificar logs do Railway/servidor
3. Testar endpoint com curl

### Usuário não recebeu e-mail
1. Verificar se `RESEND_API_KEY` está configurado
2. Verificar logs: `[EMAIL] Erro ao enviar`
3. Verificar spam/lixo eletrônico
4. Verificar domínio no Resend

### Plano não foi ativado
1. Verificar logs: `[HOTMART] Ativando PRO`
2. Verificar se transação já foi processada antes
3. Verificar documento do usuário no Firestore

### Idempotência não funcionou
1. Verificar collection `hotmart_transactions`
2. Verificar se transactionId está sendo extraído corretamente
3. Verificar logs de idempotência

---

## 📞 SUPORTE

Para dúvidas sobre esta implementação, verifique:
1. Logs do servidor (Railway dashboard)
2. Firestore (Firebase console)
3. Resend dashboard (e-mails enviados)
4. Hotmart dashboard (webhooks enviados)

---

## 📝 HISTÓRICO DE VERSÕES

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0.0 | 2026-01-04 | Implementação inicial |

---

*Documentação gerada automaticamente para o projeto SoundyAI*
