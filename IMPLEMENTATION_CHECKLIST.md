# ✅ Checklist de Implementação: Granular V1

## 📋 Validação Pré-Deploy

Use este checklist para garantir que a implementação do engine granular_v1 está completa e funcional antes do deploy.

---

## 🆕 Arquivos Criados

- [x] **`work/lib/audio/features/spectral-bands-granular.js`**
  - [x] Função `analyzeGranularSpectralBands(framesFFT, reference)` implementada
  - [x] Função `aggregateSubBandsIntoGroups(subBands, grouping, severity)` implementada
  - [x] Função `buildSuggestions(subBands, grouping, config)` implementada
  - [x] Constantes exportadas: `DEFAULT_GRANULAR_BANDS`, `DEFAULT_GROUPING`, `DEFAULT_SEVERITY`
  - [x] Utilitários exportados: `freqToBin`, `linearToDb`, `statusFromDeviation`
  - [x] Documentação clara com comentários JSDoc

- [x] **`references/techno.v1.json`**
  - [x] Schema com 13 sub-bandas definidas
  - [x] Targets e toleranceSigma por banda
  - [x] Grouping de 7 bandas principais
  - [x] Configurações de severity e suggestions
  - [x] Metadata (genre, version, calibratedWith)

- [x] **`contracts/example-payload.v1.json`**
  - [x] Exemplo completo de payload granular_v1
  - [x] Campos legacy preservados (bands, technicalData, score)
  - [x] Campos novos: engineVersion, granular[], suggestions[]
  - [x] Estrutura válida (JSON bem-formado)

- [x] **`contracts/example-telemetry.json`**
  - [x] Telemetria detalhada para debugging
  - [x] Informações de pipeline (duração por fase)
  - [x] Metadados granulares completos

- [x] **`GRANULAR_V1_README.md`**
  - [x] Documentação de ativação e uso
  - [x] Estrutura do payload explicada
  - [x] Exemplos de testes
  - [x] Procedimento de rollback
  - [x] Próximos passos documentados

- [x] **`work/tests/spectral-bands-granular.test.js`**
  - [x] Testes unitários para funções principais
  - [x] Validação de constantes e configuração
  - [x] Mock de FFT frames para testes
  - [x] Assertions de estrutura de dados

---

## 🛠️ Arquivos Modificados

- [x] **`work/api/audio/core-metrics.js`**
  - [x] Roteador condicional adicionado em `calculateSpectralBandsMetrics()` (linha ~848)
  - [x] Checagem de `process.env.ANALYZER_ENGINE`
  - [x] Chamada para `calculateGranularSubBands()` quando engine = 'granular_v1'
  - [x] Código legacy **100% preservado** (não removido nada)
  - [x] Nova função `calculateGranularSubBands()` implementada (linha ~1910)
  - [x] Conversão de estrutura de frames FFT para formato granular
  - [x] Import dinâmico do módulo granular
  - [x] Tratamento de erros com fallback seguro
  - [x] Logs detalhados para debugging

- [x] **`work/api/audio/json-output.js`**
  - [x] Campos aditivos adicionados em `buildFinalJSON()` (linha ~775)
  - [x] Uso de spread operator `...()` para não quebrar compatibilidade
  - [x] Checagem de `coreMetrics.spectralBands?.algorithm === 'granular_v1'`
  - [x] Campos adicionados:
    - [x] `engineVersion`
    - [x] `granular[]`
    - [x] `suggestions[]`
    - [x] `granularMetadata{}`
  - [x] Código legacy **100% preservado**

- [x] **`.env.example`**
  - [x] Feature flag `ANALYZER_ENGINE` documentada
  - [x] Valores possíveis: `legacy` | `granular_v1`
  - [x] Comentários explicativos sobre cada opção
  - [x] Outras configurações atualizadas

---

## 🧪 Testes Manuais

### 1. Teste de Módulo Isolado

```bash
# Executar testes unitários
node work/tests/spectral-bands-granular.test.js
```

**Critérios de sucesso**:
- [ ] Todos os testes passam (taxa de sucesso = 100%)
- [ ] Nenhum erro de import ou sintaxe
- [ ] Logs mostram estrutura de dados correta

### 2. Teste Legacy (Regressão)

```bash
# No .env
ANALYZER_ENGINE=legacy

# Executar worker
node work/index.js
```

**Critérios de sucesso**:
- [ ] Logs mostram: `🔄 [SPECTRAL_BANDS] Engine legacy ativado`
- [ ] Bandas calculadas normalmente (7 bandas principais)
- [ ] Payload **NÃO** contém campos `granular`, `suggestions`, `engineVersion`
- [ ] LUFS, True Peak, DR, LRA calculados corretamente
- [ ] Score e classificação funcionam

### 3. Teste Granular V1

```bash
# No .env
ANALYZER_ENGINE=granular_v1

# Executar worker
node work/index.js
```

**Critérios de sucesso**:
- [ ] Logs mostram: `🚀 [SPECTRAL_BANDS] Engine granular_v1 ativado`
- [ ] Logs mostram: `🔍 [GRANULAR_V1] Início da análise granular`
- [ ] Logs mostram: `✅ [GRANULAR_V1] Análise concluída: 13 sub-bandas`
- [ ] Payload contém `engineVersion: "granular_v1"`
- [ ] Array `granular` com 13 sub-bandas
- [ ] Array `suggestions` com sugestões (se houver desvios)
- [ ] Bandas principais agregadas corretamente
- [ ] LUFS, True Peak, DR, LRA **idênticos ao legacy** (tolerância < 0.1%)

### 4. Teste de Compatibilidade Frontend

```javascript
// Simular consumo do frontend
const payload = JSON.parse(responseBody);

// Bandas principais sempre presentes
console.assert(payload.bands !== undefined, 'Bands deve existir');
console.assert(payload.bands.sub !== undefined, 'Sub banda deve existir');

// Campos granulares opcionais
if (payload.engineVersion === 'granular_v1') {
  console.assert(Array.isArray(payload.granular), 'Granular deve ser array');
  console.assert(Array.isArray(payload.suggestions), 'Suggestions deve ser array');
  console.log(`✅ Payload granular_v1 válido: ${payload.granular.length} sub-bandas`);
} else {
  console.log('✅ Payload legacy válido');
}
```

**Critérios de sucesso**:
- [ ] Frontend renderiza bandas principais normalmente (legacy e granular)
- [ ] Nenhum erro de JavaScript no console
- [ ] Campos opcionais não quebram renderização

---

## 🔄 Teste de Rollback

```bash
# Ativar granular_v1
ANALYZER_ENGINE=granular_v1
pm2 restart workers

# Processar 1 audio
# Verificar payload granular

# Fazer rollback
ANALYZER_ENGINE=legacy
pm2 restart workers

# Processar MESMO audio
# Comparar payloads
```

**Critérios de sucesso**:
- [ ] Rollback instantâneo (sem downtime)
- [ ] Payload volta ao formato legacy
- [ ] LUFS/TP/DR/LRA idênticos antes e depois
- [ ] Nenhum erro ou crash

---

## 📊 Validação de Dados

### Estrutura de Sub-banda

Cada item do array `granular[]` deve ter:

- [ ] `id` (string): Identificador único (ex: "sub_low")
- [ ] `range` (array): [freqStart, freqEnd] em Hz
- [ ] `energyDb` (number): Energia medida em dB
- [ ] `target` (number): Target esperado em dB
- [ ] `toleranceSigma` (number): Tolerância em sigma
- [ ] `deviation` (number): Desvio vs target em dB
- [ ] `deviationSigmas` (number): Desvio em unidades de sigma
- [ ] `status` (string): "ideal" | "adjust" | "fix"
- [ ] `description` (string, opcional): Descrição da banda

### Estrutura de Sugestão

Cada item do array `suggestions[]` deve ter:

- [ ] `priority` (string): "high" | "medium" | "low"
- [ ] `freq_range` (array): [freqStart, freqEnd] em Hz
- [ ] `type` (string): "boost" | "cut"
- [ ] `amount` (number): Quantidade em dB (1.0 a 4.0)
- [ ] `metric` (string): "frequency_balance"
- [ ] `deviation` (number): Desvio original em dB
- [ ] `message` (string): Mensagem em português

### Estrutura de Grupos

Cada banda principal em `bands` (legacy) ou `groups` (granular) deve ter:

- [ ] `status` (string): "green" | "yellow" | "red" (granular) ou "calculated" (legacy)
- [ ] `score` (number): Score agregado (granular) ou null (legacy)
- [ ] `description` (string, opcional): Descrição do status
- [ ] `subBandsCount` (number, granular): Quantidade de sub-bandas no grupo

---

## 🛡️ Checklist de Segurança

- [x] Nenhum código legacy removido
- [x] Feature flag com valor padrão seguro (`legacy`)
- [x] Tratamento de erros em todas as funções críticas
- [x] Fallback para estrutura vazia em caso de erro
- [x] Logs detalhados para debugging
- [x] Validação de entrada (frames FFT nulos/vazios)
- [x] Nenhuma alteração em LUFS, True Peak, DR, LRA, Correlation
- [x] Campos novos são aditivos (não sobrescrevem existentes)
- [x] JSON bem-formado (sem propriedades undefined)

---

## 📈 Performance

### Métricas a Validar

- [ ] Latência de análise espectral ≤ +15% vs legacy
- [ ] Payload size ≤ +30% vs legacy
- [ ] Memória worker ≤ +10% vs legacy
- [ ] Nenhum memory leak após 100 jobs
- [ ] Nenhum crash ou timeout

### Comando de Benchmark

```bash
# Processar 10 tracks iguais com legacy
ANALYZER_ENGINE=legacy
time node work/index.js < benchmark-tracks.txt

# Processar 10 tracks iguais com granular_v1
ANALYZER_ENGINE=granular_v1
time node work/index.js < benchmark-tracks.txt

# Comparar tempos
```

---

## 🚀 Deploy Checklist

### Pré-deploy

- [ ] Todos os testes passam
- [ ] Código revisado (code review)
- [ ] Documentação completa
- [ ] `.env.example` atualizado
- [ ] Feature flag configurada (padrão: `legacy`)

### Deploy

- [ ] Deploy em ambiente de staging primeiro
- [ ] Processar 10-20 tracks de teste
- [ ] Validar payloads (estrutura + dados)
- [ ] Monitorar logs por 1 hora
- [ ] Rollback se houver erros

### Pós-deploy

- [ ] Ativar granular_v1 para 10% do tráfego (canary)
- [ ] Monitorar métricas (latência, erros, CPU, memória)
- [ ] Coletar feedback de usuários
- [ ] Gradual rollout: 10% → 25% → 50% → 100%
- [ ] Deprecar legacy após 30 dias estável

---

## ✅ Assinatura Final

**Data**: _________

**Revisor**: _________

**Status**:
- [ ] ✅ Pronto para deploy em staging
- [ ] ✅ Pronto para deploy em produção (canary)
- [ ] ✅ Pronto para deploy em produção (100%)
- [ ] ❌ Requer ajustes (detalhar abaixo)

**Observações**:

```
(Espaço para notas do revisor)
```

---

## 🎯 Resumo Executivo

**Total de itens**: ~70 checklist items

**Itens críticos (bloqueantes)**:
- [ ] Testes unitários passam 100%
- [ ] Código legacy preservado
- [ ] Feature flag funcional
- [ ] Rollback testado e funcional
- [ ] LUFS/TP/DR/LRA idênticos (regressão)

**Itens importantes (não-bloqueantes)**:
- [ ] Documentação completa
- [ ] Performance dentro do esperado
- [ ] Logs detalhados
- [ ] Telemetria implementada

**Próximas etapas após deploy**:
1. Calibração de referências por gênero
2. Integração frontend (visualização sub-bandas)
3. A/B testing com usuários reais
4. Coleta de feedback e iteração

---

**🎉 Boa sorte no deploy!**
