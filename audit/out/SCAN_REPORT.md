# 🔍 SCAN DO PROJETO - PIPELINE DE ANÁLISE DE MIXAGEM

**Run ID:** `scan_1756091069865_758`  
**Timestamp:** 2025-08-25T03:04:29.929Z  
**Módulos Escaneados:** 76  
**Tamanho Total:** 1245.3 KB  

## 📊 RESUMO POR TIPO

- **core**: 37 módulos (496.2 KB)
- **scoring**: 20 módulos (48.5 KB)
- **bridge**: 6 módulos (655.0 KB)
- **config**: 6 módulos (25.3 KB)
- **test**: 7 módulos (20.3 KB)

## 🏗️ DIAGRAMA DO PIPELINE


### 1. Audio Input & Loading

**Módulos:**
- ⚠️ Nenhum módulo identificado

**Inputs:** Audio file (WAV/MP3/FLAC)  
**Outputs:** Raw audio buffer, Sample rate, Channel count  
**Cache Points:** Nenhum


### 2. Audio Processing & Feature Extraction

**Módulos:**
- `add-spectral-targets.js`
- `analyzer\core\loudness.ts`
- `analyzer\core\spectralBalance.ts`
- `analyzer\core\spectralFeatureFlags.ts`
- `analyzer\core\spectralIntegration.ts`
- `analyzer\core\spectralTypes.ts`
- `atualizar-json-spectral.js`
- `lib\audio\features\loudness.js`
- `lib\audio\features\truepeak.js`
- `public\refs\out\funk_mandela_backup_spectral.json`
- `public\spectral-balance-v2.js`
- `public\spectral-integration-activator.js`
- `refs\out\funk_mandela_backup_pre_spectral.json`
- `refs\out\funk_mandela_backup_spectral.json`
- `refs\out\funk_mandela_spectral_v2.json`
- `test-loudness-headroom.js`
- `test-spectral-system.js`
- `test-spectral-v2.js`
- `teste-spectral-rapido.ts`
- `testes-balanço-espectral.js`
- `update-spectral-references.js`

**Inputs:** Raw audio buffer  
**Outputs:** LUFS, True Peak, DR, LRA, Spectral bands, Stereo metrics  
**Cache Points:** FFT windows, Gated blocks


### 3. Reference Loading

**Módulos:**
- `analyzer\suggestions\reference.ts`
- `api\create-preference.js`
- `lib\audio\features\reference-matcher.js`
- `public\refs\out\genres.json`
- `rebuildReferences.js`
- `refs\out\genres.json`
- `tests\funk-automotivo-genre.test.js`
- `tools\reference-builder.js`
- `tools\reference-validator.js`
- `update-spectral-references.js`

**Inputs:** Genre selection  
**Outputs:** Target values, Tolerances, Genre-specific config  
**Cache Points:** refs/out/*.json


### 4. Metrics Comparison

**Módulos:**
- ⚠️ Nenhum módulo identificado

**Inputs:** Extracted metrics, Reference targets  
**Outputs:** Deviations, Status flags, Severity levels  
**Cache Points:** Nenhum


### 5. Score Calculation

**Módulos:**
- `config\scoring-v2-config.json`
- `console-test-scoring.js`
- `deploy-scoring-v2.js`
- `lib\audio\features\scoring-integration-browser.js`
- `lib\audio\features\scoring-integration-global.js`
- `lib\audio\features\scoring-integration.js`
- `lib\audio\features\scoring-v2-browser.js`
- `lib\audio\features\scoring-v2.js`
- `lib\audio\features\scoring.js`
- `lib\config\scoring-v2-config.json`
- `public\auto-scoring-loader.js`
- `public\scoring-loader.js`
- `public\scoring-v2-complete.js`
- `scoring-v2-monitor.js`
- `test-new-scoring-system.js`
- `test-scoring-quick.js`
- `test-scoring-v2.js`
- `teste-scoring-integrado.js`
- `tests\new-scoring-algorithm.test.js`
- `tests\scoring-bidirectional.test.js`

**Inputs:** Metric deviations, Tolerances  
**Outputs:** Overall score, Component scores, Penalty breakdown  
**Cache Points:** Nenhum


### 6. Suggestions Generation

**Módulos:**
- `analyzer\suggestions\reference.ts`

**Inputs:** Deviations, Score components  
**Outputs:** Actionable suggestions, Priority levels  
**Cache Points:** Nenhum


### 7. UI Rendering & Presentation

**Módulos:**
- `analyzer\core\spectralIntegration.ts`
- `lib\audio\features\scoring-integration-browser.js`
- `lib\audio\features\scoring-integration-global.js`
- `lib\audio\features\scoring-integration.js`
- `lib\scaling\audio-queue-integration.js`
- `public\audio-analyzer-integration-broken.js`
- `public\audio-analyzer-integration-clean.js`
- `public\audio-analyzer-integration-clean2.js`
- `public\audio-analyzer-integration.js`
- `public\spectral-integration-activator.js`
- `rebuildReferences.js`
- `test-scoring-quick.js`
- `tools\reference-builder.js`

**Inputs:** Score, Suggestions, Metrics  
**Outputs:** Visual feedback, Charts, Text reports  
**Cache Points:** Nenhum


## 📁 INVENTÁRIO DETALHADO

### Módulos Core (Extração de Métricas)

| Arquivo | Descrição | Tamanho | Última Modificação |
|---------|-----------|---------|-------------------|
| `add-spectral-targets.js` | Sem descrição disponível | 0.0KB | 24/08/2025 |
| `analyzer\core\loudness.ts` | Sem descrição disponível | 0.0KB | 17/08/2025 |
| `analyzer\core\spectralBalance.ts` |  | 12.0KB | 24/08/2025 |
| `analyzer\core\spectralFeatureFlags.ts` | Sem descrição disponível | 0.0KB | 24/08/2025 |
| `analyzer\core\spectralIntegration.ts` |  | 12.0KB | 24/08/2025 |
| `analyzer\core\spectralTypes.ts` |  | 6.6KB | 24/08/2025 |
| `analyzer\suggestions\reference.ts` | Sem descrição disponível | 0.0KB | 17/08/2025 |
| `api\create-preference.js` | configura Mercado Pago | 1.4KB | 12/08/2025 |
| `api\upload-audio.js` |  | 8.8KB | 20/08/2025 |
| `atualizar-json-spectral.js` | Sem descrição disponível | 0.0KB | 24/08/2025 |
| `deploy-metrics-centralization.js` |  | 8.2KB | 23/08/2025 |
| `lib\audio\feature-flags.js` | 🌐 FEATURE FLAGS CENTRAL | 1.5KB | 16/08/2025 |
| `lib\audio\features\loudness.js` |  | 14.8KB | 17/08/2025 |
| `lib\audio\features\reference-matcher.js` | Reference Matcher: seleciona 3–5 referências mais próximas e gera metas/tolerâncias adaptativas. | 7.7KB | 15/08/2025 |
| `lib\audio\features\truepeak.js` |  | 11.0KB | 14/08/2025 |
| `lib\config\feature-flags.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `lib\scaling\audio-processing-queue.js` |  | 9.1KB | 23/08/2025 |
| `public\audio-analyzer-clean.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v1-super-clean.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2-clean.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2-final.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2-perfeito.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2-referencias.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2-super-clean.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2-TEMP-FINAL.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2-ultra-simples.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2-UNIFICADO.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-v2.js` | Sem descrição disponível | 112.6KB | 24/08/2025 |
| `public\audio-analyzer.js` |  | 240.1KB | 24/08/2025 |
| `public\professional-audio-analyzer.js` | Sem descrição disponível | 0.0KB | 17/08/2025 |
| `public\spectral-balance-v2.js` | Sem descrição disponível | 0.0KB | 24/08/2025 |
| `rebuildReferences.js` | Sem descrição disponível | 0.0KB | 24/08/2025 |
| `tools\fix-funk-mandela-metrics.js` |  | 6.5KB | 23/08/2025 |
| `tools\metrics-recalc.js` |  | 23.8KB | 23/08/2025 |
| `tools\reference-builder.js` |  | 17.2KB | 17/08/2025 |
| `tools\reference-validator.js` |  | 3.0KB | 12/08/2025 |
| `update-spectral-references.js` | Sem descrição disponível | 0.0KB | 24/08/2025 |


### Módulos de Scoring

| Arquivo | Descrição | Tamanho | Última Modificação |
|---------|-----------|---------|-------------------|
| `config\scoring-v2-config.json` | Sem descrição disponível | 18.5KB | 23/08/2025 |
| `console-test-scoring.js` | Carregar o módulo e testar | 1.2KB | 24/08/2025 |
| `deploy-scoring-v2.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `lib\audio\features\scoring-integration-browser.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `lib\audio\features\scoring-integration-global.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `lib\audio\features\scoring-integration.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `lib\audio\features\scoring-v2-browser.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `lib\audio\features\scoring-v2.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `lib\audio\features\scoring.js` |  | 7.1KB | 24/08/2025 |
| `lib\config\scoring-v2-config.json` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `public\auto-scoring-loader.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `public\scoring-loader.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `public\scoring-v2-complete.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `scoring-v2-monitor.js` | 📊 SCRIPT DE MONITORAMENTO DO SCORING V2 | 1.7KB | 23/08/2025 |
| `test-new-scoring-system.js` | 🧪 TESTE DO NOVO SISTEMA DE SCORING COM PESOS IGUAIS | 7.3KB | 24/08/2025 |
| `test-scoring-quick.js` | 🧪 TESTE RÁPIDO DO NOVO SISTEMA | 2.2KB | 24/08/2025 |
| `test-scoring-v2.js` | Sem descrição disponível | 0.0KB | 23/08/2025 |
| `teste-scoring-integrado.js` |  | 7.1KB | 24/08/2025 |
| `tests\new-scoring-algorithm.test.js` | 1) Dentro do intervalo | 2.2KB | 15/08/2025 |
| `tests\scoring-bidirectional.test.js` | Testes simples (manual) para validar scoreTolerance bidirecional | 1.1KB | 15/08/2025 |


### Módulos de UI/Bridge
⚠️ Nenhum módulo encontrado

| Arquivo | Descrição | Tamanho | Última Modificação |
|---------|-----------|---------|-------------------|
| `lib\scaling\audio-queue-integration.js` |  | 6.5KB | 23/08/2025 |
| `public\audio-analyzer-integration-broken.js` | 🎵 AUDIO ANALYZER INTEGRATION | 207.5KB | 24/08/2025 |
| `public\audio-analyzer-integration-clean.js` | Sem descrição disponível | 0.0KB | 12/08/2025 |
| `public\audio-analyzer-integration-clean2.js` | 🎵 AUDIO ANALYZER INTEGRATION | 207.5KB | 24/08/2025 |
| `public\audio-analyzer-integration.js` | 🎵 AUDIO ANALYZER INTEGRATION | 223.5KB | 24/08/2025 |
| `public\spectral-integration-activator.js` |  | 10.0KB | 24/08/2025 |


### Configurações e Referências
⚠️ Nenhum módulo encontrado

| Arquivo | Descrição | Tamanho | Última Modificação |
|---------|-----------|---------|-------------------|
| `public\refs\out\funk_mandela_backup_spectral.json` | Sem descrição disponível | 5.0KB | 24/08/2025 |
| `public\refs\out\genres.json` | Sem descrição disponível | 0.4KB | 23/08/2025 |
| `refs\out\funk_mandela_backup_pre_spectral.json` | Sem descrição disponível | 8.3KB | 24/08/2025 |
| `refs\out\funk_mandela_backup_spectral.json` | Sem descrição disponível | 5.0KB | 24/08/2025 |
| `refs\out\funk_mandela_spectral_v2.json` | Sem descrição disponível | 6.1KB | 24/08/2025 |
| `refs\out\genres.json` | Sem descrição disponível | 0.4KB | 23/08/2025 |


## 🔍 PONTOS DE ATENÇÃO

### Potenciais Race Conditions
✅ Nenhum padrão assíncrono identificado nos exports

### Dependências Críticas
**Core Features:** 37 módulos
**Scoring Logic:** 20 módulos




### Cache e Performance
Pontos identificados:
- FFT windows
- Gated blocks
- refs/out/*.json

---

**Próximos Passos da Auditoria:**
1. `generateTestAudio.js` - Gerar casos de teste
2. `recalcReferences.js` - Validar referências
3. `validateRuntimeMetrics.js` - Testar extração de métricas
4. `checkScoring.js` - Auditar fórmulas de score
