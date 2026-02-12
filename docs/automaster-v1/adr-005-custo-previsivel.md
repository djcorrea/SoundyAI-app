# ADR-005: Custo Previsível e Sustentável

**Status:** ✅ Aceito  
**Data:** 09 de fevereiro de 2026  
**Decisores:** CTO, Finance, Product Manager  
**Contexto:** Garantir viabilidade econômica do AutoMaster

---

## Contexto e Problema

AutoMaster tem custos variáveis significativos:
- **CPU:** Processamento DSP (FFmpeg, FFT, oversampling)
- **Storage:** Armazenar original + masterizado (min 30 dias)
- **Network:** Download do B2, upload do resultado

Se não controlado, custo pode explodir e inviabilizar o produto.

**Questão central:** Como garantir custo previsível por usuário/mês?

---

## Opções Consideradas

### Opção A: Sem Controle de Custo
Executar qualquer quantidade de renders, sem limites técnicos.

**Pros:**
- Usuário nunca é bloqueado
- UX sem atrito

**Contras:**
- **Custo imprevisível:** Pode custar $100/usuário/mês facilmente
- Abuso: bots podem consumir recursos infinitos
- Inviável economicamente

❌ Descartado.

### Opção B: Custo Fixo por Render (Cobrar por Uso)
Cobrar $0.50 por mastering (pay-as-you-go).

**Pros:**
- Receita diretamente ligada ao custo
- Sem risco de prejuízo

**Contras:**
- Atrito: usuário precisa autorizar cada cobrança
- Dificulta growth (preço explícito assusta)
- Concorrência oferece flat-rate

⚠️ Pode funcionar para V2+ (plano "On-Demand").

### Opção C: Hard Caps + Créditos Mensais
Limitar uso via créditos fixos por plano (ex: PLUS = 5/mês).

**Pros:**
- **Custo previsível:** Máximo de X masterings/usuário/mês
- Flat-rate: usuário paga mensalidade fixa
- Incentiva upgrade (mais créditos = plano maior)

**Contras:**
- Usuário pode esgotar créditos (UX: frustração)

✅ **Escolha final.**

---

## Decisão

**Hard caps via sistema de créditos, com fallbacks para reduzir desperdício.**

### Modelo de Custo

#### Custo Estimado por Render

| Componente | Custo/Render | Notas |
|-----------|--------------|-------|
| **CPU (Railway)** | $0.03 | 60s @ $0.002/CPU-min (estimado) |
| **Storage (B2)** | $0.01 | 50MB × 30 dias @ $0.005/GB/mês |
| **Network (B2)** | $0.005 | Download 50MB @ $0.01/GB |
| **Redis (Upstash)** | $0.001 | Comandos mínimos |
| **PostgreSQL** | $0.001 | Write simples |
| **TOTAL** | **~$0.05** | **$0.05 por mastering** |

#### Adicionar Fallback (se necessário)
- **Fallback:** +$0.05 (dobro do custo)
- **Total com fallback:** $0.10

---

### Receita vs Custo por Plano

| Plano | Mensalidade | Créditos/Mês | Custo Máximo | Margem |
|-------|------------|--------------|--------------|--------|
| PLUS | R$ 19,90 (~$4 USD) | 5 | $0.50 | **$3.50 (87%)** |
| PRO | R$ 39,90 (~$8 USD) | 15 | $1.50 | **$6.50 (81%)** |
| STUDIO | R$ 99,90 (~$20 USD) | 50 | $5.00 | **$15.00 (75%)** |

**Margem média:** ~80% (excelente)

#### Se 100% dos usuários usarem 100% dos créditos:
- **Custo total:** $5.00 por STUDIO/mês
- **Receita:** $20/mês
- **Lucro:** $15/mês (75% margem)

**Conclusão:** Sustentável mesmo em pior cenário.

---

## Hard Caps Técnicos

### Por Plano (Mensal)

| Plano | Hard Cap |
|-------|----------|
| FREE | 0 (sem acesso) |
| PLUS | **5 masterings/mês** |
| PRO | **15 masterings/mês** |
| STUDIO | **50 masterings/mês** |

### Por Usuário (Horário)
Prevenir abuso em curto prazo:
- **5 masterings/hora** (qualquer plano)
- Após 5/hora: retornar erro 429 com retry-after

### Por Job (Render)
- **Max 2 renders** (1 padrão + 1 fallback) via ADR-003
- **Timeout:** 5 minutos por render

---

## Storage Policy

### Retenção de Arquivos

| Arquivo | Retenção | Justificativa |
|---------|----------|---------------|
| **Original** | 30 dias | Permitir re-masterização |
| **Masterizado** | 30 dias | Download por tempo limitado |
| **Temp/Intermediários** | 24 horas | Limpeza automática |

### Limpeza Automática (Cron)

```javascript
// Executar diariamente às 02:00 UTC
async function cleanupOldFiles() {
  const now = new Date();
  const cutoff30days = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const cutoff24h = new Date(now - 24 * 60 * 60 * 1000);
  
  // Deletar arquivos masterizados > 30 dias
  const oldMastered = await listB2Files({ prefix: 'mastered/', olderThan: cutoff30days });
  for (const file of oldMastered) {
    await deleteB2File(file.key);
    console.log(`[CLEANUP] Deleted ${file.key}`);
  }
  
  // Deletar arquivos temp > 24h
  const oldTemp = await listB2Files({ prefix: 'temp/', olderThan: cutoff24h });
  for (const file of oldTemp) {
    await deleteB2File(file.key);
  }
  
  console.log(`[CLEANUP] Removed ${oldMastered.length} mastered + ${oldTemp.length} temp files`);
}
```

---

## Monitoramento de Custo

### Métricas

Dashboard com:
- **Custo total/mês:** Soma de todos os renders
- **Custo médio/render:** Total cost ÷ número de renders
- **Custo/usuário/mês:** Agrupado por plano
- **% de usuários que esgotam créditos:** Indica demanda

### Alertas

| Condição | Alerta |
|----------|--------|
| Custo/render > $0.10 | ⚠️ Investigar performance/timeout |
| Custo total > $1000/mês | 🚨 Revisar pricing ou limites |
| Storage > 100GB | ⚠️ Revisar política de retenção |
| 50%+ usuários esgotam créditos | 💡 Considerar aumentar limites |

---

## Implementação

### Função de Auditoria de Custo

```javascript
async function calculateJobCost(job) {
  const metrics = {
    cpuTimeSeconds: job.processing_time_ms / 1000,
    storageGB: job.file_size_bytes / 1024 / 1024 / 1024,
    networkGB: storageGB * 2, // download + upload
    renderAttempts: job.render_attempts || 1
  };
  
  const costs = {
    cpu: metrics.cpuTimeSeconds * 0.002, // $0.002/CPU-min
    storage: metrics.storageGB * 0.005 * 30, // 30 dias
    network: metrics.networkGB * 0.01,
    total: 0
  };
  
  costs.total = (costs.cpu + costs.storage + costs.network) * metrics.renderAttempts;
  
  // Log de auditoria
  await db.query(`
    INSERT INTO cost_audit (job_id, cpu_cost, storage_cost, network_cost, total_cost, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `, [job.id, costs.cpu, costs.storage, costs.network, costs.total]);
  
  return costs;
}
```

### Dashboard de Custo (Query Exemplo)

```sql
-- Custo total por plano no último mês
SELECT 
  u.plan,
  COUNT(DISTINCT u.uid) as users,
  COUNT(j.id) as total_jobs,
  ROUND(SUM(ca.total_cost), 2) as total_cost_usd,
  ROUND(AVG(ca.total_cost), 4) as avg_cost_per_job,
  ROUND(SUM(ca.total_cost) / COUNT(DISTINCT u.uid), 2) as cost_per_user
FROM cost_audit ca
JOIN jobs j ON ca.job_id = j.id
JOIN users u ON j.user_id = u.uid
WHERE ca.created_at > NOW() - INTERVAL '30 days'
  AND j.status = 'completed'
GROUP BY u.plan
ORDER BY total_cost_usd DESC;
```

---

## Estratégias de Otimização de Custo

### 1. Caching de Análises
Se usuário masterizar mesma faixa 2x (modos diferentes), reutilizar análise prévia.
- **Economia:** ~30% (evita re-análise)

### 2. Compressão de Arquivos Intermediários
Usar FLAC em vez de WAV para armazenar temporários.
- **Economia:** ~50% de storage

### 3. Spot Instances (Futuro)
Usar instâncias spot/preemptive para workers.
- **Economia:** ~60% de CPU cost

### 4. CDN para Download
Após masterização, servir via Cloudflare R2 (sem egress fee).
- **Economia:** ~80% de network cost

---

## Consequências

### Positivas ✅
- **Custo previsível:** $0.05-0.10 por render
- **Margem alta:** 75-87% mesmo em pior cenário
- **Escalável:** Pode atender 10k usuários sem violar orçamento
- **Transparente:** Dashboard mostra custo real

### Negativas ❌
- **Hard caps frustram usuários:** Alguns vão querer mais créditos
- **Otimização constante:** Precisa monitorar custos sempre

### Neutras 🟡
- Storage cresce linearmente com uso (mitigação: política de 30 dias)

---

## Projeções de Crescimento

### Cenário Conservador (Ano 1)
- 500 usuários PLUS × 5 créditos = **2.500 masterings/mês**
- 100 usuários PRO × 15 créditos = **1.500 masterings/mês**
- 20 usuários STUDIO × 50 créditos = **1.000 masterings/mês**
- **TOTAL:** 5.000 masterings/mês
- **Custo:** 5.000 × $0.05 = **$250/mês**
- **Receita:** (500×$4 + 100×$8 + 20×$20) = **$3.200/mês**
- **Margem:** $2.950/mês (92%)

### Cenário Otimista (Ano 2)
- 5.000 usuários pagantes
- 50.000 masterings/mês
- **Custo:** $2.500/mês
- **Receita:** $32.000/mês
- **Margem:** $29.500/mês (92%)

**Conclusão:** Sustentável e altamente rentável.

---

## Futuras Melhorias (V2)

### Plano "On-Demand"
Para usuários que esgotam créditos:
- Comprar pacote de 10 créditos por $5 ($0.50/render)
- Válido por 3 meses

### Otimização Agressiva
- Multi-região: Escolher datacenter mais barato
- Edge processing: Usar Cloudflare Workers para pré-processamento

---

## Decisões Relacionadas

- **ADR-003:** Max 2 renders = custo máximo 2x
- **ADR-004:** Créditos mensais = hard cap de custos

---

**Status:** Implementar observabilidade de custo em Fase 7  
**Review:** Mensal durante 6 meses, depois trimestral
