# 🧪 INSTRUÇÕES DE TESTE - CORREÇÃO DE GÊNERO

## 🎯 Objetivo

Validar que o gênero detectado pelo backend está sendo corretamente utilizado em todo o fluxo, sem fallback indevido para 'techno'.

---

## 📋 Pré-requisitos

1. Sistema SoundyAI rodando
2. Console do navegador aberto (F12)
3. Arquivo de áudio de teste (preferencialmente de gênero diferente de 'techno')

---

## 🧪 Teste 1: Análise de Áudio com Gênero Específico

### Passos:

1. Abra o SoundyAI no navegador
2. Selecione um gênero específico no dropdown (ex: "Funk Mandela")
3. Faça upload de um arquivo de áudio
4. Aguarde a análise completar

### Logs Esperados:

```javascript
🎯 GÊNERO FINAL DETECTADO: funk_mandela
🔍 [updateReferenceSuggestions] Gênero ANTES: funk_mandela
✅ [updateReferenceSuggestions] Gênero preservado corretamente
🔍 [displayModalResults] Gênero NO INÍCIO: funk_mandela
```

### ✅ Critério de Sucesso:

- Todos os logs mostram o mesmo gênero
- Nenhum log de `⚠️ Atenção: gênero foi sobrescrito para techno`
- Sugestões são coerentes com o gênero selecionado

---

## 🧪 Teste 2: Validação Automática

### Passos:

1. Após a análise do Teste 1, abra o console
2. Execute: `window.validateGenreFlow()`

### Resultado Esperado:

```javascript
🔍 ===== VALIDAÇÃO DE FLUXO DE GÊNERO =====

📊 Resumo da Validação:
  ✅ Passou: 3
  ❌ Falhou: 0
  ⚠️  Avisos: 0
  📈 Taxa de Sucesso: 100%

📋 Detalhes dos Testes:
  ✅ 1. currentModalAnalysis.genre existe
     → Valor: funk_mandela
  ✅ 2. Gênero não é techno por fallback
  ✅ 3. Consistência genre vs PROD_AI_REF_GENRE

🔍 Estado Atual:
  - currentModalAnalysis.genre: funk_mandela
  - window.PROD_AI_REF_GENRE: funk_mandela
  - __activeRefGenre: funk_mandela

🔍 ===== FIM DA VALIDAÇÃO =====
```

### ✅ Critério de Sucesso:

- Taxa de Sucesso: 100%
- Falhou: 0
- Avisos: 0

---

## 🧪 Teste 3: Detecção de Fallback Indevido

### Cenário de Teste:

Simular situação onde backend NÃO retorna gênero, mas sistema usa gênero do dropdown.

### Passos:

1. Selecione gênero "Trance" no dropdown
2. Faça upload de um áudio sem gênero detectado pelo backend
3. Verifique logs

### Logs Esperados:

```javascript
🎯 GÊNERO FINAL DETECTADO: trance  // Usa gênero do dropdown
```

**NÃO deve aparecer:**
```javascript
⚠️ Atenção: gênero foi sobrescrito para techno
```

### ✅ Critério de Sucesso:

- Sistema usa gênero do dropdown (window.PROD_AI_REF_GENRE)
- Não usa 'techno' como fallback
- Sugestões são baseadas no gênero do dropdown

---

## 🧪 Teste 4: Mudança Manual de Gênero Após Análise

### Passos:

1. Faça análise de um áudio (qualquer gênero)
2. Após resultados aparecerem, troque o gênero no dropdown
3. Observe que sugestões são recalculadas
4. Execute `window.validateGenreFlow()`

### Resultado Esperado:

```javascript
🔍 [updateReferenceSuggestions] Gênero ANTES: novo_genero_selecionado
✅ [updateReferenceSuggestions] Gênero preservado corretamente
```

### ✅ Critério de Sucesso:

- Sugestões são recalculadas para novo gênero
- Gênero não é sobrescrito para 'techno'
- Validação mostra 100% de sucesso

---

## 🧪 Teste 5: Análise de Múltiplos Áudios

### Passos:

1. Faça análise de áudio gênero A (ex: Funk Mandela)
2. Feche modal de resultados
3. Faça análise de áudio gênero B (ex: Trance)
4. Compare logs de ambas análises

### Logs Esperados:

**Análise 1:**
```javascript
🎯 GÊNERO FINAL DETECTADO: funk_mandela
```

**Análise 2:**
```javascript
🎯 GÊNERO FINAL DETECTADO: trance
```

### ✅ Critério de Sucesso:

- Cada análise usa seu próprio gênero
- Sem contaminação entre análises
- Sem fallback para 'techno' em nenhuma

---

## 🐛 Cenários de Falha a Verificar

### Cenário 1: Fallback Indevido

**Sintoma:**
```javascript
⚠️ Atenção: gênero foi sobrescrito para techno — verifique fluxo.
⚠️ Backend retornou: funk_mandela | Mas ficou: techno
```

**Ação:**
- ❌ FALHA CRÍTICA
- Reportar imediatamente
- Sistema ainda tem bug de sobrescrição

### Cenário 2: Gênero Indefinido

**Sintoma:**
```javascript
currentModalAnalysis.genre: undefined
```

**Ação:**
- ❌ FALHA CRÍTICA
- Backend não está retornando gênero
- Verificar API

### Cenário 3: Inconsistência

**Sintoma:**
```javascript
Inconsistência: analysis.genre='funk_mandela' vs window='trance'
```

**Ação:**
- ⚠️ AVISO (não é erro crítico)
- analysis.genre deve ter prioridade
- Verificar se sugestões usam analysis.genre

---

## 📊 Checklist de Validação

Após todos os testes, marque:

- [ ] Teste 1: Análise com gênero específico - ✅ PASSOU
- [ ] Teste 2: Validação automática - ✅ 100%
- [ ] Teste 3: Fallback controlado - ✅ PASSOU
- [ ] Teste 4: Mudança manual de gênero - ✅ PASSOU
- [ ] Teste 5: Múltiplos áudios - ✅ PASSOU
- [ ] Nenhum log de `⚠️ sobrescrito para techno`
- [ ] Sugestões coerentes com gênero detectado
- [ ] UI exibe informações corretas

---

## 🆘 Em Caso de Problemas

1. **Copie todos os logs do console**
2. **Execute `window.validateGenreFlow()` e copie resultado**
3. **Tire screenshot dos resultados da análise**
4. **Reporte com as informações acima**

---

## ✅ Critério Geral de Sucesso

**Sistema está funcionando corretamente se:**

1. ✅ Gênero detectado é sempre usado
2. ✅ 'techno' só aparece se NENHUM gênero foi detectado
3. ✅ Guards de segurança não acionam
4. ✅ Validação automática mostra 100%
5. ✅ Sugestões são coerentes com o gênero

---

**Documentação:** ✅ COMPLETA  
**Testes:** ⏳ AGUARDANDO EXECUÇÃO  
**Suporte:** Disponível via logs e validação automática

**Boa sorte com os testes! 🚀**
