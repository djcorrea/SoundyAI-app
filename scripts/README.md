# 🔊 LUFS Normalization + References Rebuild

Sistema de normalização por loudness LUFS com ganho estático e recálculo de referências para o banco de dados de áudio.

## 📋 Características

- **Normalização LUFS**: EBU R128 com gating integrado
- **Ganho estático**: Sem compressor/limiter, apenas multiplicação linear
- **True Peak control**: Oversampling 4× com teto configurável
- **Análise espectral**: Recálculo de métricas por banda após normalização
- **Backup automático**: Preserva JSONs originais
- **Modo DRY-RUN**: Preview seguro sem modificar arquivos
- **Compatibilidade**: Mantém schema existente dos JSONs

## 🚀 Instalação

```bash
# Navegar para o diretório do projeto
cd ai-synth

# O script usa apenas módulos Node.js nativos
# Módulos especializados já incluídos em ./scripts/
```

## 📖 Uso

### Comandos básicos

```bash
# DRY-RUN (preview apenas, recomendado primeiro)
node scripts/refs-normalize-and-rebuild.js --dry-run

# Aplicar normalização com configurações padrão
node scripts/refs-normalize-and-rebuild.js

# Configuração customizada
node scripts/refs-normalize-and-rebuild.js \
  --in REFs \
  --out public/refs/out \
  --lufs -16 \
  --tp -0.5 \
  --refsVer v2_lufs_norm_custom
```

### Opções disponíveis

| Opção | Descrição | Padrão |
|-------|-----------|---------|
| `--in <dir>` | Diretório com WAVs por gênero | `REFs` |
| `--out <dir>` | Diretório de saída dos JSONs | `public/refs/out` |
| `--lufs <valor>` | LUFS target para normalização | `-18.0` |
| `--tp <valor>` | True Peak ceiling (dBTP) | `-1.0` |
| `--refsVer <ver>` | Versão das referências | `v2_lufs_norm` |
| `--dry-run` | Apenas preview, não modifica arquivos | `false` |
| `--verbose` | Log detalhado (DEBUG) | `false` |
| `--help` | Mostrar ajuda | - |

## 🎛️ Configuração técnica

### Parâmetros de normalização

- **LUFS Target**: `-18.0 LUFS` (padrão de análise profissional)
- **True Peak Ceiling**: `-1.0 dBTP` (EBU R128 compliant)
- **Gating**: Absoluto (-70 LUFS) + Relativo (-10 LU)
- **Oversampling**: 4× para detecção True Peak
- **DC Removal**: Automático se offset > 0.001

### Estrutura de entrada esperada

```
REFs/
├── funk_mandela/
│   ├── track1.wav
│   ├── track2.wav
│   └── ...
├── eletronico/
│   ├── track1.wav
│   └── ...
├── funk_bruxaria/
└── trance/
```

### Estrutura de saída

```
public/refs/out/
├── funk_mandela.json          # Atualizado
├── funk_mandela.json.backup.* # Backup automático
├── eletronico.json            # Atualizado
├── eletronico.json.backup.*   # Backup automático
└── ...

# Em modo DRY-RUN:
├── funk_mandela.preview.json  # Preview sem aplicar
├── eletronico.preview.json
└── ...
```

## 📊 Relatório de saída

O script gera relatório detalhado incluindo:

- **Por faixa**: LUFS in/out, True Peak in/out, ganho aplicado
- **Por gênero**: Métricas médias, soma de energia espectral
- **Diferenças**: Comparação com valores anteriores
- **Validações**: Conformidade EBU R128, energia espectral

### Exemplo de log por faixa

```
[INFO] Faixa processada: track.wav {
  genre: 'funk_mandela',
  lufs_in: '-8.2',
  tp_in: '-0.3',
  gain_db_aplicado: '-9.8',
  lufs_out: '-18.0',
  tp_out: '-1.0'
}
```

## 🔧 Critérios de validação

### Automáticos

- ✅ LUFS final ≈ target ± 0.5 dB
- ✅ True Peak final ≤ ceiling
- ✅ Soma energia espectral = 100.00% ± 0.1%
- ✅ Schema JSON preservado

### Manuais (verificar após execução)

- 🔍 UI e scoring funcionam normalmente
- 🔍 Referências alteraram conforme esperado
- 🔍 Backup criado corretamente

## 🛡️ Segurança e rollback

### Backups automáticos

```bash
# Backups criados automaticamente:
funk_mandela.json.backup.1703847123456
eletronico.json.backup.1703847123457
# ...
```

### Rollback manual

```bash
# Para reverter um gênero específico:
cp public/refs/out/funk_mandela.json.backup.* public/refs/out/funk_mandela.json

# Para reverter tudo (substituir timestamp):
for file in public/refs/out/*.backup.1703847123456; do
  original=$(echo $file | sed 's/.backup.*//')
  cp "$file" "$original"
done
```

### Feature flag de rollback

Se implementado no sistema, adicionar:

```javascript
// Em algum config do sistema
NORMALIZE_FOR_ANALYSIS = 0  // Desativa normalização, volta ao comportamento anterior
```

## 🧪 Testes recomendados

### Antes da produção

```bash
# 1. DRY-RUN para verificar mudanças
node scripts/refs-normalize-and-rebuild.js --dry-run

# 2. Aplicar em ambiente de teste
node scripts/refs-normalize-and-rebuild.js

# 3. Verificar funcionamento da UI
# Abrir aplicação e testar análise de uma faixa de cada gênero

# 4. Verificar métricas no console
# Comparar scores antes/depois da mudança
```

### Casos de teste técnicos

- **Volume baixo**: Faixa -30 LUFS → deve normalizar para -18 LUFS
- **Volume alto**: Faixa -8 LUFS → deve reduzir para -18 LUFS
- **True Peak limite**: Faixa que excederia -1 dBTP → ganho deve ser reduzido
- **Heterogeneidade**: Gênero com faixas -12 a -24 LUFS → médias devem mudar significativamente

## 🐛 Troubleshooting

### Erros comuns

**"Arquivo não é WAV válido"**
- Verificar se arquivo não está corrompido
- Confirmar formato PCM/IEEE_FLOAT
- Tentar converter com `ffmpeg -i input.mp3 -c:a pcm_s24le output.wav`

**"Chunk data não encontrado"**
- Arquivo WAV malformado
- Tentar recodificar

**"Erro ao salvar JSON"**
- Verificar permissões do diretório de saída
- Confirmar espaço em disco

**"Falha nos módulos externos"**
- Script automaticamente faz fallback para implementação interna
- Funcionalidade reduzida mas operacional

### Debug detalhado

```bash
# Ativar logs verbosos
node scripts/refs-normalize-and-rebuild.js --verbose --dry-run

# Verificar módulos disponíveis
ls lib/audio/features/
```

## 🏗️ Arquitetura técnica

### Componentes principais

1. **WAVDecoder**: Decodificação PCM 16/24/32-bit + IEEE Float
2. **LoudnessAnalyzer**: LUFS/LRA com K-weighting e gating
3. **LUFSNormalizer**: Ganho estático com True Peak control
4. **SpectralMetricsCalculator**: Análise por bandas espectrais
5. **JSONManager**: Schema preservation + backup

### Hierarquia de implementações

```
Módulos existentes (lib/audio/features/)
├── loudness.js      → [PREFERENCIAL]
├── truepeak.js      → [PREFERENCIAL]
└── dynamics.js      → [PREFERENCIAL]

Utilitários especializados (scripts/)
├── loudness-utils.js → [FALLBACK 1]
├── spectral-utils.js → [FALLBACK 1]
└── [implementação interna] → [FALLBACK 2]
```

### Compatibilidade

- ✅ **Node.js**: 14+ (módulos nativos apenas)
- ✅ **WAV formats**: PCM 16/24/32-bit, IEEE Float 32-bit
- ✅ **Sample rates**: 44.1kHz, 48kHz, 96kHz
- ✅ **Channels**: Mono (duplicado), Stereo
- ✅ **Schema**: Compatível com sistema existente

## 📈 Resultados esperados

### Antes da normalização
```json
{
  "funk_mandela": {
    "lufs_target": -8.2,  // Heterogêneo
    "bands": {
      "sub": { "target_db": -7.2 },
      // ... valores variados por loudness inconsistente
    }
  }
}
```

### Após normalização
```json
{
  "funk_mandela": {
    "version": "v2_lufs_norm",
    "lufs_target": -18.0,  // Consistente
    "normalization_info": {
      "lufs_target": -18.0,
      "true_peak_ceiling": -1.0,
      "algorithm": "static_gain_ebu_r128"
    },
    "bands": {
      "sub": { "target_db": -15.8 },  // Recalculado após normalização
      // ... valores consistentes
    }
  }
}
```

## 📄 Licença

Parte do sistema ai-synth. Uso interno.
