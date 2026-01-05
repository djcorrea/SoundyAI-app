# 🔒 REGRAS DE SEGURANÇA FIRESTORE - SOUNDYAI WAITLIST

## ⚠️ IMPORTANTE: Configure estas regras no Firebase Console

**Caminho:** Firebase Console → Firestore Database → Rules

---

## 📋 REGRAS PARA COPIAR E COLAR:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // ========================================
    // COLLECTION: waitlist
    // ========================================
    // Permissões:
    // - CREATE: Qualquer pessoa pode adicionar (pré-lançamento público)
    // - READ: Bloqueado (ninguém pode ler, apenas admin via console)
    // - UPDATE: Bloqueado (não permitir edição)
    // - DELETE: Bloqueado (não permitir exclusão)
    // ========================================
    
    match /waitlist/{documentId} {
      // Permitir apenas CRIAÇÃO (create) com validações essenciais
      // Validações reduzidas para permitir a estrutura enriquecida
      allow create: if request.auth == null 
                    && request.resource.data.keys().hasAll(['name', 'email', 'createdAt', 'source', 'status'])
                    && request.resource.data.name is string
                    && request.resource.data.name.size() >= 2
                    && request.resource.data.name.size() <= 100
                    && request.resource.data.email is string
                    && request.resource.data.email.matches('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
                    && request.resource.data.email.size() <= 255
                    && request.resource.data.source == 'landing_pre_launch'
                    && request.resource.data.status == 'waiting';
      
      // Bloquear leitura pública (apenas admin via console)
      allow read: if false;
      
      // Bloquear atualização
      allow update: if false;
      
      // Bloquear exclusão
      allow delete: if false;
    }
    
    // Bloquear acesso a todas as outras collections por padrão
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🎯 O QUE ESTAS REGRAS FAZEM:

### ✅ Permitem:
- Qualquer pessoa adicionar um lead à waitlist
- Validação automática dos campos obrigatórios
- Validação de formato de e-mail
- Validação de tamanho dos campos

### ❌ Bloqueiam:
- Leitura pública da lista (ninguém consegue ver os e-mails cadastrados)
- Edição de leads existentes
- Exclusão de leads
- Acesso a outras collections do projeto

### 🛡️ Segurança:
- Apenas admins via Firebase Console podem ler/editar/deletar
- Protege contra spam de dados inválidos
- Impede vazamento de e-mails

---

## 📖 COMO APLICAR NO FIREBASE CONSOLE:

1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: **prodai-58436**
3. Menu lateral: **Firestore Database**
4. Aba: **Rules** (Regras)
5. Cole o código acima
6. Clique em **Publish** (Publicar)

---

## 🧪 TESTAR AS REGRAS:

Após publicar, você pode testar no próprio Firebase Console:

**Aba "Rules Playground":**

### Teste 1: CREATE (deve permitir)
```
Operation: create
Location: /waitlist/test123
Auth: Unauthenticated
Data:
{
  "name": "João Silva",
  "email": "joao@example.com",
  "createdAt": timestamp(),
  "source": "landing_pre_launch",
  "status": "waiting"
}
```
**Resultado esperado:** ✅ Allow

### Teste 2: READ (deve bloquear)
```
Operation: get
Location: /waitlist/test123
Auth: Unauthenticated
```
**Resultado esperado:** ❌ Deny

### Teste 3: UPDATE (deve bloquear)
```
Operation: update
Location: /waitlist/test123
Auth: Unauthenticated
Data: { "status": "approved" }
```
**Resultado esperado:** ❌ Deny

### Teste 4: DELETE (deve bloquear)
```
Operation: delete
Location: /waitlist/test123
Auth: Unauthenticated
```
**Resultado esperado:** ❌ Deny

---

## 🚨 ATENÇÃO:

- **NÃO deixe `allow read, write: if true;`** em produção
- Estas regras são específicas para pré-lançamento público
- Após o lançamento, considere adicionar autenticação
- Monitore o Firestore Usage no console para detectar abusos

---

## 📊 ESTRUTURA COMPLETA DOS DOCUMENTOS SALVOS (v2.0):

```javascript
{
  // === DADOS BASE (obrigatórios) ===
  name: "João Silva",              
  email: "joao@example.com",       
  createdAt: Timestamp,            
  source: "landing_pre_launch",    
  status: "waiting",

  // === DEVICE & BROWSER ===
  device: {
    deviceType: "desktop",         // mobile | desktop | tablet
    operatingSystem: "Windows",    // Windows | macOS | Linux | Android | iOS
    browser: "Chrome",             // Chrome | Safari | Edge | Firefox | Opera
    screenWidth: 1920,
    screenHeight: 1080,
    viewportWidth: 1200,
    viewportHeight: 800,
    pixelRatio: 1.5,
    touchSupport: false
  },

  // === LOCALE & TIMEZONE ===
  locale: {
    language: "pt-BR",
    languages: ["pt-BR", "en"],
    timezone: "America/Sao_Paulo",
    utcOffset: -3,
    inferredCountry: "Brazil",
    inferredRegion: "South America"
  },

  // === MARKETING & UTM ===
  marketing: {
    referrer: "https://google.com",
    referrerDomain: "google.com",
    landingPage: "/prelaunch.html",
    utm_source: "instagram",       // ou null
    utm_medium: "social",          // ou null
    utm_campaign: "launch_2026",   // ou null
    utm_content: null,
    utm_term: null,
    gclid: null,                   // Google Ads
    fbclid: null                   // Facebook Ads
  },

  // === TEMPORAL CONTEXT ===
  temporal: {
    hourOfDay: 14,                 // 0-23
    dayOfWeek: 1,                  // 0-6 (0=domingo)
    isWeekend: false,
    timeOfDay: "afternoon",        // night | morning | afternoon | evening
    localDate: "2026-01-05",
    localTime: "14:30:22"
  },

  // === ENGAGEMENT METRICS ===
  engagement: {
    timeOnPageSeconds: 47,
    scrollDepthPercent: 85,
    mouseMovementDetected: true,
    interactionCount: 12,
    hoverOnCTA: true,
    formInteractionStarted: true
  },

  // === ENVIRONMENT ===
  environment: {
    connectionType: "4g",          // slow-2g | 2g | 3g | 4g
    connectionDownlink: 10.0,
    deviceMemory: 8,               // GB
    hardwareConcurrency: 8,        // CPU cores
    cookiesEnabled: true,
    doNotTrack: false,
    online: true
  },

  // === INFERRED PROFILE ===
  inferredProfile: {
    musicProducer: true,           // Sempre true (landing específica)
    aiInterested: true,            // Sempre true (landing de AI)
    earlyAdopter: true,            // Navegador moderno + device decente
    professionalIntent: true,      // Desktop + horário comercial/bom engajamento
    highIntent: true,              // Scroll >50% + tempo >45s + interações >3
    isInternational: false,        // Fora do Brasil
    mobileFirst: false,            // Usa principalmente mobile
    engagementScore: 78            // Score de 0-100
  },

  // === METADATA ===
  _schemaVersion: "2.0",
  _enrichmentVersion: "v1"
}
```

---

## 📈 COMO USAR ESSES DADOS PARA MARKETING:

### Segmentação por Engagement Score:
- **Score 80-100**: High Intent - Prioridade no lançamento
- **Score 50-79**: Medium Intent - Segunda onda
- **Score 0-49**: Low Intent - Re-engagement necessário

### Segmentação por Perfil:
- **professionalIntent: true** → E-mails sobre features profissionais
- **mobileFirst: true** → Destacar app mobile
- **isInternational: true** → E-mails em inglês

### Segmentação por Marketing:
- **utm_source**: Ver qual canal converte mais
- **referrer**: Identificar parcerias efetivas
- **gclid/fbclid**: ROI de anúncios pagos

### Análise de Comportamento:
- **timeOnPageSeconds**: Medir interesse
- **scrollDepthPercent**: Conteúdo visto
- **hourOfDay/dayOfWeek**: Melhor momento para e-mails

---

## 🔧 PRÓXIMOS PASSOS:

1. ✅ Aplicar estas regras no Firebase Console
2. ✅ Testar o formulário da landing page
3. ✅ Verificar se os leads estão sendo salvos no Firestore
4. ⏭️ Configurar alertas de novos leads (Firebase Functions ou Zapier)
5. ⏭️ Exportar leads periodicamente para backup

---

Criado em: 05/01/2026
Projeto: SoundyAI Waitlist
Collection: `waitlist`
