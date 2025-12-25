# 🔇 LOGGING REDUCTION REPORT

## Objetivo
Reduzir logs no backend do Railway (limite: 500 logs/sec) sem quebrar funcionalidade.

## Estratégia Implementada

### 1. Logger Central Criado (`work/lib/logger.js`)
- **Níveis**: error, warn, info, debug, debugFFT
- **ENV Variables**:
  - `LOG_LEVEL=error|warn|info|debug` (padrão: warn)
  - `FFT_DEBUG=true|false` (padrão: false)
  - `LOG_SAMPLE_N=0-100` (padrão: 0 = desabilitado)

### 2. Função Helper
- `summarizeArray(arr)`: retorna {len, min, max, avg} ao invés de logar array completo

### 3. Arquivos Modificados

#### ✅ work/lib/logger.js
- Criado logger central com todos os níveis
- Implementado debugFFT para logs de FFT/spectrum/bands
- Implementado sampling opcional
- Helper summarizeArray para evitar logging de arrays grandes

#### ✅ work/api/audio/core-metrics.js
- Importado logger
- Substituído console.log/warn por logger.debug/warn/debugFFT
- Logs de FFT/spectrum agora controlados por FFT_DEBUG
- Logs de arrays grandes substituídos por summarizeArray
- **Redução estimada**: ~80% dos logs (de ~50 logs por análise para ~10)

#### ✅ work/api/audio/pipeline-complete.js
- Importado logger
- Substituídos logs de início/fim por logger.analysisStart/End
- Logs de DEBUG/GENRE-FLOW/MODE-FLOW convertidos para logger.debugFFT
- Logs de fases reduzidos e condensados
- **Redução estimada**: ~90% dos logs verbosos (de ~200+ logs para ~20)

#### 🔄 Pendente work/worker.js
- Muitos logs de AUDIT/GENRE que podem ser convertidos
- Logs de job processing que podem ser condensados

#### 🔄 Pendente work/lib/audio/features/*.js
- spectral-bands.js: logs por banda
- spectral-metrics.js: logs por frame
- Outros calculadores que logam em loops

## Recomendações de ENV no Railway

```bash
# Produção (mínimo de logs)
LOG_LEVEL=warn
FFT_DEBUG=false
LOG_SAMPLE_N=0

# Debug controlado (se necessário investigar)
LOG_LEVEL=info
FFT_DEBUG=false
LOG_SAMPLE_N=50  # loga 1 em cada 50 mensagens info

# Debug completo FFT (apenas para diagnóstico pontual)
LOG_LEVEL=debug
FFT_DEBUG=true
LOG_SAMPLE_N=0
```

## Impacto Esperado

### Antes (estimativa)
- ~300-500 logs por análise de áudio
- Pipeline + FFT + Bandas + Sugestões = explosão de logs
- Facilmente ultrapassava 500 logs/sec em carga

### Depois (com FFT_DEBUG=false, LOG_LEVEL=warn)
- ~15-30 logs por análise de áudio
- Apenas logs essenciais: erros, warnings, início/fim de análise
- **Redução: ~95% dos logs**

## Próximos Passos

1. ✅ Completar substituições em worker.js
2. ✅ Completar substituições em lib/audio/features/
3. ✅ Testar localmente com FFT_DEBUG=true/false
4. ✅ Deploy no Railway com variáveis configuradas
5. ✅ Monitorar logs/sec e ajustar LOG_SAMPLE_N se necessário

## Logs Preservados (nunca silenciados)

- ❌ Erros (logger.error) - sempre logados
- ⚠️ Warnings (logger.warn) - sempre logados
- 🚀 Início/fim de análises - essenciais para troubleshooting
- 💾 Operações de banco de dados (sucesso/erro)
- 🔥 Erros de pipeline críticos

## Logs Silenciados (FFT_DEBUG=false)

- 📊 Métricas por frame/banda/bin
- 🎯 Arrays FFT/magnitude/spectrum
- 🔍 Logs de DEBUG-SUGGESTIONS verbosos
- 📈 Logs de V2-SYSTEM detalhados
- 🎵 Logs de GENRE-FLOW repetitivos
