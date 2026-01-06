# 🎯 TESTE DE CONCORRÊNCIA - IMPLEMENTAÇÃO COMPLETA

## 📋 Resumo Executivo

Foi criado um **sistema completo de testes de concorrência black-box** para avaliar a confiabilidade do SoundyAI em produção sob carga de 50 análises simultâneas.

## 📦 Arquivos Criados

### 1. **test-concurrency.js** (Script Principal)
- ✅ **690 linhas** de código robusto e comentado
- ✅ Upload real para Backblaze B2
- ✅ Autenticação Firebase ID Token
- ✅ 50 requisições simultâneas com controle de concorrência
- ✅ Sistema de polling com timeout configurável
- ✅ Métricas detalhadas e relatório em JSON

**Funcionalidades:**
- Upload automático do arquivo de áudio para B2
- Disparo controlado de requisições (concorrência ajustável)
- Monitoramento em tempo real via polling
- Detecção de timeouts e falhas
- Geração de relatório detalhado (console + JSON)

### 2. **get-firebase-token.js** (Script Auxiliar)
- ✅ Facilita obtenção do Firebase ID Token
- ✅ Login automático com email/senha
- ✅ Salva token em arquivo `.firebase-token`
- ✅ Exibe comando pronto para usar

**Uso:**
```bash
node get-firebase-token.js --email=seu@email.com --password=suasenha
```

### 3. **TEST-CONCURRENCY-README.md** (Documentação Completa)
- ✅ Instruções detalhadas de uso
- ✅ Configuração de pré-requisitos
- ✅ Exemplos práticos
- ✅ Análise de resultados
- ✅ Troubleshooting completo

### 4. **run-test.sh** (Script Bash - Linux/Mac)
- ✅ Execução simplificada do teste
- ✅ Validação de pré-requisitos
- ✅ Carrega token automaticamente

### 5. **run-test.ps1** (Script PowerShell - Windows)
- ✅ Versão Windows do script de execução
- ✅ Mesmas funcionalidades do Bash
- ✅ Interface colorida

### 6. **test-package.json** (Dependências)
- ✅ Lista todas as dependências necessárias
- ✅ Scripts NPM para facilitar execução

### 7. **.gitignore-test** (Segurança)
- ✅ Previne commit de tokens sensíveis
- ✅ Exclui relatórios com dados reais
- ✅ Ignora arquivos de áudio de teste

## 🚀 Como Usar

### Instalação (Primeira Vez)

```bash
# 1. Instalar dependências
npm install node-fetch@3.3.2 form-data@4.0.0 dotenv@16.3.1 firebase@10.7.1

# 2. Verificar .env configurado
cat .env  # Deve ter B2_KEY_ID, B2_APP_KEY, B2_BUCKET_NAME, B2_ENDPOINT
```

### Obter Firebase Token

```bash
# Opção A: Via script (recomendado)
node get-firebase-token.js --email=seu@email.com --password=suasenha

# O token será salvo em .firebase-token
```

### Executar Teste

```bash
# Opção A: Comando direto
node test-concurrency.js \
  --audioFile=./test-audio.wav \
  --idToken=eyJhbGciOiJSUzI1NiIsImtpZCI6IjE...

# Opção B: Script automatizado (Linux/Mac)
chmod +x run-test.sh
./run-test.sh

# Opção C: Script automatizado (Windows)
.\run-test.ps1
```

## 📊 Saída Esperada

### Durante Execução

```
[2026-01-06T10:30:00.000Z] 🚀 [1/50] Disparando análise...
[2026-01-06T10:30:01.234Z] ✅ [1] Análise enfileirada! {"jobId":"a1b2c3d4...","queueTime":"234ms"}
[2026-01-06T10:30:02.000Z] 🔍 [1] Monitorando job: a1b2c3d4...
[2026-01-06T10:35:15.678Z] ✅ [1] Análise concluída! {"totalTime":"315678ms"}
...
```

### Relatório Final

```
════════════════════════════════════════════════════════════════════════════════
📊 RELATÓRIO FINAL - TESTE DE CONCORRÊNCIA
════════════════════════════════════════════════════════════════════════════════

🎯 CONFIGURAÇÃO DO TESTE:
   Total de requisições: 50
   Limite de concorrência: 10
   Timeout por análise: 600s

📈 RESULTADOS:
   ✅ Concluídas com sucesso: 48
   ❌ Com erro: 1
   ⏱️ Timeout: 1
   📊 Taxa de sucesso: 96.00%

⏱️ TEMPOS:
   Tempo total do teste: 420.50s
   Tempo médio por análise: 315.20s

💾 Relatório detalhado salvo em: test-concurrency-report-1735987200000.json
```

## 🔍 Análise de Resultados

### ✅ Cenário de Sucesso
- **Taxa de sucesso**: > 95%
- **Timeouts**: 0 ou < 2
- **Tempo médio**: < 5 minutos
- **Conclusão**: Sistema confiável

### ⚠️ Cenário de Problema
- **Taxa de sucesso**: < 90%
- **Timeouts**: > 10%
- **Muitos erros HTTP**: 429, 500, 503
- **Conclusão**: Possível race condition ou sobrecarga

### 🐛 Tipos de Falha

| Status | Significado | Ação |
|--------|-------------|------|
| `failed` (dispatch) | Erro ao enfileirar | Verificar logs da API |
| `timeout` | Job não finaliza | Verificar worker/processamento |
| `failed` (monitoring) | Job falhou no processamento | Verificar logs do worker |
| HTTP 429 | Rate limit atingido | Reduzir concorrência |
| HTTP 401 | Token inválido | Obter novo token |

## ⚙️ Configuração Avançada

Você pode ajustar os parâmetros editando `test-concurrency.js`:

```javascript
const CONFIG = {
  // Quantidade de análises
  TOTAL_REQUESTS: 50,  // Ajuste para menos (10-20) para testes menores
  
  // Concorrência máxima
  CONCURRENCY_LIMIT: 10,  // Reduza se sobrecarregar (5-10)
  
  // Intervalo de polling
  POLLING_INTERVAL: 5000,  // Aumente para reduzir carga (10000 = 10s)
  
  // Timeout por análise
  MAX_WAIT_TIME: 600000,  // 10 minutos - ajuste conforme necessário
};
```

## 🛡️ Segurança e Boas Práticas

### ✅ Faça

- Use conta PRO para evitar limites
- Execute fora do horário de pico
- Salve relatórios para análise posterior
- Coordene com a equipe antes de executar

### ❌ Não Faça

- Não execute repetidamente sem intervalo
- Não compartilhe Firebase tokens
- Não commit tokens no Git
- Não abuse da API de produção

## 🔧 Troubleshooting

### Problema: `B2_KEY_ID não configurado`

```bash
# Solução: Configure .env
echo "B2_KEY_ID=your_key_id" >> .env
echo "B2_APP_KEY=your_app_key" >> .env
echo "B2_BUCKET_NAME=your_bucket_name" >> .env
```

### Problema: `Token inválido ou expirado`

```bash
# Solução: Obtenha novo token (válido por 1 hora)
node get-firebase-token.js --email=... --password=...
```

### Problema: Muitos timeouts (> 50%)

**Causas:**
1. Worker não está rodando
2. Servidor sobrecarregado
3. Timeout muito curto

**Ação:**
- Verificar logs do Railway
- Verificar status do worker no BullMQ
- Aumentar `MAX_WAIT_TIME` se necessário

### Problema: Taxa de erro > 20%

**Causas:**
1. Race condition no enfileiramento (BUG)
2. Limite de plano atingido
3. Problema no Redis/PostgreSQL

**Ação:**
- Analisar erros específicos no JSON
- Verificar logs da API
- Testar com menos requisições (10-20)

## 📝 Arquitetura do Teste

```
┌─────────────────┐
│   test-         │
│   concurrency.js│
└────────┬────────┘
         │
         ├─► 1. Upload para B2
         │   └─> fileKey gerado
         │
         ├─► 2. Disparo de 50 análises
         │   ├─> POST /api/audio/analyze (com idToken)
         │   ├─> Controle de concorrência (10 simultâneas)
         │   └─> Retorna jobId
         │
         ├─► 3. Monitoramento via polling
         │   ├─> GET /api/jobs/{jobId} (a cada 5s)
         │   ├─> Status: queued → processing → completed
         │   └─> Timeout: 10 minutos
         │
         └─► 4. Geração de relatório
             ├─> Console com resumo
             └─> JSON com detalhes completos
```

## 🎯 Objetivo do Teste

Identificar se existem problemas de:

1. **Race Conditions**: Jobs perdidos no enfileiramento
2. **Travamentos**: Jobs que não iniciam processamento
3. **Timeouts**: Jobs que não finalizam
4. **Confiabilidade**: % de sucesso sob carga

## 📊 Métricas Coletadas

Por cada requisição:
- ✅ Timestamp de envio
- ✅ Status HTTP da resposta
- ✅ Job ID retornado
- ✅ Tempo de enfileiramento
- ✅ Tempo de processamento
- ✅ Tempo total
- ✅ Status final (completed/failed/timeout)
- ✅ Mensagem de erro (se houver)

## 🚀 Próximos Passos

1. **Executar teste inicial**: Com 10 requisições
2. **Analisar resultados**: Taxa de sucesso e tempo médio
3. **Aumentar carga**: Para 30, depois 50 requisições
4. **Identificar gargalos**: Se taxa < 90%
5. **Documentar problemas**: Com logs e métricas

## 📞 Suporte

Para análise dos resultados:
1. Compartilhe o arquivo JSON gerado
2. Informe configuração usada (total de requisições, etc)
3. Inclua logs relevantes do Railway (se disponível)

---

**Status**: ✅ Pronto para uso  
**Versão**: 1.0.0  
**Data**: 6 de janeiro de 2026  
**Autor**: Engenharia SoundyAI
