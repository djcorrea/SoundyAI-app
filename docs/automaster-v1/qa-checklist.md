# ✅ QA Checklist: AutoMaster V1 Pre-Launch

**Versão:** 1.0  
**Data:** 09 de fevereiro de 2026  
**Responsável:** QA Lead + Audio Engineer

---

## Como Usar Este Checklist

Cada item deve ser marcado como:
- ✅ **PASS** - Funciona conforme esperado
- ❌ **FAIL** - Não funciona ou comportamento incorreto
- ⚠️ **PARTIAL** - Funciona mas com ressalvas
- 🔄 **RETEST** - Necessita novo teste após correção

**Critério de lançamento:** 0 FAILs em itens P0, máximo 2 FAILs em itens P1.

---

## 1. Testes de Medição e Cálculo (P0)

### 1.1 LUFS - Loudness Integrated

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T01 | Pink noise @ -23 LUFS | Gerar pink noise calibrado em -23 LUFS. Analisar. | LUFS = -23.0 ±0.2 LU | ⬜ | Usar FFmpeg: `ffmpeg -f lavfi -i "anoisesrc=d=60:c=pink" -af loudnorm=I=-23:LRA=1:TP=-1 pink_-23lufs.wav` |
| T02 | Sine 1kHz @ -20 dBFS | Gerar sine 1kHz com amplitude -20 dBFS. Analisar. | LUFS ≈ -20 ±1 LU | ⬜ | `ffmpeg -f lavfi -i "sine=f=1000:d=60" -af volume=-20dB sine_-20db.wav` |
| T03 | Consistência análise vs pós-master | Analisar→Masterizar(balanced)→Analisar novamente. Comparar métodos de cálculo. | Delta LUFS < 0.3 LU entre análises | ⬜ | Usar mesma referência de áudio em ambas análises |
| T04 | Faixa comercial real | Pegar faixa do Spotify (download legal). Analisar. | LUFS próximo ao reportado pelo Spotify (±1 LU) | ⬜ | Ex: usar "Blinding Lights" (The Weeknd) ≈ -7 LUFS |

### 1.2 True Peak

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T05 | Sine 1kHz @ 0 dBFS | Gerar sine puro em amplitude máxima. | TP = 0.0 dBTP | ⬜ | `ffmpeg -f lavfi -i "sine=f=1000:d=10" sine_0dbfs.wav` |
| T06 | Sine 997Hz @ 0 dBFS | Frequência que gera inter-sample peaks. | TP > 0.0 dBTP (overshoot) | ⬜ | Validar que oversampling detecta |
| T07 | Após limiter (impact) | Masterizar com modo IMPACT. | TP < -0.1 dBTP | ⬜ | NUNCA deve ultrapassar ceiling |
| T08 | Após limiter (clean) | Masterizar com modo CLEAN. | TP < -0.5 dBTP | ⬜ | Ceiling mais conservador |
| T09 | Reference track comercial | Usar "Sicko Mode" (Travis Scott) ou similar. Analisar. | TP próximo ao medido por Audacity/iZotope | ⬜ | Comparar com ferramenta de referência |

### 1.3 Dynamic Range (TT-DR)

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T10 | Pink noise uniforme | Pink noise com RMS constante. | DR < 3 dB (muito comprimido) | ⬜ | Esperado: pouca variação de loudness |
| T11 | Música clássica (não-processada) | Upload de sinfonia sem master. | DR > 12 dB | ⬜ | Alta dinâmica natural |
| T12 | Funk masterizado (referência) | Upload de funk comercial do Spotify. | DR entre 6-9 dB | ⬜ | Típico de gênero comprimido |
| T13 | Após master (impact) | Analisar→Master(impact)→Validar DR. | DR ≥ 6 dB (mínimo do modo) | ⬜ | Se DR < 6: job deve falhar |
| T14 | Após master (clean) | Analisar→Master(clean)→Validar DR. | DR ≥ 9 dB (mínimo do modo) | ⬜ | Preservar dinâmica |

### 1.4 Bandas Espectrais

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T15 | Sine 100Hz (sub) | Gerar sine 100Hz puro. Analisar bandas. | Sub > -10 dB, outras bandas < -40 dB | ⬜ | Validar isolamento de banda |
| T16 | Sine 3kHz (mid) | Gerar sine 3kHz puro. Analisar bandas. | Mid > -10 dB, outras < -40 dB | ⬜ | |
| T17 | Sine 10kHz (brilho) | Gerar sine 10kHz puro. Analisar bandas. | Brilho > -10 dB, outras < -40 dB | ⬜ | |
| T18 | Pink noise (espectro plano) | Pink noise tem energia igual em todas as bandas. | Todas as bandas entre -20 e -25 dBFS | ⬜ | Validar calibração de bandas |
| T19 | Após EQ (master) | Masterizar funk com boost em bass. Validar bandas. | Bass mais alto que antes, outras preservadas | ⬜ | Validar que EQ funciona |

---

## 2. Testes de Processamento DSP (P0)

### 2.1 Normalização LUFS

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T20 | Áudio muito baixo (-30 LUFS) | Upload de arquivo com gain muito baixo. Master (balanced). | Resultado ≈ -11 LUFS ±1 LU | ⬜ | Normalização deve subir |
| T21 | Áudio muito alto (-6 LUFS) | Upload de arquivo já masterizado alto. Master (clean). | Resultado ≈ -14 LUFS (deve ABAIXAR) | ⬜ | Normalização é bidirecional |
| T22 | Áudio no target | Upload em -11 LUFS. Master (balanced). | Resultado ≈ -11 LUFS (pouco ou nenhum ganho) | ⬜ | Não deve sobre-processar |

### 2.2 Compressão

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T23 | Transientes preservados | Upload de bateria com kick forte. Master (clean). | Kick ainda audível, não esmagado | ⬜ | Listening test: kick tem punch |
| T24 | DR mínimo respeitado | Master (impact) de áudio com DR 12. | DR final ≥ 6 dB | ⬜ | Compressão moderada |
| T25 | Sem pumping audível | Master de música eletrônica. A/B antes vs depois. | Sem "breathing" óbvio na compressão | ⬜ | Listening test subjetivo |

### 2.3 Limiter

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T26 | True Peak respeitado | Master (impact) de qualquer faixa. | TP < -0.1 dBTP SEMPRE | ⬜ | Validação automática no código |
| T27 | Sem clipping | Master (impact). Load WAV e verificar samples. | Nenhum sample > 1.0 | ⬜ | `max(abs(samples)) <= 1.0` |
| T28 | Ceiling (clean) | Master (clean). | TP < -0.5 dBTP | ⬜ | Mais conservador |
| T29 | Distorção abaixo de 1% | Master de sine 1kHz. Calcular THD. | THD < 1.0% | ⬜ | Análise de harmônicos |

### 2.4 EQ

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T30 | Correção de bass fraco | Upload com bass -30 dB (vs target -23 dB). Master. | Bass sobe, mas não mais que +6 dB (limite) | ⬜ | EQ tem limites de boost |
| T31 | Sem phase issues | Master e comparar correlation. | Correlation permaneça > 0.7 (se stereo) | ⬜ | EQ não deve decorrelacionar |
| T32 | Espectro não inverte | Upload com brilho forte. Master. | Brilho pode abaixar, mas outras bandas não explodem | ⬜ | EQ balanceado |

---

## 3. Testes de Modos (P0)

### 3.1 Modo CLEAN

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T33 | Target LUFS | Master (clean) de funk (target base -9 LUFS). | Resultado ≈ -11 LUFS (target +2 LU) | ⬜ | Modo sobe target |
| T34 | Ceiling conservador | Master (clean). | TP < -0.5 dBTP | ⬜ | |
| T35 | DR preservado | Master (clean) de áudio com DR 11. | DR final ≥ 9 dB | ⬜ | Compressão suave |

### 3.2 Modo BALANCED

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T36 | Target LUFS | Master (balanced) de funk. | Resultado ≈ -9 LUFS (target exato) | ⬜ | Modo default |
| T37 | Ceiling padrão | Master (balanced). | TP < -0.3 dBTP | ⬜ | |
| T38 | DR moderado | Master (balanced) de áudio com DR 10. | DR final ≥ 7 dB | ⬜ | Balanç entre punch e dinâmica |

### 3.3 Modo IMPACT

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T39 | Target LUFS | Master (impact) de funk. | Resultado ≈ -7 LUFS (target -2 LU) | ⬜ | Mais alto |
| T40 | Ceiling agressivo | Master (impact). | TP < -0.1 dBTP (mas >-0.3) | ⬜ | Mais próximo de 0 |
| T41 | DR mínimo | Master (impact) de áudio com DR 9. | DR final ≥ 6 dB | ⬜ | Mais compressão |
| T42 | Punch audível | A/B listening test vs CLEAN. | IMPACT deve soar mais "forte" e "presente" | ⬜ | Subjetivo, validar com produtores |

---

## 4. Testes de Integração (P0)

### 4.1 Flow End-to-End

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T43 | Upload → Análise → Master → Download | Flow completo no frontend. | Áudio masterizado baixado com sucesso | ⬜ | Happy path |
| T44 | Polling de status | Após enfileirar job, fazer polling. | Status muda: pending → processing → completed | ⬜ | Frontend atualiza UI |
| T45 | Erro de validação | Upload de arquivo > 150MB. | Erro claro: "Arquivo muito grande (max 150MB)" | ⬜ | Error handling |
| T46 | Créditos decrementados | Master com usuário PLUS (20 créditos). | Créditos vão de 20 → 19 | ⬜ | Verificar no DB |
| T47 | Limite de créditos | Usuário com 0 créditos tenta masterizar. | Erro 402: "Sem créditos disponíveis. Upgrade ou aguarde reset mensal." | ⬜ | Gating |

### 4.2 Comparação Antes/Depois

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T48 | Player A/B funciona | Masterizar, abrir página de resultados, usar player. | Consegue alternar entre original e masterizado | ⬜ | UX crítico |
| T49 | Tabela comparativa | Ver tabela com métricas antes vs depois. | Todas as métricas exibidas corretamente | ⬜ | LUFS, TP, DR, bandas |
| T50 | Download do masterizado | Clicar em "Download WAV". | Arquivo baixa com nome correto (`<track>_<mode>.wav`) | ⬜ | |

### 4.3 Re-masterização

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T51 | Re-master com outro modo | Master (balanced), depois re-master (impact). | 2º render não consome crédito (tentativa grátis) | ⬜ | Max 3 renders/faixa |
| T52 | Re-master 4ª vez | Master 3x (grátis), tentar 4ª vez. | Consome crédito normalmente | ⬜ | Após 3 renders, cobra |

---

## 5. Testes de Segurança e Limites (P0)

### 5.1 Validação Hard Limits

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T53 | Clipping detectado | Masterizar e forçar TP > 0.0 (simular bug). | Job FAIL com erro: "Clipping detectado (TP=+0.2 dBTP)" | ⬜ | Validação obrigatória |
| T54 | DR abaixo do mínimo | Master (impact) resultando em DR=5 dB. | Job FAIL com erro: "DR muito baixo (5 dB, mínimo 6 dB)" | ⬜ | |
| T55 | LUFS muito longe do target | Master que não convergiu (LUFS=-16 para target -9). | Job FAIL ou WARNING com explicação | ⬜ | Tolerância ±2 LU |
| T56 | Árquivo corrompido | Upload com WAV header inválido. | Erro ANTES de enfileirar: "Arquivo corrompido" | ⬜ | Validação prévia |

### 5.2 Rate Limiting

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T57 | Exceder limite horário | Enfileirar 6 jobs em 1 hora (limite 5). | 6º job retorna erro 429: "Limite de 5 masterings/hora excedido" | ⬜ | Redis rate limit |
| T58 | Concurrent jobs | Enfileirar 2 jobs simultaneamente. | Ambos processam corretamente, sem race condition | ⬜ | Lock pessimista no DB |

### 5.3 Idempotência

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T59 | Reenviar mesmo jobId | POST /api/automaster com analysisJobId duplicado. | Retorna resultado cacheado, não re-renderiza | ⬜ | Evitar desperdício |
| T60 | Job já processando | Tentar enfileirar job que já está em "processing". | Retorna erro ou jobId existente | ⬜ | Prevenir duplicação |

---

## 6. Testes de Performance (P1)

### 6.1 Tempo de Processamento

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T61 | Faixa 3min (WAV) | Upload WAV de 3min. Masterizar. | Processamento < 60s | ⬜ | Target: < 2x tempo real |
| T62 | Faixa 5min (FLAC) | Upload FLAC de 5min. Masterizar. | Processamento < 90s | ⬜ | |
| T63 | Faixa 10min (edge case) | Upload WAV de 10min. | Processamento < 5min OU erro "Arquivo muito longo" | ⬜ | Definir limite |

### 6.2 Concorrência

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T64 | 10 jobs simultâneos | Enfileirar 10 jobs de uma vez. | Todos completam em < 10min | ⬜ | Validar escalabilidade |
| T65 | Fila saturada | Enfileirar 50 jobs (simular alta demanda). | Workers processam sem travar, fila drena | ⬜ | Monitorar BullMQ |

---

## 7. Testes de UX (P1)

### 7.1 UI e Navegação

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T66 | Modal de seleção de modo | Clicar em "Masterizar". | Modal abre com 3 modos + descrições claras | ⬜ | |
| T67 | Tooltips explicativos | Hover sobre "IMPACT". | Tooltip: "Mais alto e agressivo. Recomendado para EDM/Hip-Hop." | ⬜ | |
| T68 | Progress bar | Durante processamento. | Progress bar com stages: "Analisando", "Aplicando EQ", "Limitando" | ⬜ | |
| T69 | Erro amigável | Job falha por DR baixo. | Mensagem clara: "Master muito comprimido. Tente modo CLEAN." | ⬜ | Não mostrar stack trace |

### 7.2 Mobile

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T70 | Upload em mobile | Testar em iPhone/Android. | Upload funciona, UI não quebra | ⬜ | |
| T71 | Player A/B em mobile | Usar player em tela pequena. | Botões acessíveis, não sobrepostos | ⬜ | |

---

## 8. Testes com Produtores Reais (P0 - Beta)

### 8.1 A/B Blind Tests

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T72 | Funk AutoMaster vs Manual | Dar 2 versions (sem identificar). Pedir preferência. | 70%+ preferem ou acham "similar" | ⬜ | Validação qualitativa |
| T73 | Eletrônica AutoMaster vs Manual | Mesmo teste, genre eletrônica. | 70%+ | ⬜ | |
| T74 | Rock AutoMaster vs Manual | Mesmo teste, genre rock. | 60%+ (rock é mais difícil) | ⬜ | |

### 8.2 Feedback Aberto

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T75 | Satisfação geral | Survey: "O resultado atendeu suas expectativas?" | 80%+ "Sim" ou "Parcialmente" | ⬜ | NPS score |
| T76 | Uso real | Survey: "Você usaria AutoMaster em produção?" | 60%+ "Sim" | ⬜ | |
| T77 | Problemas críticos | Perguntar: "Encontrou algum bug grave?" | 0 reportes de clipping/distorção | ⬜ | Red flag se houver |

---

## 9. Testes de Observabilidade (P1)

### 9.1 Logs e Métricas

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T78 | Logs estruturados | Processar job e verificar logs. | Logs têm formato JSON com `[AUTOMASTER]` prefix | ⬜ | |
| T79 | Tempo por fase | Logs mostram tempo de cada etapa. | Log: "EQ: 5.2s, Limiter: 3.1s" | ⬜ | |
| T80 | Dashboard BullMQ | Acessar BullMQ Board. | Mostra jobs waiting/processing/completed | ⬜ | |

### 9.2 Alertas

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T81 | Alerta de fila saturada | Simular 50 jobs na fila. | Alerta dispara: "Fila AutoMaster > 20 jobs" | ⬜ | Monitoramento |
| T82 | Alerta de True Peak | Job com TP > -0.05 dBTP. | Alerta: "True Peak perigosamente alto" | ⬜ | |

---

## 10. Testes de Custo (P0)

### 10.1 Validação Econômica

| # | Teste | Como Reproduzir | Esperado | Status | Notas |
|---|-------|----------------|----------|--------|-------|
| T83 | Custo por job | Processar 100 jobs, medir custo total. | Custo < $5 / 100 masterings | ⬜ | Viabilidade econômica |
| T84 | Storage crescente | Rodar por 7 dias, medir storage usado. | Temp files deletados após 24h | ⬜ | Cron está funcionando |

---

## Resumo de Critérios de Lançamento

### Obrigatórios (BLOCKER se falhar)
- ✅ 100% dos testes P0 de medição (LUFS, TP, DR) devem passar
- ✅ Nenhum clipping em nenhum modo
- ✅ DR mínimo respeitado em 100% dos casos
- ✅ Flow end-to-end funciona
- ✅ Créditos são decrementados corretamente
- ✅ Max 2 renders implementado
- ✅ Beta testers aprovam em 70%+

### Desejáveis (pode lançar com ressalvas)
- ⚠️ Performance < 60s em 80% dos casos (não 90%)
- ⚠️ UI mobile funcional mas não perfeita
- ⚠️ Logs estruturados mas alertas não configurados

---

**Última revisão:** 09/02/2026  
**Próxima atualização:** Após cada fase de implementação
