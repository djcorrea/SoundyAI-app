# 📘 GUIA DE USO - LIMPEZA DE USUÁRIOS

Script seguro para remover usuários de teste antes do lançamento oficial, mantendo apenas usuários do plano DJ.

---

## ⚡ INÍCIO RÁPIDO

### 1️⃣ DRY RUN (Modo Seguro - Recomendado)
```bash
node scripts/cleanup-users.js
```

**O que faz:**
- ✅ Lista TODOS os usuários
- ✅ Mostra quem seria mantido (DJ)
- ✅ Mostra quem seria excluído (Free, Plus, Pro, etc.)
- ❌ **NÃO apaga nada**

### 2️⃣ EXECUTAR LIMPEZA REAL (Modo Destrutivo)

**⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL**

```bash
# 1. Fazer backup do Firestore primeiro
#    Firebase Console > Firestore > Exportar dados

# 2. Abrir o arquivo e mudar:
#    const DRY_RUN = false;

# 3. Executar:
node scripts/cleanup-users.js
```

---

## 🎯 CRITÉRIOS DE EXCLUSÃO

### ✅ MANTIDOS (Não serão apagados)
- ✅ Usuários com `plan === "dj"` válido
- ✅ Usuários DJ com `djExpiresAt` no futuro
- ✅ Usuários DJ sem `djExpiresAt` (vitalícios)

### ❌ EXCLUÍDOS (Serão removidos)
- ❌ Usuários com `plan === "free"`
- ❌ Usuários com `plan === "plus"`
- ❌ Usuários com `plan === "pro"`
- ❌ Usuários com `plan === "studio"`
- ❌ Usuários com plano DJ **expirado** (`djExpiresAt` no passado)
- ❌ Usuários sem documento no Firestore (contas não utilizadas)
- ❌ Usuários com `plan === null` ou `undefined`

---

## 📊 EXEMPLO DE SAÍDA

### Modo DRY RUN
```
========================================
🔥 LIMPEZA DE USUÁRIOS - PRÉ-LANÇAMENTO
========================================
⚙️  Modo: 🔒 DRY RUN (seguro)
📦 Collection: usuarios
📅 Data: 2026-01-08T10:30:00.000Z
========================================

✅ Firebase Admin inicializado

📦 Processando lote 1...
   25 usuários neste lote

[MANTER] dj@soundy.ai (abc123) - DJ_VALID - Expira em 2026-01-30T00:00:00.000Z
[APAGAR] test1@test.com (xyz789) - PLAN_FREE
[APAGAR] test2@test.com (def456) - NO_FIRESTORE_DOC
[APAGAR] expired@test.com (ghi789) - DJ_EXPIRED - Expirou em 2026-01-01T00:00:00.000Z
[MANTER] lifetime@soundy.ai (jkl012) - DJ_NO_EXPIRATION - DJ sem expiração (vitalício)

========================================
📊 RELATÓRIO FINAL
========================================
Total de usuários: 25
Mantidos (DJ): 2
Marcados para exclusão: 23
Erros: 0
========================================

✅ USUÁRIOS MANTIDOS (PLANO DJ):
1. dj@soundy.ai (abc123)
   Motivo: DJ_VALID
   Detalhes: Expira em 2026-01-30T00:00:00.000Z
2. lifetime@soundy.ai (jkl012)
   Motivo: DJ_NO_EXPIRATION
   Detalhes: DJ sem expiração (vitalício)

🔒 USUÁRIOS MARCADOS PARA EXCLUSÃO:
1. test1@test.com (xyz789)
   Motivo: PLAN_FREE
2. test2@test.com (def456)
   Motivo: NO_FIRESTORE_DOC
...

========================================
✅ DRY RUN CONCLUÍDO COM SUCESSO
ℹ️  Nenhum usuário foi excluído
ℹ️  Para executar a exclusão real:
   1. Revise o relatório acima
   2. Faça backup do Firestore
   3. Mude DRY_RUN = false no script
   4. Execute novamente: node scripts/cleanup-users.js
========================================
```

---

## 🛡️ SEGURANÇA

### Proteções Implementadas

1. **DRY_RUN por padrão**
   - O script SEMPRE começa em modo seguro
   - Requer alteração manual para modo destrutivo

2. **Validação de plano DJ**
   - Verificação case-sensitive: `plan === "dj"`
   - Verifica data de expiração (`djExpiresAt`)
   - Mantém DJs vitalícios (sem data de expiração)

3. **Tratamento de erros isolado**
   - Erro em um usuário não interrompe os demais
   - Log detalhado de cada erro
   - Relatório completo no final

4. **Confirmação de 5 segundos**
   - Ao rodar em modo destrutivo, aguarda 5 segundos
   - Permite cancelar com Ctrl+C antes de iniciar

---

## 📝 CHECKLIST PRÉ-EXECUÇÃO

### Antes de rodar em DRY_RUN
- [ ] Verificar que `FIREBASE_SERVICE_ACCOUNT` está no `.env`
- [ ] Verificar que o projeto Firebase está correto

### Antes de rodar em MODO DESTRUTIVO
- [ ] ✅ Executar DRY_RUN primeiro
- [ ] ✅ Revisar relatório completo
- [ ] ✅ Confirmar que NENHUM DJ válido será excluído
- [ ] ✅ Fazer backup do Firestore:
  - Firebase Console > Firestore Database > Importar/Exportar > Exportar
- [ ] ✅ Anotar estatísticas antes da limpeza:
  - Total de usuários
  - Usuários DJ
  - Usuários de teste
- [ ] ✅ Mudar `const DRY_RUN = false;` manualmente
- [ ] ✅ Executar: `node scripts/cleanup-users.js`
- [ ] ✅ Verificar logs durante execução
- [ ] ✅ Confirmar estatísticas após limpeza

---

## 🚨 TROUBLESHOOTING

### Erro: "FIREBASE_SERVICE_ACCOUNT não configurado"
**Solução:**
```bash
# Verificar se a variável existe no .env
cat .env | grep FIREBASE_SERVICE_ACCOUNT

# Se não existir, adicionar:
echo 'FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}' >> .env
```

### Erro: "auth/user-not-found"
**Causa:** Usuário existe no Firestore mas não no Auth  
**Ação:** O script continuará normalmente. O documento será excluído do Firestore.

### Erro: "Insufficient permissions"
**Causa:** Service Account sem permissões adequadas  
**Solução:**
1. Firebase Console > Project Settings > Service Accounts
2. Verificar que a service account tem permissões:
   - Firebase Authentication Admin
   - Cloud Datastore User

### Script não mostra nenhum usuário
**Causa:** Nenhum usuário no Firebase Auth  
**Ação:** Verificar se está conectado ao projeto correto

---

## 📐 ESTRUTURA DO CÓDIGO

```javascript
// Decisão de manutenção/exclusão
shouldKeepUser(firestoreDoc, uid) → { shouldKeep: boolean, reason: string }

// Exclusão segura (Firestore + Auth)
deleteUser(uid, auth, db) → { firestoreDeleted: boolean, authDeleted: boolean }

// Processamento em lote
processBatch(users, auth, db) → void

// Função principal
main() → void
```

---

## 🔍 CÓDIGOS DE MOTIVO

| Código | Significado | Ação |
|--------|-------------|------|
| `DJ_VALID` | DJ com expiração futura | MANTER |
| `DJ_NO_EXPIRATION` | DJ vitalício | MANTER |
| `DJ_EXPIRED` | DJ expirado | APAGAR |
| `PLAN_FREE` | Plano Free | APAGAR |
| `PLAN_PLUS` | Plano Plus | APAGAR |
| `PLAN_PRO` | Plano Pro | APAGAR |
| `PLAN_STUDIO` | Plano Studio | APAGAR |
| `NO_FIRESTORE_DOC` | Sem documento no Firestore | APAGAR |

---

## 📞 SUPORTE

Em caso de dúvidas ou problemas:

1. **Revisar os logs** — O script gera logs detalhados de cada operação
2. **Verificar auditoria** — Consultar [AUDIT_PRE_LAUNCH_CLEANUP.md](AUDIT_PRE_LAUNCH_CLEANUP.md)
3. **Restaurar backup** — Se algo der errado:
   - Firebase Console > Firestore Database > Importar/Exportar > Importar
   - Selecionar o arquivo de backup

---

## ✅ VALIDAÇÃO PÓS-LIMPEZA

Após executar o script em modo destrutivo:

```bash
# 1. Verificar total de usuários restantes
# Firebase Console > Authentication > Users

# 2. Verificar que apenas DJs existem
# Firebase Console > Firestore > usuarios
# Filtrar por: plan == "dj"

# 3. Confirmar que nenhum erro foi registrado
# Revisar logs do script
```

---

**Última atualização:** 8 de janeiro de 2026  
**Versão:** 1.0.0  
**Autor:** GitHub Copilot
