# ADR-002: Sistema de 3 Modos

**Status:** ✅ Aceito  
**Data:** 09 de fevereiro de 2026  
**Decisores:** CTO, Audio Engineer, Product Manager  
**Contexto:** Quantos e quais modos de masterização oferecer

---

## Contexto e Problema

Usuários têm objetivos diferentes:
- Alguns querem máximo volume (playlists, rádio)
- Outros querem dinâmica preservada (Spotify, streaming)
- Outros querem balanço (uso geral)

Precisamos decidir **quantos modos** e **como diferenciá-los**.

---

## Opções Consideradas

### Opção A: Modo Único (sem escolha)
Apenas 1 modo "universal" para todos os casos.

**Pros:**
- Simples: sem decisão do usuário
- Menos testes necessários

**Contras:**
- Ignora diferentes objetivos
- Usuário não tem controle
- Difícil satisfazer todos

### Opção B: 5+ Modos (granular)
Múltiplos modos: RADIO, STREAMING, CD, VINYL, LOUD, TRANSPARENT, etc.

**Pros:**
- Máxima flexibilidade
- Atende nicho de audiophiles

**Contras:**
- Confuso para usuários casuais
- Validação: 5x mais testes
- Esforço de manutenção alto

### Opção C: 3 Modos (CLEAN, BALANCED, IMPACT)
3 modos cobrindo espectro de conservador → agressivo.

**Pros:**
- Simplicidade + flexibilidade balanceada
- Usuário entende rapidamente
- Cobre 90% dos casos de uso

**Contras:**
- Pode não atender casos extremos (audiophiles, competições de loudness)

---

## Decisão

**Escolhemos Opção C: 3 Modos.**

### Definição dos Modos

#### 1. CLEAN 🟢
**Objetivo:** Preservar dinâmica, segurança máxima.  
**Casos de uso:** Spotify, Apple Music, YouTube, mix sem master.

**Parâmetros:**
- LUFS target: `genreTarget + 2 LU` (ex: -11 LUFS para funk)
- True Peak ceiling: **-0.5 dBTP** (conservador)
- DR mínimo: **9 dB**
- Compression ratio: **2:1** (suave)
- Limiter release: **100ms** (longo, natural)

**Perfil sonoro:** Natural, "respirando", sem pumping.

---

#### 2. BALANCED ⚖️ (DEFAULT)
**Objetivo:** Balancear volume vs dinâmica.  
**Casos de uso:** Uso geral, intermediário.

**Parâmetros:**
- LUFS target: `genreTarget` (ex: -9 LUFS para funk)
- True Peak ceiling: **-0.3 dBTP** (padrão)
- DR mínimo: **7 dB**
- Compression ratio: **3:1** (moderado)
- Limiter release: **50ms** (médio)

**Perfil sonoro:** Profissional, equilibrado, competitivo.

---

#### 3. IMPACT 🔴
**Objetivo:** Máximo volume e punch.  
**Casos de uso:** Rádio, clubs, competição de loudness.

**Parâmetros:**
- LUFS target: `genreTarget - 2 LU` (ex: -7 LUFS para funk)
- True Peak ceiling: **-0.1 dBTP** (agressivo)
- DR mínimo: **6 dB**
- Compression ratio: **4:1** (firme)
- Limiter release: **30ms** (curto, punch)

**Perfil sonoro:** Alto, presente, "in your face".

---

### Como Modos NÃO Alteram Destino

**IMPORTANTE:** Modos alteram **estratégia**, não **destino**.

- Se gênero = funk (target -9 LUFS):
  - IMPACT → -7 LUFS (mais alto)
  - BALANCED → -9 LUFS (exato)
  - CLEAN → -11 LUFS (mais baixo)

- **MAS:** Targets de bandas espectrais permanecem os mesmos.  
  Exemplo: bass do funk deve estar em -23.5 dB em TODOS os modos.

**Diferença:** Ceiling e compressão afetam COMO chegar lá.

---

## Implementação

### Função Core
```javascript
function calculateModeParameters(genreTargets, mode) {
  const baseTarget = genreTargets.lufs_target;
  
  const modeConfigs = {
    clean: {
      lufsOffset: +2,
      truePeakCeiling: -0.5,
      drMin: 9,
      compressionRatio: 2,
      limiterRelease: 100
    },
    balanced: {
      lufsOffset: 0,
      truePeakCeiling: -0.3,
      drMin: 7,
      compressionRatio: 3,
      limiterRelease: 50
    },
    impact: {
      lufsOffset: -2,
      truePeakCeiling: -0.1,
      drMin: 6,
      compressionRatio: 4,
      limiterRelease: 30
    }
  };
  
  const config = modeConfigs[mode];
  
  return {
    targetLUFS: baseTarget + config.lufsOffset,
    truePeakCeiling: config.truePeakCeiling,
    drMin: config.drMin,
    compression: {
      ratio: config.compressionRatio,
      threshold: -18, // ajustável
      attack: 3,
      release: config.limiterRelease / 2
    },
    limiter: {
      ceiling: config.truePeakCeiling,
      attack: mode === 'impact' ? 1 : (mode === 'clean' ? 5 : 3),
      release: config.limiterRelease
    }
  };
}
```

---

## Consequências

### Positivas ✅
- Usuário tem controle sem confusão
- 3 modos cobrem 90% dos casos
- Testável: 3x esforço (não 5x ou 10x)
- Marketing claro: "Escolha seu estilo"

### Negativas ❌
- Casos extremos não atendidos (ex: vinyl master com RIAA curve)
- Pode haver demanda futura por modo "Custom"

### Neutras 🟡
- Usuário precisa entender qual modo escolher (mitigação: tooltips, sugestão baseada em objetivo)

---

## Alternativas Futuras

### V2: Modo "STREAMING" dedicado
Se Spotify/YouTube adotarem -14 LUFS como padrão, adicionar modo específico.

### V3: Modo "CUSTOM"
Para usuários STUDIO: sliders para ajustar cada parâmetro.

---

## Decisões Relacionadas

- **ADR-001:** Targets fixos por gênero (destino)
- **ADR-003:** Fallback máximo 2 renders (se modo falhar)

---

**Status:** Implementar em Fase 1 (engine DSP)  
**Review:** Após beta, avaliar se 3 modos são suficientes
