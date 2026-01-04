# 🧪 TESTES DO PLANO DJ BETA

## ✅ CHECKLIST DE TESTES

### 1️⃣ **Teste de Ativação**

- [ ] API responde corretamente
- [ ] Firestore é atualizado com campos corretos
- [ ] Campo `plan` vira `"dj"`
- [ ] Campo `djExpiresAt` contém data futura (15 dias)
- [ ] Campo `djExpired` é `false`
- [ ] Outros planos são limpos (`plusExpiresAt`, `proExpiresAt` = null)

**Como testar:**
```bash
curl -X POST http://localhost:3000/api/activate-dj-beta \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@exemplo.com"}'
```

**Resultado esperado:**
```json
{
  "success": true,
  "user": {
    "plan": "dj",
    "daysRemaining": 15
  }
}
```

---

### 2️⃣ **Teste de Permissões PRO**

Após ativar plano DJ, verificar se todas as features PRO funcionam:

- [ ] **Modo Referência** funciona
  - Carregar 2 músicas
  - Comparação lado a lado deve aparecer
  
- [ ] **Plano de Correção** funciona
  - Clicar em "Gerar Plano de Correção"
  - Deve gerar sem mostrar modal de upgrade
  
- [ ] **Download PDF** funciona
  - Botão deve estar visível
  - Download deve funcionar
  
- [ ] **Pedir Ajuda à IA** funciona
  - Chat deve estar disponível
  - Envio de mensagens deve funcionar

**Como testar:**
1. Fazer login com conta que tem plano DJ
2. Fazer uma análise completa
3. Testar cada feature listada acima

---

### 3️⃣ **Teste de Expiração Automática**

- [ ] Após 15 dias, plano muda automaticamente para `free`
- [ ] Campo `djExpired` vira `true`
- [ ] Features PRO são bloqueadas
- [ ] Modal de encerramento aparece no login

**Como testar (simulação rápida):**
```javascript
// No Firestore, editar manualmente o documento do usuário:
{
  "djExpiresAt": "2026-01-01T00:00:00.000Z",  // Data no passado
  "plan": "dj"
}

// Fazer logout e login
// Sistema deve automaticamente:
// - Mudar plan para "free"
// - Definir djExpired = true
```

---

### 4️⃣ **Teste do Modal de Encerramento**

- [ ] Modal aparece automaticamente após expiração
- [ ] Mensagem é clara e profissional
- [ ] Botão "Fechar" funciona
- [ ] Modal não bloqueia o site completamente
- [ ] Modal não aparece múltiplas vezes na mesma sessão

**Como testar:**
```javascript
// 1. Simular expiração (ver teste 3)
// 2. Fazer login
// 3. Modal deve aparecer automaticamente

// Para testar manualmente:
window.openBetaExpiredModal();
```

---

### 5️⃣ **Teste de Não-Regressão (Outros Planos)**

Verificar que planos existentes NÃO foram afetados:

- [ ] **Plano Free** funciona normalmente
  - Limites corretos (1 análise/mês)
  - Features PRO bloqueadas
  
- [ ] **Plano Plus** funciona normalmente
  - Limites corretos (25 análises/mês)
  - Features PRO bloqueadas
  
- [ ] **Plano Pro** funciona normalmente
  - Análises ilimitadas
  - Todas as features liberadas

**Como testar:**
1. Ter 4 contas de teste (free, plus, pro, dj)
2. Fazer login em cada uma
3. Verificar limites e permissões

---

## 🐛 CASOS DE ERRO ESPERADOS

### Caso 1: Email não existe
```bash
curl -X POST http://localhost:3000/api/activate-dj-beta \
  -d '{"email": "nao-existe@teste.com"}'

# Resposta esperada:
{
  "error": "Usuário não encontrado"
}
```

### Caso 2: Email inválido
```bash
curl -X POST http://localhost:3000/api/activate-dj-beta \
  -d '{"email": "email-invalido"}'

# Resposta esperada:
{
  "error": "Email inválido"
}
```

### Caso 3: Body vazio
```bash
curl -X POST http://localhost:3000/api/activate-dj-beta

# Resposta esperada:
{
  "error": "Email ou UID do usuário é obrigatório"
}
```

---

## 📊 MONITORAMENTO EM PRODUÇÃO

### Logs a observar:

```javascript
// Ativação bem-sucedida
✅ [DJ-BETA] Plano DJ ativado para usuario@email.com
📅 [DJ-BETA] Expira em: 2026-01-19T12:00:00.000Z (15 dias)

// Expiração detectada
🎧 [USER-PLANS] Plano DJ Beta expirado para: uid123
💾 [USER-PLANS] Usuário normalizado e salvo: uid123 (plan: free, djExpired: true)

// Modal exibido
🎧 [BETA-DJ] Usuário com beta expirado detectado - exibindo modal
🎧 [BETA-DJ] Abrindo modal de encerramento do beta
```

### Consultas úteis no Firestore:

```javascript
// Usuários com plano DJ ativo
db.collection('usuarios')
  .where('plan', '==', 'dj')
  .where('djExpired', '==', false)
  .get()

// Usuários com beta expirado
db.collection('usuarios')
  .where('djExpired', '==', true)
  .get()

// Usuários expirando nos próximos 2 dias
const twoDaysFromNow = new Date(Date.now() + 2 * 86400000).toISOString();
db.collection('usuarios')
  .where('plan', '==', 'dj')
  .where('djExpiresAt', '<', twoDaysFromNow)
  .get()
```

---

## 🎯 CENÁRIOS DE TESTE COMPLETOS

### Cenário A: Novo DJ entra no Beta

1. ✅ Admin ativa plano via API
2. ✅ DJ recebe email de boas-vindas (manual, por enquanto)
3. ✅ DJ faz login
4. ✅ DJ testa todas as features PRO
5. ✅ DJ usa normalmente por 15 dias
6. ✅ No dia 16, plano expira automaticamente
7. ✅ DJ faz login e vê modal de agradecimento
8. ✅ DJ clica em "Fechar" e continua com plano Free

### Cenário B: DJ ativo no dia da expiração

1. ✅ DJ está usando a plataforma
2. ✅ Meia-noite passa (dia 16 começa)
3. ✅ DJ faz nova análise
4. ✅ Sistema detecta expiração na verificação lazy
5. ✅ Plano muda para Free automaticamente
6. ✅ Próxima feature PRO que DJ tentar usar mostra modal de upgrade

### Cenário C: Reativação de Beta

1. ✅ DJ teve beta expirado há 1 semana
2. ✅ Admin decide reativar por mais 7 dias
3. ✅ Admin chama API novamente
4. ✅ Plano volta a ser `dj`
5. ✅ Campo `djExpired` volta a ser `false`
6. ✅ DJ ganha acesso PRO novamente

---

## 📈 MÉTRICAS SUGERIDAS

Acompanhar ao longo do beta:

- **Engajamento:**
  - Análises feitas por DJs beta
  - Features mais usadas (referência, PDF, IA)
  - Tempo médio de uso
  
- **Conversão:**
  - % de DJs que assinam após beta expirar
  - Tempo até assinatura pós-expiração
  
- **Feedback:**
  - Mensagens de DJs após ver modal de encerramento
  - Solicitações de extensão de beta
  
- **Técnicas:**
  - Erros/bugs reportados por DJs beta
  - Performance com carga de DJs Pro

---

## ✅ RESULTADO DOS TESTES

**Data do teste:** _________  
**Testador:** _________

| Teste | Status | Observações |
|-------|--------|-------------|
| Ativação via API | ⬜ | |
| Permissões PRO | ⬜ | |
| Expiração automática | ⬜ | |
| Modal de encerramento | ⬜ | |
| Não-regressão (Free) | ⬜ | |
| Não-regressão (Plus) | ⬜ | |
| Não-regressão (Pro) | ⬜ | |

**Status final:** ⬜ APROVADO / ⬜ REPROVADO
