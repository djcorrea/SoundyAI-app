# 🔬 Performance Auditing Tools

Sistema completo de auditoria de performance para o pipeline de processamento de áudio do SoundyAI.

## 📁 Estrutura

```
work/tools/perf/
├── bench.config.json         # Configuração de benchmarks
├── runner.js                 # Executor de experimentos
├── instrumentation.js        # Sistema de medição (hrtime)
├── verify-parity.js          # Validador de paridade de métricas
├── audio-samples/            # Arquivos de teste (adicionar manualmente)
│   ├── short-30s.wav
│   ├── medium-3min.wav
│   └── long-5min.wav
└── results/                  # Resultados dos benchmarks (gerado)
    └── YYYY-MM-DD_HH-mm-ss/
        ├── results.json
        ├── summary.md
        └── results.csv
```

## 🚀 Como Usar

### 1. Preparar Arquivos de Teste

Adicione 3 arquivos WAV na pasta `audio-samples/`:
- **short-30s.wav**: ~30 segundos (EDM/Dance)
- **medium-3min.wav**: ~3 minutos (Pop/Rock)
- **long-5min.wav**: ~5 minutos (Ambient/Chill)

### 2. Rodar Baseline

```powershell
# Com 3 repetições (padrão)
npm run perf:baseline

# Com 10 repetições (modo estresse)
node work/tools/perf/runner.js --config work/tools/perf/bench.config.json --label baseline
```

### 3. Rodar Experimento Específico

```powershell
# Experimento sem BPM
npm run perf:exp -- --experiment=no-bpm

# Experimento BPM A-only
npm run perf:exp -- --experiment=bpm-a-only

# Experimento com arquivo específico
npm run perf:exp -- --experiment=baseline --test-file=short
```

### 4. Verificar Paridade

Após rodar baseline e um experimento otimizado:

```powershell
npm run perf:parity work/tools/perf/results/baseline/results.json work/tools/perf/results/bands-impl-opt/results.json
```

## 📊 Experimentos Disponíveis

### A. Baseline
- **Descrição**: Configuração atual com todos os processamentos ativos
- **Uso**: Estabelecer linha de base de performance

### B. Sem BPM
- **Descrição**: Desativar completamente análise de BPM
- **Objetivo**: Medir impacto do BPM no tempo total

### C. BPM A-only / BPM B-only
- **Descrição**: Rodar apenas um dos métodos de BPM
- **Objetivo**: Comparar precisão e tempo de cada método

### D. BPM Condicional
- **Descrição**: Método B só roda se confiança do A < 0.5
- **Objetivo**: Otimizar BPM mantendo robustez

### E. Bandas Otimizadas (impl)
- **Descrição**: Vetorização, reuso de buffers, pré-cálculo
- **Objetivo**: Reduzir tempo de cálculo das bandas espectrais

### F. FFT Otimizado
- **Descrição**: Reuso de planos FFT, minimizar alocações
- **Objetivo**: Acelerar transformadas de Fourier

### G. Decode Cache
- **Descrição**: Cache de decodificação + SharedArrayBuffer
- **Objetivo**: Eliminar decodificações redundantes

### H. Paralelização
- **Descrição**: Worker pool + LUFS/TP/Bandas em paralelo
- **Objetivo**: Usar múltiplos cores eficientemente

## 🎯 Tolerâncias de Paridade

Limites máximos de variação aceitável após otimizações:

| Métrica | Tolerância |
|---------|-----------|
| LUFS Integrated | ±0.10 LU |
| True Peak | ±0.10 dBTP |
| RMS / DR / Crest | ±0.20 dB |
| Bandas Espectrais | ±0.5 pp |
| BPM | ±0.5 BPM |
| Spectral Centroid | ±50 Hz |
| Stereo Correlation | ±0.02 |

## 📈 Interpretar Resultados

### summary.md

Tabela comparativa de todos os experimentos:

```markdown
| Experimento | Média (ms) | P95 (ms) | P99 (ms) |
|-------------|-----------|---------|---------|
| baseline    | 150000    | 155000  | 158000  |
| no-bpm      | 120000    | 123000  | 125000  |
| ...         | ...       | ...     | ...     |
```

### results.json

Estrutura completa:
- `experiments[].runs[]`: cada execução individual
- `experiments[].stats`: estatísticas agregadas (média, p95, p99)
- `experiments[].runs[].measurements`: medições granulares de cada fase

### Medições Granulares

O sistema mede automaticamente:
- **Decode**: decodificação do WAV
- **Segmentation**: segmentação temporal (FFT/RMS frames)
- **FFT**: transformadas de Fourier
- **Spectral Bands**: cálculo das 7 bandas
- **LUFS**: loudness ITU-R BS.1770-4
- **True Peak**: true peak 4x oversampling (FFmpeg)
- **BPM**: métodos A e B (se habilitados)
- **Stereo**: correlação e width
- **Aggregation**: consolidação final

## 🔧 Configuração Avançada

### Forçar GC entre runs

```powershell
node --expose-gc work/tools/perf/runner.js --config work/tools/perf/bench.config.json
```

### Worker Pool (CPU cores)

Editar `bench.config.json`:

```json
{
  "pipelineFlags": {
    "workerPool": -1  // -1 = auto (CPUs físicos - 1), 0 = sem pool, N = fixo
  }
}
```

### Repetições de estresse

```json
{
  "benchmarkConfig": {
    "repetitions": 10  // Aumentar para análise estatística robusta
  }
}
```

## 📋 Checklist de Auditoria

- [ ] Baseline executado (3+ repetições)
- [ ] Experimento "no-bpm" executado
- [ ] Experimentos BPM A/B executados
- [ ] Paridade validada para cada otimização (PASS)
- [ ] Gargalos identificados (top 3)
- [ ] Otimizações implementadas com código instrumentado
- [ ] Branches criados: `perf/auditoria-instrumentacao`, `perf/otimizacao-*`
- [ ] PRs documentados com changelog de ms e provas de paridade

## 🎯 Meta de Performance

**Objetivo**: Reduzir tempo total de ~150s (2min30s) para **≤ 60-75s** sem quebrar paridade.

## 🐛 Troubleshooting

### "GC não disponível"
Use flag `--expose-gc` ao rodar node.

### "Arquivo de áudio não encontrado"
Certifique-se de adicionar os WAVs em `audio-samples/`.

### "Paridade FAIL"
Revise a implementação da otimização. Tolerâncias são rígidas por design.

### Timeout em arquivos longos
Aumente `timeoutMs` em `bench.config.json`.

## 📚 Referências

- ITU-R BS.1770-4: Loudness e True Peak
- EBU R128: Broadcasting loudness
- ISO 532-1: Psychoacoustic loudness
- AES17: Digital audio measurement

---

**Versão**: 1.0.0  
**Última atualização**: 23 de outubro de 2025  
**Compatibilidade**: Node.js 18+, Windows PowerShell
