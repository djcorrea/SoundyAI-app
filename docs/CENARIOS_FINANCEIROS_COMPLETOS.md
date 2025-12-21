# 📊 CENÁRIOS FINANCEIROS DETALHADOS — SoundyAI
**Matriz 3×4: Níveis de Engajamento × Escalas de Usuários**

📅 **Data**: 21 de dezembro de 2025  
🔗 **Documento Principal**: [`AUDITORIA_CUSTOS_UNIT_ECONOMICS.md`](AUDITORIA_CUSTOS_UNIT_ECONOMICS.md)  
⚠️ **Status**: ESTIMATIVAS baseadas em análise de código (sem telemetria)

---

## 🎯 METODOLOGIA

### Níveis de Engajamento (3 Cenários)

| Cenário | DAU/MAU | Msgs/User/Dia | Análises/User/Mês | % Imagens | % Uso IA |
|---------|---------|---------------|-------------------|-----------|----------|
| **Conservador** | 20% | 0.5 | 2 | 15% | 60% |
| **Base** | 30% | 1.0 | 5 | 10% | 80% |
| **Agressivo** | 40% | 1.5 | 8 | 5% | 100% |

### Escalas de Usuários (4 Fases)

- **100 usuários** — MVP / Early Adopters
- **1.000 usuários** — Product-Market Fit
- **5.000 usuários** — Growth Phase
- **10.000 usuários** — Scale-up

### Distribuição de Planos

| Escala | Free | Plus ($25/mês) | Pro ($75/mês) | Lógica |
|--------|------|----------------|---------------|--------|
| 100 | 60% | 30% | 10% | Early adopters pagam mais |
| 1.000 | 50% | 35% | 15% | PMF estabelecido |
| 5.000 | 45% | 35% | 20% | Escala com mais PRO |
| 10.000 | 40% | 35% | 25% | Maturidade do produto |

### Custos Unitários (Referência)

- **Chat texto** (GPT-3.5): $0.0009/msg
- **Chat imagem** (GPT-4o): $0.0080/msg
- **Análise IA** (GPT-4o-mini): $0.0013/análise
- **Infra (Railway)**: $20-100/mês (escala com CPU)
- **Storage (B2)**: $0.005/GB/mês + $0.01/GB download

---

## 📈 ESCALA 1: 100 USUÁRIOS (MVP)

**Distribuição**: 60 Free / 30 Plus / 10 Pro

### Cenário Conservador (Baixo Engajamento)

**Engajamento**:
- DAU: 20 usuários/dia (20% de 100)
- Mensagens: 10/dia = 300/mês
- Análises: 200/mês (2 por usuário)
- Imagens: 45 msgs/mês (15%)

**Custos OpenAI**:
```
Chat texto (255 msgs):     255 × $0.0009 = $0.23
Chat imagens (45 msgs):     45 × $0.0080 = $0.36
Análises IA (160):         160 × $0.0013 = $0.21
─────────────────────────────────────────────
TOTAL OpenAI:                           $0.80/mês
```

**Custos Totais**:
```
OpenAI:      $0.80
Railway:     $20.00
Storage B2:  $0.50
─────────────
TOTAL:       $21.30/mês
```

**Receita**:
```
Free (60):       $0
Plus (30):   $750
Pro (10):    $750
─────────────
TOTAL:     $1,500/mês
```

**Resultado**:
- **Margem Bruta**: $1,478.70 **(98.6%)**
- **Breakeven**: ~2 usuários pagantes
- **MRR**: $1,500
- **Custo/User Pagante**: $0.53

---

### Cenário Base (Engajamento Médio)

**Engajamento**:
- DAU: 30 usuários/dia
- Mensagens: 900/mês
- Análises: 500/mês
- Imagens: 90 msgs/mês (10%)

**Custos OpenAI**: $1.97/mês  
**Custos Totais**: $22.47/mês  
**Receita**: $1,500/mês  
**Margem Bruta**: $1,477.53 **(98.5%)**

---

### Cenário Agressivo (Alto Engajamento)

**Engajamento**:
- DAU: 40 usuários/dia
- Mensagens: 1,800/mês
- Análises: 800/mês
- Imagens: 90 msgs/mês (5%)

**Custos OpenAI**: $3.30/mês  
**Custos Totais**: $23.80/mês  
**Receita**: $1,500/mês  
**Margem Bruta**: $1,476.20 **(98.4%)**

---

## 📈 ESCALA 2: 1.000 USUÁRIOS (PRODUCT-MARKET FIT)

**Distribuição**: 500 Free / 350 Plus / 150 Pro

### Cenário Conservador

**Engajamento**:
- DAU: 200 usuários/dia
- Mensagens: 3,000/mês
- Análises: 2,000/mês
- Imagens: 450 msgs/mês

**Custos OpenAI**:
```
Chat texto (2,550):      2,550 × $0.0009 = $2.30
Chat imagens (450):        450 × $0.0080 = $3.60
Análises IA (1,600):     1,600 × $0.0013 = $2.08
────────────────────────────────────────────
TOTAL OpenAI:                          $7.98/mês
```

**Custos Totais**:
```
OpenAI:      $7.98
Railway:     $25.00
Storage:     $2.50
─────────────
TOTAL:       $35.48/mês
```

**Receita**:
```
Plus (350):  $8,750
Pro (150):   $11,250
─────────────
TOTAL:       $20,000/mês
```

**Resultado**:
- **Margem Bruta**: $19,964.52 **(99.8%)**
- **MRR**: $20,000
- **Custo/User Pagante**: $0.071

---

### Cenário Base

**Custos OpenAI**: $19.70/mês  
**Custos Totais**: $47.20/mês  
**Receita**: $20,000/mês  
**Margem Bruta**: $19,952.80 **(99.8%)**

---

### Cenário Agressivo

**Custos OpenAI**: $33.00/mês  
**Custos Totais**: $60.50/mês  
**Receita**: $20,000/mês  
**Margem Bruta**: $19,939.50 **(99.7%)**

---

## 📈 ESCALA 3: 5.000 USUÁRIOS (GROWTH PHASE)

**Distribuição**: 2,250 Free / 1,750 Plus / 1,000 Pro

### Cenário Conservador

**Engajamento**:
- DAU: 1,000 usuários/dia
- Mensagens: 15,000/mês
- Análises: 10,000/mês
- Imagens: 2,250 msgs/mês

**Custos OpenAI**:
```
Chat texto (12,750):    12,750 × $0.0009 = $11.48
Chat imagens (2,250):    2,250 × $0.0080 = $18.00
Análises IA (8,000):     8,000 × $0.0013 = $10.40
────────────────────────────────────────────
TOTAL OpenAI:                         $39.88/mês
```

**Custos Totais**:
```
OpenAI:      $39.88
Railway:     $50.00
Storage:     $12.00
─────────────
TOTAL:       $101.88/mês
```

**Receita**:
```
Plus (1,750):  $43,750
Pro (1,000):   $75,000
─────────────
TOTAL:         $118,750/mês
```

**Resultado**:
- **Margem Bruta**: $118,648.12 **(99.9%)**
- **MRR**: $118,750
- **ARR**: $1,425,000
- **Custo/User Pagante**: $0.037

---

### Cenário Base

**Custos OpenAI**: $98.50/mês  
**Custos Totais**: $170.50/mês  
**Receita**: $118,750/mês  
**Margem Bruta**: $118,579.50 **(99.9%)**

---

### Cenário Agressivo

**Custos OpenAI**: $165.00/mês  
**Custos Totais**: $237.00/mês  
**Receita**: $118,750/mês  
**Margem Bruta**: $118,513.00 **(99.8%)**

---

## 📈 ESCALA 4: 10.000 USUÁRIOS (SCALE-UP)

**Distribuição**: 4,000 Free / 3,500 Plus / 2,500 Pro

### Cenário Conservador

**Engajamento**:
- DAU: 2,000 usuários/dia
- Mensagens: 30,000/mês
- Análises: 20,000/mês
- Imagens: 4,500 msgs/mês

**Custos OpenAI**:
```
Chat texto (25,500):    25,500 × $0.0009 = $22.95
Chat imagens (4,500):    4,500 × $0.0080 = $36.00
Análises IA (16,000):   16,000 × $0.0013 = $20.80
────────────────────────────────────────────
TOTAL OpenAI:                         $79.75/mês
```

**Custos Totais**:
```
OpenAI:      $79.75
Railway:     $100.00
Storage:     $25.00
─────────────
TOTAL:       $204.75/mês
```

**Receita**:
```
Plus (3,500):  $87,500
Pro (2,500):   $187,500
─────────────
TOTAL:         $275,000/mês
```

**Resultado**:
- **Margem Bruta**: $274,795.25 **(99.9%)**
- **MRR**: $275,000
- **ARR**: $3,300,000
- **Custo/User Pagante**: $0.034

---

### Cenário Base

**Custos OpenAI**: $197.00/mês  
**Custos Totais**: $347.00/mês  
**Receita**: $275,000/mês  
**Margem Bruta**: $274,653.00 **(99.9%)**

---

### Cenário Agressivo

**Custos OpenAI**: $330.00/mês  
**Custos Totais**: $480.00/mês  
**Receita**: $275,000/mês  
**Margem Bruta**: $274,520.00 **(99.8%)**

---

## 📊 TABELA CONSOLIDADA: TODOS OS CENÁRIOS

| Escala | Cenário | Custo OpenAI | Custo Total | Receita | Margem Bruta | Margem % |
|--------|---------|--------------|-------------|---------|--------------|----------|
| **100** | Conservador | $0.80 | $21.30 | $1,500 | $1,479 | 98.6% |
| **100** | Base | $1.97 | $22.47 | $1,500 | $1,478 | 98.5% |
| **100** | Agressivo | $3.30 | $23.80 | $1,500 | $1,476 | 98.4% |
| **1.000** | Conservador | $7.98 | $35.48 | $20,000 | $19,965 | 99.8% |
| **1.000** | Base | $19.70 | $47.20 | $20,000 | $19,953 | 99.8% |
| **1.000** | Agressivo | $33.00 | $60.50 | $20,000 | $19,940 | 99.7% |
| **5.000** | Conservador | $39.88 | $101.88 | $118,750 | $118,648 | 99.9% |
| **5.000** | Base | $98.50 | $170.50 | $118,750 | $118,580 | 99.9% |
| **5.000** | Agressivo | $165.00 | $237.00 | $118,750 | $118,513 | 99.8% |
| **10.000** | Conservador | $79.75 | $204.75 | $275,000 | $274,795 | 99.9% |
| **10.000** | Base | $197.00 | $347.00 | $275,000 | $274,653 | 99.9% |
| **10.000** | Agressivo | $330.00 | $480.00 | $275,000 | $274,520 | 99.8% |

---

## 📈 ANÁLISE DE SENSIBILIDADE

### Impacto da Variação de Preços

**Cenário Base (1.000 usuários, engajamento médio)**

| Pricing | MRR | Custo | Margem | Margem % |
|---------|-----|-------|--------|----------|
| Plus $20 / Pro $60 | $16,000 | $47 | $15,953 | 99.7% |
| **Plus $25 / Pro $75** | **$20,000** | **$47** | **$19,953** | **99.8%** |
| Plus $30 / Pro $90 | $24,000 | $47 | $23,953 | 99.8% |
| Plus $35 / Pro $105 | $28,000 | $47 | $27,953 | 99.8% |

**Conclusão**: Pricing tem BAIXO impacto na margem % (sempre >99%), mas ALTO impacto na receita absoluta.

---

### Impacto da Variação de Custos OpenAI

**Cenário: 1.000 usuários, Base**

| Situação | Custo OpenAI | Margem | Margem % |
|----------|--------------|--------|----------|
| **Atual (estimado)** | **$19.70** | **$19,953** | **99.8%** |
| +50% (mais uso imagens) | $29.55 | $19,943 | 99.7% |
| +100% (dobro de uso) | $39.40 | $19,933 | 99.7% |
| +200% (explosão de uso) | $78.80 | $19,894 | 99.5% |

**Conclusão**: Mesmo com **explosão de 200% no custo OpenAI**, margem permanece >99%.

---

## ✅ CONCLUSÕES E INSIGHTS

### 🎯 Achados Principais

1. **Margem Extremamente Saudável**: 98-99.9% em TODOS os cenários
2. **Custos Escalam Linearmente**: Dobrar usuários = dobrar custos OpenAI
3. **Breakeven Baixíssimo**: ~2 usuários pagantes cobrem custos fixos
4. **Pricing Flexível**: Pode ajustar preços sem impactar margem %
5. **Maior Risco**: Escala 10K+ com engajamento agressivo (mas margem ainda 99%+)

---

### 💡 Recomendações Estratégicas

#### Curto Prazo (MVP → 100 users)
- ✅ Manter preços conservadores ($25/$75) para competitividade
- ✅ Focar em conversão FREE → PLUS (maior volume)
- ✅ Monitorar custos reais vs estimados

#### Médio Prazo (100 → 1.000 users)
- ✅ Implementar telemetria para validar estimativas
- ✅ Otimizar uso de GPT-4o (reduzir chamadas desnecessárias)
- ✅ Considerar aumentar preços se NPS alto

#### Longo Prazo (1.000 → 10.000+ users)
- ✅ Negociar descontos enterprise com OpenAI
- ✅ Explorar modelos open-source para casos simples
- ✅ Implementar caching agressivo (reduzir 50-70% custos)

---

### ⚠️ Pontos de Atenção

1. **Telemetria Ausente**: TODAS as estimativas precisam ser validadas
2. **Poder de Precificação**: Alta margem permite guerra de preços (cuidado)
3. **Dependência OpenAI**: 100% vendor lock-in (risco de mudança de preços)
4. **Abuso Potencial**: Usuários PRO podem explorar limites (hard caps essenciais)

---

## 📞 PRÓXIMOS PASSOS

### Fase 1: Validação (Semana 1-2)
1. ✅ Implementar telemetria de tokens
2. ✅ Coletar 14 dias de dados reais
3. ✅ Comparar com estimativas deste documento
4. ✅ Ajustar modelo se divergência >20%

### Fase 2: Otimização (Semana 3-4)
5. ✅ Identificar oportunidades de redução de custos
6. ✅ Implementar caching de sugestões
7. ✅ Testar degradação de modelo (GPT-4o → 4o-mini)

### Fase 3: Escala (Mês 2-3)
8. ✅ Validar cenários de 1K e 5K usuários
9. ✅ Ajustar pricing se necessário
10. ✅ Preparar para negociação enterprise com OpenAI

---

**📌 IMPORTANTE**: Este documento é baseado em **estimativas sem telemetria**.  
Todos os valores devem ser validados com dados reais antes de decisões estratégicas.

**Última Atualização**: 21/12/2025  
**Versão**: 1.0.0  
**Status**: ⚠️ DRAFT (aguardando validação)
