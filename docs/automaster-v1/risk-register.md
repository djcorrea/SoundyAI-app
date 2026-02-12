# 🚨 Risk Register: AutoMaster V1

**Versão:** 1.0  
**Data:** 09 de fevereiro de 2026  
**Responsável:** CTO / Tech Lead

---

## Como Ler Esta Tabela

- **Probabilidade:** Baixa (10%) | Média (40%) | Alta (70%)
- **Impacto:** Baixo | Médio | Alto | Crítico
- **Severidade:** Prob × Impacto = score (1-10)
- **Dono:** Pessoa responsável por monitorar e mitigar

---

## 1. Riscos de Medição e Cálculo

| # | Risco | Causa | Impacto | Prob | Severidade | Mitigação | Observabilidade | Dono |
|---|-------|-------|---------|------|------------|-----------|-----------------|------|
| R01 | **Divergência LUFS análise vs master** | Usar libs diferentes ou configs diferentes no cálculo | 🔴 Crítico - Perda de confiança total | 🟡 Média (40%) | **8/10** | Usar EXATAMENTE a mesma lib (FFmpeg ebur128) com mesmos parâmetros. Testes unitários com pink noise e reference tracks. | Log de LUFS antes e depois em cada job. Alerta se delta > 0.5 LU sem explicação. | Tech Lead |
| R02 | **True Peak incorreto (sub-estimado)** | Oversampling inadequado ou bug no cálculo | 🔴 Crítico - Clipping audível em streaming | 🟢 Baixa (10%) | **6/10** | Usar FFmpeg ebur128 com 4x oversampling (padrão ITU). Validar com sine wave 1kHz @ 0dBFS. | Log de True Peak de cada render. Alerta se TP > -0.1 dBTP em QUALQUER modo. | Audio Engineer |
| R03 | **Dynamic Range frágil** | Algoritmo caseiro difere do padrão TT-DR | 🟡 Médio - Comparações incorretas | 🟡 Média (40%) | **6/10** | Usar fórmula TT-DR oficial: Peak RMS - Avg RMS (20% superior). Validar com DR Meter. | Log de DR antes e depois. Dashboard com histograma de DRs por gênero. | Tech Lead |
| R04 | **Bandas espectrais inconsistentes** | FFT com janelamento diferente entre análise e validação | 🟡 Médio - EQ não atinge targets | 🟡 Média (40%) | **6/10** | Reutilizar EXATO o código de `spectral-bands.js`. Mesma janela Hann, mesmo hop size. | Log de todas as 8 bandas antes e depois. Alerta se delta > 6 dB em qualquer banda. | Audio Engineer |
| R05 | **Stereo correlation calculada errada** | Usar fórmula simplificada sem normalização | 🟢 Baixo - Impacto menor na qualidade | 🟢 Baixa (10%) | **2/10** | Usar fórmula padrão: corr = Σ(L×R) / √(Σ(L²)×Σ(R²)). | Log de correlation antes e depois. | Tech Lead |

---

## 2. Riscos de Processamento DSP

| # | Risco | Causa | Impacto | Prob | Severidade | Mitigação | Observabilidade | Dono |
|---|-------|-------|---------|------|------------|-----------|-----------------|------|
| R06 | **Clipping audível após limiter** | Ceiling muito próximo de 0dBFS (ex: -0.05 dBTP) | 🔴 Crítico - Distorção óbvia | 🟡 Média (40%) | **8/10** | Ceilings conservadores: -0.1 (impact), -0.3 (balanced), -0.5 (clean). Validar TP < ceiling após render. | Log de True Peak pós-render. Alerta se TP > ceiling -0.05 dB. Job FAIL se TP > 0.0. | Audio Engineer |
| R07 | **Over-compression (DR muito baixo)** | Compression ratio muito alto (>6:1) ou threshold muito baixo | 🟡 Médio - Som artificial, fadiga | 🟡 Média (40%) | **6/10** | DR mínimo obrigatório: 6 dB (impact), 7 dB (balanced), 9 dB (clean). Abortar render se violar. | Log de DR pós-render. Dashboard com % de jobs abortados por DR. | Audio Engineer |
| R08 | **Distorção harmônica excessiva** | Compressor/limiter mal calibrado | 🔴 Alto - Som quebrado | 🟢 Baixa (10%) | **5/10** | Validar THD (Total Harmonic Distortion) < 1%. Usar release suave no limiter (50-100ms). | Log de THD pós-render (se disponível na lib). A/B listening tests no beta. | Audio Engineer |
| R09 | **EQ introduz phase issues** | Filtros IIR com Q muito alto | 🟡 Médio - Som "estranho" | 🟢 Baixa (10%) | **3/10** | Usar filtros lineares (FIR) ou IIR com Q moderado (<2.0). Limitar boost/cut a ±3 dB. | A/B tests com produtores. Análise de phase correlation. | Audio Engineer |
| R10 | **Pumping audível** | Attack/release do compressor muito rápido | 🟡 Médio - Som não-natural | 🟡 Média (40%) | **6/10** | Attack mínimo 3ms, release mínimo 30ms. Usar RMS detection (não peak). | A/B tests. Log de parâmetros usados. | Audio Engineer |

---

## 3. Riscos de Infraestrutura e Performance

| # | Risco | Causa | Impacto | Prob | Severidade | Mitigação | Observabilidade | Dono |
|---|-------|-------|---------|------|------------|-----------|-----------------|------|
| R11 | **Oversampling indisponível** | Lib/FFmpeg sem suporte a oversampling no ambiente de prod | 🔴 Crítico - True Peak inválido | 🟢 Baixa (10%) | **5/10** | Validar no Dockerfile/Railway que FFmpeg tem filtro ebur128. Testes de integração antes do deploy. | Health check na API: GET /api/health deve validar FFmpeg. | DevOps |
| R12 | **Timeout em arquivos longos** | Processar faixa de 10min estoura timeout de 2min | 🟡 Médio - Falha em edge cases | 🟡 Média (40%) | **6/10** | Timeout de 5min para AutoMaster (vs 2min para análise). Validar tamanho do arquivo antes de enfileirar. | Log de tempo de processamento. Alerta se job > 4min. | DevOps |
| R13 | **Fila AutoMaster saturada** | Concorrência insuficiente (1-2 workers) para demanda | 🟡 Médio - UX ruim (espera) | 🟡 Média (40%) | **6/10** | Começar com 2 workers, escalar para 5 se fila > 20 jobs. Auto-scaling baseado em tamanho da fila. | Dashboard BullMQ: jobs waiting, processing, completed. Alerta se waiting > 20. | DevOps |
| R14 | **Custo de CPU explode** | Processamento muito custoso (oversampling, FFTs) | 🟡 Médio - Viabilidade econômica | 🟡 Média (40%) | **6/10** | Hard cap de 400 masterings/mês para STUDIO. Monitorar custo por job. | Dashboard de custo: $/100 masterings. Alerta se > $10. | CTO |
| R15 | **Storage overflow** | Não deletar arquivos intermediários | 🟢 Baixo - Custo gradual | 🟡 Média (40%) | **4/10** | Cron job diário: deletar /temp/ após 24h, /mastered/ após 30 dias (se usuário não fez download). | Dashboard de storage: GB usados. Alerta se > 100GB. | DevOps |

---

## 4. Riscos de Lógica de Negócio

| # | Risco | Causa | Impacto | Prob | Severidade | Mitigação | Observabilidade | Dono |
|---|-------|-------|---------|------|------------|-----------|-----------------|------|
| R16 | **Conflito Loudness vs DR** | Tentar atingir -6 LUFS mantendo DR 10 (fisicamente impossível) | 🟡 Médio - Targets não atingidos | 🟡 Média (40%) | **6/10** | Validar consistência dos targets: se LUFS muito alto, DR mínimo deve ser baixo. Fallback: priorizar DR sobre LUFS. | Log de targets vs resultado. Alerta se não convergir após 2 renders. | Product Manager |
| R17 | **Modo errado para gênero** | Usuário escolhe IMPACT para música clássica (errado) | 🟢 Baixo - Responsabilidade do usuário | 🔵 Alta (70%) | **5/10** | UI deve sugerir modo baseado no gênero. Disclaimer: "IMPACT é agressivo, recomendado para EDM/Hip-hop". | Analytics: quais combinações gênero+modo são mais usadas. | Product Manager |
| R18 | **Preview leak** | URLs presigned sem expiração | 🔴 Alto - Vazamento de IP | 🟢 Baixa (10%) | **5/10** | Presigned URLs com expiração 10min. Download só para dono do job (verificar uid). | Log de acessos a arquivos masterizados. Alerta se mesmo arquivo acessado >100x. | Security Lead |
| R19 | **Bypass de créditos** | Bug permite masterizar sem decrementar créditos | 🟡 Médio - Perda de receita | 🟢 Baixa (10%) | **3/10** | Transação atômica: verificar créditos → decrementar → enfileirar job. Testes de concorrência. | Dashboard de créditos usados/mês. Alerta se discrepância com jobs enfileirados. | Backend Lead |
| R20 | **Race condition em fallback** | 2 renders paralelos tentam salvar resultado ao mesmo tempo | 🟢 Baixo - Job pode falhar | 🟢 Baixa (10%) | **2/10** | Lock pessimista no PostgreSQL: UPDATE jobs SET status='processing' WHERE id=X AND status='pending'. | Log de jobs duplicados. Alerta se > 1% dos jobs. | Backend Lead |

---

## 5. Riscos de Fallback e Abort

| # | Risco | Causa | Impacto | Prob | Severidade | Mitigação | Observabilidade | Dono |
|---|-------|-------|---------|------|------------|-----------|-----------------|------|
| R21 | **Fallback infinito** | Lógica tenta renderizar até acertar, nunca aborta | 🔴 Crítico - Custo explode | 🟡 Média (40%) | **8/10** | Max 2 renders: 1 tentativa padrão + 1 fallback conservador. Se ambos falharem: abortar e notificar usuário. | Log de tentativas por job. Alerta se job tem >2 renders. KILL job se >3. | Backend Lead |
| R22 | **Fallback muito conservador** | Após falha, fallback fica muito longe do target (ex: -16 LUFS para target -9 LUFS) | 🟡 Médio - Resultado insatisfatório | 🟡 Média (40%) | **6/10** | Fallback deve ficar no máximo 3 LU acima do target. Se não atingir: retornar erro explicativo. | Log de delta target vs resultado. Dashboard com % de fallbacks. | Product Manager |
| R23 | **Falha silenciosa** | Job marca como "completed" mas áudio está corrompido | 🔴 Alto - Usuário baixa lixo | 🟢 Baixa (10%) | **5/10** | Validar áudio pós-render: load WAV, calcular LUFS/TP, verificar que não é silêncio. | Log de validações. Alerta se LUFS=-70 (silêncio) ou arquivo < 100KB. | Backend Lead |
| R24 | **Erro não-explicativo** | Usuário vê "Internal Server Error" sem saber o que houve | 🟡 Médio - UX ruim, suporte sobrecarregado | 🔵 Alta (70%) | **7/10** | Mensagens de erro claras: "True Peak muito alto, tente modo CLEAN" ou "Arquivo muito longo (max 10min)". | Log de tipos de erro. Dashboard com top 10 erros. | Product Manager |
| R25 | **Arquivo original corrompido** | Upload teve erro mas job tenta processar mesmo assim | 🟡 Médio - Job falha misteriosamente | 🟢 Baixa (10%) | **3/10** | Validar integridade do arquivo ANTES de enfileirar: tentar fazer decode básico. | Log de uploads corrompidos. Alerta se > 5% dos uploads. | Backend Lead |

---

## 6. Riscos de UX e Produto

| # | Risco | Causa | Impacto | Prob | Severidade | Mitigação | Observabilidade | Dono |
|---|-------|-------|---------|------|------------|-----------|-----------------|------|
| R26 | **Expectativa irreal** | Marketing promete "master profissional indistinguível de humano" | 🔴 Alto - Decepção massiva | 🟡 Média (40%) | **8/10** | Disclaimer claro: "AutoMaster é uma ferramenta técnica, não substitui engenheiro". Transparência sobre limitações. | NPS score, reviews. Taxa de reembolso/cancelamento após usar AutoMaster. | Product Manager |
| R27 | **Comparação A/B ausente** | Usuário não consegue comparar antes vs depois | 🟡 Médio - Não percebe valor | 🔵 Alta (70%) | **7/10** | Player A/B obrigatório na UI. Botão "Ouvir Original" sempre visível. | Analytics: % de usuários que usam player A/B. | Product Manager |
| R28 | **Download falha** | Presigned URL expira enquanto usuário escuta | 🟡 Médio - Frustração | 🟡 Média (40%) | **6/10** | Expiração de 10min, mas permitir re-gerar URL. Botão "Download" gera nova URL sempre. | Log de downloads falhados (404 errors). | Frontend Lead |
| R29 | **Sem explicação do que mudou** | Usuário vê resultado mas não sabe O QUE foi processado | 🟢 Baixo - Curiosidade não satisfeita | 🔵 Alta (70%) | **5/10** | Campo `appliedProcessing` no resultado final: lista de operações (EQ +2dB em bass, compression 3:1, limiter -0.3 ceiling). | Analytics: % de usuários que expandem "Detalhes Técnicos". | Product Manager |
| R30 | **Re-masterização cara** | Usuário quer testar outro modo mas gasta novo crédito | 🟡 Médio - Atrito no uso | 🟡 Média (40%) | **6/10** | Permitir 2 re-masterizações grátis (total 3 renders) por faixa. Após isso, consumir crédito normalmente. | Dashboard: quantas re-masterizações/job em média. | Product Manager |

---

## Matriz de Priorização (Top 10 Riscos Críticos)

| Rank | ID | Risco | Severidade | Ação Imediata |
|------|----|----|-----------|---------------|
| 1 | R01 | Divergência LUFS análise vs master | 8/10 | Testes unitários com pink noise ANTES do dev |
| 2 | R06 | Clipping audível após limiter | 8/10 | Ceilings conservadores + validação obrigatória |
| 3 | R21 | Fallback infinito | 8/10 | Hard limit de 2 renders no código |
| 4 | R26 | Expectativa irreal | 8/10 | Disclaimer no marketing + beta privado |
| 5 | R24 | Erro não-explicativo | 7/10 | Error mapper com mensagens claras |
| 6 | R27 | Comparação A/B ausente | 7/10 | Player A/B é MVP, não nice-to-have |
| 7 | R03 | Dynamic Range frágil | 6/10 | Usar fórmula TT-DR oficial |
| 8 | R07 | Over-compression (DR muito baixo) | 6/10 | DR mínimo obrigatório por modo |
| 9 | R11 | Oversampling indisponível | 5/10 | Health check no CI/CD antes do deploy |
| 10 | R16 | Conflito Loudness vs DR | 6/10 | Validar consistência de targets antes de processar |

---

## Protocolo de Resposta a Incidentes

### 🔴 Severidade Crítica (8-10)
- **Ação:** Pausar novos jobs, investigar imediatamente
- **SLA:** Resolver em 4h ou rollback
- **Comunicação:** Notificar usuários via email/dashboard

### 🟡 Severidade Alta (6-7)
- **Ação:** Monitorar de perto, criar hotfix em sprint
- **SLA:** Resolver em 48h
- **Comunicação:** Post-mortem interno

### 🟢 Severidade Média/Baixa (1-5)
- **Ação:** Adicionar ao backlog, priorizar conforme impacto
- **SLA:** Resolver em próximo ciclo de release

---

**Última atualização:** 09/02/2026  
**Próxima revisão:** Após POC da engine DSP
