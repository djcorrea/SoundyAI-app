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
      // Permitir apenas CRIAÇÃO (create)
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

## 📊 ESTRUTURA DOS DOCUMENTOS SALVOS:

```javascript
{
  name: "João Silva",              // string (2-100 chars)
  email: "joao@example.com",       // string (formato email válido)
  createdAt: Timestamp,            // serverTimestamp()
  source: "landing_pre_launch",    // string (fixo)
  status: "waiting",               // string (fixo)
  metadata: {                      // object (opcional)
    userAgent: "...",
    referrer: "...",
    language: "pt-BR"
  }
}
```

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
