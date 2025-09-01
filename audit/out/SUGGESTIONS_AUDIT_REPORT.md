# 💡 AUDITORIA DO SISTEMA DE SUGESTÕES

**Run ID:** `suggestions_audit_1756091512632_462`  
**Timestamp:** 2025-08-25T03:11:52.655Z  
**Regras Mapeadas:** 51  
**Casos Testados:** 9  
**Cobertura:** 9/9 (100.0%)  
**Utilidade Média:** 50.0/100  

## 📊 RESUMO EXECUTIVO

### ✅ Pontos Fortes
- Sistema de sugestões existe e está implementado
- Boa cobertura geral (100.0%)

### 🚨 Problemas Identificados
- Sugestões pouco específicas (faltam detalhes técnicos)

## 📈 COBERTURA POR CATEGORIA

- **loudness**: 2/2 casos (100.0%)
- **peak**: 1/1 casos (100.0%)
- **dynamics**: 2/2 casos (100.0%)
- **stereo**: 2/2 casos (100.0%)
- **spectral**: 2/2 casos (100.0%)

## 🎯 ANÁLISE DE UTILIDADE


### ⚠️ LUFS Alto - 49/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 0/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 70/100 (peso: 20%)

### ⚠️ LUFS Baixo - 49/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 0/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 70/100 (peso: 20%)

### ⚠️ True Peak Alto - 49/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 0/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 70/100 (peso: 20%)

### ⚠️ DR Baixo - 49/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 0/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 70/100 (peso: 20%)

### ⚠️ DR Alto - 49/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 0/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 70/100 (peso: 20%)

### ⚠️ Estéreo Muito Largo - 51/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 0/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 80/100 (peso: 20%)

### ⚠️ Estéreo Muito Estreito - 56/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 20/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 80/100 (peso: 20%)

### ⚠️ Graves Excessivos - 49/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 0/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 70/100 (peso: 20%)

### ⚠️ Agudos Fracos - 49/100 (Regular)

- **Cobertura:** 100/100 (peso: 30%)
- **Especificidade:** 0/100 (peso: 25%)
- **Acionabilidade:** 20/100 (peso: 25%)
- **Clareza:** 70/100 (peso: 20%)


## 📋 MAPEAMENTO DE REGRAS

### Regras Encontradas por Arquivo
- `public/audio-analyzer-integration.js`: 50 regras
- `lib/audio/features/scoring.js`: 1 regras

### Tipos de Regras
- **Diretas:** 49 regras
- **Condicionais:** 2 regras  
- **Comparações:** 0 regras

## 🔍 CASOS DE TESTE DETALHADOS


### ✅ LUFS Alto
**Categoria:** loudness | **Severidade:** alta  
**Cobertura:** 10 sugestões encontradas  
**Utilidade:** 49/100 (Regular)  

**Métricas de Teste:**
- lufsIntegrated: -6

**Sugestões Encontradas:**
- reference_loudness_blocked_clipping (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_headroom (fonte: public/audio-analyzer-integration.js)
- reference_loudness_conservative (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Loudness difference: (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_clipping (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_headroom (fonte: public/audio-analyzer-integration.js)
- reference_loudness_conservative (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Sugestão de loudness processada com headroom check (fonte: public/audio-analyzer-integration.js)
- Sugestão condicional (fonte: public/audio-analyzer-integration.js)
- Sugestão condicional (fonte: public/audio-analyzer-integration.js)

### ✅ LUFS Baixo
**Categoria:** loudness | **Severidade:** alta  
**Cobertura:** 10 sugestões encontradas  
**Utilidade:** 49/100 (Regular)  

**Métricas de Teste:**
- lufsIntegrated: -25

**Sugestões Encontradas:**
- reference_loudness_blocked_clipping (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_headroom (fonte: public/audio-analyzer-integration.js)
- reference_loudness_conservative (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Loudness difference: (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_clipping (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_headroom (fonte: public/audio-analyzer-integration.js)
- reference_loudness_conservative (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Sugestão de loudness processada com headroom check (fonte: public/audio-analyzer-integration.js)
- Sugestão condicional (fonte: public/audio-analyzer-integration.js)
- Sugestão condicional (fonte: public/audio-analyzer-integration.js)

### ✅ True Peak Alto
**Categoria:** peak | **Severidade:** critica  
**Cobertura:** 2 sugestões encontradas  
**Utilidade:** 49/100 (Regular)  

**Métricas de Teste:**
- truePeakDbtp: 0.5

**Sugestões Encontradas:**
- reference_loudness_blocked_clipping (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_clipping (fonte: public/audio-analyzer-integration.js)

### ✅ DR Baixo
**Categoria:** dynamics | **Severidade:** media  
**Cobertura:** 7 sugestões encontradas  
**Utilidade:** 49/100 (Regular)  

**Métricas de Teste:**
- dynamicRange: 3

**Sugestões Encontradas:**
- reference_loudness_blocked_headroom (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Loudness difference: (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_headroom (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Sugestão de loudness processada com headroom check (fonte: public/audio-analyzer-integration.js)
- audioAnalysisResults (fonte: public/audio-analyzer-integration.js)
- Sugestão condicional (fonte: public/audio-analyzer-integration.js)
- Sugestão condicional (fonte: public/audio-analyzer-integration.js)

### ✅ DR Alto
**Categoria:** dynamics | **Severidade:** media  
**Cobertura:** 7 sugestões encontradas  
**Utilidade:** 49/100 (Regular)  

**Métricas de Teste:**
- dynamicRange: 25

**Sugestões Encontradas:**
- reference_loudness_blocked_headroom (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Loudness difference: (fonte: public/audio-analyzer-integration.js)
- reference_loudness_blocked_headroom (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Sugestão de loudness processada com headroom check (fonte: public/audio-analyzer-integration.js)
- audioAnalysisResults (fonte: public/audio-analyzer-integration.js)
- Sugestão condicional (fonte: public/audio-analyzer-integration.js)
- Sugestão condicional (fonte: public/audio-analyzer-integration.js)

### ✅ Estéreo Muito Largo
**Categoria:** stereo | **Severidade:** media  
**Cobertura:** 1 sugestões encontradas  
**Utilidade:** 51/100 (Regular)  

**Métricas de Teste:**
- stereoCorrelation: -0.2

**Sugestões Encontradas:**
- Imagem estéreo fora do padrão. Ajuste o posicionamento dos elementos ou use ferramentas de widening. (fonte: system_default)

### ✅ Estéreo Muito Estreito
**Categoria:** stereo | **Severidade:** baixa  
**Cobertura:** 1 sugestões encontradas  
**Utilidade:** 56/100 (Regular)  

**Métricas de Teste:**
- stereoCorrelation: 0.95

**Sugestões Encontradas:**
- Pequeno desvio na imagem estéreo. Monitore em diferentes sistemas de reprodução. (fonte: system_default)

### ✅ Graves Excessivos
**Categoria:** spectral | **Severidade:** media  
**Cobertura:** 2 sugestões encontradas  
**Utilidade:** 49/100 (Regular)  

**Métricas de Teste:**
- bandEnergies: [object Object]

**Sugestões Encontradas:**
- positive_targets_vs_negative_measurements (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Total sugestões geradas: (fonte: public/audio-analyzer-integration.js)

### ✅ Agudos Fracos
**Categoria:** spectral | **Severidade:** media  
**Cobertura:** 2 sugestões encontradas  
**Utilidade:** 49/100 (Regular)  

**Métricas de Teste:**
- bandEnergies: [object Object]

**Sugestões Encontradas:**
- positive_targets_vs_negative_measurements (fonte: public/audio-analyzer-integration.js)
- 🔍 [DIAGNÓSTICO] Total sugestões geradas: (fonte: public/audio-analyzer-integration.js)


## 📝 RECOMENDAÇÕES

### Prioridade Alta (P0)
- Sistema funcional - focar em melhorias de qualidade

### Prioridade Média (P1)
- Aumentar especificidade das sugestões (mencionar ferramentas, valores específicos)
- Adicionar exemplos práticos e workflows para cada tipo de ajuste
- Implementar sistema de priorização de sugestões por impacto
- Criar sugestões contextuais baseadas no gênero musical

### Prioridade Baixa (P2)
- Adicionar links para tutoriais ou documentação
- Implementar sistema de feedback do usuário sobre utilidade
- Criar sugestões progressivas (iniciante vs. avançado)
- Internacionalização das mensagens de sugestão

---

**Próximos Passos:**
1. Implementar sugestões faltantes para categorias sem cobertura
2. Melhorar especificidade das sugestões existentes
3. Adicionar exemplos práticos e valores específicos
4. Testar com produtores reais para validar utilidade
