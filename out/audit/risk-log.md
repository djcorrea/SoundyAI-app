# Risk & Impact Log (Etapa 0)
Estado: Inicial
Gerado em: {{TIMESTAMP}}

## Metodologia
Cada potencial mudança avaliada quanto a: Probabilidade de Regressão (P), Impacto se quebrar (I), Mitigação via Feature Flag (FF), Prioridade (Prio).
Escalas: P/I 1–5, Prio: Alta/Média/Baixa.

## Itensddd

### 1. True Peak Oversampling Upgrade
- Problema: Filtro FIR 48 taps pode subestimar picos inter-sample (>0.1 dB) em material com transientes rápidos.
- Risco: Alterar implementação pode mudar valores exibidos já consumidos pela UI.
- P:3 I:4 Prio: Alta
- Mitigação: Introduzir novo detector sob flag `AUDIT_MODE && TP_UPGRADE` conservando campos antigos (`true_peak_dbtp_legacy`).

### 2. DR Redefinição (Separar de Crest)
- Problema: Campo `dynamicRange` atualmente = Peak - RMS (Crest). Nova definição (P95 RMS 300ms - P10 RMS 300ms) mudará números.
- Risco: Qualquer lógica que usa dynamicRange para sugestões pode alterar comportamento de dicas.
- P:4 I:3 Prio: Alta
- Mitigação: Novo campo `dr_stat` sob flag; manter `dynamicRange` legacy até migração.

### 3. LUFS Consistência entre V1 fallback e Advanced
- Problema: Fallback usa RMS proxy se advanced falha; pode divergir >1 LU.
- Risco: Score mistura fontes diferentes.
- P:2 I:3 Prio: Média
- Mitigação: Marcar `lufs_source` e ajustar scoring para penalizar baixa confiança só sob flag.

### 4. Band Scaling Normalization
- Problema: Perfil tonal das referências (bands_db) relativo (dB ratio). UI pode assumir outra escala se já consome `tonalBalance`.
- Risco: Duplicidade de interpretações.
- P:3 I:2 Prio: Média
- Mitigação: Converter internamente para escala unificada `bandEnergies[band].rms_db` sob flag `AUDIT_MODE`; não alterar JSON bruto.

### 5. THD% Implementação
- Problema: Derivação incorreta pode acusar distorção inexistente e gerar suporte.
- P:2 I:4 Prio: Média
- Mitigação: Validar em sinais sintéticos (seno puro, seno + 2ª/3ª harmônica) batch teste antes de expor fora da flag.

### 6. DC Offset Pós-HPF
- Problema: Cálculo direto inclui conteúdo <20 Hz que inflaciona offset.
- P:3 I:2 Prio: Baixa
- Mitigação: Filtro IIR 1ª ordem sob flag `DC_HPF20` e campo `dcOffset_hpf` mantendo `dcOffset` legacy.

### 7. Multi Sample Rate Support
- Problema: Coeficientes K-weighting e FIR TP fixos para 48 kHz.
- Risco: Inputs 44.1k/96k via navegador terão erro de medição.
- P:4 I:4 Prio: Alta
- Mitigação: Resample interno para 48k quando `AUDIT_MODE` ativo (linear ou sinc) + tag `resampled=true`.

### 8. Performance Regressions
- Problema: Filtro FIR 192 taps 8× pode aumentar latência inicial >100ms em dispositivos móveis.
- P:3 I:3 Prio: Média
- Mitigação: Worker + chunk process sob flag; fallback imediato para legacy se timeout.

### 9. Scoring Novo (0–100 Rubrica)
- Problema: Substitui heurística atual; possível confusão de usuários existentes.
- P:2 I:3 Prio: Média
- Mitigação: Campo `mixScoreV2` separado; manter `mixScore` legacy até validação batch.

### 10. Anti-NaN / Stale Guard
- Problema: Reutilização de últimos valores se falha de cálculo.
- P:3 I:4 Prio: Alta
- Mitigação: Flags sentinel `value_valid=false` e exibir `—` sem cache.

## Próximos Passos
- Aprovar plano de flags antes de qualquer alteração de código (Etapa 1.1 inicia True Peak upgrade).
- Adicionar colunas de Data/Hora e Status (Planned/In Progress/Done) nas próximas revisões.
