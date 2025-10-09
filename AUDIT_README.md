# 🔍 Auditoria do Pipeline de Áudio - SoundyAI

## 📋 Visão Geral

Este sistema de auditoria foi criado para **validar matematicamente 100% do pipeline de análise de áudio** do SoundyAI, garantindo conformidade com normas internacionais:

- **ITU-R BS.1770-4** (LUFS)
- **EBU Tech 3341** (True Peak)
- **Equal Weight V3** (Sistema de Scoring)
- **FFT Analysis** (Bandas Espectrais)

## 🚀 Execução Rápida

### Opção 1: Interface Web (Recomendado)
```bash
# Servir o projeto
npm run audit:serve

# Abrir no navegador
http://localhost:3000/audit-pipeline.html
```

### Opção 2: Linha de Comando
```bash
# Script direto
npm run audit:audio
```

### Opção 3: Console JavaScript
```javascript
// No DevTools:
import { runAudioAudit } from './__tests__/audio/audit.js';
const result = await runAudioAudit();
```

## 🧪 Suites de Teste

### 1. LUFS Test Suite (`__tests__/audio/lufs.test.js`)
- ✅ **K-weighting filters** (ITU-R BS.1770-4 coefficients)
- ✅ **Dual gating system** (absolute -70 LUFS, relative -10 LU)
- ✅ **Pink noise validation** (-20dBFS → -20 ±0.5 LUFS)
- ✅ **Sine wave validation** (1kHz -18dBFS → -18 ±0.5 LUFS)
- ✅ **Integration time accuracy** (block 400ms)

### 2. True Peak Test Suite (`__tests__/audio/truepeak.test.js`)
- ✅ **4x linear interpolation** (EBU Tech 3341)
- ✅ **Intersample peak detection** (997Hz critical frequency)
- ✅ **Oversampling accuracy** (against analytical solutions)
- ✅ **Critical frequency testing** (20Hz-20kHz sweep)

### 3. Spectral Bands Test Suite (`__tests__/audio/bands.test.js`)
- ✅ **FFT parameters** (4096-point, Hann window, 75% overlap)
- ✅ **Band isolation** (≥15dB separation requirement)
- ✅ **Frequency accuracy** (targeted sine wave testing)
- ✅ **Cross-contamination measurement**

### 4. Scoring Test Suite (`__tests__/audio/scoring.test.js`)
- ✅ **Equal Weight V3 validation**
- ✅ **Level-matching accuracy** (spectral bands only)
- ✅ **Sweet spot verification** (0-4dB = 10.0 score)
- ✅ **Improvement tracking** (baseline vs current)
- ✅ **Democratic scoring** (all metrics equal weight)

### 5. Edge Cases Test Suite (`__tests__/audio/edgecases.test.js`)
- ✅ **Silence handling** (LUFS: -∞, gated out)
- ✅ **Clipping detection** (>0dBFS handling)
- ✅ **NaN/Infinity robustness**
- ✅ **Corrupted data resilience**
- ✅ **Zero-length buffer handling**

### 6. Signal Generators (`__tests__/audio/generators.js`)
- ✅ **Pink noise generator** (ITU-R BS.468-4 compliant)
- ✅ **Sine wave generator** (any frequency/amplitude)
- ✅ **Frequency sweep generator** (logarithmic/linear)
- ✅ **EBU conformance signals** (997Hz intersample)

## 📊 Configuração de Tolerâncias

| Métrica | Tolerância | Justificativa |
|---------|------------|---------------|
| LUFS | ±0.5 LU | ITU-R BS.1770-4 measurement uncertainty |
| True Peak | ±0.1 dB | EBU Tech 3341 recommended precision |
| Band Isolation | ≥15 dB | Industry standard for spectral separation |
| K-weighting | Exact match | Mathematical coefficients must be precise |
| FFT Parameters | Exact match | Critical for reproducible spectral analysis |

## 🎯 Critérios de Aprovação

### Taxa Mínima de Aprovação: **75%**
- Permite algumas falhas não-críticas
- Testes críticos **DEVEM** passar: LUFS, True Peak, Scoring

### Testes Críticos (100% obrigatório):
1. **LUFS**: Conformidade ITU-R BS.1770-4
2. **True Peak**: Conformidade EBU Tech 3341  
3. **Scoring**: Reprodutibilidade Equal Weight V3

### Testes Importantes (podem falhar ocasionalmente):
1. **Spectral Bands**: Isolamento pode variar com implementação FFT
2. **Edge Cases**: Comportamento pode depender da arquitetura

## 📄 Relatórios

### Formato de Saída
```
🎯 STATUS FINAL: PASS/FAIL
📊 Taxa de Aprovação Geral: XX.X%
🧪 Suites: X/Y aprovadas  
✅ Testes: X/Y aprovados
⚡ Testes Críticos: PASS/FAIL
⏱️ Duração: X.Xs
```

### Relatório Detalhado
- ✅ **Resumo executivo** com métricas principais
- ✅ **Resultados por suite** com detalhes técnicos
- ✅ **Validações de configuração** do pipeline
- ✅ **Recomendações** baseadas nos resultados

## 🔧 Estrutura Técnica

### Arquivos Principais
```
__tests__/audio/
├── audit.js           # Orquestrador principal
├── lufs.test.js       # LUFS validation suite
├── truepeak.test.js   # True Peak validation suite  
├── bands.test.js      # Spectral bands validation
├── scoring.test.js    # Scoring system validation
├── edgecases.test.js  # Edge cases robustness
└── generators.js      # Synthetic signal library

audit-pipeline.html    # Interface web interativa
docs/AUDITORIA_PIPELINE.md  # Documentação completa
```

### Dependencies
```javascript
// Core DSP modules being tested:
lib/audio/features/loudness.js    # LUFS implementation
lib/audio/features/truepeak.js    # True Peak implementation  
lib/audio/features/scoring.js     # Equal Weight V3 scoring
lib/audio/fft.js                  # FFT engine
scripts/spectral-utils.js         # Band analysis utilities
```

## ⚠️ Considerações Importantes

### Não Quebra Compatibilidade
- ✅ Testes **apenas validam**, nunca modificam o pipeline existente
- ✅ Sistema atual continua funcionando normalmente
- ✅ Flags de configuração preservadas
- ✅ Interface do usuário inalterada

### Performance
- ⚡ Execução: ~10-30 segundos (depende do hardware)
- 💾 Memória: ~50MB (sinais sintéticos em Float32Array)
- 🔄 Não interfere com processamento de produção

### Limitações
- 🚫 **Só valida matemática**, não testa qualidade perceptual
- 🚫 **Não substitui** testes com usuários reais
- 🚫 **Não valida** stems separation (muito pesado)

## 🆘 Solução de Problemas

### Erro: "Module not found"
```bash
# Verificar se está servindo com HTTP server
npm run audit:serve
# OU
python -m http.server 3000
```

### Erro: "Cannot import ES modules"  
```javascript
// Usar import() dinâmico no console:
const { runAudioAudit } = await import('./__tests__/audio/audit.js');
```

### Taxa de Aprovação Baixa
1. **Verificar tolerâncias** (podem estar muito restritivas)
2. **Executar suites individuais** para identificar problemas
3. **Analisar logs detalhados** no console

### Execução Lenta
1. **Desabilitar suites pesadas** (Edge Cases, Spectral Bands)
2. **Reduzir duração** dos sinais sintéticos
3. **Executar em máquina mais potente**

## 🎓 Como Interpretar Resultados

### ✅ PASS (Aprovado)
- Pipeline está matematicamente correto
- Conformidade com normas internacionais
- Pronto para uso em produção

### ❌ FAIL (Reprovado)  
- Problemas matemáticos identificados
- Não conformidade com normas
- Requer investigação e correção

### ⚠️ ERROR (Erro)
- Problema na execução dos testes
- Possível incompatibilidade de ambiente
- Verificar logs para diagnosticar

---

**🎵 SoundyAI Audio Pipeline Audit System v1.0**  
*Garantindo precisão matemática e conformidade com normas internacionais*