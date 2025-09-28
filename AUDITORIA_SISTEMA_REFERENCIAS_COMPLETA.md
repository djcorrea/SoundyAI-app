# 🔍 AUDITORIA COMPLETA - Sistema de Referência de Métricas SoundyAI

## 📋 RESUMO EXECUTIVO

A auditoria revelou um sistema de referência complexo com **múltiplas fontes de dados** e **uma hierarquia específica de precedência**. O principal problema identificado é que **valores hardcoded no código podem sobrepor os valores dos arquivos JSON**, criando inconsistências.

---

## 🗂️ 1. MAPEAMENTO DE ARQUIVOS DE REFERÊNCIA

### 1.1 Arquivos JSON Encontrados

| Arquivo | Localização | Status | Função |
|---------|-------------|---------|---------|
| `funk_mandela.json` | `public/refs/out/` | ✅ **PRIORIDADE 1** | Arquivo principal usado pelo sistema |
| `funk_mandela.json` | `public/refs/` | ⚠️ Não usado | Possivelmente obsoleto |
| `funk_mandela.json` | `backup/refs-original-backup/` | 📦 Backup | Versão antiga preservada |
| `scoring-v2-config.json` | `config/` | ❌ **NÃO CARREGADO** | Parâmetros de scoring não utilizados |
| `scoring-v2-config.json` | `public/lib/config/` | ❌ **NÃO CARREGADO** | Duplicata não utilizada |

### 1.2 Diferenças entre Versões

- **`public/refs/out/funk_mandela.json`**: Versão v2_hybrid_safe (atual, 147 linhas)
- **`public/refs/funk_mandela.json`**: Versão v2_hybrid_safe (similar, 145 linhas)  
- **`backup/refs-original-backup/funk_mandela.json`**: Versão v2_lufs_norm (antiga, 235 linhas)

---

## 🔄 2. FLUXO DE CARREGAMENTO DE REFERÊNCIAS

### 2.1 Hierarquia de Precedência (função `loadReferenceData`)

```javascript
1️⃣ **PRIORIDADE MÁXIMA**: Arquivos JSON externos
   - `/public/refs/out/${genre}.json` ← USADO
   - `/refs/out/${genre}.json`
   - `refs/out/${genre}.json`
   - `../refs/out/${genre}.json`

2️⃣ **FALLBACK NÍVEL 1**: Referências embutidas (embedded)
   - `window.__EMBEDDED_REFS__.byGenre[genre]`
   - `__INLINE_EMBEDDED_REFS__.byGenre[genre]`

3️⃣ **FALLBACK NÍVEL 2**: Hardcode no código
   - Valores inline no `audio-analyzer-integration.js` (linhas 1008-1096)

4️⃣ **FALLBACK FINAL**: Trance como padrão
```

### 2.2 Processamento dos Dados

1. **Carregamento**: `fetchRefJsonWithFallback()` busca o JSON
2. **Enriquecimento**: `enrichReferenceObject()` processa os dados:
   - Mapeia `legacy_compatibility` para propriedades root
   - Preenche valores ausentes com estatísticas agregadas
   - Aplica heurísticas para stereo_target se ausente
3. **Cache**: Dados ficam em `__refDataCache[genre]` e `__activeRefData`
4. **Disponibilização**: `window.PROD_AI_REF_DATA` recebe os dados finais

---

## ⚠️ 3. PROBLEMAS CRÍTICOS IDENTIFICADOS

### 3.1 Valores Hardcoded Sobrepondo JSON

**LOCALIZAÇÃO**: `audio-analyzer-integration.js`, linhas 1008-1096

```javascript
// ⚠️ PROBLEMA: Valores hardcoded que podem sobrepor o JSON
funk_mandela: { 
    lufs_target: -8.0,  // Hardcoded: -8.0
    tol_lufs: 2.5,
    bands: { 
        mid: {target_db: -6.8, tol_db: 1.5} // Hardcoded: -6.8
    }
}
```

**VS JSON ATUAL** (`public/refs/out/funk_mandela.json`):
```json
{
  "legacy_compatibility": {
    "lufs_target": -8.5,  // JSON: -8.5
    "bands": {
      "mid": {"target_db": -17.9}  // JSON: -17.9
    }
  }
}
```

### 3.2 scoring-v2-config.json Não Carregado

- ❌ O arquivo `scoring-v2-config.json` **nunca é carregado**
- ❌ `window.__SCORING_V2_CONFIG__` sempre fica `{}`  
- ❌ Parâmetros de scoring personalizados são ignorados

### 3.3 Duplicidade de calculateMetricScore

- ✅ **CORRIGIDO**: A função duplicada em `audio-analyzer-integration.js` agora redireciona para `scoring.js`
- ✅ **FUNÇÃO OFICIAL**: `window.calculateMetricScore` do `scoring.js` está ativa

---

## 🎯 4. ONDE OS VALORES SÃO REALMENTE USADOS

### 4.1 No Sistema de Scoring (`scoring.js`)

```javascript
// scoring.js linha 181
const reference = analysisData.reference || {};

// Targets usados:
lufsIntegrated: reference.lufs_target || -14,
truePeakDbtp: reference.true_peak_target || -1,
dr: reference.dr_target || 10,
// ...

// Tolerâncias usadas:
lufsIntegrated: reference.tol_lufs || 3.0,
truePeakDbtp: reference.tol_true_peak || 2.5,
// ...
```

### 4.2 Na Interface (`updateReferenceSuggestions`)

```javascript
// audio-analyzer-integration.js linha 6093
function updateReferenceSuggestions(analysis) {
    // Usa __activeRefData carregado por loadReferenceData()
    // Exibe valores na UI baseado nos dados carregados
}
```

### 4.3 No Cálculo de Score (`computeMixScore`)

```javascript
// audio-analyzer-integration.js linha 1439
window.computeMixScore(technicalData, __refData)
// __refData = dados de loadReferenceData()
```

---

## 📊 5. ORDEM DE PRECEDÊNCIA FINAL

### 5.1 Para Targets e Tolerâncias:

```
1. 🥇 JSON externo (public/refs/out/funk_mandela.json)
   └── Processado por enrichReferenceObject()
   └── legacy_compatibility mapeado para root

2. 🥈 Valores hardcoded (se JSON falhar)
   └── audio-analyzer-integration.js linhas 1008-1096

3. 🥉 Fallbacks inline (trance como padrão)
```

### 5.2 Para Parâmetros de Scoring:

```
1. ❌ scoring-v2-config.json (não carregado)
2. ✅ Defaults hardcoded em getScoringParameters()
```

---

## 🔧 6. COMO ALTERAR VALORES NA PRÁTICA

### 6.1 ✅ **MÉTODO CORRETO** (arquivo JSON):

1. **Editar**: `public/refs/out/funk_mandela.json`
2. **Seção**: `legacy_compatibility` (mapeada automaticamente)
3. **Efeito**: Valores aparecem na UI e no scoring

### 6.2 ⚠️ **PROBLEMAS POTENCIAIS**:

1. **Cache**: Limpar com `window.REFS_BYPASS_CACHE = true`
2. **Hardcode**: Se JSON falhar, valores hardcoded entram em ação
3. **Fallbacks**: Sistema usa trance como último recurso

---

## 📋 7. VALIDAÇÃO FINAL

Para verificar se alterações no JSON estão funcionando:

```javascript
// 1. Verificar carregamento
console.log('Ref data:', window.PROD_AI_REF_DATA);

// 2. Verificar valores específicos  
console.log('LUFS target:', window.PROD_AI_REF_DATA.lufs_target);
console.log('Mid target:', window.PROD_AI_REF_DATA.bands?.mid?.target_db);

// 3. Verificar na UI
// Os valores devem aparecer nas sugestões e comparações
```

---

## 🎯 CONCLUSÃO

**✅ ARQUIVO PRINCIPAL IDENTIFICADO**: `public/refs/out/funk_mandela.json`

**✅ FLUXO MAPEADO**: JSON → enrichReferenceObject → cache → scoring.js → UI

**⚠️ PONTO DE ATENÇÃO**: Valores hardcoded podem sobrepor JSON em caso de falha

**🔧 RECOMENDAÇÃO**: Alterar sempre o arquivo JSON, monitorar logs de carregamento, e testar com cache bypass ativo.