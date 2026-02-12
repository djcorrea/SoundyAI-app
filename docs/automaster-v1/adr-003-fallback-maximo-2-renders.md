# ADR-003: Fallback Máximo 2 Renders

**Status:** ✅ Aceito  
**Data:** 09 de fevereiro de 2026  
**Decisores:** CTO, Backend Lead, Audio Engineer  
**Contexto:** Prevenir loops infinitos e custos explosivos

---

## Contexto e Problema

O processamento DSP pode falhar em atingir targets por diversos motivos:
- Compressão insuficiente → LUFS longe do target
- Limiter muito agressivo → DR abaixo do mínimo
- True Peak acima do ceiling (overshoot)

Quando falha, o sistema pode tentar novamente com parâmetros ajustados.  
**Problema:** Quantas tentativas permitir antes de abortar?

---

## Opções Consideradas

### Opção A: Render Único (sem retry)
Processa uma vez e entrega o resultado, mesmo se fora dos guardrails.

**Pros:**
- Simples: sem lógica de fallback
- Rápido: 1 render por job
- Custo previsível

**Contras:**
- Taxa de falha pode ser alta (10-20%)
- Usuário recebe áudio fora do spec
- Perda de confiança

### Opção B: Fallback Infinito
Tentativas ilimitadas até acertar.

**Pros:**
- Taxa de sucesso ~100% (eventualmente acerta)
- Usuário sempre recebe resultado válido

**Contras:**
- **Custo incontrolável:** job pode custar 10x mais
- Timeout: usuário espera 10+ minutos
- Debug impossível (qual tentativa funcionou?)
- Risco de loop infinito se bug na lógica

### Opção C: Fallback Limitado (max N tentativas)
Permitir 1 render padrão + 1 fallback conservador.

**Pros:**
- Balanço entre sucesso e custo
- Previsível: max 2 renders por job
- Se falhar 2x: claramente problema no input ou engine

**Contras:**
- Taxa de sucesso < 100% (alguns jobs abortarão)
- Precisa lógica de escolha de parâmetros do fallback

---

## Decisão

**Escolhemos Opção C: Máximo 2 Renders.**

### Regra de Ouro
```
1 render padrão + 1 fallback conservador = MAX 2
```

### Lógica de Fallback

#### Tentativa 1 (Render Padrão)
Usar parâmetros do modo escolhido (ex: IMPACT → -7 LUFS, TP -0.1).

**Se passar validação:** ✅ Entregar e finalizar.  
**Se falhar validação:**
- Clipping (TP > 0.0) → ABORT imediatamente (Tier 1)
- DR muito baixo → FALLBACK
- LUFS longe do target → FALLBACK
- True Peak acima do ceiling → FALLBACK

#### Tentativa 2 (Fallback Conservador)
Ajustar parâmetros para versão "segura":

| Parâmetro | Ajuste no Fallback |
|-----------|-------------------|
| Target LUFS | +2 LU acima do original (mais baixo) |
| TP Ceiling | -0.2 dB mais conservador |
| DR Mínimo | +1 dB (menos compressão) |
| Compression Ratio | Reduzir em 1 (ex: 4:1 → 3:1) |
| Limiter Release | +20ms (mais suave) |

**Exemplo:**
- Modo IMPACT falhou (target -7 LUFS, ceiling -0.1, DR min 6)
- Fallback: target -5 LUFS, ceiling -0.3, DR min 7

**Se passar validação:** ✅ Entregar com WARNING: "Usado modo conservador".  
**Se falhar novamente:** ❌ ABORTAR job com erro explicativo.

---

## Implementação

### Código Core

```javascript
async function processMasteringJob(jobData, attemptCount = 1) {
  const MAX_ATTEMPTS = 2;
  
  if (attemptCount > MAX_ATTEMPTS) {
    throw new Error(`Job ${jobData.id} excedeu máximo de renders (${MAX_ATTEMPTS}). Abortando.`);
  }
  
  // Calcular parâmetros (ajustados se fallback)
  const params = calculateProcessingParams(jobData.genreTargets, jobData.mode, attemptCount);
  
  // Executar processamento
  const masteredAudio = await applyDSP(jobData.audioPath, params);
  
  // Validar resultado
  const validation = await validateMasteredAudio(masteredAudio, params, attemptCount);
  
  if (validation.severity === 'CRITICAL') {
    // Clipping ou erro grave: FAIL imediatamente
    throw new Error(`Validação falhou (CRITICAL): ${validation.errors.join(', ')}`);
  }
  
  if (validation.passed) {
    // Sucesso!
    return {
      audio: masteredAudio,
      params,
      attemptCount,
      warnings: validation.warnings
    };
  }
  
  // Validação falhou mas não é crítico: tentar fallback
  if (attemptCount < MAX_ATTEMPTS) {
    console.log(`[AUTOMASTER] Tentativa ${attemptCount} falhou. Iniciando fallback...`);
    return processMasteringJob(jobData, attemptCount + 1);
  }
  
  // Fallback também falhou: abortar
  throw new Error(`Job ${jobData.id} falhou após ${MAX_ATTEMPTS} tentativas. Erros: ${validation.errors.join(', ')}`);
}

function calculateProcessingParams(genreTargets, mode, attemptCount) {
  const baseParams = getModeParams(genreTargets, mode);
  
  if (attemptCount === 1) {
    // Primeira tentativa: parâmetros normais
    return baseParams;
  }
  
  // Fallback: parâmetros conservadores
  return {
    ...baseParams,
    targetLUFS: baseParams.targetLUFS + 2, // mais baixo
    truePeakCeiling: baseParams.truePeakCeiling - 0.2, // mais conservador
    drMin: baseParams.drMin + 1, // menos compressão
    compression: {
      ...baseParams.compression,
      ratio: Math.max(baseParams.compression.ratio - 1, 2) // não menos que 2:1
    },
    limiter: {
      ...baseParams.limiter,
      release: baseParams.limiter.release + 20 // mais suave
    }
  };
}
```

---

## Consequências

### Positivas ✅
- **Custo previsível:** Máximo 2x custo base por job
- **Performance:** Se falhar 2x, job completa em ~2min (não 10min)
- **Debugabilidade:** Logs mostram exatamente qual tentativa funcionou
- **Taxa de sucesso alta:** ~90% primeiro render, ~95% com fallback

### Negativas ❌
- **5% de jobs podem falhar:** Usuário recebe erro (mitigação: erro explicativo + suporte)
- **Não é perfeito:** Alguns áudios realmente difíceis não masterizam

### Neutras 🟡
- Precisa monitorar taxa de fallbacks (dashboard: % de jobs que usaram fallback)

---

## Casos de Borda

### Áudio Já Masterizado
- Usuário sobe áudio em -6 LUFS, escolhe IMPACT (target -7 LUFS)
- Primeira tentativa tenta subir 1 LU, mas viola DR mínimo
- Fallback recua para -5 LUFS (resultado: quase sem mudança)
- **Comportamento correto:** Sistema reconhece que áudio já está próximo do ideal

### Áudio Impossível de Masterizar
- Áudio com clipping no original
- Áudio com distorção harmônica alta
- **Comportamento correto:** Falha após 2 tentativas com erro: "Áudio de entrada tem qualidade insuficiente"

---

## Métricas de Sucesso

### Observabilidade

Dashboard deve mostrar:
- **% de jobs que passaram no 1º render:** Target ≥ 85%
- **% de jobs que precisaram fallback:** Target ≤ 10%
- **% de jobs abortados:** Target ≤ 5%
- **Tempo médio por job:** Target < 60s (inclui fallback)

### Alertas

- Se % fallback > 15%: Investigar (engine muito agressivo?)
- Se % abortado > 10%: Problema na engine ou targets

---

## Futuras Melhorias (V2)

### Fallback Inteligente com ML
Usar histórico de jobs para prever quais parâmetros funcionam melhor para cada caso.  
Exemplo: "Áudios com DR inicial < 5 raramente funcionam em IMPACT → sugerir BALANCED".

---

## Decisões Relacionadas

- **ADR-002:** 3 modos (fallback ajusta parâmetros do modo)
- **ADR-004:** Gating por plano (aborts afetam créditos?)

---

**Status:** Implementar em Fase 2 (backend + worker)  
**Review:** Após 1 mês em prod, ajustar MAX_ATTEMPTS se necessário
