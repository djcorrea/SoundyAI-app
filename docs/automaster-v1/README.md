# AutoMaster V1 — SoundyAI

## Visão Geral

O **AutoMaster V1** é o módulo de finalização automática da SoundyAI.
Seu objetivo é entregar uma **master técnica confiável**, previsível e segura,
sem prometer milagre e sem substituir um engenheiro humano.

Este documento define o **escopo fechado**, os **princípios não negociáveis**
e a **arquitetura de alto nível** do V1.

---

## O que o AutoMaster V1 É

✅ Finalização automática técnica  
✅ Baseado em targets fixos por gênero  
✅ Modos controlam estratégia, não destino  
✅ Protegido por validações e fallback  
✅ Custos previsíveis por render  

---

## O que o AutoMaster V1 NÃO É

❌ Não é master humano  
❌ Não interpreta texto livre do usuário  
❌ Não usa multibanda ou stereo enhancer  
❌ Não tenta “consertar mix ruim”  
❌ Não faz loops infinitos de render  

---

## Princípios Não Negociáveis

1. Nunca piorar a música
2. Consistência > agressividade
3. Fallback sempre conservador
4. Transparência com o usuário
5. Custo previsível
6. Compatibilidade total com o Analisador

Se qualquer feature violar um princípio, **não entra no V1**.

---

## Pipeline de Alto Nível

Upload  
→ Análise pré-master (existente)  
→ Seleção de gênero  
→ Seleção de modo  
→ Processamento  
→ Validação técnica  
→ Fallback (se necessário)  
→ Entrega  

---

## Modos de Masterização

### CLEAN
- Target aproximado: -14 LUFS
- Ceiling: -1.0 dBTP
- Perfil: conservador e natural

### BALANCED (default)
- Target aproximado: -11 LUFS
- Ceiling: -0.8 dBTP
- Perfil: profissional equilibrado

### IMPACT
- Target aproximado: -9 LUFS
- Ceiling: -0.5 dBTP
- Perfil: alto impacto

> Quanto mais alto o modo, maior a compressão implícita do limiter.

---

## Verdade Técnica Única

O AutoMaster e o Analisador utilizam **os mesmos targets por gênero**.

- O gênero define o destino
- O modo define a estratégia
- Nenhum modo altera o target do gênero

Qualquer violação disso quebra a confiança do produto.

---

## Status do Projeto

🟡 **Fase atual:** Auditoria e documentação  
🟢 **Objetivo imediato:** Validar viabilidade técnica e riscos  
🔴 **Código DSP:** ainda NÃO iniciado  

---

## Próximos Passos

1. Auditoria completa do core atual
2. Mapeamento dos targets por gênero
3. Definição dos guardrails mensuráveis
4. Escolha da engine de processamento
5. Implementação controlada do MVP
6. Lançamento como Beta

---

## Nota Importante

O AutoMaster V1 é uma **base sólida**, não um produto final.
Qualidade real é evolução controlada, não milagre inicial.
