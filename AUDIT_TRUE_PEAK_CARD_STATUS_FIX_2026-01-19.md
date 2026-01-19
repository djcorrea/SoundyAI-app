# 🔍 AUDITORIA COMPLETA - STATUS VISUAL TRUE PEAK (CARDS PRINCIPAIS)
**Data:** 19 de janeiro de 2026  
**Escopo:** Lógica de exibição do status textual/visual do True Peak nos cards principais  
**Objetivo:** Remover mensagens positivas ("EXCELENTE", "IDEAL", etc) e exibir apenas o valor numérico quando TP ≤ 0 dBTP

---

## 📋 CONTEXTO DO PROBLEMA

### ❌ Problema Identificado
No **card principal** de True Peak:
- Quando o valor é negativo (ex: -7.3 dBTP), o sistema exibe o texto **"EXCELENTE"**
- Isso é incorreto para a proposta do produto e gera ruído visual
- A **tabela e o score** já penalizam corretamente valores muito baixos
- O card não deve contradizer nem "elogiar" automaticamente

### ✅ Comportamento Desejado

#### Se True Peak > 0 dBTP
- Exibir aviso visual de erro:
  - Texto: **"ESTOURADO"** ou **"CLIPANDO"**
  - Indicador visual: ponto vermelho / estado crítico
  - Aviso claro e chamativo

#### Se True Peak ≤ 0 dBTP
- **NÃO exibir nenhum texto de status** (remover "EXCELENTE", "IDEAL", "OK", etc)
- **Exibir somente o valor numérico** do Pico Real (dBTP)
- Sem ícones, sem rótulos, sem mensagens positivas

### 📝 Resumo
✔ Card só avisa quando está estourado  
❌ Card não elogia quando está negativo

---

## 🔍 AUDITORIA DO CÓDIGO

### 🎯 Função Identificada
**Arquivo:** `public/audio-analyzer-integration.js`  
**Linha:** 17672-17679  
**Função:** `getTruePeakStatus(value)`

#### Código Atual (ANTES):
```javascript
// 🎯 FUNÇÃO DE STATUS DO TRUE PEAK (CORREÇÃO CRÍTICA)
const getTruePeakStatus = (value) => {
    if (!Number.isFinite(value)) return { status: '—', class: '' };
    
    if (value <= -1.5) return { status: 'EXCELENTE', class: 'status-excellent' };
    if (value <= -1.0) return { status: 'IDEAL', class: 'status-ideal' };
    if (value <= -0.5) return { status: 'BOM', class: 'status-good' };
    if (value <= 0.0) return { status: 'ACEITÁVEL', class: 'status-warning' };
    return { status: 'ESTOURADO', class: 'status-critical' };
};
```

### 🔧 Uso da Função

#### Linha 17730 - Sample Peak (dBFS)
```javascript
const spStatus = getTruePeakStatus(samplePeakDbfs);
console.log('✅ [RENDER] Sample Peak (dBFS) =', samplePeakDbfs, 'dBFS');
return row('Sample Peak (dBFS)', `${safeFixed(samplePeakDbfs, 1)} dBFS <span class="${spStatus.class}">${spStatus.status}</span>`, 'samplePeak', 'samplePeak', 'primary');
```

#### Linha 17752 - True Peak (dBTP)
```javascript
const tpStatus = getTruePeakStatus(tpValue);
console.log('✅ [RENDER] Pico Real (dBTP) =', tpValue, 'dBTP');
return row('Pico Real (dBTP)', `${safeFixed(tpValue, 2)} dBTP <span class="${tpStatus.class}">${tpStatus.status}</span>`, 'truePeakDbtp', 'truePeakDbtp', 'primary');
```

### ⚠️ Divergência Identificada

**IMPORTANTE:** A função `getTruePeakStatus()` é usada em **dois lugares**:

1. **Sample Peak (dBFS)** - linha 17730
2. **True Peak (dBTP)** - linha 17752

**PROBLEMA:** O usuário menciona "card principal", mas essa função é usada na **tabela de métricas** (função `row()`), não em um card visual separado.

**HIPÓTESE:** 
- Pode haver **outra lógica de renderização** de cards que não foi localizada ainda
- OU a tabela de métricas **É** o "card principal" mencionado pelo usuário

---

## 🛠️ PROPOSTA DE CORREÇÃO

### ✅ Solução Proposta

Refatorar a função `getTruePeakStatus()` para:

1. **Manter status positivos apenas para a tabela** (se necessário para Sample Peak)
2. **Criar função específica** para True Peak nos cards que:
   - Retorna status vazio (`''`) quando TP ≤ 0 dBTP
   - Retorna `'ESTOURADO'` quando TP > 0 dBTP

### 📦 Implementação

#### Opção 1: Nova Função para Cards (Recomendado)
```javascript
// 🎯 FUNÇÃO DE STATUS DO TRUE PEAK PARA CARDS PRINCIPAIS
// Apenas alerta quando está clipando, não elogia quando está negativo
const getTruePeakCardStatus = (value) => {
    if (!Number.isFinite(value)) return { status: '', class: '' };
    
    // Se estourado (clipando), exibir alerta crítico
    if (value > 0.0) return { status: 'ESTOURADO', class: 'status-critical' };
    
    // Se negativo, não exibir status (apenas valor numérico)
    return { status: '', class: '' };
};

// 🎯 FUNÇÃO DE STATUS DO TRUE PEAK PARA TABELA (mantém lógica original se necessário)
const getTruePeakTableStatus = (value) => {
    if (!Number.isFinite(value)) return { status: '—', class: '' };
    
    if (value <= -1.5) return { status: 'EXCELENTE', class: 'status-excellent' };
    if (value <= -1.0) return { status: 'IDEAL', class: 'status-ideal' };
    if (value <= -0.5) return { status: 'BOM', class: 'status-good' };
    if (value <= 0.0) return { status: 'ACEITÁVEL', class: 'status-warning' };
    return { status: 'ESTOURADO', class: 'status-critical' };
};
```

#### Opção 2: Refatorar Função Existente (Mais Simples)
```javascript
// 🎯 FUNÇÃO DE STATUS DO TRUE PEAK (REFATORADA - APENAS ALERTA CLIPPING)
const getTruePeakStatus = (value) => {
    if (!Number.isFinite(value)) return { status: '', class: '' };
    
    // Apenas alerta quando está clipando (> 0 dBTP)
    if (value > 0.0) return { status: 'ESTOURADO', class: 'status-critical' };
    
    // Para valores negativos, não exibir status (apenas valor numérico)
    return { status: '', class: '' };
};
```

### 🔄 Alterações Necessárias

#### Caso 1: Se usar Opção 1 (duas funções)
**Linha 17752** - True Peak na tabela:
```javascript
// ANTES:
const tpStatus = getTruePeakStatus(tpValue);

// DEPOIS:
const tpStatus = getTruePeakCardStatus(tpValue); // Usa versão sem status positivo
```

**Linha 17730** - Sample Peak (mantém original se necessário):
```javascript
const spStatus = getTruePeakTableStatus(samplePeakDbfs); // Mantém status detalhado
```

#### Caso 2: Se usar Opção 2 (refatorar função existente)
**Linha 17672-17679** - Substituir toda a função `getTruePeakStatus`:
```javascript
const getTruePeakStatus = (value) => {
    if (!Number.isFinite(value)) return { status: '', class: '' };
    if (value > 0.0) return { status: 'ESTOURADO', class: 'status-critical' };
    return { status: '', class: '' };
};
```

---

## 🧪 CASOS DE VALIDAÇÃO

| Valor True Peak | Status Esperado | Indicador Visual |
|-----------------|----------------|------------------|
| -7.3 dBTP       | (vazio)        | Apenas valor numérico |
| -1.0 dBTP       | (vazio)        | Apenas valor numérico |
| -0.5 dBTP       | (vazio)        | Apenas valor numérico |
| -0.1 dBTP       | (vazio)        | Apenas valor numérico |
| +0.0 dBTP       | (vazio ou ESTOURADO) | Depende da interpretação |
| +0.2 dBTP       | ESTOURADO      | 🔴 Ponto vermelho + texto crítico |
| +1.5 dBTP       | ESTOURADO      | 🔴 Ponto vermelho + texto crítico |

---

## ⚠️ IMPACTOS E VERIFICAÇÕES

### ✅ O que NÃO deve mudar:
- Targets de True Peak
- Tolerâncias
- Severidade na tabela
- Score e subscore
- Lógica da tabela
- Regras de outros cards (LUFS, DR, etc.)

### ✅ O que DEVE mudar:
- Apenas a renderização/label/status do True Peak nos cards principais
- Remover "EXCELENTE", "IDEAL", "BOM", "ACEITÁVEL" quando TP ≤ 0
- Manter "ESTOURADO" quando TP > 0

### 🔍 Verificações Pós-Implementação:
1. ✅ True Peak -7.3 dBTP → card mostra apenas o valor (sem "EXCELENTE")
2. ✅ True Peak -1.0 dBTP → card mostra apenas o valor (sem "IDEAL")
3. ✅ True Peak +0.2 dBTP → card mostra "ESTOURADO" + indicador vermelho
4. ✅ Score e tabela continuam funcionando corretamente
5. ✅ Outros cards (LUFS, DR) não foram afetados
6. ✅ Sample Peak (dBFS) não foi afetado (se for mantido com status detalhado)

---

## 📌 NOTA IMPORTANTE

**DÚVIDA TÉCNICA:** Não localizei cards visuais separados da tabela no código.

**Hipóteses:**
1. A função `row()` renderiza cards (não apenas linhas de tabela)
2. Existe outro arquivo que renderiza cards principais (não encontrado)
3. O usuário se refere à **linha da tabela** como "card principal"

**PRÓXIMO PASSO:** 
- Confirmar com o usuário onde exatamente está o "card principal" que exibe "EXCELENTE"
- Verificar se a correção deve ser aplicada apenas na tabela ou em outro local
- Aplicar correção no(s) local(is) correto(s)

---

## 🎯 RESULTADO ESPERADO

Após a correção:
- ✅ Card principal fica limpo, profissional e coerente
- ✅ Sistema só alerta quando realmente há clipping (TP > 0)
- ✅ Nenhuma contradição visual com tabela ou score
- ✅ UX mais alinhado com a proposta: som forte, sem distorção
- ✅ Valores negativos exibem apenas o número (ex: "-1.2 dBTP")
- ✅ Valores positivos exibem alerta crítico (ex: "+0.5 dBTP 🔴 ESTOURADO")
