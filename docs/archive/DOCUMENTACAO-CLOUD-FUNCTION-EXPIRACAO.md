# 🕐 CLOUD FUNCTION PARA VERIFICAÇÃO AUTOMÁTICA DE PLANOS EXPIRADOS

## 📋 OVERVIEW

A Cloud Function `checkExpiredPlans` foi implementada para automaticamente converter usuários com planos Plus expirados para o plano gratuito, prevenindo acesso não autorizado após expiração.

## ⚙️ CONFIGURAÇÃO

### 🎯 **Função Principal: `checkExpiredPlans`**
- **Execução:** A cada 6 horas (00:00, 06:00, 12:00, 18:00) 
- **Timezone:** America/Sao_Paulo (GMT-3)
- **Método:** Pub/Sub Scheduler (Firebase Functions)

### 🧪 **Função de Teste: `testCheckExpiredPlans`**
- **Execução:** Manual via HTTPS Callable
- **Funcionalidade:** Lista usuários que seriam processados (sem alterar dados)
- **Acesso:** Requer autenticação Firebase

## 🚀 COMO FAZER DEPLOY

### 1. **Preparar Ambiente**
```bash
cd functions/
npm install firebase-functions firebase-admin
```

### 2. **Deploy da Function**
```bash
firebase deploy --only functions:checkExpiredPlans
firebase deploy --only functions:testCheckExpiredPlans
```

### 3. **Verificar Deploy**
```bash
firebase functions:list
```

## 🔍 COMO TESTAR

### **Teste 1: Via Console do Navegador**
1. Faça login no sistema
2. Abra o Console do Desenvolvedor (F12)
3. Carregue o script de teste:
```javascript
// Copiar e colar o conteúdo de test-cloud-function-expiracao.js
testarCloudFunctionExpiracao()
```

### **Teste 2: Via Firebase Console**
1. Acesse Firebase Console → Functions
2. Encontre `testCheckExpiredPlans`
3. Clique em "Executar função"
4. Verifique logs para resultados

### **Teste 3: Via CLI (Firebase Shell)**
```bash
firebase functions:shell
testCheckExpiredPlans()
```

## 📊 LÓGICA DE PROCESSAMENTO

### **Critérios de Seleção:**
```javascript
db.collection('usuarios')
  .where('plano', '==', 'plus')
  .where('planExpiresAt', '<=', now)
```

### **Dados Atualizados:**
```javascript
{
  plano: 'gratis',
  isPlus: false,
  planExpiredAt: now,
  previousPlan: 'plus',
  mensagensRestantes: 10,
  dataUltimoReset: now,
  expiredByScheduler: true,
  schedulerProcessedAt: now
}
```

## 🛡️ SEGURANÇA E PERFORMANCE

### **Batch Processing:**
- Máximo 500 operações por batch (limite Firestore)
- Processamento otimizado para grandes volumes
- Logs detalhados para auditoria

### **Preservação de Dados:**
- ✅ Mantém `planExpiresAt` original
- ✅ Registra `previousPlan` para histórico
- ✅ Adiciona timestamps de processamento
- ✅ Não remove dados de pagamento

## 📈 MONITORAMENTO

### **Logs Importantes:**
```
✅ X planos expirados processados com sucesso!
📊 Estatísticas: Y batch(es) executado(s)
🎉 Verificação automática concluída
```

### **Firebase Console:**
- Functions → checkExpiredPlans → Logs
- Monitoring → Metrics para performance
- Alertas automáticos em caso de erro

## ⚠️ RESOLUÇÃO DE PROBLEMAS

### **Problema: Function não executa**
```bash
# Verificar agendamento
firebase functions:config:get

# Verificar logs
firebase functions:log --only checkExpiredPlans
```

### **Problema: Permissões**
```javascript
// Verificar IAM roles no Firebase Console
// Cloud Scheduler precisa de permissão para Pub/Sub
```

### **Problema: Timeout**
```javascript
// Aumentar timeout se necessário (máximo 9 minutos)
export const checkExpiredPlans = functions
  .runWith({ timeoutSeconds: 540 })
  .pubsub.schedule(...)
```

## 🚨 EXECUÇÃO MANUAL EMERGENCIAL

### **Via Firebase Console:**
1. Functions → checkExpiredPlans
2. Clique em "Executar função"
3. Aguarde processamento
4. Verificar logs para confirmação

### **Via CLI:**
```bash
firebase functions:shell
checkExpiredPlans()
```

## 📋 CHECKLIST DE DEPLOY

- [ ] `functions/index.js` atualizado
- [ ] `firebase deploy --only functions` executado
- [ ] Teste via `testCheckExpiredPlans` realizado
- [ ] Logs verificados no Firebase Console
- [ ] Agendamento ativo confirmado
- [ ] Primeira execução automática aguardada (máx 6h)

## 🔄 INTEGRAÇÃO COM SISTEMA EXISTENTE

### **Compatibilidade:**
- ✅ Funciona junto com verificação no `chat.js`
- ✅ Preserva lógica do `cancel-subscription.js`
- ✅ Não interfere com novos pagamentos
- ✅ Mantém dados históricos para auditoria

### **Redundância de Segurança:**
1. **Chat.js:** Verifica a cada mensagem
2. **Cloud Function:** Verifica a cada 6 horas
3. **Cancel-subscription.js:** Verifica antes de cancelar

## 🎯 RESULTADOS ESPERADOS

Após implementação:
- ✅ Zero usuários com acesso Plus após expiração
- ✅ Processamento automático sem intervenção manual
- ✅ Logs detalhados para auditoria
- ✅ Performance otimizada via batch operations
- ✅ Preservação de dados históricos
