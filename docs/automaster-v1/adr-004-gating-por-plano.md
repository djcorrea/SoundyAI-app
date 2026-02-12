# ADR-004: Gating por Plano

**Status:** ✅ Aceito  
**Data:** 09 de fevereiro de 2026  
**Decisores:** CTO, Product Manager, Finance  
**Contexto:** Controlar acesso ao AutoMaster baseado em planos

---

## Contexto e Problema

AutoMaster tem custo de processamento significativo (CPU, storage).  
Precisa ser monetizado e limitado para evitar abuso.

**Questões:**
1. Quais planos têm acesso?
2. Quantos masterings por mês?
3. Como prevenir abuso?
4. Re-masterização (testar outro modo) conta como novo crédito?

---

## Opções Consideradas

### Opção A: AutoMaster Grátis para Todos
Sem limites, todos os usuários podem masterizar ilimitadamente.

**Pros:**
- Aquisição de usuários rápida
- Sem atrito no uso

**Contras:**
- **Custo insustentável:** $10k/mês de infra facilmente
- Abuso (bots, spam)
- Sem modelo de receita

❌ Descartado: Inviável economicamente.

### Opção B: AutoMaster Apenas para STUDIO
Apenas plano topo (R$ 99,90/mês) tem acesso.

**Pros:**
- Alta margem de receita
- Controle de custo (poucos usuários STUDIO)

**Contras:**
- Barreira alta: 90% dos usuários nunca testam
- Dificulta growth
- Competidores oferecem em planos mais baixos

⚠️ Muito restritivo para V1.

### Opção C: AutoMaster para PLUS+, com Créditos
PLUS, PRO e STUDIO têm acesso, com limites de créditos mensais.

**Pros:**
- Incentiva upgrade de FREE → PLUS
- Controle de custo via créditos
- Permite experimentação (poucos créditos para testar)

**Contras:**
- Precisa implementar sistema de créditos

✅ **Escolha final.**

---

## Decisão

**Gating baseado em plano com sistema de créditos.**

### Acesso por Plano

| Plano | Acesso AutoMaster | Créditos/Mês | Custo Mensal |
|-------|-------------------|--------------|--------------|
| **FREE** | ❌ Não | 0 | R$ 0 |
| **PLUS** | ✅ Sim | **5** | R$ 19,90 |
| **PRO** | ✅ Sim | **15** | R$ 39,90 |
| **STUDIO** | ✅ Sim | **50** | R$ 99,90 |

**Nota:** Análise (atual feature) e AutoMaster têm limites separados.

### Regras de Consumo de Créditos

#### 1 Crédito = 1 Mastering Completo

**Consome crédito:**
- ✅ Masterizar faixa pela primeira vez

**NÃO consome crédito:**
- ✅ Re-masterizar mesma faixa com outro modo (máx 2 re-masters grátis)
- ✅ Fallback automático (conta como mesma tentativa)
- ❌ Job que falhou (não entregou áudio)

#### Re-masterização

| Render | Consome Crédito? |
|--------|-----------------|
| 1º (primeiro modo) | ✅ Sim |
| 2º (outro modo) | ❌ Não (grátis) |
| 3º (outro modo) | ❌ Não (grátis) |
| 4º (outro modo) | ✅ Sim (após 3 renders, cobra) |

**Total:** Usuário pode testar 3 modos diferentes por faixa consumindo apenas 1 crédito.

---

## Implementação

### Banco de Dados

**Tabela: `mastering_credits`**
```sql
CREATE TABLE mastering_credits (
  uid TEXT PRIMARY KEY,
  remaining INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mastering_credits_uid ON mastering_credits(uid);
```

**Tabela: `mastering_jobs` (adicionar campo)**
```sql
ALTER TABLE jobs ADD COLUMN original_track_id TEXT;
ALTER TABLE jobs ADD COLUMN render_attempt INTEGER DEFAULT 1;
```

### Código Core

#### Verificar e Decrementar Créditos

```javascript
async function canUseMastering(uid) {
  // 1. Verificar plano
  const userPlan = await getUserPlan(uid);
  if (userPlan === 'free') {
    return { allowed: false, reason: 'AutoMaster requer plano PLUS ou superior' };
  }
  
  // 2. Verificar créditos
  const credits = await getMasteringCredits(uid);
  if (credits.remaining <= 0) {
    return { 
      allowed: false, 
      reason: `Sem créditos disponíveis. Reset em ${formatDate(credits.reset_at)}` 
    };
  }
  
  return { allowed: true, remaining: credits.remaining };
}

async function decrementMasteringCredit(uid, trackId, renderAttempt) {
  // Se é re-masterização (mesma track), não decrementar até 3º render
  if (renderAttempt <= 3) {
    const previousRenders = await countRendersForTrack(uid, trackId);
    if (previousRenders < 3) {
      console.log(`[CREDITS] Re-masterização grátis (${previousRenders}/3)`);
      return { decremented: false, reason: 'Re-masterização grátis' };
    }
  }
  
  // Decrementar crédito
  const result = await db.query(`
    UPDATE mastering_credits 
    SET remaining = remaining - 1, updated_at = NOW()
    WHERE uid = $1 AND remaining > 0
    RETURNING remaining
  `, [uid]);
  
  if (result.rows.length === 0) {
    throw new Error('Sem créditos disponíveis');
  }
  
  console.log(`[CREDITS] Decrementado. Restante: ${result.rows[0].remaining}`);
  return { decremented: true, remaining: result.rows[0].remaining };
}
```

#### Reset Mensal (Cron)

```javascript
// Executar todo dia 1º de cada mês às 00:00 UTC
async function resetMonthlyCredits() {
  const plans = {
    plus: 5,
    pro: 15,
    studio: 50
  };
  
  for (const [planName, credits] of Object.entries(plans)) {
    await db.query(`
      INSERT INTO mastering_credits (uid, remaining, total, reset_at)
      SELECT uid, $1, $1, NOW() + INTERVAL '1 month'
      FROM users
      WHERE plan = $2
      ON CONFLICT (uid) DO UPDATE
      SET remaining = $1, total = $1, reset_at = NOW() + INTERVAL '1 month'
    `, [credits, planName]);
  }
  
  console.log('[CRON] Reset mensal de créditos concluído');
}
```

---

## Flow de Decisão

```
Usuário clica "Masterizar"
  ↓
Verificar plano (FREE?)
  ├─ Sim → Erro: "Upgrade para PLUS"
  └─ Não → Continuar
       ↓
Verificar créditos (remaining > 0?)
  ├─ Não → Erro: "Sem créditos. Reset em X/Y/Z"
  └─ Sim → Continuar
       ↓
Verificar se é re-masterização (mesma track?)
  ├─ Sim (< 3 renders) → Processar SEM decrementar
  └─ Não → Decrementar crédito ANTES de enfileirar
       ↓
Enfileirar job no BullMQ
  ↓
Worker processa
  ↓
Job completou?
  ├─ Sim → Entregar áudio
  └─ Não (falhou) → Reembolsar crédito (rollback)
```

---

## Consequências

### Positivas ✅
- **Conversão:** Incentiva upgrade de FREE para PLUS (R$ 19,90)
- **Controle de custo:** Hard cap de 50 masterings/mês por usuário STUDIO
- **Experimentação:** Re-masters grátis permitem testar modos
- **Justo:** Quem paga mais tem mais créditos

### Negativas ❌
- **Complexidade:** Sistema de créditos adiciona lógica ao backend
- **UX:** Usuários precisam entender créditos (mitigação: UI clara)

### Neutras 🟡
- Precisa dashboard para usuário ver créditos restantes

---

## UX/UI

### Modal de Upgrade (FREE)

```
🔒 AutoMaster é exclusivo para assinantes

Com o plano PLUS você ganha:
✅ 5 masterizações por mês
✅ 20 análises completas
✅ Relatórios PDF ilimitados

[Fazer Upgrade → R$ 19,90/mês]
```

### Modal de Sem Créditos (PLUS/PRO)

```
⏳ Você usou todos os créditos deste mês

Restam X dias até o reset automático.

Opções:
• Aguardar reset (dia 1º de cada mês)
• Fazer upgrade para PRO (15 créditos/mês)

[Aguardar] [Fazer Upgrade]
```

### Indicador de Créditos (Header)

```
🎚️ Masterings: 3/5 restantes
```

---

## Métricas de Sucesso

### KPIs

- **Taxa de conversão FREE → PLUS:** Target ≥ 5% após experimentar demo
- **Uso médio de créditos:** Target 60-80% (nem subutilizado, nem estourado)
- **% de usuários que esgotam créditos:** Target 20-30% (indica demanda)
- **Taxa de upgrade PLUS → PRO após esgotar:** Target ≥ 10%

### Alertas

- Se 50%+ de usuários PLUS esgotam créditos: considerar aumentar limite
- Se < 30% de usuários usam créditos: feature não está atraindo

---

## Futuras Melhorias (V2)

### Compra de Créditos Avulsos
Permitir comprar pacote de 10 créditos por R$ 29,90.

### Créditos Compartilhados (Equipes)
Plano BUSINESS: pool de créditos compartilhado entre membros.

---

## Decisões Relacionadas

- **ADR-003:** Fallback não consome crédito adicional
- **ADR-005:** Custo previsível (créditos controlam uso)

---

**Status:** Implementar em Fase 2 (backend + DB)  
**Review:** Após 3 meses, ajustar limites de créditos conforme uso real
