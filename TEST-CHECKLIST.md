# ✅ CHECKLIST DE PREPARAÇÃO - Teste de Concorrência

Use este checklist antes de executar o teste de concorrência para garantir que tudo está configurado corretamente.

## 📋 PRÉ-REQUISITOS

### 1. Ambiente Node.js
- [ ] Node.js 18+ instalado
  ```bash
  node --version  # Deve mostrar v18.0.0 ou superior
  ```

### 2. Dependências NPM
- [ ] Dependências instaladas
  ```bash
  npm install node-fetch@3.3.2 form-data@4.0.0 dotenv@16.3.1 firebase@10.7.1
  ```

### 3. Arquivo .env Configurado
- [ ] `B2_KEY_ID` configurado
- [ ] `B2_APP_KEY` configurado
- [ ] `B2_BUCKET_NAME` configurado
- [ ] `B2_ENDPOINT` configurado

**Validar:**
```bash
# Verificar se variáveis existem
grep -E "B2_KEY_ID|B2_APP_KEY|B2_BUCKET_NAME|B2_ENDPOINT" .env

# Ou no Windows PowerShell:
Select-String -Pattern "B2_KEY_ID|B2_APP_KEY|B2_BUCKET_NAME|B2_ENDPOINT" .env
```

### 4. Arquivo de Áudio de Teste
- [ ] Arquivo de áudio válido (.wav, .mp3 ou .flac)
- [ ] Tamanho < 150MB
- [ ] Arquivo acessível (caminho correto)

**Validar:**
```bash
# Linux/Mac
ls -lh ./test-audio.wav

# Windows PowerShell
Get-Item .\test-audio.wav | Format-List Name,Length
```

### 5. Firebase ID Token
- [ ] Token obtido via `get-firebase-token.js` ou console
- [ ] Token válido (não expirado - válido por 1 hora)
- [ ] Token de conta PRO (recomendado)

**Obter token:**
```bash
node get-firebase-token.js --email=seu@email.com --password=suasenha
```

**Validar token:**
```bash
# Verificar se arquivo .firebase-token existe
cat .firebase-token  # Linux/Mac
Get-Content .firebase-token  # Windows PowerShell
```

---

## 🔧 CONFIGURAÇÃO DO TESTE

### 1. Parâmetros Ajustados

Edite `test-concurrency.js` se necessário:

```javascript
const CONFIG = {
  TOTAL_REQUESTS: 50,        // ✅ Ajustado para sua necessidade?
  CONCURRENCY_LIMIT: 10,     // ✅ Apropriado para o servidor?
  POLLING_INTERVAL: 5000,    // ✅ 5s é adequado?
  MAX_WAIT_TIME: 600000,     // ✅ 10 min é suficiente?
};
```

**Recomendações:**

| Cenário | TOTAL_REQUESTS | CONCURRENCY_LIMIT |
|---------|----------------|-------------------|
| Teste inicial | 10 | 5 |
| Teste médio | 30 | 10 |
| Teste completo | 50 | 10 |
| Teste pesado | 100 | 20 |

### 2. Plano do Usuário

- [ ] Verificar limite diário de análises
- [ ] Confirmar que há análises disponíveis hoje
- [ ] Usar conta PRO se possível

**Verificar limite:**
```sql
-- No PostgreSQL
SELECT uid, plan, dailyAnalysisCount, dailyAnalysisLimit, lastResetDate
FROM users
WHERE uid = 'YOUR_UID';
```

---

## 🚀 VALIDAÇÃO PRÉ-TESTE

### 1. Testar Upload para B2

- [ ] Executar teste de upload manual
  ```bash
  # Criar script de teste rápido
  node -e "
  import('./test-concurrency.js').then(module => {
    // Teste de upload será feito automaticamente
  });
  "
  ```

### 2. Testar Endpoint de Análise

- [ ] Fazer requisição manual para verificar API
  ```bash
  curl -X POST https://soundyai-app-production.up.railway.app/api/audio/analyze \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"fileKey":"test","mode":"genre","idToken":"YOUR_TOKEN"}'
  ```

### 3. Verificar Status do Sistema

- [ ] Railway API está online?
  ```bash
  curl https://soundyai-app-production.up.railway.app/api/health
  ```

- [ ] Worker está rodando?
  ```bash
  railway logs --service worker --tail 10
  ```

- [ ] Redis está acessível?
  ```bash
  redis-cli -u $REDIS_URL PING
  # Deve retornar: PONG
  ```

- [ ] PostgreSQL está acessível?
  ```bash
  psql $DATABASE_URL -c "SELECT 1;"
  # Deve retornar: 1
  ```

---

## ⚠️ AVISOS E PRECAUÇÕES

### Antes de Executar

- [ ] ✅ Avisei a equipe sobre o teste
- [ ] ✅ Escolhi horário de baixo tráfego
- [ ] ✅ Tenho backup dos dados (se aplicável)
- [ ] ✅ Sei como parar o teste (Ctrl+C)
- [ ] ✅ Tenho acesso aos logs do servidor

### Durante Execução

- [ ] ⏱️ Monitore a saída do console
- [ ] 📊 Observe taxa de enfileiramento
- [ ] ⚠️ Pare o teste se taxa de erro > 80%
- [ ] 🔍 Verifique logs do servidor em paralelo

### Após Execução

- [ ] 📄 Salve o relatório JSON gerado
- [ ] 📝 Documente observações importantes
- [ ] 🔍 Analise resultados usando guia de interpretação
- [ ] 📊 Compartilhe resultados com a equipe

---

## 🎯 CENÁRIOS DE TESTE RECOMENDADOS

### Teste 1: Baseline (Pequeno)
```
TOTAL_REQUESTS: 10
CONCURRENCY_LIMIT: 5
Objetivo: Estabelecer baseline de performance
```

### Teste 2: Médio
```
TOTAL_REQUESTS: 30
CONCURRENCY_LIMIT: 10
Objetivo: Testar comportamento sob carga moderada
```

### Teste 3: Completo (Padrão)
```
TOTAL_REQUESTS: 50
CONCURRENCY_LIMIT: 10
Objetivo: Simular carga realista de pico
```

### Teste 4: Stress
```
TOTAL_REQUESTS: 100
CONCURRENCY_LIMIT: 20
Objetivo: Identificar limite de capacidade
```

---

## 🛑 CRITÉRIOS DE PARADA

Pare o teste imediatamente se:

- ❌ Taxa de erro > 80% nos primeiros 10 requests
- ❌ API retorna HTTP 503 (Service Unavailable)
- ❌ Sistema de produção mostra sinais de sobrecarga
- ❌ Alerta de monitoramento é disparado

**Como parar:**
```bash
# Pressione Ctrl+C no terminal
# O script vai tentar finalizar gracefully
```

---

## 📊 COMANDOS DE EXECUÇÃO

### Opção 1: Comando Direto
```bash
node test-concurrency.js \
  --audioFile=./test-audio.wav \
  --idToken=$(cat .firebase-token)
```

### Opção 2: Script Automatizado (Linux/Mac)
```bash
chmod +x run-test.sh
./run-test.sh
```

### Opção 3: Script Automatizado (Windows)
```powershell
.\run-test.ps1
```

### Opção 4: Com Redirecionamento de Log
```bash
node test-concurrency.js \
  --audioFile=./test-audio.wav \
  --idToken=$(cat .firebase-token) \
  2>&1 | tee test-execution-$(date +%s).log
```

---

## 🔍 MONITORAMENTO PARALELO

Durante o teste, mantenha abas/terminais separados para:

### Terminal 1: Logs da API
```bash
railway logs --service api --tail 100 --filter "analyze"
```

### Terminal 2: Logs do Worker
```bash
railway logs --service worker --tail 100 --filter "Processing job"
```

### Terminal 3: Redis Monitor
```bash
redis-cli -u $REDIS_URL
# Depois executar:
MONITOR
```

### Terminal 4: PostgreSQL Queries
```bash
psql $DATABASE_URL
# Executar periodicamente:
SELECT status, COUNT(*) FROM jobs WHERE created_at > NOW() - INTERVAL '5 minutes' GROUP BY status;
```

---

## ✅ CHECKLIST FINAL

Antes de pressionar Enter:

- [ ] ✅ Todas as dependências instaladas
- [ ] ✅ .env configurado corretamente
- [ ] ✅ Arquivo de áudio válido e acessível
- [ ] ✅ Firebase token obtido e válido
- [ ] ✅ Parâmetros de teste ajustados
- [ ] ✅ Equipe avisada (se necessário)
- [ ] ✅ Horário apropriado (baixo tráfego)
- [ ] ✅ Monitoramento paralelo preparado
- [ ] ✅ Plano de ação para cada cenário definido

---

## 📞 CONTATOS DE EMERGÊNCIA

Em caso de problemas críticos:

1. **Parar teste**: Ctrl+C
2. **Verificar logs**: Railway Dashboard
3. **Escalar**: Avisar equipe de DevOps
4. **Rollback**: Se necessário, reiniciar serviços

---

**Lembre-se:** Este é um teste de DESENVOLVIMENTO/STAGING contra PRODUÇÃO. Execute com responsabilidade e atenção.

**Boa sorte! 🚀**
