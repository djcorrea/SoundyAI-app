# AutoMaster V1 - Núcleo Técnico

Script isolado para masterização básica de áudio usando FFmpeg.

## 🎯 Objetivo

Criar o **primeiro núcleo executável** do AutoMaster V1:
- Recebe um arquivo WAV
- Aplica processamento de masterização conservador e previsível
- Gera um novo arquivo WAV masterizado

**Este é apenas o núcleo técnico.** Sem integração com filas, banco, API ou frontend.

## ⚙️ O Que Ele FAZ

1. **Loudnorm TWO-PASS (Precisão Máxima)**:
   - Análise: mede características do áudio (LUFS, True Peak, LRA)
   - Render: aplica normalização com parâmetros medidos
   - Garante precisão técnica superior ao single-pass

2. **Limitação True Peak**: Garante que nenhum sample ultrapasse o ceiling (via `alimiter`)

3. **Pós-Validação Automática**:
   - Mede o arquivo masterizado final
   - Verifica LUFS: ±0.1 LU do target
   - Verifica True Peak: <= ceiling + 0.05 dB

4. **Fallback Conservador**:
   - Se validação falhar: re-processa com ceiling -0.2 dB
   - Máximo 2 tentativas (principal + fallback)

5. **Gate Técnico**: `precheck-audio.cjs` bloqueia áudios problemáticos antes de processar

6. **Logs Estruturados**: Output JSON parseável com métricas de precisão

## 🚫 O Que Ele NÃO FAZ (ainda)

- ❌ EQ ou balanço espectral automático
- ❌ Saturação harmônica
- ❌ Compressão multibanda
- ❌ Ajuste de stereo width
- ❌ Targets adaptativos por gênero (usa apenas modo escolhido)
- ❌ Integração com filas/banco/API
- ❌ UX ou interface web
- ❌ Sugestão automática de gênero ou modo

## 📋 Pré-requisitos

1. **Node.js** (v16+)
2. **FFmpeg** instalado e disponível no PATH

### Verificar FFmpeg

```powershell
ffmpeg -version
```

Se não estiver instalado:
- Windows: `winget install FFmpeg` ou baixar de [ffmpeg.org](https://ffmpeg.org)
- Linux: `sudo apt install ffmpeg`
- macOS: `brew install ffmpeg`

## � Gate Técnico (Obrigatório)

**SEMPRE execute o precheck ANTES de masterizar.**

O `precheck-audio.cjs` analisa o áudio e determina se ele pode ser masterizado com segurança, protegendo:
- ✅ Qualidade sonora (evita processar áudio já corrompido)
- ✅ Custo de infraestrutura (bloqueia arquivos inválidos)
- ✅ Previsibilidade do sistema (garante inputs consistentes)

### Uso do Precheck

```bash
node automaster/precheck-audio.cjs <input.wav>
```

### Status Possíveis

| Status | Significado | Ação |
|--------|-------------|------|
| **OK** | Faixa tecnicamente apta | ✅ Pode masterizar |
| **WARNING** | Risco técnico presente | ⚠️ Pode masterizar mas revisar resultado |
| **BLOCKED** | Impedimento técnico | ❌ NÃO masterizar |

### Exemplo de Saída (OK)

```json
{
  "status": "OK",
  "reason": "Faixa tecnicamente apta para masterização.",
  "metrics": {
    "duration_sec": 243.2,
    "sample_rate": 44100,
    "channels": 2,
    "integrated_lufs": -16.3,
    "true_peak_db": -1.2,
    "lra": 8.5,
    "estimated_dr": 7.8,
    "silence_ratio": 0.03
  }
}
```

### Exemplo de Saída (BLOCKED)

```json
{
  "status": "BLOCKED",
  "reason": "True Peak muito alto (-0.05 dBTP). Risco de clipping.",
  "metrics": {
    "duration_sec": 180.5,
    "sample_rate": 44100,
    "channels": 2,
    "integrated_lufs": -7.2,
    "true_peak_db": -0.05,
    "lra": 3.1,
    "estimated_dr": 4.2,
    "silence_ratio": 0.01
  }
}
```

### Regras de Gate (Conservadoras)

**BLOCKED (não masterizar):**
- True Peak > -0.1 dBTP (clipping iminente)
- Duração < 10 segundos
- Silêncio > 50% da faixa
- Dynamic Range < 3 dB (over-compressed)

**WARNING (risco técnico):**
- LUFS > -8 (já muito alto)
- True Peak > -0.5 dBTP (próximo de clipar)
- LRA < 3 LU (muito "achatado")

### Workflow Recomendado

```bash
# 1. Precheck (obrigatório)
node automaster/precheck-audio.cjs input.wav > precheck.json

# 2. Verificar status
cat precheck.json | grep '"status"'

# 3. Se OK ou WARNING → masterizar
node automaster/automaster-v1.cjs input.wav output.wav -11 -0.8

# 4. Se BLOCKED por True Peak → corrigir e tentar novamente
node automaster/fix-true-peak.cjs input.wav
node automaster/precheck-audio.cjs input_safe.wav
# Agora pode masterizar input_safe.wav
```

## 🔧 Correção de True Peak (Pré-Master)

**Quando usar:** Se `precheck-audio.cjs` retornar BLOCKED por True Peak alto (> -0.1 dBTP).

O `fix-true-peak.cjs` é uma **correção técnica**, NÃO masterização:
- ✅ Aplica APENAS ganho negativo (volume)
- ✅ Target fixo: -1.0 dBTP (seguro para qualquer plataforma)
- ✅ Margem de segurança: +0.2 dB
- ❌ NÃO usa limiter, compressor ou EQ
- ❌ NÃO consome crédito do usuário
- ❌ NÃO promete melhoria sonora

### Filosofia

Este módulo **protege o áudio**, não "melhora" a música:
- Garante que o True Peak esteja em nível seguro
- Permite que o AutoMaster funcione corretamente
- Evita clipping invisível
- É conservador e previsível

### Uso

```bash
node automaster/fix-true-peak.cjs <input.wav>
```

### Saída (JSON Puro)

#### Caso 1: Mix já segura (TP <= -1.0 dBTP)

```json
{
  "status": "OK",
  "message": "True Peak dentro do limite seguro. Nenhuma correção necessária.",
  "input_tp": -1.39,
  "target_tp": -1.0,
  "action": "none"
}
```

Nenhum arquivo gerado. Pode masterizar diretamente.

#### Caso 2: Mix clippando (TP > -1.0 dBTP)

```json
{
  "status": "FIXED",
  "message": "True Peak corrigido com ganho negativo.",
  "input_tp": 0.11,
  "applied_gain_db": -1.31,
  "output_file": "mix_safe.wav",
  "target_tp": -1.0,
  "safety_margin": 0.2,
  "action": "volume_reduction"
}
```

Arquivo gerado: `<input>_safe.wav` → Use este para masterizar.

### Cálculo do Ganho

**Fórmula:**
```
gain_db = -(input_tp - target_tp + safety_margin)
```

**Exemplo real:**
- Input TP: +0.11 dBTP (clippando)
- Target: -1.0 dBTP
- Margem: 0.2 dB
- **Ganho aplicado:** -(0.11 - (-1.0) + 0.2) = **-1.31 dB**

### Workflow Completo

```powershell
# 1. Mix clippando
node automaster\precheck-audio.cjs minha_musica_mix.wav
# → { "status": "BLOCKED", "reason": "True Peak muito alto (0.11 dBTP)" }

# 2. Corrigir True Peak (não consome crédito)
node automaster\fix-true-peak.cjs minha_musica_mix.wav
# → Gera: minha_musica_mix_safe.wav

# 3. Validar correção
node automaster\precheck-audio.cjs minha_musica_mix_safe.wav
# → { "status": "OK", "reason": "Faixa tecnicamente apta" }

# 4. Masterizar com segurança
node automaster\automaster-v1.cjs minha_musica_mix_safe.wav minha_musica_master.wav -11 -0.8
```

### O Que NÃO É

❌ **Não é masterização:** Apenas prepara o áudio  
❌ **Não melhora o som:** Apenas reduz volume uniformemente  
❌ **Não corrige mix ruim:** Apenas evita clipping técnico  
❌ **Não substitui engenheiro:** Ferramenta técnica, não criativa

### Garantias

✅ **Previsível:** Sempre -1.0 dBTP target  
✅ **Seguro:** Margem de +0.2 dB adicional  
✅ **Transparente:** Apenas ganho linear, sem processamento  
✅ **Gratuito:** Não consome crédito de masterização

## �🚀 Como Usar

### Opção 1: Uso CLI (Core Direto)

Para uso direto via terminal com parâmetros técnicos (LUFS + ceiling):

#### Sintaxe

```bash
node automaster-v1.cjs <input.wav> <output.wav> <target-lufs> <ceiling-dbtp>
```

### Parâmetros

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `input.wav` | String | Caminho do arquivo WAV de entrada | `input.wav` |
| `output.wav` | String | Caminho do arquivo WAV de saída | `masterizado.wav` |
| `target-lufs` | Float | LUFS integrado alvo (-18 a -6) | `-11` |
| `ceiling-dbtp` | Float | True Peak máximo (-2.0 a -0.1) | `-0.8` |

### Exemplos

#### 1. Master conservador para streaming

```powershell
node automaster-v1.cjs input.wav output.wav -14 -1.0
```

- Target: -14 LUFS (Spotify, Apple Music)
- Ceiling: -1.0 dBTP (margem de segurança)

#### 2. Master competitivo para funk/trap

```powershell
node automaster-v1.cjs beat.wav beat_master.wav -8 -0.3
```

- Target: -8 LUFS (alto impacto)
- Ceiling: -0.3 dBTP (agressivo mas seguro)

#### 3. Master suave para clássica/jazz

```powershell
node automaster-v1.cjs jazz.wav jazz_master.wav -16 -1.5
```

- Target: -16 LUFS (preserva dinâmica)
- Ceiling: -1.5 dBTP (muito conservador)

## 📊 Saída Esperada

### Sucesso (Two-Pass)

```
═══════════════════════════════════════════════════
  AutoMaster V1 - Núcleo Técnico
  Masterização básica via FFmpeg
═══════════════════════════════════════════════════

📋 Validando parâmetros...
✅ Parâmetros válidos

🔍 Verificando FFmpeg...
✅ FFmpeg encontrado: 6.0

⚙️  Configuração:
   Input:        C:\path\to\input.wav
   Output:       C:\path\to\output.wav
   Target LUFS:  -11 LUFS
   Ceiling:      -0.8 dBTP

🎚️  Iniciando processamento...

┌─────────────────────────────────────────────────┐
│  TWO-PASS LOUDNORM + PÓS-VALIDAÇÃO             │
└─────────────────────────────────────────────────┘

▶ RENDER PRINCIPAL
  Target: -11 LUFS / -0.80 dBTP

  [1/3] Analisando loudness...
        Input I: -16.30 LUFS
        Input TP: -1.20 dBTP

  [2/3] Renderizando (two-pass + limiter)...
        Tempo: 2.45s

  [3/3] Validando resultado...
        Final I: -11.02 LUFS (erro: 0.020 LU)
        Final TP: -0.82 dBTP (-0.020 dB)

  ✅ VALIDAÇÃO PASSOU

═══════════════════════════════════════════════════
✅ PROCESSAMENTO CONCLUÍDO COM SUCESSO
═══════════════════════════════════════════════════
   Tempo:      2.45s
   Output:     C:\path\to\output.wav
   Tamanho:    4521.32 KB

  PRECISÃO:
   Target LUFS:  -11 LUFS
   Final LUFS:   -11.02 LUFS (erro: 0.020 LU)
   Target TP:    -0.80 dBTP
   Used TP:      -0.80 dBTP
   Final TP:     -0.82 dBTP
═══════════════════════════════════════════════════

RESULT_JSON: {"success":true,"targetI":-11,"targetTP":-0.8,...}
```

### Erro (exemplo)

```
❌ ERRO: Arquivo de entrada não encontrado: input.wav
```

## 🔍 Validações

O script garante:

1. ✅ **Parâmetros corretos**: 4 argumentos obrigatórios
2. ✅ **Arquivo existe**: Input WAV deve existir
3. ✅ **Extensões corretas**: Entrada e saída devem ser `.wav`
4. ✅ **LUFS válido**: Entre -18 e -6 LUFS
5. ✅ **Ceiling válido**: Entre -2.0 e -0.1 dBTP
6. ✅ **FFmpeg disponível**: Verifica antes de processar

## 🎚️ Garantias de Qualidade

O áudio masterizado:

- ✅ **LUFS Preciso**: ±0.1 LU do target (validado automaticamente)
- ✅ **True Peak Seguro**: <= ceiling + 0.05 dB (validado + fallback)
- ✅ **Two-Pass**: Precisão superior ao single-pass (análise → render)
- ✅ **Não clipa**: Limitador garante True Peak dentro do ceiling
- ✅ **Fallback automático**: 1 tentativa conservadora se validação falhar
- ✅ **Formato preservado**: WAV 44.1kHz (compatibilidade universal)
- ✅ **Logs estruturados**: JSON parseável com métricas de precisão

## 🧪 Como Testar

### Teste Completo do Pipeline

#### 1. Gerar áudio de teste

```powershell
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 30 test_input.wav
```

#### 2. Executar precheck (obrigatório)

```powershell
node automaster\precheck-audio.cjs test_input.wav
```

Verifique o status retornado. Se `OK` ou `WARNING`, pode prosseguir.

#### 3. Masterizar (core CLI)

```powershell
node automaster\automaster-v1.cjs test_input.wav test_output.wav -11 -0.8
```

#### 4. Verificar resultado

```powershell
ffmpeg -i test_output.wav -af loudnorm=print_format=json -f null -
```

Verifique o campo `input_i` (deve estar próximo de -11).

### Teste do Gate (Cenários BLOCKED)

```powershell
# Gerar áudio de 5s (muito curto) → BLOCKED
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 5 test_short.wav
node automaster\precheck-audio.cjs test_short.wav
# Esperado: "status": "BLOCKED", "reason": "Duração muito curta"

# Gerar áudio com clipping → BLOCKED
ffmpeg -f lavfi -i "sine=frequency=440:duration=30" -af "volume=20dB" test_clip.wav
node automaster\precheck-audio.cjs test_clip.wav
# Esperado: "status": "BLOCKED", "reason": "True Peak muito alto"
```

### Teste do Wrapper (Programático)

Para testar os 3 modos, descomente o bloco de teste no final de `run-automaster.cjs` e execute:

```powershell
node automaster\run-automaster.cjs
```

Isso processará o mesmo input 3 vezes (STREAMING, BALANCED, IMPACT) e gerará 3 outputs diferentes.

### Teste de Precisão (Two-Pass)

**Teste completo de precisão técnica** que valida os 3 modos principais:

```powershell
node automaster\test-precision.cjs
```

Este teste:
1. Gera áudio de teste (sine 440Hz, 30s)
2. Masteriza com STREAMING (-14/-1.0), BALANCED (-11/-0.8), IMPACT (-9/-0.5)
3. Valida cada resultado:
   - LUFS final deve estar ±0.1 LU do target
   - True Peak final deve ser <= ceiling + 0.05 dB
4. Exibe relatório PASS/FAIL para cada modo
5. Limpa arquivos temporários automaticamente

**Saída esperada:**
```
╔═══════════════════════════════════════════════════╗
║  RELATÓRIO FINAL                                  ║
╚═══════════════════════════════════════════════════╝

  STREAMING    ✅ PASS  (3.42s)
    LUFS: ✅  TP: ✅  Fallback: Não

  BALANCED     ✅ PASS  (3.18s)
    LUFS: ✅  TP: ✅  Fallback: Não

  IMPACT       ✅ PASS  (3.25s)
    LUFS: ✅  TP: ✅  Fallback: Não

═══════════════════════════════════════════════════
  RESULTADO GERAL: ✅ TODOS OS TESTES PASSARAM
═══════════════════════════════════════════════════
```

## 🛠️ Troubleshooting

### Erro: "FFmpeg não encontrado"

**Solução**: Instale FFmpeg e adicione ao PATH.

```powershell
# Windows (winget)
winget install FFmpeg

# Ou baixe manualmente de ffmpeg.org e adicione ao PATH
```

### Erro: "Arquivo de entrada não encontrado"

**Solução**: Verifique se o caminho está correto. Use caminhos absolutos se necessário.

```powershell
# Exemplo com caminho absoluto
node automaster-v1.cjs "C:\Users\User\Music\input.wav" output.wav -11 -0.8
```

### Output muito alto ou baixo

**Solução**: Ajuste o target LUFS. Referências:

| Contexto | LUFS Recomendado |
|----------|------------------|
| Spotify, Apple Music | -14 LUFS |
| YouTube | -13 LUFS |
| Soundcloud | -10 a -8 LUFS |
| Funk, Trap, EDM | -9 a -7 LUFS |
| Rock, Pop | -11 a -9 LUFS |
| Jazz, Clássica | -16 a -14 LUFS |

### Processamento muito lento

**Possíveis causas**:
- Arquivo muito grande (>100MB)
- FFmpeg antigo (atualize para 5.0+)
- CPU limitada

**Nota**: Este script usa single-pass. Para arquivos longos (>10min), considerar two-pass no futuro.

## 📁 Estrutura

```
automaster/
├── precheck-audio.cjs     # Gate técnico (valida se pode masterizar)
├── fix-true-peak.cjs      # Correção de TP (pré-master, não consome crédito)
├── automaster-v1.cjs      # Core DSP (two-pass loudnorm + limiter)
├── run-automaster.cjs     # Wrapper de orquestração (modes)
├── test-precision.cjs     # Teste de precisão (valida LUFS/TP)
└── README.md              # Esta documentação
```

**Isolado**: Nenhuma dependência com `/api`, `/lib`, `/work` ou frontend.

### Diferença entre os Arquivos

| Arquivo | Responsabilidade | Quando Usar |
|---------|------------------|-------------|
| `precheck-audio.cjs` | Gate: analisa áudio e retorna OK/WARNING/BLOCKED | **SEMPRE executar ANTES** de masterizar |
| `fix-true-peak.cjs` | **Correção de TP**: aplica ganho negativo se TP > -1.0 dBTP | Se precheck BLOCKED por True Peak alto |
| `automaster-v1.cjs` | Core DSP: two-pass loudnorm + pós-validação + fallback | Após precheck OK/WARNING |
| `run-automaster.cjs` | Wrapper: mapeia MODE → parâmetros, chama o core | Uso programático (API, worker, testes) |
| `test-precision.cjs` | Teste: valida precisão técnica dos 3 modos | Validação de desenvolvimento |

## 🎯 Uso Programático (Wrapper)

Se você quer integrar o AutoMaster em código (API, worker, UI), use o **wrapper**:

```javascript
const { runAutomaster } = require('./automaster/run-automaster.cjs');

// Modo conservador para streaming
await runAutomaster({
  inputPath: 'input.wav',
  outputPath: 'output.wav',
  mode: 'STREAMING'  // -14 LUFS, -1.0 dBTP
});

// Modo equilibrado (padrão)
await runAutomaster({
  inputPath: 'input.wav',
  outputPath: 'output.wav',
  mode: 'BALANCED'  // -11 LUFS, -0.8 dBTP
});

// Modo alto impacto
await runAutomaster({
  inputPath: 'input.wav',
  outputPath: 'output.wav',
  mode: 'IMPACT'  // -9 LUFS, -0.5 dBTP
});
```

### Modos Disponíveis

| Mode | LUFS | Ceiling | Contexto |
|------|------|---------|----------|
| `STREAMING` | -14 | -1.0 dBTP | Spotify, Apple Music, YouTube |
| `BALANCED` | -11 | -0.8 dBTP | Padrão competitivo (rock, pop, hip-hop) |
| `IMPACT` | -9 | -0.5 dBTP | Alto impacto (funk, trap, EDM) |

### Retorno da Função

```javascript
{
  success: true,
  duration: 3.42,         // segundos
  outputPath: "output.wav",
  mode: "BALANCED",
  preset: {
    lufs: -11,
    ceiling: -0.8
  }
}
```

### Tratamento de Erros

```javascript
try {
  await runAutomaster({ inputPath, outputPath, mode: 'BALANCED' });
} catch (error) {
  console.error('Masterização falhou:', error.message);
  // Possíveis erros:
  // - Arquivo não encontrado
  // - Mode inválido
  // - FFmpeg falhou
  // - Core engine não encontrado
}
```

### Integração com Precheck (Recomendado)

```javascript
const { execFile } = require('child_process');
const { runAutomaster } = require('./automaster/run-automaster.cjs');

// 1. Executar precheck
const precheckResult = await new Promise((resolve, reject) => {
  execFile('node', ['automaster/precheck-audio.cjs', inputPath], (err, stdout) => {
    if (err && err.code !== 1) reject(err); // Erro real (não BLOCKED)
    else resolve(JSON.parse(stdout));
  });
});

// 2. Verificar status
if (precheckResult.status === 'BLOCKED') {
  throw new Error(`Áudio bloqueado: ${precheckResult.reason}`);
}

// 3. Log se WARNING
if (precheckResult.status === 'WARNING') {
  console.warn(`⚠️  ${precheckResult.reason}`);
}

// 4. Masterizar
await runAutomaster({ inputPath, outputPath, mode: 'BALANCED' });
```

## 🔜 Próximos Passos (Fora do Escopo V1)

### ✅ Concluído
- [x] Core DSP (loudnorm **TWO-PASS** + limiter)
- [x] Pós-validação automática (LUFS ±0.1 LU, TP +0.05 dB)
- [x] Fallback conservador (1 tentativa com -0.2 dB ceiling)
- [x] Wrapper de modos (STREAMING/BALANCED/IMPACT)
- [x] Gate técnico (precheck com métricas FFmpeg)
- [x] Teste de precisão (valida os 3 modos)
- [x] Validações e logs estruturados
- [x] Uso CLI e programático

### 🚧 Roadmap Futuro

1. **Targets por gênero**: Mapear genre → preset LUFS/TP/LRA (funk, rock, eletrônica)
2. **EQ espectral**: Ajustar bandas para targets de gênero (requer targets calibrados)
3. **Integração com filas**: BullMQ para processar em background
4. **Dashboard de custos**: Tracking de tempo de CPU e storage por render
5. **Histórico de renders**: Armazenar métricas (antes/depois) para análise
6. **Multi-format export**: Suporte a MP3, AAC, FLAC (além de WAV)

## 📄 Licença

Parte do projeto SoundyAI.  
Uso exclusivo para desenvolvimento e testes.

---

**Versão**: 2.0.0  
**Data**: 10 de fevereiro de 2026  
**Branch**: `automasterv1`  
**Status**: ✅ Two-Pass Loudnorm + Pós-Validação + Fallback + Gate Técnico (isolados)

**Precisão Técnica:**  
- LUFS: ±0.1 LU (garantido por validação automática)
- True Peak: <= ceiling + 0.05 dB (com fallback conservador)
- Fallback: 1 tentativa automática (-0.2 dB ceiling) se validação falhar
