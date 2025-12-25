# 📋 Instruções para Endpoints Futuros - Sistema de Planos

## 🎯 Contexto

O sistema de planos foi implementado em `work/lib/user/userPlans.js` e integrado ao endpoint de análise de áudio e chat. Os endpoints de **"Pedir ajuda à IA"** e **"Exportar PDF"** ainda não existem no projeto, mas quando forem criados, devem seguir as instruções abaixo.

---
F
## 🔒 Endpoint: Pedir Ajuda à IA (Análise Completa)

### Rota sugerida
`POST /api/audio/ai-help` ou `POST /api/audio/analysis/:jobId/help`

### Função
Permitir que o usuário envie a análise completa para a IA gerar insights detalhados sobre problemas e soluções.

### Validação Obrigatória

```javascript
import { getAuth } from '../../firebase/admin.js';
import { getOrCreateUser, getPlanFeatures } from '../lib/user/userPlans.js';

const auth = getAuth();

// No handler da rota:
try {
  // 1. Validar token Firebase
  const { idToken, jobId, analysisData } = req.body;
  
  if (!idToken) {
    return res.status(401).json({
      success: false,
      error: "AUTH_TOKEN_MISSING",
      message: "Token de autenticação necessário"
    });
  }
  
  const decoded = await auth.verifyIdToken(idToken);
  const uid = decoded.uid;
  
  // 2. Buscar usuário e verificar features
  const user = await getOrCreateUser(uid);
  const features = getPlanFeatures(user.plan, "full"); // Sempre "full" para pedir ajuda
  
  // 3. Validar feature
  if (!features.canHelpAI) {
    console.log(`⛔ [AI-HELP] Feature não disponível para UID: ${uid} (plano: ${user.plan})`);
    return res.status(403).json({
      success: false,
      error: "FEATURE_NOT_AVAILABLE_FOR_PLAN",
      message: "Este recurso não está disponível no seu plano atual. Atualize para PRO para usar 'Pedir ajuda à IA'.",
      plan: user.plan,
      requiredPlan: "pro",
      featureName: "Ajuda da IA"
    });
  }
  
  console.log(`✅ [AI-HELP] Feature permitida para UID: ${uid} (plano: ${user.plan})`);
  
  // 4. Processar solicitação de ajuda IA
  // ... lógica de envio para IA ...
  
} catch (error) {
  console.error('❌ [AI-HELP] Erro:', error.message);
  return res.status(500).json({
    success: false,
    error: "INTERNAL_ERROR",
    message: "Erro ao processar solicitação"
  });
}
```

---

## 📄 Endpoint: Exportar PDF da Análise

### Rota sugerida
`POST /api/audio/export-pdf` ou `GET /api/audio/analysis/:jobId/pdf`

### Função
Gerar um PDF profissional com os resultados da análise para download.

### Validação Obrigatória

```javascript
import { getAuth } from '../../firebase/admin.js';
import { getOrCreateUser, getPlanFeatures } from '../lib/user/userPlans.js';

const auth = getAuth();

// No handler da rota:
try {
  // 1. Validar token Firebase
  const { idToken, jobId } = req.body;
  
  if (!idToken) {
    return res.status(401).json({
      success: false,
      error: "AUTH_TOKEN_MISSING",
      message: "Token de autenticação necessário"
    });
  }
  
  const decoded = await auth.verifyIdToken(idToken);
  const uid = decoded.uid;
  
  // 2. Buscar usuário e verificar features
  const user = await getOrCreateUser(uid);
  const features = getPlanFeatures(user.plan, "full"); // Sempre "full" para PDF
  
  // 3. Validar feature
  if (!features.canPDF) {
    console.log(`⛔ [PDF-EXPORT] Feature não disponível para UID: ${uid} (plano: ${user.plan})`);
    return res.status(403).json({
      success: false,
      error: "FEATURE_NOT_AVAILABLE_FOR_PLAN",
      message: "Exportação de PDF não está disponível no seu plano atual. Atualize para PRO para usar este recurso.",
      plan: user.plan,
      requiredPlan: "pro",
      featureName: "Exportar PDF"
    });
  }
  
  console.log(`✅ [PDF-EXPORT] Feature permitida para UID: ${uid} (plano: ${user.plan})`);
  
  // 4. Gerar PDF
  // ... lógica de geração de PDF ...
  
} catch (error) {
  console.error('❌ [PDF-EXPORT] Erro:', error.message);
  return res.status(500).json({
    success: false,
    error: "INTERNAL_ERROR",
    message: "Erro ao gerar PDF"
  });
}
```

---

## 📊 Resumo de Regras por Plano

### FREE
- ❌ Pedir ajuda à IA
- ❌ Exportar PDF

### PLUS
- ❌ Pedir ajuda à IA
- ❌ Exportar PDF

### PRO
- ✅ Pedir ajuda à IA (ilimitado enquanto tiver análises completas)
- ✅ Exportar PDF (ilimitado)

---

## 🔧 Logs Obrigatórios

Sempre incluir logs de auditoria:

```javascript
console.log(`📊 [ENDPOINT-NAME] Verificando feature para UID: ${uid}`);
console.log(`⛔ [ENDPOINT-NAME] Feature bloqueada (plano: ${user.plan})`); // Se bloqueado
console.log(`✅ [ENDPOINT-NAME] Feature permitida (plano: ${user.plan})`); // Se permitido
```

---

## 🎯 Checklist de Implementação

Quando criar os endpoints, certifique-se de:

- [ ] Importar `getOrCreateUser` e `getPlanFeatures`
- [ ] Validar token Firebase (`verifyIdToken`)
- [ ] Buscar usuário e calcular features
- [ ] Verificar `features.canHelpAI` ou `features.canPDF`
- [ ] Retornar 403 com mensagem clara se feature não disponível
- [ ] Adicionar logs de auditoria
- [ ] Testar com os 3 planos (FREE, PLUS, PRO)

---

**Última atualização:** 10/12/2025
