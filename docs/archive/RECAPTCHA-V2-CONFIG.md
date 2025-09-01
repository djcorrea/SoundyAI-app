## 🔧 Configuração reCAPTCHA v2 (NÃO Enterprise) - Firebase Console

### ❌ **PROBLEMA ATUAL:**
O Firebase está tentando usar reCAPTCHA Enterprise, mas você quer usar reCAPTCHA v2 normal.

### ✅ **SOLUÇÃO - Passos no Firebase Console:**

1. **Acesse:** [Firebase Console](https://console.firebase.google.com/)

2. **Selecione seu projeto:** `prod-ai-teste`

3. **Navegue para:** `Authentication` → `Sign-in method`

4. **Configure Phone Authentication:**
   - Clique em "Phone" na lista de provedores
   - Habilite "Phone"
   - **IMPORTANTE:** Na seção reCAPTCHA:
     - ❌ NÃO marque "Use reCAPTCHA Enterprise"
     - ✅ Use "reCAPTCHA v2" (padrão)

5. **Adicione domínios autorizados:**
   - `localhost` (para desenvolvimento)
   - `127.0.0.1` (para desenvolvimento)
   - Seu domínio de produção

6. **Salve as configurações**

### 🔍 **Verificação:**
- Se ainda houver erro, desabilite e reabilite Phone authentication
- Certifique-se que "reCAPTCHA Enterprise" está DESABILITADO
- Verifique se `localhost` está nos domínios autorizados

### 🚀 **Teste após configuração:**
```
http://localhost:3000/public/login.html
```

### 📋 **Logs para debug:**
- Abra Console do navegador (F12)
- Procure por mensagens começando com "🔧" ou "✅"
- Se aparecer "reCAPTCHA v2", está correto
- Se aparecer "Enterprise", há problema na configuração

---
**Status atual:** ✅ Código configurado para reCAPTCHA v2
**Próximo passo:** Configure no Firebase Console conforme instruções acima
