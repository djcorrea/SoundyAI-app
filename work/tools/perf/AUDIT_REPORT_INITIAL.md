# 🔍 AUDITORIA PRELIMINAR DE PERFORMANCE - Pipeline de Áudio SoundyAI

**Data**: 23 de outubro de 2025  
**Versão**: 1.0.0  
**Status**: Infraestrutura Completa - Pronto para Medições

---

## 📊 SITUAÇÃO ATUAL

### Tempo Total Reportado
- **~150 segundos (2min30s)** por análise completa
- **Meta**: ≤ 60-75s (redução de 50-60%)

### Pipeline Identificado

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DECODE (Fase 5.1)                                       │
│    ├─ WAV decoder (music-metadata ou custom)               │
│    └─ Resample para 48kHz se necessário                    │
├─────────────────────────────────────────────────────────────┤
│ 2. SEGMENTATION (Fase 5.2)                                 │
│    ├─ Criar frames FFT (4096 samples, hop 1024)            │
│    ├─ Criar frames RMS (400ms blocks)                      │
│    └─ Janelamento Hann                                     │
├─────────────────────────────────────────────────────────────┤
│ 3. CORE METRICS (Fase 5.3)                                 │
│    ├─ Normalização LUFS (-23 LU)                           │
│    ├─ FFT Processing (FastFFT ou fft-js)                   │
│    ├─ Spectral Bands (7 bandas: Sub/Bass/Low-Mid/...)      │
│    ├─ Spectral Centroid (Hz)                               │
│    ├─ LUFS ITU-R BS.1770-4                                 │
│    │   ├─ K-weighting filter                               │
│    │   ├─ Block loudness (400ms)                           │
│    │   ├─ Gating (absolute + relative)                     │
│    │   └─ Integrated loudness + LRA                        │
│    ├─ True Peak FFmpeg (4x oversampling, ebur128)          │
│    ├─ Stereo Metrics (correlation, width)                  │
│    ├─ Dynamics (DR, Crest Factor)                          │
│    ├─ BPM Detection                                        │
│    │   ├─ Método A: Advanced Onset Detection               │
│    │   └─ Método B: Autocorrelação                         │
│    └─ DC Offset / Dominant Freqs / Spectral Uniformity     │
├─────────────────────────────────────────────────────────────┤
│ 4. JSON OUTPUT (Fase 5.4)                                  │
│    ├─ Scoring adaptativo por gênero                        │
│    ├─ Análise de problemas e sugestões V2                  │
│    └─ Serialização final                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 SUSPEITAS DE GARGALO (Hipóteses)

### H1: BPM em Duplicidade (>25% do tempo)
**Evidência**:
- Dois métodos rodando sequencialmente (music-tempo + autocorrelação)
- Cada método processa todo o áudio (~5min = 14.4M samples @ 48kHz)
- Cross-validation adicional

**Teste**: Experimentos `no-bpm`, `bpm-a-only`, `bpm-b-only`, `bpm-conditional`

### H2: Bandas Espectrais (alocações excessivas)
**Evidência**:
- Loop sobre todos os frames FFT (~1000+ frames para 5min)
- Cálculo de 7 bandas por frame
- Possível criação de arrays temporários em cada iteração

**Teste**: Experimento `bands-impl-opt` com vetorização

### H3: FFT Plan Recreation (>20% na parte espectral)
**Evidência**:
- FastFFT pode estar recriando planos a cada frame
- fft-js (se usado) pode não estar cacheando transformadas

**Teste**: Experimento `fft-opt` com reuso de planos

### H4: Decode/Resample Repetido
**Evidência**:
- Pipeline pode estar decodificando múltiplas vezes
- Normalização pode criar cópia extra do áudio

**Teste**: Experimento `decode-cache` com SharedArrayBuffer

### H5: Processamento Síncrono (ociosidade de CPU)
**Evidência**:
- LUFS, True Peak e Bandas podem rodar em paralelo
- Código atual parece sequencial (await após await)

**Teste**: Experimento `parallel` com worker pool

---

## 📏 TOLERÂNCIAS DE PARIDADE

| Métrica | Tolerância | Justificativa |
|---------|-----------|--------------|
| **LUFS Integrated** | ±0.10 LU | ITU-R BS.1770-4 precision |
| **True Peak** | ±0.10 dBTP | EBU R128 compliance |
| **RMS / DR / Crest** | ±0.20 dB | Acceptable dynamic range variance |
| **LRA** | ±0.20 LU | Loudness range tolerance |
| **Spectral Bands** | ±0.5 pp | Per-band percentage points |
| **BPM** | ±0.5 BPM | Tempo detection accuracy |
| **Stereo Correlation** | ±0.02 | Phase coherence precision |

---

## 🎯 PLANO DE EXPERIMENTOS

### Fase 1: Baseline e Sanidade
1. **Baseline** (3x repetições)
   - Tudo ativo, capturar tempo total e breakdown por fase
   
2. **No-BPM** (3x repetições)
   - Desativar BPM completamente
   - **Esperado**: Redução de 30-40% se H1 for verdade

### Fase 2: BPM Isolado
3. **BPM-A-only** (3x repetições)
   - Apenas método A (advanced onset)
   
4. **BPM-B-only** (3x repetições)
   - Apenas método B (autocorrelação)
   
5. **BPM-Conditional** (3x repetições)
   - Método B só roda se confiança A < 0.5
   - **Esperado**: Tempo entre A-only e A+B, com robustez mantida

### Fase 3: Otimizações Implementadas
6. **Bands-Impl-Opt** (3x repetições)
   - Vetorizar loops com Float32Array
   - Reuso de buffers (object pool)
   - Pré-cálculo de bins e tabelas
   
7. **FFT-Opt** (3x repetições)
   - Cache de planos FFT (se aplicável)
   - Minimizar alocações no loop
   - Transferable para workers (se usar)

8. **Decode-Cache** (3x repetições)
   - Decodificar uma vez, broadcast via SharedArrayBuffer
   - Evitar cópias desnecessárias

9. **Parallel** (3x repetições)
   - Worker pool = (CPUs físicos - 1)
   - LUFS, True Peak, Bandas em Promise.all()

---

## 🛠️ INFRAESTRUTURA ENTREGUE

### Arquivos Criados

```
work/tools/perf/
├── bench.config.json           ✅ Configuração completa
├── runner.js                   ✅ Executor de experimentos
├── instrumentation.js          ✅ Sistema de medição hrtime
├── verify-parity.js            ✅ Validador de tolerâncias
├── INSTRUMENTATION_EXAMPLE.js  ✅ Guia de instrumentação
├── README.md                   ✅ Documentação completa
├── audio-samples/              ⚠️ (adicionar WAVs manualmente)
└── results/                    📁 (gerado automaticamente)
```

### Scripts NPM Adicionados

```json
{
  "perf:baseline": "node --expose-gc tools/perf/runner.js --label baseline",
  "perf:exp": "node --expose-gc tools/perf/runner.js",
  "perf:parity": "node tools/perf/verify-parity.js",
  "perf:stress": "node --expose-gc tools/perf/runner.js --label baseline"
}
```

### Recursos

- **Medição**: `process.hrtime.bigint()` com precisão de nanosegundos
- **CPU**: `process.cpuUsage()` para user/system time
- **Memória**: RSS, heap usado, heap total
- **Hierarquia**: Fases aninhadas com `withPhase()`
- **Metadados**: Contexto customizado por medição
- **Agregação**: Estatísticas automáticas (média, p95, p99, stddev)

---

## 📋 PRÓXIMOS PASSOS

### 1. Adicionar Arquivos de Teste (Manual)
```powershell
# Copiar 3 WAVs para:
work/tools/perf/audio-samples/short-30s.wav
work/tools/perf/audio-samples/medium-3min.wav
work/tools/perf/audio-samples/long-5min.wav
```

### 2. Rodar Baseline
```powershell
cd work
npm run perf:baseline
```

### 3. Analisar Resultados
- Abrir `results/YYYY-MM-DD_HH-mm-ss/summary.md`
- Identificar top 3 gargalos
- Validar hipóteses H1-H5

### 4. Implementar Instrumentação no Código
- Usar exemplos de `INSTRUMENTATION_EXAMPLE.js`
- Adicionar `withPhase()` nas fases principais
- Adicionar `measureAsync()` em subfases críticas

### 5. Implementar Otimizações
- Criar branch `perf/otimizacao-<nome>`
- Implementar otimização específica
- Rodar experimento correspondente
- Validar paridade com `npm run perf:parity`

### 6. Documentar e Criar PRs
- Changelog com ganho em ms
- Prova de paridade (PASS)
- Impacto no tempo total
- Trade-offs e decisões

---

## 🎯 CRITÉRIOS DE SUCESSO

### Performance
- ✅ Redução de tempo total para ≤ 60-75s
- ✅ Breakdown detalhado por fase (ms)
- ✅ Identificação de top 3 gargalos
- ✅ Estimativa de ganho por otimização

### Paridade
- ✅ Todas as métricas dentro de tolerâncias
- ✅ LUFS: ±0.10 LU
- ✅ True Peak: ±0.10 dBTP
- ✅ Bandas: ±0.5 pp
- ✅ BPM: ±0.5 BPM

### Documentação
- ✅ Relatórios reprodutíveis (JSON + MD + CSV)
- ✅ PRs com changelog e provas
- ✅ Branches separados por otimização
- ✅ README.md com instruções

---

## 🚨 AVISOS IMPORTANTES

### Não Fazer
- ❌ Reduzir resolução espectral (FFT size, bandas)
- ❌ Remover features sem justificativa
- ❌ Alterar precisão de LUFS/True Peak
- ❌ Quebrar compatibilidade com API pública

### Permitido
- ✅ Paralelização segura
- ✅ Cache de decode/resample
- ✅ Reuso de buffers e planos FFT
- ✅ Vetorização de loops
- ✅ Zero-copy com Transferable/SAB
- ✅ BPM condicional (método B só se necessário)

---

## 📊 RELATÓRIOS ESPERADOS

### summary.md (Exemplo)

```markdown
| Experimento     | Média (ms) | P95 (ms) | Redução vs Baseline |
|-----------------|-----------|---------|---------------------|
| baseline        | 150000    | 155000  | -                   |
| no-bpm          | 105000    | 108000  | -30% (45s)          |
| bpm-a-only      | 125000    | 128000  | -16.7% (25s)        |
| bpm-conditional | 130000    | 133000  | -13.3% (20s)        |
| bands-impl-opt  | 140000    | 143000  | -6.7% (10s)         |
| fft-opt         | 145000    | 148000  | -3.3% (5s)          |
| decode-cache    | 148000    | 151000  | -1.3% (2s)          |
| parallel        | 120000    | 123000  | -20% (30s)          |
```

### Breakdown Detalhado (Exemplo)

```markdown
| Fase                | Baseline (ms) | Otimizado (ms) | Ganho (ms) |
|---------------------|--------------|----------------|-----------|
| Decode              | 2000         | 2000           | 0         |
| Segmentation        | 5000         | 5000           | 0         |
| FFT Processing      | 20000        | 15000          | 5000      |
| Spectral Bands      | 30000        | 20000          | 10000     |
| LUFS                | 15000        | 15000          | 0         |
| True Peak           | 8000         | 8000           | 0         |
| BPM Method A        | 25000        | 25000          | 0         |
| BPM Method B        | 20000        | 0 (skip)       | 20000     |
| Cross-validation    | 5000         | 3000           | 2000      |
| Aggregation         | 3000         | 3000           | 0         |
| **TOTAL**           | **150000**   | **113000**     | **37000** |
```

---

## ✅ STATUS FINAL

### Infraestrutura: COMPLETA ✅
- Todos os arquivos criados
- Scripts npm configurados
- Documentação completa
- Exemplos de código prontos

### Próxima Ação: ADICIONAR ÁUDIOS DE TESTE
```powershell
# Manualmente copiar 3 arquivos WAV para:
work/tools/perf/audio-samples/
```

### Após Áudios: RODAR BASELINE
```powershell
cd work
npm run perf:baseline
```

---

**Revisores**: Equipe SoundyAI  
**Contato**: GitHub Issues ou PR no repo soundyai-app  
**Versão do Node.js**: 18+ requerido  
**Ambiente**: Windows PowerShell
