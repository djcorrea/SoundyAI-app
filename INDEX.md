# 📚 Índice da Documentação: Granular V1

Este índice organiza toda a documentação relacionada à implementação do engine de análise espectral granular V1.

---

## 🎯 Para Começar (Start Here)

Se você é **novo** neste projeto ou quer entender **o que foi implementado**, comece por aqui:

1. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** ⭐
   - Resumo executivo da implementação
   - Lista de arquivos criados/modificados
   - Status de conclusão
   - Próximos passos

2. **[GRANULAR_V1_README.md](./GRANULAR_V1_README.md)** 📖
   - Guia completo de uso
   - Como ativar/desativar
   - Estrutura do payload
   - Procedimento de rollback

---

## 🏗️ Arquitetura e Design

Para entender **como o sistema funciona internamente**:

3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** 🏛️
   - Diagrama de fluxo completo
   - Componentes principais
   - Estrutura de dados
   - Algoritmos de classificação
   - Pontos de segurança

---

## 🧪 Testes e Validação

Para **validar a implementação** antes do deploy:

4. **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** ✅
   - 70+ itens de validação
   - Checklist de arquivos criados/modificados
   - Critérios de sucesso
   - Checklist de deploy

5. **[MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md)** 🧪
   - Guia passo a passo de testes manuais
   - 7 testes principais:
     1. Módulo isolado (unitário)
     2. Legacy (regressão)
     3. Granular V1
     4. Comparação legacy vs granular
     5. Rollback
     6. Performance
     7. Compatibilidade frontend
   - Scripts de validação
   - Troubleshooting

---

## 📋 Planejamento e Especificação

Documentos originais de planejamento (criados na auditoria):

6. **[AUDITORIA.md](./AUDITORIA.md)** 🔍
   - Inventário completo do sistema
   - Dataflow detalhado
   - Diagnóstico técnico
   - Tabela de funções

7. **[PLAN.md](./PLAN.md)** 📝
   - Plano de implementação em 7 passos
   - Matriz de testes
   - Procedimentos de roll-back
   - Estimativas de tempo

8. **[RESPOSTA_FINAL.md](./RESPOSTA_FINAL.md)** 💡
   - Resposta à pergunta: "Qual a forma mais segura?"
   - Lista de arquivos exatos
   - Ordem de execução
   - Testes de regressão

---

## 📦 Schemas e Contratos

Exemplos de **estrutura de dados e payloads**:

9. **[references/techno.v1.json](./references/techno.v1.json)** 🎵
   - Schema de referência para gênero Techno
   - 13 sub-bandas com targets + tolerâncias
   - Configurações de grouping, severity, suggestions

10. **[contracts/example-payload.v1.json](./contracts/example-payload.v1.json)** 📄
    - Exemplo completo de payload granular_v1
    - Campos legacy + aditivos
    - Estrutura real com dados

11. **[contracts/example-telemetry.json](./contracts/example-telemetry.json)** 📊
    - Telemetria ultra-detalhada
    - Performance por fase do pipeline
    - Metadados granulares

---

## 💻 Código Fonte

Arquivos de **implementação principal**:

### Criados

12. **[work/lib/audio/features/spectral-bands-granular.js](./work/lib/audio/features/spectral-bands-granular.js)** ⚙️
    - Módulo principal de análise granular
    - 550 linhas, totalmente documentado
    - Funções:
      - `analyzeGranularSpectralBands()`
      - `aggregateSubBandsIntoGroups()`
      - `buildSuggestions()`

13. **[work/tests/spectral-bands-granular.test.js](./work/tests/spectral-bands-granular.test.js)** 🧪
    - Testes unitários completos
    - Mock de FFT frames
    - 35+ asserções

### Modificados

14. **[work/api/audio/core-metrics.js](./work/api/audio/core-metrics.js)** 🔧
    - Linha ~854: Roteador condicional
    - Linha ~1920: Função `calculateGranularSubBands()`
    - Código legacy 100% preservado

15. **[work/api/audio/json-output.js](./work/api/audio/json-output.js)** 📤
    - Linha ~790: Campos aditivos (spread operator)
    - `engineVersion`, `granular[]`, `suggestions[]`

16. **[.env.example](./.env.example)** 🔑
    - Feature flag `ANALYZER_ENGINE` documentada
    - Todas as configurações do projeto

---

## 📊 Referência Rápida

### Por Tipo de Documento

| Tipo | Arquivos |
|------|----------|
| **Resumo** | IMPLEMENTATION_SUMMARY.md |
| **Guia de Uso** | GRANULAR_V1_README.md |
| **Arquitetura** | ARCHITECTURE.md |
| **Testes** | IMPLEMENTATION_CHECKLIST.md, MANUAL_TESTING_GUIDE.md |
| **Planejamento** | AUDITORIA.md, PLAN.md, RESPOSTA_FINAL.md |
| **Schemas** | references/techno.v1.json, contracts/*.json |
| **Código** | spectral-bands-granular.js, core-metrics.js, json-output.js |

### Por Público-alvo

| Público | Documentos Recomendados |
|---------|-------------------------|
| **Desenvolvedor (novo no projeto)** | 1 → 2 → 3 |
| **QA / Tester** | 4 → 5 |
| **Arquiteto / Revisor** | 3 → 6 → 7 |
| **DevOps / Deploy** | 2 → 4 → 5 |
| **Product Manager** | 1 → 8 |

### Por Fase do Projeto

| Fase | Documentos |
|------|------------|
| **Planejamento** | 6 → 7 → 8 |
| **Implementação** | 12 → 14 → 15 |
| **Testes** | 13 → 4 → 5 |
| **Deploy** | 2 → 4 |
| **Manutenção** | 3 → 2 |

---

## 🔍 Buscar por Tópico

### Feature Flag

- **Como ativar**: [GRANULAR_V1_README.md](./GRANULAR_V1_README.md#-ativação)
- **Como funciona**: [ARCHITECTURE.md](./ARCHITECTURE.md#-componentes-principais)
- **Configuração**: [.env.example](./.env.example)

### Sub-bandas Granulares

- **Definição**: [references/techno.v1.json](./references/techno.v1.json)
- **Algoritmo**: [spectral-bands-granular.js](./work/lib/audio/features/spectral-bands-granular.js)
- **Estrutura**: [ARCHITECTURE.md](./ARCHITECTURE.md#-estrutura-de-dados)

### Sugestões Inteligentes

- **Como são geradas**: [spectral-bands-granular.js](./work/lib/audio/features/spectral-bands-granular.js) (linha ~360)
- **Estrutura**: [ARCHITECTURE.md](./ARCHITECTURE.md#sugestão)
- **Exemplo**: [contracts/example-payload.v1.json](./contracts/example-payload.v1.json)

### Payload JSON

- **Estrutura completa**: [GRANULAR_V1_README.md](./GRANULAR_V1_README.md#-estrutura-do-payload)
- **Exemplo real**: [contracts/example-payload.v1.json](./contracts/example-payload.v1.json)
- **Código de montagem**: [json-output.js](./work/api/audio/json-output.js) (linha ~790)

### Testes

- **Unitários**: [spectral-bands-granular.test.js](./work/tests/spectral-bands-granular.test.js)
- **Manuais**: [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md)
- **Checklist**: [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)

### Rollback

- **Procedimento**: [GRANULAR_V1_README.md](./GRANULAR_V1_README.md#️-rollback)
- **Teste**: [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md#-teste-5-rollback)
- **Plano**: [PLAN.md](./PLAN.md) (seção de roll-back)

### Performance

- **Métricas esperadas**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md#-performance-esperada)
- **Como medir**: [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md#-teste-6-performance)
- **Monitoramento**: [ARCHITECTURE.md](./ARCHITECTURE.md#-métricas-de-monitoramento)

---

## 📖 Leitura Recomendada por Cenário

### Cenário 1: "Quero entender o que foi feito"

```
1. IMPLEMENTATION_SUMMARY.md (5 min)
   ↓
2. GRANULAR_V1_README.md (15 min)
   ↓
3. ARCHITECTURE.md (10 min)
```

**Total**: ~30 minutos

---

### Cenário 2: "Vou testar antes do deploy"

```
1. IMPLEMENTATION_CHECKLIST.md (10 min - ler)
   ↓
2. MANUAL_TESTING_GUIDE.md (60 min - executar testes)
   ↓
3. Validar resultados conforme IMPLEMENTATION_CHECKLIST.md
```

**Total**: ~70 minutos

---

### Cenário 3: "Vou fazer code review"

```
1. ARCHITECTURE.md (15 min)
   ↓
2. spectral-bands-granular.js (30 min - revisar código)
   ↓
3. core-metrics.js (15 min - revisar modificações)
   ↓
4. json-output.js (10 min - revisar modificações)
```

**Total**: ~70 minutos

---

### Cenário 4: "Algo deu errado em produção"

```
1. GRANULAR_V1_README.md → Seção Rollback (2 min)
   ↓
2. Executar rollback: ANALYZER_ENGINE=legacy
   ↓
3. MANUAL_TESTING_GUIDE.md → Troubleshooting (10 min)
```

**Total**: ~15 minutos

---

### Cenário 5: "Vou adicionar um novo gênero"

```
1. references/techno.v1.json (5 min - entender schema)
   ↓
2. Criar references/{genre}.v1.json
   ↓
3. Calibrar targets com dataset (conforme PLAN.md)
```

**Total**: Variável (depende da calibração)

---

## 🆘 FAQ - Perguntas Frequentes

### Como ativar o granular_v1?

**R**: Edite `.env` e defina `ANALYZER_ENGINE=granular_v1`, depois reinicie workers.  
**Detalhes**: [GRANULAR_V1_README.md#-ativação](./GRANULAR_V1_README.md#-ativação)

---

### O frontend precisa de mudanças?

**R**: Não. O payload é 100% retrocompatível. Campos novos são opcionais.  
**Detalhes**: [GRANULAR_V1_README.md#-compatibilidade-com-front](./GRANULAR_V1_README.md#-compatibilidade-com-front)

---

### Como fazer rollback se algo der errado?

**R**: Mude `ANALYZER_ENGINE=legacy` no `.env` e reinicie. Instantâneo.  
**Detalhes**: [GRANULAR_V1_README.md#️-rollback](./GRANULAR_V1_README.md#️-rollback)

---

### As métricas LUFS/TP/DR mudam?

**R**: Não. Elas são idênticas entre legacy e granular_v1 (garantido por design).  
**Detalhes**: [ARCHITECTURE.md#-pontos-de-segurança](./ARCHITECTURE.md#-pontos-de-segurança)

---

### Como executar testes?

**R**: `node work/tests/spectral-bands-granular.test.js` para unitários. Veja o guia manual para testes completos.  
**Detalhes**: [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md)

---

### Onde estão os arquivos modificados?

**R**: Apenas 3: `core-metrics.js`, `json-output.js`, `.env.example`. Código legacy preservado.  
**Detalhes**: [IMPLEMENTATION_SUMMARY.md#️-arquivos-modificados](./IMPLEMENTATION_SUMMARY.md#️-arquivos-modificados)

---

### Qual a diferença de performance?

**R**: Esperado +15% latência, +10% memória. Aceitável para ganho de precisão.  
**Detalhes**: [IMPLEMENTATION_SUMMARY.md#-performance-esperada](./IMPLEMENTATION_SUMMARY.md#-performance-esperada)

---

### Como adicionar um novo gênero de referência?

**R**: Copie `references/techno.v1.json`, ajuste targets baseado em dataset do gênero.  
**Detalhes**: [GRANULAR_V1_README.md#calibração-de-referências](./GRANULAR_V1_README.md#calibração-de-referências)

---

## 📞 Suporte

**Para questões técnicas**: Consulte [MANUAL_TESTING_GUIDE.md → Troubleshooting](./MANUAL_TESTING_GUIDE.md#-troubleshooting)

**Para entender arquitetura**: Consulte [ARCHITECTURE.md](./ARCHITECTURE.md)

**Para rollback emergencial**: Consulte [GRANULAR_V1_README.md → Rollback](./GRANULAR_V1_README.md#️-rollback)

---

## 🎯 Resumo

- **11 arquivos criados** (módulo, schemas, testes, docs)
- **3 arquivos modificados** (core-metrics, json-output, .env.example)
- **8 documentos de suporte** (READMEs, guias, checklists)
- **100% compatível** com sistema legacy
- **Rollback instantâneo** via feature flag
- **Pronto para testes** e deploy gradual

---

**📚 Navegação organizada para máxima produtividade!**
