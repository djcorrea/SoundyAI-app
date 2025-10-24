# 🎵 Como Adicionar Arquivos de Teste WAV

## ❌ Erro Detectado

Você executou `npm run perf:baseline` mas recebeu o erro:

```
[RUNNER] ❌ Erro fatal: Error: ENOENT: no such file or directory
path: 'C:\Users\DJ Correa\Desktop\Programação\SoundyAI\work\tools\perf\audio-samples\short-30s.wav'
```

**Motivo**: Os 3 arquivos WAV de teste ainda não foram adicionados.

---

## ✅ Solução: Adicionar 3 Arquivos WAV

### **Passo 1: Criar o Diretório**

Execute no PowerShell:

```powershell
cd "C:\Users\DJ Correa\Desktop\Programação\SoundyAI\work\tools\perf"
mkdir audio-samples
```

### **Passo 2: Adicionar os Arquivos**

Copie **3 arquivos WAV** para o diretório `audio-samples/`:

| Arquivo | Duração | Gênero | Descrição |
|---------|---------|--------|-----------|
| `short-30s.wav` | ~30 segundos | EDM/Dance | Teste rápido, ideal para iterações |
| `medium-3min.wav` | ~3 minutos | Pop/Rock | Teste médio, análise completa |
| `long-5min.wav` | ~5 minutos | Ambient/Electronic | Teste de estresse, máxima cobertura |

**Requisitos dos arquivos:**
- Formato: `.wav` (PCM, 16-bit ou 24-bit)
- Sample Rate: **48000 Hz** (preferencial) ou 44100 Hz
- Canais: **Stereo** (2 canais)
- Qualidade: Arquivos profissionais ou semi-profissionais (não MP3 convertido)

---

## 📂 Estrutura Final Esperada

```
work/tools/perf/
├── audio-samples/
│   ├── short-30s.wav      ← ADICIONAR
│   ├── medium-3min.wav    ← ADICIONAR
│   └── long-5min.wav      ← ADICIONAR
├── bench.config.json
├── runner.js
├── instrumentation.js
└── ...
```

---

## 🎯 Onde Encontrar Arquivos de Teste?

### **Opção 1: Usar Arquivos Próprios**
- Use suas próprias produções musicais
- Garanta que são arquivos `.wav` em alta qualidade
- Renomeie para os nomes esperados

### **Opção 2: Bibliotecas de Audio Livre**
- **Freesound.org**: https://freesound.org/ (Creative Commons)
- **Free Music Archive**: https://freemusicarchive.org/
- **ccMixter**: https://ccmixter.org/

**Dica de busca**: Procure por "stems", "multitrack", ou "production music"

### **Opção 3: Criar Arquivos de Teste**
Use qualquer DAW (Ableton, FL Studio, Logic Pro) para exportar:
- 30s: Intro + Drop (EDM)
- 3min: Música completa (Pop/Rock)
- 5min: Mix longo (Ambient)

---

## 🚀 Próximos Passos (Após Adicionar os Arquivos)

### **1. Verificar Arquivos**

```powershell
cd "C:\Users\DJ Correa\Desktop\Programação\SoundyAI\work\tools\perf"
dir audio-samples
```

**Saída esperada**:
```
short-30s.wav
medium-3min.wav
long-5min.wav
```

### **2. Rodar Baseline Novamente**

```powershell
cd "C:\Users\DJ Correa\Desktop\Programação\SoundyAI\work"
npm run perf:baseline
```

**Duração estimada**: ~7-10 minutos (3 repetições × ~2-3 min cada)

### **3. Analisar Resultados**

Os resultados estarão em:
```
work/tools/perf/results/baseline-YYYY-MM-DD_HH-mm-ss/
├── summary.md         ← LER PRIMEIRO
├── results.json       ← Dados brutos
└── results.csv        ← Planilha (opcional)
```

**Abrir resumo**:
```powershell
notepad results\baseline-*\summary.md
```

---

## 📊 O Que Esperar no `summary.md`

```markdown
# Performance Benchmark - baseline

## Resultados Gerais

| Métrica | short-30s | medium-3min | long-5min |
|---------|-----------|-------------|-----------|
| Tempo Total | 45234 ms | 148765 ms | 253421 ms |
| LUFS | -15.2 LUFS | -14.8 LUFS | -16.1 LUFS |
| True Peak | -0.5 dBTP | -1.2 dBTP | -0.8 dBTP |

## Breakdown de Fases

| Fase | Tempo (ms) | % Total |
|------|-----------|---------|
| DECODE | 2456 | 1.6% |
| SEGMENTATION | 5234 | 3.5% |
| FFT_PROCESSING | 21234 | 14.3% |
| SPECTRAL_BANDS | 32456 | 21.8% | ← GARGALO #2
| LUFS_CALCULATION | 16234 | 10.9% |
| TRUE_PEAK | 8234 | 5.5% |
| BPM_METHOD_A | 26234 | 17.6% | ← GARGALO #1
| BPM_METHOD_B | 19876 | 13.4% | ← GARGALO #1
| ...
```

---

## ❓ Problemas Comuns

### **Erro: "Invalid WAV file"**
- Verifique se o arquivo é `.wav` PCM válido
- Reconverta com Audacity: File → Export → WAV (Microsoft) 16-bit PCM

### **Erro: "Sample rate mismatch"**
- Sistema espera 48000 Hz
- Converta com Audacity: Tracks → Resample → 48000 Hz

### **Erro: "File too large"**
- Arquivo `long-5min.wav` deve ser < 200 MB
- Se necessário, use compressão menor (16-bit em vez de 24-bit)

---

## 🎉 Sucesso!

Quando você ver isso:

```
[RUNNER] ✅ Benchmark baseline concluído com sucesso
[RUNNER] Resultados salvos em: results/baseline-2025-10-23_14-30-45/
[RUNNER] 📊 Veja o resumo em: summary.md
```

**Você está pronto para:**
1. Analisar gargalos (veja `summary.md`)
2. Instrumentar código de produção (veja `INSTRUMENTATION_EXAMPLE.js`)
3. Implementar otimizações (veja `QUICK_START.md`)
4. Criar PRs com provas de paridade (veja `PR_TEMPLATE.md`)

---

**Data**: 23 de outubro de 2025  
**Status**: ⚠️ Aguardando arquivos WAV de teste  
**Próxima ação**: Adicionar 3 arquivos WAV e rodar `npm run perf:baseline`
