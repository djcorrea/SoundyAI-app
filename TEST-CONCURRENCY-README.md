# 🧪 TESTE DE CONCORRÊNCIA - SoundyAI Production

Script de teste black-box para avaliar o comportamento do sistema SoundyAI sob carga de 50 análises simultâneas em ambiente de produção (Railway/HiWi).

## 📋 Descrição

Este script executa um teste de concorrência **não invasivo** que:
- ✅ Não modifica o backend
- ✅ Usa apenas endpoints públicos da API
- ✅ Simula comportamento de usuários legítimos
- ✅ Monitora e reporta métricas detalhadas

## 🎯 Objetivo

Validar a confiabilidade do sistema de enfileiramento e processamento de análises de áudio sob carga, identificando possíveis problemas de:
- Perda de jobs na fila (race conditions)
- Análises que não iniciam processamento
- Análises que não finalizam após enfileiramento
- Timeouts e falhas inesperadas

## ⚙️ Configuração

### 1. Pré-requisitos

- Node.js 18+ instalado
- Conta Firebase autenticada (PRO recomendado para limites maiores)
- Arquivo de áudio válido (.wav, .mp3 ou .flac) de até 150MB
- Credenciais B2 configuradas no `.env`

### 2. Instalar Dependências

```bash
npm install node-fetch form-data dotenv
```

### 3. Configurar Variáveis de Ambiente

Certifique-se de que o arquivo `.env` contém:

```env
# Backblaze B2
B2_KEY_ID=your_key_id
B2_APP_KEY=your_app_key
B2_BUCKET_NAME=your_bucket_name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
```

### 4. Obter Firebase ID Token

Para obter um token válido, você pode:

**Opção A: Via Browser Console (Recomendado)**

1. Acesse https://soundyai.com.br
2. Faça login com sua conta PRO
3. Abra o Console do navegador (F12)
4. Execute:

```javascript
firebase.auth().currentUser.getIdToken(true).then(token => {
  console.log('Token:', token);
  // Copie o token exibido
});
```

**Opção B: Via Script Node.js**

Crie um arquivo `get-token.js`:

```javascript
import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Substitua pelo UID do usuário de teste
const uid = 'YOUR_USER_UID';

admin.auth().createCustomToken(uid)
  .then(token => {
    console.log('Custom Token:', token);
    // Use este token para autenticar no Firebase Auth client-side
  });
```

## 🚀 Uso

### Comando Básico

```bash
node test-concurrency.js --audioFile=./audio.wav --idToken=YOUR_FIREBASE_TOKEN
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `--audioFile` | string | ✅ | Caminho para o arquivo de áudio (.wav, .mp3, .flac) |
| `--idToken` | string | ✅ | Firebase ID Token válido |

### Exemplo Completo

```bash
node test-concurrency.js \
  --audioFile=./test-audio.wav \
  --idToken=eyJhbGciOiJSUzI1NiIsImtpZCI6IjE...
```

## 🔧 Configuração Avançada

Você pode ajustar os parâmetros do teste editando o objeto `CONFIG` no script:

```javascript
const CONFIG = {
  // Total de análises simultâneas
  TOTAL_REQUESTS: 50,
  
  // Máximo de requisições em paralelo
  CONCURRENCY_LIMIT: 10,
  
  // Intervalo entre verificações de status (ms)
  POLLING_INTERVAL: 5000,
  
  // Timeout máximo por análise (ms) - 10 minutos
  MAX_WAIT_TIME: 600000,
};
```

## 📊 Saída do Script

### Log em Tempo Real

Durante a execução, o script exibe:

```
[2026-01-06T10:30:00.000Z] 🚀 [1/50] Disparando análise...
[2026-01-06T10:30:01.234Z] ✅ [1] Análise enfileirada!
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "queueTime": "234ms"
}
[2026-01-06T10:30:02.000Z] 🔍 [1] Monitorando job: a1b2c3d4...
[2026-01-06T10:35:15.678Z] ✅ [1] Análise concluída!
{
  "totalTime": "315678ms",
  "processingTime": "313444ms"
}
```

### Relatório Final

Ao final, exibe um resumo completo:

```
════════════════════════════════════════════════════════════════════════════════
📊 RELATÓRIO FINAL - TESTE DE CONCORRÊNCIA
════════════════════════════════════════════════════════════════════════════════

🎯 CONFIGURAÇÃO DO TESTE:
   Total de requisições: 50
   Limite de concorrência: 10
   Timeout por análise: 600s
   Intervalo de polling: 5s

📈 RESULTADOS:
   ✅ Concluídas com sucesso: 48
   ❌ Com erro: 1
   ⏱️ Timeout: 1
   📊 Taxa de sucesso: 96.00%

⏱️ TEMPOS:
   Tempo total do teste: 420.50s
   Tempo médio por análise: 315.20s

🔍 DETALHAMENTO POR STATUS:
   completed: 48
   failed: 1
   timeout: 1

════════════════════════════════════════════════════════════════════════════════
```

### Arquivo JSON Detalhado

O script também gera um arquivo JSON com métricas completas:

```json
{
  "config": {
    "TOTAL_REQUESTS": 50,
    "CONCURRENCY_LIMIT": 10,
    "POLLING_INTERVAL": 5000,
    "MAX_WAIT_TIME": 600000
  },
  "metrics": {
    "totalDispatched": 50,
    "totalQueued": 49,
    "totalCompleted": 48,
    "totalFailed": 1,
    "totalTimeout": 1,
    "requests": [
      {
        "index": 1,
        "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "status": "completed",
        "startTime": 1735987200000,
        "dispatchTime": 1735987201234,
        "queueTime": 1735987201234,
        "completeTime": 1735987516912,
        "error": null,
        "httpStatus": 200
      }
    ]
  },
  "summary": {
    "totalTime": 420500,
    "avgTime": 315200,
    "successRate": 96
  }
}
```

## 🔍 Análise dos Resultados

### Indicadores de Sucesso ✅

- **Taxa de sucesso > 95%**: Sistema confiável
- **Tempo médio < 5 minutos**: Performance adequada
- **Timeouts = 0**: Sem problemas de travamento

### Indicadores de Problema ⚠️

- **Taxa de sucesso < 90%**: Possível race condition ou bug no enfileiramento
- **Muitos timeouts (> 10%)**: Jobs não estão sendo processados
- **Erros HTTP 429**: Limite de rate limiting atingido
- **Erros HTTP 401**: Token expirado ou inválido

### Tipos de Falha

| Tipo | Causa Provável | Ação Recomendada |
|------|----------------|------------------|
| `failed` no dispatch | Erro ao enfileirar (HTTP 4xx/5xx) | Verificar logs do servidor |
| `timeout` | Job não finaliza em 10 min | Investigar worker/processamento |
| `failed` no monitoring | Job falhou durante processamento | Verificar logs do worker |
| HTTP 429 | Limite de rate limiting | Reduzir `CONCURRENCY_LIMIT` |

## 🛡️ Segurança e Limites

### Conta PRO Recomendada

Para evitar atingir limites do plano FREE:
- ✅ Use conta PRO com limite maior de análises
- ✅ Execute o teste fora do horário de pico
- ✅ Configure `CONCURRENCY_LIMIT` apropriado

### Não Abuse da API

Este script é para **testes de desenvolvimento/staging**:
- ❌ Não execute repetidamente em curto período
- ❌ Não use em produção sem coordenação
- ❌ Não compartilhe seu Firebase ID Token

## 📝 Notas Técnicas

### Fluxo do Teste

1. **Upload**: Arquivo enviado para Backblaze B2
2. **Dispatch**: 50 requisições POST `/api/audio/analyze` com controle de concorrência
3. **Enfileiramento**: Backend adiciona jobs na fila Redis (BullMQ)
4. **Monitoring**: Polling GET `/api/jobs/{id}` a cada 5s
5. **Conclusão**: Aguarda todas as análises finalizarem ou timeout
6. **Relatório**: Gera métricas e salva JSON

### Limites Técnicos

- **Tamanho do arquivo**: Até 150MB (configurável via `MAX_UPLOAD_MB`)
- **Timeout por análise**: 10 minutos (configurável)
- **Formatos aceitos**: WAV, FLAC, MP3
- **Concorrência**: Até 50 requisições simultâneas (ajuste conforme servidor)

## 🐛 Troubleshooting

### Erro: `B2_KEY_ID não configurado`

**Solução**: Configure as variáveis de ambiente no `.env`:
```env
B2_KEY_ID=your_key_id
B2_APP_KEY=your_app_key
```

### Erro: `Token inválido ou expirado`

**Solução**: Obtenha um novo Firebase ID Token (válido por 1 hora)

### Erro: `Arquivo não encontrado`

**Solução**: Verifique o caminho do arquivo de áudio:
```bash
node test-concurrency.js --audioFile=./caminho/correto/audio.wav --idToken=...
```

### Muitos Timeouts (> 50%)

**Causas possíveis**:
1. Worker não está processando a fila
2. Servidor de produção sobrecarregado
3. Timeout muito curto (< 5 minutos)

**Ação**: Verifique os logs do Railway e status do worker

### Taxa de Erro > 20%

**Causas possíveis**:
1. Race condition no enfileiramento (bug crítico)
2. Limite de plano atingido
3. Problema no Redis/PostgreSQL

**Ação**: Analise os erros específicos no JSON gerado

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs detalhados no arquivo JSON gerado
2. Analise os logs do servidor Railway
3. Revise a documentação da API

## ⚖️ Licença

Este script é de uso interno para testes de desenvolvimento. Não distribua ou use sem autorização.
