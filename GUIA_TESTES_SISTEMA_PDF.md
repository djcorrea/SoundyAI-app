# 🧪 GUIA DE TESTES - SISTEMA DE RELATÓRIOS PDF

**Data:** 30 de outubro de 2025  
**Sistema:** Extração Robusta de Dados para PDF  
**Status:** ✅ Implementado e pronto para testes

---

## 🎯 OBJETIVO DOS TESTES

Verificar que o sistema de relatórios PDF:
1. ✅ Usa o **score final correto** (nunca sub-scores)
2. ✅ Preenche **todas as bandas espectrais**
3. ✅ Exibe **sugestões avançadas** (priorizadas)
4. ✅ Gera **logs de auditoria completos**

---

## 📋 PRÉ-REQUISITOS

1. **Recarregar a página no navegador** (Ctrl+Shift+R)
2. **Abrir o Console** (F12 → Console)
3. **Ter um arquivo de áudio pronto** para upload

---

## 🧪 TESTE 1: CASO NORMAL (SINGLE)

### Passos:
1. Faça upload de um áudio
2. Aguarde a análise completa
3. Verifique o **Score na UI** (anote o valor)
4. Clique em **"Baixar Relatório"**
5. Observe os logs no console

### Logs Esperados:
```log
📄 [PDF-START] Iniciando geração de relatório PDF...
📋 [PDF-BUILD] Construindo dados para PDF...
🔍 [AUDIT] ============ AUDITORIA DE ESTRUTURA ============
[AUDIT] analysis keys: [...]
[AUDIT] comparison? { hasUser: false, hasRef: false, mode: 'SINGLE' }
[AUDIT] score sources: { root: 87, ... }
✅ [PDF-SCORE] Score final extraído (single): 87
[PDF-CLASSIFICATION] Profissional (score: 87)
✅ [PDF-VALIDATE] SCORE OK (diff: 0)
[PDF-BANDS] Iniciando extração de bandas...
✅ [PDF-BANDS] Bandas extraídas: { sub: -35.2, bass: -28.4, ... }
✅ [PDF-BANDS] source: bands
[PDF-SUGGESTIONS] Buscando sugestões avançadas...
✅ [PDF-SUGGESTIONS] Fonte: suggestions (8 itens)
[PDF-SUGGESTIONS] grouped: {Loudness:2, True Peak:1, ...}
✅ [PDF-BUILD] Dados construídos com sucesso
```

### Verificações no PDF Baixado:

| Item | O que verificar | ✅/❌ |
|------|----------------|------|
| **Score** | Valor idêntico à UI (±1) | |
| **Classificação** | Correspondente ao score | |
| **LUFS Integrado** | Valor numérico (não "—") | |
| **True Peak** | Valor numérico (não "—") | |
| **Dynamic Range** | Valor numérico (não "—") | |
| **Sub (20-60Hz)** | Valor numérico (não "—") | |
| **Grave (60-250Hz)** | Valor numérico (não "—") | |
| **Médio (250-4kHz)** | Valor numérico (não "—") | |
| **Agudo (4k-20kHz)** | Valor numérico (não "—") | |
| **Sugestões** | Agrupadas por categoria | |

---

## 🧪 TESTE 2: CASO COMPARAÇÃO (DALL/REFERENCE MODE)

### Passos:
1. Faça upload de **dois áudios** (modo comparação)
2. Aguarde a análise completa
3. Verifique o **Score do USUÁRIO** na UI (não da referência)
4. Clique em **"Baixar Relatório"**
5. Observe os logs no console

### Logs Esperados:
```log
🔍 [AUDIT] ============ AUDITORIA DE ESTRUTURA ============
[AUDIT] comparison? { hasUser: true, hasRef: true, mode: 'COMPARISON' }
[PDF-SCORE] Modo COMPARAÇÃO detectado
✅ [PDF-SCORE] Score do usuário extraído (comparação): 85
[PDF-CLASSIFICATION] Profissional (score: 85)
✅ [PDF-VALIDATE] SCORE OK (diff: 0)
```

### Verificações Críticas:

| Item | O que verificar | ✅/❌ |
|------|----------------|------|
| **Score** | É do **USUÁRIO** (não da referência) | |
| **Bandas** | São do **USUÁRIO** (não da referência) | |
| **Log** | Indica `mode: 'COMPARISON'` | |
| **Log** | Indica `analysis.user.score` | |

---

## 🧪 TESTE 3: VALIDAÇÃO SCORE PDF vs UI

### Passos:
1. Após análise, anote o **Score da UI**: _________
2. Baixe o relatório PDF
3. Abra o PDF e veja o **Score do PDF**: _________
4. Verifique o log `[PDF-VALIDATE]` no console

### Logs Esperados:

**Caso SUCESSO (divergência ≤ 1):**
```log
✅ [PDF-VALIDATE] SCORE OK (diff: 0)
```

**Caso DIVERGÊNCIA (diferença > 1):**
```log
🚨 [PDF-VALIDATE] DIVERGÊNCIA SCORE: { pdf: 87, ui: 85, diff: 2 }
```

### Verificações:

| Condição | Resultado Esperado | ✅/❌ |
|----------|-------------------|------|
| Score PDF == Score UI | `SCORE OK (diff: 0)` | |
| Score PDF ≈ Score UI (±1) | `SCORE OK (diff: 0.X)` | |
| Score PDF ≠ Score UI (>1) | `DIVERGÊNCIA SCORE` ⚠️ | |

---

## 🧪 TESTE 4: BANDAS ESPECTRAIS (FALLBACKS)

### Cenário A: Dados Diretos (analysis.bands)
**Log esperado:**
```log
[PDF-BANDS] Objeto bands encontrado: ['sub', 'bass', 'mid', 'high']
✅ [PDF-BANDS] Bandas extraídas: { sub: -35.2, ... }
✅ [PDF-BANDS] source: bands
```

### Cenário B: Computado do Espectro (fallback)
**Log esperado:**
```log
[PDF-BANDS] Objeto bands não encontrado, tentando fallback...
[PDF-BANDS] Tentando computar bandas do espectro...
[PDF-BANDS] Computando bandas de 2048 pontos espectrais...
✅ [PDF-BANDS] Bandas computadas: { sub: -35.2, ... }
✅ [PDF-BANDS] source: spectrum
```

### Cenário C: Extraído da UI (último fallback)
**Log esperado:**
```log
[PDF-BANDS] Espectro inválido ou ausente
[PDF-BANDS] Última tentativa: extrair bandas da UI...
✅ [PDF-BANDS] Bandas extraídas da UI: { sub: -35.2, ... }
✅ [PDF-BANDS] source: ui
```

### Verificações no PDF:

| Banda | Valor no PDF | Fonte (log) |
|-------|-------------|-------------|
| Sub (20-60Hz) | -35.2 dB | bands/spectrum/ui |
| Grave (60-250Hz) | -28.4 dB | bands/spectrum/ui |
| Médio (250-4kHz) | -25.1 dB | bands/spectrum/ui |
| Agudo (4k-20kHz) | -30.6 dB | bands/spectrum/ui |

**Regra:** NENHUMA banda deve aparecer como "—" (a menos que ausente em TODAS as fontes)

---

## 🧪 TESTE 5: SUGESTÕES AVANÇADAS vs GENÉRICAS

### Passos:
1. Após análise, verifique se há sugestões avançadas disponíveis
2. Clique em "Baixar Relatório"
3. Observe o log `[PDF-SUGGESTIONS]`

### Logs Esperados:

**Cenário A: Sugestões Avançadas Disponíveis**
```log
[PDF-SUGGESTIONS] Buscando sugestões avançadas...
✅ [PDF-SUGGESTIONS] Fonte: suggestionsAdvanced (12 itens)
[PDF-SUGGESTIONS] advanced: 12 itens
[PDF-SUGGESTIONS] grouped: {Loudness:2, True Peak:1, Espectral:3, Geral:1}
```

**Cenário B: Fallback para Genéricas**
```log
[PDF-SUGGESTIONS] Buscando sugestões avançadas...
✅ [PDF-SUGGESTIONS] Fonte: suggestions (fallback) (8 itens)
[PDF-SUGGESTIONS] advanced: 8 itens
[PDF-SUGGESTIONS] grouped: {Loudness:2, Geral:6}
```

### Verificações no PDF:

| Item | O que verificar | ✅/❌ |
|------|----------------|------|
| **Sugestões presentes** | Pelo menos 1 sugestão | |
| **Agrupadas por categoria** | Seções separadas (Loudness, True Peak, etc.) | |
| **Conteúdo detalhado** | Texto explicativo (não genérico) | |
| **Log indica fonte** | `suggestionsAdvanced` ou `suggestions` | |

---

## 🧪 TESTE 6: AUDITORIA COMPLETA

### Passos:
1. Limpe o console (botão 🗑️)
2. Clique em "Baixar Relatório"
3. Copie TODOS os logs do console
4. Verifique se contém todos os blocos abaixo

### Checklist de Logs Obrigatórios:

- [ ] `[AUDIT] ============ AUDITORIA DE ESTRUTURA ============`
- [ ] `[AUDIT] analysis keys:`
- [ ] `[AUDIT] comparison?`
- [ ] `[AUDIT] score sources:`
- [ ] `[AUDIT] spectral bands sources:`
- [ ] `[AUDIT] suggestions sources:`
- [ ] `[PDF-SCORE]` (extração de score)
- [ ] `[PDF-CLASSIFICATION]`
- [ ] `[PDF-VALIDATE]` (validação contra UI)
- [ ] `[PDF-BANDS]` (extração de bandas)
- [ ] `[PDF-SUGGESTIONS]` (extração de sugestões)
- [ ] `[PDF-BUILD]` (construção de dados)
- [ ] `[PDF-RENDER]` (renderização)
- [ ] `[PDF-SUCCESS]` (sucesso final)

---

## 🔍 PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: Score do PDF diferente da UI
**Log esperado:**
```log
🚨 [PDF-VALIDATE] DIVERGÊNCIA SCORE: { pdf: 87, ui: 85, diff: 2 }
```

**Causas possíveis:**
- UI mostra sub-score (não score final)
- Cache antigo no navegador
- Modo comparação pegando score da referência

**Solução:**
- Verificar log `[PDF-SCORE]` para ver fonte usada
- Recarregar página (Ctrl+Shift+R)
- Verificar se não é modo comparação

### Problema 2: Bandas aparecem como "—"
**Log esperado:**
```log
⚠️ [PDF-BANDS] Nenhuma fonte de bandas disponível!
```

**Causas possíveis:**
- Análise não calculou bandas espectrais
- Espectro FFT ausente
- UI não renderizou bandas

**Solução:**
- Verificar se UI mostra bandas
- Re-fazer análise
- Verificar arquivo de áudio (pode estar corrompido)

### Problema 3: Nenhuma sugestão aparece
**Log esperado:**
```log
⚠️ [PDF-SUGGESTIONS] Nenhuma sugestão encontrada
```

**Causas possíveis:**
- Análise perfeita (score > 95)
- Sistema de sugestões desabilitado
- Análise incompleta

**Solução:**
- Verificar se UI mostra sugestões
- Re-fazer análise
- Score muito alto pode não gerar sugestões

### Problema 4: Erro ao gerar PDF
**Log esperado:**
```log
❌ [PDF-ERROR] Erro ao gerar relatório: ...
```

**Causas possíveis:**
- jsPDF ou html2canvas não carregados
- Container não encontrado
- Dados inválidos

**Solução:**
- Aguardar 1 segundo e tentar novamente
- Recarregar página
- Verificar console para erro específico

---

## ✅ CRITÉRIOS DE SUCESSO GERAL

Para considerar o sistema **FUNCIONAL**, os seguintes critérios devem ser atendidos:

### Obrigatórios (todos devem passar):
- [x] Score PDF == Score UI (±1)
- [x] Bandas espectrais preenchidas (não "—")
- [x] Sugestões presentes no PDF
- [x] Logs de auditoria completos no console

### Desejáveis (pelo menos 3 devem passar):
- [ ] Modo comparação extrai score do usuário
- [ ] Bandas usam fonte `bands` (não fallback)
- [ ] Sugestões são avançadas (não genéricas)
- [ ] Validação score não indica divergência
- [ ] Sugestões agrupadas por categoria

---

## 📊 TEMPLATE DE RELATÓRIO DE TESTES

```markdown
# Relatório de Testes - Sistema de Relatórios PDF
Data: _______________
Testador: _______________

## Teste 1: Caso Normal
- [ ] Score PDF: _____ | Score UI: _____ | Diff: _____
- [ ] Bandas preenchidas: Sim / Não
- [ ] Sugestões presentes: Sim / Não
- [ ] Logs completos: Sim / Não

## Teste 2: Caso Comparação (se aplicável)
- [ ] Score do usuário (não referência): Sim / Não
- [ ] Log indica modo COMPARISON: Sim / Não

## Teste 3: Validação Score
- [ ] Divergência: _____ (deve ser ≤ 1)
- [ ] Log de validação: OK / DIVERGÊNCIA

## Teste 4: Bandas Espectrais
- [ ] Sub: _____ dB | Fonte: _____
- [ ] Grave: _____ dB | Fonte: _____
- [ ] Médio: _____ dB | Fonte: _____
- [ ] Agudo: _____ dB | Fonte: _____

## Teste 5: Sugestões
- [ ] Quantidade: _____
- [ ] Fonte: suggestionsAdvanced / suggestions
- [ ] Agrupadas: Sim / Não

## Teste 6: Auditoria
- [ ] Todos os logs obrigatórios presentes: Sim / Não

## Conclusão:
Sistema FUNCIONAL: Sim / Não
Observações:
_____________________________________
_____________________________________
```

---

## 🎉 FIM DO GUIA DE TESTES

**Próxima ação:** Executar os testes no navegador seguindo este guia.

**Em caso de falha:** Copie os logs do console e reporte o problema específico.

**Em caso de sucesso:** ✅ Sistema validado e pronto para produção!
